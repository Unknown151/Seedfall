// Bigger lots: landmarks spreading onto 2×1 lots, the big ones (a 4×4 stadium, 3×3 university and fusion plant) laid out on
// cleared ground at the edge of town with no street through them (an older, smaller one grows or moves out), harbours growing along the shore with a berth per tile,
// ships mooring at their berths, removal freeing the whole lot, and saves keeping it. Run from test/: `node lots.mjs`
import { launch, ROOT } from './env.mjs';
const SHOTS = !!process.env.SHOTS;
const b = await launch();
const p = await b.newPage({ viewport: { width: 1200, height: 760 } });
const errs = []; p.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' | ')));
let fails = 0;
const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
// seed 999 has open sea by its towns
await p.goto(ROOT + 'seedfall.html?seed=' + (process.env.SEED || 999) + '&fresh&nointro' + (SHOTS ? '' : '&headless')); await p.waitForTimeout(700);

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
const p2 = await b.newPage(); p2.on('pageerror', e => errs.push(e.message)); await p2.goto(ROOT + 'seedfall.html?seed=' + (process.env.SEED || 999) + '&fresh&nointro&headless'); await p2.waitForTimeout(500); await p2.evaluate(() => SF.ff(1400)); // (a page of its own, so the main world grows on undisturbed)
const mv = await p2.evaluate(() => { // an older world's stadium on one tile in the middle of town, hemmed in by tall blocks: it moves out to a 4×4 lot at the edge
  const T = towns().sort((a, b) => b.pop - a.pop)[0], H0 = T.bl.map(id => S.B[id]).filter(B => B && B.type === 'house' && B.prog >= 1 && !fpBig(B)).sort((a, b) => dist(a.x, a.y, T.x, T.y) - dist(b.x, b.y, T.x, T.y))[0];
  const ax = H0.x, ay = H0.y; removeBuilding(H0); const B = mkBuilding('stadium', ax, ay, T, { prog: 1 }); B.built = yr() - 100;
  for (const [dx, dy] of N8) { const x = ax + dx, y = ay + dy, j = idx(x, y), o = M.bld[j] && S.B[M.bld[j]]; if (o && !fpBig(o)) { removeBuilding(o); mkBuilding('house', x, y, T, { prog: 1, tier: 6 }); } }
  fpSettle(B);
  return { w: fpW(B), h: fpH(B), moved: B.x !== ax || B.y !== ay, park: !!(M.bld[idx(ax, ay)] && S.B[M.bld[idx(ax, ay)]].type === 'park'), out: +(dist(B.x + 1.5, B.y + 1.5, T.x, T.y) / townRadius(T)).toFixed(2) };
});
ok(mv && mv.w === 4 && mv.h === 4 && mv.moved && mv.park, 'an older, smaller stadium hemmed in at the middle of town moves out to a 4×4 lot at the edge, and its old ground becomes a park', JSON.stringify(mv));
await p2.close();
await p.evaluate(() => SF.ff(1400));
r = await check();
ok(r.big >= 2 && /stadium|university|hall|museum|theatre/.test(r.kinds), 'landmarks spread onto bigger lots', r.kinds);
ok(r.bad === 0 && r.stray === 0, 'lots stay whole as the towns keep changing', `${r.bad} bad, ${r.stray} stray`);
const g = await p.evaluate(() => { // the big ones: full size, no street through them, a road beside them
  const L = Object.values(S.B).filter(B => BIG_LOT(B.type) && B.prog >= 1), full = L.filter(B => fpW(B) === FP_BIG[B.type][0] && fpH(B) === FP_BIG[B.type][1]);
  const clean = full.every(B => fpTiles(B).every(j => !M.road[j])), beside = full.every(B => { for (let y = B.y - 1; y <= B.y + fpH(B); y++) for (let x = B.x - 1; x <= B.x + fpW(B); x++) if (inb(x, y) && (x < B.x || y < B.y || x >= B.x + fpW(B) || y >= B.y + fpH(B)) && M.road[idx(x, y)]) return true; return false; });
  return { n: L.length, full: full.length, kinds: full.map(B => B.type + ' ' + fpW(B) + '×' + fpH(B)).join(', '), clean, beside, stadium: full.some(B => B.type === 'stadium') };
});
ok(g.n > 0 && g.full >= Math.ceil(g.n * .75) && g.stadium, 'the big landmarks stand on their whole lots (a 4×4 stadium, 3×3 university and fusion plant)', `${g.full}/${g.n}: ${g.kinds}`);
ok(g.clean && g.beside, 'no street runs through a big lot, and a road runs beside each');
const one = await p.evaluate(() => { // one stadium for the valley, in the town it chose; an older world's extras close into parks
  const st = Object.values(S.B).filter(B => B.type === 'stadium'), H = stadiumHost(), n0 = st.length, at0 = st.every(B => B.sid === (H && H.id));
  for (const T of towns().filter(T => T !== H).slice(0, 2)) { const O = T.bl.map(id => S.B[id]).find(B => B && B.type === 'house' && B.prog >= 1 && !fpBig(B)); if (O) { const x = O.x, y = O.y; removeBuilding(O); mkBuilding('stadium', x, y, T, { prog: 1 }); } }
  const n1 = anycount('stadium'); for (let k = 0; k < 60 && anycount('stadium') > 1; k++) yearlyRetire();
  const left = Object.values(S.B).filter(B => B.type === 'stadium');
  const H2 = stadiumHost(); return { n0, at0, host: H2 && H2.name, n1, n2: left.length, kept: left.every(B => B.sid === (H2 && H2.id)) && (!n0 || H2 === H) };
});
ok(one.n0 <= 1 && one.at0 && one.n1 > one.n0 && one.n2 === Math.max(1, one.n0) && one.kept, 'the valley has one stadium, in the town it chose, and an older world\'s extras close', JSON.stringify(one));
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
  for (const [k, what] of [['harbor', 'lots_harbour'], ['stadium', 'lots_stadium'], ['station', 'lots_station'], ['market', 'lots_market'], ['hall', 'lots_hall']]) {
    const f = await p.evaluate(k => { const B = Object.values(S.B).filter(B => B.type === k && fpBig(B)).sort((a, b) => fpW(b) * fpH(b) - fpW(a) * fpH(a))[0]; if (!B) return 0; SF.weather('clear', 9999); SF.hour(15); const [x, z] = glLot(B); GL3.cam.auto = false; GL3.follow = null; GL3.cam.tx = x; GL3.cam.tz = z; GL3.cam.ty = surfZ(idx(B.x, B.y)) * ZS; GL3.cam.zoom = 2.2; GL3.cam.pitch = .85; GL3.cam.yaw = B.dir ? Math.atan2(B.dir[0], B.dir[1]) + .6 : .8; return 1; }, k);
    if (!f) { console.log('     (no big ' + k + ')'); continue; }
    await p.waitForFunction(() => GL3.dirty.size === 0, null, { timeout: 240000 }); await p.waitForTimeout(1500); await p.screenshot({ path: what + '.png' });
  }
}
ok(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
