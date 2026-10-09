/* ============================== industry: the workplaces, modelled properly ============================== */
// The smithy, the windmill, the woodcutters, the mine, the quarry, the clay and sand pits, the weaving house, the
// glassworks, the works, the power house, the warehouse, the water tower and the pasture, built from the kit (kit.js).
// These keep a fixed frame (s along x, f along z) and the places works.js expects: its moving parts (sails, wheels,
// flywheels, the derrick, the saw, the cloth, the kiln and furnace mouths) and its workers stand at fixed spots on the
// tile, and the smoke comes out of the stacks at gl.js SMOKE_AT. Small parts only close up (KF.lod).
function iSet(B) { kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); }
const I_TIMBER = '#7a5a44', I_STACK = '#9a5c4c';
function iStack(s, f, y0, top, r, col = I_STACK) { // a round brick chimney, banded near the top, with a cap
  kCone(s, f, y0, r * 1.15, top - y0, col, 10, M_BRICK, r * .85); kCyl(s, f, top - .03, r * .95, .03, shade(col, .8), M_BRICK, 10, '#2a2626');
  if (KF.lod) for (const y of [top - .1, top - .2]) kCyl(s, f, y, r * .92, .01, '#3a3d42', 0, 10, 0);
}
function iCart(s, f, a, col = '#8a6446', load) { // a little two-wheeled cart (a = along s or f)
  const al = a ? [.045, 0, 0] : [0, .045, 0], ac = a ? [0, .028, 0] : [.028, 0, 0]; kOB(s, f, .045, al, ac, [0, 0, .012], col, M_PLANK);
  for (const d of [-1, 1]) { const p = a ? [s, f + d * .032, .03] : [s + d * .032, f, .03]; kLog(p, a ? [p[0], p[1] + d * .006, .03] : [p[0] + d * .006, p[1], .03], .028, '#5a4030', '#6b5040', M_PLANK); }
  if (load) kBlob(s, f, .06, .035, .02, load, M_SAND);
  kBeam(a ? [s + .045, f, .05] : [s, f + .045, .05], a ? [s + .11, f, .02] : [s, f + .11, .02], .004, '#6b5040', M_PLANK);
}

/* ---------- the smithy: a stone forge with its chimney, a lean-to over the anvil (the smith works it: works.js) ---------- */
GL_MODEL.workshop = function (B, st) {
  const g = genOf(B); if (g) return iWorkshopNew(B, st, g); // (refitted: see needs.js REFIT)
  iSet(B); const [wc, wm] = kWall(B, st), lod = KF.lod, rc = st.roof, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), s0 = -.3, s1 = .3, fB = -.26, fD = .26, H = .36;
  kPlinth(s0, s1, fB, fD, .03, '#a59c8e'); kBox(0, 0, .03, .3, .26, H - .03, wc, wm);
  kBox(-.1, fD - .02, .03, .075, .025, .2, '#2a2420'); kBox(-.1, fD + .003, .03, .07, .004, .19, '#5c4a3e', M_PLANK); if (lod) for (const d of [-1, 1]) kOB(-.1 + d * .035, fD + .008, .13, [.03, 0, 0], [0, .003, 0], [0, 0, .095], shade('#5c4a3e', 1.1), M_PLANK); // the big doors
  kWin(.14, fD, .1, .04, .11, 1, { ty: wty, shut: wty === 'case' ? '#5a4436' : null }); kWins(s0, s1, fB, .03, .3, 1, 2, { ty: wty, back: 1 }, null, 10);
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWin((a + b) / 2, ff, .1, .035, .1, 20 + k, { ty: wty }), 8);
  kGable(s0, s1, fB, fD, H, .2, rc, { wall: wc, wm });
  kBox(.16, -.14, .03, .055, .055, H + .26, '#8f6f62', M_BRICK); kChim(.16, -.14, H + .2, .91, .05, .05, '#8f6f62', M_BRICK); // the forge chimney (smoke: gl.js SMOKE_AT)
  kCtr(.3, .34, .1); kQ([.2, .26, .24], [.44, .26, .24], [.44, .46, .18], [.2, .46, .18], rc, roofMat(gcol(rc))); for (const s of [.21, .43]) kBox(s, .45, 0, .007, .007, .18, I_TIMBER, M_PLANK); // a lean-to over the anvil
  if (lod) { kBox(.4, .3, 0, .03, .05, .07, '#6b5040', M_PLANK); kCyl(.42, .4, 0, .03, .045, '#5a5f66', 0, 8, '#4a7a9a'); for (let q = 0; q < 3; q++) kBeam([.24 + q * .02, .28, .005], [.25 + q * .02, .28, .14], .003, '#3a3d42'); // the bench, a quench tub, tools leaning
    kOB(-.24, .38, .015, [.04, 0, 0], [0, .03, 0], [0, 0, .015], '#6b6470'); for (let q = 0; q < 3; q++) kCyl(-.36 + q * .03, .4, 0, .022, .004, K_IRON, 0, 10); kSign(.3, fD, .3, st.accent); } // iron stock, horseshoes
};

/* ---------- the windmill: a tapered tower, a reefing stage, a cap with its fantail (the sails turn: works.js) ---------- */
GL_MODEL.mill = function (B, st) {
  iSet(B); const [wc, wm] = kWall(B, st), lod = KF.lod, ht = 16 * ZS, wall = wm === M_PLANK ? mix(st.wall, '#6b5a4a', .5) : wc, n = 8;
  kCyl(0, 0, 0, .21, .04, '#a59c8e', M_STONE, n); kCone(0, 0, .04, .19, ht - .04, wall, n, wm === M_PLANK ? M_PLANK : wm, .13);
  for (let sd = 0; sd < 4; sd++) kSide(sd, () => { if (sd !== 0) kWin(0, .16, .3, .018, .05, 10 + sd, { ty: 'case', back: 1 }); kWin(0, .145, .5, .016, .045, 20 + sd, { ty: 'case', back: 1 }); });
  kDoor(0, .19, .035, .12, '#5c4a3e', { ty: 'plank', y: .04 });
  kCyl(0, 0, .25, .25, .012, I_TIMBER, M_PLANK, 12); if (lod) { for (let q = 0; q < 16; q++) { const a = q / 16 * TAU; kBox(Math.cos(a) * .245, Math.sin(a) * .245, .262, .003, .003, .05, I_TIMBER, M_PLANK); } kCyl(0, 0, .31, .247, .005, I_TIMBER, M_PLANK, 12, 0); // the reefing stage, its rail
    for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; kBeam([Math.cos(a) * .17, Math.sin(a) * .17, .17], [Math.cos(a) * .245, Math.sin(a) * .245, .25], .004, I_TIMBER, M_PLANK); } }
  kCyl(0, 0, ht, .145, .02, '#5a4436', M_PLANK, 12); kDome(0, -.01, ht + .02, .15, .1, st.roof, roofMat(gcol(st.roof))); // the cap
  kBox(0, .1, ht + .02, .05, .04, .06, st.roof); // its front, where the windshaft comes out
  if (lod) { kBeam([0, -.14, ht + .05], [0, -.3, ht - .05], .006, I_TIMBER, M_PLANK); for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; kOB(0, -.3, ht + .02, [.002, 0, 0], [0, Math.cos(a) * .03, Math.sin(a) * .03], [0, -Math.sin(a) * .008, Math.cos(a) * .008], '#f2ece0'); } } // the fantail
  if (lod) { kCrate(.25, .22, 0, .022, '#c9b48a'); kCrate(.29, .18, 0, .02, '#d8c49a'); iCart(-.28, .26, 1, '#8a6446'); } // sacks of flour
};

