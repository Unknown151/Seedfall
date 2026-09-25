/* ============================== streets: how towns lay themselves out ============================== */
// M.plan marks tiles set aside for streets. They stay grass until a building needs them, then get paved.
// Villages grow winding lanes that follow the land. From Masonry on, towns lay out new quarters as grids
// (each town with its own block size, lined up with its roads), around an old core that stays crooked.

function isStreet(x, y) { return M.plan[idx(x, y)] === 1; }
const DBG = { lane: 0, laneFail: 0, dist: 0, back: 0 };
const netTile = j => (M.road[j] && !M.water[j]) || M.plan[j] === 1 || (M.bld[j] && isRoadAnchor(j));
// a tile a house can stand on and face a street from
function fronts(x, y) { for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && netTile(idx(nx, ny))) return true; } return false; }

// could a street go here? (a field can give way to a new street; the farmers plough a new one further out)
const fieldAt = j => { const B = M.bld[j] && S.B[M.bld[j]]; return !!B && B.type === 'farm' && B.prog >= 1; };
function streetFree(j) {
  if (M.water[j] || M.ruin[j] || M.rail[j] || M.road[j] || M.plan[j]) return false;
  if (M.bld[j] && !fieldAt(j)) return false;
  const b = M.bio[j]; return b !== BIO.SNOW && M.elev[j] <= 8;
}
// set a tile aside for a street. A field there stays until the street is actually needed
function claimStreet(j) { M.plan[j] = 1; }
function clearField(j) { if (fieldAt(j)) { const B = S.B[M.bld[j]], T = S.T[B.sid]; removeBuilding(B); M.plan[j] = 1; if (T) recalcTown(T); } }

function streetMode(T) {
  const lv = lever('streets');
  if (lv === 'winding') return 'organic';
  if (lv === 'planned') return 'grid';
  if (!hasTech('masonry')) return 'organic';
  const k = (T.id * 0.6180339) % 1; // some towns hold on to their crooked lanes longer
  return rnd() < (hasTech('steam') ? .9 : .55) - (k < .25 ? .35 : 0) ? 'grid' : 'organic';
}

// free building plots along a street, near town
function frontageCount(T) {
  if (T._fr && T._fr.m === S.month) return T._fr.n;
  const R = Math.ceil(townRadius(T) + 1); let n = 0;
  refreshOwn();
  for (let y = Math.max(0, T.y - R); y <= Math.min(H - 1, T.y + R); y++) for (let x = Math.max(0, T.x - R); x <= Math.min(W - 1, T.x + R); x++) {
    const i = idx(x, y);
    if (OWN[i] !== T.id || M.water[i] || M.road[i] || M.plan[i] || M.ruin[i] || M.rail[i] || M.bio[i] === BIO.SNOW || M.elev[i] > 7) continue;
    if ((x - T.x) ** 2 + (y - T.y) ** 2 > R * R) continue;
    if (M.bld[i] && !(S.era >= 2 && fieldAt(i) && Math.hypot(x - T.x, y - T.y) < townRadius(T) * .8)) continue; // old fields near the middle count as room
    if (fronts(x, y) && slopeOK(x, y, 2)) n++;
  }
  T._fr = { m: S.month, n };
  return n;
}
function wantFrontage(T) { return clamp(2 + Math.sqrt(T.pop) * .35, 2, 14); }

function growStreets(T) {
  if (T._gsNo > S.month) return false;
  const mode = streetMode(T);
  let ok = mode === 'grid' ? growDistrict(T) || growLane(T) : growLane(T) || growLane(T);
  if (ok) { T._fail = {}; T._fr = null; } else T._gsNo = S.month + 12; // the town is full up: try again next year
  return ok;
}

