/* ============================== buildings ============================== */
const FLAT_TYPES = { farm: 1, solar: 1, airfield: 1, park: 1, plaza: 1 };
function winCol(st, B) { return B.style >= 5 ? st.glass : '#4f5463'; }
function buildH(B) { return B.type === 'house' ? HOUSE_H[B.up != null ? B.up : B.tier] * .7 : (BT[B.type] ? BT[B.type].h * .55 : 20); }

function drawBuilding(c, B, cx, cy, i) {
  let st = S.styles[B.style] || STYLES0[0]; const sv = DS, sm = DM;
  if (B.mat && MAT[B.mat]) st = matStyle(st, B);
  DS = st.shape || st.roofK ? st : null; DM = B.mat || null;
  try { drawBuilding0(c, B, cx, cy, i, st); } finally { DS = sv; DM = sm; }
}
// the era's style, tinted by what the building is made of
const MATST = new Map();
function matStyle(st, B) {
  const key = B.style + B.mat + st.wall + st.roof + (st.cult || '');
  let o = MATST.get(key); if (o) return o;
  const m = MAT[B.mat], k = st.cult ? .22 : B.mat === 'wood' ? .55 : .62;
  o = Object.assign({}, st, { wall: mix(st.wall, m.wall, k), roof: mix(st.roof, m.roof, k * .45) });
  if (MATST.size > 400) MATST.clear();
  MATST.set(key, o); return o;
}
function drawBuilding0(c, B, cx, cy, i, st) {
  if (B.prog < 1) { drawConstruction(c, B, cx, cy, st, i); return; }
  const v = B.var || 0;
  switch (B.type) {
    case 'pod': return drawPod(c, B, cx, cy);
    case 'house': return drawHouse(c, B, cx, cy, st);
    case 'farm': return drawFarm(c, B, cx, cy, i);
    case 'plaza': return drawPlaza(c, B, cx, cy, st);
    case 'well': {
      if (B.style >= 4) { box(c, cx, cy, 0, 0, .1, .1, 0, 5, '#8c96a3'); line(c, ...pt(cx, cy, .1, 0, 4), ...pt(cx, cy, .22, 0, 4), '#6c7683', 1.2); return; }
      cyl(c, cx, cy, .14, 0, 3.5, '#bdb3a6', '#5aa7c4');
      const a = pt(cx, cy, -.13, 0, 3), b = pt(cx, cy, .13, 0, 3);
      line(c, a[0], a[1], a[0], a[1] - 6, '#7a5a44', .9); line(c, b[0], b[1], b[0], b[1] - 6, '#7a5a44', .9);
      roofGable(c, cx, cy, 0, 0, .17, .1, 9, 3, st.roof, st.wall, true); return;
    }
    case 'granary': cyl(c, cx, cy, .2, 0, 11, mix(st.wall, '#d9c29a', .4)); cone(c, cx, cy - 11, .25, 8, st.roof); door(c, cx, cy, 0, 0, .19, .08, 4, '#5a4a40'); return;
    case 'shrine': {
      box(c, cx, cy, 0, 0, .28, .28, 0, 1.6, '#d6cfc3');
      box(c, cx, cy, 0, 0, .07, .07, 1.6, 15, shade('#e8e2d6', 1));
      roofPyr(c, cx, cy, 0, 0, .07, .07, 16.6, 4, st.accent);
      { const [ex, ey] = pt(cx, cy, .1, .22, 2); circ(c, ex, ey, .6, '#ffd27a'); emit(ex, ey - .5, 5, '#ffb45e', .7); }
      return;
    }
    case 'watchstone': {
      box(c, cx, cy, 0, 0, .3, .3, 0, 2, '#d2cabd');
      box(c, cx, cy, 0, 0, .09, .09, 2, 28, '#e9e3d8');
      roofPyr(c, cx, cy, 0, 0, .09, .09, 30, 6, '#d6b85a');
      const [ex, ey] = pt(cx, cy, 0, .09, 23);
      ell(c, ex - 1.2, ey + .6, 2.4, 1.3, 'rgba(95,208,201,.35)'); circ(c, ex - 1.2, ey + .6, 1, '#3aa8a0');
      emit(ex - 1.2, ey + .6, 7, '#5fd0c9', .7);
      return;
    }
    case 'dock': {
      box(c, cx, cy, -.1, -.1, .2, .16, 0, 6, mix(st.wall, '#a57f5e', .5));
      roofGable(c, cx, cy, -.1, -.1, .2, .16, 6, 3.5, st.roof, st.wall, true);
      const d = B.dir || [1, 0];
      const a = pt(cx, cy, d[0] * .05, d[1] * .05, 1), b = pt(cx, cy, d[0] * .5, d[1] * .5, 1);
      line(c, a[0], a[1], b[0], b[1], '#9b7657', 3.2);
      const [lx, ly] = pt(cx, cy, d[0] * .46 + d[1] * .08, d[1] * .46 + d[0] * .08, 1); line(c, lx, ly, lx, ly - 5, '#6b5040', .5); circ(c, lx, ly - 5.3, .7, LT.lit ? '#ffd27a' : '#c9a67a'); emit(lx, ly - 5, 6, LT.lampC, .75); emit(lx, ly + 1, 8, LT.lampC, .25, 1);
      return;
    }
    case 'market': {
      const spots = [[-.2, -.12], [.16, -.2], [.02, .18]];
      const cols = [st.accent, '#e9c46a', '#e76f51'];
      spots.forEach(([u, vv], k) => {
        box(c, cx, cy, u, vv, .1, .1, 0, 3.4, mix(st.wall, '#c9a47e', .4));
        const P = (uu, ww, z) => pt(cx, cy, u + uu, vv + ww, z);
        poly(c, [P(-.13, -.13, 6.5), P(.13, -.13, 6.5), P(.14, .15, 4.2), P(-.14, .15, 4.2)], cols[k]);
        poly(c, [P(-.04, -.13, 6.5), P(.04, -.13, 6.5), P(.04, .15, 4.2), P(-.04, .15, 4.2)], '#fff6ea');
        const [lx, ly] = P(0, .15, 4); emit(lx, ly, 5, '#ffb45e', .55);
      });
      return;
    }
    case 'school': {
      box(c, cx, cy, 0, 0, .34, .24, 0, 10, st.wall); windows(c, cx, cy, 0, 0, .34, .24, 0, 10, 1, 3, winCol(st, B));
      door(c, cx, cy, 0, 0, .24, .1, 5, shade(st.trim, .9));
      roofGable(c, cx, cy, 0, 0, .34, .24, 10, 6, st.roof, st.wall, true);
      box(c, cx, cy, .18, 0, .06, .06, 13, 6, st.wall); roofPyr(c, cx, cy, .18, 0, .07, .07, 19, 5, st.roof);
      return;
    }
    case 'library': {
      box(c, cx, cy, 0, -.04, .36, .28, 0, 12, st.wall); windows(c, cx, cy, 0, -.04, .36, .28, 0, 12, 1, 3, winCol(st, B));
      for (let k = 0; k < 4; k++) box(c, cx, cy, -.27 + k * .18, .3, .035, .035, 0, 11, shade(st.wall, 1.08));
      box(c, cx, cy, 0, .3, .36, .06, 11, 2, shade(st.wall, 1.02));
      dome(c, ...pt(cx, cy, 0, -.04, 0), .17, 12, 9, st.roof);
      return;
    }
    case 'workshop': {
      box(c, cx, cy, 0, 0, .3, .26, 0, 8, st.wall); windows(c, cx, cy, 0, 0, .3, .26, 0, 8, 1, 2, winCol(st, B));
      door(c, cx, cy, -.1, 0, .26, .14, 5.5, '#5c4a3e');
      roofGable(c, cx, cy, 0, 0, .3, .26, 8, 5, st.roof, st.wall, v < .5);
      box(c, cx, cy, .16, -.14, .05, .05, 8, 12, '#8f6f62'); return;
    }
    case 'mine': {
      roofPyr(c, cx, cy, 0, 0, .36, .36, 0, 10, '#9e95a8');
      door(c, cx, cy, -.05, 0, .36, .16, 5, '#2f2a33');
      const a = pt(cx, cy, .2, -.1, 0), b = pt(cx, cy, .2, -.1, 22);
      line(c, a[0] - 4, a[1], b[0], b[1], '#7a5a44', 1.2); line(c, a[0] + 4, a[1], b[0], b[1], '#7a5a44', 1.2);
      c.strokeStyle = '#5a4538'; c.lineWidth = 1; c.beginPath(); c.arc(b[0], b[1] + 1, 3, 0, TAU); c.stroke();
      box(c, cx, cy, .05, .3, .06, .04, 0, 2.5, '#6b6470'); return;
    }
    case 'lumber': return drawLumber(c, B, cx, cy, st, i);
    case 'harbor': return drawHarbour(c, B, cx, cy, st, i);
    case 'lighthouse': return drawLighthouse(c, B, cx, cy, st);
    case 'quarry': return drawQuarry(c, B, cx, cy, i);
    case 'claypit': return drawClaypit(c, B, cx, cy, i);
    case 'mill': {
      cyl(c, cx, cy, .17, 0, 16, st.wall); door(c, cx, cy, 0, 0, .16, .08, 4.5, '#5c4a3e');
      cone(c, cx, cy - 16, .2, 8, st.roof);
      const [hx, hy] = pt(cx, cy, .05, .2, 17); circ(c, hx, hy, 1.4, '#6b5040'); return;
    }
    case 'hall': {
      box(c, cx, cy, 0, 0, .4, .3, 0, 13, st.wall); windows(c, cx, cy, 0, 0, .4, .3, 0, 13, 2, 4, winCol(st, B));
      door(c, cx, cy, 0, 0, .3, .12, 6, shade(st.trim, .9));
      roofPyr(c, cx, cy, 0, 0, .4, .3, 13, 5, st.roof);
      box(c, cx, cy, 0, 0, .1, .1, 15, 17, shade(st.wall, 1.03)); roofPyr(c, cx, cy, 0, 0, .11, .11, 32, 9, st.roof);
      const [kx, ky] = pt(cx, cy, 0, .1, 27); ell(c, kx - .8, ky + .4, 2.2, 2.4, '#fbf6ea'); line(c, kx - .8, ky + .4, kx - .8, ky - 1.3, '#333', .4);
      emit(kx - .8, ky + .4, 5, '#fff1c9', .6);
      return;
    }
    case 'observatory': cyl(c, cx, cy, .22, 0, 10, st.wall); dome(c, cx, cy, .22, 10, 9, '#f1f1f4');
      line(c, cx, cy - 19, cx + 2, cy - 11, '#3a3f4a', 1.4); return;
    case 'works': {
      box(c, cx, cy, 0, 0, .42, .3, 0, 12, st.wall); windows(c, cx, cy, 0, 0, .42, .3, 0, 12, 2, 5, winCol(st, B));
      for (let k = 0; k < 3; k++) {
        const u = -.28 + k * .28, P = (uu, vv, z) => pt(cx, cy, u + uu, vv, z);
        poly(c, [P(-.14, -.3, 12), P(-.14, .3, 12), P(.14, .3, 18), P(.14, -.3, 18)], shade(st.roof, .95));
        poly(c, [P(.14, -.3, 18), P(.14, .3, 18), P(.14, .3, 12), P(.14, -.3, 12)], shade(st.glass, .8));
      }
      cyl(c, ...pt(cx, cy, .28, -.18, 0), .055, 12, 30, '#9a5c4c', '#3a3434'); return;
    }
    case 'station': {
      box(c, cx, cy, 0, 0, .42, .24, 0, 9, st.wall); windows(c, cx, cy, 0, 0, .42, .24, 0, 9, 1, 5, winCol(st, B));
      roofGable(c, cx, cy, 0, 0, .44, .26, 9, 7, shade(st.glass, .9), st.wall, true);
      const [kx, ky] = pt(cx, cy, .44, 0, 12); ell(c, kx, ky, 1.6, 2, '#fbf6ea'); emit(kx, ky, 5, '#fff1c9', .6);
      for (const u of [-.3, .3]) { const [lx, ly] = pt(cx, cy, u, .3, 8); emit(lx, ly, 7, LT.lampC, .6); emit(lx, ly + 7, 10, LT.lampC, .25, 1); }
      return;
    }
    case 'clinic': {
      box(c, cx, cy, 0, 0, .32, .3, 0, 13, '#f3f1ee'); windows(c, cx, cy, 0, 0, .32, .3, 0, 13, 2, 3, winCol(st, B));
      box(c, cx, cy, 0, 0, .33, .31, 13, 1.2, shade(st.trim, 1.3));
      const [kx, ky] = pt(cx, cy, -.12, .3, 9); c.fillStyle = '#e25d5d'; c.fillRect(kx - 2.5, ky - .7, 5, 1.6); c.fillRect(kx - .8, ky - 2.5, 1.6, 5);
      emit(kx, ky, 6, '#ff6a6a', .6);
      return;
    }
    case 'power': {
      box(c, cx, cy, 0, 0, .36, .28, 0, 14, st.wall); windows(c, cx, cy, 0, 0, .36, .28, 0, 14, 2, 3, winCol(st, B));
      roofGable(c, cx, cy, 0, 0, .36, .28, 14, 4, st.roof, st.wall, true);
      cyl(c, ...pt(cx, cy, -.16, -.2, 0), .06, 14, 22, '#a39a92', '#333'); cyl(c, ...pt(cx, cy, .16, -.2, 0), .06, 14, 22, '#a39a92', '#333'); return;
    }
    case 'turbine': {
      const a = pt(cx, cy, 0, 0, 0); ell(c, a[0], a[1], 3, 1.5, '#cfcac4');
      c.fillStyle = '#f2f3f5'; c.beginPath(); c.moveTo(a[0] - 1.3, a[1]); c.lineTo(a[0] - .6, a[1] - 56); c.lineTo(a[0] + .6, a[1] - 56); c.lineTo(a[0] + 1.3, a[1]); c.fill();
      box(c, cx, cy, .04, 0, .07, .035, 55, 3, '#e7e9ec'); return;
    }
    case 'mast': {
      const a = pt(cx, cy, -.18, .12, 0), b = pt(cx, cy, .18, .12, 0), d = pt(cx, cy, 0, -.2, 0), t = pt(cx, cy, 0, 0, 66);
      for (const p of [a, b, d]) line(c, p[0], p[1], t[0], t[1], '#c0584f', .9);
      for (let k = 1; k < 7; k++) { const f = k / 7; line(c, lerp(a[0], t[0], f), lerp(a[1], t[1], f), lerp(b[0], t[0], f), lerp(b[1], t[1], f), k % 2 ? '#c0584f' : '#f3efe9', .6); }
      box(c, cx, cy, .25, .2, .1, .08, 0, 4, st.wall); return;
    }
    case 'airfield': {
      flat(c, cx, cy, 0, 0, .48, .48, .3, '#b8b9bb');
      flat(c, cx, cy, 0, .08, .48, .13, .5, '#707378');
      for (let k = 0; k < 4; k++) flat(c, cx, cy, -.36 + k * .24, .08, .06, .015, .7, '#f5f5f0');
      for (let k = 0; k < 6; k++) for (const v of [-.04, .2]) { const [lx, ly] = pt(cx, cy, -.44 + k * .176, v, .8); emit(lx, ly, 2.6, k % 5 ? '#bfe0ff' : '#9dff9d', .8); }
      box(c, cx, cy, .3, -.3, .07, .07, 0, 12, st.wall); box(c, cx, cy, .3, -.3, .09, .09, 12, 3, st.glass);
      { const [tx, ty] = pt(cx, cy, .3, -.3, 13.5); emit(tx, ty, 6, '#bfe8ff', .7); }
      box(c, cx, cy, -.26, -.28, .16, .12, 0, 5, shade(st.roof, 1.1)); return;
    }
    case 'university': {
      box(c, cx, cy, 0, 0, .44, .36, 0, 16, st.wall); windows(c, cx, cy, 0, 0, .44, .36, 0, 16, 3, 5, winCol(st, B));
      for (let k = 0; k < 5; k++) box(c, cx, cy, -.3 + k * .15, .38, .03, .03, 0, 14, shade(st.wall, 1.1));
      box(c, cx, cy, 0, 0, .45, .37, 16, 1.4, shade(st.trim, 1.2));
      dome(c, cx, cy, .19, 17, 13, st.roof); return;
    }
    case 'antenna': {
      box(c, cx, cy, 0, 0, .2, .2, 0, 8, st.wall);
      const a = pt(cx, cy, 0, 0, 8), t = pt(cx, cy, 0, 0, 46); line(c, a[0], a[1], t[0], t[1], '#b9c0c9', 1.4);
      c.save(); c.translate(t[0] - 1, t[1] + 8); c.rotate(-.5); ell(c, 0, 0, 6, 3, '#e9edf2'); ell(c, .5, -.2, 4, 2, '#cfd6de'); c.restore(); return;
    }
    case 'solar': {
      flat(c, cx, cy, 0, 0, .46, .46, .2, '#c7c3b5');
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const u = -.3 + a * .3, vv = -.3 + b * .3, P = (uu, ww, z) => pt(cx, cy, u + uu, vv + ww, z);
        poly(c, [P(-.12, -.1, 3), P(.12, -.1, 3), P(.12, .1, 1), P(-.12, .1, 1)], '#2f4e7a');
        poly(c, [P(-.1, -.08, 2.8), P(0, -.08, 2.8), P(0, .02, 1.8), P(-.1, .02, 1.8)], '#5d86b8');
      }
      return;
    }
    case 'vfarm': {
      box(c, cx, cy, 0, 0, .34, .34, 0, 30, st.glass);
      for (let k = 1; k < 5; k++) { box(c, cx, cy, 0, 0, .345, .345, k * 6, 1.3, '#6fbf73'); for (const [u, v] of [[0, .345], [.345, 0]]) { const [lx, ly] = pt(cx, cy, u, v, k * 6 - 2.5); emit(lx, ly, 8, '#ff7ad9', .45); } }
      dome(c, cx, cy, .3, 30, 9, '#bfe8c4', .85);
      parkTree(c, cx, cy, 0, 0, .1); return;
    }
    case 'park': {
      if (dsRound()) {
        flat(c, cx, cy, 0, 0, .47, .47, .2, '#a4dfa9');
        c.strokeStyle = topC(shade('#eadbc1', LT.fG)); c.lineWidth = 1.6; c.beginPath(); c.ellipse(cx, cy - .35, .3 * 22.6, .3 * 11.3, 0, 0, TAU); c.stroke();
        cyl(c, cx, cy, .1, 0, 1.5, '#d8d2c8', '#7fc7de');
        for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + v; parkTree(c, cx, cy, Math.cos(a) * .38, Math.sin(a) * .38, v + k * .21); }
        return;
      }
      flat(c, cx, cy, 0, 0, .47, .47, .2, '#a4dfa9');
      flat(c, cx, cy, 0, 0, .47, .06, .35, '#eadbc1'); flat(c, cx, cy, 0, 0, .06, .47, .35, '#eadbc1');
      cyl(c, cx, cy, .1, 0, 1.5, '#d8d2c8', '#7fc7de');
      parkTree(c, cx, cy, -.26, -.26, v); parkTree(c, cx, cy, .26, -.24, v + .3); parkTree(c, cx, cy, -.25, .26, v + .6); parkTree(c, cx, cy, .27, .26, v + .9);
      return;
    }
    case 'stadium': {
      cyl(c, cx, cy, .45, 0, 7, st.wall, shade(st.accent, 1.1));
      ell(c, cx, cy - 7, .34 * 22.6, .34 * 11.3, shade('#7cc47f', LT.fG)); ell(c, cx, cy - 7, .2 * 22.6, .2 * 11.3, shade('#86cc88', LT.fG));
      if (hasTech('electric')) for (const [u, v] of [[-.42, -.42], [.42, -.42], [.42, .42], [-.42, .42]]) { const [a, b] = pt(cx, cy, u, v, 0); line(c, a, b, a, b - 18, '#8a8f99', .7); c.fillStyle = '#f2f4f7'; c.fillRect(a - 1.4, b - 19.5, 2.8, 1.4); emit(a, b - 18.8, 9, '#f4f8ff', .8); }
      emit(cx, cy - 7, 20, '#f4f8ff', hasTech('electric') ? .3 : 0, 1);
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = .5; c.beginPath(); c.moveTo(cx, cy - 7 - 3.8); c.lineTo(cx, cy - 7 + 3.8); c.stroke(); return;
    }
    case 'museum': {
      box(c, cx, cy, 0, 0, .4, .34, 0, 12, st.wall); windows(c, cx, cy, 0, 0, .4, .34, 0, 12, 1, 4, winCol(st, B));
      roofPyr(c, cx, cy, 0, 0, .22, .22, 12, 12, st.glass); return;
    }
    case 'launchpad': {
      flat(c, cx, cy, 0, 0, .47, .47, .3, '#bfbdb8'); ell(c, cx, cy, 10, 5, 'rgba(60,55,50,.25)');
      const g0 = pt(cx, cy, .22, -.22, 0);
      for (const du of [-2, 2]) line(c, g0[0] + du, g0[1], g0[0] + du, g0[1] - 62, '#c8553d', 1.2);
      for (let k = 1; k < 10; k++) line(c, g0[0] - 2, g0[1] - k * 6, g0[0] + 2, g0[1] - k * 6 - 3, '#c8553d', .5);
      if (B.rk !== 0) { cyl(c, cx, cy, .08, 1, 46, '#f4f4f2'); cone(c, cx, cy - 47, .08, 9, st.accent); box(c, cx, cy, 0, .075, .02, .01, 24, 6, '#333'); }
      emit(g0[0], g0[1] - 63, 4, '#ff4d4d', .9); emit(cx, cy - 10, 16, '#fff3dc', .45); emit(cx, cy, 20, '#fff3dc', .28, 1);
      return;
    }
    case 'fusion': {
      box(c, cx, cy, 0, 0, .42, .42, 0, 6, st.wall);
      dome(c, cx, cy, .34, 6, 20, shade(st.wall, 1.02));
      c.strokeStyle = rgba(st.accent, .9); c.lineWidth = 1.4; c.beginPath(); c.ellipse(cx, cy - 12, .36 * 22.6, .36 * 11.3 * .7, 0, 0, Math.PI); c.stroke();
      emit(cx, cy - 14, 18, '#7fe8e0', .5); return;
    }
    case 'terraformer': {
      cyl(c, cx, cy, .14, 0, 58, st.wall); cyl(c, cx, cy, .24, 58, 10, shade(st.wall, 1.02), shade(st.accent, 1.1));
      for (let k = 1; k < 6; k++) { const a = pt(cx, cy, 0, 0, k * 10); ell(c, a[0], a[1], 3.3, 1.6, rgba(st.accent, .5)); emit(a[0], a[1], 7, '#9ff0ea', .5); }
      return;
    }
    case 'dome': {
      cyl(c, cx, cy, .42, 0, 2, st.wall, '#9fd9a4');
      parkTree(c, cx, cy, -.12, -.1, v); parkTree(c, cx, cy, .12, .06, v + .5);
      dome(c, cx, cy, .42, 2, 22, st.glass, .42);
      emit(cx, cy - 8, 20, '#c8f7cf', .35);
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = .5; c.beginPath(); c.ellipse(cx, cy - 2, .42 * 22.6, 22, 0, Math.PI, TAU); c.stroke();
      c.beginPath(); c.ellipse(cx, cy - 2, .2 * 22.6, 22, 0, Math.PI, TAU); c.stroke(); return;
    }
    case 'elevator': {
      box(c, cx, cy, 0, 0, .46, .46, 0, 10, st.wall); windows(c, cx, cy, 0, 0, .46, .46, 0, 10, 1, 5, st.glass);
      box(c, cx, cy, 0, 0, .3, .3, 10, 22, shade(st.wall, 1.03)); windows(c, cx, cy, 0, 0, .3, .3, 10, 22, 3, 3, st.glass);
      box(c, cx, cy, 0, 0, .14, .14, 32, 40, shade(st.wall, 1.06));
      box(c, cx, cy, 0, 0, .16, .16, 72, 3, st.accent);
      { const [tx, ty] = pt(cx, cy, 0, 0, 74); emit(tx, ty, 12, '#bff3ff', .7); } return;
    }
    case 'monument': return drawMonument(c, B, cx, cy, st);
    default: box(c, cx, cy, 0, 0, .3, .3, 0, 8, st.wall);
  }
}

