/* ============================== civic: the town's public buildings, modelled properly ============================== */
// Built from the kit (kit.js) like the homes: a schoolhouse with its bell, a library behind its portico under a dome,
// the town hall with its clock tower, the clinic, a theatre, a museum, the guildhall with its stepped gable, the
// bathhouse, the observatory, a station, the university, the dock, the lighthouse, the market and the plaza.
// The landmarks that spread onto bigger lots (hall, museum, theatre, station, market, university) have their big
// versions at the bottom (GL_BIG). Each faces its street; small parts only close up (KF.lod).
const C_DOOR = '#3a2a20', C_STONE = '#e2dacb';
const cStone = st => mix(st.wall, C_STONE, .6);
function cLampPost(s, f, h = .2) { kBox(s, f, 0, .009, .009, .02, K_IRON); kBox(s, f, 0, .005, .005, h, K_IRON); kBox(s, f, h, .016, .016, .03, '#ffe2a0', 0, 2); kBox(s, f, h + .03, .02, .02, .008, K_IRON); }
function cFlag(s, f, y, h, col) { kBox(s, f, y, .004, .004, h, '#d8d8d8'); kOB(s + .035, f, y + h - .03, [.032, 0, 0], [0, .002, 0], [0, 0, .022], col); }
function cBell(s, f, y, rc, roofH = .08) { // an open belfry on a roof: a base, four posts, the bell, a little pyramid roof
  kBox(s, f, y, .05, .05, .03, K_TRIM, M_PLANK); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(s + a * .042, f + b * .042, y + .03, .006, .006, .08, K_TRIM, M_PLANK);
  kCone(s, f, y + .05, .022, .045, '#c9a447', 8, 0, .012); kHip(s - .052, s + .052, f - .052, f + .052, y + .11, roofH, rc, { ov: .008, noGut: 1, fin: 1 });
}

/* ---------- the schoolhouse: tall windows, a porch, a bell on the roof, a yard with hopscotch ---------- */
GL_MODEL.school = function (B, st) {
  kSetB(B); const [wc, wm] = kWall(B, st), lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), rc = st.roof, flatR = dsFlat() || hasTech('computing');
  const s0 = -.37, s1 = .37, fB = -.2, fD = .14, H = .3, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .035); kBox(0, fc, .035, .37, (fD - fB) / 2, H - .035, wc, wm);
  for (const s of [-.27, -.15, .15, .27]) kWin(s, fD, .08, .042, .17, s * 9 | 0, { ty: wty, arch: wty === 'sash' ? 'seg' : null, wall: wc });
  kWins(s0, s1, fB, .035, .26, 1, 4, { ty: wty, back: 1, hk: .62, yk: .17, hw: .042 }, null, 20);
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWin((a + b) / 2, ff, .08, .04, .16, 30 + k, { ty: wty }), 10);
  kBox(0, fD + .05, 0, .085, .05, .21, wc, wm); kDoor(0, fD + .1, .042, .15, '#2f4f3f', { steps: 1, fan: wty !== 'modern', ty: wty === 'case' ? 'plank' : 'panel' }); // the porch
  kBox(0, fD + .102, .17, .055, .004, .022, '#f1ead8'); if (lod) kBox(0, fD + .106, .175, .04, .002, .012, '#3a3a3a'); // its name board
  if (!flatR) { kGableF(-.095, .095, fD, fD + .1, .21, .08, rc, { wall: wc, wm }); kGable(s0, s1, fB, fD, H, .2, rc, { wall: wc, wm }); cBell(0, fc, H + .14, rc);
    const [stc, stm] = hStack(wm, wc); kChim(s1 - .07, fc, H + .1, H + .27, .03, .04, stc, stm); }
  else { kFlat(-.095, .095, fD, fD + .1, .21, wc, .02); kFlat(s0, s1, fB, fD, H, wc, .04); cBell(0, fc, H + .04, rc); }
  // the yard: railings along the street, a tree, hopscotch, a bench
  kFence([[-.48, .46], [-.06, .46]], .05, K_IRON, 'rail'); kFence([[.06, .46], [.48, .46]], .05, K_IRON, 'rail');
  kTree(-.36, .32, 0, .3, .8, '#5f9a4d');
  if (lod) { for (let q = 0; q < 6; q++) kBox(.2 + (q % 2) * .045 * (q > 1 && q < 5 ? 1 : 0), .24 + q * .035, 0, .018, .015, .003, '#f2efe8'); kBench(.36, .28, 0, 0); kBench(-.2, .36, 0, 1); }
};

/* ---------- the library: a portico of columns and a pediment, round-headed windows, a dome on a drum ---------- */
GL_MODEL.library = function (B, st) {
  kSetB(B); const stone = cStone(st), lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy();
  const s0 = -.34, s1 = .34, fB = -.32, fD = .12, H = .34, pod = .05;
  kBox(0, (fB + fD) / 2, 0, .36, (fD - fB) / 2 + .02, pod, '#cfc6b4', M_STONE); // the podium
  kBox(0, (fB + fD) / 2, pod, .34, (fD - fB) / 2, H - pod, stone, M_STONE);
  for (let q = 0; q < 3; q++) kBox(0, fD + .2 + .05 - q * .03, q * .017, .2, .05 + q * .015, .017, '#d8d0c2', M_STONE); // steps up to the portico
  kBox(0, fD + .07, pod - .004, .24, .085, .004, '#d8d0c2', M_STONE);
  kCols(-.2, .2, 4, fD + .14, pod, .24, .016, '#f3eee4');
  kBox(0, fD + .07, pod + .24, .25, .09, .04, '#ece6da', M_STONE); if (lod) kBox(0, fD + .162, pod + .25, .2, .002, .02, '#d2c8b4', M_STONE); // the entablature, its frieze
  kPed(-.25, .25, fD + .14, pod + .28, .09, '#ece6da', '#e4ddcf');
  kDoor(0, fD, .05, .17, C_DOOR, { ty: 'panel', y: pod }); kCornice(s0, s1, fB, fD, H, '#ece6da', { br: .03 });
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .04, b - .04, ff, pod, .26, 1, 3, { ty: wty, arch: 'round', hk: .5, yk: .14, hw: .035 }, null, 40 + k), 10);
  kWins(s0 + .05, s1 - .05, fB, pod, .26, 1, 4, { ty: wty, arch: 'round', hk: .5, yk: .14, hw: .035 }, null, 60);
  kFlat(s0, s1, fB, fD, H + .032, stone, .03);
  const dc = (fB + fD) / 2 - .02; kCyl(0, dc, H + .03, .17, .08, stone, M_STONE, 16); // the drum, and the dome
  if (lod) for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; kBox(Math.cos(a) * .171, dc + Math.sin(a) * .171, H + .05, .014, .014, .045, '#2c3440', 0, kLit(70 + q)); }
  kDome(0, dc, H + .11, .17, .15, mix(st.roof, '#7fa39a', hasTech('steam') ? .5 : 0), M_SLATE);
  kCyl(0, dc, H + .255, .03, .04, stone, M_STONE, 8); kDome(0, dc, H + .295, .032, .03, '#c9a447');
  for (const d of [-1, 1]) cLampPost(d * .32, fD + .28, .2);
};

