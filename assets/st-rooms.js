// The information wall (about, terms, privacy).
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, neonText, roundRect, fit, wrap, roundedSlab, glowSprite, damp, FONT} from './gfx.js';
import {drawIcon} from './icons.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, box, neonFrame, makeScreen, Pill} from './st-kit.js';


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
