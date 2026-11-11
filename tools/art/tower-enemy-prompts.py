import sys
OUT = sys.argv[1]

STYLE_C = ("Cozy-but-bold game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: bold rounded shapes, soft "
           "shading with highlights, clean dark-brown outlines, strong colors, light from the top-left. No text, no letters, no "
           "watermark, no border, no drop shadow box. ")
ENEMY = ("Drawn for a top-down three-quarter view game: the camera looks down at the creature from above at about 30 degrees, the "
         "SAME camera as Image 1 (use Image 1 ONLY for the camera height, do not copy the farmer), so you see a little of the top of "
         "its back and head as well as its body. NOT a flat side view, NOT a flat front view. A sprite sheet arranged as a neat grid "
         "of 3 columns by 4 rows of equal cells, one pose per cell, each centered in its cell with clear empty space around it. The "
         "same creature in every cell: identical design, colors, size and proportions, standing (or hovering) on the same invisible "
         "ground line near the bottom of each cell, nothing touching the cell edges. No lines between cells. It is a FIERCE, ANGRY "
         "ENEMY ready to fight: a deep scowl, heavy furrowed brows, glaring narrowed eyes, bared sharp teeth or fangs, claws or weapons "
         "raised, a tense aggressive battle stance, spikes, scars of old battles on its armour or shell where it fits. Menacing and "
         "tough like a real action-game enemy, but NOT gory and NOT horror: no blood, no wounds, no realistic monster faces; bold "
         "clean cartoon game art. ")
TRANSP = (" Isolated on a fully transparent background (PNG with alpha). If transparency is not possible, use a flat solid pure "
          "magenta #FF00FF background with nothing else on it.")
TEX = ("A seamless, tileable square texture seen from directly above that fills the whole picture edge to edge. Even lighting, no "
       "vignette, nothing cut off at the edges, no single big object, no mirror symmetry and no repeating kaleidoscope pattern, so "
       "copies can sit side by side without a visible seam. ")
CAM30 = ("Seen from a top-down three-quarter view, the camera looking down at about 30 degrees, the SAME camera as Image 1 (use Image "
         "1 ONLY for the camera height). ")
BIG = "It is a BIG creature: it fills most of each cell (the others of this zone fill about half). "

def rows(move, fly):
    if fly:
        return (f"Row 1: {move} toward the camera (facing down, front-and-top view). Row 2: {move} away from the camera (facing up, "
                f"back-and-top view). Row 3: {move} to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are "
                f"three steps of its flying loop, hovering at the same height. ")
    return (f"Row 1: {move} toward the camera (facing down, front-and-top view). Row 2: {move} away from the camera (facing up, "
            f"back-and-top view). Row 3: {move} to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are: "
            f"standing ready, mid-step one way, mid-step the other way. ")

N = "normal enemy"; G = "GUARD, every 10th floor"; M = "MINI BOSS, every 50th floor"; B = "BIG BOSS, the 100th floor"