/* ---------- where the materials come from ---------- */
function logPile(c, cx, cy, u, v, n, col) {
  const [px, py] = pt(cx, cy, u, v, 0);
  for (let r = 0; r < n; r++) for (let k = 0; k < n - r; k++) {
    const x = px + k * 2.3 + r * 1.15 - n * 1.1, y = py - 1.1 - r * 1.9 + k * .15;
    c.fillStyle = shade(col, LT.fL * .92); c.fillRect(x - 5.2, y - 1.05, 5.2, 2.1);
    circ(c, x, y, 1.05, topC(shade('#d9b88a', LT.fR))); circ(c, x, y, .45, shade('#b08a5e', LT.fR));
  }
}
function drawLumber(c, B, cx, cy, st, i) {
  const v = B.var || 0;
  flat(c, cx, cy, .05, .1, .34, .3, .25, '#d7c09a'); // sawdust and trodden earth
  const wall = mix(st.wall, '#a8784e', .7), sv = DM; DM = 'wood';
  box(c, cx, cy, -.16, -.16, .17, .13, 0, 6.5, wall);
  DM = sv;
  door(c, cx, cy, -.22, -.16, .13, .07, 4, '#5a4436');
  roofGable(c, cx, cy, -.16, -.16, .19, .15, 6.5, 4.5, mix(st.roof, '#7d5a3e', .6), wall, true);
  box(c, cx, cy, -.04, -.26, .03, .03, 7, 5, '#7a6a5e');
  logPile(c, cx, cy, .22, .12, 3, '#8f6440');
  // chopping block with the axe in it
  cyl(c, ...pt(cx, cy, -.2, .24, 0), .06, 0, 2, '#8a6446', '#d8b98a');
  const [ax, ay] = pt(cx, cy, -.2, .24, 2); line(c, ax, ay, ax + 1.6, ay - 3.2, '#6b5040', .5); poly(c, [[ax - .3, ay + .2], [ax + 1, ay - .4], [ax + .4, ay + 1]], '#9aa3ad');
  if (v > .4) { const [sx, sy] = pt(cx, cy, .28, -.22, 0); line(c, sx - 2, sy, sx + 2, sy - 1, '#8a6446', .8); line(c, sx - 1.4, sy + .6, sx - 1.4, sy - 1.6, '#6b5040', .5); line(c, sx + 1.4, sy - .4, sx + 1.4, sy - 2.6, '#6b5040', .5); }
  if (hasTech('steam')) { box(c, cx, cy, .2, -.18, .1, .08, 0, 4, '#8f8a86'); const [kx, ky] = pt(cx, cy, .2, -.18, 7); emit(kx, ky, 4, '#ffcf8a', .4); }
}
function stoneCol(i) { const b = M.bio[i]; return b === BIO.ROCK ? '#bdb6cf' : b === BIO.HIGH ? '#dcc39c' : b === BIO.SNOW ? '#d8d7e2' : '#cfc8bb'; }
function pit(c, cx, cy, hw, hd, depth, rim, wall, floor, steps) {
  const P = (u, v, z) => pt(cx, cy, u, v, z);
  const o = [P(-hw, -hd, .3), P(hw, -hd, .3), P(hw, hd, .3), P(-hw, hd, .3)];
  poly(c, [P(-hw - .06, -hd - .06, .3), P(hw + .06, -hd - .06, .3), P(hw + .06, hd + .06, .3), P(-hw - .06, hd + .06, .3)], topC(shade(rim, LT.fG)));
  c.save(); c.beginPath(); c.moveTo(o[0][0], o[0][1]); for (const q of o) c.lineTo(q[0], q[1]); c.closePath(); c.clip();
  poly(c, [P(-hw, -hd, -depth), P(hw, -hd, -depth), P(hw, hd, -depth), P(-hw, hd, -depth)], shade(floor, LT.fG * .82));
  for (let k = 0; k < steps; k++) { // terraces cut into the far walls
    const z1 = -depth * k / steps, z0 = -depth * (k + 1) / steps, in_ = k * .07;
    poly(c, [P(-hw + in_, -hd + in_, z1), P(-hw + in_, hd, z1), P(-hw + in_, hd, z0), P(-hw + in_, -hd + in_, z0)], shade(wall, LT.fR * .88));
    poly(c, [P(-hw + in_, -hd + in_, z1), P(hw, -hd + in_, z1), P(hw, -hd + in_, z0), P(-hw + in_, -hd + in_, z0)], shade(wall, LT.fL * .9));
    if (k < steps - 1) { const n = (k + 1) * .07; poly(c, [P(-hw + in_, -hd + in_, z0), P(hw, -hd + in_, z0), P(hw, -hd + n, z0), P(-hw + n, -hd + n, z0), P(-hw + n, hd, z0), P(-hw + in_, hd, z0)], topC(shade(wall, LT.fT * .95))); }
  }
  c.restore();
}
function drawQuarry(c, B, cx, cy, i) {
  const sc = stoneCol(i), v = B.var || 0;
  pit(c, cx, cy, .36, .34, 9, shade(sc, 1.03), sc, shade(sc, .9), 3);
  for (const [u, w] of [[.12, .14], [.22, .02]]) { const [bx, by] = pt(cx, cy, u, w, -9); c.fillStyle = shade(sc, LT.fL * 1.05); c.fillRect(bx - 2, by - 1.6, 4, 1.6); c.fillStyle = topC(shade(sc, LT.fT * 1.08)); c.fillRect(bx - 2, by - 2.4, 4, .8); }
  // cut blocks waiting to be carted off
  for (const [u, w, z] of [[.36, .12, 0], [.36, .26, 0], [.36, .19, 2.2], [.2, .38, 0]]) box(c, cx, cy, u, w, .055, .05, z, 2.2, shade(sc, 1.04));
  // a wooden derrick over the pit
  const a = pt(cx, cy, -.34, .3, 0), t = pt(cx, cy, -.34, .3, 17), e = pt(cx, cy, .02 + v * .1, -.05, 12);
  line(c, a[0] - 1.5, a[1], t[0], t[1], '#7a5a44', .9); line(c, a[0] + 1.5, a[1] + .5, t[0], t[1], '#7a5a44', .9);
  line(c, t[0], t[1] + 4, e[0], e[1], '#8a6446', .8); line(c, t[0], t[1], e[0], e[1], 'rgba(90,70,55,.7)', .3);
  line(c, e[0], e[1], e[0], e[1] + 9, 'rgba(70,60,50,.8)', .3); c.fillStyle = shade(sc, .95); c.fillRect(e[0] - 1.4, e[1] + 9, 2.8, 1.8);
  if (hasTech('steam')) { box(c, cx, cy, -.38, -.34, .08, .07, 0, 3.5, '#8f8a86'); }
}
function drawClaypit(c, B, cx, cy, i) {
  const clay = '#b8664a', v = B.var || 0;
  pit(c, cx, cy, .22, .2, 3, '#caa27c', '#a85c44', clay, 1);
  const [wx, wy] = pt(cx, cy, -.08, -.05, -3); ell(c, wx, wy, 3.2, 1.4, topC(shade('#7fb2c4', LT.fG * .9)));
  // rows of bricks drying in the sun
  for (let r = 0; r < 2; r++) for (let k = 0; k < 4; k++) box(c, cx, cy, -.3 + k * .09, .32 + r * .08, .03, .02, 0, 1.2, r ? '#c9795c' : '#d68b6a');
  // the kiln
  const bottle = hasTech('brick'), [kx, ky] = pt(cx, cy, .3, -.2, 0);
  if (bottle) { cyl(c, kx, ky, .13, 0, 6, '#b06a52'); cone(c, kx, ky - 6, .13, 7, '#a25f49'); cyl(c, kx, ky, .04, 13, 2, '#8a4f3e'); }
  else { dome(c, kx, ky, .15, 0, 7, '#b27058'); }
  const [dx, dy] = pt(cx, cy, .3, -.07, 1.5); ell(c, dx, dy, 1.1, 1.3, LT.lit ? '#ffb45e' : '#5a3a30'); emit(dx, dy, 5, '#ff9a45', .7);
  if (v > .5) { const [px, py] = pt(cx, cy, .05, .25, 0); for (let k = 0; k < 3; k++) circ(c, px + k * 2.2, py - 1.2, 1.1, shade('#c98a66', .9 + k * .05)); }
}

