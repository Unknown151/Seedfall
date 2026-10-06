/* ============================== out on the water: what towns build at sea ============================== */
// Coastal towns use the sea more as the ages go by: oyster beds and fish weirs in the shallows, salt pans on the shore,
// a pleasure pier, a desalination plant, oil rigs out at sea (taken down when fusion comes, all but one left as a reef),
// offshore wind parks, fish farms, wave power, floating solar, kelp farms, seasteads and a launch platform at sea.
// Sites: `seaSite(T, kind)`. A tile in the water is only used if ships can still get round it (`seaSimple`: its free
// neighbours stay in one piece, and nothing else at sea stands right next to it), so the shipping lanes never close.
// Lakes get only the small things (oysters become a fish weir there, fish farms and floating solar). The sim part is here;
// the models and what moves on them are in seamodels.js.
const SEA_T = { oysters: 1, fishfarm: 1, wavefarm: 1, floatsolar: 1, kelp: 1, oilrig: 1, reef: 1, windpark: 1, seastead: 1, sealaunch: 1 }; // stand in the water
const SEA_FOOD = { oysters: 6, saltpan: 5, fishfarm: 30, kelp: 50 };
const SEA_HOUSE = { seastead: 300 };
const SL_DECK = .16; // the launch platform's deck over the water (the rocket stands and lifts off there: fx3d.js)
Object.assign(HEAVY, { oilrig: 1, windpark: 1, desal: 1, sealaunch: 1, seastead: 1, wavefarm: 1, floatsolar: 1 });
Object.assign(FIRST_TXT, {
  oysters: 'Stakes go into the shallows off {T}: oyster beds, and a wattle weir that catches the fish on the ebb.',
  saltpan: 'Salt pans are dug on the shore at {T}. The sea comes in, the sun takes the water, and the salt stays behind.',
  seapier: '{T} opens a pleasure pier: a bandstand at the end, ices halfway, and a penny to walk out over the sea.',
  desal: 'A desalination plant opens at {T}. Seawater in one end, drinking water out of the other.',
  oilrig: 'An oil rig stands up out of the sea off {T}. At night its flare can be seen from every window.',
  windpark: 'The first offshore wind turbine turns off {T}. Fishermen say it hums in a fog.',
  fishfarm: 'A fish farm is moored off {T}: round pens of net, a feed barge, and gulls that think it is Christmas.',
  wavefarm: 'Wave power comes to {T}: long jointed floats that bend over the swell and make power from it.',
  floatsolar: 'Solar glass floats on the water off {T}, rafts of it, tilted to the sun.',
  kelp: 'A kelp farm is laid out off {T}. Lines of buoys, and a forest growing underneath them.',
  seastead: 'The first seastead is towed out and anchored off {T}: a floating neighbourhood, gardens and all.',
  sealaunch: 'A launch platform is anchored far out at sea off {T}. Rockets can go up now without shaking anyone’s teacups.'
});

