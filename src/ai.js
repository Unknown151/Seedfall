/* ============================== the Watcher's voice (Claude API) ============================== */
// The key lives in this browser's IndexedDB only. It is never written to save.json, chronicle.md or any other file.
const AI = { key: '', model: 'claude-haiku-4-5-20251001', narr: 'rare', busy: false, calls: 0, day: '', lastNarr: 0, status: '', ok: null };
const AI_MODELS = [['claude-haiku-4-5-20251001', 'Haiku 4.5 · fast and cheap'], ['claude-sonnet-5', 'Sonnet 5 · better writer'], ['claude-opus-5-5', 'Opus 5.5 · the good stuff']];
const AI_DAY_CAP = 80;
const NARR_MIN = { off: 0, rare: 60, often: 20 };
const AI_BUILDINGS = ['park', 'dome', 'market', 'library', 'school', 'observatory', 'museum', 'stadium', 'dock', 'workshop', 'monument', 'shrine'];
const AI_EVENTS = ['festival', 'art', 'song', 'invent', 'book', 'harvest', 'herd', 'rivalry', 'skimmers', 'meteors', 'wedding', 'climb'];
const AI_MONUMENTS = ['statue', 'lantern', 'spire', 'harp', 'gardens', 'colossus', 'hall', 'clock', 'obelisk', 'orchard'];
const AI_SHUNNABLE = ['works', 'power', 'mine', 'mast', 'turbine', 'airfield', 'stadium', 'mill', 'market', 'solar', 'antenna', 'clinic', 'school', 'workshop'];
const LV_KEYS = { nature: ['protect', 'plant', 'clear', 'wild', 'gardens'], growth: ['taller', 'spread_out', 'compact', 'more_towns', 'stay_small'], lights: ['warm', 'cool', 'colourful', 'candlelight', 'dark_sky'], weather: ['sunny', 'rainy', 'snowy', 'foggy', 'stormy', 'mild'], material: ['timber', 'stone', 'brick', 'local'], streets: ['winding', 'planned'] };
const LV_TXT = {
  nature: { protect: 'forests are left alone, towns build around them', plant: 'trees get planted in and around the towns', clear: 'woods near towns are cleared for fields', wild: 'the meadows go back to forest', gardens: 'flowers and parks everywhere' },
  growth: { taller: 'towns build upward sooner', spread_out: 'towns spread out wider', compact: 'towns stay compact and dense', more_towns: 'more new towns get founded', stay_small: 'towns grow slowly and stay small' },
  lights: { warm: 'warm golden window light', cool: 'cool white light at night', colourful: 'every window and lamp a different colour', candlelight: 'candlelight: dim, orange nights', dark_sky: 'lights out at night, for the stars' },
  streets: { winding: 'new streets wind along the land, like an old village', planned: 'new quarters are laid out in straight, square grids' },
  material: { timber: 'houses are built of timber wherever it can be had', stone: 'houses are built of stone, even if it has to be carted in', brick: 'brick and clay for everything', local: 'every town builds with what its own land gives' },
  weather: { sunny: 'more sunshine', rainy: 'more rain', snowy: 'snow, whatever the season', foggy: 'more fog', stormy: 'more thunderstorms', mild: 'gentle weather, no storms' }
};
let CULT = { tb: {}, bld: {}, ev: {}, lv: {}, shun: {}, rs: 0, bs: 0 };
function lever(k) { const x = CULT.lv && CULT.lv[k]; return x && x.w >= .25 ? x.v : null; }
function leverW(k) { const x = CULT.lv && CULT.lv[k]; return x && x.w >= .25 ? Math.min(1, x.w) : 0; }

async function aiLoad() { const c = await IDB.get('ai'); if (c) for (const k of ['key', 'model', 'narr', 'calls', 'day', 'lastNarr']) if (c[k] != null) AI[k] = c[k]; }
function aiStore() { return IDB.set('ai', { key: AI.key, model: AI.model, narr: AI.narr, calls: AI.calls, day: AI.day, lastNarr: AI.lastNarr }); }

