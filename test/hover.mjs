import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1920,height:1080}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | ')));
await p.goto(ROOT+'seedfall.html?seed=4242&fresh&nointro&headless'); // (the panel's hover cards; pointing at the 3D view is glpick's)
await p.waitForTimeout(800);
await p.evaluate(()=>{ SF.hour(13); SF.ff(320); SF.state().settings.captions=false; });
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
