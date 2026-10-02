// Map sizes: a new world can be a valley (64×64) or wide lands (128×128). The size is fixed when the page loads, so
// choosing the other size (or opening a world of the other size) reloads the page at that size and carries on.
// Needs `npm run serve` (localStorage and IndexedDB per origin). Run from test/: `node mapsize.mjs`
import { launch, HTTP } from './env.mjs';
const b = await launch(), ctx = await b.newContext({ viewport: { width: 1200, height: 760 } }), p = await ctx.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
const ready = () => p.waitForFunction(() => typeof S !== 'undefined' && S && RUNNING, null, { timeout: 120000 });
const now = () => p.evaluate(() => ({ W, size: S.size, seed: S.seed, towns: towns().length, url: location.search }));

// 1) the welcome card offers both sizes; wide lands reloads at 128 and starts the world there
await p.goto(HTTP + 'seedfall.html?headless'); await p.waitForSelector('#welcome.show');
ok(await p.locator('#wSize [data-size]').count() === 2, 'the welcome card offers two sizes');
await p.click('#wSize [data-size="128"]'); await p.fill('#wSeed', '4242');
await Promise.all([p.waitForURL(/size=128/, { timeout: 60000 }), p.click('#wLocal')]);
await ready(); let s = await now();
ok(s.W === 128 && s.size === 128 && s.seed === 4242, 'wide lands: a 128×128 world with the chosen seed', JSON.stringify(s));
await p.evaluate(() => { SF.ff(5); return SF.save(); }); await p.waitForTimeout(800);

// 2) a plain reload remembers the size
await p.goto(HTTP + 'seedfall.html?headless'); await ready(); s = await now();
ok(s.W === 128 && s.seed === 4242, 'opened again without ?size, it comes back at 128', JSON.stringify(s));

// 3) New world… asks for a size too; a valley reloads at 64
await p.evaluate(() => openWorlds()); await p.waitForSelector('#confirm.show');
ok(await p.isVisible('#cSize'), 'the new-world question shows the size choice');
await p.click('#cSize [data-size="64"]');
await Promise.all([p.waitForURL(/size=64/, { timeout: 60000 }), p.click('#cYes')]);
await ready(); s = await now();
ok(s.W === 64 && s.size === 64 && s.seed !== 4242, 'a valley: a new 64×64 world', JSON.stringify(s));
const seed64 = s.seed; await p.evaluate(() => { SF.ff(5); return SF.save(); }); await p.waitForTimeout(800);

// 4) opened at the wrong size (?size=128 with a 64 world saved), it reloads at the world's size
await p.goto(HTTP + 'seedfall.html?headless&size=128'); await p.waitForURL(/size=64/, { timeout: 60000 }); await ready(); s = await now();
ok(s.W === 64 && s.seed === seed64, 'a world opened at the wrong size reloads at its own', JSON.stringify(s));
ok(!(await p.evaluate(() => IDB.get('pending'))), 'nothing is left parked afterwards');

// 5) a scratch world at 128 runs through the ages, with towns spread over the bigger map
await p.goto(HTTP + 'seedfall.html?seed=999&fresh&nointro&headless&size=128'); await ready();
const r = await p.evaluate(() => { SF.ff(1800); const ts = towns(); let sp = 0; for (const a of ts) for (const c of ts) sp = Math.max(sp, Math.hypot(a.x - c.x, a.y - c.y)); return { W, towns: ts.length, spread: Math.round(sp), techs: Object.keys(S.tech.done).length, pop: Math.round(totalPop()) }; });
ok(r.W === 128 && r.towns >= 7 && r.spread >= 45 && r.techs >= 28 && r.techs <= 29, 'by 1800 the wide lands have more towns, further apart, and the same pace of discovery', JSON.stringify(r));
ok(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
