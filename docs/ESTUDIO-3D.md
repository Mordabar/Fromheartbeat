# Estudio 3D: sesión, pago y legibilidad (ronda de octubre)

## Qué cambió
| Antes | Ahora |
|---|---|
| Las etiquetas de la consola de géneros («Latino», «Pop / Rock»…) iban sueltas sobre el escenario y se perdían en escritorio | Cada etiqueta va sobre su propia placa oscura, con borde del color del banco; los nombres de los pads llevan contorno oscuro |
| Tocar la **caja** de una experiencia sólo la agrandaba; tocar el **botón** sólo la elegía | Caja y botón hacen lo mismo: **elegir y agrandar** |
| «Creación digital con IA» en Dedicatoria, FAQ, legales y correos | Sin ninguna mención. Dedicatoria: «Grabada por artistas» |
| El pago te sacaba del sitio hacia Wompi | El pago se abre **en una ventana segura sobre el mismo estudio** (widget de Wompi). Si el script de Wompi no carga, usa el pago a pantalla completa como respaldo |
| El resumen del pedido se editaba con botones «Cambiar» en el panel de texto | El **ticket 3D** es el editor: cada línea (género, emoción, voz, para quién, experiencia) se toca para cambiarla y vuelve al pago |
| «Mi sesión» era un panel de texto | **Sala de sesión 3D** en el centro del estudio (ver abajo) |

## La sala de sesión
Al entrar a una sesión, la cámara vuela al centro del estudio y se levanta una sala alrededor del visitante:
- **Frente:** monitor con el estado, **consola de 6 canales** (LEDs y faders reales que suben según la etapa; tocar un canal explica esa etapa) y el **pad de material** (sube fotos, videos y audios; muestra el progreso de la subida en vivo).
- **Izquierda:** el **disco** de tu canción (toca para escuchar, gira con la música) y el tablero «Tu entrega» con cada archivo descargable.
- **Derecha:** la **pared de mensajes** con la conversación y el aviso «NUEVO».
- Abajo, cuatro iconos mueven la cámara entre los rincones y un botón principal propone lo siguiente (pagar, escuchar, subir material, escribir).
- Lo que necesita teclado (escribir, elegir archivos) se abre en un panel pequeño, **sólo para eso**, y se cierra con «Volver a la sala». «Ver todo en texto» ofrece la sesión completa como alternativa accesible (y es lo que ve quien use el modo ligero sin 3D).

## Archivos nuevos o cambiados
`assets/st-cockpit.js` (sala), `assets/st-products.js`, `assets/st-mood.js` (ticket), `assets/st-kit.js`, `assets/pads.js`, `assets/st-console.js`, `assets/studio.js`, `assets/stations.js`, `assets/app.js`, `assets/session-ui.js`, `assets/uploader.js`, `assets/session-ui.css`, `assets/studio.css`, `assets/content.js`, `private/catalog.php`, `private/domain.php`, `private/mail.php`, `.htaccess` (política de seguridad para el widget de Wompi).

## Importante al subir
- **`.htaccess`** cambia: permite `https://checkout.wompi.co` (script y marco) y `https://*.wompi.co` (conexiones). Sin ese cambio el widget no carga y el pago usa el respaldo de pantalla completa.
- Los textos legales (términos y privacidad) se editaron sólo para quitar la mención a IA; conviene que los revise quien responda por ellos.

## Pruebas
```
FHB_EXTRA_ENV=$'WOMPI_PUBLIC_KEY=pub_test_abc123\nWOMPI_INTEGRITY_SECRET=test_integrity_abc123' bash tests/support/serve.sh
BASE_URL=http://127.0.0.1:8199 node tests/e2e-room.mjs desktop     # 23 comprobaciones: sala, disco, mensajes, material, pago, ticket, experiencias
BASE_URL=http://127.0.0.1:8199 node tests/e2e-room.mjs mobile
BASE_URL=http://127.0.0.1:8199 node tests/shot-3d.mjs session      # capturas de cada rincón (escritorio y móvil)
```

## Límites honestos
- **El widget real de Wompi no pude abrirlo** (el entorno de pruebas no llega a checkout.wompi.co). Verifiqué que la página lo carga con la firma y el monto correctos usando un widget de prueba, que la política de seguridad lo permite y que el respaldo funciona. Hay que probar un pago de sandbox de punta a punta.
- La sala se probó con un Chromium con render por software; en teléfonos reales la fluidez dependerá del equipo (hay modo ligero).
