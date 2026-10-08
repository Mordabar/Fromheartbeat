// First-party analytics. What it keeps: a random visitor id (this browser only), where the visit came from (utm / referrer
// host) and which step of the funnel was reached. What it never keeps: name, email, phone, story, IP, fingerprints.
// Honours "Do Not Track" and "Global Privacy Control": with either on, nothing is sent and orders carry no attribution.
const KEY_V = 'fhb-v', KEY_FT = 'fhb-ft', KEY_LT = 'fhb-lt';
const read = (store, k) => { try { return store.getItem(k); } catch { return null; } };
const write = (store, k, v) => { try { store.setItem(k, v); } catch { /* private mode */ } };
const optedOut = () => navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
const rand = n => { const a = new Uint8Array(n); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); };
const clean = s => String(s || '').replace(/[^\p{L}\p{N}_\-. ]/gu, '').slice(0, 60) || null;

let csrf = () => '', visitor = null, queue = [], timer = 0, sendToken = null, last = null, first = null;

function capture() {
  const q = new URLSearchParams(location.search), src = clean(q.get('utm_source')), med = clean(q.get('utm_medium')), camp = clean(q.get('utm_campaign')), c = q.get('c');
  if (c && /^[a-f0-9]{32}$/.test(c)) sendToken = c;
  let ref = null; try { const h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; if (h && h !== location.hostname) ref = clean(h); } catch { /* ignore */ }
  const touch = src || ref ? {s: src || ref, m: med || (src ? null : 'referral'), c: camp} : null;
  if (touch) { last = touch; write(sessionStorage, KEY_LT, JSON.stringify(touch)); if (!read(localStorage, KEY_FT)) write(localStorage, KEY_FT, JSON.stringify(touch)); }
  try { last ||= JSON.parse(read(sessionStorage, KEY_LT)); first = JSON.parse(read(localStorage, KEY_FT)); } catch { /* ignore */ }
  // the campaign parameters are for us, not for the address bar: do not leave them in a link the person might share
  if (q.has('utm_source') || q.has('utm_medium') || q.has('utm_campaign') || q.has('c')) { ['utm_source', 'utm_medium', 'utm_campaign', 'c'].forEach(k => q.delete(k)); const s = q.toString(); history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash); }
}

function flush(final = false) {
  clearTimeout(timer); timer = 0; if (!queue.length || !visitor) return;
  const e = queue.splice(0, 20);
  fetch('api.php?action=track', {method: 'POST', keepalive: final, headers: {'Content-Type': 'application/json', 'X-CSRF-Token': csrf()}, body: JSON.stringify({v: visitor, e})}).catch(() => {});
  if (queue.length) timer = setTimeout(flush, 800);
}

export const tracker = {
  init(getCsrf) {
    csrf = getCsrf; if (optedOut()) return;
    visitor = read(localStorage, KEY_V); if (!visitor || !/^[A-Za-z0-9_-]{16,40}$/.test(visitor)) { visitor = 'v' + rand(21); write(localStorage, KEY_V, visitor); }
    capture();
    addEventListener('pagehide', () => flush(true)); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(true); });
    if (sendToken) this.track('campaign_click', {});
  },
  track(name, data = {}, path = location.pathname) {
    if (!visitor) return;
    const ev = {n: name, p: String(path).slice(0, 120), d: data, dev: innerWidth < 700 ? 'm' : innerWidth < 1100 ? 't' : 'd'};
    if (last) { ev.us = last.s; ev.um = last.m; ev.uc = last.c; }
    if (name === 'campaign_click' && sendToken) ev.c = sendToken;
    queue.push(ev); if (queue.length >= 8) flush(); else if (!timer) timer = setTimeout(flush, 3000);
  },
  /** Sent with the order so that the sale is credited to where the visit came from. Null when the person opted out. */
  attribution() { return visitor ? {v: visitor, ft: first, lt: last, c: sendToken} : null; },
  get visitor() { return visitor; },
};
