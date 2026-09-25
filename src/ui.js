/* ============================== UI ============================== */
const UI = { tool: null, panel: false, tab: 'chron', paused: false, lastMove: 0, mouse: { x: -1, y: -1 }, drag: null, lastPick: 0, tipTile: -1 };
const $ = id => document.getElementById(id);

function bindUI() {
  addEventListener('keydown', onKey);
  const v = $('view');
  addEventListener('mousemove', e => {
    UI.lastMove = performance.now(); document.body.classList.add('active'); document.body.classList.remove('nocursor');
    UI.mouse.x = e.clientX; UI.mouse.y = e.clientY;
    if (UI.drag) {
      const dx = e.clientX - UI.drag.x, dy = e.clientY - UI.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) UI.drag.moved = true;
      CAM.tx = UI.drag.cx - dx / CAM.z; CAM.ty = UI.drag.cy - dy / CAM.z; CAM.x = CAM.tx; CAM.y = CAM.ty;
      CAM.manualUntil = DYN.t + 90;
    }
  });
  v.addEventListener('mousedown', e => { if (e.button !== 0) return; UI.drag = { x: e.clientX, y: e.clientY, cx: CAM.x, cy: CAM.y, moved: false }; });
  addEventListener('mouseup', e => {
    const d = UI.drag; UI.drag = null;
    if (d && !d.moved && e.target === v) onMapClick(e.clientX, e.clientY);
  });
  v.addEventListener('wheel', e => {
    e.preventDefault();
    const [wx, wy] = s2w(e.clientX, e.clientY);
    const nz = clamp(CAM.tz * Math.pow(1.0015, -e.deltaY), minZoom(), 4);
    CAM.tz = nz; CAM.z = nz;
    const [wx2, wy2] = s2w(e.clientX, e.clientY);
    CAM.x += wx - wx2; CAM.y += wy - wy2; CAM.tx = CAM.x; CAM.ty = CAM.y;
    CAM.manualUntil = DYN.t + 90;
  }, { passive: false });
  v.addEventListener('mouseleave', () => { $('tip').style.opacity = 0; DYN.hover = -1; });
  document.querySelectorAll('.tool[data-tool]').forEach(b => {
    b.addEventListener('click', () => selectTool(b.dataset.tool));
    b.addEventListener('mouseenter', () => { const k = b.dataset.tool, [n, d] = TOOL_INFO[k]; const t = $('tip2'); t.textContent = `${n}: ${d} · ${COST[k]} ✨${toolReady(k) ? '' : ` (you have ${Math.floor(S.rev)})`}`; t.style.opacity = 1; });
    b.addEventListener('mouseleave', () => $('tip2').style.opacity = 0);
  });
  $('dockChron').addEventListener('click', togglePanel);
  $('pClose').addEventListener('click', togglePanel);
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => { if (t.dataset.tab === 'people' && UI.tab === 'people') UI.personSel = null; setTab(t.dataset.tab); renderPanelBody(true); }));
  $('pBody').addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.vk) { if (d.open) VOICE_OPEN.add(d.dataset.vk); else VOICE_OPEN.delete(d.dataset.vk); } }, true);
  $('pBody').addEventListener('click', e => {
    const cp = e.target.closest('[data-copy]'); if (cp) { voiceCopy(cp.dataset.copy); return; }
    if (e.target.closest('[data-voiceset]')) { openAISettings(); return; }
    if (e.target.closest('[data-back]')) { UI.personSel = null; renderPanelBody(true); return; }
    const fo = e.target.closest('[data-follow]');
    if (fo) { CAM.followPid = +fo.dataset.follow; CAM.followUntil = DYN.t + 45; CAM.manualUntil = 0; const fw = DYN.walkers.find(w => w.pid === CAM.followPid); if (fw && fw.st === 'in') fw.until = Math.min(fw.until, DYN.t + 1.5); toast('Following them around for a bit.'); return; }
    const pe = e.target.closest('[data-pid]');
    if (pe) { UI.panelHover = null; $('tip').style.opacity = 0; UI.personSel = +pe.dataset.pid; renderPanelBody(true); $('pBody').scrollTop = 0; return; }
    const el = e.target.closest('[data-x]'); if (!el) return;
    focusOn(+el.dataset.x, +el.dataset.y, 1.8, 30); CAM.manualUntil = 0;
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
  $('bFolder').addEventListener('click', () => (FOLDER.h && !FOLDER.ok) ? reconnectFolder() : connectFolder(false));
  $('pace').addEventListener('change', e => { S.settings.pace = e.target.value; });
  $('optCap').addEventListener('change', e => { S.settings.captions = e.target.checked; if (!e.target.checked) DYN.caps.length = 0; });
  $('optSky').addEventListener('change', e => { S.settings.sky = e.target.value; relightNow(); });
  $('optWx').addEventListener('change', e => { S.settings.weather = e.target.checked; relightNow(); });
  $('optSh').addEventListener('change', e => { S.settings.shadows = e.target.checked; relightNow(); });
  $('bHelp').addEventListener('click', () => $('help').classList.add('show'));
  $('hClose').addEventListener('click', () => $('help').classList.remove('show'));
  $('bNew').addEventListener('click', () => confirmBox('Start a new world?', `${S.planet || 'This world'} will be archived${FOLDER.ok ? ' to the worlds folder' : ''} and a new pod will fall somewhere else.`, () => newWorld(randSeed(), true)));
  $('cNo').addEventListener('click', () => $('confirm').classList.remove('show'));
  $('banner').addEventListener('click', () => reconnectFolder());
}
function confirmBox(title, text, yes) {
  $('cTitle').textContent = title; $('cText').textContent = text; $('confirm').classList.add('show');
  $('cYes').onclick = () => { $('confirm').classList.remove('show'); yes(); };
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
  else if (k === 'h' || k === 'H' || k === '?') $('help').classList.toggle('show');
  else if (k === 'f' || k === 'F') { if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => { }); else document.exitFullscreen(); }
  else if (k === ' ') { UI.paused = !UI.paused; document.body.classList.toggle('paused', UI.paused); e.preventDefault(); }
  else if (k >= '1' && k <= '6') selectTool(['rain', 'drop', 'inspire', 'starfall', 'bloom', 'speak'][+k - 1]);
  else if (k === 'Escape') {
    if (UI.tool) selectTool(UI.tool);
    else if ($('help').classList.contains('show')) $('help').classList.remove('show');
    else if ($('confirm').classList.contains('show')) $('confirm').classList.remove('show');
    else if ($('aiset').classList.contains('show')) $('aiset').classList.remove('show');
    else if ($('answer').classList.contains('show')) $('answer').classList.remove('show');
    else if ($('speak').classList.contains('show')) $('speak').classList.remove('show');
    else if (UI.panel) togglePanel();
  }
  else if (k === 'Home' || k === '0') { CAM.manualUntil = 0; CAM.focusUntil = 0; CAM.nextTour = 0; toast('Camera handed back.'); }
  else if (k === '+' || k === '=') { CAM.tz = clamp(CAM.tz * 1.25, minZoom(), 4); CAM.manualUntil = DYN.t + 90; }
  else if (k === '-') { CAM.tz = clamp(CAM.tz / 1.25, minZoom(), 4); CAM.manualUntil = DYN.t + 90; }
  else if (DEV && k === 'P') { SF.ff(50); toast('+50 years'); }
}
let toastT = 0;
function toast(t) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; clearTimeout(toastT); toastT = setTimeout(() => el.style.opacity = 0, 3500); }

