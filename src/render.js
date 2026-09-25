/* ============================== render: static layer ============================== */
let SC = null, SX = null;           // static canvas + ctx (world units * RS)
const BB = { x0: new Float32Array(W * H), y0: new Float32Array(W * H), x1: new Float32Array(W * H), y1: new Float32Array(W * H) };
let DIRTY = [];

function initStatic() {
  SC = document.createElement('canvas');
  SC.width = STATIC_W * RS; SC.height = STATIC_H * RS;
  SX = SC.getContext('2d');
  SX.setTransform(RS, 0, 0, RS, 0, 0);
  SX.lineJoin = 'round'; SX.lineCap = 'round';
}

function tileTop(i) { const x = i % W, y = (i / W) | 0; return [(x - y) * TW2 + OX, (x + y) * TH2 + OY - surfZ(i)]; }
function tileCenterW(x, y) { const i = idx(x, y); return [(x - y) * TW2 + OX, (x + y) * TH2 + OY + 8 - (M.water[i] ? landZ(i) : surfZ(i))]; }
function gridToWorld(fx, fy, z) { return [(fx - fy) * TW2 + OX, (fx + fy) * TH2 + OY + 8 - z]; }

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
  return 6;
}
const HOUSE_H = [14, 20, 22, 28, 34, 64, 128, 185];

function computeBB(i) {
  const x = i % W, y = (i / W) | 0, z = surfZ(i);
  const X = (x - y) * TW2 + OX, Y = (x + y) * TH2 + OY - z;
  let bot = Y + 17;
  if (x === W - 1 || y === H - 1) bot = (x + y) * TH2 + OY + 16 + SLAB + 40;
  else { const zl = surfZ(i + W), zr = surfZ(i + 1); bot = Y + 17 + Math.max(0, z - Math.min(zl, zr)); }
  BB.x0[i] = X - 19; BB.x1[i] = X + 19; BB.y0[i] = Y - objH(i) - 6; BB.y1[i] = bot + 1;
  computeCaster(i);
}

function markDirty(i) {
  const a0 = BB.x0[i], b0 = BB.y0[i], a1 = BB.x1[i], b1 = BB.y1[i];
  const h0 = CH[i];
  computeBB(i); TV[i]++;
  const r = [Math.min(a0, BB.x0[i]), Math.min(b0, BB.y0[i]), Math.max(a1, BB.x1[i]), Math.max(b1, BB.y1[i])];
  if (h0 || CH[i]) { // the shadow this tile casts lands on its neighbours
    const x = i % W, y = (i / W) | 0;
    for (const L of [LIGHT.cur, LIGHT.next]) if (L && L.shA > 0) {
      for (let t = 1; t <= 5; t++) {
        const xx = Math.round(x + L.shdx * t), yy = Math.round(y + L.shdy * t); if (!inb(xx, yy)) break;
        const j = idx(xx, yy);
        r[0] = Math.min(r[0], BB.x0[j] - 12); r[1] = Math.min(r[1], BB.y0[j]); r[2] = Math.max(r[2], BB.x1[j] + 12); r[3] = Math.max(r[3], BB.y1[j]);
      }
    }
  }
  DIRTY.push(r);
}
function markDirtyXY(x, y) { if (inb(x, y)) markDirty(idx(x, y)); }

function mergeRects(rs) {
  let changed = true;
  while (changed && rs.length > 1) {
    changed = false;
    outer: for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) {
      const A = rs[a], B = rs[b];
      if (A[0] <= B[2] + 8 && B[0] <= A[2] + 8 && A[1] <= B[3] + 8 && B[1] <= A[3] + 8) {
        rs[a] = [Math.min(A[0], B[0]), Math.min(A[1], B[1]), Math.max(A[2], B[2]), Math.max(A[3], B[3])];
        rs.splice(b, 1); changed = true; break outer;
      }
    }
  }
  return rs;
}

function flushDirty() {
  if (!DIRTY.length) return 0;
  let rs = DIRTY; DIRTY = [];
  if (rs.length > 40) { // collapse into one big rect
    let r = [1e9, 1e9, -1e9, -1e9]; for (const q of rs) { r[0] = Math.min(r[0], q[0]); r[1] = Math.min(r[1], q[1]); r[2] = Math.max(r[2], q[2]); r[3] = Math.max(r[3], q[3]); }
    rs = [r];
  } else rs = mergeRects(rs);
  for (const r of rs) {
    if (LIGHT.job) { paintRect(SX, LIGHT.cur, EMX, r); LIGHT.q.push(r); }
    else if (LIGHT.fade >= 0) { paintRect(SX, LIGHT.cur, null, r); paintRect(SX2, LIGHT.next, EMX, r); }
    else paintRect(SX, LIGHT.cur, EMX, r);
  }
  return rs.length;
}

function renderAll() {
  LIGHT.job = null; LIGHT.fade = -1; LIGHT.next = null; LIGHT.q = [];
  LIGHT.sun = sunNow(); LIGHT.season = LIGHT.forceSeason || seasonNow(); LIGHT.seasonT = 300;
  LIGHT.cur = LT = mkLight(envNow());
  clearCanvas(SX, SC, RS); clearCanvas(EMX, EMC, RSE); SPR.clear();
  for (let i = 0; i < W * H; i++) computeBB(i);
  for (let s = 0; s <= W + H - 2; s++) {
    const xa = Math.max(0, s - H + 1), xb = Math.min(W - 1, s);
    for (let x = xa; x <= xb; x++) paintTile(SX, LIGHT.cur, EMX, x, s - x);
  }
  LT = LIGHT.cur;
  DIRTY = [];
}

