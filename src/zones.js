/* ============================== zones: every town draws its own quarters, and redraws them as it grows ============================== */
// Nobody paints these. A town keeps a market core, homes around it, a works quarter out on one edge once it has
// industry, and a green or two. It redraws them every couple of decades (or when it has outgrown them), so a works
// quarter can turn into homes after clean power, and old fields get swallowed by streets. Zones only steer where
// things go (a score in findSite), they never forbid anything: a town with no good plot still builds (idle game).
// M.zone is a saved map layer; older saves get theirs drawn on load.
const Z_CORE = 1, Z_HOME = 2, Z_WORKS = 3, Z_GREEN = 4;
const ZONE_N = ['', 'market quarter', 'homes', 'works quarter', 'green'];
const ZONE_COL = ['', '74,144,226', '124,194,107', '240,195,64', '31,158,137']; // Cities-ish: blue shops, green homes, yellow works
const ZONE_OF = {
  house: Z_HOME, well: Z_HOME, granary: Z_HOME, school: Z_HOME, clinic: Z_HOME,
  market: Z_CORE, hall: Z_CORE, library: Z_CORE, museum: Z_CORE, theatre: Z_CORE, guildhall: Z_CORE, shops: Z_CORE,
  workshop: Z_WORKS, works: Z_WORKS, power: Z_WORKS, weaver: Z_WORKS, glassworks: Z_WORKS, warehouse: Z_WORKS, fusion: Z_WORKS,
  park: Z_GREEN, botanic: Z_GREEN, dome: Z_GREEN
};
// what a building gets for standing in each zone: [none, core, homes, works, green]
const ZSC = { [Z_CORE]: [0, 2.5, 0, -2, -3], [Z_HOME]: [0, .4, 1.2, -2.5, -4], [Z_WORKS]: [0, -2, -1.5, 3, -4], [Z_GREEN]: [0, -.5, 0, -2, 4] };
const RD_WORKS = { workshop: 1, works: 1, warehouse: 1, weaver: 1 }; // what can move to the works quarter (not the power house, nor a glassworks tied to its sand)
let FARM_ZP = .8; // how hard new fields avoid the town's quarters
const WORKS_T = { workshop: 1, works: 1, power: 1, weaver: 1, glassworks: 1, warehouse: 1, fusion: 1 };
function zoneScore(zt, i) { const w = ZONE_OF[zt]; return w ? ZSC[w][M.zone[i]] : 0; }
function zoneAt(i) { return M.zone ? M.zone[i] : 0; }
const angD = (a, b) => { const d = Math.abs(a - b) % TAU; return d > Math.PI ? TAU - d : d; };
// a compass word for a direction on screen (grid x runs down-right, grid y down-left)
function dirWord(a) { const sx = Math.cos(a) - Math.sin(a), sy = Math.cos(a) + Math.sin(a); return Math.abs(sx) > Math.abs(sy) * 1.6 ? (sx > 0 ? 'eastern' : 'western') : Math.abs(sy) > Math.abs(sx) * 1.6 ? (sy > 0 ? 'southern' : 'northern') : (sy > 0 ? 'south' : 'north') + (sx > 0 ? '-eastern' : '-western'); }

