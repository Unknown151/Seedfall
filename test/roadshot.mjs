// Close-ups of a town's streets at a few years, with a count of each road surface. Run from test/: `node roadshot.mjs [seed] [years...]`
import { launch, ROOT } from './env.mjs';
const seed = +(process.argv[2] || 4242), yrs = (process.argv.slice(3).length ? process.argv.slice(3) : ['300', '800', '1800', '2600', '3300']).map(Number);
const b = await launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro`); await p.waitForTimeout(500);
for (const y of yrs) {
  const r = await p.evaluate(y => { SF.ff(y - yr()); SF.weather('clear', 9999); SF.hour(13); const T = towns().sort((a, b) => b.pop - a.pop)[0];
    const [wx, wy] = gridToWorld(T.x + 1, T.y + 1, surfZ(idx(T.x, T.y))); CAM.x = CAM.tx = wx; CAM.y = CAM.ty = wy; CAM.z = CAM.tz = 3.2; CAM.manualUntil = DYN.t + 999;
    const n = [0, 0, 0, 0, 0, 0, 0, 0]; for (let i = 0; i < W * H; i++) n[M.road[i]]++; return { yr: Math.round(yr()), n: R_NAME.map((s, k) => k && n[k] ? `${s} ${n[k]}` : '').filter(Boolean).join(', ') }; }, y);
  await p.waitForTimeout(2500); await p.screenshot({ path: `roads_${y}.png` }); console.log(JSON.stringify(r));
}
console.log('ERR', errs.join(' | ') || 'none'); await b.close();
