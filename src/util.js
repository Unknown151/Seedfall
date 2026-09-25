'use strict';
/* ============================== util ============================== */
const SF = window.SF = {};
const TAU = Math.PI * 2;
const W = 64, H = 64;              // map size in tiles
const TW2 = 16, TH2 = 8, EH = 6;   // iso half-width, half-height, elevation step (world units)
const SEAZ = 9;                    // sea surface z
const RS = 2;                      // static layer resolution multiplier
const OX = H * TW2 + 40, OY = 330;
const SLAB = 70;
const STATIC_W = (W + H) * TW2 + 80;
const STATIC_H = OY + (W + H) * TH2 + SLAB + 70;

const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = t => t * t * (3 - 2 * t);
const sstep = (a, b, v) => smooth(clamp((v - a) / (b - a), 0, 1));
const rnd = Math.random;
const ri = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const rf = (a, b) => a + rnd() * (b - a);
const pick = a => a[Math.floor(rnd() * a.length)];
const chance = p => rnd() < p;
const idx = (x, y) => y * W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];

function wpick(list) { // [[item, weight], ...]
  let s = 0; for (const e of list) s += e[1];
  let r = rnd() * s;
  for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
  return list[list.length - 1][0];
}
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function mulberry32(a) {
  return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function makeNoise(seed) {
  const r = mulberry32(seed);
  const p = []; for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const P = new Uint8Array(512); for (let i = 0; i < 512; i++) P[i] = p[i & 255];
  const V = new Float32Array(256); for (let i = 0; i < 256; i++) V[i] = r();
  function n(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = smooth(xf), v = smooth(yf);
    const X = xi & 255, Y = yi & 255;
    const a = V[P[X + P[Y]]], b = V[P[X + 1 + P[Y]]], c = V[P[X + P[Y + 1]]], d = V[P[X + 1 + P[Y + 1]]];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, o = 4) { let s = 0, a = 1, f = 1, t = 0; for (let i = 0; i < o; i++) { s += n(x * f + i * 17.3, y * f - i * 9.1) * a; t += a; a *= .5; f *= 2.03; } return s / t; }
  return { n, fbm };
}

/* ---------- colour ---------- */
const _cc = new Map();
function hexToRgb(h) { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
function toHex(r, g, b) { return '#' + ((1 << 24) | (clamp(r | 0, 0, 255) << 16) | (clamp(g | 0, 0, 255) << 8) | clamp(b | 0, 0, 255)).toString(16).slice(1); }
function shade(hex, f) {
  const k = hex + f; let v = _cc.get(k); if (v) return v;
  const [r, g, b] = hexToRgb(hex);
  if (f <= 1) v = toHex(r * f, g * f, b * f);
  else { const t = f - 1; v = toHex(r + (255 - r) * t, g + (255 - g) * t, b + (255 - b) * t); }
  if (_cc.size > 20000) _cc.clear();
  _cc.set(k, v); return v;
}
function mix(h1, h2, t) {
  const k = h1 + h2 + t; let v = _cc.get(k); if (v) return v;
  const a = hexToRgb(h1), b = hexToRgb(h2);
  v = toHex(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t));
  _cc.set(k, v); return v;
}
function rgba(hex, a) { const [r, g, b] = hexToRgb(hex); return `rgba(${r},${g},${b},${a})`; }
function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return toHex(f(0) * 255, f(8) * 255, f(4) * 255);
}

/* ---------- names & language drift ---------- */
const LANG0 = {
  on: ['b', 'br', 'd', 'dr', 'f', 'g', 'gr', 'h', 'j', 'k', 'kr', 'l', 'm', 'n', 'r', 's', 'sk', 'st', 't', 'tr', 'v', 'sv', 'b', 'h', 'l', 'm', 't', 'v'],
  vo: ['a', 'e', 'i', 'o', 'u', 'a', 'e', 'i', 'ae', 'ei', 'y', 'o', 'å', 'ø', 'a', 'e'],
  co: ['', '', '', '', 'n', 'r', 'l', 'k', 's', 'nd', 'rn', 'st', 'm', 'v', 'sk', 'ld', 'rk', 'n', 'r'],
  place: ['holm', 'vik', 'by', 'stead', 'mark', 'fell', 'haven', 'ford', 'dal', 'lund', 'rest', 'wick', 'moor', 'bro', 'hede', 'strand'],
  fam: ['sen', 'ard', 'vik', 'ell', 'strøm', 'dahl', 'berg', 'lund', 'ing', 'hart', 'mark', 'holt'],
  given: ['a', 'e', 'o', 'in', 'is', 'an', 'ja', 'ra', 'ne', 'ik', 've', 'ul']
};
const DRIFT = {
  k: ['c', 'ch', 'kh', 'q'], v: ['w', 'f', 'vh'], th: ['t', 'd'], sk: ['sh', 'sc', 'zk'], sv: ['sw', 'zw'],
  a: ['ai', 'ah', 'aa', 'ä'], e: ['ee', 'ie', 'é'], o: ['ou', 'oa', 'ô'], u: ['oo', 'ü', 'ou'], i: ['ii', 'ie', 'ì'],
  'å': ['aa', 'o', 'au'], 'ø': ['eu', 'oe', 'ö'], y: ['ui', 'ey'], ae: ['ai', 'e'], ei: ['ay', 'ai'],
  nd: ['nt', 'n'], rn: ['rr', 'rne'], st: ['ss', 'zt'], ld: ['ll', 'lt'], rk: ['rq', 'rc'], r: ['rh', 'l'], l: ['ll', 'lh'],
  j: ['y', 'zh'], dr: ['dh', 'zr'], tr: ['tl', 'chr'], gr: ['ghr', 'kr'], kr: ['cr', 'khr'], br: ['bhr', 'vr']
};
const NEWBITS = { on: ['z', 'x', 'q', 'zh', 'ph', 'ly', 'ny', 'sy', 'ch', 'w'], vo: ['ia', 'ou', 'ya', 'io', 'ea', 'aë', 'oi'], co: ['x', 'sh', 'nth', 'lm', 'ss', 'rr', 'q'],
  place: ['ia', 'ara', 'on', 'ex', 'is', 'ope', 'ane', 'orum', 'ven', 'lis', 'ai', 'ette', 'ari', 'ost'], fam: ['ani', 'ez', 'ovo', 'ith', 'ael', 'ora', 'uun', 'essa'] };

