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
- **URL flags.** Open `seedfall.html` directly. `?seed=N&fresh` makes a scratch world (`SCRATCH`): it never
  saves anywhere (IndexedDB, folder or cloud) and never claims the cloud world, so it's safe on the live
  site. `&nointro` skips the landing, and `&dev` adds an fps readout and opens the debug card.
- **Debug card.** Shift+D (or `?dev`) shows +10/+20/+50/+100 year leaps. They run through `runYears` (the same
  sliced runner as catch-up, so the page stays responsive), save afterwards, and "what happened?" opens the
  report card with the highlights.
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

Pages open in **3D** by default, and headless Chromium draws 3D in software at about 1 fps, which starves clicks and
slow catch-ups. Tests of the sim and the panels (`hover`, `needs`, `away`, `faith1`) therefore add `&2d`; the 3D view
itself is covered by `glpick`, `glphone` and `soak`. Add `&2d` to a new test unless it is about the 3D view.

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
| `roads` | Road surfaces by era and material: dirt and gravel early, cobbles or bricks with Masonry, asphalt and concrete with Motorcars, glowlanes with Hovercraft, the market quarter keeping its cobbles, chronicle firsts, the tooltip, and an older save's roads converted. |
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
- `glpick`: the 3D view's pointing and clicking: tooltips, the top of a tall building picking that building, following a person, a nudge landing where you click.
- `glphone`: the 3D view on a phone-sized touch screen: opening in 3D with no flag, tap to see what's there, pinch to zoom, the 2D/3D switch.
- `glshot`: screenshots of the 3D view (`?gl`) at noon, turned, evening and night, plus the time to build every chunk. `node glshot.mjs [seed] [year] [noon,night...]`.
- `houseshot`: screenshots of the biggest town at a few years (`FLAT=1` for flat roofs, `ZONES=1` adds the zone view).

**Pacing baseline** (seeds 777, 999, 12345, 4242, 31337):

- **Techs:** 28 at year 1800 and 44 at 3500 (these are governed, so they should match).
- **Population:** about 300–370 at year 200, 17–21k at 1800, 55–70k at 2500, 95–130k at 3500.
- **Towns:** 5 at year 1800 and 6–7 at 3500.

**Headless screenshots:**

