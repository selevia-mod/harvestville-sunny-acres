# Farm economy v2: planting matters again (owner, 10-11 Nov 2026)

Owner: "users thinking that planting is not necessary and they want to hunt more. How can we make the planting needed
so they will plant more and then raid is now more active." All parts below approved ("I like it, do all that three"),
with the horse rules from the same talk.

## The problem
Hunting pays better than farming, raids need no crops, and an empty field loses nothing in a raid: not planting is
the smart move. Every part below gives crops a use only crops can fill.

## 1. No more seasons; 8 new crops
- Every crop and fruit tree grows all year ("There will no more season plants, everything can be plant now").
  `L.cropInSeason` is always true; Lily sells every seed; a planted crop never dies at a season's turn; fruit trees
  fruit all year. Seasons still change the look of the land, the festivals and the weather.
- The Greenhouse keeps its worth: crops in it grow 25% faster (on top of watering itself and no weeds).
- 8 new crops ("Make it 8 new crops"), on the price ladder of the others:

| Crop | Grows (min) | Mostly for |
|---|---|---|
| Saba Banana | 720 | monkeys' food, potions |
| Oats | 360 | the horse's stamina food |
| Peanut | 240 | cats' food, Mixer |
| Cassava | 1440 | boars' food |
| Taro (gabi) | 720 | bayawaks' food |
| Mung Bean (monggo) | 240 | cooking |
| Pineapple | 1440 | potions, jam |
| Bitter Gourd (ampalaya) | 360 | potions, cooking |

Art: art-src/FARM-ECONOMY-V2-PROMPTS.md (crops, icons, the Mixer and the Silo).

## 2. Raiders eat crops ("they will now raid more so they have food for their raiders")
- Training costs crops as well as Gold (from the Silo or the bag). Owner, 11 Nov 2026: cheaper ("if I train 5 goat so
  it will be 15 cabbage, if I plant 1 bag x9, it will be only 9"): about one crop a raider, the big ones a little more:
  goat 1 cabbage · crow 1 wheat · cat 2 peanut · monkey 2 banana · rooster 2 rice · bayawak 2 taro · carabao 3 corn ·
  boar 3 cassava. A full camp (40 room) eats 3 to 5 seed bags' worth. (Numbers in C.FRAID, tuned in play.)
- Only planted crops count (owner, 11 Nov 2026: "the hunting drops should be different from farm crops"): the Sierra
  Unggoy's Wild Bananas (banana_wild), Banaue's Heirloom Rice and other hunt drops are not the farm's Saba Banana or
  rice; raiders, the Mixer and the Silo take only farm crops.
- Raids pay in crops: what raiders carry from a farm's field comes home as those crops, into your Silo (today it counts
  as Gold value only). Raiding feeds the army.
- A raider's level-up asks for a crop bundle (its own food x10, x20, x40, x60) on top of the hunt item.

## 3. The Mixer: building materials from crops (owner: "corn + wheat + carrots = cement")
A workshop like the Bakery (3 slots, its own building, one per farm). Its materials are needed to level defenses and the
Raid Camp, and they sell at the Market (owner, 11 Nov 2026: yes; crafters can sell to raiders).

| Material | Made from | Time | Used for |
|---|---|---|---|
| Farm Cement | corn 3 + wheat 3 + carrot 3 | 60 min | Watchtower, Mud Pit, Strong Fence levels; Raid Camp levels |
| Rope | cotton 3 + sugarcane 2 | 45 min | Raid Camp levels; Saddlebags |
| Sili Powder | chili 3 + garlic 2 | 45 min | Sili Trap, Sprinkler Blaster levels |
| Beeswax | sunflower 3 + honey 1 | 60 min | Bee Box levels |

Each defense level and camp level needs materials besides its Gold (numbers in C.FRAID, rising with the level).

## 4. The Silo
Harvested crops are already safe from raids (raiders take only ripe crops still in a field), so the Silo is room: a
big store just for crops (300 to start, more with each upgrade) that the Raid Camp, the Mixer and the Kitchen take from
directly, and raids deliver into. Upgrades with Gold, lumber and Farm Cement.

## 5. Hunting needs the farm: crop potions ("this will their potion-like")
Brewed in the Kitchen:
- Ginger Tonic (ginger + honey): +50 energy.
- Ampalaya Brew (bitter gourd 2 + ginger): a charge hurts half, 10 min.
- Pineapple Juice (pineapple 2): walk 20% faster, 10 min.
- Hunter's Coffee (coffee 2 + sugarcane): shots cost no energy, 10 min.
Shots in the five new hunting places cost 3-4 energy (2 in the Wild Lands), so potions matter there.

