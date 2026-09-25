/* ============================== levers: what the Watcher's words can change ============================== */
function plural(n) { n = n.toLowerCase(); return /s$/.test(n) ? n : n + 's'; }
const SHAPES = ['round', 'square', 'tall', 'low', 'tiered', 'organic'], ROOFS = ['flat', 'gable', 'pyramid', 'dome', 'cone', 'garden'], FIELDS = ['rows', 'round', 'stripes', 'flowers', 'orchard'];
function hexOk(s) {
  s = String(s || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s.slice(1).split('').map(c => c + c).join('');
  return null;
}
function applyLevers(d, r, fx) {
  const lv = {};
  const a = r.architecture;
  if (a && typeof a === 'object' && (SHAPES.includes(a.shape) || ROOFS.includes(a.roof) || FIELDS.includes(a.fields) || hexOk(a.wall_color) || hexOk(a.roof_color) || hexOk(a.accent_color))) {
    const base = S.styles[S.styleIdx] || STYLES0[0], st = Object.assign({}, base);
    st.name = clean(a.style_name, 30) || (d.name || 'Watcher').replace(/^the /i, '').split(' ').slice(-2).join(' ');
    if (SHAPES.includes(a.shape)) st.shape = a.shape;
    if (FIELDS.includes(a.fields)) st.fields = a.fields === 'rows' ? null : a.fields;
    else if (st.shape === 'round' && !st.fields) st.fields = 'round';
    const wc = hexOk(a.wall_color), rc = hexOk(a.roof_color), ac = hexOk(a.accent_color);
    if (wc) { st.wall = wc; st.trim = shade(wc, .55); }
    if (rc) st.roof = rc;
    if (ac) st.accent = ac;
    if (ROOFS.includes(a.roof)) st.roofK = a.roof;
    st.cult = d.id;
    S.styles.push(st); S.styleIdx = S.styles.length - 1;
    S.renoUntil = S.year + 80;
    const bits = [st.shape && `${st.shape} shapes`, st.roofK && `${st.roofK} roofs`, st.fields && `${st.fields} fields`, (wc || rc || ac) && `colours ${[wc, rc, ac].filter(Boolean).join(' / ')}`].filter(Boolean);
    fx.push(`New building style “${st.name}”${bits.length ? ': ' + bits.join(', ') : ''}. Everything new is built this way, and old buildings are renovated into it over the next decades`);
    chron('🎨', `A new way of building spreads from ${biggestTown().name}: the ${st.name} style.`, { T: biggestTown() });
  }
  if (LV_KEYS.nature.includes(r.nature)) { lv.nature = r.nature; fx.push(`Nature: ${LV_TXT.nature[r.nature]}`); }
  if (LV_KEYS.growth.includes(r.growth)) { lv.growth = r.growth; fx.push(`Growth: ${LV_TXT.growth[r.growth]}`); }
  if (LV_KEYS.streets.includes(r.street_layout)) { lv.streets = r.street_layout; fx.push(`Streets: ${LV_TXT.streets[r.street_layout]}`); }
  if (LV_KEYS.material.includes(r.building_material)) { lv.material = r.building_material; fx.push(`Materials: ${LV_TXT.material[r.building_material]}${r.building_material !== 'local' ? '. Old houses get rebuilt that way, a few a year' : ''}`); }
  if (LV_KEYS.lights.includes(r.night_lights)) { lv.lights = r.night_lights; fx.push(`Night: ${LV_TXT.lights[r.night_lights]}`); }
  if (r.sky_lanterns === true) { lv.lanterns = 1; fx.push('Sky lanterns drift up from the towns after dark'); }
  if (LV_KEYS.weather.includes(r.weather_wish)) {
    lv.weather = r.weather_wish; fx.push(`Weather wish: ${LV_TXT.weather[r.weather_wish]}. The sky starts to listen within a minute or so`);
    if (S.wx) S.wx.left = Math.min(S.wx.left, rf(20, 60));
  }
  if (Object.keys(lv).length) d.lv = lv;
  if (r.new_town && r.new_town.name) {
    const n = clean(r.new_town.name, 30);
    if (n) { S.pendingTown = { name: n, at: S.year + 1 + rnd() * 3, until: S.year + 40 }; fx.push(`Settlers get ready to leave and found ${n}`); }
  }
  for (const nm of (Array.isArray(r.names) ? r.names : []).slice(0, 3)) { const t = applyName(nm || {}); if (t) fx.push(t); }
  if (r.crop) {
    const k = CROPS.findIndex(c => c.n === r.crop);
    if (k >= 0) { for (const T of towns()) T.crop = k; for (const id in S.B) if (S.B[id].type === 'farm') markDirty(idx(S.B[id].x, S.B[id].y)); fx.push(`Every town now grows ${CROPS[k].n}`); }
  }
  const sh = (Array.isArray(r.shunned_buildings) ? r.shunned_buildings : []).filter(b => AI_SHUNNABLE.includes(b)).slice(0, 3);
  if (sh.length) { d.shun = sh; fx.push(`Shunned: no more ${sh.map(b => BT[b] ? plural(BT[b].n) : b).join(', ')} get built`); }
  if (r.research) { d.rs = clamp(r.research | 0, -1, 1); fx.push(d.rs > 0 ? 'Discoveries come a little faster' : 'Discoveries come a little slower'); }
  if (r.births) { d.bs = clamp(r.births | 0, -1, 1); fx.push(d.bs > 0 ? 'More children are born' : 'Fewer children are born'); }
}

/* ---------- names ---------- */
const FEAT_WORD = { river: 'river', sea: 'sea', peak: 'highest peak', forest: 'great forest' };
function featureTile(k) {
  let best = -1, bs = -1e9;
  if (k === 'river') {
    const rs = []; for (let i = 0; i < W * H; i++) if (M.water[i] === 2 || (M.water[i] === 1 && M.bio[i] === BIO.FRESH)) rs.push(i);
    if (!rs.length) return -1;
    let mx = 0, my = 0; for (const i of rs) { mx += i % W; my += (i / W) | 0; } mx /= rs.length; my /= rs.length;
    for (const i of rs) { const s = -dist(i % W, (i / W) | 0, mx, my) + (M.water[i] === 2 ? 2 : 0); if (s > bs) { bs = s; best = i; } }
  } else if (k === 'sea') {
    const ss = []; for (let i = 0; i < W * H; i++) if (M.water[i] === 1 && M.bio[i] === BIO.SEA) ss.push(i);
    if (!ss.length) return -1;
    let mx = 0, my = 0; for (const i of ss) { mx += i % W; my += (i / W) | 0; } mx /= ss.length; my /= ss.length;
    for (const i of ss) { const s = -dist(i % W, (i / W) | 0, mx, my); if (s > bs) { bs = s; best = i; } }
  } else if (k === 'peak') {
    for (let i = 0; i < W * H; i++) if (!M.water[i]) { const s = M.elev[i] * 10 + hash2(i, 7, 3); if (s > bs) { bs = s; best = i; } }
  } else if (k === 'forest') {
    for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
      let n = 0; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) n += M.tree[idx(x + dx, y + dy)] ? 1 : 0;
      const s = n + hash2(x, y, 5) * .5; if (s > bs) { bs = s; best = idx(x, y); }
    }
    if (bs < 6) return -1;
  }
  return best;
}
function applyName(o) {
  const n = clean(o.name, 32); if (!n) return null;
  const k = o.kind;
  if (k === 'planet') {
    const old = S.planet; S.planet = n; UIDIRTY.stats = true;
    chron('🌍', old ? `By common agreement the world is no longer called ${old}. From now on it is ${n}.` : `The world gets a name at last: ${n}.`, { k: 'major' });
    return `The world is renamed ${n}`;
  }
  if (k === 'town') {
    const T = townByName(o.current) || (!o.current ? biggestTown() : null); if (!T) return null;
    const old = T.name; if (old === n) return null; T.name = n;
    chron('🪧', `${old} paints over its signposts. The town is called ${n} now.`, { T });
    return `${old} is renamed ${n}`;
  }
  if (k === 'moon') {
    let j = 0;
    if (!S.moons) S.moons = [n, placeName(S.lang).split(' ')[0]];
    else { j = S.moons.findIndex(m => o.current && m.toLowerCase() === String(o.current).toLowerCase()); if (j < 0) j = 0; S.moons[j] = n; }
    chron('🌙', `One of the two moons gets a new name: ${n}.`, {}); UIDIRTY.lore = true;
    return `A moon is named ${n}`;
  }
  if (!FEAT_WORD[k]) return null;
  const i = featureTile(k); if (i < 0) return null;
  S.names = (S.names || []).filter(f => f.k !== k);
  S.names.push({ k, n, i }); if (S.names.length > 8) S.names.shift();
  chron(k === 'river' ? '🏞️' : k === 'sea' ? '🌊' : k === 'peak' ? '⛰️' : '🌲', `The ${FEAT_WORD[k]} gets a name: ${n}.`, { x: i % W, y: (i / W) | 0 });
  return `The ${FEAT_WORD[k]} is named ${n} (written on the map)`;
}
function customsBrief() {
  const out = [], st = S.styles[S.styleIdx];
  if (st && (st.shape || st.roofK || st.fields || st.cult)) out.push(`building style ${st.name} (${[st.shape, st.roofK && st.roofK + ' roofs', st.fields && st.fields + ' fields'].filter(Boolean).join(', ') || 'custom colours'})`);
  for (const k of ['nature', 'growth', 'streets', 'material', 'lights', 'weather']) { const v = lever(k); if (v) out.push(`${k}: ${v}`); }
  if (lever('lanterns')) out.push('sky lanterns at night');
  const sh = Object.keys(CULT.shun || {}).filter(b => CULT.shun[b] >= .3); if (sh.length) out.push(`shunned: ${sh.join(', ')}`);
  if ((S.names || []).length) out.push('named places: ' + S.names.map(f => `${f.n} (${f.k})`).join(', '));
  return out.join('; ');
}

