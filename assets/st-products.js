// Experience podiums. Every card carries its own information inside the 3D scene: front (name, price, highlights)
// and a spec panel (everything included). Landscape shows the three side by side; portrait is a coverflow carousel.
import * as THREE from './vendor/three.module.js';
import {Surface, textPlane, neonText, roundRect, fit, wrap, roundedSlab, glowSprite, damp, signature, FONT} from './gfx.js';
import {drawIcon, iconFor} from './icons.js';
import {stationGroup, AZIMUTH} from './layout.js';
import {put, Knob, Pill, neonFrame} from './st-kit.js';
import {PRODUCT_COLOR, PRODUCT_POINTS, PRODUCT_TAG_INDEX} from './content.js';

const CARD = {w: 3.7, h: 5.1}, SPEC = {w: 3.7, h: 3.5};

function drawFront(c, w, h, st) {
  const p = st?.product; if (!p) return;
  const color = st.color, dim = new THREE.Color(color).multiplyScalar(0.28).getStyle();
  roundRect(c, 6, 6, w - 12, h - 12, 56);
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#1c1036'); bg.addColorStop(1, '#0b0620'); c.fillStyle = bg; c.fill();
  c.save(); roundRect(c, 6, 6, w - 12, h - 12, 56); c.clip();
  const rg = c.createRadialGradient(w / 2, h * 0.27, 10, w / 2, h * 0.27, w * 0.75); rg.addColorStop(0, color + '99'); rg.addColorStop(1, color + '00'); c.fillStyle = rg; c.fillRect(0, 0, w, h * 0.65);
  c.restore();
  c.lineWidth = st.chosen ? 12 : 6; c.strokeStyle = st.chosen ? color : 'rgba(198,162,255,.4)'; c.shadowColor = color; c.shadowBlur = st.chosen ? 26 : 0; roundRect(c, 6, 6, w - 12, h - 12, 56); c.stroke(); c.shadowBlur = 0;
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = color; c.font = `800 ${w * 0.043}px ${FONT.sans}`; c.fillText(PRODUCT_TAG_INDEX[p.code] || '', w * 0.08, h * 0.065);
  if (st.chosen) { c.fillStyle = color; c.beginPath(); c.arc(w * 0.88, h * 0.065, w * 0.055, 0, Math.PI * 2); c.fill(); drawIcon(c, 'check', w * 0.88, h * 0.065, w * 0.07, {color: '#12081f', width: 3}); }
  drawIcon(c, iconFor('product', p.code), w / 2, h * 0.255, w * 0.34, {color: '#fff', width: 1.7, glow: 26});
  c.textAlign = 'center'; c.fillStyle = '#fff'; c.font = `800 ${w * 0.083}px ${FONT.sans}`;
  const lines = wrap(c, p.name, w * 0.84); lines.slice(0, 2).forEach((l, i) => c.fillText(l, w / 2, h * 0.47 + i * w * 0.095));
  const py = h * (lines.length > 1 ? 0.63 : 0.585);
  c.font = `700 ${w * 0.04}px ${FONT.sans}`; const tw = c.measureText(p.tag).width + w * 0.09;
  roundRect(c, w / 2 - tw / 2, py - w * 0.038, tw, w * 0.076, w * 0.038); c.fillStyle = color + '2e'; c.fill(); c.lineWidth = 3; c.strokeStyle = color; c.stroke(); c.fillStyle = '#fff'; c.fillText(p.tag, w / 2, py + 1);
  const price = p.priceText.replace(' COP', '');
  if (p.listText) { c.textAlign = 'center'; c.fillStyle = '#b9a6e6'; c.font = `700 ${w * 0.045}px ${FONT.sans}`; const wasTxt = p.listText, tw0 = c.measureText(wasTxt).width, yy = h * 0.69; c.fillText(wasTxt, w / 2, yy); c.strokeStyle = '#ff7fdc'; c.lineWidth = 3; c.beginPath(); c.moveTo(w / 2 - tw0 / 2, yy); c.lineTo(w / 2 + tw0 / 2, yy); c.stroke(); }
  neonText(c, price, w / 2, h * 0.755, {size: w * 0.15, color, blur: 20, maxW: w * 0.86});
  c.fillStyle = '#b9a6e6'; c.font = `700 ${w * 0.04}px ${FONT.sans}`; c.textAlign = 'center'; c.fillText('COP', w / 2, h * 0.815);
  (PRODUCT_POINTS[p.code] || []).forEach((t, i) => {
    const y = h * (0.885 + i * 0.05); c.font = `600 ${w * 0.043}px ${FONT.sans}`; const tw2 = c.measureText(t).width + w * 0.08, x0 = w / 2 - tw2 / 2;
    drawIcon(c, 'check', x0 + w * 0.025, y, w * 0.05, {color, width: 2.6}); c.fillStyle = '#efe6ff'; c.textAlign = 'left'; c.fillText(t, x0 + w * 0.065, y + 1);
  });
}

