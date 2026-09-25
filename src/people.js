/* ============================== people: traits, quirks, families ============================== */
const STATS = [['cur', 'Curiosity'], ['kin', 'Kindness'], ['amb', 'Ambition'], ['cft', 'Craft'], ['wit', 'Humour']];
const LIVING_CAP = 140;

// [universal, band0 ... band5]
const Q_GUILTY = [
  ['eating sunroot straight from the pot', 'gossip at the well', 'long naps in the middle of harvest', 'bad puns, told on purpose', 'hoarding pretty pebbles',
    'licking the spoon', 'second breakfast', 'cheating at stone-toss', 'writing terrible love poems', 'feeding the loamhound under the table',
    'pretending to have read the whole Archive', 'sugared glowcaps', 'napping inside the Pod', 'racing garden snails', 'dramatic sighing',
    'reading the last page first', 'singing in the bath, loudly', 'eavesdropping on the council', 'midnight melon', 'correcting other people’s star charts',
    'buying one more hat', 'sleeping in on festival days', 'eating the decorations', 'rereading their own letters'],
  ['sneaking honey-reeds from the stores', 'sleeping in the warm vault room', 'naming every single mossback', 'hiding from chores in the glowcap grove'],
  ['spiced sunroot wine', 'card games that go on for days', 'collecting market gossip', 'chapbooks about Earth'],
  ['penny dreadfuls', 'riding the train to nowhere and back', 'fried everything', 'watching the works chimney like it’s a campfire'],
  ['soap-opera radio serials', 'the jukebox at the station café', 'frozen dinners, eaten cold', 'cinema matinees on workdays'],
  ['mossback videos on the Weave', 'arguing with strangers on the Weave', 'ordering drones just to watch them land', 'reality shows about arcology life'],
  ['zero-g karaoke', 'moon cheese (it is not really cheese)', 'instant noodles in orbit', 'watching seedship launches on repeat']
];
const Q_FEAR = [
  ['deep water', 'mossback stampedes (there has never been one)', 'the dark side of the far moon', 'being left out of the chronicle', 'loud clocks',
    'making speeches', 'the Watcher noticing them', 'tall ladders', 'boiled sunroot', 'running out of ink', 'spiders (there are no spiders here)',
    'forgetting the Founder’s name', 'thunder', 'crowds', 'geese (nobody knows why)', 'the vault opening again', 'total silence',
    'being politely thanked', 'their own reflection in the dark', 'the bottom of the lake'],
  [], [], ['trains that are late', 'steam whistles'], ['the telephone ringing'], ['elevators', 'the Weave going down'], ['the space elevator, specifically', 'zero gravity']
];
const Q_HOBBY = [
  ['whittling', 'kite building', 'pressing flowers', 'watching skimmers', 'collecting Maker shards', 'knitting mossback wool', 'writing letters to the Watcher',
    'cloud spotting', 'baking', 'mapping the stars', 'river swimming', 'growing enormous melons', 'fiddle playing', 'map-making', 'yodelling',
    'arguing about history', 'gardening', 'stacking rocks', 'teaching loamhounds tricks', 'beetle-keeping', 'carving tiny Pods', 'knot tying', 'ghost stories'],
  [], ['calligraphy', 'lens grinding'], ['restoring old carts', 'photography', 'model trains'], ['radio tinkering', 'ballroom dancing'],
  ['model rockets', 'building robots that water plants', 'Weave poetry'], ['orbital gardening', 'writing to the seedships']
];
const Q_FOOD = [
  ['sunroot pie', 'pickled glowcaps', 'blue barley bread', 'pink melon', 'mossback cheese', 'violet bean stew', 'fried river-fish', 'goldreed porridge',
    'mint kale crisps', 'honey-reed cake', 'Earth wheat pancakes', 'glowcap soup'],
  [], [], ['canned sunroot (unironically)'], ['ice cream'], ['gene-garden strawberries'], ['moon cheese', 'arcology dumplings']
];
const Q_SAYS = ['“Boil it twice.”', '“The Pod didn’t fall for nothing.”', '“Slowly, slowly.”', '“Ask the mossback.”', '“Tomorrow is also a day.”',
  '“Make it leak less.”', '“The Watcher sees, so tidy up.”', '“One more row.”', '“Measure twice, pray once.”', '“Everything is a kind of seed.”',
  '“It worked on Earth.”', '“Good enough for the Founder.”', '“Tea first.”', '“We’ll need a bigger kiln.”', '“Nobody ever drowned in sunroot soup.”',
  '“If it’s stupid and it works…”', '“Where’s my other boot?”', '“The moons are watching too, you know.”', '“Rain is just the sky being generous.”',
  '“Bold of you to assume I’m lost.”', '“I’ll sleep when the vault’s empty.”', '“Hmm.”', '“Back in my day we had one moon.” (they did not)'];