/* ---------- the woodcutters: a log cabin with a stone stack, the pile, the block (works.js) and later a steam saw ---------- */
function drawLumber(B, st) {
  iSet(B); const lod = KF.lod, log = mix(st.wall, '#9a7048', .7), rc = mix(st.roof, '#7d5a3e', .6), s0 = -.33, s1 = .01, fB = -.29, fD = -.03, H = .17;
  kBox(.05, .1, 0, .34, .3, .005, '#d7c09a', M_EARTH); // sawdust and trodden earth
  kBox(-.16, -.16, 0, .17, .13, .012, '#8f8578', M_STONE);
  if (lod) for (let y = .012, k = 0; y < H; y += .028, k++) { kLog([s0 - (k % 2 ? .02 : 0), fB, y + .014], [s1 + (k % 2 ? 0 : .02), fB, y + .014], .014, log, '#d8b98a'); kLog([s0 - (k % 2 ? .02 : 0), fD, y + .014], [s1 + (k % 2 ? 0 : .02), fD, y + .014], .014, log, '#d8b98a');
    kLog([s0, fB - (k % 2 ? 0 : .02), y + .028], [s0, fD + (k % 2 ? .02 : 0), y + .028], .014, log, '#d8b98a'); kLog([s1, fB - (k % 2 ? 0 : .02), y + .028], [s1, fD + (k % 2 ? .02 : 0), y + .028], .014, log, '#d8b98a'); } // the logs, notched at the corners
  kBox(-.16, -.16, .012, .165, .125, H - .01, shade(log, .7), M_PLANK);
  kBox(-.22, fD + .005, .012, .035, .004, .1, '#5a4436', M_PLANK); kBox(-.07, fD + .005, .06, .025, .004, .04, '#2c3440', 0, kLit(1));
  kGable(s0, s1, fB, fD, H, .1, rc, { wall: log, wm: M_PLANK, noGut: 1 });
  kBox(-.04, -.25, 0, .03, .03, H + .12, '#7a6a5e', M_STONE); kChim(-.04, -.25, H + .06, H + .14, .028, .028, '#7a6a5e', M_STONE);
  glLogPile(.22, .12, 3, '#8f6440'); kCyl(-.2, .24, 0, .06, .045, '#8a6446', M_BARK, 10, '#d8b98a'); // the pile; the chopping block (works.js splits logs on it)
  if (lod) { for (let q = 0; q < 8; q++) { const a = q * 1.7; kBox(-.2 + Math.cos(a) * .1, .24 + Math.sin(a) * .08, 0, .012, .006, .004, '#d9b88a', M_PLANK); } // chips round the block
    for (let row = 0; row < 3; row++) for (let q = 0; q < 6; q++) kOB(-.36 + q * .028, .02, .015 + row * .03, [.012, 0, 0], [0, .06, 0], [0, 0, .014], shade('#c9a070', .9 + (q + row) % 3 * .06), M_PLANK); // a stack of split firewood
    kBeam([.3, -.38, 0], [.3, -.38, .12], .003, '#6b5040', M_PLANK); kOB(.3, -.38, .12, [.002, 0, 0], [0, .022, 0], [0, 0, .016], '#9aa3ad'); } // an axe left by the hut
  if ((B.var || 0) > .4 && !hasTech('steam')) for (const [a, b] of [[-.06, -.03], [.06, .03]]) { kBeam([.28 + a, -.22 + b, 0], [.28, -.22, .12], .006, '#6b5040', M_PLANK); kBeam([.28 + a, -.22 - b, 0], [.28, -.22, .12], .006, '#6b5040', M_PLANK); } // a sawhorse
  if (hasTech('steam')) { kBox(.2, -.18, 0, .1, .08, .18, '#8f8a86'); kBox(.2, -.18, .18, .12, .1, .012, '#6b6f75'); if (lod) { kBox(.32, -.22, 0, .035, .035, .13, '#3a3d42'); kCyl(.32, -.22, .13, .015, .1, '#2a2c30', 0, 8); } } // the saw bench and its little engine
}

/* ---------- the mine: an adit in the hillside, the headframe (works.js winds it), an engine house with its stack ---------- */
GL_MODEL.mine = function (B, st) {
  iSet(B); const lod = KF.lod, steam = hasTech('steam'), rock = '#9e95a8';
  kHip(-.38, .3, -.38, .3, 0, .22, rock, { ov: 0, noGut: 1, mat: M_STONE, bare: 1 }); // the spoil and the hill the adit goes into (rock, not a roof)
  kBox(-.05, .3, 0, .07, .04, .12, '#2f2a33'); for (const d of [-1, 1]) kBox(-.05 + d * .072, .33, 0, .012, .012, .13, I_TIMBER, M_PLANK); kBox(-.05, .33, .12, .09, .014, .016, I_TIMBER, M_PLANK); // the adit, propped
  for (const r of [-.03, .03]) kBox(-.05 + r, .41, 0, .004, .12, .006, '#5a5f66'); if (lod) for (let f = .3; f < .54; f += .035) kBox(-.05, f, 0, .045, .006, .004, '#6b5040', M_PLANK); // rails and sleepers
  kOB(-.05, .44, .03, [.03, 0, 0], [0, .04, 0], [0, 0, .022], '#6b6470'); kBlob(-.05, .44, .055, .03, .015, '#4a4550', M_STONE); // an ore tub
  glMineFrame(B);
  if (steam) { const ec = '#b8a890'; kBox(-.28, -.28, 0, .1, .08, .26, ec, M_STONE); kGable(-.38, -.18, -.36, -.2, .26, .08, '#5d6670', { wall: ec, wm: M_STONE }); kWin(-.28, -.2, .12, .025, .1, 3, { ty: 'sash', arch: 'round', back: 1 }); iStack(-.15, -.33, 0, .7, .04, '#8a7a68'); } // a Cornish engine house
  else if (lod) { kBox(-.28, -.28, 0, .07, .06, .1, mix(st.wall, '#8a6a4c', .5), M_PLANK); kGable(-.35, -.21, -.34, -.22, .1, .05, st.roof, { wall: st.wall, wm: M_PLANK, noGut: 1 }); } // the miners' hut
  if (lod) { kBlob(.3, .3, 0, .1, .05, '#6b6470', M_STONE); kBlob(.34, .2, 0, .07, .035, '#5a5560', M_STONE); kBox(.12, .38, 0, .004, .004, .14, K_IRON); kBox(.12, .38, .14, .012, .012, .02, '#ffe2a0', 0, 2); } // spoil, a lamp
};

