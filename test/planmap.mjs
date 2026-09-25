import { launch, ROOT, HTTP } from './env.mjs';
import fs from 'fs';
const b = await launch();
const p = await b.newPage({viewport:{width:800,height:600}});
p.on('pageerror', e=>console.log('PAGEERR '+e.message));
const seed=process.argv[2]||'4242', yrs=(process.argv[3]||'250,600,1200').split(',').map(Number);
await p.goto(`${ROOT}seedfall.html?seed=${seed}&fresh&nointro`);
await p.waitForTimeout(600);
const out={};
for (const y of yrs) out[y] = await p.evaluate((y)=>{ SF.ff(y-SF.state().year); const a=[]; for (let i=0;i<W*H;i++){ const B=S.B[M.bld[i]]; a.push(M.water[i]? (M.road[i]?'B':'~') : B ? (B.type==='house'?'h':B.type==='farm'?'f':B.type==='plaza'||B.type==='pod'?'P':'b') : M.road[i]?'r':M.plan[i]?'.':M.tree[i]?'t':' '); }
  return {a:a.join(''), dbg:JSON.stringify(DBG), towns:towns().map(T=>[T.x,T.y,T.name,Math.round(T.pop),T.grid?T.grid.sx+'x'+T.grid.sy:''])}; }, y);
fs.writeFileSync('planmap.json', JSON.stringify(out));
await b.close();
