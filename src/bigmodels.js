/* ============================== the big ones on their lots: what would really be far bigger than a house ============================== */
// sim.js FP_BIG gives these a lot of their own (placed whole at the edge of town, or spread onto later): the launch complex
// and the space elevator 3×3, the airfield 4×2 (its runway down the long side: air.js afGeo), the works, the power station,
// the climate engine and the garden dome 2×2, the warehouse 2×1. On a single plot (an older world's, or where no lot was
// to be had yet) they keep their one-tile models. The works, the power station and the warehouse are built anew for the
// lot; the landmarks with no people-sized parts (the climate engine, the dome, the elevator) are their own models grown to
// the lot (bigScaled). Smoke rises from the big stacks (SMOKE_BIG, read by gl.js smokeAt).
function bigScaled(B, st, fn, wm, hm) { // a one-tile model, built at the middle of the lot and grown to it (normals follow)
  const sx = GLB.x, sz = GLB.y, [lx, lz] = glLot(B), v0 = GLB.v.length, s0 = GLB.smk ? GLB.smk.length : 0;
  GLB.x = lx; GLB.y = lz;
  try { fn(B, st); hScale(v0, s0, hm, wm); } finally { GLB.x = sx; GLB.y = sz; }
}
const BIG_TF_H = 4.7; // the climate engine's misting crown on its lot (fx3d.js)
GL_BIG.terraformer = (B, st) => bigScaled(B, st, GL_MODEL.terraformer, 1.9, 1.5);
GL_BIG.dome = (B, st) => bigScaled(B, st, GL_MODEL.dome, 2.1, 1.6);
GL_BIG.elevator = (B, st) => bigScaled(B, st, GL_MODEL.elevator, 2.7, 1.5);
// where the big stacks smoke: [u, v, height units] from the lot's corner tile, through the lot's frame (cBig)
const bigAt = (B, pts) => { const { a, d } = glFacing(B), [lx, lz] = glLot(B); return pts.map(([s, f, h]) => [lx - B.x + a[0] * s + d[0] * f, lz - B.y + a[1] * s + d[1] * f, h]); };
const SMOKE_BIG = { works: B => bigAt(B, [[.62, -.72, 60], [.86, -.4, 52]]), power: B => bigAt(B, [[.52, -.72, 62], [.84, -.72, 62], [.55, .5, 26]]) };

