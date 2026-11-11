import sys
OUT = sys.argv[1]

STYLE = ("Cozy farming game art in a smooth, hand-painted cartoon style like FarmVille and Hay Day: bold rounded shapes, "
         "soft shading with gentle highlights, clean dark-brown outlines, bright warm colors, soft light from the top-left. "
         "No text, no letters, no watermark, no border, no drop shadow box. Drawn for a top-down three-quarter view game: the "
         "camera looks down at the creature from above at about 30 degrees, the SAME camera as the farmer in Image 1, so you "
         "see a little of the top of its back and head as well as its body. NOT a flat side view, NOT a flat front view. "
         "A sprite sheet arranged as a neat grid of 3 columns by 4 rows of equal cells, one pose per cell, each centered in its "
         "cell with clear empty space around it. The same creature in every cell: identical design, colors, size and "
         "proportions, standing (or hovering) on the same invisible ground line near the bottom of each cell, nothing touching "
         "the cell edges. No lines between cells. It is ANGRY and ready to fight: a furrowed brow, glaring narrowed eyes, a scowl, "
         "bared little teeth or fangs, claws or weapons up, a tense fighting stance. Fierce, but NOT too scary: no blood, no gore, "
         "no realistic horror, no creepy faces; still bold, clean cartoon game art that fits a cozy farming game. ")
END = (" No shadow on the ground (the game adds its own). Isolated on a fully transparent background (PNG with alpha). If "
       "transparency is not possible, use a flat solid pure magenta #FF00FF background with nothing else on it.")

def rows(move, fly):
    v = move
    if fly:
        return (f"Row 1: {v} toward the camera (facing down, front-and-top view). Row 2: {v} away from the camera (facing up, "
                f"back-and-top view). Row 3: {v} to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns "
                f"are three steps of its flying loop (wings or body up, level, down), hovering at the same height. ")
    return (f"Row 1: {v} toward the camera (facing down, front-and-top view). Row 2: {v} away from the camera (facing up, "
            f"back-and-top view). Row 3: {v} to the LEFT (three-quarter side view from above). In rows 1 to 3 the columns are: "
            f"standing still, mid-step one way, mid-step the other way. ")

BIG = "It is a BIG creature: it fills most of each cell (the others in this zone fill about half). "

# zone, file id, name, role, move word, flies?, look, row 4, big?
Z = []
def z(*a): Z.append(a)

N = "a normal enemy"; G = "the GUARD of every 10th floor"; M = "the MINI BOSS of every 50th floor"; B = "the BIG BOSS of the 100th floor"

# 1 Keeper's Stairs (floors 1-100): shore creatures, no trick yet
z(1, 'talangka', 'Talangka', N, 'scuttling', False,
  "a small round shore crab with a sandy-orange shell, two little claws held up like a boxer, tall stalk eyes glaring and a snarling mouth; quick and sideways",
  "Row 4, left to right: snapping both claws, facing the camera; scuttling sideways to the LEFT very fast; ducking into its shell with only its eyes showing, facing the camera")
z(1, 'kanaway', 'Kanaway', N, 'flying', True,
  "a chubby white-and-grey seagull with a yellow beak, a red spot on the beak, black wing tips and angry glaring eyes and an open squawking beak",
  "Row 4, left to right: diving down with wings folded, facing the camera; flapping in place and squawking with its beak open, facing LEFT; landing with wings spread wide, facing the camera")
z(1, 'igat', 'Igat', N, 'slithering', False,
  "a long sea eel with a glossy olive-green body, a cream belly, spiky fins along its back and a mouth of small sharp teeth bared in a hiss; it slithers over the wet stone stairs",
  "Row 4, left to right: rearing up to strike with its mouth open, facing the camera; lunging forward to the LEFT, body straight like a spring; coiled up in a resting loop, facing the camera")
z(1, 'alimango', 'Alimango Knight', G, 'stomping', False,
  "a big mud crab wearing its own dark blue-green shell like knight's armour, one huge claw like a shield and one like a hammer, a little rope-and-shell helmet; glaring and furious",
  "Row 4, left to right: raising the huge claw like a shield, facing the camera; slamming the hammer claw down, facing LEFT; charging to the LEFT with both claws forward")
