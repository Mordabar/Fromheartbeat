// Lounge: where the story is written. A big plaque above the sofa shows, live, what the visitor types.
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, neonText, roundRect, fit, wrap, glowSprite, signature, FONT} from './gfx.js';
import {drawIcon, iconFor} from './icons.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, box, neonFrame, makeScreen} from './st-kit.js';

export function buildLounge(s) {
  const g = stationGroup(AZIMUTH.story); s.scene.add(g);
  const m = s.m, st = {group: g, draft: null};

  // Room: back wall, rug, sofa, table with an open notebook, floor lamp.
  put(g, new THREE.BoxGeometry(14.5, 13, 0.5), m.dark, 0, 6.5, -3.4);
  const frame = new THREE.Group(); frame.position.set(0, 6.5, -3.1); g.add(frame); neonFrame(frame, 14.1, 12.6, m.neon, 0.06);
  const rug = put(g, new THREE.CircleGeometry(6.4, 64), new THREE.MeshStandardMaterial({color: 0x24173f, roughness: 1}), 0, 0.03, 1.2); rug.rotation.x = -Math.PI / 2;
  const rugRing = put(g, new THREE.TorusGeometry(6.4, 0.05, 8, 96), m.accent, 0, 0.06, 1.2); rugRing.rotation.x = Math.PI / 2;
  box(g, 7.2, 1.0, 2.6, m.fabric, 0, 0.5, -1.4); box(g, 7.2, 2.4, 0.8, m.fabric, 0, 1.9, -2.5);
  for (const x of [-3.9, 3.9]) box(g, 0.7, 1.6, 2.9, m.fabric, x, 0.8, -1.3);
  for (const [x, c] of [[-2, 0xff4fd8], [2, 0x22e4ff]]) box(g, 1.4, 1.2, 0.45, new THREE.MeshStandardMaterial({color: c, roughness: 0.8, emissive: c, emissiveIntensity: 0.15}), x, 1.6, -0.6).rotation.z = x < 0 ? 0.12 : -0.1;
  put(g, new THREE.CylinderGeometry(2.1, 2.1, 0.14, 48), m.metal, 0, 1.15, 3.2);
  put(g, new THREE.CylinderGeometry(0.16, 0.16, 1.1, 12), m.metal, 0, 0.55, 3.2);
  put(g, new THREE.TorusGeometry(2.1, 0.04, 6, 64), m.accent, 0, 1.15, 3.2).rotation.x = Math.PI / 2;
  // Notebook: two tilted pages with ruled lines and a glowing ribbon.
  const page = new THREE.MeshBasicMaterial({map: new Surface(256, 320, (c, w, h) => {
    c.fillStyle = '#f3ecff'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(120,90,190,.35)'; c.lineWidth = 2;
    for (let y = 60; y < h - 20; y += 30) { c.beginPath(); c.moveTo(24, y); c.lineTo(w - 24, y); c.stroke(); }
    c.strokeStyle = 'rgba(255,79,216,.5)'; c.beginPath(); c.moveTo(48, 20); c.lineTo(48, h - 20); c.stroke();
  }, {aniso: 4}).tex, toneMapped: false});
  const book = new THREE.Group(); book.position.set(0, 1.3, 3.2); book.rotation.x = -0.12; g.add(book);
  for (const sgn of [-1, 1]) { const p = put(book, new THREE.BoxGeometry(1.5, 0.05, 1.9), page, sgn * 0.77, 0, 0); p.rotation.z = sgn * -0.05; }
  put(book, new THREE.BoxGeometry(0.06, 0.06, 1.95), m.pink, 0, -0.02, 0);
  st.bookGlow = glowSprite(0xff4fd8, 4.5, 0.25); st.bookGlow.position.set(0, 1.8, 3.2); g.add(st.bookGlow);
  put(g, new THREE.CylinderGeometry(0.05, 0.05, 4.6, 8), m.metal, -6.2, 2.3, -0.4); put(g, new THREE.SphereGeometry(0.4, 20, 16), m.neon, -6.2, 4.8, -0.4);
  const lampGlow = glowSprite(0xc6a2ff, 6, 0.32); lampGlow.position.set(-6.2, 4.8, -0.4); g.add(lampGlow);

  // The plaque: kicker, who it is for, the occasion, the story so far and a meter for the minimum length.
  const MIN = 30;
  st.screen = makeScreen(s, 10.4, 4.6, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1e1040'); bg.addColorStop(1, '#0a0520'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,110,255,.06)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1.5);
    const d = state?.draft || {}, px = w * 0.05;
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.058}px ${FONT.sans}`; c.fillText('LOUNGE · PASO 4 DE 6 · TU HISTORIA', px, h * 0.09);
    if (!d.recipient?.trim()) {
      neonText(c, 'Cuéntanos la historia', px, h * 0.36, {size: h * 0.17, color: '#ff8de6', align: 'left', blur: 18, maxW: w * 0.9});
      c.fillStyle = '#efe6ff'; c.font = `500 ${h * 0.075}px ${FONT.sans}`;
      wrap(c, 'Para quién es, qué celebran y ese detalle que solo ustedes entienden. Escribe a la derecha o abajo: aquí se va formando.', w * 0.88).slice(0, 3).forEach((l, i) => c.fillText(l, px, h * 0.58 + i * h * 0.095));
    } else {
      c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.065}px ${FONT.sans}`; c.fillText('UNA CANCIÓN PARA', px, h * 0.21);
      neonText(c, d.recipient.trim(), px, h * 0.39, {size: h * 0.2, color: '#ff8de6', align: 'left', blur: 20, maxW: w * 0.9});
      if (d.occasion?.trim()) {
        const occ = d.occasion.trim(); c.font = `700 ${h * 0.07}px ${FONT.sans}`;
        const tw = Math.min(c.measureText(occ).width, w * 0.5) + h * 0.16 + h * 0.13;
        roundRect(c, px, h * 0.53, tw, h * 0.11, h * 0.055); c.fillStyle = 'rgba(255,141,230,.16)'; c.fill(); c.strokeStyle = '#ff8de6'; c.lineWidth = 3; c.stroke();
        drawIcon(c, iconFor('occasion', occ), px + h * 0.075, h * 0.585, h * 0.075, {color: '#ff8de6', width: 2});
        c.fillStyle = '#ffd6f6'; c.textBaseline = 'middle'; c.fillText(occ, px + h * 0.14, h * 0.59, w * 0.5);
      }
      const story = (d.story || '').trim();
      c.fillStyle = story ? '#efe6ff' : '#8f7cb8'; c.font = `italic 500 ${h * 0.078}px ${FONT.serif}`;
      const lines = wrap(c, story ? `“${story}${story.length > 150 ? '' : '”'}` : 'Aquí aparecerá tu historia…', w * 0.9);
      lines.slice(0, 2).forEach((l, i) => c.fillText(i === 1 && lines.length > 2 ? l.replace(/\s*\S*$/, '…') : l, px, h * 0.735 + i * h * 0.09));
    }
    const n = (d.story || '').trim().length, k = Math.min(1, n / MIN);
    roundRect(c, px, h * 0.905, w * 0.5, h * 0.03, h * 0.015); c.fillStyle = 'rgba(255,255,255,.12)'; c.fill();
    roundRect(c, px, h * 0.905, Math.max(h * 0.03, w * 0.5 * k), h * 0.03, h * 0.015); c.fillStyle = k >= 1 ? '#3dffc5' : '#ff8de6'; c.shadowColor = c.fillStyle; c.shadowBlur = 10; c.fill(); c.shadowBlur = 0;
    c.fillStyle = k >= 1 ? '#3dffc5' : '#a992d9'; c.font = `700 ${h * 0.05}px ${FONT.sans}`; c.fillText(k >= 1 ? '✓ Historia lista para la canción' : `${n} / ${MIN} caracteres mínimos`, px + w * 0.52, h * 0.92);
  }, {px: 130});
  st.screen.group.position.set(0, 8.4, -2.7); g.add(st.screen.group);

  st.setDraft = d => { st.draft = d; const sig = signature(d, ['recipient', 'occasion', 'story']); if (sig === st.sig) return; st.sig = sig; st.screen.surface.redraw({draft: d}); };
  st.update = (dt, t, c) => { st.bookGlow.material.opacity = 0.2 + Math.sin(t * 1.5) * 0.06 + c.energy * 0.1; };
  st.shot = (portrait, view, studio) => {
    const free = studio.free, tight = free && (free[3] - free[1]) < innerHeight * 0.62;       // a form covers part of the screen
    if (tight) return {focus: g.localToWorld(new THREE.Vector3(0, 8.4, -2.7)), az: AZIMUTH.story, pitch: 0.03, w: 11.4, h: 5.6, limits: {yaw: 20, pMin: -6, pMax: 10}};
    return {focus: g.localToWorld(new THREE.Vector3(0, 5.4, 0)), az: AZIMUTH.story, pitch: 0.05, w: portrait ? 11.4 : 14.6, h: portrait ? 12.6 : 11.8, limits: {yaw: 28, pMin: -8, pMax: 12}};
  };
  s.stations.story = st; s.updaters.push(st.update);
  return st;
}
