/* ============================== town needs: what a town wants, and the buildings that give it ============================== */
// Every town has a few soft needs that switch on as the world learns things: water, milling, health, power, culture
// and news. Buildings meet them. An unmet need only slows a town down a little, it never stops anything (idle game).
// Needs are worked out from the buildings every few months and never saved, so old saves just pick them up.
const NEEDS = [
  { k: 'water', ic: '💧', n: 'water', tech: 'wells', tip: 'Wells, later water towers. Short of water, a town grows more slowly.' },
  { k: 'mill', ic: '🌾', n: 'milling', tech: 'mills', tip: 'Each windmill grinds for about sixteen fields, and milled grain feeds a quarter more people.' },
  { k: 'health', ic: '⚕️', n: 'health', tech: 'medicine', tip: 'Clinics and bathhouses. Healthy towns grow faster and live longer.' },
  { k: 'energy', ic: '⚡', n: 'power', tech: 'electric', tip: 'One grid for the whole valley. Works, gene gardens and universities run slow without it.' },
  { k: 'culture', ic: '🎭', n: 'culture', tech: 'stone', tip: 'Shrines, markets, the library, parks, monuments, theatres, museums, stadiums, gardens. People move to lively towns, and faith grows.' },
  { k: 'word', ic: '📡', n: 'news', tech: 'radio', tip: 'A radio mast or Weave relay in range. Research goes faster, and the Watcher’s words are remembered longer.' }
];
const CULT_PTS = { theatre: 4, bathhouse: 2, botanic: 3, digsite: 1, guildhall: 1, shrine: 2, plaza: 1, market: 1, library: 2, park: 1, monument: 3, watchstone: 3, museum: 5, stadium: 4, dome: 2 };
const POWER_OUT = { power: 12, turbine: 3, solar: 4, fusion: 40 };
const POWER_USE = { works: 2, university: 2, vfarm: 2, dome: 2, station: 1, airfield: 1, stadium: 1, antenna: 1, museum: 1 };
const WELL_N = 70, TOWER_N = 900, MILL_K = .25, MILL_FIELDS = 16;
const clinicN = () => 1500 * (hasTech('genegarden') ? 3 : hasTech('computing') ? 2 : 1); // hospitals get better

const NEEDC = { S: null, m: -99, t: {}, grid: 1, sup: 0, dem: 0, word: 0 };
function townCounts(T) { const n = {}; for (const id of T.bl) { const B = S.B[id]; if (B && B.prog >= 1) n[B.type] = (n[B.type] || 0) + 1; } return n; }
function refreshNeeds(force) {
  if (!force && NEEDC.S === S && S.month - NEEDC.m < 3 && NEEDC.m <= S.month) return NEEDC;
  NEEDC.S = S; NEEDC.m = S.month; NEEDC.t = {};
  let sup = 0, dem = 0, cov = 0, tot = 0;
  const ts = towns(), radios = [];
  for (const T of ts) {
    const n = townCounts(T); NEEDC.t[T.id] = { n };
    for (const k in POWER_OUT) sup += (n[k] || 0) * POWER_OUT[k];
    for (const k in POWER_USE) dem += (n[k] || 0) * POWER_USE[k];
    dem += T.pop / 450;
    if (n.mast) radios.push([T, 24]); if (n.antenna) radios.push([T, 44]);
  }
  NEEDC.sup = sup; NEEDC.dem = dem; NEEDC.grid = dem > 0 ? clamp(sup / dem, 0, 1) : 1;
  for (const T of ts) { const e = NEEDC.t[T.id]; e.v = needValues(T, e.n, radios); e.pol = pollution(T, e.n); tot += T.pop; if (e.v.word === 1) cov += T.pop; }
  NEEDC.word = tot ? cov / tot : 0;
  return NEEDC;
}
// 0..1 per active need (a need that hasn't switched on yet is missing)
function needsOf(T) { const c = refreshNeeds(); if (!c.t[T.id]) refreshNeeds(true); return (c.t[T.id] || {}).v || {}; }
const gridK = () => hasTech('electric') ? .5 + .5 * refreshNeeds().grid : 1; // how hard the big consumers can run

