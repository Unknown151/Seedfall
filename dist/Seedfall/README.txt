SEEDFALL
A world that grows while you work.

START
  Double-click "Start Seedfall.bat" (opens Edge fullscreen),
  or open seedfall.html in Edge or Chrome and press F.

FIRST RUN
  Click "Choose a save folder..." and pick the "world" folder next to this file.
  Seedfall keeps these in it:
    save.json      the whole world (autosaved every 45 s and whenever you switch away)
    chronicle.md   the readable history, appended as it happens
    stats.csv      one row per sim year: population, towns, buildings, ideas...
    backups\       one save per day, last 14 kept
    worlds\        old worlds, archived when you start a new one
  After a browser restart, Edge may need one click on the page to re-allow
  folder access (a small banner tells you). It also keeps a copy in the browser.

WORLD SIZE
  A new world is either a valley (64 x 64 tiles, the classic size) or wide lands
  (128 x 128: four times the ground, twice the towns, spread further apart). Pick
  on the welcome card or when you start a new world. Wide lands ask more of the
  PC and take longer to catch up after time away. The page reloads itself when it
  opens a world of the other size, and it remembers the size you last used.

TIME
  The world pauses whenever the tab isn't visible. When you come back it catches up on
  the time you were gone, but at most 8 hours of it (and never more than 250 years),
  and a card tells you what you missed. With a voice key, a town historian writes you
  a short letter about it too (only after 30 minutes or more away). Paused (Space)
  time doesn't count.
  Normal pace: 1 year every 3 minutes, roughly 160 years per workday.
  Villages on day one, trains around week 2, rockets around week 3, the end of the
  Archive around week 5. After that it keeps going: open-ended cultural Ages, new
  architecture styles, wonders, a language that slowly drifts.
  Pace can be changed in the chronicle panel (Relaxed / Normal / Brisk / Preview).

