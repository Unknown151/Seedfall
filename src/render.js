/* ============================== the art of the valley: building primitives, and what stands on each tile ============================== */
// The 3D view builds its chunks by running this art with GLB set: the primitives below emit triangles (gl.js).
// (The art still speaks in its old tile-local pixel terms: pt, cx/cy, a canvas argument it no longer uses. Each building
// type moves to a native model in gl.js / GL_MODEL in turn, and these go with the last of them.)

function objH(i) {
  const b = M.bld[i];
  if (b) {
    const B = S.B[b]; if (!B) return 40;
    if (B.type === 'house') { const st = S.styles[B.style], t = Math.max(B.tier, B.up || 0); return st && (st.shape || st.roofK) ? HOUSE_H[t] * (SHAPE_HM[st.shape] || 1) + 12 : HOUSE_H[t]; }
    return B.type === 'monument' ? 96 : BT[B.type] ? BT[B.type].h : 40;
  }
  if (M.tree[i]) return 34;
  if (M.ruin[i]) return 28;
  if (M.road[i] && M.water[i]) return 12 + bridgeZ(i) - surfZ(i);
  if (M.road[i]) return 16; // lamps, street trees, bus shelters
  return 6;
}
const HOUSE_H = [14, 20, 22, 28, 34, 64, 128, 185];


function markDirty(i) { if (GL3.on) glDirty(i); } // (the 3D chunk round this tile is rebuilt)
function markDirtyXY(x, y) { if (inb(x, y)) markDirty(idx(x, y)); }

// the 2D canvases (the whole valley at 2×, twice over, plus the glow layers: ~100 MB) only exist once the 2D view is shown
function renderAll() { // a new or loaded world: the light from scratch, every chunk rebuilt
  LIGHT.sun = sunNow(); LIGHT.season = LIGHT.forceSeason || seasonNow(); LIGHT.seasonT = 300;
  LIGHT.cur = LT = mkLight(envNow()); LIGHT.artKey = null; LIGHT.chk = 0;
  if (GL3.on) for (let k = 0; k < GNC * GNC; k++) GL3.dirty.add(k);
}

