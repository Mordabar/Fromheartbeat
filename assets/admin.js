// Studio control room. The same language as the customer's session: one colour per state, six production stages,
// messages as a conversation. Everything the server needs is unchanged (same endpoints, same payloads).
import {STAGE_INFO, STATE, ago, parseDate, who} from './session-ui.js';
import {createGrowth} from './admin-growth.js';
import {configure as configureUploads, mount as mountUploader, uploaderHtml, busy as uploadsBusy} from './uploader.js';

const root = document.querySelector('#admin-content');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const money = n => new Intl.NumberFormat('es-CO', {style: 'currency', currency: 'COP', maximumFractionDigits: 0}).format(n / 100);
const transitions = {created: ['created', 'cancelled'], payment_pending: ['payment_pending', 'cancelled'], paid: ['paid', 'in_production'], in_production: ['in_production', 'review', 'completed'], review: ['review', 'in_production', 'completed'], completed: ['completed', 'review'], cancelled: ['cancelled']};
const LABEL = {created: 'Esperando el pago', payment_pending: 'Esperando el pago', paid: 'Pagada · por empezar', in_production: 'En producción', review: 'Esperando al cliente', completed: 'Entregada', cancelled: 'Cancelada'};
const stages = STAGE_INFO.map(s => s[0]);
let boot, order, orders = [], filter = 'all', query = '', shown = 20, listSeq = 0, boardScroll = 0;
const PAGE = 20;