async function aiFetch(body) {
  if (!AI.key) throw new Error('no API key set');
  const today = todayStr(); if (AI.day !== today) { AI.day = today; AI.calls = 0; }
  if (AI.calls >= AI_DAY_CAP) throw new Error(`daily safety limit of ${AI_DAY_CAP} calls reached`);
  AI.calls++; aiStore();
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 60000), t0 = performance.now();
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', signal: ctl.signal,
      headers: { 'content-type': 'application/json', 'x-api-key': AI.key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify(Object.assign({ model: AI.model }, body))
    });
  } catch (e) { throw new Error(e.name === 'AbortError' ? 'the API took too long to answer' : 'couldn’t reach api.anthropic.com (offline, or blocked by a firewall/proxy)'); }
  finally { clearTimeout(to); }
  const j = await res.json().catch(() => null);
  if (!res.ok) {
    const m = j && j.error ? j.error.message : 'HTTP ' + res.status;
    throw new Error(res.status === 401 ? 'the API key was rejected' : res.status === 404 ? `model “${AI.model}” not found` : res.status === 429 ? 'rate limited, try again in a bit' : m);
  }
  const ms = Math.round(performance.now() - t0);
  AI.ok = true; AI.status = `OK · ${AI.model} · ${ms} ms`;
  j._ms = ms;
  return j;
}
/* every exchange is kept in S.aiLog so the Voice tab can show it (never the key) */
function aiLogPush(e) {
  S.aiLog = S.aiLog || [];
  e.id = S.aiLogN = (S.aiLogN || 0) + 1;
  S.aiLog.push(e);
  if (S.aiLog.length > 30) S.aiLog.splice(0, S.aiLog.length - 30);
  S.aiLog.slice(0, -10).forEach(x => { delete x.prompt; delete x.raw; });
  UIDIRTY.voice = true;
  return e;
}
async function aiTool(system, user, tool, maxTokens = 1400, kind = 'words', words = null) {
  const log = { kind, t: Date.now(), yr: yr(), model: AI.model, words, prompt: user, ok: false };
  try {
    const j = await aiFetch({ max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }], tools: [tool], tool_choice: { type: 'tool', name: tool.name } });
    log.ms = j._ms; log.usage = j.usage || null; log.stop = j.stop_reason || null;
    log.raw = { id: j.id, model: j.model, stop_reason: j.stop_reason, usage: j.usage, content: j.content };
    const tu = (j.content || []).find(c => c.type === 'tool_use');
    if (!tu || !tu.input) throw new Error('the model didn’t return a usable answer');
    log.ok = true; log.input = tu.input;
    aiLogPush(log);
    return { input: tu.input, log };
  } catch (e) { log.err = e.message; aiLogPush(log); throw e; }
}
async function aiTest() {
  AI.status = 'Testing…'; renderAIStatus();
  const log = { kind: 'test', t: Date.now(), yr: S ? yr() : 0, model: AI.model, ok: false };
  try { const j = await aiFetch({ max_tokens: 5, messages: [{ role: 'user', content: 'Reply with the single word: ok' }] }); AI.status = '✓ ' + AI.status; log.ok = true; log.ms = j._ms; log.usage = j.usage; log.raw = { id: j.id, model: j.model, content: j.content, usage: j.usage }; }
  catch (e) { AI.ok = false; AI.status = '✗ ' + e.message; log.err = e.message; }
  if (S) aiLogPush(log);
  renderAIStatus();
}

/* ---------- prompts ---------- */
const AI_SYSTEM = `You write for Seedfall, a cozy, slow, procedural colony simulation that runs on a screen in someone's office.
The world: every colonist descends from one seed-pod colonist (the Founder) who landed on a pastel alien planet with a vault of frozen embryos and "the Archive" (Earth's knowledge). Mossbacks are gentle grazing beasts, loamhounds are dog-like pets, skimmers are birds, glowcaps and puffwood are the local flora, sunroot is the staple crop, the Pod is the Founder's landing capsule (now a moss-covered monument), and the Makers were a vanished earlier people who planted the forests. The colonists believe in "the Watcher" (the player), who sends omens.
Tone: warm, dry, gently funny, like a good fantasy chronicle. Short sentences. Keep it PG. No violence, cruelty, deaths of named people, or real-world politics. Always use the real names of the towns and people you are given, and keep their established quirks consistent.
Chronicle lines: present tense, one or two sentences, at most about 200 characters, plain text, no markdown, no quotation marks around the whole line.`;

function aiWorldBrief() {
  const ts = towns().sort((a, b) => b.pop - a.pop);
  const lastTech = Object.keys(S.tech.done).length ? TECHS[Math.min(S.tech.cur, TECHS.length) - 1].name : 'none yet';
  const L = living().sort((a, b) => notableScore(b) - notableScore(a)).slice(0, 12);
  const roleOf = p => { const T = S.T[p.sid]; return p.id === S.founder ? 'the Founder' : T && T.leader === p.id ? `${titleFor()} of ${T.name}` : p.role; };
  const ppl = L.map(p => {
    const sp = p.sp && S.P[p.sp], riv = p.riv.map(id => S.P[id]).filter(Boolean).map(q => q.name), fr = p.fr.map(id => S.P[id]).filter(Boolean).map(q => q.name);
    return `- ${p.name} (${roleOf(p)}, ${age(p)}, lives in ${(S.T[p.sid] || {}).name || '?'}): "${p.q.tag}"; guilty pleasure: ${p.q.gp}; afraid of ${p.q.fear}; hobby: ${p.q.hobby}; always says ${p.q.says}`
      + (sp ? `; married to ${sp.name}` : '') + (fr.length ? `; friends with ${fr.join(', ')}` : '') + (riv.length ? `; not speaking to ${riv.join(', ')}` : '') + (p.deeds.length ? `; known for ${p.deeds.slice(-2).join(', ')}` : '');
  });
  const recent = S.chron.filter(e => e.k !== 'era').slice(-16).map(e => `Year ${e.yr}: ${e.t}`);
  const cu = customsBrief();
  const docs = (S.doctrines || []).slice(-5).map(d => `Year ${d.yr}: "${d.words}" → the colonists call it ${d.name}: ${d.summary}${d.str < .3 ? ' (mostly forgotten now)' : ''}`);
  return `WORLD: ${S.planet || 'an unnamed world'}, Year ${yr()}, ${eraName()}. Latest discovery: ${lastTech}. Population ${fmtInt(totalPop())}. Building style of the day: ${S.styles[S.styleIdx].name}.
TOWNS: ${ts.map(T => `${T.name} (pop ${fmtInt(T.pop)}, grows ${CROPS[T.crop].n}${townEconBrief(T)})`).join('; ')}.
NOTABLE PEOPLE:
${ppl.join('\n')}
RECENT CHRONICLE:
${recent.join('\n')}
${cu ? 'CUSTOMS IN FORCE: ' + cu + '\n' : ''}${docs.length ? 'EARLIER WORDS OF THE WATCHER:\n' + docs.join('\n') : 'The Watcher has never spoken in words before.'}`;
}

