import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1920,height:1080}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,4).join(' | ')));
await p.goto(ROOT+'seedfall.html?seed=777&fresh&nointro&dev');
await p.waitForTimeout(800);
await p.evaluate(()=>{ SF.ff(1500); S.settings.captions=false; });
// outside counts by time of day
for (const h of [3, 7.5, 12, 18, 23]) {
  await p.evaluate((h)=>{ SF.hour(h); }, h);
  await p.waitForTimeout(12000);
  console.log('hour', h, await p.evaluate(()=>{ const c={}; for (const w of DYN.walkers) c[w.st]=(c[w.st]||0)+1; const v={}; for (const x of DYN.vehicles) v[x.st]=(v[x.st]||0)+1; return JSON.stringify({ n: DYN.walkers.length, ...c, veh: v }); }));
}
// churn: preview pace, track stuck walkers
await p.evaluate(()=>{ SF.hour(12); S.settings.pace='preview'; window.__track = new Map(); });
let stuck = 0, samples = 0;
for (let k = 0; k < 12; k++) {
  await p.waitForTimeout(5000);
  const r = await p.evaluate(()=>{ let st = 0, n = 0, badTile = 0;
    for (const w of DYN.walkers) { if (w.st !== 'go') { __track.delete(w); continue; } n++; const pp = walkerPos(w); const prev = __track.get(w); if (prev && Math.hypot(prev[0]-pp[0], prev[1]-pp[1]) < .05) st++; __track.set(w, pp);
      const i = idx(clamp(Math.round(pp[0]),0,W-1), clamp(Math.round(pp[1]),0,H-1)); const B = M.bld[i] && S.B[M.bld[i]]; if (B && !OUTDOOR[B.type] && i !== w.destTile && i !== w.path[0] && B.prog >= 1) badTile++; }
    const idleBad = DYN.walkers.filter(w => w.st === 'idle' && M.bld[w.tile] && S.B[M.bld[w.tile]] && !OUTDOOR[S.B[M.bld[w.tile]].type]).length;
    return { n, st, badTile, idleBad, y: S.year | 0, nav: NAV.calls }; });
  stuck += r.st; samples += r.n; console.log(JSON.stringify(r));
}
console.log('stuck ratio', (stuck / samples).toFixed(3));
console.log('ERR', errs.slice(0,5).join('\n') || 'none');
await b.close();