/* ---------- the town hall: a stone ground floor, a balcony over the door, a clock tower with flags ---------- */
GL_MODEL.hall = function (B, st) {
  kSetB(B); const [wc, wm] = kWall(B, st), stone = cStone(st), lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), rc = st.roof;
  const s0 = -.38, s1 = .38, fB = -.26, fD = .18, H = .5, g = .22, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .03, '#a8a092'); kBox(0, fc, .03, .38, (fD - fB) / 2, g - .03, stone, M_STONE); kBox(0, fc, g, .38, (fD - fB) / 2, H - g, wc, wm);
  if (lod) for (let y = .06; y < g - .01; y += .04) kBox(0, fD + .002, y, .38, .003, .004, shade(stone, .8), M_STONE);
  kBox(0, fD + .02, 0, .11, .02, H, stone, M_STONE); // the centre bay stands forward
  kDoor(0, fD + .04, .05, .15, C_DOOR, { ty: 'panel', steps: 2, fan: 1 });
  kBalc(0, fD + .04, g + .005, .1, .06, { rail: K_IRON }); kWin(0, fD + .04, g + .03, .04, .16, 1, { ty: wty, ped: 1 });
  for (const s of [-.3, -.2, .2, .3]) { kWin(s, fD, .07, .035, .12, s * 10 + 5 | 0, { ty: wty, arch: 'round' }); kWin(s, fD, g + .04, .035, .15, s * 10 + 20 | 0, { ty: wty, ped: wty !== 'modern' }); }
  kBand(s0, s1, fD, g - .01, '#ece6da', .016); kCornice(s0, s1, fB, fD, H, '#ece6da'); kQuoins(s0, fB, fD, g, H, '#ece6da'); kQuoins(s1, fB, fD, g, H, '#ece6da');
  kWins(s0, s1, fB, .03, g - .03, 2, 5, { ty: wty, back: 1 }, null, 40);
  for (const d of [-1, 1]) cFlag(d * .1, fD + .1, g + .06, .1, d < 0 ? st.accent : '#f2ece0');
  kHip(s0 - .01, s1 + .01, fB - .01, fD + .01, H + .032, .16, rc, { ov: .03 });
  // the clock tower over the middle: clocks on all four faces, an open belfry, a spire
  const tf = fc - .02, tw = .1, t0 = H + .1, t1 = H + .36;
  kBox(0, tf, H, tw, tw, t1 - H, stone, M_STONE); kCornice(-tw, tw, tf - tw, tf + tw, t1, '#ece6da', { br: 0, ov: .015 });
  kWalls(-tw, tw, tf - tw, tf + tw, (a, b, ff) => kClock((a + b) / 2, ff + Math.sign(ff) * .002, t0 + .1, .05));
  kBox(0, tf, t1 + .03, tw * .8, tw * .8, .02, stone, M_STONE); for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(a * tw * .7, tf + b * tw * .7, t1 + .05, .012, .012, .1, stone, M_STONE);
  if (lod) kCone(0, tf, t1 + .07, .03, .05, '#c9a447', 8, 0, .015);
  kHip(-tw * .85, tw * .85, tf - tw * .85, tf + tw * .85, t1 + .15, .26, hasTech('steam') ? '#6f8f84' : rc, { ov: .01, noGut: 1, fin: 1 });
  cFlag(0, tf, t1 + .41, .12, st.accent);
};

/* ---------- the clinic: white and clean, a red cross that shines, a canopy, a garden bench ---------- */
GL_MODEL.clinic = function (B, st) {
  kSetB(B); const lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), wc = '#f3f1ee', flatR = hasTech('computing') || dsFlat();
  const s0 = -.33, s1 = .33, fB = -.3, fD = .2, H = .46, fh = (H - .03) / 2, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .03, '#bfc4c8'); kBox(0, fc, .03, .33, (fD - fB) / 2, H - .03, wc, M_PLASTER);
  kDoor(.1, fD, .05, .16, '#e8e8e8', { ty: hasTech('concrete') ? 'glass' : 'panel', hood: 'canopy', roof: '#d6dade' });
  if (lod) kOB(.1, fD + .12, .012, [.07, 0, 0], [0, .08, 0], [0, 0, .012], '#cfd3d6', M_STONE); // a ramp up to it
  kWins(s0, s1, fD, .03, fh, 2, 4, { ty: wty, hw: .04 }, (k, fk) => fk === 0 && k === 2, 0);
  kWins(s0, s1, fB, .03, fh, 2, 4, { ty: wty, back: 1, hw: .04 }, null, 20);
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .04, b - .04, ff, .03, fh, 2, 3, { ty: wty, hw: .035 }, null, 40 + k), 10);
  kBand(s0, s1, fD, .03 + fh, '#dde1e4', .01);
  kBox(-.12, fD + .006, .27, .05, .004, .014, '#e25d5d', 0, 3); kBox(-.12, fD + .006, .228, .014, .004, .056, '#e25d5d', 0, 3); // the cross
  if (flatR) { kFlat(s0, s1, fB, fD, H, wc, .04, { cop: '#dde1e4' }); if (lod) kBox(-.15, -.15, H, .06, .05, .07, '#d6dade'); }
  else { kCornice(s0, s1, fB, fD, H, '#dde1e4', { br: 0 }); kHip(s0, s1, fB, fD, H + .032, .17, st.roof, { ov: .03 }); kChim(s1 - .08, fc, H + .1, H + .25, .03, .04, '#e8e6e0', M_PLASTER); }
  kTree(-.34, .36, 0, .5, .7, '#6aa556'); if (lod) { kBench(-.16, .36, 0, 1); kBench(.3, .36, 0, 1); kFlowers(-.06, .3, 0, .3); kFlowers(.42, .28, 0, .7); }
};

/* ---------- the theatre: a portico, a marquee of lights, posters, the fly tower behind with its flag ---------- */
GL_MODEL.theatre = function (B, st) {
  kSetB(B); const [wc, wm] = kWall(B, st), lod = KF.lod, rc = st.roof, acc = st.accent;
  const s0 = -.36, s1 = .36, fB = -.34, fD = .14, H = .42, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .03); kBox(0, fc, .03, .36, (fD - fB) / 2, H - .03, wc, wm);
  kBox(0, fB + .14, H, .22, .14, .26, shade(wc, .95), wm); kGable(-.22, .22, fB, fB + .28, H + .26, .06, rc, { wall: wc, wm }); cFlag(.18, fB + .14, H + .32, .14, acc); // the fly tower
  kCols(-.24, .24, 4, fD + .13, .03, .26, .016); kBox(0, fD + .07, .29, .26, .08, .04, '#ece6da', M_STONE); kPed(-.26, .26, fD + .13, .33, .08, '#ece6da');
  for (let q = 0; q < 2; q++) kBox(0, fD + .2 - q * .03, q * .015, .26, .03 + q * .015, .015, '#d8d0c2', M_STONE);
  for (const d of [-1, 0, 1]) kDoor(d * .09, fD, .032, .14, '#7a3b3b', { ty: 'panel', y: .03 });
  kBox(0, fD + .05, .2, .2, .05, .02, '#2a2a30'); if (lod) for (let q = 0; q < 14; q++) kBox(-.19 + q * .029, fD + .102, .205, .005, .004, .005, '#ffe7a0', 0, 2); // the marquee and its bulbs
  for (const d of [-1, 1]) { kBox(d * .3, fD + .004, .07, .045, .004, .09, d < 0 ? '#c0584f' : '#3f6f9f'); if (lod) kBox(d * .3, fD + .008, .1, .03, .002, .04, '#f2e6c8'); kLantern(d * .2, fD, .18); } // posters
  kWins(s0, s1, fD, .21, .2, 1, 6, { ty: 'sash', arch: 'round', hk: .4, hw: .03 }, k => k > 1 && k < 4, 10);
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .05, b - .05, ff, .03, .19, 2, 3, { ty: 'sash', hw: .03, back: 1 }, null, 30 + k), 10);
  kCornice(s0, s1, fB, fD, H, '#ece6da'); kFlat(s0, s1, fB, fD, H + .032, wc, .035, { wm });
};

/* ---------- the museum: a colonnade under a pediment, banners between the columns, a glass lantern on the roof ---------- */
GL_MODEL.museum = function (B, st) {
  kSetB(B); const stone = cStone(st), lod = KF.lod, pod = .05, s0 = -.4, s1 = .4, fB = -.34, fD = .12, H = .34, fc = (fB + fD) / 2;
  kBox(0, fc + .04, 0, .42, (fD - fB) / 2 + .08, pod, '#cfc6b4', M_STONE); kBox(0, fc, pod, .4, (fD - fB) / 2, H - pod, stone, M_STONE);
  for (let q = 0; q < 3; q++) kBox(0, fD + .24 - q * .03, q * .017, .3, .03 + q * .015, .017, '#d8d0c2', M_STONE);
  kCols(-.36, .36, 6, fD + .13, pod, .25, .016); kBox(0, fD + .065, pod + .25, .41, .085, .035, '#ece6da', M_STONE); kPed(-.41, .41, fD + .13, pod + .285, .09, '#ece6da', '#e0d8c8');
  if (lod) { kBox(0, fD + .152, pod + .258, .3, .002, .016, '#d2c8b4', M_STONE); for (const s of [-.288, .288]) kBox(s, fD + .13, pod + .07, .025, .002, .15, s < 0 ? st.accent : '#3f6f9f'); } // the frieze, banners
  kDoor(0, fD, .05, .17, C_DOOR, { ty: 'panel', y: pod }); kWins(s0, s1, fD, pod, .25, 1, 6, { ty: kWinTy() === 'glass' ? 'modern' : kWinTy(), arch: 'round', hk: .48, hw: .03 }, k => k === 2 || k === 3, 0);
  kCornice(s0, s1, fB, fD, H, '#ece6da', { br: .03 }); kFlat(s0, s1, fB, fD, H + .032, stone, .03);
  kHip(-.16, .16, fc - .14, fc + .12, H + .04, .14, mix(st.glass, '#bfe0ee', .4), { ov: .005, noGut: 1 }); // a glass lantern lights the galleries
  if (lod) for (let q = -2; q <= 2; q++) kBeam([q * .06, fc - .14, H + .045], [q * .03, fc - .01, H + .18], .003, '#6c7680');
  kBox(-.3, .4, 0, .035, .035, .09, '#d8d2c8', M_STONE); if (lod) { kBox(-.3, .4, .09, .012, .01, .045, '#b9a99a', M_STONE); kBlob(-.3, .4, .145, .01, .012, '#b9a99a', M_STONE); } // a statue out front
};

