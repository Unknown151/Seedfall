import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1920,height:1080}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,4).join(' | '))); p.on('console', m=>{ if(m.type()==='error') errs.push('CONSOLE '+m.text()); });
await p.goto(ROOT+'seedfall.html?seed=4242&fresh&nointro&dev');
await p.waitForTimeout(800);
await p.evaluate(()=>{ SF.ff(420); S.settings.captions=true; SF.hour(11); SF.weather('fair', 9999); S.rev = 70; });
await p.waitForTimeout(1500);
const r0 = await p.evaluate(()=>({ rev: S.rev.toFixed(1), rate: revRate().toFixed(2), max: revMax() }));
console.log('start', JSON.stringify(r0));
// natural gain over 20 s
await p.waitForTimeout(20000);
console.log('after 20s', await p.evaluate(()=>S.rev.toFixed(1)));
// force three prayers
const qs = await p.evaluate(()=>[SF.pray('rain') , SF.pray('name') || SF.pray('town'), SF.pray('ask')].map(q => q && { k: q.k, text: q.text, rw: q.rw }));
console.log('prayers', JSON.stringify(qs));
await p.waitForTimeout(1200);
await p.mouse.move(900, 500);
await p.screenshot({path:'faith_cards.png'});
// answer the rain prayer from the card
const before = await p.evaluate(()=>S.rev);
await p.click('.pray[data-pray] .pr-go');
await p.waitForTimeout(3000);
const after = await p.evaluate(()=>({ rev: S.rev, ok: S.prayOk, chron: S.chron.slice(-4).map(e=>e.ic+' '+e.t) }));
console.log('rain answered', (after.rev - before).toFixed(1), JSON.stringify(after));
await p.screenshot({path:'faith_answered.png'});
// answer the naming / ask prayers via the modal
for (let n = 0; n < 2; n++) {
  const bt = await p.$('.pray.open .pr-go'); if (!bt) break;
  await bt.click(); await p.waitForTimeout(400);
  const title = await p.evaluate(()=>document.getElementById('ansTitle').textContent);
  await p.screenshot({path:'faith_modal.png'});
  await p.fill('#ansText', title.includes('Name') ? 'Mittens' : 'Yes. Be brave, and bring cake.');
  await p.click('#ansGo'); await p.waitForTimeout(800);
  console.log('answered', title, await p.evaluate(()=>S.chron.slice(-2).map(e=>e.ic+' '+e.t).join(' | ')));
}
console.log('final rev', await p.evaluate(()=>JSON.stringify({ rev: S.rev.toFixed(1), ok: S.prayOk, open: S.prayers.filter(q=>q.st==='open').length })));
// tools: dock cost overlay & afford check
await p.evaluate(()=>{ S.rev = 10; renderTools(); });
await p.keyboard.press('5'); await p.waitForTimeout(300);
console.log('toast:', await p.evaluate(()=>document.getElementById('toast').textContent));
// natural prayer generation
await p.evaluate(()=>{ S.prayers = []; S.prayNext = S.playSec + 1; });
await p.waitForTimeout(3000);
console.log('natural', await p.evaluate(()=>JSON.stringify(S.prayers.map(q => [q.k, q.text]))));
console.log('ERR', errs.slice(0,6).join('\n') || 'none');
await b.close();
