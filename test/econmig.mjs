import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1600,height:900}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | ')));
await p.addInitScript(()=>{ window.showDirectoryPicker = async()=>{ const root = await navigator.storage.getDirectory(); return await root.getDirectoryHandle('seedfall-econmig',{create:true}); }; });
await p.goto(HTTP+'seedfall.html?seed=31337');
await p.waitForTimeout(1000);
await p.click('#wFolder'); await p.waitForTimeout(9000);
await p.evaluate(()=>SF.ff(700));
// make it look like a save from before the economy existed
await p.evaluate(()=>{ const S=SF.state(); for (const T of Object.values(S.T)) for (const k of ['res','short','flow','exp','use','um','pot','mc','mpref','known','knownYr','matYr','swYr']) delete T[k];
  for (const B of Object.values(S.B)) { delete B.mat; delete B.cost; delete B.sw; delete B.ef; if (B.type==='lumber'||B.type==='quarry'||B.type==='claypit') { removeBuilding(B); } }
  delete S.trade; delete S.econYr; delete S.tradeYr; for (let i=0;i<M.wild.length;i++) if (M.wild[i]===3) M.wild[i]=0; });
await p.evaluate(()=>SF.save()); await p.waitForTimeout(1500);
await p.reload(); await p.waitForTimeout(3500);
const r0 = await p.evaluate(()=>({ y:SF.state().year|0, res:towns().map(T=>T.res?1:0).join(''), mats:Object.values(SF.state().B).filter(B=>B.mat).length }));
console.log('after reload', JSON.stringify(r0));
await p.evaluate(()=>SF.ff(150)); await p.waitForTimeout(2000);
const r = await p.evaluate(()=>{ const bad=[]; for (const T of towns()) for (const r of RES) if (!isFinite(T.res[r]) || T.res[r] < 0) bad.push(T.name+' '+r+' '+T.res[r]);
  const ex={}; for (const B of Object.values(SF.state().B)) if (EXTRACT[B.type]) ex[B.type]=(ex[B.type]||0)+1;
  return { y:SF.state().year|0, bad, ex, mats:Object.values(SF.state().B).filter(B=>B.mat).length, summary:econSummary() }; });
console.log(JSON.stringify(r, null, 1).slice(0, 1500));
// open the towns tab, hover a quarry
await p.evaluate(()=>{ if (!UI.panel) togglePanel(); setTab('towns'); renderPanelBody(true); });
await p.waitForTimeout(500);
console.log('towns tab cards', await p.evaluate(()=>document.querySelectorAll('.tcard').length));
console.log('tips', await p.evaluate(()=>{ const out=[]; for (const t of ['quarry','lumber','claypit','mine','house','plaza','workshop']) { const B=Object.values(SF.state().B).find(B=>B.type===t&&B.prog>=1); if (B) out.push(tipFor(idx(B.x,B.y)).replace(/<[^>]+>/g,' | ')); } return out.join('\n'); }));
console.log('ERR', errs.join('\n') || 'none');
await b.close();