z(1, 'ulang', 'Ulang', M, 'marching', False,
  "a big blue-and-orange lobster with long waving feelers, a barnacle-crusted back and two great pincers; it marches like an angry little general",
  "Row 4, left to right: both pincers snapping open toward the camera; a tail-flip leap backward, facing LEFT; spinning in a circle with pincers out, facing the camera")
z(1, 'tambanakua', 'Tambanakua', B, 'stomping', False,
  "the giant crab of the sea from Filipino legend, said to make the tides: a huge round mossy-green and coral-red shell with a little rock island, palm sprout and lighthouse-shaped barnacle on top, enormous claws, a furious old face with glowing angry eyes and a seaweed beard",
  "Row 4, left to right: both giant claws raised high, roaring, facing the camera; a tidal stomp with a splash of water rising round its feet, facing LEFT; slamming one giant claw down to the LEFT")

# 2 Coral Halls (101-200): trick = SHIELDED
z(2, 'siyokoy', 'Siyokoy', N, 'waddling', False,
  "a small Siyokoy, the fish-folk of Filipino sea legend: a round teal-scaled fish body on two webbed feet, fins for ears, big angry eyes under a scowl, a sharp coral spear",
  "Row 4, left to right: poking its coral spear forward, facing the camera; throwing the spear to the LEFT; puffing its cheeks and flapping its ear-fins, facing the camera")
z(2, 'siyokoy_kalasag', 'Siyokoy Shieldbearer', N, 'marching', False,
  "a Siyokoy fish-folk soldier holding a big round giant-clam shell as a SHIELD in front of it (the shield is clear to see: pearly white with wavy ridges), a seaweed sash; brave and serious",
  "Row 4, left to right: hiding fully behind the clam shield, facing the camera; the shield CRACKED in two pieces falling away, looking surprised, facing the camera; bashing forward with the shield to the LEFT")
z(2, 'dikya', 'Dikya', N, 'floating', True,
  "a little pink-and-lilac jellyfish with a round glowing bell, stinging trailing ribbons crackling with sparks and an angry frown; it floats a little above the floor",
  "Row 4, left to right: pulsing big with a soft glow, facing the camera; zapping a tiny spark from its ribbons, facing LEFT; squished flat for a moment, facing the camera")
z(2, 'siyokoy_sarhento', 'Siyokoy Sergeant', G, 'marching', False,
  "a bigger Siyokoy fish-folk with a coral helmet, a whistle of shell round its neck and a heavy clam SHIELD on one arm, a trident in the other",
  "Row 4, left to right: blowing the shell whistle, facing the camera; shield up and trident ready, facing LEFT; jabbing the trident forward to the LEFT")
z(2, 'pating', 'Pating na Bakal', M, 'swimming', False,
  "a chunky cartoon reef shark that walks on its fins over the wet floor, wearing armour plates of riveted copper over its back (a SHIELDED one), a toothy snarl",
  "Row 4, left to right: snapping its jaws, facing the camera; a fast lunge to the LEFT; its copper armour plates popping off in a puff, snarling, facing the camera")
z(2, 'siyokoy_kapitan', 'Siyokoy Captain', B, 'striding', False,
  "the captain of the Siyokoy fish-folk: a big broad-shouldered teal-and-gold fishman with a captain's coral tricorn hat, a long fin cape, a giant clam-shell SHIELD covered in pearls and a great trident; commanding and furious",
  "Row 4, left to right: raising the trident and calling the troops, facing the camera; spinning the giant shield to make a ring of bubbles, facing LEFT; a trident charge to the LEFT")

# 3 Shipwreck Deck (201-300): trick = BURSTING (leaves a slowing puddle)
z(3, 'butete', 'Butete', N, 'bobbing', True,
  "a small spotted yellow pufferfish that floats and bobs, with tiny fins and a pouty face; when it bursts it pops into a splash of sticky blue water",
  "Row 4, left to right: puffed up round and spiky, facing the camera; BURSTING in a splash of blue water, facing the camera; drifting deflated and dizzy, facing LEFT")
