// Genre console: a wall of pads (one bank of styles at a time) above a strip of bank buttons and a readout screen.
import * as THREE from './vendor/three.module.js';
import {Surface, neonText, fit, wrap, FONT, glowSprite, signature} from './gfx.js';
import {drawIcon, iconFor} from './icons.js';
import {PadBoard} from './pads.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, box, neonFrame, makeScreen, Knob} from './st-kit.js';
import {GENRE_INFO, BANK_COLOR, BANK_LABEL} from './content.js';

export function buildConsole(s) {
  const g = stationGroup(AZIMUTH.genre); s.scene.add(g);
  const m = s.m, st = {group: g, bank: null, banks: [], draft: null};

  // Backdrop and dressing
  put(g, new THREE.BoxGeometry(12.6, 16, 0.5), m.dark, 0, 8, -1.3);
  const frame = new THREE.Group(); frame.position.set(0, 8, -1.0); g.add(frame); neonFrame(frame, 12.2, 15.6, m.neon, 0.06);
  for (const x of [-7.6, 7.6]) {                                   // speaker stacks
    box(g, 1.7, 7.2, 1.5, m.dark, x, 3.6, -0.2);
    for (const [y, r] of [[2.2, 0.62], [4.6, 0.42], [6.1, 0.22]]) {
      const cone = put(g, new THREE.CylinderGeometry(r, r * 0.9, 0.08, 32), m.metal, x, y, 0.58); cone.rotation.x = Math.PI / 2;
      const rim = put(g, new THREE.TorusGeometry(r, 0.03, 6, 32), m.accent, x, y, 0.62);
    }
  }
  const desk = box(g, 13.4, 1.6, 4.2, m.panel, 0, 0.8, 2.3);        // console desk
  box(g, 13.5, 0.06, 0.06, m.accent, 0, 1.62, 4.4); box(g, 13.5, 0.06, 0.06, m.neon, 0, 0.16, 4.4);
  for (let i = 0; i < 18; i++) { const x = -6 + i * 0.7; box(g, 0.08, 0.5, 0.06, i % 3 ? m.neon : m.pink, x, 1.66, 3.4); }

  // Bank buttons on an upright strip in front of the desk
  st.strip = new THREE.Group(); g.add(st.strip);
  box(st.strip, 9.4, 1.9, 0.16, m.dark, 0, 0, -0.06);
  neonFrame(st.strip, 9.5, 2.0, m.neon, 0.035, 0.04);

  // Pads
  st.board = new PadBoard(s, {kind: 'genre', capacity: 12, padW: 2.0, padH: 2.0, gap: 0.2});
  g.add(st.board.group);
  st.glowWall = glowSprite(0x8b5cff, 22, 0.14); st.glowWall.position.set(0, 6.5, -0.6); g.add(st.glowWall);

  // Readout: the question, then the chosen genre and what it sounds like.
  st.screen = makeScreen(s, 9.6, 1.7, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1c0f3a'); bg.addColorStop(1, '#0b0620'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,110,255,.07)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1.5);
    if (!state?.genre) {
      c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.11}px ${FONT.sans}`; c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillText('CONSOLA · PASO 1 DE 6', w * 0.05, h * 0.24);
      neonText(c, '¿Qué género te mueve?', w * 0.05, h * 0.62, {size: h * 0.36, color: '#d5bcff', align: 'left', blur: 18, maxW: w * 0.9});
      return;
    }
    const color = state.color || '#c6a2ff';
    drawIcon(c, state.icon, h * 0.5, h * 0.5, h * 0.62, {color, width: 1.9, glow: 16});
    c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.1}px ${FONT.sans}`; c.fillText(String(state.bank || '').toUpperCase(), h * 0.95, h * 0.2);
    neonText(c, state.genre, h * 0.95, h * 0.48, {size: h * 0.34, color, align: 'left', blur: 16, maxW: w - h * 1.1});
    c.fillStyle = '#efe6ff'; c.font = `500 ${h * 0.15}px ${FONT.sans}`;
    wrap(c, state.info || '', w - h * 1.1).slice(0, 2).forEach((line, i) => c.fillText(line, h * 0.95, h * 0.74 + i * h * 0.17));
  });
  g.add(st.screen.group);

  // ---- Behaviour ------------------------------------------------------------------------------------------------
  const bankOf = genre => Object.keys(s.content?.banks || {}).find(b => s.content.banks[b].includes(genre));
  const items = bank => (s.content.banks[bank] || []).map(v => ({value: v, label: v, icon: iconFor('genre', v), color: BANK_COLOR[bank] || '#c6a2ff'}));
  st.setBank = (bank, animate = true) => {
    if (!bank || bank === st.bank || !s.content?.banks?.[bank]) return;
    st.bank = bank;
    st.board.setItems(items(bank), {animate});
    st.board.setSelected(st.draft?.genre);
    st.banks.forEach(k => { k.selected = k.value === bank; });
  };
  st.setContent = content => {
    st.banks.forEach(k => { st.strip.remove(k.group); const i = s.pickables.indexOf(k.hit); if (i >= 0) s.pickables.splice(i, 1); });
    st.banks = Object.keys(content.banks).map(name => new Knob(s, {kind: 'bank', value: name, icon: iconFor('bank', name), color: BANK_COLOR[name] || '#c6a2ff', label: BANK_LABEL[name] || name, r: 0.62}));
    st.banks.forEach(k => st.strip.add(k.group));
    st.sig = null; st.bank = null; st.setBank(bankOf(st.draft?.genre) || Object.keys(content.banks)[0], false);
    st.relayout(s.portrait);
  };
  st.setDraft = draft => {
    st.draft = draft;
    const sig = signature(draft, ['genre']); if (sig === st.sig) return; st.sig = sig;
    const bank = bankOf(draft.genre);
    if (draft.genre && bank && bank !== st.bank) st.setBank(bank, false);
    st.board.setSelected(draft.genre);
    st.screen.surface.redraw(draft.genre ? {genre: draft.genre, bank, icon: iconFor('genre', draft.genre), color: BANK_COLOR[bank], info: GENRE_INFO[draft.genre]} : {});
  };
  st.handle = action => {
    if (action.type !== 'pick') return false;
    if (action.kind === 'bank') { st.setBank(action.value, true); const k = st.banks.find(b => b.value === action.value); if (k) k.press = 1; return true; }
    if (action.kind === 'genre') st.board.pulse(action.value);
    return false;
  };
  st.relayout = portrait => {
    const cols = portrait ? 3 : 4, rows = Math.ceil((st.board.items.length || 12) / cols);
    st.board.layout(cols);
    const padH = st.board.padH + st.board.gap, boardH = 12 / cols * padH;     // reserve the height of a full bank
    const top = portrait ? 12.0 : 9.5, mid = top - boardH / 2 + st.board.gap / 2;
    st.board.group.position.set(0, mid, 0.3);
    st.screen.group.position.set(0, top + 1.55, 0.05);
    st.glowWall.position.y = mid;
    st.strip.position.set(0, top - boardH - 0.95 + (portrait ? 0.15 : 0.1), 0.35); st.strip.rotation.x = -0.32;
    const n = st.banks.length, gap = portrait ? 1.42 : 1.55;
    st.banks.forEach((k, i) => { k.group.position.set((i - (n - 1) / 2) * gap, 0, 0.15); k.group.scale.setScalar(portrait ? 0.86 : 1); });
    st.layout = {portrait, top, boardH};
  };
  st.update = (dt, t, c) => {
    st.board.update(dt, c.hovered, s.accent);
    st.banks.forEach(k => k.update(dt, c.hovered));
  };
  st.shot = portrait => {
    const {top = portrait ? 12 : 9.5, boardH = portrait ? 8.6 : 6.6} = st.layout || {};
    const bottom = top - boardH - 1.7, topY = top + 2.6, mid = (bottom + topY) / 2;
    return {focus: g.localToWorld(new THREE.Vector3(0, mid, 0.3)), az: AZIMUTH.genre, pitch: 0.02, w: portrait ? 8.4 : 11.6, h: topY - bottom, limits: {yaw: 28, pMin: -9, pMax: 12}};
  };
  s.stations.genre = st; s.updaters.push(st.update);
  return st;
}
