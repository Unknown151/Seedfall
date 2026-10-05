// Railways and trams: stations stand at the edge of town and lines run between towns, crossing streets rather than
// running down them and never through a building (fields and old cottages give way); trains stay on their line, ease
// into each station, wait and turn back; walkers and carts wait at a level crossing while a train is near; the track
// follows the age; trams run along the streets of the towns; and an older world's stations move out to the edge and its
// lines are laid again on load.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro&headless'); await p.waitForTimeout(800);
const r = await p.evaluate(() => {
  SF.ff(1150 - yr());
  const lines = S.rails.filter(r => r.path); let tiles = 0, road = 0, along = 0, bad = 0;
  for (const R of lines) for (let k = 1; k < R.path.length - 1; k++) { const i = R.path[k]; tiles++; if (M.road[i]) { road++; if (k + 1 < R.path.length - 1 && M.road[R.path[k + 1]]) along++; } if (M.bld[i]) bad++; if (!M.rail[i]) bad++; }
  const ends = lines.every(R => [R.path[0], R.path[R.path.length - 1]].every(i => M.bld[i] && S.B[M.bld[i]].type === 'station'));
  let inT = 0; for (const R of lines) for (let k = 1; k < R.path.length - 1; k++) { const i = R.path[k]; if (towns().some(T => dist(i % W, (i / W) | 0, T.x, T.y) < townRadius(T) * .7)) inT++; }
  const st = towns().filter(T => stationOf(T)).map(T => { const B = stationOf(T); return dist(B.x, B.y, T.x, T.y) / townRadius(T); });
  const trams = towns().filter(T => T._tram), okTram = trams.every(T => T._tram.every((v, k, P) => M.road[v] && (k === 0 || Math.abs(v % W - P[k - 1] % W) + Math.abs(((v / W) | 0) - ((P[k - 1] / W) | 0)) <= 1)));
  for (let f = 0; f < 600; f++) stepTrams(.1); const moved = (DYN.trams || []).filter(o => o.dist > 3).length;
  return { lines: lines.length, tiles, road, along, bad, ends, era: railEra(), inT, st: Math.min(...st), big: towns().filter(T => T.pop >= 400).length, trams: trams.length, okTram, moved };
});
ok(r.lines >= 2, `${r.lines} lines by year 1150`);
ok(r.along / r.tiles < .03, `lines cross streets rather than run down them (${r.road} crossings, ${r.along} of ${r.tiles} tiles along a street)`);
ok(r.bad === 0, 'every tile of a line is rail and none has a building on it');
ok(r.ends, 'every line runs station to station');
ok(r.st >= .6, `stations stand at the edge of town (the nearest is ${(r.st * 100) | 0}% of the way out)`);
ok(r.inT / r.tiles < .25, `lines run between towns, not through them (${r.inT} of ${r.tiles} tiles inside a town)`);
ok(r.trams >= Math.max(1, r.big - 1) && r.okTram, `trams run along the streets of the towns (${r.trams} of ${r.big} towns, every route street to street)`);
ok(r.moved === r.trams * 2, `and the trams go, two to a town on a track each way (${r.moved} moving)`);
const t = await p.evaluate(() => { // run the trains for a while (view time only)
  let maxOver = 0, waited = 0, stops = 0; const last = new Map();
  for (let f = 0; f < 6000; f++) { stepTrains(.05); for (const tr of DYN.trains) { const tc = trainCars(tr); if (!tc.fits) continue; const L = tr.r.path.length - 1, len = tc.len; maxOver = Math.max(maxOver, .5 - tr.lo, tr.lo + len - (L - .5)); if (tr.wait > 0) waited++; const d = last.get(tr); if (d != null && d !== tr.dir) stops++; last.set(tr, tr.dir); } }
  const tr = DYN.trains.slice().sort((a, b) => b.r.path.length - a.r.path.length)[0]; return { n: DYN.trains.length, maxOver, waited, stops, v: TRAIN_SP[railEra()][0], cars: tr ? trainCars(tr).C.map(c => c[0]).join(',') : '' };
});
ok(t.n >= 1 && t.maxOver < 1e-3, `trains stay between their buffers (${t.n} trains, overrun ${t.maxOver.toFixed(4)})`);
ok(t.stops >= 2 && t.waited > 0, `they reach a station, wait and turn back (${t.stops} turns)`);
ok(/^loco,tender,coach/.test(t.cars), `a steam train: ${t.cars}`);
const sh = await p.evaluate(() => { // where lines share track each has its own; at junctions the signals hold one train back
  railMap(); let shared = 0; for (const o of RAILX.ln.values()) for (const v of o) if (v) shared++;
  const cars = (tr, ln) => { const { len, fits } = trainCars(tr); if (!fits) return []; const out = []; for (let s = tr.lo; s <= tr.lo + len; s += .2) out.push(railPos(tr.r.path, s, ln)); return out; };
  let was = 0, now = 0; for (let f = 0; f < 3000; f++) { stepTrains(.05); if (f % 5) continue; const T = DYN.trains;
    for (let a = 0; a < T.length; a++) for (let c = a + 1; c < T.length; c++) { const hit = l => { const A = cars(T[a], l ? railLane(T[a].r) : null), B = cars(T[c], l ? railLane(T[c].r) : null); return A.some(x => B.some(y => Math.hypot(x[0] - y[0], x[2] - y[2]) < .25)); }; was += hit(false); now += hit(true); } }
  return { shared, was, now, moving: DYN.trains.filter(t => (t.dist || 0) > 20 || !trainCars(t).fits).length, n: DYN.trains.length }; });
