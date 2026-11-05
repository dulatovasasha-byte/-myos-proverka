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
  :root { --deep:#2E1A45; --lav:#CCAAE6; --lime:#E6F2A0; --light:#F3EBFA; --ink:#1d1029; --muted:#6b5a7b; --ok:#2f7d4f; --bad:#b3261e; --warn:#8a5a00; }
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
  ol.steps { margin:8px 0 0; padding-left:22px; color: var(--muted); font-size:15px; }
  button, select, label.btn { font: inherit; min-height:44px; padding:0 18px; border-radius:12px; border:0; background: var(--deep); color:#fff; cursor:pointer; display:inline-flex; align-items:center; }
  button.secondary, label.btn.secondary { background: var(--lav); color: var(--deep); }
  button.danger { background: var(--bad); }
  button:disabled { opacity:.45; }
  select { background:#fff; color: var(--ink); border:1px solid var(--lav); max-width:100%; }
  .status { font-weight:600; }
  .ok { color: var(--ok); } .bad { color: var(--bad); } .wait { color: var(--muted); } .warn { color: var(--warn); }
  pre { white-space: pre-wrap; background: var(--light); border-radius:10px; padding:10px 12px; font-size:15px; margin:10px 0 0; }
  .btns { display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; align-items:center; }
  input[type=file] { display:none; }
  .meter { padding:10px 0; border-top:1px solid var(--light); }
  .meter:first-child { border-top:0; }
  .bar { height:8px; background: var(--light); border-radius:4px; overflow:hidden; margin:6px 0 4px; }
  .bar i { display:block; height:100%; background: var(--ok); }
  .bar i.warn { background:#d99a00; } .bar i.economy { background:#d9661a; } .bar i.stop { background: var(--bad); }
  .src { font-size:13px; color: var(--muted); }
  .tag { display:inline-block; font-size:12px; padding:1px 8px; border-radius:8px; background: var(--light); color: var(--deep); margin-left:6px; }
  details summary { cursor:pointer; font-weight:600; min-height:44px; display:flex; align-items:center; }
</style>
</head>
<body>
<header>
  <h1>MY OS — проверочный стенд</h1>
  <p>Иди по пунктам сверху вниз. В конце скопируй отчёт и вставь его в чат с Claude.</p>
</header>
<main>

<div class="card first" id="tz">
  <div class="row"><h2>Шаг 1. Часовой пояс</h2><span id="s-tz" class="status wait">не выбран</span></div>
  <p class="hint">По нему будут работать календарь, дедлайны, уведомления и пятничный обзор. iPad подсказывает вариант — проверь его и нажми «Сохранить».</p>
  <div class="btns"><select id="tz-select" aria-label="Часовой пояс"></select><button onclick="saveTz()">Сохранить</button></div>
  <pre id="locale-out"></pre>
</div>

<div class="card" id="check">
  <div class="row"><h2>Шаг 2. Связь через VPN и база</h2><span id="s-check" class="status wait">проверяю…</span></div>
  <p class="hint">Проверяется само при открытии. Попробуй и с VPN, и без него — нажми «Проверить ещё раз» и сравни.</p>
  <div class="btns"><button onclick="tCheck()">Проверить ещё раз</button></div>
  <p class="hint" id="mode-hint"></p>
</div>

<div class="card" id="files">
  <div class="row"><h2>Шаг 3. Фото и PDF</h2><span id="s-files" class="status wait">не проверено</span></div>
  <p class="hint">Выбери 2–3 фото и хотя бы один PDF (из «Файлов»). Каждый файл загрузится, скачается обратно и сверится байт в байт.</p>
  <div class="btns"><label class="btn" for="file-input">Выбрать фото и PDF</label><input id="file-input" type="file" multiple accept="image/*,application/pdf" onchange="tFiles(this.files)"></div>
  <pre id="files-out" hidden></pre>
</div>

<div class="card" id="push">
  <div class="row"><h2>Шаг 4. Уведомления при закрытом приложении</h2><span id="s-push" class="status wait">не проверено</span></div>
  <ol class="steps">
    <li>Стенд должен быть открыт с экрана «Домой» (см. шаг 2).</li>
    <li>Нажми «Включить уведомления» и разреши.</li>
    <li>Нажми «Отправить тестовое» и сразу закрой приложение: смахни его вверх из списка приложений.</li>
    <li>Когда придёт уведомление, нажми на него — должен открыться этот раздел с подсветкой.</li>
  </ol>
  <div class="btns"><button onclick="tPushSubscribe()">Включить уведомления</button><button class="secondary" onclick="tPushSend()">Отправить тестовое</button></div>
</div>

<div class="card" id="cron">
  <div class="row"><h2>Шаг 5. Фоновая работа и перезагрузка iPad</h2><span id="s-cron" class="status wait">не проверено</span></div>
  <ol class="steps">
    <li>В начале каждого часа сервер сам делает запись и присылает уведомление — приложение для этого не нужно.</li>
    <li>Перезагрузи iPad. Не открывай MY OS.</li>
    <li>Дождись начала следующего часа: уведомление должно прийти. Нажми на него и затем «Показать журнал».</li>
  </ol>
  <div class="btns"><button onclick="tCron()">Показать журнал</button></div>
  <pre id="cron-out" hidden></pre>
</div>

<div class="card" id="share">
  <div class="row"><h2>Шаг 6. Текст и несколько картинок в Telegram</h2><span id="s-share" class="status wait">не проверено</span></div>
  <p class="hint">Отправляй себе в «Избранное», не в канал. Стенд ничего не публикует сам — только открывает меню «Поделиться». Проверь первый способ; если текст потерялся, проверь последний.</p>
  <div class="btns">
    <button onclick="tShare('all')">Текст + 3 картинки</button>
    <button class="secondary" onclick="tShare('copy')">Текст в буфер, затем картинки</button>
  </div>
  <div class="btns">
    <span class="hint">Что дошло?</span>
    <button class="secondary" onclick="mark('всё: текст и 3 картинки')">Всё</button>
    <button class="secondary" onclick="mark('картинки без текста')">Картинки без текста</button>
    <button class="secondary" onclick="mark('не все картинки')">Не все картинки</button>
  </div>
</div>

<div class="card" id="backup">
  <div class="row"><h2>Шаг 7. Резервная копия и восстановление</h2><span id="s-backup" class="status wait">не проверено</span></div>
  <ol class="steps">
    <li>«Создать тестовые данные»: цель, задача, проект, пост с тремя версиями, связи между ними и вложения (PDF, картинка и твои файлы из шага 3).</li>
    <li>«Сделать копию» → «Сохранить копию» → «Сохранить в Файлы».</li>
    <li>«Стереть тестовые данные» — как будто всё потеряно (часовой пояс тоже сотрётся).</li>
    <li>«Восстановить из файла» → выбери сохранённую копию. Стенд сам сверит каждую строку, связь, версию и файл.</li>
  </ol>
  <div class="btns">
    <button onclick="tSeed()">Создать тестовые данные</button>
    <button onclick="tBackup()">Сделать копию</button>
    <button class="secondary" id="save-backup" onclick="saveBackup()" disabled>Сохранить копию</button>
  </div>
  <div class="btns">
    <button class="danger" id="wipe-btn" onclick="tWipe()">Стереть тестовые данные</button>
    <label class="btn" for="restore-input">Восстановить из файла</label><input id="restore-input" type="file" accept=".zip,application/zip" onchange="tRestore(this.files)">
  </div>
  <pre id="backup-out" hidden></pre>
</div>

<div class="card" id="limits">
  <div class="row"><h2>Расход бесплатных лимитов</h2><button class="secondary" onclick="loadCounters()">Обновить</button></div>
  <p class="hint">У каждой цифры подписан источник: «Cloudflare» — число из ответа самого Cloudflare, «подсчёт стенда» — стенд считает свои обращения сам, «оценка MY OS» — расчёт по прайсу. Точные цифры по всему аккаунту — в панели Cloudflare.</p>
  <div id="counters"></div>
</div>

<div class="card">
  <details>
    <summary>Дополнительно: ИИ на русском и вход по Face ID</summary>
    <div id="ai">
      <div class="row"><h2>ИИ</h2><span id="s-ai" class="status wait">не проверено</span></div>
      <p class="hint">Один вопрос режиму «Стратег». Сравни качество русского языка и расход лимита.</p>
      <div class="btns">
        <button onclick="tAI('fast')">Быстрая</button>
        <button class="secondary" onclick="tAI('balanced')">Запасная</button>
        <button class="secondary" onclick="tAI('strong')">Сильная</button>
      </div>
      <pre id="ai-out" hidden></pre>
    </div>
    <div id="pk" style="margin-top:16px">
      <div class="row"><h2>Face ID</h2><span id="s-pk" class="status wait">не проверено</span></div>
      <p class="hint">Создаст тестовый ключ «MY OS проверка» в приложении «Пароли». Потом его можно удалить.</p>
      <div class="btns"><button onclick="tPasskey()">Проверить вход</button></div>
    </div>
  </details>
</div>

<div class="card" id="report-card">
  <div class="row"><h2>Отчёт</h2></div>
  <p class="hint">Нажми кнопку и вставь отчёт в чат с Claude.</p>
  <div class="btns"><button onclick="copyReport()">Скопировать отчёт</button></div>
  <pre id="report"></pre>
</div>

</main>
<script>
var R = {}; var marks = []; var TZ = null; var lastBackup = null;
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
  return (ipad ? 'iPad' : 'устройство') + ', Safari ' + (m ? m[1] : '?') + ', ' + (standalone ? 'с экрана «Домой»' : 'во вкладке Safari');
}
function renderReport() {
  var order = ['tz','check','files','push','nav','cron','share','backup','limits','ai','pk'];
  var names = { tz:'Часовой пояс', check:'Связь и база', files:'Фото и PDF', push:'Уведомления', nav:'Переход из уведомления', cron:'Фон и перезагрузка', share:'Telegram', backup:'Копия и восстановление', limits:'Лимиты', ai:'ИИ', pk:'Face ID' };
  var lines = order.filter(function (k) { return R[k]; }).map(function (k) { return names[k] + ': ' + R[k]; });
  document.getElementById('report').textContent = 'Отчёт стенда MY OS, версия 3, ' + fmt(new Date()) + (TZ ? ' (' + TZ + ')' : '') + '\\n' + osInfo() + '\\n\\n' + lines.join('\\n');
}
function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
async function sha(buf) { return hex(await crypto.subtle.digest('SHA-256', buf)); }
function mb(n) { return n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' КБ' : (n / 1048576).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' МБ'; }
function num(n) { return Number(n).toLocaleString('ru-RU'); }

// ---- шаг 1: часовой пояс ----
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
  var sel = document.getElementById('tz-select'); sel.innerHTML = '';
  list.forEach(function (z) { var o = document.createElement('option'); o.value = z; o.textContent = tzLabel(z); sel.appendChild(o); });
  try {
    var s = await api('/api/settings');
    if (s.timezone) { TZ = s.timezone; sel.value = s.timezone; setS('tz', true, 'выбран ' + tzLabel(s.timezone)); }
    else { TZ = null; sel.value = device; setS('tz', null, 'не выбран, iPad предлагает ' + tzLabel(device)); }
  } catch (e) { sel.value = device; setS('tz', false, e.message); }
  locale();
}
async function saveTz() {
  var z = document.getElementById('tz-select').value;
  try { await api('/api/settings', { method: 'POST', body: JSON.stringify({ timezone: z }) }); TZ = z; setS('tz', true, 'выбран ' + tzLabel(z)); locale(); }
  catch (e) { setS('tz', false, e.message); }
}
function locale() {
  var d = new Date(); var o = TZ ? { timeZone: TZ } : {};
  var lines = [
    'Сейчас по выбранному поясу: ' + d.toLocaleDateString('ru-RU', o) + ', ' + d.toLocaleTimeString('ru-RU', Object.assign({ hour: '2-digit', minute: '2-digit' }, o)),
    'Полностью: ' + d.toLocaleDateString('ru-RU', Object.assign({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, o)),
    'Деньги: ' + (1234567.89).toLocaleString('ru-RU', { style: 'currency', currency: 'RUB' }) + ' · ' + (1234.5).toLocaleString('ru-RU', { style: 'currency', currency: 'EUR' })
  ];
  document.getElementById('locale-out').textContent = lines.join('\\n');
}

// ---- шаг 2: связь и база ----
async function tCheck() {
  setS('check', null, 'проверяю…');
  try {
    var times = [], info;
    for (var i = 0; i < 3; i++) { var t = performance.now(); info = await api('/api/ping'); times.push(performance.now() - t); }
    var avg = Math.round(times.reduce(function (a, b) { return a + b; }, 0) / times.length);
    var c = await api('/api/check', { method: 'POST' });
    setS('check', true, 'связь ' + avg + ' мс, узел ' + (info.colo || '?') + ', страна выхода ' + (info.country || '?') + '; база ' + c.d1ms + ' мс; быстрое хранилище: ' + c.kv);
  } catch (e) { setS('check', false, e.message); }
}

// ---- шаг 3: файлы ----
async function tFiles(list) {
  if (!list || !list.length) return;
  var out = document.getElementById('files-out'); out.hidden = false; out.textContent = '';
  setS('files', null, 'загружаю ' + list.length + '…');
  var good = 0, total = 0, kinds = {};
  for (var i = 0; i < list.length; i++) {
    var f = list[i];
    try {
      var buf = await f.arrayBuffer();
      var h1 = await sha(buf);
      var t = performance.now();
      var r = await fetch('/api/files', { method: 'POST', body: buf, headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-name': encodeURIComponent(f.name) } });
      var saved = await r.json();
      if (!r.ok || !saved.ok) throw new Error(saved.error || ('ошибка ' + r.status));
      var back = await (await fetch('/api/files/' + saved.id, { cache: 'no-store' })).arrayBuffer();
      var same = h1 === await sha(back) && h1 === saved.sha256;
      if (same) { good++; kinds[/pdf/.test(f.type) ? 'PDF' : 'фото'] = 1; }
      total += f.size;
      out.textContent += (same ? '✓ ' : '✗ ') + f.name + ' — ' + mb(f.size) + ', частей: ' + saved.chunks + ', ' + Math.round(performance.now() - t) + ' мс' + (same ? ', совпадает байт в байт' : ', НЕ совпадает') + '\\n';
    } catch (e) { out.textContent += '✗ ' + f.name + ' — ' + e.message + '\\n'; }
  }
  setS('files', good === list.length, good + ' из ' + list.length + ' совпали (' + Object.keys(kinds).join(' и ') + '), ' + mb(total));
  loadCounters();
}

// ---- шаг 4: уведомления ----
function urlB64ToBytes(s) { var p = '='.repeat((4 - s.length % 4) % 4); var b = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from(b, function (c) { return c.charCodeAt(0); }); }
async function subscribe() {
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
  try { if (await subscribe()) R.push_renew = 'подписка восстановлена автоматически'; } catch (e) {}
}

// ---- шаг 5: фон ----
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

// ---- шаг 6: Telegram ----
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
var shareFiles = null;
async function prepareShare() { shareFiles = [await card(0, 1080, 1080, 'Картинка 1'), await card(1, 1080, 1350, 'Картинка 2'), await card(2, 1080, 1080, 'Картинка 3')]; }
async function tShare(mode) {
  try {
    if (!shareFiles) await prepareShare();
    if (!(navigator.canShare && navigator.canShare({ files: shareFiles }))) throw new Error('Передача нескольких картинок не поддерживается');
    var data = { files: shareFiles };
    if (mode === 'all') data.text = SHARE_TEXT;
    if (mode === 'copy') await navigator.clipboard.writeText(SHARE_TEXT);
    await navigator.share(data);
    var names = { all: 'текст + 3 картинки', copy: 'текст в буфере, затем картинки' };
    marks.push('[' + names[mode] + ']');
    setS('share', null, 'отправлено: ' + names[mode] + ' — отметь, что дошло' + (mode === 'copy' ? ' (текст вставь подписью: долгое нажатие → «Вставить»)' : ''));
  } catch (e) { if (e.name === 'AbortError') setS('share', null, 'меню закрыто без отправки'); else setS('share', false, e.message); }
}
function mark(what) { marks.push(what); setS('share', true, marks.join(' → ')); }

// ---- шаг 7: копия и восстановление ----
var CRC_T = (function () { var t = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u) { var c = 0xFFFFFFFF; for (var i = 0; i < u.length; i++) c = CRC_T[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function makeZip(entries) {
  var enc = new TextEncoder(), parts = [], central = [], off = 0, d = new Date();
  var dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  var tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  entries.forEach(function (e) {
    var nm = enc.encode(e.name), crc = crc32(e.data), sz = e.data.length;
    var h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, tm, true); h.setUint16(12, dt, true);
    h.setUint32(14, crc, true); h.setUint32(18, sz, true); h.setUint32(22, sz, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, e.data);
    var c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, tm, true); c.setUint16(14, dt, true);
    c.setUint32(16, crc, true); c.setUint32(20, sz, true); c.setUint32(24, sz, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    central.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + sz;
  });
  var cdSize = central.reduce(function (a, b) { return a + b.length; }, 0);
  var e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, entries.length, true); e.setUint16(10, entries.length, true); e.setUint32(12, cdSize, true); e.setUint32(16, off, true);
  return new Blob(parts.concat(central, [new Uint8Array(e.buffer)]), { type: 'application/zip' });
}
async function readZip(buf) {
  var u = new Uint8Array(buf), v = new DataView(buf), eocd = -1;
  for (var i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) { if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; } }
  if (eocd < 0) throw new Error('Это не архив ZIP');
  var n = v.getUint16(eocd + 10, true), cd = v.getUint32(eocd + 16, true), out = {}, bad = [], dec = new TextDecoder();
  for (var k = 0; k < n; k++) {
    if (v.getUint32(cd, true) !== 0x02014b50) throw new Error('Архив повреждён');
    var method = v.getUint16(cd + 10, true), crc = v.getUint32(cd + 16, true), csz = v.getUint32(cd + 20, true);
    var nl = v.getUint16(cd + 28, true), xl = v.getUint16(cd + 30, true), cl = v.getUint16(cd + 32, true), lo = v.getUint32(cd + 42, true);
    var name = dec.decode(u.subarray(cd + 46, cd + 46 + nl));
    var start = lo + 30 + v.getUint16(lo + 26, true) + v.getUint16(lo + 28, true);
    var data = u.subarray(start, start + csz);
    if (method === 8) data = new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else if (method !== 0) throw new Error('Неизвестный способ сжатия в архиве: ' + name);
    var key = name.replace(/^.*?(manifest\\.json|data\\.json|files\\/.*)$/, '$1');
    if (crc32(data) !== crc) bad.push(key);
    if (name.slice(-1) !== '/') out[key] = data;
    cd += 46 + nl + xl + cl;
  }
  Object.defineProperty(out, 'bad', { value: bad });
  return out;
}
function canon(tables) {
  var o = {};
  Object.keys(tables).sort().forEach(function (t) {
    o[t] = tables[t].map(function (r) { var s = {}; Object.keys(r).sort().forEach(function (k) { s[k] = r[k]; }); return JSON.stringify(s); }).sort();
  });
  return JSON.stringify(o);
}
function countRows(tables) { var c = {}; Object.keys(tables).forEach(function (t) { c[t] = tables[t].length; }); return c; }
var TNAMES = { objects: 'объектов', versions: 'версий', links: 'связей', attachments: 'вложений', settings: 'настроек' };
function countText(c) { return Object.keys(TNAMES).map(function (t) { return TNAMES[t] + ' ' + (c[t] || 0); }).join(', '); }
function bout(text, reset) { var o = document.getElementById('backup-out'); o.hidden = false; o.textContent = (reset ? '' : o.textContent) + text + '\\n'; }

async function tSeed() {
  setS('backup', null, 'создаю тестовые данные…');
  try {
    var r = await api('/api/demo/seed', { method: 'POST' });
    bout((r.created ? 'Созданы тестовые данные: ' : 'Тестовые данные уже есть: ') + countText(r.counts) + ', файлов ' + r.files.length + '.', true);
    setS('backup', null, 'тестовые данные есть — теперь «Сделать копию»');
  } catch (e) { setS('backup', false, e.message); }
}
async function tBackup() {
  setS('backup', null, 'собираю копию…');
  document.getElementById('save-backup').disabled = true;
  try {
    var data = await api('/api/backup/data');
    if (!data.tables.objects.length) throw new Error('Нечего сохранять — сначала «Создать тестовые данные»');
    var enc = new TextEncoder();
    var dataBytes = enc.encode(JSON.stringify({ format: data.format, formatVersion: data.formatVersion, createdAt: data.createdAt, tables: data.tables, files: data.files }, null, 1));
    var entries = [{ name: 'data.json', data: dataBytes }];
    var mf = [];
    for (var i = 0; i < data.files.length; i++) {
      var f = data.files[i];
      var bytes = new Uint8Array(await (await fetch('/api/files/' + f.id, { cache: 'no-store' })).arrayBuffer());
      var h = await sha(bytes);
      if (h !== f.sha256) throw new Error('Файл «' + f.name + '» скачался с ошибкой — копия не создана');
      var path = 'files/' + f.id;
      entries.push({ name: path, data: bytes });
      mf.push({ path: path, id: f.id, name: f.name, type: f.type, size: f.size, sha256: h, created_at: f.created_at });
    }
    var manifest = { format: 'myos-backup', formatVersion: 1, createdAt: data.createdAt, timezone: TZ, counts: countRows(data.tables), dataSha256: await sha(dataBytes), files: mf };
    entries.unshift({ name: 'manifest.json', data: enc.encode(JSON.stringify(manifest, null, 1)) });
    var blob = makeZip(entries);
    var stamp = new Date().toLocaleString('ru-RU', Object.assign({ day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }, TZ ? { timeZone: TZ } : {})).replace(/[.:]/g, '-').replace(/,\\s*/, ' ');
    lastBackup = new File([blob], 'MY OS копия ' + stamp + '.zip', { type: 'application/zip' });
    // самопроверка: читаем только что собранный архив
    var check = await readZip(await lastBackup.arrayBuffer());
    if (check.bad.length || Object.keys(check).length !== entries.length) throw new Error('Собранный архив не читается');
    bout('Копия готова: ' + lastBackup.name + ', ' + mb(lastBackup.size) + '. Внутри ' + countText(manifest.counts) + ', файлов ' + mf.length + '. Каждый файл сверен по отпечатку SHA-256.');
    document.getElementById('save-backup').disabled = false;
    setS('backup', null, 'копия собрана — нажми «Сохранить копию»');
  } catch (e) { setS('backup', false, e.message); }
}
async function saveBackup() {
  if (!lastBackup) return;
  try {
    if (navigator.canShare && navigator.canShare({ files: [lastBackup] })) {
      await navigator.share({ files: [lastBackup] });
      bout('Копия передана в меню «Поделиться». Проверь, что она появилась в «Файлах».');
    } else {
      var a = document.createElement('a'); a.href = URL.createObjectURL(lastBackup); a.download = lastBackup.name; document.body.appendChild(a); a.click(); a.remove();
      bout('Копия скачана — она в «Файлах» → «Загрузки».');
    }
    R.backup_saved = 'копия сохранена';
    setS('backup', null, 'копия сохранена — теперь «Стереть тестовые данные»');
  } catch (e) { if (e.name !== 'AbortError') setS('backup', false, e.message); }
}
var wipeArmed = false;
async function tWipe() {
  var b = document.getElementById('wipe-btn');
  if (!wipeArmed) { wipeArmed = true; b.textContent = 'Точно стереть? Нажми ещё раз'; setTimeout(function () { wipeArmed = false; b.textContent = 'Стереть тестовые данные'; }, 5000); return; }
  wipeArmed = false; b.textContent = 'Стереть тестовые данные';
  try {
    var r = await api('/api/backup/wipe', { method: 'POST', body: JSON.stringify({ confirm: 'СТЕРЕТЬ' }) });
    var v = await api('/api/backup/verify');
    bout('Стёрто: ' + countText(r.counts) + ', файлов ' + r.files + '. Сейчас в базе: ' + countText(v.counts) + ', файлов ' + v.files.length + '.');
    TZ = null; initTz();
    setS('backup', null, 'данные стёрты — теперь «Восстановить из файла»');
  } catch (e) { setS('backup', false, e.message); }
}
async function tRestore(list) {
  if (!list || !list.length) return;
  var file = list[0];
  document.getElementById('restore-input').value = '';
  setS('backup', null, 'проверяю копию…');
  bout('Восстановление из «' + file.name + '», ' + mb(file.size) + ':');
  try {
    var z = await readZip(await file.arrayBuffer());
    if (!z['manifest.json'] || !z['data.json']) throw new Error('В архиве нет описания копии — это не копия MY OS');
    if (z.bad.indexOf('manifest.json') >= 0) throw new Error('Копия повреждена: описание копии не прошло проверку');
    if (z.bad.indexOf('data.json') >= 0) throw new Error('Копия повреждена: данные не прошли проверку');
    var dec = new TextDecoder();
    var manifest = JSON.parse(dec.decode(z['manifest.json']));
    if (manifest.format !== 'myos-backup') throw new Error('Это не копия MY OS');
    if (await sha(z['data.json']) !== manifest.dataSha256) throw new Error('Данные в копии повреждены (отпечаток не совпал)');
    var data = JSON.parse(dec.decode(z['data.json']));
    for (var i = 0; i < manifest.files.length; i++) {
      var mf = manifest.files[i];
      if (!z[mf.path]) throw new Error('В копии не хватает файла «' + mf.name + '»');
      if (z.bad.indexOf(mf.path) >= 0 || await sha(z[mf.path]) !== mf.sha256) throw new Error('Копия повреждена: файл «' + mf.name + '» не прошёл проверку. Текущие данные не тронуты.');
    }
    bout('  ✓ копия целая: ' + countText(manifest.counts) + ', файлов ' + manifest.files.length);
    // заменяем текущие тестовые данные содержимым копии
    await api('/api/backup/wipe', { method: 'POST', body: JSON.stringify({ confirm: 'СТЕРЕТЬ' }) });
    for (var j = 0; j < manifest.files.length; j++) {
      var f = manifest.files[j];
      setS('backup', null, 'возвращаю файлы: ' + (j + 1) + ' из ' + manifest.files.length);
      var r = await fetch('/api/restore/file', { method: 'POST', body: z[f.path], headers: { 'content-type': f.type || 'application/octet-stream', 'x-file-id': f.id, 'x-file-name': encodeURIComponent(f.name), 'x-file-created': f.created_at || '' } });
      var saved = await r.json();
      if (!r.ok || !saved.ok) throw new Error('Файл «' + f.name + '» не загрузился: ' + (saved.error || r.status));
      if (saved.sha256 !== f.sha256) throw new Error('Файл «' + f.name + '» сохранился с ошибкой');
    }
    var order = ['settings', 'objects', 'versions', 'links', 'attachments'];
    for (var t = 0; t < order.length; t++) {
      var rows = data.tables[order[t]] || [];
      for (var k = 0; k < rows.length; k += 20) {
        setS('backup', null, 'возвращаю ' + TNAMES[order[t]] + ': ' + Math.min(k + 20, rows.length) + ' из ' + rows.length);
        await api('/api/restore/rows', { method: 'POST', body: JSON.stringify({ table: order[t], rows: rows.slice(k, k + 20) }) });
      }
    }
    // сверка: сервер пересчитывает всё заново
    var v = await api('/api/backup/verify');
    var after = await api('/api/backup/data');
    var problems = [];
    Object.keys(manifest.counts).forEach(function (t) { if (v.counts[t] !== manifest.counts[t]) problems.push(TNAMES[t] + ': было ' + manifest.counts[t] + ', стало ' + v.counts[t]); });
    if (canon(after.tables) !== canon(data.tables)) problems.push('содержимое строк отличается от копии');
    var byId = {}; v.files.forEach(function (f) { byId[f.id] = f; });
    manifest.files.forEach(function (f) { var s = byId[f.id]; if (!s || !s.ok || s.actual !== f.sha256) problems.push('файл «' + f.name + '» не совпал'); });
    if (v.files.length !== manifest.files.length) problems.push('файлов: было ' + manifest.files.length + ', стало ' + v.files.length);
    if (v.brokenLinks) problems.push('оборванных связей: ' + v.brokenLinks);
    if (v.brokenVersions) problems.push('версий без объекта: ' + v.brokenVersions);
    if (v.brokenAttachments) problems.push('вложений без файла или объекта: ' + v.brokenAttachments);
    var ok = problems.length === 0;
    bout('  ' + (ok ? '✓' : '✗') + ' строки: ' + countText(v.counts) + (canon(after.tables) === canon(data.tables) ? ' — совпадают с копией поле в поле' : ''));
    bout('  ' + (ok ? '✓' : '✗') + ' файлы: ' + v.files.filter(function (f) { return f.ok; }).length + ' из ' + manifest.files.length + ' совпадают байт в байт');
    bout('  ' + (v.brokenLinks + v.brokenVersions + v.brokenAttachments === 0 ? '✓' : '✗') + ' связи, версии и вложения ведут на существующие объекты и файлы');
    if (!ok) bout('  Проблемы: ' + problems.join('; '));
    var summary = ok ? 'восстановлено и сверено: ' + countText(v.counts) + ', файлов ' + v.files.length : 'есть расхождения: ' + problems.join('; ');
    await api('/api/restore/done', { method: 'POST', body: JSON.stringify({ result: summary }) }).catch(function () {});
    setS('backup', ok, summary);
    initTz(); loadCounters();
  } catch (e) { bout('  ✗ ' + e.message); setS('backup', false, e.message); }
}

// ---- лимиты ----
var LEVELS = { ok: 'норма', warn: 'предупреждение (70%)', economy: 'режим экономии (85%)', stop: 'стоп (100%)' };
function amount(i) { return i.unit === 'байт' ? mb(i.used) + ' из ' + mb(i.limit) : num(i.used) + ' из ' + num(i.limit) + ' ' + i.unit; }
async function loadCounters() {
  var box = document.getElementById('counters');
  try {
    var c = await api('/api/counters');
    box.innerHTML = '';
    var head = document.createElement('p'); head.className = 'hint';
    head.textContent = 'Сутки Cloudflare — с 00:00 UTC. Лимиты обновятся ' + c.resetLocal + ' по твоему времени.';
    box.appendChild(head);
    c.items.forEach(function (i) {
      var d = document.createElement('div'); d.className = 'meter';
      var top = document.createElement('div'); top.className = 'row';
      var n = document.createElement('span'); n.textContent = i.name;
      var p = document.createElement('span'); p.className = 'status ' + (i.level === 'ok' ? 'ok' : i.level === 'stop' ? 'bad' : 'warn'); p.textContent = i.pct.toLocaleString('ru-RU') + '% · ' + LEVELS[i.level];
      top.appendChild(n); top.appendChild(p);
      var bar = document.createElement('div'); bar.className = 'bar'; var fill = document.createElement('i'); fill.className = i.level; fill.style.width = Math.min(100, Math.max(i.pct, i.used ? 1 : 0)) + '%'; bar.appendChild(fill);
      var src = document.createElement('div'); src.className = 'src'; src.textContent = amount(i) + ' · источник: ' + i.source + (i.note ? '. ' + i.note : '');
      d.appendChild(top); d.appendChild(bar); d.appendChild(src); box.appendChild(d);
    });
    var high = c.items.filter(function (i) { return i.level !== 'ok'; });
    R.limits = (high.length ? '⚠ ' + high.map(function (i) { return i.name + ' ' + i.pct + '%'; }).join(', ') : '✓ все ниже 70%') + '; ИИ ' + c.items[c.items.length - 1].used + ' нейронов (оценка)';
    renderReport();
  } catch (e) { box.textContent = 'Не удалось получить счётчики: ' + e.message; }
}

// ---- дополнительно ----
async function tAI(model) {
  setS('ai', null, 'модель думает…');
  var out = document.getElementById('ai-out'); out.hidden = true;
  try {
    var r = await api('/api/ai', { method: 'POST', body: JSON.stringify({ model: model }) });
    out.hidden = false;
    out.textContent = r.text + '\\n\\n— ' + r.model + (r.economy ? ' (режим экономии: сильная модель отключена до конца суток)' : '') + ': ' + (r.ms / 1000).toFixed(1) + ' с' +
      (r.neurons !== null ? ', около ' + r.neurons + ' нейронов (оценка)' : '') + '. За сегодня: около ' + r.todayNeurons + ' из ' + r.dailyLimit + '.';
    R['ai_' + model] = r.model + ' — ' + (r.ms / 1000).toFixed(1) + ' с' + (r.neurons !== null ? ', ~' + r.neurons + ' нейронов' : '');
    setS('ai', true, ['fast','balanced','strong'].filter(function (k) { return R['ai_' + k]; }).map(function (k) { return R['ai_' + k]; }).join('; '));
    loadCounters();
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
  if (id === 'cron') tCron();
}

(function init() {
  document.getElementById('mode-hint').textContent = standalone
    ? 'Стенд открыт с экрана «Домой» — уведомления будут работать.'
    : 'Сейчас стенд открыт во вкладке Safari. Для уведомлений нажми «Поделиться» → «На экран «Домой»» и дальше открывай его оттуда.';
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').then(autoResubscribe);
  window.addEventListener('hashchange', onHash);
  initTz().then(tCheck).then(loadCounters); onHash();
})();
</script>
</body>
</html>`;
