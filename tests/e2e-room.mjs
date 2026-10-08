// La sala de sesión en 3D, con un Chromium real: el estado, la canción, los mensajes y el material se tocan EN el estudio;
// el pago se abre sobre la misma página; la caja y el botón de las experiencias hacen lo mismo; el ticket se edita tocándolo.
//   bash tests/support/serve.sh (con claves de prueba de Wompi: ver README de pruebas) && BASE_URL=http://127.0.0.1:8199 node tests/e2e-room.mjs [mobile|desktop]
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {chromium} from 'playwright';
import {SIZES, OUT, sleep} from './e2e-lib.mjs';
const BASE = process.env.BASE_URL || 'http://127.0.0.1:8199', W = process.env.FHB_WORK || '/tmp/fhb-harness', M = W + '/media/';
const mode = process.argv[2] || 'desktop', [width, height, mobile] = SIZES[mode];
const seed = (product, status, rich = true) => JSON.parse(execFileSync('python3', [new URL('./support/seed.py', import.meta.url).pathname, product, status, ...(rich ? ['rich'] : [])]).toString());
const b = await chromium.launch({headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required']});
let ok = 0, bad = 0; const t = (n, c, x = '') => { if (c) { ok++; console.log('  ok  ', n); } else { bad++; console.log('  FAIL', n, x); } };
const errors = [];
async function open(path) {
  const ctx = await b.newContext({viewport: {width, height}, hasTouch: mobile, isMobile: mobile}), page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU|ERR_|status of 503/i.test(m.text())) errors.push(m.text()); });
  await page.goto(BASE + path, {waitUntil: 'domcontentloaded'});
  await page.waitForFunction(() => window.__fhb?.studio?.renderer, null, {timeout: 60000});
  const F = (fn, ...a) => page.evaluate(fn, ...a), adv = async (s = 3) => { await F(x => window.__fhb.studio.advance(x), s); await sleep(200); };
  const tap = async id => { const p = await F(id => { const r = window.__fhb.studio.screenOf(id); return r && {x: r.x, y: r.y, ok: r.visible && r.front && r.x > 0 && r.x < innerWidth && r.y > 0 && r.y < innerHeight}; }, id); if (!p) throw new Error('no object ' + id); if (!p.ok) throw new Error(`${id} no está en pantalla (${Math.round(p.x)},${Math.round(p.y)})`); if (mobile) await page.touchscreen.tap(p.x, p.y); else await page.mouse.click(p.x, p.y); await sleep(250); };
  return {ctx, page, F, adv, tap};
}

