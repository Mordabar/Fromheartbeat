// Prepara los archivos del cliente EN SU DISPOSITIVO antes de enviarlos: fotos más ligeras, videos a MP4 y WAV a MP3.
// El hosting no puede transcodificar (no hay ffmpeg), así que todo ocurre aquí; si algo no es posible, se envía el original.
// Nada de esto toca los archivos del estudio: el admin envía siempre sus originales.

export const PRESETS = {
  light: {label: 'Ligero', hint: 'Lo más pequeño: ideal con datos móviles', side: 1280, fps: 30, vbps: 2_000_000, abps: 96_000, imgSide: 1920, imgQ: 0.78, mp3: 128},
  balanced: {label: 'Equilibrado', hint: 'Buena calidad y mucho menos peso', side: 1920, fps: 30, vbps: 5_000_000, abps: 128_000, imgSide: 2560, imgQ: 0.86, mp3: 192},
  original: {label: 'Sin cambios', hint: 'Se envía tal como está', original: true},
};
export const DEFAULT_PRESET = 'balanced';

const MB = 1048576;
const ext = n => (String(n).match(/\.([A-Za-z0-9]+)$/) || [, ''])[1].toLowerCase();
const stem = n => String(n).replace(/\.[A-Za-z0-9]+$/, '');
export function kindOf(file) {
  const t = file.type || '', e = ext(file.name);
  if (t.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'avif', 'gif'].includes(e)) return 'image';
  if (t.startsWith('video/') || ['mp4', 'mov', 'm4v', 'webm', '3gp', 'mkv'].includes(e)) return 'video';
  if (t.startsWith('audio/') || ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'flac', 'aif', 'aiff', 'opus', 'caf'].includes(e)) return 'audio';
  return 'other';
}
export const fmtBytes = b => b >= 1073741824 ? (b / 1073741824).toFixed(1) + ' GB' : b >= MB ? (b >= 10 * MB ? Math.round(b / MB) : (b / MB).toFixed(1)) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';

const tick = () => new Promise(r => setTimeout(r, 0));
const aborted = s => { if (s?.aborted) throw new DOMException('Cancelado', 'AbortError'); };

/** Devuelve {blob, name, note, changed}. Nunca lanza salvo cancelación: ante cualquier problema devuelve el original. */
export async function prepareFile(file, {preset = DEFAULT_PRESET, onProgress = () => {}, signal} = {}) {
  const p = PRESETS[preset] || PRESETS[DEFAULT_PRESET], keep = (note = '') => ({blob: file, name: file.name, note, changed: false});
  if (p.original) return keep();
  const kind = kindOf(file);
  try {
    if (kind === 'image') return await prepImage(file, p, onProgress, signal) || keep();
    if (kind === 'video') return await prepVideo(file, p, onProgress, signal) || keep();
    if (kind === 'audio') return await prepAudio(file, p, onProgress, signal) || keep();
  } catch (e) {
    if (e?.name === 'AbortError') throw e;
    return keep('Se enviará el original (no pudimos reducirlo en este dispositivo).');
  }
  return keep();
}

// ---------------------------------------------------------------------------------------------------- imágenes
let webpOk;
async function canWebp() {
  if (webpOk !== undefined) return webpOk;
  try { const c = document.createElement('canvas'); c.width = c.height = 2; webpOk = await new Promise(r => c.toBlob(b => r(b?.type === 'image/webp'), 'image/webp', 0.8)); } catch { webpOk = false; }
  return webpOk;
}
async function prepImage(file, p, onProgress, signal) {
  const e = ext(file.name);
  if (file.size < 450 * 1024 || e === 'gif') return null;
  onProgress(0.1, 'Optimizando foto');
  const bmp = await createImageBitmap(file, {imageOrientation: 'from-image'}); // si el navegador no lee el formato (p. ej. HEIC fuera de Safari), lanza y se envía el original
  aborted(signal);
  const k = Math.min(1, p.imgSide / Math.max(bmp.width, bmp.height)), w = Math.max(1, Math.round(bmp.width * k)), h = Math.max(1, Math.round(bmp.height * k));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, w, h); bmp.close?.();
  onProgress(0.6, 'Optimizando foto');
  const type = await canWebp() ? 'image/webp' : 'image/jpeg';
  const blob = await new Promise(r => c.toBlob(r, type, p.imgQ));
  aborted(signal);
  if (!blob || blob.size >= file.size * 0.92) return null;
  onProgress(1, 'Optimizando foto');
  // Re-codificar elimina los metadatos (incluida la ubicación GPS de la foto).
  return {blob, name: stem(file.name) + (type === 'image/webp' ? '.webp' : '.jpg'), note: `${fmtBytes(file.size)} → ${fmtBytes(blob.size)}`, changed: true};
}

