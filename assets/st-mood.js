// Mood halo: twelve orbs of light around the logo. Choosing one tints the whole studio; the marquee reads it out.
// Also home of the checkout ticket that recaps the order in front of the logo.
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, neonText, roundRect, fit, wrap, glowSprite, damp, signature, FONT} from './gfx.js';
import {drawIcon, iconFor} from './icons.js';
import {MOODS} from './world.js';
import {MOOD_INFO, PRODUCT_COLOR} from './content.js';
import {put} from './st-kit.js';

const hexOf = n => '#' + n.toString(16).padStart(6, '0');

class Orb {
  constructor(s, mood, index) {
    this.value = mood; this.index = index; this.color = new THREE.Color(MOODS[mood] ?? 0x9b5cff);
    const col = hexOf(MOODS[mood] ?? 0x9b5cff), g = this.group = new THREE.Group();
    this.core = put(g, new THREE.SphereGeometry(0.6, 28, 20), new THREE.MeshBasicMaterial({color: this.color.clone().multiplyScalar(0.85), toneMapped: false}));
    this.shell = put(g, new THREE.SphereGeometry(0.78, 32, 24), new THREE.MeshStandardMaterial({color: this.color, emissive: this.color, emissiveIntensity: 0.55, transparent: true, opacity: 0.34, roughness: 0.1, metalness: 0.1, depthWrite: false}));
    this.ring = put(g, new THREE.TorusGeometry(1.0, 0.045, 8, 56), new THREE.MeshBasicMaterial({color: this.color, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending}));
    this.glow = glowSprite(this.color, 3.6, 0.28); g.add(this.glow);
    const icon = new Surface(128, 128, c => drawIcon(c, iconFor('mood', mood) === 'sparkle' && mood !== 'Inspiradora' ? 'sparkle' : (MOOD_ICON_FOR(mood)), 64, 64, 86, {color: '#ffffff', width: 2.2, glow: 8}), {aniso: 2});
    this.icon = new THREE.Sprite(new THREE.SpriteMaterial({map: icon.tex, transparent: true, toneMapped: false, depthTest: false, opacity: 0.95}));
    this.icon.scale.setScalar(0.92); this.icon.renderOrder = 5; g.add(this.icon);
    const tag = textPlane(1.95, 0.5, (c, w, h) => {
      roundRect(c, 4, 4, w - 8, h - 8, h * 0.4); c.fillStyle = 'rgba(12,6,28,.86)'; c.fill(); c.lineWidth = 3; c.strokeStyle = col; c.stroke();
      c.fillStyle = '#f6efff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, mood, w * 0.86, h * 0.52, 700); c.fillText(mood, w / 2, h / 2 + 1);
    }, {px: 150});
    tag.mesh.position.set(0, -1.18, 0.1); g.add(tag.mesh);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), s.m.hit);
    hit.userData = {action: {type: 'pick', kind: 'mood', value: mood}, id: `mood:${mood}`, target: this}; g.add(hit); s.pickables.push(hit);
    this.hit = hit; this.sel = 0; this.hov = 0; this.appear = 0; this.press = 0; this.selected = false;
    this.base = new THREE.Vector3();
  }
}
import {MOOD_ICON} from './icons.js';
const MOOD_ICON_FOR = m => MOOD_ICON[m] || 'sparkle';

