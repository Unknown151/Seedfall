// The 3D preview (?gl): pointing and clicking. Run from test/: `node glpick.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage({ viewport: { width: 1400, height: 850 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro&gl'); await p.waitForTimeout(800);
await p.evaluate(() => { SF.ff(1600); SF.weather('clear', 9999); SF.hour(13); glFocusTown(); GL3.cam.auto = false; });
await p.waitForTimeout(3000);
const tips = [];
for (const [x, y] of [[700, 425], [620, 380], [800, 470], [560, 500], [900, 330]]) {
  await p.mouse.move(x, y); await p.waitForTimeout(400);
  tips.push(await p.evaluate(() => ({ id: GL3.hover, tip: +$('tip').style.opacity ? $('tip').innerText.split('\n')[0] : '' })));
}
console.log('     ' + tips.map(t => `${t.id}: ${t.tip}`).join(' | '));
ok(tips.filter(t => t.id && t.tip).length >= 4, 'pointing at things shows what they are');
// point at the very top of the tallest building in view: it must be that building, not a tile behind it
const top = await p.evaluate(() => {
  let best = null; for (const B of Object.values(S.B)) { if (B.type !== 'house' || B.tier < 5 || B.prog < 1) continue; if (!best || B.tier > best.tier || dist(B.x, B.y, GL3.cam.tx, GL3.cam.tz) < dist(best.x, best.y, GL3.cam.tx, GL3.cam.tz) && B.tier === best.tier) best = B; }
  if (!best) return null;
  GL3.goto = null; GL3.cam.zoom = 5; GL3.cam.tx = best.x; GL3.cam.tz = best.y; GL3.cam.ty = surfZ(idx(best.x, best.y)) * ZS; return { i: idx(best.x, best.y), tier: best.tier };
});
if (top) {
  await p.waitForTimeout(600);
  // the building's top is straight up the screen from the centre (orthographic camera looking at its base)
  let hit = 0;
  for (let dy = 15; dy <= 105; dy += 15) { await p.mouse.move(700, 425 - dy); await p.waitForTimeout(250); const id = await p.evaluate(() => GL3.hover); if (id === top.i + 1) hit++; }
  await p.screenshot({ path: 'gl_pick_tall.png' });
  ok(hit >= 3, 'pointing high up a tall building still picks that building', `${hit} of 7 points up its side`);
}
// click a person: their card opens and the camera follows them
const pid = await p.evaluate(async () => { const k = DYN.walkers.findIndex(w => w.pid && walkerPos(w)); const w = DYN.walkers[k]; GL3.hover = GPID + k; glClick(700, 425); return w ? w.pid : null; });
ok(pid && await p.evaluate(pid => UI.personSel === pid && !!GL3.follow, pid), 'clicking a person opens their card and follows them');
await p.evaluate(() => { GL3.follow = null; if (UI.panel) togglePanel(); });
// a nudge lands on the tile under the pointer
await p.mouse.move(700, 425); await p.waitForTimeout(400);
const r = await p.evaluate(() => { S.rev = 200; UI.tool = 'rain'; const id = GL3.hover; const before = S.rev; glClick(700, 425); return { id, spent: before - S.rev, tool: UI.tool }; });
ok(r.id > 0 && r.spent > 0 && !r.tool, 'a nudge lands where you click', JSON.stringify(r));
await p.mouse.move(640, 400); await p.waitForTimeout(700); await p.screenshot({ path: 'gl_pick.png' });
ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close(); console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
