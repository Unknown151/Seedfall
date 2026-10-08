// Real-world names (util.js placeName, people.js firstNm/lastNm): towns, people, the planet and moons sound like real
// places and people, none twice among the towns; and an older world named in the old made-up language is renamed once
// on load (persist.js renameWorld), families keeping a surname between them and the chronicle following.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
await p.goto(ROOT + 'seedfall.html?seed=777&fresh&nointro&headless'); await p.waitForTimeout(800);
const a = await p.evaluate(() => { SF.ff(2000); const ts = towns().map(T => T.name), ps = Object.values(S.P).map(p => p.name);
  const odd = s => /[øåæäöüéôì]|([^aeiou\s])\1\1/i.test(s);
  return { ts, n: new Set(ts).size, odd: ts.concat(ps, [S.planet], S.moons || []).filter(odd), real: ps.every(n => NM_FIRST.concat(NM_FIRST_NEW).includes(n.split(' ')[0]) && NM_LAST.includes(n.split(' ').slice(1).join(' '))), planet: S.planet, v: S.nameV }; });
ok(a.n === a.ts.length && !a.odd.length, `towns with real-sounding names, none twice: ${a.ts.join(', ')} (odd: ${a.odd.slice(0, 3).join(', ') || 'none'})`);
ok(a.real && NM_OK(a.planet), `people from real first names and surnames, and the planet is ${a.planet}`);
function NM_OK(s) { return typeof s === 'string' && s.length > 2; }
const m = await p.evaluate(() => { // an older world: made-up names, in the chronicle too
  const T = towns()[0], P = Object.values(S.P).filter(p => p.died === null).slice(0, 2); T.name = 'Byvhede'; P.forEach(q => { q.last = 'Lyanstøm'; q.first = 'Skeinve'; q.name = 'Skeinve Lyanstøm'; }); P[1].first = 'Dririk'; P[1].name = 'Dririk Lyanstøm';
  chron('✍️', 'Skeinve Lyanstøm of Byvhede writes a long letter. Byvhede’s harbour is mentioned twice.', { T }); S.planet = 'Standlø'; S.nameV = 0;
  const T3 = towns()[1]; T3.name = 'Mittensville'; chron('🪧', 'Hrolm paints over its signposts. The town is called Mittensville now.', { T: T3 }); delete T3._own;
  const sv = JSON.stringify(serialize()); deserialize(JSON.parse(sv)); startWorld(false);
  const T2 = S.T[T.id], P2 = P.map(q => S.P[q.id]), e = S.chron[S.chron.length - 2].t;
  return { mine: S.T[T3.id].name, town: T2.name, people: P2.map(q => q.name), last: P2.map(q => q.last), e, planet: S.planet, v: S.nameV, again: (() => { const sv2 = JSON.stringify(serialize()); deserialize(JSON.parse(sv2)); startWorld(false); return S.T[T.id].name; })() }; });
ok(m.town !== 'Byvhede' && m.planet !== 'Standlø' && m.v === 2, `an older world is renamed on load: Byvhede → ${m.town}, Standlø → ${m.planet}`);
ok(m.last[0] === m.last[1] && m.people.every(n => !/Lyanst/.test(n)), `a family keeps one surname between them: ${m.people.join(', ')}`);
ok(!/Byvhede|Skeinve|Lyanst/.test(m.e) && m.e.includes(m.town) && m.e.includes(m.people[0]), `and the chronicle follows: “${m.e}”`);
ok(m.mine === 'Mittensville', `a name the player gave through the voice is kept (${m.mine})`);
ok(m.again === m.town, 'once only: a reload keeps the new names');
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close(); process.exit(fails ? 1 : 0);
