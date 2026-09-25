// Catch-up after time away: capped at 8 hours of real time (and 250 years), a report card, and a historian's
// letter from Claude when the voice is on (mocked here). Run from test/: `node away.mjs`
import { launch, ROOT } from './env.mjs';
const b = await launch();
const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0;
const ok = (c, what, extra = '') => { console.log(`${c ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!c) fails++; };
const H = 3600e3;
const away = async (ms, pace = 'normal') => {
  const y0 = await p.evaluate(([ms, pace]) => { $('away').classList.remove('show'); S.settings.pace = pace; S.lastLive = Date.now() - ms; return yr(); }, [ms, pace]);
  await p.waitForTimeout(400);
  await p.waitForFunction(() => !CATCH, null, { timeout: 120000 });
  return { y0, y1: await p.evaluate(() => yr()), shown: await p.isVisible('#away.show'), when: await p.textContent('#awayWhen') };
};

await p.goto(ROOT + 'seedfall.html?seed=4242&fresh&nointro');
await p.waitForTimeout(800);
await p.evaluate(() => { SF.ff(300); SF.weather('clear', 9999); SF.hour(13); });
await p.waitForTimeout(500);
ok(!(await p.isVisible('#away.show')), 'a long fast-forward is not time away');

let r = await away(60e3);
ok(!r.shown && r.y1 - r.y0 < 1, 'a minute away: nothing happens', `${r.y0} → ${r.y1}`);

r = await away(10 * H);
ok(r.shown && Math.abs(r.y1 - r.y0 - 160) <= 1, 'ten hours away at normal pace: 8 hours = 160 years', `${r.y0} → ${r.y1}`);
ok(/^You were gone 10 h\. The world kept going for 8 h of it: Year \d+ → \d+ · /.test(r.when), 'the card says it was capped', r.when);
ok(await p.$$eval('#awayList li', l => l.length) >= 3 && !(await p.isVisible('#awayLetter')), 'highlights listed, no letter without a voice key');
ok(await p.evaluate(() => Date.now() - S.lastLive < 5000), 'the clock restarts after catching up');

r = await away(2 * H, 'brisk');
ok(r.y1 - r.y0 === 120, 'two hours at brisk pace: 120 years', `${r.y0} → ${r.y1}`);
r = await away(8 * H, 'brisk');
ok(r.y1 - r.y0 === 250, 'eight hours at brisk pace stops at 250 years', `${r.y0} → ${r.y1}`);

await p.evaluate(() => { delete S.lastLive; S.savedAt = Date.now() - 1 * 3600e3; S.settings.pace = 'normal'; $('away').classList.remove('show'); }); // a save from before this feature
await p.waitForTimeout(400); await p.waitForFunction(() => !CATCH, null, { timeout: 60000 });
ok(await p.isVisible('#away.show') && /gone 1 h\./.test(await p.textContent('#awayWhen')), 'older saves fall back to savedAt');

// with the voice on: the town historian writes a letter
let seen = null;
await p.route('https://api.anthropic.com/v1/messages', async route => {
  const body = JSON.parse(route.request().postData()); seen = body;
  const input = { title: 'Much Has Happened, Mostly Bridges', letter: 'Dear Watcher,\n\nYou were gone a while. We built three bridges and argued about all of them.\n\nYours, Tove of Jostken' };
  await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ id: 'msg', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'tool_use', id: 't', name: body.tools[0].name, input }], stop_reason: 'tool_use', usage: { input_tokens: 900, output_tokens: 120 } }) });
});
await p.evaluate(() => { AI.key = 'sk-ant-test'; AI.tone = 'cosy'; });
r = await away(3 * H);
await p.waitForFunction(() => !$('awayLetter').classList.contains('wait') && $('awayLetter').textContent, null, { timeout: 20000 });
const letter = await p.textContent('#awayLetter');
ok(seen && seen.tools[0].name === 'write_letter' && /THE WATCHER HAS BEEN AWAY for 3 h/.test(seen.messages[0].content) && /family-friendly/.test(seen.system), 'the letter request has the events and the tone');
ok(/^Much Has Happened, Mostly Bridges/.test(letter) && /Tove of Jostken/.test(letter), 'the letter shows on the card', letter.replace(/\n/g, ' / ').slice(0, 80));
ok(await p.evaluate(() => S.aiLog.at(-1).kind === 'digest' && S.aiLog.at(-1).ok), 'it is logged in the Voice tab');
await p.screenshot({ path: 'away_card.png' });

seen = null;
r = await away(10 * 60e3);
await p.waitForTimeout(500);
ok(r.shown && !seen, 'ten minutes away: a report card, but no letter (not worth a call)');

await p.click('#awayOk');
ok(!(await p.isVisible('#away.show')), 'Carry on closes it');
console.log('ERR', errs.join(' | ') || 'none');
await b.close();
process.exit(fails || errs.length ? 1 : 0);