z(3, 'talaba', 'Talaba Beast', N, 'shuffling', False,
  "a lumpy barnacle-and-oyster creature like a walking rock with oyster shells for a mouth, tiny legs and green sea moss on top; it leaves slime",
  "Row 4, left to right: oyster mouth snapping open, facing the camera; BURSTING into a puddle of grey-green slime and shells, facing the camera; ramming forward to the LEFT")
z(3, 'parol_multo', 'Ghost Lantern', N, 'floating', True,
  "a little floating old ship's lantern with an angry blue flame inside and two glaring eyes in the glass, a short wispy tail",
  "Row 4, left to right: flaring bright, facing the camera; BURSTING into a puff of blue sparks and a glowing puddle, facing the camera; swooping to the LEFT")
z(3, 'angkla_crab', 'Anchor Crab', G, 'clanking', False,
  "a big rusty-red crab carrying a ship's iron anchor on its back like a hammer, chains looped round its claws, a sailor's cap",
  "Row 4, left to right: swinging the anchor overhead, facing the camera; slamming the anchor down with a crack and a splash, facing LEFT; dragging the chain to the LEFT")
z(3, 'dambuhalang_butete', 'Giant Butete', M, 'bobbing', True,
  "a huge round spotted pufferfish as big as a barrel, wearing a broken ship's porthole like a monocle, puffed up and furious",
  "Row 4, left to right: puffed to its biggest with spikes out, facing the camera; spitting a jet of sticky water to the LEFT; BURSTING into a big blue splash, facing the camera")
z(3, 'pugita', 'Pugita', B, 'creeping', False,
  "the giant octopus of the shipwreck: a huge round purple-and-coral octopus with eight curling arms, one arm holding a ship's wheel, a captain's hat sliding on its head, big furious eyes",
  "Row 4, left to right: all arms raised, squirting a cloud of dark ink, facing the camera; slapping two arms down with a splash, facing LEFT; reaching out to the LEFT with a long curling arm")

# 4 Moonlit Lagoon (301-400): trick = SONG (slows your shooting)
z(4, 'sirena', 'Sirena', N, 'gliding', False,
  "a little Sirena, the mermaid of Filipino legend: a fierce scowling face, long wavy dark hair with shells, a silver-teal tail she glides on over the shallow water; musical notes float round her when she sings",
  "Row 4, left to right: SINGING with soft glowing music notes around her, facing the camera; flicking her tail to splash to the LEFT; pointing angrily, facing the camera")
z(4, 'dikya_buwan', 'Moon Jelly', N, 'floating', True,
  "a pale moon-white jellyfish with a crescent-moon glow inside its bell and silver ribbons",
  "Row 4, left to right: glowing like the full moon, facing the camera; drifting sleepily to the LEFT; zapping a silver spark, facing the camera")
z(4, 'palakang_buwan', 'Moon Frog', N, 'hopping', False,
  "a chubby blue-green frog with glowing silver spots, a tiny lily-pad hat and a big croaking throat bubble",
  "Row 4, left to right: croaking with a glowing throat bubble and music notes, facing the camera; a long leap to the LEFT; tongue flicking out, facing the camera")
z(4, 'sirena_koro', 'Sirena Chorus Leader', G, 'gliding', False,
  "a bigger Sirena with a conch-shell microphone, a pearl tiara and a glittering purple-blue tail, leading the lagoon's song",
  "Row 4, left to right: singing into the conch with rings of music notes, facing the camera; a high note that sends a wave of sparkles to the LEFT; glaring with arms crossed, facing the camera")
z(4, 'sirenang_bituin', 'Star Sirena', M, 'gliding', False,
  "a Sirena whose tail and hair shimmer with tiny stars, holding a starfish harp",
  "Row 4, left to right: playing the starfish harp with notes flying, facing the camera; a swirl of star notes to the LEFT; diving into the water with only her tail showing, facing the camera")
z(4, 'magindara', 'Magindara', B, 'gliding', False,
  "Magindara, the guardian of the sea from Bicol legend: a tall graceful sea maiden with a long flowing aqua-and-gold tail, a crown of coral and pearls, hair like rolling waves, a staff topped with a glowing moon pearl; powerful and furious, her eyes glowing",
  "Row 4, left to right: raising the moon pearl staff as a whirl of music and water rises, facing the camera; sending a wave of water and notes to the LEFT; singing with eyes closed and a glowing halo of notes, facing the camera")

