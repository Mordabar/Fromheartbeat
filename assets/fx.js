import * as THREE from './vendor/three.module.js';
import {glowTexture} from './gfx.js';

// Pooled sparks: a tap sprays a few, a celebration fills the stage. One draw call, no allocation per burst.
export class Bursts {
  constructor(scene, max = 220) {
    this.max = max; this.next = 0;
    this.pos = new Float32Array(max * 3); this.vel = new Float32Array(max * 3); this.col = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.base = new Float32Array(max * 3);
    const geo = this.geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(geo, new THREE.PointsMaterial({
      map: glowTexture(), size: 0.62, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    }));
    this.points.frustumCulled = false; this.points.renderOrder = 8;
    scene.add(this.points);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -100;      // parked far below the floor until used
  }

  // Sparks flying out of `origin` (world position) in `color`. speed in units/s; ring=true spreads them on a disc facing the viewer.
  emit(origin, color, {count = 24, speed = 3.4, ring = false, up = 0.6} = {}) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.next; this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2, s = speed * (0.45 + Math.random() * 0.75);
      const z = ring ? (Math.random() - 0.5) * 0.4 : (Math.random() - 0.5) * 2;
      this.pos.set([origin.x, origin.y, origin.z], i * 3);
      this.vel.set([Math.cos(a) * s, Math.sin(a) * s * (ring ? 1 : 0.8) + up, z * s * 0.6], i * 3);
      const j = 0.75 + Math.random() * 0.5;
      this.base.set([Math.min(1, c.r * j + 0.15), Math.min(1, c.g * j + 0.15), Math.min(1, c.b * j + 0.15)], i * 3);
      this.life[i] = 1;
    }
  }

  update(dt) {
    let live = false;
    for (let i = 0; i < this.max; i++) {
      const l = this.life[i]; if (l <= 0) continue;
      live = true;
      const k = i * 3, drag = Math.max(0, 1 - 2.4 * dt);
      this.vel[k] *= drag; this.vel[k + 1] = this.vel[k + 1] * drag - 2.4 * dt; this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const life = l - dt / 1.05; this.life[i] = life;
      const f = Math.max(0, life) ** 1.4;                    // additive blending: fading to black is fading out
      this.col[k] = this.base[k] * f; this.col[k + 1] = this.base[k + 1] * f; this.col[k + 2] = this.base[k + 2] * f;
      if (life <= 0) this.pos[k + 1] = -100;
    }
    if (live || this.dirty) { this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; }
    this.dirty = live;
  }
}
