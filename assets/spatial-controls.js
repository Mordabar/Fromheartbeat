// Pointer state is kept apart from the renderer: dragging and pinching can never pick an object,
// and a tap never rotates the camera.
const TAP_SLOP = {touch: 10, mouse: 6, pen: 8};

export class StudioGesture {
  // look(dx, dy) in CSS px · zoom(ratio) · pick(x, y) · start() / end(vx, vy) bracket a look drag (px/s at release).
  constructor({look, zoom, pick, start = () => {}, end = () => {}, now = () => performance.now()}) {
    this.actions = {look, zoom, pick, start, end};
    this.now = now;
    this.points = new Map();
    this.samples = [];
    this.reset();
  }

  reset() { this.distance = 0; this.dragged = false; this.start = null; this.pinching = false; this.samples.length = 0; }

  down(id, x, y, type = 'mouse') {
    if (!this.points.size) { this.reset(); this.start = {x, y}; this.type = type; this.dragging = false; }
    this.points.set(id, {x, y});
    if (this.points.size > 1) {
      // A second finger turns the gesture into a pinch: whatever was a drag ends without inertia.
      if (this.dragging) { this.actions.end(0, 0); this.dragging = false; }
      this.dragged = true; this.pinching = true; this.distance = this.span();
    }
  }

  span() {
    const p = [...this.points.values()];
    return p.length < 2 ? 0 : Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
  }

  move(id, x, y) {
    const old = this.points.get(id);
    if (!old) return;
    this.points.set(id, {x, y});
    if (this.points.size > 1) {
      const next = this.span();
      if (this.distance > 0 && next > 0) this.actions.zoom(next / this.distance);
      this.distance = next;
      return;
    }
    if (!this.dragged) {
      if (Math.hypot(x - this.start.x, y - this.start.y) <= (TAP_SLOP[this.type] ?? 8)) return;
      this.dragged = true;
    }
    if (!this.dragging) { this.dragging = true; this.actions.start(); }
    // The first movement past the slop carries the whole distance travelled so far: nothing is lost.
    const from = this.samples.length ? old : this.start;
    this.actions.look(x - from.x, y - from.y);
    const t = this.now();
    this.samples.push({t, x, y});
    while (this.samples.length > 2 && t - this.samples[0].t > 90) this.samples.shift();
  }

  up(id, x, y) {
    if (!this.points.has(id)) return;
    const tap = this.points.size === 1 && !this.dragged;
    const wasDragging = this.dragging;
    this.points.delete(id);
    // A finger left over after a pinch continues from where it is now, never from where it first landed.
    if (this.points.size) { this.start = {...[...this.points.values()][0]}; this.samples.length = 0; }
    if (tap) this.actions.pick(x, y);
    else if (wasDragging && !this.points.size) {
      // Release velocity from the last ~90 ms of movement; a finger that stopped before lifting does not fling.
      const s = this.samples, last = s[s.length - 1], first = s[0];
      let vx = 0, vy = 0;
      if (last && first && last !== first && this.now() - last.t < 60) {
        const dt = (last.t - first.t) / 1000;
        if (dt > 0.012) { vx = (last.x - first.x) / dt; vy = (last.y - first.y) / dt; }
      }
      this.actions.end(vx, vy);
    }
    if (!this.points.size) { this.dragging = false; this.reset(); }
    else { this.distance = this.span(); }
  }

  cancel() {
    if (this.dragging) this.actions.end(0, 0);
    this.points.clear(); this.dragging = false; this.reset(); this.dragged = true;
  }
}

export function firstMissingBrief(draft) {
  if (!draft.genre) return 'genre';
  if (!draft.mood) return 'mood';
  if (!draft.voice || !draft.language || !draft.tempo) return 'voice';
  if (draft.recipient.trim().length < 2 || draft.occasion.trim().length < 2 || draft.story.trim().length < 30) return 'story';
  return null;
}
