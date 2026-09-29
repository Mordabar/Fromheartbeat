import * as THREE from './vendor/three.module.js';

export const FONT = {sans: 'Manrope, Arial, sans-serif', serif: 'Editorial, Georgia, serif'};
// Site-relative URLs ("assets/...") resolved against the site root, whatever page hosts the studio.
export const siteUrl = path => new URL(path, new URL('../', import.meta.url)).href;
export const hex = n => '#' + n.toString(16).padStart(6, '0');

// ---- Fonts: canvas text needs the web fonts loaded, so every text surface registers a redraw hook.
const redraws = new Set();
let fontsHooked = false;
export function onFontsReady(fn) {
  redraws.add(fn);
  if (!fontsHooked) {
    fontsHooked = true;
    const go = () => redraws.forEach(f => { try { f(); } catch (e) { console.warn(e); } });
    Promise.all([document.fonts?.load('800 40px Manrope'), document.fonts?.load('500 40px Manrope'), document.fonts?.load('italic 500 40px Editorial')].filter(Boolean)).then(go).catch(() => {});
    document.fonts?.ready?.then(go);
  }
}

// ---- Canvas surfaces -> textures
export class Surface {
  constructor(w, h, draw, {aniso = 8, repeat = null} = {}) {
    this.w = w; this.h = h; this.draw = draw;
    this.canvas = document.createElement('canvas');
    this.canvas.width = w; this.canvas.height = h;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = aniso;
    if (repeat) { this.tex.wrapS = this.tex.wrapT = THREE.RepeatWrapping; this.tex.repeat.set(...repeat); }
    this.redraw();
    onFontsReady(() => this.redraw());
  }
  redraw(state) {
    if (state !== undefined) this.state = state;
    // Every (re)draw starts from a clean context: draw functions may translate, blur or clip freely.
    const g = this.ctx; g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, this.w, this.h);
    try { this.draw(g, this.w, this.h, this.state); } finally { g.restore(); }
    this.tex.needsUpdate = true;
  }
}

export function roundRect(g, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}

// Largest size (≤ start) at which `text` fits in maxW.
export function fit(g, text, maxW, start, weight = 700, family = FONT.sans, min = 10) {
  let size = start;
  for (; size > min; size -= 2) { g.font = `${weight} ${size}px ${family}`; if (g.measureText(text).width <= maxW) break; }
  g.font = `${weight} ${size}px ${family}`;
  return size;
}

export function wrap(g, text, maxW) {
  const words = String(text).split(/\s+/), lines = [];
  let row = '';
  for (let word of words) {
    while (g.measureText(word).width > maxW && word.length > 1) {          // a word wider than the line is cut, never allowed to overflow
      let n = word.length - 1; while (n > 1 && g.measureText(word.slice(0, n)).width > maxW) n--;
      if (row) { lines.push(row); row = ''; }
      lines.push(word.slice(0, n)); word = word.slice(n);
    }
    const test = row ? row + ' ' + word : word;
    if (g.measureText(test).width > maxW && row) { lines.push(row); row = word; } else row = test;
  }
  if (row) lines.push(row);
  return lines;
}

// Neon tube text: soft colour bloom underneath, near-white core on top.
export function neonText(g, text, x, y, {size = 96, color = '#c6a2ff', weight = 800, family = FONT.sans, blur = 26, align = 'center', maxW} = {}) {
  if (maxW) size = fit(g, text, maxW, size, weight, family);
  else g.font = `${weight} ${size}px ${family}`;
  g.textAlign = align; g.textBaseline = 'middle';
  g.shadowColor = color; g.fillStyle = color;
  g.shadowBlur = blur; g.fillText(text, x, y);
  g.shadowBlur = blur * 0.4; g.fillText(text, x, y);
  g.shadowBlur = 0; g.fillStyle = '#ffffff'; g.globalAlpha = 0.9; g.fillText(text, x, y); g.globalAlpha = 1;
}

// ---- Geometry helpers
export function roundedRectShape(w, h, r) {
  const x = -w / 2, y = -h / 2, s = new THREE.Shape();
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
export function roundedSlab(w, h, depth, r, bevel = 0.03) {
  const g = new THREE.ExtrudeGeometry(roundedRectShape(w, h, r), {depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 6});
  g.translate(0, 0, -depth / 2);
  return g;
}

export const glowTexture = (() => {
  let tex;
  return () => tex ||= new Surface(128, 128, (g, w) => {
    const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, w);
  }, {aniso: 1}).tex;
})();

export function glowSprite(color, size, opacity = 0.5) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false}));
  s.scale.setScalar(size);
  return s;
}

// A flat panel showing a canvas surface; returns {mesh, surface}.
export function textPlane(width, height, draw, {px = 200, transparent = true, depthTest = true, additive = false} = {}) {
  const surface = new Surface(Math.round(width * px), Math.round(height * px), draw);
  const material = new THREE.MeshBasicMaterial({map: surface.tex, transparent, toneMapped: false, depthWrite: false, depthTest, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending});
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  return {mesh, surface};
}

export const signature = (obj, keys) => keys.map(k => obj?.[k] ?? '').join('\u241f');
export const damp = (current, target, lambda, dt) => current + (target - current) * (1 - Math.exp(-lambda * dt));
export const easeInOut = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const shortestAngle = d => Math.atan2(Math.sin(d), Math.cos(d));
