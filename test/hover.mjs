import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1920,height:1080}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | ')));
await p.goto(ROOT+'seedfall.html?seed=4242&fresh&nointro');
await p.waitForTimeout(800);
await p.evaluate(()=>{ SF.hour(13); SF.ff(320); SF.state().settings.captions=false; const T=biggestTown(); focusOn(T.x,T.y,2.2,999); });
await p.waitForTimeout(6000);
// find a named walker on screen
const pos = await p.evaluate(()=>{ const ws=SF.dyn.walkers.filter(w=>w.pid&&w.sx!=null&&w.sx>300&&w.sx<1500&&w.sy>200&&w.sy<900); ws.sort((a,b)=>SF.state().P[b.pid].deeds.length-SF.state().P[a.pid].deeds.length); const w=ws[0]; return w?{x:w.sx,y:w.sy,pid:w.pid}:null; });
console.log('walker', JSON.stringify(pos));
if (pos) {
  // freeze sim movement a moment so the walker stays put: pause dynamics by nudging mouse repeatedly onto its current position
  for (let k=0;k<4;k++){ const q = await p.evaluate((pid)=>{ const w=SF.dyn.walkers.find(w=>w.pid===pid); return {x:w.sx,y:w.sy}; }, pos.pid); await p.mouse.move(q.x, q.y); await p.waitForTimeout(120); }
  await p.waitForTimeout(250);
  await p.screenshot({path:'hover_map.png'});
}
// panel people tab + row hover
await p.keyboard.press('c'); await p.waitForTimeout(600);
await p.click('.tab[data-tab="people"]'); await p.waitForTimeout(500);
const row = await p.$$('.prow'); if (row[2]) { await row[2].hover(); await p.waitForTimeout(400); }
await p.screenshot({path:'hover_panel.png'});
if (row[2]) { await row[2].click(); await p.waitForTimeout(500); }
await p.mouse.move(960, 540); await p.waitForTimeout(300);
await p.screenshot({path:'person_detail.png'});
console.log('ERR', errs.join('\n'));
await b.close();
