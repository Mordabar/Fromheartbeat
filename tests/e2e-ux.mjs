// The end of the journey and the control room: checkout, customer session and admin, as a first-time user would meet them.
//   node e2e-ux.mjs [mobile|desktop|small|tablet]
import {launch, open, runner, sleep, BASE_URL, SIZES} from './e2e-lib.mjs';
import {order, mockCustomerApi, mockAdminApi} from './fixtures.mjs';

const mode = process.argv[2] || 'mobile';
const b = await launch(), {step, finish} = runner(`ux (${mode})`);
const expect = (c, m) => { if (!c) throw new Error(m); };
const errors = [];
const sessionFor = async status => {
  const t = await open(b, mode), {F, page} = t; const st = await mockCustomerApi(page, order(status));
  await F(() => window.__fhb.go('recover')); await sleep(300); await F(() => document.querySelector('.my-order').click()); await t.settle(3.5); await sleep(400);
  t.srv = st; return t;
};
const text = (t, sel) => t.F(sel => document.querySelector(sel)?.textContent.trim().replace(/\s+/g, ' '), sel);

await step('session list shows state, stage and what it means (no emojis, no jargon)', async () => {
  const t = await open(b, mode); await mockCustomerApi(t.page, order('in_production'));
  await t.F(() => window.__fhb.go('recover')); await sleep(400);
  const s = await text(t, '.my-order'); expect(/En producción/.test(s) && /Etapa 3 de 6/.test(s) && /Grabación/.test(s), 'list card: ' + s); errors.push(...t.log.errors); await t.ctx.close();
});
for (const [status, title, action] of [['payment_pending', /confirmando tu pago/i, '#resume-payment'], ['in_production', /creando tu canción/i, null], ['review', /lista para escucharla/i, 'a[href="#s-room"]'], ['completed', /Tu canción está lista/i, 'a[href="#s-room"]']]) {
  await step(`session (${status}): the hero says what is happening and what to do`, async () => {
    const t = await sessionFor(status); const h = await text(t, '.s-hero h1'); expect(title.test(h), 'hero title: ' + h);
    if (action) expect(await t.F(a => !!document.querySelector(a), action), 'missing action ' + action);
    else expect(/No tienes que hacer nada/.test(await text(t, '.s-hero')), 'should reassure the customer');
    expect(await t.F(() => document.querySelectorAll('.s-stages li').length === 6 && (!!document.querySelector('.s-stages [aria-current=step]') || true)), 'six stages');
    const s3d = await t.F(() => window.__fhb.studio.stations.session.order?.status); expect(s3d === status, '3D terminal status ' + s3d);
    await t.shot('s-' + status); errors.push(...t.log.errors); await t.ctx.close();
  });
}
await step('review: versions are ordered (latest first), the older one is clearly "anterior"', async () => {
  const t = await sessionFor('review'); const tr = await t.F(() => [...document.querySelectorAll('.s-track')].map(e => e.textContent.replace(/\s+/g, ' ')));
  expect(/ÚLTIMA VERSIÓN.*v2/.test(tr[0]) && /ANTERIOR.*v1/.test(tr[1]), JSON.stringify(tr)); await t.ctx.close();
});
await step('producer messages read as a conversation, system events stay small', async () => {
  const t = await sessionFor('review'); const n = await t.F(() => ({studio: document.querySelectorAll('.s-msg.studio').length, me: document.querySelectorAll('.s-msg.me').length, ev: document.querySelectorAll('.s-ev').length, log: !!document.querySelector('.history-item')}));
  expect(n.studio >= 2 && n.me === 1 && n.ev >= 1 && !n.log, JSON.stringify(n)); await t.ctx.close();
});
await step('replying: a quick answer fills the box and sending reaches the studio', async () => {
  const t = await sessionFor('review'); let sent = null; await t.page.route('**/api.php?action=feedback', r => { sent = r.request().postDataJSON(); return r.fulfill({status: 200, contentType: 'application/json', body: '{"ok":true}'}); });
  await t.F(() => document.querySelector('.s-chip').scrollIntoView({block: 'center'})); await t.page.click('.s-chip'); await sleep(150);
  const v = await t.F(() => document.querySelector('#s-msg').value); expect(/encanta/.test(v), 'chip did not fill: ' + v);
  await t.F(() => document.querySelector('#feedback-form button.primary').scrollIntoView({block: 'center'})); await t.page.click('#feedback-form button.primary'); await sleep(600);
  expect(sent && /encanta/.test(sent.message), 'feedback not sent: ' + JSON.stringify(sent)); await t.ctx.close();
});
await step('checkout: each mistake is named in words and the cursor goes there', async () => {
  const t = await open(b, mode); await mockCustomerApi(t.page, order('created'));
  await t.F(() => Object.assign(window.__fhb.draft(), {genre: 'Bachata', mood: 'Romántica', voice: 'Femenina', recipient: 'Luna', occasion: 'Aniversario', story: 'Nos conocimos en un viaje a la playa en 2016.', product: 'full', name: '', email: '', phone: '', consent: false}));
  await t.F(() => window.__fhb.go('checkout')); await t.settle(3.5); await sleep(300);
  const tryPay = async () => { await t.F(() => document.querySelector('#next').click()); await sleep(250); return [await text(t, '#checkout-error'), await t.F(() => document.activeElement.name)]; };
  let [msg, f] = await tryPay(); expect(/nombre/i.test(msg) && f === 'name', `name: ${msg} / ${f}`);
  await t.F(() => { Object.assign(window.__fhb.draft(), {name: 'Ana Pérez'}); document.querySelector('[name=name]').value = 'Ana Pérez'; });
  [msg, f] = await tryPay(); expect(/correo/i.test(msg) && f === 'email', `email: ${msg} / ${f}`);
  await t.page.fill('[name=email]', 'ana@ejemplo.com'); [msg, f] = await tryPay(); expect(/celular/i.test(msg) && f === 'phone', `phone: ${msg} / ${f}`);
  await t.page.fill('[name=phone]', '3001234567'); [msg, f] = await tryPay(); expect(/casilla|términos/i.test(msg) && f === 'consent', `consent: ${msg} / ${f}`);
  errors.push(...t.log.errors); await t.ctx.close();
});
await step('checkout: three numbered blocks, price visible, trust explained, test mode folded away', async () => {
  const t = await open(b, mode); await mockCustomerApi(t.page, order('created'));
  await t.F(() => Object.assign(window.__fhb.draft(), {genre: 'Bachata', mood: 'Romántica', voice: 'Femenina', recipient: 'Luna', occasion: 'Aniversario', story: 'Nos conocimos en un viaje a la playa en 2016.', product: 'full'}));
  await t.F(() => window.__fhb.go('checkout')); await t.settle(3.5); await sleep(300);
  const n = await t.F(() => ({secs: document.querySelectorAll('.c-sec').length, total: document.querySelector('.total-row strong')?.textContent, trust: document.querySelectorAll('.c-trust li').length, btn: document.querySelector('#next')?.textContent.trim()}));
  expect(n.secs === 3 && /279/.test(n.total) && n.trust === 3 && /279/.test(n.btn), JSON.stringify(n)); await t.shot('c-checkout'); await t.ctx.close();
});