/* ---------- the harbour: quay, warehouse, crane base, cargo; the crane's jib swings in the animated layer ---------- */
function drawHarbour(c, B, cx, cy, st, i) {
  const d = B.dir || [1, 0], al = [-d[1], d[0]], hp = (a, o) => [a * al[0] + o * d[0], a * al[1] + o * d[1]];
  const ext = (ea, eo) => [Math.abs(al[0]) * ea + Math.abs(d[0]) * eo, Math.abs(al[1]) * ea + Math.abs(d[1]) * eo];
  const steel = hasTech('steam'), boxes = hasTech('computing');
  flat(c, cx, cy, 0, 0, .47, .47, .3, B.style >= 3 ? '#cdc5b6' : '#bfa98a');
  { const [u, v] = hp(0, .45), [hw, hd] = ext(.47, .03); box(c, cx, cy, u, v, hw, hd, 0, 1.3, '#b3aa9b'); } // the quay edge
  for (const a of [-.32, 0, .32]) { const [u, v] = hp(a, .38); cyl(c, ...pt(cx, cy, u, v, 0), .025, .3, 1.6, '#4a4a52'); }
  // warehouse along the back
  { const [u, v] = hp(0, -.2), [hw, hd] = ext(.36, .15), h = steel ? 10 : 8, wall = hasTech('brick') ? '#b8684f' : B.mat ? MAT[B.mat].wall : st.wall;
    const sv = DM; DM = hasTech('brick') ? 'brick' : B.mat || null; box(c, cx, cy, u, v, hw, hd, 0, h, wall); DM = sv;
    windows(c, cx, cy, u, v, hw, hd, 0, h, 1, 3, winCol(st, B));
    roofGable(c, cx, cy, u, v, hw, hd, h, 5, steel ? '#5d6670' : st.roof, wall, Math.abs(al[0]) > 0); }
  // crane tower
  { const [u, v] = hp(.26, .2); box(c, cx, cy, u, v, .045, .045, 0, steel ? 11 : 8, steel ? '#d6703a' : '#8a6446'); }
  // cargo on the quay
  if (boxes) { const cols = ['#c0584f', '#3f7fb0', '#e0a43a', '#4e9a6a']; let n = 0; for (const [a, o] of [[-.3, .14], [-.14, .14], [-.3, .26]]) for (let lay = 0; lay < 2; lay++) { const [u, v] = hp(a, o), [hw, hd] = ext(.07, .05); box(c, cx, cy, u, v, hw, hd, lay * 2.4, 2.4, cols[(n++ + B.id) % 4]); } }
  else { for (const [a, o, col] of [[-.3, .16, '#a57c55'], [-.18, .2, '#b8905e'], [-.3, .28, '#9b7657']]) { const [u, v] = hp(a, o); box(c, cx, cy, u, v, .04, .04, 0, 2.6, col); } const [u, v] = hp(-.08, .1); cyl(c, ...pt(cx, cy, u, v, 0), .035, .3, 2.6, '#8a6446'); }
  { const [u, v] = hp(.42, .34), [lx, ly] = pt(cx, cy, u, v, 0); line(c, lx, ly, lx, ly - 8, '#4c4f58', .7); circ(c, lx, ly - 8.3, .9, LT.lit ? '#fff3d0' : '#e8e2cf'); emit(lx, ly - 8, 7, LT.lampC, .8); emit(lx, ly, 12, LT.lampC, .3, 1); }
}
function drawLighthouse(c, B, cx, cy, st) {
  ell(c, cx + 1, cy, 9, 4.5, 'rgba(70,60,80,.18)'); ell(c, cx, cy - .5, 8, 4, '#b9b3c8'); ell(c, cx - 1.5, cy - 1.2, 4, 2, '#cfc9dc');
  box(c, cx, cy, .22, .2, .1, .08, 0, 4, '#ece6da'); roofGable(c, cx, cy, .22, .2, .1, .08, 4, 3, '#c0584f', '#ece6da', true); // the keeper's cottage
  const rs = [.12, .11, .1, .09];
  for (let k = 0; k < 4; k++) cyl(c, cx, cy, rs[k], k * 9, 9, k % 2 ? '#c0584f' : '#f4f1ea');
  cyl(c, cx, cy, .115, 36, 1.2, '#3a3f4a');
  cyl(c, cx, cy, .07, 37.2, 5, LT.lit ? '#fff3c4' : '#cfe6ee', LT.lit ? '#fff3c4' : '#cfe6ee');
  cone(c, cx, cy - 42.2, .09, 5, '#c0584f');
  emit(cx, cy - 39.7, 8, '#fff3cf', .9);
}