/* ---------- primitives ---------- */
function pt(cx, cy, u, v, z) { return [cx + (u - v) * 16, cy + (u + v) * 8 - z]; }
function poly(c, p, col) {
  c.fillStyle = col; c.beginPath(); c.moveTo(p[0][0], p[0][1]);
  for (let k = 1; k < p.length; k++) c.lineTo(p[k][0], p[k][1]);
  c.closePath(); c.fill();
}
// DS: the shape/roof of the building style being drawn (set by drawBuilding). Round styles turn boxes into cylinders.
let DS = null, DM = null; // DM: the material of the building being drawn (timber, stone, brick, adobe)
function dsRound() { return DS && (DS.shape === 'round' || DS.shape === 'organic'); }
function box(c, cx, cy, u0, v0, hw, hd, z0, h, col, top) {
  if (dsRound()) { const [X, Y] = pt(cx, cy, u0, v0, 0); cyl(c, X, Y, Math.max(hw, hd) * 1.08, z0, h, col, top); return; }
  const P = (u, v, z) => pt(cx, cy, u0 + u, v0 + v, z);
  poly(c, [P(-hw, hd, z0), P(hw, hd, z0), P(hw, hd, z0 + h), P(-hw, hd, z0 + h)], shade(col, LT.fL));
  poly(c, [P(hw, hd, z0), P(hw, -hd, z0), P(hw, -hd, z0 + h), P(hw, hd, z0 + h)], shade(col, LT.fR));
  poly(c, [P(-hw, -hd, z0 + h), P(hw, -hd, z0 + h), P(hw, hd, z0 + h), P(-hw, hd, z0 + h)], topC(top || shade(col, LT.fT)));
  if (DM && h >= 4 && hw >= .09 && hd >= .09) matLines(c, P, hw, hd, z0, h);
}
// planks, stone courses or brick courses on the two faces we can see
const MAT_STEP = { wood: 1.8, stone: 2.8, brick: 1.6, adobe: 0 };
function matLines(c, P, hw, hd, z0, h) {
  const st = MAT_STEP[DM]; if (!st) return;
  c.beginPath();
  for (let z = z0 + st; z < z0 + h - .4; z += st) { let a = P(-hw, hd, z), b = P(hw, hd, z), d = P(hw, -hd, z); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); }
  if (DM === 'stone' && h >= 6) { // staggered joints (cheap: one short tick per block)
    let row = 0;
    for (let z = z0; z < z0 + h - .4; z += st, row++) {
      const z1 = Math.min(z0 + h, z + st), off = row % 2 ? .07 : 0;
      for (let u = -hw + .09 + off; u < hw - .03; u += .15) { const a = P(u, hd, z); c.moveTo(a[0], a[1]); c.lineTo(a[0], a[1] - (z1 - z)); }
      for (let v = hd - .09 - off; v > -hd + .03; v -= .15) { const a = P(hw, v, z); c.moveTo(a[0], a[1]); c.lineTo(a[0], a[1] - (z1 - z)); }
    }
  }
  c.strokeStyle = DM === 'wood' ? 'rgba(70,40,20,.2)' : DM === 'brick' ? 'rgba(250,230,210,.18)' : 'rgba(60,55,70,.16)'; c.lineWidth = DM === 'brick' ? .3 : .35; c.stroke();
}
function flat(c, cx, cy, u0, v0, hw, hd, z, col) {
  if (dsRound() && Math.abs(hw - hd) < .12) { const [X, Y] = pt(cx, cy, u0, v0, z), r = Math.max(hw, hd); ell(c, X, Y, r * 22.6, r * 11.3, col[0] === '#' ? topC(shade(col, LT.fG)) : col); return; }
  const P = (u, v) => pt(cx, cy, u0 + u, v0 + v, z);
  poly(c, [P(-hw, -hd), P(hw, -hd), P(hw, hd), P(-hw, hd)], col[0] === '#' ? topC(shade(col, LT.fG)) : col);
}
function cylWindows(c, cx, cy, u0, v0, r, z0, h, floors, n, col, onlyLit) {
  const fh = h / floors, lit = LT.lit, hx = (cx * 8) | 0, hy = (cy * 8) | 0;
  for (let f = 0; f < floors; f++) {
    const zb = z0 + f * fh + fh * .32, wh = fh * .42;
    for (let k = 0; k < n; k++) {
      const a = (-68 + 136 * (k + .5) / n) * DEG, nu = Math.cos(a) * .707 + Math.sin(a) * .707, nv = -Math.sin(a) * .707 + Math.cos(a) * .707;
      const on = lit && hash2(hx + k * 13, hy + f * 31, 71) < lit, wc = on ? LT.winC[(hash2(hx + k, hy + f, 73) * LT.winC.length) | 0] : shade(col, q2(lf(nu, nv, 0) / .9));
      if (!on && onlyLit) continue;
      const [px, py] = pt(cx, cy, u0 + r * nu, v0 + r * nv, zb), w = r * 22.6 * 1.6 / n * .42 * Math.cos(a);
      c.fillStyle = wc; c.fillRect(px - w / 2, py - wh, w, wh);
      if (on && EMQ) emit(px, py - wh / 2, Math.max(3.2, wh * 1.15), wc, .55);
    }
  }
}
function windows(c, cx, cy, u0, v0, hw, hd, z0, h, floors, cols, col, colR, onlyLit) {
  if (dsRound()) { cylWindows(c, cx, cy, u0, v0, Math.max(hw, hd) * 1.08 + .004, z0, h, floors, Math.min(cols + 1, 5), col, onlyLit); return; }
  const fh = h / floors, lit = LT.lit, cL = shade(col, LT.fWL), cR = colR ? shade(colR, LT.fWR) : shade(col, q2(.8 * LT.fWR / .8));
  const hx = (cx * 8) | 0, hy = (cy * 8) | 0;
  for (let f = 0; f < floors; f++) {
    const zb = z0 + f * fh + fh * 0.32, wh = fh * 0.42;
    for (let k = 0; k < cols; k++) {
      const t = (k + 0.5) / cols;
      const wu = hw * 2 / cols * 0.42, u = -hw + t * hw * 2;
      let on = lit && hash2(hx + k * 13 + ((u0 * 50) | 0), hy + f * 31, 71) < lit, wc = on ? LT.winC[(hash2(hx + k, hy + f, 73) * LT.winC.length) | 0] : cL;
      if (on || !onlyLit) poly(c, [pt(cx, cy, u0 + u - wu / 2, v0 + hd + .002, zb), pt(cx, cy, u0 + u + wu / 2, v0 + hd + .002, zb), pt(cx, cy, u0 + u + wu / 2, v0 + hd + .002, zb + wh), pt(cx, cy, u0 + u - wu / 2, v0 + hd + .002, zb + wh)], wc);
      if (on && EMQ) { const [ex, ey] = pt(cx, cy, u0 + u, v0 + hd, zb + wh / 2); emit(ex, ey, Math.max(3.2, wh * 1.15), wc, .6); }
      const wv = hd * 2 / cols * 0.42, v = hd - t * hd * 2;
      on = lit && hash2(hx + k * 17 + ((v0 * 50) | 0), hy + f * 37, 79) < lit; wc = on ? LT.winC[(hash2(hx - k, hy + f, 83) * LT.winC.length) | 0] : cR;
      if (on || !onlyLit) poly(c, [pt(cx, cy, u0 + hw + .002, v0 + v + wv / 2, zb), pt(cx, cy, u0 + hw + .002, v0 + v - wv / 2, zb), pt(cx, cy, u0 + hw + .002, v0 + v - wv / 2, zb + wh), pt(cx, cy, u0 + hw + .002, v0 + v + wv / 2, zb + wh)], on ? shade(wc, .92) : wc);
      if (on && EMQ) { const [ex, ey] = pt(cx, cy, u0 + hw, v0 + v, zb + wh / 2); emit(ex, ey, Math.max(3.2, wh * 1.15), wc, .5); }
    }
  }
}
function door(c, cx, cy, u0, v0, hd, w, h, col) {
  if (dsRound()) { u0 += hd * .74; v0 = v0 + hd * .74 - hd; }
  let dc = col;
  if (LT.lit && hash2((cx * 4) | 0, (cy * 4) | 0, 91) < LT.lit + .15) {
    dc = LT.doorC;
    if (EMQ) { const [ex, ey] = pt(cx, cy, u0, v0 + hd, h * .5); emit(ex, ey, h * 1.3 + 2, dc, .65); const [fx, fy] = pt(cx, cy, u0, v0 + hd + .18, 0); emit(fx, fy, 7, dc, .3, 1); }
  }
  poly(c, [pt(cx, cy, u0 - w / 2, v0 + hd + .003, 0), pt(cx, cy, u0 + w / 2, v0 + hd + .003, 0), pt(cx, cy, u0 + w / 2, v0 + hd + .003, h), pt(cx, cy, u0 - w / 2, v0 + hd + .003, h)], dc);
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
  const o = 0.05, P = (u, v, zz) => pt(cx, cy, u0 + u, v0 + v, zz), r = rh / 19.6;
  if (alongU) {
    poly(c, [P(-hw - o, -hd - o, z), P(hw + o, -hd - o, z), P(hw + o, 0, z + rh), P(-hw - o, 0, z + rh)], topC(shade(col, lf(0, -r, hd))));
    poly(c, [P(hw, -hd, z), P(hw, hd, z), P(hw, 0, z + rh)], shade(wall, LT.fR));
    poly(c, [P(-hw - o, hd + o, z), P(hw + o, hd + o, z), P(hw + o, 0, z + rh), P(-hw - o, 0, z + rh)], topC(shade(col, lf(0, r, hd))));
  } else {
    poly(c, [P(-hw - o, -hd - o, z), P(-hw - o, hd + o, z), P(0, hd + o, z + rh), P(0, -hd - o, z + rh)], topC(shade(col, lf(-r, 0, hw))));
    poly(c, [P(-hw, hd, z), P(hw, hd, z), P(0, hd, z + rh)], shade(wall, LT.fL));
    poly(c, [P(hw + o, -hd - o, z), P(hw + o, hd + o, z), P(0, hd + o, z + rh), P(0, -hd - o, z + rh)], topC(shade(col, lf(r, 0, hw))));
  }
}
function roofPyr(c, cx, cy, u0, v0, hw, hd, z, rh, col) {
  if (DS && dsRoof(c, cx, cy, u0, v0, hw, hd, z, rh, col)) return;
  const o = 0.04, P = (u, v, zz) => pt(cx, cy, u0 + u, v0 + v, zz), r = rh / 19.6;
  const A = P(-hw - o, -hd - o, z), B = P(hw + o, -hd - o, z), C = P(hw + o, hd + o, z), D = P(-hw - o, hd + o, z), T = P(0, 0, z + rh);
  poly(c, [A, B, T], topC(shade(col, lf(0, -r, hd)))); poly(c, [D, A, T], topC(shade(col, lf(-r, 0, hw))));
  poly(c, [D, C, T], topC(shade(col, lf(0, r, hd)))); poly(c, [C, B, T], topC(shade(col, lf(r, 0, hw))));
}
function cone(c, x, y, r, h, col) {
  const rx = r * 22.6, ry = r * 11.3;
  const g = c.createLinearGradient(x - rx, 0, x + rx, 0);
  g.addColorStop(0, topC(shade(col, lf(-.6, .6, .55)))); g.addColorStop(.5, topC(shade(col, lf(.6, .6, .55)))); g.addColorStop(1, topC(shade(col, lf(.6, -.6, .55))));
  c.fillStyle = g; c.beginPath(); c.moveTo(x, y - h); c.lineTo(x - rx, y); c.ellipse(x, y, rx, ry, 0, Math.PI, 0, true); c.closePath(); c.fill();
}
const CYL_N = [[0, -.707, .707], [.146, 0, 1], [.5, .707, .707], [.854, 1, 0], [1, .707, -.707]];
function cyl(c, x, y, r, z0, h, col, top) {
  const rx = r * 22.6, ry = r * 11.3, yb = y - z0, yt = y - z0 - h;
  const g = c.createLinearGradient(x - rx, 0, x + rx, 0);
  for (const [s, nx, ny] of CYL_N) g.addColorStop(s, shade(col, lf(nx, ny, 0)));
  c.fillStyle = g; c.beginPath(); c.moveTo(x - rx, yt); c.lineTo(x - rx, yb); c.ellipse(x, yb, rx, ry, 0, Math.PI, 0, true); c.lineTo(x + rx, yt); c.closePath(); c.fill();
  c.fillStyle = topC(top || shade(col, LT.fT)); c.beginPath(); c.ellipse(x, yt, rx, ry, 0, 0, TAU); c.fill();
}
function dome(c, x, y, r, z0, h, col, alpha = 1) {
  const rx = r * 22.6, ry = r * 11.3, yb = y - z0;
  const g = c.createRadialGradient(x + rx * .42 * LT.hx, yb - h * (.62 - .12 * LT.hy), 1, x, yb - h * .3, rx * 1.25);
  g.addColorStop(0, topC(shade(col, q2(LT.fT + .18)))); g.addColorStop(.5, shade(col, q2(LT.fT - .07))); g.addColorStop(1, shade(col, q2(LT.fR - .04)));
  c.globalAlpha = alpha; c.fillStyle = g; c.beginPath(); c.ellipse(x, yb, rx, h, 0, Math.PI, TAU, false); c.ellipse(x, yb, rx, ry, 0, 0, Math.PI, false); c.closePath(); c.fill(); c.globalAlpha = 1;
}
function line(c, x0, y0, x1, y1, col, w) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
function circ(c, x, y, r, col) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); }
function ell(c, x, y, rx, ry, col) { c.fillStyle = col; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, TAU); c.fill(); }

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

