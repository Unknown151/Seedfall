/* ============================== simulation ============================== */
let S = null;
let FAST = false;        // true while fast-forwarding (skip visual fx)
const FXQ = [];          // visual effects requested by the sim
function fx(k, d = {}) { if (!FAST) FXQ.push(Object.assign({ k }, d)); }
const hasTech = id => !!(S && S.tech.done[id]);
const towns = () => Object.values(S.T);
const totalPop = () => { let p = 0; for (const k in S.T) p += S.T[k].pop; return p; };
const yr = () => Math.floor(S.year);

/* ---------- people ---------- */
function lifeExp() { return 66 + (hasTech('medicine') ? 14 : 0) + (hasTech('genegarden') ? 16 : 0) + (hasTech('arcology') ? 24 : 0) + ri(-8, 14); }
function addPerson(role, sid, age = 0, o = {}) {
  const par = o.parents || [];
  const first = firstNm(S.lang), last = par.length ? pick(par).last : lastNm(S.lang);
  const p = { id: S.nextP++, name: first + ' ' + last, first, last, born: S.year - age, life: lifeExp(), died: null, sid, role, deeds: [] };
  S.P[p.id] = p;
  if (par.length) p.st = rollStats(role, par);
  ensurePerson(p);
  if (par.length) {
    p.par = par.map(q => q.id); for (const q of par) q.kids.push(p.id);
    const fls = par.map(q => q.fl).filter(v => v != null); if (fls.length) p.fl = Math.min(...fls) + 1;
  }
  UIDIRTY.people = true;
  return p;
}
function whoOf(p, T) {
  let s = p.name + (T ? ' of ' + T.name : '');
  const m = p.men && S.P[p.men];
  if (m && chance(.45)) s += `, once apprentice to ${m.name},`;
  else if (p.fl != null && p.fl > 0 && p.fl <= 4 && chance(.6)) s += `, ${lineageLabel(p).toLowerCase()},`;
  else if (p.role === 'leader' && T && T.leader === p.id && chance(.5)) s += `, ${titleFor()} of the town,`;
  return s;
}
function person(id) { return S.P[id]; }
function living() { return Object.values(S.P).filter(p => p.died === null); }
function titleFor() { return S.era <= 2 ? 'elder' : S.era <= 4 ? 'speaker' : S.era <= 7 ? 'mayor' : 'steward'; }

/* ---------- chronicle ---------- */
function chron(ic, t, o = {}) {
  const e = { n: ++S.chronN, yr: yr(), ic, t, k: o.k || '' };
  if (o.T) { e.tx = o.T.x; e.ty = o.T.y; }
  if (o.x != null) { e.tx = o.x; e.ty = o.y; }
  S.chron.push(e);
  if (S.chron.length > 3000) S.chron.splice(0, S.chron.length - 3000);
  if (e.tx != null && !o.nocap) fx('caption', { x: e.tx, y: e.ty, ic, t: o.cap || shortCap(t), major: e.k === 'major' || e.k === 'era' });
  UIDIRTY.chron = true;
  return e;
}
function shortCap(t) { const s = t.split(/[.:;!]/)[0]; return s.length > 58 ? s.slice(0, 55) + '…' : s; }

/* ---------- new world ---------- */
function newState(seed) {
  const g = genWorld(seed);
  S = {
    v: 1, seed, created: Date.now(), savedAt: 0, playSec: 0,
    year: 0, month: 0, map: g.M, B: {}, nextB: 1, T: {}, nextT: 1, P: {}, nextP: 1,
    tech: { done: {}, cur: 0, pts: 0 }, era: 0, age: null, ageN: 0, ageUsed: {},
    styles: [Object.assign({}, STYLES0[0])], styleIdx: 0,
    lang: JSON.parse(JSON.stringify(LANG0)),
    chron: [], chronN: 0, mdWritten: 0, rows: [], rowN: 0, csvWritten: 0, hist: [],
    lore: 0, omens: 0, flags: { intro: 1 }, cool: {}, vault: 30, drought: 0, boost: 0,
    roads: [], rails: [], roadQ: [], landing: g.land, ruins: g.ruins, planet: null, moons: null,
    sky: { sats: 0, station: 0, ring: 0, elevator: 0 }, firsts: {}, wondersUsed: [], lastFound: 0, lastLaunch: 0, lastSeedship: 0,
    settings: { pace: 'normal', captions: true, sky: 'hour', weather: true, shadows: true }, rev: 30, prayers: []
  };
  M = S.map;
  CULT = { tb: {}, bld: {}, ev: {}, lv: {}, shun: {}, rs: 0, bs: 0 };
  const L = g.land;
  const f = addPerson('founder', 1, 29);
  f.life = 84 + ri(0, 8);
  S.founder = f.id; f.fl = 0; f.st = rollStats('founder'); f.st.kin = Math.max(f.st.kin, 7);
  const T = { id: S.nextT++, name: 'the Landing', x: L.x, y: L.y, founded: 0, pop: 1, cap: { house: 2, food: 6 }, bl: [], crop: ri(0, CROPS.length - 1), leader: f.id, founder: f.id, linked: true, color: '#e5874f', lastElect: 0 };
  S.T[T.id] = T;
  const pod = mkBuilding('pod', L.x, L.y, T, { prog: 1, style: 0 });
  pod.var = .5;
  return S;
}

function introChronicle() {
  const f = person(S.founder);
  chron('☄️', 'A seed pod falls through the sky of an unnamed world and ploughs into the bluegrass.', { k: 'major', x: S.landing.x, y: S.landing.y, cap: 'Landfall' });
  chron('🌱', `${f.name} climbs out, alone. Behind them the vault hums: thirty sleeping children, and an Archive of everything Earth knew.`, { k: 'major' });
}

/* ---------- buildings ---------- */
function mkBuilding(type, x, y, T, o = {}) {
  const i = idx(x, y);
  const B = {
    id: S.nextB++, type, x, y, sid: T ? T.id : 0, tier: o.tier || 0, up: null, prog: o.prog != null ? o.prog : 0,
    style: o.style != null ? o.style : S.styleIdx, var: rnd(), built: yr()
  };
  if (o.sub) B.sub = o.sub; if (o.name) B.name = o.name; if (o.dir) B.dir = o.dir;
  if (type === 'launchpad') B.rk = 1;
  S.B[B.id] = B; M.bld[i] = B.id; M.tree[i] = 0; M.wild[i] = 0; CNT_M = -1;
  if (M.road[i]) M.road[i] = 0;
  M.plan[i] = 0;
  if (T) { T.bl.push(B.id); econNewBuilding(B, T); }
  markDirty(i);
  if ((type === 'dock' || type === 'harbor') && B.dir) { const j = idx(x + B.dir[0], y + B.dir[1]); markDirty(j); }
  return B;
}
function removeBuilding(B) {
  const i = idx(B.x, B.y);
  M.bld[i] = 0; delete S.B[B.id]; CNT_M = -1;
  const T = S.T[B.sid]; if (T) { const k = T.bl.indexOf(B.id); if (k >= 0) T.bl.splice(k, 1); econDirty(T); }
  markDirty(i);
}
function workFor(B) { return B.type === 'house' ? HT[B.up != null ? B.up : B.tier].work : (BT[B.type] ? BT[B.type].work : 10); }
function bcount(T, type) { let n = 0; for (const id of T.bl) { const B = S.B[id]; if (B && B.type === type) n++; } return n; }
let CNT = {}, CNT_ALL = {}, CNT_M = -1;
function refreshCounts() { if (CNT_M === S.month) return; CNT_M = S.month; CNT = {}; CNT_ALL = {}; for (const k in S.B) { const B = S.B[k]; CNT_ALL[B.type] = (CNT_ALL[B.type] || 0) + 1; if (B.prog >= 1) CNT[B.type] = (CNT[B.type] || 0) + 1; } }
function wcount(type) { refreshCounts(); return CNT[type] || 0; }
function anycount(type) { refreshCounts(); return CNT_ALL[type] || 0; }

function farmYield() {
  const n = Object.keys(S.tech.done).length + (S.ageN || 0);
  return 5 + n * 0.5 + (hasTech('sunroot') ? 2 : 0) + (hasTech('chem') ? 4 : 0) + (hasTech('genegarden') ? 6 : 0) + (hasTech('climate') ? 3 : 0);
}
function recalcTown(T) {
  let house = 0, food = 3, fy = farmYield() * (S.drought > 0 ? 0.8 : 1);
  for (const id of T.bl) {
    const B = S.B[id]; if (!B) continue;
    if (B.type === 'pod') { house += 3; food += 8; continue; }
    if (B.prog < 1) continue;
    if (B.type === 'house') house += HT[B.tier].cap;
    else if (B.type === 'farm') food += fy;
    else if (B.type === 'dock') food += 8 + Object.keys(S.tech.done).length * 0.45;
    else if (B.type === 'vfarm') food += 900 + (S.ageN || 0) * 30;
    else if (B.type === 'granary') food += 6;
    else if (B.type === 'dome') food += 60;
  }
  T.cap = { house, food: Math.round(food) };
}

/* ---------- geometry helpers ---------- */
function townRadius(T) { const g = lever('growth'), m = g === 'spread_out' ? 1.3 : g === 'compact' ? .82 : 1; return clamp((2.2 + Math.sqrt(T.pop) * 0.4) * m, 2.6, 13 * m); } // (lanes take a little more room than the old grid did)
function ownerOf(x, y) {
  let best = null, bd = 1e9;
  for (const k in S.T) { const T = S.T[k]; const d = dist(x, y, T.x, T.y); if (d < bd) { bd = d; best = T; } }
  return best;
}
const OWN = new Int16Array(W * H); let OWN_M = -1, OWN_N = -1;
function refreshOwn() {
  const ts = towns();
  if (OWN_M === S.month && OWN_N === ts.length) return;
  OWN_M = S.month; OWN_N = ts.length;
  const rs = ts.map(T => townRadius(T) + 8);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let best = 0, bd = 1e9;
    for (let k = 0; k < ts.length; k++) { const T = ts[k]; const d = (x - T.x) * (x - T.x) + (y - T.y) * (y - T.y); if (d < bd && d <= rs[k] * rs[k]) { bd = d; best = T.id; } }
    OWN[y * W + x] = best;
  }
}
function slopeOK(x, y, lim = 1) {
  const e = M.elev[idx(x, y)];
  for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.water[j] === 0 && Math.abs(M.elev[j] - e) > lim) return false; }
  return true;
}
function adjCount(x, y, fn) { let n = 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && fn(idx(nx, ny))) n++; } return n; }
function nearWaterDir(x, y) {
  const order = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  for (const [dx, dy] of order) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && M.water[idx(nx, ny)] === 1) return [dx, dy]; }
  return null;
}

