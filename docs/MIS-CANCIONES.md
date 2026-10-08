# Mis canciones: todas las sesiones de un cliente bajo su correo

## El problema
Cada pedido tenía su propio enlace y la sesión no se unía al correo del cliente: para ver cada canción había que abrir cada correo por separado, y se perdía la experiencia de posventa.

## Qué hace ahora
- **Abrir cualquier enlace privado abre toda la colección de ese correo.** Al validar el enlace (`exchange`), el navegador queda autorizado para el correo del pedido (en minúsculas) y puede abrir todos los pedidos de esa dirección que no hayan vencido. El enlace sigue siendo el único «llave»: no hay cuentas ni contraseñas.
- **Con 2 o más pedidos** el enlace aterriza en **«Mis canciones»**: una pared de vinilos en 3D (portada de cada canción o una etiqueta con la inicial de quien la recibe, un anillo del color de su estado, «Para Mamá · Lista para escuchar»). Se toca un disco y se entra a su sesión. Con más de 6 canciones hay «Anteriores / Siguientes». El disco del enlace abierto brilla.
- **Con un solo pedido** se entra directo a la sesión, como antes.
- **«Mi sesión»** (cabecera o menú) abre la colección; si no hay nada en el navegador muestra la sala vacía y el formulario «Recibir mi enlace por correo».
- **Recibir mi enlace** (`recover`): ahora llega **un solo correo** con el enlace del pedido más reciente y la lista de pedidos activos; ese enlace abre toda la colección.
- Desde una sesión, la flecha de la barra inferior vuelve a «Mis canciones».
- La versión de texto lista las mismas canciones.

## Compartir sin abrir tu colección: enlace de regalo
Como el enlace privado ahora abre *todas* las canciones del correo, reenviarlo a otra persona le mostraría todo. Por eso existe el **enlace de regalo**:
- El comprador toca **Compartir** (disco 3D, panel de texto o botón en la sala) y se copia (o se comparte desde el teléfono) un enlace de **solo lectura de esa canción**.
- Quien lo abre ve la canción, para quién es y quién la regala (solo el nombre de pila), puede escucharla y descargar los archivos de **entrega**. No ve correo, teléfono, pagos, historial, archivos privados del cliente, ni las otras canciones; no puede escribir, subir, pagar ni compartir.
- Secreto distinto del enlace privado (un HMAC propio por pedido); uno no sirve como el otro. Solo se puede crear cuando la canción está en revisión o entregada.
- El correo «Recibir mi enlace» recuerda no compartir el enlace privado y usar «Compartir».

## Seguridad (qué se garantiza y cómo se prueba)
- Nunca se autoriza un correo por escribirlo en el formulario de compra: solo por **abrir un enlace enviado a ese correo** (prueba de acceso al buzón).
- `tests/sessions-email.py` (27 comprobaciones): aislamiento entre correos, mayúsculas, vencimiento, regalo de solo lectura, que el regalo no escala, `recover` con un solo correo y respuesta idéntica para correos desconocidos.
- Los pedidos vencidos (`LINK_DAYS`, 365 por defecto) salen de la colección.

## Entrega y sala (mismo trabajo)
- **Entrega 3D**: portada con vista previa, «N archivos para descargar» y una tarjeta por archivo («Canción · MP3 — Para escuchar y compartir», «Master · WAV», «Portada», «Video») con botón **Descargar** y el tamaño.
- **Barra inferior con etiquetas** en la sesión: Estado · Canción · Mensajes · Material, con insignias (mensajes sin leer, material que falta).
- **Mensajes y Subir material** tienen botón propio a la vista en la sala principal.
- **Versión de texto** rediseñada como app: una tarjeta con la acción principal, cuatro accesos grandes (Escuchar, Mensajes, Material, Compartir), descargas en tarjetas y avance compacto. Botones con color y brillo, opciones táctiles más claras.

## Importante al subir
- `.htaccess`: solo se añade compresión (mod_deflate) para html/css/js/json/svg/ttf. Nada más cambia.
- Nuevos en `assets/`: `boot.js` (script clásico: dice «Abriendo tus canciones…» mientras carga el enlace; `index.html` lo llama antes del módulo) y `fonts/*.woff2` (las dos tipografías en woff2, ~110 KB en vez de 1,3 MB; el TTF queda de respaldo).
- Sin cambios de base de datos.

## Seguridad y UX: rondas de auditoría
Dos árbitros adversariales revisaron el trabajo (seguridad y UX/3D mobile-first). Lo corregido: un invitado de regalo con un correo propio concedido podía leer el pedido del comprador (ahora la propiedad se comprueba por pedido); pedidos sin pagar de un tercero con tu correo ya no ensucian tu colección ni el correo de recuperación; «Salir de este dispositivo»; chip y filas de descarga del 3D; panel «Tu entrega» con tarjetas grandes; «Mi sesión» consulta al servidor antes de decidir; teclado/lector limitado a la sala activa; tap fantasma que subía el teclado; mensajes del 3D medidos para no desbordar; etiquetas de la biblioteca con elipsis; botón del HUD sin recortes.
Pendiente / decisión de negocio: el enlace de regalo no se puede revocar y permite descargar también el WAV y el video de la entrega; aviso de tiempos en `recover` (límite 3/h por IP); rótulos truncados del asistente y orientación horizontal en teléfonos.

## Archivos
Nuevos: `assets/st-library.js`, `docs/MIS-CANCIONES.md`, `tests/sessions-email.py`, `tests/e2e-library.mjs`, `tests/e2e-share.mjs`, `tests/support/seed-library.sh`, `tests/shot-*.mjs`.
Cambiados: `.htaccess`, `index.html`, `assets/style.css`, `assets/uploader.js`, `api.php`, `private/domain.php`, `private/mail.php`, `assets/app.js`, `assets/session-ui.js`, `assets/session-ui.css`, `assets/studio.css`, `assets/studio.js`, `assets/stations.js`, `assets/st-cockpit.js`, `assets/st-rooms.js`, `tests/e2e-room.mjs`, `tests/e2e-secondary.mjs`.
No hay cambios de base de datos ni de `.htaccess`.
