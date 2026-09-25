/* ============================== the water: harbours, ships, ferries, fishing boats ============================== */
// Big coastal towns build a harbour, and ships sail between harbours (or off over the horizon), carrying
// the towns' trade. Ferries shuttle across lakes and inlets where the way round is long. Fishing boats
// leave their piers in the morning and come home at dusk.

/* ---------- open water: connected sea and lakes (rivers don't count) ---------- */
let WB = null;
function waterBodies() {
  if (WB && WB.S === S) return WB;
  const id = new Int32Array(W * H), size = [0];
  for (let i = 0; i < W * H; i++) {
    if (M.water[i] !== 1 || id[i]) continue;
    const n = size.length, q = [i]; let c = 0; id[i] = n;
    while (q.length) { const k = q.pop(); c++; const x = k % W, y = (k / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.water[j] === 1 && !id[j]) { id[j] = n; q.push(j); } } }
    size.push(c);
  }
  return (WB = { S, id, size });
}
const bigWater = i => { if (M.water[i] !== 1) return false; const w = waterBodies(); return w.size[w.id[i]] >= 40; };
const sameWater = (a, b) => { const w = waterBodies(); return w.id[a] && w.id[a] === w.id[b]; };
function waterNear(x, y, r) { let n = 0; for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && bigWater(idx(nx, ny))) n++; } return n; }

/* ---------- harbours ---------- */
function harbourSite(x, y) { // a shore tile with open water in front
  for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
    const a = [x + dx, y + dy], b = [x + dx * 2, y + dy * 2], c2 = [x + dx * 3, y + dy * 3];
    if (!inb(...c2)) continue;
    const ia = idx(...a), ib = idx(...b), ic = idx(...c2);
    if (bigWater(ia) && bigWater(ib) && M.water[ic] === 1 && !M.road[ia]) return [dx, dy];
  }
  return null;
}
// finished buildings of one type (cached until something new is built or a month passes)
const BUILT = { k: '', v: {} };
function builtOf(type) {
  const k = S.month + ':' + S.nextB + ':' + (S.created || 0);
  if (BUILT.k !== k) { BUILT.k = k; BUILT.v = {}; }
  let a = BUILT.v[type]; if (a) return a.filter(B => S.B[B.id]);
  a = BUILT.v[type] = []; for (const id in S.B) { const B = S.B[id]; if (B.type === type && B.prog >= 1) a.push(B); }
  return a;
}
const harbours = () => builtOf('harbor').filter(B => B.dir);
const moorTile = B => idx(B.x + B.dir[0], B.y + B.dir[1]);
const townHarbour = T => T.bl.map(id => S.B[id]).find(B => B && B.type === 'harbor' && B.prog >= 1 && B.dir);
function seaLinked(A, B) { const a = townHarbour(A), b = townHarbour(B); return !!(a && b && sameWater(moorTile(a), moorTile(b))); }

/* ---------- routes over open water, kept a little off the coast ---------- */
const ROUTES = new Map();
function seaRoute(a, b) {
  const key = a + '-' + b;
  if (ROUTES.has(key)) return ROUTES.get(key);
  const coast = i => { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of N8) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && M.water[idx(nx, ny)] !== 1) return 1; } return 0; };
  const path = astar(a, b, (i, j) => M.water[j] === 1 ? 1 + coast(j) * 1.6 : 1e9);
  if (ROUTES.size > 200) ROUTES.clear();
  ROUTES.set(key, path);
  return path;
}
function edgeWater(from) { // somewhere out past the edge of the map, on the same sea
  const w = waterBodies(), c = [];
  for (let k = 0; k < W; k++) for (const [x, y] of [[k, 0], [k, H - 1], [0, k], [W - 1, k]]) { const i = idx(x, y); if (M.water[i] === 1 && w.id[i] === w.id[from]) c.push(i); }
  return c.length ? pick(c) : -1;
}
function edgeOut(i) { const x = i % W, y = (i / W) | 0; return x === 0 ? [-1, 0] : x === W - 1 ? [1, 0] : y === 0 ? [0, -1] : [0, 1]; }