const TOOL_WORDS = {
  name: 'interpret_words',
  description: 'Decide how the colonists hear, interpret, argue about and act on the words the Watcher just spoke.',
  input_schema: {
    type: 'object',
    properties: {
      doctrine_name: { type: 'string', description: 'What the colonists come to call this teaching, 2-6 words, e.g. "The Teaching of the Soft Paw".' },
      interpretation: { type: 'string', description: 'One or two sentences: what most colonists believe the words mean.' },
      chronicle: {
        type: 'array', minItems: 2, maxItems: 5, description: 'Story beats spread over time. The first with years_from_now 0, the rest spread over the following decades.',
        items: { type: 'object', properties: {
          years_from_now: { type: 'integer', minimum: 0, maximum: 150 },
          icon: { type: 'string', description: 'A single emoji.' },
          text: { type: 'string', description: 'One chronicle line, at most ~200 characters.' },
          town: { type: 'string', description: 'Name of the town where it happens, if any.' },
          major: { type: 'boolean', description: 'True only for a big moment.' }
        }, required: ['years_from_now', 'icon', 'text'] }
      },
      trait_bias: { type: 'object', description: 'How this nudges the character of children born from now on. Integers from -2 to 2, mostly 0.', properties: {
        curiosity: { type: 'integer', minimum: -2, maximum: 2 }, kindness: { type: 'integer', minimum: -2, maximum: 2 }, ambition: { type: 'integer', minimum: -2, maximum: 2 },
        craft: { type: 'integer', minimum: -2, maximum: 2 }, humour: { type: 'integer', minimum: -2, maximum: 2 } } },
      favoured_buildings: { type: 'array', maxItems: 3, items: { type: 'string', enum: AI_BUILDINGS }, description: 'Kinds of buildings the towns will build more of because of this.' },
      favoured_events: { type: 'array', maxItems: 3, items: { type: 'string', enum: AI_EVENTS }, description: 'Kinds of happenings that become more common.' },
      festival_name: { type: 'string', description: 'Optional: a new festival born from the words, e.g. "the Night of Soft Paws".' },
      monument: { type: 'object', description: 'Optional: a monument the largest town decides to build.', properties: { name: { type: 'string' }, kind: { type: 'string', enum: AI_MONUMENTS } } },
      person_tag: { type: 'string', description: 'Optional: a short personality tag some colonists now carry, at most 4 words.' },
      new_guilty_pleasure: { type: 'string', description: 'Optional: a new guilty pleasure that becomes fashionable.' },
      new_hobby: { type: 'string', description: 'Optional: a new hobby.' },
      new_saying: { type: 'string', description: 'Optional: a short catchphrase people start saying, in quotes.' },
      devotion: { type: 'integer', minimum: 0, maximum: 3, description: 'How strongly the words take hold, 0 = shrugged off, 3 = a movement.' },
      architecture: { type: 'object', description: 'Optional, only if the words touch on how things look or are built: a new building style. All new buildings use it and old ones are slowly renovated into it.', properties: {
        style_name: { type: 'string', description: '1-3 words, e.g. "Roundhouse" or "Pink Revival".' },
        shape: { type: 'string', enum: ['round', 'square', 'tall', 'low', 'tiered', 'organic'], description: 'round: circular buildings, round plazas, parks and fields. square: boxy and flat-topped. tall: stretched upward. low: squat and wide. tiered: stepped terraces. organic: soft, domed shapes.' },
        roof: { type: 'string', enum: ['flat', 'gable', 'pyramid', 'dome', 'cone', 'garden'] },
        wall_color: { type: 'string', description: 'Hex colour like #f2c6d8. Keep it pastel-friendly unless the words insist.' },
        roof_color: { type: 'string', description: 'Hex colour.' },
        accent_color: { type: 'string', description: 'Hex colour.' },
        fields: { type: 'string', enum: ['rows', 'round', 'stripes', 'flowers', 'orchard'], description: 'How farm fields are laid out.' } } },
      nature: { type: 'string', enum: LV_KEYS.nature, description: 'Optional: how they treat the land. protect: leave forests alone and build around them. plant: plant trees in and around towns. clear: clear woods for fields. wild: let meadows turn back to forest. gardens: flowers and parks everywhere.' },
      growth: { type: 'string', enum: LV_KEYS.growth, description: 'Optional: how the towns grow.' },
      street_layout: { type: 'string', enum: LV_KEYS.streets, description: 'Optional: how new streets are laid out. winding: crooked lanes that follow the land. planned: straight grid quarters.' },
      building_material: { type: 'string', enum: LV_KEYS.material, description: 'Optional: what they prefer to build houses from. timber, stone or brick; local means each town uses whatever its own land gives. Towns cut, quarry and trade to get it.' },
      new_town: { type: 'object', description: 'Optional: settlers leave to found a new town with this name.', properties: { name: { type: 'string' } } },
      names: { type: 'array', maxItems: 3, description: 'Optional: things that get (re)named because of the words. Only if the words ask for it or it clearly fits. river, sea, peak and forest names are written on the map.', items: { type: 'object', properties: {
        kind: { type: 'string', enum: ['planet', 'town', 'moon', 'river', 'sea', 'peak', 'forest'] },
        current: { type: 'string', description: 'For a town or moon: its current name.' },
        name: { type: 'string' } }, required: ['kind', 'name'] } },
      night_lights: { type: 'string', enum: LV_KEYS.lights, description: 'Optional: how the towns light their nights.' },
      sky_lanterns: { type: 'boolean', description: 'Optional: true if they start releasing floating lanterns into the night sky.' },
      weather_wish: { type: 'string', enum: LV_KEYS.weather, description: 'Optional: if the words ask for weather, the sky starts to listen.' },
      crop: { type: 'string', enum: CROPS.map(c => c.n), description: 'Optional: a crop every town switches to.' },
      shunned_buildings: { type: 'array', maxItems: 3, items: { type: 'string', enum: AI_SHUNNABLE }, description: 'Optional: kinds of buildings the towns refuse to build any more.' },
      research: { type: 'integer', minimum: -1, maximum: 1, description: 'Optional: -1 they turn away from new ideas (slower discoveries), 1 they chase them.' },
      births: { type: 'integer', minimum: -1, maximum: 1, description: 'Optional: -1 fewer children, 1 more.' }
    },
    required: ['doctrine_name', 'interpretation', 'chronicle']
  }
};
const TOOL_GOSSIP = {
  name: 'write_vignettes',
  description: 'Write small everyday vignettes for the chronicle.',
  input_schema: {
    type: 'object',
    properties: {
      entries: {
        type: 'array', minItems: 1, maxItems: 3,
        items: { type: 'object', properties: {
          years_from_now: { type: 'integer', minimum: 0, maximum: 6 },
          icon: { type: 'string', description: 'A single emoji.' },
          text: { type: 'string', description: 'One chronicle line, at most ~200 characters.' },
          town: { type: 'string' }
        }, required: ['years_from_now', 'icon', 'text'] }
      }
    },
    required: ['entries']
  }
};