function findSite(T, kind, extra = 0) {
  const R = townRadius(T);
  const Rx = (kind === 'farm' ? R + 4 : kind === 'ore' ? R + 5 : kind === 'shore' || kind === 'harbor' ? R + 3 : kind === 'wild' ? R + 7 : kind === 'forest' || kind === 'rock' || kind === 'clay' || kind === 'point' ? R + 6 : R + 1) + extra;
  const outer = kind === 'ore' || kind === 'shore' || kind === 'forest' || kind === 'rock' || kind === 'clay' || kind === 'harbor' || kind === 'point', high = kind === 'ore' || kind === 'rock';
  const front = kind === 'house' || kind === 'center' || kind === 'mid' || kind === 'edge'; // must face a street
  let best = null, bs = -1e9;
  const x0 = Math.max(0, Math.floor(T.x - Rx)), x1 = Math.min(W - 1, Math.ceil(T.x + Rx));
  const y0 = Math.max(0, Math.floor(T.y - Rx)), y1 = Math.min(H - 1, Math.ceil(T.y + Rx));
  refreshOwn();
  const fk = kind + extra; T._fail = T._fail || {};
  if (T._fail[fk] > S.month) return null;
  const allowFarmReplace = (kind === 'house' || kind === 'backlot') && S.era >= 2, farmR = R * (S.era >= 3 ? .95 : .8), NAT = lever('nature');
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const d = dist(x, y, T.x, T.y); if (d > Rx) continue;
    const i = idx(x, y);
    if (M.water[i] || M.ruin[i] || M.road[i] || M.rail[i] || M.plan[i]) continue;
    const b = M.bio[i];
    if (b === BIO.SNOW) continue;
    let replaceFarm = false;
    if (M.bld[i]) {
      const B = S.B[M.bld[i]];
      if (allowFarmReplace && B && B.type === 'farm' && B.sid === T.id && d < farmR && B.prog >= 1) replaceFarm = true; else continue; // the town grows over its old fields
    }
    if (OWN[i] !== T.id) continue;
    if (front && !fronts(x, y)) continue;
    if (kind === 'backlot' && !adjCount(x, y, j => !M.water[j] && !M.bld[j] && !M.ruin[j] && !M.plan[j] && fronts(j % W, (j / W) | 0))) continue; // one step from a street: an alley
    if (!high && M.elev[i] > 7) continue;
    if (!slopeOK(x, y, kind === 'farm' ? 1 : 2)) continue;
    let tree = M.tree[i] ? 1 : 0;
    if (tree && NAT === 'protect' && !high) tree = 8; else if (NAT === 'clear') tree = 0;
    const adjRoad = adjCount(x, y, j => (M.road[j] > 0 && !M.water[j]) || (M.bld[j] && isRoadAnchor(j))), adjPlan = adjCount(x, y, j => M.plan[j] === 1 && !M.road[j]);
    const adjB = adjCount(x, y, j => M.bld[j] > 0 && S.B[M.bld[j]] && S.B[M.bld[j]].type !== 'farm');
    let s = rnd() * 0.8;
    switch (kind) {
      case 'house': case 'backlot': s += -d * 1.1 + adjRoad * 1.6 + adjPlan * .9 + adjB * 0.5 - tree * 0.7 - (replaceFarm ? 1.4 : 0) - (kind === 'backlot' ? 2 : 0); break;
      case 'center': s += -d * 2 + adjRoad * 1.5 - tree; break;
      case 'mid': s += -Math.abs(d - R * 0.5) * 1.2 + adjRoad - tree * .5; break;
      case 'edge': s += -Math.abs(d - R) * 1.2 + adjRoad * .5 - tree * .5; break;
      case 'flatedge': { let fl = 0; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && M.elev[idx(nx, ny)] === M.elev[i] && !M.water[idx(nx, ny)]) fl++; } if (fl < 7) continue; s += -Math.abs(d - R) - tree; break; }
      case 'high': s += M.elev[i] * 1.6 - d * 0.5 - tree * .5; break;
      case 'farm': {
        if (d < 1.5) continue;
        const adjF = adjCount(x, y, j => M.bld[j] && S.B[M.bld[j]] && S.B[M.bld[j]].type === 'farm');
        s += M.fert[i] * 1.4 - Math.abs(d - Math.max(2.5, R * 0.85)) * 0.4 + adjF * 0.9 - tree * 1.1 - adjB * 0.4 - (b === BIO.ROCK ? 4 : 0) - (b === BIO.BARREN && !hasTech('climate') ? 2 : 0);
        break;
      }
      case 'shore': { if (!nearWaterDir(x, y)) continue; s += -d * 0.8 + adjRoad; break; }
      case 'harbor': { if (!harbourSite(x, y)) continue; s += -d * .6 + adjRoad * 1.2 + waterNear(x, y, 2) * .15; break; }
      case 'point': { const n = adjCount(x, y, j => bigWater(j)) + (inb(x + 1, y + 1) && bigWater(idx(x + 1, y + 1)) ? 1 : 0) + (inb(x - 1, y - 1) && bigWater(idx(x - 1, y - 1)) ? 1 : 0) + (inb(x + 1, y - 1) && bigWater(idx(x + 1, y - 1)) ? 1 : 0) + (inb(x - 1, y + 1) && bigWater(idx(x - 1, y + 1)) ? 1 : 0); if (n < 4) continue; s += n * 1.2 + waterNear(x, y, 3) * .1 - d * .2 - tree; break; }
      case 'ore': { if (!(M.ore[i] || b === BIO.ROCK)) continue; s += -d * 0.6 + M.ore[i] * 3 + around(x, y, 1, j => M.ore[j]) * .8; break; }
      case 'forest': { if (tree) continue; const n = around(x, y, 2, j => M.bld[j] ? 0 : M.tree[j]); if (n < 5) continue; s += n * .5 - d * .35 + adjRoad * .4; break; }
      case 'rock': { const n = around(x, y, 1, j => rocky(j) ? 1 : 0); if (!rocky(i) && n < 3) continue; s += n * .9 - d * .45 - tree; break; }
      case 'clay': { if (!clayey(i)) continue; s += around(x, y, 1, j => clayey(j) ? 1 : 0) * .6 - d * .5 - tree + (b === BIO.SAND ? 1 : 0); break; }
      case 'barren': { s += (b === BIO.BARREN || b === BIO.ROCK || b === BIO.HIGH ? 4 : 0) - Math.abs(d - R) * 0.5; break; }
      default: s += -d;
    }
    if (replaceFarm && kind !== 'house' && kind !== 'backlot') continue;
    if (s > bs) { bs = s; best = { x, y, replaceFarm }; }
  }
  if (!best) T._fail[fk] = S.month + 4 + ri(0, 4);
  return best;
}

/* ---------- roads ---------- */
function roadTier() { return hasTech('hover') ? 5 : hasTech('motor') ? 4 : hasTech('masonry') ? 3 : hasTech('wheel') ? 2 : 1; }
function upgradeRoads() { const t = roadTier(); for (let i = 0; i < W * H; i++) if (M.road[i] && M.road[i] !== t) { M.road[i] = t; markDirty(i); } }
function astar(a, b, costFn) {
  const g = new Float32Array(W * H).fill(1e9), prev = new Int32Array(W * H).fill(-1), closed = new Uint8Array(W * H);
  const bx = b % W, by = (b / W) | 0;
  const heap = []; // [f, i]
  const push = (f, i) => { heap.push([f, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  g[a] = 0; push(0, a);
  let it = 0;
  while (heap.length && it++ < 20000) {
    const [, i] = pop(); if (closed[i]) continue; closed[i] = 1;
    if (i === b) break;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
      if (closed[j]) continue;
      const c = j === b ? 1 : costFn(i, j); if (c >= 1e8) continue;
      const ng = g[i] + c;
      if (ng < g[j]) { g[j] = ng; prev[j] = i; push(ng + Math.abs(nx - bx) + Math.abs(ny - by), j); }
    }
  }
  if (prev[b] < 0) return null;
  const path = []; for (let i = b; i >= 0; i = prev[i]) path.push(i);
  return path.reverse();
}
function roadCost(i, j) {
  if (M.bld[j]) return isRoadAnchor(j) ? 1 : 1e9;
  if (M.ruin[j]) return 1e9;
  if (M.water[j] === 1) return 1e9;
  if (M.water[j] === 2) return M.road[j] ? .5 : hasTech('bridges') ? 7 : 10; // footbridges before stone arches
  const de = Math.abs(M.elev[j] - M.elev[i]);
  if (de > 1 && M.water[i] === 0) return 1e9;
  return (M.road[j] ? 0.35 : 1.2) + de * 1.5 + (M.tree[j] ? 0.8 : 0) + (M.rail[j] ? 1 : 0);
}
function railCost(i, j) {
  if (M.bld[j]) { const B = S.B[M.bld[j]]; return B && B.type === 'station' ? 1 : 1e9; }
  if (M.ruin[j] || M.water[j] === 1) return 1e9;
  if (M.water[j] === 2) return 6;
  const de = Math.abs(M.elev[j] - M.elev[i]);
  if (de > 1) return 1e9;
  return (M.rail[j] ? 0.3 : 1.3) + de * 2 + (M.road[j] ? 0.6 : 0);
}
function planIntertownRoads() {
  if (!hasTech('wheel')) return;
  const linked = towns().filter(T => T.linked), un = towns().filter(T => !T.linked && S.year - T.founded > 3);
  if (!un.length || S.roadQ.length) return;
  const T = un[0];
  let best = null, bd = 1e9; for (const L of linked) { const d = dist(T.x, T.y, L.x, L.y); if (d < bd) { bd = d; best = L; } }
  if (!best) return;
  const path = astar(idx(T.x, T.y), idx(best.x, best.y), roadCost);
  if (!path) { T.linked = true; return; } // unreachable: give up quietly
  S.roadQ.push({ a: T.id, b: best.id, path, k: 0 });
}
function stepRoadQ() {
  const q = S.roadQ[0]; if (!q) return;
  const t = roadTier();
  for (let n = 0; n < 3 && q.k < q.path.length; n++, q.k++) {
    const i = q.path[q.k]; if (M.bld[i]) continue;
    if (M.road[i] < t) { M.road[i] = t; M.tree[i] = 0; M.wild[i] = 0; markDirty(i); }
  }
  if (q.k >= q.path.length) {
    S.roadQ.shift();
    const A = S.T[q.a], B = S.T[q.b]; if (!A || !B) return;
    A.linked = true;
    S.roads.push({ a: q.a, b: q.b, path: q.path });
    const bridge = q.path.some(i => M.water[i] === 2);
    chron('🛤️', `The road from ${A.name} to ${B.name} is finished${bridge ? ', stone arches and all' : ''}.`, { T: A });
  }
}
function planRails() {
  if (!hasTech('rail')) return;
  const st = towns().filter(T => T.bl.some(id => S.B[id] && S.B[id].type === 'station' && S.B[id].prog >= 1));
  if (st.length < 2) return;
  const has = (a, b) => S.rails.some(r => (r.a === a && r.b === b) || (r.a === b && r.b === a));
  for (const T of st) {
    if (S.rails.some(r => r.a === T.id || r.b === T.id) && chance(0.7)) continue;
    let best = null, bd = 1e9;
    for (const O of st) { if (O === T || has(T.id, O.id)) continue; const d = dist(T.x, T.y, O.x, O.y); if (d < bd) { bd = d; best = O; } }
    if (!best) continue;
    const sa = T.bl.map(id => S.B[id]).find(B => B && B.type === 'station'), sb = best.bl.map(id => S.B[id]).find(B => B && B.type === 'station');
    const path = astar(idx(sa.x, sa.y), idx(sb.x, sb.y), railCost);
    if (!path) { S.rails.push({ a: T.id, b: best.id, path: null }); continue; }
    for (const i of path) { if (M.bld[i]) continue; M.rail[i] = 1; M.tree[i] = 0; M.wild[i] = 0; markDirty(i); }
    S.rails.push({ a: T.id, b: best.id, path });
    const first = S.rails.filter(r => r.path).length === 1;
    chron('🚂', first ? `The first train runs from ${T.name} to ${best.name}. Half the valley turns out to wave at it.` : `The railway reaches ${T.name} from ${best.name}.`, { T, k: first ? 'major' : '' });
    return;
  }
}

/* ---------- bridges: towns that straddle a river join their two halves ---------- */
function footSteps(a, b, lim) { // walking distance between two land tiles, using existing bridges (99 = too far)
  const seen = new Map([[a, 0]]); let q = [a];
  for (let d = 1; d <= lim && q.length; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
        if (seen.has(j)) continue;
        if (M.water[j] && !M.road[j]) continue;
        if (M.bld[j] && !M.road[j] && !isRoadAnchor(j) && j !== b) { const B = S.B[M.bld[j]]; if (!B || !OUTDOOR[B.type]) continue; }
        if (!M.water[j] && !M.water[i] && Math.abs(M.elev[j] - M.elev[i]) > 1 && !M.road[j] && !M.road[i]) continue;
        if (j === b) return d;
        seen.set(j, d); nq.push(j);
      }
    }
    q = nq;
  }
  return 99;
}
function planBridges(T) {
  if (T.pop < 18 || S.year - (T.lastBridge || -99) < 3) return;
  const R = Math.ceil(townRadius(T) + 2), bl = T.bl.map(id => S.B[id]).filter(Boolean);
  const nearBld = i => { const x = i % W, y = (i / W) | 0; return bl.some(B => Math.abs(B.x - x) + Math.abs(B.y - y) <= 4); };
  const cands = [];
  for (let y = Math.max(1, T.y - R); y <= Math.min(H - 2, T.y + R); y++) for (let x = Math.max(1, T.x - R); x <= Math.min(W - 2, T.x + R); x++) {
    const i = idx(x, y); if (M.water[i] !== 2 || M.road[i] || M.bld[i]) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const a = idx(x - dx, y - dy), b = idx(x + dx, y + dy);
      if (M.water[a] || M.water[b] || M.ruin[a] || M.ruin[b]) continue;
      if ((M.bld[a] && !M.road[a] && !isRoadAnchor(a)) || (M.bld[b] && !M.road[b] && !isRoadAnchor(b))) continue;
      if (Math.abs(M.elev[a] - M.elev[b]) > 1 || !nearBld(a) || !nearBld(b)) continue;
      let crowd = false;
      for (let ey = -5; ey <= 5 && !crowd; ey++) for (let ex = -5; ex <= 5; ex++) { const nx = x + ex, ny = y + ey; if (inb(nx, ny) && M.water[idx(nx, ny)] === 2 && M.road[idx(nx, ny)]) { crowd = true; break; } }
      if (crowd) continue;
      cands.push({ i, a, b, d: dist(x, y, T.x, T.y) + rnd() * .5 });
    }
  }
  cands.sort((p, q) => p.d - q.d);
  let best = null, bs = -1e9;
  for (const c of cands.slice(0, 14)) { // is it a long way round without a bridge here?
    const walk = footSteps(c.a, c.b, 30); if (walk < 12) continue;
    const s = Math.min(walk, 30) * .3 - c.d + (M.road[c.a] ? 1 : 0) + (M.road[c.b] ? 1 : 0);
    if (s > bs) { bs = s; best = c; }
  }
  if (!best) return;
  const t = roadTier();
  for (const j of [best.a, best.i, best.b]) { if (!M.road[j] && !M.bld[j]) { M.road[j] = t; M.tree[j] = 0; M.wild[j] = 0; markDirty(j); } }
  if (M.water[best.i] && !M.road[best.i]) { M.road[best.i] = t; markDirty(best.i); }
  for (const j of [best.a, best.b]) roadLink(j, [best.i, best.a, best.b]);
  T.lastBridge = S.year; S.bridges = (S.bridges || 0) + 1;
  const bx = best.i % W, by = (best.i / W) | 0;
  if (S.bridges === 1) chron('🌉', `${T.name} lays a plank bridge across the river. Nobody has to wade to the fields any more.`, { x: bx, y: by, k: 'major', cap: 'The first bridge' });
  else if (chance(.35)) chron('🌉', `${T.name} builds ${hasTech('bridges') ? 'a stone bridge' : 'another footbridge'} over the river.`, { x: bx, y: by });
}
// lay a short road from tile s to the nearest existing road
function roadLink(s, skip) {
  const prev = new Map([[s, -1]]); let q = [s], found = -1;
  for (let d = 0; d < 10 && q.length && found < 0; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
        if (prev.has(j) || skip.includes(j)) continue;
        if ((M.road[j] && !M.water[j]) || (M.bld[j] && isRoadAnchor(j))) { prev.set(j, i); found = j; break; }
        if (M.water[j] || M.bld[j] || M.ruin[j] || Math.abs(M.elev[j] - M.elev[i]) > 1) continue;
        prev.set(j, i); nq.push(j);
      }
      if (found >= 0) break;
    }
    q = nq;
  }
  if (found < 0) return;
  const t = roadTier();
  for (let i = prev.get(found); i !== s && i >= 0; i = prev.get(i)) if (!M.road[i]) { M.road[i] = t; M.tree[i] = 0; M.wild[i] = 0; markDirty(i); }
}