/* ---------- the quarry: the pit (glPit), blocks waiting, the derrick (works.js swings it), a hut and a cart ---------- */
function drawQuarry(B, i) {
  iSet(B); const sc = stoneCol(i), lod = KF.lod;
  glPit(0, 0, .36, .34, 9, shade(sc, 1.03), sc, shade(sc, .9), 3, M_STONE);
  for (const [s, f, y] of [[.12, .14, .014], [.22, .02, .014], [.36, .12, 0], [.36, .26, 0], [.36, .19, .1], [.2, .38, 0]]) { kBox(s, f, y, .055, .05, .1, shade(sc, 1.04), M_STONE); if (lod) kBox(s, f + .051, y + .03, .04, .002, .002, shade(sc, .85)); } // cut blocks waiting to be carted off
  glDerrick(-.34, .3);
  if (lod) { iCart(.1, .42, 1, '#8a6446'); kBox(.11, .42, .06, .03, .025, .03, shade(sc, 1.04), M_STONE); for (let q = 0; q < 6; q++) kBlob(-.1 + q * .05, .4 + (q % 2) * .03, 0, .015, .01, shade(sc, .95), M_STONE); for (const d of [0, .03]) kBeam([-.2 + d, .42, 0], [-.21 + d, .44, .1], .003, '#6b5040', M_PLANK); } // a cart, rubble, tools
  if (hasTech('steam')) { kBox(-.38, -.34, 0, .08, .07, .16, '#8f8a86'); iStack(-.38, -.34, .16, .3, .015, '#5a5f66'); }
}

/* ---------- the clay pit: a pit, a puddle, bricks drying in hacks, the kiln with its glowing mouth (works.js) ---------- */
function drawClaypit(B, i) {
  iSet(B); const lod = KF.lod, v = B.var || 0;
  glPit(0, 0, .22, .2, 3, '#caa27c', '#a85c44', '#b8664a', 1);
  disc(-.08, -.05, .08, .3, '#7fb2c4', -1); // a puddle
  for (let r = 0; r < 2; r++) { for (let k = 0; k < 4; k++) for (let l = 0; l < (lod ? 3 : 1); l++) kBox(-.3 + k * .09, .32 + r * .08, l * .02, .03, .02, lod ? .018 : .055, r ? '#c9795c' : '#d68b6a', M_BRICK);
    if (lod) kCtr(-.165, .32 + r * .08, 0), kQ([-.35, .3 + r * .08, .07], [.0, .3 + r * .08, .07], [.0, .345 + r * .08, .065], [-.35, .345 + r * .08, .065], '#d8b86a', M_THATCH); } // bricks drying in hacks, thatched over
  if (hasTech('brick')) { kCyl(.3, -.2, 0, .13, .13, '#b06a52', M_BRICK, 12, 0); kCone(.3, -.2, .13, .13, .15, '#a25f49', 12, M_BRICK, .045); kCyl(.3, -.2, .28, .045, .05, '#8a4f3e', M_BRICK, 8, '#2a2626'); if (lod) for (const y of [.04, .09]) kCyl(.3, -.2, y, .133, .008, '#3a3d42', 0, 12, 0); } // a bottle kiln, banded with iron
  else kDome(.3, -.2, 0, .15, .15, '#b27058', M_BRICK);
  kBox(.3, -.07, .0, .025, .004, .1, '#3a2420'); // its mouth (the fire flickers: works.js)
  if (lod) { kBox(.42, -.32, 0, .03, .08, .05, '#6b5040', M_PLANK); for (let q = 0; q < 4; q++) kBeam([.4, -.39 + q * .045, .05], [.44, -.39 + q * .045, .05], .006, '#8a6446', M_BARK); } // firewood for it
  if (v > .5) for (let k = 0; k < 3; k++) kBlob(.05 + k * .05, .25, .02, .025, .02, shade('#c98a66', .9 + k * .05), 0);
}

/* ---------- the sand pit: the pit, heaps, a cart (works.js shovels into it), a sieve ---------- */
function drawSandpit(B, i) {
  iSet(B); const lod = KF.lod, v = B.var || 0;
  glPit(0, 0, .3, .26, 4, '#ecd5a8', '#d9b77f', '#e7cc98', 2, M_SAND);
  for (const [s, f, k] of [[.3, .2, 1], [.22, .34, .8]]) kBlob(s, f, 0, .12 * k, .1 * k, '#efd9ad', M_SAND); // heaps of sand
  iCart(-.32, .3, 1, '#9b7657', '#ead3a2');
  if (lod) { kOB(.32, -.32, .06, [.07, 0, 0], [0, .002, .05], [0, .004, 0], '#8a6446', M_PLANK); for (const d of [-1, 1]) kBeam([.32 + d * .06, -.3, 0], [.32 + d * .06, -.34, .1], .004, '#6b5040', M_PLANK); } // a sieve on its legs
  if (v > .5) kBeam([-.1, -.3, 0], [-.08, -.32, .13], .004, '#7a5a44', M_PLANK); // a spade left standing in a heap
}

/* ---------- the weaving house: a long workshop with tall windows for the light, the drying frame (works.js) ---------- */
GL_MODEL.weaver = function (B, st) {
  const g = genOf(B); if (g) return iWeaverNew(B, st, g);
  iSet(B); const [wc, wm] = kWall(B, st), lod = KF.lod, rc = st.roof, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), s0 = -.36, s1 = .2, fB = -.28, fD = .16, H = .3;
  kPlinth(s0, s1, fB, fD, .03); kBox(-.08, -.06, .03, .28, .22, H - .03, wc, wm);
  kWins(s0, s1, fD, .03, .14, 2, 4, { ty: wty, hw: .03, hk: .62 }, (k, fk) => fk === 0 && k === 1, 0); kWins(s0, s1, fB, .03, .14, 2, 4, { ty: wty, back: 1, hk: .62 }, null, 10);
  kDoor(-.16, fD, .035, .13, '#5c4a3e', { ty: wty === 'case' ? 'plank' : 'panel', hood: 'pent', roof: rc });
  kGable(s0, s1, fB, fD, H, .18, rc, { wall: wc, wm }); if (lod) for (let k = 0; k < 2; k++) kDormer(-.24 + k * .24, fD - .08, H + .06, .04, .08, .12, rc, wc, wm, k);
  kChim(s0 + .06, -.06, H + .08, H + .24, .03, .035, ...hStack(wm, wc)); kSign(s1, fD - .1, .24, st.accent);
  glDryFrame(.3); // (the cloth on it moves: works.js)
  if (lod) { for (let q = 0; q < 3; q++) kCyl(.24 + q * .05, -.36, 0, .02, .05, ['#c77fb0', '#7fb2c4', '#e0b04f'][q], M_PLANK, 8); kBarrel(.4, -.4); kBox(.4, -.4, .05, .02, .02, .004, '#7a4a8a'); kOB(-.42, .3, .02, [.03, 0, 0], [0, .025, 0], [0, 0, .02], '#f0ece0'); } // bolts of cloth, a dye vat, raw wool
};

