import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const ctx = await b.newContext({viewport:{width:1920,height:1080}});
await ctx.grantPermissions(['clipboard-read','clipboard-write']);
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | ')));
await p.route('https://api.anthropic.com/v1/messages', async route => {
  const body = JSON.parse(route.request().postData());
  if (!body.tools) return route.fulfill({ status: 401, contentType:'application/json', body: JSON.stringify({type:'error',error:{type:'authentication_error',message:'invalid x-api-key'}}) });
  const input = body.tools[0].name === 'interpret_words' ? {
    doctrine_name: 'The Teaching of the Soft Paw', interpretation: 'Most colonists take it to mean the mossbacks must never be hurried, fenced or teased.',
    chronicle: [ { years_from_now: 0, icon: '🐾', text: 'The herders of the biggest town take down every fence overnight. The mossbacks do not notice.', major: true },
      { years_from_now: 12, icon: '🤔', text: 'Two schools of thought form: the Softs say never ride a mossback; the Gentles say riding is fine if you say please.' },
      { years_from_now: 40, icon: '🎆', text: 'The first Night of Soft Paws is held. Everyone walks slowly, on purpose.' } ],
    trait_bias: { kindness: 2, ambition: -1 }, favoured_buildings: ['park', 'shrine'], favoured_events: ['herd', 'festival'],
    festival_name: 'Night of Soft Paws', monument: { name: 'The Patient Mossback', kind: 'colossus' }, person_tag: 'Walks very slowly',
    new_guilty_pleasure: 'secretly brushing other people’s mossbacks', new_saying: '“Never hurry a mossback.”', devotion: 3 }
    : { entries: [{ years_from_now: 0, icon: '🥧', text: 'Somebody has been eating the festival decorations again. Everyone suspects the speaker.' }, { years_from_now: 3, icon: '🪁', text: 'A kite contest ends in a tie when both kites land on the same mossback.' }] };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id:'msg_test123', type:'message', role:'assistant', model: body.model, content:[{type:'tool_use', id:'toolu_1', name: body.tools[0].name, input}], stop_reason:'tool_use', usage:{input_tokens:1912, output_tokens:436} }) });
});
await p.goto(ROOT+'seedfall.html?seed=4242&fresh&nointro');
await p.waitForTimeout(800);
await p.evaluate(()=>SF.ff(300));
await p.evaluate(async()=>{ await speak('Remember to drink water.'); });                       // offline (no key)
await p.evaluate(async()=>{ AI.key='sk-ant-test'; await aiTest(); });                          // failed test (401 from mock)
await p.evaluate(async()=>{ SF.state().cool.speak=0; SF.state().rev=999; await speak('Be kind to the mossbacks.'); }); // mocked success
await p.evaluate(async()=>{ AI.narr='often'; AI.lastNarr=0; await aiMaybeGossip(); });
await p.evaluate(()=>SF.ff(15));
await p.keyboard.press('c'); await p.waitForTimeout(400);
await p.click('.tab[data-tab="voice"]'); await p.waitForTimeout(400);
await p.screenshot({path:'voice_tab.png'});
// open raw JSON of the words entry, copy it
const det = await p.$$('.vx details'); 
await det[2].evaluate(d=>d.open=true); await p.waitForTimeout(300);
await p.$eval('#pBody', el=>{ const d=el.querySelectorAll('.vx details')[2]; d.scrollIntoView(); });
await p.waitForTimeout(300);
await p.screenshot({path:'voice_tab_json.png'});
const cp = await p.$$('[data-copy]'); await cp[2].click(); await p.waitForTimeout(200);
const clip = await p.evaluate(()=>navigator.clipboard.readText());
console.log('clipboard starts:', clip.slice(0,80).replace(/\n/g,' '));
// open state survives a re-render
await p.evaluate(()=>{ UIDIRTY.voice=true; }); await p.waitForTimeout(800);
console.log('details still open after re-render:', await p.evaluate(()=>[...document.querySelectorAll('.vx details')].filter(d=>d.open).length));
console.log('log kinds:', await p.evaluate(()=>SF.state().aiLog.map(e=>e.kind+(e.ok?'✓':'✗')).join(' ')));
console.log('key in save?', await p.evaluate(()=>JSON.stringify(serialize()).includes('sk-ant-test')));
console.log('ERR', errs.join('\n') || 'none');
await b.close();
