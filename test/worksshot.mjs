// Close-ups of production buildings in 3D: their moving parts (sails, wheels, cranes) and the people working there.
// Run from test/: `node worksshot.mjs [seed] [years] [types]` (years like 900,2600; types like mill,lumber)
import { launch, ROOT } from './env.mjs';
const seed = +(process.argv[2] || 4242), years = (process.argv[3] || '900,2600').split(',').map(Number), only = process.argv[4] && process.argv[4].split(','), out = process.env.OUT || '.';
const TYPES = ['farm', 'lumber', 'quarry', 'claypit', 'mine', 'pasture', 'sandpit', 'weaver', 'glassworks', 'workshop', 'works', 'mill', 'power', 'turbine', 'shipyard', 'harbor', 'warehouse'];
const b = await launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro&dev`); await p.waitForTimeout(800);
let y0 = 0;
for (const yr of years) {
  await p.evaluate(n => { SF.ff(n); SF.weather('clear', 9999); SF.hour(10.5); GL3.cam.auto = false; }, yr - y0); y0 = yr;
  for (const t of TYPES) {
    if (only && !only.includes(t)) continue;
    const at = await p.evaluate(t => { const Bs = Object.values(S.B).filter(B => B.type === t && B.prog >= 1); if (!Bs.length) return null; const B = Bs[(Bs.length / 2) | 0]; GL3.follow = null; GL3.goto = null; const c = GL3.cam; c.tx = B.x + (fpW(B) - 1) / 2; c.tz = B.y + (fpH(B) - 1) / 2; c.ty = surfZ(idx(B.x, B.y)) * ZS + .3; c.zoom = t === 'turbine' ? 4.5 : t === 'harbor' ? 3.5 : t === 'mill' || t === 'mine' ? 2.4 : 1.5; c.pitch = .62; c.yaw = Math.PI / 4 + .5; return [B.x, B.y]; }, t);
    if (!at) { console.log(yr, t, 'none'); continue; }
    await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 240000 }); await p.waitForTimeout(3000);
    for (const k of [0, 1]) { await p.screenshot({ path: `${out}/w_${yr}_${t}_${k}.png` }); await p.waitForTimeout(1500); }
    console.log(yr, t, at);
  }
}
console.log('ERR', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
