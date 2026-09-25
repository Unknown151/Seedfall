import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const ctx = await b.newContext({viewport:{width:1920,height:1080}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+e.stack)); p.on('console', m=>{ if(m.type()==='error') errs.push('console: '+m.text())});
// mock the folder picker with OPFS
await p.addInitScript(()=>{ window.showDirectoryPicker = async()=>{ const root = await navigator.storage.getDirectory(); return await root.getDirectoryHandle('seedfall-data',{create:true}); }; });
await p.goto(HTTP+'seedfall.html');
await p.waitForTimeout(1200);
await p.screenshot({path:'flow_welcome.png'});
await p.click('#wFolder');
await p.waitForTimeout(3000);
await p.screenshot({path:'flow_intro.png'});
await p.waitForTimeout(6000);
await p.screenshot({path:'flow_landed.png'});
// fast forward a bit, then open panel
await p.evaluate(()=>SF.ff(180));
await p.waitForTimeout(800);
await p.mouse.move(900,500); await p.waitForTimeout(300);
await p.keyboard.press('1');
await p.waitForTimeout(300);
await p.mouse.click(960,560);
await p.waitForTimeout(1500);
await p.screenshot({path:'flow_rain.png'});
await p.keyboard.press('c');
await p.waitForTimeout(1200);
await p.screenshot({path:'flow_panel.png'});
await p.click('.tab[data-tab="lore"]'); await p.waitForTimeout(400); await p.screenshot({path:'flow_lore.png'});
await p.click('.tab[data-tab="towns"]'); await p.waitForTimeout(400);
// save & inspect files
await p.evaluate(()=>SF.save());
await p.waitForTimeout(1500);
const files = await p.evaluate(async()=>{ const root = await navigator.storage.getDirectory(); const d = await root.getDirectoryHandle('seedfall-data'); const out={}; for await (const [n,h] of d.entries()){ if(h.kind==='file'){ const f=await h.getFile(); out[n]={size:f.size, head:(await f.text()).slice(0,500)} } else { const names=[]; for await (const [m] of h.entries()) names.push(m); out[n+'/']=names; } } return out; });
for (const [n,v] of Object.entries(files)) console.log('FILE', n, JSON.stringify(v).slice(0,700));
const y1 = await p.evaluate(()=>SF.state().year);
// reload -> should restore
await p.reload(); await p.waitForTimeout(2500);
const y2 = await p.evaluate(()=>SF.state() && SF.state().year);
const welcomeShown = await p.evaluate(()=>document.getElementById('welcome').classList.contains('show'));
const banner = await p.evaluate(()=>document.getElementById('banner').textContent + ' | show=' + document.getElementById('banner').classList.contains('show'));
console.log('year before reload', y1.toFixed(2), 'after', y2 && y2.toFixed(2), 'welcomeShown', welcomeShown, 'banner', banner);
await p.screenshot({path:'flow_reload.png'});
console.log(errs.join('\n'));
await b.close();
