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
  switch (B.type) {
    case 'pod': return glPod(B);
    case 'house': return drawHouse(B, st);
    case 'shops': return drawShops(B, st);
    case 'farm': return drawFarm(B, i);
    case 'plaza': return drawPlaza(B, st);
    case 'dock': { // a boathouse, and a timber pier out over the water with a lantern at its end
      box(-.1, -.1, .2, .16, 0, 6, mix(st.wall, '#a57f5e', .5)); roofGable(-.1, -.1, .2, .16, 6, 3.5, st.roof, st.wall, true);
      const d = B.dir || [1, 0], s = [d[1], d[0]], A = (a, b) => [d[0] * a + s[0] * b, d[1] * a + s[1] * b];
      GLB.wall = M_PLANK; box(...A(.28, 0), Math.abs(d[0]) * .23 + Math.abs(s[0]) * .065, Math.abs(d[1]) * .23 + Math.abs(s[1]) * .065, 0, 1, '#9b7657');
      for (const a of [.12, .3, .48]) for (const b of [-.06, .06]) { const [u, w] = A(a, b); post(u, w, 1, .01, '#6b5040', -3); }
      { const [u, w] = A(.46, .08); post(u, w, 6, .005, '#6b5040', 1); lamp(u, w, 6.3, .014); }
      return;
    }
    case 'market': { // three stalls under striped canopies
      const cols = [st.accent, '#e9c46a', '#e76f51'];
      [[-.2, -.12], [.16, -.2], [.02, .18]].forEach(([u, w], k) => {
        GLB.wall = M_PLANK; box(u, w, .1, .1, 0, 3.4, mix(st.wall, '#c9a47e', .4)); GLB.wall = 0;
        for (const [a, b] of [[-.12, -.12], [.12, -.12], [-.12, .13], [.12, .13]]) post(u + a, w + b, b < 0 ? 6.5 : 4.2, .004, '#6b5040');
        ctr(u, w, 0); tq([u - .13, w - .13, 6.5], [u + .13, w - .13, 6.5], [u + .14, w + .15, 4.2], [u - .14, w + .15, 4.2], cols[k]);
        tq([u - .04, w - .13, 6.52], [u + .04, w - .13, 6.52], [u + .04, w + .15, 4.22], [u - .04, w + .15, 4.22], '#fff6ea');
        if (GLB.lod) for (let q = 0; q < 3; q++) ball(u - .06 + q * .06, w + .06, .022, 3.6, .8, ['#e05b52', '#f2c14e', '#7fb069'][(q + k) % 3]); // what's for sale
        lamp(u, w + .14, 4, .01);
      });
      return;
    }
    case 'school': {
      box(0, 0, .34, .24, 0, 10, st.wall); windows(0, 0, .34, .24, 0, 10, 1, 3, winCol(st, B));
      door(0, 0, .24, .1, 5, shade(st.trim, .9)); roofGable(0, 0, .34, .24, 10, 6, st.roof, st.wall, true);
      box(.18, 0, .06, .06, 13, 6, st.wall); roofPyr(.18, 0, .07, .07, 19, 5, st.roof); // the bell tower
      if (GLB.lod) ball(.18, 0, .025, 15.5, .9, '#c9a447', 0); // its bell
      return;
    }
    case 'library': {
      box(0, -.04, .36, .28, 0, 12, st.wall); windows(0, -.04, .36, .28, 0, 12, 1, 3, winCol(st, B));
      for (let k = 0; k < 4; k++) cyl(-.27 + k * .18, .3, .03, 0, 11, shade(st.wall, 1.08), null, 8); // columns
      box(0, .3, .36, .06, 11, 2, shade(st.wall, 1.02)); dome(0, -.04, .17, 12, 9, st.roof);
      return;
    }
    case 'workshop': {
      box(0, 0, .3, .26, 0, 8, st.wall); windows(0, 0, .3, .26, 0, 8, 1, 2, winCol(st, B));
      door(-.1, 0, .26, .14, 5.5, '#5c4a3e'); roofGable(0, 0, .3, .26, 8, 5, st.roof, st.wall, v < .5);
      box(.16, -.14, .05, .05, 8, 12, '#8f6f62'); return; // the forge chimney (it smokes: gl.js SMOKE_AT)
    }
    case 'mine': { // a mound with the adit in it, a cart at the mouth and the headframe over the shaft (works.js)
      roofPyr(0, 0, .36, .36, 0, 10, '#9e95a8'); door(-.05, 0, .36, .16, 5, '#2f2a33');
      box(.05, .3, .06, .04, 0, 2.5, '#6b6470'); for (const r of [-.03, .03]) beam(-.05 + r, .36, .2, -.05 + r, .5, .2, .004, '#5a5f66');
      glMineFrame(B); return;
    }
    case 'lumber': return drawLumber(B, st, i);
    case 'harbor': return glHarbour(B);
    case 'lighthouse': return drawLighthouse(B, st);
    case 'quarry': return drawQuarry(B, i);
    case 'claypit': return drawClaypit(B, i);
    case 'mill': { cyl(0, 0, .17, 0, 16, st.wall); door(0, 0, .16, .08, 4.5, '#5c4a3e'); cone(0, 0, 16, .2, 8, st.roof); return; } // (the sails turn: works.js)
    case 'hall': { // a town hall before it spreads onto its bigger lot (gl.js glBigHall after)
      box(0, 0, .4, .3, 0, 13, st.wall); windows(0, 0, .4, .3, 0, 13, 2, 4, winCol(st, B));
      door(0, 0, .3, .12, 6, shade(st.trim, .9)); roofPyr(0, 0, .4, .3, 13, 5, st.roof);
      box(0, 0, .1, .1, 15, 17, shade(st.wall, 1.03)); roofPyr(0, 0, .11, .11, 32, 9, st.roof);
      clockFace(0, .1, 26.5, .045); return;
    }
    case 'observatory': {
      cyl(0, 0, .22, 0, 10, st.wall); dome(0, 0, .22, 10, 9, '#f1f1f4');
      box(.07, -.02, .03, .06, 14, 6, '#c9ccd2'); beam(.02, 0, 16, .16, .06, 22, .022, '#3a3f4a'); // the slit, and the telescope poking out
      return;
    }
    case 'works': { // a sawtooth roof of north lights over the shop floor, and a tall chimney
      box(0, 0, .42, .3, 0, 12, st.wall); windows(0, 0, .42, .3, 0, 12, 2, 5, winCol(st, B));
      for (let k = 0; k < 3; k++) { const u = -.28 + k * .28; ctr(u, 0, 0);
        tq([u - .14, -.3, 12], [u - .14, .3, 12], [u + .14, .3, 18], [u + .14, -.3, 18], shade(st.roof, .95), roofMat(gcol(st.roof)));
        tq([u + .14, -.3, 18], [u + .14, .3, 18], [u + .14, .3, 12], [u + .14, -.3, 12], shade(st.glass, .8), M_GLASS);
        for (const w of [-.3, .3]) tt([u - .14, w, 12], [u + .14, w, 12], [u + .14, w, 18], st.wall, GLB.wall); }
      cyl(.28, -.18, .055, 12, 30, '#9a5c4c', '#3a3434'); return;
    }
    case 'station': { // (before it spreads: gl.js glBigStation after)
      box(0, 0, .42, .24, 0, 9, st.wall); windows(0, 0, .42, .24, 0, 9, 1, 5, winCol(st, B));
      roofGable(0, 0, .44, .26, 9, 7, shade(st.glass, .9), st.wall, true); clockFace(.442, 0, 12, .03, true);
      for (const u of [-.3, .3]) { post(u, .3, 8, .006, '#4c4f58'); lamp(u, .3, 8.3, .016); }
      return;
    }
    case 'clinic': {
      box(0, 0, .32, .3, 0, 13, '#f3f1ee'); windows(0, 0, .32, .3, 0, 13, 2, 3, winCol(st, B));
      box(0, 0, .33, .31, 13, 1.2, shade(st.trim, 1.3));
      GLB.mat = 0; for (const [a, b] of [[.05, .014], [.014, .05]]) glOBox(gw(-.12, .312, 9), [a, 0, 0], [0, 0, .004], [0, b, 0], '#e25d5d', 3); // a red cross that shines at night
      door(.08, 0, .3, .1, 5, '#e8e8e8'); return;
    }
    case 'power': {
      box(0, 0, .36, .28, 0, 14, st.wall); windows(0, 0, .36, .28, 0, 14, 2, 3, winCol(st, B));
      roofGable(0, 0, .36, .28, 14, 4, st.roof, st.wall, true);
      for (const u of [-.16, .16]) cyl(u, -.2, .06, 14, 22, '#a39a92', '#333'); return;
    }
    case 'turbine': return glTurbine(B);
    case 'mast': { // a lattice radio mast on three legs, red and white, with a light on top
      const L = [[-.18, .12], [.18, .12], [0, -.2]], T = 66;
      for (const [u, w] of L) beam(u, w, 0, 0, 0, T, .008, '#c0584f');
      for (let k = 1; k < 9; k++) { const f = k / 9, p = L.map(([u, w]) => [u * (1 - f), w * (1 - f)]), z = T * f, col = k % 2 ? '#c0584f' : '#f3efe9';
        for (let q = 0; q < 3; q++) { const a = p[q], b = p[(q + 1) % 3]; beam(a[0], a[1], z, b[0], b[1], z, .004, col); } }
      glowAt(0, 0, T + .6, .016, '#ff4d4d'); box(.25, .2, .1, .08, 0, 4, st.wall); return;
    }
    case 'airfield': {
      flat(0, 0, .48, .48, .3, '#b8b9bb'); flat(0, .08, .48, .13, .5, '#707378');
      for (let k = 0; k < 4; k++) flat(-.36 + k * .24, .08, .06, .015, .7, '#f5f5f0');
      for (let k = 0; k < 6; k++) for (const w of [-.04, .2]) glowAt(-.44 + k * .176, w, .9, .008, k % 5 ? '#bfe0ff' : '#9dff9d'); // runway lights
      box(.3, -.3, .07, .07, 0, 12, st.wall); box(.3, -.3, .09, .09, 12, 3, st.glass); glowAt(.3, -.3, 15.4, .012, '#bfe8ff');
      box(-.26, -.28, .16, .12, 0, 5, shade(st.roof, 1.1)); roofGable(-.26, -.28, .16, .12, 5, 2.5, shade(st.roof, .9), shade(st.roof, 1.1), true); return;
    }
    case 'university': { // (before it spreads: gl.js glBigUniversity after)
      box(0, 0, .44, .36, 0, 16, st.wall); windows(0, 0, .44, .36, 0, 16, 3, 5, winCol(st, B));
      for (let k = 0; k < 5; k++) cyl(-.3 + k * .15, .38, .025, 0, 14, shade(st.wall, 1.1), null, 8);
      box(0, 0, .45, .37, 16, 1.4, shade(st.trim, 1.2)); dome(0, 0, .19, 17, 13, st.roof); return;
    }
    case 'antenna': { // the weave relay: a mast with a dish on it
      box(0, 0, .2, .2, 0, 8, st.wall); beam(0, 0, 8, 0, 0, 46, .012, '#b9c0c9');
      dish(.04, 0, 42, .14, [.8, .5, .3], '#e9edf2'); glowAt(0, 0, 46.6, .01, '#ff4d4d'); return;
    }
    case 'solar': { // rows of panels tilted to the sun
      flat(0, 0, .46, .46, .2, '#c7c3b5');
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const u = -.3 + a * .3, w = -.3 + b * .3; ctr(u, w, -5);
        tq([u - .12, w - .1, 3], [u + .12, w - .1, 3], [u + .12, w + .1, 1], [u - .12, w + .1, 1], '#2f4e7a', M_GLASS);
        if (GLB.lod) for (const s of [-.09, .09]) post(u + s, w - .08, 2.8, .004, '#8c9199'); }
      return;
    }
    case 'vfarm': { // the gene garden: a glass tower of growing floors, lit pink at night
      box(0, 0, .34, .34, 0, 30, st.glass);
      for (let k = 1; k < 5; k++) { box(0, 0, .345, .345, k * 6, 1.3, '#6fbf73'); if (GLB.lod) for (const [u, w] of [[0, .346], [.346, 0], [0, -.346], [-.346, 0]]) { GLB.mat = 0; glOBox(gw(u, w, k * 6 - 2.5), [w ? .25 : .002, 0, 0], [0, 0, u ? .25 : .002], [0, .012, 0], '#ff7ad9', 3); } }
      domeFrame(0, 0, .3, 30, 9, '#bfe8c4'); parkTree(0, 0, .1, 30); return;
    }
    case 'park': {
      if (dsRound()) { flat(0, 0, .47, .47, .2, '#a4dfa9'); ring(0, 0, .31, .05, .35, '#eadbc1'); cyl(0, 0, .1, 0, 1.5, '#d8d2c8', '#7fc7de'); for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + v; parkTree(Math.cos(a) * .38, Math.sin(a) * .38, v + k * .21); } return; }
      flat(0, 0, .47, .47, .2, '#a4dfa9'); flat(0, 0, .47, .06, .35, '#eadbc1'); flat(0, 0, .06, .47, .35, '#eadbc1');
      cyl(0, 0, .1, 0, 1.5, '#d8d2c8', '#7fc7de'); if (GLB.lod) post(0, 0, 3, .006, '#bfe7f2', 1.5); // a fountain
      parkTree(-.26, -.26, v); parkTree(.26, -.24, v + .3); parkTree(-.25, .26, v + .6); parkTree(.27, .26, v + .9);
      for (const [u, w] of [[-.12, .2], [.2, -.12]]) benchAt(u, w, '#6b5040');
      return;
    }
    case 'stadium': { // (before it spreads: gl.js glBigStadium after)
      cyl(0, 0, .45, 0, 7, st.wall, shade(st.accent, 1.1)); disc(0, 0, .36, 7, '#7cc47f'); disc(0, 0, .2, 7.1, '#86cc88'); flat(0, 0, .005, .2, 7.3, '#ffffff');
      if (hasTech('electric')) for (const [u, w] of [[-.42, -.42], [.42, -.42], [.42, .42], [-.42, .42]]) { post(u, w, 18, .007, '#8a8f99'); GLB.mat = 0; glOBox(gw(u, w, 19), [.03, 0, 0], [0, 0, .03], [0, .012, 0], '#f2f4f7', 2); }
      return;
    }
    case 'museum': { box(0, 0, .4, .34, 0, 12, st.wall); windows(0, 0, .4, .34, 0, 12, 1, 4, winCol(st, B)); roofPyr(0, 0, .22, .22, 12, 12, st.glass); return; }
    case 'launchpad': { // the pad, scorched, its red gantry, and the rocket waiting (between launches: fx3d.js)
      flat(0, 0, .47, .47, .3, '#bfbdb8'); disc(0, 0, .24, .32, '#7a756f');
      for (const s of [-.04, .04]) beam(.22 + s, -.22, 0, .22 + s, -.22, 62, .01, '#c8553d');
      for (let k = 1; k < 10; k++) beam(.18, -.22, k * 6, .26, -.22, k * 6 + 3, .004, '#c8553d');
      for (let k = 2; k < 10; k += 3) beam(.18, -.22, k * 6, .06, -.06, k * 6, .006, '#c8553d'); // arms reaching to the rocket
      if (B.rk !== 0) { cyl(0, 0, .08, 1, 46, '#f4f4f2'); cone(0, 0, 47, .08, 9, st.accent); box(0, .075, .02, .01, 24, 6, '#333'); }
      glowAt(.22, -.22, 63, .014, '#ff4d4d'); return;
    }
    case 'fusion': { // (before it spreads: gl.js glBigFusion after)
      box(0, 0, .42, .42, 0, 6, st.wall); dome(0, 0, .34, 6, 20, shade(st.wall, 1.02)); ring(0, 0, .37, .03, 11.7, st.accent, 0, TAU, 24, 3); return;
    }
    case 'terraformer': { // the climate engine: a tall stack ringed with teal light, misting at the top (fx3d.js)
      cyl(0, 0, .14, 0, 58, st.wall); cyl(0, 0, .24, 58, 10, shade(st.wall, 1.02), shade(st.accent, 1.1));
      for (let k = 1; k < 6; k++) ring(0, 0, .17, .03, k * 10, '#9ff0ea', 0, TAU, 20, 3);
      return;
    }
    case 'dome': { // a garden dome: green inside a glass lattice
      cyl(0, 0, .42, 0, 2, st.wall, '#9fd9a4'); parkTree(-.12, -.1, v, 2); parkTree(.12, .06, v + .5, 2);
      domeFrame(0, 0, .42, 2, 22, mix(st.glass, '#ffffff', .4), 10); return;
    }
    case 'elevator': {
      box(0, 0, .46, .46, 0, 10, st.wall); windows(0, 0, .46, .46, 0, 10, 1, 5, st.glass);
      box(0, 0, .3, .3, 10, 22, shade(st.wall, 1.03)); windows(0, 0, .3, .3, 10, 22, 3, 3, st.glass);
      box(0, 0, .14, .14, 32, 40, shade(st.wall, 1.06)); box(0, 0, .16, .16, 72, 3, st.accent); glowAt(0, 0, 75.5, .03, '#bff3ff'); return;
    }
    case 'monument': return drawMonument(B, st);
    case 'pasture': return drawPasture(B, st);
    case 'warehouse': {
      box(0, -.02, .42, .24, 0, 9, st.wall); roofGable(0, -.02, .43, .25, 9, 5, st.roof, st.wall, true);
      for (const u of [-.22, .08]) door(u, -.02, .24, .1, 6.5, shade(st.trim, .75));
      windows(0, -.02, .42, .24, 0, 9, 1, 4, winCol(st, B));
      GLB.wall = M_PLANK; for (const [u, w, z] of [[.3, .36, 0], [.36, .3, 0], [.33, .33, 2.4]]) box(u, w, .05, .05, z, 2.4, '#b58d62'); // crates
      for (const [u, w] of [[-.34, .34], [-.26, .36]]) cyl(u, w, .045, 0, 3, '#8a5a3c', '#6b4530', 8); // barrels
      lamp(-.07, .225, 7.5, .012); return;
    }
    case 'shipyard': return glShipyard(B, st);
    case 'theatre': { // (before it spreads: gl.js glBigTheatre after)
      box(0, -.06, .36, .26, 0, 13, st.wall); windows(0, -.06, .36, .26, 0, 13, 1, 3, winCol(st, B));
      box(.06, -.14, .18, .14, 13, 10, shade(st.wall, .96)); roofGable(.06, -.14, .19, .15, 23, 4, st.roof, st.wall, true); // the fly tower
      for (let k = 0; k < 4; k++) cyl(-.27 + k * .18, .26, .028, 0, 11, shade(st.wall, 1.1), null, 8); // portico
      box(0, .24, .37, .07, 11, 2.5, shade(st.wall, 1.04)); roofPyr(0, .24, .37, .07, 13.5, 3, st.roof);
      door(0, -.06, .26, .1, 6, '#7a3b3b');
      post(.3, -.2, 9, .004, '#6b5040', 23); GLB.mat = 0; glOBox(gw(.33, -.2, 31), [.03, 0, 0], [0, 0, .003], [0, .012, 0], shade(st.accent, 1.05)); // a flag on the fly tower
      for (const u of [-.2, .2]) lamp(u, .31, 9, .014, '#ffd08a');
      return;
    }
    case 'bathhouse': {
      box(0, 0, .3, .22, 0, 7, mix(st.wall, '#e8e2d6', .4)); windows(0, 0, .3, .22, 0, 7, 1, 3, winCol(st, B));
      dome(0, 0, .2, 7, 8, shade(st.roof, 1.05)); cyl(0, 0, .04, 15, 2.5, st.accent); door(0, 0, .22, .09, 4.5, '#5c4a3e');
      return;
    }
    case 'digsite': { // the Maker dig: trenches, strings marking the grid, the scholars' tent, a sieve
      flat(0, 0, .44, .44, .1, '#c9a980');
      for (const [u, w] of [[-.2, -.1], [.12, -.18], [-.05, .18], [.22, .14]]) glPit(u, w, .09, .09, 2.5, '#bf9d74', '#a9855f', '#b89266', 1);
      if (GLB.lod) { for (const u of [-.35, -.05, .25]) beam(u, -.4, .4, u, .4, .4, .0015, '#f0ebe1'); for (const w of [-.35, -.05, .25]) beam(-.4, w, .4, .4, w, .4, .0015, '#f0ebe1'); }
      ctr(-.3, -.32, -3); tq([-.42, -.4, 0], [-.18, -.4, 0], [-.18, -.32, 8], [-.42, -.32, 8], '#e9e2d0'); tq([-.42, -.24, 0], [-.18, -.24, 0], [-.18, -.32, 8], [-.42, -.32, 8], '#d6ceb8');
      tt([-.42, -.4, 0], [-.42, -.24, 0], [-.42, -.32, 8], '#cfc6ae');
      cyl(.32, .3, .05, 1.2, .6, '#8a6446', '#c9b48a', 10); for (const [a, b] of [[-.04, 0], [.03, .03], [.02, -.04]]) post(.32 + a, .3 + b, 1.2, .003, '#6b5040');
      return;
    }
    case 'botanic': {
      flat(0, 0, .46, .46, .15, '#9ed49a');
      for (const [u, w, col] of [[-.34, .34, '#f28bb5'], [.34, .34, '#f5d25b'], [-.34, -.34, '#b69cf0']]) { flat(u, w, .08, .08, .3, '#8a6446'); if (GLB.lod) for (let q = 0; q < 4; q++) flowersAt(u - .04 + (q % 2) * .08, w - .04 + (q >> 1) * .08, hash2(B.id | 0, q, 17), .4); }
      box(0, -.04, .3, .2, 0, 6, shade(st.glass, 1.05)); parkTree(-.08, -.06, v + .2, 6); parkTree(.1, 0, v + .7, 6);
      domeFrame(0, -.04, .26, 6, 9, '#f2f6f8'); return;
    }
    case 'guildhall': {
      const T = S.T[B.sid], r = T && guildOf(T), ec = r ? RES_COL[r] : st.accent;
      box(0, 0, .2, .26, 0, 18, st.wall); windows(0, 0, .2, .26, 0, 18, 3, 2, winCol(st, B));
      roofGable(0, 0, .21, .27, 18, 11, st.roof, st.wall, false); door(0, 0, .26, .08, 6, shade(st.trim, .85));
      beam(-.2, .27, 16, -.32, .27, 16.5, .004, '#6b5040'); GLB.mat = 0; glOBox(gw(-.3, .275, 13), [.025, 0, 0], [0, 0, .003], [0, .045, 0], ec); // the guild's banner
      lamp(.06, .275, 8, .012); return;
    }
    case 'sandpit': return drawSandpit(B, i);
    case 'weaver': {
      box(-.08, -.06, .28, .22, 0, 9, st.wall); windows(-.08, -.06, .28, .22, 0, 9, 1, 3, winCol(st, B));
      door(-.08, -.06, .22, .1, 5, '#5c4a3e'); roofGable(-.08, -.06, .28, .22, 9, 5.5, st.roof, st.wall, v < .5);
      return glDryFrame(.3); // (the cloth on it moves: works.js)
    }
    case 'glassworks': { // a house for the glassblowers, and the furnace: a brick cone with a glowing mouth (works.js)
      box(-.12, .06, .24, .22, 0, 8, st.wall); windows(-.12, .06, .24, .22, 0, 8, 1, 2, st.glass); roofGable(-.12, .06, .24, .22, 8, 4.5, st.roof, st.wall, true);
      cyl(.2, -.16, .15, 0, 7, '#b8684f'); cone(.2, -.16, 7, .15, 13, '#a85c44'); cyl(.2, -.16, .035, 20, 4, '#8a4a3a', '#3a3434');
      box(.2, -.01, .025, .004, .3, 2.5, '#3a2a24');
      if (GLB.lod) for (const [u, w] of [[.34, .26], [.26, .34]]) cyl(u, w, .012, 0, 3, '#a0dceb', '#cfeff6', 6); // fresh bottles
      return;
    }
    case 'watertower': {
      if (!S.tech.done.steam || B.built < S.tech.done.steam) { // a stone cistern tower
        cyl(0, 0, .15, 0, 17, st.wall); door(0, 0, .14, .06, 4.5, '#5c4a3e'); cyl(0, 0, .21, 17, 8, mix(st.wall, '#a8b4bf', .35), '#6fb7d4'); cone(0, 0, 25, .23, 7, st.roof); return;
      }
      for (const [u, w] of [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]]) beam(u, w, 0, u * .75, w * .75, 22, .012, '#6c7683');
      beam(-.15, .15, 7, .15, .15, 7, .006, '#7c8693'); beam(.15, -.15, 7, .15, .15, 7, .006, '#7c8693');
      cyl(0, 0, .22, 22, 10, mix('#c9d2da', st.accent, .15), '#aab6c1'); dome(0, 0, .22, 32, 4, '#b6c2cc'); lamp(0, .222, 27, .01); return;
    }
    default: box(0, 0, .3, .3, 0, 8, st.wall);
  }
}
// a clock face on a tower, lit at night: (u, v) on the wall, facing out along v (or u)
function clockFace(u, v, z, r, alongU) {
  GLB.mat = 0; const n = alongU ? [1, 0, 0] : [0, 0, 1], a = alongU ? [0, 0, 1] : [1, 0, 0], c = gw(u, v, z);
  glOBox(c, V3s(a, r), V3s(n, .003), [0, r, 0], '#fbf6ea', 2);
  if (GLB.lod) { glOBox(V3a(c, V3s(n, .004)), V3s(a, .003), V3s(n, .001), [0, r * .7, 0], '#333'); glOBox(V3a(V3a(c, V3s(n, .004)), V3s(a, r * .25)), V3s(a, r * .3), V3s(n, .001), [0, .003, 0], '#333'); }
}
function dish(u, v, z, r, dir, col) { // a dish aerial facing dir
  const n = V3s(dir, 1 / Math.hypot(...dir)), s0 = V3x(n, [0, 1, 0]), s = V3s(s0, 1 / (Math.hypot(...s0) || 1)), t = V3x(s, n), O = gw(u, v, z), C = gcol(col);
  GLB.mat = 0; GLB.ctr = V3a(O, V3s(n, -1)); const R = k => { const a = k / 14 * TAU; return V3a(V3a(O, V3s(s, Math.cos(a) * r)), V3a(V3s(t, Math.sin(a) * r), V3s(n, r * .35))); };
  for (let k = 0; k < 14; k++) gtri(O, R(k), R(k + 1), C);
  gBeam(O, V3a(O, V3s(n, r * .9)), .004, '#9aa3ad');
}