function drawTile(c, x, y) {
  const i = idx(x, y), z = surfZ(i);
  const X = (x - y) * TW2 + OX, Y = (x + y) * TH2 + OY - z;
  const top = topColor(i), w = M.water[i];
  // left face (+y)
  if (y === H - 1) edgeFace(c, i, x, y, X, Y, z, 0);
  else { const zl = surfZ(i + W); if (zl < z) cliff(c, i, X, Y, z - zl, 0, top); }
  // right face (+x)
  if (x === W - 1) edgeFace(c, i, x, y, X, Y, z, 1);
  else { const zr = surfZ(i + 1); if (zr < z) cliff(c, i, X, Y, z - zr, 1, top); }
  // top
  c.fillStyle = top; c.beginPath(); c.moveTo(X, Y - .45); c.lineTo(X + 16.6, Y + 8); c.lineTo(X, Y + 16.45); c.lineTo(X - 16.6, Y + 8); c.closePath(); c.fill();
  if (w) waterDetail(c, i, x, y, X, Y);
  else groundDetail(c, i, x, y, X, Y, top);
  const cx = X, cy = Y + 8;
  const bid = M.bld[i];
  let B = bid ? S.B[bid] : null;
  if (B && B.hid) B = null;
  if (B && FLAT_TYPES[B.type]) drawBuilding(c, B, cx, cy, i);
  if (M.road[i]) drawRoad(c, i, x, y, cx, cy);
  if (M.rail[i]) drawRail(c, i, x, y, cx, cy);
  if (LT.shA > 0) castShadows(c, i, x, y, cx, cy);
  drawTileObjects(c, i, x, y, cx, cy);
}
// everything on a tile that stands up (drawn again over people walking behind it)
function drawTileObjects(c, i, x, y, cx, cy) {
  const w = M.water[i], bid = M.bld[i];
  let B = bid ? S.B[bid] : null;
  if (B && B.hid) B = null;
  if (M.road[i] >= 2 && !w && (x + 2 * y) % (M.road[i] >= 4 ? 2 : 3) === 0) drawLamp(c, i, cx, cy);
  if (M.ruin[i]) drawRuin(c, i, x, y, cx, cy);
  if (!B && !bid && springAt(i)) drawSpring(c, i, cx, cy);
  if (!w && S.ferries && S.ferries.length) { const fl = ferryLandings().get(i); if (fl) drawLanding(c, i, cx, cy, fl); }
  if (B && !FLAT_TYPES[B.type]) drawBuilding(c, B, cx, cy, i);
  else if (!B && !bid && M.tree[i]) drawTrees(c, i, x, y, cx, cy);
  else if (!B && !w && (M.bio[i] === BIO.ROCK || M.bio[i] === BIO.HIGH) && hash2(x, y, 11) < 0.3 && !M.road[i]) drawRocks(c, x, y, cx, cy);
}

