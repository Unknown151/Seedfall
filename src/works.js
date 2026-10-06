/* ============================== work you can watch: production buildings in 3D, and what moves on them ============================== */
// Two halves. The still parts some types lacked in 3D, because their old art was lines and flat shapes: pits for the quarry,
// the clay and the sand (glPit), log piles (glLogPile), the mine's headframe, the quarry's derrick, the weaver's drying frame,
// the shipyard's slipway and hull, and the wind turbine's tower. They're built into chunks like any building (called from
// buildings.js when GLB is set). Then the moving parts, rebuilt every frame in glPeople by glWorks: sails and blades turning
// with the wind, the mine's winding wheel and cage, harbour cranes swinging, a derrick hoisting blocks, flywheels, cloth
// drying, a glowing kiln and furnace, and by day the folk at work: chopping, digging, shovelling, hammering, blowing glass,
// hoeing, harvesting, carrying crates, a shepherd and a dog, a tractor later on. All of it is view only (GL3.t and hashes,
// never the sim's randomness), nothing is saved, and none of it changes the world.
const WKR = 46, WKP = 15, WKN = 24; // machines are drawn this near the eye, people this near (and at most this many workplaces of them)
const WKF = new Map(), WKS = new Map(), WK_COL = ['#8a6a4a', '#6e7f5c', '#9a5a44', '#5f6f86', '#7a6a8a', '#a07850'];
const wkV = (f, a) => [f[0] * Math.sin(a), -Math.cos(a), f[2] * Math.sin(a)]; // the way an arm (or what it holds) points at swing angle a: 0 down, π/2 forward, π up
const wkAdd = (p, d, k) => [p[0] + d[0] * k, p[1] + d[1] * k, p[2] + d[2] * k];
const wkLift = (ph, a0, a1, up = .7) => ph < up ? a0 + (a1 - a0) * Math.sin(ph / up * Math.PI / 2) : a1 + (a0 - a1) * ((ph - up) / (1 - up)) ** 2; // a slow lift to a1, then a quick blow back to a0
function wkFolk(B, n) { // how the people at a workplace look (the same every time: hashed from the building)
  const k = B.id * 4 + n; let o = WKF.get(k); if (!o && WKF.size > 2000) WKF.clear();
  if (!o) { const h = s => hash2(B.id | 0, n, s); o = { col: WK_COL[(h(1) * WK_COL.length) | 0], pants: PANTS[(h(2) * PANTS.length) | 0], hair: HAIR[(h(3) * HAIR.length) | 0], skin: SKIN[(h(4) * SKIN.length) | 0], hat: h(5) * .4, kid: false, ph: 0, kind: 'p', arms: null, pet: false }; WKF.set(k, o); if (WKF.size > 400) WKF.delete(WKF.keys().next().value); }
  return o;
}
function wkMan(B, n, X, Z, y, h, arms, walk) { // a worker at (X, Z) facing h, arms held [right, left] (null: swinging as they walk); walk: their stride, or null standing
  const o = wkFolk(B, n); o.arms = arms; o.ph = walk || 0; GL3.wkN++;
  return glPerson(o, X, Z, y, h, walk != null, false) || [null, null];
}
function wkSpin(B, rate, k = 0) { // an angle that keeps turning (sails, wheels), smoothly when the rate changes
  const key = B.id * 4 + k, a = (WKS.has(key) ? WKS.get(key) : hash2(B.id | 0, k, 9) * TAU) + rate * Math.min(GL3.dt || .016, .1);
  if (WKS.size > 3000) WKS.clear(); WKS.set(key, a); return a;
}
const wkF = h => [Math.cos(h), 0, Math.sin(h)];
function wkTool(hand, h, a, len, kind) { // a tool held in the hand at swing angle a: a handle, and its head
  if (!hand) return null; len *= PS; // (in the hand of a person at the world's scale: gl.js glPerson)
  const f = wkF(h), d = wkV(f, a), p = wkV(f, a + Math.PI / 2), r = [-f[2], 0, f[0]], tip = wkAdd(hand, d, len);
  gBeam(wkAdd(hand, d, -.015 * PS), tip, .0032 * PS, '#6b5040'); GLB.mat = 0; const nh = GLB.v.length;
  if (kind === 'axe') glOBox(wkAdd(tip, p, .007), V3(d, .011), V3(r, .003), V3(p, .015), '#9aa3ad');
  else if (kind === 'pick') glOBox(tip, V3(d, .004), V3(r, .004), V3(p, .032), '#8a929c');
  else if (kind === 'hammer') glOBox(tip, V3(d, .007), V3(r, .008), V3(p, .013), '#4a4f56');
  else if (kind === 'spade') glOBox(wkAdd(tip, d, .014), V3(d, .017), V3(r, .013), V3(p, .002), '#8a929c');
  else if (kind === 'hoe') glOBox(wkAdd(tip, p, .011), V3(d, .003), V3(r, .013), V3(p, .012), '#8a929c');
  glShrink(nh, tip, PS); return tip;
}
function wkBits(at, tau, n, col, glow, seed) { // a burst of chips or sparks, tau seconds after the blow
  if (!at || tau < 0 || tau > .45) return;
  for (let k = 0; k < n; k++) {
    const a = hash2(seed, k, 3) * TAU, v = .25 + hash2(seed, k, 4) * .35, up = .3 + hash2(seed, k, 5) * .5;
    glOBox([at[0] + Math.cos(a) * v * tau, at[1] + up * tau - 2.4 * tau * tau, at[2] + Math.sin(a) * v * tau], [.005, 0, 0], [0, 0, .005], [0, .005, 0], col, glow ? 2 : 0);
  }
}
function gLog(A, Bp, r, col, end = '#d8b98a', mat = M_BARK) { // a round log from A to B: eight staves and two cut ends
  const C = gcol(col), E = gcol(end), d = [Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], L = Math.hypot(...d) || 1, ax = V3s(d, 1 / L);
  let s = Math.abs(ax[1]) < .9 ? V3x(ax, [0, 1, 0]) : V3x(ax, [1, 0, 0]); s = V3s(s, 1 / (Math.hypot(...s) || 1)); const t = V3x(ax, s);
  const R = k => { const a = k / 8 * TAU; return V3a(V3s(s, Math.cos(a) * r), V3s(t, Math.sin(a) * r)); };
  GLB.ctr = V3a(A, V3s(d, .5)); GLB.mat = mat;
  for (let k = 0; k < 8; k++) { const p = R(k), q = R(k + 1); gquad(V3a(A, p), V3a(Bp, p), V3a(Bp, q), V3a(A, q), C); }
  GLB.mat = 0; for (const [P0, sg] of [[A, -1], [Bp, 1]]) { GLB.ctr = V3a(P0, V3s(ax, -sg * r)); for (let k = 0; k < 8; k++) gtri(P0, V3a(P0, R(k)), V3a(P0, R(k + 1)), E); }
}