/* ---------- organic: a lane wanders out from the streets there already are ---------- */
function networkTiles(T, rmax) {
  const out = [], r = Math.ceil(rmax);
  for (let y = Math.max(0, T.y - r); y <= Math.min(H - 1, T.y + r); y++) for (let x = Math.max(0, T.x - r); x <= Math.min(W - 1, T.x + r); x++) {
    const i = idx(x, y); if (!netTile(i)) continue;
    const d = Math.hypot(x - T.x, y - T.y); if (d > rmax) continue;
    let free = 0; for (const [dx, dy] of N4) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && streetFree(idx(nx, ny))) free++; }
    if (free) out.push([i, d]);
  }
  return out;
}
function growLane(T) {
  const R = townRadius(T), lim = R + 3, spine = (T.ln || 0) < 3; // the first few are the village's main streets
  let starts = networkTiles(T, R + 1.5);
  if (spine) { const c = starts.filter(a => a[1] < 1.6); if (c.length) starts = c; }
  if (!starts.length) return false;
  for (let tries = 0; tries < 14; tries++) {
    const [s] = wpick(starts.map(a => [a, 1 + a[1] * .5 + rnd()])); // frontier tiles more often
    const sx = s % W, sy = (s / W) | 0, sd = Math.hypot(sx - T.x, sy - T.y) || 1;
    const dirs = N4.filter(([dx, dy]) => { const nx = sx + dx, ny = sy + dy; return inb(nx, ny) && laneStep(idx(nx, ny), s, dx, dy, T, lim) === 1; });
    if (!dirs.length) continue;
    let [dx, dy] = wpick(dirs.map(d => [d, Math.max(.15, 1 + 2 * (d[0] * (sx - T.x) + d[1] * (sy - T.y)) / sd) + rnd() * .6])); // heading out of town
    const lane = []; let cur = s, len = spine ? ri(6, 11) : ri(4, 9), run = 0;
    for (let k = 0; k < len; k++) {
      const x = cur % W, y = (cur / W) | 0, turn = spine ? .12 : .32;
      const opts = [[dx, dy, run < 3 ? 8 : 3], [-dy, dx, turn], [dy, -dx, turn]];
      const ws = [];
      for (const [ex, ey, w0] of opts) {
        const nx = x + ex, ny = y + ey; if (!inb(nx, ny)) continue;
        const j = idx(nx, ny), st = laneStep(j, cur, ex, ey, T, lim, lane);
        if (st === 2 && lane.length >= 2) { ws.push([[ex, ey, j, true], w0 * 4]); continue; } // meet another street: done
        if (st !== 1) continue;
        let w = w0 * (M.tree[j] >= 2 ? .3 : 1) * (fieldAt(j) ? .6 : 1) * (Math.abs(M.elev[j] - M.elev[cur]) ? .4 : 1); // round the big trees, along the contours
        // leave room for a house on each side between this lane and the next one over
        const px = nx - ey * 2, py = ny + ex * 2, qx = nx + ey * 2, qy = ny - ex * 2;
        if ((inb(px, py) && netTile(idx(px, py))) || (inb(qx, qy) && netTile(idx(qx, qy)))) w *= k < 1 ? .6 : .15;
        ws.push([[ex, ey, j, false], w]);
      }
      if (!ws.length) break;
      const [ex, ey, j, join] = wpick(ws);
      if (join) break;
      if (ex !== dx || ey !== dy) run = 0; else run++;
      dx = ex; dy = ey; lane.push(j); cur = j;
    }
    if (lane.length < 2) continue;
    for (const j of lane) claimStreet(j);
    T.ln = (T.ln || 0) + 1; DBG.lane++;
    return true;
  }
  DBG.laneFail++;
  return false;
}
// 1 = the lane can go here, 2 = it would meet the network here, 0 = no
function laneStep(j, from, dx, dy, T, lim, lane) {
  const x = j % W, y = (j / W) | 0;
  if (Math.hypot(x - T.x, y - T.y) > lim) return 0;
  if (netTile(j)) return 2;
  if (!streetFree(j) || Math.abs(M.elev[j] - M.elev[from]) > 1) return 0;
  refreshOwn(); if (OWN[j] && OWN[j] !== T.id) return 0;
  // keep lanes one tile wide and apart: nothing alongside except where we came from
  for (const [ex, ey] of N4) {
    const nx = x + ex, ny = y + ey; if (!inb(nx, ny)) continue;
    const k = idx(nx, ny); if (k === from) continue;
    if ((netTile(k) && !(ex === dx && ey === dy)) || (lane && lane.includes(k))) return 0;
  }
  return 1;
}

