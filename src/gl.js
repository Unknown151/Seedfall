/* ============================== the world in real 3D (WebGL2): the default view; ?2d or the switch gives the flat one ============================== */
// Opened with ?gl, the world is drawn as real 3D geometry instead of the 2D isometric canvas. The sim, UI and saves
// are untouched. The building art is reused as it is: while a chunk is being built (GLB set), the drawing
// primitives in render.js (box, cyl, cone, dome, roofs, windows, doors, flat) emit triangles instead of painting,
// and the purely 2D strokes (lines, circles, polygons) are skipped. Terrain, water, roads, trees, lamps and people
// are built here. Lighting is per pixel, every frame: the sun (or moon) with a shadow map, sky and ground ambient,
// lit windows at night, and street lamps as real point lights.
const GL3 = { on: false, c: null, gl: null, chunks: [], dirty: new Set(), cam: { yaw: Math.PI / 4, pitch: .62, zoom: 14, tx: 32, ty: 0, tz: 32, auto: true, persp: true }, lamps: [], hr: [null, 13, 18.6, 20.4, 23.5], hi: 0, drag: null, town: 0, t: 0 };
const GPID = 1 << 20, GCH = 8, GNC = W / GCH, ZS = 1 / 22; // chunk size in tiles; pixels of height to tile units
let GLB = null; // the chunk being built: { v: floats, x, y, base (tile), tops: [[sx, sy, z]] }
const GSTUB = new Proxy({}, { get: (t, k) => k in t ? t[k] : () => GRAD0, set: (t, k, v) => { t[k] = v; return true; } }), GRAD0 = { addColorStop() { } };

/* ---------- colours ---------- */
const GCOL = new Map();
function gcol(s) {
  if (Array.isArray(s)) return s;
  let o = GCOL.get(s); if (o) return o;
  if (typeof s !== 'string') o = [.8, .8, .8];
  else if (s[0] === '#') { const n = parseInt(s.length === 4 ? s[1] + s[1] + s[2] + s[2] + s[3] + s[3] : s.slice(1, 7), 16); o = [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  else { const m = s.match(/[\d.]+/g) || [200, 200, 200]; o = [m[0] / 255, m[1] / 255, m[2] / 255]; }
  if (GCOL.size > 5000) GCOL.clear();
  GCOL.set(s, o); return o;
}

/* ---------- geometry: vertex = position, normal, colour, emissive (10 floats) ---------- */
function gv(p, n, c, e) { GLB.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], e, GLB.id || 0, e ? 0 : GLB.mat || 0, GLB.ao || 1); } // and how much sky it sees (ambient occlusion, baked later) // then what the pixel belongs to (picking) and what it's made of (texture) // the last float is what the pixel belongs to (for picking)
function gtri(a, b, c, col, e = 0) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
  const o = GLB.ctr; if (o && nx * (a[0] + b[0] + c[0] - 3 * o[0]) + ny * (a[1] + b[1] + c[1] - 3 * o[1]) + nz * (a[2] + b[2] + c[2] - 3 * o[2]) < 0) { nx = -nx; ny = -ny; nz = -nz; } // face away from the middle of the thing
  const n = [nx, ny, nz]; gv(a, n, col, e); gv(b, n, col, e); gv(c, n, col, e);
}
function gquad(a, b, c, d, col, e = 0) { gtri(a, b, c, col, e); gtri(a, c, d, col, e); }
// tile-local (u, v, z in pixels) to world; the screen offset of cx/cy (some art nudges it) moves along the ground
function gw(u, v, z, cx = 0, cy = 0) { const su = cx / 16, sv = cy / 8; return [GLB.x + u + (su + sv) / 2, GLB.base + z * ZS, GLB.y + v + (sv - su) / 2]; }
// a screen point (relative to the tile centre) back to u, v, assuming it's on the ground
function gunscreen(X, Y) { const a = X / 16, b = Y / 8; return [(a + b) / 2, (b - a) / 2]; }
/* ---------- close-up detail (the near version of a chunk only: GLB.lod) ---------- */
const rgbS1 = c => 'rgb(' + Math.round(c[0] * 255) + ',' + Math.round(c[1] * 255) + ',' + Math.round(c[2] * 255) + ')', tintS = (c, k, t = [1, 1, 1]) => rgbS1([c[0] + (t[0] - c[0]) * k, c[1] + (t[1] - c[1]) * k, c[2] + (t[2] - c[2]) * k]);
const SHUT = ['#3f6b4f', '#3f5f8a', '#8a3f37', '#6b5a4a', '#2f4f5f'];
function glFace(c, a, u, n, col) { const C = gcol(col), P = (i, j) => [c[0] + a[0] * i + u[0] * j, c[1] + a[1] * i + u[1] * j, c[2] + a[2] * i + u[2] * j], V = GLB.v, id = GLB.id || 0, m = GLB.mat || 0; for (const q of [P(-1, -1), P(1, -1), P(1, 1), P(-1, -1), P(1, 1), P(-1, 1)]) V.push(q[0], q[1], q[2], n[0], n[1], n[2], C[0], C[1], C[2], 0, id, m, 1); } // one flat face (cheap)
function glWinDetail(Wc, a, n, ww, wh, wall, seed, floor = 0) { // around one window: a sill, a lintel, glazing bars and (on older houses) shutters
  const old = !hasTech('concrete'), sc = tintS(wall, .55), m = GLB.mat; GLB.mat = M_STONE;
  const at = (s, t, y) => [Wc[0] + a[0] * s + n[0] * t, Wc[1] + y, Wc[2] + a[2] * s + n[2] * t];
  glOBox(at(0, .012, -wh / 2 - .012), V3s(a, ww / 2 + .014), V3s(n, .013), [0, .01, 0], sc); // sill
  glOBox(at(0, .006, wh / 2 + .01), V3s(a, ww / 2 + .008), V3s(n, .007), [0, .008, 0], sc); // lintel
  GLB.mat = 0;
  if (old) { const fc = tintS(wall, .8); glFace(at(0, .007, 0), V3s(a, .0028), [0, wh / 2, 0], n, fc); glFace(at(0, .0072, wh * .1), V3s(a, ww / 2), [0, .0028, 0], n, fc); } // glazing bars
  if (old && hash2(seed | 0, 3, 41) < .45) { const sh = SHUT[(hash2(seed | 0, 5, 43) * SHUT.length) | 0]; GLB.mat = M_PLANK; for (const sg of [-1, 1]) glFace(at(sg * (ww / 2 + ww * .27), .007, 0), V3s(a, ww * .25), [0, wh / 2, 0], n, sh); } // shutters
  const HB = GLB.B; if (glOld() && floor <= 2 && HB && HB.type === 'house' && HB.tier >= 2 && HB.tier <= 4 && hash2(seed | 0, 11, 53) < .3) glWinBox(at, a, n, ww, wh, seed | 0);
  if (!old && floor >= 1 && hash2(seed | 0, 7, 47) < .3) { // a balcony on a modern block
    GLB.mat = M_STONE; glOBox(at(0, .04, -wh / 2 - .02), V3s(a, ww / 2 + .03), V3s(n, .04), [0, .008, 0], '#c9c6c0');
    GLB.mat = 0; glOBox(at(0, .076, -wh / 2 + .012), V3s(a, ww / 2 + .03), V3s(n, .002), [0, .02, 0], hash2(seed | 0, 9, 3) < .5 ? '#b8bcc2' : 'rgb(185,215,228)'); // its railing, standing on it
  }
  GLB.mat = m;
}
function glBox(cx, cy, u0, v0, hw, hd, z0, h, col, top) {
  if (dsRound()) { const [X, Y] = pt(cx, cy, u0, v0, 0); return glCyl(X, Y, Math.max(hw, hd) * 1.08, z0, h, col, top); }
  const c = gcol(col), ct = top ? gcol(top) : c, P = (u, v, z) => gw(u0 + u, v0 + v, z, cx, cy), z1 = z0 + h; GLB.ctr = P(0, 0, z0 + h / 2);
  if (GLB.wall && h >= 6) GLB.wallC = c; // (the trim of its windows and doors is tinted from it)
  GLB.mat = GLB.wall && z1 > 6 ? M_TAR : 0; gquad(P(-hw, -hd, z1), P(-hw, hd, z1), P(hw, hd, z1), P(hw, -hd, z1), ct); GLB.mat = GLB.wall || 0;
  gquad(P(-hw, hd, z0), P(hw, hd, z0), P(hw, hd, z1), P(-hw, hd, z1), c);
  gquad(P(hw, hd, z0), P(hw, -hd, z0), P(hw, -hd, z1), P(hw, hd, z1), c);
  gquad(P(hw, -hd, z0), P(-hw, -hd, z0), P(-hw, -hd, z1), P(hw, -hd, z1), c);
  gquad(P(-hw, -hd, z0), P(-hw, hd, z0), P(-hw, hd, z1), P(-hw, -hd, z1), c);
  const [sx, sy] = pt(cx, cy, u0, v0, 0); GLB.tops.push([sx, sy, z1]);
  if (GLB.lod && GLB.wall === M_GLASS && h >= 16 && hw >= .1 && hd >= .1) { // curtain wall: mullions up the glass and a band at every floor
    const m = GLB.mat, C = P(0, 0, z0), fc = tintS(c, .55, [.85, .87, .9]), Hh = h * ZS / 2, cy = C[1] + Hh; GLB.mat = 0;
    for (const [n, a, half, off] of [[[0, 0, 1], [1, 0, 0], hw, hd], [[0, 0, -1], [1, 0, 0], hw, hd], [[1, 0, 0], [0, 0, 1], hd, hw], [[-1, 0, 0], [0, 0, 1], hd, hw]]) {
      const base = [C[0] + n[0] * (off + .004), 0, C[2] + n[2] * (off + .004)], k = Math.max(2, Math.round(half * 2 / .09));
      for (let i = 0; i <= k; i++) { const t = -half + i / k * half * 2; glFace([base[0] + a[0] * t, cy, base[2] + a[2] * t], V3s(a, .005), [0, Hh, 0], n, fc); }
      for (let z = z0 + 7; z < z0 + h - 1; z += 7) glFace([base[0], C[1] + (z - z0) * ZS, base[2]], V3s(a, half), [0, .006, 0], n, fc);
    }
    GLB.mat = m;
  }
  if (GLB.lod && GLB.wall && GLB.wall !== M_GLASS && GLB.wall !== M_CROP && h >= 6 && hw >= .09 && hd >= .09 && z0 < 1) { // a stone plinth and a cornice on a proper wall
    const m = GLB.mat, C = P(0, 0, 0); GLB.mat = M_STONE;
    glOBox([C[0], C[1] + .6 * ZS, C[2]], [hw + .012, 0, 0], [0, 0, hd + .012], [0, .6 * ZS, 0], tintS(c, .45, [.25, .22, .2]));
    glOBox([C[0], C[1] + (z1 - .45) * ZS, C[2]], [hw + .016, 0, 0], [0, 0, hd + .016], [0, .45 * ZS, 0], tintS(c, .5));
    if (GLB.B && GLB.wall !== M_STONE && GL_PROPER(GLB.wall) && h >= 9 && glOld() && hash2(GLB.x, GLB.y, 915) < .65) glQuoins(C, hw, hd, z0, z1, c);
    GLB.mat = m;
  }
}
function glFlat(cx, cy, u0, v0, hw, hd, z, col) {
  GLB.mat = GLB.flat === 'farm' ? (col === '#bd8f68' ? M_SOIL : M_CROP) : GLB.flat === 'green' ? M_GRASS : GLB.flat === 'paved' ? M_STONE : 0;
  if (GLB.mat === M_CROP && hd < .1 || GLB.mat === M_CROP && hw < .1) { const sv = GLB.wall; GLB.wall = M_CROP; glBox(cx, cy, u0, v0, hw < .1 ? hw * .75 : hw, hd < .1 ? hd * .75 : hd, 0, z + .9, col); GLB.wall = sv; return; } // a crop row stands up
  const c = gcol(col), P = (u, v) => gw(u0 + u, v0 + v, z + .25, cx, cy); GLB.ctr = gw(u0, v0, z - 20, cx, cy);
  gquad(P(-hw, -hd), P(-hw, hd), P(hw, hd), P(hw, -hd), c);
}
function glCylAt(u, v, r, z0, h, col, top, n = 12) {
  const c = gcol(col), ct = top ? gcol(top) : c, P = (a, z) => gw(u + Math.cos(a) * r, v + Math.sin(a) * r, z), C = gw(u, v, z0 + h); GLB.ctr = gw(u, v, z0 + h / 2);
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; GLB.mat = GLB.wall || 0; gquad(P(a, z0), P(b, z0), P(b, z0 + h), P(a, z0 + h), c); GLB.mat = 0; gtri(C, P(b, z0 + h), P(a, z0 + h), ct); }
  if (GLB.lod && GLB.wall && h > 8 && r > .07) { GLB.lod = false; const bc = tintS(c, .4); glCylAt(u, v, r * 1.05, z0 + h - 1.1, 1.1, bc, bc, n); GLB.lod = true; } // a band round the top of a tower
}
function glCyl(X, Y, r, z0, h, col, top) { const [u, v] = gunscreen(X, Y); glCylAt(u, v, r, z0, h, col, top); GLB.tops.push([X, Y, z0 + h]); }
function glCone(X, Y, r, h, col) {
  let zb = 0; // a cone is often drawn lifted onto whatever it tops: find that
  for (const [sx, sy, z] of GLB.tops) if (Math.abs(sx - X) < .7 && Math.abs(sy - z - Y) < 1.6) { zb = z; Y = sy; break; }
  const [u, v] = gunscreen(X, Y), c = gcol(col), n = 12, A = gw(u, v, zb + h); GLB.ctr = gw(u, v, zb - 1); GLB.mat = roofMat(c);
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gtri(gw(u + Math.cos(a) * r, v + Math.sin(a) * r, zb), gw(u + Math.cos(b) * r, v + Math.sin(b) * r, zb), A, c); }
}
function glDome(X, Y, r, z0, h, col) { const [u, v] = gunscreen(X, Y); glDomeAt(u, v, r, z0, h, col); }
function glDomeAt(u, v, r, z0, h, col, e = 0, mat = 0) {
  GLB.ctr = gw(u, v, z0); GLB.mat = mat; const c = gcol(col), n = 12, m = 4, P = (a, t) => gw(u + Math.cos(a) * r * Math.cos(t), v + Math.sin(a) * r * Math.cos(t), z0 + h * Math.sin(t));
  for (let j = 0; j < m; j++) { const t0 = j / m * Math.PI / 2, t1 = (j + 1) / m * Math.PI / 2; for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gquad(P(a, t0), P(b, t0), P(b, t1), P(a, t1), c, e); } }
}
function glBall(u, v, r, zc, rz, col, e = 0, mat = 0) { glDomeAt(u, v, r, zc, rz, col, e, mat); glDomeAt(u, v, r, zc, -rz, col, e, mat); }
function glGable(cx, cy, u0, v0, hw, hd, z, rh, col, wall, alongU) {
  // the eaves hang out past the walls and drop a little, so the roof meets the top of the wall with no gap
  const c = gcol(col), cw = gcol(wall), o = .05, g = .02, P = (u, v, zz) => gw(u0 + u, v0 + v, zz, cx, cy); GLB.ctr = P(0, 0, z - 1);
  const rm = roofMat(c), wm = GLB.wall || 0, sq = gquad, tr = gtri, gq = (...a) => { GLB.mat = rm; sq(...a); }, gt = (...a) => { GLB.mat = wm; tr(...a); };
  if (GLB.lod && hw > .06 && hd > .06) { // a ridge cap and gutters along the eaves
    const cap = tintS(c, .3, [.18, .17, .17]), L = alongU ? [[-hw - g, 0], [hw + g, 0]] : [[0, -hd - g], [0, hd + g]], ze = alongU ? z - rh * o / hd : z - rh * o / hw;
    gBeam(P(L[0][0], L[0][1], z + rh + .35), P(L[1][0], L[1][1], z + rh + .35), .013, cap, rm);
    for (const sg of [-1, 1]) { const E = alongU ? [[-hw - g, sg * (hd + o)], [hw + g, sg * (hd + o)]] : [[sg * (hw + o), -hd - g], [sg * (hw + o), hd + g]]; gBeam(P(E[0][0], E[0][1], ze - .35), P(E[1][0], E[1][1], ze - .35), .008, '#4a4d52'); }
    GLB.ctr = P(0, 0, z - 1);
  }
  if (alongU) {
    const ze = z - rh * o / hd;
    gq(P(-hw - g, -hd - o, ze), P(-hw - g, 0, z + rh), P(hw + g, 0, z + rh), P(hw + g, -hd - o, ze), c);
    gq(P(hw + g, hd + o, ze), P(hw + g, 0, z + rh), P(-hw - g, 0, z + rh), P(-hw - g, hd + o, ze), c);
    gt(P(hw, -hd, z), P(hw, 0, z + rh), P(hw, hd, z), cw); gt(P(-hw, hd, z), P(-hw, 0, z + rh), P(-hw, -hd, z), cw);
  } else {
    const ze = z - rh * o / hw;
    gq(P(-hw - o, hd + g, ze), P(0, hd + g, z + rh), P(0, -hd - g, z + rh), P(-hw - o, -hd - g, ze), c);
    gq(P(hw + o, -hd - g, ze), P(0, -hd - g, z + rh), P(0, hd + g, z + rh), P(hw + o, hd + g, ze), c);
    gt(P(-hw, hd, z), P(hw, hd, z), P(0, hd, z + rh), cw); gt(P(hw, -hd, z), P(-hw, -hd, z), P(0, -hd, z + rh), cw);
  }
  if (GLB.B && z >= 6 && GLB.wall !== M_GLASS) glGableDress(P, hw, hd, z, rh, c, cw, alongU, rm);
}
function roofMat(c) { return c[0] > .6 && c[1] > .5 && c[2] < .5 && c[0] - c[2] > .25 && c[1] - c[2] > .15 ? M_THATCH : c[0] > c[2] + .1 && c[0] > c[1] ? M_ROOF : M_SLATE; } // straw-coloured roofs are thatched, red and brown ones tiled, grey and blue ones slated
function glPyr(cx, cy, u0, v0, hw, hd, z, rh, col) {
  const c = gcol(col), o = .04, P = (u, v, zz) => gw(u0 + u, v0 + v, zz, cx, cy), T = P(0, 0, z + rh); GLB.ctr = P(0, 0, z - 1); GLB.mat = roofMat(c);
  const ze = z - rh * o / Math.max(.05, Math.min(hw, hd)), A = P(-hw - o, -hd - o, ze), B = P(hw + o, -hd - o, ze), C = P(hw + o, hd + o, ze), D = P(-hw - o, hd + o, ze); // eaves drop to meet the walls
  gtri(B, A, T, c); gtri(A, D, T, c); gtri(D, C, T, c); gtri(C, B, T, c);
  if (GLB.lod && rh > 4) { GLB.mat = 0; glOBox([T[0], T[1] + .012, T[2]], [.011, 0, 0], [0, 0, .011], [0, .03, 0], '#8c8f94'); } // a finial
  if (GLB.B && GLB.wall !== M_GLASS && rh >= 5 && hw >= .15 && hd >= .15 && z >= 6 && hash2(GLB.x, GLB.y, 917) < .7) { const [col, mat] = glStackCol(), Q = P(hw * .4, -hd * .35, z - 1); glChimney(Q[0], Q[1], Q[2], .035, .035, gw(0, 0, z + rh * .7 + 3.6)[1], col, mat); }
}
// windows on all four walls (the camera can go round now); em in (0, 1) = a window, lit when em < the night's lit fraction
function glWindows(cx, cy, u0, v0, hw, hd, z0, h, floors, cols, col) {
  const c = gcol(col), fh = h / floors, e = .006;
  if (GLB.lod && GLB.B && GL_PROPER(GLB.wall) && floors >= 3 && z0 < 1 && hw >= .15 && hd >= .15 && glOld()) glFacade(gw(u0, v0, 0, cx, cy), hw, hd, z0, h, floors, cols, GLB.wallC || [.8, .75, .68]);
  GLB.ctr = gw(u0, v0, z0 + h / 2, cx, cy);
  for (let f = 0; f < floors; f++) {
    const zb = z0 + f * fh + fh * .32, wh = fh * .42;
    for (let k = 0; k < cols; k++) {
      const t = (k + .5) / cols, wu = hw * 2 / cols * .42, wv = hd * 2 / cols * .42, u = -hw + t * hw * 2, v = -hd + t * hd * 2;
      const em = (i) => .03 + .94 * hash2((GLB.x * 7 + k * 13 + i) | 0, (GLB.y * 5 + f * 31 + (zb | 0)) | 0, 71);
      const P = (uu, vv, zz) => gw(u0 + uu, v0 + vv, zz, cx, cy);
      gquad(P(u - wu / 2, hd + e, zb), P(u + wu / 2, hd + e, zb), P(u + wu / 2, hd + e, zb + wh), P(u - wu / 2, hd + e, zb + wh), c, em(1));
      gquad(P(u + wu / 2, -hd - e, zb), P(u - wu / 2, -hd - e, zb), P(u - wu / 2, -hd - e, zb + wh), P(u + wu / 2, -hd - e, zb + wh), c, em(2));
      gquad(P(hw + e, v + wv / 2, zb), P(hw + e, v - wv / 2, zb), P(hw + e, v - wv / 2, zb + wh), P(hw + e, v + wv / 2, zb + wh), c, em(3));
      gquad(P(-hw - e, v - wv / 2, zb), P(-hw - e, v + wv / 2, zb), P(-hw - e, v + wv / 2, zb + wh), P(-hw - e, v - wv / 2, zb + wh), c, em(4));
      if (GLB.lod && GLB.wall !== M_GLASS && wh >= 2) { const wall = GLB.wallC || [.8, .75, .68], my = (zb + wh / 2) * ZS, WH = wh * ZS, sd = GLB.x * 31 + GLB.y * 17 + f * 7 + k;
        glWinDetail(V3a(P(u, hd + e, 0), [0, my, 0]), [1, 0, 0], [0, 0, 1], wu, WH, wall, sd, f); glWinDetail(V3a(P(u, -hd - e, 0), [0, my, 0]), [1, 0, 0], [0, 0, -1], wu, WH, wall, sd + 1, f);
        glWinDetail(V3a(P(hw + e, v, 0), [0, my, 0]), [0, 0, 1], [1, 0, 0], wv, WH, wall, sd + 2, f); glWinDetail(V3a(P(-hw - e, v, 0), [0, my, 0]), [0, 0, 1], [-1, 0, 0], wv, WH, wall, sd + 3, f); }
    }
  }
}
function glCylWindows(cx, cy, u0, v0, r, z0, h, floors, n, col) {
  const c = gcol(col), fh = h / floors, rr = r + .01; GLB.ctr = gw(u0, v0, z0 + h / 2, cx, cy);
  for (let f = 0; f < floors; f++) { const zb = z0 + f * fh + fh * .32, wh = fh * .42; for (let k = 0; k < n * 2; k++) { const a = k / (n * 2) * TAU, b = a + TAU / (n * 2) * .45; gquad(gw(u0 + Math.cos(a) * rr, v0 + Math.sin(a) * rr, zb, cx, cy), gw(u0 + Math.cos(b) * rr, v0 + Math.sin(b) * rr, zb, cx, cy), gw(u0 + Math.cos(b) * rr, v0 + Math.sin(b) * rr, zb + wh, cx, cy), gw(u0 + Math.cos(a) * rr, v0 + Math.sin(a) * rr, zb + wh, cx, cy), c, .03 + .94 * hash2(GLB.x * 3 + k, GLB.y * 7 + f, 71)); } }
}
function glDoor(cx, cy, u0, v0, hd, w, h, col) {
  const P = (u, zz) => gw(u0 + u, v0 + hd + .007, zz, cx, cy); GLB.ctr = gw(u0, v0, h / 2, cx, cy);
  gquad(P(-w / 2, 0), P(w / 2, 0), P(w / 2, h), P(-w / 2, h), gcol(col), .5);
  if (GLB.lod) { // a frame, a step and a little hood over it
    const m = GLB.mat, C = P(0, 0), wall = GLB.wallC || [.8, .75, .68]; GLB.mat = M_STONE;
    glOBox([C[0], C[1] + .25 * ZS, C[2] + .03], [w / 2 + .02, 0, 0], [0, 0, .03], [0, .25 * ZS, 0], '#b9b2a6');
    glOBox([C[0], C[1] + (h + .3) * ZS, C[2] + .02], [w / 2 + .025, 0, 0], [0, 0, .022], [0, .3 * ZS, 0], tintS(wall, .5));
    GLB.mat = 0; for (const sg of [-1, 1]) glOBox([C[0] + sg * (w / 2 + .006), C[1] + h / 2 * ZS, C[2] + .003], [.006, 0, 0], [0, 0, .004], [0, h / 2 * ZS, 0], tintS(wall, .6));
    GLB.mat = m;
  }
}