function drawSpec(c, w, h, st) {
  const p = st?.product; if (!p) return;
  const color = st.color;
  roundRect(c, 6, 6, w - 12, h - 12, 44);
  const bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, 'rgba(24,12,50,.96)'); bg.addColorStop(1, 'rgba(9,4,22,.96)'); c.fillStyle = bg; c.fill();
  c.lineWidth = 5; c.strokeStyle = color; c.shadowColor = color; c.shadowBlur = st.focus ? 20 : 6; roundRect(c, 6, 6, w - 12, h - 12, 44); c.stroke(); c.shadowBlur = 0;
  c.textAlign = 'left'; c.textBaseline = 'middle'; c.fillStyle = color; c.font = `800 ${w * 0.045}px ${FONT.sans}`; c.fillText('QUÉ INCLUYE', w * 0.08, h * 0.075);
  // Fit every feature: shrink the type until the list fits the panel.
  const maxH = h * 0.82; let size = w * 0.056, rows;
  for (; size > w * 0.034; size -= 1) {
    c.font = `600 ${size}px ${FONT.sans}`;
    rows = p.features.map(f => wrap(c, f, w * 0.75));
    const total = rows.reduce((a, r) => a + r.length * size * 1.22 + size * 0.5, 0);
    if (total <= maxH - h * 0.05) break;
  }
  let y = h * 0.16;
  rows.forEach(lines => {
    drawIcon(c, 'check', w * 0.1, y + size * 0.6, size * 1.05, {color, width: 2.8});
    c.fillStyle = '#efe6ff'; c.font = `600 ${size}px ${FONT.sans}`;
    lines.forEach((l, i) => c.fillText(l, w * 0.17, y + size * 0.62 + i * size * 1.22));
    y += lines.length * size * 1.22 + size * 0.5;
  });
}