function driftLang(L, n = 3) {
  for (let k = 0; k < n; k++) {
    const key = pick(['on', 'vo', 'co', 'on', 'vo', 'place', 'fam']);
    const arr = L[key];
    if (chance(0.55)) {
      const j = Math.floor(rnd() * arr.length), cur = arr[j];
      if (DRIFT[cur]) arr[j] = pick(DRIFT[cur]); else if (NEWBITS[key]) arr[j] = pick(NEWBITS[key]);
    } else if (NEWBITS[key]) {
      arr.push(pick(NEWBITS[key]));
      if (arr.length > 30) arr.splice(Math.floor(rnd() * arr.length), 1);
    }
  }
}
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function tidy(s) {
  s = s.replace(/([^aeiouyåøæäöüéôì])\1{2,}/g, '$1$1').replace(/([^aeiouyåøæäöüéôì]{4,})/g, m => m.slice(0, 3));
  s = s.replace(/(.)\1\1/g, '$1$1');
  return s;
}
function syl(L) { return pick(L.on) + pick(L.vo) + pick(L.co); }
function nameWord(L, n) { let s = ''; for (let i = 0; i < n; i++) s += syl(L); return cap(tidy(s)); }
const PLACE_TAILS = ['Hollow', 'Ford', 'Reach', 'Landing', 'Rise', 'Crossing', 'Springs', 'Terrace', 'Bend', 'Mere'];
function placeName(L) {
  for (let t = 0; t < 8; t++) {
    let s;
    const r = rnd();
    if (r < 0.55) s = cap(tidy(syl(L) + pick(L.place)));
    else if (r < 0.8) s = nameWord(L, 2);
    else s = nameWord(L, 1) + ' ' + pick(PLACE_TAILS);
    if (s.length >= 4 && s.length <= 14) return s;
  }
  return nameWord(L, 2);
}
function personName(L) {
  let first = cap(tidy(syl(L) + pick(L.given)));
  if (first.length > 8) first = first.slice(0, 7);
  let last = cap(tidy(pick(L.on) + pick(L.vo) + pick(L.co) + pick(L.fam)));
  if (last.length > 11) last = nameWord(L, 2);
  return first + ' ' + last;
}

/* ---------- misc ---------- */
function fmtInt(n) { n = Math.round(n); return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 0 : 1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'k' : n.toLocaleString('en-US'); }
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
// map layers are stored as base64 text in save.json. Plain table lookups, same format as standard base64.
const B64 = new TextEncoder().encode('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'), B64I = new Uint8Array(256).fill(255);
B64.forEach((c, i) => { B64I[c] = i; });
function b64enc(u8) {
  const n = u8.length, out = new Uint8Array(Math.ceil(n / 3) * 4);
  let o = 0, i = 0;
  for (; i + 2 < n; i += 3) { const v = (u8[i] << 16) | (u8[i + 1] << 8) | u8[i + 2]; out[o++] = B64[v >> 18]; out[o++] = B64[(v >> 12) & 63]; out[o++] = B64[(v >> 6) & 63]; out[o++] = B64[v & 63]; }
  if (i < n) { const v = (u8[i] << 16) | (i + 1 < n ? u8[i + 1] << 8 : 0); out[o++] = B64[v >> 18]; out[o++] = B64[(v >> 12) & 63]; out[o++] = i + 1 < n ? B64[(v >> 6) & 63] : 61; out[o++] = 61; }
  return new TextDecoder().decode(out);
}
function b64dec(str, Type = Uint8Array) {
  const s = new TextEncoder().encode(str), u = new Uint8Array(Math.floor(s.length * 3 / 4) + 3);
  let acc = 0, bits = 0, o = 0;
  for (let k = 0; k < s.length; k++) { const v = B64I[s[k]]; if (v === 255) continue; acc = ((acc << 6) | v) & 0xFFFFF; bits += 6; if (bits >= 8) { bits -= 8; u[o++] = (acc >> bits) & 255; } }
  const r = u.slice(0, o);
  return Type === Uint8Array ? r : new Type(r.buffer);
}
function nowISO() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function todayStr() { const d = new Date(); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
