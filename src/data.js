/* ============================== data ============================== */
const ERAS = [
  { name: 'Landfall', title: 'Landfall' },
  { name: 'Homestead', title: 'The Homestead Years' },
  { name: 'Village', title: 'The Village Age' },
  { name: 'Township', title: 'The Age of Towns' },
  { name: 'Steam', title: 'The Age of Steam' },
  { name: 'Electric', title: 'The Electric Age' },
  { name: 'Network', title: 'The Networked Age' },
  { name: 'Orbital', title: 'The Orbital Age' },
  { name: 'Greening', title: 'The Greening' },
  { name: 'Harmony', title: 'The Age of Harmony' }
];

// yr = rough target year; research cost is derived from the expected-research curve
const TECHS = [
  { id: 'shelter', era: 0, yr: 3, name: 'Shelter Weaving', txt: 'works out how to weave shelters from reedgrass and pod foil' },
  { id: 'hydro', era: 0, yr: 9, name: 'Vault Hydroponics', txt: 'coaxes the first Earth seeds out of the vault trays' },
  { id: 'sunroot', era: 1, yr: 18, name: 'Sunroot Cultivation', txt: 'discovers that the orange sunroot is edible, if you boil it twice' },
  { id: 'kiln', era: 1, yr: 34, name: 'Kiln Firing', txt: 'fires the first clay pot. It leaks, but it is a pot' },
  { id: 'wells', era: 1, yr: 50, name: 'Well Digging', txt: 'digs down to sweet water' },
  { id: 'herding', era: 1, yr: 72, name: 'Grazer Herding', txt: 'befriends a mossback calf, and the herd follows' },
  { id: 'stone', era: 2, yr: 100, name: 'Stonecutting', txt: 'splits the valley stone along its grain' },
  { id: 'boats', era: 2, yr: 135, name: 'Reed Boats', txt: 'floats a reed boat, and falls out of it, twice' },
  { id: 'loom', era: 2, yr: 175, name: 'Loomcraft', txt: 'builds a loom from pod struts and bone' },
  { id: 'wheel', era: 2, yr: 215, name: 'The Wheel', txt: 'reinvents the wheel. The Archive had a page on it all along' },
  { id: 'script', era: 2, yr: 265, name: 'Script', txt: 'writes the first letters that are not in the Archive’s alphabet' },
  { id: 'smelt', era: 3, yr: 330, name: 'Smelting', txt: 'pulls red metal out of the hill-stone' },
  { id: 'mills', era: 3, yr: 400, name: 'Windmills', txt: 'catches the valley wind in a set of sails' },
  { id: 'masonry', era: 3, yr: 470, name: 'Masonry', txt: 'raises a wall that is still standing a year later' },
  { id: 'bridges', era: 3, yr: 545, name: 'Arch Bridges', txt: 'throws a stone arch across running water' },
  { id: 'coin', era: 3, yr: 625, name: 'Coinage', txt: 'stamps the first coin, with the Pod on one side' },
  { id: 'print', era: 3, yr: 705, name: 'The Printing Press', txt: 'prints a hundred copies of the Founder’s Sayings' },
  { id: 'optics', era: 3, yr: 790, name: 'Lenses', txt: 'grinds a lens and sees the moons have mountains' },
  { id: 'steam', era: 4, yr: 890, name: 'Steam Power', txt: 'boils water hard enough to turn a wheel' },
  { id: 'rail', era: 4, yr: 990, name: 'Railways', txt: 'lays two iron lines and a very loud idea on top of them' },
  { id: 'medicine', era: 4, yr: 1090, name: 'Medicine', txt: 'finds that glowcap mould cures the valley fever' },
  { id: 'brick', era: 4, yr: 1175, name: 'Brickworks', txt: 'bakes bricks by the thousand' },
  { id: 'chem', era: 4, yr: 1260, name: 'Chemistry', txt: 'writes down a table of what everything is made of' },
  { id: 'electric', era: 5, yr: 1350, name: 'Electricity', txt: 'makes a wire hum' },
  { id: 'radio', era: 5, yr: 1450, name: 'Radio', txt: 'sends a voice through the air to the next town' },
  { id: 'concrete', era: 5, yr: 1540, name: 'Reinforced Concrete', txt: 'pours stone like soup' },
  { id: 'motor', era: 5, yr: 1625, name: 'Motorcars', txt: 'builds a carriage that needs no grazer' },
  { id: 'flight', era: 5, yr: 1720, name: 'Powered Flight', txt: 'flies over the valley for eleven glorious seconds' },
  { id: 'computing', era: 6, yr: 1820, name: 'Computing', txt: 'builds a machine that can read the Archive faster than anyone' },
  { id: 'net', era: 6, yr: 1920, name: 'The Weave', txt: 'links every town into one great conversation' },
  { id: 'solar', era: 6, yr: 2000, name: 'Solar Glass', txt: 'drinks the sunlight straight from the sky' },
  { id: 'skyframe', era: 6, yr: 2090, name: 'Skyframes', txt: 'designs a frame that can hold a building up in the clouds' },
  { id: 'genegarden', era: 6, yr: 2180, name: 'Gene Gardens', txt: 'grows a whole field inside a single tower' },
  { id: 'rocketry', era: 7, yr: 2280, name: 'Rocketry', txt: 'lights a fire that points at the sky' },
  { id: 'sats', era: 7, yr: 2385, name: 'Satellites', txt: 'hangs the first small moon of their own' },
  { id: 'fusion', era: 7, yr: 2490, name: 'Fusion', txt: 'bottles a tiny star' },
  { id: 'station', era: 7, yr: 2600, name: 'Orbital Station', txt: 'opens a house in the sky' },
  { id: 'maglev', era: 7, yr: 2700, name: 'Maglev', txt: 'teaches trains to float' },
  { id: 'climate', era: 8, yr: 2820, name: 'Climate Engines', txt: 'turns the first barren hill green on purpose' },
  { id: 'domes', era: 8, yr: 2940, name: 'Garden Domes', txt: 'plants a forest under glass' },
  { id: 'hover', era: 8, yr: 3060, name: 'Hovercraft', txt: 'takes the wheels off everything' },
  { id: 'arcology', era: 8, yr: 3180, name: 'Arcologies', txt: 'designs a town that fits inside one building' },
  { id: 'elevator', era: 9, yr: 3320, name: 'The Space Elevator', txt: 'spins a thread strong enough to climb to the sky' },
  { id: 'ring', era: 9, yr: 3480, name: 'The Orbital Ring', txt: 'draws a line all the way around the world, up high' },
  { id: 'seedships', era: 9, yr: 3650, name: 'Seedships', txt: 'packs a vault of sleeping children and points it at another star' }
];
const TECH_IDX = {}; TECHS.forEach((t, i) => TECH_IDX[t.id] = i);

