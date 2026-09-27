// Prints a sample of prayers, answers and give-ups at a few points in history. Run from test/: `node praysample.mjs [n]`
import { launch, ROOT } from './env.mjs';
const n = +(process.argv[2] || 6);
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro'); await p.waitForTimeout(500);
for (const y of [150, 900, 1800, 3200]) {
  const out = await p.evaluate(([y, n]) => {
    SF.ff(y - yr()); const L = living().filter(p => adult(p) && S.T[p.sid]), o = [];
    for (const k of ['rain', 'bloom', 'inspire', 'drop', 'starfall', 'ask']) {
      const seen = new Set();
      for (let i = 0; i < n; i++) { const q = pick(L); seen.add(prayText(k, q, {})); }
      o.push(`  ${k.toUpperCase()} (${seen.size} different of ${n})`, ...[...seen].map(t => '    · ' + t));
      o.push('    → ' + prayEnd(OUTCOME, k, pick(L), 'Be kind.'), '    ✗ ' + prayEnd(EXPIRE, k, pick(L)));
    }
    return `Year ${Math.round(yr())}\n` + o.join('\n');
  }, [y, n]);
  console.log(out);
}
console.log('ERR', errs.join(' | ') || 'none'); await b.close();
