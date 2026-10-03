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
  - `world:<id>:<wid>`: a kept world (at most 20), metadata `{ planet, year, pop, savedAt, gz }`.
  - KV's free tier allows ~1,000 writes a day, so the game uploads at most every 2.5 minutes (plus on hide).

### Worker API

| Endpoint | What it does |
|---|---|
| `GET /api/me` | `{ email }`. The game uses a 200 here to switch cloud mode on. |
| `GET` / `HEAD /api/save` | 200 with the save, `ETag: <rev>` and `X-Seedfall-Meta` (the metadata as JSON, non-ASCII escaped), or 204 if there's no save yet. |
| `PUT /api/save` | Body is the save. Headers `If-Match: <rev>`, `X-Seedfall-Session`, `X-Seedfall-Info: {year, planet, pop}`, `X-Seedfall-Gzip: 1`. Returns the new rev, or **409** with the current meta if another device saved in between or has claimed the world. |
| `POST /api/claim` | Body `{ session }`. Makes this browser the owner; the other device's next save gets 409. |
| `POST /api/voice` | Proxies to the Anthropic Messages API with the Worker secret `ANTHROPIC_API_KEY`. Allows only the models in `MODELS` (kept in step with `AI_MODELS`; the build checks), caps `max_tokens` and the body size, and enforces 80 calls a day. |
| `GET /api/worlds` | `{ worlds: [{ wid, planet, year, pop, savedAt }], max }`: the kept worlds. |
| `GET` / `PUT` / `DELETE /api/worlds/<wid>` | One kept world. PUT takes the same body and info headers as `/api/save` (no rev, no claim) and answers **409** when a new one would go over 20. |

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
  input) loads a save.json from disk and uploads it. The world it replaces is kept first.
- **Kept worlds.** "Worlds…" in the footer lists the kept worlds to switch to or forget, and starts new
  ones. Whatever gets replaced is uploaded to the list first; if that fails, nothing changes.
- **Scratch worlds.** `?fresh` never saves or claims anything, so testing on the live site is safe.
- **Voice.** `aiFetch` posts the same body to `/api/voice`, with no key and no direct-browser header. The
  Voice setup screen says the voice runs through the server and has no key field.

### Still to do

- **Exports:** `GET /api/export/chronicle.md` and `GET /api/export/stats.csv`, built server-side from the
  save. Keep downloads on the server: a client-side Blob plus `createObjectURL` plus `a.download` is the
  HTML-smuggling pattern that Defender dislikes.
- **Phone support:** touch pan and zoom, and a lower-resolution static layer on small screens.
- ~~Catch-up for time away~~: done (up to 8 hours, see `catchUp` in main.js).

## 2. Bigger worlds (done: 64 or 128 per world)

- Done: per-world size (`S.size`, old saves 64), picked for each new world; the page reloads at a world's size.
- Done: towns (twice as many on wide lands, further apart) and research trimmed so the pace holds.
- Done: graphics memory. The 2D view and its ~170 MB static layer are gone altogether.
- Left: a worldgen retune for the bigger map (more rivers, ranges and ruins), and simpler far chunks if
  128 turns out heavy on laptops.

## 3. The engine underneath (groundwork for incidents and whatever comes next)

- Done: the sim's own seeded randomness (`simRun`, `S.rs`): same seed, same world; a reloaded save grows on the same.
- Done: the event bus (`EV.on` / `EV.fire`): chron, placed, built, removed, town, tech, era, age, event.
- Done: 3D-native models (`GL_MODEL`, `glModel`): well, granary, shrine, watchstone so far.
- Done: 3D only. The 2D view, its camera, static canvases, relight, sprites and `?2d` are gone; everything it alone drew
  is in 3D now (fx3d.js: the nudges, rockets, the sky, flyers, Longstriders, birds, caravans, captions, place names, the zone
  view, lighthouse beams, lightning, the landing). Tests that don't need drawing use `&headless`.
- Done: the building art is all 3D and tile-local (no screen points, no canvas, no 2D-only strokes); what only the 2D art had
  (the works' sawtooth roof, solar panels, masts and dishes, the launch gantry, clocks, crosses, banners, statues, the harp
  and the colossus, round fields and orchards, the plaza fire, dome lattices) is real geometry now.
- Done: detailed native models for nearly every type, from the kit (kit.js): every house tier (homes.js), the public
  buildings and the big landmark lots (civic.js), the workplaces (industry.js), the shops, greens, modern works and the
  monuments (modern.js).
- Next: the same for what's left on the older art (the harbour's warehouses and quays, the shipyard, farms and their
  farmhouses, the reshaping styles' houses: round, organic, tiered, tall, low), and more own-colour glows at night.
- Done: incidents (incidents.js): a house fire, sheep loose in the market, a wedding procession, a river flood, a
  runaway cabbage cart and a whale on the beach.
- Done: many more voice levers, all from one table (`LEVERS`): a season that stays, the sky's colour or an aurora, house
  colours, trees, street decorations, bedtime, clothes, hats, pets, street life, birds, fireworks, work pace, trade, the
  sea, faith and smoke.
- Next: more incidents (a storm tearing tiles off roofs, a hot-air balloon that drifts off with the mayor, a mine
  collapse and rescue, a shipwreck and the lifeboat, a strike march in the works era, a harvest fair with a pig race),
  and prayers that react to them (townsfolk praying for rain during a fire, say).
