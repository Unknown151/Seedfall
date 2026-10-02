// Zones the towns draw for themselves, redevelopment, shops, and terraces. Run from test/: `node zones.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch();
const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
let fails = 0;
const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro'); await p.waitForTimeout(600);

const stats = () => p.evaluate(() => {
  const bs = Object.values(S.B).filter(B => B.prog >= 1 && !B.hid), zc = t => { const o = [0, 0, 0, 0, 0]; bs.filter(t).forEach(B => o[M.zone[idx(B.x, B.y)]]++); return o; };
  const hs = bs.filter(B => B.type === 'house'), joined = hs.filter(B => houseJoin(B));
  let asym = 0; // a terrace has to agree from both ends
  for (const B of joined) { const J = houseJoin(B), dx = J.a === 'u' ? 1 : 0, dy = 1 - dx; if (J.hi) { const C = S.B[M.bld[idx(B.x + dx, B.y + dy)]], K = C && houseJoin(C); if (!K || !K.lo || K.a !== J.a) asym++; } }
  return { yr: yr(), towns: towns().length, zoned: towns().filter(T => T.zy).length, works: zc(B => WORKS_T[B.type]), houses: zc(B => B.type === 'house'), core: zc(B => ZONE_OF[B.type] === Z_CORE),
    joined: joined.length, rows: hs.filter(B => ROW_T(B.tier)).length, asym, shops: anycount('shops'), rd: S.rdN || 0, ax: hs.every(B => !ROW_T(B.tier) || B.ax === 'u' || B.ax === 'v') };
});
let r = await p.evaluate(() => { SF.ff(900); return 0; }); r = await stats();
const pct = (a, k) => a[k] / Math.max(1, a.reduce((x, y) => x + y, 0));
ok(r.zoned === r.towns, 'every town has drawn its quarters', `${r.zoned}/${r.towns} towns`);
ok(pct(r.houses, 2) + pct(r.houses, 1) > .75 && pct(r.houses, 4) < .05, 'houses live in the homes and the market quarter, hardly any on the greens', r.houses.join('/'));
ok(r.joined > r.rows * .3 && r.asym === 0, 'townhouses join up into terraces, and every terrace agrees from both ends', `${r.joined} of ${r.rows} joined, ${r.asym} lopsided`);
ok(r.ax, 'each terrace house remembers which way its street runs');
ok(r.rd > 0, 'old fields and misplaced buildings get redeveloped', `${r.rd} projects`);

await p.evaluate(() => SF.ff(700)); r = await stats();
ok(r.works.reduce((x, y) => x + y) > 0 && pct(r.works, 3) > .6, 'workshops and works sit in the works quarter', r.works.join('/'));
ok(r.shops > 0 && pct(r.core, 1) > .4, 'shops and civic buildings gather in the market quarter', `${r.shops} shops, core ${r.core.join('/')}`);
ok(r.joined > 0 && r.asym === 0, 'rowhouses keep their terraces', `${r.joined} joined`);

// the zone view and the tooltips
await p.keyboard.press('z'); await p.waitForTimeout(300);
ok(await p.evaluate(() => UI.zones === true), 'Z shows the zone view');
if (!(await p.evaluate(() => typeof HEADLESS !== 'undefined' && HEADLESS))) { await p.evaluate(() => { SF.weather('clear', 9999); SF.hour(13); const T = towns().sort((a, b) => b.pop - a.pop)[0]; Object.assign(GL3.cam, { tx: T.x, tz: T.y, ty: surfZ(idx(T.x, T.y)) * ZS, zoom: 5, pitch: .9, auto: false }); }); await p.waitForTimeout(2200); await p.screenshot({ path: 'zones_view.png' }); }
await p.keyboard.press('z');
ok(await p.evaluate(() => UI.zones === false), 'Z again hides it');
const tip = await p.evaluate(() => { const B = Object.values(S.B).find(B => B.type === 'house' && B.prog >= 1 && houseJoin(B) && M.zone[idx(B.x, B.y)]); return B ? tipFor(idx(B.x, B.y)).replace(/<[^>]+>/g, ' ') : ''; });
ok(/in a terrace|part of a block/.test(tip) && /homes|market quarter|works quarter|green/.test(tip), 'the tooltip names the terrace and the quarter', tip.slice(0, 90));
const stip = await p.evaluate(() => { const B = Object.values(S.B).find(B => B.type === 'shops' && B.prog >= 1); return B ? tipFor(idx(B.x, B.y)).replace(/<[^>]+>/g, ' ') : ''; });
ok(/Shopfronts|Arcade|Department Store|Offices/.test(stip), 'shops have a name of their own', stip.slice(0, 60));

// an older save, from before zones
r = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(serialize())); delete o.state.map.zone; for (const k in o.state.T) { const T = o.state.T[k]; delete T.zy; delete T.zsec; } for (const k in o.state.B) delete o.state.B[k].ax; deserialize(o); startWorld(false); const n = M.zone.filter(v => v).length; SF.ff(10); return { n, zoned: towns().every(T => T.zy) }; });
ok(r.n > 100 && r.zoned, 'an older save draws its zones on load', `${r.n} zoned tiles`);
ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
