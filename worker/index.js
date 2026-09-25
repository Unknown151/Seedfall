// Seedfall on Cloudflare: serves the game (static assets in ./public) and a small API for cloud saves
// and the Watcher's voice. Cloudflare Access sits in front of the whole domain; every /api call is
// checked again here against the Access JWT, so nothing gets through without a login.
//
// Storage is Workers KV (binding SAVES). One key per player holds the save; its metadata carries the
// revision, so a save is a single write. Daily backups expire by themselves after 14 days.

const ANTHROPIC = 'https://api.anthropic.com/v1/messages';
const MODELS = ['claude-haiku-4-5-20251001', 'claude-sonnet-5', 'claude-opus-5-5']; // keep in step with AI_MODELS in src/ai.js
const VOICE_DAY_CAP = 80;                      // same as AI_DAY_CAP in the game
const MAX_SAVE = 20 * 1024 * 1024;             // KV values can be up to 25 MiB
const MAX_VOICE = 256 * 1024;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    let who;
    try { who = await identify(request, env); } catch (e) { return json({ error: 'not signed in' }, 401); }
    try {
      const route = request.method + ' ' + url.pathname;
      switch (route) {
        case 'GET /api/me': return json({ email: who.email });
        case 'HEAD /api/save':
        case 'GET /api/save': return getSave(request, env, who);
        case 'PUT /api/save': return putSave(request, env, who);
        case 'POST /api/claim': return claim(request, env, who);
        case 'POST /api/voice': return voice(request, env, who);
      }
      return json({ error: 'no such thing' }, 404);
    } catch (e) {
      return json({ error: 'server error', detail: String(e && e.message || e) }, 500);
    }
  }
};

/* ---------- who is asking ---------- */
async function identify(request, env) {
  // Local development only: `npm run dev` passes DEV_USER on the command line (or put it in .dev.vars).
  // It is never in wrangler.jsonc, so a real deploy can't have it, and Access still guards the domain.
  if (env.DEV_USER) return withId(env.DEV_USER);
  const token = request.headers.get('cf-access-jwt-assertion');
  if (!token || !env.TEAM_DOMAIN || !env.POLICY_AUD) throw new Error('no token');
  const claims = await verifyAccessJwt(token, env);
  if (!claims.email) throw new Error('no email');
  return withId(claims.email.toLowerCase());
}
async function withId(email) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
  return { email, id: [...new Uint8Array(h)].slice(0, 16).map(b => b.toString(16).padStart(2, '0')).join('') };
}

