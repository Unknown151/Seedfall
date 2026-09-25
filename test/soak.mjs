import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1920,height:1080}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | '))); p.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text())});
await p.goto(ROOT+'seedfall.html?seed=999&fresh&dev');
await p.waitForTimeout(9000); // intro plays
await p.evaluate(()=>{ SF.state().settings.pace='preview'; });
for (const [ff, secs] of [[0,15],[300,12],[900,12],[1700,12],[2600,12],[3900,12]]) {
  if (ff) await p.evaluate((y)=>SF.ff(y), ff);
  // poke some tools & effects
  await p.evaluate(()=>{ SF.state().cool={}; SF.state().rev=999; const T=biggestTown(); useTool('rain',T.x+2,T.y+2); useTool('drop',T.x,T.y); useTool('inspire',T.x,T.y); useTool('starfall',T.x+6,T.y-6); useTool('bloom',T.x-5,T.y+5); SF.fx('giant',{}); SF.fx('meteors',{}); SF.fx('comet',{}); SF.fx('herd',{x:T.x,y:T.y}); SF.fx('birds',{x:T.x,y:T.y}); });
  await p.mouse.move(800+Math.random()*300, 500); await p.keyboard.press('c'); await p.waitForTimeout(secs*500); await p.keyboard.press('c');
  await p.waitForTimeout(secs*500);
  const st = await p.evaluate(()=>({y:SF.state().year|0, pop:Math.round(totalPop()), era:eraName(), fps:document.getElementById('fps').textContent, chron:SF.state().chron.length}));
  console.log(JSON.stringify(st));
}
await p.screenshot({path:'soak_end.png'});
console.log('ERRORS:', errs.length); console.log(errs.slice(0,15).join('\n'));
await b.close();