function parkTree(c, cx, cy, u, v, h) {
  const [px, py] = pt(cx, cy, u, v, 0);
  ell(c, px + 1, py + .4, 3.3, 1.5, 'rgba(40,50,70,.13)');
  c.fillStyle = '#7b5e4e'; c.fillRect(px - .5, py - 5, 1, 5);
  const col = ['#6db873', '#a57ac6', '#ee92b6', '#83c886'][((h * 7) | 0) % 4];
  circ(c, px, py - 7.5, 3.4, leafC(col, .85)); circ(c, px + .75 * LT.hx, py - 8.2, 2.6, topC(leafC(col)));
}

function drawPod(c, B, cx, cy) {
  ell(c, cx + 1, cy, 15, 7, 'rgba(70,55,50,.22)');
  const age = S.year;
  if (age > 250) { // fence of honour
    for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; const px = cx + Math.cos(a) * 14, py = cy + Math.sin(a) * 7; line(c, px, py, px, py - 3.5, '#8a6d57', .8); }
  }
  c.save(); c.translate(cx, cy - 5); c.rotate(-.32);
  const g = c.createLinearGradient(0, -5, 0, 5); g.addColorStop(0, '#f6f7fa'); g.addColorStop(1, '#a9afbd');
  c.fillStyle = g; c.beginPath(); c.moveTo(-10, -4.5); c.lineTo(7, -4.5); c.quadraticCurveTo(12, -4.5, 12, 0); c.quadraticCurveTo(12, 4.5, 7, 4.5); c.lineTo(-10, 4.5); c.quadraticCurveTo(-12, 0, -10, -4.5); c.fill();
  c.fillStyle = '#e5874f'; c.fillRect(-3, -4.5, 2.4, 9);
  c.fillStyle = LT.lit ? '#bff0ff' : '#7fcde6'; c.beginPath(); c.ellipse(6, -1, 2.4, 1.7, 0, 0, TAU); c.fill();
  c.fillStyle = '#5b6170'; c.fillRect(-10.5, -3, 1.4, 6);
  if (age > 120) { c.fillStyle = 'rgba(111,174,106,.75)'; c.beginPath(); c.ellipse(-6, 3.2, 4, 1.6, 0, 0, TAU); c.fill(); c.beginPath(); c.ellipse(3, 3.6, 3, 1.2, 0, 0, TAU); c.fill(); }
  if (age > 600) { c.fillStyle = 'rgba(111,174,106,.8)'; c.beginPath(); c.ellipse(-2, -4, 4, 1.4, 0, 0, TAU); c.fill(); circ(c, -7, -4.2, .9, '#ee92b6'); }
  c.restore();
  emit(cx + 5.4, cy - 7.8, 8, '#8fe3ff', .8); emit(cx + 4, cy, 12, '#8fe3ff', .25, 1);
}