# 5 Storm Gallery (401-500): trick = FLYING FLOCKS
z(5, 'langay', 'Langay-langayan', N, 'flying', True,
  "a small dark-blue swiftlet bird with a white chest and quick sharp wings; they come in flocks",
  "Row 4, left to right: a fast dive, facing the camera; a tight loop to the LEFT; three of them flying together in a little V, facing LEFT")
z(5, 'kabag', 'Storm Bat', N, 'flying', True,
  "a round fluffy grey bat with a little lightning-bolt tuft of fur and yellow eyes",
  "Row 4, left to right: hanging upside down asleep, facing the camera; a crackle of tiny lightning round it, facing LEFT; swooping to the LEFT")
z(5, 'ulap', 'Ulap', N, 'floating', True,
  "a little grumpy storm-cloud spirit, round and dark grey with rain dripping from its bottom and a tiny lightning bolt for a tuft",
  "Row 4, left to right: raining hard, facing the camera; zapping a small lightning bolt to the LEFT; puffing up angrily, facing the camera")
z(5, 'lawin_kidlat', 'Thunder Hawk', G, 'flying', True,
  "a big brown-and-gold hawk with sparks running along its wing edges and sharp proud eyes",
  "Row 4, left to right: screeching with wings wide, facing the camera; a lightning dive to the LEFT; perched, folding its wings, facing the camera")
z(5, 'bagyo', 'Bagyo', M, 'whirling', True,
  "a small typhoon spirit: a spinning swirl of wind and rain with two angry glowing eyes and a snarl, leaves and twigs whirling round it",
  "Row 4, left to right: spinning fast as a tall whirlwind, facing the camera; blasting a gust to the LEFT; roaring with a gust, facing the camera")
z(5, 'galura', 'Galura', B, 'flying', True,
  "Galura, the giant eagle of Kapampangan legend who carries the storm: an enormous golden-brown eagle with storm-grey wings tipped in white lightning, a crest like a crown, fierce furious eyes",
  "Row 4, left to right: wings spread to their widest with lightning crackling, facing the camera; a diving strike with talons forward to the LEFT; beating its wings to blow a storm gust, facing the camera")

# 6 Kataw Court (501-600): trick = HEALERS
z(6, 'kataw', 'Kataw Courtier', N, 'strutting', False,
  "a small Kataw, the sea nobles of Visayan legend: a fish-person with a regal frill, a tiny pearl crown and a fancy coral collar, glaring down its nose",
  "Row 4, left to right: pointing a fin in outrage, facing the camera; slapping a fin-glove to the LEFT; fanning itself with a shell fan, facing the camera")
z(6, 'kataw_manggagamot', 'Kataw Healer', N, 'strutting', False,
  "a Kataw healer in soft sea-green robes with a staff topped by a glowing green sea-glass orb; it HEALS its friends with a green glow",
  "Row 4, left to right: HEALING: raising the staff with a soft green glow and little green plus-sparkles around, facing the camera; the same green glow sent to the LEFT; glaring with the staff raised, facing the camera")
z(6, 'kabayo_dagat', 'Seahorse Knight', N, 'bouncing', False,
  "a tall seahorse that bounces on its curled tail, wearing a tiny shell helmet and holding a narwhal-horn lance",
  "Row 4, left to right: lance raised in salute, facing the camera; a bouncing lance charge to the LEFT; curling up on its tail to rest, facing the camera")
z(6, 'bantay_hari', 'Royal Guard', G, 'marching', False,
  "a big Kataw royal guard in gold-trimmed armour of scales, holding a tall halberd and a crest-shield with a pearl",
  "Row 4, left to right: standing to attention with the halberd, facing the camera; a halberd sweep to the LEFT; raising the shield with a green healing glow, facing the camera")
