/* ============================== god: Grace & Dread ============================== */
// A world started in Grace & Dread (S.mode 'god') gets more than the calm nudges: a dark twin for each (a storm for rain,
// a blight for bloom, tribute for a gift pod, an eclipse for the light, a great meteor for a gentle starfall), miracles to
// save up for (raise or sink the land, an earthquake, a flood, a golden age, a people called to a new valley), a Chosen One,
// and a people who come to love or fear the Watcher (S.awe: -100 dread .. 100 grace) and show it in their colours and
// clothes, their nights, shrines and squares, their prayers and the chronicle. Nobody dies of any of it: homes, fields and
// stores, never lives. A calm world (and every world from before the modes) never sees any of this.
const GOD = () => !!S && S.mode === 'god';

/* ---------- Grace and Dread: how the people see the Watcher ---------- */
const AWE_B = { '-3': ['😨', 'Dreaded'], '-2': ['😟', 'Feared'], '-1': ['😐', 'Stern'], 0: ['·', 'A mystery'], 1: ['🙂', 'Kind'], 2: ['😊', 'Loved'], 3: ['🥰', 'Adored'] };
function aweBand(a = S.awe || 0) { return a <= -70 ? -3 : a <= -40 ? -2 : a <= -15 ? -1 : a < 15 ? 0 : a < 40 ? 1 : a < 70 ? 2 : 3; }
const AWE_ACT = { rain: 2, drop: 3, inspire: 4, starfall: 2, bloom: 3, storm: -4, tribute: -6, eclipse: -6, meteor: -10, blight: -5, raise: 0, sink: -2, quake: -14, flood: -8, golden: 12, call: 3 };
function aweShift(d, T) {
  if (!GOD() || !d) return;
  const a0 = S.awe || 0, k = Math.sign(d) === Math.sign(a0) ? 1 - Math.abs(a0) / 125 : 1; // (each step further the same way counts for a little less: the extremes are earned)
  S.awe = clamp(a0 + d * k, -100, 100);
  const b0 = aweBand(a0), b1 = aweBand(S.awe);
  if (b0 !== b1) { aweLine(b0, b1, T); recomputeCulture(); faithRecalc(); }
  UIDIRTY.tools = true;
}
function aweLine(b0, b1, T) {
  const n = (T || biggestTown() || {}).name || 'the valley', up = b1 > b0;
  const t = b1 === 0 ? (up ? 'The fear has faded. Nobody is quite sure what the Watcher is any more, and the old stories are told both ways.' : 'The warmth has gone out of the old stories. Nobody is quite sure what the Watcher is any more.')
    : b1 === 1 ? (up ? `People in ${n} have started saying the Watcher is kind. Somebody leaves wildflowers on the hill, just to see.` : 'The love cools a little. The Watcher is still kind, they say. Just not as kind as they’d thought.')
    : b1 === 2 ? (up ? 'The Watcher is loved now. Children wave at the sky, window boxes bloom up and down the valley, and nobody minds the rain.' : 'The worst of the dread lifts. The Watcher is feared still, but the birds have come back.')
    : b1 === 3 ? 'Adored. Every town keeps a feast for the Watcher, every square has a statue with flowers round its feet, and even the sky seems to have turned golden.'
    : b1 === -1 ? (up ? 'The fear is fading. People still make the sign against the sky, but they laugh afterwards.' : `“The Watcher is stern,” the old ones in ${n} say now, and children are told to finish their greens, or else.`)
    : b1 === -2 ? (up ? 'The dread eases into plain fear. A few lights stay on after dark again.' : 'The valley fears the Watcher. Lights go out early, voices drop when the sky darkens, and offerings pile up at the shrines.')
    : 'Dread. Dark banners hang in the streets, the birds have gone, and the priests of the Watcher are the most important people in every town.';
  chron(AWE_B[b1][0] === '·' ? '🌫️' : b1 > 0 ? '🌻' : '🕯️', t, { k: Math.abs(b1) >= 2 ? 'major' : '', nocap: true });
}
// what a loved or feared Watcher does to how the towns look and live, band by band (doctrines, the Watcher's own words, still win while they're strong)
const AWE_LV = {
  1: { housecol: 'pastel', deco: 'flower_boxes', lights: 'warm' }, 2: { clothes: 'colourful', birds: 'flocks', bedtime: 'late', bustle: 'bustling', deco: 'bunting' },
  3: { housecol: 'rainbow', hats: 'flower_crowns', fireworks: 'often', nature: 'gardens', sky: 'golden' },
  '-1': { clothes: 'dark', bedtime: 'early', faith: 'devout', housecol: 'earthy' }, '-2': { lights: 'candlelight', deco: 'flags', fireworks: 'never', bustle: 'quiet', pace: 'industrious' },
  '-3': { birds: 'none', sky: 'violet', hats: 'no_hats' }
};
function aweCulture(c) { // (from recomputeCulture: a layer under the doctrines)
  const b = aweBand(); if (!b) return;
  const s = Math.sign(b), w = .3 * Math.abs(b) + .05;
  for (let k = Math.abs(b); k >= 1; k--) for (const [lk, v] of Object.entries(AWE_LV[k * s])) if (!c.lv[lk] || c.lv[lk].w < w) c.lv[lk] = { v, w };
  if (s > 0) { c.bs += .12 * b; c.ev.festival = (c.ev.festival || 0) + .3 * b; c.ev.wedding = (c.ev.wedding || 0) + .2 * b; c.bld.park = (c.bld.park || 0) + .25 * b; } // (a loved Watcher: more children, feasts, weddings and parks)
  else { c.bs += .08 * b; c.bld.shrine = (c.bld.shrine || 0) + .45 * -b; } // (a feared one: fewer children, shrines, harder work and more prayer)
  c.bs = clamp(c.bs, -1, 1);
}
const aweArt = () => GOD() ? aweBand() : ''; // (part of light.js's art key: squares and shrines show it)
function aweBrief() {
  if (!GOD()) return '';
  const b = aweBand(), h = { '-3': 'dreaded: dark banners, offerings, priests in charge, nobody out after dark', '-2': 'feared: offerings at the shrines, early nights, voices kept down', '-1': 'stern: respected and a little feared',
    0: 'a mystery: nobody agrees whether the Watcher is kind or cruel', 1: 'kind: wildflowers left on the hill', 2: 'loved: feasts, flower boxes, children waving at the sky', 3: 'adored: a feast in every town, statues with flowers round them' }[b];
  return `HOW THE COLONISTS SEE THE WATCHER: ${h}. (The Watcher can be kind or cruel here: storms, blights and tribute as well as rain and gifts. Nobody dies of it.)${S.chosen && S.P[S.chosen.pid] ? ` THE WATCHER'S CHOSEN: ${S.P[S.chosen.pid].name}.` : ''}\n`;
}
// growth: a town that gave tribute grumbles, a golden age blooms (1 in a calm world)
function godGrowK(T) { return !GOD() ? 1 : (T._grumble > S.year ? .85 : 1) * (T._gold > S.year ? 1.2 : 1); }

