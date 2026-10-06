/* ============================== the sea in 3D: what the towns build on the water (ocean.js), and what moves on it ============================== */
// Models in the kit's frame (kit.js) with y = 0 at the water's surface for the things that stand in the water. Moving
// parts in GLW (works.js): rotors turning, the rig's flare and helicopter and supply boat, blinking lights, wave power
// floats riding the swell, gulls round the old rig, buoys bobbing at the harbour mouths. Beach huts on the sand by bigger
// towns (`glBeach`, from drawTileObjects). All view only.
const SEA_Y = SEAZ * ZS;
const SEA_CAP = { windpark: '🌬️ The wind park', oilrig: '🛢️ The oil rig', reef: '🐟 The old rig reef', seastead: '🌊 The seastead', sealaunch: '🚀 The launch platform', seapier: '🎡 The pier', fishfarm: '🐟 The fish farm', wavefarm: '🌊 Wave power', kelp: '🌿 The kelp farm', oysters: '🦪 The oyster beds' };
const SEA_RED = '#ff3b30', SEA_HULL = '#2f3a46';
// out to sea from a shore building: away from its land (a building out at sea turns its own way)
function seaFrame(B) {
  const ds = [[0, 1], [1, 0], [0, -1], [-1, 0]];
  let bx = 0, by = 0; for (const [dx, dy] of ds) { const x = B.x + dx, y = B.y + dy; if (inb(x, y) && M.water[idx(x, y)] !== 1) { bx -= dx; by -= dy; } }
  if (bx || by) { const [dx, dy] = Math.abs(bx) >= Math.abs(by) ? [Math.sign(bx), 0] : [0, Math.sign(by)]; return kFrom(dx, dy); } // (on the shore, that's towards the water too)
  return kFrom(...ds[(hash2(B.id, 3, 77) * 4) | 0]);
}
function seaSet(B) { const [A, F] = seaFrame(B); kSet(GLB.x, GLB.y, A, F, B.id); if (SEA_T[B.type]) KF.y0 = SEA_Y; }
const seaRing = (s, f, y, r, w, col, n = 14) => { for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; kBeam([s + Math.cos(a) * r, f + Math.sin(a) * r, y], [s + Math.cos(b) * r, f + Math.sin(b) * r, y], w, col); } };
const seaLat = (p, q, n, w, col) => { for (let k = 0; k <= n; k++) { const t = k / n; kBeam([p[0], p[1], p[2] + (q[2] - p[2]) * t], [q[0], q[1], p[2] + (q[2] - p[2]) * t], w, col); } }; // (rungs between two uprights)
function seaBoat(s, f, a, L, col, cab) { // a small workboat on the water, its bow along angle a
  const c = Math.cos(a), sn = Math.sin(a);
  kOB(s, f, .012, [c * L, sn * L, 0], [-sn * L * .34, c * L * .34, 0], [0, 0, .014], col);
  kOB(s + c * L * .9, f + sn * L * .9, .012, [c * L * .18, sn * L * .18, 0], [-sn * L * .2, c * L * .2, 0], [0, 0, .012], col);
  if (cab) kOB(s - c * L * .25, f - sn * L * .25, .026, [c * L * .3, sn * L * .3, 0], [-sn * L * .26, c * L * .26, 0], [0, 0, .022], cab);
}

