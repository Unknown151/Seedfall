/* ============================== view, camera, dynamic layer ============================== */
let CV, CX, VW = 1920, VH = 1080, DPR = 1, PLD = null, PLN = null, STARC = null;
const CAM = { x: 0, y: 0, z: 2.5, tx: 0, ty: 0, tz: 2.5, manualUntil: 0, nextTour: 0, focusUntil: 0 };
const DYN = { walkers: [], vehicles: [], trains: [], boats: [], herds: [], flyers: [], parts: [], caps: [], clouds: [], birds: [], giants: [], rockets: [], drops: [], meteors: [], caravans: [], traders: [], ships: [], slot: {}, ferries: [], planes: [], af: {}, rains: [], anim: [], comet: null, intro: null, t: 0, hover: -1 };
const CLOTH = ['#e5874f', '#5e9c8f', '#d6a44a', '#8f79cf', '#e76f84', '#4f86c6', '#7fb069', '#f2f0ea', '#c9674a', '#6c7a89'];
const SKIN = ['#f1d2b6', '#d9a47f', '#b27b56', '#8a5a3c', '#f4c7a1', '#6b4a35'];

function initView() {
  CV = document.getElementById('view'); CX = CV.getContext('2d');
  resize(); addEventListener('resize', resize);
}
function resize() {
  DPR = Math.min(devicePixelRatio || 1, 2);
  VW = innerWidth; VH = innerHeight;
  CV.width = Math.round(VW * DPR); CV.height = Math.round(VH * DPR);
  buildSky();
}
function minZoom() { return Math.min(VW / (STATIC_W * 0.92), VH / (STATIC_H * 0.8)); }
function w2s(wx, wy) { return [(wx - CAM.x) * CAM.z + VW / 2, (wy - CAM.y) * CAM.z + VH / 2]; }
function s2w(sx, sy) { return [(sx - VW / 2) / CAM.z + CAM.x, (sy - VH / 2) / CAM.z + CAM.y]; }

/* ---------- sky ---------- */
function paintPlanet(c, w, h, night) {
  const R = h * .24, px = w * .84, py = h * .19;
  c.save(); c.beginPath(); c.arc(px, py, R, 0, TAU); c.clip();
  c.fillStyle = '#cdb9e6'; c.fillRect(px - R, py - R, R * 2, R * 2);
  const bands = ['#d9c7ee', '#bfa9dc', '#e2d2f0', '#c7b0e0', '#d4c0ea', '#b9a3d8', '#e6d9f2'];
  for (let k = 0; k < 16; k++) { c.fillStyle = bands[k % bands.length]; const y0 = py - R + k * R / 8 + Math.sin(k * 1.7) * 4; c.fillRect(px - R, y0, R * 2, R / 8 * (0.6 + (k % 3) * .25)); }
  const sh = c.createRadialGradient(px - R * .45, py - R * .4, R * .1, px, py, R * 1.05);
  sh.addColorStop(0, 'rgba(255,255,255,.25)'); sh.addColorStop(.6, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(80,60,120,.35)');
  c.fillStyle = sh; c.fillRect(px - R, py - R, R * 2, R * 2);
  if (night) { // mostly in shadow, a thin lit crescent
    c.fillStyle = 'rgba(16,18,46,.55)'; c.fillRect(px - R, py - R, R * 2, R * 2);
    c.fillStyle = 'rgba(10,12,34,.72)'; c.beginPath(); c.arc(px - R * .3, py - R * .22, R * 1.02, 0, TAU); c.fill();
  }
  c.restore();
  c.save(); c.translate(px, py); c.rotate(-.35);
  c.strokeStyle = night ? 'rgba(170,165,200,.45)' : 'rgba(245,238,250,.75)'; c.lineWidth = R * .06; c.beginPath(); c.ellipse(0, 0, R * 1.65, R * .32, 0, Math.PI * 1.02, Math.PI * 1.98, true); c.stroke();
  c.strokeStyle = night ? 'rgba(140,130,180,.35)' : 'rgba(220,205,240,.6)'; c.lineWidth = R * .025; c.beginPath(); c.ellipse(0, 0, R * 1.85, R * .38, 0, Math.PI * 1.02, Math.PI * 1.98, true); c.stroke();
  c.restore();
  if (!night) { c.fillStyle = 'rgba(200,228,236,.28)'; c.beginPath(); c.arc(px, py, R * 1.02, 0, TAU); c.fill(); }
  // moons
  const mr = h * .028, mx = w * .13, my = h * .15;
  if (night) { const g = c.createRadialGradient(mx, my, mr * .8, mx, my, mr * 4); g.addColorStop(0, 'rgba(220,225,255,.35)'); g.addColorStop(1, 'rgba(220,225,255,0)'); c.fillStyle = g; c.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8); }
  c.fillStyle = '#f3f2f7'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
  c.fillStyle = 'rgba(160,150,190,.35)'; c.beginPath(); c.arc(mx - mr * .3, my - mr * .1, mr * .25, 0, TAU); c.fill(); c.beginPath(); c.arc(mx + mr * .35, my + mr * .3, mr * .15, 0, TAU); c.fill();
  c.fillStyle = night ? '#fff3e0' : '#f7ecde'; c.beginPath(); c.arc(w * .31, h * .08, mr * .45, 0, TAU); c.fill();
}
function buildSky() {
  const w = CV.width, h = CV.height;
  PLD = mkCanvas(w, h); paintPlanet(PLD.getContext('2d'), w, h, false);
  PLN = mkCanvas(w, h); paintPlanet(PLN.getContext('2d'), w, h, true);
  STARC = mkCanvas(w, h); const c = STARC.getContext('2d'), r = mulberry32(99);
  for (let k = 0; k < 520; k++) {
    const x = r() * w, y = Math.pow(r(), 1.4) * h * .8, a = .25 + r() * .7, s = (r() < .06 ? 2.2 : r() < .3 ? 1.5 : 1) * DPR;
    c.fillStyle = `rgba(${r() < .2 ? '255,230,210' : r() < .3 ? '210,225,255' : '255,255,255'},${a})`; c.fillRect(x, y, s, s);
  }
  for (let k = 0; k < 900; k++) { // a faint galaxy band
    const t = r(), x = t * w, y = h * (.05 + t * .38) + (r() - .5) * h * .12 * (1 + Math.sin(t * 9) * .3);
    c.fillStyle = `rgba(230,225,255,${.08 + r() * .22})`; c.fillRect(x, y, DPR, DPR);
  }
}
function drawSkyBehind(c, t) { // everything here goes behind what's already drawn (destination-over), front-most first
  const sun = LIGHT.sun, w = S.wx || newWx();
  c.globalCompositeOperation = 'destination-over';
  drawSky(c, t);
  if (DYN.skyStreaks) for (const s of DYN.skyStreaks) { c.strokeStyle = `rgba(255,255,255,${.9 * (1 - s.t)})`; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x - 80 * s.t - 20, s.y + 40 * s.t + 10); c.stroke(); }
  // planet and moons, crossfading to their night look
  const n = LIGHT.nightK, pa = 1 - Math.min(.92, sstep(.35, .95, w.cover) * .9 + w.fog * .7);
  c.setTransform(1, 0, 0, 1, 0, 0);
  if (n < .99) { c.globalAlpha = (1 - n) * pa; c.drawImage(PLD, 0, 0); }
  if (n > .01) { const a1 = (1 - n) * pa; c.globalAlpha = Math.min(1, n * pa / Math.max(.01, 1 - a1)); c.drawImage(PLN, 0, 0); }
  c.globalAlpha = 1; c.setTransform(DPR, 0, 0, DPR, 0, 0);
  // sun low over the horizon
  if (!sun.fixed && sun.el > -5 && sun.el < 24) {
    const L = LIGHT.cur, side = clamp((Math.cos(sun.th * DEG) - Math.sin(sun.th * DEG)) / 1.2, -1.1, 1.1);
    const sx = VW * (.5 + .44 * side), sy = VH * (.5 - .016 * sun.el), low = sstep(24, 2, sun.el) * sstep(-5, 0, sun.el) * (1 - w.cover * .85) * (1 - w.fog * .8);
    if (low > .01 && Math.abs(side) > .35) {
      c.globalAlpha = low * Math.min(1, (Math.abs(side) - .35) * 3);
      c.fillStyle = '#fff4d8'; c.beginPath(); c.arc(sx, sy, 20, 0, TAU); c.fill();
      const g = c.createRadialGradient(sx, sy, 10, sx, sy, VH * .7);
      g.addColorStop(0, 'rgba(255,214,150,.75)'); g.addColorStop(.25, 'rgba(255,190,130,.28)'); g.addColorStop(1, 'rgba(255,170,120,0)');
      c.fillStyle = g; c.fillRect(0, 0, VW, VH); c.globalAlpha = 1;
    }
  }
  const sk = sun.fixed ? 0 : sstep(-2, -10, sun.el) * (1 - sstep(.25, .8, w.cover)) * (1 - w.fog);
  if (sk > .01) { c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = sk; c.drawImage(STARC, 0, 0); c.globalAlpha = 1; c.setTransform(DPR, 0, 0, DPR, 0, 0); }
  const [t0, m0, b0] = skyColors();
  const g = c.createLinearGradient(0, 0, 0, VH); g.addColorStop(0, rgbS(t0)); g.addColorStop(.55, rgbS(m0)); g.addColorStop(1, rgbS(b0));
  c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  c.globalCompositeOperation = 'source-over';
}
function drawSky(c, t) {
  // ring built by the colonists (arc across the sky)
  if (S.sky.ring > 0) {
    c.save(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3;
    c.beginPath(); c.ellipse(VW * .5, VH * 1.25, VW * .95, VH * 1.05, 0, Math.PI * 1.08, Math.PI * (1.08 + .84 * S.sky.ring)); c.stroke();
    c.strokeStyle = 'rgba(200,225,255,.35)'; c.lineWidth = 7; c.stroke(); c.restore();
  }
  for (let k = 0; k < S.sky.sats; k++) {
    const sp = 0.012 + (k % 5) * .004, ph = (t * sp + k * .37) % 1.2 - .1;
    const x = ph * VW, y = VH * (.06 + (k * .071) % .3) + Math.sin(ph * 3 + k) * 20;
    c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x, y, 2, 2);
  }
  if (S.sky.station) {
    const ph = (t * .006) % 1.3 - .15, x = ph * VW, y = VH * .12 + Math.sin(ph * 2) * 30;
    c.fillStyle = 'rgba(255,255,255,.95)'; c.fillRect(x - 5, y - .5, 10, 1.5); c.fillRect(x - .7, y - 3, 1.5, 6);
    c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(x, y, 4, 0, TAU); c.fill();
  }
  if (DYN.comet) {
    const cm = DYN.comet, a = Math.min(1, cm.t / 5, (cm.life - cm.t) / 5);
    c.save(); c.globalAlpha = a * .85;
    const g = c.createLinearGradient(cm.x, cm.y, cm.x + 160, cm.y - 50); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.strokeStyle = g; c.lineWidth = 5; c.beginPath(); c.moveTo(cm.x, cm.y); c.lineTo(cm.x + 160, cm.y - 50); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cm.x, cm.y, 3.5, 0, TAU); c.fill(); c.restore();
  }
}