/* ---------- the Anno look: chimneys with pots and smoke, dormers, quoins, a stone ground floor, window boxes, awnings, mansards ---------- */
// (all hung off the shared primitives, so every building in the valley gets them; the small stuff only close up, behind GLB.lod)
const glOld = () => { const B = GLB.B; return !hasTech('computing') || !!B && B.type === 'house' && B.tier <= 4; }; // the dressed-stone, window-box, chimney-pot age (until the computers come)
const GL_PROPER = m => m === M_BRICK || m === M_PLASTER || m === M_STONE;
const FLOWER_C = ['#e05a8a', '#b46adc', '#ff86b0', '#e8503c', '#f2c14e', '#f3f0ea'];
function glChimney(X, Y, Z, w, d, top, col, mat) { // a stack from Y up to top (world units), a stone cap and clay pots; old ones smoke
  const m = GLB.mat; GLB.mat = mat; glOBox([X, (Y + top) / 2, Z], [w, 0, 0], [0, 0, d], [0, (top - Y) / 2, 0], col);
  GLB.mat = M_STONE; glOBox([X, top + .25 * ZS, Z], [w + .008, 0, 0], [0, 0, d + .008], [0, .25 * ZS, 0], '#c9c1b3');
  const n = Math.max(w, d) > .045 ? 2 : 1, p0 = top + .5 * ZS, along = d > w;
  if (GLB.lod) { GLB.mat = 0; for (let k = 0; k < n; k++) { const o = n > 1 ? (k ? .45 : -.45) * Math.max(w, d) : 0; glOBox([X + (along ? 0 : o), p0 + .6 * ZS, Z + (along ? o : 0)], [.011, 0, 0], [0, 0, .011], [0, .6 * ZS, 0], '#b5653f'); } }
  else if (GLB.smk && glOld() && hash2(GLB.x * 3 + ((X * 97) | 0), GLB.y, 911) < .65) GLB.smk.push([X, p0 + 1.2 * ZS, Z]);
  GLB.mat = m;
}
function glStackCol() { const pl = GLB.wall === M_PLASTER; return [pl ? (GLB.wallC || [.86, .82, .74]) : '#a0604a', pl ? M_PLASTER : M_BRICK]; }
// a gable roof dressed: chimneys at the ridge ends, dormers down both slopes on anything of two floors or more
function glGableDress(P, hw, hd, z, rh, rc, wc, alongU, rm) {
  const L = alongU ? hw : hd, D = alongU ? hd : hw, h0 = hash2(GLB.x, GLB.y, 905), ax = alongU ? [1, 0, 0] : [0, 0, 1], ac = alongU ? [0, 0, 1] : [1, 0, 0];
  const at = (s, t, zz) => alongU ? P(s, t, zz) : P(t, s, zz); // s along the ridge, t across it
  if (L >= .1 && h0 < (rm === M_THATCH ? .55 : .85)) {
    const small = z < 11, [col, mat] = glStackCol(), ends = h0 < .35 && !small ? [-1, 1] : [h0 < .6 ? -1 : 1]; // (a cottage has one short stack)
    for (const e of ends) { const Q = at(e * (L - .06), 0, z - 1); glChimney(Q[0], Q[1], Q[2], alongU ? .034 : small ? .04 : .05, alongU ? (small ? .04 : .05) : .034, Q[1] + (rh + (small ? 2.2 : 4.4)) * ZS, col, mat); }
  }
  if (GLB.lod && z >= 11 && rh >= 4.5 && L >= .17 && rm !== M_THATCH && hash2(GLB.x, GLB.y, 907) < .75) {
    const n = L >= .3 ? 2 : 1;
    for (const sg of [-1, 1]) for (let k = 0; k < n; k++) glDormer(at(n === 1 ? 0 : (k ? .5 : -.5) * L, sg * D * .7, z + rh * .3 - .3), V3s(ac, sg), ax, Math.min(3.4, rh * .7 - .5) * ZS, D * .7, rc, wc, (GLB.x * 13 + GLB.y * 7 + k * 3 + sg) | 0);
  }
}
function glDormer(F, out, side, h, depth, rc, wc, seed) { // F: the foot of its window wall on the roof; it runs back into the roof
  const m = GLB.mat, W = .05, c = [F[0] - out[0] * depth / 2, F[1] + h / 2, F[2] - out[2] * depth / 2];
  GLB.mat = GLB.wall || 0; const U = [0, h / 2, 0]; // its front and two cheeks (the top is under its roof, the back in the big roof)
  glFace(F.map((q, i) => q + U[i]), V3s(side, W), U, out, wc); for (const sg of [-1, 1]) glFace([c[0] + side[0] * W * sg, c[1], c[2] + side[2] * W * sg], V3s(out, depth / 2), U, V3s(side, sg), wc);
  GLB.mat = 0; GLB.ctr = c; const Wc = [F[0] + out[0] * .004, F[1] + h * .5, F[2] + out[2] * .004], a = V3s(side, .027), u = [0, h * .3, 0];
  gquad(V3a(V3a(Wc, V3s(a, -1)), V3s(u, -1)), V3a(V3a(Wc, a), V3s(u, -1)), V3a(V3a(Wc, a), u), V3a(V3a(Wc, V3s(a, -1)), u), [.23, .26, .31], .03 + .94 * hash2(seed, 5, 71));
  gRoof([c[0], 0, c[2]], V3s(out, depth / 2 + .012), V3s(side, W + .004), F[1] + h, 1.7 * ZS, rc, wc);
  GLB.mat = m;
}
// a mansard: steep lower slopes with dormers, a shallow top, iron cresting and a row of chimney stacks (the engineers' blocks)
function glMansard(cx, cy, u0, v0, hw, hd, z, rh, col) {
  const c = gcol(col), rm = roofMat(c), o = .03, P = (u, v, zz) => gw(u0 + u, v0 + v, zz, cx, cy), zb = z + rh * .72, iw = hw * .8, id = hd * .8; GLB.ctr = P(0, 0, z - 1);
  const E = [P(-hw - o, -hd - o, z - .4), P(hw + o, -hd - o, z - .4), P(hw + o, hd + o, z - .4), P(-hw - o, hd + o, z - .4)], I = [P(-iw, -id, zb), P(iw, -id, zb), P(iw, id, zb), P(-iw, id, zb)], T = P(0, 0, z + rh);
  GLB.mat = rm; for (let k = 0; k < 4; k++) { const j = (k + 1) % 4; gquad(E[k], E[j], I[j], I[k], c); gtri(I[k], I[j], T, gcol(tintS(c, .12, [.2, .2, .22]))); }
  const wc = GLB.wallC || [.86, .82, .74];
  if (GLB.lod) {
    for (const [nx, nz, L, D] of [[0, 1, hw, hd], [0, -1, hw, hd], [1, 0, hd, hw], [-1, 0, hd, hw]]) { // dormers on each face
      const n = Math.max(1, Math.min(4, Math.round(L * 2 / .2))), out = [nx, 0, nz], side = [nz ? 1 : 0, 0, nx ? 1 : 0];
      for (let k = 0; k < n; k++) { const s = -L + (k + .5) / n * L * 2, F = P(nx ? nx * D * .93 : s, nz ? nz * D * .93 : s, z + rh * .12); glDormer(F, out, side, rh * .42 * ZS, .09, col, wc, (GLB.x * 11 + GLB.y * 5 + k * 7 + nx * 3 + nz) | 0); }
    }
    GLB.mat = 0; for (let k = 0; k < 4; k++) gBeam(V3a(I[k], [0, .03, 0]), V3a(I[(k + 1) % 4], [0, .03, 0]), .005, '#3c3f45'); // cresting
    for (let k = 0; k < 4; k++) { const a = I[k], b = I[(k + 1) % 4], n = Math.round(Math.hypot(b[0] - a[0], b[2] - a[2]) / .07); for (let j = 0; j <= n; j++) { const t = j / Math.max(1, n); glOBox([a[0] + (b[0] - a[0]) * t, a[1] + .015, a[2] + (b[2] - a[2]) * t], [.003, 0, 0], [0, 0, .003], [0, .015, 0], '#3c3f45'); } }
  }
  const [sc, sm] = glStackCol(), ns = hw > .25 ? 3 : 2; // chimney stacks along the top
  for (let k = 0; k < ns; k++) { const Q = P(-iw * .7 + k / (ns - 1) * iw * 1.4, (k % 2 ? .3 : -.3) * id, z); glChimney(Q[0], Q[1], Q[2], .045, .03, gw(0, 0, z + rh + 3.2)[1], sc, sm); }
}
// dressed stone at the corners (quoins), on the old walls of brick and plaster
function glQuoins(C, hw, hd, z0, z1, wallC) {
  const m = GLB.mat, col = GLB.wall === M_BRICK ? '#d9d1c1' : tintS(wallC, .45, [.62, .6, .55]); GLB.mat = M_STONE;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (let z = z0 + .3, k = 0; z + 1.2 < z1 - .4; z += 2.4, k++) {
    const y = C[1] + (z + .55) * ZS, la = k % 2 ? .06 : .035, lb = k % 2 ? .035 : .06, U = [0, .55 * ZS, 0];
    glFace([C[0] + sx * (hw + .004), y, C[2] + sz * (hd - la / 2)], [0, 0, la / 2], U, [sx, 0, 0], col);
    glFace([C[0] + sx * (hw - lb / 2), y, C[2] + sz * (hd + .004)], [lb / 2, 0, 0], U, [0, 0, sz], col);
  }
  GLB.mat = m;
}
// a stone ground floor, a band at each floor, and pilasters up a tall old front
function glFacade(C, hw, hd, z0, h, floors, cols, wallC) {
  const m = GLB.mat, fh = h / floors, B = GLB.B, hs = hash2(GLB.x, GLB.y, 913);
  GLB.mat = M_STONE; glOBox([C[0], C[1] + (z0 + fh * .5) * ZS, C[2]], [hw + .004, 0, 0], [0, 0, hd + .004], [0, fh * .5 * ZS, 0], tintS(wallC, .55, [.6, .58, .54])); // rusticated base
  const band = tintS(wallC, .45, [.93, .9, .84]);
  for (let f = 1; f < floors; f++) if (floors <= 5 || f === 1 || f === floors - 1) glOBox([C[0], C[1] + (z0 + f * fh) * ZS, C[2]], [hw + .009, 0, 0], [0, 0, hd + .009], [0, .28 * ZS, 0], band);
  if (floors >= 4 && cols >= 3 && hs < .5 && (!B || B.type === 'house' || B.type === 'hall' || B.type === 'library' || B.type === 'museum')) { // pilasters between the windows
    const y = C[1] + (z0 + fh + (h - fh) / 2) * ZS, U = [0, (h - fh) / 2 * ZS, 0];
    for (let k = 1; k < cols; k++) { const t = k / cols;
      for (const sz of [-1, 1]) glOBox([C[0] - hw + t * hw * 2, y, C[2] + sz * (hd + .006)], [.012, 0, 0], [0, 0, .006], U, band);
      for (const sx of [-1, 1]) glOBox([C[0] + sx * (hw + .006), y, C[2] - hd + t * hd * 2], [.006, 0, 0], [0, 0, .012], U, band); }
  }
  GLB.mat = m;
}
// a window box of flowers under a window (cottages, workers' and artisans' houses)
function glWinBox(at, a, n, ww, wh, seed) {
  const m = GLB.mat; GLB.mat = M_PLANK; glOBox(at(0, .03, -wh / 2 - .026), V3s(a, ww / 2 + .006), V3s(n, .02), [0, .011, 0], '#6b4a32');
  GLB.mat = 0; glOBox(at(0, .03, -wh / 2 - .01), V3s(a, ww / 2), V3s(n, .017), [0, .007, 0], '#4f8a45');
  const fc = FLOWER_C[(hash2(seed, 13, 59) * FLOWER_C.length) | 0]; for (const s of [-.3, .05, .35]) glOBox(at(s * ww, .032, -wh / 2 - .001), V3s(a, ww * .14), V3s(n, .014), [0, .006, 0], fc);
  GLB.mat = m;
}
// a striped canvas awning over a shopfront
function glAwning(cx, cy, u0, v0, hw, hd, accent, U) {
  const P = (u, v, z) => gw(u0 + u, v0 + v, z, cx, cy); GLB.ctr = P(0, 0, 3); GLB.mat = M_PLANK;
  const L = (U ? hw : hd) * .9, n = Math.max(3, Math.round(L * 2 / .045)), stripe = gcol(accent), cream = [.95, .92, .86];
  for (let k = 0; k < n; k++) {
    const a = -L + k / n * L * 2, b = -L + (k + 1) / n * L * 2, col = k % 2 ? cream : stripe;
    const Q = (s, o, z) => U ? P(s, hd + o, z) : P(hw + o, s, z);
    gquad(Q(a, .005, 6), Q(b, .005, 6), Q(b, .1, 4.6), Q(a, .1, 4.6), col); gquad(Q(a, .1, 4.6), Q(b, .1, 4.6), Q(b, .1, 3.8), Q(a, .1, 3.8), col); // its slope and its hanging edge
  }
  GLB.mat = 0;
}
// the yard of a cottage or a worker's house: a patch of earth or cobbles, and the things people leave about
function glYardBits(B, x, y) {
  const P = (u, v, z) => gw(u, v, z), h = hash2(x, y, 520), cob = B.tier >= 3 || hasTech('masonry') && h < .5; GLB.ctr = P(0, 0, -20);
  GLB.mat = cob ? M_COBBLE : M_EARTH; gquad(P(-.47, -.47, .2), P(-.47, .47, .2), P(.47, .47, .2), P(.47, -.47, .2), cob ? [.62, .6, .56] : [.55, .45, .33]);
  if (!GLB.lod) return;
  const spots = [[.36, -.36], [-.36, .36], [.36, .36], [-.36, -.36]].filter((_, k) => hash2(x, y, 530 + k) < .55);
  for (const [u, v] of spots.slice(0, 2)) { const k = (hash2(x + 3, y, 540 + u * 10) * 4) | 0, W = P(u, v, 0);
    if (k === 0) { GLB.mat = M_PLANK; glOBox([W[0], W[1] + .035, W[2]], [.035, 0, 0], [0, 0, .035], [0, .035, 0], '#8a6a48'); glOBox([W[0] + .05, W[1] + .025, W[2] + .02], [.025, 0, 0], [0, 0, .025], [0, .025, 0], '#7a5c3e'); } // crates
    else if (k === 1) { GLB.mat = M_PLANK; for (const d of [-.028, .028]) { GLB.wall = M_PLANK; glCylAt(u + d, v, .024, 0, 2.2, '#7a5536', '#5f4330', 8); } GLB.wall = glWallMat(B); } // barrels
    else if (k === 2) { GLB.mat = M_PLANK; glOBox([W[0], W[1] + .05, W[2]], [.07, 0, 0], [0, 0, .04], [0, .012, 0], '#8b6b4a'); GLB.mat = 0; for (const s of [-1, 1]) glOBox([W[0] - .02, W[1] + .035, W[2] + s * .046], [.035, 0, 0], [0, 0, .004], [0, .035, 0], '#4a3a2c'); gBeam([W[0] + .07, W[1] + .05, W[2] - .02], [W[0] + .15, W[1] + .01, W[2] - .02], .004, '#6b5038'); } // a handcart
    else { GLB.mat = M_PLANK; for (const s of [-1, 1]) glOBox([W[0] + s * .09, W[1] + .06, W[2]], [.005, 0, 0], [0, 0, .005], [0, .06, 0], '#6b5038'); GLB.mat = 0; for (let j = 0; j < 4; j++) glOBox([W[0] - .066 + j * .044, W[1] + .095, W[2]], [.016, 0, 0], [0, 0, .002], [0, .022, 0], FLOWER_C[(j + (h * 9 | 0)) % FLOWER_C.length]); } // a washing line
  }
  GLB.mat = 0;
}

