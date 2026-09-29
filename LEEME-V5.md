# Fromheartbeat · Estudio V5 — el 3D es la interfaz

## Qué cambió respecto a la V4

| Lo que pediste | Cómo quedó |
|---|---|
| El giro era inexacto y sin límites | El arrastre es **1:1 con el dedo**: 1 px de dedo = 1 px de escena, calculado con el campo de visión (móvil y escritorio por igual). Un arrastre de 300 px gira ~17°, no 180°. Cada estación tiene **tope de giro** (±28° en la mayoría, ±75° en el lobby) con retorno elástico, inercia corta y pellizco/rueda acotados (×0,86 – ×1,4). Flechas del teclado giran 5°; `Inicio` centra. |
| Textos flotantes sobre el 3D | **Ya no hay etiquetas flotantes.** Las opciones son objetos del estudio con el nombre grabado. |
| Género sin iconos representativos | 43 géneros con **iconos vectoriales propios** (maracas, acordeón, sombrero, disco-bola, saxo…), sin emojis (que cambian según el dispositivo). También emociones, voces, ritmos, ocasiones y paquetes. |
| El modal tapaba el 3D | Elegir opciones **no abre ningún modal**. Solo los formularios (historia, datos y pago) usan un cajón lateral (escritorio) o inferior (móvil) que **no es modal**: el estudio sigue vivo y la cámara re-encuadra en el espacio libre. |
| Estudio pequeño | Sala de radio 34 (antes 16), con entorno PBR para reflejos reales y ocho estaciones que no se solapan. |
| Paquetes: un popup con las 3 juntas | Cada tarjeta lleva **su contenido dentro del 3D**: cara (nombre, precio, ventajas) + panel «Qué incluye» + botón 3D «Elegir». En escritorio se ven las tres a la vez; en móvil es un carrusel con flechas. Botón **«Ver en texto plano»** en la barra inferior. |
| Lobby con caja flotante | Los botones **CREAR** y **ESCUCHAR** son dos botones físicos del escenario, bajo el logo gigante y la marquesina de neón. |
| Emoción cambia el color | Se mantiene y ahora protagoniza: 12 esferas de luz en halo alrededor del logo; la elegida tiñe toda la sala. |
| Mobile-first | Todo se diseñó y probó primero en 390×844 (retrato, pulgar, área segura); escritorio se adapta. |

## Cómo se recorre

1. **Lobby**: toca `CREAR` (o el botón «Escuchar»). Arrastra para mirar; los límites evitan perderse.
2. **Consola** (género): 6 bancos (Latino, Pop/Rock, Urbano, Electro, Raíces, Libre) y hasta 12 pads por banco. La pantalla superior explica el estilo elegido.
3. **Halo de luz** (emoción): la placa a pie de escenario lee la emoción y todo el estudio cambia de color.
4. **Cabina** (voz, idioma y ritmo).
5. **Lounge** (historia): el cajón contiene el formulario; la **placa 3D escribe en vivo** lo que tecleas, con un medidor del mínimo de caracteres.
6. **Experiencias** (paquetes) y **Pago**: un **ticket 3D** resume el pedido junto al formulario.
7. Barra inferior: `←` atrás · `Siguiente` · `≡` ver este paso en **texto plano** (mismas opciones en formulario; queda activo de paso en paso hasta que lo cierres).

Rincones: **Vinilos** (canciones reales con portada; el tocadiscos gira mientras suena), **Mi sesión** (terminal), **Información** (menú ☰ → «Información, términos y privacidad»).

## Actualizar el hosting (importante)

