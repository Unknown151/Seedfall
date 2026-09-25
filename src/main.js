/* ============================== main ============================== */
const QS = new URLSearchParams(location.search);
const DEV = QS.has('dev');
let RUNNING = false, lastT = 0, simAcc = 0, frameN = 0, uiT = 0, fpsN = 0, fpsT = 0;
const PACE = { relaxed: 300, normal: 180, brisk: 60, preview: 4 };
function randSeed() { return (Math.random() * 1e9) | 0; }

function startWorld(isNew) {
  M = S.map;
  DYN.walkers.length = 0; DYN.vehicles.length = 0; DYN.trains.length = 0; DYN.boats.length = 0; DYN.ships.length = 0; DYN.ferries.length = 0; DYN.planes.length = 0; DYN.slot = {}; DYN.af = {}; DYN.herds.length = 0; DYN.caps.length = 0; DYN.parts.length = 0;
  for (const T of towns()) recalcTown(T);
  updateSoot(false);
  renderAll();
  $('pace').value = S.settings.pace; $('optCap').checked = S.settings.captions;
  $('optSky').value = S.settings.sky; $('optWx').checked = S.settings.weather; $('optSh').checked = S.settings.shadows;
  if (isNew && S.flags.intro) startIntro();
  else { const [x, y, z] = overviewTarget(); CAM.x = CAM.tx = x; CAM.y = CAM.ty = y; CAM.z = CAM.tz = z; CAM.nextTour = DYN.t + 20; }
  syncWalkers();
  UIDIRTY.chron = UIDIRTY.stats = UIDIRTY.tools = true;
  UIDIRTY.prayers = true; FAITH.shown = '';
  renderHUD(); renderTools(); renderFolderStatus(); faithRecalc(); renderFaith();
  if (!RUNNING) { RUNNING = true; requestAnimationFrame(frame); }
}
async function newWorld(seed, archive) {
  if (archive && S && FOLDER.ok) { S.savedAt = Date.now(); await archiveFolderWorld(serialize()); }
  newState(seed);
  const pod = Object.values(S.B).find(B => B.type === 'pod'); if (pod) pod.hid = 1;
  startWorld(true);
  saveAll();
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!lastT) lastT = now;
  let dt = (now - lastT) / 1000;
  if (dt < 1 / 26) return;
  lastT = now; dt = Math.min(dt, .25);
  // a long gap between frames (tab hidden, PC locked or asleep, or a save opened after a while) is time away
  if (!document.hidden && !CATCH) { const last = S.lastLive || S.savedAt; if (last && Date.now() - last > AWAY_MIN * 1000) maybeCatchUp(); S.lastLive = Date.now(); }
  if (!document.hidden && !UI.paused && !S.flags.intro && !CATCH) {
    simAcc += dt;
    const monthSec = (PACE[S.settings.pace] || 180) / 12;
    let n = 0;
    while (simAcc >= monthSec && n < 24) { simMonth(); simAcc -= monthSec; n++; }
    if (n >= 24) simAcc = 0;
    S.playSec += dt;
    stepFaith(dt);
  }
  processFX();
  if (frameN++ % 45 === 0) syncWalkers();
  updateDyn(dt);
  stepCamera(dt);
  lightTick(dt);
  flushDirty();
  drawFrame();
  updateTip();
  uiT += dt;
  if (uiT > .5) { uiT = 0; renderHUD(); renderTools(); renderFaith(); if (UI.panel) renderPanel(false); }
  if (DEV) { fpsN++; if (now - fpsT > 1000) { $('fps').textContent = `${fpsN} fps · y${S.year.toFixed(1)} · walkers ${DYN.walkers.length} · parts ${DYN.parts.length}`; fpsN = 0; fpsT = now; } }
}

