// The camera: exact 1:1 drag, hard limits, taps pick / drags never do, keys, pinch and wheel.
//   node e2e-camera.mjs [mobile|desktop]
import {launch, open, runner, sleep} from './e2e-lib.mjs';

const mode = process.argv[2] || 'mobile';
const b = await launch(), t = await open(b, mode), {F, page, ctx, width: W, height: H, mobile} = t, {step, finish} = runner(`camera (${mode})`);
const expect = (c, m) => { if (!c) throw new Error(m); };
const rig = () => F(() => { const r = window.__fhb.studio.rig; return {yaw: r.yaw * 180 / Math.PI, pitch: r.pitch * 180 / Math.PI, zoom: r.zoom, limit: r.cfg.yaw * 180 / Math.PI, vfov: window.__fhb.studio.camera.fov}; });

await F(() => window.__fhb.go('genre')); await t.settle(4);
const y0 = mobile ? 250 : 120, cx = W / 2;

// Real pointer input: CDP touch events on phones (so pointerType is "touch"), the mouse on desktop.
async function drag(dx, x0 = cx, y = y0, steps = 12) {
  if (mobile) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: x0, y, id: 1}]});
    for (let i = 1; i <= steps; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: x0 + dx * i / steps, y, id: 1}]}); await sleep(16); }
    await sleep(120); await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  } else {
    await page.mouse.move(x0, y); await page.mouse.down();
    for (let i = 1; i <= steps; i++) { await page.mouse.move(x0 + dx * i / steps, y); await sleep(16); }
    await sleep(120); await page.mouse.up();
  }
}

await step('a 60px drag turns exactly px x vfov / height', async () => {
  await drag(-60, cx, y0, 8); await t.settle(2);
  const r = await rig(), want = 60 * r.vfov / H;
  expect(Math.abs(r.yaw - want) < want * 0.12 + 0.05, `yaw ${r.yaw.toFixed(2)}° vs ${want.toFixed(2)}°`); expect(Math.abs(r.yaw) < 8, 'it spun');
});
await step('a huge drag stops at the limit (elastic <= 7% of the range)', async () => {
  for (let k = 0; k < 6; k++) await drag(-(W - 40), W - 20);
  const r = await rig(); expect(Math.abs(r.yaw) <= r.limit * 1.14 + 0.5, `yaw ${r.yaw.toFixed(1)}°`);
  await t.settle(2); expect(Math.abs((await rig()).yaw) <= r.limit + 0.05, 'did not settle inside the limit');
});
await step('dragging across a pad never selects it', async () => {
  await F(() => window.__fhb.studio.resetView()); await t.settle(2);
  const p = await F(() => { const r = window.__fhb.studio.screenOf('genre:Reggaetón'); return {x: r.x, y: r.y}; });
  await drag(70, p.x - 35, p.y, 8); expect((await t.state()).draft.genre === '', 'a drag selected a pad');
});
await step('a tap selects the pad', async () => { await F(() => window.__fhb.studio.resetView()); await t.settle(2); await t.tap('genre:Reggaetón'); expect((await t.state()).draft.genre === 'Reggaetón', 'tap did not select'); });
await step('arrow keys glide 5 degrees; Home recentres', async () => {
  await F(() => window.__fhb.studio.resetView()); await t.settle(2);
  await page.keyboard.press('ArrowRight'); await t.settle(1.2); expect(Math.abs((await rig()).yaw - 5) < 0.6, 'arrow');
  await page.keyboard.press('Home'); await t.settle(3); expect(Math.abs((await rig()).yaw) < 0.05, 'home');
});
await step('pinch / wheel zooms in and is bounded', async () => {
  if (mobile) {
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchStart', touchPoints: [{x: cx - 40, y: 300, id: 1}, {x: cx + 40, y: 300, id: 2}]});
    for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', {type: 'touchMove', touchPoints: [{x: cx - 40 - i * 9, y: 300, id: 1}, {x: cx + 40 + i * 9, y: 300, id: 2}]}); await sleep(16); }
    await cdp.send('Input.dispatchTouchEvent', {type: 'touchEnd', touchPoints: []});
  } else for (let i = 0; i < 40; i++) await page.mouse.wheel(0, -120);
  await t.settle(2); const r = await rig(); expect(r.zoom > 1.05 && r.zoom <= 1.4 + 1e-6, `zoom ${r.zoom}`);
});

await b.close(); finish(t.log);
