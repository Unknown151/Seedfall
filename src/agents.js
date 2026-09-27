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
  focusOn((A.x + B.x) / 2, (A.y + B.y) / 2, 1.1, 24);
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
function drawTrader(c, o, x, y, dx, dy, al, dl) {
  const along = dx !== 0, hw = along ? .15 : .07, hd = along ? .07 : .15, lc = RES_COL[o.r];
  const [fx, fy] = pt(x, y, dx * .2, dy * .2, 0);
  c.globalAlpha = al;
  ell(c, x, y, 3.4, 1.4, 'rgba(40,40,60,.18)');
  if (o.kind === 'wagon') {
    ell(c, fx, fy - 1.6, 1.7, 1.15, '#8fa58a'); ell(c, fx - .2, fy - 2.2, 1.2, .6, '#a9c0a2'); // the mossback in front
    box(c, x, y, 0, 0, hw, hd, .9, 1.5, '#9b7657');
    const [w1x, w1y] = pt(x, y, along ? -.1 : .075, along ? .075 : -.1, .8), [w2x, w2y] = pt(x, y, along ? .1 : .075, along ? .075 : .1, .8);
    circ(c, w1x, w1y, .9, '#5a4436'); circ(c, w2x, w2y, .9, '#5a4436');
  } else if (o.kind === 'truck') {
    box(c, x, y, 0, 0, hw, hd, .5, 1.6, '#6f7680'); box(c, x, y, dx * .12, dy * .12, along ? .05 : .065, along ? .065 : .05, .5, 3, o.col);
  } else { ell(c, x, y, 3.4, 1.4, 'rgba(95,208,201,.3)'); box(c, x, y, 0, 0, hw, hd, 2.4, 1.2, '#f1f4f7'); dl(x, y, 7, '#7fe8e0', .5, 1); }
  // the load
  const z = o.kind === 'hover' ? 3.6 : o.kind === 'truck' ? 2.1 : 2.4, lw = hw * .8, ld = hd * .8;
  if (o.r === 'wood') { box(c, x, y, -dx * .02, -dy * .02, lw, ld, z, 1.5, '#8f6440'); const [ex, ey] = pt(x, y, along ? lw : 0, along ? 0 : ld, z + .8); circ(c, ex, ey, .55, '#d9b88a'); }
  else if (o.r === 'goods') { box(c, x, y, -dx * .06, -dy * .06, lw * .5, ld * .7, z, 1.6, '#c9a36a'); box(c, x, y, dx * .05, dy * .05, lw * .45, ld * .6, z, 1.2, '#d8b67c'); }
  else box(c, x, y, -dx * .02, -dy * .02, lw, ld, z, o.r === 'metal' ? .9 : 1.3, lc);
  c.globalAlpha = 1;
  if (o.kind === 'wagon') dl(x, y - 4, 5, '#ffb45e', .7);
  else if (LIGHT.emK > .02) { const sx = (dx - dy) * 16, sy = (dx + dy) * 8, n = Math.hypot(sx, sy) || 1; dl(x + sx / n * 3.6, y + sy / n * 3.6 - 1.3, 4, '#fff4d6', .9 * al); dl(x + sx / n * 9, y + sy / n * 9, 8, '#fff4d6', .3 * al, 1); }
}

