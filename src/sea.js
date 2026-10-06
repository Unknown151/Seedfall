/* ============================== the water: harbours, ships, ferries, fishing boats ============================== */
// Big coastal towns build a harbour, and ships sail between harbours (or off over the horizon), carrying
// the towns' trade. Ferries shuttle across lakes and inlets where the way round is long. Fishing boats
// leave their piers in the morning and come home at dusk.

/* ---------- open water: connected sea and lakes (rivers don't count) ---------- */
let WB = null;
function waterBodies() {
  if (WB && WB.S === S) return WB;
  const id = new Int32Array(W * H), size = [0];
  for (let i = 0; i < W * H; i++) {
    if (M.water[i] !== 1 || id[i]) continue;
    const n = size.length, q = [i]; let c = 0; id[i] = n;
    while (q.length) { const k = q.pop(); c++; const x = k % W, y = (k / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.water[j] === 1 && !id[j]) { id[j] = n; q.push(j); } } }
    size.push(c);
  }
  return (WB = { S, id, size });
}
const bigWater = i => { if (M.water[i] !== 1) return false; const w = waterBodies(); return w.size[w.id[i]] >= 40; };
const sameWater = (a, b) => { const w = waterBodies(); return w.id[a] && w.id[a] === w.id[b]; };
function waterNear(x, y, r) { let n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && bigWater(idx(nx, ny))) n++; } return n; }

/* ---------- harbours ---------- */
function seaAhead(x, y, [dx, dy]) { // open water straight out from this tile, deep enough for ships
  const a = [x + dx, y + dy], b = [x + dx * 2, y + dy * 2], c2 = [x + dx * 3, y + dy * 3]; if (!inb(...c2)) return false;
  return bigWater(idx(...a)) && bigWater(idx(...b)) && M.water[idx(...c2)] === 1 && !M.road[idx(...a)];
}
function harbourSite(x, y) { // a shore tile with open water in front
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const a = [x + dx, y + dy], b = [x + dx * 2, y + dy * 2], c2 = [x + dx * 3, y + dy * 3];
    if (!inb(...c2)) continue;
    const ia = idx(...a), ib = idx(...b), ic = idx(...c2);
    if (bigWater(ia) && bigWater(ib) && M.water[ic] === 1 && !M.road[ia]) return [dx, dy];
  }
  return null;
}
// finished buildings of one type (cached until something new is built or a month passes)
const BUILT = { k: '', v: {} };
function builtOf(type) {
  const k = S.month + ':' + S.nextB + ':' + (S.created || 0);
  if (BUILT.k !== k) { BUILT.k = k; BUILT.v = {}; }
  let a = BUILT.v[type]; if (a) return a.filter(B => S.B[B.id]);
  a = BUILT.v[type] = []; for (const id in S.B) { const B = S.B[id]; if (B.type === type && B.prog >= 1) a.push(B); }
  return a;
}
const harbours = () => builtOf('harbor').filter(B => B.dir);
// a long harbour has a berth in front of each of its tiles along the shore; ships keep a berth each (DYN.slot['id:k'])
const berths = B => Math.max(fpW(B), fpH(B));
const berthTile = (B, k = 0) => { k = Math.min(k || 0, berths(B) - 1); return idx(B.x + (B.dir[0] || k), B.y + (B.dir[1] || k)); };
const moorTile = B => berthTile(B, 0);
const bkey = (B, k) => (B.id || B) + ':' + (k || 0);
function freeBerth(B) { const n = berths(B), o = []; for (let k = 0; k < n; k++) if (!DYN.slot[bkey(B, k)]) o.push(k); return o.length ? pick(o) : -1; }
const townHarbour = T => T.bl.map(id => S.B[id]).find(B => B && B.type === 'harbor' && B.prog >= 1 && B.dir);
// harbours grow along the coast as their town does: a quay, a second berth, a port, then the container docks
function harbourLen(T) { return !T ? 1 : 1 + (T.pop >= 1200 ? 1 : 0) + (hasTech('steam') && T.pop >= 3000 ? 1 : 0) + (hasTech('computing') && T.pop >= 7000 ? 1 : 0); }
const HB_GROW = ['', '', 'The harbour of {T} lays a second stone quay along the shore. Two ships can tie up at once now.',
  'The harbour of {T} grows into a proper port: piers out into deep water, warehouses in a row and cranes along the quay.',
  'Container docks open at {T}: great gantry cranes, stacked boxes in every colour, and a quay that never quite sleeps.'];
