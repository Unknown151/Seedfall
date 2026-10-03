/* ============================== buildings: what each type looks like ============================== */
// Built into the 3D chunks (render.js primitives, gl.js helpers), tile-local: u, v in tiles from the middle of the tile,
// heights in height units (22 to a tile). Types with a native model in gl.js (GL_MODEL, GL_BIG) or works.js/house.js are
// handed over first; everything else is here.
const FLAT_TYPES = { farm: 1, solar: 1, airfield: 1, park: 1, plaza: 1, pasture: 1 };
function buildH(B) { return B.type === 'house' ? HOUSE_H[B.up != null ? B.up : B.tier] * .7 : (BT[B.type] ? BT[B.type].h * .55 : 20); }
// see-through shapes need no help; these are solid: a quad and a triangle by tile-local corners [u, v, z]
function tt(a, b, c, col, mat = 0, e = 0) { GLB.mat = mat; gtri(gw(...a), gw(...b), gw(...c), gcol(col), e); }
const mid = (...p) => { const n = p.length; return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n, p.reduce((s, q) => s + q[2], 0) / n]; };
function ctr(u, v, z) { GLB.ctr = gw(u, v, z); } // (faces turn away from here)
const glowAt = (u, v, z, r, col) => { GLB.mat = 0; glOBox(gw(u, v, z), [r, 0, 0], [0, 0, r], [0, r, 0], col, 3); }; // a light of its own colour: a beacon, a signal, a glowing stone
function sheepAt(u, v, s, left) { glSheep(GLB.x + u, GLB.y + v, GLB.base, s / 2.6, left ? Math.PI * .75 : -Math.PI * .25); }
function domeFrame(u, v, r, z0, h, col, n = 8) { // a glasshouse dome: ribs and rings, open to see the garden inside
  const P = (a, t) => [u + Math.cos(a) * r * Math.cos(t), v + Math.sin(a) * r * Math.cos(t), z0 + h * Math.sin(t)];
  for (let k = 0; k < n; k++) { const a = k / n * TAU; for (let j = 0; j < 4; j++) { const p = P(a, j / 4 * Math.PI / 2), q = P(a, (j + 1) / 4 * Math.PI / 2); beam(p[0], p[1], p[2], q[0], q[1], q[2], .006, col); } }
  for (const t of [0, .45, .9]) for (let k = 0; k < 16; k++) { const p = P(k / 16 * TAU, t), q = P((k + 1) / 16 * TAU, t); beam(p[0], p[1], p[2], q[0], q[1], q[2], .005, col); }
}

function drawBuilding(B, i) {
  let st = S.styles[B.style] || STYLES0[0]; const sv = DS, sm = DM;
  if (B.mat && MAT[B.mat]) st = matStyle(st, B);
  DS = st.shape || st.roofK ? st : null; DM = B.mat || null;
  try { drawBuilding0(B, i, st); } finally { DS = sv; DM = sm; }
}
// the era's style, tinted by what the building is made of
const MATST = new Map();
function matStyle(st, B) {
  const key = B.style + B.mat + st.wall + st.roof + (st.cult || '');
  let o = MATST.get(key); if (o) return o;
  const m = MAT[B.mat], k = st.cult ? .22 : B.mat === 'wood' ? .55 : .62;
  o = Object.assign({}, st, { wall: mix(st.wall, m.wall, k), roof: mix(st.roof, m.roof, k * .45) });
  if (MATST.size > 400) MATST.clear();
  MATST.set(key, o); return o;
}
function drawBuilding0(B, i, st) {
  if (B.prog < 1) { drawConstruction(B, st, i); return; }
  const m = glModel(B); if (m && m(B, st) !== false) return; // (a native model when the type has one)
  const v = B.var || 0;
  switch (B.type) { // (the rest have native models: homes.js, civic.js, industry.js, modern.js)
    case 'pod': return glPod(B);
    case 'lumber': return drawLumber(B, st);
    case 'harbor': return glHarbour(B);
    case 'quarry': return drawQuarry(B, i);
    case 'claypit': return drawClaypit(B, i);
    case 'turbine': return glTurbine(B);
    case 'pasture': return drawPasture(B, st);
    case 'shipyard': return glShipyard(B, st);
    case 'sandpit': return drawSandpit(B, i);
    default: box(0, 0, .3, .3, 0, 8, st.wall);
  }
}
// a clock face on a tower, lit at night: (u, v) on the wall, facing out along v (or u)
function dish(u, v, z, r, dir, col) { // a dish aerial facing dir
  const n = V3s(dir, 1 / Math.hypot(...dir)), s0 = V3x(n, [0, 1, 0]), s = V3s(s0, 1 / (Math.hypot(...s0) || 1)), t = V3x(s, n), O = gw(u, v, z), C = gcol(col);
  GLB.mat = 0; GLB.ctr = V3a(O, V3s(n, -1)); const R = k => { const a = k / 14 * TAU; return V3a(V3a(O, V3s(s, Math.cos(a) * r)), V3a(V3s(t, Math.sin(a) * r), V3s(n, r * .35))); };
  for (let k = 0; k < 14; k++) gtri(O, R(k), R(k + 1), C);
  gBeam(O, V3a(O, V3s(n, r * .9)), .004, '#9aa3ad');
}