/* ---------- speaking ---------- */
function clean(s, n = 220) { return String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n); }
function cleanIcon(s) { const a = Array.from(String(s || '').trim()); const ic = a.slice(0, 2).join(''); return ic && a.length <= 4 ? ic : '✨'; }
function townByName(n, text) {
  const ts = towns();
  if (n) { const k = String(n).toLowerCase(); const T = ts.find(T => T.name.toLowerCase() === k) || ts.find(T => k.includes(T.name.toLowerCase())); if (T) return T; }
  if (text) return ts.find(T => text.includes(T.name)) || null;
  return null;
}
function queueBeat(yearsFromNow, ic, t, town, major) {
  S.aiQueue = S.aiQueue || [];
  const b = { at: yearsFromNow <= 0 ? S.year : S.year + yearsFromNow + rnd() * .8, ic: cleanIcon(ic), t: clean(t, 260), town: town ? clean(town, 40) : '', major: !!major };
  S.aiQueue.push(b);
  return b;
}
function stepAIQueue() {
  if (!S.aiQueue || !S.aiQueue.length) return;
  const due = S.aiQueue.filter(b => b.at <= S.year);
  if (!due.length) return;
  S.aiQueue = S.aiQueue.filter(b => b.at > S.year);
  UIDIRTY.voice = true;
  for (const b of due) { const T = townByName(b.town, b.t); chron(b.ic, b.t, T ? { T, k: b.major ? 'major' : '' } : { k: b.major ? 'major' : '' }); }
}

