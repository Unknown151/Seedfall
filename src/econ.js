/* ============================== economy: what the towns are built from ============================== */
// Every town keeps a small stockpile of timber, stone, clay, metal and goods. Woodcutters, quarries, clay pits
// and mines fill it from whatever grows and lies around the town; building draws it down again. A town
// without much forest builds in stone or brick instead. Running short slows building down, it never stops it.
const RES = ['wood', 'stone', 'clay', 'metal', 'goods'];
const RES_N = { wood: 'timber', stone: 'stone', clay: 'clay', metal: 'metal', goods: 'goods' };
const RES_IC = { wood: '🪵', stone: '🪨', clay: '🧱', metal: '⚙️', goods: '📦' };
const RES_TECH = { wood: null, stone: 'stone', clay: 'kiln', metal: 'smelt', goods: 'smelt' };
const RES_COL = { wood: '#a0714a', stone: '#9aa0aa', clay: '#c0674c', metal: '#5f6b7a', goods: '#d2a24c' };
const EXTRACT = { lumber: 'wood', quarry: 'stone', claypit: 'clay', mine: 'metal' };
// out: what one good site yields in a year
const EX_INFO = {
  lumber: { tech: 'shelter', min: 8, per: 450, max: 3, site: 'forest', out: 5 },
  quarry: { tech: 'stone', min: 24, per: 900, max: 2, site: 'rock', out: 5 },
  claypit: { tech: 'kiln', min: 24, per: 900, max: 2, site: 'clay', out: 4.5 },
  mine: { tech: 'smelt', min: 60, per: 1200, max: 2, site: 'ore', out: 3.5 }
};
const MAKERS = { workshop: 2, works: 5, power: 2, fusion: 6 }; // goods a year (fusion also makes metal)
// what a building looks like it is made of, blended with the style of its era
const MAT = {
  wood: { res: 'wood', wall: '#b88a5f', roof: '#8a6446', n: 'timber' },
  stone: { res: 'stone', wall: '#d3ccbf', roof: '#747b87', n: 'stone' },
  adobe: { res: 'clay', wall: '#e3c79c', roof: '#c9996a', n: 'adobe' },
  brick: { res: 'clay', wall: '#b8684f', roof: '#93503f', n: 'brick' }
};
const MAT_TYPES = { well: 1, granary: 1, shrine: 1, dock: 1, market: 1, school: 1, workshop: 1, mill: 1, hall: 1, library: 1, observatory: 1, clinic: 1, station: 1, works: 1 };
const MAT_ERA = [{ wood: 1.3 }, { wood: 1.3, adobe: 1.1 }, { stone: 1.2, adobe: 1.1 }, { stone: 1.3 }, { brick: 1.4 }, { brick: 1.1, stone: 1.1 }];
const HCOST = [0, 4, 7, 11, 16];
const HEAVY = { workshop: 1, works: 1, station: 1, power: 1, turbine: 1, mast: 1, airfield: 1, antenna: 1, solar: 1, fusion: 1, launchpad: 1, elevator: 1, terraformer: 1, vfarm: 1, dome: 1, stadium: 1, university: 1, mine: 1 };
const SHORT = .35; // how fast a building goes up with nothing in the stockpile
const LV_MAT = { timber: 'wood', stone: 'stone', brick: 'brick' };

const resOpen = r => !RES_TECH[r] || hasTech(RES_TECH[r]);
function laborOf(T) {
  if (S.year < 3) return .45; // one colonist
  const mult = 1 + (hasTech('wheel') ? .3 : 0) + (hasTech('steam') ? .6 : 0) + (hasTech('electric') ? .6 : 0) + (hasTech('computing') ? .5 : 0) + (hasTech('fusion') ? 1 : 0);
  return (0.7 + Math.sqrt(T.pop) * 0.55) * mult;
}
const econCap = T => Math.round(30 + Math.sqrt(T.pop) * 2);   // how much the yards and stores hold
const econLow = T => econCap(T) * .3;
const toolsK = () => 1 + (hasTech('smelt') ? .25 : 0) + (hasTech('steam') ? .3 : 0) + (hasTech('electric') ? .25 : 0) + (hasTech('fusion') ? .2 : 0);