/* ---------- the guildhall: a tall hall with a stepped gable to the street, an arcade below, the guild's banner ---------- */
GL_MODEL.guildhall = function (B, st) {
  kSetB(B); const [wc, wm] = kWall(B, st), lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), T = S.T[B.sid], r = T && guildOf(T), ec = r ? RES_COL[r] : st.accent;
  const s0 = -.24, s1 = .24, fB = -.3, fD = .26, H = .55, g = .18, fh = (H - g) / 2;
  kPlinth(s0, s1, fB, fD, .03); kBox(0, (fB + fD) / 2, .03, .24, (fD - fB) / 2, H - .03, wc, wm);
  for (const s of [-.15, 0, .15]) { kBox(s, fD - .02, .03, .055, .025, .13, '#2a2420');
    for (let q = 0; q < 7; q++) { const a = q / 6 * Math.PI, m = [Math.cos(a), Math.sin(a)], t = [-m[1], m[0]]; kOB(s + m[0] * .062, fD + .004, .12 + m[1] * .062, [t[0] * .012, 0, t[1] * .012], [0, .008, 0], [m[0] * .012, 0, m[1] * .012], K_STONE, M_STONE); } } // the arcade
  for (const d of [-.075, .075]) kBox(d, fD + .006, .03, .012, .008, .12, K_STONE, M_STONE);
  for (let fk = 0; fk < 2; fk++) for (const s of [-.14, 0, .14]) kWin(s, fD, g + fk * fh + .03, .032, fh * .6, fk * 3 + s * 9 + 4 | 0, { ty: wty, key: 1 });
  kBand(s0, s1, fD, g - .01); kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .05, b - .05, ff, g, fh, 2, 3, { ty: wty, back: 1 }, null, 20 + k), 10);
  kGableF(s0 + .01, s1 - .01, fB, fD - .01, H, .32, st.roof, { wall: wc, wm, ov: 0 });
  for (let k = 0; k < 5; k++) { const w = .24 - k * .045, y = H + k * .064; for (const d of [-1, 1]) kBox(d * (w - .02), fD, y, .025, .03, .064 + .01, wc, wm); kBox(0, fD + .03, y + .074, w + .006, .004, .008, K_STONE, M_STONE); } // the crow-stepped gable
  kWin(0, fD, H + .07, .03, .1, 30, { ty: wty, arch: 'round' }); kClock(0, fD + .002, H + .25, .03);
  kBeam([s0 - .02, fD + .01, H - .03], [s0 - .14, fD + .01, H - .02], .005, K_WOOD, M_PLANK); kOB(s0 - .12, fD + .01, H - .14, [.028, 0, 0], [0, .003, 0], [0, 0, .1], ec); // the guild's banner
  if (lod) kBox(s0 - .12, fD + .014, H - .14, .014, .002, .03, '#f2e6c8');
  kLantern(.09, fD + .006, .16); kChim(s1 - .05, fB + .08, H + .1, H + .38, .03, .04, ...hStack(wm, wc));
};

/* ---------- the bathhouse: a dome on its drum, apses, round windows, columns at the door, steam ---------- */
GL_MODEL.bathhouse = function (B, st) {
  kSetB(B); const stone = mix(st.wall, '#ece6da', .45), lod = KF.lod, s0 = -.32, s1 = .32, fB = -.24, fD = .18, H = .2, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .03, '#bdb3a2'); kBox(0, fc, .03, .32, (fD - fB) / 2, H - .03, stone, M_STONE);
  for (const d of [-1, 1]) { kCyl(d * .32, fc, .03, .1, H - .03, stone, M_STONE, 12, 0); kDome(d * .32, fc, H, .1, .07, st.roof, M_SLATE); } // apses at the ends
  kCols(-.07, .07, 2, fD + .06, .03, .15, .014); kBox(0, fD + .03, .18, .1, .045, .025, '#ece6da', M_STONE); kPed(-.1, .1, fD + .07, .205, .05, '#ece6da');
  kDoor(0, fD, .04, .13, '#5c4a3e', { ty: 'panel', y: .03 });
  for (const s of [-.22, -.13, .13, .22]) kWin(s, fD, .07, .03, .07, s * 20 + 9 | 0, { ty: 'sash', arch: 'round' });
  kCornice(s0, s1, fB, fD, H, '#ece6da', { br: 0 }); kFlat(s0, s1, fB, fD, H + .03, stone, .02);
  kCyl(0, fc, H + .03, .19, .05, stone, M_STONE, 16); if (lod) for (let q = 0; q < 10; q++) { const a = q / 10 * TAU; kBox(Math.cos(a) * .192, fc + Math.sin(a) * .192, H + .045, .012, .012, .025, '#2c3440', 0, kLit(q)); }
  kDome(0, fc, H + .08, .19, .17, shade(st.roof, 1.05), M_SLATE); kCyl(0, fc, H + .24, .035, .05, stone, M_STONE, 8); kDome(0, fc, H + .29, .035, .03, st.accent);
  hSmoke(0, fc, H + .32);
  if (lod) { kCyl(-.3, .38, 0, .08, .025, '#cfc6b4', M_STONE, 14, '#7fc7de'); kBench(.24, .36, 0, 1); for (const s of [-.4, .4]) kPot(s, .26); } // a pool out front
};

/* ---------- the observatory: a round tower, a gallery round it, a dome with its slit open and the telescope out ---------- */
GL_MODEL.observatory = function (B, st) {
  kSetB(B); const [wc, wm] = kWall(B, st), lod = KF.lod, r = .2, H = .4;
  kCyl(0, 0, 0, r + .02, .04, '#a8a092', M_STONE, 16); kCyl(0, 0, .04, r, H - .04, wc, wm, 16, 0);
  for (let sd = 0; sd < 4; sd++) kSide(sd, () => kWin(0, r - .004, .18, .025, .1, 10 + sd, { ty: 'sash', arch: 'round', back: 1 }));
  kDoor(0, r - .002, .035, .12, '#5c4a3e', { ty: 'panel', steps: 1, y: .04 });
  kCyl(0, 0, H, r + .05, .012, '#9aa0a6', M_STONE, 16); if (lod) { for (let q = 0; q < 24; q++) { const a = q / 24 * TAU; kBox(Math.cos(a) * (r + .045), Math.sin(a) * (r + .045), H + .012, .002, .002, .04, K_IRON); } kCyl(0, 0, H + .05, r + .046, .004, K_IRON, 0, 16, 0); } // the gallery
  const dm = '#eef0f3'; kDome(0, 0, H, r, .2, dm, M_PLASTER);
  kBeam([0, -.03, H + .2], [0, .175, H + .1], .026, '#2a2f38'); // the slit
  kBeam([0, 0, H + .1], [.0, .2, H + .26], .022, '#3a3f4a'); if (lod) kCyl(0, .2, H + .26 - .02, .026, .02, '#2a2f38', 0, 8); // the telescope
  if (lod) { kBox(.32, .3, 0, .03, .03, .05, '#cfc6b4', M_STONE); kOB(.32, .3, .056, [.025, 0, 0], [0, .025, 0], [0, 0, .003], '#c9a447'); kBeam([.32, .3, .058], [.32, .33, .08], .002, '#8a6a3a'); } // a sundial
};

