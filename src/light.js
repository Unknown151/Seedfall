/* ============================== light: sun, shadows, night, weather ============================== */
// LT is the light every draw call reads. LIGHT.cur is the light the visible static layer was drawn with.
// When the sun moves far enough, the static layer is redrawn in the background (a few ms per frame)
// into SC2, then crossfaded in. EMC holds the night glow (windows, lamps), added on top after dark.
const DEG = Math.PI / 180;
const HOME = { lat: 55.861, lon: 9.85, name: 'Horsens' };
const RSE = 1;
let SC2 = null, SX2 = null, EMC = null, EMX = null, EMC2 = null, EMX2 = null;
let LT = null, EMQ = null;
const LIGHT = { cur: null, next: null, job: null, fade: -1, q: [], chk: 0, sun: null, season: null, seasonT: 0, emK: 0, nightK: 0, dayK: 1, night: false };
const CH = new Float32Array(W * H), CW = new Float32Array(W * H), CD = new Float32Array(W * H), CRD = new Uint8Array(W * H);
const SHC = new Array(W * H).fill(null);
let CHMAX = 0;
const q2 = f => Math.round(f * 100) / 100;
const qs = (v, s) => Math.round(v / s) * s;
const SNOWC = '#eef2fa';

function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function initLight() {
  SC2 = mkCanvas(SC.width, SC.height); SX2 = SC2.getContext('2d');
  SX2.setTransform(RS, 0, 0, RS, 0, 0); SX2.lineJoin = 'round'; SX2.lineCap = 'round';
  EMC = mkCanvas(Math.ceil(STATIC_W * RSE), Math.ceil(STATIC_H * RSE)); EMX = EMC.getContext('2d');
  EMC2 = mkCanvas(EMC.width, EMC.height); EMX2 = EMC2.getContext('2d');
  EMX.setTransform(RSE, 0, 0, RSE, 0, 0); EMX2.setTransform(RSE, 0, 0, RSE, 0, 0);
  LT = mkLight(defaultEnv());
}

/* ---------- the sun ---------- */
function sunPos(ms, lat, lon) { // [altitude, azimuth from north], degrees
  const d = (ms - 946728000000) / 86400000;
  const g = (357.529 + 0.98560028 * d) * DEG, q = 280.459 + 0.98564736 * d;
  const L = (q + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * DEG, eps = (23.439 - 0.00000036 * d) * DEG;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(L), Math.cos(L)), dec = Math.asin(Math.sin(eps) * Math.sin(L));
  const gmst = ((18.697374558 + 24.06570982441908 * d) % 24 + 24) % 24;
  const Hh = (gmst * 15 + lon) * DEG - ra, la = lat * DEG;
  const alt = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(Hh));
  const az = Math.atan2(Math.sin(Hh), Math.cos(Hh) * Math.sin(la) - Math.tan(dec) * Math.cos(la)) / DEG + 180;
  return [alt / DEG, ((az % 360) + 360) % 360];
}
function skyMode() { return (S && S.settings && S.settings.sky) || 'hour'; }
function synthSun(hr) {
  const rise = 5, set = 21;
  if (hr >= rise && hr <= set) { const f = (hr - rise) / (set - rise); return { el: 52 * Math.pow(Math.sin(Math.PI * f), 1.3), th: -40 + 200 * f, hr }; }
  const f = (((hr - set) + 24) % 24) / (24 - set + rise);
  return { el: -24 * Math.sin(Math.PI * f), th: 160, hr };
}
function sunNow(ms) {
  ms = ms || Date.now();
  const m = skyMode(), d = new Date(ms);
  if (LIGHT.forceHr != null) return m === 'off' ? { el: 45, th: 115, hr: 13, fixed: 1 } : synthSun(LIGHT.forceHr);
  if (m === 'off') return { el: 45, th: 115, hr: 13, fixed: 1 };
  if (m === 'real') {
    const [el, az] = sunPos(ms, HOME.lat, HOME.lon);
    return { el, th: clamp(60 + (az - 180) * 100 / 90, -75, 195), hr: d.getHours() + d.getMinutes() / 60 };
  }
  const per = m === 'fast' ? 20 : 60;
  const mins = (d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60 + d.getMilliseconds() / 60000) % per;
  return synthSun(mins / per * 24);
}
function seasonNow(ms) {
  const d = new Date(ms || Date.now()), doy = (d - new Date(d.getFullYear(), 0, 1)) / 864e5;
  const bump = (c, w) => { let x = Math.abs(doy - c); x = Math.min(x, 365 - x); return clamp(1 - x / w, 0, 1); };
  return { autumn: bump(290, 55), winter: bump(15, 62), spring: bump(115, 50) };
}
function lightEra() { return !S || !S.tech ? 0 : hasTech('hover') ? 2 : hasTech('electric') ? 1 : 0; }
function litFrac(hr, el) {
  if (el > 4) return 0;
  const f = hr >= 16 && hr < 23 ? .8 : (hr >= 23 || hr < 1) ? .6 : hr < 4.5 ? .3 : .5;
  return f * sstep(4, -4, el);
}

