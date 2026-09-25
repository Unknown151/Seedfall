/* ============================== faith: Reverence and prayers ============================== */
// Reverence slowly gathers while the world is on screen. Nudges and speaking cost Reverence.
// Now and then a named colonist prays for something; answering pays back more than it costs.
const COST = { rain: 15, bloom: 20, inspire: 30, drop: 40, starfall: 55, speak: 25 };
const FAITH = { t: 0, rate: 1, max: 120, shown: '', cards: '' };
const PRAY_TOOL = { rain: 'rain', bloom: 'bloom', inspire: 'inspire', drop: 'drop', starfall: 'starfall' };
const PRAY_IC = { rain: '🌧️', bloom: '🌱', inspire: '✨', drop: '📦', starfall: '☄️', name: '👶', town: '🪧', ask: '🕯️' };
const PRAY_VERB = { rain: 'Send rain', bloom: 'Make it bloom', inspire: 'Send the light', drop: 'Send a gift pod', starfall: 'Let a star fall', name: 'Give a name', town: 'Name the town', ask: 'Answer' };

function revMax() { return FAITH.max; }
function revRate() { return FAITH.rate; }
function faithRecalc() {
  const shrines = wcount('shrine') + wcount('watchstone') * 3;
  FAITH.max = Math.round(120 + Math.min(12, shrines) * 12 + Math.min(80, Object.keys(S.tech.done).length * 2) + Math.min(60, (S.prayOk || 0) * 3));
  let dv = 0; for (const d of S.doctrines || []) dv += d.str;
  FAITH.rate = 1.2 + .6 * Math.log10(totalPop() + 1) + .3 * Math.min(8, shrines) + Math.min(2, dv * .5) + Math.min(1.5, (S.prayOk || 0) * .05);
}
function gainRev(n, why) {
  if (!S || S.flags.intro) return;
  const before = S.rev || 0; S.rev = Math.min(revMax(), before + n);
  const got = S.rev - before;
  if (got >= 1 && why) revPop(`+${Math.round(got)} ✨ ${why}`);
  UIDIRTY.tools = true;
}
function canAfford(k) { return (S.rev || 0) >= COST[k]; }
function spendRev(k) { if (!canAfford(k)) return false; S.rev -= COST[k]; UIDIRTY.tools = true; return true; }
function stepFaith(dt) {
  if (S.flags.intro) return;
  if ((FAITH.t -= dt) <= 0) { FAITH.t = 2; faithRecalc(); }
  S.rev = Math.min(revMax(), (S.rev || 0) + revRate() / 60 * dt);
  stepPrayers();
}