// house tiers
const HT = [
  { n: 'Shelter', cap: 2, work: 3, tech: null },
  { n: 'Hut', cap: 4, work: 5, tech: 'shelter' },
  { n: 'Cottage', cap: 6, work: 8, tech: 'stone' },
  { n: 'Townhouse', cap: 12, work: 14, tech: 'masonry' },
  { n: 'Rowhouse', cap: 24, work: 22, tech: 'brick' },
  { n: 'Apartments', cap: 60, work: 45, tech: 'concrete' },
  { n: 'Tower', cap: 160, work: 90, tech: 'skyframe' },
  { n: 'Arcology', cap: 500, work: 180, tech: 'arcology' }
];

// building types: name, work units, max draw height (for redraw bounds), smoke/anim flags
const BT = {
  pod: { n: 'The First Pod', work: 0, h: 16 },
  plaza: { n: 'Plaza', work: 3, h: 14 },
  house: { n: 'House', work: 5, h: 20 },
  farm: { n: 'Fields', work: 3, h: 8 },
  well: { n: 'Well', work: 3, h: 12 },
  granary: { n: 'Granary', work: 6, h: 22 },
  shrine: { n: 'Shrine', work: 6, h: 28 },
  watchstone: { n: 'Watchstone', work: 8, h: 44 },
  dock: { n: 'Pier', work: 5, h: 14 },
  market: { n: 'Market', work: 6, h: 14 },
  school: { n: 'Schoolhouse', work: 10, h: 30 },
  workshop: { n: 'Workshop', work: 8, h: 26, smoke: 1 },
  mine: { n: 'Mine', work: 10, h: 30 },
  lumber: { n: 'Woodcutters', work: 4, h: 20, anim: 'chop' },
  quarry: { n: 'Quarry', work: 6, h: 22, anim: 'dig' },
  claypit: { n: 'Clay Pit', work: 5, h: 20, smoke: 1 },
  harbor: { n: 'Harbour', work: 20, h: 30, anim: 'crane' },
  lighthouse: { n: 'Lighthouse', work: 14, h: 52, anim: 'beam' },
  mill: { n: 'Windmill', work: 10, h: 30, anim: 'mill' },
  hall: { n: 'Town Hall', work: 18, h: 50 },
  library: { n: 'Library', work: 16, h: 30 },
  observatory: { n: 'Observatory', work: 16, h: 32 },
  works: { n: 'Works', work: 24, h: 50, smoke: 2 },
  station: { n: 'Rail Station', work: 18, h: 24 },
  clinic: { n: 'Clinic', work: 16, h: 24 },
  power: { n: 'Power House', work: 26, h: 40, smoke: 3 },
  turbine: { n: 'Wind Turbine', work: 12, h: 64, anim: 'turbine' },
  mast: { n: 'Radio Mast', work: 12, h: 70, anim: 'blink' },
  airfield: { n: 'Airfield', work: 24, h: 20 },
  university: { n: 'University', work: 40, h: 46 },
  antenna: { n: 'Weave Relay', work: 20, h: 52, anim: 'blink' },
  solar: { n: 'Solar Field', work: 10, h: 8 },
  vfarm: { n: 'Gene Garden', work: 40, h: 46 },
  park: { n: 'Park', work: 6, h: 24 },
  stadium: { n: 'Stadium', work: 40, h: 20 },
  museum: { n: 'Museum', work: 36, h: 36 },
  launchpad: { n: 'Launch Pad', work: 60, h: 80, anim: 'pad' },
  fusion: { n: 'Fusion Plant', work: 60, h: 40, anim: 'glow' },
  terraformer: { n: 'Climate Engine', work: 50, h: 84, anim: 'mist' },
  dome: { n: 'Garden Dome', work: 40, h: 36 },
  elevator: { n: 'Space Elevator', work: 200, h: 90, anim: 'tether' },
  monument: { n: 'Monument', work: 30, h: 80 },
  watertower: { n: 'Water Tower', work: 14, h: 44 },
  pasture: { n: 'Mossback Pasture', work: 4, h: 12 },
  sandpit: { n: 'Sand Pit', work: 4, h: 10 },
  weaver: { n: 'Weaving House', work: 10, h: 22 },
  glassworks: { n: 'Glassworks', work: 16, h: 34, smoke: 1 },
  warehouse: { n: 'Warehouse', work: 12, h: 22 },
  shipyard: { n: 'Shipyard', work: 22, h: 34 },
  theatre: { n: 'Theatre', work: 22, h: 40 },
  bathhouse: { n: 'Bathhouse', work: 14, h: 24 },
  digsite: { n: 'Maker Dig', work: 6, h: 16 },
  botanic: { n: 'Botanical Garden', work: 18, h: 26 },
  guildhall: { n: 'Guild Hall', work: 16, h: 44 }
};