const Q_TAGS = ['Night owl', 'Early riser', 'Hopeless romantic', 'Terrible singer', 'Always late', 'Knows everyone', 'Talks to plants', 'Never lost a bet',
  'Laughs too loud', 'Stubborn as a mossback', 'Excellent hugger', 'Chronic tinkerer', 'Remembers every birthday', 'Cannot whistle',
  'Suspiciously good at cards', 'Collects small grudges', 'Hums while working', 'Gives terrible directions', 'Cries at weddings', 'Owns too many scarves'];
const RIVAL_CAUSES = ['the Great Pie Contest of Year {y}', 'the business with the disputed kite', 'the argument over who really invented the three-legged stool',
  'the ladder that was borrowed and never returned', 'the row about how to pronounce “sunroot”', 'the fence vote of Year {y}', 'a very small insult at a very big wedding',
  'the argument over whose loamhound is the good boy', 'the melon-growing contest of Year {y}', 'someone ate the last honey-reed cake'];

// trades by era band: [craft, kindness, humour, curiosity, ambition]
const JOBS = [
  [['builder', 'potter', 'basket weaver'], ['healer', 'midwife'], ['storyteller', 'brewer'], ['forager', 'star-watcher'], ['herder', 'trader']],
  [['stonecutter', 'weaver', 'carpenter'], ['healer', 'teacher'], ['brewer', 'baker'], ['scribe', 'surveyor'], ['merchant', 'ferryman']],
  [['smith', 'mason', 'millwright'], ['teacher', 'herbalist'], ['baker', 'innkeeper'], ['printer', 'cartographer'], ['merchant', 'magistrate']],
  [['machinist', 'rail engineer', 'bricklayer'], ['nurse', 'schoolteacher'], ['cook', 'music-hall singer'], ['chemist', 'surveyor'], ['factory owner', 'journalist']],
  [['electrician', 'mechanic', 'architect'], ['doctor', 'teacher'], ['radio host', 'café owner'], ['researcher', 'pilot'], ['banker', 'broadcaster']],
  [['engineer', 'gene gardener', 'drone tuner'], ['doctor', 'counsellor'], ['Weave comedian', 'chef'], ['scientist', 'data weaver'], ['entrepreneur', 'diplomat']],
  [['orbital mechanic', 'terraformer', 'dome keeper'], ['doctor', 'teacher'], ['zero-g chef', 'performer'], ['astronomer', 'seedship planner'], ['diplomat', 'ring surveyor']]
];
function jobFor(p) {
  const b = Math.min(6, invBand() + (hasTech('rocketry') ? 1 : 0));
  const keys = ['cft', 'kin', 'wit', 'cur', 'amb'];
  const k = wpick(keys.map((kk, n) => [n, Math.pow(p.st[kk], 2)]));
  return pick(JOBS[b][k]);
}
function qpick(pool) {
  const b = typeof invBand === 'function' && S ? invBand() : 0;
  const bandPool = [];
  for (let k = 1; k <= b + 1 && k < pool.length; k++) if (k >= b) bandPool.push(...pool[k]);
  return bandPool.length && chance(.35) ? pick(bandPool) : pick(pool[0]);
}
function firstNm(L) { let f = cap(tidy(syl(L) + pick(L.given))); if (f.length > 8) f = f.slice(0, 7); return f; }
function lastNm(L) { let l = cap(tidy(pick(L.on) + pick(L.vo) + pick(L.co) + pick(L.fam))); if (l.length > 11) l = nameWord(L, 2); return l; }

