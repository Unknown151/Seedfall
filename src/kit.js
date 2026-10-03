/* ============================== the kit: proper parts for native models ============================== */
// Native models (homes.js, civic.js, industry.js, modern.js) are built from these, the way the worker house (house.js)
// is: real windows in frames with sills and lintels, doors in doorcases, roofs with ridges, bargeboards and gutters,
// chimney stacks, cornices on brackets, quoins, balconies, awnings, signs, fences and garden things.
// Everything is in a frame of its own, in world units (a tile is 1): s along the building's front, f out towards its
// street, y up from the ground. kSet puts the frame down; kSide(n, fn) turns it a quarter at a time (to work on a side
// wall with the same parts). A wall part takes the wall's f (ff) and faces out on its side (the sign of ff).
// Small parts only go into the near version of a chunk (KF.lod, from GLB.lod); the far one keeps shapes and glass.
const KF = { X: 0, Z: 0, y0: 0, A: [1, 0, 0], F: [0, 0, 1], id: 0, lod: false, rk: null }; // (rk: a roof the house style wants instead: dome, cone or pyramid)
function kSet(X, Z, A, F, id) { KF.X = X; KF.Z = Z; KF.y0 = GLB.base; KF.A = A; KF.F = F; KF.id = id || 0; KF.lod = !!GLB.lod; }
const kFrom = (dx, dy) => [[dy, 0, -dx], [dx, 0, dy]]; // the frame facing (dx, dy): [along, out]
function kRot(a, fn) { const A = KF.A, F = KF.F, c = Math.cos(a), s = Math.sin(a); KF.A = [A[0] * c + F[0] * s, 0, A[2] * c + F[2] * s]; KF.F = [F[0] * c - A[0] * s, 0, F[2] * c - A[2] * s]; try { fn(); } finally { KF.A = A; KF.F = F; } } // the frame turned by a (round buildings: a window at any angle)
function kSide(n, fn) { const a = KF.A, f = KF.F; for (let k = 0; k < n; k++) { const A = KF.A; KF.A = KF.F; KF.F = [-A[0], 0, -A[2]]; } try { fn(); } finally { KF.A = a; KF.F = f; } }
function kFace(B) { // a one-tile building faces the street (or road, or rails) beside it; with none, its own way
  const ds = [[0, 1], [1, 0], [0, -1], [-1, 0]], k0 = (hash2(B.id, 40, 131) * 4) | 0;
  for (let j = 0; j < 4; j++) { const [dx, dy] = ds[(k0 + j) % 4], x = B.x + dx, y = B.y + dy; if (inb(x, y) && netTile(idx(x, y))) return kFrom(dx, dy); }
  return kFrom(...ds[k0]);
}
function kSetB(B) { const [A, F] = kFace(B); kSet(GLB.x, GLB.y, A, F, B.id); }
function kP(s, f, y) { const A = KF.A, F = KF.F; return [KF.X + A[0] * s + F[0] * f, KF.y0 + y, KF.Z + A[2] * s + F[2] * f]; }
function kV(s, f, y) { const A = KF.A, F = KF.F; return [A[0] * s + F[0] * f, y, A[2] * s + F[2] * f]; }
const kLit = k => .03 + .94 * hash2(KF.id * 7 + k, 13, 71); // which windows are lit at night
const kH = n => hash2(KF.id, n, 137); // the model's own dice
// boxes, beams, faces: a box is the middle of its foot at (s, f, y), half-sizes along and out, then its height
function kBox(s, f, y, hs, hf, hy, col, mat = 0, e = 0) { GLB.mat = mat; glOBox(kP(s, f, y + hy / 2), kV(hs, 0, 0), kV(0, hf, 0), [0, hy / 2, 0], col, e); }
function kOB(s, f, y, a, b, c, col, mat = 0, e = 0) { GLB.mat = mat; glOBox(kP(s, f, y), kV(a[0], a[1], a[2]), kV(b[0], b[1], b[2]), kV(c[0], c[1], c[2]), col, e); } // a box round (s, f, y) on three half-vectors [s, f, y]
function kBeam(p, q, w, col, mat = 0, e = 0) { gBeam(kP(p[0], p[1], p[2]), kP(q[0], q[1], q[2]), w, col, mat, e); }
function kCtr(s, f, y) { GLB.ctr = kP(s, f, y); }
function kQ(a, b, c, d, col, mat = 0, e = 0) { GLB.mat = mat; gquad(kP(a[0], a[1], a[2]), kP(b[0], b[1], b[2]), kP(c[0], c[1], c[2]), kP(d[0], d[1], d[2]), gcol(col), e); }
function kT(a, b, c, col, mat = 0, e = 0) { GLB.mat = mat; gtri(kP(a[0], a[1], a[2]), kP(b[0], b[1], b[2]), kP(c[0], c[1], c[2]), gcol(col), e); }
function kLog(p, q, r, col, end, mat) { gLog(kP(p[0], p[1], p[2]), kP(q[0], q[1], q[2]), r, col, end, mat); }
function kCyl(s, f, y, r, h, col, mat = 0, n = 10, top = 1, e = 0) { // an upright cylinder (top: 0 for none, or a colour)
  if (!KF.lod && n > 8) n = Math.max(8, n >> 1); // (fewer sides far off)
  const c = gcol(col), ct = top === 1 ? c : top ? gcol(top) : null, C = kP(s, f, y); GLB.ctr = [C[0], C[1] + h / 2, C[2]];
  const P = (a, yy) => [C[0] + Math.cos(a) * r, yy, C[2] + Math.sin(a) * r];
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; GLB.mat = mat; gquad(P(a, C[1]), P(b, C[1]), P(b, C[1] + h), P(a, C[1] + h), c, e); if (ct) { GLB.mat = 0; gtri([C[0], C[1] + h, C[2]], P(b, C[1] + h), P(a, C[1] + h), ct, e); } }
}
function kCone(s, f, y, r, h, col, n = 12, mat = -1, r1 = 0) { // a cone (or, with r1, a cut cone) standing at y
  const c = gcol(col), C = kP(s, f, y); GLB.ctr = [C[0], C[1] - .05, C[2]]; GLB.mat = mat < 0 ? roofMat(c) : mat;
  const P = (a, rr, yy) => [C[0] + Math.cos(a) * rr, yy, C[2] + Math.sin(a) * rr];
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; if (r1) gquad(P(a, r, C[1]), P(b, r, C[1]), P(b, r1, C[1] + h), P(a, r1, C[1] + h), c); else gtri(P(a, r, C[1]), P(b, r, C[1]), [C[0], C[1] + h, C[2]], c); }
}
function kDome(s, f, y, r, h, col, mat = 0, e = 0) { const C = kP(s, f, y); glDomeAt(C[0] - GLB.x, C[2] - GLB.y, r, (C[1] - GLB.base) / ZS, h / ZS, col, e, mat); }
function kBlob(s, f, y, r, ry, col, mat = M_LEAF) { const C = kP(s, f, y); glBlob(C[0] - GLB.x, C[2] - GLB.y, r, (C[1] - GLB.base) / ZS, ry / ZS, col, mat); }
function kTree(s, f, y, h, sc, col) { const C = kP(s, f, y); glSmallTree(C[0] - GLB.x, C[2] - GLB.y, (C[1] - GLB.base) / ZS, h, sc, col); }
function kFlowers(s, f, y, h) { const C = kP(s, f, y); glFlowersUV(C[0] - GLB.x, C[2] - GLB.y, (C[1] - GLB.base) / ZS, h); }
function kTL(s, f) { const p = kP(s, f, 0); return [p[0] - GLB.x, p[2] - GLB.y]; } // tile-local (u, v)
function kHW(hs, hf) { const A = KF.A, F = KF.F; return [Math.abs(A[0]) * hs + Math.abs(F[0]) * hf, Math.abs(A[2]) * hs + Math.abs(F[2]) * hf]; } // half-sizes along x and z
function kAlongU() { return Math.abs(KF.A[0]) > .5; }