/* ---------- primitives ---------- */
function pt(cx, cy, u, v, z) { return [cx + (u - v) * 16, cy + (u + v) * 8 - z]; }
function poly() { } // (flat shapes and strokes in the old art: nothing in 3D)
// DS: the shape/roof of the building style being drawn (set by drawBuilding). Round styles turn boxes into cylinders.
let DS = null, DM = null; // DM: the material of the building being drawn (timber, stone, brick, adobe)
function dsRound() { return DS && (DS.shape === 'round' || DS.shape === 'organic'); }
function box(c, cx, cy, u0, v0, hw, hd, z0, h, col, top) {
  if (GLB) return glBox(cx, cy, u0, v0, hw, hd, z0, h, col, top);
}
function flat(c, cx, cy, u0, v0, hw, hd, z, col) {
  if (GLB) return glFlat(cx, cy, u0, v0, hw, hd, z, col);
}
function cylWindows(c, cx, cy, u0, v0, r, z0, h, floors, n, col, onlyLit) {
  if (GLB) return glCylWindows(cx, cy, u0, v0, r, z0, h, floors, n, col);
}
function windows(c, cx, cy, u0, v0, hw, hd, z0, h, floors, cols, col, colR, onlyLit) {
  if (GLB) glWindows(cx, cy, u0, v0, hw, hd, z0, h, floors, cols, col);
}
function door(c, cx, cy, u0, v0, hd, w, h, col) {
  if (GLB) return glDoor(cx, cy, u0, v0, hd, w, h, col);
}
function dsRoof(c, cx, cy, u0, v0, hw, hd, z, rh, col) {
  const round = dsRound(), k = DS.roofK || (DS.shape === 'round' ? 'cone' : DS.shape === 'organic' ? 'dome' : DS.shape === 'square' ? 'flat' : null);
  if (!k) return false;
  const [X, Y] = pt(cx, cy, u0, v0, 0), r = Math.max(hw, hd) * (round ? 1.08 : 1);
  if (round && (k === 'cone' || k === 'pyramid' || k === 'gable')) { cone(c, X, Y - z, r * 1.12, rh * 1.2 + 2, col); return true; }
  if (z < 3 || rh > 12) return false; // spires, huts and glass pyramids keep their form
  if (k === 'dome') { dome(c, X, Y, r * (round ? 1 : 1.12), z, rh + r * 7, col); return true; }
  if (k === 'flat' || k === 'garden') {
    box(c, cx, cy, u0, v0, hw + .02, hd + .02, z, 1.3, shade(col, 1.04));
    if (k === 'garden') { flat(c, cx, cy, u0, v0, hw - .02, hd - .02, z + 1.35, '#7cc47f'); parkTree(c, cx, cy - z - 1.3, u0 + hw * .25, v0 - hd * .2, (X * .37) % 1); }
    return true;
  }
  const sv = DS; DS = null;
  if (k === 'gable') roofGable(c, cx, cy, u0, v0, hw, hd, z, rh, col, col, hw >= hd); else if (k === 'pyramid') roofPyr(c, cx, cy, u0, v0, hw, hd, z, rh, col); else if (k === 'cone') { DS = sv; cone(c, X, Y - z, Math.max(hw, hd) * 1.25, rh * 1.3 + 2, col); }
  DS = sv; return true;
}
function roofGable(c, cx, cy, u0, v0, hw, hd, z, rh, col, wall, alongU) {
  if (DS && dsRoof(c, cx, cy, u0, v0, hw, hd, z, rh, col)) return;
  if (GLB) return glGable(cx, cy, u0, v0, hw, hd, z, rh, col, wall, alongU);
}
function roofMansard(c, cx, cy, u0, v0, hw, hd, z, rh, col) { if (GLB) return glMansard(cx, cy, u0, v0, hw, hd, z, rh, col); }
function roofPyr(c, cx, cy, u0, v0, hw, hd, z, rh, col) {
  if (DS && dsRoof(c, cx, cy, u0, v0, hw, hd, z, rh, col)) return;
  if (GLB) return glPyr(cx, cy, u0, v0, hw, hd, z, rh, col);
}
function cone(c, x, y, r, h, col) {
  if (GLB) return glCone(x, y, r, h, col);
}
function cyl(c, x, y, r, z0, h, col, top) {
  if (GLB) return glCyl(x, y, r, z0, h, col, top);
}
function dome(c, x, y, r, z0, h, col, alpha = 1) {
  if (GLB) return glDome(x, y, r, z0, h, col);
}
function line() { } function circ() { } function ell() { } function emit() { } // (strokes, dots and painted glows in the old art: nothing in 3D)

/* ---------- terrain ---------- */
const STRATA = ['#a77a60', '#bb8f70', '#94705f', '#ad8671', '#86665b', '#9a7666'];
function topColor(i) {
  const x = i % W, y = (i / W) | 0, w = M.water[i], b = M.bio[i], g = LT.fG;
  if (w === 1) {
    const f = q2((0.98 + hash2(x, y, 3) * 0.04) * g);
    if (b === BIO.FRESH) return shade('#58b3cf', f);
    return M.elev[i] === 0 ? shade('#3a8cb6', f) : shade('#4ea7c8', f);
  }
  if (w === 2) return shade('#63bdd7', q2((0.98 + hash2(x, y, 3) * 0.04) * g));
  let col = BIO_COL[b];
  if ((b === BIO.MEADOW || b === BIO.LUSH) && LT.grass[1]) col = mix(col, LT.grass[0], LT.grass[1]);
  const v = q2((0.965 + hash2(x, y, 5) * 0.06 + M.elev[i] * 0.006) * g);
  col = shade(col, v);
  if (SOOT[i] > .02) col = mix(col, '#6f6a66', q2(Math.min(.4, SOOT[i] * .5))); // soot from the works
  if (LT.snow && b !== BIO.SAND) col = mix(col, SNOWC, q2(LT.snow * (b === BIO.SNOW ? 0 : .85)));
  return col;
}
function sideCol(i) {
  const b = M.bio[i];
  if (M.water[i]) return '#5fb4d2';
  if (b === BIO.SAND) return '#d8b28c';
  if (b === BIO.ROCK || b === BIO.SNOW) return '#9a93ab';
  if (b === BIO.BARREN) return '#c98f72';
  return '#b3876a';
}