// service buildings: when a town should build one
const SERV = [
  { t: 'well', tech: 'wells', min: 14, per: 45, max: 4, site: 'center' },
  { t: 'granary', tech: 'kiln', min: 20, per: 90, max: 3, site: 'center' },
  { t: 'shrine', tech: 'stone', min: 22, per: 0, max: 1, site: 'center' },
  { t: 'dock', tech: 'boats', min: 30, per: 70, max: 3, site: 'shore' },
  { t: 'market', tech: 'loom', min: 45, per: 400, max: 2, site: 'center' },
  { t: 'school', tech: 'script', min: 60, per: 350, max: 3, site: 'center' },
  { t: 'workshop', tech: 'smelt', min: 60, per: 200, max: 3, site: 'mid' },
  { t: 'mill', tech: 'mills', min: 70, per: 180, max: 3, site: 'fields' },
  { t: 'hall', tech: 'masonry', min: 110, per: 0, max: 1, site: 'center' },
  { t: 'harbor', tech: 'masonry', min: 200, per: 0, max: 1, site: 'harbor' },
  { t: 'lighthouse', tech: 'optics', min: 300, per: 0, max: 1, site: 'point' },
  { t: 'library', tech: 'print', min: 140, per: 0, max: 1, site: 'center' },
  { t: 'observatory', tech: 'optics', min: 220, per: 0, max: 1, site: 'high' },
  { t: 'works', tech: 'steam', min: 260, per: 700, max: 3, site: 'edge' },
  { t: 'station', tech: 'rail', min: 180, per: 0, max: 1, site: 'mid' },
  { t: 'clinic', tech: 'medicine', min: 200, per: 1200, max: 2, site: 'mid' },
  { t: 'power', tech: 'electric', min: 450, per: 0, max: 1, site: 'edge' },
  { t: 'turbine', tech: 'electric', min: 300, per: 500, max: 4, site: 'high' },
  { t: 'mast', tech: 'radio', min: 300, per: 0, max: 1, site: 'high' },
  { t: 'stadium', tech: 'electric', min: 1800, per: 0, max: 1, site: 'edge' },
  { t: 'airfield', tech: 'flight', min: 1200, per: 0, max: 1, site: 'flatedge' },
  { t: 'university', tech: 'computing', min: 1000, per: 0, max: 1, site: 'mid' },
  { t: 'antenna', tech: 'net', min: 800, per: 4000, max: 2, site: 'high' },
  { t: 'solar', tech: 'solar', min: 600, per: 1500, max: 6, site: 'edge' },
  { t: 'museum', tech: 'net', min: 2500, per: 0, max: 1, site: 'center' },
  { t: 'park', tech: 'concrete', min: 600, per: 700, max: 12, site: 'mid' },
  { t: 'fusion', tech: 'fusion', min: 3000, per: 0, max: 1, site: 'edge' },
  { t: 'dome', tech: 'domes', min: 2500, per: 3500, max: 3, site: 'mid' }
];