/* ---------- the look of an age ---------- */
const K_TRIM = '#efe9dc', K_STONE = '#cfc6b4', K_IRON = '#33363b', K_DARK = '#2c3440', K_WOOD = '#4a3426';
function kWinTy() { return hasTech('computing') ? 'glass' : hasTech('concrete') ? 'modern' : hasTech('masonry') ? 'sash' : 'case'; } // casements, then sashes, then steel, then glass
function kWall(B, st) { // a wall's colour and what it is made of
  const wm = glWallMat(B); if (st.painted) return [st.wall, wm === M_PLANK ? M_PLANK : M_PLASTER]; // (painted houses: rendered over, or painted boards)
  return wm === M_BRICK ? [mix(st.wall, '#a5573f', .55), M_BRICK] : wm === M_STONE ? [mix(st.wall, '#cdbfa6', .35), M_STONE] : wm === M_PLANK ? [mix(st.wall, '#8a6a4c', .45), M_PLANK] : [st.wall, wm];
}

/* ---------- windows: by the age, set back in frames, with sills, lintels or arches, shutters and boxes ---------- */
// o: ty ('case' | 'sash' | 'modern' | 'glass'), arch ('seg' | 'round'), key (a lintel with a keystone), shut (a colour),
// box (flowers), trim (frame colour), stone (sill and lintel), wall (for brick arches), back (plain, round the back)
function kWin(s, ff, y, hw, h, k, o = K_NO) {
  const g = Math.sign(ff) || 1, ty = o.ty || kWinTy(), tr = o.trim || (ty === 'case' ? K_WOOD : ty === 'modern' ? '#c9ced4' : K_TRIM), stn = o.stone || K_STONE, lod = KF.lod;
  if (!lod) { kPane(s, ff + g * .004, y, hw, h, ty === 'glass' ? '#33475a' : K_DARK, kLit(k)); if (o.arch === 'round') kPane(s, ff + g * .004, y + h, hw * .7, hw * .6, K_DARK, kLit(k)); return; } // (far off: one pane of glass)
  kPane(s, ff + g * .003, y, hw, h, ty === 'glass' ? '#33475a' : K_DARK, kLit(k)); // the glass, lit at night (the frame and bars are faces just proud of it: cheap)
  if (o.arch === 'round') { kCtr(s, ff - g * .1, y + h); for (let q = 0; q < 6; q++) { const a0 = q / 6 * Math.PI, a1 = (q + 1) / 6 * Math.PI; kT([s, ff + g * .003, y + h], [s + Math.cos(a0) * hw, ff + g * .003, y + h + Math.sin(a0) * hw], [s + Math.cos(a1) * hw, ff + g * .003, y + h + Math.sin(a1) * hw], K_DARK, 0, kLit(k)); } }
  if (ty !== 'glass') kBox(s, ff + g * .016, y - .014, hw * 1.25 + .004, .016, .014, ty === 'modern' ? '#b9bcc0' : stn, M_STONE); // the sill
  const fw = ty === 'modern' ? .004 : .006, hh = h / 2, back = o.back, F = (ss, yy, a, b, col, d = .006, m = 0) => kFc(ss, ff + g * d, yy, a, b, col, m);
  if (ty !== 'glass') { for (const d of [-1, 1]) F(s + d * (hw - fw), y, fw, h, tr); F(s, y, hw, fw * 1.5, tr); F(s, y + h - fw * 1.5, hw, fw * 1.5, tr); } // the frame
  if (ty === 'sash') { F(s, y + hh - .004, hw, .008, tr, .008); // the meeting rail, and glazing bars
    for (const d of back ? [0] : [-1 / 3, 1 / 3]) F(s + d * hw, y, .0028, h, tr, .005);
    if (!back) for (const t of [.25, .75]) F(s, y + h * t, hw, .004, tr, .005); }
  else if (ty === 'case') { F(s, y, .005, h, tr, .007); F(s, y + h * .68, hw, .007, tr, .007); // a mullion and a transom
    if (!back) for (const t of [.17, .34, .51, .85]) F(s, y + h * t, hw, .002, '#5a5a5a', .004); } // (leaded lights)
  else if (ty === 'modern') { F(s + hw * .33, y, .004, h, tr); F(s - hw * .33, y + h * .78, hw * .67, .004, tr); } // a steel mullion and a top-hung vent
  else { F(s, y, .003, h, '#7d858f', .005); F(s, y + h - .004, hw, .004, '#7d858f', .005); } // slim glazing frames
  if (o.arch === 'seg') { const R = hw * 1.25, cy = y + h - R * .55, wc = o.wall || '#a0604a'; for (let q = 0; q < 7; q++) { const a = .62 + q / 6 * (Math.PI - 1.24), m = [Math.cos(a), Math.sin(a)], t = [-m[1], m[0]]; // voussoirs round a segmental arch
      kFcR(s + m[0] * (R + .012), ff + g * .006, cy + m[1] * (R + .012), [t[0] * .011, t[1] * .011], [m[0] * .014, m[1] * .014], q === 3 ? stn : shade(wc, .82)); } }
  else if (o.arch === 'round') { for (let q = 0; q < 9; q++) { const a = q / 8 * Math.PI, m = [Math.cos(a), Math.sin(a)], t = [-m[1], m[0]]; kFcR(s + m[0] * (hw + .01), ff + g * .007, y + h + m[1] * (hw + .01), [t[0] * .01, t[1] * .01], [m[0] * .012, m[1] * .012], q === 4 ? stn : shade(stn, .94), M_STONE); } }
  else if (o.key) { kBox(s, ff + g * .006, y + h + .004, hw * 1.25, .006, .026, stn, M_STONE); kBox(s, ff + g * .011, y + h + .002, .011, .008, .034, stn, M_STONE); } // a lintel and its keystone
  else if (o.ped) { kBox(s, ff + g * .008, y + h + .004, hw * 1.3, .008, .012, stn, M_STONE); kCtr(s, ff - g * .1, y + h); kT([s - hw * 1.35, ff + g * .012, y + h + .016], [s + hw * 1.35, ff + g * .012, y + h + .016], [s, ff + g * .012, y + h + .05], stn, M_STONE); } // a little pediment
  else if (ty !== 'glass' && !back) kBox(s, ff + g * .005, y + h + .002, hw * 1.15, .005, .014, ty === 'case' ? K_WOOD : stn, ty === 'case' ? M_PLANK : M_STONE); // a plain lintel
  if (o.shut) for (const d of [-1, 1]) { F(s + d * (hw + hw * .5), y, hw * .48, h, o.shut, .006, M_PLANK); for (let t = .2; t < .9; t += .2) F(s + d * (hw + hw * .5), y + h * t, hw * .44, .003, shade(o.shut, .8), .008); } // shutters, louvred
  if (o.box || LVV.deco === 'flower_boxes' && !back && ty !== 'glass' && kLit(k + 3) < .6) { kBox(s, ff + g * .03, y - .034, hw * 1.1, .016, .022, '#6b4a32', M_PLANK); kBox(s, ff + g * .03, y - .014, hw * 1.02, .014, .008, '#4f8a45');
    for (let q = 0; q < 3; q++) kBlob(s + (q - 1) * hw * .62, ff + g * .03, y - .004, .013, .012, FLOWER_C[(q + KF.id + k) % FLOWER_C.length], 0); }
}
const K_NO = {};
function kFc(s, ff, y, hs, h, col, mat = 0) { GLB.mat = mat; glFace(kP(s, ff, y + h / 2), kV(hs, 0, 0), [0, h / 2, 0], kV(0, Math.sign(ff) || 1, 0), col); } // a flat face on a wall at ff (frames, bars, shutters)
function kFcR(s, ff, y, a, u, col, mat = 0) { GLB.mat = mat; glFace(kP(s, ff, y), kV(a[0], 0, a[1]), kV(u[0], 0, u[1]), kV(0, Math.sign(ff) || 1, 0), col); } // a face turned in the wall's plane: a and u half-vectors [along, up]
function kPane(s, ff, y, hw, h, col, e = 0, mat = 0) { const g = Math.sign(ff) || 1; kCtr(s, ff - g, y); kQ([s - hw, ff, y], [s + hw, ff, y], [s + hw, ff, y + h], [s - hw, ff, y + h], col, mat, e); } // one flat face on a wall (far off)
// a row of windows across a wall, floor by floor (skip(k, fk) leaves a gap: a door, a shopfront)
function kWins(s0, s1, ff, y0, fh, floors, n, o = K_NO, skip = null, hk0 = 0) {
  const L = s1 - s0, hw = Math.min(o.hw || .05, L / n * .28);
  for (let fk = 0; fk < floors; fk++) for (let k = 0; k < n; k++) { if (skip && skip(k, fk)) continue;
    const h = fh * (o.hk || .5) * (fk === 0 && o.tall0 ? 1.15 : 1);
    kWin(s0 + (k + .5) * L / n, ff, y0 + fk * fh + fh * (o.yk || .26), hw, h, hk0 + fk * 13 + k, o); }
}

