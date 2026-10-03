/* ============================== agents: people and vehicles with somewhere to be ============================== */
// People live in a house, work somewhere that fits their job, run errands and stroll in the evening.
// They path over the road network (A*), keep to the side of the road, go in and out of doors,
// and follow the clock: a morning rush, a lunch crowd, quiet streets at 3 am.

/* ---------- navigation ---------- */
const NAV = { g: new Float32Array(W * H), prev: new Int32Array(W * H), seen: new Uint32Array(W * H), done: new Uint32Array(W * H), gen: 0, grass: 4, calls: 0 };
const HP = { f: new Float32Array(40000), i: new Int32Array(40000), n: 0 };
function hpush(f, i) {
  if (HP.n >= HP.f.length) return;
  let k = HP.n++;
  while (k > 0) { const p = (k - 1) >> 1; if (HP.f[p] <= f) break; HP.f[k] = HP.f[p]; HP.i[k] = HP.i[p]; k = p; }
  HP.f[k] = f; HP.i[k] = i;
}
function hpop() {
  const top = HP.i[0], n = --HP.n; if (n <= 0) return top;
  const f = HP.f[n], i = HP.i[n]; let k = 0;
  for (;;) { let c = 2 * k + 1; if (c >= n) break; if (c + 1 < n && HP.f[c + 1] < HP.f[c]) c++; if (HP.f[c] >= f) break; HP.f[k] = HP.f[c]; HP.i[k] = HP.i[c]; k = c; }
  HP.f[k] = f; HP.i[k] = i; return top;
}
const OUTDOOR = { plaza: 1, park: 1, farm: 1, pod: 1, lumber: 1, quarry: 1, claypit: 1, pasture: 1, sandpit: 1 };
// mode 0 = on foot, 1 = vehicle (roads only), 2 = caravan (cross-country)
function navCost(j, from, mode, goal) {
  if (j === goal) return 1;
  if (M.ruin[j]) return 1e9;
  const r = M.road[j];
  if (M.water[j]) return r ? 1 : 1e9;
  if (mode === 1) return r ? 1 : 1e9;
  if (r) return 1;
  const b = M.bld[j];
  if (b) {
    const B = S.B[b]; if (!B || B.prog < 1 && !OUTDOOR[B.type]) return 1e9;
    const t = B.type;
    return t === 'plaza' || t === 'pod' ? 1.2 : t === 'park' ? 1.6 : t === 'farm' ? (mode === 2 ? 3 : 4) : 1e9;
  }
  if (Math.abs(M.elev[j] - M.elev[from]) > 1 && !M.road[from]) return 1e9;
  return NAV.grass + (M.tree[j] ? 2 + M.tree[j] : 0) + (M.rail[j] ? 2 : 0);
}
function navPath(a, b, mode, maxN) {
  if (a < 0 || b < 0) return null;
  if (a === b) return [a];
  const N = NAV, gen = ++N.gen; N.calls++;
  N.grass = mode === 2 ? 2.2 : roadTier() >= 3 ? 9 : 4;
  const bx = b % W, by = (b / W) | 0;
  HP.n = 0; N.g[a] = 0; N.seen[a] = gen; N.prev[a] = -1;
  hpush(Math.abs(a % W - bx) + Math.abs(((a / W) | 0) - by), a);
  let n = 0; maxN = maxN || 3500;
  while (HP.n && n++ < maxN) {
    const i = hpop(); if (N.done[i] === gen) continue; N.done[i] = gen;
    if (i === b) break;
    const x = i % W, y = (i / W) | 0;
    for (let d = 0; d < 4; d++) {
      const nx = x + N4[d][0], ny = y + N4[d][1]; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx; if (N.done[j] === gen) continue;
      const c = navCost(j, i, mode, b); if (c >= 1e8) continue;
      const ng = N.g[i] + c;
      if (N.seen[j] !== gen || ng < N.g[j]) { N.seen[j] = gen; N.g[j] = ng; N.prev[j] = i; hpush(ng + Math.abs(nx - bx) + Math.abs(ny - by), j); }
    }
  }
  if (N.done[b] !== gen) return null;
  const path = []; for (let i = b; i !== -1; i = N.prev[i]) path.push(i);
  return path.reverse();
}
function roadDoor(B) {
  if (!B) return -1;
  const i = idx(B.x, B.y);
  if (M.road[i]) return i;
  if (fpBig(B)) { for (const t of fpTiles(B)) { const x = t % W, y = (t / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.road[j] && !M.water[j]) return j; } } } // a big building: any road along its lot
  let best = -1;
  for (const [dx, dy] of N4) { const nx = B.x + dx, ny = B.y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.road[j] && !M.water[j]) return j; if (best < 0 && M.road[j]) best = j; }
  return best;
}

