// Capturas del estudio 3D en cada paso del recorrido, a varios tamaños.  BASE_URL=http://127.0.0.1:8199 node tests/shot-3d.mjs [paso...]
import {chromium} from 'playwright';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {OUT, sleep} from './e2e-lib.mjs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8199', sizes = {desk: [1157, 799, false], full: [1440, 900, false], mob: [390, 844, true]};
const only = process.argv.slice(2), want = n => !only.length || only.includes(n);
const b = await chromium.launch({headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox']});
for (const [name, [width, height, mobile]] of Object.entries(sizes)) {
  const ctx = await b.newContext({viewport: {width, height}, hasTouch: mobile, isMobile: mobile}), page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.goto(BASE + '/?e2e', {waitUntil: 'load'});
  await page.waitForFunction(() => window.__fhb?.studio?.renderer, null, {timeout: 60000});
  const F = (fn, ...a) => page.evaluate(fn, ...a), settle = async (s = 3) => { await F(x => window.__fhb.studio.advance(x), s); await sleep(200); };
  const tap = async id => { const p = await F(id => { const r = window.__fhb.studio.screenOf(id); return r && {x: r.x, y: r.y}; }, id); if (!p) throw new Error('no object ' + id); if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await sleep(150); };
  const shot = async n => { await settle(0.3); await page.screenshot({path: `${OUT}/3d-${name}-${n}.png`}); };
  if (want('genre')) { await tap('rec'); await settle(3.5); await shot('genre'); }
  if (want('products')) { await F(() => { const h = window.__fhb; h.draft().genre = 'Salsa'; h.go('products'); }); await settle(3.5); await shot('products'); }
  if (want('checkout')) { await F(() => { const h = window.__fhb, d = h.draft(); Object.assign(d, {genre: 'Pop latino', mood: 'Épica', voice: 'Masculina', language: 'Español', tempo: 'Medio', recipient: 'Luz Marina', occasion: 'Cumpleaños', story: 'x'.repeat(40), product: 'full', name: 'Ervin Grey', email: 'a@b.co', phone: '3001234567'}); h.studio.setDraft(d); h.go('checkout'); }); await settle(3.5); await shot('checkout'); }
  if (want('session')) {
    const seed = JSON.parse(execFileSync('python3', [new URL('./support/seed.py', import.meta.url).pathname, 'full', process.env.STATE || 'review', 'rich']).toString());
    await page.close(); const page2 = await ctx.newPage(); page2.on('pageerror', e => errs.push(String(e)));
    await page2.goto(BASE + seed.link.replace('?session=', '?e2e&session='), {waitUntil: 'domcontentloaded'});
    await page2.waitForFunction(() => window.__fhb?.view?.() === 'session', null, {timeout: 60000});
    const G = (fn, ...a) => page2.evaluate(fn, ...a), adv = async (x = 3) => { await G(x => window.__fhb.studio.advance(x), x); await sleep(250); };
    await adv(4); await page2.screenshot({path: `${OUT}/3d-${name}-session-1-overview.png`});
    for (const v of ['session-song', 'session-talk', 'session-files']) { await G(v => { window.__fhb.studio.moveTo(v); }, v); await adv(3.5); await page2.screenshot({path: `${OUT}/3d-${name}-${v}.png`}); }
  }
  if (errs.length) console.log(name, 'errores:', errs.slice(0, 3));
  await ctx.close();
}
await b.close(); console.log('listo ->', OUT);