function customsList() {
  const out = [], st = S.styles[S.styleIdx];
  if (st && st.cult) out.push(['Building style', `${st.name}${[st.shape, st.roofK && st.roofK + ' roofs', st.fields && st.fields + ' fields'].filter(Boolean).length ? ': ' + [st.shape, st.roofK && st.roofK + ' roofs', st.fields && st.fields + ' fields'].filter(Boolean).join(', ') : ''}`]);
  const nm = { nature: 'Nature', growth: 'Growth', streets: 'Streets', material: 'Materials', lights: 'Nights', weather: 'Weather wish' };
  for (const k in nm) { const v = lever(k); if (v) out.push([nm[k], `${LV_TXT[k][v]} (${Math.round(leverW(k) * 100)}%)`]); }
  if (lever('lanterns')) out.push(['Sky lanterns', `released after dark (${Math.round(leverW('lanterns') * 100)}%)`]);
  const sh = Object.keys(CULT.shun || {}).filter(b => CULT.shun[b] >= .3); if (sh.length) out.push(['Shunned', sh.map(b => BT[b] ? plural(BT[b].n) : b).join(', ')]);
  if (Math.abs(CULT.rs || 0) > .1) out.push(['Discoveries', CULT.rs > 0 ? 'a little faster' : 'a little slower']);
  if (Math.abs(CULT.bs || 0) > .1) out.push(['Children', CULT.bs > 0 ? 'more are born' : 'fewer are born']);
  for (const f of S.names || []) out.push([f.n, `the ${FEAT_WORD[f.k] || f.k}`]);
  return out;
}