/* ---------- ships ---------- */
const shipCap = () => 7 + Math.min(3, builtOf('shipyard').length); // shipyards put more ships on the water
function shipKind() { return hasTech('hover') ? 'hover' : hasTech('computing') ? 'boxship' : hasTech('electric') ? 'freighter' : hasTech('steam') ? 'steamer' : 'sail'; }
function spawnShip(fromB, toB, r) {
  if (DYN.ships.length >= shipCap()) return null;
  const hs = harbours(); if (!hs.length) return null;
  const home = fromB || pick(hs);
  const sh = { kind: shipKind(), r: r || pick(['wood', 'stone', 'clay', 'metal', 'goods']), col: pick(['#b8554a', '#3f6e8c', '#3d6b4f', '#8a5a3c', '#5b5f8a']), path: null, s: 0, st: 'moor', at: home.id, until: DYN.t + rf(10, 22), to: toB ? toB.id : 0, hx: -home.dir[1], hy: home.dir[0], id: rnd() };
  DYN.ships.push(sh); return sh;
}
function arriveShip() { // a ship from over the horizon heading for one of the harbours
  const hs = harbours(); if (!hs.length || DYN.ships.length >= shipCap()) return;
  const B = pick(hs), m = moorTile(B), e = edgeWater(m); if (e < 0) return;
  const path = seaRoute(e, m); if (!path || path.length < 4) return;
  const [ox, oy] = edgeOut(e), pre = [];
  for (let k = 4; k >= 1; k--) { const x = e % W + ox * k, y = ((e / W) | 0) + oy * k; pre.push({ x, y }); }
  DYN.ships.push({ kind: shipKind(), r: pick(RES), col: pick(['#b8554a', '#3f6e8c', '#3d6b4f', '#8a5a3c', '#5b5f8a']), path, pre, s: -4, st: 'sail', to: B.id, hx: -ox, hy: -oy, id: rnd() });
}
function departShip(sh) {
  const A = S.B[sh.at]; if (!A) { sh.gone = 1; return; }
  const from = moorTile(A), hs = harbours().filter(B => B !== A && sameWater(moorTile(B), from));
  let B = sh.to && S.B[sh.to] && S.B[sh.to] !== A ? S.B[sh.to] : null;
  if (!B && hs.length && chance(.65)) B = pick(hs);
  let path = null, off = null;
  if (B) path = seaRoute(from, moorTile(B));
  if (!path) { const e = edgeWater(from); if (e >= 0) { path = seaRoute(from, e); off = edgeOut(e); } B = null; }
  if (!path || path.length < 2) { sh.until = DYN.t + 20; return; }
  sh.path = path; sh.s = 0; sh.st = 'sail'; sh.to = B ? B.id : 0; sh.off = off; sh.from = A.id;
  if (DYN.slot[A.id] === sh) DYN.slot[A.id] = null;
}
function stepShips(dt) {
  if (!S || !hasTech('boats')) return;
  const hs = harbours();
  // keep a few ships about
  if (hs.length && DYN.t > (DYN.nextShip || 0)) {
    DYN.nextShip = DYN.t + rf(35, 80);
    const yards = Math.min(3, builtOf('shipyard').length), want = Math.min(6 + yards, 1 + Math.round(hs.length * 1.5) + yards);
    if (DYN.ships.length < want) { if (chance(.5)) arriveShip(); else { const sh = spawnShip(); if (sh) { if (DYN.slot[sh.at]) { sh.gone = 1; } else DYN.slot[sh.at] = sh; } } }
  }
  for (const sh of DYN.ships) {
    if (sh.st === 'moor') {
      if (!S.B[sh.at]) { sh.gone = 1; continue; }
      if (DYN.t > sh.until) departShip(sh);
      continue;
    }
    const n = sh.path.length, spd = { sail: .45, steamer: .6, freighter: .75, boxship: .8, hover: 1.4 }[sh.kind] || .6;
    // wait offshore if someone else is at the quay
    const dest = sh.to && S.B[sh.to];
    if (dest && sh.s > n - 5 && DYN.slot[dest.id] && DYN.slot[dest.id] !== sh) { sh.wait = 1; continue; }
    sh.wait = 0;
    sh.s += dt * spd * (sh.s > n - 3 && dest ? .55 : 1);
    if (dest && sh.s > n - 4) DYN.slot[dest.id] = sh;
    if (sh.s >= n - 1) {
      if (dest) { sh.st = 'moor'; sh.at = dest.id; sh.until = DYN.t + rf(18, 40); sh.s = n - 1; sh.to = 0; sh.hx = -dest.dir[1]; sh.hy = dest.dir[0];
        if (!S.flags.firstShip && sh.from && S.B[sh.from]) { S.flags.firstShip = 1; const A = S.T[S.B[sh.from].sid], B = S.T[dest.sid]; if (A && B && A !== B) chron('⛵', `The first ship sails into ${B.name} from ${A.name}. Half the town is on the quay to watch her tie up.`, { x: dest.x, y: dest.y, k: 'major', cap: 'The first ship' }); }
      } else if (sh.s >= n + 3) sh.gone = 1; // sailed off over the horizon
    }
  }
  DYN.ships = DYN.ships.filter(sh => { if (sh.gone) { for (const k in DYN.slot) if (DYN.slot[k] === sh) DYN.slot[k] = null; } return !sh.gone; });
}
// [fx, fy, alpha, dirx, diry]
function shipPos(sh) {
  if (sh.st === 'moor') {
    const B = S.B[sh.at]; if (!B) return null;
    const i = moorTile(B); return [i % W - B.dir[0] * .18, ((i / W) | 0) - B.dir[1] * .18, 1, -B.dir[1], B.dir[0]];
  }
  const n = sh.path.length;
  if (sh.s < 0) { // coming in from past the edge
    const k = Math.max(0, Math.min(sh.pre.length - 1, Math.floor(sh.s + sh.pre.length))), f = sh.s + sh.pre.length - k;
    const a = sh.pre[k], b = sh.pre[k + 1] || { x: sh.path[0] % W, y: (sh.path[0] / W) | 0 };
    return [lerp(a.x, b.x, f), lerp(a.y, b.y, f), clamp((sh.s + 4) / 2.5, 0, 1), b.x - a.x, b.y - a.y];
  }
  if (sh.s >= n - 1) { // heading out past the edge
    const e = sh.path[n - 1], o = sh.off || [0, 0], f = sh.s - (n - 1);
    return [e % W + o[0] * f, ((e / W) | 0) + o[1] * f, clamp(1 - f / 3.5, 0, 1), o[0], o[1]];
  }
  const p = pathPos(sh, 0, false, false);
  return [p[0], p[1], 1, p[4], p[5]];
}

