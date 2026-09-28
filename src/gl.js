/* ============================== ?gl: a proof of concept of the world in real 3D (WebGL2) ============================== */
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
function gv(p, n, c, e) { GLB.v.push(p[0], p[1], p[2], n[0], n[1], n[2], c[0], c[1], c[2], e, GLB.id || 0); } // the last float is what the pixel belongs to (for picking)
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
  gquad(P(-hw, -hd, z1), P(-hw, hd, z1), P(hw, hd, z1), P(hw, -hd, z1), ct);
  gquad(P(-hw, hd, z0), P(hw, hd, z0), P(hw, hd, z1), P(-hw, hd, z1), c);
  gquad(P(hw, hd, z0), P(hw, -hd, z0), P(hw, -hd, z1), P(hw, hd, z1), c);
  gquad(P(hw, -hd, z0), P(-hw, -hd, z0), P(-hw, -hd, z1), P(hw, -hd, z1), c);
  gquad(P(-hw, -hd, z0), P(-hw, hd, z0), P(-hw, hd, z1), P(-hw, -hd, z1), c);
  const [sx, sy] = pt(cx, cy, u0, v0, 0); GLB.tops.push([sx, sy, z1]);
}
function glFlat(cx, cy, u0, v0, hw, hd, z, col) {
  const c = gcol(col), P = (u, v) => gw(u0 + u, v0 + v, z + .25, cx, cy); GLB.ctr = gw(u0, v0, z - 20, cx, cy);
  gquad(P(-hw, -hd), P(-hw, hd), P(hw, hd), P(hw, -hd), c);
}
function glCylAt(u, v, r, z0, h, col, top, n = 12) {
  const c = gcol(col), ct = top ? gcol(top) : c, P = (a, z) => gw(u + Math.cos(a) * r, v + Math.sin(a) * r, z), C = gw(u, v, z0 + h); GLB.ctr = gw(u, v, z0 + h / 2);
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gquad(P(a, z0), P(b, z0), P(b, z0 + h), P(a, z0 + h), c); gtri(C, P(b, z0 + h), P(a, z0 + h), ct); }
}
function glCyl(X, Y, r, z0, h, col, top) { const [u, v] = gunscreen(X, Y); glCylAt(u, v, r, z0, h, col, top); GLB.tops.push([X, Y, z0 + h]); }
function glCone(X, Y, r, h, col) {
  let zb = 0; // a cone is often drawn lifted onto whatever it tops: find that
  for (const [sx, sy, z] of GLB.tops) if (Math.abs(sx - X) < .7 && Math.abs(sy - z - Y) < 1.6) { zb = z; Y = sy; break; }
  const [u, v] = gunscreen(X, Y), c = gcol(col), n = 12, A = gw(u, v, zb + h); GLB.ctr = gw(u, v, zb - 1);
  for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gtri(gw(u + Math.cos(a) * r, v + Math.sin(a) * r, zb), gw(u + Math.cos(b) * r, v + Math.sin(b) * r, zb), A, c); }
}
function glDome(X, Y, r, z0, h, col) { const [u, v] = gunscreen(X, Y); glDomeAt(u, v, r, z0, h, col); }
function glDomeAt(u, v, r, z0, h, col, e = 0) {
  GLB.ctr = gw(u, v, z0); const c = gcol(col), n = 12, m = 4, P = (a, t) => gw(u + Math.cos(a) * r * Math.cos(t), v + Math.sin(a) * r * Math.cos(t), z0 + h * Math.sin(t));
  for (let j = 0; j < m; j++) { const t0 = j / m * Math.PI / 2, t1 = (j + 1) / m * Math.PI / 2; for (let k = 0; k < n; k++) { const a = k / n * TAU, b = (k + 1) / n * TAU; gquad(P(a, t0), P(b, t0), P(b, t1), P(a, t1), c, e); } }
}
function glBall(u, v, r, zc, rz, col, e = 0) { glDomeAt(u, v, r, zc, rz, col, e); glDomeAt(u, v, r, zc, -rz, col, e); }
function glGable(cx, cy, u0, v0, hw, hd, z, rh, col, wall, alongU) {
  const c = gcol(col), cw = gcol(wall), o = .05, P = (u, v, zz) => gw(u0 + u, v0 + v, zz, cx, cy); GLB.ctr = P(0, 0, z - 1);
  if (alongU) {
    gquad(P(-hw - o, -hd - o, z), P(-hw - o, 0, z + rh), P(hw + o, 0, z + rh), P(hw + o, -hd - o, z), c);
    gquad(P(hw + o, hd + o, z), P(hw + o, 0, z + rh), P(-hw - o, 0, z + rh), P(-hw - o, hd + o, z), c);
    gtri(P(hw, -hd, z), P(hw, 0, z + rh), P(hw, hd, z), cw); gtri(P(-hw, hd, z), P(-hw, 0, z + rh), P(-hw, -hd, z), cw);
  } else {
    gquad(P(-hw - o, hd + o, z), P(0, hd + o, z + rh), P(0, -hd - o, z + rh), P(-hw - o, -hd - o, z), c);
    gquad(P(hw + o, -hd - o, z), P(0, -hd - o, z + rh), P(0, hd + o, z + rh), P(hw + o, hd + o, z), c);
    gtri(P(-hw, hd, z), P(hw, hd, z), P(0, hd, z + rh), cw); gtri(P(hw, -hd, z), P(-hw, -hd, z), P(0, -hd, z + rh), cw);
  }
}
function glPyr(cx, cy, u0, v0, hw, hd, z, rh, col) {
  const c = gcol(col), o = .04, P = (u, v, zz) => gw(u0 + u, v0 + v, zz, cx, cy), T = P(0, 0, z + rh); GLB.ctr = P(0, 0, z - 1);
  const A = P(-hw - o, -hd - o, z), B = P(hw + o, -hd - o, z), C = P(hw + o, hd + o, z), D = P(-hw - o, hd + o, z);
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
function glBuildChunk(k) {
  const cx0 = (k % GNC) * GCH, cy0 = ((k / GNC) | 0) * GCH, v = [], lamps = [];
  const svLT = LT, svEM = EMQ; LT = GLT_FLAT(); EMQ = null;
  try {
    for (let y = cy0; y < cy0 + GCH; y++) for (let x = cx0; x < cx0 + GCH; x++) {
      const i = idx(x, y), h = GT(i);
      GLB = { v, x, y, base: surfZ(i) * ZS, tops: [], id: i + 1 };
      // ground
      const top = gcol(topColor(i)), sc = gcol(sideCol(i));
      GLB.ctr = [x, h - 1, y]; gquad([x - .5, h, y - .5], [x - .5, h, y + .5], [x + .5, h, y + .5], [x + .5, h, y - .5], top, M.water[i] ? -1 : 0);
      for (const [dx, dy] of N4) { // walls down to lower neighbours (and the island's edge)
        const nx = x + dx, ny = y + dy, nh = inb(nx, ny) ? GT(idx(nx, ny)) : -SLAB * ZS; if (nh >= h - .001) continue;
        const e = dx ? [[x + dx * .5, y - .5], [x + dx * .5, y + .5]] : [[x - .5, y + dy * .5], [x + .5, y + dy * .5]];
        GLB.ctr = [x, (h + nh) / 2, y];
        gquad([e[0][0], nh, e[0][1]], [e[1][0], nh, e[1][1]], [e[1][0], h, e[1][1]], [e[0][0], h, e[0][1]], M.water[i] ? gcol('#4ea7c8') : sc, M.water[i] ? -1 : 0);
      }
      if (M.road[i]) glRoad(i, x, y);
      if (M.road[i] && !M.water[i] && rcls(i) >= 2 && (x + 2 * y) % (rcls(i) >= 4 ? 2 : 3) === 0 && !M.bld[i]) { // a lamp post, and a real light
        const b = GLB.base, L = [x + .36, b + 10 * ZS, y - .36]; GLB.base = b;
        glBoxW(x + .36, y - .36, .025, b, 9.5 * ZS, '#4c4f58'); glBoxW(x + .36, y - .36, .05, b + 9.5 * ZS, 1.2 * ZS, '#fff3d0', 2); lamps.push(L);
      }
      if (M.tree[i] && !M.bld[i]) glTrees(i, x, y);
      // what stands on the tile, drawn by the same art as the 2D view
      try { drawTileObjects(GSTUB, i, x, y, 0, 0); } catch (e) { }
      const B = M.bld[i] && S.B[M.bld[i]];
      if (B && !B.hid && FLAT_TYPES[B.type]) try { drawBuilding(GSTUB, B, 0, 0, i); } catch (e) { }
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
  if (!br && sf >= R_COBBLE) lay(w + .13, gcol(PAVE_COL[sf]), h - .002);
  lay(w, col, h);
  if (br) glBoxW(x, y, .06, GT(i) - .2, h - GT(i) + .2, t >= 3 ? '#9c958c' : '#7e5f47');
  if (sf === R_ASPHALT && !br) for (const [dx, dy] of nb) seg(dx ? (dx > 0 ? .12 : -.38) : -.012, dx ? (dx > 0 ? .38 : -.12) : .012, dy ? (dy > 0 ? .12 : -.38) : -.012, dy ? (dy > 0 ? .38 : -.12) : .012, gcol('#f3e2a8'), h + .002);
  if (sf === R_GLOW && !br) for (const [dx, dy] of nb) seg(dx ? Math.min(0, dx * .5) : -.015, dx ? Math.max(0, dx * .5) : .015, dy ? Math.min(0, dy * .5) : -.015, dy ? Math.max(0, dy * .5) : .015, gcol('#8fe3ec'), h + .003);
}
const G_PUFF = ['#a57ac6', '#b683c9', '#9570c2', '#c48ac4', '#8f79cf'];
function glTrees(i, x, y) {
  const n = M.tree[i], tt = M.ttype[i], b = GT(i);
  for (let k = 0; k < n; k++) {
    let u = (hash2(x, y, k * 3 + 1) - .5) * .6, v = (hash2(x, y, k * 3 + 2) - .5) * .6; if (n === 1) { u *= .4; v *= .4; }
    const s = .8 + hash2(x, y, k * 3 + 3) * .45, hv = hash2(x, y, 90 + k), X = x + u, Z = y + v;
    if (tt === 2) { glBoxW(X, Z, .03 * s, b, 4 * s * ZS, '#6b5a55'); const c = gcol(leafC(hv < .5 ? '#4f9f95' : '#3f8f8a')); const A = [X, b + 18 * s * ZS, Z]; GLB.ctr = [X, b, Z]; for (let j = 0; j < 8; j++) { const a0 = j / 8 * TAU, a1 = (j + 1) / 8 * TAU, r = .2 * s; gtri([X + Math.cos(a0) * r, b + 3 * s * ZS, Z + Math.sin(a0) * r], [X + Math.cos(a1) * r, b + 3 * s * ZS, Z + Math.sin(a1) * r], A, c); } }
    else if (tt === 3) { glBoxW(X, Z, .03 * s, b, 5 * s * ZS, '#efe6dc'); GLB.base = b; glDomeAt(X - GLB.x, Z - GLB.y, .2 * s, 5 * s, 4 * s, ['#ee92b6', '#f0a860', '#b9a2ff'][(hv * 3) | 0]); }
    else { glBoxW(X, Z, .03 * s, b, 7 * s * ZS, tt === 4 ? '#7b5e4e' : '#7b5e6e'); GLB.base = b; glBall(X - GLB.x, Z - GLB.y, .2 * s, 10 * s, 4.6 * s, leafC(tt === 4 ? '#6db873' : G_PUFF[(hv * G_PUFF.length) | 0])); }
  }
  GLB.base = surfZ(i) * ZS;
}
function glDirty(i) { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) GL3.dirty.add(((ny / GCH) | 0) * GNC + ((nx / GCH) | 0)); } }

/* ---------- shaders ---------- */
const GL_VS = `#version 300 es
layout(location=0) in vec3 aP; layout(location=1) in vec3 aN; layout(location=2) in vec3 aC; layout(location=3) in float aE; layout(location=4) in float aI;
uniform mat4 uVP, uSVP; out vec3 vP, vN, vC; out float vE; out vec4 vS; flat out float vI;
void main(){ vP=aP; vN=aN; vC=aC; vE=aE; vI=aI; vS=uSVP*vec4(aP+aN*.02,1.); gl_Position=uVP*vec4(aP,1.); }`;
const GL_FS = `#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vP, vN, vC; in float vE; in vec4 vS; flat in float vI; out vec4 o;
uniform float uHi, uFog0, uFogL; uniform vec3 uFogC; uniform vec3 uSun, uSunC, uSky, uGnd, uWin, uLamp, uEye; uniform float uLit, uShK, uT;
uniform sampler2DShadow uSh; uniform int uNL; uniform vec3 uLP[64];
float shadow(){ vec3 p=vS.xyz/vS.w*.5+.5; if(p.x<0.||p.x>1.||p.y<0.||p.y>1.) return 1.; float s=0.; vec2 d=vec2(1./2048.);
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uSh, vec3(p.xy+vec2(x,y)*d*1.2, p.z-.0015)); return s/9.; }
void main(){
  vec3 n=normalize(vN), c=vC;
  if(vE<-.5){ // water: a touch of shine
    vec3 v=normalize(uEye-vP), h=normalize(uSun+v); c=mix(c, vec3(1.), .12*pow(max(dot(vec3(0,1,0),h),0.),60.)*uShK*4.); n=vec3(0,1,0); }
  float nd=max(dot(n,uSun),0.), sh=mix(1., shadow(), uShK);
  vec3 amb=mix(uGnd,uSky,n.y*.5+.5);
  vec3 bounce=uSunC*.22*max(dot(n,normalize(vec3(-uSun.x,.35,-uSun.z))),0.); // light thrown back off the sunny side of things
  vec3 lit=c*(amb+uSunC*nd*sh+bounce);
  vec3 pl=vec3(0.);
  for(int i=0;i<64;i++){ if(i>=uNL) break; vec3 d=uLP[i]-vP; float l=length(d); float a=max(0.,1.-l/2.4); pl+=uLamp*a*a*(.35+.65*max(dot(n,d/l),0.)); }
  lit+=c*pl;
  if(vE>0. && vE<1.){ if(vE<uLit) lit=mix(lit, uWin*(.9+.2*fract(vE*37.)), .92); }
  else if(vE>.45 && vE<.55 && uLit>0.) lit=mix(lit,uWin,.8*min(1.,uLit*2.));
  if(vE>1.5) lit=mix(c, uLamp*1.4, uLit>0.?1.:0.);
  if(uHi>0. && abs(vI-uHi)<.5) lit=mix(lit*1.2, vec3(1.,.84,.5), .28+.08*sin(uT*5.)); // what the pointer is on glows softly
  if(uFogL>0.) lit=mix(lit, uFogC, clamp((length(vP-uEye)-uFog0)/uFogL,0.,.55)); // the far side of the valley fades into the sky
  lit=1.-exp(-lit*1.45); // a soft tone curve that keeps the colour
  float g=dot(lit,vec3(.299,.587,.114)); lit=clamp(mix(vec3(g),lit,1.18),0.,1.);
  o=vec4(lit,1.);
}`;
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
  const gl = c.getContext('webgl2', { antialias: true });
  if (!gl) { toast('This browser has no WebGL2, so the 3D preview can’t run here.'); return false; }
  $('view').style.display = 'none'; document.body.insertBefore(c, $('view'));
  GL3.c = c; GL3.gl = gl; GL3.on = true;
  GL3.main = glProg(gl, GL_VS, GL_FS); GL3.sh = glProg(gl, GL_SVS, GL_SFS); GL3.pk = glProg(gl, GL_PVS, GL_PFS);
  GL3.pkF = gl.createFramebuffer(); GL3.pkC = gl.createRenderbuffer(); GL3.pkD = gl.createRenderbuffer(); GL3.pkW = 0; GL3.pkH = 0;
  GL3.shT = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, GL3.shT);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.DEPTH_COMPONENT24, 2048, 2048);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  GL3.shF = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.shF); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, GL3.shT, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  GL3.dyn = gl.createBuffer();
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
      GL3.cam.zoom = clamp(pinch.z * pinch.d / Math.max(20, d), 3, 44);
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
  c.addEventListener('wheel', e => { GL3.cam.zoom = clamp(GL3.cam.zoom * Math.exp(e.deltaY * .001), 3, 44); e.preventDefault(); }, { passive: false });
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const k = e.key.toLowerCase();
    if (k === 'r') GL3.cam.auto = !GL3.cam.auto;
    else if (k === 'n') { GL3.hi = (GL3.hi + 1) % GL3.hr.length; SF.hour(GL3.hr[GL3.hi]); toast(GL3.hr[GL3.hi] == null ? 'Time of day: live' : `Time of day: ${Math.floor(GL3.hr[GL3.hi])}:${String(Math.round(GL3.hr[GL3.hi] % 1 * 60)).padStart(2, '0')}`); }
    else if (k === 'p') { GL3.cam.persp = !GL3.cam.persp; if (!GL3.cam.persp) GL3.cam.pitch = Math.max(.2, GL3.cam.pitch); toast(GL3.cam.persp ? 'Perspective view' : 'Isometric view'); }
    else if (k === 't') { GL3.town++; GL3.follow = null; GL3.goto = null; glFocusTown(); }
  });
  const hint = document.createElement('div'); hint.id = 'glHint';
  hint.style.cssText = 'position:fixed;right:16px;top:14px;max-width:430px;line-height:1.45;z-index:5;padding:8px 12px;border-radius:12px;background:rgba(255,251,245,.82);box-shadow:0 4px 18px rgba(60,40,60,.15);font:12.5px "Segoe UI",system-ui,sans-serif;color:#2b2833';
  hint.innerHTML = (matchMedia('(pointer: coarse)').matches ? '<b>3D preview</b> · drag to turn · pinch to zoom · two fingers to move · tap anything to see what it is' : '<b>3D preview</b> (proof of concept) · drag to turn · wheel to zoom · <b>R</b> auto-rotate · <b>N</b> time of day · <b>T</b> next town · <b>P</b> perspective or isometric · point at anything to see what it is, click a person to follow them') + ' <span id="glHideHint" style="cursor:pointer;opacity:.6">✕</span>';
  hint.querySelector('#glHideHint').onclick = () => hint.remove();
  if (innerWidth < 700) { hint.style.cssText += ';top:auto;right:12px;left:12px;bottom:150px;max-width:none;font-size:12px'; setTimeout(() => hint.remove(), 15000); } // phones: above the tool bar, and not for long
  document.body.appendChild(hint);
  glFocusTown();
  return true;
}
function glFocusTown() { const ts = towns().sort((a, b) => b.pop - a.pop); if (!ts.length) return; const T = ts[GL3.town % ts.length]; GL3.cam.tx = T.x; GL3.cam.tz = T.y; GL3.cam.ty = surfZ(idx(T.x, T.y)) * ZS; GL3.cam.zoom = clamp(townRadius(T) * .75 + 2.5, 5, 14); }
function glFrame(dt) {
  const gl = GL3.gl, c = GL3.c, cam = GL3.cam; GL3.t += dt;
  LIGHT.sun = sunNow(); if (!LIGHT.season || (LIGHT.seasonT -= dt) <= 0) { LIGHT.season = LIGHT.forceSeason || seasonNow(); LIGHT.seasonT = 300; }
  stepWeather(dt); DIRTY.length = 0;
  const dpr = Math.min(2, devicePixelRatio || 1), w = Math.round(innerWidth * dpr), h = Math.round(innerHeight * dpr);
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
  // rebuild what changed, a few chunks a frame
  let n = 0; for (const k of GL3.dirty) { if (n++ >= (GL3.first ? 3 : 64)) break; GL3.dirty.delete(k); const r = glBuildChunk(k), ch = GL3.chunks[k]; gl.bindBuffer(gl.ARRAY_BUFFER, ch.buf); gl.bufferData(gl.ARRAY_BUFFER, r.v, gl.STATIC_DRAW); ch.n = r.v.length / 11; ch.lamps = r.lamps; }
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
  const aspect = w / h, zz = cam.zoom; let dir = [Math.cos(cam.pitch) * Math.sin(cam.yaw), Math.sin(cam.pitch), Math.cos(cam.pitch) * Math.cos(cam.yaw)];
  // perspective: a 38° lens backed off so the zoom still means "how much ground fits"; isometric: the flat lens of the 2D view
  if (cam.persp) { const d0 = zz / Math.tan(19 * DEG); cam.pitch = Math.max(cam.pitch, Math.asin(Math.min(.95, 2.2 / d0))); dir[0] = Math.cos(cam.pitch) * Math.sin(cam.yaw); dir[1] = Math.sin(cam.pitch); dir[2] = Math.cos(cam.pitch) * Math.cos(cam.yaw); } // stay above the rooftops
  const fov = 38 * DEG, dist = cam.persp ? zz / Math.tan(fov / 2) : 90, tgt = [cam.tx, cam.ty, cam.tz], eye = [tgt[0] + dir[0] * dist, tgt[1] + dir[1] * dist, tgt[2] + dir[2] * dist];
  const VP = m4mul(cam.persp ? m4persp(fov, aspect, Math.max(.2, dist * .02), dist + 140) : m4ortho(-zz * aspect, zz * aspect, -zz, zz, 1, 220), m4look(eye, tgt, [0, 1, 0]));
  const sc = [32, 2, 32], se = [sc[0] + sd[0] * 80, sc[1] + sd[1] * 80, sc[2] + sd[2] * 80];
  const SVP = m4mul(m4ortho(-50, 50, -50, 50, 1, 180), m4look(se, sc, [0, 1, 0]));
  // lamps near the middle of the view light the streets
  const lamps = []; if (lit > 0) { for (const ch of GL3.chunks) for (const L of ch.lamps) lamps.push(L); lamps.sort((a, b) => Math.hypot(a[0] - tgt[0], a[2] - tgt[2]) - Math.hypot(b[0] - tgt[0], b[2] - tgt[2])); lamps.length = Math.min(64, lamps.length); }
  const dyn = glPeople();
  const attrs = full => { // full: everything the lit view needs; 1: position and id (picking); 0: position only (shadows)
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 44, 0);
    if (full === true) { for (const a of [1, 2, 3]) gl.enableVertexAttribArray(a); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 44, 12); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 44, 24); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 44, 36); }
    if (full) { gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 1, gl.FLOAT, false, 44, 40); } else gl.disableVertexAttribArray(4);
  };
  gl.bindBuffer(gl.ARRAY_BUFFER, GL3.dyn); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.STREAM_DRAW);
  const drawAll = full => { for (const ch of GL3.chunks) if (ch.n) { gl.bindBuffer(gl.ARRAY_BUFFER, ch.buf); attrs(full); gl.drawArrays(gl.TRIANGLES, 0, ch.n); } if (dyn.length) { gl.bindBuffer(gl.ARRAY_BUFFER, GL3.dyn); attrs(full); gl.drawArrays(gl.TRIANGLES, 0, dyn.length / 11); } };
  gl.enable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
  // shadow pass
  gl.bindFramebuffer(gl.FRAMEBUFFER, GL3.shF); gl.viewport(0, 0, 2048, 2048); gl.clear(gl.DEPTH_BUFFER_BIT);
  gl.useProgram(GL3.sh.p); gl.uniformMatrix4fv(GL3.sh.u.uSVP, false, SVP); for (const a of [1, 2, 3]) gl.disableVertexAttribArray(a); drawAll(false);
  // the view
  gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, w, h);
  const bg = [lerp(.1, .81, day) * (1 - .1 * cover), lerp(.12, .89, day), lerp(.22, .9, day)];
  gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const P = GL3.main, U = P.u; gl.useProgram(P.p);
  gl.uniformMatrix4fv(U.uVP, false, VP); gl.uniformMatrix4fv(U.uSVP, false, SVP);
  gl.uniform3fv(U.uSun, sd); gl.uniform3fv(U.uSunC, sunC); gl.uniform3fv(U.uSky, sky); gl.uniform3fv(U.uGnd, gnd); gl.uniform3fv(U.uEye, eye);
  gl.uniform3fv(U.uWin, gcol((LIGHT.cur && LIGHT.cur.winC || ['#ffd07a'])[0])); gl.uniform3fv(U.uLamp, [1.25, .86, .5]);
  gl.uniform1f(U.uLit, lit); gl.uniform1f(U.uShK, shK); gl.uniform1f(U.uT, GL3.t);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GL3.shT); gl.uniform1i(U.uSh, 0);
  gl.uniform1i(U.uNL, lamps.length); if (lamps.length) gl.uniform3fv(U.uLP, new Float32Array(lamps.flat()));
  gl.uniform1f(U.uHi, GL3.hover || 0);
  gl.uniform1f(U.uFog0, dist + zz * 1.2); gl.uniform1f(U.uFogL, cam.persp ? 60 : 0); gl.uniform3fv(U.uFogC, bg.map(v => -Math.log(1 - Math.min(.97, v)) / 1.45)); // (the haze colour, undone through the tone curve so it lands on the sky)
  drawAll(true);
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
// people and carts, as little figures, rebuilt every frame
function glPeople() {
  const v = []; GLB = { v, x: 0, y: 0, base: 0, tops: [], id: 0 };
  try {
    for (let k = 0; k < DYN.walkers.length; k++) {
      const w = DYN.walkers[k], p = walkerPos(w); if (!p || p[3] < .3) continue; GLB.id = w.pid ? GPID + k : 0; // a person you can point at
      const X = p[0], Z = p[1], y0 = p[2] * ZS, s = w.kid ? .7 : 1;
      glBoxW(X, Z, .035 * s, y0, 3.2 * s * ZS, w.pants || '#555'); glBoxW(X, Z, .045 * s, y0 + 3.2 * s * ZS, 3 * s * ZS, w.col || '#e5874f'); glBoxW(X, Z, .035 * s, y0 + 6.2 * s * ZS, 1.8 * s * ZS, w.skin || '#e0b090');
    }
    GLB.id = 0; for (const c of DYN.vehicles) { const p = vehiclePos(c); if (!p) continue; glBoxW(p[0], p[1], .09, p[2] * ZS, 4 * ZS, c.col || '#c0392b'); glBoxW(p[0], p[1], .06, p[2] * ZS + 4 * ZS, 2.2 * ZS, '#dfe7ef'); }
  } catch (e) { } finally { GLB = null; }
  return new Float32Array(v);
}