PEOPLE
  The named people (leaders, inventors, artists, the Founder's family...) walk
  around their towns wearing a small diamond: gold = leader, green = close family
  of the Founder. Hover one to see their stats, guilty pleasure, secret fear,
  hobby, favourite food, catchphrase, family, friends and rivals. Click to open
  them in the panel (C > People), where relatives are clickable.
  Everyone has a home and somewhere to work (the smith at the workshop, the
  teacher at the school, farmers out in the fields). They walk the streets to
  get there, run errands to the market and the well, stroll to the park in the
  evening and go indoors at night, so the streets are busy at rush hour and
  quiet at 3 am. Carts and cars drive between buildings and towns on the roads.
  Anyone walking behind a building is hidden by it; the diamonds over named
  people stay visible so you can still find them.

THE WATCHER'S VOICE (optional, uses Claude)
  Press 6 to speak to your people (up to 280 characters). With an Anthropic API key
  (C > Voice...), Claude reads your words plus a summary of the world and decides how
  the colonists understand them: a name for the teaching, chronicle beats over the next
  century, small nudges to what kind of children are born, what gets built, which
  festivals and fashions appear. Teachings slowly fade unless you speak again.
  Your words can also change how the world looks and behaves. Claude picks the levers
  that fit what you said:
    architecture   a new building style: round, square, tall, low, tiered or organic
                   shapes; flat, gable, pyramid, dome, cone or garden roofs; wall, roof
                   and accent colours; round, striped, flower or orchard fields.
                   New buildings use it at once and old ones get renovated into it.
    nature         protect the forests, plant trees in town, clear land, let it go
                   wild, or flowers and parks everywhere
    growth         build taller, spread out, stay compact, found more towns, stay small
    names          rename the world, a town or a moon, or name the river, the sea, the
                   highest peak or the great forest (written on the map)
    new town       settlers leave to found a town with the name you gave it
    night          warm, cool, colourful, candlelight or dark-sky nights; sky lanterns
    weather wish   sunny, rainy, snowy (in any season), foggy, stormy or mild
    and            the crop every town grows, buildings they refuse to build, faster
                   or slower discoveries, more or fewer children
  Try "Only circular things are allowed", "Paint the valley pink", "Let it snow",
  "Name the river after my cat Mittens" or "Protect the forests".
  C > Lore lists the customs in force. Like the rest of a teaching they fade over
  the centuries unless you speak again.
  "Town gossip" (off / hourly / every ~20 min) lets Claude write small vignettes about
  your named people now and then.
  "Tone" is Cosy (family-friendly, the default) or Cheeky (rude jokes and odd customs
  welcome, still nothing explicit or cruel). It is kept in this browser, not the world.
  - Get a key at console.anthropic.com. A separate key with a low spend limit is smart.
  - The key stays in this browser only; it is never written to save.json or any file.
  - Default model: Claude Haiku 4.5 (fractions of a cent per call). Daily cap: 80 calls.
  - No key, no internet, or blocked by a firewall? Your words are still heard and
    remembered, just not understood.
  - C > Voice shows every exchange with Claude: your words, what it decided, the
    chronicle beats (done / still coming), tokens used, the raw JSON and the exact
    prompt it was given. Handy Copy buttons included.

REVERENCE AND PRAYERS
  Reverence (the ✨ meter under the world's name) is the colonists' faith in the
  Watcher. It gathers while the world is on screen, faster as they grow, build
  shrines and hold on to your teachings. Festivals, new eras, new towns and
  monuments add a little extra. The meter has a limit, so it's worth coming back
  to spend it.
  Nudges and speaking cost Reverence instead of recharging:
    rain 15 · bloom 20 · inspire 30 · supply pod 40 · starfall 55 · speak 25
  Every few minutes a named colonist prays for something. The card shows who and
  why; a candle floats over their head on the map. Click their name to find them.
    - rain, bloom, inspire, supply pod, starfall: one click answers it right
      where it's needed. The couple who prayed for a child gets the child.
    - name a baby or a new town: whatever you type becomes the name.
    - a question: type an answer. With a voice key, Claude writes the questions
      to fit the person and works out what they do with your answer.
  Grateful people give back more Reverence than the answer cost, and every
  answered prayer raises the limit and the rate a little. Ignore a prayer (or
  close it with ×) and nothing bad happens; they just sort it out themselves.
  Prayers fit the one praying and the world around them: the season and the
  weather, a drought, a smoky town, a new baby, an old rivalry, a telescope, a
  seedship crew list. Hundreds of ways of asking, and of how it turns out.

SKY, WEATHER AND SEASONS
  Day and night: C > Sky picks the clock.
    Day and night 1 hour   (default) a full day every hour, noon at half past
    Day and night 20 min   a faster cycle
    Real sun over Horsens  the actual sun: sunrise, sunset and day length follow
                           the real date and time there
    Always day             the old fixed daylight
  After dark, windows light up (fewer as the night gets late), street lamps and
  headlights come on, and the lights change with the era: lanterns, then electric,
  then the cool light of the late ages. Shadows follow the sun.
  Weather drifts on its own: clear, fair, cloudy, overcast, rain, thunderstorms,
  fog and snow. Seasons follow the real calendar: autumn colours now, snow that
  settles in winter, fresh greens in spring.
  Weather and Shadows can be switched off in the same panel; Always day + no
  shadows is the lightest setting for a slow PC.

WHAT THE TOWNS ARE BUILT FROM
  Every town keeps a store of timber, stone, clay, metal, goods, cloth and
  glass. It fills them from the land around it: woodcutters' camps at the
  forest edge, quarries in rocky ground, clay pits on riverbanks and sandy
  shores, mines on ore, and workshops and works for goods. Building draws the
  stores down again.
  Two small chains came later. Sheep are fenced into pastures and their
  wool is spun at home, but a weaving house turns it into real cloth (from
  Loomcraft): houses and markets are fitted out with it. Sand pits on the
  dunes feed a glassworks (from Masonry), and glass goes into windows,
  observatories, universities and, much later, the garden domes. A weaver
  or glassworks without pastures or sand pits of its own buys some in and
  makes less. Towns can become known for their cloth or their glass.
  Houses and small buildings are built from whatever the town has most of, so
  a town in the woods ends up timber-built, a town under the crags goes stone,
  and a river town bakes brick. Old eras lean on their own materials too:
  timber first, then stone, then brick, then concrete and glass.
  Woodcutters fell trees and plant new ones; clear too much and the camp moves
  out to the new forest edge. Towns joined by road send what they have plenty
  of to towns that are short: watch for the wagons (and later lorries).
  Running short never stops anything; building just goes slower.
  C > Towns shows each town's stores (bar = how full), what it makes a year,
  what kind of town it is (farming, crafts, industry, learning, faith, trade)
  and what its houses are built of. Hover a quarry, camp or pit to see how good
  the site is, and a town square to see its stores.
  With a voice key, words about building ("build in stone", "use what the land
  gives") can set the towns' favourite material.

WHAT THE TOWNS NEED
  As the world learns things, every town starts to need a few of them. C >
  Towns shows each need as a coloured pill (hover it for what it does):
    Water    wells, then water towers (from Masonry). A town by a river or
             lake gets some for nothing, and from Reinforced Concrete water
             is piped everywhere. Short of water, a town grows more slowly.
    Milling  every windmill grinds for about sixteen fields, and milled grain
             feeds a quarter more people. Gene gardens make it moot.
    Health   clinics (from Medicine), each caring for a few thousand people.
             Healthy towns grow a bit faster, and their children live longer.
    Power    one grid for the whole valley (from Electricity): power houses,
             wind turbines, solar fields and fusion plants feed it; works,
             gene gardens, universities, stations and so on draw from it.
             On a short grid the big users run slow. Hover one to see.
    Culture  shrines, markets, the library, parks, monuments, museums and
             stadiums. Lively towns pull young people away from dull ones,
             host more festivals, and add a little to Reverence.
    News     a radio mast or Weave relay within range. Research is a bit
             faster, and the Watcher's words are remembered for longer.
  Smoke: from Steam on, works and power houses dirty the air around them (you
  can see the soot on the ground). A smoky town grows a little slower and
  loses young people to cleaner ones; parks help. Solar Glass cleans the
  works up, and once a town has a fusion plant its old power house is pulled
  down and becomes a park. C > Towns shows it as a 🏭 pill.
  A town that is short of something sees to it before it builds more houses.
  Nothing ever stops: an unmet need only slows a town down a little. Now and
  then the chronicle notices (queues at the wells, brownouts, dull towns).
  Old buildings retire when a later age outgrows them: granaries come down
  once the trains bring grain (Railways), wells are capped once water is
  piped (Concrete), and windmills stop once the gene gardens feed everyone.
  Each town keeps its oldest well and windmill for old times' sake.

WAREHOUSES, SHIPYARDS, AND THINGS FOR THE SOUL
  Warehouses (from Coinage): a town whose stores are full builds one, and
    each lets it keep half as much again.
  Shipyards (from Masonry, harbour towns): bigger ships and more of them,
    so sea trade carries more. Now and then a new ship is launched.
  Hot springs: a few steaming pools on every world. Settlers like to found
    towns near them, and a nearby town builds a bathhouse over the spring:
    people born there live a few years longer.
  Theatres (from the Printing Press): culture, and a new play now and then,
    written by one of your named people.
  The Maker dig (from the Printing Press): scholars dig properly at the old
    stones. Every find helps research and adds a little Reverence, and goes
    on show if there is a museum.
  Botanical gardens (from Lenses): the gardeners plant trees around town
    and, over the centuries, breed a few new crops that feed every field.
  Guild halls (from Coinage): a town's guild for what it is known for (or
    its biggest trade) makes 30% more of it.

HOW TOWNS LAY THEMSELVES OUT
  Villages grow the old way: a few main lanes run out from the square, side
  lanes branch off them, and they bend round hills, rivers and big trees.
  Houses go up along the lanes, so blocks come in all shapes and sizes. Fields
  near the middle give way to houses as the town grows.
  From Masonry on (and more so from Steam) towns lay out new quarters as
  planned grids. Every town has its own block size, and the old crooked core
  stays as it is. Streets are marked out ahead of time and only paved when
  someone builds on them.
  With a voice key, "winding lanes" or "plan everything" changes how new
  streets are laid out. Worlds saved before this update keep their old streets.
  Roads are paved as the towns learn how, and with what they have: dirt
  tracks first, then gravel (the Wheel), then cobbles where there's stone or
  bricks where there's clay (Masonry), then asphalt (Motorcars), concrete in
  the big towns, and glowlanes in the hover age. The middle of town is paved
  first, and paving costs stone, clay and so on; short of them, it just goes
  slower. The old market quarter keeps its cobbles for good.
  The streets fill up with life as they go: tufts, flowers, fences and
  milestones on country lanes; barrels, crates and benches in villages;
  planters, bollards, street trees and the odd water pump on the cobbles;
  pavements, zebra crossings, post boxes, hydrants, bus shelters and traffic
  lights later on. Open meadows get grass and wildflowers, and small houses
  get hedges, bushes and a tree by the gate.

QUARTERS, TERRACES AND REBUILDING
  Some landmarks take more room once they're built: a town hall, museum,
  theatre, rail station or market spreads over two plots, a university, stadium or fusion plant over
  four (a small house or a field may make way). A full town with no plot left
  for one clears an old cottage that has room round it.
  Nobody zones a Seedfall town but the town itself. Each one keeps a market
  quarter round its square, homes around that, a works quarter out on one edge
  once it has workshops (downwind of the houses, towards its raw materials and
  away from the neighbours), and a green or two. It redraws them every couple
  of decades as it grows. When clean power comes, the works quarter shrinks
  and the old yards turn into homes.
  The quarters only steer where things go; they never stop a town building.
  Press Z to see them: blue market quarters, green homes, yellow works, teal
  greens.
  Now and then something that no longer fits its quarter comes down and
  something better goes up: fields boxed in by houses, a works in the middle
  of the homes, an old cottage on the square (it makes way for shops). Shops
  go from shopfronts to arcades, department stores and, later, offices.
  No two houses are quite alike: wings, porches, bay windows, turrets, kitchen
  gardens, a wash of colour of their own, and flat roofs with tanks, domes and
  awnings. Townhouses, rowhouses and flats on the same street join up into
  terraces and blocks, and the towers each have a shape and a tint of glass.

BOATS, SHIPS AND PLANES
  Fishing boats leave their piers in the morning, fish all day (you can see
  the nets go over the side) and come home at dusk, with a lantern lit.
  Where the way round a lake, inlet or river is long, a town puts a ferry
  across: a raft at first, later a proper ferry with a cabin. When a bridge
  makes it pointless, the old ferry retires.
  Bigger coastal towns build a harbour (from Masonry): a stone quay, a
  warehouse and a crane that swings cargo on and off. As the town grows, the
  harbour grows along the shore (out over the shallows on piles where the coast
  bends): a second quay, then a port with piers and a row of warehouses, then
  container docks with gantry cranes. Each stretch of quay has its own berth,
  so several ships can tie up at once. Ships sail between
  harbours, or off over the horizon and back: sailing ships, then steamers,
  freighters, container ships and finally hover-freighters. Towns with
  harbours can trade by sea even when no road joins them.
  With Lenses, a lighthouse goes up on a point near the harbour, and its
  beam sweeps the water all night.
  Airfields get real planes: they wait on the apron, taxi out, take off (watch
  the shadow fall away), fly to another airfield or away over the edge of the
  world, and come back in to land. Propeller planes first, jets later, then
  the sleek liners of the late ages, with wingtip lights at night.

THE 3D VIEW
  The world opens in real 3D: sun and moon light with soft shadows, a sky that
  goes gold and rose at sunset and fills with stars at night, lamps and lit
  windows that glow, haze over the far side of the valley and the open sea out
  to the horizon. People walk the streets with their dogs, carts roll behind
  their horses, sheep graze in the pastures.
  Drag to turn, scroll to zoom (right down to the street), point at anything to
  see what it is, and click a person to follow them. On a phone: one finger
  turns, two pinch and move, a tap shows what's there.
  The seasons follow the real calendar: blossom in spring, green summers,
  autumn colours (the pines stay green), and snow that settles on roofs and
  fields when it snows. Rain darkens the streets and leaves puddles that catch
  the sky, fog rolls in some mornings, and clouds drift over with their
  shadows sliding across the valley.
  Leave the camera alone for a minute and it turns film camera: it drifts to
  wherever something is happening (news from the chronicle, a ship coming in,
  a townsperson on their way, the harbour at sunset) with a caption. Touch it
  and it's yours again. R turns the film camera off or on.
  Now and then something happens somewhere you can watch: a house catches
  fire and the street forms a bucket chain from the river or the well, the
  sheep get into the market and half the town chases them home, a wedding
  procession goes down the street in a shower of petals, the river floods the
  low streets, a cart of cabbages gets away down a hill, or a whale comes
  ashore and the whole town turns out to keep it wet. The film camera goes to
  look, and the chronicle tells how it ended.
  The workplaces are busy too. Windmill sails and turbine blades turn faster
  in a storm, harbour cranes swing cargo in and out, the mine's winding wheel
  lowers its cage, a derrick hoists blocks out of the quarry, and the works
  run a great flywheel. By day you'll find a woodcutter splitting logs, a
  quarryman at the face, a smith striking sparks off the anvil, a glassblower
  at the furnace, someone shovelling sand into a cart, hands hoeing the rows
  (and harvesting in autumn, then on tractors), a shepherd and the dog, and
  crates carried into the warehouse. They go home at dusk. The film camera
  drops in on them now and then.
  Zoom in and the streets near you fill in: sills and shutters, cornices, door
  steps, gutters, balconies, the glazing on glass towers.
  The towns grow up in the style of the old city-builders: thatch and earth
  yards with barrels, crates and washing lines for the first farmers; brick
  terraces with dormers and chimney pots for the workers; stone ground floors,
  quoins and striped shop awnings for the artisans; and tall mansard blocks
  with iron cresting for the engineers. Chimneys smoke (more in winter), and
  so do the works.
  On a PC with no 3D support, Seedfall falls back to the flat 2D view.

KEYS
  C        chronicle, towns, people, lore
  1 - 5    nudges: rain, supply pod, inspire, starfall, bloom (then click the world;
           each costs Reverence)
  6        speak to your people
  F        fullscreen
  Z        zone view: the quarters each town has drawn for itself (2D)
  R        3D: the film camera on or off (on by default)
  N        3D: step through the times of day (and back to live)
  T        3D: fly to the next town
  P        3D: perspective or the flat isometric lens
  Space    pause
  Shift+D  debug card: leap 10, 20, 50 or 100 years ahead (the world really
           moves on and is saved; handy for seeing slow changes play out)
  H        help
  Drag / scroll to look around; the camera drifts back on its own. Home hands it back.