/* ---------- the still parts (built into chunks) ---------- */
// A pit can't go down into the ground the chunk is built on, so banks rise round its back instead, stepped down in terraces to its floor.
function glPit(u0, v0, hw, hd, depth, rim, wall, floor, steps, mat = M_EARTH) {
  const X = GLB.x + u0, Z = GLB.y + v0, y = GLB.base, bw = Math.min(hw, hd) * .55 / Math.max(1, steps);
  gBox([X, y, Z], [hw - .001, 0, 0], [0, 0, hd - .001], .3 * ZS, floor, mat);
  for (let k = 0; k < steps; k++) { const w = bw * (k + 1), h = Math.max(1.2, depth * (1 - k / steps)) * ZS, col = k ? wall : rim; // a tall narrow lip at the back, lower and wider terraces inside it
    const e = k * .002; gBox([X, y, Z - hd + w / 2 + e / 2], [hw - e, 0, 0], [0, 0, w / 2 - e / 2], h, col, mat); gBox([X - hw + w / 2 + e / 2, y, Z], [w / 2 - e / 2, 0, 0], [0, 0, hd - e], h, col, mat); } // (each set in a hair, so their outer faces don't flicker against each other)
  gBox([X, y, Z + hd - .02], [hw, 0, 0], [0, 0, .025], 1.4 * ZS, rim, mat); gBox([X + hw - .02, y, Z], [.025, 0, 0], [0, 0, hd], 1.4 * ZS, rim, mat); // a low spoil bank on the open sides
}
function glLogPile(u, v, n, col) { // logs stacked in a pyramid, cut ends out
  const X = GLB.x + u, Z = GLB.y + v, y = GLB.base, r = .024;
  for (let row = 0; row < n; row++) for (let k = 0; k < n - row; k++) { const o = (k - (n - row - 1) / 2) * r * 2.05, yy = y + r + row * r * 1.75; gLog([X - .11, yy, Z + o], [X + .11 + hash2(k, row, 7) * .02, yy, Z + o], r, shade(col, .9 + hash2(row, k, 8) * .2)); }
}
function glMineFrame(B) { // the headframe over the shaft: two legs, a back stay and a collar (the wheel and the cage move: GLW.mine)
  const X = GLB.x + .2, Z = GLB.y - .1, y = GLB.base, top = y + 22 * ZS;
  for (const s of [-1, 1]) gBeam([X + s * .1, y, Z + .02], [X + s * .02, top, Z], .01, '#7a5a44', M_PLANK);
  gBeam([X, y, Z - .16], [X, top - .02, Z - .01], .009, '#6b5040', M_PLANK);
  gBeam([X - .07, y + 9 * ZS, Z + .015], [X + .07, y + 9 * ZS, Z + .015], .007, '#6b5040', M_PLANK);
  gBox([X, y, Z], [.06, 0, 0], [0, 0, .06], 1.6 * ZS, '#5a4a40', M_PLANK);
}
function glDerrick(u, v) { // the quarry's wooden derrick mast (its boom swings: GLW.quarry)
  const X = GLB.x + u, Z = GLB.y + v, y = GLB.base, top = y + 17 * ZS;
  for (const [a, b] of [[-.05, .04], [.05, .04], [0, -.06]]) gBeam([X + a, y, Z + b], [X, top, Z], .008, '#7a5a44', M_PLANK);
}
function glDryFrame(u0, v0) { // the weaver's frame: two posts and a rail (the cloth on it moves: GLW.weaver)
  const X = GLB.x + u0, Z = GLB.y, y = GLB.base;
  for (const v of [-.3, .3]) gBeam([X, y, Z + v], [X, y + 8.4 * ZS, Z + v], .007, '#7a5a44', M_PLANK);
  gBeam([X, y + 8 * ZS, Z - .31], [X, y + 8 * ZS, Z + .31], .005, '#6b5040', M_PLANK);
}
function glTurbine(B) { // a tall white tower on its pad and the nacelle on top (the blades turn: GLW.turbine)
  const X = GLB.x, Z = GLB.y, y = GLB.base;
  gBox([X, y, Z], [.13, 0, 0], [0, 0, .13], .02, '#cfcac4', M_STONE);
  GLB.wall = 0; kSet(X, Z, [1, 0, 0], [0, 0, 1], B.id); kCone(0, 0, .02, .05, 55 * ZS - .02, '#f2f3f5', 14, 0, .03); kCyl(0, 0, 55 * ZS - .02, .032, .02, '#e2e4e8', 0, 12); // a tapering tower
  if (KF.lod) for (const yy of [.6, 1.4, 2.1]) kCyl(0, 0, yy, .05 - yy / (55 * ZS) * .02 + .002, .008, '#dfe2e6', 0, 12, 0); // its section joints
  gBox([X + .03, y + 55 * ZS, Z], [.08, 0, 0], [0, 0, .035], 3.2 * ZS, '#e7e9ec');
  kSet(X, Z, [1, 0, 0], [0, 0, 1], B.id); kDoor(0, .044, .018, .075, '#c9ced4', { ty: 'plank', y: .02 }); // a door at its foot, and the kiosk the power goes out through
  kBox(.16, .08, 0, .035, .025, .055, '#d6dade', M_PLASTER); if (KF.lod) { kBox(.16, .106, .005, .02, .002, .035, '#9aa3ad'); kBox(.16, .106, .04, .006, .002, .006, '#e0a43a'); }
}
// the shipyard: a slipway running down into the water, a hull on it with its ribs up and part planked, a gantry and the shed
function glShipyard(B, st) {
  const d = B.dir || [1, 0], X = GLB.x, Z = GLB.y, y = GLB.base, P = (a, b, z) => [X + d[0] * a + d[1] * b, y + z * ZS, Z + d[1] * a + d[0] * b];
  const old = shipKind() === 'sail' || shipKind() === 'steamer', hull = old ? '#9b7657' : '#7d8793', frac = .35 + (B.var || 0) * .6, zk = a => .3 + (-3.3) * (a + .35) / 1.1 + 1.6; // (the keel sits on the slope)
  GLB.ctr = P(.2, 0, -30); GLB.mat = M_PLANK; gquad(P(-.35, -.2, .3), P(.75, -.2, -3), P(.75, .2, -3), P(-.35, .2, .3), gcol('#b8a489'));
  const hm = old ? M_PLANK : 0, rib = shade(hull, .82);
  gBeam(P(-.25, 0, zk(-.25)), P(.42, 0, zk(.42)), .011, shade(hull, .7), hm); gBeam(P(.42, 0, zk(.42)), P(.5, 0, zk(.42) + 8), .009, shade(hull, .7), hm); // the keel and the stem
  for (let k = 0; k < 7; k++) { const a = -.2 + k * .1, zb = zk(a) + .6, zt = zb + 6.2;
    gBeam(P(a, -.13, zt), P(a, -.05, zb), .006, rib, hm); gBeam(P(a, -.05, zb), P(a, .05, zb), .006, rib, hm); gBeam(P(a, .05, zb), P(a, .13, zt), .006, rib, hm);
    if (k < 6 && (k + 1) / 6 <= frac) { const a1 = a + .1, zb1 = zk(a1) + .6, zt1 = zb1 + 6.2, C = gcol(shade(hull, 1)); GLB.mat = hm; GLB.ctr = P(a + .05, 0, zb + 3); // planked between these ribs
      for (const s of [-1, 1]) gquad(P(a, s * .13, zt), P(a1, s * .13, zt1), P(a1, s * .05, zb1), P(a, s * .05, zb), C);
      gquad(P(a, -.05, zb), P(a1, -.05, zb1), P(a1, .05, zb1), P(a, .05, zb), C); } }
  for (const b of [-.3, .3]) gBeam(P(.15, b, 0), P(.15, b, 20), .014, '#c8553d'); // the gantry (its hoist moves: GLW.shipyard)
  gBeam(P(.15, -.31, 20), P(.15, .31, 20), .014, '#c8553d'); gBox(P(.15, .3, 20.6), [.012, 0, 0], [0, 0, .012], .02, '#ff4d4d', 0, 2);
  { const c = gw(-d[0] * .3, -d[1] * .3, 0), [wc, wm] = kWall(B, st); kSet(c[0], c[2], [d[1], 0, d[0]], [d[0], 0, d[1]], B.id); // the shed: big doors to the slip, windows, a gable, timber stacked by
    kPlinth(-.16, .16, -.16, .16, .02); kBox(0, 0, .02, .16, .16, .3, wc, wm); kBox(0, .16, .02, .1, .006, .22, '#4a3a30', M_PLANK); if (KF.lod) for (const dd of [-1, 1]) kBeam([dd * .1, .168, .03], [0, .168, .2], .003, '#3a2a20', M_PLANK);
    kWalls(-.16, .16, -.16, .16, (a, b, ff, q) => kWins(a, b, ff, .02, .28, 1, 2, { back: 1, hk: .45 }, null, q * 5), 14); kGable(-.17, .17, -.16, .16, .32, .14, st.roof, { wall: wc, wm });
    if (KF.lod) for (let q = 0; q < 4; q++) kLog([-.2, -.22 + q * .03, .016], [.12, -.22 + q * .03, .016], .014, '#9b7657', '#d8b98a'); }
}

