// Static audit of the rendered emails: client compatibility, accessibility, contrast, size, safety.
//   php scripts/preview-emails.php --out=<dir> && node tests/email-lint.mjs <dir>
// Exit code 1 when any rule fails.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('uso: node tests/email-lint.mjs <emailsDir>'); process.exit(1); }
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const src = fs.readFileSync(path.join(root, 'private/mail.php'), 'utf8');
const C = Object.fromEntries([...src.match(/const MAIL_C=\[([^\]]+)\]/)[1].matchAll(/'(\w+)'=>'(#[0-9a-f]{6})'/g)].map(m => [m[1], m[2]]));

const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * r + .7152 * g + .0722 * b; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + .05) / (y + .05); };

const failures = [];
const fail = (file, msg) => failures.push(`${file}: ${msg}`);

// 1) palette contrast: every text/background pair the layout really uses (WCAG AA: 4.5 body text, 3 for large/bold >=18px)
const pairs = [['ink', 'panel', 4.5], ['ink', 'bg', 4.5], ['ink', 'card', 4.5], ['body', 'panel', 4.5], ['body', 'card2', 4.5], ['muted', 'panel', 4.5], ['muted', 'card', 4.5],
  ['dim', 'panel', 4.5], ['dim', 'bg', 4.5], ['dim', 'card', 4.5], ['neon', 'panel', 4.5], ['neon', 'card', 4.5], ['neon', 'bg', 4.5], ['neon', 'card2', 4.5], ['btnInk', 'btn', 7], ['btnInk', 'neon', 7], ['warn', 'card2', 4.5], ['violet', 'card', 3], ['rail', 'panel', 3], ['pink', 'panel', 3]];
for (const [fg, bg, min] of pairs) { const r = ratio(C[fg], C[bg]); if (r < min) fail('paleta', `contraste ${fg} sobre ${bg} = ${r.toFixed(2)} (mínimo ${min})`); }