z(6, 'kataw_reyna', 'Kataw Queen', M, 'gliding', False,
  "the Kataw Queen: an elegant fish-woman with a tall coral crown, a long flowing fin gown in coral pink and pearl, a sceptre with a glowing green HEALING pearl",
  "Row 4, left to right: raising the sceptre to HEAL with a wide green glow, facing the camera; pointing the sceptre to the LEFT with a wave; snapping a shell fan shut angrily, facing the camera")
z(6, 'kataw_hari', 'Kataw King', B, 'striding', False,
  "the Kataw King: a big royal fish-man with a grand pearl-and-coral crown, a flowing royal cape of fins, a rich blue-and-gold body, a great trident and a stern furious face",
  "Row 4, left to right: raising the trident as a ring of green healing light rises round him, facing the camera; a royal trident strike to the LEFT; pointing the trident in fury, facing the camera")

# 7 Lantern Spire (601-700): trick = DARKNESS (you only see near your lantern)
z(7, 'santelmong_asul', 'Blue Santelmo', N, 'floating', True,
  "a little blue fire wisp (santelmo) with an angry face in its flame and a curling flame tail",
  "Row 4, left to right: flaring bright blue, facing the camera; zipping to the LEFT leaving a trail of sparks; flickering small, almost out, facing the camera")
z(7, 'alitaptap', 'Alitaptap', N, 'flying', True,
  "a round firefly with a bright yellow-green glowing tail, little wings and angry glowing eyes",
  "Row 4, left to right: glowing at its brightest, facing the camera; dimming to dark with only the eyes showing, facing the camera; darting to the LEFT")
z(7, 'anino', 'Anino', N, 'creeping', False,
  "Anino, a little shadow creature: a soft round blob of deep purple-black shadow with two glowing white eyes and wispy edges; only its eyes shine in the dark",
  "Row 4, left to right: rising up tall with arms spread, facing the camera; melting flat into a puddle of shadow, facing the camera; sliding fast to the LEFT")
z(7, 'lampara_golem', 'Lamp Golem', G, 'stomping', False,
  "a chunky golem built of old lighthouse lamp parts: brass plates, a glass lamp for a head with a warm flame inside, iron arms",
  "Row 4, left to right: its lamp head blazing bright, facing the camera; a heavy punch to the LEFT; its lamp going dark, facing the camera")
z(7, 'dambuhalang_anino', 'Great Anino', M, 'creeping', False,
  "a big shadow spirit like a tall cloak of darkness with many small glowing eyes and long wispy arms",
  "Row 4, left to right: spreading wide and swallowing the light, facing the camera; reaching out to the LEFT with a shadow arm; shrinking back from a light, facing the camera")
z(7, 'dakilang_santelmo', 'Great Santelmo', B, 'floating', True,
  "the Great Santelmo: a huge whirling spirit of white-blue fire shaped like a great lantern flame with a fierce ancient face, smaller wisps orbiting it",
  "Row 4, left to right: blazing up into a pillar of blue fire, facing the camera; throwing a ball of blue fire to the LEFT; flickering down to embers, facing the camera")

# 8 Cloud Bridge (701-800): trick = SPLITTERS (become two when beaten)
z(8, 'minokawa_sisiw', 'Minokawa Chick', N, 'flapping', True,
  "a fluffy round chick of the Minokawa, the giant moon-eating bird of Bagobo legend: silver-and-gold downy feathers, a tiny curved beak, oversized feet",
  "Row 4, left to right: peeping with wings out, facing the camera; pecking to the LEFT; tumbling over, facing the camera")
z(8, 'bulak', 'Bulak', N, 'bouncing', False,
  "a soft round cloud-puff creature like cotton with an angry little face; when it is beaten it SPLITS into two smaller puffs",
  "Row 4, left to right: SPLITTING into two smaller copies of itself, facing the camera; bouncing high, facing LEFT; squishing flat, facing the camera")
z(8, 'ulap_blob', 'Sky Drop', N, 'bouncing', False,
  "a wobbly sky-blue jelly drop with a cloud on its head; it SPLITS in two when hit hard",
  "Row 4, left to right: SPLITTING into two smaller drops, facing the camera; a bouncing tackle to the LEFT; wobbling, facing the camera")