/* ---------- a chunk: terrain, water, roads, trees, lamps and everything standing on its tiles ---------- */
const GT = i => M.water[i] === 1 ? SEAZ * ZS : surfZ(i) * ZS;
function glBusy(x, y) { for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.bld[j] || M.tree[j] || GT(j) > GT(idx(x, y)) + .05) return true; } return false; }
/* ---------- ambient occlusion, baked: a height map of the valley, and each vertex looks round it for how much sky it can see ---------- */
const HFR = 8, HFN = W * HFR, HF = new Float32Array(HFN * HFN).fill(-9), AO_D = [...Array(8)].map((_, k) => [Math.cos(k / 8 * TAU + .2), Math.sin(k / 8 * TAU + .2)]), AO_S = [.14, .32, .65, 1.1, 1.8, 2.8];
function hfAt(x, z) { const a = Math.floor((x + .5) * HFR), b = Math.floor((z + .5) * HFR); return a < 0 || b < 0 || a >= HFN || b >= HFN ? -9 : HF[b * HFN + a]; }
// the chunk's own patch of the height map, from its (not too steep) triangles; walls are left out, the roofs above them say how tall things are
function hfRaster(k, v) {
  const x0 = (k % GNC) * GCH * HFR, z0 = ((k / GNC) | 0) * GCH * HFR, x1 = x0 + GCH * HFR, z1 = z0 + GCH * HFR, N = 13;
  for (let b = z0; b < z1; b++) HF.fill(-9, b * HFN + x0, b * HFN + x1);
  for (let t = 0; t < v.length; t += N * 3) {
    if (Math.abs(v[t + 4]) < .2) continue;
    const ax = v[t], ay = v[t + 1], az = v[t + 2], bx = v[t + N], by = v[t + N + 1], bz = v[t + N + 2], cx = v[t + 2 * N], cy = v[t + 2 * N + 1], cz = v[t + 2 * N + 2];
    if (Math.max(ax, bx, cx) - Math.min(ax, bx, cx) < .09 && Math.max(az, bz, cz) - Math.min(az, bz, cz) < .09) continue; // grass, flowers and trims don't hide the sky
    const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(det) < 1e-9) continue;
    const i0 = Math.max(x0, Math.floor((Math.min(ax, bx, cx) + .5) * HFR)), i1 = Math.min(x1 - 1, Math.floor((Math.max(ax, bx, cx) + .5) * HFR)), j0 = Math.max(z0, Math.floor((Math.min(az, bz, cz) + .5) * HFR)), j1 = Math.min(z1 - 1, Math.floor((Math.max(az, bz, cz) + .5) * HFR));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const px = (i + .5) / HFR - .5, pz = (j + .5) / HFR - .5, l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / det, l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / det, l3 = 1 - l1 - l2;
      if (l1 < -1e-4 || l2 < -1e-4 || l3 < -1e-4) continue;
      const y = l1 * ay + l2 * by + l3 * cy, o = j * HFN + i; if (y > HF[o]) HF[o] = y;
    }
  }
}
// horizon-based: in eight directions, the highest thing nearby above the surface's own tangent plane hides that much sky
function aoAt(px, py, pz, nx, ny, nz) {
  if (ny < -.5) return .55; // undersides: the ground's light, not the sky's
  const ox = px + nx * .05, oy = py + ny * .05, oz = pz + nz * .05; let sw = 0, sv = 0;
  for (let d = 0; d < 8; d++) {
    const dx = AO_D[d][0], dz = AO_D[d][1], f = dx * nx + dz * nz, w = ny > .5 ? 1 : f; if (w < .05) continue;
    const st = ny > .3 ? -f / ny / Math.sqrt(1 + f * f / (ny * ny)) : 0; let occ = 0;
    for (let k = 0; k < 6; k++) {
      const s = AO_S[k], a = Math.floor((ox + dx * s + .5) * HFR), b = Math.floor((oz + dz * s + .5) * HFR); if (a < 0 || b < 0 || a >= HFN || b >= HFN) continue;
      const dh = HF[b * HFN + a] - oy; if (dh <= 0 && st >= 0) continue;
      const o = (dh / Math.sqrt(dh * dh + s * s) - st) * (1 - s / 3.2); if (o > occ) occ = o;
    }
    sv += w * (1 - Math.min(1, occ)); sw += w;
  }
  return sw ? sv / sw : 1;
}
function glAO(v, from = 0, to = v.length, memo = new Map()) { // corners are shared by several triangles: work each one out once
  for (let t = from; t < to; t += 13) {
    const key = Math.round(v[t] * 256) * 131071 + Math.round(v[t + 2] * 256) * 8191 + Math.round(v[t + 1] * 512) * 7 + Math.round(v[t + 4] * 3) * 3 + Math.round(v[t + 3] * 3) * 5 + Math.round(v[t + 5] * 3) * 11;
    let a = memo.get(key); if (a === undefined) { a = aoAt(v[t], v[t + 1], v[t + 2], v[t + 3], v[t + 4], v[t + 5]); memo.set(key, a); } v[t + 12] = a;
  }
}
// a chunk's vertices packed for the graphics card: 28 bytes each instead of 52 (position as floats, the normal, colour,
// glow, material and shade as bytes, the id as a float so picking stays exact)
function glPack(v) {
  const n = v.length / 13, buf = new ArrayBuffer(n * 28), F = new Float32Array(buf), I8 = new Int8Array(buf), U8 = new Uint8Array(buf); let y0 = 1e9, y1 = -1e9;
  const c8 = x => x <= 0 ? 0 : x >= 1 ? 255 : Math.round(x * 255), n8 = x => Math.max(-127, Math.min(127, Math.round(x * 127)));
  for (let k = 0, s = 0; k < n; k++, s += 13) {
    const o = k * 28, f = o >> 2, e = v[s + 9]; F[f] = v[s]; F[f + 1] = v[s + 1]; F[f + 2] = v[s + 2]; if (v[s + 1] < y0) y0 = v[s + 1]; if (v[s + 1] > y1) y1 = v[s + 1];
    I8[o + 12] = n8(v[s + 3]); I8[o + 13] = n8(v[s + 4]); I8[o + 14] = n8(v[s + 5]);
    U8[o + 16] = c8(v[s + 6]); U8[o + 17] = c8(v[s + 7]); U8[o + 18] = c8(v[s + 8]);
    U8[o + 19] = e < -.5 ? 0 : e === 0 ? 1 : e >= 1.5 ? 255 : Math.min(254, 2 + Math.round(e * 250)); // (-1 water, 0, a window's (0, 1), 2 a lamp)
    F[f + 5] = v[s + 10]; U8[o + 24] = v[s + 11]; U8[o + 25] = c8(v[s + 12]);
  }
  return { buf, n, y0, y1 };
}
function glUpload(ch, v, near) { // into the chunk's far (always) or near (close to the camera, more detail) buffer
  const gl = GL3.gl, P = glPack(v);
  if (near) { if (!ch.nb) ch.nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ch.nb); gl.bufferData(gl.ARRAY_BUFFER, P.buf, gl.STATIC_DRAW); ch.nn = P.n; ch.near = true; }
  else { gl.bindBuffer(gl.ARRAY_BUFFER, ch.buf); gl.bufferData(gl.ARRAY_BUFFER, P.buf, gl.STATIC_DRAW); ch.n = P.n; ch.y0 = P.y0; ch.y1 = P.y1; }
}
function glDropNear(ch) { if (ch.nb) { GL3.gl.deleteBuffer(ch.nb); ch.nb = null; } ch.nn = 0; ch.near = false; }
// the view's six planes, to skip chunks outside it
function glFrustum(m) { const r = i => [m[i], m[4 + i], m[8 + i], m[12 + i]], R3 = r(3), o = []; for (let i = 0; i < 3; i++) { const Ri = r(i); o.push(R3.map((v, j) => v + Ri[j]), R3.map((v, j) => v - Ri[j])); } return o; }
function glSees(P, ch, k) {
  const x0 = (k % GNC) * GCH - 2.2, z0 = ((k / GNC) | 0) * GCH - 2.2, x1 = x0 + GCH + 3.4, z1 = z0 + GCH + 3.4, y0 = Math.min(ch.y0, 0) - .2, y1 = ch.y1 + .3; // (padded: big lots and piers reach past their chunk)
  for (const p of P) if (p[0] * (p[0] > 0 ? x1 : x0) + p[1] * (p[1] > 0 ? y1 : y0) + p[2] * (p[2] > 0 ? z1 : z0) + p[3] < 0) return false;
  return true;
}
function glBuildChunk(k, near = false) { const v = [], lamps = []; glBuildRows(k, near, 0, GCH, v, lamps); return { v: new Float32Array(v), lamps }; }
// some rows of a chunk (the detailed version is built a row or two a frame, so it never stalls the view)
function glBuildRows(k, near, r0, r1, v, lamps, c0 = 0, c1 = GCH) {
  const cx0 = (k % GNC) * GCH, cy0 = ((k / GNC) | 0) * GCH;
  const svLT = LT, svEM = EMQ; LT = GLT_FLAT(); EMQ = null;
  try {
    for (let y = cy0 + r0; y < cy0 + r1; y++) for (let x = cx0 + c0; x < cx0 + c1; x++) {
      const i = idx(x, y), h = GT(i);
      GLB = { v, x, y, base: surfZ(i) * ZS, tops: [], id: i + 1, wall: 0, mat: 0, lod: near, ctr: null, wallC: null, flat: '', ao: 1, B: null, smk: null }; // (every field up front: one shape keeps the primitives fast)
      const bio = M.bio[i], gmat = M.water[i] ? 0 : bio === BIO.MEADOW || bio === BIO.LUSH ? M_GRASS : bio === BIO.ROCK || bio === BIO.SNOW ? M_STONE : bio === BIO.SAND ? M_SAND : M_EARTH;
      // ground
      const top = gcol(topColor(i)), sc = gcol(sideCol(i));
      GLB.ctr = [x, h - 1, y]; GLB.mat = gmat;
      const sub = !M.water[i] && glBusy(x, y) ? 4 : 1; // finer ground next to buildings and trees, so the soft shadow at their feet has vertices to live on
      for (let a = 0; a < sub; a++) for (let b = 0; b < sub; b++) { const u0 = x - .5 + a / sub, v0 = y - .5 + b / sub, d = 1 / sub; gquad([u0, h, v0], [u0, h, v0 + d], [u0 + d, h, v0 + d], [u0 + d, h, v0], top, M.water[i] ? -1 : 0); }
      for (const [dx, dy] of N4) { // walls down to lower neighbours (and the island's edge)
        const nx = x + dx, ny = y + dy, nh = inb(nx, ny) ? GT(idx(nx, ny)) : -SLAB * ZS; if (nh >= h - .001) continue;
        const e = dx ? [[x + dx * .5, y - .5], [x + dx * .5, y + .5]] : [[x - .5, y + dy * .5], [x + .5, y + dy * .5]];
        GLB.ctr = [x, (h + nh) / 2, y]; GLB.mat = M.water[i] ? 0 : bio === BIO.ROCK || bio === BIO.SNOW ? M_STONE : M_EARTH;
        gquad([e[0][0], nh, e[0][1]], [e[1][0], nh, e[1][1]], [e[1][0], h, e[1][1]], [e[0][0], h, e[0][1]], M.water[i] ? gcol('#4ea7c8') : sc, M.water[i] ? -1 : 0);
      }
      if (M.road[i]) glRoad(i, x, y);
      if (M.road[i] && !M.water[i] && rcls(i) >= 2 && (x + 2 * y) % (rcls(i) >= 4 ? 2 : 3) === 0 && !M.bld[i]) { // a lamp post, and a real light
        const b = GLB.base, L = [x + .36, b + 10 * ZS, y - .36]; GLB.base = b;
        GLB.mat = 0; glBoxW(x + .36, y - .36, .025, b, 9.5 * ZS, '#4c4f58'); glBoxW(x + .36, y - .36, .05, b + 9.5 * ZS, 1.2 * ZS, '#fff3d0', 2); lamps.push(L);
      }
      if (M.tree[i] && !M.bld[i]) glTrees(i, x, y);
      // what stands on the tile, drawn by the same art as the 2D view
      { const Bw = M.bld[i] && S.B[M.bld[i]]; GLB.wall = Bw ? glWallMat(Bw) : M_PLANK; GLB.B = Bw || null; GLB.smk = lamps.smk || (lamps.smk = []); } // walls by what the building is made of; street furniture is wooden
      try { drawTileObjects(GSTUB, i, x, y, 0, 0); } catch (e) { }
      const B = M.bld[i] && S.B[M.bld[i]];
      if (B && !B.hid && FLAT_TYPES[B.type]) { GLB.flat = B.type === 'farm' ? 'farm' : B.type === 'park' || B.type === 'pasture' ? 'green' : B.type === 'plaza' || B.type === 'airfield' ? 'paved' : ''; try { drawBuilding(GSTUB, B, 0, 0, i); } catch (e) { } GLB.flat = ''; }
    }
  } finally { GLB = null; LT = svLT; EMQ = svEM; }
}
let GLT_N = null;
function GLT_FLAT() { // the light the colours are picked under: none at all (the shader does the lighting)
  if (GLT_N && GLT_N.base === LIGHT.cur) return GLT_N;
  GLT_N = Object.assign({}, LIGHT.cur, { fL: 1, fR: 1, fT: 1, fG: 1, fWL: 1, fWR: 1, lit: 1, amb: 1, sky: 0, dif: 0, hx: .5, hy: .5, shA: 0, base: LIGHT.cur, leaf: ['#000', 0], grass: ['#000', 0], snow: 0, flowers: .45 }); // (no season baked in: the shader paints it live)
  return GLT_N;
}
function glBoxW(x, z, r, y0, h, col, e = 0) { // a box in world units
  const c = gcol(col), y1 = y0 + h, P = (dx, dz, y) => [x + dx, y, z + dz]; GLB.ctr = [x, y0 + h / 2, z];
  gquad(P(-r, -r, y1), P(-r, r, y1), P(r, r, y1), P(r, -r, y1), c, e);
  gquad(P(-r, r, y0), P(r, r, y0), P(r, r, y1), P(-r, r, y1), c, e); gquad(P(r, r, y0), P(r, -r, y0), P(r, -r, y1), P(r, r, y1), c, e);
  gquad(P(r, -r, y0), P(-r, -r, y0), P(-r, -r, y1), P(r, -r, y1), c, e); gquad(P(-r, -r, y0), P(-r, r, y0), P(-r, r, y1), P(-r, -r, y1), c, e);
}
function glRoad(i, x, y) {
  const sf = M.road[i], t = RCLS[sf] || 1, w = t >= 4 ? .42 : t >= 2 ? .34 : .26, nb = roadNeighbors(M.road, x, y), br = M.water[i] !== 0;
  const h = br ? bridgeZ(i) * ZS : GT(i) + .006, col = gcol(br ? (t >= 3 ? '#c9c2b6' : '#b98d66') : ROAD_COL[sf] || ROAD_COL[1]);
  GLB.ctr = [x, h - 1, y];
  const seg = (a, b, c, d, cc, hh) => gquad([x + a, hh, y + c], [x + a, hh, y + d], [x + b, hh, y + d], [x + b, hh, y + c], cc);
  const lay = (ww, cc, hh) => { seg(-ww / 2, ww / 2, -ww / 2, ww / 2, cc, hh); for (const [dx, dy] of nb) { if (dx) seg(dx > 0 ? 0 : -.5, dx > 0 ? .5 : 0, -ww / 2, ww / 2, cc, hh); else seg(-ww / 2, ww / 2, dy > 0 ? 0 : -.5, dy > 0 ? .5 : 0, cc, hh); } };
  GLB.mat = M_STONE; if (!br && sf >= R_COBBLE) lay(w + .13, gcol(PAVE_COL[sf]), h - .002);
  GLB.mat = br ? (t >= 3 ? M_STONE : M_PLANK) : ROAD_MAT[sf] || 0; lay(w, col, h);
  GLB.mat = t >= 3 ? M_STONE : M_PLANK; if (br) glBoxW(x, y, .06, GT(i) - .2, h - GT(i) + .2, t >= 3 ? '#9c958c' : '#7e5f47');
  GLB.mat = 0; if (sf === R_ASPHALT && !br) for (const [dx, dy] of nb) seg(dx ? (dx > 0 ? .12 : -.38) : -.012, dx ? (dx > 0 ? .38 : -.12) : .012, dy ? (dy > 0 ? .12 : -.38) : -.012, dy ? (dy > 0 ? .38 : -.12) : .012, gcol('#f3e2a8'), h + .002);
  if (sf === R_GLOW && !br) for (const [dx, dy] of nb) seg(dx ? Math.min(0, dx * .5) : -.015, dx ? Math.max(0, dx * .5) : .015, dy ? Math.min(0, dy * .5) : -.015, dy ? Math.max(0, dy * .5) : .015, gcol('#8fe3ec'), h + .003);
}
const G_PUFF = ['#5f8f45', '#6a9a4a', '#557f3f', '#739f52', '#4f7f3c']; // oak greens
function glTrees(i, x, y) {
  const n = M.tree[i], tt = M.ttype[i], b = GT(i);
  for (let k = 0; k < n; k++) {
    let u = (hash2(x, y, k * 3 + 1) - .5) * .6, v = (hash2(x, y, k * 3 + 2) - .5) * .6; if (n === 1) { u *= .4; v *= .4; }
    const s = .8 + hash2(x, y, k * 3 + 3) * .45, hv = hash2(x, y, 90 + k), X = x + u, Z = y + v;
    if (tt === 2) { GLB.mat = M_BARK; glBoxW(X, Z, .03 * s, b, 4 * s * ZS, '#6b5a55'); GLB.mat = M_NEEDLE; const c = gcol(leafC(hv < .5 ? '#3f6f4a' : '#35604a')); const A = [X, b + 18 * s * ZS, Z]; GLB.ctr = [X, b, Z]; for (let j = 0; j < 8; j++) { const a0 = j / 8 * TAU, a1 = (j + 1) / 8 * TAU, r = .2 * s; gtri([X + Math.cos(a0) * r, b + 3 * s * ZS, Z + Math.sin(a0) * r], [X + Math.cos(a1) * r, b + 3 * s * ZS, Z + Math.sin(a1) * r], A, c); } }
    else if (tt === 3) { GLB.mat = 0; glBoxW(X, Z, .022 * s, b, 12 * s * ZS, '#ece8df'); GLB.base = b; glBall(X - GLB.x, Z - GLB.y, .14 * s, 13 * s, 5.5 * s, leafC(hv < .5 ? '#8fb35a' : '#9dbb62'), 0, M_LEAF); } // birch
    else { GLB.mat = M_BARK; glBoxW(X, Z, .03 * s, b, 7 * s * ZS, tt === 4 ? '#7b5e4e' : '#6b5040'); GLB.base = b; glBall(X - GLB.x, Z - GLB.y, .2 * s, 10 * s, 4.6 * s, leafC(tt === 4 ? '#6db873' : G_PUFF[(hv * G_PUFF.length) | 0]), 0, M_LEAF); }
  }
  GLB.base = surfZ(i) * ZS;
}
/* ---------- foliage and small life: the 2D streetscape's tufts, flowers, bushes and trees, in 3D ---------- */
// small things drawn at a screen point; a negative cy with no cx is art lifting them onto a roof
function glAt(X, Y) { for (const [sx, sy, z] of GLB.tops) if (Math.abs(sx - X) < .7 && Math.abs(sy - z - Y) < 1.6) return [...gunscreen(sx, sy), z]; return [...gunscreen(X, Y), 0]; }
function glBlob(u, v, r, zc, rz, col, mat = M_LEAF) { // a low-poly ball (bushes, flowers, sheep)
  const c = gcol(col), n = 7, P = (a, t) => gw(u + Math.cos(a) * r * Math.cos(t), v + Math.sin(a) * r * Math.cos(t), zc + rz * Math.sin(t)); GLB.ctr = gw(u, v, zc); GLB.mat = mat;
  for (let j = -2; j < 2; j++) { const t0 = j / 2 * Math.PI / 2, t1 = (j + 1) / 2 * Math.PI / 2; for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gquad(P(a, t0), P(b, t0), P(b, t1), P(a, t1), c); } }
}
function glTuft(X, Y, col) { // a clump of grass blades
  const [u, v, z] = glAt(X, Y), c = gcol(mix(col, '#3f6f35', .35)), h0 = hash2((u * 97) | 0, (v * 89) | 0, 7); GLB.mat = 0; GLB.ctr = gw(u, v, z - 5);
  for (let k = 0; k < 6; k++) { const a = (h0 + k / 6) * TAU, du = Math.cos(a) * .012, dv = Math.sin(a) * .012, ou = Math.cos(a * 3) * .03, ov = Math.sin(a * 3) * .03; gtri(gw(u + ou - dv, v + ov + du, z), gw(u + ou + dv, v + ov - du, z), gw(u + ou * 1.8, v + ov * 1.8, z + 1.2 + (k % 3) * .35), c); }
}
function glFlowers(X, Y, h) { // a clump of stems and blooms
  const [u, v, z] = glAt(X, Y); GLB.mat = 0;
  for (let k = 0; k < 3; k++) { const du = (k - 1) * .05, dv = ((k % 2) - .5) * .05; glBoxW(GLB.x + u + du, GLB.y + v + dv, .006, GLB.base + z * ZS, 1.4 * ZS, '#4f8a45'); glBlob(u + du, v + dv, .022, z + 1.6, .6, FLOWERS[(((h * 17) | 0) + k) % FLOWERS.length], 0); }
}
function glSmallTree(u, v, z, h, s, col) { // street, garden and park trees: a trunk and a leafy crown
  GLB.mat = M_BARK; glBoxW(GLB.x + u, GLB.y + v, .022 * s, GLB.base + z * ZS, 5 * s * ZS, '#6b5040');
  glBlob(u, v, .15 * s, z + 7 * s, 3.4 * s, leafC(col)); glBlob(u + .05 * s, v - .04 * s, .1 * s, z + 9 * s, 2.4 * s, leafC(col));
}
function glTreeAt(cx, cy, u, v, h, s, col) { const lift = cy < 0 && !cx ? -cy : 0, [su, sv] = lift ? [0, 0] : gunscreen(cx, cy); glSmallTree(u + su, v + sv, lift, h, s, col); }
// the First Pod: a silver capsule lying where it came down, half sunk and tipped, greening over the centuries
function glPod(B) {
  const a = -.55, d = [Math.cos(a), .14, Math.sin(a)], dl = Math.hypot(d[0], d[1], d[2]), D = V3(d, 1 / dl), side = [-Math.sin(a), 0, Math.cos(a)], up = [side[1] * D[2] - side[2] * D[1], side[2] * D[0] - side[0] * D[2], side[0] * D[1] - side[1] * D[0]]; // (side × along: pointing up, so the porthole and the moss are on top)
  const L = .3, r = .13, c0 = [GLB.x, GLB.base + r * .72, GLB.y], P = (s, t, rr) => VA(c0, V3(D, s), V3(side, Math.cos(t) * rr), V3(up, Math.sin(t) * rr));
  const rad = s => Math.abs(s) <= L ? r : r * Math.sqrt(Math.max(0, 1 - ((Math.abs(s) - L) / r) ** 2)), ss = [];
  for (let k = 0; k <= 8; k++) ss.push(-L - r + k / 8 * r); for (let k = 1; k <= 10; k++) ss.push(-L + k / 10 * 2 * L); for (let k = 1; k <= 8; k++) ss.push(L + k / 8 * r);
  GLB.mat = 0; const body = gcol('#dfe3ea'), band = gcol('#e5874f'), n = 14;
  for (let j = 0; j < ss.length - 1; j++) {
    const s0 = ss[j], s1 = ss[j + 1], col = (s0 + s1) / 2 > -.1 && (s0 + s1) / 2 < -.02 ? band : body;
    GLB.ctr = VA(c0, V3(D, (s0 + s1) / 2));
    for (let k = 0; k < n; k++) { const t0 = k / n * TAU, t1 = (k + 1) / n * TAU; gquad(P(s0, t0, rad(s0)), P(s1, t0, rad(s1)), P(s1, t1, rad(s1)), P(s0, t1, rad(s0)), col); }
  }
  glOBox(P(L * .8, Math.PI * .42, r * 1.01), V3(D, .035), V3(side, .03), V3(up, .004), '#7fcde6', .5); // the porthole, lit at night
  glOBox(VA(c0, V3(D, -L - r - .012)), V3(D, .018), V3(side, .06), V3(up, .06), '#5b6170'); // the thruster
  const age = S.year;
  const on = (q, rr, rz, col, mat) => glBlob(q[0] - GLB.x, q[2] - GLB.y, rr, (q[1] - GLB.base) / ZS, rz, col, mat); // a lump sitting on the hull
  if (age > 120) { on(P(-.12, Math.PI * .5, r - .01), .09, .8, leafC('#6a9a50')); on(P(.1, Math.PI * .7, r - .01), .06, .6, leafC('#78a85a')); } // moss
  if (age > 600) for (let k = 0; k < 4; k++) on(P(-.16 + k * .045, Math.PI * (.45 + (k % 2) * .08), r + .018), .012, .35, FLOWERS[k % FLOWERS.length], 0); // and flowers in it
  if (age > 250) for (let k = 0; k < 10; k++) { const t = k / 10 * TAU; GLB.mat = M_PLANK; glBoxW(GLB.x + Math.cos(t) * .44, GLB.y + Math.sin(t) * .44, .012, GLB.base, 3.5 * ZS, '#8a6d57'); } // the fence of honour
}
/* ---------- big lots in 3D: the harbour at any length, and the landmarks that spread over 2×1 or 2×2 tiles ---------- */
// world-space helpers: c is the middle of the thing on the ground (or where noted), f/r half-extent vectors along the ground
const V3a = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], V3s = (a, k) => [a[0] * k, a[1] * k, a[2] * k], V3x = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function gBox(c, f, r, h, col, mat = 0, e = 0) { GLB.mat = mat; glOBox([c[0], c[1] + h / 2, c[2]], f, r, [0, h / 2, 0], col, e); }
function gBeam(A, Bp, w, col, mat = 0, e = 0) { // a square beam from A to B
  const f = V3s([Bp[0] - A[0], Bp[1] - A[1], Bp[2] - A[2]], .5), hz = Math.hypot(f[0], f[2]), r = hz > 1e-6 ? [-f[2] / hz * w, 0, f[0] / hz * w] : [w, 0, 0];
  let u = V3x(f, r); const lu = Math.hypot(...u) || 1; u = V3s(u, w / lu); GLB.mat = mat; glOBox(V3a(A, f), f, r, u, col, e);
}
function gRoof(c, f, r, y0, rh, col, wall) { // a gable roof: ridge along f, eaves along ±r, at height y0; the gable ends in the wall colour
  const C = gcol(col), Cw = gcol(wall), P = (i, j, y) => [c[0] + f[0] * i + r[0] * j, y, c[2] + f[2] * i + r[2] * j], rm = roofMat(C), top = y0 + rh; GLB.ctr = [c[0], y0 - .2, c[2]];
  const g = 1.06; // (a little overhang)
  GLB.mat = rm; gquad(P(-g, -g, y0), P(g, -g, y0), P(g, 0, top), P(-g, 0, top), C); gquad(P(-g, g, y0), P(g, g, y0), P(g, 0, top), P(-g, 0, top), C);
  GLB.mat = GLB.wall || 0; gtri(P(1, -1, y0), P(1, 1, y0), P(1, 0, top), Cw); gtri(P(-1, -1, y0), P(-1, 1, y0), P(-1, 0, top), Cw);
}
function gWins(c, along, out, hw, y0, floors, cols, fh, seed) { // rows of windows on a wall: c is the wall's middle at the ground, out is the way it faces
  const n = Math.hypot(...out) || 1, o = V3s(out, .004 / n);
  for (let f = 0; f < floors; f++) for (let k = 0; k < cols; k++) {
    const s = -hw + (k + .5) / cols * hw * 2, p = V3a(V3a(c, V3s(along, s)), o);
    glOBox([p[0], y0 + (f + .5) * fh, p[2]], V3s(along, hw / cols * .32), V3s(out, .002 / n), [0, fh * .24, 0], '#3a4250', .03 + .94 * hash2((seed * 7 + f) | 0, (seed * 13 + k) | 0, 71));
  }
}
function gSpire(c, r, h, col) { const C = gcol(col), T = [c[0], c[1] + h, c[2]], P = (i, j) => [c[0] + i * r, c[1], c[2] + j * r]; GLB.ctr = [c[0], c[1] - .1, c[2]]; GLB.mat = roofMat(C); gtri(P(-1, -1), P(1, -1), T, C); gtri(P(1, -1), P(1, 1), T, C); gtri(P(1, 1), P(-1, 1), T, C); gtri(P(-1, 1), P(-1, -1), T, C); }
const glLot = B => [B.x + (fpW(B) - 1) / 2, B.y + (fpH(B) - 1) / 2]; // the middle of a lot, in tiles
function glFacing(B) { // the long side that has a street along it (a 2×1 lot faces its road)
  const long = fpW(B) >= fpH(B) ? [1, 0] : [0, 1], n = [long[1], long[0]];
  for (const sg of [1, -1]) for (const t of fpTiles(B)) { const x = t % W + n[0] * sg, y = ((t / W) | 0) + n[1] * sg; if (inb(x, y) && M.road[idx(x, y)]) return { a: long, d: [n[0] * sg, n[1] * sg] }; }
  return { a: long, d: n };
}

// the harbour: a stone quay along its shore, a berth in front of each tile, piers between, warehouses behind, cranes and cargo by the era
function glHarbour(B) {
  const d = B.dir || [1, 0], a = d[0] ? [0, 1] : [1, 0], L = berths(B), [lx, lz] = glLot(B), ys = SEAZ * ZS - .02;
  let y = 0; for (const j of fpTiles(B)) if (!M.water[j]) y = Math.max(y, surfZ(j) * ZS); if (!y) y = GLB.base; // (the quay is level with the land, also where it's built out over the water)
  const steel = hasTech('steam'), boxes = hasTech('computing'), brick = hasTech('brick');
  const P = (s, t, yy = y) => [lx + a[0] * s + d[0] * t, yy, lz + a[1] * s + d[1] * t], A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]];
  gBox(P(0, 0, y - .005), V3s(A3, L / 2), V3s(D3, .5), .03, B.style >= 3 || steel ? '#bdb5a7' : '#b9a488', M_STONE); // the quay
  gBox(P(0, .5, ys - .05), V3s(A3, L / 2), V3s(D3, .035), y - ys + .075, '#a39a8c', M_STONE); // its wall down into the water
  for (const sg of [-1, 1]) gBox(P(sg * L / 2, 0, ys - .05), V3s(A3, .035), V3s(D3, .5), y - ys + .075, '#a39a8c', M_STONE); // and its ends
  for (let k = 0; k <= L * 3; k++) gBox(P(-L / 2 + k / 3 + .02, .45), [.014, 0, 0], [0, 0, .014], .045, '#3a3c42'); // bollards
  for (let k = 0; k <= L; k++) { // piers between the berths, on posts
    const s = -L / 2 + k + (k === 0 ? .05 : k === L ? -.05 : 0);
    gBox(P(s, .93, y - .01), V3s(A3, .045), V3s(D3, .43), .022, steel ? '#8f877a' : '#8a6a4c', steel ? M_STONE : M_PLANK);
    for (const t of [.62, .95, 1.28]) gBox(P(s, t, ys - .06), [.012, 0, 0], [0, 0, .012], y - ys + .05, '#5a4a3c', M_PLANK);
  }
  for (let k = 0; k < L; k++) {
    const s = -L / 2 + k + .5, h = hash2(B.x + k, B.y, 5);
    // a warehouse at the back of each berth
    const wh = (boxes ? 13 : steel ? 11 : 9) * ZS, wall = boxes ? '#98a2ab' : brick ? '#b8684f' : '#c8a77a';
    const sv = GLB.wall; GLB.wall = boxes ? M_PLASTER : brick ? M_BRICK : M_PLANK;
    gBox(P(s, -.24), V3s(A3, .4), V3s(D3, .2), wh, wall, GLB.wall);
    if (boxes) gBox(P(s, -.24, y + wh), V3s(A3, .41), V3s(D3, .21), .012, '#6b737c', M_TAR);
    else gRoof(P(s, -.24), V3s(A3, .4), V3s(D3, .2), y + wh, 4.5 * ZS, steel ? '#5d6670' : '#a0523c', wall);
    gWins(P(s, -.03), A3, D3, .36, y + .03, boxes ? 3 : 2, 4, wh / (boxes ? 3.4 : 2.4), B.x * 3 + k);
    GLB.mat = 0; glOBox(P(s + .22, -.035, y + wh * .3), V3s(A3, .07), V3s(D3, .004), [0, wh * .3, 0], '#4a3a30'); // the big door
    GLB.wall = sv;
    // a crane at each berth
    if (boxes) { // gantry: four legs, a beam and a boom out over the ship
      const hc = .95, col = h < .5 ? '#d6703a' : '#3f6f9f';
      for (const [sa, ta] of [[-.14, .12], [.14, .12], [-.14, .42], [.14, .42]]) gBeam(P(s + sa, ta), P(s + sa, ta, y + hc), .014, col);
      for (const sa of [-.14, .14]) gBeam(P(s + sa, -.05, y + hc), P(s + sa, 1.3, y + hc), .016, col);
      gBox(P(s, .9, y + hc - .06), V3s(A3, .16), V3s(D3, .06), .06, '#e8e2d6'); // the trolley
      gBeam(P(s, .9, y + hc - .06), P(s, .9, y + .35), .004, '#2a2a2a');
    } else {
      const hc = (steel ? 16 : 11) * ZS, col = steel ? '#c8603a' : '#8a6446';
      gBox(P(s - .22, .32), [.022, 0, 0], [0, 0, .022], hc, col, steel ? 0 : M_PLANK);
      gBeam(P(s - .22, .32, y + hc * .75), P(s - .22, .95, y + hc * 1.08), .012, col, steel ? 0 : M_PLANK);
      gBeam(P(s - .22, .95, y + hc * 1.08), P(s - .22, .95, y + hc * .45), .003, '#2a2a2a');
      gBox(P(s - .22, .95, y + hc * .38), [.03, 0, 0], [0, 0, .03], .04, '#9b7657', M_PLANK); // what it's lifting
    }
    // cargo on the quay
    if (boxes) { const cols = ['#c0584f', '#3f7fb0', '#e0a43a', '#4e9a6a', '#7a5a9a']; for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 3; c2++) { const nH = 1 + ((hash2(B.x + k, r2 * 3 + c2, 9) * 3) | 0); for (let l = 0; l < nH; l++) gBox(P(s - .25 + c2 * .17, .1 + r2 * .1, y + .03 + l * .05), V3s(A3, .075), V3s(D3, .04), .048, cols[(k + r2 + c2 + l) % cols.length]); } }
    else for (let c2 = 0; c2 < 4; c2++) { const hh = hash2(B.x + k, c2, 13); gBox(P(s - .1 + c2 * .08, .18 + (c2 % 2) * .07), [.028, 0, 0], [0, 0, .028], .05 + hh * .03, hh < .5 ? '#a57c55' : '#8a6a4c', M_PLANK); }
  }
  // lamps at the ends of the quay
  for (const s of [-L / 2 + .06, L / 2 - .06]) { gBox(P(s, .4), [.01, 0, 0], [0, 0, .01], 9 * ZS, '#4c4f58'); gBox(P(s, .4, y + 9 * ZS), [.025, 0, 0], [0, 0, .025], .04, '#fff3d0', 0, 2); }
}