/* ---------- every year ---------- */
function godYear() {
  const b = aweBand();
  if (b <= -2) for (const T of towns()) if (chance(.1 * -b) && T.pop > 60) { gainRev(3 + 2 * -b, `an offering at ${T.name}`); if (S.year - (S.offerYr || -99) > 30) { S.offerYr = S.year; chron('🕯️', pick([`${T.name} leaves its offering on the high stone: bread, a little silver, a jar of honey. Nobody stays to watch what happens to it.`, `The priests of ${T.name} carry a cart of offerings up the hill, and the town keeps very quiet until they come back.`]), { T, nocap: true }); } }
  if (b >= 2) for (const T of towns()) if (chance(.07 * b) && T.pop > 60) gainRev(2 + b, `thanks from ${T.name}`);
  for (const id in S.B) { const B = S.B[id]; if (B.blight && B.blight <= S.year) { delete B.blight; markDirty(idx(B.x, B.y)); } } // (blighted fields come back)
  chosenYear();
}

/* ---------- the dark twins ---------- */
const TWIN = { rain: 'storm', drop: 'tribute', inspire: 'eclipse', starfall: 'meteor', bloom: 'blight' };
const DARK = { storm: 1, tribute: 1, eclipse: 1, meteor: 1, blight: 1 };
const TOOL_IC = { rain: '🌧️', drop: '📦', inspire: '✨', starfall: '☄️', bloom: '🌱', storm: '⛈️', tribute: '🪙', eclipse: '🌑', meteor: '💥', blight: '🥀' };
function townNear(x, y, extra = 4) { const T = nearestTown(x, y); return T && dist(x, y, T.x, T.y) <= townRadius(T) + extra ? T : null; }
function useDark(k, x, y, T) { // (from useTool) false when it can't be done here
  if (k === 'storm') return godStorm(x, y, T);
  if (k === 'blight') return godBlight(x, y, T);
  if (k === 'tribute') return godTribute(x, y);
  if (k === 'eclipse') return godEclipse(x, y, T);
  if (k === 'meteor') return godMeteor(x, y, T);
  return false;
}
function godStorm(x, y, T) { // a black cloud out of a clear sky; lightning finds a house and sets it alight (the fire: buckets, a crowd, saved or burnt down, nobody hurt), hail flattens the crops
  fx('rain', { x, y, big: 1 }); fx('bolts', { x, y, n: 5 });
  let H0 = null, hd = 9;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const o = S.B[M.bld[idx(nx, ny)]];
    if (o && o.type === 'house' && o.prog >= 1 && o.tier >= 1 && !o.hid && S.T[o.sid] && !(S.inc || []).some(I => I.bid === o.id)) { const d = Math.hypot(dx, dy) - o.tier * .2; if (d < hd) { hd = d; H0 = o; } } }
  let hail = 0; for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny)) continue; const o = S.B[M.bld[idx(nx, ny)]]; if (o && o.type === 'farm' && o.prog >= 1) { o.blight = Math.max(o.blight || 0, S.year + 1); markDirty(idx(o.x, o.y)); hail++; } }
  if (H0 && startIncident('fire', { B: H0, why: 'storm' })) return true;
  let tree = -1; for (let dy = -2; dy <= 2 && tree < 0; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && M.tree[idx(nx, ny)] && !M.bld[idx(nx, ny)]) { tree = idx(nx, ny); break; } }
  if (tree >= 0) { M.tree[tree] = 0; markDirty(tree); }
  chron('⛈️', tree >= 0 ? `A black storm out of a clear sky${T ? ' over ' + T.name : ''}. Lightning splits an old tree on the hill, and nobody goes up there after dark any more.` : `A black storm out of a clear sky${T ? ' over ' + T.name : ''}${hail ? ': hailstones the size of plums flatten the crops' : ''}. People stay indoors and talk in low voices.`, { x, y });
  return true;
}
function godBlight(x, y, T) { // the fields wither overnight (three lean years: they come back), the woods go grey, and the town prays harder
  fx('blight', { x, y }); let f = 0;
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || Math.hypot(dx, dy) > 3.6) continue; const i = idx(nx, ny), o = S.B[M.bld[i]];
    if (o && (o.type === 'farm' || o.type === 'pasture') && o.prog >= 1) { o.blight = S.year + 3; f++; markDirty(idx(o.x, o.y)); }
    else if (!M.bld[i] && !M.water[i]) { if (M.tree[i] && chance(.6)) M.tree[i] = Math.max(0, M.tree[i] - 2); M.fert[i] = Math.max(0, M.fert[i] - 1); if (M.bio[i] === BIO.MEADOW && chance(.4)) M.bio[i] = BIO.BARREN; markDirty(i); } }
  chron('🥀', f ? `The fields round ${T ? T.name : 'the valley'} wither overnight: grey stalks, black leaves, a smell like old pennies. People pray harder than they have in years.` : `The land${T ? ' near ' + T.name : ''} goes grey overnight. The trees drop their leaves in a single night, and the sheep won’t graze there.`, { x, y, k: f > 3 ? 'major' : '' });
  if (T) T._fail = {};
  return true;
}
function godTribute(x, y) { // the town carries a share of its stores up the hill: Reverence for the Watcher, a grumbling town for years after
  const T = townNear(x, y, 6); if (!T) { toast('Point at a town to demand its tribute.'); return false; }
  if (T._trib && S.year - T._trib < 12) { toast(`${T.name} paid tribute only ${Math.max(1, Math.round(S.year - T._trib))} years ago. Its stores are still bare.`); return false; }
  let took = 0; for (const r of RES) { if (!T.res[r]) continue; const n = T.res[r] * .3; T.res[r] -= n; took += n; }
  const got = Math.round(18 + 8 * Math.log10(T.pop + 1));
  T._trib = S.year; T._grumble = S.year + 8;
  fx('tribute', { x: T.x, y: T.y });
  chron('🪙', `${T.name} carries its tribute up the hill: the best of the grain, bolts of cloth, ${pick(['a cart of good timber', 'a sack of silver spoons', 'three fat pigs', 'a barrel of last year’s cider'])}. Nobody says a word on the way down.`, { T });
  S.rev = Math.min(revMax(), (S.rev || 0) + got); revPop(`+${got} ✨ tribute from ${T.name}`);
  return true;
}
function godEclipse(x, y, T) { // the sun goes out at noon; everyone stops and looks up; a child is born in the dark, and the shrines fill for years
  T = T || nearestTown(x, y); fx('eclipse', { x, y });
  S.surge = S.year + 3; // (Reverence gathers faster while it's talked about: faithRecalc)
  let p = null; if (T) { p = addPerson('child', T.id, 0, {}); p.st.kin = Math.max(0, p.st.kin - 3); p.st.amb = Math.min(10, p.st.amb + 3); p.q.tag = 'Born in the Dark Noon'; }
  chron('🌑', `The Dark Noon: the sun goes out over ${T ? T.name : 'the valley'} in the middle of the day. Dogs howl, the stars come out, and everyone stands in the street looking up.${p ? ` A child is born in the dark: ${p.name}, who will never smile much.` : ''}`, { x, y, k: 'major' });
  S.firsts = S.firsts || {}; if (!S.firsts.eclipse) { S.firsts.eclipse = yr(); (S.extraFestAt = S.extraFestAt || []).push({ from: S.year + 1, n: 'the Vigil of the Dark Noon' }); }
  return true;
}
function godMeteor(x, y, T) { // a great meteor where you point: a crater where the buildings stood (everyone saw it coming and got out), starmetal in the rocks
  fx('meteor', { x, y, big: 1 });
  S.tech.pts += techCost(Math.min(S.tech.cur, TECHS.length - 1)) * .25;
  const S0 = S; setTimeout(() => { if (S === S0) godCrater(x, y, T); }, FAST || HEADLESS ? 0 : 2600);
  return true;
}
function godCrater(x, y, T) {
  let homes = 0, gone = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy, d = Math.hypot(dx, dy); if (!inb(nx, ny) || d > 1.6) continue; const i = idx(nx, ny), o = S.B[M.bld[i]];
    if (o && !fpBig(o) && !['pod', 'monument', 'harbor', 'station', 'watchstone'].includes(o.type)) { if (o.type === 'house') homes++; gone++; removeBuilding(o); }
    if (M.water[i] || M.rail[i] || M.bld[i]) continue;
    if (M.road[i] > R_DIRT) M.road[i] = R_DIRT;
    M.tree[i] = 0; M.wild[i] = 2; M.fert[i] = 0; M.plan[i] = 0; if (!M.road[i]) { M.bio[i] = BIO.BARREN; M.ore[i] = 1; } }
  (S.craters = S.craters || []).push({ x, y, yr: yr() }); // (drawn as a scorched bowl with a rim of rubble and starmetal glinting in it: tileCrater)
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if (inb(x + dx, y + dy)) markDirty(idx(x + dx, y + dy));
  for (const U of towns()) U._fail = {};
  const Tn = townNear(x, y, 1);
  chron('💥', `A great meteor comes down ${Tn ? 'on ' + Tn.name : 'in the wilds' + (T ? ' beyond ' + T.name : '')}${gone ? `: ${homes ? `${homes === 1 ? 'a house' : homes + ' houses'}` : 'the buildings'} where it hit ${gone === 1 && homes <= 1 ? 'is' : 'are'} simply gone. Everyone saw it coming for an hour and got out in time` : ''}. The crater glitters with starmetal, and the scholars are beside themselves.`, { x, y, k: 'major' });
}