/* ---------- where the materials come from ---------- */
function drawLumber(B, st, i) { // the woodcutters' hut, the log pile, the chopping block (the woodcutter works it by day: works.js)
  const v = B.var || 0;
  flat(.05, .1, .34, .3, .25, '#d7c09a'); // sawdust and trodden earth
  const wall = mix(st.wall, '#a8784e', .7), sv = GLB.wall; GLB.wall = M_PLANK;
  box(-.16, -.16, .17, .13, 0, 6.5, wall); GLB.wall = sv;
  door(-.22, -.16, .13, .07, 4, '#5a4436'); roofGable(-.16, -.16, .19, .15, 6.5, 4.5, mix(st.roof, '#7d5a3e', .6), wall, true);
  box(-.04, -.26, .03, .03, 7, 5, '#7a6a5e');
  glLogPile(.22, .12, 3, '#8f6440');
  cyl(-.2, .24, .06, 0, 2, '#8a6446', '#d8b98a', 10);
  if (v > .4) for (const [a, b] of [[-.06, -.03], [.06, .03]]) { beam(.28 + a, -.22 + b, 0, .28, -.22, 2.6, .006, '#6b5040'); beam(.28 + a, -.22 - b, 0, .28, -.22, 2.6, .006, '#6b5040'); } // a sawhorse
  if (hasTech('steam')) box(.2, -.18, .1, .08, 0, 4, '#8f8a86');
}
function stoneCol(i) { const b = M.bio[i]; return b === BIO.ROCK ? '#bdb6cf' : b === BIO.HIGH ? '#dcc39c' : b === BIO.SNOW ? '#d8d7e2' : '#cfc8bb'; }
function drawQuarry(B, i) {
  const sc = stoneCol(i);
  glPit(0, 0, .36, .34, 9, shade(sc, 1.03), sc, shade(sc, .9), 3, M_STONE);
  for (const [u, w, z] of [[.12, .14, .3], [.22, .02, .3], [.36, .12, 0], [.36, .26, 0], [.36, .19, 2.2], [.2, .38, 0]]) box(u, w, .055, .05, z, 2.2, shade(sc, 1.04)); // cut blocks waiting to be carted off
  glDerrick(-.34, .3); if (hasTech('steam')) box(-.38, -.34, .08, .07, 0, 3.5, '#8f8a86'); // (its boom swings: works.js)
}
function drawClaypit(B, i) {
  const v = B.var || 0;
  glPit(0, 0, .22, .2, 3, '#caa27c', '#a85c44', '#b8664a', 1);
  disc(-.08, -.05, .08, .3, '#7fb2c4', -1); // a puddle
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) box(-.3 + k * .09, .32 + r * .08, .03, .02, 0, 1.2, r ? '#c9795c' : '#d68b6a'); // bricks drying
  if (hasTech('brick')) { cyl(.3, -.2, .13, 0, 6, '#b06a52'); cone(.3, -.2, 6, .13, 7, '#a25f49'); cyl(.3, -.2, .04, 13, 2, '#8a4f3e'); } // a bottle kiln
  else dome(.3, -.2, .15, 0, 7, '#b27058');
  box(.3, -.07, .025, .004, .2, 2.4, '#3a2420'); // its mouth (the fire flickers: works.js)
  if (v > .5) for (let k = 0; k < 3; k++) ball(.05 + k * .05, .25, .025, .9, .9, shade('#c98a66', .9 + k * .05), 0);
}
function drawLighthouse(B, st) { // on its rock: red and white bands, the lantern room, a cap (the beam sweeps: fx3d.js)
  for (const [u, w, r] of [[0, 0, .3], [.14, .12, .16], [-.16, .1, .14], [.08, -.18, .15]]) ball(u, w, r, 0, 2.5, u ? '#cfc9dc' : '#b9b3c8', M_STONE);
  box(.22, .2, .1, .08, 0, 4, '#ece6da'); roofGable(.22, .2, .1, .08, 4, 3, '#c0584f', '#ece6da', true); // the keeper's cottage
  const rs = [.12, .11, .1, .09];
  for (let k = 0; k < 4; k++) cyl(0, 0, rs[k], k * 9 + 2, 9, k % 2 ? '#c0584f' : '#f4f1ea');
  cyl(0, 0, .115, 38, 1.2, '#3a3f4a'); cyl(0, 0, .07, 39.2, 5, '#cfe6ee', '#cfe6ee'); lamp(0, 0, 41.6, .045, '#fff3cf');
  cone(0, 0, 44.2, .09, 5, '#c0584f');
}
function drawPasture(B, st) {
  const v = B.var || 0, E = .43;
  flat(0, 0, .46, .46, .15, '#b3d98c');
  if (GLB.lod) for (let k = 0; k < 7; k++) tuftAt(hash2(B.x * 7 + k, B.y, 21) * .8 - .4, hash2(B.x, B.y * 7 + k, 22) * .8 - .4, '#94c47a'); // grazed tufts
  const corners = [[-E, -E], [E, -E], [E, E], [-E, E]], sw = GLB.wall; GLB.wall = M_PLANK; // a post-and-rail fence
  for (const z of [1.2, 2.3]) { box(0, -E, E, .008, z, .35, '#8a6446'); box(0, E, E, .008, z, .35, '#8a6446'); box(-E, 0, .008, E, z, .35, '#8a6446'); box(E, 0, .008, E, z, .35, '#8a6446'); }
  for (const [u, w] of corners.concat([[0, -E], [E, 0], [0, E], [-E, 0]])) box(u, w, .014, .014, 0, 2.8, '#7a5a44');
  GLB.wall = sw;
  box(-.25, -.25, .1, .08, 0, 4, mix(st.wall, '#a57f5e', .5)); roofGable(-.25, -.25, .12, .1, 4, 2.4, st.roof, st.wall, true);
  box(.18, -.26, .09, .03, 0, 1.2, '#8a6446'); // the trough
  sheepAt(.06, .12, 2.2, v < .5); sheepAt(.28, -.1, 1.8, v >= .5); if (v > .3) sheepAt(-.18, .26, 1.2, true);
}
function drawSandpit(B, i) {
  const v = B.var || 0;
  glPit(0, 0, .3, .26, 4, '#ecd5a8', '#d9b77f', '#e7cc98', 2, M_SAND);
  for (const [u, w, s] of [[.3, .2, 1], [.22, .34, .8]]) ball(u, w, .12 * s, 0, 2.2 * s, '#efd9ad', M_SAND); // heaps of sand
  box(-.32, .3, .08, .05, 1, 2, '#9b7657'); ball(-.32, .3, .065, 3, .9, '#ead3a2', M_SAND); // a cart full of it
  for (const s of [-1, 1]) { GLB.mat = 0; glOBox(gw(-.32 + s * .05, .36, 1), [.02, 0, 0], [0, 0, .006], [0, .02, 0], '#6b5040'); }
  if (v > .5) beam(-.1, -.3, 0, -.08, -.32, 6, .004, '#7a5a44'); // a spade left standing in a heap
}

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
}

