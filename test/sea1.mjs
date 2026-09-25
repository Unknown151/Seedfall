import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1400,height:900}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,4).join(' | ')));
const seed = process.argv[2]||'4242';
await p.goto(`${ROOT}seedfall.html?seed=${seed}&fresh&nointro&dev`);
await p.waitForTimeout(1000);
for (const y of (process.argv[3]||'700,1100,1900').split(',').map(Number)) {
  await p.evaluate((y)=>{ SF.hour(10); SF.ff(y-SF.state().year); }, y);
  await p.waitForTimeout(25000);
  const r = await p.evaluate(()=>{ const S=SF.state(); const cnt=t=>Object.values(S.B).filter(B=>B.type===t&&B.prog>=1).length;
    return { y:S.year|0, harbor:cnt('harbor'), light:cnt('lighthouse'), dock:cnt('dock'), air:cnt('airfield'), ferries:(S.ferries||[]).length,
      ships:DYN.ships.map(s=>s.kind+':'+s.st+(s.wait?'(w)':'')+':'+(s.path?s.s.toFixed(1)+'/'+s.path.length:'')).join(' '), boats:DYN.boats.map(b=>b.st).join(','), fer:DYN.ferries.map(o=>o.t.toFixed(2)).join(','), planes:DYN.planes.map(p=>p.kind+':'+p.st+':'+Math.round(p.z)).join(' '), trades:S.trade?S.trade.n:0,
      chron:S.chron.filter(e=>/⛵|⛴️|✈️|harbour|lighthouse|airfield/.test(e.ic+e.t)).slice(-6).map(e=>e.yr+' '+e.t.slice(0,90)) }; });
  console.log(JSON.stringify(r, null, 1));
}
console.log('ERR', errs.slice(0,5).join('\n')||'none');
await b.close();