/* ---------- early: oyster beds (a fish weir on fresh water), salt pans ---------- */
GL_MODEL.oysters = function (B) {
  seaSet(B); const lod = KF.lod, salt = M.bio[idx(B.x, B.y)] === BIO.SEA, wood = '#6b5040';
  if (salt) { // trestles in rows, black bags on them, stakes marking the beds
    for (let r = 0; r < 3; r++) { const f = -.28 + r * .22; kBox(0, f, -.01, .34, .035, .03, '#4d5a4f', M_PLANK);
      for (const s of [-.3, -.1, .1, .3]) { kBox(s, f - .03, -.04, .006, .006, .06, wood, M_PLANK); kBox(s, f + .03, -.04, .006, .006, .06, wood, M_PLANK); }
      if (lod) for (let q = 0; q < 6; q++) kBox(-.27 + q * .11, f, .02, .04, .028, .008, '#2c302c'); }
    for (const [s, f] of [[-.42, -.42], [.42, -.42], [.42, .42], [-.42, .42]]) { kBox(s, f, -.03, .007, .007, .14, wood, M_PLANK); kBox(s, f, .1, .009, .009, .012, '#e0a43a'); }
  } else { // a wattle weir in a V, pointing downstream, the trap at its tip
    for (const sd of [-1, 1]) { const p = [sd * .4, -.3], q = [0, .25];
      for (let k = 0; k <= 7; k++) { const t = k / 7; kBox(p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, -.04, .006, .006, .08, wood, M_PLANK); }
      kBeam([p[0], p[1], .02], [q[0], q[1], .02], .012, '#8a6a4a', M_PLANK); }
    kCyl(0, .3, -.01, .05, .04, '#7a5a3c', M_PLANK, 8, 0);
  }
  seaBoat(-.3, .38, .3, .09, '#7a5a3c'); // the punt they work from
};
GL_MODEL.saltpan = function (B) {
  seaSet(B); const lod = KF.lod, bank = '#a8977c';
  kBox(0, 0, 0, .46, .46, .004, '#b9a98c', M_EARTH);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) { const s = -.3 + a * .3, f = -.2 + b * .36, k = (a + b * 3 + (B.id | 0)) % 4;
    kBox(s, f, 0, .14, .16, .016, bank, M_EARTH);
    kBox(s, f, .004, .125, .145, .014, k === 0 ? '#f4f1ea' : k === 1 ? '#e7c9c4' : '#8fb9c9', 0, k > 1 ? -1 : 0); } // (brine, pink as it thickens, then salt)
  for (const [s, f, r] of [[.3, .38, .045], [.2, .4, .035], [-.36, .38, .03]]) kCone(s, f, 0, r, r * 1.3, '#f6f4ef', 8, 0);
  kBox(-.36, -.38, 0, .07, .05, .07, '#8a6a4a', M_PLANK); kGable(-.43, -.29, -.43, -.33, .07, .04, '#6b5a48');
  if (lod) { kBeam([.1, .38, 0], [.1, .38, .12], .003, '#6b5040'); kBeam([.1, .38, .1], [.18, .3, .03], .003, '#6b5040'); } // a rake leaning on a heap
  if (hasTech('steam')) { kBox(.38, -.38, 0, .004, .004, .32, '#6b5040'); kCyl(.38, -.38, .3, .05, .006, '#cfcac4', 0, 8); } // a little windpump (its wheel turns: GLW)
};

/* ---------- the pleasure pier: out from the shore on iron legs, kiosks at the gate, a pavilion at the end ---------- */
GL_MODEL.seapier = function (B) {
  const d = B.dir || [1, 0], lx = B.lx != null ? B.lx : B.x, ly = B.ly != null ? B.ly : B.y;
  kSet(lx, ly, [d[1], 0, d[0]], [d[0], 0, d[1]], B.id); const lod = KF.lod, land = surfZ(idx(lx, ly)) * ZS; KF.y0 = SEA_Y;
  const dk = Math.max(land - SEA_Y, .12) + .02, iron = '#5b6b72', white = '#f2efe6', green = '#3f7a64', red = '#c8553d';
  kBox(0, 1.3, dk - .015, .1, 1.05, .015, '#b49a7a', M_PLANK); // the deck
  for (let f = .5; f <= 2.4; f += .2) for (const s of [-.08, .08]) kBox(s, f, -.08, .008, .008, dk - .06 + .08, iron);
  if (lod) for (let f = .5; f < 2.3; f += .4) kBeam([-.08, f, .02], [.08, f + .2, dk - .03], .003, iron);
  kFence([[-.1, .26], [-.1, 2.35]], .035, white, 'rail'); kFence([[.1, .26], [.1, 2.35]], .035, white, 'rail');
  KF.y0 = SEA_Y + dk;
  for (const s of [-.07, .07]) { kBox(s, .2, 0, .03, .04, .09, white); kDome(s, .2, .09, .032, .04, green); } // the kiosks at the gate
  kBox(0, .2, .1, .045, .006, .025, red); if (lod) kBox(0, .2, .1, .04, .007, .02, '#ffe2a0', 0, 2);
  for (let f = .5; f < 2.2; f += .38) for (const s of [-.09, .09]) cLampPost(s, f, .09);
  if (lod) for (let f = .7; f < 2.2; f += .5) kBench(.065, f, 0, 0, '#3f6a5c');
  kBox(0, 2.3, -.012, .17, .17, .012, '#b49a7a', M_PLANK); // the pavilion at the end
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; kBox(Math.cos(a) * .13, 2.3 + Math.sin(a) * .13, 0, .007, .007, .1, white); }
  kCyl(0, 2.3, .1, .145, .012, white, 0, 8); kCone(0, 2.3, .112, .15, .08, red, 8, 0); kBox(0, 2.3, .19, .006, .006, .04, white); kBox(0, 2.3, .23, .012, .012, .012, '#ffd27a', 0, 2);
  if (lod) for (let k = 0; k < 16; k++) { const a = k / 16 * TAU; kBox(Math.cos(a) * .15, 2.3 + Math.sin(a) * .15, .105, .005, .005, .005, ['#ffd27a', '#ff8a8a', '#8ad0ff'][k % 3], 0, 2); } // strings of bulbs
};

