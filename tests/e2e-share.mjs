// Gift link: the buyer copies a read-only link from the song corner; whoever opens it only gets that song.
import fs from 'node:fs';
import {launch, open, runner, sleep, SIZES, BASE_URL} from './e2e-lib.mjs';
const mode = process.argv[2] || 'desktop';
const seed = JSON.parse(fs.readFileSync('/tmp/s4.json', 'utf8'));          // personalizada · review · with delivery files
const browser = await launch(), r = runner(`share ${mode}`);
const t = await open(browser, mode, 'e2e' + seed.link.replace('/?', '&'));
await t.ctx.grantPermissions(['clipboard-read', 'clipboard-write'], {origin: BASE_URL});
await t.F(() => window.__fhb.studio.advance(4)); await sleep(500);
const info = () => t.F(() => ({view: window.__fhb.view(), ref: window.__fhb.order()?.reference, shared: !!window.__fhb.order()?.shared, focus: window.__fhb.focus()}));
let url = '';
await r.step('the buyer opens the review session from the crate', async () => {
  await t.F(ref => window.__fhb.onAction({type: 'order', ref}), seed.ref); await sleep(800); await t.settle(3);
  const v = await info(); if (v.view !== 'session' || v.ref !== seed.ref) throw new Error(JSON.stringify(v));
});
await r.step('«Compartir» is there and yields a read-only link', async () => {
  const v = await info(); if (v.ref !== seed.ref) throw new Error('wrong session ' + JSON.stringify(v));
  await t.page.click('.j-tab[data-focus="session-song"]'); await t.settle(3);
  await t.tap('session:share'); await sleep(600);
  url = await t.page.evaluate(() => navigator.clipboard.readText()); if (!/share=1#token=/.test(url)) throw new Error('clipboard: ' + url);
});
await t.shot('share-owner');
await t.ctx.close();
const g = await open(browser, mode, 'e2e' + url.replace(/^.*?\/\?/, '&'));
await g.page.waitForFunction(() => window.__fhb.view() === 'session', null, {timeout: 20000}); await g.settle(4);
const gi = () => g.F(() => ({view: window.__fhb.view(), shared: !!window.__fhb.order()?.shared, focus: window.__fhb.focus(), keys: [...document.querySelectorAll('#stage-keys button')].map(b => b.textContent)}));
await r.step('the gift opens the song directly, as a gift', async () => { const v = await gi(); if (v.view !== 'session' || !v.shared || v.focus !== 'session-song') throw new Error(JSON.stringify(v)); });
await r.step('the link did not leak into the address bar', async () => { if (/token=/.test(g.page.url())) throw new Error(g.page.url()); });
await r.step('no talk, files, pay or share for the guest', async () => {
  await sleep(500); const v = await gi(); const bad = v.keys.filter(k => /productor|material|pago|Compartir|Subir/i.test(k)); if (bad.length) throw new Error(bad.join(' | '));
  if (await g.page.locator('.j-steps').count()) throw new Error('journey steps shown');
});
await r.step('the guest can play the song', async () => {
  await g.tap('session:vinyl'); await sleep(1500); const playing = await g.F(() => [...document.querySelectorAll('audio')].some(a => !a.paused || a.currentTime > 0)); if (!playing) throw new Error('not playing');
});
await g.shot('share-guest');
await r.step('the guest has no other songs: «Mi sesión» is the mail door', async () => { await g.F(() => window.__fhb.go('recover')); await g.settle(2); const n = await g.F(() => window.__fhb.studio.stations.session.orders.length); if (n) throw new Error('orders ' + n); });
await r.step('the plain-text gift page shows the song and no private data', async () => {
  await g.F(() => window.__fhb.go('session')); await g.settle(2); await g.page.click('.j-plain'); await sleep(600);
  const txt = await g.page.locator('#options-dialog').innerText(); if (!/Para /.test(txt)) throw new Error('no recipient'); if (/ana@example|3001234567|\$|COP|Escríbele a tu productor/i.test(txt)) throw new Error('private text: ' + txt.slice(0, 200));
  if (!await g.page.locator('#options-dialog audio').count()) throw new Error('no audio element');
});
await g.shot('share-guest-text');
r.finish({errors: [...t.log.errors, ...g.log.errors]});