function drawZones(T, quiet) {
  refreshOwn();
  const R = townRadius(T), Rz = R + 1.5, core = Math.max(1.6, R * .36), ind = hasTech('smelt') && T.pop > 120;
  const x0 = Math.max(0, Math.floor(T.x - Rz - 2)), x1 = Math.min(W - 1, Math.ceil(T.x + Rz + 2));
  const y0 = Math.max(0, Math.floor(T.y - Rz - 2)), y1 = Math.min(H - 1, Math.ceil(T.y + Rz + 2));
  // the works quarter: the side with industry already, raw materials beyond it, and no neighbour downwind of it
  let secA = null;
  if (ind) {
    let bs = -1e9;
    for (let k = 0; k < 8; k++) {
      const a = k * Math.PI / 4 - Math.PI; let s = rnd() * .5 + (T.zsec != null && angD(a, T.zsec) < .1 ? 4 : 0);
      for (const id of T.bl) { const B = S.B[id]; if (!B) continue; const d = dist(B.x, B.y, T.x, T.y); if (d < 1) continue; const on = angD(Math.atan2(B.y - T.y, B.x - T.x), a) < .6; if (!on) continue; if (WORKS_T[B.type]) s += 3; else if (B.type === 'house' && B.tier >= 3 && d > R * .45) s -= .3; else if (EXTRACT[B.type]) s += 1; }
      for (let r = R; r <= R + 5; r++) { const x = Math.round(T.x + Math.cos(a) * r), y = Math.round(T.y + Math.sin(a) * r); if (!inb(x, y)) { s -= 1; continue; } const i = idx(x, y); if (M.water[i]) s -= .4; else s += (M.ore[i] ? .6 : 0) + (rocky(i) || clayey(i) ? .25 : 0) + (M.tree[i] ? .1 : 0); }
      for (const O of towns()) if (O !== T && dist(O.x, O.y, T.x, T.y) < R * 2.6 + 6 && angD(Math.atan2(O.y - T.y, O.x - T.x), a) < .7) s -= 5;
      if (s > bs) { bs = s; secA = a; }
    }
  }
  let nW = 0; for (const id of T.bl) { const B = S.B[id]; if (B && WORKS_T[B.type]) nW++; }
  const wide = !ind ? 0 : clamp(.3 + nW * .05 + (hasTech('steam') ? .08 : 0), .35, .62) * (S.flags.clean ? .7 : 1); // as wide as its industry needs; clean industry needs less
  const was = T.zw || 0;
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = idx(x, y); if (OWN[i] !== T.id) continue;
    const d = dist(x, y, T.x, T.y);
    if (d > Rz || M.water[i]) { M.zone[i] = 0; continue; }
    let z = d <= core ? Z_CORE : Z_HOME;
    if (secA != null && d >= Math.max(core + .5, R * .45) && angD(Math.atan2(y - T.y, x - T.x), secA) <= wide) z = Z_WORKS;
    M.zone[i] = z;
  }
  // greens: a village common first, then parks by the water, on the hills, among the trees
  const nG = hasTech('concrete') ? 1 + Math.min(4, Math.floor(T.pop / 3000)) : T.pop > 300 ? 1 : 0, big = T.pop > 6000, seeds = []; // big towns keep bigger parks
  for (let g = 0; g < nG; g++) {
    let best = -1, bs = -1e9;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = idx(x, y), d = dist(x, y, T.x, T.y);
      if (OWN[i] !== T.id || M.water[i] || M.zone[i] === Z_WORKS || d < core * .7 || d > R * .95 || seeds.some(j => dist(x, y, j % W, (j / W) | 0) < (big ? 4.5 : 3.5))) continue;
      const Bh = S.B[M.bld[i]];
      let s = rnd() * .6 + around(x, y, 1, j => M.tree[j] ? 1 : 0) * .5 + adjCount(x, y, j => M.water[j] > 0) * .8 + (M.elev[i] - M.elev[idx(T.x, T.y)]) * .25 - Math.abs(d - R * .55) * .3;
      s += around(x, y, 1, j => { const B = S.B[M.bld[j]]; return B && ZONE_OF[B.type] === Z_GREEN ? 1 : 0; }) * 3;
      s += Bh ? (Bh.type === 'house' && Bh.tier >= 4 ? -4 : ZONE_OF[Bh.type] === Z_GREEN ? 3 : -2.5) : M.road[i] ? -3 : 1.5; // open ground or trees, not somebody's flat
      if (s > bs) { bs = s; best = i; }
    }
    if (best < 0) break;
    seeds.push(best);
    const bx = best % W, by = (best / W) | 0;
    for (const [dx, dy] of [[0, 0], ...(big ? N8 : N4)]) { const x = bx + dx, y = by + dy; if (inb(x, y)) { const j = idx(x, y); if (OWN[j] === T.id && !M.water[j] && M.zone[j] !== Z_WORKS) M.zone[j] = Z_GREEN; } }
  }
  const moved = T.zsec != null && secA != null && angD(T.zsec, secA) > .5;
  T.zy = S.year; T.zr = R; T.zc = !!S.flags.clean; T.zw = wide;
  if (secA != null) T.zsec = secA;
  if (quiet) return; // (each line is a one-off per town, so fast-forwards don't flood the chronicle)
  if (secA != null && !T.zind) { T.zind = 1; chron('🏭', `${T.name} sets its ${dirWord(secA)} edge aside for workshops and yards, downwind of the houses.`, { T }); }
  else if (moved) chron('🏭', `${T.name} moves its works quarter to the ${dirWord(secA).replace(/ern$/, '')} side of town. The old yards will be homes one day.`, { T });
  else if (was && wide < was && !T.zcl) { T.zcl = 1; chron('🌿', `With clean power, ${T.name} needs less room for its works. Part of the old works quarter is given over to homes and gardens.`, { T }); }
}
function yearlyZones() {
  for (const T of towns()) {
    if (!T.zy || S.year - T.zy >= 20 || townRadius(T) > (T.zr || 0) + 1.5 || T.zc !== !!S.flags.clean || (hasTech('smelt') && T.pop > 120 && T.zsec == null)) drawZones(T);
    redevelop(T); tendGreens(T); clearFields(T);
  }
}
// the greens get planted: trees on the commons, and parks once the town can afford them
function tendGreens(T) {
  if (!chance(.3)) return;
  const R = townRadius(T), t = [];
  for (let y = Math.max(0, Math.floor(T.y - R - 2)); y <= Math.min(H - 1, Math.ceil(T.y + R + 2)); y++) for (let x = Math.max(0, Math.floor(T.x - R - 2)); x <= Math.min(W - 1, Math.ceil(T.x + R + 2)); x++) {
    const i = idx(x, y); if (M.zone[i] === Z_GREEN && OWN[i] === T.id && !M.bld[i] && !M.road[i] && !M.rail[i] && !M.plan[i] && !M.water[i] && !M.ruin[i] && !springAt(i)) t.push(i);
  }
  if (!t.length) return;
  const i = pick(t), x = i % W, y = (i / W) | 0;
  if (hasTech('concrete') && T.pop > 600 && !(CULT.shun && (CULT.shun.park || 0) >= .3)) { if (M.tree[i]) M.tree[i] = 0; mkBuilding('park', x, y, T); }
  else if (!M.tree[i] && lever('nature') !== 'clear') { M.tree[i] = 1 + ri(0, 1); M.ttype[i] = ri(0, 2); markDirty(i); }
}
// fields left inside the streets are built over, a couple a year, and new ones go out beyond the houses
function clearFields(T) {
  if (T.pop < 300 || !chance(.25)) return;
  const R = townRadius(T); let best = null, bs = 1e9;
  for (const id of T.bl) {
    const B = S.B[id]; if (!B || B.prog < 1 || (B.type !== 'farm' && B.type !== 'pasture')) continue;
    const z = M.zone[idx(B.x, B.y)], d = dist(B.x, B.y, T.x, T.y), boxed = around(B.x, B.y, 1, j => { const C = S.B[M.bld[j]]; return C && C.type === 'house' ? 1 : 0; }) >= 4;
    const s = boxed ? d - 20 : d; // a field with houses all round goes first
    if (z && z !== Z_WORKS && (boxed || (z === Z_CORE && fronts(B.x, B.y))) && s < bs) { bs = s; best = B; } // only fields hemmed in by houses: clearing them all would pack the towns too tight
  }
  if (!best) return;
  const { x, y } = best; removeBuilding(best);
  connectRoad(mkBuilding('house', x, y, T, { tier: Math.max(2, Math.min(3, tierAllowed(T, dist(x, y, T.x, T.y), R))) })); // it grows up from there like any other house
  S.rdN = (S.rdN || 0) + 1;
  if (!S.firsts.rd_farm) { S.firsts.rd_farm = yr(); chron('🏗️', pick(RD_TXT.farm).replace('{T}', T.name), { x, y }); }
}
function zonesOnLoad() { if (!M.zone.some(v => v)) for (const T of towns()) drawZones(T, true); }

