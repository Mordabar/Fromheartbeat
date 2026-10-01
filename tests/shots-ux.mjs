// Screenshots of the end of the journey (checkout, session) and the admin, for design review.
//   OUT=/path node shots-ux.mjs [mobile|desktop]
import {launch, open, sleep, BASE_URL, SIZES, OUT} from './e2e-lib.mjs';
import {order, mockCustomerApi, mockAdminApi} from './fixtures.mjs';
const mode = process.argv[2] || 'mobile';
const b = await launch();
const states = ['payment_pending', 'in_production', 'review', 'completed'];
for (const status of states) {
  const t = await open(b, mode), {page, F} = t; const st = await mockCustomerApi(page, order(status));
  await F(() => window.__fhb.go('recover')); await sleep(300); await F(() => document.querySelector('.my-order')?.click()); await t.settle(3.5); await sleep(600);
  await page.screenshot({path: `${OUT}/${mode}-session-${status}.png`});
  if (process.argv[3] === 'scroll') for (const [i, y] of [[2, 560], [3, 1120], [4, 1680]]) { await F(y => { const b = document.querySelector('#options-dialog .panel-body'); b.scrollTop = y; }, y); await sleep(250); await page.screenshot({path: `${OUT}/${mode}-session-${status}-${i}.png`}); }
  const dr = await F(() => { const d = document.querySelector('#options-dialog .panel-body'); return d ? d.scrollHeight : 0; });
  console.log(status, 'body height', dr);
  await t.ctx.close();
}
{ const t = await open(b, mode), {page, F} = t; await mockCustomerApi(page, order('created'));
  await F(() => Object.assign(window.__fhb.draft(), {genre: 'Bachata', mood: 'Romántica', voice: 'Femenina', recipient: 'Luna', occasion: 'Aniversario', story: 'Nos conocimos en un viaje a la playa en 2016.', product: 'full'}));
  await F(() => window.__fhb.go('checkout')); await t.settle(3.5); await sleep(500); await page.screenshot({path: `${OUT}/${mode}-checkout.png`});
  for (const [i, y] of [[2, 520], [3, 1040]]) { await F(y => { document.querySelector('#options-dialog .panel-body').scrollTop = y; }, y); await sleep(250); await page.screenshot({path: `${OUT}/${mode}-checkout-${i}.png`}); }
  await t.ctx.close(); }
{ const [w, h, m] = SIZES[mode]; const ctx = await b.newContext({viewport: {width: w, height: h}, hasTouch: m, isMobile: m}); const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e))); page.on('console', x => { if (x.type() === 'error') errs.push(x.text()); });
  await mockAdminApi(page); await page.goto(`${BASE_URL}/admin.html`); await sleep(1200); await page.screenshot({path: `${OUT}/${mode}-admin-list.png`, fullPage: false});
  await page.click('[data-order="FHB-7K2Q9"]'); await sleep(800); await page.screenshot({path: `${OUT}/${mode}-admin-detail.png`, fullPage: true});
  console.log('admin errors', errs); await ctx.close(); }
await b.close();
