/* ============================== incidents: things that happen somewhere, and that you can watch ============================== */
// An incident is staged at a real place for a few sim months: a house fire, the sheep loose in the market... Its sim part
// (S.inc: what, where, when; the outcome is rolled when it ends) runs in stepIncidents on the sim's own stream, so it is
// saved, survives a reload and replays the same. Its view part (INCV: the people, props, flames and smoke) is made up
// from that each time it's on screen and is never saved. During catch-up months fly by, so an incident is just its two
// chronicle lines. The bus hears 'incident' {I} when one starts and {I, end: true} when it's over; the film camera
// goes to look. To add one: an INC entry (yr: chance a year, n: months, begin() -> the incident or null, end(I)) and an
// INC_VIEW entry (called every frame in 3D with the incident, its view state and how far along it is, 0..1).
const INC = {
  fire: {
    yr: .07, n: 3,
    begin() {
      const hs = Object.values(S.B).filter(B => B.type === 'house' && B.prog >= 1 && B.tier >= 1 && B.tier <= 5 && !B.hid && S.T[B.sid]);
      if (!hs.length) return null;
      const B = pick(hs), T = S.T[B.sid], st = rcls(nearestRoad(B.x, B.y)) >= 3 ? 'street' : 'lane';
      chron('🔥', pick([`Fire! A house on a ${st} of ${T.name} is burning. The neighbours are out with buckets.`, `Smoke over ${T.name}: a house has caught fire, and the whole ${st} turns out to fight it.`, `A chimney fire in ${T.name} gets into the roof beams. Bells ring, and the buckets come running.`]), { x: B.x, y: B.y, cap: 'Fire!' });
      return { k: 'fire', x: B.x, y: B.y, sid: T.id, bid: B.id };
    },
    end(I) {
      const B = S.B[I.bid], T = S.T[I.sid]; if (!B || !T) return;
      const saved = chance(.55 + (hasTech('electric') ? .3 : hasTech('steam') ? .15 : 0)); // (fire brigades, then hydrants)
      if (saved) { chron('🪣', pick([`The fire in ${T.name} is out. The house is scorched but standing, and the family are back in by nightfall.`, `${T.name} saves the burning house. Everyone on the ${hasTech('steam') ? 'street' : 'lane'} is soaked, and very proud.`]), { x: I.x, y: I.y, nocap: true }); return; }
      removeBuilding(B); T._fail = {};
      chron('🏚️', pick([`The house in ${T.name} burns to the ground. Nobody is hurt; the neighbours take the family in until a new one goes up.`, `Nothing could save the house in ${T.name}. By spring a new one is rising on the same plot.`]), { x: I.x, y: I.y, nocap: true });
    }
  },
  sheep: {
    yr: .06, n: 2,
    begin() {
      if (!hasTech('herding')) return null;
      const ts = towns().filter(T => T.bl.some(id => S.B[id] && S.B[id].type === 'pasture' && S.B[id].prog >= 1) && T.bl.some(id => S.B[id] && (S.B[id].type === 'market' || S.B[id].type === 'plaza') && S.B[id].prog >= 1));
      if (!ts.length) return null;
      const T = pick(ts), bl = T.bl.map(id => S.B[id]).filter(Boolean), P = pick(bl.filter(B => B.type === 'pasture')), mk = bl.find(B => B.type === 'market' && B.prog >= 1) || bl.find(B => B.type === 'plaza');
      chron('🐑', pick([`Someone left the gate open in ${T.name}. The sheep are in the market.`, `The sheep of ${T.name} have found the market, and the cabbages.`, `A flock gets loose in ${T.name} and makes straight for the market square.`]), { x: mk.x, y: mk.y, cap: 'Sheep loose!' });
      return { k: 'sheep', x: mk.x, y: mk.y, px: P.x, py: P.y, sid: T.id };
    },
    end(I) {
      const T = S.T[I.sid]; if (!T) return;
      chron('🧶', pick([`Every sheep of ${T.name} is back in its field. Nobody will say who left the gate open.`, `The flock is home in ${T.name}, minus three cabbages and a hat.`, `The sheep are rounded up in ${T.name}. The market sweeps up and carries on.`, `${T.name}'s runaway sheep are back behind the gate, looking pleased with themselves.`]), { x: I.x, y: I.y, nocap: true });
    }
  },
  wedding: {
    yr: .08, n: 2,
    begin() {
      const ts = towns().filter(T => T.pop > 60); if (!ts.length) return null;
      const T = pick(ts), ad = Object.values(S.P).filter(q => q.sid === T.id && q.died === null && !q.sp && age(q) >= 20 && age(q) <= 50);
      if (ad.length < 2) return null;
      const a = pick(ad), cand = ad.filter(q => q !== a && Math.abs(age(q) - age(a)) <= 12 && !related(a, q)); if (!cand.length) return null;
      const b = pick(cand), V = T.bl.map(id => S.B[id]).find(B => B && B.prog >= 1 && (B.type === 'shrine' || B.type === 'hall' || B.type === 'plaza')) || S.B[T.bl[0]]; if (!V) return null;
      chron('💒', pick([`${a.first} and ${b.first} are getting married in ${T.name}! The whole street follows them with flowers.`, `Wedding bells in ${T.name}: ${a.first} and ${b.first}. The procession sets off, and so does half the town.`, `${T.name} turns out for ${a.first} and ${b.first}'s wedding: a procession, petals, and a fiddler who knows three tunes.`]), { x: V.x, y: V.y, cap: 'A wedding!' });
      return { k: 'wedding', x: V.x, y: V.y, sid: T.id, a: a.id, b: b.id };
    },
    end(I) {
      const a = S.P[I.a], b = S.P[I.b], T = S.T[I.sid]; if (!a || !b || !T || a.died !== null || b.died !== null || a.sp || b.sp) return;
      marry(a, b);
      chron('💍', pick([`${a.first} and ${b.first} are married. The party in ${T.name} goes on until the lamps run dry.`, `${T.name} dances ${a.first} and ${b.first} into married life. Somebody's uncle gives a speech that goes on a bit.`]), { T, nocap: true });
    }
  },
  flood: {
    yr: .035, n: 3,
    begin() {
      const ts = towns().filter(T => incFloodTiles(T.x, T.y).length >= 4); if (!ts.length) return null;
      const T = pick(ts), f = incFloodTiles(T.x, T.y), c = f[(f.length / 2) | 0];
      chron('🌊', pick([`The river bursts its banks at ${T.name}. Water in the lower streets, and everyone carrying things uphill.`, `After weeks of rain the river rises into ${T.name}. Boats in the lanes, chickens on the roofs.`]), { x: c % W, y: (c / W) | 0, cap: 'Flood!' });
      return { k: 'flood', x: c % W, y: (c / W) | 0, tx: T.x, ty: T.y, sid: T.id };
    },
    end(I) {
      const T = S.T[I.sid]; if (!T) return;
      T.pop *= .97; // (a hard season, not a disaster)
      chron('🧹', pick([`The water goes down in ${T.name}. Mud everywhere, but the fields will be richer for the silt.`, `${T.name} dries out after the flood and starts talking about a proper embankment.`]), { x: I.x, y: I.y, nocap: true });
    }
  },
  cart: {
    yr: .05, n: 2,
    begin() {
      if (!hasTech('wheel')) return null;
      const ts = towns().filter(T => T.pop > 40 && M.road[idx(T.x, T.y)] !== undefined); if (!ts.length) return null;
      const T = pick(ts), r = nearestRoad(T.x, T.y); if (!M.road[r]) return null;
      chron('🥬', pick([`A cart of cabbages gets away from its farmer in ${T.name} and rolls off down the street, shedding cabbages as it goes.`, `Runaway cart in ${T.name}! Cabbages everywhere, and the children of the town are delighted.`]), { x: r % W, y: (r / W) | 0, cap: 'Runaway cart!' });
      return { k: 'cart', x: r % W, y: (r / W) | 0, sid: T.id };
    },
    end(I) {
      const T = S.T[I.sid]; if (!T) return;
      chron('🥗', pick([`Every cabbage in ${T.name} is found, give or take a few. There is cabbage soup on every table tonight.`, `The runaway cart of ${T.name} is back on its wheels. The farmer is selling "bruised but brave" cabbages at half price.`]), { x: I.x, y: I.y, nocap: true });
    }
  },
  whale: {
    yr: .02, n: 3,
    begin() {
      if (!hasTech('boats')) return null;
      const opts = [];
      for (const T of towns()) for (let dy = -9; dy <= 9; dy++) for (let dx = -9; dx <= 9; dx++) { const x = T.x + dx, y = T.y + dy; if (!inb(x, y)) continue; const i = idx(x, y); if (M.water[i] || M.bld[i] || M.road[i]) continue; const d = N4.find(([a, b]) => inb(x + a, y + b) && M.water[idx(x + a, y + b)] === 1); if (d) opts.push([x, y, d[0], d[1], T]); }
      if (!opts.length) return null;
      const [x, y, dx, dy, T] = pick(opts);
      chron('🐋', pick([`A whale has come ashore on the beach by ${T.name}. The whole town comes down to look, and to keep it wet.`, `There is a whale on the beach at ${T.name}! Buckets, blankets and a great deal of advice.`]), { x, y, cap: 'A whale!' });
      return { k: 'whale', x, y, dx, dy, sid: T.id };
    },
    end(I) {
      const T = S.T[I.sid];
      chron('🌊', pick([`With the high tide and every back in ${T ? T.name : 'town'} pushing, the whale slides free and swims off. The children wave until it's gone.`, `The whale is back in the sea. ${T ? T.name : 'The town'} will tell the story for a hundred years, each time a little bigger.`]), { x: I.x, y: I.y, nocap: true });
    }
  }
};
// the low ground by a river near a town that a flood would cover (the same answer in the sim and the view)
function incFloodTiles(tx, ty) {
  const o = [];
  for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) {
    const x = tx + dx, y = ty + dy; if (!inb(x, y)) continue; const i = idx(x, y); if (M.water[i]) continue;
    let lo = 99; for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) { const nx = x + xx, ny = y + yy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.water[j] && M.bio[j] === BIO.FRESH) lo = Math.min(lo, M.elev[j]); }
    if (lo < 99 && M.elev[i] <= lo + 1) o.push(i);
  }
  return o.slice(0, 48);
}
function nearestRoad(x, y) { for (let r = 0; r <= 3; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && M.road[idx(nx, ny)]) return idx(nx, ny); } return idx(x, y); }
// monthly, in the sim: incidents that are over end, and now and then a new one begins (one of each kind at a time)
function stepIncidents() {
  const L = S.inc || (S.inc = []);
  for (let k = L.length - 1; k >= 0; k--) { const I = L[k]; if (S.month >= I.t0 + I.n) { L.splice(k, 1); const d = INC[I.k]; if (d) d.end(I); EV.fire('incident', { I, end: true }); } }
  if (L.length >= 2 || S.flags.intro || yr() < 20) return;
  for (const k in INC) if (!L.some(I => I.k === k) && chance(INC[k].yr / 12) && startIncident(k)) break;
}
function startIncident(k) { // (also SF.incident(k), for trying one out)
  const d = INC[k], I = d && d.begin(); if (!I) return null;
  Object.assign(I, { id: (S.incN = (S.incN || 0) + 1), t0: S.month, n: d.n }); (S.inc || (S.inc = [])).push(I); EV.fire('incident', { I });
  return I;
}
// how far along an incident is right now, 0..1 (between sim months too, so it moves smoothly)
function incProg(I) { const ms = (PACE[S.settings.pace] || 180) / 12, m = S.month + (UI.paused ? 0 : clamp(simAcc / ms, 0, 1)); return clamp((m - I.t0) / I.n, 0, 1); }