/* ---------- the launch complex: the pad and its rocket, the service tower, lightning masts, tanks, the assembly building ---------- */
GL_BIG.launchpad = function (B, st) {
  const [lx, lz] = glLot(B); kSet(lx, lz, [1, 0, 0], [0, 0, 1], B.id); const lod = KF.lod, red = '#c8553d', conc = '#c4c1ba', T = 3.1;
  kBox(0, 0, 0, 1.46, 1.46, .01, '#b9b6ae', M_STONE); kBox(0, 0, .01, .5, .5, .07, conc, M_STONE); kBox(0, .62, .005, .14, .4, .006, '#3a3634'); // the apron, the mount, the flame trench
  kBox(0, .9, .01, .16, .06, .1, '#8a8680', M_STONE); // the flame deflector
  for (const s of [-.05, .05]) kBox(s, -.95, .011, .025, .52, .002, '#a49d92', M_STONE); // the crawlerway out to the assembly building
  if (B.rk !== 0) { const y = .08, H = 2.4, r = .1; kCyl(0, 0, y, r, H, '#f4f4f2', 0, 16); kCone(0, 0, y + H, r, .38, st.accent, 16, 0); // the rocket
    for (const yy of [.5, 1.3, 2.1]) kCyl(0, 0, y + yy, r + .002, .03, '#2e2e30', 0, 16, 0);
    for (const s of [-1, 1]) { kCyl(s * .15, 0, y, .05, 1.1, '#f0eee8', 0, 10); kCone(s * .15, 0, y + 1.1, .05, .14, '#e8e4dc', 10, 0); } // strap-on boosters
    for (let q = 0; q < 4; q++) { const a = q / 4 * TAU + .8; kOB(Math.cos(a) * .12, Math.sin(a) * .12, y + .14, [Math.cos(a) * .04, Math.sin(a) * .04, 0], [-Math.sin(a) * .004, Math.cos(a) * .004, 0], [0, 0, .12], st.accent); } }
  const tx = .34; for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) kBox(tx + a * .07, b * .07, .08, .009, .009, T, red); // the service tower
  for (let k = 1; k < (lod ? 16 : 8); k++) { const y = .08 + k * T / (lod ? 16 : 8); for (const [p, q] of [[[-1, -1], [1, -1]], [[1, -1], [1, 1]], [[1, 1], [-1, 1]], [[-1, 1], [-1, -1]]]) kBeam([tx + p[0] * .07, p[1] * .07, y], [tx + q[0] * .07, q[1] * .07, y], .004, red); }
  for (const y of [.8, 1.6, 2.3]) kBeam([tx - .07, 0, y], [.1, 0, y], .012, red); // the access arms
  kBox(tx, 0, T + .08, .09, .09, .04, '#9aa3ad'); kBox(tx, 0, T + .12, .012, .012, .012, '#ff4d4d', 0, 3);
  const masts = [[-.85, -.6], [.85, -.6], [0, 1.05]]; // lightning masts, wired together over the pad
  for (const [s, f] of masts) { kCone(s, f, 0, .04, 3.6, '#d8dce0', 8, 0, .015); kBox(s, f, 3.6, .015, .015, .015, '#ff4d4d', 0, 3); }
  for (let k = 0; k < 3; k++) { const [s0, f0] = masts[k], [s1, f1] = masts[(k + 1) % 3]; kBeam([s0, f0, 3.55], [(s0 + s1) / 2, (f0 + f1) / 2, 3.1], .002, '#3a3d41'); kBeam([(s0 + s1) / 2, (f0 + f1) / 2, 3.1], [s1, f1, 3.55], .002, '#3a3d41'); }
  for (const [s, f, c] of [[1.12, -.95, '#f2f2f0'], [1.12, -.55, '#f2f2f0'], [1.12, .95, '#e9eef2']]) { kCyl(s, f, 0, .13, .06, '#9aa3ad', 0, 10); kDome(s, f, .06, .14, .14, c); kDome(s, f, .06, .14, .14, c); } // fuel and oxidiser spheres
  kBox(-1.12, 1.12, 0, .006, .006, .55, '#8c939b'); kCyl(-1.12, 1.12, .55, .13, .2, '#e8ecef', 0, 12); // the deluge water tower
  const vb = [-.95, -1.0]; kBox(vb[0], vb[1], 0, .42, .38, 1.55, '#e8e8e4', M_PLASTER); kBox(vb[0], vb[1] + .381, 0, .15, .003, 1.4, '#9aa3ad'); // the assembly building and its tall door
  kBox(vb[0] - .3, vb[1] + .382, .9, .07, .002, .045, st.accent); if (lod) { for (let y = .2; y < 1.4; y += .2) kBox(vb[0], vb[1] + .384, y, .15, .002, .004, '#7f878f'); kWins(vb[0] + .2, vb[0] + .42, vb[1] + .38, .05, .1, 3, 2, { ty: 'steel' }, null, 3); }
  kEDome(1.0, 1.0, 0, .22, .16, .12, '#d6d3cc', M_STONE); if (lod) { kBox(1.0, 1.16, 0, .05, .004, .05, '#3a3d42'); for (const s of [.7, .8, .9]) kBox(s, .82, 0, .004, .004, .25, '#9aa3ad'); } // the blockhouse
};