/* ---------- desalination: a long white hall, tanks, and the intake pipe running out to sea ---------- */
GL_MODEL.desal = function (B, st) {
  seaSet(B); const lod = KF.lod, wh = hasTech('fusion') ? '#f6f8f9' : '#e8ebee', band = '#3f7fb0';
  kPlinth(-.36, .2, -.3, .1, .012); kBox(-.08, -.1, .012, .28, .2, .16, wh, M_PLASTER); kBox(-.08, .1, .1, .28, .004, .02, band);
  kWalls(-.36, .2, -.3, .1, (a, b, ff, q) => kWins(a, b, ff, .02, .16, 1, 6, { ty: 'steel', hk: .3 }, null, q * 3), 14);
  kFlat(-.36, .2, -.3, .1, .172, '#c9ccd0');
  for (const s of [-.3, -.14, .02]) kBox(s, -.1, .172, .03, .05, .02, '#b8bcc2'); // roof units
  for (let k = 0; k < 3; k++) { kCyl(.32, -.3 + k * .18, 0, .07, .14, '#d5dade', 0, 12, '#c0c6cc'); if (lod) kCyl(.32, -.3 + k * .18, .05, .072, .006, band, 0, 12, 0); }
  { const w = SEA_Y - KF.y0; kBeam([0, .1, .03], [0, .55, .03], .018, '#9aa3ad'); kBeam([0, .55, .03], [0, .8, w - .02], .018, '#9aa3ad'); kBeam([0, .8, w - .02], [0, 1.3, w - .02], .018, '#9aa3ad'); kCyl(0, 1.3, w - .04, .04, .05, '#e0a43a', 0, 8); } // the intake runs down the bank and out to sea
  if (lod) { kBox(-.3, .28, 0, .06, .06, .05, '#cfd4d9'); cLampPost(.12, .2, .12); kFence([[-.46, .46], [.46, .46]], .04, '#9aa3ad', 'rail'); }
};

/* ---------- the oil rig: a steel jacket, two decks, a derrick, the accommodation, a helideck and the flare boom ---------- */
const RIG_D = .5; // its deck, over the water
function seaJacket(lod, top, rust) {
  const leg = rust ? '#7a5240' : '#e0a43a';
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBeam([a * .3, b * .3, -.15], [a * .24, b * .24, top], .022, leg);
  for (let k = 0; k < (lod ? 3 : 2); k++) { const y0 = -.05 + k * top / 3, y1 = y0 + top / 3, r0 = .3 - .06 * (y0 + .15) / (top + .15), r1 = .3 - .06 * (y1 + .15) / (top + .15);
    for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) { kBeam([p[0] * r0, p[1] * r0, y0], [q[0] * r1, q[1] * r1, y1], .007, leg); kBeam([p[0] * r0, p[1] * r0, y0], [q[0] * r0, q[1] * r0, y0], .008, leg); } }
}
GL_MODEL.oilrig = function (B) {
  seaSet(B); const lod = KF.lod, D = RIG_D, grey = '#9aa1a8', orng = '#d8693a', white = '#eceae4';
  seaJacket(lod, D, false);
  kBox(0, 0, D, .36, .34, .05, grey); kBox(0, 0, D + .05, .34, .32, .004, '#6f767d'); // the cellar deck and the main deck
  kBox(-.18, .16, D + .054, .15, .14, .2, white); kWins(-.32, -.04, .3, D + .07, .17, 3, 4, { ty: 'steel', hk: .5 }, null, 7); // accommodation, lit at night
  kBox(-.18, .16, D + .254, .16, .15, .006, orng);
  kBox(-.24, .38, D + .26, .17, .17, .008, '#3d5a4a'); kCyl(-.24, .38, D + .268, .1, .002, '#e0c24a', 0, 14, 0); // the helideck, out over the edge
  if (lod) { kBox(-.24, .38, D + .27, .04, .006, .002, white); kBox(-.28, .38, D + .27, .006, .04, .002, white); kBox(-.2, .38, D + .27, .006, .04, .002, white); kBeam([-.3, .26, D + .06], [-.24, .38, D + .25], .006, grey); kBeam([-.18, .26, D + .06], [-.24, .38, D + .25], .006, grey); }
  const dX = .14, dZ = -.1, T = 1.1; // the derrick
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBeam([dX + a * .08, dZ + b * .08, D + .05], [dX + a * .02, dZ + b * .02, D + .05 + T], .006, white);
  for (let k = 1; k < (lod ? 8 : 4); k++) { const t = k / (lod ? 8 : 4), r = .08 - .06 * t, y = D + .05 + T * t; seaRing(dX, dZ, y, r * 1.41, .003, white, 4); }
  kBox(dX, dZ, D + .05, .1, .1, .06, '#7d868f');
  kCyl(.26, .2, D + .05, .03, .12, grey, 0, 8); kBeam([.26, .2, D + .17], [.02, .32, D + .42], .009, orng); // the crane
  kBeam([.3, -.3, D + .05], [.62, -.62, D + .55], .008, grey); kBeam([.32, -.26, D + .05], [.62, -.62, D + .55], .006, grey); // the flare boom (the flame: GLW)
  for (const s of [-.1, .06]) { kOB(s, -.36, D - .02, [.06, 0, 0], [0, .018, 0], [0, 0, .02], orng); } // lifeboats
  if (lod) { kCyl(-.05, -.15, D + .054, .05, .1, '#cfd4d9', 0, 10); kCyl(.04, -.2, D + .054, .04, .08, '#cfd4d9', 0, 10); kFence([[-.36, -.34], [.36, -.34], [.36, .34]], .03, '#e0c24a', 'rail'); }
};
GL_MODEL.reef = function (B) { // the old rig, its decks gone: rusty legs, a few stubs, weed, a dive buoy
  seaSet(B); const lod = KF.lod;
  seaJacket(lod, RIG_D * .8, true);
  for (const [a, b] of [[-1, -1], [1, 1]]) kBox(a * .24, b * .24, RIG_D * .8, .03, .03, .03, '#6a4636');
  kCyl(.42, .1, 0, .025, .04, '#e8e4dc', 0, 8, SEA_RED); kBox(.42, .1, .04, .002, .002, .05, '#333'); kOB(.44, .1, .085, [.02, 0, 0], [0, .002, 0], [0, 0, .012], SEA_RED); // (the diver's flag)
  for (let k = 0; k < 5; k++) kBox((hash2(B.id, k, 1) - .5) * .5, (hash2(B.id, k, 2) - .5) * .5, RIG_D * .8 + .03, .01, .006, .008, '#f2f2f0'); // gulls on it
};