function ensureEcon(T) {
  if (T.res) return;
  T.res = {}; T.short = {}; T.flow = {}; T.exp = {}; T.use = {};
  const cap = econCap(T);
  for (const r of RES) T.res[r] = S.year < 1 ? (r === 'wood' ? 10 : r === 'metal' ? 6 : 0) : resOpen(r) ? cap * .6 : 0;
  T.pot = townPotential(T);
}
// settlers take a share of the old town's stores with them
function econFound(T, P) {
  ensureEcon(P); T.res = {}; T.short = {}; T.flow = {}; T.exp = {}; T.use = {};
  for (const r of RES) { const n = P.res[r] * .25; P.res[r] -= n; T.res[r] = n + (r === 'wood' ? 6 : 0); }
  T.pot = townPotential(T);
}

/* ---------- what the land around a town offers (0..1 each) ---------- */
const rocky = i => { const b = M.bio[i]; return !M.water[i] && (b === BIO.ROCK || b === BIO.HIGH || M.elev[i] >= 7); };
const clayey = i => { if (M.water[i]) return false; if (M.bio[i] === BIO.SAND) return true; const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) { const j = idx(nx, ny); if (M.water[j] === 2 || M.bio[j] === BIO.FRESH) return true; } } return false; };
function around(x, y, r, fn) { let n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) n += fn(idx(nx, ny)); } return n; }
function townPotential(T) {
  const R = Math.ceil(townRadius(T) + 6), p = { wood: 0, stone: 0, clay: 0, metal: 0 };
  for (let y = Math.max(0, T.y - R); y <= Math.min(H - 1, T.y + R); y++) for (let x = Math.max(0, T.x - R); x <= Math.min(W - 1, T.x + R); x++) {
    if ((x - T.x) ** 2 + (y - T.y) ** 2 > R * R) continue;
    const i = idx(x, y);
    if (M.tree[i] && !M.bld[i]) p.wood += M.tree[i];
    if (rocky(i)) p.stone++;
    if (M.ore[i]) p.metal++;
    if (clayey(i)) p.clay++;
  }
  return { wood: Math.min(1, p.wood / 45), stone: Math.min(1, p.stone / 14), clay: Math.min(1, p.clay / 12), metal: Math.min(1, p.metal / 4) };
}
// how good one extraction site is (0..1)
function siteEff(B) {
  const { x, y } = B;
  switch (B.type) {
    case 'lumber': return clamp(around(x, y, 3, i => M.bld[i] ? 0 : M.tree[i]) / 16, .12, 1);
    case 'quarry': return clamp(around(x, y, 2, i => rocky(i) ? 1 : 0) / 7, .35, 1);
    case 'claypit': return clamp(around(x, y, 2, i => clayey(i) ? 1 : 0) / 6, .35, 1);
    case 'mine': return .45 + .55 * Math.min(1, around(x, y, 2, i => M.ore[i] ? 1 : 0) / 2);
  }
  return 1;
}