const banned = [[/display\s*:\s*(flex|grid)/i, 'flex/grid no funcionan en Outlook ni en Gmail antiguo'], [/position\s*:\s*(absolute|fixed|sticky)/i, 'position no es fiable en correo'],
  [/calc\(|var\(--/i, 'calc()/var() no se soportan'], [/@import/i, '@import bloqueado'], [/<script|<form|<iframe|<video|<object|<embed|<input|<button/i, 'elemento activo prohibido en correo'],
  [/javascript:/i, 'URL javascript:'], [/\son\w+\s*=/i, 'manejador de eventos on*'], [/background(-image)?\s*:\s*url\(/i, 'fondo con url() sin respaldo MSO/VML']];

const files = fs.readdirSync(dir).filter(f => f.endsWith('.html') && f !== 'index.html');
for (const f of files) {
  const html = fs.readFileSync(path.join(dir, f), 'utf8');
  const txtPath = path.join(dir, f.replace('.html', '.txt'));
  const hostile = f.startsWith('hostile');
  if (Buffer.byteLength(html) > 95 * 1024) fail(f, `pesa ${(Buffer.byteLength(html) / 1024).toFixed(0)} KB: Gmail recorta por encima de 102 KB`);
  if (!/<!DOCTYPE html>/i.test(html) || !/<html[^>]*lang="es"/.test(html) || !/<title>[^<]+<\/title>/.test(html)) fail(f, 'falta doctype, lang="es" o <title>');
  if (!/name="viewport"/.test(html) || !/@media only screen and \(max-width:620px\)/.test(html)) fail(f, 'falta viewport o media query móvil');
  if (!/display:none;[^"]*mso-hide:all/.test(html)) fail(f, 'falta el preheader oculto');
  for (const [re, why] of banned) if (re.test(html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, ''))) fail(f, why);
  // tables: presentation role, no nested layout without role (Outlook ghost table lives inside conditional comments)
  const bare = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '').match(/<table(?![^>]*role="presentation")[^>]*>/g);
  if (bare) fail(f, `${bare.length} <table> sin role="presentation"`);
  // images
  for (const img of html.match(/<img[^>]*>/g) || []) {
    if (!/\salt="/.test(img)) fail(f, 'img sin alt: ' + img.slice(0, 80));
    if (!/\swidth="\d+"/.test(img)) fail(f, 'img sin width: ' + img.slice(0, 80));
    if (!/display:block/.test(img)) fail(f, 'img sin display:block (deja huecos en Outlook/Gmail)');
    if (!/src="https?:\/\//.test(img)) fail(f, 'img con ruta no absoluta');
  }
  // links
  for (const a of html.match(/<a\s[^>]*href="[^"]*"/g) || []) {
    const href = a.match(/href="([^"]*)"/)[1];
    if (!/^(https?:\/\/|mailto:)/.test(href)) fail(f, 'enlace no absoluto: ' + href.slice(0, 60));
    if (/^http:\/\//.test(href) && !/127\.0\.0\.1/.test(href)) fail(f, 'enlace sin https: ' + href.slice(0, 60));
  }
  // a primary action must exist and have both the VML and the HTML variant
  if (!/<v:roundrect/.test(html) || !/<!\[endif\]-->/.test(html)) fail(f, 'botón sin variante VML para Outlook');
  if ((html.match(/<h1/g) || []).length !== 1) fail(f, 'debe haber exactamente un <h1>');
  // text alternative
  if (!fs.existsSync(txtPath) || fs.readFileSync(txtPath, 'utf8').trim().length < 80) fail(f, 'versión de texto ausente o muy corta');
  else if (!/https?:\/\//.test(fs.readFileSync(txtPath, 'utf8'))) fail(f, 'la versión de texto no incluye ningún enlace');
  // hostile inputs must come out inert
  if (hostile) {
    if (/<script|<img src=x|onerror=|<b>negrita/i.test(html.replace(/<img[^>]*logo-email[^>]*>/, ''))) fail(f, 'entrada hostil NO escapada');
    if (!/&lt;script&gt;|&lt;img/.test(html) && f === 'hostile-injection.html') fail(f, 'se esperaba el HTML hostil escapado visible como texto');
  }

  // --- client-compat structure ---
  const noCond = html.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, '');
  const opens = (html.match(/<!--\[if/g) || []).length, closes = (html.match(/<!\[endif\]-->/g) || []).length;
  if (opens !== closes) fail(f, `comentarios condicionales desbalanceados (${opens} abren, ${closes} cierran)`);
  const vml = (html.match(/<v:roundrect[^>]*>/) || [''])[0];
  const vmlHref = (vml.match(/href="([^"]*)"/) || [, ''])[1], htmlBtn = (html.match(/<a class="btn-a" href="([^"]*)"/) || [, ''])[1];
  if (!/xmlns:w=/.test(vml) || !/<w:anchorlock\/>/.test(html) || !/arcsize=/.test(vml) || !/fillcolor=/.test(vml)) fail(f, 'VML incompleto (xmlns:w, anchorlock, arcsize, fillcolor)');
  if (vmlHref !== htmlBtn) fail(f, 'el href del botón VML (Outlook) no coincide con el del botón HTML');
  const vmlH = +((vml.match(/height:(\d+)px/) || [, 0])[1]); if (vmlH < 44) fail(f, `botón VML de ${vmlH}px (mínimo 44)`);
  if (!/<!--\[if mso\]>[\s\S]*?font-family:Arial[\s\S]*?<!\[endif\]-->/.test(html)) fail(f, 'falta el override MSO de font-family (Outlook cae a Times)');
  if (/\.ttf/.test(html) || (/@font-face/.test(html) && (!/woff2/.test(html) || !/font-display:swap/.test(html)))) fail(f, '@font-face debe usar woff2 con font-display:swap (sin .ttf)');
  for (const row of html.match(/<td[^>]*\bheight="([1-6])"[^>]*>/g) || []) if (!/mso-line-height-rule:exactly/.test(row)) fail(f, 'fila fina sin mso-line-height-rule:exactly: ' + row.slice(0, 70));
  const inlineSizes = [...html.replace(/<style>[\s\S]*?<\/style>/g, '').matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map(m => +m[1]).filter(n => n < 10 && n !== 1);
  if (inlineSizes.length) fail(f, 'texto con tamaño menor a 10px: ' + [...new Set(inlineSizes)].join(', '));

  // --- rules added after the round-2 mutation tests ---
  const hosts = new Set([...html.matchAll(/href="https?:\/\/([^\/"?#]+)/g)].map(m => m[1]));
  if (hosts.size > 1) fail(f, 'enlaces a más de un dominio: ' + [...hosts].join(', '));
  for (const m of html.matchAll(/href="(https?:\/\/[^"]*\/\?session=[^"]*)"/g)) if (!/#token=[0-9a-f]{64}$/.test(m[1])) fail(f, 'enlace de sesión sin token de 64 hex: ' + m[1].slice(0, 70));
  if (!/class="wrap" width="600"/.test(html)) fail(f, 'la tabla principal debe medir 600');
  const btnPad = (html.match(/class="btn-a"[^>]*padding:(\d+)px/) || [, 0])[1]; if (+btnPad < 14) fail(f, `botón con padding vertical ${btnPad}px (mínimo 14)`);
  if (!/<img class="logo"[^>]*alt="fromheartbeat"/.test(html)) fail(f, 'el logo debe llevar alt="fromheartbeat"');
  const palette = new Set(Object.values(C).map(v => v.toLowerCase()));
  for (const m of noCond.matchAll(/(?<![-\w])color:(#[0-9a-fA-F]{6})/g)) if (!palette.has(m[1].toLowerCase())) fail(f, 'color de texto fuera de la paleta: ' + m[1]);
  for (const m of noCond.matchAll(/style="([^"]*)"/g)) {            // an element that sets both colours must be legible by itself (badges, pills)
    const fg = (m[1].match(/(?<![-\w])color:(#[0-9a-fA-F]{6})/) || [])[1], bg = (m[1].match(/background-color:(#[0-9a-fA-F]{6})/) || [])[1];
    if (fg && bg && ratio(fg, bg) < 4.5) fail(f, `texto ${fg} sobre ${bg} = ${ratio(fg, bg).toFixed(2)}`);
  }

  // --- round-3 additions ---
  if (/[‪-‮⁦-⁩​‎‏؜⁠-⁤­\u0085ㅤ⠀]/.test(html.replace(/&[a-z#0-9]+;/g, '')) && !/www​|:​\//.test(html)) fail(f, 'el HTML contiene caracteres invisibles o bidireccionales');
  if (/[‪-‮⁦-⁩؜⁠-⁤­\u0085ㅤ⠀]/.test(fs.readFileSync(txtPath, 'utf8'))) fail(f, 'el texto plano contiene caracteres invisibles o bidireccionales');
  if ((vml.match(/fillcolor="([^"]*)"/) || [, ''])[1].toLowerCase() !== C.btn.toLowerCase()) fail(f, 'el fillcolor del botón VML no es el color del botón');
  if (!new RegExp('<center style="color:' + C.btnInk + ';', 'i').test(html)) fail(f, 'el texto del botón VML no usa btnInk (ilegible en Outlook)');
  for (const m of html.matchAll(/@media[^{]*\{([^@]*?)\}\s*(?=@media|<\/style>|$)/g)) for (const n of m[1].matchAll(/font-size:(\d+)px/g)) if (+n[1] < 9) fail(f, 'media query con texto menor a 9px: ' + n[1]);
  // --- content safety ---
  const visible = noCond.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ').replace(/&[a-z#0-9]+;/g, ' ');
  if (!hostile && /\b(Array|NaN|undefined|null|Warning|Notice|Deprecated)\b|\{\{|\}\}/.test(visible)) fail(f, 'marcador de plantilla o error filtrado en el texto visible: ' + (visible.match(/\b(Array|NaN|undefined|null|Warning|Notice|Deprecated)\b|\{\{/) || [''])[0]);
  for (const m of html.matchAll(/<a\s[^>]*href="([^"]*)"[^>]*>([^<]+)<\/a>/g)) {            // visible text that looks like a URL/domain/email must match its destination
    const t = m[2].trim(); if (!/^[\w.-]+\.[a-z]{2,}$/i.test(t) && !/^[\w.+-]+@[\w.-]+$/.test(t)) continue;
    const ok = t.includes('@') ? m[1] === 'mailto:' + t : (() => { try { return new URL(m[1]).hostname === t; } catch { return false; } })();
    if (!ok) fail(f, `el texto del enlace "${t}" no coincide con su destino ${m[1].slice(0, 50)}`);
  }
  const txt = fs.existsSync(txtPath) ? fs.readFileSync(txtPath, 'utf8') : '';
  if (/^[A-ZÁÉÍÓÚÑ]{3,}[A-ZÁÉÍÓÚÑ ·:0-9-]*[áéíóúñ]/m.test(txt)) fail(f, 'texto plano con mayúsculas a medias (strtoupper no multibyte)');
  if (!/Términos: https?:\/\/.*\?ver=terminos/.test(txt) && !f.includes('team')) fail(f, 'el texto plano no incluye el enlace a Términos');
  // sizes of the subject / preheader
  const subj = (html.match(/<title>([^<]*)<\/title>/) || [, ''])[1].replace(/&[a-z#0-9]+;/g, 'x');
  if (subj.length > 70) fail(f, `asunto largo (${subj.length}): se corta en móviles`);
  const pre = ((html.match(/mso-hide:all;">([\s\S]*?)<\/div>/) || [, ''])[1].split('&#8199;')[0]).replace(/&[a-z#0-9]+;/g, 'x').trim();
  if (pre.length < 25 || pre.length > 140) fail(f, `preheader de ${pre.length} caracteres (ideal 40-110)`);
}

// --- content contracts: copy rules that must never regress (each one was a real defect in an audit round) ---
const read = n => { const p = path.join(dir, n + '.html'); return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') + '\n' + fs.readFileSync(path.join(dir, n + '.txt'), 'utf8') : null; };
const must = (n, re, why) => { const t = read(n); if (t === null) return; if (!re.test(t)) failures.push(`${n}: contrato roto, debe contener ${re}: ${why}`); };
const mustNot = (n, re, why) => { const t = read(n); if (t === null) return; if (re.test(t)) failures.push(`${n}: contrato roto, NO debe contener ${re}: ${why}`); };
const AI_PROMISES = /mezcla y master|masterizamos|master final|revisado por el equipo|sin plantillas|ronda de ajustes|rondas de ajustes|qué cambiarías/i;
for (const n of ['received-dedicatoria', 'paid-dedicatoria', 'production-express-2', 'production-express-4', 'review-dedicatoria', 'completed-dedicatoria']) mustNot(n, AI_PROMISES, 'Dedicatoria es el paquete esencial: no promete master ni rondas de cambios');
must('production-express-2', /artistas/, 'la Dedicatoria la graban artistas');
const NO_AI = /\bIA\b|inteligencia artificial|creación digital|flujo (de creación )?digital/i;
for (const f of fs.readdirSync(dir).filter(x => x.endsWith('.html') && fs.existsSync(path.join(dir, x.replace('.html', '.txt'))))) mustNot(f.replace('.html', ''), NO_AI, 'ningún correo menciona IA ni «creación digital»');
must('review-full', /1 ronda de ajustes para la canción y 1 para el video/, 'Full tiene dos rondas');
must('production-full-nosources', /Aún falta tu material para el video[\s\S]*Subir mis fotos y clips/, 'sin material, Full lo pide');
mustNot('production-full-sources', /Aún falta tu material/, 'con material no se vuelve a pedir');
must('production-full-sources', /Ya recibimos tu material para el video/, 'confirma que llegó el material');
must('paid-full', /Subir mis fotos y clips/, 'el pago de Full lleva al material');
must('received', /Ir al pago seguro/, 'con pagos habilitados ofrece pagar');
for (const n of ['received-nopay', 'quote-nopay']) { mustNot(n, /Ir al pago seguro|Revisar y pagar|Pago seguro con Wompi/, 'con COMMERCE_READY apagado no ofrece pagar'); }
must('update-question', /Responder en mi sesión/, 'en producción se puede responder en la sesión');
mustNot('update-question-prepay', /Responder en mi sesión/, 'antes de producción el formulario rechaza comentarios');
mustNot('update-cancelled', /Paso \d de \d/, 'una sesión cancelada no muestra progreso');
for (const n of ['paid-business', 'payment-failed-business', 'production-business-2', 'review-business', 'completed-business']) mustNot(n, /tu canción|tu historia/i, 'empresas: "pieza"/"marca", no lenguaje de regalo');
must('completed-listening', /Ver y descargar mi Full Experience/, 'Full entrega canción y video');
must('hostile-url', /:​\/\/|www​\./, 'las URLs del cliente se neutralizan');
mustNot('hostile-casing', /Juan-carlos/, 'nombres compuestos en mayúsculas');
mustNot('hostile-filler', /^[\s\S]*Hola/, 'un nombre sin letras no genera saludo');
const total = files.length;
if (failures.length) { console.log(`FALLAS (${failures.length}) en ${total} correos:\n - ` + failures.join('\n - ')); process.exit(1); }
console.log(`OK: ${total} correos pasan todas las reglas (${banned.length} patrones prohibidos + comprobaciones estructurales) y ${pairs.length} pares de contraste.`);