/* ---------- offshore wind: a monopile, a yellow transition piece, a white tower (the rotor turns: GLW) ---------- */
const WP_H = 3.2;
GL_MODEL.windpark = function (B) {
  seaSet(B); const lod = KF.lod;
  kCyl(0, 0, -.1, .05, .26, '#e0c24a', 0, 12); kCyl(0, 0, .14, .09, .012, '#9aa3ad', 0, 12); if (lod) seaRing(0, 0, .18, .09, .002, '#e0c24a', 10);
  kCone(0, 0, .152, .045, WP_H - .15, '#f4f5f7', 12, 0, .026);
  KF.A = [1, 0, 0]; KF.F = [0, 0, 1]; kBox(.04, 0, WP_H, .1, .035, .07, '#e9ebee'); // (they all face the same way into the wind)
  if (lod) { kBox(-.06, 0, .152, .02, .02, .03, '#cfd4d9'); kBeam([.09, 0, .15], [.12, 0, .2], .003, '#e0c24a'); } // a boat landing
};

/* ---------- fish farm: round net pens with walkways and a feed barge ---------- */
GL_MODEL.fishfarm = function (B) {
  seaSet(B); const lod = KF.lod, pen = '#3d4a52';
  for (const [s, f] of [[-.22, -.2], [.22, -.2], [-.22, .2], [.22, .2]].slice(0, M.bio[idx(B.x, B.y)] === BIO.SEA ? 4 : 3)) {
    seaRing(s, f, .006, .16, .012, pen, lod ? 16 : 10); kCyl(s, f, -.01, .15, .012, '#253038', 0, 12, 1, -1);
    if (lod) { for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; kBox(s + Math.cos(a) * .16, f + Math.sin(a) * .16, 0, .003, .003, .03, '#9aa3ad'); } seaRing(s, f, .03, .16, .002, '#9aa3ad', 12); kBox(s, f, 0, .004, .004, .07, '#9aa3ad'); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; kBeam([s, f, .07], [s + Math.cos(a) * .16, f + Math.sin(a) * .16, .03], .0012, '#33393d'); } } }
  kBox(0, 0, .002, .02, .2, .008, '#9aa3ad'); kBox(0, 0, .002, .2, .02, .008, '#9aa3ad');
  kBox(0, .4, -.01, .14, .06, .05, SEA_HULL); kBox(-.04, .4, .04, .07, .045, .06, '#e8ebee'); kCyl(.08, .4, .04, .025, .06, '#e0c24a', 0, 8); // the feed barge
  if (lod) kWins(-.11, .03, .445, .05, .05, 1, 3, { ty: 'steel' }, null, 3);
};

