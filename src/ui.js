/* ============================== UI ============================== */
const UI = { tool: null, panel: false, tab: 'chron', paused: false, lastMove: 0, mouse: { x: -1, y: -1 }, drag: null, lastPick: 0, tipTile: -1 };
const $ = id => document.getElementById(id);

function bindUI() {
  addEventListener('keydown', onKey);
  addEventListener('mousemove', e => { // (dragging, the wheel and clicks on the view itself are gl.js's)
    UI.lastMove = performance.now(); document.body.classList.add('active'); document.body.classList.remove('nocursor');
    UI.mouse.x = e.clientX; UI.mouse.y = e.clientY;
  });
  document.querySelectorAll('.tool[data-tool]').forEach(b => {
    b.addEventListener('click', () => selectTool(b.dataset.tool));
    b.addEventListener('mouseenter', () => { const k = b.dataset.tool, [n, d] = TOOL_INFO[k]; const t = $('tip2'); t.textContent = `${n}: ${d} · ${COST[k]} ✨${toolReady(k) ? '' : ` (you have ${Math.floor(S.rev)})`}`; t.style.opacity = 1; });
    b.addEventListener('mouseleave', () => $('tip2').style.opacity = 0);
  });
  $('dockChron').addEventListener('click', togglePanel);
  $('dockSky').addEventListener('click', clearSkies);
  $('tbPrev').addEventListener('click', () => barStep(-1)); $('tbNext').addEventListener('click', () => barStep(1));
  $('tbPl').addEventListener('click', () => { setTab('towns'); if (!UI.panel) togglePanel(); else renderPanelBody(true); });
  $('optBar').addEventListener('change', e => setBar(e.target.checked)); setBar(TB.on);
  $('pClose').addEventListener('click', togglePanel);
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { if (t.dataset.tab === 'people' && UI.tab === 'people') UI.personSel = null; setTab(t.dataset.tab); renderPanelBody(true); }));
  $('pBody').addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.vk) { if (d.open) VOICE_OPEN.add(d.dataset.vk); else VOICE_OPEN.delete(d.dataset.vk); } }, true);
  $('pBody').addEventListener('click', e => {
    const cp = e.target.closest('[data-copy]'); if (cp) { voiceCopy(cp.dataset.copy); return; }
    if (e.target.closest('[data-voiceset]')) { openAISettings(); return; }
    if (e.target.closest('[data-back]')) { UI.personSel = null; renderPanelBody(true); return; }
    const fo = e.target.closest('[data-follow]');
    if (fo) { toast(camFollow(+fo.dataset.follow) ? 'Following them around for a bit.' : 'They’re indoors just now. Try again in a moment.'); return; }
    const pe = e.target.closest('[data-pid]');
    if (pe) { UI.panelHover = null; $('tip').style.opacity = 0; UI.personSel = +pe.dataset.pid; renderPanelBody(true); $('pBody').scrollTop = 0; return; }
    const el = e.target.closest('[data-x]'); if (!el) return;
    camLook(+el.dataset.x, +el.dataset.y, 3);
  });
  $('pBody').addEventListener('mouseover', e => {
    const pe = e.target.closest('[data-pid]'); if (!pe) return;
    const p = S.P[+pe.dataset.pid]; if (!p || p.id === UI.personSel) return;
    UI.panelHover = p.id; showPersonTip(p, e.clientX, e.clientY, true);
  });
  $('pBody').addEventListener('mouseout', e => {
    const pe = e.target.closest('[data-pid]');
    if (pe && !pe.contains(e.relatedTarget)) { UI.panelHover = null; $('tip').style.opacity = 0; }
  });
  $('bFolder').addEventListener('click', () => CLOUD.on ? cloudLoadFile(false) : (FOLDER.h && !FOLDER.ok) ? reconnectFolder() : connectFolder(false));
  $('pace').addEventListener('change', e => { S.settings.pace = e.target.value; });
  $('optCap').addEventListener('change', e => { S.settings.captions = e.target.checked; if (!e.target.checked) DYN.caps.length = 0; });
  $('optSky').addEventListener('change', e => { S.settings.sky = e.target.value; relightNow(); });
  $('optWx').addEventListener('change', e => { S.settings.weather = e.target.checked; relightNow(); });
  $('optSh').addEventListener('change', e => { S.settings.shadows = e.target.checked; relightNow(); });
  $('optGfx').addEventListener('change', e => { setGfx(e.target.value === 'lite'); $('optSh').disabled = GL3.lite; }); // (kept in this browser, not the world)
  $('bHelp').addEventListener('click', () => $('help').classList.add('show'));
  $('hClose').addEventListener('click', () => $('help').classList.remove('show'));
  $('bNew').addEventListener('click', openWorlds);
  $('cNo').addEventListener('click', () => $('confirm').classList.remove('show'));
  $('banner').addEventListener('click', () => reconnectFolder());
}
function confirmBox(title, text, yes) {
  $('cTitle').textContent = title; $('cText').textContent = text; $('confirm').classList.add('show'); $('cSize').hidden = true;
  $('cYes').onclick = () => { $('confirm').classList.remove('show'); yes(); };
}
// how big a new world is: a valley (64 tiles a side, as it always was) or wide lands (128: four times the ground, more towns, and more for the PC to draw)
const SIZE_OPTS = [[64, 'A valley', '64 × 64 tiles'], [128, 'Wide lands', '128 × 128: four times the ground, heavier on the PC']];
function sizeRow(el) {
  if (!UI.newSize) UI.newSize = W;
  el.innerHTML = SIZE_OPTS.map(([n, a, b]) => `<button class="btn${n === UI.newSize ? ' sel' : ''}" data-size="${n}">${a}<small>${b}</small></button>`).join(''); el.hidden = false;
  el.querySelectorAll('[data-size]').forEach(b => b.onclick = () => { UI.newSize = +b.dataset.size; el.querySelectorAll('[data-size]').forEach(x => x.classList.toggle('sel', x === b)); });
}
function togglePanel() { UI.panel = !UI.panel; document.body.classList.toggle('panel', UI.panel); if (UI.panel) { renderPanel(true); } }
function selectTool(k) {
  if (!S || S.flags.intro) return;
  if (k === 'speak') { openSpeak(); return; }
  if (!toolReady(k)) { toast(`${TOOL_INFO[k][0]} takes ${COST[k]} ✨ Reverence. You have ${Math.floor(S.rev)}; it gathers while the world is on screen.`); return; }
  UI.tool = UI.tool === k ? null : k;
  document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.toggle('sel', b.dataset.tool === UI.tool));
  document.body.classList.toggle('targeting', !!UI.tool);
  if (UI.tool) toast(`${TOOL_INFO[k][0]}: click somewhere on the world. Esc to cancel.`);
}
function onKey(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
  const k = e.key;
  if (k === 'c' || k === 'C') togglePanel();
  else if (k === 'w' || k === 'W') clearSkies();
  else if (k === 'b' || k === 'B') { setBar(!TB.on); toast(TB.on ? 'Town bar on: the town you’re looking at, up top. B hides it.' : 'Town bar hidden. B brings it back.'); }
  else if (k === 'h' || k === 'H' || k === '?') $('help').classList.toggle('show');
  else if (k === 'z' || k === 'Z') { UI.zones = !UI.zones; toast(UI.zones ? 'Zone view: blue market quarters, green homes, yellow works, teal greens. The towns draw these themselves. Z again to hide.' : 'Zone view off.'); }
  else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { }); else document.exitFullscreen(); }
  else if (k === ' ') { UI.paused = !UI.paused; document.body.classList.toggle('paused', UI.paused); e.preventDefault(); }
  else if (k >= '1' && k <= '6') selectTool(['rain', 'drop', 'inspire', 'starfall', 'bloom', 'speak'][+k - 1]);
  else if (k === 'Escape') {
    if (UI.tool) selectTool(UI.tool);
    else if ($('help').classList.contains('show')) $('help').classList.remove('show');
    else if ($('confirm').classList.contains('show')) $('confirm').classList.remove('show');
    else if ($('away').classList.contains('show')) $('away').classList.remove('show');
    else if ($('worlds').classList.contains('show')) $('worlds').classList.remove('show');
    else if ($('aiset').classList.contains('show')) $('aiset').classList.remove('show');
    else if ($('answer').classList.contains('show')) $('answer').classList.remove('show');
    else if ($('speak').classList.contains('show')) $('speak').classList.remove('show');
    else if (UI.panel) togglePanel();
  }
  else if (k === 'Home' || k === '0') { if (GL3.gl) { GL3.cam.auto = true; GL3.film = true; GL3.follow = GL3.userFollow = null; GL3.lastIn = 0; } toast('Camera handed back to the film camera.'); }
  else if (k === '+' || k === '=') { if (GL3.gl) { GL3.cam.zoom = clamp(GL3.cam.zoom / 1.25, 1.2, 44); glTouch(); } }
  else if (k === '-') { if (GL3.gl) { GL3.cam.zoom = clamp(GL3.cam.zoom * 1.25, 1.2, 44); glTouch(); } }
  else if (k === 'D' && e.shiftKey) toggleDebug();
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 3500); }

