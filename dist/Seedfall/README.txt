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
  Two small chains came later. Mossbacks are fenced into pastures and their
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

BOATS, SHIPS AND PLANES
  Fishing boats leave their piers in the morning, fish all day (you can see
  the nets go over the side) and come home at dusk, with a lantern lit.
  Where the way round a lake, inlet or river is long, a town puts a ferry
  across: a raft at first, later a proper ferry with a cabin. When a bridge
  makes it pointless, the old ferry retires.
  Bigger coastal towns build a harbour (from Masonry): a stone quay, a
  warehouse and a crane that swings cargo on and off. Ships sail between
  harbours, or off over the horizon and back: sailing ships, then steamers,
  freighters, container ships and finally hover-freighters. Towns with
  harbours can trade by sea even when no road joins them.
  With Lenses, a lighthouse goes up on a point near the harbour, and its
  beam sweeps the water all night.
  Airfields get real planes: they wait on the apron, taxi out, take off (watch
  the shadow fall away), fly to another airfield or away over the edge of the
  world, and come back in to land. Propeller planes first, jets later, then
  the sleek liners of the late ages, with wingtip lights at night.

KEYS
  C        chronicle, towns, people, lore
  1 - 5    nudges: rain, supply pod, inspire, starfall, bloom (then click the world;
           each costs Reverence)
  6        speak to your people
  F        fullscreen
  Space    pause
  H        help
  Drag / scroll to look around; the camera drifts back on its own. Home hands it back.
