// «Mis canciones»: the customer's private crate. Every order made with the same email is a record on the wall.
// With nothing to show it is the quiet terminal of old (get your link by email).
import * as THREE from './vendor/three.module.js';
import {textPlane, neonText, roundRect, fit, wrap, glowSprite, damp, siteUrl, FONT} from './gfx.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, box, makeScreen, Pill} from './st-kit.js';
import {STATE} from './session-ui.js';

const TONE = {pay: '#ffc857', make: '#c9a0ff', review: '#38e1ff', done: '#3dffc5', off: '#a79bb8'};
const PER_PAGE = 6;
const loader = new THREE.TextureLoader(), cache = new Map();
const cover = id => { let t = cache.get(id); if (!t) { t = loader.load(siteUrl(`api.php?action=file&id=${id}`)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cache.set(id, t); } return t; };
const cut = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const lineOf = o => {
  const look = STATE[o.status] || STATE.created;
  if (o.status === 'completed') return o.songs > 1 ? `${o.songs} versiones listas` : 'Lista para escuchar';
  if (o.status === 'review') return 'Lista para tu opinión';
  if (['in_production', 'paid'].includes(o.status)) return `En producción · etapa ${Math.min(6, (Number(o.production_stage) || 0) + 1)} de 6`;
  return look.label;
};
const toneOf = o => TONE[(STATE[o.status] || STATE.created).tone] || TONE.off;
// Cover art of a song that has no cover yet: a coloured label with the first letter of who it is for.
function labelArt(o) {
  const tone = toneOf(o), ini = (o.recipient || '♪').trim().charAt(0).toUpperCase() || '♪';
  return textPlane(2, 2, (c, w, h) => {
    const g = c.createRadialGradient(w * 0.4, h * 0.35, 8, w / 2, h / 2, w * 0.7); g.addColorStop(0, tone + 'cc'); g.addColorStop(0.55, '#2a1a52'); g.addColorStop(1, '#0d0622'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = tone; c.shadowBlur = 26; c.font = `800 ${h * 0.5}px ${FONT.sans}`; c.fillText(ini, w / 2, h * 0.53);
  }, {px: 160, transparent: false});
}

export function buildLibrary(s) {
  const g = stationGroup(AZIMUTH.session); s.scene.add(g);
  const m = s.m, st = {group: g, orders: [], page: 0, focus: null, records: [], order: null};
  // Matte: a metallic back wall mirrors the room lights head-on and washes the discs out.
  st.backdrop = put(g, new THREE.BoxGeometry(13.8, 1, 0.5), new THREE.MeshStandardMaterial({color: 0x0f0824, roughness: 0.95, metalness: 0.05}), 0, 9.3, -1.5);
  const bar = (w, h) => put(g, new THREE.BoxGeometry(w, h, 0.06), m.neon, 0, 0, -1.2);
  st.bars = {top: bar(13.4, 0.06), bottom: bar(13.4, 0.06), left: bar(0.06, 1), right: bar(0.06, 1)};

  const vinyl = new THREE.MeshStandardMaterial({color: 0x08060c, roughness: 0.3, metalness: 0.6});
  for (let i = 0; i < PER_PAGE; i++) {
    const holder = new THREE.Group(); g.add(holder);
    const disc = put(holder, new THREE.CylinderGeometry(1.55, 1.55, 0.06, 56), vinyl); disc.rotation.x = Math.PI / 2;
    const art = put(holder, new THREE.CircleGeometry(1.14, 56), new THREE.MeshBasicMaterial({color: 0x2a1a52, toneMapped: false}), 0, 0, 0.04);
    put(holder, new THREE.CircleGeometry(0.07, 16), m.dark, 0, 0, 0.05);
    put(holder, new THREE.RingGeometry(1.2, 1.5, 56), new THREE.MeshBasicMaterial({color: 0x2c2145, transparent: true, opacity: 0.6, toneMapped: false}), 0, 0, 0.035);
    const ring = put(holder, new THREE.TorusGeometry(1.72, 0.07, 8, 64), new THREE.MeshBasicMaterial({color: 0xc9a0ff, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending}), 0, 0, -0.02);
    const glow = glowSprite(0xc9a0ff, 5, 0); glow.position.z = -0.3; holder.add(glow);
    const tag = textPlane(3.9, 1.1, (c, w, h, t) => {
      roundRect(c, 4, 4, w - 8, h - 8, h * 0.3); c.fillStyle = 'rgba(12,6,28,.9)'; c.fill(); c.lineWidth = 3; c.strokeStyle = t?.tone || 'rgba(198,162,255,.55)'; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; const a = t?.a || ''; fit(c, a, w * 0.9, h * 0.38, 800); c.fillText(a, w / 2, h * 0.34);
      c.fillStyle = t?.tone || '#b9a6e6'; const b = t?.b || ''; fit(c, b, w * 0.9, h * 0.25, 700); c.fillText(b, w / 2, h * 0.7);
    }, {px: 120});
    tag.mesh.position.set(0, -2.15, 0.06); holder.add(tag.mesh);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3.5, 4.3, 0.5), m.hit); hit.position.y = -0.6;
    hit.userData = {action: {type: 'order', index: i}, id: `lib:${i}`, target: holder}; holder.add(hit); s.pickables.push(hit);
    st.records.push({holder, disc, art, ring, glow, tag, hit, hov: 0, sel: 0, spin: 0, home: new THREE.Vector3(), order: null});
    holder.visible = false;
  }

  // Buttons under the wall: paging, a new song, and the mail door for someone whose link is on another device.
  st.bar = new THREE.Group(); g.add(st.bar);   // the button strip hangs under the wall wherever the wall ends
  const pill = (label, action, id, x, color, icon, w = 4.4) => { const p = new Pill(s, {w, h: 0.95, label, action, id, color, icon}); p.group.position.x = x; st.bar.add(p.group); return p; };
  st.prevPill = pill('Anteriores', {type: 'lib-page', dir: -1}, 'lib-prev', -2.2, '#c6a2ff', null, 3.4);
  st.nextPill = pill('Siguientes', {type: 'lib-page', dir: 1}, 'lib-next', 2.2, '#c6a2ff', null, 3.4);
  st.mailPill = pill('Recibir mi enlace por correo', {type: 'mail'}, 'lib-mail', 0, '#c6a2ff', 'mail', 6.2);
  st.pills = [st.prevPill, st.nextPill, st.mailPill];

  st.screen = makeScreen(s, 10.4, 1.75, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1e1040'); bg.addColorStop(1, '#0a0520'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.11}px ${FONT.sans}`;
    if (!state?.n) {
      c.fillText('FROMHEARTBEAT · SALA PRIVADA', w * 0.04, h * 0.2);
      neonText(c, 'Mi sesión', w * 0.04, h * 0.56, {size: h * 0.38, color: '#c9a8ff', align: 'left', blur: 18, maxW: w * 0.9});
      c.fillStyle = '#efe6ff'; c.font = `500 ${h * 0.15}px ${FONT.sans}`; c.fillText('Aquí viven todas tus canciones. Entra con el enlace de tu correo.', w * 0.04, h * 0.87, w * 0.92); return;
    }
    c.fillText(state.pages > 1 ? `TU COLECCIÓN · PÁGINA ${state.page + 1} DE ${state.pages}` : 'TU COLECCIÓN PRIVADA', w * 0.04, h * 0.2);
    neonText(c, 'Mis canciones', w * 0.04, h * 0.56, {size: h * 0.38, color: '#d5bcff', align: 'left', blur: 16, maxW: w * 0.9});
    c.fillStyle = '#efe6ff'; c.font = `500 ${h * 0.15}px ${FONT.sans}`;
    c.fillText(`${state.n} ${state.n === 1 ? 'canción' : 'canciones'}${state.ready ? ` · ${state.ready} para escuchar` : ''} · toca un disco para entrar`, w * 0.04, h * 0.87, w * 0.92);
  });
  g.add(st.screen.group);

  st.setOrders = list => {
    const key = JSON.stringify(list.map(o => [o.reference, o.status, o.production_stage, o.cover_id, o.songs]));
    if (key === st.key) return; st.key = key;
    st.orders = list; st.page = Math.min(st.page, Math.max(0, Math.ceil(list.length / PER_PAGE) - 1)); st.fill();
  };
  st.fill = () => {
    const list = st.orders, pages = Math.max(1, Math.ceil(list.length / PER_PAGE)), from = st.page * PER_PAGE;
    st.records.forEach((r, i) => {
      const o = list[from + i]; r.order = o || null; r.holder.visible = !!o; if (!o) return;
      const mat = r.art.material; mat.color.set(0xffffff);
      if (o.cover_id) mat.map = cover(o.cover_id); else { if (r.labelArt) r.labelArt.surface.dispose?.(); r.labelArt = labelArt(o); mat.map = r.labelArt.surface.tex; }
      mat.needsUpdate = true;
      const tone = toneOf(o); r.ring.material.color.set(tone); r.glow.material.color.set(tone); r.tone = tone;
      r.tag.surface.redraw({a: o.recipient ? `Para ${cut(o.recipient, 22)}` : cut(o.product_name, 26), b: lineOf(o), tone});
      r.hit.userData.action = {type: 'order', ref: o.reference};
    });
    st.prevPill.group.visible = st.prevPill.hit.visible = st.page > 0; st.nextPill.group.visible = st.nextPill.hit.visible = st.page < pages - 1;
    const none = !list.length;
    st.mailPill.group.visible = st.mailPill.hit.visible = none;
    st.screen.surface.redraw({n: list.length, page: st.page, pages, ready: list.filter(o => ['completed', 'review'].includes(o.status)).length});
    st.relayout(s.portrait);
  };
  st.handle = a => {
    if (a.type !== 'lib-page') return false;
    const pages = Math.ceil(st.orders.length / PER_PAGE); st.page = Math.max(0, Math.min(pages - 1, st.page + a.dir)); st.fill(); return true;
  };
  st.relayout = portrait => {
    const shown = st.records.filter(r => r.order).length, empty = !shown;
    const cols = portrait ? 2 : 3, sx = portrait ? 4.0 : 4.4, sy = 4.35, n = Math.max(1, shown), rows = Math.ceil(n / cols);
    const top = portrait ? 15.8 : 11.6;
    let k = 0;
    st.records.forEach(r => {
      if (!r.order) return; const row = Math.floor(k / cols), col = k % cols, inRow = Math.min(cols, n - row * cols); k++;
      r.home.set((col - (inRow - 1) / 2) * sx, top - 1.5 - row * sy, 0); r.holder.position.copy(r.home);
    });
    const lastCentre = top - 1.5 - (rows - 1) * sy, wallTop = top + 3.0, wallBottom = empty ? top - 1.6 : lastCentre - 3.2, wallH = wallTop - wallBottom;
    st.backdrop.scale.y = wallH; st.backdrop.position.y = (wallTop + wallBottom) / 2;
    const B = st.bars, cy = (wallTop + wallBottom) / 2;
    B.top.position.y = wallTop; B.bottom.position.y = wallBottom; B.left.scale.y = B.right.scale.y = wallH; B.left.position.set(-6.7, cy, -1.2); B.right.position.set(6.7, cy, -1.2);
    st.screen.group.position.set(0, top + 1.55 - (empty ? 1.6 : 0), 0.05);
    st.bar.position.set(0, wallBottom - 1.15, 0.5);
    st.layout = {portrait, top: wallTop, bottom: wallBottom - 2.1, empty};
  };
  st.update = (dt, t, c) => {
    const calm = s.still ? 0 : dt;
    st.records.forEach(r => {
      if (!r.order) return;
      r.sel = damp(r.sel, r.order.reference === st.focus ? 1 : 0, 10, dt); r.hov = damp(r.hov, c.hovered === r.holder ? 1 : 0, 12, dt);
      r.disc.rotation.y += calm * (['completed', 'review'].includes(r.order.status) ? 0.5 : 0.1);
      r.holder.scale.setScalar(1 + r.hov * 0.07 + r.sel * 0.03); r.holder.position.z = r.hov * 0.25 + r.sel * 0.2;
      r.ring.material.opacity = r.sel * 0.9 + r.hov * 0.4; r.glow.material.opacity = r.sel * 0.4 + r.hov * 0.15;
    });
    st.pills.forEach(p => p.update(dt, c.hovered));
  };
  st.setOrder = () => {};
  st.shot = portrait => {
    const L = st.layout || {top: portrait ? 18 : 15, bottom: -1.3}, mid = (L.top + L.bottom) / 2;
    return {focus: g.localToWorld(new THREE.Vector3(0, mid, 0.5)), az: AZIMUTH.session, pitch: 0.03, w: portrait ? 9.8 : 14.4, h: L.top - L.bottom + 2.4, limits: {yaw: 28, pMin: -8, pMax: 12}};
  };
  st.setOrders([]);
  s.stations.session = st; s.updaters.push(st.update);
  return st;
}