/* ---------- where things are, per town ---------- */
let TIDX = {}, TIDX_T = -1;
function townIndex() {
  if (TIDX_T === S.month) return TIDX;
  TIDX_T = S.month; TIDX = {};
  for (const T of towns()) {
    const ix = TIDX[T.id] = { all: [] };
    for (const id of T.bl) { const B = S.B[id]; if (!B || B.prog < 1 || B.hid) continue; (ix[B.type] = ix[B.type] || []).push(id); ix.all.push(id); }
  }
  return TIDX;
}
function pickOf(T, types) {
  const ix = townIndex()[T.id]; if (!ix) return 0;
  let n = 0; for (const t of types) n += (ix[t] || []).length;
  if (!n) return 0;
  let r = Math.floor(rnd() * n);
  for (const t of types) { const a = ix[t] || []; if (r < a.length) return a[r]; r -= a.length; }
  return 0;
}
const WORK_TYPES = ['farm', 'farm', 'digsite', 'botanic', 'guildhall', 'warehouse', 'shipyard', 'pasture', 'sandpit', 'weaver', 'glassworks', 'watertower', 'lumber', 'quarry', 'claypit', 'harbor', 'workshop', 'mill', 'mine', 'works', 'market', 'school', 'library', 'clinic', 'dock', 'power', 'station', 'university', 'hall', 'vfarm', 'granary', 'museum', 'observatory', 'airfield'];
const ERRANDS = ['market', 'well', 'granary', 'shrine', 'library', 'clinic', 'museum', 'hall', 'dock', 'station', 'plaza', 'pod', 'market'];
const LEISURE = ['theatre', 'bathhouse', 'botanic', 'park', 'park', 'plaza', 'market', 'stadium', 'dock', 'museum', 'monument', 'shrine', 'pod', 'dome', 'observatory'];
const ROLE_WORK = [
  [/farm|herder|forager|gene|terraform|dome keeper/, ['farm', 'vfarm', 'dome']],
  [/heal|midwife|herbal|nurse|doctor|counsel/, ['clinic', 'shrine']],
  [/teacher/, ['school', 'university']],
  [/trader|merchant|baker|brewer|innkeeper|cook|café|chef|banker|entrepreneur/, ['market']],
  [/scribe|printer|cartograph|storyteller|journalist|research|scientist|data weaver|sage/, ['library', 'university', 'school']],
  [/star-watcher|astronomer|seedship|ring surveyor/, ['observatory', 'launchpad', 'antenna']],
  [/magistrate|diplomat|surveyor/, ['hall', 'plaza']],
  [/ferry|fisher|sailor|docker|boat/, ['harbor', 'dock', 'shipyard']],
  [/radio|broadcaster|comedian/, ['mast', 'antenna']],
  [/singer|performer|artist/, ['theatre', 'museum', 'stadium', 'market', 'plaza']],
  [/pilot/, ['airfield']],
  [/rail/, ['station', 'works']],
  [/factory/, ['works']],
  [/woodcutter|forester|carpenter/, ['lumber', 'workshop']],
  [/mason|stonecutter|quarr/, ['quarry', 'workshop']],
  [/potter|bricklayer|brickmaker/, ['claypit', 'workshop']],
  [/miner/, ['mine']],
  [/smith|builder|weaver|basket|machinist|mechanic|electrician|drone|engineer|architect|inventor|millwright/, ['workshop', 'works', 'mill', 'power', 'mine']]
];
function jobPlace(w, T) {
  if (w.kid) return pickOf(T, ['school']) || pickOf(T, ['park', 'plaza']);
  if (w.pid) {
    const p = S.P[w.pid];
    if (p) {
      if (p.id === S.founder) return (S.year < 60 && pickOf(T, ['farm'])) || pickOf(T, ['pod']);
      if (T.leader === p.id) return pickOf(T, ['hall', 'plaza']);
      for (const [re, types] of ROLE_WORK) if (re.test(p.role)) { const b = pickOf(T, types); if (b) return b; }
    }
  }
  return pickOf(T, WORK_TYPES) || pickOf(T, ['plaza', 'pod']);
}
function homeFor(w, T) {
  const ix = townIndex()[T.id]; const hs = ix && ix.house;
  if (hs && hs.length) return w.pid ? hs[(w.pid * 7919) % hs.length] : pick(hs);
  return pickOf(T, ['pod', 'plaza']);
}
const bTile = id => { const B = S.B[id]; return B ? idx(B.x, B.y) : -1; };