const ROLE_BIAS = { inventor: { cur: 2, cft: 2 }, artist: { cft: 2, wit: 2 }, sage: { cur: 3 }, leader: { amb: 2, kin: 1 }, explorer: { amb: 1, cur: 2 }, founder: { cur: 2, amb: 1, kin: 2 } };
function rollStats(role, parents) {
  const st = {};
  for (const [k] of STATS) {
    let v;
    if (parents && parents.length) { const avg = parents.reduce((a, p) => a + (p.st ? p.st[k] : 5), 0) / parents.length; v = Math.round(avg + rf(-2.5, 2.5)); }
    else v = ri(2, 8);
    v += ((ROLE_BIAS[role] && ROLE_BIAS[role][k]) || 0) + Math.round((CULT.tb[k] || 0) * (parents && parents.length ? .5 : 1));
    st[k] = clamp(v, 1, 10);
  }
  return st;
}
function ensurePerson(p) {
  if (!p.first) { const sp = p.name.split(' '); p.first = sp[0]; p.last = sp.slice(1).join(' ') || lastNm(S.lang); }
  if (!p.st) p.st = rollStats(p.role);
  if (!p.q) p.q = { gp: exQ('gp', qpick(Q_GUILTY)), fear: qpick(Q_FEAR), hobby: exQ('hobby', qpick(Q_HOBBY)), food: qpick(Q_FOOD), says: exQ('says', pick(Q_SAYS)), tag: exQ('tag', pick(Q_TAGS)) };
  if (!p.par) p.par = [];
  if (!p.kids) p.kids = [];
  if (!p.fr) p.fr = [];
  if (!p.riv) p.riv = [];
  if (!p.app) p.app = [];
  if (p.sp === undefined) p.sp = null;
  if (p.men === undefined) p.men = null;
  if (p.fl === undefined) p.fl = p.id === S.founder ? 0 : null;
  if (!p.roles) p.roles = [p.role];
  return p;
}
function setRole(p, role) { p.role = role; if (!p.roles.includes(role)) p.roles.push(role); }
const age = p => Math.floor((p.died !== null ? p.died : S.year) - p.born);
const adult = p => p.died === null && S.year - p.born >= 18;
function related(a, b) {
  if (a.sp === b.id || a.par.includes(b.id) || b.par.includes(a.id)) return true;
  return a.par.some(x => b.par.includes(x)); // siblings
}

/* pick an existing person for a role, or make a new one */
function cast(role, T, wfn, o = {}) {
  const pool = living().filter(p => adult(p) && (!T || p.sid === T.id) && (!o.minAge || age(p) >= o.minAge) && (!o.maxAge || age(p) <= o.maxAge) && (!o.filter || o.filter(p)));
  const pExisting = o.pExisting != null ? o.pExisting : .6;
  if (pool.length && chance(pExisting)) {
    const p = wpick(pool.map(p => [p, Math.pow(Math.max(1, wfn(p)), 2)]));
    setRole(p, role); return p;
  }
  return addPerson(role, T ? T.id : (biggestTown() || { id: 1 }).id, o.newAge != null ? o.newAge : ri(o.minAge || 20, o.maxAge || 55));
}

function relName(id) { const p = S.P[id]; return p ? p.name : null; }
function lineageLabel(p, all) {
  if (p.fl == null || p.fl === 0) return p.fl === 0 ? 'The Founder' : '';
  if (p.fl > 5 && !all) return '';
  if (p.fl === 1) return 'Raised by the Founder';
  if (p.fl === 2) return 'Grandchild of the Founder';
  if (p.fl <= 5) return `${'Great-'.repeat(p.fl - 2)}grandchild of the Founder`;
  if (p.fl <= 9) return 'Distant descendant of the Founder';
  return `Of the Founder’s line, ${p.fl} generations on`;
}
function descendants(p) {
  let kids = 0, grand = 0;
  for (const k of p.kids) { const c = S.P[k]; if (!c) continue; kids++; grand += c.kids.filter(g => S.P[g]).length; }
  return [kids, grand];
}
function isStarred(p) { return p.id === S.founder || p.deeds.length || p.role === 'leader' || p.role === 'explorer' || (p.fl != null && p.fl <= 3); }