// ---------------------------------------------------------------------------------------------------- video
let engine;
const loadEngine = () => engine ||= import('./vendor/mediabunny.min.js');
export const videoSupport = () => typeof VideoEncoder === 'function' && typeof VideoDecoder === 'function';

async function prepVideo(file, p, onProgress, signal) {
  if (file.size < 6 * MB || file.size > 3 * 1024 * MB || !videoSupport()) return null;
  onProgress(0.01, 'Preparando video');
  const mb = await loadEngine();
  aborted(signal);
  const input = new mb.Input({source: new mb.BlobSource(file), formats: mb.INPUT_FORMATS});
  try {
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) return null;
    const dur = await input.computeDuration();
    const dw = vt.displayWidth, dh = vt.displayHeight; // ya incluye la rotación del teléfono
    const k = Math.min(1, p.side / Math.max(dw, dh)), w = Math.max(2, Math.round(dw * k / 2) * 2), h = Math.max(2, Math.round(dh * k / 2) * 2);
    const srcBps = dur > 0 ? file.size * 8 / dur : 0, bitrate = Math.round(p.vbps * Math.min(1, (w * h) / (1920 * 1080)) * 1.1 + 150_000);
    if (srcBps && srcBps < bitrate * 1.15 && k === 1) return null; // ya es ligero: no vale la pena re-codificar
    const codec = await pickVideoCodec(mb, w, h, bitrate);
    if (!codec) return null;
    const audioCodec = await pickAudioCodec(mb);
    const output = new mb.Output({format: new mb.Mp4OutputFormat({fastStart: 'in-memory'}), target: new mb.BufferTarget()});
    const conv = await mb.Conversion.init({
      input, output,
      video: {width: w, height: h, fit: 'contain', codec, bitrate, frameRate: p.fps, keyFrameInterval: 2},
      audio: audioCodec ? {codec: audioCodec, bitrate: p.abps, numberOfChannels: 2} : {discard: true},
      tags: {},
    });
    if (!conv.isValid) return null;
    conv.onProgress = x => onProgress(Math.max(0.02, x), 'Reduciendo video');
    const stop = () => conv.cancel();
    signal?.addEventListener('abort', stop, {once: true});
    try { await conv.execute(); } catch (e) { if (signal?.aborted) throw new DOMException('Cancelado', 'AbortError'); throw e; } finally { signal?.removeEventListener('abort', stop); }
    const buf = output.target.buffer;
    if (!buf || buf.byteLength >= file.size * 0.85) return null;
    return {blob: new File([buf], stem(file.name) + '.mp4', {type: 'video/mp4'}), name: stem(file.name) + '.mp4', note: `${fmtBytes(file.size)} → ${fmtBytes(buf.byteLength)}${codec === 'avc' ? '' : ' (' + codec.toUpperCase() + ')'}`, changed: true, codec};
  } finally { input.dispose?.(); }
}
async function pickVideoCodec(mb, width, height, bitrate) {
  for (const codec of ['avc', 'vp9']) {
    try { if (await mb.canEncodeVideo(codec, {width, height, bitrate})) return codec; } catch { /* siguiente */ }
  }
  return null;
}
async function pickAudioCodec(mb) {
  for (const codec of ['aac', 'opus']) {
    try { if (await mb.canEncodeAudio(codec, {numberOfChannels: 2, sampleRate: 48000, bitrate: 128_000})) return codec; } catch { /* siguiente */ }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------- audio (WAV → MP3)
let lame;
const loadLame = () => lame ||= new Promise((res, rej) => {
  if (globalThis.lamejs?.Mp3Encoder) return res(globalThis.lamejs);
  const s = document.createElement('script'); s.src = 'assets/vendor/lame.min.js'; s.onload = () => globalThis.lamejs?.Mp3Encoder ? res(globalThis.lamejs) : rej(new Error('lame')); s.onerror = () => { lame = null; rej(new Error('lame')); }; document.head.append(s);
});
/** Lee la cabecera RIFF/WAVE (sólo PCM de 16 bits; lo demás se deja como está). */
async function wavInfo(file) {
  const head = new DataView(await file.slice(0, 1024 * 64).arrayBuffer());
  if (head.byteLength < 44 || head.getUint32(0) !== 0x52494646 || head.getUint32(8) !== 0x57415645) return null;
  let o = 12, fmt = null;
  while (o + 8 <= head.byteLength) {
    const id = head.getUint32(o), size = head.getUint32(o + 4, true);
    if (id === 0x666d7420) fmt = {tag: head.getUint16(o + 8, true), ch: head.getUint16(o + 10, true), rate: head.getUint32(o + 12, true), bits: head.getUint16(o + 22, true)};
    if (id === 0x64617461) {
      if (!fmt || fmt.tag !== 1 || fmt.bits !== 16 || fmt.ch < 1 || fmt.ch > 2) return null;
      const start = o + 8, len = Math.min(size === 0xffffffff || size === 0 ? file.size - start : size, file.size - start);
      return {...fmt, start, len};
    }
    o += 8 + size + (size & 1);
  }
  return null;
}
async function prepAudio(file, p, onProgress, signal) {
  if (ext(file.name) !== 'wav' && file.type !== 'audio/wav' && file.type !== 'audio/x-wav') return null;
  if (file.size < 3 * MB || file.size > 1200 * MB) return null;
  const info = await wavInfo(file); if (!info) return null;
  onProgress(0.01, 'Convirtiendo a MP3');
  const L = await loadLame(); aborted(signal);
  const enc = new L.Mp3Encoder(info.ch, info.rate, p.mp3 || 192), out = [], block = 1152 * 8, bytesPer = block * info.ch * 2;
  for (let pos = 0; pos < info.len; pos += bytesPer * 16) {
    aborted(signal);
    const buf = await file.slice(info.start + pos, info.start + Math.min(info.len, pos + bytesPer * 16)).arrayBuffer();
    const pcm = new Int16Array(buf, 0, Math.floor(buf.byteLength / 2 / info.ch) * info.ch);
    for (let i = 0; i < pcm.length; i += block * info.ch) {
      let chunk;
      if (info.ch === 1) chunk = enc.encodeBuffer(pcm.subarray(i, i + block));
      else {
        const n = Math.min(block, (pcm.length - i) / 2), l = new Int16Array(n), r = new Int16Array(n);
        for (let j = 0; j < n; j++) { l[j] = pcm[i + j * 2]; r[j] = pcm[i + j * 2 + 1]; }
        chunk = enc.encodeBuffer(l, r);
      }
      if (chunk.length) out.push(new Int8Array(chunk));
    }
    onProgress(Math.min(0.99, pos / info.len), 'Convirtiendo a MP3'); await tick();
  }
  const tail = enc.flush(); if (tail.length) out.push(new Int8Array(tail));
  const blob = new Blob(out, {type: 'audio/mpeg'});
  if (blob.size >= file.size * 0.7) return null;
  return {blob: new File([blob], stem(file.name) + '.mp3', {type: 'audio/mpeg'}), name: stem(file.name) + '.mp3', note: `${fmtBytes(file.size)} → ${fmtBytes(blob.size)}`, changed: true};
}
