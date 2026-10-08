# Crecimiento: marketing, descuentos, analítica y recompra

La tienda deja de ser solo un flujo de compra y pasa a tener una base para **atraer, medir, descontar y recomprar**. Todo vive en el mismo proyecto (PHP + MySQL), sin servicios de pago obligatorios.

## Qué hay
| Pieza | Para qué | Dónde |
|---|---|---|
| **Contactos** | Una persona = un correo, sin importar cuántos pedidos haga. Guarda permisos, compras, gasto, origen. | `contacts`, `private/growth.php` |
| **Consentimientos** | Prueba de quién aceptó recibir ofertas, cuándo y dónde (correo y SMS por separado). | `consent_log` |
| **Temporadas** | Descuento automático por fechas (Madre, Amor y Amistad, Black Friday…). Cambia el precio en el estudio 3D, la lista, el ticket y el pago. Con banner. | `promotions`, panel → Temporadas |
| **Cupones** | Códigos con reglas: %, valor fijo, mínimo, tope, productos, vigencia, usos totales y por persona, solo primera compra, solo recompra, acumulable. Y **códigos personales** (uno por cliente, un solo uso). | `coupons`, `coupon_redemptions` |
| **Analítica propia** | Visitas, UTM, embudo (visita → elige → pago → pedido → compra), origen de cada venta, recompra, valor por cliente. | `events`, `assets/track.js`, panel → Resumen |
| **Campañas** | Correo y SMS a segmentos, programables, con prueba, conteo de audiencia y resultados (aperturas, clics, pedidos e ingresos atribuidos). | `campaigns`, `campaign_sends`, `private/marketing.php` |
| **Automatizaciones** | Pedido sin pagar, gracias + código tras entregar, recompra pasado un tiempo, reactivación de dormidos. Apagadas por defecto. | `automations`, `scripts/marketing-worker.php` |
| **Baja con un clic** | Enlace en cada correo y cabecera `List-Unsubscribe` (RFC 8058). | `baja.php` |
| **SMS** | Canal abstracto: modo `log` (solo anota) o `twilio`. Agregar otro proveedor es una función. | `smsFlush()` |

## Cómo se decide un precio (a prueba de manipulación)
El navegador **solo envía el código del producto y, si quiere, un cupón**. `priceQuote()` calcula: precio de lista → mejor entre temporada y cupón (o ambos si el cupón es «acumulable») → piso de 1.000 COP. Ese total es el `amount_in_cents` del pedido; Wompi cobra ese importe y lo vuelve a verificar contra el pago. El uso de un cupón se **reserva** al crear el pedido (con el cupón bloqueado en la transacción) y pasa a «aplicado» cuando el pago se aprueba; un pedido cancelado lo libera.
Los productos para empresas no llevan cupones (su precio se acuerda en la propuesta).

## Permisos y ley (Colombia: Ley 1581 de 2012 y Decreto 1377 de 2013)
- Las casillas «ofertas por correo» y «por SMS» van **sin marcar**, son opcionales y separadas de los términos.
- Cada aceptación o retiro queda registrado (canal, origen, versión del texto, huella de IP sin guardar la IP).
- Un mensaje promocional **solo** sale a quien aceptó en ese canal y no se dio de baja; lleva identidad del remitente (razón social, NIT, dirección de `.env`) y baja visible.
- Los avisos del pedido (pago, entrega, recordatorio de **su** pedido) son de servicio y no dependen del permiso; pero quien se dio de baja de todo no recibe ni recordatorios promocionales.
- La analítica es propia, sin cookies de terceros, sin IP, sin datos personales; respeta «No rastrear» y «Global Privacy Control».
- **Pendiente para quien responda legalmente:** actualizar la política de privacidad (finalidades de marketing y analítica, plazo de conservación, canal para ejercer derechos) y el aviso en el sitio. Este documento no es asesoría legal.

