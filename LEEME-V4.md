# Fromheartbeat · Estudio inmersivo V4

## Experiencia
El estudio ocupa toda la pantalla. Se navega tocando objetos, puntos de acceso o la barra inferior. Arrastrar cambia la mirada; rueda o pellizco acercan la cámara. Los textos y formularios se abren en ventanas con cerrar, Escape y ampliar. El borrador se conserva durante la sesión del navegador.

- Consola: género. Logo/luz: emoción. Cabina: voz, idioma y ritmo.
- Lounge: historia, destinatario y ocasión.
- Expositores: paquetes y compra. Se mantienen los productos y precios originales.
- Discos: catálogo con búsqueda, portadas y reproductor persistente, anterior/siguiente, progreso y volumen en escritorio. La pared muestra las primeras seis canciones publicadas según su orden; la colección contiene todas.
- Terminal / Mi sesión: pedidos autorizados en ese navegador y recuperación por correo. El acceso del cliente continúa usando enlaces privados; no se añadió un registro con contraseña.
- Mi sesión: estados y etapas de producción, notas visibles, reproducción de todas las versiones de audio, descarga y comentarios al estudio. Las versiones se muestran por archivo; usa nombres como Cancion-v1.mp3 y Cancion-v2.mp3.
- Admin (`admin.html`): pedidos, transiciones válidas de estado, etapas, notas, subida de entregables y catálogo público. Audio MP3/WAV hasta 50 MB, portada JPG/PNG/WebP hasta 5 MB. Se puede editar, ordenar, publicar u ocultar. Ocultar retira la canción del catálogo; no es una revocación de copias ya descargadas.

## Actualizar el hosting actual
1. Respalda el sitio y su base de datos.
2. Sube los archivos de esta versión conservando `private/config/.env`, `private/storage/` y la base de datos existentes. El paquete no incluye credenciales, sesiones ni entregas privadas del ZIP original.
3. El catálogo se guarda automáticamente en `private/storage/music.json`. PHP debe poder escribir en ese directorio. No reemplaces ese archivo con una copia antigua en actualizaciones futuras.
4. Conserva las rutas y el dominio actuales. PHP 8.1 o superior, PDO MySQL, mbstring, fileinfo, cURL, sesiones y OpenSSL. Apache debe aplicar `.htaccess`; `private`, `scripts`, `database` y `tests` no deben ser públicos. En Nginx configura explícitamente la denegación equivalente antes de publicar.
5. Revisa el límite efectivo del hosting: `upload_max_filesize=50M`, `post_max_size=58M`. La configuración de servidor puede prevalecer sobre `.user.ini`.
6. Inicia sesión en `admin.html` con el administrador existente. No se cambia ninguna contraseña.

## Instalación nueva
Copia `private/config/.env.example` a `.env` y completa los datos del servidor. Usa una APP_KEY aleatoria de 32 bytes o más. Importa `database/schema.sql` solamente en una base nueva. Crea el administrador desde terminal con `scripts/create-admin.php`: recibe el correo como argumento y una contraseña de al menos 12 caracteres por entrada estándar (no por argumento). Elimina inmediatamente el archivo temporal que uses para la contraseña.

Los pedidos, sesiones privadas, comentarios, pagos y estados requieren la base MySQL. El catálogo público utiliza almacenamiento del servidor; nunca localStorage como sustituto del administrador.

## Correo y pagos
Se mantiene la integración Wompi existente: el administrador no puede marcar un pedido como pagado. El pago se confirma mediante la API y webhook verificado. Para operar en vivo configura APP_ENV=production, APP_URL con HTTPS, SESSION_SECURE=true, datos legales, SMTP y las claves Wompi de producción. No marques COMMERCE_READY=true hasta comprobar el recorrido de compra en sandbox y el webhook.

El código original encola las notificaciones. Si el hosting ya tiene un proceso que envía `mail_queue`, mantenlo y NO actives otro. Para una instalación nueva se incluye `scripts/mail-worker.php`, exclusivo de terminal. Configura `MAIL_WORKER_ENABLED=true` y `MAIL_WORKER_SINCE` con la fecha/hora UTC de activación (`AAAA-MM-DD HH:MM:SS`) para no reenviar una cola histórica. Programa su ejecución cada minuto. Crea su propia tabla `fhb_mail_dispatch`; permite cinco intentos. Comprueba permisos de base de datos y entrega real del correo. Como cualquier envío SMTP sin deduplicación del proveedor, una interrupción justo después del envío puede causar una repetición.

## Verificación realizada
- Flujo DOM en 390 y 1440 px: selección, borrador, legales, consentimiento, ventanas y paquetes.
- 63 pruebas de cámara, 28 de volumen visible y 12 encuadres móviles de paquetes.
- Construcción real de geometría Three.js, logo, portadas y objetivos de interacción.
- Gestos de clic, arrastre, pellizco, cancelación y límites de zoom.
- Renderizado WebGL y capturas en escritorio y móvil; ventanas abrir/cerrar y consola JS sin errores en la revisión.
- Administrador en navegador: navegación, formulario multipart de audio/portada y edición, con API simulada.
- Revisión sintáctica de JavaScript y PHP.

No se ejecutó PHP/MySQL en este entorno. La vista previa usa respuestas de prueba y no procesa compras. La persistencia del catálogo, inicio de sesión real, comentarios, correo, aislamiento de pedidos y Wompi requieren prueba de integración en el hosting. No se publicó ni se realizó ningún cobro o envío de correo.

## Prueba de aceptación antes de vender
1. Crear y recuperar un pedido de prueba; otro navegador sin su enlace no debe poder consultar ni descargar sus archivos.
2. Completar un pago sandbox, confirmar webhook y verificar que no crea pedidos ni cobros duplicados al recargar.
3. Admin: pasar a producción y revisión; subir dos versiones, verificar ambas desde el cliente y enviar un comentario.
4. Publicar una canción con portada; comprobar búsqueda/reproducción; ocultarla y comprobar que desaparece de la colección tras recargar.
5. Probar recuperación y notificación por correo, y comprobar que las notas internas no se envían.
6. Marcar completado solamente con los entregables exigidos por el paquete.