function drawPlaza(B, st) {
  const pave = B.style >= 2 ? mix(st.wall, '#d8d0c4', .6) : '#cdb79a';
  flat(0, 0, .47, .47, .3, pave);
  if (GLB.lod) { if (dsRound()) for (const r of [.2, .34]) ring(0, 0, r, .01, .35, shade(pave, .85)); else for (let k = -2; k <= 2; k++) { flat(k * .18, 0, .004, .47, .35, shade(pave, .85)); flat(0, k * .18, .47, .004, .35, shade(pave, .85)); } }
  if (B.style < 2) { // the village fire: a ring of stones, the embers glowing
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; ball(Math.cos(a) * .1, Math.sin(a) * .1, .025, .6, .8, '#6d5a4c', M_STONE); }
    GLB.mat = 0; glOBox(gw(0, 0, .8), [.06, 0, 0], [0, 0, .06], [0, .012, 0], '#e98b4a', 3);
    for (const a of [.4, 2.5, 4.4]) beam(Math.cos(a) * .06, Math.sin(a) * .06, .6, -Math.cos(a) * .02, -Math.sin(a) * .02, 3, .008, '#5a4030');
    return;
  }
  for (const [u, w] of [[-.42, .42], [.42, -.42]]) { post(u, w, 8, .006, '#4c4f58'); lamp(u, w, 8.3, .016); }
  cyl(0, 0, .2, 0, 2.2, shade(pave, .9), '#7fc7de');
  if (B.statue) { box(0, 0, .06, .06, 2.2, 5, '#d8d2c8'); figure(0, 0, 7.2, .7, '#b9a99a'); }
  else { cyl(0, 0, .05, 2.2, 3, shade(pave, .95), '#bfe7f2'); if (GLB.lod) post(0, 0, 3, .008, '#cfeff6', 5.2); } // a fountain and its jet
}
function figure(u, v, z, s, col, armUp) { // a stone figure on its plinth: legs, a robe, arms, a head
  const sv = GLB.wall; GLB.wall = M_STONE;
  box(u, v, .03 * s, .025 * s, z, 5 * s, col); box(u, v, .04 * s, .03 * s, z + 5 * s, 5 * s, shade(col, 1.05)); ball(u, v, .022 * s, z + 11.5 * s, 1.4 * s, col, M_STONE);
  if (armUp) beam(u + .03 * s, v, z + 9 * s, u + .07 * s, v, z + 15 * s, .008 * s, col, M_STONE);
  GLB.wall = sv;
}
function drawMonument(B, st) {
  const k = B.sub || 'obelisk', ac = st.accent;
  box(0, 0, .44, .44, 0, 2, '#d9d1c4');
  switch (k) {
    case 'statue': { box(0, 0, .14, .14, 2, 10, '#e2dbcf'); figure(0, 0, 12, 1.3, '#c9b8a6', true); glowAt(.09, 0, 31, .018, '#e5874f'); return; } // the founder, a torch held high
    case 'lantern': { box(0, 0, .16, .16, 2, 48, shade(st.wall, 1.02)); windows(0, 0, .16, .16, 2, 48, 6, 1, st.glass); GLB.mat = 0; glOBox(gw(0, 0, 54), [.22, 0, 0], [0, 0, .22], [0, 4 * ZS, 0], '#ffe39a', 2); roofPyr(0, 0, .23, .23, 58, 10, st.roof); return; }
    case 'spire': { roofPyr(0, 0, .3, .3, 2, 74, shade(st.wall, 1.02)); box(0, 0, .31, .31, 2, 3, ac); return; }
    case 'harp': { // a great harp: its frame a curve of bronze, strings catching the light
      const P = f => [-.3 + f * .6, .1 - f * .2, 2 + Math.sin(f * Math.PI) * 80 * (1 - f * .4)];
      for (let q = 0; q < 12; q++) { const a = P(q / 12), b = P((q + 1) / 12); beam(a[0], a[1], a[2], b[0], b[1], b[2], .02, ac); }
      if (GLB.lod) for (let q = 1; q < 9; q++) { const p = P(q / 9.5); beam(p[0], p[1], 2, p[0], p[1], p[2] - 2, .0025, '#f4f0e6'); }
      return;
    }
    case 'gardens': { for (let t = 0; t < 4; t++) { box(0, 0, .42 - t * .09, .42 - t * .09, 2 + t * 9, 8, st.wall); box(0, 0, .43 - t * .09, .43 - t * .09, 10 + t * 9, 1.5, '#72c27a'); } parkTree(0, 0, .2, 38); return; } // hanging gardens, terrace on terrace
    case 'colossus': { // a great Longstrider in stone
      for (const [a, b] of [[-.2, -.15], [.2, -.15], [-.2, .15], [.2, .15]]) beam(a, b, 2, a * .5, b * .5, 18, .03, '#b7a58f', M_STONE);
      ball(0, 0, .3, 22, 7, '#c7b59f', M_STONE); ball(-.05, 0, .2, 26, 3, '#8fbf88'); beam(.15, 0, 22, .4, 0, 30, .04, '#c7b59f', M_STONE); ball(.42, 0, .07, 31, 2.5, '#c7b59f', M_STONE); return;
    }
    case 'hall': { box(0, 0, .42, .34, 2, 18, shade(st.wall, 1.05)); for (let q = 0; q < 5; q++) cyl(-.34 + q * .17, .36, .025, 2, 17, '#f4efe6', null, 8); roofGable(0, 0, .44, .36, 20, 7, st.roof, st.wall, true); return; }
    case 'clock': { box(0, 0, .18, .18, 2, 50, st.wall); for (const [a, b, al] of [[0, .182, 0], [.182, 0, 1], [0, -.182, 0], [-.182, 0, 1]]) clockFace(a, b, 42, .07, al); roofPyr(0, 0, .2, .2, 52, 14, st.roof); return; }
    case 'orchard': { // a glass orchard: arches of glass over trees
      for (let q = 0; q < 3; q++) { const u = -.35 + q * .35; for (let j = 0; j < 8; j++) { const a0 = j / 8 * Math.PI, a1 = (j + 1) / 8 * Math.PI; beam(u + Math.cos(a0) * .14, .2, 2 + Math.sin(a0) * 26, u + Math.cos(a1) * .14, .2, 2 + Math.sin(a1) * 26, .012, st.glass); } }
      parkTree(-.1, 0, .1, 2); parkTree(.15, -.1, .4, 2); return;
    }
    default: { box(0, 0, .12, .12, 2, 52, '#ece6da'); roofPyr(0, 0, .12, .12, 54, 10, '#d6b85a'); glowAt(0, .122, 40, .02, ac); } // an obelisk with a stone that glows
  }
}

function drawConstruction(B, st, i) {
  if (FLAT_TYPES[B.type]) { flat(0, 0, .44, .44, .3, B.type === 'farm' ? '#c79b72' : '#cdbda3'); if (B.type === 'farm') drawFarm(B, i); return; }
  flat(0, 0, .42, .42, .3, '#cdbda3');
  glBuildSite(B, st, B.prog, buildH(B)); // scaffolding, the walls going up, a crane on tall ones (gl.js)
}