/* ---------- people ---------- */
const PANTS = ['#4f5a6e', '#6b5a4c', '#3f4652', '#7a6a5a', '#5e6f5a', '#8a7a9a', '#2f3a48'];
const HAIR = ['#2b2320', '#5a3a28', '#8a5a34', '#c9a063', '#e8d6a8', '#a8452c', '#6d6d72', '#efe9e0', '#3a2a40'];
function spawnWalker(T, kind) {
  const w = {
    tid: T.id, kind: kind || 'p', st: 'in', at: 0, tile: idx(T.x, T.y), home: 0, work: 0, until: DYN.t + rf(0, 10), path: null, s: 0,
    spd: rf(.3, .46), ph: rnd() * 6, col: pick(CLOTH), pants: pick(PANTS), hair: pick(HAIR), skin: pick(SKIN), hat: rnd(), ln: rnd(),
    kid: kind === 'p' && chance(.16), pet: S.flags.pets && chance(.22), ox: 0, oy: 0, tx: 0, ty: 0, pause: 0, dx: 1, dy: 0, mv: 0, off: 0
  };
  if (kind === 'founder') { w.col = '#e5874f'; w.skin = SKIN[0]; w.spd = .3; w.hair = '#8a5a34'; w.pants = '#f2f0ea'; }
  if (w.kid) w.spd *= 1.15;
  w.home = homeFor(w, T); w.at = w.home; if (w.home) w.tile = bTile(w.home);
  w.work = jobPlace(w, T);
  DYN.walkers.push(w); return w;
}
function tripTo(w, dest, destTile, outdoor) {
  const from = w.tile;
  if (destTile < 0 || destTile === from) return false;
  const path = navPath(from, destTile, 0);
  if (!path || path.length < 2) return false;
  w.path = path; w.s = 0; w.st = 'go'; w.dest = dest; w.destTile = destTile; w.outdoor = outdoor;
  w.fromIn = w.stWas !== 'idle'; w.ox0 = w.ox; w.oy0 = w.oy;
  return true;
}
function planWalker(w) {
  const T = S.T[w.tid]; if (!T) return;
  const hb = S.B[w.home];
  if (!hb || (hb.type !== 'house' && (townIndex()[T.id] || {}).house)) w.home = homeFor(w, T);
  if (!S.B[w.work]) w.work = jobPlace(w, T);
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, hr = sun.hr, fx = sun.fixed;
  const night = !fx && (hr >= 22 || hr < 5.5), morning = !fx && hr >= 5.5 && hr < 9, eve = !fx && hr >= 17 && hr < 22;
  const atHome = w.at && w.at === w.home, atWork = w.at && w.at === w.work;
  const errand = () => pickOf(T, w.kid ? ['park', 'plaza', 'market', 'pod', 'school'] : ERRANDS);
  const leisure = () => pickOf(T, LEISURE);
  let dest = 0, stay = 0;
  if (night) { if (atHome) { if (chance(.05)) dest = leisure(); else stay = rf(25, 60); } else dest = w.home; }
  else if (morning) dest = atHome ? w.work : atWork ? (chance(.25) ? errand() : 0) : w.work;
  else if (eve) dest = atHome ? (chance(.45) ? leisure() : 0) : chance(.55) ? w.home : leisure();
  else if (atHome) dest = chance(.5) ? errand() : chance(.55) ? w.work : 0;
  else if (atWork) dest = chance(.35) ? errand() : chance(.3) ? w.home : 0;
  else dest = chance(.45) ? w.work : chance(.5) ? w.home : errand();
  if (!dest && !stay && !atHome && !atWork && chance(.5)) dest = w.home;
  if (!dest && !stay && chance(.35)) { // a stroll to somewhere along the streets
    const R = townRadius(T);
    for (let k = 0; k < 12; k++) { const x = Math.round(T.x + rf(-R, R)), y = Math.round(T.y + rf(-R, R)); if (!inb(x, y)) continue; const j = idx(x, y); if (M.road[j] && !M.water[j] && j !== w.tile) { w.stWas = w.st; if (tripTo(w, 0, j, true)) return; break; } }
  }
  if (dest && dest !== w.at) {
    const B = S.B[dest]; w.stWas = w.st;
    if (B && tripTo(w, dest, idx(B.x, B.y), !!OUTDOOR[B.type])) return;
  }
  w.until = DYN.t + (stay || (w.st === 'idle' ? rf(8, 25) : atWork ? rf(25, 70) : atHome ? rf(12, 40) : rf(8, 25)));
}
function stepWalker(w, dt) {
  if (w.st === 'in' || w.st === 'idle') {
    if (w.st === 'idle') {
      const B = M.bld[w.tile] && S.B[M.bld[w.tile]];
      if (!(M.road[w.tile] || (B && OUTDOOR[B.type]))) { w.until = 0; } // the field became a house: move on
      if (w.pause > 0) w.pause -= dt;
      else {
        const ddx = w.tx - w.ox, ddy = w.ty - w.oy, d = Math.hypot(ddx, ddy);
        if (d < .02) { w.pause = rf(1.5, 6); const r = M.road[w.tile] ? .2 : .3; w.tx = rf(-r, r); w.ty = rf(-r, r); w.mv = 0; }
        else { const st = Math.min(d, dt * .22); w.ox += ddx / d * st; w.oy += ddy / d * st; w.dx = ddx; w.dy = ddy; w.mv = 1; w.ph += st * 19; }
      }
    }
    if (DYN.t >= w.until) planWalker(w);
    return;
  }
  // walking a path
  const n = w.path.length, k0 = Math.floor(w.s);
  const step = dt * w.spd * (M.road[w.path[Math.min(n - 1, k0 + 1)]] ? 1 : .85);
  w.s += step; w.ph += step * 19;
  const k = Math.floor(w.s);
  if (k !== k0 && k < n - 1) { // check the way ahead is still open
    const nxt = w.path[k + 1];
    if (navCost(nxt, w.path[k], 0, w.destTile) >= 1e8) {
      w.tile = w.path[k];
      const p2 = navPath(w.tile, w.destTile, 0);
      if (p2 && p2.length > 1) { w.path = p2; w.s = 0; w.fromIn = false; w.ox0 = w.oy0 = 0; }
      else { w.st = 'idle'; w.at = 0; w.until = DYN.t + 1; w.ox = w.oy = w.tx = w.ty = 0; return; }
    }
  }
  if (w.s >= n - 1) { // arrived
    w.tile = w.destTile; w.at = w.dest; w.path = null;
    if (w.outdoor) { w.st = 'idle'; w.ox = w.oy = 0; w.tx = rf(-.25, .25); w.ty = rf(-.25, .25); w.pause = 0; }
    else w.st = 'in';
    w.until = DYN.t + (w.at === w.work ? rf(25, 70) : w.at === w.home ? rf(12, 40) : rf(8, 25));
    if (w.outdoor && M.bld[w.tile] && S.B[M.bld[w.tile]] && S.B[M.bld[w.tile]].type === 'farm') w.until += rf(10, 30);
  }
}
// where a walker is: [fx, fy, z, alpha, dirx, diry, moving]
function segOff(path, k, m) {
  const a = path[k], b = path[k + 1], dx = (b % W) - (a % W), dy = ((b / W) | 0) - ((a / W) | 0);
  return [-dy * m, dx * m, dx, dy];
}
function tileZ(i) { return M.water[i] ? (M.road[i] ? bridgeZ(i) : landZ(i) + 2) : surfZ(i); }
function pathPos(o, lane, fadeIn, fadeOut) {
  const p = o.path, n = p.length, s = Math.min(o.s, n - 1.0001), k = Math.floor(s), t = s - k;
  const a = p[k], b = p[k + 1], ax = a % W, ay = (a / W) | 0, bx = b % W, by = (b / W) | 0;
  const mOf = kk => (kk <= 0 && fadeIn) || (kk >= n - 2 && fadeOut) ? 0 : (M.road[p[kk]] || M.road[p[kk + 1]]) ? lane : lane * .4;
  const [o0x, o0y, dx, dy] = segOff(p, k, mOf(k));
  let ox = o0x, oy = o0y;
  if (t < .5 && k > 0) { const [px, py] = segOff(p, k - 1, mOf(k - 1)); const f = t * 2; ox = lerp((px + o0x) / 2, o0x, f); oy = lerp((py + o0y) / 2, o0y, f); }
  else if (t >= .5 && k < n - 2) { const [nx, ny] = segOff(p, k + 1, mOf(k + 1)); const f = (t - .5) * 2; ox = lerp(o0x, (nx + o0x) / 2, f); oy = lerp(o0y, (ny + o0y) / 2, f); }
  if (k === 0 && o.ox0) { ox += o.ox0 * (1 - t); oy += o.oy0 * (1 - t); }
  const z = lerp(tileZ(a), tileZ(b), smooth(t));
  let al = 1;
  if (fadeIn && k === 0) al = Math.min(al, clamp((t - .12) / .4, 0, 1));
  if (fadeOut && k === n - 2) al = Math.min(al, clamp((.88 - t) / .4, 0, 1));
  return [lerp(ax, bx, t) + ox, lerp(ay, by, t) + oy, z, al, dx, dy, 1];
}
function walkerPos(w) {
  if (w.st === 'in') return null;
  if (w.st === 'idle') { const x = w.tile % W, y = (w.tile / W) | 0; return [x + w.ox, y + w.oy, tileZ(w.tile), 1, w.dx, w.dy, w.mv]; }
  return pathPos(w, .27, w.fromIn, !w.outdoor);
}