## Puesta en marcha
1. Sube los archivos. La **primera visita** crea las tablas nuevas sola (hace falta que el usuario de MySQL pueda `CREATE`/`ALTER`; si no puede, el panel → Resumen muestra el error y un botón «Preparar la base de datos»). Nada se borra ni se cambia de lo que ya existe.
2. Correo: define `MAIL_TRANSPORT=smtp` y tu SMTP (ya lo usan los correos del pedido) y activa `scripts/mail-worker.php` si no tienes otro procesador.
3. Tarea programada cada 10–15 min: `php scripts/marketing-worker.php` (encola campañas programadas, corre automatizaciones y envía SMS). Si no puedes programar tareas, usa el botón «Ejecutar ahora» en Automatizaciones.
4. Datos legales en `.env`: `LEGAL_NAME`, `LEGAL_TAX_ID`, `LEGAL_ADDRESS`, `SUPPORT_EMAIL` (salen en el pie de cada promoción).
5. Opcional: `MARKETING_CAP_DAYS` (descanso entre mensajes promocionales, 3 por defecto), `SMS_DRIVER=twilio` con `TWILIO_SID`, `TWILIO_TOKEN`, `TWILIO_FROM`.

## Cómo usarlo
- **Una temporada:** Crecimiento → Temporadas → nombre, %, fechas, etiqueta («-20%») y banner. Se enciende y apaga sola por fecha.
- **Un cupón:** Cupones → código, valor y reglas. Para influencers: límite de usos y vigencia. Para clientes: «solo recompra».
- **Una campaña:** Campañas → Nueva. Audiencia por preset (compraron 1 vez, dormidos, sin comprar…) o filtros; «Contar audiencia» antes de enviar; «Enviarme una prueba»; «Enviar ahora» o programar. El código personal se crea por cliente y solo sirve con su correo.
- **Medir un anuncio:** enlaza con `?utm_source=instagram&utm_medium=social&utm_campaign=nombre`. Resumen → «De dónde vienen las ventas».
- **Recompra:** activa «Gracias y segunda canción» y «Recompra» (con su código personal). El resumen muestra la tasa de recompra y el valor por cliente.

## Decisiones que conviene revisar
- **Atribución:** última interacción (el origen de la visita que terminó en compra); el primer origen también se guarda.
- **Aperturas:** el píxel subestima (bloqueo de imágenes) y Apple Mail Privacy lo infla; los **clics y pedidos** son la cifra confiable.
- **SMS:** requiere proveedor, remitente aprobado y un texto de consentimiento propio; sin `twilio` solo se registra lo que se enviaría.
- **Descuentos y WhatsApp/Meta/Google:** no hay píxeles de terceros. Si se agregan (Meta Pixel, GA4), deben depender del consentimiento y enviarse también desde el servidor; la tabla `events` es la base.

## Hoja de ruta sugerida (la estructura ya lo soporta)
1. **Fecha especial por canción** (cumpleaños de mamá): guardarla en el brief y disparar «¿otra canción este año?» 3 semanas antes, con su cupón.
2. **Programa de referidos** (código por cliente: ambos reciben descuento) usando `coupons.contact_id` y `source='referral'`.
3. **Tarjetas de regalo / monedero** (saldo por contacto).
4. **WhatsApp Business** como canal en `smsFlush()` (misma tabla de salida y de consentimientos).
5. **Reseñas y UGC** tras la entrega (automatización `post_purchase` con enlace).
6. **Pruebas A/B de asunto**, segmentos por RFM y cohortes de recompra en el Resumen.
7. **Conversiones del lado del servidor** hacia Meta/Google con el evento `purchase` ya guardado.

## Archivos
Nuevos: `private/growth.php`, `private/marketing.php`, `private/growth-api.php`, `baja.php`, `scripts/marketing-worker.php`, `assets/track.js`, `assets/admin-growth.js`, `assets/admin-growth.css`, `docs/MARKETING.md`, `tests/growth.php`, `tests/growth-api.py`, `tests/e2e-growth.mjs`, `tests/support/seed-growth.py`.
Cambiados: `api.php`, `private/bootstrap.php`, `private/domain.php` (precio del servidor, contacto, consentimiento, ganchos de pago), `private/mail.php` (pie y cabeceras de promoción), `assets/app.js`, `assets/content.js`, `assets/st-mood.js` (ticket con descuento), `assets/st-products.js` (precio tachado), `assets/admin.js`, `admin.html`, `index.html`, `assets/studio.css`.
