/* ============================== prayers: what the colonists whisper, and what comes of it ============================== */
// The words are built from pieces: a way of starting, the ask itself, and a way of signing off. Each ask checks the
// world it's said in (the era, the season and weather, the town's needs and smoke, the person's age, family, trade
// and quirks) and says nothing (null) when it doesn't fit. Recently used pieces are skipped (S.prayRecent), so the
// same words rarely come round twice in a sitting.
const town = p => (S.T[p.sid] || {}).name || 'the valley';
const crop = p => { const T = S.T[p.sid]; return T ? CROPS[T.crop % CROPS.length].n : 'sunroot'; };
const spouse = p => (p.sp && S.P[p.sp] ? S.P[p.sp].first : 'my love');
const sp3 = p => (p.sp && S.P[p.sp] ? S.P[p.sp].first : 'their sweetheart'); // the same, told by someone else
// the world around the one praying
function prayCtx(p) {
  const T = S.T[p.sid], se = LIGHT.season || seasonNow(), v = T ? needsOf(T) : {};
  const sp = p.sp && S.P[p.sp], kids = (p.kids || []).map(k => S.P[k]).filter(Boolean);
  return {
    T, band: hasTech('rocketry') ? 3 : hasTech('electric') ? 2 : hasTech('masonry') ? 1 : 0,
    winter: se.winter > .5, autumn: se.autumn > .5, spring: se.spring > .5, summer: se.winter < .2 && se.autumn < .3 && se.spring < .3,
    wx: (S.wx || {}).k || 'fair', drought: S.drought > 0, pol: T ? polOf(T) : 0, v,
    old: age(p) >= 60, young: age(p) < 26, widowed: !!(p.sp && sp && sp.died !== null), wed: !!(sp && sp.died === null),
    kids: kids.filter(k => k.died === null), grown: kids.filter(k => k.died === null && age(k) >= 18), lost: kids.filter(k => k.died !== null).length,
    big: T && T.pop > 3000, small: T && T.pop < 200, shrine: T && townIndex()[T.id] && (townIndex()[T.id].shrine || townIndex()[T.id].watchstone),
    sea: T && !!townHarbour(T), moon: S.moons ? S.moons[1] : 'the far moon', planet: S.planet || 'this world'
  };
}
const kidName = c => c.kids.length ? pick(c.kids).first : 'the little one';

const PRAY_OPEN = [
  () => '', () => '', () => '', () => '', () => '',
  p => `Watcher? It's ${p.first}.`, p => `It's ${p.first} again. Sorry.`, () => `Watcher, are you up there?`, () => `I don't usually do this.`,
  () => `Sorry to bother you.`, () => `Dear Watcher:`, p => `It's ${p.first}, from ${town(p)}. The ${p.role}.`, () => `I hope this is how it works.`,
  () => `Right. Here goes.`, () => `Hello. Um.`, (p, c) => c.old ? `I'm old enough to skip the pleasantries, Watcher.` : null,
  (p, c) => c.band >= 2 ? `Watcher, if you can hear this over the radio noise…` : null, (p, c) => c.band >= 3 ? `Watcher, it's ${p.first}. I'm on the night shift and it's quiet.` : null,
  (p, c) => c.winter ? `It's cold enough to see my breath, so this is a short one.` : null, (p, c) => c.wx === 'storm' ? `Between the thunderclaps, then:` : null,
  (p, c) => c.shrine ? `I'm at the shrine. I brought a candle.` : null, (p, c) => c.young ? `My gran says you listen. So.` : null
];
const PRAY_CLOSE = [
  () => '', () => '', () => '', () => '', () => '',
  () => `Thank you.`, () => `Please.`, () => `No pressure.`, p => `I'll leave some ${p.q.food} on the step.`, p => `Yours, ${p.first}.`,
  p => `As I always say: ${p.q.says}`, (p, c) => c.wed ? `(Don't tell ${spouse(p)} I asked.)` : null, () => `I'll be listening.`, () => `That's all. Goodnight.`,
  (p, c) => c.shrine ? `I'll light another candle tomorrow.` : null, () => `Sorry about last time.`, () => `If it's not too much trouble.`,
  (p, c) => c.kids.length ? `${kidName(c)} says hello too.` : null, () => `I'll be good. Mostly.`
];

