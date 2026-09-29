import * as THREE from './vendor/three.module.js';
import {logoContours} from './logo-outline.js';
import {Surface, textPlane, neonText, glowSprite, roundRect, fit, damp, FONT} from './gfx.js';
import {ROOM_RADIUS, AZIMUTH, STAGE_R, stationGroup} from './layout.js';

export const MOODS = {Romántica: 0xff3d7f, Alegre: 0xffd23f, Emotiva: 0x9b5cff, Nostálgica: 0x5b8cff, Energética: 0x22e4ff, Épica: 0xff6a3d, Tranquila: 0x3dffc5, Melancólica: 0x6f7bff, Divertida: 0xff4fd8, Inspiradora: 0xb8ff5c, Sensual: 0xe0247a, Esperanzadora: 0x7cf0ff};

// ---- Shared materials -------------------------------------------------------------------------------------------
export function makeMaterials(s) {
  const std = (color, rough, metal, extra = {}) => new THREE.MeshStandardMaterial({color, roughness: rough, metalness: metal, ...extra});
  const basic = color => new THREE.MeshBasicMaterial({color, toneMapped: false});
  return {
    dark: std(0x150d2a, 0.5, 0.4), panel: std(0x211540, 0.42, 0.5), metal: std(0x5d5088, 0.26, 0.9),
    fabric: std(0x2a1a52, 0.95, 0), wood: std(0x6d4638, 0.7, 0.05),
    floor: std(0x0b0716, 0.4, 0.55),
    neon: basic(0xc6a2ff), pink: basic(0xff4fd8), cyan: basic(0x22e4ff), white: basic(0xffffff),
    accent: basic(s.accent.clone()),
    glass: new THREE.MeshPhysicalMaterial({color: 0x9c7be0, transparent: true, opacity: 0.1, roughness: 0.08, metalness: 0.1, side: THREE.DoubleSide, depthWrite: false}),
    hit: new THREE.MeshBasicMaterial({transparent: true, opacity: 0, depthWrite: false, colorWrite: false}),
  };
}

// A cube-map of a few bright panels: gives metal, glass and the glossy floor something to reflect.
function buildEnvironment(s) {
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x0a0618);
  const panel = (w, h, color, gain, x, y, z) => {
    const c = new THREE.Color(color).multiplyScalar(gain);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({color: c, side: THREE.DoubleSide}));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); env.add(m);
  };
  panel(30, 4, 0xb58cff, 5, 0, 16, -8); panel(8, 18, 0xff4fd8, 4, -16, 6, -2); panel(8, 18, 0x22e4ff, 4, 16, 6, 3);
  panel(26, 6, 0x6c3dff, 3, 0, 5, 18); panel(16, 16, 0x2b1656, 1.4, 0, -10, 0); panel(10, 4, 0xffffff, 3, 6, 18, 8);
  const pm = new THREE.PMREMGenerator(s.renderer);
  const rt = pm.fromScene(env, 0.04);
  s.scene.environment = rt.texture; s.scene.environmentIntensity = 0.42;
  pm.dispose();
}