/* ---------- the airfield: a runway the length of the lot, a taxiway, the apron, a terminal, the tower, hangars ---------- */
GL_BIG.airfield = function (B, st) {
  const [lx, lz] = glLot(B), L = fpW(B) / 2, D = fpH(B) / 2; kSet(lx, lz, [1, 0, 0], [0, 0, 1], B.id); // (s along x, the runway's way: air.js)
  const lod = KF.lod, jet = hasTech('computing'), fut = hasTech('hover'), rf = D - .42, ac = jet ? '#c9cbcc' : '#707378', g = afGeo(B), rwF = g.y - lz;
  kBox(0, 0, 0, L - .02, D - .02, .003, '#8fb070');
  kBox(0, rwF, .003, L - .06, .17, .004, ac, M_ASPHALT); for (let k = 0; k < 12; k++) kBox(-L + .4 + k * (2 * L - .8) / 11, rwF, .0075, .06, .008, .001, '#f5f5f0'); // the runway and its centre line
  for (const sg of [-1, 1]) { for (let q = 0; q < 5; q++) kBox(sg * (L - .14), rwF - .12 + q * .06, .0075, .04, .012, .001, '#f5f5f0'); for (let k = 0; k <= 10; k++) kBox(-L + .1 + k * (2 * L - .2) / 10, rwF + sg * .18, .008, .006, .006, .006, k === 0 || k === 10 ? '#9dff9d' : '#ffe9a8', 0, 3); } // thresholds, edge lights
  kBox(-.2, rwF - .34, .003, L - .3, .06, .004, ac, M_ASPHALT); kBox(-L + .2, rwF - .17, .003, .06, .2, .004, ac, M_ASPHALT); // the taxiway
  const apS = [-1.55, .55], apF = [-.62, .2]; kBox((apS[0] + apS[1]) / 2, (apF[0] + apF[1]) / 2, .003, (apS[1] - apS[0]) / 2, (apF[1] - apF[0]) / 2, .005, jet ? '#d6d6d2' : '#a9aaab', M_ASPHALT); // the apron
  if (lod) for (const s of [-1.1, -.3]) { kBox(s, -.3, .0085, .004, .25, .001, '#f2d64a'); kBox(s - .1, -.08, .0085, .1, .004, .001, '#f2d64a'); }
  // the terminal along the back
  const tS = [-1.95, -.15], tF = [-.98, -.66], H = jet ? .26 : .17, tw = fut ? '#f4f6f7' : mix(st.wall, '#e8ecef', .4);
  if (fut) { kEDome((tS[0] + tS[1]) / 2, (tF[0] + tF[1]) / 2, 0, (tS[1] - tS[0]) / 2, (tF[1] - tF[0]) / 2 + .03, .32, '#eef3f6', M_PLASTER); kBox((tS[0] + tS[1]) / 2, tF[1] + .02, 0, (tS[1] - tS[0]) / 2 - .05, .02, .2, '#9fd0e4', M_GLASS, .5); kBox((tS[0] + tS[1]) / 2, tF[1] + .04, .2, (tS[1] - tS[0]) / 2 - .05, .004, .008, '#7fe8e0', 0, 3); }
  else { kPlinth(tS[0], tS[1], tF[0], tF[1], .015); kBox((tS[0] + tS[1]) / 2, (tF[0] + tF[1]) / 2, .015, (tS[1] - tS[0]) / 2, (tF[1] - tF[0]) / 2, H - .015, tw, M_PLASTER);
    kWins(tS[0], tS[1], tF[1], .02, H - .04, 1, jet ? 12 : 8, { ty: jet ? 'glass' : 'modern', hk: .7 }, null, 3); kFlat(tS[0], tS[1], tF[0], tF[1], H, tw, .02);
    if (lod) { kBox(-1.05, tF[1] + .01, H - .05, .25, .004, .03, st.accent); kWins(tS[0], tS[1], tF[0], .02, H - .04, 1, 8, { ty: 'modern', back: 1 }, null, 9); } }
  if (jet) for (const s of [-1.45, -.65]) { kBox(s, tF[1] + .12, .1, .022, .12, .03, '#d8dce0'); kBox(s, tF[1] + .24, 0, .01, .01, .1, '#8c939b'); } // jet bridges
  // the control tower
  const cs = .45, cf = -.78; kCyl(cs, cf, 0, .07, .85, tw, M_PLASTER, 12); kCyl(cs, cf, .85, .13, .12, '#33475a', 0, 12, '#2a2e33', kLit(5)); kCyl(cs, cf, .97, .14, .02, tw, 0, 12); kBox(cs, cf, .99, .004, .004, .12, '#9aa3ad'); kBox(cs, cf, 1.11, .01, .01, .01, '#ff4d4d', 0, 3);
  // hangars: arched roofs, big doors to the apron
  for (const [hs, hf] of [[1.3, -.55], [1.3, .02]].slice(0, jet ? 2 : 1)) { const R = .2, W2 = .4; kBox(hs, hf, 0, W2, R, .1, shade(st.roof, 1.1), M_PLASTER); kCtr(hs, hf, .1);
    for (let q = 0; q < 8; q++) { const a0 = q / 8 * Math.PI, a1 = (q + 1) / 8 * Math.PI, P = (s, a) => [s, hf + Math.cos(a) * R, .1 + Math.sin(a) * R * .7]; kQ(P(hs - W2, a0), P(hs + W2, a0), P(hs + W2, a1), P(hs - W2, a1), jet ? '#b9c0c6' : shade(st.roof, .9), M_SLATE); }
    kBox(hs - W2 - .002, hf, 0, .004, R - .02, .18, '#4a4f56'); for (let q = 0; q < 8; q++) { const a = (q + .5) / 8 * Math.PI; kBox(hs - W2 - .004, hf + Math.cos(a) * R, .1, .002, .02, Math.sin(a) * R * .7, '#4a4f56'); } }
  kCyl(1.85, -.85, 0, .06, .1, '#e8ecef', 0, 10); kCyl(1.72, -.85, 0, .06, .1, '#e8ecef', 0, 10); // fuel
  kBox(1.9, rwF - .3, 0, .003, .003, .14, '#9aa3ad'); kCone(1.92, rwF - .3, .14, .014, .06, '#ff7a2a', 6, 0); // the windsock
  if (lod) { for (const s of [-1.7, -.9, -.2]) cLampPost(s, -.2, .14); kCrate(.1, -.55, 0, .02); kBox(-.1, -.5, 0, .04, .025, .03, '#e0a43a'); } // floodlights, baggage carts
};