/* ---------- wave power (the floats ride the swell: GLW), floating solar, kelp ---------- */
GL_MODEL.wavefarm = function (B) {
  seaSet(B);
  for (const f of [-.25, .25]) { kCyl(-.42, f, 0, .02, .035, '#e0c24a', 0, 8, SEA_RED); kCyl(.42, f, 0, .02, .035, '#e0c24a', 0, 8); }
  kCyl(0, 0, -.02, .05, .06, '#d5dade', 0, 10, '#e0c24a'); kBox(0, 0, .04, .004, .004, .06, '#333'); // the hub buoy the cables run to
};
GL_MODEL.floatsolar = function (B) {
  seaSet(B); const lod = KF.lod;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const s = -.3 + a * .3, f = -.3 + b * .3; kBox(s, f, -.006, .13, .12, .012, '#f0f2f4'); kSolar(s, f, .012, .12, .1, .25); }
  if (lod) { for (const f of [-.15, .15]) kBox(0, f, -.004, .44, .012, .01, '#d8dce0'); kBox(.42, .42, 0, .03, .03, .05, '#c9ced4'); }
};
GL_MODEL.kelp = function (B) {
  seaSet(B); const lod = KF.lod;
  for (let r = 0; r < 4; r++) { const f = -.33 + r * .22;
    kBeam([-.42, f, .004], [.42, f, .004], .0025, '#3a3a34');
    for (let k = 0; k < 6; k++) { const s = -.4 + k * .16; kCyl(s, f, -.005, .014, .02, k % 2 ? '#e0a43a' : '#e7e2d6', 0, 6); }
    if (lod) for (let k = 0; k < 10; k++) { const s = -.38 + k * .085 + (hash2(B.id, r, k) - .5) * .03; kQ([s - .025, f - .04, .001], [s + .025, f - .04, .001], [s + .02, f + .04, .001], [s - .02, f + .04, .001], hash2(r, k, B.id) < .5 ? '#5a6b2c' : '#6b6a2a'); } // fronds at the surface
    else kBox(0, f, -.002, .4, .04, .004, '#5a6b2c'); }
};

/* ---------- a seastead: a floating neighbourhood on a hexagon of pontoons ---------- */
GL_MODEL.seastead = function (B) {
  seaSet(B); const lod = KF.lod, wh = '#f4f6f7', glass = '#9fc9d8', green = '#7fb36a';
  kCyl(0, 0, -.06, .46, .08, '#d9dde0', 0, 6, '#e8ebe6'); kCyl(0, 0, .02, .465, .008, '#5fe0d0', 0, 6, 0, 3); // the platform and its glowing edge
  kCyl(0, 0, .02, .36, .004, green, 0, 6); // the garden deck
  const blk = [[-.12, -.1, .12, .1, 4], [.16, .08, .09, .08, 3], [-.05, .2, .08, .06, 2]];
  for (const [s, f, hs, hf, n] of blk) for (let k = 0; k < n; k++) { const sc = 1 - k * .14, y = .024 + k * .075;
    kBox(s, f, y, hs * sc, hf * sc, .07, wh, M_PLASTER); kBox(s, f, y + .02, hs * sc + .002, hf * sc + .002, .035, glass, 0, .2 + .15 * (k % 3));
    kBox(s, f, y + .07, hs * sc + .01, hf * sc + .01, .005, green); }
  for (let k = 0; k < (lod ? 7 : 4); k++) { const a = k / 7 * TAU + .3; kTree(Math.cos(a) * .33, Math.sin(a) * .33, .024, .4, .5, '#5f9a4d'); }
  kBox(.3, -.25, .024, .005, .005, .4, '#d8dce0'); // a mast (its light blinks: GLW)
  if (lod) { for (const [s, f] of [[.38, .2], [.3, .32]]) seaBoat(s + .12, f + .1, .6, .06, '#f2f2f0', '#9fc9d8'); kCyl(-.3, -.2, .024, .05, .012, '#5aa7c9', 0, 10, 1, -1); }
};

