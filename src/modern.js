/* ============================== the rest: shops, greens, the modern works and the monuments, modelled properly ============================== */
// Built from the kit (kit.js): the shops (a row of little shops, an arcade, a department store, offices), the plaza,
// the park, the botanic garden, the Maker dig, the radio mast, the weave relay, solar fields, the gene garden, the
// airfield, the stadium, the launchpad (the rocket stands at the middle: fx3d.js launches it), the fusion plant, the
// climate engine (its mist comes from fx3d.js), the garden dome, the space elevator and the monuments.
// Small parts only close up (KF.lod).

/* ---------- shops ---------- */
GL_MODEL.shops = function (B, st) {
  kSetB(B); const k = B.sub || 0, [wc, wm] = kWall(B, st), lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), acc = st.accent, rc = st.roof;
  if (k === 0) { // a row of little shops under one roof, each with its own front, sign and awning
    const s0 = -.42, s1 = .42, fB = -.3, fD = .3, H = .36; kPlinth(s0, s1, fB, fD, .03); kBox(0, 0, .03, .42, .3, H - .03, wc, wm);
    const cols = [acc, mix(acc, '#3f6b5f', .6), '#8a4a5a'];
    for (let n = 0; n < 3; n++) { const a = s0 + n * .28, b = a + .28; kShop(a + .01, b - .01, fD, .03, .15, cols[n], n); kSign(b - .03, fD, .3, cols[n]); kWin((a + b) / 2, fD, .23, .035, .08, 10 + n, { ty: wty, box: hk(B, 30 + n) < .4 }); if (n) kBox(a, fD + .006, .03, .008, .006, H - .03, shade(wc, .85), wm); }
    kWins(s0, s1, fB, .03, .16, 2, 3, { ty: wty, back: 1 }, null, 20); kGable(s0, s1, fB, fD, H, .18, rc, { wall: wc, wm });
    for (let n = 0; n < 3; n++) kChim(s0 + .14 + n * .28, -.02, H + .1, H + .26, .025, .035, ...hStack(wm, wc)); return;
  }
  if (k === 1) { // an arcade: a lane of arched shop windows under a glass roof
    const s0 = -.44, s1 = .44, fB = -.3, fD = .3, H = .5; kPlinth(s0, s1, fB, fD, .03); kBox(0, 0, .03, .44, .3, H - .03, wc, wm);
    for (let n = 0; n < 4; n++) { const s = -.33 + n * .22; kBox(s, fD + .003, .03, .07, .004, .19, K_DARK, 0, kLit(n)); kCtr(s, fD - .1, .2); for (let q = 0; q < 6; q++) { const a0 = q / 6 * Math.PI, a1 = (q + 1) / 6 * Math.PI; kT([s, fD + .004, .22], [s + Math.cos(a0) * .07, fD + .004, .22 + Math.sin(a0) * .07], [s + Math.cos(a1) * .07, fD + .004, .22 + Math.sin(a1) * .07], K_DARK, 0, kLit(n)); }
      if (lod) { for (let q = 0; q < 9; q++) { const a = q / 8 * Math.PI, m = [Math.cos(a), Math.sin(a)]; kOB(s + m[0] * .078, fD + .006, .22 + m[1] * .078, [-m[1] * .01, 0, m[0] * .01], [0, .006, 0], [m[0] * .009, 0, m[1] * .009], K_STONE, M_STONE); } kBox(s, fD + .006, .03, .07, .003, .004, K_TRIM); for (const d of [-.035, 0, .035]) kBox(s + d, fD + .006, .03, .002, .002, .19, K_TRIM); } }
    kBox(0, fD + .006, .03, .085, .004, .2, '#3a2a20'); kWins(s0, s1, fD, .33, .17, 1, 6, { ty: wty, ped: 1 }, null, 30); kBand(s0, s1, fD, .32);
    kCornice(s0, s1, fB, fD, H, K_STONE); kCtr(0, 0, H); const n = lod ? 8 : 2; for (let q = 0; q < n; q++) { const a = s0 + q / n * .88, b = s0 + (q + 1) / n * .88; for (const sg of [-1, 1]) kQ([a, 0, H + .14], [b, 0, H + .14], [b, sg * .31, H + .03], [a, sg * .31, H + .03], '#bfe3f0', 0, .5); }
    if (lod) for (let q = 0; q <= 8; q++) kBeam([s0 + q * .11, -.31, H + .03], [s0 + q * .11, 0, H + .14], .004, K_IRON), kBeam([s0 + q * .11, .31, H + .03], [s0 + q * .11, 0, H + .14], .004, K_IRON); return;
  }
  if (k === 2) { // a department store: big windows below, its name in lights, a canopy, a clock on the corner
    const s0 = -.42, s1 = .42, fB = -.38, fD = .38, H = 1; kPlinth(s0, s1, fB, fD, .03, '#a8a092'); kBox(0, 0, .03, .42, .38, H - .03, wc, wm);
    kWalls(s0, s1, fB, fD, (a, b, ff, q) => { kWins(a, b, ff, .03, .22, 1, 4, { ty: 'modern', hk: .78, yk: .1, hw: .07 }, null, q * 9); kWins(a, b, ff, .27, .21, 3, 4, { ty: wty, hk: .55 }, null, 40 + q * 9); }, 15);
    kAwn(0, fD, .25, .4, acc, .14, .05); kBox(0, fD + .008, .87, .3, .006, .066, acc, 0, 3); if (lod) kBox(0, fD + .014, .885, .26, .002, .034, '#fff4d8', 0, 3); // its name in lights
    kCornice(s0, s1, fB, fD, H, '#ece6da'); kFlat(s0, s1, fB, fD, H + .032, wc, .04, { wm }); kClock(s1 - .07, fD + .005, .78, .035); kBox(0, -.1, H + .07, .08, .08, .1, wc, wm); cFlag(0, -.1, H + .17, .12, acc); return;
  }
  // offices: glass floors on a stone base, a canopy, the cleaning cradle up top
  const s0 = -.4, s1 = .4, fB = -.36, fD = .36, H = 1.72; kPlinth(s0, s1, fB, fD, .03, '#9a9ea3'); kBox(0, 0, .03, .4, .36, .29, wc, M_STONE);
  kWins(s0, s1, fD, .03, .29, 1, 4, { ty: 'glass', hk: .8, yk: .08, hw: .08 }, k => k === 1, 0); kDoor(-.1, fD, .06, .18, '#3a3f45', { ty: 'glass', hood: 'canopy' });
  const sv = GLB.wall; GLB.wall = M_GLASS; glBox(0, 0, .36, .32, .32 / ZS, (H - .32) / ZS, st.glass); GLB.wall = sv;
  glWindows(0, 0, .36, .32, .32 / ZS, (H - .32) / ZS, Math.floor((H - .32) / ZS / 7), 4, st.glass);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(a * .35, b * .31, .32, .012, .012, H - .32, wc, M_STONE);
  kFlat(-.37, .37, -.33, .33, H, wc, .04); kBox(-.15, -.1, H, .1, .08, .08, '#9aa3ad'); if (lod) { for (const d of [-1, 1]) kBox(d * .3, 0, H + .04, .004, .3, .004, '#8a8f96'); kBox(.2, .1, H, .004, .004, .2, '#9aa3ad'); }
};

