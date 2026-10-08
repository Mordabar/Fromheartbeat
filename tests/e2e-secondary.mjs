// Everything around the main journey: player, session, legal pages, menu, plain-text mode, checkout submit.
// The server has no database in CI, so order endpoints are answered by the test (nothing is ever charged or sent).
//   node e2e-secondary.mjs [mobile|desktop]
import {launch, open, runner, sleep} from './e2e-lib.mjs';

const mode = process.argv[2] || 'mobile';
const b = await launch(), t = await open(b, mode), {F, page} = t, {step, finish} = runner(`secondary (${mode})`);
const expect = (c, m) => { if (!c) throw new Error(m); };
const order = {reference: 'FHB-TEST1', status: 'in_production', production_stage: 2, product_name: 'Canción Personalizada', product_code: 'personalizada', amount_in_cents: 12990000,
  brief: {story: 'Recordamos aquel viaje a la playa.'}, files: [], history: [{created_at: '2026-09-14 10:00:00', note: 'Pago confirmado. Empezamos la letra.'}], product: {listening: true}};
const json = body => r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(body)});
await page.route('**/api.php?action=checkout', r => r.fulfill({status: 503, contentType: 'application/json', body: JSON.stringify({error: 'Los pagos aún no están disponibles.'})}));
await page.route('**/api.php?action=orders', r => r.fulfill({status: 201, contentType: 'application/json', body: JSON.stringify({order})}));
await page.route('**/api.php?action=order&*', json({order}));
await page.route('**/api.php?action=my-orders', json({orders: [{reference: order.reference, status: order.status, product_name: order.product_name, amount_in_cents: order.amount_in_cents}]}));

await step('LISTEN opens the vinyl wall', async () => { await t.tap('listen'); await t.settle(3.5); expect((await t.state()).view === 'samples', 'not samples'); await t.shot('a1-samples'); });
await step('tapping a record plays it and shows the mini player', async () => {
  await t.tap('track:1'); await sleep(900);
  const s = await F(() => ({src: document.querySelector('#sample-audio').src, dock: !document.getElementById('audio-dock').hidden}));
  expect(s.dock && s.src.includes('ey-mor'), JSON.stringify(s)); await t.shot('a2-playing');
  // Regression: the camera must not move because the player appeared.
  const free = await F(() => window.__fhb.studio.free); expect(free[3] - free[1] > 300, 'framing collapsed: ' + free);
});
await step('the collection list opens in the drawer', async () => { await F(() => window.__fhb.onAction({type: 'library'})); await sleep(300); expect(await F(() => document.querySelectorAll('.track').length) >= 6, 'no tracks'); await page.click('#close-options'); });
await step('Mi sesión with a single song goes straight into it', async () => { if (t.width <= 430) { await page.click('#menu-toggle'); await sleep(200); await page.click('#studio-menu [data-go=recover]'); } else await page.click('.hud-link[data-go=recover]'); await page.waitForFunction(() => window.__fhb.view() === 'session', null, {timeout: 15000}); await t.settle(3.5); await t.shot('b1-recover'); });
await step('opening an order builds the 3D session room', async () => { expect(await F(() => !!window.__fhb.studio.stations.cockpit.order?.reference && window.__fhb.studio.stations.cockpit.group.visible), 'session room not built'); expect(await F(() => !document.getElementById('options-dialog').open), 'the text panel must stay closed'); await t.shot('b2-room'); });
await step('the information wall opens the legal pages', async () => { await F(() => window.__fhb.go('info')); await t.settle(3.5); await t.tap('info:terms'); await t.settle(3); expect((await t.state()).view === 'terms', 'not terms'); await t.shot('c1-terms'); await page.click('#close-options'); });
await step('the menu opens and closes', async () => { await page.click('#menu-toggle'); await sleep(200); expect(await F(() => document.getElementById('studio-menu').open), 'menu closed'); await page.click('#menu-close'); });
await step('plain-text mode: a DOM option updates the 3D, and the mode persists', async () => {
  await F(() => window.__fhb.go('genre')); await t.settle(3); await page.click('.j-plain'); await sleep(300);
  await page.click('.opt[data-value="Bachata"]'); await t.settle(1);
  expect(await F(() => window.__fhb.studio.stations.genre.board.selected === 'Bachata'), '3D did not follow the DOM');
  await page.click('#next'); await t.settle(3); expect(await F(() => document.getElementById('options-dialog').open), 'plain mode did not persist to the next step'); await page.click('#close-options');
});
await step('keyboard: every 3D option is reachable and selectable', async () => {
  await F(() => window.__fhb.go('genre')); await t.settle(3); await sleep(2500);
  const n = await F(() => document.querySelectorAll('#stage-keys button').length); expect(n >= 12, 'only ' + n + ' keyboard targets');
  await page.focus('#stage-keys button:has-text("Género: Salsa")'); await page.keyboard.press('Enter'); await t.settle(1);
  expect((await t.state()).draft.genre === 'Salsa', 'Enter did not choose'); expect(await F(() => document.querySelector('#stage-keys button[aria-pressed=true]')?.textContent === 'Género: Salsa'), 'aria-pressed not synced');
});
await step('checkout submits and lands in the session (mocked server)', async () => {
  await F(() => Object.assign(window.__fhb.draft(), {genre: 'Salsa', mood: 'Alegre', voice: 'Dúo', recipient: 'Luna', occasion: 'Boda', story: 'Una historia lo bastante larga para pasar la validación mínima.'}));
  await F(() => window.__fhb.go('checkout')); await sleep(400);
  if (t.mobile) { await page.click('.j-next'); await sleep(400); }   // on a phone the ticket comes first; the form opens on request
  await page.fill('[name=name]', 'Ana Prueba'); await page.fill('[name=email]', 'ana@example.com'); await page.fill('[name=phone]', '3001234567'); await page.check('[name=consent]');
  await page.click('#next'); await t.settle(3.5); expect((await t.state()).view === 'session', 'no session'); await t.shot('e1-after-order');
});

t.log.errors = t.log.errors.filter(e => !/api\.php|status of 503/.test(e));
await b.close(); finish(t.log);