/* ---------- what moves, every frame (near the camera) ---------- */
function wkFlywheel(B, c, u, v, R, h, col) { // a flywheel by the wall with its crank and piston rod
  const a = wkSpin(B, 2.4), hub = [c.X + u, c.y + h, c.Z + v], sp = k => [Math.cos(a + k * TAU / 6), Math.sin(a + k * TAU / 6), 0];
  for (let k = 0; k < 3; k++) gBeam(wkAdd(hub, sp(k), -R), wkAdd(hub, sp(k), R), .006, col);
  for (let k = 0; k < 10; k++) { const p = [Math.cos(a + k * TAU / 10), Math.sin(a + k * TAU / 10), 0], q = [Math.cos(a + (k + 1) * TAU / 10), Math.sin(a + (k + 1) * TAU / 10), 0]; gBeam(wkAdd(hub, p, R), wkAdd(hub, q, R), .011, col); }
  const pin = wkAdd(hub, sp(0), R * .55), cyl = [hub[0] - R * 2.6, hub[1], hub[2]];
  gBeam(pin, [pin[0] - R * 1.4 - Math.cos(a) * R * .2, hub[1], hub[2]], .007, '#8a8f96');
  gBox([cyl[0], hub[1] - .03, cyl[2]], [.045, 0, 0], [0, 0, .03], .06, '#4a4f56'); gBox([hub[0], c.y, hub[2] - .01], [.03, 0, 0], [0, 0, .02], h - R * .2, '#3a3d42');
}
const GLW = {
  mill(B, c) { // four sails turning into the wind
    const a = wkSpin(B, .7 * c.wind), hub = [c.X + .02, c.y + 17.5 * ZS, c.Z + .22];
    gBeam([c.X + .02, hub[1], c.Z + .08], hub, .014, '#6b5040');
    for (let k = 0; k < 4; k++) { const th = a + k * Math.PI / 2, d = [Math.cos(th), Math.sin(th), 0], s = [-Math.sin(th), Math.cos(th), 0];
      gBeam(hub, wkAdd(hub, d, .62), .008, '#6b5040'); GLB.mat = 0;
      glOBox(wkAdd(wkAdd(hub, d, .37), s, .052), V3(d, .23), V3(s, .045), [0, 0, .003], '#f2ece0');
      if (c.d < 22) for (const q of [.2, .37, .54]) gBeam(wkAdd(wkAdd(hub, d, q), s, 0), wkAdd(wkAdd(hub, d, q), s, .1), .003, '#7a5a44'); } // its lattice
    GLB.mat = 0; glOBox(hub, [.022, 0, 0], [0, .022, 0], [0, 0, .02], '#5a4436');
  },
  turbine(B, c) { // three long blades
    const a = wkSpin(B, 1.2 * c.wind), hub = [c.X + .12, c.y + 56.6 * ZS, c.Z]; GLB.mat = 0;
    for (let k = 0; k < 3; k++) { const th = a + k * TAU / 3, d = [0, Math.cos(th), Math.sin(th)], s = [0, -Math.sin(th), Math.cos(th)];
      glOBox(wkAdd(hub, d, .26), V3(d, .23), V3(s, .028), [.005, 0, 0], '#f4f5f7'); glOBox(wkAdd(hub, d, .69), V3(d, .2), V3(s, .016), [.004, 0, 0], '#f4f5f7'); }
    glOBox([hub[0] + .015, hub[1], hub[2]], [.028, 0, 0], [0, .024, 0], [0, 0, .024], '#e7e9ec');
  },
  harbor(B, c) { // the cranes swing cargo in and out (gantries run their trolley along the boom)
    const d = B.dir || [1, 0], a = d[0] ? [0, 1] : [1, 0], L = berths(B), [lx, lz] = glLot(B), steel = hasTech('steam'), boxes = hasTech('computing'), A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]];
    let y = 0; for (const j of fpTiles(B)) if (!M.water[j]) y = Math.max(y, surfZ(j) * ZS); if (!y) y = c.y;
    const P = (s, t, yy = y) => [lx + a[0] * s + d[0] * t, yy, lz + a[1] * s + d[1] * t];
    for (let k = 0; k < L; k++) { const s = -L / 2 + k + .5, tt = c.t * .3 + k * 2.1;
      if (boxes) { const hc = .95, tr = .5 + .45 * Math.sin(tt), hang = .28 + .26 * (.5 + .5 * Math.sin(tt * 1.7 + 1));
        gBox(P(s, tr, y + hc - .06), V3s(A3, .16), V3s(D3, .06), .06, hasTech('fusion') ? '#f7f9fa' : '#e8e2d6'); // (the trolley; white in the far future's port)
        gBeam(P(s, tr, y + hc - .06), P(s, tr, y + hc - .06 - hang), .004, '#2a2a2a');
        gBox(P(s, tr, y + hc - .108 - hang), V3s(A3, .075), V3s(D3, .04), .048, (hasTech('fusion') ? ['#cfe7ef', '#e8dff2', '#f2ead8', '#dbeedd'] : ['#c0584f', '#3f7fb0', '#e0a43a', '#4e9a6a'])[(k + B.id) % 4]);
      } else { const hc = (steel ? 16 : 11) * ZS, col = steel ? '#c8603a' : '#8a6446', base = P(s - .22, .32, y + hc * .75), sw = Math.sin(tt) * 1.1 - .2;
        const dir = [d[0] * Math.cos(sw) + a[0] * Math.sin(sw), 0, d[1] * Math.cos(sw) + a[1] * Math.sin(sw)], tip = [base[0] + dir[0] * .63, y + hc * 1.08, base[2] + dir[2] * .63];
        gBeam(base, tip, .012, col, steel ? 0 : M_PLANK);
        const hang = hc * (.3 + .32 * (.5 + .5 * Math.sin(tt * 1.3)));
        gBeam(tip, [tip[0], tip[1] - hang, tip[2]], .003, '#2a2a2a');
        gBox([tip[0], tip[1] - hang - .04, tip[2]], [.03, 0, 0], [0, 0, .03], .04, '#9b7657', M_PLANK); }
    }
  },
  mine(B, c) { // the winding wheel turns as the cage rides up and down the shaft
    const X = c.X + .2, Z = c.Z - .07, top = c.y + 22 * ZS + .005, R = .075, cz = (.5 + .5 * Math.sin(c.t * .35)) * .5, a = cz / R, hub = [X, top, Z];
    for (let k = 0; k < 4; k++) { const th = a + k * Math.PI / 4, dd = [Math.cos(th), Math.sin(th), 0]; gBeam(wkAdd(hub, dd, -R), wkAdd(hub, dd, R), .004, '#4a3a30'); }
    for (let k = 0; k < 10; k++) { const p = [Math.cos(a + k * TAU / 10), Math.sin(a + k * TAU / 10), 0], q = [Math.cos(a + (k + 1) * TAU / 10), Math.sin(a + (k + 1) * TAU / 10), 0]; gBeam(wkAdd(hub, p, R), wkAdd(hub, q, R), .007, '#5a4538'); }
    const cy = c.y + .03 + cz; gBeam([X + R, top, Z], [X + R, cy + .07, Z], .0025, '#2a2a2a');
    gBox([X + R, cy, Z], [.03, 0, 0], [0, 0, .03], .07, hasTech('steam') ? '#6b6470' : '#7a5a44');
  },
  quarry(B, c) { // the derrick hoists a block out of the pit; by day someone works the face with a pick
    const u = -.34, v = .3, piv = [c.X + u, c.y + 13 * ZS, c.Z + v], sc = stoneCol(idx(B.x, B.y)), sw = Math.atan2(-.35, .36) + Math.sin(c.t * .2) * .55;
    const tip = [piv[0] + Math.cos(sw) * .45, c.y + 16 * ZS, piv[2] + Math.sin(sw) * .45]; gBeam(piv, tip, .008, '#8a6446', M_PLANK);
    const lift = (.5 + .5 * Math.sin(c.t * .45)) * 10 * ZS; gBeam(tip, [tip[0], c.y + .02 + lift + .05, tip[2]], .0025, '#3a3028');
    gBox([tip[0], c.y + .01 + lift, tip[2]], [.04, 0, 0], [0, 0, .035], .045, shade(sc, 1.04), M_STONE);
    if (!c.near) return;
    const h = Math.atan2(-1, -1), ph = (c.t * .75) % 1, an = wkLift(ph, 1.05, 2.7), [hd] = wkMan(B, 0, c.X + .02, c.Z - .02, c.y + .3 * ZS, h, [an, an * .95]);
    const t2 = wkTool(hd, h, an - .9, .1, 'pick'); if (ph < .2 && t2) wkBits(t2, ph / .75, 4, shade(sc, 1.1), false, B.id * 31 + Math.floor(c.t * .75));
  },
  lumber(B, c) { // the woodcutter splits logs on the block; once there's steam, a saw bench runs logs through
    if (hasTech('steam')) { const f = (c.t * .08) % 1, X = c.X + .2, Z = c.Z - .18, y = c.y + 4.6 * ZS, a = wkSpin(B, 14, 1);
      gLog([X - .16 + f * .2, y, Z], [X - .02 + f * .2, y, Z], .018, '#8f6440'); GLB.mat = 0;
      glOBox([X + .04, y, Z], [Math.cos(a) * .03, Math.sin(a) * .03, 0], [-Math.sin(a) * .03, Math.cos(a) * .03, 0], [0, 0, .002], '#c9ced4'); }
    if (!c.near) return;
    const h = -Math.PI / 2, ph = (c.t * 1.05) % 1, an = wkLift(ph, 1.2, 3), bx = c.X - .2, bz = c.Z + .24, top = c.y + 2 * ZS;
    const [hd] = wkMan(B, 0, bx, bz + .13, c.y, h, [an, an]); const tip = wkTool(hd, h, an - .5, .1, 'axe');
    if (ph > .12) gLog([bx, top, bz], [bx, top + .05, bz], .02, '#8f6440'); // the next log stood up on the block
    else for (const s of [-1, 1]) gBox([bx + s * (.012 + ph * .25), top, bz], [.01, 0, 0], [0, 0, .02], .045 - ph * .2, '#d8b98a', M_PLANK); // the halves fall apart
    if (ph < .2) wkBits(tip, ph / 1.05, 5, '#d9b88a', false, B.id * 17 + Math.floor(c.t * 1.05));
  },
  claypit(B, c) { // the kiln's fire flickers; someone digs clay
    const fl = .5 + .5 * Math.sin(c.t * 7) * Math.sin(c.t * 3.1 + 1); GLB.mat = 0;
    glOBox([c.X + .3, c.y + 1.6 * ZS, c.Z - .07 + .005], [.022, 0, 0], [0, 0, .004], [0, .022, 0], fl > .5 ? '#ffb45e' : '#ff8a3a', 2);
    if (!c.near) return;
    const h = -Math.PI / 2 + .4, ph = (c.t * .6) % 1, an = wkLift(ph, .5, 1.5, .55), [hd] = wkMan(B, 0, c.X - .04, c.Z + .08, c.y + .3 * ZS, h, [an, an * .9]);
    const tip = wkTool(hd, h, an - .3, .11, 'spade'); if (tip && ph > .1 && ph < .55) gBox(wkAdd(tip, [0, 1, 0], .004), [.012, 0, 0], [0, 0, .012], .012, '#b8664a');
  },
  sandpit(B, c) { // shovelling sand into the cart
    if (!c.near) return;
    const h = Math.atan2(.04, -.14), ph = (c.t * .5) % 1, an = ph < .5 ? .45 + ph * 2.2 : 1.55 - (ph - .5) * 2.2, [hd] = wkMan(B, 0, c.X - .16, c.Z + .26, c.y + .3 * ZS, h, [an, an]);
    const tip = wkTool(hd, h, an - .35, .11, 'spade'); if (tip && ph > .08 && ph < .5) gBox(wkAdd(tip, [0, 1, 0], .004), [.013, 0, 0], [0, 0, .013], .012, '#ead3a2');
  },
  weaver(B, c) { // dyed cloth drying on the frame, stirring in the wind
    if (genOf(B)) return; // (a mill now: no frame outside)
    const cols = ['#c77fb0', '#7fb2c4', '#e0b04f', '#8fbf88'], X = c.X + .3, y = c.y + 8 * ZS; GLB.mat = 0;
    for (let k = 0; k < 4; k++) { const v = -.3 + (k + .5) * .15, len = (5.5 + (k % 2)) * ZS, ph = Math.sin(c.t * 1.6 * Math.min(2, c.wind) + k * 1.3) * .18 * c.wind + .06 * c.wind, hang = [Math.sin(ph), -Math.cos(ph), 0];
      glOBox(wkAdd([X, y, c.Z + v], hang, len / 2), V3(hang, len / 2), [0, 0, .026], [Math.cos(ph) * .002, Math.sin(ph) * .002, 0], cols[(k + Math.floor((B.var || 0) * 4)) % 4]); }
  },
  glassworks(B, c) { // the furnace mouth glows; the glassblower turns a gather of hot glass on the pipe
    const fl = .5 + .5 * Math.sin(c.t * 6) * Math.sin(c.t * 2.3); GLB.mat = 0;
    glOBox([c.X + .2, c.y + 2.5 * ZS, c.Z - .01 + .004], [.028, 0, 0], [0, 0, .004], [0, .028, 0], fl > .5 ? '#ffc070' : '#ff9a4a', 2);
    if (!c.near || genOf(B)) return; // (in the float-glass works nobody blows glass at the door)
    const h = -Math.PI / 2, ph = (c.t * .12) % 1, an = ph < .35 ? 1.45 : 1.1 + Math.sin(c.t * .9) * .08, [hd] = wkMan(B, 0, c.X + .2, c.Z + .2, c.y, h, [an, an * .97]);
    if (!hd) return; const f = wkF(h), tip = wkAdd(hd, wkV(f, an + .1), .2); gBeam(hd, tip, .0028, '#5a5f66');
    const g = ph < .35 ? '#ffb45e' : ph < .7 ? '#ff8a4a' : '#bfe6ee', s = .012 + Math.min(1, ph * 1.5) * .012; glOBox(tip, [s, 0, 0], [0, 0, s], [0, s, 0], g, ph < .7 ? 2 : 0);
  },
  workshop(B, c) { // the smith at the anvil: a hammer and sparks
    if (!c.near) return;
    const X = c.X + .3, Z = c.Z + .34, h = -Math.PI / 2, ph = (c.t * 1.6) % 1, an = wkLift(ph, 1.15, 2.3, .6), top = c.y + 3.2 * ZS;
    const g = genOf(B); // (refitted, the smith is a fitter at a bench: welding, not hammering)
    if (g) { gBox([X, c.y, Z], [.06, 0, 0], [0, 0, .035], 3 * ZS, '#5a5f66'); const on = (c.t * .7) % 1 < .6; if (on) gBox([X, c.y + 3 * ZS, Z], [.01, 0, 0], [0, 0, .01], .01, '#dff4ff', 0, 2);
      wkMan(B, 0, X, Z + .11, c.y, h, [1.25, 1.1]); if (on && (c.t * 9) % 1 < .5) wkBits([X, c.y + 3 * ZS + .01, Z], .05, 4, '#cfe8ff', true, B.id * 23 + Math.floor(c.t * 9)); return; }
    gBox([X, c.y, Z], [.03, 0, 0], [0, 0, .03], 2.2 * ZS, '#6b5040', M_PLANK); gBox([X, c.y + 2.2 * ZS, Z], [.045, 0, 0], [0, 0, .022], 1 * ZS, '#3a3d42');
    gBox([X, top, Z], [.025, 0, 0], [0, 0, .006], .006, '#ff7a3a', 0, 2); // the hot iron
    const [hd] = wkMan(B, 0, X, Z + .11, c.y, h, [an, .9]); wkTool(hd, h, an - .55, .07, 'hammer');
    if (ph < .2) wkBits([X, top + .01, Z], ph / 1.6, 5, '#ffd27a', true, B.id * 23 + Math.floor(c.t * 1.6));
  },
  works(B, c) { wkFlywheel(B, c, .1, .36, .11, .15, '#5a5f66'); },
  power(B, c) { wkFlywheel(B, c, .08, .33, .1, .14, '#4a6a8a'); },
  shipyard(B, c) { // the gantry's hoist runs to and fro with a plate; someone hammers (later welds) the hull
    const d = B.dir || [1, 0], P = (a, b, z) => [c.X + d[0] * a + d[1] * b, c.y + z * ZS, c.Z + d[1] * a + d[0] * b], hb = .22 * Math.sin(c.t * .22), hz = 9 + 4 * Math.sin(c.t * .5);
    gBox(P(.15, hb, 18.6), [.025, 0, 0], [0, 0, .025], .025, '#3a3d42'); gBeam(P(.15, hb, 18.6), P(.15, hb, hz + 1), .0025, '#2a2a2a');
    gBox(P(.15, hb, hz), V3s([d[0], 0, d[1]], .06), V3s([d[1], 0, d[0]], .005), .045, shipKind() === 'sail' || shipKind() === 'steamer' ? '#9b7657' : '#7d8793');
    if (!c.near) return;
    const at = P(.05, .23, 2), h = Math.atan2(-d[0], -d[1]), ph = (c.t * 1.4) % 1, an = wkLift(ph, 1.4, 2.2, .6), weld = hasTech('electric');
    const [hd] = wkMan(B, 0, at[0], at[2], c.y + 1.5 * ZS, h, weld ? [1.5, .6] : [an, .7]);
    if (weld) { if (hd) { const f = wkF(h), tip = wkAdd(hd, wkV(f, 1.3), .05); gBeam(hd, tip, .003, '#4a4f56'); if (Math.sin(c.t * 23) > .2) glOBox(tip, [.007, 0, 0], [0, 0, .007], [0, .007, 0], '#cfeaff', 2); } }
    else { const tip = wkTool(hd, h, an - .6, .07, 'hammer'); if (ph < .15) wkBits(tip, ph / 1.4, 3, '#d9b88a', false, B.id * 7 + Math.floor(c.t * 1.4)); }
  },
  farm(B, c) { // a hand with a hoe along the rows in spring and summer; harvesting in autumn; a tractor once there are motors
    if (!c.near || c.sea.winter > .45 || hash2(B.id | 0, 1, 77) > .55) return;
    const st = S.styles[B.style] || STYLES0[0]; if (st.fields || st.shape === 'round' || st.shape === 'organic') return;
    const au = (B.var || 0) < .5, row = (hash2(B.id | 0, 2, 77) * 4) | 0, o = -.27 + row * .18, per = hasTech('motor') ? 16 : 70, q = (c.t / per) % 2, s = -.38 + .76 * (q < 1 ? q : 2 - q), dir = q < 1 ? 1 : -1;
    const X = c.X + (au ? s : o), Z = c.Z + (au ? o : s), h = au ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2), y = c.y + .3 * ZS;
    if (hasTech('motor')) { // a little tractor: a bonnet, a cab, big wheels at the back
      const f = wkF(h), r = [-f[2], 0, f[0]], at = (a, b, z) => [X + f[0] * a + r[0] * b, y + z, Z + f[2] * a + r[2] * b], col = hasTech('computing') ? '#4e8a3a' : '#c0392b'; GLB.mat = 0;
      glOBox(at(.02, 0, .035), V3(f, .045), V3(r, .022), [0, .018, 0], col); glOBox(at(-.03, 0, .075), V3(f, .02), V3(r, .022), [0, .022, 0], '#bcd3e0');
      for (const sg of [1, -1]) { glOBox(at(-.035, sg * .03, .032), V3(f, .032), V3(r, .008), [0, .032, 0], '#2a2c30'); glOBox(at(.05, sg * .026, .016), V3(f, .016), V3(r, .006), [0, .016, 0], '#2a2c30'); }
      gBeam(at(.04, -.01, .05), at(.04, -.01, .09), .004, '#3a3a3a'); return;
    }
    const harvest = c.sea.autumn > .4, ph = (c.t * (harvest ? .7 : .9)) % 1, an = harvest ? .7 + Math.sin(ph * TAU) * .5 : wkLift(ph, .55, 1.6, .6), wk = s * 30;
    const [hd] = wkMan(B, 0, X, Z, y, h, [an, an * .9], ph < .25 ? wk : null); wkTool(hd, h + (harvest ? Math.sin(ph * TAU) * .6 : 0), an - .5, .1, 'hoe');
    if (harvest) for (let k = 0; k < 3; k++) { const ss = -.3 + k * .3; if ((dir > 0 ? ss < s - .08 : ss > s + .08)) gCone(au ? ss : o, au ? o : ss, .03, .3, 3.2, '#d8b86a', 6); } // stooks left behind
  },
  pasture(B, c) { // the shepherd leans on a crook while the dog works the flock
    if (!c.near) return;
    const h = Math.atan2(-.5, .7), y = c.y + .15 * ZS, [hd] = wkMan(B, 0, c.X - .3, c.Z + .3, y, h, [.55, .15]);
    if (hd) { const top = [hd[0], hd[1] + .05, hd[2]]; gBeam([hd[0], y, hd[2]], top, .003, '#6b5040'); gBeam(top, [top[0] + .02, top[1] + .01, top[2]], .003, '#6b5040'); }
    const a = c.t * .8 + .6 * Math.sin(c.t * .3), R = .26, dx = Math.cos(a) * R, dz = Math.sin(a) * R * .8, f = wkF(Math.atan2(Math.cos(a) * .8, -Math.sin(a))), r = [-f[2], 0, f[0]];
    glDog([c.X + .06 + dx, y, c.Z + .04 + dz], f, r, y, c.t * 14, true, '#3a3430');
  },
  warehouse(B, c) { // crates come in: carried by hand, later on a forklift
    if (!c.near) return;
    const ph = (c.t * .11) % 1, A = [c.X + .3, c.Z + .32], D = [c.X + .08, c.Z + .3], k = ph < .45 ? ph / .45 : ph < .55 ? 1 : ph < .95 ? 1 - (ph - .55) / .4 : 0, X = A[0] + (D[0] - A[0]) * k, Z = A[1] + (D[1] - A[1]) * k;
    const out = ph < .55, h = Math.atan2(D[1] - A[1], D[0] - A[0]) + (out ? 0 : Math.PI), loaded = ph < .45 || ph > .95, f = wkF(h), y = c.y;
    if (hasTech('motor')) { const at = (a, z) => [X + f[0] * a, y + z, Z + f[2] * a]; GLB.mat = 0;
      glOBox(at(-.01, .03), V3(f, .035), [-f[2] * .025, 0, f[0] * .025], [0, .022, 0], '#e0a43a'); gBeam(at(.03, 0), at(.03, .11), .005, '#3a3a3a');
      if (loaded) gBox(at(.06, .03), V3(f, .028), [-f[2] * .028, 0, f[0] * .028], .05, '#b58d62', M_PLANK); return; }
    const [hd, h2] = wkMan(B, 0, X, Z, y, h, loaded ? [1.35, 1.35] : null, ph * 60);
    if (loaded && hd && h2) gBox([(hd[0] + h2[0]) / 2 + f[0] * .02, hd[1] - .02, (hd[2] + h2[2]) / 2 + f[2] * .02], [.03, 0, 0], [0, 0, .03], .05, '#b58d62', M_PLANK);
  }
};
function glWorks() { // called from glPeople every frame
  const eye = GL3.eye, cam = GL3.cam; if (!eye || !S || !S.B) return;
  if (!GL3.wk || GL3.wkS !== S || GL3.t - GL3.wkT > 2) { GL3.wk = Object.values(S.B).filter(B => GLW[B.type]); GL3.wkT = GL3.t; GL3.wkS = S; }
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, day = !!sun.fixed || (sun.hr >= 6.5 && sun.hr < 20), w = S.wx || {}, wind = 1 + (w.storm || 0) * 1.5 + (w.rain || 0) * .5, sea = LIGHT.season || seasonNow();
  const L = [];
  for (const B of GL3.wk) { if (B.prog < 1 || S.B[B.id] !== B) continue; const [X, Z] = glLot(B), y = surfZ(idx(B.x, B.y)) * ZS, d = Math.hypot(X - eye[0], y - eye[1], Z - eye[2]);
    if (d < (B.type === 'harbor' || B.type === 'turbine' || B.type === 'mill' || B.type === 'windpark' || B.type === 'oilrig' ? WKR * 1.6 : WKR)) L.push([Math.hypot(X - cam.tx, Z - cam.tz), B, X, Z, y, d]); }
  L.sort((a, b) => a[0] - b[0]); if (L.length > 80) L.length = 80; // (what the camera looks at gets its people first)
  GL3.wkN = 0; const sv = [GLB.x, GLB.y, GLB.base];
  try {
    for (const [, B, X, Z, y, d] of L) {
      GLB.id = idx(B.x, B.y) + 1; GLB.ao = 1; GLB.mat = 0; GLB.wall = 0; GLB.x = B.x; GLB.y = B.y; GLB.base = y; // (pointing at a moving part shows the building)
      const near = day && d < WKP && GL3.wkN < WKN; // (a slot is only used when someone is drawn: wkMan counts them)
      GLW[B.type](B, { X, Z, y, t: GL3.t + (B.id % 97) * 1.37, near, day, wind, sea, d });
    }
  } finally { GLB.id = 0; [GLB.x, GLB.y, GLB.base] = sv; }
}
// the film camera now and then drops in on a workplace (by day)
const WK_CAP = { lumber: '🪓 The woodcutters', quarry: '⛏️ The quarry', mine: '⛏️ The mine', mill: '🌾 The windmill', turbine: '🌬️ The wind turbines', claypit: '🧱 The clay pit', sandpit: '⛏️ The sand pit', weaver: '🧶 The weaving house', glassworks: '🔥 The glassworks', workshop: '🔨 The smithy', works: '⚙️ The works', power: '⚡ The power house', shipyard: '⚓ The shipyard', farm: '🌾 In the fields', pasture: '🐑 The shepherd', warehouse: '📦 The warehouse' };
function glWorkShot() {
  const sun = LIGHT.sun; if (sun && !sun.fixed && (sun.hr < 7.5 || sun.hr >= 19)) return null;
  const Bs = Object.values(S.B).filter(B => B.prog >= 1 && WK_CAP[B.type] && B.type !== 'farm'); if (!Bs.length) return null;
  const B = Bs[(Math.random() * Bs.length) | 0], T = S.T[B.sid], [x, z] = glLot(B), tall = B.type === 'turbine' || B.type === 'mine' || B.type === 'mill';
  return { at: () => [x, surfZ(idx(B.x, B.y)) * ZS + (tall ? .4 : .1), z], zoom: tall ? rf(2.6, 3.4) : rf(1.5, 2.1), pitch: rf(.3, .45), cap: WK_CAP[B.type] + (T ? ' of ' + T.name : '') };
}
