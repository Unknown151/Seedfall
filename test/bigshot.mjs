// Close-ups of the big buildings on their lots (sim.js FP_BIG, bigmodels.js): the launch complex, the space elevator, the airfield,
// the works, the power station, the climate engine, the garden dome, the warehouse. Found in a grown world, or laid out on a
// lot where they would go. `node bigshot.mjs [types|all] [seed] [year]` (`OUT=dir`).
import { launch, ROOT } from './env.mjs';
const ALL = ['launchpad', 'elevator', 'airfield', 'works', 'power', 'terraformer', 'dome', 'warehouse'];
const want = process.argv[2] || 'all', seed = +(process.argv[3] || 777), year = +(process.argv[4] || 3400), out = process.env.OUT || '.';
const types = want === 'all' ? ALL : want.split(',');
const b = await launch(); const p = await b.newPage({ viewport: { width: 900, height: 600 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro&dev`); await p.waitForTimeout(800);
await p.evaluate(y => { SF.ff(y); UI.paused = true; SF.weather('clear', 9999); SF.hour(11); GL3.cam.auto = false; const d = document.getElementById('dbg'); if (d) d.style.display = 'none'; }, year);
for (const t of types) {
  const ok = await p.evaluate(t => {
    let B = Object.values(S.B).find(B => B.type === t && B.prog >= 1 && fpBig(B));
    if (!B) for (const T of towns().sort((a, b) => b.pop - a.pop)) { B = placeBig(T, t); if (B) { B.prog = 1; if (t === 'launchpad') B.rk = 1; break; } }
    if (!B) return 'no lot';
    const [x, y] = glLot(B), n = Math.max(fpW(B), fpH(B)), tall = t === 'launchpad' || t === 'elevator' || t === 'terraformer';
    GL3.follow = GL3.goto = null; Object.assign(GL3.cam, { tx: x, tz: y, ty: surfZ(idx(B.x, B.y)) * ZS + (tall ? 1.2 : .3), zoom: n * (tall ? 1.7 : 1.3), pitch: tall ? .5 : .75, yaw: Math.PI / 4 + .35 });
    window._at = [x, y]; return 'ok';
  }, t);
  if (ok !== 'ok') { console.log(t, ok); continue; }
  await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 300000 });
  await p.evaluate(() => { const a = window._at; for (let k = 0; k < GNC * GNC; k++) { const cx = (k % GNC) * GCH + 4, cz = ((k / GNC) | 0) * GCH + 4; if (Math.hypot(cx - a[0], cz - a[1]) < 8) { const r = glBuildChunk(k, true); glAO(r.v); glUpload(GL3.chunks[k], r.v, true); } } });
  await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/big_${t}.png`, timeout: 300000 }); console.log(t);
}
console.log('ERR', errs.slice(0, 6).join('\n') || 'none'); await b.close();