/* ---------- camera ---------- */
function colonyBounds() {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const T of towns()) {
    const r = townRadius(T) + 2.5;
    const pts = [[T.x - r, T.y - r], [T.x + r, T.y - r], [T.x - r, T.y + r], [T.x + r, T.y + r]];
    for (const [gx, gy] of pts) { const [wx, wy] = gridToWorld(gx, gy, 20); x0 = Math.min(x0, wx); x1 = Math.max(x1, wx); y0 = Math.min(y0, wy - 30); y1 = Math.max(y1, wy); }
  }
  return [x0, y0, x1, y1];
}
function overviewTarget() {
  const [x0, y0, x1, y1] = colonyBounds();
  const z = clamp(Math.min(VW / (x1 - x0 + 120), VH / (y1 - y0 + 120)), minZoom(), 3.2);
  return [(x0 + x1) / 2, (y0 + y1) / 2, z];
}
function focusOn(x, y, zmul = 1.5, hold = 30) {
  const [wx, wy] = gridToWorld(x, y, landZ(idx(clamp(x | 0, 0, W - 1), clamp(y | 0, 0, H - 1))));
  const [, , oz] = overviewTarget();
  CAM.tx = wx; CAM.ty = wy - 10; CAM.tz = clamp(oz * zmul, minZoom(), 3.4);
  CAM.focusUntil = DYN.t + hold;
}
function stepCamera(dt) {
  const manual = DYN.t < CAM.manualUntil;
  if (!manual && CAM.followPid && DYN.t < CAM.followUntil) {
    const w = DYN.walkers.find(w => w.pid === CAM.followPid);
    if (w) { const p = walkerPos(w); if (p) { const [wx, wy] = gridToWorld(p[0], p[1], p[2]); CAM.tx = wx; CAM.ty = wy - 6; } else if (w.tile >= 0) { const [wx, wy] = gridToWorld(w.tile % W, (w.tile / W) | 0, surfZ(w.tile)); CAM.tx = wx; CAM.ty = wy - 10; } CAM.tz = 3; CAM.focusUntil = DYN.t + 3; }
    else CAM.followPid = null;
  }
  if (!manual) {
    if (DYN.intro) { /* intro drives the camera */ }
    else if (DYN.t >= CAM.focusUntil) {
      const [ox, oy, oz] = overviewTarget();
      if (DYN.t > CAM.nextTour) {
        CAM.nextTour = DYN.t + 40 + rnd() * 30;
        const recent = S.chron.slice(-8).filter(e => e.tx != null);
        if (chance(.45) && recent.length) { const e = pick(recent); focusOn(e.tx, e.ty, 1.55, 28); }
        else if (chance(.4) && towns().length > 1) { const T = pick(towns()); focusOn(T.x, T.y, 1.4, 26); }
        else { CAM.tx = ox + rf(-40, 40); CAM.ty = oy + rf(-20, 20); CAM.tz = oz; CAM.focusUntil = DYN.t + 25; }
      } else { CAM.tx = lerp(CAM.tx, ox, .002); CAM.ty = lerp(CAM.ty, oy, .002); CAM.tz = lerp(CAM.tz, oz, .002); }
    }
  }
  const fol = CAM.followPid && DYN.t < CAM.followUntil;
  const k = 1 - Math.exp(-dt * (manual ? 12 : fol ? 1.6 : 0.35)), kz = 1 - Math.exp(-dt * (manual ? 12 : fol ? 1 : 0.25));
  CAM.x += (CAM.tx - CAM.x) * k; CAM.y += (CAM.ty - CAM.y) * k; CAM.z += (CAM.tz - CAM.z) * kz;
  CAM.x = clamp(CAM.x, 100, STATIC_W - 100); CAM.y = clamp(CAM.y, 60, STATIC_H - 60);
}

