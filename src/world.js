/* ============================== world ============================== */
const BIO = { SEA: 0, FRESH: 1, SAND: 2, MEADOW: 3, LUSH: 4, HIGH: 5, ROCK: 6, SNOW: 7, BARREN: 8 };
const BIO_NAME = ['Open water', 'Fresh water', 'Coral sand', 'Bluegrass meadow', 'Lush meadow', 'Ochre highland', 'Lilac stone', 'Snowcap', 'Rust flats'];
const BIO_COL = ['#3f93b8', '#58b3cf', '#f1d6b3', '#94d4a6', '#77c69c', '#dfbb85', '#aea8c2', '#f4f3fb', '#e3b092'];
const TREE_NAME = ['', 'Puffwood', 'Spirepine', 'Glowcap grove', 'Orchard'];

let M = null; // current map (alias of S.map)

function newMap() {
  const n = W * H;
  return {
    elev: new Uint8Array(n), water: new Uint8Array(n), bio: new Uint8Array(n), tree: new Uint8Array(n), ttype: new Uint8Array(n),
    fert: new Uint8Array(n), ore: new Uint8Array(n), ruin: new Uint8Array(n), road: new Uint8Array(n), rail: new Uint8Array(n),
    bld: new Int32Array(n), wild: new Uint8Array(n), plan: new Uint8Array(n)
  };
}
const MAP_KEYS = ['elev', 'water', 'bio', 'tree', 'ttype', 'fert', 'ore', 'ruin', 'road', 'rail', 'bld', 'wild', 'plan'];

function surfZ(i) { const w = M.water[i]; return w === 1 ? SEAZ : w === 2 ? M.elev[i] * EH - 3 : M.elev[i] * EH; }
function landZ(i) { return M.water[i] === 1 ? 2 * EH : M.elev[i] * EH; }
const isLand = i => M.water[i] === 0;

function bfsDist(M, seedFn, maxD = 99) {
  const d = new Uint8Array(W * H).fill(255), q = [];
  for (let i = 0; i < W * H; i++) if (seedFn(i)) { d[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) {
    const i = q[h], x = i % W, y = (i / W) | 0;
    if (d[i] >= maxD) continue;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (d[j] > d[i] + 1) { d[j] = d[i] + 1; q.push(j); } }
  }
  return d;
}