// hand-made styles for the ten eras
const STYLES0 = [
  { name: 'Pod-alloy', wall: '#dfe3ea', roof: '#e5874f', accent: '#e5874f', trim: '#8b93a5', glass: '#8fd0e8' },
  { name: 'Wattle & Thatch', wall: '#caa27c', roof: '#d8b86a', accent: '#b5654a', trim: '#7a5a44', glass: '#6b8a9a' },
  { name: 'Whitewash', wall: '#ece1cb', roof: '#c7704f', accent: '#5e9c8f', trim: '#8a6d57', glass: '#7aa2b5' },
  { name: 'Sandstone', wall: '#dcc7a2', roof: '#5f7f8c', accent: '#b04f5a', trim: '#6b5a4c', glass: '#89b4c7' },
  { name: 'Brick & Slate', wall: '#b86c57', roof: '#4e5a66', accent: '#d6a44a', trim: '#3f3a3a', glass: '#9cc3d1' },
  { name: 'Deco', wall: '#efe3cf', roof: '#3e7d7a', accent: '#d98c3f', trim: '#5b5f66', glass: '#a7d4e0' },
  { name: 'Concrete & Glass', wall: '#d5d9de', roof: '#6c7680', accent: '#e05b52', trim: '#50575f', glass: '#7fb6d9' },
  { name: 'Composite', wall: '#f2f4f7', roof: '#9fb3c8', accent: '#ff8a3d', trim: '#7d8a99', glass: '#8fd6f0' },
  { name: 'Living Roof', wall: '#e6efe0', roof: '#6fae6a', accent: '#f0c24b', trim: '#7d9a78', glass: '#9fe0d0' },
  { name: 'Pearl', wall: '#f3eefb', roof: '#b59ae0', accent: '#5fd0c9', trim: '#9c8fb5', glass: '#c9e6ff' }
];
const STYLE_WORDS = ['Coral', 'Moonstone', 'Saffron', 'Tidewater', 'Lantern', 'Opaline', 'Heather', 'Ember', 'Seaglass', 'Sunroot', 'Mossback',
  'Glowcap', 'Amber', 'Driftwood', 'Cloudline', 'Ochre', 'Lilac', 'Copper', 'Frost', 'Honey', 'Ribbon', 'Pebble', 'Kite', 'Starling'];

