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
function glBox(cx, cy, u0, v0, hw, hd, z0, h, col, top) {
  if (dsRound()) { const [X, Y] = pt(cx, cy, u0, v0, 0); return glCyl(X, Y, Math.max(hw, hd) * 1.08, z0, h, col, top); }
  const c = gcol(col), ct = top ? gcol(top) : c, P = (u, v, z) => gw(u0 + u, v0 + v, z, cx, cy), z1 = z0 + h; GLB.ctr = P(0, 0, z0 + h / 2);
  GLB.mat = GLB.wall && z1 > 6 ? M_TAR : 0; gquad(P(-hw, -hd, z1), P(-hw, hd, z1), P(hw, hd, z1), P(hw, -hd, z1), ct); GLB.mat = GLB.wall || 0;
  gquad(P(-hw, hd, z0), P(hw, hd, z0), P(hw, hd, z1), P(-hw, hd, z1), c);
  gquad(P(hw, hd, z0), P(hw, -hd, z0), P(hw, -hd, z1), P(hw, hd, z1), c);
  gquad(P(hw, -hd, z0), P(-hw, -hd, z0), P(-hw, -hd, z1), P(hw, -hd, z1), c);
  gquad(P(-hw, -hd, z0), P(-hw, hd, z0), P(-hw, hd, z1), P(-hw, -hd, z1), c);
  const [sx, sy] = pt(cx, cy, u0, v0, 0); GLB.tops.push([sx, sy, z1]);
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
}
function roofMat(c) { return c[0] > c[2] + .1 && c[0] > c[1] ? M_ROOF : M_SLATE; } // red and brown roofs are tiled, grey and blue ones slated
function glPyr(cx, cy, u0, v0, hw, hd, z, rh, col) {
  const c = gcol(col), o = .04, P = (u, v, zz) => gw(u0 + u, v0 + v, zz, cx, cy), T = P(0, 0, z + rh); GLB.ctr = P(0, 0, z - 1); GLB.mat = roofMat(c);
  const ze = z - rh * o / Math.max(.05, Math.min(hw, hd)), A = P(-hw - o, -hd - o, ze), B = P(hw + o, -hd - o, ze), C = P(hw + o, hd + o, ze), D = P(-hw - o, hd + o, ze); // eaves drop to meet the walls
  gtri(B, A, T, c); gtri(A, D, T, c); gtri(D, C, T, c); gtri(C, B, T, c);
}
// windows on all four walls (the camera can go round now); em in (0, 1) = a window, lit when em < the night's lit fraction
function glWindows(cx, cy, u0, v0, hw, hd, z0, h, floors, cols, col) {
  const c = gcol(col), fh = h / floors, e = .006; GLB.ctr = gw(u0, v0, z0 + h / 2, cx, cy);
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
function glAO(v) { // corners are shared by several triangles: work each one out once
  const memo = new Map();
  for (let t = 0; t < v.length; t += 13) {
    const key = Math.round(v[t] * 256) * 131071 + Math.round(v[t + 2] * 256) * 8191 + Math.round(v[t + 1] * 512) * 7 + Math.round(v[t + 4] * 3) * 3 + Math.round(v[t + 3] * 3) * 5 + Math.round(v[t + 5] * 3) * 11;
    let a = memo.get(key); if (a === undefined) { a = aoAt(v[t], v[t + 1], v[t + 2], v[t + 3], v[t + 4], v[t + 5]); memo.set(key, a); } v[t + 12] = a;
  }
}
function glBuildChunk(k) {
  const cx0 = (k % GNC) * GCH, cy0 = ((k / GNC) | 0) * GCH, v = [], lamps = [];
  const svLT = LT, svEM = EMQ; LT = GLT_FLAT(); EMQ = null;
  try {
    for (let y = cy0; y < cy0 + GCH; y++) for (let x = cx0; x < cx0 + GCH; x++) {
      const i = idx(x, y), h = GT(i);
      GLB = { v, x, y, base: surfZ(i) * ZS, tops: [], id: i + 1, wall: 0, mat: 0 };
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
      { const Bw = M.bld[i] && S.B[M.bld[i]]; GLB.wall = Bw ? glWallMat(Bw) : M_PLANK; } // walls by what the building is made of; street furniture is wooden
      try { drawTileObjects(GSTUB, i, x, y, 0, 0); } catch (e) { }
      const B = M.bld[i] && S.B[M.bld[i]];
      if (B && !B.hid && FLAT_TYPES[B.type]) { GLB.flat = B.type === 'farm' ? 'farm' : B.type === 'park' || B.type === 'pasture' ? 'green' : B.type === 'plaza' || B.type === 'airfield' ? 'paved' : ''; try { drawBuilding(GSTUB, B, 0, 0, i); } catch (e) { } GLB.flat = ''; }
    }
  } finally { GLB = null; LT = svLT; EMQ = svEM; }
  return { v: new Float32Array(v), lamps };
}
let GLT_N = null;
function GLT_FLAT() { // the light the colours are picked under: none at all (the shader does the lighting)
  if (GLT_N && GLT_N.base === LIGHT.cur) return GLT_N;
  GLT_N = Object.assign({}, LIGHT.cur, { fL: 1, fR: 1, fT: 1, fG: 1, fWL: 1, fWR: 1, lit: 1, amb: 1, sky: 0, dif: 0, hx: .5, hy: .5, shA: 0, base: LIGHT.cur });
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
    if (tt === 2) { GLB.mat = M_BARK; glBoxW(X, Z, .03 * s, b, 4 * s * ZS, '#6b5a55'); GLB.mat = M_LEAF; const c = gcol(leafC(hv < .5 ? '#3f6f4a' : '#35604a')); const A = [X, b + 18 * s * ZS, Z]; GLB.ctr = [X, b, Z]; for (let j = 0; j < 8; j++) { const a0 = j / 8 * TAU, a1 = (j + 1) / 8 * TAU, r = .2 * s; gtri([X + Math.cos(a0) * r, b + 3 * s * ZS, Z + Math.sin(a0) * r], [X + Math.cos(a1) * r, b + 3 * s * ZS, Z + Math.sin(a1) * r], A, c); } }
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
precision highp float; in vec2 vU; out vec4 o; uniform vec3 uF, uR, uU;` + GL_SKY + `
void main(){
  vec3 v=normalize(uF+vU.x*uR+vU.y*uU), c=skyCol(v); float mu=dot(v,uSunD), day=smoothstep(-.1,.2,uSunY);
  float disc=smoothstep(.99982,.99992,mu)*smoothstep(-.03,.02,uSunY)*(1.-uCover*.8); c=mix(c,vec3(1.,.97,.9),disc);
  vec3 q=v*420., qc=floor(q); float st=fract(sin(dot(qc,vec3(12.9898,78.233,37.719)))*43758.5453); // stars: small round points, out once the sun is well down
  float night=1.-smoothstep(-.2,-.06,uSunY), pt=smoothstep(.34,.08,length(fract(q)-.5));
  c+=vec3(.9,.92,1.)*step(.9975,st)*pt*night*(1.-uCover)*smoothstep(0.,.2,v.y)*(.45+.55*fract(st*97.));
  o=vec4(c, disc*.5); // (only the disc itself glows: a glow over a wide patch of bright sky blooms into a blinding blob)
}`;
const GL_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in float aE; layout(location=4) in float aI; layout(location=5) in float aM; layout(location=6) in float aO;
uniform mat4 uVP, uSVP; out vec3 vP, vN, vC; out float vE, vO; out vec4 vS; flat out float vI, vM;
void main(){ vP=aP; vN=aN; vC=aC; vE=aE; vI=aI; vM=aM; vO=aO; vS=uSVP*vec4(aP+aN*.02,1.); gl_Position=uVP*vec4(aP,1.); }`;
const GL_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vP, vN, vC; in float vE, vO; in vec4 vS; flat in float vI, vM; out vec4 o;
uniform highp sampler2DArray uTex; uniform vec3 uAvg[18]; uniform float uTS[18], uRaw[18];
uniform float uHi, uFog0, uFogL; uniform vec3 uFogC; uniform vec3 uSun, uSunC, uSky, uGnd, uWin, uLamp, uEye; uniform float uLit, uShK, uT;
uniform sampler2DShadow uSh; uniform int uNL; uniform vec3 uLP[64];` + GL_SKY + `
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
  if(vE<-.5 && n.y>.5){ // water: ripples that move, a deeper colour, and the sun's glint
    vec2 q=vP.xz; n=normalize(vec3(sin(q.x*9.+uT*1.3)*.06+sin(q.y*13.7-uT*1.7)*.04+sin((q.x+q.y)*21.-uT*2.3)*.025, 1., cos(q.y*8.3+uT*1.1)*.06+cos((q.x-q.y)*17.+uT*1.9)*.03));
    vec3 v=normalize(uEye-vP), h=normalize(uSun+v); float sp=pow(max(dot(n,h),0.),120.);
    vec3 rf=reflect(-v,n); rf.y=abs(rf.y); c=mix(c*vec3(.72,.86,.92), untone(skyCol(rf))*.8, .35*(1.-max(dot(n,v),0.))); c+=vec3(1.,.95,.85)*sp*2.2*uShK; glow=min(.45,sp*.7)*uShK; }
  float nd=m==5 ? clamp(dot(n,uSun)*.55+.45,0.,1.) : max(dot(n,uSun),0.), sh=mix(1., shadow(), uShK); // leaves let light through, so it wraps round to their shady side
  float ao=vE<-.5?1.:clamp(vO,0.,1.); ao=ao*ao*(3.-2.*ao); if(m==5) ao=.35+.65*ao; // how much open sky this spot sees (baked per vertex)
  vec3 amb=mix(uGnd,uSky,n.y*.5+.5)*ao;
  vec3 bounce=uSunC*.22*max(dot(n,normalize(vec3(-uSun.x,.35,-uSun.z))),0.)*(.4+.6*ao); // light thrown back off the sunny side of things
  vec3 lit=c*(amb+uSunC*nd*sh*mix(.8,1.,ao)+bounce);
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
  GL3.main = glProg(gl, GL_VS, GL_FS); GL3.sky = glProg(gl, GL_KVS, GL_KFS);
  try { GL3.post = { pr: glProg(gl, GL_KVS, GL_BFS), msF: gl.createFramebuffer(), msC: gl.createRenderbuffer(), msD: gl.createRenderbuffer(), ns: glSoft(gl) || QS.has('lo') ? 0 : Math.min(4, gl.getParameter(gl.MAX_SAMPLES)), hdr: !!gl.getExtension('EXT_color_buffer_float'), lv: [], w: 0, h: 0 }; } catch (e) { GL3.post = null; }
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
    if (e.button !== 0 && !touchy(e)) return;
    GL3.touched = touchy(e);
    UI.lastMove = performance.now(); UI.mouse.x = e.clientX; UI.mouse.y = e.clientY;
    P.set(e.pointerId, [e.clientX, e.clientY]); try { c.setPointerCapture(e.pointerId); } catch (er) { }
    if (P.size === 1) GL3.drag = [e.clientX, e.clientY, GL3.cam.yaw, GL3.cam.pitch, false, touchy(e)];
    else { GL3.drag = null; const [a, b] = [...P.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: GL3.cam.zoom, m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], tx: GL3.cam.tx, tz: GL3.cam.tz }; GL3.cam.auto = false; GL3.follow = null; GL3.goto = null; }
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
    if (!d[4] && Math.abs(e.clientX - d[0]) + Math.abs(e.clientY - d[1]) > (d[5] ? 10 : 4)) { d[4] = true; GL3.cam.auto = false; }
    if (d[4]) { GL3.cam.yaw = d[2] - (e.clientX - d[0]) * .006; GL3.cam.pitch = clamp(d[3] + (e.clientY - d[1]) * .004, GL3.cam.persp ? .1 : .2, 1.45); }
  });
  const up = e => {
    P.delete(e.pointerId); if (P.size < 2) pinch = null;
    const d = GL3.drag; GL3.drag = null;
    if (e.type === 'pointerup' && d && !d[4]) { if (d[5]) { GL3.tapAt = [e.clientX, e.clientY]; GL3.pickReq = true; GL3.pickT = 0; } else glClick(e.clientX, e.clientY); } // a tap waits for the pick under the finger
  };
  c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  c.addEventListener('pointerleave', e => { if (!touchy(e)) { GL3.hover = 0; $('tip').style.opacity = 0; } });
  c.addEventListener('wheel', e => { GL3.cam.zoom = clamp(GL3.cam.zoom * Math.exp(e.deltaY * .001), 1.2, 44); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'r') GL3.cam.auto = !GL3.cam.auto;
    else if (k === 'n') { GL3.hi = (GL3.hi + 1) % GL3.hr.length; SF.hour(GL3.hr[GL3.hi]); toast(GL3.hr[GL3.hi] == null ? 'Time of day: live' : `Time of day: ${Math.floor(GL3.hr[GL3.hi])}:${String(Math.round(GL3.hr[GL3.hi] % 1 * 60)).padStart(2, '0')}`); }
    else if (k === 'p') { GL3.cam.persp = !GL3.cam.persp; if (!GL3.cam.persp) GL3.cam.pitch = Math.max(.2, GL3.cam.pitch); toast(GL3.cam.persp ? 'Perspective view' : 'Isometric view'); }
    else if (k === 't') { GL3.town++; GL3.follow = null; GL3.goto = null; glFocusTown(); }
  });
  const hint = document.createElement('div'); hint.id = 'glHint';
  hint.style.cssText = 'position:fixed;right:16px;top:14px;max-width:430px;line-height:1.45;z-index:4;padding:8px 12px;border-radius:12px;background:rgba(255,251,245,.82);box-shadow:0 4px 18px rgba(60,40,60,.15);font:12.5px "Segoe UI",system-ui,sans-serif;color:#2b2833';
  hint.innerHTML = (matchMedia('(pointer: coarse)').matches ? '<b>3D view</b> · drag to turn · pinch to zoom · two fingers to move · tap anything to see what it is' : '<b>3D view</b> · drag to turn · wheel to zoom · <b>R</b> auto-rotate · <b>N</b> time of day · <b>T</b> next town · <b>P</b> perspective or isometric · point at anything to see what it is, click a person to follow them') + ' <span id="glHideHint" style="cursor:pointer;opacity:.6">✕</span>';
  hint.querySelector('#glHideHint').onclick = () => hint.remove();
  if (innerWidth < 700) { hint.style.cssText += ';top:auto;right:12px;left:12px;bottom:150px;max-width:none;font-size:12px'; setTimeout(() => hint.remove(), 15000); } // phones: above the tool bar, and not for long
  document.body.appendChild(hint);
  glFocusTown();
  return true;
}
function glFocusTown() { const ts = towns().sort((a, b) => b.pop - a.pop); if (!ts.length) return; const T = ts[GL3.town % ts.length]; GL3.cam.tx = T.x; GL3.cam.tz = T.y; GL3.cam.ty = surfZ(idx(T.x, T.y)) * ZS; GL3.cam.zoom = clamp(townRadius(T) * .75 + 2.5, 5, 14); }
function glFrame(dt) {
  const gl = GL3.gl, c = GL3.c, cam = GL3.cam; GL3.t += dt; GL3.dt = dt;
  LIGHT.sun = sunNow(); if (!LIGHT.season || (LIGHT.seasonT -= dt) <= 0) { LIGHT.season = LIGHT.forceSeason || seasonNow(); LIGHT.seasonT = 300; }
  stepWeather(dt); DIRTY.length = 0;
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  // rebuild what changed, a few chunks a frame
  // (the height map first, for every chunk in this batch, then the occlusion, which looks across into the neighbours)
  const batch = [], again = new Set(); let n = 0;
  for (const k of GL3.dirty) { if (n++ >= (GL3.first ? 3 : 64)) break; batch.push(k); }
  const built = batch.map(k => { GL3.dirty.delete(k); const r = glBuildChunk(k), old = glEdge(k); hfRaster(k, r.v); if (GL3.first && glEdge(k) !== old) for (const j of glNbrs(k)) if (!batch.includes(j)) again.add(j); return [k, r]; });
  for (const [k, r] of built) { glAO(r.v); const ch = GL3.chunks[k]; gl.bindBuffer(gl.ARRAY_BUFFER, ch.buf); gl.bufferData(gl.ARRAY_BUFFER, r.v, gl.STATIC_DRAW); ch.n = r.v.length / 13; ch.lamps = r.lamps; }
  for (const j of again) GL3.dirty.add(j); // a new tall building by the edge darkens the next chunk's streets too
  GL3.first = true;
  if (cam.auto) cam.yaw += dt * .05;
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
    const g = Math.max(hfAt(eye[0], eye[2]) - eye[1], hfAt((eye[0] + tgt[0]) / 2, (eye[2] + tgt[2]) / 2) - (eye[1] + tgt[1]) / 2); if (g < -.35 || pit >= 1.45) break;
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
  const attrs = full => { // full: everything the lit view needs; 1: position and id (picking); 0: position only (shadows)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 52, 0);
    if (full === true) { for (const a of [1, 2, 3, 5, 6]) gl.enableVertexAttribArray(a); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 52, 12); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 52, 24); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 52, 36); gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 52, 44); gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 52, 48); } else { gl.disableVertexAttribArray(5); gl.disableVertexAttribArray(6); }
    if (full) { gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 52, 40); } else gl.disableVertexAttribArray(4);
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.dyn); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.STREAM_DRAW);
  const drawAll = full => { for (const ch of GL3.chunks) if (ch.n) { gl.bindBuffer(gl.ARRAY_BUFFER, ch.buf); attrs(full); gl.drawArrays(gl.TRIANGLES, 0, ch.n); } if (dyn.length) { gl.bindBuffer(gl.ARRAY_BUFFER, GL3.dyn); attrs(full); gl.drawArrays(gl.TRIANGLES, 0, dyn.length / 13); } if (full === true) { gl.bindBuffer(gl.ARRAY_BUFFER, GL3.sea); attrs(full); gl.drawArrays(gl.TRIANGLES, 0, 6); } };
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
    gl.useProgram(K.p); skyU(K.u); gl.uniform3fv(K.u.uF, f); gl.uniform3fv(K.u.uR, r.map(q => q * tn * aspect)); gl.uniform3fv(K.u.uU, u.map(q => q * tn));
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
  gl.uniform1f(U.uFog0, dist + zz * .6); gl.uniform1f(U.uFogL, cam.persp ? 55 : 0);
  drawAll(true);
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
  const tip = $('tip'), id = GL3.hover || 0, now = performance.now();
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
  if (id >= GPID) { const wk = DYN.walkers[id - GPID]; if (wk && wk.pid) { openPerson(wk.pid); GL3.follow = wk; GL3.cam.auto = false; } return; }
  const i = id - 1, x = i % W, y = (i / W) | 0;
  if (UI.tool) {
    const k = UI.tool;
    if (useTool(k, x, y)) { UI.tool = null; document.body.classList.remove('targeting'); document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.remove('sel')); renderTools(); UIDIRTY.chron = true; toast(`${TOOL_INFO[k][0]} sent. The colonists noticed.`); }
    return;
  }
  GL3.follow = null; GL3.goto = [x, surfZ(i) * ZS, y]; GL3.cam.auto = false;
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
  const v = GL3.fb || (GL3.fb = new GLFBuf()); v.length = 0; GLB = { v, x: 0, y: 0, base: 0, tops: [], id: 0, mat: 0, wall: 0 }; GL3.carry = [];
  const night = LIGHT.emK > .02; GL3.litNow = night;
  try {
    for (let k = 0; k < DYN.walkers.length; k++) {
      const w = DYN.walkers[k], p = walkerPos(w); if (!p || p[3] < .3) continue; GLB.id = w.pid ? GPID + k : 0; // a person you can point at
      const X = p[0], Z = p[1], y0 = p[2] * ZS; GLB.ao = .35 + .65 * aoAt(X, y0 + .15, Z, 0, 1, 0); // darker down an alley
      glPerson(w, X, Z, y0, glHeading(w, p[4], p[5]), !!p[6], night && w.ln < (S.era === 0 ? .6 : .12));
    }
    GLB.id = 0; GLB.ao = 1;
    for (const hd of DYN.herds) for (const m of hd.members) { const [fx, fy, z] = agentPos(m), bx = m.b % W - m.a % W, by = ((m.b / W) | 0) - ((m.a / W) | 0); glSheep(fx, fy, z * ZS, (m.size || 1) * (m.baby ? .6 : 1), glHeading(m, bx, by), m.pause > 0 ? -1 : DYN.t * 3 + (m.a % 7)); }
    for (const c of DYN.vehicles) { const p = vehiclePos(c); if (!p) continue; GLB.ao = .35 + .65 * aoAt(p[0], p[2] * ZS + .15, p[1], 0, 1, 0); glVehicle(c, p[0], p[1], p[2] * ZS, glHeading(c, p[4], p[5]), true); }
  } catch (e) { if (QS.has('dev')) console.error(e); } finally { GLB = null; }
  return v.a.subarray(0, v.length);
}