/* ---------- FX dispatch ---------- */
function processFX() {
  while (FXQ.length) {
    const f = FXQ.shift();
    switch (f.k) {
      case 'caption': if (S.settings.captions) addCaption(f); break;
      case 'fireworks': DYN.fireworks = (DYN.fireworks || []); DYN.fireworks.push({ x: f.x, y: f.y, t: 0, life: 9, next: 0 }); break;
      case 'rain': DYN.rains.push({ x: f.x, y: f.y, t: 0, life: f.big ? 16 : 10 }); break;
      case 'herd': spawnHerd(f.x, f.y, true); break;
      case 'birds': spawnBirds(f.x, f.y); break;
      case 'giant': spawnGiant(); break;
      case 'meteors': DYN.meteorShower = 20; break;
      case 'comet': DYN.comet = { x: VW * rf(.2, .6), y: VH * rf(.08, .2), t: 0, life: 80 }; break;
      case 'caravan': spawnCaravan(f.from, f.to, f.n); break;
      case 'trade': if (f.sea) { const A = S.T[f.from], B = S.T[f.to], ha = A && townHarbour(A), hb = B && townHarbour(B); if (ha && hb && !DYN.slot[ha.id]) { const sh = spawnShip(ha, hb, f.r); if (sh) DYN.slot[ha.id] = sh; } } else spawnTrader(f.from, f.to, f.r); break;
      case 'launch': launchRocket(f.id); break;
      case 'seedship': { const e = Object.values(S.B).find(B => B.type === 'elevator' || B.type === 'launchpad'); if (e) launchRocket(e.id, true); break; }
      case 'drop': DYN.drops.push({ x: f.x, y: f.y, t: 0 }); focusOn(f.x, f.y, 1.7, 14); break;
      case 'meteor': DYN.meteors.push({ x: f.x, y: f.y, t: 0 }); focusOn(f.x, f.y, 1.5, 14); break;
      case 'sparkle': for (let k = 0; k < 60; k++) { const [wx, wy] = gridToWorld(f.x + rf(-2, 2), f.y + rf(-2, 2), 14); addPart(wx, wy, rf(-3, 3), rf(-14, -4), rf(1.5, 3), pick(['#fff6c2', '#ffd66b', '#bff3ff', '#ffc2e0']), .9, 'spark'); } break;
    }
  }
}
function addCaption(f) {
  const [wx, wy] = gridToWorld(f.x, f.y, landZ(idx(clamp(f.x, 0, W - 1), clamp(f.y, 0, H - 1))) + 34);
  DYN.caps.push({ wx, wy, ic: f.ic, t: f.t, age: 0, life: f.major ? 20 : 14, major: f.major });
  if (DYN.caps.length > 5) DYN.caps.shift();
}
function addPart(x, y, vx, vy, life, col, a, kind, size) {
  if (DYN.parts.length > 900) return;
  DYN.parts.push({ x, y, vx, vy, life, age: 0, col, a, kind, size: size || 1 });
}

/* ---------- walkers ---------- */
function syncWalkers() {
  syncPeople();
  // drone helper in the early years
  if (S.year < 60 && !DYN.drone && !S.flags.intro) DYN.drone = { t: 0 };
  if (S.year >= 60) DYN.drone = null;
  // boats
  syncBoats();
  // trains
  for (const r of S.rails) {
    if (!r.path || DYN.trains.some(tr => tr.r === r)) continue;
    DYN.trains.push({ r, s: 0, dir: 1, wait: rf(0, 6) });
  }
  DYN.trains = DYN.trains.filter(tr => S.rails.includes(tr.r));
  // herds in the wild
  if (DYN.herds.length < 3 && chance(.02)) spawnHerd(null, null, false);
  // anim list
  DYN.anim = Object.values(S.B).filter(B => B.prog >= 1 && (BT[B.type].anim || BT[B.type].smoke));
}
function stepAgent(a, dt, chooser) {
  a.t += dt * a.spd;
  let guard = 0;
  while (a.t >= 1 && guard++ < 4) { a.t -= 1; a.prev = a.a; a.a = a.b; a.b = chooser(a); }
}
function agentPos(a) {
  const ax = a.a % W, ay = (a.a / W) | 0, bx = a.b % W, by = (a.b / W) | 0;
  const t = a.t;
  const fx = lerp(ax, bx, t), fy = lerp(ay, by, t);
  const za = M.water[a.a] ? landZ(a.a) + 2 : surfZ(a.a), zb = M.water[a.b] ? landZ(a.b) + 2 : surfZ(a.b);
  let z = lerp(za, zb, smooth(t));
  return [fx, fy, z];
}

