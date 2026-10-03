/* ============================== homes: every house tier, modelled properly ============================== */
// The houses of the valley built from the kit (kit.js), from the first canvas shelter by the pod to the arcologies:
// a shelter of salvaged canvas on crossed poles by its fire, a round wattle hut under thatch, a cottage with its
// garden, fence and gate, a townhouse (timber-framed and jettied while the old styles last), the worker house
// (house.js), a modern townhouse, blocks of flats (iron balconies and mansards, then concrete, glass and planted
// balconies), glass towers and the arcologies. Each faces its street and joins its terrace where the row allows.
// The styles that reshape houses (round, organic, tiered, tall, low; dome, cone and pyramid roofs) still come from the shared
// art (buildings.js); the public buildings and workplaces keep their own forms whatever the style.
function hFits(B) { // a model for this house? (the reshaping styles keep the shared art; the first two tiers ignore styles)
  if (B.tier <= 1) return true;
  const st = S.styles[B.style]; return !(st && (st.shape === 'round' || st.shape === 'organic' || st.shape === 'tiered' || SHAPE_HM[st.shape] || st.roofK === 'dome' || st.roofK === 'cone' || st.roofK === 'pyramid'));
}
GL_MODEL.house = function (B, st) {
  if (!hFits(B)) return false;
  const t = B.tier; st = houseTint(st, B);
  if (t === 4 && whFits(B, st)) return glWorkerHouse(B, st);
  return [hShelter, hHut, hCottage, hTown, hRow4, hFlats, hTower, hArco][Math.min(7, t)](B, st);
};
function hSet(B) { // the frame: along the street, out towards it (kept as the worker house finds it, so mixed rows agree)
  const J = houseJoin(B), U = (J ? J.a : houseAx(B)) === 'u', X = GLB.x, Z = GLB.y, fx = U ? 0 : 1, fz = U ? 1 : 0;
  const sg = inb(X + fx, Z + fz) && netTile(idx(X + fx, Z + fz)) ? 1 : inb(X - fx, Z - fz) && netTile(idx(X - fx, Z - fz)) ? -1 : 1;
  kSet(X, Z, U ? [1, 0, 0] : [0, 0, 1], [fx * sg, 0, fz * sg], B.id); return J;
}
const hRoofline = (B, t) => hash2(houseAx(B) === 'u' ? B.y : B.x, t * 7 + B.sid, 57); // one street, one roofline (more or less)
function hStack(wm, wc) { return wm === M_PLASTER || wm === M_PLANK ? [mix(wc, '#9a8f84', .25), M_PLASTER] : wm === M_STONE ? [wc, M_STONE] : ['#a0604a', M_BRICK]; }
function hSmoke(s, f, y) { if (!GLB.lod && GLB.smk) GLB.smk.push(kP(s, f, y)); }

/* ---------- tier 0: a shelter of salvaged canvas on crossed poles, a fire before it ---------- */
function hShelter(B) {
  kSetB(B); const v = B.var || 0, can = v < .5 ? '#e89f6b' : '#d9dde6', dk = shade(can, .82), pole = '#8a6a4c', lod = KF.lod;
  const w = .2, H = .38, fb = -.26, fd = .12, mw = w * .5 - .012, mh = H * .5 - .018;
  kCtr(0, (fb + fd) / 2, .08);
  for (const d of [-1, 1]) { kQ([d * w, fb, 0], [d * w, fd, 0], [d * mw, fd, mh], [d * mw, fb, mh], can); kQ([d * mw, fb, mh], [d * mw, fd, mh], [0, fd, H], [0, fb, H], d < 0 ? dk : can); } // the canvas sags between the poles
  kT([-w, fb, 0], [w, fb, 0], [0, fb, H], dk); // closed at the back
  kT([-w, fd, 0], [-w * .45, fd, 0], [0, fd, H], can); kT([w * .45, fd, 0], [w, fd, 0], [0, fd, H], can); // the front, its door flaps rolled back
  kCtr(0, fd + .2, .1); kT([-w * .45, fd - .006, 0], [w * .45, fd - .006, 0], [0, fd - .006, H * .96], '#2a2420');
  for (const d of [-1, 1]) kLog([d * w * .45, fd + .008, .01], [d * .012, fd + .008, H * .93], .011, dk, shade(can, .7), 0);
  kBeam([0, fb - .04, H + .006], [0, fd + .04, H + .006], .007, pole, M_BARK); // the ridge pole, on crossed poles
  for (const f of [fb, fd]) for (const d of [-1, 1]) kBeam([d * (w + .012), f, 0], [-d * .035, f, H + .045], .006, pole, M_BARK);
  if (lod) { for (const [a, b, c, e] of [[0, fd + .04, 0, fd + .17], [0, fb - .04, 0, fb - .17]]) { kBeam([a, b, H], [c, e, 0], .0012, '#cbb98f'); kBox(c, e, 0, .005, .005, .018, '#6b5040', M_PLANK); } // guy ropes and pegs
    for (const d of [-1, 1]) { kBeam([d * mw, (fb + fd) / 2, mh], [d * (w + .13), (fb + fd) / 2, 0], .0012, '#cbb98f'); kBox(d * (w + .13), (fb + fd) / 2, 0, .005, .005, .018, '#6b5040', M_PLANK); } }
  // the fire: a ring of stones, embers, logs, and (near) a tripod with a pot
  const fs = .24, ff = .3;
  for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; kBlob(fs + Math.cos(a) * .055, ff + Math.sin(a) * .055, .012, .016, .012, '#7d7066', M_STONE); }
  kBox(fs, ff, 0, .035, .035, .01, '#e98b4a', 0, 3);
  for (const a of [.3, 2.4, 4.3]) kBeam([fs + Math.cos(a) * .045, ff + Math.sin(a) * .045, .008], [fs - Math.cos(a) * .01, ff - Math.sin(a) * .01, .04], .007, '#3a2a20', M_BARK);
  if (lod) { for (const a of [0, 2.1, 4.2]) kBeam([fs + Math.cos(a) * .07, ff + Math.sin(a) * .07, 0], [fs, ff, .15], .003, pole, M_BARK);
    kBeam([fs, ff, .15], [fs, ff, .1], .001, K_IRON); kCyl(fs, ff, .07, .022, .03, '#3a3a3e', 0, 8, '#2a2a2e'); }
  hSmoke(fs, ff, .06);
  kLog([-.3, .28, .02], [-.12, .36, .02], .02, '#7a5a40', '#c9a77a'); // a log to sit on
  kBox(-.3, -.22, 0, .05, .04, .055, '#c9ced6', 0); if (lod) kBox(-.3, -.22, .03, .052, .042, .008, '#e5874f'); // a crate salvaged from the pod
  if (v > .3) kOB(-.32, -.04, .07, [.002, .05, 0], [0, 0, .07], [.012, 0, 0], '#b9c0ca'); // and a hull panel leaning on it
  if (lod) { kBox(.26, -.2, 0, .004, .004, .12, pole, M_BARK); kBox(.36, -.2, 0, .004, .004, .12, pole, M_BARK); kBeam([.25, -.2, .115], [.37, -.2, .115], .003, pole, M_BARK); kBox(.31, -.2, .05, .04, .002, .06, '#b89a74', 0); } // a rack, a hide drying on it
}

