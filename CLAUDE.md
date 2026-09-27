# Seedfall

An ambient, idle, isometric civilisation sim that runs in a single HTML file. A seed pod lands on an
unnamed world. From it come a village, towns, eras and ages, and eventually seedships. It's meant to
sit on a work monitor all day. The player nudges gently (rain, supply pods, inspire, starfall, bloom)
and can "speak" to the colonists through the optional Claude-powered **Watcher's voice**.

Owner: Rasmus. He likes casual, direct talk and working code more than long explanations. Ask one
question at a time, and show a screenshot after any visual change.

## Hard rules

- **API key safety.** From `file://` the Anthropic key lives only in the browser's IndexedDB (key `ai`). On
  the site it is the Worker secret and never reaches the browser. Either way it must never end up in
  save.json, chronicle.md, stats.csv, logs, the cloud save or any exported file. `test/voicetab.mjs` and
  `test/cloud.mjs` check this.
- **Shipped code must stay single-file with no dependencies, and it must work from `file://`.** From
  `file://` the only network call is to `api.anthropic.com` for the voice, with the header
  `anthropic-dangerous-direct-browser-access: true`. In cloud mode (served over http(s) and `/api/me`
  answers 200) it calls only its own origin's `/api/*` instead: saves, claim and the voice proxy. Nothing
  else, ever.
- **No `eval`, `new Function`, `atob`, `btoa` or `String.fromCharCode` in shipped code.** Windows Defender
  flagged a build once (`Trojan:Win32/MalUri.A!cl`, a cloud heuristic on HTML-smuggling patterns). The
  build script's `new Function` syntax check is fine because it doesn't ship. `build.mjs` fails the build if
  any of these show up in seedfall.html, and if `MODELS` in worker/index.js drifts from `AI_MODELS`.
- **Keep it an idle game.** Nothing should hard-stop; shortages only slow things down. The research
  "governor" keeps discoveries close to `TECHS[].yr`, so don't break the pacing (baseline below).

## Git workflow (Claude Code cloud sessions)