/* ---------- the plaza: paving, the village fire early on, later a fountain or a statue, lamps and benches ---------- */
GL_MODEL.plaza = function (B, st) {
  kSetB(B); const lod = KF.lod, pave = B.style >= 2 ? mix(st.wall, '#d8d0c4', .6) : '#cdb79a';
  kBox(0, 0, 0, .47, .47, .007, pave, B.style >= 2 ? M_COBBLE : M_EARTH);
  if (B.style < 2) { // the village fire: a ring of stones, embers glowing, logs, seats round it
    for (let k = 0; k < 9; k++) { const a = k / 9 * TAU; kBlob(Math.cos(a) * .1, Math.sin(a) * .1, .007, .025, .018, '#6d5a4c', M_STONE); }
    kBox(0, 0, .007, .06, .06, .012, '#e98b4a', 0, 3); for (const a of [.4, 2.5, 4.4]) kBeam([Math.cos(a) * .06, Math.sin(a) * .06, .02], [-Math.cos(a) * .02, -Math.sin(a) * .02, .07], .008, '#5a4030', M_BARK);
    for (let k = 0; k < 4; k++) { const a = k / 4 * TAU + .4; kLog([Math.cos(a) * .25 - Math.sin(a) * .07, Math.sin(a) * .25 + Math.cos(a) * .07, .02], [Math.cos(a) * .25 + Math.sin(a) * .07, Math.sin(a) * .25 - Math.cos(a) * .07, .02], .02, '#7a5a40', '#c9a77a'); }
    hSmoke(0, 0, .1); return;
  }
  if (lod) for (const r of [.2, .34]) kCyl(0, 0, .007, r, .003, shade(pave, .85), M_STONE, 24, 0);
  for (const [s, f] of [[-.42, .42], [.42, -.42], [.42, .42], [-.42, -.42]]) cLampPost(s, f, .22);
  kCyl(0, 0, .007, .2, .045, shade(pave, .9), M_STONE, 16, '#7fc7de'); if (lod) kCyl(0, 0, .052, .205, .01, shade(pave, .8), M_STONE, 16, 0);
  if (B.statue) { kBox(0, 0, .007, .05, .05, .16, '#d8d2c8', M_STONE); kBox(0, 0, .167, .06, .06, .012, '#e2dbcf', M_STONE); kBox(0, 0, .18, .022, .016, .1, '#b9a99a', M_STONE); kBox(0, 0, .28, .03, .02, .08, '#b9a99a', M_STONE); kBlob(0, 0, .38, .016, .02, '#b9a99a', M_STONE); kBeam([.025, 0, .34], [.06, 0, .43], .007, '#b9a99a', M_STONE); }
  else { kCyl(0, 0, .05, .06, .06, shade(pave, .95), M_STONE, 12, '#bfe7f2'); kCyl(0, 0, .11, .02, .04, shade(pave, .95), M_STONE, 8); if (lod) { kBox(0, 0, .15, .005, .005, .1, '#cfeff6'); for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; kBeam([0, 0, .2], [Math.cos(a) * .1, Math.sin(a) * .1, .07], .003, '#cfeff6'); } } } // a fountain and its jets
  if (lod) for (const [s, f, a] of [[0, -.36, 1], [0, .36, 1], [-.36, 0, 0], [.36, 0, 0]]) kBench(s, f, 0, a);
};

/* ---------- the park: lawns, gravel paths, a fountain, trees, benches, a bandstand later ---------- */
GL_MODEL.park = function (B, st) {
  kSetB(B); const lod = KF.lod, v = B.var || 0;
  kBox(0, 0, 0, .47, .47, .006, '#8fcf8a', M_GRASS);
  if (dsRound()) { kCyl(0, 0, .006, .34, .004, '#eadbc1', M_STONE, 24, 0); kCyl(0, 0, .006, .28, .005, '#8fcf8a', M_GRASS, 24); }
  else { kPath(-.47, -.04, .47, .04, '#eadbc1'); kPath(-.04, -.47, .04, .47, '#eadbc1'); }
  kCyl(0, 0, .006, .1, .03, '#d8d2c8', M_STONE, 14, '#7fc7de'); if (lod) kBox(0, 0, .036, .004, .004, .07, '#bfe7f2');
  const tc = ['#5f9a4d', '#6aa556', '#ee9fbe', '#7fae5e'];
  for (const [s, f, k] of [[-.26, -.26, 0], [.26, -.24, 1], [-.25, .26, 2], [.27, .26, 3]]) kTree(s, f, 0, (v + k * .3) % 1, 1.05, tc[(k + ((v * 4) | 0)) % 4]);
  if (lod) { for (const [s, f, a] of [[-.12, .14, 1], [.14, -.12, 0], [.14, .14, 1]]) kBench(s, f, 0, a); for (const [s, f] of [[-.38, .1], [.1, -.38], [.38, -.1], [-.1, .38]]) { kBlob(s, f, 0, .05, .035, leafC('#4f8a45')); kFlowers(s + .04, f + .04, 0, s + f); } }
  if (hasTech('electric') && lod) { kBox(-.4, -.4, 0, .005, .005, .2, K_IRON); kBox(-.4, -.4, .2, .014, .014, .025, '#ffe2a0', 0, 2); }
};