/* ---------- tier 1: a round hut, wattle and daub under a cone of thatch ---------- */
function hHut(B, st) {
  kSetB(B); const wall = mix(st.wall, '#b89470', .3), r = .22, h = .19, y1 = .025, rc = roofMat(gcol(st.roof)) === M_THATCH ? st.roof : '#c4a35e', lod = KF.lod, ye = y1 + h;
  kCyl(0, 0, 0, r + .014, y1, '#8f8578', M_STONE, 14); // a footing of stones
  kCyl(0, 0, y1, r, h, wall, M_PLASTER, 14, 0);
  if (lod) for (let y = y1 + .04; y < ye - .01; y += .045) kCyl(0, 0, y, r + .002, .005, shade(wall, .86), 0, 14, 0); // the weave showing through the daub
  kCone(0, 0, ye - .035, r + .11, .035, shade(rc, .85), 14, M_THATCH, r + .1); // the thatch: thick at the eaves
  kCone(0, 0, ye, r + .1, .26, rc, 14, M_THATCH);
  kCone(0, 0, ye + .23, .035, .07, shade(rc, .78), 8, M_THATCH); if (lod) kCyl(0, 0, ye + .225, .04, .012, '#7a6040', 0, 8, 0); // a topknot, bound
  hSmoke(0, 0, ye + .3);
  kBox(0, r - .012, y1, .045, .014, .14, '#2a2420'); // the doorway
  for (const d of [-1, 1]) kBox(d * .053, r - .004, y1, .008, .013, .15, K_WOOD, M_PLANK);
  kBox(0, r - .002, y1 + .145, .064, .015, .015, K_WOOD, M_PLANK);
  if (lod) kLog([-.045, r + .012, y1 + .135], [.045, r + .012, y1 + .135], .01, '#9a7a5a', '#8a6a4a', 0); // a hide curtain, rolled up
  kSide(1, () => { kBox(0, r - .008, y1 + .085, .025, .012, .04, '#2a2420'); if (lod) for (const d of [-.012, 0, .012]) kBox(d, r + .002, y1 + .085, .002, .003, .04, K_WOOD); }); // a small window, sticks across it
  for (let row = 0; row < 3; row++) for (let k = 0; k < 3 - row; k++) kLog([-.09 + row * .03 + k * .06 - .03, -r - .045, .018 + row * .032], [-.09 + row * .03 + k * .06 + .03, -r - .045, .018 + row * .032], .016, '#7a5a40', '#c9a77a'); // the woodpile
  if (lod) { kFence([[.22, .34], [.4, .34], [.4, .08], [.3, .02]], .05, '#7a5a40', 'rail'); // a pen
    kCyl(-.28, .16, 0, .03, .04, '#a8643f', M_ROOF, 8, '#3a2a20'); kCyl(-.33, .2, 0, .022, .03, '#9a5a3a', M_ROOF, 8, '#3a2a20'); // pots
    kCyl(-.27, .3, 0, .035, .02, '#8f8578', M_STONE, 10); kCyl(-.27, .3, .02, .03, .012, '#a39a8c', M_STONE, 10); } // a quern
}

