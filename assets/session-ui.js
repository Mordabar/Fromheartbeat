import {uploaderHtml} from './uploader.js';
// The customer's session, told like a recording session: where the song is, what happens next, what (if anything) is on you,
// and the producer's messages as a conversation instead of a log. Pure markup: app.js owns the events.
export const STAGE_INFO = [
  ['Historia recibida', 'Tu historia llegó al estudio y un productor la lee completa.'],
  ['Letra', 'Convertimos tu historia en letra y melodía.'],
  ['Grabación', 'Se graban la voz y los instrumentos.'],
  ['Producción', 'Armamos los arreglos y le damos carácter al sonido.'],
  ['Mezcla y máster', 'Equilibramos cada pista para que suene como en la radio.'],
  ['Entrega', 'Tu canción queda lista para escuchar y descargar.'],
];

// The essential package (Dedicatoria) does not promise mixing and mastering: its fifth stage reads as a final review.
export const stageInfoFor = o => o?.product_code === 'dedicatoria' ? STAGE_INFO.map((x, i) => i === 4 ? ['Revisión final', 'Hacemos una última revisión de calidad antes de entregarte tu canción.'] : x) : STAGE_INFO;
// One look per state, used everywhere (hero, list, 3D terminal, admin): colour + icon + the words a stranger understands.
export const STATE = {
  created: {tone: 'pay', icon: 'card', label: 'Falta el pago', title: 'Tu historia está guardada', says: 'Completa el pago para que el estudio empiece a trabajar en tu canción.'},
  payment_pending: {tone: 'pay', icon: 'clock', label: 'Confirmando el pago', title: 'Estamos confirmando tu pago', says: 'Si ya pagaste, espera un minuto: esta pantalla se actualiza sola. Si cerraste la ventana del pago, ábrela de nuevo.'},
  paid: {tone: 'make', icon: 'check', label: 'Pago recibido', title: 'Pago recibido. ¡Bienvenido al estudio!', says: 'Un productor va a leer tu historia. Te avisamos por correo y aquí mismo en cuanto empiece.'},
  in_production: {tone: 'make', icon: 'music', label: 'En producción', title: 'Estamos creando tu canción', says: ''},
  review: {tone: 'review', icon: 'headphones', label: 'Te toca escuchar', title: 'Tu canción está lista para escucharla', says: 'Escúchala con calma. Si quieres cambiar algo, escríbeselo al productor aquí abajo.'},
  completed: {tone: 'done', icon: 'star', label: 'Entregada', title: 'Tu canción está lista', says: 'Es tuya. Escúchala, descárgala y compártela con quien la merece.'},
  cancelled: {tone: 'off', icon: 'close', label: 'Cancelada', title: 'Esta sesión fue cancelada', says: 'Si fue un error, escríbenos y la retomamos.'},
};

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const parseDate = s => new Date(String(s).replace(' ', 'T') + (String(s).endsWith('Z') ? '' : 'Z'));
export function ago(date, now = Date.now()) {
  const d = (now - date.getTime()) / 1000;
  if (d < 90) return 'hace un momento';
  if (d < 3600) return `hace ${Math.round(d / 60)} min`;
  if (d < 86400) return `hace ${Math.round(d / 3600)} h`;
  if (d < 172800) return 'ayer';
  if (d < 86400 * 8) return `hace ${Math.floor(d / 86400)} días`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

// Who wrote it: the producer, the customer, or the system (payments, files).
export const who = actor => actor === 'customer' ? 'me' : String(actor).startsWith('admin') ? 'studio' : 'system';

export const QUICK_REPLIES = ['¡Me encanta! No cambiaría nada', 'Quisiera ajustar el ritmo', 'Quisiera cambiar una parte de la letra', 'Tengo una duda'];
const QUICK_FOR = (o) => o.status === 'in_production' ? ['Tengo una duda', 'Quiero añadir un detalle a mi historia'] : o.product_code === 'dedicatoria' ? [QUICK_REPLIES[0], QUICK_REPLIES[3]] : QUICK_REPLIES;

// `part` picks what to show: everything (the plain-text session), only the conversation, or only the material uploader.
const kb = b => b >= 1048576 ? (b / 1048576 >= 10 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1)) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
// What a file is, in plain words, with its icon and colour: «Canción · MP3», «Portada», «Video»…
export const fileLook = f => /mpeg|mp3/.test(f.mime) ? ['Canción · MP3', 'Para escuchar y compartir', 'music', 'pink'] : /wav/.test(f.mime) ? ['Master · WAV', 'Calidad de estudio', 'star', 'violet'] : f.mime.startsWith('audio/') ? ['Audio', 'Otra versión de tu canción', 'music', 'pink'] : f.mime.startsWith('image/') ? ['Portada', 'La imagen de tu canción', 'sparkle', 'gold'] : f.mime.startsWith('video/') ? ['Video', 'Listo para redes', 'play', 'cyan'] : ['Archivo', 'Material de tu entrega', 'gift', 'violet'];
export const downloadCards = (files, {esc, ic}) => `<div class="s-dls">${files.map(f => { const [name, sub, icon, tone] = fileLook(f); return `<a class="s-dl t-${tone}" href="api.php?action=file&id=${f.id}&download=1" aria-label="Descargar ${esc(name)}: ${esc(f.original_name)}, ${kb(Number(f.size_bytes))}"><span class="s-dl-ic" aria-hidden="true">${ic(icon)}</span><span class="s-dl-tx"><b>${esc(name)}</b><small>${esc(f.original_name)} · ${kb(Number(f.size_bytes))}</small></span><span class="s-dl-btn">${ic('arrow', 'down')}Descargar</span></a>`; }).join('')}</div>`;
// What the person with a gift link sees: the song, who it is for, and the files. Nothing else exists for them.
export function giftMarkup(o, {esc, ic}) {
  const delivery = (o.files || []).filter(f => f.kind === 'delivery'), audio = delivery.filter(f => f.mime.startsWith('audio/')).slice().reverse().sort((a, b) => (b.mime === 'audio/mpeg') - (a.mime === 'audio/mpeg')), cover = delivery.filter(f => f.mime.startsWith('image/')).pop();
  const to = o.brief?.recipient ? `Para ${esc(o.brief.recipient)}` : 'Una canción para ti', from = o.customer?.name ? `De parte de ${esc(o.customer.name)}` : 'Alguien pensó en ti';
  const body = audio.length ? audio.map((f, i) => `<article class="s-track${i ? ' old' : ''}">${i === 0 && cover ? `<img src="api.php?action=file&id=${cover.id}" alt="Portada de la canción">` : `<div class="s-cover" aria-hidden="true">${ic('music')}</div>`}
      <div class="s-track-body"><small>${i === 0 ? 'CANCIÓN' : 'OTRA VERSIÓN'}</small><strong>${esc(f.original_name)}</strong><audio controls preload="none" aria-label="${esc(f.original_name)}" src="api.php?action=file&id=${f.id}"></audio></div></article>`).join('')
    : '<p class="s-says">La canción todavía se está terminando. Vuelve en un rato con este mismo enlace.</p>';
  return `<div class="s-wrap"><section class="s-hero tone-done"><div class="s-badge" aria-hidden="true">${ic('heart')}</div><div class="s-hero-text"><p class="s-eyebrow">${from}</p><h1 id="panel-title">${to}</h1><p class="s-says">${o.brief?.occasion ? esc(o.brief.occasion) + ' · ' : ''}Una canción hecha a mano en Fromheartbeat.</p></div></section>
    <section class="s-room"><h2 class="s-h"><span>Escúchala</span><b>Un regalo</b></h2>${body}
    ${delivery.length ? downloadCards(delivery, {esc, ic}) : ''}</section>
    <section class="s-card"><p class="s-says">¿Te gustó? Cuenta tu propia historia y la convertimos en canción.</p><button class="primary" data-go="resume">${ic('sparkle')} Crear mi canción</button></section></div>`;
}
export function sessionMarkup(o, {esc, money, ic, boot, testCard, now = Date.now(), part = 'all'}) {
  const st = STATE[o.status] || STATE.created, SI = stageInfoFor(o);
  // While the customer reviews or has received the song, the studio is at the last stage whatever the admin left selected.
  const stage = ['review', 'completed'].includes(o.status) ? 5 : Number(o.production_stage) || 0, dead = o.status === 'cancelled';
  const pending = ['created', 'payment_pending', 'cancelled'].includes(o.status), waiting = o.status === 'payment_pending' && boot.commerceReady;
  const delivery = o.files.filter(f => f.kind === 'delivery'), audio = delivery.filter(f => f.mime.startsWith('audio/')).slice().reverse().sort((a, b) => (b.mime === 'audio/mpeg') - (a.mime === 'audio/mpeg'));
  const cover = delivery.find(f => f.mime.startsWith('image/')), others = delivery.filter(f => !f.mime.startsWith('audio/'));
  const says = o.status === 'in_production' ? (stage === 5 ? 'Estamos en el último paso: preparamos la entrega de tu canción.' : SI[stage][1]) : st.says;
  const last = o.history.length ? parseDate(o.history[o.history.length - 1].created_at) : null;
  const canTalk = ['in_production', 'review', 'completed'].includes(o.status);

  const sentSources = o.files.filter(f => f.kind === 'source').length, needsMaterial = o.product_code === 'full' && !sentSources && ['paid', 'in_production'].includes(o.status);
  // 1. Hero: the one thing to know right now, and the one thing to do.
  let action = '';
  if (pending && boot.commerceReady) action = `<button id="resume-payment" class="primary big">${ic('lock')} ${waiting ? 'Abrir el pago otra vez' : 'Ir al pago seguro'}</button>`;
  else if (pending) action = '<p class="s-note">Los pagos en línea se están configurando: te avisaremos por correo para completarlo.</p>';
  else if (o.status === 'review' && audio.length) action = '<a class="primary big" href="#s-room">' + ic('play') + ' Escuchar mi canción</a>';
  else if (o.status === 'completed' && audio.length) action = '<a class="primary big" href="#s-room">' + ic('play') + ' Escuchar y descargar</a>';
  else if (needsMaterial) action = `<a class="primary big" href="#s-upload">${ic('gift')} Subir mis fotos y videos</a><p class="s-note">${ic('check')} Tu video las necesita. Lo demás lo hacemos nosotros y te avisamos por correo.</p>`;
  else if (o.status === 'in_production' || o.status === 'paid') action = '<p class="s-note">' + ic('check') + ' No tienes que hacer nada. Te avisamos por correo en cada avance.</p>';
  if (boot.support && (dead || ['created', 'payment_pending', 'paid'].includes(o.status))) action += `<a class="s-help" href="mailto:${esc(boot.support)}?subject=${encodeURIComponent('Sesión ' + o.reference)}">${ic('mail')} ${dead ? 'Escribir al estudio' : '¿Necesitas ayuda? Escríbenos'}</a>`;
  const coverFile = delivery.filter(f => f.mime.startsWith('image/')).pop(), to = o.brief?.recipient ? `Para ${esc(o.brief.recipient)}` : esc(o.product_name);
  const hero = `<section class="s-hero tone-${st.tone}" aria-labelledby="panel-title">
    <div class="s-hero-top">${coverFile ? `<img class="s-cover-lg" src="api.php?action=file&id=${coverFile.id}" alt="Portada de tu canción">` : `<div class="s-badge" aria-hidden="true">${ic(st.icon, waiting ? 'spin' : '')}</div>`}
    <div class="s-hero-text"><p class="s-eyebrow">${esc(st.label)}</p><h1 id="panel-title">${esc(st.title)}</h1><p class="s-says">${esc(says)}</p></div></div>
    <div class="s-hero-action">${action}</div>
    <p class="s-meta"><span class="s-pill">${ic('music')} ${esc(o.product_name)}</span>${last ? `<span class="s-pill dim">${esc(ago(last, now))}</span>` : ''}<button id="refresh-order" class="s-link" aria-label="Actualizar el estado">${ic('refresh')}</button></p>
    <p class="form-error" id="payment-error" role="alert"></p>
  </section>${pending ? testCard() : ''}`;
  // Quick actions: the four things this screen is for, one tap each (the same ones the 3D room offers).
  const needsM = needsMaterial, tile = (href, icon, label, sub, tone, attr = '') => `<${attr ? 'button' : 'a'} class="s-tile t-${tone}" ${attr || `href="${href}"`}><span class="s-tile-ic" aria-hidden="true">${ic(icon)}</span><b>${label}</b><small>${sub}</small></${attr ? 'button' : 'a'}>`;
  const sharable = ['review', 'completed'].includes(o.status) && audio.length;
  const tiles = pending ? '' : `<nav class="s-tiles" aria-label="Qué quieres hacer">${[
    audio.length ? tile('#s-room', 'play', 'Escuchar', 'tu canción', 'pink') : '',
    canTalk ? tile('#s-chat', 'mail', 'Mensajes', 'con tu productor', 'cyan') : '',
    ['paid', 'in_production', 'review', 'completed'].includes(o.status) ? tile('#s-upload', 'gift', needsM ? 'Subir fotos' : 'Material', needsM ? 'tu video las necesita' : 'fotos, audios, videos', needsM ? 'gold-hot' : 'gold') : '',
    sharable ? tile('', 'heart', 'Compartir', 'con un enlace', 'mint', 'data-share') : '',
  ].join('')}</nav>`;

  // 2. The production line: six stages, the current one lit, each in plain words.
  const line = `<section class="s-line" aria-label="Avance de tu canción"><h2 class="s-h"><span>En qué punto estamos</span><b>${dead ? 'Sin avance' : pending ? 'Aún no empieza' : o.status === 'completed' ? 'Completado' : `Etapa ${stage + 1} de 6`}</b></h2>
    <div class="s-meter" role="img" aria-label="${dead ? 'La sesión fue cancelada' : pending ? 'La producción aún no empieza' : `Etapa ${stage + 1} de 6: ${SI[stage][0]}`}">${STAGE_INFO.map((_, i) => `<i class="${o.status === 'completed' || (!pending && i < stage) ? 'on' : !pending && i === stage ? 'now' : ''}"></i>`).join('')}</div>
    <details class="s-detail"><summary>Ver el detalle de cada etapa</summary><ol class="s-stages">${SI.map(([name, text], i) => {
      const state = o.status === 'completed' || (!pending && i < stage) ? 'done' : !pending && i === stage ? 'now' : 'next';
      return `<li class="${state}"${state === 'now' ? ' aria-current="step"' : ''}><span class="s-dot" aria-hidden="true">${state === 'done' ? ic('check') : i + 1}</span><div><b>${esc(name)}</b><small>${state === 'now' ? esc(o.status === 'review' && i === 5 ? 'Escucha tu canción y dinos si cambiarías algo.' : text) : state === 'done' ? 'Listo' : 'Pronto'}</small></div></li>`;
    }).join('')}</ol></details></section>`;

  // 3. Listening room: the song first, the versions and files after.
  const sourceFiles = o.files.filter(f => f.kind === 'source');
  const room = delivery.length ? `<section id="s-room" class="s-room"><h2 class="s-h"><span>${o.product.listening ? 'Sala de escucha' : 'Tu entrega'}</span><b>${['review', 'completed'].includes(o.status) && audio.length ? `<button class="s-link" data-share>${ic('heart')} Compartir esta canción</button>` : 'Solo tú puedes escuchar esto'}</b></h2>
    ${audio.map((f, i) => `<article class="s-track${i ? ' old' : ''}">${i === 0 && cover ? `<img src="api.php?action=file&id=${cover.id}" alt="Portada de tu canción">` : `<div class="s-cover" aria-hidden="true">${ic('music')}</div>`}
      <div class="s-track-body"><small>${i === 0 ? 'CANCIÓN' : 'OTRA VERSIÓN'}</small><strong>${esc(f.original_name)}</strong><audio controls preload="none" aria-label="${i === 0 ? 'Canción' : 'Otra versión'}: ${esc(f.original_name)}" src="api.php?action=file&id=${f.id}"></audio></div></article>`).join('')}
    ${downloadCards(delivery, {esc, ic})}</section>`
    : pending ? '' : `<section class="s-room empty"><h2 class="s-h"><span>Tu canción</span><b>Aparecerá aquí</b></h2><p class="s-says">Cuando esté lista, la escucharás en este mismo lugar, sin salir de la sesión.</p></section>`;

  // 4. The producer's messages as a conversation. Newest first; the system's own events stay small.
  const all = o.history.filter(h => !/^(Versión disponible|Archivo añadido|Archivo retirado):/.test(h.note)).reverse();
  // The producer's newest message goes first (above the box to answer it): it is usually the question waiting for a reply.
  const lastStudio = canTalk ? all.find(h => who(h.actor) === 'studio') : null, items = lastStudio ? all.filter(h => h !== lastStudio) : all;
  const bubble = h => {
    const w = who(h.actor), when = parseDate(h.created_at), stg = SI[Number(h.stage)]?.[0] || '';
    const text = w === 'me' ? h.note.replace(/^Comentario del cliente:\s*/, '') : h.note;
    if (w === 'system') return `<li class="s-ev"><span>${ic(/pago/i.test(h.note) ? 'card' : 'check')}</span><p>${esc(h.note)}</p><time datetime="${esc(when.toISOString())}">${esc(ago(when, now))}</time></li>`;
    return `<li class="s-msg ${w}"><div class="s-av" aria-hidden="true">${w === 'me' ? 'Tú' : 'P'}</div><div class="s-bub"><p class="s-who">${w === 'me' ? 'Tú' : 'Tu productor'}${stg && w === 'studio' ? ` · <span>${esc(stg)}</span>` : ''}<time datetime="${esc(when.toISOString())}">${esc(ago(when, now))}</time></p><p class="s-text${text.length > 320 ? ' clamp' : ''}">${esc(text)}</p>${text.length > 320 ? '<button type="button" class="s-readmore" data-readmore aria-expanded="false">Leer completa</button>' : ''}</div></li>`;
  };
  const talk = canTalk ? `<form id="feedback-form" class="s-talk" novalidate><label for="s-msg"><b>Escríbele a tu productor</b><small>Te responde aquí mismo y por correo.</small></label>
    <div class="s-chips" role="group" aria-label="Respuestas rápidas">${QUICK_FOR(o).map(q => `<button type="button" class="s-chip" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <textarea id="s-msg" name="message" required minlength="3" maxlength="2000" rows="3" placeholder="Cuéntanos qué sentiste y qué cambiarías."></textarea>
    <button class="primary">${ic('mail')} Enviar al productor</button><p class="form-error" role="status"></p></form>` : '';
  const chat = `<section id="s-chat" class="s-chat"><h2 class="s-h"><span>Mensajes del productor</span><b>${all.filter(h => who(h.actor) !== 'system').length || 'Aún sin'} mensajes</b></h2>${lastStudio ? `<ol class="s-feed s-last">${bubble(lastStudio)}</ol>` : ''}${talk}
    <ol class="s-feed">${items.slice(0, 4).map(bubble).join('')}</ol>${items.length > 4 ? `<details class="s-more"><summary>Ver ${items.length - 4} anteriores</summary><ol class="s-feed">${items.slice(4).map(bubble).join('')}</ol></details>` : ''}</section>`;

  // 5. Materials (Full Experience) and the story, tucked away until needed.
  const UP = {
    full: ['Tus fotos y videos', 'Para tu video', 'Sube las fotos y clips que quieres ver en tu video vertical. Puedes elegir muchos a la vez, aunque sean pesados: los reducimos en tu teléfono antes de enviarlos.'],
    business: ['El material de tu marca', 'Opcional', 'Logos, referencias, spots anteriores o cualquier archivo que nos ayude a entender tu marca. Puedes subir varios a la vez.'],
    other: ['Material para tu canción', 'Opcional', 'Una nota de voz, fotos o un audio de referencia ayudan a contar tu historia. Puedes subir varios a la vez.'],
  }[o.product_code === 'full' ? 'full' : o.audience === 'business' ? 'business' : 'other'];
  const late = ['review', 'completed'].includes(o.status);
  if (late) UP[2] = o.product_code === 'full' && !sentSources ? 'Si todavía quieres tu video, sube aquí tus fotos y clips. Puedes elegir muchos a la vez.' : 'Aunque la canción ya esté lista, puedes seguir enviándonos archivos. Puedes subir varios a la vez.';
  const canSend = ['paid', 'in_production', 'review', 'completed'].includes(o.status);
  const upload = canSend ? `<section id="s-upload" class="s-card s-up"><h2 class="s-h"><span>${UP[0]}</span><b data-u-count>${UP[1]}</b></h2><p class="s-says">${UP[2]}</p>${uploaderHtml(o.reference, {role: 'customer', kind: 'source'})}</section>` : '';
  const story = `<details class="s-card s-story"><summary>${ic('heart')} Tu historia, tal como la contaste</summary><p>${esc(o.brief.story)}</p></details><p class="s-ref">Sesión ${esc(o.reference)}</p>`;

  if (part === 'downloads') return `<div class="s-wrap">${delivery.length ? room : '<p class="s-says">Todavía no hay archivos de entrega.</p>'}</div>`;
  if (part === 'talk') return `<div class="s-wrap">${chat}</div>`;
  if (part === 'files') return `<div class="s-wrap">${upload || '<p class="s-says">Podrás enviar tus archivos cuando el pago esté confirmado.</p>'}</div>`;
  // Order: what to do now → the song → progress → talk → extras.
  return `<div class="s-wrap">${hero}${tiles}${o.status === 'review' || o.status === 'completed' ? room + line : line + room}${needsMaterial ? upload + chat : chat + upload}${story}</div>`;
}