/* ---------- fauna ---------- */
function spawnHerd(x, y, near) {
  let cx = x, cy = y;
  if (!near || cx == null) {
    for (let t = 0; t < 200; t++) {
      const i = ri(0, W * H - 1), tx = i % W, ty = (i / W) | 0;
      if (M.water[i] || M.bld[i] || (M.bio[i] !== BIO.MEADOW && M.bio[i] !== BIO.LUSH)) continue;
      const T = nearestTown(tx, ty); if (T && dist(tx, ty, T.x, T.y) < townRadius(T) + 4) continue;
      cx = tx; cy = ty; break;
    }
  } else { const s = wildTileNear(Math.round(x), Math.round(y), 6); if (s) { cx = s.x; cy = s.y; } }
  if (cx == null) return;
  const n = ri(4, 7), h = { members: [], life: near ? 120 : 400, age: 0 };
  for (let k = 0; k < n; k++) {
    const i = idx(cx, cy);
    h.members.push({ a: i, b: i, prev: -1, t: rnd(), spd: rf(.06, .12), size: rf(.8, 1.2), pause: rf(0, 4), baby: chance(.2) });
  }
  h.cx = cx; h.cy = cy;
  DYN.herds.push(h);
}
function herdNext(m, h) {
  const x = m.a % W, y = (m.a / W) | 0, opts = [];
  for (const [dx, dy] of N8) {
    const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
    if (M.water[j] || (M.bld[j] && S.B[M.bld[j]] && S.B[M.bld[j]].type !== 'farm') || Math.abs(M.elev[j] - M.elev[m.a]) > 1) continue;
    opts.push([j, 1 / (1 + dist(nx, ny, h.cx, h.cy))]);
  }
  return opts.length ? wpick(opts) : m.a;
}
function spawnBirds(x, y) {
  const [wx, wy] = x != null ? gridToWorld(x, y, 60) : [rf(0, STATIC_W), rf(100, 600)];
  const dir = chance(.5) ? 1 : -1;
  DYN.birds.push({ x: wx - dir * 500, y: wy - 60, vx: dir * 38, vy: rf(-4, 4), n: ri(5, 9), t: 0, life: 40 });
}
function spawnGiant() {
  const fromLeft = chance(.5);
  const y0 = rf(18, 46);
  DYN.giants.push({ fx: fromLeft ? -2 : W + 2, fy: y0, dx: fromLeft ? 1 : -1, dy: rf(-.25, .25), t: 0, spd: .09 });
}
function launchRocket(bid, seed) {
  const B = S.B[bid]; if (!B) return;
  const [wx, wy] = gridToWorld(B.x, B.y, landZ(idx(B.x, B.y)));
  DYN.rockets.push({ x: wx, y: wy, alt: 0, v: 0, t: 0, seed: !!seed, bid });
  if (B.type === 'launchpad') { B.rk = 0; markDirty(idx(B.x, B.y)); }
  focusOn(B.x, B.y, 1.2, 22);
}

/* ---------- intro ---------- */
function startIntro() {
  const L = S.landing;
  const [wx, wy] = gridToWorld(L.x, L.y, landZ(idx(L.x, L.y)));
  DYN.intro = { t: 0, wx, wy };
  CAM.x = CAM.tx = wx - 120; CAM.y = CAM.ty = wy - 240; CAM.z = CAM.tz = 1.25;
}
function stepIntro(dt) {
  const I = DYN.intro; if (!I) return;
  I.t += dt;
  const T0 = 5.5;
  if (I.t < T0) {
    const f = I.t / T0, e = f * f;
    const x = I.wx - 260 * (1 - e), y = I.wy - 12 - 440 * (1 - e);
    I.px = x; I.py = y;
    CAM.tx = lerp(x, I.wx, .55); CAM.ty = lerp(y, I.wy, .6); CAM.tz = lerp(1.25, 2.4, smooth(f));
    for (let k = 0; k < 5; k++) addPart(x + rf(-2, 2), y + rf(-2, 2), rf(-8, 8) - 30, rf(-8, 8) - 50, rf(.8, 1.8), pick(['#ffd28a', '#ff9d5c', '#fff1c9']), .95, 'fire', rf(2.5, 5));
    if (chance(.5)) addPart(x, y, rf(-5, 5) - 20, -30, rf(1.5, 3), '#d9d4cf', .5, 'smoke', 3);
  } else if (!I.landed) {
    I.landed = 1; CAM.tx = I.wx; CAM.ty = I.wy - 20; CAM.tz = 2.8;
    const pod = Object.values(S.B).find(B => B.type === 'pod'); if (pod) { pod.hid = 0; markDirty(idx(pod.x, pod.y)); }
    for (let k = 0; k < 70; k++) addPart(I.wx + rf(-6, 6), I.wy - 4, rf(-40, 40), rf(-40, -5), rf(1, 2.6), pick(['#cdb79a', '#b99f80', '#e8dccb']), .8, 'dust', rf(2, 5));
    DYN.flash = 1;
  } else if (I.t > T0 + 2.5) {
    DYN.intro = null; S.flags.intro = 0;
    introChronicle();
    CAM.focusUntil = DYN.t + 20; CAM.nextTour = DYN.t + 30;
  }
}