/* ---------- prayers ---------- */
const PRAYERS = {
  rain: [
    p => S.drought > 0 ? `The ${crop(p)} fields are cracking in the heat. One good rain, please.` : `If it rained on ${town(p)} this week, I'd stop complaining about everything else. For a while.`,
    p => S.drought > 0 ? `My ${crop(p)} are wilting and the well tastes of dust. Rain for ${town(p)}?` : `The ${crop(p)} could use a drink. So could I, but mostly the ${crop(p)}.`,
    p => `I told the whole market it would rain before harvest. Please don't make a liar of me.`
  ],
  bloom: [
    p => `Could the hills around ${town(p)} flower again? My grandmother used to love them.`,
    p => `I dream of mossbacks grazing in a meadow full of flowers. Just outside ${town(p)} would be perfect.`,
    p => S.era >= 4 ? `It's all roads and roofs around ${town(p)} now. A little wild green, please?` : `I've been ${p.q.hobby} all spring and there's nothing left to look at. Something growing, please?`
  ],
  inspire: [
    p => `${spouse(p)} and I have hoped for a child for years. If you're listening, Watcher...`,
    p => `Our house is too quiet. ${spouse(p)} says you'll hear us if we ask nicely.`,
    p => `${spouse(p)} has already carved a cradle. Please don't let it gather dust.`
  ],
  drop: [
    p => `I've been stuck on the same problem for ${ri(3, 9)} winters. A hint. Any hint.`,
    p => `The Archive's pages on this are torn. Could you send the missing bit?`,
    p => `Everyone in ${town(p)} says I'm close. I don't feel close. Help?`
  ],
  starfall: [
    p => /smith|mason|machin/.test(p.role) ? `They say starmetal rings like a bell. I'd give anything to work it once.` : `Show us a falling star over ${town(p)}. The children have never seen one.`,
    p => `A sign in the sky, please, so ${town(p)} stops arguing about whether you're real.`,
    p => `I've counted every star over ${town(p)}. I'd like one to come a bit closer.`
  ],
  name: [
    (p, q) => `Our little one was born under your sky. Would you choose a name?`,
    (p, q) => `${spouse(p)} wants to call the baby ${S.P[q.child] ? S.P[q.child].first : 'something odd'}. I'd rather you chose.`
  ],
  town: [
    (p, q) => `We've built ${S.T[q.tid].name}'s first houses, but nobody likes the name. What should we call our home?`,
    (p, q) => `The settlers keep arguing about what to call this place. You decide, Watcher. Please.`
  ],
  ask: [
    p => `Should I give up ${p.q.hobby} and take my work more seriously?`,
    p => p.riv.length && S.P[p.riv[0]] ? `${S.P[p.riv[0]].first} and I haven't spoken in years. Should I be the one to make up?` : `Is it silly that I'm afraid of ${p.q.fear}?`,
    p => `Everyone in ${town(p)} knows about my ${p.q.gp}. Should I stop?`,
    p => `What should ${town(p)} build next? The council has been arguing since spring.`,
    p => `You've heard me say ${p.q.says} a thousand times. Am I wrong?`
  ]
};
const OUTCOME = {
  rain: [p => `Rain falls on ${town(p)}, just where ${p.first} prayed for it. ${p.first} stands in it until soaked.`, p => `${p.name} swears the rain came the moment the prayer was finished. The ${crop(p)} recover within the week.`],
  bloom: [p => `The land around ${town(p)} is in flower. ${p.first} brings the whole family to see it.`, p => `${p.name} leaves a ${p.q.food} on the nearest high place to thank the Watcher for the flowers.`],
  inspire: [p => `${p.first} and ${spouse(p)} tell everyone their child was sent by the Watcher. Nobody argues.`],
  drop: [p => `In the gift pod ${p.name} finds exactly the missing piece. ${town(p)} hears the shouting from the workshop.`, p => `${p.name} opens the gift pod, reads the data crystal twice, and doesn't sleep for three days.`],
  starfall: [p => `${p.name} watches the star come down and runs all the way to the crater.`, p => /smith|mason|machin/.test(p.role) ? `${p.name} works the starmetal for a month. The result rings like a bell.` : `${town(p)} watches the star fall all night. ${p.first} is unbearable about it for years.`],
  ask: [(p, a) => `${p.name} hears an answer on the wind: “${a}” They take it very seriously.`, (p, a) => `${p.name} gets a reply from the Watcher: “${a}” ${town(p)} talks of nothing else for a week.`]
};
const EXPIRE = {
  rain: p => `${p.name} stops waiting for rain and digs a new well instead.`,
  bloom: p => `${p.name} gives up waiting and plants a flower bed by the door.`,
  drop: p => `${p.name} solves the problem alone in the end, a bit grumpily.`,
  inspire: p => `${p.first} and ${spouse(p)} get a loamhound pup instead. It helps.`,
  starfall: p => `${p.name} keeps watching the sky. Maybe next year.`
};
const town = p => (S.T[p.sid] || {}).name || 'the valley';
const crop = p => { const T = S.T[p.sid]; return T ? CROPS[T.crop % CROPS.length].n : 'sunroot'; };
const spouse = p => (p.sp && S.P[p.sp] ? S.P[p.sp].first : 'my love');

