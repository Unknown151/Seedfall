/* ============================== railways: the track, the trains, level crossings ============================== */
// A line is S.rails[].path: tiles in N4 steps with a station at each end. Each tile's piece of track runs from the edge
// it is entered by to the edge it leaves by, as a quadratic curve through the tile's middle, so corners are smooth
// curves; the trains run along exactly the same curve (railPos). The track is built into the chunks (glRailTile, from
// render.js drawTileObjects); the trains, the barriers at level crossings and the steam are view only (DYN, Math.random).
// Three ages: timber sleepers and steam; concrete sleepers, overhead wires and electric units; a maglev guideway.

const RAILX = { S: null, n: -1, m: null, xs: null };
function railMap() { // tile -> its pieces [[prev, next], ...] (two lines can share a tile)
  const rs = S.rails || [], gen = rs.length + (S.railGen || 0) * 1000;
  if (RAILX.S === S && RAILX.n === gen) return RAILX.m;
  const m = new Map(), xs = [];
  for (const r of rs) if (r.path) for (let k = 1; k < r.path.length - 1; k++) {
    const i = r.path[k], a = r.path[k - 1], b = r.path[k + 1]; let L = m.get(i); if (!L) m.set(i, L = []);
    if (!L.some(([p, q]) => (p === a && q === b) || (p === b && q === a))) L.push([a, b]);
  }
  for (const i of m.keys()) if (M.road[i] && !M.water[i]) xs.push(i);
  RAILX.S = S; RAILX.n = gen; RAILX.m = m; RAILX.xs = xs; return m;
}
const railEra = () => hasTech('maglev') ? 2 : hasTech('electric') ? 1 : 0;
EV.on('tech', d => { if (d.t && (d.t.id === 'electric' || d.t.id === 'maglev')) for (const i of railMap().keys()) markDirty(i); }); // the track changes with the age
function railH(i) { // the height the track runs at over a tile: the ground, or a deck level with the higher bank
  if (!M.water[i]) return GT(i);
  let h = landZ(i) * ZS + .12; const x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (!M.water[j]) h = Math.max(h, GT(j) + .02); }
  return h;
}
// a point on tile i's piece (entered from a, left for b) at t in 0..1: [x, y, z, dx, dz] (y is the top of the rails' bed)
function railPt(i, a, b, t) {
  const x = i % W, z = (i / W) | 0, ex = (x + a % W) / 2, ez = (z + ((a / W) | 0)) / 2, xx = (x + b % W) / 2, xz = (z + ((b / W) | 0)) / 2, u = 1 - t;
  const hi = railH(i), hE = Math.max(hi, railH(a)), hX = Math.max(hi, railH(b));
  return [u * u * ex + 2 * u * t * x + t * t * xx, hE + (hX - hE) * t, u * u * ez + 2 * u * t * z + t * t * xz, 2 * (u * (x - ex) + t * (xx - x)), 2 * (u * (z - ez) + t * (xz - z))];
}
function railPos(path, s) { // where along a line s is (s in tiles from its first station; the stations' own tiles are the platforms' ends)
  const L = path.length - 1, j = clamp(Math.round(s), 1, Math.max(1, L - 1)), t = clamp(s - j + .5, 0, 1);
  return railPt(path[j], path[j - 1], path[Math.min(L, j + 1)], t);
}