/* ---------- redevelopment: what no longer fits its quarter comes down, and something fitting goes up ---------- */
// Rate-limited (one project per town every few years), so there's no endless scaffolding, and only when the
// replacement is worth more than what goes.
const RD_TXT = {
  farm: ['The last fields inside {T} are built over. The streets have caught up with the harvest.', 'A field in the middle of {T} gives way to houses.'],
  works: ['The old {b} in the {z} of {T} comes down; homes are going up in its place.', 'Scaffolding goes up where {T}’s old {b} stood. The neighbours are delighted.'],
  shops: ['An old cottage on the square in {T} makes way for shops.', 'The market quarter of {T} gets a new row of shops where a cottage stood.'],
  park: ['A few old houses in {T} come down to make room for a park.', '{T} clears a corner for a green. The trees go in first.']
};
function redevelop(T) {
  if (T.pop < 200 || S.year - (T.rdY || 0) < 4 || !chance(.5)) return;
  const R = townRadius(T), top = maxHouseTier();
  let best = null, bs = 0;
  for (const id of T.bl) {
    const B = S.B[id]; if (!B || B.prog < 1 || B.hid) continue;
    const i = idx(B.x, B.y), z = M.zone[i], d = dist(B.x, B.y, T.x, T.y); if (!z) continue;
    let s = 0, to = null;
    if (RD_WORKS[B.type] && (z === Z_CORE || z === Z_HOME) && T.pop > 400 && d > 1.5) { s = 2.5; to = z === Z_CORE && hasTech('coin') ? 'shops' : 'house'; }
    else if (B.type === 'house' && z === Z_CORE && B.tier <= 4 && top >= 4 && hasTech('coin') && bcount(T, 'shops') < Math.min(6, 1 + Math.floor(T.pop / 1500))) { s = 1.5 - B.tier * .1; to = 'shops'; }
    else if (B.type === 'house' && z === Z_GREEN && B.tier <= (T.pop > 6000 ? 5 : 3) && hasTech('concrete') && bcount(T, 'park') < 20) { s = 1; to = 'park'; }
    if (!to || (to === 'house' && !fronts(B.x, B.y))) continue;
    s += rnd() * .5;
    if (s > bs) { bs = s; best = [B, to]; }
  }
  if (!best) return;
  const [B, to] = best, { x, y } = B, old = B.type, bn = BT[old].n.toLowerCase(), z = M.zone[idx(x, y)];
  removeBuilding(B);
  const N = to === 'house' ? mkBuilding('house', x, y, T, { tier: Math.max(2, Math.min(3, tierAllowed(T, dist(x, y, T.x, T.y), R))) }) : mkBuilding(to, x, y, T, to === 'shops' ? { sub: shopKind() } : {});
  if (!FLAT_TYPES[to]) connectRoad(N);
  T.rdY = S.year; S.rdN = (S.rdN || 0) + 1;
  const key = old === 'farm' || old === 'pasture' ? 'farm' : WORKS_T[old] ? 'works' : to;
  if (!S.firsts['rd_' + key] || chance(.2)) {
    S.firsts['rd_' + key] = S.firsts['rd_' + key] || yr();
    chron('🏗️', pick(RD_TXT[key]).replace('{T}', T.name).replace('{b}', bn).replace('{z}', ZONE_N[z]), { x, y });
  }
}

