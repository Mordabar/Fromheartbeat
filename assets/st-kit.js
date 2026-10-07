// Small building blocks shared by the stations: boxes, glass screens, round icon knobs and pill buttons.
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, roundRect, fit, roundedSlab, glowSprite, damp, FONT} from './gfx.js';
import {drawIcon} from './icons.js';

export const put = (parent, geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parent.add(o); return o; };
export const box = (parent, w, h, d, mat, x, y, z) => put(parent, new THREE.BoxGeometry(w, h, d), mat, x, y, z);

// A thin neon frame around a w×h rectangle centred on the origin (four bars).
export function neonFrame(parent, w, h, mat, t = 0.07, z = 0) {
  box(parent, w, t, t, mat, 0, h / 2, z); box(parent, w, t, t, mat, 0, -h / 2, z);
  box(parent, t, h, t, mat, -w / 2, 0, z); box(parent, t, h, t, mat, w / 2, 0, z);
}

// A lit glass screen showing a canvas surface. draw(ctx, w, h, state). Returns {group, surface}.
export function makeScreen(s, w, h, draw, {px = 190, frame = s.m.accent, bezel = 0.28} = {}) {
  const group = new THREE.Group();
  const back = put(group, roundedSlab(w + bezel * 2, h + bezel * 2, 0.22, 0.28, 0.02), s.m.dark, 0, 0, -0.12);
  const {mesh, surface} = textPlane(w, h, draw, {px, transparent: false});
  mesh.material.transparent = false; mesh.material.depthWrite = true; mesh.position.z = 0.02; group.add(mesh);
  neonFrame(group, w + bezel * 1.2, h + bezel * 1.2, frame, 0.05, 0.04);
  return {group, surface, mesh, back};
}

// Round icon button on a tilted strip. Its `hit` mesh carries the action.
export class Knob {
  constructor(s, {kind, value, icon, color, label, r = 0.6, badge = null, action = null, id = null}) {
    this.value = value; this.kind = kind; this.color = new THREE.Color(color);
    const g = this.group = new THREE.Group(), m = s.m;
    const base = put(g, new THREE.CylinderGeometry(r * 1.14, r * 1.22, 0.3, 40), m.metal); base.rotation.x = Math.PI / 2;
    // Cap, face and ring travel together, so pressing or selecting never buries the icon under the cap.
    const top = this.top = new THREE.Group(); top.position.z = 0.2; g.add(top);
    const cap = put(top, new THREE.CylinderGeometry(r, r, 0.22, 40), m.dark); cap.rotation.x = Math.PI / 2;
    this.face = put(top, new THREE.CircleGeometry(r * 0.94, 40), new THREE.MeshBasicMaterial({map: new Surface(256, 256, (c, w) => {
      const gr = c.createRadialGradient(w / 2, w / 2, 10, w / 2, w / 2, w / 2); gr.addColorStop(0, '#2c1a58'); gr.addColorStop(1, '#130a28');
      c.fillStyle = gr; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.fill();
      if (badge) { c.fillStyle = color; c.textAlign = 'center'; c.textBaseline = 'middle'; c.shadowColor = color; c.shadowBlur = 14; fit(c, badge, w * 0.66, 92, 800); c.fillText(badge, w / 2, w / 2); }
      else drawIcon(c, icon, w / 2, w / 2, w * 0.5, {color, width: 1.9, glow: 12});
    }, {aniso: 4}).tex, transparent: true, toneMapped: false}), 0, 0, 0.125);
    this.ring = put(top, new THREE.TorusGeometry(r * 1.05, 0.05, 8, 48), new THREE.MeshBasicMaterial({color, transparent: true, opacity: 0, toneMapped: false, blending: THREE.AdditiveBlending}), 0, 0, 0.1);
    this.glow = glowSprite(color, r * 4.2, 0); this.glow.position.z = -0.2; g.add(this.glow);
    if (label) {
      // The label sits on its own dark plate: set straight onto the 3D scene (floor lines, light strips) it would get lost.
      const t = textPlane(r * 2.34, r * 0.82, (c, w, h) => {
        roundRect(c, 3, 3, w - 6, h - 6, h * 0.46); c.fillStyle = 'rgba(9,4,22,.94)'; c.fill(); c.lineWidth = 3; c.strokeStyle = color + '99'; c.stroke();
        c.fillStyle = '#ffffff'; c.textAlign = 'center'; c.textBaseline = 'middle'; fit(c, label, w * 0.86, h * 0.56, 800); c.fillText(label, w / 2, h / 2 + 1);
      }, {px: 170});
      t.mesh.position.set(0, -r * 1.58, 0.3); t.mesh.renderOrder = 6; g.add(t.mesh);
    }
    base.userData = {kind, target: this, action: action || {type: 'pick', kind, value}, id: id || `${kind}:${value}`};
    s.pickables.push(base);
    this.hit = base; this.sel = 0; this.hov = 0; this.press = 0; this.selected = false;
  }
  update(dt, hovered) {
    this.sel = damp(this.sel, this.selected ? 1 : 0, 12, dt);
    this.hov = damp(this.hov, hovered === this ? 1 : 0, 14, dt);
    this.press = Math.max(0, this.press - dt * 3.2);
    this.top.position.z = 0.2 + this.sel * 0.05 - Math.sin(this.press * Math.PI) * 0.09;
    this.ring.material.opacity = this.sel * 0.95 + this.hov * 0.4;
    this.glow.material.opacity = this.sel * 0.4 + this.hov * 0.14;
    this.face.material.color.setScalar(0.7 + this.sel * 0.3 + this.hov * 0.12);
  }
}