function tipFor(i) {
  const x = i % W, y = (i / W) | 0;
  const T = ownerOf(x, y); const inT = T && dist(x, y, T.x, T.y) <= townRadius(T) + 1.5;
  const bid = M.bld[i]; const B = bid ? S.B[bid] : null;
  let h = '';
  if (B && !B.hid) {
    const st = S.styles[B.style];
    let name = B.type === 'house' ? (B.mat && B.prog >= 1 ? cap1(MAT[B.mat].n) + ' ' + HT[B.tier].n.toLowerCase() : HT[B.tier].n) : B.name || BT[B.type].n;
    if (B.type === 'shops') name = SHOP_N[B.sub || 0];
    if (B.type === 'house' && B.prog >= 1 && houseJoin(B)) name += B.tier === 5 ? ' (part of a block)' : ' (in a terrace)';
    if (B.type === 'farm') name = `Fields of ${CROPS[(S.T[B.sid] || { crop: 0 }).crop].n}`;
    if (B.type === 'plaza') name = `${(S.T[B.sid] || {}).name || 'Town'} square`;
    h = `<b>${esc(name)}</b>${S.T[B.sid] && B.type !== 'plaza' ? ' · ' + esc(S.T[B.sid].name) : ''}<br><small>`;
    if (B.type === 'pod') h += `Landed in Year 0. Nobody would dream of moving it.${S.T[B.sid] && S.T[B.sid].res && S.T[B.sid].id === 1 && !Object.values(S.B).some(o => o.type === 'plaza' && o.sid === 1) ? '<br>' + stockLine(S.T[B.sid]) : ''}`;
    else if (B.prog < 1) {
      const T = S.T[B.sid], c = B.cost || {}, lack = T && T.res ? Object.keys(c).find(r => T.res[r] < c[r] * .05) : null;
      h += `${B.up != null ? 'Rebuilding as ' + (B.mat ? MAT[B.mat].n + ' ' : '') + HT[B.up].n.toLowerCase() : 'Under construction' + (B.mat ? ' in ' + MAT[B.mat].n : '')} · ${Math.round(B.prog * 100)}%${lack ? ` · short of ${RES_N[lack]}, going slowly` : ''}`;
    } else {
      h += `${st ? st.name + ' style · ' : ''}${B.mat && B.type !== 'house' ? MAT[B.mat].n + ' · ' : ''}built Year ${B.built}`;
      if (zoneAt(i)) h += ` · ${ZONE_N[zoneAt(i)]}`;
      const ex = EX_INFO[B.type], T = S.T[B.sid];
      if (ex) { const out = ex.out * toolsK() * (B.ef || .5), q = B.ef || .5; h += `<br>${RES_IC[EXTRACT[B.type]]} about ${fmt1(out)} ${RES_N[EXTRACT[B.type]]} a year${B.type === 'mine' ? ', and some stone' : ''} · ${({ lumber: ['thick forest', 'thinning woods', 'few trees left'], quarry: ['good stone', 'fair stone', 'poor stone'], claypit: ['good clay', 'fair clay', 'thin clay'], mine: ['a rich seam', 'a fair seam', 'a thin seam'], pasture: ['lush grazing', 'fair grazing', 'thin grazing'], sandpit: ['fine sand', 'fair sand', 'gritty sand'] })[B.type][q > .7 ? 0 : q > .4 ? 1 : 2]}${B.type === 'pasture' ? ' · the wool feeds a weaver' : B.type === 'sandpit' ? ' · the sand feeds a glassworks' : ''}`; }
      else if (CRAFT[B.type]) { const [r, n, feed] = CRAFT[B.type], own = T && econCache(T).n[feed]; h += `<br>${RES_IC[r]} makes about ${fmt1(n * toolsK() * (own ? 1 : .4))} ${RES_N[r]} a year${own ? '' : ` (no ${BT[feed].n.toLowerCase()} of its own, so it buys some in)`}`; }
      else if (MAKERS[B.type]) h += `<br>📦 makes about ${fmt1(MAKERS[B.type] * toolsK() * (POWER_USE[B.type] ? gridK() : 1))} goods a year${B.type === 'fusion' ? ', and as much metal' : ''}`;
      const nt = needTip(B); if (nt) h += `<br>${nt}`;
      if (B.type === 'plaza' && T && T.res) h += `<br>${stockLine(T)}`;
    }
    h += '</small>';
  } else {
    const w = M.water[i];
    h = `<b>${w === 1 ? (M.bio[i] === BIO.FRESH ? 'Lake' : 'Sea') : w === 2 ? 'River' : BIO_NAME[M.bio[i]]}</b>`;
    const extra = [];
    if (M.tree[i]) extra.push(TREE_NAME[M.ttype[i]] || 'Trees');
    if (M.ruin[i]) extra.push(M.ruin[i] === 2 ? 'Maker ruins (studied)' : 'Maker ruins');
    if (springAt(i)) extra.push('a hot spring');
    if (M.road[i]) extra.push(w ? (rcls(i) >= 3 ? 'stone bridge' : 'bridge') : R_NAME[M.road[i]] || 'road');
    if (M.rail[i]) extra.push('railway');
    if (M.road[i] && tramMap().has(i)) extra.push('tramline');
    if (M.wild[i] === 2) extra.push('starfall crater');
    if (M.wild[i] === 3 && !M.tree[i]) extra.push('tree stumps');
    if (inT) extra.push('near ' + esc(T.name));
    if (extra.length) h += `<br><small>${extra.join(' · ')}</small>`;
  }
  return h;
}
const cap1 = s => s[0].toUpperCase() + s.slice(1);
const fmt1 = n => n >= 10 ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '');
function stockLine(T) { return RES.filter(r => resOpen(r) || T.res[r] >= 1).map(r => `${RES_IC[r]} ${Math.floor(T.res[r])}`).join(' &nbsp;'); }
/* ---------- the Towns tab: what each town is like, what it has, what it's built of ---------- */
const SECT = { farming: ['#7fbf6a', 'farming'], crafts: ['#d2a24c', 'crafts'], industry: ['#7d8793', 'industry'], learning: ['#5b9bd5', 'learning'], faith: ['#a38bd0', 'faith'], trade: ['#e0874f', 'trade'] };
const MAT_COL = { wood: '#a0714a', stone: '#bdb6a8', adobe: '#e0c49a', brick: '#b8684f', modern: '#9fb3c8', old: '#d9d2c5', foil: '#dfe3ea' };
const MAT_WORD = { wood: 'timber', stone: 'stone', adobe: 'adobe', brick: 'brick', modern: 'concrete & glass', old: 'older styles', foil: 'pod foil' };
function sectorBar(sc) {
  const ks = Object.keys(sc).filter(k => sc[k] > .005).sort((a, b) => sc[b] - sc[a]);
  const bar = ks.map(k => `<i style="width:${(sc[k] * 100).toFixed(1)}%;background:${SECT[k][0]}" title="${SECT[k][1]} ${Math.round(sc[k] * 100)}%"></i>`).join('');
  const lab = !ks.length ? 'Just getting started' : sc[ks[0]] > .55 ? `Mostly ${SECT[ks[0]][1]}` : `Mostly ${SECT[ks[0]][1]}, some ${SECT[ks[1]] ? SECT[ks[1]][1] : ''}`;
  return `<div class="sect">${bar}</div><div class="slab">${lab}${ks.length > 2 ? ` · ${ks.slice(2, 4).map(k => SECT[k][1]).join(', ')}` : ''}</div>`;
}
function matBar(n, t) {
  if (!t) return '';
  const ks = Object.keys(n).sort((a, b) => n[b] - n[a]);
  return `<div class="sect thin">${ks.map(k => `<i style="width:${(n[k] / t * 100).toFixed(1)}%;background:${MAT_COL[k]}"></i>`).join('')}</div><div class="slab">Built of ${ks.slice(0, 3).map(k => `${MAT_WORD[k]} ${Math.round(n[k] / t * 100)}%`).join(' · ')}</div>`;
}
function renderTownsTab() {
  const ts = towns().sort((a, b) => b.pop - a.pop);
  let h = '';
  // the whole valley
  const tot = {}, fl = {}, mn = {}; let mt = 0;
  for (const T of ts) { if (!T.res) continue; for (const r of RES) { tot[r] = (tot[r] || 0) + T.res[r]; fl[r] = (fl[r] || 0) + (T.flow[r] || 0); } const [n, t] = townMats(T); for (const k in n) mn[k] = (mn[k] || 0) + n[k]; mt += t; }
  const recent = S.trade ? S.trade.log.filter(e => e.y >= yr() - 25) : [];
  const exIc = {}; for (const B of Object.values(S.B)) if (EXTRACT[B.type] && B.prog >= 1) exIc[B.type] = (exIc[B.type] || 0) + 1;
  const EXN = { lumber: ['woodcutters’ camp', 'woodcutters’ camps'], quarry: ['quarry', 'quarries'], claypit: ['clay pit', 'clay pits'], mine: ['mine', 'mines'], pasture: ['pasture', 'pastures'], sandpit: ['sand pit', 'sand pits'] };
  const exTxt = Object.entries(exIc).map(([k, v]) => `${v} ${EXN[k][v > 1 ? 1 : 0]}`).join(' · ');
  h += `<div class="tcard valley"><div class="th"><b>The valley’s stores</b><span></span></div>
    <div class="stock">${RES.map(r => `<div class="${resOpen(r) ? '' : 'off'}"><span>${RES_IC[r]}</span> <b>${fmtInt(tot[r] || 0)}</b><em>${resOpen(r) ? '+' + fmt1(fl[r] || 0) + '/yr' : 'not yet'}</em></div>`).join('')}</div>
    ${matBar(mn, mt)}<div class="slab">${exTxt || 'Nobody is cutting or digging anything yet.'}${recent.length ? ` · ${recent.length} trade run${recent.length > 1 ? 's' : ''} in the last 25 years` : ''}</div></div>`;
  for (const T of ts) {
    const L = person(T.leader);
    h += `<div class="tcard"><div class="th town0" data-x="${T.x}" data-y="${T.y}"><span><b>${esc(T.name)}</b><br><small>founded Year ${T.founded}${L && L.died === null ? ' · ' + titleFor() + ' ' + esc(L.name) : ''} · grows ${CROPS[T.crop].n}</small></span><span>${fmtInt(T.pop)}</span></div>`;
    const kn = T.known ? Object.keys(T.known) : [];
    if (kn.length) h += `<div class="known">Known for ${kn.map(r => KNOWN_FOR[r][0]).join(' and ')}</div>`;
    h += sectorBar(townSectors(T)) + needsRow(T);
    if (T.res) {
      const cap = econCap(T);
      h += `<div class="stock">${RES.map(r => {
        const open = resOpen(r) || T.res[r] >= 1, sh = T.short[r] > 1.5, f = T.flow[r] || 0;
        return `<div class="${open ? '' : 'off'}${sh ? ' short' : ''}" title="${RES_N[r]}: ${Math.floor(T.res[r])} of ${cap} · makes ${fmt1(f)} a year, building used about ${fmt1((T.use || {})[r] || 0)} a year"><span>${RES_IC[r]}</span> <b>${Math.floor(T.res[r])}</b><i><u style="width:${clamp(T.res[r] / cap * 100, 0, 100).toFixed(0)}%;background:${RES_COL[r]}"></u></i><em>${!open ? 'not yet' : sh ? 'short' : f >= .05 ? '+' + fmt1(f) + '/yr' : 'none made'}</em></div>`;
      }).join('')}</div>`;
      const [n, t] = townMats(T); h += matBar(n, t);
    }
    h += '</div>';
  }
  if (S.accord) h += `<p style="font-size:12px;color:var(--ink2)">Bound by the ${esc(S.accord)} Accord.</p>`;
  return h;
}
function showPersonTip(p, mx, my, fromPanel) {
  const tip = $('tip');
  tip.classList.add('wide');
  if (UI.tipPid !== p.id || performance.now() - (UI.tipPT || 0) > 1500) { tip.innerHTML = personCard(p, false); UI.tipPid = p.id; UI.tipPT = performance.now(); }
  const w = tip.offsetWidth || 330, h = tip.offsetHeight || 380;
  let x = fromPanel ? innerWidth - 390 - w - 14 : mx + 18, y = my - (fromPanel ? 40 : -16);
  if (!fromPanel && x + w > innerWidth - 10) x = mx - w - 18;
  y = clamp(y, 10, innerHeight - h - 10);
  tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1;
}
function setTab(t) { UI.tab = t; document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.tab === t)); }
function openPerson(pid) {
  UI.personSel = pid; setTab('people');
  if (!UI.panel) togglePanel(); else renderPanelBody(true);
}