/* ---------- family & friends, once a year ---------- */
function marry(a, b) { a.sp = b.id; b.sp = a.id; }
function makeChild(a, b, T) {
  const c = addPerson('child', T ? T.id : a.sid, 0, { parents: [a, b] });
  return c;
}
function stepRelations() {
  const L = living();
  for (const p of L) ensurePerson(p);
  const adults = L.filter(adult);
  const room = Math.max(0, 1 - L.length / LIVING_CAP);
  // the Founder's line: help it along when it gets thin, mourn it if it ends
  const line = L.filter(p => p.fl != null && p.fl > 0);
  if (line.length && line.length <= 3) {
    for (const p of line) {
      if (!p.sp && adult(p) && age(p) < 50 && chance(.5)) { const q = addPerson('townsfolk', p.sid, clamp(age(p) + ri(-5, 5), 20, 60)); marry(p, q); }
      const q = p.sp && S.P[p.sp];
      if (q && q.died === null && Math.min(age(p), age(q)) < 48 && p.kids.length < 4 && chance(.45)) makeChild(p, q, S.T[p.sid]);
    }
  }
  if (!line.length && S.flags.lineAlive) {
    S.flags.lineAlive = 0;
    chron('🕯️', 'The Founder’s line comes to an end. For the first time since Landfall, no one alive can say “my ancestor climbed out of the Pod.” Every town lowers its lanterns for a night.', { k: 'major', x: S.landing.x, y: S.landing.y });
  } else if (line.length) S.flags.lineAlive = 1;
  // newcomers: every town keeps a small named cast
  for (const T of towns()) {
    const n = L.filter(p => p.sid === T.id).length, want = 3 + Math.min(5, Math.floor(T.pop / 400));
    if (n < want && room > .05 && chance(.35)) addPerson('townsfolk', T.id, ri(18, 45));
  }
  // kids grow up, apprentices graduate, everyone gets a trade
  for (const p of L) {
    const a = age(p);
    if (p.role === 'child' && a >= 16) setRole(p, p.men ? 'apprentice' : jobFor(p));
    else if (p.role === 'townsfolk' && a >= 16) setRole(p, jobFor(p));
    else if (p.role === 'apprentice' && a >= 30) { const m = p.men && S.P[p.men]; setRole(p, m && ['inventor', 'artist', 'sage'].includes(m.role) ? m.role : jobFor(p)); }
  }
  // marriages
  for (const p of shuffle(adults.slice()).slice(0, 12)) {
    if (p.sp || age(p) < 20 || age(p) > 65 || !chance((.05 + p.st.kin * .006) * (p.fl != null ? 2.5 : 1))) continue;
    const cand = adults.filter(q => q !== p && !q.sp && Math.abs(age(q) - age(p)) <= 14 && age(q) >= 20 && !related(p, q));
    let q = null;
    if (cand.length && chance(.65)) q = wpick(cand.map(q => [q, (q.sid === p.sid ? 4 : 1) * (q.q.hobby === p.q.hobby ? 3 : 1) + (10 - Math.abs(q.st.wit - p.st.wit)) * .1]));
    else if (room > .1) { q = addPerson('townsfolk', p.sid, clamp(age(p) + ri(-6, 6), 20, 70)); }
    if (!q) continue;
    marry(p, q);
    if (q.sid !== p.sid && chance(.5)) q.sid = p.sid;
    const star = isStarred(p) || isStarred(q), T = S.T[p.sid];
    if (star && chance(.35)) chron('💍', pick([
      `${named(p)} marries ${q.name}${descr(q)}.`,
      `${p.name} and ${q.name} are married in ${T ? T.name : 'the valley'}. ${pick(['The party lasts three days.', 'Somebody cries at the wedding. It is ' + (p.q.tag === 'Cries at weddings' ? p.first : q.first) + '.', 'The cake is ' + p.q.food + ', by request.', 'The loamhounds are ring-bearers.'])}`
    ]), T ? { T, nocap: !chance(.4) } : {});
  }
  // children
  for (const p of adults) {
    if (!p.sp || p.id > p.sp) continue;
    const q = S.P[p.sp]; if (!q || q.died !== null) continue;
    if (Math.min(age(p), age(q)) > 46 || p.kids.length >= 4) continue;
    const line = (p.fl != null || q.fl != null) ? 2.2 : 1;
    if (!chance(.13 * line * room)) continue;
    const c = makeChild(p, q, S.T[p.sid]);
    if ((c.fl != null && c.fl <= 3 || p.role === 'leader' || q.role === 'leader') && chance(.5)) {
      const T = S.T[c.sid];
      chron('👶', `${c.name} is born to ${p.first} and ${q.first}${T ? ' in ' + T.name : ''}${c.fl != null && c.fl <= 4 ? ', ' + lineageLabel(c).toLowerCase() : ''}.`, T ? { T, nocap: true } : {});
    }
  }
  // mentors
  for (const p of L) {
    const a = age(p); if (a < 14 || a > 30 || p.men || p.sp || !chance(.12)) continue;
    const ms = adults.filter(m => m.sid === p.sid && m !== p && age(m) >= 35 && m.deeds.length && m.app.length < 2 && m.sp !== p.id && !related(m, p) && ['inventor', 'artist', 'sage'].includes(m.role));
    if (!ms.length) continue;
    const m = wpick(ms.map(m => [m, m.st.kin + 1]));
    p.men = m.id; m.app.push(p.id);
    if (p.role === 'child' || p.role === 'townsfolk') setRole(p, 'apprentice');
    if (chance(.3)) chron('🧑‍🏫', `${m.name}, famous for ${m.deeds[m.deeds.length - 1]}, takes on an apprentice: ${p.name}${p.fl != null && p.fl <= 4 ? ', ' + lineageLabel(p).toLowerCase() : ''}.`, S.T[p.sid] ? { T: S.T[p.sid], nocap: true } : {});
  }
  // friendships
  for (const p of shuffle(adults.slice()).slice(0, 5)) {
    if (p.fr.length >= 3) continue;
    const cs = adults.filter(q => q !== p && q.id !== p.sp && q.sid === p.sid && !p.fr.includes(q.id) && !p.riv.includes(q.id) && q.fr.length < 3 && (q.q.hobby === p.q.hobby || Math.abs(q.st.wit - p.st.wit) <= 1));
    if (!cs.length || !chance(.35)) continue;
    const q = pick(cs); p.fr.push(q.id); q.fr.push(p.id);
    if (chance(.06)) chron('🤝', q.q.hobby === p.q.hobby ? `${p.name} and ${q.name} bond over ${p.q.hobby} and become inseparable.` : `${p.name} and ${q.name} discover they share a guilty pleasure: ${chance(.5) ? p.q.gp : q.q.gp}. Friends for life.`, { T: S.T[p.sid], nocap: true });
  }
  // rivalries (cozy ones)
  for (const p of shuffle(adults.filter(p => p.st.amb >= 7)).slice(0, 2)) {
    if (p.riv.length >= 2 || !chance(.25)) continue;
    const cs = adults.filter(q => q !== p && q.sid === p.sid && q.st.amb >= 6 && !p.riv.includes(q.id) && !p.fr.includes(q.id) && q.sp !== p.id && !related(p, q));
    if (!cs.length) continue;
    const q = pick(cs); p.riv.push(q.id); q.riv.push(p.id);
    if (chance(.18)) chron('😤', `${p.name} and ${q.name} have not spoken since ${pick(RIVAL_CAUSES).replace('{y}', yr())}.`, { T: S.T[p.sid], nocap: true });
  }
  // reconciliations
  for (const p of adults) {
    for (const rid of p.riv.slice()) {
      const q = S.P[rid]; if (!q || p.id > q.id || !chance(.04)) continue;
      p.riv = p.riv.filter(x => x !== q.id); q.riv = q.riv.filter(x => x !== p.id);
      if (q.died === null) { if (p.fr.length < 3 && q.fr.length < 3) { p.fr.push(q.id); q.fr.push(p.id); } if (chance(.25)) chron('🫖', `${p.name} and ${q.name} finally make up over a pot of tea and ${p.q.food}.`, { T: S.T[p.sid], nocap: true }); }
    }
  }
}
function named(p) { const d = descr(p); return p.name + (d ? d + ',' : ''); }
function descr(p) {
  if (p.id === S.founder) return ', the Founder';
  if (p.role === 'leader' && S.T[p.sid] && S.T[p.sid].leader === p.id) return `, ${titleFor()} of ${S.T[p.sid].name}`;
  if (p.deeds.length) return `, famous for ${p.deeds[p.deeds.length - 1]}`;
  if (p.fl != null && p.fl <= 4) return `, ${lineageLabel(p).toLowerCase()}`;
  return '';
}