/* ---------- per-town cache of the buildings that make things (not saved) ---------- */
const ECX = {};
function econDirty(T) { if (T && ECX[T.id]) ECX[T.id].m = -1e9; }
function econCache(T) {
  let e = ECX[T.id];
  if (e && e.S === S && e.m <= S.month && S.month - e.m < 12) return e;
  e = ECX[T.id] = { S, m: S.month, ex: [], n: {} };
  for (const id of T.bl) {
    const B = S.B[id]; if (!B) continue;
    if (EXTRACT[B.type] || MAKERS[B.type]) { e.n[B.type] = (e.n[B.type] || 0) + 1; if (B.prog >= 1) e.ex.push(B.id); }
  }
  for (const id of e.ex) { const B = S.B[id]; if (EXTRACT[B.type]) B.ef = Math.round(siteEff(B) * 100) / 100; }
  T.pot = townPotential(T);
  // the town grew over the woods: the woodcutters pack up, and will set up again at the new forest edge
  const gone = e.ex.map(id => S.B[id]).find(B => B.type === 'lumber' && B.ef <= .22 && S.year - B.built > 15);
  if (gone && T.pot.wood >= .2) {
    removeBuilding(gone); e.m = -1e9;
    if (S.year - (S.econYr || -99) > 20 && chance(.5)) { S.econYr = S.year; chron('🪵', `The woodcutters of ${T.name} pack up their camp and move out to the new edge of the forest.`, { x: gone.x, y: gone.y }); }
  }
  return e;
}