function eraName() { return S.age ? S.age.name : ERAS[S.era].title; }
function renderHUD() {
  renderBar();
  $('hudName').textContent = S.planet || 'Unnamed world';
  $('hudLine').textContent = `Year ${yr()} · ${eraName()} · ${fmtInt(totalPop())} ${Math.round(totalPop()) === 1 ? 'person' : 'people'}${skyIcon()}`;
  const idle = performance.now() - UI.lastMove;
  if (idle > 3000) document.body.classList.remove('active');
  if (idle > 5000 && !UI.panel && !UI.tool && !document.querySelector('.modal.show')) document.body.classList.add('nocursor');
}
function renderTools() {
  document.querySelectorAll('.tool[data-tool]').forEach(b => {
    const k = b.dataset.tool, cd = b.querySelector('.cd');
    const miss = clamp(1 - (S.rev || 0) / COST[k], 0, 1);
    cd.style.transform = `scaleY(${miss})`;
    b.classList.toggle('off', miss > 0);
  });
}
function renderPanel(force) {
  if (!UI.panel) return;
  $('pName').textContent = S.planet || 'Unnamed world';
  $('pSub').textContent = `Year ${yr()} · ${eraName()}`;
  $('sPop').textContent = fmtInt(totalPop());
  $('sTowns').textContent = towns().length;
  $('sTech').textContent = Object.keys(S.tech.done).length + (S.age ? '+' : '/' + TECHS.length);
  $('sBld').textContent = fmtInt(Object.keys(S.B).length);
  const r = $('research');
  if (S.tech.cur < TECHS.length) { const t = TECHS[S.tech.cur]; const f = clamp(S.tech.pts / techCost(S.tech.cur), 0, 1); r.innerHTML = `Working on <b>${t.name}</b><div class="bar"><i style="width:${(f * 100).toFixed(1)}%"></i></div>`; }
  else r.innerHTML = S.age ? `${esc(S.age.name)} · ${yr() - S.age.start} years in · building in the ${esc(S.styles[S.styleIdx].name)} style` : 'Every idea in the Archive has been found.';
  drawSpark();
  renderFolderStatus();
  if (force) renderPanelBody(true);
  else if (UI.tab === 'people') { if (UIDIRTY.people && !UI.panelHover) { UIDIRTY.people = false; renderPanelBody(false); } }
  else if (UI.tab === 'voice') { if (UIDIRTY.voice) { UIDIRTY.voice = false; renderPanelBody(false); } }
  else if (UI.tab === 'towns') { const now = performance.now(); if (now - (UI.townsT || 0) > 3000 || UIDIRTY.lore) { UI.townsT = now; renderPanelBody(false); } }
  else if (UIDIRTY.chron || UIDIRTY.lore) renderPanelBody(false);
}
function drawSpark() {
  const cv = $('spark'), c = cv.getContext('2d'), w = cv.width, h = cv.height;
  c.clearRect(0, 0, w, h);
  const d = S.hist; if (d.length < 2) return;
  let mx = 1; for (const p of d) mx = Math.max(mx, p[1]);
  const lg = v => Math.log10(1 + v) / Math.log10(1 + mx);
  c.beginPath();
  d.forEach((p, k) => { const x = k / (d.length - 1) * (w - 4) + 2, y = h - 6 - lg(p[1]) * (h - 16); k ? c.lineTo(x, y) : c.moveTo(x, y); });
  c.strokeStyle = '#2f8a82'; c.lineWidth = 3; c.stroke();
  c.lineTo(w - 2, h); c.lineTo(2, h); c.closePath(); c.fillStyle = 'rgba(47,138,130,.12)'; c.fill();
  c.fillStyle = '#6d6676'; c.font = '20px Segoe UI, sans-serif'; c.fillText('population (log)', 6, 22);
}
function esc(s) { return String(s).replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[m]); }
function renderPanelBody(force) {
  UIDIRTY.chron = false; UIDIRTY.lore = false;
  const b = $('pBody');
  let h = '';
  if (UI.tab === 'chron') {
    const list = S.chron.slice(-250).reverse();
    for (const e of list) {
      if (e.k === 'era') { h += `<div class="ev era">${esc(e.t)} <span style="font-size:12px;color:var(--ink3);font-family:inherit">from Year ${e.yr}</span></div>`; continue; }
      const loc = e.tx != null ? ` loc" data-x="${e.tx}" data-y="${e.ty}` : '';
      h += `<div class="ev${e.k === 'major' ? ' major' : ''}${loc}"><span class="y">Y ${e.yr}</span><span class="i">${e.ic}</span><span>${esc(e.t)}</span></div>`;
    }
  } else if (UI.tab === 'towns') {
    h += renderTownsTab();
    if (S.accord) h += `<p style="font-size:12px;color:var(--ink2)">Bound by the ${esc(S.accord)} Accord.</p>`;
  } else if (UI.tab === 'voice') {
    h = renderVoiceTab();
  } else if (UI.tab === 'people') {
    const sel = UI.personSel && S.P[UI.personSel];
    if (sel) {
      const w = DYN.walkers.find(w => w.pid === sel.id);
      h += `<div class="pback"><a data-back="1">← Everyone</a>${w ? `<a data-follow="${sel.id}">Show on map</a>` : ''}</div><div class="pd">${personCard(sel, true)}</div>`;
    } else {
      const L = living();
      h += `<div class="phint">${L.length} people you know by name. Hover for details, click to open. On the map they wear a little diamond: <span style="color:#e0a63a">◆</span> leaders, <span style="color:#5cb86a">◆</span> the Founder’s line.</div>`;
      for (const T of towns().sort((a, b) => b.pop - a.pop)) {
        const ps = L.filter(p => p.sid === T.id).sort((a, b) => notableScore(b) - notableScore(a));
        if (!ps.length) continue;
        h += `<div class="pgrp">${esc(T.name)} <small>${ps.length}</small></div>` + ps.map(personRow).join('');
      }
      const dead = Object.values(S.P).filter(p => p.died !== null && (p.deeds.length || p.id === S.founder || (p.fl != null && p.fl <= 3) || (p.roles && p.roles.includes('leader')))).sort((a, b) => b.died - a.died).slice(0, 40);
      if (dead.length) h += `<div class="pgrp">Remembered</div>` + dead.map(personRow).join('');
    }
  } else {
    h += `<div class="person"><b>The Makers</b><small>${S.lore}/${LORE.length} fragments understood</small></div>`;
    for (let k = 0; k < S.lore; k++) h += `<div class="person"><b>${esc(LORE[k].h)}</b><small>${esc(LORE[k].t)}</small></div>`;
    if (S.lore < LORE.length) h += `<div class="person"><small>Somewhere in the valley, old stones are still waiting.</small></div>`;
    h += `<div class="person"><b>The Watcher</b><small>${S.omens ? S.omens + ' sign' + (S.omens > 1 ? 's' : '') + ' since Landfall.' : 'Nobody has seen a sign yet.'}</small></div>`;
    const docs = (S.doctrines || []).slice().reverse();
    const cu = customsList();
    if (cu.length) h += `<div class="pgrp">Customs in force</div>` + cu.map(([k, v]) => `<div class="person"><b>${esc(k)}</b><small>${esc(v)}</small></div>`).join('');
    if (docs.length) h += `<div class="pgrp">The Watcher’s Words</div>` + docs.map(d => `<div class="person doc"><b>${esc(d.name)}</b><q>${esc(d.words)}</q><small>${esc(d.summary)}</small><small class="dm">Spoken Year ${d.yr} · ${d.str >= .7 ? 'held dear' : d.str >= .35 ? 'still honoured' : d.str >= .15 ? 'fading' : 'mostly forgotten'}${d.ai ? '' : ' · not understood'}</small></div>`).join('');
    else h += `<div class="person"><small>Press <kbd>6</kbd> to speak to your people.</small></div>`;
    if (S.moons) h += `<div class="person"><b>Moons</b><small>${esc(S.moons.join(' and '))}</small></div>`;
    h += `<div class="person"><b>Building style</b><small>${esc(S.styles[S.styleIdx].name)} · ${S.styles.length} styles so far</small></div>`;
    if (!UI.names || UI.names.k !== S.styleIdx) { const a = []; for (let k = 0; k < 3; k++) a.push(placeName(S.lang)); UI.names = { k: S.styleIdx, a }; } const samples = UI.names.a;
    h += `<div class="person"><b>How names sound now</b><small>${esc(samples.join(', '))}</small></div>`;
    h += `<div class="person"><b>World seed</b><small>${S.seed}</small></div>`;
  }
  const keep = b.scrollTop;
  b.innerHTML = h;
  if (!force) b.scrollTop = keep;
}

