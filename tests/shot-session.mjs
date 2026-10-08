// Screenshots of the four corners of the session room for a seeded review order (/tmp/s4.json).
import fs from 'node:fs';
import {launch, open, sleep} from './e2e-lib.mjs';
const mode = process.argv[2] || 'desktop', tag = process.argv[3] || 'x';
const seed = JSON.parse(fs.readFileSync(process.argv[4] || '/tmp/s4.json', 'utf8'));
const b = await launch(), t = await open(b, mode, 'e2e' + seed.link.replace('/?', '&'));
await t.page.waitForFunction(() => ['library', 'session'].includes(window.__fhb.view()), null, {timeout: 30000});
if ((await t.F(() => window.__fhb.view())) === 'library') await t.F(ref => window.__fhb.onAction({type: 'order', ref}), seed.ref);
await t.page.waitForFunction(() => window.__fhb.view() === 'session', null, {timeout: 30000}); await t.settle(4);
for (const v of ['session', 'session-song', 'session-talk', 'session-files']) { await t.page.click(`.j-tab[data-focus="${v}"]`); await t.settle(3.5); await t.shot(`${tag}-${v}`); }
await b.close();