export function buildWorld(s) {
  const {scene} = s, m = s.m;
  buildEnvironment(s);

  // Lights: a few real ones (cheap on phones); everything else glows through emissive materials.
  scene.add(new THREE.HemisphereLight(0xb9b8ff, 0x1a1030, 0.5));
  s.accentLight = new THREE.PointLight(s.accent.clone(), 55, 60, 1.3); s.accentLight.position.set(0, 13, -10); scene.add(s.accentLight);
  s.keyLight = new THREE.SpotLight(0xffe9ff, 170, 60, 1.0, 1, 1.0); s.keyLight.position.set(0, 14, 4); scene.add(s.keyLight, s.keyLight.target);
  s.rimLight = new THREE.PointLight(0xa070ff, 40, 30, 1.5); s.rimLight.position.set(0, 6, 0); scene.add(s.rimLight);

  // Floor: glossy dark disc, a violet pool of light and neon guide rings.
  const floor = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 96), m.floor); floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const poolTex = new Surface(256, 256, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(150,90,255,.55)'); gr.addColorStop(0.5, 'rgba(110,60,220,.16)'); gr.addColorStop(1, 'rgba(90,40,200,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, {aniso: 1}).tex;
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_RADIUS * 1.7, ROOM_RADIUS * 1.7), new THREE.MeshBasicMaterial({map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.02; scene.add(pool);
  const gridTex = new Surface(256, 256, (g, w) => {
    g.strokeStyle = 'rgba(170,120,255,.75)'; g.lineWidth = 2.5; g.strokeRect(0, 0, w, w);
    g.strokeStyle = 'rgba(170,120,255,.16)'; g.lineWidth = 1; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, w); g.moveTo(0, w / 2); g.lineTo(w, w / 2); g.stroke();
  }, {repeat: [ROOM_RADIUS * 0.8, ROOM_RADIUS * 0.8]}).tex;
  const grid = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS - 0.5, 96), new THREE.MeshBasicMaterial({map: gridTex, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
  grid.rotation.x = -Math.PI / 2; grid.position.y = 0.03; scene.add(grid);
  for (const [r, mat, op] of [[5.2, m.accent, 0.9], [12.4, m.neon, 0.45], [26.5, m.neon, 0.35], [ROOM_RADIUS - 0.6, m.accent, 0.9]]) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.05, r + 0.05, 160), mat === m.accent ? m.accent : new THREE.MeshBasicMaterial({color: 0xc6a2ff, transparent: true, opacity: op, toneMapped: false}));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.04; scene.add(ring);
  }

  // Walls: acoustic hex panels, vertical light strips and a truss ring.
  const hexTex = new Surface(256, 222, (g, w, h) => {
    g.fillStyle = '#150e26'; g.fillRect(0, 0, w, h);
    const sz = 32;
    for (let row = -1; row < 5; row++) for (let col = -1; col < 6; col++) {
      const x = col * sz * 1.5, y = row * sz * 1.732 + (col % 2 ? sz * 0.866 : 0);
      g.beginPath(); for (let i = 0; i < 6; i++) g.lineTo(x + Math.cos(i * Math.PI / 3) * sz * 0.9, y + Math.sin(i * Math.PI / 3) * sz * 0.9);
      g.closePath(); g.fillStyle = (row + col) % 3 ? '#1d1433' : '#251844'; g.fill();
    }
  }, {repeat: [30, 3]}).tex;
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(ROOM_RADIUS, ROOM_RADIUS, 30, 96, 1, true), new THREE.MeshStandardMaterial({map: hexTex, side: THREE.BackSide, roughness: 0.9, metalness: 0.1, color: 0xb8a6e6}));
  wall.position.y = 15; scene.add(wall);
  const strips = 56, stripGeo = new THREE.BoxGeometry(0.16, 22, 0.16);
  for (const [mat, parity] of [[m.neon, 0], [m.accent, 1]]) {
    const mesh = new THREE.InstancedMesh(stripGeo, mat, strips / 2), d = new THREE.Object3D();
    for (let i = 0, k = 0; i < strips; i++) {
      if (i % 2 !== parity) continue;
      const a = i / strips * Math.PI * 2; d.position.set(Math.sin(a) * (ROOM_RADIUS - 0.4), 11.5, -Math.cos(a) * (ROOM_RADIUS - 0.4)); d.rotation.y = -a; d.updateMatrix(); mesh.setMatrixAt(k++, d.matrix);
    }
    scene.add(mesh);
  }
  for (const [y, mat] of [[22.4, m.neon], [0.25, m.accent]]) { const t = new THREE.Mesh(new THREE.TorusGeometry(ROOM_RADIUS - 0.7, 0.07, 8, 160), mat); t.rotation.x = Math.PI / 2; t.position.y = y; scene.add(t); }
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(ROOM_RADIUS, 64), new THREE.MeshBasicMaterial({color: 0x07040f})); ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 30; scene.add(ceiling);

  // Dust in the light.
  const n = s.mobile ? 160 : 360, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, r = 2 + Math.random() * (ROOM_RADIUS - 4); pos.set([Math.sin(a) * r, 0.5 + Math.random() * 16, -Math.cos(a) * r], i * 3); }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  s.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({map: s.glowTex, color: 0xc9a8ff, size: 0.14, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false}));
  scene.add(s.dust);
  s.updaters.push((dt, t) => { s.dust.rotation.y += (s.still ? 0 : dt) * 0.012; });

  buildStage(s);
}

