import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1600,height:1000}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+e.stack));
await p.goto(`${ROOT}seedfall.html?seed=${process.argv[2]||4242}&fresh&nointro&dev`);
await p.waitForTimeout(1000);
for (const y of (process.argv[3]||'250,900').split(',').map(Number)) {
  await p.evaluate((y)=>{ SF.ff(y-SF.state().year); }, y);
  await p.keyboard.press('Tab').catch(()=>{});
  await p.evaluate(()=>{ if (!UI.panel) togglePanel(); setTab('towns'); renderPanelBody(true); });
  await p.waitForTimeout(800);
  await p.screenshot({path:`towns_${y}.png`, clip:{x:1180,y:0,width:420,height:1000}});
}
console.log(errs.join('\n'));
await b.close();