function yearlyHarbours() {
  for (const B of harbours()) {
    const T = S.T[B.sid], n = berths(B); if (n >= harbourLen(T) || !chance(.4)) continue;
    let hz = -1; for (const t of fpTiles(B)) if (!M.water[t]) hz = Math.max(hz, surfZ(t)); // (the lot's land height: its corner may be out over the water)
    const ok = (j) => { const z = hz;
      const x = j % W, y = (j / W) | 0; if (!seaAhead(x, y, B.dir)) return false; // more of the same shore...
      if (M.water[j] === 1) return !M.bld[j] && !M.road[j] && N4.some(([dx, dy]) => inb(x + dx, y + dy) && !M.water[idx(x + dx, y + dy)]); // ...or a quay built out over the shallows, on piles
      const o = M.bld[j] && S.B[M.bld[j]]; return fpYield(j, z) || o && (o.type === 'house' || o.type === 'dock' || o.type === 'sandpit' || o.type === 'claypit') && !fpBig(o) && !M.road[j] && !M.plan[j] && surfZ(j) === z; // (docks may take any house, the old pier, a pit)
    };
    if (B.dir[0] ? fpGrow(B, 1, n + 1, ok) : fpGrow(B, n + 1, 1, ok)) { for (let k = 0; k <= n; k++) markDirty(berthTile(B, k)); if (T && HB_GROW[n + 1]) chron('⚓', HB_GROW[n + 1].replace('{T}', T.name), { T }); }
  }
}
function seaLinked(A, B) { const a = townHarbour(A), b = townHarbour(B); return !!(a && b && sameWater(moorTile(a), moorTile(b))); }

/* ---------- routes over open water, kept a little off the coast ---------- */
const ROUTES = new Map();
function seaRoute(a, b) {
  if (ROUTES.S !== S || ROUTES.v !== S.seaV) { ROUTES.clear(); ROUTES.S = S; ROUTES.v = S.seaV; } // another world's routes would cross its land (and new things at sea are in the way)
  const key = a + '-' + b;
  if (ROUTES.has(key)) return ROUTES.get(key);
  const coast = i => { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && M.water[idx(nx, ny)] !== 1) return 1; } return 0; };
  const path = astar(a, b, (i, j) => M.water[j] === 1 && !(M.bld[j] && SEA_T[(S.B[M.bld[j]] || {}).type]) ? 1 + coast(j) * 1.6 : 1e9);
  if (ROUTES.size > 200) ROUTES.clear();
  ROUTES.set(key, path);
  return path;
}
function edgeWater(from) { // somewhere out past the edge of the map, on the same sea
  const w = waterBodies(), c = [];
  for (let k = 0; k < W; k++) for (const [x, y] of [[k, 0], [k, H - 1], [0, k], [W - 1, k]]) { const i = idx(x, y); if (M.water[i] === 1 && w.id[i] === w.id[from]) c.push(i); }
  return c.length ? pick(c) : -1;
}
function edgeOut(i) { const x = i % W, y = (i / W) | 0; return x === 0 ? [-1, 0] : x === W - 1 ? [1, 0] : y === 0 ? [0, -1] : [0, 1]; }

