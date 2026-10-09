// Grace & Dread (god.js): a world chosen in this mode (S.mode 'god') gets the dark twins of the nudges, miracles and a
// Chosen One, and its people come to love or fear the Watcher (S.awe) and show it. Calm worlds, and worlds from before the
// modes, never see any of it. Nobody dies of anything the Watcher does.
import { launch, ROOT } from './env.mjs';
const b = await launch(); const p = await b.newPage();
const errs = []; p.on('pageerror', e => errs.push(e.message));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };

// a calm world: none of it
await p.goto(ROOT + 'seedfall.html?seed=777&fresh&nointro&headless'); await p.waitForTimeout(800);
const calm = await p.evaluate(() => { SF.ff(300); S.rev = 999; const T = towns()[0];
  return { mode: S.mode, god: GOD(), storm: useTool('storm', T.x, T.y), mir: useTool('raise', T.x + 6, T.y), cls: document.body.classList.contains('god'), hand: getComputedStyle($('dockHand')).display, awe: S.awe,
    old: (() => { const sv = JSON.parse(JSON.stringify(serialize())); delete sv.state.mode; delete sv.state.awe; deserialize(sv); startWorld(false); return S.mode; })() }; });
ok(calm.mode === 'calm' && !calm.god && !calm.storm && !calm.mir && !calm.cls && calm.hand === 'none' && !calm.awe, `a calm world has no dark hand, no miracles and no Grace or Dread (${JSON.stringify(calm)})`);
ok(calm.old === 'calm', `a world from before the modes stays calm (${calm.old})`);

// the New world question offers the mode, and a new world takes it
const nw = await p.evaluate(async () => { openWorlds(); const row = $('cMode'), btns = [...row.querySelectorAll('[data-mode]')].map(x => x.dataset.mode); row.querySelector('[data-mode="god"]').click(); const pick = UI.newMode; $('confirm').classList.remove('show');
  await newWorld(4242, false, 0, UI.newMode); return { btns, pick, mode: S.mode }; });
ok(nw.btns.join() === 'calm,god' && nw.pick === 'god' && nw.mode === 'god', `New world offers Calm or Grace & Dread, and the new world takes it (${JSON.stringify(nw)})`);

// a Grace & Dread world
await p.goto(ROOT + 'seedfall.html?seed=999&fresh&nointro&headless&god'); await p.waitForTimeout(800); // (a valley with riverside towns, for the flood)
const ui = await p.evaluate(() => { SF.ff(900); renderTools(); const tools = () => [...document.querySelectorAll('#dock .tool[data-tool]')].map(x => x.dataset.tool).join();
  const a = tools(); toggleHand(); const w = tools(); toggleHand(); const c = tools(); toggleHand();
  onKey({ key: '1', target: document.body, preventDefault() { } }); const sel = UI.tool; selectTool(UI.tool); toggleHand();
  return { cls: document.body.classList.contains('god'), hand: getComputedStyle($('dockHand')).display, a, w, c, sel, mir: $('mirbar').querySelectorAll('[data-tool]').length, awe: getComputedStyle($('hudAwe')).display }; });
ok(ui.cls && ui.hand !== 'none' && ui.awe !== 'none', 'the dock shows the hand and the miracles, and the HUD shows how they see you');
ok(ui.w === 'storm,tribute,eclipse,meteor,blight,speak' && ui.a === ui.c && ui.a.startsWith('rain') && ui.sel === 'storm', `Q turns the hand wrathful and back, and 1 picks the storm then (${ui.w}; ${ui.sel})`);
ok(ui.mir === 6, `the miracles bar has six (${ui.mir})`);

// the dark twins: each works, moves Grace and Dread towards dread, and nobody dies of it
const dk = await p.evaluate(async () => { const o = {}; const T = towns().sort((a, b) => b.pop - a.pop)[0];
  const act = (k, x, y) => { S.rev = 999; const L = new Set(living().map(q => q.id)), a0 = S.awe, r = useTool(k, x, y); const died = [...L].filter(id => S.P[id].died !== null).length; return { r, d: S.awe - a0, died }; };
  const h = Object.values(S.B).find(B => B.type === 'house' && B.sid === T.id && B.tier >= 2 && B.prog >= 1);
  o.storm = act('storm', h.x, h.y); o.fire = (S.inc || []).some(I => I.k === 'fire' && I.bid === h.id);
  const f = Object.values(S.B).filter(B => B.type === 'farm' && B.sid === T.id && B.prog >= 1 && !(B.blight > S.year)).sort((a, b) => dist(b.x, b.y, h.x, h.y) - dist(a.x, a.y, h.x, h.y))[0]; recalcTown(T); const food0 = T.cap.food; // (a field the storm's hail missed)
  o.blight = act('blight', f.x, f.y); recalcTown(T); o.food = [Math.round(food0), Math.round(T.cap.food)]; o.bl = f.blight > S.year;
  S.rev = 0; const a0 = S.awe; o.trib = { r: useTool('tribute', T.x, T.y), got: S.rev, d: S.awe - a0, died: 0 }; o.trib2 = useTool('tribute', T.x, T.y);
  const kids = living().length; o.ecl = act('eclipse', T.x, T.y); o.ecl.surge = S.surge > S.year; o.ecl.kid = living().some(q => q.q.tag === 'Born in the Dark Noon');
  const n0 = Object.keys(S.B).length; o.met = act('meteor', T.x + 2, T.y + 1); await new Promise(r => setTimeout(r, 50)); o.met.crater = (S.craters || []).length; o.met.gone = n0 - Object.keys(S.B).length;
  o.met.died = o.met.died; o.awe = S.awe; o.band = aweBand(); o.lv = LVV; return o; });
