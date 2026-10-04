// Close-ups of the railway in 3D: the track on a curve, a level crossing with its barriers down, a bridge, and the
// train of the age (steam, electric, maglev). Run from test/: `node railshot.mjs [seed] [years]` (OUT=dir)
import { launch, ROOT } from './env.mjs';
const seed = +(process.argv[2] || 4242), years = (process.argv[3] || '1150,1600,2850').split(',').map(Number), out = process.env.OUT || '.';
const b = await launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro&dev`); await p.waitForTimeout(800);
let y0 = 0;
for (const yr of years) {
  await p.evaluate(n => { SF.ff(n); SF.weather('clear', 9999); SF.hour(10.5); GL3.cam.auto = false; GL3.follow = GL3.goto = null; }, yr - y0); y0 = yr;
  const info = await p.evaluate(() => { const m = railMap(); return { lines: (S.rails || []).filter(r => r.path).length, tiles: m.size, xings: RAILX.xs.length, trains: DYN.trains.length, era: railEra() }; });
  console.log(yr, JSON.stringify(info));
  if (!info.tiles) continue;
  for (const shot of ['curve', 'xing', 'bridge', 'train']) {
    const at = await p.evaluate(shot => { // pick a spot, put a train there, and frame it
      const m = railMap(), tiles = [...m.keys()], turn = i => m.get(i).some(([a, b]) => a % W !== b % W && ((a / W) | 0) !== ((b / W) | 0));
      const pickT = shot === 'curve' ? tiles.find(turn) : shot === 'xing' ? RAILX.xs[0] : shot === 'bridge' ? tiles.find(i => M.water[i]) : null;
      const tr = DYN.trains.find(t => t.r.path) || null; if (!tr) return null; const P = tr.r.path, L = P.length - 1, len = trainCars(tr).len;
      let i = pickT != null ? pickT : P[Math.min(L - 2, (L / 2) | 0)], k = P.indexOf(i);
      if (k < 0) { const r = S.rails.find(r => r.path && r.path.includes(i)); const t2 = DYN.trains.find(t => t.r === r); if (!t2) return null; k = r.path.indexOf(i); window._tr = t2; } else window._tr = tr;
      const T = window._tr; T.lo = clamp(k - (shot === 'xing' ? len + .8 : len / 2), .5, T.r.path.length - 1.5 - len); T.wait = 9999; T.v = 0; T.dir = 1;
      const c = GL3.cam, q = railPos(T.r.path, k); c.tx = q[0]; c.tz = q[2]; c.ty = q[1] + .2; c.zoom = shot === 'train' ? 2.2 : 2.6; c.pitch = .78; c.yaw = Math.atan2(q[4], q[3]) + .9;
      for (let j = 0; j < GNC * GNC; j++) { const cx = (j % GNC) * GCH + 4, cz = ((j / GNC) | 0) * GCH + 4; if (Math.hypot(cx - q[0], cz - q[2]) < 8) { const r = glBuildChunk(j, true); glAO(r.v); glUpload(GL3.chunks[j], r.v, true); } }
      if (shot === 'xing') stepTrains(.016); // the barriers see the train
      return [i % W, (i / W) | 0];
    }, shot);
    if (!at) { console.log(yr, shot, 'none'); continue; }
    await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 240000 }); await p.waitForTimeout(shot === 'xing' ? 6000 : 2500);
    await p.screenshot({ path: `${out}/rail_${yr}_${shot}.png` }); console.log(yr, shot, at);
  }
}
console.log('ERR', errs.slice(0, 8).join('\n'));
await b.close();