/* ---------- the launch platform at sea: twin hulls on columns, the gantry, the rocket waiting ---------- */
GL_MODEL.sealaunch = function (B, st) {
  seaSet(B); const lod = KF.lod, D = SL_DECK, red = '#c8553d', T = 56 * ZS;
  for (const s of [-.3, .3]) { kBox(s, 0, -.08, .07, .44, .07, SEA_HULL); for (const f of [-.3, .3]) kCyl(s, f, -.02, .045, D, '#d8dce0', 0, 10); }
  kBox(0, 0, D, .42, .4, .04, '#bfc3c7'); kBox(0, 0, D + .04, .14, .14, .002, '#3a3634');
  kBox(-.3, .28, D + .04, .1, .1, .14, '#e8ebee'); kBox(-.3, .28, D + .18, .11, .11, .006, '#c9ccd0'); if (lod) kWins(-.4, -.2, .38, D + .06, .1, 2, 3, { ty: 'steel' }, null, 5);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(.2 + a * .035, -.2 + b * .035, D + .04, .007, .007, T, red);
  for (let k = 1; k < (lod ? 9 : 5); k++) seaRing(.2, -.2, D + .04 + k * T / (lod ? 9 : 5), .05, .003, red, 4);
  for (let k = 2; k < 9; k += 3) kBeam([.17, -.17, D + .04 + k * T / 10], [.06, -.05, D + .04 + k * T / 10], .005, red);
  if (B.rk !== 0) { kCyl(0, 0, D + .06, .075, 44 * ZS, '#f4f4f2', 0, 14); kCone(0, 0, D + .06 + 44 * ZS, .075, 8 * ZS, st.accent, 14, 0); for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + .4; kOB(Math.cos(a) * .085, Math.sin(a) * .085, D + .11, [Math.cos(a) * .028, Math.sin(a) * .028, 0], [-Math.sin(a) * .003, Math.cos(a) * .003, 0], [0, 0, .055], st.accent); } }
};

/* ---------- what moves out there ---------- */
const seaBlink = (t, p = 1.6, on = .18) => ((t / p) % 1) < on;
function seaLight(p, col, r = .014) { GLB.mat = 0; glOBox(p, [r, 0, 0], [0, 0, r], [0, r, 0], col, 3); }
function seaHeli(X, y, Z, h, rot, col) { // a little helicopter: cabin, tail boom, rotor
  const f = [Math.cos(h), 0, Math.sin(h)], r = [-f[2], 0, f[0]]; GLB.mat = 0;
  glOBox([X, y + .03, Z], V3s(f, .05), V3s(r, .026), [0, .028, 0], col); glOBox([X + f[0] * .03, y + .04, Z + f[2] * .03], V3s(f, .02), V3s(r, .027), [0, .02, 0], '#9fc9d8');
  gBeam([X - f[0] * .04, y + .04, Z - f[2] * .04], [X - f[0] * .13, y + .05, Z - f[2] * .13], .007, col);
  for (const s of [-1, 1]) gBeam([X + r[0] * .025 * s - f[0] * .04, y, Z + r[2] * .025 * s - f[2] * .04], [X + r[0] * .025 * s + f[0] * .04, y, Z + r[2] * .025 * s + f[2] * .04], .003, '#333');
  for (let k = 0; k < 2; k++) { const a = rot + k * Math.PI / 2; gBeam([X - Math.cos(a) * .12, y + .065, Z - Math.sin(a) * .12], [X + Math.cos(a) * .12, y + .065, Z + Math.sin(a) * .12], .004, '#2a2a2a'); }
}
function seaWorkboat(X, Z, h, col, bob) { const f = [Math.cos(h), 0, Math.sin(h)], r = [-f[2], 0, f[0]], y = SEA_Y + bob; GLB.mat = 0;
  glOBox([X, y + .012, Z], V3s(f, .09), V3s(r, .03), [0, .014, 0], col); glOBox([X + f[0] * .03, y + .036, Z + f[2] * .03], V3s(f, .03), V3s(r, .024), [0, .016, 0], '#f2f2f0'); }