/* ---------- the track, built into the chunk ---------- */
const RG = .07, RB = .19; // half the gauge, half the ballast's width (people are ~.27 tall here, so this is a broad gauge)
function glRailTile(i, x, y) {
  const L = railMap().get(i); if (!L) return;
  const era = railEra(), lod = GLB.lod, xing = M.road[i] && !M.water[i], g = GT(i), wet = !!M.water[i];
  for (const [a, b] of L) {
    const turn = (a % W !== b % W) && (((a / W) | 0) !== ((b / W) | 0)), n = turn ? (lod ? 8 : 4) : (lod ? 2 : 1), P = [];
    for (let k = 0; k <= n; k++) { const p = railPt(i, a, b, k / n), l = Math.hypot(p[3], p[4]) || 1; P.push([p[0], xing ? g + .008 : p[1], p[2], p[3] / l, p[4] / l]); }
    const side = (p, d, y) => [p[0] - p[4] * d, y, p[2] + p[3] * d]; // d across the track (the right of the way it runs)
    const strip = (d0, d1, dy, col, mat, e = 0) => { GLB.mat = mat; const c = gcol(col); for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; GLB.ctr = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 1, (A[2] + B[2]) / 2]; gquad(side(A, d0, A[1] + dy), side(A, d1, A[1] + dy), side(B, d1, B[1] + dy), side(B, d0, B[1] + dy), c, e); } };
    const wall = (d, dy0, dy1, col, mat, cd) => { GLB.mat = mat; const c = gcol(col); for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; GLB.ctr = side([(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2, A[3], A[4]], cd, (A[1] + B[1]) / 2 + (dy0 + dy1) / 2); gquad(side(A, d, A[1] + dy0), side(B, d, B[1] + dy0), side(B, d, B[1] + dy1), side(A, d, A[1] + dy1), c); } };
    if (era === 2) { glGuideway(i, P, n, side, strip, wall, wet, g, lod); continue; }
    const bal = era ? '#9a958c' : '#8c8173', slp = era ? '#c4c0b8' : '#6e5440', slpM = era ? M_STONE : M_PLANK, steel = '#5d5f63';
    if (xing) { strip(-RG - .03, RG + .03, .001, era ? '#b5b1a9' : '#8a6a4c', era ? M_STONE : M_PLANK); } // the crossing's planks between the rails
    else {
      strip(-RB, RB, .03, bal, M_STONE); // the ballast's top, and its shoulders down to the ground (an embankment where it ramps up a step)
      for (const d of [-1, 1]) { GLB.mat = M_STONE; const c = gcol(shade(bal, .9)); for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; GLB.ctr = [(A[0] + B[0]) / 2, Math.min(A[1], B[1]) - .5, (A[2] + B[2]) / 2]; const lo = wet ? -.04 : 0, ya = wet ? A[1] + lo : g, yb = wet ? B[1] + lo : g; gquad(side(A, d * RB, A[1] + .03), side(B, d * RB, B[1] + .03), side(B, d * (RB + (wet ? 0 : .05 + (A[1] - g) * .6)), Math.min(yb, B[1])), side(A, d * (RB + (wet ? 0 : .05 + (A[1] - g) * .6)), Math.min(ya, A[1])), c); } }
      if (lod) { // sleepers, about ten to a tile
        for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1], m = Math.max(1, Math.round(10 * Math.hypot(B[0] - A[0], B[2] - A[2]))); for (let q = 0; q < m; q++) { const t = (q + .5) / m, p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, A[3] + (B[3] - A[3]) * t, A[4] + (B[4] - A[4]) * t]; GLB.mat = slpM; glOBox([p[0], p[1] + .036, p[2]], [p[3] * .022, 0, p[4] * .022], [-p[4] * .13, 0, p[3] * .13], [0, .006, 0], slp); } }
      }
      else strip(-.13, .13, .031, shade(slp, .85), slpM); // far off the sleepers are a band
    }
    const ry = xing ? .004 : .042; // the rails: two steel bars (a top and an inner face far off)
    for (const d of [-RG, RG]) { strip(d - .007, d + .007, ry + .016, '#8d9196', 0); if (lod) { wall(d - .007, ry, ry + .016, steel, 0, d); wall(d + .007, ry, ry + .016, steel, 0, d); } else wall(d - Math.sign(d) * .007, ry, ry + .016, steel, 0, d); }
    if (wet) glRailBridge(i, P, n, side, era, lod);
    if (era === 1) glCatenary(i, P, n, side, lod, x, y);
    if (xing && lod) glXingSigns(P, n, side);
    for (const e of [a, b]) { const B = M.bld[e] && S.B[M.bld[e]]; if (B && B.type === 'station') glBuffer(P[e === a ? 0 : n], e === a ? 1 : -1); } // the line ends at the station: a buffer stop
  }
}
function glRailBridge(i, P, n, side, era, lod) { // a deck over the river on a pier, with girders (a lattice truss in the age of steam)
  const iron = era ? '#8d9196' : '#4a4f55', w = M.water[i] === 1 ? SEAZ * ZS : surfZ(i) * ZS, m = P[(n / 2) | 0];
  GLB.mat = era ? M_STONE : 0; glOBox([m[0], (w + m[1]) / 2, m[2]], [m[3] * .1, 0, m[4] * .1], [-m[4] * .2, 0, m[3] * .2], [0, (m[1] - w) / 2 + .02, 0], era ? '#b8b2a8' : '#8f877c'); // the pier
  for (const d of [-1, 1]) for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1], a0 = side(A, d * (RB + .015), A[1]), b0 = side(B, d * (RB + .015), B[1]);
    GLB.mat = 0; gBeam(a0, b0, .02, iron); gBeam([a0[0], a0[1] + .14, a0[2]], [b0[0], b0[1] + .14, b0[2]], .016, iron); // bottom and top chords
    if (lod || !era) { const q = era ? 1 : 3; for (let s = 0; s <= q; s++) { const t0 = s / q, p0 = [a0[0] + (b0[0] - a0[0]) * t0, a0[1] + (b0[1] - a0[1]) * t0, a0[2] + (b0[2] - a0[2]) * t0]; gBeam(p0, [p0[0], p0[1] + .14, p0[2]], .01, iron); if (!era && s < q) { const t1 = (s + 1) / q, p1 = [a0[0] + (b0[0] - a0[0]) * t1, a0[1] + (b0[1] - a0[1]) * t1 + .14, a0[2] + (b0[2] - a0[2]) * t1]; gBeam(p0, p1, .007, iron); } } }
  }
}
function glCatenary(i, P, n, side, lod, x, y) { // a mast at the side of each tile, an arm over the track, the contact wire
  const m = P[(n / 2) | 0], d = hash2(x, y, 41) < .5 ? -1 : 1, base = side(m, d * .3, m[1]), top = [base[0], m[1] + .52, base[2]], over = side(m, 0, m[1] + .5), grey = '#7f858c';
  GLB.mat = 0; gBeam(base, top, .012, grey); gBeam([top[0], top[1] - .03, top[2]], over, .007, grey);
  for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; gBeam(side(A, 0, A[1] + .48), side(B, 0, B[1] + .48), .003, '#3a3d41'); if (lod) gBeam(side(A, 0, A[1] + .53), side(B, 0, B[1] + .53), .002, '#3a3d41'); }
}
function glGuideway(i, P, n, side, strip, wall, wet, g, lod) { // the maglev's guideway: a concrete beam on a column, a glowing strip on top
  const top = .2; strip(-.1, .1, top, '#d9d6cf', M_STONE); strip(-.012, .012, top + .002, '#7fd6ff', 0, .5);
  wall(-.1, top - .09, top, '#c9c5bd', M_STONE, 0); wall(.1, top - .09, top, '#c9c5bd', M_STONE, 0);
  const m = P[(n / 2) | 0], w = wet ? (M.water[i] === 1 ? SEAZ : surfZ(i)) * ZS : g;
  GLB.mat = M_STONE; glOBox([m[0], (w + m[1] + top - .09) / 2, m[2]], [m[3] * .04, 0, m[4] * .04], [-m[4] * .05, 0, m[3] * .05], [0, (m[1] + top - .09 - w) / 2, 0], '#cfcbc3');
}
function glXingSigns(P, n, side) { // crossbucks at two corners of a level crossing
  const m = P[(n / 2) | 0];
  for (const d of [-1, 1]) { const b = side([m[0] + m[3] * .36 * d, m[1], m[2] + m[4] * .36 * d, m[3], m[4]], .36 * d, m[1]); GLB.mat = 0; gBeam(b, [b[0], b[1] + .3, b[2]], .008, '#f2f2f2');
    for (const s of [-1, 1]) gBeam([b[0] - m[3] * .06, b[1] + .27 - s * .03, b[2] - m[4] * .06], [b[0] + m[3] * .06, b[1] + .27 + s * .03, b[2] + m[4] * .06], .007, s > 0 ? '#c83a32' : '#f4f1ea'); }
}
function glBuffer(p, dir) { // two posts and a beam where the line stops, a lamp on it
  const f = [p[3] * dir, 0, p[4] * dir], r = [-p[4], 0, p[3]], c = [p[0] + f[0] * .04, p[1] + .04, p[2] + f[2] * .04];
  GLB.mat = 0; glOBox([c[0], c[1] + .06, c[2]], V3s(f, .025), V3s(r, .12), [0, .03, 0], '#a33a30');
  for (const s of [-1, 1]) glOBox([c[0] + r[0] * RG * s - f[0] * .04, c[1] + .03, c[2] + r[2] * RG * s - f[2] * .04], V3s(f, .05), V3s(r, .012), [0, .03, 0], '#3d3f44');
  glOBox([c[0], c[1] + .1, c[2]], [.012, 0, 0], [0, 0, .012], [0, .012, 0], '#ff5a3c', 2);
}

