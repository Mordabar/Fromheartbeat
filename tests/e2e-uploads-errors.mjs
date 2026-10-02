// Errores y desconexión del cargador: fila de error legible en móvil, sin conexión, resumen final y foco.
//   BASE_URL=http://127.0.0.1:8199 node tests/e2e-uploads-errors.mjs
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import {OUT, sleep} from './e2e-lib.mjs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8199', M = (process.env.FHB_WORK || '/tmp/fhb-harness') + '/media/';
const seed = JSON.parse(execFileSync('python3', [new URL('./support/seed.py', import.meta.url).pathname, 'full', 'in_production']).toString());
const b = await chromium.launch({headless: true, args: ['--no-sandbox']}), ctx = await b.newContext({viewport: {width: 360, height: 640}, hasTouch: true, isMobile: true}), page = await ctx.newPage();
let ok = 0, bad = 0; const t = (n, c, x = '') => { if (c) { ok++; console.log('  ok  ', n); } else { bad++; console.log('  FAIL', n, x); } };
await page.goto(BASE + seed.link); await page.waitForSelector('[data-u-pick]', {state: 'attached', timeout: 60000});
await page.setInputFiles('[data-u-pick]', [M + 'falso-nombre-muy-largo-de-prueba.jpg']);
await page.waitForSelector('.u-row.st-error', {timeout: 20000}); await page.locator('.u-row.st-error').scrollIntoViewIfNeeded(); await sleep(300);
await page.screenshot({path: `${OUT}/err-360-formato.png`});
const row = await page.$eval('.u-row.st-error', e => ({h: e.getBoundingClientRect().height, text: e.innerText, retry: !!e.querySelector('[data-u-retry]'), quit: !!e.querySelector('[data-u-dismiss]')}));
t('el mensaje de error se lee completo', /formato/i.test(row.text), row.text);
t('la fila no es gigante (≤ 190 px)', row.h <= 190, row.h);
t('un error de formato no ofrece «Reintentar» pero sí «Quitar»', !row.retry && row.quit);
await page.click('[data-u-dismiss]');
// el resumen con ahorro (video grande, en línea)
await page.setInputFiles('[data-u-pick]', [M + 'big.webm']);
const live = await page.waitForFunction(() => /^Listo: 1 archivo.*ahorraste/.test(document.querySelector('[data-u-live]')?.textContent || '') && document.querySelector('[data-u-live]').textContent, null, {timeout: 150000}).then(h => h.jsonValue()).catch(() => '');
t('el resumen final se queda visible', /^Listo: 1 archivo/.test(live), live);
t('menciona el ahorro de datos', /ahorraste/.test(live), live);
await sleep(1500); await page.screenshot({path: `${OUT}/err-360-final.png`});
t('el resumen sigue ahí 1.5 s después', /^Listo/.test(await page.$eval('[data-u-live]', e => e.textContent)));
// sin conexión durante el envío (fragmentos lentos para poder cortar)
let release; const gate = new Promise(r => release = r);
await page.route(/action=upload-chunk/, async r => { await gate; r.continue().catch(() => {}); });
await page.setInputFiles('[data-u-pick]', [M + 'foto-pesada.jpg']);
await page.waitForSelector('.u-row.st-uploading', {timeout: 60000});
await ctx.setOffline(true); await sleep(1200);
const off = await page.$$eval('.u-row [data-u-label]', e => e.map(x => x.textContent).join(' / ')).catch(() => '');
await page.screenshot({path: `${OUT}/err-360-offline.png`});
t('sin conexión se avisa en español', /conexi|Reconect/i.test(off), off);
await ctx.setOffline(false); release(); await page.unroute(/action=upload-chunk/);
await page.waitForFunction(() => document.querySelector('[data-u-live]')?.textContent.startsWith('Listo'), null, {timeout: 90000}).catch(() => {});
t('al volver la conexión termina solo', await page.waitForFunction(() => document.querySelectorAll('[data-u-sent] .u-row').length >= 2, null, {timeout: 60000}).then(() => true).catch(() => false));
await b.close(); console.log(`\n${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