/* ---------- light parameters ---------- */
const LAMPC = ['#ffae55', '#ffd99a', '#c4f1ff'];
const WINC = [['#ffc267', '#ffb35a', '#ffd07a'], ['#ffe19e', '#fff0c8', '#ffd07e'], ['#fff1d6', '#c9ecff', '#ffe2b0']];
const DOORC = ['#ffa24e', '#ffc47a', '#ffe0b0'];
function defaultEnv() { return { th: 115, el: 45, lit: 0, cover: 0, shA: .2, snow: 0, autumn: 0, winter: 0, spring: 0, era: 0 }; }
function envNow() {
  const sun = LIGHT.sun || sunNow(), wx = (S && S.wx) || { cover: .3, sc: 0 }, se = LIGHT.season || seasonNow(), set = S.settings || {};
  let el = sun.el, th = sun.th;
  const nl = (S && S.doctrines && lever('lights')) || '';
  const lit = sun.fixed ? 0 : litFrac(sun.hr, el) * (nl === 'dark_sky' ? .35 : nl === 'candlelight' ? .8 : 1);
  const shA = set.shadows === false ? 0 : .32 * sstep(1, 12, el) * (1 - .9 * wx.cover);
  if (el < -2) { el = -9; th = 0; } // moonlight: the static layer doesn't change through the night
  const wxOn = set.weather !== false;
  return {
    th: qs(th, 5), el: qs(el, 3), lit: q2(qs(lit, .1)), cover: q2(qs(wx.cover, .25)), shA: q2(qs(shA, .04)), snow: wxOn ? q2(qs(wx.sc || 0, .25)) : 0,
    autumn: q2(qs(se.autumn, .1)), winter: q2(qs(se.winter, .1)), spring: q2(qs(se.spring, .1)), era: lightEra(),
    nl, gd: S && S.doctrines && lever('nature') === 'gardens' ? 1 : 0
  };
}
function lightKey(e) { return [e.th, e.el, e.lit, e.cover, e.shA, e.snow, e.autumn, e.winter, e.spring, e.era, e.nl || '', e.gd || 0].join('|'); }
function lfOf(L, nx, ny, nz) {
  const n = Math.hypot(nx, ny, nz) || 1; nx /= n; ny /= n; nz /= n;
  return q2(L.amb + L.sky * nz + L.dif * Math.max(0, nx * L.sx + ny * L.sy + nz * L.sz));
}
function lf(nx, ny, nz) { return lfOf(LT, nx, ny, nz); }
function mkLight(e) {
  const L = Object.assign({}, e);
  L.key = lightKey(e);
  L.em = e.el < 7 && !(LIGHT.sun && LIGHT.sun.fixed); // night glow only needs building around dusk and after
  let th = e.th, el = e.el, dif = .34;
  const night = el < -2;
  if (night) { th = 105; el = 40; dif = .18; } else el = Math.max(1.5, el);
  const t = th * DEG, h = el * DEG, ce = Math.cos(h);
  L.sx = ce * Math.cos(t); L.sy = ce * Math.sin(t); L.sz = Math.sin(h);
  L.amb = .66 + .08 * e.cover; L.sky = .14; L.dif = dif * (1 - .6 * e.cover);
  L.fL = lfOf(L, 0, 1, 0); L.fR = lfOf(L, 1, 0, 0); L.fT = lfOf(L, 0, 0, 1); L.fG = q2(L.fT / 1.07);
  L.fWL = q2(L.fL / .9); L.fWR = q2(L.fR / .9);
  const hx = (L.sx - L.sy) * 16, hy = (L.sx + L.sy) * 8 - L.sz * 19.6, hl = Math.hypot(hx, hy) || 1;
  L.hx = hx / hl; L.hy = hy / hl;
  L.shA = night ? 0 : e.shA;
  if (L.shA > 0) {
    const g = Math.hypot(L.sx, L.sy) || 1;
    L.shdx = -L.sx / g; L.shdy = -L.sy / g;
    L.shk = 1 / (19.6 * Math.tan(Math.max(e.el, 7) * DEG)); L.shMax = 4.5;
    L.shCol = `rgba(34,42,84,${L.shA})`;
  }
  L.lampC = LAMPC[e.era]; L.winC = WINC[e.era]; L.doorC = DOORC[e.era]; L.lampCs = null; L.lampOff = false;
  if (e.nl === 'warm') { L.winC = ['#ffd08a', '#ffc070', '#ffe0a8']; L.lampC = '#ffc680'; L.doorC = '#ffb862'; }
  else if (e.nl === 'cool') { L.winC = ['#dff3ff', '#c6e8ff', '#f0f8ff']; L.lampC = '#cfefff'; L.doorC = '#e6f4ff'; }
  else if (e.nl === 'colourful') { L.winC = ['#ff9ad0', '#9ad8ff', '#b8ff9a', '#ffe27a', '#c9a8ff', '#ffb38a']; L.lampCs = L.winC; L.doorC = '#ffc47a'; }
  else if (e.nl === 'candlelight') { L.winC = ['#ffb04a', '#ff9d3a', '#ffc062']; L.lampC = '#ffa648'; L.doorC = '#ff9d3a'; }
  else if (e.nl === 'dark_sky') { L.lampOff = true; }
  L.grass = e.winter > e.autumn ? ['#c2c6b4', q2(e.winter * .38)] : e.autumn > .05 ? ['#d0b566', q2(e.autumn * .3)] : ['#8fe39a', q2(e.spring * .14)];
  L.leaf = e.winter > e.autumn ? ['#c6c2d2', q2(e.winter * .4)] : e.autumn > .05 ? ['#e3864a', q2(e.autumn * .45)] : ['#9be38f', q2(e.spring * .12)];
  L.flowers = .35 + .25 * e.spring - .35 * e.winter - .15 * e.autumn - e.snow + (e.gd ? .45 : 0);
  return L;
}
// colour helpers that follow the current light
function topC(col) { return LT.snow ? mix(col, SNOWC, q2(LT.snow * .82)) : col; }
function leafC(col, f) { let c = LT.leaf[1] ? mix(col, LT.leaf[0], LT.leaf[1]) : col; c = shade(c, q2((f || 1) * LT.fG)); return c; }
function emit(x, y, r, col, a, pool) { if (EMQ) EMQ.push([x, y, r, col, a || 1, pool ? 1 : 0]); }