/* ---------- the botanic garden: beds of flowers, a palm house of iron and glass with trees inside ---------- */
GL_MODEL.botanic = function (B, st) {
  kSetB(B); const lod = KF.lod, v = B.var || 0;
  kBox(0, 0, 0, .46, .46, .006, '#9ed49a', M_GRASS);
  for (const [s, f] of [[-.34, .34], [.34, .34], [-.34, -.34]]) { kBox(s, f, 0, .08, .08, .012, '#8a6446', M_SOIL); if (lod) for (let q = 0; q < 4; q++) kFlowers(s - .04 + (q % 2) * .08, f - .04 + (q >> 1) * .08, .01, hash2(B.id | 0, q, 17)); else kBox(s, f, .012, .07, .07, .01, '#f28bb5'); }
  kPath(-.05, .1, .05, .47, '#e2d6c0');
  kBox(0, -.04, 0, .3, .2, .03, '#d8d2c8', M_STONE); kTree(-.12, -.06, .03, v + .2, .5, '#4f8a45'); kTree(.12, 0, .03, v + .7, .45, '#5f9a4d');
  const R = .2, L = .26, n = 8; kCtr(0, -.04, .05); for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI, P = (s, a) => [s, -.04 + Math.cos(a) * R, .03 + Math.sin(a) * R * 1.3]; kQ(P(-L, a0), P(L, a0), P(L, a1), P(-L, a1), '#cfe9f2', 0, .5); } // the palm house: a glass vault
  for (const s of [-L, L]) kDome(s, -.04, .03, R, R * 1.3, '#cfe9f2', 0, .5);
  if (lod) { for (let k = -4; k <= 4; k++) for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI, s = k * L / 4; kBeam([s, -.04 + Math.cos(a0) * R, .03 + Math.sin(a0) * R * 1.3], [s, -.04 + Math.cos(a1) * R, .03 + Math.sin(a1) * R * 1.3], .003, '#f2f6f8'); }
    kBox(0, -.04 + R, .03, .04, .01, .11, '#f2f6f8'); kBench(.3, .2, 0, 0); }
};

/* ---------- the Maker dig: trenches in a grid of strings, the scholars' tent, a sieve, finds laid out on a table ---------- */
GL_MODEL.digsite = function (B, st) {
  kSetB(B); const lod = KF.lod;
  kBox(0, 0, 0, .44, .44, .005, '#c9a980', M_EARTH);
  for (const [s, f] of [[-.2, -.1], [.12, -.18], [-.05, .18], [.22, .14]]) { const p = kTL(s, f); glPit(p[0], p[1], .09, .09, 2.5, '#bf9d74', '#a9855f', '#b89266', 1); }
  if (lod) { for (const s of [-.35, -.05, .25]) kBeam([s, -.4, .02], [s, .4, .02], .0015, '#f0ebe1'); for (const f of [-.35, -.05, .25]) kBeam([-.4, f, .02], [.4, f, .02], .0015, '#f0ebe1'); for (const [s, f] of [[-.35, -.35], [.25, -.35], [-.35, .25], [.25, .25]]) kBox(s, f, 0, .004, .004, .03, '#6b5040', M_PLANK); }
  kCtr(-.3, -.32, -.1); kQ([-.42, -.4, 0], [-.18, -.4, 0], [-.18, -.32, .17], [-.42, -.32, .17], '#e9e2d0'); kQ([-.42, -.24, 0], [-.18, -.24, 0], [-.18, -.32, .17], [-.42, -.32, .17], '#d6ceb8'); kT([-.42, -.4, 0], [-.42, -.24, 0], [-.42, -.32, .17], '#cfc6ae'); // the tent
  kBeam([-.44, -.32, .175], [-.16, -.32, .175], .004, '#6b5040', M_PLANK);
  kCyl(.32, .3, .05, .05, .015, '#8a6446', M_PLANK, 10, '#c9b48a'); for (const [a, b] of [[-.04, 0], [.03, .03], [.02, -.04]]) kBeam([.32 + a, .3 + b, 0], [.32 + a * .5, .3 + b * .5, .055], .003, '#6b5040', M_PLANK);
  if (lod) { kBox(-.05, -.36, 0, .07, .035, .06, '#8a6446', M_PLANK); for (let q = 0; q < 4; q++) kBox(-.1 + q * .033, -.36, .06, .01, .012, .008, ['#5fd0c9', '#c9a447', '#9aa3ad', '#7fe8e0'][q], 0, q % 2 ? 0 : 3); kBlob(.4, -.1, 0, .05, .03, '#b89266', M_EARTH); kBarrel(.36, -.36, 0, .02, .04, '#7a6a5e'); } // finds on the table (a few still glow), spoil
};

/* ---------- the radio mast: a lattice on three legs, red and white, a hut at its foot, a light on top ---------- */
GL_MODEL.mast = function (B, st) {
  kSetB(B); const lod = KF.lod, L = [[-.18, .12], [.18, .12], [0, -.2]], T = 3;
  for (const [s, f] of L) { kBeam([s, f, 0], [0, 0, T], .008, '#c0584f'); kBox(s, f, 0, .02, .02, .02, '#a8a092', M_STONE); }
  for (let k = 1; k < 9; k++) { const t = k / 9, p = L.map(([s, f]) => [s * (1 - t), f * (1 - t)]), y = T * t, col = k % 2 ? '#c0584f' : '#f3efe9';
    for (let q = 0; q < 3; q++) { const a = p[q], b = p[(q + 1) % 3]; kBeam([a[0], a[1], y], [b[0], b[1], y], .004, col); if (lod && k < 8) { const tn = (k + 1) / 9, c = L[(q + 1) % 3]; kBeam([a[0], a[1], y], [c[0] * (1 - tn), c[1] * (1 - tn), T * tn], .002, col); } } }
  kBox(0, 0, T, .012, .012, .02, '#ff4d4d', 0, 3); if (lod) for (const y of [T * .35, T * .7]) for (const [s, f] of L) kBox(s * (1 - y / T), f * (1 - y / T), y, .006, .006, .006, '#ff4d4d', 0, 3);
  kBox(.25, .2, 0, .1, .08, .1, st.wall); kFlat(.15, .35, .12, .28, .1, st.wall, .01); kDoor(.2, .28, .025, .08, '#5a5f66', { ty: 'plank' }); if (lod) for (let q = 0; q < 3; q++) kBeam([.25, .2, .1], [q * .05 - .05, -.01, .3 + q * .1], .0012, '#2a2a2a');
};