/* ---------- drawing things that float: oriented shapes in any heading ---------- */
function orient(x, y, fx, fy) { const rx = -fy, ry = fx; return (a, b, z) => { const u = a * fx + b * rx, v = a * fy + b * ry; return [x + (u - v) * 16, y + (u + v) * 8 - z]; }; }
function prism(c, P, fx, fy, pts, z0, z1, side, top) {
  const n = pts.length; let ca = 0, cb = 0; for (const [a, b] of pts) { ca += a / n; cb += b / n; }
  const rx = -fy, ry = fx;
  for (let k = 0; k < n; k++) {
    const [a0, b0] = pts[k], [a1, b1] = pts[(k + 1) % n];
    let na = b1 - b0, nb = -(a1 - a0);
    if (na * ((a0 + a1) / 2 - ca) + nb * ((b0 + b1) / 2 - cb) < 0) { na = -na; nb = -nb; }
    const gx = na * fx + nb * rx, gy = na * fy + nb * ry;
    if (gx + gy <= 0) continue;
    poly(c, [P(a0, b0, z0), P(a1, b1, z0), P(a1, b1, z1), P(a0, b0, z1)], shade(side, lf(gx, gy, 0)));
  }
  if (top) poly(c, pts.map(([a, b]) => P(a, b, z1)), topC(shade(top, LT.fT)));
}
const HULL = (L, B) => [[-L, -B], [-L, B], [L * .45, B], [L, 0], [L * .45, -B]];
function wake(c, P, L, moving) { if (!moving) return; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .5; for (const s of [-1, 1]) { const a = P(-L, s * .03, 0), b = P(-L - .35, s * .14, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); } }
function drawShip(c, sh, x, y, fx, fy, al, dl, moving) {
  c.globalAlpha = al;
  const P = orient(x, y, fx, fy), k = sh.kind;
  const L = k === 'sail' ? .5 : k === 'steamer' ? .62 : k === 'freighter' ? .78 : k === 'boxship' ? .92 : .75, Bw = k === 'sail' ? .13 : k === 'boxship' ? .18 : .15;
  const [sx, sy] = P(0, 0, 0); ell(c, sx, sy + .5, L * 26, L * 11, 'rgba(20,40,60,.14)');
  wake(c, P, L, moving);
  if (k === 'hover') { ell(c, sx, sy, L * 24, L * 10, 'rgba(95,208,201,.25)'); dl(sx, sy, 14, '#7fe8e0', .5, 1); }
  const zb = k === 'hover' ? 2.5 : 0, hullC = k === 'sail' ? '#7b5238' : k === 'hover' ? '#eef2f6' : sh.col, deck = k === 'sail' ? '#c9a06a' : k === 'hover' ? '#f8fafc' : '#b9b3aa';
  prism(c, P, fx, fy, HULL(L, Bw), zb, zb + (k === 'sail' ? 2.2 : 2.8), hullC, deck);
  const zd = zb + (k === 'sail' ? 2.2 : 2.8);
  if (k === 'sail') {
    prism(c, P, fx, fy, [[-L, -Bw * .9], [-L, Bw * .9], [-L * .6, Bw * .9], [-L * .6, -Bw * .9]], zd, zd + 2.2, '#8a6446', '#a57c55'); // the stern castle
    for (const [a, h] of [[L * .15, 17], [-L * .3, 13]]) {
      const m0 = P(a, 0, zd), m1 = P(a, 0, zd + h); line(c, m0[0], m0[1], m1[0], m1[1], '#5a4436', .6);
      const w = Bw * 2.1, face = shade('#fbf4e2', lf(fx, fy, .2) > lf(-fx, -fy, .2) ? lf(fx, fy, .2) : lf(-fx, -fy, .2));
      poly(c, [P(a, -w, zd + h * .3), P(a, w, zd + h * .3), P(a + .03, w * .9, zd + h * .95), P(a + .03, -w * .9, zd + h * .95)], face);
    }
    if (LIGHT.emK > .02) { const [lx, ly] = P(-L, 0, zd + 3); circ(c, lx, ly, .6, '#ffd27a'); dl(lx, ly, 5, '#ffb45e', .9); }
  } else if (k === 'steamer') {
    prism(c, P, fx, fy, [[-L * .5, -Bw * .7], [-L * .5, Bw * .7], [L * .15, Bw * .7], [L * .15, -Bw * .7]], zd, zd + 3.2, '#f2efe8', '#e6e1d8');
    const [fx0, fy0] = P(-L * .05, 0, zd + 3.2); c.fillStyle = '#2f2f36'; c.fillRect(fx0 - 1, fy0 - 5, 2, 5); c.fillStyle = '#c0584f'; c.fillRect(fx0 - 1, fy0 - 5, 2, 1.2);
    if (moving && chance(.08)) addPart(fx0, fy0 - 5.5, rf(-3, 3), rf(-7, -4), rf(2.5, 4), '#e8e4df', .45, 'smoke', 1.4);
    if (LIGHT.emK > .02) { const [wx, wy] = P(-L * .2, Bw * .7, zd + 1.6); dl(wx, wy, 6, '#ffe2a0', .8); }
  } else if (k === 'freighter' || k === 'boxship') {
    prism(c, P, fx, fy, [[-L, -Bw * .8], [-L, Bw * .8], [-L * .7, Bw * .8], [-L * .7, -Bw * .8]], zd, zd + 5, '#f2efe8', '#e6e1d8'); // bridge at the stern
    const [bx, by] = P(-L * .85, 0, zd + 5); c.fillStyle = '#2f2f36'; c.fillRect(bx - .8, by - 3, 1.6, 3);
    if (k === 'boxship') { const cols = ['#c0584f', '#3f7fb0', '#e0a43a', '#4e9a6a', '#8a6ab0']; let n = 0; for (let a = -L * .6; a < L * .35; a += .12) for (let lay = 0; lay < 2; lay++) { const cc = cols[(n++ * 7 + ((sh.id * 10) | 0)) % cols.length]; prism(c, P, fx, fy, [[a, -Bw * .75], [a, Bw * .75], [a + .1, Bw * .75], [a + .1, -Bw * .75]], zd + lay * 2, zd + lay * 2 + 2, cc, cc); } }
    else { for (const a of [-L * .4, L * .05]) prism(c, P, fx, fy, [[a - .1, -Bw * .6], [a - .1, Bw * .6], [a + .1, Bw * .6], [a + .1, -Bw * .6]], zd, zd + 1.2, '#6f7680', RES_COL[sh.r] || '#8a8f99'); }
    if (LIGHT.emK > .02) { const [wx, wy] = P(-L * .85, Bw * .8, zd + 3); dl(wx, wy, 7, '#fff0c8', .8); const [mx, my] = P(L * .9, 0, zd + 4); circ(c, mx, my, .5, '#fff'); dl(mx, my, 5, '#ffffff', .9); }
  } else { // hover freighter
    prism(c, P, fx, fy, [[-L * .6, -Bw * .6], [-L * .6, Bw * .6], [L * .2, Bw * .6], [L * .2, -Bw * .6]], zd, zd + 3, '#dfe7ee', '#f4f7fa');
    const [gx, gy] = P(-L, 0, zd); dl(gx, gy, 6, '#9ff0ea', .8);
  }
  c.globalAlpha = 1;
}