// ---- Main stage: the logo, the visualizer, REC and PLAY buttons ------------------------------------------------------
function buildStage(s) {
  const m = s.m, g = stationGroup(AZIMUTH.stage, STAGE_R);
  s.scene.add(g); s.stage = {group: g};

  // Platform
  const add = (geo, mat, x = 0, y = 0, z = 0, parent = g) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
  add(new THREE.CylinderGeometry(9.2, 9.6, 0.5, 72), m.dark, 0, 0.25);
  add(new THREE.CylinderGeometry(8.2, 8.5, 0.5, 72), m.metal, 0, 0.7);
  const rim = add(new THREE.TorusGeometry(8.2, 0.07, 8, 128), m.accent, 0, 0.96); rim.rotation.x = Math.PI / 2;
  const rim2 = add(new THREE.TorusGeometry(9.5, 0.06, 8, 128), m.neon, 0, 0.5); rim2.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(2.9, 3.2, 0.7, 56), m.panel, 0, 1.3);
  const halo = add(new THREE.TorusGeometry(2.95, 0.05, 8, 96), m.neon, 0, 1.66); halo.rotation.x = Math.PI / 2;

  // Logo: the supplied brand mark, extruded from its outline.
  const logo = s.logo = new THREE.Group(); logo.position.set(0, 8.6, 0); g.add(logo);
  const inner = new THREE.Group(); inner.scale.setScalar(2.0); logo.add(inner);
  const tex = new THREE.TextureLoader().load(new URL('images/icono-logo-png-fromheartbeat.png', import.meta.url).href); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const front = new THREE.MeshStandardMaterial({map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.2});
  const side = new THREE.MeshStandardMaterial({color: 0x8c49ed, metalness: 0.6, roughness: 0.25, emissive: 0x381178, emissiveIntensity: 0.35});
  for (const contour of logoContours) {
    const shape = new THREE.Shape(contour.map(([x, y]) => new THREE.Vector2((x - 285) / 130, (284.5 - y) / 130)));
    const geo = new THREE.ExtrudeGeometry(shape, {depth: 0.23, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.012, bevelThickness: 0.018, curveSegments: s.mobile ? 14 : 24});
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) * 130 + 285) / 570, (pos.getY(i) * 130 + 284.5) / 569);
    geo.translate(0, 0, -0.115);
    inner.add(new THREE.Mesh(geo, [front, side]));
  }
  s.logoGlow = glowSprite(s.accent.clone(), 15, 0.32); s.logoGlow.position.set(0, 0, -1.4); logo.add(s.logoGlow);
  const logoHit = new THREE.Mesh(new THREE.BoxGeometry(6, 7.4, 2), m.hit); logoHit.userData = {action: {type: 'go', view: 'mood'}, id: 'logo', target: logo}; logo.add(logoHit); s.pickables.push(logoHit);

  // Audio visualizer ring around the platform centre
  const count = s.mobile ? 48 : 72, barGeo = new THREE.BoxGeometry(0.13, 1, 0.13); barGeo.translate(0, 0.5, 0);
  s.bars = new THREE.InstancedMesh(barGeo, m.accent, count); s.bars.frustumCulled = false; s.bars.position.y = 1.02; g.add(s.bars);
  s.barDummy = new THREE.Object3D();

  // Back arch, towers and beams
  const arch = add(new THREE.TorusGeometry(11.5, 0.18, 12, 128, Math.PI), m.accent, 0, 1, -4); s.stage.arch = arch;
  const arch2 = add(new THREE.TorusGeometry(13.2, 0.1, 8, 128, Math.PI), m.neon, 0, 1, -4.6);
  for (const x of [-12.3, 12.3]) add(new THREE.BoxGeometry(0.7, 15, 0.7), m.metal, x, 7.5, -4.3);
  s.beamMat = new THREE.MeshBasicMaterial({color: s.accent.clone(), transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide});
  for (const [x, tilt] of [[0, 0], [-4.2, 0.24], [4.2, -0.24]]) { const b = add(new THREE.ConeGeometry(2.6, 15, 32, 1, true), s.beamMat, x, 8.3, 0); b.rotation.z = tilt; }

  // Marquee: what the studio is for, written in neon high above the stage.
  const marquee = textPlane(17, 5.2, (c, w, h, st) => {
    const mode = st?.mode || 'lobby', two = (a, ca, b, cb, sb = 0.3) => {
      neonText(c, a, w / 2, h * 0.3, {size: h * 0.3, color: ca, blur: 30, maxW: w * 0.9});
      neonText(c, b, w / 2, h * 0.68, {size: h * sb, color: cb, blur: 30, maxW: w * 0.92});
    };
    if (mode === 'mood' && st.name) {
      neonText(c, st.name.toUpperCase(), w / 2, h * 0.34, {size: h * 0.36, color: st.color, blur: 34, maxW: w * 0.9});
      neonText(c, st.sub || '', w / 2, h * 0.72, {size: h * 0.2, color: '#ffffff', weight: 600, blur: 10, maxW: w * 0.9});
    } else if (mode === 'mood') two('¿CÓMO QUIERES', '#cdb0ff', 'QUE SE SIENTA?', '#ff6fe0');
    else if (mode === 'checkout') two('TU CANCIÓN', '#cdb0ff', 'ESTÁ CASI LISTA', '#ff6fe0');
    else two('TU HISTORIA', '#cdb0ff', 'SU PRÓXIMA CANCIÓN', '#ff6fe0');
  }, {px: 90, additive: true});
  marquee.mesh.position.set(0, 18.4, -5); g.add(marquee.mesh); s.stage.marquee = marquee;

  // REC and PLAY: the two ways in. Big, physical, lit.
  s.stage.buttons = [];
  const button = (x, color, hex, title, sub, action, id, shape) => {
    const b = new THREE.Group(); b.position.set(x, 1.0, 6.4); g.add(b);
    add(new THREE.CylinderGeometry(1.9, 2.15, 1.1, 48), m.metal, 0, 0.35, 0, b);
    const cap = add(new THREE.CylinderGeometry(1.5, 1.6, 0.36, 48), new THREE.MeshStandardMaterial({color: new THREE.Color(color).multiplyScalar(0.28), emissive: color, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2}), 0, 1.02, 0, b);
    const ring = add(new THREE.TorusGeometry(1.75, 0.07, 8, 64), new THREE.MeshBasicMaterial({color, toneMapped: false}), 0, 0.96, 0, b); ring.rotation.x = Math.PI / 2;
    // The symbol floats above the button as a neon medallion that faces the visitor (a top face seen edge-on would be unreadable).
    const medal = new THREE.Mesh(new THREE.CircleGeometry(1.25, 56), new THREE.MeshBasicMaterial({map: new Surface(256, 256, (c, w) => {
      c.translate(w / 2, w / 2);
      const g = c.createRadialGradient(0, 0, 10, 0, 0, w / 2); g.addColorStop(0, hex + '55'); g.addColorStop(1, '#0a0620ee'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, w / 2 - 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = hex; c.lineWidth = 10; c.shadowColor = hex; c.shadowBlur = 22; c.beginPath(); c.arc(0, 0, w / 2 - 14, 0, Math.PI * 2); c.stroke();
      c.shadowBlur = 16; c.fillStyle = '#fff'; c.shadowColor = hex;
      if (shape === 'rec') { c.beginPath(); c.arc(0, 0, 50, 0, Math.PI * 2); c.fill(); }
      else { c.beginPath(); c.moveTo(-30, -52); c.lineTo(56, 0); c.lineTo(-30, 52); c.closePath(); c.fill(); }
    }, {aniso: 4}).tex, transparent: true, toneMapped: false, depthWrite: false}));
    medal.position.set(0, 3.0, 0.2); b.add(medal); const medalGlow = glowSprite(color, 5, 0.35); medalGlow.position.set(0, 3.0, 0); b.add(medalGlow);
    const sign = textPlane(4.6, 1.9, (c, w, h) => {
      neonText(c, title, w / 2, h * 0.36, {size: h * 0.44, color: hex, blur: 24, maxW: w * 0.92});
      neonText(c, sub, w / 2, h * 0.78, {size: h * 0.24, color: '#ffffff', weight: 600, blur: 10, maxW: w * 0.86});
    }, {px: 150, additive: true});
    sign.mesh.position.set(0, 5.6, 0); b.add(sign.mesh);
    const halo = glowSprite(color, 6.5, 0.4); halo.position.set(0, 1.1, 0.2); b.add(halo);
    const hit = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 4.6, 16), m.hit); hit.position.y = 2.3; hit.userData = {action, id, target: b}; b.add(hit); s.pickables.push(hit);
    s.stage.buttons.push({group: b, cap, halo, ring, id});
    return b;
  };
  const spread = 4.7; s.stage.spread = spread; s.stage.buttonScale = 1; s.stage.lift = 0;
  s.stage.frontZ = 6.4;
  s.stage.relayout = portrait => { s.stage.spread = portrait ? 3.1 : 4.7; s.stage.buttonScale = portrait ? 0.74 : 1; s.stage.frontZ = portrait ? 4.6 : 6.4; };
  button(-spread, 0xff3d7f, '#ff5c9a', 'CREAR', 'mi canción', {type: 'rec'}, 'rec', 'rec');
  button(spread, 0x22e4ff, '#5cf0ff', 'ESCUCHAR', 'nuestras canciones', {type: 'listen'}, 'listen', 'play');

  // How the camera frames the stage for each view that uses it (lobby, mood, checkout).
  g.updateMatrixWorld(true);
  const focusAt = (x, y, z) => g.localToWorld(new THREE.Vector3(x, y, z));
  s.stations.stage = {
    group: g,
    relayout: portrait => s.stage.relayout(portrait),
    shot(portrait, view) {
      if (view === 'mood') return {focus: focusAt(0, 8.4, 3), az: 0, pitch: 0.04, w: portrait ? 11.8 : 15.5, h: portrait ? 18.4 : 18.2, limits: {yaw: 24, pMin: -8, pMax: 14}};
      if (view === 'checkout') return {focus: focusAt(0, 7.7, 3), az: 0, pitch: 0.05, w: portrait ? 7.6 : 12, h: portrait ? 10.6 : 10.4, limits: {yaw: 24, pMin: -8, pMax: 14}};
      return {focus: focusAt(0, 9.6, 3), az: 0, pitch: 0.08, w: portrait ? 12.4 : 23, h: portrait ? 21.6 : 20.6, limits: {yaw: 75, pMin: -10, pMax: 20}};
    },
  };

  s.updaters.push((dt, t, c) => {
    // Visualizer bars
    const n = s.bars.count;
    for (let i = 0; i < n; i++) {
      const a = i / n * Math.PI * 2;
      const v = c.playing ? c.data[Math.floor(i / n * 40) % c.data.length] / 255 : 0.1 + Math.sin(t * 2 + i * 0.6) * 0.05 + c.beat * 0.5;
      s.barDummy.position.set(Math.sin(a) * 3.6, 0, Math.cos(a) * 3.6); s.barDummy.rotation.y = a; s.barDummy.scale.set(1, 0.08 + v * (c.playing ? 2.6 : 1.4), 1);
      s.barDummy.updateMatrix(); s.bars.setMatrixAt(i, s.barDummy.matrix);
    }
    s.bars.instanceMatrix.needsUpdate = true;
    // Logo: floats, faces the visitor, breathes with the music
    const cam = s.camera.position, toCam = Math.atan2(cam.x - g.position.x, cam.z - g.position.z) - g.rotation.y;
    let dy = toCam * 0.8 + Math.sin(t * 0.5) * 0.12 - logo.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    logo.rotation.y += dy * Math.min(1, dt * 2.5);
    logo.position.y = 8.6 + s.stage.lift + Math.sin(t * 0.9) * 0.16;
    logo.scale.setScalar((s.hovered === logo ? 1.04 : 1) + c.energy * 0.06);
    s.logoGlow.material.opacity = 0.26 + c.energy * 0.5; s.logoGlow.material.color.copy(s.accent);
    s.beamMat.color.copy(s.accent);
    const beams = ['lobby', 'mood', 'checkout'].includes(s.view) ? 0.05 : 0.014;
    s.beamMat.opacity = damp(s.beamMat.opacity, beams, 3, dt);
    // Buttons pulse like a live REC light
    const lobby = s.view === 'lobby', st = s.stage;
    for (const b of st.buttons) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + (b.id === 'rec' ? 0 : 1.6));
      b.cap.material.emissiveIntensity = 0.35 + pulse * 0.4 + (s.hovered === b.group ? 0.35 : 0);
      b.halo.material.opacity = 0.22 + pulse * 0.2;
      const target = lobby ? (s.hovered === b.group ? 1.06 : 1) * st.buttonScale : 0.001;
      b.group.scale.setScalar(damp(b.group.scale.x, target, 9, dt)); b.group.visible = b.group.scale.x > 0.03;
      b.group.position.x = damp(b.group.position.x, b.id === 'rec' ? -st.spread : st.spread, 9, dt); b.group.position.z = damp(b.group.position.z, st.frontZ, 9, dt);
    }
    st.marquee.mesh.material.opacity = damp(st.marquee.mesh.material.opacity, lobby ? 1 : 0, 6, dt); st.marquee.mesh.visible = st.marquee.mesh.material.opacity > 0.02;
    st.lift = damp(st.lift, s.view === 'mood' ? 1.0 : 0, 4, dt);
  });
}
