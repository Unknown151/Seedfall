/* ============================== railways: the track, the trains, level crossings ============================== */
// A line is S.rails[].path: tiles in N4 steps with a station at each end. Each tile's piece of track runs from the edge
// it is entered by to the edge it leaves by, as a quadratic curve through the tile's middle, so corners are smooth
// curves; the trains run along exactly the same curve (railPos). The track is built into the chunks (glRailTile, from
// render.js drawTileObjects); the trains, the barriers at level crossings and the steam are view only (DYN, Math.random).
// Three ages: timber sleepers and steam; concrete sleepers, overhead wires and electric units; a maglev guideway.

// Where lines share track (out of the same station, or along the same valley), each has its own pair of rails side by side,
// so their trains pass instead of running through each other. Every step between two tiles (an edge) gets a lane for
// each line on it: ranked by line, measured to the right of the first line's way along it, so lines keep their order
// along a shared run and lanes slide apart and together smoothly within a tile (railPt). RAILX.ln[line] is a line's
// offset at each of its edges, to the right of its own way.
const RAILX = { S: null, n: -1, m: null, xs: null, ln: null };
const LANE_MAX = 4, LANE_SP = .42, laneSp = n => n < 2 ? LANE_SP : Math.max(.3, Math.min(LANE_SP, .84 / (n - 1))); // track centres apart (two ballast beds side by side; three or more closer, never too close for two trains to pass)
function railMap() { // tile -> its pieces [[prev, next, offset in, offset out], ...]
  const rs = S.rails || [], gen = rs.length + (S.railGen || 0) * 1000;
  if (RAILX.S === S && RAILX.n === gen) return RAILX.m;
  const E = new Map(), ek = (u, v) => Math.min(u, v) * W * H + Math.max(u, v), ln = new Map();
  rs.forEach((r, q) => { if (r.path) for (let k = 0; k < r.path.length - 1; k++) { const key = ek(r.path[k], r.path[k + 1]); let e = E.get(key); if (!e) E.set(key, e = []); if (!e.some(o => o.q === q)) e.push({ q, a: r.path[k] }); } });
  const wid = new Map(); // (each line's edges: how many lines share them)
  rs.forEach((r, q) => { if (!r.path) return; const o = new Float32Array(r.path.length - 1), nw = new Uint8Array(r.path.length - 1); wid.set(r, nw);
    for (let k = 0; k < o.length; k++) { const e = E.get(ek(r.path[k], r.path[k + 1])), n = Math.min(e.length, LANE_MAX); nw[k] = n; if (n < 2) continue;
      const rk = e.findIndex(z => z.q === q) % n, sp = laneSp(n); /* (more lines than tracks: they take turns on them, and the signals keep them apart) */ o[k] = (rk - (n - 1) / 2) * sp * (e[0].a === r.path[k] ? 1 : -1); } // (the first line's right is the others' left when they run the other way)
    ln.set(r, o); });
  const m = new Map(), xs = [];
  for (const r of rs) if (r.path) { const o = ln.get(r); for (let k = 1; k < r.path.length - 1; k++) {
    const i = r.path[k], a = r.path[k - 1], b = r.path[k + 1], o0 = o[k - 1], o1 = o[k], nw = wid.get(r), bw = Math.min(RB, laneSp(Math.max(nw[k - 1], nw[k])) / 2 - .01); let L = m.get(i); if (!L) m.set(i, L = []);
    if (!L.some(([p, q, u, v]) => (p === a && q === b && u === o0 && v === o1) || (p === b && q === a && u === -o1 && v === -o0))) L.push([a, b, o0, o1, bw]); } }
  for (const i of m.keys()) if (M.road[i] && !M.water[i]) xs.push(i);
  // junctions: tiles where two lines' tracks come close (they cross, or meet and part) without lanes of their own. Only
  // one train at a time goes through: the signals (stepTrains).
  const per = new Map(), cf = new Set(); rs.forEach((r, q) => { if (r.path) { const o = ln.get(r); for (let k = 1; k < r.path.length - 1; k++) { const i = r.path[k]; let L = per.get(i); if (!L) per.set(i, L = []); L.push([q, r.path[k - 1], r.path[k + 1], o[k - 1], o[k]]); } } });
  for (const [i, L] of per) { if (L.length < 2) continue; const pts = L.map(([q, a, b, u, v]) => [0, .25, .5, .75, 1].map(t => railPt(i, a, b, t, u, v)));
    for (let A = 0; A < L.length && !cf.has(i); A++) for (let B = A + 1; B < L.length; B++) if (L[A][0] !== L[B][0] && pts[A].some(p => pts[B].some(q => Math.hypot(p[0] - q[0], p[2] - q[2]) < .27))) { cf.add(i); break; } }
  RAILX.S = S; RAILX.n = gen; RAILX.m = m; RAILX.xs = xs; RAILX.ln = ln; RAILX.cf = cf; return m;
}
function railLane(r) { railMap(); return RAILX.ln.get(r) || null; }
const railEra = () => hasTech('maglev') ? 2 : hasTech('electric') ? 1 : 0;
EV.on('tech', d => { if (d.t && (d.t.id === 'electric' || d.t.id === 'maglev')) for (const i of railMap().keys()) markDirty(i); }); // the track changes with the age
function railH(i) { // the height the track runs at over a tile: the ground, or a deck level with the higher bank
  if (!M.water[i]) return GT(i);
  let h = landZ(i) * ZS + .12; const x = i % W, y = (i / W) | 0;
  for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (!M.water[j]) h = Math.max(h, GT(j) + .02); }
  return h;
}
// a point on tile i's piece (entered from a, left for b) at t in 0..1: [x, y, z, dx, dz] (y is the top of the rails' bed)
function railPt(i, a, b, t, o0 = 0, o1 = 0) { // (o0, o1: its lane, to the right of the way it runs, where it comes in and goes out)
  const x = i % W, z = (i / W) | 0, ex = (x + a % W) / 2, ez = (z + ((a / W) | 0)) / 2, xx = (x + b % W) / 2, xz = (z + ((b / W) | 0)) / 2, u = 1 - t;
  const hi = railH(i), hE = Math.max(hi, railH(a)), hX = Math.max(hi, railH(b));
  const p = [u * u * ex + 2 * u * t * x + t * t * xx, hE + (hX - hE) * t, u * u * ez + 2 * u * t * z + t * t * xz, 2 * (u * (x - ex) + t * (xx - x)), 2 * (u * (z - ez) + t * (xz - z))];
  if (o0 || o1) { const o = o0 + (o1 - o0) * t * t * (3 - 2 * t), l = Math.hypot(p[3], p[4]) || 1; p[0] -= p[4] / l * o; p[2] += p[3] / l * o; }
  return p;
}
function railPos(path, s, ln) { // where along a line s is (s in tiles from its first station; the stations' own tiles are the platforms' ends); ln: its lanes
  const L = path.length - 1, j = clamp(Math.round(s), 1, Math.max(1, L - 1)), t = clamp(s - j + .5, 0, 1);
  return railPt(path[j], path[j - 1], path[Math.min(L, j + 1)], t, ln ? ln[j - 1] : 0, ln ? ln[Math.min(L - 1, j)] : 0);
}

