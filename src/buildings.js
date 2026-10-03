/* ============================== buildings: what each type looks like ============================== */
// Built into the 3D chunks (render.js primitives, gl.js helpers), tile-local: u, v in tiles from the middle of the tile,
// heights in height units (22 to a tile). Types with a native model in gl.js (GL_MODEL, GL_BIG) or works.js/house.js are
// handed over first; everything else is here.
const FLAT_TYPES = { farm: 1, solar: 1, airfield: 1, park: 1, plaza: 1, pasture: 1 };
function winCol(st, B) { return B.style >= 5 ? st.glass : '#4f5463'; }
function buildH(B) { return B.type === 'house' ? HOUSE_H[B.up != null ? B.up : B.tier] * .7 : (BT[B.type] ? BT[B.type].h * .55 : 20); }
// see-through shapes need no help; these are solid: a quad and a triangle by tile-local corners [u, v, z]
function tq(a, b, c, d, col, mat = 0, e = 0) { GLB.mat = mat; gquad(gw(...a), gw(...b), gw(...c), gw(...d), gcol(col), e); }
function tt(a, b, c, col, mat = 0, e = 0) { GLB.mat = mat; gtri(gw(...a), gw(...b), gw(...c), gcol(col), e); }
const mid = (...p) => { const n = p.length; return [p.reduce((s, q) => s + q[0], 0) / n, p.reduce((s, q) => s + q[1], 0) / n, p.reduce((s, q) => s + q[2], 0) / n]; };
function ctr(u, v, z) { GLB.ctr = gw(u, v, z); } // (faces turn away from here)
const glowAt = (u, v, z, r, col) => { GLB.mat = 0; glOBox(gw(u, v, z), [r, 0, 0], [0, 0, r], [0, r, 0], col, 3); }; // a light of its own colour: a beacon, a signal, a glowing stone
function parkTree(u, v, h, z = 0) { glSmallTree(u, v, z, h, 1.1, ['#5f9a4d', '#6aa556', '#ee9fbe', '#7fae5e'][((h * 7) | 0) % 4]); }
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
    case 'house': return drawHouse(B, st); // (the reshaping styles: round, organic, tiered, tall, low)
    case 'farm': return drawFarm(B, i);
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
function tieredBody(hw, hd, h, st, wc, glass) {
  const n = h > 26 ? 3 : 2; let z = 0, w = hw, d = hd;
  for (let k = 0; k < n; k++) {
    const hh = h / n;
    box(0, 0, w, d, z, hh, glass && k % 2 ? st.glass : st.wall);
    windows(0, 0, w, d, z, hh, Math.max(1, Math.round(hh / 6.5)), w > .3 ? 3 : 2, wc);
    z += hh;
    if (k < n - 1) { box(0, 0, w + .01, d + .01, z, 1, '#7cc47f'); w *= .76; d *= .76; z += 1; }
  }
  return [z, w, d];
}
const hk = (B, n) => hash2(B.id, n, 131); // a house's own dice, the same on every reload
const HTINT = new Map();
function houseTint(st, B) { // a little colour of its own: limewash, ochre, a door-colour wash...
  const k = (hk(B, 3) * 7) | 0; if (!k) return st;
  const key = st.wall + st.roof + st.accent + k; let o = HTINT.get(key); if (o) return o;
  const [col, f] = [null, ['#ffffff', .24], [st.accent, .17], ['#e6c393', .22], [st.roof, .13], ['#8f857f', .16], ['#f3d9c4', .2]][k];
  o = Object.assign({}, st, { wall: mix(st.wall, col, f), roof: k === 4 ? shade(st.roof, .88) : k === 2 ? shade(st.roof, 1.07) : k === 5 ? mix(st.roof, '#7a6a60', .2) : st.roof });
  if (HTINT.size > 600) HTINT.clear();
  HTINT.set(key, o); return o;
}
function dsFlat() { return DS && (DS.roofK === 'flat' || DS.roofK === 'garden' || (!DS.roofK && DS.shape === 'square')); }
// flat roofs get lived on: tanks, stair huts, awnings, pots, the odd little dome
function roofBits(u0, v0, hw, hd, z, st, B) {
  const k = (hk(B, 7) * 6) | 0, z1 = z + 1.3;
  if (k === 0) cyl(u0 + hw * .45, v0 - hd * .4, .06, z1, 5, '#8a7d73');
  else if (k === 1) box(u0 - hw * .45, v0 - hd * .45, .09, .08, z1, 4, shade(st.wall, .92));
  else if (k === 2) { for (const [a, b] of [[-.1, -.08], [.1, -.08], [-.1, .08], [.1, .08]]) post(u0 + a, v0 + b, 4, .004, shade(st.trim, .9), z1); flat(u0, v0, .12, .1, z1 + 4, st.accent); }
  else if (k === 3) for (let n = 0; n < 3; n++) ball(u0 - hw * .6 + n * hw * .35, v0 + hd * .55, .04, z1 + 1, 1.2, leafC('#6db873'));
  else if (k === 4 && hw >= .22 && hd >= .22) dome(u0 - hw * .2, v0 - hd * .2, .11, z1, 4.5, st.roof);
}
function porch(u0, v0, hd, st) { for (const a of [-.1, .1]) post(u0 + a, v0 + hd + .1, 4.5, .006, shade(st.trim, .9)); box(u0, v0 + hd + .055, .13, .06, 4.5, .8, st.roof); } // a canopy on two posts by the door
const AWN_C = ['#c8433a', '#3f7a4f', '#d9a032', '#3f5f8a', '#8a3f5f'];
function awning(u0, v0, hw, hd, st, U) { const k = (hash2(GLB.x, GLB.y, 919) * 6) | 0; glAwning(u0, v0, hw, hd, k < 5 ? AWN_C[k] : st.accent, U); } // shopfronts: a striped awning over the ground floor
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
function drawRow(B, st, J, hm, wc) { // a terrace house (townhouses and blocks of flats: the rowhouse has its own model, house.js)
  const t = B.tier, U = J.a === 'u', r = hash2(U ? B.y : B.x, t * 7 + B.sid, 57); // one street, one roofline (more or less)
  const eLo = J.lo ? .5 : .36, eHi = J.hi ? .5 : .36, o = (eHi - eLo) / 2, L = (eHi + eLo) / 2, D = t === 3 ? .28 : .34;
  const u0 = U ? o : 0, v0 = U ? 0 : o, hw = U ? L : D, hd = U ? D : L;
  const h = (t === 3 ? 12 + (r < .5 ? 0 : 3) + (hk(B, 9) < .3 ? 2.5 : 0) : t === 4 ? 18 + ((r * 5) % 1) * 5 + (hk(B, 9) < .25 ? 3 : 0) : 28 + r * 16) * hm;
  box(u0, v0, hw, hd, 0, h, st.wall);
  windows(u0, v0, hw, hd, 0, h, Math.max(1, Math.round(h / 6.4)), 3, wc);
  for (const [on, e] of [[J.lo, -.5], [J.hi, .5]]) if (on && GLB.lod) box(U ? e - Math.sign(e) * .008 : u0 + hw, U ? v0 + hd : e - Math.sign(e) * .008, U ? .008 : .006, U ? .006 : .008, 0, h, shade(st.wall, .9)); // the party wall shows on the front
  const shop = t >= 4 && shopfront(B);
  if (shop) awning(u0, v0, hw, hd, st, U);
  else if (U) door(u0 - L * .3, 0, hd, .09, 4.4, shade(st.trim, .9));
  else { GLB.mat = 0; glOBox(gw(hw + .004, v0 + L * .3, 2.2), [.002, 0, 0], [0, 0, .045], [0, 2.2 * ZS, 0], shade(st.trim, .9), .5); }
  if (t === 5 && (r * 13) % 1 < .45) for (let z = 8; z < h - 2; z += 6) box(U ? u0 : u0 + hw + .015, U ? v0 + hd + .015 : v0, U ? hw * .9 : .03, U ? .03 : hd * .9, z, 1, st.accent); // balconies down the street
  if (t >= 4) box(u0, v0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.22)); // cornice
  const pitched = !dsFlat() && !hasTech('computing'); // (terraces keep pitched roofs, chimneys at the party walls, until the modern blocks come)
  if (t === 3 || (t === 4 && (r < .55 || pitched)) || t === 5 && pitched) roofGable(u0, v0, hw, hd, h + (t >= 4 ? 1.4 : 0), t === 3 ? 6 : t === 5 ? 6 : 4.5, st.roof, st.wall, U);
  else roofBits(u0, v0, hw, hd, h, st, B);
  if (t === 3 && dsFlat()) roofBits(u0, v0, hw, hd, h, st, B);
}
function drawHouse(B, st) {
  const t = B.tier, v = B.var || 0, au = v < .5;
  const u0 = (v - .5) * .08, v0 = ((v * 7) % 1 - .5) * .08;
  if (t <= 1 && DS) { const sv = DS; DS = null; try { drawHouse(B, st); } finally { DS = sv; } return; }
  st = houseTint(st, B); const wc = winCol(st, B);
  const shp = st.shape, hm = SHAPE_HM[shp] || 1, wm = SHAPE_WM[shp] || 1;
  const J = houseJoin(B); if (J) return drawRow(B, st, J, hm, wc);
  if (shp === 'tiered' && t >= 3 && t <= 6) {
    const hw = [0, 0, 0, .34, .4, .4, .38][t], H0 = [0, 0, 0, 16, 22, 34 + ((v * 3) % 1) * 20, 60 + ((v * 5) % 1) * 50][t];
    const [z, w, d] = tieredBody(hw, hw, H0, st, wc, t === 6);
    door(-.1, 0, hw, .09, 4.4, shade(st.trim, .9)); roofPyr(0, 0, w, d, z, t >= 5 ? 5 : 6, st.roof);
    return;
  }
  if (t === 6 && dsRound()) { // a round glass tower, ringed at each floor, with a crown
    const h = (58 + ((v * 5) % 1) * 62) * hm, r = .33 * wm;
    cyl(0, 0, r, 0, h * .82, st.glass); for (let z = 8; z < h * .82; z += 8) ring(0, 0, r + .004, .006, z, st.trim, 0, TAU, 20);
    cylWindows(0, 0, r + .004, 0, h * .82, Math.floor(h * .82 / 8), 5, st.glass);
    cyl(0, 0, r * .78, h * .82, h * .18, shade(st.glass, 1.06));
    if (st.roofK === 'dome') dome(0, 0, r * .78, h, 9, st.roof); else if (st.roofK === 'garden') { cyl(0, 0, r * .8, h, 1, '#7cc47f'); parkTree(0, 0, v, h + 1); }
    beam(0, 0, h, 0, 0, h + 12, .006, '#9aa3ad'); if (h > 90) glowAt(0, 0, h + 12.4, .012, '#ff5a5a');
    return;
  }
  if (hm !== 1 && t >= 2 && t <= 6) return drawHouseScaled(B, st, hm, wm, u0, v0, wc);
  switch (t) {
    case 0: { roofPyr(u0, v0, .24, .2, 0, 10, v < .5 ? '#e89f6b' : '#d9dde6'); door(u0, v0, .2, .08, 4, '#5b4a42'); return; } // a shelter
    case 1: { cyl(u0, 0, .24, 0, 5, st.wall); door(u0, 0, .23, .08, 4, '#5b4a42'); cone(u0, 0, 5, .31, 10, st.roof); return; } // a round hut
    case 2: { // a cottage: sometimes a wing, a kitchen garden, a porch
      const wing = hk(B, 4) < .42, flatR = dsFlat();
      let hw = (au ? .3 : .22) + (hk(B, 1) - .5) * .05, hd = (au ? .22 : .3) + (hk(B, 2) - .5) * .05, uu = u0, h = hk(B, 3) < .18 ? 9.5 : 7;
      if (hk(B, 6) < .28) { flat(-.28, -.28, .16, .16, .4, '#8a6a48'); if (GLB.lod) for (let n = 0; n < 4; n++) flowersAt(-.38 + n * .07, -.2 - (n % 2) * .08, (n + (hk(B, 6) * 40 | 0)) / 9, .5); } // a kitchen garden out the back
      if (wing) { hw = Math.min(hw, .24); uu = .1; box(-.24, v0 - .04, .14, .15, 0, 5, st.wall); roofGable(-.24, v0 - .04, .14, .15, 5, 4, st.roof, st.wall, !au); } // an L-shaped wing
      box(uu, v0, hw, hd, 0, h, st.wall); door(uu - hw * .3, v0, hd, .09, 4.4, shade(st.trim, .9));
      windows(uu, v0, hw, hd, 0, h, h > 8 ? 2 : 1, 2, wc); roofGable(uu, v0, hw, hd, h, 6, st.roof, st.wall, au);
      if (flatR) roofBits(uu, v0, hw, hd, h, st, B);
      if (hk(B, 5) < .35) porch(uu - hw * .3, v0, hd, st);
      return;
    }
    case 3: { // a townhouse: a wing, a balcony, a bay window
      const wing = hk(B, 4) < .35, flatR = dsFlat();
      let hw = .32 + (hk(B, 1) - .5) * .04, hd = .28 + (hk(B, 2) - .5) * .04, uu = 0, h = hk(B, 3) < .25 ? 15.5 : 13;
      if (wing) { hw = .26; uu = .08; box(-.3, -.06, .14, .18, 0, 8, st.wall); windows(-.3, -.06, .14, .18, 0, 8, 1, 1, wc); roofGable(-.3, -.06, .14, .18, 8, 4, st.roof, st.wall, false); }
      box(uu, 0, hw, hd, 0, h, st.wall); windows(uu, 0, hw, hd, 0, h, 2, 3, wc); door(uu - .1, 0, hd, .09, 4.4, shade(st.trim, .9));
      if (hk(B, 5) < .3) box(uu, hd + .015, hw * .7, .03, 7, .9, st.accent); // a balcony rail
      if (v < .5) roofPyr(uu, 0, hw, hd, h, 7, st.roof); else roofGable(uu, 0, hw, hd, h, 7, st.roof, st.wall, v < .75);
      if (flatR) roofBits(uu, 0, hw, hd, h, st, B);
      if (hk(B, 6) < .3) { box(uu + .1, hd + .06, .08, .06, 0, 8, st.wall); windows(uu + .1, hd + .06, .08, .06, 0, 8, 1, 1, wc); roofPyr(uu + .1, hd + .06, .08, .06, 8, 3, st.roof); } // a bay window
      return;
    }
    case 4: { // a rowhouse standing alone in the modern era (before Computing it has its own model: house.js)
      const hw = .38, hd = .36, h = hk(B, 3) < .3 ? 22 : 19, flatR = dsFlat();
      if (hk(B, 4) < .3) box(-.1, -.4, .28, .06, 0, 11, shade(st.wall, .95)); // a lower back range
      box(0, 0, hw, hd, 0, h, st.wall); windows(0, 0, hw, hd, 0, h, h > 20 ? 4 : 3, 3, wc);
      box(0, 0, hw + .02, hd + .02, h, 1.5, shade(st.trim, 1.25));
      if (shopfront(B)) awning(0, 0, hw, hd, st, true); else box(0, hd + .02, hw, .03, 7, .8, st.accent);
      if (flatR || v > .5 && hasTech('computing')) { box(-.15, -.1, .08, .08, h + 1.5, 5, shade(st.wall, .95)); if (flatR) roofBits(0, 0, hw, hd, h + 1.5, st, B); }
      else if ((hk(B, 13) < .4 || v > .5) && hasTech('steam')) roofMansard(0, 0, hw, hd, h + 1.5, 6, st.roof); // a mansard on the grander townhouses
      else roofGable(0, 0, hw, hd, h + 1.5, 5, st.roof, st.wall, true);
      if (hk(B, 5) < .22) { cyl(hw - .02, hd - .02, .1, 0, h + 3, st.wall); cone(hw - .02, hd - .02, h + 3, .13, 7, st.roof); } // a corner turret
      return;
    }
    case 5: { // the engineers' blocks of flats
      const kind = Math.floor(((v * 13) % 1) * 4);
      const h = 30 + ((v * 3) % 1) * 22, hw = .31 + ((v * 7) % 1) * .07, hd = .31 + ((v * 11) % 1) * .07;
      const wall = kind === 3 ? mix(st.wall, st.accent, .22) : kind === 1 ? mix(st.wall, st.roof, .12) : st.wall;
      box(0, 0, hw, hd, 0, h, wall); windows(0, 0, hw, hd, 0, h, Math.round(h / 6), 4, wc);
      if (!hasTech('computing') && !dsFlat()) { // a mansard, and iron balconies on some
        if (kind === 3) for (let z = 8; z < h - 2; z += 6) box(0, hd + .015, hw * .9, .03, z, 1, st.accent);
        box(0, 0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.2)); roofMansard(0, 0, hw + .02, hd + .02, h + 1.4, 8, st.roof);
        if (hk(B, 14) < .5) awning(0, 0, hw, hd, st, hk(B, 15) < .5);
      } else if (kind === 0) { box(0, 0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.2)); box(-.12, -.12, .1, .08, h + 1.4, 4, shade(wall, .92)); cyl(.15, -.1, .05, h + 1.4, 5, '#8a7d73'); } // a flat roof, a stair box and a water tank
      else if (kind === 1) roofMansard(0, 0, hw + .02, hd + .02, h, 7, st.roof);
      else if (kind === 2) { box(0, 0, hw + .015, hd + .015, h, 1.2, shade(st.trim, 1.2)); box(-.06, -.06, hw * .6, hd * .6, h + 1.2, 6, shade(wall, 1.05)); windows(-.06, -.06, hw * .6, hd * .6, h + 1.2, 6, 1, 2, wc); parkTree(.2, .2, v, h + 1.2); } // a setback penthouse with a roof garden
      else { for (let z = 8; z < h - 2; z += 6) box(0, hd + .015, hw * .9, .03, z, 1, st.accent); box(0, 0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.2)); } // balconies
      return;
    }
    case 6: { // a tower: by its form a podium of shops, stepped back, banded, or with a helipad
      const h = 58 + ((v * 5) % 1) * 62, form = (hk(B, 10) * 5) | 0, gk = (hk(B, 11) * 5) | 0, sv = GLB.wall;
      if (gk) st = Object.assign({}, st, { glass: mix(st.glass, ['', '#ffffff', '#6fc8b8', '#e6c28a', '#8f9cf0'][gk], .28) }); // each tower has its own tint of glass
      if (form === 1) { box(0, 0, .45, .45, 0, 9, st.wall); windows(0, 0, .45, .45, 0, 9, 1, 4, wc); awning(0, 0, .45, .45, st, true); }
      let hw = form === 1 ? .28 : .33;
      if (form === 2) { GLB.wall = M_GLASS; box(0, 0, .4, .4, 0, h * .35, st.glass); GLB.wall = sv; windows(0, 0, .4, .4, 0, h * .35, Math.floor(h * .35 / 8), 4, st.glass); box(0, 0, .41, .41, h * .35, 1.2, st.wall); hw = .27; }
      if (form === 3) { // banded: stone floors between the glass
        box(0, 0, hw, hw, 0, h * .82, st.wall); for (let z = 3; z < h * .82 - 3; z += 7) box(0, 0, hw + .004, hw + .004, z, 4, st.glass);
        box(0, 0, hw * .8, hw * .8, h * .82 - .5, 1, st.wall); roofPyr(0, 0, hw * .8, hw * .8, h * .82 + .5, 10, st.roof);
        beam(0, 0, h * .82 + 10, 0, 0, h * .82 + 18, .005, '#9aa3ad'); return;
      }
      const zb = form === 2 ? h * .35 + 1.2 : form === 1 ? 9 : 0;
      GLB.wall = M_GLASS; box(0, 0, hw, hw, zb, h * .82 - zb, st.glass); box(0, 0, hw * .78, hw * .78, h * .82, h * .18, shade(st.glass, 1.06)); GLB.wall = sv; // (curtain walls get their mullions: gl.js glBox)
      windows(0, 0, hw, hw, zb, h * .82 - zb, Math.floor((h * .82 - zb) / 8), 4, st.glass);
      box(0, 0, hw * .8, hw * .8, h * .82 - .5, 1, st.wall);
      if (form === 4) { disc(0, 0, .2, h + .2, '#5d646c'); for (const [a, b, c2] of [[-.045, 0, .006], [.045, 0, .006], [0, 0, 0]]) box(a, b, c2 || .045, c2 ? .045 : .006, h + .4, .2, '#f0f0f0'); return; } // a helipad
      beam(0, 0, h, 0, 0, h + 12, .006, '#9aa3ad'); if (h > 90) glowAt(0, 0, h + 12.4, .012, '#ff5a5a');
      return;
    }
    default: { // an arcology: terraces of glass and garden, a mast on top
      let z = 0;
      for (let k = 0; k < 4; k++) { const hw = .47 - k * .09, hh = 34 + ((v * (k + 2)) % 1) * 10;
        box(0, 0, hw, hw, z, hh, k % 2 ? st.wall : st.glass); windows(0, 0, hw, hw, z, hh, Math.round(hh / 7), 4, k % 2 ? st.glass : shade(st.glass, .8));
        box(0, 0, hw + .01, hw + .01, z + hh, 1.2, '#7cc47f'); if (GLB.lod) for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) ball(a * hw * .8, b * hw * .8, .05, z + hh + 2, 1.6, leafC('#5f9a4d'));
        z += hh + 1.2; }
      beam(0, 0, z, 0, 0, z + 14, .012, st.accent); glowAt(0, 0, z + 14.5, .02, '#ff6a6a');
    }
  }
}
function drawHouseScaled(B, st, hm, wm, u0, v0, wc) { // the tall and low styles
  const t = B.tier, v = B.var || 0, au = v < .5, S_ = x => Math.min(.46, x * wm);
  if (t === 2) { const hw = S_(au ? .3 : .22), hd = S_(au ? .22 : .3), h = 7 * hm; box(u0, v0, hw, hd, 0, h, st.wall); door(u0 - hw * .3, v0, hd, .09, 4.4, shade(st.trim, .9)); windows(u0, v0, hw, hd, 0, h, Math.max(1, Math.round(h / 7)), 2, wc); roofGable(u0, v0, hw, hd, h, 6, st.roof, st.wall, au); return; }
  if (t === 3) { const hw = S_(.32), hd = S_(.28), h = 13 * hm; box(0, 0, hw, hd, 0, h, st.wall); windows(0, 0, hw, hd, 0, h, Math.max(1, Math.round(h / 6.5)), 3, wc); door(-.1, 0, hd, .09, 4.4, shade(st.trim, .9)); if (v < .5) roofPyr(0, 0, hw, hd, h, 7, st.roof); else roofGable(0, 0, hw, hd, h, 7, st.roof, st.wall, v < .75); return; }
  if (t === 4) { const hw = S_(.38), hd = S_(.36), h = 19 * hm; box(0, 0, hw, hd, 0, h, st.wall); windows(0, 0, hw, hd, 0, h, Math.max(1, Math.round(h / 6.3)), 3, wc); box(0, 0, hw + .02, hd + .02, h, 1.5, shade(st.trim, 1.25)); box(0, hd + .02, hw, .03, 7, .8, st.accent); roofGable(0, 0, hw, hd, h + 1.5, 5, st.roof, st.wall, true); return; }
  if (t === 5) { const h = (30 + ((v * 3) % 1) * 22) * hm, hw = S_(.31 + ((v * 7) % 1) * .07), hd = S_(.31 + ((v * 11) % 1) * .07); box(0, 0, hw, hd, 0, h, st.wall); windows(0, 0, hw, hd, 0, h, Math.max(1, Math.round(h / 6)), 4, wc); if (st.roofK) roofPyr(0, 0, hw, hd, h, 6, st.roof); else { box(0, 0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.2)); box(-.12, -.12, .1, .08, h + 1.4, 4, shade(st.wall, .92)); } return; }
  const h = (58 + ((v * 5) % 1) * 62) * hm, hw = S_(.33), sv = GLB.wall;
  GLB.wall = M_GLASS; box(0, 0, hw, hw, 0, h * .82, st.glass); box(0, 0, hw * .78, hw * .78, h * .82, h * .18, shade(st.glass, 1.06)); GLB.wall = sv;
  windows(0, 0, hw, hw, 0, h * .82, Math.floor(h * .82 / 8), 4, st.glass);
  if (st.roofK) roofPyr(0, 0, hw * .78, hw * .78, h, 6, st.roof);
  beam(0, 0, h, 0, 0, h + 12, .006, '#9aa3ad'); if (h > 90) glowAt(0, 0, h + 12.4, .012, '#ff5a5a');
}

