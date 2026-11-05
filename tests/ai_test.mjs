// Модульная проверка защиты лимита ИИ: база — настоящий SQLite, ИИ — заглушка.
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.mjs';
const sql = new DatabaseSync(':memory:');
const stmt = (q, args = []) => ({
  bind: (...a) => stmt(q, a),
  run: async () => { const r = sql.prepare(q).run(...args); return { meta: { rows_read: 0, rows_written: r.changes } }; },
  all: async () => { const p = sql.prepare(q); const rows = /^\s*(SELECT|PRAGMA)/i.test(q) ? p.all(...args) : (p.run(...args), []); return { results: rows, meta: { rows_read: rows.length, rows_written: 0 } }; },
});
const DB = { prepare: (q) => stmt(q), batch: async (ss) => Promise.all(ss.map((s) => s.run())) };
const kv = new Map();
const KV = { get: async (k) => kv.get(k) ?? null, put: async (k, v) => kv.set(k, v), delete: async (k) => kv.delete(k) };
let calls = [], aiMode = 'ok';
const AI = { run: async (model, input) => { calls.push(model); if (aiMode === 'limit') throw new Error('4006: you have used up your daily free allocation of 10,000 neurons'); return { response: 'Ответ', usage: { prompt_tokens: 3000, completion_tokens: 900 } }; } };
const FILES = { idFromName: () => 1, get: () => ({ stats: async () => ({ files: 0, bytes: 0, databaseSize: 0 }) }) };
const env = { DB, KV, AI, FILES };
const ctx = { waitUntil: (p) => p };
const call = async (model) => { const r = await worker.fetch(new Request('http://x/api/ai', { method: 'POST', body: JSON.stringify({ model }) }), env, ctx); return [r.status, await r.json()]; };
let pass = 0, total = 0;
const check = (name, cond, d = '') => { total++; if (cond) pass++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (d ? ' — ' + d : '')); };
const day = new Date().toISOString().slice(0, 10);

let [s, r] = await call('strong');
check('сильная модель при запасе лимита', s === 200 && calls.at(-1).includes('gpt-oss'), `~${r.neurons} нейронов`);
check('расчёт нейронов gpt-oss-120b: 3000/900 токенов ≈ 157', Math.abs(r.neurons - 156.8) < 0.5, String(r.neurons));
sql.prepare('UPDATE ai_usage SET neurons = 8600 WHERE day = ?').run(day);
[s, r] = await call('strong');
check('при 86% — режим экономии, вместо сильной быстрая', s === 200 && r.economy && calls.at(-1).includes('qwen'), r.model);
sql.prepare('UPDATE ai_usage SET neurons = 10000 WHERE day = ?').run(day);
const before = calls.length;
[s, r] = await call('fast');
check('при 100% запрос не отправляется', s === 429 && calls.length === before, r.error);
sql.prepare('UPDATE ai_usage SET neurons = 100 WHERE day = ?').run(day);
aiMode = 'limit';
[s, r] = await call('fast');
check('ответ Cloudflare «лимит исчерпан» — понятное сообщение', s === 429 && /Платный тариф не включён/.test(r.error), r.error.slice(0, 90));
console.log(`Итог: ${pass} из ${total}`);
process.exit(pass === total ? 0 : 1);
