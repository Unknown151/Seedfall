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
  tips.push(await p.evaluate(() => { UI.lastMove = performance.now(); GL3.pickReq = true; GL3.pickT = 0; glFrame(.016); /* (a frame now: in software each takes seconds) */ return { id: GL3.hover, tip: +$('tip').style.opacity ? $('tip').innerText.split('\n')[0] : '' }; }));
}
console.log('     ' + tips.map(t => `${t.id}: ${t.tip}`).join(' | '));
ok(tips.filter(t => t.id && t.tip).length >= 4, 'pointing at things shows what they are');
// point at the very top of the tallest building in view: it must be that building, not a tile behind it
const top = await p.evaluate(() => {
  let best = null; for (const B of Object.values(S.B)) { if (B.type !== 'house' || B.tier < 5 || B.prog < 1) continue; if ([[1, 1], [1, 0], [0, 1], [2, 2], [2, 1], [1, 2]].some(([dx, dy]) => { const C = inb(B.x + dx, B.y + dy) && S.B[M.bld[idx(B.x + dx, B.y + dy)]]; return C && (C.type !== 'house' || C.tier >= 4); })) continue; /* nothing tall between it and the camera */ if (!best || B.tier > best.tier || dist(B.x, B.y, GL3.cam.tx, GL3.cam.tz) < dist(best.x, best.y, GL3.cam.tx, GL3.cam.tz) && B.tier === best.tier) best = B; }
  if (!best) return null;
  GL3.goto = null; GL3.cam.persp = false; /* the isometric lens: the top is then straight up the screen, whatever stands nearby */ GL3.cam.pitch = .62; GL3.cam.yaw = Math.PI / 4; GL3.cam.auto = false; GL3.follow = null; GL3.cam.zoom = 5; GL3.cam.tx = best.x; GL3.cam.tz = best.y; GL3.cam.ty = surfZ(idx(best.x, best.y)) * ZS; return { i: idx(best.x, best.y), tier: best.tier };
});
if (top) {
  await p.waitForTimeout(2500);
  // the building's top is straight up the screen from the centre (orthographic camera looking at its base)
  let hit = 0;
  for (let dy = 15; dy <= 105; dy += 15) { await p.mouse.move(700, 425 - dy); await p.waitForTimeout(250); const id = await p.evaluate(() => GL3.hover); if (id === top.i + 1) hit++; else if (process.env.PKDBG) console.log("miss", dy, id, "want", top.i + 1, top.tier); }
  await p.screenshot({ path: 'gl_pick_tall.png' });
  ok(hit >= 3, 'pointing high up a tall building still picks that building', `${hit} of 7 points up its side`);
  await p.evaluate(() => { GL3.cam.persp = true; });
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
const glErr = await p.evaluate(() => { const gl = GL3.gl; while (gl.getError()); glFrame(.016); glFrame(.016); const e = []; let x; while ((x = gl.getError())) e.push(x); return e; });
const nf = await p.evaluate(() => { GL3.noNear = false; GL3.nearMs = 5000; GL3.cam.auto = false; GL3.cam.zoom = 3; let n = 0, k; // (a big budget: the detailed version builds in one frame)
  while ((k = Object.keys(GL3.chunks).map(Number).find(k => GL3.chunks[k].near)) == null && n++ < 8) glFrame(.016); if (k == null) return { none: true }; const ch = GL3.chunks[k];
  GL3.dirty.add(k); glFrame(.016); const kept = ch.near && !!ch.nb, stale = !!ch.stale; n = 0; while (ch.stale && n++ < 8) glFrame(.016); GL3.nearMs = 0; return { kept, stale, fresh: !ch.stale && ch.near, frames: n }; });
ok(!nf.none && nf.kept && nf.stale && nf.fresh, 'a busy street keeps its close-up detail while it is rebuilt (no flicker)', JSON.stringify(nf));
ok(!glErr.length, 'WebGL draws without errors (a silently skipped bloom pass leaves old glows on screen)', glErr.join(','));
ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close(); console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
