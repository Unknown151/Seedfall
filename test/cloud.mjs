// Cloud saves and the voice proxy, against the real Worker running locally (`wrangler dev`, fake user via DEV_USER)
// and a mock Anthropic API. Run from test/: `node cloud.mjs`. Starts and stops everything itself, with fresh KV.
import { launch, ROOT } from './env.mjs';
import { spawn, execFileSync } from 'child_process';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, '..');
const PORT = +(process.env.CLOUD_PORT || 8787), BASE = `http://127.0.0.1:${PORT}/`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seedfall-cloud-'));
let fails = 0;
const ok = (cond, what, extra = '') => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${what}${extra ? ' · ' + extra : ''}`); if (!cond) fails++; };

// ---- mock Anthropic: answers every tool call with something usable, records what the Worker sent
const seen = [];
const mock = http.createServer((req, res) => {
  let b = ''; req.on('data', c => b += c); req.on('end', () => {
    const body = JSON.parse(b); seen.push({ headers: req.headers, body });
    const tool = body.tools && body.tools[0] && body.tools[0].name;
    const input = tool === 'interpret_words' ? {
      doctrine_name: 'The Teaching of the Soft Paw', interpretation: 'Never hurry a mossback.',
      chronicle: [{ years_from_now: 0, icon: '🐾', text: 'The herders take down every fence overnight.', major: true }],
      trait_bias: { kindness: 2 }, favoured_buildings: ['park'], favoured_events: ['herd'], devotion: 3
    } : { entries: [] };
    const content = tool ? [{ type: 'tool_use', id: 'tu_1', name: tool, input }] : [{ type: 'text', text: 'ok' }];
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ id: 'msg_mock', type: 'message', role: 'assistant', model: body.model, content, stop_reason: tool ? 'tool_use' : 'end_turn', usage: { input_tokens: 10, output_tokens: 5 } }));
  });
});
await new Promise(r => mock.listen(0, '127.0.0.1', r));
const MOCK = `http://127.0.0.1:${mock.address().port}/v1/messages`;

// ---- the Worker
execFileSync('node', ['build.mjs', '--public'], { cwd: root, stdio: 'inherit' });
const wr = spawn(path.join(root, 'node_modules/.bin/wrangler'), ['dev', '--port', String(PORT), '--ip', '127.0.0.1', '--persist-to', tmp,
  '--var', 'DEV_USER:you@localhost', '--var', 'ANTHROPIC_API_KEY:test-key', '--var', 'ANTHROPIC_URL:' + MOCK],
  { cwd: root, detached: true, env: Object.assign({}, process.env, { WRANGLER_SEND_METRICS: 'false' }), stdio: ['ignore', 'pipe', 'pipe'] });
let wlog = ''; wr.stdout.on('data', d => wlog += d); wr.stderr.on('data', d => wlog += d);
const stop = () => { try { process.kill(-wr.pid); } catch (e) { } mock.close(); };
process.on('exit', stop);
for (let i = 0; ; i++) {
  try { const r = await fetch(BASE + 'api/me'); if (r.ok) break; } catch (e) { }
  if (i > 60) { console.log(wlog); throw new Error('wrangler dev did not start'); }
  await new Promise(r => setTimeout(r, 500));
}
const server = async () => { // what the cloud holds right now
  const r = await fetch(BASE + 'api/save');
  if (r.status === 204) return null;
  const meta = JSON.parse(r.headers.get('x-seedfall-meta'));
  const buf = Buffer.from(await r.arrayBuffer());
  return { meta, txt: (meta.gz ? zlib.gunzipSync(buf) : buf).toString('utf8') };
};

const b = await launch();
const errs = [];
const ctxs = [];
const newCtx = async () => { const c = await b.newContext({ viewport: { width: 1600, height: 900 } }); ctxs.push(c); return c; };
const watch = (p, name) => { p.on('pageerror', e => errs.push(`${name}: ${e.message}`)); return p; };
const ready = p => p.waitForFunction(() => typeof RUNNING !== 'undefined' && RUNNING && S && !S.flags.intro, null, { timeout: 60000 });
const open = async (ctx, name, q = '') => { const p = watch(await ctx.newPage(), name); await p.goto(BASE + q); await ready(p); return p; };
const st = p => p.evaluate(() => ({ seed: S.seed, yr: yr(), planet: S.planet, conflict: CLOUD.conflict, out: CLOUD.out, rev: CLOUD.rev, err: CLOUD.err, foot: $('ftext').textContent, banner: $('banner').classList.contains('show') ? $('banner').textContent : '' }));
const localSaved = p => p.evaluate(async () => { const s = parseSave(await IDB.get('save')); return s ? s.state.savedAt : 0; });