/* ---------- little people ---------- */
function drawPerson(c, o, x, y, dx, dy, moving, alpha, detail) {
  if (alpha <= .01) return;
  c.globalAlpha = alpha;
  const s = o.kid ? .72 : 1;
  if (!detail) { ell(c, x, y, 1.4, .6, 'rgba(40,40,60,.18)'); c.fillStyle = o.col; c.fillRect(x - 1, y - 4 * s, 2, 4 * s); c.globalAlpha = 1; return; }
  let ex = (dx - dy) * 16, ey = (dx + dy) * 8; const en = Math.hypot(ex, ey) || 1; ex /= en; ey /= en;
  const toward = ey > -.05, ph = o.ph, sw = moving ? Math.sin(ph) : 0, bob = moving ? Math.abs(Math.cos(ph)) * .28 * s : 0;
  ell(c, x, y, 1.5 * s, .65 * s, 'rgba(40,40,60,.2)');
  const hipY = y - 2.3 * s - bob, shY = y - 4.55 * s - bob, headY = y - 5.6 * s - bob;
  // legs: swing along the direction of travel, the lifted foot comes off the ground
  c.lineCap = 'round'; c.strokeStyle = o.pants; c.lineWidth = .78 * s;
  for (const sg of [1, -1]) {
    const f = sw * sg, lift = moving ? Math.max(0, Math.cos(ph) * sg) * .55 * s : 0;
    c.beginPath(); c.moveTo(x + sg * .32 * s * (toward ? 1 : -1), hipY); c.lineTo(x + sg * .3 * s + ex * f * 1.05 * s, y - .15 - lift + ey * f * .45 * s); c.stroke();
  }
  // back arm, body, front arm
  c.strokeStyle = shade(o.col, .8); c.lineWidth = .55 * s;
  c.beginPath(); c.moveTo(x - .95 * s * (ex >= 0 ? 1 : -1), shY + .3 * s); c.lineTo(x - .95 * s * (ex >= 0 ? 1 : -1) + ex * sw * .8 * s, shY + 2 * s); c.stroke();
  c.fillStyle = o.col; c.beginPath(); c.roundRect(x - 1 * s, shY - .2 * s, 2 * s, 2.75 * s, .6 * s); c.fill();
  if (o.kind === 'founder') { c.fillStyle = '#f2f0ea'; c.fillRect(x - 1 * s, shY + .9 * s, 2 * s, .45 * s); }
  c.strokeStyle = o.col; c.lineWidth = .55 * s;
  const hx = x + .95 * s * (ex >= 0 ? 1 : -1) - ex * sw * .8 * s, hy = shY + 2 * s;
  c.beginPath(); c.moveTo(x + .95 * s * (ex >= 0 ? 1 : -1), shY + .3 * s); c.lineTo(hx, hy); c.stroke();
  // head and hair
  circ(c, x, headY, .95 * s, o.skin);
  c.fillStyle = o.hair;
  if (toward) { c.beginPath(); c.arc(x, headY - .1 * s, 1.02 * s, Math.PI * 1.05, Math.PI * 1.95); c.fill(); }
  else { c.beginPath(); c.arc(x, headY, 1.0 * s, 0, TAU); c.fill(); }
  if (!o.kid && o.hat < .22) { // hats come and go with the eras
    const era = S.era;
    if (era <= 3) { ell(c, x, headY - .75 * s, 1.75 * s, .5 * s, '#d8b86a'); ell(c, x, headY - 1.05 * s, .85 * s, .55 * s, '#caa458'); }
    else if (era <= 6) { c.fillStyle = shade(o.pants, .8); c.beginPath(); c.arc(x, headY - .35 * s, 1.02 * s, Math.PI, TAU); c.fill(); c.fillRect(x + (ex >= 0 ? 0 : -1.5) * s, headY - .45 * s, 1.5 * s, .35 * s); }
  }
  c.globalAlpha = 1;
  return [hx, hy];
}
function drawPet(c, o, x, y, dx, dy, moving, alpha) {
  let ex = (dx - dy) * 16, ey = (dx + dy) * 8; const en = Math.hypot(ex, ey) || 1; ex /= en; ey /= en;
  const px = x - ex * 2.6 + 1.8, py = y - ey * 1.2 + .5, ph = o.ph * 1.35, f = ex >= 0 ? 1 : -1;
  c.globalAlpha = alpha;
  ell(c, px, py, 1.4, .5, 'rgba(40,40,60,.18)');
  c.strokeStyle = '#7a5e46'; c.lineWidth = .4;
  for (const [lx, p] of [[-.7, 0], [.7, Math.PI], [-.4, Math.PI], [.9, 0]]) { const sw = moving ? Math.sin(ph + p) * .35 : 0; c.beginPath(); c.moveTo(px + lx * f, py - 1); c.lineTo(px + lx * f + sw * f, py - .1); c.stroke(); }
  ell(c, px, py - 1.3, 1.25, .62, '#9a7a5c');
  circ(c, px + 1.25 * f, py - 1.75, .55, '#9a7a5c'); circ(c, px + 1.55 * f, py - 1.65, .18, '#3a2a20');
  c.fillStyle = '#7a5e46'; c.fillRect(px + (f > 0 ? .95 : -1.25), py - 2.45, .3, .5);
  const tw = Math.sin(DYN.t * 9 + o.ph) * .5; c.strokeStyle = '#9a7a5c'; c.lineWidth = .35; c.beginPath(); c.moveTo(px - 1.2 * f, py - 1.4); c.lineTo(px - 1.8 * f, py - 2 + tw); c.stroke();
  c.globalAlpha = 1;
}