console.log('== sala de sesión (3D)');
{
  const s = seed('full', 'review'), {ctx, page, F, adv, tap} = await open(s.link.replace('?session=', '?e2e&session='));
  await page.waitForFunction(() => ['library', 'session'].includes(window.__fhb.view()), null, {timeout: 60000}); if (await F(() => window.__fhb.view()) === 'library') await F(ref => window.__fhb.onAction({type: 'order', ref}), s.ref); await page.waitForFunction(() => window.__fhb.view() === 'session', null, {timeout: 60000}); await adv(4);
  t('entra en la sala 3D, sin panel de texto abierto', await F(() => !document.getElementById('options-dialog').open && window.__fhb.studio.stations.cockpit.group.visible));
  t('el recorrido tiene 4 rincones y una acción principal', await page.$$eval('.j-tab', e => e.length) === 4 && (await page.$$eval('.j-tab span', e => e.map(x => x.textContent).join(','))) === 'Estado,Canción,Mensajes,Material' && /Escuchar/.test(await page.$eval('.j-next', e => e.textContent)));
  t('Mensajes y Material tienen botones propios a la vista en la sala', await F(() => ['session:core-talk', 'session:core-files'].every(id => { const r = window.__fhb.studio.screenOf(id); return r && r.visible && r.front && r.x > 0 && r.x < innerWidth && r.y > 0 && r.y < innerHeight; })));
  t('la barra de pestañas avisa de los mensajes sin leer', await page.$('.j-tab[data-focus=session-talk] .j-badge') !== null);
  await tap('stage:2'); await adv(0.3);
  t('tocar una etapa en la consola la explica en el monitor', await F(() => window.__fhb.studio.stations.cockpit.hint === 2));
  // canción
  await page.click('[data-focus=session-song]'); await adv(3.5);
  t('el botón del recorrido lleva la cámara al disco', await F(() => window.__fhb.focus() === 'session-song'));
  await page.screenshot({path: `${OUT}/room-${mode}-song.png`});
  await tap('session:vinyl'); await sleep(900);
  const aud = await F(() => ({src: document.getElementById('sample-audio').src, dock: !document.getElementById('audio-dock').hidden, name: document.getElementById('track-name').textContent}));
  t('tocar el disco prepara la canción de ESTA sesión (MP3) en el reproductor', /action=file&id=\d+$/.test(aud.src) && aud.dock && /^Para /.test(aud.name), JSON.stringify(aud));
  t('la entrega muestra la portada y una tarjeta «Descargar» por archivo', await F(() => { const st = window.__fhb.studio.stations.cockpit; const state = st.board.surface.state; return !!state.cover && state.files.length >= 3 && st.fileHits.filter(h => h.visible).length === 3; }));
  await tap('session:file:0').catch(() => {}); // descargar: navegación de descarga, no debe sacar de la sala
  t('seguimos en la sala tras tocar un archivo', await F(() => window.__fhb.view() === 'session'));
  // mensajes
  await page.click('[data-focus=session-talk]'); await adv(3.5);
  await page.screenshot({path: `${OUT}/room-${mode}-talk.png`});
  t('abrir los mensajes quita el aviso de nuevo', await F(() => !window.__fhb.studio.stations.cockpit.msgs.surface.state.unread));
  await tap('session:talk'); await sleep(500); await page.screenshot({path: `${OUT}/room-${mode}-talkpanel.png`});
  t('«Escribir al productor» abre SOLO la conversación', await F(() => document.getElementById('options-dialog').open && window.__fhb.panel() === 'talk') && await page.$('#feedback-form') !== null && await page.$('#source-form') === null);
  await page.fill('#s-msg', 'Quedó hermosa, gracias por todo.'); await page.click('#feedback-form button.primary'); await sleep(1500);
  t('el mensaje llega al estudio y aparece en la pared 3D', await F(() => window.__fhb.order().history.some(h => /hermosa/.test(h.note)) && window.__fhb.studio.stations.cockpit.msgs.surface.state.list.some(m => /hermosa/.test(m.text))));
  t('enviar no saca de la sala (el panel sigue en la conversación)', await F(() => window.__fhb.view() === 'session' && window.__fhb.panel() === 'talk'));
  await page.click('[data-session-back]'); await sleep(400);
  t('«Volver a la sala» cierra el panel', await F(() => !document.getElementById('options-dialog').open && window.__fhb.panel() === null));
  // material
  await page.click('[data-focus=session-files]'); await adv(3.5);
  await page.screenshot({path: `${OUT}/room-${mode}-files.png`});
  await tap('session:pad'); await sleep(500); await page.screenshot({path: `${OUT}/room-${mode}-filespanel.png`});
  t('tocar el pad abre SOLO el cargador de archivos', await F(() => window.__fhb.panel() === 'files') && await page.$('[data-u-pick]') !== null && await page.$('#feedback-form') === null);
  await page.setInputFiles('[data-u-pick]', [M + 'captura.png']);
  await page.waitForFunction(() => window.__fhb.order().files.filter(f => f.kind === 'source').length >= 3, null, {timeout: 90000}).catch(() => {});
  await sleep(2500);
  t('subir un archivo actualiza el pad 3D', await F(() => window.__fhb.studio.stations.cockpit.pad.surface.state.count >= 3));
  await page.click('[data-session-back]'); await sleep(300);
  // texto plano
  await page.click('[data-focus=session]'); await adv(3);
  await page.click('.j-plain'); await sleep(500);
  t('«Ver en texto» ofrece la sesión completa como alternativa accesible', await F(() => window.__fhb.panel() === 'full') && await page.$('.s-hero') !== null);
  await ctx.close();
}