/* ---------- town growth ---------- */
function maxHouseTier() { let t = 0; for (let k = 0; k < HT.length; k++) if (!HT[k].tech || hasTech(HT[k].tech)) t = k; return t; }
function tierAllowed(T, d, R, relaxed) {
  let t = maxHouseTier();
  const g = lever('growth'), gm = g === 'taller' ? 2.5 : g === 'compact' ? 1.5 : g === 'stay_small' ? .6 : 1, gr = g === 'taller' ? 1.5 : g === 'compact' ? 1.2 : 1;
  const p = (relaxed ? T.pop * 3 : T.pop) * gm;
  R *= gr;
  if (p < 40) t = Math.min(t, 2);
  if (p < 250) t = Math.min(t, 3);
  if (relaxed) { if (t >= 5 && d > R * 0.9) t = 4; if (t >= 6 && (p < 1800 || d > R * 0.6)) t = 5; if (t >= 7 && (p < 4500 || d > R * 0.4)) t = 6; return t; }
  if (t >= 5 && (p < 700 || d > R * 0.78)) t = 4;
  if (t >= 6 && (p < 1800 || d > R * 0.45)) t = 5;
  if (t >= 7 && (p < 4500 || d > R * 0.28)) t = 6;
  return t;
}
function tryUpgrade(T, relaxed) {
  const R = townRadius(T);
  let cand = null, cs = -1e9;
  for (const id of T.bl) {
    const B = S.B[id]; if (!B || B.type !== 'house' || B.prog < 1 || B.up != null) continue;
    const d = dist(B.x, B.y, T.x, T.y);
    if (B.tier >= tierAllowed(T, d, R, relaxed)) continue;
    const s = -B.tier * 3 - d + rnd() * 2;
    if (s > cs) { cs = s; cand = B; }
  }
  if (!cand) return false;
  cand.up = cand.tier + 1; cand.prog = 0; econUpgrade(cand, T); markDirty(idx(cand.x, cand.y));
  return true;
}
function tryHousing(T) {
  const lowTierExists = T.bl.some(id => { const B = S.B[id]; return B && B.type === 'house' && B.tier < maxHouseTier() - 1; });
  if (lowTierExists && bcount(T, 'house') > 5 && chance(0.55) && tryUpgrade(T)) return true;
  let s = findSite(T, 'house') || findSite(T, 'house', 3);
  if (!s && growStreets(T)) s = findSite(T, 'house');
  if (!s) { s = findSite(T, 'backlot'); if (s) DBG.back++; } // squeezed in behind, with a track to the lane
  if (!s && !bcount(T, 'house')) s = anyPlot(T); // a town with nowhere at all to live takes whatever it can
  if (s) {
    if (s.replaceFarm) removeBuilding(S.B[M.bld[idx(s.x, s.y)]]);
    const B = mkBuilding('house', s.x, s.y, T, { tier: Math.min(4, tierAllowed(T, dist(s.x, s.y, T.x, T.y), townRadius(T))) });
    connectRoad(B); return true;
  }
  return tryUpgrade(T, true);
}
function tryFood(T) {
  if (hasTech('genegarden') && T.pop > 1500 && chance(0.5)) {
    const s = findSite(T, 'mid'); if (s) { const B = mkBuilding('vfarm', s.x, s.y, T); connectRoad(B); return true; }
  }
  if (hasTech('genegarden')) {
    const fs = T.bl.map(id => S.B[id]).filter(B => B && B.type === 'farm' && B.prog >= 1);
    if (fs.length) { const F = fs.sort((a, b) => dist(a.x, a.y, T.x, T.y) - dist(b.x, b.y, T.x, T.y))[0]; const x = F.x, y = F.y; removeBuilding(F); mkBuilding('vfarm', x, y, T); return true; }
  }
  const s = findSite(T, 'farm') || findSite(T, 'farm', 3);
  if (s) { mkBuilding('farm', s.x, s.y, T); return true; }
  if (hasTech('boats') && bcount(T, 'dock') < 5) { const d = findSite(T, 'shore'); if (d) { const B = mkBuilding('dock', d.x, d.y, T, { dir: nearWaterDir(d.x, d.y) }); connectRoad(B); return true; } }
  return false;
}
function tryService(T) {
  const theme = S.age ? AGE_THEMES.find(a => a.k === S.age.k) : null;
  const list = shuffle(SERV.slice());
  for (const sv of list) {
    if (!hasTech(sv.tech) || T.pop < sv.min) continue;
    if (CULT.shun && (CULT.shun[sv.t] || 0) >= .3) continue;
    const have = bcount(T, sv.t);
    let want = sv.per ? Math.min(sv.max, 1 + Math.floor((T.pop - sv.min) / sv.per)) : 1;
    if (theme && theme.w && theme.w[sv.t]) want = Math.min(sv.max + 2, want + 1);
    if ((CULT.bld[sv.t] || 0) > .4) want = Math.min(sv.max + 2, want + 1);
    if (sv.t === 'park' && lever('nature') === 'gardens') want = Math.min(sv.max + 6, want + 3);
    if (sv.t === 'airfield' && wcount('airfield') >= Math.ceil(towns().length / 2)) continue;
    if (sv.t === 'lighthouse' && (!townHarbour(T) || anycount('lighthouse') >= 3)) continue;
    if (have >= want) continue;
    const s = findSite(T, sv.site === 'shore' ? 'shore' : sv.site === 'ore' ? 'ore' : sv.site);
    if (!s) continue;
    const B = mkBuilding(sv.t, s.x, s.y, T, sv.t === 'dock' ? { dir: nearWaterDir(s.x, s.y) } : sv.t === 'harbor' ? { dir: harbourSite(s.x, s.y) } : {});
    if (sv.t !== 'solar' && sv.t !== 'turbine') connectRoad(B);
    return true;
  }
  return false;
}
function placeProject(T, type, kinds, o = {}) {
  let s = null;
  for (const k of kinds) { s = findSite(T, k) || findSite(T, k, 3); if (s) break; }
  if (!s || s.replaceFarm) {
    const olds = T.bl.map(id => S.B[id]).filter(B => B && B.prog >= 1 && ((B.type === 'house' && B.tier <= 5) || B.type === 'farm'));
    if (!olds.length) return null;
    olds.sort((a, b) => (a.type === 'farm' ? -1 : 0) - (b.type === 'farm' ? -1 : 0) || a.tier - b.tier || a.built - b.built);
    const O = olds[0]; s = { x: O.x, y: O.y }; removeBuilding(O);
  }
  const B = mkBuilding(type, s.x, s.y, T, o);
  if (!FLAT_TYPES[type] && type !== 'terraformer') connectRoad(B);
  return B;
}
function worldProjects() {
  const big = towns().sort((a, b) => b.pop - a.pop);
  if (!big.length) return;
  const T = big[0];
  if (hasTech('rocketry') && !anycount('launchpad')) { placeProject(T, 'launchpad', ['flatedge', 'edge']); return; }
  if (hasTech('elevator') && !anycount('elevator')) { placeProject(T, 'elevator', ['edge', 'mid'], { name: 'the Thread' }); return; }
  if (S.omens >= 3 && hasTech('stone') && !anycount('watchstone')) { placeProject(T, 'watchstone', ['high', 'mid']); return; }
  if (hasTech('climate') && anycount('terraformer') < 3 && chance(.3)) { const t2 = pick(big.slice(0, 3)); placeProject(t2, 'terraformer', ['barren', 'edge']); return; }
  if (S.pendingWonder) {
    const W2 = S.T[S.pendingWonder.sid] || T, w = S.pendingWonder;
    if (placeProject(W2, 'monument', ['mid', 'center'], { sub: w.k, name: w.n })) S.pendingWonder = null;
  }
}
function biggestTown() { let b = null; for (const T of towns()) if (!b || T.pop > b.pop) b = T; return b; }
function randTown(byPop = true) {
  const ts = towns(); if (!ts.length) return null;
  if (!byPop) return pick(ts);
  return wpick(ts.map(T => [T, Math.sqrt(T.pop) + 1]));
}