/* ---------- materials ---------- */
function matEligible(type, tier) { return type === 'house' ? tier >= 1 && tier <= 4 : !!MAT_TYPES[type] && !hasTech('concrete'); }
function matOptions() { const o = ['wood']; if (hasTech('stone')) o.push('stone'); if (hasTech('kiln')) o.push(hasTech('brick') ? 'brick' : 'adobe'); return o; }
function matCost(type, tier) { return type === 'house' ? HCOST[tier] || 0 : Math.round((BT[type] ? BT[type].work : 8) * .45); }
function chooseMat(T, type, tier, keep) {
  const opts = matOptions(); if (opts.length === 1) return opts[0];
  const cost = matCost(type, tier), aff = MAT_ERA[Math.min(S.era, MAT_ERA.length - 1)], lv = lever('material'), want = LV_MAT[lv], loc = lv === 'local' ? 2.5 : 1;
  const ws = [];
  for (const m of opts) {
    const r = MAT[m].res;
    let w = ((T.flow[r] || 0) * 12 * loc + Math.min(T.res[r], cost * 4) * .15 + .4) / (cost * .5 + 1); // mostly: what the land around gives
    w *= aff[m] || 1;
    if (type === 'house' && tier === 1 && m === 'stone') w *= .7;
    if (type === 'house' && tier >= 3 && m === 'wood') w *= .75;
    if (T.mpref === m) w *= 1.25;   // a town keeps its look
    if (keep === m) w *= 1.6;       // rebuilding in the same material
    if (want && (want === m || (want === 'brick' && m === 'adobe'))) w *= 4;
    ws.push([m, w * w]);
  }
  return wpick(ws);
}
function costOf(B) {
  const t = B.up != null ? B.up : B.tier, k = B.up != null ? .75 : 1, c = {};
  const add = (r, n) => { if (n > 0) c[r] = Math.round(((c[r] || 0) + n * k) * 10) / 10; };
  switch (B.type) {
    case 'house':
      if (t >= 1 && t <= 4) { add(MAT[B.mat || 'wood'].res, HCOST[t]); if (t >= 3) add('metal', t - 2); if (t >= 4) add('goods', 1); }
      else if (t === 5) { add('stone', 14); add('metal', 6); add('goods', 4); }
      else if (t === 6) { add('stone', 18); add('metal', 18); add('goods', 10); }
      else if (t >= 7) { add('stone', 36); add('metal', 44); add('goods', 26); }
      return c;
    case 'pod': case 'plaza': return c;
    case 'farm': add('wood', 1); return c;
    case 'lumber': add('wood', 2); return c;
    case 'quarry': case 'claypit': add('wood', 3); return c;
  }
  const w = BT[B.type] ? BT[B.type].work : 8, main = w * .45;
  if (B.mat) add(MAT[B.mat].res, main);
  else if (B.type === 'monument' || B.type === 'watchstone' || B.type === 'park') add('stone', main * (B.type === 'park' ? .3 : 1));
  else if (hasTech('concrete')) { add('stone', main * .6); add('metal', main * .25); add('goods', main * .15); }
  else add(hasTech('stone') ? 'stone' : 'wood', main);
  if (HEAVY[B.type] && hasTech('smelt')) add('metal', w * .12);
  return c;
}
// called by mkBuilding / tryUpgrade
function econNewBuilding(B, T) {
  ensureEcon(T);
  if (B.type === 'house' ? B.tier >= 1 && B.tier <= 4 : matEligible(B.type, 0)) B.mat = chooseMat(T, B.type, B.tier);
  if (B.prog < 1) B.cost = costOf(B);
  if (EXTRACT[B.type] || MAKERS[B.type]) econDirty(T);
}
function econUpgrade(B, T) {
  ensureEcon(T);
  if (matEligible('house', B.up)) B.mat = chooseMat(T, 'house', B.up, B.mat); else delete B.mat;
  B.cost = costOf(B);
}
function econComplete(B, T) {
  delete B.cost; delete B.sw;
  if (EXTRACT[B.type] || MAKERS[B.type]) econDirty(T);
  if (B.mat && B.type === 'house') {
    const mc = T.mc = T.mc || {};
    for (const k in mc) mc[k] *= .92;
    mc[B.mat] = (mc[B.mat] || 0) + 1;
    let best = null; for (const k in mc) if (!best || mc[k] > mc[best]) best = k;
    if (best !== T.mpref && (!T.mpref || mc[best] > (mc[T.mpref] || 0) * 1.3)) {
      const was = T.mpref; T.mpref = best;
      if (was && S.year - (T.matYr || -99) > 150 && mc[best] > 5 && S.year - (S.econYr || -99) > 12) { S.econYr = S.year; T.matYr = S.year; chron(RES_IC[MAT[best].res], pick([`${T.name} is becoming a town of ${MAT[best].n}.`, `Most new houses in ${T.name} are ${MAT[best].n} now, not ${MAT[was].n}.`]), { T }); }
    }
  }
}
// pay for a month's work on B. Returns how much of the work could actually be done (SHORT..1)
function payFor(T, B, dp) {
  if (!T.res || dp <= 0) return 1;
  const c = B.cost || (B.cost = costOf(B));
  let f = 1, lack = null;
  for (const r in c) { const need = c[r] * dp; if (need > 0 && T.res[r] < need) { const g = Math.max(SHORT, T.res[r] / need); if (g < f) { f = g; lack = r; } } }
  if (lack && B.mat && MAT[B.mat].res === lack && B.prog < .3 && !B.sw && switchMat(T, B)) return payFor(T, B, dp);
  const u = T.um || (T.um = {});
  for (const r in c) { const n = Math.min(T.res[r], c[r] * dp * f); T.res[r] -= n; u[r] = (u[r] || 0) + n; }
  if (lack) T.short[lack] = (T.short[lack] || 0) + 1;
  return f;
}
// out of timber before the walls are up: build it in something else
function switchMat(T, B) {
  const t = B.up != null ? B.up : B.tier, need = matCost(B.type, t) * (1 - B.prog);
  let best = null, bh = need;
  for (const m of matOptions()) { if (m === B.mat) continue; const h = T.res[MAT[m].res]; if (h > bh) { bh = h; best = m; } }
  B.sw = 1;
  if (!best) return false;
  const was = B.mat; B.mat = best; B.cost = costOf(B); markDirty(idx(B.x, B.y));
  if (B.type === 'house' && S.year - (T.swYr || -99) > 80 && S.year - (S.econYr || -99) > 12) { T.swYr = S.econYr = S.year; chron(RES_IC[MAT[best].res], `${RES_N[MAT[was].res][0].toUpperCase() + RES_N[MAT[was].res].slice(1)} runs short in ${T.name}, so the new houses go up in ${MAT[best].n} instead.`, { x: B.x, y: B.y }); }
  return true;
}