/* ---------- the works on its lot: a sawtooth shop, the boiler house and its stacks, an office block, the yard and its crane ---------- */
GL_BIG.works = function (B, st) {
  cBig(B); const brick = hasTech('brick'), wc = brick ? mix(st.wall, '#a5573f', .55) : st.wall, wm = brick ? M_BRICK : glWallMat(B), lod = KF.lod, rc = st.roof;
  const s0 = -.92, s1 = .42, fB = -.88, fD = .3, H = .34, wty = kWinTy() === 'glass' ? 'modern' : hasTech('concrete') ? 'modern' : 'sash';
  kPlinth(s0, s1, fB, fD, .03, '#8f8a86'); kBox((s0 + s1) / 2, (fB + fD) / 2, .03, (s1 - s0) / 2, (fD - fB) / 2, H - .03, wc, wm);
  kWins(s0, s1, fD, .03, H - .05, 1, 9, { ty: wty, arch: brick ? 'seg' : null, wall: wc, hk: .6 }, k => k === 3 || k === 6, 0);
  for (const s of [-.4, .05]) { kBox(s, fD + .002, .03, .07, .004, .22, '#4a4f56'); if (lod) for (let y = .05; y < .24; y += .025) kBox(s, fD + .006, y, .07, .002, .002, '#3a3d42'); } // roller doors
  kWalls(s0, s1, fB, fD, (a, b, ff, k) => kWins(a + .05, b - .05, ff, .03, H - .05, 1, 6, { ty: 'sash', back: 1, hk: .6 }, null, 10 + k), 14);
  const n = 6, tw = (s1 - s0) / n; for (let k = 0; k < n; k++) { const s = s0 + tw * (k + .5); kCtr(s, (fB + fD) / 2, 0); // the sawtooth roof, north lights glazed
    kQ([s - tw / 2, fB, H], [s - tw / 2, fD, H], [s + tw / 2, fD, H + .16], [s + tw / 2, fB, H + .16], shade(rc, .95), roofMat(gcol(rc)));
    kQ([s + tw / 2, fB, H + .16], [s + tw / 2, fD, H + .16], [s + tw / 2, fD, H], [s + tw / 2, fB, H], shade(st.glass, .8), 0, kLit(30 + k) * .6); for (const f of [fB, fD]) kT([s - tw / 2, f, H], [s + tw / 2, f, H], [s + tw / 2, f, H + .16], wc, wm); }
  // the boiler house and two stacks (smoke: SMOKE_BIG)
  kBox(.72, -.6, 0, .24, .3, .5, shade(wc, .95), wm); kGable(.47, .97, -.9, -.3, .5, .12, rc, { wall: wc, wm }); kWins(.5, .94, -.3, .05, .38, 2, 2, { ty: 'sash', arch: 'round' }, null, 40);
  iStack(.62, -.72, .5, 60 * ZS, .07); iStack(.86, -.4, .5, 52 * ZS, .06);
  // the office block at the gate
  const oS = [-.95, -.45], oF = [.45, .85]; kPlinth(oS[0], oS[1], oF[0], oF[1], .02); kBox(-.7, .65, .02, .25, .2, .34, brick ? '#c9a888' : st.wall, M_PLASTER);
  kWalls(oS[0], oS[1], oF[0], oF[1], (a, b, ff, k) => kWins(a, b, ff, .04, .14, 2, 4, { ty: wty, hk: .5 }, null, 60 + k * 9), 14); kFlat(oS[0], oS[1], oF[0], oF[1], .36, '#cfc6b4', .02); kDoor(-.7, oF[1], .04, .1, '#4a3a30', { steps: 1 });
  if (lod) kBox(-.7, oF[1] + .004, .3, .14, .004, .025, st.accent);
  // the yard: a gantry crane over stacked castings and crates, drums, a loading bay
  kBox(.3, .62, 0, .62, .34, .004, '#9b968c', M_STONE);
  for (const s of [-.15, .85]) for (const f of [.35, .9]) kBox(s, f, 0, .012, .012, .38, '#c8603a');
  for (const s of [-.15, .85]) kBeam([s, .35, .38], [s, .9, .38], .012, '#c8603a'); for (const f of [.35, .9]) kBeam([-.15, f, .4], [.85, f, .4], .014, '#c8603a');
  if (lod) { for (let q = 0; q < 4; q++) kBarrel(.0 + q * .055, .5, 0, .022, .05, '#4a5560'); kCrate(.55, .75, 0, .035, '#8a7a68'); kCrate(.6, .55, 0, .03); kCrate(.62, .58, .048, .025); for (let q = 0; q < 3; q++) kBox(.25 + q * .08, .78, 0, .03, .06, .025 + q * .01, '#5a5f66'); }
  kFence([[-.98, .95], [-.4, .95]], .05, '#5a5f66', 'rail'); kFence([[-.1, .95], [.98, .95], [.98, -.98]], .05, '#5a5f66', 'rail');
};