/* ---------- update ---------- */
function updateDyn(dt) {
  DYN.t += dt;
  stepIntro(dt);
  stepAgents(dt);
  stepBoats(dt); stepShips(dt); stepFerries(dt); stepPlanes(dt);
  for (const tr of DYN.trains) {
    if (tr.wait > 0) { tr.wait -= dt; continue; }
    const sp = hasTech('maglev') ? 3.2 : hasTech('electric') ? 2 : 1.3;
    tr.s += tr.dir * sp * dt;
    const L = tr.r.path.length - 1;
    if (tr.s >= L) { tr.s = L; tr.dir = -1; tr.wait = rf(4, 9); }
    if (tr.s <= 0) { tr.s = 0; tr.dir = 1; tr.wait = rf(4, 9); }
  }
  for (const h of DYN.herds) {
    h.age += dt;
    for (const m of h.members) { if (m.pause > 0) { m.pause -= dt; continue; } stepAgent(m, dt, a => herdNext(a, h)); if (chance(dt * .15)) m.pause = rf(2, 7); }
    if (chance(dt * .02)) { const s = h.members[0]; h.cx = clamp((s.a % W) + ri(-4, 4), 1, W - 2); h.cy = clamp(((s.a / W) | 0) + ri(-4, 4), 1, H - 2); }
  }
  DYN.herds = DYN.herds.filter(h => h.age < h.life);
  for (const b of DYN.birds) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; }
  DYN.birds = DYN.birds.filter(b => b.t < b.life);
  for (const g of DYN.giants) { g.t += dt; g.fx += g.dx * g.spd * dt; g.fy += g.dy * g.spd * dt; }
  DYN.giants = DYN.giants.filter(g => g.fx > -4 && g.fx < W + 4);
  // rockets
  for (const r of DYN.rockets) {
    r.t += dt;
    if (r.t > 2) { r.v += dt * (r.seed ? 50 : 70); r.alt += r.v * dt; }
    const n = r.t < 2 ? 2 : 4;
    for (let k = 0; k < n; k++) addPart(r.x + rf(-2, 2), r.y - r.alt, rf(-12, 12), rf(4, 22), rf(1.2, 3), r.t < 2 ? '#eeeae4' : pick(['#fff1c9', '#ffd28a', '#f2efe9', '#e4e0da']), .8, 'smoke', rf(3, 6));
  }
  for (const r of DYN.rockets) if (r.alt > 2200 && !r.done) { r.done = 1; const B = S.B[r.bid]; if (B && B.type === 'launchpad') setTimeout(() => { if (S.B[r.bid]) { S.B[r.bid].rk = 1; markDirty(idx(B.x, B.y)); } }, 45000); }
  DYN.rockets = DYN.rockets.filter(r => !r.done);
  // drops and meteors
  for (const d of DYN.drops) {
    d.t += dt;
    if (d.t > 4 && !d.hit) { d.hit = 1; const [wx, wy] = gridToWorld(d.x, d.y, landZ(idx(d.x, d.y))); for (let k = 0; k < 30; k++) addPart(wx, wy - 2, rf(-25, 25), rf(-25, -4), rf(.8, 1.8), '#d8c9b0', .7, 'dust', rf(2, 4)); }
  }
  DYN.drops = DYN.drops.filter(d => d.t < 9);
  for (const m of DYN.meteors) {
    m.t += dt;
    const [wx, wy] = gridToWorld(m.x, m.y, landZ(idx(m.x, m.y)));
    if (m.t < 2.6) { const f = m.t / 2.6; const x = wx + 600 * (1 - f), y = wy - 900 * (1 - f); for (let k = 0; k < 4; k++) addPart(x, y, rf(-10, 10) + 60, rf(-10, 10) - 90, rf(.5, 1.2), pick(['#fff4c2', '#ffc27a', '#ffffff']), .9, 'fire', rf(2, 5)); m.px = x; m.py = y; }
    else if (!m.hit) { m.hit = 1; DYN.flash = .8; for (let k = 0; k < 80; k++) addPart(wx, wy - 3, rf(-50, 50), rf(-60, -5), rf(1, 2.8), pick(['#b9a99a', '#ffe2a8', '#8f8175']), .85, 'dust', rf(2, 6)); }
  }
  DYN.meteors = DYN.meteors.filter(m => m.t < 6);
  // fireworks
  if (DYN.fireworks) {
    for (const f of DYN.fireworks) {
      f.t += dt; f.next -= dt;
      if (f.next <= 0 && f.t < f.life - 1.5) {
        f.next = rf(.25, .7);
        const [wx, wy] = gridToWorld(f.x + rf(-1.5, 1.5), f.y + rf(-1.5, 1.5), landZ(idx(clamp(f.x, 0, W - 1), clamp(f.y, 0, H - 1))) + rf(45, 85));
        const col = pick(['#ff6b8b', '#ffd66b', '#7fe0ff', '#b98cff', '#8cffb0', '#ffffff']);
        for (let k = 0; k < 28; k++) { const a = rnd() * TAU, s = rf(12, 26); addPart(wx, wy, Math.cos(a) * s, Math.sin(a) * s * .8, rf(1, 1.8), col, 1, 'spark', 1.3); }
      }
    }
    DYN.fireworks = DYN.fireworks.filter(f => f.t < f.life);
  }
  // rain
  for (const r of DYN.rains) {
    r.t += dt;
    if (r.t < r.life - 3) for (let k = 0; k < 6; k++) {
      const [wx, wy] = gridToWorld(r.x + rf(-3.5, 3.5), r.y + rf(-3.5, 3.5), 0);
      addPart(wx + 10, wy - 150 - rf(0, 40), -8, 190, .85, '#9fc6de', .55, 'rain');
    }
  }
  DYN.rains = DYN.rains.filter(r => r.t < r.life);
  if (DYN.meteorShower > 0) { DYN.meteorShower -= dt; if (chance(dt * 1.5)) DYN.skyStreaks = (DYN.skyStreaks || []).concat([{ x: rf(0, VW), y: rf(0, VH * .3), t: 0 }]); }
  if (DYN.skyStreaks) { for (const s of DYN.skyStreaks) s.t += dt; DYN.skyStreaks = DYN.skyStreaks.filter(s => s.t < 1); }
  if (DYN.comet) { DYN.comet.t += dt; if (DYN.comet.t > DYN.comet.life) DYN.comet = null; }
  // particles
  for (const p of DYN.parts) {
    p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.kind === 'smoke' || p.kind === 'mist') { p.vx *= .99; p.vy *= .99; p.size += dt * 2.2; }
    else if (p.kind === 'spark') { p.vy += 9 * dt; p.vx *= .985; }
    else if (p.kind === 'dust') { p.vy += 40 * dt; p.vx *= .96; }
  }
  DYN.parts = DYN.parts.filter(p => p.age < p.life);
  // emitters
  emitters(dt);
  for (const c of DYN.caps) c.age += dt;
  DYN.caps = DYN.caps.filter(c => c.age < c.life);
  if (DYN.flash) DYN.flash = Math.max(0, DYN.flash - dt * 1.6);
  stepClouds(dt);
  stepLanterns(dt);
}
function inView(wx, wy, m = 80) {
  const [sx, sy] = w2s(wx, wy); return sx > -m && sy > -m && sx < VW + m && sy < VH + m;
}
function emitters(dt) {
  for (const B of DYN.anim) {
    const d = BT[B.type];
    if (!d.smoke && B.type !== 'terraformer' && B.type !== 'launchpad') continue;
    const [cx, cy] = gridToWorld(B.x, B.y, landZ(idx(B.x, B.y)));
    if (!inView(cx, cy, 200)) continue;
    const rate = (B.type === 'terraformer' ? 1.2 : d.smoke * .5) * dt;
    if (!chance(rate)) continue;
    if (B.type === 'workshop') { const [x, y] = pt(cx, cy, .16, -.14, 21); addPart(x, y, rf(2, 5), rf(-9, -5), rf(3, 5), '#e2ddd8', .45, 'smoke', 1.6); }
    else if (B.type === 'works') { const [x, y] = pt(cx, cy, .28, -.18, 43); addPart(x, y, rf(3, 7), rf(-11, -6), rf(4, 7), sootK() >= .5 ? '#a8a29d' : '#f1efec', .5, 'smoke', 2.2); }
    else if (B.type === 'power') { for (const u of [-.16, .16]) { const [x, y] = pt(cx, cy, u, -.2, 37); addPart(x, y, rf(2, 6), rf(-10, -6), rf(4, 6), sootK() >= .5 ? '#b3ada8' : '#f4f2ef', .5, 'smoke', 2.4); } }
    else if (B.type === 'glassworks') { const [x, y] = pt(cx, cy, .2, -.16, 24); addPart(x, y, rf(2, 5), rf(-9, -5), rf(3, 5), '#e6ddd6', .45, 'smoke', 1.8); }
    else if (B.type === 'claypit') { const [x, y] = pt(cx, cy, .3, -.2, hasTech('brick') ? 15 : 7); addPart(x, y, rf(1, 4), rf(-8, -5), rf(3, 5), '#e6ddd6', .4, 'smoke', 1.5); }
    else if (B.type === 'terraformer') { const [x, y] = pt(cx, cy, 0, 0, 70); addPart(x, y, rf(-6, 6), rf(-8, -3), rf(5, 8), '#cfeff0', .35, 'mist', 3); }
    else if (B.type === 'launchpad' && B.rk) { const [x, y] = pt(cx, cy, 0, 0, 4); addPart(x + rf(-3, 3), y, rf(-4, 4), rf(-5, -2), rf(2, 3), '#f4f2ef', .35, 'smoke', 2); }
  }
  springSteam(dt);
  // water glints
  if (chance(dt * 6)) {
    const i = ri(0, W * H - 1);
    if (M.water[i] === 1) { const x = i % W, y = (i / W) | 0; const [wx, wy] = gridToWorld(x + rf(-.3, .3), y + rf(-.3, .3), SEAZ); if (inView(wx, wy)) addPart(wx, wy, 0, 0, rf(.6, 1.2), '#ffffff', .8, 'glint'); }
  }
}