/* ---------- doors: plank, panelled or glazed, in a doorcase; a fanlight, a hood or a pediment; steps ---------- */
// o: ty ('plank' | 'panel' | 'glass'), fan, hood ('flat' | 'pent' | 'ped' | 'canopy'), pil (pilasters), steps, trim, roof (for a pent hood)
function kDoor(s, ff, w, h, col, o = K_NO) {
  const g = Math.sign(ff) || 1, ty = o.ty || (hasTech('concrete') ? 'glass' : hasTech('masonry') ? 'panel' : 'plank'), tr = o.trim || (ty === 'plank' ? K_WOOD : K_TRIM), lod = KF.lod, st = o.steps || 0;
  const y0 = o.y || 0; for (let q = 0; q < st; q++) kBox(s, ff + g * (.02 + (st - q) * .02), y0 + q * .022, w + .03, .02 + (st - q) * .02, .022, K_STONE, M_STONE); // steps
  const y = y0 + st * .022;
  if (!lod) { kPane(s, ff + g * .004, y, w, h, ty === 'glass' ? '#3a4652' : col, ty === 'glass' ? .5 : 0, ty === 'glass' ? 0 : M_PLANK); return y + h + (o.fan ? w : 0) + .01; }
  kBox(s, ff + g * .002, y, w, .003, h, ty === 'glass' ? '#3a4652' : col, ty === 'glass' ? 0 : M_PLANK, ty === 'glass' ? .5 : 0);
  if (lod) {
    if (ty === 'plank') { for (let q = 1; q < 4; q++) kBox(s - w + q * w / 2, ff + g * .004, y, .002, .002, h * .97, shade(col, .8)); for (const t of [.2, .75]) kBox(s, ff + g * .006, y + h * t, w * .9, .002, .008, K_IRON); kBox(s + w * .65, ff + g * .007, y + h * .5, .005, .004, .005, K_IRON); } // boards, strap hinges, a latch
    else if (ty === 'panel') { for (const d of [-1, 1]) for (const t of [.06, .52]) kBox(s + d * w * .48, ff + g * .005, y + h * t, w * .36, .003, h * .38, shade(col, 1.12)); kBox(s + w * .62, ff + g * .008, y + h * .48, .004, .004, .008, '#d6b45a'); }
    else { kBox(s, ff + g * .005, y, .004, .004, h, '#8c939b'); kBox(s, ff + g * .005, y + h - .006, w, .004, .006, '#8c939b'); kBox(s, ff + g * .006, y + h * .48, w * .7, .004, .004, '#c9ced4'); } // a glazed door: its frame and push bar
    for (const d of [-1, 1]) kBox(s + d * (w + .008), ff + g * .007, y, .008, .007, h + .01, tr); // the frame
    kBox(s, ff + g * .007, y + h, w + .016, .007, .01, tr);
    if (o.pil) for (const d of [-1, 1]) kBox(s + d * (w + .022), ff + g * .011, y, .011, .01, h + (o.fan ? w + .03 : .03), tr);
  }
  let top = y + h + .01;
  if (o.fan) { kCtr(s, ff - g * .1, top); for (let q = 0; q < 7; q++) { const a0 = q / 7 * Math.PI, a1 = (q + 1) / 7 * Math.PI; kT([s, ff + g * .004, top], [s + Math.cos(a0) * w, ff + g * .004, top + Math.sin(a0) * w], [s + Math.cos(a1) * w, ff + g * .004, top + Math.sin(a1) * w], K_DARK, 0, kLit(99)); }
    if (lod) for (let q = 0; q < 4; q++) { const a = (q + .5) / 4 * Math.PI; kBox(s + Math.cos(a) * w * .5, ff + g * .006, top + Math.sin(a) * w * .5 - .002, .002, .002, .004, tr); }
    top += w; }
  if (o.hood === 'flat') { kBox(s, ff + g * .03, top + .01, w + .04, .03, .018, tr); if (lod) for (const d of [-1, 1]) kBox(s + d * (w + .03), ff + g * .02, top - .02, .007, .02, .03, tr); }
  else if (o.hood === 'pent') { const rc = o.roof || '#5d6670', d = .09; kCtr(s, ff, top - .1); kQ([s - w - .04, ff, top + .07], [s + w + .04, ff, top + .07], [s + w + .04, ff + g * d, top + .01], [s - w - .04, ff + g * d, top + .01], rc, roofMat(gcol(rc)));
    if (lod) for (const dd of [-1, 1]) kBeam([s + dd * (w + .03), ff, top - .04], [s + dd * (w + .03), ff + g * d * .9, top + .015], .005, tr, M_PLANK); }
  else if (o.hood === 'ped') { kBox(s, ff + g * .02, top + .01, w + .04, .02, .014, tr); kCtr(s, ff - g * .1, top); kT([s - w - .045, ff + g * .03, top + .024], [s + w + .045, ff + g * .03, top + .024], [s, ff + g * .03, top + .075], tr); }
  else if (o.hood === 'canopy') { kBox(s, ff + g * .07, top + .02, w + .06, .07, .012, o.roof || '#3d4248'); if (lod) for (const d of [-1, 1]) kBeam([s + d * (w + .05), ff + g * .13, top + .02], [s + d * (w + .03), ff, top + .1], .003, K_IRON); }
  return top;
}