/* ---------- the glassworks: the glassblowers' house, the furnace cone with its glowing mouth (works.js), bottles ---------- */
GL_MODEL.glassworks = function (B, st) {
  if (genOf(B)) return iGlassNew(B, st);
  iSet(B); const [wc, wm] = kWall(B, st), lod = KF.lod, rc = st.roof, s0 = -.36, s1 = .12, fB = -.16, fD = .28, H = .28;
  kPlinth(s0, s1, fB, fD, .03); kBox(-.12, .06, .03, .24, .22, H - .03, wc, wm);
  kWins(s0, s1, fD, .03, .25, 1, 3, { ty: kWinTy() === 'glass' ? 'modern' : 'sash', arch: 'round', hk: .5 }, k => k === 1, 0); kDoor(-.12, fD, .04, .15, '#5c4a3e', { ty: 'panel', hood: 'flat' });
  kWins(s0, s1, fB, .03, .25, 1, 3, { back: 1 }, null, 10); kGable(s0, s1, fB, fD, H, .16, rc, { wall: wc, wm });
  const fc = '#b8684f'; kCyl(.2, -.16, 0, .15, .15, fc, M_BRICK, 14, 0); kCone(.2, -.16, .15, .15, .6, '#a85c44', 14, M_BRICK, .045); iStack(.2, -.16, .75, 1.07, .035, '#8a4a3a'); // the cone (smoke: gl.js SMOKE_AT)
  kBox(.2, -.01, .0, .03, .006, .13, '#3a2a24'); if (lod) for (let q = 0; q < 7; q++) { const a = q / 6 * Math.PI, m = [Math.cos(a), Math.sin(a)]; kOB(.2 + m[0] * .036, -.006, .1 + m[1] * .036, [-m[1] * .01, 0, m[0] * .01], [0, .006, 0], [m[0] * .009, 0, m[1] * .009], '#8a4a3a', M_BRICK); } // the mouth, arched (it glows: works.js)
  if (lod) { for (const [s, f] of [[.34, .26], [.26, .34], [.3, .3], [.38, .32]]) kCyl(s, f, 0, .012, .035, '#a0dceb', 0, 6, '#cfeff6'); kCrate(.36, .4, 0, .022, '#b58d62'); for (let q = 0; q < 4; q++) kBeam([-.38 + q * .03, .35, 0], [-.37 + q * .03, .38, .1], .003, '#6b5040', M_PLANK); } // fresh bottles, a crate, pipes
};

/* ---------- refitted workplaces (needs.js REFIT): the same spots for works.js's worker and gl.js's smoke ---------- */
const iBrick = st => hasTech('brick') ? [mix(st.wall, '#a5573f', .6), M_BRICK] : [st.wall, glWallMat({ type: 'works', style: S.styleIdx }) || M_STONE];
function iWorkshopNew(B, st, g) { // 1: a Victorian machine shop (brick, arched windows, big doors, a roof lantern, a tall stack); 2: a fab workshop
  iSet(B); const lod = KF.lod, s0 = -.36, s1 = .3, fB = -.28, fD = .24, rc = st.roof;
  if (g === 1) { const [wc, wm] = iBrick(st), H = .4;
    kPlinth(s0, s1, fB, fD, .04, '#8f877c'); kBox((s0 + s1) / 2, (fB + fD) / 2, .04, (s1 - s0) / 2, (fD - fB) / 2, H - .04, wc, wm);
    kWins(s0, s1, fD, .06, .28, 1, 5, { ty: 'sash', arch: 'seg', hk: .5, wall: wc }, k => k === 1, 0); kWins(s0, s1, fB, .06, .28, 1, 5, { ty: 'sash', arch: 'seg', back: 1 }, null, 10);
    kBox(-.17, fD + .004, .04, .06, .004, .24, '#3f5a4a', M_PLANK); if (lod) { kBox(-.17, fD + .007, .04, .003, .003, .24, '#2f4436'); kBox(-.17, fD + .006, .28, .07, .004, .012, '#c9c2b6', M_STONE); } // the double doors and their lintel
    kBand(s0, s1, fD, H - .02, '#c9c2b6'); kGable(s0, s1, fB, fD, H, .14, rc, { wall: wc, wm });
    kBox((s0 + s1) / 2, (fB + fD) / 2, H + .1, (s1 - s0) / 2 - .06, .04, .05, '#bfe3f0', M_GLASS, .4); kCtr((s0 + s1) / 2, (fB + fD) / 2, H + .1); // a glazed lantern along the ridge
    iStack(.16, -.14, H, 1.18, .045); // (smoke: gl.js SMOKE_GEN)
    kCtr(.32, .36, .1); kQ([.2, .26, .26], [.44, .26, .26], [.44, .46, .2], [.2, .46, .2], '#5d6670', M_SLATE); for (const s of [.21, .43]) kBox(s, .45, 0, .006, .006, .2, '#3d4a44'); // the fitting bay's canopy, on iron posts
    if (lod) { for (let q = 0; q < 4; q++) kBox(-.32 + q * .022, .36, 0, .006, .08, .012 + q * .008, '#5a5f66'); kBarrel(-.22, .4, 0, .02, .05, '#3d5a6a'); kBarrel(-.18, .42, 0, .02, .05, '#3d5a6a'); kCrate(.0, .4, 0, .024); kCrate(.04, .42, 0, .02, '#8a6a4c'); kSign(.3, fD, .3, st.accent); }
    return; }
  const wc = mix(st.wall, '#dfe3e8', .55), H = .32; // the fab workshop: light panels, a glass front, a roller door, panels on the roof
  kBox((s0 + s1) / 2, (fB + fD) / 2, 0, (s1 - s0) / 2, (fD - fB) / 2, H, wc, M_PLASTER);
  kBox(.06, fD + .003, .04, .2, .003, .2, '#2c3e50', M_GLASS, .55); if (lod) for (let q = 0; q <= 5; q++) kBox(-.14 + q * .08, fD + .006, .04, .004, .004, .2, '#8c9199');
  kBox(-.25, fD + .004, 0, .07, .004, .22, '#9aa0a6'); if (lod) for (let q = 0; q < 10; q++) kBox(-.25, fD + .007, .01 + q * .021, .068, .002, .002, '#7d838a'); // the roller door, ribbed
  kBox(-.07, fD + .003, .26, .3, .006, .035, st.accent); kFlat(s0, s1, fB, fD, H, '#8c9199', .03); kSolar(0, -.05, H + .02, .26, .18, .25);
  kCtr(.32, .36, .1); kBox(.32, .36, .2, .13, .11, .012, '#c9cdd2'); for (const [s, f] of [[.2, .26], [.44, .26], [.2, .46], [.44, .46]]) kBox(s, f, 0, .006, .006, .2, '#8c9199'); // the canopy over the work bay
  if (lod) { kBox(-.12, .4, 0, .09, .045, .085, '#f2f4f7'); kBox(-.12, .4, .085, .085, .04, .03, '#3a4250', 0, .4); kBox(-.035, .4, .0, .02, .04, .05, '#2a2c30'); kCrate(.05, .4, 0, .022, '#c9a77a'); kSign(.3, fD, .28, st.accent); } // a little electric van
}
function iWeaverNew(B, st, g) { // 1: a brick cotton mill, four floors of windows, a stair tower and a chimney; 2: a quiet knitting hall
  iSet(B); const lod = KF.lod, rc = st.roof;
  if (g === 1) { const [wc, wm] = iBrick(st), s0 = -.4, s1 = .24, fB = -.28, fD = .14, H = .66;
    kPlinth(s0, s1, fB, fD, .04, '#8f877c'); kBox((s0 + s1) / 2, (fB + fD) / 2, .04, (s1 - s0) / 2, (fD - fB) / 2, H - .04, wc, wm);
    for (const ff of [fD, fB]) kWins(s0, s1, ff, .06, .145, 4, 7, { ty: 'sash', arch: 'seg', hk: .62, back: ff < 0 ? 1 : 0, wall: wc }, null, ff < 0 ? 20 : 0);
    for (let k = 1; k < 4; k++) kBand(s0, s1, fD, .06 + k * .145, '#c9c2b6'); kCornice(s0, s1, fB, fD, H, '#c9c2b6', { h: .025, ov: .012 }); kHip(s0 - .01, s1 + .01, fB - .01, fD + .01, H + .025, .1, rc, { ov: .01 });
    kBox(.31, -.07, 0, .07, .07, H + .14, wc, wm); kWalls(.24, .38, -.14, 0, (a, b, ff, k) => { if (k !== 2) kWins(a, b, ff, .1, .18, 3, 1, { ty: 'sash', arch: 'round', hk: .5 }, null, 30 + k); }); kHip(.235, .385, -.145, .005, H + .14, .1, rc, { ov: .008, fin: 1 }); // the stair tower
    kDoor(-.08, fD, .04, .14, '#3f5a4a', { ty: 'panel', fan: 1, hood: 'flat' }); kSign(s0 + .06, fD, .3, st.accent);
    iStack(.32, -.34, 0, 1.36, .05); // (smoke: gl.js SMOKE_GEN)
    if (lod) for (let q = 0; q < 6; q++) kBox(-.3 + (q % 3) * .07, .32 + ((q / 3) | 0) * .06, 0, .03, .025, .045, '#ede6d6', M_PLANK); // bales of cloth
    return; }
  const wc = mix(st.wall, '#e8ecef', .5), s0 = -.4, s1 = .3, fB = -.3, fD = .16, H = .24, n = 4, w = (s1 - s0) / n; // sawtooth north lights over a single floor
  kBox((s0 + s1) / 2, (fB + fD) / 2, 0, (s1 - s0) / 2, (fD - fB) / 2, H, wc, M_PLASTER);
  for (let k = 0; k < n; k++) { const a = s0 + k * w, b = a + w; kCtr((a + b) / 2, (fB + fD) / 2, H); kQ([a, fB, H], [a, fD, H], [b, fD, H + .1], [b, fB, H + .1], '#9aa3ab', 0); kQ([b, fB, H], [b, fD, H], [b, fD, H + .1], [b, fB, H + .1], '#bfe3f0', M_GLASS, .4);
    kT([a, fD, H], [b, fD, H], [b, fD, H + .1], wc, M_PLASTER); kT([a, fB, H], [b, fB, H], [b, fB, H + .1], wc, M_PLASTER); }
  kBox(-.05, fD + .003, .04, .25, .003, .12, '#2c3e50', M_GLASS, .5); kBox(-.05, fD + .003, .19, .25, .006, .03, st.accent); kDoor(.2, fD, .04, .15, '#5a6470', { ty: 'glass' });
  if (lod) { kTree(.38, .3, 0, .4, .7, '#5f9a4d'); kBench(-.25, .32, 0, 1); for (let q = 0; q < 3; q++) kCyl(-.05 + q * .05, .32, 0, .018, .04, ['#c77fb0', '#7fb2c4', '#e0b04f'][q], 0, 8); }
}
function iGlassNew(B, st) { // the float-glass works: a long hall, the furnace door glowing at its front, a tall stack, sheets stacked on racks
  iSet(B); const lod = KF.lod, [wc, wm] = iBrick(st), s0 = -.4, s1 = .38, fB = -.34, fD = -.02, H = .3, rc = '#6c7680';
  kPlinth(s0, s1, fB, fD, .03, '#8f877c'); kBox((s0 + s1) / 2, (fB + fD) / 2, .03, (s1 - s0) / 2, (fD - fB) / 2, H - .03, wc, wm);
  kWins(s0, s1, fD, .08, .14, 1, 6, { ty: 'steel', hk: .5 }, k => k === 4, 0); kFlat(s0, s1, fB, fD, H, rc, .03);
  kBox(.2, fD + .003, .03, .06, .004, .13, '#3a3d42'); // the furnace bay (its door glows: works.js)
  iStack(.2, -.16, H, 1.18, .04, '#9aa0a6'); // (smoke: gl.js SMOKE_GEN)
  kBox(-.15, fB + .1, H, .12, .06, .06, '#8c9199'); // the lehr's housing on the roof
  if (lod) { for (let k = 0; k < 3; k++) { const s = -.3 + k * .14; kBeam([s - .04, .2, 0], [s, .2, .14], .004, '#5a6470'); kBeam([s + .04, .2, 0], [s, .2, .14], .004, '#5a6470'); for (let q = 0; q < 4; q++) kOB(s + (q - 1.5) * .012, .2, .065, [.002, 0, 0], [0, .05, 0], [0, 0, .06], '#bfe6ee', M_GLASS); } kCrate(.32, .3, 0, .022, '#b58d62'); kSign(s0 + .05, fD, .2, st.accent); } // A-frame racks of sheet glass
}

