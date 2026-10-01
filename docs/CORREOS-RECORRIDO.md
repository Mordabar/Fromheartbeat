# Correos del recorrido del cliente

Los correos de pedido ya no son texto plano: son HTML de tablas (600 px, estilos en línea, botón compatible con Outlook,
versión en texto alternativa) con la identidad de Fromheartbeat. Todo sale de **un modelo por mensaje** en
`private/mail.php`; de ahí se generan el HTML y el texto, así que nunca se desincronizan.

## Qué correo recibe el cliente y cuándo

| Momento | Correo | Cómo se dispara | Botón |
|---|---|---|---|
| Pedido creado (persona) | **Tu historia ya está en el estudio** | Automático | Ir al pago seguro (o «Ver mi sesión» si los pagos no están habilitados) |
| Pedido creado (empresa) | **Recibimos el brief de tu marca** | Automático | Abrir mi sesión |
| Propuesta enviada (empresa) | **Tu propuesta está lista** | Admin envía la cotización | Revisar y pagar |
| Pago rechazado o con error | **Tu pago no se completó** | Automático (Wompi DECLINED/ERROR) | Intentar el pago de nuevo |
| Pago aprobado | **Pago confirmado** | Automático (webhook verificado) | Seguir mi sesión (Full: Subir mis fotos y clips) |
| Producción, etapas 1 a 4 | **Letra · Cabina · Producción · Mezcla y master** (Dedicatoria: Letra · Composición · Pulido · Revisión final) | Admin cambia de etapa y marca «enviar por correo» | Ver mi sesión |
| Revisión | **Es tu turno de escuchar** (Dedicatoria: *Tu canción ya se puede escuchar*) | Admin pasa a «En revisión» y marca enviar | Escuchar y comentar |
| Entrega | **Tu canción está lista** (empresas: *Tu pieza*) | Admin pasa a «Completado» y marca enviar | Escuchar y descargar mi canción |
| Cancelación | **Tu sesión fue cancelada** | Admin cancela y marca enviar | Escribir al estudio |
| Nota sin cambiar nada | **Novedades de tu sesión** (o *El estudio tiene una pregunta*) | Admin envía una nota con el mismo estado | Abrir mi sesión / Responder en mi sesión |
| Recuperar sesión | **Tu acceso privado** | El cliente pide su enlace | Abrir mi sesión |
| Equipo (interno) | Aviso con el resumen del pedido | Pedido nuevo, pago, propuesta, nota | Abrir en el panel |

**Regla importante:** el correo se elige por el **evento**, no por el estado actual. Una nota sobre un pedido que no cambió
de estado (ni de etapa hacia adelante) siempre es una «novedad». Lo vigila `tests/email-kind.php`.

Las notas internas (las que no son visibles para el cliente) **nunca** se envían: el servidor lo rechaza.

## Qué se promete en cada producto
El texto depende del producto y nunca promete lo que no incluye:
- **Dedicatoria Musical** (flujo digital con IA): no menciona cantante real, mezcla, master ni rondas de ajuste.
- **Canción Personalizada / Full Experience:** voces reales, mezcla y master; rondas de ajuste leídas del catálogo
  (Full: 1 para la canción y 1 para el video; si todavía no subió fotos y clips, el correo se los pide).
- **Empresas (Jingle / Campaign Sound):** recorrido de 6 pasos (Brief, Propuesta, Pago, Estudio, Revisión, Entrega).

## Archivos que hay que subir a `public_html`
Súbelos **en este orden** (el motor primero; `bootstrap.php` lo carga y sin él el sitio falla):

1. `assets/email/` (logo, ícono, 14 cabeceras, `fonts/`)
2. `private/mail.php` (nuevo)
3. `private/bootstrap.php`, `private/domain.php`, `api.php`
4. `scripts/mail-worker.php` (envía el HTML; el cron que ya existe sigue igual)
5. `assets/app.js`, `assets/admin.js`, `assets/admin-v4.css` (enlaces de Términos/Privacidad/FAQ y vista previa en el panel)

No toques `.env`, `private/storage/` ni `assets/audio/`. `private/domain.php` conserva sus finales de línea originales (CRLF).

## Cómo probar
```
php scripts/preview-emails.php --out=/tmp/correos --base=https://fromheartbeat.com   # 52 correos de muestra
node tests/email-lint.mjs /tmp/correos      # compatibilidad, contraste, seguridad y contratos de copy
php tests/email-mime.php                    # el mensaje real que enviaría PHPMailer
php tests/email-kind.php                    # qué correo sale según el evento
node tests/email-shots.mjs /tmp/correos /tmp/capturas   # capturas a 680 px y 375 px (requiere `npm install` en tests/)
```
En el entorno de pruebas (`APP_ENV` distinto de `production`) el panel muestra cada correo generado dentro de la ficha del pedido.

## Imágenes
Las cabeceras actuales son una primera versión generada por código (`scripts/email-assets/generate.py`).
`docs/EMAIL-IMAGENES-PROMPTS.md` tiene un prompt por imagen para producir las ilustradas; se reemplazan con el mismo nombre de archivo.

## Límites conocidos
- No se pudo probar en Gmail, Outlook ni Apple Mail reales: la compatibilidad se verificó por análisis y con Chromium.
- No hay redes sociales en los correos porque el repositorio no tiene ninguna cuenta oficial; se pueden añadir al pie cuando existan.
- La cursiva del titular es sintética (la fuente Cormorant del sitio solo tiene la versión recta), igual que en la web.
