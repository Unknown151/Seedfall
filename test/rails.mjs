// Railways: lines cross streets rather than run down them, never through a building (fields and old cottages give way),
// trains stay on their line and ease into each station and wait, walkers and carts wait at a level crossing while a
// train is near, the track follows the age, and an older world's street-running lines are laid again on load.
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
  return { lines: lines.length, tiles, road, along, bad, ends, era: railEra() };
});
ok(r.lines >= 2, `${r.lines} lines by year 1150`);
ok(r.along / r.tiles < .03, `lines cross streets rather than run down them (${r.road} crossings, ${r.along} of ${r.tiles} tiles along a street)`);
ok(r.bad === 0, 'every tile of a line is rail and none has a building on it');
ok(r.ends, 'every line runs station to station');
const t = await p.evaluate(() => { // run the trains for a while (view time only)
  let maxOver = 0, waited = 0, stops = 0; const last = new Map();
  for (let f = 0; f < 6000; f++) { stepTrains(.05); for (const tr of DYN.trains) { const L = tr.r.path.length - 1, len = trainCars(tr).len; maxOver = Math.max(maxOver, .5 - tr.lo, tr.lo + len - (L - .5)); if (tr.wait > 0) waited++; const d = last.get(tr); if (d != null && d !== tr.dir) stops++; last.set(tr, tr.dir); } }
  const tr = DYN.trains[0]; return { n: DYN.trains.length, maxOver, waited, stops, v: TRAIN_SP[railEra()][0], cars: tr ? trainCars(tr).C.map(c => c[0]).join(',') : '' };
});
ok(t.n >= 1 && t.maxOver < 1e-3, `trains stay between their buffers (${t.n} trains, overrun ${t.maxOver.toFixed(4)})`);
ok(t.stops >= 2 && t.waited > 0, `they reach a station, wait and turn back (${t.stops} turns)`);
ok(/^loco,tender,coach/.test(t.cars), `a steam train: ${t.cars}`);
const x = await p.evaluate(() => { // a walker and a cart at a crossing wait while a train is near, then go on
  railMap(); const i = RAILX.xs[0]; if (i == null) return null;
  const xx = i % W, yy = (i / W) | 0, nb = N4.map(([dx, dy]) => idx(xx + dx, yy + dy)).find(j => M.road[j] && !M.rail[j]); if (nb == null) return null;
  DYN.railBusy = new Set([i]);
  const w = { st: 'go', path: [nb, i, nb], s: .5, spd: 1, ph: 0 }; stepWalker(w, .1); const ws = w.s;
  const v = { st: 'go', path: [nb, i, nb], s: .5, spd: 1 }; stepVehicle(v, .1); const vs = v.s;
  DYN.railBusy = new Set(); stepWalker(w, .1); stepVehicle(v, .1);
  return { ws, vs, w2: w.s, v2: v.s };
});
ok(x && x.ws === .5 && x.vs === .5 && x.w2 > .5 && x.v2 > .5, 'a walker and a cart wait at a busy crossing, and go on once it is clear');
const e = await p.evaluate(() => { SF.ff(1400 - yr()); const a = railEra(); SF.ff(2750 - yr()); const tr = DYN.trains[0]; return { a, b: railEra(), cars: tr ? trainCars(tr).C.map(c => c[0]).join(',') : '' }; });
ok(e.a === 1 && e.b === 2 && /^nose,mid/.test(e.cars), `the age of the track: electric by 1400, maglev by 2750 (${e.cars})`);
const m = await p.evaluate(() => { // an older world whose lines ran down the streets
  for (const R of S.rails) if (R.path) for (let k = 1; k < R.path.length - 1; k++) M.rail[R.path[k]] = 0;
  const R = S.rails.find(R => R.path), T = S.T[R.a], st = R.path[0]; // lay this one down a street, the old way
  const old = navPath(st, R.path[R.path.length - 1], 0, 9000) || R.path; R.path = old; for (const i of old) if (!M.bld[i]) M.rail[i] = 1;
  const before = old.filter(i => M.road[i]).length / old.length;
  const sv = serialize(); delete sv.state.railV; deserialize(JSON.parse(JSON.stringify(sv)));
  const flag = !!S.railReplan; SF.ff(1 / 12);
  const R2 = S.rails.find(q => q.a === R.a && q.b === R.b), after = R2.path.filter(i => M.road[i]).length / R2.path.length;
  return { flag, before, after, v: S.railV, T: !!T };
});
ok(m.flag && m.v === 2 && m.after < m.before, `an older save's lines are laid again (on streets ${(m.before * 100) | 0}% → ${(m.after * 100) | 0}%)`);
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all ok');
await b.close();