/* ---------- fishing boats: out in the morning, home at dusk ---------- */
function waterPath(a, b, maxN) { // plain BFS over open water
  if (a === b) return [a];
  const prev = new Map([[a, -1]]), q = [a];
  for (let h = 0; h < q.length && h < (maxN || 900); h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (prev.has(j) || M.water[j] !== 1 || M.road[j]) continue; prev.set(j, i); if (j === b) { const p = []; for (let k = b; k >= 0; k = prev.get(k)) p.push(k); return p.reverse(); } q.push(j); }
  }
  return null;
}
function syncBoats() {
  const docks = []; for (const k in S.B) { const B = S.B[k]; if (B.type === 'dock' && B.prog >= 1 && B.dir) { const j = idx(B.x + B.dir[0], B.y + B.dir[1]); if (inb(B.x + B.dir[0], B.y + B.dir[1]) && M.water[j] === 1) docks.push(B); } }
  DYN.boats = DYN.boats.filter(b => S.B[b.dock]);
  for (const B of docks.slice(0, 12)) if (!DYN.boats.some(b => b.dock === B.id)) {
    const j = idx(B.x + B.dir[0], B.y + B.dir[1]);
    DYN.boats.push({ dock: B.id, home: j, st: 'moor', until: DYN.t + rf(2, 30), path: null, s: 0, col: pick(CLOTH), hx: -B.dir[1], hy: B.dir[0], ph: rnd() * 6, id: rnd() });
  }
}
function stepBoats(dt) {
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, hr = sun.hr, fx = sun.fixed;
  const goOut = fx ? true : hr >= 5.5 && hr < 15.5, comeHome = !fx && (hr >= 16.5 || hr < 5);
  for (const b of DYN.boats) {
    b.ph += dt;
    if (b.st === 'moor') {
      if (DYN.t > b.until && goOut) {
        const hx = b.home % W, hy = (b.home / W) | 0;
        for (let k = 0; k < 10; k++) {
          const a = rnd() * TAU, d = rf(3, 9), gx = Math.round(hx + Math.cos(a) * d), gy = Math.round(hy + Math.sin(a) * d);
          if (!inb(gx, gy)) continue; const g = idx(gx, gy); if (M.water[g] !== 1 || !sameWater(g, b.home)) continue;
          const p = waterPath(b.home, g); if (p && p.length > 2) { b.path = p; b.s = 0; b.st = 'out'; break; }
        }
        if (b.st === 'moor') b.until = DYN.t + rf(10, 30);
      }
    } else if (b.st === 'out' || b.st === 'back') {
      b.s += dt * .38;
      if (b.s >= b.path.length - 1) {
        if (b.st === 'out') { b.st = 'fish'; b.until = DYN.t + (fx ? rf(50, 110) : rf(60, 200)); b.g = b.path[b.path.length - 1]; }
        else { b.st = 'moor'; b.until = DYN.t + (fx ? rf(20, 60) : rf(30, 90)); const B = S.B[b.dock]; if (B) { b.hx = -B.dir[1]; b.hy = B.dir[0]; } }
      }
    } else if (b.st === 'fish') {
      if ((fx && DYN.t > b.until) || comeHome || (!fx && DYN.t > b.until && hr >= 14)) { const p = waterPath(b.g, b.home); if (p) { b.path = p; b.s = 0; b.st = 'back'; } else { b.st = 'moor'; } }
      else if (DYN.t > b.until) b.until = DYN.t + rf(30, 80);
    }
  }
}
function boatPos(b) {
  if (b.st === 'moor') { const B = S.B[b.dock]; if (!B) return null; return [b.home % W - B.dir[0] * .22 + B.dir[1] * .12, ((b.home / W) | 0) - B.dir[1] * .22 + B.dir[0] * .12, 1, b.hx, b.hy, 0]; }
  if (b.st === 'fish') { const x = b.g % W, y = (b.g / W) | 0, a = b.ph * .12; return [x + Math.cos(a) * .18, y + Math.sin(a) * .18, 1, -Math.sin(a), Math.cos(a), 0]; }
  const p = pathPos(b, 0, false, false); return [p[0], p[1], 1, p[4], p[5], 1];
}
function drawBoat(c, b, x, y, fx, fy, moving, dl) {
  const P = orient(x, y, fx, fy), steam = hasTech('steam'), bob = Math.sin(b.ph * 2.2) * .35;
  y += bob;
  const Q = orient(x, y, fx, fy);
  ell(c, x, y + .5, 5, 2, 'rgba(20,40,60,.12)');
  wake(c, Q, .2, moving);
  prism(c, Q, fx, fy, HULL(.2, .07), 0, 1.6, steam ? '#4f6f86' : '#8a5a3c', steam ? '#d9d4cc' : '#c9a06a');
  prism(c, Q, fx, fy, [[-.16, -.045], [-.16, .045], [-.05, .045], [-.05, -.045]], 1.6, 3.4, steam ? '#f2efe8' : '#a57c55', steam ? '#c0584f' : '#8a6446');
  const m0 = Q(.06, 0, 1.6), m1 = Q(.06, 0, 8); line(c, m0[0], m0[1], m1[0], m1[1], '#5a4436', .45);
  if (!steam) { const w = .09; poly(c, [Q(.06, 0, 2.6), Q(.06, 0, 7.6), Q(.18, 0, 2.8)], '#fbf4e2'); }
  if (b.st === 'fish') { // the net goes over the side
    const a = Q(.06, 0, 7), e = Q(.05, .28, 0); c.strokeStyle = 'rgba(70,60,50,.7)'; c.lineWidth = .3; c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(e[0], e[1]); c.stroke();
    ell(c, e[0], e[1], 1.6, .6, 'rgba(60,70,80,.35)');
  }
  const [lx, ly] = Q(-.1, 0, 4.2); dl(lx, ly, 4.5, '#ffc766', .85);
}

