# The Lost Tower's food (owner, 13 Nov 2026: approved)

## Why
A Tower floor costs energy, and deep floors cost several full bars (floor 300: about 150 shots at the best Bow = 300
energy; floor 1000: about 840 shots = 1,680). The owner: floor 1 is "too easy, the problem is the energy only, so they
need more tonic or adobo, which is good to farm more". The Tower should feed the kitchen, and the kitchen the Tower.
Today only the guard (Tinola), the mini boss (Mang Ilaw's chest) and the big boss (Kaldereta) drop anything; the 30
normal enemies drop nothing.

## 1. Every zone drops its own ingredient
- Each zone's 3 normal enemies drop that zone's ingredient: 1 in 4 per enemy beaten (yours). The guard always drops 2.
  The mini boss and big boss keep their drops.
- Cleared floors keep dropping (they pay no Pearls a second time, but the drops are why you go back).
- The ingredients **cannot be sold** (no new Gold: the owner wants Gold spent, not made). They only cook.
- In a shared floor (friends), each player's own kills drop for them, as hunting does now.

| Zone | Ingredient (id) | Dish (id) | Needs | Energy | Power in the Tower, 15 min |
|---|---|---|---|---|---|
| 1 Tide Stairs | Talangka Meat (`tw_talangka_meat`) | Sinigang na Talangka (`sinigang_talangka`) | talangka meat + tomato + radish | 70 | your Bow and Javelin crack shields too: 3 hits break one (the Rifle still 1) |
| 2 Pugita's Deep | Pusit (`tw_pusit`) | Adobong Pusit (`adobong_pusit`) | pusit + garlic + rice | 75 | a puddle slows you half as much |
| 3 Berberoka's Swamp | Kuhol (`tw_kuhol`) | Ginataang Kuhol (`ginataang_kuhol`) | kuhol + spinach + chili | 75 | a song slows your shooting half as much |
| 4 Magindara's Lagoon | Frog Legs (`tw_frog_legs`) | Pritong Palaka (`pritong_palaka`) | frog legs + garlic + egg | 80 | each shot also hits the enemy right behind its target (half damage) |
| 5 Storm Gallery | Swallow's Nest (`tw_swallow_nest`) | Nido Soup (`nido_soup`) | swallow's nest + egg + ginger | 80 | an enemy you hit is not healed for 5 s |
| 6 Kataw Court | Talaba (`tw_talaba`) | Inihaw na Talaba (`inihaw_talaba`) | talaba + garlic + onion | 85 | you see 2 tiles further in the dark |
| 7 Lantern Spire | Santelmo Pepper (`tw_santelmo_pepper`) | Bicol Express (`bicol_express`) | santelmo pepper + meat + onion | 90 | a split copy has half its hits |
| 8 Biringan | Golden Mangosteen (`tw_mangosteen`) | Halo-halo ng Biringan (`halo_halo_biringan`) | golden mangosteen + milk + sugarcane | 90 | a beaten enemy stands up 2x slower |
| 9 Mayari's Starfall | Star Crab Meat (`tw_star_crab`) | Sopas ng Tala (`sopas_tala`) | star crab meat + milk + carrot | 100 | charges cost half, and energy refills 3x faster |
| 10 Seventh Moon | Bakunawa Egg (`tw_bakunawa_egg`) | Balut ng Bakunawa (`balut_bakunawa`) | bakunawa egg + chili + garlic | 120 | each enemy you beat gives back 2 energy |

**Each zone's dish softens the NEXT zone's trick by half** (it never cancels it). Farming zone N prepares you for N+1.
Zone 1 has no trick, so zone 1's dish works on zone 2's shields; zone 10's is the endgame energy dish.

## 2. Two more
- **Lugaw ng Parola** (`lugaw_parola`): rice + ginger + egg, farm only (new players can make it). 60 energy; in the
  Tower, energy refills 3x faster for 15 min.
- **The Baon** (`baon`): a lunchbox, bought from Mang Ilaw for Gold (a Gold sink; 5,000G). Pack up to 3 dishes (any food);
  inside the Tower, when your energy falls under 15, it eats the next one by itself (a toast says so). Packing and
  unpacking from the bag.

## 3. Rules
- **One Tower dish at a time**: a new one replaces the one going (the farm dishes' powers, 10 min, as they are; the
  potions separate, as they are). A Tower dish's power works only inside the Tower.
- **Hunter's Coffee** (Farm Economy v2, not shipped yet): free shots for **5 minutes** (was 10), everywhere. Drinking
  another resets the 5 minutes (does not add). Ampalaya Brew and Pineapple Juice stay at 10.
- The potion chip shows each power's minutes left (it does for potions now; Tower dishes join it).

## 4. Art (prompts written for the owner; drawn stand-ins until then)
Two icon sheets in the items' 30-degree style: the 10 ingredients; the 12 dishes (10 + Lugaw + Baon).

## Tests
Unit: each ingredient drops only in its zone (1 in 4; guard 2), never sellable; each dish cooks from its recipe;
one Tower dish at a time; each power halves (never cancels) its trick; powers only inside the Tower; coffee 5 min and
reset; the Baon eats under 15 only in the Tower. Browser: a Tower floor drops an ingredient, a dish cooked in the
Kitchen and eaten, its chip, its power on the next zone's trick; the Baon eating by itself.