/* ---------- the works: a sawtooth shop floor of north lights, a tall chimney, the yard (works.js turns the flywheel) ---------- */
GL_MODEL.works = function (B, st) {
  iSet(B); const brick = hasTech('brick'), wc = brick ? mix(st.wall, '#a5573f', .55) : st.wall, wm = brick ? M_BRICK : glWallMat(B), lod = KF.lod, s0 = -.42, s1 = .42, fB = -.3, fD = .3, H = .26;
  kPlinth(s0, s1, fB, fD, .03, '#8f8a86'); kBox(0, 0, .03, .42, .3, H - .03, wc, wm);
  kWins(s0, s1, fD, .03, .23, 1, 6, { ty: kWinTy() === 'glass' ? 'modern' : hasTech('concrete') ? 'modern' : 'sash', arch: brick ? 'seg' : null, wall: wc, hk: .6 }, k => k === 2, 0);
  kBox(-.07, fD + .002, .03, .05, .004, .16, '#4a4f56'); if (lod) for (let y = .05; y < .18; y += .025) kBox(-.07, fD + .006, y, .05, .002, .002, '#3a3d42'); // a roller door
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .04, b - .04, ff, .03, .23, 1, 4, { ty: 'sash', back: 1, hk: .6 }, null, 10 + k), 14);
  for (let k = 0; k < 3; k++) { const s = -.28 + k * .28; kCtr(s, 0, 0); kQ([s - .14, fB, H], [s - .14, fD, H], [s + .14, fD, H + .14], [s + .14, fB, H + .14], shade(st.roof, .95), roofMat(gcol(st.roof)));
    kQ([s + .14, fB, H + .14], [s + .14, fD, H + .14], [s + .14, fD, H], [s + .14, fB, H], shade(st.glass, .8), 0, kLit(30 + k) * .6); for (const f of [fB, fD]) kT([s - .14, f, H], [s + .14, f, H], [s + .14, f, H + .14], wc, wm);
    if (lod) for (let f = fB + .05; f < fD; f += .06) kBox(s + .142, f, H, .003, .004, .14, '#3a3d42'); } // the sawtooth: north lights glazed
  iStack(.28, -.18, H, 1.95, .055); // the chimney (smoke: gl.js SMOKE_AT)
  if (lod) { for (let q = 0; q < 3; q++) kBarrel(-.36 + q * .05, .4, 0, .02, .045, '#4a5560'); kCrate(.36, .42, 0, .03, '#8a7a68'); kCrate(.3, .44, 0, .025); kBox(-.2, .42, 0, .05, .03, .04, '#5a5f66'); } // drums, crates, castings
};