/* ---------- ships ---------- */
const shipCap = () => Math.round((7 + Math.min(3, builtOf('shipyard').length)) * (LVV.sea === 'seafaring' ? 1.6 : LVV.sea === 'landlubbers' ? .4 : 1)); // shipyards put more ships on the water (and a seafaring people more)
function shipKind() { return hasTech('hover') ? 'hover' : hasTech('computing') ? 'boxship' : hasTech('electric') ? 'freighter' : hasTech('steam') ? 'steamer' : 'sail'; }
function spawnShip(fromB, toB, r) {
  if (DYN.ships.length >= shipCap()) return null;
  const hs = harbours(); if (!hs.length) return null;
  const home = fromB || pick(hs), bk = Math.max(0, freeBerth(home));
  const sh = { kind: shipKind(), r: r || pick(['wood', 'stone', 'clay', 'metal', 'goods']), col: pick(['#b8554a', '#3f6e8c', '#3d6b4f', '#8a5a3c', '#5b5f8a']), path: null, s: 0, st: 'moor', at: home.id, until: DYN.t + rf(10, 22), to: toB ? toB.id : 0, hx: -home.dir[1], hy: home.dir[0], id: rnd(), bk };
  DYN.ships.push(sh); return sh;
}
function arriveShip() { // a ship from over the horizon heading for one of the harbours
  const hs = harbours(); if (!hs.length || DYN.ships.length >= shipCap()) return;
  const B = pick(hs), bk = Math.max(0, freeBerth(B)), m = berthTile(B, bk), e = edgeWater(m); if (e < 0) return;
  const path = seaRoute(e, m); if (!path || path.length < 4) return;
  const [ox, oy] = edgeOut(e), pre = [];
  for (let k = 4; k >= 1; k--) { const x = e % W + ox * k, y = ((e / W) | 0) + oy * k; pre.push({ x, y }); }
  DYN.ships.push({ kind: shipKind(), r: pick(RES), col: pick(['#b8554a', '#3f6e8c', '#3d6b4f', '#8a5a3c', '#5b5f8a']), path, pre, s: -4, st: 'sail', to: B.id, hx: -ox, hy: -oy, id: rnd(), tbk: bk });
}
function departShip(sh) {
  const A = S.B[sh.at]; if (!A) { sh.gone = 1; return; }
  const from = berthTile(A, sh.bk), hs = harbours().filter(B => B !== A && sameWater(moorTile(B), from));
  let B = sh.to && S.B[sh.to] && S.B[sh.to] !== A ? S.B[sh.to] : null;
  if (!B && hs.length && chance(.65)) B = pick(hs);
  let path = null, off = null;
  let tbk = 0; if (B) { tbk = Math.max(0, freeBerth(B)); path = seaRoute(from, berthTile(B, tbk)); }
  if (!path) { const e = edgeWater(from); if (e >= 0) { path = seaRoute(from, e); off = edgeOut(e); } B = null; }
  if (!path || path.length < 2) { sh.until = DYN.t + 20; return; }
  sh.path = path; sh.s = 0; sh.st = 'sail'; sh.to = B ? B.id : 0; sh.tbk = tbk; sh.off = off; sh.from = A.id;
  if (DYN.slot[bkey(A, sh.bk)] === sh) DYN.slot[bkey(A, sh.bk)] = null;
}
function stepShips(dt) {
  if (!S || !hasTech('boats')) return;
  const hs = harbours();
  // keep a few ships about
  if (hs.length && DYN.t > (DYN.nextShip || 0)) {
    DYN.nextShip = DYN.t + rf(35, 80);
    const yards = Math.min(3, builtOf('shipyard').length), want = Math.min(6 + yards, 1 + Math.round(hs.length * 1.5) + yards);
    if (DYN.ships.length < want) { if (chance(.5)) arriveShip(); else { const sh = spawnShip(); if (sh) { if (DYN.slot[bkey(sh.at, sh.bk)]) { sh.gone = 1; } else DYN.slot[bkey(sh.at, sh.bk)] = sh; } } }
  }
  for (const sh of DYN.ships) {
    if (sh.st === 'moor') {
      if (!S.B[sh.at]) { sh.gone = 1; continue; }
      if (DYN.t > sh.until) departShip(sh);
      continue;
    }
    const n = sh.path.length, spd = { sail: .45, steamer: .6, freighter: .75, boxship: .8, hover: 1.4 }[sh.kind] || .6;
    // wait offshore if someone else is at the quay
    const dest = sh.to && S.B[sh.to];
    const dk = dest && bkey(dest, sh.tbk);
    if (dest && sh.s > n - 5 && DYN.slot[dk] && DYN.slot[dk] !== sh) { sh.wait = 1; continue; }
    sh.wait = 0;
    sh.s += dt * spd * (sh.s > n - 3 && dest ? .55 : 1);
    if (dest && sh.s > n - 4) DYN.slot[dk] = sh;
    if (sh.s >= n - 1) {
      if (dest) { sh.st = 'moor'; sh.at = dest.id; sh.bk = sh.tbk || 0; sh.until = DYN.t + rf(18, 40); sh.s = n - 1; sh.to = 0; sh.hx = -dest.dir[1]; sh.hy = dest.dir[0];
        if (!S.flags.firstShip && sh.from && S.B[sh.from]) { S.flags.firstShip = 1; const A = S.T[S.B[sh.from].sid], B = S.T[dest.sid]; if (A && B && A !== B) chron('⛵', `The first ship sails into ${B.name} from ${A.name}. Half the town is on the quay to watch her tie up.`, { x: dest.x, y: dest.y, k: 'major', cap: 'The first ship' }); }
      } else if (sh.s >= n + 3) sh.gone = 1; // sailed off over the horizon
    }
  }
  DYN.ships = DYN.ships.filter(sh => { if (sh.gone) { for (const k in DYN.slot) if (DYN.slot[k] === sh) DYN.slot[k] = null; } return !sh.gone; });
}
// [fx, fy, alpha, dirx, diry]
function shipPos(sh) {
  if (sh.st === 'moor') {
    const B = S.B[sh.at]; if (!B) return null;
    const i = berthTile(B, sh.bk); return [i % W - B.dir[0] * .18, ((i / W) | 0) - B.dir[1] * .18, 1, -B.dir[1], B.dir[0]];
  }
  const n = sh.path.length;
  if (sh.s < 0) { // coming in from past the edge
    const k = Math.max(0, Math.min(sh.pre.length - 1, Math.floor(sh.s + sh.pre.length))), f = sh.s + sh.pre.length - k;
    const a = sh.pre[k], b = sh.pre[k + 1] || { x: sh.path[0] % W, y: (sh.path[0] / W) | 0 };
    return [lerp(a.x, b.x, f), lerp(a.y, b.y, f), clamp((sh.s + 4) / 2.5, 0, 1), b.x - a.x, b.y - a.y];
  }
  if (sh.s >= n - 1) { // heading out past the edge
    const e = sh.path[n - 1], o = sh.off || [0, 0], f = sh.s - (n - 1);
    return [e % W + o[0] * f, ((e / W) | 0) + o[1] * f, clamp(1 - f / 3.5, 0, 1), o[0], o[1]];
  }
  const p = pathPos(sh, 0, false, false);
  return [p[0], p[1], 1, p[4], p[5]];
}


