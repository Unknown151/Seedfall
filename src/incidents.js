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
  }
};
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
  }
};
