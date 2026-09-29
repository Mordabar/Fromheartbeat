// Look controller for the studio camera. Pure maths (no Three.js), so it can be tested with exact numbers.
//
// Conventions: angles in radians, offsets measured from the heading of the current "shot".
//   yaw   > 0  → the camera turns to the right      pitch > 0 → the camera looks up
// Dragging is "grab" style: the scene follows the finger 1:1 at the centre of the screen, which is what
// makes the rotation feel exact on phones and desktops alike (sensitivity comes from the field of view,
// never from a magic constant).

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const DEFAULTS = {
  yaw: 0.62,                // ±35° by default around the shot heading
  pitchMin: -0.14, pitchMax: 0.26,
  zoomMin: 0.86, zoomMax: 1.4,
  maxSpeed: 1.5,            // rad/s cap for inertia (~86°/s)
  glide: 0.2,               // seconds the inertia / nudges take to fade
  stretch: 0.07,            // how far (fraction of the range) a drag may stretch past a limit
};

export class LookRig {
  constructor(options = {}) {
    this.cfg = {...DEFAULTS, ...options};
    this.yaw = 0; this.pitch = 0;
    this.vYaw = 0; this.vPitch = 0;
    this.zoom = 1; this.zoomTarget = 1;
    this.dragging = false;
  }

  // Per-shot limits. Asking for a smaller range than the current offset never snaps: the rig eases back.
  setLimits({yaw, pitchMin, pitchMax, zoomMin, zoomMax} = {}) {
    Object.assign(this.cfg, Object.fromEntries(Object.entries({yaw, pitchMin, pitchMax, zoomMin, zoomMax}).filter(([, v]) => v !== undefined)));
  }

  // Rubber band. Inside [lo, hi] the scene follows the finger exactly. Past an edge the displacement is squashed
  // with a saturating curve, so it can stretch by at most `room` and always returns along the same path.
  #stretch(value, delta, lo, hi) {
    const room = (hi - lo) * this.cfg.stretch, cap = room * 0.999;
    const toRaw = x => x > hi ? hi - room * Math.log(1 - Math.min(x - hi, cap) / room)
      : x < lo ? lo + room * Math.log(1 - Math.min(lo - x, cap) / room) : x;
    const fromRaw = x => x > hi ? hi + room * (1 - Math.exp(-(x - hi) / room))
      : x < lo ? lo - room * (1 - Math.exp(-(lo - x) / room)) : x;
    return fromRaw(toRaw(value) + delta);
  }

  beginDrag() { this.dragging = true; this.vYaw = this.vPitch = 0; }

  // dx, dy: finger movement in CSS px · vfov: vertical field of view (rad) · height: viewport height (px)
  drag(dx, dy, vfov, height) {
    const k = vfov / height;
    const yawLimit = this.cfg.yaw;
    this.yaw = this.#stretch(this.yaw, -dx * k, -yawLimit, yawLimit);
    this.pitch = this.#stretch(this.pitch, dy * k, this.cfg.pitchMin, this.cfg.pitchMax);
  }

  // vx, vy: finger velocity in px/s at release.
  endDrag(vx = 0, vy = 0, vfov = 0.9, height = 800) {
    this.dragging = false;
    const k = vfov / height, m = this.cfg.maxSpeed;
    this.vYaw = clamp(-vx * k, -m, m);
    this.vPitch = clamp(vy * k, -m, m);
  }

  // Buttons and keys: glide by a fixed angle (never jumps).
  nudge(dYaw, dPitch = 0) {
    this.vYaw += dYaw / this.cfg.glide;
    this.vPitch += dPitch / this.cfg.glide;
  }

  // Multiplicative zoom (pinch ratio or wheel).
  zoomBy(ratio) {
    const {zoomMin, zoomMax} = this.cfg;
    this.zoomTarget = clamp(this.zoomTarget * ratio, zoomMin * 0.97, zoomMax * 1.03);
  }
  setZoom(z) { this.zoom = this.zoomTarget = z; }

  reset() { this.vYaw = this.vPitch = 0; this.homing = true; this.zoomTarget = 1; }
  cancelHoming() { this.homing = false; }

  get idle() {
    return !this.dragging && !this.homing && Math.abs(this.vYaw) < 1e-4 && Math.abs(this.vPitch) < 1e-4
      && Math.abs(this.zoom - this.zoomTarget) < 1e-4;
  }

  update(dt) {
    dt = Math.min(dt, 0.1);
    const {glide, yaw: L, pitchMin, pitchMax, zoomMin, zoomMax} = this.cfg;
    if (!this.dragging) {
      // Inertia: exponential decay, so the total travel after release is speed × glide.
      const decay = Math.exp(-dt / glide);
      this.yaw += this.vYaw * glide * (1 - decay);
      this.pitch += this.vPitch * glide * (1 - decay);
      this.vYaw *= decay; this.vPitch *= decay;
      // Elastic return from beyond a limit (a stretched drag or an inertia overshoot).
      const yawTo = clamp(this.yaw, -L, L), pitchTo = clamp(this.pitch, pitchMin, pitchMax);
      const pull = 1 - Math.exp(-dt * 12);
      if (this.yaw !== yawTo) { this.yaw += (yawTo - this.yaw) * pull; this.vYaw *= 0.5; }
      if (this.pitch !== pitchTo) { this.pitch += (pitchTo - this.pitch) * pull; this.vPitch *= 0.5; }
      if (Math.abs(this.yaw - yawTo) < 1e-4) this.yaw = yawTo;
      if (Math.abs(this.pitch - pitchTo) < 1e-4) this.pitch = pitchTo;
      if (this.homing) {
        const home = 1 - Math.exp(-dt * 6);
        this.yaw -= this.yaw * home; this.pitch -= this.pitch * home;
        if (Math.abs(this.yaw) < 1e-3 && Math.abs(this.pitch) < 1e-3) { this.yaw = this.pitch = 0; this.homing = false; }
      }
    }
    // Zoom settles into its range once the gesture ends.
    if (!this.dragging) this.zoomTarget = clamp(this.zoomTarget, zoomMin, zoomMax);
    this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-dt * 10));
  }
}