/* ---------- shops: the market quarter's own buildings, from shopfronts to offices ---------- */
const SHOP_N = ['Shopfronts', 'Arcade', 'Department Store', 'Offices'];
function shopKind() { return hasTech('computing') ? 3 : hasTech('electric') ? 2 : hasTech('masonry') ? 1 : 0; }
function drawShops(c, B, cx, cy, st) {
  const k = B.sub || 0, wc = winCol(st, B);
  if (k === 0) { // a row of little shops, each with its own awning
    box(c, cx, cy, 0, 0, .42, .3, 0, 9, st.wall); windows(c, cx, cy, 0, 0, .42, .3, 0, 9, 1, 3, wc);
    roofGable(c, cx, cy, 0, 0, .42, .3, 9, 5, st.roof, st.wall, true);
    const cols = [st.accent, mix(st.accent, '#ffffff', .45), st.roof];
    for (let n = 0; n < 3; n++) box(c, cx, cy, -.28 + n * .28, .34, .12, .045, 4.4, 1, cols[n]);
    return;
  }
  if (k === 1) { // an arcade: a glass roof over a lane of shops
    box(c, cx, cy, 0, 0, .44, .3, 0, 12, st.wall);
    for (let n = 0; n < 4; n++) { const u = -.33 + n * .22; poly(c, [pt(cx, cy, u - .06, .302, 0), pt(cx, cy, u + .06, .302, 0), pt(cx, cy, u + .06, .302, 7), pt(cx, cy, u, .302, 8.5), pt(cx, cy, u - .06, .302, 7)], shade(wc, LT.fWL)); }
    windows(c, cx, cy, 0, 0, .44, .3, 8, 4, 1, 4, wc);
    c.globalAlpha = .8; roofGable(c, cx, cy, 0, 0, .44, .3, 12, 6, st.glass, st.wall, true); c.globalAlpha = 1;
    return;
  }
  if (k === 2) { // a department store with its name up in lights
    box(c, cx, cy, 0, 0, .42, .38, 0, 22, st.wall); windows(c, cx, cy, 0, 0, .42, .38, 6, 16, 3, 4, wc);
    awning(c, cx, cy, 0, 0, .42, .38, st, true);
    box(c, cx, cy, 0, .385, .3, .01, 18, 3, st.accent); emit(...pt(cx, cy, 0, .39, 19.5), 8, st.accent, .5);
    box(c, cx, cy, 0, 0, .43, .39, 22, 1.4, shade(st.trim, 1.2));
    return;
  }
  // offices: glass floors on a stone base
  box(c, cx, cy, 0, 0, .4, .36, 0, 7, st.wall); awning(c, cx, cy, 0, 0, .4, .36, st, true);
  box(c, cx, cy, 0, 0, .36, .32, 7, 30, st.glass);
  for (let z = 12; z < 37; z += 6) box(c, cx, cy, 0, 0, .362, .322, z, .8, st.wall);
  if (LT.lit) windows(c, cx, cy, 0, 0, .36, .32, 7, 30, 5, 4, st.glass, null, true);
  box(c, cx, cy, 0, 0, .37, .33, 37, 1.2, shade(st.trim, 1.2));
}

