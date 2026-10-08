// «Crecimiento»: the business side of the studio. Dashboard, coupons, seasonal promotions, contacts (with consent),
// email/SMS campaigns and automations. Same endpoints/auth as the rest of the panel (admin-* actions).
const TABS = [['overview', 'Resumen'], ['coupons', 'Cupones'], ['promos', 'Temporadas'], ['contacts', 'Contactos'], ['campaigns', 'Campañas'], ['automations', 'Automatizaciones']];
const SEGMENTS = [
  ['all', 'Todos los suscritos', {}],
  ['once', 'Compraron 1 vez', {orders_min: 1, orders_max: 1}],
  ['vip', 'Clientes frecuentes (2+ compras)', {orders_min: 2}],
  ['dormant', 'Dormidos (más de 90 días sin comprar)', {orders_min: 1, last_order_days_min: 90}],
  ['recent', 'Compraron en los últimos 30 días', {last_order_days_max: 30}],
  ['leads', 'Aún no han comprado', {never_paid: true}],
  ['new', 'Se suscribieron hace menos de 14 días', {joined_days_max: 14}],
];
const RULES = [['orders_min', 'Compras mínimas', 'number'], ['orders_max', 'Compras máximas', 'number'], ['last_order_days_min', 'Última compra hace al menos (días)', 'number'], ['last_order_days_max', 'Última compra hace como máximo (días)', 'number'], ['spent_min_cop', 'Gastó al menos (COP)', 'number'], ['joined_days_max', 'Se unió hace menos de (días)', 'number'], ['tag', 'Etiqueta', 'text'], ['source', 'Primer origen (utm_source)', 'text']];