z(8, 'minokawa_inakay', 'Minokawa Fledgling', G, 'flapping', True,
  "a big teenage Minokawa with half-grown silver-gold feathers, a hooked steel-grey beak and claws, still a little fluffy",
  "Row 4, left to right: screeching with wings wide, facing the camera; a swooping claw to the LEFT; pecking at the moon-shaped pearl it carries, facing the camera")
z(8, 'tigmamanukan', 'Tigmamanukan', M, 'flying', True,
  "the Tigmamanukan, the omen bird of Tagalog legend: a bright blue-green bird with a long tail of shimmering feathers and piercing angry golden eyes",
  "Row 4, left to right: spreading its tail like a fan, facing the camera; a dive to the LEFT; SPLITTING into two smaller blue birds, facing the camera")
z(8, 'minokawa', 'Minokawa', B, 'flying', True,
  "the Minokawa, the giant moon-eating bird of Bagobo legend: an enormous bird with mirror-bright silver feathers, steel claws, a long hooked beak and a full moon glowing in its open beak; huge and furious",
  "Row 4, left to right: opening its beak to swallow a glowing moon, facing the camera; beating mirror wings to send blades of light to the LEFT; perched with wings folded, facing the camera")

# 9 Starfall (801-900): trick = REVIVERS (stand up again unless finished quickly)
z(9, 'tala', 'Tala', N, 'floating', True,
  "Tala, a little star spirit: a five-pointed glowing golden star with a round face and tiny arms; when beaten it flickers and can light up again",
  "Row 4, left to right: shining bright, facing the camera; lying dim and flickering on the ground, facing the camera; REVIVING: lighting up again with a burst of sparkles, facing the camera")
z(9, 'bituing_alimasag', 'Star Crab', N, 'scuttling', False,
  "a small dark-blue crab whose shell is speckled with tiny glowing stars like the night sky",
  "Row 4, left to right: claws up, facing the camera; scuttling to the LEFT; REVIVING: standing back up from upside down with a twinkle, facing the camera")
z(9, 'gamugamo_buwan', 'Moon Moth', N, 'flying', True,
  "a fluffy silver moth with big pale wings patterned like moon phases",
  "Row 4, left to right: wings open showing the moon pattern, facing the camera; dusting glittering powder to the LEFT; REVIVING: rising from its wings folded, facing the camera")
z(9, 'bituing_golem', 'Star Golem', G, 'stomping', False,
  "a chunky golem made of dark night-sky stone with glowing golden stars set in its body and a crescent moon on its chest",
  "Row 4, left to right: stars on its body flaring, facing the camera; a ground pound to the LEFT; REVIVING: its stones pulling back together, facing the camera")
z(9, 'pagong_batong_buwan', 'Moonstone Tortoise', M, 'plodding', False,
  "a big slow tortoise with a shell of glowing moonstone and a tiny star garden growing on top",
  "Row 4, left to right: its shell glowing, facing the camera; pulling into its shell, facing LEFT; REVIVING: a burst of moonlight as it stands up again, facing the camera")
z(9, 'tagapag_ingat_bituin', 'Star Keeper', B, 'striding', False,
  "the Star Keeper: a tall stern cosmic guardian in a robe of deep night blue sprinkled with real stars, a hood with a crescent moon, a lantern holding a tiny galaxy; cold and furious, eyes glowing",
  "Row 4, left to right: raising the galaxy lantern as stars rain down, facing the camera; sending a shooting star to the LEFT; REVIVING a fallen star creature with a beam of light, facing the camera")

# 10 The Great Light (901-1000): everything at once
z(10, 'bakunawa_anak', 'Bakunawa Hatchling', N, 'slithering', False,
  "a little sea-dragon hatchling of the Bakunawa: a long round sea-blue serpent body with a pearl-white belly, small fin wings, a snarling little dragon face and a moon-shaped spot on its forehead",
  "Row 4, left to right: rearing up with its mouth open, facing the camera; a lunge to the LEFT; curled into a ball, facing the camera")
z(10, 'laho', 'Laho', N, 'floating', True,
  "Laho, the little eclipse spirit: a round dark disc with a bright golden ring of light around it (like an eclipse), two glowing eyes and wispy shadow tendrils",
  "Row 4, left to right: blazing ring of light, facing the camera; swallowing the light to go dark, facing the camera; sweeping to the LEFT")