/* ---------- map labels for named places ---------- */
function drawLabels(c) {
  if (!S.names || !S.names.length) return;
  const za = sstep(3.2, 1.6, CAM.z) * .9 + .1;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.font = `italic 600 ${CAM.z > 2 ? 15 : 13}px Georgia,"Palatino Linotype",serif`;
  const night = LIGHT.nightK;
  for (const f of S.names) {
    const x = f.i % W, y = (f.i / W) | 0, [wx, wy] = gridToWorld(x, y, M.water[f.i] ? SEAZ : surfZ(f.i));
    const [sx, sy] = w2s(wx, wy - (f.k === 'peak' ? 14 : 0));
    if (sx < -100 || sy < -40 || sx > VW + 100 || sy > VH + 40) continue;
    const t = f.k === 'peak' ? '▲ ' + f.n : f.n;
    c.globalAlpha = za;
    c.lineWidth = 3.5; c.strokeStyle = night > .5 ? 'rgba(10,14,34,.55)' : 'rgba(40,50,70,.35)'; c.strokeText(t, sx, sy);
    c.fillStyle = night > .5 ? 'rgba(230,236,255,.85)' : f.k === 'river' || f.k === 'sea' ? 'rgba(236,250,255,.95)' : 'rgba(255,250,240,.95)'; c.fillText(t, sx, sy);
  }
  c.globalAlpha = 1; c.textAlign = 'left';
}

/* ---------- sky lanterns ---------- */
function stepLanterns(dt) {
  const L = DYN.lanterns || (DYN.lanterns = []);
  const w = leverW('lanterns');
  if (w && LIGHT.emK > .35 && !(S.wx && (S.wx.rain > .3 || S.wx.storm > .2))) {
    for (const T of towns()) {
      if (!chance(dt * Math.sqrt(T.pop) * .012 * w)) continue;
      const fx = T.x + rf(-2.5, 2.5), fy = T.y + rf(-2.5, 2.5), i = idx(clamp(Math.round(fx), 0, W - 1), clamp(Math.round(fy), 0, H - 1));
      const [wx, wy] = gridToWorld(fx, fy, surfZ(i) + 4);
      if (!inView(wx, wy, 300)) continue;
      L.push({ x: wx, y: wy, vx: rf(2, 5), vy: -rf(5, 9), t: 0, life: rf(30, 55), ph: rnd() * TAU, col: lever('lights') === 'colourful' ? pick(['#ff9ad0', '#9ad8ff', '#ffe27a', '#c9a8ff']) : pick(['#ffb45e', '#ffc46e', '#ff9f4f']) });
    }
  }
  for (const l of L) { l.t += dt; l.x += (l.vx + Math.sin(l.t * .4 + l.ph) * 2) * dt; l.y += l.vy * dt; }
  DYN.lanterns = L.filter(l => l.t < l.life);
}
function drawLanterns(c) {
  const L = DYN.lanterns; if (!L || !L.length) return;
  c.globalCompositeOperation = 'lighter';
  for (const l of L) {
    const a = Math.min(1, l.t / 2, (l.life - l.t) / 6) * (.75 + .25 * Math.sin(l.t * 3 + l.ph)) * Math.max(.3, LIGHT.emK);
    drawGlow(c, l.x, l.y, 7, l.col, a * .8);
    c.globalAlpha = a; c.fillStyle = '#fff1d0'; c.fillRect(l.x - .7, l.y - 1, 1.4, 1.8);
  }
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
}