/* ---------- what you see (3D) ---------- */
const INCV = new Map(); // incident id -> its view state (never saved)
const INC_LOOK = { col: ['#8a3f37', '#3f5f8a', '#6b5a3a', '#4f6f4a', '#7a5a7a', '#c9a24a', '#5a5a62'], skin: ['#e0b090', '#c68f6a', '#8d5a3f', '#f0c8a8', '#a8704f'], hair: ['#2b211c', '#5a3a24', '#8a6a3a', '#c9b48a', '#1c1c1c', '#9a9a9a'] };
function incActor(i) { const r = k => INC_LOOK[k][(hash2(i, k.length, 331) * INC_LOOK[k].length) | 0]; return { col: r('col'), skin: r('skin'), hair: r('hair'), pants: '#3d3a38', ph: i * 1.7 }; }
const incY = (x, z) => { const i = idx(clamp(Math.round(x), 0, W - 1), clamp(Math.round(z), 0, H - 1)); return tileZ(i) * ZS; };
function glIncidents(dt) {
  const L = S.inc || []; if (!L.length) { if (INCV.size) INCV.clear(); return; }
  const live = new Set();
  for (const I of L) { live.add(I.id); const f = INC_VIEW[I.k]; if (!f) continue; let st = INCV.get(I.id); if (!st) INCV.set(I.id, st = {}); try { f(I, st, incProg(I), dt); } catch (e) { if (QS.has('dev')) console.error(e); } }
  for (const k of INCV.keys()) if (!live.has(k)) INCV.delete(k);
}
function incFlame(X, Y, Z, w, h, col, spin) { // a glowing four-sided tongue of flame, bent a little by the wind
  const T = [X + Math.sin(spin * 1.7) * w * .6, Y + h, Z + Math.cos(spin * 1.3) * w * .6], P = k => { const a = spin + k * TAU / 4; return [X + Math.cos(a) * w, Y, Z + Math.sin(a) * w]; };
  GLB.ctr = [X, Y - .05, Z]; for (let k = 0; k < 4; k++) gtri(P(k), P(k + 1), T, col, 2);
}
const INC_VIEW = {
  fire(I, st, p, dt) {
    const x = I.x, z = I.y, base = incY(x, z), top = Math.max(base + .35, hfAt(x, z) || 0), heat = p < .12 ? p / .12 : p > .75 ? (1 - p) / .25 : 1;
    if (!st.chain) { // a bucket chain from the nearest water or well, else a crowd round the house
      let src = null, bd = 9;
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const nx = x + dx, ny = z + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny), B = S.B[M.bld[j]], d = Math.hypot(dx, dy); if (d < bd && (M.water[j] && !M.road[j] || B && B.type === 'well')) { bd = d; src = [nx, ny]; } }
      st.chain = []; const n = src ? clamp(Math.round(bd * 2.2), 3, 12) : 0;
      for (let k = 0; k < n; k++) { const t = (k + .5) / n, px = src[0] + (x - src[0]) * t * .92, pz = src[1] + (z - src[1]) * t * .92, j = idx(Math.round(px), Math.round(pz)); if (M.bld[j] && M.bld[j] !== M.bld[idx(x, z)] && !(S.B[M.bld[j]] && S.B[M.bld[j]].type === 'well')) continue; st.chain.push({ o: incActor(I.id * 31 + k), x: px + (k % 2 ? .06 : -.06), z: pz, h: Math.atan2(z - src[1], x - src[0]) + (k % 2 ? 1.2 : -1.2) }); }
      st.crowd = []; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU + I.id, r = 1.15 + (k % 2) * .25; st.crowd.push({ o: incActor(I.id * 17 + k + 50), x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, h: a + Math.PI }); }
    }
    const t = GL3.t;
    for (const a of st.chain) { a.o.ph += dt * 2; glPerson(a.o, a.x, a.z, incY(a.x, a.z), a.h, false, false); }
    for (let k = 0; k + 1 < st.chain.length; k++) { const a = st.chain[k], b = st.chain[k + 1], u = (t * .9 + k * .5) % 1; if (u > .5) continue; const w = u * 2, bx = a.x + (b.x - a.x) * w, bz = a.z + (b.z - a.z) * w; GLB.mat = 0; glOBox([bx, incY(bx, bz) + .1, bz], [.012, 0, 0], [0, 0, .012], [0, .014, 0], '#6b5040'); } // buckets going hand to hand
    for (const a of st.crowd) glPerson(a.o, a.x, a.z, incY(a.x, a.z), a.h, false, false);
    if (heat <= .02) return;
    GLB.mat = 0;
    for (let k = 0; k < 11; k++) { // tongues of flame licking up out of the roof, flickering, yellow at the heart
      const a = k / 11 * TAU + I.id, r = k < 3 ? .03 : .1 + ((k * 7) % 3) * .06, fl = .5 + .5 * Math.sin(t * (6 + k * .7) + k * 2.1), h = (.2 + .26 * fl) * heat * (k < 3 ? 1.35 : 1), w = (.06 + .025 * fl) * heat;
      incFlame(x + Math.cos(a) * r, top - .04, z + Math.sin(a) * r, w, h, k < 3 ? [1, .86, .35] : k % 2 ? [1, .52, .14] : [.98, .33, .08], t * 1.3 + k);
    }
    if (GL3.carry) GL3.carry.push([x, top + .15, z]); // it lights up the street at night
    const P = GL3.smoke; if (P && P.length < 900 && Math.random() < dt * 9 * heat) P.push({ x: x + (Math.random() - .5) * .3, y: top + .12, z: z + (Math.random() - .5) * .3, a: 0, L: 5 + Math.random() * 3, s0: .2, s1: 1.3, o: .9, sh: .3 });
  },
  sheep(I, st, p, dt) {
    const x = I.x, z = I.y;
    if (!st.flock) {
      st.spots = []; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = z + dy; if (!inb(nx, ny)) continue; const j = idx(nx, ny), B = S.B[M.bld[j]]; if (!M.water[j] && (M.road[j] || !B || B.type === 'market' || B.type === 'plaza')) st.spots.push([nx, ny]); }
      if (!st.spots.length) st.spots.push([x, z]);
      st.flock = []; for (let k = 0; k < 9; k++) { const s = st.spots[(Math.random() * st.spots.length) | 0]; st.flock.push({ x: s[0] + (Math.random() - .5) * .6, z: s[1] + (Math.random() - .5) * .6, tx: s[0], tz: s[1], sp: .35 + Math.random() * .3, s: 1.15 + Math.random() * .3, ph: Math.random() * 6, rest: 0 }); }
      st.herders = []; for (let k = 0; k < 3; k++) { const s = st.spots[(Math.random() * st.spots.length) | 0]; st.herders.push({ o: incActor(I.id * 13 + k), x: s[0], z: s[1], who: k % st.flock.length, dx: 1, dz: 0 }); }
    }
    const home = p > .72; // at the end they're driven back to their field
    for (const m of st.flock) {
      if (home) { m.tx = I.px; m.tz = I.py; }
      else if (Math.hypot(m.tx - m.x, m.tz - m.z) < .1) { if ((m.rest -= dt) <= 0) { const s = st.spots[(Math.random() * st.spots.length) | 0]; m.tx = s[0] + (Math.random() - .5) * .7; m.tz = s[1] + (Math.random() - .5) * .7; m.rest = Math.random() * 2.5; } }
      const dx = m.tx - m.x, dz = m.tz - m.z, d = Math.hypot(dx, dz), mv = d > .05;
      if (mv) { const s = Math.min(d, m.sp * (home ? 1.4 : 1) * dt); m.x += dx / d * s; m.z += dz / d * s; m.ph += dt * 9; }
      glSheep(m.x, m.z, incY(m.x, m.z), m.s, glHeading(m, dx, dz), mv ? m.ph : -1);
    }
    for (const h of st.herders) { // townsfolk running after them, arms out
      const m = st.flock[h.who], dx = m.x - h.x - (home ? (I.px - m.x) * .15 : 0), dz = m.z - h.z - (home ? (I.py - m.z) * .15 : 0), d = Math.hypot(dx, dz), mv = d > .25;
      if (mv) { const s = Math.min(d - .2, .5 * dt); h.x += dx / d * s; h.z += dz / d * s; h.o.ph += dt * 10; } else if (!home && Math.random() < dt * .4) h.who = (Math.random() * st.flock.length) | 0;
      glPerson(h.o, h.x, h.z, incY(h.x, h.z), glHeading(h, dx, dz), mv, false);
    }
  },
  wedding(I, st, p, dt) {
    if (!st.route) {
      const a = nearestRoad(I.x, I.y); let b = a;
      for (let r = 5; r >= 2 && b === a; r--) for (let k = 0; k < 8 && b === a; k++) { const ang = k / 8 * TAU + I.id, j = nearestRoad(clamp(Math.round(I.x + Math.cos(ang) * r), 0, W - 1), clamp(Math.round(I.y + Math.sin(ang) * r), 0, H - 1)); if (M.road[j] && j !== a) b = j; }
      const path = ((b !== a && navPath(a, b, 0)) || [a]).slice(0, 9); st.route = path.map(j => [j % W, (j / W) | 0]); st.len = Math.max(1, st.route.length - 1); // (a short walk the camera can follow)
      st.folk = []; for (let k = 0; k < 10; k++) { const o = incActor(I.id * 7 + k); if (k === 0) Object.assign(o, { col: '#f4f1ea', pants: '#f4f1ea' }); if (k === 1) Object.assign(o, { col: '#2f2f3a', pants: '#2f2f3a' }); if (k === 2) o.col = '#c9a24a'; st.folk.push({ o, lag: k < 2 ? k * .25 : .6 + (k - 2) * .32, side: k % 2 ? .12 : -.12 }); }
      st.petals = [];
    }
    const go = (p * 2) % 2, s0 = (go < 1 ? go : 2 - go) * st.len; // there and back again, all the way along
    for (const f of st.folk) {
      const s1 = clamp(s0 - f.lag * (go < 1 ? 1 : -1), 0, st.len), k = Math.min(st.route.length - 2, Math.floor(s1)), A = st.route[Math.max(0, k)], B = st.route[Math.max(0, Math.min(st.route.length - 1, k + 1))], u = s1 - Math.max(0, k);
      const dx = B[0] - A[0], dz = B[1] - A[1], x = A[0] + dx * u - dz * f.side, z = A[1] + dz * u + dx * f.side, dir = go < 1 ? 1 : -1;
      f.o.ph += dt * 7; glPerson(f.o, x, z, incY(x, z), glHeading(f, dx * dir, dz * dir), true, false); if (f === st.folk[0]) { st.fx = x; st.fz = z; }
      if (f === st.folk[0] && Math.random() < dt * 14) st.petals.push({ x, z, y: incY(x, z) + .32, vx: (Math.random() - .5) * .3, vz: (Math.random() - .5) * .3, t: 0, c: FLOWER_C[(Math.random() * FLOWER_C.length) | 0] });
    }
    GLB.mat = 0;
    for (let k = st.petals.length - 1; k >= 0; k--) { const q = st.petals[k]; q.t += dt; q.x += q.vx * dt; q.z += q.vz * dt; q.y -= dt * .12; if (q.t > 2.5) { st.petals.splice(k, 1); continue; } glOBox([q.x, q.y, q.z], [.008, 0, 0], [0, 0, .008], [0, .002, 0], q.c, .3); } // petals thrown over the couple
  },
  flood(I, st, p, dt) {
    if (!st.tiles) { st.tiles = incFloodTiles(I.tx, I.ty); st.carry = []; for (let k = 0; k < 5; k++) st.carry.push({ o: incActor(I.id * 11 + k), s: Math.random(), i: st.tiles[(k * 7) % st.tiles.length] }); }
    const rise = (p < .25 ? p / .25 : p > .7 ? (1 - p) / .3 : 1) * .11; if (rise <= .002) return;
    GLB.mat = 0; GLB.ctr = [I.x, -5, I.y];
    for (const i of st.tiles) { const x = i % W, z = (i / W) | 0, y = surfZ(i) * ZS + rise; gquad([x - .5, y, z - .5], [x - .5, y, z + .5], [x + .5, y, z + .5], [x + .5, y, z - .5], [.42, .55, .5], -1); } // brown-green floodwater (drawn as water)
    for (const c of st.carry) { // folk wading uphill with their things, and back for more
      c.s = (c.s + dt * .12) % 1; const x0 = c.i % W, z0 = (c.i / W) | 0, ax = I.tx - x0, az = I.ty - z0, L = Math.hypot(ax, az) || 1, u = c.s < .5 ? c.s * 2 : 2 - c.s * 2, x = x0 + ax / L * u * 2.2, z = z0 + az / L * u * 2.2;
      c.o.ph += dt * 6; glPerson(c.o, x, z, incY(x, z), glHeading(c, ax * (c.s < .5 ? 1 : -1), az * (c.s < .5 ? 1 : -1)), true, false);
      if (c.s < .5) { GLB.mat = M_PLANK; glOBox([x, incY(x, z) + .26, z], [.03, 0, 0], [0, 0, .025], [0, .025, 0], '#8a6a48'); GLB.mat = 0; } // a chest held up out of the wet
    }
  },
  cart(I, st, p, dt) {
    if (!st.route) {
      const a = nearestRoad(I.x, I.y); let b = a, bd = 0;
      for (let dy = -7; dy <= 7; dy++) for (let dx = -7; dx <= 7; dx++) { const x = I.x + dx, y = I.y + dy; if (!inb(x, y)) continue; const j = idx(x, y); if (!M.road[j] || M.water[j]) continue; const d = Math.hypot(dx, dy) + (surfZ(a) - surfZ(j)) * .8; if (d > bd && d < 9) { bd = d; b = j; } } // downhill, if there's a hill
      const path = ((b !== a && navPath(a, b, 0)) || [a]).slice(0, 8); st.route = path.map(j => [j % W, (j / W) | 0]); st.len = Math.max(1, st.route.length - 1);
      st.cabs = []; st.farmer = { o: incActor(I.id * 5), s: 0 }; st.kids = [0, 1, 2].map(k => ({ o: Object.assign(incActor(I.id * 9 + k), { kid: true }), x: I.x + k * .3, z: I.y, t: -1 }));
      st.drop = 0;
    }
    const at = s => { const k = Math.min(st.route.length - 2, Math.floor(s)), A = st.route[Math.max(0, k)], B = st.route[Math.min(st.route.length - 1, Math.max(0, k) + 1)], u = s - Math.max(0, k); return [A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, B[0] - A[0], B[1] - A[1]]; };
    const q = Math.min(1, p / .5), s = q * q * st.len, [cx, cz, hx, hz] = at(Math.min(s, st.len - .001)); st.fx = cx; st.fz = cz; const cy = incY(cx, cz), h = glHeading(st, hx, hz), f = [Math.cos(h), 0, Math.sin(h)], r = [-f[2], 0, f[0]], tip = p > .5 ? .5 : 0;
    GLB.mat = M_PLANK; glOBox([cx, cy + .1, cz], V3s(f, .15), V3s(r, .09), [0, .045 + tip * .03, 0], '#8a6a48'); // the cart (on its side at the end)
    GLB.mat = 0; for (const sg of [-1, 1]) glOBox([cx + r[0] * .1 * sg, cy + .065, cz + r[2] * .1 * sg], V3s(f, .06), V3s(r, .008), [0, .06, 0], '#4a3a2c');
    if (p < .5) for (let k = 0; k < 4; k++) glBlob(cx + f[0] * (k - 1.5) * .065, cz + f[2] * (k - 1.5) * .065, .042, (cy + .17) / ZS, 1, '#7fb05a', 0); // what's left of the load
    if (p < .5 && s - st.drop > .35) { st.drop = s; st.cabs.push({ x: cx, z: cz, vx: r[0] * (Math.random() - .5) * .8 + f[0] * .3, vz: r[2] * (Math.random() - .5) * .8 + f[2] * .3, got: false }); } // a cabbage bounces off
    for (const c of st.cabs) { if (c.got) continue; c.x += c.vx * dt; c.z += c.vz * dt; c.vx *= Math.pow(.2, dt); c.vz *= Math.pow(.2, dt); glBlob(c.x, c.z, .038, incY(c.x, c.z) / ZS + .85, .85, '#8cbf62', 0); }
    st.farmer.s = Math.min(s - .5, st.farmer.s + dt * .55); { const [fx, fz, dx, dz] = at(clamp(st.farmer.s, 0, st.len - .001)); st.farmer.o.ph += dt * 11; glPerson(st.farmer.o, fx, fz, incY(fx, fz), glHeading(st.farmer, dx, dz), st.farmer.s < s - .6 || p < .5, false); } // the farmer, running after it
    for (const kd of st.kids) { // the children of the town, gathering cabbages
      const c = st.cabs.find(c => !c.got && (!c.by || c.by === kd)); if (!c) { glPerson(kd.o, kd.x, kd.z, incY(kd.x, kd.z), kd._gh || 0, false, false); continue; } c.by = kd;
      const dx = c.x - kd.x, dz = c.z - kd.z, d = Math.hypot(dx, dz); if (d < .06) { c.got = true; continue; }
      const v = Math.min(d, dt * .7); kd.x += dx / d * v; kd.z += dz / d * v; kd.o.ph += dt * 12; glPerson(kd.o, kd.x, kd.z, incY(kd.x, kd.z), glHeading(kd, dx, dz), true, false);
    }
  },
  whale(I, st, p, dt) {
    const out = p > .82 ? (p - .82) / .18 : 0, x = I.x + I.dx * (.35 + out * 2.5), z = I.y + I.dy * (.35 + out * 2.5), y0 = incY(I.x, I.y) - out * .2, ang = Math.atan2(I.dy, I.dx), f = [Math.cos(ang), 0, Math.sin(ang)], r = [-f[2], 0, f[0]];
    if (!st.crowd) { st.crowd = []; for (let k = 0; k < 8; k++) { const a = Math.PI * .6 + k / 7 * Math.PI * .8 + ang, rr = .75 + (k % 3) * .18; st.crowd.push({ o: Object.assign(incActor(I.id * 3 + k), { kid: k > 5 }), x: I.x + Math.cos(a) * rr, z: I.y + Math.sin(a) * rr, h: a + Math.PI, s: Math.random() }); } }
    const Y = (y0 + .02) / ZS;
    [[.18, .22, 4.2], [0, .21, 4.4], [-.18, .17, 3.6], [-.34, .11, 2.4], [-.46, .065, 1.5]].forEach(([a, rad, rz], k) => glBall(x + f[0] * a, z + f[2] * a, rad, Y + rz * .6, rz, k ? '#46525f' : '#3e4955', 0, 0)); // the whale, head to the sea
    GLB.mat = 0; for (const sg of [-1, 1]) glOBox([x - f[0] * .55 + r[0] * sg * .09, y0 + .05, z - f[2] * .55 + r[2] * sg * .09], V3s(f, .05), V3s(r, .08), [0, .006, 0], '#3a4450'); // its tail flukes
    for (const sg of [-1, 1]) glOBox([x + f[0] * .3 + r[0] * sg * .205, y0 + .16, z + f[2] * .3 + r[2] * sg * .205], [.008, 0, 0], [0, 0, .008], [0, .008, 0], '#101418'); // and its eyes
    if (out < .9) for (const c of st.crowd) { // townsfolk: some stand and stare, some bring buckets from the sea
      if (c.o.kid || (c.s += dt * .1) % 1 > .5) { glPerson(c.o, c.x, c.z, incY(c.x, c.z), c.h, false, false); continue; }
      const u = Math.abs(((c.s * 2) % 2) - 1), sx = I.x + I.dx * 1.1, sz = I.y + I.dy * 1.1, px = c.x + (sx - c.x) * (1 - u), pz = c.z + (sz - c.z) * (1 - u); c.o.ph += dt * 8;
      glPerson(c.o, px, pz, incY(px, pz), glHeading(c, sx - c.x, sz - c.z), true, false);
    }
    const P = GL3.smoke; if (P && P.length < 900 && ((out > 0 && out < .95) || Math.random() < dt * .15) && Math.random() < dt * (out > 0 ? 8 : 3)) P.push({ x: x + f[0] * .15, y: y0 + .45, z: z + f[2] * .15, a: 0, L: 1.6, s0: .06, s1: .3, o: .7, sh: 1.12 }); // it blows, now and then, and a great plume as it goes
  }
};