# ---------- the ten zones: theme, myth, looks ----------
ZONES = {
 1: dict(name="Tambanakua's Tide Stairs", floors="1-100", trick="none yet",
   myth="Tambanakua, the giant crab of Bagobo legend whose moving makes the tides",
   floor="wet dark-grey stone stair landings and flagstones with shallow tide puddles, barnacles, small shells and strands of green seaweed",
   water="a shallow tide pool seen from above: clear blue-green sea water over dark stones, small waves, foam at the edges",
   top="the top of a thick sea-cliff wall seen from above: dark wet rock crusted with barnacles, mussels and green moss",
   face="the face of a wet sea-cliff wall seen from the front: dark grey rock with barnacle bands, dripping water, hanging seaweed and a rusted iron ring here and there",
   props=["a heap of big rough barnacle-crusted rocks", "a broken old stone pillar wrapped in seaweed", "an old wooden lighthouse crate burst open with ropes", "a giant crab claw shell half buried in sand", "a rusty iron anchor stuck in the floor", "a cluster of sharp black mussel rocks with foam"],
   gate="a frame of wet grey sea stone covered in barnacles", lid="a heavy round stone lid carved with a giant crab", glow="cold sea-blue light"),
 2: dict(name="Pugita's Deep", floors="101-200", trick="SHIELDED: some carry shields that only a Rifle shot breaks",
   myth="the deep sea lair of Pugita, the giant octopus that drags ships down",
   floor="the floor of a deep-sea cavern: dark blue-violet sand with ink stains, small purple coral, scattered shells and old coins",
   water="a deep sea pool seen from above: very dark blue water with faint purple ink swirls and bubbles",
   top="the top of a deep-sea rock wall seen from above: dark violet rock covered in sucker-marked tentacle scars, sea anemones and purple coral",
   face="the face of a deep-sea cavern wall seen from the front: dark violet and navy rock, curling tentacle shapes carved by the sea, glowing purple coral and hanging kelp",
   props=["a huge coiled stone tentacle rising from the floor", "a wrecked ship's wheel tangled in kelp", "a pile of cracked giant clam shells", "a sunken treasure chest wrapped in tentacle-like roots", "a tall purple coral spire with spikes", "a heap of broken ship planks with ink stains"],
   gate="a frame of dark violet stone with carved tentacles", lid="a heavy round stone lid carved with a glaring octopus eye", glow="deep purple light"),
 3: dict(name="Berberoka's Swamp", floors="201-300", trick="BURSTING: beaten ones burst into a puddle that slows you",
   myth="the Berberoka, the swamp giant who drinks a whole lake to trap travellers in the mud",
   floor="swamp ground: soft brown-green mud, flat stepping stones, puddles, roots and fallen leaves, flat and walkable",
   water="murky green swamp water seen from above: duckweed, bubbles, floating leaves",
   top="the top of a swamp bank seen from above: tangled mangrove roots, dark moss and mud",
   face="the face of a muddy swamp bank seen from the front: layers of brown mud and roots, dripping moss, small mushrooms",
   props=["a twisted dead mangrove tree with hanging moss", "a big hollow log with glowing mushrooms", "a pile of mossy stones half sunk in mud", "a broken wooden boardwalk piece", "a cluster of tall reeds and cattails", "a giant cracked clay jar spilling mud"],
   gate="a frame of mossy swamp stones and roots", lid="a heavy round wooden lid with a carved angry giant's face", glow="sickly green light"),
 4: dict(name="Magindara's Lagoon", floors="301-400", trick="SONG: their singing slows your shooting",
   myth="Magindara, the fierce guardian of the sea in Bicol legend, and her singing Sirena",
   floor="a moonlit lagoon floor: pale silver sand and smooth flat white stones with shallow sheets of water reflecting the moon",
   water="a moonlit lagoon seen from above: deep blue water with silver moonlight ripples and lily pads",
   top="the top of a lagoon rock wall seen from above: pale blue-grey rock with pearly shells and glowing blue moss",
   face="the face of a lagoon grotto wall seen from the front: pale blue-grey rock with pearl veins, glowing blue moss and hanging silver vines",
   props=["a tall pearl-white rock where Sirena sit", "a giant open clam with a glowing pearl", "a ring of moonlit standing stones", "a cluster of glowing blue lotus flowers", "a broken stone harp covered in shells", "a driftwood arch hung with shells"],
   gate="a frame of pale pearly stone", lid="a heavy round stone lid carved with a crescent moon and a mermaid tail", glow="silver moonlight"),
 5: dict(name="Anitun Tabu's Storm Gallery", floors="401-500", trick="FLYING FLOCKS: many fliers at once",
   myth="Anitun Tabu, the goddess of wind and rain, and Galura, the giant eagle that carries the storm",
   floor="a high stone gallery floor in a storm: grey flagstones wet with rain, puddles, scattered leaves and feathers",
   water="a rain-filled stone basin seen from above: grey water whipped by rain, ripples everywhere",
   top="the top of a high storm-battered stone wall seen from above: dark grey blocks, puddles, cracks, a few feathers",
   face="the face of a high stone gallery wall seen from the front: grey blocks with open arches showing a stormy sky and lightning, torn cloth banners",
   props=["a toppled stone pillar cracked by lightning", "a torn ship's sail on a broken mast", "a giant eagle feather stuck in the floor", "a bronze wind chime on a stand, swinging", "a pile of storm-broken roof tiles", "a stone eagle statue with spread wings"],
   gate="a frame of grey storm stone with carved wings", lid="a heavy round stone lid carved with a lightning bolt", glow="flashing white storm light"),
 6: dict(name="The Kataw Court", floors="501-600", trick="HEALERS: some heal the others; beat them first",
   myth="the Kataw, the proud sea royalty of Visayan legend",
   floor="a royal undersea palace floor: polished turquoise and gold mosaic tiles with pearl inlays, flat",
   water="a royal fountain pool seen from above: clear turquoise water over gold tiles",
   top="the top of a palace wall seen from above: turquoise stone with gold trim and pearl studs",
   face="the face of a royal undersea palace wall seen from the front: turquoise stone with gold fish-scale patterns, pearl lamps and hanging royal banners of sea-green cloth",
   props=["a golden throne shaped like a fan of coral", "a tall pearl lamp on a gold stand", "a royal treasure heap of gold and pearls", "a coral statue of a Kataw king", "a gold-trimmed fountain with a fish spout", "a royal banner stand with a sea-green flag"],
   gate="a frame of turquoise stone with gold trim", lid="a heavy round gold-and-stone lid with a pearl crown", glow="warm golden light"),
 7: dict(name="Santelmo's Lantern Spire", floors="601-700", trick="DARKNESS: you only see near your lantern",
   myth="the Santelmo, the spirit fires that float over the land at night",
   floor="a dark stone spire floor: black-blue flagstones faintly lit by floating blue fire, with old candle wax and ash",
   water="a pool of dark still water seen from above reflecting floating blue flames",
   top="the top of a dark spire wall seen from above: black stone with blue fire glowing in cracks",
   face="the face of a dark spire wall seen from the front: black-blue stone blocks with iron lantern hooks and faint blue fire in the cracks",
   props=["an iron lantern post with a blue spirit flame", "a ring of melted candles", "a cracked stone brazier with blue fire", "a stack of old iron cages, empty", "a dark stone statue holding a lantern", "a pile of ash and broken lanterns"],
   gate="a frame of black stone with iron lantern hooks", lid="a heavy round iron lid with a carved flame", glow="eerie blue fire light"),
 8: dict(name="Biringan, the Invisible City", floors="701-800", trick="SPLITTERS: beaten ones split into two",
   myth="Biringan, the hidden golden city of the engkanto in Samar legend, seen only by the lost",
   floor="a ghostly golden city street floor: pale gold cobblestones half see-through, with wisps of mist and cloud",
   water="a pool of shimmering mist seen from above, gold and white, like water made of light",
   top="the top of a golden city wall seen from above: pale gold blocks fading into mist",
   face="the face of a ghostly golden city wall seen from the front: pale gold and white stone with arched windows glowing, half see-through, misty",
   props=["a golden street lamp glowing, half see-through", "a fountain of light in a gold basin", "a golden gate arch that leads nowhere", "a tall gold-and-white engkanto statue", "a market stall of glowing golden fruit", "a mirror on a stand showing a different room"],
   gate="a frame of pale gold stone fading into mist", lid="a heavy round gold lid with a carved engkanto face", glow="shimmering golden light"),
 9: dict(name="Mayari's Starfall", floors="801-900", trick="REVIVERS: they stand up again unless finished quickly",
   myth="Mayari, the goddess of the moon, and Tala, the goddess of the stars",
   floor="a floor made of night sky: deep blue stone with tiny glowing stars set in it and a faint silver moon path",
   water="a pool of night sky seen from above: dark blue with stars and a reflected moon",
   top="the top of a starry wall seen from above: dark blue stone flecked with gold stars",
   face="the face of a wall of night sky seen from the front: deep blue stone with glowing constellations, silver moon carvings",
   props=["a fallen star glowing in a small crater", "a silver moon statue", "a stone sundial of the moon phases", "a cluster of glowing crystal stars", "a broken telescope of brass", "a silver tree with star-shaped leaves"],
   gate="a frame of deep blue stone set with stars", lid="a heavy round silver lid with a crescent moon", glow="silver starlight"),
 10: dict(name="The Seventh Moon", floors="901-1000", trick="everything at once",
   myth="Bathala made seven moons and the Bakunawa sea dragon swallowed six: the last moon shines over the top of the Lost Tower",
   floor="the top of the Lost Tower: ancient white and gold stone with carved waves and moons, cracked by the dragon",
   water="the sea far below seen through a gap, dark blue with a great moon reflected",
   top="the top of the tower's crown wall seen from above: white stone with gold moon carvings and dragon claw marks",
   face="the face of the tower's crown wall seen from the front: white and gold stone carved with seven moons, six of them broken",
   props=["a huge broken stone moon", "a coiled sea-dragon statue of blue stone", "the great lighthouse lamp of gold, unlit", "a pile of dragon scales as big as shields", "a stone altar with a glowing moon pearl", "a broken white pillar with gold rings"],
   gate="a frame of white and gold stone carved with moons", lid="a heavy round gold lid with a coiled dragon", glow="huge white moonlight"),
}