// a town by a river or lake gets some of its water for nothing
const NATW = { S: null, v: {} };
function natWater(T) {
  if (NATW.S !== S) { NATW.S = S; NATW.v = {}; }
  const c = NATW.v[T.id]; if (c && S.year - c.y < 50) return c.w;
  const R = Math.ceil(townRadius(T) + 2); let f = 0;
  for (let y = Math.max(0, T.y - R); y <= Math.min(H - 1, T.y + R) && !f; y++) for (let x = Math.max(0, T.x - R); x <= Math.min(W - 1, T.x + R); x++) { const i = idx(x, y); if (M.water[i] === 2 || (M.water[i] && M.bio[i] === BIO.FRESH)) { f = 1; break; } }
  const w = f ? .35 : .15; NATW.v[T.id] = { w, y: S.year }; return w;
}
// each windmill grinds for about sixteen fields, wherever they are in town
function millShare(T, n) { n = n || townCounts(T); return n.farm ? clamp((n.mill || 0) * MILL_FIELDS / n.farm, 0, 1) : 1; }
function needValues(T, n, radios) {
  const v = {}, p = Math.max(1, T.pop);
  if (hasTech('wells')) {
    if (hasTech('concrete') || p < 15) v.water = 1; // piped water, or a camp small enough to carry it from the stream
    else v.water = clamp((natWater(T) * p + (n.well || 0) * WELL_N + (n.watertower || 0) * TOWER_N * (hasTech('steam') ? 2 : 1)) / p, 0, 1);
  }
  if (hasTech('mills') && !hasTech('genegarden')) v.mill = millShare(T, n);
  if (hasTech('medicine')) v.health = clamp(((n.clinic || 0) * clinicN() + (n.bathhouse || 0) * 700 + 150) / p, 0, 1);
  if (hasTech('electric')) v.energy = NEEDC.grid;
  if (hasTech('stone')) { let c = 0; for (const k in CULT_PTS) c += (n[k] || 0) * CULT_PTS[k]; v.culture = clamp(c / (1 + Math.sqrt(p) / 6), 0, 1); }
  if (hasTech('radio')) v.word = radios.some(([R, r]) => dist(R.x, R.y, T.x, T.y) <= r) ? 1 : 0;
  return v;
}

/* ---------- smoke: the works and power houses of the steam age dirty the air until clean power comes ---------- */
const SMOKY = { works: 3, power: 4, glassworks: 1 };
const sootK = () => !hasTech('steam') ? 0 : hasTech('climate') ? 0 : hasTech('solar') ? .2 : 1;
function pollution(T, n) {
  n = n || townCounts(T); let s = 0;
  for (const k in SMOKY) s += (n[k] || 0) * SMOKY[k];
  return clamp((s * sootK() - (n.park || 0) * .5) / (2 + Math.sqrt(Math.max(1, T.pop)) / 6), 0, 1);
}
const polOf = T => { const c = refreshNeeds(); return (c.t[T.id] || {}).pol || 0; };
// soot on the ground around the smoky buildings (topColor reads it; re-checked once a year)
const SOOT = new Float32Array(W * H); let SOOT_K = '', SOOT_S = null;
function updateSoot(mark) {
  const k = sootK(), src = [];
  if (k > 0) for (const id in S.B) { const B = S.B[id]; if (SMOKY[B.type] && B.prog >= 1) src.push(B); }
  const key = k + ':' + src.map(B => B.id).join(',');
  if (key === SOOT_K && SOOT_S === S) return;
  SOOT_K = key; SOOT_S = S;
  const nw = new Float32Array(W * H);
  for (const B of src) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = B.x + dx, y = B.y + dy; if (!inb(x, y)) continue; const i = idx(x, y);
    nw[i] = Math.min(1, nw[i] + SMOKY[B.type] * k * (dx * dx + dy * dy <= 2 ? .16 : .08));
  }
  if (!mark) { SOOT.set(nw); return; }
  for (let i = 0; i < W * H; i++) if (Math.abs(nw[i] - SOOT[i]) > .03) { SOOT[i] = nw[i]; markDirty(i); }
}
function yearlyIndustry() {
  updateSoot(true);
  if (!S.flags.soot) { const T = towns().find(T => polOf(T) > .4); if (T) { S.flags.soot = 1; chron('🏭', `Soot settles on the washing lines of ${T.name}. The works never stop, and nobody has seen a white shirt in years.`, { T }); } }
  if (hasTech('solar') && !S.flags.clean && anycount('works')) { S.flags.clean = 1; chron('🌤️', 'One by one the works of the valley switch to clean power. By spring, the washing on the lines stays white.', { k: 'major' }); }
  if (hasTech('fusion')) for (const T of towns()) { // the old power houses retire once a town has its fusion plant
    const P = T.bl.map(id => S.B[id]).find(B => B && B.type === 'power' && B.prog >= 1);
    if (!P || !T.bl.some(id => S.B[id] && S.B[id].type === 'fusion' && S.B[id].prog >= 1) || !chance(.1)) continue;
    const x = P.x, y = P.y; removeBuilding(P); mkBuilding('park', x, y, T, { prog: 1 });
    chron('🌳', `The old power house of ${T.name} is pulled down now the fusion plant does its work. The site becomes a park, and the chimney a climbing wall.`, { x, y });
    break;
  }
}

