// Cargador de archivos de la sesión (cliente y estudio). El estado vive AQUÍ, no en el HTML: la sesión se vuelve a pintar
// cuando llegan novedades y una subida en curso no debe perderse. Cada vez que se pinta la pantalla se llama a mount().
//
// Cola → (reducir en el dispositivo) → subir por fragmentos con reintentos → registrar. Hasta 2 subidas a la vez y 1 reducción.
import {prepareFile, PRESETS, DEFAULT_PRESET, kindOf, fmtBytes, videoSupport} from './media-prep.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
const SVG = {
  up: '<path d="M12 16V4M7 9l5-5 5 5M5 20h14"/>', image: '<rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M4 18l5-5 4 4 3-3 4 4"/>',
  video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="M16 10l5-3v10l-5-3z"/>', audio: '<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>',
  retry: '<path d="M4 12a8 8 0 1 0 3-6.2M4 4v5h5"/>', trash: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>', down: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>', bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
};
const ic = (n, c = '') => `<svg class="u-ic ${c}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${SVG[n] || SVG.file}</svg>`;
const ICON_FOR = {image: 'image', video: 'video', audio: 'audio'};
const kindOfMime = m => String(m).startsWith('image/') ? 'image' : String(m).startsWith('video/') ? 'video' : String(m).startsWith('audio/') ? 'audio' : 'other';

const S = {saved: new Map(), items: [], seq: 0, mounts: new Set(), cfg: {maxFileBytes: 1024 * 1048576, maxFiles: 120, chunkBytes: 4194304}, ctx: {}, preset: DEFAULT_PRESET, doneTimers: new Map()};
try { const p = localStorage.getItem('fhb.preset'); if (p && PRESETS[p]) S.preset = p; } catch { /* sin almacenamiento */ }

/** ctx: {getCsrf(), setCsrf(t), config, onFileDone(row), onBatchDone(ref)} */
export function configure(ctx) { S.ctx = ctx; if (ctx.config) S.cfg = {...S.cfg, ...ctx.config}; }
export const busy = ref => S.items.some(i => (!ref || i.ref === ref) && ['queued', 'preparing', 'ready', 'uploading'].includes(i.status));

// ------------------------------------------------------------------------------------------------------------ red
const sleep = ms => new Promise(r => setTimeout(r, ms));
const waitOnline = async () => { while (navigator.onLine === false) await new Promise(r => addEventListener('online', r, {once: true})); };
class Fatal extends Error {}
async function refreshCsrf() { let r; try { r = await fetch('api.php?action=bootstrap', {credentials: 'same-origin'}); } catch { throw new Fatal(OFFLINE); } const j = await r.json(); if (j.csrf) S.ctx.setCsrf?.(j.csrf); return j.csrf; }
const OFFLINE = 'Sin conexión con el estudio. Revisa tu internet y vuelve a intentarlo.';
async function json(action, body, query = '') {
  for (let again = 0; ; again++) {
    let r; try { r = await fetch('api.php?action=' + action + query, {method: 'POST', credentials: 'same-origin', headers: {'Content-Type': 'application/json', 'X-CSRF-Token': S.ctx.getCsrf()}, body: JSON.stringify(body)}); } catch { throw new Fatal(OFFLINE); }
    const j = await r.json().catch(() => ({}));
    if (r.status === 403 && again === 0 && /sesi[oó]n venci/i.test(j.error || '')) { await refreshCsrf(); continue; }
    if (!r.ok) { const e = new Error(j.error || 'No se pudo completar la solicitud.'); e.status = r.status; throw e; }
    return j;
  }
}
function sendChunk(item, blob, offset, onBytes) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest(); item.xhr = x;
    x.open('POST', `api.php?action=upload-chunk&id=${item.uploadId}&offset=${offset}`); x.setRequestHeader('X-CSRF-Token', S.ctx.getCsrf()); x.setRequestHeader('Content-Type', 'application/octet-stream');
    x.upload.onprogress = e => e.lengthComputable && onBytes(e.loaded);
    x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch { /* cuerpo vacío */ } resolve({status: x.status, json: j}); };
    x.onerror = x.ontimeout = () => reject(new Error('red')); x.onabort = () => reject(Object.assign(new Error('abort'), {name: 'AbortError'}));
    x.timeout = 120000; x.send(blob);
  });
}

