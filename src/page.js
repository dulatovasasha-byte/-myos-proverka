// Страница стенда. Весь текст — на русском.
export const PAGE = `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>MY OS — проверка</title>
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/icon.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="MY OS">
<meta name="theme-color" content="#2E1A45">
<style>
  :root { --deep:#2E1A45; --lav:#CCAAE6; --lime:#E6F2A0; --light:#F3EBFA; --ink:#1d1029; --muted:#6b5a7b; --ok:#2f7d4f; --bad:#b3261e; }
  * { box-sizing: border-box; }
  body { margin:0; font: 17px/1.45 -apple-system, BlinkMacSystemFont, system-ui, sans-serif; background: var(--light); color: var(--ink); }
  header { background: var(--deep); color:#fff; padding: calc(env(safe-area-inset-top) + 20px) 24px 20px; }
  header h1 { margin:0; font-size:26px; }
  header p { margin:6px 0 0; color: var(--lav); }
  main { max-width: 860px; margin: 0 auto; padding: 20px 16px 60px; }
  .card { background:#fff; border-radius:16px; padding:18px 20px; margin-bottom:14px; scroll-margin-top: 16px; transition: box-shadow .4s; }
  .card.flash { box-shadow: 0 0 0 4px var(--lime); }
  .card.first { border: 2px solid var(--deep); }
  .row { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  h2 { font-size:19px; margin:0; }
  .hint { color: var(--muted); font-size:15px; margin:6px 0 0; }
  button, select, label.btn { font: inherit; min-height:44px; padding:0 18px; border-radius:12px; border:0; background: var(--deep); color:#fff; cursor:pointer; display:inline-flex; align-items:center; }
  button.secondary, label.btn.secondary { background: var(--lav); color: var(--deep); }
  select { background:#fff; color: var(--ink); border:1px solid var(--lav); max-width:100%; }
  .status { font-weight:600; }
  .ok { color: var(--ok); } .bad { color: var(--bad); } .wait { color: var(--muted); }
  pre { white-space: pre-wrap; background: var(--light); border-radius:10px; padding:10px 12px; font-size:15px; margin:10px 0 0; }
  .btns { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; align-items:center; }
  input[type=file] { display:none; }
</style>
</head>
<body>
<header>
  <h1>MY OS — проверочный стенд</h1>
  <p>Проверяем на этом iPad всё, на чём будет держаться MY OS.</p>
</header>
<main>

<div class="card first" id="tz">
  <div class="row"><h2>Сначала: твой часовой пояс</h2><span id="s-tz" class="status wait">не выбран</span></div>
  <p class="hint">По нему будут работать календарь, дедлайны, уведомления и пятничный обзор. iPad подсказывает вариант — подтверди его или выбери другой.</p>
  <div class="btns"><select id="tz-select"></select><button onclick="saveTz()">Сохранить</button></div>
</div>

<div class="card" id="mode">
  <div class="row"><h2>Режим запуска</h2><span id="s-mode" class="status wait">…</span></div>
  <p class="hint" id="mode-hint"></p>
</div>

<div class="card" id="ping">
  <div class="row"><h2>1. Связь с сервером</h2><span id="s-ping" class="status wait">не проверено</span></div>
  <div class="btns"><button onclick="tPing()">Проверить</button></div>
</div>

<div class="card" id="d1">
  <div class="row"><h2>2. База данных</h2><span id="s-d1" class="status wait">не проверено</span></div>
  <div class="btns"><button onclick="tD1()">Записать и прочитать</button><button class="secondary" onclick="tKV()">Проверить быстрое хранилище</button></div>
  <p class="hint" id="kv-line"></p>
</div>

<div class="card" id="files">
  <div class="row"><h2>3. Хранение файлов</h2><span id="s-files" class="status wait">не проверено</span></div>
  <p class="hint">Выбери 2–3 фото или PDF. Каждый файл загрузится, скачается обратно и сверится байт в байт.</p>
  <div class="btns"><label class="btn" for="file-input">Выбрать файлы</label><input id="file-input" type="file" multiple accept="image/*,application/pdf" onchange="tFiles(this.files)"></div>
  <pre id="files-out" hidden></pre>
</div>

<div class="card" id="ai">
  <div class="row"><h2>4. Бесплатный ИИ на русском</h2><span id="s-ai" class="status wait">не проверено</span></div>
  <p class="hint">Один и тот же вопрос режиму «Стратег». Оцени, где русский язык лучше, и посмотри расход дневного лимита.</p>
  <div class="btns">
    <button onclick="tAI('fast')">Быстрая</button>
    <button class="secondary" onclick="tAI('balanced')">Запасная</button>
    <button class="secondary" onclick="tAI('strong')">Сильная</button>
  </div>
  <pre id="ai-out" hidden></pre>
</div>

<div class="card" id="pk">
  <div class="row"><h2>5. Вход по Face ID</h2><span id="s-pk" class="status wait">не проверено</span></div>
  <p class="hint">Создаст тестовый ключ «MY OS проверка» в приложении «Пароли». Потом его можно удалить.</p>
  <div class="btns"><button onclick="tPasskey()">Проверить вход</button></div>
</div>

<div class="card" id="push">
  <div class="row"><h2>6. Уведомления</h2><span id="s-push" class="status wait">не проверено</span></div>
  <p class="hint">Работают только в приложении с экрана «Домой». Включи уведомления, отправь тестовое и сразу закрой приложение (смахни вверх). Нажми на пришедшее уведомление — должен открыться этот раздел.</p>
  <div class="btns"><button onclick="tPushSubscribe()">Включить уведомления</button><button class="secondary" onclick="tPushSend()">Отправить тестовое</button></div>
</div>

<div class="card" id="cron">
  <div class="row"><h2>7. Фоновая работа и перезагрузка</h2><span id="s-cron" class="status wait">не проверено</span></div>
  <p class="hint">Раз в час сервер сам делает запись и присылает уведомление — даже когда приложение закрыто. Для проверки перезагрузи iPad, не открывай MY OS и дождись следующего часа.</p>
  <div class="btns"><button onclick="tCron()">Показать журнал</button></div>
  <pre id="cron-out" hidden></pre>
</div>

<div class="card" id="share">
  <div class="row"><h2>8. Публикация в Telegram через «Поделиться»</h2><span id="s-share" class="status wait">не проверено</span></div>
  <p class="hint">В меню выбери Telegram → «Избранное» (не канал). Проверь каждый способ и отметь, что дошло.</p>
  <div class="btns">
    <button onclick="tShare('all')">Текст + 3 картинки</button>
    <button class="secondary" onclick="tShare('images')">Только 3 картинки</button>
    <button class="secondary" onclick="tShare('text')">Только текст</button>
    <button class="secondary" onclick="tShare('copy')">Текст в буфер, затем картинки</button>
  </div>
  <div class="btns">
    <span class="hint">Что дошло?</span>
    <button class="secondary" onclick="mark('всё: текст и 3 картинки')">Всё</button>
    <button class="secondary" onclick="mark('картинки без текста')">Картинки без текста</button>
    <button class="secondary" onclick="mark('текст без картинок')">Текст без картинок</button>
    <button class="secondary" onclick="mark('не все картинки')">Не все картинки</button>
  </div>
</div>

<div class="card" id="locale">
  <div class="row"><h2>9. Даты, время и деньги по-русски</h2></div>
  <pre id="locale-out"></pre>
</div>

<div class="card" id="report-card">
  <div class="row"><h2>Отчёт</h2></div>
  <p class="hint">Когда пройдёшь всё, нажми кнопку и вставь отчёт в чат с Claude.</p>
  <div class="btns"><button onclick="copyReport()">Скопировать отчёт</button></div>
  <pre id="report"></pre>
</div>

</main>
<script>
var R = {}; var marks = []; var TZ = null;
var standalone = window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

function setS(id, ok, text) {
  var el = document.getElementById('s-' + id);
  if (el) { el.textContent = text; el.className = 'status ' + (ok === null ? 'wait' : ok ? 'ok' : 'bad'); }
  R[id] = (ok === null ? '… ' : ok ? '✓ ' : '✗ ') + text; renderReport();
}
async function api(path, opts) {
  opts = opts || {};
  var headers = Object.assign({ 'content-type': 'application/json' }, opts.headers || {});
  var r = await fetch(path, Object.assign({ cache: 'no-store' }, opts, { headers: headers }));
  var data = await r.json().catch(function () { return {}; });
  if (!r.ok || data.ok === false) throw new Error(data.error || ('Ошибка сервера ' + r.status));
  return data;
}
function fmt(d) { return d.toLocaleString('ru-RU', TZ ? { timeZone: TZ } : {}); }
function osInfo() {
  var m = navigator.userAgent.match(/Version\\/(\\d+(?:\\.\\d+)?)/);
  var ipad = /iPad/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  return (ipad ? 'iPad' : 'устройство') + ', Safari ' + (m ? m[1] : '?');
}
function renderReport() {
  var order = ['tz','mode','nav','ping','d1','kv','files','ai','pk','push','cron','share','locale'];
  var names = { tz:'Часовой пояс', mode:'Режим', nav:'Переход из уведомления', ping:'Связь', d1:'База', kv:'Быстрое хранилище', files:'Файлы', ai:'ИИ', pk:'Вход по Face ID', push:'Уведомления', cron:'Фон', share:'Поделиться', locale:'Форматы' };
  var lines = order.filter(function (k) { return R[k]; }).map(function (k) { return names[k] + ': ' + R[k]; });
  document.getElementById('report').textContent = 'Отчёт стенда MY OS v2, ' + new Date().toLocaleString('ru-RU') + '\\n' + osInfo() + '\\n\\n' + lines.join('\\n');
}

function tzLabel(z) {
  try {
    var parts = new Intl.DateTimeFormat('ru-RU', { timeZone: z, timeZoneName: 'shortOffset' }).formatToParts(new Date());
    var off = parts.filter(function (p) { return p.type === 'timeZoneName'; })[0];
    return z + (off ? ' (' + off.value + ')' : '');
  } catch (e) { return z; }
}
async function initTz() {
  var device = Intl.DateTimeFormat().resolvedOptions().timeZone;
  var list = (Intl.supportedValuesOf ? Intl.supportedValuesOf('timeZone') : ['Europe/Moscow','Europe/Samara','Asia/Yekaterinburg','Europe/Kaliningrad','Asia/Novosibirsk','Europe/Berlin','Asia/Dubai','Asia/Tbilisi','Asia/Almaty','Europe/Istanbul','UTC']);
  if (list.indexOf(device) < 0) list.unshift(device);
  var sel = document.getElementById('tz-select');
  list.forEach(function (z) { var o = document.createElement('option'); o.value = z; o.textContent = tzLabel(z); sel.appendChild(o); });
  try {
    var s = await api('/api/settings');
    if (s.timezone) { TZ = s.timezone; sel.value = s.timezone; setS('tz', true, 'выбран ' + tzLabel(s.timezone)); }
    else { sel.value = device; setS('tz', null, 'не выбран, iPad предлагает ' + tzLabel(device)); }
  } catch (e) { sel.value = device; setS('tz', false, e.message); }
  locale();
}
async function saveTz() {
  var z = document.getElementById('tz-select').value;
  try { await api('/api/settings', { method: 'POST', body: JSON.stringify({ timezone: z }) }); TZ = z; setS('tz', true, 'выбран ' + tzLabel(z)); locale(); }
  catch (e) { setS('tz', false, e.message); }
}

async function tPing() {
  setS('ping', null, 'проверяю…');
  try {
    var times = [], info;
    for (var i = 0; i < 5; i++) { var t = performance.now(); info = await api('/api/ping'); times.push(performance.now() - t); }
    var avg = Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length);
    setS('ping', true, avg + ' мс в среднем, узел ' + (info.colo || '?') + ', страна выхода ' + (info.country || '?'));
  } catch (e) { setS('ping', false, e.message); }
}
async function tD1() {
  setS('d1', null, 'проверяю…');
  try { var r = await api('/api/d1', { method: 'POST' }); setS('d1', true, 'работает, ' + r.ms + ' мс, записей: ' + r.rows); }
  catch (e) { setS('d1', false, e.message); }
}
async function tKV() {
  setS('kv', null, 'проверяю…');
  try { var r = await api('/api/kv', { method: 'POST' }); setS('kv', r.ok, r.ok ? 'работает, ' + r.ms + ' мс' : 'прочитано не то, что записано'); document.getElementById('kv-line').textContent = 'Быстрое хранилище: ' + R.kv; }
  catch (e) { setS('kv', false, e.message); }
}

function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
function mb(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' КБ' : (n / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' МБ'; }
async function tFiles(list) {
  if (!list || !list.length) return;
  var out = document.getElementById('files-out'); out.hidden = false; out.textContent = '';
  setS('files', null, 'загружаю ' + list.length + '…');
  var good = 0, total = 0;
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    try {
      var buf = await f.arrayBuffer();
      var h1 = hex(await crypto.subtle.digest('SHA-256', buf));
      var t = performance.now();
      var r = await fetch('/api/files', { method: 'POST', body: buf, headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name) } });
      var saved = await r.json();
      if (!r.ok || !saved.ok) throw new Error(saved.error || ('ошибка ' + r.status));
      var back = await (await fetch('/api/files/' + saved.id, { cache: 'no-store' })).arrayBuffer();
      var h2 = hex(await crypto.subtle.digest('SHA-256', back));
      var same = h1 === h2;
      if (same) good++; total += f.size;
      out.textContent += (same ? '✓ ' : '✗ ') + f.name + ' — ' + mb(f.size) + ', частей: ' + saved.chunks + ', ' + Math.round(performance.now() - t) + ' мс' + (same ? ', совпадает байт в байт' : ', НЕ совпадает') + '\\n';
    } catch (e) { out.textContent += '✗ ' + f.name + ' — ' + e.message + '\\n'; }
  }
  try {
    var s = await api('/api/storage');
    if (s.files) out.textContent += '\\nВсего в хранилище: ' + s.files.files + ' файл(ов), ' + mb(s.files.bytes) + ' из 5 ГБ бесплатных';
  } catch (e) {}
  setS('files', good === list.length, good + ' из ' + list.length + ' файлов сохранены и совпали, ' + mb(total));
}

async function tAI(model) {
  setS('ai', null, 'модель думает…');
  var out = document.getElementById('ai-out'); out.hidden = true;
  try {
    var r = await api('/api/ai', { method: 'POST', body: JSON.stringify({ model: model }) });
    out.hidden = false;
    out.textContent = r.text + '\\n\\n— ' + r.model + ': ' + (r.ms / 1000).toFixed(1) + ' с' +
      (r.neurons !== null ? ', израсходовано ' + r.neurons + ' нейронов' : '') +
      '. За сегодня: ' + r.todayNeurons + ' из ' + r.dailyLimit + '.';
    R['ai_' + model] = r.model + ' — ' + (r.ms / 1000).toFixed(1) + ' с' + (r.neurons !== null ? ', ' + r.neurons + ' нейронов' : '');
    setS('ai', true, ['fast','balanced','strong'].filter(function (k) { return R['ai_' + k]; }).map(function (k) { return R['ai_' + k]; }).join('; '));
  } catch (e) { setS('ai', false, e.message); }
}

async function tPasskey() {
  setS('pk', null, 'ждём Face ID…');
  try {
    if (!window.PublicKeyCredential) throw new Error('Браузер не поддерживает ключи доступа');
    var rnd = function (n) { return crypto.getRandomValues(new Uint8Array(n)); };
    var cred = await navigator.credentials.create({ publicKey: {
      challenge: rnd(32), rp: { name: 'MY OS проверка' },
      user: { id: rnd(16), name: 'proverka', displayName: 'MY OS проверка' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'required' }, timeout: 60000 } });
    await navigator.credentials.get({ publicKey: { challenge: rnd(32), allowCredentials: [{ type: 'public-key', id: cred.rawId }], userVerification: 'required', timeout: 60000 } });
    setS('pk', true, 'ключ создан, вход подтверждён');
  } catch (e) { setS('pk', false, e.name === 'NotAllowedError' ? 'отменено или не разрешено' : e.message); }
}

function urlB64ToBytes(s) { var p = '='.repeat((4 - s.length % 4) % 4); var b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, function (c) { return c.charCodeAt(0); }); }
async function subscribe(silent) {
  var reg = await navigator.serviceWorker.ready;
  var key = (await api('/api/vapid')).publicKey;
  var sub = await reg.pushManager.getSubscription();
  var renewed = false;
  if (!sub) { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64ToBytes(key) }); renewed = true; }
  await api('/api/subscribe', { method: 'POST', body: JSON.stringify(sub) });
  return renewed;
}
async function tPushSubscribe() {
  setS('push', null, 'включаю…');
  try {
    if (!standalone) throw new Error('Сначала добавь стенд на экран «Домой» и открой его оттуда');
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Уведомления на этом устройстве не поддерживаются');
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Уведомления не разрешены');
    await subscribe();
    setS('push', null, 'включены — теперь отправь тестовое');
  } catch (e) { setS('push', false, e.message); }
}
async function tPushSend() {
  try { var r = await api('/api/push-test', { method: 'POST' }); setS('push', true, 'отправлено (' + r.note + '). Закрой приложение и дождись уведомления'); }
  catch (e) { setS('push', false, e.message); }
}
async function autoResubscribe() {
  if (!standalone || !('Notification' in window) || Notification.permission !== 'granted') return;
  try { var renewed = await subscribe(); if (renewed) R.push_renew = 'подписка восстановлена автоматически'; } catch (e) {}
}

async function tCron() {
  try {
    var r = await api('/api/status');
    var out = document.getElementById('cron-out'); out.hidden = false;
    var lines = ['Срабатывания таймера:'];
    if (!r.cron.length) lines.push('  пока нет — таймер запускается в начале каждого часа');
    r.cron.forEach(function (c) { lines.push('  ' + fmt(new Date(c.created_at)) + ' — ' + c.note); });
    lines.push('', 'Отправка уведомлений:');
    if (!r.pushes.length) lines.push('  пока не было');
    r.pushes.forEach(function (c) { lines.push('  ' + fmt(new Date(c.created_at)) + ' — ' + c.note); });
    out.textContent = lines.join('\\n');
    setS('cron', r.cron.length > 0 ? true : null, r.cron.length ? 'срабатываний: ' + r.cron.length + ', последнее ' + fmt(new Date(r.cron[0].created_at)) : 'ждём первого срабатывания');
  } catch (e) { setS('cron', false, e.message); }
}

function card(n, w, h, text) {
  var c = document.createElement('canvas'); c.width = w; c.height = h;
  var g = c.getContext('2d');
  var bg = ['#2E1A45', '#CCAAE6', '#E6F2A0'][n % 3]; var fg = n % 3 === 0 ? '#E6F2A0' : '#2E1A45';
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = '700 110px -apple-system, system-ui, sans-serif'; g.fillText(String(n + 1), 80, 220);
  g.font = '600 64px -apple-system, system-ui, sans-serif'; g.fillText(text, 80, h - 120);
  return new Promise(function (res) { c.toBlob(function (b) { res(new File([b], 'myos-' + (n + 1) + '.png', { type: 'image/png' })); }, 'image/png'); });
}
var SHARE_TEXT = 'Тестовая публикация MY OS. Если ты видишь этот текст рядом с тремя картинками — передача работает.';
async function tShare(mode) {
  try {
    var data = {};
    if (mode === 'all' || mode === 'text') data.text = SHARE_TEXT;
    if (mode === 'copy') { await navigator.clipboard.writeText(SHARE_TEXT); }
    if (mode !== 'text') {
      var files = [await card(0, 1080, 1080, 'Картинка 1'), await card(1, 1080, 1350, 'Картинка 2'), await card(2, 1080, 1080, 'Картинка 3')];
      if (!(navigator.canShare && navigator.canShare({ files: files }))) throw new Error('Передача нескольких картинок не поддерживается');
      data.files = files;
    }
    await navigator.share(data);
    var names = { all: 'текст + 3 картинки', images: 'только картинки', text: 'только текст', copy: 'текст в буфере, затем картинки' };
    marks.push('[' + names[mode] + ']');
    setS('share', null, 'отправлено: ' + names[mode] + ' — отметь, что дошло' + (mode === 'copy' ? ' (текст вставь подписью: долгое нажатие → «Вставить»)' : ''));
  } catch (e) { if (e.name === 'AbortError') setS('share', null, 'меню закрыто без отправки'); else setS('share', false, e.message); }
}
function mark(what) { marks.push(what); setS('share', true, marks.join(' → ')); }

function locale() {
  var d = new Date(); var o = TZ ? { timeZone: TZ } : {};
  var lines = [
    'Часовой пояс MY OS: ' + (TZ ? tzLabel(TZ) : 'ещё не выбран'),
    'Дата: ' + d.toLocaleDateString('ru-RU', o),
    'Время: ' + d.toLocaleTimeString('ru-RU', Object.assign({ hour: '2-digit', minute: '2-digit' }, o)),
    'Полностью: ' + d.toLocaleDateString('ru-RU', Object.assign({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, o)),
    'Деньги: ' + (1234567.89).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) + ' · ' + (1234.5).toLocaleString('ru-RU', { style: 'currency', currency: 'EUR' }),
    'Проценты: ' + (0.423).toLocaleString('ru-RU', { style: 'percent', maximumFractionDigits: 1 })
  ];
  document.getElementById('locale-out').textContent = lines.join('\\n');
  R.locale = '✓ ' + lines[1] + ', ' + lines[2] + ', ' + lines[3];
  renderReport();
}

async function copyReport() {
  renderReport();
  var t = document.getElementById('report').textContent;
  try { await navigator.clipboard.writeText(t); document.getElementById('report').textContent = 'Отчёт скопирован — вставь его в чат.\\n\\n' + t; }
  catch (e) { document.getElementById('report').textContent = 'Скопировать автоматически не вышло — выдели текст вручную.\\n\\n' + t; }
}

function onHash() {
  var id = location.hash.replace('#', '');
  if (id !== 'push' && id !== 'cron') return;
  var el = document.getElementById(id); if (!el) return;
  el.scrollIntoView({ behavior: 'smooth' }); el.classList.add('flash');
  setTimeout(function () { el.classList.remove('flash'); }, 2500);
  R.nav = '✓ уведомление открыло раздел «' + (id === 'push' ? 'Уведомления' : 'Фоновая работа') + '»';
  renderReport();
}

(function init() {
  setS('mode', standalone ? true : null, standalone ? 'открыто с экрана «Домой»' : 'открыто в Safari');
  document.getElementById('mode-hint').textContent = standalone
    ? 'Хорошо: в этом режиме работают уведомления.'
    : 'Для проверки уведомлений нажми «Поделиться» → «На экран «Домой»» и открой стенд оттуда.';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(autoResubscribe);
  window.addEventListener('hashchange', onHash);
  initTz(); onHash();
})();
</script>
</body>
</html>`;