/* ---------- how far each water tile is from the shore (N8 steps; cached per world) ---------- */
let SEAD = null;
function coastDist() {
  if (SEAD && SEAD.S === S) return SEAD.d;
  const d = new Uint8Array(W * H).fill(99), q = [];
  for (let i = 0; i < W * H; i++) if (M.water[i] !== 1) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); } } }
  SEAD = { S, d }; return d;
}
const isSea = i => M.water[i] === 1 && M.bio[i] === BIO.SEA;
const seaBlocked = i => M.water[i] !== 1 || M.road[i] || M.rail[i] || (M.bld[i] && S.B[M.bld[i]]); // what ships can't sail through
// a tile ships can do without: its free neighbours are all one run round it, and nothing else stands next to it in the water
function seaSimple(i, extra) {
  const x = i % W, y = (i / W) | 0, ring = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];
  let runs = 0, prev = null, first = null, free = 0;
  for (const [dx, dy] of ring) {
    const nx = x + dx, ny = y + dy, j = inb(nx, ny) ? idx(nx, ny) : -1;
    if (j >= 0 && M.bld[j] && SEA_T[(S.B[M.bld[j]] || {}).type]) return false; // (nothing at sea right next to it)
    const f = j >= 0 && !seaBlocked(j) && !(extra && extra.has(j)); if (f) free++;
    if (first === null) first = f; if (f && prev === false) runs++; prev = f;
  }
  if (first && prev === false) runs++; if (free === 8) return true;
  return free >= 3 && runs === 1;
}
// keep clear of the harbours' approaches, the piers and the ferries
function seaClear(i) {
  const x = i % W, y = (i / W) | 0;
  for (const B of harbours()) for (let k = 0; k < berths(B); k++) { const b = berthTile(B, k); if (dist(x, y, b % W, (b / W) | 0) < 3.5) return false; }
  for (const id in S.B) { const B = S.B[id]; if ((B.type === 'dock' || B.type === 'shipyard' || B.type === 'lighthouse') && dist(x, y, B.x, B.y) < 2.5) return false; }
  for (const f of S.ferries || []) for (let k = 0; k <= f.len + 1; k++) if (dist(x, y, f.a % W + f.dir[0] * k, ((f.a / W) | 0) + f.dir[1] * k) < 2) return false;
  return true;
}
const seaTown = T => { const d = coastDist(), R = Math.ceil(townRadius(T) + 3); for (let y = Math.max(0, T.y - R); y <= Math.min(H - 1, T.y + R); y++) for (let x = Math.max(0, T.x - R); x <= Math.min(W - 1, T.x + R); x++) { const i = idx(x, y); if (isSea(i) && bigWater(i) && d[i] <= 2) return true; } return false; };
// kinds: shore (in the water by the shore), off (out at sea), coast (dry land on the shore); o: { d0, d1 (shore distance), sea (salt water only), lake (prefer lakes), near (a type to cluster round) }
function seaSite(T, kind, o = {}) {
  const d = coastDist(), R = Math.ceil(townRadius(T) + (kind === 'off' ? 9 : 5)), ts = towns();
  const near = o.near ? T.bl.map(id => S.B[id]).filter(B => B && B.type === o.near) : [];
  let best = null, bs = -1e9;
  for (let y = Math.max(1, T.y - R); y <= Math.min(H - 2, T.y + R); y++) for (let x = Math.max(1, T.x - R); x <= Math.min(W - 2, T.x + R); x++) {
    const i = idx(x, y), dt = dist(x, y, T.x, T.y); if (dt > R) continue;
    if (ts.some(U => U !== T && dist(x, y, U.x, U.y) < dt)) continue; // (another town's water)
    let s = -dt * .5 + rnd() * 1.5;
    if (kind === 'coast') {
      if (M.water[i] || M.road[i] || M.plan[i] || M.rail[i] || M.ruin[i] || springAt(i) || M.elev[i] > 3) continue;
      if (M.bld[i]) { if (!o.yield || !seaYield(i)) continue; s -= 2; } // (the shore is often all fields and cottages by now: they give way to a pier or a plant)
      let wn = 0; for (const [dx, dy] of N4) { const j = idx(x + dx, y + dy); if (isSea(j) && bigWater(j)) wn++; } if (!wn) continue;
      if (o.out) { const dir = seaOut(x, y, o.out); if (!dir) continue; s += 2; }
      if (o.sand && M.bio[i] === BIO.SAND) s += 3;
      if (o.flat) { let fl = 0; for (const [dx, dy] of N4) { const j = idx(x + dx, y + dy); if (!M.water[j] && M.elev[j] === M.elev[i]) fl++; } s += fl; }
      if (!seaClear(i)) continue;
    } else {
      if (!bigWater(i) || M.bld[i] || M.road[i] || M.rail[i]) continue;
      if ((kind === 'off' || o.sea) && !isSea(i)) continue;
      const dd = d[i], d0 = o.d0 != null ? o.d0 : kind === 'off' ? 3 : 1, d1 = o.d1 != null ? o.d1 : kind === 'off' ? 8 : 2;
      if (dd < d0 || dd > d1) continue;
      if (!seaSimple(i) || !seaClear(i)) continue;
      if (o.lake && !isSea(i)) s += 4;
      if (o.grid && ((x | 0) % 2 || (y | 0) % 2)) s -= 3; // (wind parks in tidy rows)
      if (near.length) { const nd = Math.min(...near.map(B => dist(x, y, B.x, B.y))); s += nd < 1.5 ? -99 : -nd * 1.2 + 8; }
    }
    if (s > bs) { bs = s; best = { x, y }; }
  }
  return best;
}
// what gives way on the shore: a field, a pasture, a small house (the town builds them again elsewhere)
function seaYield(i) { const B = S.B[M.bld[i]]; return !!B && !fpBig(B) && B.prog >= 1 && (B.type === 'farm' || B.type === 'pasture' || B.type === 'house' && B.tier <= 3 && B.up == null); }
// from a shore tile: a way straight out with n tiles of free water (a pier)
function seaOut(x, y, n) {
  for (const [dx, dy] of N4) { let ok = true; for (let k = 1; k <= n + 1 && ok; k++) { const nx = x + dx * k, ny = y + dy * k; if (!inb(nx, ny)) { ok = false; break; } const j = idx(nx, ny); if (!isSea(j) || (k <= n && seaBlocked(j)) || !bigWater(j)) ok = false; }
    if (ok) return [dx, dy]; }
  return null;
}
function seaPut(T, type, s, o) {
  if (!s || (CULT.shun && (CULT.shun[type] || 0) >= .3)) return null;
  const i = idx(s.x, s.y); if (M.bld[i]) { if (!seaYield(i)) return null; removeBuilding(S.B[M.bld[i]]); T._fail = {}; }
  const B = mkBuilding(type, s.x, s.y, T, o || {});
  if (!SEA_T[type]) connectRoad(B);
  S.seaV = (S.seaV || 0) + 1; return B;
}
// a pleasure pier: the shore tile and two out over the water, one lot
function seaPier(T) {
  const s = seaSite(T, 'coast', { out: 2, yield: 1 }); if (!s) return null;
  const dir = seaOut(s.x, s.y, 2); if (!dir) return null;
  const ts = [idx(s.x + dir[0], s.y + dir[1]), idx(s.x + dir[0] * 2, s.y + dir[1] * 2)], ex = new Set();
  for (const j of ts) { if (!seaSimple(j, ex)) return null; ex.add(j); }
  const B = seaPut(T, 'seapier', s, { dir }); if (!B) return null;
  const xs = [s.x, s.x + dir[0] * 2], ys = [s.y, s.y + dir[1] * 2];
  B.x = Math.min(...xs); B.y = Math.min(...ys); B.w = Math.abs(dir[0]) * 2 + 1; B.h = Math.abs(dir[1]) * 2 + 1; B.lx = s.x; B.ly = s.y; // (B.lx, B.ly: its land end)
  for (const j of fpTiles(B)) { M.bld[j] = B.id; markDirty(j); }
  return B;
}
const seaN = (T, t) => bcount(T, t);
function yearlySea() {
  if (!hasTech('boats')) return;
  for (const T of towns()) {
    if (T.pop < 60 || !chance(.5)) continue;
    const sea = seaTown(T);
    if (seaN(T, 'oysters') < (T.pop > 600 ? 2 : 1) && chance(.25) && seaPut(T, 'oysters', seaSite(T, 'shore', { d0: 1, d1: 1 }))) continue;
    if (!sea) { // lakes: a fish farm and floating solar later on
      if (hasTech('computing') && T.pop > 1500 && !seaN(T, 'fishfarm') && chance(.15) && seaPut(T, 'fishfarm', seaSite(T, 'shore', { d0: 1, d1: 2 }))) continue;
      if (hasTech('skyframe') && seaN(T, 'floatsolar') < 3 && chance(.15) && seaPut(T, 'floatsolar', seaSite(T, 'shore', { d0: 1, d1: 3, lake: 1 }))) continue;
      continue;
    }
    if (hasTech('coin') && T.pop > 200 && !seaN(T, 'saltpan') && chance(.15) && seaPut(T, 'saltpan', seaSite(T, 'coast', { sand: 1, flat: 1 }))) continue;
    if (hasTech('rail') && T.pop > 1500 && !seaN(T, 'seapier') && chance(.12) && seaPier(T)) continue;
    if (hasTech('concrete') && T.pop > 1500 && !seaN(T, 'desal') && chance(.12) && seaPut(T, 'desal', seaSite(T, 'coast', { flat: 1, yield: 1 }))) continue;
    if (hasTech('motor') && !hasTech('fusion') && T.pop > 800 && !seaN(T, 'oilrig') && anycount('oilrig') < Math.max(1, Math.ceil(towns().length / 2)) && chance(.1) && seaPut(T, 'oilrig', seaSite(T, 'off', { d0: 4, d1: 9 }))) continue;
    if (hasTech('computing') && T.pop > 1500 && seaN(T, 'fishfarm') < (T.pop > 5000 ? 2 : 1) && chance(.15) && seaPut(T, 'fishfarm', seaSite(T, 'shore', { d0: 1, d1: 3 }))) continue;
    if (hasTech('solar') && T.pop > 2000 && seaN(T, 'wavefarm') < 2 && chance(.1) && seaPut(T, 'wavefarm', seaSite(T, 'shore', { d0: 1, d1: 3, sea: 1 }))) continue;
    if (hasTech('skyframe') && T.pop > 2000 && seaN(T, 'floatsolar') < 2 && chance(.1) && seaPut(T, 'floatsolar', seaSite(T, 'shore', { d0: 1, d1: 3, lake: 1 }))) continue;
    if (hasTech('genegarden') && T.pop > 2500 && seaN(T, 'kelp') < 2 && chance(.12) && seaPut(T, 'kelp', seaSite(T, 'shore', { d0: 2, d1: 4, sea: 1 }))) continue;
    if (hasTech('station') && !anycount('sealaunch') && T.pop > 3000 && chance(.1) && seaPut(T, 'sealaunch', seaSite(T, 'off', { d0: 5, d1: 10 }))) continue;
    if (hasTech('arcology') && T.pop > 4000 && seaN(T, 'seastead') < 2 && chance(.1) && seaPut(T, 'seastead', seaSite(T, 'off', { d0: 2, d1: 6 }))) continue;
  }
  if (hasTech('fusion')) seaRetire();
}
// the wind parks come with the power need (needs.js tryNeeds): one more turbine at sea, in rows near the others
function seaWind(T) { if (!hasTech('computing') || seaN(T, 'windpark') >= 6 || !seaTown(T)) return null; return seaPut(T, 'windpark', seaSite(T, 'off', { d0: 4, d1: 10, grid: 1, near: 'windpark' })); } // (well out, in a park of its own)
// a coastal town short of water before the mains come can make it from the sea
function seaDesal(T) { if (!hasTech('electric') || seaN(T, 'desal') || T.pop < 800 || !seaTown(T)) return null; return seaPut(T, 'desal', seaSite(T, 'coast', { flat: 1, yield: 1 })); }
// fusion makes the oil rigs pointless: they come down one at a time, and the oldest is left standing as a reef
function seaRetire() {
  const rigs = Object.values(S.B).filter(B => B.type === 'oilrig' && B.prog >= 1).sort((a, b) => a.id - b.id); if (!rigs.length || !chance(.25)) return;
  const reef = !anycount('reef'), B = reef ? rigs[0] : rigs[rigs.length - 1], T = S.T[B.sid], x = B.x, y = B.y;
  removeBuilding(B); S.seaV = (S.seaV || 0) + 1;
  if (reef) { mkBuilding('reef', x, y, T, { prog: 1 }); chron('🐟', `The last oil rig off ${T ? T.name : 'the coast'} is stripped of its decks and left standing. Mussels, kelp and a great many fish move in; divers follow.`, { x, y, k: 'major', cap: 'The rig becomes a reef' }); }
  else if (!S.flags.rigDown) { S.flags.rigDown = 1; chron('🛢️', `An oil rig off ${T ? T.name : 'the coast'} is cut up and towed away. Nobody needs the oil now there is fusion.`, { x, y }); }
}
// tooltips (needs.js needTip asks here first)
function seaTip(B) {
  const t = B.type;
  if (SEA_FOOD[t]) return `🐟 food for ${SEA_FOOD[t]}` + (t === 'oysters' && !isSea(idx(B.x, B.y)) ? ' (a fish weir: there are no oysters in fresh water)' : '');
  if (SEA_HOUSE[t]) return `🏠 homes for ${SEA_HOUSE[t]} · 🎭 culture +${CULT_PTS[t] || 0}`;
  if (t === 'desal') return hasTech('concrete') ? '💧 the mains water for the town comes from here' : `💧 water for about ${fmtInt(TOWER_N * 2)} people`;
  if (t === 'reef') return '🐟 an old oil rig left standing as a reef: fish, kelp, mussels and divers';
  if (t === 'sealaunch') return '🚀 rockets go up from here, well away from anyone’s teacups';
  return '';
}