async function speak(words) {
  words = clean(words, 280);
  if (!words) return;
  if (!spendRev('speak')) { toast(`Speaking takes ${COST.speak} ✨ Reverence. You have ${Math.floor(S.rev)}.`); return; }
  S.omens++;
  chron('🗣️', `The Watcher speaks. In every town at once, everyone hears the same words: “${words}”`, { k: 'major', x: S.landing.x, y: S.landing.y, cap: 'The Watcher speaks' });
  const d = { id: (S.doctrines = S.doctrines || []).length + 1, words, yr: yr(), str: 1, name: 'The Watcher’s Words', summary: 'Nobody is quite sure yet.', ai: false };
  S.doctrines.push(d);
  UIDIRTY.lore = true; renderTools();
  if (!AI.key) { const L = aiLogPush({ kind: 'words', t: Date.now(), yr: yr(), words, ok: false, offline: true, err: 'No voice key set, so nothing was sent to Claude. The colonists are guessing.' }); offlineWords(d, L); toast('Heard, but without a voice key they can only guess what it means.'); return; }
  AI.busy = true; toast('The colonists are listening…');
  try {
    const { input: r, log } = await aiTool(AI_SYSTEM, `${aiWorldBrief()}

THE WATCHER HAS JUST SPOKEN THESE WORDS (they reach the colonists as an omen: a voice on the wind, words in the clouds, whatever suits the era):
"""${words}"""

Interpret them. The colonists take the words seriously, but they may misunderstand, argue, split into schools of thought, or turn them into customs, festivals and fashions. If the words are unkind or ask for harm, the colonists find a gentle, harmless reading instead. Use the named people and towns above where it fits.
Besides the story, you can change how the world looks and behaves: architecture (shape, roofs, colours, fields), building materials, street layout, nature, growth, names, night lights, sky lanterns, a weather wish, crops, shunned buildings, research and births. Use those levers when the words clearly touch on them, and take the words fairly literally when that's fun (e.g. "only circles" means round buildings and round fields). Leave levers out when the words don't touch on them. Story effects should still be modest; this nudges a culture, it doesn't rewrite it.`, TOOL_WORDS, 2000, 'words', words);
    applyWords(d, r, log);
    toast(`They call it ${d.name}.`);
  } catch (e) {
    AI.ok = false; AI.status = '✗ ' + e.message;
    offlineWords(d, (S.aiLog || []).slice(-1)[0]);
    toast(`The voice didn’t carry (${e.message}). They’ll just have to guess.`);
  }
  AI.busy = false; renderAIStatus(); UIDIRTY.lore = true; UIDIRTY.chron = true;
}
function applyWords(d, r, log) {
  const fx = [];
  d.ai = true;
  d.name = clean(r.doctrine_name, 60) || d.name;
  d.summary = clean(r.interpretation, 300) || d.summary;
  const dev = clamp(r.devotion == null ? 2 : r.devotion | 0, 0, 3);
  d.str = .4 + dev * .2;
  const tb = r.trait_bias || {};
  d.tb = { cur: clamp(tb.curiosity | 0, -2, 2), kin: clamp(tb.kindness | 0, -2, 2), amb: clamp(tb.ambition | 0, -2, 2), cft: clamp(tb.craft | 0, -2, 2), wit: clamp(tb.humour | 0, -2, 2) };
  d.bld = (r.favoured_buildings || []).filter(b => AI_BUILDINGS.includes(b)).slice(0, 3);
  d.ev = (r.favoured_events || []).filter(e => AI_EVENTS.includes(e)).slice(0, 3);
  const tbs = STATS.filter(([k]) => d.tb[k]).map(([k, n]) => `${n.toLowerCase()} ${d.tb[k] > 0 ? '+' : '−'}${Math.abs(d.tb[k])}`);
  if (tbs.length) fx.push(`Children born from now on: ${tbs.join(', ')}`);
  if (d.bld.length) fx.push(`Towns build more: ${d.bld.map(b => BT[b] ? BT[b].n.toLowerCase() + 's' : b).join(', ')}`);
  if (d.ev.length) fx.push(`Happens more often: ${d.ev.join(', ')}`);
  if (r.festival_name) {
    const f = clean(r.festival_name, 60);
    if (f) {
      const core = f.replace(/^the /i, '').toLowerCase();
      const intro = (r.chronicle || []).filter(b => String(b.text || '').toLowerCase().includes(core)).map(b => b.years_from_now | 0);
      S.extraFestAt = S.extraFestAt || [];
      const fe = { n: /^the /i.test(f) ? f : 'the ' + f, from: S.year + (intro.length ? Math.max(...intro) + 1 : 10) };
      S.extraFestAt.push(fe); fx.push(`New festival: ${fe.n} (celebrated from Year ${Math.floor(fe.from)})`);
    }
  }
  S.extraQ = S.extraQ || { gp: [], hobby: [], says: [], tag: [] };
  if (r.new_guilty_pleasure) { S.extraQ.gp.push(clean(r.new_guilty_pleasure, 80)); fx.push(`New guilty pleasure in fashion: ${clean(r.new_guilty_pleasure, 80)}`); }
  if (r.new_hobby) { S.extraQ.hobby.push(clean(r.new_hobby, 60)); fx.push(`New hobby: ${clean(r.new_hobby, 60)}`); }
  if (r.new_saying) { let s = clean(r.new_saying, 90).replace(/^["“]|["”]$/g, ''); S.extraQ.says.push(`“${s}”`); fx.push(`People start saying “${s}”`); }
  if (r.person_tag) {
    const tag = clean(r.person_tag, 40);
    if (tag) { S.extraQ.tag.push(tag); let n = 0; for (const p of living()) if (chance(.12 + dev * .05)) { p.q.tag = tag; n++; } UIDIRTY.people = true; fx.push(`New personality tag “${tag}”: ${n} named ${n === 1 ? 'person takes' : 'people take'} it on`); }
  }
  if (r.monument && r.monument.name && !S.pendingWonder) {
    const T = biggestTown();
    if (T) { S.pendingWonder = { sid: T.id, k: AI_MONUMENTS.includes(r.monument.kind) ? r.monument.kind : 'obelisk', n: clean(r.monument.name, 50) }; fx.push(`Monument planned in ${T.name}: ${S.pendingWonder.n} (${S.pendingWonder.k})`); }
  } else if (r.monument && r.monument.name) fx.push(`Monument “${clean(r.monument.name, 50)}” asked for, but another monument is already planned`);
  applyLevers(d, r, fx);
  const beats = (r.chronicle || []).slice(0, 5);
  beats.sort((a, b) => (a.years_from_now | 0) - (b.years_from_now | 0));
  const qd = beats.map((b, k) => queueBeat(k === 0 ? 0 : clamp(b.years_from_now | 0, 1, 150), b.icon, b.text, b.town, b.major));
  fx.push(`Devotion ${dev}/3: the teaching starts at ${Math.round(d.str * 100)}% strength and fades over the centuries`);
  if (log) { log.fx = fx; log.beats = qd.map(b => ({ at: b.at, ic: b.ic, t: b.t })); log.doc = d.id; log.name = d.name; log.summary = d.summary; }
  stepAIQueue();
  recomputeCulture();
}
function driftText(s) {
  return s.split(' ').map(w => {
    if (w.length < 4 || !chance(.4)) return w;
    const a = w.split(''); const k = ri(1, a.length - 2);
    const v = 'aeiouy'; if (v.includes(a[k].toLowerCase())) a[k] = pick(v.split('')); else [a[k], a[k + 1]] = [a[k + 1], a[k]];
    return a.join('');
  }).join(' ');
}
function offlineWords(d, log) {
  const ts = shuffle(towns().slice()), T = ts[0], T2 = ts[1] || T, w0 = d.words.replace(/[.!?,;:]+$/, ''), snip = w0.length > 60 ? w0.slice(0, 57) + '…' : w0;
  d.name = `The ${pick(['First', 'Plain', 'Strange', 'Windborne', 'Quiet'])} Words`;
  d.summary = 'The colonists repeat the words carefully, and argue about them endlessly.';
  const qd = [
    queueBeat(0, '📜', `The priests of ${T.name} write the Watcher’s words on a board and hang it where everyone can see.`, T.name),
    queueBeat(ri(8, 25), '🤔', `Scholars in ${T2.name} spend a whole winter arguing about what “${snip}” really means.`, T2.name),
    queueBeat(ri(60, 140), '🎶', `Children in ${pick(towns()).name} still chant “${driftText(snip)}”, though nobody remembers where it came from.`, '')];
  if (log) { log.words = log.words || d.words; log.name = d.name; log.summary = d.summary; log.doc = d.id; log.fx = ['No effects on the culture: the words weren’t understood.']; log.beats = qd.map(b => ({ at: b.at, ic: b.ic, t: b.t })); }
  stepAIQueue(); recomputeCulture();
}

