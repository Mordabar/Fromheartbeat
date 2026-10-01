// Screenshots every rendered email at desktop (680px pane) and mobile (375px) widths.
//   node tests/email-shots.mjs <emailsDir> <shotsDir> [name1 name2 ...]
// Run `php scripts/preview-emails.php --out=<emailsDir> --base=http://127.0.0.1:8099` first and serve the repo
// root on :8099 (`php -S 127.0.0.1:8099 -t .`) so /assets/email/* images load.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const [dir, shots, ...only] = process.argv.slice(2);
if (!dir || !shots) { console.error('uso: node tests/email-shots.mjs <emailsDir> <shotsDir> [nombres]'); process.exit(1); }
fs.mkdirSync(shots, { recursive: true });
const names = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html').map(f => f.slice(0, -5)).filter(n => !only.length || only.includes(n));
const sizes = { d: { width: 680, height: 900 }, m: { width: 375, height: 800 } };
const browser = await chromium.launch();
const problems = [];
for (const [tag, viewport] of Object.entries(sizes)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: tag === 'm' ? 2 : 1 });
  const page = await ctx.newPage();
  const failed = [];
  // file:// -> http fonts are blocked by CORS in the preview only; real mail clients do not enforce it
  await page.route('**/assets/fonts/*', async route => { const r = await route.fetch(); await route.fulfill({ response: r, headers: { ...r.headers(), 'access-control-allow-origin': '*' } }); });
  page.on('requestfailed', r => failed.push(r.url()));
  page.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url()); });
  for (const n of names) {
    failed.length = 0;
    await page.goto('file://' + path.resolve(dir, n + '.html'), { waitUntil: 'networkidle' });
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (overflow.sw > overflow.cw + 1) problems.push(`${n} [${tag}] desborda horizontalmente: ${overflow.sw}px > ${overflow.cw}px`);
    if (failed.length) problems.push(`${n} [${tag}] recursos que fallan: ${[...new Set(failed)].join(', ')}`);
    await page.screenshot({ path: path.join(shots, `${n}-${tag}.png`), fullPage: true });
  }
  await ctx.close();
}
await browser.close();
console.log(`${names.length * 2} capturas en ${shots}`);
if (problems.length) { console.log('PROBLEMAS:\n - ' + problems.join('\n - ')); process.exitCode = 2; }