/* ---------- what the needs do ---------- */
// growth speed (the town's size is still set by its houses and food)
function needGrowthK(T) {
  const v = needsOf(T);
  return (1 - .08 * polOf(T)) * (v.water == null ? 1 : 1 - .25 * (1 - v.water)) * (v.health == null ? 1 : .96 + .08 * v.health) * (v.energy == null ? 1 : 1 - .1 * (1 - v.energy));
}
// healthy towns live longer (added to a newborn's lifespan)
function lifeBonus(T) { if (!T) return 0; const v = needsOf(T), n = (refreshNeeds().t[T.id] || {}).n || {}; return (v.health != null ? Math.round(v.health * 5) : 0) + (n.bathhouse ? 3 : 0); } // hot baths help too
// people drift from dull towns to lively ones (the valley's total stays the same)
function migrate() {
  const ts = towns().filter(T => T.pop > 60 && needsOf(T).culture != null); if (ts.length < 2) return;
  const appeal = T => needsOf(T).culture - .4 * polOf(T); // lively and clean
  ts.sort((a, b) => appeal(a) - appeal(b));
  const lo = ts[0], hi = ts[ts.length - 1], gap = appeal(hi) - appeal(lo);
  if (gap < .25) return;
  const n = lo.pop * .006 * gap; lo.pop -= n; hi.pop += n;
  if (n > 3 && S.year - (S.migYr || -99) > 90 && chance(.15)) {
    S.migYr = S.year;
    const lure = ['museum', 'stadium', 'park', 'market', 'library', 'shrine'].find(k => bcount(hi, k) > 0);
    chron('🧳', `Young people from ${lo.name} keep moving to ${hi.name}${lure ? `, drawn by its ${{ museum: 'museum', stadium: 'stadium', park: 'parks', market: 'markets', library: 'library', shrine: 'shrine festivals' }[lure]}` : ''}. ${lo.name} grumbles about it.`, { T: hi });
  }
}
// a little Reverence for every town that feels alive (see faithRecalc)
function cultureFaith() { let n = 0; for (const T of towns()) if ((needsOf(T).culture || 0) >= .8) n++; return Math.min(.6, n * .12); }
// towns with culture get picked for festivals more often
function festTown() { const ts = towns(); return ts.length ? wpick(ts.map(T => [T, (Math.sqrt(T.pop) + 1) * (.5 + (needsOf(T).culture || 0))])) : null; }

