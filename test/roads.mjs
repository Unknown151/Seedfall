// Road surfaces: dirt, gravel, cobbles or bricks, asphalt, concrete, glowlanes; paving by tech and material. Run from test/: `node roads.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0;
const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro'); await p.waitForTimeout(500);
const at = y => p.evaluate(y => { SF.ff(y - yr()); const n = [0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < W * H; i++) n[M.road[i]]++;
  const core = []; for (let i = 0; i < W * H; i++) if (M.road[i] && zoneAt(i) === Z_CORE) core.push(M.road[i]);
  return { yr: Math.round(yr()), n, core, firsts: [3, 4, 5, 6, 7].filter(k => S.firsts['road' + k]).length, bad: Array.from(M.road).some(v => v > 7) }; }, y);
let r = await at(150);
ok(r.n[1] + r.n[2] > 0 && r.n.slice(3).every(v => !v), 'early roads are dirt and gravel', r.n.join('/'));
r = await at(800);
ok(r.n[3] + r.n[4] > 50, 'with masonry the towns pave with cobbles or bricks', `cobbles ${r.n[3]}, bricks ${r.n[4]}`);
r = await at(2000);
ok(r.n[5] + r.n[6] > r.n[3] + r.n[4], 'motorcars bring asphalt and concrete', r.n.join('/'));
ok(r.core.some(v => v === 3 || v === 4), 'the old market quarter keeps some cobbles', `${r.core.filter(v => v === 3 || v === 4).length} of ${r.core.length}`);
r = await at(3400);
ok(r.n[7] > r.n[5] + r.n[6], 'the hover age lays glowlanes', r.n.join('/'));
ok(r.firsts >= 4 && !r.bad, 'each new surface gets its chronicle line, and every tile holds a real surface', `${r.firsts} firsts`);
const tip = await p.evaluate(() => { const i = Array.from(M.road).findIndex((v, i) => v === 7 && !M.water[i] && !M.bld[i]); return tipFor(i).replace(/<[^>]+>/g, ' '); });
ok(/glowlane/.test(tip), 'the tooltip names the surface', tip.trim().slice(0, 60));
// an older save: the old tiers (4 = motor, 5 = hover) become asphalt and glowlanes
r = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(serialize())); delete o.state.roadV; deserialize(o); for (let i = 0; i < W * H; i++) if (M.road[i] === 7) { M.road[i] = 5; break; } const o2 = JSON.parse(JSON.stringify(serialize())); delete o2.state.roadV; deserialize(o2); startWorld(false); return { v: S.roadV, max: Math.max(...M.road) }; });
ok(r.v === 2 && r.max === 7, 'an older save’s roads are converted once', JSON.stringify(r));
ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close(); console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
