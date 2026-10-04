/* ============================== the moving world: people, animals, traffic, the nudges' effects ============================== */
// DYN is everything that moves and is never saved. The sim says what happens (FXQ); processFX turns it into things to see
// (fx3d.js draws them), and updateDyn moves it all along each frame.
const DYN = { walkers: [], vehicles: [], trains: [], boats: [], herds: [], flyers: [], parts: [], caps: [], birds: [], giants: [], rockets: [], drops: [], meteors: [], caravans: [], traders: [], ships: [], slot: {}, ferries: [], planes: [], af: {}, rains: [], anim: [], lanterns: [], comet: null, intro: null, t: 0, hover: -1 };
const CLOTH = ['#e5874f', '#5e9c8f', '#d6a44a', '#8f79cf', '#e76f84', '#4f86c6', '#7fb069', '#f2f0ea', '#c9674a', '#6c7a89'];
const SKIN = ['#f1d2b6', '#d9a47f', '#b27b56', '#8a5a3c', '#f4c7a1', '#6b4a35'];

/* ---------- FX dispatch ---------- */
function processFX() {
  while (FXQ.length) {
    const f = FXQ.shift();
    switch (f.k) {
      case 'caption': if (S.settings.captions) addCaption(f); break;
      case 'fireworks': if (LVV.fireworks === 'never') break; DYN.fireworks = (DYN.fireworks || []); DYN.fireworks.push({ x: f.x, y: f.y, t: 0, life: 9, next: 0 }); camHint(f.x, f.y, '🎆 Fireworks'); break;
      case 'rain': DYN.rains.push({ x: f.x, y: f.y, t: 0, life: f.big ? 16 : 10 }); break;
      case 'herd': spawnHerd(f.x, f.y, true); break;
      case 'birds': if (LVV.birds !== 'none') spawnBirds(f.x, f.y); break;
      case 'giant': spawnGiant(); break;
      case 'meteors': DYN.meteorShower = 20; break;
      case 'comet': DYN.comet = { az: rf(-1.2, 1.2), el: rf(.45, .8), t: 0, life: 80 }; break;
      case 'caravan': spawnCaravan(f.from, f.to, f.n); break;
      case 'trade': if (f.sea) { const A = S.T[f.from], B = S.T[f.to], ha = A && townHarbour(A), hb = B && townHarbour(B); if (ha && hb && freeBerth(ha) >= 0) { const sh = spawnShip(ha, hb, f.r); if (sh) DYN.slot[bkey(ha, sh.bk)] = sh; } } else spawnTrader(f.from, f.to, f.r); break;
      case 'launch': launchRocket(f.id); break;
      case 'seedship': { const e = Object.values(S.B).find(B => B.type === 'elevator' || B.type === 'launchpad'); if (e) launchRocket(e.id, true); break; }
      case 'drop': DYN.drops.push({ x: f.x, y: f.y, t: 0 }); camHint(f.x, f.y, '📦 A supply pod'); break;
      case 'meteor': DYN.meteors.push({ x: f.x, y: f.y, t: 0 }); camHint(f.x, f.y, '☄️ Starfall'); break;
      case 'sparkle': { const g = gGround(f.x, f.y); for (let k = 0; k < 70; k++) part3(f.x + rf(-2, 2), g + rf(.1, .8), f.y + rf(-2, 2), rf(-.15, .15), rf(.4, 1.2), rf(-.15, .15), rf(1.5, 3), pick(['#fff6c2', '#ffd66b', '#bff3ff', '#ffc2e0']), .9, rf(.05, .1), { glow: 1, dr: .6 }); break; }
    }
  }
}
let CAPN = 0;
function addCaption(f) {
  DYN.caps.push({ id: ++CAPN, x: f.x, y: f.y, ic: f.ic, t: f.t, age: 0, life: f.major ? 20 : 14, major: f.major });
  if (DYN.caps.length > 5) DYN.caps.shift();
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
    DYN.trains.push({ r, s: .5, lo: .5, v: 0, dir: 1, wait: rf(0, 6) });
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
function spawnBirds(x, y) { // a flock crosses the valley, over (x, y) if given
  const cx = x != null ? x : rf(W * .2, W * .8), cy = y != null ? y : rf(H * .2, H * .8), a = rf(0, TAU), sp = 1.6;
  DYN.birds.push({ x: cx - Math.cos(a) * sp * 18, y: cy - Math.sin(a) * sp * 18, h: gGround(cx, cy) + rf(2.5, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, n: ri(5, 9), t: 0, life: 40 });
}
function spawnGiant() {
  const fromLeft = chance(.5);
  const y0 = rf(18, 46);
  DYN.giants.push({ fx: fromLeft ? -2 : W + 2, fy: y0, dx: fromLeft ? 1 : -1, dy: rf(-.25, .25), t: 0, spd: .09 });
}
function launchRocket(bid, seed) {
  const B = S.B[bid]; if (!B) return;
  DYN.rockets.push({ alt: 0, v: 0, t: 0, seed: !!seed, bid });
  if (B.type === 'launchpad') { B.rk = 0; markDirty(idx(B.x, B.y)); }
  camHint(B.x, B.y, seed ? '🚀 A seedship lifts off' : '🚀 A launch', 4);
}

/* ---------- update ---------- */
function updateDyn(dt) {
  DYN.t += dt;
  stepIntro(dt);
  if (!FAST && S && !S.flags.intro) { // customs from the Watcher's words: flocks of birds, fireworks most nights
    if (LVV.birds === 'flocks' && chance(dt * .025)) spawnBirds();
    if (LVV.fireworks === 'often' && (LIGHT.emK || 0) > .6 && chance(dt * .012)) { const T = pick(towns()); if (T) (DYN.fireworks = DYN.fireworks || []).push({ x: T.x + rf(-1.5, 1.5), y: T.y + rf(-1.5, 1.5), t: 0, life: 9, next: 0 }); }
  }
  stepAgents(dt);
  stepBoats(dt); stepShips(dt); stepFerries(dt); stepPlanes(dt);
  stepTrains(dt); stepTrams(dt); // (rail.js)
  for (const h of DYN.herds) {
    h.age += dt;
    for (const m of h.members) { if (m.pause > 0) { m.pause -= dt; continue; } stepAgent(m, dt, a => herdNext(a, h)); if (chance(dt * .15)) m.pause = rf(2, 7); }
    if (chance(dt * .02)) { const s = h.members[0]; h.cx = clamp((s.a % W) + ri(-4, 4), 1, W - 2); h.cy = clamp(((s.a / W) | 0) + ri(-4, 4), 1, H - 2); }
  }
  DYN.herds = DYN.herds.filter(h => h.age < h.life);
  stepFx3(dt);
  for (const c of DYN.caps) c.age += dt;
  DYN.caps = DYN.caps.filter(c => c.age < c.life);
  if (DYN.flash) DYN.flash = Math.max(0, DYN.flash - dt * 1.6);
  stepLanterns(dt);
}