/* ---------- tier 2: a cottage, its garden and its fence ---------- */
function hCottage(B, st) {
  hSet(B); const [wc, wm] = kWall(B, st), rc = st.roof, thatch = roofMat(gcol(rc)) === M_THATCH, lod = KF.lod, flatR = dsFlat();
  const wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), two = hk(B, 3) < .2, wing = hk(B, 4) < .4, wsg = hk(B, 8) < .5 ? -1 : 1;
  const L = .5 + (hk(B, 1) - .5) * .08, fD = .1, fB = -.22 + (hk(B, 2) - .5) * .04, H = two ? .36 : .25, rh = thatch ? .26 : .22;
  const ox = wing ? -wsg * .04 : 0, s0 = ox - L / 2, s1 = ox + L / 2, sc = ox, fc = (fB + fD) / 2;
  const door = WH_DOOR[(hk(B, 21) * WH_DOOR.length) | 0], dsg = hk(B, 20) < .5 ? -1 : 1, ds = sc + dsg * L * .17;
  const shut = hk(B, 10) < .4 && wty !== 'modern' ? SHUT[(hk(B, 11) * SHUT.length) | 0] : null;
  kPlinth(s0, s1, fB, fD, .03, wm === M_STONE ? shade(wc, .8) : '#a59c8e');
  kBox(sc, fc, .03, L / 2, (fD - fB) / 2, H - .03, wc, wm);
  if (wm !== M_PLANK) { kQuoins(s0, fB, fD, .03, H, wm === M_STONE ? shade(wc, 1.08) : K_STONE); kQuoins(s1, fB, fD, .03, H, wm === M_STONE ? shade(wc, 1.08) : K_STONE); }
  else if (lod) for (let s = s0 + .025; s < s1; s += .05) kBox(s, fD + .002, .03, .004, .003, H - .03, shade(wc, .82), M_PLANK); // battens on timber
  // the front: the door (in a porch, or under a hood) and windows either side, upstairs windows in a taller one
  const wy = .085, wh = .1, ww = .036;
  kDoor(ds, fD, .04, .16, door, { ty: wty === 'case' ? 'plank' : 'panel', steps: 1, hood: hk(B, 5) < .4 ? null : 'pent', roof: rc });
  if (hk(B, 5) < .4) { for (const d of [-1, 1]) kBox(ds + d * .065, fD + .1, 0, .007, .007, .2, K_TRIM, M_PLANK); // a porch on two posts
    kGableF(ds - .08, ds + .08, fD, fD + .12, .2, .07, rc, { wall: wc, wm, noGut: 1 }); if (lod) kBench(ds - .045, fD + .05, 0, 0); }
  const bays = [sc - dsg * L * .22], s2 = ds + dsg * .12; if (!wing && Math.abs(s2 - sc) < L / 2 - .045) bays.push(s2);
  bays.forEach((s, k) => kWin(s, fD, wy, ww, wh, k, { ty: wty, shut, box: hk(B, 30 + k) < .35 }));
  if (two) { kWins(s0 + .04, s1 - .04, fD, H - .14, .12, 1, 3, { ty: wty, hk: .55, yk: .1, hw: .03, shut }, null, 20); }
  kWins(s0 + .06, s1 - .06, fB, wy - .02, .2, 1, 2, { ty: wty, back: 1, hk: .5, hw: .03 }, null, 40);
  if (lod && !flatR) for (const [sd, s] of [[1, s1], [3, s0]]) if (!(wing && Math.sign(s - sc) === wsg)) kSide(sd, () => kWin(0, sd === 1 ? -s : s, H + .03, .022, .06, 50 + sd, { ty: wty, back: 1 })); // a small window up in each gable
  // the wing: a gabled end coming forward at one side, a window in its gable front
  if (wing) { const a = wsg < 0 ? s0 - .02 : s1 - .16, b = a + .18, wf = fD + .14, hw2 = H * .82;
    kPlinth(a, b, fD - .02, wf, .03, wm === M_STONE ? shade(wc, .8) : '#a59c8e'); kBox((a + b) / 2, (fD + wf) / 2 - .01, .03, .09, (wf - fD) / 2 + .01, hw2 - .03, wc, wm);
    kWin((a + b) / 2, wf, wy, ww, wh, 9, { ty: wty, shut, box: hk(B, 35) < .4 });
    if (!flatR) { kGableF(a, b, fB + .05, wf, hw2, rh * .8, rc, { wall: wc, wm }); if (lod) kWin((a + b) / 2, wf, hw2 + .02, .018, .045, 19, { ty: wty, back: 1 }); }
    else kFlat(a, b, fD - .02, wf, hw2, wc, .025, { wm }); }
  // the roof, and a chimney: a stone stack up the outside of a gable end, else a short stack on the ridge
  if (!flatR) kGable(s0, s1, fB, fD, H, rh, rc, { wall: wc, wm });
  else { kFlat(s0, s1, fB, fD, H, wc, .03, { wm }); if (lod) { kPot(s0 + .08, fc, H + .006); kPot(s1 - .1, fB + .06, H + .006); } }
  const cs = wing ? -wsg : hk(B, 7) < .5 ? -1 : 1, [stc, stm] = hStack(wm, wc), out = wm === M_STONE && hk(B, 13) < .6;
  if (out) { const s = cs < 0 ? s0 - .03 : s1 + .03; kBox(s, fc, 0, .03, .06, H * .55, stc, stm); kBox(s - cs * .006, fc, H * .55, .024, .045, H * .15, stc, stm); kChim(s - cs * .006, fc, H * .7, H + rh + .07, .024, .045, stc, stm); }
  else kChim(cs < 0 ? s0 + .06 : s1 - .06, fc, H + rh * .4, H + rh + .06, .028, .034, stc, stm);
  // climbing roses round the door, a water butt, the garden: a path to the gate, a fence or hedge, flowers, a bench
  if (lod && hk(B, 12) < .35) for (let q = 0; q < 6; q++) kBlob(ds - dsg * (.065 + (q % 2) * .02), fD + .01, .04 + q * .03, .016, .02, leafC(q % 2 ? '#4f8a45' : '#5a9a4e'));
  if (lod && hk(B, 12) < .35) for (let q = 0; q < 4; q++) kBlob(ds - dsg * (.06 + (q % 2) * .025), fD + .02, .06 + q * .04, .007, .007, FLOWER_C[q % 2 ? 0 : 2], 0);
  if (lod) kButt(s1 + .03, fD - .03);
  kPath(ds - .03, fD + (hk(B, 5) < .4 ? .12 : .04), ds + .03, .5, wm === M_STONE ? '#a8a092' : '#b8ad9c');
  const ft = hk(B, 14), fty = ft < .3 ? 'hedge' : ft < .45 && wm === M_STONE ? 'wall' : 'picket', fcol = fty === 'wall' ? shade(wc, .9) : ft < .7 ? '#ede6d8' : '#8a6d57', fh = fty === 'hedge' ? .06 : fty === 'wall' ? .045 : .05;
  kFence([[-.48, .46], [ds - .045, .46]], fh, fcol, fty); kFence([[ds + .045, .46], [.48, .46]], fh, fcol, fty);
  if (lod && fty === 'picket') { kBox(ds - .045, .46, 0, .008, .008, .07, fcol, M_PLANK); kBox(ds + .045, .46, 0, .008, .008, .07, fcol, M_PLANK); kOB(ds - .02, .44, .03, [.024, .02, 0], [.004, -.004, 0], [0, 0, .022], fcol, M_PLANK); } // the gate, standing open
  if (lod) for (let q = 0; q < 5; q++) { const s = q < 3 ? -.42 + q * .09 : .2 + (q - 3) * .1; if (Math.abs(s - ds) > .07) kFlowers(s, .37 - (q % 2) * .05, 0, (q + B.id) / 7); }
  if (lod && hk(B, 15) < .45 && !wing) kBench(sc + dsg * -.18, fD + .06, 0, 1);
  // out the back: a kitchen garden, or a washing line, or an apple tree; a lean-to shed
  const bk = hk(B, 6);
  if (bk < .45) kBeds(s0 + .04, fB - .06, s1 - .1, -.46, 3, ['#6aa556', '#8fbf5a', '#c9b24a'][(hk(B, 16) * 3) | 0]);
  else if (bk < .7) kWash(s0 + .05, s1 - .05, -.38, .12, B.id);
  else kTree(s1 - .12, -.36, 0, bk, .7, '#6aa556');
  if (hk(B, 17) < .35) { const s = cs < 0 ? s1 - .09 : s0 + .09; kBox(s, fB - .055, 0, .07, .055, .13, shade(wc, .92), wm === M_STONE ? M_STONE : M_PLANK); kCtr(s, fB - .06, .05); kQ([s - .08, fB - .125, .125], [s + .08, fB - .125, .125], [s + .08, fB, .17], [s - .08, fB, .17], rc, roofMat(gcol(rc))); }
}

