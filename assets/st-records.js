// Vinyl wall: each record is a real song. A turntable in front shows what is playing.
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, neonText, roundRect, fit, glowSprite, damp, siteUrl, FONT} from './gfx.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, box, neonFrame, makeScreen, Pill} from './st-kit.js';

const loader = new THREE.TextureLoader(), cache = new Map();
const cover = url => { let t = cache.get(url); if (!t) { t = loader.load(url); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; cache.set(url, t); } return t; };
const coverUrl = t => siteUrl(t.cover || `assets/images/covers/${t.file || t.id}.webp`);

export function buildRecords(s) {
  const g = stationGroup(AZIMUTH.samples); s.scene.add(g);
  const m = s.m, st = {group: g, records: [], tracks: [], playing: -1};
  st.backdrop = put(g, new THREE.BoxGeometry(13.5, 1, 0.5), m.dark, 0, 9.3, -1.5);
  st.frame = new THREE.Group(); g.add(st.frame); neonFrame(st.frame, 13.1, 1, m.neon, 0.06);

  // Records
  const vinyl = new THREE.MeshStandardMaterial({color: 0x08060c, roughness: 0.3, metalness: 0.6});
  for (let i = 0; i < 6; i++) {
    const holder = new THREE.Group(); g.add(holder);
    const disc = put(holder, new THREE.CylinderGeometry(1.55, 1.55, 0.06, 56), vinyl); disc.rotation.x = Math.PI / 2;
    const art = put(holder, new THREE.CircleGeometry(1.14, 56), new THREE.MeshBasicMaterial({color: 0x2a1a52, toneMapped: false}), 0, 0, 0.04);
    put(holder, new THREE.CircleGeometry(0.07, 16), m.dark, 0, 0, 0.05);
    const groove = put(holder, new THREE.RingGeometry(1.2, 1.5, 56), new THREE.MeshBasicMaterial({color: 0x2c2145, transparent: true, opacity: 0.6, toneMapped: false}), 0, 0, 0.035);
    const ring = put(holder, new THREE.TorusGeometry(1.72, 0.06, 8, 64), new THREE.MeshBasicMaterial({color: 0xff4fd8, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending}), 0, 0, -0.02);
    const glow = glowSprite(0xff4fd8, 5, 0); glow.position.z = -0.3; holder.add(glow);
    const tag = textPlane(3.5, 0.9, (c, w, h, t) => {
      roundRect(c, 4, 4, w - 8, h - 8, h * 0.3); c.fillStyle = 'rgba(12,6,28,.88)'; c.fill(); c.lineWidth = 3; c.strokeStyle = t?.on ? '#ff4fd8' : 'rgba(198,162,255,.55)'; c.stroke();
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff'; fit(c, t?.name || '', w * 0.88, h * 0.42, 800); c.fillText(t?.name || '', w / 2, h * 0.36);
      c.fillStyle = t?.on ? '#ff9be8' : '#b9a6e6'; fit(c, t?.on ? '▶ Sonando ahora' : t?.genre || '', w * 0.88, h * 0.28, 600); c.fillText(t?.on ? '▶ Sonando ahora' : t?.genre || '', w / 2, h * 0.72);
    }, {px: 120});
    tag.mesh.position.set(0, -2.1, 0.06); holder.add(tag.mesh);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.0, 0.5), m.hit); hit.position.y = -0.5;
    hit.userData = {action: {type: 'track', index: i}, id: `track:${i}`, target: holder}; holder.add(hit); s.pickables.push(hit);
    st.records.push({holder, disc, art, ring, glow, tag, hit, sel: 0, hov: 0, spin: 0, home: new THREE.Vector3()});
    holder.visible = false;
  }

  // Turntable
  const tt = new THREE.Group(); tt.position.set(0, 0, 4.2); g.add(tt);
  box(tt, 6.6, 0.9, 4.8, m.panel, 0, 0.45, 0); box(tt, 6.7, 0.06, 0.06, m.accent, 0, 0.92, 2.4);
  st.platter = new THREE.Group(); st.platter.position.set(-0.6, 1.02, 0); tt.add(st.platter);
  put(st.platter, new THREE.CylinderGeometry(2.05, 2.05, 0.1, 56), vinyl);
  st.nowArt = put(st.platter, new THREE.CircleGeometry(0.85, 48), new THREE.MeshBasicMaterial({color: 0x2a1a52, toneMapped: false}), 0, 0.06, 0); st.nowArt.rotation.x = -Math.PI / 2;
  const arm = st.arm = new THREE.Group(); arm.position.set(2.5, 1.2, -1.5); tt.add(arm);
  put(arm, new THREE.CylinderGeometry(0.28, 0.32, 0.4, 20), m.metal);
  const bar = put(arm, new THREE.BoxGeometry(0.1, 0.1, 3.2), m.metal, 0, 0.15, 1.5);
  st.pill = new Pill(s, {w: 5.2, h: 1.0, label: 'Ver toda la colección', action: {type: 'library'}, id: 'library', color: '#c6a2ff', icon: 'lines'});
  st.pill.group.position.set(0, 0.55, 2.55); st.pill.group.rotation.x = -0.35; tt.add(st.pill.group);

  st.screen = makeScreen(s, 10.2, 1.7, (c, w, h, state) => {
    const bg = c.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1c0f3a'); bg.addColorStop(1, '#0b0620'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillStyle = '#a992d9'; c.font = `700 ${h * 0.11}px ${FONT.sans}`; c.fillText(state?.now ? 'SONANDO AHORA' : 'FROMHEARTBEAT ORIGINALS', w * 0.04, h * 0.22);
    neonText(c, state?.now ? state.now.name : 'Historias que ya suenan', w * 0.04, h * 0.58, {size: h * 0.36, color: state?.now ? '#ff8de6' : '#d5bcff', align: 'left', blur: 16, maxW: w * 0.92});
    c.fillStyle = '#efe6ff'; c.font = `500 ${h * 0.15}px ${FONT.sans}`; c.fillText(state?.now ? (state.now.dedication || state.now.genre || '') : 'Toca un disco para escucharlo', w * 0.04, h * 0.87, w * 0.92);
  });
  g.add(st.screen.group);

  st.setTracks = tracks => {
    st.tracks = tracks;
    st.records.forEach((r, i) => {
      const t = tracks[i]; r.holder.visible = !!t; if (!t) return;
      r.art.material.map = cover(coverUrl(t)); r.art.material.color.set(0xffffff); r.art.material.needsUpdate = true;
      r.tag.surface.redraw({name: t.name, genre: t.genre, on: i === st.playing});
    });
    st.relayout(s.portrait);
  };
  st.setPlaying = index => {
    st.playing = index;
    st.records.forEach((r, i) => { const t = st.tracks[i]; if (t) r.tag.surface.redraw({name: t.name, genre: t.genre, on: i === index}); });
    const t = st.tracks[index];
    st.screen.surface.redraw(t ? {now: t} : {});
    if (t) { st.nowArt.material.map = cover(coverUrl(t)); st.nowArt.material.color.set(0xffffff); st.nowArt.material.needsUpdate = true; }
  };
  st.relayout = portrait => {
    const cols = portrait ? 2 : 3, sx = portrait ? 4.0 : 4.3, sy = 4.15, n = Math.min(6, st.tracks.length || 6), rows = Math.ceil(n / cols);
    // Landscape sits lower so the wall stays close to the turntable; portrait stacks three rows.
    const top = portrait ? 15.4 : 11.3;
    st.records.forEach((r, i) => {
      const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, n - row * cols);
      r.home.set((col - (inRow - 1) / 2) * sx, top - 1.4 - row * sy, 0); r.holder.position.copy(r.home);
    });
    const lastCentre = top - 1.4 - (rows - 1) * sy, wallTop = top + 3.0, wallBottom = lastCentre - 3.0, wallH = wallTop - wallBottom;
    st.backdrop.scale.y = wallH; st.backdrop.position.y = (wallTop + wallBottom) / 2;
    st.frame.scale.y = wallH; st.frame.position.set(0, (wallTop + wallBottom) / 2, -1.2);
    st.screen.group.position.set(0, top + 1.55, 0.05);
    st.layout = {portrait, top: wallTop, bottom: 0.2};
  };
  st.update = (dt, t, c) => {
    const spinning = st.playing >= 0 && c.playing;
    st.platter.rotation.y -= (s.still ? 0 : dt) * (spinning ? 3.4 : 0.15);
    st.arm.rotation.y = damp(st.arm.rotation.y, spinning ? -0.5 : 0.1, 3, dt);
    st.records.forEach((r, i) => {
      if (!r.holder.visible) return;
      const on = i === st.playing;
      r.sel = damp(r.sel, on ? 1 : 0, 10, dt); r.hov = damp(r.hov, c.hovered === r.holder ? 1 : 0, 12, dt);
      r.disc.rotation.y += (s.still ? 0 : dt) * (on && spinning ? 3.4 : 0.2);
      r.holder.scale.setScalar(1 + r.hov * 0.07 + (on && spinning ? c.energy * 0.05 : 0));
      r.holder.position.z = r.hov * 0.25 + r.sel * 0.3;
      r.ring.material.opacity = r.sel * 0.9 + r.hov * 0.35; r.glow.material.opacity = r.sel * 0.4 + r.hov * 0.15;
    });
    st.pill.update(dt, c.hovered);
  };
  st.shot = portrait => {
    const L = st.layout || {top: portrait ? 18 : 16, bottom: 0.2}, mid = (L.top + L.bottom) / 2;
    return {focus: g.localToWorld(new THREE.Vector3(0, mid, 0.5)), az: AZIMUTH.samples, pitch: 0.03, w: portrait ? 9.6 : 14.4, h: L.top - L.bottom + 2.4, limits: {yaw: 28, pMin: -8, pMax: 12}};
  };
  s.stations.samples = st; s.updaters.push(st.update);
  return st;
}