function cliff(c, i, X, Y, dh, side, top) {
  const A = side ? [X, Y + 16] : [X - 16, Y + 8], B = side ? [X + 16, Y + 8] : [X, Y + 16];
  const f = side ? q2(LT.fR - .02) : q2(LT.fL - .03);
  const sc = sideCol(i);
  const e = 0.35;
  c.fillStyle = shade(sc, f);
  c.beginPath(); c.moveTo(A[0] - (side ? e : e), A[1] - e); c.lineTo(B[0] + e, B[1] - e); c.lineTo(B[0] + e, B[1] + dh + e); c.lineTo(A[0] - e, A[1] + dh + e); c.closePath(); c.fill();
  if (!M.water[i]) { // grass lip
    const lip = Math.min(2.2, dh);
    c.fillStyle = shade(top, f * 0.9);
    c.beginPath(); c.moveTo(A[0], A[1]); c.lineTo(B[0], B[1]); c.lineTo(B[0], B[1] + lip); c.lineTo(A[0], A[1] + lip); c.closePath(); c.fill();
    if (dh > 7) { // a few strata lines in taller cliffs
      c.strokeStyle = shade(sc, f * 0.9); c.lineWidth = 0.6;
      for (let k = 6; k < dh - 1; k += 6) { c.beginPath(); c.moveTo(A[0], A[1] + k); c.lineTo(B[0], B[1] + k); c.stroke(); }
    }
  } else { // waterfall
    c.fillStyle = 'rgba(255,255,255,.35)';
    for (let k = 0; k < 3; k++) { const t = 0.2 + k * 0.3; const px = lerp(A[0], B[0], t), py = lerp(A[1], B[1], t); c.fillRect(px - .5, py, 1, dh); }
  }
}