/* ---------- where the materials come from ---------- */
function stoneCol(i) { const b = M.bio[i]; return b === BIO.ROCK ? '#bdb6cf' : b === BIO.HIGH ? '#dcc39c' : b === BIO.SNOW ? '#d8d7e2' : '#cfc8bb'; }

/* ---------- houses: no two quite alike, and terraces where the street fills up ---------- */
const SHAPE_HM = { tall: 1.45, low: .7 }, SHAPE_WM = { tall: .86, low: 1.12 };
const hk = (B, n) => hash2(B.id, n, 131); // a house's own dice, the same on every reload
const HTINT = new Map();
const HPAL = { rainbow: ['#d9534f', '#e8973a', '#e8cf4a', '#5fae5f', '#4a8fd0', '#8a62c8', '#e070a8', '#3fb0a8'], pastel: ['#f4c6d4', '#c6dff4', '#d2f0c6', '#f6ecbc', '#e0d0f4', '#f7d6bc', '#c8efe8'],
  whitewash: ['#f6f3ec', '#efeae0', '#faf8f3'], earthy: ['#c9a27a', '#a8785a', '#d8c09a', '#8f7050', '#b89070', '#9a8a60'], bold: ['#a8303a', '#2f5f9a', '#2f7a4a', '#d0902a', '#5a2f7a', '#1f6a6a', '#2a2a3a'] };
function houseTint(st, B) { // a little colour of its own: limewash, ochre, a door-colour wash... or the colours the Watcher's words asked for
  const pal = HPAL[LVV.housecol];
  if (pal) { const j = (hk(B, 33) * pal.length) | 0, key = st.wall + st.roof + LVV.housecol + j; let o = HTINT.get(key); if (o) return o;
    o = Object.assign({}, st, { wall: mix(st.wall, pal[j], .82), painted: 1 }); if (HTINT.size > 600) HTINT.clear(); HTINT.set(key, o); return o; }
  const k = (hk(B, 3) * 7) | 0; if (!k) return st;
  const key = st.wall + st.roof + st.accent + k; let o = HTINT.get(key); if (o) return o;
  const [col, f] = [null, ['#ffffff', .24], [st.accent, .17], ['#e6c393', .22], [st.roof, .13], ['#8f857f', .16], ['#f3d9c4', .2]][k];
  o = Object.assign({}, st, { wall: mix(st.wall, col, f), roof: k === 4 ? shade(st.roof, .88) : k === 2 ? shade(st.roof, 1.07) : k === 5 ? mix(st.roof, '#7a6a60', .2) : st.roof });
  if (HTINT.size > 600) HTINT.clear();
  HTINT.set(key, o); return o;
}
function dsFlat() { return DS && (DS.roofK === 'flat' || DS.roofK === 'garden' || (!DS.roofK && DS.shape === 'square')); }
// flat roofs get lived on: tanks, stair huts, awnings, pots, the odd little dome
const AWN_C = ['#c8433a', '#3f7a4f', '#d9a032', '#3f5f8a', '#8a3f5f'];
function shopfront(B) { return B.tier >= 4 && hk(B, 12) < .7 && zoneAt(idx(B.x, B.y)) === Z_CORE; } // flats over shops in the market quarter

// terraces: a townhouse, rowhouse or block of flats joins the neighbours that face the same street
const ROW_T = t => t >= 3 && t <= 5;
function houseAx(B) { // which way its street runs: 'u' (along x) or 'v' (along y); kept, so a row never flickers
  if (B.ax) return B.ax;
  const n = (dx, dy) => inb(B.x + dx, B.y + dy) && netTile(idx(B.x + dx, B.y + dy));
  const a = n(0, 1) || n(0, -1), b = n(1, 0) || n(-1, 0);
  return (B.ax = a && !b ? 'u' : b && !a ? 'v' : hk(B, 1) < .5 ? 'u' : 'v');
}
function rowStyleOK(B) { const st = S.styles[B.style]; return !(st && (st.shape === 'round' || st.shape === 'organic' || st.shape === 'tiered')); }
function rowMate(B, x, y, a) {
  if (!inb(x, y)) return false;
  const C = S.B[M.bld[idx(x, y)]];
  return !!C && C.type === 'house' && C.prog >= 1 && !C.hid && ROW_T(C.tier) && houseAx(C) === a && C.sid === B.sid && rowStyleOK(C) && surfZ(idx(x, y)) === surfZ(idx(B.x, B.y));
}
function houseJoin(B) {
  if (B.type !== 'house' || B.prog < 1 || !ROW_T(B.tier) || !rowStyleOK(B)) return null;
  const a = houseAx(B), dx = a === 'u' ? 1 : 0, dy = 1 - dx;
  const lo = rowMate(B, B.x - dx, B.y - dy, a), hi = rowMate(B, B.x + dx, B.y + dy, a);
  return lo || hi ? { a, lo, hi } : null;
}
function houseNbrDirty(B) { for (const [dx, dy] of N4) markDirtyXY(B.x + dx, B.y + dy); }



function drawConstruction(B, st, i) {
  if (FLAT_TYPES[B.type]) { flat(0, 0, .44, .44, .3, B.type === 'farm' ? '#c79b72' : '#cdbda3'); if (B.type === 'farm') GL_MODEL.farm(B, st); return; }
  flat(0, 0, .42, .42, .3, '#cdbda3');
  glBuildSite(B, st, B.prog, buildH(B)); // scaffolding, the walls going up, a crane on tall ones (gl.js)
}