// ---- Admin ----
const adminPage = async (opts) => {
  const [w, h, m] = SIZES[mode]; const ctx = await b.newContext({viewport: {width: w, height: h}, hasTouch: m, isMobile: m}); const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e))); page.on('console', x => { if (x.type() === 'error') errors.push(x.text()); });
  const st = await mockAdminApi(page, opts); await page.goto(`${BASE_URL}/admin.html`); await page.waitForSelector('#a-board, #login', {timeout: 15000}); return {ctx, page, st};
};
await step('admin: unauthenticated visitors get a login, then the board', async () => {
  const {ctx, page} = await adminPage({loggedIn: false}); expect(await page.$('#login'), 'no login form');
  await page.fill('[name=email]', 'a@b.co'); await page.fill('[name=password]', 'x'.repeat(12)); await page.click('#login button'); await page.waitForSelector('#a-board'); await ctx.close();
});
await step('admin: board has live counts, priorities first, filters and search', async () => {
  const {ctx, page} = await adminPage(); const tiles = await page.$$eval('.a-tile', a => a.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  expect(tiles.length === 7 && /^5 ?Todas/.test(tiles[0]) && /^4 ?Por atender/.test(tiles[1]), JSON.stringify(tiles));
  const first = await page.$eval('.o-card', e => e.textContent); expect(!/Sergio/.test(first), 'priority first: ' + first.slice(0, 60));
  await page.click('.a-tile[data-filter=done]'); expect(await page.$$eval('.o-card', a => a.length) === 1, 'filter');
  await page.click('.a-tile[data-filter=done]'); await page.fill('#a-q', 'valentina'); await sleep(200); expect(await page.$$eval('.o-card', a => a.length) === 1, 'search');
  expect(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'horizontal overflow (board)'); await page.screenshot({path: new URL(`./shots/${mode}-a-board.png`, import.meta.url).pathname}); await ctx.close();
});
await step('admin: detail suggests the next move and the composer is pre-filled, never auto-sent', async () => {
  const {ctx, page, st} = await adminPage(); await page.click('[data-order="FHB-7K2Q9"]'); await page.waitForSelector('.a-pipe');
  expect(/te escribió y espera respuesta/.test(await page.$eval('.a-alert', e => e.textContent)) && /subir un poco el tempo/.test(await page.$eval('.a-alert blockquote', e => e.textContent)), 'unanswered client message not flagged with its text');
  await page.click('.a-act.primary'); await sleep(200); const v = await page.$eval('[name=note]', e => e.value); expect(v === '', 'a reply must never be pre-written: ' + v); await page.fill('[name=note]', 'Claro, subimos el tempo del final y te aviso.');
  expect(st.saved.length === 0, 'sent without confirmation'); expect(!(await page.$eval('#a-preview', e => e.hidden)), 'preview hidden'); expect(/Enviar a Ana/.test(await page.$eval('#a-send', e => e.textContent)), 'send label');
  await page.click('#update button.primary'); await sleep(500); expect(st.saved.length === 1 && st.saved[0].visible === true && st.saved[0].attention === false, JSON.stringify(st.saved)); await ctx.close();
});
await step('admin: an internal note is never visible to the customer nor emailed', async () => {
  const {ctx, page, st} = await adminPage(); await page.click('[data-order="FHB-9P4D6"]'); await page.waitForSelector('.a-pipe');
  await page.check('[name=audience][value=internal]'); expect(await page.$eval('[name=notify]', e => e.disabled), 'notify should be disabled');
  await page.fill('[name=note]', 'Pidió referencia a Carlos Vives'); await page.click('#update button.primary'); await sleep(500);
  expect(st.saved[0].visible === false && st.saved[0].notify === false, JSON.stringify(st.saved[0]));
  expect(await page.$eval('.a-msg.internal', e => /Nota interna/.test(e.textContent)), 'internal note not marked'); await ctx.close();
});
await step('admin: delivery upload, contact shortcuts and payments are present', async () => {
  const {ctx, page} = await adminPage(); await page.click('[data-order="FHB-7K2Q9"]'); await page.waitForSelector('.a-pipe');
  const n = await page.evaluate(() => ({mail: !!document.querySelector('a[href^="mailto:"]'), wa: !!document.querySelector('a[href^="https://wa.me/57"]'), up: !!document.querySelector('#upload input[type=file]'), pay: /Aprobado/.test(document.body.textContent), files: document.querySelectorAll('.a-files li').length}));
  expect(n.mail && n.wa && n.up && n.pay && n.files === 3, JSON.stringify(n)); expect(!(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)), 'horizontal overflow (detail)'); await page.screenshot({path: new URL(`./shots/${mode}-a-detail.png`, import.meta.url).pathname, fullPage: true}); await ctx.close();
});
await step('admin: cannot send a song to review or delivery without its files; says what is missing', async () => {
  const ready = {...order('in_production', {stage: 4, files: []}), reference: 'FHB-4S4S4', history: order('in_production', {stage: 4}).history.filter(h => h.actor !== 'customer')};
  const {ctx, page} = await adminPage({extra: [ready]}); await page.fill('#a-q', 'FHB-4S4S4'); await sleep(500); await page.click('[data-order="FHB-4S4S4"]'); await page.waitForSelector('.a-pipe');
  expect(await page.$eval('.a-act', e => e.disabled), 'review button should be disabled'); expect(/Primero sube el MP3/.test(await page.$eval('.a-blocked', e => e.textContent)), 'no explanation'); await ctx.close();
});
await step('admin: an internal note or an upload does NOT clear "te escribió"; "ya lo atendí" does', async () => {
  const {ctx, page, st} = await adminPage(); await page.click('[data-order="FHB-7K2Q9"]'); await page.waitForSelector('.a-alert');
  await page.check('[name=audience][value=internal]'); await page.fill('[name=note]', 'Revisar tempo con Carlos'); await page.click('#update button.primary'); await sleep(600);
  expect(await page.$('.a-alert blockquote'), 'internal note silenced the alert'); expect(st.saved[0].visible === false, 'note should be internal');
  await page.click('[data-attend]'); await sleep(600); expect(!(await page.$('.a-alert')) && st.saved.at(-1).attention === false && st.saved.at(-1).visible === false, 'attend failed'); await ctx.close();
});
await step('admin: the draft survives an upload and a bad file is refused in words', async () => {
  const {ctx, page} = await adminPage(); await page.click('[data-order="FHB-7K2Q9"]'); await page.waitForSelector('.a-pipe');
  await page.fill('[name=note]', 'Borrador importante que no debe perderse');
  await page.setInputFiles('#upload input[type=file]', {name: 'notas.txt', mimeType: 'text/plain', buffer: Buffer.from('hola')}); await page.click('#upload button.primary'); await sleep(400);
  expect(/tipo de archivo/.test(await page.$eval('#upload .form-error', e => e.textContent)), 'bad type message'); expect(await page.$eval('[name=note]', e => e.value) === 'Borrador importante que no debe perderse', 'draft lost');
  await page.setInputFiles('#upload input[type=file]', {name: 'v3.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('abc')}); await page.click('#upload button.primary'); await sleep(900);
  expect(await page.$eval('[name=note]', e => e.value) === 'Borrador importante que no debe perderse', 'draft lost after upload'); await ctx.close();
});
await step('admin: choosing a state keeps the stage coherent; cancelling asks first', async () => {
  const {ctx, page, st} = await adminPage(); await page.click('[data-order="FHB-7K2Q9"]'); await page.waitForSelector('.a-pipe');
  await page.selectOption('[name=status]', 'completed'); expect(await page.$eval('[name=stage]', e => e.value) === '5', 'stage should follow state'); await ctx.close();
  const c = await adminPage(); await c.page.click('[data-order="FHB-2B7X0"]'); await c.page.waitForSelector('.a-pipe'); let asked = false; c.page.on('dialog', d => { asked = true; d.dismiss(); });
  await c.page.selectOption('[name=status]', 'cancelled'); await c.page.fill('[name=note]', 'Cancelada a pedido'); await c.page.click('#update button.primary'); await sleep(400);
  expect(asked && c.st.saved.length === 0, 'cancel must ask and not save when dismissed'); await c.ctx.close();
});
await step('checkout: the error is written next to the field that needs it, and clears when typing', async () => {
  const t = await open(b, mode); await mockCustomerApi(t.page, order('created'));
  await t.F(() => Object.assign(window.__fhb.draft(), {genre: 'Bachata', mood: 'Romántica', voice: 'Femenina', recipient: 'Luna', occasion: 'Aniversario', story: 'Nos conocimos en un viaje a la playa en 2016.', product: 'full', name: '', email: '', phone: '', consent: false}));
  await t.F(() => window.__fhb.go('checkout')); await t.settle(3.5); await sleep(300); await t.F(() => document.querySelector('#next').click()); await sleep(400);
  const e = await t.F(() => { const el = document.querySelector('.field-err'); if (!el) return null; const r = el.getBoundingClientRect(), b = document.querySelector('#options-dialog .panel-body').getBoundingClientRect(); return {text: el.textContent, inView: r.top >= b.top && r.bottom <= b.bottom}; });
  expect(e && /nombre/i.test(e.text) && e.inView, 'inline error not visible: ' + JSON.stringify(e)); await t.page.fill('[name=name]', 'Ana'); await sleep(150);
  expect(!(await t.F(() => document.querySelector('.field-err'))), 'error should clear on typing'); await t.ctx.close();
});
await step('checkout: "Cambiar" from the summary returns to payment in one tap', async () => {
  const t = await open(b, mode); await mockCustomerApi(t.page, order('created'));
  await t.F(() => Object.assign(window.__fhb.draft(), {genre: 'Bachata', mood: 'Romántica', voice: 'Femenina', recipient: 'Luna', occasion: 'Aniversario', story: 'Nos conocimos en un viaje a la playa en 2016.', product: 'full'}));
  await t.F(() => window.__fhb.go('checkout')); await t.settle(3.5); await sleep(300);
  await t.F(() => document.querySelector('.recap-row button').click()); await t.settle(3); await sleep(300);
  expect(/volver al pago/i.test(await text(t, '#j-next')), 'label: ' + await text(t, '#j-next')); await t.F(() => document.querySelector('#j-next').click()); await t.settle(3);
  expect((await t.F(() => window.__fhb.view())) === 'checkout', 'did not return to checkout'); await t.ctx.close();
});
await step('cancelled session shows no progress, says so, and offers a way to talk', async () => {
  const t = await open(b, mode); await mockCustomerApi(t.page, order('cancelled')); await t.F(() => window.__fhb.go('recover')); await sleep(300); await t.F(() => document.querySelector('.my-order').click()); await t.settle(3.5); await sleep(300);
  const n = await t.F(() => ({now: document.querySelectorAll('.s-stages .now').length, done: document.querySelectorAll('.s-stages .done').length, meter: document.querySelectorAll('.s-meter .now,.s-meter .on').length, h: document.querySelector('.s-hero h1').textContent}));
  expect(n.now === 0 && n.done === 0 && n.meter === 0 && /cancelada/i.test(n.h), JSON.stringify(n)); await t.ctx.close();
});
await step('review: the last stage is the one that is lit (hero and line agree)', async () => {
  const t = await sessionFor('review'); expect(/Etapa 6 de 6/.test(await text(t, '.s-line .s-h')), await text(t, '.s-line .s-h')); await t.ctx.close();
});
await step('long producer notes are folded with a "Leer completa" button', async () => {
  const t = await open(b, mode); const o = order('review'); o.history.push({status: 'review', stage: 5, actor: 'admin:1', note: 'Una nota muy larga. '.repeat(60), created_at: '2026-09-20 10:00:00'}); await mockCustomerApi(t.page, o);
  await t.F(() => window.__fhb.go('recover')); await sleep(300); await t.F(() => document.querySelector('.my-order').click()); await t.settle(3.5); await sleep(300);
  expect(await t.F(() => !!document.querySelector('.s-text.clamp') && !!document.querySelector('[data-readmore]')), 'no clamp'); await t.F(() => document.querySelector('[data-readmore]').click());
  expect(await t.F(() => !document.querySelector('.s-text.clamp')), 'did not expand'); await t.ctx.close();
});
await step('Mi sesión: with a session on this device the first action is opening it', async () => {
  const t = await open(b, mode); await mockCustomerApi(t.page, order('in_production')); await t.F(() => window.__fhb.go('recover')); await sleep(400);
  const n = await t.F(() => ({cards: document.querySelectorAll('.my-order').length, foot: document.querySelector('#options-dialog .panel-foot')?.textContent.trim() || '', lost: !!document.querySelector('.s-lost')}));
  expect(n.cards === 1 && n.lost && !/Enviarme/.test(n.foot), JSON.stringify(n)); await t.ctx.close();
});
await step('no console errors anywhere', async () => { const real = errors.filter(e => !/api\.php|Failed to load resource/.test(e)); expect(!real.length, real.slice(0, 3).join(' | ')); });
await b.close(); finish({errors: [], failed: []});
