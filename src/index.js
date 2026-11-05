// MY OS — проверочный стенд (версия 3).
// Разворачивается кнопкой «Deploy to Cloudflare»: база D1, хранилище KV,
// хранилище файлов (Durable Objects), Workers AI и таймер создаются автоматически.
// Платные услуги не подключаются. Если бесплатный лимит исчерпан, операция
// останавливается с понятным сообщением — платный тариф стенд не включает и не может включить.

import { DurableObject } from "cloudflare:workers";
import { ICON_PNG_B64 } from "./icon.js";
import { PAGE } from "./page.js";
import { SW } from "./sw.js";
import { deliver, getVapid } from "./push.js";

// ---------- бесплатные лимиты Cloudflare (проверены по официальной документации, 05.11.2026) ----------

export const LIMITS = {
  requests: 100000, // запросы Workers в сутки
  d1Read: 5000000, // строк D1 прочитано в сутки
  d1Written: 100000, // строк D1 записано в сутки
  d1Size: 500 * 1024 * 1024, // одна база D1
  kvReads: 100000,
  kvWrites: 1000, // записи + удаления + списки KV в сутки
  doRequests: 100000, // запросы к Durable Objects в сутки
  doStorage: 5 * 1024 * 1024 * 1024, // всё хранилище Durable Objects аккаунта
  neurons: 10000, // Workers AI в сутки
};
const WARN = 0.7;
const ECONOMY = 0.85;

const AI_MODELS = {
  fast: { id: "@cf/qwen/qwen3-30b-a3b-fp8", name: "быстрая (Qwen3 30B)", inRate: 4625, outRate: 30475 },
  balanced: { id: "@cf/google/gemma-4-26b-a4b-it", name: "запасная (Gemma 4 26B)", inRate: 9091, outRate: 27273 },
  strong: { id: "@cf/openai/gpt-oss-120b", name: "сильная (gpt-oss-120b)", inRate: 31818, outRate: 68182 },
};

const AI_PROMPT =
  "Ты — режим «Стратег» персональной системы MY OS. Отвечай только по-русски. " +
  "Вопрос: как распределить 10 часов в неделю между ведением Telegram-канала " +
  "и запуском новой услуги? Дай ответ в трёх коротких пунктах.";

const CHUNK = 1024 * 1024; // 1 МБ на строку (предел строки Durable Objects — 2 МБ)
const MAX_FILE = 50 * 1024 * 1024;
const ROWS_PER_REQUEST = 20; // у D1 не больше 50 запросов на одно обращение