/* ---------- the station (before it spreads): a station house with a clock, a canopied platform ---------- */
GL_MODEL.station = function (B, st) {
  kSetB(B); const [wc0, wm0] = kWall(B, st), brick = hasTech('brick'), wc = brick ? mix(st.wall, '#a5573f', .55) : wc0, wm = brick ? M_BRICK : wm0, lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), rc = st.roof;
  const s0 = -.38, s1 = .38, fB = -.12, fD = .2, H = .3;
  kPlinth(s0, s1, fB, fD, .03); kBox(0, (fB + fD) / 2, .03, .38, (fD - fB) / 2, H - .03, wc, wm);
  kWins(s0, s1, fD, .03, .27, 1, 6, { ty: wty, arch: wty === 'sash' ? 'seg' : null, wall: wc, hk: .55 }, k => k === 2 || k === 3, 0);
  kDoor(0, fD, .05, .16, '#2f4f3f', { ty: 'panel', fan: 1, hood: 'canopy' }); kClock(0, fD + .004, H + .07, .04);
  kGable(s0, s1, fB, fD, H, .16, rc, { wall: wc, wm }); kGableF(-.08, .08, fD - .1, fD + .005, H, .14, rc, { wall: wc, wm, ov: .02 });
  kChim(s0 + .07, (fB + fD) / 2, H + .08, H + .22, .03, .04, ...hStack(wm, wc));
  const pf = -.32, steel = hasTech('steam'); kBox(0, pf, 0, .48, .14, .035, '#bdb5a7', M_STONE); if (lod) kBox(0, pf - .135, .035, .48, .006, .002, '#f2e6a0'); // the platform, its edge line
  for (let k = 0; k < 5; k++) kBox(-.4 + k * .2, pf + .05, .035, .007, .007, .2, steel ? '#3d4a44' : K_WOOD, steel ? 0 : M_PLANK);
  kCtr(0, pf, .1); kQ([-.48, pf + .1, .25], [.48, pf + .1, .25], [.48, pf - .1, .22], [-.48, pf - .1, .22], hasTech('concrete') ? '#bfe3f0' : '#5d6670', hasTech('concrete') ? 0 : M_SLATE); // its canopy
  if (lod) { for (let q = 0; q < 24; q++) kBox(-.47 + q * .041, pf - .1, .205, .016, .003, .015, '#e8e2d6', M_PLANK); kBench(-.2, pf + .06, .035, 1); kBench(.2, pf + .06, .035, 1); cLampPost(.44, pf, .18); kCrate(.32, pf - .02, .035); kCrate(.32, pf + .03, .035, .018, '#8a6a4c'); } // valance, benches, a lamp, luggage
};

/* ---------- the university (before it spreads): a three-storey range, a portico, a dome ---------- */
GL_MODEL.university = function (B, st) {
  kSetB(B); const stone = cStone(st), lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), s0 = -.44, s1 = .44, fB = -.34, fD = .2, H = .52, fh = (H - .04) / 3, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .04, '#bdb3a2'); kBox(0, fc, .04, .44, (fD - fB) / 2, H - .04, stone, M_STONE);
  kWins(s0, s1, fD, .04, fh, 3, 7, { ty: wty, key: 1 }, (k, fk) => k >= 2 && k <= 4 && fk < 2, 0); kWins(s0, s1, fB, .04, fh, 3, 6, { ty: wty, back: 1 }, null, 40);
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .05, b - .05, ff, .04, fh, 3, 3, { ty: wty }, null, 80 + k), 10);
  kCols(-.15, .15, 5, fD + .1, .04, fh * 2, .015); kBox(0, fD + .05, .04 + fh * 2, .17, .07, .035, '#ece6da', M_STONE); kPed(-.17, .17, fD + .1, .075 + fh * 2, .07, '#ece6da');
  kDoor(0, fD, .05, .17, C_DOOR, { ty: 'panel', y: .04, fan: 1 }); for (let q = 0; q < 3; q++) kBox(0, fD + .16 - q * .025, q * .014, .18, .025 + q * .012, .014, '#d8d0c2', M_STONE);
  kBand(s0, s1, fD, .04 + fh - .01, '#ece6da'); kCornice(s0, s1, fB, fD, H, '#ece6da'); kQuoins(s0, fB, fD, .04, H, '#ece6da'); kQuoins(s1, fB, fD, .04, H, '#ece6da');
  kHip(s0 - .01, s1 + .01, fB - .01, fD + .01, H + .032, .15, st.roof, { ov: .03 });
  kCyl(0, fc, H + .1, .15, .07, stone, M_STONE, 16); kDome(0, fc, H + .17, .15, .14, hasTech('steam') ? '#6f8f84' : st.roof, M_SLATE); kCyl(0, fc, H + .3, .025, .04, stone, M_STONE, 8); kDome(0, fc, H + .34, .027, .025, '#c9a447');
  if (lod) for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; kBox(Math.cos(a) * .152, fc + Math.sin(a) * .152, H + .115, .012, .012, .04, '#2c3440', 0, kLit(90 + q)); }
  if (lod) { kTree(-.38, .38, 0, .2, .7, '#5f9a4d'); kTree(.38, .38, 0, .6, .7, '#6aa556'); kBench(-.2, .4, 0, 1); kBench(.2, .4, 0, 1); }
};

/* ---------- the dock: a boathouse with a slipway door, a timber pier on piles, a boat tied up, a lantern ---------- */
GL_MODEL.dock = function (B, st) {
  const d = B.dir || [1, 0]; kSet(GLB.x, GLB.y, [d[1], 0, -d[0]], [d[0], 0, d[1]], B.id); // (out is towards the water)
  const [wc0] = kWall(B, st), wc = mix(wc0, '#a57f5e', .5), lod = KF.lod, rc = st.roof, ys = Math.min(-.01, SEAZ * ZS - GLB.base - .02);
  kBox(-.1, -.15, 0, .2, .16, .2, wc, M_PLANK); if (lod) for (let s = -.29; s < .1; s += .03) kBox(s, .01 + .002, 0, .004, .003, .2, shade(wc, .82), M_PLANK);
  kBox(-.1, .012, 0, .1, .006, .15, '#4a3a30', M_PLANK); if (lod) { kBox(-.1, .02, .075, .1, .004, .004, K_IRON); kBox(-.1, .02, 0, .004, .004, .15, '#3a2a20'); } // its big doors
  kGable(-.3, .1, -.31, .01, .2, .12, rc, { wall: wc, wm: M_PLANK });
  kSide(1, () => kWin(-.15, -.1, .07, .03, .07, 3, { ty: 'case', back: 1 }));
  kBox(.0, .38, -.005, .07, .33, .022, '#9b7657', M_PLANK); if (lod) for (let f = .06; f < .7; f += .025) kBox(0, f, .017, .07, .003, .002, '#7a5a40', M_PLANK); // the pier and its planks
  for (const f of [.3, .5, .68]) for (const s of [-.06, .06]) kBox(s, f, ys - .05, .01, .01, .07 - ys, '#6b5040', M_BARK); // piles
  kBox(.06, .68, .017, .005, .005, .2, '#6b5040', M_PLANK); kBox(.06, .7, .2, .012, .012, .02, '#ffe2a0', 0, 2); // a lantern at the end
  if (lod) { for (const f of [.5, .66]) kCyl(-.065, f, .017, .008, .02, '#3a2a20', M_BARK, 6); kLog([-.065, .5, .03], [-.09, .54, ys + .01], .002, '#c9b48a', '#c9b48a', 0); kCrate(-.2, .1, 0); kBarrel(-.25, .14); }
  const bs = -.15, bf = .62, by = ys + .005; kOB(bs, bf, by + .012, [.025, 0, 0], [0, .11, 0], [0, 0, .014], '#8a5a3a', M_PLANK); kOB(bs, bf + .1, by + .015, [.012, 0, 0], [0, .025, 0], [0, 0, .01], '#8a5a3a', M_PLANK); // a boat tied up
  if (lod) kBox(bs, bf, by + .025, .02, .006, .004, '#6b4a30', M_PLANK);
};

/* ---------- the lighthouse: its rock, a banded tower, the gallery and its railing, the lantern, a keeper's cottage ---------- */
GL_MODEL.lighthouse = function (B, st) {
  kSetB(B); const lod = KF.lod, red = '#c0584f', white = '#f4f1ea';
  for (const [s, f, r] of [[0, 0, .3], [.14, .12, .16], [-.16, .1, .14], [.08, -.18, .15], [-.1, -.2, .12]]) kBlob(s, f, 0, r, .06, s ? '#bdb7c9' : '#aaa4b8', M_STONE);
  const rs = [.12, .112, .104, .096, .088], H = .04 + 5 * .17; kCyl(0, 0, 0, .135, .045, '#a8a092', M_STONE, 14);
  for (let k = 0; k < 5; k++) { kCone(0, 0, .045 + k * .17, rs[k], .17, k % 2 ? red : white, 16, M_PLASTER, rs[k] - .008); if (lod) kWin(0, rs[k] - .008, .1 + k * .17, .012, .03, k, { ty: 'sash', back: 1 }); }
  kDoor(0, .128, .028, .09, '#3a5a6a', { ty: 'panel', y: .045 });
  kCyl(0, 0, H + .045, .12, .02, '#3a3f4a', 0, 16); if (lod) { for (let q = 0; q < 20; q++) { const a = q / 20 * TAU; kBox(Math.cos(a) * .115, Math.sin(a) * .115, H + .065, .002, .002, .045, K_IRON); } kCyl(0, 0, H + .11, .116, .004, K_IRON, 0, 16, 0); } // the gallery
  kCyl(0, 0, H + .065, .07, .11, '#cfe6ee', 0, 12, 0, .5); kBox(0, 0, H + .1, .035, .035, .04, '#fff3cf', 0, 2); // the lantern room (the beam sweeps: fx3d.js)
  if (lod) for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; kBox(Math.cos(a) * .071, Math.sin(a) * .071, H + .065, .003, .003, .11, '#3a3f4a'); }
  kCone(0, 0, H + .175, .09, .11, red, 12, M_PLASTER); kBlob(0, 0, H + .29, .016, .016, '#3a3f4a', 0);
  kBox(.24, .22, 0, .1, .08, .18, '#ece6da', M_PLASTER); kGable(.14, .34, .14, .3, .18, .07, red, { wall: '#ece6da', wm: M_PLASTER }); kDoor(.2, .3, .025, .1, '#3a5a6a', { ty: 'plank' }); kWin(.29, .3, .07, .022, .06, 40, { ty: 'case', shut: '#3f5f8a' }); kChim(.32, .22, .2, .3, .02, .025, '#ece6da', M_PLASTER);
};