E = []
def e(*a): E.append(a)
# zone, id, name, role, move, flies, look, row 4
e(1, 'talangka', 'Talangka', N, 'scuttling', False, "a shore crab with a jagged sandy-orange shell, two sharp claws held up like a boxer, tall glaring stalk eyes and a snarling mouth; quick and vicious", "Row 4, left to right: snapping both claws, facing the camera; scuttling sideways to the LEFT very fast; claws crossed in a guard, facing the camera")
e(1, 'kanaway', 'Kanaway', N, 'flying', True, "a big grey-and-white seagull with a hooked yellow beak, black wing tips, ragged feathers and furious red-rimmed eyes, screeching", "Row 4, left to right: diving down beak first, facing the camera; flapping in place screeching, facing LEFT; talons out to strike, facing the camera")
e(1, 'igat', 'Igat', N, 'slithering', False, "a long sea eel with a glossy olive-green body, a spiky fin along its back and a mouth full of sharp teeth bared in a hiss", "Row 4, left to right: rearing up to strike with its jaws wide open, facing the camera; lunging to the LEFT like a spring; coiled and hissing, facing the camera")
e(1, 'alimango', 'Alimango Knight', G, 'stomping', False, "a big mud crab in dark blue-green shell armour covered in battle scratches, one huge claw like a shield and one like a hammer, a helmet of shells and rope, glaring", "Row 4, left to right: raising the huge claw like a shield, facing the camera; slamming the hammer claw down, facing LEFT; charging to the LEFT with both claws forward")
e(1, 'ulang', 'Ulang', M, 'marching', False, "a big blue-and-orange lobster with spiked armour, long whipping feelers, barnacles on its back and two great pincers, marching like an angry general", "Row 4, left to right: both pincers snapping open toward the camera; a tail-flip leap backward, facing LEFT; spinning with pincers out, facing the camera")
e(1, 'tambanakua', 'Tambanakua', B, 'stomping', False, "the giant crab of Bagobo legend who makes the tides: a huge spiked mossy-green and coral-red shell with a little rock island and a broken lighthouse on top, enormous claws, a furious ancient face with glowing angry eyes and a seaweed beard", "Row 4, left to right: both giant claws raised high, roaring, facing the camera; a tidal stomp with a wave rising round its feet, facing LEFT; slamming one giant claw down to the LEFT")