async function upload(item) {
  const blob = item.out, size = blob.size;
  await waitOnline();
  const init = await json('upload-init', {reference: item.ref, name: item.outName, size, kind: item.kind});
  item.uploadId = init.id; const top = Math.min(init.chunk || S.cfg.chunkBytes, S.cfg.chunkBytes);
  let chunk = top, off = 0, fails = 0; // con mala señal el fragmento se achica (mín. 256 KB) y vuelve a crecer cuando mejora
  while (off < size) {
    if (item.status === 'canceled') throw Object.assign(new Error('c'), {name: 'AbortError'});
    await waitOnline();
    const end = Math.min(size, off + chunk);
    try {
      const r = await sendChunk(item, blob.slice(off, end), off, n => { item.sent = off + n; emit('progress', item); });
      if (r.status === 200) { off = r.json.received; item.sent = off; fails = 0; chunk = Math.min(top, chunk * 2); emit('progress', item); continue; }
      if (r.status === 403 && /sesi[oó]n venci/i.test(r.json.error || '')) { await refreshCsrf(); continue; }
      if (r.status === 409) { off = (await status(item)); continue; }
      if (r.status >= 400 && r.status < 500 && ![400, 408, 429].includes(r.status)) throw new Fatal(r.json.error || 'El estudio no pudo recibir el archivo.');
      throw new Error('servidor ' + r.status);
    } catch (e) {
      if (e instanceof Fatal || e.name === 'AbortError') throw e;
      chunk = Math.max(262144, chunk >> 1);
      if (++fails > 6) throw new Fatal('Se perdió la conexión. Toca «Reintentar» cuando vuelva.');
      item.warn = 'Reconectando…'; emit('progress', item); await sleep(Math.min(1000 * 2 ** (fails - 1), 12000)); item.warn = '';
      try { off = await status(item); } catch { /* seguirá reintentando */ }
    }
  }
  const done = await json('upload-finish', {id: item.uploadId});
  return done.file;
}
async function status(item) { let r; try { r = await fetch(`api.php?action=upload-status&id=${item.uploadId}`, {credentials: 'same-origin'}); } catch { throw new Error('red'); } const j = await r.json(); if (!r.ok) throw new Fatal(j.error || 'La subida ya no existe.'); return j.received; }

// ------------------------------------------------------------------------------------------------------------ cola
const OK_EXT = /\.(jpe?g|png|webp|gif|heic|heif|avif|mp4|m4v|mov|webm|3gp|mkv|mp3|wav|m4a|aac|ogg|opus|flac|aiff?|pdf|txt)$/i;
export function add(ref, files, {kind = 'source', role = 'customer', compress = role === 'customer'} = {}) {
  const rejected = [];
  for (const f of files) {
    const k = kindOf(f), okType = k !== 'other' || /\.(pdf|txt)$/i.test(f.name) || f.type === 'application/pdf' || f.type === 'text/plain' || (role === 'admin' && /\.zip$/i.test(f.name));
    if (!okType || (k === 'other' && !OK_EXT.test(f.name) && !(role === 'admin' && /\.zip$/i.test(f.name)))) { rejected.push(`${f.name}: formato no admitido (usa foto, video, audio, PDF o texto)`); continue; }
    if (f.size === 0) { rejected.push(`${f.name}: está vacío`); continue; }
    const cap = role === 'customer' && compress && k === 'video' ? 3 * 1024 * 1048576 : S.cfg.maxFileBytes; // un video se reduce antes de enviarse
    if (f.size > cap) { rejected.push(`${f.name}: supera ${fmtBytes(cap)}`); continue; }
    if (S.items.some(i => i.ref === ref && i.kind === kind && i.file.name === f.name && i.file.size === f.size && !['done', 'error', 'canceled'].includes(i.status))) continue;
    S.items.push({id: ++S.seq, ref, kind, role, compress, file: f, name: f.name, k, status: 'queued', prog: 0, sent: 0, phase: '', note: '', thumb: '', preset: compress ? S.preset : 'original'});
    makeThumb(S.items[S.items.length - 1]);
  }
  S.saved.delete(ref); clearTimeout(S.doneTimers.get(ref)); emit('structure'); pump();
  return rejected;
}
async function makeThumb(item) {
  if (item.k !== 'image' || item.file.size > 40 * 1048576) return;
  try { // sólo data: URLs (la política de seguridad no permite blob:)
    const b = await createImageBitmap(item.file, {imageOrientation: 'from-image', resizeWidth: 120, resizeHeight: Math.round(120 * 0.75), resizeQuality: 'low'});
    const c = document.createElement('canvas'); c.width = b.width; c.height = b.height; c.getContext('2d').drawImage(b, 0, 0); b.close?.();
    item.thumb = c.toDataURL('image/jpeg', 0.6); emit('structure');
  } catch { /* sin vista previa */ }
}
export function cancel(id) {
  const i = S.items.find(x => x.id === id); if (!i) return;
  const was = i.status; i.status = 'canceled'; i.abort?.abort(); i.xhr?.abort();
  if (i.uploadId && was !== 'done') json('upload-cancel', {id: i.uploadId}).catch(() => {});
  emit('structure'); pump();
}
export function retry(id) { const i = S.items.find(x => x.id === id); if (!i) return; if (i.uploadId) json('upload-cancel', {id: i.uploadId}).catch(() => {}); Object.assign(i, {status: i.out ? 'ready' : 'queued', error: '', sent: 0, uploadId: ''}); emit('structure'); pump(); }
export function dismiss(id) { S.items = S.items.filter(i => i.id !== id || ['queued', 'preparing', 'ready', 'uploading'].includes(i.status)); emit('structure'); }
export function setPreset(p) { if (!PRESETS[p]) return; S.preset = p; try { localStorage.setItem('fhb.preset', p); } catch { /* ok */ } S.items.filter(i => i.status === 'queued' && i.compress).forEach(i => i.preset = p); emit('structure'); }