/* ---------- fishing boats: out in the morning, home at dusk ---------- */
function waterPath(a, b, maxN) { // plain BFS over open water
  if (a === b) return [a];
  const prev = new Map([[a, -1]]), q = [a];
  for (let h = 0; h < q.length && h < (maxN || 900); h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (prev.has(j) || M.water[j] !== 1 || M.road[j] || M.bld[j]) continue; prev.set(j, i); if (j === b) { const p = []; for (let k = b; k >= 0; k = prev.get(k)) p.push(k); return p.reverse(); } q.push(j); }
  }
  return null;
}
function syncBoats() {
  const docks = []; for (const k in S.B) { const B = S.B[k]; if (B.type === 'dock' && B.prog >= 1 && B.dir) { const j = idx(B.x + B.dir[0], B.y + B.dir[1]); if (inb(B.x + B.dir[0], B.y + B.dir[1]) && M.water[j] === 1) docks.push(B); } }
  DYN.boats = DYN.boats.filter(b => S.B[b.dock]);
  for (const B of docks.slice(0, 12)) if (!DYN.boats.some(b => b.dock === B.id)) {
    const j = idx(B.x + B.dir[0], B.y + B.dir[1]);
    DYN.boats.push({ dock: B.id, home: j, st: 'moor', until: DYN.t + rf(2, 30), path: null, s: 0, col: pick(CLOTH), hx: -B.dir[1], hy: B.dir[0], ph: rnd() * 6, id: rnd() });
  }
}
function stepBoats(dt) {
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, hr = sun.hr, fx = sun.fixed;
  const goOut = fx ? true : hr >= 5.5 && hr < 15.5, comeHome = !fx && (hr >= 16.5 || hr < 5);
  for (const b of DYN.boats) {
    b.ph += dt;
    if (b.st === 'moor') {
      if (DYN.t > b.until && goOut) {
        const hx = b.home % W, hy = (b.home / W) | 0;
        for (let k = 0; k < 10; k++) {
          const a = rnd() * TAU, d = rf(3, 9), gx = Math.round(hx + Math.cos(a) * d), gy = Math.round(hy + Math.sin(a) * d);
          if (!inb(gx, gy)) continue; const g = idx(gx, gy); if (M.water[g] !== 1 || !sameWater(g, b.home)) continue;
          const p = waterPath(b.home, g); if (p && p.length > 2) { b.path = p; b.s = 0; b.st = 'out'; break; }
        }
        if (b.st === 'moor') b.until = DYN.t + rf(10, 30);
      }
    } else if (b.st === 'out' || b.st === 'back') {
      b.s += dt * .38;
      if (b.s >= b.path.length - 1) {
        if (b.st === 'out') { b.st = 'fish'; b.until = DYN.t + (fx ? rf(50, 110) : rf(60, 200)); b.g = b.path[b.path.length - 1]; }
        else { b.st = 'moor'; b.until = DYN.t + (fx ? rf(20, 60) : rf(30, 90)); const B = S.B[b.dock]; if (B) { b.hx = -B.dir[1]; b.hy = B.dir[0]; } }
      }
    } else if (b.st === 'fish') {
      if ((fx && DYN.t > b.until) || comeHome || (!fx && DYN.t > b.until && hr >= 14)) { const p = waterPath(b.g, b.home); if (p) { b.path = p; b.s = 0; b.st = 'back'; } else { b.st = 'moor'; } }
      else if (DYN.t > b.until) b.until = DYN.t + rf(30, 80);
    }
  }
}
function boatPos(b) {
  if (b.st === 'moor') { const B = S.B[b.dock]; if (!B) return null; return [b.home % W - B.dir[0] * .22 + B.dir[1] * .12, ((b.home / W) | 0) - B.dir[1] * .22 + B.dir[0] * .12, 1, b.hx, b.hy, 0]; }
  if (b.st === 'fish') { const x = b.g % W, y = (b.g / W) | 0, a = b.ph * .12; return [x + Math.cos(a) * .18, y + Math.sin(a) * .18, 1, -Math.sin(a), Math.cos(a), 0]; }
  const p = pathPos(b, 0, false, false); return [p[0], p[1], 1, p[4], p[5], 1];
}

