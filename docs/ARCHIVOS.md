# Archivos de la sesión: enviar y recibir

## Qué cambió
| Antes (v51) | Ahora |
|---|---|
| Un archivo a la vez, máximo 50 MB | **Varios a la vez**, hasta 1 GB cada uno (configurable) y 4 GB por sesión |
| MP3, WAV, JPG, PNG, WebP, MP4 | + HEIC (iPhone), AVIF, GIF, MOV, WebM, 3GP, M4A, AAC, OGG, FLAC, AIFF, PDF, TXT (y ZIP sólo para el estudio) |
| Sólo el cliente de Full Experience podía enviar | Cualquier sesión con el pago confirmado puede enviar material (cada producto con su texto) |
| Subida en un solo POST: se cortaba con redes malas | **Por fragmentos de 4 MB**, con reintentos y reanudación; no depende de `upload_max_filesize` ni de `post_max_size` |
| Sin compresión | **Compresión en el dispositivo** (ver abajo) |
| El admin subía de a un archivo | El admin arrastra **todos los entregables juntos**; se reconocen por contenido y una lista de verificación dice qué falta |
| La entrega final exigía pasar por «revisión» | Nuevo botón **«Entregar ahora, sin revisión»** (etapa Entrega) |

## Compresión en el dispositivo del cliente
El hosting no tiene ffmpeg ni permite ejecutar programas, así que todo se hace en el navegador del cliente **antes** de subir:
- **Fotos:** se reducen (lado largo 1920/2560 px) y se guardan como WebP o JPEG; de paso se elimina la ubicación GPS.
- **Videos:** se re-codifican a **MP4 H.264 + AAC** (1280 o 1920 px, 30 fps) con WebCodecs. Si el dispositivo no puede H.264, usa VP9 dentro de MP4; si tampoco puede, sube el original.
- **WAV (16 bits):** se convierte a MP3 (128/192 kbps). Otros audios (M4A, MP3, FLAC…) se envían tal cual.
- El cliente elige **Ligero · Equilibrado · Sin cambios**. Si el resultado no pesa claramente menos que el original (menos del 85–92 %), se envía el original.
- **Los archivos del estudio nunca se comprimen**: el WAV master sigue siendo WAV.
- Las librerías se cargan sólo cuando hacen falta: `assets/vendor/mediabunny.min.js` (MPL-2.0) y `assets/vendor/lame.min.js` (LGPL-3.0, sin modificar). Licencias en `assets/vendor/LICENSES.txt`.

## Cómo funciona la subida por fragmentos
`upload-init` → varios `upload-chunk` (cuerpo binario) → `upload-finish`. Todo queda en `private/storage/incoming/` (`.part` + `.json`) hasta completarse; lo abandonado (12 h sin fragmentos nuevos) se limpia solo. El tipo real se decide por los **primeros bytes** del archivo, no por la extensión. Al terminar una tanda del cliente, `upload-done` marca la sesión «por atender» y envía **un solo** aviso al equipo (máx. uno cada 15 min).
No hay tablas nuevas: no hay que tocar la base de datos.

## Variables opcionales del `.env`
`UPLOAD_MAX_FILE_MB` (1024), `UPLOAD_MAX_ORDER_MB` (4096), `UPLOAD_MAX_FILES` (120). Cada fragmento pesa 4 MB, así que `post_max_size=58M` sobra.
Los cupos son **por tipo**: lo que sube el cliente nunca le quita espacio a la entrega del estudio. La extensión del archivo guardado siempre sale del contenido detectado (un JPEG llamado `x.bat` queda `x.bat.jpg`).
**Recomendado:** si puedes, define `STORAGE_PATH` en el `.env` con una carpeta FUERA de `public_html` para que los archivos nunca sean alcanzables por la web (hoy `private/` está protegida por `.htaccess`).
**Espacio:** revisa el almacenamiento de tu plan: 4 GB por sesión pueden llenarlo rápido si hay muchas sesiones Full Experience.

## Correos de la entrega (arreglados)
- La etapa **Entrega** tenía el texto genérico «Seguimos trabajando…»; ahora dice «Preparando tu entrega» y qué sigue.
- Los asuntos ya no terminan en punto («Letra · FHB-…»).
- Pasar de «En producción» a «Completado» sin revisión estaba bloqueado y por eso la entrega quedaba sin su correo; ahora se puede (si están todos los archivos) y sale «Tu canción está lista».
- Cuando el cliente sube archivos, el equipo recibe un aviso con la marca de Fromheartbeat.

## Pruebas
```
bash tests/support/serve.sh                       # copia de la app con SQLite (sólo pruebas) en :8199
python3 tests/support/fixtures.py                 # archivos de ejemplo
python3 tests/files-limits.py                     # cupos por tipo, concurrencia, extensión forzada, formato en el 1.er fragmento
python3 tests/files.py                            # 58 pruebas del backend (formatos, ataques, reanudación, estados, correos)
BASE_URL=http://127.0.0.1:8199 node tests/e2e-uploads.mjs mobile    # Chromium: cliente, varios archivos, compresión real
BASE_URL=http://127.0.0.1:8199 node tests/e2e-admin-files.mjs desktop   # Chromium: entrega del estudio y correo
```

## Límites honestos (lo que NO pude comprobar)
- **H.264 en teléfonos reales:** el Chromium del entorno de pruebas no tiene encoder H.264, así que la ruta de video se verificó de punta a punta con VP9-en-MP4. En Chrome/Edge/Safari modernos el encoder H.264 existe, pero no lo vi funcionar. Si un teléfono no puede reducir un video, simplemente lo sube original.
- **iPhone / Safari:** no hay Safari en el entorno. HEIC se acepta en el servidor; la reducción de HEIC sólo ocurre donde el navegador sabe leerlo.
- **MySQL real:** las pruebas usan SQLite imitando el dialecto; las consultas nuevas son simples (`COUNT`, `SUM`, `INSERT`).
- **Videos muy largos (≥ 1–2 GB):** la compresión arma el resultado en memoria; en teléfonos con poca RAM puede fallar y entonces sube el original.