// everything that stands on a tile: built into its 3D chunk (gl.js glBuildRows)
function drawTileObjects(i, x, y) {
  const w = M.water[i], bid = M.bld[i];
  let B = bid ? S.B[bid] : null;
  if (B && B.hid) B = null;
  if (M.ruin[i]) tileRuin(i, x, y);
  if (!B && !bid && springAt(i)) glSpring(i);
  if (!w && S.ferries && S.ferries.length) { const fl = ferryLandings().get(i); if (fl) tileLanding(fl); }
  if (M.road[i] && !w && !bid) tileVerge(i, x, y);
  if (B && fpBig(B)) { if (i === fpFront(B) && !FLAT_TYPES[B.type]) { const [ox, oy] = fpOff(B); drawBuilding(GSTUB, B, ox, oy, i); } } // a big lot is built once, from its front tile
  else if (B && !FLAT_TYPES[B.type]) { drawBuilding(GSTUB, B, 0, 0, i); if (B.type === 'house' && B.prog >= 1) glYard(B, x, y); }
  else if (!B && !w && !M.tree[i] && (M.bio[i] === BIO.ROCK || M.bio[i] === BIO.HIGH) && hash2(x, y, 11) < 0.3 && !M.road[i]) tileRocks(x, y);
  else if (!B && !bid && !w && !M.tree[i] && !M.road[i] && !M.rail[i] && !M.ruin[i]) tileGround(i, x, y);
}
const gp = (u, v, z = 0) => [GLB.x + u, GLB.base + z * ZS, GLB.y + v]; // a spot on this tile (u, v from its middle, z in pixels) in the world
const post = (u, v, h, w, col, z0 = 0) => gBeam(gp(u, v, z0), gp(u, v, z0 + h), w, col); // an upright: a post, a pole, a stem
function tileRocks(x, y) { // grey stones on the high and rocky ground
  const n = 1 + (hash2(x, y, 12) * 2 | 0);
  for (let k = 0; k < n; k++) { const u = (hash2(x, y, 13 + k) - .5) * .6, v = (hash2(x, y, 15 + k) - .5) * .6, s = .7 + hash2(x, y, 17 + k) * .8;
    glBlob(u, v, .08 * s, 0, .75 * s, '#9d97ad', M_STONE); glBlob(u - .04 * s, v + .03 * s, .045 * s, 1.2 * s, .6, '#b9b3c8', M_STONE); }
}
function tileRuin(i, x, y) { // three broken Maker pillars, a lintel, and the glyph that still glows
  const stone = '#e4dccb', hs = [9 + hash2(x, y, 1) * 6, 5 + hash2(x, y, 2) * 8, 11 + hash2(x, y, 3) * 5], us = [[-.22, -.18], [.2, -.2], [-.2, .2]];
  glFlat(0, 0, 0, 0, .38, .38, .2, '#d2c8b4');
  for (let k = 0; k < 3; k++) glBox(0, 0, us[k][0], us[k][1], .06, .06, 0, hs[k], stone);
  glBox(0, 0, -.01, -.19, .3, .06, hs[0] - 1, 2.2, shade(stone, .95)); glBox(0, 0, .18, .18, .1, .08, 0, 2, shade(stone, .9));
  GLB.mat = 0; glOBox(gp(.18, .18, 2.6), [.022, 0, 0], [0, 0, .022], [0, .022, 0], '#5fd0c9', 2);
  if (M.ruin[i] === 2) { post(.3, -.32, 12, .006, '#6b5a4c'); GLB.ctr = gp(.3, -.32, 0); gtri(gp(.3, -.32, 12), gp(.3 + .16, -.32, 10.5), gp(.3, -.32, 9), gcol('#d9774b')); } // someone's flag on it
}
function tileLanding(d) { // a ferry landing: a timber stage and its lantern
  const [dx, dy] = d; glBox(0, 0, dx * .38, dy * .38, dx ? .12 : .16, dy ? .12 : .16, -1.5, 2, '#9b7657');
  const u = dx * .3 + dy * .14, v = dy * .3 + dx * .14; post(u, v, 6, .006, '#6b5040'); GLB.mat = 0; glOBox(gp(u, v, 6.4), [.014, 0, 0], [0, 0, .014], [0, .016, 0], '#ffd27a', 2);
}
function tuftAt(u, v, col) { glTuftUV(u, v, 0, col); }
function flowersAt(u, v, h, z = 0) { glFlowersUV(u, v, z, h); }
function benchAt(u, v, col) { glBox(0, 0, u, v, .07, .03, 1, .5, col); glBox(0, 0, u, v - .03, .07, .008, 1.5, 1.2, col); for (const o of [-.055, .055]) glBox(0, 0, u + o, v, .008, .025, 0, 1, shade(col, .8)); }
const treeAt = (u, v, h) => glSmallTree(u, v, 0, h, .8 + h * .3, ['#5f9a4d', '#6aa556', '#7fae5e', '#ee9fbe'][(h * 4) | 0]);
const planter = (u, v, h, col, z = 1.6) => { glBox(0, 0, u, v, .06, .06, 0, z, col); flowersAt(u, v, h, z); };
// the streetscape: what stands in a road tile's free corners, by the surface (so the era), whether it's in town and the quarter
// (all chosen from hashes of the tile: the same on every rebuild, nothing stored)
function tileVerge(i, x, y) {
  refreshOwn();
  const sf = M.road[i], T = OWN[i] ? S.T[OWN[i]] : null, inT = T && dist(x, y, T.x, T.y) <= townRadius(T) + 1, z = zoneAt(i), grass = leafC(shade(BIO_COL[M.bio[i]] || '#94d4a6', .72));
  const nb = roadNeighbors(M.road, x, y), wood = '#8a6d57';
  for (const [u, v, k] of [[-.37, -.37, 0], [-.38, .37, 1], [.37, .38, 2]]) {
    const h = hash2(x, y, 300 + k);
    if (!inT) { // country roads: tufts, flowers, a bit of fence, a milestone, a road sign
      if (sf <= R_GRAVEL) { if (h < .45) tuftAt(u, v, grass); else if (h < .6) flowersAt(u, v, h); else if (h < .7) { post(u, v, 3, .007, wood); post(u + .1, v - .06, 3, .007, wood); GLB.mat = M_PLANK; gBeam(gp(u, v, 2.2), gp(u + .1, v - .06, 2.2), .005, wood, M_PLANK); } else if (k === 0 && h > .94) glBox(0, 0, u, v, .04, .03, 0, 2.6, '#b9b3aa'); }
      else if (h < .4) tuftAt(u, v, grass); else if (h > .93 && sf < R_GLOW) { post(u, v, 5, .005, '#8c9199'); GLB.mat = 0; glOBox(gp(u, v, 5.6), [.04, 0, 0], [0, 0, .004], [0, .025, 0], h > .965 ? '#3f8f5f' : '#e8e2cf'); }
      continue;
    }
    if (sf <= R_GRAVEL) { // a village lane: a water barrel, a crate, a bench
      if (h < .35) tuftAt(u, v, grass); else if (h < .55) flowersAt(u, v, h);
      else if (h < .62) glCylAt(u, v, .045, 0, 2.2, '#9a7456', '#7a5a44', 8); else if (h < .68) glBox(0, 0, u, v, .05, .05, 0, 1.6, '#a88462'); else if (h < .73) benchAt(u, v, wood);
      continue;
    }
    if (sf <= R_BRICK) { // cobbled and brick streets: street trees, planters, benches, bollards, the old pump
      if (z === Z_HOME && h < .28 || z === Z_GREEN && h < .6) treeAt(u, v, h);
      else if (h < .42) planter(u, v, h, '#a88f78'); else if (h < .52) benchAt(u, v, '#6b5040');
      else if (h < .6) for (const o of [-.05, .05]) post(u + o, v - o, 2, .012, '#4c4f58');
      else if (z === Z_CORE && h > .95 && k === 1) { glCylAt(u, v, .04, 0, 3.4, '#5b6770', '#5b6770', 8); GLB.mat = 0; gBeam(gp(u, v, 3), gp(u + .07, v, 2.2), .008, '#5b6770'); }
      else if (h < .72) tuftAt(u, v, grass);
      continue;
    }
    if (sf <= R_CONCRETE) { // modern streets: trees, a bus shelter, a post box, a hydrant, bins, benches, a phone box, traffic lights
      if ((z === Z_HOME || z === Z_GREEN) && h < .34) treeAt(u, v, h);
      else if (k === 2 && nb.length >= 2 && h > .9) { glBox(0, 0, u - .02, v - .02, .1, .05, 0, .6, '#8c9199'); glBox(0, 0, u - .02, v - .07, .1, .004, .6, 5, '#bfe3f0'); glBox(0, 0, u - .02, v - .03, .12, .07, 5.6, .6, '#5b6770'); }
      else if (h < .4) glCylAt(u, v, .03, 0, 3, '#c0392b', '#a83226', 8);
      else if (h < .45) { glCylAt(u, v, .022, 0, 1.6, '#e0b030', '#e0b030', 8); glBlob(u, v, .022, 1.7, .8, '#e0b030', 0); }
      else if (h < .5) glCylAt(u, v, .03, 0, 2, '#4f5a4f', '#3a423a', 8); else if (h < .56) benchAt(u, v, '#5b6770');
      else if (h < .59 && hasTech('radio') && !hasTech('net')) { glBox(0, 0, u, v, .035, .035, 0, 6.5, '#c0392b'); glBox(0, 0, u, v + .036, .025, .002, 1, 4.5, '#bcd3e0'); }
      else if (h < .66) planter(u, v, h, '#9aa0a6');
      else if (h < .7 && z === Z_CORE) { post(u, v, 6, .006, '#5b6770'); GLB.mat = 0; glOBox(gp(u, v, 7.2), [.014, 0, 0], [0, 0, .014], [0, .03, 0], '#2a2c30'); const lc = ['#e05b52', '#e0b030', '#4fa06a'][(h * 30 | 0) % 3], q = [8.3, 7.2, 6.1][(h * 30 | 0) % 3]; glOBox(gp(u, v + .015, q), [.009, 0, 0], [0, 0, .002], [0, .009, 0], lc, 2); }
      continue;
    }
    if (h < .4) treeAt(u, v, h); // glowlanes: gardens all the way, holo posts, white benches
    else if (h < .55) planter(u, v, h, '#e8eef5', 1.2);
    else if (h < .62) { post(u, v, 7, .006, '#dfe7ef'); GLB.mat = 0; glOBox(gp(u, v, 7.5), [.016, 0, 0], [0, 0, .016], [0, .016, 0], '#8fe3ec', 2); }
    else if (h < .7) benchAt(u, v, '#cfd8e0');
  }
}
// open grass: tufts, clover and wildflowers, thicker on lush ground
function tileGround(i, x, y) {
  const b = M.bio[i]; if (b !== BIO.MEADOW && b !== BIO.LUSH && b !== BIO.HIGH && b !== BIO.BARREN) return;
  const g = leafC(shade(BIO_COL[b], b === BIO.HIGH || b === BIO.BARREN ? .8 : .74)), n = b === BIO.LUSH ? 8 : b === BIO.MEADOW ? 6 : 2;
  for (let k = 0; k < n; k++) {
    const h = hash2(x, y, 400 + k); if (h < .3) continue;
    const u = (hash2(x, y, 410 + k) - .5) * .8, v = (hash2(x, y, 420 + k) - .5) * .8;
    if (h > .9 && b !== BIO.HIGH && b !== BIO.BARREN) flowersAt(u, v, h); else if (h > .82 && b === BIO.LUSH) glBlob(u, v, .09, .8, 1.6, leafC('#5f9a52')); else tuftAt(u, v, g);
  }
}
const FLOWERS = ['#ffffff', '#ffd66b', '#ff9fc4', '#b9a2ff', '#ffb38a'];