z(10, 'parola_golem', 'Lighthouse Golem', N, 'stomping', False,
  "a small golem shaped like a walking lighthouse: red-and-white striped stone body, a glowing lamp head that turns, little stone arms",
  "Row 4, left to right: its lamp beam sweeping, facing the camera; a stone punch to the LEFT; its lamp dim, sitting down, facing the camera")
z(10, 'bakunawa_bata', 'Bakunawa Whelp', G, 'slithering', False,
  "a bigger young Bakunawa sea-dragon: deep blue scales, a pearly fin crest, small wings and a glowing moon mark",
  "Row 4, left to right: roaring with fins up, facing the camera; a tail whip to the LEFT; breathing a puff of sea mist, facing the camera")
z(10, 'dakilang_laho', 'Great Laho', M, 'floating', True,
  "a big eclipse serpent spirit coiled in a ring of shadow and golden light, with an angry glowing face",
  "Row 4, left to right: forming a full eclipse ring, facing the camera; striking to the LEFT with a shadow coil; uncoiling, facing the camera")
z(10, 'bakunawa_ng_look', 'Bakunawa of the Bay', B, 'slithering', False,
  "the Bakunawa of the Bay, the great sea dragon of Filipino legend that rises to swallow the moon: an enormous long sea-serpent dragon with deep ocean-blue scales, a pearl-white belly, flowing fin wings like waves, whiskers, a crown of coral and a full moon glowing in its mouth; the grand final boss, huge and furious",
  "Row 4, left to right: rising tall with the moon glowing in its open mouth, facing the camera; a huge wave of water and light sent to the LEFT; coiled round a lighthouse stone, glaring, facing the camera")

ZONES = {1: "Keeper's Stairs (floors 1-100)", 2: "Coral Halls (floors 101-200): SHIELDED enemies", 3: "Shipwreck Deck (floors 201-300): BURSTING enemies",
         4: "Moonlit Lagoon (floors 301-400): SINGING enemies", 5: "Storm Gallery (floors 401-500): FLYING FLOCKS", 6: "Kataw Court (floors 501-600): HEALERS",
         7: "Lantern Spire (floors 601-700): DARKNESS", 8: "Cloud Bridge (floors 701-800): SPLITTERS", 9: "Starfall (floors 801-900): REVIVERS",
         10: "The Great Light (floors 901-1000): everything at once"}

out = ["# The Lost Tower: the enemies (owner, 12 Nov 2026)", "",
       "Every 100 floors the enemies change: each zone has 3 normal enemies, a guard (every 10th floor), a mini boss (every 50th floor)",
       "and its big boss (the 100th floor). 60 pictures in 10 batches. Make **batch 1 first**: the Tower opens with zone 1, and the",
       "game uses drawn stand-ins for any picture not in yet. The ENEMIES look ANGRY and ready to fight, but not too scary (owner, 12 Nov 2026); the farmer and the villagers stay as they are.", "",
       "How: one prompt = one picture, each in a NEW chat. Attach `CAMERA-30deg-farmer.png` (in this folder) as Image 1 every time:",
       "it shows ONLY the camera (30 degrees, like your new characters); do not copy the farmer, only how high the camera is. Size 1024 x 1536 (tall). Save each with the file name shown and send",
       "them as zips like before; the names are all that matter.", ""]
n = 0
for zz in range(1, 11):
    out.append(f"## Batch {zz}: {ZONES[zz]}")
    out.append("")
    for row in [r for r in Z if r[0] == zz]:
        n += 1
        _, fid, name, role, move, fly, look, r4, = row
        big = BIG if role == B else ""
        text = STYLE + big + "The creature: " + name + ", " + look + ". " + rows(move, fly) + r4 + "." + END
        text = text.replace(". .", ".").replace("..", ".")
        out.append(f"### {n}. `tower/zone{zz}/wild_{fid}.png` (1024x1536): {name} ({role})")
        out.append("```")
        out.append(text)
        out.append("```")
        out.append("")
open(OUT, "w").write("\n".join(out))
print(n)