/* ---------- a town builds for what it's missing (on top of the usual services) ---------- */
function needUrgent(T) { const v = needsOf(T); for (const k in v) if (v[k] < .6) return true; return false; }
function tryNeeds(T) {
  const v = needsOf(T);
  const shun = k => CULT.shun && (CULT.shun[k] || 0) >= .3;
  const put = (type, kinds, rebuild) => { // rebuild: with no free plot, it goes up over an old house or field
    if (shun(type)) return null;
    for (const k of kinds) { const s = findSite(T, k); if (s && !s.replaceFarm) { const B = mkBuilding(type, s.x, s.y, T); if (type !== 'solar' && type !== 'turbine') connectRoad(B); return B; } }
    return rebuild ? placeProject(T, type, []) : null;
  };
  if (v.water != null && v.water < .85) {
    if (hasTech('masonry') && T.pop > 160 && bcount(T, 'watertower') < 4 && put('watertower', ['mid', 'edge'], v.water < .5)) return true;
    if (bcount(T, 'well') < 8 && put('well', ['center', 'mid', 'backlot'], v.water < .5)) return true;
  }
  if (v.mill != null && v.mill < .8 && bcount(T, 'mill') < 10 && put('mill', ['fields', 'high', 'edge'])) return true;
  if (v.health != null && v.health < .8 && bcount(T, 'clinic') < 8 && put('clinic', ['mid', 'center'], v.health < .5)) return true;
  if (v.energy != null && v.energy < .95 && T.pop >= 250) {
    if (hasTech('fusion') && T.pop >= 2000 && !bcount(T, 'fusion') && put('fusion', ['edge', 'flatedge'], v.energy < .5)) return true;
    if (T.pop >= 450 && !bcount(T, 'power') && !bcount(T, 'fusion') && put('power', ['edge'], v.energy < .5)) return true;
    if (hasTech('solar') && bcount(T, 'solar') < 14 && put('solar', ['edge', 'flatedge'])) return true;
    if (bcount(T, 'turbine') < 10 && put('turbine', ['high', 'edge'])) return true;
  }
  if (v.word === 0 && T.pop >= 150 && !bcount(T, 'mast') && put('mast', ['high', 'edge'])) return true;
  if (v.culture != null && v.culture < .5 && T.pop > 120 && chance(.4)) {
    if (hasTech('net') && T.pop > 2000 && !bcount(T, 'museum') && put('museum', ['center', 'mid'])) return true;
    if (hasTech('electric') && T.pop > 1500 && !bcount(T, 'stadium') && put('stadium', ['edge'])) return true;
    if (hasTech('concrete') && bcount(T, 'park') < 20 && put('park', ['mid'])) return true;
    if (bcount(T, 'shrine') < 2 && put('shrine', ['center', 'mid'])) return true;
  }
  return false;
}

/* ---------- now and then the chronicle notices ---------- */
const NEED_TXT = {
  water: ['The wells of {T} run low in the summer heat. People queue before dawn with their buckets.', 'Water is carried up from the river to {T} in barrels this year. Nobody enjoys it.'],
  mill: ['The farmers of {T} grind their grain by hand and complain about their wrists.'],
  health: ['The clinic in {T} has a queue out of the door. There are too many people for one doctor.'],
  energy: ['The lights of {T} flicker and dim in the evenings. The valley needs more power.', 'Brownouts in {T}: the works slow down, and people read by candle again.'],
  culture: ['{T} is prosperous, but dull. The young people say there is nothing to do.'],
  word: ['{T} gets its news a week late, from travellers. Nobody there has heard the latest song yet.']
};
function needsChron() {
  if (S.year - (S.needYr || -99) < 30) return;
  for (const T of shuffle(towns().slice())) {
    if (T.pop < 80 || S.year - (T.needYr || -99) < 150) continue;
    const v = needsOf(T), bad = NEEDS.filter(nd => v[nd.k] != null && v[nd.k] < .45);
    if (!bad.length) continue;
    const nd = pick(bad); S.needYr = T.needYr = S.year;
    chron(nd.ic, pick(NEED_TXT[nd.k]).replace('{T}', T.name), { T });
    return;
  }
}
function yearlyNeeds() { refreshNeeds(true); migrate(); needsChron(); yearlyIndustry(); yearlyCulture(); }

