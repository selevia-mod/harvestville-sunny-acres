# The Rifle, the Javelin and the Boomerang (plan, 11 Nov 2026)

Owner's numbers: docs/big-city-and-weapons.md (range/damage by level, shot times, ammo, Moon specials, boomerang wear).
Costs: docs/manila-proposals.md section 4 (proposals; the owner's words win). Branch feat/weapons (from feat/raid-badge).

## Files (all appended: nothing old moves)
1. `src/00-zzzzzzzzzzzzzzzzzzz-weapons.js` (content): `C.WEAPONS` (each weapon's range/damage by level, time between
   shots, ammo, Moon special, the boomerang's throws), the levels' prices (proposals), ammo packs, the items
   (rifle, javelin, boomerang, bullets, javelins), and the switches:
   - `C.WEAPONS_OLD_PLACES` (default **false**: the new weapons work only in Manila's grounds, `C.WEAPON_GROUNDS`,
     empty until Manila adds its maps; the owner has not decided about the old places; tests turn it on).
   - `window.gameHost.devWeapons` (tests/dev only): Kanor's Lodge shows a row that opens the Armory.
2. `src/01-logicZZZZZZZZZZZZZZ-weapons.js` (rules, unit tested): own/level/range/damage, buy and upgrade (a material
   the game does not have yet is not asked for), ammo, firing (ammo or a throw, energy), the boomerang's throws left,
   the warning at 20, breaking at 0, repair to full (lumber + Gold; Rope once the Mixer makes it), the Moon specials,
   where they work, the save (`o.wp`), the shot's code for friends.
3. `src/19zzzzzzzzzzzzzzzzzzzzzzzzzzz-weapons.js` (world + panels): Shoot/Throw on the action button, the aim ring at
   the weapon's reach, the farmer's shot (the archer poses as stand-ins), the shots in flight (bullet streak, javelin
   arc, boomerang out and back, spinning), Moon glow, hits through `wildStruck` (so the game server and friends count
   them as arrows' hits), the ammo / throws chip, the Armory panel (`F.ui.openArmory`, for Manila's Armory), the
   boomerang row at Bram's Forge, icons painted at runtime into the items texture (no page growth).
4. Friends: the shot goes out as the bow's `ar` message; the weapon rides in the low bits of `l` (its range), which
   the game server passes on unchanged, so no server deploy is needed to see the shots. Old app versions see an arrow.
5. Art: drawn stand-ins in code; `tools/art/weapons-import.js` cuts the owner's batch 6 (art-src/MANILA-PROMPTS.md)
   into pack pictures (`tools/packs.js` weapons pack), which the game uses when they are in.
6. Server (not deployed): `server/lib/rules.js` maxDamage from every weapon (a Gold+ Javelin's strong shot is 5).

## Tests
`test/weapons.test.js` (stats, shot times, ammo, durability/repair, Moon specials, save, the shot code) and
`test/e2e-weapons.test.js` (flag on, in Pulag: each weapon at an animal, out of ammo, a boomerang breaking and repaired).
