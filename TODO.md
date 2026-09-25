# Seedfall to-do

## 1. Play it anywhere: hosted site and cloud saves (next up)

> **Status:** the Worker side is done and tested locally (`worker/index.js`, `wrangler.jsonc`). It uses
> Workers KV rather than R2, because R2 needs a card on file. What's left is the **game side** (the
> "Game changes" section below) and the Cloudflare dashboard setup.

**Goal:** open `seedfall.rsvn.dk` in any browser, log in, and carry on the same world. It's for Rasmus
only, or a few invited emails. Rasmus's site `rsvn.dk` already runs on Cloudflare Workers with Static
Assets and Cloudflare DNS, so this uses the same setup.

### Architecture

- **Worker with Static Assets.** Serves `dist/Seedfall/seedfall.html` at `/` and the API under `/api/*`.
  Turn off the `workers.dev` route so the site can only be reached through Access.
- **Cloudflare Access.** A self-hosted app on `seedfall.rsvn.dk`, with a policy that allows Rasmus's
  email and a one-time PIN login (Google login optional). The free Zero Trust plan covers up to 50 users.
  - Access sends `Cf-Access-Jwt-Assertion` on every request. **The Worker must verify that JWT**
    against `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`, checking the app's AUD tag, and
    take the email from it. Don't trust a plain email header.
- **Storage.** An R2 bucket `seedfall-saves` (bound as `SAVES`). Prefer R2 over KV, because KV's free
  tier allows about 1,000 writes a day. Objects:
  - `u/<sha256(email)>/save.json`: the same format as today's save.json (`serialize()`), which is
    ~0.3–1 MB. It can be gzipped client-side with `CompressionStream`.
  - `u/<hash>/meta.json`: `{ rev, savedAt, session, year, planet, pop }`.
  - `u/<hash>/backups/save-YYYY-MM-DD.json`: one per day, keep the last 14.

### Worker API

| Endpoint | What it does |
|---|---|
| `GET /api/save` | 200 with the save and an `ETag: <rev>` header, or 204 if there's no save yet. |
| `PUT /api/save` | Body is the save. Headers `If-Match: <rev>` and `X-Seedfall-Session: <uuid>`. On success it bumps `rev` and returns the new rev. If `rev` or `session` doesn't match, it returns **409** with the current meta, because another device has taken over. |
| `POST /api/claim` | Body `{ session }`. Makes this browser the active one (the other device's next save gets 409). |
| `POST /api/voice` | Proxies to `https://api.anthropic.com/v1/messages`. Uses the Worker secret `ANTHROPIC_API_KEY` (`wrangler secret put`) and adds `anthropic-version`. Allows only the models in `AI_MODELS`, enforces the daily cap of 80 calls server-side (counter in R2 or KV), and caps the body size. |
| `GET /api/export/chronicle.md`, `GET /api/export/stats.csv` | Built server-side from the save. Keep downloads on the server: a client-side Blob plus `createObjectURL` plus `a.download` is the HTML-smuggling pattern that Defender dislikes. |

### Game changes (mostly `persist.js`, a little of `ai.js` and `ui.js`)

- **Cloud mode.** Turn it on when the page is served over http(s) and `GET /api/save` answers. Otherwise
  keep today's behaviour exactly (file://, IndexedDB, optional folder).
- **Startup.** Load the cloud save and the local IndexedDB save and use whichever has the newer
  `savedAt`. If the local one is newer (played offline), offer to upload it.
- **Autosave.** Every 2–3 minutes, plus when the tab is hidden. `sendBeacon` and keepalive fetches are
  capped at 64 KB, so rely on the periodic saves. Show "Saved to the cloud · 1 min ago" where the folder
  status sits in the panel footer.
- **Two devices.** On a 409, show a banner: "This world is open on another device (Year 1234, saved 3 min
  ago). Take over here?" Taking over means claim, then reload from the server.
- **Voice.** In cloud mode `aiFetch` posts to `/api/voice`, and the Voice setup screen says the voice runs
  through your server, with no key field. **The key rule still applies**: it never goes in a save.
- The world still only grows while a tab is visible. A catch-up for time spent away would be a design
  change, so ask Rasmus first.

### Deploy sketch (`wrangler.toml`)

```toml
name = "seedfall"
main = "worker/index.js"
compatibility_date = "2026-09-01"
workers_dev = false
routes = [{ pattern = "seedfall.rsvn.dk", custom_domain = true }]
[assets]
directory = "dist/Seedfall"
[[r2_buckets]]
binding = "SAVES"
bucket_name = "seedfall-saves"
[vars]
ACCESS_TEAM = "<team>.cloudflareaccess.com"
ACCESS_AUD = "<application AUD tag>"
```

Serve `seedfall.html` at `/`, either by renaming it to `index.html` at deploy time or with a Worker
route. In the Zero Trust dashboard: Access, Applications, Add, Self-hosted, domain `seedfall.rsvn.dk`,
a policy allowing your email, and One-time PIN as the identity provider.

### Tests

- **Local:** `wrangler dev` with a `DEV_USER` variable that skips the Access check. The Worker must
  refuse `DEV_USER` in production.
- **Playwright:**
  - Save round trip: save, reload, same year.
  - Two-device conflict: two pages; the second one's save gets a 409 and shows the takeover prompt.
  - Voice proxy: mocked.
  - The existing suite still passes in file:// mode.

### Later

- Phone support: touch pan and zoom, and a lower-resolution static layer on small screens.

**Effort:** the Access and hosting setup is config, about 15 minutes. The Worker is around 100–150
lines with JWT checking. The cloud mode in the game, with conflict handling, is about an evening.

## 2. Bigger worlds (128×128, or 96×96 as a middle ground)

- **Per-world map size.** Old saves stay 64×64.
- **Graphics memory.** The static layer needs chunking or a lower resolution. At 128×128 it would take
  ~420 MB of canvas memory as things are now; 96×96 would be about 250 MB.
- **Worldgen retune.** More rivers, ranges and ruins.
- **Towns.** More of them, with sensible spacing, then re-check the pacing.