try {
  // 0) file:// stays exactly as before: no cloud, no /api calls
  {
    const c = await newCtx(), p = watch(await c.newPage(), 'file');
    const api = []; p.on('request', r => { if (r.url().includes('/api/')) api.push(r.url()); });
    await p.goto(ROOT + 'seedfall.html?seed=31337&fresh&nointro'); await ready(p);
    await p.evaluate(() => SF.ff(120));
    ok(await p.evaluate(() => !CLOUD.on) && !api.length, 'file:// has no cloud mode');
    fs.writeFileSync(path.join(tmp, 'save.json'), await p.evaluate(() => JSON.stringify(serialize()))); // the world to bring over
    await p.close();
  }

  // 1) first visit, empty cloud: the welcome card offers to load a save.json from disk, which then uploads
  {
    const c = await newCtx(), p = watch(await c.newPage(), 'welcome');
    await p.goto(BASE); await p.waitForSelector('#welcome.show');
    ok(await p.textContent('#wFolder') === 'Load a save.json…', 'welcome offers to load a save.json', await p.textContent('#wFine'));
    await p.screenshot({ path: path.join(here, 'cloud_welcome.png') });
    const [fc] = await Promise.all([p.waitForEvent('filechooser'), p.click('#wFolder')]);
    await fc.setFiles(path.join(tmp, 'save.json'));
    await ready(p);
    await p.waitForFunction(() => CLOUD.rev === 1, null, { timeout: 20000 });
    const s = await server(), me = await st(p);
    ok(me.seed === 31337 && s && s.meta.year === me.yr, 'loaded save.json uploads to the cloud', `year ${me.yr}, cloud ${s && s.meta.year}, rev ${s && s.meta.rev}`);
    ok(/^Saved to the cloud · just now/.test(me.foot), 'footer shows cloud status', me.foot);
    await c.close();
  }

  // 2) round trip, with a planet name headers can't carry as-is
  const cA = await newCtx(), cB = await newCtx();
  const A = await open(cA, 'A', '?seed=777&fresh&nointro');
  await A.evaluate(async () => { SF.ff(60); S.planet = 'Østerlund’s Rest ✨'; await saveAll(true); });
  let a = await st(A), s = await server();
  ok(s.meta.rev === 2 && s.meta.planet === a.planet && s.meta.year === a.yr && s.meta.gz === 1, 'save round trip: PUT gzipped with info', JSON.stringify(s.meta));
  const B = await open(cB, 'B');
  let bb = await st(B);
  ok(bb.seed === 777 && bb.yr === a.yr && bb.planet === a.planet, 'a second browser opens the same world', `year ${bb.yr}, ${bb.planet}`);
  ok(!/sk-ant|test-key/.test(s.txt) && !/"key"/.test(s.txt), 'no API key in the cloud save');

  // 3) two devices: B opened last, so A's next save is refused and A offers to take over
  const before = await localSaved(A);
  await A.evaluate(async () => { SF.ff(3); await saveAll(true); });
  a = await st(A);
  ok(a.conflict && /open on another device \(Year \d+, saved just now\)\. Take over here\?/.test(a.banner), 'conflict: 409 shows the take-over banner', a.banner);
  await A.evaluate(() => { SF.weather('clear', 9999); SF.hour(13); }); await A.waitForTimeout(1500);
  await A.screenshot({ path: path.join(here, 'cloud_conflict.png') });
  await A.evaluate(() => saveAll(true));
  ok(await localSaved(A) === before && (await server()).meta.rev === 2, 'conflict: A stops saving, locally and to the cloud');
  await B.evaluate(async () => { SF.ff(10); await saveAll(true); });
  bb = await st(B);
  await A.click('#banner');
  await A.waitForFunction(() => !CLOUD.conflict, null, { timeout: 20000 });
  a = await st(A);
  ok(a.yr === bb.yr && !a.banner && a.rev === 3, 'take over: A claims and reloads B’s newer save', `A year ${a.yr}, B year ${bb.yr}`);
  await B.evaluate(() => saveAll(true));
  ok((await st(B)).conflict, 'after the take-over, B is the one that gets the banner');

  // 4) played on locally after the last cloud save (same revision): reload just carries on and uploads
  await A.evaluate(async () => { SF.ff(8); CLOUD.lastTry = Date.now(); await saveAll(); }); // IndexedDB only
  const yLocal = (await st(A)).yr;
  ok((await server()).meta.year < yLocal, 'local save is ahead of the cloud');
  await A.goto(BASE); await ready(A);
  await A.waitForFunction(() => CLOUD.rev === 4, null, { timeout: 20000 });
  ok((await st(A)).yr === yLocal && (await server()).meta.year === yLocal && !(await A.isVisible('#confirm.show')), 'newer local save of the same revision loads and uploads without asking');

  // 5) diverged: the cloud moved on elsewhere, but this browser has a newer save -> offer to upload it
  await B.click('#banner'); await B.waitForFunction(() => !CLOUD.conflict, null, { timeout: 20000 });
  await B.evaluate(async () => { SF.ff(2); await saveAll(true); });
  await A.evaluate(async () => { SF.ff(20); CLOUD.lastTry = Date.now(); await saveAll(); });
  const yA = (await st(A)).yr;
  await A.goto(BASE); await A.waitForSelector('#confirm.show', { timeout: 20000 });
  ok(await A.textContent('#cTitle') === 'This browser has a newer save', 'diverged: offers to upload', await A.textContent('#cText'));
  await A.click('#cYes'); await ready(A);
  await A.waitForFunction(y => CLOUD.rev === 6, yA, { timeout: 20000 });
  ok((await st(A)).yr === yA && (await server()).meta.year === yA, 'diverged: “Upload this one” uploads the local world');

  // 6) signed out: Access redirects /api to its login page (opaque with redirect: 'manual'); progress stays local
  await A.route('**/api/save', r => r.fulfill({ status: 302, headers: { location: 'https://seedfall-rsvn.cloudflareaccess.com/cdn-cgi/access/login/seedfall.rsvn.dk' } }));
  const t0 = await localSaved(A);
  await A.evaluate(async () => { SF.ff(2); await saveAll(true); });
  a = await st(A);
  ok(a.out && /^Signed out\. Your progress is kept in this browser/.test(a.banner) && /^Signed out/.test(a.foot), 'signed out (redirect): banner and footer', a.banner);
  await A.evaluate(async () => { SF.ff(1); await saveAll(); });
  ok(await localSaved(A) > t0 && (await server()).meta.rev === 6, 'signed out: still saves in the browser, not the cloud');
  const ySigned = (await st(A)).yr;
  await A.unroute('**/api/save');
  const C = watch(await cA.newPage(), 'C'); // a 401 at startup: carries on from this browser's save
  await C.route('**/api/me', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"not signed in"}' }));
  await C.goto(BASE); await ready(C);
  const cc = await st(C);
  ok(cc.out && cc.yr === ySigned && /^Signed out/.test(cc.banner), 'signed out (401) at startup: loads the local save', `year ${cc.yr}`);
  await C.close();
  // logging in again (a reload): same revision underneath, so the local progress just uploads
  await A.goto(BASE); await ready(A);
  await A.waitForFunction(() => CLOUD.rev === 7, null, { timeout: 20000 });
  ok((await server()).meta.year === ySigned && !(await st(A)).out, 'after logging in again, the local progress uploads');

  // 7) voice through the Worker: no key in the browser, the server adds it
  const reqs = []; A.on('request', r => reqs.push({ url: r.url(), headers: r.headers() }));
  await A.keyboard.press('c'); await A.click('#bVoice');
  ok(await A.isHidden('#aiKeyRow') && await A.isHidden('#aiForget') && /server keeps it/.test(await A.textContent('#aiFine')), 'voice setup: no key field in cloud mode');
  await A.screenshot({ path: path.join(here, 'cloud_voice.png') });
  await A.click('#aiClose');
  await A.evaluate(async () => { S.cool.speak = 0; S.rev = 999; await speak('Be kind to the mossbacks.'); });
  const vr = reqs.filter(r => r.url.endsWith('/api/voice'));
  ok(await A.evaluate(() => S.doctrines.at(-1).ai && S.doctrines.at(-1).name === 'The Teaching of the Soft Paw'), 'voice: the answer came back through /api/voice');
  ok(vr.length === 1 && !vr[0].headers['x-api-key'] && !vr[0].headers['anthropic-dangerous-direct-browser-access'] && !reqs.some(r => r.url.includes('anthropic.com')), 'voice: browser sends no key and never calls api.anthropic.com');
  ok(seen.length === 1 && seen[0].headers['x-api-key'] === 'test-key' && seen[0].headers['anthropic-version'] && seen[0].body.model === 'claude-haiku-4-5-20251001', 'voice: the Worker adds the key and version');
  await A.evaluate(async () => { AI.model = 'claude-bogus'; await aiTest(); AI.model = 'claude-haiku-4-5-20251001'; });
  ok(/model not allowed/.test(await A.evaluate(() => AI.status)) && seen.length === 1, 'voice: models outside the allowlist are refused by the Worker');
  // Tone setting: cosy by default, cheeky when picked in Voice settings (kept per browser, not in the world)
  ok(/family-friendly/.test(seen[0].body.system) && !/cheeky is welcome/.test(seen[0].body.system), 'tone: cosy by default');
  await A.click('#bVoice'); await A.selectOption('#aiTone', 'cheeky'); await A.click('#aiSave'); await A.click('#aiClose');
  await A.evaluate(async () => { S.rev = 999; await speak('Nudism is the way forward.'); });
  ok(seen.length === 2 && /cheeky is welcome/.test(seen[1].body.system) && /never write explicit sexual content/.test(seen[1].body.system), 'tone: cheeky reaches the prompt, with its limits');
  ok(await A.evaluate(async () => (await IDB.get('ai')).tone === 'cheeky' && !JSON.stringify(serialize()).includes('cheeky is welcome')), 'tone: stored in the browser, not the world');
  await A.route('**/api/voice', r => r.fulfill({ status: 401, contentType: 'application/json', body: '{"error":"not signed in"}' }));
  await A.evaluate(() => aiTest());
  ok(/signed out/.test(await A.evaluate(() => AI.status)) && (await st(A)).out, 'voice: signed out is reported, not blamed on the key');
  await A.unroute('**/api/voice');
  await A.goto(BASE); await ready(A);

  // 8) the footer button loads a save.json into a running world (after asking)
  await A.keyboard.press('c');
  await A.waitForFunction(() => CLOUD.rev === 8 && !CLOUD.busy, null, { timeout: 20000 }); // the upload after the reload
  const rev0 = 8;
  const [fc] = await Promise.all([A.waitForEvent('filechooser'), A.click('#bFolder')]);
  await fc.setFiles(path.join(tmp, 'save.json'));
  await A.waitForSelector('#confirm.show');
  ok(await A.textContent('#cTitle') === 'Load this world?', 'footer load asks first');
  await A.click('#cYes');
  await A.waitForFunction(r => S.seed === 31337 && CLOUD.rev === r + 1, rev0, { timeout: 20000 });
  { const m = (await server()).meta, me = await st(A); ok(m.year === me.yr && me.seed === 31337, 'footer load replaces the cloud world', JSON.stringify(m) + ' page ' + me.yr); }
  s = await server();
  ok(!/sk-ant|test-key/.test(s.txt), 'still no key in the cloud save');
  await A.keyboard.press('Escape');
  await A.evaluate(() => { SF.weather('clear', 9999); SF.hour(13); });
  await A.keyboard.press('c'); await A.waitForTimeout(1500);
  await A.screenshot({ path: path.join(here, 'cloud_panel.png') });
} catch (e) { fails++; console.log('FAIL exception', e.stack || e); }

ok(!errs.length, 'no page errors', errs.join(' | '));
await b.close();
stop();
console.log(fails ? `${fails} FAILED` : 'all ok');
process.exit(fails ? 1 : 0);
