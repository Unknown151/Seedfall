// Close-ups of the trams in town (horse, electric, modern) and a station out at the edge. Run from test/:
// `node tramshot.mjs [seed] [years]` (OUT=dir)
import { launch, ROOT } from './env.mjs';
const seed = +(process.argv[2] || 4242), years = (process.argv[3] || '1150,1600,2000').split(',').map(Number), out = process.env.OUT || '.';
const b = await launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro&dev`); await p.waitForTimeout(800);
let y0 = 0;
for (const yr of years) {
  await p.evaluate(n => { SF.ff(n); SF.weather('clear', 9999); SF.hour(10.5); GL3.cam.auto = false; GL3.follow = GL3.goto = null; }, yr - y0); y0 = yr;
  for (const shot of ['tram', 'station']) {
    const at = await p.evaluate(shot => {
      stepTrams(.01); const tm = (DYN.trams || []).slice().sort((a, b) => b.P.length - a.P.length)[0]; if (!tm) return null;
      let q; if (shot === 'tram') { tm.s = Math.floor(tm.P.length / 3) + .5; tm.wait = 9999; q = tramPos(tm.P, tm.s); }
      else { const B = stationOf(S.T[tm.sid]); if (!B) return null; q = [B.x, surfZ(idx(B.x, B.y)) * ZS, B.y, 1, 0]; }
      const c = GL3.cam; c.tx = q[0]; c.tz = q[2]; c.ty = q[1] + .2; c.zoom = shot === 'tram' ? 1.7 : 3.2; c.pitch = .6; c.yaw = Math.atan2(q[4], q[3]) + .9;
      for (let j = 0; j < GNC * GNC; j++) { const cx = (j % GNC) * GCH + 4, cz = ((j / GNC) | 0) * GCH + 4; if (Math.hypot(cx - q[0], cz - q[2]) < 8) { const r = glBuildChunk(j, true); glAO(r.v); glUpload(GL3.chunks[j], r.v, true); } }
      return [Math.round(q[0]), Math.round(q[2])];
    }, shot);
    if (!at) { console.log(yr, shot, 'none'); continue; }
    await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 240000 }); await p.waitForTimeout(2500);
    await p.screenshot({ path: `${out}/tram_${yr}_${shot}.png` }); console.log(yr, shot, at);
  }
}
console.log('ERR', errs.slice(0, 8).join('\n'));
await b.close();
