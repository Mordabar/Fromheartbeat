# Imágenes de los correos · prompts para generarlas

Los correos ya funcionan con imágenes **v1 procedurales** (`assets/email/*.jpg`: vinilo, ondas y un símbolo por estado).
Este documento es para producir las versiones **ilustradas premium** con otro agente de imágenes. Se sustituyen
**con el mismo nombre de archivo**; no hay que cambiar nada de código.

## Reglas comunes (aplican a todas)

| Dato | Valor |
|---|---|
| Tamaño final | **1200 × 480 px** (relación 2,5 : 1). Se muestra a 600 × 240 (retina 2×) |
| Formato / peso | JPEG calidad 84–88, progresivo, **≤ 120 KB** (los correos con imágenes pesadas tardan en abrir) |
| Texto dentro de la imagen | **Ninguno.** Los titulares son HTML (accesibilidad, traducción y clientes que bloquean imágenes) |
| Zona segura | Sujeto principal centrado, dentro del 70 % central; al menos 8 % de margen en todos los lados |
| Borde superior | Debe terminar en `#07040f` (se pega al encabezado) |
| Borde inferior | Debe terminar en `#0f0920` (se pega al panel del contenido) para que no se vea la costura |
| Paleta | Fondo `#07040f`/`#0f0920`; violeta `#9b5cff`; neón `#c6a2ff`; rosa `#ff4fd8`; luz blanca `#f4eeff` |
| Motivo de marca | El **vinilo** (la «pared de vinilos» del estudio) y el logo (nota musical sobre una mano abierta) |
| Estética | Editorial, cinematográfica, íntima y cálida. Luz de neón violeta, mucho negro, profundidad de campo corta, grano fino |
| Evitar | Texto, logotipos de terceros, rostros reconocibles, manos deformes, estética «stock», saturación plana, bordes brillantes |

**Prefijo de estilo (se antepone a cada prompt):**

```
Cinematic editorial illustration, ultra-dark studio atmosphere (#07040f), soft violet and magenta neon rim light,
a vinyl record as the recurring motif, shallow depth of field, subtle film grain, premium music-brand aesthetic,
palette limited to deep violet #9b5cff, lavender #c6a2ff, hot pink #ff4fd8 and near-black, wide 2.5:1 banner,
subject centered with generous margins, top edge fading to #07040f and bottom edge fading to #0f0920,
absolutely no text, no letters, no logos, no watermark.
```

**Prompt negativo común:** `text, letters, watermark, logo, frame, border, people's faces, extra fingers, deformed hands, flat colors, low contrast, bright white background, clipart`.

---

## 1. `hero-received.jpg` · «Tu historia ya está en el estudio»
**Qué transmite:** acogida. Tu historia llegó y está a salvo.
**Prompt:** `[prefijo] A single vinyl record resting on a dark studio console, a handwritten letter gently sliding into a glowing mailbox slot of light beside it, warm violet glow spilling over the vinyl grooves, tiny sparkles floating, feeling of "your story has arrived safely".`

## 2. `hero-quote.jpg` · «Tu propuesta está lista» (marcas)
**Qué transmite:** profesionalismo, claridad, confianza.
**Prompt:** `[prefijo] An elegant proposal document with a thin neon violet outline floating above a vinyl record, a few fine glowing lines suggesting text (not readable), a small sound-wave signature at the bottom of the sheet, corporate but warm, balanced composition.`

## 3. `hero-payment_failed.jpg` · «Tu pago no se completó»
**Qué transmite:** calma, nada grave, se puede reintentar. **Sin rojo alarmante**: usar rosa suave.
**Prompt:** `[prefijo] A vinyl record paused mid-spin with a soft pink halo, a tiny glowing circular arrow (retry) hovering above it, muted desaturated violet background, reassuring and calm mood, no warning symbols, no red.`

## 4. `hero-paid.jpg` · «Pago confirmado»
**Qué transmite:** alivio y celebración tranquila.
**Prompt:** `[prefijo] A vinyl record lit from inside with a luminous check mark made of light projected onto the grooves, concentric halo rings expanding outward, small golden-lavender sparks rising, feeling of relief and "we start now".`