/* ---------- culture: what the words leave behind ---------- */
function recomputeCulture() {
  const c = { tb: { cur: 0, kin: 0, amb: 0, cft: 0, wit: 0 }, bld: {}, ev: {}, lv: {}, shun: {}, rs: 0, bs: 0 };
  for (const d of S.doctrines || []) {
    if (d.str < .15) continue;
    if (d.tb) for (const k in d.tb) c.tb[k] += d.tb[k] * d.str;
    for (const b of d.bld || []) c.bld[b] = (c.bld[b] || 0) + d.str;
    for (const e of d.ev || []) c.ev[e] = (c.ev[e] || 0) + d.str;
    if (d.lv) for (const k in d.lv) { const cur = c.lv[k]; if (!cur || d.str >= cur.w * .85) c.lv[k] = { v: d.lv[k], w: d.str }; } // the newest strong teaching wins
    for (const b of d.shun || []) c.shun[b] = (c.shun[b] || 0) + d.str;
    c.rs += (d.rs || 0) * d.str; c.bs += (d.bs || 0) * d.str;
  }
  for (const k in c.tb) c.tb[k] = clamp(c.tb[k], -3, 3);
  c.rs = clamp(c.rs, -1, 1); c.bs = clamp(c.bs, -1, 1);
  const lk = JSON.stringify(c.lv && Object.fromEntries(Object.entries(c.lv).map(([k, x]) => [k, x.w >= .25 ? x.v : null])));
  if (CULT.lk !== lk && typeof LIGHT !== 'undefined') LIGHT.chk = 0;
  c.lk = lk;
  CULT = c;
}
function stepCulture() {
  for (const d of S.doctrines || []) {
    const was = d.str;
    d.str *= .996;
    if (was >= .15 && d.str < .15 && d.ai) {
      const T = pick(towns());
      chron('🍂', `${d.name} is mostly forgotten now. Only a few old people in ${T.name} still say the words at weddings.`, { T, nocap: true });
    }
  }
  recomputeCulture();
}
function exQ(field, base) { const x = S.extraQ && S.extraQ[field]; return x && x.length && chance(.18) ? pick(x) : base; }