/* ---------- the trains ---------- */
// cars head to tail: [kind, length]; an electric unit or a maglev has a cab at each end, so turning back looks right
function trainCars(tr) {
  const era = railEra(), room = tr.r.path.length - 2 - .3;
  const C = era === 2 ? [['nose', .78], ['mid', .7], ['mid', .7], ['nose', .78]] : era === 1 ? [['cab', .66], ['coach', .64], ['coach', .64], ['coach', .64], ['cab', .66]] : [['loco', .62], ['tender', .36], ['coach', .6], ['coach', .6], ['coach', .6]];
  const len = () => C.reduce((s, c) => s + c[1] + .04, -.04);
  while (C.length > 2 && len() > room) C.splice(C.length - 2, 1);
  return { C, len: len(), era };
}
const TRAIN_SP = [[.75, .16], [1.25, .3], [2.4, .5]]; // top speed (tiles a second) and how fast they get going, by age
function stepTrains(dt) {
  const busy = DYN.railBusy || (DYN.railBusy = new Set()); busy.clear();
  for (const tr of DYN.trains) {
    const P = tr.r.path, L = P.length - 1, { len, era } = trainCars(tr), [vm, ac] = TRAIN_SP[era];
    if (tr.lo == null || tr.lo + len > L - .5 + 1e-6) { tr.lo = .5; tr.v = 0; }
    if (tr.wait > 0) { tr.wait -= dt; tr.v = 0; }
    else {
      const rem = tr.dir > 0 ? (L - .5) - (tr.lo + len) : tr.lo - .5, top = Math.min(vm, Math.sqrt(2 * ac * Math.max(0, rem)) + .04); // easing into the station
      tr.v = Math.min(top, (tr.v || 0) + ac * dt); const d = Math.min(rem, tr.v * dt); tr.lo += tr.dir * d; tr.dist = (tr.dist || 0) + d;
      if (rem - d <= 1e-4) { tr.dir = -tr.dir; tr.v = 0; tr.wait = rf(8, 15); }
    }
    tr.s = tr.dir > 0 ? tr.lo + len : tr.lo; // (its head, for the film camera)
    for (let s = Math.floor(tr.lo - 1.3); s <= Math.ceil(tr.lo + len + 1.3); s++) if (s >= 0 && s <= L) busy.add(P[s]);
    if (era === 0 && tr.v > .05 && GL3.eye) { const p = railPos(P, tr.s - tr.dir * .1); if (Math.hypot(p[0] - GL3.eye[0], p[2] - GL3.eye[2]) < 45 && chance(dt * (2 + tr.v * 9))) SMOKE3(p[0] + rf(-.02, .02), p[1] + .4, p[2] + rf(-.02, .02), '#ece8e2', .5, .14); } // steam from the chimney
  }
}
function trainPos(tr) { return railPos(tr.r.path, tr.s); }
// the crossing's barriers come down while a train is near; walkers and carts wait at the edge
function railBusy(i) { return !!(DYN.railBusy && DYN.railBusy.has(i)); }