/* ---------- miracles: the big ones, saved up for ---------- */
const MIR = ['raise', 'sink', 'quake', 'flood', 'golden', 'call'];
function useMiracle(k, x, y, T) {
  if (k === 'raise') return godRaise(x, y);
  if (k === 'sink') return godSink(x, y);
  if (k === 'quake') return godQuake(x, y);
  if (k === 'flood') return godFlood(x, y);
  if (k === 'golden') return godGolden(x, y);
  if (k === 'call') return godCall(x, y);
  return false;
}
const LAND_KEEP = B => fpBig(B) || ['pod', 'monument', 'harbor', 'station', 'watchstone', 'seapier'].includes(B.type); // (what the land doesn't move under)
function godRaise(x, y) { // the ground rises where you point: a hill, a mountain if you do it again, new land out of the water
  const ch = []; let isl = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = x + dx, ny = y + dy, d = Math.hypot(dx, dy); if (!inb(nx, ny) || d > 2.6 || nx < 1 || ny < 1 || nx > W - 2 || ny > H - 2) continue;
    const i = idx(nx, ny), o = S.B[M.bld[i]]; if (M.rail[i] || M.water[i] === 2 || (o && LAND_KEEP(o))) continue; // (the railway and the rivers keep their line)
    const up = d < 1.3 ? 2 : 1;
    if (M.water[i] === 1) { if (o) removeBuilding(o); M.water[i] = 0; M.elev[i] = 1 + up; M.bio[i] = d < 1.6 ? BIO.MEADOW : BIO.SAND; M.fert[i] = 2; M.tree[i] = 0; M.wild[i] = 0; isl++; }
    else M.elev[i] = Math.min(12, M.elev[i] + up);
    ch.push(i); }
  if (!ch.length) { toast('The land there won’t move: try open ground or water.'); return false; }
  landChanged(ch); fx('quake', { x, y, s: 1.5 });
  chron('⛰️', isl ? `Land rises out of the water off ${(nearestTown(x, y) || {}).name || 'the coast'}: wet sand, then grass, steaming in the sun. The fishermen row out to touch it.` : `The ground heaves and rises${nearestTown(x, y) ? ' near ' + nearestTown(x, y).name : ''}. By morning there is a hill where there wasn’t one, and the shepherds have already named it.`, { x, y, k: 'major' });
  return true;
}
function godSink(x, y) { // the ground sinks where you point; below the water line it becomes a lake (or the sea comes in), and what stood there is lost to it
  const ch = [], wet = []; let homes = 0;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const nx = x + dx, ny = y + dy, d = Math.hypot(dx, dy); if (!inb(nx, ny) || d > 2.3) continue;
    const i = idx(nx, ny), o = S.B[M.bld[i]]; if (M.rail[i] || M.water[i] || (o && LAND_KEEP(o))) continue;
    const e = M.elev[i] - (d < 1.2 ? 2 : 1);
    if (e < 2) { if (o) { if (o.type === 'house') homes++; removeBuilding(o); } M.water[i] = 1; M.elev[i] = 1; M.bio[i] = BIO.FRESH; M.tree[i] = 0; M.wild[i] = 0; M.road[i] = 0; M.plan[i] = 0; wet.push(i); }
    else M.elev[i] = e;
    ch.push(i); }
  if (!ch.length) { toast('The land there won’t move: try open ground.'); return false; }
  // the new water is the sea's if it touches the sea
  if (wet.length) { const seen = new Set(wet), q = wet.slice(); let sea = false; for (let h = 0; h < q.length && !sea; h++) { const i = q[h], cx = i % W, cy = (i / W) | 0; for (const [ox, oy] of N4) { const nx = cx + ox, ny = cy + oy; if (!inb(nx, ny)) continue; const j = idx(nx, ny); if (M.water[j] !== 1 || seen.has(j)) continue; if (M.bio[j] === BIO.SEA) { sea = true; break; } seen.add(j); q.push(j); } }
    if (sea) for (const i of wet) M.bio[i] = BIO.SEA; }
  landChanged(ch); fx('quake', { x, y, s: 1.5 });
  const T = nearestTown(x, y);
  chron('🌊', wet.length ? `The ground sinks${T ? ' near ' + T.name : ''} and the water comes up through it. By evening there is a new ${wet.length > 6 ? 'lake' : 'pond'}${homes ? `, and ${homes === 1 ? 'a house' : homes + ' houses'} with it: the families wade out with what they can carry` : ''}.` : `The ground slumps${T ? ' near ' + T.name : ''}, a long low hollow where the hill used to be.`, { x, y, k: homes ? 'major' : '' });
  if (homes) aweShift(-3, T);
  return true;
}
// the land changed under the sim's caches: the water, the coast, the sea lanes, the railway's heights, ferries and harbours
function landChanged(ts) {
  WB = null; SEAD = null; OPENS.S = null; SCL.S = null; FERRY.S = null; NATW.S = null;
  S.seaV = (S.seaV || 0) + 1; S.railGen = (S.railGen || 0) + 1;
  const n0 = (S.ferries || []).length; S.ferries = (S.ferries || []).filter(f => { for (let q = 1; q <= f.len; q++) { const nx = f.a % W + f.dir[0] * q, ny = ((f.a / W) | 0) + f.dir[1] * q; if (!inb(nx, ny) || !M.water[idx(nx, ny)]) return false; } return true; });
  if (S.ferries.length !== n0) S.ferryV = (S.ferryV || 0) + 1;
  for (const id in S.B) { const B = S.B[id]; if (B.type !== 'harbor' || !B.dir || seaAhead(B.x, B.y, B.dir)) continue; const d = !fpBig(B) && harbourSite(B.x, B.y); if (d) B.dir = d; else removeBuilding(B); } // (a harbour left high and dry: the town builds another)
  for (const T of towns()) T._fail = {};
  const seen = new Set(); for (const i of ts) { const x = i % W, y = (i / W) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (inb(nx, ny) && !seen.has(idx(nx, ny))) { seen.add(idx(nx, ny)); markDirty(idx(nx, ny)); } } }
}
function godQuake(x, y) { // the ground shakes a town: old houses come down (everyone was out at the fair), a fault opens a new ridge across the land
  const T = townNear(x, y, 5); fx('quake', { x, y, s: 4 });
  const a = rnd() * Math.PI, ux = Math.cos(a), uy = Math.sin(a), ch = [];
  for (let t = -7; t <= 7; t++) for (const side of [.6, 1.4]) { const nx = Math.round(x + ux * t - uy * side), ny = Math.round(y + uy * t + ux * side); if (!inb(nx, ny) || nx < 1 || ny < 1 || nx > W - 2 || ny > H - 2) continue; const i = idx(nx, ny);
    if (M.water[i] || M.road[i] || M.rail[i] || M.bld[i] || ch.includes(i)) continue; M.elev[i] = Math.min(12, M.elev[i] + 1); ch.push(i); }
  let down = 0;
  if (T) { const hs = T.bl.map(id => S.B[id]).filter(B => B && B.type === 'house' && B.prog >= 1 && B.tier <= 4 && !fpBig(B) && dist(B.x, B.y, x, y) < 7).sort(() => rnd() - .5);
    for (const B of hs) { if (down >= 6 || !chance(.3)) continue; removeBuilding(B); down++; } T._fail = {}; }
  if (ch.length) landChanged(ch);
  chron('🫨', `The earth shakes${T ? ' under ' + T.name : ''}. ${down ? `${down === 1 ? 'An old house comes' : down + ' old houses come'} down in a cloud of dust. Everyone was out at the fair, as luck would have it, and the town` : 'Crockery falls, bells ring by themselves, and the town'} talks of nothing else for a generation.${ch.length ? ' A new ridge runs across the land where the ground split.' : ''}`, { x, y, k: 'major' });
  return true;
}
function godFlood(x, y) { // the river rises into the nearest riverside town (the flood incident: water in the low streets, everyone carrying things uphill)
  if ((S.inc || []).some(I => I.k === 'flood')) { toast('The river is already over its banks somewhere.'); return false; }
  const ts = towns().filter(T => dist(x, y, T.x, T.y) < townRadius(T) + 8 && incFloodTiles(T.x, T.y).length >= 4).sort((a, b) => dist(x, y, a.x, a.y) - dist(x, y, b.x, b.y));
  if (!ts.length) { toast('No river near enough there to flood. Point at a riverside town.'); return false; }
  return !!startIncident('flood', { T: ts[0], why: 'watcher' });
}
function godGolden(x, y) { // a golden age for one town: every house goes up a tier, the streets are paved, a statue of the Watcher, and a generation of plenty
  const T = townNear(x, y, 4); if (!T) { toast('Point at a town to bless it.'); return false; }
  const mt = maxHouseTier(); let n = 0;
  for (const id of T.bl) { const B = S.B[id]; if (B && B.type === 'house' && B.prog >= 1 && B.up == null && B.tier >= 1 && B.tier < mt && !fpBig(B)) { B.up = B.tier + 1; B.prog = .65; B.gl = 1; markDirty(idx(B.x, B.y)); houseNbrDirty(B); n++; } } // (B.gl: lived in all the while, recalcTown)
  const R = townRadius(T); refreshOwn();
  for (let yy = Math.max(0, Math.floor(T.y - R - 3)); yy <= Math.min(H - 1, Math.ceil(T.y + R + 3)); yy++) for (let xx = Math.max(0, Math.floor(T.x - R - 3)); xx <= Math.min(W - 1, Math.ceil(T.x + R + 3)); xx++) {
    const i = idx(xx, yy); if (!M.road[i] || OWN[i] !== T.id) continue; const w = paveSurf(T, i, dist(xx, yy, T.x, T.y), R); if (w > M.road[i] || w === R_GLOW) { M.road[i] = w; markDirty(i); } }
  if (!T.bl.some(id => S.B[id] && S.B[id].type === 'monument' && S.B[id].gift)) { const B = placeProject(T, 'monument', ['center', 'mid'], { sub: 'statue', name: 'the Watcher’s Gift' }); if (B) { B.prog = .8; B.gift = 1; } }
  T._gold = S.year + 25; T.pop *= 1.03;
  fx('fireworks', { x: T.x, y: T.y }); fx('sparkle', { x: T.x, y: T.y });
  chron('👑', `A golden age for ${T.name}. ${n ? `Scaffolding goes up on ${n} houses at once, ` : ''}the streets are paved in a summer, and a statue of the Watcher rises in the square with flowers round its feet. Nobody in ${T.name} will ever quite believe their luck.`, { T, k: 'major' });
  return true;
}
function godCall(x, y) { // call a people: settlers set out from the nearest town and found a new one where you point
  const i = idx(x, y);
  if (M.water[i] || M.elev[i] > 7 || M.bio[i] === BIO.SNOW || M.bio[i] === BIO.ROCK) { toast('Settlers can’t live there. Point at open, low ground.'); return false; }
  const near = towns().find(T => dist(x, y, T.x, T.y) < Math.max(8, townRadius(T) + 2.5)); if (near) { toast(`That’s ${near.name}’s land. Point at open country further out.`); return false; }
  if (S.pendingTown) { toast(`Settlers are already getting ready to found ${S.pendingTown.name}.`); return false; }
  if (!towns().some(T => T.pop > 20)) { toast('No town is big enough to send settlers yet.'); return false; }
  S.pendingTown = { name: placeName(S.lang), at: S.year, until: S.year + 6, x, y };
  const n0 = towns().length; tryFound();
  if (towns().length > n0) { const T = towns().find(U => U.x === x && U.y === y) || towns()[towns().length - 1]; T._called = 1; chron('🧭', `They say a light in the sky showed them the way. The new town of ${T.name} stands exactly where it fell.`, { T }); }
  return true;
}