/* ---------- gossip: small vignettes now and then ---------- */
async function aiMaybeGossip() {
  const mins = NARR_MIN[AI.narr] || 0;
  if (!mins || !AI.key || AI.busy || !S || S.flags.intro || UI.paused || document.hidden) return;
  if (Date.now() - AI.lastNarr < mins * 60000) return;
  if (living().length < 4) return;
  AI.busy = true; AI.lastNarr = Date.now(); aiStore();
  try {
    const { input: r, log } = await aiTool(AI_SYSTEM, `${aiWorldBrief()}

Write 1 to 3 small vignettes that will appear in the chronicle over the next few years. Everyday things: gossip, running jokes, somebody's guilty pleasure getting out of hand, a friendship or feud, a small invention, a local custom, a callback to the Watcher's words. Build on the people, quirks and recent events above. No births, deaths or marriages of named people, and nothing world-changing.`, TOOL_GOSSIP, 700, 'gossip');
    const qd = (r.entries || []).slice(0, 3).map(e => queueBeat(clamp(e.years_from_now | 0, 0, 6), e.icon, e.text, e.town, false));
    log.beats = qd.map(b => ({ at: b.at, ic: b.ic, t: b.t })); stepAIQueue();
  } catch (e) { AI.ok = false; AI.status = '✗ ' + e.message; }
  AI.busy = false; renderAIStatus();
}

