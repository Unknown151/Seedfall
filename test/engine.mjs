// The engine underneath: the sim's own seeded randomness (same seed, same world; a reloaded save carries on the same),
// the event bus (fires for what happens, and listeners can't change the sim or break it), and 3D-native models.
// Run from test/: `node engine.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch();
let fails = 0; const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
const errs = [];
const open = async () => { const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message)); await p.goto(ROOT + 'seedfall.html?seed=999&fresh&nointro&2d'); await p.waitForTimeout(500); return p; };
// a fingerprint of the world: everything the sim decides
const DIGEST = () => { const bs = Object.values(S.B).map(B => B.type + B.x + ',' + B.y + ':' + B.tier + (B.prog >= 1 ? '' : '~')).sort().join('|'), ts = towns().map(T => T.name + '@' + T.x + ',' + T.y + ':' + Math.round(T.pop)).join('|');
  let h = 0; const s = bs + '#' + ts + '#' + Object.keys(S.tech.done).join(',') + '#' + S.nextP + '#' + S.chron.map(e => e.t).join('\n'); for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return { h, year: Math.round(S.year), b: Object.keys(S.B).length, towns: towns().length, people: S.nextP, rs: S.rs }; };

// 1) the same seed grows the same world
const A = await open(), B1 = await open();
const run = (p, y) => p.evaluate(([y, D]) => { SF.ff(y - S.year); return (0, eval)('(' + D + ')')(); }, [y, DIGEST.toString()]);
const a1 = await run(A, 400), b1 = await run(B1, 400);
ok(a1.h === b1.h && a1.b === b1.b, 'two tabs, same seed: the same world by year 400', JSON.stringify(a1) + ' vs ' + JSON.stringify(b1));

// 2) a save carries its randomness: reloaded, it grows on exactly as the world it came from
const sv = await A.evaluate(() => JSON.stringify(serialize()));
const a2 = await run(A, 700);
await B1.evaluate(sv => { deserialize(JSON.parse(sv)); startWorld(false); }, sv);
const b2 = await run(B1, 700);
ok(a2.h === b2.h, 'a save reloaded at 400 grows on to the same year 700', JSON.stringify(a2) + ' vs ' + JSON.stringify(b2));

// 3) the event bus: it fires, listeners that draw random numbers or throw change nothing
const C = await open(), D = await open();
const cnt = await C.evaluate(() => { const n = {}; for (const k of ['chron', 'placed', 'built', 'removed', 'town', 'tech', 'era', 'event']) EV.on(k, () => n[k] = (n[k] || 0) + 1);
  EV.on('built', () => { for (let i = 0; i < 5; i++) rnd(); }); EV.on('tech', () => { throw new Error('listener trouble (expected)'); });
  SF.ff(600); return n; });
const c3 = await run(C, 600), d3 = await run(D, 600);
ok(cnt.chron > 50 && cnt.placed > 50 && cnt.built > 50 && cnt.tech >= 14 && cnt.town >= 2 && cnt.era >= 2, 'the bus fires for chronicle lines, buildings, towns, techs and eras', JSON.stringify(cnt));
ok(c3.h === d3.h, 'listeners (even greedy or broken ones) don’t change the world', `${c3.h} vs ${d3.h}`);
const thrown = errs.filter(e => /listener trouble/.test(e)).length; errs.splice(0, errs.length, ...errs.filter(e => !/listener trouble/.test(e)));
ok(thrown >= 1, 'a listener that throws is reported, not swallowed', `${thrown} reported`);

// 4) 3D-native models build (far and close up) for the types that have them
const m = await A.evaluate(() => { const out = {};
  for (const t of Object.keys(GL_MODEL)) { const B = Object.values(S.B).find(B => B.type === t && B.prog >= 1); if (!B) { out[t] = 'none'; continue; }
    const k = ((B.y / GCH) | 0) * GNC + ((B.x / GCH) | 0), f = glBuildChunk(k).v.length, n = glBuildChunk(k, true).v.length; out[t] = f > 0 && n >= f ? 'ok' : `far ${f} near ${n}`; } return out; });
ok(Object.values(m).every(v => v === 'ok' || v === 'none') && Object.values(m).filter(v => v === 'ok').length >= 2, 'native 3D models build, far and near', JSON.stringify(m));
ok(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