// Pill-shaped 3D button with a text label. label: string or (state) => string.
export class Pill {
  constructor(s, {w = 4, h = 1, label, action, id, color = '#c6a2ff', icon = null, fill = false}) {
    this.color = color; this.fill = fill; this.icon = icon; this.labelText = label; this.state = {on: false, text: label};
    const g = this.group = new THREE.Group();
    this.plane = textPlane(w, h, (c, cw, ch, st) => {
      const on = st?.on, text = st?.text ?? label, pad = ch * 0.08;
      roundRect(c, pad, pad, cw - pad * 2, ch - pad * 2, ch * 0.5);
      const gr = c.createLinearGradient(0, 0, 0, ch);
      if (on || this.fill) { gr.addColorStop(0, color + 'ee'); gr.addColorStop(1, color + 'aa'); } else { gr.addColorStop(0, '#2a1a52'); gr.addColorStop(1, '#150b2c'); }
      c.fillStyle = gr; c.fill(); c.lineWidth = ch * 0.045; c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = ch * 0.16; c.stroke(); c.shadowBlur = 0;
      const ink = (on || this.fill) ? '#12081f' : '#f6f0ff', size = ch * 0.34;
      c.textBaseline = 'middle'; c.fillStyle = ink; c.font = `800 ${size}px ${FONT.sans}`;
      const iconSize = icon ? ch * 0.5 : 0, gap = icon ? ch * 0.2 : 0;
      fit(c, text, cw - ch * 1.1 - iconSize - gap, size, 800, FONT.sans, 12);
      const tw = c.measureText(text).width, total = tw + iconSize + gap, x0 = (cw - total) / 2;
      if (icon) drawIcon(c, icon, x0 + iconSize / 2, ch / 2, iconSize, {color: ink, width: 2.2});
      c.textAlign = 'left'; c.fillText(text, x0 + iconSize + gap, ch / 2 + ch * 0.02);
    }, {px: 170});
    this.plane.surface.redraw(this.state);
    g.add(this.plane.mesh);
    const hit = this.hit = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.08, h * 1.6), s.m.hit);
    hit.position.z = 0.03; hit.userData = {action, id, target: this}; g.add(hit); s.pickables.push(hit);
    this.hov = 0; this.hotSprite = glowSprite(color, w * 1.3, 0); this.hotSprite.scale.set(w * 1.35, h * 2.2, 1); this.hotSprite.position.z = -0.05; g.add(this.hotSprite);
  }
  set({on, text} = {}) {
    if (on !== undefined) this.state.on = on;
    if (text !== undefined) this.state.text = text;
    this.plane.surface.redraw(this.state);
  }
  update(dt, hovered) {
    this.hov = damp(this.hov, hovered === this ? 1 : 0, 14, dt);
    this.group.scale.setScalar(1 + this.hov * 0.05);
    this.hotSprite.material.opacity = this.hov * 0.35 + (this.state.on ? 0.22 : 0);
  }
}
