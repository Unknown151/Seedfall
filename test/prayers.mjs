// Prayer words: plenty of them, all well-formed, fitting the era, and rarely repeated. Run from test/: `node prayers.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0;
const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro'); await p.waitForTimeout(500);
for (const y of [120, 1000, 3000]) {
  const r = await p.evaluate(y => {
    SF.ff(y - yr()); const L = living().filter(p => adult(p) && S.T[p.sid]), bad = [], all = [], per = {};
    for (const k of ['rain', 'bloom', 'inspire', 'drop', 'starfall', 'ask']) {
      const seen = new Set();
      for (let i = 0; i < 60; i++) { const q = pick(L), t = prayText(k, q, {}); all.push(t); seen.add(t); if (/undefined|null|NaN|\[object|\$\{/.test(t) || t.length > 230 || /(^|[.!?]\s)[a-z]/.test(t)) bad.push(t); }
      per[k] = seen.size;
      for (const tbl of [OUTCOME, EXPIRE]) { const t = prayEnd(tbl, k, pick(L), 'Be kind.'); if (!t || /undefined|null|NaN/.test(t)) bad.push(k + ': ' + t); }
    }
    const q = { child: L[0].id, tid: L[0].sid }; for (const k of ['name', 'town']) for (let i = 0; i < 10; i++) { const t = prayText(k, L[0], q); if (!t || /undefined|NaN/.test(t)) bad.push(t); }
    return { yr: Math.round(yr()), bad, per, band: prayCtx(L[0]).band, era: all.filter(t => /radio|seedship|domes|irrigation pumps|city lights|launch pad/.test(t)).length };
  }, y);
  ok(!r.bad.length, `Year ${r.yr}: every prayer, answer and give-up reads cleanly`, r.bad.slice(0, 2).join(' / '));
  ok(Object.values(r.per).every(n => n >= 40), `Year ${r.yr}: 60 prayers of each kind give 40+ different ones`, JSON.stringify(r.per));
  if (r.yr > 2500) ok(r.era > 0, 'late prayers talk about the late world (radio, seedships, domes...)', `${r.era}`);
  else if (r.yr < 200) ok(r.era === 0, 'early prayers don’t mention radios or seedships');
}
ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close(); console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
