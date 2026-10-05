// The film camera and the weather in 3D: left alone, the camera moves between shots with captions; a touch hands it
// back and it waits; seasons and weather reach the shader. Run from test/: `node glfilm.mjs` (SHOTS=1 saves pictures)
import { launch, ROOT } from './env.mjs';
const SHOTS = !!process.env.SHOTS;
const b = await launch(); const p = await b.newPage({ viewport: { width: 1100, height: 700 } });
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
let fails = 0; const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=999&fresh&nointro'); await p.waitForTimeout(700);
await p.evaluate(() => { SF.ff(1400); SF.weather('clear', 9999); SF.hour(15); GL3.noNear = true; S.inc = []; }); // (an incident under way would take half the shots: incidents.mjs covers those)
await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 300000 });
// several shots in a row (time is stepped by hand so each shot is quick to reach)
const seen = [];
for (let k = 0; k < 5; k++) {
  const r = await p.evaluate(() => { if (GL3.shot) GL3.shot.t0 = -1e9; for (let i = 0; i < 40; i++) { GL3.t += .25; glDirector(.25); } const s = GL3.shot; return s ? { cap: s.cap, z: +GL3.cam.zoom.toFixed(1), at: s.at() && s.at().map(v => +v.toFixed(1)) } : null; });
  seen.push(r);
  if (SHOTS) { await p.waitForTimeout(3500); await p.screenshot({ path: `film_${k}.png`, timeout: 120000 }); }
}
console.log('     ' + seen.map(s => s ? s.cap.slice(0, 50) : 'none').join(' | '));
ok(seen.filter(Boolean).length >= 4, 'left alone, the film camera moves from shot to shot');
ok(new Set(seen.filter(Boolean).map(s => s.cap)).size >= 3, 'and the shots vary');
ok(seen.every(s => !s || s.at.every(v => isFinite(v))), 'every shot has somewhere real to look');
// a touch hands the camera back; the film waits
const t = await p.evaluate(() => { glTouch(); const a = [GL3.cam.tx, GL3.cam.tz]; for (let i = 0; i < 20; i++) { GL3.t += .25; glDirector(.25); } return { shot: !!GL3.shot, moved: Math.hypot(GL3.cam.tx - a[0], GL3.cam.tz - a[1]) }; });
ok(!t.shot && t.moved < .01, 'a touch hands the camera back and it stays put', JSON.stringify(t));
ok(await p.evaluate(() => { GL3.lastIn = performance.now() - 61000; glDirector(.25); return !!GL3.shot; }), 'a minute later the film carries on');
// weather and the season reach the shader
const u = await p.evaluate(() => { LIGHT.forceSeason = { autumn: 0, winter: 1, spring: 0 }; LIGHT.seasonT = 0; SF.weather('snow', 9999); Object.assign(S.wx, { snow: .8, sc: 1, cover: .88 }); lightTick(.1); glFrame(.1); const gl = GL3.gl, P = GL3.main.p; gl.useProgram(P); return { sea: [...gl.getUniform(P, GL3.main.u.uSea)], wx: [...gl.getUniform(P, GL3.main.u.uWx)] }; });
ok(u.sea[1] === 1 && u.sea[3] === 1 && u.wx[1] > .5, 'winter, snow on the ground and cloud reach the 3D view', JSON.stringify(u));
if (SHOTS) { await p.evaluate(() => { GL3.cam.auto = false; GL3.shot = null; glCap(null); glFocusTown(); GL3.cam.zoom = 3; GL3.cam.pitch = .12; }); await p.waitForTimeout(3500); await p.screenshot({ path: 'film_snow_sky.png', timeout: 120000 }); }
ok(await p.evaluate(() => { const gl = GL3.gl; while (gl.getError()); glFrame(.1); return gl.getError() === 0; }), 'WebGL draws without errors');
ok(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
