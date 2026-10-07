// El cargador de la sesión del cliente en un Chromium real: varios archivos a la vez, reducción en el dispositivo, progreso y envío por partes.
//   bash tests/support/serve.sh && python3 tests/support/fixtures.py && BASE_URL=http://127.0.0.1:8199 node tests/e2e-uploads.mjs [mobile|desktop]
import {execFileSync} from 'node:child_process';
import {launch, SIZES, OUT, sleep} from './e2e-lib.mjs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8199', M = (process.env.FHB_WORK || '/tmp/fhb-harness') + '/media/';
const mode = process.argv[2] || 'mobile', [width, height, mobile] = SIZES[mode];
const seed = JSON.parse(execFileSync('python3', [new URL('./support/seed.py', import.meta.url).pathname, 'full', 'in_production']).toString());
const b = await launch(), ctx = await b.newContext({viewport: {width, height}, hasTouch: mobile, isMobile: mobile}), page = await ctx.newPage();
const errors = [], reqs = []; let ok = 0, bad = 0;
page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/ERR_TUNNEL_CONNECTION_FAILED|ERR_INTERNET_DISCONNECTED/.test(m.text())) errors.push(m.text()); });
page.on('request', r => { const m = r.url().match(/action=(upload-[a-z]+|file-delete)/); if (m) reqs.push(m[1]); });
const t = (name, cond, extra = '') => { if (cond) { ok++; console.log('  ok  ', name); } else { bad++; console.log('  FAIL', name, extra); } };
await page.goto(BASE + seed.link.replace('?session=', '?e2e&session='), {waitUntil: 'load'});
await page.waitForFunction(() => window.__fhb?.view?.() === 'session', null, {timeout: 60000});
await page.evaluate(() => { window.__fhb.onAction({type: 'session-files'}); window.__fhb.onAction({type: 'session-files'}); });   // the material pad of the 3D room: first touch brings the camera, second opens the uploader
await page.waitForSelector('[data-u-pick]', {state: 'attached', timeout: 30000});
await page.screenshot({path: `${OUT}/up-${mode}-1-vacio.png`});
t('el cargador aparece con selector múltiple', await page.$eval('[data-u-pick]', i => i.multiple));
const files = ['foto-pesada.jpg', 'captura.png', 'voz.wav', 'big.webm', 'letra.pdf'].map(f => M + f);
await page.setInputFiles('[data-u-pick]', files);
await page.waitForSelector('.u-row.st-uploading, .u-row.st-preparing', {timeout: 20000});
await page.screenshot({path: `${OUT}/up-${mode}-2-progreso.png`});
await page.waitForFunction(n => document.querySelectorAll('.u-row.st-done').length >= n || document.querySelectorAll('.u-row.st-error').length, files.length, {timeout: 180000});
t('ningún archivo falló', await page.$$eval('.u-row.st-error', e => e.length) === 0, await page.$$eval('.u-row.st-error', e => e.map(x => x.textContent).join('|')));
await sleep(2500); // upload-done + recarga de la sesión
await page.screenshot({path: `${OUT}/up-${mode}-3-listo.png`});
const order = await page.evaluate(async ref => (await (await fetch('api.php?action=order&reference=' + ref)).json()).order, seed.ref);
const sent = order.files.filter(f => f.kind === 'source');
t('los 5 archivos llegaron al estudio', sent.length === 5, JSON.stringify(sent.map(f => [f.original_name, f.mime, f.size_bytes])));
const by = n => sent.find(f => f.original_name.startsWith(n));
const kb = n => Math.round(Number(by(n)?.size_bytes) / 1024);
t('la foto pesada se redujo y salió como WebP/JPEG', by('foto-pesada') && /webp|jpeg/.test(by('foto-pesada').mime) && Number(by('foto-pesada').size_bytes) < 0.6 * (await (await import('node:fs')).promises.stat(M + 'foto-pesada.jpg')).size, kb('foto-pesada') + ' KB');
t('el WAV de 3 MB+ se convirtió a MP3', by('voz')?.mime === 'audio/mpeg', JSON.stringify(by('voz')));
t('el video grande se re-codificó a MP4 más liviano', by('big')?.mime === 'video/mp4' && Number(by('big').size_bytes) < 0.85 * (await (await import('node:fs')).promises.stat(M + 'big.webm')).size, JSON.stringify(by('big')));
t('el PDF pasó sin tocar', by('letra')?.mime === 'application/pdf');
t('se usó upload-init/chunk/finish/done', ['upload-init', 'upload-chunk', 'upload-finish', 'upload-done'].every(a => reqs.includes(a)), [...new Set(reqs)].join());
t('la lista muestra lo enviado', await page.$$eval('[data-u-sent] .u-row', e => e.length) === 5);
t('el contador del título se actualiza', /5 enviados/.test(await page.$eval('[data-u-count]', e => e.textContent)));
await page.setInputFiles('[data-u-pick]', [M + 'voz.wav']);
t('sin errores de consola ni de CSP', errors.filter(e => !/WebGL|swiftshader|GPU/i.test(e)).length === 0, errors.slice(0, 3).join(' | '));
await b.close(); console.log(`\n${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
