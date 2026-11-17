# Manila Friends (owner, 18 Nov 2026)

Owner: "Also add some friends that users will need to increase heart, specially in Manila so theres something to do in
Manila." Then: "Yes build the manila friends design as written". Ships only after the 2.7.0 store build is approved.

## The 10 friends
| Key (save) | Name | Where | Art |
|---|---|---|---|
| mn_rosa | Aling Rosa | Grand Market | npc_aling_rosa (in the pack) |
| mn_danny | Mang Danny | Trading Post | npc_mang_danny |
| mn_lando | Panday Lando | Armory | npc_panday_lando |
| mn_kardo | Mang Kardo | Stables | npc_mang_kardo |
| mn_marisol | Kapitana Marisol | Harbor | npc_kapitana_marisol |
| mn_tibo | Mang Tibo | Manila Central | npc_mang_tibo |
| mn_amparo | Lola Amparo | her house, walled quarter | npc_lola_amparo |
| mn_ramon | Father Ramon | Old Stone Church (NEW person: not in the city yet; place him at the church door by day, inside at night/Sunday mass) | art-src/manila/city/npc_priest.png (import into the 'manila' pack) |
| mn_bea | Bea | College (the students' leader, already walking as BEA) | npc_student_1 (her sheet in the group) |
| mn_nena | Aling Nena | Carinderia (already there as the cook) | npc_carinderia_cook |

Keys are namespaced `mn_` (the town has its own Rosa at the Sunny Inn; Sierra Madre has Ka Ramon). They live in the
same `s.friends` map as the town villagers (L.friend / L.friendHearts), so no new top-level save key is needed; check
that nothing assumes every key in s.friends is a town villager (C.VILLAGERS / C.VILLAGER_ORDER loops, marriage, the
town's heart events, birthdays calendar, the Friendship Book) and keep the town exactly as it is.

## How hearts grow (the town's rules, C.FRIEND)
- Talk once a day (+3). Each has a dialogue set like the town villagers (C.DIALOGUE shape): intro, rain, tiers by
  hearts (0-2, 3-5, 6-8, 9-10), gift reactions, birthday line. Manila voice: warm, a little Tagalog (po, anak, ate, kuya).
- A gift once a day: each has loves (+15), likes (+8), dislikes (-6), neutral (+3); birthdays double. Loves and likes
  mostly from the FARM (crops, cooked dishes, Mixer goods, fish) so the farm feeds Manila, plus Manila foods where they
  fit (Lola Amparo: hopia; Father Ramon: sampaguita if it is an item, else flowers; Bea: fishballs...).
- Birthdays: one each on the calendar (not on a town villager's birthday or a festival day).
- No marriage in Manila (owner's design: "No marriage").

## Stories: 4 steps each at 2, 4, 6, 8 hearts (the town's C.VS story system, its Friendship Book)
Each step: a short scene with a choice; some ask a favour (bring something, or lend a hand there for energy); a reward
from what the game has. The Friendship Book gets a **Manila** page (tab) for these 10. Lola Amparo's 4 steps tell the
old city's story (the walls, the galleons, the war, the city rising again), each step's reward a framed old-Manila
photo for the house (the existing { photo } reward).

## What each friendship unlocks (the reason to go to Manila)
| Friend | Unlock |
|---|---|
| Mang Tibo | The train half price at 6 hearts, free at 10 |
| Aling Rosa | A 4th Grand Market contract a day at 6 hearts; tomorrow's 3 hot crops shown on the board at 10 |
| Mang Kardo | His driver fee 10% -> 5% at 8 hearts |
| Panday Lando | 10% off bullets and javelins at 8 hearts (weapon prices themselves unchanged) |
| Kapitana Marisol | A fishing spot on the pier at 6 hearts, with the city's better fish (use the game's existing fish, its better ones) |
| Mang Danny | One rare trade a week at 8 hearts (a fair swap of something the player has for something hard to get; the Trading Post building itself stays "Coming soon") |
| Lola Amparo | A framed old-Manila photo for the house at each story step |
| Father Ramon | A blessing once a day at 6 hearts: +energy (gives, never takes) |
| Bea | Study together once a day at 6 hearts: bonus skill points (the game's skills system) |
| Aling Nena | A free carinderia meal once a day at 8 hearts |

## First-time tour
"Manila Friends": the first time a player talks to any of the 10: who they are, hearts, gifts, the Manila page. Uses
the owner's portraits (the npc_* pictures). Pop-ups centred.

## Rules
- Nothing already in the game changes for players (town villagers, their stories, marriage, prices).
- Same game on every phone; respect the frame budget (Father Ramon is one more person: cheap phones show only people near).
- Saves: no new top-level key (s.friends + its existing per-friend fields); old saves load unchanged; the save fuzz,
  old-saves and save-never-lose suites stay green; add Manila friend actions (talk, gift, story step) to the fuzz.