const AGE_BUILD = { gardens: ['park', 'dome'], lanterns: ['monument'], stone: ['monument'], sky: ['antenna', 'observatory'], tides: ['dock', 'park'], song: ['museum', 'stadium', 'park'],
  quiet: ['library', 'park'], stars: ['observatory', 'museum'], craft: ['market', 'workshop'], echo: ['museum', 'monument'] };
function ageProject(T) {
  const th = S.age.k, cb = Object.entries(CULT.bld);
  const type = cb.length && chance(.4) ? wpick(cb) : pick(AGE_BUILD[th] || ['park']);
  let s = type === 'dock' ? findSite(T, 'shore') : findSite(T, 'mid');
  if (!s) { // rebuild over an old low-rise block
    const olds = T.bl.map(id => S.B[id]).filter(B => B && B.type === 'house' && B.prog >= 1 && B.tier <= 4 && S.year - B.built > 60);
    if (!olds.length) return;
    const O = pick(olds); s = { x: O.x, y: O.y }; removeBuilding(O);
  }
  const o = {};
  if (type === 'shrine') { if (!hasTech('stone')) return; }
  if (type === 'monument') { const w = pick(WONDERS.filter(w => w.k !== 'statue')); o.sub = th === 'lanterns' ? 'lantern' : w.k; o.name = th === 'lanterns' ? `The ${pick(SONG_A)} Lantern` : `The ${pick(['Memory', 'Harvest', 'Makers', 'Founders', 'Second Seed', 'Mossback', 'Long Road'])} ${pick(['Stone', 'Spire', 'Arch', 'Column', 'Garden'])}`; }
  if (type === 'dock') o.dir = nearWaterDir(s.x, s.y);
  const B = mkBuilding(type, s.x, s.y, T, o);
  if (type !== 'park') connectRoad(B);
}
const CULT_TECH = { park: 'stone', shrine: 'stone', monument: 'stone', market: 'loom', library: 'print', school: 'script', observatory: 'optics', museum: 'net', stadium: 'electric', dock: 'boats', workshop: 'smelt', dome: 'domes' };
function cultureProject(T) {
  const cb = Object.entries(CULT.bld); if (!cb.length || T.pop < 80) return;
  const type = wpick(cb), w = CULT.bld[type];
  if (!hasTech(CULT_TECH[type] || 'stone') || !chance(.035 * Math.min(2, w))) return;
  if (type !== 'monument' && type !== 'park' && bcount(T, type) >= 4) return;
  const d = (S.doctrines || []).filter(d => d.ai && d.str >= .15 && (d.bld || []).includes(type)).pop();
  const o = {};
  if (type === 'monument') { o.sub = pick(AI_MONUMENTS); o.name = d ? `The Stone of ${d.name.replace(/^the /i, '')}` : 'The Watcher’s Stone'; if (anycount('monument') > 12) return; }
  if (type === 'dock') { const s = findSite(T, 'shore'); if (!s) return; mkBuilding('dock', s.x, s.y, T, { dir: nearWaterDir(s.x, s.y) }); return; }
  const B = placeProject(T, type, ['mid', 'center'], o);
  if (B && d && chance(.35)) chron('🏛️', `${T.name} builds a ${BT[type].n.toLowerCase()} in honour of ${d.name}.`, { x: B.x, y: B.y });
}
function greenFields(T) {
  if (T.cap.food < T.pop * 1.3) return;
  const fs = T.bl.map(id => S.B[id]).filter(B => B && B.type === 'farm' && B.prog >= 1);
  if (!fs.length) return;
  const F = pick(fs); const x = F.x, y = F.y;
  removeBuilding(F);
  if (chance(.5)) mkBuilding('park', x, y, T); else { const i = idx(x, y); M.tree[i] = 1 + ri(0, 2); M.ttype[i] = pick([1, 1, 3, 4]); M.wild[i] = 1; markDirty(i); }
}
function planTown(T) {
  let active = 0;
  for (const id of T.bl) { const B = S.B[id]; if (B && (B.prog < 1)) active++; }
  const maxActive = Math.min(10, 1 + Math.floor(Math.sqrt(T.pop) / 2.5));
  if (active >= maxActive) return;
  if (T.id === 1 && S.year < 12) { // the Founder's own first builds
    if (!bcount(T, 'house')) { const s = findSite(T, 'house'); if (s) { mkBuilding('house', s.x, s.y, T, { tier: 0 }); return; } }
    if (hasTech('hydro') && !bcount(T, 'farm')) { const s = findSite(T, 'farm'); if (s) { mkBuilding('farm', s.x, s.y, T); return; } }
  }
  if (chance(.25) && tryEcon(T)) return;
  const needF = T.pop > T.cap.food * 0.75, needH = T.pop > T.cap.house * 0.75;
  if ((needH || chance(.08)) && frontageCount(T) < wantFrontage(T)) growStreets(T);
  if (needF && needH) { if (T.cap.food < T.cap.house ? tryFood(T) : tryHousing(T)) return; }
  if (needF && tryFood(T)) return;
  if (needH && tryHousing(T)) return;
  if (chance(0.5) && tryService(T)) return;
  if (chance(0.12)) tryUpgrade(T);
}

function buildTown(T) {
  const active = [];
  for (const id of T.bl) { const B = S.B[id]; if (B && B.prog < 1) active.push(B); }
  if (!active.length) return;
  const share = laborOf(T) / active.length;
  for (const B of active) {
    const dp = Math.min(share / workFor(B), 1 - B.prog);
    B.prog = Math.min(1, B.prog + dp * payFor(T, B, dp)); // short of materials: slower, never stopped
    if (B.prog > .9999) B.prog = 1;
    const stage = B.prog >= 1 ? 9 : Math.floor(B.prog * 5);
    if (stage !== B._st) { B._st = stage; markDirty(idx(B.x, B.y)); }
    if (B.prog >= 1) completeBuilding(B, T);
  }
}
const FIRST_TXT = {
  house: null,
  farm: 'The first field is turned over near {T}. Earth wheat and sunroot, side by side.',
  well: '{T} digs its first well. The water tastes faintly of violets.',
  granary: 'A granary is raised in {T}. Winter will be less frightening now.',
  shrine: 'A shrine goes up in {T}, to the Founder, the Pod, and whatever else might be listening.',
  dock: 'The first pier juts into the water at {T}. Fish-that-are-not-quite-fish are on the menu.',
  market: 'Market day comes to {T}. Mossback wool for sunroot beer, fair and square.',
  school: 'The first schoolhouse opens in {T}. The children hate it immediately.',
  workshop: 'Hammers ring in the first workshop of {T}.',
  mine: 'A mine is opened in the hills above {T}. The first cart of ore comes out red and heavy.',
  lumber: 'Woodcutters set up camp at the forest edge outside {T}. The first logs are stacked to dry.',
  quarry: 'A quarry is cut into the hillside near {T}. The valley stone comes out in clean grey blocks.',
  claypit: 'Clay is dug from the banks near {T} and pressed into bricks to dry in the sun.',
  mill: 'A windmill turns over {T}. Its creak becomes the sound of home.',
  hall: '{T} builds a town hall with a clock that is almost always right.',
  library: 'The Library of {T} opens. The Archive has a second home.',
  observatory: 'An observatory is built above {T}. Someone stays up every night now.',
  works: 'The first works belches steam in {T}. The mossbacks are unimpressed.',
  station: 'A rail station is finished in {T}, waiting for its trains.',
  clinic: 'A clinic opens in {T}. The valley fever has nowhere to hide.',
  power: 'The power house of {T} hums to life. Lights flicker on in every window.',
  turbine: 'Tall white turbines turn on the hills of {T}.',
  mast: 'A radio mast rises over {T}. The first broadcast is the Pod’s landing chime.',
  airfield: 'An airfield is laid out at {T}. The windsock is the most photographed thing in town.',
  harbor: '{T} builds a harbour: stone quays, a crane, and a warehouse that smells of tar and oranges.',
  lighthouse: 'A lighthouse is lit on the point near {T}. Ships can find their way home in the dark now.',
  university: 'The University of {T} opens its doors.',
  antenna: 'A Weave relay goes up in {T}.',
  solar: 'Solar glass glitters outside {T}.',
  vfarm: 'A gene garden tower rises in {T}. A whole field of crops, stacked to the clouds.',
  park: '{T} turns an old field into its first park.',
  stadium: '{T} opens a stadium. Kiteball will never be the same.',
  museum: 'The Museum of {T} opens. The first exhibit is a piece of the Pod’s heat shield.',
  launchpad: 'A launch pad is built at {T}.',
  fusion: 'A fusion plant ignites in {T}. It is very quiet for a star.',
  terraformer: 'A climate engine starts breathing near {T}. The rust flats will be green one day.',
  dome: 'A garden dome is finished in {T}. It rains inside it on Tuesdays.',
  elevator: 'The Space Elevator is finished at {T}. A thread to the sky, and a queue to ride it.',
  watchstone: 'A Watchstone is raised above {T}, facing the sky. For the Watcher.'
};
function completeBuilding(B, T) {
  if (B.up != null) { B.tier = B.up; B.up = null; }
  B.style = S.styleIdx; B.built = yr();
  econComplete(B, T);
  recalcTown(T);
  const key = B.type === 'house' ? 'house' + B.tier : B.type;
  if (!S.firsts[key]) {
    S.firsts[key] = yr();
    let txt = FIRST_TXT[B.type];
    if (B.type === 'house' && B.tier >= 3) txt = ['', '', '', 'The first two-storey townhouse goes up in {T}.', 'Rowhouses line the streets of {T} now.', 'The first apartment block rises in {T}. Neighbours, everywhere.', 'A glass tower climbs over {T}. It catches the sun all day.', 'The first arcology is complete in {T}: a whole town in one building.'][B.tier];
    if (B.type === 'house' && B.tier === 2) txt = `The first ${B.mat ? MAT[B.mat].n + ' ' : ''}cottage is finished in {T}.`;
    if (B.type === 'monument') txt = `${B.name} is completed in {T}.`;
    if (txt) chron(B.type === 'monument' ? '🏛️' : '🏗️', txt.replace('{T}', T.name), { x: B.x, y: B.y, k: ['elevator', 'launchpad', 'monument', 'watchstone', 'university'].includes(B.type) ? 'major' : '' });
  } else if (B.type === 'monument') chron('🏛️', `${B.name} is completed in ${T.name}.`, { x: B.x, y: B.y, k: 'major' });
  if (B.type === 'monument' || B.type === 'watchstone' || B.type === 'shrine') gainRev(B.type === 'shrine' ? 5 : 12, B.type === 'monument' ? B.name : B.type === 'shrine' ? 'a new shrine' : 'the Watchstone');
  if (B.type === 'elevator') S.sky.elevator = 1;
  if (B.type === 'station') planRails();
}

