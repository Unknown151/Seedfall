// Bigger lots: landmarks spreading onto 2×1 / 2×2 lots, harbours growing along the shore with a berth per tile,
// ships mooring at their berths, removal freeing the whole lot, and saves keeping it. Run from test/: `node lots.mjs`
import { launch, ROOT } from './env.mjs';
const SHOTS = !!process.env.SHOTS;
const b = await launch();
const p = await b.newPage({ viewport: { width: 1200, height: 760 } });
const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
let fails = 0;
const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
// seed 999 has open sea by its towns
await p.goto(ROOT + 'seedfall.html?seed=' + (process.env.SEED || 999) + '&fresh&nointro' + (SHOTS ? '' : '&2d')); await p.waitForTimeout(700);

const check = () => p.evaluate(() => {
  const big = Object.values(S.B).filter(B => fpBig(B)); let bad = 0, stray = 0;
  for (const B of big) for (const j of fpTiles(B)) if (M.bld[j] !== B.id) bad++;
  for (let i = 0; i < W * H; i++) { const B = M.bld[i] && S.B[M.bld[i]]; if (B && !fpTiles(B).includes(i)) stray++; }
  const hs = harbours(), moored = DYN.ships.filter(s => s.st === 'moor').map(s => { const B = S.B[s.at], q = shipPos(s); return B && q ? M.water[berthTile(B, s.bk)] === 1 && Math.hypot(q[0] - berthTile(B, s.bk) % W, q[1] - ((berthTile(B, s.bk) / W) | 0)) < .5 : false; });
  return { yr: yr() | 0, big: big.length, kinds: [...new Set(big.map(B => B.type + ' ' + fpW(B) + '×' + fpH(B)))].join(', '), bad, stray, harbours: hs.map(B => berths(B)).join(','), moored: moored.length, mooredOk: moored.every(x => x) };
});
await p.evaluate(() => SF.ff(1400));
let r = await check();
ok(r.bad === 0 && r.stray === 0, 'every tile of a big lot points at its building, and nothing else does', `${r.big} big lots: ${r.kinds}`);
await p.evaluate(() => SF.ff(1400));
r = await check();
ok(r.big >= 2 && /stadium|university|hall|museum|theatre/.test(r.kinds), 'landmarks spread onto bigger lots', r.kinds);
ok(r.bad === 0 && r.stray === 0, 'lots stay whole as the towns keep changing', `${r.bad} bad, ${r.stray} stray`);
ok(r.harbours === '' || r.harbours.split(',').some(n => +n >= 2), 'harbours grow along the shore', `berths: ${r.harbours || 'no harbour'}`);
// ships at their berths
await p.evaluate(() => { for (const B of harbours()) for (let k = 0; k < berths(B); k++) { if (DYN.slot[bkey(B, k)]) continue; const sh = spawnShip(B, null); if (sh) { sh.bk = k; DYN.slot[bkey(B, k)] = sh; } } });
r = await check();
ok(!r.harbours || (r.moored > 0 && r.mooredOk), 'ships moor on the water in front of their own berths', `${r.moored} moored`);
// a save keeps the lots; removing a big building frees its whole lot
r = await p.evaluate(() => {
  const o = JSON.parse(JSON.stringify(serialize())); const before = Object.values(S.B).filter(fpBig).length; deserialize(o); startWorld(false);
  const after = Object.values(S.B).filter(fpBig).length, B = Object.values(S.B).find(B => fpBig(B) && B.type !== 'harbor'), ts = B ? fpTiles(B) : [];
  if (B) removeBuilding(B);
  return { before, after, freed: ts.length && ts.every(j => !M.bld[j]), n: ts.length };
});
ok(r.after === r.before && r.before > 0, 'a saved world keeps its big lots', `${r.before} → ${r.after}`);
ok(r.freed, 'knocking down a big building frees its whole lot', `${r.n} tiles`);
if (SHOTS) { // pictures of the harbour and a landmark
  for (const [k, what] of [['harbor', 'lots_harbour'], ['stadium', 'lots_stadium'], ['university', 'lots_university'], ['hall', 'lots_hall']]) {
    const f = await p.evaluate(k => { const B = Object.values(S.B).filter(B => B.type === k && fpBig(B)).sort((a, b) => fpW(b) * fpH(b) - fpW(a) * fpH(a))[0]; if (!B) return 0; SF.weather('clear', 9999); SF.hour(15); const [x, z] = glLot(B); GL3.cam.auto = false; GL3.follow = null; GL3.cam.tx = x; GL3.cam.tz = z; GL3.cam.ty = surfZ(idx(B.x, B.y)) * ZS; GL3.cam.zoom = 2.2; GL3.cam.pitch = .5; GL3.cam.yaw = B.dir ? Math.atan2(B.dir[0], B.dir[1]) + .6 : .8; return 1; }, k);
    if (!f) { console.log('     (no big ' + k + ')'); continue; }
    await p.waitForTimeout(4000); await p.screenshot({ path: what + '.png' });
  }
}
ok(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