/* ---------- switching between the 2D and 3D views (the preview build starts in 3D) ---------- */
const GL_DEFAULT = true; // proof-of-concept preview only: a merged build would start in 2D
function glWanted() { if (QS.has('2d')) return false; if (QS.has('gl')) return true; try { const v = localStorage.getItem('sf3d'); if (v) return v === '1'; } catch (e) { } return GL_DEFAULT; }
function glToggle() {
  const want = !GL3.on; try { localStorage.setItem('sf3d', want ? '1' : '0'); } catch (e) { }
  if (want) { if (!GL3.gl) glInit(); else { GL3.on = true; GL3.c.style.display = 'block'; $('view').style.display = 'none'; for (let k = 0; k < GNC * GNC; k++) GL3.dirty.add(k); } }
  else { GL3.on = false; GL3.c.style.display = 'none'; $('view').style.display = 'block'; const h = $('glHint'); if (h) h.remove(); $('tip').style.opacity = 0; renderAll(); relightNow(); }
  glBtn();
}
function glBtn() {
  let b = $('glBtn');
  if (!b) { b = document.createElement('button'); b.id = 'glBtn'; b.onclick = glToggle; b.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:6;padding:8px 14px;border:0;border-radius:12px;background:rgba(255,251,245,.9);box-shadow:0 4px 18px rgba(60,40,60,.18);font:600 13px "Segoe UI",system-ui,sans-serif;color:#2b2833;cursor:pointer'; document.body.appendChild(b); }
  if (innerWidth < 700) b.style.bottom = '104px'; // clear of the tool bar on a phone
  b.textContent = GL3.on ? 'Switch to 2D' : 'Try it in 3D';
}