/* ---------- clouds ---------- */
function stepClouds(dt) {
  const w = S.wx || newWx(), want = Math.round(4 + w.cover * 11), wind = 1 + w.storm * 1.5 + w.rain * .5;
  if (!DYN.clouds.length) for (let k = 0; k < want; k++) DYN.clouds.push(newCloud(rf(-200, STATIC_W)));
  for (const c of DYN.clouds) c.x += c.v * wind * dt;
  for (let k = DYN.clouds.length - 1; k >= 0; k--) if (DYN.clouds[k].x > STATIC_W + 300) {
    if (DYN.clouds.length > want) DYN.clouds.splice(k, 1); else DYN.clouds[k] = newCloud(-300);
  }
  if (DYN.clouds.length < want && chance(dt * .25)) DYN.clouds.push(newCloud(-300 - rf(0, 200)));
}
function newCloud(x) {
  const puffs = []; const n = ri(4, 8), big = 1 + ((S && S.wx && S.wx.cover) || 0) * .5;
  for (let k = 0; k < n; k++) puffs.push([rf(-45, 45) * big, rf(-8, 8), rf(14, 30) * big]);
  return { x, y: rf(OY - 60, STATIC_H - 300), v: rf(3, 7), puffs, a: rf(.35, .6) };
}

/* ---------- drawing ---------- */
const DL = []; // dynamic lights collected while drawing agents: [x, y, r, col, a, pool]
function dlight(x, y, r, col, a, pool) { if (LIGHT.emK > .02) DL.push([x, y, r, col, a, pool]); }
function drawFrame() {
  const c = CX, w = S.wx || newWx();
  LT = LIGHT.cur; DL.length = 0;
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  c.clearRect(0, 0, CV.width, CV.height);
  // world transform
  const z = CAM.z;
  const wt = () => c.setTransform(DPR * z, 0, 0, DPR * z, DPR * (VW / 2 - CAM.x * z), DPR * (VH / 2 - CAM.y * z));
  wt();
  const [vx0, vy0] = s2w(0, 0), [vx1, vy1] = s2w(VW, VH);
  const sx0 = clamp(vx0, 0, STATIC_W), sy0 = clamp(vy0, 0, STATIC_H), sx1 = clamp(vx1, 0, STATIC_W), sy1 = clamp(vy1, 0, STATIC_H);
  // soft shadow under the island
  c.fillStyle = 'rgba(90,120,140,.10)'; c.beginPath(); c.ellipse(OX + (W - H) * 8, OY + (W + H) * TH2 + SLAB + 90, (W + H) * 12, 40, 0, 0, TAU); c.fill();
  c.imageSmoothingEnabled = true; c.imageSmoothingQuality = z < 1.2 ? 'high' : 'medium';
  if (sx1 > sx0 && sy1 > sy0) {
    c.drawImage(SC, sx0 * RS, sy0 * RS, (sx1 - sx0) * RS, (sy1 - sy0) * RS, sx0, sy0, sx1 - sx0, sy1 - sy0);
    if (LIGHT.fade >= 0) { c.globalAlpha = smooth(clamp(LIGHT.fade, 0, 1)); c.drawImage(SC2, sx0 * RS, sy0 * RS, (sx1 - sx0) * RS, (sy1 - sy0) * RS, sx0, sy0, sx1 - sx0, sy1 - sy0); c.globalAlpha = 1; }
  }
  if (UI.tool && DYN.hover >= 0) drawTarget(c, DYN.hover);
  drawAgents(c);
  // cloud shadows (only when the sun casts them); they pass over people too
  const csa = .03 * (LT.shA / .32) * (1 + w.cover);
  if (csa > .004) for (const cl of DYN.clouds) { c.fillStyle = `rgba(40,60,90,${csa.toFixed(3)})`; for (const [dx, dy, r] of cl.puffs) { c.beginPath(); c.ellipse(cl.x + dx + 40 * LT.shdx - 40 * LT.shdy, cl.y + dy + 160, r * 1.1, r * .55, 0, 0, TAU); c.fill(); } }
  // particles (the ones that glow come after the grade)
  for (const p of DYN.parts) {
    if (p.kind === 'spark' || p.kind === 'fire') continue;
    const a = p.a * (1 - p.age / p.life);
    if (p.kind === 'rain') { c.strokeStyle = rgba(p.col, a); c.lineWidth = .6; c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - 1.2, p.y + 6); c.stroke(); continue; }
    if (p.kind === 'glint') { if (LIGHT.nightK < .5) { c.fillStyle = `rgba(255,255,255,${.8 * Math.sin(p.age / p.life * Math.PI) * (1 - w.cover * .7)})`; c.fillRect(p.x - 2.2, p.y, 4.4, .6); } continue; }
    c.globalAlpha = a; c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  // rockets
  for (const r of DYN.rockets) {
    const y = r.y - r.alt;
    if (r.seed) { box(c, r.x, y, 0, 0, .12, .12, 0, 50, '#f4f6f8'); cone(c, r.x, y - 50, .12, 14, '#5fd0c9'); }
    else { cyl(c, r.x, y, .08, 1, 46, '#f4f4f2'); cone(c, r.x, y - 47, .08, 9, '#ff8a3d'); }
  }
  // drop pods
  for (const d of DYN.drops) {
    const [wx, wy] = gridToWorld(d.x, d.y, landZ(idx(d.x, d.y)));
    const f = Math.min(1, d.t / 4), y = wy - 600 * (1 - f) - 4;
    if (d.t < 4) { c.fillStyle = '#ffffffcc'; c.beginPath(); c.arc(wx, y - 16, 10, Math.PI, TAU); c.fill(); line(c, wx - 10, y - 16, wx - 2, y - 3, '#fff', .5); line(c, wx + 10, y - 16, wx + 2, y - 3, '#fff', .5); }
    c.fillStyle = '#e5874f'; c.fillRect(wx - 3, y - 3, 6, 6); c.fillStyle = '#f4f4f2'; c.fillRect(wx - 3, y - 3, 6, 2);
    dlight(wx, y, 6, '#ffd6a0', .6);
  }
  // intro pod
  if (DYN.intro && !DYN.intro.landed && DYN.intro.px != null) { const I = DYN.intro; c.save(); c.translate(I.px, I.py); c.rotate(-.6); c.fillStyle = '#f2f3f6'; c.beginPath(); c.ellipse(0, 0, 9, 5, 0, 0, TAU); c.fill(); c.fillStyle = '#e5874f'; c.fillRect(-2, -5, 2.4, 10); c.restore(); dlight(I.px, I.py, 16, '#ffb070', .9); }
  // birds (they roost at night)
  if (LIGHT.nightK < .6) for (const b of DYN.birds) {
    for (let k = 0; k < b.n; k++) {
      const x = b.x - Math.sign(b.vx) * Math.floor((k + 1) / 2) * 7, y = b.y + Math.floor((k + 1) / 2) * 4 * (k % 2 ? 1 : -1);
      const fl = Math.sin(DYN.t * 10 + k) * 1.6;
      c.strokeStyle = '#4a4a5a'; c.lineWidth = .7; c.beginPath(); c.moveTo(x - 3, y - fl); c.lineTo(x, y); c.lineTo(x + 3, y - fl); c.stroke();
    }
  }
  drawPlanesAir(c);
  drawFlyers(c);
  // clouds
  const ccol = rgba(mix('#ffffff', '#8f98a6', q2(clamp(w.rain * .7 + w.storm * .3 + Math.max(0, w.cover - .6) * .5, 0, 1))), 1).slice(0, -2);
  for (const cl of DYN.clouds) { c.fillStyle = ccol + (cl.a * .75 * (.85 + w.cover * .35)).toFixed(3) + ')'; for (const [dx, dy, r] of cl.puffs) { c.beginPath(); c.ellipse(cl.x + dx, cl.y + dy, r * 1.2, r * .7, 0, 0, TAU); c.fill(); } }
  // ---- grade the world, then put the sky behind it ----
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  applyGrade(c, w);
  drawSkyBehind(c, DYN.t);
  // ---- light: night glow, lamps, headlights ----
  wt();
  if (LIGHT.emK > .01) {
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = LIGHT.emK * (1 - .35 * w.fog);
    if (sx1 > sx0 && sy1 > sy0) c.drawImage(EMC, sx0 * RSE, sy0 * RSE, (sx1 - sx0) * RSE, (sy1 - sy0) * RSE, sx0, sy0, sx1 - sx0, sy1 - sy0);
    for (const l of DL) drawGlow(c, l[0], l[1], l[2], l[3], l[4] * LIGHT.emK, l[5]);
    drawBeams(c);
    c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  drawLanterns(c);
  for (const p of DYN.parts) {
    if (p.kind !== 'spark' && p.kind !== 'fire') continue;
    c.globalAlpha = p.a * (1 - p.age / p.life); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill();
  }
  c.globalAlpha = 1;
  for (const r of DYN.rockets) if (r.t > 2) {
    const y = r.y - r.alt;
    c.fillStyle = 'rgba(255,220,150,.9)'; c.beginPath(); c.ellipse(r.x, y + 3, 2.2, 6, 0, 0, TAU); c.fill();
    c.globalCompositeOperation = 'lighter'; drawGlow(c, r.x, y + 6, 16, '#ffb070', .5 + LIGHT.nightK * .4); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
  }
  drawMarks(c);
  // ---- screen space: weather, flash, captions ----
  c.setTransform(DPR, 0, 0, DPR, 0, 0);
  drawWeather(c, w);
  drawLabels(c);
  if (DYN.flash) { c.fillStyle = `rgba(255,250,235,${DYN.flash * .5})`; c.fillRect(0, 0, VW, VH); }
  drawCaptions(c);
}
function applyGrade(c, w) {
  const sun = LIGHT.sun, dk = LIGHT.dayK;
  c.globalCompositeOperation = 'source-atop';
  const cov = w.cover * w.cover, wa = (.2 * cov + .1 * w.rain + .16 * w.storm) * (.35 + .65 * dk);
  if (wa > .01) { c.fillStyle = rgbS(mix3([60, 64, 80], [118, 126, 140], 1 - w.storm * .8), wa.toFixed(3)); c.fillRect(0, 0, VW, VH); }
  if (w.fog > .01) { // distance haze: thick far away (top of the screen), light over the middle, clear up close; the drifting banks do the rest
    const f = mix3([48, 54, 72], [226, 231, 236], dk), g = c.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, rgbS(f, (.32 * w.fog).toFixed(3))); g.addColorStop(.45, rgbS(f, (.12 * w.fog).toFixed(3))); g.addColorStop(1, rgbS(f, (.04 * w.fog).toFixed(3)));
    c.fillStyle = g; c.fillRect(0, 0, VW, VH);
  }
  if (!sun.fixed) {
    const [r, g, b, a] = keyAt(GK, sun.el), aa = a * (1 - .35 * w.cover * dk);
    if (aa > .005) { c.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},${aa.toFixed(3)})`; c.fillRect(0, 0, VW, VH); }
  }
  c.globalCompositeOperation = 'source-over';
}
function drawWeather(c, w) {
  const t = DYN.t, nk = LIGHT.nightK;
  const nr = Math.round(w.rain * 300 + w.storm * 160);
  if (nr > 4) {
    const wind = 2.5 + w.storm * 4;
    c.strokeStyle = `rgba(${nk > .5 ? '150,170,205' : '215,226,240'},${(.34 + w.storm * .08) * (1 - nk * .3)})`; c.lineWidth = 1.1; c.beginPath();
    for (let k = 0; k < nr; k++) {
      const sp = 620 + hash2(k, 3, 1) * 380, len = 13 + hash2(k, 4, 1) * 10;
      const y = ((hash2(k, 1, 1) * (VH + 60) + t * sp) % (VH + 60)) - 30, x = ((hash2(k, 2, 1) * (VW + 200) + t * sp * wind * .06 + y * .08 * wind) % (VW + 200)) - 100;
      c.moveTo(x, y); c.lineTo(x - len * .08 * wind, y - len);
    }
    c.stroke();
  }
  const ns = Math.round(w.snow * 280);
  if (ns > 4) {
    c.fillStyle = 'rgba(255,255,255,.85)';
    for (let k = 0; k < ns; k++) {
      const sp = 24 + hash2(k, 5, 2) * 30, sz = 1.2 + hash2(k, 6, 2) * 1.8;
      const y = ((hash2(k, 1, 2) * (VH + 20) + t * sp) % (VH + 20)) - 10, x = ((hash2(k, 2, 2) * (VW + 40) + Math.sin(t * .7 + k) * 14 + t * 8) % (VW + 40)) - 20;
      c.fillRect(x, y, sz, sz);
    }
  }
  if (w.fog > .05) { // slow drifting banks
    for (let k = 0; k < 4; k++) {
      const x = ((k * 0.31 + t * .004 * (1 + k * .3)) % 1.4 - .2) * VW, y = VH * (.35 + k * .15);
      const g = c.createRadialGradient(x, y, 10, x, y, VW * .35);
      const col = LIGHT.dayK > .5 ? '236,240,242' : '70,76,96';
      g.addColorStop(0, `rgba(${col},${.22 * w.fog})`); g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g; c.fillRect(0, 0, VW, VH);
    }
  }
  if (DYN.bolt) {
    const b = DYN.bolt; b.t += 1 / 25;
    if (b.t > .35) DYN.bolt = null;
    else {
      c.strokeStyle = `rgba(245,248,255,${1 - b.t / .35})`; c.lineWidth = 2.2; c.beginPath(); c.moveTo(b.pts[0][0], b.pts[0][1]);
      for (const p of b.pts) c.lineTo(p[0], p[1]); c.stroke();
      c.strokeStyle = `rgba(190,210,255,${.35 * (1 - b.t / .35)})`; c.lineWidth = 7; c.stroke();
    }
  }
}

function drawTarget(c, i) {
  const x = i % W, y = (i / W) | 0, [X, Y] = tileTop(i);
  const r = UI.tool === 'rain' || UI.tool === 'bloom' ? 3 : 0;
  c.strokeStyle = 'rgba(217,119,75,.95)'; c.lineWidth = 1.2 / CAM.z * 1.5;
  c.beginPath(); c.moveTo(X, Y - r * 16); c.lineTo(X + 16 + r * 32, Y + 8); c.lineTo(X, Y + 16 + r * 16); c.lineTo(X - 16 - r * 32, Y + 8); c.closePath(); c.stroke();
  c.fillStyle = 'rgba(217,119,75,.15)'; c.fill();
}

function drawFlyers(c) {
  // occasional aircraft
  if (!DYN.nextFly) DYN.nextFly = DYN.t + rf(15, 35);
  if (DYN.t > DYN.nextFly && !DYN.intro) {
    DYN.nextFly = DYN.t + rf(25, 60) / (S.age && S.age.k === 'sky' ? 2 : 1);
    let kind = null;
    if (hasTech('hover')) kind = pick(['shuttle', 'drones', 'plane']);
    else if (hasTech('net')) kind = pick(['plane', 'drones']);
    else if (hasTech('flight')) kind = anycount('airfield') ? pick(['airship', 'airship', 'balloon']) : pick(['airship', 'plane', 'plane']); // real planes use the airfields
    else if (hasTech('rail')) kind = chance(.3) ? 'balloon' : null;
    if (kind) { const dir = chance(.5) ? 1 : -1; const [, cy] = s2w(0, VH / 2); DYN.flyers.push({ kind, x: dir > 0 ? -200 : STATIC_W + 200, y: rf(OY, STATIC_H - 400), vx: dir * ({ plane: 70, airship: 18, balloon: 8, drones: 30, shuttle: 90 })[kind], t: 0 }); }
  }
  for (const f of DYN.flyers) {
    f.t += 1 / 30; f.x += f.vx / 30;
    const x = f.x, y = f.y, d = Math.sign(f.vx);
    ell(c, x + 30, y + 150, 8, 3, 'rgba(40,40,60,.06)');
    if (LIGHT.emK > .02 && (f.t * 1.3) % 1 < .35) { dlight(x - d * 6, y, 4, '#ff4d4d', .9); dlight(x + d * 6, y, 4, '#7dff9a', .9); }
    if (f.kind === 'plane') { c.fillStyle = '#f7f7f5'; c.beginPath(); c.ellipse(x, y, 8, 1.6, 0, 0, TAU); c.fill(); c.fillRect(x - 1.5, y - 6, 3, 12); c.fillStyle = '#e05b52'; c.fillRect(x - d * 7, y - 3.5, 1.5, 3.5); }
    else if (f.kind === 'airship') { ell(c, x, y, 16, 6, '#e9dcc4'); ell(c, x - 2, y - 2, 12, 3, '#f7efe0'); c.fillStyle = '#8a6d57'; c.fillRect(x - 4, y + 5, 8, 2.5); c.fillStyle = '#d98c3f'; c.fillRect(x - d * 15, y - 3, 2, 6); }
    else if (f.kind === 'balloon') { circ(c, x, y, 7, '#e76f51'); c.fillStyle = '#fff3e0'; c.fillRect(x - 1.5, y - 7, 3, 14); line(c, x - 4, y + 5, x - 1.5, y + 11, '#6b5040', .4); line(c, x + 4, y + 5, x + 1.5, y + 11, '#6b5040', .4); c.fillStyle = '#8a6d57'; c.fillRect(x - 2, y + 11, 4, 2.5); }
    else if (f.kind === 'drones') { for (let k = 0; k < 5; k++) { const dx = -k * 9 * d, dy = Math.sin(f.t * 3 + k) * 3 + (k % 2) * 5; c.fillStyle = '#e8eaef'; c.fillRect(x + dx - 2, y + dy - .7, 4, 1.4); if ((f.t * 3 + k) % 1 < .5) circ(c, x + dx, y + dy + 1, .5, '#5fd0c9'); } }
    else { c.fillStyle = '#f4f6f8'; c.beginPath(); c.moveTo(x + d * 10, y); c.lineTo(x - d * 8, y - 3); c.lineTo(x - d * 8, y + 3); c.fill(); c.fillStyle = 'rgba(95,208,201,.7)'; c.beginPath(); c.ellipse(x - d * 10, y, 3, 1.5, 0, 0, TAU); c.fill(); }
  }
  DYN.flyers = DYN.flyers.filter(f => f.x > -400 && f.x < STATIC_W + 400);
}

function drawCaptions(c) {
  c.textBaseline = 'middle';
  const placed = [];
  for (const cap of DYN.caps) {
    let [sx, sy] = w2s(cap.wx, cap.wy);
    sy -= Math.min(cap.age, 4) * 3;
    const a = Math.min(1, cap.age / .6, (cap.life - cap.age) / 1.5);
    if (a <= 0) continue;
    c.font = `${cap.major ? 600 : 500} ${cap.major ? 13.5 : 12.5}px "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif`;
    const txt = cap.t, tw = c.measureText(txt).width + 30, th = 26;
    let bx = clamp(sx - tw / 2, 8, VW - tw - 8), by = clamp(sy - th, 8, VH - th - 8);
    for (const p of placed) if (bx < p[0] + p[2] && bx + tw > p[0] && by < p[1] + p[3] && by + th > p[1]) by = p[1] - th - 6;
    placed.push([bx, by, tw, th]);
    c.globalAlpha = a;
    c.fillStyle = cap.major ? 'rgba(255,251,244,.94)' : 'rgba(255,251,244,.82)';
    c.shadowColor = 'rgba(60,40,60,.18)'; c.shadowBlur = 10; c.shadowOffsetY = 2;
    c.beginPath(); c.roundRect(bx, by, tw, th, 13); c.fill();
    c.shadowColor = 'transparent';
    c.beginPath(); c.moveTo(clamp(sx, bx + 10, bx + tw - 10) - 5, by + th); c.lineTo(clamp(sx, bx + 10, bx + tw - 10), by + th + 6); c.lineTo(clamp(sx, bx + 10, bx + tw - 10) + 5, by + th); c.fill();
    c.fillStyle = '#2b2833'; c.font = `12px "Segoe UI Emoji","Apple Color Emoji",sans-serif`; c.fillText(cap.ic, bx + 8, by + th / 2 + .5);
    c.font = `${cap.major ? 600 : 500} ${cap.major ? 13.5 : 12.5}px "Segoe UI Variable Text","Segoe UI",system-ui,sans-serif`;
    c.fillStyle = cap.major ? '#b85a33' : '#2b2833'; c.fillText(txt, bx + 25, by + th / 2 + .5);
  }
  c.globalAlpha = 1;
}
