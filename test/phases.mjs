// What a later age phases out: granaries go with Railways, windmills with Electricity (roller mills grind at the
// works, so milling stops being a need), wells and spare water towers with Reinforced Concrete; each town keeps its
// oldest well and mill and its newest water tower. Workplaces still worth having are refitted one at a time: the water
// tower gets an iron tank (Steam), the smithy becomes a machine shop (Steam) then a fab workshop (Computing), the
// weaving house a brick mill then a knitting hall, the glass cone a float-glass works (Electricity). Every model
// builds at every stage, and an older save's buildings work out their stage from the year they were built.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro&headless'); await p.waitForTimeout(800);
const at = Y => p.evaluate(Y => { SF.ff(Y - yr());
  const per = t => { const m = {}; for (const B of Object.values(S.B)) if (B.type === t && B.prog >= 1) m[B.sid] = (m[B.sid] || 0) + 1; return Math.max(0, ...Object.values(m)); };
  const all = t => Object.values(S.B).filter(B => B.type === t && B.prog >= 1);
  const gens = {}; for (const B of Object.values(S.B)) if (REFIT[B.type] && B.prog >= 1) { const k = B.type + genOf(B); gens[k] = (gens[k] || 0) + 1; }
  return { yr: yr() | 0, granary: all('granary').length, mill: per('mill'), millOld: all('mill').every(B => B.old), well: per('well'), tower: per('watertower'),
    millNeed: towns().some(T => needsOf(T).mill != null), share: towns().every(T => millShare(T) === 1), gens }; }, Y);
const a = await at(990);
ok(a.granary > 0 && a.mill > 1 && a.millNeed, `before Railways: granaries (${a.granary}), several windmills a town (${a.mill}), milling a need`);
const c = await at(1300);
ok(c.granary === 0, 'granaries gone a few decades after Railways');
ok(c.gens.watertower0 == null && c.gens.workshop0 == null && c.gens.weaver0 == null, `water towers, smithies and weavers refitted after Steam ${JSON.stringify(c.gens)}`);
const d = await at(1520);
ok(d.mill <= 1 && d.millOld && !d.millNeed && d.share, `after Electricity: one old windmill a town at most (${d.mill}), milling no longer a need, every field's grain milled`);
ok(d.gens.glassworks0 == null, 'glass cones refitted as float-glass works after Electricity');
const e = await at(1720);
ok(e.well <= 1 && e.tower <= 1, `after Reinforced Concrete: a well and a water tower a town at most (${e.well}, ${e.tower})`);
const f = await at(2000);
ok(f.gens.workshop1 == null && f.gens.weaver1 == null && (f.gens.workshop2 || f.gens.weaver2), `after Computing: fab workshops and knitting halls ${JSON.stringify(f.gens)}`);
const m = await p.evaluate(() => { // every stage of every refitted model builds, far and near
  const out = {}; const k0 = Object.values(S.B).find(B => B.type === 'workshop'); if (!k0) return { none: 1 };
  for (const t of Object.keys(REFIT)) for (let g = 0; g <= REFIT[t].length; g++) {
    const B = Object.values(S.B).find(B => B.type === t && B.prog >= 1); if (!B) { out[t + g] = 'none'; continue; }
    const sv = B.gen; B.gen = g; const k = ((B.y / GCH) | 0) * GNC + ((B.x / GCH) | 0); let r;
    try { const f1 = glBuildChunk(k).v.length, n1 = glBuildChunk(k, true).v.length; r = f1 > 0 && n1 >= f1 ? 'ok' : `far ${f1} near ${n1}`; } catch (e) { r = e.message; }
    B.gen = sv; out[t + g] = r; }
  return out; });
ok(Object.values(m).every(v => v === 'ok'), `every stage builds far and near ${JSON.stringify(m)}`);
const o = await p.evaluate(() => { // an older save: a smithy built before Steam has no stage saved, and catches up
  const B = Object.values(S.B).find(B => B.type === 'workshop'); const sv = [B.gen, B.built]; delete B.gen; B.built = 100; const g0 = genOf(B);
  let n = 0; while (genOf(B) < genNow('workshop') && n++ < 60) yearlyRefit(); const g1 = genOf(B); B.built = sv[1]; return { g0, g1, now: genNow('workshop'), n };
});
ok(o.g0 === 0 && o.g1 === o.now, `an older save's smithy works out its stage (${o.g0}) and is refitted in time (${o.g1} after ${o.n} years)`);
ok(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all ok');
await b.close();
