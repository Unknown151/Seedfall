import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1920,height:1080}});
await p.goto(ROOT+'seedfall.html?seed=777&fresh&nointro&dev');
await p.waitForTimeout(800);
for (const y of [400, 1000]) {
  await p.evaluate((y)=>SF.ff(y-SF.state().year), y);
  await p.waitForTimeout(3000);
  const r = await p.evaluate(()=>{ const T=(f)=>{ const t=[]; for(let k=0;k<5;k++){ const t0=performance.now(); f(); t.push(performance.now()-t0);} t.sort((a,b)=>a-b); return Math.round(t[2]); };
    const withM = T(()=>renderAll()); const orig = window.matLines; window.matLines = ()=>{}; const noM = T(()=>renderAll()); window.matLines = orig;
    return { withMat: withM, noMat: noM, mats: Object.values(SF.state().B).filter(B=>B.mat).length }; });
  console.log(y, JSON.stringify(r));
}
await b.close();