/* ---------- tier 3: a townhouse, timber-framed and jettied while the old styles last; gable or eaves to the street ---------- */
function hTown(B, st) {
  const J = hSet(B), lo = J && J.lo, hi = J && J.hi, [wc0, wm0] = kWall(B, st), lod = KF.lod, flatR = dsFlat(), rc = st.roof;
  const tf = (B.style || 0) <= 3 && (wm0 === M_PLASTER || wm0 === M_PLANK), wc = tf ? mix(st.wall, '#f2ebdc', .35) : wc0, wm = tf ? M_PLASTER : wm0;
  const r = hRoofline(B, 3), H = (12 + (r < .5 ? 0 : 3) + (hk(B, 9) < .3 ? 2.5 : 0)) * ZS * 1.12, g0 = .04, fh0 = (H - g0) * .52, y1 = g0 + fh0;
  const s0 = lo ? -.5 : -.37, s1 = hi ? .5 : .37, L = s1 - s0, sc = (s0 + s1) / 2, fD = .26, fB = -.24, fc = (fB + fD) / 2, jet = tf ? .03 : 0;
  const gf = !J && hk(B, 4) < .5 && !flatR, wty = kWinTy() === 'glass' ? 'modern' : kWinTy(), nb = L > .7 ? 3 : 2, bay = k => s0 + (k + .5) * L / nb, dk = hk(B, 20) < .5 ? 0 : nb - 1;
  const shop = zoneAt(idx(B.x, B.y)) === Z_CORE && hk(B, 12) < .55, door = WH_DOOR[(hk(B, 21) * WH_DOOR.length) | 0], acc = st.accent;
  const beam = '#3b2a20', shut = !tf && hk(B, 10) < .35 && wty === 'sash' ? SHUT[(hk(B, 11) * SHUT.length) | 0] : null;
  kPlinth(s0, s1, fB, fD, g0, tf ? '#a59c8e' : K_STONE, { lo, hi });
  kBox(sc, fc, g0, L / 2, (fD - fB) / 2, fh0, tf ? mix(wc0, '#cfc6b4', .3) : wc, tf ? M_STONE : wm);
  kBox(sc, fc + jet / 2, y1, L / 2, (fD - fB) / 2 + jet / 2, H - y1, wc, wm); // the upper floor (jettied out over the street)
  if (tf) { // the timber frame: posts, a sill beam and a wall plate, braces; joist ends under the jetty
    const ff = fD + jet, n = nb * 2;
    for (const f of lo && hi ? [ff, fB] : [ff, fB]) { const g = Math.sign(f); for (const y of [y1, H - .012]) kBox(sc, f + g * .003, y, L / 2, .004, .014, beam, M_PLANK);
      for (let k = 0; k <= n; k++) kBox(s0 + k * L / n, f + g * .003, y1, .007, .004, H - y1, beam, M_PLANK);
      if (lod) for (let k = 0; k < n; k++) if (k % 2 === (dk ? 1 : 0)) { const a = s0 + k * L / n, b = a + L / n; kOB((a + b) / 2, f + g * .004, (y1 + H) / 2, [(b - a) / 2 - .006, 0, (H - y1) / 2 - .01], [0, .003, 0], [-.006, 0, .006], beam, M_PLANK); } }
    for (const [on, s] of [[lo, s0], [hi, s1]]) if (!on) { const sd = s === s0 ? 3 : 1, q = sd === 1 ? 1 : -1; kSide(sd, () => { const f = sd === 1 ? -s1 : s0, g = Math.sign(f); // (turned: along is ±f, out is the end wall)
      for (const y of [y1, H - .012]) kBox(q * (fc + jet / 2), f + g * .003, y, (fD - fB + jet) / 2, .004, .014, beam, M_PLANK); for (let k = 0; k <= 3; k++) kBox(q * (fB + k * (fD + jet - fB) / 3), f + g * .003, y1, .007, .004, H - y1, beam, M_PLANK); }); }
    if (lod) for (let s = s0 + .03; s < s1 - .01; s += .05) kBox(s, fD + jet / 2, y1 - .014, .008, jet / 2 + .002, .014, beam, M_PLANK);
  } else if (!flatR) kBand(s0, s1, fD, y1 - .01);
  // the ground floor: a shopfront, or windows; the door
  if (shop) { kShop(s0 + .03, s1 - .03, fD, g0, fh0 * .8, acc, B.id); kSign(s1 - .06, fD + jet, H * .62, acc); }
  else { for (let k = 0; k < nb; k++) if (k !== dk) kWin(bay(k), fD, g0 + fh0 * .2, Math.min(.05, L / nb * .26), fh0 * .55, k, { ty: wty, key: wty === 'sash', shut, box: hk(B, 30 + k) < .25 });
    kDoor(bay(dk), fD, .042, fh0 * .76, door, { ty: wty === 'case' ? 'plank' : 'panel', steps: 1, hood: tf ? 'pent' : 'flat', fan: !tf && hk(B, 22) < .5, roof: rc, pil: !tf }); }
  // upstairs: windows, now and then an oriel
  const ff = fD + jet, fhU = H - y1, oriel = !shop && hk(B, 16) < .3;
  for (let k = 0; k < nb; k++) { const s = bay(k), ww = Math.min(.05, L / nb * .26);
    if (oriel && k === (dk ? 0 : nb - 1)) { const d = .05; kBox(s, ff + d / 2, y1 + fhU * .12, ww * 1.6, d / 2, fhU * .7, wc, wm); kWin(s, ff + d, y1 + fhU * .2, ww * 1.2, fhU * .52, 30 + k, { ty: wty });
      kBox(s, ff + d / 2, y1 + fhU * .82, ww * 1.6 + .01, d / 2 + .01, .016, '#5d6670', M_SLATE); kBox(s, ff + d / 2, y1 + fhU * .06, ww * 1.6, d / 2, fhU * .06, beam, M_PLANK); continue; }
    kWin(s, ff, y1 + fhU * .2, ww, fhU * .55, 20 + k, { ty: wty, arch: !tf && wty === 'sash' && hk(B, 23) < .5 ? 'seg' : null, wall: wc, shut, box: hk(B, 40 + k) < .3 }); }
  kWins(s0 + .05, s1 - .05, fB, g0, fh0, 2, 2, { ty: wty, back: 1, hw: .035 }, null, 50);
  if (!lo && !hi && !gf) for (const sd of [1, 3]) kSide(sd, () => kWin(0, sd === 1 ? -s1 : s0, y1 + fhU * .2, .03, fhU * .5, 70 + sd, { ty: wty, back: 1 }));
  // the roof
  if (flatR) { kFlat(s0, s1, fB, fD + jet, H, wc, .04, { lo, hi, wm }); if (lod) roofBitsK(B, st, s0, s1, fB, fD, H + .01); }
  else if (gf) { // the gable to the street: bargeboards, a little attic window, a hoist beam
    kGableF(s0, s1, fB, fD + jet, H, .32, rc, { wall: wc, wm, ov: .04 });
    kWin(sc, fD + jet, H + .06, .028, .08, 80, { ty: wty, back: 1 });
    if (lod) { kBeam([sc, fD + jet, H + .26], [sc, fD + jet + .08, H + .26], .009, beam, M_PLANK); kBeam([sc, fD + jet + .07, H + .26], [sc, fD + jet + .07, H + .1], .001, '#c9b48a'); }
    if (tf && lod) { kBeam([s0 + .02, fD + jet + .004, H], [sc, fD + jet + .004, H + .3], .006, beam, M_PLANK); kBeam([s1 - .02, fD + jet + .004, H], [sc, fD + jet + .004, H + .3], .006, beam, M_PLANK); kBox(sc, fD + jet + .004, H, .006, .004, .3, beam, M_PLANK); }
  } else {
    kGable(s0, s1, fB, fD + jet, H, .27, rc, { lo, hi, wall: wc, wm });
    if (hk(B, 24) < .5 && L > .5) for (let k = 0; k < nb; k++) if (k !== dk || nb < 3) kDormer(bay(k), fD + jet - .1, H + .07, .045, .1, .14, rc, wc, wm, k);
  }
  const [stc, stm] = hStack(wm0, wc0), stacks = [hi ? s1 : s1 - .05]; if (!lo) stacks.push(s0 + .05);
  for (const s of stacks) kChim(s, gf ? fB + .1 : fc - .02, H + .1, H + (gf ? .22 : .27) + .14, .04, .07, stc, stm);
  if (lod && !shop) { if (hk(B, 26) < .5) kBarrel(s0 + .08, fB - .06); if (!J && hk(B, 27) < .5) kWash(s0 + .05, s1 - .05, -.42, .12, B.id + 3); if (hk(B, 28) < .4) kPot(bay(dk) + .07, fD + .04, .022); }
}
function roofBitsK(B, st, s0, s1, fB, fD, y) { // flat roofs get lived on: a water tank, a stair hut, an awning, pots
  const k = (hk(B, 7) * 5) | 0, sc = (s0 + s1) / 2, fc = (fB + fD) / 2;
  if (k === 0) { kCyl(s1 - .1, fB + .1, y, .05, .09, '#8a7d73', 0, 10); for (const d of [-1, 1]) kBox(s1 - .1 + d * .03, fB + .1, y, .004, .004, .02, K_IRON); }
  else if (k === 1) { kBox(s0 + .1, fB + .09, y, .07, .06, .1, shade(st.wall, .92)); kDoor(s0 + .1, fB + .15, .025, .08, '#5a5a5a', { ty: 'plank' }); }
  else if (k === 2) { for (const [a, b] of [[-.1, -.06], [.1, -.06], [-.1, .08], [.1, .08]]) kBox(sc + a, fc + b, y, .004, .004, .09, K_IRON); kBox(sc, fc + .01, y + .09, .12, .09, .004, st.accent, M_PLANK); kBench(sc, fc, y, 1); }
  else for (let q = 0; q < 4; q++) kPot(s0 + .08 + q * (s1 - s0 - .16) / 3, fD - .06, y);
}