/* ---------- the market (before it spreads): stalls under striped awnings, crates, baskets, a handcart ---------- */
GL_MODEL.market = function (B, st) {
  kSetB(B); const lod = KF.lod, wood = mix(st.wall, '#c9a47e', .4), food = FOOD_C;
  kBox(0, 0, 0, .46, .46, .008, '#b3a894', M_COBBLE);
  [[-.22, -.12, 0], [.18, -.18, 1], [.02, .2, 2]].forEach(([s, f, k]) => {
    const acc = [st.accent, '#e9c46a', '#3f7fb0'][k];
    kBox(s, f, 0, .11, .06, .07, wood, M_PLANK); kBox(s, f, .07, .115, .065, .006, shade(wood, .85), M_PLANK); // the counter
    for (let q = 0; q < 4; q++) { const fs = s - .08 + q * .055; if (lod) for (let n = 0; n < 4; n++) kBlob(fs - .012 + (n % 2) * .024, f + .025 - (n >> 1) * .024, .088, .012, .01, food[(q + k * 2) % food.length], 0); else kBox(fs, f, .076, .022, .05, .01, food[(q + k * 2) % food.length]); }
    for (const [a, b] of [[-.12, -.07], [.12, -.07], [-.12, .08], [.12, .08]]) kBox(s + a, f + b, 0, .005, .005, b < 0 ? .2 : .15, '#6b5040', M_PLANK);
    kCtr(s, f, 0); const n = lod ? 8 : 2; for (let q = 0; q < n; q++) { const a = s - .13 + .26 * q / n, b = s - .13 + .26 * (q + 1) / n; kQ([a, f - .08, .2], [b, f - .08, .2], [b, f + .1, .15], [a, f + .1, .15], q % 2 && lod ? '#f2ece0' : acc, M_PLANK); }
    if (lod) { kCrate(s - .14, f + .1, 0); kBarrel(s + .14, f + .12); kBox(s, f + .1, .13, .004, .004, .02, K_IRON); kBox(s, f + .1, .11, .01, .01, .015, '#ffe2a0', 0, 2); }
  });
  if (lod) { kOB(.32, .3, .04, [.06, 0, 0], [0, .035, 0], [0, 0, .015], '#8a6446', M_PLANK); for (const d of [-1, 1]) kLog([.32 + d * .04, .3 - .04, .025], [.32 + d * .04, .3 - .046, .025], .025, '#5a4030', '#6b5040', M_PLANK); kBeam([.38, .3, .05], [.46, .3, .03], .004, '#6b5040', M_PLANK);
    for (let q = 0; q < 3; q++) kBlob(.3 + q * .025, .3, .06, .013, .012, food[q], 0); cLampPost(-.42, .42, .22); }
};