e(2, 'kugita', 'Kugita', N, 'creeping', False, "a small dark-purple octopus with angry glowing eyes, curling arms with sharp-ringed suckers, squirting ink when it fights", "Row 4, left to right: squirting a cloud of black ink, facing the camera; lashing two arms out to the LEFT; rearing up tall on its arms, facing the camera")
e(2, 'umang', 'Umang Shieldbearer', N, 'stomping', False, "a big hermit crab whose huge spiral shell, spiked and covered in coral, is its SHIELD (the shell is clear to see), glaring out from the shell with sharp claws", "Row 4, left to right: hiding fully behind its spiked shell SHIELD, facing the camera; the shell CRACKED and falling away in pieces, snarling, facing the camera; ramming forward with the shell to the LEFT")
e(2, 'dikya', 'Dikya', N, 'floating', True, "a jellyfish with a glowing purple bell, stinging trailing ribbons crackling with sparks and a furious frown", "Row 4, left to right: pulsing big with a crackling glow, facing the camera; lashing stinging ribbons to the LEFT; puffing up angrily, facing the camera")
e(2, 'kugita_kabalyero', 'Kugita Knight', G, 'creeping', False, "a big octopus in barnacle-crusted armour plates, a round shell SHIELD in two arms and a coral spear in another, a scarred helmet, glaring", "Row 4, left to right: shield up and spear ready, facing the camera; a spear thrust to the LEFT; the shield CRACKED in two, roaring, facing the camera")
e(2, 'pating', 'Pating na Bakal', M, 'charging', False, "a chunky reef shark that crawls on its fins over the wet floor, wearing riveted copper armour plates over its back (a SHIELDED one), rows of sharp teeth in a snarl", "Row 4, left to right: jaws snapping wide open, facing the camera; a fast lunge to the LEFT; its copper armour plates bursting off, roaring, facing the camera")
e(2, 'pugita', 'Pugita', B, 'creeping', False, "the giant octopus of the deep that drags ships down: a huge dark-purple and coral-red octopus with eight thick curling arms, one holding a broken ship's hull as a giant SHIELD, a crown of wreckage on its head, huge furious glowing eyes", "Row 4, left to right: all arms raised, blasting a cloud of black ink, facing the camera; slamming two giant arms down with a splash, facing LEFT; swinging the ship-hull shield to the LEFT")

e(3, 'palakang_putik', 'Mud Toad', N, 'hopping', False, "a fat warty brown-green swamp toad with a swollen throat, glaring yellow eyes and a scowling wide mouth; it BURSTS into a splash of sticky mud", "Row 4, left to right: throat puffed up huge, facing the camera; BURSTING into a splash of mud, facing the camera; a long leaping tackle to the LEFT")
e(3, 'kuhol', 'Kuhol', N, 'crawling', False, "a big swamp apple snail with a spiky dark shell, slimy grey body and angry eye stalks; it BURSTS into a puddle of slime", "Row 4, left to right: rearing up out of its shell, facing the camera; BURSTING into a puddle of green slime, facing the camera; ramming to the LEFT with its shell")
e(3, 'parol_multo', 'Swamp Lantern', N, 'floating', True, "an old rusty lantern floating over the swamp with an angry green ghost flame inside and two glaring eyes in the glass", "Row 4, left to right: flaring bright, facing the camera; BURSTING into green sparks and a glowing puddle, facing the camera; swooping to the LEFT")
e(3, 'putik_golem', 'Mud Golem', G, 'stomping', False, "a big golem of swamp mud and roots with stones for fists, moss on its shoulders and two glowing angry eyes", "Row 4, left to right: raising both fists, roaring, facing the camera; a ground pound that splashes mud to the LEFT; half melting into a mud puddle, facing the camera")
e(3, 'dambuhalang_kuhol', 'Giant Kuhol', M, 'crawling', False, "a huge swamp snail as big as a cart, its shell spiked like a fortress and covered in moss and mushrooms, furious eye stalks", "Row 4, left to right: rearing up and spitting slime, facing the camera; a slimy charge to the LEFT; BURSTING into a big wave of slime, facing the camera")
e(3, 'berberoka', 'Berberoka', B, 'stomping', False, "the Berberoka, the swamp giant of Filipino legend who drinks a whole lake to trap travellers: a huge hulking giant with green-brown skin like mud and bark, a belly swollen with swamp water, long arms, moss and reeds for hair, a furious face with tusks", "Row 4, left to right: drinking a whirlpool of swamp water into its open mouth, facing the camera; spraying a huge jet of water to the LEFT; pounding the ground with both fists, roaring, facing the camera")

