// Close-ups of what the towns build on the water (ocean.js, seamodels.js): every sea type, found in a grown world or set
// down where it would go, by day and (NIGHT=1) by night. `node seashot.mjs [types|all] [seed] [year]` (`OUT=dir`).
import { launch, ROOT } from './env.mjs';
const ALL = ['oysters', 'saltpan', 'seapier', 'desal', 'oilrig', 'reef', 'windpark', 'fishfarm', 'wavefarm', 'floatsolar', 'kelp', 'seastead', 'sealaunch', 'beach', 'harbor'];
const want = process.argv[2] || 'all', seed = +(process.argv[3] || 777), year = +(process.argv[4] || 2400), out = process.env.OUT || '.', night = !!process.env.NIGHT;
const types = want === 'all' ? ALL : want.split(',');
const b = await launch(); const p = await b.newPage({ viewport: { width: 760, height: 520 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await p.goto(ROOT + `seedfall.html?seed=${seed}&fresh&nointro&dev`); await p.waitForTimeout(800);
await p.evaluate(([y, n]) => { SF.ff(y); UI.paused = true; SF.weather('clear', 9999); SF.hour(n ? 22.5 : 11); GL3.cam.auto = false; const d = document.getElementById('dbg'); if (d) d.style.display = 'none'; }, [year, night]);
for (const t of types) {
  const ok = await p.evaluate(t => {
    let B = null, at = null;
    if (t === 'beach') { // a sand tile by the sea near a bigger town
      for (let i = 0; i < W * H && !at; i++) { const x = i % W, y = (i / W) | 0; if (M.bio[i] !== BIO.SAND || M.water[i] || M.bld[i] || M.road[i] || x < 1 || y < 1 || x > W - 2 || y > H - 2) continue;
        if (N4.some(([dx, dy]) => isSea(idx(x + dx, y + dy))) && towns().some(T => T.pop > 600 && dist(x, y, T.x, T.y) < townRadius(T) + 5)) at = [x, y, surfZ(i) * ZS]; }
      if (!at) return 'no beach';
    } else {
      B = Object.values(S.B).find(B => B.type === t && B.prog >= 1);
      if (!B) { const Ts = towns().filter(seaTown).sort((a, b) => b.pop - a.pop); for (const T of Ts) { if (t === 'reef') { const s = seaSite(T, 'off', { d0: 4, d1: 9 }); if (s) B = mkBuilding('reef', s.x, s.y, T, { prog: 1 }); }
          else if (t === 'seapier') B = seaPier(T); else B = seaPut(T, t, seaSite(T, SEA_T[t] ? (['oilrig', 'windpark', 'seastead', 'sealaunch'].includes(t) ? 'off' : 'shore') : 'coast', {}));
          if (B) { B.prog = 1; for (const j of fpTiles(B)) markDirty(j); break; } } }
      if (!B) return 'none';
      const [x, y] = glLot(B); at = [x, y, SEA_T[t] ? SEA_Y : surfZ(idx(B.x, B.y)) * ZS];
    }
    const tall = ['oilrig', 'windpark', 'sealaunch', 'seastead', 'reef'].includes(t);
    GL3.follow = GL3.goto = null; Object.assign(GL3.cam, { tx: at[0], tz: at[1], ty: at[2] + (t === 'windpark' ? 1.4 : tall ? .5 : .1), zoom: t === 'windpark' ? 4.2 : t === 'harbor' ? 4 : t === 'seapier' ? 2.6 : tall ? 2.4 : 1.5, pitch: t === 'windpark' ? .25 : .42, yaw: Math.PI / 4 + .35 });
    window._at = at; return 'ok';
  }, t);
  if (ok !== 'ok') { console.log(t, ok); continue; }
  await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 240000 });
  await p.evaluate(() => { const a = window._at; for (let k = 0; k < GNC * GNC; k++) { const cx = (k % GNC) * GCH + 4, cz = ((k / GNC) | 0) * GCH + 4; if (Math.hypot(cx - a[0], cz - a[1]) < 7) { const r = glBuildChunk(k, true); glAO(r.v); glUpload(GL3.chunks[k], r.v, true); } } });
  await p.waitForTimeout(3000); await p.screenshot({ path: `${out}/sea_${t}${night ? '_n' : ''}.png` }); console.log(t);
}
console.log('ERR', errs.slice(0, 6).join('\n') || 'none'); await b.close();
