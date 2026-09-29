// Vocal booth: three rows of pads (who sings, in which language, at what pace) in front of a glass recording booth.
import * as THREE from './vendor/three.module.js';
import {textPlane, neonText, FONT, glowSprite, wrap, signature} from './gfx.js';
import {iconFor, LANGUAGE_BADGE} from './icons.js';
import {PadBoard} from './pads.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, box, neonFrame, makeScreen} from './st-kit.js';
import {VOICE_INFO, TEMPO_INFO} from './content.js';

const COLORS = {voice: '#ff4fd8', language: '#22e4ff', tempo: '#ffd23f'};

export function buildVoice(s) {
  const g = stationGroup(AZIMUTH.voice); s.scene.add(g);
  const m = s.m, st = {group: g, draft: null};

  // Booth dressing: acoustic foam wall, glass cabin, mic on a boom.
  put(g, new THREE.BoxGeometry(14, 15, 0.5), m.dark, 0, 7.5, -3.2);
  const frame = new THREE.Group(); frame.position.set(0, 7.5, -2.9); g.add(frame); neonFrame(frame, 13.6, 14.6, m.neon, 0.06);
  for (let i = 0; i < 9; i++) for (let j = 0; j < 4; j++) box(g, 1.3, 3.2, 0.5, m.fabric, -5.6 + i * 1.4, 3.2 + j * 3.4 - 0.4, -2.7 + (i + j) % 2 * 0.12);
  st.mic = {rotation: {z: 0}}; st.micHalo = {material: {opacity: 0}};
  box(g, 15, 0.9, 4.6, m.panel, 0, 0.45, 1.6);                                      // mixing desk
  box(g, 15.1, 0.06, 0.06, m.accent, 0, 0.92, 3.9); box(g, 15.1, 0.06, 0.06, m.neon, 0, 0.12, 3.9);

  // Pads: voices (large), language and pace (compact).
  st.voice = new PadBoard(s, {kind: 'voice', capacity: 5, padW: 1.95, padH: 1.95, gap: 0.2});
  st.language = new PadBoard(s, {kind: 'language', capacity: 4, padW: 1.5, padH: 1.5, gap: 0.16, texture: 192});
  st.tempo = new PadBoard(s, {kind: 'tempo', capacity: 4, padW: 1.5, padH: 1.5, gap: 0.16, texture: 192});
  const titles = {};
  for (const [kind, text] of [['voice', 'QUIÉN LA CANTA'], ['language', 'IDIOMA'], ['tempo', 'RITMO']]) {
    const t = textPlane(5.2, 0.6, (c, w, h) => { neonText(c, text, 0, h / 2, {size: h * 0.62, color: COLORS[kind], weight: 800, blur: 10, align: 'left', maxW: w}); }, {px: 160, additive: true});
    titles[kind] = t.mesh; g.add(t.mesh);
  }
  g.add(st.voice.group, st.language.group, st.tempo.group);
  st.titles = titles;

  st.screen = makeScreen(s, 8.6, 1.3, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1c0f3a'); bg.addColorStop(1, '#0b0620'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(160,110,255,.07)'; for (let y = 0; y < h; y += 6) c.fillRect(0, y, w, 1.5);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    if (!state?.voice) { c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.14}px ${FONT.sans}`; c.fillText('CABINA · PASO 3 DE 6', w * 0.04, h * 0.26); neonText(c, '¿Quién la canta?', w * 0.04, h * 0.66, {size: h * 0.42, color: '#ff8de6', align: 'left', blur: 16, maxW: w * 0.92}); return; }
    c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.13}px ${FONT.sans}`; c.fillText('TU VOZ', w * 0.04, h * 0.22);
    c.fillStyle = '#ff3d4f'; c.shadowColor = '#ff3d4f'; c.shadowBlur = 16; c.beginPath(); c.arc(w * 0.83, h * 0.28, h * 0.075, 0, Math.PI * 2); c.fill(); c.shadowBlur = 0;
    c.textAlign = 'right'; c.fillStyle = '#ff8592'; c.font = `800 ${h * 0.15}px ${FONT.sans}`; c.fillText('ON AIR', w * 0.96, h * 0.29); c.textAlign = 'left';
    neonText(c, state.voice, w * 0.04, h * 0.55, {size: h * 0.44, color: '#ff8de6', align: 'left', blur: 14, maxW: w * 0.5});
    c.fillStyle = '#efe6ff'; c.font = `600 ${h * 0.2}px ${FONT.sans}`;
    c.fillText(`${state.language} · ritmo ${String(state.tempo).toLowerCase()}`, w * 0.04, h * 0.86, w * 0.9);
  });
  g.add(st.screen.group);

  st.setContent = content => {
    const item = (kind, v, extra = {}) => ({value: v, label: v === 'A tu criterio' ? 'A tu criterio' : v, icon: iconFor(kind, v), color: COLORS[kind], ...extra});
    st.voice.setItems(content.voices.map(v => item('voice', v)));
    st.language.setItems(content.languages.map(v => item('language', v, {icon: null, badge: LANGUAGE_BADGE[v] || v.slice(0, 2).toUpperCase(), label: v})));
    st.tempo.setItems(content.tempos.map(v => item('tempo', v)));
    st.sig = null; st.relayout(s.portrait);
  };
  st.setDraft = d => {
    st.draft = d; const sig = signature(d, ['voice', 'language', 'tempo']); if (sig === st.sig) return; st.sig = sig;
    st.voice.setSelected(d.voice); st.language.setSelected(d.language); st.tempo.setSelected(d.tempo);
    st.screen.surface.redraw(d.voice ? {voice: d.voice, language: d.language, tempo: d.tempo} : {});
  };
  st.handle = a => { if (a.type === 'pick' && ['voice', 'language', 'tempo'].includes(a.kind)) { st[a.kind].pulse(a.value); s.pulse(a.kind === 'voice' ? 1 : 0.6); } return false; };

  // Portrait: 3+2 voices, then two compact 4-pad rows. Landscape: all voices on one row.
  st.relayout = portrait => {
    const vcols = portrait ? 3 : 5;
    st.voice.layout(vcols); st.language.layout(4); st.tempo.layout(4);
    const vb = st.voice.bounds, lb = st.language.bounds, tb = st.tempo.bounds;
    let y = portrait ? 12.9 : 11.0;
    st.screen.group.position.set(0, y + 0.9, 0.05); y -= 0.9 + 0.35;
    const stack = (board, title, h, z = 0.4) => {
      st.titles[title].position.set(-(board.bounds.w / 2) + 2.6 - 0.02, y - 0.3, 0.2 + z * 0.0); st.titles[title].position.x = -board.bounds.w / 2 + 2.6;
      y -= 0.65; board.group.position.set(0, y - h / 2, z); y -= h + 0.3;
    };
    stack(st.voice, 'voice', vb.h); stack(st.language, 'language', lb.h); stack(st.tempo, 'tempo', tb.h);
    st.layout = {portrait, top: y + (portrait ? 13.1 - 12.9 : 0) + 0, bottom: y + 0.1};
    st.layout.top = (portrait ? 12.9 : 11.0) + 1.55;
  };
  st.update = (dt, t, c) => {
    for (const b of [st.voice, st.language, st.tempo]) b.update(dt, c.hovered, s.accent);
    
  };
  st.shot = portrait => {
    const L = st.layout || {top: portrait ? 14.4 : 11, bottom: portrait ? 0.4 : 1.5}, mid = (L.top + L.bottom) / 2;
    return {focus: g.localToWorld(new THREE.Vector3(0, mid, 0.3)), az: AZIMUTH.voice, pitch: 0.02, w: portrait ? 8.2 : 12.4, h: L.top - L.bottom + 0.8, limits: {yaw: 28, pMin: -9, pMax: 12}};
  };
  s.stations.voice = st; s.updaters.push(st.update);
  return st;
}