function edgeFace(c, i, x, y, X, Y, z, side) {
  const A = side ? [X, Y + 16] : [X - 16, Y + 8], B = side ? [X + 16, Y + 8] : [X, Y + 16];
  const f = side ? LT.fR : q2(LT.fL - .02);
  const bottom = z + SLAB; // depth to reach z=-SLAB
  const e = 0.4;
  let d = 0;
  if (M.water[i] === 1) { // aquarium side
    const floorZ = M.elev[i] * EH + 1;
    const dw = z - floorZ;
    const g = c.createLinearGradient(0, A[1], 0, A[1] + dw);
    g.addColorStop(0, rgba(shade('#4aa6cb', f), .92)); g.addColorStop(1, rgba(shade('#2f7ea8', f), .95));
    c.fillStyle = g;
    c.beginPath(); c.moveTo(A[0] - e, A[1]); c.lineTo(B[0] + e, B[1]); c.lineTo(B[0] + e, B[1] + dw + e); c.lineTo(A[0] - e, A[1] + dw + e); c.closePath(); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .8; c.beginPath(); c.moveTo(A[0], A[1] + .4); c.lineTo(B[0], B[1] + .4); c.stroke();
    d = dw;
    // sand floor band
    c.fillStyle = shade('#d9bb96', f);
    c.beginPath(); c.moveTo(A[0] - e, A[1] + d); c.lineTo(B[0] + e, B[1] + d); c.lineTo(B[0] + e, B[1] + d + 3 + e); c.lineTo(A[0] - e, A[1] + d + 3 + e); c.closePath(); c.fill();
    d += 3;
  } else if (M.water[i] === 2) {
    c.fillStyle = shade('#5fb4d2', f);
    c.beginPath(); c.moveTo(A[0] - e, A[1]); c.lineTo(B[0] + e, B[1]); c.lineTo(B[0] + e, B[1] + 3 + e); c.lineTo(A[0] - e, A[1] + 3 + e); c.closePath(); c.fill();
    d = 3;
  } else {
    const top = topColor(i);
    c.fillStyle = shade(top, f * 0.88);
    c.beginPath(); c.moveTo(A[0] - e, A[1] - e); c.lineTo(B[0] + e, B[1] - e); c.lineTo(B[0] + e, B[1] + 2.4); c.lineTo(A[0] - e, A[1] + 2.4); c.closePath(); c.fill();
    d = 2.2;
  }
  // strata bands by absolute z
  while (d < bottom) {
    const zAbs = z - d;
    const wob = (hash2(x * 3 + side, y * 5, 91) - .5) * 3;
    const band = Math.floor((zAbs + 300 + wob) / 12);
    const nextZ = band * 12 - 300 - wob;
    let d2 = Math.min(bottom, z - nextZ); if (d2 <= d + 0.2) d2 = Math.min(bottom, d + 12);
    const depthK = 1 - Math.min(0.28, (d / (bottom + 1)) * 0.3);
    c.fillStyle = shade(STRATA[((band % STRATA.length) + STRATA.length) % STRATA.length], f * depthK);
    c.beginPath(); c.moveTo(A[0] - e, A[1] + d - e); c.lineTo(B[0] + e, B[1] + d - e); c.lineTo(B[0] + e, B[1] + d2 + e); c.lineTo(A[0] - e, A[1] + d2 + e); c.closePath(); c.fill();
    d = d2;
  }
  // pebbles in strata
  for (let k = 0; k < 3; k++) {
    const t = hash2(x, y, 40 + k + side * 7), dd = 6 + hash2(y, x, 50 + k) * (bottom - 10);
    ell(c, lerp(A[0], B[0], t), lerp(A[1], B[1], t) + dd, 1.4, 0.9, shade('#7a6258', f));
  }
  // hanging rock
  const hr = hash2(x + side * 99, y, 17);
  const A2 = [A[0], A[1] + bottom], B2 = [B[0], B[1] + bottom];
  const tipT = 0.3 + hash2(x, y + side, 18) * 0.4, tipD = 6 + hr * 30;
  const tip = [lerp(A2[0], B2[0], tipT), lerp(A2[1], B2[1], tipT) + tipD];
  c.fillStyle = shade('#7d6258', f * 0.85);
  c.beginPath(); c.moveTo(A2[0] - e, A2[1] - 1); c.lineTo(B2[0] + e, B2[1] - 1); c.lineTo(lerp(B2[0], tip[0], .5) + 1, lerp(B2[1], tip[1], .5) - 2); c.lineTo(tip[0], tip[1]); c.lineTo(lerp(A2[0], tip[0], .5) - 1, lerp(A2[1], tip[1], .5) - 4); c.closePath(); c.fill();
}

