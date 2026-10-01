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
  const noCond = html.replace(/<!--\[if[\s\S]*?<!\[endif\]-->/g, '');
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
const total = files.length;
if (failures.length) { console.log(`FALLAS (${failures.length}) en ${total} correos:\n - ` + failures.join('\n - ')); process.exit(1); }
console.log(`OK: ${total} correos pasan ${banned.length + 30} reglas y ${pairs.length} pares de contraste.`);
