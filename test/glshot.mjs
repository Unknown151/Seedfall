// The 3D preview (?gl): screenshots of the biggest town at a few hours. Run from test/: `node glshot.mjs [seed] [year]`
import { launch, ROOT } from './env.mjs';
const seed = +(process.argv[2] || 4242), year = +(process.argv[3] || 1200), only = process.argv[4];
const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro&gl`); await p.waitForTimeout(800);
const on = await p.evaluate(() => GL3.on); console.log('gl on:', on);
await p.evaluate(y => { SF.ff(y); SF.weather('clear', 9999); glFocusTown(); GL3.cam.auto = false; }, year);
for (const [hr, yaw, tag] of [[13, Math.PI / 4, 'noon'], [13, Math.PI / 4 + 2.2, 'noon_turned'], [18.7, Math.PI / 4 + 1, 'evening'], [23, Math.PI / 4 + .4, 'night']]) {
  if (only && !only.split(',').includes(tag)) continue;
  await p.evaluate(([hr, yaw]) => { SF.hour(hr); GL3.cam.yaw = yaw; }, [hr, yaw]);
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `gl_${year}_${tag}.png` });
  console.log(tag, await p.evaluate(() => ({ chunks: GL3.chunks.filter(c => c.n).length, tris: Math.round(GL3.chunks.reduce((a, c) => a + c.n, 0) / 3), dirty: GL3.dirty.size })));
}
console.log('build ms', await p.evaluate(() => { const t0 = performance.now(); for (let k = 0; k < GNC * GNC; k++) glBuildChunk(k); return Math.round(performance.now() - t0); }));
console.log('ERR', errs.slice(0, 5).join(' | ') || 'none'); await b.close();
