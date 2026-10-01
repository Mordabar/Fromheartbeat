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

// One look per state, used everywhere (hero, list, 3D terminal, admin): colour + icon + the words a stranger understands.
export const STATE = {
  created: {tone: 'pay', icon: 'card', label: 'Falta el pago', title: 'Tu historia está guardada', says: 'Completa el pago para que el estudio empiece a trabajar en tu canción.'},
  payment_pending: {tone: 'pay', icon: 'clock', label: 'Confirmando el pago', title: 'Estamos confirmando tu pago', says: 'Cuando el banco lo apruebe, esta pantalla se actualiza sola. No tienes que hacer nada más.'},
  paid: {tone: 'make', icon: 'check', label: 'Pago recibido', title: 'Pago recibido. ¡Bienvenido al estudio!', says: 'Un productor va a leer tu historia. Te escribirá aquí en cuanto empiece.'},
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

export function sessionMarkup(o, {esc, money, ic, boot, testCard, now = Date.now()}) {
  const st = STATE[o.status] || STATE.created, stage = Number(o.production_stage) || 0;
  const pending = ['created', 'payment_pending'].includes(o.status), waiting = o.status === 'payment_pending' && boot.commerceReady;
  const delivery = o.files.filter(f => f.kind === 'delivery'), audio = delivery.filter(f => f.mime.startsWith('audio/')).slice().reverse();
  const cover = delivery.find(f => f.mime.startsWith('image/')), others = delivery.filter(f => !f.mime.startsWith('audio/'));
  const says = o.status === 'in_production' ? STAGE_INFO[stage][1] : st.says;
  const last = o.history.length ? parseDate(o.history[o.history.length - 1].created_at) : null;
  const canTalk = ['in_production', 'review', 'completed'].includes(o.status);

  // 1. Hero: the one thing to know right now, and the one thing to do.
  let action = '';
  if (pending && boot.commerceReady) action = `<button id="resume-payment" class="primary big">${ic('lock')} ${waiting ? 'Abrir el pago otra vez' : 'Ir al pago seguro'}</button>`;
  else if (pending) action = '<p class="s-note">Los pagos en línea se están configurando: te avisaremos por correo para completarlo.</p>';
  else if (o.status === 'review' && audio.length) action = '<a class="primary big" href="#s-room">' + ic('play') + ' Escuchar mi canción</a>';
  else if (o.status === 'completed' && audio.length) action = '<a class="primary big" href="#s-room">' + ic('play') + ' Escuchar y descargar</a>';
  else if (o.status === 'in_production' || o.status === 'paid') action = '<p class="s-note">' + ic('check') + ' No tienes que hacer nada. Te avisamos por correo en cada avance.</p>';
  const hero = `<section class="s-hero tone-${st.tone}" aria-labelledby="panel-title">
    <div class="s-badge" aria-hidden="true">${ic(st.icon, waiting ? 'spin' : '')}</div>
    <div class="s-hero-text"><p class="s-eyebrow">${esc(st.label)} · ${esc(o.reference)}</p><h1 id="panel-title">${esc(st.title)}</h1><p class="s-says">${esc(says)}</p></div>
    <div class="s-hero-action">${action}</div>
    <p class="s-meta">${esc(o.product_name)} · ${money(o.amount_in_cents)} COP${last ? ` · Último movimiento ${esc(ago(last, now))}` : ''} <button id="refresh-order" class="s-link">${ic('refresh')} Actualizar</button></p>
    <p class="form-error" id="payment-error" role="alert"></p>
  </section>${pending ? testCard() : ''}`;

  // 2. The production line: six stages, the current one lit, each in plain words.
  const line = `<section class="s-line" aria-label="Avance de tu canción"><h2 class="s-h"><span>En qué punto estamos</span><b>${pending ? 'Aún no empieza' : o.status === 'completed' ? 'Completado' : `Etapa ${stage + 1} de 6`}</b></h2>
    <div class="s-meter" role="img" aria-label="${pending ? 'La producción aún no empieza' : `Etapa ${stage + 1} de 6: ${STAGE_INFO[stage][0]}`}">${STAGE_INFO.map((_, i) => `<i class="${o.status === 'completed' || (!pending && i < stage) ? 'on' : !pending && i === stage ? 'now' : ''}"></i>`).join('')}</div>
    <ol class="s-stages">${STAGE_INFO.map(([name, text], i) => {
      const state = o.status === 'completed' || (!pending && i < stage) ? 'done' : !pending && i === stage ? 'now' : 'next';
      return `<li class="${state}"${state === 'now' ? ' aria-current="step"' : ''}><span class="s-dot" aria-hidden="true">${state === 'done' ? ic('check') : i + 1}</span><div><b>${esc(name)}</b><small>${state === 'now' ? esc(text) : state === 'done' ? 'Listo' : 'Pronto'}</small></div></li>`;
    }).join('')}</ol></section>`;

  // 3. Listening room: the song first, the versions and files after.
  const sourceFiles = o.files.filter(f => f.kind === 'source');
  const room = delivery.length ? `<section id="s-room" class="s-room"><h2 class="s-h"><span>${o.product.listening ? 'Listening room' : 'Tu entrega'}</span><b>Solo tú puedes escuchar esto</b></h2>
    ${audio.map((f, i) => `<article class="s-track${i ? ' old' : ''}">${i === 0 && cover ? `<img src="api.php?action=file&id=${cover.id}" alt="Portada de tu canción">` : `<div class="s-cover" aria-hidden="true">${ic('music')}</div>`}
      <div class="s-track-body"><small>${i === 0 ? 'ÚLTIMA VERSIÓN' : 'VERSIÓN ANTERIOR'}</small><strong>${esc(f.original_name)}</strong><audio controls preload="none" src="api.php?action=file&id=${f.id}"></audio></div></article>`).join('')}
    <div class="s-files">${delivery.map(f => `<a href="api.php?action=file&id=${f.id}&download=1">${ic('arrow', 'down')}<span>${esc(f.original_name)}</span></a>`).join('')}</div></section>`
    : pending ? '' : `<section class="s-room empty"><h2 class="s-h"><span>Tu canción</span><b>Aparecerá aquí</b></h2><p class="s-says">Cuando esté lista, la escucharás en este mismo lugar, sin salir de la sesión.</p></section>`;

  // 4. The producer's messages as a conversation. Newest first; the system's own events stay small.
  const items = o.history.slice().reverse();
  const bubble = h => {
    const w = who(h.actor), when = parseDate(h.created_at), stg = STAGE_INFO[Number(h.stage)]?.[0] || '';
    const text = w === 'me' ? h.note.replace(/^Comentario del cliente:\s*/, '') : h.note;
    if (w === 'system') return `<li class="s-ev"><span>${ic(/pago/i.test(h.note) ? 'card' : 'check')}</span><p>${esc(h.note)}</p><time datetime="${esc(when.toISOString())}">${esc(ago(when, now))}</time></li>`;
    return `<li class="s-msg ${w}"><div class="s-av" aria-hidden="true">${w === 'me' ? 'Tú' : 'P'}</div><div class="s-bub"><p class="s-who">${w === 'me' ? 'Tú' : 'Tu productor'}${stg && w === 'studio' ? ` · <span>${esc(stg)}</span>` : ''}<time datetime="${esc(when.toISOString())}">${esc(ago(when, now))}</time></p><p>${esc(text)}</p></div></li>`;
  };
  const talk = canTalk ? `<form id="feedback-form" class="s-talk"><label for="s-msg"><b>Escríbele a tu productor</b><small>Te responde aquí mismo y por correo.</small></label>
    <div class="s-chips" role="group" aria-label="Respuestas rápidas">${QUICK_REPLIES.map(q => `<button type="button" class="s-chip" data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <textarea id="s-msg" name="message" required minlength="3" maxlength="2000" rows="3" placeholder="Cuéntanos qué sentiste y qué cambiarías."></textarea>
    <button class="primary">${ic('mail')} Enviar al productor</button><p class="form-error" role="status"></p></form>` : '';
  const chat = `<section class="s-chat"><h2 class="s-h"><span>Mensajes del productor</span><b>${items.filter(h => who(h.actor) !== 'system').length || 'Aún sin'} mensajes</b></h2>${talk}
    <ol class="s-feed">${items.slice(0, 4).map(bubble).join('')}</ol>${items.length > 4 ? `<details class="s-more"><summary>Ver ${items.length - 4} anteriores</summary><ol class="s-feed">${items.slice(4).map(bubble).join('')}</ol></details>` : ''}</section>`;

  // 5. Materials (Full Experience) and the story, tucked away until needed.
  const upload = o.product_code === 'full' && !pending ? `<form id="source-form" class="s-card"><h2 class="s-h"><span>Tus fotos y videos</span><b>Para tu video</b></h2><p class="s-says">Sube las fotos y clips que quieres ver en tu video vertical.</p>
    <label class="s-file"><input name="file" type="file" accept="image/jpeg,image/png,image/webp,video/mp4" required><span>${ic('gift')} Elegir un archivo</span></label><small class="s-note">Hasta 50 MB por archivo · máximo 40 archivos.</small>
    <button class="secondary">Enviar al estudio</button><p id="upload-result" role="status" class="form-note"></p>${sourceFiles.map(f => `<div class="s-filerow">${ic('check')}<span>${esc(f.original_name)}</span><a href="api.php?action=file&id=${f.id}&download=1">Descargar</a></div>`).join('')}</form>` : '';
  const story = `<details class="s-card s-story"><summary>${ic('heart')} Tu historia, tal como la contaste</summary><p>${esc(o.brief.story)}</p></details>`;

  // Order: what to do now → the song → progress → talk → extras.
  return `<div class="s-wrap">${hero}${o.status === 'review' || o.status === 'completed' ? room + line : line + room}${chat}${upload}${story}</div>`;
}
