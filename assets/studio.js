import * as THREE from './vendor/three.module.js';
import {LookRig} from './camera-rig.js';
import {makeMaterials, buildWorld, MOODS} from './world.js';
import {buildStations} from './stations.js';
import {glowTexture, damp, easeInOut, shortestAngle} from './gfx.js';
import {Bursts} from './fx.js';
import {RAD, ROOM_RADIUS} from './layout.js';

export {MOODS};

// Which station frames each view of the application.
const STATION_OF = {lobby: 'stage', mood: 'stage', checkout: 'stage', genre: 'genre', voice: 'voice', story: 'story', products: 'products', samples: 'samples', session: 'cockpit', 'session-song': 'cockpit', 'session-talk': 'cockpit', 'session-files': 'cockpit', recover: 'session', library: 'session', info: 'about', about: 'about', terms: 'about', privacy: 'about'};

export class Studio {
  constructor(canvas) {
    this.canvas = canvas;
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.mobile = this.touch || innerWidth < 760;
    this.still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.light = Boolean(navigator.connection?.saveData);
    this.view = 'lobby'; this.energy = 0; this.kick = 0; this.time = 0; this.last = 0;
    this.accent = new THREE.Color(MOODS.Emotiva); this.accentTarget = this.accent.clone();
    this.pickables = []; this.updaters = []; this.stations = {};
    this.free = null; this.hovered = null; this.draft = null; this.content = null;
    this.rig = new LookRig(); this.tween = null; this.playingIndex = -1;
    this.pointer = new THREE.Vector2();
    this.glowTex = null;
    if (!this.light) this.init();
  }

  // Portrait layouts follow the device orientation on touch screens: a soft keyboard shrinks the viewport, and the
  // studio must not flip to its landscape arrangement while somebody types. On desktop the window shape decides.
  get portrait() {
    const o = this.touch && screen.orientation?.type;
    return o ? o.startsWith('portrait') && innerWidth < 900 : innerWidth / innerHeight < 0.85;
  }