/* ---------- tier 4 (modern): a townhouse of the glass age, or a flat-roofed brick one ---------- */
function hRow4(B, st) {
  const J = hSet(B), lo = J && J.lo, hi = J && J.hi, [wc, wm] = kWall(B, st), lod = KF.lod, wty = kWinTy(), modern = hasTech('computing');
  const r = hRoofline(B, 4), H = (18 + ((r * 5) % 1) * 5 + (hk(B, 9) < .25 ? 3 : 0)) * ZS, s0 = lo ? -.5 : -.4, s1 = hi ? .5 : .4, L = s1 - s0, sc = (s0 + s1) / 2, fD = .37, fB = -.3, fc = (fB + fD) / 2;
  const nb = L > .75 ? 3 : 2, bay = k => s0 + (k + .5) * L / nb, dk = hk(B, 20) < .5 ? 0 : nb - 1, shop = shopfront(B), floors = 3, g0 = .03, fh = (H - g0) / floors;
  kPlinth(s0, s1, fB, fD, g0, modern ? '#9a9ea3' : K_STONE, { lo, hi });
  if (modern) { // render below, timber-clad above, big glass, a recessed door under a canopy, a glass balcony, a roof terrace
    const top = hk(B, 13) < .5, clad = mix('#a8805a', st.wall, .25), hT = top ? H - fh * .8 : H;
    kBox(sc, fc, g0, L / 2, (fD - fB) / 2, fh, st.wall, M_PLASTER); kBox(sc, fc, g0 + fh, L / 2, (fD - fB) / 2, hT - g0 - fh, clad, M_PLANK);
    if (lod) for (let s = s0 + .02; s < s1; s += .03) kBox(s, fD + .002, g0 + fh, .003, .003, hT - g0 - fh, shade(clad, .8), M_PLANK);
    if (shop) kShop(s0 + .03, s1 - .03, fD, g0, fh * .82, st.accent, B.id);
    else { kBox(bay(dk), fD - .03, g0, .055, .03, fh * .8, '#2c3036'); kDoor(bay(dk), fD - .058, .042, fh * .74, '#3a3f45', { ty: 'glass' }); kBox(bay(dk), fD + .03, g0 + fh * .82, .08, .06, .014, '#e8ecf0');
      for (let k = 0; k < nb; k++) if (k !== dk) kWin(bay(k), fD, g0 + fh * .12, Math.min(.08, L / nb * .38), fh * .7, k, { ty: 'glass' }); }
    for (let fk = 1; fk < floors; fk++) { const y = g0 + fk * fh; if (y > hT - .05) break; kWin(sc, fD, y + fh * .1, L * .38, fh * .78, 10 + fk, { ty: 'glass' }); if (fk === 1 && hk(B, 14) < .6) kBalc(sc, fD, y, L * .4, .07, { glass: 1 }); }
    kWins(s0 + .05, s1 - .05, fB, g0, fh, floors - (top ? 1 : 0), 2, { ty: 'glass', back: 1, hw: .07, hk: .7, yk: .14 }, null, 30);
    kFlat(s0, s1, fB, fD, hT, st.wall, .045, { lo, hi });
    if (top) { const tb = fB + .06, td = fD - .2; kBox(sc - L * .1, (tb + td) / 2, hT, L * .3, (td - tb) / 2, fh * .8, st.wall, M_PLASTER); kWin(sc - L * .1, td, hT + fh * .08, L * .25, fh * .62, 40, { ty: 'glass' }); kFlat(sc - L * .4, sc + L * .2, tb, td, hT + fh * .8, st.wall, .02);
      if (lod) { kBox(sc + L * .3, fD - .1, hT, .025, .025, .02, '#8a6a4c'); kPot(sc + L * .3, fD - .1, hT + .02); kBench(sc + L * .2, fD - .06, hT, 1); } }
    else kSolar(sc, fc - .04, hT + .02, L * .32, .16, .35);
    return;
  }
  // a flat-roofed brick terrace (when the style turns square before the computers): sashes, a stone cornice, a parapet
  kBox(sc, fc, g0, L / 2, (fD - fB) / 2, H - g0, wc, wm);
  if (shop) kShop(s0 + .03, s1 - .03, fD, g0, fh * .8, st.accent, B.id);
  else { kDoor(bay(dk), fD, .045, fh * .74, WH_DOOR[(hk(B, 21) * WH_DOOR.length) | 0], { steps: 1, fan: 1, hood: 'flat', pil: 1 }); }
  kWins(s0, s1, fD, g0, fh, floors, nb, { ty: wty, key: 1, wall: wc }, (k, fk) => fk === 0 && (shop || k === dk), 0);
  kWins(s0, s1, fB, g0, fh, floors, 2, { ty: wty, back: 1 }, null, 30);
  kBand(s0, s1, fD, g0 + fh - .01); kCornice(s0, s1, fB, fD, H, K_STONE, { lo, hi });
  kFlat(s0, s1, fB, fD, H + .032, wc, .05, { lo, hi, wm }); if (lod) roofBitsK(B, st, s0, s1, fB, fD, H + .04);
}