## 5. `hero-production.jpg` · «Tu sesión sigue en marcha» (genérica)
**Qué transmite:** trabajo vivo en el estudio.
**Prompt:** `[prefijo] A vinyl record spinning on a turntable with a vivid equalizer of vertical light bars rising behind it, layered translucent sound waves in violet and pink, studio monitors glowing faintly in the dark background, energy and craftsmanship.`

### 5a. `hero-production-1.jpg` · Etapa «Letra»
`[prefijo] A vintage fountain pen and an open notebook with glowing handwritten lines (illegible, abstract) resting beside a vinyl record, a warm lamp of violet light, quiet creative focus, shallow depth of field on the pen tip.`

### 5b. `hero-production-2.jpg` · Etapa «Grabación / cabina»
`[prefijo] A studio condenser microphone with a pop filter in a dark vocal booth, a vinyl record reflected softly in the pop filter, a thin red-pink "recording" glow turned into magenta light, intimate and focused mood.`

### 5c. `hero-production-3.jpg` · Etapa «Producción»
`[prefijo] A mixing-console style arrangement of glowing layered tracks (stacked horizontal waveforms in violet, lavender and pink) wrapping around a vinyl record like orbits, a feeling of a song taking shape layer by layer.`

### 5d. `hero-production-4.jpg` · Etapa «Mezcla y master»
`[prefijo] Close view of three vertical faders on a dark mixing desk with luminous knobs at different heights, a vinyl record softly glowing behind them, precise, polished, final-touch mood.`

## 6. `hero-review.jpg` · «Es tu turno de escuchar»
**Qué transmite:** intimidad; escuchar con calma.
**Prompt:** `[prefijo] A pair of premium over-ear headphones resting on top of a vinyl record, soft lavender light wrapping around the earcups, tiny sound ripples emanating, cozy late-night listening atmosphere, a hint of a warm lamp glow.`

## 7. `hero-completed.jpg` · «Tu canción está lista» (**el más importante**)
**Qué transmite:** emoción, regalo, momento memorable. Más luz y más brillo que el resto.
**Prompt:** `[prefijo] A radiant vinyl record centered like a gift, wrapped in a bright halo of lavender and pink light, a glowing play triangle at its center, confetti of tiny light particles and sparkles floating all around, joyful celebratory mood, the brightest image of the whole set while keeping dark edges.`

## 8. `hero-cancelled.jpg` · «Tu sesión fue cancelada»
**Qué transmite:** respeto y puerta abierta. Más apagada, sin dramatismo.
**Prompt:** `[prefijo] A vinyl record resting still in a muted grey-violet light, a tiny door of light slightly ajar behind it suggesting "you can come back anytime", very low saturation, gentle and respectful, no sad imagery.`

## 9. `hero-update.jpg` · «Novedades de tu sesión»
**Qué transmite:** cercanía, el estudio te escribe.
**Prompt:** `[prefijo] A vinyl record with a small floating speech bubble made of violet light and three soft glowing dots, subtle sound waves around, friendly and human tone, balanced and light.`

## 10. `hero-recover.jpg` · «Tu acceso privado»
**Qué transmite:** seguridad, sin contraseñas, tuyo.
**Prompt:** `[prefijo] A vinyl record with a luminous key of light resting across it, a soft padlock-shaped glow in the background, secure and private mood, deep violet shadows, elegant and minimal.`

---

## Cómo sustituir una imagen
1. Genera la imagen a 2400 × 960 y redúcela a **1200 × 480** (mejor nitidez).
2. Guárdala con el **nombre exacto** de arriba y súbela a `public_html/assets/email/` reemplazando la actual.
3. Comprueba que el borde inferior se funde con el panel (sin línea visible) abriendo `scripts/preview-emails.php --out=/tmp/e --base=https://fromheartbeat.com`.
4. Las variantes por etapa (`hero-production-1…4`) son **opcionales**: si no existe el archivo de una etapa, el correo usa `hero-production.jpg`.

### Logo e icono (no se generan, ya son de marca)
`logo-email.png` (cabecera) e `icon-email.png` (pie) salen del logo oficial (`assets/images/icono-logo-png-fromheartbeat.png`)
y de la tipografía Manrope. Si cambia el logo: `python3 scripts/email-assets/generate.py`.