function pump() {
  const cur = S.items;
  if (!cur.some(i => i.status === 'preparing')) { const n = cur.find(i => i.status === 'queued'); if (n) prep(n); }
  let up = cur.filter(i => i.status === 'uploading').length;
  for (const n of cur.filter(i => i.status === 'ready')) if (up < 2) { up++; send(n); }
  const refs = new Set(cur.map(i => i.ref));
  for (const ref of refs) if (!busy(ref) && cur.some(i => i.ref === ref && i.status === 'done' && !i.reported)) scheduleDone(ref);
}
async function prep(i) {
  i.status = 'preparing'; i.abort = new AbortController(); emit('structure');
  try {
    const r = await prepareFile(i.file, {preset: i.preset, signal: i.abort.signal, onProgress: (p, label) => { i.prog = p; i.phase = label; emit('progress', i); }});
    if (i.status === 'canceled') return;
    i.out = r.blob; i.outName = r.name; i.note = r.note || ''; i.changed = r.changed; i.status = 'ready'; i.prog = 1; i.phase = '';
    if (i.out.size > S.cfg.maxFileBytes) { i.status = 'error'; i.error = `Pesa ${fmtBytes(i.out.size)} y el máximo es ${fmtBytes(S.cfg.maxFileBytes)}. Prueba con «Ligero».`; i.out = null; }
  } catch (e) { if (i.status !== 'canceled') { i.out = i.file; i.outName = i.file.name; i.status = 'ready'; } }
  emit('structure'); pump();
}
async function send(i) {
  i.status = 'uploading'; i.sent = 0; i.error = ''; emit('structure');
  try { i.row = await upload(i); i.status = 'done'; S.ctx.onFileDone?.(i.row, i); }
  catch (e) { if (i.status !== 'canceled') { i.status = 'error'; i.error = e.message || 'No se pudo enviar.'; if (i.uploadId && e instanceof Fatal && !/conexi/i.test(e.message)) json('upload-cancel', {id: i.uploadId}).catch(() => {}); } }
  emit('structure'); pump();
}
function scheduleDone(ref) {
  clearTimeout(S.doneTimers.get(ref));
  S.doneTimers.set(ref, setTimeout(async () => {
    if (busy(ref)) return;
    const fresh = S.items.filter(i => i.ref === ref && i.status === 'done' && !i.reported); if (!fresh.length) return;
    fresh.forEach(i => i.reported = true);
    if (fresh.some(i => i.role === 'customer')) { try { await json('upload-done', {reference: ref}); } catch { /* el aviso es secundario */ } }
    const saved = fresh.reduce((n, i) => n + (i.changed && i.out ? Math.max(0, i.file.size - i.out.size) : 0), 0);
    S.saved.set(ref, `Listo: ${fresh.length} ${fresh.length === 1 ? 'archivo enviado' : 'archivos enviados'}${saved > 1048576 ? ` · te ahorraste ${fmtBytes(saved)} de datos` : ''}.`);
    try { await S.ctx.onBatchDone?.(ref, fresh.length); } catch { /* la lista se actualizará en el siguiente sondeo */ }
    S.items = S.items.filter(i => !fresh.includes(i)); emit('structure'); // ya figuran en «enviados»
  }, 600));
}
addEventListener('beforeunload', e => { if (busy()) { e.preventDefault(); e.returnValue = ''; } });