/* ---------- vehicles ---------- */
function spawnVehicle(T, kind) {
  const ix = townIndex()[T.id], all = ix ? ix.all : [];
  const v = { tid: T.id, kind, st: 'in', at: all.length ? pick(all) : 0, tile: -1, until: DYN.t + rf(0, 15), path: null, s: 0, spd: kind === 'cart' ? .5 : kind === 'car' ? 1.25 : 1.8, col: pick(CLOTH) };
  DYN.vehicles.push(v); return v;
}
function planVehicle(v) {
  const T = S.T[v.tid]; if (!T) return;
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, night = !sun.fixed && (sun.hr >= 23 || sun.hr < 5);
  if (night && chance(.7)) { v.until = DYN.t + rf(20, 50); return; }
  let dT = T;
  if (chance(.15)) { const ts = towns().filter(o => o !== T && o.linked); if (ts.length) dT = pick(ts); }
  const ix = townIndex()[dT.id]; if (!ix || !ix.all.length) { v.until = DYN.t + 10; return; }
  const from = roadDoor(S.B[v.at]);
  for (let k = 0; k < 4; k++) {
    const dest = pick(ix.all); if (dest === v.at) continue;
    const to = roadDoor(S.B[dest]); if (from < 0 || to < 0 || to === from) continue;
    const path = navPath(from, to, 1, dT === T ? 3000 : 7000);
    if (path && path.length > 2) { v.path = path; v.s = 0; v.st = 'go'; v.dest = dest; return; }
  }
  if (from < 0) v.at = pick(townIndex()[T.id].all);
  v.until = DYN.t + rf(6, 15);
}
function stepVehicle(v, dt) {
  if (v.st === 'in') { if (DYN.t >= v.until) planVehicle(v); return; }
  const n = v.path.length, k0 = Math.floor(v.s);
  v.s += dt * v.spd;
  const k = Math.floor(v.s);
  if (k !== k0 && k < n - 1 && !M.road[v.path[k + 1]]) { v.st = 'in'; v.until = DYN.t + 3; v.path = null; return; }
  if (v.s >= n - 1) { v.at = v.dest; v.st = 'in'; v.path = null; v.until = DYN.t + rf(6, 25); }
}
function vehiclePos(v) { return v.st === 'go' ? pathPos(v, .12, true, true) : null; }

