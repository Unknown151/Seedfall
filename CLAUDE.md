# Seedfall

An ambient, idle, 3D civilisation sim that runs in a single HTML file. A seed pod lands on an
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
- **Map size.** `W`/`H` are 64 or 128 (`MAP_SIZES`), fixed when the page loads (`MAPN` in util.js: `?size=`,
  else localStorage `sfSize`), so every buffer is still sized once. Worlds carry `S.size` (older saves are 64).
  Every load goes through `fitSize(save, then)`: a world of the other size is parked in IndexedDB (`pending`,
  with what was being done: boot, cloud, load, switch) and `resizeTo` reloads the page at its size; `boot()` picks
  `pending` up first. `newWorld(seed, archive, size)` does the same with `{then: 'new', seed}`. `RESIZING` stops
  saves while the page goes. The size is chosen in `sizeRow` (welcome card `#wSize`, new-world question `#cSize`).
  Wide lands (`BIGMAP`) found twice the towns further out, and research runs at .78 so the pace stays the same.
  `test/mapsize.mjs` covers it.
- **Randomness.** All code calls `rnd()` (and `ri`/`rf`/`pick`/`chance`/`shuffle` on top of it), never `Math.random`
  directly. `simMonth` and `newState` run inside `simRun`, which switches `rnd` to the sim's own seeded stream
  (`simRand`, state `S.rs`, saved with the world; older saves get one from their seed). Everything else (the view,
  particles, the player's clicks) stays on `Math.random`. So the same seed grows the same world, and a reloaded save
  grows on exactly as it would have: keep it that way (no `Math.random` or `Date.now` deciding anything in the sim,
  and no sim decisions that depend on what the view did). `test/engine.mjs` checks it.
- **Event bus.** `EV.fire(kind, data)` says what happened; `EV.on(kind, fn)` listens (`EV.off` to stop). The sim fires
  `chron {e, o}`, `placed {B}`, `built {B, T}`, `removed {B}`, `town {T, parent}`, `tech {t}`, `era {n}`, `age {age}`
  and `event {k}`. Listeners run on the view's randomness (so they can never change the sim) and a throwing listener
  is reported without stopping the world. New features (incidents, the camera, the voice) should listen here rather
  than be called from inside the sim.
- **3D models.** `glModel(B)` picks how a building is drawn in 3D: `GL_BIG[type]` for a landmark on a bigger lot, else
  `GL_MODEL[type]` (which may return `false` to hand back), else its art in buildings.js. Nearly every type has a native
  model now, built from the kit (kit.js) in world units in a frame of its own: s along its front, f out towards its street,
  y up (`kSet`/`kSetB`, `kFace` finds the street; `kSide(n, fn)` turns the frame, `kWalls(s0, s1, fB, fD, fn)` runs `fn` on
  each wall as if it were the front). Parts: `kBox`/`kOB`/`kBeam`/`kQ`/`kT`/`kCyl`/`kCone`/`kDome`, windows by the age
  (`kWin`: casements, sashes, steel, glass; arches, keystones, pediments, shutters, flower boxes; `kWins` rows), `kDoor`
  (plank, panelled, glazed; fanlight, hood, pediment, canopy, steps), roofs (`kGable` with ridge roll, bargeboards, fascia
  and gutters, thatch thick at the eaves; `kGableF` gable to the street, `kHip`, `kFlat` with parapet, `kMansard`), `kChim`,
  `kDormer`, mouldings (`kPlinth`, `kBand`, `kCornice`, `kQuoins`, `kPilasters`, `kPed`, `kCols`), the front (`kBalc`, `kAwn`,
  `kSign`, `kLantern`, `kClock`, `kShop`) and round about (`kFence` picket, rail, hedge or wall; `kPath`, `kBeds`, `kBarrel`,
  `kCrate`, `kBench`, `kButt`, `kWash`, `kPot`, `kSolar`, `kTree`, `kFlowers`). Small parts only in the near version
  (`KF.lod`). Industry keeps a fixed frame, because works.js puts its moving parts and workers at fixed spots on the tile
  and gl.js `SMOKE_AT` puts smoke on top of the stacks. Every building type has a model now (the pod, the pits' banks and
  the building sites are gl.js/works.js geometry); what's left of the older tile-local primitives in render.js (`box`, `flat`,
  `disc`, `ring`, `beam`, `lamp`, `ball`; u, v in tiles from the tile's middle, heights in height units, 22 to a tile) serves the
  streetscape, the ground and a few small parts. `kRot(a, fn)` turns the frame by any angle (round buildings), `kEDome` is an
  elliptical dome or cone, and `KF.rk` makes `kGable`/`kHip`/`kMansard` build a house style's own roof instead (`kRoofAlt`). Glows: `e` 2 is a lamp (it takes the era's lamp colour at night), `e` 3 keeps its own
  colour (beacons, signals, glowing stones), `e` in (0, 1) a window lit at night (`kLit`). There is no 2D view and no
  screen-space art any more. `test/modelshot.mjs` photographs any type up close.