const PRAYERS = {
  rain: [
    (p, c) => c.drought ? `The ${crop(p)} fields are cracking in the heat. One good rain, please.` : null,
    (p, c) => c.drought ? `My ${crop(p)} are wilting and the well tastes of dust. Rain for ${town(p)}?` : null,
    (p, c) => c.drought ? `The river's so low the children are catching fish by hand. Send rain before it's gone altogether.` : null,
    (p, c) => c.drought ? `We've started saving the washing-up water for the ${crop(p)}. It's come to that.` : null,
    (p, c) => c.drought ? `The mossbacks keep staring at the sky. I think they're praying too.` : null,
    p => `If it rained on ${town(p)} this week, I'd stop complaining about everything else. For a while.`,
    p => `The ${crop(p)} could use a drink. So could I, but mostly the ${crop(p)}.`,
    () => `I told the whole market it would rain before harvest. Please don't make a liar of me.`,
    p => `I planted the ${crop(p)} on the day the old almanac said. The almanac has been quiet since. Rain?`,
    (p, c) => c.summer ? `It's so hot the roof tiles tick all night. A cool rain over ${town(p)}, please.` : null,
    (p, c) => c.spring ? `The seed is in and the ground is waiting. Just a gentle rain, the soft kind.` : null,
    (p, c) => c.autumn ? `One last rain to swell the ${crop(p)} before the harvest? Then I'll never ask again. Until spring.` : null,
    (p, c) => c.wx === 'clear' ? `Not a cloud in days. Lovely for picnics, terrible for ${crop(p)}.` : null,
    (p, c) => c.wx === 'rain' || c.wx === 'storm' ? `I know it's raining over the hills. Could it wander over to my fields too?` : null,
    p => `My knees say rain is coming. My knees have been wrong for three weeks now.`,
    p => /herd/.test(p.role) ? `The mossbacks' pond is more mud than pond. A good soaking for ${town(p)}?` : null,
    p => /brew/.test(p.role) ? `No rain, no harvest. No harvest, no beer. You see the problem.` : null,
    p => /bak/.test(p.role) ? `If the ${crop(p)} harvest fails I'll be baking with pebbles. Rain, please.` : null,
    (p, c) => c.band >= 2 ? `The irrigation pumps are coughing again. A proper rain would give them a rest.` : null,
    (p, c) => c.band >= 1 ? `The water cart costs more every week. Could the sky do it for free, just once?` : null,
    (p, c) => c.old ? `I've seen sixty harvests. I'd like to see one more that doesn't need carrying buckets.` : null,
    (p, c) => c.kids.length ? `${kidName(c)} has never jumped in a puddle. It seems a shame.` : null,
    p => `I've tried dancing for it. The neighbours were very kind about it. Please, just rain.`
  ],
  bloom: [
    p => `Could the hills around ${town(p)} flower again? My grandmother used to love them.`,
    p => `I dream of mossbacks grazing in a meadow full of flowers. Just outside ${town(p)} would be perfect.`,
    (p, c) => c.band >= 2 ? `It's all roads and roofs around ${town(p)} now. A little wild green, please?` : null,
    p => `I've been ${p.q.hobby} all spring and there's nothing left to look at. Something growing, please?`,
    (p, c) => c.pol > .2 ? `The works have turned everything grey round ${town(p)}. Could something green push through the soot?` : null,
    (p, c) => c.pol > .2 ? `My washing comes in greyer than it went out. A few flowers would cheer the whole street.` : null,
    (p, c) => c.winter ? `It's been winter forever. Just one patch of green to prove spring is real?` : null,
    (p, c) => c.spring ? `Everyone else's garden is coming up. Mine is sulking. A little encouragement?` : null,
    (p, c) => c.autumn ? `Before the frost takes everything, could the hills have one last bloom?` : null,
    (p, c) => c.wed ? `${spouse(p)} and I are marrying again, for the fun of it. We'd love flowers on the hill.` : null,
    (p, c) => c.widowed ? `${spouse(p)} loved the wildflowers. I'd like to see them again, for both of us.` : null,
    (p, c) => c.kids.length ? `${kidName(c)} wants to make a daisy chain. There are no daisies. Help?` : null,
    p => /herd/.test(p.role) ? `The mossbacks are eating the fence posts. They need a better meadow.` : null,
    p => /heal|herbal|doctor|nurse/.test(p.role) ? `My herb baskets are empty. Could the slopes grow wild again?` : null,
    p => /artist|painter|singer|storyteller|poet/.test(p.role) ? `I need something beautiful to paint. The hills used to oblige.` : null,
    (p, c) => c.big ? `${town(p)} is so big now that the children think grass comes in squares. Show them otherwise?` : null,
    (p, c) => c.band >= 3 ? `The domes are lovely, but I miss flowers that nobody planted on purpose.` : null,
    () => `The bees look bored. I didn't know bees could look bored.`,
    () => `I planted a whole packet of Earth seeds from the vault. Nothing. Maybe they need a word from you.`,
    p => `Could the meadow by ${town(p)} be a bit more… meadow?`,
    (p, c) => c.old ? `When I was small the hills went purple every spring. I'd like to see that once more.` : null
  ],
  inspire: [
    p => `${spouse(p)} and I have hoped for a child for years. If you're listening, Watcher...`,
    p => `Our house is too quiet. ${spouse(p)} says you'll hear us if we ask nicely.`,
    p => `${spouse(p)} has already carved a cradle. Please don't let it gather dust.`,
    p => `We've picked out names. Several. ${spouse(p)} keeps adding more. We just need someone to give them to.`,
    p => `The neighbours' children wave at us every morning. We'd love one of our own to wave back.`,
    p => `I've been knitting tiny socks for no one in particular. ${spouse(p)} has started to notice.`,
    (p, c) => c.grown.length ? `Ours have all grown and gone. ${spouse(p)} and I would love one more to fill the house.` : null,
    (p, c) => c.lost ? `We lost our first. We'd like to try again, if you'll watch over us this time.` : null,
    (p, c) => c.kids.length ? `${kidName(c)} keeps asking for a little brother or sister. We keep saying “ask the Watcher”. So: they're asking.` : null,
    p => /teach/.test(p.role) ? `I teach everyone else's children. I'd love to teach one of my own.` : null,
    p => /builder|carpenter|mason/.test(p.role) ? `I've built a room nobody sleeps in yet. It has a window facing the moons.` : null,
    (p, c) => c.band >= 2 ? `The doctor says there's no reason we can't. So we're asking you instead.` : null,
    (p, c) => c.winter ? `It's a long winter for two. We'd love to be three by spring.` : null,
    p => `${spouse(p)} sings lullabies to the loamhound. It's time, Watcher.`,
    p => `We've been told the vault children came from Earth. Ours would come from ${town(p)}. We'd like that.`,
    () => `Our garden has a swing and nobody to push. Please.`
  ],
  drop: [
    p => `I've been stuck on the same problem for ${ri(3, 9)} winters. A hint. Any hint.`,
    () => `The Archive's pages on this are torn. Could you send the missing bit?`,
    p => `Everyone in ${town(p)} says I'm close. I don't feel close. Help?`,
    () => `I've drawn the same diagram forty times. It's a lovely diagram. It doesn't work.`,
    () => `My notes have notes. The notes on the notes have questions. I need an answer.`,
    p => `The council gave me a workshop and a deadline. The deadline is winning.`,
    p => `I dreamed the answer last night and forgot it by breakfast. Could you send it again, in writing?`,
    (p, c) => c.band === 0 ? `The Archive says Earth people knew this. Earth people had more candles.` : null,
    (p, c) => c.band === 1 ? `The boiler works on paper and explodes in practice. A little help before the next test?` : null,
    (p, c) => c.band === 2 ? `The machine hums, then sulks. The manual is in a language nobody reads any more.` : null,
    (p, c) => c.band >= 3 ? `The simulation says it works. The launch pad says otherwise. Which one is lying?` : null,
    p => /apprentice/.test(p.role) ? `My master thinks I'm hopeless. One good idea would show them.` : null,
    p => /scribe|printer/.test(p.role) ? `I've copied every page on this in the Archive and I still don't understand it.` : null,
    p => /chemist/.test(p.role) ? `The flask went green, then purple, then out the window. What did I do wrong?` : null,
    p => /engineer|machin/.test(p.role) ? `There's one gear too many or one too few. I can't tell which.` : null,
    p => /cartograph|survey/.test(p.role) ? `My map of the valley doesn't close up. Somewhere there's a mile that isn't there.` : null,
    (p, c) => c.old ? `I'd like to finish this before I go. I'm not in a hurry, but I'm also not young.` : null,
    (p, c) => c.kids.length ? `${kidName(c)} solved half of it with crayons. I need the other half.` : null,
    () => `The mossback ate my notes. I am not joking. Please send new ones.`,
    () => `A gift pod, like the old days? Even a small one. Even just a hint in a jar.`
  ],
  starfall: [
    p => /smith|mason|machin/.test(p.role) ? `They say starmetal rings like a bell. I'd give anything to work it once.` : null,
    p => `Show us a falling star over ${town(p)}. The children have never seen one.`,
    p => `A sign in the sky, please, so ${town(p)} stops arguing about whether you're real.`,
    p => `I've counted every star over ${town(p)}. I'd like one to come a bit closer.`,
    (p, c) => `My telescope is pointed at ${c.moon}. If something shiny fell past it, I wouldn't complain.`,
    p => /astro|star/.test(p.role) ? `I've watched the sky every night for years. One falling star, just for me?` : null,
    p => /artist|painter|poet|singer|storyteller/.test(p.role) ? `I want to write something about a falling star. I'd rather not make it up.` : null,
    (p, c) => c.wed ? `I want to propose to ${spouse(p)} all over again, under a falling star. It'd help if there was one.` : null,
    (p, c) => c.kids.length ? `${kidName(c)} made a wish on a lantern because there are no shooting stars. Could you fix that?` : null,
    (p, c) => c.old ? `I saw the great starfall when I was a child. I'd like to see one more before I'm done.` : null,
    (p, c) => c.winter ? `Long clear winter nights are wasted without a shooting star or two.` : null,
    (p, c) => c.wx === 'clear' ? `It's the clearest night in months. It'd be a shame not to use it.` : null,
    (p, c) => c.band >= 2 ? `The city lights have hidden most of the stars. Send one bright enough to see from ${town(p)}.` : null,
    (p, c) => c.band >= 3 ? `We've been up there now. I still want something to come down.` : null,
    () => `The Founder's diary says a star fell the night the Pod landed. I'd love to know how that felt.`,
    () => `Something to dig up, something to argue about, something to put in a museum. A star, basically.`,
    p => /smith/.test(p.role) ? `My forge is hot and my anvil is bored. Starmetal, please.` : null
  ],
  name: [
    () => `Our little one was born under your sky. Would you choose a name?`,
    (p, q) => `${spouse(p)} wants to call the baby ${S.P[q.child] ? S.P[q.child].first : 'something odd'}. I'd rather you chose.`,
    () => `We can't agree on a name. We've been calling the baby “the baby” for a month. Help.`,
    () => `The whole street has suggested names. Most of them are after themselves. What would you call our child?`,
    () => `Every name we try sounds wrong out loud. Would you give one that sounds right?`,
    p => `The midwife says a Watcher-named child is lucky. We'd like the luck, and the name.`,
    (p, q) => `We've written ${S.P[q.child] ? S.P[q.child].first : 'a name'} on the cradle in pencil. In case you'd like to change it.`,
    p => `Our baby has ${pick(['enormous', 'tiny', 'serious', 'very loud'])} ${pick(['eyes', 'feet', 'opinions', 'lungs'])} and no name yet. Could you give one?`
  ],
  town: [
    (p, q) => `We've built ${S.T[q.tid].name}'s first houses, but nobody likes the name. What should we call our home?`,
    () => `The settlers keep arguing about what to call this place. You decide, Watcher. Please.`,
    (p, q) => `${S.T[q.tid].name} was only ever meant to be a working name. It's stuck, and we don't like it. Would you give us a better one?`,
    () => `We've painted the sign three times already. Tell us the name and we'll paint it once more, properly.`,
    () => `A new town deserves a name that isn't somebody's surname. What should we call it?`,
    (p, q) => `The old folk say a town named by the Watcher never floods. We'd like to test that. What's our name?`
  ],
  ask: [
    p => `Should I give up ${p.q.hobby} and take my work more seriously?`,
    p => p.riv.length && S.P[p.riv[0]] ? `${S.P[p.riv[0]].first} and I haven't spoken in years. Should I be the one to make up?` : null,
    p => p.riv.length && S.P[p.riv[0]] ? `Is it petty that I still haven't forgiven ${S.P[p.riv[0]].first}? Be honest.` : null,
    p => `Is it silly that I'm afraid of ${p.q.fear}?`,
    p => `Everyone in ${town(p)} knows about my ${p.q.gp}. Should I stop?`,
    p => `What should ${town(p)} build next? The council has been arguing since spring.`,
    p => `You've heard me say ${p.q.says} a thousand times. Am I wrong?`,
    p => `Should I stay a ${p.role}, or try something new while I still can?`,
    p => `Is it too late to learn ${pick(['the fiddle', 'to swim', 'to read the old script', 'to dance', 'to cook properly'])}?`,
    (p, c) => c.wed ? `${spouse(p)} wants to move to another town. I like it here. Who should give in?` : null,
    (p, c) => c.wed ? `What's the secret to a long marriage? ${spouse(p)} and I would like to know before we find out the hard way.` : null,
    (p, c) => !c.wed && !c.widowed && !c.old ? `There's someone at the market I like. Should I say something?` : null,
    (p, c) => c.widowed ? `It's been a while since ${spouse(p)} passed. Is it all right to be happy again?` : null,
    (p, c) => c.kids.length ? `${kidName(c)} wants to be a ${pick(['pilot', 'poet', 'mossback', 'Watcher', 'mayor', 'star-watcher'])}. Should I encourage it?` : null,
    (p, c) => c.grown.length ? `My children never write. Should I write first?` : null,
    (p, c) => c.old ? `What should I do with all the years I've got left? I'd like to spend them well.` : null,
    (p, c) => c.old ? `Should I write down everything I remember, or let the young ones make their own mistakes?` : null,
    (p, c) => c.young ? `Everyone says I have my whole life ahead of me. Which way should I start walking?` : null,
    (p, c) => c.v.water != null && c.v.water < .7 ? `The wells in ${town(p)} are running low. Should we dig deeper, or move closer to the river?` : null,
    (p, c) => c.v.health != null && c.v.health < .7 ? `${town(p)} has too few healers. Should I train as one?` : null,
    (p, c) => c.v.culture != null && c.v.culture < .5 ? `${town(p)} is a bit dull, if I'm honest. What would liven it up?` : null,
    (p, c) => c.pol > .25 ? `The works bring money and smoke in equal measure. Are they worth it?` : null,
    (p, c) => c.big ? `${town(p)} has got so big I don't know my neighbours. Should I knock on doors?` : null,
    (p, c) => c.small ? `Is ${town(p)} going to grow, or should we all move somewhere busier?` : null,
    (p, c) => c.sea ? `I've always wanted to go to sea. Is that brave, or just daft?` : null,
    (p, c) => c.band >= 2 ? `Everyone's always in a hurry now. Is that progress?` : null,
    (p, c) => c.band >= 3 ? `They're choosing crews for the seedships. Should I put my name down?` : null,
    () => `Do you ever get lonely up there?`,
    () => `What's the best thing you've ever seen us do?`,
    () => `Are we doing all right, on the whole? Honestly?`,
    (p, c) => `What's on ${c.moon}? Everyone has a theory.`,
    () => `Is it bad luck to whistle in the Pod? Asking for a friend.`,
    () => `Which is better, ${pick(['sunroot', 'blue barley', 'violet beans', 'pink melon'])} or ${pick(['glowcaps', 'honey-reeds', 'goldreed', 'mint kale'])}? This has split the family.`,
    () => `If you could change one thing about us, what would it be?`,
    p => `My loamhound keeps staring at the Pod and howling. Does it know something?`,
    p => `Would you like ${town(p)} better with a clock tower? We could have one by spring.`,
    p => `I found a Maker shard in the garden. Should I give it to the museum, or keep it on the windowsill?`
  ]
};