/* ---------- ferries: across the water where the way round is long ---------- */
const FERRY = { S: null, n: -1, at: new Map() };
function ferryLandings() {
  const fs = S.ferries || [];
  if (FERRY.S === S && FERRY.n === fs.length && FERRY.v === S.ferryV) return FERRY.at;
  FERRY.S = S; FERRY.n = fs.length; FERRY.v = S.ferryV; FERRY.at = new Map();
  for (const f of fs) { FERRY.at.set(f.a, [f.dir[0], f.dir[1]]); FERRY.at.set(f.b, [-f.dir[0], -f.dir[1]]); }
  return FERRY.at;
}
function planFerries(T) {
  if (!hasTech('boats') || T.pop < 40) return;
  const fs = S.ferries = S.ferries || [];
  // an old ferry retires once a bridge makes it pointless
  for (let k = fs.length - 1; k >= 0; k--) {
    const f = fs[k]; if (f.tid !== T.id) continue;
    const walk = footSteps(f.a, f.b, 40);
    if (walk < 12) { fs.splice(k, 1); S.ferryV = (S.ferryV || 0) + 1; markDirty(f.a); markDirty(f.b); if (chance(.5)) chron('⛴️', `The old ferry at ${T.name} makes its last crossing. There's a bridge now, and nobody needs the boatman.`, { x: f.a % W, y: (f.a / W) | 0 }); }
  }
  if (fs.some(f => f.tid === T.id) || fs.length >= 8 || S.year - (T.lastFerry || -99) < 10) return;
  T.lastFerry = S.year;
  const R = Math.ceil(townRadius(T) + 4); let best = null, bs = -1e9;
  for (let y = Math.max(1, T.y - R); y <= Math.min(H - 2, T.y + R); y++) for (let x = Math.max(1, T.x - R); x <= Math.min(W - 2, T.x + R); x++) {
    const a = idx(x, y); if (M.water[a] || M.ruin[a] || (M.bld[a] && !isRoadAnchor(a))) continue;
    if (!(M.road[a] || fronts(x, y))) continue;
    for (const [dx, dy] of N4) {
      let k = 1, ok = true;
      for (; k <= 8; k++) { const nx = x + dx * k, ny = y + dy * k; if (!inb(nx, ny)) { ok = false; break; } const j = idx(nx, ny); if (!M.water[j]) break; if (M.road[j]) { ok = false; break; } }
      if (!ok || k === 1 || k > 8) continue;
      const bx = x + dx * k, by = y + dy * k, b = idx(bx, by);
      if (M.bld[b] || M.ruin[b] || Math.abs(M.elev[a] - M.elev[b]) > 3 || fs.some(f => dist(f.a % W, (f.a / W) | 0, x, y) < 5)) continue;
      const s = -k * 1.2 - dist(x, y, T.x, T.y) * .4 + (M.road[b] ? 2 : 0) + rnd();
      if (s <= bs) continue;
      if (footSteps(a, b, 36) < 18) continue; // it's quicker to walk
      bs = s; best = { a, b, dir: [dx, dy], len: k - 1 };
    }
  }
  if (!best) return;
  const t = roadTier();
  for (const j of [best.a, best.b]) { if (!M.road[j] && !M.bld[j]) { M.road[j] = t; M.tree[j] = 0; M.plan[j] = 1; markDirty(j); } }
  roadLink(best.b, [best.a, best.b]);
  fs.push({ a: best.a, b: best.b, dir: best.dir, len: best.len, tid: T.id, yr: yr() }); S.ferryV = (S.ferryV || 0) + 1;
  const river = M.water[idx(best.a % W + best.dir[0], ((best.a / W) | 0) + best.dir[1])] === 2, nm = river ? 'the river' : 'the water';
  if (!S.flags.firstFerry) { S.flags.firstFerry = 1; chron('⛴️', `A ferry starts running across ${nm} at ${T.name}. A penny a crossing, dogs go free.`, { x: best.a % W, y: (best.a / W) | 0, k: 'major', cap: 'The first ferry' }); }
  else if (chance(.4)) chron('⛴️', `${T.name} puts a ferry across ${nm}.`, { x: best.a % W, y: (best.a / W) | 0 });
}
function stepFerries(dt) {
  const fs = S.ferries || [];
  DYN.ferries = DYN.ferries.filter(o => fs.includes(o.f));
  for (const f of fs) if (!DYN.ferries.some(o => o.f === f)) DYN.ferries.push({ f, t: 0, dirn: 1, wait: rf(2, 10), ph: rnd() * 6 });
  const sun = LIGHT.sun || { hr: 13, fixed: 1 }, night = !sun.fixed && (sun.hr >= 22.5 || sun.hr < 5.5);
  for (const o of DYN.ferries) {
    o.ph += dt;
    if (o.wait > 0) { o.wait -= dt; if (night && o.t === 0) o.wait = Math.max(o.wait, 5); continue; }
    o.t += dt * .28 / Math.max(1, o.f.len + .6) * o.dirn;
    if (o.t >= 1 || o.t <= 0) { o.t = clamp(o.t, 0, 1); o.dirn *= -1; o.wait = rf(8, 16); }
  }
}
function ferryPos(o) {
  const f = o.f, ax = f.a % W, ay = (f.a / W) | 0, s = .74, e = f.len + .26, d = lerp(s, Math.max(s + .2, e), smooth(o.t));
  return [ax + f.dir[0] * d, ay + f.dir[1] * d, f.dir[0], f.dir[1], o.wait <= 0];
}
function drawFerry(c, o, x, y, fx, fy, moving, dl) {
  y += Math.sin(o.ph * 1.8) * .3;
  const P = orient(x, y, fx, fy), steam = hasTech('steam'), raft = !hasTech('wheel');
  ell(c, x, y + .5, 6, 2.4, 'rgba(20,40,60,.12)');
  wake(c, P, .2, moving);
  if (raft) { prism(c, P, fx, fy, [[-.2, -.13], [-.2, .13], [.2, .13], [.2, -.13]], 0, 1.2, '#8a6446', '#b08a5e'); }
  else { prism(c, P, fx, fy, [[-.24, -.13], [-.24, .13], [.24, .13], [.24, -.13]], 0, 1.8, steam ? '#e9e4da' : '#7b5238', steam ? '#c9c2b6' : '#b08a5e'); prism(c, P, fx, fy, [[-.08, -.08], [-.08, .08], [.08, .08], [.08, -.08]], 1.8, 4.4, steam ? '#f4f1ea' : '#a57c55', steam ? '#3f6e8c' : '#8a6446'); }
  // a few passengers
  for (const [a, b, col] of [[.14, -.06, '#c0584f'], [-.15, .05, '#3f6e8c'], [.15, .07, '#e0a43a']]) { const [px, py] = P(a, b, raft ? 1.2 : 1.8); c.fillStyle = col; c.fillRect(px - .6, py - 2.6, 1.2, 2.6); circ(c, px, py - 3, .55, '#e8c4a0'); }
  const [lx, ly] = P(0, 0, raft ? 3 : 5); dl(lx, ly, 5, '#ffc766', .85);
}
// a landing stage on the bank (static layer)
function drawLanding(c, i, cx, cy, d) {
  const [dx, dy] = d;
  box(c, cx, cy, dx * .38, dy * .38, dx ? .12 : .16, dy ? .12 : .16, -1.5, 2, '#9b7657');
  const [px, py] = pt(cx, cy, dx * .3 + dy * .14, dy * .3 + dx * .14, 0); line(c, px, py, px, py - 6, '#6b5040', .6);
  circ(c, px, py - 6.3, .7, LT.lit ? '#ffd27a' : '#c9a67a'); emit(px, py - 6, 6, LT.lampC, .8); emit(px, py, 9, LT.lampC, .25, 1);
}

/* ---------- lighthouse beams (drawn with the night light) ---------- */
const BEAMS = [];
function drawBeams(c) {
  for (const [x, y, a] of BEAMS) {
    const ex = Math.cos(a), ey = Math.sin(a), sx = (ex - ey) * 16, sy = (ex + ey) * 8, n = Math.hypot(sx, sy) || 1, ux = sx / n, uy = sy / n, L = 190, sp = .09;
    const g = c.createLinearGradient(x, y, x + ux * L, y + uy * L); g.addColorStop(0, 'rgba(255,240,196,.5)'); g.addColorStop(1, 'rgba(255,240,196,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (ux - uy * sp) * L, y + (uy + ux * sp) * L); c.lineTo(x + (ux + uy * sp) * L, y + (uy - ux * sp) * L); c.closePath(); c.fill();
    drawGlow(c, x, y, 9, '#fff3cf', .9);
  }
  BEAMS.length = 0;
}