- Work on the session's own branch and push it only when a change is **finished and the tests pass**.
- Rasmus opens the PR and merges it himself. Merging to `main` auto-deploys to seedfall.rsvn.dk (a failed
  build doesn't deploy), so every push has to be safe to merge as it is. No half-done work on the branch.
- Keep `package-lock.json` committed, so Cloudflare's build uses npm (not bun).

## Build and run

```
node build.mjs            # src/ -> seedfall.html; also checks syntax and duplicate function names
node build.mjs --dist     # ...and copies it to dist/Seedfall/ (the folder that gets zipped and shipped)
node build.mjs --public   # ...and writes public/index.html (what the Cloudflare Worker serves)
npm run dev               # local Worker at http://127.0.0.1:8787 with a fake logged-in user (needs `npm install`)
```

- **Build output.** `src/head.html` plus `src/*.js`, concatenated in a fixed order (see `ORDER` in
  build.mjs), makes one `<script>`. There are no modules: everything is a global. Function declarations
  are hoisted, but top-level `const`s from later files are only usable at runtime.
- **Duplicate function names fail the build.** A duplicate would silently shadow the earlier one. That
  has bitten twice: `stepPeople` vs `stepAgents` stopped anyone dying, and `workFor` vs `jobPlace`.
- **URL flags.** Open `seedfall.html` directly. `?seed=N&fresh` makes a new world, `&nointro` skips the
  landing, and `&dev` adds an fps readout.
- **Dev hooks (on `window.SF`).**
  - Time: `SF.ff(years)` fast-forwards, `SF.hour(h)` pins the clock (null means live).
  - Environment: `SF.weather(kind, secs)`, `SF.season({...})`.
  - State: `SF.state()`, `SF.save()`, `SF.relightNow()`.
  - Events: `SF.fx(kind, data)`, `SF.pray(kind)`.
- **Globals.** Top-level `let`s are reachable by name from `page.evaluate` (`S`, `M`, `CAM`, `DYN`,
  `towns()`...). Use `CAM` directly: `SF.cam` can be stale.
- **Shipped folder.** `dist/Seedfall/` holds `seedfall.html`, `README.txt` (CRLF line endings, player
  docs that are kept up to date), `Start Seedfall.bat` (opens Edge full-screen) and `world/` (where the
  player's save folder goes).

## Tests (Playwright, headless Chromium)

```
cd test && npm install && npx playwright install chromium   # test deps live in test/, not the root
npm run serve              # (from the root) some tests need http://localhost:8765: flow, econmig, streetmig
cd test && node soak.mjs
```

Set `PW_CHROMIUM` to use a specific Chromium binary. In Claude Code cloud sessions the test Playwright is
newer than the pre-installed browser, so use `PW_CHROMIUM=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`
(or whichever `chromium-*` folder is there) instead of downloading one. Runs are **not deterministic** (the sim uses
`Math.random`), so ±10–15% in population between runs is noise.

**Regression tests:**

| Test | What it checks |
|---|---|
| `soak` | Runs to year ~9,400 and uses every tool. Pass means 0 page errors. Also prints fps. |
| `pace` | Pop, techs and towns at fixed years for 5 seeds. Compare with the baseline below. |
| `flow` | Folder save and reload (OPFS stands in for the File System Access API). Month-level year drift on reload is a known timing race. |
| `walk2` | Walkers never get stuck (stuck ratio must be 0.000). |
| `aitest` | Voice with a mocked API via `page.route`. Also sends one real call with an invalid key to check CORS and the error path. |
| `voicetab` | The Voice tab, including "key in save? false". |
| `hover` | Hover tooltips. |
| `faith1` | Reverence and prayers. Can be flaky under load (stale element handles), so rerun it alone. |
| `econmig` | A pre-economy save still loads. |
| `streetmig` | A save made by `dist/`'s build loads in the current build. |
| `needs` | Town needs, the cloth and glass chains, smoke and its clean-up, the culture sites, and older saves picking all of it up. |
| `away` | Catch-up after time away: the 8 h and 250-year caps, the report card, the historian's letter (mocked). |
| `cloud` | Cloud mode against the real Worker (`wrangler dev` on :8787 with fresh KV, fake user, mock Anthropic; it starts and stops them itself). Welcome-card save.json import, save round trip, two-device conflict and take-over, newer local save (same revision and diverged), signed out (302 and 401), voice proxy (no key in the browser, model allowlist), footer save.json load, and file:// staying cloud-free. Needs the root `npm install`. |

**Inspection tools:**

- `sea1`: harbours, ships, ferries and planes over time.
- `planeshot`: follows a departing plane.
- `towns_tab`: screenshots the Towns tab.
- `econchron`: prints the economy chronicle.
- `planmap`: dumps a top-down town layout to `planmap.json`.
- `perf_mat`: cost of the material textures.

**Pacing baseline** (seeds 777, 999, 12345, 4242, 31337):

- **Techs:** 28 at year 1800 and 44 at 3500 (these are governed, so they should match).
- **Population:** about 300–370 at year 200, 17–21k at 1800, 55–70k at 2500, 95–130k at 3500.
- **Towns:** 5 at year 1800 and 6–7 at 3500.

**Headless screenshots:**

- **Camera:** set `CAM.x/y/z` and `CAM.tx/ty/tz` directly, plus `CAM.manualUntil = DYN.t + 999`.
- **Wait before shooting:** give it ~2 s for occlusion sprites (they're built at 5 ms per frame).
- **Weather and clock:** call `SF.weather('clear', 9999)` and `SF.hour(13)` so shots are comparable.

## Hosting (seedfall.rsvn.dk)

- **Worker** `worker/index.js` with config `wrangler.jsonc`. It serves `public/` as static assets and only
  runs code for `/api/*`: `GET /api/me`, `GET/PUT /api/save`, `POST /api/claim` and `POST /api/voice`.
  The rules are in the comments there and in TODO.md.
- **Deploys.** Workers Builds deploys on every push to `main`, with build command `node build.mjs --public`
  and deploy command `npx wrangler deploy`.
- **Login.** Cloudflare Access guards the whole domain, and every API call re-checks the Access JWT
  (RS256, issuer `TEAM_DOMAIN`, audience `POLICY_AUD`). `workers_dev` and `preview_urls` are off, so there
  is no way round the login.
- **Storage** is Workers KV, bound as `SAVES`:
  - `save:<id>` holds the save, with its metadata carrying rev and savedAt.
  - `claim:<id>` records which browser owns the world.
  - `bak:<id>:<day>` is a daily backup with a 14-day TTL.
  - `voice:<id>:<day>` counts voice calls.
  - The id is a hash of the email. Autosave no more than every ~2 minutes, because the KV free tier
    allows about 1,000 writes a day.
- **The Anthropic key** is the Worker secret `ANTHROPIC_API_KEY`, never in the page. Local dev uses
  `--var DEV_USER:...` or `.dev.vars` (both gitignored and never deployed).
- **Cloud mode in the game** (`persist.js`, bottom). `cloudDetect` at boot; `cloudStart` picks the cloud
  save or this browser's (a newer local save that continues the same rev just uploads; a diverged one asks);
  `cloudOwn` claims with the tab's session id. Uploads are gzipped, every 2.5 min and on hide (30 s minimum),
  only if the world moved. IndexedDB keeps a copy plus `cloud: {email, rev}` (the rev it continues). A 409
  stops *all* saving and shows the take-over banner; a redirect or 401 means signed out (local saves only).
  `/api` fetches use `redirect: 'manual'`, because Access redirects cross-origin to its login page.
- **Tested locally:** save round trip, both conflict cases (409), a forged, expired or wrong-audience JWT
  (rejected), the voice model allowlist and the daily counter.

## Map of the source (`src/`)

| File | What lives there |
|---|---|
| head.html | All markup and CSS: HUD glass card, side panel and tabs, modals (speak, answer, voice setup, help), tool bar |
| util.js | Constants (`W=H=64`, `TW2=16`, `TH2=8`, `EH=6`, `RS=2`, `SEAZ`, `OX/OY`, `STATIC_W/H`), rng, maths, colour helpers, the base64 table codec |
| data.js | `ERAS`, `TECHS` (with target years), `HT` house tiers, `BT` building types (work, height, anim/smoke), `SERV` rules for when towns build services, era styles, names and flavour lists |
| world.js | `BIO` biomes, map layers (`MAP_KEYS`, `newMap`), `genWorld` (terrain, sea, lakes, rivers, ore, ruins) |
| render.js | Static layer: tiles, cliffs, water, roads and bridges, rails, lamps, trees, rocks. Primitives `box`/`flat`/`cyl`/`cone`/`dome`/`roofGable`/`roofPyr`/`windows`/`door`. `DS` (building shape style) and `DM` (material texture) draw state. `markDirty`, dirty rects, bounding boxes |
| buildings.js | `drawBuilding` per type, material tint (`matStyle`), extraction sites, harbour and lighthouse art |
| light.js | Sun (synthetic 1 h or 20 min day, real sun over Horsens, or fixed), seasons by real date, weather Markov chain, `LT` light params, the progressive relight job with 3.5 s crossfade, cast shadows, emissive glows (`emit`) |
| sim.js | World state `S`, `newState`, `mkBuilding`, `findSite` (all the site kinds), roads, rails, bridges, town growth (`planTown`/`buildTown`/`tryHousing`/`tryService`), founding, tech, eras and ages, events, `stepPeople`, `simMonth`, god tools |
| streets.js | Street plan (`M.plan`): organic lanes early, grid quarters from Masonry/Steam, `connectRoad`/`pavePath`, conversion of old saves' 4-grid streets |
| econ.js | Timber, stone, clay, metal, goods, cloth and glass; extraction sites (incl. pastures and sand pits), crafts (`CRAFT`: weaver, glassworks), material choice, building costs, shortages, road and sea trade, "known for", Towns-tab readouts |
| needs.js | Town needs (`NEEDS`: water, milling, health, power grid, culture, news), worked out every 3 months from the buildings (`refreshNeeds`, never saved), their effects (`needGrowthK`, `lifeBonus`, `gridK`, `migrate`) and `tryNeeds`, which builds for whatever is missing. Also smoke (`SMOKY`, `sootK`, `pollution`, the `SOOT` ground tint that `topColor` reads), hot springs (`S.springs`, `springAt`), and the culture sites: `tryCulture` (bathhouse, theatre, Maker dig, botanical garden, guild hall) and `yearlyCulture` |
| people.js | Person model: traits, quirks, families, relationships |
| ai.js | Claude API (`aiFetch`, daily cap 80), world brief, tool schemas, `CULT` doctrines, `lever(k)`, `LV_KEYS`/`LV_TXT` |
| levers.js | `applyLevers` (style, nature, growth, streets, materials, lights, weather, names...), customs lists, map labels, sky lanterns |
| faith.js | Reverence (costs replace cooldowns), prayers (templated or Claude-written), answering |
| dyn.js | `DYN` (per-frame, never saved), camera, particles, clouds and sky, FX dispatch, `drawFrame` order (static, agents, planes in the air, clouds, grade, sky, night light + lighthouse beams) |
| agents.js | A* navigation, walkers with daily schedules, vehicles, caravans, trade wagons, occlusion sprites, depth-sorted `drawAgents`, building animations (mill, turbine, chop, dig, crane, beam...) |
| sea.js | Water bodies, harbours, sea routes, ships by era (sail, steamer, freighter, boxship, hover), fishing boats (out at dawn, home at dusk), ferries, lighthouse beams |
| air.js | Planes that use airfields: apron, taxi, roll, climb, cruise, final approach, land, park |
| ui.js | Panel and tabs (Chronicle, Towns, People, Lore, Voice), tooltips (`tipFor`), HUD |
| persist.js | `serialize`/`deserialize` plus migrations, IndexedDB, folder saves (save.json, chronicle.md, stats.csv, dated backups), cloud saves (`CLOUD`, only when served by the Worker) |
| main.js | Frame loop, pace (`relaxed` 5 min/yr, `normal` 3 min/yr, `brisk` 1 min/yr, `preview` 4 s/yr), dev hooks |

## How things work (the parts that are easy to break)

- **State.**
  - `S` is saved as JSON, and properties with an underscore on `S.T[...]` get saved too.
  - Caches go in module-level maps keyed by the `S` object (for example `ECX`, `WB`, `FERRY`, `BUILT`),
    so a world switch invalidates them.
  - The sim ticks monthly in `simMonth`. `FAST` is true during `SF.ff`, and `fx()` does nothing then.
- **Map layers.**
  - `M.*` are typed arrays listed in `MAP_KEYS`. A new layer must be added to both `MAP_KEYS` and `newMap`.
  - Old saves won't have the layer and get zeros, so write a migration in `deserialize`. `legacyStreets`
    is the example.
- **Static rendering.**
  - Change a tile, then call `markDirty(i)`. Everything that stands up on a tile goes through
    `drawTileObjects`, because the occlusion sprites reuse it.
  - Heights for bounds come from `objH`, and shadow casters from `CAST_DIMS` in light.js.
- **Moving things** are drawn every frame in `drawAgents`, depth-sorted by `fx+fy`. Anything in front
  gets redrawn from sprites over them.
- **Colours** go through `shade(col, LT.fL/fR/fT)` and `topC`. Static glows use `emit()`, per-frame
  glows use `dlight()`. The night grade is applied after the world is drawn.
- **Chronicle.** `chron(icon, text, { T | x,y, k: 'major', cap })`. Rate-limit ambient lines: the
  economy and streets use `S.econYr`, `T.swYr` and similar.
- **Voice levers.** The flow is: Claude's tool call, then `applyLevers`, then doctrine `d.lv`, then
  `recomputeCulture`, then `lever(k)`. To add a lever, put it in `LV_KEYS`, `LV_TXT` and the schema in
  ai.js, then in `applyLevers` and the customs lists in levers.js.
- **Towns.**
  - `townRadius` caps at 13. `findSite` caches failures in `T._fail`, so clear it after adding streets.
  - Houses need street frontage (`fronts()`). `growStreets` has a 12-month cooldown when a town is full.
  - New towns have to start in open country, at least `townRadius + 2.5` from any other town.
- **Time away.** `S.lastLive` is stamped every visible frame (paused counts as visible). A gap of 3+ min
  runs `catchUp` in `frame()`: at most 8 h of real time (Rasmus's rule: a weekend away must not skip an
  age) and 250 years, in 40 ms slices with `FAST` on, then the "While you were away" card, plus a letter
  from Claude (`aiDigest`) after 30+ min when the voice is on. `SF.ff` resets `lastLive`, so a long
  fast-forward isn't mistaken for time away. `test/away.mjs` covers it.
- **Needs.** Needs are soft multipliers, never hard stops. `tryNeeds` runs before housing when a need is under 60%, and may rebuild over an old house (`placeProject`) when there's no plot. The power grid is valley-wide. Keep `needGrowthK` near 1 for a typical town, or the pacing drifts.
- **Industry and culture.** Warehouses (`econCap`) and shipyards (bigger sea cargo in `stepTrade`, more ships via `shipCap`) live in econ.js/sea.js; `STORE_T` types are counted in `econCache` but make nothing. `SOOT` is recomputed once a year (`updateSoot`) and on world load; changed tiles are `markDirty`'d. Older saves get `S.springs` in `deserialize`.
- **Economy.** Building costs are paid per month of progress. With nothing in stock a building goes at
  35% speed; it never stops. Materials are chosen from local production. Trade needs a road (the wheel)
  or a harbour on both ends.

## Style

- **Code style.** Dense, readable JS with short names. Comments say *why*. Keep functions near the system
  they belong to.
- **Player-facing text.** Warm, a little whimsical, British spelling (harbour, colour). Keep the
  README.txt sections up to date when features change.

## Next up

See `TODO.md`:

1. **Hosted site and cloud saves** (`seedfall.rsvn.dk`): done. A Cloudflare Worker with static assets,
   Cloudflare Access for login, saves in Workers KV, a server-side voice proxy, and cloud mode in the game.
   Leftovers (server-side exports, phone support) are in TODO.md. The game still works exactly as before
   when opened from `file://`.
2. **Bigger worlds** (128×128 or 96×96). Blocked on static canvas memory, which would be ~420 MB at
   128×128 unless the layer is chunked.
