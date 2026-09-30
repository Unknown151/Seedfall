// Incidents: staged scenes at a real place (a house fire, sheep loose in the market). They come now and then on their
// own, run for a few months, end with an outcome and a chronicle line, are saved with the world, and draw in 3D.
// Run from test/: `node incidents.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch();
let fails = 0; const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
const errs = [];
const p = await b.newPage(); p.on('pageerror', e => errs.push(e.message));
await p.goto(ROOT + 'seedfall.html?seed=999&fresh&nointro&2d'); await p.waitForTimeout(500);

// 1) they happen on their own, now and then, and end
const r = await p.evaluate(() => { const seen = {}, ended = {}; EV.on('incident', d => (d.end ? ended : seen)[d.I.k] = ((d.end ? ended : seen)[d.I.k] || 0) + 1); SF.ff(800); return { seen, ended, live: (S.inc || []).length, lines: S.chron.filter(e => /Fire!|burning|caught fire|sheep|flock/i.test(e.t)).length }; });
ok((r.seen.fire || 0) >= 20 && (r.seen.sheep || 0) >= 10 && (r.seen.fire || 0) <= 90, 'fires and loose sheep come every few decades over 800 years', JSON.stringify(r));
ok((r.ended.fire || 0) >= (r.seen.fire || 0) - 1 && r.live <= 2, 'and each one ends', JSON.stringify(r.ended));
ok(Object.keys(r.seen).length >= 5 && (r.seen.wedding || 0) >= 10, 'weddings, floods, runaway carts and whales come along too', JSON.stringify(r.seen));

// 2) a fire: it starts at a house, lasts three months, and ends saved or burnt down, with a line in the chronicle either way
const f = await p.evaluate(() => { S.inc = []; const I = SF.incident('fire'), B = S.B[I.bid], n0 = S.chronN; SF.ff(.2); const mid = S.inc.filter(J => J.id === I.id).length; SF.ff(.2); return { at: B && B.type === 'house' && B.x === I.x, mid, after: S.inc.filter(J => J.id === I.id).length, standing: !!S.B[I.bid], lines: S.chron.slice(-(S.chronN - n0)).map(e => e.ic).join('') }; });
ok(f.at && f.mid === 1 && f.after === 0, 'a fire starts at a house and is over three months later', JSON.stringify(f));
ok(/🪣|🏚️/.test(f.lines), 'it ends saved or burnt down, and the chronicle says which', f.lines);

// 2b) a wedding marries its couple; a flood costs its town a little, never much
const w = await p.evaluate(() => { S.inc = []; const I = SF.incident('wedding'); if (!I) return null; SF.ff(.25); const a = S.P[I.a], b = S.P[I.b]; return { married: a.sp === b.id && b.sp === a.id }; });
ok(w && w.married, 'a wedding ends with the couple married', JSON.stringify(w));
const fl = await p.evaluate(() => { S.inc = []; const I = SF.incident('flood'); if (!I) return 'no river town'; const T = S.T[I.sid], p0 = T.pop; SF.ff(.3); return T.pop / p0; });
ok(fl === 'no river town' || (fl > .9 && fl < 1.1), 'a flood is a hard season, not a disaster', String(fl));

// 3) incidents are saved: one under way carries on after a reload
const s = await p.evaluate(() => { S.inc = []; const I = SF.incident('sheep'); const sv = JSON.stringify(serialize()); deserialize(JSON.parse(sv)); startWorld(false); return { k: S.inc[0] && S.inc[0].k, id: I.id, same: S.inc[0] && S.inc[0].id === I.id }; });
ok(s.k === 'sheep' && s.same, 'an incident under way is saved and picks up after a reload', JSON.stringify(s));
await p.close();

// 4) in 3D: the fire and the flock draw, with no WebGL errors
const q = await b.newPage({ viewport: { width: 900, height: 560 } }); q.on('pageerror', e => errs.push(e.message));
await q.goto(ROOT + 'seedfall.html?seed=999&fresh&nointro'); await q.waitForTimeout(700);
const g = await q.evaluate(() => { SF.ff(700); UI.paused = true; GL3.noNear = true; const out = {}, gl = GL3.gl;
  for (const k of Object.keys(INC)) { S.inc = []; const I = SF.incident(k); if (!I) { out[k] = 'none here'; continue; } I.t0 = S.month - I.n * .4;
    const v0 = (() => { const sv = S.inc; S.inc = []; const n = glPeople().length; S.inc = sv; return n; })(), v1 = glPeople().length; while (gl.getError()); glFrame(.05); out[k] = v1 - v0 > 1000 && gl.getError() === 0 ? 'ok' : 'extra ' + (v1 - v0); }
  return out; });
ok(Object.values(g).every(v => v === 'ok' || v === 'none here') && Object.values(g).filter(v => v === 'ok').length >= 5, 'every kind of incident draws in 3D, with no WebGL errors', JSON.stringify(g));
ok(!errs.length, 'no page errors', errs.slice(0, 3).join(' | '));
await b.close();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