// ------------------------------------------------------------------------------------------------------------ pintado
let raf = 0, pending = 'progress';
function emit(type) {
  if (type === 'structure') pending = 'structure';
  if (raf) return;
  raf = requestAnimationFrame(() => {
    raf = 0; const t = pending; pending = 'progress';
    for (const m of S.mounts) {
      if (!m.el.isConnected) { S.mounts.delete(m); continue; }
      if (t === 'structure') draw(m); else patch(m);
    }
  });
}
const pct = i => i.status === 'preparing' ? Math.round(i.prog * 100) : i.out?.size ? Math.min(100, Math.round(i.sent / i.out.size * 100)) : 0;
function rowHtml(i) {
  const st = i.status, p = pct(i), icn = ICON_FOR[i.k] || 'file';
  const label = {queued: 'En espera', preparing: `${i.phase || 'Preparando'} · ${p}%`, ready: 'Listo para enviar', uploading: i.warn || `Enviando · ${p}%`, done: i.changed ? 'Reducido y enviado' : 'Enviado', error: i.error || 'No se pudo enviar', canceled: 'Cancelado'}[st];
  const act = st === 'error' ? `<button type="button" class="u-btn" data-u-retry="${i.id}" aria-label="Reintentar ${esc(i.name)}">${ic('retry')}<span>Reintentar</span></button><button type="button" class="u-x" data-u-dismiss="${i.id}" aria-label="Quitar ${esc(i.name)}">${ic('x')}</button>`
    : ['done', 'canceled'].includes(st) ? `<button type="button" class="u-x" data-u-dismiss="${i.id}" aria-label="Quitar de la lista">${ic('x')}</button>`
    : `<button type="button" class="u-x" data-u-cancel="${i.id}" aria-label="Cancelar ${esc(i.name)}">${ic('x')}</button>`;
  const size = i.out && i.out !== i.file ? `${fmtBytes(i.file.size)} → ${fmtBytes(i.out.size)}` : fmtBytes(i.file.size);
  return `<li class="u-row st-${st}" data-u-id="${i.id}"><span class="u-th">${i.thumb ? `<img alt="" src="${i.thumb}">` : ic(icn)}</span>
   <span class="u-main"><b class="u-name">${esc(i.name)}</b><small class="u-sub"><span data-u-label>${esc(label)}</span><span class="u-size">${esc(size)}</span></small>
   ${['preparing', 'uploading'].includes(st) ? `<span class="u-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p}" aria-label="${esc(i.name)}"><i style="width:${p}%"></i></span>` : ''}</span>${act}</li>`;
}
function sentHtml(f, m) {
  const k = kindOfMime(f.mime), mine = m.role === 'admin' || f.kind === 'source';
  const th = k === 'image' ? `<img alt="" loading="lazy" src="api.php?action=file&id=${f.id}">` : ic(ICON_FOR[k] || 'file');
  const canDel = m.role === 'admin' ? !(m.status === 'completed' && f.kind === 'delivery') : (f.kind === 'source' && m.status !== 'completed');
  return `<li class="u-row sent" data-file="${f.id}"><span class="u-th">${th}</span><span class="u-main"><b class="u-name">${esc(f.original_name)}</b><small class="u-sub"><span>${esc(m.role === 'admin' ? (f.kind === 'delivery' ? 'Entrega' : 'Del cliente') : 'En el estudio')}</span><span class="u-size">${fmtBytes(Number(f.size_bytes))}</span></small></span>
   <a class="u-x" href="api.php?action=file&id=${f.id}&download=1" aria-label="Descargar ${esc(f.original_name)}">${ic('down')}</a>${mine && canDel ? `<button type="button" class="u-x" data-u-delete="${f.id}" aria-label="Retirar ${esc(f.original_name)}">${ic('trash')}</button>` : ''}</li>`;
}
function draw(m) {
  const el = m.el, focus = el.contains(document.activeElement) ? document.activeElement.closest('[data-u-cancel],[data-u-retry],[data-u-dismiss],[data-u-delete]') : null;
  const sel = focus && Object.keys(focus.dataset).filter(k => k.startsWith('u')).map(k => `[data-${k.replace(/[A-Z]/g, c => '-' + c.toLowerCase())}="${focus.dataset[k]}"]`)[0];
  drawInner(m);
  if (sel) (el.querySelector(sel) || el.querySelector('[data-u-pick]'))?.focus({preventScroll: true});
}
function drawInner(m) {
  const el = m.el, items = S.items.filter(i => i.ref === m.ref && i.kind === m.kind && i.role === m.role);
  const list = el.querySelector('[data-u-queue]'); if (list) { const h = items.map(rowHtml).join(''); if (list.dataset.h !== h) { list.innerHTML = h; list.dataset.h = h; } }
  const sent = el.querySelector('[data-u-sent]'); const files = (m.files || []).filter(f => m.role === 'customer' ? f.kind === 'source' : (m.kind ? f.kind === m.kind : true));
  if (sent) { const h = files.map(f => sentHtml(f, m)).join(''); if (sent.dataset.h !== h) { sent.innerHTML = h; sent.dataset.h = h; } }
  const count = el.parentElement?.querySelector('[data-u-count]'); if (count) { count.dataset.was ??= count.textContent; count.textContent = files.length ? `${files.length} ${files.length === 1 ? 'enviado' : 'enviados'}` : count.dataset.was; }
  const active = items.some(i => ['queued', 'preparing', 'ready', 'uploading'].includes(i.status));
  el.classList.toggle('is-busy', active);
  const live = el.querySelector('[data-u-live]'); if (live) live.textContent = summary(items) || S.saved.get(m.ref) || '';
  const opt = el.querySelector(`[data-u-preset][value="${S.preset}"]`); if (opt && !opt.checked) opt.checked = true; const hint = el.querySelector('[data-u-hint]'); if (hint) hint.textContent = PRESETS[S.preset]?.hint || '';
}
function summary(items) {
  if (items.length) S.saved.clear();
  const up = items.filter(i => ['queued', 'preparing', 'ready', 'uploading'].includes(i.status)).length, bad = items.filter(i => i.status === 'error').length, ok = items.filter(i => i.status === 'done').length;
  return up ? `Enviando ${up} ${up === 1 ? 'archivo' : 'archivos'}…` : bad ? `${bad} sin enviar. Puedes reintentar.` : ok ? `Listo: ${ok} ${ok === 1 ? 'archivo enviado' : 'archivos enviados'}.` : '';
}
function patch(m) {
  for (const i of S.items) {
    if (i.ref !== m.ref) continue; const row = m.el.querySelector(`[data-u-id="${i.id}"]`); if (!row) continue; const p = pct(i);
    const bar = row.querySelector('.u-bar'); if (bar) { bar.firstElementChild.style.width = p + '%'; bar.setAttribute('aria-valuenow', p); }
    const lab = row.querySelector('[data-u-label]'); if (lab && i.status === 'uploading') lab.textContent = i.warn || `Enviando · ${p}%`; else if (lab && i.status === 'preparing') lab.textContent = `${i.phase || 'Preparando'} · ${p}%`;
  }
}