/* ---------- the town bar (top middle, Anno-style): the town you're looking at ---------- */
// Its stores and what each gains (or loses) a year, its people, room and food, how its needs are met, its leader's
// initials on a badge in the town's colour, and its name on a plaque with a title (what it's known for and how big it
// is). It follows the camera: whichever town is nearest the middle of the view. Per browser (localStorage sfBar), B toggles.
const TB = { on: true, sel: null, k: '' };
try { TB.on = localStorage.getItem('sfBar') !== '0'; } catch (e) { }
function setBar(on) { TB.on = on; try { localStorage.setItem('sfBar', on ? '1' : '0'); } catch (e) { } document.body.classList.toggle('tbar', on); const c = $('optBar'); if (c) c.checked = on; }
const TB_COL = ['#5b7fa6', '#7a9a5a', '#a0645a', '#8a6aa0', '#5a9a96', '#b08a4a', '#9a5a7a', '#6a7a8a'];
const TB_SIZE = [[60, 'Camp'], [300, 'Hamlet'], [1500, 'Village'], [6000, 'Town'], [20000, 'City'], [1e12, 'Metropolis']];
const TB_ADJ = { wood: 'Timber', stone: 'Stone', clay: 'Brick', metal: 'Iron', goods: 'Market', cloth: 'Weaving', glass: 'Glassblowing' };
function townTitle(T) {
  const size = TB_SIZE.find(([n]) => T.pop < n)[1], kn = T.known ? Object.keys(T.known) : [], big = towns().every(U => U === T || U.pop <= T.pop);
  const adj = kn.length ? TB_ADJ[kn[0]] : townHarbour(T) ? 'Harbour' : T.pop < 60 ? 'Pioneer' : M.elev[idx(T.x, T.y)] >= 6 ? 'Hill' : natWater(T) > .2 ? 'River' : 'Quiet';
  return `${adj} ${size}${big && towns().length > 1 ? ' · Capital' : ''}`;
}
function barTown() {
  const ts = towns(); if (!ts.length) return null;
  if (GL3 && GL3.cam && GL3.gl) return nearestTown(GL3.cam.tx, GL3.cam.tz);
  return (TB.sel && S.T[TB.sel] && ts.includes(S.T[TB.sel])) ? S.T[TB.sel] : ts.sort((a, b) => b.pop - a.pop)[0];
}
function barStep(d) { const ts = towns().sort((a, b) => b.pop - a.pop); if (!ts.length) return; const T = barTown(), k = Math.max(0, ts.indexOf(T)); const N = ts[(k + d + ts.length) % ts.length]; TB.sel = N.id; if (GL3 && GL3.gl) { GL3.town = ts.indexOf(N); GL3.follow = GL3.goto = null; glTouch(); glFocusTown(); } renderBar(true); }
function renderBar(force) {
  document.body.classList.toggle('tbar', TB.on && !!S && towns().length > 0); if (!TB.on || !S) return;
  const T = barTown(); if (!T) return;
  const L = person(T.leader), ini = L ? L.name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() : '·';
  const v = needsOf(T), cap = T.res ? econCap(T) : 0;
  const r1 = T.res ? RES.filter(r => resOpen(r) || T.res[r] >= 1).map(r => { const net = (T.flow[r] || 0) - ((T.use || {})[r] || 0), sh = (T.short || {})[r] > 1.5;
    return `<span class="${sh ? 'short' : ''}" title="${cap1(RES_N[r])}: ${Math.floor(T.res[r])} in store (room for ${cap}) · makes ${fmt1(T.flow[r] || 0)} a year, building uses about ${fmt1((T.use || {})[r] || 0)}${sh ? ' · running short' : ''}">${RES_IC[r]} <b>${fmtInt(Math.floor(T.res[r]))}</b><em class="${net < -.05 ? 'neg' : ''}">${Math.abs(net) < .05 ? '±0' : (net > 0 ? '+' : '−') + fmt1(Math.abs(net))}/yr</em></span>`; }).join('') : '';
  const nd = NEEDS.filter(n => v[n.k] != null).map(n => { const x = v[n.k]; return `<span class="${x < .55 ? 'low' : x < .9 ? 'mid' : ''}" title="${esc(cap1(n.n))}: ${Math.round(x * 100)}% met">${n.ic}${Math.round(x * 100)}%</span>`; }).join(' ');
  const r2 = `<span title="People">👥 ${fmtInt(T.pop)}</span> <span title="Homes for this many">🏠 ${fmtInt(T.cap.house)}</span> <span class="${T.cap.food < T.pop ? 'low' : ''}" title="Food for this many">🍞 ${fmtInt(T.cap.food)}</span>${nd ? ' · ' + nd : ''}`;
  const pl = `<b>${esc(T.name)}</b><small>${esc(townTitle(T))}${L && L.died === null ? ' · ' + cap1(titleFor()) + ' ' + esc(L.name) : ''}</small>`;
  const key = T.id + '|' + r1 + r2 + pl; if (!force && key === TB.k) return; TB.k = key;
  const P = $('tbP'); P.textContent = ini; P.style.background = T.color || TB_COL[T.id % TB_COL.length]; P.title = L ? `${cap1(titleFor())} ${L.name}` : '';
  $('tbR1').innerHTML = r1; $('tbR2').innerHTML = r2; $('tbPl').innerHTML = pl;
}