const OUTCOME = {
  rain: [
    p => `Rain falls on ${town(p)}, just where ${p.first} prayed for it. ${p.first} stands in it until soaked.`,
    p => `${p.name} swears the rain came the moment the prayer was finished. The ${crop(p)} recover within the week.`,
    p => `The rain comes down on ${town(p)} and ${p.first} dances in the lane. The neighbours pretend not to watch.`,
    p => `${p.name} puts every bucket in the house out in the yard, just to hear the rain in them.`,
    p => `The ${crop(p)} drink their fill. ${p.name} tells the market “I told you so” eleven times before lunch.`,
    p => `Children splash through ${town(p)}'s puddles all afternoon. ${p.first} lets them.`,
    p => `${p.name} hangs a little wind-chime on the shrine to say thank you for the rain.`,
    p => `The dust settles, the ${crop(p)} straighten up, and ${p.first} sleeps properly for the first time in weeks.`
  ],
  bloom: [
    p => `The land around ${town(p)} is in flower. ${p.first} brings the whole family to see it.`,
    p => `${p.name} leaves some ${p.q.food} on the nearest high place to thank the Watcher for the flowers.`,
    p => `The hills by ${town(p)} go gold and purple overnight. ${p.first} picks one of each and presses them in a book.`,
    p => `${p.name} spends the whole afternoon lying in the new meadow, doing absolutely nothing. It's perfect.`,
    p => `The bees of ${town(p)} are beside themselves. So is ${p.first}.`,
    p => `Wildflowers spill over the fields near ${town(p)}. ${p.first} is late for work and doesn't care.`,
    p => `${p.name} hangs flowers over every door on the street. Nobody asks where they came from.`
  ],
  inspire: [
    p => `${p.first} and ${sp3(p)} tell everyone their child was sent by the Watcher. Nobody argues.`,
    p => `The cradle ${sp3(p)} carved is finally in use. ${p.first} hasn't stopped smiling.`,
    p => `${town(p)} throws a small party for ${p.first} and ${sp3(p)}'s news. The loamhound gets a hat.`,
    p => `${p.first} lights a candle at the shrine every evening now, just to say thank you.`,
    p => `${p.name} and ${sp3(p)} get the good news on a quiet morning and tell the whole street by noon.`
  ],
  drop: [
    p => `In the gift pod ${p.name} finds exactly the missing piece. ${town(p)} hears the shouting from the workshop.`,
    p => `${p.name} opens the gift pod, reads the data crystal twice, and doesn't sleep for three days.`,
    p => `${p.name} unpacks the gift pod like a birthday present and finds the answer wrapped in the packing straw.`,
    p => `${p.first} pins a page from the gift pod over the workbench. It gets looked at a hundred times a day.`,
    p => `The gift pod lands near ${town(p)} and ${p.name} gets there first, still in slippers.`,
    p => `“Of course,” says ${p.name}, holding the gift pod's contents. “Of course!” Nobody else understands, but they clap anyway.`
  ],
  starfall: [
    p => `${p.name} watches the star come down and runs all the way to the crater.`,
    p => /smith|mason|machin/.test(p.role) ? `${p.name} works the starmetal for a month. The result rings like a bell.` : `${town(p)} watches the star fall all night. ${p.first} is unbearable about it for years.`,
    p => `The star falls over ${town(p)} just after supper. ${p.first} was looking the right way, for once.`,
    p => `${p.name} keeps a piece of the fallen star on a string round their neck. It's still warm some mornings.`,
    p => `The children of ${town(p)} follow ${p.first} to the crater, and every one of them makes a wish.`,
    p => `${p.name} writes a whole song about the falling star. It's not very good, but everyone learns it.`,
    p => `${town(p)} argues about the falling star for weeks. ${p.first} just smiles and says nothing.`
  ],
  ask: [
    (p, a) => `${p.name} hears an answer on the wind: “${a}” They take it very seriously.`,
    (p, a) => `${p.name} gets a reply from the Watcher: “${a}” ${town(p)} talks of nothing else for a week.`,
    (p, a) => `“${a}” ${p.name} writes the Watcher's words on the kitchen wall so they'll never forget them.`,
    (p, a) => `The answer comes to ${p.name} in a dream: “${a}” They wake up and get straight to it.`,
    (p, a) => `${p.name} finds the Watcher's words scratched on the shrine stone: “${a}” The whole of ${town(p)} comes to look.`,
    (p, a) => `“${a}” says the Watcher. ${p.first} thinks about it all through supper and nods at the end.`,
    (p, a) => `${p.name} reads the Watcher's answer out at the market: “${a}” Half of ${town(p)} agrees, which is a lot.`
  ]
};
const EXPIRE = {
  rain: [p => `${p.name} stops waiting for rain and digs a new well instead.`, p => `${p.name} rigs up a clever gutter from the roof and waters the ${crop(p)} by hand.`,
    p => `No rain comes. ${p.name} carries buckets from the river all summer, and gets very strong arms.`, p => `${p.first} gives up on the rain and starts a water-carrying rota. Somehow it becomes a festival.`,
    p => `The rain never comes for ${p.first}, but the neighbours all share their water. ${p.first} is touched.`],
  bloom: [p => `${p.name} gives up waiting and plants a flower bed by the door.`, p => `${p.name} paints flowers on the front door instead. They last longer anyway.`,
    p => `No flowers come, so ${p.first} scatters seed along every lane in ${town(p)}. Next spring, a few come up.`, p => `${p.name} makes paper flowers for the whole street. The bees are confused.`],
  drop: [p => `${p.name} solves the problem alone in the end, a bit grumpily.`, p => `${p.name} gives up on help from above and asks the apprentice. The apprentice knew all along.`,
    p => `${p.first} works it out at three in the morning, alone, and wakes the whole house to tell them.`, p => `${p.name} shelves the problem for now. It'll keep. Problems do.`],
  inspire: [p => `${p.first} and ${sp3(p)} get a loamhound pup instead. It helps.`, p => `${p.first} and ${sp3(p)} become everyone's favourite aunt and uncle. It suits them.`,
    p => `${p.first} and ${sp3(p)} start teaching the neighbours' children to read. The house isn't quiet any more.`, p => `${p.first} and ${sp3(p)} take in two orphaned mossback calves. They're a handful.`],
  starfall: [p => `${p.name} keeps watching the sky. Maybe next year.`, p => `${p.name} builds a bigger telescope instead. Something will turn up.`,
    p => `No star falls. ${p.first} makes one out of tin and hangs it over the door.`, p => `${p.name} falls asleep on the roof waiting for a star, and wakes up with a cold and no regrets.`],
  ask: [p => `${p.name} never gets an answer, and decides that's an answer too.`, p => `${p.name} stops waiting and asks ${town(p)}'s oldest resident instead. The advice is mostly about soup.`],
  name: [p => `${p.first} names the baby after all. Everyone agrees it suits them.`],
  town: [p => `The settlers stop waiting and keep the name. It grows on them.`]
};