/* ---------- person card (HTML) ---------- */
function personCard(p, links) {
  ensurePerson(p);
  const T = S.T[p.sid];
  const dead = p.died !== null;
  const nm = id => { const q = S.P[id]; if (!q) return null; return links ? `<a data-pid="${q.id}">${esc(q.name)}</a>` : esc(q.name); };
  const list = ids => ids.map(nm).filter(Boolean).join(', ');
  const cur = p.role === 'leader' && T && T.leader === p.id;
  const role = p.id === S.founder ? 'The Founder' : cur ? cap(titleFor()) + ' of ' + T.name : p.role === 'leader' ? 'Former ' + titleFor() : cap(p.role);
  let h = `<div class="pc"><div class="pc-h"><b>${esc(p.name)}</b><span>${esc(role)}${T && !cur ? ' · ' + esc(T.name) : ''} · ${dead ? `Year ${Math.floor(p.born)}–${p.died}` : age(p) + ' years old'}</span></div>`;
  const lin = lineageLabel(p);
  if (lin && p.id !== S.founder) h += `<div class="pc-lin">🌱 ${lin}</div>`;
  h += `<div class="pc-tag">${esc(p.q.tag)}</div><div class="pc-st">`;
  for (const [k, n] of STATS) h += `<span>${n}</span><i><b style="width:${p.st[k] * 10}%"></b></i><em>${p.st[k]}</em>`;
  h += `</div><div class="pc-q">`;
  h += `<div><span>Guilty pleasure</span>${esc(p.q.gp)}</div>`;
  h += `<div><span>Secretly afraid of</span>${esc(p.q.fear)}</div>`;
  h += `<div><span>Hobby</span>${esc(p.q.hobby)}</div>`;
  h += `<div><span>Favourite food</span>${esc(p.q.food)}</div>`;
  h += `<div><span>Always says</span>${esc(p.q.says)}</div></div>`;
  const rel = [];
  if (p.sp && S.P[p.sp]) rel.push(['Married to', nm(p.sp) + (S.P[p.sp].died !== null ? ' (†)' : '')]);
  if (p.par.length) { const s = list(p.par); if (s) rel.push([p.fl === 1 ? 'Raised by' : 'Child of', s]); }
  if (p.kids.length) { const s = list(p.kids); if (s) rel.push(['Children', s]); }
  if (p.men && S.P[p.men]) rel.push(['Apprentice of', nm(p.men)]);
  if (p.app.length) { const s = list(p.app); if (s) rel.push(['Apprentices', s]); }
  if (p.fr.length) { const s = list(p.fr); if (s) rel.push(['Friends', s]); }
  if (p.riv.length) { const s = list(p.riv); if (s) rel.push(['Not speaking to', s]); }
  if (rel.length) h += `<div class="pc-rel">${rel.map(([a, b]) => `<div><span>${a}</span>${b}</div>`).join('')}</div>`;
  if (p.deeds.length) h += `<div class="pc-deeds"><span>Known for</span>${esc(p.deeds.slice(-3).join(' · '))}</div>`;
  const [kids, grand] = descendants(p);
  if (dead && (kids || grand)) h += `<div class="pc-foot">Survived by ${kids} child${kids === 1 ? '' : 'ren'}${grand ? ` and ${grand} grandchild${grand === 1 ? '' : 'ren'}` : ''}.</div>`;
  return h + '</div>';
}