/* ---------- the power station: the turbine hall, the boiler house, twin stacks, a cooling tower, the switchyard ---------- */
GL_BIG.power = function (B, st) {
  cBig(B); const brick = hasTech('brick'), wc = brick ? mix(st.wall, '#a5573f', .5) : st.wall, wm = brick ? M_BRICK : glWallMat(B), lod = KF.lod, rc = st.roof;
  const s0 = -.95, s1 = .25; // the turbine hall: tall arched windows, pilasters, a long roof
  kPlinth(s0, s1, -.25, .32, .04, '#8f8a86'); kBox((s0 + s1) / 2, .035, .04, (s1 - s0) / 2, .285, .62, wc, wm);
  kWins(s0, s1, .32, .06, .52, 1, 7, { ty: 'sash', arch: 'round', hk: .62, yk: .14 }, null, 10); kPilasters(s0, s1, 7, .32, .04, .66, shade(wc, .88), .02); kCornice(s0, s1, -.25, .32, .66, '#cfc6b4', { br: 0 });
  kGable(s0, s1, -.25, .32, .69, .16, rc, { wall: wc, wm }); if (lod) kBox((s0 + s1) / 2, .035, .85, (s1 - s0) / 2 - .05, .03, .03, '#9aa3ad');
  kDoor(-.35, .32, .07, .26, '#4a4f56', { ty: 'plank' });
  kBox((s0 + s1) / 2, -.6, 0, (s1 - s0) / 2, .35, .9, shade(wc, .93), wm); kFlat(s0, s1, -.95, -.25, .9, shade(wc, .9), .03); // the boiler house behind, taller
  kWalls(s0, s1, -.95, -.25, (a, b, ff, k) => k === 0 ? null : kWins(a + .04, b - .04, ff, .1, .7, 2, 5, { ty: 'sash', back: 1, hk: .5 }, null, 30 + k), 14);
  iStack(.52, -.72, 0, 62 * ZS, .09, '#a39a92'); iStack(.84, -.72, 0, 62 * ZS, .09, '#a39a92'); // (smoke: SMOKE_BIG)
  kCone(.55, .5, 0, .34, .62, '#d6d3cc', 18, M_STONE, .24); kCone(.55, .5, .62, .24, .3, '#d6d3cc', 18, M_STONE, .27); if (lod) kCyl(.55, .5, .91, .272, .015, '#bfbab2', 0, 18, 0); // the cooling tower (steam: SMOKE_BIG)
  for (const s of [-.9, -.6, -.3]) { kBox(s, .7, 0, .004, .004, .3, '#8c939b'); kBox(s, .7, .3, .06, .004, .004, '#8c939b'); kBox(s, .9, 0, .004, .004, .3, '#8c939b'); kBox(s, .9, .3, .06, .004, .004, '#8c939b'); } // the switchyard
  if (lod) { for (const d of [-.05, .05]) { kBeam([-.9 + d, .7, .3], [-.3 + d, .7, .3], .0012, '#2a2a2a'); kBeam([-.9 + d, .9, .3], [-.3 + d, .9, .3], .0012, '#2a2a2a'); } for (const s of [-.75, -.45]) kBox(s, .8, 0, .06, .05, .09, '#6b7380'); kFence([[-.98, .6], [-.98, .98], [-.2, .98], [-.2, .6]], .05, '#8c939b', 'rail'); }
  kCone(.85, -.15, 0, .18, .12, '#2e2c2a', 10, 0); // the coal heap
};