/* ---------- catch-up: time away counts, but only the last 8 hours of it ---------- */
// S.lastLive is when the world was last on screen (paused counts as on screen, so a paused world stays paused).
const AWAY_CAP = 8 * 3600, AWAY_MIN = 180, CATCH_MAX_YR = 250; // seconds, seconds, years (bounds the work on brisk/preview pace)
let CATCH = null;
function fmtAway(s) { const h = Math.floor(s / 3600), m = Math.round(s % 3600 / 60); return h >= 48 ? `${Math.round(h / 24)} days` : h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`; }
function maybeCatchUp() {
  const away = (Date.now() - (S.lastLive || S.savedAt)) / 1000; // older saves have no lastLive yet
  if (CATCH || S.flags.intro || CLOUD.conflict || !(away > 0)) return;
  const secs = Math.min(away, AWAY_CAP), yrs = Math.min(CATCH_MAX_YR, secs / (PACE[S.settings.pace] || 180));
  if (yrs >= .25) catchUp(away, secs, yrs);
}
function catchUp(away, secs, yrs) {
  const n = Math.round(yrs * 12), c0 = S.chronN, y0 = yr(), p0 = Math.round(totalPop()), t0 = Object.keys(S.tech.done).length;
  CATCH = { done: 0 };
  $('awayWhen').textContent = `You were gone ${fmtAway(away)}. Catching up…`;
  $('awayLetter').textContent = ''; $('awayList').innerHTML = ''; $('away').classList.add('show');
  const step = () => {
    const t = performance.now();
    FAST = true;
    while (CATCH.done < n && performance.now() - t < 40) { simMonth(); CATCH.done++; } // in slices, so the page stays responsive
    FAST = false; FXQ.length = 0;
    if (CATCH.done < n) { $('awayWhen').textContent = `You were gone ${fmtAway(away)}. Catching up… Year ${yr()}`; return setTimeout(step, 0); }
    CATCH = null; S.lastLive = Date.now();
    syncWalkers(); faithRecalc();
    UIDIRTY.chron = UIDIRTY.stats = UIDIRTY.tools = UIDIRTY.lore = UIDIRTY.people = UIDIRTY.prayers = true;
    awayReport({ away, secs, y0, y1: yr(), p0, p1: Math.round(totalPop()), ideas: Object.keys(S.tech.done).length - t0, ev: S.chron.filter(e => e.n > c0) });
    saveAll();
  };
  setTimeout(step, 0);
}
function awayReport(d) {
  const kept = d.secs < d.away - 60 ? ` The world kept going for ${fmtAway(d.secs)} of it` : ' The world kept going';
  const bits = [`Year ${d.y0} → ${d.y1}`, d.p0 === d.p1 ? `${fmtInt(d.p1)} people` : `${fmtInt(d.p0)} → ${fmtInt(d.p1)} people`]; if (d.ideas > 0) bits.push(`${d.ideas} new idea${d.ideas > 1 ? 's' : ''}`);
  $('awayWhen').textContent = `You were gone ${fmtAway(d.away)}.${kept}: ${bits.join(' · ')}.`;
  // the highlights: every new era, then the big moments spread over the whole stretch
  const big = d.ev.filter(e => e.k === 'major' || e.k === 'era'), rest = d.ev.filter(e => !(e.k === 'major' || e.k === 'era'));
  let pick = big.filter(e => e.k === 'era');
  const pool = big.filter(e => e.k !== 'era').concat(big.length < 5 ? rest.slice(-(5 - big.length)) : []), room = Math.max(0, 8 - pick.length);
  for (let i = 0; i < Math.min(room, pool.length); i++) pick.push(pool[Math.floor(i * pool.length / Math.min(room, pool.length))]);
  pick.sort((a, b) => a.n - b.n);
  $('awayList').innerHTML = pick.length ? pick.map(e => `<li><i>Year ${e.yr}</i>${esc(e.ic)} ${esc(e.t)}</li>`).join('') : '<li>A quiet stretch. Nobody wrote much down.</li>';
  // with the voice on, a town historian writes it up (once per real absence, not for a coffee break)
  if (d.away >= 1800 && d.ev.length >= 3 && aiOn()) {
    const L = $('awayLetter'); L.className = 'away-letter wait'; L.textContent = 'The town historian is writing to you…';
    aiDigest(d).then(r => { L.className = 'away-letter'; if (r) L.innerHTML = `<b>${esc(r.title)}</b>${esc(r.letter)}`; else L.textContent = ''; });
  }
}
function bindAway() { $('awayOk').onclick = () => $('away').classList.remove('show'); }

SF.ff = function (years) {
  const wasIntro = S.flags.intro;
  if (wasIntro) { DYN.intro = null; S.flags.intro = 0; const pod = Object.values(S.B).find(B => B.type === 'pod'); if (pod) { pod.hid = 0; markDirty(idx(pod.x, pod.y)); } introChronicle(); }
  FAST = true;
  const n = Math.round(years * 12);
  for (let k = 0; k < n; k++) simMonth();
  FAST = false;
  FXQ.length = 0;
  S.lastLive = Date.now(); // a long fast-forward isn't time away
  syncWalkers();
  UIDIRTY.chron = true;
};
SF.state = () => S;
SF.save = () => saveAll();
SF.cam = CAM; SF.dyn = DYN;
SF.fx = (k, d) => { FXQ.push(Object.assign({ k }, d)); };
SF.light = LIGHT;
SF.hour = h => { LIGHT.forceHr = h; LIGHT.chk = 0; };               // dev: pin the synthetic clock (null = live)
SF.weather = (k, secs) => { setWeather(k, secs); const w = S.wx, T = WXK[k]; for (const p of ['cover', 'rain', 'snow', 'fog', 'storm']) w[p] = T[p] || 0; if (k === 'snow') w.sc = 1; LIGHT.chk = 0; };
SF.relightNow = () => { renderAll(); };
SF.pray = k => { const c = prayerCandidates().filter(x => !k || x[0] === k); if (!c.length) return false; const save = prayerCandidates; const [kk, , p, ex] = c[0]; const q = Object.assign({ id: (S.prayN = (S.prayN || 0) + 1), k: kk, pid: p.id, tid: p.sid, t0: S.playSec, exp: S.playSec + 1800, st: 'open' }, ex || {}); q.text = pick(PRAYERS[kk])(p, q); q.rw = PRAY_TOOL[kk] ? Math.round(COST[kk] * 1.5 + 8) : 20; if (kk === 'town') S.T[q.tid].asked = 1; S.prayers.push(q); UIDIRTY.prayers = true; return q; };
SF.season = s => { LIGHT.forceSeason = s ? Object.assign({ autumn: 0, winter: 0, spring: 0 }, s) : null; LIGHT.seasonT = 0; LIGHT.chk = 0; };

async function boot() {
  initView(); initStatic(); initLight(); bindUI(); bindAI(); bindFaith(); bindAway();
  if (DEV) $('fps').style.display = 'block';
  try { await IDB.open(); } catch (e) { }
  try { await aiLoad(); } catch (e) { }
  const cloud = await cloudDetect(); // served by the Worker and logged in: saves go to the cloud (file:// never is)
  if (QS.has('seed') && QS.has('fresh')) {
    newState(+QS.get('seed')); if (QS.has('nointro')) { S.flags.intro = 0; introChronicle(); } else { const pod = Object.values(S.B).find(B => B.type === 'pod'); if (pod) pod.hid = 1; } startWorld(true);
    if (cloud && !CLOUD.out) { try { const c = await cloudGet(true); CLOUD.rev = c ? c.meta.rev : null; } catch (e) { } cloudOwn(false); } // asked for a fresh world, so it replaces the cloud's
    return;
  }
  if (cloud) {
    const r = await cloudStart();
    if (r) { deserialize(r.save); startWorld(false); await cloudOwn(r.upload); return; }
  } else {
    let st = parseSave(await IDB.get('save'));
    const h = await IDB.get('dir');
    if (h && HAS_FSA) {
      FOLDER.h = h; FOLDER.name = h.name;
      let p = 'prompt'; try { p = await h.queryPermission({ mode: 'readwrite' }); } catch (e) { }
      if (p === 'granted') {
        FOLDER.ok = true;
        const fs = parseSave(await readText(h, 'save.json'));
        if (fs && (!st || (fs.state.savedAt || 0) > (st.state.savedAt || 0))) st = fs;
      } else showBanner();
    }
    if (st) { deserialize(st); startWorld(false); return; }
  }
  // first run
  const w = $('welcome'); w.classList.add('show');
  if (cloud) {
    $('wText').textContent = 'The world grows while it\'s on screen, and keeps going for up to 8 hours while you\'re away. It is saved to the cloud, so you can carry on from any browser you log in from. Already have a world? Load its save.json.';
    $('wFine').innerHTML = `World seed <input id="wSeed" spellcheck="false"> · saving to the cloud${CLOUD.email ? ' as ' + esc(CLOUD.email) : ''}.`;
    $('wSeed').value = randSeed();
    $('wFolder').textContent = 'Load a save.json…'; $('wLocal').textContent = 'Start a new world';
    $('wFolder').onclick = async () => { if (await cloudLoadFile(true)) w.classList.remove('show'); };
    $('wLocal').onclick = async () => { w.classList.remove('show'); await newWorld(+$('wSeed').value || randSeed()); cloudOwn(false); };
    return;
  }
  $('wSeed').value = randSeed();
  if (!HAS_FSA) { $('wFolder').style.display = 'none'; $('wFine').insertAdjacentHTML('afterbegin', 'This browser can’t write to folders (Edge or Chrome can), so the world will be saved in the browser. '); }
  $('wFolder').onclick = async () => {
    const fs = await connectFolder(true);
    if (fs === false) return;
    w.classList.remove('show');
    if (fs) { deserialize(fs); startWorld(false); toast(`Welcome back to ${S.planet || 'your world'}.`); }
    else { await newWorld(+$('wSeed').value || randSeed()); }
  };
  $('wLocal').onclick = () => { w.classList.remove('show'); newWorld(+$('wSeed').value || randSeed()); };
}
setInterval(() => { if (S && RUNNING) saveAll(); }, 45000);
setInterval(() => { if (S && RUNNING) aiMaybeGossip(); }, 30000);
document.addEventListener('visibilitychange', () => { if (document.hidden && S && RUNNING) saveAll('hidden'); else lastT = 0; });
addEventListener('beforeunload', () => { if (S && RUNNING && !CLOUD.conflict) { S.savedAt = Date.now(); try { IDB.set('save', JSON.stringify(serialize())); } catch (e) { } } });
boot();
</script>
</body>
</html>