/* ---------- the Chosen One ---------- */
const CHOSEN_COST = 60;
function canChoose(p) { return GOD() && p && p.died === null && age(p) >= 14 && (!S.chosen || S.chosen.pid !== p.id); }
function chooseOne(pid) {
  const p = S.P[pid]; if (!canChoose(p)) return false;
  if ((S.rev || 0) < CHOSEN_COST) { toast(`Choosing someone takes ${CHOSEN_COST} ✨ Reverence. You have ${Math.floor(S.rev || 0)}.`); return false; }
  const old = S.chosen && S.P[S.chosen.pid]; if (old && old.died === null) { old.q.tag = 'Once the Watcher’s Chosen'; chron('🍂', `The Watcher’s light leaves ${old.name}. ${old.first} takes it quietly, and goes back to ${old.q.hobby}.`, { T: S.T[old.sid] }); }
  S.rev -= CHOSEN_COST; UIDIRTY.tools = true;
  S.chosen = { pid, yr: yr() }; p.life = Math.max(p.life + 25, age(p) + 30); p.q.tag = 'Chosen by the Watcher';
  const b = aweBand();
  chron('✋', `${p.name} of ${town(p)} wakes with the Watcher’s light on them. ${b < 0 ? 'People step aside in the street now, and nobody argues with them any more.' : b > 0 ? 'Children follow them about, and the sick ask to be touched.' : 'Nobody quite knows what it means, least of all ' + p.first + '.'}`, { T: S.T[p.sid], k: 'major' });
  UIDIRTY.people = true; return true;
}
const CH_DEEDS = { // what the Chosen does on their own, by how the Watcher is seen
  good: [
    (p, T) => { T.pop *= 1.005; return [`sits up all night with the fevered children of ${T.name}. By morning every one of them is asking for breakfast`, 'healing the fevered children']; },
    (p, T) => { S.tech.pts += techCost(Math.min(S.tech.cur, TECHS.length - 1)) * .06; return [`teaches the children of ${T.name} to read the stars`, 'teaching the children']; },
    (p, T) => { const a = rnd() * TAU, R = townRadius(T) + 2; godBloomAt(clamp(Math.round(T.x + Math.cos(a) * R), 1, W - 2), clamp(Math.round(T.y + Math.sin(a) * R), 1, H - 2)); return [`plants an orchard on the bare hill above ${T.name}, and the whole town comes out to help`, 'planting an orchard']; },
    (p, T) => { const r = living().find(q => q.sid === T.id && q.riv && q.riv.length); if (!r) return null; const o = S.P[r.riv[0]]; r.riv = r.riv.filter(id => id !== o.id); if (o) o.riv = (o.riv || []).filter(id => id !== r.id); return [`makes ${r.name} and ${o ? o.name : 'an old rival'} shake hands after years of not speaking`, 'ending an old feud']; },
    (p, T) => { fx('fireworks', { x: T.x, y: T.y }); gainRev(6, `${p.first}'s feast`); return [`throws a feast for the Watcher in ${T.name}. Everyone is invited, even the goats`, 'a feast for the Watcher']; }],
  bad: [
    (p, T) => { if (!T.bl.some(id => S.B[id] && S.B[id].type === 'shrine')) placeProject(T, 'shrine', ['high', 'center', 'mid']); gainRev(5, `${p.first} preaches`); return [`preaches in the square at ${T.name}: the Watcher sees everything. The shrine is full by evening`, 'preaching the Watcher’s eye']; },
    (p, T) => { let n = 0; for (const r of RES) { if (!T.res[r]) continue; const v = T.res[r] * .1; T.res[r] -= v; n += v; } gainRev(8, `${p.first}'s tithe`); return [`takes a tithe from every house in ${T.name}, for the Watcher`, 'the Watcher’s tithe']; },
    (p, T) => [`has the whole of ${T.name} up at dawn to work. Nobody dares be late`, 'the dawn bell'],
    (p, T) => [`carves the Watcher’s eye into the cliff above ${T.name}. You can see it from everywhere in town`, 'the eye on the cliff'],
    (p, T) => [`has the noisiest tavern in ${T.name} shut, and the musicians with it`, 'shutting the tavern']],
  mid: [
    (p, T) => { const U = pick(towns()); return [`walks from ${T.name} to ${U.name} telling stories of the Watcher. Nobody can agree what they mean`, 'the long walk']; },
    (p, T) => [`spends a week alone on the hill above ${T.name} and comes back with nothing to say about it`, 'the week on the hill']]
};
function chosenYear() {
  const c = S.chosen; if (!c) return;
  const p = S.P[c.pid]; if (!p) { S.chosen = null; return; }
  if (p.died !== null) { chosenLegend(p); return; }
  if (!chance(.22)) return;
  const T = S.T[p.sid]; if (!T) return;
  const b = aweBand(), list = b > 0 ? CH_DEEDS.good : b < 0 ? CH_DEEDS.bad : CH_DEEDS.mid;
  const r = pick(list)(p, T); if (!r) return;
  p.deeds.push(r[1]); if (p.deeds.length > 12) p.deeds.shift();
  chron(b < 0 ? '🕯️' : b > 0 ? '🌼' : '✋', `${p.name}, the Watcher’s Chosen, ${r[0]}.`, { T });
}
function chosenLegend(p) { // the Chosen dies (of old age, like anyone): a legend, a statue, a feast day, children named after them
  const T = S.T[p.sid] || biggestTown(); S.chosen = null; (S.chosenPast = S.chosenPast || []).push(p.id);
  if (T) { const B = placeProject(T, 'monument', ['center', 'mid'], { sub: 'statue', name: `the statue of ${p.name}` }); if (B) B.prog = .7; }
  (S.extraFestAt = S.extraFestAt || []).push({ from: S.year + 1, n: `${p.first}’s Day` });
  (S.favNames = S.favNames || []).push(p.first);
  chron('🗿', `${p.name}, the Watcher’s Chosen, is gone. ${aweBand() < 0 ? 'The bells toll all day, and the priests are already arguing about who is next.' : 'The whole valley turns out for it.'} A statue goes up in ${T ? T.name : 'the square'}, ${p.first}’s Day is kept every year after, and for a generation half the babies are called ${p.first}.`, { T, k: 'major' });
  UIDIRTY.people = true;
}
function godBloomAt(x, y) { // (bloom's ground, without the omen or the cost)
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const nx = x + dx, ny = y + dy; if (!inb(nx, ny) || Math.hypot(dx, dy) > 2.3) continue; const i = idx(nx, ny);
    if (M.water[i] || M.bld[i] || M.road[i] || M.rail[i] || M.ruin[i] || M.bio[i] === BIO.SNOW) continue;
    if (M.bio[i] === BIO.BARREN) M.bio[i] = BIO.MEADOW; if (chance(.6)) { M.tree[i] = Math.min(3, M.tree[i] + 1); M.ttype[i] = M.ttype[i] || 1; } M.fert[i] = Math.min(4, M.fert[i] + 1); markDirty(i); }
}