export function buildMood(s) {
  const stage = s.stage.group, m = s.m;
  const st = {group: new THREE.Group(), orbs: [], draft: null, view: 'lobby', appear: 0, ticketAppear: 0};
  st.group.position.set(0, 8.6, 2.6); stage.add(st.group);

  st.setContent = content => {
    st.orbs.forEach(o => { st.group.remove(o.group); const i = s.pickables.indexOf(o.hit); if (i >= 0) s.pickables.splice(i, 1); });
    st.orbs = content.moods.map((mood, i) => new Orb(s, mood, i));
    st.orbs.forEach(o => { st.group.add(o.group); o.group.visible = false; });
    st.sigMood = st.sigTicket = null; st.ticketStale = true;
    st.relayout(s.portrait); st.setDraft(st.draft || {});
  };
  st.relayout = portrait => {
    const n = st.orbs.length || 1, rx = portrait ? 4.5 : 5.7, ry = portrait ? 6.1 : 5.5;
    st.orbs.forEach((o, i) => { const a = i / n * Math.PI * 2; o.base.set(Math.sin(a) * rx, Math.cos(a) * ry, 0); });
    st.portrait = portrait;
  };

  // Readout plaque at the foot of the stage: the question, then the chosen mood and what it is for.
  st.plaque = textPlane(10.4, 2.6, (c, w, h, state) => {
    roundRect(c, 6, 6, w - 12, h - 12, h * 0.16); const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgba(30,16,62,.94)'); bg.addColorStop(1, 'rgba(10,5,24,.94)'); c.fillStyle = bg; c.fill();
    c.lineWidth = 5; c.strokeStyle = state?.color || '#c6a2ff'; c.shadowColor = c.strokeStyle; c.shadowBlur = 16; c.stroke(); c.shadowBlur = 0;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.11}px ${FONT.sans}`; c.fillText('LA LUZ · PASO 2 DE 6', w / 2, h * 0.2);
    if (state?.name) { neonText(c, state.name.toUpperCase(), w / 2, h * 0.5, {size: h * 0.36, color: state.color, blur: 22, maxW: w * 0.86}); c.fillStyle = '#f2eaff'; fit(c, state.sub || '', w * 0.86, h * 0.17, 600); c.fillText(state.sub || '', w / 2, h * 0.8); }
    else neonText(c, '¿Cómo quieres que se sienta?', w / 2, h * 0.58, {size: h * 0.3, color: '#d5bcff', blur: 16, maxW: w * 0.9});
  }, {px: 130});
  st.plaque.mesh.position.set(0, 1.9, 5.6); stage.add(st.plaque.mesh); st.plaque.mesh.visible = false;

  // ---- Checkout ticket ---------------------------------------------------------------------------------------------
  st.ticket = textPlane(5.6, 7.4, (c, w, h, state) => {
    const d = state?.draft || {}, p = state?.product;
    const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#221244'); bg.addColorStop(1, '#0d0620');
    roundRect(c, 8, 8, w - 16, h - 16, 40); c.fillStyle = bg; c.fill(); c.lineWidth = 6; c.strokeStyle = '#c6a2ff'; c.shadowColor = '#c6a2ff'; c.shadowBlur = 18; c.stroke(); c.shadowBlur = 0;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#a992d9'; c.font = `700 ${w * 0.036}px ${FONT.sans}`; c.fillText('FROMHEARTBEAT · TU SESIÓN', w * 0.1, h * 0.075);
    c.setLineDash([10, 10]); c.strokeStyle = 'rgba(198,162,255,.4)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.08, h * 0.115); c.lineTo(w * 0.92, h * 0.115); c.stroke(); c.setLineDash([]);
    const rows = [['icon:sliders', 'SONIDO', [d.genre, d.mood].filter(Boolean).join(' · ') || '—'], ['icon:mic', 'VOZ', [d.voice, d.language, d.tempo].filter(Boolean).join(' · ') || '—'], ['icon:heart', 'PARA', [d.recipient, d.occasion].filter(Boolean).join(' · ') || '—'], ['icon:star', 'EXPERIENCIA', p ? p.name : '—']];
    rows.forEach(([ic, label, value], i) => {
      const y = h * (0.19 + i * 0.145);
      drawIcon(c, ic.slice(5), w * 0.13, y + h * 0.01, w * 0.09, {color: '#c6a2ff', width: 1.9});
      c.fillStyle = '#a992d9'; c.font = `700 ${w * 0.032}px ${FONT.sans}`; c.textAlign = 'left'; c.fillText(label, w * 0.22, y - h * 0.026);
      c.fillStyle = '#f6efff'; fit(c, value, w * 0.68, w * 0.062, 700); c.fillText(value, w * 0.22, y + h * 0.03);
    });
    c.setLineDash([10, 10]); c.strokeStyle = 'rgba(198,162,255,.4)'; c.beginPath(); c.moveTo(w * 0.08, h * 0.79); c.lineTo(w * 0.92, h * 0.79); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#a992d9'; c.font = `700 ${w * 0.036}px ${FONT.sans}`; c.fillText('TOTAL', w * 0.1, h * 0.845);
    neonText(c, p ? p.priceText : '—', w * 0.9, h * 0.905, {size: w * 0.115, color: p ? (PRODUCT_COLOR[p.code] || '#c6a2ff') : '#c6a2ff', align: 'right', blur: 16, maxW: w * 0.8});
  }, {px: 130});
  st.ticket.mesh.position.set(0, 0, 2.2); st.ticket.mesh.position.y = -1.0; st.group.add(st.ticket.mesh); st.ticket.mesh.visible = false;
  const product = () => (s.content?.products || []).find(p => p.code === st.draft?.product);
  st.redrawTicket = () => st.ticket.surface.redraw({draft: st.draft, product: product()});

  st.refreshMarquee = () => {
    const d = st.draft || {};
    st.plaque.surface.redraw(d.mood ? {name: d.mood, sub: MOOD_INFO[d.mood], color: hexOf(MOODS[d.mood] ?? 0x9b5cff)} : {});
  };
  st.setDraft = d => {
    st.draft = d;
    st.orbs.forEach(o => { o.selected = o.value === d.mood; });
    const m = signature(d, ['mood']); if (m !== st.sigMood) { st.sigMood = m; st.refreshMarquee(); }
    const t = signature(d, ['genre', 'mood', 'voice', 'language', 'tempo', 'recipient', 'occasion', 'product']);
    if (t !== st.sigTicket) { st.sigTicket = t; if (st.view === 'checkout') st.redrawTicket(); else st.ticketStale = true; }
  };
  st.setView = view => { st.view = view; st.refreshMarquee(); if (view === 'checkout' && st.ticketStale) { st.ticketStale = false; st.redrawTicket(); } };
  st.handle = a => { if (a.type === 'pick' && a.kind === 'mood') { const o = st.orbs.find(x => x.value === a.value); if (o) o.press = 1; s.pulse(0.9); } return false; };

  st.update = (dt, t, c) => {
    st.appear = damp(st.appear, st.view === 'mood' ? 1 : 0, 5, dt);
    st.ticketAppear = damp(st.ticketAppear, st.view === 'checkout' ? 1 : 0, 6, dt);
    st.ticket.mesh.visible = st.ticketAppear > 0.02;
    st.ticket.mesh.scale.setScalar(0.85 + st.ticketAppear * 0.15); st.ticket.mesh.material.opacity = st.ticketAppear;
    st.ticket.mesh.position.y = -1.0 + Math.sin(t * 0.8) * 0.06;
    st.group.position.y = 8.6 + s.stage.lift;
    st.plaque.mesh.visible = st.appear > 0.05; st.plaque.mesh.material.opacity = st.appear; st.plaque.mesh.scale.setScalar(0.9 + st.appear * 0.1);
    const hovered = c.hovered;
    st.orbs.forEach((o, i) => {
      const k = Math.max(0, Math.min(1, st.appear * 1.5 - i * 0.045));
      o.group.visible = k > 0.01;
      o.sel = damp(o.sel, o.selected ? 1 : 0, 10, dt); o.hov = damp(o.hov, hovered === o ? 1 : 0, 12, dt); o.press = Math.max(0, o.press - dt * 3);
      const bob = s.still ? 0 : Math.sin(t * 1.2 + i * 0.7) * 0.09;
      o.group.position.set(o.base.x * (0.6 + 0.4 * k), o.base.y * (0.6 + 0.4 * k) + bob, 0);
      const sc = k * (1 + o.sel * 0.28 + o.hov * 0.1 + Math.sin(o.press * Math.PI) * 0.15 + (o.selected ? c.energy * 0.12 : 0));
      o.group.scale.setScalar(Math.max(0.001, sc));
      o.ring.material.opacity = o.sel * 0.9 + o.hov * 0.4; o.ring.rotation.z += dt * 0.6;
      o.glow.material.opacity = 0.2 + o.sel * 0.45 + o.hov * 0.15;
      o.shell.material.emissiveIntensity = 0.5 + o.sel * 0.8 + o.hov * 0.3;
      o.core.material.color.copy(o.color).multiplyScalar(0.6 + o.sel * 0.7);
    });
  };
  s.stations.mood = st; s.updaters.push(st.update);
  return st;
}