/* ---------- the weave relay: an equipment house, a mast, dishes and a light ---------- */
GL_MODEL.antenna = function (B, st) {
  kSetB(B); const lod = KF.lod, T = 46 * ZS;
  kBox(0, 0, 0, .2, .2, .36, st.wall, M_PLASTER); kFlat(-.2, .2, -.2, .2, .36, st.wall, .02); kDoor(0, .2, .035, .13, '#5a5f66', { ty: 'glass' }); if (lod) for (let q = 0; q < 3; q++) kBox(.25, -.1 + q * .1, 0, .04, .04, .08, '#9aa3ad');
  kCyl(0, 0, .36, .02, T - .36, '#b9c0c9', 0, 8); for (let k = 1; k < 4; k++) kCyl(0, 0, .36 + k * (T - .36) / 4, .03, .015, '#9aa3ad', 0, 8);
  dish(.04, 0, 42, .14, [.8, .5, .3], '#e9edf2'); dish(-.03, .02, 32, .1, [-.6, .3, .7], '#e9edf2'); if (lod) dish(0, -.04, 24, .08, [.2, .4, -.9], '#e9edf2');
  kBox(0, 0, T, .01, .01, .02, '#ff4d4d', 0, 3);
};

/* ---------- a solar field: rows of panels on frames, a gravel bed, an inverter cabinet ---------- */
GL_MODEL.solar = function (B, st) {
  kSetB(B); const lod = KF.lod;
  kBox(0, 0, 0, .46, .46, .005, '#c7c3b5', M_TAR);
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { const s = -.3 + a * .3, f = -.3 + b * .3; kSolar(s, f, .05, .13, .1, .35); if (lod) for (const d of [-.1, .1]) { kBox(s + d, f - .08, 0, .004, .004, .05, '#8c9199'); kBox(s + d, f + .08, 0, .004, .004, .085, '#8c9199'); } }
  if (lod) { kBox(.42, .42, 0, .03, .02, .06, '#d6dade'); kFence([[-.47, -.47], [.47, -.47], [.47, .47], [-.47, .47], [-.47, -.47]], .05, '#9aa3ad', 'rail'); }
};

/* ---------- the gene garden: a glass tower of growing floors, lit pink at night, a glasshouse dome on top ---------- */
GL_MODEL.vfarm = function (B, st) {
  kSetB(B); const lod = KF.lod, H = 30 * ZS, hw = .34;
  kBox(0, 0, 0, hw, hw, .03, '#cfd3d6', M_STONE);
  for (let k = 0; k < 5; k++) { const y = .03 + k * (H - .03) / 5, fh = (H - .03) / 5;
    kBox(0, 0, y, hw - .02, hw - .02, fh - .014, '#2f3a44', 0, .02); // inside, dark; the growing light shows at night
    kBox(0, 0, y + fh - .014, hw + .004, hw + .004, .014, '#e8ecef', M_STONE); kBox(0, 0, y + fh - .03, hw - .005, hw - .005, .016, '#6fbf73', M_LEAF); // a floor of greens behind the glass
    kBox(0, 0, y + .02, hw - .03, hw - .03, .012, '#ff7ad9', 0, 3);
    if (lod) for (const d of [-1, 1]) for (const e of [-1, 1]) kBox(d * (hw - .005), e * (hw - .005), y, .006, .006, fh, '#9aa3ad');
    if (lod) kWalls(-hw, hw, -hw, hw, (a, b, ff) => { for (let q = 1; q < 5; q++) kBox(a + q * (b - a) / 5, ff, y, .003, .003, fh - .014, '#9aa3ad'); }); }
  domeFrame(0, 0, .3, 30, 9, '#bfe8c4'); kTree(0, 0, H, .1, .9, '#6aa556'); kDoor(0, hw, .05, .12, '#3a3f45', { ty: 'glass', hood: 'canopy' });
};

/* ---------- the airfield: a runway with its markings and lights, a hangar, a control tower, a windsock ---------- */
GL_MODEL.airfield = function (B, st) {
  kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod; // (the planes taxi along x: air.js)
  kBox(0, 0, 0, .48, .48, .004, '#b8b9bb', M_ASPHALT); kBox(0, .08, .004, .48, .13, .003, '#707378', M_ASPHALT);
  for (let k = 0; k < 4; k++) kBox(-.36 + k * .24, .08, .007, .06, .012, .001, '#f5f5f0');
  if (lod) for (const f of [-.04, .2]) kBox(0, f, .007, .48, .004, .001, '#f5f5f0');
  for (let k = 0; k < 6; k++) for (const f of [-.04, .2]) kBox(-.44 + k * .176, f, .008, .006, .006, .006, k % 5 ? '#bfe0ff' : '#9dff9d', 0, 3); // runway lights
  const tw = mix(st.wall, '#e8ecef', .3); kBox(.3, -.3, 0, .06, .06, .5, tw, M_PLASTER); kBox(.3, -.3, .5, .085, .085, .12, '#33475a', 0, kLit(3)); kFlat(.215, .385, -.385, -.215, .62, tw, .015); if (lod) { kBox(.3, -.3, .64, .004, .004, .08, '#9aa3ad'); kBox(.3, -.3, .72, .01, .01, .01, '#bfe8ff', 0, 3); } // the tower
  const hs = -.26, hf = -.28; kBox(hs, hf, 0, .16, .12, .14, shade(st.roof, 1.1), M_PLASTER); const R = .12, n = 6; kCtr(hs, hf, .1);
  for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI, P = (s, a) => [s, hf + Math.cos(a) * R, .14 + Math.sin(a) * R * .6]; kQ(P(hs - .17, a0), P(hs + .17, a0), P(hs + .17, a1), P(hs - .17, a1), shade(st.roof, .9), M_SLATE); } // the hangar's curved roof
  kBox(hs + .16, hf, 0, .004, .1, .13, '#4a4f56'); if (lod) for (let q = 0; q < 6; q++) kBox(hs + .164, hf - .08 + q * .032, 0, .002, .002, .13, '#3a3d42');
  if (lod) { kBox(.42, .38, 0, .003, .003, .14, '#9aa3ad'); kCone(.44, .38, .14, .012, .05, '#ff7a2a', 6, 0); kBox(-.4, .38, 0, .03, .02, .04, '#e0a43a'); kCrate(-.33, .4, 0, .02); }
};