/* ---------- ferries: across the water where the way round is long ---------- */
const FERRY = { S: null, n: -1, at: new Map() };
function ferryLandings() {
  const fs = S.ferries || [];
  if (FERRY.S === S && FERRY.n === fs.length && FERRY.v === S.ferryV) return FERRY.at;
  FERRY.S = S; FERRY.n = fs.length; FERRY.v = S.ferryV; FERRY.at = new Map();
  for (const f of fs) { FERRY.at.set(f.a, [f.dir[0], f.dir[1]]); FERRY.at.set(f.b, [-f.dir[0], -f.dir[1]]); }
  return FERRY.at;
}
function planFerries(T) {
  if (!hasTech('boats') || T.pop < 40) return;
  const fs = S.ferries = S.ferries || [];
  // an old ferry retires once a bridge makes it pointless
  for (let k = fs.length - 1; k >= 0; k--) {
    const f = fs[k]; if (f.tid !== T.id) continue;
    const walk = footSteps(f.a, f.b, 40);
    if (walk < 12) { fs.splice(k, 1); S.ferryV = (S.ferryV || 0) + 1; markDirty(f.a); markDirty(f.b); if (chance(.5)) chron('⛴️', `The old ferry at ${T.name} makes its last crossing. There's a bridge now, and nobody needs the boatman.`, { x: f.a % W, y: (f.a / W) | 0 }); }
  }
  if (fs.some(f => f.tid === T.id) || fs.length >= 8 || S.year - (T.lastFerry || -99) < 10) return;
  T.lastFerry = S.year;
  const R = Math.ceil(townRadius(T) + 4); let best = null, bs = -1e9;
  for (let y = Math.max(1, T.y - R); y <= Math.min(H - 2, T.y + R); y++) for (let x = Math.max(1, T.x - R); x <= Math.min(W - 2, T.x + R); x++) {
    const a = idx(x, y); if (M.water[a] || M.ruin[a] || (M.bld[a] && !isRoadAnchor(a))) continue;
    if (!(M.road[a] || fronts(x, y))) continue;
    for (const [dx, dy] of N4) {
      let k = 1, ok = true;
      for (; k <= 8; k++) { const nx = x + dx * k, ny = y + dy * k; if (!inb(nx, ny)) { ok = false; break; } const j = idx(nx, ny); if (!M.water[j]) break; if (M.road[j]) { ok = false; break; } }
      if (!ok || k === 1 || k > 8) continue;
      const bx = x + dx * k, by = y + dy * k, b = idx(bx, by);
      if (M.bld[b] || M.ruin[b] || Math.abs(M.elev[a] - M.elev[b]) > 3 || fs.some(f => dist(f.a % W, (f.a / W) | 0, x, y) < 5)) continue;
      const s = -k * 1.2 - dist(x, y, T.x, T.y) * .4 + (M.road[b] ? 2 : 0) + rnd();
      if (s <= bs) continue;
      if (footSteps(a, b, 36) < 18) continue; // it's quicker to walk
      bs = s; best = { a, b, dir: [dx, dy], len: k - 1 };
    }
  }
  if (!best) return;
  const t = laySurf();
  for (const j of [best.a, best.b]) { if (!M.road[j] && !M.bld[j]) { M.road[j] = t; M.tree[j] = 0; M.plan[j] = 1; markDirty(j); } }
  roadLink(best.b, [best.a, best.b]);
  fs.push({ a: best.a, b: best.b, dir: best.dir, len: best.len, tid: T.id, yr: yr() }); S.ferryV = (S.ferryV || 0) + 1;
  const river = M.water[idx(best.a % W + best.dir[0], ((best.a / W) | 0) + best.dir[1])] === 2, nm = river ? 'the river' : 'the water';
  if (!S.flags.firstFerry) { S.flags.firstFerry = 1; chron('⛴️', `A ferry starts running across ${nm} at ${T.name}. A penny a crossing, dogs go free.`, { x: best.a % W, y: (best.a / W) | 0, k: 'major', cap: 'The first ferry' }); }
  else if (chance(.4)) chron('⛴️', `${T.name} puts a ferry across ${nm}.`, { x: best.a % W, y: (best.a / W) | 0 });
}
function stepFerries(dt) {
  const fs = S.ferries || [];
  DYN.ferries = DYN.ferries.filter(o => fs.includes(o.f));
  for (const f of fs) if (!DYN.ferries.some(o => o.f === f)) DYN.ferries.push({ f, t: 0, dirn: 1, wait: rf(2, 10), ph: rnd() * 6 });
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, night = !sun.fixed && (sun.hr >= 22.5 || sun.hr < 5.5);
  for (const o of DYN.ferries) {
    o.ph += dt;
    if (o.wait > 0) { o.wait -= dt; if (night && o.t === 0) o.wait = Math.max(o.wait, 5); continue; }
    o.t += dt * .28 / Math.max(1, o.f.len + .6) * o.dirn;
    if (o.t >= 1 || o.t <= 0) { o.t = clamp(o.t, 0, 1); o.dirn *= -1; o.wait = rf(8, 16); }
  }
}
function ferryPos(o) {
  const f = o.f, ax = f.a % W, ay = (f.a / W) | 0, s = .74, e = f.len + .26, d = lerp(s, Math.max(s + .2, e), smooth(o.t));
  return [ax + f.dir[0] * d, ay + f.dir[1] * d, f.dir[0], f.dir[1], o.wait <= 0];
}
