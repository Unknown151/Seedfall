// The town bar (ui.js renderBar): the town you're looking at with its stores and their yearly gain, people, homes, food and
// needs, its name and title on the plaque; the arrows go from town to town; B hides it and a reload remembers; the plaque
// opens the Towns tab.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage({ viewport: { width: 1280, height: 760 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=777&fresh&nointro&headless'); await p.waitForTimeout(800);
await p.evaluate(() => { SF.ff(1500); renderBar(true); });
const a = await p.evaluate(() => ({ on: document.body.classList.contains('tbar'), name: document.querySelector('#tbPl b').textContent, title: document.querySelector('#tbPl small').textContent, res: document.querySelectorAll('#tbR1 span').length, r2: document.getElementById('tbR2').textContent, top: towns().sort((a, b) => b.pop - a.pop)[0].name }));
ok(a.on && a.name === a.top && /Capital/.test(a.title), `the bar shows the biggest town to begin with: ${a.name} (${a.title})`);
ok(a.res >= 5 && /👥/.test(a.r2) && /🏠/.test(a.r2) && /🍞/.test(a.r2) && /\/yr/.test(await p.textContent('#tbR1')), `its stores with their yearly gain (${a.res}), people, homes, food and needs: ${a.r2}`);
await p.evaluate(() => barStep(1)); const n2 = await p.textContent('#tbPl b');
ok(n2 !== a.name, `the arrow goes on to the next town (${n2})`);
await p.keyboard.press('b'); const off = await p.evaluate(() => document.body.classList.contains('tbar'));
await p.reload(); await p.waitForTimeout(800); const off2 = await p.evaluate(() => { SF.ff(5); renderBar(true); return document.body.classList.contains('tbar'); });
ok(!off && !off2, 'B hides it, and a reload remembers');
await p.keyboard.press('b'); await p.evaluate(() => renderBar(true)); await p.click('#tbPl'); const tab = await p.evaluate(() => UI.panel && UI.tab);
ok(tab === 'towns', 'the plaque opens the Towns tab');
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close(); process.exit(fails ? 1 : 0);