Object.assign(GLW, {
  windpark(B, c) { // the rotor, bigger than on land, and the red light on the nacelle at night
    const a = wkSpin(B, 1.1 * c.wind), hub = [c.X + .15, c.y + WP_H + .035, c.Z]; GLB.mat = 0;
    for (let k = 0; k < 3; k++) { const th = a + k * TAU / 3, d = [0, Math.cos(th), Math.sin(th)], s = [0, -Math.sin(th), Math.cos(th)];
      glOBox(wkAdd(hub, d, .3), V3s(d, .27), V3s(s, .032), [.005, 0, 0], '#f4f5f7'); glOBox(wkAdd(hub, d, .8), V3s(d, .24), V3s(s, .018), [.004, 0, 0], '#f4f5f7'); }
    glOBox([hub[0] + .015, hub[1], hub[2]], [.03, 0, 0], [0, .026, 0], [0, 0, .026], '#e7e9ec');
    if (GL3.litNow && seaBlink(GL3.t, 2, .3)) seaLight([c.X + .04, c.y + WP_H + .075, c.Z], SEA_RED); // (the whole park blinks together)
  },
  oilrig(B, c) { // the flare roars, the derrick light blinks; a supply boat comes and goes, and a helicopter lands now and then
    kSet(c.X, c.Z, ...seaFrame(B), B.id); KF.y0 = SEA_Y; const D = RIG_D, tip = kP(.62, -.62, D + .58);
    GLB.mat = 0; for (let k = 0; k < 4; k++) { const fl = .7 + .3 * Math.sin(c.t * 11 + k * 2.1) + .2 * Math.sin(c.t * 23 + k), w = .045 * (1 - k * .2) * fl; glOBox([tip[0] + Math.sin(c.t * 3 + k) * .015 * k, tip[1] + .05 + .07 * k * fl, tip[2]], [w, 0, 0], [0, 0, w], [0, .05 * fl, 0], k > 1 ? '#ff8a3d' : k ? '#ffb347' : '#ffe08a', 3); } // (a tongue of flame, licking up)
    if (!FAST && Math.random() < GL3.dt * 3) part3(tip[0], tip[1] + .12, tip[2], rf(-.05, .05), rf(.25, .45), rf(-.05, .05), rf(2, 4), '#5a5550', .35, .12, { dr: .4, gr: .3 });
    if (seaBlink(c.t, 1.4, .25)) seaLight(kP(.14, -.1, D + 1.18), SEA_RED, .012);
    const cy = (c.t % 90) / 90, side = kP(.1, .5, 0); // the supply boat: alongside, then off towards the coast and back
    const away = cy < .45 ? 0 : cy < .6 ? (cy - .45) / .15 : cy < .85 ? 1 : 1 - (cy - .85) / .15, out = kP(.1 + away * 2.2, .5 + away * 1.4, 0);
    seaWorkboat(out[0], out[2], Math.atan2(out[2] - side[2], out[0] - side[0]) + (cy > .85 ? Math.PI : 0), '#c8553d', Math.sin(c.t * 1.3) * .006);
    const hy = (c.t % 140) / 140, pad = kP(-.24, .38, D + .272); // the helicopter
    if (hy < .5) { const k = hy < .15 ? 1 - hy / .15 : hy > .35 ? (hy - .35) / .15 : 0, h = .6 + B.id % 3, X = pad[0] + Math.cos(h) * k * 6, Z = pad[2] + Math.sin(h) * k * 6;
      seaHeli(X, pad[1] + k * k * 1.5 + (k > 0 ? .05 : 0), Z, h + Math.PI, c.t * (k > 0 || hy < .2 || hy > .3 ? 40 : 6), '#e0a43a'); }
  },
  reef(B, c) { // gulls wheeling over the old rig
    if (c.d > 30) return; GLB.mat = 0;
    for (let k = 0; k < 4; k++) { const a = c.t * (.4 + k * .07) + k * 1.7, r = .3 + k * .12, X = c.X + Math.cos(a) * r, Z = c.Z + Math.sin(a) * r, y = c.y + .55 + Math.sin(c.t + k) * .06, f = [-Math.sin(a), 0, Math.cos(a)], s = [Math.cos(a), 0, Math.sin(a)], fl = Math.sin(c.t * 7 + k) * .015;
      glOBox([X, y, Z], V3s(f, .012), V3s(s, .005), [0, .004, 0], '#f2f2f0'); for (const sd of [-1, 1]) gBeam([X, y, Z], [X + s[0] * .04 * sd, y + fl, Z + s[2] * .04 * sd], .004, '#e8e8e6'); }
  },
  wavefarm(B, c) { // three long jointed floats bending over the swell
    kSet(c.X, c.Z, ...seaFrame(B), B.id); KF.y0 = SEA_Y; const amp = .018 * (1 + (S.wx && S.wx.storm || 0) * 2);
    for (const f of [-.25, 0, .25]) { let prev = null;
      for (let k = 0; k <= 6; k++) { const s = -.38 + k * .127, p = kP(s, f, Math.sin(c.t * 1.4 - k * .9 + f * 4) * amp);
        if (prev) { gBeam(prev, p, .022, '#c8553d'); } prev = p; } }
  },
  saltpan(B, c) { // the windpump turns
    if (!hasTech('steam')) return; kSet(c.X, c.Z, ...seaFrame(B), B.id); const hub = kP(.38, -.38, .3), a = wkSpin(B, 1.5 * c.wind);
    for (let k = 0; k < 6; k++) { const th = a + k * TAU / 6; gBeam(hub, [hub[0] + Math.cos(th) * .05, hub[1] + Math.sin(th) * .05, hub[2]], .004, '#e8e4dc'); }
  },
  kelp(B, c) { // the harvester boat works slowly up and down the lines
    kSet(c.X, c.Z, ...seaFrame(B), B.id); const u = Math.sin(c.t * .05), p = kP(u * .36, .44 - .11, 0), h = Math.atan2(KF.A[2], KF.A[0]) + (Math.cos(c.t * .05) < 0 ? Math.PI : 0);
    seaWorkboat(p[0], p[2], h, '#3f7a64', Math.sin(c.t * 1.2) * .005);
  },
  seastead(B, c) { if (GL3.litNow && seaBlink(c.t, 2.4, .2)) { kSet(c.X, c.Z, ...seaFrame(B), B.id); KF.y0 = SEA_Y; seaLight(kP(.3, -.25, .43), SEA_RED, .01); } },
  sealaunch(B, c) { if (seaBlink(c.t, 1.6, .25)) { kSet(c.X, c.Z, [1, 0, 0], [0, 0, 1], B.id); KF.y0 = SEA_Y; seaLight(kP(.2, -.2, SL_DECK + .04 + 56 * ZS + .02), SEA_RED, .012); } }
});
// channel buoys at each harbour's mouth (red to port, green to starboard coming in), bobbing, their lights flashing at night
const GLW_HARBOR = GLW.harbor;
GLW.harbor = function (B, c) {
  GLW_HARBOR(B, c);
  const d = B.dir || [1, 0], a = d[0] ? [0, 1] : [1, 0], L = berths(B), [lx, lz] = glLot(B), lit = GL3.litNow;
  for (const [sd, col] of [[-1, SEA_RED], [1, '#2f9e5a']]) for (const out of [2.2, 3.4]) {
    const X = lx + d[0] * out + a[0] * sd * (L / 2 + .35), Z = lz + d[1] * out + a[1] * sd * (L / 2 + .35), i = idx(clamp(Math.round(X), 0, W - 1), clamp(Math.round(Z), 0, H - 1));
    if (M.water[i] !== 1) continue;
    const bob = Math.sin(c.t * 1.3 + out + sd) * .008, y = SEA_Y + bob, tl = Math.sin(c.t * .9 + out) * .08; GLB.mat = 0;
    glOBox([X, y + .02, Z], [.022, 0, 0], [0, 0, .022], [0, .03, 0], col); glOBox([X, y + .06, Z], [.012 + tl * .01, 0, 0], [0, 0, .012], [0, .02, 0], col);
    if (lit && seaBlink(c.t + out * 3, 2.5, .2)) seaLight([X, y + .09, Z], sd < 0 ? '#ff6b5e' : '#6bff9a', .01);
  }
};

