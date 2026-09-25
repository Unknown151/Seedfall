/* ============================== persistence ============================== */
const IDB = {
  db: null,
  open() { return new Promise((res, rej) => { const q = indexedDB.open('seedfall', 1); q.onupgradeneeded = () => q.result.createObjectStore('kv'); q.onsuccess = () => { this.db = q.result; res(); }; q.onerror = () => rej(q.error); }); },
  get(k) { return new Promise(res => { try { const r = this.db.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => res(undefined); } catch (e) { res(undefined); } }); },
  set(k, v) { return new Promise(res => { try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); },
  del(k) { return new Promise(res => { try { const t = this.db.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = () => res(true); t.onerror = () => res(false); } catch (e) { res(false); } }); }
};
const FOLDER = { h: null, ok: false, name: '', last: 0, busy: false, err: null, lastSaveStr: '' };
const HAS_FSA = typeof window.showDirectoryPicker === 'function';

function serialize() {
  const m = {};
  for (const k of MAP_KEYS) { const a = S.map[k]; m[k] = b64enc(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); }
  const st = Object.assign({}, S, { map: m });
  return {
    seedfall: 1, planet: S.planet || 'Unnamed world', year: yr(), era: eraName(), population: Math.round(totalPop()),
    savedAt: new Date(S.savedAt).toISOString(), state: st
  };
}
function deserialize(obj) {
  const o = obj.state || obj, o0 = { map: Object.assign({}, o.map) };
  const map = newMap();
  for (const k of MAP_KEYS) if (o.map[k]) { const u8 = b64dec(o.map[k]); new Uint8Array(map[k].buffer).set(u8.subarray(0, map[k].byteLength)); }
  o.map = map;
  S = o; M = S.map;
  // migrations / defaults
  S.settings = Object.assign({ pace: 'normal', captions: true, sky: 'hour', weather: true, shadows: true }, S.settings || {});
  S.flags = S.flags || {}; S.flags.intro = 0;
  for (const k in S.B) { S.B[k].hid = 0; if (S.B[k].type === 'launchpad') S.B[k].rk = 1; }
  S.doctrines = S.doctrines || []; S.aiQueue = S.aiQueue || [];
  if (S.rev == null) S.rev = 60;
  S.prayers = (S.prayers || []).filter(q => q.st === 'open'); S.prayers.forEach(q => { if (q.st === 'busy') q.st = 'open'; }); S.prayNext = null;
  // interpretations used to be cut at 300 characters; the full text is still in the Voice log
  for (const e of S.aiLog || []) { const d = e.kind === 'words' && e.input && e.doc && S.doctrines.find(x => x.id === e.doc); if (d && e.input.interpretation) e.summary = d.summary = clean(e.input.interpretation, 700); }
  recomputeCulture();
  if (!o0.map.plan) legacyStreets(); // saved before towns planned their own streets
  for (const k in S.P) ensurePerson(S.P[k]);
  if (S.P[S.founder]) S.P[S.founder].fl = 0;
}
function parseSave(txt) { try { const o = typeof txt === 'string' ? JSON.parse(txt) : txt; return o && o.state ? o : null; } catch (e) { return null; } }

/* ---------- folder ---------- */
async function readText(dir, name) { try { const fh = await dir.getFileHandle(name); const f = await fh.getFile(); return await f.text(); } catch (e) { return null; } }
async function writeText(dir, name, text) { const fh = await dir.getFileHandle(name, { create: true }); const w = await fh.createWritable(); await w.write(text); await w.close(); }
async function fileSize(dir, name) { try { const fh = await dir.getFileHandle(name); return (await fh.getFile()).size; } catch (e) { return 0; } }
async function appendText(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true });
  const size = (await fh.getFile()).size;
  const w = await fh.createWritable({ keepExistingData: true });
  await w.write({ type: 'write', position: size, data: new TextEncoder().encode(text) });
  await w.close();
}
function mdHeader() {
  const d = new Date(S.created);
  return `# The Chronicle of ${S.planet || 'an Unnamed World'}\n\n*A Seedfall world. Seed ${S.seed}, first pod fell on ${d.toDateString()}.*\n\n`;
}
function mdLines(list) {
  let s = '';
  for (const e of list) {
    if (e.k === 'era') s += `\n## ${e.t} (from Year ${e.yr})\n\n`;
    else s += `- **Year ${e.yr}** ${e.ic} ${e.k === 'major' ? '**' + e.t + '**' : e.t}\n`;
  }
  return s;
}
const CSV_HEAD = 'real_time,year,era,population,towns,buildings,ideas,research_per_year\n';
function csvLines(rows) { return rows.map(r => `${r.t},${r.yr},"${String(r.era).replace(/"/g, '""')}",${r.pop},${r.towns},${r.bld},${r.ideas},${r.rp}`).join('\n') + '\n'; }