// landmarks on their bigger lots
function glBigHall(B, st) { // a grand town hall: a long range with a portico and a tower
  const { a, d } = glFacing(B), [lx, lz] = glLot(B), y = GLB.base, A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]], P = (s, t, yy = y) => [lx + a[0] * s + d[0] * t, yy, lz + a[1] * s + d[1] * t];
  const stone = hasTech('masonry'), wall = stone ? '#d9cfbd' : st.wall, h = 20 * ZS; GLB.wall = stone ? M_STONE : M_PLASTER;
  gBox(P(0, -.05), V3s(A3, .85), V3s(D3, .3), h, wall, GLB.wall); gRoof(P(0, -.05), V3s(A3, .85), V3s(D3, .3), y + h, 7 * ZS, st.roof, wall);
  gWins(P(0, .25), A3, D3, .8, y + .04, 3, 9, h / 3.3, B.x * 5 + B.y);
  gBox(P(0, .3), V3s(A3, .26), V3s(D3, .08), .02, '#cfc6b4', M_STONE); // steps
  for (let k = 0; k < 6; k++) gBox(P(-.22 + k * .088, .34, y + .02), [.014, 0, 0], [0, 0, .014], 12 * ZS, '#eee8dc', M_STONE); // columns
  gBox(P(0, .34, y + .02 + 12 * ZS), V3s(A3, .27), V3s(D3, .06), .03, '#e4ddcf', M_STONE);
  gBox(P(0, -.05, y + h), [.1, 0, 0], [0, 0, .1], 22 * ZS, wall, GLB.wall); // the tower
  gBox(P(0, .055, y + h + 13 * ZS), [.03, 0, 0], [0, 0, .004], .06, '#f4f0e0', 0, .5); // its clock face, lit at night
  GLB.mat = M_SLATE; glDomeAt(P(0, -.05)[0] - GLB.x, P(0, -.05)[2] - GLB.y, .1, (h + 22 * ZS) / ZS, 7, hasTech('steam') ? '#6f8f84' : st.roof, 0, M_SLATE);
  GLB.wall = 0;
}
function glBigMuseum(B, st) { // a classical museum: stone, a colonnade, a pediment, and later a glass roof
  const { a, d } = glFacing(B), [lx, lz] = glLot(B), y = GLB.base, A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]], P = (s, t, yy = y) => [lx + a[0] * s + d[0] * t, yy, lz + a[1] * s + d[1] * t];
  const h = 15 * ZS; GLB.wall = M_STONE;
  gBox(P(0, 0, y), V3s(A3, .88), V3s(D3, .42), .04, '#cfc6b4', M_STONE); // plinth
  gBox(P(0, -.06, y + .04), V3s(A3, .8), V3s(D3, .3), h, '#e2dccf', M_STONE);
  for (let k = 0; k < 10; k++) gBox(P(-.72 + k * .16, .3, y + .04), [.016, 0, 0], [0, 0, .016], h - .02, '#f2eee4', M_STONE);
  gBox(P(0, .12, y + .02 + h), V3s(A3, .84), V3s(D3, .24), .03, '#e8e2d6', M_STONE);
  gRoof(P(0, .12), V3s(A3, .84), V3s(D3, .24), y + .05 + h, 5 * ZS, '#8d8a86', '#efe9dd');
  if (hasTech('computing')) { GLB.mat = M_GLASS; const c = P(0, -.25, y + .04 + h); glBoxW(c[0], c[2], .16, c[1], 8 * ZS, '#9fc4d8', .5); } // a glass lantern on the roof
  GLB.wall = 0;
}
function glBigTheatre(B, st) { // a fly tower behind a rounded auditorium, lights round the front at night
  const { a, d } = glFacing(B), [lx, lz] = glLot(B), y = GLB.base, A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]], P = (s, t, yy = y) => [lx + a[0] * s + d[0] * t, yy, lz + a[1] * s + d[1] * t];
  const wall = hasTech('brick') ? '#b8684f' : st.wall; GLB.wall = hasTech('brick') ? M_BRICK : M_PLASTER;
  gBox(P(-.35, -.05), V3s(A3, .35), V3s(D3, .32), 26 * ZS, wall, GLB.wall); gRoof(P(-.35, -.05), V3s(D3, .32), V3s(A3, .35), y + 26 * ZS, 5 * ZS, st.roof, wall); // the fly tower
  const c = P(.25, 0); GLB.mat = GLB.wall; glCylAt(c[0] - GLB.x, c[2] - GLB.y, .42, 0, 15, wall, st.roof); // the auditorium
  GLB.mat = M_SLATE; glDomeAt(c[0] - GLB.x, c[2] - GLB.y, .42, 15, 6, st.roof, 0, M_SLATE);
  for (let k = 0; k < 12; k++) { const t = (k / 11 - .5) * 2.2, p = [c[0] + Math.cos(t) * .43 * d[0] + Math.sin(t) * .43 * a[0], y + 11 * ZS, c[2] + Math.cos(t) * .43 * d[1] + Math.sin(t) * .43 * a[1]]; glOBox(p, [.012, 0, 0], [0, 0, .012], [0, .012, 0], '#ffe7a0', .5); } // marquee lights
  GLB.wall = 0;
}
function glBigUniversity(B, st) { // four ranges round a green quad, and a clock tower over the gate
  const [lx, lz] = glLot(B), y = GLB.base, stone = hasTech('masonry'), wall = hasTech('brick') && !stone ? '#b8684f' : '#d8c9a8', h = 18 * ZS; GLB.wall = stone ? M_STONE : M_BRICK;
  const R = [[0, -.72, 1, 0, .88, .16], [0, .72, 1, 0, .88, .16], [-.72, 0, 0, 1, .56, .16], [.72, 0, 0, 1, .56, .16]]; // x, z, along x, along z, half length, half depth
  for (const [ox, oz, ax, az, hl, hd] of R) {
    const c = [lx + ox, y, lz + oz], f = [ax * hl, 0, az * hl], r = [az * hd, 0, ax * hd];
    gBox(c, f, r, h, wall, GLB.wall); gRoof(c, f, r, y + h, 6 * ZS, st.roof, wall);
    for (const sg of [1, -1]) gWins(V3a(c, V3s(r, sg)), [ax, 0, az], V3s(r, sg), hl * .9, y + .03, 3, Math.round(hl * 9), h / 3.3, (lx * 11 + ox * 7 + sg) | 0);
  }
  gBox([lx, y, lz], [.55, 0, 0], [0, 0, .55], .012, '#6f9a52', M_GRASS); // the quad
  glSmallTree(lx - GLB.x - .25, lz - GLB.y + .2, 0, .4, 1.1, '#5f9a4d'); glSmallTree(lx - GLB.x + .28, lz - GLB.y - .22, 0, .7, 1, '#6aa556');
  const tw = [lx, y, lz + .72]; gBox(tw, [.1, 0, 0], [0, 0, .1], 34 * ZS, wall, GLB.wall); // the tower
  gBox([tw[0], y + 26 * ZS, tw[2] + .102], [.035, 0, 0], [0, 0, .002], .07, '#f4f0e0', 0, .5); // clock
  gSpire([tw[0], y + 34 * ZS, tw[2]], .11, 12 * ZS, st.roof);
  GLB.wall = 0;
}
function glBigStadium(B) { // a bowl of stands round a striped pitch, floodlights on masts
  const [lx, lz] = glLot(B), y = GLB.base, n = 28, rx = .95, rz = .95, ix = .62, iz = .45, top = y + 9 * ZS;
  const P = (t, fx, fz, yy) => [lx + Math.cos(t) * fx, yy, lz + Math.sin(t) * fz];
  GLB.mat = M_STONE; const cw = gcol('#b0a898'), seats = [gcol(hasTech('motor') ? '#5b8fc4' : '#b3aa9b'), gcol(hasTech('motor') ? '#dd7466' : '#c4bcae'), gcol('#ece7dc')];
  for (let tier = 0; tier < 3; tier++) { // three rings of seats, each a step higher and further out
    const f0 = tier / 3, f1 = (tier + 1) / 3, fx0 = ix + (rx - ix) * f0, fx1 = ix + (rx - ix) * f1, fz0 = iz + (rz - iz) * f0, fz1 = iz + (rz - iz) * f1, y0 = y + .02 + (top - y) * f0, y1 = y + .02 + (top - y) * f1;
    for (let k = 0; k < n; k++) { const t0 = k / n * TAU, t1 = (k + 1) / n * TAU;
      GLB.ctr = [lx, y1 + 2, lz]; gquad(P(t0, fx0, fz0, y0), P(t1, fx0, fz0, y0), P(t1, fx1, fz1, y1), P(t0, fx1, fz1, y1), seats[tier]);
      GLB.ctr = [lx, y - 2, lz]; gquad(P(t0, fx0, fz0, y0), P(t1, fx0, fz0, y0), P(t1, fx0, fz0, y0 - (y1 - y0) * .15), P(t0, fx0, fz0, y0 - (y1 - y0) * .15), cw); } // (the riser in front of each tier)
  }
  for (let k = 0; k < n; k++) { const t0 = k / n * TAU, t1 = (k + 1) / n * TAU; GLB.ctr = [lx, y, lz]; gquad(P(t0, rx, rz, y), P(t1, rx, rz, y), P(t1, rx, rz, top + .03), P(t0, rx, rz, top + .03), cw); } // the outer wall
  if (hasTech('concrete')) for (let k = 0; k < n; k++) { const t0 = k / n * TAU, t1 = (k + 1) / n * TAU; if (Math.sin(t0) < .2) continue; GLB.ctr = [lx, top - 1, lz]; GLB.mat = 0; gquad(P(t0, rx, rz, top + .03), P(t1, rx, rz, top + .03), P(t1, rx * .8, rz * .8, top + .09), P(t0, rx * .8, rz * .8, top + .09), gcol('#e8ecf0')); } // a roof over the main stand
  for (let k = 0; k < 6; k++) gBox([lx - ix * .8 + k * ix * .32, y, lz], [ix * .16, 0, 0], [0, 0, iz * .78], .012, k % 2 ? '#5f9a4d' : '#6aa556', M_GRASS); // the pitch
  if (hasTech('electric')) for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const p = [lx + sx * .78, y, lz + sz * .78]; gBox(p, [.018, 0, 0], [0, 0, .018], 30 * ZS, '#8c9199'); gBox([p[0], y + 30 * ZS, p[2]], [.06, 0, 0], [0, 0, .02], .05, '#fff8e0', 0, 2); }
}
function glBigFusion(B) { // twin containment domes, a cooling ring and a blue glow
  const [lx, lz] = glLot(B), y = GLB.base;
  gBox([lx, y, lz], [.85, 0, 0], [0, 0, .85], .03, '#c4c9cf', M_STONE);
  for (const sx of [-.42, .42]) { GLB.mat = M_PLASTER; glCylAt(lx + sx - GLB.x, lz - .15 - GLB.y, .3, 0, 8, '#e8edf2', '#e8edf2'); glDomeAt(lx + sx - GLB.x, lz - .15 - GLB.y, .3, 8, 12, '#eef2f6', 0, M_PLASTER); }
  GLB.mat = 0; glCylAt(lx - GLB.x, lz + .45 - GLB.y, .26, 0, 3, '#7fe8e0', null); // the ring's glow
  gBox([lx, y, lz + .45], [.3, 0, 0], [0, 0, .06], 4 * ZS, '#9aa3ad', M_PLASTER);
  gBox([lx, y + 3 * ZS, lz + .45], [.02, 0, 0], [0, 0, .02], .02, '#7fe8e0', 0, 2);
}
function glBigStation(B, st) { // a station house with a clock, and a long platform under a canopy
  const { a, d } = glFacing(B), [lx, lz] = glLot(B), y = GLB.base, A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]], P = (s2, t, yy = y) => [lx + a[0] * s2 + d[0] * t, yy, lz + a[1] * s2 + d[1] * t];
  const glass = hasTech('concrete'), wall = hasTech('brick') ? '#b8684f' : st.wall, h = 14 * ZS; GLB.wall = hasTech('brick') ? M_BRICK : M_PLASTER;
  gBox(P(-.35, .12), V3s(A3, .4), V3s(D3, .24), h, wall, GLB.wall); gRoof(P(-.35, .12), V3s(A3, .4), V3s(D3, .24), y + h, 6 * ZS, st.roof, wall);
  gWins(P(-.35, .36), A3, D3, .34, y + .03, 2, 5, h / 2.4, B.x * 3 + B.y);
  gBox(P(-.35, .37, y + h - .02), [.035, 0, 0], [0, 0, .035], .07, '#f4f0e0', 0, .5); // the clock
  gBox(P(0, -.3), V3s(A3, .95), V3s(D3, .14), .035, '#bdb5a7', M_STONE); // the platform
  for (let k = 0; k < 6; k++) gBeam(P(-.8 + k * .32, -.3, y + .035), P(-.8 + k * .32, -.3, y + 12 * ZS), .01, glass ? '#8c9199' : '#3d4a44');
  if (glass) gBox(P(0, -.3, y + 12 * ZS), V3s(A3, .95), V3s(D3, .2), .012, '#bfe3f0', 0, 0); // glass canopy
  else gRoof(P(0, -.3), V3s(A3, .95), V3s(D3, .2), y + 12 * ZS, 3 * ZS, '#5d6670', '#3d4a44');
  for (let k = 0; k < 3; k++) gBox(P(-.6 + k * .5, -.28, y + .035), V3s(A3, .07), V3s(D3, .02), .02, '#6b5040', M_PLANK); // benches
  GLB.wall = 0;
}
function glBigMarket(B, st) { // a cobbled market street of stalls under striped awnings, or later a glass market hall
  const { a, d } = glFacing(B), [lx, lz] = glLot(B), y = GLB.base, A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]], P = (s2, t, yy = y) => [lx + a[0] * s2 + d[0] * t, yy, lz + a[1] * s2 + d[1] * t];
  gBox(P(0, 0, y - .005), V3s(A3, .98), V3s(D3, .48), .02, '#a39a8c', M_COBBLE);
  if (hasTech('concrete')) { // the market hall
    GLB.wall = M_BRICK; gBox(P(0, 0), V3s(A3, .85), V3s(D3, .38), 11 * ZS, '#b8684f', M_BRICK);
    gWins(P(0, .38), A3, D3, .8, y + .03, 1, 8, 9 * ZS, B.x * 5 + B.y);
    GLB.wall = M_GLASS; const c0 = P(0, 0); GLB.mat = M_GLASS; glOBox([c0[0], y + 11 * ZS + .06, c0[2]], V3s(A3, .86), V3s(D3, .39), [0, .06, 0], '#9fc4d8', .5); GLB.wall = 0; return;
  }
  const cols = [['#c0584f', '#f2ece0'], ['#3f7fb0', '#f2ece0'], ['#4e9a6a', '#f2ece0'], ['#e0a43a', '#6b5040']], food = ['#c0392b', '#e0a43a', '#6aa556', '#8a5a9a', '#d8b86a'];
  for (let r2 = 0; r2 < 2; r2++) for (let k = 0; k < 4; k++) { // two rows of stalls facing each other
    const s2 = -.72 + k * .48, t = r2 ? .26 : -.26, c = cols[(k + r2 * 2 + B.id) % cols.length], out = r2 ? -1 : 1;
    gBox(P(s2, t), V3s(A3, .17), V3s(D3, .08), 3.2 * ZS, '#8a6a4c', M_PLANK); // the table
    for (let q = 0; q < 4; q++) gBox(P(s2 - .12 + q * .08, t, y + 3.2 * ZS), [.022, 0, 0], [0, 0, .022], .025, food[(k * 3 + q + r2) % food.length]); // what's for sale
    for (const [sa, ta] of [[-.16, -.08], [.16, -.08], [-.16, .08], [.16, .08]]) gBeam(P(s2 + sa, t + ta), P(s2 + sa, t + ta, y + 9 * ZS), .005, '#5a4030');
    for (let q = 0; q < 4; q++) { const sa = -.18 + q * .09; GLB.ctr = P(s2, t, y); GLB.mat = 0; gquad(P(s2 + sa, t - .1 * out, y + 9 * ZS), P(s2 + sa + .09, t - .1 * out, y + 9 * ZS), P(s2 + sa + .09, t + .14 * out, y + 7 * ZS), P(s2 + sa, t + .14 * out, y + 7 * ZS), gcol(c[q % 2])); } // the striped awning, sloping out over the lane
  }
}
const GL_BIG = { station: glBigStation, market: glBigMarket, hall: glBigHall, museum: glBigMuseum, theatre: glBigTheatre, university: glBigUniversity, stadium: glBigStadium, fusion: glBigFusion };

/* ---------- 3D-native models: buildings made straight in 3D (world units), not by running their 2D art ---------- */
// glModel(B) picks the model a building is drawn with in 3D: a landmark on a bigger lot (GL_BIG), else one from
// GL_MODEL, else nothing and its 2D art runs through the primitives as before. New building art belongs here: move a type
// over by adding GL_MODEL[type] = (B, st) => {...}. Helpers: gBox/gBeam/gRoof/gSpire/gWins (world units: x, y = height,
// z), glCylAt/glDomeAt/glPyr/glDoor (tile-local u, v and pixel heights), gCone below; GLB.x/GLB.y is the tile, GLB.base
// its ground, GLB.lod true for the close-up version (put small detail behind it).
function glModel(B) { return fpBig(B) && GL_BIG[B.type] || GL_MODEL[B.type] || null; }
function gCone(u, v, r, z0, h, col, n = 12) { // a cone standing on tile-local (u, v), from pixel height z0 up h
  const c = gcol(col), A = gw(u, v, z0 + h); GLB.ctr = gw(u, v, z0 - 1); GLB.mat = roofMat(c);
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gtri(gw(u + Math.cos(a) * r, v + Math.sin(a) * r, z0), gw(u + Math.cos(b) * r, v + Math.sin(b) * r, z0), A, c); }
}
const GL_MODEL = {
  well(B, st) { // a stone ring of water under a little roof, with a windlass and a bucket (a pump once the style turns modern)
    const x = GLB.x, z = GLB.y, y = GLB.base;
    if (B.style >= 4) { gBox([x, y, z], [.1, 0, 0], [0, 0, .1], 5 * ZS, '#8c96a3', M_STONE); gBeam([x + .1, y + 4 * ZS, z], [x + .22, y + 4 * ZS, z], .012, '#6c7683'); return; }
    GLB.wall = M_STONE; glCylAt(0, 0, .15, 0, 3.5, '#bdb3a6', '#4f9cbc', 14); GLB.wall = 0;
    for (const s of [-1, 1]) gBeam([x + s * .13, y + 3 * ZS, z], [x + s * .13, y + 9.2 * ZS, z], .012, '#7a5a44', M_PLANK);
    gBeam([x - .15, y + 7.6 * ZS, z], [x + .15, y + 7.6 * ZS, z], .008, '#5f4636', M_PLANK); // the windlass
    if (GLB.lod) { gBeam([x, y + 7.6 * ZS, z], [x, y + 5.4 * ZS, z], .002, '#c9b48a'); gBox([x, y + 4.6 * ZS, z], [.022, 0, 0], [0, 0, .022], 1.6 * ZS, '#6b5040', M_PLANK); } // its rope and bucket
    gRoof([x, 0, z], [.19, 0, 0], [0, 0, .12], y + 9 * ZS, 3.2 * ZS, st.roof, st.wall);
  },
  granary(B, st) { // a round store up on staddle stones (so the rats can't climb in), with a steep roof and a ladder to its door
    const x = GLB.x, z = GLB.y, y = GLB.base, wall = mix(st.wall, '#d9c29a', .4);
    for (const [a, b] of [[-.12, -.12], [.12, -.12], [-.12, .12], [.12, .12]]) gBox([x + a, y, z + b], [.025, 0, 0], [0, 0, .025], 2.2 * ZS, '#a49c90', M_STONE);
    GLB.wall = GLB.B ? glWallMat(GLB.B) : M_PLANK; glCylAt(0, 0, .2, 2.2, 10, wall, wall, 14); GLB.wall = 0;
    gCone(0, 0, .26, 12.2, 8, st.roof);
    gBox([x, y + 2.3 * ZS, z + .198], [.04, 0, 0], [0, 0, .008], 4.2 * ZS, '#5a4a40', M_PLANK); // its door, up off the ground
    if (GLB.lod) for (const s of [-1, 1]) gBeam([x + s * .03, y, z + .34], [x + s * .03, y + 2.6 * ZS, z + .21], .004, '#6b5040', M_PLANK); // and the ladder
  },
  shrine(B, st) { // a stone plinth, a white pillar under a little pointed roof, and a candle burning before it
    const x = GLB.x, z = GLB.y, y = GLB.base;
    gBox([x, y, z], [.28, 0, 0], [0, 0, .28], 1.6 * ZS, '#d6cfc3', M_STONE);
    GLB.wall = M_STONE; gBox([x, y + 1.6 * ZS, z], [.07, 0, 0], [0, 0, .07], 15 * ZS, '#e8e2d6', M_STONE); GLB.wall = 0;
    glPyr(0, 0, 0, 0, .075, .075, 16.6, 4, st.accent);
    gBox([x + .1, y + 1.6 * ZS, z + .22], [.012, 0, 0], [0, 0, .012], .9 * ZS, '#ffd27a', 0, 2); // the candle
    if (GLB.lod) for (let k = 0; k < 3; k++) glBlob(-.16 + k * .1, .24, .03, 1.9, .9, FLOWER_C[(k + B.id) % FLOWER_C.length], 0); // flowers left on the plinth
  },
  watchstone(B, st) { // a tall pale obelisk with a gilded cap and a glowing teal stone set in its face
    const x = GLB.x, z = GLB.y, y = GLB.base;
    gBox([x, y, z], [.3, 0, 0], [0, 0, .3], 2 * ZS, '#d2cabd', M_STONE);
    gBox([x, y + 2 * ZS, z], [.09, 0, 0], [0, 0, .09], 28 * ZS, '#e9e3d8', M_STONE);
    gSpire([x, y + 30 * ZS, z], .095, 6 * ZS, '#d6b85a');
    gBox([x, y + 23 * ZS, z + .092], [.03, 0, 0], [0, 0, .006], .03, '#5fd0c9', 0, 2);
  }
};
function glSheep(X, Z, y0, s, ang, ph = -1) { // a woolly body, a black face and four legs, in world units; ph >= 0: walking
  const f = [Math.cos(ang), 0, Math.sin(ang)], r = [-Math.sin(ang), 0, Math.cos(ang)], u = X - GLB.x, v = Z - GLB.y, zz = (y0 - GLB.base) / ZS;
  for (const [a, b, q] of [[.03, .018, 0], [.03, -.018, Math.PI], [-.03, .018, Math.PI], [-.03, -.018, 0]]) glLimb([X + f[0] * a * s + r[0] * b * s, y0 + 1.1 * s * ZS, Z + f[2] * a * s + r[2] * b * s], f, r, ph >= 0 ? Math.sin(ph + q) * .45 : 0, 1.1 * s * ZS, .007 * s, '#3a3430');
  const ca = f[0], sa = f[2];
  glBlob(u, v, .055 * s, zz + 2 * s, 1.1 * s, '#ece7da', 0); glBlob(u + .015 * ca * s, v + .015 * sa * s, .04 * s, zz + 2.7 * s, .7 * s, '#f6f3ec', 0);
  glBlob(u + .062 * ca * s, v + .062 * sa * s, .02 * s, zz + 2.4 * s + (ph >= 0 ? 0 : Math.sin(GL3.t * .7 + u * 9) * .4 - .3), .65 * s, '#3a3430', 0); // (grazing heads dip)
}
function glNbrs(k) { const a = k % GNC, b = (k / GNC) | 0, o = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && a + dx >= 0 && b + dy >= 0 && a + dx < GNC && b + dy < GNC) o.push((b + dy) * GNC + a + dx); return o; }
function glEdge(k) { // a fingerprint of the chunk's height map near its edges
  const x0 = (k % GNC) * GCH * HFR, z0 = ((k / GNC) | 0) * GCH * HFR, n = GCH * HFR; let h = 0;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) if (i < 20 || j < 20 || i >= n - 20 || j >= n - 20) h = (h * 31 + Math.round(HF[(z0 + j) * HFN + x0 + i] * 20)) | 0;
  return h;
}
function glDirty(i) { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) GL3.dirty.add(((ny / GCH) | 0) * GNC + ((nx / GCH) | 0)); } }