/* ---------- the warehouse on its 2×1 lot: a long store four floors high, loading doors, hoists; later a steel shed with bays ---------- */
GL_BIG.warehouse = function (B, st) {
  cBig(B); const lod = KF.lod;
  if (hasTech('computing')) { const c = '#c9ccd0'; kBox(0, -.08, 0, .95, .32, .26, c, M_PLASTER); kFlat(-.95, .95, -.4, .24, .26, '#b8bcc2', .01); kBox(0, .245, .2, .95, .004, .03, st.accent);
    for (let k = 0; k < 7; k++) { const s = -.81 + k * .27; kBox(s, .245, .0, .09, .006, .15, '#4a4f56'); if (lod) kBox(s, .3, 0, .1, .05, .03, '#8c939b'); } // loading bays
    if (lod) for (const s of [-.6, .1]) { kBox(s, .44, .02, .14, .045, .06, '#e8e8e4'); kBox(s + .18, .44, .02, .04, .045, .07, '#3f7fb0'); } return; } // (and a lorry or two)
  const [wc, wm] = kWall(B, st), s0 = -.94, s1 = .94, fB = -.38, fD = .26, H = .46;
  kPlinth(s0, s1, fB, fD, .04, '#a59c8e'); kBox(0, (fB + fD) / 2, .04, .94, (fD - fB) / 2, H - .04, wc, wm);
  kWins(s0, s1, fD, .2, .08, 3, 12, { ty: 'sash', hw: .025, hk: .55 }, k => k % 4 === 1, 0); kWins(s0, s1, fB, .06, .1, 4, 10, { back: 1, hw: .025 }, null, 20);
  for (const s of [-.62, -.02, .58]) { kBox(s, fD - .02, .04, .06, .025, .17, '#2a2420'); kBox(s, fD + .003, .04, .055, .004, .16, shade(st.trim, .75), M_PLANK);
    for (let y = .24; y < H - .05; y += .1) { kBox(s, fD + .003, y, .035, .004, .06, shade(st.trim, .75), M_PLANK); } // a door on every floor, for the hoist
    kGableF(s - .08, s + .08, fD - .1, fD + .06, H + .02, .08, st.roof, { wall: wc, wm }); kBeam([s, fD + .06, H + .06], [s, fD + .14, H + .06], .007, I_TIMBER, M_PLANK); if (lod) { kBeam([s, fD + .13, H + .06], [s, fD + .13, .2], .0015, '#3a3028'); kCrate(s, fD + .13, .16, .02); } }
  kGable(s0 - .01, s1 + .01, fB - .01, fD + .01, H, .18, st.roof, { wall: wc, wm });
  if (lod) { for (let q = 0; q < 5; q++) kCrate(-.85 + q * .07, .4, 0, .025, q % 2 ? '#9b7a54' : '#b58d62'); for (let q = 0; q < 3; q++) kBarrel(.75 + q * .05, .4, 0, .02, .045); kLantern(-.32, fD, .3); kLantern(.28, fD, .3); }
};