  init() {
    if (this.renderer) return;
    try {
      const r = this.renderer = new THREE.WebGLRenderer({canvas: this.canvas, antialias: !this.mobile, powerPreference: 'high-performance'});
      r.setPixelRatio(this.pixelRatio()); r.setSize(innerWidth, innerHeight, false);
      r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.2;
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x07040f);
      this.scene.fog = new THREE.FogExp2(0x07040f, this.mobile ? 0.0105 : 0.0085);
      this.glowTex = glowTexture();
      this.camera = new THREE.PerspectiveCamera(this.baseFov(), innerWidth / innerHeight, 0.1, 140);
      this.camera.rotation.order = 'YXZ';
      this.raycaster = new THREE.Raycaster();
      this.m = makeMaterials(this);
      buildWorld(this);
      buildStations(this);
      this.fx = new Bursts(this.scene, this.mobile ? 160 : 260);
      this.scene.updateMatrixWorld(true);
      addEventListener('resize', () => this.resize());
      addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.pointer.set(e.clientX / innerWidth * 2 - 1, e.clientY / innerHeight * 2 - 1); }, {passive: true});
      this.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.light = true; document.body.classList.add('light-mode'); });
      document.body.classList.add('has-3d');
      this.cam = this.targetFor(this.view); this.applyCamera(true);
      requestAnimationFrame(t => this.animate(t));
    } catch (e) {
      console.warn('Studio unavailable:', e);
      this.renderer = null; this.light = true; document.body.classList.add('light-mode');
    }
  }

  // ---- Data pushed by the application ---------------------------------------------------------------------------
  setContent(content) { this.content = content; for (const st of Object.values(this.stations)) st.setContent?.(content); this.relayout(); }
  setDraft(draft) { this.draft = draft; for (const st of Object.values(this.stations)) st.setDraft?.(draft); }
  setTracks(tracks) { this.tracks = tracks; this.stations.samples?.setTracks?.(tracks); }
  setPlaying(index) { this.playingIndex = index; this.stations.samples?.setPlaying?.(index); }
  setOrderPlaying(on) { this.stations.cockpit?.setPlaying?.(on); }
  tone(mood) { this.accentTarget.set(MOODS[mood] || MOODS.Emotiva); }
  pulse(strength = 1) { this.kick = Math.max(this.kick, strength); }
  // A few sparks where the visitor touched (accent colour unless told otherwise).
  burst(point = this.lastHit, color = this.accent) { if (this.fx && point && !this.still) this.fx.emit(point, color, {count: this.mobile ? 20 : 30, speed: 3.8}); }
  // The stage erupts: used when an order has been created or paid.
  celebrate() { this.celebrating = true; this.pulse(1); }
  fireCelebration() {
    // Waits for the camera to arrive, then erupts where the visitor is looking (terminal in a session, the logo elsewhere).
    const at = this.view.startsWith('session') ? new THREE.Vector3(0, 10, -8) : this.stage.group.localToWorld(new THREE.Vector3(0, 8.6, 3));
    for (const c of [this.accent, new THREE.Color(0xff4fd8), new THREE.Color(0x22e4ff), new THREE.Color(0xffd23f)]) this.fx.emit(at, c, {count: this.mobile ? 30 : 48, speed: 6.5, ring: true, up: 1.2});
  }
  // The rectangle of the screen that is not covered by HUD or drawer: the subject is centred inside it.
  setFree(rect) {
    // Guard: a broken HUD measurement must never send the camera away. Keep at least 160px each way, inside the viewport.
    const W = innerWidth, H = innerHeight, c = (v, lo, hi) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
    let [x0, y0, x1, y1] = rect; x0 = c(x0, 0, Math.max(0, W - 160)); x1 = c(x1, x0 + 160, W); y0 = c(y0, 0, Math.max(0, H - 160)); y1 = c(y1, y0 + 160, H);
    if (x1 - x0 < Math.min(W * 0.4, 240)) { x0 = 0; x1 = W; }          // a sliver is a measurement accident, not a layout
    const next = [x0, y0, x1, y1].map(Math.round);
    if (this.free && next.every((v, i) => Math.abs(v - this.free[i]) < 2)) return;
    const first = !this.free; this.free = next;
    // The very first framing of the lobby is a slow fly-in (skipped for reduced motion, deep links and tests).
    const intro = first && this.view === 'lobby' && !this.still && !this.snapCamera && !/[?&](session|e2e)/.test(location.search);
    if (this.renderer) this.moveTo(this.view, first && !intro, {intro});
  }
  setLight(light) {
    this.light = light;
    if (!light) { this.init(); if (this.renderer) { this.setContent?.(this.content); if (this.draft) this.setDraft(this.draft); this.moveTo(this.view, true); } }
  }

  // ---- Camera ----------------------------------------------------------------------------------------------------
  pixelRatio() { return Math.min(devicePixelRatio || 1, this.mobile ? 1.75 : 2, Math.sqrt((this.mobile ? 3.0e6 : 4.6e6) / (innerWidth * innerHeight))); }
  baseFov() { const w = innerWidth, h = innerHeight; return this.portrait ? (h < 640 ? 70 : 62) : (h < 520 ? 58 : w < 1100 ? 54 : 46); }

  // The camera state (position, heading, pitch, fov, view offset) that frames `view` inside the free rectangle.
  targetFor(view) {
    const st = this.stations[STATION_OF[view] || 'stage'], portrait = this.portrait;
    const spec = st.shot(portrait, view, this), fov = this.baseFov();
    const W = innerWidth, H = innerHeight, [x0, y0, x1, y1] = this.free || [0, 0, W, H];
    const fw = Math.max(80, x1 - x0), fh = Math.max(80, y1 - y0, H * 0.26), t = Math.tan(fov * RAD / 2);
    const dist = Math.max((spec.h / 2) / (t * fh / H), (spec.w / 2) / (t * fw / H)) * (spec.margin || 1.06) + (spec.extra || 0);
    const az = spec.az * RAD, p = spec.pitch, cp = Math.cos(p);
    const fwd = new THREE.Vector3(Math.sin(az) * cp, Math.sin(p), -Math.cos(az) * cp);
    const pos = spec.focus.clone().addScaledVector(fwd, -dist);
    const rad = Math.hypot(pos.x, pos.z), maxR = ROOM_RADIUS - 3;
    if (rad > maxR) { pos.x *= maxR / rad; pos.z *= maxR / rad; }
    pos.y = Math.min(20, Math.max(1.3, pos.y));
    const L = spec.limits || {};
    return {pos, yaw: az, pitch: p, fov, focus: spec.focus.clone(), dist, fwd,
      offset: new THREE.Vector2((W / 2 - (x0 + x1) / 2) / W, (H / 2 - (y0 + y1) / 2) / H),
      limits: {yaw: (L.yaw ?? 30) * (this.portrait && (L.yaw ?? 30) < 40 ? 0.55 : 1) * RAD, pitchMin: (L.pMin ?? -8) * RAD, pitchMax: (L.pMax ?? 14) * RAD}};
  }

  moveTo(view, snap = false, {intro = false} = {}) {
    const changed = view !== this.view; this.view = view;
    if (!this.renderer) return;
    for (const st of Object.values(this.stations)) st.setView?.(view);
    const to = this.targetFor(view);
    // Whatever the visitor had rotated or zoomed becomes part of the starting pose, so nothing jumps.
    const from = intro ? {pos: to.pos.clone().add(new THREE.Vector3(0, 9, 14)), yaw: to.yaw + 0.6, pitch: to.pitch - 0.32, fov: to.fov + 10, offset: to.offset.clone()} : this.cam ? this.effectiveCamera() : to;
    this.rig.setLimits({yaw: to.limits.yaw, pitchMin: to.limits.pitchMin, pitchMax: to.limits.pitchMax});
    this.rig.vYaw = this.rig.vPitch = 0; this.rig.yaw = this.rig.pitch = 0; this.rig.setZoom(1); this.rig.homing = false;
    this.cam = to;
    if (snap || this.still || this.snapCamera) { this.tween = null; this.shown = {pos: to.pos.clone(), yaw: to.yaw, pitch: to.pitch, fov: to.fov, offset: to.offset.clone()}; this.applyCamera(); return; }
    const dist = from.pos.distanceTo(to.pos), turn = Math.abs(shortestAngle(to.yaw - from.yaw));
    this.tween = {t: 0, dur: intro ? 3.6 : changed ? Math.min(2.4, 1.05 + dist * 0.028 + turn * 0.32) : 0.7, from, lift: intro ? 0 : changed ? Math.min(2.4, dist * 0.06 + turn * 0.6) : 0};
  }

  // Current pose including the visitor's own look offsets.
  effectiveCamera() {
    const c = this.shown || this.cam;
    return {pos: c.pos.clone(), yaw: c.yaw, pitch: c.pitch, fov: c.fov, offset: c.offset.clone()};
  }

  applyCamera() {
    const c = this.shown; if (!c) return;
    const yaw = c.yaw + this.rig.yaw, pitch = Math.max(-1.2, Math.min(1.2, c.pitch + this.rig.pitch));
    const cam = this.camera;
    cam.position.copy(c.pos);
    if (!this.still && !this.mobile) { cam.position.x += this.pointer.x * 0.06; cam.position.y -= this.pointer.y * 0.04; }
    cam.rotation.set(pitch, -yaw, 0);
    const fov = c.fov / this.rig.zoom;
    if (Math.abs(cam.fov - fov) > 1e-3) cam.fov = fov;
    const W = innerWidth, H = innerHeight;
    cam.aspect = W / H;
    cam.setViewOffset(W, H, c.offset.x * W, c.offset.y * H, W, H);
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }

  // Look, pinch, buttons: all go through the rig, which owns sensitivity and limits.
  get vfov() { return this.camera ? this.camera.fov * RAD : 0.8; }
  beginLook() { this.rig.beginDrag(); this.rig.cancelHoming(); }
  lookAround(dx, dy) { if (this.renderer) this.rig.drag(dx, dy, this.vfov, innerHeight); }
  endLook(vx, vy) { this.rig.endDrag(vx, vy, this.vfov, innerHeight); }
  nudge(yawDeg, pitchDeg = 0) { this.rig.nudge(yawDeg * RAD, pitchDeg * RAD); }
  zoomBy(ratio) { this.rig.zoomBy(ratio); }
  resetView() { this.rig.reset(); }

  resize() {
    if (!this.renderer) return;
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.mobile = this.touch || innerWidth < 760;
    this.renderer.setPixelRatio(this.pixelRatio()); this.renderer.setSize(innerWidth, innerHeight, false);
    // A browser bar sliding in or out (height only, a few dozen px) must not cut the camera's journey short.
    const small = this.lastSize && this.lastSize[0] === innerWidth && Math.abs(this.lastSize[1] - innerHeight) < 120;
    this.lastSize = [innerWidth, innerHeight];
    this.relayout(); this.moveTo(this.view, !small);
  }
  relayout() { for (const st of Object.values(this.stations)) st.relayout?.(this.portrait); }

  // ---- Picking ---------------------------------------------------------------------------------------------------
  pick(x, y) {
    if (!this.renderer || this.light) return null;
    this.raycaster.setFromCamera(new THREE.Vector2(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1), this.camera);
    const live = this.pickables.filter(o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; });
    const hit = this.raycaster.intersectObjects(live, false)[0];
    if (hit) this.lastHit = hit.point.clone();
    return hit ? hit.object.userData : null;
  }
  hover(x, y) { const h = this.pick(x, y); this.hovered = h?.action ? h.target : null; return !!h?.action; }

  // The application forwards picks here first: stations may consume purely spatial actions (switching a bank…).
  handle(action) { for (const st of Object.values(this.stations)) if (st.handle?.(action)) return true; return false; }

  // Test/e2e helper: where an object sits on screen right now.
  screenOf(id) {
    const o = this.pickables.find(p => p.userData.id === id); if (!o) return null;
    o.updateWorldMatrix(true, false);
    const c = new THREE.Vector3(); new THREE.Box3().setFromObject(o).getCenter(c);
    const world = c.clone(), v = c.project(this.camera);
    let visible = true; for (let p = o; p; p = p.parent) if (!p.visible) visible = false;
    return {x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight, front: v.z > -1 && v.z < 1, visible, world};
  }

  connectAudio(el) {
    try {
      if (!this.ctx) {
        this.ctx = new AudioContext(); this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 128;
        this.data = new Uint8Array(this.analyser.frequencyBinCount);
        this.source = this.ctx.createMediaElementSource(el); this.source.connect(this.analyser); this.analyser.connect(this.ctx.destination);
        this.audioEl = el;
      }
      this.ctx.resume().catch(() => {});
    } catch {}
  }

  // ---- Frame -----------------------------------------------------------------------------------------------------
  animate(now) {
    requestAnimationFrame(t => this.animate(t));
    if (this.light || document.hidden || !this.renderer) { this.last = now; return; }
    if (this.mobile && now - this.last < 14) return;
    const dt = Math.min((now - this.last) / 1000, 0.1); this.last = now;
    this.step(dt);
    this.renderer.render(this.scene, this.camera);
  }

  // Test helper: fast-forward the simulation (camera, fades, selections) independently of the real frame rate.
  advance(seconds = 1) {
    if (!this.renderer) return;
    for (let i = 0, n = Math.ceil(seconds * 30); i < n; i++) this.step(1 / 30);
    this.renderer.render(this.scene, this.camera);
  }

  step(dt) {
    const t = this.time += this.still ? 0 : dt;

    const playing = !!(this.analyser && this.audioEl && !this.audioEl.paused);
    let bass = 0;
    if (playing) { this.analyser.getByteFrequencyData(this.data); for (let i = 0; i < 8; i++) bass += this.data[i]; bass /= 8 * 255; }
    const beat = Math.pow(Math.max(0, Math.sin(t * 2.2)), 12) * 0.3;
    this.kick = Math.max(0, this.kick - dt * 1.6);
    this.energy += (Math.min(1, (playing ? bass : beat) + this.kick * 0.8) - this.energy) * Math.min(1, dt * 10);
    if (this.still) this.energy = 0;

    // Camera travel: position eases, heading takes the shortest turn, and a gentle lift makes it feel like a dolly.
    if (this.tween) {
      const tw = this.tween; tw.t = Math.min(1, tw.t + dt / tw.dur);
      const k = easeInOut(tw.t), to = this.cam, from = tw.from;
      this.shown = {
        pos: from.pos.clone().lerp(to.pos, k).add(new THREE.Vector3(0, Math.sin(k * Math.PI) * tw.lift, 0)),
        yaw: from.yaw + shortestAngle(to.yaw - from.yaw) * k, pitch: from.pitch + (to.pitch - from.pitch) * k, fov: from.fov + (to.fov - from.fov) * k,
        offset: from.offset.clone().lerp(to.offset, k),
      };
      if (tw.t >= 1) { this.tween = null; this.shown = {pos: to.pos.clone(), yaw: to.yaw, pitch: to.pitch, fov: to.fov, offset: to.offset.clone()}; }
    } else if (!this.shown) this.shown = {pos: this.cam.pos.clone(), yaw: this.cam.yaw, pitch: this.cam.pitch, fov: this.cam.fov, offset: this.cam.offset.clone()};
    this.rig.update(dt);
    this.applyCamera();
    // Inside a session the rest of the studio steps out of the way: it neither shows nor answers touches (the room is its own place).
    const hide = this.view.startsWith('session') && !this.tween;
    if (hide !== this.othersHidden) { this.othersHidden = hide; for (const [k, st] of Object.entries(this.stations)) if (k !== 'cockpit' && st.group) st.group.visible = !hide; if (this.stage?.group) this.stage.group.visible = !hide; }

    // Mood colour, key light following the active station
    this.accent.lerp(this.accentTarget, Math.min(1, dt * 3));
    this.m.accent.color.copy(this.accent); this.accentLight.color.copy(this.accent);
    this.accentLight.intensity = 85 + this.energy * 90;
    // The mood tints the air of the room too, not just the neon: background and fog drift toward it.
    this._bg ||= new THREE.Color(); this._bg.set(0x07040f).lerp(this.accent, 0.2).multiplyScalar(0.9);
    this.scene.background.copy(this._bg); this.scene.fog.color.copy(this._bg);
    const target = this.cam.focus;
    this.keyLight.target.position.lerp(target, Math.min(1, dt * 4)); this.keyLight.target.updateMatrixWorld();
    const kp = target.clone().addScaledVector(this.cam.fwd, -Math.min(this.cam.dist, 16) * 0.8).add(new THREE.Vector3(0, 7, 0));
    this.keyLight.position.lerp(kp, Math.min(1, dt * 4));

    const ctx = {playing, data: this.data, beat, energy: this.energy, accent: this.accent, view: this.view, hovered: this.hovered};
    for (const u of this.updaters) u(dt, t, ctx);
    if (this.celebrating && !this.tween && this.fx && !this.still) { this.celebrating = false; this.fireCelebration(); }
    this.fx?.update(dt);
  }
}
