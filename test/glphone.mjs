// The 3D preview on a phone: opens in 3D with no flags, tap shows what's there, pinch zooms, the 2D/3D switch. Run from test/: `node glphone.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro'); await p.waitForTimeout(1000);
ok(await p.evaluate(() => GL3.on), 'opens in 3D without any flag');
await p.evaluate(() => { SF.ff(1100); SF.weather('clear', 9999); SF.hour(15); glFocusTown(); GL3.cam.auto = false; }); await p.waitForTimeout(2500);
await p.touchscreen.tap(195, 430); await p.waitForTimeout(500);
const tip = await p.evaluate(() => ({ o: +$('tip').style.opacity, t: $('tip').innerText.split('\n')[0] }));
ok(tip.o > 0 && tip.t, 'a tap shows what is there', tip.t);
await p.screenshot({ path: 'gl_phone_tap.png' });
// pinch: two touch pointers spreading apart
const z0 = await p.evaluate(() => GL3.cam.zoom);
await p.evaluate(() => { const c = GL3.c, ev = (t, id, x, y) => c.dispatchEvent(new PointerEvent(t, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, isPrimary: id === 1, bubbles: true }));
  ev('pointerdown', 1, 170, 420); ev('pointerdown', 2, 220, 440); for (let k = 1; k <= 10; k++) { ev('pointermove', 1, 170 - k * 8, 420 - k * 6); ev('pointermove', 2, 220 + k * 8, 440 + k * 6); } ev('pointerup', 1, 90, 360); ev('pointerup', 2, 300, 500); });
const z1 = await p.evaluate(() => GL3.cam.zoom);
ok(z1 < z0 * .7, 'pinching out zooms in', `${z0.toFixed(1)} → ${z1.toFixed(1)}`);
await p.waitForTimeout(800); await p.screenshot({ path: 'gl_phone_zoom.png' });
await p.click('#glBtn'); await p.waitForTimeout(800);
ok(await p.evaluate(() => !GL3.on && $('view').style.display !== 'none' && $('glBtn').textContent === 'Try it in 3D'), 'the switch goes to 2D');
await p.click('#glBtn'); await p.waitForTimeout(1500);
ok(await p.evaluate(() => GL3.on && $('glBtn').textContent === 'Switch to 2D'), 'and back to 3D');
await p.screenshot({ path: 'gl_phone.png' });
ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close(); console.log(fails ? `${fails} FAILED` : 'all ok'); process.exit(fails ? 1 : 0);
