// The Watcher's levers: words (a mocked voice) that pull every lever at once, each taking effect, the Customs list showing
// them, a bogus value ignored, and a save keeping them. Headless.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const PULL = { season: 'winter', sky_colour: 'aurora', house_colours: 'rainbow', trees: 'blossom', street_decorations: 'paper_lanterns', bedtime: 'never', clothes: 'white', hats: 'tall_hats', pets: 'cats',
  street_life: 'bustling', birds: 'flocks', fireworks: 'often', work_pace: 'industrious', trade: 'open', seafaring: 'seafaring', faith: 'devout', smoke: 'clean', night_lights: 'colourful', nature: 'constructor' };
await p.route('https://api.anthropic.com/v1/messages', async route => {
  const body = JSON.parse(route.request().postData());
  const input = { doctrine_name: 'The Teaching of Everything', interpretation: 'They change everything at once.', chronicle: [{ years_from_now: 0, icon: '✨', text: 'Everything changes.' }, { years_from_now: 5, icon: '🎉', text: 'It sticks.' }], devotion: 3, ...PULL };
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'msg_1', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'tool_use', id: 'toolu_1', name: body.tools[0].name, input }], stop_reason: 'tool_use', usage: { input_tokens: 100, output_tokens: 100 } }) });
});
await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro&headless'); await p.waitForTimeout(600);
await p.evaluate(() => SF.ff(1300));
const schema = await p.evaluate(() => { const pr = TOOL_WORDS.input_schema.properties; return LEVERS.every(L => pr[L.f] && JSON.stringify(pr[L.f].enum) === JSON.stringify(Object.keys(L.o))); });
ok(schema, 'every lever is in the tool schema with its choices');
const before = await p.evaluate(() => ({ pace: paceK(), soot: sootK(), ships: shipCap(), rate: (faithRecalc(), FAITH.rate), crowd: 0 }));
await p.evaluate(async () => { AI.key = 'sk-ant-test'; await speak('Make everything different.'); });
const r = await p.evaluate(() => {
  const log = S.aiLog.at(-1), d = S.doctrines.at(-1), B = Object.values(S.B).find(B => B.type === 'house' && B.tier >= 2), st = S.styles[B.style] || STYLES0[0];
  faithRecalc();
  return { fx: log.fx || [], lvv: Object.assign({}, LVV), lv: d.lv || {}, cust: customsList().map(c => c[0]).join('|'), brief: customsBrief(),
    season: seasonFor(), pace: paceK(), soot: sootK(), ships: shipCap(), rate: FAITH.rate, painted: houseTint(st, B).painted, lit: litFrac(2.5, -20), shrine: CULT.bld.shrine || 0, lva: LVA, wall: houseTint(st, B).wall, base: st.wall };
});
for (const [f, v] of Object.entries(PULL)) if (f !== 'nature') ok(Object.values(r.lv).includes(v), `${f} → ${v} becomes a custom`);
ok(!('nature' in r.lv), 'a bogus choice is ignored');
ok(r.fx.filter(t => /: /.test(t)).length >= 18, `the Voice tab lists the effects (${r.fx.length})`);
ok(/Season/.test(r.cust) && /Sky/.test(r.cust) && /House colours/.test(r.cust) && /Pets/.test(r.cust) && /Smoke/.test(r.cust), 'the Customs list shows them');
ok(/sky_colour: aurora/.test(r.brief), 'the brief tells the voice what is in force');
ok(r.season.winter === 1 && !r.season.spring, 'an endless winter');
ok(r.pace > before.pace, `industrious builds faster (${before.pace} → ${r.pace})`);
ok(r.soot < before.soot || before.soot === 0, `clean air (${before.soot} → ${r.soot})`);
ok(r.ships > before.ships, `seafaring: more ships (${before.ships} → ${r.ships})`);
ok(r.rate > before.rate, `devout: Reverence gathers faster (${before.rate.toFixed(2)} → ${r.rate.toFixed(2)})`);
ok(r.shrine > 0, 'devout: shrines are favoured');
ok(r.painted && r.wall !== r.base, `houses are painted (${r.base} → ${r.wall})`);
ok(r.lit >= .8, 'nobody sleeps: windows lit at half past two');
ok(/blossom/.test(r.lva) && /rainbow/.test(r.lva), 'the art key changes, so the view rebuilds');
await p.evaluate(() => SF.ff(30));
const re = await p.evaluate(() => { const o = JSON.parse(JSON.stringify(serialize())); CULT = { tb: {}, bld: {}, ev: {}, lv: {}, shun: {}, rs: 0, bs: 0 }; LVV = {}; deserialize(o); return Object.assign({}, LVV); });
ok(re.seasons === 'winter' && re.sky === 'aurora' && re.pets === 'cats', 'a save keeps them');
ok(!errs.length, 'no page errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
console.log(fails ? `${fails} failed` : 'all ok'); await b.close(); process.exit(fails ? 1 : 0);
