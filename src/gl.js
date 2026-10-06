/* ============================== the world in real 3D (WebGL2) ============================== */
// The world is drawn as real 3D geometry with WebGL2. While a chunk is being built (GLB set), the building art's
// primitives in render.js (box, cyl, cone, dome, roofs, windows, doors, flat) emit triangles; types with a native model
// (GL_MODEL, GL_BIG) are built straight in world units. Terrain, water, roads, trees, lamps and people
// are built here. Lighting is per pixel, every frame: the sun (or moon) with a shadow map, sky and ground ambient,
// lit windows at night, and street lamps as real point lights.
const GL3 = { on: false, c: null, gl: null, chunks: [], dirty: new Set(), cam: { yaw: Math.PI / 4, pitch: .62, zoom: 14, tx: 32, ty: 0, tz: 32, auto: true, persp: true }, lamps: [], hr: [null, 13, 18.6, 20.4, 23.5], hi: 0, drag: null, town: 0, t: 0 };
const GPID = 1 << 20, GCH = 8, GNC = W / GCH, ZS = 1 / 22; // chunk size in tiles; height units (22 to a tile) to tiles
let GLB = null; // the chunk being built: { v: floats, x, y, base (tile), tops: [[sx, sy, z]] }

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
// tile-local to world: u, v in tiles from the middle of the tile (or lot) being built, z in height units (22 to a tile)
function gw(u, v, z) { return [GLB.x + u, GLB.base + z * ZS, GLB.y + v]; }
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
function glBox(u0, v0, hw, hd, z0, h, col, top) {
  if (dsRound()) return glCylAt(u0, v0, Math.max(hw, hd) * 1.08, z0, h, col, top); // (round styles build round)
  const c = gcol(col), ct = top ? gcol(top) : c, P = (u, v, z) => gw(u0 + u, v0 + v, z), z1 = z0 + h; GLB.ctr = P(0, 0, z0 + h / 2);
  if (GLB.wall && h >= 6) GLB.wallC = c; // (the trim of its windows and doors is tinted from it)
  GLB.mat = GLB.wall && z1 > 6 ? M_TAR : 0; gquad(P(-hw, -hd, z1), P(-hw, hd, z1), P(hw, hd, z1), P(hw, -hd, z1), ct); GLB.mat = GLB.wall || 0;
  gquad(P(-hw, hd, z0), P(hw, hd, z0), P(hw, hd, z1), P(-hw, hd, z1), c);
  gquad(P(hw, hd, z0), P(hw, -hd, z0), P(hw, -hd, z1), P(hw, hd, z1), c);
  gquad(P(hw, -hd, z0), P(-hw, -hd, z0), P(-hw, -hd, z1), P(hw, -hd, z1), c);
  gquad(P(-hw, -hd, z0), P(-hw, hd, z0), P(-hw, hd, z1), P(-hw, -hd, z1), c);
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
function glFlat(u0, v0, hw, hd, z, col) {
  GLB.mat = GLB.flat === 'farm' ? (col === '#bd8f68' ? M_SOIL : M_CROP) : GLB.flat === 'green' ? M_GRASS : GLB.flat === 'paved' ? M_STONE : 0;
  if (GLB.mat === M_CROP && hd < .1 || GLB.mat === M_CROP && hw < .1) { const sv = GLB.wall; GLB.wall = M_CROP; glBox(u0, v0, hw < .1 ? hw * .75 : hw, hd < .1 ? hd * .75 : hd, 0, z + .9, col); GLB.wall = sv; return; } // a crop row stands up
  const c = gcol(col), P = (u, v) => gw(u0 + u, v0 + v, z + .25); GLB.ctr = gw(u0, v0, z - 20);
  gquad(P(-hw, -hd), P(-hw, hd), P(hw, hd), P(hw, -hd), c);
}
function glCylAt(u, v, r, z0, h, col, top, n = 12) {
  const c = gcol(col), ct = top ? gcol(top) : c, P = (a, z) => gw(u + Math.cos(a) * r, v + Math.sin(a) * r, z), C = gw(u, v, z0 + h); GLB.ctr = gw(u, v, z0 + h / 2);
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; GLB.mat = GLB.wall || 0; gquad(P(a, z0), P(b, z0), P(b, z0 + h), P(a, z0 + h), c); GLB.mat = 0; gtri(C, P(b, z0 + h), P(a, z0 + h), ct); }
  if (GLB.lod && GLB.wall && h > 8 && r > .07) { GLB.lod = false; const bc = tintS(c, .4); glCylAt(u, v, r * 1.05, z0 + h - 1.1, 1.1, bc, bc, n); GLB.lod = true; } // a band round the top of a tower
}
function glDomeAt(u, v, r, z0, h, col, e = 0, mat = 0) {
  GLB.ctr = gw(u, v, z0); GLB.mat = mat; const c = gcol(col), n = 12, m = 4, P = (a, t) => gw(u + Math.cos(a) * r * Math.cos(t), v + Math.sin(a) * r * Math.cos(t), z0 + h * Math.sin(t));
  for (let j = 0; j < m; j++) { const t0 = j / m * Math.PI / 2, t1 = (j + 1) / m * Math.PI / 2; for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gquad(P(a, t0), P(b, t0), P(b, t1), P(a, t1), c, e); } }
}
function glBall(u, v, r, zc, rz, col, e = 0, mat = 0) { glDomeAt(u, v, r, zc, rz, col, e, mat); glDomeAt(u, v, r, zc, -rz, col, e, mat); }
function roofMat(c) { return c[0] > .6 && c[1] > .5 && c[2] < .5 && c[0] - c[2] > .25 && c[1] - c[2] > .15 ? M_THATCH : c[0] > c[2] + .1 && c[0] > c[1] ? M_ROOF : M_SLATE; } // straw-coloured roofs are thatched, red and brown ones tiled, grey and blue ones slated
// windows on all four walls (the camera can go round now); em in (0, 1) = a window, lit when em < the night's lit fraction
function glWindows(u0, v0, hw, hd, z0, h, floors, cols, col) {
  const c = gcol(col), fh = h / floors, e = .006;
  if (GLB.lod && GLB.B && GL_PROPER(GLB.wall) && floors >= 3 && z0 < 1 && hw >= .15 && hd >= .15 && glOld()) glFacade(gw(u0, v0, 0), hw, hd, z0, h, floors, cols, GLB.wallC || [.8, .75, .68]);
  GLB.ctr = gw(u0, v0, z0 + h / 2);
  for (let f = 0; f < floors; f++) {
    const zb = z0 + f * fh + fh * .32, wh = fh * .42;
    for (let k = 0; k < cols; k++) {
      const t = (k + .5) / cols, wu = hw * 2 / cols * .42, wv = hd * 2 / cols * .42, u = -hw + t * hw * 2, v = -hd + t * hd * 2;
      const em = (i) => .03 + .94 * hash2((GLB.x * 7 + k * 13 + i) | 0, (GLB.y * 5 + f * 31 + (zb | 0)) | 0, 71);
      const P = (uu, vv, zz) => gw(u0 + uu, v0 + vv, zz);
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
function glMansard(u0, v0, hw, hd, z, rh, col) {
  const c = gcol(col), rm = roofMat(c), o = .03, P = (u, v, zz) => gw(u0 + u, v0 + v, zz), zb = z + rh * .72, iw = hw * .8, id = hd * .8; GLB.ctr = P(0, 0, z - 1);
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
    U8[o + 19] = e < -.5 ? 0 : e === 0 ? 1 : e >= 2.5 ? 254 : e >= 1.5 ? 255 : Math.min(252, 2 + Math.round(e * 250)); // (-1 water, 0, a window's (0, 1), 2 a lamp, 3 a glow of its own colour)
    F[f + 5] = v[s + 10]; U8[o + 24] = v[s + 11]; U8[o + 25] = c8(v[s + 12]);
  }
  return { buf, n, y0, y1 };
}
function glUpload(ch, v, near) { // into the chunk's far (always) or near (close to the camera, more detail) buffer
  const gl = GL3.gl, P = glPack(v);
  if (near) { if (!ch.nb) ch.nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ch.nb); gl.bufferData(gl.ARRAY_BUFFER, P.buf, gl.STATIC_DRAW); ch.nn = P.n; ch.near = true; ch.stale = false; }
  else { gl.bindBuffer(gl.ARRAY_BUFFER, ch.buf); gl.bufferData(gl.ARRAY_BUFFER, P.buf, gl.STATIC_DRAW); ch.n = P.n; ch.y0 = P.y0; ch.y1 = P.y1; }
}
function glDropNear(ch) { if (ch.nb) { GL3.gl.deleteBuffer(ch.nb); ch.nb = null; } ch.nn = 0; ch.near = false; ch.stale = false; }
// the view's six planes, to skip chunks outside it
function glFrustum(m) { const r = i => [m[i], m[4 + i], m[8 + i], m[12 + i]], R3 = r(3), o = []; for (let i = 0; i < 3; i++) { const Ri = r(i); o.push(R3.map((v, j) => v + Ri[j]), R3.map((v, j) => v - Ri[j])); } return o; }
function glSees(P, ch, k) {
  const x0 = (k % GNC) * GCH - 3.8, z0 = ((k / GNC) | 0) * GCH - 3.8, x1 = x0 + GCH + 5, z1 = z0 + GCH + 5, y0 = Math.min(ch.y0, 0) - .2, y1 = ch.y1 + .3; // (padded: big lots and piers reach past their chunk)
  for (const p of P) if (p[0] * (p[0] > 0 ? x1 : x0) + p[1] * (p[1] > 0 ? y1 : y0) + p[2] * (p[2] > 0 ? z1 : z0) + p[3] < 0) return false;
  return true;
}
function glBuildChunk(k, near = false) { const v = [], lamps = []; glBuildRows(k, near, 0, GCH, v, lamps); return { v: new Float32Array(v), lamps }; }
// some rows of a chunk (the detailed version is built a row or two a frame, so it never stalls the view)
function glBuildRows(k, near, r0, r1, v, lamps, c0 = 0, c1 = GCH) {
  const cx0 = (k % GNC) * GCH, cy0 = ((k / GNC) | 0) * GCH;
  const svLT = LT; LT = GLT_FLAT();
  try {
    for (let y = cy0 + r0; y < cy0 + r1; y++) for (let x = cx0 + c0; x < cx0 + c1; x++) {
      const i = idx(x, y), h = GT(i);
      GLB = { v, x, y, base: surfZ(i) * ZS, id: i + 1, wall: 0, mat: 0, lod: near, ctr: null, wallC: null, flat: '', ao: 1, B: null, smk: null }; // (every field up front: one shape keeps the primitives fast)
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
      // what stands on the tile (render.js)
      { const Bw = M.bld[i] && S.B[M.bld[i]]; GLB.wall = Bw ? glWallMat(Bw) : M_PLANK; GLB.B = Bw || null; GLB.smk = lamps.smk || (lamps.smk = []); } // walls by what the building is made of; street furniture is wooden
      try { drawTileObjects(i, x, y); } catch (e) { if (QS.has('dev')) console.error(e); }
      const B = M.bld[i] && S.B[M.bld[i]];
      if (B && !B.hid && FLAT_TYPES[B.type]) { GLB.flat = B.type === 'farm' ? 'farm' : B.type === 'park' || B.type === 'pasture' ? 'green' : B.type === 'plaza' || B.type === 'airfield' ? 'paved' : ''; try { drawBuilding(B, i); } catch (e) { if (QS.has('dev')) console.error(e); } GLB.flat = ''; }
    }
  } finally { GLB = null; LT = svLT; }
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
const TREE_LV = { oaks: 1, pines: 2, birches: 3, blossom: 5, maples: 6 }, T_BLOSSOM = ['#f2a6c8', '#f7c1d9', '#e98fb8', '#fbd3e3'], T_MAPLE = ['#c8402a', '#d8602a', '#b83a30', '#e07a30'];
function glTrees(i, x, y) {
  const n = M.tree[i], b = GT(i), lt = TREE_LV[LVV.trees];
  for (let k = 0; k < n; k++) { const tt = lt && hash2(x, y, 55 + k) < .82 ? lt : M.ttype[i]; // (the trees the custom loves, and a few others)
    let u = (hash2(x, y, k * 3 + 1) - .5) * .6, v = (hash2(x, y, k * 3 + 2) - .5) * .6; if (n === 1) { u *= .4; v *= .4; }
    const s = .8 + hash2(x, y, k * 3 + 3) * .45, hv = hash2(x, y, 90 + k), X = x + u, Z = y + v;
    if (tt === 2) { GLB.mat = M_BARK; glBoxW(X, Z, .03 * s, b, 4 * s * ZS, '#6b5a55'); GLB.mat = M_NEEDLE; const c = gcol(leafC(hv < .5 ? '#3f6f4a' : '#35604a')); const A = [X, b + 18 * s * ZS, Z]; GLB.ctr = [X, b, Z]; for (let j = 0; j < 8; j++) { const a0 = j / 8 * TAU, a1 = (j + 1) / 8 * TAU, r = .2 * s; gtri([X + Math.cos(a0) * r, b + 3 * s * ZS, Z + Math.sin(a0) * r], [X + Math.cos(a1) * r, b + 3 * s * ZS, Z + Math.sin(a1) * r], A, c); } }
    else if (tt === 3) { GLB.mat = 0; glBoxW(X, Z, .022 * s, b, 12 * s * ZS, '#ece8df'); GLB.base = b; glBall(X - GLB.x, Z - GLB.y, .14 * s, 13 * s, 5.5 * s, leafC(hv < .5 ? '#8fb35a' : '#9dbb62'), 0, M_LEAF); } // birch
    else { GLB.mat = M_BARK; glBoxW(X, Z, .03 * s, b, 7 * s * ZS, tt === 4 ? '#7b5e4e' : '#6b5040'); GLB.base = b; glBall(X - GLB.x, Z - GLB.y, .2 * s, 10 * s, 4.6 * s, leafC(tt === 5 ? T_BLOSSOM[(hv * 4) | 0] : tt === 6 ? T_MAPLE[(hv * 4) | 0] : tt === 4 ? '#6db873' : G_PUFF[(hv * G_PUFF.length) | 0]), 0, M_LEAF); }
  }
  GLB.base = surfZ(i) * ZS;
}
/* ---------- foliage and small life: tufts, flowers, bushes and trees ---------- */
// small things drawn at a screen point; a negative cy with no cx is art lifting them onto a roof
function glBlob(u, v, r, zc, rz, col, mat = M_LEAF) { // a low-poly ball (bushes, flowers, sheep)
  const c = gcol(col), n = 7, P = (a, t) => gw(u + Math.cos(a) * r * Math.cos(t), v + Math.sin(a) * r * Math.cos(t), zc + rz * Math.sin(t)); GLB.ctr = gw(u, v, zc); GLB.mat = mat;
  for (let j = -2; j < 2; j++) { const t0 = j / 2 * Math.PI / 2, t1 = (j + 1) / 2 * Math.PI / 2; for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gquad(P(a, t0), P(b, t0), P(b, t1), P(a, t1), c); } }
}
function glTuftUV(u, v, z, col) { // a clump of grass blades
  const c = gcol(mix(col, '#3f6f35', .35)), h0 = hash2((u * 97) | 0, (v * 89) | 0, 7); GLB.mat = 0; GLB.ctr = gw(u, v, z - 5);
  for (let k = 0; k < 6; k++) { const a = (h0 + k / 6) * TAU, du = Math.cos(a) * .012, dv = Math.sin(a) * .012, ou = Math.cos(a * 3) * .03, ov = Math.sin(a * 3) * .03; gtri(gw(u + ou - dv, v + ov + du, z), gw(u + ou + dv, v + ov - du, z), gw(u + ou * 1.8, v + ov * 1.8, z + 1.2 + (k % 3) * .35), c); }
}
function glFlowersUV(u, v, z, h) { // a clump of stems and blooms
  GLB.mat = 0;
  for (let k = 0; k < 3; k++) { const du = (k - 1) * .05, dv = ((k % 2) - .5) * .05; glBoxW(GLB.x + u + du, GLB.y + v + dv, .006, GLB.base + z * ZS, 1.4 * ZS, '#4f8a45'); glBlob(u + du, v + dv, .022, z + 1.6, .6, FLOWERS[(((h * 17) | 0) + k) % FLOWERS.length], 0); }
}
function glSmallTree(u, v, z, h, s, col) { // street, garden and park trees: a trunk and a leafy crown
  const lt = LVV.trees; if (lt === 'blossom') col = T_BLOSSOM[((h * 7) | 0) % 4]; else if (lt === 'maples') col = T_MAPLE[((h * 7) | 0) % 4]; else if (lt === 'birches') col = '#9dbb62';
  GLB.mat = M_BARK; glBoxW(GLB.x + u, GLB.y + v, .022 * s, GLB.base + z * ZS, 5 * s * ZS, '#6b5040');
  glBlob(u, v, .15 * s, z + 7 * s, 3.4 * s, leafC(col)); glBlob(u + .05 * s, v - .04 * s, .1 * s, z + 9 * s, 2.4 * s, leafC(col));
}
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
// The harbour by the age: a timber wharf, then the docklands (Steam: a brick warehouse range with copper roofs, stone piers,
// portal cranes, cargo on the quay), the container port (Computing), and the port of the far future (Fusion: a glass terminal,
// white gantries, floating piers edged with light). works.js swings the cranes and runs the gantries.
const harbourStage = () => hasTech('fusion') ? 3 : hasTech('computing') ? 2 : hasTech('steam') ? 1 : 0;
function glHarbour(B) {
  const d = B.dir || [1, 0], a = d[0] ? [0, 1] : [1, 0], L = berths(B), [lx, lz] = glLot(B), ys = SEAZ * ZS - .02;
  let y = 0; for (const j of fpTiles(B)) if (!M.water[j]) y = Math.max(y, surfZ(j) * ZS); if (!y) y = GLB.base; // (the quay is level with the land, also where it's built out over the water)
  const steel = hasTech('steam'), boxes = hasTech('computing'), brick = hasTech('brick');
  const P = (s, t, yy = y) => [lx + a[0] * s + d[0] * t, yy, lz + a[1] * s + d[1] * t], A3 = [a[0], 0, a[1]], D3 = [d[0], 0, d[1]];
  gBox(P(0, 0, y - .005), V3s(A3, L / 2), V3s(D3, .5), .03, B.style >= 3 || steel ? '#bdb5a7' : '#b9a488', M_STONE); // the quay
  gBox(P(0, .5, ys - .05), V3s(A3, L / 2), V3s(D3, .035), y - ys + .079, '#a39a8c', M_STONE); // its wall down into the water
  for (const sg of [-1, 1]) gBox(P(sg * L / 2, 0, ys - .05), V3s(A3, .035), V3s(D3, .5), y - ys + .079, '#a39a8c', M_STONE); // and its ends
  const hs = harbourStage(); if (hs === 1 || hs === 3) return (hs === 1 ? harbourDocks : harbourFuture)(B, { y, ys, L, P, A3, D3, lx, lz }); // (the docklands of the age of steam, and the port of the far future: their own art below)
  for (let k = 0; k <= L * 3; k++) gBox(P(-L / 2 + k / 3 + .02, .45), [.014, 0, 0], [0, 0, .014], .045, '#3a3c42'); // bollards
  for (let k = 0; k <= L; k++) { // piers between the berths, on posts
    const s = -L / 2 + k + (k === 0 ? .05 : k === L ? -.05 : 0);
    gBox(P(s, .93, y - .01), V3s(A3, .045), V3s(D3, .43), .022, steel ? '#8f877a' : '#8a6a4c', steel ? M_STONE : M_PLANK);
    for (const t of [.62, .95, 1.28]) gBox(P(s, t, ys - .06), [.012, 0, 0], [0, 0, .012], y - ys + .05, '#5a4a3c', M_PLANK);
  }
  for (let k = 0; k < L; k++) {
    const s = -L / 2 + k + .5, h = hash2(B.x + k, B.y, 5);
    // a warehouse at the back of each berth (kit.js): loading doors up its front under a hoist, windows, a gable or a flat roof
    const wh = (boxes ? 13 : steel ? 11 : 9) * ZS, wall = boxes ? '#98a2ab' : brick ? '#b8684f' : '#c8a77a', wm = boxes ? M_PLASTER : brick ? M_BRICK : M_PLANK, c = P(s, -.24), fl = boxes ? 3 : 2, fh = (wh - .02) / fl;
    kSet(c[0], c[2], A3, D3, B.id * 7 + k); KF.y0 = y;
    kPlinth(-.4, .4, -.2, .2, .02, '#a39a8c'); kBox(0, 0, .02, .4, .2, wh - .02, wall, wm);
    kWins(-.4, .4, .2, .02, fh, fl, 5, { ty: boxes ? 'modern' : 'sash', hk: .48, arch: brick && !boxes ? 'seg' : null, wall, back: 1 }, q => q === 3, 0);
    kWins(-.4, .4, -.2, .02, fh, fl, 4, { back: 1 }, null, 20);
    kBox(.24, .2, .02, .055, .006, Math.min(.18, fh * .85), '#4a3a30', M_PLANK); // the big door
    for (let f = 1; f < fl; f++) kBox(.24, .2, .02 + f * fh + fh * .15, .04, .006, fh * .6, '#5a4a3c', M_PLANK); // loft doors above it
    if (KF.lod) { kBeam([.24, .2, wh - .01], [.24, .3, wh - .01], .007, '#5a4a3c', M_PLANK); kBeam([.24, .29, wh - .01], [.24, .29, wh * .45], .0015, '#3a3028'); kBox(0, .204, wh - .05, .2, .003, .028, boxes ? '#2f3a44' : '#efe2c0'); } // the hoist, its rope; the company's name
    if (boxes) kFlat(-.4, .4, -.2, .2, wh, wall, .03); else kGable(-.4, .4, -.2, .2, wh, 4.5 * ZS, steel ? '#5d6670' : '#a0523c', { wall, wm });
    // a crane at each berth
    if (boxes) { // gantry: four legs, a beam and a boom out over the ship
      const hc = .95, col = h < .5 ? '#d6703a' : '#3f6f9f';
      for (const [sa, ta] of [[-.14, .12], [.14, .12], [-.14, .42], [.14, .42]]) gBeam(P(s + sa, ta), P(s + sa, ta, y + hc), .014, col);
      for (const sa of [-.14, .14]) gBeam(P(s + sa, -.05, y + hc), P(s + sa, 1.3, y + hc), .016, col);
      // (its trolley and what it lifts move: works.js, glHarbourCranes)
    } else {
      const hc = (steel ? 16 : 11) * ZS, col = steel ? '#c8603a' : '#8a6446';
      gBox(P(s - .22, .32), [.022, 0, 0], [0, 0, .022], hc, col, steel ? 0 : M_PLANK); // (the jib swings: works.js)
    }
    // cargo on the quay
    if (boxes) { const cols = ['#c0584f', '#3f7fb0', '#e0a43a', '#4e9a6a', '#7a5a9a']; for (let r2 = 0; r2 < 2; r2++) for (let c2 = 0; c2 < 3; c2++) { const nH = 1 + ((hash2(B.x + k, r2 * 3 + c2, 9) * 3) | 0); for (let l = 0; l < nH; l++) gBox(P(s - .25 + c2 * .17, .1 + r2 * .1, y + .03 + l * .05), V3s(A3, .075), V3s(D3, .04), .048, cols[(k + r2 + c2 + l) % cols.length]); } }
    else for (let c2 = 0; c2 < 4; c2++) { const hh = hash2(B.x + k, c2, 13); gBox(P(s - .1 + c2 * .08, .18 + (c2 % 2) * .07), [.028, 0, 0], [0, 0, .028], .05 + hh * .03, hh < .5 ? '#a57c55' : '#8a6a4c', M_PLANK); }
  }
  // the quayside (kit.js): a coping along the edge, cobbles, mooring rings and ladders, lamps, nets and fish boxes, a harbourmaster's office
  kSet(lx, lz, A3, D3, B.id); KF.y0 = y; const lod = KF.lod;
  kBox(0, .47, .025, L / 2, .03, .012, '#cfc6b4', M_STONE); // the coping stones
  if (B.style >= 2 || steel) kBox(0, .05, .025, L / 2 - .01, .38, .004, '#a39a8c', M_COBBLE);
  if (lod) for (let k = 0; k < L * 3; k++) { const s = -L / 2 + (k + .5) / 3; kCyl(s, .5, .005, .012, .003, '#3a3c42', 0, 8, 0); // a mooring ring, and now and then a ladder down the wall
    if (k % 3 === 1) { for (const dd of [-.012, .012]) kBox(s + .08 + dd, .505, ys - y, .002, .002, y - ys + .03, '#3a3c42'); for (let yy = ys - y + .02; yy < .03; yy += .025) kBox(s + .08, .505, yy, .014, .002, .002, '#3a3c42'); } }
  for (const s of [-L / 2 + .06, L / 2 - .06]) cLampPost(s, .4, .4);
  if (lod) for (let k = 0; k < L; k++) { const s = -L / 2 + k + .5; if (hash2(B.x + k, B.y, 31) < .5) { kBlob(s + .36, .4, .03, .05, .02, '#5a6a5a', 0); kBlob(s + .4, .37, .025, .035, .015, '#6a5a4a', 0); } // nets in a heap
    for (let q = 0; q < 3; q++) kBox(s - .38 + q * .045, .4, .03 + (q === 2 ? .025 : 0), .018, .014, .022, q % 2 ? '#8fa8b8' : '#a8b8c0'); } // fish boxes
  if (L >= 2 && !boxes) { const hs = L / 2 - .12, wc = brick ? '#b8684f' : '#e8e2d6'; kBox(hs, -.05, .03, .07, .06, .16, wc, brick ? M_BRICK : M_PLASTER); kWin(hs, .01, .09, .022, .05, 7, { ty: kWinTy() === 'glass' ? 'modern' : kWinTy() }); // the harbourmaster's office
    kDoor(hs - .045, .01, .018, .1, '#3a5a6a', { ty: 'panel', y: .03 }); kHip(hs - .075, hs + .075, -.115, .015, .19, .06, '#5d6670', { ov: .015, noGut: 1 }); cFlag(hs, -.05, .25, .14, '#3f6f9f'); if (lod) kClock(hs, .012, .16, .018); }
}

const GL_BIG = {}; // the landmarks on their bigger lots: civic.js (hall, museum, theatre, station, market, university), modern.js (stadium, fusion)

/* ---------- building sites in 3D: rising walls (or the old house, being done up) in scaffolding, materials stacked by, a crane on tall ones ---------- */
function glBuildSite(B, st, f, hh) {
  const C0 = gw(0, 0, 0), x = C0[0], z = C0[2], y = GLB.base, steel = hasTech('concrete'), pole = steel ? '#8c939b' : '#a07f58', plank = steel ? '#b8a37a' : '#8f6f4c';
  let top = 0, hw = .3;
  if (B.type === 'house' && B.up != null && B.tier >= 1) { const sv = B.prog; B.prog = 1; try { GL_MODEL.house(B, st); } finally { B.prog = sv; } top = HOUSE_H[B.tier] * .7; hw = .38; } // the old house stays up while it's done up
  else if (f >= .2) { const h = Math.max(2, hh * Math.min(1, (f - .2) / .8)); top = h; GLB.wall = GLB.B ? glWallMat(GLB.B) : M_PLASTER; box(0, 0, .28, .28, 0, h, st.wall); hw = .3; } // walls going up
  const H = Math.max(top + 3, f < .2 ? 3 : 0) * ZS, o = hw + .05, mat = steel ? 0 : M_PLANK;
  if (f >= .2 || top) {
    for (const [a, b] of [[-o, -o], [o, -o], [-o, o], [o, o], [0, o], [0, -o], [o, 0], [-o, 0]]) gBox([x + a, y, z + b], [.008, 0, 0], [0, 0, .008], H, pole, mat); // standards
    for (let lv = 4 * ZS; lv < H; lv += 5 * ZS) { // ledgers, with planks laid along two faces to stand on
      for (const [P0, P1] of [[[-o, -o], [o, -o]], [[o, -o], [o, o]], [[o, o], [-o, o]], [[-o, o], [-o, -o]]]) gBeam([x + P0[0], y + lv, z + P0[1]], [x + P1[0], y + lv, z + P1[1]], .005, pole, mat);
      GLB.mat = M_PLANK; glOBox([x, y + lv + .006, z + o], [o, 0, 0], [0, 0, .028], [0, .004, 0], plank); glOBox([x + o, y + lv + .006, z], [.028, 0, 0], [0, 0, o], [0, .004, 0], plank);
    }
    if (GLB.lod) gBeam([x - o, y, z + o], [x + o * .1, y + Math.min(H, 9 * ZS), z + o], .004, pole, mat); // a brace
  } else for (const [a, b] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) gBox([x + a, y, z + b], [.01, 0, 0], [0, 0, .01], 3 * ZS, '#8a6d57', M_PLANK); // pegs marking out the plot
  GLB.mat = M_BRICK; gBox([x + .36, y, z + .36], [.05, 0, 0], [0, 0, .035], 1.6 * ZS, steel ? '#b0aaa0' : '#b8684f', M_BRICK); // bricks on a pallet
  gBox([x + .36, y, z - .3], [.03, 0, 0], [0, 0, .08], 1.2 * ZS, '#9b7a54', M_PLANK); // and timber
  if (hh > 40 && f >= .3 && !(B.type === 'house' && B.up != null && hh < 60)) { // a tower crane on the tall ones
    const mx = x - .42, mz = z - .42, mh = hh * ZS * 1.15;
    gBox([mx, y, mz], [.022, 0, 0], [0, 0, .022], mh, '#e0a43a', 0);
    gBeam([mx - .25, y + mh, mz], [mx + .75, y + mh, mz + .2], .014, '#e0a43a'); gBox([mx - .22, y + mh - .05, mz - .01], [.04, 0, 0], [0, 0, .04], .06, '#7a7f86', 0); // jib and counterweight
    gBeam([mx + .5, y + mh, mz + .14], [mx + .5, y + top * ZS + .1, mz + .14], .002, '#3a3a3a'); // the hook line
  }
  GLB.wall = 0; GLB.mat = 0;
}

/* ---------- native models: buildings made straight in world units ---------- */
// glModel(B) picks the model a building is drawn with in 3D: a landmark on a bigger lot (GL_BIG), else one from
// GL_MODEL, else nothing and its older art (render.js primitives) builds it. New building art belongs here: move a type
// over by adding GL_MODEL[type] = (B, st) => {...}. Helpers: gBox/gBeam/gRoof/gSpire/gWins (world units: x, y = height,
// z), glCylAt/glDomeAt (tile-local u, v and heights in height units), gCone below; GLB.x/GLB.y is the tile, GLB.base
// its ground, GLB.lod true for the close-up version (put small detail behind it).
function glModel(B) { if (CIVX[B.type]) { const g = genOf(B); if (g) return (B, st) => CIVX[B.type](B, st, g); } return fpBig(B) && GL_BIG[B.type] || GL_MODEL[B.type] || null; } // (a public building rebuilt in a later age: civic.js CIVX)
function gCone(u, v, r, z0, h, col, n = 12) { // a cone standing on tile-local (u, v), from height z0 up h
  const c = gcol(col), A = gw(u, v, z0 + h); GLB.ctr = gw(u, v, z0 - 1); GLB.mat = roofMat(c);
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gtri(gw(u + Math.cos(a) * r, v + Math.sin(a) * r, z0), gw(u + Math.cos(b) * r, v + Math.sin(b) * r, z0), A, c); }
}
const GL_MODEL = {}; // (filled in by homes.js, civic.js, industry.js and modern.js)
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
uniform vec3 uSunD; uniform float uSunY, uCover; uniform vec4 uTint;
vec3 skyCol(vec3 v){ // in screen colour (after the tone curve)
  float day=smoothstep(-.1,.2,uSunY), gold=smoothstep(-.16,.02,uSunY)*(1.-smoothstep(.05,.42,uSunY));
  float mu=dot(v,uSunD), m=max(mu,0.), toward=pow(mu*.5+.5,4.), h=clamp(v.y,0.,1.);
  vec3 zen=mix(vec3(.03,.05,.12),vec3(.27,.49,.83),day), hor=mix(vec3(.07,.09,.17),vec3(.8,.88,.95),day);
  hor=mix(hor,vec3(1.,.6,.34),gold*toward); hor=mix(hor,vec3(.62,.52,.68),gold*(1.-toward)*.45); zen=mix(zen,vec3(.32,.35,.56),gold*.45);
  vec3 c=mix(hor,zen,pow(h,.5)); if(v.y<0.) c=hor*mix(1.,.86,clamp(-v.y*4.,0.,1.));
  c+=vec3(1.,.84,.6)*(pow(m,10.)*.26*(day*.5+gold)+pow(m,900.)*.4*day);
  c=mix(c,vec3(dot(c,vec3(.3,.59,.11)))*mix(.4,1.03,day),uCover*.72);
  c=mix(c,c*uTint.rgb,uTint.a); // (a sky the Watcher's words coloured)
  return clamp(c,0.,1.);
}
vec3 untone(vec3 c){ return -log(1.-min(c,vec3(.97)))/1.45; }`;
const GL_KVS = `#version 300 es
out vec2 vU; void main(){ vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2)); vU=p*2.-1.; gl_Position=vec4(vU,0.,1.); }`;
const SKY_TINT0 = [1, 1, 1, 0], SKY_TINT = { golden: [1.18, .98, .66, .6], rosy: [1.15, .84, .92, .6], violet: [.9, .78, 1.18, .6], green: [.84, 1.12, .9, .55] };
const GL_KFS = `#version 300 es
precision highp float; in vec2 vU; out vec4 o; uniform vec3 uF, uR, uU; uniform float uCT, uLo, uAur;` + GL_SKY + `
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.5+vn(p*2.03+3.1)*.27+vn(p*4.1+7.7)*.15+vn(p*8.3+1.3)*.08; }
void main(){
  vec3 v=normalize(uF+vU.x*uR+vU.y*uU), c=skyCol(v); float mu=dot(v,uSunD), day=smoothstep(-.1,.2,uSunY);
  float disc=smoothstep(.99982,.99992,mu)*smoothstep(-.03,.02,uSunY)*(1.-uCover*.8); c=mix(c,vec3(1.,.97,.9),disc);
  vec3 q=v*420., qc=floor(q); float st=fract(sin(dot(qc,vec3(12.9898,78.233,37.719)))*43758.5453); // stars: small round points, out once the sun is well down
  float night=1.-smoothstep(-.2,-.06,uSunY), pt=smoothstep(.34,.08,length(fract(q)-.5));
  c+=vec3(.9,.92,1.)*step(.9975,st)*pt*night*(1.-uCover)*smoothstep(0.,.2,v.y)*(.45+.55*fract(st*97.));
  if(uAur>0. && v.y>.04){ // an aurora: curtains of green and rose, swaying slowly
    vec2 p=v.xz/(v.y+.35); float w=fb(p*1.1+vec2(uCT*.01,uCT*.004)), b1=smoothstep(.55,0.,abs(sin(p.x*1.3+p.y*.5+w*4.+uCT*.03))), b2=smoothstep(.4,0.,abs(sin(p.y*1.1-p.x*.4+w*3.+uCT*.025+1.7)));
    float band=max(b1,b2*.7)*smoothstep(.03,.18,v.y)*(1.-smoothstep(.45,.85,v.y))*(.55+.45*vn(vec2(atan(v.z,v.x)*60.,uCT*.15))); // curtains with rays down them
    vec3 ac=mix(vec3(.25,1.,.55),vec3(.85,.35,.95),smoothstep(.22,.6,v.y)); c+=ac*band*(.45+.35*fb(p*5.+uCT*.03))*.8*uAur*night*(1.-uCover*.8); }
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
void main(){ vP=aP; vN=aN; vC=aC; vE = uPk>.5 ? (aE<.5 ? -1. : aE<1.5 ? 0. : aE>254.5 ? 2. : aE>253.5 ? 3. : (aE-2.)/250.) : aE; // (chunks are packed into bytes)
  vI=aI; vM=aM; vO=aO; vS=uSVP*vec4(aP+aN*.02,1.); gl_Position=uVP*vec4(aP,1.); }`;
const GL_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vP, vN, vC; in float vE, vO; in vec4 vS; flat in float vI, vM; out vec4 o;
uniform highp sampler2DArray uTex; uniform vec3 uAvg[20]; uniform float uTS[20], uRaw[20], uBump[20];
uniform float uHi, uFog0, uFogL; uniform vec3 uFogC; uniform vec3 uSun, uSunC, uSky, uGnd, uWin, uLamp, uEye; uniform float uLit, uShK, uT;
uniform sampler2DShadow uSh; uniform int uNL; uniform vec3 uLP[64]; uniform vec4 uSea; uniform vec3 uWx; uniform float uLo, uPot, uNoSh, uMist; // uPot: light graphics (plain colours); autumn, winter, spring, snow on the ground; rain, cloud cover, lightning` + GL_SKY + `
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.55+vn(p*2.1+7.3)*.3+vn(p*4.3+1.7)*.15; }
float shadow(){ vec3 p=vS.xyz/vS.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.) return 1.; float s=0.; vec2 d=vec2(1./2048.);
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uSh, vec3(p.xy+vec2(x,y)*d*1.2, p.z-.0015)); return s/9.; }
void main(){
  vec3 n=normalize(vN), c=vC; float glow=0.;
  int m=int(vM+.5);
  if(m>0 && uPot<.5){ // triplanar: the ground and roofs take the texture from above, walls from the side they face
    vec3 a=abs(n); vec2 uv = a.y>.55 ? vP.xz : (a.x>a.z ? vec2(vP.z,-vP.y) : vec2(vP.x,-vP.y));
    vec3 t=texture(uTex, vec3(uv*uTS[m], float(m))).rgb;
    if(uBump[m]>0.){ // relief from the texture itself: brighter is higher, so mortar, tile edges and plank seams sink in and catch the light
      vec2 tc=uv*uTS[m]; const vec3 Y=vec3(.3,.59,.11); float e=1.5/256., l0=dot(t,Y), lx=dot(texture(uTex,vec3(tc+vec2(e,0.),float(m))).rgb,Y), ly=dot(texture(uTex,vec3(tc+vec2(0.,e),float(m))).rgb,Y);
      vec3 Tg=a.y>.55||a.x<=a.z ? vec3(1.,0.,0.) : vec3(0.,0.,1.), Bg=a.y>.55 ? vec3(0.,0.,1.) : vec3(0.,-1.,0.);
      n=normalize(n-(Tg*(lx-l0)+Bg*(ly-l0))*uBump[m]); }
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
    vec2 q=vP.xz; float wk=1.+uWx.x*2.2; /* (rougher in rain and storms, the swell running faster) */ n=normalize(vec3((sin(q.x*9.+uT*1.3*wk)*.06+sin(q.y*13.7-uT*1.7)*.04+sin((q.x+q.y)*21.-uT*2.3)*.025)*wk, 1., (cos(q.y*8.3+uT*1.1*wk)*.06+cos((q.x-q.y)*17.+uT*1.9)*.03)*wk));
    vec3 v=normalize(uEye-vP), h=normalize(uSun+v); float sp=pow(max(dot(n,h),0.),120.);
    vec3 rf=reflect(-v,n); rf.y=abs(rf.y); c=mix(c*vec3(.72,.86,.92), untone(skyCol(rf))*.8, .35*(1.-max(dot(n,v),0.))); c+=vec3(1.,.95,.85)*sp*2.2*uShK; if(uWx.x>.3) c=mix(c, vec3(.86,.9,.93), smoothstep(.55,.95,fb(q*7.+vec2(uT*.4,-uT*.3)))*(uWx.x-.3)*.5); /* whitecaps */ glow=min(.45,sp*.7)*uShK; }
  float cv=min(uWx.y,.65), /* (CLOUD_MAX: the cloud layer's patches and their shadows agree) */ cs=uWx.y>.05 && uLo<.5 ? smoothstep(.66-.2*cv,.72-.2*cv,fb(vP.xz*.08+vec2(uT*.012,uT*.005))) : 0.; // clouds drifting over, their shadows on the land
  float nd=(m==5||m==18) ? clamp(dot(n,uSun)*.55+.45,0.,1.) : max(dot(n,uSun),0.), sh=uNoSh>.5 ? 1. : mix(1., shadow(), uShK); // leaves let light through, so it wraps round to their shady side
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
  if(vE>2.5){ lit=c*(uLit>0. ? 1.7 : 1.15); glow=uLit>0. ? .9 : .15; } // (its own colour: a beacon, a signal, a glowing stone)
  else if(vE>1.5){ lit=mix(c, uLamp*1.4, uLit>0.?1.:0.); glow=uLit>0.?1.:0.; }
  if(uHi>0. && abs(vI-uHi)<.5) lit=mix(lit*1.2, vec3(1.,.84,.5), .28+.08*sin(uT*5.)); // what the pointer is on glows softly
  if(uMist>0.){ vec3 mv=normalize(vP-uEye); float m=uMist*(1.-smoothstep(.2,1.6,vP.y-`+(SEAZ * ZS).toFixed(3)+`))*smoothstep(1.5,12.,length(vP-uEye)); lit=mix(lit, untone(skyCol(normalize(vec3(mv.x,.04,mv.z))))*.95, m*.85); glow*=1.-m; } // fog lies low in the valley: mist over the river and the fields, the roofs and towers standing out of it
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
const SMOKE_GEN = { workshop: [null, [[.16, -.14, 26]], []], weaver: [[], [[.32, -.34, 30]], []], glassworks: [null, [[.2, -.16, 26]]] }; // refitted workplaces (needs.js REFIT) smoke from their new stacks, or not at all
const smokeAt = B => { if (fpBig(B) && SMOKE_BIG[B.type]) return SMOKE_BIG[B.type](B); const g = SMOKE_GEN[B.type], a = g && g[genOf(B)]; return a || SMOKE_AT[B.type]; }; // (a works or power station on its lot: bigmodels.js)
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
  const [FR, day, tgt] = GL3.smF, P = GL3.smoke || (GL3.smoke = []), cap = GL3.lo || GL3.lite ? 320 : 900, sea = LIGHT.season || seasonNow(), rate = .22 + .55 * sea.winter + .2 * sea.autumn + .15 * (1 - day), wind = [.07, 0, .04];
  if (!FAST && dt > 0) {
    const ks = []; for (let k = 0; k < GL3.chunks.length; k++) { const ch = GL3.chunks[k], sm = ch.lamps && ch.lamps.smk, d = Math.hypot((k % GNC) * GCH + 4 - tgt[0], ((k / GNC) | 0) * GCH + 4 - tgt[2]); if (sm && sm.length && d < 16 && glSees(FR, ch, k)) ks.push([d, sm]); }
    ks.sort((a, b) => a[0] - b[0]); // the nearest chimneys first (far off, a puff is less than a pixel)
    for (const [, sm] of ks) for (const q of sm) if (P.length < cap && Math.random() < rate * dt) P.push({ x: q[0], y: q[1], z: q[2], a: 0, L: 6 + Math.random() * 3, s0: .09, s1: .6, o: .72 });
    for (const B of DYN.anim || []) { const at = smokeAt(B); if (!at || P.length >= cap || Math.hypot(B.x - tgt[0], B.y - tgt[2]) > 40) continue; // the works smoke hard
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
/* ---------- clouds: a layer of them over the valley, in patches you can see the town through between, drifting with the
   same noise that throws their shadows on the ground (shifted along the sun, so each shadow lies under its cloud) ---------- */
const CLOUD_Y = 8.5, CLOUD_MAX = .65; // how high the layer floats, and how much of the sky it ever covers (so there are always gaps)
const GL_CVS = `#version 300 es
uniform mat4 uVP; uniform vec4 uRect; uniform float uY; out vec3 vP;
void main(){ vec2 c=vec2[6](vec2(0,0),vec2(1,0),vec2(1,1),vec2(0,0),vec2(1,1),vec2(0,1))[gl_VertexID]; vP=vec3(mix(uRect.x,uRect.z,c.x),uY,mix(uRect.y,uRect.w,c.y)); gl_Position=uVP*vec4(vP,1.); }`;
const GL_CFS = `#version 300 es
precision highp float; in vec3 vP; out vec4 o; uniform float uT, uCov, uRain, uDay, uFog0, uFogL; uniform vec3 uEye, uSun, uTgt;` + GL_SKY + `
float h21(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float fb(vec2 p){ return vn(p)*.55+vn(p*2.1+7.3)*.3+vn(p*4.3+1.7)*.15; }
void main(){
  vec2 q=vP.xz-uSun.xz/max(uSun.y,.3)*vP.y; // (the spot on the ground this bit of cloud shades)
  float n=fb(q*.08+vec2(uT*.012,uT*.005)), d=smoothstep(.66-.2*uCov,.72-.2*uCov,n); // (the same patches as the shadows on the ground)
  d*=.75+.25*vn(vP.xz*.7+vec2(uT*.03,0.)); if(d<.01) discard; // a ragged edge
  bool below=uEye.y<vP.y; float dist=length(vP-uEye);
  float a=min(1.,d*1.3)*(below?.88:.8)*smoothstep(2.5,7.,dist); // (thin out round the camera, so flying through one doesn't white out the view)
  if(!below){ float dt=length(uTgt-uEye); a*=smoothstep(5.,16.,length(vP.xz-uTgt.xz))*smoothstep(dt*.95,dt*1.5,dist); } // from above, what you're looking at stays clear (and everything between it and you): their shadows drift over it, the clouds gather further out
  if(uFogL>0.) a*=exp(-max(0.,dist-uFog0-20.)/(uFogL*3.)); // (far off they melt into the haze)
  vec3 sky=skyCol(normalize(vec3(uSun.x,.6,uSun.z))), top=mix(sky,vec3(1.),.55)*(.35+.65*uDay), under=mix(sky*.7,vec3(.55,.57,.62),.5)*(.3+.6*uDay);
  float th=smoothstep(.66-.2*uCov,.85-.2*uCov,n); vec3 c=below?under*(1.-.25*th):top*(.9+.12*th); c*=1.-.35*uRain; // (the thick of a cloud is brighter on top and darker underneath) // rain clouds are darker, and so is the thick of a cloud
  o=vec4(c,a);
}`;
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
// Light graphics, for a laptop that struggles: plain colours instead of textures, no shadows, bloom or multisampling, fewer
// pixels, few street lamps lighting the ground, no detailed close-ups, fewer people and a lower frame rate. Kept per
// browser (it's about this computer, not the world), and ?lite forces it.
function gfxLite() { if (QS.has('lite') || QS.has('potato')) return true; try { return localStorage.getItem('sfGfx') === 'lite'; } catch (e) { return false; } }
function setGfx(lite) { GL3.lite = !!lite; try { localStorage.setItem('sfGfx', lite ? 'lite' : 'full'); } catch (e) {} if (GL3.gl) for (const ch of GL3.chunks) if (ch.near) glDropNear(ch); GL3.nj = null; }
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
  if (!gl) { const m = $('nogl'); if (m) m.classList.add('show'); return false; } // (no WebGL2 in this browser: a note says so; the world still grows)
  document.body.insertBefore(c, document.body.firstChild);
  GL3.c = c; GL3.gl = gl; GL3.on = true;
  // a driver update, a GPU reset or waking from sleep can take the context away; on a monitor all day that will happen.
  // Stop drawing (the world keeps growing), and once it's back, save and reload: the same as pressing F5.
  c.addEventListener('webglcontextlost', e => { e.preventDefault(); GL3.on = false; GL3.lost = true; });
  c.addEventListener('webglcontextrestored', async () => { if (SCRATCH) { toast('The graphics card reset. Reload to see the world again.'); return; } try { await saveAll(true); } catch (e) { } location.reload(); });
  GL3.main = glProg(gl, GL_VS, GL_FS); GL3.sky = glProg(gl, GL_KVS, GL_KFS); GL3.prc = glProg(gl, GL_KVS, GL_PFS2); GL3.cld = glProg(gl, GL_CVS, GL_CFS);
  GL3.smp = glProg(gl, GL_SMVS, GL_SMFS); GL3.smB = gl.createBuffer(); GL3.ptMax = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64; glFxInit(gl);
  GL3.lite = gfxLite();
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
    if ('ntp'.includes(k)) glTouch(); // (they hand the camera back, then do their own thing below)
    if (k === 'r') { GL3.cam.auto = !GL3.cam.auto; GL3.film = GL3.cam.auto; if (!GL3.cam.auto) glCap(null); toast(GL3.cam.auto ? 'Film camera on: it wanders to wherever something is happening' : 'Film camera off'); }
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
  e.innerHTML = esc(t) + (sub ? `<div style="font:12px/1.4 'Segoe UI',system-ui,sans-serif;opacity:.75;margin-top:2px">${esc(sub)}</div>` : ''); // names can come from the voice or the player: never markup requestAnimationFrame(() => { e.style.opacity = 1; });
}
function glShot() { // choose what to look at next
  const T0 = towns(); if (!T0.length) return null;
  const seen = GL3.seenN || 0, news = (S.chron || []).filter(e => e.n > seen && e.tx != null && e.yr >= yr() - 3).slice(-12); GL3.seenN = S.chronN;
  const pick1 = a => a[(Math.random() * a.length) | 0];
  const major = news.filter(e => e.k === 'major' || e.k === 'era'), ev = major.length ? major[major.length - 1] : news.length && chance(.7) ? pick1(news) : null;
  const z = (x, y) => surfZ(idx(clamp(Math.round(x), 0, W - 1), clamp(Math.round(y), 0, H - 1))) * ZS;
  const hn = GL3.hint; GL3.hint = null; if (hn && GL3.t - hn.t < 20) return { at: () => [hn.x, z(hn.x, hn.y), hn.y], zoom: hn.zoom, pitch: rf(.3, .45), cap: hn.cap, dur: 22, hint: true }; // something the world asked us to look at
  const inc = (S.inc || []).find(I => !GL3.incSeen.has(I.id)) || ((S.inc || []).length && chance(.5) ? pick1(S.inc) : null); // an incident beats everything, and gets a second look now and then
  if (inc) { GL3.incSeen.add(inc.id); const T = S.T[inc.sid]; return { at: () => { const v = INCV.get(inc.id), x = v && v.fx != null ? v.fx : inc.x, y = v && v.fx != null ? v.fz : inc.y; return [x, z(x, y), y]; }, zoom: rf(2.2, 3), pitch: rf(.4, .52), cap: (INC_CAP[inc.k] || '') + (T ? ' in ' + T.name : ''), dur: 30 }; }
  if (ev) return { at: () => [ev.tx, z(ev.tx, ev.ty), ev.ty], zoom: rf(2.6, 4), pitch: rf(.34, .5), cap: ev.ic + ' ' + ev.t, sub: 'Year ' + Math.floor(ev.yr) };
  const opts = [];
  const sail = DYN.ships.filter(sh => sh.st === 'sail' && sh.to && sh.path && sh.s > sh.path.length - 14 && sh.s < sh.path.length - 3);
  if (sail.length) opts.push([3, () => { const sh = pick1(sail), B = S.B[sh.to], T = B && S.T[B.sid]; return { at: () => { const q = shipPos(sh); return q ? [q[0], SEAZ * ZS, q[1]] : null; }, zoom: rf(2.2, 3), pitch: rf(.2, .32), cap: '⛵ A ship coming in' + (T ? ' to ' + T.name : ''), dur: 26 }; }]);
  const ws = DYN.walkers.filter(w => w.pid && S.P[w.pid] && w.st !== 'in' && w.st !== 'idle' && walkerPos(w));
  if (ws.length) opts.push([3, () => { const w = pick1(ws), P = S.P[w.pid], T = S.T[P.sid]; return { follow: w, at: () => { const q = walkerPos(w); return q ? [q[0], q[2] * ZS, q[1]] : null; }, zoom: rf(1.4, 2), pitch: rf(.42, .55), cap: P.name, sub: [P.role, T && T.name].filter(Boolean).join(' · ') }; }]);
  if (DYN.trains.length) opts.push([1.5, () => { const tr = pick1(DYN.trains); return { at: () => { const p = trainPos(tr); return p ? [p[0], p[1], p[2]] : null; }, zoom: rf(2.2, 3.2), pitch: rf(.45, .6), cap: '🚂 The train' }; }]);
  if ((DYN.trams || []).length) opts.push([1.5, () => { const tm = pick1(DYN.trams), T = S.T[tm.sid]; return { at: () => { const p = tramPos(tm.P, tm.s); return [p[0], p[1], p[2]]; }, zoom: rf(1.8, 2.6), pitch: rf(.45, .6), cap: '🚋 The tram' + (T ? ' in ' + T.name : '') }; }]);
  const big = Object.values(S.B).filter(B => fpBig(B) && B.prog >= 1);
  if (big.length) opts.push([2, () => { const B = pick1(big), T = S.T[B.sid], [x, y] = glLot(B); return { at: () => [x, z(x, y), y], zoom: rf(2, 3), pitch: rf(.35, .55), cap: (B.name || (BT[B.type] ? BT[B.type].n : B.type)) + (T ? ' · ' + T.name : '') }; }]);
  opts.push([2, () => { const T = pick1(T0.slice().sort((a, b) => b.pop - a.pop).slice(0, 4)); return { at: () => [T.x, z(T.x, T.y), T.y], zoom: clamp(townRadius(T) * .8 + 3, 5, 14), pitch: rf(.4, .75), cap: T.name, sub: Math.round(T.pop).toLocaleString('en-GB') + ' people' }; }]);
  { const w = glWorkShot(); if (w) opts.push([1.5, () => w]); } // a workplace close up (works.js)
  const sb = Object.values(S.B).filter(B => B.prog >= 1 && SEA_CAP[B.type]);
  if (sb.length) opts.push([2, () => { const B = pick1(sb), T = S.T[B.sid], [x, y] = glLot(B), tall = B.type === 'windpark' || B.type === 'oilrig' || B.type === 'sealaunch'; return { at: () => [x, SEA_Y + (tall ? .6 : .1), y], zoom: tall ? rf(3, 4.2) : rf(1.8, 2.6), pitch: rf(.22, .38), cap: SEA_CAP[B.type] + (T ? ' off ' + T.name : '') }; }]); // out on the water (seamodels.js)
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
  if (!sh || (GL3.t - sh.t0) > (sh.dur || 30) || GL3.hint && !sh.hint) { // (a hint from the world cuts in)
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
  const dpr = GL3.lite ? Math.min(1, devicePixelRatio || 1) * .8 : Math.min(2, devicePixelRatio || 1), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr); // (light graphics: fewer pixels, stretched)
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  // rebuild what changed, a few chunks a frame
  // (the height map first, for every chunk in this batch, then the occlusion, which looks across into the neighbours)
  const batch = [], again = new Set(); let n = 0;
  for (const k of GL3.dirty) { if (n++ >= (GL3.first ? 3 : 64)) break; batch.push(k); }
  const built = batch.map(k => { GL3.dirty.delete(k); const r = glBuildChunk(k), old = glEdge(k); hfRaster(k, r.v); if (GL3.first && glEdge(k) !== old) for (const j of glNbrs(k)) if (!batch.includes(j)) again.add(j); return [k, r]; });
  for (const [k, r] of built) { glAO(r.v); const ch = GL3.chunks[k]; glUpload(ch, r.v, false); ch.lamps = r.lamps; if (ch.near) ch.stale = true; } // (its detailed version stays up until a fresh one replaces it: dropping it here made busy streets flicker plain and back)
  // the chunks round the camera get a detailed version, one a frame, nearest first (and lose it again once well out of range)
  { const nr = GL3.lite ? -99 : cam.zoom <= 9 ? 11 : cam.zoom <= 15 ? 7 : 0, cx = cam.tx, cz = cam.tz; let best = -1, bd = 1e9;
    for (let k = 0; k < GNC * GNC; k++) { const ch = GL3.chunks[k], d = Math.hypot((k % GNC) * GCH + GCH / 2 - cx, ((k / GNC) | 0) * GCH + GCH / 2 - cz);
      if (ch.near && d > nr + 8) glDropNear(ch); else if ((!ch.near || ch.stale) && ch.n && d < nr && d < bd && !GL3.dirty.has(k)) { best = k; bd = d; } }
    // one detailed chunk at a time, a few milliseconds a frame: rows first, then its shading, then off to the GPU
    let J = GL3.nj; if (J && ((GL3.chunks[J.k].near && !GL3.chunks[J.k].stale) || GL3.dirty.has(J.k))) J = GL3.nj = null;
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
  // perspective: a 38° lens backed off so the zoom still means "how much ground fits"; isometric: an orthographic lens
  if (cam.persp) { const d0 = zz / Math.tan(19 * DEG); pit = Math.max(pit, Math.asin(Math.min(.95, 2.2 / d0))); dir[0] = Math.cos(pit) * Math.sin(cam.yaw); dir[1] = Math.sin(pit); dir[2] = Math.cos(pit) * Math.cos(cam.yaw); } // stay above the rooftops
  const fov = 38 * DEG, dist = cam.persp ? zz / Math.tan(fov / 2) : 90, tgt = [cam.tx, cam.ty, cam.tz]; let eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist];
  const fm = cam.auto && GL3.shot ? 2 : 1; // (the film camera keeps a wider berth, so it starts rising before a tall block is upon it)
  if (cam.persp) for (let k = 0; k < 24; k++) { // tall buildings: tip the camera up until neither it nor the middle of its view line is inside one
    let g = -9; for (const f of [1, .75, .5, .3]) g = Math.max(g, hfAt(tgt[0] + (eye[0] - tgt[0]) * f, tgt[2] + (eye[2] - tgt[2]) * f) - (tgt[1] + (eye[1] - tgt[1]) * f) + (f > .9 ? .6 : .25) * fm); if (g < 0 || pit >= 1.45) break; // (a clear line, and the camera well above the roofs)
    pit = Math.min(1.45, pit + .04); dir = [Math.cos(pit) * Math.sin(cam.yaw), Math.sin(pit), Math.cos(pit) * Math.cos(cam.yaw)]; eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist];
  }
  { // (only for this frame: the angle you chose stays underneath. Up at once, back down gently. The film camera glides up
    // too and comes down slowly, so following something past tall buildings is a smooth rise rather than a jump and a bob)
    const film = cam.auto && GL3.shot, up = film ? Math.min(1, dt * 4) : 1, dn = Math.min(1, dt * (film ? .4 : 3));
    GL3.pe = !cam.persp || GL3.pe == null ? pit : GL3.pe + (pit - GL3.pe) * (pit > GL3.pe ? up : dn);
    if (GL3.pe !== pit) { pit = GL3.pe; dir = [Math.cos(pit) * Math.sin(cam.yaw), Math.sin(pit), Math.cos(pit) * Math.cos(cam.yaw)]; eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist]; }
  }
  GL3.eye = eye;
  const VP = m4mul(cam.persp ? m4persp(fov, aspect, Math.max(.2, dist * .02), dist + 520) : m4ortho(-zz * aspect, zz * aspect, -zz, zz, 1, 220), m4look(eye, tgt, [0, 1, 0]));
  const sc = [32, 2, 32], se = [sc[0] + sd[0] * 80, sc[1] + sd[1] * 80, sc[2] + sd[2] * 80];
  const SVP = m4mul(m4ortho(-50, 50, -50, 50, 1, 180), m4look(se, sc, [0, 1, 0]));
  // lamps near the middle of the view light the streets
  const dyn = glPeople(); // (first: the lanterns people carry are lights too)
  const lamps = []; if (lit > 0) { for (const ch of GL3.chunks) for (const L of ch.lamps) lamps.push(L); for (const L of GL3.carry) lamps.push(L); lamps.sort((a, b) => Math.hypot(a[0] - tgt[0], a[2] - tgt[2]) - Math.hypot(b[0] - tgt[0], b[2] - tgt[2])); lamps.length = Math.min(GL3.lite ? 8 : 64, lamps.length); }
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
  const noSh = GL3.lite || S.settings.shadows === false; // (the most expensive pass after the view itself)
  if (!noSh) { gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.shF); gl.viewport(0, 0, 2048, 2048); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(GL3.sh.p); gl.uniformMatrix4fv(GL3.sh.u.uSVP, false, SVP); for (const a of [1, 2, 3]) gl.disableVertexAttribArray(a); drawAll(false); }
  // the view
  const post = GL3.lite ? null : GL3.post; if (post) { glPostSize(gl, w, h); if (!post.ok) GL3.post = null; }
  const usePost = !!(post && GL3.post); gl.bindFramebuffer(gl.FRAMEBUFFER, usePost ? post.msF : null); gl.viewport(0, 0, w, h);
  gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  // the sky, behind everything
  const sd0 = [Math.cos(el * DEG) * Math.cos(t), Math.sin(el * DEG), Math.cos(el * DEG) * Math.sin(t)], skyU = U => { gl.uniform3fv(U.uSunD, sd0); gl.uniform1f(U.uSunY, sd0[1]); gl.uniform1f(U.uCover, cover); gl.uniform4fv(U.uTint, SKY_TINT[LVV.sky] || SKY_TINT0); };
  { const K = GL3.sky, f = [-dir[0], -dir[1], -dir[2]], tn = Math.tan(fov / 2), r0 = [f[2], 0, -f[0]], rl = Math.hypot(r0[0], r0[2]) || 1, r = [-r0[0] / rl, 0, -r0[2] / rl], u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
    gl.useProgram(K.p); skyU(K.u); gl.uniform1f(K.u.uCT, GL3.t); gl.uniform1f(K.u.uLo, GL3.lo || GL3.lite ? 1 : 0); gl.uniform1f(K.u.uAur, LVV.sky === 'aurora' ? 1 : 0); gl.uniform3fv(K.u.uF, f); gl.uniform3fv(K.u.uR, r.map(q => q * tn * aspect)); gl.uniform3fv(K.u.uU, u.map(q => q * tn));
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.drawArrays(gl.TRIANGLES, 0, 3); gl.depthMask(true); gl.enable(gl.DEPTH_TEST); }
  const P = GL3.main, U = P.u; gl.useProgram(P.p); skyU(U);
  gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniformMatrix4fv(U.uSVP, false, SVP);
  gl.uniform3fv(U.uSun, sd); gl.uniform3fv(U.uSunC, sunC); gl.uniform3fv(U.uSky, sky); gl.uniform3fv(U.uGnd, gnd); gl.uniform3fv(U.uEye, eye);
  gl.uniform3fv(U.uWin, gcol((LIGHT.cur && LIGHT.cur.winC || ['#ffd07a'])[0])); gl.uniform3fv(U.uLamp, [1.25, .86, .5]);
  gl.uniform1f(U.uLit, lit); gl.uniform1f(U.uShK, shK); gl.uniform1f(U.uT, GL3.t);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GL3.shT); gl.uniform1i(U.uSh, 0);
  gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, GL3.tex); gl.uniform1i(U.uTex, 1); gl.uniform3fv(U.uAvg, GL3.texAvg); gl.uniform1fv(U.uTS, TX.SCALE); gl.uniform1fv(U.uRaw, TX.RAW); gl.uniform1fv(U.uBump, TX.BUMP); gl.activeTexture(gl.TEXTURE0);
  gl.uniform1i(U.uNL, lamps.length); if (lamps.length) gl.uniform3fv(U.uLP, new Float32Array(lamps.flat()));
  gl.uniform1f(U.uHi, GL3.hover || 0);
  // the season and the weather: snow lies where it has fallen, rain wets things, fog closes in, lightning flashes
  const sea = LIGHT.season || seasonNow(), wxOn = S.settings.weather !== false, wxs = wxOn ? wx : { rain: 0, snow: 0, fog: 0, sc: 0 };
  GL3.flash = Math.max(0, (GL3.flash || 0) - dt * 2.2); if (DYN.flash > GL3.flash) GL3.flash = DYN.flash;
  gl.uniform1f(U.uLo, GL3.lo || GL3.lite ? 1 : 0); gl.uniform1f(U.uPot, GL3.lite ? 1 : 0); gl.uniform1f(U.uNoSh, noSh ? 1 : 0); gl.uniform4f(U.uSea, sea.autumn, sea.winter, sea.spring, wxs.sc || 0); gl.uniform3f(U.uWx, wxs.rain || 0, cover, GL3.flash * (wxOn ? 1 : 0));
  const fog = wxs.fog || 0;
  gl.uniform1f(U.uFog0, (dist + zz * .6) * (1 - .3 * fog)); gl.uniform1f(U.uFogL, cam.persp ? 55 * (1 - .4 * fog) : 0); gl.uniform1f(U.uMist, fog); // (a foggy morning hazes the distance a little; the thick of it lies low, uMist)
  drawAll(true);
  glSmoke(gl, dt, FR, VP, h / 2 * (cam.persp ? 1 / Math.tan(fov / 2) : 1 / zz), day, tgt);
  glFx(gl, VP, h / 2 * (cam.persp ? 1 / Math.tan(fov / 2) : 1 / zz), day); // particles, beams, overlays (fx3d.js)
  if (wxOn && cover > .05 && GL3.cld) { // the cloud layer
    const Q = GL3.cld; for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
    gl.useProgram(Q.p); skyU(Q.u); gl.uniformMatrix4fv(Q.u.uVP, false, VP); gl.uniform4f(Q.u.uRect, -24, -24, W + 24, H + 24); gl.uniform1f(Q.u.uY, CLOUD_Y);
    gl.uniform1f(Q.u.uT, GL3.t); gl.uniform1f(Q.u.uCov, Math.min(cover, CLOUD_MAX)); gl.uniform1f(Q.u.uRain, Math.max(wxs.rain || 0, wxs.storm || 0)); gl.uniform1f(Q.u.uDay, day);
    gl.uniform3fv(Q.u.uEye, eye); gl.uniform3fv(Q.u.uTgt, tgt); gl.uniform3fv(Q.u.uSun, sd); gl.uniform1f(Q.u.uFog0, (dist + zz * .6)); gl.uniform1f(Q.u.uFogL, cam.persp ? 55 : 0);
    gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); gl.depthMask(false); // (the glow mask in alpha stays as it was)
    gl.drawArrays(gl.TRIANGLES, 0, 6); gl.depthMask(true); gl.disable(gl.BLEND);
  }
  if ((wxs.rain || 0) > .05 || (wxs.snow || 0) > .05) { // rain or snow falling across the view
    const Q = GL3.prc; for (let a = 0; a < 7; a++) gl.disableVertexAttribArray(a);
    gl.useProgram(Q.p); gl.uniform1f(Q.u.uT, GL3.t); gl.uniform1f(Q.u.uRain, wxs.rain || 0); gl.uniform1f(Q.u.uSnow, wxs.snow || 0); gl.uniform1f(Q.u.uAsp, aspect); gl.uniform1f(Q.u.uYaw, cam.yaw);
    gl.uniform3fv(Q.u.uCol, (wxs.snow || 0) > (wxs.rain || 0) ? [.96, .97, 1] : [.78, .84, .92].map(v => v * (.4 + .6 * day)));
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ZERO, gl.ONE); // (the glow mask in alpha stays as it was)
    gl.drawArrays(gl.TRIANGLES, 0, 3); gl.disable(gl.BLEND); gl.enable(gl.DEPTH_TEST);
  }
  if (usePost) glBloom(gl, w, h, .55 + lit * .7);
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
  glTip(); glOverlay(VP);
}
// the tooltip for whatever the pointer is on
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
  glTrains(); glTrams(); // the trains, the level crossings' barriers and the trams (rail.js)
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
const CLOTH_LV = { colourful: ['#e0453a', '#f2b632', '#3f8fd8', '#4fb85f', '#d85fb0', '#8a5fd8', '#f07a2a'], white: ['#f4f1ea', '#ece6da', '#faf8f2'], dark: ['#26282c', '#3a3440', '#1f2a33', '#2f2f2f'], earthy: ['#8a6a4a', '#6b5a3a', '#a8885a', '#5a6a3a', '#7a5040'] };
function clothOf(o) { // what the Watcher's words have people wearing (kept on the person until the fashion changes)
  const c = LVV.clothes; if (!c || o.kind === 'founder' || o.kind === 'wk') return o.col;
  if (o._cl !== c) { o._cl = c; const L = CLOTH_LV[c]; o._cc = L ? L[((o.ph || 0) * 997 | 0) % L.length] : (S.styles[S.styleIdx] || STYLES0[0]).accent; }
  return o._cc;
}
function glCat(d, f, r, y0, dph, moving, col) { // a cat at someone's heel, tail up
  for (const [lf, lr, q] of [[.016, .008, 0], [.016, -.008, Math.PI], [-.016, .008, Math.PI], [-.016, -.008, 0]]) glLimb([d[0] + f[0] * lf + r[0] * lr, y0 + .018, d[2] + f[2] * lf + r[2] * lr], f, r, moving ? Math.sin(dph + q) * .6 : 0, .018, .0035, col);
  glOBox([d[0], y0 + .024, d[2]], V3(f, .022), V3(r, .008), [0, .007, 0], col);
  const hd = [d[0] + f[0] * .025, y0 + .036, d[2] + f[2] * .025]; glOBox(hd, V3(f, .008), V3(r, .008), [0, .008, 0], col);
  for (const sg of [1, -1]) glOBox([hd[0] + r[0] * sg * .005, hd[1] + .01, hd[2] + r[2] * sg * .005], V3(f, .002), V3(r, .002), [0, .004, 0], col);
  glLimb([d[0] - f[0] * .02, y0 + .03, d[2] - f[2] * .02], V3(f, -1), r, -2.7 + Math.sin(GL3.t * 2 + dph) * .2, .03, .003, col);
}
// People are modelled at a size that reads from afar, then shrunk about their feet to the world's own scale (a door is
// about .13 high, a bench seat .03), with whatever they carry and the pet at their heel.
const PS = .6;
function glShrink(n0, o, k) { const v = GLB.v; if (!v || !v.a) return; const A = v.a; for (let i = n0; i < v.length; i += 13) { A[i] = o[0] + (A[i] - o[0]) * k; A[i + 1] = o[1] + (A[i + 1] - o[1]) * k; A[i + 2] = o[2] + (A[i + 2] - o[2]) * k; } }
function glPerson(o, X, Z, y0, h, moving, carryLamp) {
  const n0 = GLB.v.length, c0 = GL3.carry.length, O = [X, y0, Z], sc = p => p && [X + (p[0] - X) * PS, y0 + (p[1] - y0) * PS, Z + (p[2] - Z) * PS];
  const hands = glPerson0(o, X, Z, y0, h, moving, carryLamp); glShrink(n0, O, PS);
  for (let k = c0; k < GL3.carry.length; k++) GL3.carry[k] = sc(GL3.carry[k]);
  return hands && hands.map(sc);
}
function glPerson0(o, X, Z, y0, h, moving, carryLamp) {
  const e0 = GL3.eye, far = e0 ? Math.hypot(X - e0[0], y0 - e0[1], Z - e0[2]) : 0;
  if (far > 30) { // a speck in the distance: a body and a head
    GLB.ctr = [X, y0 + .1, Z]; glOBox([X, y0 + .11, Z], [.02, 0, 0], [0, 0, .02], [0, .11, 0], clothOf(o) || '#e5874f'); glOBox([X, y0 + .245, Z], [.018, 0, 0], [0, 0, .018], [0, .022, 0], o.skin || '#e0b090'); return;
  }
  const s = o.kid ? .72 : 1, f = [Math.cos(h), 0, Math.sin(h)], r = [-Math.sin(h), 0, Math.cos(h)], ph = o.ph || 0;
  const sw = moving ? Math.sin(ph) : 0, bob = moving ? Math.abs(Math.cos(ph)) * .007 * s : Math.sin(GL3.t * 1.6 + ph) * .0015; // a step's bob, or breathing
  const hip = y0 + .105 * s + bob, sh = y0 + .21 * s + bob, B = (dx, dr, y) => [X + f[0] * dx + r[0] * dr, y, Z + f[2] * dx + r[2] * dr];
  for (const sg of [1, -1]) glLimb(B(0, sg * .016 * s, hip), f, r, sw * sg * .55, .105 * s, .012 * s, o.pants || '#555'); // legs
  const col = clothOf(o) || '#e5874f'; glOBox(B(0, 0, (hip + sh) / 2 + .006 * s), V3(f, .02 * s), V3(r, .033 * s), [0, (sh - hip) / 2 + .01 * s, 0], col); // body
  if (o.kind === 'founder') glOBox(B(.001, 0, hip + .045 * s), V3(f, .0205 * s), V3(r, .0335 * s), [0, .006 * s, 0], '#f2f0ea'); // the founder's sash
  let hand = null, hand2 = null; const arms = o.arms; // (o.arms: [right, left] held in a pose, for folk at work)
  for (const sg of [1, -1]) { const e = glLimb(B(0, sg * .043 * s, sh), f, r, arms ? arms[sg > 0 ? 0 : 1] : -sw * sg * .45 + (carryLamp && sg > 0 ? .5 : 0), .095 * s, .0095 * s, sg > 0 ? col : shade(col, .85)); if (sg > 0) hand = e; else hand2 = e; } // arms swing against the legs
  glOBox(B(0, 0, sh + .012 * s), V3(f, .01 * s), V3(r, .01 * s), [0, .012 * s, 0], o.skin || '#e0b090'); // neck
  const hy = sh + .045 * s, hc = B(0, 0, hy), u = hc[0], v = hc[2];
  glOBox(hc, V3(f, .022 * s), V3(r, .021 * s), [0, .025 * s, 0], o.skin || '#e0b090'); // head
  glOBox(B(-.005 * s, 0, hy + .012 * s), V3(f, .02 * s), V3(r, .023 * s), [0, .016 * s, 0], o.hair || '#5a3a28'); // hair, sitting back on the head
  if (carryLamp && hand) { glOBox([hand[0], hand[1] - .012, hand[2]], [.008, 0, 0], [0, 0, .008], [0, .012, 0], '#ffd08a', 2); GL3.carry.push([hand[0], hand[1], hand[2]]); } // a lantern
  if (far > 12) return [hand, hand2];
  const hl = LVV.hats, hr = o.hat == null ? 1 : o.hat;
  if (hl === 'tall_hats' && !o.kid && hr < .7) { glOBox([u, hy + .024 * s, v], V3(f, .034 * s), V3(r, .034 * s), [0, .002, 0], '#2a2a2e'); glOBox([u, hy + .052 * s, v], V3(f, .021 * s), V3(r, .021 * s), [0, .028 * s, 0], '#2a2a2e'); } // a top hat
  else if (hl === 'flower_crowns' && hr < .8) for (let q = 0; q < 6; q++) { const a = q / 6 * TAU; glBlob(u + Math.cos(a) * .02 * s, v + Math.sin(a) * .02 * s, .008 * s, (hy + .028 * s) / ZS, .3 * s, FLOWER_C[(q + ((hr * 9) | 0)) % FLOWER_C.length], 0); } // a crown of flowers
  else if (hl !== 'no_hats' && !o.kid && (hl === 'everyone' || hr < .22)) { const era = S.era;
    if (era <= 3) { glOBox([u, hy + .024 * s, v], V3(f, .046 * s), V3(r, .046 * s), [0, .003, 0], '#d8b86a'); glBlob(u, v, .026 * s, (hy + .026 * s) / ZS, .5 * s, '#caa458', 0); } // a straw hat
    else if (era <= 6) { glBlob(u, v, .028 * s, (hy + .012 * s) / ZS, .55 * s, shade(o.pants || '#555', .8), 0); glOBox(B(.028 * s, 0, hy + .012 * s), V3(f, .014 * s), V3(r, .022 * s), [0, .002, 0], shade(o.pants || '#555', .8)); } } // a cap
  const pl = LVV.pets, pq = ((o.ln || 0) * 7) % 1; // (the custom decides who has a pet)
  if (pl === 'cats' ? !o.kid && pq < .35 : false) glCat(B(-.06, .05, y0), f, r, y0, ph * 1.35, moving, ['#e0903a', '#5a5a5e', '#2a2a2e', '#f2ece0'][((pq * 40) | 0) % 4]);
  else if (pl !== 'none' && (o.pet || pl === 'dogs' && pq < .45)) glDog(B(-.07, .05, y0), f, r, y0, ph * 1.35, moving, ['#9a7a5c', '#3a3430', '#d8c4a0', '#7a5040'][((pq * 40) | 0) % 4]); // the dog trots at their heel
  return [hand, hand2];
}
function glDog(d, f, r, y0, dph, moving, col = '#9a7a5c') { // d: where it stands; dph: its stride
  for (const [lf, lr, q] of [[.022, .012, 0], [.022, -.012, Math.PI], [-.022, .012, Math.PI], [-.022, -.012, 0]]) glLimb([d[0] + f[0] * lf + r[0] * lr, y0 + .028, d[2] + f[2] * lf + r[2] * lr], f, r, moving ? Math.sin(dph + q) * .6 : 0, .028, .005, shade(col, .8));
  glOBox([d[0], y0 + .036, d[2]], V3(f, .032), V3(r, .012), [0, .011, 0], col);
  const hd = [d[0] + f[0] * .036, y0 + .052, d[2] + f[2] * .036]; glOBox(hd, V3(f, .012), V3(r, .01), [0, .01, 0], col);
  const tw = Math.sin(GL3.t * 9 + dph) * .4; glLimb([d[0] - f[0] * .03, y0 + .044, d[2] - f[2] * .03], V3(f, -1), r, -1.1 + tw, .025, .004, col);
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
  const v = GL3.fb || (GL3.fb = new GLFBuf()); v.length = 0; GLB = { v, x: 0, y: 0, base: 0, id: 0, wall: 0, mat: 0, lod: false, ctr: null, wallC: null, flat: '', ao: 1, B: null, smk: null }; GL3.carry = [];
  const night = LIGHT.emK > .02; GL3.litNow = night;
  try {
    for (let k = 0; k < DYN.walkers.length; k++) {
      const w = DYN.walkers[k], p = walkerPos(w); if (!p || p[3] < .3) continue; GLB.id = w.pid ? GPID + k : 0; // a person you can point at
      const X = p[0], Z = p[1], y0 = p[2] * ZS; GLB.ao = .35 + .65 * aoAt(X, y0 + .15, Z, 0, 1, 0); // darker down an alley
      glPerson(w, X, Z, y0, glHeading(w, p[4], p[5]), !!p[6], night && w.ln < (S.era === 0 ? .6 : .12));
      if (w.pid) glMark(w, X, Z, y0); // (the people you know: a diamond over them)
    }
    glPrayerCandles();
    GLB.id = 0; GLB.ao = 1;
    for (const hd of DYN.herds) for (const m of hd.members) { const [fx, fy, z] = agentPos(m), bx = m.b % W - m.a % W, by = ((m.b / W) | 0) - ((m.a / W) | 0); glSheep(fx, fy, z * ZS, (m.size || 1) * (m.baby ? .6 : 1), glHeading(m, bx, by), m.pause > 0 ? -1 : DYN.t * 3 + (m.a % 7)); }
    GLB.id = 0; GLB.ao = 1; glIncidents(GL3.dt || .016);
    GLB.id = 0; GLB.ao = 1; try { glWorks(); } catch (e) { if (QS.has('dev')) console.error(e); }
    GLB.id = 0; GLB.ao = 1; try { glFxDyn(); } catch (e) { if (QS.has('dev')) console.error(e); }
    GLB.id = 0; GLB.ao = 1; try { glTraffic(); } catch (e) { if (QS.has('dev')) console.error(e); }
    for (const c of DYN.vehicles) { const p = vehiclePos(c); if (!p) continue; GLB.ao = .35 + .65 * aoAt(p[0], p[2] * ZS + .15, p[1], 0, 1, 0); glVehicle(c, p[0], p[1], p[2] * ZS, glHeading(c, p[4], p[5]), true); }
  } catch (e) { if (QS.has('dev')) console.error(e); } finally { GLB = null; }
  return v.a.subarray(0, v.length);
}

/* ---------- textures, painted in code at start-up (no image files): one layer each in a texture array ---------- */
// Materials: 0 none, 1 grass, 2 brick, 3 roof tiles, 4 bark, 5 leaves, 6 plaster, 7 stone, 8 planks, 9 cobbles, 10 asphalt, 11 earth.
// The shader lays them on by world position (triplanar), so nothing needs unwrapping. RAW is how much of the texture's own
// colour replaces the art's colour (grass and bark look real; plaster keeps the building's own colour and only gains grain).
const TX = { N: 256, L: 20, SCALE: [1, .5, 1.8, 1.6, 3.5, 2.2, 1.2, 1.4, 2, 1.6, .7, .6, 1.8, 1, 2.2, .6, 1.2, 1.4, 2.6, 1.6], RAW: [0, .85, .55, .4, .9, .7, 0, .35, .45, .55, .7, .7, .3, .75, .35, .7, .5, .25, .7, .6],
  BUMP: [0, 1, 3.2, 3, 3, .8, .6, 2.6, 2.2, 3.2, .6, 1, 2.6, 1.2, .8, .6, .4, 0, .8, 2.6] }; // (how strongly each texture's own light and dark becomes relief)
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
function harbourDocks(B, { y, ys, L, P, A3, D3, lx, lz }) {
  kSet(lx, lz, A3, D3, B.id); KF.y0 = y; const lod = KF.lod, br = '#a8553f', br2 = '#c27a5c', cu = '#5f9e86', cuD = '#4e8a73', st = '#cfc6b4', s0 = -L / 2 + .04, s1 = L / 2 - .04, fB = -.47, fD = -.1, H = .36, fh = (H - .04) / 3;
  // the quay: granite coping, setts, mooring rings, the rails along it
  kBox(0, .47, .025, L / 2, .03, .012, st, M_STONE); kBox(0, .19, .025, L / 2 - .01, .28, .004, '#a39a8c', M_COBBLE);
  for (const f of [.2, .27]) kBox(0, f, .029, L / 2 - .02, .004, .003, '#5d6066');
  if (lod) for (let k = 0; k < L * 3; k++) kCyl(-L / 2 + (k + .5) / 3, .5, .005, .012, .003, '#3a3c42', 0, 8, 0);
  // the warehouse range: three floors of brick, arched windows, pilasters, a cornice, a copper roof with dormers
  kPlinth(s0, s1, fB, fD, .04, '#8f877c'); kBox(0, (fB + fD) / 2, .04, (s1 - s0) / 2, (fD - fB) / 2, H - .04, br, M_BRICK);
  kWins(s0 + .03, s1 - .03, fD, .04, fh, 3, Math.round(L * 7), { ty: 'sash', arch: 'seg', hk: .55, wall: br }, null, B.id % 50);
  if (lod) for (let q = 0; q <= L * 4; q++) kBox(s0 + q * (s1 - s0) / (L * 4), fD + .004, .04, .012, .004, H - .06, br2, M_BRICK);
  kBand(s0, s1, fD, .04 + fh, br2, .012); kCornice(s0, s1, fB, fD, H, '#e8dcc8');
  kGable(s0, s1, fB, fD, H + .02, .16, cu, { wall: br, wm: M_BRICK, ov: .015 });
  if (lod) for (let q = 0; q < L * 3; q++) kDormer(s0 + .17 + q * (s1 - s0 - .3) / Math.max(1, L * 3 - 1), fD - .05, H + .07, .03, .06, .08, cu, br, M_BRICK, q);
  // corner towers with tall pointed caps, a clock tower in the middle of a long range
  for (const sg of [-1, 1]) { const ts = sg < 0 ? s0 + .07 : s1 - .07; kBox(ts, (fB + fD) / 2, 0, .075, (fD - fB) / 2 + .01, H + .12, br, M_BRICK); kCornice(ts - .075, ts + .075, fB - .01, fD + .01, H + .12, '#e8dcc8', { br: 0 });
    kHip(ts - .08, ts + .08, fB - .015, fD + .015, H + .135, .2, cuD, { ov: .01, noGut: 1 }); kBox(ts, (fB + fD) / 2, H + .33, .005, .005, .06, '#d8b84f'); if (lod) kWins(ts - .06, ts + .06, fD + .01, H - .02, .1, 1, 2, { ty: 'sash', arch: 'round' }, null, 9 + sg); }
  if (L >= 3) { kBox(0, (fB + fD) / 2, 0, .09, (fD - fB) / 2 + .015, H + .26, br, M_BRICK); kClock(0, fD + .016, H + .17, .05); kHip(-.095, .095, fB - .02, fD + .02, H + .27, .24, cuD, { ov: .01, noGut: 1, fin: 1 }); }
  // at each berth: tall loading doors under a hoist, a portal crane on the rails (its jib swings: works.js), cargo on the quay
  for (let k = 0; k < L; k++) { const sc = -L / 2 + k + .5, h = hash2(B.x + k, B.y, 5);
    kBox(sc + .24, fD + .004, .04, .045, .005, H - .1, '#4a3a30', M_PLANK); if (lod) { kBeam([sc + .24, fD, H - .02], [sc + .24, fD + .1, H - .02], .007, '#5a4a3c', M_PLANK); kBeam([sc + .24, fD + .09, H - .02], [sc + .24, fD + .09, .12], .0015, '#3a3028'); }
    const hc = 16 * ZS, cc = h < .5 ? '#b8503a' : '#3f6f5f', cs = sc - .22; // the portal: four legs over the rails, a cab on top
    for (const [ds, df] of [[-.05, .19], [.05, .19], [-.05, .29], [.05, .29]]) kBox(cs + ds, df, .03, .008, .008, hc * .62, cc);
    kBox(cs, .24, hc * .62, .065, .07, .02, cc); kBox(cs, .26, hc * .64, .035, .035, .06, '#3a4048'); kBox(cs, .26, hc * .7, .04, .04, .008, cc);
    for (let q = 0; q < 5; q++) { const hh = hash2(B.x + k, q, 13), cf = .05 + (q % 2) * .08, cs2 = sc - .05 + (q >> 1) * .12; // crates, sacks and barrels
      if (q % 3 === 0) kBox(cs2, cf, .029, .03, .03, .04 + hh * .03, hh < .5 ? '#a57c55' : '#8a6a4c', M_PLANK);
      else if (q % 3 === 1) { for (let m = 0; m < 3; m++) kBlob(cs2 + (m - 1) * .022, cf, .04, .014, .012, '#d9c9a0', 0); }
      else for (let m = 0; m < 3; m++) kCyl(cs2 + (m - 1) * .024, cf, .029, .011, .028, '#7a5a3c', M_PLANK, 8, '#6a4a30'); }
    if (lod && h > .6) kBox(sc + .05, .1, .029, .06, .05, .04, '#6b7a5a', M_PLANK); } // a tarpaulin over a pile
  for (const s of [s0 + .02, s1 - .02]) cLampPost(s, .42, .4);
  // the piers between the berths: stone moles out over the water with bollards and lamps; a pavilion on the outer two, a beacon on the last
  for (let k = 0; k <= L; k++) { const s = -L / 2 + k + (k === 0 ? .06 : k === L ? -.06 : 0), w = .055, f1 = 1.4;
    kBox(s, (.5 + f1) / 2, ys - y - .05, w, (f1 - .5) / 2, y - ys + .08, '#a39a8c', M_STONE); kBox(s, (.5 + f1) / 2, .03, w + .006, (f1 - .5) / 2 + .006, .01, st, M_STONE);
    if (lod) for (let q = 1; q < 4; q++) kCyl(s + (q % 2 ? w - .012 : -w + .012), .5 + q * .22, .04, .009, .02, '#3a3c42', 0, 8);
    cLampPost(s, .95, .25);
    if (k === 0 || k === L) { kBox(s, f1 - .07, .04, .045, .045, .08, '#e8e2d6', M_PLASTER); kHip(s - .055, s + .055, f1 - .125, f1 - .015, .12, .07, cu, { ov: .01, noGut: 1 }); kBox(s, f1 - .07, .19, .004, .004, .03, '#d8b84f'); }
    if (k === L) { kCyl(s, f1 + .03, .04, .03, .18, '#f2efe8', M_PLASTER, 12); kCyl(s, f1 + .03, .22, .022, .03, '#ffd27a', 0, 10, 0, 3); kCone(s, f1 + .03, .25, .028, .03, '#b84a3a', 10, M_PLASTER); } }
}
function harbourFuture(B, { y, ys, L, P, A3, D3, lx, lz }) {
  kSet(lx, lz, A3, D3, B.id); KF.y0 = y; const lod = KF.lod;
  kBox(0, 0, .025, L / 2, .5, .004, '#e6e9ea', M_STONE); kBox(0, .495, .029, L / 2, .004, .004, C_GLOW, 0, 3); // a pale deck with a line of light along its edge
  // the terminal: a long low glass hall under white ribs, green roofs on its wings, a white drum at either end
  kEDome(0, -.28, .029, L / 2 - .12, .16, .2, C_GLASSF, M_GLASS); if (lod) for (let q = 0; q <= L * 4; q++) kBox(-L / 2 + .12 + q * (L - .24) / (L * 4), -.28, .029, .005, .165, .19, C_WHITE, M_PLASTER);
  for (const sg of [-1, 1]) { fPod(sg * (L / 2 - .07), -.28, .029, .065, .26, 40 + sg); kBox(sg * (L / 2 - .07), -.28, .29, .05, .05, .01, C_GREEN, M_GRASS); }
  // white gantries at each berth (their trolleys run: works.js), sleek cargo pods in pale colours
  for (let k = 0; k < L; k++) { const s = -L / 2 + k + .5, hc = .95;
    for (const [sa, ta] of [[-.14, .12], [.14, .12], [-.14, .42], [.14, .42]]) gBeam(P(s + sa, ta), P(s + sa, ta, y + hc), .011, '#f2f4f5');
    for (const sa of [-.14, .14]) gBeam(P(s + sa, -.05, y + hc), P(s + sa, 1.3, y + hc), .013, '#f2f4f5'); gBox(P(s, 1.28, y + hc - .01), V3s(A3, .15), V3s(D3, .01), .006, C_GLOW, 0, 3);
    for (let q = 0; q < 4; q++) kEDome(s - .25 + q * .14, .12 + (q % 2) * .1, .029, .05, .03, .05, ['#cfe7ef', '#e8dff2', '#f2ead8', '#dbeedd'][q], M_PLASTER); }
  // floating piers edged with light, and a pad for the hover ferries at the end of the outer ones
  for (let k = 0; k <= L; k++) { const s = -L / 2 + k + (k === 0 ? .06 : k === L ? -.06 : 0), f1 = 1.4;
    kBox(s, (.5 + f1) / 2, ys - y + .02, .05, (f1 - .5) / 2, .03, C_WHITE, M_PLASTER); for (const sg of [-1, 1]) kBox(s + sg * .051, (.5 + f1) / 2, ys - y + .045, .002, (f1 - .5) / 2, .004, C_GLOW, 0, 3);
    if (k === 0 || k === L) { kCyl(s, f1 + .06, ys - y + .02, .1, .03, C_WHITE, M_PLASTER, 20, '#d9dde0'); kCyl(s, f1 + .06, ys - y + .051, .07, .002, C_GLOW, 0, 20, 0, 3); } }
}