/* ---------- read-outs ---------- */
function needsRow(T) {
  const v = needsOf(T), act = NEEDS.filter(nd => v[nd.k] != null), pol = polOf(T);
  if (!act.length) return '';
  const soot = pol >= .15 ? `<span class="${pol > .5 ? 'low' : 'mid'}" title="Smoke from the works and power houses: ${Math.round(pol * 100)}%. It slows the town a little and puts people off moving there. Parks help, and clean power (Solar Glass) ends it.">🏭 ${Math.round(pol * 100)}%</span>` : '';
  return `<div class="needs">${act.map(nd => { const x = v[nd.k], cl = x >= .9 ? 'ok' : x >= .55 ? 'mid' : 'low'; return `<span class="${cl}" title="${esc(cap1(nd.n))}: ${Math.round(x * 100)}% met. ${esc(nd.tip)}">${nd.ic} ${Math.round(x * 100)}%</span>`; }).join('')}${soot}</div>`;
}
function needTip(B) {
  const t = B.type;
  if (t === 'theatre') return '🎭 culture +4 · stages a new play now and then';
  if (t === 'bathhouse') return '♨️ hot baths: people born here live a few years longer' + (hasTech('medicine') ? ` · ⚕️ helps about 700 people` : '');
  if (t === 'digsite') return B.done ? `⛏️ finished after ${B.finds || 0} finds; open for visitors` : `⛏️ ${B.finds || 0} find${B.finds === 1 ? '' : 's'} so far · every find helps research`;
  if (t === 'botanic') return `🌿 plants trees around town, and breeds new crops (${S.bred || 0} so far)`;
  if (t === 'guildhall') { const T = S.T[B.sid], r = T && guildOf(T); return r ? `🛠️ the ${GUILD[r]}’ guild: ${RES_N[r]} from ${T.name} +30%` : '🛠️ a guild waiting for a trade to be known for'; }
  if (t === 'warehouse') return '📦 the town’s stores hold half as much again';
  if (t === 'shipyard') return '⚓ bigger ships for sea trade, and more of them on the water';
  if (SMOKY[t] && sootK() >= .5) return `🏭 smoky${POWER_OUT[t] ? ` · ⚡ makes ${POWER_OUT[t]} power` : POWER_USE[t] && hasTech('electric') ? ` · ⚡ uses ${POWER_USE[t]} power` : ''}`;
  if (t === 'well') return `💧 water for about ${WELL_N} people`;
  if (t === 'watertower') return `💧 water for about ${fmtInt(TOWER_N * (hasTech('steam') ? 2 : 1))} people`;
  if (t === 'mill' && hasTech('mills') && !hasTech('genegarden')) return `🌾 grinds the harvest of about ${MILL_FIELDS} fields (a quarter more food from them)`;
  if (t === 'clinic') return `⚕️ cares for about ${fmtInt(clinicN())} people`;
  if (t === 'mast' || t === 'antenna') return `📡 carries the news ${t === 'mast' ? 24 : 44} tiles${t === 'antenna' && hasTech('electric') ? ' · ⚡ uses 1 power' : ''}`;
  if (POWER_OUT[t]) return `⚡ makes ${POWER_OUT[t]} power for the valley grid`;
  if (POWER_USE[t] && hasTech('electric')) { const g = refreshNeeds().grid; return `⚡ uses ${POWER_USE[t]} power${g < .95 ? ` · the grid is short, running at ${Math.round(gridK() * 100)}%` : ''}`; }
  if (CULT_PTS[t] && hasTech('stone') && t !== 'plaza') return `🎭 culture +${CULT_PTS[t]}`;
  return '';
}

