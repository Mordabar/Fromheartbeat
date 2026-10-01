// Simulated server data for the browser tests: nothing here talks to a real database, Wompi or a mail server.
const json = body => r => r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify(typeof body === 'function' ? body(r) : body)});

export const STAGES = ['Historia recibida', 'Letra', 'Grabación', 'Producción', 'Mezcla y master', 'Entrega'];

const NOTES = [
  {status: 'created', stage: 0, actor: 'system', note: 'Historia recibida. Tu sesión está guardada.', created_at: '2026-09-14 10:00:00'},
  {status: 'paid', stage: 0, actor: 'wompi', note: 'Pago confirmado. Tu sesión ha comenzado.', created_at: '2026-09-14 10:04:00'},
  {status: 'in_production', stage: 1, actor: 'admin:1', note: 'Leímos tu historia completa. La parte del viaje a la playa será el estribillo; ya estamos escribiendo la primera estrofa.', created_at: '2026-09-15 15:30:00'},
  {status: 'in_production', stage: 2, actor: 'admin:1', note: 'Letra aprobada internamente. Entramos a cabina esta semana con la voz femenina que pediste.', created_at: '2026-09-17 09:12:00'},
  {status: 'review', stage: 4, actor: 'customer', note: 'Comentario del cliente: ¿Podemos subir un poco el tempo en el final?', created_at: '2026-09-19 18:40:00'},
];

// status → how far the order has got. `files` only appear when there is something to listen to.
export function order(status = 'in_production', {stage, audience = 'person', product = 'full', files} = {}) {
  const st = stage ?? {created: 0, payment_pending: 0, paid: 0, in_production: 2, review: 4, completed: 5, cancelled: 0}[status];
  const delivery = files ?? (['review', 'completed'].includes(status) ? [
    {id: 10, kind: 'delivery', mime: 'audio/mpeg', original_name: 'Luna-y-Mateo-v1.mp3'},
    {id: 11, kind: 'delivery', mime: 'audio/mpeg', original_name: 'Luna-y-Mateo-v2.mp3'},
    {id: 12, kind: 'delivery', mime: 'image/jpeg', original_name: 'Portada.jpg'},
  ] : []);
  const names = {personalizada: 'Canción Personalizada', full: 'Full Experience', dedicatoria: 'Dedicatoria Musical'};
  return {
    reference: 'FHB-7K2Q9', status, production_stage: st, audience, product_code: product, product_name: names[product], amount_in_cents: product === 'full' ? 27990000 : 12990000,
    brief: {genre: 'Bachata', mood: 'Romántica', voice: 'Femenina', language: 'Español', tempo: 'Medio', recipient: 'Luna', occasion: 'Aniversario',
      story: 'Nos conocimos en un viaje a la playa en 2016. Cada aniversario volvemos al mismo lugar y ella siempre pide la misma canción de bachata.'},
    files: delivery, history: NOTES.filter(n => n.stage <= st || n.actor === 'customer' && st >= 4).map(n => ({...n})),
    product: {listening: product !== 'dedicatoria', price: 12990000}, requires_attention: 0,
    customer: {name: 'Ana Prueba', email: 'ana@example.com', phone: '3001234567'},
    payments: [{reference: 'FHB-7K2Q9-1', transaction_id: status === 'created' ? '' : '11111-1700000000-22222', status: status === 'created' ? 'PENDING' : 'APPROVED', amount_in_cents: 27990000, currency: 'COP'}],
    mails: [], testLink: '', created_at: '2026-09-14 10:00:00',
  };
}

// Customer-side endpoints.
export async function mockCustomerApi(page, o) {
  const state = {order: o};
  await page.route('**/api.php?action=orders', r => r.fulfill({status: 201, contentType: 'application/json', body: JSON.stringify({order: state.order})}));
  await page.route('**/api.php?action=order&*', json(() => ({order: state.order})));
  await page.route('**/api.php?action=my-orders', json(() => ({orders: [{reference: state.order.reference, status: state.order.status, product_name: state.order.product_name, amount_in_cents: state.order.amount_in_cents, production_stage: state.order.production_stage}]})));
  await page.route('**/api.php?action=checkout', json({url: 'https://checkout.wompi.co/p/?simulated=1'}));
  await page.route('**/api.php?action=feedback', json({ok: true}));
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  await page.route('**/api.php?action=file&*', r => r.request().url().includes('id=12') ? r.fulfill({status: 200, contentType: 'image/png', body: PNG}) : r.fulfill({status: 200, contentType: 'audio/mpeg', body: Buffer.alloc(64)}));
  return state;
}

// Admin endpoints: a small in-memory studio with several orders.
export async function mockAdminApi(page, {loggedIn = true, extra = []} = {}) {
  const orders = [order('review'), {...order('paid', {product: 'personalizada'}), reference: 'FHB-3M8T1', customer: {name: 'Camilo Rojas', email: 'camilo@example.com', phone: '3105550000'}},
    {...order('in_production', {stage: 3}), reference: 'FHB-9P4D6', requires_attention: 1, customer: {name: 'Valentina Gómez', email: 'vale@example.com', phone: '3200001111'}},
    {...order('created', {product: 'dedicatoria'}), reference: 'FHB-2B7X0', customer: {name: 'Sergio Díaz', email: 'sergio@example.com', phone: '3012223333'}},
    {...order('completed'), reference: 'FHB-5R1N8', customer: {name: 'Marta Ruiz', email: 'marta@example.com', phone: '3151112222'}}, ...extra];
  const lastVoice = o => { for (const h of o.history.slice().reverse()) { if (h.actor === 'customer') return 'customer'; if (h.actor.startsWith('admin') && (h.visible !== false || /^Atendida sin mensaje/.test(h.note)) && !/^(Versión disponible|Archivo añadido):/.test(h.note)) return 'admin:1'; } return null; };
  const state = {orders, saved: [], loggedIn};
  const row = o => ({reference: o.reference, name: o.customer.name, email: o.customer.email, product_name: o.product_name, amount_in_cents: o.amount_in_cents, status: o.status, production_stage: o.production_stage, requires_attention: o.requires_attention, created_at: o.created_at, last_voice: lastVoice(o)});
  await page.route('**/api.php?action=bootstrap', json(() => ({csrf: 'test', admin: state.loggedIn, testMode: false, tracks: [], catalog: [], options: {}, content: {}, commerceReady: true})));
  await page.route('**/api.php?action=login', r => { state.loggedIn = true; return r.fulfill({status: 200, contentType: 'application/json', body: '{"ok":true}'}); });
  await page.route('**/api.php?action=logout', json({ok: true}));
  await page.route('**/api.php?action=admin-orders*', json(() => ({orders: state.orders.map(row)})));
  await page.route('**/api.php?action=admin-order&*', r => { const ref = new URL(r.request().url()).searchParams.get('reference'); return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({order: state.orders.find(o => o.reference === ref)})}); });
  await page.route('**/api.php?action=admin-update', r => {
    const d = r.request().postDataJSON(); state.saved.push(d); const o = state.orders.find(x => x.reference === d.reference);
    Object.assign(o, {status: d.status, production_stage: d.stage, requires_attention: d.attention ? 1 : 0});
    o.history.push({status: d.status, stage: d.stage, actor: 'admin:1', note: d.note, created_at: '2026-09-20 12:00:00', visible: d.visible});
    return r.fulfill({status: 200, contentType: 'application/json', body: JSON.stringify({ok: true})});
  });
  await page.route('**/api.php?action=upload', json({ok: true}));
  await page.route('**/api.php?action=admin-music', json({tracks: []}));
  return state;
}