e(4, 'sirena', 'Sirena', N, 'gliding', False, "a fierce Sirena, the mermaid of Filipino legend: wild dark hair with shells, glaring eyes, a sharp-finned silver-teal tail she glides on, a trident; angry music notes swirl round her when she sings", "Row 4, left to right: SINGING a war song with sharp glowing music notes around her, facing the camera; a tail-slap wave to the LEFT; pointing the trident angrily, facing the camera")
e(4, 'dikya_buwan', 'Moon Jelly', N, 'floating', True, "a pale moon-white jellyfish with a crescent glow inside its bell, stinging silver ribbons and a furious frown", "Row 4, left to right: blazing like the full moon, facing the camera; lashing silver ribbons to the LEFT; zapping a silver spark, facing the camera")
e(4, 'palakang_buwan', 'Moon Frog', N, 'hopping', False, "a big blue-green frog with glowing silver spots, a spiky back and a booming throat bubble, glaring", "Row 4, left to right: croaking a booming note with a glowing throat bubble, facing the camera; a long leap to the LEFT; tongue lashing out, facing the camera")
e(4, 'sirena_koro', 'Sirena Chorus Leader', G, 'gliding', False, "a bigger fierce Sirena with a conch-shell horn, a spiked pearl tiara and a glittering purple-blue tail, leading the lagoon's war song", "Row 4, left to right: blowing the conch with rings of sharp music notes, facing the camera; a high note that sends a wave of sparks to the LEFT; glaring with arms crossed, facing the camera")
e(4, 'sirenang_bituin', 'Star Sirena', M, 'gliding', False, "a fierce Sirena whose tail and wild hair shimmer with stars, holding a spiked starfish harp", "Row 4, left to right: striking the starfish harp with notes flying like blades, facing the camera; a swirl of star notes to the LEFT; diving with only her tail showing, facing the camera")
e(4, 'magindara', 'Magindara', B, 'gliding', False, "Magindara, the fierce guardian of the sea in Bicol legend: a tall powerful sea warrior with a long aqua-and-gold tail, a crown of sharp coral and pearls, hair like crashing waves, a staff topped with a glowing moon pearl, eyes glowing with fury", "Row 4, left to right: raising the moon pearl staff as a storm of music and water rises, facing the camera; hurling a wave of water and notes to the LEFT; screaming a war song with a ring of sharp notes, facing the camera")

e(5, 'langay', 'Langay-langayan', N, 'flying', True, "a dark-blue swiftlet bird with sharp blade-like wings, a white chest and furious little eyes; they come in flocks", "Row 4, left to right: a fast dive, facing the camera; a slashing loop to the LEFT; three of them flying together in a V, facing LEFT")
e(5, 'kabag', 'Storm Bat', N, 'flying', True, "a grey bat with jagged wings, a lightning-bolt tuft of fur, sharp fangs and glowing yellow eyes", "Row 4, left to right: shrieking with fangs out, facing the camera; a crackle of lightning round it, facing LEFT; swooping to the LEFT")
e(5, 'ulap', 'Ulap', N, 'floating', True, "an angry storm-cloud spirit, dark grey and swirling, rain pouring from its bottom, lightning crackling, glaring eyes and a snarl", "Row 4, left to right: pouring rain hard, facing the camera; firing a lightning bolt to the LEFT; swelling up with thunder, facing the camera")
e(5, 'lawin_kidlat', 'Thunder Hawk', G, 'flying', True, "a big brown-and-gold hawk with sparks along its wing edges, hooked beak, sharp talons and fierce eyes", "Row 4, left to right: screeching with wings wide, facing the camera; a lightning dive to the LEFT; talons forward to grab, facing the camera")
e(5, 'bagyo', 'Bagyo', M, 'whirling', True, "a typhoon spirit: a spinning swirl of wind, rain and debris with two glowing angry eyes and a snarl, leaves and roof tiles whirling round it", "Row 4, left to right: spinning as a tall whirlwind, facing the camera; blasting a gust to the LEFT; roaring with a burst of wind, facing the camera")
e(5, 'galura', 'Galura', B, 'flying', True, "Galura, the giant eagle of Kapampangan legend who carries the storm: an enormous golden-brown eagle with storm-grey wings crackling with white lightning, a crest like a crown, hooked beak, huge talons and furious eyes", "Row 4, left to right: wings spread wide with lightning crackling, facing the camera; a diving strike with talons forward to the LEFT; beating its wings to blow a storm gust, facing the camera")