function waterDetail(c, i, x, y, X, Y) {
  // foam where water meets land
  c.strokeStyle = 'rgba(240,252,255,.75)'; c.lineWidth = 1.1;
  const T = [X, Y], R = [X + 16, Y + 8], F = [X, Y + 16], L = [X - 16, Y + 8];
  const edges = [[1, 0, R, F], [-1, 0, T, L], [0, 1, L, F], [0, -1, T, R]];
  for (const [dx, dy, a, b] of edges) {
    const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue;
    if (!M.water[idx(nx, ny)]) { c.beginPath(); c.moveTo(lerp(a[0], b[0], .06), lerp(a[1], b[1], .06)); c.lineTo(lerp(a[0], b[0], .94), lerp(a[1], b[1], .94)); c.stroke(); }
  }
  for (const [dx, dy] of N4) {
    const nx = x - dx, ny = y - dy; if (!inb(nx, ny)) continue;
    const bb = M.bld[idx(nx, ny)]; if (!bb) continue; const D = S.B[bb];
    if (!D || D.type !== 'dock' || D.prog < 1 || !D.dir || D.dir[0] !== dx || D.dir[1] !== dy) continue;
    const cx = X, cy = Y + 8, lift = landZ(i) - surfZ(i) + 1;
    const a = pt(cx, cy, -dx * .5, -dy * .5, lift), b = pt(cx, cy, dx * .1, dy * .1, lift);
    const p1 = pt(cx, cy, dx * .05 + dy * .08, dy * .05 + dx * .08, 0), p2 = pt(cx, cy, dx * .05 - dy * .08, dy * .05 - dx * .08, 0);
    line(c, p1[0], p1[1], p1[0], p1[1] - lift, '#7e5f47', .9); line(c, p2[0], p2[1], p2[0], p2[1] - lift, '#7e5f47', .9);
    line(c, a[0], a[1], b[0], b[1], '#a8835f', 3.2);
    const [bx, by] = pt(cx, cy, dx * .05 + dy * .28, dy * .05 + dx * .28, 0);
    c.fillStyle = '#8a6d57'; c.beginPath(); c.moveTo(bx - 3.5, by - 1.5); c.lineTo(bx + 3.5, by - 1.5); c.lineTo(bx + 2.2, by + .4); c.lineTo(bx - 2.2, by + .4); c.fill();
    line(c, bx, by - 1.5, bx, by - 8, '#6b5040', .4);
  }
  if (M.water[i] === 1 && hash2(x, y, 8) < 0.12) { c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(X - 4 + hash2(x, y, 9) * 6, Y + 6 + hash2(y, x, 9) * 4, 5, .8); }
}

const FLOWERS = ['#ffffff', '#ffd66b', '#ff9fc4', '#b9a2ff', '#ffb38a'];
function groundDetail(c, i, x, y, X, Y, top) {
  const b = M.bio[i];
  const n = 3 + (hash2(x, y, 1) * 3 | 0);
  for (let k = 0; k < n; k++) {
    const u = hash2(x, y, 20 + k) - .5, v = hash2(x, y, 30 + k) - .5;
    const px = X + (u - v) * 14, py = Y + 8 + (u + v) * 7;
    if (b === BIO.MEADOW || b === BIO.LUSH) {
      c.fillStyle = shade(top, k % 2 ? 0.88 : 1.07); c.fillRect(px, py, 1.4, .7);
    } else if (b === BIO.SAND) { c.fillStyle = shade(top, k % 2 ? .92 : 1.05); c.fillRect(px, py, 1, .6); }
    else if (b === BIO.BARREN) { c.strokeStyle = shade(top, .9); c.lineWidth = .6; c.beginPath(); c.moveTo(px - 2, py); c.quadraticCurveTo(px, py - 1, px + 2, py); c.stroke(); }
    else if (b === BIO.ROCK || b === BIO.HIGH) { c.fillStyle = shade(top, .88); c.fillRect(px, py, 1.2, .8); }
    else if (b === BIO.SNOW) { c.fillStyle = k % 2 ? '#dfe2f3' : '#ffffff'; c.beginPath(); c.ellipse(px, py, 2.6, 1, 0, 0, TAU); c.fill(); }
  }
  if (M.wild[i] === 3 && !M.tree[i] && !M.bld[i] && !M.road[i]) { // stumps where the woodcutters have been
    for (let k = 0; k < 2; k++) {
      const u = (hash2(x, y, 140 + k) - .5) * .5, v = (hash2(x, y, 150 + k) - .5) * .5, px = X + (u - v) * 16, py = Y + 8 + (u + v) * 8;
      c.fillStyle = '#7b5e4e'; c.fillRect(px - 1.1, py - 1.6, 2.2, 1.6); c.fillStyle = '#d9b88a'; c.beginPath(); c.ellipse(px, py - 1.6, 1.1, .5, 0, 0, TAU); c.fill();
    }
  }
  if ((b === BIO.MEADOW || b === BIO.LUSH) && !M.bld[i] && hash2(x, y, 60) < LT.flowers) {
    const col = FLOWERS[(hash2(x, y, 61) * FLOWERS.length) | 0];
    for (let k = 0; k < 3; k++) {
      const u = hash2(x, y, 70 + k) - .5, v = hash2(x, y, 80 + k) - .5;
      circ(c, X + (u - v) * 13, Y + 8 + (u + v) * 6.5, .7, col);
    }
  }
}

