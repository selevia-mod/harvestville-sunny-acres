// Unit tests for the Rifle, the Javelin and the Boomerang (owner, 11 Nov 2026; docs/big-city-and-weapons.md): the owner's
// reach and hit by level, the time between shots, ammo, the boomerang's wear and repair, the Moon specials, where they
// work, buying and upgrading, the save, and the shot's weapon riding in its range for friends.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { window: {}, console };
vm.createContext(ctx);
fs.readdirSync(path.join(__dirname, '..', 'src')).filter((f) => /^0[01]-/.test(f)).sort()
  .forEach((f) => vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8'), ctx));
const { Config: C, Logic: L } = ctx.window.Farm;
require('./clock')(ctx);
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const rich = () => { const s = L.newState(); s.gold = 1e7; s.lumber = 500; s.energy = 999; return s; };
const T = C.TILE;

test("the owner's reach and hit, by level (Basic, Copper, Silver, Gold, Magma, Moon), and the Bow's stay as they were", () => {
  const table = (k) => C.WEAPON_LEVELS.map((n, lv) => [L.weaponRange(k, lv), L.weaponHit(k, lv)]);
  assert.deepStrictEqual(plain(table('rifle')), [[4, 1], [5, 2], [6, 3], [7, 3], [8, 4], [8, 4]]);
  assert.deepStrictEqual(plain(table('javelin')), [[1, 1], [2, 2], [2, 3], [3, 4], [4, 4], [5, 4]]);
  assert.deepStrictEqual(plain(table('boomerang')), [[2, 1], [3, 1], [3, 2], [4, 2], [5, 3], [6, 3]]);
  assert.deepStrictEqual(plain(C.WILD.bow.range), [3, 4, 5, 6, 7, 7]);
  assert.deepStrictEqual(plain(C.WILD.bow.damage), [1, 1, 2, 2, 3, 3]);
  assert.deepStrictEqual(plain(C.WEAPON_LEVELS), ['Basic', 'Copper', 'Silver', 'Gold', 'Magma', 'Moon']);
  assert.strictEqual(L.weaponName('rifle', 0), 'Rifle');
  assert.strictEqual(L.weaponName('javelin', 4), 'Magma Javelin');
  assert.strictEqual(L.weaponName('boomerang', 5), 'Moon Boomerang');
});

test('time between shots: Javelin 0.35 s (faster than the Bow 0.43 s), Boomerang 1.0 s, Rifle 1.4 s; the same at every level', () => {
  assert.strictEqual(L.weaponGap('javelin'), 350);
  assert.strictEqual(L.weaponGap('boomerang'), 1000);
  assert.strictEqual(L.weaponGap('rifle'), 1400);
  assert.ok(L.weaponGap('javelin') < 430 && 430 < L.weaponGap('boomerang') && L.weaponGap('boomerang') < L.weaponGap('rifle'));
  C.WEAPON_KINDS.forEach((k) => assert.ok(C.WEAPONS[k].still <= C.WEAPONS[k].gap, k + ': you stand for no longer than the gap'));
});

test('the Moon specials: the Rifle goes through, the Javelin and Boomerang hit 2 side by side; only at the Moon level', () => {
  assert.strictEqual(L.weaponMoon('rifle', 5), 'pierce');
  assert.strictEqual(L.weaponMoon('javelin', 5), 'pair');
  assert.strictEqual(L.weaponMoon('boomerang', 5), 'pair');
  for (let lv = 0; lv < 5; lv++) C.WEAPON_KINDS.forEach((k) => assert.strictEqual(L.weaponMoon(k, lv), null, k + ' ' + lv));
});

test('buying and upgrading at the Armory: Basic to Moon, each level with its gold; a material not in the game yet is not asked for', () => {
  const s = rich();
  assert.strictEqual(L.hasWeapon(s, 'rifle'), false);
  const first = L.nextWeapon(s, 'rifle');
  assert.deepStrictEqual(plain(first), { level: 0, gold: 2500, needs: [['lumber', 10]] }, 'iron is not in the game: not asked for');
  assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok');
  assert.ok(L.hasWeapon(s, 'rifle') && L.weaponLevel(s, 'rifle') === 0);
  assert.strictEqual(s.gold, 1e7 - 2500);
  assert.strictEqual(s.lumber, 490);
  // Copper needs copper ore (Farm Cement and Toro Hide are not in the game yet)
  assert.deepStrictEqual(plain(L.nextWeapon(s, 'rifle').needs), [['ore_copper', 8]]);
  assert.strictEqual(L.getWeapon(s, 'rifle'), 'short');
  L.addItem(s, 'ore_copper', 8);
  assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok');
  assert.strictEqual(L.weaponLevel(s, 'rifle'), 1);
  assert.strictEqual(L.itemName(s, 'rifle'), 'Copper Rifle');
  assert.strictEqual(L.iconOf(s, 'rifle'), C.wpnIcon('rifle_1'));
  L.addItem(s, 'ore_silver', 8); assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok');
  L.addItem(s, 'ore_gold', 8); assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok');
  L.addItem(s, 'ember_shard', 40); L.addItem(s, 'obsidian', 5); assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok');
  assert.strictEqual(L.itemName(s, 'rifle'), 'Magma Rifle');
  assert.deepStrictEqual(plain(L.nextWeapon(s, 'rifle')), { level: 5, gold: 600000, needs: [['bakunawa_scale', 5]] }, "(the Lair's scales; Manila's boss parts later)");
  assert.strictEqual(L.getWeapon(s, 'rifle'), 'short');
  L.addItem(s, 'bakunawa_scale', 5);
  assert.strictEqual(L.getWeapon(s, 'rifle'), 'ok');
  assert.strictEqual(L.itemName(s, 'rifle'), 'Moon Rifle');
  assert.strictEqual(L.nextWeapon(s, 'rifle'), null);
  assert.strictEqual(L.getWeapon(s, 'rifle'), 'max');
  // gold first; a full bag
  const poor = L.newState();
  poor.gold = 100; poor.lumber = 100;
  assert.strictEqual(L.getWeapon(poor, 'javelin'), 'gold');
  // a material that comes later is asked for once the game has it
  C.ITEMS.rope = { name: 'Rope', kind: 'material', icon: 0 };
  try { assert.deepStrictEqual(plain(L.nextWeapon(L.newState(), 'javelin').needs), [['lumber', 12], ['rope', 2]]); } finally { delete C.ITEMS.rope; }
});

test('ammo: bullets 200G for 10, javelins 150G for 5, the boomerang none; a shot takes one and the energy', () => {
  const s = rich();
  L.getWeapon(s, 'rifle');
  L.getWeapon(s, 'javelin');
  const g = s.gold;
  assert.strictEqual(L.buyAmmo(s, 'bullets', 1), 'ok');
  assert.strictEqual(L.countItem(s, 'bullets'), 10);
  assert.strictEqual(s.gold, g - 200);
  assert.strictEqual(L.buyAmmo(s, 'javelins', 2), 'ok');
  assert.strictEqual(L.countItem(s, 'javelins'), 10);
  assert.strictEqual(s.gold, g - 200 - 300);
  const broke = L.newState();
  broke.gold = 199;
  assert.strictEqual(L.buyAmmo(broke, 'bullets', 1), 'gold');
  assert.strictEqual(C.WEAPONS.boomerang.ammo, null);
  // a shot
  const e = s.energy;
  assert.strictEqual(L.fireWeapon(s, 'rifle'), 'ok');
  assert.strictEqual(L.countItem(s, 'bullets'), 9);
  assert.strictEqual(s.energy, e - C.WILD.shotEnergy);
  assert.strictEqual(L.fireWeapon(s, 'javelin'), 'ok');
  assert.strictEqual(L.countItem(s, 'javelins'), 9);
  // out of ammo
  L.removeItem(s, 'bullets', 9);
  assert.strictEqual(L.fireWeapon(s, 'rifle'), 'ammo');
  assert.strictEqual(L.ammoLeft(s, 'rifle'), 0);
  // too tired
  s.energy = 1;
  assert.strictEqual(L.fireWeapon(s, 'javelin'), 'tired');
  assert.strictEqual(L.countItem(s, 'javelins'), 9, 'nothing taken');
  // not yours
  assert.strictEqual(L.fireWeapon(L.newState(), 'boomerang'), 'none');
});

test('the boomerang wears out: 100 to 600 throws by level, a warning at 20 left, it breaks at 0 and is gone', () => {
  const s = rich();
  assert.strictEqual(L.getWeapon(s, 'boomerang'), 'ok');
  assert.strictEqual(L.throwsLeft(s), 100);
  assert.deepStrictEqual(plain(C.WEAPONS.boomerang.throws), [100, 200, 300, 400, 500, 600]);
  const said = [];
  for (let i = 0; i < 79; i++) said.push(L.fireWeapon(s, 'boomerang'));
  assert.strictEqual(L.throwsLeft(s), 21);
  assert.strictEqual(L.throwsLow(s), false);
  assert.ok(said.every((r) => r === 'ok'));
  assert.strictEqual(L.fireWeapon(s, 'boomerang'), 'warn', 'the warning at 20 left');
  assert.strictEqual(L.throwsLeft(s), 20);
  assert.strictEqual(L.throwsLow(s), true);
  for (let i = 0; i < 19; i++) assert.strictEqual(L.fireWeapon(s, 'boomerang'), 'ok');
  assert.strictEqual(L.throwsLeft(s), 1);
  assert.strictEqual(L.fireWeapon(s, 'boomerang'), 'broke', 'the last throw');
  assert.strictEqual(L.hasWeapon(s, 'boomerang'), false, 'gone');
  assert.strictEqual(L.weaponLevel(s, 'boomerang'), 0);
  assert.strictEqual(L.fireWeapon(s, 'boomerang'), 'none');
  // a new one starts at Basic
  assert.strictEqual(L.nextWeapon(s, 'boomerang').level, 0);
  // an upgrade comes back like new, with its level's throws
  L.getWeapon(s, 'boomerang');
  L.addItem(s, 'ore_copper', 8);
  for (let i = 0; i < 30; i++) L.fireWeapon(s, 'boomerang');
  assert.strictEqual(L.getWeapon(s, 'boomerang'), 'ok');
  assert.strictEqual(L.throwsLeft(s), 200);
});

test('the boomerang is fixed at the Forge back to full: lumber and Gold (Rope too, once the Mixer makes it)', () => {
  const s = rich();
  L.getWeapon(s, 'boomerang');
  assert.strictEqual(L.repairCost(s), null, 'nothing to fix yet');
  assert.strictEqual(L.repairBoomerang(s), 'full');
  for (let i = 0; i < 90; i++) L.fireWeapon(s, 'boomerang');
  assert.deepStrictEqual(plain(L.repairCost(s)), { gold: 100, needs: [['lumber', 2]] });
  const g = s.gold, lu = s.lumber;
  assert.strictEqual(L.repairBoomerang(s), 'ok');
  assert.strictEqual(L.throwsLeft(s), 100);
  assert.strictEqual(s.gold, g - 100);
  assert.strictEqual(s.lumber, lu - 2);
  // short of lumber, or gold
  for (let i = 0; i < 5; i++) L.fireWeapon(s, 'boomerang');
  s.lumber = 1;
  assert.strictEqual(L.repairBoomerang(s), 'short');
  s.lumber = 10; s.gold = 50;
  assert.strictEqual(L.repairBoomerang(s), 'gold');
  assert.strictEqual(L.throwsLeft(s), 95, 'nothing fixed');
  // with the Mixer's Rope in the game, it is asked for
  C.ITEMS.rope = { name: 'Rope', kind: 'material', icon: 0 };
  try {
    s.gold = 1000;
    assert.deepStrictEqual(plain(L.repairCost(s).needs), [['lumber', 2], ['rope', 1]]);
    assert.strictEqual(L.repairBoomerang(s), 'short');
  } finally { delete C.ITEMS.rope; }
  // each level's price
  assert.deepStrictEqual(plain(C.WEAPONS.boomerang.repair.map((r) => r.gold)), [100, 200, 400, 800, 1500, 3000]);
  assert.strictEqual(L.repairBoomerang(L.newState()), 'none');
});

test('where they work: every hunting place, its cave and the Lair, and Manila\'s grounds (owner, 11 Nov 2026: "all area"); never the farm, town or home', () => {
  assert.strictEqual(C.WEAPONS_OLD_PLACES, true);
  Object.keys(C.WILD.areas).forEach((m) => assert.strictEqual(L.weaponsWork(m), true, m));
  ['pulag', 'makiling', 'magayon', 'lair', 'banaue', 'banaue_cave', 'palawan_cave'].forEach((m) => assert.strictEqual(L.weaponsWork(m), true, m));
  C.WEAPON_GROUNDS.push('manila_plains');
  try { assert.strictEqual(L.weaponsWork('manila_plains'), true); } finally { C.WEAPON_GROUNDS.pop(); }
  ['farm', 'town', 'house', 'mine'].forEach((m) => assert.strictEqual(L.weaponsWork(m), false, m));
});

test("a weapon's hit: the world says which shot, and the Bow's damage is as before otherwise", () => {
  const s = rich();
  s.tools.bow = 3;
  assert.strictEqual(L.bowDamage(s), 2);
  s.wpnHit = { k: 'javelin', lv: 3 };
  assert.strictEqual(L.bowDamage(s), 4);
  s.skHit = 1; // a Strong shot (Hunting 5+)
  assert.strictEqual(L.bowDamage(s), 5);
  s.wpnHit = null; s.skHit = 0;
  assert.strictEqual(L.bowDamage(s), 2);
});

test("friends see which weapon: it rides in the shot's range (the game server's 'ar' passes only x, y, a, l, b)", () => {
  C.WEAPON_KINDS.forEach((k) => {
    for (let lv = 0; lv < 6; lv++) {
      const r = L.weaponRange(k, lv) * T, l = L.shotRange(r, k);
      assert.strictEqual(L.shotWeapon(l), k);
      assert.ok(l <= 8 * T && Math.abs(l - Math.min(r, 8 * T)) < 16, k + ' ' + lv + ': about its range');
    }
  });
  // a bow's shot (whole tiles), its longest one cut to 8 tiles, is no weapon's
  for (let tiles = 1; tiles <= 8; tiles++) assert.strictEqual(L.shotWeapon(tiles * T), null);
});

test('the save: levels and the throws left come back; an old save has none; nonsense is cut to size', () => {
  const s = rich();
  L.getWeapon(s, 'boomerang');
  L.getWeapon(s, 'javelin');
  L.addItem(s, 'ore_copper', 8);
  L.getWeapon(s, 'javelin');
  for (let i = 0; i < 7; i++) L.fireWeapon(s, 'boomerang');
  const o = plain(L.serialize(s));
  assert.deepStrictEqual(o.wp, [0, 1, 0, 93]);
  const b = L.deserialize(o);
  assert.strictEqual(L.weaponLevel(b, 'javelin'), 1);
  assert.strictEqual(L.throwsLeft(b), 93);
  assert.strictEqual(L.hasWeapon(b, 'boomerang'), true);
  // an old save
  const old = plain(L.serialize(L.newState()));
  assert.strictEqual(old.wp, undefined, 'nothing saved for a farm without them');
  const a = L.deserialize(old);
  assert.deepStrictEqual(plain(a.wpn), { rifle: 0, javelin: 0, boomerang: 0, left: 0 });
  // nonsense
  o.wp = [99, -4, 'x', 1e9];
  const n = L.deserialize(o);
  assert.deepStrictEqual(plain(n.wpn), { rifle: 5, javelin: 0, boomerang: 0, left: 100 });
  // the items are what they are: tools you hold, ammo in stacks; their icons painted at load
  assert.strictEqual(C.ITEMS.rifle.kind, 'tool');
  assert.strictEqual(L.marketable('rifle'), false);
  ['rifle', 'javelin', 'boomerang', 'bullets', 'javelins'].forEach((id) => assert.ok(C.ITEMS[id].icon >= C.WPN_ICON_BASE, id));
  assert.ok(roundTrip(s));
});

test('the weapon drawn in the hands: sheet names, the directions a sheet has, and how many of the others\' a phone holds', () => {
  assert.strictEqual(L.holdKey('rifle', 'boy', ''), 'wpn_hold_rifle_boy');
  assert.strictEqual(L.holdKey('javelin', 'girl', 'fire'), 'wpn_hold_fire_javelin_girl');
  C.WPN_HOLD_ROWS.wpn_hold_test = ['front', 'left'];
  try {
    assert.deepStrictEqual(plain(['down', 'up', 'left', 'right'].map((d) => L.holdHas('wpn_hold_test', d))), [true, false, true, true], 'right is left mirrored');
    assert.strictEqual(L.holdHas('wpn_hold_none', 'left'), false);
  } finally { delete C.WPN_HOLD_ROWS.wpn_hold_test; }
  assert.deepStrictEqual(plain(C.WPN_HOLD), { others: 10, othersCheap: 4, letGo: 30000 });
  const held = {};
  assert.strictEqual(L.sheetPick(held, 'mine', ['mine'], 0, 1), 'mine', 'yours is always fine, and not counted');
  assert.strictEqual(L.sheetPick(held, 'a', ['mine'], 0, 2), 'a');
  assert.strictEqual(L.sheetPick(held, 'b', ['mine'], 10, 2), 'b');
  assert.strictEqual(L.sheetPick(held, 'c', ['mine'], 20, 2), null, 'past the cap: the old way');
  assert.strictEqual(L.sheetPick(held, 'a', ['mine'], 30, 2), 'a', 'one held is seen again');
  assert.strictEqual(L.sheetPick(held, null, [], 0, 2), null);
  assert.deepStrictEqual(plain(L.sheetStale(held, 30015, 30000)), ['b'], 'not seen for 30 s: let go');
  assert.deepStrictEqual(Object.keys(held), ['a']);
  assert.strictEqual(L.sheetPick(held, 'c', ['mine'], 40, 2), 'c', 'room again');
});