/* ============================== culture: theatres, hot springs, the Makers' dig, gardens and guilds ============================== */
// hot springs: a few steaming pools, placed when the world is made (older saves get theirs on load)
function placeSprings() {
  const out = [];
  for (let t = 0; t < 4000 && out.length < 3; t++) {
    const x = 3 + ri(0, W - 7), y = 3 + ri(0, H - 7), i = idx(x, y), b = M.bio[i];
    if (M.water[i] || M.ruin[i] || M.bld[i] || M.road[i] || M.elev[i] < 2 || M.elev[i] > 7) continue;
    if (b !== BIO.MEADOW && b !== BIO.LUSH && b !== BIO.HIGH && b !== BIO.ROCK) continue;
    if (S.landing && dist(x, y, S.landing.x, S.landing.y) < 6) continue;
    if (out.some(o => dist(x, y, o.x, o.y) < 14)) continue;
    out.push({ x, y }); M.tree[i] = 0;
  }
  return out;
}
const SPRINGS = { S: null, n: -1, set: new Set() };
function springAt(i) {
  if (SPRINGS.S !== S || SPRINGS.n !== (S.springs || []).length) { SPRINGS.S = S; SPRINGS.n = (S.springs || []).length; SPRINGS.set = new Set((S.springs || []).map(o => idx(o.x, o.y))); }
  return SPRINGS.set.has(i);
}
const nearSpring = (x, y) => { for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && springAt(idx(nx, ny))) return true; } return false; };
function drawSpring(c, i, cx, cy) {
  const P = (u, v) => pt(cx, cy, u, v, .3);
  for (let k = 0; k < 9; k++) { const a = k / 9 * TAU, [sx, sy] = P(Math.cos(a) * .3, Math.sin(a) * .3); ell(c, sx, sy, 2.2, 1.3, topC(shade('#b7afa4', LT.fT))); }
  const [px, py] = P(0, 0); ell(c, px, py, .27 * 22.6, .27 * 11.3, topC(shade('#62c9c4', LT.fG)));
  ell(c, px - 1.5, py - .8, .12 * 22.6, .1 * 11.3, 'rgba(255,255,255,.35)');
  emit(px, py, 9, '#9ff0ea', .35);
}
function springSteam(dt) {
  for (const o of S.springs || []) {
    if (!chance(dt * .9)) continue;
    const [cx, cy] = gridToWorld(o.x, o.y, landZ(idx(o.x, o.y))); if (!inView(cx, cy, 120)) continue;
    addPart(cx + rf(-5, 5), cy - 1, rf(-2, 2), rf(-7, -4), rf(3, 5), '#f4f7f7', .4, 'mist', 2.2);
  }
}
const FINDS = ['a Maker tool of green glass that still hums faintly', 'a seed-shaped stone carved with the falling glyph', 'a mosaic of a forest, seen from high above',
  'a buried garden terrace, its steps still perfectly level', 'a flute that plays only one very sad note', 'a star chart pieced together from forty shards',
  'the bones of something far larger than a mossback', 'a sealed jar of seeds. Three of them sprout', 'a stone bench worn smooth by someone sitting on it for centuries',
  'a tiny carved mossback, the first proof the Makers knew them', 'a map of the valley with a river where there is none today', 'a bell that rings without being touched when it rains'];
const PLAYS = ['The Long Winter', 'The Founder’s Last Letter', 'Two Moons, One Heart', 'The Mossback Who Would Not Move', 'A Comedy of Wheels', 'The Watcher’s Silence',
  'Seedfall', 'The Glassblower’s Daughter', 'Much Ado About Sunroot', 'The Weaver of Lurest', 'The Tide Clock', 'Letters from the Far Seed', 'The Last Glyph'];