/** Estructura del cargador. opts: {role, kind, title, help, accept, files, orderStatus} */
export function uploaderHtml(ref, opts = {}) {
  const role = opts.role || 'customer', kind = opts.kind || 'source', admin = role === 'admin';
  const accept = admin ? 'image/*,video/*,audio/*,.wav,.mp3,.m4a,.flac,.pdf,.zip,.txt' : 'image/*,video/*,audio/*,.heic,.heif,.pdf,.txt';
  const presets = !admin && !opts.noCompress ? `<fieldset class="u-preset"><legend>${ic('bolt')} Tamaño de envío</legend><div class="u-seg">${Object.entries(PRESETS).map(([k, v]) => `<label><input type="radio" name="u-preset-${esc(ref)}" value="${k}" data-u-preset${k === S.preset ? ' checked' : ''}><span>${esc(v.label)}</span></label>`).join('')}</div><small data-u-hint>${esc(PRESETS[S.preset]?.hint || '')}</small><small>${esc(videoSupport() ? 'Reducimos fotos, videos y WAV en tu dispositivo. Tus originales no se tocan.' : 'Este navegador no puede reducir videos: se envían tal cual. Las fotos sí se optimizan.')}</small></fieldset>` : '';
  if (opts.listOnly) return `<div class="u ${admin ? 'u-admin' : ''}" data-uploader data-u-ref="${esc(ref)}" data-u-role="${role}" data-u-kind="${esc(kind)}"><ul class="u-list u-sentlist" data-u-sent></ul></div>`;
  return `<div class="u ${admin ? 'u-admin' : ''}" data-uploader data-u-ref="${esc(ref)}" data-u-role="${role}" data-u-kind="${esc(kind)}">
   <div class="u-drop" data-u-drop><input class="u-input" type="file" multiple accept="${accept}" data-u-pick aria-label="${esc(opts.pickLabel || 'Elegir archivos')}">
    <span class="u-drop-ic">${ic('up')}</span><span class="u-drop-t"><b>${esc(opts.pickLabel || 'Elegir fotos, videos o audios')}</b><small>${opts.dropHint ? esc(opts.dropHint) : '<span class="u-or">o arrástralos aquí · </span>puedes elegir varios a la vez'}</small></span></div>
   ${presets}<p class="u-live" role="status" aria-live="polite" data-u-live></p><p class="u-err" role="alert" data-u-err></p>
   <ul class="u-list" data-u-queue></ul><ul class="u-list u-sentlist" data-u-sent></ul></div>`;
}