/* ---------- shaders ---------- */
/* ---------- the sky: blue overhead, pale at the horizon, gold and rose round a low sun; the haze takes the same colour ---------- */
const GL_SKY = `
uniform vec3 uSunD; uniform float uSunY, uCover;
vec3 skyCol(vec3 v){ // in screen colour (after the tone curve)
  float day=smoothstep(-.1,.2,uSunY), gold=smoothstep(-.16,.02,uSunY)*(1.-smoothstep(.05,.42,uSunY));
  float mu=dot(v,uSunD), m=max(mu,0.), toward=pow(mu*.5+.5,4.), h=clamp(v.y,0.,1.);
  vec3 zen=mix(vec3(.03,.05,.12),vec3(.27,.49,.83),day), hor=mix(vec3(.07,.09,.17),vec3(.8,.88,.95),day);
  hor=mix(hor,vec3(1.,.6,.34),gold*toward); hor=mix(hor,vec3(.62,.52,.68),gold*(1.-toward)*.45); zen=mix(zen,vec3(.32,.35,.56),gold*.45);
  vec3 c=mix(hor,zen,pow(h,.5)); if(v.y<0.) c=hor*mix(1.,.86,clamp(-v.y*4.,0.,1.));
  c+=vec3(1.,.84,.6)*(pow(m,10.)*.26*(day*.5+gold)+pow(m,900.)*.4*day);
  c=mix(c,vec3(dot(c,vec3(.3,.59,.11)))*mix(.4,1.03,day),uCover*.72);
  return clamp(c,0.,1.);
}
vec3 untone(vec3 c){ return -log(1.-min(c,vec3(.97)))/1.45; }`;
const GL_KVS = `#version 300 es
out vec2 vU; void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); vU=p*2.-1.; gl_Position=vec4(vU,0.,1.); }`;
const GL_KFS = `#version 300 es
precision highp float; in vec2 vU; out vec4 o; uniform vec3 uF, uR, uU; uniform float uCT, uLo;` + GL_SKY + `
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03+3.1)*.27+vn(p*4.1+7.7)*.15+vn(p*8.3+1.3)*.08; }
void main(){
  vec3 v=normalize(uF+vU.x*uR+vU.y*uU), c=skyCol(v); float mu=dot(v,uSunD), day=smoothstep(-.1,.2,uSunY);
  float disc=smoothstep(.99982,.99992,mu)*smoothstep(-.03,.02,uSunY)*(1.-uCover*.8); c=mix(c,vec3(1.,.97,.9),disc);
  vec3 q=v*420., qc=floor(q); float st=fract(sin(dot(qc,vec3(12.9898,78.233,37.719)))*43758.5453); // stars: small round points, out once the sun is well down
  float night=1.-smoothstep(-.2,-.06,uSunY), pt=smoothstep(.34,.08,length(fract(q)-.5));
  c+=vec3(.9,.92,1.)*step(.9975,st)*pt*night*(1.-uCover)*smoothstep(0.,.2,v.y)*(.45+.55*fract(st*97.));
  if(v.y>.01 && uLo<.5){ // clouds on a high layer, drifting; lit gold and rose at sunset, grey and heavy when it's overcast
    vec2 q=v.xz/(v.y+.08)*1.6+vec2(uCT*.004,uCT*.0015); float cl=fb(q), th=mix(.62,.18,uCover), a=smoothstep(th,th+.22,cl)*smoothstep(.01,.12,v.y);
    float sunny=pow(max(mu,0.)*.5+.5,3.), lit=mix(.55,1.,day);
    vec3 cc=mix(vec3(.94,.95,.97)*lit, skyCol(normalize(vec3(v.x,.02,v.z)))*1.1, .35+.3*(1.-day)); cc=mix(cc, cc*vec3(.62,.64,.7), uCover*.8*(1.-sunny*.4)); cc+=vec3(1.,.8,.55)*sunny*.25*day*(1.-uCover);
    c=mix(c, cc, a*.92); disc*=1.-a;
  }
  o=vec4(c, disc*.5); // (only the disc itself glows: a glow over a wide patch of bright sky blooms into a blinding blob)
}`;
const GL_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in float aE; layout(location=4) in float aI; layout(location=5) in float aM; layout(location=6) in float aO;
uniform mat4 uVP, uSVP; uniform float uPk; out vec3 vP, vN, vC; out float vE, vO; out vec4 vS; flat out float vI, vM;
void main(){ vP=aP; vN=aN; vC=aC; vE = uPk>.5 ? (aE<.5 ? -1. : aE<1.5 ? 0. : aE>254.5 ? 2. : (aE-2.)/250.) : aE; // (chunks are packed into bytes)
  vI=aI; vM=aM; vO=aO; vS=uSVP*vec4(aP+aN*.02,1.); gl_Position=uVP*vec4(aP,1.); }`;
const GL_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vP, vN, vC; in float vE, vO; in vec4 vS; flat in float vI, vM; out vec4 o;
uniform highp sampler2DArray uTex; uniform vec3 uAvg[20]; uniform float uTS[20], uRaw[20];
uniform float uHi, uFog0, uFogL; uniform vec3 uFogC; uniform vec3 uSun, uSunC, uSky, uGnd, uWin, uLamp, uEye; uniform float uLit, uShK, uT;
uniform sampler2DShadow uSh; uniform int uNL; uniform vec3 uLP[64]; uniform vec4 uSea; uniform vec3 uWx; uniform float uLo; // autumn, winter, spring, snow on the ground; rain, cloud cover, lightning` + GL_SKY + `
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.55+vn(p*2.1+7.3)*.3+vn(p*4.3+1.7)*.15; }
float shadow(){ vec3 p=vS.xyz/vS.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.) return 1.; float s=0.; vec2 d=vec2(1./2048.);
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uSh, vec3(p.xy+vec2(x,y)*d*1.2, p.z-.0015)); return s/9.; }
void main(){
  vec3 n=normalize(vN), c=vC; float glow=0.;
  int m=int(vM+.5);
  if(m>0){ // triplanar: the ground and roofs take the texture from above, walls from the side they face
    vec3 a=abs(n); vec2 uv = a.y>.55 ? vP.xz : (a.x>a.z ? vec2(vP.z,-vP.y) : vec2(vP.x,-vP.y));
    vec3 t=texture(uTex, vec3(uv*uTS[m], float(m))).rgb;
    c=mix(c*t/uAvg[m], t, uRaw[m]);
  }
  // the season, painted live: autumn leaves turn, winter fades them, spring puts blossom in some trees, grass follows
  float sn=0.;
  if(vE>=-.5 && !(vE>0.&&vE<1.) && vE<1.5){
    float nz=h21(floor(vP.xz*2.3)), lum=dot(c,vec3(.3,.59,.11));
    if(m==5){
      vec3 au=mix(mix(vec3(.86,.42,.12),vec3(.93,.72,.18),nz),vec3(.72,.2,.12),step(.8,nz));
      c=mix(c, au*(.6+lum*.9), uSea.x*.85);
      c=mix(c, vec3(.44,.38,.3)*(.7+lum), uSea.y*.55);
      float bl=step(.5,nz)*smoothstep(.3,.5,vn(vP.xz*38.+vP.y*27.)); c=mix(c, mix(vec3(1.,.72,.84),vec3(.99,.97,.95),step(.78,nz)), uSea.z*bl); c=mix(c, c*vec3(.95,1.08,.9)+vec3(.04,.06,0.), uSea.z*(1.-bl)*.6); // blossom on some, fresh green on the rest
    }
    if(m==1||m==14){ c=mix(c, vec3(.62,.56,.32)*(.6+lum), uSea.x*.35+uSea.y*.3); }
    // snow settles on what faces up (less on leaves, none on walls), patchy at the edges
    if(uSea.w>0.){ sn=smoothstep(.3,.75,n.y)*uSea.w*(m==5||m==18?.7:1.)*(uLo>.5 ? 1. : smoothstep(.2,.55,fb(vP.xz*3.)+uSea.w*.6)); c=mix(c, vec3(.93,.95,.99), sn); }
  }
  if(vE<-.5 && n.y>.5){ // water: ripples that move, a deeper colour, and the sun's glint
    vec2 q=vP.xz; n=normalize(vec3(sin(q.x*9.+uT*1.3)*.06+sin(q.y*13.7-uT*1.7)*.04+sin((q.x+q.y)*21.-uT*2.3)*.025, 1., cos(q.y*8.3+uT*1.1)*.06+cos((q.x-q.y)*17.+uT*1.9)*.03));
    vec3 v=normalize(uEye-vP), h=normalize(uSun+v); float sp=pow(max(dot(n,h),0.),120.);
    vec3 rf=reflect(-v,n); rf.y=abs(rf.y); c=mix(c*vec3(.72,.86,.92), untone(skyCol(rf))*.8, .35*(1.-max(dot(n,v),0.))); c+=vec3(1.,.95,.85)*sp*2.2*uShK; glow=min(.45,sp*.7)*uShK; }
  float cs=uWx.y>.05 && uLo<.5 ? smoothstep(.62-.4*uWx.y,.82-.4*uWx.y,fb(vP.xz*.05+vec2(uT*.012,uT*.005))) : 0.; // clouds drifting over, their shadows on the land
  float nd=(m==5||m==18) ? clamp(dot(n,uSun)*.55+.45,0.,1.) : max(dot(n,uSun),0.), sh=mix(1., shadow(), uShK); // leaves let light through, so it wraps round to their shady side
  float ao=vE<-.5?1.:clamp(vO,0.,1.); ao=ao*ao*(3.-2.*ao); if(m==5||m==18) ao=.35+.65*ao; // how much open sky this spot sees (baked per vertex)
  vec3 amb=mix(uGnd,uSky,n.y*.5+.5)*ao;
  vec3 bounce=uSunC*.22*max(dot(n,normalize(vec3(-uSun.x,.35,-uSun.z))),0.)*(.4+.6*ao); // light thrown back off the sunny side of things
  sh*=1.-cs*.7*min(1.,uWx.y*1.8);
  if(uWx.x>0. && vE>=-.5 && n.y>.5) c*=1.-.28*uWx.x*(1.-sn); // wet ground is darker
  vec3 lit=c*(amb+uSunC*nd*sh*mix(.8,1.,ao)+bounce);
  if(uWx.x>0. && uLo<.5 && vE>=-.5 && n.y>.6 && sn<.5){ vec3 v2=normalize(uEye-vP), rf2=reflect(-v2,n); rf2.y=abs(rf2.y); lit+=untone(skyCol(rf2))*.22*uWx.x*pow(1.-max(dot(n,v2),0.),2.)*step(.45,vn(vP.xz*6.)); } // puddles catch the sky
  lit+=vec3(.75,.8,1.)*uWx.z*.9; // lightning
  vec3 pl=vec3(0.);
  for(int i=0;i<64;i++){ if(i>=uNL) break; vec3 d=uLP[i]-vP; float l=length(d); float a=max(0.,1.-l/2.4); pl+=uLamp*a*a*(.35+.65*max(dot(n,d/l),0.)); }
  lit+=c*pl*mix(.55,1.,ao);
  if(vE>0. && vE<1.){ if(vE<uLit){ lit=mix(lit, uWin*(.9+.2*fract(vE*37.)), .92); glow=.45; } }
  else if(vE>.45 && vE<.55 && uLit>0.){ lit=mix(lit,uWin,.8*min(1.,uLit*2.)); glow=.3; }
  if(vE>1.5){ lit=mix(c, uLamp*1.4, uLit>0.?1.:0.); glow=uLit>0.?1.:0.; }
  if(uHi>0. && abs(vI-uHi)<.5) lit=mix(lit*1.2, vec3(1.,.84,.5), .28+.08*sin(uT*5.)); // what the pointer is on glows softly
  if(uFogL>0.){ vec3 fv=normalize(vP-uEye); fv.y=max(fv.y,0.); float f=1.-exp(-max(0.,length(vP-uEye)-uFog0)/uFogL*1.3); float d=length(vP-uEye)-uFog0; lit=mix(lit, untone(skyCol(normalize(fv))), min(f, mix(.62,1.,smoothstep(uFogL*1.2,uFogL*4.,d)))); glow*=1.-f; } // the far side of the valley fades into the haze, the colour of the sky behind it
  lit=1.-exp(-lit*1.45); // a soft tone curve that keeps the colour
  float g=dot(lit,vec3(.299,.587,.114)); lit=clamp(mix(vec3(g),lit,1.18),0.,1.);
  o=vec4(lit,glow);
}`;
/* ---------- smoke: soft puffs from chimney pots and works, drawn as point sprites that grow, drift and fade ---------- */
const GL_SMVS = `#version 300 es
layout(location=0) in vec4 aP; layout(location=1) in vec2 aA; uniform mat4 uVP; uniform float uPx, uMax; out float vA, vS;
void main(){ gl_Position=uVP*vec4(aP.xyz,1.); gl_PointSize=clamp(aP.w*uPx/gl_Position.w,1.,uMax); vA=aA.x; vS=aA.y; }`;
const GL_SMFS = `#version 300 es
precision mediump float; in float vA, vS; out vec4 o; uniform vec3 uCol;
void main(){ vec2 d=gl_PointCoord-.5; float r=length(d)*2.; if(r>1.) discard; float a=vA*(1.-smoothstep(.15,1.,r))*(.8+.2*sin(d.x*9.+d.y*7.)); o=vec4(uCol*vS*(1.-.12*d.y),a); }`;
const SMOKE_AT = { workshop: [[.16, -.14, 21]], works: [[.28, -.18, 43]], power: [[-.16, -.2, 37], [.16, -.2, 37]], glassworks: [[.2, -.16, 24]] };
function glSmoke(gl, dt, FR, VP, pxs, day, tgt) {
  GL3.smF = [FR, day, tgt]; const A = glSmokeStep(Math.min(dt, .25)), n = A.n; if (!n) return;
  const Q = GL3.smp; for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
  gl.useProgram(Q.p); gl.uniformMatrix4fv(Q.u.uVP, false, VP); gl.uniform1f(Q.u.uPx, pxs); gl.uniform1f(Q.u.uMax, GL3.ptMax || 64);
  gl.uniform3fv(Q.u.uCol, [.86, .85, .84].map(v => v * (.35 + .65 * day)));
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.smB); gl.bufferData(gl.ARRAY_BUFFER, A.a.subarray(0, n), gl.STREAM_DRAW);
  gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0); gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
  gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false);
  gl.drawArrays(gl.POINTS, 0, n / 6);
  gl.depthMask(true); gl.disable(gl.BLEND); gl.disableVertexAttribArray(0); gl.disableVertexAttribArray(1);
}
function glSmokeStep(dt) { // new puffs from what's in view, then everyone rises, drifts and grows
  const [FR, day, tgt] = GL3.smF, P = GL3.smoke || (GL3.smoke = []), cap = GL3.lo ? 320 : 900, sea = LIGHT.season || seasonNow(), rate = .22 + .55 * sea.winter + .2 * sea.autumn + .15 * (1 - day), wind = [.07, 0, .04];
  if (!FAST && dt > 0) {
    const ks = []; for (let k = 0; k < GL3.chunks.length; k++) { const ch = GL3.chunks[k], sm = ch.lamps && ch.lamps.smk, d = Math.hypot((k % GNC) * GCH + 4 - tgt[0], ((k / GNC) | 0) * GCH + 4 - tgt[2]); if (sm && sm.length && d < 16 && glSees(FR, ch, k)) ks.push([d, sm]); }
    ks.sort((a, b) => a[0] - b[0]); // the nearest chimneys first (far off, a puff is less than a pixel)
    for (const [, sm] of ks) for (const q of sm) if (P.length < cap && Math.random() < rate * dt) P.push({ x: q[0], y: q[1], z: q[2], a: 0, L: 6 + Math.random() * 3, s0: .09, s1: .6, o: .72 });
    for (const B of DYN.anim || []) { const at = SMOKE_AT[B.type]; if (!at || P.length >= cap || Math.hypot(B.x - tgt[0], B.y - tgt[2]) > 40) continue; // the works smoke hard
      const soot = sootK() >= .5 && !hasTech('solar'), b = surfZ(idx(B.x, B.y)) * ZS;
      for (const [u, v, z] of at) if (Math.random() < 2.2 * dt) P.push({ x: B.x + u, y: b + z * ZS, z: B.y + v, a: 0, L: 7 + Math.random() * 4, s0: .16, s1: 1.1, o: soot ? .8 : .6, sh: soot ? .6 : .92 }); }
  }
  let n = 0; const A = GL3.smA && GL3.smA.length >= P.length * 6 ? GL3.smA : (GL3.smA = new Float32Array(Math.max(1024, P.length * 6 * 2)));
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; p.a += dt; if (p.a >= p.L) { P[i] = P[P.length - 1]; P.pop(); continue; }
    const t = p.a / p.L; p.x += (wind[0] * (.4 + t) + (Math.random() - .5) * .02) * dt; p.z += (wind[2] * (.4 + t)) * dt; p.y += (.16 - .1 * t) * dt;
    A[n++] = p.x; A[n++] = p.y; A[n++] = p.z; A[n++] = p.s0 + (p.s1 - p.s0) * Math.sqrt(t); A[n++] = p.o * Math.min(1, t * 5) * Math.pow(1 - t, 1.6); A[n++] = p.sh || 1; } // (sh: how dark: soot and burning roofs)
  return { a: A, n };
}
/* ---------- rain and snow, a screen-space pass over the view: three layers, the nearest biggest ---------- */
const GL_PFS2 = `#version 300 es
precision highp float; in vec2 vU; out vec4 o; uniform float uT, uRain, uSnow, uAsp, uYaw; uniform vec3 uCol;
float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){ vec2 uv=vU*.5+.5; uv.x*=uAsp; uv.x+=uYaw*.35; float a=0.;
  for(int L=0;L<3;L++){ float fl=float(L), sc=mix(1.,2.6,fl/2.);
    if(uRain>0.){ vec2 q=vec2(uv.x*60.*sc+uv.y*6., uv.y*3.*sc+uT*(9.+fl*3.)); vec2 id=floor(q), f=fract(q); float r=h(id); float d=smoothstep(.08,0.,abs(f.x-.5-(r-.5)*.4))*smoothstep(0.,.1,f.y)*smoothstep(1.,.55,f.y)*step(1.-uRain*.35,r); a+=d*(.28-fl*.06); }
    if(uSnow>0.){ vec2 q=vec2(uv.x*14.*sc+sin(uT*.6+uv.y*6.+fl)*.3, uv.y*14.*sc+uT*(.9+fl*.4)); vec2 id=floor(q), f=fract(q); float r=h(id+fl*17.); vec2 c=vec2(.2+.6*h(id+3.1),.2+.6*r); float d=smoothstep(.09/sc*2.,0.,length(f-c))*step(1.-uSnow*.6,h(id+9.7)); a+=d*(.75-fl*.15); } }
  o=vec4(uCol, clamp(a,0.,1.)); }`;
/* ---------- bloom: the glowing things (alpha of the lit view) bleed soft light around themselves ---------- */
const GL_BFS = `#version 300 es
precision highp float; in vec2 vU; out vec4 o; uniform sampler2D uA, uB; uniform vec2 uPx; uniform int uMode; uniform float uK;
void main(){ vec2 uv=vU*.5+.5;
  if(uMode==0){ vec4 s=vec4(0.); for(int i=0;i<4;i++){ vec4 t=texture(uA,uv+uPx*vec2((i&1)==1?1.:-1.,i>1?1.:-1.)); s+=vec4(t.rgb*t.a,1.); } o=vec4(s.rgb/4.,1.); }
  else if(uMode==1){ vec3 s=texture(uA,uv).rgb*.5; for(int i=0;i<4;i++) s+=texture(uA,uv+uPx*vec2((i&1)==1?1.:-1.,i>1?1.:-1.)).rgb*.125; o=vec4(s,1.); }
  else if(uMode==2){ vec3 s=vec3(0.); for(int y=-1;y<=1;y++) for(int x=-1;x<=1;x++) s+=texture(uA,uv+uPx*vec2(x,y)).rgb*float((2-abs(x))*(2-abs(y)))/16.; o=vec4(s*uK,1.); }
  else { o=vec4(texture(uA,uv).rgb+texture(uB,uv).rgb*uK,1.); }
}`;
function glSoft(gl) { // drawn by the CPU (no graphics card, a VM, remote desktop): multisampling there costs every pixel four times
  try { const d = gl.getExtension('WEBGL_debug_renderer_info'), r = d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); return /swiftshader|llvmpipe|software|softpipe|basic render/i.test(r || ''); } catch (e) { return false; }
}
function glPostSize(gl, w, h) { // the multisampled view, its resolved copy, and the bloom chain (half size down to 1/32)
  const P = GL3.post; if (P.w === w && P.h === h) return; P.w = w; P.h = h;
  const fmt = P.hdr ? gl.RGBA16F : gl.RGBA8, typ = P.hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;
  gl.bindRenderbuffer(gl.RENDERBUFFER, P.msC); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, P.ns, gl.RGBA8, w, h);
  gl.bindRenderbuffer(gl.RENDERBUFFER, P.msD); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, P.ns, gl.DEPTH_COMPONENT24, w, h);
  gl.bindFramebuffer(gl.FRAMEBUFFER, P.msF); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, P.msC); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, P.msD);
  const tex = (tw, th, f, t) => { const o = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, o); gl.texImage2D(gl.TEXTURE_2D, 0, f, tw, th, 0, gl.RGBA, t, null); for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v); return o; };
  const fb = t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; };
  for (const o of [P.rsT, ...P.lv.map(l => l.t)]) if (o) gl.deleteTexture(o); for (const o of [P.rsF, ...P.lv.map(l => l.f)]) if (o) gl.deleteFramebuffer(o);
  P.rsT = tex(w, h, gl.RGBA8, gl.UNSIGNED_BYTE); P.rsF = fb(P.rsT); P.lv = [];
  for (let k = 1; k <= 5; k++) { const lw = Math.max(1, w >> k), lh = Math.max(1, h >> k), t = tex(lw, lh, fmt, typ); P.lv.push({ t, f: fb(t), w: lw, h: lh }); }
  P.ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, P.msF); P.ok = P.ok && gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}
