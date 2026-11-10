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
- Training costs crops as well as Gold (from the Silo or the bag):
  goat 3 cabbage · crow 3 wheat · cat 4 peanut · carabao 8 corn · monkey 4 banana · boar 6 cassava · rooster 4 rice ·
  bayawak 5 taro. (Numbers in C.FRAID, tuned in play.)
- Raids pay in crops: what raiders carry from a farm's field comes home as those crops, into your Silo (today it counts
  as Gold value only). Raiding feeds the army.
- A raider's level-up asks for a crop bundle (its own food x10, x20, x40, x60) on top of the hunt item.

## 3. The Mixer: building materials from crops (owner: "corn + wheat + carrots = cement")
A workshop like the Bakery (3 slots, its own building, one per farm). Its materials are needed to level defenses and the
Raid Camp, and they sell at the Market (crafters can sell to raiders).

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
1. No seasons + the 8 new crops (needs the crop art).
2. Raiders eat crops + raids pay in crops + the Silo.
3. The Mixer + materials on defense and camp levels.
4. Crop potions + hunting energy.
5. The horse goes out (bond, gear, stamina, shooting while riding, dungeons).
Old saves: nothing anyone owns is lost; a raider already trained stays; a level already reached stays.