function drawTrees(c, i, x, y, cx, cy) {
  const n = M.tree[i], tt = M.ttype[i];
  const ps = [];
  for (let k = 0; k < n; k++) {
    let u = (hash2(x, y, k * 3 + 1) - .5) * .6, v = (hash2(x, y, k * 3 + 2) - .5) * .6;
    if (n === 1) { u *= .4; v *= .4; }
    ps.push([u, v, .8 + hash2(x, y, k * 3 + 3) * .45, k]);
  }
  ps.sort((a, b) => (a[0] + a[1]) - (b[0] + b[1]));
  const hx = LT.hx * 1.25, lsh = LT.shA > 0 ? LT.shdx - LT.shdy : 1;
  for (const [u, v, s, k] of ps) {
    const [px, py] = pt(cx, cy, u, v, 0);
    ell(c, px + 1.5 * clamp(lsh, -1, 1), py + .5, 4.2 * s, 2 * s, 'rgba(40,50,70,.13)');
    const hv = hash2(x, y, 90 + k);
    if (tt === 1 || tt === 0) { // puffwood
      const cols = ['#a57ac6', '#b683c9', '#9570c2', '#c48ac4', '#8f79cf'];
      const col = cols[(hv * cols.length) | 0];
      c.fillStyle = '#7b5e6e'; c.fillRect(px - .6, py - 7 * s, 1.2, 7 * s);
      circ(c, px, py - 10 * s, 4.8 * s, leafC(col, .82));
      circ(c, px + .6 * hx * s, py - 10.8 * s, 4.1 * s, leafC(col));
      circ(c, px + 1.7 * hx * s, py - 12 * s, 1.9 * s, topC(leafC(col, 1.18)));
    } else if (tt === 2) { // spirepine
      const col = hv < .5 ? '#4f9f95' : '#3f8f8a', d = hx <= 0 ? 1 : -1;
      c.fillStyle = '#6b5a55'; c.fillRect(px - .6, py - 4 * s, 1.2, 4 * s);
      poly(c, [[px, py - 18 * s], [px - 4.4 * s, py - 3 * s], [px + 4.4 * s, py - 3 * s]], leafC(col, .85));
      poly(c, [[px, py - 18 * s], [px - 4.4 * d * s, py - 3 * s], [px + .3 * d * s, py - 3 * s]], leafC(col));
      poly(c, [[px, py - 22 * s], [px - 3 * s, py - 11 * s], [px + 3 * s, py - 11 * s]], topC(leafC(col, 1.08)));
    } else if (tt === 3) { // glowcap
      const col = hv < .5 ? '#ee92b6' : '#f3a37f';
      c.fillStyle = '#efe2d4'; c.fillRect(px - .9 * s, py - 7 * s, 1.8 * s, 7 * s);
      ell(c, px, py - 7 * s, 5.2 * s, 2.3 * s, shade(col, q2(.78 * LT.fG)));
      c.fillStyle = topC(shade(col, LT.fG)); c.beginPath(); c.ellipse(px, py - 7.2 * s, 5.2 * s, 4.4 * s, 0, Math.PI, TAU); c.fill();
      circ(c, px - 2 * s, py - 9.5 * s, .7 * s, '#fff5f8'); circ(c, px + 1.5 * s, py - 10.3 * s, .6 * s, '#fff5f8'); circ(c, px + .2 * s, py - 8.4 * s, .5 * s, '#fff5f8');
      emit(px, py - 8 * s, 7 * s, col, .38); emit(px, py, 7 * s, col, .18, 1);
    } else { // orchard
      c.fillStyle = '#7b5e4e'; c.fillRect(px - .6, py - 5 * s, 1.2, 5 * s);
      circ(c, px, py - 7.5 * s, 3.6 * s, leafC('#6db873')); circ(c, px + .8 * hx * s, py - 8.2 * s, 2.6 * s, topC(leafC('#83c886')));
      if (LT.winter < .5) { circ(c, px + 1.2 * s, py - 7 * s, .7, '#ff9a4d'); circ(c, px - 1.4 * s, py - 6.5 * s, .7, '#ff9a4d'); }
    }
  }
}
function drawRocks(c, x, y, cx, cy) {
  const n = 1 + (hash2(x, y, 12) * 2 | 0);
  for (let k = 0; k < n; k++) {
    const u = (hash2(x, y, 13 + k) - .5) * .6, v = (hash2(x, y, 15 + k) - .5) * .6, s = .7 + hash2(x, y, 17 + k) * .8;
    const [px, py] = pt(cx, cy, u, v, 0);
    ell(c, px + .8, py + .4, 3.4 * s, 1.6 * s, 'rgba(40,40,60,.15)');
    c.fillStyle = '#9d97ad'; c.beginPath(); c.ellipse(px, py - 1.5 * s, 3 * s, 2.4 * s, 0, 0, TAU); c.fill();
    c.fillStyle = '#b9b3c8'; c.beginPath(); c.ellipse(px - .8 * s, py - 2.3 * s, 1.6 * s, 1.2 * s, 0, 0, TAU); c.fill();
  }
}
function drawRuin(c, i, x, y, cx, cy) {
  const stone = '#e4dccb';
  const hs = [9 + hash2(x, y, 1) * 6, 5 + hash2(x, y, 2) * 8, 11 + hash2(x, y, 3) * 5];
  const us = [[-.22, -.18], [.2, -.2], [-.2, .2]];
  flat(c, cx, cy, 0, 0, .38, .38, .2, 'rgba(210,200,180,.55)');
  for (let k = 0; k < 3; k++) box(c, cx, cy, us[k][0], us[k][1], .06, .06, 0, hs[k], stone);
  box(c, cx, cy, -.01, -.19, .3, .06, hs[0] - 1, 2.2, shade(stone, .95));
  box(c, cx, cy, .18, .18, .1, .08, 0, 2, shade(stone, .9));
  const [gx, gy] = pt(cx, cy, .18, .18, 2.4);
  circ(c, gx, gy, 1.3, 'rgba(95,208,201,.9)'); circ(c, gx, gy, 2.6, 'rgba(95,208,201,.25)');
  emit(gx, gy, 7, '#5fd0c9', .7);
  if (M.ruin[i] === 2) { const [fx, fy] = pt(cx, cy, .3, -.32, 0); line(c, fx, fy, fx, fy - 12, '#6b5a4c', .7); poly(c, [[fx, fy - 12], [fx + 5, fy - 10.5], [fx, fy - 9]], '#d9774b'); }
}