- **Incidents** (incidents.js). Staged scenes at a real place that you can watch: a house fire (flames, dark smoke, a
  bucket chain from the nearest water or well, a crowd; saved or burnt down), sheep loose in the market (the flock
  wanders the square, townsfolk chase it, then drive it home), a wedding (a procession along the street with petals;
  the couple are married at the end), a river flood (water over the low ground, folk carrying things uphill; the town
  loses 3%), a runaway cabbage cart (it rolls downhill shedding cabbages, the farmer runs after it, children pick them
  up) and a whale on the beach (a crowd, buckets from the sea, then it slides free and blows). Moving ones set
  `st.fx/st.fz` so the film camera follows them. The sim part is `S.inc` (`INC[k]`: `yr` chance a year,
  `n` months, `begin()`, `end(I)` rolling the outcome), run monthly by `stepIncidents` on the sim's stream, so it's saved
  and replays; the view part is `INC_VIEW[k](I, st, p, dt)` (called from `glPeople`, state in `INCV`, never saved, `p` =
  `incProg` 0..1). The bus fires `incident {I}` and `{I, end: true}`; the film camera cuts to a new one. During catch-up
  an incident is just its two chronicle lines. `SF.incident(k)` starts one now. `test/incidents.mjs` covers them.
- **URL flags.** Open `seedfall.html` directly. `?seed=N&fresh` makes a scratch world (`SCRATCH`): it never
  saves anywhere (IndexedDB, folder or cloud) and never claims the cloud world, so it's safe on the live
  site. `&nointro` skips the landing, `&dev` adds an fps readout, opens the debug card and reports errors from building
  chunks and the moving things to the console, and `&headless` runs the world without drawing it (for tests).
- **Debug card.** Shift+D (or `?dev`) shows +10/+20/+50/+100 year leaps. They run through `runYears` (the same
  sliced runner as catch-up, so the page stays responsive), save afterwards, and "what happened?" opens the
  report card with the highlights.
- **Dev hooks (on `window.SF`).**
  - Time: `SF.ff(years)` fast-forwards, `SF.hour(h)` pins the clock (null means live).
  - Environment: `SF.weather(kind, secs)`, `SF.season({...})`.
  - State: `SF.state()`, `SF.save()`, `SF.relightNow()`.
  - Events: `SF.fx(kind, data)`, `SF.pray(kind)`, `SF.incident(kind)`.
- **Globals.** Top-level `let`s are reachable by name from `page.evaluate` (`S`, `M`, `GL3`, `DYN`,
  `towns()`...). `SF.cam` is `GL3.cam`.
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
(or whichever `chromium-*` folder is there) instead of downloading one. The sim is **deterministic per seed** (its own
seeded stream, see Randomness), so a `?seed=N&fresh` world fast-forwarded the same way grows the same every run;
comparing across seeds, ±10–15% in population is still just how worlds differ.

Pages open in **3D** (the only view), and headless Chromium draws 3D in software at about 1 fps, which starves clicks and
slow catch-ups. Tests of the sim, the panels and saves (`hover`, `needs`, `away`, `faith1`, `flow`, `streetmig`, `mapsize`, `incidents`, `voicetab`, `aitest`, `lots`) therefore use
`&headless` (`HEADLESS` in main.js: the world runs and the panels work, but nothing is drawn and WebGL is never started); the
3D view itself is covered by `glpick`, `glphone`, `glfilm`, `zones` and `soak`. Add `&headless` to a new test unless it is about the 3D view.

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
| `zones` | Towns draw their quarters, works in the works quarter, houses off the greens, terraces that agree from both ends, redevelopment, shops, the Z view, tooltips, and an older save drawing its zones. |
| `prayers` | Prayer words at three points in history: all well-formed (no `undefined`, lowercase sentence starts or overlong cards), 40+ different out of 60 per kind, early ones free of radios and seedships and late ones mentioning them. |
| `lots` | Bigger lots: landmarks spreading onto 2×1/2×2 lots, harbours growing to several berths, ships at their own berths, every tile of a lot pointing at it, saves keeping lots, removal freeing them. `SHOTS=1` adds 3D pictures. |
| `glfilm` | The film camera (shots in a row, varied, a touch hands the camera back, a minute later it carries on) and the season and weather reaching the 3D shader. `SHOTS=1` saves pictures. |
| `engine` | The same seed grows the same world; a save reloaded mid-way grows on identically; the event bus fires for chronicle lines, buildings, towns, techs and eras, and listeners that draw random numbers or throw change nothing; native 3D models build far and near. |
| `incidents` | All six kinds come along on their own (together about every 4 years) and always end; a wedding marries its couple; a flood costs a little; a fire starts at a house and ends saved or burnt down with a chronicle line; an incident under way survives a reload; every kind draws in 3D with no WebGL errors. |
| `mapsize` | Valley or wide lands: the welcome card and New world offer both, choosing the other size reloads at it, a plain reload remembers it, a world opened at the wrong size reloads at its own, and a 128 world by 1800 has more towns spread further with the same techs. Needs `npm run serve`. |
| `roads` | Road surfaces by era and material: dirt and gravel early, cobbles or bricks with Masonry, asphalt and concrete with Motorcars, glowlanes with Hovercraft, the market quarter keeping its cobbles, chronicle firsts, the tooltip, and an older save's roads converted. |
| `levers` | Words that pull every voice lever at once (mocked voice): each takes effect (an endless season, painted houses, faster building, more ships, Reverence, clean air, lit windows...), the Customs list and the brief show them, a bogus choice is ignored, a save keeps them. |
| `cloud` | Cloud mode against the real Worker (`wrangler dev` on :8787 with fresh KV, fake user, mock Anthropic; it starts and stops them itself). Welcome-card save.json import, save round trip, two-device conflict and take-over, newer local save (same revision and diverged), signed out (302 and 401), voice proxy (no key in the browser, model allowlist), footer save.json load, kept worlds (new, switch, forget), a `?fresh` scratch tab saving nothing, and file:// staying cloud-free. Needs the root `npm install`. |

