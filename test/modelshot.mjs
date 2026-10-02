// A catalogue of the building art: each type set down on open, level ground (two tiles apart) and photographed up close,
// with the world paused. Run from test/: `node modelshot.mjs [types|all] [year]` (`OUT=dir`, `HTML=path` to another build).
// Monuments go by `monument:sub`, houses by `house:tier` (`house:4` is the worker house).
import { launch, ROOT } from './env.mjs';
const want = process.argv[2] || 'all', year = +(process.argv[3] || 1500), out = process.env.OUT || '.';
const ALL = ['school', 'library', 'workshop', 'mine', 'lumber', 'quarry', 'claypit', 'mill', 'hall', 'observatory', 'works', 'station', 'clinic', 'power', 'turbine', 'mast', 'airfield', 'university', 'antenna', 'solar', 'vfarm', 'park', 'stadium', 'museum', 'launchpad', 'fusion', 'terraformer', 'dome', 'elevator', 'pasture', 'warehouse', 'theatre', 'bathhouse', 'digsite', 'botanic', 'guildhall', 'sandpit', 'weaver', 'glassworks', 'watertower', 'market', 'dock', 'plaza', 'farm', 'well', 'granary', 'shrine', 'watchstone', 'lighthouse',
  'monument:statue', 'monument:lantern', 'monument:spire', 'monument:harp', 'monument:gardens', 'monument:colossus', 'monument:hall', 'monument:clock', 'monument:orchard', 'monument:obelisk', 'house:0', 'house:1', 'house:2', 'house:3', 'house:4', 'house:5', 'house:6', 'house:7'];
const types = want === 'all' ? ALL : want.split(',');
const b = await launch(); const p = await b.newPage({ viewport: { width: 760, height: 520 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto((process.env.HTML ? 'file://' + process.env.HTML : ROOT + 'seedfall.html') + '?seed=4242&fresh&nointro&dev'); await p.waitForTimeout(800);
await p.evaluate(y => { SF.ff(y); UI.paused = true; SF.weather('clear', 9999); SF.hour(10); GL3.cam.auto = false; GL3.noNear = true; const d = document.getElementById('dbg'); if (d) d.style.display = 'none'; }, year);
for (const t of types) {
  const ok = await p.evaluate(t => {
    const [ty, sub] = t.split(':'), T = towns()[0];
    // open, level, dry ground well away from the streets, with a free tile all round
    let at = -1; for (let i = 0; i < W * H && at < 0; i++) { const x = i % W, y = (i / W) | 0; if (x < 3 || y < 3 || x > W - 4 || y > H - 4) continue; let good = true; for (let dy = -1; dy <= 1 && good; dy++) for (let dx = -1; dx <= 1 && good; dx++) { const j = idx(x + dx, y + dy); if (M.water[j] || M.bld[j] || M.road[j] || M.rail[j] || M.ruin[j] || surfZ(j) !== surfZ(i)) good = false; } if (good && hash2(x, y, 5) < .3) at = i; }
    if (at < 0) return 'no room';
    const x = at % W, y = (at / W) | 0; for (const [dx, dy] of N8.concat([[0, 0]])) { const j = idx(x + dx, y + dy); M.tree[j] = 0; markDirty(j); }
    const B = mkBuilding(ty, x, y, T, ty === 'house' ? { tier: +sub } : {}); B.prog = 1; if (ty === 'monument') B.sub = sub; if (ty === 'harbor' || ty === 'dock') B.dir = [1, 0];
    markDirty(at); GL3.follow = GL3.goto = null;
    Object.assign(GL3.cam, { tx: x, tz: y, ty: surfZ(at) * ZS + (BT[ty] ? Math.min(1.4, BT[ty].h * ZS * .45) : .5), zoom: ty === 'house' && +sub >= 6 || ['turbine', 'mast', 'launchpad', 'elevator', 'terraformer', 'lighthouse', 'monument'].includes(ty) ? 2.4 : 1.45, pitch: .42, yaw: Math.PI / 4 + .35 });
    window._ms = B; return 'ok';
  }, t);
  if (ok !== 'ok') { console.log(t, ok); continue; }
  await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 240000 });
  await p.evaluate(() => { const B = window._ms; for (let k = 0; k < GNC * GNC; k++) { const cx = (k % GNC) * GCH + 4, cz = ((k / GNC) | 0) * GCH + 4; if (Math.hypot(cx - B.x, cz - B.y) < 7) { const r = glBuildChunk(k, true); glAO(r.v); glUpload(GL3.chunks[k], r.v, true); } } });
  await p.waitForTimeout(2600); await p.screenshot({ path: `${out}/m_${t.replace(':', '_')}.png` }); console.log(t);
  await p.evaluate(() => { removeBuilding(window._ms); });
}
console.log('ERR', errs.slice(0, 6).join('\n') || 'none'); await b.close();