const CROPS = [
  { n: 'sunroot', c: '#f0a04b' }, { n: 'blue barley', c: '#7fa7d9' }, { n: 'pink melons', c: '#e889a6' },
  { n: 'goldreed', c: '#e8cf5a' }, { n: 'violet beans', c: '#9f7ad0' }, { n: 'Earth wheat', c: '#dcc37a' }, { n: 'mint kale', c: '#79c7a3' }
];

const INVENTIONS = [
  ['the fish trap', 'sunroot beer', 'the three-legged stool', 'a proper word for “homesick”', 'glowcap lanterns', 'the rain drum', 'woven sandals',
    'a calendar with thirteen months', 'the first joke about the Pod', 'mossback-wool socks', 'a lullaby that isn’t about Earth', 'the sling', 'pickled glowcaps'],
  ['the pendulum clock', 'spectacles', 'the pocket compass', 'the accordion', 'a plough that doesn’t jam', 'the first cookbook', 'card games', 'the umbrella',
    'the pretzel', 'marbles', 'a map of the whole valley', 'the kite', 'the harmonica', 'waterproof boots'],
  ['the bicycle', 'the steam whistle', 'canned sunroot', 'the postal service', 'the typewriter', 'photography', 'ice cream', 'the sewing machine',
    'the fountain pen', 'the fire brigade', 'the hot-air balloon', 'the zipper'],
  ['the jukebox', 'the toaster', 'cinema', 'the crossword', 'the vacuum cleaner', 'the neon sign', 'the washing machine', 'frozen dinners',
    'the electric guitar', 'the traffic light', 'sunglasses'],
  ['the pocket terminal', 'the Weave’s first meme (a mossback wearing a hat)', 'e-paper', 'the hover-skateboard', 'noise-cancelling earmuffs',
    'the delivery drone', 'a translation engine for Founder-speak', 'the smart kettle (it is smug)'],
  ['zero-g ballet', 'moon cheese (it is not really cheese)', 'orbital postcards', 'the gravity hammock', 'weather-proof paper', 'sky-farming',
    'the self-tying shoelace', 'the thousand-year battery', 'a pocket garden']
];
const ARTWORKS = ['a mural of the Pod falling', 'an epic poem about the Founder', 'a carved frieze of mossbacks', 'a quilt with every town stitched in',
  'a play about the first winter', 'a statue of a child holding a seed', 'a mosaic of the two moons', 'a symphony called “Seedfall”',
  'a novel about a lost Earth', 'a painting of the valley at noon', 'a tapestry of the Makers’ glyphs', 'a comic opera about the Wheel'];
