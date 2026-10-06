/* ============================== light: the sun, the seasons, the colours of the night, the weather ============================== */
// LIGHT.cur is the light the building art reads while a 3D chunk is built (gl.js turns it flat: GLT_FLAT); the shader
// does the real lighting every frame. lightTick keeps the sun, the season, the weather and the day/night amounts going.
const DEG = Math.PI / 180;
const HOME = { lat: 55.861, lon: 9.85, name: 'Horsens' };
let LT = null;
const LIGHT = { cur: null, chk: 0, sun: null, season: null, seasonT: 0, emK: 0, nightK: 0, dayK: 1, night: false };
const q2 = f => Math.round(f * 100) / 100;
const qs = (v, s) => Math.round(v / s) * s;
const SNOWC = '#eef2fa';

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
const LV_SEASON = { spring: { autumn: 0, winter: 0, spring: 1 }, summer: { autumn: 0, winter: 0, spring: 0 }, autumn: { autumn: 1, winter: 0, spring: 0 }, winter: { autumn: 0, winter: 1, spring: 0 } };
function seasonFor() { return LIGHT.forceSeason || LV_SEASON[LVV.seasons] || seasonNow(); } // (a season the Watcher's words asked to stay)
function litFrac(hr, el) {
  if (el > 4) return 0;
  const bt = LVV.bedtime, f = bt === 'never' ? .85 : bt === 'early' ? (hr >= 16 && hr < 21 ? .7 : .12) : bt === 'late' ? (hr >= 16 || hr < 3 ? .85 : .55) : hr >= 16 && hr < 23 ? .8 : (hr >= 23 || hr < 1) ? .6 : hr < 4.5 ? .3 : .5;
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
function leafC(col, f) { let c = LT.leaf[1] ? mix(col, LT.leaf[0], LT.leaf[1]) : col; c = shade(c, q2((f || 1) * LT.fG)); return c; }

function lightTick(dt) {
  if (!S) return;
  LIGHT.sun = sunNow();
  if (!LIGHT.season || (LIGHT.seasonT -= dt) <= 0) { LIGHT.season = seasonFor(); LIGHT.seasonT = 300; }
  stepWeather(dt);
  const el = LIGHT.sun.el, fx = LIGHT.sun.fixed;
  LIGHT.emK = fx ? 0 : sstep(4, -6, el);
  LIGHT.nightK = fx ? 0 : sstep(0, -9, el);
  LIGHT.dayK = fx ? 1 : sstep(-6, 4, el);
  if ((LIGHT.chk -= dt) <= 0) { // what the art takes from the light (the era's lamps, the night's custom, gardens) changed: rebuild the view
    LIGHT.chk = 1.5; const env = envNow(), k = [env.era, env.nl || '', env.gd || 0, LVA].join('|'); // (and the customs the buildings show: house colours, trees, decorations)
    if (!LIGHT.cur || k !== LIGHT.artKey) { LIGHT.cur = LT = mkLight(env); if (LIGHT.artKey != null && GL3.on) for (let n = 0; n < GNC * GNC; n++) GL3.dirty.add(n); LIGHT.artKey = k; }
  }
  const night = LIGHT.nightK > .5 || S.wx && S.wx.storm > .6 && LIGHT.dayK < 1;
  if (night !== LIGHT.night) { LIGHT.night = night; document.body.classList.toggle('night', night); }
}
function relightNow() { LIGHT.chk = 0; LIGHT.artKey = ''; }
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
  const T = on ? WXK[w.k] : WXK.fair, k = 1 - Math.exp(-dt / (w.quick > 0 ? 1.2 : 70)); if (w.quick > 0) w.quick -= dt; // (quick: the ☀️ button)
  for (const p of ['cover', 'rain', 'snow', 'fog', 'storm']) w[p] += ((T[p] || 0) - w[p]) * k;
  const se = LIGHT.season;
  if (!on) w.sc = 0;
  else if (w.snow > .3) w.sc = Math.min(1, w.sc + dt / 240 * w.snow);
  else w.sc = Math.max(0, w.sc - dt / ((se && se.winter > .5) ? 2400 : 500));
  if (on && w.storm > .5 && !DYN.intro && chance(dt / 11)) strike();
}
// the dock's ☀️ (W): clear skies now, for half an hour or so, the clouds and fog lifting in a few seconds rather than a minute
// (weather is the view's alone: the sim never reads it). The Weather option turns it off for good.
function clearSkies() {
  const w = S.wx || (S.wx = newWx()); setWeather('clear', rf(25, 40) * 60); w.quick = 6;
  toast(S.settings.weather === false ? 'The weather is off already: always fair (Options)' : '☀️ The clouds part. Fair skies for a good while (untick Weather in the options for always).');
}
function setWeather(k, secs) { // dev + future levers
  const w = S.wx || (S.wx = newWx());
  w.k = k; w.left = secs || rf(...WXD[k]) * 60;
}
function strike() { // lightning: a bolt somewhere near the camera, from the clouds to the ground
  const e = GL3.eye || [W / 2, 0, H / 2], c = GL3.cam || { tx: W / 2, tz: H / 2 };
  const x = clamp(c.tx + rf(-12, 12), 0, W - 1), y = clamp(c.tz + rf(-12, 12), 0, H - 1), g = gGround(x, y);
  if (Math.hypot(x - e[0], y - e[2]) > 60) { DYN.flash = Math.max(DYN.flash || 0, .25); return; }
  const pts = [], x0 = x + rf(-3, 3), z0 = y + rf(-3, 3), n = 10; for (let k = 0; k <= n; k++) { const f = k / n, j = k && k < n ? .5 : 0; pts.push([lerp(x0, x, f) + rf(-j, j), lerp(g + 14, g, f), lerp(z0, y, f) + rf(-j, j)]); }
  DYN.bolt = { pts, t: 0 }; DYN.flash = Math.max(DYN.flash || 0, .55);
}

const rgbS = (c, a) => a == null ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})` : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