/* ---------- occlusion: buildings and trees in front of someone are drawn again over them ---------- */
const TV = new Uint32Array(W * H); // bumped whenever a tile is redrawn
const SPR = new Map(); let SPR_BUDGET = 0;
function objSprite(i, L) {
  const key = L.key + '#' + TV[i], id = i + (L === LIGHT.next ? W * H : 0);
  let o = SPR.get(id);
  if (o && o.k === key) { SPR.delete(id); SPR.set(id, o); return o; }
  if (SPR_BUDGET <= 0) return o || null; // a stale sprite for a frame or two is fine
  const t0 = performance.now();
  const x = i % W, y = (i / W) | 0, [X, Y] = tileTop(i);
  const x0 = Math.floor(BB.x0[i]) - 1, y0 = Math.floor(BB.y0[i]) - 1, x1 = Math.ceil(BB.x1[i]) + 1, y1 = Math.ceil(Y + 18);
  const cv = o ? o.c : document.createElement('canvas');
  cv.width = (x1 - x0) * RS; cv.height = (y1 - y0) * RS;
  const g = cv.getContext('2d'); g.setTransform(RS, 0, 0, RS, -x0 * RS, -y0 * RS); g.lineJoin = 'round'; g.lineCap = 'round';
  const sv = LT, se = EMQ; LT = L; EMQ = null;
  try { drawTileObjects(g, i, x, y, X, Y + 8); } finally { LT = sv; EMQ = se; }
  o = { k: key, c: cv, x0, y0, w: x1 - x0, h: y1 - y0 };
  SPR.delete(id); SPR.set(id, o);
  while (SPR.size > 900) SPR.delete(SPR.keys().next().value);
  SPR_BUDGET -= performance.now() - t0;
  return o;
}
function isOccluder(i) {
  if (CH[i] < 4) return false;
  const b = M.bld[i]; if (b) { const B = S.B[b]; return !!B && B.prog >= 1 && !B.hid && !FLAT_TYPES[B.type]; }
  return true;
}
// tiles in front of a thing at grid (fx, fy), world (wx, wy), h px tall, whose objects overlap it on screen.
// out maps tile -> the part of the screen that needs covering (only that bit of the sprite gets redrawn)
function occludersFor(fx, fy, wx, wy, h, out) {
  const d = fx + fy, c0 = Math.ceil((wx - OX - 21) / 16), c1 = Math.floor((wx - OX + 21) / 16);
  let hid = false;
  for (let s = Math.max(0, Math.floor(d + 1e-4) + 1); s <= Math.min(W + H - 2, d + 26); s++) {
    for (let cc = c0; cc <= c1; cc++) {
      if (((s + cc) & 1) !== 0) continue;
      const x = (s + cc) >> 1, y = (s - cc) >> 1; if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const i = y * W + x;
      if (!isOccluder(i)) continue;
      if (BB.y0[i] > wy + 1 || BB.x0[i] > wx + 2.5 || BB.x1[i] < wx - 2.5) continue;
      const Y = (x + y) * TH2 + OY - surfZ(i) + 17; if (Y < wy - h) continue;
      const r = out.get(i), rx0 = wx - 3.5, ry0 = wy - h - 1.5, rx1 = wx + 3.5, ry1 = wy + 2;
      if (r) { if (rx0 < r[0]) r[0] = rx0; if (ry0 < r[1]) r[1] = ry0; if (rx1 > r[2]) r[2] = rx1; if (ry1 > r[3]) r[3] = ry1; }
      else out.set(i, [rx0, ry0, rx1, ry1]);
      if (BB.y0[i] < wy - h * .5 && Y > wy - 1) hid = true;
    }
  }
  return hid;
}