/* ---------- roofs: gabled, hipped, flat with a parapet, a mansard; ridges, bargeboards, fascias, gutters ---------- */
// kGable: the ridge along s, over walls from fB (back) to fD (front), eaves at ye. o: lo, hi (party walls at s0, s1:
// no overhang, no bargeboards), ov (eaves), wall + wm (the gable ends), noGut
function kGable(s0, s1, fB, fD, ye, rh, col, o = K_NO) {
  if (KF.rk) return kRoofAlt(s0, s1, fB, fD, ye, rh, col, o);
  const RC = gcol(col), rm = roofMat(RC), th = rm === M_THATCH, ov = o.ov != null ? o.ov : th ? .07 : .05, fc = (fB + fD) / 2, er = .035, lod = KF.lod;
  const a0 = o.lo ? s0 : s0 - (th ? .05 : er), a1 = o.hi ? s1 : s1 + (th ? .05 : er), sc = (s0 + s1) / 2, wc = o.wall || '#d8cfc0', drop = (rh / ((fD - fB) / 2)) * ov;
  kCtr(sc, fc, ye - .3);
  kQ([a0, fD + ov, ye - drop], [a1, fD + ov, ye - drop], [a1, fc, ye + rh], [a0, fc, ye + rh], RC, rm);
  kQ([a0, fB - ov, ye - drop], [a1, fB - ov, ye - drop], [a1, fc, ye + rh], [a0, fc, ye + rh], RC, rm);
  for (const [on, s] of [[o.lo, s0], [o.hi, s1]]) { const si = on ? s - Math.sign(s - sc) * .003 : s; kCtr(sc, fc, ye); kT([si, fD, ye], [si, fB, ye], [si, fc, ye + rh - .01], wc, o.wm || 0); } // the gable walls
  if (th) { // thatch: thick at the eaves and the verges, a ridge roll pinned with liggers
    for (const ff of [fD + ov, fB - ov]) kBox(sc, ff - Math.sign(ff) * .02, ye - drop - .03, (a1 - a0) / 2, .022, .035, shade(col, .82), M_THATCH);
    for (const [on, s] of [[o.lo, a0], [o.hi, a1]]) if (!on) for (const ff of [fD + ov, fB - ov]) kBeam([s, ff, ye - drop - .01], [s, fc, ye + rh], .022, shade(col, .88), M_THATCH);
    kOB(sc, fc, ye + rh - .005, [(a1 - a0) / 2, 0, 0], [0, .045, 0], [0, 0, .03], shade(col, .78), M_THATCH);
    if (lod) for (let s = a0 + .04; s < a1 - .02; s += .06) for (const d of [-1, 1]) kBeam([s, fc + d * .04, ye + rh - .03], [s + .03, fc + d * .04, ye + rh - .03], .003, '#7a6040');
    return;
  }
  if (lod) for (const [on, s] of [[o.lo, a0], [o.hi, a1]]) if (!on) for (const ff of [fD + ov, fB - ov]) kBeam([s, ff, ye - drop], [s, fc, ye + rh], .008, o.barge || K_TRIM, M_PLANK); // bargeboards
  const rl = Math.SQRT1_2, sl = rh / Math.hypot(rh, (fD - fB) / 2); // the ridge roll
  kOB(sc, fc, ye + rh + .004, [(a1 - a0) / 2, 0, 0], [0, rl * .013, rl * .013], [0, -rl * .013, rl * .013], shade(col, .78), rm);
  if (lod) for (const ff of [fD + ov, fB - ov]) kBox(sc, ff - Math.sign(ff) * .006, ye - drop - .03, (a1 - a0) / 2, .006, .03, o.barge || K_TRIM, M_PLANK); // fascia boards
  if (lod && !o.noGut) for (const ff of [fD + ov + .01, fB - ov - .01]) kLog([a0, ff, ye - drop - .025], [a1, ff, ye - drop - .025], .01, '#3a3d42', '#2a2c30', 0); // gutters
  return sl;
}
// the four walls of a box (s0..s1 along, fB..fD out): fn(a, b, ff, k) works on each as if it were the front, from a to b
// along it, its plane at ff (k: 0 the front, 1 the s1 end, 2 the back, 3 the s0 end). The frame is moved to the box's
// middle while fn runs, so a, b and ff are from there (and the parts face the right way wherever the box stands)
function kWalls(s0, s1, fB, fD, fn, which = 15) {
  const hs = (s1 - s0) / 2, hf = (fD - fB) / 2, X = KF.X, Z = KF.Z, P = kP((s0 + s1) / 2, (fB + fD) / 2, 0); KF.X = P[0]; KF.Z = P[2];
  try {
    if (which & 1) fn(-hs, hs, hf, 0);
    if (which & 2) kSide(1, () => fn(-hf, hf, -hs, 1));
    if (which & 4) kSide(2, () => fn(-hs, hs, hf, 2));
    if (which & 8) kSide(3, () => fn(-hf, hf, -hs, 3));
  } finally { KF.X = X; KF.Z = Z; }
}
function kGableF(s0, s1, fB, fD, ye, rh, col, o = K_NO) { kSide(1, () => kGable(fB, fD, -s1, -s0, ye, rh, col, o)); } // the gable end to the street
// kHip: hipped (a pyramid when square), eaves overhang ov
// an elliptical dome or cone over (sc, fc): hs along, hf out (n sides; a cone is a dome with one ring)
function kEDome(sc, fc, y, hs, hf, h, col, mat = -1, cone = false, n = 16) {
  const C = gcol(col), m = mat < 0 ? roofMat(C) : mat, rings = cone ? 1 : KF.lod ? 5 : 3; kCtr(sc, fc, y - .05);
  const P = (a, t) => cone ? (t ? [sc, fc, y + h] : [sc + Math.cos(a) * hs, fc + Math.sin(a) * hf, y]) : [sc + Math.cos(a) * hs * Math.cos(t), fc + Math.sin(a) * hf * Math.cos(t), y + h * Math.sin(t)];
  for (let j = 0; j < rings; j++) { const t0 = cone ? 0 : j / rings * Math.PI / 2, t1 = cone ? 1 : (j + 1) / rings * Math.PI / 2;
    for (let k = 0; k < n; k++) { const a0 = k / n * TAU, a1 = (k + 1) / n * TAU; if (cone) kT(P(a0, 0), P(a1, 0), P(0, 1), C, m); else kQ(P(a0, t0), P(a1, t0), P(a1, t1), P(a0, t1), C, m); } }
}
// a house style's own roof in place of a gable or hip: a dome (with a little lantern), a cone (with a finial) or a pyramid
function kRoofAlt(s0, s1, fB, fD, ye, rh, col, o = K_NO) {
  const sc = (s0 + s1) / 2, fc = (fB + fD) / 2, hs = (s1 - s0) / 2 + .03, hf = (fD - fB) / 2 + .03, rk = KF.rk;
  kBox(sc, fc, ye - .005, hs, hf, .02, shade(col, .8), roofMat(gcol(col))); // (the eaves)
  if (rk === 'dome') { kEDome(sc, fc, ye + .015, hs, hf, Math.max(rh, Math.min(hs, hf) * .9), col, M_SLATE); if (KF.lod) { const h = Math.max(rh, Math.min(hs, hf) * .9); kCyl(sc, fc, ye + h, .025, .03, '#e8e2d6', M_STONE, 8); kBlob(sc, fc, ye + h + .04, .02, .015, '#c9a447', 0); } }
  else if (rk === 'cone') { kEDome(sc, fc, ye + .015, hs, hf, rh * 1.6, col, -1, true); if (KF.lod) kBox(sc, fc, ye + rh * 1.6, .006, .006, .05, '#8c8f94'); }
  else { const P = [[sc - hs, fc - hf], [sc + hs, fc - hf], [sc + hs, fc + hf], [sc - hs, fc + hf]], T = [sc, fc, ye + rh * 1.3], C = gcol(col), m = roofMat(C); kCtr(sc, fc, ye - .1);
    for (let k = 0; k < 4; k++) kT([P[k][0], P[k][1], ye + .015], [P[(k + 1) % 4][0], P[(k + 1) % 4][1], ye + .015], T, C, m); if (KF.lod) kBox(sc, fc, ye + rh * 1.3, .008, .008, .04, '#8c8f94'); }
}
function kHip(s0, s1, fB, fD, ye, rh, col, o = K_NO) {
  if (KF.rk && !o.bare) return kRoofAlt(s0, s1, fB, fD, ye, rh, col, o);
  const RC = gcol(col), rm = o.mat != null ? o.mat : roofMat(RC), ov = o.ov != null ? o.ov : .045, sc = (s0 + s1) / 2, fc = (fB + fD) / 2, hs = (s1 - s0) / 2 + ov, hf = (fD - fB) / 2 + ov, r = Math.max(0, hs - hf), drop = rh / hf * ov * .6;
  const e = [[sc - hs, fc - hf], [sc + hs, fc - hf], [sc + hs, fc + hf], [sc - hs, fc + hf]], R0 = [sc - r, fc, ye + rh], R1 = [sc + r, fc, ye + rh];
  kCtr(sc, fc, ye - .3); const E = e.map(q => [q[0], q[1], ye - drop]);
  kQ(E[0], E[1], R1, R0, RC, rm); kQ(E[3], E[2], R1, R0, RC, rm); kT(E[1], E[2], R1, RC, rm); kT(E[0], E[3], R0, RC, rm);
  if (o.bare) return;
  if (KF.lod) { const cap = shade(col, .78); if (r > .01) kBeam(R0, R1, .011, cap, rm); for (let k = 0; k < 4; k++) kBeam(E[k], k === 0 || k === 3 ? R0 : R1, .008, cap, rm);
    if (!o.noGut) for (let k = 0; k < 4; k++) kLog(V3a(E[k], [0, -.02, 0]), V3a(E[(k + 1) % 4], [0, -.02, 0]), .009, '#3a3d42', '#2a2c30', 0); }
  for (let k = 0; k < 4; k++) { const a = E[k], b = E[(k + 1) % 4]; kOB((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, ye - drop - .015, [(b[0] - a[0]) / 2, (b[1] - a[1]) / 2, 0], [(b[1] - a[1]) ? .005 : 0, (b[0] - a[0]) ? .005 : 0, 0], [0, 0, .015], o.barge || K_TRIM); } // fascias
  if (o.fin && KF.lod) kBox(sc, fc, ye + rh, .008, .008, .05, '#8c8f94'); // a finial
}
// kFlat: a flat roof with a parapet and its coping (ph its height); bits: lived-on things on top
function kFlat(s0, s1, fB, fD, ye, col, ph = .04, o = K_NO) {
  const sc = (s0 + s1) / 2, fc = (fB + fD) / 2, hs = (s1 - s0) / 2, hf = (fD - fB) / 2, cop = o.cop || shade(col, 1.15);
  const gdn = DS && DS.roofK === 'garden'; kBox(sc, fc, ye, hs - .01, hf - .01, gdn ? .014 : .006, gdn ? '#7cc47f' : '#77736c', gdn ? M_GRASS : M_TAR); // (a roof garden in the style that wants one)
  if (gdn && KF.lod) for (let q = 0; q < 3; q++) kBlob(sc - hs * .5 + q * hs * .5, fc + (q % 2 ? .3 : -.3) * hf, ye + .02, .04, .03, leafC('#5f9a4d'));
  if (ph > 0) { const wm = o.wm || 0;
    kBox(sc, fD - .012, ye, hs, .012, ph, col, wm); kBox(sc, fB + .012, ye, hs, .012, ph, col, wm);
    if (!o.lo) kBox(s0 + .012, fc, ye, .012, hf, ph, col, wm); if (!o.hi) kBox(s1 - .012, fc, ye, .012, hf, ph, col, wm);
    kBox(sc, fD - .006, ye + ph, hs + .006, .016, .01, cop, M_STONE); kBox(sc, fB + .006, ye + ph, hs + .006, .016, .01, cop, M_STONE);
    if (!o.lo) kBox(s0 + .006, fc, ye + ph, .016, hf, .01, cop, M_STONE); if (!o.hi) kBox(s1 - .006, fc, ye + ph, .016, hf, .01, cop, M_STONE); }
}
function kMansard(s0, s1, fB, fD, ye, rh, col) { if (KF.rk) return kRoofAlt(s0, s1, fB, fD, ye, rh, col); const [u, v] = kTL((s0 + s1) / 2, (fB + fD) / 2), [hw, hd] = kHW((s1 - s0) / 2, (fD - fB) / 2); glMansard(u, v, hw, hd, (ye) / ZS, rh / ZS, col); }
// a chimney stack (w along s, d along f) from yb to top, with its cap and pots
function kChim(s, f, yb, top, w, d, col, mat) { const p = kP(s, f, yb), [hw, hd] = kHW(w, d); glChimney(p[0], p[1], p[2], hw, hd, KF.y0 + top, col, mat); if (KF.lod) { GLB.mat = mat; glOBox([p[0], KF.y0 + top - .03, p[2]], [hw + .01, 0, 0], [0, 0, hd + .01], [0, .013, 0], col); } }
// a dormer in a roof slope facing out (f+), its window wall at ff
function kDormer(s, ff, yb, w, h, depth, rc, wc, wm, k) {
  kBox(s, ff - depth / 2, yb - .03, w, depth / 2, h + .03, wc, wm); kWin(s, ff, yb + .015, w * .62, h * .62, 60 + k, { back: 1 });
  kCtr(s, ff - depth / 2, yb); const top = yb + h + .055, RC = gcol(rc), rm = roofMat(RC);
  for (const d of [-1, 1]) kQ([s + d * (w + .015), ff + .02, yb + h], [s + d * (w + .015), ff - depth, yb + h], [s, ff - depth, top], [s, ff + .02, top], RC, rm);
  kT([s - w, ff, yb + h], [s + w, ff, yb + h], [s, ff, top - .005], wc, wm);
}

/* ---------- mouldings: plinth, string course, cornice (with brackets or dentils), quoins, pilasters, a pediment ---------- */
function kPlinth(s0, s1, fB, fD, h, col = K_STONE, o = K_NO) { kBox((s0 + s1) / 2, (fB + fD) / 2, 0, (s1 - s0) / 2 + (o.lo || o.hi ? 0 : .012), (fD - fB) / 2 + .012, h, col, M_STONE); }
function kBand(s0, s1, ff, y, col = K_STONE, d = .012) { kBox((s0 + s1) / 2, ff + Math.sign(ff) * d / 2, y, (s1 - s0) / 2, d, .018, col, M_STONE); }
function kCornice(s0, s1, fB, fD, y, col = K_STONE, o = K_NO) {
  const sc = (s0 + s1) / 2, fc = (fB + fD) / 2, ov = o.ov || .025;
  kBox(sc, fc, y, (s1 - s0) / 2 + (o.lo || o.hi ? 0 : ov), (fD - fB) / 2 + ov, o.h || .032, col, M_STONE);
  if (KF.lod && o.br !== 0) for (let s = s0 + .03; s < s1 - .02; s += o.br || .055) kBox(s, fD + .016, y - .02, .008, .01, .02, col, M_STONE); // brackets (or dentils)
}
function kQuoins(s, f0, f1, y0, y1, col = K_STONE) { // dressed stones up a corner: the corner at s, the wall from f0 to f1 (both faces get them)
  if (!KF.lod) return; const g = Math.sign(s) || 1;
  for (let y = y0, k = 0; y < y1 - .04; y += .055, k++) { const lg = k % 2 ? .045 : .028;
    for (const ff of [f0, f1]) kBox(s - g * (lg / 2 - .006), ff + Math.sign(ff) * .004, y + .003, lg / 2, .006, .049, col, M_STONE);
    kBox(s + g * .004, f1 - (k % 2 ? .028 : .045) / 2 + .006, y + .003, .006, (k % 2 ? .028 : .045) / 2, .049, col, M_STONE); }
}
function kPilasters(s0, s1, n, ff, y0, y1, col = K_TRIM, w = .012) { if (!KF.lod) return; for (let k = 0; k <= n; k++) kBox(s0 + k / n * (s1 - s0), ff + Math.sign(ff) * .006, y0, w, .006, y1 - y0, col, M_STONE); }
function kPed(s0, s1, ff, y, h, col = K_STONE, tymp) { // a pediment over a front: its cornice and the triangle
  const g = Math.sign(ff) || 1, sc = (s0 + s1) / 2; kBox(sc, ff + g * .02, y, (s1 - s0) / 2 + .02, .04, .02, col, M_STONE);
  kCtr(sc, ff - g * .2, y); kT([s0 - .02, ff + g * .02, y + .02], [s1 + .02, ff + g * .02, y + .02], [sc, ff + g * .02, y + .02 + h], tymp || col, M_STONE);
  if (KF.lod) for (const d of [-1, 1]) kBeam([sc + d * ((s1 - s0) / 2 + .03), ff + g * .03, y + .02], [sc, ff + g * .03, y + .03 + h], .009, shade(col, 1.05), M_STONE);
}
function kCols(s0, s1, n, ff, y, h, r, col = '#f1ece2') { // a row of columns, with bases and capitals near
  for (let k = 0; k < n; k++) { const s = n > 1 ? s0 + k / (n - 1) * (s1 - s0) : (s0 + s1) / 2; kCyl(s, ff, y, r, h, col, M_STONE, KF.lod ? 10 : 6, 0);
    if (KF.lod) { kBox(s, ff, y, r * 1.35, r * 1.35, .014, col, M_STONE); kBox(s, ff, y + h - .016, r * 1.4, r * 1.4, .016, col, M_STONE); } }
}

/* ---------- on the front: balconies, awnings, signs, lanterns, a clock, a shopfront ---------- */
function kBalc(s, ff, y, hw, d, o = K_NO) { // a balcony: its slab and a railing (iron or, modern, glass)
  const g = Math.sign(ff) || 1, glass = o.glass, rc = o.rail || (glass ? '#bfdce8' : K_IRON); kBox(s, ff + g * d / 2, y, hw, d / 2, .012, o.slab || '#c9c6c0', M_STONE);
  if (!KF.lod) { kPane(s, ff + g * d, y + .012, hw, glass ? .05 : .045, rc); return; }
  if (glass) { kBox(s, ff + g * (d - .003), y + .012, hw, .003, .05, rc, 0); for (const dd of [-1, 1]) kBox(s + dd * (hw - .003), ff + g * d / 2, y + .012, .003, d / 2, .05, rc); if (KF.lod) kBox(s, ff + g * (d - .003), y + .062, hw, .005, .004, '#9aa3ad'); return; }
  kBox(s, ff + g * (d - .003), y + .052, hw, .004, .004, rc); for (const dd of [-1, 1]) kBox(s + dd * (hw - .003), ff + g * d / 2, y + .052, .003, d / 2, .004, rc);
  if (KF.lod) for (let t = -hw + .008; t <= hw - .004; t += .014) kFc(s + t, ff + g * (d - .002), y + .012, .0016, .04, rc);
  else kBox(s, ff + g * (d - .003), y + .012, hw, .001, .04, rc);
}
function kAwn(s, ff, y, hw, col, out = .16, drop = .07) { // a striped awning sloping out, with a valance
  const g = Math.sign(ff) || 1, n = KF.lod ? Math.max(4, Math.round(hw * 2 / .04)) : 2; kCtr(s, ff - g * .3, y);
  for (let q = 0; q < n; q++) { const a = s - hw + hw * 2 * q / n, b = s - hw + hw * 2 * (q + 1) / n, c = q % 2 && KF.lod ? '#f2ece0' : col;
    kQ([a, ff + g * .01, y], [b, ff + g * .01, y], [b, ff + g * out, y - drop], [a, ff + g * out, y - drop], c, M_PLANK);
    if (KF.lod) kQ([a, ff + g * out, y - drop], [b, ff + g * out, y - drop], [b, ff + g * out, y - drop - .022], [a, ff + g * out, y - drop - .022], c, M_PLANK); }
}
function kSign(s, ff, y, col, text) { // a hanging sign on an iron bracket
  const g = Math.sign(ff) || 1; kBeam([s, ff, y + .02], [s, ff + g * .1, y + .02], .004, K_IRON);
  kBox(s, ff + g * .07, y - .055, .003, .035, .065, col, M_PLANK); if (KF.lod) kBox(s, ff + g * .07, y - .045, .005, .025, .045, text || '#efe2c0');
  if (KF.lod) for (const d of [.045, .095]) kBeam([s, ff + g * d, y + .02], [s, ff + g * d, y + .01], .0015, K_IRON);
}
function kLantern(s, ff, y) { const g = Math.sign(ff) || 1; if (KF.lod) kBeam([s, ff, y], [s, ff + g * .04, y + .01], .003, K_IRON); kBox(s, ff + g * .04, y - .025, .011, .011, .03, '#ffe2a0', 0, 2); kBox(s, ff + g * .04, y + .005, .014, .014, .006, K_IRON); }
function kClock(s, ff, y, r, col = '#f4f0e0') { // a clock face, its rim and hands
  const g = Math.sign(ff) || 1, n = KF.lod ? 16 : 8; kCtr(s, ff - g * .2, y);
  for (let q = 0; q < n; q++) { const a0 = q / n * TAU, a1 = (q + 1) / n * TAU; kT([s, ff + g * .004, y], [s + Math.cos(a0) * r, ff + g * .004, y + Math.sin(a0) * r], [s + Math.cos(a1) * r, ff + g * .004, y + Math.sin(a1) * r], col, 0, .5); }
  if (!KF.lod) return;
  for (let q = 0; q < 12; q++) { const a = q / 12 * TAU, m = [Math.cos(a), Math.sin(a)], t = [-m[1], m[0]]; kOB(s + m[0] * (r + .006), ff + g * .004, y + m[1] * (r + .006), [t[0] * .007, 0, t[1] * .007], [0, .004, 0], [m[0] * .006, 0, m[1] * .006], '#c9a24a'); }
  kBeam([s, ff + g * .007, y], [s + r * .45, ff + g * .007, y + r * .3], .003, K_IRON); kBeam([s, ff + g * .008, y], [s - r * .1, ff + g * .008, y + r * .75], .0025, K_IRON);
}
function kShop(s0, s1, ff, y, h, acc, k = 0) { // a shopfront: a stall riser, big windows between pilasters, a painted fascia and an awning
  const g = Math.sign(ff) || 1, sc = (s0 + s1) / 2, L = s1 - s0, top = y + h;
  kBox(sc, ff + g * .01, y, L / 2 - .02, .01, .05, shade(acc, .7), M_PLANK);
  kBox(sc - L * .14, ff + g * .004, y + .05, L * .3, .003, h - .05, K_DARK, 0, kLit(77 + k)); kBox(sc + L * .32, ff + g * .004, y, L * .11, .003, h, shade(acc, .55), M_PLANK); // the window and the shop door
  kBox(sc, ff + g * .02, top, L / 2 - .01, .02, .05, acc, M_PLANK); // the fascia
  if (KF.lod) { for (const s of [s0 + .02, sc + L * .19, s1 - .02]) kBox(s, ff + g * .012, y, .012, .012, h, shade(acc, .85), M_PLANK);
    for (const s of [sc - L * .3, sc - L * .14, sc + L * .02]) kBox(s, ff + g * .006, y + .05, .003, .003, h - .05, shade(acc, .85));
    kBox(sc - L * .1, ff + g * .024, top + .014, L * .25, .003, .022, '#efe2c0'); // its painted name
    for (let q = 0; q < 4; q++) kBox(sc - L * .38 + q * L * .08, ff - g * .02, y + .05, .015, .015, .03, FOOD_C[(q + k + KF.id) % FOOD_C.length]); } // goods in the window
  kAwn(sc, ff, top - .004, L / 2 - .03, AWN_C[(kH(41) * AWN_C.length) | 0], .17, .065);
}
const FOOD_C = ['#c0392b', '#e0a43a', '#6aa556', '#8a5a9a', '#d8b86a', '#e8e0d0'];

/* ---------- round about: fences, hedges, paths, gardens, barrels, crates, benches, a water butt, a washing line ---------- */
function kFence(pts, h = .055, col = '#e9e2d4', ty = 'picket') { // along a line of [s, f] points
  for (let k = 0; k < pts.length - 1; k++) { const [a0, b0] = pts[k], [a1, b1] = pts[k + 1], L = Math.hypot(a1 - a0, b1 - b0);
    if (ty === 'hedge') { kOB((a0 + a1) / 2, (b0 + b1) / 2, h / 2, [(a1 - a0) / 2, (b1 - b0) / 2, 0], [(b1 - b0) / L * .025, -(a1 - a0) / L * .025, 0], [0, 0, h / 2], leafC('#4f8a45'), M_LEAF); continue; }
    if (ty === 'wall') { kOB((a0 + a1) / 2, (b0 + b1) / 2, h / 2, [(a1 - a0) / 2, (b1 - b0) / 2, 0], [(b1 - b0) / L * .014, -(a1 - a0) / L * .014, 0], [0, 0, h / 2], col, M_STONE); continue; }
    if (!KF.lod) { kOB((a0 + a1) / 2, (b0 + b1) / 2, h * .4, [(a1 - a0) / 2, (b1 - b0) / 2, 0], [(b1 - b0) / L * .004, -(a1 - a0) / L * .004, 0], [0, 0, h * .4], col, M_PLANK); continue; } // (far off: one low panel)
    for (const y of [h * .3, h * .8]) kBeam([a0, b0, y], [a1, b1, y], .003, col, M_PLANK);
    const n = KF.lod ? Math.max(1, Math.round(L / (ty === 'picket' ? .022 : .09))) : Math.max(1, Math.round(L / .12));
    for (let q = 0; q <= n; q++) { const t = q / n, s = a0 + (a1 - a0) * t, f = b0 + (b1 - b0) * t, post = !KF.lod || q % 4 === 0 || ty !== 'picket'; kBox(s, f, 0, post ? .005 : .003, post ? .005 : .002, post ? h * 1.08 : h, col, M_PLANK); } }
}
function kPath(s0, f0, s1, f1, col = '#b8ad9c', mat = M_STONE) { kBox((s0 + s1) / 2, (f0 + f1) / 2, 0, Math.abs(s1 - s0) / 2, Math.abs(f1 - f0) / 2, .006, col, mat); }
function kBeds(s0, f0, s1, f1, rows, crop = '#6aa556') { // a kitchen garden: dug earth and rows of greens
  kBox((s0 + s1) / 2, (f0 + f1) / 2, 0, Math.abs(s1 - s0) / 2, Math.abs(f1 - f0) / 2, .008, '#7a5a40', M_SOIL);
  for (let k = 0; k < rows; k++) { const f = f0 + (k + .5) / rows * (f1 - f0); if (KF.lod) for (let s = Math.min(s0, s1) + .02; s < Math.max(s0, s1) - .01; s += .03) kBlob(s, f, .012, .013, .012, leafC(k % 2 ? crop : shade(crop, .85)));
    else kBox((s0 + s1) / 2, f, .008, Math.abs(s1 - s0) / 2 - .01, .008, .01, leafC(crop), M_LEAF); }
}
function kBarrel(s, f, y = 0, r = .022, h = .05, col = '#7a5236') { kCyl(s, f, y, r, h, col, M_PLANK, KF.lod ? 9 : 6, shade(col, .8)); if (KF.lod) for (const t of [.2, .8]) kCyl(s, f, y + h * t - .002, r + .002, .005, K_IRON, 0, 9, 0); }
function kCrate(s, f, y = 0, r = .022, col = '#9b7a54') { kBox(s, f, y, r, r, r * 1.6, col, M_PLANK); if (KF.lod) kBox(s, f, y + r * .7, r + .002, r + .002, .004, shade(col, .75), M_PLANK); }
function kBench(s, f, y = 0, a = 1, col = '#6b5040') { const al = a ? [.05, 0, 0] : [0, .05, 0], ac = a ? [0, .014, 0] : [.014, 0, 0]; kOB(s, f, y + .03, al, ac, [0, 0, .004], col, M_PLANK); if (KF.lod) { kOB(s + (a ? 0 : -.016), f + (a ? -.016 : 0), y + .05, al, a ? [0, .003, 0] : [.003, 0, 0], [0, 0, .014], col, M_PLANK); for (const d of [-.04, .04]) kBox(s + (a ? d : 0), f + (a ? 0 : d), y, .004, .004, .03, K_IRON); } }
function kButt(s, f) { kCyl(s, f, 0, .025, .055, '#5d4a3a', M_PLANK, 8, '#4a6a7a'); }
function kWash(s0, s1, f, y, k) { if (!KF.lod) return; kBox(s0, f, 0, .004, .004, y, '#6b5040', M_PLANK); kBox(s1, f, 0, .004, .004, y, '#6b5040', M_PLANK); kBeam([s0, f, y], [s1, f, y], .0012, '#d8d2c4');
  const C = ['#f4f0e6', '#c96a5a', '#6a8fc9', '#e8d27a', '#f4f0e6']; for (let q = 0; q < 4; q++) { const s = s0 + (q + .5) / 4 * (s1 - s0); kBox(s, f, y - .035, .014, .002, .033, C[(q + k) % C.length]); } }
function kPot(s, f, y = 0) { kCyl(s, f, y, .014, .022, '#b5653f', M_ROOF, 7, '#5a4030'); kBlob(s, f, y + .03, .016, .014, FLOWER_C[(KF.id + ((s * 31) | 0)) % FLOWER_C.length], 0); }
function kSolar(s, f, y, hs, hf, tilt = .3) { // solar panels on a frame
  const g = .9; kCtr(s, f - .2, y - .1); kQ([s - hs, f - hf, y], [s + hs, f - hf, y], [s + hs, f + hf * g, y + tilt * hf], [s - hs, f + hf * g, y + tilt * hf], '#2e3f5c', 0, 0);
  if (KF.lod) for (let t = -hs + hs / 3; t < hs - .01; t += hs * 2 / 3) kBeam([s + t, f - hf, y + .003], [s + t, f + hf * g, y + tilt * hf + .003], .0015, '#b8c0c8');
}