/* ---------- the monthly round: gather, cut, dig, make ---------- */
function stepEcon(T) {
  ensureEcon(T);
  const e = econCache(T), p = T.pot, tk = toolsK(), fl = { wood: 0, stone: 0, clay: 0, metal: 0, goods: 0 };
  // people gathering what lies about (per year)
  const g = 1 + Math.sqrt(T.pop) / 25;
  fl.wood += 1.2 * p.wood * g;
  if (resOpen('stone')) fl.stone += .6 * p.stone * g;
  if (resOpen('clay')) fl.clay += .5 * p.clay * g;
  if (resOpen('metal')) { fl.metal += .25 * (.3 + p.metal) * g; fl.goods += .3 * g; }
  const nat = lever('nature');
  for (const id of e.ex) {
    const B = S.B[id]; if (!B || B.prog < 1) continue;
    const ex = EX_INFO[B.type];
    if (ex) {
      let out = ex.out * tk * (B.ef || .5);
      if (B.type === 'lumber') { if (nat === 'protect' || nat === 'wild') out *= .6; tendForest(B, nat); }
      fl[EXTRACT[B.type]] += out;
      if (B.type === 'mine') fl.stone += out * .4;
    } else {
      const o = MAKERS[B.type] * tk;
      fl.goods += o; if (B.type === 'fusion') fl.metal += o;
    }
  }
  const cap = econCap(T), um = T.um || {}; T.use = T.use || {};
  for (const r of RES) {
    T.use[r] = (T.use[r] || 0) * .92 + (um[r] || 0) * 12 * .08; // what building eats, per year (smoothed)
    T.flow[r] = Math.round(fl[r] * 100) / 100;                   // per year
    T.res[r] = Math.min(cap, T.res[r] + fl[r] / 12);
    if (T.short[r]) { T.short[r] *= .9; if (T.short[r] < .05) delete T.short[r]; }
  }
  T.um = {};
}
// woodcutters fell a tree now and then, and plant and tend saplings
function tendForest(B, nat) {
  const chop = nat === 'clear' ? .6 : nat === 'protect' || nat === 'wild' ? .08 : .2, plant = nat === 'clear' ? .05 : nat === 'protect' || nat === 'plant' || nat === 'wild' ? .3 : .16;
  const spot = () => { const x = B.x + ri(-3, 3), y = B.y + ri(-3, 3); return inb(x, y) && (x !== B.x || y !== B.y) ? idx(x, y) : -1; };
  if (chance(chop)) for (let k = 0; k < 6; k++) {
    const i = spot(); if (i < 0 || !M.tree[i] || M.bld[i] || M.road[i]) continue;
    M.tree[i]--; if (!M.tree[i]) M.wild[i] = 3; markDirty(i); break;
  }
  if (chance(plant)) for (let k = 0; k < 6; k++) {
    const i = spot(); if (i < 0 || M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i]) continue;
    const b = M.bio[i]; if (b !== BIO.MEADOW && b !== BIO.LUSH && b !== BIO.HIGH) continue;
    if (M.tree[i] && M.tree[i] < 3) { M.tree[i]++; markDirty(i); break; }
    if (!M.tree[i] && !isStreet(i % W, (i / W) | 0)) { M.tree[i] = 1; M.ttype[i] = b === BIO.HIGH ? 2 : chance(.8) ? 1 : 2; M.wild[i] = 0; markDirty(i); break; }
  }
}

/* ---------- a town decides it needs a woodcutter, quarry, clay pit or mine ---------- */
function tryEcon(T) {
  ensureEcon(T);
  const e = econCache(T), lo = econLow(T);
  for (const k of shuffle(Object.keys(EX_INFO))) {
    const ex = EX_INFO[k], r = EXTRACT[k];
    if (!hasTech(ex.tech) || T.pop < ex.min) continue;
    if (CULT.shun && (CULT.shun[k] || 0) >= .3) continue;
    const have = e.n[k] || 0, maxN = Math.min(ex.max, 1 + Math.floor((T.pop - ex.min) / ex.per));
    if (have >= maxN) continue;
    const pref = LV_MAT[lever('material')], pr = pref && MAT[pref] ? MAT[pref].res : null;
    if (have > 0 && T.res[r] > lo && !(T.short[r] > 2) && r !== pr) continue; // well supplied already
    if (T.pot[r] < (k === 'mine' ? .2 : .1)) continue;
    const s = findSite(T, ex.site); if (!s) continue;
    const B = mkBuilding(k, s.x, s.y, T); connectRoad(B);
    return true;
  }
  return false;
}