/* ---------- the track, built into the chunk ---------- */
const RG = .07, RB = .19; // half the gauge, half the ballast's width (people are ~.27 tall here, so this is a broad gauge)
function glRailTile(i, x, y) {
  const L = railMap().get(i); if (!L) return;
  const era = railEra(), lod = GLB.lod, xing = M.road[i] && !M.water[i], g = GT(i), wet = !!M.water[i];
  for (const [a, b, o0, o1, bw] of L) {
    const turn = (a % W !== b % W) && (((a / W) | 0) !== ((b / W) | 0)) || o0 !== o1, n = turn ? (lod ? 8 : 4) : (lod ? 2 : 1), P = []; // (a lane sliding sideways bends too)
    for (let k = 0; k <= n; k++) { const p = railPt(i, a, b, k / n, o0, o1), l = Math.hypot(p[3], p[4]) || 1; P.push([p[0], xing ? g + .008 : p[1], p[2], p[3] / l, p[4] / l]); }
    const side = (p, d, y) => [p[0] - p[4] * d, y, p[2] + p[3] * d]; // d across the track (the right of the way it runs)
    const strip = (d0, d1, dy, col, mat, e = 0) => { GLB.mat = mat; const c = gcol(col); for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; GLB.ctr = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 - 1, (A[2] + B[2]) / 2]; gquad(side(A, d0, A[1] + dy), side(A, d1, A[1] + dy), side(B, d1, B[1] + dy), side(B, d0, B[1] + dy), c, e); } };
    const wall = (d, dy0, dy1, col, mat, cd) => { GLB.mat = mat; const c = gcol(col); for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; GLB.ctr = side([(A[0] + B[0]) / 2, 0, (A[2] + B[2]) / 2, A[3], A[4]], cd, (A[1] + B[1]) / 2 + (dy0 + dy1) / 2); gquad(side(A, d, A[1] + dy0), side(B, d, B[1] + dy0), side(B, d, B[1] + dy1), side(A, d, A[1] + dy1), c); } };
    if (era === 2) { glGuideway(i, P, n, side, strip, wall, wet, g, lod); continue; }
    const bal = era ? '#9a958c' : '#8c8173', slp = era ? '#c4c0b8' : '#6e5440', slpM = era ? M_STONE : M_PLANK, steel = '#5d5f63';
    if (xing) { strip(-RG - .03, RG + .03, .001, era ? '#b5b1a9' : '#8a6a4c', era ? M_STONE : M_PLANK); } // the crossing's planks between the rails
    else {
      strip(-bw, bw, .03, bal, M_STONE); // the ballast's top, and its shoulders down to the ground (an embankment where it ramps up a step)
      for (const d of [-1, 1]) { GLB.mat = M_STONE; const c = gcol(shade(bal, .9)); for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; GLB.ctr = [(A[0] + B[0]) / 2, Math.min(A[1], B[1]) - .5, (A[2] + B[2]) / 2]; const lo = wet ? -.04 : 0, ya = wet ? A[1] + lo : g, yb = wet ? B[1] + lo : g; gquad(side(A, d * bw, A[1] + .03), side(B, d * bw, B[1] + .03), side(B, d * (bw + (wet ? 0 : .05 + (A[1] - g) * .6)), Math.min(yb, B[1])), side(A, d * (bw + (wet ? 0 : .05 + (A[1] - g) * .6)), Math.min(ya, A[1])), c); } }
      if (lod) { // sleepers, about ten to a tile
        for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1], m = Math.max(1, Math.round(10 * Math.hypot(B[0] - A[0], B[2] - A[2]))); for (let q = 0; q < m; q++) { const t = (q + .5) / m, p = [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t, A[3] + (B[3] - A[3]) * t, A[4] + (B[4] - A[4]) * t]; GLB.mat = slpM; glOBox([p[0], p[1] + .036, p[2]], [p[3] * .022, 0, p[4] * .022], [-p[4] * .13, 0, p[3] * .13], [0, .006, 0], slp); } }
      }
      else strip(-.13, .13, .031, shade(slp, .85), slpM); // far off the sleepers are a band
    }
    const ry = xing ? .004 : .042; // the rails: two steel bars (a top and an inner face far off)
    for (const d of [-RG, RG]) { strip(d - .007, d + .007, ry + .016, '#8d9196', 0); if (lod) { wall(d - .007, ry, ry + .016, steel, 0, d); wall(d + .007, ry, ry + .016, steel, 0, d); } else wall(d - Math.sign(d) * .007, ry, ry + .016, steel, 0, d); }
    if (wet) glRailBridge(i, P, n, side, era, lod);
    if (era === 1) glCatenary(i, P, n, side, lod, x, y, o0 + o1);
    if (xing && lod) glXingSigns(P, n, side, o0 + o1);
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
function glCatenary(i, P, n, side, lod, x, y, lane = 0) { // a mast at the side of each tile, an arm over the track, the contact wire
  const m = P[(n / 2) | 0], d = lane ? Math.sign(lane) : hash2(x, y, 41) < .5 ? -1 : 1, base = side(m, d * .3, m[1]), top = [base[0], m[1] + .52, base[2]], over = side(m, 0, m[1] + .5), grey = '#7f858c';
  GLB.mat = 0; gBeam(base, top, .012, grey); gBeam([top[0], top[1] - .03, top[2]], over, .007, grey);
  for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; gBeam(side(A, 0, A[1] + .48), side(B, 0, B[1] + .48), .003, '#3a3d41'); if (lod) gBeam(side(A, 0, A[1] + .53), side(B, 0, B[1] + .53), .002, '#3a3d41'); }
}
function glGuideway(i, P, n, side, strip, wall, wet, g, lod) { // the maglev's guideway: a concrete beam on a column, a glowing strip on top
  const top = .2; strip(-.1, .1, top, '#d9d6cf', M_STONE); strip(-.012, .012, top + .002, '#7fd6ff', 0, .5);
  wall(-.1, top - .09, top, '#c9c5bd', M_STONE, 0); wall(.1, top - .09, top, '#c9c5bd', M_STONE, 0);
  const m = P[(n / 2) | 0], w = wet ? (M.water[i] === 1 ? SEAZ : surfZ(i)) * ZS : g;
  GLB.mat = M_STONE; glOBox([m[0], (w + m[1] + top - .09) / 2, m[2]], [m[3] * .04, 0, m[4] * .04], [-m[4] * .05, 0, m[3] * .05], [0, (m[1] + top - .09 - w) / 2, 0], '#cfcbc3');
}
function glXingSigns(P, n, side, lane = 0) { // crossbucks at two corners of a level crossing (beside a second track, only on the outside)
  const m = P[(n / 2) | 0];
  for (const d of [-1, 1]) { if (lane && d !== Math.sign(lane)) continue; const b = side([m[0] + m[3] * .36 * d, m[1], m[2] + m[4] * .36 * d, m[3], m[4]], .36 * d, m[1]); GLB.mat = 0; gBeam(b, [b[0], b[1] + .3, b[2]], .008, '#f2f2f2');
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
  if (len() > room) C.splice(1); // (a short hop between neighbours: the engine alone, or a single car)
  return { C, len: len(), era, fits: len() <= room };
}
const TRAIN_SP = [[.75, .16], [1.25, .3], [2.4, .5]]; // top speed (tiles a second) and how fast they get going, by age
// Block signals at the junctions: a train claims the run of junction tiles ahead before it gets there (and holds the ones
// under it); if another line's train has them, it eases to a stand at the signal and waits. A train that has waited a
// long while goes anyway, so two trains can never hold each other up for good.
function trainBlock(tr, len) { // the run of junction tiles ahead of its head, within a few tiles: [path index of its first tile, tiles]
  const P = tr.r.path, L = P.length - 1, cf = RAILX.cf, head = tr.dir > 0 ? tr.lo + len : tr.lo;
  for (let k = Math.round(head) + tr.dir, n = 0; k >= 1 && k <= L - 1 && n < 3; k += tr.dir, n++) if (cf.has(P[k])) {
    const run = []; for (let j = k; j >= 1 && j <= L - 1 && cf.has(P[j]); j += tr.dir) run.push(P[j]); return [k, run]; }
  return null;
}
function stepTrains(dt) {
  const busy = DYN.railBusy || (DYN.railBusy = new Set()); busy.clear();
  railMap(); const claim = new Map(); // junction tile -> the train that has it
  for (const tr of DYN.trains) { const { len, fits } = trainCars(tr); if (!fits || tr.lo == null) continue; const P = tr.r.path;
    for (let k = Math.round(tr.lo); k <= Math.round(tr.lo + len); k++) if (RAILX.cf.has(P[k])) claim.set(P[k], tr); // (under it)
    for (const i of tr.res || []) if (!claim.has(i)) claim.set(i, tr); } // (claimed last time, not yet passed)
  for (const tr of DYN.trains) {
    const P = tr.r.path, L = P.length - 1, { len, era, fits } = trainCars(tr), [vm, ac] = TRAIN_SP[era]; if (!fits) { tr.lo = .5; continue; } // (too short a line for any train)
    if (tr.lo == null || tr.lo + len > L - .5 + 1e-6) { tr.lo = .5; tr.v = 0; }
    if (tr.wait > 0) { tr.wait -= dt; tr.v = 0; }
    else {
      let rem = tr.dir > 0 ? (L - .5) - (tr.lo + len) : tr.lo - .5;
      const bk = trainBlock(tr, len); tr.res = null; if (!bk) tr.go = null;
      if (bk) { const [k, run] = bk, free = tr.go === run[0] || run.every(i => { const o = claim.get(i); return !o || o === tr || ((o.sig || 0) > 0 && (tr.sig || 0) > 4 && (tr.sig || 0) >= (o.sig || 0)); }); // (one that is itself held at a signal gives way to the train that has waited longer, so a knot of short lines can't lock up)
        if (free || (tr.sig || 0) > 20) { tr.res = run; tr.go = run[0]; // (once given the road it keeps it until it's through)
          for (const i of run) claim.set(i, tr); tr.sig = 0; }
        else { const stop = tr.dir > 0 ? (k - .5) - (tr.lo + len) - .12 : tr.lo - (k + .5) - .12; if (stop < rem) rem = Math.max(0, stop); tr.sig = (tr.sig || 0) + dt; } } // (held at the signal)
      const signal = rem < (tr.dir > 0 ? (L - .5) - (tr.lo + len) : tr.lo - .5) - 1e-6, top = Math.min(vm, Math.sqrt(2 * ac * Math.max(0, rem)) + (signal ? 0 : .04)); // easing into the station, or up to a red signal
      tr.v = Math.min(top, (tr.v || 0) + ac * dt); const d = Math.min(rem, tr.v * dt); tr.lo += tr.dir * d; tr.dist = (tr.dist || 0) + d;
      if (rem - d <= 1e-4 && !signal) { tr.dir = -tr.dir; tr.v = 0; tr.wait = rf(8, 15); }
    }
    tr.s = tr.dir > 0 ? tr.lo + len : tr.lo; // (its head, for the film camera)
    const ah = tr.wait > 0 ? 0 : 1.6, s0 = tr.dir > 0 ? tr.lo - .3 : tr.lo - ah, s1 = tr.dir > 0 ? tr.lo + len + ah : tr.lo + len + .3; // under it, and the way it's going (a train standing at the platform holds nobody up)
    for (let s = Math.round(s0); s <= Math.round(s1); s++) if (s >= 0 && s <= L) busy.add(P[s]);
    if (era === 0 && tr.v > .05 && GL3.eye) { const p = railPos(P, tr.s - tr.dir * .1, railLane(tr.r)); if (Math.hypot(p[0] - GL3.eye[0], p[2] - GL3.eye[2]) < 45 && chance(dt * (2 + tr.v * 9))) SMOKE3(p[0] + rf(-.02, .02), p[1] + .4, p[2] + rf(-.02, .02), '#ece8e2', .5, .14); } // steam from the chimney
  }
}
function trainPos(tr) { return railPos(tr.r.path, tr.s, railLane(tr.r)); }
// the crossing's barriers come down while a train is near; walkers and carts wait at the edge
function railBusy(i) { return !!(DYN.railBusy && DYN.railBusy.has(i)); }

function glTrains() {
  const eye = GL3.eye || [0, 0, 0], XG = DYN.xing || (DYN.xing = new Map()), dt = Math.min(GL3.dt || .016, .1);
  railMap();
  for (const i of RAILX.xs || []) { // barriers
    const x = i % W, z = (i / W) | 0; if (Math.hypot(x - eye[0], z - eye[2]) > 30) continue;
    const L = RAILX.m.get(i); if (!L) continue; const mo = Math.max(...L.map(q => Math.abs(q[2] + q[3]) / 2)), p = railPt(i, L[0][0], L[0][1], .5), l = Math.hypot(p[3], p[4]) || 1, f = [p[3] / l, 0, p[4] / l], r = [-f[2], 0, f[0]];
    const want = railBusy(i) ? 1 : 0, a = XG.get(i) || 0, na = a + clamp(want - a, -dt * .8, dt * .8); XG.set(i, na); const ang = na * Math.PI / 2, y = GT(i) + .008;
    for (const s of [-1, 1]) { const piv = [x + f[0] * .3 * s + r[0] * (.36 + mo) * s, y + .12, z + f[2] * .3 * s + r[2] * (.36 + mo) * s]; // (outside every track)
      GLB.mat = 0; glOBox([piv[0], y + .06, piv[2]], [.012, 0, 0], [0, 0, .012], [0, .06, 0], '#e8e4dc');
      const dir = [-f[0] * s * Math.sin(ang), Math.cos(ang), -f[2] * s * Math.sin(ang)]; // straight up, swinging down across the road
      for (let q = 0; q < 4; q++) { const c = [piv[0] + dir[0] * (.07 + q * .13), piv[1] + dir[1] * (.07 + q * .13), piv[2] + dir[2] * (.07 + q * .13)]; glOBox(c, V3s(dir, .065), V3s(r, .006), V3s(V3x(dir, r), .008), q % 2 ? '#f4f1ea' : '#c83a32'); }
      if (want && (GL3.t * 2 + s) % 2 < 1) glOBox([piv[0], y + .2, piv[2]], [.014, 0, 0], [0, 0, .014], [0, .014, 0], '#ff4030', 3); }
  }
  for (const tr of DYN.trains) {
    const P = tr.r.path, { C, len, era, fits } = trainCars(tr), head = tr.dir > 0 ? tr.lo + len : tr.lo; if (!fits) continue;
    const ln = railLane(tr.r), h0 = railPos(P, head, ln); if (Math.hypot(h0[0] - eye[0], h0[2] - eye[2]) > 70) continue;
    let off = 0;
    for (let k = 0; k < C.length; k++) {
      const [kind, cl] = C[k], sc = head - tr.dir * (off + cl / 2), bo = cl / 2 - .1; off += cl + .04;
      const A = railPos(P, sc + tr.dir * bo, ln), B = railPos(P, sc - tr.dir * bo, ln), c = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + (era === 2 ? .215 : .058), (A[2] + B[2]) / 2];
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

/* ---------- trams: a line along the streets of each town (sim.js tramRoute, T._tram), the tracks set in the road ---------- */
const TRAMX = { S: null, g: -1, m: null };
function tramMap() { // road tile -> its pieces [[prev, next], ...]
  const g = S.tramGen || 0; if (TRAMX.S === S && TRAMX.g === g) return TRAMX.m;
  const m = new Map();
  for (const T of towns()) { const P = T._tram; if (!P) continue; for (let k = 0; k < P.length; k++) { const i = P[k], a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)]; let L = m.get(i); if (!L) m.set(i, L = []); L.push([a === i ? -1 : a, b === i ? -1 : b]); } }
  TRAMX.S = S; TRAMX.g = g; TRAMX.m = m; return m;
}
const tramRoadY = i => M.water[i] ? bridgeZ(i) * ZS : GT(i) + .006;
const TRAM_O = .095; // two tracks down the street, one each way, this far either side of its middle (trams keep to the right)
function tramPt(i, a, b, t, o = 0) { // like railPt, on the road (an end of the line stops at the tile's middle); o: that far to the right
  const x = i % W, z = (i / W) | 0, E = a < 0 ? [x, z] : [(x + a % W) / 2, (z + ((a / W) | 0)) / 2], X = b < 0 ? [x, z] : [(x + b % W) / 2, (z + ((b / W) | 0)) / 2], u = 1 - t;
  const hi = tramRoadY(i), hE = a < 0 ? hi : (hi + tramRoadY(a)) / 2, hX = b < 0 ? hi : (hi + tramRoadY(b)) / 2;
  const p = [u * u * E[0] + 2 * u * t * x + t * t * X[0], hE + (hX - hE) * t, u * u * E[1] + 2 * u * t * z + t * t * X[1], 2 * (u * (x - E[0]) + t * (X[0] - x)) || (X[0] - E[0]), 2 * (u * (z - E[1]) + t * (X[1] - z)) || (X[1] - E[1])];
  if (o) { const l = Math.hypot(p[3], p[4]) || 1; p[0] -= p[4] / l * o; p[2] += p[3] / l * o; }
  return p;
}
function tramPos(P, s, o = 0) { const L = P.length - 1, j = clamp(Math.round(s), 0, L), t = clamp(s - j + .5, 0, 1); return tramPt(P[j], j > 0 ? P[j - 1] : -1, j < L ? P[j + 1] : -1, t, o); }
function glTramTile(i, x, y) {
  const L = tramMap().get(i); if (!L) return;
  const lod = GLB.lod, el = hasTech('electric');
  for (const [a, b] of L) {
    const n = lod ? 6 : 2, P = []; for (let k = 0; k <= n; k++) { const p = tramPt(i, a, b, k / n), l = Math.hypot(p[3], p[4]) || 1; P.push([p[0], p[1], p[2], p[3] / l, p[4] / l]); }
    const side = (p, d, yy) => [p[0] - p[4] * d, yy, p[2] + p[3] * d];
    GLB.mat = 0; const c = gcol('#4d5054');
    for (const d of [-TRAM_O - .045, -TRAM_O + .045, TRAM_O - .045, TRAM_O + .045]) for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; GLB.ctr = [(A[0] + B[0]) / 2, A[1] - 1, (A[2] + B[2]) / 2]; gquad(side(A, d - .006, A[1] + .003), side(A, d + .006, A[1] + .003), side(B, d + .006, B[1] + .003), side(B, d - .006, B[1] + .003), c); } // the grooved rails, set in the road
    if (el) { for (let k = 0; k < n; k++) { const A = P[k], B = P[k + 1]; for (const d of [-TRAM_O, TRAM_O]) gBeam(side(A, d, A[1] + .5), side(B, d, B[1] + .5), .003, '#3a3d41'); } // a wire over each track
      if ((x + y) % 2 === 0) { const m = P[(n / 2) | 0], s = hash2(x, y, 43) < .5 ? -1 : 1, base = side(m, s * .3, m[1]); gBeam(base, [base[0], m[1] + .56, base[2]], .009, '#5d6268'); gBeam([base[0], m[1] + .54, base[2]], side(m, -s * TRAM_O, m[1] + .51), .004, '#5d6268'); } } // a pole and its arm across both tracks, every other tile
  }
}
const TRAM_COL = [['#2f5a3e', '#e9dcc0'], ['#7a2e2a', '#e9dcc0'], ['#2a4a6e', '#efe6d2'], ['#c8553d', '#efe6d2']];
function stepTrams(dt) {
  const D = DYN.trams || (DYN.trams = []); if (DYN.tramS !== S) { D.length = 0; DYN.tramS = S; }
  for (const T of towns()) for (const n of [0, 1]) { const P = T._tram; let tm = D.find(o => o.sid === T.id && o.n === n); if (!P) { if (tm) D.splice(D.indexOf(tm), 1); continue; } // (two to a town: one sets off from each end)
    if (!tm) D.push(tm = { sid: T.id, n, P, s: n ? P.length - 1 : 0, dir: n ? -1 : 1, off: n ? -TRAM_O : TRAM_O, wait: rf(0, 4), v: 0, next: n ? P.length - 6 : 5, dist: 0 }); if (tm.P !== P) Object.assign(tm, { P, s: clamp(tm.s, 0, P.length - 1) }); }
  for (const tm of D) {
    const L = tm.P.length - 1, vm = hasTech('electric') ? .6 : .32;
    if (tm.wait > 0) { tm.wait -= dt; tm.v = 0; continue; }
    const ahead = D.some(o => o !== tm && o.sid === tm.sid && Math.abs((o.off || 0) - (tm.off || 0)) < .12 && (o.s - tm.s) * tm.dir > 0 && (o.s - tm.s) * tm.dir < 1.1); // (the other one in the way on this track: wait behind it)
    if (ahead) { tm.v = 0; continue; }
    tm.v = Math.min(vm, tm.v + .4 * dt); const d = tm.v * dt; tm.s += tm.dir * d; tm.dist += d;
    const to = tm.dir * TRAM_O; tm.off = (tm.off == null ? to : tm.off) + clamp(to - tm.off, -d * .35, d * .35); // (over the crossover to its own track after turning back at the end)
    if (tm.s >= L || tm.s <= 0) { tm.s = clamp(tm.s, 0, L); tm.dir = -tm.dir; tm.wait = rf(5, 9); tm.next = tm.s + tm.dir * 5; continue; }
    if ((tm.dir > 0 && tm.s >= tm.next) || (tm.dir < 0 && tm.s <= tm.next)) { tm.wait = rf(2, 3.5); tm.next = tm.s + tm.dir * (4 + ((tm.s * 7) | 0) % 3); } // a stop: folk get on and off
  }
}
function glTrams() {
  const eye = GL3.eye || [0, 0, 0], era = hasTech('computing') ? 2 : hasTech('electric') ? 1 : 0;
  for (const tm of DYN.trams || []) {
    const hl = era === 2 ? .36 : era === 1 ? .26 : .19, A = tramPos(tm.P, tm.s + tm.dir * hl * .7, tm.off || 0), B = tramPos(tm.P, tm.s - tm.dir * hl * .7, tm.off || 0), c = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2 + .02, (A[2] + B[2]) / 2];
    if (Math.hypot(c[0] - eye[0], c[2] - eye[2]) > 45) continue;
    let fx = A[0] - B[0], fz = A[2] - B[2]; const fl = Math.hypot(fx, fz) || 1; fx /= fl; fz /= fl;
    glTram(era, c, [fx, 0, fz], [-fz, 0, fx], hl, tm, Math.hypot(c[0] - eye[0], c[1] - eye[1], c[2] - eye[2]) > 16);
  }
}
function glTram(era, c, f, r, hl, tm, far) {
  const K = 1, P = (s, t, y) => [c[0] + f[0] * s + r[0] * t, c[1] + y * K, c[2] + f[2] * s + r[2] * t], lit = GL3.litNow, [c1, c2] = TRAM_COL[tm.sid % TRAM_COL.length]; // (K: how tall it stands; folk come up to about its windows)
  const box = (s0, s1, t, y0, y1, col, e = 0) => { GLB.mat = 0; glOBox(P((s0 + s1) / 2, 0, (y0 + y1) / 2), V3s(f, (s1 - s0) / 2), V3s(r, t), [0, (y1 - y0) / 2 * K, 0], col, e); };
  const wins = (s0, s1, y0, y1, m) => { for (const t of [-1, 1]) for (let q = 0; q < m; q++) { const s = s0 + (q + .5) / m * (s1 - s0); glOBox(P(s, t * .081, (y0 + y1) / 2), V3s(f, (s1 - s0) / m * .36), V3s(r, .003), [0, (y1 - y0) / 2 * K, 0], '#3a4250', .25 + .6 * hash2(tm.sid, q, t + 5)); } };
  const wheels = ss => { if (far) return; for (const s of ss) for (const t of [-1, 1]) trCyl(P(s, t * .06, .025), r, f, [0, 1, 0], .025 * K, .008, 8, '#2a2a2c'); };
  if (era === 0) { // a horse tram: a little car with a clerestory, a driver's platform, the horse in front
    box(-hl, hl, .075, .03, .19, c1); box(-hl + .02, hl - .02, .077, .1, .17, c2); wins(-hl + .04, hl - .04, .11, .165, 4); box(-hl - .02, hl + .02, .085, .19, .2, '#4a4a4e'); box(-hl * .6, hl * .6, .04, .2, .225, '#4a4a4e'); wheels([-hl + .06, hl - .06]);
    const hx = hl + .16, ph = (tm.dist || 0) * 14 * tm.dir, H = (s, t, y) => [c[0] + f[0] * s + r[0] * t, c[1] + y, c[2] + f[2] * s + r[2] * t], hc = '#6b4a34'; GLB.mat = 0; // a cart horse, a little bigger than life like everything here
    glOBox(H(hx, 0, .2), V3s(f, .1), V3s(r, .04), [0, .05, 0], hc); glOBox(H(hx + .12, 0, .27), V3s(f, .035), V3s(r, .025), [0, .05, 0], hc); glOBox(H(hx + .16, 0, .31), V3s(f, .05), V3s(r, .022), [0, .025, 0], hc); glOBox(H(hx + .12, 0, .31), V3s(f, .03), V3s(r, .008), [0, .03, 0], '#2a1e16'); // body, neck, head, mane
    for (const t of [-1, 1]) gBeam(H(hl, t * .05, .16), H(hx + .05, t * .045, .2), .005, '#5a4030'); // the shafts
    if (!far) for (const [lf, lr, q] of [[.075, .025, 0], [.075, -.025, Math.PI], [-.075, .025, Math.PI], [-.075, -.025, 0]]) glLimb(H(hx + lf, lr, .16), f, r, tm.v > .02 ? Math.sin(ph + q) * .45 : 0, .16, .013, '#5a3e2c');
    if (lit) glOBox(P(hl + .025, 0, .17), V3s(f, .006), V3s(r, .01), [0, .01, 0], '#ffe2a0', 2); return; }
  if (era === 1) { // an electric tram: cream and colour, a row of windows, a trolley pole up to the wire
    box(-hl, hl, .08, .025, .12, c1); box(-hl, hl, .08, .12, .22, c2); wins(-hl + .05, hl - .05, .13, .205, 6); box(-hl - .01, hl + .01, .084, .22, .235, '#5a5f66'); box(-hl * .7, hl * .7, .045, .235, .255, '#5a5f66'); wheels([-hl + .07, hl - .07]);
    if (!far) { const base = P(-hl * .3, 0, .255), tip = [base[0] - f[0] * .14, c[1] + .5, base[2] - f[2] * .14]; gBeam(base, tip, .004, '#3a3d41'); } // the trolley pole, up to the wire
    if (lit) for (const s of [1, -1]) glOBox(P(s * (hl + .004), 0, .1), V3s(f, .006), V3s(r, .014), [0, .012, 0], s > 0 ? '#fff4d6' : '#ff5a3c', 2); return; }
  // a modern tram: two long low-floor sections, wide windows, a pantograph
  for (const sg of [-1, 1]) { const s0 = sg < 0 ? -hl : .01, s1 = sg < 0 ? -.01 : hl; box(s0, s1, .085, .02, .24, '#f2f4f7'); box(s0, s1, .087, .06, .2, '#2c3e50', .55); box(s0, s1, .088, .028, .045, TRAM_COL[tm.sid % 4][0]); box(s0 + .01, s1 - .01, .08, .24, .26, '#c9cdd2'); }
  box(-.012, .012, .07, .03, .23, '#3a3d41'); wheels([-hl + .08, -.08, .08, hl - .08]);
  if (!far) { const b0 = P(.12, 0, .26), tp = [b0[0], c[1] + .5, b0[2]]; gBeam(P(.06, 0, .26), tp, .004, '#3a3d41'); gBeam(P(.18, 0, .26), tp, .004, '#3a3d41'); glOBox(tp, V3s(f, .01), V3s(r, .05), [0, .003, 0], '#3a3d41'); } // the pantograph, up to the wire
  if (lit) for (const s of [1, -1]) for (const t of [-1, 1]) glOBox(P(s * (hl + .004), t * .05, .07), V3s(f, .005), V3s(r, .01), [0, .008, 0], s > 0 ? '#fff4d6' : '#ff5a3c', 2);
}