/* ---------- tier 5: blocks of flats ---------- */
// Before the computers: an engineers' block (a stone base with shops, iron balconies, a mansard), a deco block
// (bands, a stair tower with a lit fin), a brick mansion block (bays and gables). After: concrete and glass with
// balconies all the way up, a setback penthouse and roof garden, planted balconies, or fins against the sun.
function hFlats(B, st) {
  const J = hSet(B), lo = J && J.lo, hi = J && J.hi, v = B.var || 0, [wc0, wm0] = kWall(B, st), lod = KF.lod, modern = hasTech('computing') || dsFlat();
  const r = hRoofline(B, 5), H = (J ? 28 + r * 16 : 30 + ((v * 3) % 1) * 22) * ZS, kind = J ? (r * 4) | 0 : Math.floor(((v * 13) % 1) * 4);
  const hw = J ? .38 : .31 + ((v * 7) % 1) * .07, hd = J ? .34 : .31 + ((v * 11) % 1) * .07, s0 = lo ? -.5 : -hw, s1 = hi ? .5 : hw, L = s1 - s0, sc = (s0 + s1) / 2, fD = hd, fB = -hd, fc = 0;
  const g0 = .03, fh0 = .2, floors = Math.max(3, Math.round((H - g0 - fh0) / .25)), fh = (H - g0 - fh0) / floors, y1 = g0 + fh0, nb = Math.max(3, Math.round(L / .14));
  const shop = zoneAt(idx(B.x, B.y)) === Z_CORE && hk(B, 12) < .75, acc = st.accent, wty = kWinTy();
  kPlinth(s0, s1, fB, fD, g0, modern ? '#9a9ea3' : '#a8a092', { lo, hi });
  const ground = (base, bm) => { // the ground floor: shops or a front door
    kBox(sc, fc, g0, L / 2, hd, fh0, base, bm);
    if (shop) { const n = L > .6 ? 2 : 1; for (let k = 0; k < n; k++) kShop(s0 + .02 + k * (L - .04) / n, s0 + .02 + (k + 1) * (L - .04) / n, fD, g0, fh0 * .78, k ? mix(acc, '#3f6b5f', .5) : acc, B.id + k); }
    else { kDoor(sc, fD, .05, fh0 * .7, modern ? '#3a3f45' : '#3a2f28', { ty: modern ? 'glass' : 'panel', steps: modern ? 0 : 2, hood: modern ? 'canopy' : 'ped', fan: !modern, pil: !modern });
      kWins(s0, s1, fD, g0, fh0, 1, nb, { ty: modern ? 'glass' : wty, hk: .55, hw: .045 }, k => Math.abs(s0 + (k + .5) * L / nb - sc) < .09, 0); }
  };
  if (!modern) {
    const wc = kind === 1 ? mix(st.wall, '#efe6d6', .4) : kind === 2 ? mix(wc0, '#a5573f', .3) : wc0, wm = kind === 1 ? M_PLASTER : kind === 2 ? M_BRICK : wm0;
    ground(kind === 2 ? shade(wc, .92) : mix(wc, '#cfc6b4', .5), kind === 2 ? M_BRICK : M_STONE);
    if (lod && kind !== 2) for (let y = g0 + .03; y < y1 - .01; y += .035) kBox(sc, fD + .002, y, L / 2, .003, .004, shade(wc, .78), M_STONE); // rustication
    kBox(sc, fc, y1, L / 2, hd, H - y1, wc, wm); kBand(s0, s1, fD, y1 - .005, K_STONE, .016);
    const ty = kind === 1 ? 'modern' : wty;
    for (let fk = 0; fk < floors; fk++) for (let k = 0; k < nb; k++) { const s = s0 + (k + .5) * L / nb, y = y1 + fk * fh;
      kWin(s, fD, y + fh * .16, Math.min(.042, L / nb * .3), fh * .62, fk * 17 + k, { ty, ped: kind === 0 && fk === 0, key: kind === 0 && fk > 0 && fk < floors - 1, arch: kind === 2 && fk === floors - 1 ? 'seg' : null, wall: wc, box: kind !== 1 && hk(B, 50 + fk * 7 + k) < .12 });
      if (kind === 3 || kind === 0 && (fk === 1 || fk === floors - 1)) { if (kind === 3 || k === 0) kBalc(kind === 3 ? s : sc, fD, y + .004, kind === 3 ? Math.min(.06, L / nb * .4) : L / 2 - .02, .05, { rail: K_IRON }); } }
    kWins(s0, s1, fB, y1, fh, floors, Math.max(2, nb - 1), { ty, back: 1 }, null, 200);
    if (!lo) kSide(3, () => kWins(-hd + .04, hd - .04, s0, y1, fh, floors, 2, { ty, back: 1 }, null, 300));
    if (!hi) kSide(1, () => kWins(-hd + .04, hd - .04, -s1, y1, fh, floors, 2, { ty, back: 1 }, null, 400));
    if (kind === 0) kPilasters(s0 + .01, s1 - .01, nb, fD, y1, H, mix(wc, '#f2ece0', .5));
    if (kind === 1) { // deco: bands at each floor, a stepped stair tower with a lit fin
      for (let fk = 1; fk <= floors; fk++) kBand(s0, s1, fD, y1 + fk * fh - .02, '#f4efe6', .01);
      kFlat(s0, s1, fB, fD, H, wc, .05, { lo, hi });
      const tw = .09; kBox(sc, fD - .04, H, tw, .05, .16, wc, M_PLASTER); kBox(sc, fD - .04, H + .16, tw * .7, .04, .06, wc, M_PLASTER);
      kBox(sc, fD + .012, y1, .014, .014, H - y1 + .2, '#f4efe6', M_STONE); kBox(sc, fD + .027, y1 + .1, .004, .004, H - y1, '#ffe6b0', 0, 2); // the fin and its light
      if (lod) roofBitsK(B, st, s0, s1, fB, fD - .12, H + .01);
    } else if (kind === 2) { // a mansion block: a stone cornice, gables over the bays, tall stacks
      kCornice(s0, s1, fB, fD, H, K_STONE, { lo, hi });
      kHip(s0 - (lo ? 0 : .01), s1 + (hi ? 0 : .01), fB, fD, H + .03, .2, st.roof, { ov: .03 });
      for (const s of [s0 + L * .25, s0 + L * .75]) { kBox(s, fD - .04, H, .09, .045, .08, wc, wm); kGableF(s - .09, s + .09, fD - .2, fD + .005, H + .08, .1, st.roof, { wall: wc, wm }); kWin(s, fD + .005, H + .02, .03, .08, 90 + s * 9 | 0, { ty, back: 1 }); }
      const [stc, stm] = hStack(wm, wc); for (const s of [s0 + .06, s1 - .06]) kChim(s, fc, H + .1, H + .34, .05, .03, stc, stm);
    } else { kCornice(s0, s1, fB, fD, H, K_STONE, { lo, hi }); kMansard(s0 - (lo ? 0 : .02), s1 + (hi ? 0 : .02), fB - .02, fD + .02, H + .032, 8 * ZS, st.roof); }
    return;
  }
  // concrete and glass
  const conc = mix(st.wall, '#d8d8d4', .4), sb = kind === 1, top = sb ? H - fh : H;
  ground('#3a4048', 0); if (!shop) kBox(sc, fc, g0, L / 2 - .02, hd - .02, fh0, '#2f363d');
  kBox(sc, fc, g0 + fh0 * .98, L / 2, hd, .02, conc, M_STONE);
  const fl = sb ? floors - 1 : floors;
  for (let fk = 0; fk < fl; fk++) { const y = y1 + fk * fh;
    kBox(sc, fc, y, L / 2 - .015, hd - .03, fh, kind === 2 ? '#2f3a40' : '#33475a', 0, kLit(fk * 9 + 1)); // the glazing, set back
    kBox(sc, fc, y + fh - .016, L / 2, hd, .016, conc, M_STONE); // the slab edge
    if (lod) for (let k = 1; k < nb; k++) kBox(s0 + k * L / nb, fD - .028, y, .004, .004, fh - .016, '#9aa3ad');
    if (kind === 0 || kind === 2) { kBalc(sc, fD - .03, y, L / 2 - .01, .06, { glass: kind === 0, rail: kind === 2 ? '#6b7a5a' : null }); kBalc(sc, fB + .03, y, L / 2 - .01, .06, { glass: kind === 0 });
      if (kind === 2 && lod) for (let k = 0; k < nb; k++) kBlob(s0 + (k + .5) * L / nb, fD + .02, y + .06, .028, .022, leafC(k % 2 ? '#4f8a45' : '#5f9a4d')); }
    if (kind === 3) for (let k = 0; k <= nb; k++) kBox(s0 + k * L / nb, fD + .01, y, .006, .03, fh - .016, conc, M_STONE); // fins
  }
  if (!lo) kBox(s0 + .008, fc, y1, .008, hd, top - y1, conc, M_STONE); if (!hi) kBox(s1 - .008, fc, y1, .008, hd, top - y1, conc, M_STONE);
  kFlat(s0, s1, fB, fD, top, conc, .05, { lo, hi });
  if (sb) { const pa = s0 + .06, pb = s1 - L * .35; kBox((pa + pb) / 2, fc - .04, top, (pb - pa) / 2, hd * .55, fh, '#33475a', 0, kLit(77)); kFlat(pa, pb, fc - .04 - hd * .55, fc - .04 + hd * .55, top + fh, conc, .02);
    kTree(s1 - .12, fD - .12, top, .3, .55, '#5f9a4d'); if (lod) { kBox(s1 - .12, fD - .12, top, .05, .05, .02, '#6b7380'); kBench(s1 - .14, fc - .1, top, 1); kPot(pb + .06, fB + .08, top); } }
  else { kBox(sc - L * .2, fB + .12, top, .07, .06, .09, conc, M_STONE); if (lod) kSolar(sc + L * .15, fc, top + .02, L * .22, .14, .3); else kBox(sc + L * .15, fc, top + .01, L * .22, .14, .02, '#2e3f5c'); }
}