/* ---------- the landmarks on their bigger lots (GL_BIG): a 2×1 lot runs s from -1 to 1 and f from -.5 to .5 ---------- */
function cBig(B) { const { a, d } = glFacing(B), [lx, lz] = glLot(B); kSet(lx, lz, [a[0], 0, a[1]], [d[0], 0, d[1]], B.id); }
// the grand town hall: a long range with end pavilions, a portico under a pediment, a tall clock tower, a forecourt
GL_BIG.hall = function (B, st) {
  cBig(B); const stone = cStone(st), [wc, wm] = kWall(B, st), lod = KF.lod, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), rc = st.roof, s0 = -.85, s1 = .85, fB = -.4, fD = .12, g = .2, H = .62, fh = (H - g) / 2, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .04, '#a8a092'); kBox(0, fc, .04, .85, (fD - fB) / 2, g - .04, stone, M_STONE); kBox(0, fc, g, .85, (fD - fB) / 2, H - g, wc, wm);
  if (lod) for (let y = .07; y < g - .01; y += .04) kBox(0, fD + .002, y, .85, .003, .004, shade(stone, .8), M_STONE);
  for (const sg of [-1, 1]) { const a = sg < 0 ? s0 : s1 - .2, b = a + .2; kBox((a + b) / 2, fc + .03, 0, .1, (fD - fB) / 2 + .03, H + .04, stone, M_STONE); kHip(a - .01, b + .01, fB - .01, fD + .07, H + .07, .14, rc, { ov: .02 });
    kWins(a, b, fD + .06, .04, (H - .04) / 3, 3, 1, { ty: wty, ped: 1, hw: .04 }, null, 70 + sg); kQuoins(sg < 0 ? a : b, fB, fD + .06, .04, H + .04, '#ece6da'); kCornice(a, b, fB, fD + .06, H + .04, '#ece6da', { br: 0 }); }
  kWins(-.65, -.2, fD, g, fh, 2, 3, { ty: wty, key: 1 }, null, 0); kWins(.2, .65, fD, g, fh, 2, 3, { ty: wty, key: 1 }, null, 10);
  kWins(-.65, -.2, fD, .04, g - .04, 1, 3, { ty: wty, arch: 'round', hk: .55 }, null, 20); kWins(.2, .65, fD, .04, g - .04, 1, 3, { ty: wty, arch: 'round', hk: .55 }, null, 30);
  kWins(s0 + .2, s1 - .2, fB, .04, (H - .04) / 3, 3, 8, { ty: wty, back: 1 }, null, 40);
  kBand(s0 + .2, s1 - .2, fD, g - .01, '#ece6da', .016); kCornice(-.65, .65, fB, fD, H, '#ece6da');
  kHip(-.66, .66, fB - .01, fD + .01, H + .032, .18, rc, { ov: .02 });
  for (let q = 0; q < 3; q++) kBox(0, fD + .3 - q * .03, q * .016, .24, .04 + q * .016, .016, '#d8d0c2', M_STONE); // steps
  kCols(-.2, .2, 6, fD + .17, .05, .38, .018); kBox(0, fD + .085, .43, .23, .095, .045, '#ece6da', M_STONE); kPed(-.23, .23, fD + .17, .475, .11, '#ece6da', '#e0d8c8');
  if (lod) kBox(0, fD + .19, .44, .16, .002, .025, '#d2c8b4', M_STONE); kDoor(0, fD, .06, .2, C_DOOR, { ty: 'panel', y: .05, fan: 1 }); kBalc(0, fD, g + .03, .16, .07);
  const tf = fc - .04, tw = .13, t0 = H + .18, t1 = H + .55; kBox(0, tf, H, tw, tw, t1 - H, stone, M_STONE); kCornice(-tw, tw, tf - tw, tf + tw, t1, '#ece6da', { br: 0, ov: .015 });
  kWalls(-tw, tw, tf - tw, tf + tw, (a, b, ff) => { kClock((a + b) / 2, ff + Math.sign(ff) * .002, t0 + .16, .065); kWin((a + b) / 2, ff, t0 - .02, .028, .1, 5, { ty: 'sash', arch: 'round', back: 1 }); });
  kCyl(0, tf, t1 + .03, .1, .1, stone, M_STONE, 12); if (lod) for (let q = 0; q < 8; q++) { const a = q / 8 * TAU; kBox(Math.cos(a) * .1, tf + Math.sin(a) * .1, t1 + .05, .012, .012, .07, '#2c3440', 0, kLit(q)); }
  kDome(0, tf, t1 + .13, .1, .12, hasTech('steam') ? '#6f8f84' : rc, M_SLATE); kCyl(0, tf, t1 + .24, .02, .06, stone, M_STONE, 8); kBlob(0, tf, t1 + .31, .018, .018, '#c9a447', 0); cFlag(0, tf, t1 + .32, .14, st.accent);
  for (const s of [-.4, .4]) cLampPost(s, .4, .22); if (lod) { kBench(-.6, .38, 0, 1); kBench(.6, .38, 0, 1); for (const s of [-.75, .75]) kTree(s, .38, 0, .4, .7, '#5f9a4d'); }
};
// the museum: a podium, ten columns under a long pediment, banners, statues by the steps, a glass lantern on the roof
GL_BIG.museum = function (B, st) {
  cBig(B); const stone = cStone(st), lod = KF.lod, pod = .06, s0 = -.85, s1 = .85, fB = -.42, fD = .08, H = .46, fc = (fB + fD) / 2;
  kBox(0, fc + .07, 0, .88, (fD - fB) / 2 + .14, pod, '#cfc6b4', M_STONE); kBox(0, fc, pod, .85, (fD - fB) / 2, H - pod, stone, M_STONE);
  for (let q = 0; q < 4; q++) kBox(0, fD + .34 - q * .025, q * .015, .45, .025 + q * .012, .015, '#d8d0c2', M_STONE);
  kCols(-.78, .78, 10, fD + .17, pod, .32, .02); kBox(0, fD + .085, pod + .32, .82, .1, .045, '#ece6da', M_STONE); kPed(-.82, .82, fD + .17, pod + .365, .16, '#ece6da', '#e0d8c8');
  if (lod) { kBox(0, fD + .19, pod + .33, .6, .002, .025, '#d2c8b4', M_STONE); for (let q = 0; q < 5; q++) kBox(-.24 + q * .12, fD + .19, pod + .43, .03, .003, .03 + (q % 2) * .02, '#d8d0c0', M_STONE); } // the frieze, figures in the pediment
  if (lod) for (const s of [-.61, -.27, .27, .61]) kBox(s, fD + .14, pod + .08, .03, .002, .2, s < 0 ? st.accent : '#3f6f9f'); // banners
  for (const s of [-.17, 0, .17]) kDoor(s, fD, .045, .2, C_DOOR, { ty: 'panel', y: pod });
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .05, b - .05, ff, pod, .3, 1, k === 2 ? 8 : 3, { ty: 'sash', arch: 'round', hk: .5, hw: .035 }, null, 10 + k), 14);
  kCornice(s0, s1, fB, fD, H, '#ece6da', { br: .03 }); kFlat(s0, s1, fB, fD, H + .032, stone, .035);
  kHip(-.4, .4, fc - .12, fc + .1, H + .045, .14, mix(st.glass, '#bfe0ee', .4), { ov: .005, noGut: 1 }); if (lod) for (let q = -6; q <= 6; q++) kBeam([q * .06, fc - .12, H + .05], [q * .02, fc - .01, H + .18], .003, '#6c7680');
  if (hasTech('computing')) { kBox(.6, fc, H + .04, .14, .12, .12, '#9fc4d8', 0, .5); if (lod) for (let q = -3; q <= 3; q++) kBox(.6 + q * .04, fc + .121, H + .04, .002, .002, .12, '#6c7680'); } // a glass gallery on the roof
  for (const s of [-.5, .5]) { kBox(s, .42, 0, .04, .04, .1, '#d8d2c8', M_STONE); if (lod) { kBox(s, .42, .1, .014, .012, .05, '#b9a99a', M_STONE); kBlob(s, .42, .16, .012, .014, '#b9a99a', M_STONE); } }
};
// the theatre: a classical front with a portico, a marquee of bulbs, posters and lamps; the fly tower and its flag behind
GL_BIG.theatre = function (B, st) {
  cBig(B); const [wc, wm] = kWall(B, st), lod = KF.lod, rc = st.roof, acc = st.accent, s0 = -.85, s1 = .85, fB = -.42, fD = .14, H = .46, fc = (fB + fD) / 2;
  kPlinth(s0, s1, fB, fD, .04); kBox(0, fc, .04, .85, (fD - fB) / 2, H - .04, wc, wm);
  kBox(-.45, fB + .2, H, .32, .2, .34, shade(wc, .95), wm); kGable(-.77, -.13, fB, fB + .4, H + .34, .08, rc, { wall: wc, wm }); cFlag(-.2, fB + .2, H + .42, .16, acc); // the fly tower
  kCols(-.36, .36, 6, fD + .16, .04, .3, .018); kBox(0, fD + .08, .34, .4, .095, .045, '#ece6da', M_STONE); kPed(-.4, .4, fD + .16, .385, .1, '#ece6da');
  for (let q = 0; q < 3; q++) kBox(0, fD + .28 - q * .03, q * .015, .4, .03 + q * .015, .015, '#d8d0c2', M_STONE);
  for (const s of [-.2, 0, .2]) kDoor(s, fD, .045, .16, '#7a3b3b', { ty: 'panel', y: .04 });
  kBox(0, fD + .06, .24, .32, .06, .025, '#2a2a30'); if (lod) for (let q = 0; q < 30; q++) kBox(-.31 + q * .0214, fD + .122, .246, .005, .004, .005, '#ffe7a0', 0, 2); // the marquee
  for (const sg of [-1, 1]) for (const s of [.5, .7]) { kBox(sg * s, fD + .004, .08, .05, .004, .1, s === .5 ? '#c0584f' : '#3f6f9f'); if (lod) kBox(sg * s, fD + .008, .11, .035, .002, .05, '#f2e6c8'); }
  for (const s of [-.45, .45]) kLantern(s, fD, .22);
  kWins(s0, s1, fD, .26, .2, 1, 10, { ty: 'sash', arch: 'round', hk: .4, hw: .03 }, k => k >= 3 && k <= 6, 10);
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .05, b - .05, ff, .04, .2, 2, k === 2 ? 8 : 3, { ty: 'sash', back: 1, hw: .03 }, null, 30 + k), 14);
  kCornice(s0, s1, fB, fD, H, '#ece6da'); kFlat(s0, s1, fB, fD, H + .032, wc, .035, { wm });
  for (const s of [-.6, .6]) cLampPost(s, .42, .2);
};
// the station: the station house with its clock tower, and a train shed of iron and glass over the platform
GL_BIG.station = function (B, st) {
  cBig(B); const brick = hasTech('brick'), [wc0, wm0] = kWall(B, st), wc = brick ? mix(st.wall, '#a5573f', .55) : wc0, wm = brick ? M_BRICK : wm0, lod = KF.lod, rc = st.roof, wty = kWinTy() === 'glass' ? 'modern' : kWinTy();
  const s0 = -.8, s1 = .2, fB = .02, fD = .38, H = .34, fc = (fB + fD) / 2, glass = hasTech('concrete');
  kPlinth(s0, s1, fB, fD, .03); kBox((s0 + s1) / 2, fc, .03, .5, (fD - fB) / 2, H - .03, wc, wm);
  kWins(s0, s1, fD, .03, .3, 1, 7, { ty: wty, arch: wty === 'sash' ? 'round' : null, hk: .5 }, k => k === 3, 0); kDoor(-.3, fD, .06, .18, '#2f4f3f', { ty: 'panel', fan: 1, hood: 'canopy' });
  kGable(s0, s1, fB, fD, H, .14, rc, { wall: wc, wm }); kQuoins(s0, fB, fD, .03, H); kQuoins(s1, fB, fD, .03, H);
  const tw = .09, ts = -.3, tf = fc; kBox(ts, tf, H, tw, tw, .32, wc, wm); kWalls(ts - tw, ts + tw, tf - tw, tf + tw, (a, b, ff) => kClock((a + b) / 2, ff + Math.sign(ff) * .002, H + .22, .05)); // (offset: the clocks go round the tower)
  kHip(ts - tw - .01, ts + tw + .01, tf - tw - .01, tf + tw + .01, H + .32, .2, rc, { ov: .01, noGut: 1, fin: 1 });
  // the platform and the train shed over it: an arched roof on iron columns, glazed down the middle
  const pf = -.26, R = .26; kBox(0, pf, 0, .95, .22, .035, '#bdb5a7', M_STONE); if (lod) kBox(0, pf - .215, .035, .95, .006, .002, '#f2e6a0');
  for (let k = 0; k < 7; k++) for (const f of [pf - .22, pf + .22]) kBox(-.9 + k * .3, f, .035, .009, .009, .22, glass ? '#8c9199' : '#3d4a44');
  const ac = gcol(glass ? '#bfe3f0' : '#9fb8c4'), ir = glass ? '#8c9199' : '#3d4a44', n = 8;
  for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI, P = (s, a) => [s, pf + Math.cos(a) * R, .255 + Math.sin(a) * R * .55]; kCtr(0, pf, .2); kQ(P(-.95, a0), P(.95, a0), P(.95, a1), P(-.95, a1), q === 3 || q === 4 ? ac : '#5d6670', q === 3 || q === 4 ? 0 : M_SLATE, q === 3 || q === 4 ? .5 : 0); }
  if (lod) for (let k = 0; k < 7; k++) for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI, s = -.9 + k * .3; kBeam([s, pf + Math.cos(a0) * R, .26 + Math.sin(a0) * R * .55], [s, pf + Math.cos(a1) * R, .26 + Math.sin(a1) * R * .55], .005, ir); }
  if (lod) { for (const s of [-.6, -.1, .4]) kBench(s, pf + .1, .035, 1); kClock(.0, pf + .2, .2, .03); for (let q = 0; q < 3; q++) kCrate(.75 + q * .05, pf + .12, .035, .02, '#8a6a4c'); cLampPost(.6, .45, .2); }
};
// the market: before concrete a market place of stalls round a market cross; after, a market hall of brick, iron and glass
GL_BIG.market = function (B, st) {
  cBig(B); const lod = KF.lod;
  kBox(0, 0, -.004, .98, .48, .012, '#a39a8c', M_COBBLE);
  if (hasTech('concrete')) {
    const wc = mix(st.wall, '#a5573f', .55), s0 = -.86, s1 = .86, fB = -.38, fD = .38, H = .26, R = .38;
    kPlinth(s0, s1, fB, fD, .03); kBox(0, 0, .03, .86, .38, H - .03, wc, M_BRICK);
    kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .04, b - .04, ff, .03, H - .04, 1, k % 2 ? 3 : 9, { ty: 'modern', arch: 'round', hk: .55 }, (q) => k % 2 === 0 && q === (k ? 4 : 4), 10 * k), 15);
    kDoor(0, fD, .07, .17, '#3a4652', { ty: 'glass', fan: 1 }); kBox(0, fD + .006, .245, .2, .004, .03, st.accent);
    kCornice(s0, s1, fB, fD, H, '#d8d0c2', { br: 0 }); const n = 8, ac = gcol('#bfe3f0');
    for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI, P = (s, a) => [s, Math.cos(a) * R, H + .03 + Math.sin(a) * R * .7]; kCtr(0, 0, H); kQ(P(s0, a0), P(s1, a0), P(s1, a1), P(s0, a1), ac, 0, .5); } // the glass vault
    for (const s of [s0, s1]) { kCtr(0, 0, H + .1); for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI; kT([s, 0, H + .03], [s, Math.cos(a0) * R, H + .03 + Math.sin(a0) * R * .7], [s, Math.cos(a1) * R, H + .03 + Math.sin(a1) * R * .7], wc, M_BRICK); } }
    if (lod) for (let k = 0; k <= 12; k++) for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI, s = s0 + k / 12 * (s1 - s0); kBeam([s, Math.cos(a0) * R, H + .035 + Math.sin(a0) * R * .7], [s, Math.cos(a1) * R, H + .035 + Math.sin(a1) * R * .7], .004, '#5a6470'); }
    return;
  }
  const cols = [[st.accent, '#f2ece0'], ['#3f7fb0', '#f2ece0'], ['#4e9a6a', '#f2ece0'], ['#e0a43a', '#6b5040']], wood = mix(st.wall, '#c9a47e', .4);
  for (let r2 = 0; r2 < 2; r2++) for (let k = 0; k < 4; k++) { if (k === 1 || k === 2) { if (r2) continue; }
    const s = -.72 + k * .48, f = r2 ? .26 : -.26, c = cols[(k + r2 * 2 + B.id) % cols.length], out = r2 ? -1 : 1;
    kBox(s, f, 0, .16, .07, .07, wood, M_PLANK); kBox(s, f, .07, .165, .075, .006, shade(wood, .85), M_PLANK);
    for (let q = 0; q < 5; q++) { const fs = s - .12 + q * .06; if (lod) for (let n = 0; n < 4; n++) kBlob(fs - .012 + (n % 2) * .024, f + .025 - (n >> 1) * .024, .088, .012, .01, FOOD_C[(q + k) % FOOD_C.length], 0); else kBox(fs, f, .076, .024, .05, .01, FOOD_C[(q + k) % FOOD_C.length]); }
    for (const [a, b] of [[-.17, -.08], [.17, -.08], [-.17, .08], [.17, .08]]) kBox(s + a, f + b, 0, .005, .005, b * out < 0 ? .2 : .16, '#5a4030', M_PLANK);
    kCtr(s, f, 0); const n = lod ? 9 : 2; for (let q = 0; q < n; q++) { const a = s - .18 + .36 * q / n, b = s - .18 + .36 * (q + 1) / n; kQ([a, f - .1 * out, .2], [b, f - .1 * out, .2], [b, f + .13 * out, .155], [a, f + .13 * out, .155], c[q % 2 && lod ? 1 : 0], M_PLANK); }
    if (lod) { kCrate(s - .19, f - .06 * out, 0); kBarrel(s + .2, f - .05 * out); kBlob(s + .1, f - .1 * out, .02, .025, .02, '#d8c49a', 0); }
  }
  kBox(0, .26, 0, .07, .07, .03, '#cfc6b4', M_STONE); kBox(0, .26, .03, .05, .05, .03, '#d8d0c2', M_STONE); kBox(0, .26, .06, .014, .014, .22, '#d8d0c2', M_STONE); kBox(0, .26, .22, .05, .01, .012, '#d8d0c2', M_STONE); // the market cross
  for (const s of [-.9, .9]) cLampPost(s, .4, .22); if (lod) { iCart(.45, .3, 1, '#8a6446', '#6aa556'); kBench(-.45, .38, 0, 1); }
};
// the university: four ranges round a green quad, dormers in their roofs, a gate tower with a clock and a spire
GL_BIG.university = function (B, st) {
  const [lx, lz] = glLot(B), { d } = glFacing(B); kSet(lx, lz, [d[1], 0, -d[0]], [d[0], 0, d[1]], B.id);
  const stone = hasTech('masonry'), wc = hasTech('brick') && !stone ? '#b8684f' : cStone(st), wm = stone ? M_STONE : M_BRICK, lod = KF.lod, rc = st.roof, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), H = .44, fh = (H - .03) / 3, D = .17;
  const sc = fpW(B) / 2, R = [[0, -.72 * sc, .88 * sc, 0], [0, .72 * sc, .88 * sc, 0], [-.72 * sc, 0, .55 * sc, 1], [.72 * sc, 0, .55 * sc, 1]]; // ranges: middle, half length, turned (longer on a 3×3 lot)
  R.forEach(([cs, cf, hl, turn], k) => {
    const draw = () => { kPlinth(-hl, hl, -D, D, .03); kBox(0, 0, .03, hl, D, H - .03, wc, wm);
      for (const ff of [D, -D]) kWins(-hl + .04, hl - .04, ff, .03, fh, 3, Math.round(hl * 9), { ty: wty, hw: .03, key: wty === 'sash', back: ff < 0 }, null, k * 50 + (ff > 0 ? 0 : 25));
      kGable(-hl, hl, -D, D, H, .16, rc, { wall: wc, wm, noGut: !lod }); if (lod) for (let q = 0; q < Math.round(hl * 4); q++) for (const sg of [1, -1]) kSide(sg > 0 ? 0 : 2, () => kDormer(-hl + .12 + q * .25, D - .06, H + .05, .035, .07, .1, rc, wc, wm, q)); };
    const sa = KF.A, sf = KF.F, sx = KF.X, sz = KF.Z, P = kP(cs, cf, 0); KF.X = P[0]; KF.Z = P[2]; if (turn) { KF.A = sf; KF.F = [-sa[0], 0, -sa[2]]; }
    try { draw(); } finally { KF.A = sa; KF.F = sf; KF.X = sx; KF.Z = sz; }
  });
  const q = .55 * sc; kBox(0, 0, 0, q, q, .008, '#6f9a52', M_GRASS); kPath(-.04, -q, .04, q, '#c9bfae'); kPath(-q, -.04, q, .04, '#c9bfae');
  kTree(-.28 * sc, .26 * sc, 0, .4, 1.1, '#5f9a4d'); kTree(.28 * sc, -.24 * sc, 0, .7, 1, '#6aa556'); if (sc > 1) { kTree(-.3 * sc, -.3 * sc, 0, .5, 1.1, '#5f9a4d'); kTree(.3 * sc, .3 * sc, 0, .3, 1.05, '#6aa556'); } if (lod) { kTree(.3, .3, 0, .2, .9, '#5f9a4d'); kBench(-.2, -.1, 0, 1); kBench(.15, .12, 0, 0); kCyl(0, 0, 0, .06, .03, '#cfc6b4', M_STONE, 12, '#7fc7de'); }
  const tf = .72 * sc, tw = .12, tH = H + .36 + (sc - 1) * .3; kBox(0, tf, 0, tw, tw + .03, tH, wc, wm); kBox(0, tf + tw + .03, .03, .05, .004, .16, '#2a2420'); // the gate tower, its arch
  kWalls(-tw, tw, tf - tw - .03, tf + tw + .03, (a, b, ff) => kClock((a + b) / 2, ff + Math.sign(ff) * .002, tH - .1, .055), 5);
  kCornice(-tw, tw, tf - tw - .03, tf + tw + .03, tH, '#ece6da', { br: 0, ov: .015 }); kHip(-tw, tw, tf - tw - .03, tf + tw + .03, tH + .03, .32, rc, { ov: .005, noGut: 1, fin: 1 }); cFlag(0, tf, tH + .35, .12, st.accent);
};