const P = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/>', phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>', arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>', check: '<path d="m5 12 5 5 9-10"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', card: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 10h18"/>',
  music: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>', headphones: '<path d="M3 14v-2a9 9 0 0 1 18 0v2"/><path d="M21 15a2 2 0 0 1-2 2h-1v-5h1a2 2 0 0 1 2 2zM3 15a2 2 0 0 0 2 2h1v-5H5a2 2 0 0 0-2 2z"/>',
  star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>', close: '<path d="M18 6 6 18M6 6l12 12"/>', lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  alert: '<path d="M12 3 2 21h20z"/><path d="M12 10v5M12 18v.5"/>', send: '<path d="m4 12 16-8-6 16-3-7z"/>', upload: '<path d="M12 16V4M7 9l5-5 5 5M4 20h16"/>', refresh: '<path d="M20 11a8 8 0 0 0-14-4M4 4v4h4M4 13a8 8 0 0 0 14 4M20 20v-4h-4"/>', eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
};
const ic = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.check}</svg>`;

async function api(action, data, query = '') {
  let r; try { r = await fetch('api.php?action=' + action + query, {method: data ? 'POST' : 'GET', headers: data ? {'Content-Type': 'application/json', 'X-CSRF-Token': boot.csrf} : {}, body: data ? JSON.stringify(data) : undefined}); }
  catch { throw Error('Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'); }
  let j; try { j = await r.json(); } catch { throw Error('El servidor respondió algo inesperado. Inténtalo de nuevo.'); }
  if (!r.ok) { if (r.status === 401 && action !== 'login') { stash(); login(); } throw Error(j.error || 'No se pudo completar la acción.'); }
  return j;
}
function tell(s, bad = false) { const t = document.querySelector('#toast'); t.textContent = s; t.setAttribute('role', bad ? 'alert' : 'status'); t.className = 'visible' + (bad ? ' bad' : ''); clearTimeout(tell.t); if (!bad) tell.t = setTimeout(() => t.className = '', 6000); }
document.addEventListener('pointerdown', () => { const t = document.querySelector('#toast'); if (t.classList.contains('bad')) t.className = ''; }, true);

function login() {
  document.querySelector('#logout').hidden = true;
  root.innerHTML = `<form id="login" class="login a-login"><p class="a-eyebrow">Solo para el equipo</p><h1>De vuelta<br>en el estudio.</h1><label class="field">Correo<input type="email" name="email" required autocomplete="username" placeholder="tu@correo.com"></label><label class="field">Contraseña<input type="password" name="password" required autocomplete="current-password"></label><button class="primary full-width">Entrar al estudio</button><p class="form-error" role="alert"></p></form>`;
}

const adminNav = active => `<nav class="a-nav" aria-label="Administración"><button data-admin-page="orders" class="${active === 'orders' ? 'on' : ''}" ${active === 'orders' ? 'aria-current="page"' : ''}>${ic('headphones')} Sesiones</button><button data-admin-page="music" class="${active === 'music' ? 'on' : ''}" ${active === 'music' ? 'aria-current="page"' : ''}>${ic('music')} Catálogo musical</button><button data-admin-page="growth" class="${active === 'growth' ? 'on' : ''}" ${active === 'growth' ? 'aria-current="page"' : ''}>${ic('star')} Crecimiento</button></nav>`;
const growth = createGrowth({root, api: (...a) => api(...a), esc, money, tell, nav: adminNav});

// ---- Sandbox lab (only when the server reports test mode) ---------------------------------------------------------------
function labGuide() { return `<details class="a-lab"><summary>🧪 Modo de pruebas · cómo recorrer una compra completa</summary><ol><li><b>Comprador:</b> en <a href="./" target="_blank" rel="noopener">la tienda</a> crea una canción y paga con la tarjeta <code>4242 4242 4242 4242</code> (rechazo: <code>4111 1111 1111 1111</code>), fecha futura y CVC de 3 dígitos.</li><li>Vuelve a la pestaña de la tienda: la sesión pasa sola a <b>Pago confirmado</b>. Aquí también puedes usar <b>Verificar pago con Wompi</b>.</li><li><b>Vendedor:</b> abre la sesión, empieza la producción y avanza las etapas con mensajes visibles.</li><li>Pulsa <b>Añadir entregables de prueba</b> y marca <b>Entregada</b>. Full Experience además exige un MP4.</li><li>Con <b>Abrir como cliente</b> ves el Listening Room, y en <b>Correos generados</b> lo que recibiría el cliente.</li></ol></details>`; }
const MAIL_HTML = '<!--fhb:html-->', MAIL_TEXT = '\n<!--fhb:text-->\n';
function mailView(b) { if (!String(b).startsWith(MAIL_HTML)) return `<pre>${esc(b)}</pre>`; const rest = String(b).slice(MAIL_HTML.length), i = rest.indexOf(MAIL_TEXT), h = i < 0 ? rest : rest.slice(0, i), t = i < 0 ? '' : rest.slice(i + MAIL_TEXT.length); return `<iframe class="mail-frame" sandbox title="Vista previa del correo" srcdoc="${esc(h)}"></iframe><details class="mail-text"><summary>Ver versión en texto</summary><pre>${esc(t)}</pre></details>`; }
function labCard(o) { return `<section class="a-card a-lab-card"><h2 class="a-h">🧪 Pruebas de esta sesión</h2><div class="a-actions"><button class="primary" data-lab="sync">Verificar pago con Wompi</button><button class="primary" data-lab="kit">Añadir entregables de prueba</button>${/^https?:\/\//.test(o.testLink || '') ? `<a class="primary" href="${esc(o.testLink)}" target="_blank" rel="noopener">Abrir como cliente ↗</a>` : ''}</div><h3 class="a-sub">Correos generados (${(o.mails || []).length})</h3>${(o.mails || []).map(m => `<details class="mail"><summary><b>${esc(m.subject)}</b><small>${esc(m.recipient)} · ${esc(m.created_at)} UTC</small></summary>${mailView(m.body)}</details>`).join('') || '<p class="a-muted">Todavía no hay correos.</p>'}</section>`; }

// ---- Sessions board ---------------------------------------------------------------------------------------------------
const waitingOn = o => o.last_voice === 'customer';
const needsStudio = o => o.status !== 'cancelled' && (Number(o.requires_attention) || o.status === 'paid' || waitingOn(o));
const BUCKETS = [
  ['attn', 'Por atender', 'pay', 'alert', o => needsStudio(o)],
  ['make', 'En producción', 'make', 'music', o => o.status === 'in_production' && !needsStudio(o)],
  ['client', 'Esperando al cliente', 'review', 'headphones', o => o.status === 'review' && !needsStudio(o)],
  ['unpaid', 'Esperando el pago', 'off', 'clock', o => ['created', 'payment_pending'].includes(o.status)],
  ['done', 'Entregadas', 'done', 'star', o => o.status === 'completed'],
  ['off', 'Canceladas', 'off', 'close', o => o.status === 'cancelled'],
];
const meter = (o, big = false) => `<span class="a-meter${big ? ' big' : ''}" aria-hidden="true">${stages.map((_, i) => `<i class="${o.status === 'completed' || (!['created', 'payment_pending'].includes(o.status) && i < o.production_stage) ? 'on' : !['created', 'payment_pending', 'cancelled'].includes(o.status) && i === Number(o.production_stage) ? 'now' : ''}"></i>`).join('')}</span>`;
const chip = o => waitingOn(o) && o.status !== 'cancelled' ? '<span class="a-chip tone-pay">Te escribió</span>' : `<span class="a-chip tone-${(STATE[o.status] || STATE.created).tone}">${esc(LABEL[o.status] ?? o.status)}</span>`;

function card(o) {
  const st = STATE[o.status] || STATE.created, t = parseDate(o.created_at);
  return `<button class="o-card tone-${st.tone}" data-order="${esc(o.reference)}"><span class="o-badge" aria-hidden="true">${ic(st.icon)}</span>
    <span class="o-main"><b>${esc(o.name)}</b><span class="sr-only"> · </span><small>${esc(o.product_name)} · ${money(o.amount_in_cents)}</small>${meter(o)}<small class="o-stage">${['created', 'payment_pending'].includes(o.status) ? 'Esperando el pago' : o.status === 'completed' ? 'Entregada' : o.status === 'cancelled' ? 'Cancelada' : `Etapa ${Number(o.production_stage) + 1} de 6 · ${esc(stages[o.production_stage])}`}</small></span>
    <span class="o-side">${chip(o)}${needsStudio(o) && o.status !== 'paid' && !waitingOn(o) ? `<span class="o-attn">${ic('alert')} Por atender</span>` : ''}<small>${esc(o.reference)}<br>${esc(ago(t))}</small></span></button>`;
}

function board() {
  const q = query.trim().toLowerCase();
  let rows = orders.filter(o => !q || [o.name, o.email, o.reference].some(v => String(v).toLowerCase().includes(q)));
  const b = BUCKETS.find(x => x[0] === filter);
  if (b) rows = rows.filter(b[4]);
  rows = rows.slice().sort((a, c) => (needsStudio(c) - needsStudio(a)) || (parseDate(c.created_at) - parseDate(a.created_at)));
  const mine = orders.filter(o => !q || [o.name, o.email, o.reference].some(v => String(v).toLowerCase().includes(q)));
  return {rows, html: rows.slice(0, shown).map(card).join('') + (rows.length > shown ? `<button class="secondary a-more-btn" data-more>Ver ${Math.min(PAGE, rows.length - shown)} más · quedan ${rows.length - shown}</button>` : '') || `<div class="a-empty">${ic('headphones')}<p><b>No hay sesiones aquí.</b></p><p class="a-muted">${q ? 'Prueba con otra búsqueda o quita el filtro.' : 'Cuando entren compras, aparecerán en este tablero.'}</p></div>`, mine};
}
function renderBoard() {
  const {rows, html, mine} = board();
  document.querySelector('#a-tiles').innerHTML = `<button class="a-tile ${filter === 'all' ? 'on' : ''}" data-filter="all" aria-pressed="${filter === 'all'}"><b>${mine.length}</b><span>Todas</span></button>${BUCKETS.map(([k, label, tone, icon, fn]) => `<button class="a-tile tone-${tone} ${filter === k ? 'on' : ''}" data-filter="${k}" aria-pressed="${filter === k}"><b>${mine.filter(fn).length}</b><span>${ic(icon)}${label}</span></button>`).join('')}`;
  document.querySelector('#a-board').innerHTML = html;
  document.querySelector('#a-count').textContent = `${rows.length} ${rows.length === 1 ? 'sesión' : 'sesiones'}${orders.length >= 200 ? ' · se muestran las 200 más recientes' : ''}`;
}
async function list(q = '', quiet = false) {
  const seq = ++listSeq, j = await api('admin-orders', null, '&q=' + encodeURIComponent(q));
  if (seq !== listSeq || (quiet && !document.querySelector('#a-board'))) return;   // a late answer never replaces what the producer is looking at
  orders = j.orders; query = q; if (!quiet) shown = shown > PAGE && !q ? shown : PAGE; document.querySelector('#logout').hidden = false;
  if (quiet && document.querySelector('#a-board')) { renderBoard(); return; }
  root.innerHTML = `${adminNav('orders')}<header class="a-head"><p class="a-eyebrow">Operaciones</p><h1>Las historias del estudio.</h1></header>
    ${boot.testMode ? labGuide() : ''}
    <div id="a-tiles" class="a-tiles" role="group" aria-label="Filtrar sesiones"></div>
    <form id="search" class="a-search" role="search"><label class="sr-only" for="a-q">Buscar sesión o cliente</label><input id="a-q" name="q" type="search" value="${esc(q)}" placeholder="Buscar por nombre, correo o referencia" autocomplete="off"><button class="primary">Buscar</button></form>
    <p id="a-count" class="a-muted a-count" role="status"></p><div id="a-board" class="a-board"></div>`;
  renderBoard();
}

// ---- Session detail ---------------------------------------------------------------------------------------------------
// What the studio most likely wants to do next. Each action only pre-fills the composer: nothing is sent until the producer says so.
const TEMPLATES = {
  1: 'Ya leímos tu historia completa y estamos escribiendo la letra. Te escribo apenas esté lista.',
  2: 'La letra quedó lista. Entramos a grabar la voz esta semana.',
  3: 'Ya tenemos la voz. Estamos armando los arreglos y dando carácter al sonido.',
  4: 'Estamos en la mezcla final para que tu canción suene perfecta.',
  review: 'Tu canción está lista. Escúchala aquí, en tu sesión, y cuéntanos qué sentiste. Si quieres ajustar algo, escríbenos y lo cuidamos.',
  completed: 'Gracias por confiar en nosotros. Tu canción queda disponible aquí para escucharla y descargarla cuando quieras.',
  reply: 'Gracias por tus comentarios. Ya estamos ajustándolo y te avisamos en cuanto esté la nueva versión.',
  start: '¡Bienvenido al estudio! Recibimos tu pago y tu historia. Un productor ya la está leyendo.',
};
const isUpload = h => /^(Versión disponible|Archivo añadido|Archivo retirado):/.test(h.note);
// The last thing the customer said that no one from the studio has answered (internal notes, uploads and payments do not count).
function unanswered(o) {
  for (let i = o.history.length - 1; i >= 0; i--) {
    const h = o.history[i], w = who(h.actor); if (w === 'system') continue;
    if (w === 'me') { if (isUpload(h)) continue; return h.note.replace(/^Comentario del cliente:\s*/, ''); }
    if (/^Atendida sin mensaje/.test(h.note) || (Number(h.visible) !== 0 && !isUpload(h))) return null;
  }
  return null;
}
// Same rules as the server for "completed" (api.php), so the producer is told before writing, not after.
// One list drives both the checklist the producer sees and the gate on the buttons.
function deliveryList(o) {
  const files = o.files.filter(f => f.kind === 'delivery'), pick = (...mimes) => files.filter(f => mimes.includes(f.mime)).pop();
  const list = [{key: 'mp3', label: 'MP3 para escuchar y compartir', file: pick('audio/mpeg'), need: 'review'}];
  if (o.product_code !== 'dedicatoria') list.push({key: 'wav', label: 'WAV de alta calidad', file: pick('audio/wav', 'audio/x-wav'), need: 'completed'});
  if (o.audience === 'person') list.push({key: 'cover', label: 'Portada', file: pick('image/png', 'image/jpeg', 'image/webp'), need: 'completed'});
  if (o.product_code === 'full') list.push({key: 'mp4', label: 'Video MP4 (Full Experience)', file: pick('video/mp4'), need: 'completed'});
  return list;
}
function missingFiles(o, forStatus) {
  const names = {mp3: 'el MP3', wav: 'el WAV', cover: 'la portada', mp4: 'el video MP4'};
  return deliveryList(o).filter(d => !d.file && (d.need === 'review' || forStatus === 'completed')).map(d => names[d.key]);
}
function deliverCard(o) {
  const list = deliveryList(o), done = list.filter(d => d.file).length, ready = list.length === done;
  const mine = o.files.filter(f => f.kind === 'source');
  return `<section id="deliver" class="a-card"><h2 class="a-h">Entrega al cliente <b>${ready ? 'Todo listo' : `${done} de ${list.length} listos`}</b></h2>
   <ul class="a-deliv" aria-label="Archivos de la entrega">${list.map(d => `<li class="${d.file ? 'ok' : ''}"><span class="d-st" aria-hidden="true">${d.file ? '✓' : '·'}</span><b>${esc(d.label)}</b><small>${d.file ? esc(d.file.original_name) : 'Falta'}</small></li>`).join('')}</ul>
   <p class="a-muted">Elige todos los archivos juntos: cada uno se reconoce por su contenido. Sube versiones nuevas con el nombre <code>Cancion-v2.mp3</code>; el cliente ve la última y conserva las anteriores. Se envían tal cual, sin compresión.</p>
   ${uploaderHtml(o.reference, {role: 'admin', kind: 'delivery', pickLabel: 'Elegir los archivos de entrega', dropHint: 'WAV, MP3, video, portada… varios a la vez · hasta 1 GB cada uno'})}
   ${mine.length ? `<details class="a-more a-src"><summary>Material que envió el cliente · ${mine.length}</summary>${uploaderHtml(o.reference, {role: 'admin', kind: 'source', listOnly: true})}</details>` : ''}</section>`;
}
function nextActions(o) {
  const s = Number(o.production_stage), a = [], waiting = unanswered(o) !== null;
  const gate = (act, to) => { const miss = missingFiles(o, to); return miss.length ? {...act, blocked: `Primero sube ${miss.join(', ')}.`} : act; };
  if (o.status === 'paid') a.push({label: 'Empezar la producción', icon: 'music', status: 'in_production', stage: 1, text: TEMPLATES.start, primary: true});
  if (waiting && !['created', 'payment_pending', 'cancelled'].includes(o.status)) a.push({label: 'Responder al cliente', icon: 'send', status: o.status, stage: s, text: '', primary: true, reply: true});
  if (o.status === 'in_production') {
    if (s < 4) a.push({label: `Avanzar a «${stages[Math.max(s, 0) + 1]}»`, icon: 'arrow', status: 'in_production', stage: Math.max(s, 0) + 1, text: TEMPLATES[Math.max(s, 0) + 1], primary: !waiting});
    else a.push(gate({label: 'Enviar a revisión del cliente', icon: 'headphones', status: 'review', stage: 5, text: TEMPLATES.review, primary: !waiting}, 'review'));
    if (s >= 4) a.push(gate({label: 'Entregar ahora, sin revisión', icon: 'star', status: 'completed', stage: 5, text: TEMPLATES.completed}, 'completed'));
  }
  if (o.status === 'review') {
    a.push(gate({label: 'El cliente aprobó: marcar entregada', icon: 'star', status: 'completed', stage: 5, text: TEMPLATES.completed, primary: !waiting}, 'completed'));
    if (waiting) for (const [l, st] of [['la letra', 1], ['la voz', 2], ['la mezcla', 4]]) a.push({label: `Pidió cambios en ${l}`, icon: 'refresh', status: 'in_production', stage: st, text: TEMPLATES.reply});
  }
  return a;
}

function thread(o) {
  const items = o.history.filter(h => !isUpload(h)).reverse();
  return `<ol class="a-feed">${items.map(h => {
    const w = who(h.actor), t = parseDate(h.created_at), internal = Number(h.visible) === 0 && w !== 'system', stg = STAGE_INFO[Number(h.stage)]?.[0] || '';
    if (w === 'system') return `<li class="a-ev"><span>${ic(/pago/i.test(h.note) ? 'card' : 'check')}</span><p>${esc(h.note)}</p><time>${esc(ago(t))}</time></li>`;
    const text = w === 'me' ? h.note.replace(/^Comentario del cliente:\s*/, '') : h.note;
    return `<li class="a-msg ${w}${internal ? ' internal' : ''}"><div class="a-bub"><p class="a-who">${w === 'me' ? esc(o.customer.name.split(' ')[0]) + ' (cliente)' : internal ? ic('lock') + ' Nota interna · solo el equipo' : 'Tu mensaje al cliente'}${stg ? `<span>${esc(stg)}</span>` : ''}<time title="${esc(t.toLocaleString('es-CO'))}">${esc(ago(t))}</time></p><p>${esc(text)}</p></div></li>`;
  }).join('') || '<li class="a-muted">Todavía no hay mensajes.</li>'}</ol>`;
}

async function detail(ref, keep = {}) {
  clearTimeout(searchTimer); ++listSeq;
  if (document.querySelector('#a-board')) boardScroll = window.scrollY;
  order = (await api('admin-order', null, '&reference=' + encodeURIComponent(ref))).order; Object.assign(order, {history: order.history || [], files: order.files || [], payments: order.payments || [], brief: order.brief || {}, customer: order.customer || {name: '—', email: '', phone: ''}, product: order.product || {price: 0}}); const o = order, st = STATE[o.status] || STATE.created;
  const pending = ['created', 'payment_pending'].includes(o.status), actions = nextActions(o), quote = pending || o.status === 'cancelled' ? null : unanswered(o), waiting = quote !== null, first = o.customer.name.split(' ')[0];
  const digits = String(o.customer.phone || '').replace(/\D/g, ''), wa = /^3\d{9}$/.test(digits) ? `https://wa.me/57${digits}` : digits.length >= 11 ? `https://wa.me/${digits}` : '';
  const briefKeys = {genre: 'Género', mood: 'Emoción', voice: 'Voz', language: 'Idioma', tempo: 'Ritmo', recipient: 'Para', occasion: 'Ocasión', brand: 'Marca', campaign: 'Campaña', channels: 'Canales', license_scope: 'Licencia solicitada', agreed_scope: 'Alcance acordado', details: 'Detalles'};
  const chips = ['genre', 'mood', 'voice', 'language', 'tempo'].filter(k => o.brief[k]).map(k => `<span class="a-tag"><small>${briefKeys[k]}</small>${esc(o.brief[k])}</span>`).join('');
  const rest = Object.entries(o.brief).filter(([k, v]) => v && !['genre', 'mood', 'voice', 'language', 'tempo', 'story'].includes(k));
  const wantsUpload = ['in_production', 'review'].includes(o.status), uploadCard = ['paid', 'in_production', 'review', 'completed'].includes(o.status) ? deliverCard(o) : '';
  root.innerHTML = `${adminNav('orders')}<button class="a-back" id="back">${ic('back')} Todas las sesiones</button>
  <header class="a-detail-head tone-${st.tone}"><span class="o-badge big" aria-hidden="true">${ic(st.icon)}</span><div><p class="a-eyebrow">${esc(o.reference)}</p><h1>${esc(o.customer.name)}</h1><p class="a-muted">${esc(o.product_name)} · ${money(o.amount_in_cents)} COP</p></div>${chip(o)}</header>
  <div class="a-layout"><div class="a-col">
   <section class="a-card a-pipe tone-${st.tone}"><h2 class="a-h">Producción <b>${pending ? 'Esperando el pago' : o.status === 'completed' ? 'Completada' : `Etapa ${Number(o.production_stage) + 1} de 6 · ${esc(stages[o.production_stage])}`}</b></h2>${meter(o, true)}
    <ol class="a-stages">${stages.map((n, i) => `<li class="${o.status === 'completed' || (!pending && i < o.production_stage) ? 'done' : !pending && i === Number(o.production_stage) ? 'now' : ''}"><span>${i + 1}</span>${esc(n)}</li>`).join('')}</ol>
    ${waiting ? `<div class="a-alert" role="group" aria-label="Mensaje del cliente sin responder"><p class="a-alert-t">${ic('alert')} <b>${esc(first)} te escribió y espera respuesta</b></p><blockquote>${esc(quote.length > 280 ? quote.slice(0, 280) + '…' : quote)}</blockquote><button type="button" class="a-link" data-attend>Ya lo atendí por otro medio · quitar de «por atender»</button></div>` : Number(o.requires_attention) ? `<div class="a-alert"><p class="a-alert-t">${ic('alert')} <b>Marcada como «por atender»</b></p><button type="button" class="a-link" data-attend>Marcar como atendida</button></div>` : ''}
    ${actions.length ? `<div class="a-next"><p class="a-sub">${actions.length > 1 ? 'Qué quieres hacer ahora' : 'Siguiente paso sugerido'}</p>${actions.map((a, i) => `<button class="${a.primary ? 'primary' : 'secondary'} a-act" data-next="${i}" ${a.blocked ? 'disabled aria-describedby="blk' + i + '"' : ''}>${ic(a.icon)} ${esc(a.label)}</button>${a.blocked ? `<p class="a-blocked" id="blk${i}">${ic('upload')} ${esc(a.blocked)} <a href="#deliver">Subir archivo</a></p>` : ''}`).join('')}</div>` : pending ? '<p class="a-muted">La producción empieza cuando Wompi confirme el pago. Se actualiza solo.</p>' : o.status === 'cancelled' ? '<p class="a-muted">Esta sesión fue cancelada y no se puede reactivar.</p>' : ''}</section>
   ${wantsUpload && !waiting ? uploadCard : ''}
   ${o.status === 'cancelled' ? '' : `<form id="update" class="a-card a-compose" novalidate><h2 class="a-h">Mensaje y estado</h2>
    <fieldset class="a-seg"><legend class="sr-only">¿Quién lo ve?</legend><label><input type="radio" name="audience" value="client" ${keep.audience !== 'internal' ? 'checked' : ''}><span>${ic('eye')} Para ${esc(first)}</span></label><label><input type="radio" name="audience" value="internal" ${keep.audience === 'internal' ? 'checked' : ''}><span>${ic('lock')} Nota interna</span></label></fieldset>
    ${waiting ? `<div class="a-quote"><p class="a-sub">${esc(first)} escribió</p><blockquote>${esc(quote.length > 280 ? quote.slice(0, 280) + '…' : quote)}</blockquote></div>` : ''}
    <label class="field a-note"><span id="a-note-label">${keep.audience === 'internal' ? 'Nota solo para el equipo' : waiting ? `Tu respuesta para ${esc(first)}` : `Mensaje que verá ${esc(first)} en su sesión`}</span><textarea name="note" required minlength="3" maxlength="2000" rows="4" placeholder="${keep.audience === 'internal' ? 'Ej.: Pidió referencia a Carlos Vives. Revisar tonalidad.' : 'Cuéntale en palabras simples qué pasó y qué sigue.'}">${esc(keep.text || '')}</textarea><small class="a-count"><span id="a-len">0</span> / 2000</small></label>
    <div class="a-chips" role="group" aria-label="Plantillas de mensaje">${(waiting ? [['Ya lo ajustamos', TEMPLATES.reply], ['Lista para escuchar', TEMPLATES.review]] : [['Empezamos', TEMPLATES.start], ['Letra', TEMPLATES[1]], ['Voz grabada', TEMPLATES[3]], ['Mezcla', TEMPLATES[4]], ['Lista para escuchar', TEMPLATES.review]]).map(([l, t]) => `<button type="button" class="a-chip-btn" data-template="${esc(t)}">${esc(l)}</button>`).join('')}</div>
    <div id="a-preview" class="a-preview" ${keep.audience === 'internal' || !keep.text ? 'hidden' : ''}><p class="a-sub">Así lo verá ${esc(first)}</p><div class="a-msg studio"><div class="a-bub"><p class="a-who">Tu productor<span id="a-pv-stage">${esc(stages[keep.stage ?? o.production_stage])}</span></p><p id="a-pv-text">${esc(keep.text || '')}</p></div></div></div>
    <div class="a-two"><label class="field"><span>Estado</span><select name="status">${(transitions[o.status] || [o.status]).map(k => `<option value="${k}" ${k === (keep.status || o.status) ? 'selected' : ''}>${esc(LABEL[k])}</option>`).join('')}</select></label><label class="field"><span>Etapa</span><select name="stage">${stages.map((s, i) => `<option value="${i}" ${i === Number(keep.stage ?? o.production_stage) ? 'selected' : ''}>${i + 1}. ${esc(s)}</option>`).join('')}</select></label></div>
    <label class="check" id="a-notify"><input type="checkbox" name="notify" ${keep.audience === 'internal' ? 'disabled' : ''} ${keep.notify ? 'checked' : ''}><span>Avisar a ${esc(first)} por correo</span></label>
    <label class="check"><input type="checkbox" name="attention" ${Number(o.requires_attention) && !waiting ? 'checked' : ''}><span>Dejar marcada como «por atender»</span></label>
    <p id="a-summary" class="a-summary" role="status"></p>
    <button class="primary full-width" id="a-send">${ic('send')} Enviar a ${esc(first)}</button><p class="form-error" role="alert"></p></form>`}
   ${wantsUpload && waiting ? uploadCard : ''}
   <section class="a-card"><h2 class="a-h">Conversación <b>${o.history.filter(h => who(h.actor) !== 'system').length} mensajes</b></h2>${thread(o)}</section>
  </div><div class="a-col">
   ${boot.testMode ? labCard(o) : ''}
   <section class="a-card"><h2 class="a-h">Cliente</h2><p class="a-name">${esc(o.customer.name)}</p><div class="a-contact"><a href="mailto:${esc(o.customer.email)}">${ic('mail')} ${esc(o.customer.email)}</a>${o.customer.phone ? `<a href="tel:${esc(o.customer.phone)}">${ic('phone')} ${esc(o.customer.phone)}</a>` : ''}${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">${ic('send')} WhatsApp</a>` : ''}</div></section>
   <section class="a-card"><h2 class="a-h">Lo que pidió</h2><div class="a-tags">${chips}</div>${o.brief.recipient || o.brief.occasion ? `<p class="a-for"><small>Para</small> ${esc([o.brief.recipient, o.brief.occasion].filter(Boolean).join(' · '))}</p>` : ''}${o.brief.story ? `<blockquote class="a-story">${esc(o.brief.story)}</blockquote>` : ''}${rest.length ? `<details class="a-more"><summary>Más detalles</summary><dl>${rest.map(([k, v]) => `<dt>${esc(briefKeys[k] || k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>` : ''}</section>
   ${o.audience === 'business' && o.status === 'created' ? `<form id="quote" class="a-card"><h2 class="a-h">Propuesta comercial</h2><label class="field"><span>Precio final en COP</span><input name="amount" type="number" min="${o.product.price / 100}" step="1" value="${o.amount_in_cents / 100}" required></label><label class="field"><span>Alcance y licencia</span><textarea name="scope" required minlength="20" maxlength="4000">${esc(o.brief.agreed_scope || '')}</textarea></label><button class="primary">Enviar propuesta</button><p class="form-error" role="alert"></p></form>` : ''}
   ${wantsUpload ? '' : uploadCard}
   <section class="a-card"><h2 class="a-h">Pagos</h2>${o.payments.map(p => `<div class="a-pay"><b>${money(p.amount_in_cents)} ${esc(p.currency)}</b><span class="a-chip tone-${p.status === 'APPROVED' ? 'done' : p.status === 'PENDING' ? 'pay' : 'off'}">${esc({APPROVED: 'Aprobado', PENDING: 'Pendiente', DECLINED: 'Rechazado', VOIDED: 'Anulado', ERROR: 'Error'}[p.status] || p.status)}</span><small>${esc(p.transaction_id || 'Aún sin transacción')}<br>${esc(p.reference)}</small></div>`).join('') || '<p class="a-muted">No hay intentos de pago.</p>'}</section>
  </div></div>`;
  document.querySelectorAll('[data-uploader]').forEach(el => mountUploader(el, {ref: o.reference, role: 'admin', kind: el.dataset.uKind, files: o.files, status: o.status}));
  const cf = document.querySelector('#update'); if (cf) syncCompose(cf);
}

// ---- Events -----------------------------------------------------------------------------------------------------------
let searchTimer = 0;
function focusTitle() { const h = document.querySelector('.admin-shell h1'); if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); document.title = h.textContent.trim() + ' · Estudio Fromheartbeat'; } }
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const draftKey = 'fhb_admin_draft';
const readDraft = () => { const f = document.querySelector('#update'); return f ? {text: f.elements.note.value, audience: f.elements.audience.value, status: f.elements.status.value, stage: Number(f.elements.stage.value), notify: f.elements.notify.checked} : {}; };
function syncCompose(f) {
  const internal = f.elements.audience.value === 'internal', n = f.elements.notify, first = order.customer.name.split(' ')[0];
  document.querySelector('#a-note-label').textContent = internal ? 'Nota solo para el equipo' : unanswered(order) !== null ? `Tu respuesta para ${first}` : `Mensaje que verá ${first} en su sesión`;
  n.disabled = internal; if (internal) n.checked = false;
  f.classList.toggle('internal', internal);
  const pv = document.querySelector('#a-preview'), text = f.elements.note.value.trim();
  pv.hidden = internal || !text; document.querySelector('#a-pv-text').textContent = text; document.querySelector('#a-pv-stage').textContent = stages[f.elements.stage.value] || '';
  document.querySelector('#a-len').textContent = f.elements.note.value.length;
  document.querySelector('#a-send').innerHTML = `${ic(internal ? 'lock' : 'send')} ${internal ? 'Guardar nota interna' : 'Enviar a ' + first}`;
  document.querySelector('#a-summary').textContent = internal ? 'Solo el equipo verá esta nota. El cliente no recibe nada.' : n.checked ? `${first} verá este mensaje en su sesión y recibirá un correo.` : `${first} verá este mensaje en su sesión (sin correo).`;
}
function fillCompose(f, text, {append = false} = {}) {
  const cur = f.elements.note.value.trim(); f.elements.audience.value = 'client';
  f.elements.note.value = append && cur && cur !== text ? cur + '\n\n' + text : text; syncCompose(f);
}
// Choosing a state moves the stage to what makes sense, so the two can never contradict each other.
function syncStage(f) { const v = f.elements.status.value; if (v === 'completed' || v === 'review') f.elements.stage.value = '5'; else if (v === 'paid') f.elements.stage.value = '0'; else if (v === 'in_production' && Number(f.elements.stage.value) === 5) f.elements.stage.value = '3'; }
document.addEventListener('input', e => {
  const f = e.target.closest('#update'); if (f) syncCompose(f);
  if (e.target.id === 'a-q') { query = e.target.value; renderBoard(); clearTimeout(searchTimer); searchTimer = setTimeout(() => list(query, true).catch(err => tell(err.message, true)), 350); }
});
document.addEventListener('change', e => {
  const f = e.target.closest('#update'); if (f) { if (e.target.name === 'status') syncStage(f); syncCompose(f); } });

// Uploads: checked before sending, with real progress and a readable error.
function sendForm(action, fd, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); x.open('POST', 'api.php?action=' + action); x.setRequestHeader('X-CSRF-Token', boot.csrf);
    if (onProgress) x.upload.onprogress = e => e.lengthComputable && onProgress(Math.round(e.loaded / e.total * 100));
    x.onerror = () => reject(Error('Sin conexión con el servidor. Revisa tu internet e inténtalo de nuevo.'));
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {}
      if (x.status >= 200 && x.status < 300) return Object.keys(j).length ? resolve(j) : reject(Error('El servidor no confirmó que se guardara. Revisa y vuelve a intentarlo.'));
      if (x.status === 401) { stash(); login(); return reject(Error('Tu sesión expiró. Entra de nuevo y seguimos donde ibas.')); }
      reject(Error(j.error || (x.status === 413 ? 'El archivo es demasiado grande para este formulario.' : 'No se pudo completar la acción. Inténtalo de nuevo.'))); };
    x.send(fd);
  });
}
// A session that expires mid-sentence must not eat the message.
function stash() { try { if (order && document.querySelector('#update')) sessionStorage.setItem(draftKey, JSON.stringify({ref: order.reference, ...readDraft()})); } catch {} }
async function resumeDraft() { try { const d = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); if (!d) return false; sessionStorage.removeItem(draftKey); await detail(d.ref, d); tell('Recuperamos tu mensaje. Revísalo y envíalo.'); return true; } catch { return false; } }
const origLogin = login;