/* ---------- the stadium (one tile, and spread over its 2×2 lot: GL_BIG) ---------- */
function mStands(R0, R1, Rz0, Rz1, y1, n, roof) { // a bowl of three tiers, a wall round it, and (later) a roof over the main stand
  const seats = [hasTech('motor') ? '#5b8fc4' : '#b3aa9b', hasTech('motor') ? '#dd7466' : '#c4bcae', '#ece7dc'], P = (t, rx, rz, y) => [Math.cos(t) * rx, Math.sin(t) * rz, y];
  for (let tier = 0; tier < 3; tier++) { const f0 = tier / 3, f1 = (tier + 1) / 3, rx0 = R0 + (R1 - R0) * f0, rx1 = R0 + (R1 - R0) * f1, rz0 = Rz0 + (Rz1 - Rz0) * f0, rz1 = Rz0 + (Rz1 - Rz0) * f1, y0 = .02 + y1 * f0, ya = .02 + y1 * f1;
    for (let k = 0; k < n; k++) { const t0 = k / n * TAU, t1 = (k + 1) / n * TAU; kCtr(0, 0, ya + 2); kQ(P(t0, rx0, rz0, y0), P(t1, rx0, rz0, y0), P(t1, rx1, rz1, ya), P(t0, rx1, rz1, ya), seats[tier], M_STONE); kCtr(0, 0, -2); kQ(P(t0, rx0, rz0, y0), P(t1, rx0, rz0, y0), P(t1, rx0, rz0, y0 - (ya - y0) * .4), P(t0, rx0, rz0, y0 - (ya - y0) * .4), '#b0a898', M_STONE);
      if (KF.lod) for (let r = 1; r < 3; r++) { const fr = r / 3, xr = rx0 + (rx1 - rx0) * fr, zr = rz0 + (rz1 - rz0) * fr, yr = y0 + (ya - y0) * fr; kBeam(P(t0, xr, zr, yr + .002), P(t1, xr, zr, yr + .002), .0015, shade(seats[tier], .8)); } } }
  for (let k = 0; k < n; k++) { const t0 = k / n * TAU, t1 = (k + 1) / n * TAU; kCtr(0, 0, 0); kQ(P(t0, R1, Rz1, 0), P(t1, R1, Rz1, 0), P(t1, R1, Rz1, y1 + .04), P(t0, R1, Rz1, y1 + .04), '#b0a898', M_STONE);
    if (KF.lod && k % 2) kBox(Math.cos(t0 + .1) * (R1 + .003), Math.sin(t0 + .1) * (Rz1 + .003), .05, .01, .01, y1 * .6, '#9a9286', M_STONE); }
  if (roof) for (let k = 0; k < n; k++) { const t0 = k / n * TAU, t1 = (k + 1) / n * TAU; if (Math.sin(t0) < .2) continue; kCtr(0, 0, y1 - 1); kQ(P(t0, R1, Rz1, y1 + .04), P(t1, R1, Rz1, y1 + .04), P(t1, R1 * .78, Rz1 * .78, y1 + .1), P(t0, R1 * .78, Rz1 * .78, y1 + .1), '#e8ecf0'); }
}
function mPitch(hx, hz) { for (let k = 0; k < 6; k++) kBox(-hx + (k + .5) * hx / 3, 0, 0, hx / 6, hz, .012, k % 2 ? '#5f9a4d' : '#6aa556', M_GRASS);
  if (KF.lod) { kBox(0, 0, .012, .003, hz, .001, '#f4f4f0'); kCyl(0, 0, .012, hz * .3, .001, '#f4f4f0', 0, 16, 0); for (const sg of [-1, 1]) { kBox(sg * hx, 0, .012, .003, hz, .001, '#f4f4f0'); kBox(sg * (hx - .002), 0, .012, .004, hz * .14, .05, '#f4f4f0'); } } }
function mFloods(d, h) { if (!hasTech('electric')) return; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { kBox(a * d, b * d, 0, .012, .012, h, '#8c9199'); kBox(a * d, b * d, h, .045, .015, .04, '#f2f4f7', 0, 2); } }
GL_MODEL.stadium = function (B, st) { kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); mPitch(.24, .15); mStands(.3, .46, .22, .46, .2, 20, hasTech('concrete')); mFloods(.44, .5); };
GL_BIG.stadium = function (B, st) { // sized to its lot: a pitch, a bowl of stands, floodlights; on its 4×4 lot gates, a scoreboard, flags round the rim
  const [lx, lz] = glLot(B), n = fpW(B), sc = n / 2, lod = KF.lod; kSet(lx, lz, [1, 0, 0], [0, 0, 1], B.id);
  const R1 = n / 2 - (n > 2 ? .16 : .05), Rz1 = R1 * (n > 2 ? .82 : 1), y1 = .4 * (1 + (sc - 1) * .55);
  if (n > 2) kBox(0, 0, 0, n / 2 - .02, n / 2 - .02, .008, '#bdb7ab', M_STONE); // the concourse round it
  mPitch(R1 * .53, Rz1 * .36); mStands(R1 * .62, R1, Rz1 * .5, Rz1, y1, n > 2 ? 44 : 28, hasTech('concrete')); mFloods(R1 * .86, 1.36 * (n > 2 ? 1.25 : 1));
  if (lod) for (const sg of [-1, 1]) kBox(sg * R1 * .53, 0, 0, .006, .06, .06, '#f4f4f0'); // the goals
  if (n <= 2) return;
  const acc = (st || {}).accent || '#c8553d';
  for (const sg of [-1, 1]) { const s = sg * (R1 + .02); kBox(s, 0, 0, .06, .16, y1 + .14, '#c9c2b6', M_STONE); kBox(s + sg * .061, 0, .02, .002, .07, .16, '#2a2c30'); kBox(s, 0, y1 + .14, .07, .17, .02, acc); // the gates, end on
    for (const t of [-.24, .24]) { kBox(s + sg * .14, t, 0, .03, .03, .07, '#e8e4dc'); kBox(s + sg * .14, t, .07, .036, .036, .01, acc); } } // ticket booths
  kBox(0, -Rz1 - .03, y1 + .04, .3, .02, .16, '#2a2c30'); kBox(0, -Rz1 - .02, y1 + .07, .27, .002, .11, '#3a4250', hasTech('computing') ? .9 : .4); // the scoreboard over the north stand
  for (let k = 0; k < 12; k++) { const t = k / 12 * TAU, x = Math.cos(t) * R1, z = Math.sin(t) * Rz1; kBox(x, z, y1 + .04, .004, .004, .16, '#8c9199'); if (lod || k % 3 === 0) kBox(x + .025, z, y1 + .16, .024, .002, .016, k % 2 ? acc : '#f2f2ee'); } // flags round the rim
  if (lod) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kLantern(a * (n / 2 - .1), b * (n / 2 - .1), .2);
};

