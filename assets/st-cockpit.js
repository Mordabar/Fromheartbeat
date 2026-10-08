// "Mi sesión" as a place: a control room built around the visitor at the centre of the studio.
//   ahead  · status monitor, meter bridge (the six stages of the song as LED channels with real faders) and the material pad
//   left   · record deck: listen to the song and download every file of the delivery
//   right  · message wall: what the producer wrote, and the way to answer
// The room only exists while the visitor is inside a session; every number on it comes from the order.
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, neonText, roundRect, fit, wrap, glowSprite, damp, siteUrl, FONT} from './gfx.js';
import {drawIcon} from './icons.js';
import {stationGroup} from './layout.js';
import {put, box, neonFrame, makeScreen, Pill} from './st-kit.js';
import {STATE, STAGE_INFO, stageInfoFor, parseDate, ago, who} from './session-ui.js';

export const SESSION_VIEWS = ['session', 'session-song', 'session-talk', 'session-files'];
const TONE = {pay: '#ffc857', make: '#c9a0ff', review: '#38e1ff', done: '#3dffc5', off: '#a79bb8'};
const SHORT = ['Historia', 'Letra', 'Grabación', 'Producción', 'Mezcla', 'Entrega'];
const UPLOAD_NOTE = /^(Versión disponible|Archivo añadido|Archivo retirado):/;
const R = 12, AZ = {core: 0, deck: -58, wall: 58};
const shortFor = o => o?.product_code === 'dedicatoria' ? SHORT.map((x, i) => i === 4 ? 'Revisión' : x) : SHORT;
const kb = b => b >= 1048576 ? (b / 1048576 >= 10 ? Math.round(b / 1048576) : (b / 1048576).toFixed(1)) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
const kindTag = f => f.mime === 'audio/mpeg' ? 'MP3' : /wav/.test(f.mime) ? 'WAV' : f.mime.startsWith('video/') ? 'VIDEO' : f.mime.startsWith('image/') ? 'PORTADA' : 'ARCHIVO';

function channelStates(o) {
  const pending = !o || ['created', 'payment_pending', 'cancelled'].includes(o.status), stage = !o ? 0 : ['review', 'completed'].includes(o.status) ? 5 : Number(o.production_stage) || 0;
  return SHORT.map((_, k) => !o || pending ? 'next' : o.status === 'completed' || k < stage ? 'done' : k === stage ? 'now' : 'next');
}

