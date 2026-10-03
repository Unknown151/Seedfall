// Screenshots of the biggest town at a few years: house variety, terraces, zones. Run from test/: `node houseshot.mjs [seed] [years...]`
import { launch, ROOT } from './env.mjs';
const seed = +(process.argv[2] || 4242), yrs = (process.argv.slice(3).length ? process.argv.slice(3) : ['900', '1500', '2400']).map(Number);
const b = await launch();
const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro`); await p.waitForTimeout(600);
let y0 = 0;
for (const y of yrs) {
  const info = await p.evaluate(([n, flat]) => { SF.ff(n); if (flat) { for (const st of S.styles) st.roofK = 'flat'; MATST.clear(); HTINT.clear(); for (let i = 0; i < W * H; i++) markDirty(i); } SF.weather('clear', 9999); SF.hour(13); const T = towns().sort((a, b) => b.pop - a.pop)[0];
    Object.assign(GL3.cam, { tx: T.x, tz: T.y, ty: surfZ(idx(T.x, T.y)) * ZS, zoom: 4.5, pitch: .62, auto: false }); GL3.follow = GL3.goto = null;
    const hs = Object.values(S.B).filter(B => B.type === 'house' && B.prog >= 1); return { yr: yr(), town: T.name, pop: T.pop, joined: hs.filter(B => houseJoin(B)).length, houses: hs.length, tiers: [0, 1, 2, 3, 4, 5, 6, 7].map(t => hs.filter(B => B.tier === t).length).join('/'), shops: anycount('shops'), redev: S.rdN || 0, zones: [1, 2, 3, 4].map(z => M.zone.filter(v => v === z).length).join('/') }; }, [y - y0, !!process.env.FLAT]);
  y0 = y; await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 240000 }); await p.waitForTimeout(4000);
  await p.screenshot({ path: `house_${process.env.FLAT ? 'flat_' : ''}${y}.png` }); console.log(JSON.stringify(info));
  if (process.env.ZONES) { await p.evaluate(() => { UI.zones = true; }); await p.waitForTimeout(300); await p.screenshot({ path: `zones_${y}.png` }); await p.evaluate(() => { UI.zones = false; }); }
}
console.log('ERR', errs.join(' | ') || 'none');
await b.close();