/** Engancha un contenedor ya pintado al estado global. */
export function mount(el, {ref, role = 'customer', kind = 'source', files = [], status = ''}) {
  for (const m of [...S.mounts]) if (m.el === el || !m.el.isConnected) S.mounts.delete(m);
  const m = {el, ref, role, kind, files, status}; S.mounts.add(m); draw(m);
  if (el.dataset.bound) return; el.dataset.bound = '1';
  const err = msg => { const e = el.querySelector('[data-u-err]'); if (e) e.textContent = msg || ''; };
  const take = fl => { const rej = add(ref, [...fl], {role, kind, compress: role === 'customer'}); err(rej.join(' · ')); };
  const pick = el.querySelector('[data-u-pick]');
  pick?.addEventListener('change', () => { take(pick.files); pick.value = ''; });
  const drop = el.querySelector('[data-u-drop]');
  ['dragenter', 'dragover'].forEach(t => drop?.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop?.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop?.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) take(e.dataTransfer.files); });
  el.querySelectorAll('[data-u-preset]').forEach(r => r.addEventListener('change', () => r.checked && setPreset(r.value)));
  el.addEventListener('click', async e => {
    const b = e.target.closest('[data-u-cancel],[data-u-retry],[data-u-dismiss],[data-u-delete]'); if (!b) return;
    if (b.dataset.uCancel) cancel(+b.dataset.uCancel); else if (b.dataset.uRetry) retry(+b.dataset.uRetry); else if (b.dataset.uDismiss) dismiss(+b.dataset.uDismiss);
    else if (b.dataset.uDelete) {
      const f = (m.files || []).find(x => String(x.id) === b.dataset.uDelete); if (!f) return;
      if (!confirm(`¿Retirar «${f.original_name}»?`)) return;
      b.disabled = true;
      try { await json('file-delete', {id: +b.dataset.uDelete}); S.ctx.onBatchDone?.(ref, 0); } catch (x) { err(x.message); b.disabled = false; }
    }
  });
}
/** Para cuando el pedido se recarga: actualiza lo ya enviado en un cargador existente. */
export function update(el, {files, status}) { for (const m of S.mounts) if (m.el === el) { m.files = files; m.status = status; draw(m); } }

// Soltar un archivo fuera de la zona de envío haría que el navegador lo abra y saque a la persona de su sesión.
['dragover', 'drop'].forEach(t => addEventListener(t, e => { if (e.dataTransfer?.types?.includes('Files') && !e.target.closest?.('[data-u-drop]')) e.preventDefault(); }));