async function folderFlush(txtFn) {
  if (!FOLDER.ok || FOLDER.busy) return;
  FOLDER.busy = true;
  try {
    const dir = FOLDER.h;
    // chronicle
    const mdSize = await fileSize(dir, 'chronicle.md');
    const chronNew = mdSize === 0 ? S.chron.slice() : S.chron.filter(e => e.n > S.mdWritten);
    const csvSize = await fileSize(dir, 'stats.csv');
    const rowsNew = csvSize === 0 ? S.rows.slice() : S.rows.filter(r => r.n > S.csvWritten);
    if (chronNew.length) S.mdWritten = chronNew[chronNew.length - 1].n;
    if (rowsNew.length) S.csvWritten = rowsNew[rowsNew.length - 1].n;
    const txt = txtFn();
    if (chronNew.length || mdSize === 0) await appendText(dir, 'chronicle.md', (mdSize === 0 ? mdHeader() : '') + mdLines(chronNew));
    if (rowsNew.length) await appendText(dir, 'stats.csv', (csvSize === 0 ? CSV_HEAD : '') + csvLines(rowsNew));
    await writeText(dir, 'save.json', txt);
    // daily backup
    const today = todayStr();
    if (S.lastBackup !== today) {
      const bd = await dir.getDirectoryHandle('backups', { create: true });
      await writeText(bd, `save-${today}.json`, txt);
      S.lastBackup = today;
      const names = []; for await (const [n] of bd.entries()) if (/^save-\d{4}-\d\d-\d\d\.json$/.test(n)) names.push(n);
      names.sort(); while (names.length > 14) { try { await bd.removeEntry(names.shift()); } catch (e) { break; } }
    }
    FOLDER.last = Date.now(); FOLDER.err = null;
  } catch (e) {
    FOLDER.err = e.message || String(e);
    if (e.name === 'NotAllowedError' || e.name === 'SecurityError') { FOLDER.ok = false; showBanner(); }
  }
  FOLDER.busy = false;
  renderFolderStatus();
}

// force: true = push to the cloud now, 'hidden' = the tab was just hidden (cloud if 30 s have passed)
async function saveAll(force) {
  if (!S || S.flags.intro) return;
  if (CLOUD.conflict) return; // another device owns the world now: writing anything here would only clobber it
  S.savedAt = Date.now();
  if (FOLDER.ok) await folderFlush(() => JSON.stringify(serialize()));
  if (force === true && CLOUD.job) await CLOUD.job; // an upload asked for on purpose waits for one in flight, never skips
  const txt = JSON.stringify(serialize());
  if (cloudDue(force) && !(await cloudPut(txt, S.playSec)) && CLOUD.conflict) return;
  await IDB.set('save', txt);
}