/* ---------- beach huts on the sand by a bigger town (from the age of steam) ---------- */
const HUT_COL = ['#e86a5c', '#f2c94c', '#6fb1d6', '#7ec08a', '#f2a0bf', '#f4f2ea', '#9b8ad6'];
function glBeach(i, x, y) {
  if ((S.era || 0) < 4 || hash2(x, y, 501) < .35) return;
  let dir = null; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && isSea(idx(nx, ny))) { dir = [dx, dy]; break; } } if (!dir) return;
  if (!towns().some(T => T.pop > 600 && dist(x, y, T.x, T.y) < townRadius(T) + 5)) return;
  kSet(GLB.x, GLB.y, [dir[1], 0, -dir[0]], [dir[0], 0, dir[1]], i); const lod = GLB.lod;
  for (let k = 0; k < 4; k++) { if (hash2(x, y, 510 + k) < .2) continue; const s = -.33 + k * .22, col = HUT_COL[(hash2(x, y, 520 + k) * HUT_COL.length) | 0];
    kBox(s, -.25, 0, .07, .07, .12, col, M_PLANK); kGable(s - .08, s + .08, -.33, -.17, .12, .05, shade(col, .82), { wall: col }); kBox(s, -.175, .01, .035, .003, .08, shade(col, .75), M_PLANK);
    if (lod) kBox(s, -.165, 0, .05, .02, .01, '#c8b48f', M_PLANK); }
  if (hash2(x, y, 530) < .7) { const s = (hash2(x, y, 531) - .5) * .5, col = HUT_COL[(hash2(x, y, 532) * HUT_COL.length) | 0]; kBox(s, .15, 0, .003, .003, .14, '#f4f2ea'); kCone(s, .15, .12, .1, .04, col, 8, 0); } // a parasol
  if (lod) for (let k = 0; k < 2; k++) { const s = -.2 + k * .14 + hash2(x, y, 540 + k) * .05; kOB(s, .2, .02, [.025, 0, 0], [0, .04, 0], [0, 0, .004], HUT_COL[(k + x) % HUT_COL.length]); } // deck chairs
}
