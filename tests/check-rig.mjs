import assert from 'node:assert/strict';
import {LookRig} from '../assets/camera-rig.js';
import {StudioGesture} from '../assets/spatial-controls.js';

const deg = r => r * 180 / Math.PI, rad = d => d * Math.PI / 180;
const settle = (rig, s = 3) => { for (let i = 0; i < s * 60; i++) rig.update(1 / 60); };

// 1) Exactness: the scene follows the finger 1:1 at the centre, on desktop and phone alike.
{
  const rig = new LookRig({yaw: rad(90)});                       // wide limit so it does not interfere
  rig.beginDrag(); rig.drag(300, 0, rad(50), 900);                // desktop: 300 px on a 900 px tall viewport, 50° fov
  assert.ok(Math.abs(deg(-rig.yaw) - 300 * 50 / 900) < 0.05, `desktop: ${deg(rig.yaw)}°`);
  assert.ok(Math.abs(deg(rig.yaw)) < 17.5, 'the old build turned ~180° for this same drag');
  const phone = new LookRig({yaw: rad(90)});
  phone.beginDrag(); phone.drag(100, 0, rad(65), 844);
  assert.ok(Math.abs(deg(-phone.yaw) - 100 * 65 / 844) < 0.05, `phone: ${deg(phone.yaw)}°`);
  // Direction: dragging right turns the camera left (yaw < 0); dragging down looks up (pitch > 0).
  assert.ok(rig.yaw < 0); rig.drag(0, 50, rad(50), 900); assert.ok(rig.pitch > 0);
}

// 2) Hard limits: even an absurd drag stays within limit + a small elastic stretch, and settles inside the limit.
{
  const rig = new LookRig({yaw: rad(35), pitchMin: rad(-8), pitchMax: rad(15)});
  rig.beginDrag();
  for (let i = 0; i < 200; i++) rig.drag(-80, -60, rad(50), 900);  // ~16000 px to the right and up-left
  assert.ok(deg(rig.yaw) <= 35 + 0.07 * 70 + 1e-6, `stretched yaw ${deg(rig.yaw)}°`);   // at most 7% of the 70° range past the limit
  assert.ok(deg(rig.pitch) >= -8 - 0.07 * 23 - 1e-6, `stretched pitch ${deg(rig.pitch)}°`);
  rig.endDrag(0, 0, rad(50), 900); settle(rig, 2);
  assert.equal(rig.yaw, rad(35)); assert.equal(rig.pitch, rad(-8));
  // The opposite side.
  rig.beginDrag(); for (let i = 0; i < 200; i++) rig.drag(80, 60, rad(50), 900); rig.endDrag(0, 0, rad(50), 900); settle(rig, 2);
  assert.equal(rig.yaw, rad(-35)); assert.equal(rig.pitch, rad(15));
}

// 3) Inertia is short, capped, and can never carry the view past a limit once it settles.
{
  const rig = new LookRig({yaw: rad(35)});
  rig.beginDrag(); rig.drag(-50, 0, rad(50), 900); rig.endDrag(-6000, 0, rad(50), 900); // an aggressive fling to the right
  assert.ok(Math.abs(rig.vYaw) <= 1.5 + 1e-9, 'speed cap');
  const before = rig.yaw; settle(rig, 3);
  assert.ok(rig.yaw - before < rad(35) && rig.yaw <= rad(35) + 1e-9);
  assert.ok(Math.abs(rig.vYaw) < 1e-3, 'inertia has faded out');
  // A gentle release barely coasts (< 2°).
  const soft = new LookRig(); soft.beginDrag(); soft.drag(-20, 0, rad(50), 900); const s0 = soft.yaw; soft.endDrag(-20, 0, rad(50), 900); settle(soft, 2);
  assert.ok(deg(soft.yaw - s0) < 2, `soft coast ${deg(soft.yaw - s0)}°`);
}

// 4) Buttons and keys glide by the requested angle and stop.
{
  const rig = new LookRig({yaw: rad(60)});
  rig.nudge(rad(10)); settle(rig, 2);
  assert.ok(Math.abs(deg(rig.yaw) - 10) < 0.2, `nudge ${deg(rig.yaw)}°`);
  rig.reset(); settle(rig, 3); assert.equal(rig.yaw, 0); assert.equal(rig.pitch, 0); assert.ok(rig.idle);
}

// 5) Zoom stays in range, whatever the pinch does.
{
  const rig = new LookRig({zoomMin: 0.86, zoomMax: 1.4});
  for (let i = 0; i < 100; i++) rig.zoomBy(1.2); settle(rig, 2); assert.ok(rig.zoom <= 1.4 + 1e-6, `zoom in ${rig.zoom}`);
  for (let i = 0; i < 100; i++) rig.zoomBy(0.8); settle(rig, 2); assert.ok(rig.zoom >= 0.86 - 1e-6, `zoom out ${rig.zoom}`);
}

// 6) Gestures: taps pick, drags never pick, a second finger pinches and ends the drag without inertia.
{
  let t = 0; const log = [];
  const g = new StudioGesture({now: () => t, look: (dx, dy) => log.push(['look', dx, dy]), zoom: r => log.push(['zoom', r]), pick: (x, y) => log.push(['pick', x, y]),
    start: () => log.push(['start']), end: (vx, vy) => log.push(['end', Math.round(vx), Math.round(vy)])});
  // Tap (touch) within the slop → pick only.
  g.down(1, 100, 100, 'touch'); g.move(1, 104, 103); g.up(1, 104, 103);
  assert.deepEqual(log.map(l => l[0]), ['pick']); log.length = 0;
  // Drag → start, look (carrying the full travelled distance), end; never pick.
  g.down(1, 100, 100, 'touch'); t = 10; g.move(1, 130, 100); t = 30; g.move(1, 160, 100); t = 50; g.move(1, 190, 100); t = 60; g.up(1, 190, 100);
  assert.ok(!log.some(l => l[0] === 'pick'));
  assert.equal(log[0][0], 'start');
  const travelled = log.filter(l => l[0] === 'look').reduce((a, l) => a + l[1], 0);
  assert.equal(travelled, 90, 'no distance lost to the tap slop');
  const end = log.at(-1); assert.equal(end[0], 'end'); assert.ok(end[1] > 1000, `fling ${end[1]} px/s`); log.length = 0;
  // A finger that rests before lifting does not fling.
  g.down(1, 100, 100, 'touch'); t = 10; g.move(1, 150, 100); t = 400; g.up(1, 150, 100);
  assert.deepEqual(log.at(-1), ['end', 0, 0]); log.length = 0;
  // Pinch: zoom ratio from the two-finger span; the drag ends cleanly first.
  g.down(1, 100, 100, 'touch'); t = 10; g.move(1, 130, 100); g.down(2, 200, 100, 'touch'); g.move(2, 300, 100); g.up(2, 300, 100); g.up(1, 130, 100);
  assert.ok(log.some(l => l[0] === 'zoom' && l[1] > 1)); assert.ok(!log.some(l => l[0] === 'pick')); log.length = 0;
  // The finger left after a pinch continues from where it is now: 4 px of movement is 4 px of look, not the distance since it landed.
  g.down(1, 50, 300, 'touch'); g.down(2, 300, 300, 'touch'); g.move(2, 340, 300); g.move(1, 30, 300); g.up(2, 340, 300); g.move(1, 34, 300);
  assert.deepEqual(log.filter(l => l[0] === 'look'), [['look', 4, 0]]);
}

console.log('PASS: exact 1:1 drag on phone and desktop, hard limits with elastic return, capped inertia, glide buttons, bounded zoom, tap/drag/pinch separation.');