/* ---------- drawing everything that moves, in depth order ---------- */
const MARKS = [];
function drawAgents(c) {
  SPR_BUDGET = 5;
  const items = [], occ = new Map();
  const [vx0, vy0] = s2w(-60, -60), [vx1, vy1] = s2w(VW + 60, VH + 60);
  const vis = (wx, wy) => wx > vx0 && wx < vx1 && wy > vy0 && wy < vy1 + 40;
  const detail = CAM.z > 0.9 ? (CAM.z > 2.6 ? 2 : 1) : 0;
  const doOcc = CAM.z > .85;
  const add = (d, kind, o, fx, fy, z, h, extra) => {
    const [wx, wy] = gridToWorld(fx, fy, z); if (!vis(wx, wy - h)) return;
    const hid = doOcc ? occludersFor(fx, fy, wx, wy, h, occ) : false;
    items.push([d, kind, o, wx, wy, hid, extra]);
  };
  MARKS.length = 0;
  for (const w of DYN.walkers) { w.sx = null; const p = walkerPos(w); if (!p) continue; add(p[0] + p[1], 0, w, p[0], p[1], p[2], 8, p); }
  for (const v of DYN.vehicles) { const p = vehiclePos(v); if (!p) continue; add(p[0] + p[1], 1, v, p[0], p[1], p[2], 5, p); }
  for (const b of DYN.boats) { const p = boatPos(b); if (p) add(p[0] + p[1], 2, b, p[0], p[1], SEAZ, 10, p); }
  for (const sh of DYN.ships) { const p = shipPos(sh); if (p) add(p[0] + p[1], 11, sh, p[0], p[1], SEAZ, 16, p); }
  for (const o of DYN.ferries) { const p = ferryPos(o), i = idx(clamp(Math.round(p[0]), 0, W - 1), clamp(Math.round(p[1]), 0, H - 1)); add(p[0] + p[1], 12, o, p[0], p[1], M.water[i] === 1 ? SEAZ : surfZ(i), 8, p); }
  for (const p of DYN.planes) if (!planeAir(p)) add(p.x + p.y + .3, 13, p, p.x, p.y, p.z, 8);
  for (const B of airfields()) { const a = DYN.af[B.id]; if (!a || a.parked) { const o = DYN.af[B.id] = a || { next: DYN.t + rf(8, 30), parked: 1 }; o.pp = o.pp || { kind: planeKind(), x: B.x - .05, y: B.y - .24, h: Math.PI, t: 0, col: pick(['#e05b52', '#3f7fb0', '#e0a43a', '#4e9a6a']), id: rnd() }; o.pp.z = afZ(B); o.pp.kind = planeKind(); add(B.x + B.y + .2, 13, o.pp, o.pp.x, o.pp.y, o.pp.z, 8); } }
  for (const h of DYN.herds) for (const m of h.members) { const [fx, fy, z] = agentPos(m); add(fx + fy, 3, m, fx, fy, z, 5); }
  for (const tr of DYN.trains) {
    for (let k = 0; k < 3; k++) {
      const s = clamp(tr.s - tr.dir * k * .75, 0, tr.r.path.length - 1), i0 = Math.floor(s), i1 = Math.min(tr.r.path.length - 1, i0 + 1), f = s - i0;
      const a = tr.r.path[i0], b = tr.r.path[i1];
      const fx = lerp(a % W, b % W, f), fy = lerp((a / W) | 0, (b / W) | 0, f);
      const z = lerp(M.water[a] ? landZ(a) + 3 : surfZ(a), M.water[b] ? landZ(b) + 3 : surfZ(b), f);
      add(fx + fy, 4, { k, along: (b % W) !== (a % W) }, fx, fy, z + .5, 5);
    }
  }
  for (const cv of DYN.caravans) { const p = caravanPos(cv); if (p) add(p[0] + p[1], 5, cv, p[0], p[1], p[2], 8, p); }
  for (const t of DYN.traders) { const p = pathPos(t, .12, true, true); add(p[0] + p[1], 10, t, p[0], p[1], p[2], 6, p); }
  for (const g of DYN.giants) { const i = idx(clamp(Math.round(g.fx), 0, W - 1), clamp(Math.round(g.fy), 0, H - 1)); add(g.fx + g.fy, 6, g, g.fx, g.fy, landZ(i), 90); }
  if (DYN.drone && S.T[1]) { const T = S.T[1]; const a = DYN.t * .25; const fx = T.x + Math.cos(a) * 1.6, fy = T.y + Math.sin(a) * 1.6; add(fx + fy + 1.5, 7, null, fx, fy, landZ(idx(T.x, T.y)) + 16 + Math.sin(DYN.t * 2) * 2, 4); }
  // animated parts of buildings (sails, blades, lights) sit at their building's depth
  for (const B of DYN.anim) { const a = BT[B.type].anim; if (!a) continue; items.push([B.x + B.y + .02, 8, B]); }
  // the buildings and trees that hide something get drawn again, at their own depth
  const L = LIGHT.cur, Ln = LIGHT.fade >= 0 ? LIGHT.next : null, fa = Ln ? smooth(clamp(LIGHT.fade, 0, 1)) : 0;
  for (const [i, r] of occ) items.push([(i % W) + ((i / W) | 0) + .01, 9, i, r]);
  items.sort((a, b) => a[0] - b[0]);
  for (const it of items) {
    const kind = it[1];
    if (kind === 9) {
      const i = it[2], r = it[3], o = objSprite(i, L); if (!o) continue;
      const blit = (o) => {
        const x0 = Math.max(o.x0, r[0]), y0 = Math.max(o.y0, r[1]), x1 = Math.min(o.x0 + o.w, r[2]), y1 = Math.min(o.y0 + o.h, r[3]);
        if (x1 > x0 && y1 > y0) c.drawImage(o.c, (x0 - o.x0) * RS, (y0 - o.y0) * RS, (x1 - x0) * RS, (y1 - y0) * RS, x0, y0, x1 - x0, y1 - y0);
      };
      blit(o);
      if (Ln) { const o2 = objSprite(i, Ln); if (o2) { c.globalAlpha = fa; blit(o2); c.globalAlpha = 1; } }
      continue;
    }
    if (kind === 8) { drawAnimOne(c, it[2]); continue; }
    drawItem(c, kind, it[2], it[3], it[4], it[5], it[6], detail);
  }
}
function drawItem(c, kind, o, x, y, hid, p, detail) {
  const dl = hid ? () => { } : dlight;
  switch (kind) {
    case 0: { // person
      const [, , , al, dx, dy, mv] = p;
      const hand = drawPerson(c, o, x, y, dx, dy, mv, al, detail);
      if (o.pet && detail && al > .5) drawPet(c, o, x, y, dx, dy, mv, al);
      if (LIGHT.emK > .02 && al > .5 && hand && o.ln < (LT.era === 0 ? .6 : .12)) {
        c.fillStyle = '#ffd08a'; c.fillRect(hand[0] - .4, hand[1] - .2, .8, 1);
        dl(hand[0], hand[1] + .3, 5, LT.era === 0 ? '#ffb45e' : '#fff0c8', .85);
      }
      if (o.pid && al > .3) MARKS.push([o, x, y, mv ? Math.abs(Math.cos(o.ph)) * .28 : 0, hid]);
      o.hid = hid;
      break;
    }
    case 1: { // vehicle
      const [, , , al, dx, dy] = p, along = dx !== 0, hw = along ? .1 : .055, hd = along ? .055 : .1;
      c.globalAlpha = al;
      if (o.kind === 'cart') { ell(c, x, y, 2.6, 1.1, 'rgba(40,40,60,.18)'); box(c, x, y, 0, 0, hw, hd, .6, 2, '#9b7657'); const [mx, my] = pt(x, y, dx * .17, dy * .17, 0); ell(c, mx, my - 1.5, 1.6, 1.1, '#8fa58a'); dl(x, y - 3.5, 5, '#ffb45e', .8); }
      else if (o.kind === 'car') { ell(c, x, y, 2.6, 1.1, 'rgba(40,40,60,.2)'); box(c, x, y, 0, 0, hw, hd, .5, 1.6, o.col); box(c, x, y, 0, 0, hw * .6, hd * .6, 2.1, 1, shade(o.col, 1.2)); }
      else { ell(c, x, y, 2.6, 1.1, 'rgba(95,208,201,.35)'); box(c, x, y, 0, 0, hw, hd, 2.5, 1.8, '#f4f6f8'); dl(x, y, 7, '#7fe8e0', .6, 1); }
      c.globalAlpha = 1;
      if (LIGHT.emK > .02 && o.kind !== 'cart' && al > .3) {
        const sx = (dx - dy) * 16, sy = (dx + dy) * 8, n = Math.hypot(sx, sy) || 1;
        dl(x + sx / n * 3.2, y + sy / n * 3.2 - 1.3, 4, '#fff4d6', .9 * al); dl(x + sx / n * 9, y + sy / n * 9, 8, '#fff4d6', .35 * al, 1); dl(x - sx / n * 3, y - sy / n * 3 - 1.2, 2.4, '#ff4a4a', .8 * al);
      }
      break;
    }
    case 2: { const [, , , dx, dy, mv] = p; drawBoat(c, o, x, y, dx, dy, mv, dl); break; }
    case 11: { const [, , al, dx, dy] = p; drawShip(c, o, x, y, dx, dy, al, dl, o.st === 'sail' && !o.wait); break; }
    case 12: { const [, , dx, dy, mv] = p; drawFerry(c, o, x, y, dx, dy, mv, dl); break; }
    case 13: drawPlane(c, o, dl); break;
    case 3: { // mossback, with plodding legs
      const s = o.size * (o.baby ? .6 : 1), ph = DYN.t * 3 + (o.a % 7), mv = o.pause > 0 ? 0 : 1;
      ell(c, x, y, 2.4 * s, 1 * s, 'rgba(40,40,60,.15)');
      c.fillStyle = '#b9ae9c';
      for (const [lx, q] of [[-1.5, 0], [1, Math.PI], [-.9, Math.PI], [1.5, 0]]) c.fillRect(x + lx * s, y - 1.8 * s + (mv ? Math.max(0, Math.sin(ph + q)) * .4 : 0), .55, 1.8 * s - (mv ? Math.max(0, Math.sin(ph + q)) * .4 : 0));
      ell(c, x, y - 2.4 * s, 2.5 * s, 1.5 * s, '#cfc3ae'); ell(c, x - .2, y - 3.1 * s, 2 * s, .9 * s, '#8fbf88');
      circ(c, x + 2.4 * s, y - 2.8 * s + (mv ? Math.sin(ph * 2) * .15 : 0), .9 * s, '#cfc3ae');
      break;
    }
    case 4: { // train car
      const hw = o.along ? .2 : .07, hd = o.along ? .07 : .2, mag = hasTech('maglev');
      const col = mag ? '#f2f5f8' : hasTech('electric') ? (o.k === 0 ? '#c8553d' : '#e9d9b8') : (o.k === 0 ? '#3d3f47' : '#8a3f37');
      box(c, x, y, 0, 0, hw, hd, mag ? 1.5 : .5, 3, col);
      dl(x, y - 2.5, o.k === 0 ? 6 : 5, o.k === 0 ? '#fff4d6' : '#ffe2a0', o.k === 0 ? .9 : .55);
      if (!mag && !hasTech('electric') && o.k === 0 && chance(.15)) addPart(x, y - 5, rf(-2, 2), -8, 2, '#e8e4df', .6, 'smoke', 1.5);
      break;
    }
    case 5: { // caravan walker with a pack
      const [, , , al, dx, dy] = p;
      const hand = drawPerson(c, o, x, y, dx, dy, 1, al, detail);
      if (detail) { c.fillStyle = '#b08d6b'; c.fillRect(x - (dx - dy >= 0 ? 2.1 : -1.1), y - 4.3, 1, 1.9); }
      if (hand) dl(hand[0], hand[1], 5, '#ffb45e', .8);
      break;
    }
    case 10: { const [, , , al, dx, dy] = p; drawTrader(c, o, x, y, dx, dy, al, dl); break; }
    case 6: { // Longstrider
      const t = DYN.t, sw = Math.sin(t * 1.4) * 5;
      ell(c, x, y + 1, 12, 4, 'rgba(40,40,60,.15)');
      const body = [x, y - 78];
      c.strokeStyle = '#c9b8d8'; c.lineWidth = 1.8;
      for (const [dx, ph] of [[-7, 0], [7, Math.PI], [-3, Math.PI], [4, 0]]) { const fx = x + dx + Math.sin(t * 1.4 + ph) * 5; c.beginPath(); c.moveTo(body[0] + dx * .5, body[1]); c.quadraticCurveTo(body[0] + dx * 1.4, body[1] + 38, fx, y); c.stroke(); }
      ell(c, body[0], body[1], 13, 7, '#d8c9e6'); ell(c, body[0] - 2, body[1] - 3, 9, 3.5, '#e8ddf2');
      c.strokeStyle = '#d8c9e6'; c.lineWidth = 3; c.beginPath(); c.moveTo(body[0] + 10, body[1] - 2); c.quadraticCurveTo(body[0] + 16 + sw * .3, body[1] - 18, body[0] + 20, body[1] - 30); c.stroke();
      ell(c, body[0] + 21, body[1] - 31, 3.5, 2.2, '#d8c9e6'); circ(c, body[0] + 22.5, body[1] - 31.5, .7, '#3a3340');
      break;
    }
    case 7: { // pod drone
      ell(c, x, y + 16, 2, .8, 'rgba(40,40,60,.12)');
      c.fillStyle = '#e8eaef'; c.beginPath(); c.ellipse(x, y, 2.6, 1.3, 0, 0, TAU); c.fill();
      line(c, x - 3.5, y - 1, x + 3.5, y - 1, '#9aa1ad', .4);
      if ((DYN.t * 2) % 1 < .5) { circ(c, x, y + .3, .5, '#e5874f'); dl(x, y + .3, 4, '#ffa060', .9); }
      break;
    }
  }
}
function drawAnimOne(c, B) {
  const t = DYN.t, a = BT[B.type].anim;
  const [cx, cy] = gridToWorld(B.x, B.y, landZ(idx(B.x, B.y)));
  if (a !== 'tether' && !inView(cx, cy - 40, 120)) return;
  if (a === 'mill') {
    const [hx, hy] = pt(cx, cy, .05, .2, 17);
    for (let k = 0; k < 4; k++) { const ang = t * .9 + k * Math.PI / 2; const ex = hx + Math.cos(ang) * 13 * .6, ey = hy + Math.sin(ang) * 13; line(c, hx, hy, ex, ey, '#7a5a44', .9); c.save(); c.translate(hx, hy); c.transform(.6, 0, 0, 1, 0, 0); c.rotate(ang); c.fillStyle = 'rgba(245,238,225,.95)'; c.fillRect(4, -1.8, 9, 3.6); c.restore(); }
    circ(c, hx, hy, 1.4, '#6b5040');
  } else if (a === 'turbine') {
    const [hx, hy] = pt(cx, cy, .04, .04, 57);
    for (let k = 0; k < 3; k++) { const ang = t * 1.6 + k * TAU / 3; c.save(); c.translate(hx, hy); c.transform(.55, 0, 0, 1, 0, 0); c.rotate(ang); c.fillStyle = '#f7f8fa'; c.beginPath(); c.moveTo(0, -1); c.lineTo(20, -.3); c.lineTo(20, .3); c.lineTo(0, 1); c.fill(); c.restore(); }
    circ(c, hx, hy, 1.2, '#e1e4e8');
  } else if (a === 'blink') {
    const top = B.type === 'mast' ? 66 : 46; const [x, y] = pt(cx, cy, 0, 0, top + 1);
    const on = (t + B.id * .37) % 1.6 < .8; if (on) { circ(c, x, y, 1.3, '#ff4d4d'); circ(c, x, y, 3.2, 'rgba(255,77,77,.25)'); dlight(x, y, 7, '#ff4d4d', 1); }
  } else if (a === 'glow') {
    const p = .5 + .5 * Math.sin(t * 2 + B.id);
    c.strokeStyle = `rgba(95,208,201,${.3 + p * .4})`; c.lineWidth = 2.2; c.beginPath(); c.ellipse(cx, cy - 12, .36 * 22.6, .36 * 11.3 * .7, 0, 0, Math.PI); c.stroke();
    dlight(cx, cy - 10, 14, '#5fd0c9', .3 + p * .4);
  } else if (a === 'chop' || a === 'dig') {
    if (CAM.z < .9) return;
    const sun = LIGHT.sun || { hr: 13, fixed: 1 }; if (!sun.fixed && (sun.hr >= 20 || sun.hr < 6.5)) return; // home for the night
    const o = animWorker(B), chop = a === 'chop';
    const [px, py] = chop ? pt(cx, cy, -.2, .36, 0) : pt(cx, cy, -.08, -.02, -4.7); // the digger works a terrace of the pit
    const hand = drawPerson(c, o, px, py, chop ? 0 : -1, chop ? -1 : 0, false, 1, 1); if (!hand) return;
    const ph = (t * (chop ? 1.1 : 1.5) + B.id * .37) % 1, sw = ph < .7 ? -1.9 + ph / .7 * .6 : -1.3 + (ph - .7) / .3 * 2.3; // slow lift, fast swing
    const L = chop ? 4.2 : 3.6, ex = hand[0] + Math.cos(sw) * L, ey = hand[1] + Math.sin(sw) * L;
    line(c, hand[0], hand[1], ex, ey, '#6b5040', .5);
    if (chop) poly(c, [[ex, ey], [ex + Math.cos(sw + 1.4) * 1.3, ey + Math.sin(sw + 1.4) * 1.3], [ex + Math.cos(sw - .3) * .9, ey + Math.sin(sw - .3) * .9]], '#b8c0c9');
    else { line(c, ex - Math.sin(sw) * 1.2, ey + Math.cos(sw) * 1.2, ex + Math.sin(sw) * 1.2, ey - Math.cos(sw) * 1.2, '#9aa3ad', .55); }
    if (ph > .97 && !o.hit) { o.hit = 1; for (let k = 0; k < 3; k++) addPart(ex, ey, rf(-4, 4), rf(-7, -2), rf(.5, 1), chop ? '#d9b88a' : '#d8d2c8', .9, 'spark'); }
    if (ph < .5) o.hit = 0;
  } else if (a === 'beam') { // the lighthouse lamp turns all night
    if (LIGHT.emK > .02) { const [x, y] = pt(cx, cy, 0, 0, 39.7); BEAMS.push([x, y, t * .8 + B.id * 1.7]); }
  } else if (a === 'crane') { // the harbour crane swings cargo in and out
    if (CAM.z < .7) return;
    const d = B.dir || [1, 0], al = [-d[1], d[0]], hp = (a2, o) => [a2 * al[0] + o * d[0], a2 * al[1] + o * d[1]];
    const steel = hasTech('steam'), zt = steel ? 11 : 8, [pu, pv] = hp(.26, .2), [px, py] = pt(cx, cy, pu, pv, zt);
    const base = Math.atan2(d[1], d[0]), ang = base + Math.sin(t * .35 + B.id) * 1.1, L = steel ? .42 : .32;
    const eu = pu + Math.cos(ang) * L, ev = pv + Math.sin(ang) * L, [ex, ey] = pt(cx, cy, eu, ev, zt + 1.5);
    line(c, px, py, ex, ey, steel ? '#d6703a' : '#7a5a44', steel ? 1.3 : 1);
    const hang = 3 + (Math.sin(t * .7 + B.id) * .5 + .5) * 6; line(c, ex, ey, ex, ey + hang, 'rgba(60,60,70,.8)', .3);
    c.fillStyle = hasTech('computing') ? '#3f7fb0' : '#a57c55'; c.fillRect(ex - 1.3, ey + hang, 2.6, 1.8);
  } else if (a === 'tether') {
    const [x, y] = pt(cx, cy, 0, 0, 75);
    const [, topW] = s2w(0, -10);
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 1.2 / CAM.z + .4; c.beginPath(); c.moveTo(x, y); c.lineTo(x, Math.min(y - 10, topW)); c.stroke();
    for (let k = 0; k < 3; k++) { const f = ((t * .03 + k / 3) % 1); const yy = lerp(y, topW, f); c.fillStyle = '#f4f6f8'; c.fillRect(x - 2, yy - 3, 4, 6); c.fillStyle = '#5fd0c9'; c.fillRect(x - 2, yy - 1, 4, 1); dlight(x, yy, 6, '#9ff0ea', .7); }
  }
}
const ANIMW = new Map();
function animWorker(B) {
  let o = ANIMW.get(B.id);
  if (!o) { o = { col: pick(['#8a6a4a', '#6e7f5c', '#9a5a44', '#5f6f86']), pants: pick(PANTS), hair: pick(HAIR), skin: pick(SKIN), hat: rnd() * .4, kid: false, ph: 0, kind: 'p' }; ANIMW.set(B.id, o); if (ANIMW.size > 200) ANIMW.delete(ANIMW.keys().next().value); }
  return o;
}
function drawCandle(c, x, y, ms, seed) {
  const fl = .8 + .2 * Math.sin(DYN.t * 7 + seed);
  c.globalCompositeOperation = 'lighter'; drawGlow(c, x, y, ms * 3.2 * fl, '#ffc766', .55); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.fillStyle = '#ffd27a'; c.beginPath(); c.ellipse(x, y, ms * .5, ms * .85 * fl, 0, 0, TAU); c.fill();
  c.fillStyle = '#fff4d6'; c.beginPath(); c.ellipse(x, y + ms * .2, ms * .24, ms * .42, 0, 0, TAU); c.fill();
}
// diamonds over named people are UI: always visible, never shaded by night or hidden by a roof
function drawMarks(c) {
  // someone praying indoors: the candle burns over the house they're in
  for (const q of S.prayers || []) {
    if (q.st !== 'open') continue;
    const w = DYN.walkers.find(w => w.pid === q.pid); if (!w || w.st !== 'in') continue;
    const B = S.B[w.at]; if (!B) continue;
    const i = idx(B.x, B.y), [wx, wy] = gridToWorld(B.x, B.y, surfZ(i));
    drawCandle(c, wx, wy - objH(i) * .8 - 8, Math.max(1.6, 4.5 / CAM.z), q.pid);
  }
  for (const [o, x, y, bob, hid] of MARKS) {
    c.globalAlpha = hid ? .5 : 1;
    const p = S.P[o.pid]; if (!p) continue;
    const T = S.T[p.sid], s = o.kid ? .72 : 1;
    const col = o.pid === S.founder ? '#e5874f' : T && T.leader === p.id ? '#f2b84b' : p.fl != null && p.fl <= 3 ? '#7fd08a' : '#5fd0c9';
    const ms = Math.max(1.05, 3 / CAM.z), my = y - 7.6 * s - bob - ms;
    if ((S.prayers || []).some(q => q.st === 'open' && q.pid === o.pid)) drawCandle(c, x, my - ms * 2.6, ms, o.pid); // praying: a small candle over them
    if (DYN.hoverPid === o.pid) { c.strokeStyle = 'rgba(255,255,255,.95)'; c.lineWidth = Math.max(.4, 1.2 / CAM.z); c.beginPath(); c.ellipse(x, y, 3.2, 1.5, 0, 0, TAU); c.stroke(); }
    c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.moveTo(x, my - ms * 1.35); c.lineTo(x + ms * 1.05, my); c.lineTo(x, my + ms * 1.35); c.lineTo(x - ms * 1.05, my); c.closePath(); c.fill();
    c.fillStyle = col; c.beginPath(); c.moveTo(x, my - ms); c.lineTo(x + ms * .72, my); c.lineTo(x, my + ms); c.lineTo(x - ms * .72, my); c.closePath(); c.fill();
    const sc = w2s(x, y - 3); o.sx = sc[0]; o.sy = sc[1];
  }
  c.globalAlpha = 1;
}