e(6, 'kataw', 'Kataw Courtier', N, 'strutting', False, "a Kataw, the sea royalty of Visayan legend: a fish-person with a spiked regal frill, a small pearl crown, a coral rapier and a haughty furious glare", "Row 4, left to right: thrusting the coral rapier, facing the camera; a fencing lunge to the LEFT; pointing a fin in outrage, facing the camera")
e(6, 'kataw_manggagamot', 'Kataw Healer', N, 'strutting', False, "a Kataw healer in sea-green robes with a staff topped by a glowing green sea-glass orb, a stern scowling face; it HEALS its allies with a green glow", "Row 4, left to right: HEALING: raising the staff with a strong green glow and green plus-sparkles around, facing the camera; the same green glow sent to the LEFT; glaring with the staff raised, facing the camera")
e(6, 'kabayo_dagat', 'Seahorse Knight', N, 'bouncing', False, "a tall armoured seahorse that bounces on its curled tail, a spiked shell helmet and a narwhal-horn lance, glaring", "Row 4, left to right: lance raised to strike, facing the camera; a bouncing lance charge to the LEFT; a spinning tail strike, facing the camera")
e(6, 'bantay_hari', 'Royal Guard', G, 'marching', False, "a big Kataw royal guard in gold-trimmed scale armour with a tall halberd and a crest shield with a pearl, a stern furious face", "Row 4, left to right: halberd raised to strike, facing the camera; a halberd sweep to the LEFT; raising the shield with a green healing glow, facing the camera")
e(6, 'kataw_reyna', 'Kataw Queen', M, 'gliding', False, "the Kataw Queen: a tall cold fish-woman with a spiked coral crown, a flowing fin gown of coral pink and pearl, a sceptre with a glowing green HEALING pearl, a furious glare", "Row 4, left to right: raising the sceptre to HEAL with a wide green glow, facing the camera; firing a blast from the sceptre to the LEFT; snapping a shell fan shut angrily, facing the camera")
e(6, 'kataw_hari', 'Kataw King', B, 'striding', False, "the Kataw King: a huge royal fish-man with a grand spiked pearl-and-coral crown, a flowing royal cape of fins, blue-and-gold armour, a great trident and a stern furious face", "Row 4, left to right: raising the trident as a ring of green healing light rises round him, facing the camera; a royal trident strike to the LEFT; pointing the trident in fury, facing the camera")

e(7, 'santelmong_asul', 'Blue Santelmo', N, 'floating', True, "a blue spirit fire (santelmo) with an angry face in its flame and a sharp curling flame tail", "Row 4, left to right: flaring up bright and furious, facing the camera; zipping to the LEFT leaving sparks; shrinking to a small hissing flame, facing the camera")
e(7, 'alitaptap', 'Alitaptap', N, 'flying', True, "a big firefly with a blazing yellow-green tail, sharp mandibles, buzzing wings and angry glowing eyes", "Row 4, left to right: glowing at its brightest, facing the camera; going dark with only its angry eyes showing, facing the camera; darting to the LEFT")
e(7, 'anino', 'Anino', N, 'creeping', False, "Anino, a shadow creature: a shape of deep purple-black shadow with clawed wispy arms and two glowing white angry eyes; only its eyes shine in the dark", "Row 4, left to right: rising up tall with claws spread, facing the camera; melting into a puddle of shadow, facing the camera; slashing fast to the LEFT")
e(7, 'lampara_golem', 'Lamp Golem', G, 'stomping', False, "a hulking golem built of old lighthouse lamp parts: brass plates, iron fists, a glass lamp head with an angry blue fire inside", "Row 4, left to right: its lamp head blazing, facing the camera; a heavy punch to the LEFT; its lamp going dark with glowing eyes, facing the camera")
e(7, 'dambuhalang_anino', 'Great Anino', M, 'creeping', False, "a big shadow spirit like a tall cloak of darkness with many glowing angry eyes and long clawed wispy arms", "Row 4, left to right: spreading wide and swallowing the light, facing the camera; reaching out to the LEFT with a shadow claw; recoiling from a light with a snarl, facing the camera")
e(7, 'dakilang_santelmo', 'Great Santelmo', B, 'floating', True, "the Great Santelmo: a huge whirling spirit of white-blue fire shaped like a great flame with a furious ancient face, smaller angry wisps orbiting it", "Row 4, left to right: blazing up into a pillar of blue fire, facing the camera; hurling a ball of blue fire to the LEFT; roaring with fire swirling out, facing the camera")

e(8, 'engkanto', 'Engkanto', N, 'striding', False, "an engkanto of Biringan, the hidden city: a tall pale fair-haired trickster spirit in shimmering golden clothes, pointed features, a cold glaring stare and a golden blade; it SPLITS into two copies when beaten", "Row 4, left to right: SPLITTING into two copies of itself, facing the camera; a golden blade slash to the LEFT; fading half see-through with a sneer, facing the camera")
e(8, 'minokawa_sisiw', 'Minokawa Chick', N, 'flapping', True, "a young chick of the Minokawa, the moon-eating bird of Bagobo legend: silver-and-gold feathers, a sharp hooked beak, steel claws and furious eyes", "Row 4, left to right: screeching with wings out, facing the camera; pecking hard to the LEFT; SPLITTING into two smaller chicks, facing the camera")
e(8, 'ulap_blob', 'Sky Drop', N, 'bouncing', False, "a wobbly gold-and-sky-blue drop of living mist with a scowling face; it SPLITS in two when hit hard", "Row 4, left to right: SPLITTING into two smaller drops, facing the camera; a bouncing tackle to the LEFT; swelling up angrily, facing the camera")
e(8, 'bantay_biringan', 'Biringan Gatekeeper', G, 'marching', False, "a tall engkanto guard in gleaming gold armour with a spear and a mirror shield that shows a different face, a cold furious glare", "Row 4, left to right: spear raised, facing the camera; a spear thrust to the LEFT; SPLITTING into two gatekeepers, facing the camera")
e(8, 'tigmamanukan', 'Tigmamanukan', M, 'flying', True, "the Tigmamanukan, the omen bird of Tagalog legend: a big blue-green bird with a long tail of sharp shimmering feathers and piercing furious golden eyes", "Row 4, left to right: spreading its tail like a fan of blades, facing the camera; a dive to the LEFT; SPLITTING into two blue birds, facing the camera")
e(8, 'minokawa', 'Minokawa', B, 'flying', True, "the Minokawa, the giant moon-eating bird of Bagobo legend: an enormous bird with mirror-bright silver feathers sharp as swords, steel claws, a long hooked beak, a full moon glowing in its open beak and furious eyes", "Row 4, left to right: opening its beak to swallow a glowing moon, facing the camera; beating mirror wings to send blades of light to the LEFT; diving claws first, facing the camera")

