import { launch, ROOT, HTTP } from './env.mjs';
const b = await launch();
const p = await b.newPage({viewport:{width:1400,height:900}});
const errs=[]; p.on('pageerror', e=>errs.push('PAGEERR '+e.message+' '+(e.stack||'').split('\n').slice(0,4).join(' | ')));
const seed = process.argv[2]||'4242', year=+(process.argv[3]||2000);
await p.goto(`${ROOT}seedfall.html?seed=${seed}&fresh&nointro&dev`);
await p.waitForTimeout(1000);
const info = await p.evaluate((y)=>{ SF.hour(13); SF.weather('clear', 9999); SF.state().settings.captions=false; SF.ff(y); DYN.caps.length=0; return airfields().map(B=>[B.x,B.y,S.T[B.sid].name]); }, year);
console.log('airfields', JSON.stringify(info));
// force a departure now from the first airfield
await p.evaluate(()=>{ const B=airfields()[0]; DYN.af[B.id]={ next: DYN.t, parked:1 }; });
for (let k=0;k<7;k++) {
  await p.waitForTimeout(k===0?1500:2600);
  const st = await p.evaluate(()=>{ const pl=DYN.planes.find(p=>p.from===airfields()[0].id)||DYN.planes[0]; if(!pl) return null; const [wx,wy]=gridToWorld(pl.x,pl.y,pl.z); CAM.tx=CAM.x=wx; CAM.ty=CAM.y=wy; CAM.tz=CAM.z=3.2; CAM.manualUntil=DYN.t+999; return pl.st+' z'+Math.round(pl.z)+' x'+pl.x.toFixed(2)+' y'+pl.y.toFixed(2)+' h'+pl.h.toFixed(2); });
  console.log(k, st);
  await p.waitForTimeout(250);
  await p.screenshot({path:`plane_${k}.png`, clip:{x:500,y:300,width:400,height:300}});
}
console.log('ERR', errs.slice(0,5).join('\n')||'none');
await b.close();