/* ---------- roads & rails ---------- */
const PAVE_COL = [null, null, null, '#d3cabd', '#d1c2b2', '#c9c7c2', '#dedcd6', '#f2f6fa'];
const ROAD_COL = [null, '#d9c19a', '#cbbfa8', '#b3aba2', '#b97a62', '#6f7075', '#cfcdc6', '#e8eef5']; // by surface (see streets.js)
function roadNeighbors(arr, x, y) {
  const r = [];
  for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) { const j = idx(nx, ny); if (arr[j] || (arr === M.road && M.bld[j] && isRoadAnchor(j))) r.push([dx, dy]); } }
  return r;
}
function isRoadAnchor(j) { const B = S.B[M.bld[j]]; return B && (B.type === 'plaza' || B.type === 'pod' || B.type === 'station'); }
// a bridge deck sits level with the banks it joins
function bridgeZ(i) {
  let z = landZ(i) + 2;
  if (M.water[i] === 2) { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (!M.water[j] && M.road[j]) z = Math.max(z, surfZ(j) + 1); } }
  return z;
}

// the 3D garden: each free corner of the plot gets a bush, a flower bed, a tree or a clump of grass, and some plots a hedge
function glYard(B, x, y) {
  const row = houseJoin(B), big = B.tier > 3;
  if (!row && B.tier >= 1 && B.tier <= 3 && B.prog >= 1) glYardBits(B, x, y);
  for (const [u, v, k] of [[-.42, -.42, 0], [-.42, .42, 1], [.42, .42, 2], [.42, -.42, 3]]) {
    const h = hash2(x, y, 510 + k), X = pt(0, 0, u, v, 0);
    if (row && h < .7) continue; // terraces keep to window boxes and the odd pot
    if (h < .3) { glBlob(u, v, .075, 1, 1.7, leafC(h < .15 ? '#5a9a4e' : '#4f8a45')); glBlob(u + .05, v - .04, .05, .8, 1.2, leafC('#6aa556')); }
    else if (h < .5) { glFlowers(...pt(0, 0, u, v - .05, 0), h); glFlowers(...pt(0, 0, u - .05, v + .03, 0), h + .3); }
    else if (h < .58 && !big) glTreeAt(0, 0, u, v, h, .7 + h * .4, ['#5f9a4d', '#6aa556', '#7fae5e', '#ee9fbe'][((h * 40) | 0) % 4]);
    else if (h < .8) glTuft(X[0], X[1], '#6aa556');
  }
  const hh = hash2(x, y, 500); if (!row && hh > .3 && hh < .6) { const sw = GLB.wall; GLB.wall = M_LEAF; glBox(0, 0, .45, 0, .03, .32, 0, 2.2, leafC('#4f8a45')); GLB.wall = sw; } // a clipped hedge
}

function lampC(x, y) { return LT.lampCs ? LT.lampCs[(hash2(x | 0, y | 0, 17) * LT.lampCs.length) | 0] : LT.lampC; }