/* ---------- trade: linked towns send what they have plenty of to those that are short ---------- */
// towns trade by road (once there are wheels) or by sea (once both have a harbour)
const roadLinked = (A, B) => hasTech('wheel') && A.linked && B.linked;
function stepTrade() {
  const ts = towns().filter(T => T.res); if (ts.length < 2) return;
  const moves = [];
  for (const r of RES) {
    if (!resOpen(r)) continue;
    const need = ts.map(T => [T, econCap(T) * .4 - T.res[r] + (T.short[r] || 0) * 2]).filter(a => a[1] > 3 && (T => T.res[r] < econLow(T) || T.short[r] > 1)(a[0])).sort((a, b) => b[1] - a[1]);
    if (!need.length) continue;
    const [B, def] = need[0];
    const rich = ts.filter(A => A !== B && (roadLinked(A, B) || seaLinked(A, B))).map(T => [T, T.res[r] - econCap(T) * .55]).filter(a => a[1] > 0).sort((a, b) => b[1] - a[1]);
    if (!rich.length) continue;
    const [A, sur] = rich[0];
    const n = Math.min(sur, def, 30); if (n < 3) continue;
    A.res[r] -= n; B.res[r] += n;
    A.exp[r] = (A.exp[r] || 0) + n;
    moves.push([A, B, r, n]);
  }
  if (!moves.length) return;
  S.trade = S.trade || { n: 0, log: [] };
  for (const [A, B, r, n] of moves) {
    S.trade.n++; S.trade.log.push({ a: A.id, b: B.id, r, n: Math.round(n), y: yr() });
    const sea = seaLinked(A, B) && (!roadLinked(A, B) || chance(.5));
    fx('trade', { from: A.id, to: B.id, r, sea });
    if (S.trade.n === 1) chron('🛒', `The first trade ${sea ? 'ship sails' : 'wagons roll'} from ${A.name} to ${B.name}, loaded with ${RES_N[r]}.`, { T: B, k: 'major', cap: 'The first trade' });
    else if (chance(.02) && S.year - (S.tradeYr || -99) > 30) S.tradeYr = S.year, chron('🛒', pick([`Wagons of ${RES_N[r]} rumble from ${A.name} to ${B.name}.`, `${B.name} buys ${RES_N[r]} from ${A.name}, and pays in ${pick(['sunroot beer', 'wool', 'promises', 'coin', 'favours'])}.`]), { T: A });
  }
  if (S.trade.log.length > 60) S.trade.log.splice(0, S.trade.log.length - 60);
}
const KNOWN_FOR = { wood: ['its timber', 'its woodcutters'], stone: ['its quarries', 'its stonemasons'], clay: ['its bricks', 'its potters'], metal: ['its iron', 'its smiths'], goods: ['its workshops', 'the things it makes'] };
function yearlyEcon() {
  // the Watcher asked for another material: a few old houses a year get rebuilt in it
  const want = LV_MAT[lever('material')];
  if (want) for (const T of towns()) {
    if (!T.res || !chance(.7)) continue;
    const m = want === 'brick' && !hasTech('brick') ? (hasTech('kiln') ? 'adobe' : null) : want === 'stone' && !hasTech('stone') ? null : want;
    if (!m) continue;
    const r = MAT[m].res;
    for (let k = 0; k < 3; k++) {
      const B = S.B[pick(T.bl)]; if (!B || B.type !== 'house' || B.prog < 1 || B.tier < 1 || B.tier > 4 || B.mat === m) continue;
      const c = HCOST[B.tier] * .6; if (T.res[r] < c) break;
      T.res[r] -= c; B.mat = m; B.built = yr(); markDirty(idx(B.x, B.y));
    }
  }
  for (const T of towns()) {
    if (!T.res) continue;
    T.known = T.known || {};
    if (Object.keys(T.known).length >= 2 || S.year - (T.knownYr || -99) < 150) continue;
    for (const r of RES) {
      if (T.known[r] || (T.exp[r] || 0) < 120 || towns().some(O => O !== T && (O.exp && O.exp[r] || 0) > T.exp[r])) continue; // the valley's biggest supplier
      T.known[r] = T.knownYr = yr();
      chron(RES_IC[r], `${T.name} is known across the valley now for ${pick(KNOWN_FOR[r])}.`, { T });
      break;
    }
  }
}

