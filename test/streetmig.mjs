import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const ctx = await b.newContext({viewport:{width:1400,height:900}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | ')));
await p.goto(HTTP+'dist/Seedfall/seedfall.html?seed=4242&fresh&nointro&2d&headless'); // (a save migration: nothing needs drawing; the older build knew ?2d)
await p.waitForTimeout(1500);
const before = await p.evaluate(()=>{ SF.ff(700); const S=SF.state(); return { y:S.year|0, houses:Object.values(S.B).filter(B=>B.type==='house').length, road:M.road.reduce((a,v)=>a+(v?1:0),0), hasPlan: !!M.plan }; });
await p.evaluate(()=>{ if (typeof SCRATCH !== 'undefined') SCRATCH = false; return SF.save(); }); await p.waitForTimeout(2000); // (a ?fresh world is scratch and never saves: let this one)
console.log('old build', JSON.stringify(before));
await p.goto(HTTP+'seedfall.html?headless');
await p.waitForFunction(() => typeof M !== 'undefined' && M && M.plan && S && S.year > 1, null, { timeout: 60000 }); await p.waitForTimeout(1000);
const after = await p.evaluate(()=>{ const S=SF.state(); let plan=0; for (let i=0;i<M.plan.length;i++) if (M.plan[i]) plan++;
  // how many existing houses face a planned street, and are towns still on the old 4-grid?
  const hs=Object.values(S.B).filter(B=>B.type==='house'); const fr=hs.filter(B=>fronts(B.x,B.y)).length;
  return { y:S.year|0, houses:hs.length, plan, fronting:fr, grids:towns().map(T=>T.grid&&T.grid.sx+'x'+T.grid.sy).join(',') }; });
console.log('new build load', JSON.stringify(after));
const later = await p.evaluate(()=>{ SF.ff(300); const S=SF.state(); return { y:S.year|0, houses:Object.values(S.B).filter(B=>B.type==='house').length, pop:Math.round(totalPop()), dbg:JSON.stringify(DBG) }; });
console.log('after 300y', JSON.stringify(later));
console.log('ERR', errs.join('\n')||'none');
await b.close();