function growTown(T) {
  recalcTown(T);
  const cap = Math.min(T.cap.house, T.cap.food);
  const r = (0.045 + (hasTech('medicine') ? 0.01 : 0)) * (S.drought > 0 ? 0.6 : 1) * (1 + .3 * (CULT.bs || 0)) * (lever('growth') === 'stay_small' ? .55 : 1);
  if (S.year >= 17 || T.id !== 1) {
    if (T.pop < cap) T.pop += Math.max(0.02, T.pop * r / 12 * (1 - T.pop / Math.max(1, cap)));
    else T.pop -= (T.pop - cap) * 0.04;
  }
  if (T.pop < 1) T.pop = 1;
}

/* ---------- founding ---------- */
const MAX_TOWNS = [1, 1, 2, 3, 4, 5, 6, 6, 7, 7];
function tryFound() {
  const ts = towns(), g = lever('growth'), PT = S.pendingTown;
  if (PT && S.year > PT.until) { S.pendingTown = null; chron('🧭', `The settlers who meant to found ${PT.name} never find the right valley, and quietly unpack.`); return; }
  const forced = PT && S.year >= PT.at && ts.length < 10;
  if (!forced) {
    if (g === 'stay_small') return;
    const more = g === 'more_towns' ? 2 : 0;
    if (ts.length >= MAX_TOWNS[S.era] + (S.age ? 1 : 0) + more || ts.length >= 8 + more) return;
    if (S.year - S.lastFound < (more ? 12 : 25)) return;
  }
  const parent = ts.filter(T => T.pop > (forced ? 20 : 40 + ts.length * 30)).sort((a, b) => b.pop - a.pop)[0];
  if (!parent) return;
  let best = null, bs = -1e9;
  for (let t = 0; t < (forced ? 1500 : 500); t++) {
    const x = 3 + ri(0, W - 7), y = 3 + ri(0, H - 7), i = idx(x, y);
    if (M.water[i] || M.bld[i] || M.ruin[i] || M.elev[i] > 5 || M.bio[i] === BIO.ROCK || M.bio[i] === BIO.SNOW) continue;
    const dp = dist(x, y, parent.x, parent.y);
    if (dp < (forced ? 7 : 10) || dp > (forced ? 40 : 26)) continue;
    if (ts.some(T => dist(x, y, T.x, T.y) < Math.max(forced ? 8 : 11, townRadius(T) + 2.5))) continue; // open country, not someone else's back streets
    let ok = 0, fert = 0, water = 0;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
      if (M.water[j]) water++; else if (!M.bld[j] && !M.road[j] && !M.plan[j] && Math.abs(M.elev[j] - M.elev[i]) <= 1) { ok++; fert += M.fert[j]; }
    }
    if (ok < (forced ? 16 : 22)) continue;
    const s = ok * .4 + fert * .25 + (water > 0 && water < 12 ? 6 : 0) - dp * .15 + rnd() * 4;
    if (s > bs) { bs = s; best = { x, y }; }
  }
  if (!best) { if (!forced) S.lastFound = S.year - 15; else PT.at = S.year + 3; return; }
  const move = Math.min(parent.pop * 0.22, 14 + ts.length * 5);
  parent.pop -= move;
  if (forced) S.pendingTown = null;
  const T = { id: S.nextT++, name: forced ? PT.name : placeName(S.lang), x: best.x, y: best.y, founded: yr(), pop: move, cap: { house: 0, food: 0 }, bl: [], crop: ri(0, CROPS.length - 1), linked: false, lastElect: yr() };
  const f = cast('explorer', parent, p => p.st.amb + p.st.cur, { minAge: 22, maxAge: 50, filter: p => p.id !== S.founder && parent.leader !== p.id });
  f.sid = T.id; T.founder = f.id; T.leader = f.id;
  const sp = f.sp && S.P[f.sp]; if (sp && sp.died === null) sp.sid = T.id;
  for (const k of f.kids) { const c = S.P[k]; if (c && c.died === null && S.year - c.born < 16) c.sid = T.id; }
  S.T[T.id] = T; econFound(T, parent);
  S.lastFound = S.year;
  const pl = mkBuilding('plaza', best.x, best.y, T, { prog: 1 });
  if (streetMode(T) === 'grid') growDistrict(T); else { growLane(T); growLane(T); }
  // starter shelters so the pioneers have somewhere to sleep
  for (let k = 0; k < 3; k++) { const s = findSite(T, 'house') || findSite(T, 'backlot') || anyPlot(T); if (s) { const B = mkBuilding('house', s.x, s.y, T, { tier: Math.max(1, Math.min(maxHouseTier(), 2)), prog: .5 }); connectRoad(B); } }
  recalcTown(T);
  const nth = ts.length + 1;
  chron('🏘️', `${f.name} leads ${Math.round(move)} settlers out of ${parent.name} to found ${T.name}${nth === 2 ? ', the second town on the world' : ''}.`, { T, k: 'major' });
  fx('caravan', { from: parent.id, to: T.id, n: Math.min(14, Math.round(move / 2)) });
  gainRev(10, 'a new town');
}

/* ---------- tech ---------- */
function techCost(i) {
  const t = TECHS[i], prev = i ? TECHS[i - 1].yr : 0;
  const span = t.yr - prev;
  return Math.max(4, expectedRP(t.yr) - expectedRP(prev)) + span * 0;
}
// expected cumulative research by year (calibrated against typical growth)
function expectedRP(y) { return 0.012 * Math.pow(y, 2.45) + 3 * y; }
function researchRate() {
  const pop = totalPop();
  let m = 1;
  for (const k in S.B) {
    const B = S.B[k]; if (B.prog < 1) continue;
    if (B.type === 'school') m += .2; else if (B.type === 'library') m += .45; else if (B.type === 'university') m += .9; else if (B.type === 'observatory') m += .3; else if (B.type === 'antenna') m += .3;
  }
  m = Math.min(m, 6);
  if (S.age) { const th = AGE_THEMES.find(a => a.k === S.age.k); if (th && th.research) m *= th.research; }
  return (0.9 * Math.pow(pop, 0.62) * m + (S.year < 20 ? 3 : 0)) * (1 + .25 * (CULT.rs || 0));
}
function stepResearch() {
  if (S.tech.cur >= TECHS.length) return;
  const t = TECHS[S.tech.cur];
  // pacing governor: keeps the arc close to its intended length (weeks), while pop still matters
  const late = S.year - t.yr, span = Math.max(8, t.yr - (S.tech.cur ? TECHS[S.tech.cur - 1].yr : 0));
  const gov = clamp(Math.pow(2, late / (span * 0.35 + 6)), 0.35, 4);
  let pts = researchRate() * gov / 12;
  if (S.boost > 0) { pts *= 1.6; S.boost -= 1 / 12; }
  S.tech.pts += pts;
  if (S.tech.pts >= techCost(S.tech.cur)) {
    S.tech.pts = 0;
    completeTech(S.tech.cur);
    S.tech.cur++;
  }
}
function techInventor(t) {
  if (S.year < 40 && person(S.founder).died === null) return person(S.founder);
  const T = randTown();
  return cast('inventor', T, p => p.st.cur + p.st.cft + (['inventor', 'sage', 'apprentice'].includes(p.role) ? 4 : 0), { minAge: 16, maxAge: 90 });
}
function completeTech(i) {
  const t = TECHS[i];
  S.tech.done[t.id] = yr();
  const p = techInventor(t);
  const T = S.T[p.sid] || biggestTown();
  p.deeds.push(t.name);
  chron('💡', `${p.id === S.founder ? p.name : whoOf(p, t.era > 0 ? T : null)} ${t.txt}. (${t.name})`, { T, k: t.era >= 7 ? 'major' : '', cap: t.name });
  if (t.era > S.era) newEra(t.era);
  // side effects
  const rt = roadTier(); if (towns().length && Object.keys(S.B).length) { for (let k = 0; k < W * H; k++) if (M.road[k] && M.road[k] < rt) { upgradeRoads(); break; } }
  if (t.id === 'optics' && !S.moons) {
    S.moons = [placeName(S.lang).split(' ')[0], placeName(S.lang).split(' ')[0]];
    chron('🔭', `Through the new lenses the two moons have mountains. They are named ${S.moons[0]} and ${S.moons[1]}.`);
  }
  if (t.id === 'sats') S.sky.sats = 3;
  if (t.id === 'station') { S.sky.station = 1; chron('🛰️', 'A small station opens in orbit. On a clear day you can see it glint.', { k: 'major' }); }
  if (t.id === 'ring') { S.sky.ring = 0.02; chron('💫', 'Work begins on the Orbital Ring. It will take generations.', { k: 'major' }); }
  if (t.id === 'medicine') for (const p2 of living()) p2.life += 10;
  if (['optics', 'computing', 'net', 'station', 'climate'].includes(t.id)) maybeDecipher();
  if (i === TECHS.length - 1) { S.ageNext = S.year + 40; chron('🌌', 'Every page of the Archive has been read, understood, and improved upon. What comes next, nobody wrote down.', { k: 'major' }); }
  UIDIRTY.stats = true;
}