/* ---------- caravans follow a real route ---------- */
function spawnCaravan(from, to, n) {
  const A = S.T[from], B = S.T[to]; if (!A || !B) return;
  const path = navPath(idx(A.x, A.y), idx(B.x, B.y), 2, 9000);
  for (let k = 0; k < n; k++) DYN.caravans.push({ path, ax: A.x, ay: A.y, bx: B.x, by: B.y, t: -k * .04, s: -k * .55, spd: path ? .75 : 0, sp2: 1 / (dist(A.x, A.y, B.x, B.y) * 2.2), col: pick(CLOTH), pants: pick(PANTS), hair: pick(HAIR), skin: pick(SKIN), hat: rnd(), ph: rnd() * 6, off: rf(-.3, .3), ln: 0 });
  camHint((A.x + B.x) / 2, (A.y + B.y) / 2, '🐪 A caravan sets out', 5);
}
function stepCaravans(dt) {
  for (const c of DYN.caravans) {
    if (c.path) { c.s += dt * c.spd; c.ph += dt * c.spd * 19; c.t = c.s / Math.max(1, c.path.length - 1); }
    else { c.t += dt * c.sp2; c.ph += dt * 7; }
  }
  DYN.caravans = DYN.caravans.filter(c => c.t < 1);
}
function caravanPos(c) {
  if (c.path) { if (c.s < 0) return null; const p = pathPos({ path: c.path, s: c.s }, c.off * .6, false, false); return p; }
  if (c.t < 0) return null;
  const fx = lerp(c.ax, c.bx, c.t) + c.off, fy = lerp(c.ay, c.by, c.t) - c.off, i = idx(clamp(Math.round(fx), 0, W - 1), clamp(Math.round(fy), 0, H - 1));
  return [fx, fy, landZ(i), 1, c.bx - c.ax, c.by - c.ay, 1];
}