/* ---------- switching between the 2D and 3D views (3D by default) ---------- */
const GL_DEFAULT = true; // new worlds and new browsers open in 3D (the choice is remembered)
function glWanted() { if (QS.has('2d')) return false; if (QS.has('gl')) return true; try { const v = localStorage.getItem('sf3d'); if (v) return v === '1'; } catch (e) { } return GL_DEFAULT; }
function glToggle() {
  const want = !GL3.on; try { localStorage.setItem('sf3d', want ? '1' : '0'); } catch (e) { }
  if (want) { if (!GL3.gl) glInit(); else { GL3.on = true; GL3.c.style.display = 'block'; $('view').style.display = 'none'; for (let k = 0; k < GNC * GNC; k++) GL3.dirty.add(k); } }
  else { ensure2D(); GL3.on = false; GL3.c.style.display = 'none'; $('view').style.display = 'block'; const h = $('glHint'); if (h) h.remove(); $('tip').style.opacity = 0; renderAll(); relightNow(); }
  glBtn();
}
function glBtn() {
  let b = $('glBtn');
  if (!b) { b = document.createElement('button'); b.id = 'glBtn'; b.onclick = glToggle; b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:4;padding:8px 14px;border:0;border-radius:12px;background:rgba(255,251,245,.9);box-shadow:0 4px 18px rgba(60,40,60,.18);font:600 13px "Segoe UI",system-ui,sans-serif;color:#2b2833;cursor:pointer'; document.body.appendChild(b); }
  if (innerWidth < 700) b.style.bottom = '104px'; // clear of the tool bar on a phone
  b.textContent = GL3.on ? 'Switch to 2D' : 'Try it in 3D';
}

/* ---------- textures, painted in code at start-up (no image files): one layer each in a texture array ---------- */
// Materials: 0 none, 1 grass, 2 brick, 3 roof tiles, 4 bark, 5 leaves, 6 plaster, 7 stone, 8 planks, 9 cobbles, 10 asphalt, 11 earth.
// The shader lays them on by world position (triplanar), so nothing needs unwrapping. RAW is how much of the texture's own
// colour replaces the art's colour (grass and bark look real; plaster keeps the building's own colour and only gains grain).
const TX = { N: 256, L: 18, SCALE: [1, .5, 1.8, 1.6, 3.5, 2.2, 1.2, 1.4, 2, 1.6, .7, .6, 1.8, 1, 2.2, .6, 1.2, 1.4], RAW: [0, .85, .55, .4, .9, .7, 0, .35, .45, .55, .7, .7, .3, .75, .35, .7, .5, .25] };
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
  return { data: out, avg };
}
// what a building's walls are made of
function glWallMat(B) { if (!B) return M_PLASTER; if (B.type === 'house' && B.tier >= 6) return M_GLASS; if (B.mat === 'brick') return M_BRICK; if (B.mat === 'stone') return M_STONE; if (B.mat === 'wood') return M_PLANK; return M_PLASTER; }
const ROAD_MAT = [0, M_EARTH, M_EARTH, M_COBBLE, M_BRICK, M_ASPHALT, M_PLASTER, 0];
