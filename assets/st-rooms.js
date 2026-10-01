// Two quiet corners: the private terminal ("Mi sesión") and the information wall (about, terms, privacy).
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, neonText, roundRect, fit, wrap, roundedSlab, glowSprite, damp, FONT} from './gfx.js';
import {drawIcon} from './icons.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, box, neonFrame, makeScreen, Pill} from './st-kit.js';

import {STATE, STAGE_INFO} from './session-ui.js';
const TONE = {pay: '#ffc857', make: '#c9a0ff', review: '#38e1ff', done: '#3dffc5', off: '#a79bb8'};
const SHORT = ['Historia', 'Letra', 'Voz', 'Producción', 'Mezcla', 'Entrega'];

export function buildSession(s) {
  const g = stationGroup(AZIMUTH.session); s.scene.add(g);
  const m = s.m, st = {group: g, order: null};
  put(g, new THREE.BoxGeometry(13, 12.6, 0.5), m.dark, 0, 6.3, -3);
  const fr = new THREE.Group(); fr.position.set(0, 6.3, -2.7); g.add(fr); neonFrame(fr, 12.6, 12.2, m.neon, 0.06);
  box(g, 10.4, 1.2, 3.4, m.panel, 0, 0.6, 1.2); box(g, 10.5, 0.06, 0.06, m.accent, 0, 1.22, 2.9);
  box(g, 3.4, 0.08, 1.2, m.metal, 0, 1.28, 2.0);

  st.screen = makeScreen(s, 9.2, 5.3, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1e1040'); bg.addColorStop(1, '#0a0520'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,110,255,.06)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1.5);
    const px = w * 0.06, o = state?.order; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.05}px ${FONT.sans}`; c.fillText(o ? `TU SESIÓN · ${o.reference}` : 'FROMHEARTBEAT · SALA PRIVADA', px, h * 0.08);
    if (!o) {
      neonText(c, 'Mi sesión', px, h * 0.3, {size: h * 0.2, color: '#c9a8ff', align: 'left', blur: 20});
      c.fillStyle = '#efe6ff'; c.font = `500 ${h * 0.07}px ${FONT.sans}`;
      wrap(c, 'Sigue tu canción etapa por etapa y escúchala cuando esté lista. Entras con el enlace de tu pedido, sin crear cuenta.', w * 0.88).slice(0, 3).forEach((l, i) => c.fillText(l, px, h * 0.5 + i * h * 0.1));
      c.fillStyle = '#b9a6e6'; c.font = `600 ${h * 0.058}px ${FONT.sans}`; c.fillText('Toca la pantalla para abrir tus pedidos ↗', px, h * 0.88);
      return;
    }
    const look = STATE[o.status] || STATE.created, tone = TONE[look.tone], stage = Number(o.stage ?? 0), pending = ['created', 'payment_pending'].includes(o.status), finished = o.status === 'completed';
    neonText(c, look.label, px, h * 0.24, {size: h * 0.15, color: tone, align: 'left', blur: 18, maxW: w * 0.88});
    c.fillStyle = '#efe6ff'; c.font = `500 ${h * 0.058}px ${FONT.sans}`; c.textAlign = 'left';
    const says = o.status === 'in_production' ? STAGE_INFO[stage][1] : look.says;
    wrap(c, says, w * 0.88).slice(0, 2).forEach((l, k) => c.fillText(l, px, h * 0.4 + k * h * 0.072));
    // Six channels, like the faders of a console: full = done, lit = now, empty = soon.
    const span = w - px * 2, col = span / 6, top = h * 0.57, bot = h * 0.82;
    SHORT.forEach((label, k) => {
      const cx = px + col * (k + 0.5), state = finished || (!pending && k < stage) ? 'done' : !pending && k === stage ? 'now' : 'next';
      c.fillStyle = 'rgba(255,255,255,.1)'; roundRect(c, cx - col * 0.16, top, col * 0.32, bot - top, col * 0.08); c.fill();
      const fill = state === 'done' ? 1 : state === 'now' ? 0.55 : 0;
      if (fill) { c.fillStyle = state === 'done' ? '#3dffc5' : '#b57cff'; c.shadowColor = c.fillStyle; c.shadowBlur = state === 'now' ? 18 : 8; roundRect(c, cx - col * 0.16, bot - (bot - top) * fill, col * 0.32, (bot - top) * fill, col * 0.08); c.fill(); c.shadowBlur = 0; }
      c.fillStyle = state === 'next' ? '#8f7cb8' : '#ffffff'; c.font = `${state === 'now' ? 800 : 600} ${h * 0.05}px ${FONT.sans}`; c.textAlign = 'center'; c.fillText(label, cx, h * 0.89, col * 0.96);
      c.font = `700 ${h * 0.04}px ${FONT.sans}`; c.fillStyle = state === 'now' ? '#d9c0ff' : '#8f7cb8'; c.fillText(state === 'now' ? 'AHORA' : String(k + 1), cx, h * 0.945);
    });
  }, {px: 120});
  st.screen.group.position.set(0, 6.4, -2.4); g.add(st.screen.group);
  const hit = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 5.7), m.hit); hit.position.set(0, 6.4, -2.2); hit.userData = {action: {type: 'go', view: 'recover'}, id: 'terminal', target: st.screen}; g.add(hit); s.pickables.push(hit);
  st.pill = new Pill(s, {w: 5.4, h: 1.0, label: 'Abrir mi sesión', action: {type: 'go', view: 'recover'}, id: 'session-open', color: '#c6a2ff', icon: 'user'});
  st.pill.group.position.set(0, 1.9, 3.2); st.pill.group.rotation.x = -0.4; g.add(st.pill.group);

  st.setOrder = o => { st.order = o; st.screen.surface.redraw({order: o}); };
  st.update = (dt, t, c) => { st.pill.update(dt, c.hovered); };
  st.shot = portrait => ({focus: g.localToWorld(new THREE.Vector3(0, 5.2, 0)), az: AZIMUTH.session, pitch: 0.03, w: portrait ? 10.2 : 13, h: portrait ? 11.4 : 11.2, limits: {yaw: 26, pMin: -8, pMax: 12}});
  s.stations.session = st; s.updaters.push(st.update);
  return st;
}

export function buildAbout(s) {
  const g = stationGroup(AZIMUTH.about); s.scene.add(g);
  const m = s.m, st = {group: g, plaques: []};
  put(g, new THREE.BoxGeometry(11, 13.4, 0.5), m.dark, 0, 6.7, -3);
  const fr = new THREE.Group(); fr.position.set(0, 6.7, -2.7); g.add(fr); neonFrame(fr, 10.6, 13, m.neon, 0.06);
  const items = [['about', 'heart', 'El estudio', 'Quiénes somos y cómo trabajamos', '#ff4fd8'], ['terms', 'lines', 'Términos', 'Lo que compras, pagos y entrega', '#22e4ff'], ['privacy', 'lock', 'Privacidad', 'Tu historia, segura', '#ffd23f']];
  const head = textPlane(8.6, 1.4, (c, w, h) => { neonText(c, 'INFORMACIÓN', w / 2, h * 0.5, {size: h * 0.5, color: '#cdb0ff', blur: 22, maxW: w * 0.9}); }, {px: 130, additive: true});
  head.mesh.position.set(0, 12.2, -2.4); g.add(head.mesh);
  items.forEach(([view, icon, title, sub, color], i) => {
    const y = 9.0 - i * 3.5, grp = new THREE.Group(); grp.position.set(0, y, -2.2); g.add(grp);
    put(grp, roundedSlab(8.4, 2.9, 0.18, 0.4, 0.03), new THREE.MeshStandardMaterial({color: 0x1a0f30, metalness: 0.5, roughness: 0.35}));
    const face = textPlane(8.3, 2.8, (c, w, h, state) => {
      roundRect(c, 6, 6, w - 12, h - 12, h * 0.16); const bg = c.createLinearGradient(0, 0, w, 0); bg.addColorStop(0, '#231348'); bg.addColorStop(1, '#0d0622'); c.fillStyle = bg; c.fill();
      c.lineWidth = 6; c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = 16; c.stroke(); c.shadowBlur = 0;
      drawIcon(c, icon, h * 0.5, h * 0.5, h * 0.5, {color, width: 1.8, glow: 18});
      c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; c.font = `800 ${h * 0.26}px ${FONT.sans}`; fit(c, title, w - h * 2.1, h * 0.26, 800); c.fillText(title, h * 1.0, h * 0.4);
      c.fillStyle = '#c9b8ee'; fit(c, sub, w - h * 1.3, h * 0.13, 500); c.fillText(sub, h * 1.0, h * 0.68);
      c.fillStyle = color; c.font = `700 ${h * 0.12}px ${FONT.sans}`; c.textAlign = 'right'; c.fillText('Abrir ↗', w - h * 0.28, h * 0.5);
    }, {px: 110});
    face.mesh.position.z = 0.15; grp.add(face.mesh);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 2.9), m.hit); hit.position.z = 0.17; hit.userData = {action: {type: 'go', view}, id: `info:${view}`, target: grp}; grp.add(hit); s.pickables.push(hit);
    st.plaques.push({grp, hov: 0});
  });
  st.update = (dt, t, c) => st.plaques.forEach(p => { p.hov = damp(p.hov, c.hovered === p.grp ? 1 : 0, 12, dt); p.grp.scale.setScalar(1 + p.hov * 0.03); p.grp.position.z = -2.2 + p.hov * 0.25; });
  st.shot = portrait => ({focus: g.localToWorld(new THREE.Vector3(0, 6.7, 0)), az: AZIMUTH.about, pitch: 0.03, w: portrait ? 9.2 : 11.4, h: 13.6, limits: {yaw: 26, pMin: -8, pMax: 12}});
  s.stations.about = st; s.updaters.push(st.update);
  return st;
}