/* ---------- trade wagons carry stone, timber and the rest between towns ---------- */
function townDoor(T) { const b = M.bld[idx(T.x, T.y)]; return b ? roadDoor(S.B[b]) : M.road[idx(T.x, T.y)] ? idx(T.x, T.y) : -1; }
function spawnTrader(from, to, r) {
  if (DYN.traders.length >= 6) return;
  const A = S.T[from], B = S.T[to]; if (!A || !B) return;
  const a = townDoor(A), b = townDoor(B); if (a < 0 || b < 0) return;
  const path = navPath(a, b, 1, 9000); if (!path || path.length < 3) return;
  const kind = hasTech('hover') ? 'hover' : hasTech('motor') ? 'truck' : 'wagon';
  DYN.traders.push({ path, s: 0, r, kind, spd: kind === 'wagon' ? .42 : kind === 'truck' ? 1.05 : 1.5, col: pick(CLOTH) });
}
function stepTraders(dt) {
  for (const t of DYN.traders) {
    const k0 = Math.floor(t.s); t.s += dt * t.spd; const k = Math.floor(t.s);
    if (k !== k0 && k < t.path.length - 1 && !M.road[t.path[k + 1]]) t.s = 1e9; // the road is gone
  }
  DYN.traders = DYN.traders.filter(t => t.s < t.path.length - 1);
}