/* ---------- read-outs for the panel and tooltips ---------- */
function townSectors(T) {
  const s = { farming: 0, crafts: 0, industry: 0, learning: 0, faith: 0, trade: 0 };
  const K = { farm: ['farming', 1], vfarm: ['farming', 6], dock: ['farming', 1], granary: ['farming', 1], dome: ['farming', 4], mill: ['farming', 1],
    lumber: ['crafts', 1.5], quarry: ['crafts', 1.5], claypit: ['crafts', 1.5], workshop: ['crafts', 2], mine: ['industry', 2], works: ['industry', 3], power: ['industry', 3], fusion: ['industry', 5], turbine: ['industry', 1], solar: ['industry', 1],
    school: ['learning', 1.5], library: ['learning', 3], university: ['learning', 5], observatory: ['learning', 2], museum: ['learning', 2], antenna: ['learning', 1],
    shrine: ['faith', 2], monument: ['faith', 3], watchstone: ['faith', 3], market: ['trade', 2], station: ['trade', 2], airfield: ['trade', 2], hall: ['trade', 1], harbor: ['trade', 4], lighthouse: ['trade', 1], dock: ['farming', 1] };
  for (const id of T.bl) { const B = S.B[id]; if (!B || B.prog < 1) continue; const k = K[B.type]; if (k) s[k[0]] += k[1]; }
  s.trade += Object.values(T.exp || {}).reduce((a, b) => a + b, 0) / 400;
  const tot = Object.values(s).reduce((a, b) => a + b, 0) || 1;
  for (const k in s) s[k] /= tot;
  return s;
}
function townMats(T) {
  const n = {}; let t = 0;
  for (const id of T.bl) { const B = S.B[id]; if (!B || B.type !== 'house' || B.prog < 1) continue; const m = B.mat || (B.tier >= 5 ? 'modern' : B.tier === 0 ? 'foil' : 'old'); n[m] = (n[m] || 0) + 1; t++; }
  return [n, t];
}
function townEconBrief(T) {
  if (!T.res) return '';
  const [n] = townMats(T), m = Object.keys(n).filter(k => MAT[k]).sort((a, b) => n[b] - n[a])[0];
  const kn = T.known ? Object.keys(T.known) : [], sh = RES.filter(r => T.short[r] > 1.5);
  return (m ? `, houses mostly ${MAT[m].n}` : '') + (kn.length ? `, known for ${kn.map(r => KNOWN_FOR[r][0]).join(' and ')}` : '') + (sh.length ? `, short of ${sh.map(r => RES_N[r]).join(' and ')}` : '');
}
function econSummary() {
  const o = {};
  for (const T of towns()) { if (!T.res) continue; const [mn] = townMats(T); o[T.name.slice(0, 10)] = { r: RES.map(r => Math.round(T.res[r])).join('/'), f: RES.map(r => (T.flow[r] || 0).toFixed(1)).join('/'), u: RES.map(r => ((T.use || {})[r] || 0).toFixed(1)).join('/'), c: econCap(T), sh: Object.keys(T.short).filter(r => T.short[r] > 1).join(','), m: Object.entries(mn).map(([k, v]) => k[0] + v).join(' ') }; }
  return o;
}