function pickTile(sx, sy) {
  const [wx, wy] = s2w(sx, sy);
  for (let s = W + H - 2; s >= 0; s--) {
    const xa = Math.max(0, s - H + 1), xb = Math.min(W - 1, s);
    for (let x = xa; x <= xb; x++) {
      const i = idx(x, s - x);
      const X = (x - (s - x)) * TW2 + OX, Y = (s) * TH2 + OY - surfZ(i);
      if (Math.abs(wx - X) / 16 + Math.abs(wy - (Y + 8)) / 8 <= 1) return i;
      const b = M.bld[i];
      if (b && S.B[b] && !FLAT_TYPES[S.B[b].type] && Math.abs(wx - X) < 12 && wy < Y + 10 && wy > Y + 8 - objH(i)) return i;
    }
  }
  return -1;
}
function onMapClick(sx, sy) {
  const i = pickTile(sx, sy);
  if (i < 0 && !pickNotable(sx, sy)) return;
  const x = i % W, y = (i / W) | 0;
  if (UI.tool) {
    if (i < 0) return;
    const k = UI.tool;
    if (useTool(k, x, y)) {
      UI.tool = null; document.body.classList.remove('targeting');
      document.querySelectorAll('.tool[data-tool]').forEach(b => b.classList.remove('sel'));
      renderTools(); UIDIRTY.chron = true;
      toast(`${TOOL_INFO[k][0]} sent. The colonists noticed.`);
    }
    return;
  }
  const w = pickNotable(sx, sy);
  if (w) { openPerson(w.pid); CAM.followPid = w.pid; CAM.followUntil = DYN.t + 30; CAM.manualUntil = 0; return; }
  const T = ownerOf(x, y);
  if (T && dist(x, y, T.x, T.y) <= townRadius(T) + 1) { focusOn(x, y, 2, 40); CAM.manualUntil = DYN.t + 40; }
}
function tipFor(i) {
  const x = i % W, y = (i / W) | 0;
  const T = ownerOf(x, y); const inT = T && dist(x, y, T.x, T.y) <= townRadius(T) + 1.5;
  const bid = M.bld[i]; const B = bid ? S.B[bid] : null;
  let h = '';
  if (B && !B.hid) {
    const st = S.styles[B.style];
    let name = B.type === 'house' ? (B.mat && B.prog >= 1 ? cap1(MAT[B.mat].n) + ' ' + HT[B.tier].n.toLowerCase() : HT[B.tier].n) : B.name || BT[B.type].n;
    if (B.type === 'farm') name = `Fields of ${CROPS[(S.T[B.sid] || { crop: 0 }).crop].n}`;
    if (B.type === 'plaza') name = `${(S.T[B.sid] || {}).name || 'Town'} square`;
    h = `<b>${name}</b>${S.T[B.sid] && B.type !== 'plaza' ? ' · ' + S.T[B.sid].name : ''}<br><small>`;
    if (B.type === 'pod') h += `Landed in Year 0. Nobody would dream of moving it.${S.T[B.sid] && S.T[B.sid].res && S.T[B.sid].id === 1 && !Object.values(S.B).some(o => o.type === 'plaza' && o.sid === 1) ? '<br>' + stockLine(S.T[B.sid]) : ''}`;
    else if (B.prog < 1) {
      const T = S.T[B.sid], c = B.cost || {}, lack = T && T.res ? Object.keys(c).find(r => T.res[r] < c[r] * .05) : null;
      h += `${B.up != null ? 'Rebuilding as ' + (B.mat ? MAT[B.mat].n + ' ' : '') + HT[B.up].n.toLowerCase() : 'Under construction' + (B.mat ? ' in ' + MAT[B.mat].n : '')} · ${Math.round(B.prog * 100)}%${lack ? ` · short of ${RES_N[lack]}, going slowly` : ''}`;
    } else {
      h += `${st ? st.name + ' style · ' : ''}${B.mat && B.type !== 'house' ? MAT[B.mat].n + ' · ' : ''}built Year ${B.built}`;
      const ex = EX_INFO[B.type], T = S.T[B.sid];
      if (ex) { const out = ex.out * toolsK() * (B.ef || .5), q = B.ef || .5; h += `<br>${RES_IC[EXTRACT[B.type]]} about ${fmt1(out)} ${RES_N[EXTRACT[B.type]]} a year${B.type === 'mine' ? ', and some stone' : ''} · ${({ lumber: ['thick forest', 'thinning woods', 'few trees left'], quarry: ['good stone', 'fair stone', 'poor stone'], claypit: ['good clay', 'fair clay', 'thin clay'], mine: ['a rich seam', 'a fair seam', 'a thin seam'] })[B.type][q > .7 ? 0 : q > .4 ? 1 : 2]}`; }
      else if (MAKERS[B.type]) h += `<br>📦 makes about ${fmt1(MAKERS[B.type] * toolsK())} goods a year${B.type === 'fusion' ? ', and as much metal' : ''}`;
      if (B.type === 'plaza' && T && T.res) h += `<br>${stockLine(T)}`;
    }
    h += '</small>';
  } else {
    const w = M.water[i];
    h = `<b>${w === 1 ? (M.bio[i] === BIO.FRESH ? 'Lake' : 'Sea') : w === 2 ? 'River' : BIO_NAME[M.bio[i]]}</b>`;
    const extra = [];
    if (M.tree[i]) extra.push(TREE_NAME[M.ttype[i]] || 'Trees');
    if (M.ruin[i]) extra.push(M.ruin[i] === 2 ? 'Maker ruins (studied)' : 'Maker ruins');
    if (M.road[i]) extra.push(w ? 'bridge' : 'road');
    if (M.rail[i]) extra.push('railway');
    if (M.wild[i] === 2) extra.push('starfall crater');
    if (M.wild[i] === 3 && !M.tree[i]) extra.push('tree stumps');
    if (inT) extra.push('near ' + T.name);
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
  const EXN = { lumber: ['woodcutters’ camp', 'woodcutters’ camps'], quarry: ['quarry', 'quarries'], claypit: ['clay pit', 'clay pits'], mine: ['mine', 'mines'] };
  const exTxt = Object.entries(exIc).map(([k, v]) => `${v} ${EXN[k][v > 1 ? 1 : 0]}`).join(' · ');
  h += `<div class="tcard valley"><div class="th"><b>The valley’s stores</b><span></span></div>
    <div class="stock">${RES.map(r => `<div class="${resOpen(r) ? '' : 'off'}"><span>${RES_IC[r]}</span> <b>${fmtInt(tot[r] || 0)}</b><em>${resOpen(r) ? '+' + fmt1(fl[r] || 0) + '/yr' : 'not yet'}</em></div>`).join('')}</div>
    ${matBar(mn, mt)}<div class="slab">${exTxt || 'Nobody is cutting or digging anything yet.'}${recent.length ? ` · ${recent.length} trade run${recent.length > 1 ? 's' : ''} in the last 25 years` : ''}</div></div>`;
  for (const T of ts) {
    const L = person(T.leader);
    h += `<div class="tcard"><div class="th town0" data-x="${T.x}" data-y="${T.y}"><span><b>${esc(T.name)}</b><br><small>founded Year ${T.founded}${L && L.died === null ? ' · ' + titleFor() + ' ' + esc(L.name) : ''} · grows ${CROPS[T.crop].n}</small></span><span>${fmtInt(T.pop)}</span></div>`;
    const kn = T.known ? Object.keys(T.known) : [];
    if (kn.length) h += `<div class="known">Known for ${kn.map(r => KNOWN_FOR[r][0]).join(' and ')}</div>`;
    h += sectorBar(townSectors(T));
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
function pickNotable(sx, sy) {
  let best = null, bd = 1e9; const r = Math.max(9, CAM.z * 3.4);
  for (const w of DYN.walkers) { if (!w.pid || w.sx == null) continue; const d = Math.hypot(w.sx - sx, w.sy - sy); if (d < r && d < bd) { bd = d; best = w; } }
  return best;
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
function updateTip() {
  if (UI.panelHover) return;
  const now = performance.now();
  if (now - UI.lastPick < 90 || UI.mouse.x < 0) return;
  UI.lastPick = now;
  const tip = $('tip');
  if (now - UI.lastMove > 2500 || UI.drag || document.querySelector('.modal.show')) { tip.style.opacity = 0; DYN.hover = UI.tool ? DYN.hover : -1; return; }
  const el = document.elementFromPoint(UI.mouse.x, UI.mouse.y);
  if (el !== CV) { tip.style.opacity = 0; DYN.hoverPid = null; return; }
  const w = UI.tool ? null : pickNotable(UI.mouse.x, UI.mouse.y);
  if (w && S.P[w.pid]) { DYN.hover = -1; DYN.hoverPid = w.pid; showPersonTip(S.P[w.pid], UI.mouse.x, UI.mouse.y); UI.tipTile = -1; return; }
  DYN.hoverPid = null; tip.classList.remove('wide');
  const i = pickTile(UI.mouse.x, UI.mouse.y);
  DYN.hover = i;
  if (i < 0) { tip.style.opacity = 0; return; }
  if (i !== UI.tipTile) { tip.innerHTML = tipFor(i); UI.tipTile = i; }
  tip.style.left = Math.min(UI.mouse.x + 16, innerWidth - 290) + 'px';
  tip.style.top = Math.min(UI.mouse.y + 18, innerHeight - 60) + 'px';
  tip.style.opacity = 1;
}

function eraName() { return S.age ? S.age.name : ERAS[S.era].title; }
function renderHUD() {
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
  else r.innerHTML = S.age ? `${S.age.name} · ${yr() - S.age.start} years in · building in the ${S.styles[S.styleIdx].name} style` : 'Every idea in the Archive has been found.';
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