function newStyle(name) {
  const H0 = rnd() * 360;
  return {
    name: name || pick(STYLE_WORDS), wall: hsl(H0, 22 + rnd() * 20, 82 + rnd() * 9), roof: hsl(H0 + 150 + rf(-40, 40), 32 + rnd() * 18, 48 + rnd() * 12),
    accent: hsl(H0 + 60 + rf(-30, 30), 55 + rnd() * 20, 58), trim: hsl(H0, 14, 44), glass: hsl(190 + rnd() * 40, 45, 76)
  };
}
function newEra(e) {
  S.era = e;
  S.styles.push(inheritForm(Object.assign({}, STYLES0[e]))); S.styleIdx = S.styles.length - 1;
  driftLang(S.lang, 2);
  chron('🌅', ERAS[e].title, { k: 'era', nocap: true });
  gainRev(25, 'a new era');
  if (e >= 2 && S.wondersUsed.length < WONDERS.length) queueWonder();
}
function queueWonder() {
  const T = biggestTown(); if (!T || T.pop < 60) return;
  const free = WONDERS.filter(w => !S.wondersUsed.includes(w.n));
  const w = S.wondersUsed.length === 0 ? WONDERS[0] : pick(free.length ? free : WONDERS);
  S.wondersUsed.push(w.n);
  S.pendingWonder = { sid: T.id, k: w.k, n: w.n };
  chron('📐', `${T.name} begins work on ${w.n}.`, { T });
}
function startAge() {
  const last = S.age ? S.age.k : null;
  const th = pick(AGE_THEMES.filter(a => a.k !== last));
  const nm = pick(th.names);
  S.ageUsed[nm] = (S.ageUsed[nm] || 0) + 1;
  const n = S.ageUsed[nm];
  const name = (n > 1 ? `The ${['', '', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth'][n] || ordinal(n)} Age of ` : 'The Age of ') + nm;
  S.ageN++;
  S.age = { n: S.ageN, name, k: th.k, start: yr(), len: ri(70, 150) };
  const st = inheritForm(newStyle()); S.styles.push(st); S.styleIdx = S.styles.length - 1;
  driftLang(S.lang, 3);
  chron('🌀', name, { k: 'era', nocap: true });
  gainRev(25, 'a new age');
  chron('🎨', `A new way of building spreads from ${biggestTown().name}: the ${st.name} style.`);
  if (th.k === 'stone' || chance(.4)) queueWonder();
}

/* ---------- lore ---------- */
function maybeDecipher() {
  if (S.lore >= LORE.length) return;
  const unexc = S.ruins.filter(r => M.ruin[idx(r.x, r.y)] === 1).length;
  if (unexc > 0 && S.lore < 3) return;
  revealLore(null);
}
function revealLore(r) {
  if (S.lore >= LORE.length) return;
  const L = LORE[S.lore++];
  chron('📜', L.t, r ? { x: r.x, y: r.y, k: 'major', cap: L.h } : { k: 'major' });
  S.boost = Math.max(S.boost, 3);
  UIDIRTY.lore = true;
}
function checkRuins() {
  if (!hasTech('script') && S.year < 150) return;
  for (const r of S.ruins) {
    const i = idx(r.x, r.y); if (M.ruin[i] !== 1) continue;
    for (const T of towns()) {
      if (dist(r.x, r.y, T.x, T.y) <= townRadius(T) + 4) {
        M.ruin[i] = 2; markDirty(i);
        for (const [dx, dy] of N4) { const nx = r.x + dx, ny = r.y + dy; if (inb(nx, ny) && M.ruin[idx(nx, ny)] === 1) { M.ruin[idx(nx, ny)] = 2; markDirty(idx(nx, ny)); } }
        const p = cast('sage', T, q => q.st.cur * 2, { minAge: 18 }); p.deeds.push('clearing the Maker stones');
        chron('⛏️', `${whoOf(p, T)} clears the vines from the old stones outside town.`, { x: r.x, y: r.y });
        revealLore(r);
        return;
      }
    }
  }
}

/* ---------- world changes ---------- */
function stepNature() {
  // forest regrowth
  for (let k = 0; k < 3; k++) {
    const i = ri(0, W * H - 1); const x = i % W, y = (i / W) | 0;
    if (M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i]) continue;
    const b = M.bio[i]; if (b !== BIO.MEADOW && b !== BIO.LUSH && b !== BIO.HIGH) continue;
    const T = ownerOf(x, y); if (T && dist(x, y, T.x, T.y) < townRadius(T) + 2) continue;
    if (M.tree[i] && M.tree[i] < 3 && chance(.3)) { M.tree[i]++; markDirty(i); }
    else if (!M.tree[i] && adjCount(x, y, j => M.tree[j] > 0) >= 2 && chance(.35)) { M.tree[i] = 1; M.ttype[i] = M.ttype[idx(clamp(x + 1, 0, W - 1), y)] || (b === BIO.HIGH ? 2 : 1); markDirty(i); }
  }
  // terraforming
  for (const k in S.B) {
    const B = S.B[k]; if (B.type !== 'terraformer' || B.prog < 1 || !chance(.35)) continue;
    const x = B.x + ri(-7, 7), y = B.y + ri(-7, 7); if (!inb(x, y)) continue; const i = idx(x, y);
    if (M.water[i] || M.bio[i] === BIO.SNOW) continue;
    if (M.bio[i] === BIO.BARREN || M.bio[i] === BIO.ROCK || M.bio[i] === BIO.HIGH || M.bio[i] === BIO.SAND && chance(.2)) {
      M.bio[i] = M.elev[i] >= 6 ? BIO.HIGH : chance(.4) ? BIO.LUSH : BIO.MEADOW; M.fert[i] = Math.max(M.fert[i], 2);
      if (!M.bld[i] && !M.road[i] && chance(.3)) { M.tree[i] = 1; M.ttype[i] = pick([1, 3, 2]); }
      markDirty(i);
    }
  }
  natureLever();
  // renovation into the current style (much faster right after the Watcher changes how things are built)
  const ids = Object.keys(S.B), reno = S.renoUntil && S.year < S.renoUntil;
  for (let k = 0; k < (reno ? 8 : 2) && ids.length; k++) {
    const B = S.B[pick(ids)];
    if (!B || B.prog < 1 || B.type === 'pod' || B.type === 'monument' || B.style === S.styleIdx || S.year - B.built < (reno ? 25 : 110) || !chance(.35)) continue;
    B.style = S.styleIdx; B.built = yr(); if (B.type === 'house' && chance(.5)) B.var = rnd();
    if (!B.mat && B.type === 'house' && B.tier >= 1 && B.tier <= 4 && S.T[B.sid] && S.T[B.sid].res) B.mat = chooseMat(S.T[B.sid], 'house', B.tier); // older saves pick up materials as they renovate
    markDirty(idx(B.x, B.y));
  }
  // pod ages visibly
  if ((yr() === 121 || yr() === 251 || yr() === 601) && S.month % 12 === 0) { const L = S.landing; markDirty(idx(L.x, L.y)); }
}

function inheritForm(st) {
  for (let k = S.styles.length - 1; k >= 0; k--) {
    const o = S.styles[k]; if (!o.cult) continue;
    const d = (S.doctrines || []).find(d => d.id === o.cult);
    if (d && d.str >= .3) { for (const f of ['shape', 'roofK', 'fields']) if (o[f]) st[f] = o[f]; st.cult = o.cult; }
    break;
  }
  return st;
}
function natureLever() {
  const nat = lever('nature'); if (!nat) return;
  const w = leverW('nature'), ts = towns(); if (!ts.length) return;
  const n = Math.round((nat === 'wild' ? 6 : 3) * w + rnd());
  for (let k = 0; k < n; k++) {
    if (nat === 'plant' || nat === 'gardens') { // trees and flowers in and around town
      const T = pick(ts), R = townRadius(T), a = rnd() * TAU, d = rf(R * .4, R + 3), x = Math.round(T.x + Math.cos(a) * d), y = Math.round(T.y + Math.sin(a) * d);
      if (!inb(x, y)) continue; const i = idx(x, y);
      if (M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i] || M.tree[i] >= 2) continue;
      const b = M.bio[i]; if (b !== BIO.MEADOW && b !== BIO.LUSH && b !== BIO.SAND && b !== BIO.HIGH) continue;
      if (isStreet(x, y) && d < R) continue;
      M.tree[i] = (M.tree[i] || 0) + 1; M.ttype[i] = nat === 'gardens' ? pick([4, 3, 1]) : pick([1, 1, 4, 3, 2]); M.wild[i] = 1; markDirty(i);
    } else if (nat === 'clear') { // woods near towns give way to fields
      const T = pick(ts), R = townRadius(T), x = T.x + ri(-Math.ceil(R + 6), Math.ceil(R + 6)), y = T.y + ri(-Math.ceil(R + 6), Math.ceil(R + 6));
      if (!inb(x, y)) continue; const i = idx(x, y);
      if (M.tree[i] && !M.bld[i]) { M.tree[i] = Math.max(0, M.tree[i] - 1); markDirty(i); }
    } else if (nat === 'wild' || nat === 'protect') { // forests creep back, right up to the houses
      const i = ri(0, W * H - 1), x = i % W, y = (i / W) | 0;
      if (M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i]) continue;
      const b = M.bio[i]; if (b !== BIO.MEADOW && b !== BIO.LUSH && b !== BIO.HIGH) continue;
      const T = ownerOf(x, y); if (T && dist(x, y, T.x, T.y) < townRadius(T) * (nat === 'wild' ? .6 : 1.1)) continue;
      if (M.tree[i] && M.tree[i] < 3) { M.tree[i]++; markDirty(i); }
      else if (!M.tree[i] && (nat === 'wild' || adjCount(x, y, j => M.tree[j] > 0) >= 1)) { M.tree[i] = 1; M.ttype[i] = nat === 'wild' && chance(.3) ? 3 : M.ttype[idx(clamp(x + 1, 0, W - 1), y)] || (b === BIO.HIGH ? 2 : 1); markDirty(i); }
    }
  }
}