ok(dk.storm.r && dk.fire && dk.storm.d < 0, `a storm: lightning sets a house alight (the fire incident) (${JSON.stringify(dk.storm)})`);
ok(dk.blight.r && dk.bl && dk.food[1] < dk.food[0], `a blight: the fields wither and feed fewer (food ${dk.food[0]} → ${dk.food[1]})`);
ok(dk.trib.r && dk.trib.got > 20 && dk.trib.d < 0 && !dk.trib2, `tribute: a town's stores bring Reverence, and not again for a while (${JSON.stringify(dk.trib)})`);
ok(dk.ecl.r && dk.ecl.surge && dk.ecl.kid, `an eclipse: the Dark Noon, a child born in the dark, Reverence surging (${JSON.stringify(dk.ecl)})`);
ok(dk.met.r && dk.met.crater === 1 && dk.met.gone > 0, `a great meteor: a crater where buildings stood (${dk.met.gone} gone)`);
ok([dk.storm, dk.blight, dk.trib, dk.ecl, dk.met].every(a => a.died === 0), 'nobody dies of any of it');
ok(dk.awe < -15 && dk.band < 0 && dk.lv.clothes === 'dark' && dk.lv.faith === 'devout', `wrath makes them fear the Watcher, and it shows (awe ${dk.awe.toFixed(1)}, ${JSON.stringify(dk.lv)})`);

// kindness turns it round; the look follows; the voice is told
const kind = await p.evaluate(() => { const T = towns().sort((a, b) => b.pop - a.pop)[0]; for (let k = 0; k < 40 && S.awe < 45; k++) { S.rev = 999; useTool(['rain', 'drop', 'inspire', 'bloom'][k % 4], T.x + 1, T.y + 1); }
  const lines = S.chron.filter(c => /Watcher is (kind|loved)|wildflowers on the hill/.test(c.t)).length; return { awe: S.awe, band: aweBand(), lv: LVV, lines, brief: aweBrief(), pray: prayCtx(living()[0]).awe }; });
ok(kind.band >= 2 && kind.lv.housecol === 'pastel' && kind.lv.clothes === 'colourful' && kind.lines >= 1, `kindness makes them love the Watcher: pastel houses, bright clothes, a chronicle line (awe ${kind.awe.toFixed(1)})`);
ok(/loved/.test(kind.brief) && kind.pray === kind.band, 'the voice and the prayers know how the Watcher is seen');

// miracles
const mir = await p.evaluate(() => { const o = {}; const T = towns().sort((a, b) => b.pop - a.pop)[0], act = (k, x, y) => { S.rev = 999; return useTool(k, x, y); };
  let s = -1; for (let i = 0; i < W * H && s < 0; i++) { const x = i % W, y = (i / W) | 0; if (x > 3 && y > 3 && x < W - 4 && y < H - 4 && M.water[i] === 1 && isSea(i) && coastDist()[i] === 2 && !M.bld[i]) s = i; } const sx = s % W, sy = (s / W) | 0;
  o.raise = act('raise', sx, sy) && !M.water[s] && waterBodies().id[s] === 0 && coastDist()[s] === 0;
  const hs = harbours(); let cut = 0; for (const a of hs) for (const c of hs) if (a.id < c.id && sameWater(moorTile(a), moorTile(c))) { const r = seaRoute(moorTile(a), moorTile(c)); if (!r || r.some(i => M.water[i] !== 1)) cut++; } o.lanes = cut;
  let lx = -1, ly; for (let k = 0; k < 4000 && lx < 0; k++) { const x = 3 + ((Math.random() * (W - 6)) | 0), y = 3 + ((Math.random() * (H - 6)) | 0), i = idx(x, y); if (!M.water[i] && M.elev[i] <= 3 && !M.rail[i] && !M.bld[i]) { lx = x; ly = y; } }
  o.sink = act('sink', lx, ly) && M.water[idx(lx, ly)] === 1;
  o.quake = act('quake', T.x, T.y);
  const rt = towns().find(U => incFloodTiles(U.x, U.y).length >= 4); o.flood = rt ? act('flood', rt.x, rt.y) && (S.inc || []).some(I => I.k === 'flood') : 'no river town';
  const below = T.bl.some(id => S.B[id] && S.B[id].type === 'house' && S.B[id].prog >= 1 && S.B[id].tier >= 1 && S.B[id].tier < maxHouseTier());
  o.golden = act('golden', T.x, T.y) && T._gold > S.year && T.bl.some(id => S.B[id] && S.B[id].gift) && (!below || T.bl.some(id => S.B[id] && S.B[id].gl));
  let cx = -1, cy; for (let k = 0; k < 6000 && cx < 0; k++) { const x = 3 + ((Math.random() * (W - 6)) | 0), y = 3 + ((Math.random() * (H - 6)) | 0), i = idx(x, y); if (!M.water[i] && M.elev[i] <= 6 && M.bio[i] !== BIO.ROCK && !M.bld[i] && !towns().some(U => dist(x, y, U.x, U.y) < Math.max(8, townRadius(U) + 2.5))) { cx = x; cy = y; } }
  const n0 = towns().length; o.call = cx >= 0 ? act('call', cx, cy) && towns().length === n0 + 1 && towns().some(U => dist(U.x, U.y, cx, cy) <= 4) : 'no open country';
  return o; });
