// Town needs, the cloth and glass chains, and old saves picking them up. Run from test/: `node needs.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
let fails = 0;
const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro'); await p.waitForTimeout(600);

let r = await p.evaluate(() => { SF.ff(700); refreshNeeds(true); return { needs: towns().map(T => needsOf(T)), towers: anycount('watertower'), wells: anycount('well'), pastures: anycount('pasture'), weavers: anycount('weaver'), glass: anycount('glassworks') + anycount('sandpit'),
  flow: towns().reduce((a, T) => [a[0] + (T.flow.cloth || 0), a[1] + (T.flow.glass || 0)], [0, 0]) }; });
ok(r.needs.every(v => v.water != null && v.culture != null && v.mill != null) && r.needs.every(v => v.energy == null), 'Year 700: water, milling and culture are needs, power not yet');
ok(r.wells > 0 && r.towers > 0, 'wells and water towers get built', `${r.wells} wells, ${r.towers} towers`);
ok(r.pastures > 0 && r.weavers > 0 && r.flow[0] > 0, 'pastures and weavers make cloth', `${r.pastures} pastures, ${r.weavers} weavers, ${r.flow[0].toFixed(1)} cloth/yr`);
ok(r.glass > 0 && r.flow[1] > 0, 'sand pits and glassworks make glass', `${r.flow[1].toFixed(1)} glass/yr`);

r = await p.evaluate(() => { SF.ff(1000); refreshNeeds(true); const c = NEEDC; return { needs: towns().map(T => [T.pop, needsOf(T)]), grid: c.grid, sup: c.sup, dem: c.dem, clinics: anycount('clinic'), masts: anycount('mast') + anycount('antenna'),
  finite: towns().every(T => RES.every(k => Number.isFinite(T.res[k]) && Number.isFinite(T.flow[k] || 0))), growth: towns().map(T => needGrowthK(T)) }; });
ok(r.needs.every(([, v]) => v.health != null && v.energy != null && v.word != null), 'Year 1700: health, power and news are needs too');
ok(r.grid > .6 && r.sup > 0, 'the valley builds power for its grid', `supply ${Math.round(r.sup)} for demand ${Math.round(r.dem)}`);
ok(r.clinics > 0 && r.masts > 0, 'clinics and masts get built', `${r.clinics} clinics, ${r.masts} masts/relays`);
const avg = k => r.needs.reduce((a, [, v]) => a + v[k], 0) / r.needs.length;
ok(avg('water') > .8 && avg('health') > .6 && avg('culture') > .5, 'needs are mostly met', ['water', 'health', 'culture', 'word'].map(k => k + ' ' + avg(k).toFixed(2)).join(', '));
ok(r.growth.every(g => g > .85 && g < 1.06), 'growth factor stays close to 1', r.growth.map(g => g.toFixed(2)).join(' '));
ok(r.finite, 'all stores and flows are numbers');

// the Towns tab and tooltips
await p.keyboard.press('c'); await p.waitForTimeout(300); await p.click('.tab[data-tab="towns"]'); await p.waitForTimeout(800);
ok(await p.$$eval('.needs span', l => l.length) >= 5 && await p.$$eval('.stock div', l => l.length) >= 14, 'Towns tab shows the needs and seven stores');
const tips = await p.evaluate(() => ['clinic', 'watertower', 'weaver', 'turbine', 'works'].map(t => { const B = Object.values(S.B).find(B => B.type === t && B.prog >= 1); return B ? t + ': ' + tipFor(idx(B.x, B.y)).replace(/<[^>]+>/g, ' ') : t + ': none'; }));
ok(/⚕️/.test(tips[0]) && /💧/.test(tips[1]) && /cloth a year/.test(tips[2]) && /⚡ makes/.test(tips[3]), 'tooltips explain what the buildings do', tips.map(t => t.slice(0, 60)).join(' / '));

// a save from before cloth and glass
r = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(serialize())); for (const k in o.state.T) { const T = o.state.T[k]; delete T.res.cloth; delete T.res.glass; } deserialize(o); startWorld(false); SF.ff(20); return towns().every(T => RES.every(k => Number.isFinite(T.res[k]))); });
ok(r, 'an older save picks up cloth and glass');

// the industrial age and the culture sites
r = await p.evaluate(() => ({ springs: (S.springs || []).length, n: ['warehouse', 'shipyard', 'theatre', 'bathhouse', 'digsite', 'botanic', 'guildhall'].map(t => t + ' ' + anycount(t)).join(', '), soot: Array.from(SOOT).filter(v => v > .02).length, pol: Math.max(...towns().map(polOf)) }));
ok(r.springs >= 1, 'the world has hot springs', `${r.springs}`);
ok(r.soot > 0 || r.pol > 0, 'the steam age leaves soot around its works', `${r.soot} sooty tiles, worst town ${Math.round(r.pol * 100)}%`);
console.log('     ' + r.n);
await p.evaluate(() => SF.ff(1500));
r = await p.evaluate(() => ({ soot: Array.from(SOOT).filter(v => v > .02).length, pol: Math.max(...towns().map(polOf)), n: ['warehouse', 'theatre', 'bathhouse', 'digsite', 'botanic', 'guildhall'].map(t => anycount(t)), clean: !!S.flags.clean, finds: Object.values(S.B).filter(B => B.type === 'digsite').reduce((a, B) => a + (B.finds || 0), 0) }));
ok(r.soot === 0 && r.pol === 0 && r.clean, 'clean power ends the soot', `${r.soot} sooty tiles`);
ok(r.n.filter(n => n > 0).length >= 5, 'warehouses, theatres, bathhouses, digs, gardens and guild halls get built', r.n.join(' '));
ok(r.finds > 0, 'the Maker digs turn things up', `${r.finds} finds`);
r = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(serialize())); delete o.state.springs; deserialize(o); startWorld(false); SF.ff(5); return (S.springs || []).length; });
ok(r >= 1, 'an older save gets its hot springs');
ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