const SHAPE_HM = { tall: 1.45, low: .7 }, SHAPE_WM = { tall: .86, low: 1.12 };
function tieredBody(c, cx, cy, hw, hd, h, st, wc, glass) {
  const n = h > 26 ? 3 : 2; let z = 0, w = hw, d = hd;
  for (let k = 0; k < n; k++) {
    const hh = h / n;
    box(c, cx, cy, 0, 0, w, d, z, hh, glass && k % 2 ? st.glass : st.wall);
    windows(c, cx, cy, 0, 0, w, d, z, hh, Math.max(1, Math.round(hh / 6.5)), w > .3 ? 3 : 2, wc);
    z += hh;
    if (k < n - 1) { box(c, cx, cy, 0, 0, w + .01, d + .01, z, 1, '#7cc47f'); w *= .76; d *= .76; z += 1; }
  }
  return [z, w, d];
}
function drawHouse(c, B, cx, cy, st) {
  const t = B.tier, v = B.var || 0, au = v < .5, wc = winCol(st, B);
  const u0 = (v - .5) * .08, v0 = ((v * 7) % 1 - .5) * .08;
  if (t <= 1 && DS) { const sv = DS; DS = null; try { drawHouse(c, B, cx, cy, st); } finally { DS = sv; } return; }
  const shp = st.shape, hm = SHAPE_HM[shp] || 1, wm = SHAPE_WM[shp] || 1;
  if (shp === 'tiered' && t >= 3 && t <= 6) {
    const hw = [0, 0, 0, .34, .4, .4, .38][t], H0 = [0, 0, 0, 16, 22, 34 + ((v * 3) % 1) * 20, 60 + ((v * 5) % 1) * 50][t];
    const [z, w, d] = tieredBody(c, cx, cy, hw, hw, H0, st, wc, t === 6);
    door(c, cx, cy, -.1, 0, hw, .09, 4.4, shade(st.trim, .9));
    roofPyr(c, cx, cy, 0, 0, w, d, z, t >= 5 ? 5 : 6, st.roof);
    return;
  }
  if (t === 6 && dsRound()) {
    const h = (58 + ((v * 5) % 1) * 62) * hm, r = .33 * wm;
    cyl(c, cx, cy, r, 0, h * .82, st.glass);
    c.strokeStyle = rgba(st.trim, .4); c.lineWidth = .5;
    for (let z = 8; z < h * .82; z += 8) { c.beginPath(); c.ellipse(cx, cy - z, r * 22.6, r * 11.3, 0, 0, Math.PI); c.stroke(); }
    if (LT.lit) cylWindows(c, cx, cy, 0, 0, r + .004, 0, h * .82, Math.floor(h * .82 / 8), 5, st.glass, true);
    cyl(c, cx, cy, r * .78, h * .82, h * .18, shade(st.glass, 1.06));
    if (st.roofK === 'dome') dome(c, cx, cy, r * .78, h, 9, st.roof); else if (st.roofK === 'garden') { cyl(c, cx, cy, r * .8, h, 1, '#7cc47f'); parkTree(c, cx, cy - h - 1, 0, 0, v); }
    const t0 = pt(cx, cy, 0, 0, h); line(c, t0[0], t0[1], t0[0], t0[1] - 12, '#9aa3ad', .8);
    if (h > 90) emit(t0[0], t0[1] - 12, 4, '#ff5a5a', .9);
    return;
  }
  if (hm !== 1 && t >= 2 && t <= 6) return drawHouseScaled(c, B, cx, cy, st, hm, wm, u0, v0, wc);
  switch (t) {
    case 0: {
      const col = v < .5 ? '#e89f6b' : '#d9dde6';
      roofPyr(c, cx, cy, u0, v0, .24, .2, 0, 10, col);
      door(c, cx, cy, u0, v0, .2, .08, 4, '#5b4a42'); return;
    }
    case 1: {
      cyl(c, cx + u0 * 16, cy, .24, 0, 5, st.wall);
      door(c, cx + u0 * 16, cy, 0, 0, .23, .08, 4, '#5b4a42');
      cone(c, cx + u0 * 16, cy - 5, .31, 10, st.roof); return;
    }
    case 2: {
      const hw = au ? .3 : .22, hd = au ? .22 : .3;
      box(c, cx, cy, u0, v0, hw, hd, 0, 7, st.wall);
      door(c, cx, cy, u0 - hw * .3, v0, hd, .09, 4.4, shade(st.trim, .9));
      windows(c, cx, cy, u0, v0, hw, hd, 0, 7, 1, 2, wc);
      roofGable(c, cx, cy, u0, v0, hw, hd, 7, 6, st.roof, st.wall, au);
      if (v > .3) box(c, cx, cy, u0 + hw * .5, v0 - hd * .4, .04, .04, 9, 6, '#8f6f62');
      return;
    }
    case 3: {
      const hw = .32, hd = .28;
      box(c, cx, cy, 0, 0, hw, hd, 0, 13, st.wall); windows(c, cx, cy, 0, 0, hw, hd, 0, 13, 2, 3, wc);
      door(c, cx, cy, -.1, 0, hd, .09, 4.4, shade(st.trim, .9));
      if (v < .5) roofPyr(c, cx, cy, 0, 0, hw, hd, 13, 7, st.roof); else roofGable(c, cx, cy, 0, 0, hw, hd, 13, 7, st.roof, st.wall, v < .75);
      return;
    }
    case 4: {
      const hw = .38, hd = .36;
      box(c, cx, cy, 0, 0, hw, hd, 0, 19, st.wall); windows(c, cx, cy, 0, 0, hw, hd, 0, 19, 3, 3, wc);
      box(c, cx, cy, 0, 0, hw + .02, hd + .02, 19, 1.5, shade(st.trim, 1.25));
      box(c, cx, cy, 0, hd + .02, hw, .03, 7, .8, st.accent);
      if (v > .5) { box(c, cx, cy, -.15, -.1, .08, .08, 20.5, 5, shade(st.wall, .95)); }
      else roofGable(c, cx, cy, 0, 0, hw, hd, 20.5, 5, st.roof, st.wall, true);
      return;
    }
    case 5: {
      const kind = Math.floor(((v * 13) % 1) * 4);
      const h = 30 + ((v * 3) % 1) * 22, hw = .31 + ((v * 7) % 1) * .07, hd = .31 + ((v * 11) % 1) * .07;
      const wall = kind === 3 ? mix(st.wall, st.accent, .22) : kind === 1 ? mix(st.wall, st.roof, .12) : st.wall;
      box(c, cx, cy, 0, 0, hw, hd, 0, h, wall); windows(c, cx, cy, 0, 0, hw, hd, 0, h, Math.round(h / 6), 4, wc);
      if (kind === 0) { // flat roof, stair box and water tank
        box(c, cx, cy, 0, 0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.2));
        box(c, cx, cy, -.12, -.12, .1, .08, h + 1.4, 4, shade(wall, .92));
        cyl(c, ...pt(cx, cy, .15, -.1, 0), .05, h + 1.4, 5, '#8a7d73');
      } else if (kind === 1) { // mansard roof
        roofPyr(c, cx, cy, 0, 0, hw + .02, hd + .02, h, 7, st.roof);
        box(c, cx, cy, .12, -.08, .05, .05, h + 3, 6, shade(st.trim, 1.1));
      } else if (kind === 2) { // setback penthouse
        box(c, cx, cy, 0, 0, hw + .015, hd + .015, h, 1.2, shade(st.trim, 1.2));
        box(c, cx, cy, -.06, -.06, hw * .6, hd * .6, h + 1.2, 6, shade(wall, 1.05)); windows(c, cx, cy, -.06, -.06, hw * .6, hd * .6, h + 1.2, 6, 1, 2, wc);
        parkTree(c, cx, cy, .2, .2, v);
      } else { // balconies
        for (let z = 8; z < h - 2; z += 6) box(c, cx, cy, 0, hd + .015, hw * .9, .03, z, 1, st.accent);
        box(c, cx, cy, 0, 0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.2));
      }
      return;
    }
    case 6: {
      const h = 58 + ((v * 5) % 1) * 62, hw = .33, hd = .33;
      box(c, cx, cy, 0, 0, hw, hd, 0, h * .82, st.glass);
      box(c, cx, cy, 0, 0, hw * .78, hd * .78, h * .82, h * .18, shade(st.glass, 1.06));
      // mullions
      c.strokeStyle = rgba(st.trim, .45); c.lineWidth = .5;
      for (let k = 1; k < 4; k++) {
        const f = k / 4;
        let a = pt(cx, cy, -hw + f * hw * 2, hd, 0), b = pt(cx, cy, -hw + f * hw * 2, hd, h * .82); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
        a = pt(cx, cy, hw, hd - f * hd * 2, 0); b = pt(cx, cy, hw, hd - f * hd * 2, h * .82); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
      }
      for (let z = 8; z < h * .82; z += 8) { const a = pt(cx, cy, -hw, hd, z), b = pt(cx, cy, hw, hd, z), d = pt(cx, cy, hw, -hd, z); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.stroke(); }
      if (LT.lit) windows(c, cx, cy, 0, 0, hw, hd, 0, h * .82, Math.floor(h * .82 / 8), 4, st.glass, null, true);
      box(c, cx, cy, 0, 0, hw * .8, hd * .8, h * .82 - .5, 1, st.wall);
      const t0 = pt(cx, cy, 0, 0, h); line(c, t0[0], t0[1], t0[0], t0[1] - 12, '#9aa3ad', .8);
      if (h > 90) emit(t0[0], t0[1] - 12, 4, '#ff5a5a', .9);
      return;
    }
    default: { // arcology
      let z = 0; const tiers = 4;
      for (let k = 0; k < tiers; k++) {
        const hw = .47 - k * .09, hh = 34 + ((v * (k + 2)) % 1) * 10;
        box(c, cx, cy, 0, 0, hw, hw, z, hh, k % 2 ? st.wall : st.glass);
        windows(c, cx, cy, 0, 0, hw, hw, z, hh, Math.round(hh / 7), 4, k % 2 ? st.glass : shade(st.glass, .8));
        box(c, cx, cy, 0, 0, hw + .01, hw + .01, z + hh, 1.2, '#7cc47f');
        z += hh + 1.2;
      }
      const t0 = pt(cx, cy, 0, 0, z); line(c, t0[0], t0[1], t0[0], t0[1] - 14, st.accent, 1.2); circ(c, t0[0], t0[1] - 14, 1.3, st.accent);
      emit(t0[0], t0[1] - 14, 6, '#ff6a6a', .8);
    }
  }
}