function glTrains() {
  const eye = GL3.eye || [0, 0, 0], XG = DYN.xing || (DYN.xing = new Map()), dt = Math.min(GL3.dt || .016, .1);
  railMap();
  for (const i of RAILX.xs || []) { // barriers
    const x = i % W, z = (i / W) | 0; if (Math.hypot(x - eye[0], z - eye[2]) > 30) continue;
    const L = RAILX.m.get(i); if (!L) continue; const p = railPt(i, L[0][0], L[0][1], .5), l = Math.hypot(p[3], p[4]) || 1, f = [p[3] / l, 0, p[4] / l], r = [-f[2], 0, f[0]];
    const want = railBusy(i) ? 1 : 0, a = XG.get(i) || 0, na = a + clamp(want - a, -dt * .8, dt * .8); XG.set(i, na); const ang = na * Math.PI / 2, y = GT(i) + .008;
    for (const s of [-1, 1]) { const piv = [x + f[0] * .3 * s + r[0] * .36 * s, y + .12, z + f[2] * .3 * s + r[2] * .36 * s];
      GLB.mat = 0; glOBox([piv[0], y + .06, piv[2]], [.012, 0, 0], [0, 0, .012], [0, .06, 0], '#e8e4dc');
      const dir = [-f[0] * s * Math.sin(ang), Math.cos(ang), -f[2] * s * Math.sin(ang)]; // straight up, swinging down across the road
      for (let q = 0; q < 4; q++) { const c = [piv[0] + dir[0] * (.07 + q * .13), piv[1] + dir[1] * (.07 + q * .13), piv[2] + dir[2] * (.07 + q * .13)]; glOBox(c, V3s(dir, .065), V3s(r, .006), V3s(V3x(dir, r), .008), q % 2 ? '#f4f1ea' : '#c83a32'); }
      if (want && (GL3.t * 2 + s) % 2 < 1) glOBox([piv[0], y + .2, piv[2]], [.014, 0, 0], [0, 0, .014], [0, .014, 0], '#ff4030', 3); }
  }
  for (const tr of DYN.trains) {
    const P = tr.r.path, { C, len, era } = trainCars(tr), head = tr.dir > 0 ? tr.lo + len : tr.lo;
    const h0 = railPos(P, head); if (Math.hypot(h0[0] - eye[0], h0[2] - eye[2]) > 70) continue;
    let off = 0;
    for (let k = 0; k < C.length; k++) {
      const [kind, cl] = C[k], sc = head - tr.dir * (off + cl / 2), bo = cl / 2 - .1; off += cl + .04;
      const A = railPos(P, sc + tr.dir * bo), B = railPos(P, sc - tr.dir * bo), c = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + (era === 2 ? .215 : .058), (A[2] + B[2]) / 2];
      let fx = A[0] - B[0], fz = A[2] - B[2]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
      const f = [fx, (A[1] - B[1]) / (2 * bo), fz], r = [-fz, 0, fx], far = Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]) > 18;
      const back = k === C.length - 1 && C[0][0] === kind; // the cab at the tail faces the other way
      glCar(kind, c, back ? V3s(f, -1) : f, back ? V3s(r, -1) : r, cl / 2, tr, far, k);
    }
  }
}
// a cylinder along ax (unit) with radius r and half-length hl, round u/v; caps if asked
function trCyl(c, ax, u, v, r, hl, n, col, caps) {
  const C = gcol(col), P = (s, a) => [c[0] + ax[0] * s + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * r, c[1] + ax[1] * s + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * r, c[2] + ax[2] * s + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * r];
  GLB.ctr = c; GLB.mat = 0;
  for (let k = 0; k < n; k++) { const a0 = k / n * TAU, a1 = (k + 1) / n * TAU; gquad(P(-hl, a0), P(hl, a0), P(hl, a1), P(-hl, a1), C); if (caps) for (const s of [-hl, hl]) { GLB.ctr = [c[0] + ax[0] * s * .5, c[1] + ax[1] * s * .5, c[2] + ax[2] * s * .5]; gtri([c[0] + ax[0] * s, c[1] + ax[1] * s, c[2] + ax[2] * s], P(s, a0), P(s, a1), C); GLB.ctr = c; } }
}
const TR_LIVERY = [['#2f5a3e', '#7a2e2a'], ['#26282c', '#5b3a2a'], ['#6e2a26', '#2f4a3a'], ['#2a4a6e', '#7a2e2a']]; // engine, coaches
function glCar(kind, c, f, r, hl, tr, far, k) {
  const up = [0, 1, 0], P = (s, t, y) => [c[0] + f[0] * s + r[0] * t, c[1] + y + f[1] * s, c[2] + f[2] * s + r[2] * t], lit = GL3.litNow, id = (tr.r.a * 7 + tr.r.b) | 0, liv = TR_LIVERY[id % TR_LIVERY.length];
  const box = (s0, s1, t, y0, y1, col, e = 0) => { GLB.mat = 0; glOBox(P((s0 + s1) / 2, 0, (y0 + y1) / 2), V3s(f, (s1 - s0) / 2), V3s(r, t), [0, (y1 - y0) / 2, 0], col, e); };
  const wheels = (ss, rad, col) => { if (far) return; const th = (tr.dist || 0) / rad * tr.dir; for (const s of ss) for (const t of [-1, 1]) { trCyl(P(s, t * .085, rad), r, f, up, rad, .01, 8, col); if (rad > .05) glOBox(P(s + Math.cos(th) * rad * .5, t * .097, rad + Math.sin(th) * rad * .5), V3s(f, .012), V3s(r, .004), [0, .012, 0], '#d8d2c4'); } };
  const windows = (s0, s1, y0, y1, m, col = '#3a4250') => { for (const t of [-1, 1]) for (let q = 0; q < m; q++) { const s = s0 + (q + .5) / m * (s1 - s0); glOBox(P(s, t * .101, (y0 + y1) / 2), V3s(f, (s1 - s0) / m * .34), V3s(r, .003), [0, (y1 - y0) / 2, 0], col, .2 + .7 * hash2(id, k * 9 + q, t + 3)); } }; // (lit at night)
  if (kind === 'loco') { // a steam engine: boiler, smokebox, chimney, dome, cab, drivers with their coupling rods
    box(-hl, hl, .1, .055, .085, '#222326'); wheels([-.13, .01, .15], .065, '#9c2f24'); if (!far) wheels([.26], .035, '#9c2f24');
    if (!far) for (const t of [-1, 1]) { const th = (tr.dist || 0) / .065 * tr.dir, o = [Math.cos(th) * .032, Math.sin(th) * .032]; glOBox(P(.01 + o[0], t * .108, .065 + o[1]), V3s(f, .15), V3s(r, .004), [0, .007, 0], '#c9c4b8'); }
    trCyl(P(.08, 0, .175), f, r, up, .078, .19, far ? 6 : 12, liv[0], true); trCyl(P(.28, 0, .175), f, r, up, .082, .03, far ? 6 : 12, '#1d1e21', true);
    trCyl(P(.25, 0, .275), up, f, r, .026, .045, 8, '#1d1e21', false); if (!far) { trCyl(P(.25, 0, .325), up, f, r, .034, .008, 8, '#1d1e21', true); trCyl(P(.08, 0, .26), up, f, r, .03, .025, 8, '#b8913a', true); }
    box(-hl, -.1, .1, .085, .33, liv[0]); box(-hl - .02, -.08, .108, .33, .345, '#1d1e21'); windows(-.27, -.13, .23, .3, 2); box(-.1, -.098, .07, .24, .31, '#3a4250', .8);
    box(hl - .02, hl + .01, .11, .06, .1, '#a33a30'); if (!far) for (const t of [-1, 1]) trCyl(P(hl + .03, t * .07, .08), f, r, up, .015, .02, 6, '#2a2a2a', true);
    if (lit) glOBox(P(hl + .005, 0, .27), V3s(f, .01), V3s(r, .02), [0, .02, 0], '#fff4d6', 2); return;
  }
  if (kind === 'tender') { box(-hl, hl, .1, .055, .085, '#222326'); wheels([-.1, .1], .045, '#9c2f24'); box(-hl, hl, .098, .085, .25, liv[0]); box(-hl + .03, hl - .03, .085, .25, .27, '#18191b'); return; }
  if (kind === 'coach') { // carriages: panelled sides, a row of windows, a curved roof, bogies at each end
    if (!far) for (const s of [-hl + .12, hl - .12]) { box(s - .07, s + .07, .08, .03, .06, '#2a2a2c'); wheels([s - .045, s + .045], .03, '#2a2a2c'); }
    const el = railEra() === 1; box(-hl, hl, .1, .06, el ? .3 : .27, el ? '#c8553d' : liv[1]); if (!far) box(-hl, hl, .102, el ? .15 : .2, el ? .24 : .215, el ? '#efe6d2' : '#d9c48f'); // (an electric unit's coaches match its cabs) windows(-hl + .06, hl - .06, el ? .16 : .14, el ? .235 : .225, 5);
    GLB.mat = 0; const rc = gcol(el ? '#9aa0a6' : '#4a4a4e'), ry = el ? .03 : 0; GLB.ctr = P(0, 0, .2); gquad(P(-hl, -.1, .27 + ry), P(hl, -.1, .27 + ry), P(hl, -.05, .3 + ry), P(-hl, -.05, .3 + ry), rc); gquad(P(-hl, -.05, .3 + ry), P(hl, -.05, .3 + ry), P(hl, .05, .3 + ry), P(-hl, .05, .3 + ry), rc); gquad(P(-hl, .05, .3 + ry), P(hl, .05, .3 + ry), P(hl, .1, .27 + ry), P(-hl, .1, .27 + ry), rc);
    if (!far) for (const s of [-1, 1]) box(s * hl - .01, s * hl + .01, .06, .1, .24, '#2a2a2c'); return; // the gangway at each end
  }
  if (kind === 'cab') { // an electric unit's cab car: a raked nose with a wide windscreen, a pantograph up to the wire
    const body = '#c8553d', band = '#efe6d2', nose = hl - .1;
    if (!far) for (const s of [-hl + .13, nose - .1]) { box(s - .07, s + .07, .08, .03, .06, '#2a2a2c'); wheels([s - .045, s + .045], .03, '#2a2a2c'); }
    box(-hl, nose, .1, .06, .3, body); box(-hl, nose, .102, .15, .24, band); windows(-hl + .05, nose - .05, .16, .235, 5);
    GLB.mat = 0; const bc = gcol(body), gl = gcol('#2c3440'); GLB.ctr = P(nose - .1, 0, .15);
    gquad(P(nose, -.1, .06), P(nose, .1, .06), P(hl, .08, .06), P(hl, -.08, .06), bc); gquad(P(hl, -.08, .06), P(hl, .08, .06), P(hl, .08, .17), P(hl, -.08, .17), bc); // the nose's foot
    gquad(P(hl, -.08, .17), P(hl, .08, .17), P(nose, .1, .3), P(nose, -.1, .3), gl, .6); // the raked windscreen
    for (const t of [-1, 1]) { gtri(P(nose, t * .1, .06), P(hl, t * .08, .06), P(hl, t * .08, .17), bc); gtri(P(nose, t * .1, .06), P(hl, t * .08, .17), P(nose, t * .1, .3), bc); }
    box(-hl, nose, .095, .3, .315, '#9aa0a6'); if (lit) for (const t of [-1, 1]) glOBox(P(hl + .004, t * .055, .1), V3s(f, .006), V3s(r, .012), [0, .01, 0], '#fff4d6', 2);
    if (!far) { const tp = P(-hl + .2, 0, .44); gBeam(P(-hl + .14, 0, .315), tp, .005, '#3a3d41'); gBeam(P(-hl + .26, 0, .315), tp, .005, '#3a3d41'); glOBox(tp, V3s(f, .012), V3s(r, .07), [0, .004, 0], '#3a3d41'); } // the pantograph
    return;
  }
  if (kind === 'nose' || kind === 'mid') { // the maglev: a smooth white body wrapped round the guideway, a long nose, a glowing skirt
    const prof = [[-.1, -.05], [.1, -.05], [.115, .08], [.085, .17], [-.085, .17], [-.115, .08]], FC = ['#7fd6ff', '#f2f5f8', '#2c3e50', '#f2f5f8', '#2c3e50', '#f2f5f8'], ring = []; // faces: the glowing skirt, a side, the window band, the roof...
    const sts = kind === 'nose' ? [[-hl, 1, 0], [hl - .3, 1, 0], [hl - .14, .78, -.02], [hl - .04, .42, -.04], [hl, .12, -.045]] : [[-hl, 1, 0], [hl, 1, 0]];
    for (const [s, k2, dy] of sts) ring.push(prof.map(([t, y]) => P(s, t * k2, y * (k2 * .6 + .4) + dy + .05)));
    GLB.mat = 0;
    for (let a = 0; a < ring.length - 1; a++) for (let q = 0; q < prof.length; q++) { const q1 = (q + 1) % prof.length;
      GLB.ctr = P((sts[a][0] + sts[a + 1][0]) / 2, 0, .08); gquad(ring[a][q], ring[a + 1][q], ring[a + 1][q1], ring[a][q1], gcol(FC[q]), q === 0 ? 3 : q === 2 || q === 4 ? .5 : 0); }
    GLB.ctr = P(-hl - .1, 0, .08); const r0 = ring[0]; for (let q = 1; q < prof.length - 1; q++) gtri(r0[0], r0[q], r0[q + 1], gcol('#e2e6ea'));
    if (kind === 'mid') { const r1 = ring[1]; GLB.ctr = P(hl + .1, 0, .08); for (let q = 1; q < prof.length - 1; q++) gtri(r1[0], r1[q], r1[q + 1], gcol('#e2e6ea')); }
    if (!far) box(-hl + .02, hl - (kind === 'nose' ? .2 : .02), .118, .1, .112, '#3f7fd6'); // a blue stripe
    if (lit && kind === 'nose') glOBox(P(hl - .02, 0, .04), V3s(f, .006), V3s(r, .03), [0, .006, 0], '#e8f6ff', 2);
  }
}