// Таблицы тестовых данных и их столбцы. Только они участвуют в копии и восстановлении.
export const TABLES = {
  objects: ["id", "kind", "title", "body", "created_at", "updated_at"],
  versions: ["id", "object_id", "ver", "body", "created_at"],
  links: ["id", "from_id", "to_id", "rel"],
  attachments: ["id", "object_id", "file_id", "role"],
  settings: ["key", "value"],
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const errorText = (e) => (e && e.message ? e.message : String(e));
const utcDay = () => new Date().toISOString().slice(0, 10);
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (bytes) => hex(await crypto.subtle.digest("SHA-256", bytes));

function localTime(tz, date = new Date()) {
  try {
    return date.toLocaleString("ru-RU", { timeZone: tz, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return date.toISOString();
  }
}

// ---------- учёт расхода ----------
// Строки D1 и размер базы берутся из ответов самой базы (meta) — это цифры Cloudflare.
// Запросы, KV и обращения к хранилищу файлов стенд считает сам — это его подсчёт.

const newMeter = () => ({ requests: 1, d1Read: 0, d1Written: 0, d1Size: null, kvReads: 0, kvWrites: 0, doRequests: 0 });

function addMeta(m, meta) {
  if (!meta) return;
  m.d1Read += meta.rows_read || 0;
  m.d1Written += meta.rows_written || 0;
  if (typeof meta.size_after === "number") m.d1Size = meta.size_after;
}

function wrapStmt(raw, m) {
  return {
    __raw: raw,
    bind: (...args) => wrapStmt(raw.bind(...args), m),
    run: async () => {
      const r = await raw.run();
      addMeta(m, r.meta);
      return r;
    },
    all: async () => {
      const r = await raw.all();
      addMeta(m, r.meta);
      return r;
    },
    first: async () => {
      const r = await raw.all();
      addMeta(m, r.meta);
      return r.results[0] || null;
    },
  };
}

function metered(env, m) {
  const out = { ...env, __m: m, __env: env };
  if (env.DB)
    out.DB = {
      prepare: (sql) => wrapStmt(env.DB.prepare(sql), m),
      batch: async (stmts) => {
        const rs = await env.DB.batch(stmts.map((s) => s.__raw || s));
        rs.forEach((r) => addMeta(m, r.meta));
        return rs;
      },
    };
  if (env.KV)
    out.KV = {
      get: (...a) => {
        m.kvReads++;
        return env.KV.get(...a);
      },
      put: (...a) => {
        m.kvWrites++;
        return env.KV.put(...a);
      },
      delete: (...a) => {
        m.kvWrites++;
        return env.KV.delete(...a);
      },
    };
  return out;
}

async function flushMeter(env) {
  const m = env.__m;
  const raw = env.__env;
  if (!m || !raw.DB) return;
  try {
    await raw.DB.prepare(
      `INSERT INTO meter (day, requests, d1_read, d1_written, d1_size, kv_reads, kv_writes, do_requests)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(day) DO UPDATE SET requests = requests + excluded.requests, d1_read = d1_read + excluded.d1_read,
         d1_written = d1_written + excluded.d1_written, d1_size = COALESCE(excluded.d1_size, d1_size),
         kv_reads = kv_reads + excluded.kv_reads, kv_writes = kv_writes + excluded.kv_writes,
         do_requests = do_requests + excluded.do_requests`
    )
      .bind(utcDay(), m.requests, m.d1Read, m.d1Written + 1, m.d1Size, m.kvReads, m.kvWrites, m.doRequests)
      .run();
  } catch (e) {
    // учёт не должен ломать основную операцию
  }
}

async function todayUsage(env) {
  const day = utcDay();
  const row = (await env.DB.prepare("SELECT * FROM meter WHERE day = ?").bind(day).first()) || {};
  const ai = (await env.DB.prepare("SELECT neurons, calls FROM ai_usage WHERE day = ?").bind(day).first()) || {};
  return {
    requests: row.requests || 0,
    d1Read: row.d1_read || 0,
    d1Written: row.d1_written || 0,
    d1Size: row.d1_size || 0,
    kvReads: row.kv_reads || 0,
    kvWrites: row.kv_writes || 0,
    doRequests: row.do_requests || 0,
    neurons: ai.neurons || 0,
    aiCalls: ai.calls || 0,
  };
}

const level = (used, limit) => {
  const p = limit ? used / limit : 0;
  return p >= 1 ? "stop" : p >= ECONOMY ? "economy" : p >= WARN ? "warn" : "ok";
};

async function resetText(env) {
  const tz = (await getSetting(env, "timezone")) || "UTC";
  const n = new Date();
  return localTime(tz, new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + 1)));
}

// Остановка операции, если бесплатный лимит на сегодня почти исчерпан.
async function guard(env, kind) {
  const u = await todayUsage(env);
  const checks = {
    d1write: [u.d1Written, LIMITS.d1Written * 0.95, "запись в базу"],
    kvwrite: [u.kvWrites, LIMITS.kvWrites * 0.95, "запись в быстрое хранилище"],
    files: [u.doRequests, LIMITS.doRequests * 0.95, "работа с файлами"],
  };
  const c = checks[kind];
  if (c && c[0] >= c[1])
    throw Object.assign(
      new Error(`Операция «${c[2]}» остановлена: бесплатный лимит на сегодня почти исчерпан. Платный тариф не включён и включаться не будет. Лимит обновится ${await resetText(env)} по твоему времени.`),
      { status: 429 }
    );
}

// ---------- база D1 ----------

let tablesReady = false;
async function ensureTables(env) {
  if (tablesReady) return;
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, neurons REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS meter (day TEXT PRIMARY KEY, requests INTEGER DEFAULT 0, d1_read INTEGER DEFAULT 0, d1_written INTEGER DEFAULT 0, d1_size INTEGER, kv_reads INTEGER DEFAULT 0, kv_writes INTEGER DEFAULT 0, do_requests INTEGER DEFAULT 0)"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS objects (id TEXT PRIMARY KEY, kind TEXT, title TEXT, body TEXT, created_at TEXT, updated_at TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS versions (id TEXT PRIMARY KEY, object_id TEXT, ver INTEGER, body TEXT, created_at TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS links (id TEXT PRIMARY KEY, from_id TEXT, to_id TEXT, rel TEXT)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS attachments (id TEXT PRIMARY KEY, object_id TEXT, file_id TEXT, role TEXT)"),
  ]);
  tablesReady = true;
}