/* ---------- events ---------- */
function pickFresh(pool, key) {
  S.recent = S.recent || {}; const r = S.recent[key] = S.recent[key] || [];
  const avail = pool.filter(x => !r.includes(x));
  const v = pick(avail.length ? avail : pool);
  r.push(v); if (r.length > Math.min(12, pool.length - 1)) r.shift();
  return v;
}
const TOPICS = ['whose turn it is to feed the mossbacks', 'the correct way to boil sunroot', 'a boundary stone', 'who saw the comet first', 'the name of a hill', 'a borrowed wheelbarrow', 'the rules of the game itself'];
function invBand() { return S.era <= 2 ? 0 : S.era <= 3 ? 1 : S.era <= 4 ? 2 : S.era <= 5 ? 3 : S.era <= 6 ? 4 : 5; }
function sportNow() { return SPORTS[Math.min(5, invBand())]; }
const EVENTS = [
  { k: 'harvest', w: 5, when: () => hasTech('sunroot'), run() { const T = randTown(); const c = CROPS[T.crop].n; T.pop *= 1.015; chron('🌾', pick([`A bumper ${c} harvest in ${T.name}.`, `${T.name} brings in a heavy, sweet crop of ${c} this year.`, `The granaries of ${T.name} are full to the rafters.`]), { T }); } },
  { k: 'festival', w: 4, when: () => S.year > 25, run() { const T = randTown(); const ex = (S.extraFestAt || []).filter(f => f.from <= S.year).map(f => f.n); const f = pickFresh(FESTIVALS.concat(ex, ex), 'fest'); chron('🎆', `${T.name} celebrates ${f}.`, { T }); fx('fireworks', { x: T.x, y: T.y }); gainRev(4, 'a festival'); } },
  { k: 'art', w: 3, when: () => hasTech('kiln'), run() { const T = randTown(); const p = cast('artist', T, q => q.st.cft + q.st.wit + (q.role === 'artist' ? 3 : 0), { minAge: 16 }); const a = pickFresh(ARTWORKS, 'art'); p.deeds.push(a); chron('🎨', `${whoOf(p, T)} makes ${a}.`, { T }); } },
  { k: 'song', w: 2, when: () => S.year > 12, run() { const T = randTown(); chron('🎵', `A song called “The ${pick(SONG_A)} ${pick(SONG_B)}” spreads from ${T.name} to every hearth.`, { T }); } },
  { k: 'invent', w: 3, when: () => S.year > 15, run() { const T = randTown(); const p = cast('inventor', T, q => q.st.cur + q.st.cft + (q.role === 'inventor' ? 3 : 0), { minAge: 14 }); const th = pickFresh(INVENTIONS[invBand()], 'inv'); p.deeds.push(th); chron('🔧', `${whoOf(p, T)} invents ${th}.`, { T }); } },
  { k: 'storm', w: 2, when: () => S.year > 5, run() { const T = randTown(); const bs = T.bl.map(id => S.B[id]).filter(B => B && !FLAT_TYPES[B.type] && !OUTDOOR[B.type] && B.type !== 'monument' && B.type !== 'lighthouse' && B.prog >= 1); chron('⛈️', bs.length && chance(.6) ? `A summer storm tears the roof off a ${BT[pick(bs).type].n.toLowerCase()} in ${T.name}. The neighbours have it fixed within the month.` : 'A great summer storm rolls over the valley and leaves everything washed and shining.', { T }); fx('rain', { x: T.x, y: T.y, big: 1 }); } },
  { k: 'drought', w: 1, when: () => !S.drought && S.year > 30 && !hasTech('climate'), run() { S.drought = ri(2, 5); const T = randTown(); chron('☀️', `A dry spell settles over the valley. The fields around ${T.name} turn gold too early.`, { T }); } },
  { k: 'herd', w: 3, run() { const T = randTown(); chron('🐾', pick([`A herd of mossbacks wanders straight through ${T.name}. Nobody minds.`, `Mossback calves are born in the meadows above ${T.name}.`, `The mossbacks migrate early this year, past ${T.name} and down to the water.`]), { T }); fx('herd', { x: T.x, y: T.y }); } },
  { k: 'pets', w: 3, once: 1, when: () => hasTech('herding'), run() { const T = randTown(); S.flags.pets = 1; chron('🐕', `Children in ${T.name} adopt a loamhound pup. Within a generation every house has one.`, { T }); } },
  { k: 'giant', w: .7, when: () => S.year > 50, run() { chron('🦒', pick(['A Longstrider walks through the valley, taller than the Pod. The children follow it to the river.', 'A Longstrider is seen crossing the far meadows, slow as a cloud.']), { k: 'major' }); fx('giant', {}); } },
  { k: 'meteors', w: 1.2, run() { const T = randTown(); chron('🌠', `Shooting stars fall all night. ${T.name} stays up to count them.`, { T }); fx('meteors', {}); } },
  { k: 'rivalry', w: 2.5, when: () => towns().length >= 2, run() { const ts = shuffle(towns().slice()); const A = ts[0], B = ts[1], sp = pick(sportNow()), win = pick([A, B]); chron('🏆', `${A.name} and ${B.name} settle an argument about ${pick(TOPICS)} with a match of ${sp}. ${win.name} wins; everyone shares the beer.`, { T: win }); } },
  { k: 'comet', w: .8, run() { const T = randTown(); const nm = nameWord(S.lang, 2); chron('☄️', `A comet hangs in the sky for a season. ${T.name} names it ${nm}.`, { T }); fx('comet', {}); } },
  { k: 'fever', w: 1, when: () => !hasTech('medicine') && S.year > 40, run() { const T = randTown(); T.pop *= .97; chron('🤒', `A fever season in ${T.name}. It passes with the spring, and the town is quieter for a while.`, { T }); } },
  { k: 'accord', w: 3, once: 1, when: () => towns().length >= 3 && hasTech('script'), run() { const nm = nameWord(S.lang, 2); S.accord = nm; chron('🤝', `The towns of the valley sign the ${nm} Accord: no walls between them, ever.`, { k: 'major' }); } },
  { k: 'book', w: 1.5, when: () => hasTech('script'), run() { const T = randTown(); const p = cast('sage', T, q => q.st.cur * 2 + q.st.wit, { minAge: 20 }); const title = `${pick(['On', 'A History of', 'Letters from', 'The Book of', 'Notes on'])} ${pick(['the Pod', 'Mossbacks', 'the Makers', T.name, 'Sunroot', 'the Two Moons', 'Rain', 'the Watcher', 'Small Things'])}`; p.deeds.push(`“${title}”`); chron('📖', `${whoOf(p, T)} writes “${title}”.`, { T }); } },
  { k: 'climb', w: 2, once: 1, when: () => S.year > 150, run() { const T = randTown(); chron('🏔️', `An expedition from ${T.name} climbs the highest peak on the valley’s rim and names it ${nameWord(S.lang, 1)} Top.`, { T }); } },
  { k: 'weave', w: 1.2, when: () => hasTech('net'), run() { chron('📡', pick(['The most watched channel on the Weave is a live feed of a sleeping mossback.', 'A Weave poll decides the valley’s favourite vegetable. Sunroot wins, again.', 'Someone uploads the entire Archive to the Weave as a joke. It crashes for a day.']), {}); } },
  { k: 'oldest', w: 1, when: () => living().some(p => age(p) >= 95), run() { const p = living().sort((a, b) => a.born - b.born)[0]; const T = S.T[p.sid]; chron('🎂', `${p.name}${T ? ' of ' + T.name : ''} turns ${age(p)}. The whole town gets ${p.q.food}.`, T ? { T } : {}); } },
  { k: 'skimmers', w: 1.5, run() { const T = randTown(); chron('🐦', `A flock of skimmers nests on the rooftops of ${T.name}. Considered very good luck.`, { T }); fx('birds', { x: T.x, y: T.y }); } },
  { k: 'wedding', w: .5, when: () => towns().length >= 2, run() { const ts = shuffle(towns().slice()); chron('💍', `A wedding joins two old families of ${ts[0].name} and ${ts[1].name}; the party lasts three days.`, { T: ts[0] }); } },
  { k: 'moon', w: 3, once: 1, when: () => hasTech('rocketry') && S.moons, run() { chron('🌘', `Colonists walk on ${S.moons[0]}. They leave a flag and a small jar of valley soil.`, { k: 'major' }); } },
  { k: 'seedship', w: 1.5, when: () => hasTech('seedships') && S.year - S.lastSeedship > 50, run() { S.lastSeedship = S.year; const sh = pick(SHIP_NAMES), st = pick(STARS); chron('🚀', `The seedship ${sh} departs for ${st}, carrying a vault of sleeping children and a copy of this chronicle.`, { k: 'major' }); fx('seedship', {}); } },
  { k: 'lore', w: 1, when: () => S.lore < LORE.length && S.year > 400 && S.ruins.every(r => M.ruin[idx(r.x, r.y)] !== 1), run() { revealLore(null); } },
  { k: 'election', w: .6, run() { electAnnounce(randTown()); } }
];
function rollEvent() {
  const theme = S.age ? AGE_THEMES.find(a => a.k === S.age.k) : null;
  const avail = EVENTS.filter(e => (!e.once || !S.flags['ev_' + e.k]) && (!e.when || e.when()));
  if (!avail.length) return;
  const e = wpick(avail.map(e => [e, e.w * (theme && theme.ev && theme.ev[e.k] ? theme.ev[e.k] : 1) * (1 + (CULT.ev[e.k] || 0))]));
  if (e.once) S.flags['ev_' + e.k] = 1;
  e.run();
}
function elect(T) {
  const old = person(T.leader);
  let p = null, heir = false;
  if (old && chance(.25)) {
    const hs = old.kids.map(id => S.P[id]).filter(c => c && adult(c) && c.sid === T.id && c.st.amb >= 5);
    if (hs.length) { p = hs.sort((a, b) => a.born - b.born)[0]; setRole(p, 'leader'); heir = true; }
  }
  if (!p) p = cast('leader', T, q => q.st.amb * 2 + q.st.kin + (q.deeds.length ? 2 : 0), { minAge: 28, maxAge: 80, filter: q => q !== old && q.id !== S.founder });
  T.leader = p.id; T.lastElect = yr();
  return { p, old, heir };
}
function electAnnounce(T) {
  const { p, old, heir } = elect(T);
  chron('🗳️', `${T.name} chooses ${p.name} as its ${titleFor()}${heir ? `, following ${old.first} into office` : old && old.died === null ? `, and ${old.name} retires to spend more time on ${old.q ? old.q.hobby : 'gardening'}` : ''}.`, { T });
}

function stepPeople() {
  for (const p of Object.values(S.P)) {
    if (p.died !== null) continue;
    if (S.year - p.born >= p.life) {
      p.died = yr();
      const T = S.T[p.sid];
      if (p.id === S.founder) {
        let n = Math.round(totalPop());
        chron('🕯️', `${p.name}, the Founder, dies at ${Math.round(S.year - p.born)}: the last person on this world who ever saw Earth. ${fmtInt(n)} people walk the coffin up the hill above the Pod${p.kids.length ? `, the vault children ${p.kids.map(k => S.P[k] && S.P[k].first).filter(Boolean).join(' and ')} in front` : ''}.`, { x: S.landing.x, y: S.landing.y, k: 'major' });
        const pl = Object.values(S.B).find(B => B.type === 'plaza'); if (pl) { pl.statue = 1; markDirty(idx(pl.x, pl.y)); }
      } else if (T && T.leader === p.id) {
        const { p: q, heir } = elect(T);
        chron('🕯️', `${p.name}, ${titleFor()} of ${T.name}, dies at ${age(p)}${survived(p)}. ${heir ? `${q.first}, their ${q.born === Math.min(...p.kids.map(k => S.P[k] ? S.P[k].born : 1e9)) ? 'eldest' : 'child'}, takes up the chain of office.` : q.name + ' takes up the chain of office.'}`, { T, nocap: true });
        continue;
      } else if (p.role === 'explorer' && T && T.founder === p.id) {
        chron('🕯️', `${p.name}, who led the settlers that founded ${T.name}, dies at ${age(p)}${survived(p)}.`, { T, nocap: true });
      } else if (p.deeds.length && chance(.4)) {
        const ap = p.app.map(id => S.P[id]).find(a => a && a.died === null);
        chron('🕯️', ap && chance(.6) ? `${p.name}, remembered for ${String(p.deeds[0])}, dies at ${age(p)}. Their apprentice ${ap.name} carries on the work.` : `${p.name}, remembered for ${String(p.deeds[0])}, dies at ${age(p)}${survived(p)}.`, T ? { T, nocap: true } : {});
      } else if (p.fl != null && p.fl <= 2 && chance(.7)) {
        chron('🕯️', `${p.name}, ${lineageLabel(p).toLowerCase()}, dies at ${age(p)}${survived(p)}.`, T ? { T, nocap: true } : {});
      }
    }
  }
  // prune the long dead
  const dead = Object.values(S.P).filter(p => p.died !== null);
  if (dead.length > 450) {
    const keep = p => (p.id === S.founder ? 1e9 : 0) + p.deeds.length * 60 + (p.fl != null && p.fl <= 3 ? 80 : 0) + (p.roles && p.roles.includes('leader') ? 50 : 0) + p.died * .05;
    dead.sort((a, b) => keep(a) - keep(b));
    for (const p of dead.slice(0, dead.length - 400)) delete S.P[p.id];
  }
}
function survived(p) {
  const [k, g] = descendants(p);
  if (!k) return '';
  return `, survived by ${k} child${k === 1 ? '' : 'ren'}${g ? ` and ${g} grandchild${g === 1 ? '' : 'ren'}` : ''}`;
}