function glBloom(gl, w, h, k) {
  const P = GL3.post, B = P.pr, U = B.u; gl.bindFramebuffer(gl.READ_FRAMEBUFFER, P.msF); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, P.rsF); gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); // last frame's glow is still bound here: drawing into it would be a feedback loop, and WebGL silently skips the draw
  gl.disable(gl.DEPTH_TEST); gl.useProgram(B.p); gl.uniform1i(U.uA, 0); gl.uniform1i(U.uB, 1); gl.activeTexture(gl.TEXTURE0);
  const pass = (src, sw, sh, dst, mode, kk = 1) => { gl.bindFramebuffer(gl.FRAMEBUFFER, dst.f); gl.viewport(0, 0, dst.w, dst.h); gl.bindTexture(gl.TEXTURE_2D, src); gl.uniform2f(U.uPx, 1 / sw, 1 / sh); gl.uniform1i(U.uMode, mode); gl.uniform1f(U.uK, kk); gl.drawArrays(gl.TRIANGLES, 0, 3); };
  pass(P.rsT, w, h, P.lv[0], 0);
  for (let i = 1; i < P.lv.length; i++) pass(P.lv[i - 1].t, P.lv[i - 1].w, P.lv[i - 1].h, P.lv[i], 1);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = P.lv.length - 1; i > 0; i--) pass(P.lv[i].t, P.lv[i].w, P.lv[i].h, P.lv[i - 1], 2, .75); // the widest levels fade, so a glow is soft round the edges, not a wide blob
  gl.disable(gl.BLEND);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, P.lv[0].t); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, P.rsT);
  gl.uniform1i(U.uMode, 3); gl.uniform1f(U.uK, k); gl.drawArrays(gl.TRIANGLES, 0, 3);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, null);
  gl.enable(gl.DEPTH_TEST);
}
const GL_SVS = `#version 300 es
layout(location=0) in vec3 aP; uniform mat4 uSVP; void main(){ gl_Position=uSVP*vec4(aP,1.); }`;
const GL_SFS = `#version 300 es
precision mediump float; void main(){}`;
const GL_PVS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=4) in float aI; uniform mat4 uVP; flat out float vI; void main(){ vI=aI; gl_Position=uVP*vec4(aP,1.); }`;
const GL_PFS = `#version 300 es
precision highp float; flat in float vI; out vec4 o;
void main(){ float i=vI; o=vec4(mod(i,256.)/255., mod(floor(i/256.),256.)/255., floor(i/65536.)/255., 1.); }`;
function glProg(gl, vs, fs) {
  const mk = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
  const p = gl.createProgram(); gl.attachShader(p, mk(gl.VERTEX_SHADER, vs)); gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
  const u = {}; for (let k = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); k < n; k++) { const a = gl.getActiveUniform(p, k), nm = a.name.replace('[0]', ''); u[nm] = gl.getUniformLocation(p, a.name); }
  return { p, u };
}

/* ---------- matrices (column-major) ---------- */
function m4mul(a, b) { const o = new Float32Array(16); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k]; o[c * 4 + r] = s; } return o; }
function m4persp(fy, a, n, f) { const o = new Float32Array(16), t = 1 / Math.tan(fy / 2); o[0] = t / a; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f); return o; }
function m4ortho(l, r, b, t, n, f) { const o = new Float32Array(16); o[0] = 2 / (r - l); o[5] = 2 / (t - b); o[10] = -2 / (f - n); o[12] = -(r + l) / (r - l); o[13] = -(t + b) / (t - b); o[14] = -(f + n) / (f - n); o[15] = 1; return o; }
function m4look(e, t, up) {
  let zx = e[0] - t[0], zy = e[1] - t[1], zz = e[2] - t[2], l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l;
  let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx; l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0, -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1]);
}

/* ---------- start, and each frame ---------- */
function glInit() {
  const c = document.createElement('canvas'); c.id = 'gl3'; c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block;touch-action:none';
  const gl = c.getContext('webgl2', { antialias: false, alpha: false }); // (smoothing comes from the multisampled view below)
  if (!gl) { toast('This browser has no WebGL2, so the 3D view can’t run here. Here’s the 2D one.'); return false; }
  $('view').style.display = 'none'; document.body.insertBefore(c, $('view'));
  GL3.c = c; GL3.gl = gl; GL3.on = true;
  GL3.main = glProg(gl, GL_VS, GL_FS); GL3.sky = glProg(gl, GL_KVS, GL_KFS); GL3.prc = glProg(gl, GL_KVS, GL_PFS2);
  GL3.smp = glProg(gl, GL_SMVS, GL_SMFS); GL3.smB = gl.createBuffer(); GL3.ptMax = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64;
  try { GL3.post = { pr: glProg(gl, GL_KVS, GL_BFS), msF: gl.createFramebuffer(), msC: gl.createRenderbuffer(), msD: gl.createRenderbuffer(), ns: (GL3.lo = glSoft(gl) || QS.has('lo')) ? 0 : Math.min(4, gl.getParameter(gl.MAX_SAMPLES)), hdr: !!gl.getExtension('EXT_color_buffer_float'), lv: [], w: 0, h: 0 }; } catch (e) { GL3.post = null; }
  GL3.sh = glProg(gl, GL_SVS, GL_SFS); GL3.pk = glProg(gl, GL_PVS, GL_PFS);
  { const t0 = performance.now(), T = glTextures(); GL3.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D_ARRAY, GL3.tex);
    gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, TX.N, TX.N, TX.L, 0, gl.RGBA, gl.UNSIGNED_BYTE, T.data); gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const af = gl.getExtension('EXT_texture_filter_anisotropic'); if (af) gl.texParameterf(gl.TEXTURE_2D_ARRAY, af.TEXTURE_MAX_ANISOTROPY_EXT, 8); // crisp at a slant
    GL3.texAvg = T.avg; GL3.texMs = Math.round(performance.now() - t0); }
  GL3.pkF = gl.createFramebuffer(); GL3.pkC = gl.createRenderbuffer(); GL3.pkD = gl.createRenderbuffer(); GL3.pkW = 0; GL3.pkH = 0;
  GL3.shT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, GL3.shT);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 2048, 2048);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  GL3.shF = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.shF); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, GL3.shT, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  GL3.dyn = gl.createBuffer();
  { // the open sea round the valley, out to the horizon
    const y = SEAZ * ZS - .012, c = gcol('#3f8fb4'), R = 420, q = [[-R, -R], [-R, W + R], [W + R, W + R], [-R, -R], [W + R, W + R], [W + R, -R]], a = [];
    for (const [x, z] of q) a.push(x, y, z, 0, 1, 0, c[0], c[1], c[2], -1, 0, 0, 1);
    GL3.sea = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, GL3.sea); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(a), gl.STATIC_DRAW); }
  for (let k = 0; k < GNC * GNC; k++) { GL3.chunks[k] = { buf: gl.createBuffer(), n: 0, lamps: [] }; GL3.dirty.add(k); }
  // looking round: drag to turn, wheel to zoom; R, N and T for rotation, time of day and the next town
  // mouse: drag turns, a click acts. Touch: one finger turns, two fingers pinch to zoom and move to pan, a tap shows what's there
  const P = GL3.ptrs = new Map(); let pinch = null;
  const touchy = e => e.pointerType === 'touch' || e.pointerType === 'pen';
  c.addEventListener('pointerdown', e => {
    glTouch();
    if (e.button !== 0 && !touchy(e)) return;
    GL3.touched = touchy(e);
    UI.lastMove = performance.now(); UI.mouse.x = e.clientX; UI.mouse.y = e.clientY;
    P.set(e.pointerId, [e.clientX, e.clientY]); try { c.setPointerCapture(e.pointerId); } catch (er) { }
    if (P.size === 1) GL3.drag = [e.clientX, e.clientY, GL3.cam.yaw, GL3.cam.pitch, false, touchy(e)];
    else { GL3.drag = null; const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: GL3.cam.zoom, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tx: GL3.cam.tx, tz: GL3.cam.tz }; glTouch(); GL3.follow = null; GL3.goto = null; }
  });
  c.addEventListener('pointermove', e => {
    UI.lastMove = performance.now(); if (!touchy(e) || P.size < 2) { UI.mouse.x = e.clientX; UI.mouse.y = e.clientY; }
    GL3.pickReq = !touchy(e); if (P.has(e.pointerId)) P.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && P.size >= 2) { // zoom by the spread of the fingers, pan by where their middle goes
      const [a, b] = [...P.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      GL3.cam.zoom = clamp(pinch.z * pinch.d / Math.max(20, d), 1.2, 44);
      const k = GL3.cam.zoom * 2 / innerHeight, dx = (m[0] - pinch.m[0]) * k, dy = (m[1] - pinch.m[1]) * k / Math.sin(GL3.cam.pitch), cy = Math.cos(GL3.cam.yaw), sy = Math.sin(GL3.cam.yaw);
      GL3.cam.tx = pinch.tx - dx * cy - dy * sy; GL3.cam.tz = pinch.tz + dx * sy - dy * cy;
      return;
    }
    const d = GL3.drag; if (!d) return;
    if (!d[4] && Math.abs(e.clientX - d[0]) + Math.abs(e.clientY - d[1]) > (d[5] ? 10 : 4)) { d[4] = true; glTouch(); }
    if (d[4]) { GL3.cam.yaw = d[2] - (e.clientX - d[0]) * .006; GL3.cam.pitch = clamp(d[3] + (e.clientY - d[1]) * .004, GL3.cam.persp ? .1 : .2, 1.45); }
  });
  const up = e => {
    P.delete(e.pointerId); if (P.size < 2) pinch = null;
    const d = GL3.drag; GL3.drag = null;
    if (e.type === 'pointerup' && d && !d[4]) { if (d[5]) { GL3.tapAt = [e.clientX, e.clientY]; GL3.pickReq = true; GL3.pickT = 0; } else glClick(e.clientX, e.clientY); } // a tap waits for the pick under the finger
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('pointerleave', e => { if (!touchy(e)) { GL3.hover = 0; $('tip').style.opacity = 0; } });
  c.addEventListener('wheel', e => { glTouch(); GL3.cam.zoom = clamp(GL3.cam.zoom * Math.exp(e.deltaY * .001), 1.2, 44); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'r') { GL3.cam.auto = !GL3.cam.auto; GL3.film = GL3.cam.auto; if (!GL3.cam.auto) glCap(null); toast(GL3.cam.auto ? 'Film camera on: it wanders to wherever something is happening' : 'Film camera off'); }
    else if ('ntp'.includes(k)) glTouch();
    else if (k === 'n') { GL3.hi = (GL3.hi + 1) % GL3.hr.length; SF.hour(GL3.hr[GL3.hi]); toast(GL3.hr[GL3.hi] == null ? 'Time of day: live' : `Time of day: ${Math.floor(GL3.hr[GL3.hi])}:${String(Math.round(GL3.hr[GL3.hi] % 1 * 60)).padStart(2, '0')}`); }
    else if (k === 'p') { GL3.cam.persp = !GL3.cam.persp; if (!GL3.cam.persp) GL3.cam.pitch = Math.max(.2, GL3.cam.pitch); toast(GL3.cam.persp ? 'Perspective view' : 'Isometric view'); }
    else if (k === 't') { GL3.town++; GL3.follow = null; GL3.goto = null; glFocusTown(); }
  });
  const hint = document.createElement('div'); hint.id = 'glHint';
  hint.style.cssText = 'position:fixed;right:16px;top:14px;max-width:430px;line-height:1.45;z-index:4;padding:8px 12px;border-radius:12px;background:rgba(255,251,245,.82);box-shadow:0 4px 18px rgba(60,40,60,.15);font:12.5px "Segoe UI",system-ui,sans-serif;color:#2b2833';
  hint.innerHTML = (matchMedia('(pointer: coarse)').matches ? '<b>3D view</b> · drag to turn · pinch to zoom · two fingers to move · tap anything to see what it is' : '<b>3D view</b> · drag to turn · wheel to zoom · <b>R</b> film camera · <b>N</b> time of day · <b>T</b> next town · <b>P</b> perspective or isometric · point at anything to see what it is, click a person to follow them') + ' <span id="glHideHint" style="cursor:pointer;opacity:.6">✕</span>';
  hint.querySelector('#glHideHint').onclick = () => hint.remove();
  if (innerWidth < 700) { hint.style.cssText += ';top:auto;right:12px;left:12px;bottom:150px;max-width:none;font-size:12px'; setTimeout(() => hint.remove(), 15000); } // phones: above the tool bar, and not for long
  document.body.appendChild(hint);
  glFocusTown();
  return true;
}
function glFocusTown() { const ts = towns().sort((a, b) => b.pop - a.pop); if (!ts.length) return; const T = ts[GL3.town % ts.length]; GL3.cam.tx = T.x; GL3.cam.tz = T.y; GL3.cam.ty = surfZ(idx(T.x, T.y)) * ZS; GL3.cam.zoom = clamp(townRadius(T) * .75 + 2.5, 5, 14); }
/* ---------- the film camera: when nobody's touching it, it goes wherever something is happening ---------- */
// Shots last 20-35 s: news from the chronicle first (a new landmark, a ship launched, a wedding), then ships coming in,
// a townsperson on their way, a train, a landmark close up, a town from above. It eases between them and turns slowly
// round what it's looking at, with a caption. Any touch hands the camera back; a minute later the film carries on.
const FILM_IDLE = 60, INC_CAP = { fire: '🔥 Fire', sheep: '🐑 Sheep loose', wedding: '💒 A wedding', flood: '🌊 Flood', cart: '🥬 A runaway cart', whale: '🐋 A whale on the beach' };
GL3.incSeen = new Set();
EV.on('incident', d => { if (!d.end && GL3.shot) GL3.shot.t0 = -1e9; }); // the film camera cuts to it
function glTouch() { GL3.lastIn = performance.now(); if (GL3.shot) { GL3.shot = null; glCap(null); } }
function glCap(t, sub) {
  let e = $('glCap');
  if (!t) { if (e) e.style.opacity = 0; return; }
  if (!e) { e = document.createElement('div'); e.id = 'glCap'; e.style.cssText = 'position:fixed;left:50%;bottom:34px;transform:translateX(-50%);max-width:min(640px,80vw);z-index:4;padding:9px 18px;border-radius:14px;background:rgba(20,22,30,.5);backdrop-filter:blur(6px);color:#fff;font:15px/1.4 Georgia,"Times New Roman",serif;text-align:center;text-shadow:0 1px 3px rgba(0,0,0,.4);transition:opacity 1.2s;opacity:0;pointer-events:none'; document.body.appendChild(e); }
  e.innerHTML = t + (sub ? `<div style="font:12px/1.4 'Segoe UI',system-ui,sans-serif;opacity:.75;margin-top:2px">${sub}</div>` : ''); requestAnimationFrame(() => { e.style.opacity = 1; });
}
function glShot() { // choose what to look at next
  const T0 = towns(); if (!T0.length) return null;
  const seen = GL3.seenN || 0, news = (S.chron || []).filter(e => e.n > seen && e.tx != null && e.yr >= yr() - 3).slice(-12); GL3.seenN = S.chronN;
  const pick1 = a => a[(Math.random() * a.length) | 0];
  const major = news.filter(e => e.k === 'major' || e.k === 'era'), ev = major.length ? major[major.length - 1] : news.length && chance(.7) ? pick1(news) : null;
  const z = (x, y) => surfZ(idx(clamp(Math.round(x), 0, W - 1), clamp(Math.round(y), 0, H - 1))) * ZS;
  const inc = (S.inc || []).find(I => !GL3.incSeen.has(I.id)) || ((S.inc || []).length && chance(.5) ? pick1(S.inc) : null); // an incident beats everything, and gets a second look now and then
  if (inc) { GL3.incSeen.add(inc.id); const T = S.T[inc.sid]; return { at: () => { const v = INCV.get(inc.id), x = v && v.fx != null ? v.fx : inc.x, y = v && v.fx != null ? v.fz : inc.y; return [x, z(x, y), y]; }, zoom: rf(2.2, 3), pitch: rf(.3, .42), cap: (INC_CAP[inc.k] || '') + (T ? ' in ' + T.name : ''), dur: 30 }; }
  if (ev) return { at: () => [ev.tx, z(ev.tx, ev.ty), ev.ty], zoom: rf(2.6, 4), pitch: rf(.34, .5), cap: ev.ic + ' ' + ev.t, sub: 'Year ' + Math.floor(ev.yr) };
  const opts = [];
  const sail = DYN.ships.filter(sh => sh.st === 'sail' && sh.to && sh.path && sh.s > sh.path.length - 14 && sh.s < sh.path.length - 3);
  if (sail.length) opts.push([3, () => { const sh = pick1(sail), B = S.B[sh.to], T = B && S.T[B.sid]; return { at: () => { const q = shipPos(sh); return q ? [q[0], SEAZ * ZS, q[1]] : null; }, zoom: rf(2.2, 3), pitch: rf(.2, .32), cap: '⛵ A ship coming in' + (T ? ' to ' + T.name : ''), dur: 26 }; }]);
  const ws = DYN.walkers.filter(w => w.pid && S.P[w.pid] && w.st !== 'in' && w.st !== 'idle' && walkerPos(w));
  if (ws.length) opts.push([3, () => { const w = pick1(ws), P = S.P[w.pid], T = S.T[P.sid]; return { follow: w, at: () => { const q = walkerPos(w); return q ? [q[0], q[2] * ZS, q[1]] : null; }, zoom: rf(1.4, 2), pitch: rf(.3, .42), cap: P.name, sub: [P.role, T && T.name].filter(Boolean).join(' · ') }; }]);
  if (DYN.trains.length) opts.push([1.5, () => { const tr = pick1(DYN.trains); return { at: () => { const pa = tr.r.path, s2 = clamp(tr.s, 0, pa.length - 1), a = pa[Math.floor(s2)]; return a == null ? null : [a % W, z(a % W, (a / W) | 0), (a / W) | 0]; }, zoom: rf(2.8, 4), pitch: rf(.3, .45), cap: '🚂 The train' }; }]);
  const big = Object.values(S.B).filter(B => fpBig(B) && B.prog >= 1);
  if (big.length) opts.push([2, () => { const B = pick1(big), T = S.T[B.sid], [x, y] = glLot(B); return { at: () => [x, z(x, y), y], zoom: rf(2, 3), pitch: rf(.35, .55), cap: (B.name || (BT[B.type] ? BT[B.type].n : B.type)) + (T ? ' · ' + T.name : '') }; }]);
  opts.push([2, () => { const T = pick1(T0.slice().sort((a, b) => b.pop - a.pop).slice(0, 4)); return { at: () => [T.x, z(T.x, T.y), T.y], zoom: clamp(townRadius(T) * .8 + 3, 5, 14), pitch: rf(.4, .75), cap: T.name, sub: Math.round(T.pop).toLocaleString('en-GB') + ' people' }; }]);
  const hs = harbours(); const sun = LIGHT.sun;
  if (hs.length && sun && sun.el > -2 && sun.el < 14) opts.push([4, () => { const B = pick1(hs), [x, y] = glLot(B), T = S.T[B.sid]; return { at: () => [x + B.dir[0] * .6, z(x, y), y + B.dir[1] * .6], zoom: rf(2.5, 3.5), pitch: rf(.18, .3), cap: '🌇 Evening at the harbour' + (T ? ' of ' + T.name : ''), yaw: Math.atan2(-B.dir[0], -B.dir[1]) }; }]); // golden hour by the water
  let tot = 0; for (const o of opts) tot += o[0]; let r = Math.random() * tot; for (const o of opts) if ((r -= o[0]) <= 0) return o[1]();
  return opts[0][1]();
}
function glDirector(dt) {
  const cam = GL3.cam, now = performance.now(), idle = (now - (GL3.lastIn || 0)) / 1000;
  if (!cam.auto || GL3.drag) { if (GL3.shot) { GL3.shot = null; glCap(null); } return; }
  if (idle < (GL3.userFollow && GL3.follow === GL3.userFollow ? FILM_IDLE * 3 : FILM_IDLE) && GL3.lastIn) return; // (someone you chose to follow gets longer)
  GL3.userFollow = null;
  let sh = GL3.shot;
  if (!sh || (GL3.t - sh.t0) > (sh.dur || 30)) {
    try { sh = glShot(); } catch (e) { sh = null; }
    if (!sh) return;
    sh.t0 = GL3.t; sh.dur = sh.dur || rf(20, 34); sh.spin = (Math.random() < .5 ? -1 : 1) * rf(.025, .05);
    GL3.shot = sh; GL3.follow = null; GL3.goto = null; if (sh.yaw != null) sh.yaw0 = sh.yaw;
    glCap(null); setTimeout(() => { if (GL3.shot === sh) glCap(sh.cap, sh.sub); }, 2500);
    setTimeout(() => { if (GL3.shot === sh) glCap(null); }, 13000);
  }
  const p = sh.at(); if (!p) { GL3.shot = null; return; }
  const k = 1 - Math.exp(-dt * .7), kz = 1 - Math.exp(-dt * .5); // a slow glide from one shot to the next
  cam.tx += (p[0] - cam.tx) * k; cam.ty += (p[1] - cam.ty) * k; cam.tz += (p[2] - cam.tz) * k;
  cam.zoom += (sh.zoom - cam.zoom) * kz; cam.pitch += (sh.pitch - cam.pitch) * kz;
  if (sh.yaw0 != null) { let d = sh.yaw0 - cam.yaw; d = Math.atan2(Math.sin(d), Math.cos(d)); cam.yaw += d * kz; sh.yaw0 += sh.spin * dt * .3; }
  else cam.yaw += sh.spin * dt;
}
function glFrame(dt) {
  const gl = GL3.gl, c = GL3.c, cam = GL3.cam; GL3.t += dt; GL3.dt = dt; GL3.ft = performance.now(); // (when this frame began: a slow frame mustn't make the pointer look idle)
  LIGHT.sun = sunNow(); if (!LIGHT.season || (LIGHT.seasonT -= dt) <= 0) { LIGHT.season = LIGHT.forceSeason || seasonNow(); LIGHT.seasonT = 300; }
  stepWeather(dt); DIRTY.length = 0;
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  // rebuild what changed, a few chunks a frame
  // (the height map first, for every chunk in this batch, then the occlusion, which looks across into the neighbours)
  const batch = [], again = new Set(); let n = 0;
  for (const k of GL3.dirty) { if (n++ >= (GL3.first ? 3 : 64)) break; batch.push(k); }
  const built = batch.map(k => { GL3.dirty.delete(k); const r = glBuildChunk(k), old = glEdge(k); hfRaster(k, r.v); if (GL3.first && glEdge(k) !== old) for (const j of glNbrs(k)) if (!batch.includes(j)) again.add(j); return [k, r]; });
  for (const [k, r] of built) { glAO(r.v); const ch = GL3.chunks[k]; glUpload(ch, r.v, false); ch.lamps = r.lamps; glDropNear(ch); }
  // the chunks round the camera get a detailed version, one a frame, nearest first (and lose it again once well out of range)
  { const nr = cam.zoom <= 9 ? 11 : cam.zoom <= 15 ? 7 : 0, cx = cam.tx, cz = cam.tz; let best = -1, bd = 1e9;
    for (let k = 0; k < GNC * GNC; k++) { const ch = GL3.chunks[k], d = Math.hypot((k % GNC) * GCH + GCH / 2 - cx, ((k / GNC) | 0) * GCH + GCH / 2 - cz);
      if (ch.near && d > nr + 8) glDropNear(ch); else if (!ch.near && ch.n && d < nr && d < bd && !GL3.dirty.has(k)) { best = k; bd = d; } }
    // one detailed chunk at a time, a few milliseconds a frame: rows first, then its shading, then off to the GPU
    let J = GL3.nj; if (J && (GL3.chunks[J.k].near || GL3.dirty.has(J.k))) J = GL3.nj = null;
    if (!J && best >= 0 && !GL3.noNear) J = GL3.nj = { k: best, row: 0, v: [], lamps: [], a: -1, memo: new Map() };
    if (J && !built.length) { const t0 = performance.now(), budget = GL3.nearMs || 6;
      while (performance.now() - t0 < budget) {
        if (J.row < GCH * GCH) { const r = (J.row / GCH) | 0, c = J.row % GCH; glBuildRows(J.k, true, r, r + 1, J.v, J.lamps, c, c + 1); J.row++; continue; } // a tile at a time (a tall block can take several ms)
        if (J.a < 0) { J.v = new Float32Array(J.v); J.a = 0; }
        const e = Math.min(J.v.length, J.a + 13 * 3000); glAO(J.v, J.a, e, J.memo); J.a = e;
        if (J.a >= J.v.length) { glUpload(GL3.chunks[J.k], J.v, true); GL3.nj = null; break; }
      } } }
  for (const j of again) GL3.dirty.add(j); // a new tall building by the edge darkens the next chunk's streets too
  GL3.first = true;
  glDirector(dt);
  const fw = GL3.follow && walkerPos(GL3.follow); if (fw) GL3.goto = [fw[0], fw[2] * ZS, fw[1]];
  if (GL3.goto) { const k = 1 - Math.exp(-dt * 3); cam.tx += (GL3.goto[0] - cam.tx) * k; cam.ty += (GL3.goto[1] - cam.ty) * k; cam.tz += (GL3.goto[2] - cam.tz) * k; if (!GL3.follow && Math.hypot(GL3.goto[0] - cam.tx, GL3.goto[2] - cam.tz) < .01) GL3.goto = null; }
  // the sun (or the moon), and the colours of the hour
  const sun = LIGHT.sun, el = sun.el, day = sstep(-4, 12, el), gold = 1 - sstep(4, 22, el), wx = S.wx || { cover: .3 };
  let th = sun.th, e2 = el; if (el < -2) { th = 105; e2 = 38; }
  const t = th * DEG, hh = Math.max(4, e2) * DEG, sd = [Math.cos(hh) * Math.cos(t), Math.sin(hh), Math.cos(hh) * Math.sin(t)];
  const cover = S.settings.weather === false ? 0 : wx.cover || 0, shK = (el < -2 ? .35 : 1) * (1 - .8 * cover);
  const sunC = el < -2 ? [.2, .25, .42] : [lerp(1.08, 1.15, gold * day) * (1 - .5 * cover), lerp(1.02, .68, gold * day) * (1 - .5 * cover), lerp(.92, .4, gold * day) * (1 - .5 * cover)];
  const sky = [lerp(.13, .36 + .06 * gold, day) * (1 + .3 * cover), lerp(.17, .41, day) * (1 + .3 * cover), lerp(.32, .52 - .08 * gold, day) * (1 + .3 * cover)], gnd = [lerp(.07, .27 + .05 * gold, day), lerp(.08, .25, day), lerp(.14, .23, day)];
  const lit = el > 6 ? 0 : clamp((6 - el) / 12, 0, .75);
  // cameras
  const aspect = w / h, zz = cam.zoom; let pit = cam.pitch, dir = [Math.cos(pit) * Math.sin(cam.yaw), Math.sin(pit), Math.cos(pit) * Math.cos(cam.yaw)];
  // perspective: a 38° lens backed off so the zoom still means "how much ground fits"; isometric: the flat lens of the 2D view
  if (cam.persp) { const d0 = zz / Math.tan(19 * DEG); pit = Math.max(pit, Math.asin(Math.min(.95, 2.2 / d0))); dir[0] = Math.cos(pit) * Math.sin(cam.yaw); dir[1] = Math.sin(pit); dir[2] = Math.cos(pit) * Math.cos(cam.yaw); } // stay above the rooftops
  const fov = 38 * DEG, dist = cam.persp ? zz / Math.tan(fov / 2) : 90, tgt = [cam.tx, cam.ty, cam.tz]; let eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist];
  if (cam.persp) for (let k = 0; k < 24; k++) { // tall buildings: tip the camera up until neither it nor the middle of its view line is inside one
    let g = -9; for (const f of [1, .75, .5, .3]) g = Math.max(g, hfAt(tgt[0] + (eye[0] - tgt[0]) * f, tgt[2] + (eye[2] - tgt[2]) * f) - (tgt[1] + (eye[1] - tgt[1]) * f) + (f > .9 ? .6 : .25)); if (g < 0 || pit >= 1.45) break; // (a clear line, and the camera well above the roofs)
    pit = Math.min(1.45, pit + .04); dir = [Math.cos(pit) * Math.sin(cam.yaw), Math.sin(pit), Math.cos(pit) * Math.cos(cam.yaw)]; eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist];
  }
  { // (only for this frame: the angle you chose stays underneath. Up at once, back down gently)
    GL3.pe = !cam.persp || GL3.pe == null || pit > GL3.pe ? pit : GL3.pe + (pit - GL3.pe) * Math.min(1, dt * 3);
    if (GL3.pe !== pit) { pit = GL3.pe; dir = [Math.cos(pit) * Math.sin(cam.yaw), Math.sin(pit), Math.cos(pit) * Math.cos(cam.yaw)]; eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist]; }
  }
  GL3.eye = eye;
  const VP = m4mul(cam.persp ? m4persp(fov, aspect, Math.max(.2, dist * .02), dist + 520) : m4ortho(-zz * aspect, zz * aspect, -zz, zz, 1, 220), m4look(eye, tgt, [0, 1, 0]));
  const sc = [32, 2, 32], se = [sc[0] + sd[0] * 80, sc[1] + sd[1] * 80, sc[2] + sd[2] * 80];
  const SVP = m4mul(m4ortho(-50, 50, -50, 50, 1, 180), m4look(se, sc, [0, 1, 0]));
  // lamps near the middle of the view light the streets
  const dyn = glPeople(); // (first: the lanterns people carry are lights too)
  const lamps = []; if (lit > 0) { for (const ch of GL3.chunks) for (const L of ch.lamps) lamps.push(L); for (const L of GL3.carry) lamps.push(L); lamps.sort((a, b) => Math.hypot(a[0] - tgt[0], a[2] - tgt[2]) - Math.hypot(b[0] - tgt[0], b[2] - tgt[2])); lamps.length = Math.min(64, lamps.length); }
  const attrs = (full, pk) => { // full: everything the lit view needs; 1: position and id (picking); 0: position only (shadows). pk: a packed chunk
    const st = pk ? 28 : 52; gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, st, 0);
    if (full === true) {
      for (const a of [1, 2, 3, 5, 6]) gl.enableVertexAttribArray(a);
      if (pk) { gl.vertexAttribPointer(1, 3, gl.BYTE, true, 28, 12); gl.vertexAttribPointer(2, 3, gl.UNSIGNED_BYTE, true, 28, 16); gl.vertexAttribPointer(3, 1, gl.UNSIGNED_BYTE, false, 28, 19); gl.vertexAttribPointer(5, 1, gl.UNSIGNED_BYTE, false, 28, 24); gl.vertexAttribPointer(6, 1, gl.UNSIGNED_BYTE, true, 28, 25); }
      else { gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 52, 12); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 52, 24); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 52, 36); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 52, 44); gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 52, 48); }
      gl.uniform1f(GL3.main.u.uPk, pk ? 1 : 0);
    } else { gl.disableVertexAttribArray(5); gl.disableVertexAttribArray(6); }
    if (full) { gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, st, pk ? 20 : 40); } else gl.disableVertexAttribArray(4);
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.dyn); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.STREAM_DRAW);
  const FR = glFrustum(VP); GL3.drawn = 0;
  const drawAll = full => { // the shadow pass takes every chunk's plain version; the view only what it can see, in detail where it's near
    for (let k = 0; k < GL3.chunks.length; k++) { const ch = GL3.chunks[k]; if (!ch.n) continue;
      if (full !== false && !glSees(FR, ch, k)) continue;
      const nb = full !== false && ch.near && ch.nb; gl.bindBuffer(gl.ARRAY_BUFFER, nb ? ch.nb : ch.buf); attrs(full, true); gl.drawArrays(gl.TRIANGLES, 0, nb ? ch.nn : ch.n); if (full === true) GL3.drawn++; } if (dyn.length) { gl.bindBuffer(gl.ARRAY_BUFFER, GL3.dyn); attrs(full); gl.drawArrays(gl.TRIANGLES, 0, dyn.length / 13); } if (full === true) { gl.bindBuffer(gl.ARRAY_BUFFER, GL3.sea); attrs(full); gl.drawArrays(gl.TRIANGLES, 0, 6); } };
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  // shadow pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.shF); gl.viewport(0, 0, 2048, 2048); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(GL3.sh.p); gl.uniformMatrix4fv(GL3.sh.u.uSVP, false, SVP); for (const a of [1, 2, 3]) gl.disableVertexAttribArray(a); drawAll(false);
  // the view
  const post = GL3.post; if (post) { glPostSize(gl, w, h); if (!post.ok) GL3.post = null; }
  gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.post ? post.msF : null); gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // the sky, behind everything
  const sd0 = [Math.cos(el * DEG) * Math.cos(t), Math.sin(el * DEG), Math.cos(el * DEG) * Math.sin(t)], skyU = U => { gl.uniform3fv(U.uSunD, sd0); gl.uniform1f(U.uSunY, sd0[1]); gl.uniform1f(U.uCover, cover); };
  { const K = GL3.sky, f = [-dir[0], -dir[1], -dir[2]], tn = Math.tan(fov / 2), r0 = [f[2], 0, -f[0]], rl = Math.hypot(r0[0], r0[2]) || 1, r = [-r0[0] / rl, 0, -r0[2] / rl], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
    gl.useProgram(K.p); skyU(K.u); gl.uniform1f(K.u.uCT, GL3.t); gl.uniform1f(K.u.uLo, GL3.lo ? 1 : 0); gl.uniform3fv(K.u.uF, f); gl.uniform3fv(K.u.uR, r.map(q => q * tn * aspect)); gl.uniform3fv(K.u.uU, u.map(q => q * tn));
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true); gl.enable(gl.DEPTH_TEST); }
  const P = GL3.main, U = P.u; gl.useProgram(P.p); skyU(U);
  gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniformMatrix4fv(U.uSVP, false, SVP);
  gl.uniform3fv(U.uSun, sd); gl.uniform3fv(U.uSunC, sunC); gl.uniform3fv(U.uSky, sky); gl.uniform3fv(U.uGnd, gnd); gl.uniform3fv(U.uEye, eye);
  gl.uniform3fv(U.uWin, gcol((LIGHT.cur && LIGHT.cur.winC || ['#ffd07a'])[0])); gl.uniform3fv(U.uLamp, [1.25, .86, .5]);
  gl.uniform1f(U.uLit, lit); gl.uniform1f(U.uShK, shK); gl.uniform1f(U.uT, GL3.t);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GL3.shT); gl.uniform1i(U.uSh, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, GL3.tex); gl.uniform1i(U.uTex, 1); gl.uniform3fv(U.uAvg, GL3.texAvg); gl.uniform1fv(U.uTS, TX.SCALE); gl.uniform1fv(U.uRaw, TX.RAW); gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(U.uNL, lamps.length); if (lamps.length) gl.uniform3fv(U.uLP, new Float32Array(lamps.flat()));
  gl.uniform1f(U.uHi, GL3.hover || 0);
  // the season and the weather: snow lies where it has fallen, rain wets things, fog closes in, lightning flashes
  const sea = LIGHT.season || seasonNow(), wxOn = S.settings.weather !== false, wxs = wxOn ? wx : { rain: 0, snow: 0, fog: 0, sc: 0 };
  GL3.flash = Math.max(0, (GL3.flash || 0) - dt * 2.2); if (DYN.flash > GL3.flash) GL3.flash = DYN.flash;
  gl.uniform1f(U.uLo, GL3.lo ? 1 : 0); gl.uniform4f(U.uSea, sea.autumn, sea.winter, sea.spring, wxs.sc || 0); gl.uniform3f(U.uWx, wxs.rain || 0, cover, GL3.flash * (wxOn ? 1 : 0));
  const fog = wxs.fog || 0;
  gl.uniform1f(U.uFog0, (dist + zz * .6) * (1 - .85 * fog)); gl.uniform1f(U.uFogL, cam.persp ? 55 * (1 - .8 * fog) : 0);
  drawAll(true);
  glSmoke(gl, dt, FR, VP, h / 2 * (cam.persp ? 1 / Math.tan(fov / 2) : 1 / zz), day, tgt);
  if ((wxs.rain || 0) > .05 || (wxs.snow || 0) > .05) { // rain or snow falling across the view
    const Q = GL3.prc; for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
    gl.useProgram(Q.p); gl.uniform1f(Q.u.uT, GL3.t); gl.uniform1f(Q.u.uRain, wxs.rain || 0); gl.uniform1f(Q.u.uSnow, wxs.snow || 0); gl.uniform1f(Q.u.uAsp, aspect); gl.uniform1f(Q.u.uYaw, cam.yaw);
    gl.uniform3fv(Q.u.uCol, (wxs.snow || 0) > (wxs.rain || 0) ? [.96, .97, 1] : [.78, .84, .92].map(v => v * (.4 + .6 * day)));
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); // (the glow mask in alpha stays as it was)
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
  }
  if (GL3.post) glBloom(gl, w, h, .55 + lit * .7);
  // what's under the pointer: the same scene again, each thing painted in its own id colour, read back one pixel
  if (GL3.pickReq && performance.now() - (GL3.pickT || 0) > 70 && UI.mouse.x >= 0) {
    GL3.pickReq = false; GL3.pickT = performance.now();
    const pw = Math.max(1, w >> 1), ph = Math.max(1, h >> 1);
    if (pw !== GL3.pkW || ph !== GL3.pkH) {
      GL3.pkW = pw; GL3.pkH = ph;
      gl.bindRenderbuffer(gl.RENDERBUFFER, GL3.pkC); gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, pw, ph);
      gl.bindRenderbuffer(gl.RENDERBUFFER, GL3.pkD); gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, pw, ph);
      gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.pkF); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, GL3.pkC); gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, GL3.pkD);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.pkF); gl.viewport(0, 0, pw, ph); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(GL3.pk.p); gl.uniformMatrix4fv(GL3.pk.u.uVP, false, VP); for (const a of [1, 2, 3]) gl.disableVertexAttribArray(a); drawAll(1);
    const px = new Uint8Array(4), mx = clamp(Math.round(UI.mouse.x * dpr / 2), 0, pw - 1), my = clamp(Math.round(ph - 1 - UI.mouse.y * dpr / 2), 0, ph - 1);
    gl.readPixels(mx, my, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    GL3.hover = px[0] + px[1] * 256 + px[2] * 65536; GL3.hoverT = performance.now();
    if (GL3.tapAt) { const t = GL3.tapAt; GL3.tapAt = null; UI.lastMove = performance.now(); GL3.touched = true; if (UI.tool || GL3.hover >= GPID) glClick(t[0], t[1]); } // a tap: show what's there (a person or a nudge acts too)
  }
  glTip();
}
// the tooltip for whatever the pointer is on: the same cards as the 2D view
function glTip() {
  const tip = $('tip'), id = GL3.hover || 0, now = GL3.ft || performance.now();
  if (!id || GL3.drag && GL3.drag[4] || now - UI.lastMove > (GL3.touched ? 6000 : 2500) || document.querySelector('.modal.show') || document.elementFromPoint(UI.mouse.x, UI.mouse.y) !== GL3.c) { tip.style.opacity = 0; DYN.hover = -1; return; }
  if (id >= GPID) {
    const wk = DYN.walkers[id - GPID], p = wk && S.P[wk.pid]; if (!p) { tip.style.opacity = 0; return; }
    showPersonTip(p, UI.mouse.x, UI.mouse.y); UI.tipTile = -1; return;
  }
  const i = id - 1; DYN.hover = i; tip.classList.remove('wide');
  if (i !== UI.tipTile) { tip.innerHTML = tipFor(i); UI.tipTile = i; }
  tip.style.left = Math.min(UI.mouse.x + 16, innerWidth - 290) + 'px'; tip.style.top = Math.min(UI.mouse.y + 18, innerHeight - 60) + 'px'; tip.style.opacity = 1;
}
// a click: a nudge lands exactly where you point, a person opens their card (and the camera follows them), a town gets a closer look
function glClick(sx, sy) {
  UI.mouse.x = sx; UI.mouse.y = sy;
  const id = GL3.hover || 0; if (!id) return;
  if (id >= GPID) { const wk = DYN.walkers[id - GPID]; if (wk && wk.pid) { openPerson(wk.pid); GL3.follow = wk; glTouch(); GL3.userFollow = wk; } return; }
  const i = id - 1, x = i % W, y = (i / W) | 0;
  if (UI.tool) {
    const k = UI.tool;
    if (useTool(k, x, y)) { UI.tool = null; document.body.classList.remove('targeting'); document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.remove('sel')); renderTools(); UIDIRTY.chron = true; toast(`${TOOL_INFO[k][0]} sent. The colonists noticed.`); }
    return;
  }
  GL3.follow = null; GL3.goto = [x, surfZ(i) * ZS, y]; glTouch();
}
// what's on the water, the rails and in the air: ships by era, fishing boats, ferries, trains and planes
function glTraffic() {
  const ys = SEAZ * ZS, H3 = (h) => [[Math.cos(h), 0, Math.sin(h)], [-Math.sin(h), 0, Math.cos(h)]];
  const hull = (c, f, r, L, Wd, D, col, deck) => { // a hull: a box with a pointed bow
    const F = V3s(f, 1), R = V3s(r, 1), P = (s, t, y) => [c[0] + F[0] * s + R[0] * t, y, c[2] + F[2] * s + R[2] * t], cc = gcol(col), cd = gcol(deck), y0 = c[1] - D * .4, y1 = c[1] + D * .6;
    GLB.ctr = [c[0], c[1] - .5, c[2]]; GLB.mat = 0;
    const pts = [[-L, -Wd], [L * .55, -Wd], [L, 0], [L * .55, Wd], [-L, Wd]];
    for (let k = 0; k < 5; k++) { const [s0, t0] = pts[k], [s1, t1] = pts[(k + 1) % 5]; gquad(P(s0, t0, y0), P(s1, t1, y0), P(s1, t1, y1), P(s0, t0, y1), cc); }
    GLB.ctr = [c[0], y1 - .5, c[2]]; gtri(P(-L, -Wd, y1), P(L * .55, -Wd, y1), P(L * .55, Wd, y1), cd); gtri(P(-L, -Wd, y1), P(L * .55, Wd, y1), P(-L, Wd, y1), cd); gtri(P(L * .55, -Wd, y1), P(L, 0, y1), P(L * .55, Wd, y1), cd);
    return y1;
  };
  const at = (c, f, r, s, t, y) => [c[0] + f[0] * s + r[0] * t, y, c[2] + f[2] * s + r[2] * t];
  for (const sh of DYN.ships) {
    const p = shipPos(sh); if (!p || p[2] < .2) continue;
    const h = glHeading(sh, p[3], p[4]), [f, r] = H3(h), bob = Math.sin(GL3.t * 1.3 + (sh.id || 0) * 9) * .006, c = [p[0], ys + .02 + bob, p[1]], k = sh.kind;
    if (k === 'sail') { const y1 = hull(c, f, r, .26, .065, .07, '#7a5238', '#b08a60'); for (const [s2, hm] of [[.08, .42], [-.1, .34]]) { gBeam(at(c, f, r, s2, 0, y1), at(c, f, r, s2, 0, y1 + hm), .006, '#5a4030'); gBox(at(c, f, r, s2 - .01, 0, y1 + hm * .3), V3s(f, .005), V3s(r, .1), hm * .62, '#f2ece0'); } }
    else if (k === 'steamer') { const y1 = hull(c, f, r, .3, .07, .08, '#2f3a46', '#c9b79a'); gBox(at(c, f, r, 0, 0, y1), V3s(f, .1), V3s(r, .05), .06, '#ece6da'); gBox(at(c, f, r, -.04, 0, y1 + .06), [.02, 0, 0], [0, 0, .02], .1, '#c0392b'); }
    else if (k === 'freighter') { const y1 = hull(c, f, r, .38, .085, .09, sh.col || '#3f6e8c', '#9aa0a6'); gBox(at(c, f, r, -.28, 0, y1), V3s(f, .06), V3s(r, .07), .1, '#ece6da'); gWins(at(c, f, r, -.22, 0, y1), r, f, .06, y1 + .02, 2, 3, .035, 9); for (let q = 0; q < 3; q++) gBox(at(c, f, r, -.12 + q * .14, 0, y1), V3s(f, .055), V3s(r, .06), .02, '#5a4a3c'); }
    else if (k === 'boxship') { const y1 = hull(c, f, r, .45, .095, .09, sh.col || '#b8554a', '#6b737c'); gBox(at(c, f, r, -.36, 0, y1), V3s(f, .05), V3s(r, .085), .13, '#f2f2f0'); const cols = ['#c0584f', '#3f7fb0', '#e0a43a', '#4e9a6a', '#7a5a9a']; for (let q = 0; q < 5; q++) for (let l = 0; l < 2; l++) gBox(at(c, f, r, -.22 + q * .12, 0, y1 + l * .04), V3s(f, .055), V3s(r, .08), .038, cols[(q + l * 2 + ((sh.id || 0) * 10 | 0)) % 5]); }
    else { GLB.ao = 1; const y1 = hull([c[0], c[1] + .04, c[2]], f, r, .32, .09, .06, '#f4f6f8', '#dfe7ef'); gBox(at(c, f, r, 0, 0, y1), V3s(f, .14), V3s(r, .06), .04, '#9fd6e8', 0, .5); gBox(at(c, f, r, 0, 0, c[1] - .02), V3s(f, .3), V3s(r, .08), .01, '#7fe8e0', 0, 2); }
  }
  for (const b of DYN.boats) { // fishing boats: a small hull, a wheelhouse or a mast
    const p = boatPos(b); if (!p) continue; const h = glHeading(b, p[3], p[4]), [f, r] = H3(h), c = [p[0], ys + .015 + Math.sin(GL3.t * 2 + (b.ph || 0)) * .004, p[1]];
    const y1 = hull(c, f, r, .1, .035, .04, hasTech('steam') ? '#3f6e8c' : '#8a5a3c', '#c9b79a');
    if (hasTech('steam')) gBox(at(c, f, r, -.02, 0, y1), V3s(f, .03), V3s(r, .025), .035, '#ece6da'); else gBeam(at(c, f, r, .02, 0, y1), at(c, f, r, .02, 0, y1 + .14), .004, '#5a4030');
  }
  for (const o of DYN.ferries) { // ferries: a raft early, a barge with a cabin later
    const p = ferryPos(o), i = idx(clamp(Math.round(p[0]), 0, W - 1), clamp(Math.round(p[1]), 0, H - 1)), h = glHeading(o, p[2], p[3]), [f, r] = H3(h);
    const y = (M.water[i] === 1 ? ys : surfZ(i) * ZS) + .015, c = [p[0], y, p[1]];
    if (!hasTech('wheel')) gBox([c[0], y - .01, c[2]], V3s(f, .12), V3s(r, .08), .02, '#8a6a4c', M_PLANK);
    else { const y1 = hull(c, f, r, .16, .07, .04, '#ece6da', '#9aa0a6'); gBox(at(c, f, r, 0, 0, y1), V3s(f, .06), V3s(r, .05), .045, '#3f6e8c'); }
  }
  const mag = hasTech('maglev'), elec = hasTech('electric');
  for (const tr of DYN.trains) for (let k = 0; k < 3; k++) { // trains: three cars on the rails
    const s = clamp(tr.s - tr.dir * k * .75, 0, tr.r.path.length - 1), i0 = Math.floor(s), i1 = Math.min(tr.r.path.length - 1, i0 + 1), fr = s - i0, a = tr.r.path[i0], b = tr.r.path[i1];
    const fx = lerp(a % W, b % W, fr), fy = lerp((a / W) | 0, (b / W) | 0, fr), z = lerp(M.water[a] ? landZ(a) + 3 : surfZ(a), M.water[b] ? landZ(b) + 3 : surfZ(b), fr) * ZS;
    const dx = (b % W) - (a % W), dy = ((b / W) | 0) - ((a / W) | 0), h = Math.atan2(dy, dx), [f, r] = H3(h);
    const col = mag ? '#f2f5f8' : elec ? (k === 0 ? '#c8553d' : '#e9d9b8') : (k === 0 ? '#3d3f47' : '#8a3f37'), c = [fx, z + (mag ? .04 : .02), fy];
    gBox(c, V3s(f, .34), V3s(r, .075), .11, col); gWins([c[0], c[1], c[2]], f, r, .3, c[1] + .03, 1, 5, .05, k * 7 + i0);
    if (!mag && !elec && k === 0) gBox(at(c, f, r, .2, 0, c[1] + .11), [.02, 0, 0], [0, 0, .02], .06, '#2a2a2a'); // the engine's stack
    GLB.mat = 0; if (k === 0 && GL3.litNow) for (const sg of [1, -1]) glOBox(at(c, f, r, .35 * tr.dir, sg * .04, c[1] + .05), [.006, 0, 0], [0, 0, .006], [0, .006, 0], '#fff4d6', 2);
  }
  const planes = DYN.planes.slice(); for (const B of airfields()) { const a = DYN.af[B.id]; if (a && a.parked && a.pp) planes.push(a.pp); }
  for (const pl of planes) { // planes: fuselage, wings and tail, on the apron or in the air
    const k = pl.kind || planeKind(), [f, r] = H3(pl.h || 0), c = [pl.x, (pl.z || 0) * ZS + .03, pl.y], sz = k === 'prop' ? .7 : k === 'jet' ? 1 : 1.15;
    const col = k === 'liner' ? '#f4f6f8' : k === 'jet' ? '#e8ecf0' : '#c9b79a';
    gBox(c, V3s(f, .22 * sz), V3s(r, .03 * sz), .05 * sz, col); gBox(at(c, f, r, .02, 0, c[1] + .02 * sz), V3s(f, .05 * sz), V3s(r, .2 * sz), .01, col);
    gBox(at(c, f, r, -.19 * sz, 0, c[1] + .03 * sz), V3s(f, .03 * sz), V3s(r, .004), .07 * sz, k === 'prop' ? '#c0392b' : '#3f6e8c'); gBox(at(c, f, r, -.19 * sz, 0, c[1] + .04 * sz), V3s(f, .025 * sz), V3s(r, .07 * sz), .008, col);
    if (GL3.litNow) { GLB.mat = 0; glOBox(at(c, f, r, 0, .2 * sz, c[1] + .025), [.005, 0, 0], [0, 0, .005], [0, .005, 0], '#ff4a4a', 2); glOBox(at(c, f, r, 0, -.2 * sz, c[1] + .025), [.005, 0, 0], [0, 0, .005], [0, .005, 0], '#4aff7a', 2); }
  }
}
/* ---------- people, pets, carts and cars: little jointed figures, rebuilt every frame ---------- */
// a box in world units, turned to face heading h: c is its middle, a/b/u its half-extents along forward/right/up (vectors)
function glOBox(c, f, r, u, col, e = 0) {
  const C = gcol(col), V = GLB.v, id = GLB.id || 0, m = e ? 0 : GLB.mat || 0, ao = GLB.ao || 1;
  const lf = Math.hypot(f[0], f[1], f[2]) || 1, lr = Math.hypot(r[0], r[1], r[2]) || 1, lu = Math.hypot(u[0], u[1], u[2]) || 1;
  const P = (i, j, k) => [c[0] + f[0] * i + r[0] * j + u[0] * k, c[1] + f[1] * i + r[1] * j + u[1] * k, c[2] + f[2] * i + r[2] * j + u[2] * k];
  const face = (a, b, cc, d, nx, ny, nz) => { for (const q of [a, b, cc, a, cc, d]) V.push(q[0], q[1], q[2], nx, ny, nz, C[0], C[1], C[2], e, id, m, ao); };
  const p000 = P(-1, -1, -1), p100 = P(1, -1, -1), p010 = P(-1, 1, -1), p110 = P(1, 1, -1), p001 = P(-1, -1, 1), p101 = P(1, -1, 1), p011 = P(-1, 1, 1), p111 = P(1, 1, 1);
  face(p001, p101, p111, p011, u[0] / lu, u[1] / lu, u[2] / lu); // (no bottom: nobody sees under a person or a car)
  face(p100, p110, p111, p101, f[0] / lf, f[1] / lf, f[2] / lf); face(p000, p010, p011, p001, -f[0] / lf, -f[1] / lf, -f[2] / lf);
  face(p010, p110, p111, p011, r[0] / lr, r[1] / lr, r[2] / lr); face(p000, p100, p101, p001, -r[0] / lr, -r[1] / lr, -r[2] / lr);
}
// the moving things' vertices go into one buffer that is reused frame after frame
class GLFBuf { constructor() { this.a = new Float32Array(1 << 18); this.length = 0; }
  push(a, b, c, d, e, f, g, h, i, j, k, l, m) { let n = this.length; if (n + 13 > this.a.length) { const o = new Float32Array(this.a.length * 2); o.set(this.a); this.a = o; } const A = this.a; A[n] = a; A[n + 1] = b; A[n + 2] = c; A[n + 3] = d; A[n + 4] = e; A[n + 5] = f; A[n + 6] = g; A[n + 7] = h; A[n + 8] = i; A[n + 9] = j; A[n + 10] = k; A[n + 11] = l; A[n + 12] = m; this.length = n + 13; } }
const V3 = (a, k) => [a[0] * k, a[1] * k, a[2] * k], VA = (...v) => v.reduce((o, a) => [o[0] + a[0], o[1] + a[1], o[2] + a[2]], [0, 0, 0]);
// a limb hanging from a pivot, swung forward by angle a (radians) about the body's right axis
function glLimb(pv, f, r, a, len, w, col, e = 0) {
  const dn = VA(V3([0, -1, 0], Math.cos(a)), V3(f, Math.sin(a))), fw = VA(V3(f, Math.cos(a)), V3([0, 1, 0], Math.sin(a)));
  glOBox(VA(pv, V3(dn, len / 2)), V3(fw, w), V3(r, w), V3(dn, -len / 2), col, e);
  return VA(pv, V3(dn, len)); // where it ends (a hand, a foot)
}
function glHeading(o, dx, dy) { // turn smoothly towards the way they're going
  if (dx || dy) { const t = Math.atan2(dy, dx); if (o._gh == null) o._gh = t; let d = t - o._gh; d = Math.atan2(Math.sin(d), Math.cos(d)); o._gh += d * Math.min(1, (GL3.dt || .016) * 9); }
  return o._gh || 0;
}
function glPerson(o, X, Z, y0, h, moving, carryLamp) {
  const e0 = GL3.eye, far = e0 ? Math.hypot(X - e0[0], y0 - e0[1], Z - e0[2]) : 0;
  if (far > 30) { // a speck in the distance: a body and a head
    GLB.ctr = [X, y0 + .1, Z]; glOBox([X, y0 + .11, Z], [.02, 0, 0], [0, 0, .02], [0, .11, 0], o.col || '#e5874f'); glOBox([X, y0 + .245, Z], [.018, 0, 0], [0, 0, .018], [0, .022, 0], o.skin || '#e0b090'); return;
  }
  const s = o.kid ? .72 : 1, f = [Math.cos(h), 0, Math.sin(h)], r = [-Math.sin(h), 0, Math.cos(h)], ph = o.ph || 0;
  const sw = moving ? Math.sin(ph) : 0, bob = moving ? Math.abs(Math.cos(ph)) * .007 * s : Math.sin(GL3.t * 1.6 + ph) * .0015; // a step's bob, or breathing
  const hip = y0 + .105 * s + bob, sh = y0 + .21 * s + bob, B = (dx, dr, y) => [X + f[0] * dx + r[0] * dr, y, Z + f[2] * dx + r[2] * dr];
  for (const sg of [1, -1]) glLimb(B(0, sg * .016 * s, hip), f, r, sw * sg * .55, .105 * s, .012 * s, o.pants || '#555'); // legs
  glOBox(B(0, 0, (hip + sh) / 2 + .006 * s), V3(f, .02 * s), V3(r, .033 * s), [0, (sh - hip) / 2 + .01 * s, 0], o.col || '#e5874f'); // body
  if (o.kind === 'founder') glOBox(B(.001, 0, hip + .045 * s), V3(f, .0205 * s), V3(r, .0335 * s), [0, .006 * s, 0], '#f2f0ea'); // the founder's sash
  let hand = null;
  for (const sg of [1, -1]) { const e = glLimb(B(0, sg * .043 * s, sh), f, r, -sw * sg * .45 + (carryLamp && sg > 0 ? .5 : 0), .095 * s, .0095 * s, sg > 0 ? o.col : shade(o.col || '#e5874f', .85)); if (sg > 0) hand = e; } // arms swing against the legs
  glOBox(B(0, 0, sh + .012 * s), V3(f, .01 * s), V3(r, .01 * s), [0, .012 * s, 0], o.skin || '#e0b090'); // neck
  const hy = sh + .045 * s, hc = B(0, 0, hy), u = hc[0], v = hc[2];
  glOBox(hc, V3(f, .022 * s), V3(r, .021 * s), [0, .025 * s, 0], o.skin || '#e0b090'); // head
  glOBox(B(-.005 * s, 0, hy + .012 * s), V3(f, .02 * s), V3(r, .023 * s), [0, .016 * s, 0], o.hair || '#5a3a28'); // hair, sitting back on the head
  if (carryLamp && hand) { glOBox([hand[0], hand[1] - .012, hand[2]], [.008, 0, 0], [0, 0, .008], [0, .012, 0], '#ffd08a', 2); GL3.carry.push([hand[0], hand[1], hand[2]]); } // a lantern
  if (far > 12) return;
  if (!o.kid && (o.hat || 1) < .22) { const era = S.era;
    if (era <= 3) { glOBox([u, hy + .024 * s, v], V3(f, .046 * s), V3(r, .046 * s), [0, .003, 0], '#d8b86a'); glBlob(u, v, .026 * s, (hy + .026 * s) / ZS, .5 * s, '#caa458', 0); } // a straw hat
    else if (era <= 6) { glBlob(u, v, .028 * s, (hy + .012 * s) / ZS, .55 * s, shade(o.pants || '#555', .8), 0); glOBox(B(.028 * s, 0, hy + .012 * s), V3(f, .014 * s), V3(r, .022 * s), [0, .002, 0], shade(o.pants || '#555', .8)); } } // a cap
  if (o.pet) { // the dog trots at their heel
    const d = B(-.07, .05, y0), dph = ph * 1.35;
    for (const [lf, lr, q] of [[.022, .012, 0], [.022, -.012, Math.PI], [-.022, .012, Math.PI], [-.022, -.012, 0]]) glLimb([d[0] + f[0] * lf + r[0] * lr, y0 + .028, d[2] + f[2] * lf + r[2] * lr], f, r, moving ? Math.sin(dph + q) * .6 : 0, .028, .005, '#7a5e46');
    glOBox([d[0], y0 + .036, d[2]], V3(f, .032), V3(r, .012), [0, .011, 0], '#9a7a5c');
    const hd = [d[0] + f[0] * .036, y0 + .052, d[2] + f[2] * .036]; glOBox(hd, V3(f, .012), V3(r, .01), [0, .01, 0], '#9a7a5c');
    const tw = Math.sin(GL3.t * 9 + ph) * .4; glLimb([d[0] - f[0] * .03, y0 + .044, d[2] - f[2] * .03], V3(f, -1), r, -1.1 + tw, .025, .004, '#9a7a5c');
  }
}
function glVehicle(c, X, Z, y0, h, moving) {
  const f = [Math.cos(h), 0, Math.sin(h)], r = [-Math.sin(h), 0, Math.cos(h)], B = (dx, dr, y) => [X + f[0] * dx + r[0] * dr, y, Z + f[2] * dx + r[2] * dr], ph = (c.s || 0) * 22;
  const wheel = (dx, dr, rad, col) => glOBox(B(dx, dr, y0 + rad), V3(f, rad), V3(r, .008), [0, rad, 0], col);
  if (c.kind === 'cart') { // a farm cart and the horse that pulls it
    for (const [dx, dr] of [[-.03, .045], [-.03, -.045]]) wheel(dx, dr, .03, '#5a4432');
    glOBox(B(-.03, 0, y0 + .055), V3(f, .06), V3(r, .04), [0, .018, 0], '#9b7657'); glOBox(B(-.03, 0, y0 + .08), V3(f, .055), V3(r, .036), [0, .008, 0], '#8fa58a'); // with a load under a cloth
    const hx = .12; for (const [lf, lr, q] of [[.035, .014, 0], [.035, -.014, Math.PI], [-.03, .014, Math.PI], [-.03, -.014, 0]]) glLimb(B(hx + lf, lr, y0 + .07), f, r, moving ? Math.sin(ph + q) * .5 : 0, .07, .007, '#5a3e2c');
    glOBox(B(hx, 0, y0 + .085), V3(f, .052), V3(r, .02), [0, .02, 0], '#7a5238'); // body
    glLimb(B(hx + .045, 0, y0 + .1), V3(f, -1), r, Math.PI * .8, .05, .012, '#7a5238'); // neck
    glOBox(B(hx + .085, 0, y0 + .128), V3(f, .022), V3(r, .011), [0, .012, 0], '#6a4630'); // head
    for (const sg of [1, -1]) glOBox(B(.045, sg * .02, y0 + .07), V3(f, .04), [0, .002, 0], V3(r, .002), '#6b5040'); // shafts
    return;
  }
  if (c.kind === 'car') { const k = 1.6, S3 = (a, m) => V3(a, m * k); // cars are drawn a bit bigger than life, so they read next to the houses
    for (const [dx, dr] of [[.045, .036], [.045, -.036], [-.045, .036], [-.045, -.036]]) glOBox(B(dx * k, dr * k, y0 + .017 * k), S3(f, .017), S3(r, .008), [0, .017 * k, 0], '#2a2c30');
    glOBox(B(0, 0, y0 + .035 * k), S3(f, .075), S3(r, .036), [0, .018 * k, 0], c.col || '#c0392b');
    glOBox(B(-.01 * k, 0, y0 + .064 * k), S3(f, .042), S3(r, .032), [0, .012 * k, 0], '#bcd3e0'); glOBox(B(-.01 * k, 0, y0 + .077 * k), S3(f, .04), S3(r, .033), [0, .002 * k, 0], c.col || '#c0392b');
    if (GL3.litNow) for (const sg of [1, -1]) glOBox(B(.076 * k, sg * .022 * k, y0 + .038 * k), [.005, 0, 0], [0, 0, .005], [0, .005, 0], '#fff4d6', 2); // headlamps
    return;
  }
  const hov = Math.sin(GL3.t * 2 + (c.s || 0)) * .006; // hover pods float
  glOBox(B(0, 0, y0 + .09 + hov), V3(f, .07), V3(r, .04), [0, .02, 0], '#f4f6f8'); glOBox(B(0, 0, y0 + .065 + hov), V3(f, .05), V3(r, .03), [0, .004, 0], '#7fe8e0', 2);
}
function glPeople() {
  const v = GL3.fb || (GL3.fb = new GLFBuf()); v.length = 0; GLB = { v, x: 0, y: 0, base: 0, tops: [], id: 0, wall: 0, mat: 0, lod: false, ctr: null, wallC: null, flat: '', ao: 1, B: null, smk: null }; GL3.carry = [];
  const night = LIGHT.emK > .02; GL3.litNow = night;
  try {
    for (let k = 0; k < DYN.walkers.length; k++) {
      const w = DYN.walkers[k], p = walkerPos(w); if (!p || p[3] < .3) continue; GLB.id = w.pid ? GPID + k : 0; // a person you can point at
      const X = p[0], Z = p[1], y0 = p[2] * ZS; GLB.ao = .35 + .65 * aoAt(X, y0 + .15, Z, 0, 1, 0); // darker down an alley
      glPerson(w, X, Z, y0, glHeading(w, p[4], p[5]), !!p[6], night && w.ln < (S.era === 0 ? .6 : .12));
    }
    GLB.id = 0; GLB.ao = 1;
    for (const hd of DYN.herds) for (const m of hd.members) { const [fx, fy, z] = agentPos(m), bx = m.b % W - m.a % W, by = ((m.b / W) | 0) - ((m.a / W) | 0); glSheep(fx, fy, z * ZS, (m.size || 1) * (m.baby ? .6 : 1), glHeading(m, bx, by), m.pause > 0 ? -1 : DYN.t * 3 + (m.a % 7)); }
    GLB.id = 0; GLB.ao = 1; glIncidents(GL3.dt || .016);
    GLB.id = 0; GLB.ao = 1; try { glTraffic(); } catch (e) { if (QS.has('dev')) console.error(e); }
    for (const c of DYN.vehicles) { const p = vehiclePos(c); if (!p) continue; GLB.ao = .35 + .65 * aoAt(p[0], p[2] * ZS + .15, p[1], 0, 1, 0); glVehicle(c, p[0], p[1], p[2] * ZS, glHeading(c, p[4], p[5]), true); }
  } catch (e) { if (QS.has('dev')) console.error(e); } finally { GLB = null; }
  return v.a.subarray(0, v.length);
}

/* ---------- switching between the 2D and 3D views (3D by default) ---------- */
const GL_DEFAULT = true; // new worlds and new browsers open in 3D (the choice is remembered)
function glWanted() { if (QS.has('2d')) return false; try { if (localStorage.getItem('sf2d') === '1') return false; } catch (e) { } return true; } // always 3D (2D stays as the fallback for ?2d and browsers without WebGL2)
function glToggle() {
  const want = !GL3.on; try { localStorage.setItem('sf3d', want ? '1' : '0'); } catch (e) { }
  if (want) { if (!GL3.gl) glInit(); else { GL3.on = true; GL3.c.style.display = 'block'; $('view').style.display = 'none'; for (let k = 0; k < GNC * GNC; k++) GL3.dirty.add(k); } }
  else { ensure2D(); GL3.on = false; GL3.c.style.display = 'none'; $('view').style.display = 'block'; const h = $('glHint'); if (h) h.remove(); $('tip').style.opacity = 0; renderAll(); relightNow(); }
  glBtn();
}
function glBtn() { const b = $('glBtn'); if (b) b.remove(); } // (the 2D/3D switch is gone)

/* ---------- textures, painted in code at start-up (no image files): one layer each in a texture array ---------- */
// Materials: 0 none, 1 grass, 2 brick, 3 roof tiles, 4 bark, 5 leaves, 6 plaster, 7 stone, 8 planks, 9 cobbles, 10 asphalt, 11 earth.
// The shader lays them on by world position (triplanar), so nothing needs unwrapping. RAW is how much of the texture's own
// colour replaces the art's colour (grass and bark look real; plaster keeps the building's own colour and only gains grain).
const TX = { N: 256, L: 20, SCALE: [1, .5, 1.8, 1.6, 3.5, 2.2, 1.2, 1.4, 2, 1.6, .7, .6, 1.8, 1, 2.2, .6, 1.2, 1.4, 2.6, 1.6], RAW: [0, .85, .55, .4, .9, .7, 0, .35, .45, .55, .7, .7, .3, .75, .35, .7, .5, .25, .7, .6] };
const M_NEEDLE = 18, M_THATCH = 19; // (pine needles: the leaf texture, but they stay green all winter)
const M_SOIL = 13, M_CROP = 14, M_SAND = 15, M_TAR = 16, M_GLASS = 17, M_SLATE = 12, M_GRASS = 1, M_BRICK = 2, M_ROOF = 3, M_BARK = 4, M_LEAF = 5, M_PLASTER = 6, M_STONE = 7, M_PLANK = 8, M_COBBLE = 9, M_ASPHALT = 10, M_EARTH = 11;
function glTextures() {
  const N = TX.N, L = TX.L, out = new Uint8Array(N * N * 4 * L), avg = new Float32Array(L * 3);
  const rng = s => () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296, R = rng(7);
  const nz = (seed, cx, cy = cx) => { const r = rng(seed), g = new Float32Array(cx * cy).map(() => r()); return (x, y) => { x = x / N * cx; y = y / N * cy; const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy), G = (i, j) => g[((j % cy + cy) % cy) * cx + ((i % cx + cx) % cx)]; return (G(x0, y0) * (1 - sx) + G(x0 + 1, y0) * sx) * (1 - sy) + (G(x0, y0 + 1) * (1 - sx) + G(x0 + 1, y0 + 1) * sx) * sy; }; };
  const fbm = (seed, b, o = 4) => { const ns = [...Array(o)].map((_, k) => nz(seed + k * 97, b << k)); return (x, y) => { let v = 0, a = .5, t = 0; for (const n of ns) { v += n(x, y) * a; t += a; a *= .5; } return v / t; }; };
  const mx = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const sm = (a, b, t) => { t = Math.min(1, Math.max(0, (t - a) / (b - a))); return t * t * (3 - 2 * t); };
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  const wrap = f => { for (const dx of [-N, 0, N]) for (const dy of [-N, 0, N]) { g.save(); g.translate(dx, dy); f(); g.restore(); } };
  const put = (layer, fn, strokes) => {
    const im = g.createImageData(N, N);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = fn(x, y), i = (y * N + x) * 4; im.data[i] = c[0]; im.data[i + 1] = c[1]; im.data[i + 2] = c[2]; im.data[i + 3] = 255; }
    g.putImageData(im, 0, 0); if (strokes) strokes();
    const d = g.getImageData(0, 0, N, N).data; out.set(d, layer * N * N * 4);
    let r = 0, gg = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; } const n = d.length / 4 * 255;
    avg[layer * 3] = r / n; avg[layer * 3 + 1] = gg / n; avg[layer * 3 + 2] = b / n;
  };
  put(0, () => [200, 200, 200]);
  { const gm = fbm(11, 3), gd = fbm(23, 2), gs = nz(31, 32); // grass
    put(M_GRASS, (x, y) => { const m = gm(x, y), d = Math.max(0, gd(x, y) - .58) * 3; let c = mx([62, 104, 38], [112, 146, 56], m); c = mx(c, [134, 126, 72], Math.min(.5, d)); return c.map(v => v * (.86 + gs(x, y) * .28)); },
      () => { for (let k = 0; k < 2600; k++) { const x = R() * N, y = R() * N, l = 2 + R() * 4, a = -Math.PI / 2 + (R() - .5) * .9, col = R() < .5 ? `rgba(${40 + R() * 30},${80 + R() * 40},${24 + R() * 20},.55)` : `rgba(${120 + R() * 50},${160 + R() * 40},${60 + R() * 30},.45)`; wrap(() => { g.strokeStyle = col; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }); } }); }
  { const bn = nz(41, 64), bs = fbm(43, 2), BW = 32, BH = 12, shade = [...Array(400)].map(() => [R(), R()]); // brick
    put(M_BRICK, (x, y) => { const r = Math.floor(y / BH), off = r % 2 ? BW / 2 : 0, c = Math.floor((x + off) / BW) % (N / BW), bx = (x + off) % BW, by = y % BH, h = shade[(r * 17 + c) % 400];
      if (bx < 2 || by < 2) return [180, 172, 158].map(v => v * (.85 + bn(x, y) * .25));
      let col = mx([146, 62, 42], [178, 92, 58], h[0]); if (h[1] > .88) col = mx(col, [110, 60, 52], .6); if (h[1] < .08) col = mx(col, [196, 128, 88], .5);
      return col.map(v => v * (.82 + bn(x, y) * .3) * (1 - .12 * bs(x, y))); }); }
  { const rn = nz(51, 64), rm = fbm(53, 2), TW = 21, TH = 17, t = [...Array(400)].map(() => R()); // clay roof tiles
    put(M_ROOF, (x, y) => { const r = Math.floor(y / TH), off = r % 2 ? TW / 2 : 0, c = Math.floor((x + off) / TW), tx = ((x + off) % TW) / TW, ty = (y % TH) / TH, h = t[(r * 13 + c * 7) % 400];
      let col = mx([160, 72, 44], [190, 102, 60], h); if (h > .93) col = mx(col, [98, 58, 46], .55); col = mx(col, [120, 118, 96], Math.max(0, rm(x, y) - .6) * 1.4);
      return col.map(v => v * (.72 + .38 * Math.sin(tx * Math.PI)) * (ty > .82 ? .62 : 1) * (.85 + rn(x, y) * .3) * (.78 + .22 * ty)); }); }
  { const kA = nz(61, 14, 2), kB = nz(62, 28, 4), kC = nz(63, 64, 20), kw = nz(64, 2, 1), kCr = nz(65, 10, 2), kl = fbm(67, 3); // bark
    put(M_BARK, (x, y) => { const wx = (x + kw(x, y) * 20 + N) % N, v = kA(wx, y) * .55 + kB(wx, y) * .3 + kC(wx, y) * .15, d = Math.abs(kCr(wx, y) * .7 + kB(wx, y) * .3 - .5), crack = 1 - sm(.012, .05, d), lip = sm(.05, .09, d) * (1 - sm(.09, .16, d));
      let c = mx([70, 60, 52], [112, 98, 84], v); c = mx(c, [134, 118, 100], lip * .5); c = mx(c, [30, 24, 20], crack * .9); c = mx(c, [120, 132, 100], Math.max(0, kl(x, y) - .64) * 2 * (1 - crack));
      return c.map(q => q * (.86 + R() * .2 * (1 - crack))); }); }
  { const ln = fbm(71, 3); put(M_LEAF, () => [35, 64, 28], () => { for (let k = 0; k < 900; k++) { const x = R() * N, y = R() * N, s = 3 + R() * 4, a = R() * 7, v = ln(x, y) * .6 + R() * .4, col = `rgb(${34 + v * 90},${66 + v * 100},${26 + v * 40})`; wrap(() => { g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, s, s * .45, 0, 0, 7); g.fill(); g.restore(); }); } }); }
  { const pn = fbm(81, 4), pg = nz(82, 128); put(M_PLASTER, (x, y) => { const v = .9 + pn(x, y) * .12 + pg(x, y) * .06 - Math.max(0, pn(x, y) - .7) * .3; return [226, 218, 204].map(q => q * v); }); }
  { const sn = nz(91, 64), sb = [...Array(300)].map(() => R()); // dressed stone blocks, uneven courses
    put(M_STONE, (x, y) => { const r = Math.floor(y / 20), off = (r * 37) % 44, c = Math.floor((x + off) / 44), bx = (x + off) % 44, by = y % 20, h = sb[(r * 11 + c) % 300];
      if (bx < 2 || by < 2) return [120, 116, 108].map(v => v * (.9 + sn(x, y) * .2));
      return mx([168, 160, 146], [206, 198, 182], h).map(v => v * (.84 + sn(x, y) * .26) * (Math.min(bx, 44 - bx, by, 20 - by) < 4 ? .93 : 1)); }); }
  { const wn = nz(101, 4, 64), wk = [...Array(64)].map(() => R()); // weathered planks
    put(M_PLANK, (x, y) => { const p = Math.floor(y / 16), py = y % 16, h = wk[p % 64], grain = wn((x + h * 200) % N, y); if (py < 1.5) return [58, 44, 34];
      return mx([122, 90, 62], [168, 130, 92], h).map(v => v * (.78 + grain * .36) * (py > 13 ? .9 : 1)); }); }
  { const cn = nz(111, 64), cs = [...Array(900)].map(() => R()); // cobbles: rounded setts in rows
    put(M_COBBLE, (x, y) => { const r = Math.floor(y / 16), off = r % 2 ? 8 : 0, c = Math.floor((x + off) / 16), sx = ((x + off) % 16) / 16 - .5, sy = (y % 16) / 16 - .5, d = Math.hypot(sx * 1.1, sy), h = cs[(r * 31 + c) % 900];
      if (d > .46) return [74, 70, 64]; return mx([118, 112, 104], [162, 154, 142], h).map(v => v * (1.05 - d * .5) * (.9 + cn(x, y) * .2)); }); }
  { const an = nz(121, 128), am = fbm(122, 3); put(M_ASPHALT, (x, y) => { const v = .85 + an(x, y) * .25 + (R() - .5) * .12 - Math.max(0, am(x, y) - .66) * .4; return [78, 80, 84].map(q => q * v); }); }
  { const en = fbm(131, 4), es = nz(132, 128); put(M_EARTH, (x, y) => mx([118, 92, 64], [156, 128, 92], en(x, y)).map(v => v * (.84 + es(x, y) * .3))); }
  { const sn = nz(141, 64), sh = [...Array(600)].map(() => R()); // slates: overlapping grey rectangles
    put(M_SLATE, (x, y) => { const r = Math.floor(y / 14), off = r % 2 ? 9 : 0, c = Math.floor((x + off) / 18), sx = (x + off) % 18, sy = y % 14, h = sh[(r * 23 + c) % 600];
      if (sx < 1 || sy < 1.2) return [40, 42, 48]; return mx([78, 82, 92], [118, 122, 132], h).map(v => v * (.86 + sn(x, y) * .22) * (.8 + .2 * sy / 14)); }); }
  { const sn = fbm(151, 3), sg = nz(152, 128); put(M_SOIL, (x, y) => { const f = Math.sin(y / N * 32 * Math.PI) * .5 + .5; return mx([96, 70, 48], [140, 106, 76], sn(x, y) * .6 + f * .4).map(v => v * (.85 + sg(x, y) * .25) * (.8 + .2 * f)); }); } // ploughed furrows
  { const cn = nz(161, 64); put(M_CROP, (x, y) => [150, 140, 90].map(v => v * (.8 + cn(x, y) * .3)), () => { for (let k = 0; k < 3200; k++) { const x = R() * N, y = R() * N, l = 3 + R() * 5, v = R(); wrap(() => { g.strokeStyle = `rgba(${90 + v * 120},${80 + v * 110},${40 + v * 50},.6)`; g.lineWidth = .9; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 2, y - l); g.stroke(); }); } }); } // standing stalks
  { const sn = fbm(171, 4), sg = nz(172, 128); put(M_SAND, (x, y) => mx([206, 186, 144], [232, 216, 178], sn(x, y)).map(v => v * (.9 + sg(x, y) * .15 + (R() - .5) * .06))); }
  { const tn = nz(181, 128); put(M_TAR, (x, y) => { const v = .8 + tn(x, y) * .3 + (R() - .5) * .18; return [120, 118, 112].map(q => q * v); }); } // gravel and tar on flat roofs
  { const gn = fbm(191, 2); put(M_GLASS, (x, y) => { const px = x % 32, py = y % 42, frame = px < 3 || py < 3; if (frame) return [150, 156, 164]; const sky = gn(x, y), v = .7 + .5 * sky + (py / 42) * .15; return [110 * v, 150 * v, 180 * v]; }); } // curtain wall panes
  { const tn = nz(201, 8, 64), tb = fbm(203, 2); put(M_THATCH, (x, y) => { const cw = Math.floor(y / 32), sy = (y % 32) / 32, v = tn((x + cw * 37) % N, y) * .7 + tb(x, y) * .3; // straw laid in courses, each a little darker at its lower edge
      return mx([118, 92, 52], [196, 164, 104], v).map(q => q * (.72 + .3 * sy)); }, () => { for (let k = 0; k < 2400; k++) { const x = R() * N, y = R() * N, l = 5 + R() * 9, v = R(); wrap(() => { g.strokeStyle = `rgba(${150 + v * 80},${118 + v * 70},${60 + v * 40},.5)`; g.lineWidth = .8; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - .5) * 1.5, y + l); g.stroke(); }); } }); }
  { const Z = N * N * 4; out.copyWithin(M_NEEDLE * Z, M_LEAF * Z, (M_LEAF + 1) * Z); for (let q = 0; q < 3; q++) avg[M_NEEDLE * 3 + q] = avg[M_LEAF * 3 + q]; }
  return { data: out, avg };
}
// what a building's walls are made of
function glWallMat(B) { if (!B) return M_PLASTER; if (B.type === 'house' && B.tier >= 6) return M_GLASS; if (B.mat === 'brick') return M_BRICK; if (B.mat === 'stone') return M_STONE; if (B.mat === 'wood') return M_PLANK; return M_PLASTER; }
const ROAD_MAT = [0, M_EARTH, M_EARTH, M_COBBLE, M_BRICK, M_ASPHALT, M_PLASTER, 0];