function drawFarm(B, i) {
  const T = S.T[B.sid], st = S.styles[B.style] || STYLES0[0], fk = st.fields || (dsRound() ? 'round' : null);
  const crop = T ? CROPS[T.crop % CROPS.length].c : '#f0a04b', soil = '#bd8f68', au = (B.var || 0) < .5, rows = 5, green = hasTech('genegarden'), grown = B.prog >= 1 ? 1 : B.prog;
  if (fk === 'round') { // centre-pivot rings, and the pivot's arm
    disc(0, 0, .47, .3, soil); for (let k = 0; k < 4; k++) { if (k / 4 > grown) break; const r = .42 - k * .1; ring(0, 0, r + .03, .06, 1, k % 2 ? shade(crop, .82) : crop, 0, TAU, 24, 0, M_CROP); }
    const a = (B.var || 0) * TAU; beam(0, 0, 2, Math.cos(a) * .44, Math.sin(a) * .44, 2, .006, '#d9d4cc'); post(0, 0, 3, .012, '#9aa0a6'); return;
  }
  if (fk === 'orchard') { // trees in rows, fruit on them
    flat(0, 0, .46, .46, .3, '#9fcf8f');
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if ((a * 3 + b) / 9 > grown) break; const u = -.3 + a * .3, w = -.3 + b * .3; glSmallTree(u, w, 0, .5, .9, '#6db873'); if (GLB.lod) for (let q = 0; q < 3; q++) ball(u + Math.cos(q * 2.1) * .06, w + Math.sin(q * 2.1) * .06, .015, 6.5 + q * .4, .8, crop, 0); }
    return;
  }
  flat(0, 0, .46, .46, .3, soil);
  for (let k = 0; k < rows; k++) {
    const o = -.36 + k * .18; if (k / rows > grown) break;
    const col = fk === 'flowers' ? FLOWERS[(k + ((B.var || 0) * 5 | 0)) % FLOWERS.length] : fk === 'stripes' && k % 2 ? mix(crop, st.accent, .55) : green && k % 2 ? shade(crop, 1.1) : crop;
    if (au) flat(0, o, .42, .05, 2, col); else flat(o, 0, .05, .42, 2, col);
  }
  for (const [u, w] of [[-.46, -.46], [.46, -.46], [-.46, .46], [.46, .46]]) post(u, w, 2.5, .007, '#8a6d57'); // corner posts
  if (GLB.lod && hash2(B.x, B.y, 77) < .3 && B.prog >= 1) { kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const s = au ? .4 : .27, f = au ? .27 : .4; // a scarecrow
    kBox(s, f, 0, .004, .004, .14, '#6b5040', M_PLANK); kBeam([s - .04, f, .1], [s + .04, f, .1], .003, '#6b5040', M_PLANK); kBox(s, f, .07, .018, .012, .045, ['#6a5a8a', '#8a4a3a', '#4a6a5a'][(B.id | 0) % 3], M_PLANK);
    kBlob(s, f, .13, .014, .015, '#d8b86a', M_THATCH); kCone(s, f, .14, .022, .025, '#3a3430', 8, 0); for (const dd of [-1, 1]) kBlob(s + dd * .043, f, .1, .006, .01, '#d8b86a', M_THATCH); }
}


function drawConstruction(B, st, i) {
  if (FLAT_TYPES[B.type]) { flat(0, 0, .44, .44, .3, B.type === 'farm' ? '#c79b72' : '#cdbda3'); if (B.type === 'farm') drawFarm(B, i); return; }
  flat(0, 0, .42, .42, .3, '#cdbda3');
  glBuildSite(B, st, B.prog, buildH(B)); // scaffolding, the walls going up, a crane on tall ones (gl.js)
}