console.log('== pago sobre la misma página');
{
  const s = seed('personalizada', 'created', false), {ctx, page, F, adv, tap} = await open(s.link.replace('?session=', '?e2e&session='));
  await page.route('https://checkout.wompi.co/widget.js', r => r.fulfill({contentType: 'text/javascript', body: `window.WidgetCheckout=function(cfg){window.__wompiCfg=cfg;this.open=function(cb){window.__wompiOpen=(window.__wompiOpen||0)+1;setTimeout(function(){cb({transaction:{id:'tx-test-1',status:'APPROVED'}})},400)}}`}));
  await page.waitForFunction(() => ['library', 'session'].includes(window.__fhb.view()), null, {timeout: 60000}); if (await F(() => window.__fhb.view()) === 'library') await F(ref => window.__fhb.onAction({type: 'order', ref}), s.ref); await page.waitForFunction(() => window.__fhb.view() === 'session', null, {timeout: 60000}); await adv(4);
  t('antes de pagar, la sala muestra «Ir al pago seguro» en 3D', await F(() => window.__fhb.studio.stations.cockpit.payPill.group.visible));
  const before = page.url();
  await tap('session:pay'); await sleep(1500);
  const w = await F(() => ({open: window.__wompiOpen || 0, cfg: window.__wompiCfg, url: location.href}));
  t('abre la ventana de Wompi encima del estudio (sin redirigir)', w.open === 1 && w.url.split('#')[0] === before.split('#')[0], JSON.stringify(w));
  t('el widget recibe monto, referencia, llave y firma de integridad del servidor', w.cfg && w.cfg.currency === 'COP' && w.cfg.amountInCents > 0 && /^FHB-.*-[0-9A-F]{8}$/.test(w.cfg.reference) && w.cfg.publicKey === 'pub_test_abc123' && /^[0-9a-f]{64}$/.test(w.cfg.signature.integrity), JSON.stringify(w.cfg));
  await ctx.close();
  const ht = fs.readFileSync(new URL('../.htaccess', import.meta.url), 'utf8');
  t('la política de seguridad permite el widget de Wompi y nada más', /script-src 'self' https:\/\/checkout\.wompi\.co;/.test(ht) && /frame-src https:\/\/checkout\.wompi\.co/.test(ht) && !/unsafe-eval/.test(ht) && /object-src 'none'/.test(ht));
}
{ // sin el script de Wompi (bloqueado): cae al pago a pantalla completa
  const s = seed('personalizada', 'created', false), {ctx, page, F, adv, tap} = await open(s.link.replace('?session=', '?e2e&session='));
  await page.route('https://checkout.wompi.co/**', r => r.abort());
  await page.waitForFunction(() => ['library', 'session'].includes(window.__fhb.view()), null, {timeout: 60000}); if (await F(() => window.__fhb.view()) === 'library') await F(ref => window.__fhb.onAction({type: 'order', ref}), s.ref); await page.waitForFunction(() => window.__fhb.view() === 'session', null, {timeout: 60000}); await adv(3);
  const nav = page.waitForRequest(r => r.url().startsWith('https://checkout.wompi.co/p/'), {timeout: 15000}).then(r => r.url()).catch(() => '');
  await tap('session:pay'); const u = await nav;
  t('si Wompi no carga, usa el pago a pantalla completa (respaldo)', /public-key=pub_test_abc123/.test(u) && /signature%3Aintegrity=/.test(u), u);
  await ctx.close();
}

console.log('== experiencias y ticket');
{
  const {ctx, page, F, adv, tap} = await open('/?e2e');
  await F(() => { const h = window.__fhb, d = h.draft(); Object.assign(d, {genre: 'Salsa', mood: 'Alegre', voice: 'Femenina', language: 'Español', tempo: 'Medio', recipient: 'Ana', occasion: 'Boda', story: 'x'.repeat(40), product: 'dedicatoria', name: 'Ervin Grey', email: 'a@b.co', phone: '3001234567'}); h.studio.setDraft(d); h.go('products'); }); await adv(3.5);
  const chosen = () => F(() => window.__fhb.draft().product), focus = () => F(() => window.__fhb.studio.stations.products.focus);
  const show = async i => { if (mobile) { await F(i => window.__fhb.studio.stations.products.setFocus(i), i); await adv(1.5); } };
  await F(() => { window.__fhb.draft().product = 'dedicatoria'; window.__fhb.studio.setDraft(window.__fhb.draft()); }); await show(2); await tap('product:2'); await adv(1);
  t('tocar la CAJA elige y agranda la experiencia', await chosen() === 'full' && await focus() === 2, `${await chosen()} ${await focus()}`);
  await show(0); await tap('product:0'); await adv(1);
  await show(1); await tap('product-choose:1'); await adv(1);
  t('tocar el BOTÓN elige y agranda la misma experiencia', await chosen() === 'personalizada' && await focus() === 1, `${await chosen()} ${await focus()}`);
  await F(() => window.__fhb.go('checkout')); await adv(3.5);
  if (mobile) {
    const g = await F(() => { const a = window.__fhb.studio.screenOf('ticket:genre'), b = window.__fhb.studio.screenOf('ticket:mood'); return {open: document.getElementById('options-dialog').open, gap: Math.abs(b.y - a.y)}; });
    t('en el teléfono el ticket queda libre (el formulario no se abre solo) y sus líneas se pueden tocar (≥ 30 px)', !g.open && g.gap >= 30, JSON.stringify(g));
    await page.screenshot({path: `${OUT}/room-${mode}-ticket.png`});
  }
  await tap('ticket:voice'); await adv(2.5);
  t('tocar una línea del ticket lleva a ese paso y vuelve al pago', await F(() => window.__fhb.view() === 'voice') && /volver al pago/i.test(await page.$eval('#j-next', e => e.textContent)), await page.$eval('#j-next', e => e.textContent));
  await F(() => window.__fhb.go('checkout')); await adv(3);
  if (mobile) await page.click('.j-next'); await sleep(500);
  t(mobile ? '«Completar mis datos» abre el formulario cuando el cliente lo pide' : 'en escritorio el formulario está abierto junto al ticket', await F(() => document.getElementById('options-dialog').open) && await page.$('#checkout-form') !== null);
  await ctx.close();
}
t('sin errores de consola', errors.length === 0, errors.slice(0, 3).join(' | '));
await b.close(); console.log(`\n${ok} bien, ${bad} mal`); process.exit(bad ? 1 : 0);