- **Camera:** set `CAM.x/y/z` and `CAM.tx/ty/tz` directly, plus `CAM.manualUntil = DYN.t + 999`. (That's the 2D camera, with `&2d`. In 3D set `GL3.cam.tx/ty/tz`, `zoom`, `pitch`, `yaw` and `auto = false`.)
- **Wait before shooting:** give it ~2 s for occlusion sprites (they're built at 5 ms per frame).
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
| util.js | Constants (`W=H=64`, `TW2=16`, `TH2=8`, `EH=6`, `RS=2`, `SEAZ`, `OX/OY`, `STATIC_W/H`), rng, maths, colour helpers, the base64 table codec |
| data.js | `ERAS`, `TECHS` (with target years), `HT` house tiers, `BT` building types (work, height, anim/smoke), `SERV` rules for when towns build services, era styles, names and flavour lists |
| world.js | `BIO` biomes, map layers (`MAP_KEYS`, `newMap`), `genWorld` (terrain, sea, lakes, rivers, ore, ruins) |
| render.js | Static layer: tiles, cliffs, water, roads and bridges (pavements, zebra crossings), rails, lamps, trees, rocks, and the streetscape (`drawVerge`: furniture and street trees in a road tile's free corners, by surface, town and quarter; `drawGround`: tufts and flowers on open grass; `drawYard`: hedges and bushes round small houses), all hashed from the tile so nothing is stored. Primitives `box`/`flat`/`cyl`/`cone`/`dome`/`roofGable`/`roofPyr`/`windows`/`door`. `DS` (building shape style) and `DM` (material texture) draw state. `markDirty`, dirty rects, bounding boxes |
| buildings.js | `drawBuilding` per type, material tint (`matStyle`), extraction sites, harbour and lighthouse art |
| light.js | Sun (synthetic 1 h or 20 min day, real sun over Horsens, or fixed), seasons by real date, weather Markov chain, `LT` light params, the progressive relight job with 3.5 s crossfade, cast shadows, emissive glows (`emit`) |
| sim.js | World state `S`, `newState`, `mkBuilding`, `findSite` (all the site kinds), roads, rails, bridges, town growth (`planTown`/`buildTown`/`tryHousing`/`tryService`), founding, tech, eras and ages, events, `stepPeople`, `simMonth`, god tools |
| streets.js | Street plan (`M.plan`): organic lanes early, grid quarters from Masonry/Steam, `connectRoad`/`pavePath`, conversion of old saves' 4-grid streets. Road surfaces (`R_DIRT`…`R_GLOW`, `RCLS`, `R_NAME`, `R_COST`) and paving (`paveSurf`, `paveTown`) |
| econ.js | Timber, stone, clay, metal, goods, cloth and glass; extraction sites (incl. pastures and sand pits), crafts (`CRAFT`: weaver, glassworks), material choice, building costs, shortages, road and sea trade, "known for", Towns-tab readouts |
| needs.js | Town needs (`NEEDS`: water, milling, health, power grid, culture, news), worked out every 3 months from the buildings (`refreshNeeds`, never saved), their effects (`needGrowthK`, `lifeBonus`, `gridK`, `migrate`) and `tryNeeds`, which builds for whatever is missing. Also smoke (`SMOKY`, `sootK`, `pollution`, the `SOOT` ground tint that `topColor` reads), hot springs (`S.springs`, `springAt`), and the culture sites: `tryCulture` (bathhouse, theatre, Maker dig, botanical garden, guild hall) and `yearlyCulture` |
| zones.js | Zones each town draws for itself (`M.zone`: market core, homes, works quarter, greens) in `drawZones`, redrawn every 20 years or when outgrown (`yearlyZones`); `ZONE_OF`/`ZSC`/`zoneScore` feed `findSite`'s `zt` argument. Redevelopment (`redevelop`, `clearFields`, `tendGreens`), the `shops` building (`shopKind`, `drawShops`) and the Z overlay (`drawZoneView`) |
| people.js | Person model: traits, quirks, families, relationships |
| ai.js | Claude API (`aiFetch`, daily cap 80), world brief, tool schemas, `CULT` doctrines, `lever(k)`, `LV_KEYS`/`LV_TXT` |
| levers.js | `applyLevers` (style, nature, growth, streets, materials, lights, weather, names...), customs lists, map labels, sky lanterns |
| prayers.js | The words of prayers: `prayCtx` (era band, season, weather, drought, smoke, needs, family, age), `PRAY_OPEN` + `PRAYERS[kind]` + `PRAY_CLOSE` pieces (each returns null when it doesn't fit), `OUTCOME`/`EXPIRE`, and `prayText`/`prayEnd`, which skip recently used pieces (`S.prayRecent`) |
| faith.js | Reverence (costs replace cooldowns), prayers (templated or Claude-written), answering |
| dyn.js | `DYN` (per-frame, never saved), camera, particles, clouds and sky, FX dispatch, `drawFrame` order (static, agents, planes in the air, clouds, grade, sky, night light + lighthouse beams) |
| agents.js | A* navigation, walkers with daily schedules, vehicles, caravans, trade wagons, occlusion sprites, depth-sorted `drawAgents`, building animations (mill, turbine, chop, dig, crane, beam...) |
| sea.js | Water bodies, harbours, sea routes, ships by era (sail, steamer, freighter, boxship, hover), fishing boats (out at dawn, home at dusk), ferries, lighthouse beams |
| air.js | Planes that use airfields: apron, taxi, roll, climb, cruise, final approach, land, park |
| gl.js | **The 3D view** (the default; `?2d`, the 2D/3D switch or no WebGL2 gives the flat canvas view): the world in real 3D with WebGL2. Chunks of 8×8 tiles are built by running the normal art with `GLB` set, which makes the render.js primitives emit triangles (2D-only strokes are skipped); terrain, roads, trees, lamps and people are built here. Per-pixel sun or moon with a 2048² shadow map, sky/ground ambient, bounce light, lit windows, and up to 64 nearby street lamps as point lights. Keys R, N, T, P (perspective, the default, or the isometric lens of the 2D view); drag and wheel. In perspective the far valley fades into the sky (`uFog*`) and the camera keeps above the rooftops. Picking: every vertex carries an id (tile index + 1, or `GPID` + walker index), a half-size id pass is drawn when the pointer moves and one pixel is read back, so tooltips (`glTip`), the hover glow (`uHi`) and clicks (`glClick`: nudges land on that tile, a person opens their card and the camera follows) hit exactly what's under the pointer. Touch: one finger turns, two pinch and pan, a tap picks (`GL3.tapAt`). Textures are painted in code at start-up (`glTextures`, ~0.4 s: grass, brick, clay tiles, slate, bark, leaves, plaster, stone, planks, cobbles, asphalt, earth) into a texture array; every vertex carries a material (`GLB.mat`: walls from `glWallMat(B)`, roofs by colour via `roofMat`, ground by biome, roads by surface) and the shader lays the texture on by world position (triplanar), mixing its own colour in by `TX.RAW`. Light: ambient occlusion is baked per vertex (13th float) when a chunk builds: `hfRaster` writes the chunk's non-vertical, not-tiny triangles into a valley height map `HF` (8 cells a tile), then `aoAt` looks eight ways for how much sky each vertex sees (`glAO`, memoised per corner); ground next to buildings is subdivided (`glBusy`) so the soft shadow at their feet has vertices, and a chunk whose edges changed re-bakes its neighbours. A sky pass (`GL_SKY`'s `skyCol`: gradient, gold and rose round a low sun, sun disc, stars) draws first and the haze takes the sky's colour in that direction; an open sea (`GL3.sea`) runs to the horizon. The view renders into a 4× multisampled framebuffer whose alpha is a glow mask (lit windows, lamps, water glints, the sun); `glBloom` blurs that down to 1/32 and adds it back (the widest levels fade). It unbinds texture unit 1 first: last frame's glow is still bound there, and drawing into it is a feedback loop that WebGL silently skips, which leaves old glows frozen on screen (`glpick` checks `gl.getError()`). Only the sun's disc glows, not the bright sky round it. Leaves get wrap lighting. Foliage and small life: `tuft`, `flowers`, `streetTree`, `parkTree`, `sheep` and `drawYard` hand over to `glTuft`/`glFlowers`/`glTreeAt`/`glSheep`/`glYard` when `GLB` is set (`glAt` finds what a lifted point stands on); herds walk in `glPeople`. Moving things are rebuilt every frame in `glPeople` from jointed boxes (`glOBox`, `glLimb` swung about the body's right axis): `glPerson` (legs and arms swing opposite on the walker's `ph`, a step bob or breathing, hair, era hats, a lantern that is also a point light via `GL3.carry`, the dog), `glVehicle` (cart with a walking horse, cars 1.6× life size with headlamps, hover pods), walking sheep; `glHeading` turns them smoothly. In 3D `syncPeople` keeps 2.5× the walkers (and twice the vehicles); to afford it, `glOBox` writes faces with known normals (no bottoms) straight into a reused `GLFBuf`, and `glPerson` has levels of detail by distance from `GL3.eye` (full figure, no hats or dog past 12, a body and head past 30). The camera tips up over tall buildings using `HF` (for that frame only, easing back down; `cam.pitch` stays what you chose), and zooms in to 1.2. Fields, pastures and plazas set `GLB.flat` so `glFlat` picks soil, crop, grass or paving. The world is realistic too: Earth crops, sheep, oaks, pines and birches from the vault (the tech id `sunroot` stays for old saves). It starts in 3D (`GL_DEFAULT`; `?2d` forces 2D, `?gl` forces 3D, the choice is remembered in localStorage) with a 2D/3D switch (`glToggle`). The sim, saves and UI are shared: 3D is only a different way of drawing the same `S`/`M` |
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
- **Roads.** `M.road` holds a surface (1 dirt, 2 gravel, 3 cobbles, 4 bricks, 5 asphalt, 6 concrete, 7 glowlane), not a tier. New roads go down as `laySurf()`; `paveTown` (every 3 months per town) upgrades a few tiles, centre first, paying `R_COST` from the town's stores (35% chance to go ahead anyway when short). Code that wants the old width/lamp/bridge tier uses `rcls(i)`. Saves from before (`S.roadV < 2`) are converted in `deserialize`.
- **Zones.** `M.zone` is a saved map layer (older saves get zones drawn in `zonesOnLoad`). Zones are soft: `findSite(T, kind, extra, zt)` adds `zoneScore(zt, i)`, never filters, so pass the building type as `zt` from new callers. Redevelopment is rate-limited (one project per town every 4+ years, fields a bit faster); keep it that way or towns turn into permanent scaffolding.
- **Houses and terraces.** `drawHouse` tints each house (`houseTint`) and rolls its extras from `hk(B, n)` (hashed from the id, so they're stable). Tier 3–5 houses on the same street join up (`houseJoin`: same axis `B.ax`, town, height of ground, not round styles) and are drawn by `drawRow` to the tile edge; data stays one building per tile. Anything that changes a house (`mkBuilding`, upgrade start, completion, `removeBuilding`) calls `houseNbrDirty` so the neighbours redraw. `casterDims` widens a joined house's shadow.
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