async function connectFolder(fromWelcome) {
  if (!HAS_FSA) { toast('This browser can’t write to folders. Use Edge or Chrome.'); return false; }
  let h;
  try { h = await window.showDirectoryPicker({ id: 'seedfall', mode: 'readwrite', startIn: 'documents' }); } catch (e) { return false; }
  if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') return false;
  FOLDER.h = h; FOLDER.name = h.name; FOLDER.ok = true;
  await IDB.set('dir', h);
  hideBanner();
  const fs = parseSave(await readText(h, 'save.json'));
  if (fromWelcome) return fs; // caller decides
  if (fs && S && fs.state.seed !== S.seed) {
    // folder holds another world: keep it safe before we write ours
    await archiveFolderWorld(fs);
  } else if (fs && S && fs.state.seed === S.seed && (fs.state.savedAt || 0) > (S.savedAt || 0) + 60000) {
    deserialize(fs); startWorld(false); toast('Loaded the newer save from the folder.');
  }
  toast(`Saving to “${h.name}”.`);
  await saveAll();
  return true;
}
async function archiveFolderWorld(fs) {
  try {
    const wd = await FOLDER.h.getDirectoryHandle('worlds', { create: true });
    const tag = `${(fs.planet || 'world').replace(/[^\w\- ]/g, '')}-${fs.state.seed}`;
    await writeText(wd, `${tag}.json`, JSON.stringify(fs));
    const md = await readText(FOLDER.h, 'chronicle.md'); if (md) await writeText(wd, `${tag}-chronicle.md`, md);
    const csv = await readText(FOLDER.h, 'stats.csv'); if (csv) await writeText(wd, `${tag}-stats.csv`, csv);
    await writeText(FOLDER.h, 'chronicle.md', ''); await writeText(FOLDER.h, 'stats.csv', '');
  } catch (e) { FOLDER.err = e.message; }
}
async function reconnectFolder() {
  if (!FOLDER.h) return connectFolder(false);
  try {
    const p = await FOLDER.h.requestPermission({ mode: 'readwrite' });
    if (p === 'granted') {
      FOLDER.ok = true; hideBanner();
      const fs = parseSave(await readText(FOLDER.h, 'save.json'));
      if (fs && fs.state.seed === S.seed && (fs.state.savedAt || 0) > (S.savedAt || 0) + 60000) { deserialize(fs); startWorld(false); }
      else if (fs && fs.state.seed !== S.seed) await archiveFolderWorld(fs);
      toast(`Saving to “${FOLDER.name}” again.`);
      saveAll();
    } else showBanner(true);
  } catch (e) { showBanner(true); }
}
function showBanner(denied) {
  const b = $('banner');
  b.onclick = null;
  b.textContent = denied ? `Folder “${FOLDER.name}” isn't connected. Saving in this browser for now. Click to try again.` : `Click anywhere to reconnect your save folder “${FOLDER.name}”`;
  b.classList.add('show');
  if (!denied) {
    const once = () => { removeEventListener('pointerdown', once, true); if (!FOLDER.ok) reconnectFolder(); };
    addEventListener('pointerdown', once, true);
  }
}
function hideBanner() { const b = $('banner'); b.classList.remove('show'); b.onclick = null; }
function renderFolderStatus() {
  const el = $('fstat'), tx = $('ftext'), bt = $('bFolder');
  if (CLOUD.on) {
    const bad = CLOUD.conflict || CLOUD.out || CLOUD.err;
    el.className = bad ? 'warn' : CLOUD.last ? 'ok' : '';
    tx.textContent = CLOUD.conflict ? 'Open on another device · not saving here' : CLOUD.out ? 'Signed out · saving in this browser' : CLOUD.err ? `Cloud: ${CLOUD.err} · saving in this browser` : CLOUD.last ? `Saved to the cloud · ${agoStr(CLOUD.last)}` : 'Saving to the cloud';
    tx.title = CLOUD.email ? 'Signed in as ' + CLOUD.email : '';
    bt.textContent = 'Load save.json…'; bt.style.display = '';
    return;
  }
  if (!HAS_FSA) { tx.textContent = 'Saving in this browser (folders need Edge/Chrome)'; bt.style.display = 'none'; return; }
  if (FOLDER.ok) {
    el.className = FOLDER.err ? 'warn' : 'ok';
    const t = FOLDER.last ? new Date(FOLDER.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '…';
    tx.textContent = FOLDER.err ? `“${FOLDER.name}”: ${FOLDER.err}` : `Saving to “${FOLDER.name}” · ${t}`;
    bt.textContent = 'Change';
  } else { el.className = FOLDER.h ? 'warn' : ''; tx.textContent = FOLDER.h ? `“${FOLDER.name}” needs permission` : 'Saving in this browser only'; bt.textContent = FOLDER.h ? 'Reconnect' : 'Connect folder'; }
}

/* ---------- cloud saves (only when the page is served by the Worker, e.g. seedfall.rsvn.dk) ---------- */
// Cloud mode needs http(s) and a 200 from /api/me. From file://, or any server without the API, none of this
// runs and saving works exactly as before. Every /api call is same-origin and uses redirect: 'manual', because
// an expired Access session answers with a redirect to the login page, which fetch can't follow cross-origin.
const CLOUD = {
  on: false, email: '', rev: undefined, // rev: undefined = don't know yet, null = the cloud has no save yet
  last: 0, lastTry: 0, lastPlay: -1, busy: false, job: null, err: null, conflict: false, out: false,
  session: self.crypto && crypto.randomUUID ? crypto.randomUUID() : 'tab-' + Date.now().toString(36) + Math.random().toString(36).slice(2)
};
const CLOUD_EVERY = 150e3; // KV's free tier allows ~1,000 writes a day
function agoStr(t) { const m = Math.floor((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.floor(m / 60)} h ago` : `${Math.floor(m / 1440)} days ago`; }
// header values must be Latin-1, and planet names needn't be
const asciiJson = o => JSON.stringify(o).replace(/[\u007f-￿]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const gzip = txt => new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
const gunzip = buf => new Response(new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))).text();

async function cloudApi(path, opt = {}, ms = 30000) {
  const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch('/api/' + path, Object.assign({ redirect: 'manual', cache: 'no-store', credentials: 'same-origin', signal: ctl.signal }, opt));
    if (r.type === 'opaqueredirect' || r.status === 401) { cloudSignedOut(); throw new Error('signed out'); }
    return r;
  } catch (e) {
    throw new Error(CLOUD.out ? 'signed out' : e.name === 'AbortError' ? 'the server took too long' : e.message === 'Failed to fetch' || navigator.onLine === false ? 'can’t reach the server' : e.message);
  } finally { clearTimeout(to); }
}
async function cloudDetect() {
  if (!/^https?:$/.test(location.protocol)) return false;
  let r;
  try { r = await cloudApi('me', {}, 8000); } catch (e) { if (CLOUD.out) { CLOUD.on = true; return true; } return false; }
  const j = r.status === 200 ? await r.json().catch(() => null) : null;
  if (!j || !j.email) return false;
  CLOUD.on = true; CLOUD.email = j.email;
  return true;
}
async function cloudGet(head) { // -> { meta, txt, save } or null when the cloud has no save yet
  const r = await cloudApi('save', head ? { method: 'HEAD' } : {});
  if (r.status === 204) return null;
  if (!r.ok) throw new Error('HTTP ' + r.status);
  let meta = {}; try { meta = JSON.parse(r.headers.get('x-seedfall-meta') || '{}'); } catch (e) { }
  meta.rev = +meta.rev || 0;
  if (head) return { meta };
  const buf = await r.arrayBuffer();
  const txt = meta.gz ? await gunzip(buf) : new TextDecoder().decode(buf);
  return { meta, txt, save: parseSave(txt) };
}
function cloudDue(force) {
  if (!CLOUD.on || CLOUD.conflict || CLOUD.out || CLOUD.busy) return false;
  if (force === true) return true;
  if (S.playSec === CLOUD.lastPlay) return false; // nothing happened since the last upload (the world pauses when hidden)
  return Date.now() - CLOUD.lastTry >= (force === 'hidden' ? 30e3 : CLOUD_EVERY);
}
function cloudPut(txt, play) { return CLOUD.job = cloudPut1(txt, play).finally(() => { CLOUD.job = null; }); }
async function cloudPut1(txt, play) {
  CLOUD.busy = true; CLOUD.lastTry = Date.now();
  try {
    if (CLOUD.rev === undefined) { // we never saw the cloud's copy (it was unreachable at startup): look before overwriting
      const c = await cloudGet(true), lc = await IDB.get('cloud');
      if (c && !(lc && lc.email === CLOUD.email && lc.rev === c.meta.rev)) { cloudConflict(c.meta); return false; }
      CLOUD.rev = c ? c.meta.rev : null;
    }
    const gz = typeof CompressionStream === 'function';
    const h = { 'content-type': gz ? 'application/octet-stream' : 'application/json', 'x-seedfall-session': CLOUD.session, 'x-seedfall-gzip': gz ? '1' : '0',
      'x-seedfall-info': asciiJson({ year: yr(), planet: S.planet || '', pop: Math.round(totalPop()) }) };
    if (CLOUD.rev != null) h['if-match'] = String(CLOUD.rev);
    const r = await cloudApi('save', { method: 'PUT', headers: h, body: gz ? await gzip(txt) : txt }, 60000);
    const j = await r.json().catch(() => ({}));
    if (r.status === 409) { cloudConflict(j.meta || {}); return false; }
    if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
    CLOUD.rev = j.rev; CLOUD.last = Date.now(); CLOUD.lastPlay = play; CLOUD.err = null;
    await IDB.set('cloud', { email: CLOUD.email, rev: j.rev }); // the local copy now continues this revision
    return true;
  } catch (e) { if (!CLOUD.out) CLOUD.err = e.message; return false; }
  finally { CLOUD.busy = false; renderFolderStatus(); }
}
async function cloudClaim() {
  const r = await cloudApi('claim', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ session: CLOUD.session }) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
}
function cloudBanner(text, click) {
  const b = $('banner'); b.textContent = text; b.onclick = click || null; b.classList.add('show');
}
function cloudConflict(meta) {
  CLOUD.conflict = true; CLOUD.err = null;
  const ago = meta.savedAt ? `, saved ${agoStr(meta.savedAt)}` : '';
  cloudBanner(`This world is open on another device (Year ${meta.year != null ? meta.year : '?'}${ago}). Take over here?`, cloudTakeOver);
  renderFolderStatus();
}
function cloudSignedOut() {
  if (CLOUD.out) return;
  CLOUD.out = true; CLOUD.err = null;
  // keep saving to IndexedDB (unless another device owns the world); after logging in, startup offers to upload it
  cloudBanner('Signed out. Your progress is kept in this browser. Click here to reload and log in.', () => { Promise.resolve(saveAll()).finally(() => location.reload()); });
  renderFolderStatus();
}
async function cloudTakeOver() {
  cloudBanner('Taking over…');
  try {
    await cloudClaim();
    const c = await cloudGet();
    if (c && !c.save) throw new Error('the cloud save wouldn’t open');
    CLOUD.conflict = false; CLOUD.err = null; hideBanner();
    if (c) {
      CLOUD.rev = c.meta.rev; CLOUD.last = c.meta.savedAt || 0;
      deserialize(c.save); startWorld(false);
      await IDB.set('save', c.txt); await IDB.set('cloud', { email: CLOUD.email, rev: c.meta.rev });
      toast(`Carrying on with ${S.planet || 'your world'} here.`);
    } else CLOUD.rev = null;
    CLOUD.lastTry = Date.now(); CLOUD.lastPlay = S.playSec;
  } catch (e) { if (!CLOUD.out) cloudBanner(`Couldn’t take over (${e.message}). Click to try again.`, cloudTakeOver); }
  renderFolderStatus();
}
// a two-button question on the confirm card; resolves true for the first button
function choose(title, text, yes, no) {
  return new Promise(res => {
    const cY = $('cYes'), cN = $('cNo'), l = [cY.textContent, cN.textContent];
    const done = v => { $('confirm').classList.remove('show'); cY.textContent = l[0]; cN.textContent = l[1]; cY.onclick = cN.onclick = null; res(v); };
    $('cTitle').textContent = title; $('cText').textContent = text; cY.textContent = yes; cN.textContent = no;
    cY.onclick = () => done(true); cN.onclick = () => done(false);
    $('confirm').classList.add('show');
  });
}
const saveDesc = (planet, year, t) => `${planet || 'An unnamed world'} in Year ${year}${t ? ', saved ' + agoStr(t) : ''}`;
// startup: which save to open, the cloud's or this browser's -> { save, upload } or null for a first run
async function cloudStart() {
  const loc = parseSave(await IDB.get('save')), lc = await IDB.get('cloud');
  const mine = loc && (!lc || !CLOUD.email || lc.email === CLOUD.email); // another login's world here isn't ours to upload (signed out, we can't tell)
  if (CLOUD.out) return mine ? { save: loc } : null;     // signed out already: carry on locally, the banner says why
  let c;
  try { c = await cloudGet(); } catch (e) { CLOUD.err = e.message; return mine ? { save: loc } : null; } // offline: rev stays unknown
  if (!c) { CLOUD.rev = null; return mine ? { save: loc, upload: true } : null; }
  CLOUD.rev = c.meta.rev; CLOUD.last = c.meta.savedAt || 0;
  const lt = mine ? loc.state.savedAt || 0 : 0;
  if (mine && (!c.save || lt > (c.meta.savedAt || 0))) {
    // this browser played on after the cloud's copy: offline, or signed out. If nobody else saved since, just carry on
    if (!c.save || lc && lc.rev === c.meta.rev) return { save: loc, upload: true };
    const up = await choose('This browser has a newer save', `Here: ${saveDesc(loc.planet, loc.year, lt)}. In the cloud: ${saveDesc(c.meta.planet, c.meta.year, c.meta.savedAt)}. Upload this browser’s world? The cloud keeps a daily backup for two weeks either way.`, 'Upload this one', 'Use the cloud save');
    if (up) return { save: loc, upload: true };
  }
  if (!c.save) return null;
  await IDB.set('save', c.txt); await IDB.set('cloud', { email: CLOUD.email, rev: c.meta.rev });
  return { save: c.save };
}
// after a world is on screen: this tab owns it now, so another device's next save gets a 409
async function cloudOwn(upload) {
  if (CLOUD.out) return;
  try { await cloudClaim(); } catch (e) { if (!CLOUD.out) CLOUD.err = e.message; }
  CLOUD.lastTry = Date.now(); if (!upload) CLOUD.lastPlay = S.playSec;
  if (upload) await saveAll(true);
  renderFolderStatus();
}
// bring a save.json over from the file:// version (a plain file input works in every browser)
function pickSaveFile() {
  return new Promise(res => {
    const inp = $('fLoad'); inp.value = '';
    inp.onchange = async () => { const f = inp.files && inp.files[0]; res(f ? parseSave(await f.text().catch(() => '')) || false : null); };
    inp.click();
  });
}
async function cloudLoadFile(welcome) {
  const fs = await pickSaveFile();
  if (fs === null) return false;
  if (fs === false) { toast('That file isn’t a Seedfall save.'); return false; }
  if (!welcome && S && !(await choose('Load this world?', `${saveDesc(fs.planet, fs.year)} will replace ${saveDesc(S.planet, yr())} here and in the cloud. The cloud keeps a daily backup for two weeks.`, 'Load it', 'Cancel'))) return false;
  if (CLOUD.conflict) { CLOUD.conflict = false; hideBanner(); } // loading a file on purpose is a take-over too
  try { const c = await cloudGet(true); CLOUD.rev = c ? c.meta.rev : null; } catch (e) { } // and it replaces whatever is there
  deserialize(fs); startWorld(false);
  toast(`Welcome back to ${S.planet || 'your world'}.`);
  await cloudOwn(true);
  return true;
}