/* ---------- keeping the right number of people and vehicles around ---------- */
function syncPeople() {
  let total = 0;
  const vt = hasTech('hover') ? 'hover' : hasTech('motor') ? 'car' : hasTech('wheel') ? 'cart' : null;
  for (const T of towns()) {
    const want = Math.round(Math.min(56, (T.id === 1 && S.year < 20 ? 0 : 4) + Math.sqrt(T.pop) * 2.3));
    const have = DYN.walkers.filter(w => w.tid === T.id && w.kind === 'p');
    if (have.length < want && total < 380) { for (let k = 0; k < Math.min(4, want - have.length); k++) spawnWalker(T); }
    else if (have.length > want + 3) { const w = have.find(w => w.st === 'in') || have[0]; DYN.walkers.splice(DYN.walkers.indexOf(w), 1); }
    total += have.length;
    if (vt) {
      const vw = Math.round(Math.min(16, T.pop / 90)), vh = DYN.vehicles.filter(v => v.tid === T.id);
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
    if (CAM.followPid === id || chance(.5)) { w.until = DYN.t; } // the person you asked to see comes out soon
  }
}
function stepAgents(dt) {
  for (const w of DYN.walkers) stepWalker(w, dt);
  for (const v of DYN.vehicles) stepVehicle(v, dt);
  stepCaravans(dt);
  stepTraders(dt);
}