## 6. The horse goes out (owner, 11 Nov 2026)
- **Bond opens places** (the horse's hearts): town 3 hearts (as now) · the Wild Lands 6 · the hunting places 8 ·
  caves and dungeons 10.
- **Gear** (crafted at the Stable):
  - Horseshoes (iron ore + leather): needed outside the farm and town.
  - Saddlebags (leather + Rope): carry more (bag +12).
  - Lantern Bridle (a lantern + crystal): needed in caves and dungeons.
- **Stamina:** drains while you ride outside the farm. Fed with oats, carrots and apples. At 0 the horse stops: you get
  off and walk, and it follows you until you feed it ("it will not move and you will be walking but it will follow you").
- **Out there:** faster travel; you can shoot arrows while riding ("users can fire arrow while riding a horse"); a
  charging animal can be outrun. In dungeons a big monster's hit can knock you off ("yes can be knocked off"): you
  land on foot, the horse runs back to the entrance and waits.
- Riding art: art-src/RIDING-V2-PROMPTS.md (a real gallop, the owner is redrawing every riding picture).

## Build order (each its own update)
1. No seasons + the 8 new crops (needs the crop art). BUILT 11 Nov 2026 (feat/raid-badge): src/00-zzzzzzzzzzzzzzzzzz-economy.js,
   src/01-logicZZZZZZZZZZZZZ-economy.js, test/economy.test.js. The crops show drawn stand-ins until the owner's pictures come:
   then `node tools/art/economy-import.js` and `node build.js`. Saffron's Rare tab is gone (nothing is out of season).
2. Raiders eat crops + raids pay in crops + the Silo.
3. The Mixer + materials on defense and camp levels.
4. Crop potions + hunting energy.
   Parts 2-4 BUILT 12 Nov 2026 (feat/economy-v2): content src/00-zzzzzzzzzzzzzzzzzzzzzz-economy2.js, rules
   src/01-logicZZZZZZZZZZZZZZZZZ-economy2.js, farm and panels src/19zzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-economy2.js (raid panels:
   their own files), tests test/economy2-*.test.js and test/e2e-economy2.test.js. Owner rules since: raids are just for fun
   (the farm raided loses nothing); the crops a raider wins are the battle copy's ripe crops (copy.ck says which crop each
   is), into the Silo, once the game server counts the raid (s.frc until then); practice raids bring theirs home instead
   of their Gold worth. The Silo comes with every farm (C.SILO.at, or the nearest free spot); the workshops and the Kitchen
   use it too. The game has no farm honey: Wild Honey stands in (Beeswax, Ginger Tonic). Potions have their own clocks,
   beside a dish's power. Save keys: 'sl' (the Silo), 'ptn' (potions), 'frc' (raid crops waiting). Pictures: the Mixer
   and the Silo are drawn in code until the owner's (prompts at the 30-degree camera: ~/Downloads/economy-mixer-silo,
   then assets/props/mixer.png and silo.png); the 8 new icons are the owner's, in the 'econ' pack
   (tools/art/economy2-icons.js), drawn in code until it is on the phone (the page had no room for them).
5. The horse goes out (bond, gear, stamina, shooting while riding, dungeons). BUILT 11 Nov 2026 (feat/horse-out): numbers in
   C.HORSE_OUT (src/00-zzzzzzzzzzzzzzzzzzz-horse.js), rules src/01-logicZZZZZZZZZZZZZZ-horse.js, the world
   src/19zzzzzzzzzzzzzzzzzzzzzzzzz-horse-out.js, tests test/horse-out.test.js and test/e2e-horse-out.test.js; plan
   docs/superpowers/plans/2026-11-11-horse-out.md. Hearts are love / 10 (10 hearts). The game has no iron ore or lantern
   item: Horseshoes = 5 Copper Ore + 1 Soft Leather + 800G, Lantern Bridle = 1 Crystal + 2 Copper Ore + 1,500G (owner can
   change). Saddlebags show "Needs Rope from the Mixer, coming soon": part 3 turns them on (see the PART 3 note in C.HORSE_OUT).
   A horse from before gets 3 hearts once, so town riding stays open. Others see you riding in places with no server change.
Old saves: nothing anyone owns is lost; a raider already trained stays; a level already reached stays.