/* ---------- tier 6: a glass tower: a lobby under a canopy, a curtain wall, a crown of plant and a mast ---------- */
function hTower(B, st) {
  kSetB(B); const v = B.var || 0, h = (58 + ((v * 5) % 1) * 62) * ZS, form = (hk(B, 10) * 5) | 0, gk = (hk(B, 11) * 5) | 0, lod = KF.lod;
  const glass = gk ? mix(st.glass, ['', '#ffffff', '#6fc8b8', '#e6c28a', '#8f9cf0'][gk], .28) : st.glass, sv = GLB.wall, conc = mix(st.wall, '#e4e4e0', .3);
  let hw = form === 1 ? .28 : .33, zb = 0;
  const lobby = (w, y) => { kBox(0, 0, 0, w, w, .14, '#2f3a44', 0, kLit(1)); kBox(0, 0, .14, w + .01, w + .01, .02, conc, M_STONE); kDoor(0, w, .06, .1, '#3a3f45', { ty: 'glass' });
    kBox(0, w + .08, .12, .12, .08, .012, conc, M_STONE); if (lod) { for (const d of [-1, 1]) kBox(d * .11, w + .15, 0, .006, .006, .12, '#9aa3ad'); for (const d of [-1, 1]) kTree(d * .3, w + .1, 0, .3 + d * .1, .6, '#5f9a4d'); kBench(.2, w + .1, 0, 1); } };
  if (form === 1) { kBox(0, 0, 0, .45, .45, .3, st.wall, M_PLASTER); kWins(-.45, .45, .45, 0, .3, 1, 4, { ty: 'glass', hk: .7, yk: .1 }, null, 3); kSide(2, () => kWins(-.45, .45, .45, 0, .3, 1, 4, { ty: 'glass', hk: .7, yk: .1 }, null, 9)); kShop(-.4, .1, .45, .02, .22, st.accent, B.id); kFlat(-.45, .45, -.45, .45, .3, st.wall, .03); zb = .3;
    if (lod) for (const [a, b] of [[-.32, -.32], [.32, -.32], [-.32, .32]]) kTree(a, b, .31, .4, .5, '#5f9a4d'); }
  else if (form === 2) { GLB.wall = M_GLASS; kBox(0, 0, 0, .4, .4, h * .35, glass, M_GLASS); GLB.wall = sv; glWindows(0, 0, .4, .4, 0, h * .35 / ZS, Math.floor(h * .35 / ZS / 8), 4, glass); kBox(0, 0, h * .35, .41, .41, .03, conc, M_STONE); hw = .27; zb = h * .35 + .03; kDoor(0, .4, .07, .11, '#3a3f45', { ty: 'glass', hood: 'canopy' }); }
  else lobby(hw, 0);
  if (form === 3) { // banded: stone floors between the glass
    kBox(0, 0, .16, hw, hw, h * .82 - .16, conc, M_STONE); for (let y = .26; y < h * .82 - .1; y += 7 * ZS) kBox(0, 0, y, hw + .005, hw + .005, 4 * ZS, glass, 0, kLit((y * 50) | 0));
    kBox(0, 0, h * .82 - .02, hw * .8, hw * .8, .045, conc, M_STONE); kHip(-hw * .8, hw * .8, -hw * .8, hw * .8, h * .82 + .02, .45, st.roof, { ov: .01, noGut: 1 });
    kBox(0, 0, h * .82 + .47, .006, .006, .36, '#9aa3ad'); kBox(0, 0, h * .82 + .83, .012, .012, .02, '#ff5a5a', 0, 3); return;
  }
  const b0 = Math.max(zb, form === 1 ? zb : .16), b1 = h * .82;
  GLB.wall = M_GLASS; glBox(0, 0, hw, hw, b0 / ZS, (b1 - b0) / ZS, glass); glBox(0, 0, hw * .78, hw * .78, b1 / ZS, h * .18 / ZS, shade(glass, 1.06)); GLB.wall = sv; // (curtain walls get their mullions and floor bands: gl.js glBox)
  glWindows(0, 0, hw, hw, b0 / ZS, (b1 - b0) / ZS, Math.floor((b1 - b0) / ZS / 8), 4, glass);
  for (const d of [-1, 1]) for (const e of [-1, 1]) kBox(d * (hw - .008), e * (hw - .008), b0, .012, .012, b1 - b0, conc, M_STONE); // stone corners
  kBox(0, 0, b1 - .01, hw + .008, hw + .008, .025, conc, M_STONE); kBox(0, 0, b1 + .012, hw * .97, hw * .97, .006, '#fff0c8', 0, 2); // a lit band round the crown
  kFlat(-hw * .78, hw * .78, -hw * .78, hw * .78, h, conc, .03);
  if (form === 4) { kCyl(0, 0, h + .01, .2, .01, '#5d646c', 0, 16); for (const [a, b] of [[.045, 0], [-.045, 0]]) kBox(a, b, h + .02, .006, .045, .002, '#f0f0f0'); kBox(0, 0, h + .02, .045, .006, .002, '#f0f0f0'); // a helipad, its lights
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; kBox(Math.cos(a) * .19, Math.sin(a) * .19, h + .02, .006, .006, .006, '#ffd27a', 0, 3); } return; }
  kBox(-hw * .3, -hw * .3, h + .01, hw * .3, hw * .25, .07, '#9aa3ad'); if (lod) for (let s = -hw * .58; s < -.02; s += .02) kBox(s, -hw * .05 + .002, h + .02, .003, .002, .05, '#6c7680'); // plant behind louvres
  kCyl(hw * .4, -hw * .4, h + .01, .05, .1, '#8a8f96', 0, 10); // a tank
  if (lod) for (const d of [-1, 1]) kBox(d * hw * .7, 0, h + .03, .004, hw * .7, .004, '#8a8f96'); // the cleaning cradle's rails
  kBox(0, 0, h, .006, .006, .55, '#9aa3ad'); if (h > 90 * ZS) kBox(0, 0, h + .55, .012, .012, .02, '#ff5a5a', 0, 3);
}