/* ---------- the launchpad: the scorched pad, a flame trench, the gantry and its arms, the rocket waiting (fx3d.js) ---------- */
GL_MODEL.launchpad = function (B, st) {
  kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod, red = '#c8553d', T = 62 * ZS;
  kBox(0, 0, 0, .47, .47, .012, '#bfbdb8', M_STONE); kCyl(0, 0, .012, .24, .004, '#7a756f', M_TAR, 20); kBox(0, .32, 0, .08, .14, .006, '#3a3634');
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(.22 + a * .04, -.22 + b * .04, 0, .008, .008, T, red);
  for (let k = 1; k < 10; k++) { const y = k * T / 10; for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) kBeam([.22 + p[0] * .04, -.22 + p[1] * .04, y], [.22 + q[0] * .04, -.22 + q[1] * .04, y], .003, red);
    if (lod) kBeam([.18, -.26, y], [.26, -.18, y + T / 10], .002, red); }
  for (let k = 2; k < 10; k += 3) kBeam([.18, -.18, k * T / 10], [.07, -.06, k * T / 10], .006, red); // arms reaching to the rocket
  if (B.rk !== 0) { kCyl(0, 0, .04, .08, 46 * ZS, '#f4f4f2', 0, 14); kCone(0, 0, .04 + 46 * ZS, .08, 9 * ZS, st.accent, 14, 0); kBox(0, .078, 24 * ZS, .02, .006, 6 * ZS, '#333');
    for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + .4; kOB(Math.cos(a) * .09, Math.sin(a) * .09, .1, [Math.cos(a) * .03, Math.sin(a) * .03, 0], [-Math.sin(a) * .003, Math.cos(a) * .003, 0], [0, 0, .06], st.accent); } // its fins
    if (lod) for (const y of [12, 30]) kCyl(0, 0, y * ZS, .082, .01, '#333', 0, 14, 0); }
  kBox(.22, -.22, T, .014, .014, .02, '#ff4d4d', 0, 3);
  if (lod) { kBox(-.36, .36, 0, .06, .05, .1, '#e8ecef'); kCyl(-.36, -.34, 0, .06, .16, '#f2f2f2', 0, 12); kCyl(-.22, -.38, 0, .045, .12, '#f2f2f2', 0, 12); } // the blockhouse, fuel tanks
};

/* ---------- the fusion plant (one tile, and on its 2×2 lot: GL_BIG): containment domes, a glowing ring, a cooling tower ---------- */
GL_MODEL.fusion = function (B, st) {
  kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod;
  kBox(0, 0, 0, .42, .42, .27, st.wall, M_PLASTER); kWalls(-.42, .42, -.42, .42, (a, b, ff, k) => kWins(a, b, ff, 0, .27, 1, 5, { ty: 'glass', hk: .4, hw: .04 }, null, k * 7));
  kDome(0, 0, .27, .34, .9, shade(st.wall, 1.02), M_PLASTER); kCyl(0, 0, .52, .372, .03, st.accent, 0, 24, 0, 3); if (lod) for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; kBox(Math.cos(a) * .345, Math.sin(a) * .345, .27, .008, .008, .25, '#c9ced4'); }
};
GL_BIG.fusion = function (B, st) { // sized to its lot (2×2, then 3×3: a third dome, a second cooling tower)
  const [lx, lz] = glLot(B); kSet(lx, lz, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod, w = '#e8edf2', n = fpW(B), k3 = n / 2, hk = 1 + (k3 - 1) * .5;
  kBox(0, 0, 0, n / 2 - .1, n / 2 - .1, .02, '#c4c9cf', M_STONE);
  const domes = n > 2 ? [[-.62, -.3], [0, -.48], [.62, -.3]] : [[-.42, -.15], [.42, -.15]];
  for (const [s, f] of domes) { const r = .3 * (n > 2 ? 1.15 : 1); kCyl(s, f, .02, r, .36 * hk, w, M_PLASTER, 20, 0); kDome(s, f, .02 + .36 * hk, r, .5 * hk, '#eef2f6', M_PLASTER); kCyl(s, f, .3 * hk, r + .005, .025, st.accent, 0, 20, 0, 3);
    if (lod) for (let q = 0; q < 10; q++) { const a = q / 10 * TAU; kBox(s + Math.cos(a) * (r + .002), f + Math.sin(a) * (r + .002), .02, .008, .008, .28 * hk, '#c9ced4'); } kDoor(s, f + r, .05, .12, '#5a5f66', { ty: 'glass' }); }
  kBox(0, domes[0][1], .02, Math.abs(domes[domes.length - 1][0]) - .2, .06, .2, w, M_PLASTER); // the hall joining them
  const ry = n > 2 ? .55 : .5, rr = .26 * (n > 2 ? 1.25 : 1);
  kCyl(0, ry, .02, rr, .12, '#9aa3ad', M_PLASTER, 20, 0); kCyl(0, ry, .02, rr - .02, .02, '#7fe8e0', 0, 20, '#7fe8e0', 3); kCyl(0, ry, .14, rr + .01, .02, '#c9ced4', 0, 20, 0); // the ring, glowing
  for (const cx of n > 2 ? [-.95, .95] : [-.6]) { kCone(cx, ry + .1, .02, .2 * hk, .55 * hk, '#d6dade', 16, M_PLASTER, .14 * hk); if (lod) kCyl(cx, ry + .1, .02 + .55 * hk, .142 * hk, .02, '#bfc4c8', 0, 16, 0); } // cooling towers
  if (lod) { const sx = n > 2 ? -.3 : .45; for (let k = 0; k < 4; k++) { kBox(sx + k * .12, ry + .5 * (n > 2 ? 1.6 : 1) - .45, .02, .004, .004, .3, '#8c939b'); } }
};

/* ---------- the climate engine: a tall ribbed stack ringed with teal light, a misting crown (fx3d.js) ---------- */
GL_MODEL.terraformer = function (B, st) {
  kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod, H = 58 * ZS;
  kCyl(0, 0, 0, .3, .05, '#c4c9cf', M_STONE, 16); for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + .4; kBeam([Math.cos(a) * .32, Math.sin(a) * .32, 0], [Math.cos(a) * .15, Math.sin(a) * .15, .6], .025, st.wall, M_PLASTER); } // buttresses
  kCone(0, 0, .05, .17, H - .05, st.wall, 16, M_PLASTER, .13);
  for (let k = 1; k < 6; k++) kCyl(0, 0, k * 10 * ZS, .17 - k * .007, .03, '#9ff0ea', 0, 16, 0, 3);
  if (lod) for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; kBeam([Math.cos(a) * .165, Math.sin(a) * .165, .06], [Math.cos(a) * .132, Math.sin(a) * .132, H], .006, shade(st.wall, .9)); } // ribs
  kCone(0, 0, H, .16, .1, shade(st.wall, 1.02), 16, M_PLASTER, .25); kCyl(0, 0, H + .1, .25, .35, shade(st.wall, 1.02), M_PLASTER, 16, shade(st.accent, 1.1));
  if (lod) for (let q = 0; q < 16; q++) { const a = q / 16 * TAU; kBox(Math.cos(a) * .252, Math.sin(a) * .252, H + .15, .012, .012, .25, '#3a4048'); } // vents in the crown
  kCyl(0, 0, H + .44, .2, .02, '#9ff0ea', 0, 16, 0, 3);
};