/* ---------- prayers in a world that loves or fears the Watcher (appended, so the calm pieces keep their places) ---------- */
PRAY_OPEN.push((p, c) => c.awe <= -2 ? 'Please don’t be angry.' : null, (p, c) => c.awe <= -2 ? `It's ${p.first}. I've been good, I promise.` : null, (p, c) => c.awe <= -1 ? 'Watcher, I mean no disrespect.' : null,
  (p, c) => c.awe >= 2 ? 'Dear, kind Watcher:' : null, (p, c) => c.awe >= 2 ? `Watcher! It's ${p.first}. Thank you for last time.` : null, (p, c) => c.awe >= 1 ? 'I know you listen. Everyone says so.' : null);
PRAY_CLOSE.push((p, c) => c.awe <= -2 ? 'We left the best of the harvest on the high stone.' : null, (p, c) => c.awe <= -2 ? 'Please. We\'ll do better.' : null, (p, c) => c.awe <= -1 ? 'I\'ll keep my voice down after dark.' : null,
  (p, c) => c.awe >= 2 ? 'We\'re all so grateful, truly.' : null, (p, c) => c.awe >= 2 ? 'The children send their love.' : null, (p, c) => c.awe >= 1 ? 'I\'ve put flowers on the hill for you.' : null);

/* ---------- how it looks: the square's centrepiece and the shrines, by how the Watcher is seen ---------- */
function godSq(B, pave, lod) { // (from the plaza's model) a loved Watcher gets a white statue with its arms out and flowers round its feet; a feared one a black obelisk between fire bowls
  const b = GOD() ? aweBand() : 0; if (Math.abs(b) < 2 || B.statue) return false;
  if (b > 0) {
    kCyl(0, 0, .007, .2, .03, shade(pave, .92), M_STONE, 16, '#8fcf8a');
    for (let q = 0; q < 12; q++) { const a = q / 12 * TAU; kBlob(Math.cos(a) * .16, Math.sin(a) * .16, .037, .022, .016, FLOWER_C[q % FLOWER_C.length], 0); }
    kBox(0, 0, .037, .05, .05, .12, '#ece6da', M_STONE); kBox(0, 0, .157, .02, .015, .12, '#f6f1e8', M_STONE); kBlob(0, 0, .3, .022, .022, '#f6f1e8', M_STONE);
    kBeam([-.018, 0, .25], [-.085, 0, .33], .008, '#f6f1e8', M_STONE); kBeam([.018, 0, .25], [.085, 0, .33], .008, '#f6f1e8', M_STONE);
    if (b >= 3) kBox(0, 0, .34, .03, .004, .004, '#ffe9a8', 0, 3); // (a little halo, for the adored)
  } else {
    kBox(0, 0, .007, .09, .09, .03, '#3e3a44', M_STONE); kCone(0, 0, .037, .045, .44, '#2e2a33', 4, M_STONE, .016);
    for (const s of [-.15, .15]) { kCyl(s, 0, .007, .012, .08, '#4a4048', M_STONE, 8); kCyl(s, 0, .087, .034, .02, '#5a4a40', M_STONE, 10, 0); kBox(s, 0, .1, .02, .02, .025, '#ff9a4a', 0, 3); hSmoke(s, 0, .14); }
    if (lod) { for (const [s, f] of [[-.06, .13], [.05, .14], [.12, -.1]]) kBarrel(s, f, .007, .016, .035); for (const [s, f] of [[-.1, -.12], [.0, -.14]]) kBlob(s, f, .02, .022, .018, '#b8a27a', 0); } // (offerings piled at its foot)
    if (b <= -3) for (const s of [-.3, .3]) { kBox(s, -.3, .007, .006, .006, .32, K_IRON); kBox(s + .03, -.3, .22, .03, .003, .09, '#2a2230'); } // (dark banners)
  }
  if (lod) for (const [s, f, a] of [[0, -.36, 1], [0, .36, 1], [-.36, 0, 0], [.36, 0, 0]]) kBench(s, f, 0, a);
  return true;
}
function godShrine(B, st) { // (from the shrine's model) feared: dark stone, a red-lit niche, fire bowls and offerings piled up; loved: garlands and flowers all round (and the shrine as it is)
  const b = GOD() ? aweBand() : 0, lod = KF.lod; if (Math.abs(b) < 2) return false;
  if (b > 0) { for (let q = 0; q < 10; q++) { const a = q / 10 * TAU; kBlob(Math.cos(a) * .24, Math.sin(a) * .24, .04, .02, .016, FLOWER_C[(q + B.id) % FLOWER_C.length], 0); } if (lod) for (const s of [-.24, .24]) { kBox(s, .26, 0, .006, .006, .2, '#f2ece0'); kBeam([s, .26, .2], [0, .26, .26], .004, '#7fbf6a'); } return false; }
  kBox(0, 0, 0, .3, .3, .04, '#4a4650', M_STONE); kBox(0, 0, .04, .22, .22, .035, '#3e3a44', M_STONE);
  kBox(0, 0, .075, .08, .08, .66, '#2e2a33', M_STONE); kBox(0, .075, .3, .034, .01, .1, '#1a1418'); kBox(0, .075, .31, .014, .008, .045, '#ff5a3a', 0, 3); // (a red glow in the niche)
  kHip(-.09, .09, -.09, .09, .74, .2, '#3a2a30', { ov: .01, noGut: 1, fin: 1 });
  for (const [s, f] of [[-.24, .24], [.24, .24], [.24, -.24], [-.24, -.24]]) { kCyl(s, f, 0, .01, .1, '#4a4048', M_STONE, 8); kCyl(s, f, .1, .03, .018, '#5a4a40', M_STONE, 10, 0); kBox(s, f, .118, .018, .018, .022, '#ff9a4a', 0, 3); hSmoke(s, f, .16); }
  if (lod) { for (const [s, f] of [[-.12, .2], [.1, .21], [.16, .12], [-.17, .1]]) kBarrel(s, f, .04, .016, .034); for (const [s, f] of [[-.04, .22], [.04, .2]]) kBlob(s, f, .055, .02, .016, '#b8a27a', 0); for (let k = 0; k < 6; k++) kCyl(-.1 + k * .04, .26, .04, .006, .02, '#efe6d6', 0, 6); }
  return true;
}