const BRED = ['sky melons', 'frost-sweet sunroot', 'glowcap barley', 'purple rice', 'hill grapes', 'salt beans', 'honey kale', 'Maker wheat'];
const GUILD = { wood: 'Carpenters', stone: 'Masons', clay: 'Brickmakers', metal: 'Smiths', goods: 'Makers', cloth: 'Weavers', glass: 'Glassblowers' };
// what a town's guild is for: what it is known for, or else its biggest trade (fixed once the hall is built)
function guildOf(T) {
  if (T.guild) return T.guild;
  const k = T.known ? Object.keys(T.known) : []; if (k.length) return k[0];
  let best = null, bf = 6; for (const r of RES) { const f = (T.flow || {})[r] || 0; if (f > bf) { bf = f; best = r; } }
  return best;
}
// a town with room to spare builds something for the soul
function tryCulture(T) {
  const shun = k => CULT.shun && (CULT.shun[k] || 0) >= .3;
  const put = (type, s, o) => { if (!s || s.replaceFarm || shun(type)) return false; const B = mkBuilding(type, s.x, s.y, T, o || {}); connectRoad(B); return true; };
  if (hasTech('masonry') && T.pop > 150 && !bcount(T, 'bathhouse') && put('bathhouse', findSite(T, 'spring'))) return true;
  if (hasTech('print') && T.pop > 500 && bcount(T, 'theatre') < (T.pop > 8000 ? 2 : 1) && put('theatre', findSite(T, 'center') || findSite(T, 'mid'))) return true;
  if (hasTech('print') && T.pop > 200 && !bcount(T, 'digsite') && put('digsite', findSite(T, 'ruins'))) return true;
  if (hasTech('optics') && T.pop > 900 && !bcount(T, 'botanic') && anycount('botanic') < Math.ceil(towns().length / 2) && put('botanic', findSite(T, 'mid') || findSite(T, 'edge'))) return true;
  if (hasTech('coin') && T.pop > 400 && guildOf(T) && !bcount(T, 'guildhall') && put('guildhall', findSite(T, 'center') || findSite(T, 'mid'))) return true;
  return false;
}
function yearlyCulture() {
  for (const k in S.B) {
    const B = S.B[k]; if (B.prog < 1) continue; const T = S.T[B.sid]; if (!T) continue;
    if (B.type === 'digsite' && !B.done && chance(.05)) { // a find
      B.finds = (B.finds || 0) + 1;
      const m = towns().find(O => bcount(O, 'museum')), f = pickFresh(FINDS, 'find');
      chron('⛏️', `The Maker dig outside ${T.name} turns up ${f}${m ? `. It goes on show in the museum of ${m.name}` : ''}.`, { x: B.x, y: B.y });
      S.boost = Math.max(S.boost || 0, 2); gainRev(3, 'a find at the dig');
      if (B.finds >= 8) { B.done = 1; chron('⛏️', `After ${yr() - B.built} years the dig outside ${T.name} is finished. The trenches are left open for visitors.`, { x: B.x, y: B.y }); }
    } else if (B.type === 'botanic') {
      if (chance(.6)) plantNear(T); // the gardeners can't help themselves
      if ((S.bred || 0) < 3 && S.year - (S.bredYr || B.built) > 90 && chance(.04)) {
        S.bred = (S.bred || 0) + 1; S.bredYr = S.year;
        chron('🌿', `The botanical garden of ${T.name} breeds a new crop: ${pickFresh(BRED, 'bred')}. Within a generation it grows in every valley field.`, { x: B.x, y: B.y, k: 'major' });
      }
    }
  }
}
function plantNear(T) {
  const R = townRadius(T), a = rnd() * TAU, d = rf(R * .5, R + 3), x = Math.round(T.x + Math.cos(a) * d), y = Math.round(T.y + Math.sin(a) * d);
  if (!inb(x, y)) return; const i = idx(x, y), b = M.bio[i];
  if (M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i] || M.plan[i] || M.tree[i] >= 2 || springAt(i)) return;
  if (b !== BIO.MEADOW && b !== BIO.LUSH && b !== BIO.HIGH) return;
  M.tree[i] = (M.tree[i] || 0) + 1; M.ttype[i] = pick([4, 3, 1]); M.wild[i] = 1; markDirty(i);
}
function guildK(T, r) { return T.guild === r && T.bl.some(id => S.B[id] && S.B[id].type === 'guildhall' && S.B[id].prog >= 1) ? 1.3 : 1; }