/* ---------- the power house: a tall brick hall with arched windows, twin stacks (works.js turns the flywheel), a switchyard ---------- */
GL_MODEL.power = function (B, st) {
  iSet(B); const wc = hasTech('brick') ? mix(st.wall, '#a5573f', .5) : st.wall, wm = hasTech('brick') ? M_BRICK : glWallMat(B), lod = KF.lod, s0 = -.36, s1 = .36, fB = -.28, fD = .28, H = .5;
  kPlinth(s0, s1, fB, fD, .04, '#8f8a86'); kBox(0, 0, .04, .36, .28, H - .04, wc, wm);
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .03, b - .03, ff, .04, H - .1, 1, k % 2 ? 3 : 4, { ty: 'sash', arch: 'round', hk: .62, yk: .14 }, null, 10 * k), 15);
  kPilasters(s0, s1, 4, fD, .04, H, shade(wc, .88), .016); kCornice(s0, s1, fB, fD, H, '#cfc6b4', { br: 0 });
  kGable(s0, s1, fB, fD, H + .03, .14, st.roof, { wall: wc, wm }); if (lod) kBox(0, 0, H + .17, .3, .03, .03, '#9aa3ad'); // a roof vent along the ridge
  for (const s of [-.16, .16]) iStack(s, -.2, H, 1.65, .05, '#a39a92'); // (smoke: gl.js SMOKE_AT)
  if (hasTech('electric')) { const sy = .4; for (const s of [-.3, -.1, .1, .3]) { kBox(s, sy, 0, .004, .004, .16, '#8c939b'); kBox(s, sy, .16, .03, .003, .003, '#8c939b'); if (lod) for (const d of [-.02, .02]) kCyl(s + d, sy, .14, .005, .02, '#e8e2d6', 0, 6); }
    if (lod) for (const d of [-.02, .02]) kBeam([-.3 + d, sy, .16], [.3 + d, sy, .16], .0012, '#2a2a2a'); kBox(-.38, .4, 0, .05, .04, .07, '#6b7380'); } // the switchyard: pylons and lines, a transformer
};

/* ---------- the warehouse: a long store with loading doors and a hoist, crates (works.js brings more) ---------- */
GL_MODEL.warehouse = function (B, st) {
  iSet(B); const [wc, wm] = kWall(B, st), lod = KF.lod, s0 = -.42, s1 = .42, fB = -.26, fD = .22, H = .3, fc = -.02;
  kPlinth(s0, s1, fB, fD, .04, '#a59c8e'); kBox(0, fc, .04, .42, .24, H - .04, wc, wm);
  for (const s of [-.22, .08]) { kBox(s, fD - .02, .04, .055, .025, .17, '#2a2420'); kBox(s, fD + .003, .04, .05, .004, .16, shade(st.trim, .75), M_PLANK); if (lod) for (const d of [-1, 1]) kBeam([s - .045, fD + .008, .05 + (d + 1) * .07], [s + .045, fD + .008, .05 + (1 - d) * .07], .003, shade(st.trim, .6), M_PLANK); } // loading doors, braced
  kWins(s0, s1, fD, .22, .1, 1, 6, { ty: 'sash', hw: .025, hk: .55, back: 1 }, null, 0); kWins(s0, s1, fB, .04, .2, 1, 5, { back: 1, hw: .025 }, null, 20);
  kGable(s0 - .01, s1 + .01, fB - .01, fD + .01, H, .17, st.roof, { wall: wc, wm });
  kGableF(-.04, .14, fD - .12, fD + .06, H + .02, .08, st.roof, { wall: wc, wm }); kBox(.05, fD, H - .06, .05, .03, .08, wc, wm); kBox(.05, fD + .03, H - .05, .03, .002, .06, '#3a2a20', M_PLANK); // the hoist loft
  kBeam([.05, fD + .06, H + .06], [.05, fD + .14, H + .06], .007, I_TIMBER, M_PLANK); if (lod) { kBeam([.05, fD + .13, H + .06], [.05, fD + .13, .16], .0015, '#3a3028'); kCrate(.05, fD + .13, .12, .02); } // its beam, rope and a crate on the way up
  kLantern(-.07, fD, .25);
  for (const [s, f, y] of [[.3, .36, 0], [.36, .3, 0], [.33, .33, .055]]) kCrate(s, f, y, .028, '#b58d62');
  for (const [s, f] of [[-.34, .34], [-.26, .36]]) kBarrel(s, f, 0, .03, .065, '#8a5a3c');
  if (lod) { kOB(-.1, .36, .015, [.05, 0, 0], [0, .04, 0], [0, 0, .015], '#9b7a54', M_PLANK); kCrate(-.1, .36, .03, .02, '#a07850'); kBlob(-.18, .4, .02, .03, .02, '#d8c49a', 0); } // a pallet, sacks
};

/* ---------- the water tower: a stone cistern tower (before steam), then a riveted iron tank on a braced frame ---------- */
GL_MODEL.watertower = function (B, st) {
  iSet(B); const lod = KF.lod;
  if (genOf(B) < 1) { // (until it's refitted with an iron tank: needs.js REFIT)
    const [wc, wm] = kWall(B, st); kCyl(0, 0, 0, .17, .04, '#a59c8e', M_STONE, 12); kCone(0, 0, .04, .16, .74, wc, 12, wm === M_PLASTER ? M_STONE : wm, .14);
    kDoor(0, .155, .03, .11, '#5c4a3e', { ty: 'plank', y: .04 }); for (let sd = 1; sd < 4; sd++) kSide(sd, () => kWin(0, .145, .38, .015, .06, sd, { ty: 'case', back: 1 }));
    kCyl(0, 0, .74, .21, .36, mix(wc, '#a8b4bf', .35), M_STONE, 14, 0); kCornice(-.2, .2, -.2, .2, .74, '#cfc6b4', { br: 0, h: .02, ov: .015 }); if (lod) for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; kBox(Math.cos(a) * .2, Math.sin(a) * .2, .72, .012, .012, .02, '#cfc6b4', M_STONE); } // corbels under the cistern
    kCone(0, 0, 1.1, .24, .3, st.roof, 14); kBlob(0, 0, 1.4, .02, .02, '#8c8f94', 0); return;
  }
  const col = mix('#c9d2da', st.accent, .15);
  for (const [s, f] of [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]]) kBeam([s, f, 0], [s * .75, f * .75, 1], .012, '#6c7683');
  for (const y of [.3, .65]) { const k = 1 - y * .25; for (let q = 0; q < 4; q++) { const a = [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]][q], b = [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]][(q + 1) % 4]; kBeam([a[0] * k, a[1] * k, y], [b[0] * k, b[1] * k, y], .006, '#7c8693'); } }
  if (lod) for (let q = 0; q < 4; q++) { const a = [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]][q], b = [[-.15, -.15], [.15, -.15], [.15, .15], [-.15, .15]][(q + 1) % 4]; kBeam([a[0], a[1], 0], [b[0] * .92, b[1] * .92, .3], .003, '#7c8693'); kBeam([b[0], b[1], 0], [a[0] * .92, a[1] * .92, .3], .003, '#7c8693'); } // cross bracing
  kBox(0, 0, 0, .006, .006, 1, '#5a6470'); // the riser
  kCyl(0, 0, 1, .22, .45, col, 0, 16, 0); if (lod) for (let y = 1.08; y < 1.44; y += .09) kCyl(0, 0, y, .222, .005, shade(col, .85), 0, 16, 0); // the tank, riveted in rings
  kCyl(0, 0, .99, .26, .012, '#7c8693', 0, 16); if (lod) { for (let q = 0; q < 20; q++) { const a = q / 20 * TAU; kBox(Math.cos(a) * .255, Math.sin(a) * .255, 1, .002, .002, .04, '#5a6470'); } for (let y = .1; y < 1; y += .04) kBox(.16, -.16, y, .012, .002, .002, '#5a6470'); kBeam([.16, -.16, 0], [.16, -.16, 1], .002, '#5a6470'); } // the walkway and its rail, a ladder
  kDome(0, 0, 1.45, .22, .09, '#b6c2cc'); kBox(0, .222, 1.18, .05, .004, .03, '#f2ece0'); lamp(0, .225, 27, .01);
};