async function logEvent(env, kind, note) {
  await env.DB.prepare("INSERT INTO events (kind, note, created_at) VALUES (?, ?, ?)").bind(kind, note || null, new Date().toISOString()).run();
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}

async function setSetting(env, key, value) {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(key, value).run();
}

// ---------- уведомления ----------

async function pushToMe(env, body, path) {
  const sub = await env.KV.get("push-subscription", "json");
  if (!sub) return { ok: false, error: "Уведомления ещё не включены" };
  const origin = (await env.KV.get("site-origin")) || "https://example.com";
  const result = await deliver(env, sub, { body, path }, origin);
  const note = `${result.ok ? "принято службой уведомлений" : result.expired ? "подписка устарела" : "ошибка"}; попытки: ${result.attempts.join(", ")}`;
  await logEvent(env, "push", note);
  if (result.expired) await env.KV.delete("push-subscription");
  return { ...result, note };
}

// ---------- Workers AI ----------

function extractText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result.response === "string") return result.response;
  if (result.choices && result.choices[0]) {
    const c = result.choices[0];
    if (c.message && typeof c.message.content === "string") return c.message.content;
    if (typeof c.text === "string") return c.text;
  }
  if (Array.isArray(result.output)) {
    const parts = [];
    for (const item of result.output) {
      if (item && item.type === "message" && Array.isArray(item.content)) {
        for (const c of item.content) if (c && typeof c.text === "string") parts.push(c.text);
      }
    }
    if (parts.length) return parts.join("\n");
  }
  return JSON.stringify(result).slice(0, 800);
}

function usageNumbers(usage) {
  if (!usage) return null;
  const input = usage.prompt_tokens ?? usage.input_tokens ?? null;
  const output = usage.completion_tokens ?? usage.output_tokens ?? null;
  if (input === null || output === null) return null;
  return { input, output };
}

async function runAI(env, which) {
  const before = await todayUsage(env);
  const reset = (await resetText(env)) + " по твоему времени";
  if (before.neurons >= LIMITS.neurons)
    throw Object.assign(
      new Error(`Дневной бесплатный лимит ИИ исчерпан (по оценке MY OS: ${Math.round(before.neurons)} из ${LIMITS.neurons}). Запрос не отправлен, платный тариф не включён. Лимит обновится ${reset}.`),
      { status: 429 }
    );
  let economy = false;
  if (before.neurons >= LIMITS.neurons * ECONOMY && which !== "fast") {
    which = "fast";
    economy = true;
  }
  const model = AI_MODELS[which] || AI_MODELS.fast;
  const started = Date.now();
  let result;
  try {
    if (model.id.includes("gpt-oss")) {
      try {
        result = await env.AI.run(model.id, { instructions: "Отвечай только по-русски.", input: AI_PROMPT });
      } catch (e) {
        result = await env.AI.run(model.id, { messages: [{ role: "user", content: AI_PROMPT }] });
      }
    } else {
      result = await env.AI.run(model.id, {
        messages: [
          { role: "system", content: "Отвечай только по-русски. /no_think" },
          { role: "user", content: AI_PROMPT },
        ],
        max_tokens: 700,
      });
    }
  } catch (e) {
    const t = errorText(e);
    if (/4006|neuron|allocation|limit/i.test(t))
      throw Object.assign(new Error(`Cloudflare сообщил, что бесплатный лимит ИИ на сегодня исчерпан. Платный тариф не включён. Лимит обновится ${reset}. (${t})`), { status: 429 });
    throw e;
  }
  const text = extractText(result).replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  const u = usageNumbers(result && result.usage);
  let neurons = null;
  if (u) {
    neurons = (u.input * model.inRate + u.output * model.outRate) / 1e6;
    await env.DB.prepare(
      "INSERT INTO ai_usage (day, neurons, calls) VALUES (?, ?, 1) ON CONFLICT(day) DO UPDATE SET neurons = neurons + excluded.neurons, calls = calls + 1"
    )
      .bind(utcDay(), neurons)
      .run();
  }
  const after = await todayUsage(env);
  return {
    model: model.name,
    economy,
    ms: Date.now() - started,
    text,
    tokens: u,
    neurons: neurons === null ? null : Math.round(neurons * 10) / 10,
    todayNeurons: Math.round(after.neurons),
    dailyLimit: LIMITS.neurons,
  };
}

