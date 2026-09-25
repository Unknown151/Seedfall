import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const ctx = await b.newContext({viewport:{width:1920,height:1080}});
const p = await ctx.newPage();
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | ')));
await p.goto(ROOT+'seedfall.html?seed=4242&fresh&nointro');
await p.waitForTimeout(800);
await p.evaluate(()=>SF.ff(400));

// 1) offline: no key
await p.keyboard.press('6'); await p.waitForTimeout(300);
console.log('speak modal open:', await p.evaluate(()=>document.getElementById('speak').classList.contains('show')), '|', await p.evaluate(()=>document.getElementById('spkMode').textContent));
await p.fill('#spkText', 'Remember to drink water.');
await p.click('#spkGo'); await p.waitForTimeout(500);
console.log('offline doctrine:', JSON.stringify(await p.evaluate(()=>SF.state().doctrines.at(-1))));
console.log('queued:', await p.evaluate(()=>SF.state().aiQueue.length), 'cooldown set:', await p.evaluate(()=>!toolReady('speak')));

// 2) real API with a bad key, from file:// (checks CORS + error path)
await p.evaluate(async()=>{ AI.key='sk-ant-invalid-test'; SF.state().cool.speak=0; SF.state().rev=999; await speak('Test words.'); });
console.log('bad key status:', await p.evaluate(()=>AI.status), '| doctrine ai:', await p.evaluate(()=>SF.state().doctrines.at(-1).ai));

// 3) mocked success
let seen=null;
await p.route('https://api.anthropic.com/v1/messages', async route => {
  const req = route.request(); const body = JSON.parse(req.postData());
  seen = { headers: req.headers(), model: body.model, tool: body.tools[0].name, choice: body.tool_choice, sysLen: body.system.length, userHead: body.messages[0].content.slice(0,300) };
  const input = body.tools[0].name === 'interpret_words' ? {
    doctrine_name: 'The Teaching of the Soft Paw',
    interpretation: 'Most colonists take it to mean the mossbacks must never be hurried, fenced or teased.',
    chronicle: [
      { years_from_now: 0, icon: '🐾', text: 'In Lyldal the herders take down every fence overnight. The mossbacks do not notice.', town: 'x', major: true },
      { years_from_now: 12, icon: '🤔', text: 'Two schools of thought form: the Softs say never ride a mossback; the Gentles say riding is fine if you say please.' },
      { years_from_now: 40, icon: '🎆', text: 'The first Night of Soft Paws is held. Everyone walks slowly, on purpose.' }
    ],
    trait_bias: { kindness: 2, ambition: -1 },
    favoured_buildings: ['park', 'shrine', 'spaceport'],
    favoured_events: ['herd', 'festival'],
    festival_name: 'Night of Soft Paws',
    monument: { name: 'The Patient Mossback', kind: 'colossus' },
    person_tag: 'Walks very slowly',
    new_guilty_pleasure: 'secretly brushing other people’s mossbacks',
    new_saying: '“Never hurry a mossback.”',
    devotion: 3
  } : { entries: [{ years_from_now: 0, icon: '🥧', text: 'Somebody in town has been eating the decorations again. Everyone suspects the steward.' }] };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: {'access-control-allow-origin':'*'}, body: JSON.stringify({ id:'msg_test', type:'message', role:'assistant', model: body.model, content:[{type:'tool_use', id:'tu_1', name: body.tools[0].name, input}], stop_reason:'tool_use', usage:{input_tokens:1800, output_tokens:420} }) });
});
await p.evaluate(async()=>{ SF.state().cool.speak=0; SF.state().rev=999; await speak('Be kind to the mossbacks.'); });
console.log('request:', JSON.stringify({model:seen.model, tool:seen.tool, choice:seen.choice, dangerous: seen.headers['anthropic-dangerous-direct-browser-access'], version: seen.headers['anthropic-version'], sysLen:seen.sysLen}));
console.log('user prompt head:', seen.userHead.replace(/\n/g,' | '));
const d = await p.evaluate(()=>{ const S=SF.state(); const d=S.doctrines.at(-1); return { name:d.name, str:d.str, tb:d.tb, bld:d.bld, ev:d.ev, fest:S.extraFest, extraQ:S.extraQ, wonder:S.pendingWonder, cult:CULT, tagged: living().filter(p=>p.q.tag==='Walks very slowly').length, queue:S.aiQueue.map(q=>Math.round(q.at-S.year)+':'+q.t.slice(0,40)) }; });
console.log('applied:', JSON.stringify(d, null, 0));
await p.evaluate(()=>SF.ff(60));
console.log('chron after 60y:\n' + await p.evaluate(()=>SF.state().chron.filter(e=>/Soft Paw|schools of thought|fences|Patient Mossback|Watcher speaks|drink water|Test words/.test(e.t)).map(e=>`Y${e.yr} ${e.ic} ${e.t}`).join('\n')));
// gossip
await p.evaluate(async()=>{ AI.narr='often'; AI.lastNarr=0; UI.paused=false; await aiMaybeGossip(); });
console.log('gossip queued:', await p.evaluate(()=>SF.state().aiQueue.filter(q=>/decorations/.test(q.t)).length), '| status:', await p.evaluate(()=>AI.status));
// lore tab screenshot
await p.keyboard.press('c'); await p.waitForTimeout(400); await p.click('.tab[data-tab="lore"]'); await p.waitForTimeout(400);
await p.screenshot({path:'ai_lore.png'});
await p.keyboard.press('Escape'); await p.evaluate(()=>{ SF.state().cool.speak=0; SF.state().rev=999; }); await p.keyboard.press('6'); await p.fill('#spkText','Be kind to the mossbacks.'); await p.waitForTimeout(300);
await p.screenshot({path:'ai_speak.png'});
await p.click('#spkSettings'); await p.waitForTimeout(300); await p.screenshot({path:'ai_settings.png'});
console.log('ERR', errs.join('\n') || 'none');
await b.close();