/* ---------- the pasture: post-and-rail fence, a field shelter, the trough, sheep (works.js: the shepherd and the dog) ---------- */
function drawPasture(B, st) {
  iSet(B); const v = B.var || 0, E = .43, lod = KF.lod;
  kBox(0, 0, 0, .46, .46, .007, '#b3d98c', M_GRASS);
  if (lod) for (let k = 0; k < 7; k++) tuftAt(hash2(B.x * 7 + k, B.y, 21) * .8 - .4, hash2(B.x, B.y * 7 + k, 22) * .8 - .4, '#94c47a'); // grazed tufts
  kFence([[-E, -E], [E, -E], [E, E], [-E, E], [-E, -E]], .06, '#8a6446', 'rail');
  const sw = mix(st.wall, '#a57f5e', .5); kBox(-.25, -.25, 0, .1, .08, .09, sw, M_PLANK); if (lod) for (let s = -.34; s < -.15; s += .025) kBox(s, -.17 + .002, 0, .004, .003, .09, shade(sw, .8), M_PLANK);
  kBox(-.25, -.17, 0, .07, .006, .07, '#2a2420'); kCtr(-.25, -.25, 0); kQ([-.37, -.37, .1], [-.13, -.37, .1], [-.13, -.15, .06], [-.37, -.15, .06], st.roof, roofMat(gcol(st.roof))); // a field shelter
  kBox(.18, -.26, 0, .09, .03, .05, '#8a6446', M_PLANK); if (lod) kBox(.18, -.26, .045, .08, .022, .002, '#6fa8c4', 0, -1); // the trough
  sheepAt(.06, .12, 2.2, v < .5); sheepAt(.28, -.1, 1.8, v >= .5); if (v > .3) sheepAt(-.18, .26, 1.2, true);
  if (lod) { kBlob(.32, .3, 0, .06, .05, '#d8b86a', M_THATCH); kBlob(-.36, .1, 0, .04, .04, '#c9a85a', M_THATCH); } // hay
}