export function buildCockpit(s) {
  const m = s.m, root = new THREE.Group(); root.visible = false; s.scene.add(root);
  const st = {group: root, order: null, appear: 0, view: 'lobby', hint: -1, hintTimer: 0, playing: false, upload: {active: 0, progress: 0}, seen: 0};
  const spot = (az, r = R) => { const g = stationGroup(az, r); root.add(g); return g; };
  const core = spot(AZ.core), deck = spot(AZ.deck), wall = spot(AZ.wall);

  // Floor of the room: a lit disc so it reads as a place, not as the open studio floor.
  const disc = new THREE.Mesh(new THREE.CircleGeometry(17.5, 72), new THREE.MeshStandardMaterial({color: 0x120a24, roughness: 0.35, metalness: 0.6})); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.06; root.add(disc);
  for (const [r, mat] of [[17.0, m.accent], [14.4, m.neon]]) { const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.06, r + 0.06, 120), mat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.09; root.add(ring); }
  const back = (g, w, h, depth = -2.2) => { box(g, w, h, 0.5, m.dark, 0, h / 2, depth); const fr = new THREE.Group(); fr.position.set(0, h / 2, depth + 0.3); g.add(fr); neonFrame(fr, w - 0.4, h - 0.4, m.neon, 0.06); };

  // ================================================================= CORE: monitor, meter bridge, desk, material pad
  back(core, 13.6, 13);
  st.monitor = makeScreen(s, 9.6, 4.6, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1e1040'); bg.addColorStop(1, '#0a0520'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,110,255,.06)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1.5);
    const o = state?.order, px = w * 0.05; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#cbb8f2'; c.font = `800 ${h * 0.055}px ${FONT.sans}`; c.fillText(o ? `TU SESIÓN · ${o.reference}` : 'FROMHEARTBEAT · SALA PRIVADA', px, h * 0.09);
    if (!o) { neonText(c, 'Mi sesión', px, h * 0.4, {size: h * 0.2, color: '#c9a8ff', align: 'left', blur: 20}); return; }
    const look = STATE[o.status] || STATE.created, tone = TONE[look.tone], stage = ['review', 'completed'].includes(o.status) ? 5 : Number(o.production_stage) || 0, pending = ['created', 'payment_pending', 'cancelled'].includes(o.status);
    const SI = stageInfoFor(o), names = shortFor(o), hint = state?.hint >= 0 ? SI[state.hint] : null;
    if (hint) {
      neonText(c, hint[0].toUpperCase(), px, h * 0.27, {size: h * 0.15, color: '#d9c0ff', align: 'left', blur: 16, maxW: w * 0.9});
      c.fillStyle = '#ffffff'; c.font = `600 ${h * 0.07}px ${FONT.sans}`; wrap(c, hint[1], w * 0.9).slice(0, 3).forEach((l, k) => c.fillText(l, px, h * 0.46 + k * h * 0.085));
    } else {
      neonText(c, look.label, px, h * 0.26, {size: h * 0.16, color: tone, align: 'left', blur: 18, maxW: w * 0.9});
      const says = o.status === 'in_production' ? (stage === 5 ? 'Estamos en el último paso: preparamos la entrega de tu canción.' : SI[stage][1]) : look.says;
      c.fillStyle = '#ffffff'; c.font = `600 ${h * 0.068}px ${FONT.sans}`; wrap(c, says, w * 0.9).slice(0, 3).forEach((l, k) => c.fillText(l, px, h * 0.46 + k * h * 0.088));
    }
    const chip = (text, x, color) => { c.font = `800 ${h * 0.05}px ${FONT.sans}`; const tw = c.measureText(text).width + h * 0.09; roundRect(c, x, h * 0.82, tw, h * 0.115, h * 0.057); c.fillStyle = color + '2a'; c.fill(); c.lineWidth = 2; c.strokeStyle = color; c.stroke(); c.fillStyle = '#fff'; c.textAlign = 'left'; c.fillText(text, x + h * 0.045, h * 0.8785); return x + tw + h * 0.04; };
    let x = chip(o.productName || '', px, '#c9a0ff'); if (!pending) chip(o.status === 'completed' ? 'Entregada' : `Etapa ${stage + 1} de 6 · ${names[stage]}`, x, tone);
  }, {px: 120});
  st.monitor.group.position.set(0, 9.9, -1.7); core.add(st.monitor.group);
  const monitorHit = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), m.hit); monitorHit.position.set(0, 9.9, -1.5); monitorHit.userData = {action: {type: 'session-plain'}, id: 'session:monitor', target: st.monitor}; core.add(monitorHit); s.pickables.push(monitorHit);

  // Meter bridge: six channels. LED segments follow the stage; the faders on the desk slide to match.
  box(core, 12.0, 4.2, 0.3, m.panel, 0, 4.75, -1.55); const bridgeFrame = new THREE.Group(); bridgeFrame.position.set(0, 4.75, -1.36); core.add(bridgeFrame); neonFrame(bridgeFrame, 12.1, 4.3, m.neon, 0.04);
  const SEG = 10, segGeo = new THREE.BoxGeometry(0.96, 0.2, 0.1);
  st.segs = new THREE.InstancedMesh(segGeo, new THREE.MeshBasicMaterial({color: 0xffffff, toneMapped: false}), 6 * SEG); st.segs.frustumCulled = false; core.add(st.segs);
  const dummy = new THREE.Object3D(), chX = i => (i - 2.5) * 1.75;
  for (let i = 0; i < 6; i++) for (let j = 0; j < SEG; j++) { dummy.position.set(chX(i), 3.5 + j * 0.28, -1.3); dummy.updateMatrix(); st.segs.setMatrixAt(i * SEG + j, dummy.matrix); st.segs.setColorAt(i * SEG + j, new THREE.Color(0x1c1433)); }
  st.channels = SHORT.map((label, i) => {
    const plate = textPlane(1.64, 0.5, (c, w, h, state) => {
      const k = state?.state || 'next', color = k === 'done' ? '#3dffc5' : k === 'now' ? '#d9c0ff' : '#8f7cb8';
      roundRect(c, 3, 3, w - 6, h - 6, h * 0.4); c.fillStyle = 'rgba(9,4,22,.95)'; c.fill(); c.lineWidth = 3; c.strokeStyle = color; c.stroke();
      const name = `${i + 1} · ${state?.label || label}`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = k === 'next' ? '#cbbce8' : '#fff'; fit(c, name, w * 0.9, h * 0.5, 800); c.fillText(name, w / 2, h / 2 + 1);
    }, {px: 150});
    plate.mesh.position.set(chX(i), 3.08, -1.28); core.add(plate.mesh); plate.surface.redraw({state: 'next'});
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 4.0), m.hit); hit.position.set(chX(i), 4.75, -1.2); hit.userData = {action: {type: 'session-stage', index: i}, id: `stage:${i}`, target: plate}; core.add(hit); s.pickables.push(hit);
    return {plate, level: 0, cap: null, state: 'next', hov: 0, hit};
  });

  // Desk with six real faders.
  box(core, 20, 1.7, 4.6, m.panel, 0, 0.85, 0.5); box(core, 20.1, 0.06, 0.06, m.accent, 0, 1.74, 2.82); box(core, 20.1, 0.06, 0.06, m.neon, 0, 0.12, 2.82);
  st.channels.forEach((ch, i) => {
    box(core, 0.26, 0.05, 2.2, m.dark, chX(i), 1.72, 0.3);
    ch.cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.46), new THREE.MeshStandardMaterial({color: 0x5d5088, metalness: 0.8, roughness: 0.3, emissive: 0x000000})); ch.cap.position.set(chX(i), 1.84, 1.2); core.add(ch.cap);
    ch.capZ = 1.2;
  });

  // Material pad: drop zone for the customer's photos, clips and audios (the uploader itself opens in a small panel).
  st.pad = textPlane(4.3, 2.4, (c, w, h, state) => {
    const up = state?.upload || {}, can = state?.can, need = state?.need, count = state?.count || 0, color = !can ? '#8f7cb8' : need ? '#22e4ff' : '#c6a2ff';
    roundRect(c, 6, 6, w - 12, h - 12, h * 0.1); const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#26164c'); g.addColorStop(1, '#0d0622'); c.fillStyle = g; c.fill();
    c.setLineDash([h * 0.06, h * 0.045]); c.lineWidth = 4; c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = state?.hot || need ? 18 : 6; roundRect(c, 14, 14, w - 28, h - 28, h * 0.08); c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#cbb8f2'; c.font = `800 ${h * 0.085}px ${FONT.sans}`; c.fillText('MATERIAL', w * 0.07, h * 0.17);
    // upload arrow
    c.strokeStyle = color; c.lineWidth = h * 0.035; c.lineCap = 'round'; c.lineJoin = 'round'; const ax = w * 0.13, ay = h * 0.6, as = h * 0.15; c.beginPath(); c.moveTo(ax, ay + as); c.lineTo(ax, ay - as); c.moveTo(ax - as * 0.7, ay - as * 0.3); c.lineTo(ax, ay - as); c.lineTo(ax + as * 0.7, ay - as * 0.3); c.stroke();
    c.fillStyle = '#ffffff'; c.textAlign = 'left';
    const lines = !can ? ['Disponible cuando', 'se confirme el pago'] : up.active ? [`Subiendo… ${Math.round(up.progress * 100)}%`, `${up.active} ${up.active === 1 ? 'archivo' : 'archivos'}`] : need ? ['Sube tus fotos', 'y videos'] : count ? [`${count} ${count === 1 ? 'archivo' : 'archivos'} enviados`, 'Toca para añadir más'] : [state?.full ? 'Subir fotos y videos' : 'Enviar material', state?.full ? '' : '(opcional)'];
    c.font = `800 ${h * 0.125}px ${FONT.sans}`; lines.forEach((l, k) => { if (l) { fit(c, l, w * 0.6, h * 0.125, 800); c.fillText(l, w * 0.29, h * (0.5 + k * 0.17)); } });
    if (can && up.active) { c.fillStyle = 'rgba(255,255,255,.14)'; roundRect(c, w * 0.07, h * 0.86, w * 0.86, h * 0.05, h * 0.025); c.fill(); c.fillStyle = color; roundRect(c, w * 0.07, h * 0.86, Math.max(h * 0.05, w * 0.86 * up.progress), h * 0.05, h * 0.025); c.fill(); }
  }, {px: 140});
  const padG = new THREE.Group(); padG.position.set(7.7, 2.6, 1.3); padG.rotation.x = 0.5; core.add(padG);
  box(padG, 4.5, 0.35, 2.6, m.metal, 0, -0.18, 0); padG.add(st.pad.mesh); st.pad.mesh.rotation.x = -Math.PI / 2; st.pad.mesh.position.y = 0.01;
  // the pad lies on its tilted base; its plane faces up in local space, the group tilts it toward the visitor
  const padHit = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 2.6), m.hit); padHit.rotation.x = -Math.PI / 2; padHit.position.y = 0.04; padHit.userData = {action: {type: 'session-files'}, id: 'session:pad', target: st.pad}; padG.add(padHit); s.pickables.push(padHit);
  st.padGlow = glowSprite(0x22e4ff, 6, 0); st.padGlow.position.set(0, 0.4, 0); padG.add(st.padGlow); st.padHov = 0;
  st.payPill = new Pill(s, {w: 5.4, h: 1.0, label: 'Ir al pago seguro', action: {type: 'session-pay', direct: true}, id: 'session:pay', color: '#ffc857', icon: 'lock', fill: true});
  st.payPill.group.position.set(0, 2.0, 3.1); st.payPill.group.rotation.x = -0.4; core.add(st.payPill.group); st.payPill.group.visible = false;
  // The two things the customer can DO besides listening: write to the producer and send material. Always in sight on the main view.
  st.coreTalk = new Pill(s, {w: 4.6, h: 1.0, label: 'Mensajes', action: {type: 'session-talk', direct: true}, id: 'session:core-talk', color: '#22e4ff', icon: 'mail', fill: true});
  st.coreTalk.group.position.set(-2.5, 2.0, 3.1); st.coreTalk.group.rotation.x = -0.4; core.add(st.coreTalk.group);
  st.coreFiles = new Pill(s, {w: 4.6, h: 1.0, label: 'Subir material', action: {type: 'session-files', direct: true}, id: 'session:core-files', color: '#ffc857', icon: 'confetti', fill: true});
  st.coreFiles.group.position.set(2.5, 2.0, 3.1); st.coreFiles.group.rotation.x = -0.4; core.add(st.coreFiles.group);
  st.padPill = new Pill(s, {w: 4.6, h: 1.0, label: 'Añadir material', action: {type: 'session-files', direct: true}, id: 'session:pad-pill', color: '#ffc857', icon: 'confetti', fill: true});
  st.padPill.group.position.set(7.7, 1.15, 3.7); st.padPill.group.rotation.x = -0.4; core.add(st.padPill.group);
  st.giftCta = new Pill(s, {w: 5.4, h: 1.0, label: 'Crear mi canción', action: {type: 'go', view: 'resume'}, id: 'session:gift-cta', color: '#ff4fd8', icon: 'sparkle', fill: true});
  st.giftCta.group.position.set(0, 0.9, 4.0); st.giftCta.group.rotation.x = -0.45; deck.add(st.giftCta.group); st.giftCta.group.visible = false; st.giftCta.hit.visible = false;
  st.textPill = new Pill(s, {w: 4.0, h: 0.8, label: 'Ver todo en texto', action: {type: 'session-plain', direct: true}, id: 'session:plain', color: '#c6a2ff', icon: 'lines'});
  st.textPill.group.position.set(-8.6, 1.95, 2.2); st.textPill.group.rotation.x = -0.4; core.add(st.textPill.group);

  // ================================================================= DECK: the song and its files
  back(deck, 10, 13.4);
  // The delivery: cover art on top, then one download card per file saying what it is, how big it is and that it downloads.
  const BW = 8.4, BH = 7.2, BY = 9.3, ROWS = 3, rowFrac = i => 0.57 + i * 0.152;
  const fileLook = f => /mpeg|mp3/.test(f.mime) ? ['Canción · MP3', 'Para escuchar y compartir', 'note', '#ff4fd8'] : /wav/.test(f.mime) ? ['Master · WAV', 'Calidad de estudio', 'vinyl', '#c6a2ff'] : f.mime.startsWith('audio/') ? ['Audio', 'Versión de tu canción', 'note', '#ff4fd8'] : f.mime.startsWith('image/') ? ['Portada', 'La imagen de tu canción', 'sparkle', '#ffc857'] : f.mime.startsWith('video/') ? ['Video', 'Listo para redes', 'clapper', '#22e4ff'] : ['Archivo', 'Material de tu entrega', 'lines', '#c6a2ff'];
  st.board = makeScreen(s, BW, BH, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#22124a'); bg.addColorStop(1, '#090418'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const files = state?.files || [], px = w * 0.05;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    if (!files.length) {
      neonText(c, state?.waiting ? 'Aún no hay archivos' : 'Todavía no hay entrega', px, h * 0.36, {size: h * 0.085, color: '#d5bcff', align: 'left', blur: 14, maxW: w * 0.9});
      c.fillStyle = '#efe6ff'; c.font = `600 ${h * 0.05}px ${FONT.sans}`; wrap(c, state?.hint || 'Cuando el estudio suba tu canción, la escuchas desde el disco y descargas cada archivo aquí.', w * 0.9).slice(0, 4).forEach((l, i) => c.fillText(l, px, h * 0.5 + i * h * 0.075)); return;
    }
    // cover art
    const cs = h * 0.31, cx = px, cy = h * 0.075;
    c.save(); c.shadowColor = '#b57cff'; c.shadowBlur = 26; roundRect(c, cx, cy, cs, cs, cs * 0.09); c.fillStyle = '#1b0f3a'; c.fill(); c.restore();
    c.save(); roundRect(c, cx, cy, cs, cs, cs * 0.09); c.clip();
    if (state?.cover) { const im = state.cover, k = Math.max(cs / im.naturalWidth, cs / im.naturalHeight); c.drawImage(im, cx + (cs - im.naturalWidth * k) / 2, cy + (cs - im.naturalHeight * k) / 2, im.naturalWidth * k, im.naturalHeight * k); }
    else { const g = c.createLinearGradient(cx, cy, cx + cs, cy + cs); g.addColorStop(0, '#6a3df0'); g.addColorStop(1, '#ff4fd8'); c.fillStyle = g; c.fillRect(cx, cy, cs, cs); drawIcon(c, 'note', cx + cs / 2, cy + cs / 2, cs * 0.5, {color: '#ffffff', width: 2.2, glow: 14}); }
    c.restore(); c.lineWidth = 3; c.strokeStyle = '#ffffff55'; roundRect(c, cx, cy, cs, cs, cs * 0.09); c.stroke();
    // title block
    const tx = cx + cs + w * 0.045, tw = w - tx - px; c.textAlign = 'left';
    c.fillStyle = '#ffb3ec'; c.font = `800 ${h * 0.034}px ${FONT.sans}`; c.fillText('TU ENTREGA', tx, cy + cs * 0.1);
    neonText(c, state?.title || 'Tu canción', tx, cy + cs * 0.33, {size: h * 0.066, color: '#ffffff', align: 'left', blur: 12, maxW: tw});
    c.fillStyle = '#d9ccef'; c.font = `600 ${h * 0.038}px ${FONT.sans}`; fit(c, state?.sub || '', tw, h * 0.038, 600); c.fillText(state?.sub || '', tx, cy + cs * 0.56);
    // how many files, and that they download: a solid chip inside the title block (never up in the corner under the header)
    const chipText = `${files.length} ${files.length === 1 ? 'archivo' : 'archivos'} para descargar`; c.font = `800 ${h * 0.036}px ${FONT.sans}`; const cw = Math.min(tw, c.measureText(chipText).width + h * 0.08), chh = h * 0.058, cyy = cy + cs * 0.8;
    roundRect(c, tx, cyy - chh / 2, cw, chh, chh / 2); c.fillStyle = '#12382f'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = '#3dffc5'; c.stroke(); c.fillStyle = '#7dffdc'; c.textAlign = 'center'; c.fillText(chipText, tx + cw / 2, cyy + 1); c.textAlign = 'left';
    // download cards
    const more = files.length > ROWS, shown = more ? files.slice(0, ROWS - 1) : files;
    const card = (i, f, extra) => {
      const y = h * rowFrac(i), rh = h * 0.135, hot = state?.hot === i, look = f ? fileLook(f) : null, col = look ? look[3] : '#c6a2ff';
      roundRect(c, w * 0.04, y - rh / 2, w * 0.92, rh, rh * 0.28); c.fillStyle = hot ? 'rgba(198,162,255,.28)' : 'rgba(198,162,255,.1)'; c.fill(); c.lineWidth = 2.5; c.strokeStyle = hot ? '#ffffff' : 'rgba(198,162,255,.32)'; c.stroke();
      if (extra) { c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = `800 ${h * 0.046}px ${FONT.sans}`; c.fillText(extra, w * 0.08, y + 1); c.fillStyle = '#c6a2ff'; c.font = `700 ${h * 0.036}px ${FONT.sans}`; c.textAlign = 'right'; c.fillText('Ver todos ›', w * 0.93, y + 1); return; }
      const ix = w * 0.105, ir = rh * 0.34; c.beginPath(); c.arc(ix, y, ir, 0, Math.PI * 2); c.fillStyle = col + '33'; c.fill(); c.lineWidth = 2; c.strokeStyle = col; c.stroke(); drawIcon(c, look[2], ix, y, ir * 1.2, {color: col, width: 2, glow: 8});
      c.textAlign = 'left'; c.fillStyle = '#fff'; c.font = `800 ${h * 0.044}px ${FONT.sans}`; c.fillText(look[0], w * 0.175, y - rh * 0.17);
      c.fillStyle = '#cbb8f2'; c.font = `600 ${h * 0.03}px ${FONT.sans}`; const meta = `${f.original_name} · ${kb(Number(f.size_bytes))}`; fit(c, meta, w * 0.36, h * 0.03, 600); c.fillText(meta, w * 0.175, y + rh * 0.2);
      // the button that says it: "Descargar" with a down arrow
      const bw = w * 0.235, bh = rh * 0.62, bx = w * 0.93 - bw, by = y - bh / 2; roundRect(c, bx, by, bw, bh, bh / 2);
      const g = c.createLinearGradient(bx, by, bx + bw, by); g.addColorStop(0, hot ? '#ff7fe6' : '#c26bff'); g.addColorStop(1, hot ? '#ff4fd8' : '#ff4fd8'); c.fillStyle = g; c.fill();
      c.fillStyle = '#12081f'; c.font = `800 ${h * 0.035}px ${FONT.sans}`; c.textAlign = 'center'; c.fillText('Descargar', bx + bw * 0.58, y + 1);
      const ax = bx + bw * 0.17, as = bh * 0.2; c.strokeStyle = '#12081f'; c.lineWidth = bh * 0.1; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(ax, y - as); c.lineTo(ax, y + as); c.moveTo(ax - as * 0.8, y + as * 0.2); c.lineTo(ax, y + as); c.lineTo(ax + as * 0.8, y + as * 0.2); c.stroke();
    };
    shown.forEach((f, i) => card(i, f)); if (more) card(ROWS - 1, null, `+ ${files.length - (ROWS - 1)} archivos más`);
  }, {px: 120});
  st.board.group.position.set(0, BY, -1.5); deck.add(st.board.group);
  st.fileHits = Array.from({length: ROWS}, (_, i) => {
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.94, BH * 0.15), m.hit); hit.position.set(0, BY + (0.5 - rowFrac(i)) * BH, -1.36); hit.visible = false;
    hit.userData = {action: null, id: `session:file:${i}`, target: {i}}; deck.add(hit); s.pickables.push(hit); return hit;
  });
  st.now = makeScreen(s, 6.8, 1.9, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#2a1250'); bg.addColorStop(1, '#0d0622'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    const f = state?.file, on = state?.on; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = on ? '#ff9be8' : '#cbb8f2'; c.font = `800 ${h * 0.115}px ${FONT.sans}`; c.fillText(on ? '▶ SONANDO AHORA' : f ? (state?.gift ? 'UNA CANCIÓN PARA TI' : 'TU CANCIÓN') : 'TU CANCIÓN · AÚN NO', w * 0.05, h * 0.2);
    if (!f) { c.fillStyle = '#fff'; c.font = `600 ${h * 0.15}px ${FONT.sans}`; wrap(c, 'Cuando esté lista, aquí la escuchas.', w * 0.9).slice(0, 2).forEach((l, k) => c.fillText(l, w * 0.05, h * 0.55 + k * h * 0.2)); return; }
    neonText(c, state?.title || f.original_name.replace(/\.[^.]+$/, ''), w * 0.05, h * 0.52, {size: h * 0.28, color: on ? '#ff8de6' : '#ffffff', align: 'left', blur: 14, maxW: w * 0.9});
    c.fillStyle = '#e9dcff'; c.font = `700 ${h * 0.13}px ${FONT.sans}`; c.fillText(on ? 'Toca el disco para pausar' : 'Toca el disco para escucharla', w * 0.05, h * 0.84);
  }, {px: 120});
  st.now.group.position.set(0, 4.35, -1.5); deck.add(st.now.group);
  const vinyl = new THREE.MeshStandardMaterial({color: 0x08060c, roughness: 0.3, metalness: 0.6});
  box(deck, 8.2, 1.1, 4.8, m.panel, 0, 0.55, 1.2); box(deck, 8.3, 0.06, 0.06, m.accent, 0, 1.12, 3.6);
  st.platter = new THREE.Group(); st.platter.position.set(-0.7, 1.2, 1.0); deck.add(st.platter);
  put(st.platter, new THREE.CylinderGeometry(2.55, 2.55, 0.12, 64), vinyl);
  const grooves = put(st.platter, new THREE.RingGeometry(1.2, 2.45, 64), new THREE.MeshBasicMaterial({color: 0x2c2145, transparent: true, opacity: 0.5, toneMapped: false}), 0, 0.07, 0); grooves.rotation.x = -Math.PI / 2;
  st.label = put(st.platter, new THREE.CircleGeometry(1.1, 56), new THREE.MeshBasicMaterial({color: 0x3a2370, toneMapped: false}), 0, 0.075, 0); st.label.rotation.x = -Math.PI / 2;
  const platterRing = put(deck, new THREE.TorusGeometry(2.62, 0.05, 8, 80), new THREE.MeshBasicMaterial({color: 0xff4fd8, transparent: true, opacity: 0.4, toneMapped: false}), -0.7, 1.28, 1.0); platterRing.rotation.x = Math.PI / 2; st.platterRing = platterRing;
  st.arm = new THREE.Group(); st.arm.position.set(3.0, 1.4, -0.4); deck.add(st.arm); put(st.arm, new THREE.CylinderGeometry(0.3, 0.34, 0.45, 20), m.metal); put(st.arm, new THREE.BoxGeometry(0.1, 0.1, 3.4), m.metal, 0, 0.2, 1.6);
  st.deckGlow = glowSprite(0xff4fd8, 8, 0.1); st.deckGlow.position.set(-0.7, 2.0, 1.0); deck.add(st.deckGlow);
  const platterHit = new THREE.Mesh(new THREE.CylinderGeometry(2.7, 2.7, 0.8, 24), m.hit); platterHit.position.set(-0.7, 1.4, 1.0); platterHit.userData = {action: {type: 'session-play'}, id: 'session:vinyl', target: st.platter}; deck.add(platterHit); s.pickables.push(platterHit);
  st.playPill = new Pill(s, {w: 5.8, h: 1.0, label: 'Escuchar mi canción', action: {type: 'session-play', direct: true}, id: 'session:play', color: '#ff4fd8', icon: 'play', fill: true});
  st.playPill.group.position.set(0, 0.9, 4.0); st.playPill.group.rotation.x = -0.45; deck.add(st.playPill.group);
  // Gifting: a read-only link for one song. The pill only exists for the buyer, and only once there is a song to give.
  st.sharePill = new Pill(s, {w: 3.6, h: 0.8, label: 'Compartir', action: {type: 'session-share', direct: true}, id: 'session:share', color: '#3dffc5', icon: 'heart'});
  st.sharePill.group.position.set(3.15, 0.85, 4.0); st.sharePill.group.rotation.x = -0.45; deck.add(st.sharePill.group);

  // ================================================================= WALL: messages
  back(wall, 10, 12.4);
  st.msgs = makeScreen(s, 7.8, 7.4, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1e1040'); bg.addColorStop(1, '#0a0520'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#cbb8f2'; c.font = `800 ${h * 0.04}px ${FONT.sans}`; c.fillText('MENSAJES DEL PRODUCTOR', w * 0.05, h * 0.05);
    if (state?.unread) { const t = 'NUEVO'; c.font = `800 ${h * 0.034}px ${FONT.sans}`; const tw = c.measureText(t).width + h * 0.05; roundRect(c, w * 0.95 - tw, h * 0.028, tw, h * 0.046, h * 0.023); c.fillStyle = '#ff4fd8'; c.fill(); c.fillStyle = '#fff'; c.textAlign = 'center'; c.fillText(t, w * 0.95 - tw / 2, h * 0.052); c.textAlign = 'left'; }
    const list = state?.list || [];
    if (!list.length) { neonText(c, 'Aún sin mensajes', w * 0.05, h * 0.28, {size: h * 0.075, color: '#d5bcff', align: 'left', blur: 14, maxW: w * 0.9}); c.fillStyle = '#efe6ff'; c.font = `600 ${h * 0.045}px ${FONT.sans}`; wrap(c, state?.can ? 'Cuando tu productor te escriba, lo lees aquí. También puedes escribirle tú.' : 'Cuando empiece la producción, aquí hablas con tu productor.', w * 0.9).slice(0, 4).forEach((l, k) => c.fillText(l, w * 0.05, h * 0.4 + k * h * 0.06)); return; }
    // Newest messages that fit: every bubble is measured with the font it is drawn in, older ones step aside.
    const bw = w * 0.84, pad = h * 0.025, lineH = h * 0.052, top = h * 0.085, room = h * 0.84;
    c.font = `600 ${h * 0.048}px ${FONT.sans}`;
    const bubbles = list.map(msg => { const all = wrap(c, msg.text, bw - pad * 2); const body = all.length <= 3 ? all : (() => { const cut = all.slice(0, 3); cut[2] = cut[2].replace(/\s*\S*$/, '') + '…'; return cut; })(); return {msg, body, bh: h * 0.068 + body.length * lineH + pad}; });
    let used = 0, from = bubbles.length; for (let i = bubbles.length - 1; i >= 0; i--) { if (used + bubbles[i].bh > room && from < bubbles.length) break; used += bubbles[i].bh + h * 0.015; from = i; }
    let y = top; const shown = bubbles.slice(from);
    shown.forEach(({msg, body, bh}) => {
      const mine = msg.who === 'me', bx = mine ? w * 0.12 : w * 0.04;
      roundRect(c, bx, y, bw, bh, h * 0.03); c.fillStyle = mine ? 'rgba(34,228,255,.16)' : 'rgba(155,92,255,.24)'; c.fill(); c.lineWidth = 2; c.strokeStyle = mine ? '#22e4ff' : '#b57cff'; c.stroke();
      c.fillStyle = mine ? '#8cf0ff' : '#e0ccff'; c.font = `800 ${h * 0.04}px ${FONT.sans}`; c.textAlign = 'left'; c.fillText(`${mine ? 'Tú' : 'Tu productor'} · ${msg.when}`, bx + pad, y + h * 0.03);
      c.fillStyle = '#ffffff'; c.font = `600 ${h * 0.048}px ${FONT.sans}`; body.forEach((l, k) => c.fillText(l, bx + pad, y + h * 0.075 + k * lineH));
      y += bh + h * 0.015;
    });
    const hidden = (state?.total || 0) - shown.length;
    if (hidden > 0) { c.fillStyle = '#cbb8f2'; c.font = `700 ${h * 0.042}px ${FONT.sans}`; c.textAlign = 'center'; c.fillText(`+ ${hidden} ${hidden === 1 ? 'mensaje anterior' : 'mensajes anteriores'} · toca para verlos`, w / 2, h * 0.955); }
  }, {px: 105});
  st.msgs.group.position.set(0, 7.5, -1.5); wall.add(st.msgs.group);
  const msgHit = new THREE.Mesh(new THREE.PlaneGeometry(8.2, 7.8), m.hit); msgHit.position.set(0, 7.5, -1.3); msgHit.userData = {action: {type: 'session-talk'}, id: 'session:messages', target: st.msgs}; wall.add(msgHit); s.pickables.push(msgHit);
  st.wallFront = new THREE.Group(); wall.add(st.wallFront);       // the desk in front of the wall steps aside when the camera looks at the material pad
  box(st.wallFront, 8.6, 1.1, 3.0, m.panel, 0, 0.55, 1.1); box(st.wallFront, 8.7, 0.06, 0.06, m.accent, 0, 1.12, 2.6);
  st.talkPill = new Pill(s, {w: 5.8, h: 1.0, label: 'Escribir al productor', action: {type: 'session-talk', direct: true}, id: 'session:talk', color: '#22e4ff', icon: 'mail', fill: true});
  st.talkPill.group.position.set(0, 0.62, 2.8); st.talkPill.group.rotation.x = -0.45; st.wallFront.add(st.talkPill.group);

  // ================================================================= Data
  const sigOf = o => o ? [o.shared ? 'gift' : '', o.reference, o.status, o.production_stage, o.product_code, o.files?.map(f => f.id + f.kind).join(','), o.history?.length, o.history?.[o.history.length - 1]?.note].join('|') : '';
  let sig = '', coverId = null;
  const loader = new THREE.TextureLoader();
  const pending = o => !o || ['created', 'payment_pending', 'cancelled'].includes(o.status);
  const delivery = o => (o?.files || []).filter(f => f.kind === 'delivery'), sources = o => (o?.files || []).filter(f => f.kind === 'source');
  // The song to play: the newest MP3 (what the customer shares), else the newest audio file.
  const audioOf = o => { const a = delivery(o).filter(f => f.mime.startsWith('audio/')).slice().reverse(); return a.filter(f => f.mime === 'audio/mpeg').concat(a.filter(f => f.mime !== 'audio/mpeg')); };
  st.audioFile = () => audioOf(st.order)[0] || null;
  const talkAll = o => (o?.history || []).filter(h => who(h.actor) !== 'system' && !UPLOAD_NOTE.test(h.note) && Number(h.visible ?? 1) !== 0);
  const talkList = o => talkAll(o).slice(-4).map(h => ({who: who(h.actor), text: (who(h.actor) === 'me' ? h.note.replace(/^Comentario del cliente:\s*/, '') : h.note).slice(0, 500), when: ago(parseDate(h.created_at))}));
  const studioCount = o => (o?.history || []).filter(h => who(h.actor) === 'studio' && !UPLOAD_NOTE.test(h.note)).length;
  const seenKey = o => 'fhb-seen-' + o.reference;
  // Little badges for the labelled tab bar: unread producer messages and the material the video still needs.
  st.badges = () => { const o = st.order; if (!o || o.shared) return {}; let seen = 0; try { seen = Number(sessionStorage.getItem('fhb-seen-' + o.reference) || 0); } catch { /* ok */ } return {talk: st.view === 'session-talk' ? 0 : Math.max(0, studioCount(o) - seen), files: st.padNeed ? 1 : 0}; };
  st.markSeen = () => { if (!st.order) return; try { sessionStorage.setItem(seenKey(st.order), String(studioCount(st.order))); } catch { /* ok */ } st.redrawMsgs(); };
  const unread = o => { if (!o) return false; let seen = 0; try { seen = Number(sessionStorage.getItem(seenKey(o)) || 0); } catch { /* ok */ } return studioCount(o) > seen && !(st.view === 'session-talk'); };
  st.redrawMsgs = () => st.msgs.surface.redraw({list: talkList(st.order), total: talkAll(st.order).length, unread: unread(st.order), can: ['in_production', 'review', 'completed'].includes(st.order?.status)});
  st.redrawPad = () => {
    const o = st.order, can = !!o && ['paid', 'in_production', 'review', 'completed'].includes(o.status), need = can && o.product_code === 'full' && !sources(o).length && ['paid', 'in_production'].includes(o.status);
    st.padNeed = need; st.padCan = can; padG.visible = !st.gift; padHit.visible = !st.gift && can;
    st.pad.surface.redraw({can, need, count: sources(o).length, upload: st.upload, full: o?.product_code === 'full', hot: st.padHot});
  };
  st.redrawBoard = () => {
    const o = st.order, files = delivery(o), br = o?.brief || {};
    st.board.surface.redraw({files, hot: st.fileHot, cover: st.coverImg?.complete && st.coverImg.naturalWidth ? st.coverImg : null, title: br.recipient ? `Para ${br.recipient}` : o?.product_name, sub: [br.occasion, o?.product_name].filter(Boolean).join(' · '), waiting: !pending(o), hint: pending(o) ? 'Tu entrega aparecerá aquí cuando el estudio termine tu canción.' : null});
    st.fileHits.forEach((hit, i) => {
      const f = files[i], extra = files.length > ROWS && i === ROWS - 1;
      hit.visible = extra || !!f;
      hit.userData.action = extra ? {type: 'session-downloads'} : f ? {type: 'session-file', id: f.id} : null;
    });
  };
  st.redrawMonitor = () => st.monitor.surface.redraw({order: st.order && {reference: st.order.reference, status: st.order.status, productName: st.order.product_name, production_stage: st.order.production_stage, product_code: st.order.product_code}, hint: st.hint});
  st.setOrder = o => {
    st.order = o || null; st.gift = !!o?.shared; if ((o?.reference || '') !== (st.refKey || '')) { st.refKey = o?.reference || ''; st.upload = {active: 0, progress: 0}; }
    const next = sigOf(o); if (next === sig) return; sig = next;
    const states = channelStates(o), names = shortFor(o); st.channels.forEach((ch, i) => { if (ch.state !== states[i] || ch.name !== names[i]) { ch.state = states[i]; ch.name = names[i]; ch.plate.surface.redraw({state: states[i], label: names[i]}); } });
    st.redrawMonitor(); st.redrawBoard(); st.redrawMsgs(); st.redrawPad();
    const audio = audioOf(o)[0], cover = delivery(o).filter(f => f.mime.startsWith('image/')).pop();
    st.hasSong = !!audio; st.refreshPlay(); st.redrawNow();
    if ((cover?.id ?? null) !== coverId) { coverId = cover?.id ?? null; st.coverImg = null; if (cover) { const im = new Image(); im.onload = () => { st.coverImg = im; st.redrawBoard(); }; im.src = siteUrl(`api.php?action=file&id=${cover.id}`); } if (cover) loader.load(siteUrl(`api.php?action=file&id=${cover.id}`), t => { t.colorSpace = THREE.SRGBColorSpace; st.label.material.map = t; st.label.material.color.set(0xffffff); st.label.material.needsUpdate = true; }); else { st.label.material.map = null; st.label.material.color.set(0x3a2370); st.label.material.needsUpdate = true; } }
    const payNow = !!o && !o.shared && ['created', 'payment_pending'].includes(o.status) && !!st.commerceReady; st.payPill.group.visible = payNow; st.payPill.hit.visible = payNow;
    st.payPill.set({text: o?.status === 'payment_pending' ? 'Abrir el pago otra vez' : 'Ir al pago seguro'});
    const canTalk = !!o && !o.shared && ['in_production', 'review', 'completed'].includes(o.status);   // a button that cannot do anything is not shown
    st.talkPill.group.visible = canTalk; st.talkPill.hit.visible = canTalk;
    const nUnread = st.badges().talk || 0, canFiles = !!st.padCan && !o.shared;
    st.coreTalk.set({text: nUnread ? `Mensajes · ${nUnread} ${nUnread === 1 ? 'nuevo' : 'nuevos'}` : 'Mensajes'});
    st.flags = {canFiles, canTalk}; st.coreFiles.set({text: st.padNeed ? 'Subir fotos y videos' : 'Subir material'}); st.playPill.group.visible = !!audio; st.playPill.hit.visible = !!audio;
    const canShare = !!audio && !o.shared && ['review', 'completed'].includes(o.status); st.sharePill.group.visible = canShare; st.sharePill.hit.visible = canShare;
    st.layoutDeck?.(); core.visible = !st.gift; st.giftCta.group.visible = st.giftCta.hit.visible = st.gift && !!audio;
    msgHit.visible = canTalk; platterHit.visible = !!audio;   // nothing to touch where nothing can happen
  };
  st.setCommerce = ready => { st.commerceReady = ready; if (st.order) { sig = ''; st.setOrder(st.order); } };
  st.setPlaying = on => { st.playing = on; st.refreshPlay(); };
  st.songTitle = () => { const b = st.order?.brief; return b?.recipient ? `Para ${b.recipient}${b.occasion ? ' · ' + b.occasion : ''}` : null; };
  st.redrawNow = () => st.now.surface.redraw({file: audioOf(st.order)[0] || null, on: st.playing, title: st.songTitle(), gift: st.gift});
  st.refreshPlay = () => { st.redrawNow?.(); st.playPill.set({on: st.playing, text: !st.hasSong ? 'Aún sin canción' : st.playing ? 'Pausar' : st.gift ? 'Escuchar la canción' : 'Escuchar mi canción'}); };
  st.setUpload = u => { st.upload = u; st.redrawPad(); };
  st.handle = a => {
    if (a.type === 'session-stage') { st.hint = a.index; st.hintTimer = 6; st.redrawMonitor(); s.pulse(0.5); return true; }
    return false;
  };
  // Phones: the two deck buttons shrink so both fit inside the narrow frame.
  st.relayout = portrait => { st.portrait = portrait; st.layoutDeck?.(); };
  st.layoutDeck = () => {
    // Phones: the frame is narrow, so one button takes the centre (Compartir for the buyer, Crear mi canción for a guest) and the HUD button (and the disc itself) play the song.
    const share = st.sharePill.group.visible, hidePlay = st.gift || (st.portrait && share), showPlay = !!st.hasSong && !hidePlay;
    st.playPill.group.visible = st.playPill.hit.visible = showPlay;
    st.playPill.group.position.x = (share || st.gift) && !st.portrait ? -1.8 : 0;
    st.sharePill.group.position.x = st.portrait ? 0 : 3.15; st.sharePill.group.scale.setScalar(st.portrait ? 1.1 : 1);
    st.giftCta.group.position.x = 0; st.giftCta.group.scale.setScalar(st.portrait ? 1.1 : 1);
  };
  st.setView = view => {
    st.view = view;
    if (view === 'session-talk') st.markSeen(); else if (st.order) { sig = ''; st.setOrder(st.order); }
    if (!SESSION_VIEWS.includes(view)) { st.hint = -1; }
  };

  // ================================================================= Camera
  st.shot = (portrait, view) => {
    const at = (g, x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
    if (view === 'session-song') return {focus: at(deck, 0, 6.4, 1.0), az: AZ.deck, pitch: -0.2, w: portrait ? 8.6 : 9.8, h: portrait ? 13.4 : 13.4, limits: {yaw: 24, pMin: -6, pMax: 20}};
    if (view === 'session-talk') return {focus: at(wall, 0, 4.8, 1.0), az: AZ.wall, pitch: -0.22, w: portrait ? 9.2 : 9.6, h: portrait ? 11.6 : 11.8, limits: {yaw: 24, pMin: -6, pMax: 20}};
    if (view === 'session-files') return {focus: at(core, 7.6, 2.9, 1.4), az: AZ.core, pitch: -0.3, w: portrait ? 6.2 : 7.4, h: portrait ? 6.4 : 5.4, limits: {yaw: 20, pMin: -14, pMax: 12}};
    if (portrait) return {focus: at(core, 0, 6.4, 0.5), az: AZ.core, pitch: 0.04, w: 11.6, h: 12.4, limits: {yaw: 70, pMin: -8, pMax: 16}};
    return {focus: at(core, 0, 5.6, 0.5), az: AZ.core, pitch: 0.05, w: 34, h: 13.6, limits: {yaw: 70, pMin: -8, pMax: 16}};
  };

  st.update = (dt, t, c) => {
    const inside = SESSION_VIEWS.includes(s.view);
    st.appear = s.still ? (inside ? 1 : 0) : damp(st.appear, inside ? 1 : 0, 5, dt);
    root.visible = st.appear > 0.02; if (!root.visible) return;
    root.scale.setScalar(0.94 + 0.06 * st.appear); st.wallFront.visible = s.view !== 'session-files';
    [core, deck, wall].forEach((g, i) => { const k = Math.max(0, Math.min(1, st.appear * 2.4 - i * 0.55)); g.position.y = (1 - k) * (1 - k) * -5; });   // the three corners rise from the floor one after another
    if (st.hintTimer > 0 && (st.hintTimer -= dt) <= 0 && st.hint >= 0) { st.hint = -1; st.redrawMonitor(); }
    // The buttons that belong to one corner exist only while the camera is in that corner (no slivers of them in the next view).
    const fl = st.flags || {}, on = (g, v) => { g.group.visible = g.hit.visible = v; };
    on(st.coreTalk, !!fl.canTalk && s.view === 'session'); on(st.coreFiles, !!fl.canFiles && s.view === 'session'); on(st.padPill, !!fl.canFiles && s.view === 'session-files');
    const hov = c.hovered, energy = c.playing && st.playing ? c.energy : 0, color = new THREE.Color();
    // meters + faders
    st.channels.forEach((ch, i) => {
      const k = ch.state, target = k === 'done' ? 1 : k === 'now' ? 0.55 + Math.sin(t * 2.4 + i) * 0.04 + energy * 0.35 : 0.1;
      ch.level = damp(ch.level, target, 6, dt); ch.hov = damp(ch.hov, hov === ch.plate ? 1 : 0, 12, dt);
      for (let j = 0; j < 10; j++) {
        const on = j < Math.round(ch.level * 10) || (k === 'now' && j === Math.round(ch.level * 10) && Math.sin(t * 7) > 0);
        if (!on) color.set(0x1c1433); else if (k === 'done') color.set(0x3dffc5); else if (k === 'now') color.set(0x8b5cff).lerp(new THREE.Color(0xff4fd8), j / 9); else color.set(0x4a3d7a);
        if (ch.hov > 0.05 && !on) color.lerp(new THREE.Color(0x4a3d7a), ch.hov * 0.5);
        st.segs.setColorAt(i * 10 + j, color);
      }
      const zt = k === 'done' ? -0.2 : k === 'now' ? 0.7 : 1.2; ch.capZ = damp(ch.capZ, zt, 5, dt); ch.cap.position.z = ch.capZ;
      ch.cap.material.emissive.set(k === 'done' ? 0x0f6b53 : k === 'now' ? 0x4a2a9a : 0x000000);
    });
    st.segs.instanceColor.needsUpdate = true;
    // pad
    const padHov = hov === st.pad ? 1 : 0; st.padHov = damp(st.padHov, padHov, 12, dt);
    const hot = padHov > 0.5; if (hot !== !!st.padHot) { st.padHot = hot; st.redrawPad(); }
    st.padGlow.material.opacity = (st.padNeed ? 0.25 + Math.sin(t * 3) * 0.12 : 0) + st.padHov * 0.2; st.padGlow.material.color.set(st.padNeed ? 0x22e4ff : 0xc6a2ff);
    // file rows hover
    const fi = st.fileHits.findIndex(h => h.visible && hov === h.userData.target);
    if (fi !== (st.fileHot ?? -1)) { st.fileHot = fi; st.redrawBoard(); }
    // deck
    const spinning = st.playing && c.playing;
    st.platter.rotation.y -= (s.still ? 0 : dt) * (spinning ? 3.2 : 0.12);
    st.arm.rotation.y = damp(st.arm.rotation.y, spinning ? -0.55 : 0.1, 3, dt);
    st.platterRing.material.opacity = 0.35 + (spinning ? 0.45 + energy * 0.2 : 0) + (hov === st.platter ? 0.2 : 0);
    st.deckGlow.material.opacity = 0.08 + (spinning ? 0.25 + energy * 0.2 : 0);
    st.playPill.update(dt, hov); st.coreTalk.update(dt, hov); st.coreFiles.update(dt, hov); st.padPill.update(dt, hov); st.giftCta.update(dt, hov); st.sharePill.update(dt, hov); st.talkPill.update(dt, hov); st.payPill.update(dt, hov); st.textPill.update(dt, hov);
  };
  s.stations.cockpit = st; s.updaters.push(st.update);
  return st;
}
