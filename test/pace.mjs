import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const seeds = (process.argv[2]||'777,999,12345,4242,31337').split(',').map(Number);
const out = {};
for (const seed of seeds) {
  const p = await b.newPage({viewport:{width:800,height:600}});
  const errs=[]; p.on('pageerror', e=>errs.push(e.message+' '+(e.stack||'').split('\n').slice(0,3).join(' | ')));
  await p.goto(`${ROOT}seedfall.html?seed=${seed}&fresh&nointro`);
  await p.waitForTimeout(600);
  const rows=[];
  for (const y of [30,60,100,200,350,500,800,1200,1800,2500,3500]) {
    const r = await p.evaluate((y)=>{ const S=SF.state(); SF.ff(y-S.year); const e = typeof econSummary==='function'? econSummary():null;
      return {y:S.year|0, pop:Math.round(totalPop()), techs:Object.keys(S.tech.done).length, towns:towns().length, bld:Object.keys(S.B).length, e}; }, y);
    rows.push(r);
  }
  out[seed]=rows;
  console.log(seed, rows.map(r=>`${r.y}:${r.pop}/${r.techs}t/${r.towns}T`).join(' '), errs.length? 'ERR '+errs.slice(0,3).join(' // '):'');
  if (rows[0].e) for (const r of rows) console.log('   ', r.y, JSON.stringify(r.e));
  await p.close();
}
import fs from 'fs'; fs.writeFileSync(process.argv[3]||'pace.json', JSON.stringify(out));
await b.close();