e(9, 'tala', 'Tala', N, 'floating', True, "a star spirit: a jagged five-pointed glowing golden star with an angry face and sharp points; when beaten it can light up again", "Row 4, left to right: blazing bright, facing the camera; lying dim and flickering on the ground, facing the camera; REVIVING: blazing up again with a burst of sparks, facing the camera")
e(9, 'bituing_alimasag', 'Star Crab', N, 'scuttling', False, "a dark-blue crab whose spiked shell is speckled with glowing stars like the night sky, sharp claws up, glaring", "Row 4, left to right: claws snapping, facing the camera; scuttling to the LEFT; REVIVING: flipping back up from its back with a flash, facing the camera")
e(9, 'gamugamo_buwan', 'Moon Moth', N, 'flying', True, "a big silver moth with sharp-edged pale wings patterned like moon phases and angry glowing eyes", "Row 4, left to right: wings spread showing the moon pattern, facing the camera; blasting glittering dust to the LEFT; REVIVING: rising from folded wings with a flash, facing the camera")
e(9, 'bituing_golem', 'Star Golem', G, 'stomping', False, "a hulking golem of dark night-sky stone with glowing golden stars set in its body, a crescent moon on its chest and glowing angry eyes", "Row 4, left to right: stars on its body flaring, facing the camera; a ground pound to the LEFT; REVIVING: its stones pulling back together, facing the camera")
e(9, 'pagong_batong_buwan', 'Moonstone Tortoise', M, 'plodding', False, "a huge tortoise with a spiked shell of glowing moonstone, a stone beak and furious eyes", "Row 4, left to right: shell blazing, facing the camera; a shell-spin charge to the LEFT; REVIVING: a burst of moonlight as it stands up again, facing the camera")
e(9, 'tagapag_ingat_bituin', 'Star Keeper', B, 'striding', False, "the Star Keeper, guardian of Mayari's stars: a tall stern cosmic warrior in a robe of deep night blue full of stars, a hood with a crescent moon, a lantern holding a tiny galaxy and eyes glowing with fury", "Row 4, left to right: raising the galaxy lantern as stars rain down, facing the camera; hurling a shooting star to the LEFT; REVIVING a fallen star creature with a beam of light, facing the camera")

e(10, 'bakunawa_anak', 'Bakunawa Hatchling', N, 'slithering', False, "a young sea-dragon of the Bakunawa: a long sea-blue serpent body with a pearl-white belly, small fin wings, sharp teeth and a snarling dragon face with a moon mark", "Row 4, left to right: rearing up with jaws open, facing the camera; a lunge to the LEFT; coiled to strike, facing the camera")
e(10, 'laho', 'Laho', N, 'floating', True, "Laho, the eclipse spirit: a dark disc with a blazing golden ring of light round it, shadow tendrils and two angry glowing eyes", "Row 4, left to right: blazing ring of light, facing the camera; swallowing the light to go dark, facing the camera; lashing tendrils to the LEFT")
e(10, 'parola_golem', 'Lighthouse Golem', N, 'stomping', False, "a golem shaped like a walking lighthouse: cracked red-and-white striped stone body, a blazing lamp head glaring like an eye, heavy stone fists", "Row 4, left to right: its lamp beam blazing, facing the camera; a stone punch to the LEFT; slamming both fists down, facing the camera")
e(10, 'bakunawa_bata', 'Bakunawa Whelp', G, 'slithering', False, "a bigger young Bakunawa sea-dragon with deep blue scales, a spiked pearly fin crest, wings, sharp teeth and a glowing moon mark, snarling", "Row 4, left to right: roaring with fins up, facing the camera; a tail whip to the LEFT; breathing a blast of sea mist, facing the camera")
e(10, 'dakilang_laho', 'Great Laho', M, 'floating', True, "a big eclipse serpent coiled in a ring of shadow and golden light, with a furious glowing face and fangs", "Row 4, left to right: forming a full eclipse ring, facing the camera; striking to the LEFT with a shadow coil; uncoiling with a roar, facing the camera")
e(10, 'bakunawa_ng_look', 'Bakunawa of the Bay', B, 'slithering', False, "the Bakunawa of the Bay, the great sea dragon of Filipino legend that swallowed six of the seven moons: an enormous sea-serpent dragon with deep ocean-blue scales, a pearl-white belly, flowing fin wings like waves, long whiskers, a crown of coral, rows of sharp teeth and the last moon glowing in its open jaws; the final boss, huge and furious", "Row 4, left to right: rising tall with the moon glowing in its open jaws, facing the camera; a huge wave of water and light sent to the LEFT; coiled round a broken pillar, glaring, facing the camera")