// the words, with the recently used ones skipped so a long sitting doesn't hear the same prayer twice
function prayText(k, p, q) {
  const c = prayCtx(p), rec = S.prayRecent || (S.prayRecent = []);
  const fit = (list, tag) => list.map((f, i) => [f, tag + i]).filter(([f]) => { try { return f(p, k === 'name' || k === 'town' ? q : c) != null; } catch (e) { return false; } });
  const choose = (list, tag, avoid) => { const ok = fit(list, tag); const fresh = ok.filter(([, key]) => !avoid || !rec.includes(key)); const [f, key] = pick(fresh.length ? fresh : ok); if (avoid) { rec.push(key); if (rec.length > 40) rec.shift(); } return f(p, k === 'name' || k === 'town' ? q : c); };
  const body = choose(PRAYERS[k], k, true);
  if (k === 'name' || k === 'town') return body;
  const open = choose(PRAY_OPEN, 'o', true), close = choose(PRAY_CLOSE, 'c', true);
  const s = [open, body, close].filter(Boolean).join(' ');
  return capS(s.length > 230 ? body : s);
}
const capS = s => s.replace(/(^|[.!?…:]\s+)([a-z])/g, (m, a, b) => a + b.toUpperCase()); // “my love” at the start of a sentence
function prayEnd(tbl, k, p, a) { const l = (tbl[k] || []).filter(f => { try { return f(p, a) != null; } catch (e) { return false; } }); return l.length ? capS(pick(l)(p, a)) : null; }