ok(mir.raise && mir.lanes === 0, `raising the land: new land out of the sea, the water and coast worked out again, the sea lanes still open (${JSON.stringify(mir)})`);
ok(mir.sink, 'sinking the land: a new lake');
ok(mir.quake && mir.golden, 'an earthquake, and a golden age (houses going up a tier, the Watcher’s statue)');
ok(mir.flood === true || mir.flood === 'no river town', `a flood at a riverside town (${mir.flood})`);
ok(mir.call === true || mir.call === 'no open country', `calling a people: a town founded where you point (${mir.call})`);

// the Chosen One: chosen, does deeds, dies of old age in time, and is remembered
const ch = await p.evaluate(() => { S.rev = 999; const c = living().filter(q => age(q) > 25 && age(q) < 45 && q.id !== S.founder)[0], life0 = c.life, okc = chooseOne(c.id);
  openPerson(c.id); const card = !!document.querySelector('.pback .chosen'); for (let k = 0; k < 6; k++) { S.year = S.month / 12; SF.ff(5); }
  const deeds = c.deeds.length, sv = JSON.parse(JSON.stringify(serialize())); c.life = age(c); SF.ff(3);
  const st = Object.values(S.B).some(B => B.type === 'monument' && (B.name || '').includes(c.name)), fest = (S.extraFestAt || []).some(f => f.n === `${c.first}’s Day`);
  return { okc, longer: c.life >= life0, card, deeds, gone: !S.chosen, st, fest, fav: (S.favNames || []).includes(c.first), saved: sv.state.chosen && sv.state.chosen.pid === c.id }; });
ok(ch.okc && ch.longer && ch.card, 'a person can be made the Watcher’s Chosen, and their card says so');
ok(ch.deeds >= 1, `the Chosen does things of their own (${ch.deeds} deeds in 30 years)`);
ok(ch.gone && ch.st && ch.fest && ch.fav, `when they die: a statue, a feast day, children named after them (${JSON.stringify(ch)})`);

// a save keeps it all
const sv = await p.evaluate(() => { const a = { mode: S.mode, awe: S.awe, cr: (S.craters || []).length, bl: Object.values(S.B).filter(B => B.blight).length }; const s = JSON.stringify(serialize()); deserialize(JSON.parse(s)); startWorld(false);
  return [a, { mode: S.mode, awe: S.awe, cr: (S.craters || []).length, bl: Object.values(S.B).filter(B => B.blight).length }]; });
ok(JSON.stringify(sv[0]) === JSON.stringify(sv[1]) && sv[0].mode === 'god', `a save keeps the mode, Grace and Dread, craters and blights (${JSON.stringify(sv[1])})`);
// a feared world's square and shrine build, far and near
const art = await p.evaluate(() => { const out = {}; for (const a of [-80, 80]) { S.awe = a; recomputeCulture(); for (const t of ['plaza', 'shrine']) { const B = Object.values(S.B).find(B => B.type === t && B.prog >= 1); if (!B) { out[t + a] = 'none'; continue; } const fr = fpFront(B), k = ((((fr / W) | 0) / GCH) | 0) * GNC + (((fr % W) / GCH) | 0);
  try { const f = glBuildChunk(k).v.length, n = glBuildChunk(k, true).v.length; out[t + a] = f > 0 && n >= f ? 'ok' : `far ${f} near ${n}`; } catch (e) { out[t + a] = e.message; } } } return out; });
ok(Object.values(art).every(v => v === 'ok' || v === 'none'), 'feared and loved squares and shrines build far and near ' + JSON.stringify(art));
ok(errs.length === 0, 'no page errors ' + errs.slice(0, 3).join(' | '));
await b.close(); process.exit(fails ? 1 : 0);