document.addEventListener('click', async e => {
  const btn = e.target.closest('button'); if (!btn) return;
  try {
    if (btn.dataset.adminPage) { btn.dataset.adminPage === 'music' ? await musicList() : btn.dataset.adminPage === 'growth' ? await growth.render() : await list(); return; }
    if (btn.dataset.musicEdit) { await musicList(btn.dataset.musicEdit); return; }
    if (btn.dataset.filter) { const k = btn.dataset.filter; filter = filter === k ? 'all' : k; shown = PAGE; renderBoard(); document.querySelector(`[data-filter="${k}"]`)?.focus(); return; }
    if (btn.dataset.more !== undefined) { shown += PAGE; renderBoard(); return; }
    if (btn.dataset.template) { const f = document.querySelector('#update'); fillCompose(f, btn.dataset.template, {append: true}); f.elements.note.focus(); return; }
    if (btn.dataset.attend !== undefined) {
      btn.disabled = true; await api('admin-update', {reference: order.reference, status: order.status, stage: Number(order.production_stage), note: 'Atendida sin mensaje: se resolvió por otro medio.', visible: false, notify: false, attention: false});
      await detail(order.reference); tell('Quitada de «por atender».'); return;
    }
    if (btn.dataset.next !== undefined) {
      const a = nextActions(order)[Number(btn.dataset.next)], f = document.querySelector('#update'); if (!a || a.blocked) return;
      f.elements.status.value = a.status; f.elements.stage.value = String(a.stage); fillCompose(f, a.text || '', {append: !!a.reply}); f.elements.notify.checked = true; f.elements.attention.checked = false; syncCompose(f);
      f.scrollIntoView({behavior: reduced() ? 'auto' : 'smooth', block: 'start'}); f.elements.note.focus({preventScroll: true});
      tell(a.reply ? 'Escribe tu respuesta y pulsa «Enviar».' : 'Revisa el mensaje y pulsa «Enviar».'); return;
    }
    if (btn.dataset.lab) {
      btn.disabled = true;
      try { if (btn.dataset.lab === 'sync') { const r = await api('admin-sync', {reference: order.reference}); tell('Estado según Wompi: ' + (LABEL[r.status] || r.status)); } if (btn.dataset.lab === 'kit') { const r = await api('admin-test-kit', {reference: order.reference}); tell(r.added + ' archivos de prueba añadidos.'); } await detail(order.reference, readDraft()); } finally { btn.disabled = false; }
      return;
    }
    if (btn.dataset.order) { await detail(btn.dataset.order); window.scrollTo({top: 0}); focusTitle(); return; }
    if (btn.id === 'back') { await list(query); window.scrollTo({top: boardScroll}); focusTitle(); }
  } catch (err) { tell(err.message, true); }
});
document.addEventListener('submit', async e => {
  e.preventDefault(); const f = e.target, b = f.querySelector('button.primary'), d = Object.fromEntries(new FormData(f)), idle = b?.innerHTML; if (b) b.disabled = true;
  const say = m => { const el = f.querySelector('.form-error'); if (el) el.textContent = m; tell(m, true); };
  try {
    if (f.id === 'music-form') { const fd = new FormData(f); fd.set('published', f.elements.published.checked ? '1' : '0'); await sendForm('admin-music-save', fd); await musicList(); tell('Catálogo actualizado.'); }
    if (f.id === 'login') { await api('login', d); if (!(await resumeDraft())) await list(); }
    if (f.id === 'search') await list(d.q);
    if (f.id === 'update') {
      const internal = d.audience === 'internal', note = d.note.trim(), first = order.customer.name.split(' ')[0];
      if (note.length < 3) { say('Escribe un mensaje de al menos 3 letras.'); f.elements.note.focus(); return; }
      if (d.status === 'cancelled' && order.status !== 'cancelled' && !confirm(`¿Cancelar la sesión de ${order.customer.name}? No se puede deshacer.`)) return;
      if (!internal && d.status === 'completed' && !confirm(`Vas a marcar la sesión como entregada y avisar a ${first}. ¿Continuar?`)) return;
      f.querySelector('.form-error').textContent = ''; b.textContent = 'Guardando…';
      await api('admin-update', {reference: order.reference, status: d.status, stage: Number(d.stage), note, visible: !internal, notify: !internal && f.elements.notify.checked, attention: f.elements.attention.checked});
      const sent = internal ? 'Nota interna guardada.' : f.elements.notify.checked ? `Mensaje enviado a ${first} y correo en camino.` : `Mensaje publicado en la sesión de ${first}.`;
      try { await detail(order.reference); tell(sent); } catch { f.elements.note.value = ''; tell(sent + ' No pude refrescar la pantalla: recárgala.'); }
    }
    if (f.id === 'quote') { await api('admin-quote', {reference: order.reference, amount: Math.round(Number(d.amount) * 100), scope: d.scope}); await detail(order.reference); tell('Propuesta guardada. Correo en cola.'); }
  } catch (error) { say(error.message); } finally { if (b && b.isConnected) { b.disabled = false; if (idle) b.innerHTML = idle; } }
});
document.querySelector('#logout').onclick = async () => { await api('logout', {}); location.reload(); };
try { boot = await api('bootstrap'); configureUploads({getCsrf: () => boot.csrf, setCsrf: t => { boot.csrf = t; }, config: boot.uploads, onBatchDone: ref => (order?.reference === ref && !uploadsBusy(ref) ? detail(ref, readDraft()).catch(() => {}) : undefined)}); if (boot.admin) await list(); else login(); } catch (e) { root.innerHTML = `<div class="a-empty"><p><b>No se pudo conectar con el estudio.</b></p><p class="a-muted">${esc(e.message)}</p><button class="primary" id="retry">Reintentar</button></div>`; document.querySelector('#retry').onclick = () => location.reload(); }