1. Respalda el sitio y la base de datos.
2. Sube **todo el contenido del ZIP dentro de `public_html/`**, incluidas las carpetas **`assets/vendor/` (three.js) y `private/vendor/` (PHPMailer)**. Sin `assets/vendor/` no carga nada (lo aprendimos): si tu herramienta de subida ignora carpetas `vendor`, sube esas dos a mano.
3. **No sobrescribas**: `private/config/.env`, `private/storage/` (contiene `music.json`, el catálogo que administras desde `admin.html`) ni la carpeta `assets/audio/` si ya la tienes.
4. Purga la caché (hPanel → Rendimiento → Caché, o desde el conector de Hostinger) y recarga con `Ctrl+Shift+R`. Si el CDN guardó un 404 antiguo verás el sitio intermitente.
5. `.env` de producción: `APP_ENV=production`, `APP_URL=https://…`, `SESSION_SECURE=true`, `COMMERCE_READY=false` hasta terminar el ensayo Wompi (ver `LEEME-V4.md`). No se tocó backend, pagos ni correo.

## Estructura del código (`assets/`)

| Archivo | Qué hace |
|---|---|
| `studio.js` | Renderer, cámara con «planos» calculados por encuadre, picking, bucle de animación |
| `camera-rig.js` | Control de mirada (matemática pura, con pruebas): sensibilidad, inercia, límites |
| `spatial-controls.js` | Gestos: toque vs. arrastre vs. pellizco |
| `world.js` | Sala, luces, entorno PBR, escenario, logo, botones REC/PLAY, marquesina |
| `st-*.js` | Estaciones: `console` (género), `mood` (emoción + ticket), `voice`, `lounge`, `products`, `records`, `rooms` (sesión e información) |
| `pads.js`, `st-kit.js` | Componentes reutilizables: tablero de pads, perillas, pantallas, botones píldora |
| `icons.js` | Librería de iconos vectoriales (canvas y SVG) y mapa opción → icono |
| `content.js` | Textos de géneros/emociones/voces/ocasiones y colores por banco |
| `app.js` | Flujo, borrador, HUD, cajón, API, pagos y reproductor |
| `studio.css` | HUD y cajón (mobile-first) |

### Cambiar cosas
* **Géneros / emociones / voces / idiomas / ritmos**: vienen de `private/catalog.php` (`briefOptions()`); un género nuevo necesita su icono en `icons.js` (`GENRE_ICON`) y su descripción en `content.js` (`GENRE_INFO`). Si falta el icono se muestra un destello.
* **Colores por banco**: `BANK_COLOR` en `content.js`.
* **Precios y contenido de paquetes**: `catalog()` en `private/catalog.php` (el 3D lo lee de ahí).
* **Iconos**: cada uno es una lista de trazos SVG en cuadrícula 24×24 en `icons.js`.

## Pruebas

```
cd tests && npm install
node check-rig.mjs                      # cámara: matemática exacta (sin navegador)
BASE_URL=http://127.0.0.1:8090 npm run e2e   # recorrido real en Chromium (móvil y escritorio)
node e2e-flow.mjs desktop               # o solo un modo
```
Sirve el sitio con `php -S 127.0.0.1:8090 -t .` (necesita `private/config/.env` local). Las pruebas tocan los objetos 3D como un dedo; el servidor de pedidos se simula: **nunca se cobra ni se envía correo**.

## Modo ligero y accesibilidad

* Sin WebGL, con «ahorro de datos» o con el botón «Usar modo ligero» del menú se usan los formularios de siempre (cajón siempre abierto).
* El botón «Ver en texto plano» ofrece cada paso como formulario accesible; los cambios se reflejan en el 3D y viceversa.
* Cada selección se anuncia por una región `aria-live`. Navegación por teclado: `Tab`, flechas para mirar, `Inicio` para centrar, `Esc` cierra el cajón.
* Respeta `prefers-reduced-motion`.

## Límites conocidos

* No se ejecutó PHP + MySQL + Wompi + SMTP reales en el entorno de desarrollo: los pedidos, el pago, el correo y la persistencia del catálogo deben probarse en el hosting (ver «Prueba de aceptación» de `LEEME-V4.md`).
* El aspecto se validó con WebGL por software; el rendimiento en dispositivos concretos conviene revisarlo en un teléfono real.