/* ---------- UI ---------- */
function openSpeak() {
  if (!S || S.flags.intro) return;
  if (!canAfford('speak')) { toast(`Speaking takes ${COST.speak} ✨ Reverence. You have ${Math.floor(S.rev)}; it gathers while the world is on screen.`); return; }
  $('spkMode').textContent = AI.key ? `Understood by ${AI.model}${AI.ok === false ? ' (last call failed, see Voice settings)' : ''}.` : 'No voice key set: they will hear the words but can only guess at them. Add a key under Voice settings.';
  $('speak').classList.add('show');
  setTimeout(() => $('spkText').focus(), 50);
}
function openAISettings() {
  $('aiKey').value = AI.key ? '••••••••' + AI.key.slice(-4) : '';
  $('aiModel').value = AI.model; $('aiNarr').value = AI.narr;
  renderAIStatus();
  $('aiset').classList.add('show');
}
function renderAIStatus() {
  const el = $('aiStatus'); if (!el) return;
  el.textContent = `${AI.key ? 'Key saved in this browser.' : 'No key yet.'} ${AI.calls || 0} call${AI.calls === 1 ? '' : 's'} today (safety limit ${AI_DAY_CAP}). ${AI.status || ''}`;
}
function bindAI() {
  $('spkCancel').onclick = () => $('speak').classList.remove('show');
  $('spkSettings').onclick = () => { $('speak').classList.remove('show'); openAISettings(); };
  $('spkGo').onclick = () => { const t = $('spkText').value; if (!t.trim()) return; $('speak').classList.remove('show'); $('spkText').value = ''; speak(t); };
  $('spkText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('spkGo').onclick(); if (e.key === 'Escape') $('speak').classList.remove('show'); e.stopPropagation(); });
  $('bVoice').onclick = openAISettings;
  $('aiClose').onclick = () => $('aiset').classList.remove('show');
  $('aiSave').onclick = () => {
    const k = $('aiKey').value.trim();
    if (k && !k.startsWith('••••')) AI.key = k;
    AI.model = $('aiModel').value.trim() || AI_MODELS[0][0];
    AI.narr = $('aiNarr').value;
    aiStore(); AI.status = 'Saved.'; renderAIStatus(); openAISettings();
  };
  $('aiTest').onclick = async () => { $('aiSave').onclick(); await aiTest(); };
  $('aiForget').onclick = () => { AI.key = ''; aiStore(); AI.status = 'Key forgotten.'; openAISettings(); };
  const dl = $('aiModels'); dl.innerHTML = AI_MODELS.map(([id, n]) => `<option value="${id}">${n}</option>`).join('');
}

/* ---------- Voice tab: everything that went to and came back from Claude ---------- */
const VOICE_OPEN = new Set();
function fmtClock(t) { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return `${p(d.getDate())}.${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`; }
function renderVoiceTab() {
  const L = (S.aiLog || []).slice().reverse();
  const gossip = { off: 'off', rare: 'about hourly', often: 'about every 20 min' }[AI.narr] || AI.narr;
  let h = `<div class="vx-top"><div><b>${AI.key ? 'Voice connected' : 'No voice key'}</b><small>${esc(AI.model)} · ${AI.calls || 0} call${AI.calls === 1 ? '' : 's'} today · gossip ${gossip}${AI.status ? ' · ' + esc(AI.status) : ''}</small></div><button class="btn" data-voiceset="1">Settings…</button></div>`;
  if (!L.length) return h + `<div class="phint">Nothing sent yet. Press <kbd>6</kbd> to speak to your people; every exchange with Claude will show up here, including the raw response.</div>`;
  let tin = 0, tout = 0; for (const e of S.aiLog) if (e.usage) { tin += e.usage.input_tokens || 0; tout += e.usage.output_tokens || 0; }
  if (tin) h += `<div class="phint">Tokens in this world’s log: ${fmtInt(tin)} in, ${fmtInt(tout)} out.</div>`;
  for (const e of L) {
    const title = e.kind === 'words' ? '🗣️ Your words' : e.kind === 'gossip' ? '💬 Town gossip' : e.kind === 'prayer' ? '🕯️ A prayer, written by Claude' : e.kind === 'answer' ? '🙏 Your answer to a prayer' : '🔌 Connection test';
    const meta = [`Year ${e.yr}`, fmtClock(e.t)];
    if (e.ms) meta.push((e.ms / 1000).toFixed(1) + ' s');
    if (e.usage) meta.push(`${e.usage.input_tokens || 0} in / ${e.usage.output_tokens || 0} out tokens`);
    if (e.model && !e.offline) meta.push(e.model);
    h += `<div class="vx${e.ok ? '' : ' bad'}"><div class="vx-h"><b>${title}</b><span>${esc(meta.join(' · '))}</span></div>`;
    if (e.words) h += `<q>${esc(e.words)}</q>`;
    if (!e.ok && e.err) h += `<div class="vx-err">${e.offline ? '' : '✗ '}${esc(e.err)}</div>`;
    if (e.kind === 'words' && e.name) h += `<div class="vx-t">They call it <b>${esc(e.name)}</b></div>` + (e.summary ? `<div class="vx-s">${esc(e.summary)}</div>` : '');
    if (e.kind === 'words' && e.doc) { const d = (S.doctrines || []).find(d => d.id === e.doc); if (d && d.ai) h += `<div class="vx-s dim">Strength today: ${Math.round(d.str * 100)}%${d.str < .15 ? ' (forgotten)' : ''}</div>`; }
    if (e.fx && e.fx.length) h += `<div class="vx-k">What it does</div><ul>${e.fx.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
    if (e.beats && e.beats.length) h += `<div class="vx-k">Chronicle beats</div><ol>${e.beats.map(b => { const done = b.at <= S.year; return `<li class="${done ? 'done' : 'soon'}"><span>${done ? '✓ Year ' + Math.floor(b.at) : 'Coming in Year ' + Math.floor(b.at)}</span>${esc(b.ic)} ${esc(b.t)}</li>`; }).join('')}</ol>`;
    if (e.input) h += `<details data-vk="i${e.id}"${VOICE_OPEN.has('i' + e.id) ? ' open' : ''}><summary>What Claude returned (JSON)</summary><pre>${esc(JSON.stringify(e.input, null, 2))}</pre><button class="btn" data-copy="i${e.id}">Copy</button></details>`;
    if (e.raw) h += `<details data-vk="r${e.id}"${VOICE_OPEN.has('r' + e.id) ? ' open' : ''}><summary>Full API response</summary><pre>${esc(JSON.stringify(e.raw, null, 2))}</pre><button class="btn" data-copy="r${e.id}">Copy</button></details>`;
    if (e.prompt) h += `<details data-vk="p${e.id}"${VOICE_OPEN.has('p' + e.id) ? ' open' : ''}><summary>What Claude was told</summary><pre>${esc(AI_SYSTEM + '\n\n' + e.prompt)}</pre><button class="btn" data-copy="p${e.id}">Copy</button></details>`;
    h += `</div>`;
  }
  if ((S.aiLog || []).length >= 30) h += `<div class="phint">Only the last 30 exchanges are kept (full prompts and raw responses for the last 10).</div>`;
  return h;
}
function voiceCopy(key) {
  const e = (S.aiLog || []).find(x => x.id === +key.slice(1)); if (!e) return;
  const txt = key[0] === 'i' ? JSON.stringify(e.input, null, 2) : key[0] === 'r' ? JSON.stringify(e.raw, null, 2) : AI_SYSTEM + '\n\n' + e.prompt;
  const done = () => toast('Copied to the clipboard.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done)); else fallbackCopy(txt, done);
}
function fallbackCopy(txt, done) { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { } t.remove(); }
