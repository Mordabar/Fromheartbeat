// «Mis canciones»: opening any private link opens the crate of the same email; each disc opens its session.
// Needs the PHP+SQLite harness (tests/support/serve.sh) seeded with several orders of one email: see tests/support/seed-library.sh
import fs from 'node:fs';
import {launch, open, runner, sleep, BASE_URL} from './e2e-lib.mjs';
const mode = process.argv[2] || 'desktop';
const seeds = ['/tmp/s1.json', '/tmp/s2.json', '/tmp/s3.json', '/tmp/s4.json'].map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
const browser = await launch(), r = runner(`library ${mode}`);
const t = await open(browser, mode, 'e2e' + seeds[1].link.replace('/?', '&'));
await t.F(() => window.__fhb.studio.advance(4)); await sleep(500);
const st = () => t.F(() => { const s = window.__fhb.studio.stations.session; return {view: window.__fhb.view(), focusShown: s.records.some(x => x.order && x.order.reference === s.focus), shown: s.records.filter(x => x.order).length, orders: s.orders.length, page: s.page, focus: s.focus}; });
await r.step('the link opens the crate with every song of the email', async () => { const s = await st(); if (s.view !== 'library' || s.orders < 4 || s.shown < 1 || !s.focusShown) throw new Error(JSON.stringify(s)); });
await r.step('the URL does not keep the token', async () => { if (/token=/.test(t.page.url())) throw new Error(t.page.url()); });
await t.settle(3); await t.shot('library');
await r.step('more than six songs page: the crate shows six, «Siguientes» shows the rest', async () => {
  let s = await st(); if (s.orders < 7) throw new Error('seed has ' + s.orders);
  if (s.page) { await t.tap('lib-prev'); await t.settle(2); s = await st(); }
  if (s.shown !== 6) throw new Error('page 1 shows ' + s.shown);
  await t.tap('lib-next'); await t.settle(2); s = await st(); if (s.page !== 1 || s.shown !== s.orders - 6) throw new Error(JSON.stringify(s));
  await t.shot('library-page2'); await t.tap('lib-prev'); await t.settle(2); s = await st(); if (s.page !== 0) throw new Error(JSON.stringify(s));
});
await r.step('tapping a disc opens its session', async () => {
  await t.tap('lib:0'); await t.settle(3);
  const v = await t.F(() => ({view: window.__fhb.view(), ref: window.__fhb.order()?.reference})); if (v.view !== 'session' || !v.ref) throw new Error(JSON.stringify(v));
});
await t.shot('library-opened');
await r.step('back from the session returns to the crate', async () => {
  await t.page.click('.j-back'); await t.settle(3); const s = await st(); if (s.view !== 'library') throw new Error(JSON.stringify(s));
});
await r.step('«Pedir otra canción» starts the flow', async () => { await t.page.click('.j-next'); await t.settle(2); const v = await t.state(); if (v.view === 'library') throw new Error(v.view); });
await r.step('the header «Mi sesión» opens the crate again', async () => { await t.F(() => window.__fhb.go('lobby')); await t.settle(2); if (t.mobile) { await t.page.click('#menu-toggle'); await t.page.click('#studio-menu [data-go="recover"]'); } else await t.page.click('.hud-link[data-go="recover"]'); await t.settle(3); await sleep(600); const s = await st(); if (s.view !== 'library') throw new Error(JSON.stringify(s)); });
await r.step('the plain-text version lists the same songs and has the mail form', async () => {
  await t.page.click('.j-plain'); await sleep(500); const n = await t.page.locator('.my-order').count(); if (n < 7) throw new Error('rows ' + n); if (!await t.page.locator('#recover-form').count()) throw new Error('no mail form');
});
await t.shot('library-plain');
// a browser that never opened a link
await t.ctx.close();
const t2 = await open(browser, mode, 'e2e'); await t2.F(() => window.__fhb.go('recover')); await t2.settle(3);
await r.step('a stranger sees the empty room and the mail door, not the crate', async () => { const v = await t2.F(() => ({view: window.__fhb.view(), n: window.__fhb.studio.stations.session.orders.length})); if (v.view !== 'recover' || v.n) throw new Error(JSON.stringify(v)); if (!await t2.page.locator('#recover-form').count()) throw new Error('no mail form'); });
await t2.shot('library-empty');
r.finish(t.log);