function drawHouseScaled(c, B, cx, cy, st, hm, wm, u0, v0, wc) { // tall and low styles
  const t = B.tier, v = B.var || 0, au = v < .5, S_ = x => Math.min(.46, x * wm);
  if (t === 2) {
    const hw = S_(au ? .3 : .22), hd = S_(au ? .22 : .3), h = 7 * hm;
    box(c, cx, cy, u0, v0, hw, hd, 0, h, st.wall); door(c, cx, cy, u0 - hw * .3, v0, hd, .09, 4.4, shade(st.trim, .9));
    windows(c, cx, cy, u0, v0, hw, hd, 0, h, Math.max(1, Math.round(h / 7)), 2, wc); roofGable(c, cx, cy, u0, v0, hw, hd, h, 6, st.roof, st.wall, au); return;
  }
  if (t === 3) {
    const hw = S_(.32), hd = S_(.28), h = 13 * hm;
    box(c, cx, cy, 0, 0, hw, hd, 0, h, st.wall); windows(c, cx, cy, 0, 0, hw, hd, 0, h, Math.max(1, Math.round(h / 6.5)), 3, wc);
    door(c, cx, cy, -.1, 0, hd, .09, 4.4, shade(st.trim, .9));
    if (v < .5) roofPyr(c, cx, cy, 0, 0, hw, hd, h, 7, st.roof); else roofGable(c, cx, cy, 0, 0, hw, hd, h, 7, st.roof, st.wall, v < .75); return;
  }
  if (t === 4) {
    const hw = S_(.38), hd = S_(.36), h = 19 * hm;
    box(c, cx, cy, 0, 0, hw, hd, 0, h, st.wall); windows(c, cx, cy, 0, 0, hw, hd, 0, h, Math.max(1, Math.round(h / 6.3)), 3, wc);
    box(c, cx, cy, 0, 0, hw + .02, hd + .02, h, 1.5, shade(st.trim, 1.25)); box(c, cx, cy, 0, hd + .02, hw, .03, 7, .8, st.accent);
    roofGable(c, cx, cy, 0, 0, hw, hd, h + 1.5, 5, st.roof, st.wall, true); return;
  }
  if (t === 5) {
    const h = (30 + ((v * 3) % 1) * 22) * hm, hw = S_(.31 + ((v * 7) % 1) * .07), hd = S_(.31 + ((v * 11) % 1) * .07);
    box(c, cx, cy, 0, 0, hw, hd, 0, h, st.wall); windows(c, cx, cy, 0, 0, hw, hd, 0, h, Math.max(1, Math.round(h / 6)), 4, wc);
    if (st.roofK) roofPyr(c, cx, cy, 0, 0, hw, hd, h, 6, st.roof);
    else { box(c, cx, cy, 0, 0, hw + .015, hd + .015, h, 1.4, shade(st.trim, 1.2)); box(c, cx, cy, -.12, -.12, .1, .08, h + 1.4, 4, shade(st.wall, .92)); }
    return;
  }
  const h = (58 + ((v * 5) % 1) * 62) * hm, hw = S_(.33);
  box(c, cx, cy, 0, 0, hw, hw, 0, h * .82, st.glass);
  if (LT.lit) windows(c, cx, cy, 0, 0, hw, hw, 0, h * .82, Math.floor(h * .82 / 8), 4, st.glass, null, true);
  box(c, cx, cy, 0, 0, hw * .78, hw * .78, h * .82, h * .18, shade(st.glass, 1.06));
  if (st.roofK) roofPyr(c, cx, cy, 0, 0, hw * .78, hw * .78, h, 6, st.roof);
  const t0 = pt(cx, cy, 0, 0, h); line(c, t0[0], t0[1], t0[0], t0[1] - 12, '#9aa3ad', .8);
  if (h > 90) emit(t0[0], t0[1] - 12, 4, '#ff5a5a', .9);
}