/* ---------- keeping the right number of people and vehicles around ---------- */
function syncPeople() {
  let total = 0; const crowd = 2.5 * (LVV.bustle === 'bustling' ? 1.4 : LVV.bustle === 'quiet' ? .45 : 1); // (the 3D view draws people cheaply enough to fill the streets; the custom makes them busier or quieter)
  const vt = hasTech('hover') ? 'hover' : hasTech('motor') ? 'car' : hasTech('wheel') ? 'cart' : null;
  for (const T of towns()) {
    const want = Math.round(Math.min(56 * crowd, (T.id === 1 && S.year < 20 ? 0 : 4) + Math.sqrt(T.pop) * 2.3 * crowd));
    const have = DYN.walkers.filter(w => w.tid === T.id && w.kind === 'p');
    if (have.length < want && total < 380 * crowd) { for (let k = 0; k < Math.min(4, want - have.length); k++) spawnWalker(T); }
    else if (have.length > want + 3) { const w = have.find(w => w.st === 'in') || have[0]; DYN.walkers.splice(DYN.walkers.indexOf(w), 1); }
    total += have.length;
    if (vt) {
      const vw = Math.round(Math.min(16 * crowd, T.pop / 90 * Math.min(2, crowd))), vh = DYN.vehicles.filter(v => v.tid === T.id);
      if (vh.length < vw) spawnVehicle(T, vt);
      else if (vh.length > vw + 1) DYN.vehicles.splice(DYN.vehicles.indexOf(vh.find(v => v.st === 'in') || vh[0]), 1);
    }
  }
  if (vt) for (const v of DYN.vehicles) v.kind = vt;
  // named people walk around their home towns
  const want = new Set();
  if (!S.flags.intro) {
    const Lv = living();
    for (const T of towns()) {
      const ps = Lv.filter(p => p.sid === T.id && S.year - p.born >= 5).sort((a, b) => notableScore(b) - notableScore(a));
      for (const p of ps.slice(0, 6)) want.add(p.id);
    }
    for (const q of S.prayers || []) if (q.st === 'open' && S.P[q.pid] && S.P[q.pid].died === null && S.P[q.pid].sid === q.tid) want.add(q.pid);
  }
  DYN.walkers = DYN.walkers.filter(w => !w.pid || (want.has(w.pid) && S.P[w.pid] && S.P[w.pid].sid === w.tid));
  for (const id of want) {
    if (DYN.walkers.some(w => w.pid === id)) continue;
    const p = S.P[id], T = S.T[p.sid]; if (!T) continue;
    const w = spawnWalker(T, id === S.founder ? 'founder' : 'n');
    w.pid = id; w.spd = rf(.26, .36); w.kid = S.year - p.born < 14; w.home = homeFor(w, T); w.at = w.home; w.work = jobPlace(w, T);
    if (w.home) w.tile = bTile(w.home);
    if (id !== S.founder) { w.col = CLOTH[id % CLOTH.length]; w.skin = SKIN[(id * 7) % SKIN.length]; w.hair = HAIR[(id * 13) % HAIR.length]; }
    if (chance(.5)) w.until = DYN.t; // (half of them are out and about straight away)
  }
}
function stepAgents(dt) {
  for (const w of DYN.walkers) stepWalker(w, dt);
  for (const v of DYN.vehicles) stepVehicle(v, dt);
  stepCaravans(dt);
  stepTraders(dt);
}
