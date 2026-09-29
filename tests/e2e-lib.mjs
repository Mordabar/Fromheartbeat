// Shared helpers for the browser tests. They drive the real site in Chromium and touch 3D objects like a finger would.
//   BASE_URL   where the site is served         (default http://127.0.0.1:8090)
//   CHROME     path to a Chrome/Chromium binary  (default: Playwright's own)
//   HEADED=1   show the browser
//   OUT        folder for screenshots            (default ./shots)
import fs from 'node:fs';
import {chromium} from 'playwright';

export const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:8090';
export const OUT = process.env.OUT || new URL('./shots', import.meta.url).pathname;
export const sleep = ms => new Promise(r => setTimeout(r, ms));
fs.mkdirSync(OUT, {recursive: true});

export const launch = () => chromium.launch({
  headless: !process.env.HEADED,
  executablePath: process.env.CHROME || undefined,
  // Software WebGL so the tests also run on machines without a GPU (CI).
  args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

export const SIZES = {mobile: [390, 844, true], desktop: [1440, 900, false], small: [360, 640, true], tablet: [768, 1024, true]};

export async function open(browser, mode = 'mobile', query = 'e2e') {
  const [width, height, mobile] = SIZES[mode];
  const ctx = await browser.newContext({viewport: {width, height}, deviceScaleFactor: 1, hasTouch: mobile, isMobile: mobile});
  const page = await ctx.newPage();
  const log = {errors: [], failed: []};
  page.on('pageerror', e => log.errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') log.errors.push(m.text()); });
  page.on('response', r => { if (r.status() >= 400) log.failed.push(r.status() + ' ' + r.url()); });
  await page.goto(`${BASE_URL}/?${query}`, {waitUntil: 'load'});
  await page.waitForFunction(() => window.__fhb?.studio?.renderer, null, {timeout: 40000});
  const t = {page, ctx, log, mobile, width, height, mode};
  t.F = (fn, ...a) => page.evaluate(fn, ...a);
  // Fast-forward the simulation (camera travel, fades) without waiting for the software renderer's real frame rate.
  t.settle = async (s = 3) => { await t.F(x => window.__fhb.studio.advance(x), s); await sleep(250); };
  t.shot = async name => { await t.settle(0.3); await page.screenshot({path: `${OUT}/${mode}-${name}.png`}); };
  // Tap a 3D object by id: project it to the screen and touch (mobile) or click (desktop) exactly there.
  t.tap = async id => {
    const p = await t.F(id => { const r = window.__fhb.studio.screenOf(id); return r && {x: r.x, y: r.y, ok: r.visible && r.front && r.x > 0 && r.x < innerWidth && r.y > 0 && r.y < innerHeight}; }, id);
    if (!p) throw new Error(`no such object: ${id}`);
    if (!p.ok) throw new Error(`object ${id} is not on screen (${Math.round(p.x)}, ${Math.round(p.y)})`);
    if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y);
    await sleep(150);
  };
  t.state = () => t.F(() => ({view: window.__fhb.view(), draft: window.__fhb.draft()}));
  return t;
}

export function runner(title) {
  const results = [];
  return {
    async step(name, fn) { try { await fn(); results.push([true, name]); console.log('ok  ', name); } catch (e) { results.push([false, name]); console.log('FAIL', name, '-', e.message.split('\n')[0]); } },
    finish(log) {
      const bad = results.filter(r => !r[0]).length;
      if (log?.errors.length) console.log('console errors:', log.errors.slice(0, 5));
      console.log(`${title}: ${results.length - bad}/${results.length} passed` + (log?.errors.length ? `, ${log.errors.length} console errors` : ''));
      process.exit(bad || log?.errors.length ? 1 : 0);
    },
  };
}