export function createGrowth({root, api, esc, money, tell, nav}) {
  let tab = 'overview', days = 30, products = [], contactQuery = '', contactFilter = 'all', contactPage = 0, editing = null, segKey = 'all', segFilters = {}, preview = null, camp = null, coupons = [];
  const num = n => new Intl.NumberFormat('es-CO').format(n);
  const toUtc = v => v ? new Date(v).toISOString().slice(0, 19).replace('T', ' ') : '';
  const fromUtc = s => { if (!s) return ''; const d = new Date(String(s).replace(' ', 'T') + 'Z'), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };
  const when = s => s ? new Date(String(s).replace(' ', 'T') + 'Z').toLocaleString('es-CO', {dateStyle: 'medium', timeStyle: 'short'}) : '—';
  const shell = body => `${nav('growth')}<header class="a-head"><p class="a-eyebrow">Marketing y ventas</p><h1>Crecimiento.</h1></header><nav class="g-tabs" aria-label="Secciones">${TABS.map(([k, l]) => `<button data-g-tab="${k}" class="${tab === k ? 'on' : ''}" ${tab === k ? 'aria-current="page"' : ''}>${l}</button>`).join('')}</nav>${body}`;
  const pill = (t, tone = '') => `<span class="g-pill ${tone}">${esc(t)}</span>`;
  const bar = (v, max, tone = '') => `<span class="g-bar"><i class="${tone}" style="width:${max ? Math.max(2, Math.round(v * 100 / max)) : 0}%"></i></span>`;
  const err = e => `<section class="a-card g-err"><h2 class="a-h">No se pudo cargar</h2><p>${esc(e.message)}</p><button class="secondary" data-g-setup>Preparar la base de datos de crecimiento</button></section>`;

  async function render() {
    document.querySelector('#logout').hidden = false;
    try { root.innerHTML = shell(await ({overview, coupons: couponsView, promos: promosView, contacts: contactsView, campaigns: campaignsView, automations: autosView}[tab])()); }
    catch (e) { root.innerHTML = shell(err(e)); }
  }

  // ---------------------------------------------------------------------------------------------- overview
  async function overview() {
    const d = await api('admin-growth-overview', null, '&days=' + days), k = d.kpi, a = d.audience, maxRev = Math.max(1, ...d.series.map(s => s.revenue)), maxF = Math.max(1, d.funnel[0].visitors);
    const spark = `<svg class="g-spark" viewBox="0 0 ${d.series.length * 10} 60" preserveAspectRatio="none" role="img" aria-label="Ingresos por día">${d.series.map((s, i) => `<rect x="${i * 10 + 1}" y="${60 - Math.round(s.revenue * 56 / maxRev) - 2}" width="8" height="${Math.round(s.revenue * 56 / maxRev) + 2}" rx="2"><title>${s.day}: ${money(s.revenue)} (${s.orders})</title></rect>`).join('')}</svg>`;
    const card = (l, v, sub = '') => `<article class="g-kpi"><small>${l}</small><b>${v}</b>${sub ? `<em>${sub}</em>` : ''}</article>`;
    return `<div class="g-range">${[7, 30, 90].map(n => `<button data-g-days="${n}" class="${days === n ? 'on' : ''}">${n} días</button>`).join('')}</div>
    <div class="g-kpis">${card('Ingresos', money(k.revenue), `${num(k.orders)} pedidos pagados`)}${card('Ticket promedio', money(k.aov))}${card('Conversión', k.conversion + ' %', 'visitantes que pagan')}${card('Recompra', k.repeat_share + ' %', `${num(k.repeat_orders)} pedidos de clientes que ya habían comprado`)}${card('Descuentos dados', money(k.discounts))}${card('Valor por cliente', money(a.ltv), 'gasto medio de quien compró')}</div>
    <section class="a-card"><h2 class="a-h"><span>Ingresos por día</span><b>${days > 90 ? 90 : days} días</b></h2>${spark}</section>
    <section class="a-card"><h2 class="a-h"><span>De la visita a la compra</span><b>personas distintas</b></h2><ol class="g-funnel">${d.funnel.map(f => `<li><span>${f.label}</span>${bar(f.visitors, maxF)}<b>${num(f.visitors)} <small>${f.pct} %</small></b></li>`).join('')}</ol>${d.funnel[0].visitors ? '' : '<p class="a-sub">Aún no hay visitas medidas. Empiezan a contarse cuando el sitio publicado carga <code>track.js</code>.</p>'}</section>
    <section class="a-card"><h2 class="a-h"><span>De dónde vienen las ventas</span><b>último origen</b></h2>${d.sources.length ? `<div class="g-scroll"><table class="g-table"><thead><tr><th>Origen</th><th>Campaña</th><th>Visitas</th><th>Pedidos</th><th>Ingresos</th></tr></thead><tbody>${d.sources.map(s => `<tr><td>${esc(s.source)}</td><td>${esc(s.campaign || '—')}</td><td>${s.visitors ?? '—'}</td><td>${s.orders}</td><td>${money(s.revenue)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="a-sub">Todavía no hay ventas en este periodo.</p>'}<p class="a-sub">Para medir una campaña, enlaza con <code>?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=nombre</code>. Los correos de campaña ya lo llevan.</p></section>
    <section class="a-card"><h2 class="a-h"><span>Tu audiencia</span><b>${num(a.contacts)} contactos</b></h2><div class="g-kpis small">${card('Aceptan correo', num(a.email_optin), `+${a.new_optin} en el periodo`)}${card('Aceptan SMS', num(a.sms_optin))}${card('Se dieron de baja', num(a.unsubscribed))}${card('Ya compraron', num(a.buyers))}${card('Compraron 2+ veces', num(a.repeaters), a.repeat_rate + ' % de recompra')}</div></section>
    <section class="a-card"><h2 class="a-h"><span>Campañas</span><b>${d.campaigns.length}</b></h2>${d.campaigns.length ? `<div class="g-scroll"><table class="g-table"><thead><tr><th>Campaña</th><th>Enviados</th><th>Abrieron</th><th>Clics</th><th>Pedidos</th><th>Ingresos</th></tr></thead><tbody>${d.campaigns.map(c => `<tr><td>${esc(c.name)}<br>${pill(c.status)}</td><td>${num(c.sent)}</td><td>${c.open_rate} %</td><td>${c.click_rate} %</td><td>${c.orders}</td><td>${money(c.revenue)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="a-sub">Aún no hay campañas en este periodo.</p>'}</section>
    <section class="a-card"><h2 class="a-h"><span>Cupones más usados</span><b>${d.coupons.length}</b></h2>${d.coupons.length ? `<div class="g-scroll"><table class="g-table"><thead><tr><th>Cupón</th><th>Usos</th><th>Descuento dado</th><th>Ventas</th></tr></thead><tbody>${d.coupons.map(c => `<tr><td>${esc(c.code)}</td><td>${c.n}</td><td>${money(c.disc)}</td><td>${money(c.rev)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="a-sub">Aún no se ha usado ningún cupón.</p>'}</section>
    <section class="a-card"><h2 class="a-h"><span>Automatizaciones</span><b>${d.automations.filter(x => +x.enabled).length} activas</b></h2><div class="g-scroll"><table class="g-table"><tbody>${d.automations.map(x => `<tr><td>${esc(x.name)}<br>${pill(+x.enabled ? 'activa' : 'apagada', +x.enabled ? 'on' : '')}</td><td>${x.sent} enviados</td><td>${x.clicked} clics</td><td>${x.orders} pedidos</td></tr>`).join('')}</tbody></table></div></section>`;
  }

  // ---------------------------------------------------------------------------------------------- coupons
  const prodChecks = (sel = []) => `<fieldset class="g-checks"><legend>Aplica a</legend>${products.map(p => `<label><input type="checkbox" name="product_codes" value="${p.code}" ${sel.includes(p.code) ? 'checked' : ''}> ${esc(p.name)}</label>`).join('')}<small>Si no marcas ninguna, aplica a todas las experiencias para personas.</small></fieldset>`;
  async function couponsView() {
    const d = await api('admin-coupons'); products = d.products; coupons = d.coupons; const c = editing && editing.type === 'coupon' ? editing.row : null;
    const v = c ? (c.kind === 'fixed' ? Math.round(c.value / 100) : c.value) : '';
    return `<section class="a-card"><h2 class="a-h"><span>${c ? 'Editar cupón' : 'Nuevo cupón'}</span><b>${d.personal} códigos personales creados automáticamente</b></h2>
    <form id="g-coupon" class="g-form" data-id="${c?.id || ''}">
     <label class="field">Código<input name="code" required maxlength="40" value="${esc(c?.code || '')}" placeholder="MADRES20" style="text-transform:uppercase"></label>
     <label class="field">Nombre interno (opcional)<input name="label" maxlength="120" value="${esc(c?.label || '')}" placeholder="Campaña día de la madre"></label>
     <div class="g-row"><label class="field">Tipo<select name="kind"><option value="percent" ${c?.kind !== 'fixed' ? 'selected' : ''}>Porcentaje (%)</option><option value="fixed" ${c?.kind === 'fixed' ? 'selected' : ''}>Valor fijo (COP)</option></select></label><label class="field">Valor<input name="value" type="number" min="1" required value="${v}" placeholder="20"></label></div>
     <div class="g-row"><label class="field">Compra mínima (COP)<input name="min_cop" type="number" min="0" value="${c ? Math.round(c.min_amount_in_cents / 100) : ''}"></label><label class="field">Descuento máximo (COP)<input name="max_discount_cop" type="number" min="0" value="${c?.max_discount_in_cents ? Math.round(c.max_discount_in_cents / 100) : ''}"></label></div>
     ${prodChecks(c ? (c.product_codes || '').split(',') : [])}
     <div class="g-row"><label class="field">Empieza<input type="datetime-local" name="starts_at" value="${fromUtc(c?.starts_at)}"></label><label class="field">Termina<input type="datetime-local" name="ends_at" value="${fromUtc(c?.ends_at)}"></label></div>
     <div class="g-row"><label class="field">Usos en total (vacío = sin límite)<input name="max_redemptions" type="number" min="1" value="${c?.max_redemptions ?? ''}"></label><label class="field">Usos por persona<input name="per_contact_limit" type="number" min="1" value="${c?.per_contact_limit ?? 1}"></label></div>
     <label class="g-check"><input type="checkbox" name="first_order_only" ${+c?.first_order_only ? 'checked' : ''}> Solo para la primera compra</label>
     <label class="g-check"><input type="checkbox" name="returning_only" ${+c?.returning_only ? 'checked' : ''}> Solo para clientes que ya compraron (recompra)</label>
     <label class="g-check"><input type="checkbox" name="stackable" ${+c?.stackable ? 'checked' : ''}> Se suma a la promoción de temporada (si no, gana la mejor)</label>
     <label class="g-check"><input type="checkbox" name="active" ${!c || +c.active ? 'checked' : ''}> Activo</label>
     <p class="form-error" id="g-err" role="alert"></p><div class="a-actions"><button class="primary">${c ? 'Guardar cambios' : 'Crear cupón'}</button>${c ? '<button type="button" class="secondary" data-g-cancel>Cancelar</button>' : ''}</div></form></section>
    <section class="a-card"><h2 class="a-h"><span>Cupones</span><b>${d.coupons.length}</b></h2>${d.coupons.length ? `<div class="g-scroll"><table class="g-table"><thead><tr><th>Código</th><th>Descuento</th><th>Vigencia</th><th>Usos</th><th></th></tr></thead><tbody>${d.coupons.map(x => `<tr><td><b>${esc(x.code)}</b><br><small>${esc(x.label)}</small></td><td>${x.kind === 'percent' ? x.value + ' %' : money(x.value)}${+x.first_order_only ? '<br><small>1.ª compra</small>' : ''}${+x.returning_only ? '<br><small>recompra</small>' : ''}</td><td>${x.starts_at ? when(x.starts_at) : 'ya'} → ${x.ends_at ? when(x.ends_at) : 'sin fin'}</td><td>${x.used}${x.max_redemptions ? ' / ' + x.max_redemptions : ''}</td><td>${pill(+x.active ? 'activo' : 'apagado', +x.active ? 'on' : '')}<br><button class="g-link" data-g-edit-coupon="${x.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="a-sub">Crea tu primer cupón arriba.</p>'}</section>`;
  }
  async function saveCoupon(f) {
    const d = new FormData(f), body = {id: +f.dataset.id || 0, code: d.get('code'), label: d.get('label'), kind: d.get('kind'), value: d.get('value'), min_cop: d.get('min_cop'), max_discount_cop: d.get('max_discount_cop'), product_codes: d.getAll('product_codes'), starts_at: toUtc(d.get('starts_at')), ends_at: toUtc(d.get('ends_at')), max_redemptions: d.get('max_redemptions'), per_contact_limit: d.get('per_contact_limit'), first_order_only: d.has('first_order_only'), returning_only: d.has('returning_only'), stackable: d.has('stackable'), active: d.has('active')};
    await api('admin-coupon-save', body); editing = null; tell('Cupón guardado.'); await render();
  }

  // ---------------------------------------------------------------------------------------------- promotions
  async function promosView() {
    const d = await api('admin-promos'); products = d.products; const p = editing && editing.type === 'promo' ? editing.row : null, v = p ? (p.kind === 'fixed' ? Math.round(p.value / 100) : p.value) : '';
    return `<section class="a-card"><h2 class="a-h"><span>${p ? 'Editar temporada' : 'Nueva temporada'}</span><b>se aplica sola, sin código</b></h2><p class="a-sub">Para Día de la Madre, Amor y Amistad, Black Friday, Navidad… El precio con descuento aparece en el catálogo, en el ticket y en el pago.</p>
    <form id="g-promo" class="g-form" data-id="${p?.id || ''}">
     <label class="field">Nombre<input name="name" required maxlength="120" value="${esc(p?.name || '')}" placeholder="Mes de la madre"></label>
     <div class="g-row"><label class="field">Tipo<select name="kind"><option value="percent" ${p?.kind !== 'fixed' ? 'selected' : ''}>Porcentaje (%)</option><option value="fixed" ${p?.kind === 'fixed' ? 'selected' : ''}>Valor fijo (COP)</option></select></label><label class="field">Valor<input name="value" type="number" min="1" required value="${v}"></label></div>
     ${prodChecks(p ? (p.product_codes || '').split(',') : [])}
     <div class="g-row"><label class="field">Etiqueta corta (en las tarjetas)<input name="badge" maxlength="40" value="${esc(p?.badge || '')}" placeholder="-20%"></label><label class="field">Prioridad<input name="priority" type="number" value="${p?.priority ?? 0}"></label></div>
     <label class="field">Mensaje del banner (se muestra arriba en el estudio)<input name="banner" maxlength="200" value="${esc(p?.banner || '')}" placeholder="Mes de la madre: 20 % en todas las canciones"></label>
     <div class="g-row"><label class="field">Empieza<input type="datetime-local" name="starts_at" value="${fromUtc(p?.starts_at)}"></label><label class="field">Termina<input type="datetime-local" name="ends_at" value="${fromUtc(p?.ends_at)}"></label></div>
     <label class="g-check"><input type="checkbox" name="active" ${!p || +p.active ? 'checked' : ''}> Activa</label>
     <p class="form-error" id="g-err" role="alert"></p><div class="a-actions"><button class="primary">${p ? 'Guardar cambios' : 'Crear temporada'}</button>${p ? '<button type="button" class="secondary" data-g-cancel>Cancelar</button>' : ''}</div></form></section>
    <section class="a-card"><h2 class="a-h"><span>Temporadas</span><b>${d.promos.length}</b></h2>${d.promos.length ? `<div class="g-scroll"><table class="g-table"><tbody>${d.promos.map(x => `<tr><td><b>${esc(x.name)}</b><br><small>${esc(x.banner)}</small></td><td>${x.kind === 'percent' ? x.value + ' %' : money(x.value)}</td><td>${x.starts_at ? when(x.starts_at) : 'ya'} → ${x.ends_at ? when(x.ends_at) : 'sin fin'}</td><td>${pill(+x.active ? 'activa' : 'apagada', +x.active ? 'on' : '')}<br><button class="g-link" data-g-edit-promo="${x.id}">Editar</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="a-sub">Aún no hay temporadas.</p>'}</section>`;
  }
  async function savePromo(f) {
    const d = new FormData(f);
    await api('admin-promo-save', {id: +f.dataset.id || 0, name: d.get('name'), kind: d.get('kind'), value: d.get('value'), product_codes: d.getAll('product_codes'), badge: d.get('badge'), banner: d.get('banner'), priority: d.get('priority'), starts_at: toUtc(d.get('starts_at')), ends_at: toUtc(d.get('ends_at')), active: d.has('active')});
    editing = null; tell('Temporada guardada.'); await render();
  }

  // ---------------------------------------------------------------------------------------------- contacts
  async function contactsView() {
    const d = await api('admin-contacts', null, `&q=${encodeURIComponent(contactQuery)}&f=${contactFilter}&page=${contactPage}`), pages = Math.max(1, Math.ceil(d.total / 25));
    const flags = c => `${+c.email_optin && !c.email_unsub_at ? pill('correo ✓', 'on') : c.email_unsub_at ? pill('baja', 'bad') : pill('sin permiso')}${+c.sms_optin && !c.sms_unsub_at ? pill('SMS ✓', 'on') : ''}`;
    return `<section class="a-card"><h2 class="a-h"><span>Contactos</span><b>${num(d.total)}</b></h2>
     <form id="g-contact-search" class="g-row g-filter"><input name="q" type="search" placeholder="Buscar por nombre o correo" value="${esc(contactQuery)}"><select name="f">${[['all', 'Todos'], ['optin', 'Aceptan correo'], ['unsub', 'Se dieron de baja'], ['buyers', 'Compradores'], ['repeat', 'Recompradores'], ['leads', 'Sin comprar']].map(([k, l]) => `<option value="${k}" ${contactFilter === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="secondary">Buscar</button><a class="secondary" href="api.php?action=admin-contacts-export" download>Exportar CSV</a></form>
     <div class="g-scroll"><table class="g-table"><thead><tr><th>Persona</th><th>Permisos</th><th>Compras</th><th>Gastado</th></tr></thead><tbody>${d.contacts.map(c => `<tr class="g-click" data-g-contact="${c.id}" tabindex="0"><td><b>${esc(c.name || '—')}</b><br><small>${esc(c.email)}</small></td><td>${flags(c)}</td><td>${c.orders_paid}</td><td>${money(c.spent_in_cents)}</td></tr>`).join('')}</tbody></table></div>
     <div class="g-pager"><button class="secondary" data-g-page="-1" ${contactPage <= 0 ? 'disabled' : ''}>Anterior</button><span>${contactPage + 1} / ${pages}</span><button class="secondary" data-g-page="1" ${contactPage + 1 >= pages ? 'disabled' : ''}>Siguiente</button></div></section><div id="g-contact-detail"></div>`;
  }
  async function contactDetail(id) {
    const d = await api('admin-contact', null, '&id=' + id), c = d.contact, box = document.querySelector('#g-contact-detail');
    box.innerHTML = `<section class="a-card"><h2 class="a-h"><span>${esc(c.name || c.email)}</span><b>${esc(c.email)}</b></h2><p class="a-sub">${esc(c.phone)} · primer origen: ${esc(c.first_source || 'directo')} · creado ${when(c.created_at)}</p>
     <div class="g-kpis small"><article class="g-kpi"><small>Compras</small><b>${c.orders_paid}</b></article><article class="g-kpi"><small>Gastado</small><b>${money(c.spent_in_cents)}</b></article><article class="g-kpi"><small>Última compra</small><b>${when(c.last_order_at)}</b></article></div>
     <h3 class="g-h3">Permisos (evidencia)</h3>${d.consent.length ? `<ul class="g-list">${d.consent.map(x => `<li>${x.action === 'grant' ? 'Aceptó' : 'Retiró'} ${x.channel} · ${esc(x.source)} · ${when(x.created_at)}</li>`).join('')}</ul>` : '<p class="a-sub">Nunca dio permiso de marketing.</p>'}
     <div class="a-actions">${+c.email_optin && !c.email_unsub_at ? `<button class="secondary" data-g-optout="${c.id}:email">Quitar de correos de ofertas</button>` : ''}${+c.sms_optin && !c.sms_unsub_at ? `<button class="secondary" data-g-optout="${c.id}:sms">Quitar de SMS</button>` : ''}</div>
     <h3 class="g-h3">Pedidos</h3><ul class="g-list">${d.orders.map(o => `<li>${esc(o.reference)} · ${esc(o.product_name)} · ${money(o.amount_in_cents)}${+o.discount_in_cents ? ` (descuento ${money(o.discount_in_cents)}${o.coupon_code ? ' · ' + esc(o.coupon_code) : ''})` : ''} · ${esc(o.status)}</li>`).join('') || '<li>Sin pedidos</li>'}</ul>
     <h3 class="g-h3">Mensajes recibidos</h3><ul class="g-list">${d.messages.map(m => `<li>${esc(m.name)} · ${m.channel} · ${when(m.sent_at)}${m.opened_at ? ' · abrió' : ''}${m.clicked_at ? ' · clic' : ''}${m.converted_order_id ? ' · compró' : ''}</li>`).join('') || '<li>Ninguno</li>'}</ul></section>`;
    box.scrollIntoView({behavior: 'smooth', block: 'start'});
  }

  // ---------------------------------------------------------------------------------------------- campaigns
  const blankCamp = () => ({id: 0, name: '', channel: 'email', subject: '', preheader: '', title: '', body: '', cta_label: 'Crear mi canción', cta_path: '/', coupon_id: '', personal: {kind: 'percent', value: '', valid_days: 30}, scheduled_at: ''});
  async function campaignsView() {
    const d = await api('admin-campaigns'); coupons = d.coupons; const c = camp;
    const list = `<section class="a-card"><h2 class="a-h"><span>Campañas</span><b>${d.campaigns.length}</b></h2>${d.campaigns.length ? `<div class="g-scroll"><table class="g-table"><thead><tr><th>Campaña</th><th>Enviados</th><th>Abrieron</th><th>Clics</th><th>Pedidos</th></tr></thead><tbody>${d.campaigns.map(x => `<tr><td><b>${esc(x.name)}</b><br>${pill(x.status, x.status === 'sent' ? 'on' : '')} ${pill(x.channel)}${x.scheduled_at && x.status === 'scheduled' ? `<br><small>${when(x.scheduled_at)}</small>` : ''}${['draft', 'scheduled'].includes(x.status) ? `<br><button class="g-link" data-g-edit-camp="${x.id}">Editar</button>` : ''}${['draft', 'scheduled', 'sending'].includes(x.status) ? ` <button class="g-link" data-g-cancel-camp="${x.id}">Cancelar</button>` : ''}</td><td>${x.sent}</td><td>${x.sent ? Math.round(x.opened * 100 / x.sent) : 0} %</td><td>${x.sent ? Math.round(x.clicked * 100 / x.sent) : 0} %</td><td>${x.orders}</td></tr>`).join('')}</tbody></table></div>` : '<p class="a-sub">Aún no hay campañas.</p>'}${d.mail_ready ? '' : '<p class="a-sub g-warn">El correo (SMTP) no está configurado en el servidor: las campañas no saldrán hasta configurarlo.</p>'}</section>`;
    if (!c) return `<div class="a-actions"><button class="primary" data-g-new-camp>Nueva campaña</button></div>${list}`;
    const sms = c.channel === 'sms';
    return `<section class="a-card"><h2 class="a-h"><span>${c.id ? 'Editar campaña' : 'Nueva campaña'}</span><b>${sms ? 'SMS · driver: ' + esc(d.sms_driver) : 'correo'}</b></h2>
    <form id="g-camp" class="g-form" data-id="${c.id || ''}">
     <div class="g-row"><label class="field">Nombre interno<input name="name" required maxlength="120" value="${esc(c.name)}" placeholder="Día de la madre 2026"></label><label class="field">Canal<select name="channel"><option value="email" ${!sms ? 'selected' : ''}>Correo</option><option value="sms" ${sms ? 'selected' : ''}>SMS</option></select></label></div>
     ${sms ? '' : `<label class="field">Asunto<input name="subject" required maxlength="150" value="${esc(c.subject)}" placeholder="{nombre}, una canción para mamá"></label><label class="field">Texto de vista previa (opcional)<input name="preheader" maxlength="150" value="${esc(c.preheader)}"></label><label class="field">Título (usa *palabra* para resaltarla)<input name="title" required maxlength="150" value="${esc(c.title)}" placeholder="Para *mamá*, con música"></label>`}
     <label class="field">${sms ? 'Mensaje (máx. 300)' : 'Mensaje (separa los párrafos con una línea en blanco)'}<textarea name="body" rows="${sms ? 3 : 7}" required maxlength="${sms ? 300 : 4000}" placeholder="Hola {nombre}. Este mes…">${esc(c.body)}</textarea><small>Puedes usar <code>{nombre}</code> y <code>{cupon}</code>.</small></label>
     <div class="g-row"><label class="field">Texto del botón${sms ? ' (no se usa en SMS)' : ''}<input name="cta_label" maxlength="40" value="${esc(c.cta_label)}"></label><label class="field">Lleva a<select name="cta_path"><option value="/" ${c.cta_path === '/' ? 'selected' : ''}>Inicio del estudio</option><option value="/?ver=info" ${c.cta_path === '/?ver=info' ? 'selected' : ''}>Información y preguntas</option></select></label></div>
     <fieldset class="g-checks"><legend>Descuento</legend><label class="field">Cupón compartido<select name="coupon_id"><option value="">Sin cupón</option>${coupons.map(x => `<option value="${x.id}" ${+c.coupon_id === +x.id ? 'selected' : ''}>${esc(x.code)}${x.label ? ' · ' + esc(x.label) : ''}</option>`).join('')}</select></label>
      <div class="g-row"><label class="field">…o un código personal por cliente<select name="p_kind"><option value="percent" ${c.personal.kind !== 'fixed' ? 'selected' : ''}>% de descuento</option><option value="fixed" ${c.personal.kind === 'fixed' ? 'selected' : ''}>Valor fijo COP</option></select></label><label class="field">Valor<input name="p_value" type="number" min="0" value="${c.personal.value}" placeholder="10"></label><label class="field">Vence en (días)<input name="p_days" type="number" min="1" max="180" value="${c.personal.valid_days}"></label></div><small>El código personal es único, de un solo uso y solo funciona con el correo del cliente.</small></fieldset>
     <fieldset class="g-checks"><legend>¿A quién? <small>(solo personas que aceptaron ${sms ? 'SMS' : 'correo'} y no se dieron de baja)</small></legend>
      <div class="g-presets">${SEGMENTS.map(([k, l]) => `<button type="button" data-g-seg="${k}" class="${segKey === k ? 'on' : ''}">${l}</button>`).join('')}</div>
      <details class="g-more" ${segKey === 'custom' ? 'open' : ''}><summary>Filtros personalizados</summary><div class="g-row wrap">${RULES.map(([k, l, t]) => `<label class="field">${l}<input name="seg_${k}" type="${t}" value="${esc(segFilters[k] ?? '')}"></label>`).join('')}<label class="g-check"><input type="checkbox" name="seg_never_paid" ${segFilters.never_paid ? 'checked' : ''}> Solo quien aún no ha comprado</label></div></details>
      <p class="g-preview" id="g-preview">${preview ? `<b>${num(preview.count)}</b> personas recibirían esto.${preview.capped ? ` <span class="g-warn">${preview.capped} recibieron un mensaje hace menos de ${preview.cap_days} días.</span>` : ''}<br><small>Ejemplos: ${preview.sample.map(s => esc(s.email)).join(', ') || '—'}</small>` : 'Cuenta cuántas personas recibirán la campaña.'}</p><button type="button" class="secondary" data-g-preview>Contar audiencia</button></fieldset>
     <label class="field">Programar envío (opcional; hora local)<input type="datetime-local" name="scheduled_at" value="${fromUtc(c.scheduled_at)}"></label>
     <p class="form-error" id="g-err" role="alert"></p>
     <div class="a-actions"><button class="primary" data-g-camp-action="save">Guardar</button>${c.id ? `<button type="button" class="secondary" data-g-camp-action="test">Enviarme una prueba</button><button type="button" class="secondary g-danger" data-g-camp-action="send">Enviar ahora</button>` : ''}<button type="button" class="secondary" data-g-cancel>Cerrar</button></div>
     ${c.id ? '<p class="a-sub">«Enviar ahora» pone el mensaje en la cola de cada persona; la cola de correo lo despacha. Se puede cancelar mientras esté pendiente. Nunca se envía dos veces a la misma persona.</p>' : '<p class="a-sub">Guarda primero para poder enviar una prueba.</p>'}</form></section>${list}`;
  }
  const segFromForm = f => { const d = new FormData(f), s = {...(SEGMENTS.find(x => x[0] === segKey)?.[2] || {})}; for (const [k] of RULES) { const v = String(d.get('seg_' + k) || '').trim(); if (v !== '') s[k] = v; } if (d.has('seg_never_paid')) s.never_paid = true; return s; };
  const campBody = f => { const d = new FormData(f), pv = Number(d.get('p_value') || 0); return {id: +f.dataset.id || 0, name: d.get('name'), channel: d.get('channel'), subject: d.get('subject') || '', preheader: d.get('preheader') || '', title: d.get('title') || '', body: d.get('body'), cta_label: d.get('cta_label'), cta_path: d.get('cta_path'), coupon_id: d.get('coupon_id') || null, personal_coupon: pv > 0 ? {kind: d.get('p_kind'), value: pv, valid_days: Number(d.get('p_days') || 30)} : null, segment: segFromForm(f), scheduled_at: toUtc(d.get('scheduled_at'))}; };
  async function loadCamp(id) { const x = (await api('admin-campaigns')).campaigns.find(c => +c.id === +id); const seg = JSON.parse(x.segment || '{}'), pc = x.personal_coupon ? JSON.parse(x.personal_coupon) : null; camp = {...x, personal: pc ? {kind: pc.kind, value: pc.kind === 'fixed' ? pc.value / 100 : pc.value, valid_days: pc.valid_days} : {kind: 'percent', value: '', valid_days: 30}, coupon_id: x.coupon_id || ''}; segFilters = seg; segKey = Object.keys(seg).length ? 'custom' : 'all'; preview = null; }

  // ---------------------------------------------------------------------------------------------- automations
  async function autosView() {
    const d = await api('admin-automations'), hints = {abandoned: 'Cuando alguien guarda su historia y no paga. Es un recordatorio de SU pedido (sin descuento salvo que haya aceptado ofertas).', post_purchase: 'Después de entregar la canción: gracias + un código para la próxima. Solo a quien aceptó ofertas.', reorder: 'Pasado un tiempo desde la última compra (cumpleaños y fechas vuelven). Solo a quien aceptó ofertas.', winback: 'Clientes dormidos: pasó un año sin comprar. Solo a quien aceptó ofertas.'};
    return `<section class="a-card"><h2 class="a-h"><span>Mensajes automáticos</span><b>${d.worker ? 'cola de correo activa' : 'revisa la cola de correo'}</b></h2><p class="a-sub">Se envían solos, una vez por pedido o persona, y respetan quién se dio de baja y un descanso de varios días entre mensajes. Corren con la tarea programada <code>scripts/marketing-worker.php</code>, o con el botón de abajo.</p><div class="a-actions"><button class="secondary" data-g-run>Ejecutar ahora</button></div></section>
    ${d.automations.map(a => { const pc = a.personal_coupon ? JSON.parse(a.personal_coupon) : null; return `<section class="a-card"><form class="g-form g-auto" data-akey="${a.akey}"><h2 class="a-h"><span>${esc(a.name)}</span><b><label class="g-check"><input type="checkbox" name="enabled" ${+a.enabled ? 'checked' : ''}> Activa</label></b></h2><p class="a-sub">${hints[a.akey] || ''}</p>
      <div class="g-row"><label class="field">Se envía después de (horas)<input name="delay_hours" type="number" min="0" value="${a.delay_hours}"></label><label class="field">Texto del botón<input name="cta_label" maxlength="40" value="${esc(a.cta_label)}"></label></div>
      <label class="field">Asunto<input name="subject" required maxlength="150" value="${esc(a.subject)}"></label><label class="field">Título<input name="title" required maxlength="150" value="${esc(a.title)}"></label><label class="field">Mensaje<textarea name="body" rows="4" required maxlength="2000">${esc(a.body)}</textarea></label>
      ${a.akey === 'abandoned' ? '' : `<div class="g-row"><label class="field">Código personal<select name="p_kind"><option value="percent" ${pc?.kind !== 'fixed' ? 'selected' : ''}>% de descuento</option><option value="fixed" ${pc?.kind === 'fixed' ? 'selected' : ''}>Valor fijo COP</option></select></label><label class="field">Valor (0 = sin código)<input name="p_value" type="number" min="0" value="${pc ? (pc.kind === 'fixed' ? pc.value / 100 : pc.value) : 0}"></label><label class="field">Vence en (días)<input name="p_days" type="number" min="1" max="180" value="${pc?.valid_days || 30}"></label></div>`}
      <div class="a-actions"><button class="primary">Guardar</button></div></form></section>`; }).join('')}`;
  }

  // ---------------------------------------------------------------------------------------------- events
  root.addEventListener('click', async e => {
    const b = e.target.closest('button,tr[data-g-contact],a'); if (!b || !root.querySelector('.g-tabs')) return;
    try {
      if (b.dataset.gTab) { tab = b.dataset.gTab; editing = null; camp = null; await render(); return; }
      if (b.dataset.gDays) { days = +b.dataset.gDays; await render(); return; }
      if (b.dataset.gCancel !== undefined) { editing = null; camp = null; await render(); return; }
      if (b.dataset.gSetup !== undefined) { await api('admin-growth-setup', {}); tell('Base de datos preparada.'); await render(); return; }
      if (b.dataset.gEditCoupon) { editing = {type: 'coupon', row: coupons.find(c => +c.id === +b.dataset.gEditCoupon)}; await render(); scrollTo({top: 0, behavior: 'smooth'}); return; }
      if (b.dataset.gEditPromo) { const d = await api('admin-promos'); editing = {type: 'promo', row: d.promos.find(p => +p.id === +b.dataset.gEditPromo)}; await render(); scrollTo({top: 0, behavior: 'smooth'}); return; }
      if (b.dataset.gContact) { await contactDetail(b.dataset.gContact); return; }
      if (b.dataset.gPage) { contactPage = Math.max(0, contactPage + +b.dataset.gPage); await render(); return; }
      if (b.dataset.gOptout) { const [id, ch] = b.dataset.gOptout.split(':'); await api('admin-contact-optout', {id: +id, channel: ch}); tell('Listo: ya no recibirá ofertas por ese canal.'); await contactDetail(id); return; }
      if (b.dataset.gNewCamp !== undefined) { camp = blankCamp(); segKey = 'all'; segFilters = {}; preview = null; await render(); return; }
      if (b.dataset.gEditCamp) { await loadCamp(b.dataset.gEditCamp); await render(); return; }
      if (b.dataset.gCancelCamp) { if (confirm('¿Cancelar esta campaña? Lo que ya salió no se puede retirar.')) { await api('admin-campaign-cancel', {id: +b.dataset.gCancelCamp}); tell('Campaña cancelada.'); await render(); } return; }
      if (b.dataset.gSeg) { const f = document.querySelector('#g-camp'); camp = {...camp, ...campBody(f), personal: {kind: f.elements.p_kind.value, value: f.elements.p_value.value, valid_days: f.elements.p_days.value}, coupon_id: f.elements.coupon_id.value}; segKey = b.dataset.gSeg; segFilters = {...SEGMENTS.find(s => s[0] === segKey)[2]}; preview = null; await render(); return; }
      if (b.dataset.gPreview !== undefined) { const f = document.querySelector('#g-camp'); preview = await api('admin-segment-preview', {segment: segFromForm(f), channel: f.elements.channel.value}); document.querySelector('#g-preview').innerHTML = `<b>${num(preview.count)}</b> personas recibirían esto.${preview.capped ? ` <span class="g-warn">${preview.capped} recibieron un mensaje hace menos de ${preview.cap_days} días.</span>` : ''}<br><small>Ejemplos: ${preview.sample.map(s => esc(s.email)).join(', ') || '—'}</small>`; return; }
      if (b.dataset.gRun !== undefined) { const r = await api('admin-run-marketing', {}); tell(`Hecho. Campañas: ${r.campaigns}. Automáticos: ${Object.entries(r.automations).map(([k, v]) => k + ' ' + v).join(', ') || '—'}.`); return; }
      if (b.dataset.gCampAction) {
        const f = document.querySelector('#g-camp'), act = b.dataset.gCampAction; if (!f.reportValidity()) return;
        const saved = await api('admin-campaign-save', campBody(f)); f.dataset.id = saved.id;
        if (act === 'save') { tell('Campaña guardada.'); camp = null; await render(); }
        else if (act === 'test') { await api('admin-campaign-test', {id: saved.id}); tell('Prueba en cola: llega a tu correo en unos minutos.'); }
        else if (act === 'send') { const n = (await api('admin-segment-preview', {segment: segFromForm(f), channel: f.elements.channel.value})).count; if (!n) { tell('Nadie recibiría esta campaña: revisa la audiencia.', true); return; } if (!confirm(`Se enviará a ${n} personas. ¿Enviar ahora?`)) return; const r = await api('admin-campaign-send', {id: saved.id, confirm: true}); tell(`En cola: ${r.queued} mensajes.`); camp = null; await render(); }
      }
    } catch (error) { tell(error.message, true); }
  });
  root.addEventListener('submit', async e => {
    const f = e.target; if (!root.querySelector('.g-tabs') || !/^g-/.test(f.id || '') && !f.classList.contains('g-auto')) return; e.preventDefault();
    if (f.id === 'g-camp') return;   // its buttons handle it
    const btn = f.querySelector('button.primary'); if (btn) btn.disabled = true;
    try {
      if (f.id === 'g-coupon') await saveCoupon(f);
      else if (f.id === 'g-promo') await savePromo(f);
      else if (f.id === 'g-contact-search') { contactQuery = f.elements.q.value; contactFilter = f.elements.f.value; contactPage = 0; await render(); }
      else if (f.classList.contains('g-auto')) { const d = new FormData(f), pv = Number(d.get('p_value') || 0); await api('admin-automation-save', {akey: f.dataset.akey, enabled: d.has('enabled'), delay_hours: d.get('delay_hours'), subject: d.get('subject'), title: d.get('title'), body: d.get('body'), cta_label: d.get('cta_label'), personal_coupon: pv > 0 ? {kind: d.get('p_kind'), value: pv, valid_days: Number(d.get('p_days') || 30)} : null}); tell('Automatización guardada.'); }
    } catch (error) { const el = document.querySelector('#g-err'); if (el) el.textContent = error.message; else tell(error.message, true); } finally { if (btn) btn.disabled = false; }
  });
  root.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches?.('tr[data-g-contact]')) e.target.click(); });
  return {render};
}