function genWorld(seed) {
  const M = newMap();
  const nz = makeNoise(seed), nz2 = makeNoise(seed + 101), nz3 = makeNoise(seed + 202), nz4 = makeNoise(seed + 303);
  const R = mulberry32(seed * 7 + 3);
  const seaSide = R() < 0.5 ? 0 : 1;
  const bayC = 0.3 + R() * 0.4;
  const hf = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const u = x / (W - 1), v = y / (H - 1), i = idx(x, y);
    const back = 1 - (u + v) / 2;
    const base = nz.fbm(x * 0.055, y * 0.055, 5);
    const ridge = 1 - Math.abs(nz2.fbm(x * 0.05 + 3, y * 0.05 + 7, 4) * 2 - 1);
    const mount = sstep(0.5, 1.0, back + (nz3.fbm(x * .04, y * .04, 2) - .5) * .35);
    let h = 0.31 + (base - 0.5) * 0.5 + mount * (0.2 + ridge * 0.42);
    const t = seaSide ? v : u, along = seaSide ? u : v;
    const seaF = sstep(0.7, 0.94, t + (nz3.fbm(x * .08, y * .08, 3) - .5) * 0.3) * (0.3 + 0.7 * sstep(0.1, 0.45, 1 - Math.abs(along - bayC) * 1.6));
    h -= seaF * 0.5;
    // gentle depression for a lake somewhere mid-map
    hf[i] = h;
  }
  for (let i = 0; i < W * H; i++) { let L = Math.floor(hf[i] * 10); if (L >= 8) L = 8 + Math.floor((hf[i] * 10 - 8) * 0.9 + nz2.n((i % W) * .35, ((i / W) | 0) * .35) * 1.6); L = clamp(L, 0, 12); M.elev[i] = L; M.water[i] = L < 2 ? 1 : 0; }
  // de-spike: no single land pits / towers
  for (let pass = 0; pass < 2; pass++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y); if (M.water[i]) continue;
    let hi = 0, lo = 99, cnt = 0;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const e = M.elev[idx(nx, ny)]; hi = Math.max(hi, e); lo = Math.min(lo, e); cnt++; }
    if (lo > M.elev[i] && lo >= 2) M.elev[i] = lo;
    if (hi < M.elev[i] - 1) M.elev[i] = hi + 1;
  }
  // lakes vs sea: water not touching map edge => lake
  const seen = new Uint8Array(W * H);
  const q = [];
  for (let i = 0; i < W * H; i++) { const x = i % W, y = (i / W) | 0; if (M.water[i] && (x === 0 || y === 0 || x === W - 1 || y === H - 1)) { seen[i] = 1; q.push(i); } }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % W, y = (i / W) | 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.water[j] && !seen[j]) { seen[j] = 1; q.push(j); } } }
  for (let i = 0; i < W * H; i++) if (M.water[i]) M.bio[i] = seen[i] ? BIO.SEA : BIO.FRESH;
  // tiny ponds (1-2 tiles) become land
  for (let i = 0; i < W * H; i++) if (M.water[i] && !seen[i]) {
    const x = i % W, y = (i / W) | 0; let n = 0;
    for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && M.water[idx(nx, ny)]) n++; }
    if (n === 0) { M.water[i] = 0; M.elev[i] = 2; }
  }

  // rivers
  const nRivers = 1 + (R() < 0.55 ? 1 : 0);
  const srcs = [];
  for (let r = 0; r < nRivers; r++) carveRiver(M, R, srcs);

  // distances
  const dSea = bfsDist(M, i => M.water[i] === 1, 12);
  const dFresh = bfsDist(M, i => M.water[i] === 2 || M.bio[i] === BIO.FRESH, 12);
  // biomes
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y); if (M.water[i]) continue;
    const e = M.elev[i];
    const moist = nz4.fbm(x * 0.07 + 50, y * 0.07 + 50, 4) + (dFresh[i] <= 2 ? 0.08 : 0);
    let b;
    if (e >= 10 || (e >= 9 && moist > 0.42)) b = BIO.SNOW;
    else if (e >= 7) b = moist < 0.6 ? BIO.ROCK : BIO.HIGH;
    else if (dSea[i] <= 1 && e <= 3) b = BIO.SAND;
    else if (e >= 6) b = moist < 0.45 ? BIO.ROCK : BIO.HIGH;
    else if (e >= 5) b = BIO.HIGH;
    else if (moist < 0.38 && e >= 3) b = BIO.BARREN;
    else if (moist > 0.57 || dFresh[i] <= 1) b = BIO.LUSH;
    else b = BIO.MEADOW;
    M.bio[i] = b;
    // trees
    const f = nz3.fbm(x * 0.09 + 20, y * 0.09 + 20, 4);
    if ((b === BIO.MEADOW || b === BIO.LUSH || b === BIO.HIGH) && f > 0.565) {
      M.tree[i] = 1 + (f > 0.6 ? 1 : 0) + (f > 0.66 ? 1 : 0);
      if (b === BIO.HIGH) { M.tree[i] = Math.min(M.tree[i], 2); M.ttype[i] = 2; }
      else if (b === BIO.LUSH) M.ttype[i] = moist > 0.6 ? 3 : 1;
      else M.ttype[i] = nz.n(x * 0.2, y * 0.2) > 0.55 ? 2 : 1;
    } else if ((b === BIO.MEADOW || b === BIO.LUSH) && hash2(x, y, seed) < 0.035) { M.tree[i] = 1; M.ttype[i] = hash2(y, x, seed) < 0.5 ? 1 : 3; }
    M.fert[i] = [0, 0, 0, 2, 3, 1, 0, 0, 0][b] + (dFresh[i] <= 2 || dSea[i] <= 2 ? 1 : 0);
    if ((b === BIO.ROCK || b === BIO.HIGH) && nz2.n(x * 0.3 + 9, y * 0.3 + 9) > 0.62) M.ore[i] = 1;
  }
  // landing site
  const cx = W / 2, cy = H / 2;
  let best = -1e9, land = { x: 32, y: 32 };
  for (let y = 6; y < H - 6; y++) for (let x = 6; x < W - 6; x++) {
    const i = idx(x, y);
    if (M.water[i] || (M.bio[i] !== BIO.MEADOW && M.bio[i] !== BIO.LUSH) || M.elev[i] > 4) continue;
    let ok = 0, flat = 0;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
      if (!M.water[j] && M.elev[j] <= 5) { ok++; if (Math.abs(M.elev[j] - M.elev[i]) <= 1) flat++; }
    }
    const dw = Math.min(dSea[i], dFresh[i]);
    const sc = ok * 0.5 + flat * 0.6 + (dw >= 2 && dw <= 5 ? 14 : dw < 2 ? 4 : 0) - dist(x, y, cx + 4, cy + 4) * 1.2 + R() * 6;
    if (sc > best) { best = sc; land = { x, y }; }
  }
  // clear the landing area a little
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = land.x + dx, ny = land.y + dy; if (inb(nx, ny)) M.tree[idx(nx, ny)] = 0; }
  // Maker ruins
  const ruins = [];
  for (let t = 0; t < 400 && ruins.length < 5; t++) {
    const x = 3 + Math.floor(R() * (W - 6)), y = 3 + Math.floor(R() * (H - 6)), i = idx(x, y);
    if (M.water[i] || M.elev[i] < 3 || M.elev[i] > 7 || M.bio[i] === BIO.SNOW) continue;
    const dl = dist(x, y, land.x, land.y);
    if (dl < 9 + ruins.length * 2) continue;
    if (ruins.some(r => dist(r.x, r.y, x, y) < 11)) continue;
    ruins.push({ x, y });
    M.ruin[i] = 1; M.tree[i] = 0;
    const [dx, dy] = N4[Math.floor(R() * 4)];
    const j = idx(x + dx, y + dy); if (!M.water[j] && Math.abs(M.elev[j] - M.elev[i]) <= 1) { M.ruin[j] = 1; M.tree[j] = 0; }
  }
  for (let i = 0; i < W * H; i++) M.wild[i] = 1;
  return { M, land, ruins };
}