async function musicList(id=''){
 const tracks=(await api('admin-music')).tracks;const t=tracks.find(t=>t.id===id);document.querySelector('#logout').hidden=false;
 root.innerHTML=`${adminNav('music')}<div class="eyebrow">FROMHEARTBEAT ORIGINALS</div><h1>La música del estudio.</h1><p class="form-note">Esta colección es pública. Los archivos privados de un cliente se entregan desde su pedido.</p><div class="admin-music-layout"><section><h2>${tracks.length} canciones</h2><div class="catalog-admin-list">${tracks.sort((a,b)=>a.position-b.position).map(t=>`<button data-music-edit="${esc(t.id)}" class="catalog-admin-track"><img src="${esc(t.cover)}" alt=""><span><strong>${esc(t.name)}</strong><small>${esc(t.genre)} · ${t.published?'Publicada':'Oculta'}</small></span><span>Editar ↗</span></button>`).join('')}</div></section><form id="music-form" class="admin-card"><h2>${t?'Editar canción':'Añadir canción'}</h2><input type="hidden" name="track_id" value="${esc(t?.id||'')}"><label class="field">Título<input name="name" required maxlength="120" value="${esc(t?.name||'')}"></label><label class="field">Género / descripción corta<input name="genre" required maxlength="120" value="${esc(t?.genre||'')}"></label><label class="field">Historia de la canción<textarea name="dedication" maxlength="300">${esc(t?.dedication||'')}</textarea></label><label class="field">Orden en la colección<input name="position" type="number" min="0" max="10000" value="${t?.position??tracks.length}" required></label><label class="field">Audio MP3 o WAV · máximo 50 MB<input type="file" name="audio" accept="audio/mpeg,audio/wav,audio/x-wav" ${t?'':'required'}></label><label class="field">Portada JPG, PNG o WebP · máximo 5 MB<input type="file" name="cover" accept="image/jpeg,image/png,image/webp" ${t?'':'required'}></label>${t?'<p class="form-note">Deja los archivos vacíos para conservar el audio y la portada actuales.</p>':''}<label class="check"><input type="checkbox" name="published" ${!t||t.published?'checked':''}>Publicar en el reproductor del estudio</label><button class="primary full-width">Guardar canción ↑</button><p class="form-error" role="alert"></p>${t?'<button type="button" class="secondary" data-admin-page="music">Añadir otra canción</button>':''}</form></div>`;
}