/* ---------- tier 7: an arcology: terraces of glass and garden, trees on every step, a glowing spine and a mast ---------- */
function hArco(B, st) {
  kSetB(B); const v = B.var || 0, lod = KF.lod, sv = GLB.wall; let y = 0;
  for (let k = 0; k < 4; k++) { const hw = .47 - k * .09, hh = (34 + ((v * (k + 2)) % 1) * 10) * ZS, g = k % 2 ? st.wall : st.glass;
    GLB.wall = k % 2 ? M_PLASTER : M_GLASS; glBox(0, 0, hw, hw, y / ZS, hh / ZS, g); GLB.wall = sv;
    glWindows(0, 0, hw, hw, y / ZS, hh / ZS, Math.round(hh / ZS / 7), 4, k % 2 ? st.glass : shade(st.glass, .8));
    for (let f = y + .3; f < y + hh - .05; f += .3) kBox(0, 0, f, hw + .015, hw + .015, .016, '#e8ecef', M_STONE); // planted ledges
    if (lod) for (let f = y + .3; f < y + hh - .05; f += .3) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) kBox(a * (hw + .01), b * (hw + .01), f + .016, a ? .01 : hw, b ? .01 : hw, .012, leafC('#5f9a4d'), M_LEAF);
    y += hh; kBox(0, 0, y, hw + .01, hw + .01, .03, '#7cc47f', M_GRASS);
    if (k < 3) { const nw = .47 - (k + 1) * .09, m = (hw + nw) / 2; for (const [a, b] of [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [0, 1], [-1, 0], [0, -1]]) if (lod || (a && b)) kTree(a * m, b * m, y + .03, (k * 8 + a * 3 + b) * .13 % 1, .55, ['#5f9a4d', '#6aa556', '#ee9fbe'][(k + a + b + 3) % 3]); }
    if (lod && k < 3) kBox(0, hw + .002, y - hh * .5, .02, .004, hh * .9, '#bff0ff', 0, 2); // the spine glowing up each step
    y += .03; }
  kCyl(0, 0, y, .06, .04, '#e8ecef', 0, 12); kBox(0, 0, y + .04, .012, .012, .6, st.accent); kBox(0, 0, y + .64, .02, .02, .025, '#ff6a6a', 0, 3);
  if (lod) for (let k = 0; k < 3; k++) { const a = k / 3 * TAU; kBeam([0, 0, y + .5], [Math.cos(a) * .1, Math.sin(a) * .1, y + .04], .002, '#c9ced4'); }
}