function notableScore(p) {
  const T = S.T[p.sid];
  return (p.id === S.founder ? 1000 : 0) + (T && T.leader === p.id ? 500 : 0) + p.deeds.length * 40 + (p.fl != null && p.fl <= 3 ? 60 : 0)
    + (p.sp && S.P[p.sp] && S.P[p.sp].deeds.length ? 15 : 0) + (p.role === 'apprentice' ? 12 : 0) + (p.q && p.q.tag === 'Born under the Watcher’s light' ? 40 : 0) + Math.min(age(p), 60) * .2;
}
function personRow(p) {
  const T = S.T[p.sid], dead = p.died !== null;
  const ic = [];
  if (p.id === S.founder) ic.push('⭐'); else if (!dead && T && T.leader === p.id) ic.push('👑');
  if (p.fl != null && p.fl > 0 && p.fl <= 3) ic.push('🌱');
  if (p.sp && !dead) ic.push('💍');
  if (p.riv.length && !dead) ic.push('😤');
  const role = p.id === S.founder ? 'Founder' : !dead && T && T.leader === p.id ? cap(titleFor()) : p.role === 'leader' ? 'Former ' + titleFor() : cap(p.role);
  return `<div class="prow" data-pid="${p.id}"><span class="pn">${esc(p.name)}</span><span class="pm">${ic.join('')} ${esc(role)} · ${dead ? 'Y' + Math.floor(p.born) + '–' + p.died : age(p)}</span></div>`;
}
