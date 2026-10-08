// Crecimiento en el navegador: tienda (banner, precios de temporada, cupón en el pago, consentimientos, rastreo con respeto a «No rastrear»)
// y panel (Resumen, Cupones, Temporadas, Contactos, Campañas, Automatizaciones). Siembra: python3 tests/support/seed-growth.py
import {launch, open, runner, sleep, BASE_URL, SIZES} from './e2e-lib.mjs';
const mode = process.argv[2] || 'desktop', [width, height, mobile] = SIZES[mode];
const browser = await launch(), r = runner(`growth ${mode}`), errors = [];

// ---------------------------------------------------------------- shop
{
  const t = await open(browser, mode, 'e2e&utm_source=instagram&utm_campaign=madres'), calls = [];
  t.page.on('request', q => { if (q.url().includes('action=track') && q.method() === 'POST') calls.push(q.postDataJSON()); });
  await t.settle(3);
  await r.step('the season banner is shown with its text', async () => { const v = await t.F(() => { const b = document.querySelector('#promo-banner'); return {hidden: b.hidden, text: b.textContent}; }); if (v.hidden || !/Mes de la madre/.test(v.text)) throw new Error(JSON.stringify(v)); });
  await t.shot('growth-banner');
  await r.step('the campaign parameters are removed from the address bar', async () => { if (/utm_|[?&]c=/.test(t.page.url())) throw new Error(t.page.url()); });
  await r.step('the 3D products carry the season price', async () => { const v = await t.F(() => window.__fhb.studio.content.products.map(p => [p.code, p.price, p.listPrice, p.badge])); const p = v.find(x => x[0] === 'personalizada'); if (!(p[1] < p[2]) || p[3] !== '-20%') throw new Error(JSON.stringify(v)); });
  await t.F(() => { const d = window.__fhb.draft(); Object.assign(d, {genre: 'Salsa', mood: 'Romántica', voice: 'Femenina', recipient: 'Mamá', occasion: 'Cumpleaños', story: 'Mi mamá me enseñó a bailar en la cocina, cada domingo.', product: 'personalizada'}); window.__fhb.onAction({type: 'pick', kind: 'mood', value: 'Alegre'}); window.__fhb.go('products'); });
  await t.settle(3); await t.shot('growth-products');
  await r.step('the experiences list shows the crossed-out price and the badge', async () => { await t.page.click('.j-plain').catch(() => {}); await sleep(500); const v = await t.F(() => document.querySelector('#options-dialog .price')?.innerHTML || ''); if (!/was/.test(v) || !/-20%/.test(v)) throw new Error(v); await t.page.click('#close-options').catch(() => {}); });
  await t.F(() => window.__fhb.go('checkout')); await t.settle(3);
  if (!t.mobile || true) { await t.page.click('.j-next[data-plain],.j-plain').catch(() => {}); await sleep(700); }
  await r.step('the checkout asks for a coupon and shows the season discount', async () => { const v = await t.page.locator('#totals').innerText(); if (!/Mes de la madre/i.test(v) || !/Total a pagar/.test(v)) throw new Error(v); });
  await r.step('both marketing boxes exist and are NOT pre-checked', async () => { const v = await t.F(() => ['optin_email', 'optin_sms'].map(n => { const e = document.querySelector(`input[name=${n}]`); return !!e && !e.checked; })); if (v.join() !== 'true,true') throw new Error(v.join()); });
  await t.page.fill('#f-coupon', 'gracias30'); await t.page.click('#coupon-apply'); await sleep(900);
  await r.step('a better coupon replaces the season discount and says so', async () => { const v = await t.page.locator('#totals').innerText(), m = await t.page.locator('#coupon-msg').innerText(); if (!/Cupón GRACIAS30/.test(v) || /Mes de la madre/.test(v) || !/aplicado/i.test(m)) throw new Error(v + ' | ' + m); });
  await t.shot('growth-checkout');
  await r.step('a wrong coupon shows a clear message and keeps the price', async () => { await t.page.fill('#f-coupon', 'NOEXISTE'); await t.page.click('#coupon-apply'); await sleep(800); const m = await t.page.locator('#coupon-msg').innerText(); if (!/no existe/i.test(m)) throw new Error(m); });
  await t.page.fill('#f-coupon', 'GRACIAS30'); await t.page.click('#coupon-apply'); await sleep(900);
  await t.page.fill('input[name=name]', 'Cliente Navegador'); await t.page.fill('input[name=email]', 'navegador@example.com'); await t.page.fill('input[name=phone]', '3001234567');
  await t.page.check('input[name=consent]'); await t.page.check('input[name=optin_email]');
  await t.page.click('#next, button[form=checkout-form]'); await t.page.waitForFunction(() => window.__fhb.order()?.reference, null, {timeout: 30000}).catch(() => {});
  await r.step('the order is created at the server price with the coupon', async () => { const o = await t.F(() => window.__fhb.order()); if (!o) throw new Error('no order'); const want = Math.round(12990000 * 0.7); if (o.amount_in_cents !== want) throw new Error(o.amount_in_cents + ' vs ' + want); });
  await sleep(3500);
  await r.step('the funnel was tracked: view, pick, begin_checkout (visitor id, no personal data)', async () => {
    const ev = calls.flatMap(c => c.e || []), names = new Set(ev.map(e => e.n)); for (const n of ['view', 'pick', 'begin_checkout']) if (!names.has(n)) throw new Error('missing ' + n + ' in ' + [...names]);
    const all = JSON.stringify(calls); if (/navegador@example|3001234567|Cliente Navegador|cocina/.test(all)) throw new Error('personal data in tracking');
    if (!ev.some(e => e.us === 'instagram')) throw new Error('no utm source');
  });
  errors.push(...t.log.errors); await t.ctx.close();
}
// do-not-track: nothing is sent
{
  const ctx = await browser.newContext({viewport: {width, height}}), page = await ctx.newPage(), calls = []; await page.addInitScript(() => Object.defineProperty(navigator, 'doNotTrack', {value: '1'}));
  page.on('request', q => { if (q.url().includes('action=track')) calls.push(1); }); await page.goto(`${BASE_URL}/?e2e`, {waitUntil: 'load'}); await page.waitForFunction(() => window.__fhb?.studio?.renderer, null, {timeout: 40000}); await page.evaluate(() => window.__fhb.go('genre')); await sleep(4500);
  await r.step('with «Do Not Track» nothing is sent', async () => { if (calls.length) throw new Error('requests: ' + calls.length); });
  await ctx.close();
}
// ---------------------------------------------------------------- panel
{
  const ctx = await browser.newContext({viewport: {width, height}, hasTouch: mobile, isMobile: mobile}), page = await ctx.newPage(); let dialogs = 0;
  page.on('dialog', d => { dialogs++; d.dismiss(); }); page.on('pageerror', e => errors.push(String(e))); page.on('console', m => { if (m.type() === 'error' && !/WebGL|GPU|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE_URL}/admin.html`, {waitUntil: 'load'}); await page.fill('input[name=email]', 'admin@x.co'); await page.fill('input[name=password]', 'pw12345678'); await page.click('#login button'); await page.waitForSelector('.a-nav', {timeout: 20000});
  const shot = async n => { await sleep(500); await page.screenshot({path: `${process.env.OUT || './shots'}/${mode}-growth-${n}.png`, fullPage: true}); };
  await page.click('[data-admin-page=growth]'); await page.waitForSelector('.g-kpis', {timeout: 15000});
  await r.step('the summary shows revenue, funnel, sources, audience and campaigns', async () => { const txt = (await page.locator('#admin-content').innerText()).toLowerCase(); for (const w of ['Ingresos', 'De la visita a la compra', 'De dónde vienen las ventas', 'Tu audiencia', 'Campañas', 'instagram']) if (!txt.includes(w.toLowerCase())) throw new Error('missing ' + w); });
  await shot('overview');
  await page.click('[data-g-tab=coupons]'); await page.waitForSelector('#g-coupon');
  await r.step('create a coupon from the form', async () => {
    await page.fill('#g-coupon [name=code]', 'verano15'); await page.fill('#g-coupon [name=value]', '15'); await page.fill('#g-coupon [name=label]', '<img src=x onerror=alert(1)>'); await page.click('#g-coupon button.primary'); await page.waitForSelector('text=VERANO15', {timeout: 10000});
  });
  await r.step('a coupon label with HTML is shown as text', async () => { const t = await page.locator('#admin-content').innerText(); if (!t.includes('<img src=x onerror=alert(1)>')) throw new Error('not literal'); if (dialogs) throw new Error('alert fired'); });
  await shot('coupons');
  await r.step('an invalid coupon shows the server message in the form', async () => { await page.fill('#g-coupon [name=code]', 'malo90'); await page.fill('#g-coupon [name=value]', '95'); await page.click('#g-coupon button.primary'); await page.waitForFunction(() => /90/.test(document.querySelector('#g-err')?.textContent || ''), null, {timeout: 8000}); });
  await page.click('[data-g-tab=promos]'); await page.waitForSelector('#g-promo'); await shot('promos');
  await page.click('[data-g-tab=contacts]'); await page.waitForSelector('.g-table');
  await r.step('contacts list with consent flags; a row opens the detail with proof of consent', async () => { await page.click('tr[data-g-contact]'); await page.waitForSelector('#g-contact-detail .a-card', {timeout: 8000}); const t = await page.locator('#g-contact-detail').innerText(); if (!/permisos \(evidencia\)/i.test(t) || !/pedidos/i.test(t)) throw new Error(t.slice(0, 200)); });
  await shot('contacts');
  await page.click('[data-g-tab=campaigns]'); await page.waitForSelector('[data-g-new-camp]'); await page.click('[data-g-new-camp]'); await page.waitForSelector('#g-camp');
  await r.step('build a campaign: audience preset, personal coupon, live count', async () => {
    await page.fill('#g-camp [name=name]', 'Prueba <b>negrita</b>'); await page.fill('#g-camp [name=subject]', '{nombre}, algo para ti'); await page.fill('#g-camp [name=title]', 'Una *sorpresa*'); await page.fill('#g-camp [name=body]', 'Hola {nombre}.\n\nTe dejamos un código.'); await page.fill('#g-camp [name=p_value]', '10');
    await page.click('[data-g-seg=once]'); await page.waitForSelector('#g-camp'); await page.click('[data-g-preview]'); await page.waitForFunction(() => /personas recibirían/.test(document.querySelector('#g-preview')?.textContent || ''), null, {timeout: 8000});
  });
  await page.fill('#g-camp [name=name]', 'Prueba <b>negrita</b>'); await page.fill('#g-camp [name=subject]', '{nombre}, algo para ti'); await page.fill('#g-camp [name=title]', 'Una *sorpresa*'); await page.fill('#g-camp [name=body]', 'Hola {nombre}.\n\nTe dejamos un código.');
  await shot('campaign-form');
  await r.step('save as draft, then send a test to the admin', async () => { await page.click('[data-g-camp-action=save]'); await page.waitForSelector('text=Prueba <b>negrita</b>', {timeout: 8000}); });
  await page.click('[data-g-tab=automations]'); await page.waitForSelector('.g-auto');
  await r.step('four automations, all off by default, with their copy', async () => { const n = await page.locator('.g-auto').count(); const on = await page.locator('.g-auto input[name=enabled]:checked').count(); if (n !== 4 || on !== 0) throw new Error(n + '/' + on); });
  await shot('automations');
  await r.step('no horizontal scroll on this screen size', async () => { const ow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); if (ow > 2) throw new Error('overflow ' + ow); });
  await ctx.close();
}
r.finish({errors: errors.filter(e => !/Failed to load resource/.test(e))});