function drawFarm(c, B, cx, cy, i) {
  const T = S.T[B.sid], st = S.styles[B.style] || STYLES0[0], fk = st.fields || (dsRound() ? 'round' : null);
  const crop = T ? CROPS[T.crop % CROPS.length].c : '#f0a04b';
  const soil = '#bd8f68';
  const au = (B.var || 0) < .5, rows = 5;
  const green = hasTech('genegarden');
  const grown = B.prog >= 1 ? 1 : B.prog;
  if (fk === 'round') { // centre-pivot rings
    ell(c, cx, cy - .3, .47 * 22.6, .47 * 11.3, topC(shade(soil, LT.fG)));
    for (let k = 0; k < 4; k++) { if (k / 4 > grown) break; const r = .42 - k * .1; c.strokeStyle = topC(shade(k % 2 ? shade(crop, .82) : crop, LT.fG)); c.lineWidth = 2.1; c.beginPath(); c.ellipse(cx, cy - 1.2, r * 22.6, r * 11.3, 0, 0, TAU); c.stroke(); }
    const a = (B.var || 0) * TAU; line(c, cx, cy - 2, cx + Math.cos(a) * .44 * 22.6, cy - 2 + Math.sin(a) * .44 * 11.3, '#d9d4cc', .7);
    return;
  }
  if (fk === 'orchard') {
    flat(c, cx, cy, 0, 0, .46, .46, .3, '#9fcf8f');
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) { if ((a * 3 + b) / 9 > grown) break; const [px, py] = pt(cx, cy, -.3 + a * .3, -.3 + b * .3, 0); c.fillStyle = '#7b5e4e'; c.fillRect(px - .4, py - 3.4, .8, 3.4); circ(c, px, py - 5, 2.4, leafC('#6db873')); circ(c, px + .8, py - 4.4, .55, crop); }
    return;
  }
  flat(c, cx, cy, 0, 0, .46, .46, .3, soil);
  for (let k = 0; k < rows; k++) {
    const o = -.36 + k * .18;
    if (k / rows > grown) break;
    const col = fk === 'flowers' ? FLOWERS[(k + ((B.var || 0) * 5 | 0)) % FLOWERS.length] : fk === 'stripes' && k % 2 ? mix(crop, st.accent, .55) : green && k % 2 ? shade(crop, 1.1) : crop;
    if (au) { flat(c, cx, cy, 0, o + .01, .42, .05, .8, shade(col, .75)); flat(c, cx, cy, 0, o, .42, .05, 2, col); }
    else { flat(c, cx, cy, o + .01, 0, .05, .42, .8, shade(col, .75)); flat(c, cx, cy, o, 0, .05, .42, 2, col); }
  }
  // corner posts
  for (const [u, v] of [[-.46, -.46], [.46, -.46], [-.46, .46], [.46, .46]]) { const [px, py] = pt(cx, cy, u, v, 0); line(c, px, py, px, py - 2.5, '#8a6d57', .7); }
}