/* ---------- the small public things: the well, the granary, a shrine, a watchstone ---------- */
GL_MODEL.well = function (B, st) { // a stone well under a little roof, a windlass with its crank, a bucket; a cast-iron pump once the style turns modern
  kSetB(B); const lod = KF.lod;
  kBox(0, 0, 0, .26, .26, .006, '#b8ad9c', M_COBBLE);
  if (B.style >= 4) { kBox(0, 0, .006, .06, .06, .05, '#bdb3a6', M_STONE); kCyl(0, 0, .056, .025, .16, '#3d4a52', 0, 10, '#2e383f'); kBlob(0, 0, .225, .03, .025, '#3d4a52', 0); // the pump
    kBeam([0, .02, .17], [0, .1, .19], .006, '#2e383f'); kBeam([.02, 0, .2], [.13, 0, .25], .005, '#2e383f'); kBox(.13, 0, .25, .012, .006, .006, '#2e383f'); kBox(0, .14, 0, .07, .04, .05, '#a39a8c', M_STONE); if (lod) kBox(0, .14, .045, .06, .03, .003, '#6fa8c4', 0, -1); return; } // the handle, the spout, the trough
  kCyl(0, 0, .006, .15, .07, '#bdb3a6', M_STONE, 14, '#4f9cbc'); kCyl(0, 0, .076, .16, .012, '#cfc6b4', M_STONE, 14, 0); if (lod) for (let y = .02; y < .07; y += .022) kCyl(0, 0, y, .152, .003, '#9a9186', 0, 14, 0); // the ring, its coping, courses
  for (const d of [-1, 1]) kBox(d * .13, 0, .07, .012, .012, .34, '#7a5a44', M_PLANK);
  kLog([-.15, 0, .33], [.15, 0, .33], .016, '#5f4636', '#8a6a4c', M_PLANK); if (lod) { kBeam([.15, 0, .33], [.15, .04, .33], .004, K_IRON); kBeam([.15, .04, .33], [.15, .04, .29], .004, K_IRON); kBox(.15, .04, .28, .006, .006, .02, '#6b5040', M_PLANK); } // the windlass and its crank
  if (lod) { kBeam([0, 0, .32], [0, 0, .22], .002, '#c9b48a'); kCyl(0, 0, .18, .025, .04, '#6b5040', M_PLANK, 8, '#4f9cbc'); kCyl(0, 0, .2, .027, .004, K_IRON, 0, 8, 0); } // rope and bucket
  kGable(-.19, .19, -.13, .13, .4, .14, st.roof, { wall: st.wall, ov: .02, noGut: 1 });
  if (lod) { kCyl(.2, .18, .006, .03, .05, '#6b5040', M_PLANK, 8, '#4f9cbc'); kBench(-.18, .2, .006, 1); }
};
GL_MODEL.granary = function (B, st) { // a round store up on staddle stones (the rats can't climb them), boarded, under a steep roof; a ladder to its door
  kSetB(B); const lod = KF.lod, wall = mix(st.wall, '#c9a77a', .5), wm = glWallMat(B) === M_PLASTER ? M_PLANK : glWallMat(B);
  for (const [s, f] of [[-.12, -.12], [.12, -.12], [-.12, .12], [.12, .12], [0, -.17], [0, .17], [-.17, 0], [.17, 0]]) { kCone(s, f, 0, .025, .08, '#a49c90', 8, M_STONE, .016); kCyl(s, f, .08, .04, .02, '#a49c90', M_STONE, 8); } // staddle stones, capped
  kCyl(0, 0, .1, .21, .02, '#6b5040', M_PLANK, 14); kCyl(0, 0, .12, .2, .22, wall, wm, 14, 0);
  if (lod) for (let q = 0; q < 28; q++) { const a = q / 28 * TAU; kBox(Math.cos(a) * .201, Math.sin(a) * .201, .12, .003, .003, .22, shade(wall, .82), M_PLANK); } // the boards' battens
  kCone(0, 0, .3, .27, .06, shade(st.roof, .9), 14, -1, .25); kCone(0, 0, .34, .25, .3, st.roof, 14); kBlob(0, 0, .65, .02, .02, '#8a6a3a', 0);
  kBox(0, .2, .12, .04, .008, .1, '#5a4a40', M_PLANK); if (lod) for (const d of [-1, 1]) kBeam([d * .03, .34, 0], [d * .03, .21, .13], .004, '#6b5040', M_PLANK);
  if (lod) for (let q = 0; q < 3; q++) kBeam([-.03, .34 - q * .045, .015 + q * .045], [.03, .34 - q * .045, .015 + q * .045], .003, '#6b5040', M_PLANK);
  if (lod) for (const [s, f] of [[.26, .26], [.3, .2], [-.28, .26]]) kBlob(s, f, .02, .03, .025, '#d8c49a', 0); // sacks of grain
};
GL_MODEL.shrine = function (B, st) { // stone steps, a white pillar with a niche, a pointed roof, candles, flowers, an offering bowl
  kSetB(B); const lod = KF.lod;
  kBox(0, 0, 0, .28, .28, .035, '#d6cfc3', M_STONE); kBox(0, 0, .035, .2, .2, .03, '#e2dbcf', M_STONE);
  kBox(0, 0, .065, .075, .075, .62, '#ece6da', M_STONE); if (lod) for (const y of [.12, .62]) kBox(0, 0, .065 + y, .082, .082, .014, '#d8d0c2', M_STONE);
  kBox(0, .07, .28, .032, .01, .1, '#4a4038'); kBox(0, .07, .29, .012, .008, .04, '#e8d27a', 0, 3); // the niche, a little figure glowing in it
  kHip(-.08, .08, -.08, .08, .7, .17, st.accent, { ov: .01, noGut: 1, fin: 1 });
  for (const [s, f] of [[.1, .22], [-.12, .22], [.16, .14]]) { kCyl(s, f, .065, .008, .03, '#f2ece0', 0, 6); kBox(s, f, .095, .004, .004, .008, '#ffd27a', 0, 3); } // candles
  if (lod) { for (let k = 0; k < 4; k++) kBlob(-.16 + k * .07, .25, .07, .015, .012, FLOWER_C[(k + B.id) % FLOWER_C.length], 0); kCyl(.05, .24, .065, .025, .012, '#b5653f', M_ROOF, 10, '#c9a447'); } // flowers left, an offering bowl
};
GL_MODEL.watchstone = function (B, st) { // a tall pale obelisk on its steps, carved bands, a gilded cap, a glowing teal stone; posts and a chain round it
  kSetB(B); const lod = KF.lod;
  kBox(0, 0, 0, .3, .3, .04, '#d2cabd', M_STONE); kBox(0, 0, .04, .22, .22, .04, '#dcd4c8', M_STONE); kBox(0, 0, .08, .12, .12, .06, '#e4ddd2', M_STONE);
  kCone(0, 0, .14, .095, 1.2, '#e9e3d8', 4, M_STONE, .07); // (four sides, tapering)
  if (lod) for (const y of [.35, .7, 1.05]) kCone(0, 0, .14 + y, .095 - y / 1.2 * .025 + .004, .02, '#d8cfc0', 4, M_STONE, .095 - (y + .02) / 1.2 * .025 + .004);
  kHip(-.05, .05, -.05, .05, 1.34, .16, '#d6b85a', { ov: 0, noGut: 1, mat: 0, bare: 1 });
  kBox(0, .09, 1.0, .03, .006, .03, '#5fd0c9', 0, 3);
  if (lod) { for (const [s, f] of [[-.28, -.28], [.28, -.28], [.28, .28], [-.28, .28]]) { kBox(s, f, 0, .01, .01, .08, '#3a3d42'); kBlob(s, f, .085, .012, .01, '#c9a447', 0); }
    for (const [a, b] of [[[-.28, -.28], [.28, -.28]], [[.28, -.28], [.28, .28]], [[.28, .28], [-.28, .28]], [[-.28, .28], [-.28, -.28]]]) kBeam([a[0], a[1], .07], [b[0], b[1], .07], .0025, '#3a3d42'); }
};
