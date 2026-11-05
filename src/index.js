// MY OS — проверочный стенд (версия 2).
// Разворачивается кнопкой «Deploy to Cloudflare»: база D1, хранилище KV,
// хранилище файлов (Durable Objects), Workers AI и таймер создаются автоматически.

import { DurableObject } from "cloudflare:workers";
import { ICON_PNG_B64 } from "./icon.js";
import { PAGE } from "./page.js";
import { SW } from "./sw.js";
import { deliver, getVapid } from "./push.js";

const AI_MODELS = {
  fast: { id: "@cf/qwen/qwen3-30b-a3b-fp8", name: "быстрая (Qwen3 30B)", inRate: 4625, outRate: 30475 },
  balanced: { id: "@cf/google/gemma-4-26b-a4b-it", name: "запасная (Gemma 4 26B)", inRate: 9091, outRate: 27273 },
  strong: { id: "@cf/openai/gpt-oss-120b", name: "сильная (gpt-oss-120b)", inRate: 31818, outRate: 68182 },
};
const DAILY_NEURONS = 10000;

const AI_PROMPT =
  "Ты — режим «Стратег» персональной системы MY OS. Отвечай только по-русски. " +
  "Вопрос: как распределить 10 часов в неделю между ведением Telegram-канала " +
  "и запуском новой услуги? Дай ответ в трёх коротких пунктах.";

const CHUNK = 1024 * 1024; // 1 МБ на строку хранилища файлов
const MAX_FILE = 50 * 1024 * 1024;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });

const errorText = (e) => (e && e.message ? e.message : String(e));

// ---------- база D1 ----------

async function ensureTables(env) {
  await env.DB.batch([
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL)"
    ),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)"),
    env.DB.prepare(
      "CREATE TABLE IF NOT EXISTS ai_usage (day TEXT PRIMARY KEY, neurons REAL NOT NULL DEFAULT 0, calls INTEGER NOT NULL DEFAULT 0)"
    ),
  ]);
}

async function logEvent(env, kind, note) {
  await env.DB.prepare("INSERT INTO events (kind, note, created_at) VALUES (?, ?, ?)")
    .bind(kind, note || null, new Date().toISOString())
    .run();
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first();
  return row ? row.value : null;
}

async function setSetting(env, key, value) {
  await env.DB.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .bind(key, value)
    .run();
}

const utcDay = () => new Date().toISOString().slice(0, 10);

function localTime(tz) {
  try {
    return new Date().toLocaleString("ru-RU", { timeZone: tz, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return new Date().toISOString();
  }
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
  const model = AI_MODELS[which] || AI_MODELS.fast;
  const started = Date.now();
  let result;
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
  const today = await env.DB.prepare("SELECT neurons, calls FROM ai_usage WHERE day = ?").bind(utcDay()).first();
  return {
    model: model.name,
    ms: Date.now() - started,
    text,
    tokens: u,
    neurons: neurons === null ? null : Math.round(neurons * 10) / 10,
    todayNeurons: today ? Math.round(today.neurons) : 0,
    dailyLimit: DAILY_NEURONS,
  };
}

// ---------- хранилище файлов (Durable Object на SQLite) ----------

export class FileStore extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      "CREATE TABLE IF NOT EXISTS files (id TEXT PRIMARY KEY, name TEXT, type TEXT, size INTEGER, chunks INTEGER, created_at TEXT)"
    );
    this.sql.exec("CREATE TABLE IF NOT EXISTS chunks (file_id TEXT, idx INTEGER, data BLOB, PRIMARY KEY (file_id, idx))");
  }

  async put(name, type, bytes) {
    const id = crypto.randomUUID();
    const data = new Uint8Array(bytes);
    const count = Math.max(1, Math.ceil(data.length / CHUNK));
    for (let i = 0; i < count; i++) {
      this.sql.exec("INSERT INTO chunks (file_id, idx, data) VALUES (?, ?, ?)", id, i, data.slice(i * CHUNK, (i + 1) * CHUNK).buffer);
    }
    this.sql.exec(
      "INSERT INTO files (id, name, type, size, chunks, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      id,
      name,
      type,
      data.length,
      count,
      new Date().toISOString()
    );
    return { id, size: data.length, chunks: count };
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

  async stats() {
    const row = this.sql.exec("SELECT COUNT(*) AS n, COALESCE(SUM(size), 0) AS bytes FROM files").toArray()[0];
    return { files: row.n, bytes: row.bytes, databaseSize: this.ctx.storage.sql.databaseSize };
  }
}

const fileStub = (env) => env.FILES.get(env.FILES.idFromName("main"));

// ---------- API ----------