function carveRiver(M, R, srcs) {
  // source: a high tile in the back half
  let src = null;
  for (let t = 0; t < 300; t++) {
    const x = 4 + Math.floor(R() * (W - 8)), y = 4 + Math.floor(R() * (H - 8)), i = idx(x, y);
    if (!M.water[i] && M.elev[i] >= 6 && x + y < W + 10 && srcs.every(s => dist(s % W, (s / W) | 0, x, y) > 24)) { src = i; break; }
  }
  if (src === null) return;
  srcs.push(src);
  // dijkstra to sea, preferring downhill
  const cost = new Float32Array(W * H).fill(1e9), prev = new Int32Array(W * H).fill(-1);
  const open = [src]; cost[src] = 0; let goal = -1;
  while (open.length) {
    let bi = 0; for (let k = 1; k < open.length; k++) if (cost[open[k]] < cost[open[bi]]) bi = k;
    const i = open[bi]; open.splice(bi, 1);
    if (M.water[i] === 1) { goal = i; break; }
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy] of N4) {
      const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
      const up = Math.max(0, M.elev[j] - M.elev[i]);
      let nearR = 0; for (const [ex, ey] of N4) { const qx = nx + ex, qy = ny + ey; if (inb(qx, qy) && M.water[idx(qx, qy)] === 2) nearR = 1; }
      const c = cost[i] + 1 + up * 10 + hash2(nx, ny, 77) * 1.5 + (M.water[j] === 2 ? 3 : 0) + nearR * 6;
      if (c < cost[j]) { if (cost[j] >= 1e9) open.push(j); cost[j] = c; prev[j] = i; }
    }
    if (open.length > 5000) break;
  }
  if (goal < 0) return;
  const path = []; for (let i = prev[goal]; i >= 0; i = prev[i]) path.push(i);
  path.reverse();
  let lvl = 9;
  for (const i of path) {
    if (M.water[i] === 1) break;
    lvl = Math.max(2, Math.min(lvl, M.elev[i]));
    M.elev[i] = lvl; M.water[i] = 2; M.bio[i] = BIO.FRESH; M.tree[i] = 0;
  }
}