// a great meteor's crater: scorched ground, a rim of thrown-up rubble, starmetal glinting in the bowl (fading as the years go by)
const CRAT = { S: null, n: -1, m: new Map() };
function craterAt(i) { // distance from the middle of the crater this tile is in, or -1
  const cs = S.craters; if (!cs || !cs.length) return -1;
  if (CRAT.S !== S || CRAT.n !== cs.length) { CRAT.S = S; CRAT.n = cs.length; CRAT.m = new Map(); for (const c of cs) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const x = c.x + dx, y = c.y + dy, d = Math.hypot(dx, dy); if (inb(x, y) && d <= 1.9) { const j = idx(x, y), o = CRAT.m.get(j); if (!o || d < o.d) CRAT.m.set(j, { d, yr: c.yr }); } } }
  const o = CRAT.m.get(i); return o ? o.d : -1;
}
function craterAge(i) { const o = CRAT.m.get(i); return o ? yr() - o.yr : 999; }
function craterTint(i, col) { const d = craterAt(i); if (d < 0) return col; const f = clamp(1 - craterAge(i) / 150, .3, 1) * (d < .5 ? .85 : d < 1.2 ? .7 : .45); return mix(col, '#2a2522', q2(f)); } // (from topColor)
function tileCrater(i, x, y) { // (from drawTileObjects, on open ground)
  const d = craterAt(i), a = craterAge(i), n = d > 1.1 ? 4 : 2;
  for (let k = 0; k < n; k++) { const u = (hash2(x, y, 41 + k) - .5) * .7, v = (hash2(x, y, 43 + k) - .5) * .7, s = .6 + hash2(x, y, 47 + k) * .9; glBlob(u, v, .07 * s, 0, .6 * s, k % 2 ? '#5a5048' : '#3e3732', M_STONE); }
  if (d < 1.3 && a < 120) for (let k = 0; k < 3; k++) { const u = (hash2(x, y, 51 + k) - .5) * .6, v = (hash2(x, y, 53 + k) - .5) * .6; GLB.mat = 0; glOBox(gp(u, v, .3), [.025, 0, 0], [0, 0, .02], [0, .03, 0], '#bfe8ff', 3); } // (starmetal, glowing faintly)
}
