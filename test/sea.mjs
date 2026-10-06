// The sea put to use (ocean.js, seamodels.js): oyster beds and salt pans early, a pleasure pier and a desalination plant,
// oil rigs (down at Fusion, the oldest left as a reef), offshore wind parks feeding the grid, fish farms, wave power,
// floating solar, kelp, a launch platform and seasteads; never next to each other in the water, so the shipping lanes
// stay open; the big things on salt water only; a save keeps them; every model builds far and near.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=777&fresh&nointro&headless'); await p.waitForTimeout(800);
const at = Y => p.evaluate(Y => { SF.ff(Y - yr()); const c = {}; for (const B of Object.values(S.B)) if (B.prog >= 1) c[B.type] = (c[B.type] || 0) + 1; return { yr: yr() | 0, c }; }, Y);
const lanes = () => p.evaluate(() => { // nothing at sea stands next to anything else at sea, everything stands in the water, ships still get between every pair of harbours
  const sea = Object.values(S.B).filter(B => SEA_T[B.type]);
  const near = sea.filter(B => sea.some(o => o !== B && Math.max(Math.abs(o.x - B.x), Math.abs(o.y - B.y)) <= 1)).length;
  const dry = sea.filter(B => M.water[idx(B.x, B.y)] !== 1).length, fresh = sea.filter(B => ['oilrig', 'windpark', 'seastead', 'sealaunch', 'kelp', 'wavefarm', 'reef'].includes(B.type) && !isSea(idx(B.x, B.y))).length;
  const hs = harbours(); let pairs = 0, cut = 0; ROUTES.clear();
  for (const a of hs) for (const c of hs) if (a.id < c.id && sameWater(moorTile(a), moorTile(c))) { pairs++; const r = seaRoute(moorTile(a), moorTile(c)); if (!r || r.some(i => M.water[i] !== 1 || (M.bld[i] && SEA_T[(S.B[M.bld[i]] || {}).type]))) cut++; }
  for (const a of hs) { const e = edgeWater(moorTile(a)); if (e >= 0) { pairs++; const r = seaRoute(moorTile(a), e); if (!r || r.some(i => M.bld[i] && SEA_T[(S.B[M.bld[i]] || {}).type])) cut++; } }
  return { n: sea.length, near, dry, fresh, pairs, cut };
});
const a = await at(1300);
ok((a.c.oysters || 0) >= 2 && (a.c.saltpan || 0) >= 1, `early: oyster beds (${a.c.oysters}) and salt pans (${a.c.saltpan})`);
const c = await at(1900);
ok((c.c.oilrig || 0) >= 1, `oil rigs off the coast after Motorcars (${c.c.oilrig})`);
ok((c.c.seapier || 0) + (c.c.desal || 0) >= 1, `a pleasure pier (${c.c.seapier || 0}) or a desalination plant (${c.c.desal || 0}) on the shore`);
const pier = await p.evaluate(() => { const B = Object.values(S.B).find(B => B.type === 'seapier'); if (!B) return 'none'; const ts = fpTiles(B); return ts.length === 3 && ts.every(j => M.bld[j] === B.id) && ts.filter(j => M.water[j] === 1).length === 2 ? 'ok' : JSON.stringify([ts.length, ts.map(j => M.water[j])]); });
ok(pier === 'ok' || pier === 'none', `the pier's lot: its shore tile and two out over the water (${pier})`);
const d = await at(2400);
ok((d.c.windpark || 0) >= 4 && (d.c.fishfarm || 0) >= 1 && (d.c.wavefarm || 0) >= 1 && (d.c.floatsolar || 0) >= 1 && (d.c.kelp || 0) >= 1, `the modern sea: wind parks ${d.c.windpark}, fish farms ${d.c.fishfarm}, wave power ${d.c.wavefarm}, floating solar ${d.c.floatsolar}, kelp ${d.c.kelp}`);
const g = await p.evaluate(() => { const c = refreshNeeds(true); let w = 0; for (const T of towns()) w += bcount(T, 'windpark'); return { sup: c.sup, w, k: POWER_OUT.windpark, food: towns().reduce((a, T) => a + T.bl.filter(id => S.B[id] && SEA_FOOD[S.B[id].type] && S.B[id].prog >= 1).length, 0) }; });
ok(g.w > 0 && g.sup >= g.w * g.k, `wind parks feed the grid (${g.w} turbines, supply ${Math.round(g.sup)})`);
let l = await lanes();
ok(l.n > 10 && l.near === 0 && l.dry === 0 && l.fresh === 0, `${l.n} things at sea, none next to another (${l.near}), none on land (${l.dry}), the big ones on salt water (${l.fresh})`);
ok(l.pairs > 0 && l.cut === 0, `ships still find their way between the harbours and out to sea (${l.pairs - l.cut}/${l.pairs})`);
const e = await at(3500);
ok(!e.c.oilrig && e.c.reef === 1, `after Fusion the rigs come down, the oldest left as a reef (rigs ${e.c.oilrig || 0}, reefs ${e.c.reef || 0})`);
ok((e.c.sealaunch || 0) === 1 && (e.c.seastead || 0) >= 1, `a launch platform at sea (${e.c.sealaunch}) and seasteads (${e.c.seastead})`);
l = await lanes(); ok(l.near === 0 && l.cut === 0, `still clear lanes at year 3500 (${l.near}, ${l.cut}/${l.pairs})`);
const tip = await p.evaluate(() => ['oysters', 'desal', 'oilrig', 'reef', 'windpark', 'seastead', 'sealaunch', 'kelp'].map(t => { const B = Object.values(S.B).find(B => B.type === t); return B ? needTip(B) : '-'; }));
ok(tip.filter(x => x && x !== '-').length >= 5, 'tooltips say what they do: ' + tip.join(' | '));
// a save keeps them
const k0 = await p.evaluate(() => { const n = Object.values(S.B).filter(B => SEA_T[B.type] || B.type === 'seapier').length; const sv = JSON.stringify(serialize()); deserialize(JSON.parse(sv)); startWorld(false); return [n, Object.values(S.B).filter(B => SEA_T[B.type] || B.type === 'seapier').length]; });
ok(k0[0] === k0[1] && k0[0] > 0, `a save keeps what's at sea (${k0[0]} -> ${k0[1]})`);
// every model builds, far and near
const m = await p.evaluate(() => { const out = {};
  for (const t of ['oysters', 'saltpan', 'seapier', 'desal', 'oilrig', 'reef', 'windpark', 'fishfarm', 'wavefarm', 'floatsolar', 'kelp', 'seastead', 'sealaunch']) {
    let B = Object.values(S.B).find(B => B.type === t && B.prog >= 1);
    if (!B) { const T = towns().filter(seaTown)[0]; B = t === 'seapier' ? seaPier(T) : t === 'reef' || t === 'oilrig' ? (s => s && mkBuilding(t, s.x, s.y, T))(seaSite(T, 'off', { d0: 3, d1: 9 })) : null; if (B) B.prog = 1; }
    if (!B) { out[t] = 'none'; continue; }
    const fr = fpFront(B), k = ((((fr / W) | 0) / GCH) | 0) * GNC + (((fr % W) / GCH) | 0);
    try { const f = glBuildChunk(k).v.length, n = glBuildChunk(k, true).v.length; out[t] = f > 0 && n >= f ? 'ok' : `far ${f} near ${n}`; } catch (e) { out[t] = e.message; } }
  return out; });
ok(Object.values(m).every(v => v === 'ok' || v === 'none') && Object.values(m).filter(v => v === 'ok').length >= 11, 'every sea model builds far and near ' + JSON.stringify(m));
// the maglev runs level: no tile more than a gentle ramp above or below the next
const mg = await p.evaluate(() => { if (railEra() < 2) return 'no maglev'; let worst = 0; for (const r of S.rails || []) for (let k = 1; k < r.path.length; k++) worst = Math.max(worst, Math.abs(railH(r.path[k]) - railH(r.path[k - 1]))); return worst; });
ok(mg === 'no maglev' || mg <= .036, `the maglev guideway runs level, in gentle ramps (worst step ${typeof mg === 'number' ? mg.toFixed(3) : mg})`);
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close(); process.exit(fails ? 1 : 0);