/* ---------- farms: crops by kind in their rows, furrows, a hedgerow, wall or fence where the field ends, a gate; now and then a barn ---------- */
// Five rows at the places works.js's farm hands walk between. Neighbouring farm tiles make one big field: the boundary only
// goes where the field ends. A styled field (round pivot rings, an orchard, flowers, stripes) follows the style.
GL_MODEL.farm = function (B, st0) {
  iSet(B); const T = S.T[B.sid], st = S.styles[B.style] || STYLES0[0], fk = st.fields || (dsRound() ? 'round' : null), lod = KF.lod, v = B.var || 0;
  const ck = T ? T.crop % CROPS.length : 5, crop = B.blight > S.year ? '#7d7256' : CROPS[ck].c, cn = CROPS[ck].n, soil = '#9a7350', au = v < .5, grown = B.prog >= 1 ? 1 : B.prog, green = hasTech('genegarden');
  const isFarm = (dx, dy) => { const x = B.x + dx, y = B.y + dy; if (!inb(x, y)) return false; const C = S.B[M.bld[idx(x, y)]]; return !!C && C.type === 'farm'; };
  const edge = () => { // the boundary where the field ends: a hedgerow, a dry-stone wall or a post-and-rail fence (by the town's land and age)
    const h = hash2(B.sid | 0, 3, 61), ty = h < .45 ? 'hedge' : h < .7 && !hasTech('motor') ? 'wall' : 'rail', col = ty === 'wall' ? '#a8a092' : '#8a6d57', E = .47;
    for (const [dx, dy, a, b] of [[0, -1, [-E, -E], [E, -E]], [1, 0, [E, -E], [E, E]], [0, 1, [E, E], [-E, E]], [-1, 0, [-E, E], [-E, -E]]]) { if (isFarm(dx, dy)) continue;
      const gate = hash2(B.x + dx, B.y + dy, 63) < .3, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (gate) { const g1 = [m[0] - (b[0] - a[0]) * .1, m[1] - (b[1] - a[1]) * .1], g2 = [m[0] + (b[0] - a[0]) * .1, m[1] + (b[1] - a[1]) * .1]; kFence([a, g1], ty === 'hedge' ? .06 : .05, col, ty); kFence([g2, b], ty === 'hedge' ? .06 : .05, col, ty);
        if (lod) { kFence([g1, [g1[0] + (g2[0] - g1[0]) * .9 + (dy ? 0 : dx * -.05), g1[1] + (g2[1] - g1[1]) * .9 + (dx ? 0 : dy * -.05)]], .045, '#8a6d57', 'rail'); for (const p of [g1, g2]) kBox(p[0], p[1], 0, .008, .008, .065, '#6b5040', M_PLANK); } } // a gate, swung half open
      else kFence([a, b], ty === 'hedge' ? .06 : .05, col, ty);
      if (ty === 'hedge' && lod && hash2(B.x * 3 + dx, B.y * 3 + dy, 64) < .35) kTree(m[0] * .95, m[1] * .95, 0, hash2(B.x, B.y, 65 + dx), .75, '#5f8f45'); } // an oak in the hedgerow
  };
  if (fk === 'round') { // centre-pivot rings, and the pivot's arm on its wheeled towers
    kBox(0, 0, 0, .47, .47, .006, soil, M_SOIL); for (let k = 0; k < 4; k++) { if (k / 4 > grown) break; const r = .42 - k * .1; ring(0, 0, r + .03, .06, 1, k % 2 ? shade(crop, .82) : crop, 0, TAU, 24, 0, M_CROP); }
    const a = v * TAU, c = Math.cos(a), sn = Math.sin(a); kBox(0, 0, 0, .014, .014, .09, '#9aa0a6'); kBeam([0, 0, .085], [c * .44, sn * .44, .07], .005, '#d9d4cc');
    if (lod) for (const t of [.2, .4]) { kBeam([c * t, sn * t, .075], [c * t - sn * .03, sn * t + c * .03, 0], .003, '#9aa0a6'); kBeam([c * t, sn * t, .075], [c * t + sn * .03, sn * t - c * .03, 0], .003, '#9aa0a6'); for (const d of [-1, 1]) kLog([c * t + d * sn * .035, sn * t - d * c * .035, .012], [c * t + d * sn * .04, sn * t - d * c * .04, .012], .012, '#3a3a3a', '#5a5a5a', 0); }
    return edge();
  }
  if (fk === 'orchard') { // trees in rows, fruit on them, grass between, a ladder against one
    kBox(0, 0, 0, .46, .46, .006, '#8fc47f', M_GRASS);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if ((a * 3 + b) / 9 > grown) break; const s = -.3 + a * .3, f = -.3 + b * .3; kTree(s, f, 0, .5, .9, '#6db873'); if (lod) for (let q = 0; q < 4; q++) kBlob(s + Math.cos(q * 1.6) * .06, f + Math.sin(q * 1.6) * .06, .14 + q * .012, .014, .014, crop === '#6f9748' ? '#c0392b' : crop, 0); }
    if (lod && grown >= 1) { kBeam([.06, -.3, 0], [.0, -.3, .16], .003, '#8a6446', M_PLANK); kBeam([.06, -.27, 0], [.0, -.27, .16], .003, '#8a6446', M_PLANK); for (let q = 0; q < 3; q++) kCrate(.12 + q * .045, .14, 0, .018, '#a07850'); }
    return edge();
  }
  // a field in rows: the soil, furrows between the rows, the crop by its kind
  const P = (a, o) => au ? [a, o] : [o, a];
  const barn = hash2(B.id | 0, 1, 77) > .55 && hash2(B.x, B.y, 78) < .22 && grown >= 1; // (only where no farm hand works: works.js)
  kBox(0, 0, 0, .46, .46, .006, soil, M_SOIL);
  for (let k = 0; k < 5; k++) { const o = -.36 + k * .18; if (k / 5 > grown) break;
    const col = fk === 'flowers' ? FLOWERS[(k + ((v * 5) | 0)) % FLOWERS.length] : fk === 'stripes' && k % 2 ? mix(crop, st.accent, .55) : green && k % 2 ? shade(crop, 1.1) : crop;
    const a0 = -.42, a1 = barn && o > .1 ? .1 : .42, L = a1 - a0, mid = (a0 + a1) / 2, [ms, mf] = P(mid, o);
    if (lod && k < 4) { const [fs, ff] = P(mid, o + .09); kOB(fs, ff, .006, au ? [L / 2, 0, 0] : [0, L / 2, 0], au ? [0, .015, 0] : [.015, 0, 0], [0, 0, .002], shade(soil, .82), M_SOIL); } // a furrow
    const grain = cn === 'barley' || cn === 'rye' || cn === 'oats' || cn === 'wheat';
    if (!lod || fk === 'flowers' || fk === 'stripes') { kOB(ms, mf, .006 + (grain ? .022 : .014), au ? [L / 2, 0, 0] : [0, L / 2, 0], au ? [0, .055, 0] : [.055, 0, 0], [0, 0, grain ? .022 : .014], col, M_CROP); if (!lod) continue; }
    if (fk === 'flowers' || fk === 'stripes') { for (let a = a0 + .02; a < a1; a += .05) { const [s, f] = P(a, o); kBlob(s, f, .03, .012, .008, shade(col, 1.15), 0); } continue; }
    const along = au ? [L / 2, 0, 0] : [0, L / 2, 0], side = w => au ? [0, w, 0] : [w, 0, 0]; // (close up: cheap shapes, many of them)
    if (grain) { kOB(ms, mf, .02, along, side(.05), [0, 0, .014], shade(col, .85), M_CROP); kOB(ms, mf, .038, along, side(.046), [0, 0, .006], shade(col, 1.08), M_CROP); // the stalks, the ears along the top
      GLB.mat = M_CROP; const C = gcol(shade(col, 1.12)); for (let a = a0 + .03; a < a1; a += .06) { const [s, f] = P(a, o + ((a * 37) % 1 - .5) * .06), p = kP(s, f, .044); GLB.ctr = [p[0], p[1] - .1, p[2]]; gtri([p[0] - .008, p[1], p[2]], [p[0] + .008, p[1], p[2]], [p[0], p[1] + .022, p[2] + .004], C); gtri([p[0], p[1], p[2] - .008], [p[0], p[1], p[2] + .008], [p[0] + .004, p[1] + .02, p[2]], C); } } // ears standing above
    else if (cn === 'cabbages') for (let a = a0 + .04; a < a1; a += .08) for (const d of [-.025, .025]) { const [s, f] = P(a + (d > 0 ? .04 : 0), o + d); kBox(s, f, .006, .018, .018, .022, shade(col, .95 + (d > 0 ? .1 : 0)), M_LEAF); }
    else if (cn === 'flax') { kOB(ms, mf, .02, along, side(.045), [0, 0, .014], col, M_CROP); kOB(ms, mf, .036, along, side(.03), [0, 0, .002], '#7a9ad8', 0); } // blue flowers on top
    else { kOB(ms, mf, .016, along, side(.05), [0, 0, .01], shade(col, .9), M_LEAF); for (let a = a0 + .04; a < a1; a += .08) { const [s, f] = P(a, o); kBox(s, f, .02, .024, .024, .018, shade(col, .95 + ((a * 30) % 1) * .12), M_LEAF); } } // potatoes: the haulm, bushier clumps along it
  }
  for (const [s, f] of [[-.46, -.46], [.46, -.46], [-.46, .46], [.46, .46]]) kBox(s, f, 0, .007, .007, .06, '#8a6d57', M_PLANK);
  if (barn) { // a barn in the corner: boarded walls, big doors, a loft door, a gable (thatch while it lasts), a cart and hay
    const bc = ['#8a3a2a', '#3a3430', '#d8cfc0'][(hash2(B.x, B.y, 79) * 3) | 0], rc = hasTech('masonry') ? st.roof : '#c9a65a', bs = au ? .28 : .28, bf = au ? .3 : .3; kSet(GLB.x + (au ? bs : bf), GLB.y + (au ? bf : bs), [1, 0, 0], [0, 0, -1], B.id);
    kBox(0, 0, 0, .15, .1, .02, '#8f8578', M_STONE); kBox(0, 0, .02, .14, .09, .14, bc, M_PLANK); if (lod) for (let s = -.13; s < .14; s += .026) { kBox(s, .092, .02, .003, .003, .14, shade(bc, .8), M_PLANK); kBox(s, -.092, .02, .003, .003, .14, shade(bc, .8), M_PLANK); }
    kBox(0, .092, .02, .055, .004, .11, shade(bc, .7), M_PLANK); if (lod) { kBeam([-.05, .097, .03], [.05, .097, .12], .003, '#e8e2d6', M_PLANK); kBeam([.05, .097, .03], [-.05, .097, .12], .003, '#e8e2d6', M_PLANK); }
    kGableF(-.14, .14, -.09, .09, .16, .11, rc, { wall: bc, wm: M_PLANK }); kBox(0, .094, .2, .025, .004, .03, '#3a2a20', M_PLANK);
    if (lod) { for (let q = 0; q < 3; q++) kCyl(-.1 + q * .05, .16, 0, .02, .03, '#d8b86a', M_THATCH, 8); kCtr(0, 0, 0); iCart(.16, .18, 0, '#8a6446', '#d8b86a'); }
  }
  if (lod && hash2(B.x, B.y, 77) < .3 && grown >= 1 && !barn) { kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const s = au ? .4 : .27, f = au ? .27 : .4; // a scarecrow
    kBox(s, f, 0, .004, .004, .14, '#6b5040', M_PLANK); kBeam([s - .04, f, .1], [s + .04, f, .1], .003, '#6b5040', M_PLANK); kBox(s, f, .07, .018, .012, .045, ['#6a5a8a', '#8a4a3a', '#4a6a5a'][(B.id | 0) % 3], M_PLANK);
    kBlob(s, f, .13, .014, .015, '#d8b86a', M_THATCH); kCone(s, f, .14, .022, .025, '#3a3430', 8, 0); for (const dd of [-1, 1]) kBlob(s + dd * .043, f, .1, .006, .01, '#d8b86a', M_THATCH); }
  iSet(B); edge();
};
