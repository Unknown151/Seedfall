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

async function saveAll() {
  if (!S || S.flags.intro) return;
  S.savedAt = Date.now();
  if (FOLDER.ok) await folderFlush(() => JSON.stringify(serialize()));
  await IDB.set('save', JSON.stringify(serialize()));
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
  b.textContent = denied ? `Folder “${FOLDER.name}” isn't connected. Saving in this browser for now. Click to try again.` : `Click anywhere to reconnect your save folder “${FOLDER.name}”`;
  b.classList.add('show');
  if (!denied) {
    const once = () => { removeEventListener('pointerdown', once, true); if (!FOLDER.ok) reconnectFolder(); };
    addEventListener('pointerdown', once, true);
  }
}
function hideBanner() { $('banner').classList.remove('show'); }
function renderFolderStatus() {
  const el = $('fstat'), tx = $('ftext'), bt = $('bFolder');
  if (!HAS_FSA) { tx.textContent = 'Saving in this browser (folders need Edge/Chrome)'; bt.style.display = 'none'; return; }
  if (FOLDER.ok) {
    el.className = FOLDER.err ? 'warn' : 'ok';
    const t = FOLDER.last ? new Date(FOLDER.last).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '…';
    tx.textContent = FOLDER.err ? `“${FOLDER.name}”: ${FOLDER.err}` : `Saving to “${FOLDER.name}” · ${t}`;
    bt.textContent = 'Change';
  } else { el.className = FOLDER.h ? 'warn' : ''; tx.textContent = FOLDER.h ? `“${FOLDER.name}” needs permission` : 'Saving in this browser only'; bt.textContent = FOLDER.h ? 'Reconnect' : 'Connect folder'; }
}