async function handleApi(request, env, url) {
  const p = url.pathname;
  const missing = [];
  if (!env.DB) missing.push("DB (база D1)");
  if (!env.KV) missing.push("KV (хранилище KV)");
  if (!env.FILES && p.startsWith("/api/files")) missing.push("FILES (хранилище файлов)");
  if (!env.AI && p === "/api/ai") missing.push("AI (Workers AI)");
  if (missing.length && p !== "/api/ping")
    return json({ ok: false, error: "Не подключено: " + missing.join(", ") + ". Разверни стенд кнопкой ещё раз." }, 500);

  try {
    if (p === "/api/ping")
      return json({ ok: true, colo: request.cf && request.cf.colo, country: request.cf && request.cf.country });

    await ensureTables(env);

    if (p === "/api/settings" && request.method === "GET") {
      return json({ ok: true, timezone: await getSetting(env, "timezone") });
    }
    if (p === "/api/settings" && request.method === "POST") {
      const body = await request.json();
      try {
        new Intl.DateTimeFormat("ru-RU", { timeZone: body.timezone });
      } catch (e) {
        return json({ ok: false, error: "Неизвестный часовой пояс" }, 400);
      }
      await setSetting(env, "timezone", body.timezone);
      await logEvent(env, "settings", "часовой пояс: " + body.timezone);
      return json({ ok: true });
    }

    if (p === "/api/d1" && request.method === "POST") {
      const t = Date.now();
      await logEvent(env, "d1-test", "запись с iPad");
      const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM events").first();
      return json({ ok: true, ms: Date.now() - t, rows: row.n });
    }

    if (p === "/api/kv" && request.method === "POST") {
      const t = Date.now();
      const value = "проверка " + new Date().toISOString();
      await env.KV.put("kv-test", value);
      const back = await env.KV.get("kv-test");
      return json({ ok: back === value, ms: Date.now() - t });
    }

    if (p === "/api/ai" && request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      return json({ ok: true, ...(await runAI(env, body.model)) });
    }

    if (p === "/api/files" && request.method === "POST") {
      const len = Number(request.headers.get("content-length") || 0);
      if (len > MAX_FILE) return json({ ok: false, error: "Файл больше 50 МБ — в стенде так нельзя" }, 413);
      const bytes = await request.arrayBuffer();
      const name = decodeURIComponent(request.headers.get("x-file-name") || "файл");
      const type = request.headers.get("content-type") || "application/octet-stream";
      const t = Date.now();
      const saved = await fileStub(env).put(name, type, bytes);
      await logEvent(env, "file", `${name}, ${bytes.byteLength} байт`);
      return json({ ok: true, ...saved, ms: Date.now() - t });
    }

    if (p.startsWith("/api/files/") && request.method === "GET") {
      const id = p.slice("/api/files/".length);
      const got = await fileStub(env).get(id);
      if (!got) return json({ ok: false, error: "Файл не найден" }, 404);
      return new Response(got.bytes, { headers: { "content-type": got.meta.type, "cache-control": "no-store" } });
    }

    if (p === "/api/storage") {
      const files = env.FILES ? await fileStub(env).stats() : null;
      const d1 = await env.DB.prepare("SELECT COUNT(*) AS n FROM events").first();
      return json({ ok: true, files, d1Rows: d1.n });
    }

    if (p === "/api/vapid") return json({ ok: true, publicKey: (await getVapid(env)).publicKey });

    if (p === "/api/subscribe" && request.method === "POST") {
      const sub = await request.json();
      if (!sub || !sub.endpoint || !sub.keys) return json({ ok: false, error: "Пустая подписка" }, 400);
      await env.KV.put("push-subscription", JSON.stringify(sub));
      await env.KV.put("site-origin", url.origin);
      await logEvent(env, "push-subscribe", new URL(sub.endpoint).host);
      return json({ ok: true });
    }

    if (p === "/api/push-test" && request.method === "POST") {
      const tz = (await getSetting(env, "timezone")) || "UTC";
      const r = await pushToMe(env, `Проверочное уведомление, отправлено ${localTime(tz)}. Нажми — откроется раздел «Уведомления».`, "/#push");
      return json({ ok: r.ok, note: r.note, error: r.ok ? null : r.error || r.note });
    }

    if (p === "/api/status") {
      const cron = await env.DB.prepare("SELECT created_at, note FROM events WHERE kind = 'cron' ORDER BY id DESC LIMIT 6").all();
      const pushes = await env.DB.prepare("SELECT created_at, note FROM events WHERE kind = 'push' ORDER BY id DESC LIMIT 6").all();
      return json({
        ok: true,
        timezone: await getSetting(env, "timezone"),
        cron: cron.results,
        pushes: pushes.results,
        pushSubscribed: !!(await env.KV.get("push-subscription")),
      });
    }

    return json({ ok: false, error: "Неизвестный адрес" }, 404);
  } catch (e) {
    return json({ ok: false, error: errorText(e) }, 500);
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
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env, url);
    if (url.pathname === "/manifest.webmanifest")
      return new Response(JSON.stringify(MANIFEST), { headers: { "content-type": "application/manifest+json; charset=utf-8" } });
    if (url.pathname === "/sw.js")
      return new Response(SW, { headers: { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-store" } });
    if (url.pathname === "/icon.png") return iconResponse();
    if (url.pathname === "/" || url.pathname === "/index.html")
      return new Response(PAGE, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
    return new Response("Страница не найдена", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  },

  // Раз в час. Работает на серверах Cloudflare, iPad и Safari для этого не нужны.
  async scheduled(controller, env, ctx) {
    if (!env.DB || !env.KV) return;
    await ensureTables(env);
    const tz = (await getSetting(env, "timezone")) || "UTC";
    const when = localTime(tz);
    await logEvent(env, "cron", `таймер сработал, по твоему времени ${when} (${tz})`);
    ctx.waitUntil(
      pushToMe(env, `Фоновая задача сработала ${when}. Приложение для этого открывать не нужно.`, "/#cron").catch(() => null)
    );
  },
};
