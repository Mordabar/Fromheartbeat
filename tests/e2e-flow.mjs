// The whole customer journey by touching the 3D studio: lobby -> sound -> mood -> voice -> story -> experience -> checkout.
//   node e2e-flow.mjs [mobile|desktop]
import {launch, open, runner, OUT} from './e2e-lib.mjs';

const mode = process.argv[2] || 'mobile';
const b = await launch(), t = await open(b, mode), {F, page} = t, {step, finish} = runner(`flow (${mode})`);
const expect = (cond, msg) => { if (!cond) throw new Error(msg); };

await t.shot('01-lobby');
await step('REC opens the console', async () => { await t.tap('rec'); await t.settle(3.5); expect((await t.state()).view === 'genre', 'view is not genre'); await t.shot('02-genre'); });
await step('tap a genre pad', async () => { await t.tap('genre:Salsa'); expect((await t.state()).draft.genre === 'Salsa', 'genre not set'); await t.shot('03-genre-picked'); });
await step('switch bank and pick again', async () => { await t.tap('bank:Urbano'); await t.settle(1.2); await t.tap('genre:Trap'); expect((await t.state()).draft.genre === 'Trap', 'genre not set'); });
await step('Next -> mood halo', async () => { await page.click('#j-next'); await t.settle(3.5); expect((await t.state()).view === 'mood', 'view is not mood'); await t.tap('mood:Romántica'); await t.settle(1.5); expect((await t.state()).draft.mood === 'Romántica', 'mood not set'); await t.shot('04-mood'); });
await step('Next -> booth (voice, language, tempo)', async () => {
  await page.click('#j-next'); await t.settle(3.5);
  await t.tap('voice:Femenina'); await t.settle(1); await t.tap('language:Inglés'); await t.tap('tempo:Rápido');
  const d = (await t.state()).draft; expect(d.voice === 'Femenina' && d.language === 'Inglés' && d.tempo === 'Rápido', JSON.stringify(d)); await t.shot('05-voice');
});
await step('Next -> lounge: the plaque follows what is typed', async () => {
  await page.click('#j-next'); await t.settle(3.5); expect(await F(() => document.getElementById('options-dialog').open), 'form drawer not open');
  await page.fill('[name=recipient]', 'Luna'); await page.click('[data-pick=occasion][data-value=Aniversario]');
  await page.fill('[name=story]', 'Recordamos aquel viaje a la playa que nos cambió la vida para siempre.'); await t.settle(2);
  expect(await F(() => window.__fhb.studio.stations.story.screen.surface.state?.draft?.story?.includes('viaje')), '3D plaque did not receive the story'); await t.shot('06-story');
});
await step('Next -> experiences: each card carries its own content', async () => { await page.click('#next'); await t.settle(3.5); expect((await t.state()).view === 'products', 'view is not products'); await t.shot('07-products'); });
await step('choose an experience with the 3D button', async () => {
  await t.tap('product-choose:2').catch(async () => { await t.tap('product-next'); await t.settle(1.5); await t.tap('product-choose:2'); });
  expect((await t.state()).draft.product === 'full', 'product not chosen');
});
await step('Next -> checkout shows the 3D ticket', async () => { await page.click('#j-next'); await t.settle(3.5); expect((await t.state()).view === 'checkout', 'view is not checkout'); await t.shot('08-checkout'); });

console.log('screenshots in', OUT);
await b.close(); finish(t.log);