ok(sh.shared > 0 && sh.now <= sh.was * .15 && sh.moving === sh.n, `lines that share track run on tracks side by side, and junction signals keep trains apart (${sh.shared} shared steps; ${sh.was} near misses on one track, ${sh.now} now; ${sh.moving}/${sh.n} trains keep going)`);
const x = await p.evaluate(() => { // a walker and a cart at a crossing wait while a train is near, then go on
  railMap(); const nbOf = i => N4.map(([dx, dy]) => idx(i % W + dx, ((i / W) | 0) + dy)).find(j => M.road[j] && !M.rail[j]);
  const i = RAILX.xs.find(i => nbOf(i) != null) ?? [...RAILX.m.keys()].find(i => nbOf(i) != null); if (i == null) return null; const nb = nbOf(i); // (a crossing, or any track beside a street)
  DYN.railBusy = new Set([i]);
  const w = { st: 'go', path: [nb, i, nb], s: .5, spd: 1, ph: 0 }; stepWalker(w, .1); const ws = w.s;
  const v = { st: 'go', path: [nb, i, nb], s: .5, spd: 1 }; stepVehicle(v, .1); const vs = v.s;
  DYN.railBusy = new Set(); stepWalker(w, .1); stepVehicle(v, .1);
  return { ws, vs, w2: w.s, v2: v.s };
});
ok(x && x.ws === .5 && x.vs === .5 && x.w2 > .5 && x.v2 > .5, 'a walker and a cart wait at a busy crossing, and go on once it is clear');
const e = await p.evaluate(() => { SF.ff(1400 - yr()); const a = railEra(); SF.ff(2750 - yr()); const tr = DYN.trains.slice().sort((a, b) => b.r.path.length - a.r.path.length)[0]; return { a, b: railEra(), cars: tr ? trainCars(tr).C.map(c => c[0]).join(',') : '' }; });
ok(e.a === 1 && e.b === 2 && /^nose,mid/.test(e.cars), `the age of the track: electric by 1400, maglev by 2750 (${e.cars})`);
const m = await p.evaluate(() => { // an older world with its station in the middle of town and the line through the streets
  const R = S.rails.find(R => R.path), T = S.T[R.a], B0 = stationOf(T);
  const H0 = T.bl.map(id => S.B[id]).filter(B => B && B.type === 'house' && B.prog >= 1 && !fpBig(B)).sort((a, b) => dist(a.x, a.y, T.x, T.y) - dist(b.x, b.y, T.x, T.y))[0];
  const hx = H0.x, hy = H0.y; removeBuilding(H0); removeBuilding(B0); mkBuilding('station', hx, hy, T, { prog: 1 });
  for (const q of S.rails) if (q.path) for (let k = 1; k < q.path.length - 1; k++) M.rail[q.path[k]] = 0;
  const Bs = stationOf(S.T[R.b]), old = navPath(idx(hx, hy), idx(Bs.x, Bs.y), 0, 9000) || [idx(hx, hy), idx(Bs.x, Bs.y)]; R.path = old; for (const i of old) if (!M.bld[i]) M.rail[i] = 1;
  const before = dist(hx, hy, T.x, T.y) / townRadius(T);
  const sv = serialize(); delete sv.state.railV; deserialize(JSON.parse(JSON.stringify(sv)));
  const flag = !!S.railReplan; SF.ff(1 / 12);
  const T2 = S.T[R.a], B2 = stationOf(T2), R2 = S.rails.find(q => q.a === R.a && q.b === R.b);
  return { flag, before, after: B2 ? dist(B2.x, B2.y, T2.x, T2.y) / townRadius(T2) : 0, v: S.railV, ends: !!(R2 && R2.path && M.bld[R2.path[0]] === B2.id) };
});
ok(m.flag && m.v === 3 && m.after >= .6 && m.ends, `an older save's station moves out to the edge (${(m.before * 100) | 0}% → ${(m.after * 100) | 0}% of the way out) and its lines are laid again`);
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all ok');
await b.close();
