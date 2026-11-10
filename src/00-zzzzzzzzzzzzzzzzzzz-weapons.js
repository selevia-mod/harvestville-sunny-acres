// The Rifle, the Javelin and the Boomerang (owner, 11 Nov 2026; docs/big-city-and-weapons.md): three new weapons for
// Manila's hunting grounds, each with six levels like the Bow (Basic, Copper, Silver, Gold, Magma, Moon). The owner set
// each level's reach and hit, the time between shots (the same at every level), the ammo (bullets 200G for 10, javelins
// 150G for 5, the boomerang none: it wears out), the boomerang's throws by level, and the Moon specials. The prices are
// still proposals (docs/manila-proposals.md section 4). Rules 01-logicZZZZZZZZZZZZZZ-weapons.js, the world and the
// panels 19zzzzzzzzzzzzzzzzzzzzzzzzzzz-weapons.js. Everything here is appended (items, counters): old saves load as before.
// Icons: drawn at load into the items texture (no new rows in the page's items picture), until their pack is in.
(function (F) {
  'use strict';
  var C = F.Config;

  // Where they work. Manila's grounds (its map keys, added there) always; the old hunting places (Pulag to Palawan, their
  // caves, the Lair) only with this on. The owner has NOT decided about the old places (11 Nov 2026): off until they do.
  C.WEAPONS_OLD_PLACES = false;
  C.WEAPON_GROUNDS = [];

  C.WEAPON_LEVELS = ['Basic', 'Copper', 'Silver', 'Gold', 'Magma', 'Moon'];
  C.WEAPON_KINDS = ['rifle', 'javelin', 'boomerang']; // (appended only: a weapon's place here is its slot in the save)

  // range: tiles, damage: hits, by level. gap: ms between shots (owner: Javelin 0.35 s, Rifle 1.4 s, Boomerang 1.0 s;
  // the Bow's is 0.43 s). still: ms you stand for the shot (the rest of the gap you can walk). moon: the Moon level's
  // special ('pierce': through the first animal into the one behind, like the Moon Bow; 'pair': it hits 2 side by side).
  // buy: what each level takes at the Armory (level 0 is buying it; a material the game does not have yet is not asked
  // for until it does: the Mixer's Rope, Farm Cement and Beeswax, the grounds' drops). lumber is the farm's lumber.
  C.WEAPONS = {
    rifle: {
      name: 'Rifle', verb: 'Shoot', ammo: 'bullets', moon: 'pierce',
      range: [4, 5, 6, 7, 8, 8], damage: [1, 2, 3, 3, 4, 4], gap: 1400, still: 640, // (still: the kick settles before he moves)
      buy: [
        { gold: 2500, needs: [['lumber', 10], ['iron', 5]] },
        { gold: 5000, needs: [['ore_copper', 8], ['farm_cement', 2], ['toro_hide', 4]] },
        { gold: 12000, needs: [['ore_silver', 8], ['farm_cement', 4], ['toro_horn', 4]] },
        { gold: 30000, needs: [['ore_gold', 8], ['farm_cement', 6], ['sarangay_jewel', 3]] },
        { gold: 60000, needs: [['ember_shard', 40], ['obsidian', 5], ['arimaonga_mane', 3]] },
        { gold: 600000, needs: [['arimaonga_mane', 6], ['bamboo_heart', 3], ['galura_feather', 3], ['bakunawa_scale', 5]] },
      ],
    },
    javelin: {
      name: 'Javelin', verb: 'Throw', ammo: 'javelins', moon: 'pair',
      range: [1, 2, 2, 3, 4, 5], damage: [1, 2, 3, 4, 4, 4], gap: 350, still: 350,
      buy: [
        { gold: 2000, needs: [['lumber', 12], ['rope', 2]] },
        { gold: 4000, needs: [['ore_copper', 8], ['rope', 3], ['warty_tusk', 4]] },
        { gold: 10000, needs: [['ore_silver', 8], ['rope', 5], ['maral_pelt', 4]] },
        { gold: 25000, needs: [['ore_gold', 8], ['rope', 6], ['tigmamanukan_feather', 3]] },
        { gold: 50000, needs: [['ember_shard', 40], ['obsidian', 5], ['bamboo_heart', 3]] },
        { gold: 600000, needs: [['bamboo_heart', 6], ['arimaonga_mane', 3], ['galura_feather', 3], ['bakunawa_scale', 5]] },
      ],
    },
    boomerang: {
      name: 'Boomerang', verb: 'Throw', ammo: null, moon: 'pair',
      range: [2, 3, 3, 4, 5, 6], damage: [1, 1, 2, 2, 3, 3], gap: 1000, still: 300,
      // throws before it breaks, by level (owner: "100, 200, 300, 400, 500, 600 so in one dungeon, they can only do 1
      // repair"); a warning at `warn` left; at 0 it breaks and is gone. Repaired to full at the Forge (or the Armory).
      throws: [100, 200, 300, 400, 500, 600], warn: 20,
      // (the owner's recipe is lumber + Rope + a little Gold; Rope comes from the Mixer, farm economy v2 part 3: it is
      // asked for as soon as the game has it, C.ITEMS.rope. Until then lumber + Gold, so a boomerang can always be fixed.)
      repair: [
        { gold: 100, needs: [['lumber', 2], ['rope', 1]] },
        { gold: 200, needs: [['lumber', 3], ['rope', 1]] },
        { gold: 400, needs: [['lumber', 4], ['rope', 2]] },
        { gold: 800, needs: [['lumber', 5], ['rope', 2]] },
        { gold: 1500, needs: [['lumber', 6], ['rope', 3]] },
        { gold: 3000, needs: [['lumber', 8], ['rope', 4]] },
      ],
      buy: [
        { gold: 1500, needs: [['lumber', 8], ['beeswax', 2]] },
        { gold: 3500, needs: [['ore_copper', 8], ['beeswax', 3], ['kalapati_feather', 6]] },
        { gold: 8000, needs: [['ore_silver', 8], ['beeswax', 4], ['banog_feather', 4]] },
        { gold: 20000, needs: [['ore_gold', 8], ['beeswax', 5], ['bato_crown', 3]] },
        { gold: 40000, needs: [['ember_shard', 40], ['obsidian', 5], ['galura_feather', 3]] },
        { gold: 600000, needs: [['galura_feather', 6], ['arimaonga_mane', 3], ['bamboo_heart', 3], ['bakunawa_scale', 5]] },
      ],
    },
  };
  C.WEAPON_ENERGY = 2; // a shot's energy, as the Bow's (C.WILD.shotEnergy); Manila may make it dearer in its grounds
  C.WEAPON_PAIR = 1.4; // tiles: how near the second animal must stand to the first for a Moon pair hit
  C.AMMO = { bullets: { pack: 10 }, javelins: { pack: 5 } }; // bought this many at a time (C.ITEMS[id].price a pack)

  // ---------- the items ----------
  // icon: a frame of the items texture painted at load (C.WPN_ICONS, 19zzzzzzzzzzzzzzzzzzzzzzzzzzz-weapons.js), past
  // every frame of the items picture, so nothing in the sheet moves.
  C.WPN_ICON_BASE = 2000;
  C.WPN_ICONS = [];
  C.WEAPON_KINDS.forEach(function (k) { for (var i = 0; i < 6; i++) C.WPN_ICONS.push(k + '_' + i); });
  C.WPN_ICONS.push('bullets', 'javelins', 'boomerang_broken');
  C.wpnIcon = function (name) { var i = C.WPN_ICONS.indexOf(name); return i < 0 ? -1 : C.WPN_ICON_BASE + i; };
  var ITEMS = {
    rifle: { name: 'Rifle', kind: 'tool', tool: 'rifle', painted: true, desc: 'Long reach and a hard hit, but slow to load. Needs bullets.' },
    javelin: { name: 'Javelin', kind: 'tool', tool: 'javelin', painted: true, desc: 'Hits hard and fast, up close. Needs javelins to throw.' },
    boomerang: { name: 'Boomerang', kind: 'tool', tool: 'boomerang', painted: true, desc: 'Flies out and comes back. No ammo, but it wears out: fix it at the Forge.' },
    bullets: { name: 'Bullets', kind: 'gear', price: 200, painted: true, desc: 'For the Rifle. Sold 10 at a time.' },
    javelins: { name: 'Javelins', kind: 'gear', price: 150, painted: true, desc: 'For the Javelin. Sold 5 at a time.' },
  };
  Object.keys(ITEMS).forEach(function (id) {
    ITEMS[id].icon = C.wpnIcon(id === 'bullets' || id === 'javelins' ? id : id + '_0');
    C.ITEMS[id] = ITEMS[id];
  });
})(window.Farm = window.Farm || {});