/* ---------- milestones & scripted beats ---------- */
function milestones() {
  const y = yr(), f = person(S.founder), T1 = S.T[1];
  const once = (k, fn) => { if (!S.flags[k]) { S.flags[k] = 1; fn(); } };
  if (y >= 2) once('vault1', () => { const c = addPerson('child', 1, 0, { parents: [f] }); chron('👶', `The vault opens its first cradle. ${f.name} names the child ${c.first}.`, { T: T1 }); });
  if (y >= 6) once('vault2', () => { addPerson('child', 1, 0, { parents: [f] }); });
  if (y >= 11) once('vault3', () => { const c = addPerson('child', 1, 0, { parents: [f] }); c.q.tag = 'Remembers every birthday'; });
  if (y >= 12 && T1) once('name1', () => { const old = T1.name; T1.name = placeName(S.lang); chron('✍️', `The little camp around the Pod gets a name: ${T1.name}.`, { T: T1 }); });
  if (y >= 19) once('natural', () => chron('👶', `The first child is born on this world the old way, not from the vault. There is a party that lasts until morning.`, { T: T1, k: 'major' }));
  if (y >= 26 && S.vault <= 0) once('vaultEmpty', () => chron('🫙', 'The last cradle in the vault opens. From now on, the world will have to grow its own.', { T: T1 }));
  if (y >= 40 && !S.planet) once('planet', () => { S.planet = nameWord(S.lang, 2); chron('🌍', `The vault children vote on a name for their world. It is ${S.planet}.`, { k: 'major' }); UIDIRTY.stats = true; });
  if (y >= 100) once('c100', () => chron('🎉', `A hundred years since Landfall. The Pod is covered in moss and flowers, and nobody would dream of moving it.`, { x: S.landing.x, y: S.landing.y }));
  if (y > 100 && y % 250 === 0) chron('🎉', `Landfall Day, ${y} years since the Pod fell. Every town lights a lantern for the Founder.`, { x: S.landing.x, y: S.landing.y });
}

/* ---------- the monthly tick ---------- */
function simMonth() {
  S.month++; S.year = S.month / 12;
  const newYear = S.month % 12 === 0;
  // vault decanting
  if (S.vault > 0 && S.year >= 2 && chance(0.1 + (S.year > 12 ? 0.05 : 0))) { S.vault--; S.T[1] && (S.T[1].pop += 1); }
  for (const T of towns()) { growTown(T); stepEcon(T); buildTown(T); planTown(T); if (newYear) { planBridges(T); planFerries(T); } }
  if (S.month % 3 === 0) stepTrade();
  stepResearch();
  stepAIQueue();
  stepRoadQ();
  stepNature();
  if (chance(0.056)) rollEvent();
  if (S.drought > 0) S.drought -= 1 / 12;
  // rockets
  if (hasTech('rocketry') && S.year - S.lastLaunch > 6 && chance(.03)) {
    const pad = Object.values(S.B).find(B => B.type === 'launchpad' && B.prog >= 1);
    if (pad) {
      S.lastLaunch = S.year; S.flags.launches = (S.flags.launches || 0) + 1;
      if (S.flags.launches === 1) chron('🚀', `The first rocket leaves ${S.planet || 'the world'} from ${S.T[pad.sid].name}. The whole valley holds its breath, then cheers.`, { x: pad.x, y: pad.y, k: 'major' });
      else if (chance(.25)) chron('🚀', pick(['A supply rocket lifts off for the station.', 'Another launch. The children barely look up any more.', `A survey rocket leaves for ${S.moons ? S.moons[1] : 'the far moon'}.`]), { x: pad.x, y: pad.y });
      if (hasTech('sats')) S.sky.sats = Math.min(14, S.sky.sats + 1);
      fx('launch', { id: pad.id });
    }
  }
  if (S.sky.ring > 0 && S.sky.ring < 1) { S.sky.ring = Math.min(1, S.sky.ring + 1 / (12 * 160)); if (S.sky.ring >= 1) chron('💫', 'The Orbital Ring is complete. On clear days it arcs across the whole sky like a silver bridge.', { k: 'major' }); }
  if (newYear) {
    checkRuins();
    tryFound();
    planIntertownRoads();
    worldProjects();
    if (hasTech('rail') && chance(.3)) planRails();
    stepPeople();
    milestones();
    for (const T of towns()) if (S.year - T.lastElect > 45 && chance(.04) && S.year > 60) electAnnounce(T);
    stepRelations();
    stepCulture();
    yearlyEcon();
    for (const T of towns()) cultureProject(T);
    if (S.age) for (const T of towns()) if (T.pop > 300 && chance(.12)) ageProject(T);
    if (hasTech('domes')) for (const T of towns()) if (chance(.2)) greenFields(T);
    if (S.ageNext && S.year >= S.ageNext && !S.age) startAge();
    if (S.age && S.year >= S.age.start + S.age.len) startAge();
    recordStats();
  }
}

function recordStats() {
  const pop = totalPop();
  const row = { n: ++S.rowN, t: nowISO(), yr: yr(), era: S.age ? S.age.name : ERAS[S.era].name, pop: Math.round(pop), towns: towns().length, bld: Object.keys(S.B).length, ideas: Object.keys(S.tech.done).length, rp: Math.round(researchRate() * 10) / 10 };
  S.rows.push(row); if (S.rows.length > 800) S.rows.splice(0, S.rows.length - 800);
  S.hist.push([yr(), Math.round(pop)]);
  if (S.hist.length > 720) S.hist = S.hist.filter((_, k) => k % 2 === 0);
  UIDIRTY.stats = true;
}

/* ---------- nudges ---------- */
const COOLDOWN = { rain: 8, drop: 20, inspire: 15, starfall: 30, bloom: 10, speak: 10 }; // minutes of real time
const TOOL_INFO = {
  rain: ['Rain', 'Water the fields and end a drought'], drop: ['Supply pod', 'Drop seeds and a data crystal: research boost'],
  inspire: ['Inspire', 'A festival and a bright new mind in a town'], starfall: ['Starfall', 'A gentle meteor brings starmetal to the wilds'], bloom: ['Bloom', 'Forests, flowers and grazers spring up'], speak: ['Speak', 'Say something to your people. They will try to understand']
};
function toolReady(k) { return canAfford(k); }
function nearestTown(x, y) { let b = null, bd = 1e9; for (const T of towns()) { const d = dist(x, y, T.x, T.y); if (d < bd) { bd = d; b = T; } } return b; }
function wildTileNear(x, y, r = 5) {
  let best = null, bd = 1e9;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const i = idx(nx, ny);
    if (M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i]) continue;
    const d = Math.hypot(dx, dy) + rnd() * .5; if (d < bd) { bd = d; best = { x: nx, y: ny }; }
  }
  return best;
}
function omen(txt) {
  S.omens++;
  const f = person(S.founder);
  if (S.omens === 1) chron('✨', `${txt} ${f.died === null ? f.name : 'The elders'} say${f.died === null ? 's' : ''} someone is watching over them. They call it the Watcher.`, { k: 'major', nocap: true });
  else if (S.omens === 7) chron('✨', `${txt} There are priests of the Watcher now. They mostly argue about what the Watcher wants.`, { nocap: true });
  else if (S.omens === 15) chron('✨', `${txt} Watcher’s Day becomes a holiday. People leave sunroot cakes on high places, just in case.`, { nocap: true });
  else if (S.omens % 25 === 0) chron('✨', `${txt} Scholars count ${S.omens} signs from the Watcher since Landfall.`, { nocap: true });
  else chron('✨', txt, { nocap: true });
}
function useTool(k, x, y) {
  if (!canAfford(k) || !inb(x, y)) return false;
  const T = nearestTown(x, y), pq = prayerFor(k, x, y);
  if (k === 'rain') {
    fx('rain', { x, y, big: 1 });
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const i = idx(nx, ny); if (!M.water[i] && M.fert[i] < 4) M.fert[i]++; }
    const ended = S.drought > 0; S.drought = 0;
    if (T && dist(x, y, T.x, T.y) < 12) T.pop *= 1.01;
    omen(ended ? `Rain falls from a clear sky and the dry spell breaks.` : `Rain falls out of a clear sky over ${T ? T.name : 'the valley'}.`);
  } else if (k === 'drop') {
    const s = wildTileNear(x, y, 6) || { x, y };
    fx('drop', { x: s.x, y: s.y });
    S.tech.pts += techCost(Math.min(S.tech.cur, TECHS.length - 1)) * 0.35; S.boost = Math.max(S.boost, 2);
    if (T) T.pop += 3;
    omen(`A gift pod falls near ${T ? T.name : 'the valley'}. Inside: seeds, tools, and a data crystal the Archive can read.`);
  } else if (k === 'inspire') {
    if (!T) return false;
    fx('fireworks', { x: T.x, y: T.y }); fx('sparkle', { x: T.x, y: T.y });
    const cps = living().filter(q => q.sid === T.id && q.sp && S.P[q.sp] && S.P[q.sp].died === null && age(q) < 50);
    const pp = pq && S.P[pq.pid], a = pp && pp.sp && S.P[pp.sp] && S.P[pp.sp].died === null ? pp : cps.length ? pick(cps) : null;
    const p = addPerson('child', T.id, 0, a ? { parents: [a, S.P[a.sp]] } : {}); p.life += 10; p.st.cur = Math.min(10, p.st.cur + 3); p.q.tag = 'Born under the Watcher’s light';
    S.boost = Math.max(S.boost, 4); T.pop *= 1.02;
    omen(`A light hangs over ${T.name} all night. A child is born there at dawn: ${p.name}${a ? `, to ${a.first} and ${S.P[a.sp].first}` : ''}, who will be very clever indeed.`);
  } else if (k === 'starfall') {
    const s = wildTileNear(x, y, 7); if (!s) return false;
    const i = idx(s.x, s.y);
    fx('meteor', { x: s.x, y: s.y });
    setTimeout(() => { if (!S) return; M.tree[i] = 0; M.bio[i] = BIO.ROCK; M.ore[i] = 1; M.fert[i] = 0; M.wild[i] = 2; markDirty(i); }, FAST ? 0 : 2600);
    S.tech.pts += techCost(Math.min(S.tech.cur, TECHS.length - 1)) * 0.15;
    omen(`A star falls gently into the wilds${T ? ' near ' + T.name : ''}. The crater is full of strange bright metal.`);
  } else if (k === 'bloom') {
    fx('sparkle', { x, y }); fx('herd', { x, y });
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || Math.hypot(dx, dy) > 3.3) continue; const i = idx(nx, ny);
      if (M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i] || M.bio[i] === BIO.SNOW) continue;
      if (M.bio[i] === BIO.BARREN || M.bio[i] === BIO.SAND && chance(.3)) M.bio[i] = BIO.MEADOW;
      if (chance(.55)) { M.tree[i] = Math.min(3, M.tree[i] + 1 + (chance(.4) ? 1 : 0)); M.ttype[i] = M.ttype[i] || pick([1, 1, 3, 2]); }
      M.fert[i] = Math.min(4, M.fert[i] + 1);
      markDirty(i);
    }
    omen(`Overnight, the land ${T ? 'near ' + T.name : ''} bursts into bloom. Nobody planted it.`);
  }
  spendRev(k);
  if (pq) answered(pq);
  UIDIRTY.tools = true;
  return true;
}

const UIDIRTY = { chron: true, stats: true, tools: true, lore: true, people: true, voice: true };
