import * as THREE from './vendor/three.module.js';
import {Surface, roundRect, fit, neonText, roundedSlab, glowSprite, damp, FONT} from './gfx.js';
import {drawIcon} from './icons.js';

// One physical pad: dark glossy slab, engraved icon + name, neon frame and glow when chosen.
function drawPad(g, w, h, item) {
  g.clearRect(0, 0, w, h);
  if (!item) return;
  const accent = item.color || '#c6a2ff';
  roundRect(g, 5, 5, w - 10, h - 10, w * 0.12);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#2a1a52'); gr.addColorStop(1, '#130a28');
  g.fillStyle = gr; g.fill();
  g.lineWidth = 3; g.strokeStyle = 'rgba(198,162,255,.28)'; g.stroke();
  const hasLabel = !!item.label, size = Math.min(w, h * (hasLabel ? 0.78 : 1)) * 0.5;
  const y = hasLabel ? h * 0.42 : h * 0.5;
  if (item.badge) neonText(g, item.badge, w / 2, y, {size: size * 0.95, color: accent, blur: 12, maxW: w * 0.74});
  else drawIcon(g, item.icon, w / 2, y, size, {color: accent, width: 1.9, glow: 12});
  if (hasLabel) {
    g.fillStyle = '#f4eeff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    fit(g, item.label, w - 34, Math.round(w * 0.135), 700, FONT.sans, 12);
    g.fillText(item.label, w / 2, h * 0.84);
  }
}

let frameTex;
const frameTexture = () => frameTex ||= new Surface(128, 128, (g, w, h) => {
  roundRect(g, 6, 6, w - 12, h - 12, 20);
  g.lineWidth = 6; g.strokeStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 10; g.stroke();
}, {aniso: 4}).tex;

export class PadBoard {
  // studio: Studio (for the pick list) · kind: what a pick means · capacity: pad slots to create.
  constructor(studio, {kind, capacity, padW = 2, padH = 2, gap = 0.2, depth = 0.24, texture = 256}) {
    this.studio = studio; this.kind = kind; this.padW = padW; this.padH = padH; this.gap = gap; this.depth = depth;
    this.group = new THREE.Group();
    this.items = []; this.selected = null;
    const aspect = padH / padW, slab = roundedSlab(padW, padH, depth, padW * 0.13, 0.03);
    const base = new THREE.MeshStandardMaterial({color: 0x150c2b, metalness: 0.55, roughness: 0.32});
    const frameGeo = new THREE.PlaneGeometry(padW * 1.07, padH * 1.07), faceGeo = new THREE.PlaneGeometry(padW * 0.985, padH * 0.985);
    this.pads = Array.from({length: capacity}, (_, i) => {
      const group = new THREE.Group(); this.group.add(group);
      const body = new THREE.Mesh(slab, base); group.add(body);
      const surface = new Surface(texture, Math.round(texture * aspect), drawPad);
      const face = new THREE.Mesh(faceGeo, new THREE.MeshBasicMaterial({map: surface.tex, transparent: true, toneMapped: false}));
      face.position.z = depth / 2 + 0.036; group.add(face);
      const frame = new THREE.Mesh(frameGeo, new THREE.MeshBasicMaterial({map: frameTexture(), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false}));
      frame.position.z = depth / 2 + 0.05; group.add(frame);
      const glow = glowSprite(0xffffff, padW * 2.2, 0); glow.position.z = -0.1; group.add(glow);
      const pad = {group, body, face, surface, frame, glow, item: null, z: 0, sel: 0, hov: 0, press: 0, flip: null, index: i, home: new THREE.Vector3()};
      body.userData = {kind, target: pad, action: null};
      studio.pickables.push(body);
      group.visible = false;
      return pad;
    });
    this.rows = 1; this.cols = 1;
  }

  get bounds() {
    const n = this.items.length, cols = Math.min(this.cols, Math.max(1, n)), rows = Math.ceil(n / this.cols) || 1;
    return {w: cols * this.padW + (cols - 1) * this.gap, h: rows * this.padH + (rows - 1) * this.gap};
  }

  // Places the active pads on a grid (centred on the group origin). Rows with fewer pads are centred.
  layout(cols) {
    this.cols = Math.max(1, cols);
    const n = this.items.length, rows = Math.ceil(n / this.cols) || 1;
    this.rows = rows;
    const sx = this.padW + this.gap, sy = this.padH + this.gap;
    this.pads.forEach((pad, i) => {
      if (i >= n) { pad.group.visible = false; return; }
      const row = Math.floor(i / this.cols), inRow = Math.min(this.cols, n - row * this.cols);
      const col = i - row * this.cols;
      pad.home.set((col - (inRow - 1) / 2) * sx, ((rows - 1) / 2 - row) * sy, 0);
      pad.group.position.copy(pad.home);
      pad.group.visible = true;
    });
  }

  // items: [{value, label, icon, badge, color}] · animate: flip the pads over to the new content.
  setItems(items, {animate = false} = {}) {
    this.items = items;
    this.pads.forEach((pad, i) => {
      const item = items[i] || null;
      pad.body.userData.action = item ? {type: 'pick', kind: this.kind, value: item.value} : null;
      pad.body.userData.id = item ? `${this.kind}:${item.value}` : '';
      if (animate && item && pad.item) pad.flip = {t: -i * 0.035, item, swapped: false};
      else { pad.item = item; pad.surface.redraw(item); }
    });
    this.layout(this.cols);
    this.applySelection();
  }

  setSelected(value) { this.selected = value; this.applySelection(); }
  applySelection() {
    this.pads.forEach(pad => {
      const item = pad.flip?.item || pad.item;
      pad.target = item && item.value === this.selected ? 1 : 0;
    });
  }

  pulse(value) { const pad = this.pads.find(p => p.item?.value === value); if (pad) pad.press = 1; }
  padOf(value) { return this.pads.find(p => p.group.visible && p.item?.value === value); }

  update(dt, hovered, accent) {
    for (const pad of this.pads) {
      if (!pad.group.visible) continue;
      if (pad.flip) {
        const f = pad.flip; f.t += dt / 0.13;
        if (f.t >= 0) {
          if (!f.swapped && f.t >= 1) { f.swapped = true; pad.item = f.item; pad.surface.redraw(f.item); }
          const k = f.t < 1 ? f.t : 2 - f.t;
          pad.group.rotation.x = Math.max(0, Math.min(1, k)) * Math.PI / 2;
          if (f.t >= 2) { pad.flip = null; pad.group.rotation.x = 0; this.applySelection(); }
        }
      }
      const isHover = hovered === pad ? 1 : 0;
      pad.sel = damp(pad.sel, pad.target || 0, 12, dt);
      pad.hov = damp(pad.hov, isHover, 14, dt);
      pad.press = Math.max(0, pad.press - dt * 3.2);
      pad.z = pad.sel * 0.2 + pad.hov * 0.08 - Math.sin(pad.press * Math.PI) * 0.12;
      pad.group.position.z = pad.home.z + pad.z;
      const tint = pad.item ? new THREE.Color(pad.item.color || '#c6a2ff') : accent;
      pad.frame.material.color.copy(tint);
      pad.frame.material.opacity = Math.min(1, pad.sel * 0.95 + pad.hov * 0.45);
      pad.glow.material.color.copy(tint);
      pad.glow.material.opacity = pad.sel * 0.42 + pad.hov * 0.16;
      pad.face.material.color.setScalar(0.72 + pad.sel * 0.28 + pad.hov * 0.12);
    }
  }
}