export function buildProducts(s) {
  const g = stationGroup(AZIMUTH.products); s.scene.add(g);
  const m = s.m, st = {group: g, items: [], focus: 1, chosen: null, portrait: false};

  // Floor: a wide arc of light under the podiums
  const arc = put(g, new THREE.RingGeometry(9, 9.12, 96, 1, Math.PI * 0.2, Math.PI * 0.6), m.neon, 0, 0.05, 0); arc.rotation.x = -Math.PI / 2;
  put(g, new THREE.BoxGeometry(24, 15, 0.4), m.dark, 0, 7.5, -3.8);
  const fr = new THREE.Group(); fr.position.set(0, 7.5, -3.55); g.add(fr); neonFrame(fr, 23.6, 14.6, m.neon, 0.06);

  st.setContent = content => {
    st.items.forEach(it => { g.remove(it.group); for (const h of [it.cardHit, it.pill.hit]) { const i = s.pickables.indexOf(h); if (i >= 0) s.pickables.splice(i, 1); } });
    st.items = content.products.map((product, index) => {
      const color = PRODUCT_COLOR[product.code] || '#c6a2ff', grp = new THREE.Group(); g.add(grp);
      put(grp, new THREE.CylinderGeometry(2.6, 2.8, 0.3, 48), m.metal, 0, 0.15, 0);
      const ringMat = new THREE.MeshBasicMaterial({color, toneMapped: false}); const ring = put(grp, new THREE.TorusGeometry(2.6, 0.05, 8, 64), ringMat, 0, 0.32, 0); ring.rotation.x = Math.PI / 2;
      const card = new THREE.Group(); grp.add(card);
      put(card, roundedSlab(CARD.w, CARD.h, 0.16, 0.34, 0.03), new THREE.MeshStandardMaterial({color: 0x1a0f30, metalness: 0.5, roughness: 0.35}));
      const front = new Surface(740, 1020, drawFront); front.redraw({product, color, chosen: false});
      const face = put(card, new THREE.PlaneGeometry(CARD.w * 0.985, CARD.h * 0.985), new THREE.MeshBasicMaterial({map: front.tex, transparent: true, toneMapped: false}), 0, 0, 0.115);
      const glow = glowSprite(new THREE.Color(color), 8, 0.2); glow.position.z = -0.6; card.add(glow);
      const cardHit = new THREE.Mesh(new THREE.PlaneGeometry(CARD.w, CARD.h), m.hit); cardHit.position.z = 0.13; cardHit.userData = {action: {type: 'product', index, choose: false}, id: `product:${index}`, target: card}; card.add(cardHit); s.pickables.push(cardHit);
      const specSurface = new Surface(740, 700, drawSpec); specSurface.redraw({product, color, focus: false});
      const spec = put(grp, new THREE.PlaneGeometry(SPEC.w, SPEC.h), new THREE.MeshBasicMaterial({map: specSurface.tex, transparent: true, toneMapped: false}));
      const pill = new Pill(s, {w: 3.7, h: 1.08, label: 'Elegir esta experiencia', action: {type: 'product', index, choose: true}, id: `product-choose:${index}`, color});
      grp.add(pill.group);
      return {group: grp, card, face, front, spec, specSurface, pill, cardHit, product, color, index, glow, ring, x: 0, z: 0, rot: 0, sc: 1, specSc: 1, lift: 0, hov: 0, dim: 1};
    });
    // Portrait navigation: two round arrows flank the choose button.
    for (const k of [st.prev, st.next]) if (k) { k.group.parent?.remove(k.group); for (const h of k.group.children) { const i = s.pickables.indexOf(h); if (i >= 0) s.pickables.splice(i, 1); } const j = s.pickables.findIndex(o => o.userData?.target === k); if (j >= 0) s.pickables.splice(j, 1); }
    st.prev = new Knob(s, {kind: 'nav', value: 'prev', icon: 'back', color: '#c6a2ff', r: 0.66, action: {type: 'product-step', dir: -1}, id: 'product-prev'});
    st.next = new Knob(s, {kind: 'nav', value: 'next', icon: 'arrow', color: '#c6a2ff', r: 0.66, action: {type: 'product-step', dir: 1}, id: 'product-next'});
    g.add(st.prev.group, st.next.group);
    st.focus = Math.max(0, st.items.findIndex(it => it.product.code === st.chosen)); if (st.focus < 0) st.focus = 0;
    st.sig = null; st.relayout(s.portrait); st.snapLayout();
  };

  st.relayout = portrait => { st.portrait = portrait; };
  const targets = i => {
    const it = st.items[i], n = st.items.length, f = st.focus;
    if (!st.portrait) return {x: (i - (n - 1) / 2) * 6.6, z: i === f ? 0.4 : 0, rot: (i - (n - 1) / 2) * -0.06, sc: i === f ? 1.12 : 0.93, specSc: 1, dim: i === f ? 1 : 0.8};
    const d = i - f;
    return {x: d * 4.9, z: d === 0 ? 0.4 : -1.4, rot: -d * 0.42, sc: d === 0 ? 1 : 0.8, specSc: d === 0 ? 1 : 0.001, dim: d === 0 ? 1 : 0.5};
  };
  st.snapLayout = () => st.items.forEach((it, i) => { const t = targets(i); it.x = t.x; it.z = t.z; it.rot = t.rot; it.sc = t.sc; it.specSc = t.specSc; it.dim = t.dim; });

  st.setFocus = i => {
    if (!st.items.length) return;
    st.focus = (i + st.items.length) % st.items.length;
    st.items.forEach((it, k) => it.specSurface.redraw({product: it.product, color: it.color, focus: k === st.focus}));
  };
  const chosenIndex = () => st.items.findIndex(it => it.product.code === st.chosen);
  st.setDraft = d => {
    const sig = signature(d, ['product']); if (sig === st.sig) return; st.sig = sig;
    st.chosen = d.product;
    st.items.forEach((it, k) => {
      const on = it.product.code === st.chosen;
      it.front.redraw({product: it.product, color: it.color, chosen: on});
      it.pill.set({on, text: on ? '✓ Experiencia elegida' : 'Elegir esta experiencia'});
    });
  };
  st.setView = view => { if (view === 'products' && st.items.length) { const c = chosenIndex(); if (c >= 0) st.setFocus(c); } };
  st.handle = a => {
    if (a.type === 'product-step') { st.setFocus(st.focus + a.dir); s.pulse(0.5); return true; }
    // The card and its button do the same thing: bring the experience forward AND choose it (the app takes care of the choice).
    if (a.type === 'product') { st.setFocus(a.index); s.pulse(0.5); return false; }
    return false;
  };
  st.update = (dt, t, c) => {
    const n = st.items.length;
    st.items.forEach((it, i) => {
      const tg = targets(i), focused = i === st.focus;
      it.x = damp(it.x, tg.x, 7, dt); it.z = damp(it.z, tg.z, 7, dt); it.rot = damp(it.rot, tg.rot, 7, dt); it.sc = damp(it.sc, tg.sc, 8, dt); it.specSc = damp(it.specSc, tg.specSc, 9, dt); it.dim = damp(it.dim, tg.dim, 8, dt);
      it.hov = damp(it.hov, c.hovered === it.card ? 1 : 0, 12, dt);
      it.group.position.set(it.x, 0, it.z); it.group.rotation.y = it.rot; it.group.scale.setScalar(it.sc);
      const float = s.still ? 0 : Math.sin(t * 0.7 + i) * 0.09;
      it.card.position.set(0, 7.75 + float + it.hov * 0.15, 0);
      it.spec.position.set(0, 3.5, 0.04); it.spec.scale.setScalar(Math.max(0.001, it.specSc)); it.spec.visible = it.specSc > 0.03;
      it.pill.group.position.set(0, 1.2, 0.5); it.pill.group.scale.setScalar(Math.max(0.001, it.specSc)); it.pill.group.visible = it.specSc > 0.03; it.pill.hit.visible = it.specSc > 0.5;
      it.pill.group.scale.multiplyScalar(1); it.pill.update(dt, c.hovered);
      it.face.material.color.setScalar(0.55 + 0.45 * it.dim); it.spec.material.opacity = Math.min(1, it.dim + 0.2);
      it.glow.material.opacity = 0.14 + (focused ? 0.22 : 0) + c.energy * 0.1;
      it.card.rotation.y = s.still ? 0 : Math.sin(t * 0.5 + i) * 0.05;
    });
    // Arrows only exist in the carousel
    const show = st.portrait && n > 1;
    for (const [k, x] of [[st.prev, -2.55], [st.next, 2.55]]) { if (!k) continue; k.group.visible = show; k.group.position.set(x, 1.2, 0.9); k.update(dt, c.hovered); }
  };
  st.shot = portrait => {
    const cx = 0; const n = st.items.length || 3;
    if (portrait) return {focus: g.localToWorld(new THREE.Vector3(cx, 4.9, 0.4)), az: AZIMUTH.products, pitch: 0.03, w: 5.8, h: 12.2, limits: {yaw: 22, pMin: -8, pMax: 12}};
    return {focus: g.localToWorld(new THREE.Vector3(0, 5.3, 0.4)), az: AZIMUTH.products, pitch: 0.04, w: (n - 1) * 6.6 + 5.4, h: 12.8, limits: {yaw: 26, pMin: -8, pMax: 12}};
  };
  s.stations.products = st; s.updaters.push(st.update);
  return st;
}
