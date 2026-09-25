import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
for (const seed of (process.argv[2]||'777').split(',')) {
const p = await b.newPage({viewport:{width:800,height:600}});
p.on('pageerror', e=>console.log('ERR', e.message));
await p.goto(`${ROOT}seedfall.html?seed=${seed}&fresh&nointro`);
await p.waitForTimeout(600);
const r = await p.evaluate(()=>{ SF.ff(+new URLSearchParams(location.search).get('y')||2500); const S=SF.state();
  const ics=['🛒','🪵','🪨','🧱','⚙️','📦']; const keys=['Woodcutters','quarry','Clay is dug','mine is opened','cottage is finished'];
  const ev=S.chron.filter(e=>ics.includes(e.ic)||keys.some(k=>e.t.includes(k))).map(e=>e.yr+' '+e.ic+' '+e.t);
  const cnt={}; for (const B of Object.values(S.B)) if (EXTRACT[B.type]) cnt[B.type]=(cnt[B.type]||0)+1;
  return {ev, trades:S.trade?S.trade.n:0, cnt, pots:towns().map(T=>T.name+':'+Object.entries(T.pot).map(([k,v])=>k[0]+v.toFixed(2)).join(' '))};
});
console.log('seed', seed, 'trades', r.trades, JSON.stringify(r.cnt)); console.log(r.pots.join('\n')); console.log(r.ev.join('\n'));
await p.close();
}
await b.close();
