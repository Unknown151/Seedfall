/* ============================== the worker house: a brick terrace house, modelled properly ============================== */
// The rowhouse (tier 4) before the modern blocks: Anno's workers. It faces its street, joins its neighbours into a
// terrace (houseJoin) and is built from real parts rather than one box: a stone plinth, brick walls, sash windows set
// back in painted frames with stone sills, flat lintels with a keystone downstairs and brick arches above, a doorcase
// with pilasters, a fanlight and a hood over a stone step, a string course and a cornice on brackets, quoins on the
// end of a row, a pitched roof with a ridge, fascia, gutters and a downpipe, chimney stacks on the party walls with
// corbelled tops and pots, dormers, a bay window, window boxes, a back range, and a shopfront with an awning in the
// market quarter. The near version of a chunk (GLB.lod) gets all of it; the far one keeps the shapes and the windows.
// Everything is in world units: s along the street, f out towards it, y up from the ground.
const WH_DOOR = ['#2f4f3f', '#6b2a2a', '#2a3a5a', '#2a2a2e', '#5a3a28', '#3f6b6b'], WH_TRIM = '#efe9dc', WH_STONE = '#cfc6b4';
function whFits(B, st) { return B.tier === 4 && rowStyleOK(B) && !dsFlat() && !hasTech('computing') && (SHAPE_HM[st.shape] || 1) === 1; }
GL_MODEL.house = function (B, st) {
  if (!whFits(B, st)) return false; // (other houses still come from the shared art)
  st = houseTint(st, B);
  const J = houseJoin(B), U = (J ? J.a : houseAx(B)) === 'u', X = GLB.x, Z = GLB.y, y0 = GLB.base, lod = GLB.lod;
  const fx = U ? 0 : 1, fz = U ? 1 : 0, sg = inb(X + fx, Z + fz) && netTile(idx(X + fx, Z + fz)) ? 1 : inb(X - fx, Z - fz) && netTile(idx(X - fx, Z - fz)) ? -1 : 1; // the street side
  const A = U ? [1, 0, 0] : [0, 0, 1], F = [fx * sg, 0, fz * sg], UP = [0, 1, 0];
  const P = (s, f, y) => [X + A[0] * s + F[0] * f, y0 + y, Z + A[2] * s + F[2] * f];
  const bx = (s, f, y, hs, hf, hy, col, mat = 0, e = 0) => gBox(P(s, f, y), V3s(A, hs), V3s(F, hf), hy, col, mat, e); // a box: middle of its foot at (s, f, y), half-sizes along the street and out, then its height
  const ob = (s, f, y, a, b, c, col, e = 0) => { GLB.mat = 0; glOBox(P(s, f, y), a, b, c, col, e); };
  const lo = J && J.lo, hi = J && J.hi, s0 = lo ? -.5 : -.4, s1 = hi ? .5 : .4, L = s1 - s0, sc = (s0 + s1) / 2;
  const fB = -.3, fD = .37, fc = (fB + fD) / 2; // back wall, front wall, the ridge between
  const r = hash2(U ? B.y : B.x, 4 * 7 + B.sid, 57), H = (18 + ((r * 5) % 1) * 5 + (hk(B, 9) < .25 ? 3 : 0)) * ZS; // (the same roofline as the shared terrace art, so mixed rows line up)
  const floors = H > 1 ? 3 : 2, g0 = .05, fh0 = (H - g0) / floors * 1.08, fhU = floors > 1 ? (H - g0 - fh0) / (floors - 1) : 0, fl = k => k ? g0 + fh0 + (k - 1) * fhU : g0; // floor k's sill line
  const wall = st.wall, wm = glWallMat(B) === M_PLASTER ? M_BRICK : glWallMat(B), wallC = wm === M_BRICK ? mix(wall, '#a5573f', .55) : wall, sv = GLB.wall; GLB.wall = wm; GLB.wallC = gcol(wallC);
  const shop = shopfront(B), nb = L > .75 ? 3 : 2, bay = k => s0 + (k + .5) * L / nb, dk = hk(B, 20) < .5 ? 0 : nb - 1, door = WH_DOOR[(hk(B, 21) * WH_DOOR.length) | 0];
  const lit = k => .03 + .94 * hash2(B.id * 7 + k, B.x + B.y, 71); // which windows are lit at night
  // the body: plinth, walls, string course, cornice
  bx(sc, (fB + fD) / 2, 0, L / 2 + (lo ? 0 : .012), (fD - fB) / 2 + .012, g0, WH_STONE, M_STONE);
  bx(sc, (fB + fD) / 2, g0, L / 2, (fD - fB) / 2, H - g0, wallC, wm);
  const crn = .035; bx(sc, (fB + fD) / 2, H, L / 2 + (lo || hi ? 0 : .025), (fD - fB) / 2 + .03, crn, WH_STONE, M_STONE); // the cornice
  if (floors > 1) bx(sc, fD, fl(1) - .012, L / 2, .012, .02, WH_STONE, M_STONE); // a string course over the ground floor
  if (lod) for (let s = s0 + .03; s < s1 - .02; s += .055) bx(s, fD + .022, H - .022, .009, .011, .022, WH_STONE, M_STONE); // brackets under the cornice
  if (lod) for (const [on, s] of [[!lo, s0], [!hi, s1]]) if (on) for (let y = g0, k = 0; y < H - .04; y += .055, k++) for (const ff of [fD, fB]) { // quoins at the end of a row
    const lg = k % 2 ? .045 : .028; bx(s - Math.sign(s) * (lg / 2 - .006), ff + Math.sign(ff) * .004, y + .003, lg / 2, .006, .049, WH_STONE, M_STONE); }
  // windows: sash windows in painted frames, set back, with stone sills; flat lintels and a keystone downstairs, brick arches upstairs
  const win = (s, ff, y, hw, hh, k, arch, back) => {
    const o = Math.sign(ff), g = ff + o * .002;
    bx(s, g, y, hw, .003, hh * 2, '#2c3440', 0, lit(k)); // the glass (lit at night)
    bx(s, ff + o * .02, y - .016, hw * 1.3, .02, .016, WH_STONE, M_STONE); // the sill
    if (!lod) return;
    for (const d of [-1, 1]) bx(s + d * (hw - .006), ff + o * .007, y, .006, .007, hh * 2, WH_TRIM); // the frame
    bx(s, ff + o * .007, y, hw, .007, .009, WH_TRIM); bx(s, ff + o * .007, y + hh * 2 - .009, hw, .007, .009, WH_TRIM);
    bx(s, ff + o * .009, y + hh - .004, hw, .004, .008, WH_TRIM); // the meeting rail of the two sashes
    for (const d of back ? [0] : [-1 / 3, 1 / 3]) bx(s + d * hw, ff + o * .006, y, .0028, .003, hh * 2, WH_TRIM); // glazing bars
    if (!back) bx(s, ff + o * .006, y + hh * .5, hw, .003, .004, WH_TRIM), bx(s, ff + o * .006, y + hh * 1.5, hw, .003, .004, WH_TRIM);
    if (arch) { const R = hw * 1.25, cy = y + hh * 2 - R * .55; for (let q = 0; q < 7; q++) { const a = .62 + q / 6 * (Math.PI - 1.24), m = [Math.cos(a), Math.sin(a)], t = [-m[1], m[0]]; // voussoirs round a segmental arch
        ob(s + m[0] * (R + .012), ff + o * .004, cy + m[1] * (R + .012), [A[0] * t[0] * .011, t[1] * .011, A[2] * t[0] * .011], V3s(F, .006), [A[0] * m[0] * .014, m[1] * .014, A[2] * m[0] * .014], q === 3 ? WH_STONE : shade(wallC, .82)); } }
    else if (!back) { bx(s, ff + o * .006, y + hh * 2 + .004, hw * 1.25, .006, .026, WH_STONE, M_STONE); bx(s, ff + o * .011, y + hh * 2 + .002, .011, .008, .034, WH_STONE, M_STONE); } // a lintel and its keystone
  };
  for (let fk = 0; fk < floors; fk++) {
    const fh = fk ? fhU : fh0, y = fl(fk) + fh * .2, hh = fh * .3, hw = Math.min(.05, L / nb * .26);
    for (let k = 0; k < nb; k++) {
      if (fk === 0 && (shop || k === dk)) continue;
      if (fk === 0 && k !== dk && hk(B, 16) < .3 && !shop && k === (dk ? 0 : nb - 1)) { // a bay window
        const s = bay(k), w = hw * 1.6, dd = .07; bx(s, fD + dd / 2, g0, w, dd / 2, fh * .82, wallC, wm);
        win(s, fD + dd, y, hw * 1.15, hh, 90 + k, false, false); bx(s, fD + dd / 2, g0 + fh * .82, w + .012, dd / 2 + .012, .03, '#5d6670', M_SLATE); continue; }
      win(bay(k), fD, y, hw, hh, fk * 10 + k, fk > 0, false);
      if (lod && fk > 0 && hk(B, 30 + fk * 5 + k) < .28) { // a window box of flowers
        const p = P(bay(k), fD + .03, y - .016); bx(bay(k), fD + .03, y - .03, hw * 1.1, .014, .02, '#6b5040', M_PLANK);
        for (let q = 0; q < 3; q++) glBlob(p[0] - X + A[0] * (q - 1) * hw * .7, p[2] - Z + A[2] * (q - 1) * hw * .7, .014, (p[1] - y0 + .01) / ZS, .7, FLOWER_C[(q + B.id) % FLOWER_C.length], 0); }
    }
    for (let k = 0; k < 2; k++) win(s0 + (k + .5) * L / 2, fB, y, hw * .9, hh * .9, 50 + fk * 10 + k, false, true); // the back
  }
  // the front door: a doorcase with pilasters, a fanlight under a little arch and a hood, over a stone step
  if (!shop) {
    const s = bay(dk), dw = .045, dt = g0 + fh0 * .72;
    bx(s, fD + .04, 0, .07, .04, .025, WH_STONE, M_STONE); bx(s, fD + .02, .025, .065, .02, .025, WH_STONE, M_STONE);
    bx(s, fD + .002, g0, dw, .003, dt - g0, door, M_PLANK);
    if (lod) {
      for (const d of [-1, 1]) for (const yy of [g0 + .02, g0 + (dt - g0) * .52]) bx(s + d * dw * .5, fD + .006, yy, dw * .36, .003, (dt - g0) * .4, shade(door, 1.12)); // its panels
      bx(s + dw * .6, fD + .008, g0 + (dt - g0) * .48, .004, .004, .008, '#d6b45a'); // the knob
      for (const d of [-1, 1]) bx(s + d * (dw + .012), fD + .01, g0, .011, .01, dt - g0 + .06, WH_TRIM); // pilasters
      const C = P(s, fD + .004, dt), R = dw, n = 7, gc = gcol('#2c3440'); GLB.mat = 0; GLB.ctr = P(s, fD - .1, dt);
      for (let q = 0; q < n; q++) { const a0 = q / n * Math.PI, a1 = (q + 1) / n * Math.PI; gtri(C, P(s + Math.cos(a0) * R, fD + .004, dt + Math.sin(a0) * R), P(s + Math.cos(a1) * R, fD + .004, dt + Math.sin(a1) * R), gc, lit(99)); }
      for (let q = 0; q < 4; q++) { const a = (q + .5) / 4 * Math.PI; bx(s + Math.cos(a) * R * .5, fD + .006, dt + Math.sin(a) * R * .5 - .002, .002, .002, .004, WH_TRIM); }
      bx(s, fD + .03, dt + R + .01, dw + .04, .03, .018, WH_TRIM); // the hood
      for (const d of [-1, 1]) bx(s + d * (dw + .03), fD + .02, dt + R - .02, .007, .02, .03, WH_TRIM); // on its brackets
    } else bx(s, fD + .02, dt + .04, dw + .03, .02, .015, WH_TRIM);
  } else { // a shopfront: a stall riser, big windows between pilasters, a painted fascia and a striped awning
    const top = g0 + fh0 * .78, acc = st.accent;
    bx(sc, fD + .01, g0, L / 2 - .03, .01, .06, shade(acc, .7), M_PLANK);
    bx(sc - L * .18, fD + .004, g0 + .06, L * .26, .003, top - g0 - .06, '#2c3440', 0, lit(77)); bx(sc + L * .3, fD + .004, g0, L * .12, .003, top - g0, shade(acc, .55), M_PLANK);
    bx(sc, fD + .02, top, L / 2 - .02, .02, .05, acc, M_PLANK); // the fascia
    if (lod) { for (const s of [s0 + .03, sc + L * .12, s1 - .03]) bx(s, fD + .012, g0, .012, .012, top - g0, shade(acc, .85), M_PLANK);
      for (const s of [sc - L * .3, sc - L * .18, sc - L * .06]) bx(s, fD + .006, g0 + .06, .003, .003, top - g0 - .06, shade(acc, .85)); }
    const ac = AWN_C[(hash2(X, Z, 919) * AWN_C.length) | 0], n = lod ? 8 : 2; GLB.mat = 0; GLB.ctr = P(sc, fD - .3, top);
    for (let q = 0; q < n; q++) { const a = s0 + .03 + (L - .06) * q / n, b = s0 + .03 + (L - .06) * (q + 1) / n, c = gcol(q % 2 && lod ? '#f2ece0' : ac);
      gquad(P(a, fD + .03, top + .02), P(b, fD + .03, top + .02), P(b, fD + .2, top - .07), P(a, fD + .2, top - .07), c); }
    if (lod) bx(sc, fD + .2, top - .095, L / 2 - .03, .004, .025, ac); // its valance
  }
  // the roof: pitched, the ridge along the street; a ridge roll, fascia boards and (near) gutters and a downpipe
  const ye = H + crn, rh = .3, ov = .05, er = (on, s) => on ? s : s + Math.sign(s) * .035, a0 = er(lo, s0), a1 = er(hi, s1), RC = gcol(st.roof), rm = roofMat(RC);
  GLB.mat = rm; GLB.ctr = P(sc, fc, ye - .3);
  gquad(P(a0, fD + ov, ye - .02), P(a1, fD + ov, ye - .02), P(a1, fc, ye + rh), P(a0, fc, ye + rh), RC);
  gquad(P(a0, fB - ov, ye - .02), P(a1, fB - ov, ye - .02), P(a1, fc, ye + rh), P(a0, fc, ye + rh), RC);
  GLB.mat = wm; const WC = gcol(wallC);
  for (const [on, s] of [[lo, s0], [hi, s1]]) { const si = on ? s - Math.sign(s) * .003 : s; GLB.ctr = P(0, fc, ye); gtri(P(si, fD, ye), P(si, fB, ye), P(si, fc, ye + rh - .012), WC); } // the gable walls
  if (!lo || !hi) for (const [on, s] of [[lo, a0], [hi, a1]]) if (!on) for (const ff of [fD + ov, fB - ov]) gBeam(P(s, ff, ye - .02), P(s, fc, ye + rh), .008, WH_TRIM); // bargeboards
  const rl = Math.SQRT1_2; ob((a0 + a1) / 2, fc, ye + rh + .004, V3s(A, (a1 - a0) / 2), V3s(VA(V3s(F, rl), V3s(UP, rl)), .013), V3s(VA(V3s(UP, rl), V3s(F, -rl)), .013), shade(st.roof, .8)); // the ridge roll
  for (const ff of [fD + ov, fB - ov]) bx(sc, ff - Math.sign(ff) * .006, ye - .045, (a1 - a0) / 2, .006, .03, WH_TRIM); // fascia boards
  if (lod) { gLog(P(a0, fD + ov + .01, ye - .04), P(a1, fD + ov + .01, ye - .04), .011, '#3a3d42', '#2a2c30', 0); // the gutter
    if (!hi || hk(B, 23) < .5) { const s = hi ? s0 + .04 : s1 - .04; gLog(P(s, fD + .015, 0), P(s, fD + .015, ye - .03), .008, '#3a3d42', '#2a2c30', 0); bx(s, fD + .015, ye - .07, .016, .016, .03, '#3a3d42'); } }
  // dormers in the roof
  if (floors >= 2 && hk(B, 24) < .5) for (let k = 0; k < nb; k++) { if (k === (dk ? 0 : nb - 1) && nb > 2) continue;
    const s = bay(k), w = .055, f0 = fD - .1, yb = ye + rh * .22, hgt = .13, ft = f0 - .16;
    bx(s, (f0 + ft) / 2, yb - .03, w, (f0 - ft) / 2, hgt + .03, wallC, wm); win(s, f0, yb + .02, w * .62, hgt * .3, 60 + k, false, true);
    GLB.mat = rm; GLB.ctr = P(s, (f0 + ft) / 2, yb); const top = yb + hgt + .055;
    for (const d of [-1, 1]) gquad(P(s + d * (w + .015), f0 + .02, yb + hgt), P(s + d * (w + .015), ft, yb + hgt), P(s, ft, top), P(s, f0 + .02, top), RC);
    GLB.mat = wm; gtri(P(s - w, f0, yb + hgt), P(s + w, f0, yb + hgt), P(s, f0, top - .005), WC); }
  // chimney stacks on the party walls (one each: the lower house of a pair builds it) and at the ends of a row
  const stacks = [hi ? s1 : s1 - .05]; if (!lo) stacks.push(s0 + .05);
  for (const s of stacks) { const p = P(s, fc - .02, 0), sw = U ? .042 : .085, sd = U ? .085 : .042, top = y0 + ye + rh + .17;
    glChimney(p[0], y0 + ye + rh * .4, p[2], sw, sd, top, wallC, wm);
    if (lod) { GLB.mat = wm; glOBox([p[0], top - .03, p[2]], [sw + .012, 0, 0], [0, 0, sd + .012], [0, .014, 0], wallC); } } // corbelled out near the top
  // a back range: a lower wing out the back with a lean-to roof
  if (hk(B, 22) < .55) { const s = hk(B, 25) < .5 ? s0 + .16 : s1 - .16, w = .13, f1 = -.47, h2 = fh0 + fhU * .8;
    bx(s, (fB + f1) / 2, 0, w, (fB - f1) / 2, h2, wallC, wm); if (lod) win(s, f1, g0 + fh0 * .2, .035, fh0 * .27, 70, false, true);
    GLB.mat = rm; GLB.ctr = P(s, (fB + f1) / 2, h2 - .2); gquad(P(s - w - .02, f1 - .03, h2 - .01), P(s + w + .02, f1 - .03, h2 - .01), P(s + w + .02, fB, h2 + .12), P(s - w - .02, fB, h2 + .12), RC); }
  GLB.wall = sv; GLB.mat = 0;
};