// ---------- хранилище файлов (Durable Object на SQLite) ----------

export class FileStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT, type TEXT, size INTEGER, chunks INTEGER, sha256 TEXT, created_at TEXT)"
    );
    this.sql.exec("CREATE TABLE IF NOT EXISTS chunks (file_id TEXT, idx INTEGER, data BLOB, PRIMARY KEY (file_id, idx))");
  }

  async put(name, type, body, id, createdAt) {
    const bytes = body instanceof ReadableStream ? await new Response(body).arrayBuffer() : body;
    const data = new Uint8Array(bytes);
    if (data.length > MAX_FILE) throw new Error("Файл больше 50 МБ — в стенде так нельзя");
    id = id || crypto.randomUUID();
    const hash = await sha256(data);
    const count = Math.max(1, Math.ceil(data.length / CHUNK));
    this.ctx.storage.transactionSync(() => {
      this.sql.exec("DELETE FROM chunks WHERE file_id = ?", id);
      this.sql.exec("DELETE FROM files WHERE id = ?", id);
      for (let i = 0; i < count; i++) {
        this.sql.exec("INSERT INTO chunks (file_id, idx, data) VALUES (?, ?, ?)", id, i, data.slice(i * CHUNK, (i + 1) * CHUNK).buffer);
      }
      this.sql.exec(
        "INSERT INTO files (id, name, type, size, chunks, sha256, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        id,
        name,
        type,
        data.length,
        count,
        hash,
        createdAt || new Date().toISOString()
      );
    });
    return { id, size: data.length, chunks: count, sha256: hash };
  }

  async get(id) {
    const meta = this.sql.exec("SELECT name, type, size FROM files WHERE id = ?", id).toArray()[0];
    if (!meta) return null;
    const rows = this.sql.exec("SELECT data FROM chunks WHERE file_id = ? ORDER BY idx", id).toArray();
    const out = new Uint8Array(meta.size);
    let o = 0;
    for (const r of rows) {
      const part = new Uint8Array(r.data);
      out.set(part, o);
      o += part.length;
    }
    return { meta, bytes: out };
  }

  async list() {
    return this.sql.exec("SELECT id, name, type, size, chunks, sha256, created_at FROM files ORDER BY created_at, id").toArray();
  }

  // Пересчитывает отпечаток каждого файла заново из сохранённых частей.
  async verifyAll() {
    const out = [];
    for (const f of await this.list()) {
      const got = await this.get(f.id);
      const actual = await sha256(got.bytes);
      out.push({ id: f.id, name: f.name, size: f.size, stored: f.sha256, actual, ok: actual === f.sha256 && got.bytes.length === f.size });
    }
    return out;
  }

  async wipe() {
    const n = this.sql.exec("SELECT COUNT(*) AS n FROM files").toArray()[0].n;
    this.sql.exec("DELETE FROM chunks");
    this.sql.exec("DELETE FROM files");
    return n;
  }

  async stats() {
    const row = this.sql.exec("SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM files").toArray()[0];
    return { files: row.n, bytes: row.bytes, databaseSize: this.ctx.storage.sql.databaseSize };
  }
}

// Каждое обращение к хранилищу файлов — отдельный запрос Durable Objects, считаем его.
function files(env) {
  const stub = env.FILES.get(env.FILES.idFromName("main"));
  const call = (method) => (...args) => {
    if (env.__m) env.__m.doRequests++;
    return stub[method](...args);
  };
  return { put: call("put"), get: call("get"), list: call("list"), verifyAll: call("verifyAll"), wipe: call("wipe"), stats: call("stats") };
}

// ---------- тестовые данные: объекты, связи, версии, вложения ----------