function prayerCandidates() {
  const L = living().filter(p => adult(p) && S.T[p.sid]); if (!L.length) return [];
  const out = [], ix = townIndex();
  const hasFarm = p => (ix[p.sid] || {}).farm;
  const ps = L.filter(p => hasFarm(p) && /farm|herd|forag|gene|leader|townsfolk|trader|brew|bak/.test(p.role));
  if (ps.length) out.push(['rain', S.drought > 0 ? 4 : 1.2, pick(ps)]);
  out.push(['bloom', 1, pick(L)]);
  const cs = L.filter(p => p.sp && S.P[p.sp] && S.P[p.sp].died === null && age(p) < 44 && age(S.P[p.sp]) < 44 && S.P[p.sp].sid === p.sid && !p.kids.some(k => S.P[k] && S.year - S.P[k].born < 8));
  if (cs.length) out.push(['inspire', 1.6, pick(cs)]);
  const th = L.filter(p => /invent|sage|scien|research|scribe|machin|engineer|chemist|apprentice|printer|cartograph/.test(p.role));
  if (th.length) out.push(['drop', 1.2, pick(th)]);
  const sm = L.filter(p => /smith|astro|star|artist|mason|sage/.test(p.role));
  out.push(['starfall', .8, sm.length ? pick(sm) : pick(L)]);
  const bs = living().filter(c => S.year - c.born < 2 && !c.watcherNamed && c.par && c.par.some(id => S.P[id] && S.P[id].died === null));
  if (bs.length) { const c = pick(bs), par = S.P[c.par.find(id => S.P[id] && S.P[id].died === null)]; if (par && S.T[par.sid]) out.push(['name', 2, par, { child: c.id }]); }
  const ts = towns().filter(T => T.id !== 1 && S.year - T.founded < 15 && !T.asked && S.P[T.founder] && S.P[T.founder].died === null);
  if (ts.length) { const T = pick(ts); out.push(['town', 3, S.P[T.founder], { tid: T.id }]); }
  out.push(['ask', aiOn() ? 1.6 : 1, pick(L)]);
  const open = (S.prayers || []).filter(q => q.st === 'open');
  return out.filter(([k, w, p]) => p && !open.some(q => q.pid === p.id || q.k === k));
}
function newPrayer() {
  const cand = prayerCandidates(); if (!cand.length) return;
  const [k, , p, ex] = wpick(cand.map(c => [c, c[1]]));
  const q = Object.assign({ id: (S.prayN = (S.prayN || 0) + 1), k, pid: p.id, tid: p.sid, t0: S.playSec, exp: S.playSec + rf(28, 45) * 60, st: 'open' }, ex || {});
  q.text = pick(PRAYERS[k])(p, q);
  q.rw = PRAY_TOOL[k] ? Math.round(COST[k] * 1.5 + 8) : k === 'ask' ? 24 : 20;
  if (k === 'town') S.T[q.tid].asked = 1;
  S.prayers.push(q);
  UIDIRTY.prayers = true;
  if (k === 'ask' && aiOn() && !AI.busy) aiPrayerText(q, p); // Claude rewrites the question to fit the person
}
function prayerValid(q) {
  const p = S.P[q.pid]; if (!p || p.died !== null || !S.T[p.sid]) return false;
  if (q.k === 'inspire') { const s = p.sp && S.P[p.sp]; if (!s || s.died !== null) return false; }
  if (q.k === 'name') { const c = S.P[q.child]; if (!c || c.died !== null || c.watcherNamed) return false; }
  if (q.k === 'town' && !S.T[q.tid]) return false;
  return true;
}
function stepPrayers() {
  S.prayers = S.prayers || [];
  if (S.year < 12) return;
  let ch = false;
  for (const q of S.prayers) {
    if (q.st !== 'open') continue;
    if (!prayerValid(q)) { q.st = 'gone'; q.tEnd = S.playSec; ch = true; continue; }
    if (S.playSec > q.exp) {
      q.st = 'gone'; q.tEnd = S.playSec; ch = true;
      const p = S.P[q.pid]; if (EXPIRE[q.k] && chance(.35)) chron('🕯️', EXPIRE[q.k](p), { T: S.T[p.sid], nocap: true });
    }
  }
  const n0 = S.prayers.length;
  S.prayers = S.prayers.filter(q => q.st === 'open' || S.playSec - (q.tEnd || 0) < 6);
  if (S.prayers.length !== n0) ch = true;
  if (S.prayNext == null) S.prayNext = S.playSec + 90;
  if (S.playSec >= S.prayNext) {
    S.prayNext = S.playSec + rf(300, 560);
    if (S.prayers.filter(q => q.st === 'open').length < 3) { newPrayer(); ch = true; }
  }
  if (ch) UIDIRTY.prayers = true;
}
function prayerFor(k, x, y) { // an open prayer this nudge answers
  return (S.prayers || []).find(q => q.st === 'open' && q.k === k && S.T[q.tid] && dist(x, y, S.T[q.tid].x, S.T[q.tid].y) <= townRadius(S.T[q.tid]) + 6);
}
function answered(q, extra) {
  const p = S.P[q.pid], T = S.T[p.sid];
  q.st = 'done'; q.tEnd = S.playSec;
  S.prayOk = (S.prayOk || 0) + 1;
  if (!p.deeds.includes('a prayer the Watcher answered')) p.deeds.push('a prayer the Watcher answered');
  if (chance(.3)) p.q.tag = 'Heard by the Watcher';
  const o = OUTCOME[q.k];
  if (o && q.k !== 'ask') chron('🙏', pick(o)(p), { T, cap: `${p.first}'s prayer is answered` });
  gainRev(q.rw + (extra || 0), `${p.first} is grateful`);
  UIDIRTY.prayers = true; UIDIRTY.people = true;
  faithRecalc();
}
// one click from the card: pick a good spot near the petitioner's town and send the nudge there
function answerWithTool(q) {
  const k = PRAY_TOOL[q.k], T = S.T[q.tid]; if (!k || !T) return;
  if (!canAfford(k)) { toast(`Not enough Reverence yet (${Math.floor(S.rev)} of ${COST[k]} ✨).`); return; }
  let x = T.x, y = T.y;
  if (k === 'rain') { const ix = townIndex()[T.id]; const fs = (ix && ix.farm || []).map(id => S.B[id]).filter(Boolean); if (fs.length) { fs.sort((a, b) => dist(a.x, a.y, T.x, T.y) - dist(b.x, b.y, T.x, T.y)); x = fs[0].x; y = fs[0].y; } }
  if (k === 'bloom' || k === 'starfall') { const a = rnd() * TAU, R = townRadius(T) + 2.5; x = clamp(Math.round(T.x + Math.cos(a) * R), 1, W - 2); y = clamp(Math.round(T.y + Math.sin(a) * R), 1, H - 2); }
  focusOn(x, y, 1.6, 25);
  if (useTool(k, x, y)) { UIDIRTY.chron = true; renderTools(); }
}
function answerWithWords(q, text) {
  const p = S.P[q.pid]; if (!p || q.st !== 'open') return;
  text = clean(text, q.k === 'ask' ? 200 : 24);
  if (!text) return;
  const T = S.T[p.sid];
  if (q.k === 'name') {
    const c = S.P[q.child]; const nm = cap(text.replace(/[^\p{L}\p{M}' -]/gu, '').trim().split(/\s+/)[0] || '').slice(0, 16);
    if (!c || !nm) return;
    c.first = nm; c.name = nm + ' ' + c.last; c.watcherNamed = 1; c.q.tag = 'Named by the Watcher';
    chron('👶', `${p.first}${p.sp && S.P[p.sp] ? ' and ' + S.P[p.sp].first : ''} name their baby ${c.name}, just as the Watcher said.`, { T, cap: `The baby is called ${nm}` });
    answered(q); return;
  }
  if (q.k === 'town') {
    const Tt = S.T[q.tid]; const nm = text.replace(/[<>]/g, '').trim().slice(0, 24); if (!Tt || !nm) return;
    const old = Tt.name; Tt.name = nm;
    chron('🪧', `The settlers of ${old} carve a new name over the gate: ${nm}, as the Watcher said.`, { T: Tt, cap: `${old} is now ${nm}` });
    answered(q); return;
  }
  if (q.k === 'ask') {
    q.st = 'busy'; UIDIRTY.prayers = true;
    if (aiOn()) aiAnswerPrayer(q, p, text).then(ok => { if (!ok) offlineAnswer(q, p, text); });
    else offlineAnswer(q, p, text);
  }
}
function offlineAnswer(q, p, text) {
  const a = text.length > 110 ? text.slice(0, 107) + '…' : text;
  chron('🕯️', pick(OUTCOME.ask)(p, /[.!?…]$/.test(a) ? a : a + '.'), { T: S.T[p.sid], cap: `${p.first} gets an answer` });
  q.st = 'open'; answered(q);
}

/* ---------- Claude: the questions and what comes of the answers ---------- */
const TOOL_PRAYER = { name: 'write_prayer', description: 'Write the words of a short prayer a colonist whispers to the Watcher.', input_schema: { type: 'object', properties: {
  prayer: { type: 'string', description: 'First person, at most 150 characters, a personal question or dilemma the Watcher can answer in a sentence. No quotation marks.' } }, required: ['prayer'] } };
const TOOL_RESOLVE = { name: 'resolve_prayer', description: 'Decide what the colonist does with the Watcher\'s answer and how it turns out.', input_schema: { type: 'object', properties: {
  chronicle: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'object', properties: { years_from_now: { type: 'integer', minimum: 0, maximum: 15 }, icon: { type: 'string' }, text: { type: 'string', description: 'One chronicle line, at most ~200 characters.' } }, required: ['years_from_now', 'icon', 'text'] } },
  person_tag: { type: 'string', description: 'Optional new personality tag, at most 4 words.' },
  new_hobby: { type: 'string', description: 'Optional.' },
  deed: { type: 'string', description: 'Optional: what they will be remembered for because of this, at most 6 words.' },
  reconcile_with_rival: { type: 'boolean' },
  gratitude: { type: 'integer', minimum: 0, maximum: 3, description: 'How grateful they are for the answer.' } }, required: ['chronicle'] } };
function personBrief(p) {
  const s = p.sp && S.P[p.sp], riv = p.riv.map(id => S.P[id]).filter(Boolean).map(q => q.name);
  return `${p.name} (${p.role}, ${age(p)}, lives in ${town(p)}): "${p.q.tag}"; guilty pleasure: ${p.q.gp}; afraid of ${p.q.fear}; hobby: ${p.q.hobby}; always says ${p.q.says}${s ? `; married to ${s.name}` : ''}${riv.length ? `; not speaking to ${riv.join(', ')}` : ''}`;
}
async function aiPrayerText(q, p) {
  AI.busy = true;
  try {
    const { input } = await aiTool(AI_SYSTEM, `${aiWorldBrief()}\n\nTHE PERSON PRAYING: ${personBrief(p)}\n\nWrite the short prayer ${p.first} whispers to the Watcher tonight: a personal question or dilemma, in their own voice, that fits who they are and what's going on in the world. The Watcher will answer it in a sentence.`, TOOL_PRAYER, 300, 'prayer', null);
    const t = clean(input.prayer, 170).replace(/^["“]|["”]$/g, '');
    if (t && q.st === 'open') { q.text = t; q.ai = 1; UIDIRTY.prayers = true; }
  } catch (e) { }
  AI.busy = false;
}
async function aiAnswerPrayer(q, p, text) {
  AI.busy = true; let ok = false;
  try {
    const { input: r, log } = await aiTool(AI_SYSTEM, `${aiWorldBrief()}\n\nTHE PERSON PRAYING: ${personBrief(p)}\n${p.first} prayed: "${q.text}"\nThe Watcher answered: "${text}"\n\nDecide what ${p.first} does with the answer and how it turns out over the next few years. Keep it personal and small: touching or funny, not world-changing. If the answer is unkind or asks for harm, ${p.first} finds a gentle, harmless reading.`, TOOL_RESOLVE, 700, 'answer', text);
    const T = S.T[p.sid], fx = [];
    const beats = (r.chronicle || []).slice(0, 3).sort((a, b) => (a.years_from_now | 0) - (b.years_from_now | 0));
    const qd = beats.map((b, k) => queueBeat(k === 0 ? 0 : clamp(b.years_from_now | 0, 1, 15), b.icon, b.text, T ? T.name : '', false));
    if (r.person_tag) { p.q.tag = clean(r.person_tag, 40); fx.push(`${p.first} is now known as “${p.q.tag}”`); }
    if (r.new_hobby) { p.q.hobby = clean(r.new_hobby, 60); fx.push(`New hobby: ${p.q.hobby}`); }
    if (r.deed) { const d = clean(r.deed, 60); if (d) { p.deeds.push(d); fx.push(`Remembered for: ${d}`); } }
    if (r.reconcile_with_rival && p.riv.length) { const o = S.P[p.riv[0]]; p.riv = p.riv.filter(id => id !== o.id); if (o) { o.riv = o.riv.filter(id => id !== p.id); if (!p.fr.includes(o.id)) p.fr.push(o.id); if (!o.fr.includes(p.id)) o.fr.push(p.id); fx.push(`${p.first} and ${o.first} make up`); } }
    const g = clamp(r.gratitude == null ? 2 : r.gratitude | 0, 0, 3);
    log.fx = fx.concat([`Gratitude ${g}/3`]); log.beats = qd.map(b => ({ at: b.at, ic: b.ic, t: b.t })); log.name = `${p.name}'s prayer`; log.summary = q.text;
    stepAIQueue();
    q.st = 'open'; answered(q, g * 6 - 6);
    ok = true;
  } catch (e) { AI.ok = false; AI.status = '✗ ' + e.message; }
  AI.busy = false; renderAIStatus(); UIDIRTY.chron = true;
  return ok;
}

/* ---------- UI: the meter, the cards, the little pops ---------- */
function revPop(t) {
  const el = document.createElement('div'); el.className = 'revpop'; el.textContent = t;
  $('hudRev').appendChild(el); setTimeout(() => el.remove(), 2600);
}
function renderFaith() {
  if (!S) return;
  const r = Math.floor(S.rev || 0), m = revMax(), full = r >= m - .5;
  const key = r + '/' + m + '/' + revRate().toFixed(1);
  if (key !== FAITH.shown) {
    FAITH.shown = key;
    $('revNum').textContent = r; $('revMax').textContent = m;
    $('revRate').textContent = full ? 'full' : `+${revRate().toFixed(1)} a minute`;
    $('revBar').style.width = (100 * Math.min(1, r / m)).toFixed(1) + '%';
    $('hudRev').classList.toggle('full', full);
  }
  if (UIDIRTY.prayers) { UIDIRTY.prayers = false; renderPrayers(); }
  else for (const el of document.querySelectorAll('.pray[data-pray]')) { const q = (S.prayers || []).find(x => x.id === +el.dataset.pray); if (q && q.st === 'open') { const b = el.querySelector('.pr-t b'); if (b) b.style.width = (100 * clamp((q.exp - S.playSec) / (q.exp - q.t0), 0, 1)).toFixed(1) + '%'; const go = el.querySelector('.pr-go'); if (go && PRAY_TOOL[q.k]) go.classList.toggle('dim', !canAfford(PRAY_TOOL[q.k])); } }
}
function renderPrayers() {
  const box = $('prayers'); if (!box) return;
  const qs = (S.prayers || []).filter(q => S.P[q.pid]);
  box.innerHTML = qs.map(q => {
    const p = S.P[q.pid], k = PRAY_TOOL[q.k], role = p.role === 'leader' ? titleFor() : p.role;
    const act = q.st === 'done' ? `<span class="pr-ok">Answered · +${q.rw} ✨</span>` : q.st === 'gone' ? `<span class="pr-ok dim">They stopped waiting</span>` : q.st === 'busy' ? `<span class="pr-ok">They're listening…</span>`
      : `<button class="pr-go${k && !canAfford(k) ? ' dim' : ''}" data-pgo="${q.id}">${PRAY_VERB[q.k]}${k ? ` · ${COST[k]} ✨` : ''}</button><span class="pr-rw">+${q.rw} ✨</span>`;
    return `<div class="pray ${q.st}" data-pray="${q.id}"><div class="pr-h"><span class="pr-ic">${PRAY_IC[q.k]}</span><div><b data-pid="${p.id}">${esc(p.name)}</b><small>${esc(role)} · ${esc(town(p))}</small></div>${q.st === 'open' ? `<button class="pr-x" data-px="${q.id}" title="Let it be">×</button>` : ''}</div>`
      + `<q>${esc(q.text)}</q><div class="pr-f">${act}</div>${q.st === 'open' ? `<i class="pr-t"><b style="width:${(100 * clamp((q.exp - S.playSec) / (q.exp - q.t0), 0, 1)).toFixed(1)}%"></b></i>` : ''}</div>`;
  }).join('');
}
function openAnswer(q) {
  const p = S.P[q.pid]; if (!p) return;
  UI.answering = q.id;
  $('ansTitle').textContent = q.k === 'name' ? `Name ${p.first}'s baby` : q.k === 'town' ? `Name the new town` : `Answer ${p.first}`;
  $('ansQ').textContent = `“${q.text}”`;
  const nameLike = q.k === 'name' || q.k === 'town';
  $('ansText').rows = nameLike ? 1 : 3; $('ansText').maxLength = nameLike ? 24 : 200; $('ansText').value = '';
  $('ansText').placeholder = q.k === 'name' ? 'A name…' : q.k === 'town' ? 'Starfold' : 'Go on. Say it.';
  $('ansMode').textContent = q.k === 'ask' ? (aiOn() ? `${p.first} will work out what to do with it (${AI.model}).` : 'Without a voice key they hear the words, but work out the rest on their own.') : 'Free. Gratitude comes back as Reverence.';
  $('answer').classList.add('show'); setTimeout(() => $('ansText').focus(), 50);
}
function bindFaith() {
  $('prayers').addEventListener('click', e => {
    const x = e.target.closest('[data-px]'); if (x) { const q = S.prayers.find(q => q.id === +x.dataset.px); if (q) { q.st = 'gone'; q.tEnd = S.playSec - 5; UIDIRTY.prayers = true; renderFaith(); } return; }
    const g = e.target.closest('[data-pgo]'); if (g) { const q = S.prayers.find(q => q.id === +g.dataset.pgo); if (!q || q.st !== 'open') return; if (PRAY_TOOL[q.k]) answerWithTool(q); else openAnswer(q); return; }
    const pp = e.target.closest('[data-pid]'); if (pp) { const w = DYN.walkers.find(w => w.pid === +pp.dataset.pid); if (w) { CAM.followPid = w.pid; CAM.followUntil = DYN.t + 25; CAM.manualUntil = 0; if (w.st === 'in') w.until = Math.min(w.until, DYN.t + 1.5); } else { const p = S.P[+pp.dataset.pid]; const T = p && S.T[p.sid]; if (T) focusOn(T.x, T.y, 1.8, 25); } }
  });
  $('ansCancel').onclick = () => $('answer').classList.remove('show');
  $('ansGo').onclick = () => { const q = (S.prayers || []).find(q => q.id === UI.answering); const t = $('ansText').value; if (!q || !t.trim()) return; $('answer').classList.remove('show'); answerWithWords(q, t); renderFaith(); };
  $('ansText').addEventListener('keydown', e => { if (e.key === 'Enter' && ($('ansText').rows === 1 || e.ctrlKey || e.metaKey)) { e.preventDefault(); $('ansGo').onclick(); } if (e.key === 'Escape') $('answer').classList.remove('show'); e.stopPropagation(); });
}