/* ---------- planned: a new quarter laid out as a grid ---------- */
function growDistrict(T) {
  const g = T.grid || (T.grid = { sx: ri(3, 5), sy: ri(3, 6), set: 0, ox: T.x, oy: T.y });
  const R = townRadius(T);
  const starts = networkTiles(T, R + 2);
  const edge = starts.filter(a => a[1] >= Math.max(1, R - 2.5));
  const pool = edge.length ? edge : starts; if (!pool.length) return false;
  for (let tries = 0; tries < 8; tries++) {
    const [s] = pick(pool), ax = s % W, ay = (s / W) | 0;
    if (!g.set) { g.ox = ax; g.oy = ay; g.set = 1; }
    const ux = Math.sign(ax - T.x) || (chance(.5) ? 1 : -1), uy = Math.sign(ay - T.y) || (chance(.5) ? 1 : -1);
    const w = g.sx * ri(2, 3), h = g.sy * ri(2, 3);
    const alone = starts.length <= 4; // a brand new town: lay it out all round the square
    const x0 = alone ? ax - Math.floor(w / 2) : ux > 0 ? ax : ax - w, y0 = alone ? ay - Math.floor(h / 2) : uy > 0 ? ay : ay - h;
    const add = []; let land = 0, all = 0, used = 0;
    for (let y = y0; y <= y0 + h; y++) for (let x = x0; x <= x0 + w; x++) {
      if (!inb(x, y)) continue; const i = idx(x, y); all++;
      if (!M.water[i]) land++;
      if ((M.bld[i] && !fieldAt(i)) || (M.road[i] && !M.water[i])) used++;
      if (Math.hypot(x - T.x, y - T.y) > R + 6) continue;
      const on = ((x - g.ox) % g.sx + g.sx) % g.sx === 0 || ((y - g.oy) % g.sy + g.sy) % g.sy === 0;
      if (on && streetFree(i) && slopeOK(x, y, 1)) add.push(i);
    }
    if (add.length < 4 || land < all * .5 || used > all * (alone ? .5 : .18)) continue; // open ground only
    for (const i of add) claimStreet(i);
    DBG.dist++; (DBG.where = DBG.where || []).push([x0 + (w >> 1), y0 + (h >> 1), yr()]);
    if (!S.flags.gridFirst) { S.flags.gridFirst = 1; chron('📐', `${T.name} lays out its first planned streets: straight, square, and very proud of it.`, { x: ax, y: ay, k: 'major', cap: 'Planned streets' }); }
    else if (chance(.2) && S.year - (T.qYr || -99) > 60) { T.qYr = S.year; chron('📐', `${T.name} marks out a new quarter${S.age ? '' : ` on the ${pick(['east', 'west', 'north', 'south'])} side`}, in neat straight streets.`, { x: ax, y: ay }); }
    return true;
  }
  return false;
}

// last resort: any open tile near the middle of town
function anyPlot(T) {
  for (let r = 1; r <= 4; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
    const x = T.x + dx, y = T.y + dy; if (!inb(x, y)) continue; const i = idx(x, y);
    if (!M.water[i] && !M.bld[i] && !M.ruin[i] && !M.road[i] && !M.rail[i] && M.bio[i] !== BIO.SNOW) return { x, y };
  }
  return null;
}

/* ---------- joining a new building to the streets ---------- */
function connectRoad(B) {
  const start = idx(B.x, B.y);
  if (pavePath(start, 14, j => M.plan[j] === 1)) return;
  pavePath(start, 10, j => !M.water[j] && !M.bld[j] && !M.ruin[j] && !M.rail[j]); // no street near: a track across the fields
}
function pavePath(start, maxD, ok) {
  const prev = new Map([[start, -1]]); let q = [start], found = -1;
  for (let d = 0; d < maxD && q.length && found < 0; d++) {
    const nq = [];
    for (const i of q) {
      const x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny);
        if (prev.has(j)) continue;
        if (j !== start && ((M.road[j] && !M.water[j]) || (M.bld[j] && isRoadAnchor(j)))) { prev.set(j, i); found = j; break; }
        if (M.water[j] || M.ruin[j] || !ok(j)) continue;
        if (M.bld[j] && !(M.plan[j] && fieldAt(j))) continue;
        if (i !== start && Math.abs(M.elev[j] - M.elev[i]) > 1) continue;
        prev.set(j, i); nq.push(j);
      }
      if (found >= 0) break;
    }
    q = nq;
  }
  if (found < 0) return false;
  const t = roadTier();
  for (let i = prev.get(found); i !== start && i >= 0; i = prev.get(i)) { clearField(i); M.plan[i] = 1; if (!M.road[i]) { M.road[i] = t; M.tree[i] = 0; M.wild[i] = 0; markDirty(i); } }
  return true;
}

/* ---------- saves from before: the old every-fourth-row grid becomes the plan, so old towns keep their streets ---------- */
function legacyStreets() {
  OWN_M = -1; refreshOwn();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = idx(x, y), id = OWN[i]; if (!id) continue;
    const T = S.T[id]; if (!T || dist(x, y, T.x, T.y) > townRadius(T) + 5) continue;
    const dx = x - T.x, dy = y - T.y;
    if ((((dx % 4) + 4) % 4 === 0 || ((dy % 4) + 4) % 4 === 0) && (M.road[i] || streetFree(i))) M.plan[i] = 1;
  }
  for (const T of towns()) T.grid = T.grid || { sx: 4, sy: 4, set: 1, ox: T.x, oy: T.y };
}