// Access signs with RS256; the public keys live at <team domain>/cdn-cgi/access/certs
let JWKS = { at: 0, keys: [] };
async function accessKeys(env, force) {
  if (!force && Date.now() - JWKS.at < 3600e3 && JWKS.keys.length) return JWKS.keys;
  const r = await fetch(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`);
  if (!r.ok) throw new Error('certs ' + r.status);
  const { keys } = await r.json();
  JWKS = { at: Date.now(), keys };
  return keys;
}
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), c => c.charCodeAt(0));
async function verifyAccessJwt(token, env) {
  const [h, p, s] = token.split('.');
  if (!h || !p || !s) throw new Error('bad token');
  const head = JSON.parse(new TextDecoder().decode(b64u(h)));
  const claims = JSON.parse(new TextDecoder().decode(b64u(p)));
  if (head.alg !== 'RS256') throw new Error('alg');
  let jwk = (await accessKeys(env)).find(k => k.kid === head.kid);
  if (!jwk) jwk = (await accessKeys(env, true)).find(k => k.kid === head.kid); // keys rotate
  if (!jwk) throw new Error('unknown key');
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64u(s), new TextEncoder().encode(h + '.' + p));
  if (!ok) throw new Error('signature');
  const now = Date.now() / 1000;
  if (claims.exp && claims.exp < now - 30) throw new Error('expired');
  if (claims.nbf && claims.nbf > now + 30) throw new Error('not yet');
  if (claims.iss !== env.TEAM_DOMAIN) throw new Error('issuer');
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(env.POLICY_AUD)) throw new Error('audience');
  return claims;
}

/* ---------- saves ---------- */
// GET  -> 200 with the save (ETag = revision), or 204 if there isn't one yet
// PUT  -> If-Match: <rev> (or none for the very first save), X-Seedfall-Session: <uuid>,
//         X-Seedfall-Info: {"year":..,"planet":"..","pop":..} (small, so we never parse the save itself)
//         409 if another device saved in between, or took the world over with /api/claim
async function getSave(request, env, who) {
  const { value, metadata } = await env.SAVES.getWithMetadata('save:' + who.id, { type: 'arrayBuffer' });
  if (!value) return new Response(null, { status: 204 });
  const m = metadata || {};
  const h = { 'etag': String(m.rev || 0), 'x-seedfall-meta': asciiJson(m), 'cache-control': 'no-store', 'content-type': m.gz ? 'application/octet-stream' : 'application/json' };
  return new Response(request.method === 'HEAD' ? null : value, { status: 200, headers: h });
}
async function putSave(request, env, who) {
  const session = request.headers.get('x-seedfall-session') || '';
  const want = request.headers.get('if-match');
  const len = +request.headers.get('content-length') || 0;
  if (len > MAX_SAVE) return json({ error: 'save too big' }, 413);
  const [cur, owner] = await Promise.all([
    env.SAVES.getWithMetadata('save:' + who.id, { type: 'stream' }).then(r => { r.value && r.value.cancel(); return r.metadata || null; }),
    env.SAVES.get('claim:' + who.id)
  ]);
  if (owner && session && owner !== session) return json({ error: 'taken over', meta: cur }, 409);
  if (cur && want != null && String(cur.rev) !== want.replace(/"/g, '')) return json({ error: 'someone else saved', meta: cur }, 409);
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_SAVE) return json({ error: 'save too big' }, 413);
  let info = {}; try { info = JSON.parse(request.headers.get('x-seedfall-info') || '{}'); } catch (e) { }
  const meta = { rev: (cur ? cur.rev || 0 : 0) + 1, savedAt: Date.now(), session, gz: request.headers.get('x-seedfall-gzip') === '1' ? 1 : 0,
    year: +info.year || 0, planet: String(info.planet || '').slice(0, 60), pop: +info.pop || 0 };
  await env.SAVES.put('save:' + who.id, body, { metadata: meta });
  // one backup a day, gone again after two weeks
  const day = new Date().toISOString().slice(0, 10), bk = `bak:${who.id}:${day}`;
  if (!(await env.SAVES.get(bk, { type: 'stream' }).then(s => (s && s.cancel(), !!s)))) await env.SAVES.put(bk, body, { metadata: meta, expirationTtl: 14 * 86400 });
  return json({ ok: true, rev: meta.rev, savedAt: meta.savedAt });
}
// this browser becomes the one that owns the world; the other one gets a 409 on its next save
async function claim(request, env, who) {
  const { session } = await request.json();
  if (!session || String(session).length > 80) return json({ error: 'no session' }, 400);
  await env.SAVES.put('claim:' + who.id, String(session));
  return json({ ok: true });
}

/* ---------- the Watcher's voice, with the key kept here and never in a browser ---------- */
async function voice(request, env, who) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'no voice key set on the server' }, 503);
  const txt = await request.text();
  if (txt.length > MAX_VOICE) return json({ error: 'too long' }, 413);
  let body; try { body = JSON.parse(txt); } catch (e) { return json({ error: 'bad json' }, 400); }
  if (!MODELS.includes(body.model)) return json({ error: 'model not allowed' }, 400);
  body.max_tokens = Math.min(+body.max_tokens || 1024, 4096);
  const day = new Date().toISOString().slice(0, 10), ck = `voice:${who.id}:${day}`;
  const n = +(await env.SAVES.get(ck)) || 0;
  if (n >= VOICE_DAY_CAP) return json({ error: `daily limit of ${VOICE_DAY_CAP} calls reached` }, 429);
  await env.SAVES.put(ck, String(n + 1), { expirationTtl: 3 * 86400 });
  const r = await fetch(env.ANTHROPIC_URL || ANTHROPIC, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  return new Response(r.body, { status: r.status, headers: { 'content-type': r.headers.get('content-type') || 'application/json', 'x-voice-calls-today': String(n + 1) } });
}

// header values must be Latin-1; planet names can be anything
const asciiJson = o => JSON.stringify(o).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