/* ---------- the garden dome: green inside a lattice of glass ---------- */
GL_MODEL.dome = function (B, st) {
  kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod, v = B.var || 0;
  kCyl(0, 0, 0, .42, .09, st.wall, M_PLASTER, 20, '#9fd9a4'); kDoor(0, .418, .045, .07, '#3a3f45', { ty: 'glass' });
  kTree(-.12, -.1, .09, v, 1, '#5f9a4d'); kTree(.12, .06, .09, v + .5, .9, '#6aa556'); if (lod) { kTree(.0, -.25, .09, v + .2, .7, '#ee9fbe'); for (let q = 0; q < 6; q++) kFlowers(Math.cos(q) * .3, Math.sin(q) * .3, .09, q / 6); kCyl(.2, .18, .09, .06, .01, '#7fc7de', 0, 10, '#7fc7de', -1); }
  domeFrame(0, 0, .42, 2, 22, mix(st.glass, '#ffffff', .4), 10);
};

/* ---------- the space elevator's anchor: a stepped base, a tower narrowing up, a glowing tether going on up ---------- */
GL_MODEL.elevator = function (B, st) {
  kSet(GLB.x, GLB.y, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod, w1 = shade(st.wall, 1.03), w2 = shade(st.wall, 1.06);
  kBox(0, 0, 0, .46, .46, .45, st.wall, M_PLASTER); kWalls(-.46, .46, -.46, .46, (a, b, ff, k) => kWins(a, b, ff, 0, .45, 1, 5, { ty: 'glass', hk: .6 }, null, k * 7)); kFlat(-.46, .46, -.46, .46, .45, st.wall, .02);
  kBox(0, 0, .45, .3, .3, 1, w1, M_PLASTER); kWalls(-.3, .3, -.3, .3, (a, b, ff, k) => kWins(a, b, ff, .45, .33, 3, 3, { ty: 'glass' }, null, 40 + k * 7));
  kBox(0, 0, 1.45, .14, .14, 1.82, w2, M_PLASTER); kBox(0, 0, 3.27, .16, .16, .14, st.accent); kBox(0, 0, 3.41, .03, .03, .02, '#bff3ff', 0, 3);
  for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(a * .131, b * .131, 1.45, .011, .011, 1.82, '#bff3ff', 0, 2); // light running up its corners
  kBox(0, 0, 3.43, .008, .008, 3, '#bff3ff', 0, 3); // the tether, going on up out of sight
  if (lod) { for (let q = 0; q < 3; q++) kBox(.47, -.3 + q * .3, 0, .006, .06, .3, '#9aa3ad'); for (const [s, f] of [[-.4, .5], [.4, .5]]) cLampPost(s, f, .2); }
};

/* ---------- monuments ---------- */
GL_MODEL.monument = function (B, st) {
  kSetB(B); const k = B.sub || 'obelisk', ac = st.accent, lod = KF.lod, base = '#d9d1c4';
  kBox(0, 0, 0, .44, .44, .05, base, M_STONE); kBox(0, 0, .05, .4, .4, .04, shade(base, 1.04), M_STONE); const y0 = .09;
  if (lod) for (const [s, f] of [[-.4, .4], [.4, .4], [.4, -.4], [-.4, -.4]]) kBox(s, f, y0, .03, .03, .06, shade(base, .95), M_STONE);
  const fig = (y, s, col, up) => { kBox(0, 0, y, .03 * s, .025 * s, .23 * s, col, M_STONE); kBox(0, 0, y + .23 * s, .042 * s, .032 * s, .23 * s, shade(col, 1.05), M_STONE); kBlob(0, 0, y + .52 * s, .022 * s, .03 * s, col, M_STONE); kBox(0, -.035 * s, y + .23 * s, .04 * s, .006 * s, .24 * s, shade(col, .95), M_STONE); // legs, a robe, the head, a cloak
    kBeam([.04 * s, 0, y + .42 * s], up ? [.08 * s, 0, y + .7 * s] : [.05 * s, .02 * s, y + .26 * s], .009 * s, col, M_STONE); kBeam([-.04 * s, 0, y + .42 * s], [-.05 * s, .02 * s, y + .26 * s], .009 * s, col, M_STONE); };
  switch (k) {
    case 'statue': { kBox(0, 0, y0, .14, .14, .4, '#e2dbcf', M_STONE); kCornice(-.14, .14, -.14, .14, y0 + .4, '#e8e2d6', { br: 0, h: .025 }); if (lod) kBox(0, .142, y0 + .15, .08, .003, .06, '#c9a447'); fig(y0 + .43, 1.6, '#c9b8a6', true); kBox(.13, 0, y0 + .43 + 1.12, .016, .016, .03, '#e5874f', 0, 3); return; } // the founder, a torch held high
    case 'lantern': { kBox(0, 0, y0, .17, .17, 2.2, shade(st.wall, 1.02), M_STONE); kWalls(-.17, .17, -.17, .17, (a, b, ff, q) => kWins(a, b, ff, y0 + .1, .32, 6, 1, { ty: 'sash', arch: 'round', hw: .04 }, null, q * 9));
      kCornice(-.17, .17, -.17, .17, y0 + 2.2, '#ece6da', { br: 0 }); kBox(0, 0, y0 + 2.23, .21, .21, .18, '#ffe39a', 0, 2); if (lod) for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(a * .2, b * .2, y0 + 2.23, .012, .012, .18, '#3a3f4a');
      kHip(-.23, .23, -.23, .23, y0 + 2.41, .45, st.roof, { ov: .01, noGut: 1, fin: 1 }); return; }
    case 'spire': { kHip(-.3, .3, -.3, .3, y0 + .13, 3.2, shade(st.wall, 1.02), { ov: 0, noGut: 1, mat: M_STONE, bare: 1 }); kBox(0, 0, y0, .31, .31, .13, ac, M_STONE); if (lod) kWalls(-.31, .31, -.31, .31, (a, b, ff) => kDoor(0, ff, .05, .1, '#3a2a20', { ty: 'panel' })); kBlob(0, 0, y0 + 3.36, .025, .025, '#c9a447', 0); return; }
    case 'harp': { const P = t => [-.3 + t * .6, .1 - t * .2, y0 + Math.sin(t * Math.PI) * 3.5 * (1 - t * .4)]; for (let q = 0; q < 16; q++) kBeam(P(q / 16), P((q + 1) / 16), .022, ac); kBeam([-.3, .1, y0], [.3, -.1, y0], .02, ac);
      for (let q = 1; q < (lod ? 14 : 8); q++) { const t = q / (lod ? 14.5 : 8.5), p = P(t); kBeam([p[0], p[1], y0], [p[0], p[1], p[2] - .08], .0025, '#f4f0e6'); } return; }
    case 'gardens': { for (let t = 0; t < 4; t++) { const w = .42 - t * .09, y = y0 + t * .4; kBox(0, 0, y, w, w, .36, st.wall, M_STONE); kBox(0, 0, y + .36, w + .01, w + .01, .05, '#72c27a', M_GRASS); if (lod) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { kBox(a * (w + .012), b * (w + .012), y + .1, a ? .006 : w * .9, b ? .006 : w * .9, .26, leafC('#4f8a45'), M_LEAF); } } kTree(0, 0, y0 + 1.65, .2, 1.1, '#5f9a4d'); return; } // hanging gardens, terrace on terrace
    case 'colossus': { for (const [a, b] of [[-.2, -.15], [.2, -.15], [-.2, .15], [.2, .15]]) kBeam([a, b, y0], [a * .5, b * .5, .8], .03, '#b7a58f', M_STONE); kBlob(0, 0, .97, .3, .3, '#c7b59f', M_STONE); kBlob(-.05, 0, 1.12, .2, .13, '#8fbf88'); kBeam([.15, 0, .97], [.4, 0, 1.33], .04, '#c7b59f', M_STONE); kBlob(.42, 0, 1.37, .07, .11, '#c7b59f', M_STONE); return; } // a great Longstrider in stone
    case 'hall': { kBox(0, 0, y0, .42, .34, .8, shade(st.wall, 1.05), M_STONE); kCols(-.36, .36, 5, .37, y0, .75, .028); kBox(0, .35, y0 + .75, .44, .045, .06, '#ece6da', M_STONE); kPed(-.44, .44, .37, y0 + .81, .26, '#ece6da'); kGable(-.44, .44, -.36, .36, y0 + .81, .3, st.roof, { wall: st.wall, wm: M_STONE }); kDoor(0, .34, .06, .3, '#3a2a20', { ty: 'panel', y: y0 }); return; }
    case 'clock': { kBox(0, 0, y0, .18, .18, 2.2, st.wall, M_STONE); kWalls(-.18, .18, -.18, .18, (a, b, ff, q) => { kClock(0, ff + Math.sign(ff) * .003, y0 + 1.86, .1); kWins(a, b, ff, y0 + .2, .4, 3, 1, { ty: 'sash', arch: 'round', hw: .03 }, null, q * 5); });
      kCornice(-.18, .18, -.18, .18, y0 + 2.2, '#ece6da', { br: 0 }); kHip(-.2, .2, -.2, .2, y0 + 2.23, .62, st.roof, { ov: .01, noGut: 1, fin: 1 }); return; }
    case 'orchard': { for (let q = 0; q < 3; q++) { const s = -.3 + q * .3; for (let j = 0; j < 10; j++) { const a0 = j / 10 * Math.PI, a1 = (j + 1) / 10 * Math.PI; kBeam([s + Math.cos(a0) * .13, .2, y0 + Math.sin(a0) * 1.1], [s + Math.cos(a1) * .13, .2, y0 + Math.sin(a1) * 1.1], .012, st.glass); kBeam([s + Math.cos(a0) * .13, -.2, y0 + Math.sin(a0) * 1.1], [s + Math.cos(a1) * .13, -.2, y0 + Math.sin(a1) * 1.1], .012, st.glass); } kBeam([s, .2, y0 + 1.1], [s, -.2, y0 + 1.1], .01, st.glass); }
      kTree(-.1, 0, y0, .1, 1.2, '#6aa556'); kTree(.15, -.1, y0, .4, 1.1, '#5f9a4d'); return; } // a glass orchard: arches over trees
    default: { kBox(0, 0, y0, .12, .12, 2.3, '#ece6da', M_STONE); kHip(-.12, .12, -.12, .12, y0 + 2.3, .45, '#d6b85a', { ov: 0, noGut: 1 }); kBox(0, .122, y0 + 1.76, .03, .006, .03, ac, 0, 3); if (lod) kBox(0, .123, y0 + .3, .07, .003, .1, '#c9a447'); } // an obelisk with a stone that glows
  }
};