/* ---------- casters and cast shadows ---------- */
const CAST_DIMS = {
  pod: [.35, .2, 7, 1], well: [.14, .14, 10, 1], granary: [.2, .2, 17, 1], shrine: [.1, .1, 18, 0], watchstone: [.1, .1, 32, 0],
  dock: [.2, .16, 8, 0], market: [.3, .3, 5, 0], school: [.34, .24, 14, 0], library: [.36, .3, 17, 0], workshop: [.3, .26, 11, 0],
  mine: [.3, .3, 8, 0], lumber: [.17, .13, 9, 0], quarry: [.06, .06, 12, 0], claypit: [.13, .13, 8, 1], harbor: [.3, .3, 9, 0], lighthouse: [.11, .11, 44, 1], mill: [.17, .17, 22, 1], hall: [.4, .3, 19, 0], observatory: [.22, .22, 17, 1], works: [.42, .3, 16, 0],
  station: [.42, .24, 13, 0], clinic: [.32, .3, 14, 0], power: [.36, .28, 17, 0], turbine: [.05, .05, 58, 1], mast: [.12, .12, 60, 0],
  university: [.44, .36, 25, 0], antenna: [.2, .2, 20, 0], vfarm: [.34, .34, 37, 0], stadium: [.45, .45, 7, 1], museum: [.4, .34, 18, 0],
  launchpad: [.08, .08, 50, 1], fusion: [.4, .4, 21, 1], terraformer: [.2, .2, 66, 1], dome: [.42, .42, 18, 1], elevator: [.3, .3, 62, 0]
};
const MON_DIMS = { statue: [.14, .14, 24, 0], lantern: [.2, .2, 62, 0], spire: [.28, .28, 50, 0], harp: [.2, .2, 42, 0], gardens: [.4, .4, 38, 0], colossus: [.3, .3, 40, 1], hall: [.42, .34, 25, 0], clock: [.18, .18, 60, 0], orchard: [.3, .3, 20, 1], obelisk: [.12, .12, 60, 0] };
const TREE_H = [16, 16, 22, 11, 11];
function casterDims(B) {
  const d = casterDims0(B), st = S.styles[B.style];
  if (d && st && st.shape && B.type === 'house' && B.tier >= 2) { const hm = SHAPE_HM[st.shape] || 1; return [d[0], d[1], d[2] * hm, st.shape === 'round' || st.shape === 'organic' ? 1 : d[3]]; }
  return d;
}
function casterDims0(B) {
  const v = B.var || 0;
  if (B.type === 'house') switch (B.tier) {
    case 0: return [.22, .2, 8, 0]; case 1: return [.24, .24, 12, 1]; case 2: return [.26, .26, 11, 0];
    case 3: return [.32, .28, 18, 0]; case 4: return [.38, .36, 23, 0];
    case 5: return [.34, .34, 33 + ((v * 3) % 1) * 22, 0];
    case 6: return [.33, .33, 58 + ((v * 5) % 1) * 62, 0];
    default: return [.42, .42, 165, 0];
  }
  if (B.type === 'monument') return MON_DIMS[B.sub] || MON_DIMS.obelisk;
  if (FLAT_TYPES[B.type]) return null;
  return CAST_DIMS[B.type] || [.3, .3, (BT[B.type] ? BT[B.type].h : 20) * .6, 0];
}
function computeCaster(i) {
  let d = null;
  const b = M.bld[i];
  if (b) {
    const B = S.B[b];
    if (B && !B.hid) {
      if (B.prog < 1) { if (!FLAT_TYPES[B.type] && B.prog > .25) d = [.28, .28, buildH(B) * Math.min(1, (B.prog - .2) / .8), 0]; }
      else d = casterDims(B);
    }
  } else if (M.tree[i]) d = [.2 + M.tree[i] * .07, .2 + M.tree[i] * .07, TREE_H[M.ttype[i]] || 16, 1];
  else if (M.ruin[i]) d = [.3, .3, 12, 0];
  if (d && d[2] > 2) { CW[i] = d[0]; CD[i] = d[1]; CH[i] = d[2]; CRD[i] = d[3]; if (d[2] > CHMAX) CHMAX = d[2]; }
  else { CH[i] = 0; CW[i] = CD[i] = 0; CRD[i] = 0; }
  SHC[i] = null;
}
function hull(P) {
  P.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let k = P.length - 1; k >= 0; k--) { const p = P[k]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop(); return lo.concat(up);
}
const OCT = [[1, 0], [.707, .707], [0, 1], [-.707, .707], [-1, 0], [-.707, -.707], [0, -1], [.707, -.707]];
function shadowHull(j, b0, b1) {
  const hw = CW[j], hd = CD[j], dx = LT.shdx, dy = LT.shdy, P = [];
  const F = CRD[j] ? OCT.map(([a, b]) => [a * hw, b * hd]) : [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  for (const [u, v] of F) { P.push([u + dx * b0, v + dy * b0]); P.push([u + dx * b1, v + dy * b1]); }
  const Hh = hull(P);
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const p of Hh) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; }
  return { pts: Hh, bb: [x0, y0, x1, y1] };
}
function clipSq(P, ox, oy, e) {
  let out = P.map(p => [p[0] + ox, p[1] + oy]);
  for (let ax = 0; ax < 2; ax++) for (const s of [1, -1]) {
    const inp = out; out = []; if (!inp.length) return out;
    for (let k = 0; k < inp.length; k++) {
      const a = inp[k], b = inp[(k + 1) % inp.length], da = a[ax] * s - e, db = b[ax] * s - e;
      if (da <= 0) out.push(a);
      if ((da < 0 && db > 0) || (da > 0 && db < 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
    }
  }
  return out;
}
function castShadows(c, i, x, y, cx, cy) {
  const L = LT, sx = -L.shdx, sy = -L.shdy, zr = surfZ(i), R = Math.min(L.shMax, (CHMAX + 12) * L.shk);
  const xa = clamp(Math.floor(Math.min(x, x + sx * R)) - 1, 0, W - 1), xb = clamp(Math.ceil(Math.max(x, x + sx * R)) + 1, 0, W - 1);
  const ya = clamp(Math.floor(Math.min(y, y + sy * R)) - 1, 0, H - 1), yb = clamp(Math.ceil(Math.max(y, y + sy * R)) + 1, 0, H - 1);
  let any = false;
  for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) {
    const j = yy * W + xx, h = CH[j]; if (!h) continue;
    const ox = xx - x, oy = yy - y, along = ox * sx + oy * sy;
    if (along < -1 || along > Math.min(R, h * L.shk + .1) + .8 || Math.abs(ox * sy - oy * sx) > 1.3) continue;
    const zc = surfZ(j), top = zc + h - zr; if (top <= 0) continue;
    const b0 = Math.max(0, zc - zr) * L.shk, b1 = Math.min(R, top * L.shk);
    if (b1 <= b0 + .02) continue;
    let hs;
    if (b0 === 0) { hs = SHC[j]; if (!hs || hs.k !== L.key || hs.b1 !== b1) { hs = shadowHull(j, 0, b1); hs.k = L.key; hs.b1 = b1; SHC[j] = hs; } }
    else hs = shadowHull(j, b0, b1);
    const bb = hs.bb;
    if (bb[2] + ox < -.52 || bb[0] + ox > .52 || bb[3] + oy < -.52 || bb[1] + oy > .52) continue;
    const inside = bb[0] + ox > -.515 && bb[2] + ox < .515 && bb[1] + oy > -.515 && bb[3] + oy < .515;
    const poly2 = inside ? hs.pts.map(p => [p[0] + ox, p[1] + oy]) : clipSq(hs.pts, ox, oy, .515);
    if (poly2.length < 3) continue;
    if (!any) { c.beginPath(); any = true; }
    let p = pt(cx, cy, poly2[0][0], poly2[0][1], 0); c.moveTo(p[0], p[1]);
    for (let k = 1; k < poly2.length; k++) { p = pt(cx, cy, poly2[k][0], poly2[k][1], 0); c.lineTo(p[0], p[1]); }
    c.closePath();
  }
  if (any) { c.fillStyle = L.shCol; c.fill('nonzero'); }
}

/* ---------- glow ---------- */
const GLOWS = new Map();
function glowSprite(col) {
  let s = GLOWS.get(col); if (s) return s;
  s = mkCanvas(64, 64); const g = s.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  const [r, gg, b] = hexToRgb(col);
  gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(.16, `rgba(${r},${gg},${b},.78)`);
  gr.addColorStop(.42, `rgba(${r},${gg},${b},.22)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); GLOWS.set(col, s); return s;
}
function drawGlow(c, x, y, r, col, a, pool) {
  c.globalAlpha = a; const s = glowSprite(col);
  if (pool) c.drawImage(s, x - r, y - r * .5, r * 2, r); else c.drawImage(s, x - r, y - r, r * 2, r * 2);
}
function emTile(e, i, list) {
  const h = CH[i];
  if (h > 5) { // this object hides glows drawn behind it
    const [X, Y] = tileTop(i), cx = X, cy = Y + 8, hw = CW[i] + .02, hd = CD[i] + .02;
    const a = pt(cx, cy, -hw, hd, 0), b = pt(cx, cy, hw, hd, 0), d = pt(cx, cy, hw, -hd, 0), f = pt(cx, cy, hw, -hd, h), g = pt(cx, cy, -hw, -hd, h), k = pt(cx, cy, -hw, hd, h);
    e.globalCompositeOperation = 'destination-out'; e.globalAlpha = 1; e.fillStyle = '#000';
    e.beginPath(); e.moveTo(a[0], a[1]); e.lineTo(b[0], b[1]); e.lineTo(d[0], d[1]); e.lineTo(f[0], f[1]); e.lineTo(g[0], g[1]); e.lineTo(k[0], k[1]); e.closePath(); e.fill();
  }
  if (list && list.length) {
    e.globalCompositeOperation = 'lighter';
    for (const l of list) drawGlow(e, l[0], l[1], l[2], l[3], l[4], l[5]);
  }
  e.globalCompositeOperation = 'source-over'; e.globalAlpha = 1;
}

/* ---------- painting with a given light ---------- */
function paintTile(c, lt, e, x, y) {
  if (e && !lt.em) e = null;
  LT = lt; EMQ = e ? [] : null;
  drawTile(c, x, y);
  if (e) emTile(e, idx(x, y), EMQ);
  EMQ = null;
}
function paintRect(c, lt, e, r) {
  const x0 = Math.floor(r[0]) - 1, y0 = Math.floor(r[1]) - 1, x1 = Math.ceil(r[2]) + 1, y1 = Math.ceil(r[3]) + 1, pad = e ? 16 : 0;
  c.save(); c.beginPath(); c.rect(x0, y0, x1 - x0, y1 - y0); c.clip(); c.clearRect(x0, y0, x1 - x0, y1 - y0);
  if (e) { e.save(); e.beginPath(); e.rect(x0, y0, x1 - x0, y1 - y0); e.clip(); e.clearRect(x0, y0, x1 - x0, y1 - y0); }
  for (let s = 0; s <= W + H - 2; s++) {
    const xa = Math.max(0, s - H + 1), xb = Math.min(W - 1, s);
    for (let x = xa; x <= xb; x++) {
      const i = idx(x, s - x);
      if (BB.x1[i] < x0 - pad || BB.x0[i] > x1 + pad || BB.y1[i] < y0 - pad || BB.y0[i] > y1 + pad) continue;
      paintTile(c, lt, e, x, s - x);
    }
  }
  c.restore(); if (e) e.restore();
  LT = LIGHT.cur || lt;
}
function clearCanvas(x, cv, rs) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, cv.width, cv.height); x.setTransform(rs, 0, 0, rs, 0, 0); }
function startRelight(env) {
  LIGHT.next = mkLight(env); LIGHT.q = [];
  clearCanvas(SX2, SC2, RS); clearCanvas(EMX2, EMC2, RSE);
  LIGHT.job = { s: 0, x: 0, n: 0, t: performance.now(), ms: 0 };
}
function relightStep(budget) {
  const J = LIGHT.job; if (!J) return;
  const t0 = performance.now();
  for (;;) {
    if (J.s > W + H - 2) { J.ms += performance.now() - t0; finishRelight(); break; }
    const xa = Math.max(0, J.s - H + 1), xb = Math.min(W - 1, J.s);
    if (J.x < xa) J.x = xa;
    paintTile(SX2, LIGHT.next, EMX2, J.x, J.s - J.x);
    if (++J.x > xb) { J.s++; J.x = 0; }
    if ((++J.n & 7) === 0 && performance.now() - t0 > budget) { J.ms += performance.now() - t0; break; }
  }
  LT = LIGHT.cur;
}
function finishRelight() {
  for (const r of LIGHT.q) paintRect(SX2, LIGHT.next, EMX2, r);
  LIGHT.last = { ms: Math.round(LIGHT.job.ms), wall: Math.round(performance.now() - LIGHT.job.t) };
  LIGHT.q = []; LIGHT.job = null;
  [EMC, EMC2] = [EMC2, EMC]; [EMX, EMX2] = [EMX2, EMX];
  LIGHT.fade = 0;
}
function fadeStep(dt) {
  if (LIGHT.fade < 0) return;
  LIGHT.fade += dt / 3.5;
  if (LIGHT.fade >= 1) {
    [SC, SC2] = [SC2, SC]; [SX, SX2] = [SX2, SX];
    LIGHT.cur = LIGHT.next; LIGHT.next = null; LIGHT.fade = -1; LT = LIGHT.cur;
  }
}
function lightTick(dt) {
  if (!S || !LIGHT.cur) return;
  LIGHT.sun = sunNow();
  if (!LIGHT.season || (LIGHT.seasonT -= dt) <= 0) { LIGHT.season = LIGHT.forceSeason || seasonNow(); LIGHT.seasonT = 300; }
  stepWeather(dt);
  const el = LIGHT.sun.el, fx = LIGHT.sun.fixed;
  LIGHT.emK = fx ? 0 : sstep(4, -6, el);
  LIGHT.nightK = fx ? 0 : sstep(0, -9, el);
  LIGHT.dayK = fx ? 1 : sstep(-6, 4, el);
  if ((LIGHT.chk -= dt) <= 0 && !LIGHT.job && LIGHT.fade < 0) {
    LIGHT.chk = 1.5;
    const env = envNow(); if (lightKey(env) !== LIGHT.cur.key) startRelight(env);
  }
  if (LIGHT.job) relightStep(7);
  fadeStep(dt);
  const night = LIGHT.nightK > .5 || S.wx && S.wx.storm > .6 && LIGHT.dayK < 1;
  if (night !== LIGHT.night) { LIGHT.night = night; document.body.classList.toggle('night', night); }
}
function relightNow() { LIGHT.chk = 0; }
function skyIcon() {
  const w = S.wx, sun = LIGHT.sun; if (!w || !sun) return '';
  const on = S.settings.weather !== false, k = on ? w.k : 'fair', night = !sun.fixed && sun.el < -2;
  if (!on && sun.fixed) return '';
  if (night && (k === 'clear' || k === 'fair')) return ' · 🌙';
  if (!sun.fixed && sun.el < 8 && sun.el > -2 && (k === 'clear' || k === 'fair')) return sun.th < 60 ? ' · 🌅' : ' · 🌇';
  return ' · ' + WX_ICON[k];
}

/* ---------- weather ---------- */
const WXK = { clear: { cover: .08 }, fair: { cover: .32 }, cloudy: { cover: .62 }, overcast: { cover: .9 }, rain: { cover: .94, rain: .6 }, storm: { cover: 1, rain: 1, storm: 1 }, snow: { cover: .88, snow: .75 }, fog: { cover: .4, fog: .85 } };
const WXN = { clear: ['fair', 'fair', 'clear', 'fog'], fair: ['clear', 'cloudy', 'fair', 'clear', 'fog'], cloudy: ['fair', 'overcast', 'rain', 'cloudy', 'fair'], overcast: ['cloudy', 'rain', 'snow', 'overcast'], rain: ['overcast', 'cloudy', 'storm', 'rain'], storm: ['rain', 'overcast'], snow: ['overcast', 'snow', 'cloudy'], fog: ['fair', 'cloudy', 'clear'] };
const WXD = { clear: [8, 22], fair: [8, 20], cloudy: [6, 14], overcast: [5, 12], rain: [4, 10], storm: [2, 4], snow: [5, 12], fog: [4, 9] };
const WX_NAME = { clear: 'Clear', fair: 'Fair', cloudy: 'Cloudy', overcast: 'Overcast', rain: 'Rain', storm: 'Thunderstorm', snow: 'Snow', fog: 'Fog' };
const WX_ICON = { clear: '☀️', fair: '🌤️', cloudy: '⛅', overcast: '☁️', rain: '🌧️', storm: '⛈️', snow: '🌨️', fog: '🌫️' };
function wxWeight(k, se, hr) {
  let w = 1;
  if (k === 'snow') w = se.winter > .3 ? 1.6 : 0;
  else if (k === 'rain') w = se.winter > .6 ? .5 : 1;
  else if (k === 'storm') w = .35 + (1 - se.winter - se.autumn * .5) * .5;
  else if (k === 'fog') w = (hr > 3 && hr < 11 ? 1.4 : .25) * (.5 + se.autumn + se.winter * .5);
  else if (k === 'clear' || k === 'fair') w = 1.35 - se.winter * .4;
  const wish = S && S.doctrines && lever('weather'), ww = wish ? 1 + 4 * leverW('weather') : 1;
  if (wish === 'sunny') { if (k === 'clear' || k === 'fair') w *= ww; else if (k !== 'cloudy') w /= ww; }
  else if (wish === 'rainy') { if (k === 'rain' || k === 'cloudy' || k === 'overcast') w *= ww; }
  else if (wish === 'snowy') { if (k === 'snow') w = Math.max(w, 1.2) * ww; else if (k === 'overcast') w *= 2; else if (k === 'rain') w /= ww; }
  else if (wish === 'foggy') { if (k === 'fog') w = Math.max(w, 1) * ww; }
  else if (wish === 'stormy') { if (k === 'storm' || k === 'rain') w *= ww; }
  else if (wish === 'mild') { if (k === 'storm') w /= ww * 2; else if (k === 'fair' || k === 'cloudy') w *= 1.5; }
  return Math.max(0, w);
}
function newWx() { return { k: 'fair', left: 480, cover: .32, rain: 0, snow: 0, fog: 0, storm: 0, sc: 0 }; }
function stepWeather(dt) {
  const on = S.settings.weather !== false;
  const w = S.wx || (S.wx = newWx());
  if (on) {
    w.left -= dt;
    if (w.left <= 0) {
      const se = LIGHT.season || seasonNow(), hr = LIGHT.sun ? LIGHT.sun.hr : 12;
      const opts = WXN[w.k].map(k => [k, wxWeight(k, se, hr)]).filter(o => o[1] > 0);
      const wish = S.doctrines && lever('weather'), jump = { sunny: 'clear', rainy: 'rain', snowy: 'snow', foggy: 'fog', stormy: 'storm', mild: 'fair' }[wish];
      w.k = jump && w.k !== jump && chance(.55 * leverW('weather')) ? jump : opts.length ? wpick(opts) : 'fair';
      const [a, b] = WXD[w.k]; w.left = rf(a, b) * 60;
    }
  }
  const T = on ? WXK[w.k] : WXK.fair, k = 1 - Math.exp(-dt / 70);
  for (const p of ['cover', 'rain', 'snow', 'fog', 'storm']) w[p] += ((T[p] || 0) - w[p]) * k;
  const se = LIGHT.season;
  if (!on) w.sc = 0;
  else if (w.snow > .3) w.sc = Math.min(1, w.sc + dt / 240 * w.snow);
  else w.sc = Math.max(0, w.sc - dt / ((se && se.winter > .5) ? 2400 : 500));
  if (on && w.storm > .5 && !DYN.intro && chance(dt / 11)) strike();
}
function setWeather(k, secs) { // dev + future levers
  const w = S.wx || (S.wx = newWx());
  w.k = k; w.left = secs || rf(...WXD[k]) * 60;
}
function strike() {
  const land = []; for (let k = 0; k < 30; k++) { const i = ri(0, W * H - 1); if (!M.water[i]) land.push(i); }
  if (!land.length) return;
  const i = pick(land), [wx, wy] = gridToWorld(i % W, (i / W) | 0, surfZ(i));
  const [ex, ey] = w2s(wx, wy);
  if (ex < 0 || ex > VW || ey < 0 || ey > VH) { DYN.flash = Math.max(DYN.flash || 0, .25); return; }
  const pts = []; let x = ex + rf(-120, 120), y = -10;
  const n = 9; for (let k = 0; k <= n; k++) { const f = k / n; pts.push([lerp(x, ex, f) + (k && k < n ? rf(-26, 26) : 0), lerp(y, ey, f)]); }
  DYN.bolt = { pts, t: 0 }; DYN.flash = Math.max(DYN.flash || 0, .55);
}

/* ---------- per-frame grade and sky colours ---------- */
const GK = [[18, 230, 160, 90, 0], [10, 226, 146, 76, .1], [5, 212, 116, 58, .2], [1, 178, 84, 78, .3], [-3, 84, 62, 122, .45], [-7, 32, 36, 92, .6], [-12, 12, 18, 50, .68]];
const SKYK = [
  [14, [134, 201, 224], [191, 226, 233], [246, 228, 204]],
  [6, [140, 186, 214], [236, 206, 176], [255, 204, 150]],
  [1, [96, 112, 164], [226, 150, 150], [255, 176, 120]],
  [-3, [48, 58, 110], [120, 92, 140], [214, 128, 120]],
  [-7, [18, 24, 62], [42, 44, 96], [96, 70, 112]],
  [-12, [7, 11, 34], [15, 23, 60], [30, 40, 82]]
];
function keyAt(K, v) {
  if (v >= K[0][0]) return K[0].slice(1);
  for (let k = 1; k < K.length; k++) if (v >= K[k][0]) {
    const a = K[k - 1], b = K[k], t = (v - b[0]) / (a[0] - b[0]);
    return b.slice(1).map((x, j) => Array.isArray(x) ? x.map((y, m) => lerp(y, a[j + 1][m], t)) : lerp(x, a[j + 1], t));
  }
  return K[K.length - 1].slice(1);
}
const mix3 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const rgbS = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function skyColors() {
  const sun = LIGHT.sun, w = S.wx || newWx();
  let [t, m, b] = sun.fixed ? SKYK[0].slice(1) : keyAt(SKYK, sun.el);
  const dk = LIGHT.dayK, oc = Math.pow(w.cover, 1.6) * .72 + w.rain * .1;
  if (oc > .01) {
    const gt = mix3([22, 25, 34], [168, 178, 188], dk), gm = mix3([30, 33, 44], [196, 202, 206], dk), gb = mix3([40, 43, 56], [214, 216, 216], dk);
    t = mix3(t, gt, oc); m = mix3(m, gm, oc); b = mix3(b, gb, oc);
  }
  if (w.storm > .01) { const s = w.storm * .65, g = mix3([14, 15, 22], [84, 90, 104], dk); t = mix3(t, g, s); m = mix3(m, g, s * .8); b = mix3(b, g, s * .6); }
  if (w.fog > .01) { const f = mix3([46, 50, 64], [214, 220, 224], dk), k = w.fog * .8; t = mix3(t, f, k); m = mix3(m, f, k); b = mix3(b, f, k); }
  return [t, m, b];
}