**Inspection tools:**

- `sea1`: harbours, ships, ferries and planes over time.
- `planeshot`: follows a departing plane.
- `towns_tab`: screenshots the Towns tab.
- `econchron`: prints the economy chronicle.
- `planmap`: dumps a top-down town layout to `planmap.json`.
- `perf_mat`: cost of the material textures.
- `praysample`: prints sample prayers, answers and give-ups at a few points in history.
- `roadshot`: close-ups of the biggest town's streets at a few years, with a count of each surface.
- `glpick`: the 3D view's pointing and clicking: tooltips, the top of a tall building picking that building, following a person, a nudge landing where you click, a rebuilt chunk keeping its detail until the new one is ready (no flicker), and the N, P, T and R keys.
- `glphone`: the 3D view on a phone-sized touch screen: opening in 3D with no flag, tap to see what's there, pinch to zoom.
- `glshot`: screenshots of the 3D view (`?gl`) at noon, turned, evening and night, plus the time to build every chunk. `node glshot.mjs [seed] [year] [noon,night...]`.
- `worksshot`: close-ups of every production building in 3D, two frames apart, so you can see what moves. `node worksshot.mjs [seed] [years] [types]` (`OUT=dir`).
- `modelshot`: a catalogue of the building art: each type (or `monument:sub`, `house:tier`) set down on open ground in a paused world and photographed up close. `node modelshot.mjs [types|all] [year]` (`OUT=dir`, `HTML=path` for another build).
- `houseshot`: screenshots of the biggest town at a few years (`FLAT=1` for flat roofs, `ZONES=1` adds the zone view).

**Pacing baseline** (seeds 777, 999, 12345, 4242, 31337):

- **Techs:** 28 at year 1800 and 44 at 3500 (these are governed, so they should match).
- **Population:** about 300–370 at year 200, 17–21k at 1800, 55–70k at 2500, 95–130k at 3500.
- **Towns:** 5 at year 1800 and 6–7 at 3500.

**Headless screenshots:**

- **Camera:** set `GL3.cam.tx/ty/tz`, `zoom`, `pitch`, `yaw` and `auto = false` (and `GL3.follow = GL3.goto = null`).
- **Wait before shooting:** until `GL3.dirty.size === 0`, then a few seconds; the detailed near chunks build a tile a frame, so
  for close-ups build them at once (`glBuildChunk(k, true)`, `glAO`, `glUpload(ch, v, true)`; see worksshot/the house shots).
- **Weather and clock:** call `SF.weather('clear', 9999)` and `SF.hour(13)` so shots are comparable.

## Hosting (seedfall.rsvn.dk)

- **Worker** `worker/index.js` with config `wrangler.jsonc`. It serves `public/` as static assets and only
  runs code for `/api/*`: `GET /api/me`, `GET/PUT /api/save`, `POST /api/claim`, `POST /api/voice`, and the
  kept worlds (`GET /api/worlds`, `GET/PUT/DELETE /api/worlds/<wid>`).
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
  - `world:<id>:<wid>` is a kept world (at most 20), with metadata {planet, year, pop, savedAt, gz}. The wid
    is `seed-created`.
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
- **Kept worlds.** On the site the footer button is "Worlds…" (`openWorlds`). Starting a new world, switching,
  or loading a save.json first uploads the current one to `world:<id>:<wid>` (`keepWorld`); if that fails,
  nothing changes. Switching skips catch-up. From `file://` the button is still "New world…", and the old
  world goes to the folder's `worlds\`.
- **Tested locally:** save round trip, both conflict cases (409), a forged, expired or wrong-audience JWT
  (rejected), the voice model allowlist and the daily counter.

## Map of the source (`src/`)