function makePdf(lines) {
  const esc = (s) => s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  const text = lines.map((l, i) => `BT /F1 ${i ? 14 : 22} Tf 72 ${740 - i * 30} Td (${esc(l)}) Tj ET`).join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offsets = [];
  objs.forEach((o, i) => {
    offsets.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offsets.map((o) => String(o).padStart(10, "0") + " 00000 n \n").join("");
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(out);
}

async function seedDemo(env) {
  const existing = await env.DB.prepare("SELECT COUNT(*) AS n FROM objects").first();
  if (existing.n > 0) return { created: false };
  await guard(env, "d1write");
  const now = new Date().toISOString();
  const store = files(env);
  const pdf = await store.put("Прайс на услугу.pdf", "application/pdf", makePdf(["MY OS - test document", "Price list for the new service", "Created by the test stand"]));
  const png = await store.put("Обложка поста.png", "image/png", Uint8Array.from(atob(ICON_PNG_B64), (c) => c.charCodeAt(0)));
  const userFiles = (await store.list()).filter((f) => f.id !== pdf.id && f.id !== png.id);

  const goal = "obj-goal",
    task = "obj-task",
    project = "obj-project",
    post = "obj-post",
    note = "obj-note";
  const objects = [
    [goal, "цель", "Запустить новую услугу", JSON.stringify({ срок: "31.12.2026", прогресс: 40 })],
    [task, "задача", "Подготовить прайс", JSON.stringify({ статус: "в работе", приоритет: "высокий" })],
    [project, "проект", "Telegram-канал", JSON.stringify({ описание: "Канал о запуске услуги" })],
    [post, "пост", "Анонс услуги", JSON.stringify({ текущая_версия: 3, опубликована_версия: 2, ссылка: "https://t.me/example/123" })],
    [note, "заметка", "Документы с iPad", JSON.stringify({ файлов: userFiles.length })],
  ];
  const versions = [
    ["ver-post-1", post, 1, "Черновик: скоро новая услуга."],
    ["ver-post-2", post, 2, "Запускаю новую услугу — подробности в посте. (опубликовано)"],
    ["ver-post-3", post, 3, "Запускаю новую услугу! Ранняя запись до пятницы."],
    ["ver-task-1", task, 1, "Собрать цены конкурентов"],
    ["ver-task-2", task, 2, "Собрать цены конкурентов и составить прайс"],
  ];
  const links = [
    ["lnk-1", task, goal, "часть цели"],
    ["lnk-2", post, project, "публикация проекта"],
    ["lnk-3", post, task, "связан с задачей"],
    ["lnk-4", note, project, "материалы проекта"],
  ];
  const attachments = [
    ["att-1", task, pdf.id, "документ"],
    ["att-2", post, png.id, "картинка поста"],
    ...userFiles.map((f, i) => [`att-u${i + 1}`, note, f.id, "файл с iPad"]),
  ];
  const stmts = [
    ...objects.map((o) => env.DB.prepare("INSERT INTO objects (id, kind, title, body, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)").bind(...o, now, now)),
    ...versions.map((v) => env.DB.prepare("INSERT INTO versions (id, object_id, ver, body, created_at) VALUES (?, ?, ?, ?, ?)").bind(...v, now)),
    ...links.map((l) => env.DB.prepare("INSERT INTO links (id, from_id, to_id, rel) VALUES (?, ?, ?, ?)").bind(...l)),
  ];
  await env.DB.batch(stmts);
  for (let i = 0; i < attachments.length; i += ROWS_PER_REQUEST) {
    await env.DB.batch(
      attachments.slice(i, i + ROWS_PER_REQUEST).map((a) => env.DB.prepare("INSERT INTO attachments (id, object_id, file_id, role) VALUES (?, ?, ?, ?)").bind(...a))
    );
  }
  await logEvent(env, "backup", `тестовые данные созданы: объектов ${objects.length}, версий ${versions.length}, связей ${links.length}, вложений ${attachments.length}`);
  return { created: true };
}

async function exportData(env) {
  const tables = {};
  for (const t of Object.keys(TABLES)) {
    const order = t === "settings" ? "key" : "id";
    tables[t] = (await env.DB.prepare(`SELECT ${TABLES[t].join(", ")} FROM ${t} ORDER BY ${order}`).all()).results;
  }
  const fileList = await files(env).list();
  return { format: "myos-backup", formatVersion: 1, createdAt: new Date().toISOString(), tables, files: fileList };
}

async function verifyData(env) {
  const counts = {};
  for (const t of Object.keys(TABLES)) counts[t] = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first()).n;
  const fileCheck = await files(env).verifyAll();
  const fileIds = new Set(fileCheck.map((f) => f.id));
  const brokenLinks = (
    await env.DB.prepare(
      "SELECT id FROM links WHERE from_id NOT IN (SELECT id FROM objects) OR to_id NOT IN (SELECT id FROM objects)"
    ).all()
  ).results.length;
  const brokenVersions = (await env.DB.prepare("SELECT id FROM versions WHERE object_id NOT IN (SELECT id FROM objects)").all()).results.length;
  const att = (await env.DB.prepare("SELECT id, object_id, file_id FROM attachments").all()).results;
  const objIds = new Set((await env.DB.prepare("SELECT id FROM objects").all()).results.map((r) => r.id));
  const brokenAttachments = att.filter((a) => !objIds.has(a.object_id) || !fileIds.has(a.file_id)).length;
  return { counts, files: fileCheck, brokenLinks, brokenVersions, brokenAttachments };
}

async function wipeDemo(env) {
  const counts = {};
  for (const t of Object.keys(TABLES)) counts[t] = (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${t}`).first()).n;
  await env.DB.batch(Object.keys(TABLES).map((t) => env.DB.prepare(`DELETE FROM ${t}`)));
  const removedFiles = await files(env).wipe();
  await logEvent(env, "backup", `тестовые данные стёрты: файлов ${removedFiles}, строк ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  return { counts, files: removedFiles };
}

async function restoreRows(env, table, rows) {
  const cols = TABLES[table];
  if (!cols) throw Object.assign(new Error("Неизвестная таблица в копии: " + table), { status: 400 });
  if (!Array.isArray(rows) || rows.length > ROWS_PER_REQUEST)
    throw Object.assign(new Error(`За один раз можно передать не больше ${ROWS_PER_REQUEST} строк`), { status: 400 });
  await guard(env, "d1write");
  const sql = `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`;
  if (rows.length) await env.DB.batch(rows.map((r) => env.DB.prepare(sql).bind(...cols.map((c) => (r[c] === undefined ? null : r[c])))));
  return rows.length;
}

// ---------- счётчики ----------

async function counters(env) {
  const u = await todayUsage(env);
  const fileStats = await files(env).stats();
  const tz = (await getSetting(env, "timezone")) || "UTC";
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const CF = "Cloudflare: из ответов базы на запросы стенда";
  const OWN = "подсчёт стенда";
  const EST = "оценка MY OS";
  const row = (name, used, limit, unit, source, note) => ({ name, used, limit, unit, source, note, pct: limit ? Math.round((used / limit) * 1000) / 10 : 0, level: level(used, limit) });
  return {
    day: utcDay(),
    resetLocal: localTime(tz, reset),
    timezone: tz,
    items: [
      row("Запросы к серверу", u.requests, LIMITS.requests, "в сутки", OWN, "Считаются только обращения к этому стенду. Точная цифра по аккаунту — в панели Cloudflare."),
      row("База: строк прочитано", u.d1Read, LIMITS.d1Read, "в сутки", CF, "Сумма прочитанных строк, которые база сама указывает в каждом ответе."),
      row("База: строк записано", u.d1Written, LIMITS.d1Written, "в сутки", CF, "Сумма записанных строк из ответов базы плюс 1 строка учёта на каждый запрос."),
      row("Размер базы", u.d1Size, LIMITS.d1Size, "байт", "Cloudflare: размер базы из её последнего ответа", ""),
      row("Хранилище файлов", fileStats.databaseSize, LIMITS.doStorage, "байт", "Cloudflare: размер хранилища файлов", `Файлов: ${fileStats.files}. Место после удаления освобождается не сразу.`),
      row("Обращения к хранилищу файлов", u.doRequests, LIMITS.doRequests, "в сутки", OWN, ""),
      row("Быстрое хранилище: чтения", u.kvReads, LIMITS.kvReads, "в сутки", OWN, ""),
      row("Быстрое хранилище: записи", u.kvWrites, LIMITS.kvWrites, "в сутки", OWN, "Самый жёсткий лимит: 1000 в сутки."),
      row("ИИ: нейроны", Math.round(u.neurons), LIMITS.neurons, "в сутки", EST, `Токены — из ответа модели, цена в нейронах — из прайса Cloudflare. Обращений: ${u.aiCalls}. Точная цифра — в панели Cloudflare.`),
    ],
    thresholds: { warn: WARN, economy: ECONOMY },
  };
}

// ---------- API ----------

async function handleApi(request, env, url, ctx) {
  const p = url.pathname;
  const missing = [];
  if (!env.DB) missing.push("DB (база D1)");
  if (!env.KV) missing.push("KV (хранилище KV)");
  if (!env.FILES) missing.push("FILES (хранилище файлов)");
  if (!env.AI && p === "/api/ai") missing.push("AI (Workers AI)");
  if (missing.length && p !== "/api/ping")
    return json({ ok: false, error: "Не подключено: " + missing.join(", ") + ". Разверни стенд кнопкой ещё раз." }, 500);

  try {
    if (p === "/api/ping") return json({ ok: true, colo: request.cf && request.cf.colo, country: request.cf && request.cf.country });

    await ensureTables(env);

    if (p === "/api/settings" && request.method === "GET") return json({ ok: true, timezone: await getSetting(env, "timezone") });
    if (p === "/api/settings" && request.method === "POST") {
      const body = await request.json();
      try {
        if (!body.timezone) throw new Error();
        new Intl.DateTimeFormat("ru-RU", { timeZone: body.timezone });
      } catch (e) {
        return json({ ok: false, error: "Неизвестный часовой пояс" }, 400);
      }
      await setSetting(env, "timezone", body.timezone);
      await logEvent(env, "settings", "часовой пояс: " + body.timezone);
      return json({ ok: true });
    }

    if (p === "/api/check" && request.method === "POST") {
      const t1 = Date.now();
      await logEvent(env, "check", "проверка базы с iPad");
      const n = (await env.DB.prepare("SELECT COUNT(*) AS n FROM events").first()).n;
      const d1ms = Date.now() - t1;
      const t2 = Date.now();
      let kv = "пропущено: лимит записей на сегодня почти исчерпан";
      if ((await todayUsage(env)).kvWrites < LIMITS.kvWrites * 0.5) {
        const value = "проверка " + new Date().toISOString();
        await env.KV.put("kv-test", value);
        kv = (await env.KV.get("kv-test")) === value ? "работает" : "прочитано не то, что записано";
      }
      return json({ ok: true, d1ms, rows: n, kv, kvms: Date.now() - t2, colo: request.cf && request.cf.colo, country: request.cf && request.cf.country });
    }

    if (p === "/api/ai" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      return json({ ok: true, ...(await runAI(env, body.model)) });
    }

    if (p === "/api/files" && request.method === "POST") {
      const len = Number(request.headers.get("content-length") || 0);
      if (len > MAX_FILE) return json({ ok: false, error: "Файл больше 50 МБ — в стенде так нельзя" }, 413);
      await guard(env, "files");
      const name = decodeURIComponent(request.headers.get("x-file-name") || "файл");
      const type = request.headers.get("content-type") || "application/octet-stream";
      const t = Date.now();
      const saved = await files(env).put(name, type, request.body);
      await logEvent(env, "file", `${name}, ${saved.size} байт`);
      return json({ ok: true, ...saved, ms: Date.now() - t });
    }

    if (p.startsWith("/api/files/") && request.method === "GET") {
      const got = await files(env).get(p.slice("/api/files/".length));
      if (!got) return json({ ok: false, error: "Файл не найден" }, 404);
      return new Response(got.bytes, { headers: { "content-type": got.meta.type, "cache-control": "no-store" } });
    }

    if (p === "/api/demo/seed" && request.method === "POST") {
      const r = await seedDemo(env);
      return json({ ok: true, ...r, ...(await verifyData(env)) });
    }
    if (p === "/api/backup/data") return json({ ok: true, ...(await exportData(env)) });
    if (p === "/api/backup/verify") return json({ ok: true, ...(await verifyData(env)) });
    if (p === "/api/backup/wipe" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      if (body.confirm !== "СТЕРЕТЬ") return json({ ok: false, error: "Нужно подтверждение" }, 400);
      return json({ ok: true, ...(await wipeDemo(env)) });
    }
    if (p === "/api/restore/file" && request.method === "POST") {
      await guard(env, "files");
      const id = request.headers.get("x-file-id");
      if (!id || !/^[\w-]{1,64}$/.test(id)) return json({ ok: false, error: "Неверный номер файла в копии" }, 400);
      const saved = await files(env).put(
        decodeURIComponent(request.headers.get("x-file-name") || "файл"),
        request.headers.get("content-type") || "application/octet-stream",
        request.body,
        id,
        request.headers.get("x-file-created") || null
      );
      return json({ ok: true, ...saved });
    }
    if (p === "/api/restore/rows" && request.method === "POST") {
      const body = await request.json();
      return json({ ok: true, inserted: await restoreRows(env, body.table, body.rows) });
    }
    if (p === "/api/restore/done" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      await logEvent(env, "backup", "восстановление из копии: " + (body.result || "без итога"));
      return json({ ok: true });
    }

    if (p === "/api/counters") return json({ ok: true, ...(await counters(env)) });

    if (p === "/api/vapid") return json({ ok: true, publicKey: (await getVapid(env)).publicKey });
    if (p === "/api/subscribe" && request.method === "POST") {
      const sub = await request.json();
      if (!sub || !sub.endpoint || !sub.keys) return json({ ok: false, error: "Пустая подписка" }, 400);
      const old = await env.KV.get("push-subscription");
      if (old !== JSON.stringify(sub)) {
        await guard(env, "kvwrite");
        await env.KV.put("push-subscription", JSON.stringify(sub));
        await env.KV.put("site-origin", url.origin);
        await logEvent(env, "push-subscribe", new URL(sub.endpoint).host);
      }
      return json({ ok: true });
    }
    if (p === "/api/push-test" && request.method === "POST") {
      const tz = (await getSetting(env, "timezone")) || "UTC";
      const r = await pushToMe(env, `Проверочное уведомление, отправлено ${localTime(tz)}. Нажми — откроется раздел «Уведомления».`, "/#push");
      return json({ ok: r.ok, note: r.note, error: r.ok ? null : r.error || r.note });
    }

    if (p === "/api/status") {
      const q = (kind) => env.DB.prepare("SELECT created_at, note FROM events WHERE kind = ? ORDER BY id DESC LIMIT 8").bind(kind).all();
      return json({
        ok: true,
        timezone: await getSetting(env, "timezone"),
        cron: (await q("cron")).results,
        pushes: (await q("push")).results,
        backups: (await q("backup")).results,
        pushSubscribed: !!(await env.KV.get("push-subscription")),
      });
    }

    return json({ ok: false, error: "Неизвестный адрес" }, 404);
  } catch (e) {
    return json({ ok: false, error: errorText(e) }, e.status || 500);
  } finally {
    if (env.DB) ctx.waitUntil(flushMeter(env));
  }
}

// ---------- точка входа ----------

function iconResponse() {
  const bin = Uint8Array.from(atob(ICON_PNG_B64), (c) => c.charCodeAt(0));
  return new Response(bin, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
}

const MANIFEST = {
  name: "MY OS — проверка",
  short_name: "MY OS",
  lang: "ru",
  start_url: "/",
  scope: "/",
  display: "standalone",
  background_color: "#2E1A45",
  theme_color: "#2E1A45",
  icons: [{ src: "/icon.png", sizes: "180x180", type: "image/png" }],
};

export default {
  async fetch(request, rawEnv, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, metered(rawEnv, newMeter()), url, ctx);
    if (url.pathname === "/manifest.webmanifest")
      return new Response(JSON.stringify(MANIFEST), { headers: { "content-type": "application/manifest+json; charset=utf-8" } });
    if (url.pathname === "/sw.js") return new Response(SW, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/icon.png") return iconResponse();
    if (url.pathname === "/" || url.pathname === "/index.html")
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return new Response("Страница не найдена", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },

  // Раз в час. Работает на серверах Cloudflare, iPad и Safari для этого не нужны.
  async scheduled(controller, rawEnv, ctx) {
    if (!rawEnv.DB || !rawEnv.KV) return;
    const env = metered(rawEnv, newMeter());
    try {
      await ensureTables(env);
      const tz = (await getSetting(env, "timezone")) || "UTC";
      const when = localTime(tz);
      await logEvent(env, "cron", `таймер сработал, по твоему времени ${when} (${tz})`);
      // Предупреждение о расходе лимитов — не чаще одного раза в сутки.
      let warning = "";
      if (rawEnv.FILES) {
        const c = await counters(env);
        const high = c.items.filter((i) => i.level !== "ok");
        const key = "warned-" + c.day;
        if (high.length && !(await env.KV.get(key))) {
          warning = " Внимание: " + high.map((i) => `${i.name.toLowerCase()} — ${i.pct}%`).join(", ") + ".";
          await env.KV.put(key, "1", { expirationTtl: 172800 });
          await logEvent(env, "limits", warning.trim());
        }
      }
      await pushToMe(env, `Фоновая задача сработала ${when}. Приложение для этого открывать не нужно.${warning}`, "/#cron").catch(() => null);
    } finally {
      await flushMeter(env);
    }
  },
};
