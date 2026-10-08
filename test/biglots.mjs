// Big buildings on lots their size (sim.js FP_BIG, bigmodels.js): works and power stations 2×2, the airfield 4×2 with its runway
// down the long side (air.js afGeo), the launch complex 3×3, garden domes and climate engines 2×2; every tile of a lot points at
// it; smoke rises from inside the lot; every model builds far and near; an older one-plot works spreads or moves out. And a
// building the age has outgrown (a windmill after Electricity) isn't built for a custom, and one built since comes down.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=777&fresh&nointro&headless'); await p.waitForTimeout(800);
const r = await p.evaluate(() => { SF.ff(3100); const o = {};
  for (const t of ['works', 'power', 'airfield', 'launchpad', 'dome', 'terraformer']) { const bs = Object.values(S.B).filter(B => B.type === t && B.prog >= 1), f = FP_BIG[t];
    o[t] = { n: bs.length, big: bs.filter(B => fpW(B) === f[0] && fpH(B) === f[1]).length }; }
  const lots = Object.values(S.B).filter(B => fpBig(B)), bad = lots.filter(B => fpTiles(B).some(j => M.bld[j] !== B.id)).length;
  const sm = Object.values(S.B).filter(B => fpBig(B) && SMOKE_BIG[B.type]).every(B => smokeAt(B).every(([u, v]) => u > -.6 && v > -.6 && u < fpW(B) - .4 && v < fpH(B) - .4));
  const af = Object.values(S.B).find(B => B.type === 'airfield' && fpW(B) === 4), g = af && afGeo(af);
  return { o, lots: lots.length, bad, sm, rw: g ? +g.L.toFixed(2) : 0 }; });
for (const [t, v] of Object.entries(r.o)) ok(v.n > 0 && v.big / v.n >= .6, `${t}: ${v.big} of ${v.n} on their full ${'lot'}`);
ok(r.bad === 0, `every tile of all ${r.lots} lots points at its building`);
ok(r.sm, 'the big stacks smoke from inside their lots');
ok(r.rw > 3.5, `the airfield's runway runs the length of its lot (${r.rw} tiles)`);
const pl = await p.evaluate(() => { // a plane taxis out, rolls the length of the runway, lifts off and climbs away
  const B = Object.values(S.B).find(B => B.type === 'airfield' && fpW(B) === 4); if (!B) return 'none'; const g = afGeo(B);
  DYN.planes.length = 0; const P = { kind: 'jet', st: 'taxi', from: B.id, to: 0, x: g.px, y: g.py, z: afZ(B), h: Math.PI, spd: 0, t: 0, col: '#fff', id: .5 }; DYN.planes.push(P);
  const seen = new Set(); let lift = null, onRwy = true; for (let k = 0; k < 900 && !P.gone; k++) { DYN.t += .05; flyPlane(P, .05); seen.add(P.st); if (P.st === 'roll') { if (Math.abs(P.y - g.y) > .035) onRwy = false; if (lift == null && P.z > afZ(B) + .01) lift = P.x - g.x0; } }
  return { seen: [...seen].join(','), lift: lift && +lift.toFixed(2), L: +g.L.toFixed(2), onRwy }; });
ok(pl === 'none' || (pl.seen.includes('roll') && pl.seen.includes('climb') && pl.onRwy && pl.lift > 2), `a plane rolls down the long runway and lifts off ${pl.lift} tiles along it (${JSON.stringify(pl)})`);
const m = await p.evaluate(() => { const out = {};
  for (const t of ['works', 'power', 'airfield', 'launchpad', 'dome', 'terraformer', 'warehouse', 'elevator']) {
    let B = Object.values(S.B).find(B => B.type === t && B.prog >= 1 && fpBig(B));
    if (!B) { for (const T of towns()) { B = placeBig(T, t); if (B) break; } if (B) B.prog = 1; }
    if (!B) { out[t] = 'none'; continue; }
    const fr = fpFront(B), k = ((((fr / W) | 0) / GCH) | 0) * GNC + (((fr % W) / GCH) | 0);
    try { const f = glBuildChunk(k).v.length, n = glBuildChunk(k, true).v.length; out[t] = f > 0 && n >= f ? 'ok' : `far ${f} near ${n}`; } catch (e) { out[t] = e.message; } }
  return out; });
ok(Object.values(m).every(v => v === 'ok' || v === 'none') && Object.values(m).filter(v => v === 'ok').length >= 7, 'every big model builds far and near ' + JSON.stringify(m));
// an older world's one-plot works spreads onto its lot, or moves out to one
await p.evaluate(() => { window.freeAt = (f = () => true) => { for (const T of towns().sort((a, b) => a.pop - b.pop).filter(f)) { const s = findSite(T, 'edge') || findSite(T, 'mid') || findSite(T, 'farm'); if (s) { if (M.bld[idx(s.x, s.y)]) removeBuilding(S.B[M.bld[idx(s.x, s.y)]]); return [T, s]; } } return [null, null]; }; });
const w = await p.evaluate(() => { const [T, s] = freeAt(T => bigLotSite(T, 2, 2, 5, 2.5)); if (!s) return 'no site'; // (a town with room for one out at its edge)
  const B = mkBuilding('works', s.x, s.y, T, { prog: 1 }); B.built = yr() - 40; for (let k = 0; k < 5 && !fpBig(B); k++) fpSettle(B); return S.B[B.id] ? fpW(B) + 'x' + fpH(B) : 'gone'; });
ok(w === '2x2', `an old one-plot works spreads or moves out to its 2×2 lot (${w})`);
// the windmill: not built for a custom after Electricity, and one built since comes down
const wm = await p.evaluate(() => { const T = towns()[0]; CULT.bld = { mill: 1 }; const n0 = anycount('mill'); for (let k = 0; k < 400; k++) cultureProject(T); const n1 = anycount('mill'); CULT.bld = {};
  const [T2, s] = freeAt(); const B = mkBuilding('mill', s.x, s.y, T2, { prog: 1 }); for (const M2 of T2.bl.map(id => S.B[id]).filter(o => o && o.type === 'mill' && o !== B)) removeBuilding(M2);
  for (let k = 0; k < 60 && S.B[B.id]; k++) yearlyRetire(); return { n0, n1, gone: !S.B[B.id] }; });
ok(wm.n1 === wm.n0 && wm.gone, `a custom builds no windmills after Electricity (${wm.n0} -> ${wm.n1}), and one built since comes down (${wm.gone})`);
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close(); process.exit(fails ? 1 : 0);