const SONG_A = ['Long', 'Quiet', 'Blue', 'Falling', 'Last', 'Golden', 'Seventh', 'Little', 'Borrowed', 'Faraway', 'Crooked', 'Second'];
const SONG_B = ['Harvest', 'Sky', 'Seed', 'River', 'Watcher', 'Road', 'Lantern', 'Morning', 'Mossback', 'Moon', 'Winter', 'Homecoming'];
const FESTIVALS = ['the Festival of First Light', 'Lantern Night', 'the Harvest Moot', 'the Kite Festival', 'the Mossback Parade', 'Seed Day',
  'the Night of Two Moons', 'the Long Supper', 'the River Race', 'the Glowcap Fair'];
const SPORTS = [['stone-toss', 'the log run'], ['kickball', 'rowing'], ['kickball', 'the grand velocipede race'], ['kiteball', 'motor rallies'],
  ['kiteball', 'drone racing'], ['skyball', 'orbital relay']];
const FAUNA = { grazer: 'mossbacks', pet: 'loamhounds', bird: 'skimmers', giant: 'a Longstrider' };
const STARS = ['Veil', 'Harrow', 'Oskar’s Lamp', 'the Green Eye', 'Kestrel', 'Nine Sisters', 'Tovan', 'the Far Seed', 'Lodestar', 'Brisa'];
const SHIP_NAMES = ['Patience', 'Second Seed', 'Founder’s Dream', 'Long Way Home', 'Kindness', 'Mossback', 'Lantern', 'Hearthlight', 'Quiet Hope', 'Watcher’s Eye'];

const LORE = [
  { t: 'Carved stones older than any memory stand in the grass. Someone lived here before the Pod.', h: 'The first ruin' },
  { t: 'The ruin-glyphs repeat one shape over and over: a falling seed.', h: 'The falling seed' },
  { t: 'The Makers did not build cities. They built gardens. The purple forests of this world were planted.', h: 'The planted forests' },
  { t: 'A star chart, cut in stone. The Makers’ seed came from the same patch of sky as the Pod.', h: 'The star chart' },
  { t: 'The last glyph is translated at last: “We tended this world for whoever falls next. Be kind to it.”', h: 'The last glyph' }
];

const AGE_THEMES = [
  { k: 'gardens', names: ['Gardens', 'Green Roofs', 'the Long Bloom'], w: { park: 3, dome: 2 } },
  { k: 'lanterns', names: ['Lanterns', 'Festivals', 'Bright Nights'], ev: { festival: 3 } },
  { k: 'stone', names: ['Monuments', 'Carvers', 'Great Works'], w: { monument: 1 } },
  { k: 'sky', names: ['Skyships', 'Kites', 'the Open Sky'], fly: 2 },
  { k: 'tides', names: ['Tides', 'Harbours', 'Sails'], w: { dock: 3 } },
  { k: 'song', names: ['Song', 'Choirs', 'Many Voices'], ev: { art: 3 } },
  { k: 'quiet', names: ['Quiet', 'Contemplation', 'Still Water'], research: 1.3 },
  { k: 'stars', names: ['Stars', 'Far Voyages', 'Seedships'], ev: { seedship: 3 } },
  { k: 'craft', names: ['Makers', 'Markets', 'Clever Hands'], w: { market: 2, workshop: 2 } },
  { k: 'echo', names: ['Echoes', 'Old Glyphs', 'Remembering'], ev: { lore: 3 } }
];
const WONDERS = [
  { n: 'The Founder’s Stone', k: 'statue' }, { n: 'The Great Lantern', k: 'lantern' }, { n: 'The Archive Spire', k: 'spire' },
  { n: 'The Sky Harp', k: 'harp' }, { n: 'The Hanging Gardens', k: 'gardens' }, { n: 'The Mossback Colossus', k: 'colossus' },
  { n: 'The Hall of Voices', k: 'hall' }, { n: 'The Tide Clock', k: 'clock' }, { n: 'The Seed Obelisk', k: 'obelisk' },
  { n: 'The Glass Orchard', k: 'orchard' }, { n: 'The Long Memory', k: 'spire' }, { n: 'The Kite Tower', k: 'lantern' }
];