function drawPlaza(c, B, cx, cy, st) {
  const pave = B.style >= 2 ? mix(st.wall, '#d8d0c4', .6) : '#cdb79a';
  flat(c, cx, cy, 0, 0, .47, .47, .3, pave);
  c.strokeStyle = rgba('#8f8272', .3); c.lineWidth = .4;
  if (dsRound()) { for (const r of [.2, .34]) { c.beginPath(); c.ellipse(cx, cy - .3, r * 22.6, r * 11.3, 0, 0, TAU); c.stroke(); } }
  else for (let k = -2; k <= 2; k++) {
    let a = pt(cx, cy, k * .18, -.47, .3), b = pt(cx, cy, k * .18, .47, .3); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
    a = pt(cx, cy, -.47, k * .18, .3); b = pt(cx, cy, .47, k * .18, .3); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  if (B.style < 2) { ell(c, cx, cy, 4.5, 2.3, '#6d5a4c'); ell(c, cx, cy - .5, 3, 1.5, '#e98b4a'); emit(cx, cy - 2, 12, '#ff9a45', .8); emit(cx, cy, 16, '#ff9a45', .3, 1); return; }
  for (const [u, v] of [[-.42, .42], [.42, -.42]]) { const [lx, ly] = pt(cx, cy, u, v, 0); line(c, lx, ly, lx, ly - 8, '#4c4f58', .7); circ(c, lx, ly - 8.3, .9, LT.lit ? '#fff3d0' : '#e8e2cf'); emit(lx, ly - 8, 7, LT.lampC, .8); emit(lx, ly, 12, LT.lampC, .3, 1); }
  cyl(c, cx, cy, .2, 0, 2.2, shade(pave, .9), '#7fc7de');
  if (B.statue) { box(c, cx, cy, 0, 0, .06, .06, 2.2, 5, '#d8d2c8'); const [sx, sy] = pt(cx, cy, 0, 0, 7.2); c.fillStyle = '#b9a99a'; c.fillRect(sx - 1, sy - 6, 2, 6); circ(c, sx, sy - 7, 1.2, '#b9a99a'); }
  else { cyl(c, cx, cy, .05, 2.2, 3, shade(pave, .95), '#bfe7f2'); }
}

function drawMonument(c, B, cx, cy, st) {
  const k = B.sub || 'obelisk', ac = st.accent;
  box(c, cx, cy, 0, 0, .44, .44, 0, 2, '#d9d1c4');
  switch (k) {
    case 'statue': {
      box(c, cx, cy, 0, 0, .14, .14, 2, 10, '#e2dbcf');
      const [sx, sy] = pt(cx, cy, 0, 0, 12);
      c.fillStyle = '#c9b8a6'; c.beginPath(); c.moveTo(sx - 3, sy); c.lineTo(sx - 2, sy - 11); c.lineTo(sx + 2, sy - 11); c.lineTo(sx + 3, sy); c.fill();
      circ(c, sx, sy - 13, 2, '#c9b8a6'); line(c, sx + 2, sy - 10, sx + 6, sy - 17, '#c9b8a6', 1.3); circ(c, sx + 6.5, sy - 18, 1.4, '#e5874f');
      return;
    }
    case 'lantern': {
      box(c, cx, cy, 0, 0, .16, .16, 2, 48, shade(st.wall, 1.02)); windows(c, cx, cy, 0, 0, .16, .16, 2, 48, 6, 1, st.glass);
      box(c, cx, cy, 0, 0, .22, .22, 50, 8, '#ffe39a', '#fff2c4'); roofPyr(c, cx, cy, 0, 0, .23, .23, 58, 10, st.roof);
      { const [lx, ly] = pt(cx, cy, 0, 0, 54); emit(lx, ly, 34, '#ffd98a', .85); emit(lx, ly, 10, '#fff4d0', .9); } return;
    }
    case 'spire': { roofPyr(c, cx, cy, 0, 0, .3, .3, 2, 74, shade(st.wall, 1.02)); box(c, cx, cy, 0, 0, .31, .31, 2, 3, ac); return; }
    case 'harp': {
      c.strokeStyle = ac; c.lineWidth = 2; c.beginPath(); const a = pt(cx, cy, -.3, .1, 2); c.moveTo(a[0], a[1]);
      c.quadraticCurveTo(cx - 2, cy - 90, cx + 14, cy - 8); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = .4;
      for (let k2 = 1; k2 < 9; k2++) { const x = a[0] + k2 * 2.8; c.beginPath(); c.moveTo(x, a[1] - 2); c.lineTo(x, cy - 12 - Math.sin(k2 / 9 * Math.PI) * 50); c.stroke(); }
      return;
    }
    case 'gardens': {
      for (let t = 0; t < 4; t++) { box(c, cx, cy, 0, 0, .42 - t * .09, .42 - t * .09, 2 + t * 9, 8, st.wall); box(c, cx, cy, 0, 0, .43 - t * .09, .43 - t * .09, 10 + t * 9, 1.5, '#72c27a'); }
      parkTree(c, cx, cy - 36, 0, 0, .2); return;
    }
    case 'colossus': {
      const [sx, sy] = pt(cx, cy, 0, 0, 2);
      c.fillStyle = '#b7a58f'; for (const dx of [-8, -3, 4, 9]) c.fillRect(sx + dx - 1.5, sy - 16, 3, 16);
      ell(c, sx, sy - 22, 14, 9, '#c7b59f'); ell(c, sx - 2, sy - 26, 11, 5, '#8fbf88'); ell(c, sx + 15, sy - 26, 5, 4, '#c7b59f'); circ(c, sx + 17, sy - 27, .9, '#333'); return;
    }
    case 'hall': {
      box(c, cx, cy, 0, 0, .42, .34, 2, 18, shade(st.wall, 1.05));
      for (let k2 = 0; k2 < 5; k2++) box(c, cx, cy, -.34 + k2 * .17, .36, .03, .03, 2, 17, '#f4efe6');
      roofGable(c, cx, cy, 0, 0, .44, .36, 20, 7, st.roof, st.wall, true); return;
    }
    case 'clock': {
      box(c, cx, cy, 0, 0, .18, .18, 2, 50, st.wall);
      const [kx, ky] = pt(cx, cy, 0, .18, 42); ell(c, kx - 1.5, ky + .6, 4.5, 5, '#fbf6ea'); line(c, kx - 1.5, ky, kx - 1.5, ky - 3.5, '#333', .6);
      emit(kx - 1.5, ky + .6, 9, '#fff1c9', .7);
      roofPyr(c, cx, cy, 0, 0, .2, .2, 52, 14, st.roof); return;
    }
    case 'orchard': {
      for (let k2 = 0; k2 < 3; k2++) { c.strokeStyle = rgba(st.glass, .9); c.lineWidth = 1.5; const a = pt(cx, cy, -.35 + k2 * .35, .2, 2); c.beginPath(); c.ellipse(a[0], a[1], 8, 26, 0, Math.PI, TAU); c.stroke(); }
      parkTree(c, cx, cy, -.1, 0, .1); parkTree(c, cx, cy, .15, -.1, .4); return;
    }
    default: {
      box(c, cx, cy, 0, 0, .12, .12, 2, 52, '#ece6da'); roofPyr(c, cx, cy, 0, 0, .12, .12, 54, 10, '#d6b85a');
      const [ex, ey] = pt(cx, cy, 0, .12, 40); circ(c, ex - 1.5, ey + .8, 1.8, ac); emit(ex - 1.5, ey + .8, 6, ac, .6);
    }
  }
}

function drawConstruction(c, B, cx, cy, st, i) {
  const f = B.prog;
  if (FLAT_TYPES[B.type]) {
    flat(c, cx, cy, 0, 0, .44, .44, .3, B.type === 'farm' ? '#c79b72' : '#cdbda3');
    if (B.type === 'farm') { drawFarm(c, B, cx, cy, i); return; }
  } else flat(c, cx, cy, 0, 0, .42, .42, .3, '#cdbda3');
  const hh = buildH(B);
  if (f < .2) {
    for (const [u, v] of [[-.3, -.3], [.3, -.3], [-.3, .3], [.3, .3]]) { const [px, py] = pt(cx, cy, u, v, 0); line(c, px, py, px, py - 3, '#8a6d57', .7); }
    c.strokeStyle = 'rgba(217,119,75,.8)'; c.lineWidth = .4; c.beginPath();
    const p = [pt(cx, cy, -.3, -.3, 2), pt(cx, cy, .3, -.3, 2), pt(cx, cy, .3, .3, 2), pt(cx, cy, -.3, .3, 2)];
    c.moveTo(p[0][0], p[0][1]); for (const q of p) c.lineTo(q[0], q[1]); c.closePath(); c.stroke();
  } else if (!FLAT_TYPES[B.type]) {
    const h = Math.max(2, hh * Math.min(1, (f - .2) / .8));
    box(c, cx, cy, 0, 0, .28, .28, 0, h, st.wall);
    const pol = '#a07f58';
    for (const [u, v] of [[-.34, .34], [.34, .34], [.34, -.34]]) { const a = pt(cx, cy, u, v, 0), b = pt(cx, cy, u, v, h + 4); line(c, a[0], a[1], b[0], b[1], pol, .7); }
    for (let z = 4; z < h + 3; z += 5) {
      const a = pt(cx, cy, -.34, .34, z), b = pt(cx, cy, .34, .34, z), d = pt(cx, cy, .34, -.34, z);
      c.strokeStyle = pol; c.lineWidth = .55; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(d[0], d[1]); c.stroke();
    }
    if (hh > 40 && h > 10) { const t = pt(cx, cy, -.3, -.3, h + 12); const b = pt(cx, cy, -.3, -.3, 0); line(c, b[0], b[1], t[0], t[1], '#e0a43a', 1); line(c, t[0], t[1], t[0] + 14, t[1] + 2, '#e0a43a', 1); }
  }
  box(c, cx, cy, .3, .3, .07, .05, 0, 1.6, '#c3a27a');
}