| File | What lives there |
|---|---|
| head.html | All markup and CSS: HUD glass card, side panel and tabs, modals (speak, answer, voice setup, help), tool bar |
| util.js | Constants (`W=H` 64 or 128, `EH`, `SEAZ`, `SLAB`; heights are in pixels, 22 to a tile: `ZS`), rng, maths, colour helpers, the base64 table codec |
| data.js | `ERAS`, `TECHS` (with target years), `HT` house tiers, `BT` building types (work, height, anim/smoke), `SERV` rules for when towns build services, era styles, names and flavour lists |
| world.js | `BIO` biomes, map layers (`MAP_KEYS`, `newMap`), `genWorld` (terrain, sea, lakes, rivers, ore, ruins) |
| render.js | The art's primitives, tile-local that are left (`box`, `flat`, `ball`, `disc`, `ring`, `beam`, `lamp`; each hands to its gl.js twin; `DS` the style's shape turns boxes round), and what stands on each tile, built into its chunk by `drawTileObjects(i, x, y)`: ruins (`tileRuin`), hot springs (`glSpring`), ferry landings, the streetscape (`tileVerge`: furniture and street trees in a road tile's free corners by surface, town and quarter), rocks, open grass (`tileGround`) and gardens (`glYard`), all hashed from the tile so nothing is stored. Ground colours (`topColor`, `sideCol`), road colours, `bridgeZ`, `markDirty` (rebuilds the 3D chunk), `renderAll` |
| buildings.js | `drawBuilding(B, i)`: a native model first (`glModel`), else the few drawn here (the pod, the harbour, the turbine, the shipyard, and industry.js's pits, woodcutters and pasture). The house helpers everyone uses (`houseJoin`, `houseAx`, `rowMate`, `hk`, `houseTint` with the painted palettes `HPAL`, `shopfront`, `SHAPE_HM`/`SHAPE_WM`, `dsFlat`), material tint (`matStyle`), `dish`, `domeFrame`, building sites (`drawConstruction` hands to gl.js `glBuildSite`) |
| kit.js | The parts every native model is built from (see 3D models above): the frame (`KF`, `kSet`, `kSetB`, `kFace`, `kSide`, `kWalls`, `kP`), boxes and shapes, windows and doors by the age (`kWinTy`, `kWin`, `kWins`, `kDoor`), roofs (`kGable`, `kGableF`, `kHip`, `kFlat`, `kMansard`, `kChim`, `kDormer`), mouldings, balconies, awnings, signs, shopfronts, fences, gardens and yard things |
| light.js | Sun (synthetic 1 h or 20 min day, real sun over Horsens, or fixed), seasons by real date, the weather Markov chain and lightning (`strike`, a 3D bolt), `LIGHT.cur`/`LT` (what the art reads while a chunk builds: lamp and window colours by era and custom), and `lightTick` (every frame: sun, season, weather, `emK`/`nightK`/`dayK`, rebuilding the view when the art's light changes) |
| sim.js | World state `S`, `newState`, `mkBuilding`, `findSite` (all the site kinds), roads, rails, bridges, town growth (`planTown`/`buildTown`/`tryHousing`/`tryService`), founding, tech, eras and ages, events, `stepPeople`, `simMonth`, god tools |
| streets.js | Street plan (`M.plan`): organic lanes early, grid quarters from Masonry/Steam, `connectRoad`/`pavePath`, conversion of old saves' 4-grid streets. Road surfaces (`R_DIRT`…`R_GLOW`, `RCLS`, `R_NAME`, `R_COST`) and paving (`paveSurf`, `paveTown`) |
| econ.js | Timber, stone, clay, metal, goods, cloth and glass; extraction sites (incl. pastures and sand pits), crafts (`CRAFT`: weaver, glassworks), material choice, building costs, shortages, road and sea trade, "known for", Towns-tab readouts |
| needs.js | Town needs (`NEEDS`: water, milling, health, power grid, culture, news), worked out every 3 months from the buildings (`refreshNeeds`, never saved), their effects (`needGrowthK`, `lifeBonus`, `gridK`, `migrate`) and `tryNeeds`, which builds for whatever is missing. Also smoke (`SMOKY`, `sootK`, `pollution`, the `SOOT` ground tint that `topColor` reads), hot springs (`S.springs`, `springAt`), and the culture sites: `tryCulture` (bathhouse, theatre, Maker dig, botanical garden, guild hall) and `yearlyCulture` |
| zones.js | Zones each town draws for itself (`M.zone`: market core, homes, works quarter, greens) in `drawZones`, redrawn every 20 years or when outgrown (`yearlyZones`); `ZONE_OF`/`ZSC`/`zoneScore` feed `findSite`'s `zt` argument. Redevelopment (`redevelop`, `clearFields`, `tendGreens`), the `shops` building (`shopKind`; drawn in modern.js); the Z overlay is drawn in fx3d.js |
| incidents.js | Incidents you can watch: `INC` (the sim part: begin, end, outcome), `stepIncidents`/`startIncident`, `INC_VIEW` (the 3D part: flames, smoke, bucket chains, a flock and the people chasing it), `glIncidents` |
| people.js | Person model: traits, quirks, families, relationships |
| ai.js | Claude API (`aiFetch`, daily cap 80), world brief, tool schemas, `LEVERS` (every lever the words can pull) and `LVV`/`LVA`, `CULT` doctrines, `lever(k)` |
| levers.js | `applyLevers` (the style, every lever in `LEVERS`, names, a new town, crops, shunned buildings...), customs lists, sky lanterns (`stepLanterns`: glowing particles after dark) |
| prayers.js | The words of prayers: `prayCtx` (era band, season, weather, drought, smoke, needs, family, age), `PRAY_OPEN` + `PRAYERS[kind]` + `PRAY_CLOSE` pieces (each returns null when it doesn't fit), `OUTCOME`/`EXPIRE`, and `prayText`/`prayEnd`, which skip recently used pieces (`S.prayRecent`) |
| faith.js | Reverence (costs replace cooldowns), prayers (templated or Claude-written), answering |
| dyn.js | `DYN` (everything that moves, never saved), FX dispatch (`processFX`: the sim's `FXQ` into things to see), captions, walkers' upkeep (`syncWalkers`), herds, birds, Longstriders, rockets, and `updateDyn` (each frame) |
| agents.js | A* navigation, walkers with daily schedules, vehicles, caravans, trade wagons, and keeping the right number of them about (`syncPeople`) |
| sea.js | Water bodies, harbours, sea routes, ships by era (sail, steamer, freighter, boxship, hover), fishing boats (out at dawn, home at dusk), ferries |
| air.js | Planes that use airfields: apron, taxi, roll, climb, cruise, final approach, land, park (and the one waiting on each apron, `DYN.af[id].pp`) |
| gl.js | **The 3D view** (the only view; without WebGL2 a note says so and the world still grows): the world in real 3D with WebGL2. Chunks of 8×8 tiles are built by running the building art with `GLB` set, which makes the render.js primitives emit triangles; terrain, roads, trees, lamps and people are built here. Per-pixel sun or moon with a 2048² shadow map, sky/ground ambient, bounce light, lit windows, and up to 64 nearby street lamps as point lights. Keys R, N, T, P (perspective, the default, or an isometric, orthographic lens); drag and wheel. In perspective the far valley fades into the sky (`uFog*`) and the camera keeps above the rooftops. Picking: every vertex carries an id (tile index + 1, or `GPID` + walker index), a half-size id pass is drawn when the pointer moves and one pixel is read back, so tooltips (`glTip`), the hover glow (`uHi`) and clicks (`glClick`: nudges land on that tile, a person opens their card and the camera follows) hit exactly what's under the pointer. Touch: one finger turns, two pinch and pan, a tap picks (`GL3.tapAt`). Textures are painted in code at start-up (`glTextures`, ~0.4 s: grass, brick, clay tiles, slate, bark, leaves, plaster, stone, planks, cobbles, asphalt, earth) into a texture array; every vertex carries a material (`GLB.mat`: walls from `glWallMat(B)`, roofs by colour via `roofMat`, ground by biome, roads by surface) and the shader lays the texture on by world position (triplanar), mixing its own colour in by `TX.RAW`; `TX.BUMP` turns each texture's own light and dark into relief (two extra samples tilt the normal, so mortar, tile edges and seams catch the sun). Light: ambient occlusion is baked per vertex (13th float) when a chunk builds: `hfRaster` writes the chunk's non-vertical, not-tiny triangles into a valley height map `HF` (8 cells a tile), then `aoAt` looks eight ways for how much sky each vertex sees (`glAO`, memoised per corner); ground next to buildings is subdivided (`glBusy`) so the soft shadow at their feet has vertices, and a chunk whose edges changed re-bakes its neighbours. A sky pass (`GL_SKY`'s `skyCol`: gradient, gold and rose round a low sun, sun disc, stars) draws first and the haze takes the sky's colour in that direction; an open sea (`GL3.sea`) runs to the horizon. The view renders into a 4× multisampled framebuffer whose alpha is a glow mask (lit windows, lamps, water glints, the sun); `glBloom` blurs that down to 1/32 and adds it back (the widest levels fade). It unbinds texture unit 1 first: last frame's glow is still bound there, and drawing into it is a feedback loop that WebGL silently skips, which leaves old glows frozen on screen (`glpick` checks `gl.getError()`). Only the sun's disc glows, not the bright sky round it. Leaves get wrap lighting. Foliage and small life: `tuft`, `flowers`, `streetTree`, `parkTree`, `sheep` and `drawYard` hand over to `glTuft`/`glFlowers`/`glTreeAt`/`glSheep`/`glYard` when `GLB` is set (`glAt` finds what a lifted point stands on); herds walk in `glPeople`. Moving things are rebuilt every frame in `glPeople` from jointed boxes (`glOBox`, `glLimb` swung about the body's right axis): `glPerson` (legs and arms swing opposite on the walker's `ph`, a step bob or breathing, hair, era hats, a lantern that is also a point light via `GL3.carry`, the dog), `glVehicle` (cart with a walking horse, cars 1.6× life size with headlamps, hover pods), walking sheep; `glHeading` turns them smoothly. In 3D `syncPeople` keeps 2.5× the walkers (and twice the vehicles); to afford it, `glOBox` writes faces with known normals (no bottoms) straight into a reused `GLFBuf`, and `glPerson` has levels of detail by distance from `GL3.eye` (full figure, no hats or dog past 12, a body and head past 30). Detail and cost: chunk vertices are packed to 28 bytes for the GPU (`glPack`, decoded in `GL_VS` when `uPk`), chunks outside the view frustum are skipped (`glFrustum`/`glSees`, padded for big lots), and chunks within ~11 tiles of the camera (7 when zoomed out, none past 15) get a second, detailed version (`glBuildChunk(k, true)` sets `GLB.lod`; one built a frame, dropped out of range, `ch.nb`/`ch.near`). When a chunk changes and its plain version is rebuilt, its detailed version stays on screen (`ch.stale`) until a fresh one replaces it: dropping it straight away made busy streets flicker between plain and detailed every few seconds. Building sites are 3D too (`glBuildSite`, from `drawConstruction`): walls rising inside timber (later steel) scaffolding with planks, materials stacked by, a tower crane on tall ones, and a house being done up stays standing inside its scaffolding. Shadows and picking use the plain one. The old shared primitives that are left (`glBox` with plinth, cornice and curtain-wall mullions on `M_GLASS`; `glWindows`→`glWinDetail`, which some towers still use; `glCylAt`; `glChimney`, `glDormer`, `glMansard`, `glYard`→`glYardBits`) keep their close-up detail behind `GLB.lod`; most of what a building looks like now comes from the kit (see 3D models). Keep new detail behind `GLB.lod` and use `glFace` (one quad) over `glOBox` where it's flat. Straw roofs map to `M_THATCH`. Smoke is a point-sprite pass (`GL_SMVS/SMFS`, `glSmoke`/`glSmokeStep`: chunk `lamps.smk` points near the camera, nearest first, plus `SMOKE_AT` on works; more in winter). Every `gtri`/`gquad` colour must be an array (`gcol(...)`): a string there turns the vertex array generic and doubles build time. `GLB` is created with every field it will ever get (one shape keeps the primitives fast), and near chunks build a tile at a time. Seasons and weather are painted live in the shader, never baked into chunks (`GLT_FLAT` zeroes `LT.leaf`/`grass`/`snow`): `uSea` (autumn, winter, spring from `seasonNow`, and `S.wx.sc` snow lying) turns leaves (`M_LEAF`; pines are `M_NEEDLE` and stay green), fades grass, adds blossom and settles snow on up-facing surfaces; `uWx` (rain, cloud cover, lightning) darkens wet ground, adds puddle reflections, cloud shadows (noise drifting with `uT`) and the flash. The sky pass draws a drifting cloud layer (`uCT`); `GL_PFS2` is a screen-space pass of falling rain or snow (blended so the glow mask in alpha stays); weather fog pulls `uFog0/uFogL` in. The film camera (`glDirector`/`glShot`, on when `cam.auto`, R toggles): after `FILM_IDLE` s without input (`glTouch` marks input; a person you clicked keeps it 3× longer) it picks a shot every 20-34 s (new chronicle entries with a place first, then ships coming in, a named walker, a train, a big lot, a town, the harbour at golden hour), glides there, turns slowly round it and shows a caption (`glCap`). `test/glfilm.mjs` checks both. The camera tips up over tall buildings using `HF` (for that frame only, easing back down; `cam.pitch` stays what you chose), and zooms in to 1.2. Fields, pastures and plazas set `GLB.flat` so `glFlat` picks soil, crop, grass or paving. The world is realistic too: Earth crops, sheep, oaks, pines and birches from the vault (the tech id `sunroot` stays for old saves). The film camera also takes hints from the world (`camHint`: a pod landing, a launch, starfall, fireworks, a caravan; it cuts in when free) and a workplace now and then (`glWorkShot`). Clicks in the panels use `camLook` (go there) and `camFollow` (follow a person). |
| works.js | Work you can watch, in 3D. The still parts some production types lacked (their older art was lines and flat shapes, nothing in 3D): `glPit(u0, v0, ...)` (banks stepped down to a floor), `glLogPile`, `glMineFrame`, `glDerrick`, `glDryFrame`, `glTurbine`, `glShipyard`. And `GLW[type](B, c)`, the moving parts, rebuilt every frame by `glWorks` (from `glPeople`, nearest the camera's target first): mill sails and turbine blades (`wkSpin`, faster in wind), harbour cranes and gantry trolleys (taken out of `glHarbour`), the mine's wheel and cage, the quarry derrick, flywheels at the works and power house, cloth on the weaver's frame, kiln and furnace glow; and by day (6:30-20) workers within `WKP` tiles, at most `WKN` (`wkMan`: `glPerson` with `o.arms` holding a pose, `wkTool` for axe, pick, hammer, spade, hoe, `wkBits` for chips and sparks), a shepherd's dog (`glDog`), farm hands by season and tractors from Motorcars. View only: `GL3.t` and hashes, nothing saved. `glWorkShot` gives the film camera a workplace shot |
| house.js | The worker house, modelled properly (`glWorkerHouse`, handed the tier-4 rowhouse before Computing by homes.js when `whFits`). It faces its street, joins its terrace (`houseJoin`), and is built in world units along the street (s), out to it (f) and up (y): plinth, brick walls, sash windows in frames with sills, lintels and keystones, brick arches, a doorcase with fanlight and hood, string course, bracketed cornice, quoins, a roof with ridge roll, fascia, gutter and downpipe, chimney stacks on the party walls (`glChimney`), dormers, a bay, window boxes, a back range and a shopfront in the market quarter. The kit (kit.js) grew out of it |
| homes.js | `GL_MODEL.house`: every house tier from the kit, in every style: `hRound` (round and organic houses: windows all round via `kRot`, a cone or a dome, organic ones with round-headed windows and a domed annex; round glass towers and round terraces), `hTiered` (stepped terraces with planted ledges), tall and low styles stretch the usual model afterwards (`hScale`, smoke points too), and dome, cone or pyramid roofs swap the roof (`KF.rk`). Public buildings and workplaces keep their own forms whatever the style; a flat-roof style gets parapets, a garden one grass. `hShelter` (salvaged canvas on crossed poles, a fire, a tripod, pod crates), `hHut` (round wattle and daub, a cone of thatch, a woodpile, a pen), `hCottage` (stone, plaster, brick or timber; a wing, a porch, a gable-end stack; a garden with path, fence or hedge and gate, flowers, a water butt; a kitchen garden, washing line or apple tree out the back), `hTown` (timber-framed and jettied while the old styles last, gable or eaves to the street, an oriel, a shopfront and sign in the market quarter; terraces), the worker house (house.js), `hRow4` (the glass-age townhouse, or a flat-roofed brick one), `hFlats` (an engineers' block with iron balconies and a mansard, a deco block, a brick mansion block; then concrete and glass with balconies, a penthouse and roof garden, planted balconies or fins), `hTower`, `hArco`. `hSet` finds the street side like the worker house, so mixed rows agree; `hRoofline` keeps a street's roofline. Cottages and smaller bring their own gardens (render.js `glYard` stands back) |
| civic.js | The public buildings from the kit: school (bell cupola, yard), library (portico, dome on a drum), town hall (clock tower, balcony, flags), clinic (lit cross), theatre (marquee bulbs, fly tower), museum (colonnade, banners, glass lantern), guildhall (crow-stepped gable, arcade, banner), bathhouse (dome, apses, steam), observatory (gallery, slit, telescope), station, university, dock (boathouse, pier on piles, boat), lighthouse (gallery, lantern room), market. Then the big lots (`GL_BIG`: hall, museum, theatre, station with its iron-and-glass train shed, market place or market hall, university quad), framed by `cBig` along `glFacing` |
| industry.js | The workplaces from the kit, in a fixed frame (`iSet`) so works.js's moving parts and workers and `SMOKE_AT`'s smoke line up: smithy, windmill (tapered tower, reefing stage, cap, fantail), woodcutters (a notched log cabin; `drawLumber`), mine (adit, ore tub, a Cornish engine house from Steam), quarry, clay pit (brick hacks, bottle kiln), sand pit, weaving house, glassworks (the cone), works (sawtooth north lights), power house (arched hall, twin stacks, switchyard), warehouse (loading doors, hoist loft), water tower (cistern, then a riveted tank on a braced frame), pasture (`drawPasture`), and farms (`GL_MODEL.farm`: crops by kind in the rows works.js's hands walk, furrows, a hedgerow, wall or fence only where the field ends, a gate, an oak in the hedge, a scarecrow, now and then a barn; round pivot fields and orchards for those styles). `iStack` is a banded brick chimney |
| modern.js | The rest from the kit: shops (`sub`: a row of little shops, an arcade under glass, a department store with its name in lights, offices), plaza (the village fire, then a fountain or statue), park, botanic garden (palm house), the Maker dig, radio mast, weave relay, solar field, gene garden, airfield, stadium (`mStands`, `mPitch`, `mFloods`; and on its 2×2 lot), launchpad (the rocket stands at the middle for fx3d.js), fusion plant (and on its lot), climate engine, garden dome, the space elevator's anchor, and the ten monuments |
| fx3d.js | The world's moments in 3D. Particles (`DYN.parts`, `part3`, `SMOKE3`: smoke, mist, dust, rain, sparks, fire, lanterns) drawn as point sprites in two passes (soft ones blended and dimmed at night, glowing ones added into the bloom mask); see-through triangles (`glTr`: lighthouse beams, the Z zone view, the ring under a nudge, lightning). The nudges and the sky (`stepFx3`): the rain nudge's cloud and rain, bloom sparkles, fireworks, starfall, supply pods under parachutes, rockets and the seedship, comets, shooting stars, satellites, the station and the ring (`skyThings`, far off along a direction), hot-spring steam, the climate engine's mist. Solid moving things (`glFxDyn`, from `glPeople`): rockets, pods, the landing pod (`startIntro`/`stepIntro`: the arrival, with the camera), birds, Longstriders (`glGiant`), balloons, airships, planes, drones and shuttles (`stepFlyers`, `glFlyer`), caravans, trade wagons (`glTrader`), the helper drone, diamonds over the people you know (`glMark`) and prayer candles. Words laid over the view (`glOverlay`, HTML placed by projecting): floating captions and the names of places. The camera helpers `camLook`, `camHint`, `camFollow` |
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
- **What's built into chunks.** Change a tile, then call `markDirty(i)`: its 3D chunk is rebuilt. Everything that stands
  on a tile goes through `drawTileObjects`. Light and shade are the shader's: the art picks plain colours (`LT` is flat
  while a chunk builds) and marks what glows (`e` 2 for lamps, `e` in (0, 1) for windows lit at night, `-1` water).
- **Moving things** are rebuilt every frame in `glPeople` (people, herds, incidents, traffic, works, `glFxDyn`); particles
  and see-through things are fx3d.js's. All of it runs on `Math.random` and `GL3.t`: never the sim's stream.
- **Chronicle.** `chron(icon, text, { T | x,y, k: 'major', cap })`. Rate-limit ambient lines: the
  economy and streets use `S.econYr`, `T.swYr` and similar.
- **Voice levers.** The flow is: Claude's tool call, then `applyLevers`, then doctrine `d.lv`, then
  `recomputeCulture`, then `lever(k)` (the sim, deterministic: it reads saved doctrines) or `LVV[k]` (the view, every
  frame). Every lever is one entry in `LEVERS` (ai.js): `k` its name, `f` the tool's field, `o` the choices and what
  each does, `n` its Customs label, `d` the tool's description, `art: 1` if buildings or ground show it. The tool schema,
  `LV_KEYS`/`LV_TXT`, `applyLevers`, the brief and the Customs list all come from that table, so adding a lever is the entry
  plus whatever reads it. Art levers go into `LVA`, which is part of light.js's art key, so the view rebuilds when they
  change. In force: nature, growth, streets, material, lights, weather, seasons (`seasonFor`), sky (`SKY_TINT`, the aurora
  in `GL_KFS`), housecol (`HPAL` in `houseTint`; painted houses render over brick and stone), trees (`TREE_LV` in
  `glTrees`/`glSmallTree`), deco (`tileDeco`; flower boxes in `kWin`), bedtime (`litFrac`), clothes (`clothOf`), hats, pets
  (`glCat`), bustle (`syncPeople`), birds and fireworks (`updateDyn`), pace (`paceK`), trade (`stepTrade`), sea (`shipCap`),
  faith (`faithRecalc`, shrines in `CULT.bld`), smoke (`sootK`). `test/levers.mjs` pulls them all at once.
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
- **Retiring buildings.** `RETIRE` in needs.js (`yearlyRetire`, run from `yearlyIndustry`): granaries after Rail, wells after Concrete, windmills after Gene Gardens come down one at a time per town (the oldest well and mill stay, `B.old`), and `SERV`'s `until` stops them being built. The fusion plant retiring power houses is the older, separate case.
- **Roads.** `M.road` holds a surface (1 dirt, 2 gravel, 3 cobbles, 4 bricks, 5 asphalt, 6 concrete, 7 glowlane), not a tier. New roads go down as `laySurf()`; `paveTown` (every 3 months per town) upgrades a few tiles, centre first, paying `R_COST` from the town's stores (35% chance to go ahead anyway when short). Code that wants the old width/lamp/bridge tier uses `rcls(i)`. Saves from before (`S.roadV < 2`) are converted in `deserialize`.
- **Zones.** `M.zone` is a saved map layer (older saves get zones drawn in `zonesOnLoad`). Zones are soft: `findSite(T, kind, extra, zt)` adds `zoneScore(zt, i)`, never filters, so pass the building type as `zt` from new callers. Redevelopment is rate-limited (one project per town every 4+ years, fields a bit faster); keep it that way or towns turn into permanent scaffolding.
- **Houses and terraces.** `GL_MODEL.house` (homes.js) builds every house from the kit; `houseTint` tints it and its extras roll from `hk(B, n)` (hashed from the id, so they're stable). Tier 3–5 houses on the same street join up (`houseJoin`: same axis `B.ax`, town, height of ground, not round styles) and run to the tile edge; data stays one building per tile. Anything that changes a house (`mkBuilding`, upgrade start, completion, `removeBuilding`) calls `houseNbrDirty` so the neighbours redraw.
- **Bigger lots.** A building can cover `B.w × B.h` tiles from `(B.x, B.y)` (sim.js, next to `mkBuilding`): every tile's `M.bld` points at it,
  `fpTiles`/`fpFront`/`fpOff` give its tiles, the tile it's drawn from (nearest the viewer) and the shift to the lot's middle, and
  `removeBuilding` frees them all. Only `mkBuilding`, `removeBuilding` and `fpGrow` write `M.bld`. Landmarks in `FP_BIG` (hall, museum, theatre, station, market 2×1; university, stadium, fusion 2×2) spread once
  built (`fpSettle`, a few a year in `yearlyFootprints`, so older worlds catch up) onto ground that gives way (`fpYield`: free, or a
  house of tier ≤3, a field, a pasture); a full town clears an old cottage with room for the lot (`landmarkSite`). Harbours grow
  along their shore (`yearlyHarbours`, `harbourLen` by population and era, over the shallows too) with a berth per tile
  (`berths`, `berthTile`, ships keep `DYN.slot[bkey(B, k)]`). In 3D, `GL_BIG[type]` and `glHarbour` draw them; `glTraffic` draws ships,
  fishing boats, ferries, trains and planes. `test/lots.mjs` checks all of it (`SHOTS=1` for pictures).
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
2. **Bigger worlds**: done as a choice per world (64 or 128).
3. **3D only**: done. The 2D view is gone, and every building type has a detailed native model built from the kit
   (kit.js: homes, civic, industry, modern), houses in every style the voice can ask for included.
