import {launch, open, sleep} from './e2e-lib.mjs';
const mode = process.argv[2] || 'mobile', tag = process.argv[3] || 'w';
const b = await launch(), t = await open(b, mode, 'e2e');
for (const step of ['genre', 'mood', 'voice', 'story', 'products', 'checkout']) {
  await t.F(s => window.__fhb.go(s), step); await t.settle(3);
  if (step !== 'checkout' || !t.mobile) {}
  await t.page.click('.j-plain').catch(() => {}); await sleep(700);
  await t.page.screenshot({path: `${process.env.OUT || '/tmp/ds'}/${mode}-${tag}-${step}.png`});
  await t.page.click('#close-options').catch(() => {}); await sleep(300);
}
await b.close();