out = ["# The Lost Tower: all the pictures (owner, 12 Nov 2026)", "",
       "The tower climbs from the bottom of Manila Bay to the last moon. Every 100 floors is a realm of Filipino mythology with its",
       "own look and its own enemies: 3 normal enemies, a guard (every 10th floor), a mini boss (every 50th floor) and the big boss",
       "(the 100th floor). The ENEMIES are FIERCE and ANGRY, ready to fight, but not gory or horror. The farmer and the villagers do",
       "not change.", "",
       "**How:** one prompt = one picture, each in a NEW chat. For every prompt that says \"Image 1\", attach `CAMERA-30deg-farmer.png`",
       "(in this folder) as Image 1: it shows ONLY the camera height (30 degrees); the picture must not copy the farmer. Save each",
       "with the file name shown and send them as zips like before; the names are all that matter.", "",
       "**Order:** zone 1 first (the Tower opens with it), then zone 2, and so on. Each zone = 6 enemies + 6 looks = 12 pictures;",
       "120 in all. The game shows drawn stand-ins for anything not in yet.", "",
       "| Floors | Realm | Its myth | Trick |", "|---|---|---|---|"]
for k in range(1, 11):
    z = ZONES[k]
    out.append(f"| {z['floors']} | {z['name']} | {z['myth']} | {z['trick']} |")
out.append("")
n = 0
for k in range(1, 11):
    z = ZONES[k]
    out.append(f"## Zone {k}: {z['name']} (floors {z['floors']})")
    out.append("")
    out.append(f"Myth: {z['myth']}. Trick: {z['trick']}.")
    out.append("")
    out.append("### The enemies")
    out.append("")
    for row in [r for r in E if r[0] == k]:
        n += 1
        _, fid, name, role, move, fly, look, r4 = row
        txt = STYLE_C + ENEMY + (BIG if role == B else "") + "The creature: " + name + ", " + look + ". " + rows(move, fly) + r4 + ". No shadow on the ground (the game adds its own)." + TRANSP
        out += [f"#### {n}. `tower/zone{k}/wild_{fid}.png` (1024x1536): {name} ({role})", "```", txt, "```", ""]
    out.append("### The look of the floors")
    out.append("")
    base = f"tower/zone{k}/"
    looks = [
      (f"{base}floor.png", "1024x1024", "the floor", TEX + z['floor'] + ". Flat and walkable, calm and not too busy, so creatures stand out on it."),
      (f"{base}water.png", "1024x1024", "the pools", TEX + z['water'] + "."),
      (f"{base}rock_top.png", "1024x1024", "the wall top", TEX + z['top'] + ", darker than the floor."),
      (f"{base}rock_face.png", "1024x1024", "the wall face", STYLE_C + "A tileable texture of " + z['face'] + ", as the low wall along the top of a top-down game room. It repeats left to right without a seam and fills the whole picture edge to edge, darker at the top and a little lighter at the bottom edge where it meets the floor. No single big object, no vignette."),
      (f"{base}props.png", "1536x1024", "6 props", STYLE_C + CAM30 + "A set of 6 separate game props for " + z['name'] + ", a floor of a mythical tower. Arranged as a neat grid of 3 columns by 2 rows of equal cells, one item per cell, each item centered in its cell with clear empty space around it, all at the same scale and in the same style. No lines between cells. Row by row, left to right: " + "; ".join(f"{i+1}) {p}" for i, p in enumerate(z['props'])) + "." + TRANSP + " Keep the whole object inside the picture with some empty margin."),
      (f"{base}stairs.png", "1536x1024", "the way up (closed / open)", STYLE_C + CAM30 + "Two game props side by side, in 2 columns of equal cells, the same object in each, at the same size and the same place in its cell, centered with clear empty space around it. No lines between cells. The object: a square stairway going UP to the next floor of the tower, seen from above at the game's angle, framed by " + z['gate'] + ". Left cell, CLOSED: " + z['lid'] + " seals it. Right cell, OPEN: the same frame with the lid gone, stone steps climbing up and " + z['glow'] + " pouring down from above." + TRANSP + " Keep the whole object inside the picture with some empty margin."),
    ]
    for f, size, what, txt in looks:
        n += 1
        out += [f"#### {n}. `{f}` ({size}): {what}", "```", txt, "```", ""]
open(OUT, "w").write("\n".join(out))
print(n)
