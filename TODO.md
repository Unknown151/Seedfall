# Seedfall to-do

## 1. Play it anywhere: hosted site and cloud saves (done)

> **Status:** live at `seedfall.rsvn.dk`. The Worker (`worker/index.js`, `wrangler.jsonc`) and the game's
> cloud mode (bottom of `persist.js`) are done and tested (`test/cloud.mjs`). Storage is Workers KV
> (R2 would need a card on file). What's left is under "Still to do".

**Goal:** open `seedfall.rsvn.dk` in any browser, log in, and carry on the same world. It's for Rasmus
only, or a few invited emails.

### Architecture

- **Worker with Static Assets.** `node build.mjs --public` writes `public/index.html`; the Worker only runs
  for `/api/*`. `workers_dev` and `preview_urls` are off, so the site can only be reached through Access.
- **Cloudflare Access.** A self-hosted app on `seedfall.rsvn.dk` with a policy for Rasmus's email and a
  one-time PIN login. Access sends `Cf-Access-Jwt-Assertion`, and the Worker verifies it (RS256, issuer
  `TEAM_DOMAIN`, audience `POLICY_AUD`) and takes the email from it.
- **Storage.** Workers KV, bound as `SAVES`. The id is a hash of the email.
  - `save:<id>`: the save (same format as save.json, gzipped by the client), with metadata
    `{ rev, savedAt, session, gz, year, planet, pop }`.
  - `claim:<id>`: the session id of the browser that owns the world.
  - `bak:<id>:<day>`: one backup a day, expiring after 14 days.
  - `voice:<id>:<day>`: the voice call counter.
  - KV's free tier allows ~1,000 writes a day, so the game uploads at most every 2.5 minutes (plus on hide).

### Worker API

| Endpoint | What it does |
|---|---|
| `GET /api/me` | `{ email }`. The game uses a 200 here to switch cloud mode on. |
| `GET` / `HEAD /api/save` | 200 with the save, `ETag: <rev>` and `X-Seedfall-Meta` (the metadata as JSON, non-ASCII escaped), or 204 if there's no save yet. |
| `PUT /api/save` | Body is the save. Headers `If-Match: <rev>`, `X-Seedfall-Session`, `X-Seedfall-Info: {year, planet, pop}`, `X-Seedfall-Gzip: 1`. Returns the new rev, or **409** with the current meta if another device saved in between or has claimed the world. |
| `POST /api/claim` | Body `{ session }`. Makes this browser the owner; the other device's next save gets 409. |
| `POST /api/voice` | Proxies to the Anthropic Messages API with the Worker secret `ANTHROPIC_API_KEY`. Allows only the models in `MODELS` (kept in step with `AI_MODELS`; the build checks), caps `max_tokens` and the body size, and enforces 80 calls a day. |

### How the game behaves in cloud mode

- **Cloud mode** is on only when the page is served over http(s) and `GET /api/me` answers 200. From
  `file://` nothing changes (IndexedDB, optional folder, direct voice with the browser's key).
- **Startup.** Compares the cloud save with this browser's IndexedDB copy. A newer local save that
  continues the same revision (played while offline or signed out) just loads and uploads. One that
  diverged (the cloud moved on elsewhere) asks whether to upload it. Then the tab claims the world.
- **Autosave** to the cloud every 2.5 min and when the tab is hidden, only if the world moved. IndexedDB
  keeps a copy every 45 s as the offline fallback. The panel footer shows "Saved to the cloud · 1 min ago".
- **Two devices.** A 409 stops all saving in that tab and shows "This world is open on another device
  (Year X, saved N min ago). Take over here?" Clicking claims and reloads the world from the server.
- **Signed out.** An expired Access session redirects `/api` calls to the login page (seen as an opaque
  redirect, since fetches use `redirect: 'manual'`) or answers 401. The banner says "Signed out", the game
  keeps saving locally, and after logging in the local progress uploads.
- **Bringing a world over.** "Load save.json…" on the welcome card and in the panel footer (a plain file
  input) loads a save.json from disk and uploads it.
- **Voice.** `aiFetch` posts the same body to `/api/voice`, with no key and no direct-browser header. The
  Voice setup screen says the voice runs through the server and has no key field.

### Still to do

- **Exports:** `GET /api/export/chronicle.md` and `GET /api/export/stats.csv`, built server-side from the
  save. Keep downloads on the server: a client-side Blob plus `createObjectURL` plus `a.download` is the
  HTML-smuggling pattern that Defender dislikes.
- **Phone support:** touch pan and zoom, and a lower-resolution static layer on small screens.
- The world still only grows while a tab is visible. A catch-up for time spent away would be a design
  change, so ask Rasmus first.

## 2. Bigger worlds (128×128, or 96×96 as a middle ground)

- **Per-world map size.** Old saves stay 64×64.
- **Graphics memory.** The static layer needs chunking or a lower resolution. At 128×128 it would take
  ~420 MB of canvas memory as things are now; 96×96 would be about 250 MB.
- **Worldgen retune.** More rivers, ranges and ruins.
- **Towns.** More of them, with sensible spacing, then re-check the pacing.