/* ---------- roads & rails ---------- */
const ROAD_COL = [null, '#d9c19a', '#cdb892', '#b9b2a8', '#6f7075', '#e8eef5'];
function roadNeighbors(arr, x, y) {
  const r = [];
  for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny)) { const j = idx(nx, ny); if (arr[j] || (arr === M.road && M.bld[j] && isRoadAnchor(j))) r.push([dx, dy]); } }
  return r;
}
function isRoadAnchor(j) { const B = S.B[M.bld[j]]; return B && (B.type === 'plaza' || B.type === 'pod' || B.type === 'station'); }
function drawRoad(c, i, x, y, cx, cy) {
  const t = M.road[i], col = shade(ROAD_COL[t] || ROAD_COL[1], LT.fG);
  let zOff = 0;
  const bridge = M.water[i] !== 0;
  if (bridge) zOff = bridgeZ(i) - surfZ(i);
  const w = t >= 4 ? .42 : t >= 2 ? .34 : .26;
  const nb = roadNeighbors(M.road, x, y);
  const P = (u, v) => pt(cx, cy, u, v, zOff);
  const segs = [];
  segs.push([[-w / 2, -w / 2], [w / 2, -w / 2], [w / 2, w / 2], [-w / 2, w / 2]]);
  for (const [dx, dy] of nb) {
    if (dx) { const a = dx > 0 ? 0 : -.5, b = dx > 0 ? .5 : 0; segs.push([[a, -w / 2], [b, -w / 2], [b, w / 2], [a, w / 2]]); }
    else { const a = dy > 0 ? 0 : -.5, b = dy > 0 ? .5 : 0; segs.push([[-w / 2, a], [w / 2, a], [w / 2, b], [-w / 2, b]]); }
  }
  if (bridge) { // deck sides + posts
    for (const s of segs) {
      const q = s.map(([u, v]) => P(u, v));
      poly(c, [q[3], q[2], [q[2][0], q[2][1] + 2.5], [q[3][0], q[3][1] + 2.5]], shade(t >= 3 ? '#a8a197' : '#9b7657', q2(LT.fL - .05)));
      poly(c, [q[1], q[2], [q[2][0], q[2][1] + 2.5], [q[1][0], q[1][1] + 2.5]], shade(t >= 3 ? '#a8a197' : '#9b7657', q2(LT.fR - .02)));
    }
    const [bx, by] = P(0, 0); c.fillStyle = t >= 3 ? '#9c958c' : '#7e5f47'; c.fillRect(bx - 1.2, by + 2, 2.4, zOff + 1);
  }
  for (const s of segs) poly(c, s.map(([u, v]) => P(u, v)), bridge ? shade(t >= 3 ? '#c9c2b6' : '#b98d66', LT.fG) : col);
  if (t === 4 && !bridge) { // dashed centre line
    c.strokeStyle = 'rgba(255,240,190,.7)'; c.lineWidth = .5;
    for (const [dx, dy] of nb) { const a = P(dx * .12, dy * .12), b = P(dx * .38, dy * .38); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
  }
  if (t === 5) { c.strokeStyle = 'rgba(120,220,230,.7)'; c.lineWidth = .5; for (const [dx, dy] of nb) { const a = P(0, 0), b = P(dx * .5, dy * .5); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } }
}
// a bridge deck sits level with the banks it joins
function bridgeZ(i) {
  let z = landZ(i) + 2;
  if (M.water[i] === 2) { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (!M.water[j] && M.road[j]) z = Math.max(z, surfZ(j) + 1); } }
  return z;
}
function drawRail(c, i, x, y, cx, cy) {
  const nb = roadNeighbors(M.rail, x, y);
  let zOff = M.water[i] ? landZ(i) + 3 - surfZ(i) : 0.4;
  const P = (u, v) => pt(cx, cy, u, v, zOff);
  const maglev = S.tech && hasTech('maglev');
  if (M.water[i]) { const [bx, by] = P(0, 0); c.fillStyle = '#8d8a88'; c.fillRect(bx - 1.3, by + 1, 2.6, zOff); }
  for (const [dx, dy] of nb) {
    const ties = maglev ? 0 : 3;
    for (let k = 0; k < ties; k++) {
      const t = .1 + k * .14;
      const u = dx * t, v = dy * t, ou = dy ? .14 : 0, ov = dx ? .14 : 0;
      const a = P(u - ou, v - ov), b = P(u + ou, v + ov); line(c, a[0], a[1], b[0], b[1], '#7a5f4d', 1);
    }
    for (const s of [-.08, .08]) {
      const ou = dy ? s : 0, ov = dx ? s : 0;
      const a = P(ou, ov), b = P(dx * .5 + ou, dy * .5 + ov);
      line(c, a[0], a[1], b[0], b[1], maglev ? '#dfe7ef' : '#5b5f66', maglev ? 1.4 : .7);
    }
  }
}

/* ---------- street lamps ---------- */
function lampC(x, y) { return LT.lampCs ? LT.lampCs[(hash2(x | 0, y | 0, 17) * LT.lampCs.length) | 0] : LT.lampC; }
function drawLamp(c, i, cx, cy) {
  const k = LT.era, t = M.road[i], [px, py] = pt(cx, cy, .36, -.36, 0), on = LT.lit > 0 && !LT.lampOff;
  const EQ = EMQ; if (LT.lampOff) EMQ = null;
  const col = lampC(px * 3, py * 3), sv = LT.lampC; LT.lampC = col;
  if (t >= 5 || k === 2) { // light pillar
    line(c, px, py, px, py - 8, '#e9eef4', 1.1);
    circ(c, px, py - 8.4, .9, on ? '#e6fbff' : '#bfe9f5');
    emit(px, py - 8, 7, LT.lampC, .8); emit(px, py, 11, LT.lampC, .32, 1);
  } else if (k === 1) { // iron lamppost
    line(c, px, py, px, py - 9, '#4c4f58', .8); line(c, px, py - 9, px - 1.6, py - 9.6, '#4c4f58', .6);
    circ(c, px - 1.8, py - 9.3, .9, on ? '#fff3d0' : '#e8e2cf');
    emit(px - 1.8, py - 9.2, 8, LT.lampC, .85); emit(px - 1, py, 12, LT.lampC, .35, 1);
  } else { // lantern on a post
    line(c, px, py, px, py - 7, '#6b5040', .8);
    c.fillStyle = on ? '#ffc56e' : '#d9b27a'; c.fillRect(px - .9, py - 8.6, 1.8, 1.8);
    emit(px, py - 7.8, 7, LT.lampC, .8); emit(px, py, 9, LT.lampC, .3, 1);
  }
  LT.lampC = sv; EMQ = EQ;
}
