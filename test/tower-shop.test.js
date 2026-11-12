// Unit tests for The Lost Tower's Keeper's shop, the Keeper's gear, horse gear looks, the big bosses' Tower Blessings and
// the Tide set (src/00-zzzzzzzzzzzzzzzzzzzzzzz-tower-shop.js, src/01-logicZZZZZZZZZZZZZZZZZZZ-tower-shop.js).
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
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const TW = C.TOWER;
const K = C.KEEPER;
const fresh = () => { clock.set(2026, 11, 12, 10, 0); const s = L.newState(); s.seed = 11; return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const tower = (s) => { s.map = 'tower'; return s; };
const enemy = TW.zones[0].normal[0];

test("the Keeper's shop: the owner's prices, in Pearls", () => {
  assert.deepStrictEqual(plain(K.gear.map((g) => [g.id, g.slot, g.price])), [['hat', 'head', 300], ['boots', 'feet', 300], ['coat', 'body', 500], ['lantern', 'charm', 800]]);
  assert.deepStrictEqual(plain(K.horse.map((h) => [h.id, h.price])), [['saddle', 400], ['bridle', 500], ['lantern', 600]]);
  assert.ok(/coming soon/.test(K.weapon));
  C.TOWER_ICONS.forEach((n, i) => assert.strictEqual(C.towerIcon(n), C.TOWER_ICON_BASE + i));
  assert.ok(C.TOWER_ICON_BASE >= C.WPN_ICON_BASE + C.WPN_ICONS.length, 'the icons do not take the weapons\' frames');
});

test('buying: too few Pearls is refused and takes nothing; enough takes the price once, and the piece goes on', () => {
  const s = fresh();
  s.pearls = 299;
  s.gold = 1e6;
  assert.strictEqual(L.keeperBuy(s, 'hat'), 'pearls');
  assert.strictEqual(s.pearls, 299);
  assert.strictEqual(s.gold, 1e6, 'never Gold');
  assert.ok(!L.keeperOwns(s, 'hat'));
  s.pearls = 2000;
  assert.strictEqual(L.keeperBuy(s, 'hat'), 'ok');
  assert.strictEqual(s.pearls, 1700);
  assert.strictEqual(L.keeperBuy(s, 'hat'), 'owned');
  assert.strictEqual(s.pearls, 1700, 'not twice');
  assert.strictEqual(L.worn(s, 'head'), 'k:hat', 'on at once');
  assert.strictEqual(L.keeperBuy(s, 'sword'), 'none');
  assert.strictEqual(L.horseLookBuy(s, 'saddle'), 'ok');
  assert.strictEqual(s.pearls, 1300);
  assert.ok(L.horseLookOn(s, 'saddle'));
  s.pearls = 100;
  assert.strictEqual(L.horseLookBuy(s, 'bridle'), 'pearls');
  assert.strictEqual(s.pearls, 100);
  assert.ok(!L.horseLookOwns(s, 'bridle'));
  assert.strictEqual(L.horseLookWear(s, 'bridle', true), 'none', 'not yours');
  assert.strictEqual(L.horseLookWear(s, 'saddle', false), 'ok');
  assert.deepStrictEqual(plain(L.horseLooks(s)), []);
});

test("the Keeper's gear is gear: its slot, the Gear page's pieces, wear and take off", () => {
  const s = fresh();
  s.pearls = 5000;
  ['hat', 'boots', 'coat', 'lantern'].forEach((id) => assert.strictEqual(L.keeperBuy(s, id), 'ok'));
  C.GEAR_SLOTS.forEach((slot) => {
    const id = L.worn(s, slot), g = L.gearPiece(id);
    assert.ok(/^k:/.test(id), slot);
    assert.strictEqual(g.slot, slot);
    assert.ok(g.desc && /^Tower hits cost \d+% less energy/.test(g.desc));
    assert.ok(L.piecesFor(s, slot).includes(id));
  });
  L.takeOff(s, 'head');
  assert.strictEqual(L.worn(s, 'head'), '');
  assert.strictEqual(L.wear(s, 'k:hat'), 'ok');
  assert.strictEqual(L.wear(fresh(), 'k:hat'), 'none', 'not yours');
  assert.strictEqual(L.gearLess(s, null), 0, 'nothing off outside the Tower');
  assert.strictEqual(L.wornSet(s), null, 'not a place set');
});

test("the gear's numbers: 10, 10, 20, 20%, the set 60%, only in the Tower", () => {
  const s = tower(fresh());
  s.pearls = 5000;
  const hit = 20;
  assert.strictEqual(L.chargeLoss(s, hit, enemy), 20, 'nothing on');
  const steps = [['hat', 0.1, 18], ['boots', 0.2, 16], ['coat', 0.4, 12], ['lantern', 0.6, 8]];
  steps.forEach(([id, less, lost]) => {
    L.keeperBuy(s, id);
    assert.strictEqual(L.keeperLess(s), less, id);
    assert.strictEqual(L.chargeLoss(s, hit, enemy), lost, id);
  });
  assert.strictEqual(L.chargeLoss(s, 1, enemy), 1, 'a hit still costs 1 at least');
  assert.strictEqual(L.keeperSpeed(s), 1.1, 'the Boots: +10% walking');
  // outside the Tower: a wild boar is as before
  const t = fresh();
  t.pearls = 5000;
  const before = L.chargeLoss(t, 10, 'boar');
  ['hat', 'boots', 'coat', 'lantern'].forEach((id) => L.keeperBuy(t, id));
  assert.strictEqual(L.chargeLoss(t, 10, 'boar'), before, 'the Keeper\'s gear does nothing outside the Tower');
  // one piece alone: the coat
  const u = tower(fresh());
  u.pearls = 500;
  L.keeperBuy(u, 'coat');
  assert.strictEqual(L.chargeLoss(u, 10, enemy), 8);
});

test("the Lantern: 2 more tiles of sight on the Darkness floors", () => {
  const s = fresh(), TR = ctx.window.Farm.towerTricks;
  assert.strictEqual(L.towerSight(s), TR.dark.sight);
  s.pearls = 800;
  L.keeperBuy(s, 'lantern');
  assert.strictEqual(TR.dark.lantern, 2);
  assert.strictEqual(L.towerSight(s), TR.dark.sight + 2);
  L.takeOff(s, 'charm');
  assert.strictEqual(L.towerSight(s), TR.dark.sight, 'only worn');
});

test('the big bosses: a Blessing and a Tide piece each, paid once; all ten: +25% damage in the Tower and +50 energy', () => {
  const s = fresh();
  const max = L.maxEnergy(s);
  assert.strictEqual(L.towerBossNo(100), 1);
  assert.strictEqual(L.towerBossNo(1000), 10);
  assert.strictEqual(L.towerBossNo(150), 0);
  assert.strictEqual(L.towerBossWin(s, 99), null, 'not a boss');
  const w = L.towerBossWin(s, 100);
  assert.deepStrictEqual(plain(w), { n: 1, floor: 100, bless: { damage: 0.05 }, tide: TW.tide[0] });
  assert.strictEqual(L.towerBossWin(s, 100), null, 'once');
  assert.strictEqual(L.towerDamage(s), 1.05);
  assert.strictEqual(L.maxEnergy(s), max);
  L.towerBossWin(s, 200);
  assert.strictEqual(L.maxEnergy(s), max + 10, 'boss 200: +10 energy, everywhere');
  for (let f = 300; f <= 1000; f += 100) L.towerBossWin(s, f);
  assert.ok(Math.abs(L.towerDamage(s) - 1.25) < 1e-9);
  assert.strictEqual(L.towerEnergy(s), 50);
  assert.strictEqual(L.maxEnergy(s), max + 50);
  assert.deepStrictEqual(plain(L.tidePieces(s)), plain(TW.tide));
  assert.strictEqual(TW.tide.length, 10);
  assert.strictEqual(new Set(TW.tide).size, 10);
});

test('a boss floor cleared pays its Pearls and its rewards once; damage counts only in the Tower', () => {
  const s = fresh();
  s.tower.cl = 99;
  L.towerWon = null;
  const n = L.towerPay(s, 100);
  assert.strictEqual(n, 100);
  assert.strictEqual(L.towerWon.n, 1);
  L.towerWon = null;
  assert.strictEqual(L.towerPay(s, 100), 0);
  assert.strictEqual(L.towerWon, null, 'not twice');
  const d = L.bowDamage(s);
  s.map = 'tower';
  assert.ok(Math.abs(L.bowDamage(s) - d * 1.05) < 1e-9, '+5% in the Tower');
});

test('the save keeps the gear, the looks, the bosses (and the extra energy), each in its own new key', () => {
  const s = fresh();
  ['kpr', 'hlk', 'twb'].forEach((k) => assert.strictEqual(L.serialize(s)[k], undefined, 'nothing written for a new farm: ' + k));
  s.pearls = 5000;
  L.keeperBuy(s, 'coat');
  L.keeperBuy(s, 'lantern');
  L.horseLookBuy(s, 'bridle');
  L.horseLookBuy(s, 'lantern');
  L.horseLookWear(s, 'lantern', false);
  L.towerBossWin(s, 200);
  L.towerBossWin(s, 400);
  s.energy = L.maxEnergy(s);
  const o = plain(L.serialize(s));
  assert.strictEqual(o.kpr, 12);
  assert.deepStrictEqual(o.hlk, [6, 2]);
  assert.strictEqual(o.twb, 10);
  const b = roundTrip(s);
  assert.strictEqual(b.pearls, 5000 - 500 - 800 - 500 - 600);
  assert.ok(L.keeperOwns(b, 'coat') && L.keeperOwns(b, 'lantern') && !L.keeperOwns(b, 'hat'));
  assert.strictEqual(L.worn(b, 'body'), 'k:coat', 'still worn');
  assert.strictEqual(L.worn(b, 'charm'), 'k:lantern');
  assert.ok(L.horseLookOn(b, 'bridle') && !L.horseLookOn(b, 'lantern') && L.horseLookOwns(b, 'lantern'));
  assert.ok(L.towerBeat(b, 2) && L.towerBeat(b, 4) && !L.towerBeat(b, 1));
  assert.strictEqual(b.energy, L.maxEnergy(b), 'the extra energy is kept');
  const bad = plain(L.serialize(s));
  bad.kpr = 999; bad.twb = -4; bad.hlk = ['x', 9];
  const c = L.deserialize(bad);
  assert.strictEqual(c.kpr, 15);
  assert.strictEqual(c.twb, 0);
  assert.deepStrictEqual(plain(c.hlk), { own: 0, on: 0 });
  assert.ok(JSON.stringify(L.serialize(b)).length < C.MAX_SAVE_BYTES);
});

test("the mini bosses' chest has a horse gear dye (and food); the guards still give energy food", () => {
  TW.zones.forEach((z) => {
    const drops = plain(C.WILD.animals[z.mini].drops).map((d) => d[0]);
    assert.ok(drops.includes('horse_dye'), z.name);
    assert.ok(drops.some((id) => C.ITEMS[id].kind === 'dish'), z.name + ': food');
    // (and crop potions, farm economy v2: always two Ginger Tonics and a Pineapple Juice)
    if (C.POTIONS) assert.deepStrictEqual(plain(C.WILD.animals[z.mini].drops).filter((d) => C.DRINKS.includes(d[0])).filter((d) => d[2] >= 1).map((d) => d[0]), ['ginger_tonic', 'pineapple_juice'], z.name + ': potions');
    assert.ok(C.WILD.animals[z.guard].drops.some((d) => C.ITEMS[d[0]].energy > 0), z.name + ': the guard\'s energy food');
  });
  assert.ok(!plain(C.WILD.animals[TW.zones[0].normal[0]].drops).some((d) => d[0] === 'horse_dye'), 'not on normal enemies');
  const dye = C.ITEMS.horse_dye;
  assert.ok(dye.painted && dye.icon === C.towerIcon('horse_dye'));
});

test("the farmer in the Keeper's gear: one piece, a pair, the set; three pieces: the two most visible; a Tailor Shop look wins", () => {
  const s = fresh();
  s.kpr = 15; // (all four owned)
  const wear = (...ids) => { ['head', 'feet', 'body', 'charm'].forEach((sl) => L.takeOff(s, sl)); ids.forEach((id) => L.wear(s, 'k:' + id)); };
  const best = () => plain(L.keeperSheets(s));
  wear();
  assert.deepStrictEqual(best(), [], 'nothing worn');
  assert.strictEqual(L.keeperSheet(s), '');
  // one piece: that piece
  [['boots', 'keeper_boots_boy'], ['lantern', 'keeper_lantern_boy'], ['hat', 'keeper_hat_boy'], ['coat', 'keeper_coat_boy']].forEach(([id, k]) => {
    wear(id);
    assert.deepStrictEqual(best(), [k], id);
  });
  // two: their pair (the more visible first), then the more visible piece; every pair, whichever order they went on
  const pairs = { coat_hat: ['coat', 'hat'], coat_boots: ['boots', 'coat'], coat_lantern: ['lantern', 'coat'], hat_boots: ['boots', 'hat'], hat_lantern: ['lantern', 'hat'], lantern_boots: ['boots', 'lantern'] };
  Object.keys(pairs).forEach((p) => {
    wear(...pairs[p]);
    assert.deepStrictEqual(best(), ['keeper_' + p + '_boy', 'keeper_' + p.split('_')[0] + '_boy'], p);
  });
  // three: the pair of the two most visible (the least visible dropped)
  wear('hat', 'lantern', 'boots');
  assert.deepStrictEqual(best(), ['keeper_hat_lantern_boy', 'keeper_hat_boy'], 'hat, lantern, boots: hat + lantern');
  wear('coat', 'lantern', 'boots');
  assert.deepStrictEqual(best(), ['keeper_coat_lantern_boy', 'keeper_coat_boy'], 'coat, lantern, boots: coat + lantern');
  wear('boots', 'hat', 'coat');
  assert.deepStrictEqual(best(), ['keeper_coat_hat_boy', 'keeper_coat_boy']);
  // four: the set, then the best pair, then the best piece
  wear('boots', 'lantern', 'hat', 'coat');
  assert.deepStrictEqual(best(), ['keeper_set_boy', 'keeper_coat_hat_boy', 'keeper_coat_boy']);
  // a sheet not in: the next best, step by step
  const only = (...keys) => (k) => keys.includes(k);
  assert.strictEqual(L.keeperSheet(s), 'keeper_set_boy', 'all in');
  assert.strictEqual(L.keeperSheet(s, only('keeper_coat_hat_boy', 'keeper_coat_boy')), 'keeper_coat_hat_boy', 'no set: the best pair');
  assert.strictEqual(L.keeperSheet(s, only('keeper_coat_boy', 'keeper_hat_boy')), 'keeper_coat_boy', 'no set, no pair: the best piece');
  assert.strictEqual(L.keeperSheet(s, only()), '', 'none: the farmer\'s own');
  wear('hat', 'lantern');
  assert.strictEqual(L.keeperSheet(s, only('keeper_hat_boy', 'keeper_lantern_boy')), 'keeper_hat_boy', 'no pair: its more visible piece');
  // the girl's own
  s.look = 'girl';
  wear('coat', 'hat', 'lantern', 'boots');
  assert.deepStrictEqual(best(), ['keeper_set_girl', 'keeper_coat_hat_girl', 'keeper_coat_girl']);
  // a Tailor Shop look worn at the same time wins
  const look = C.LOOKS.find((l) => l.free) || C.LOOKS[0];
  s.lk = 1 << C.LOOK_INDEX[look.key];
  s.cw = look.key;
  assert.strictEqual(L.wornLook(s), look.key);
  assert.deepStrictEqual(best(), [], 'the costume wins');
  s.cw = '';
  assert.strictEqual(L.keeperSheet(s), 'keeper_set_girl');
  // every sheet it can name is one the tower pack can hold: 4 pieces, 6 pairs, the set, boy and girl (22)
  const keys = require('../tools/tower/tower-art').all().filter((k) => /^keeper_/.test(k));
  assert.strictEqual(keys.length, 22);
  plain(K.wornArt).forEach((a) => ['boy', 'girl'].forEach((w) => assert.ok(keys.includes(a + '_' + w), a + '_' + w)));
  assert.deepStrictEqual(plain(K.wornOrder).sort(), plain(K.gear.map((g) => g.id)).sort(), 'each piece has its place in the order');
  // each pair: the more visible piece first
  K.pairs.forEach((p) => assert.ok(K.wornOrder.indexOf(p[0]) < K.wornOrder.indexOf(p[1]), p.join('_')));
});

test("the horse's looks, one at a time: the saddle, then the lantern, then the bridle; none worn, none", () => {
  const s = fresh();
  s.pearls = 5000;
  assert.strictEqual(L.horseLookSheet(s), '');
  L.horseLookBuy(s, 'bridle');
  assert.strictEqual(L.horseLookSheet(s), 'horse_look_bridle');
  L.horseLookBuy(s, 'lantern');
  assert.strictEqual(L.horseLookSheet(s), 'horse_look_lantern', 'the lantern beats the bridle');
  L.horseLookBuy(s, 'saddle');
  assert.strictEqual(L.horseLookSheet(s), 'horse_look_saddle', 'the saddle beats both');
  L.horseLookWear(s, 'saddle', false);
  assert.strictEqual(L.horseLookSheet(s), 'horse_look_lantern', 'taken off: the next one');
  L.horseLookWear(s, 'lantern', false);
  L.horseLookWear(s, 'bridle', false);
  assert.strictEqual(L.horseLookSheet(s), '', 'owned, none worn');
  const keys = require('../tools/tower/tower-art').all();
  K.horse.forEach((h) => assert.ok(keys.includes(h.art), h.art + ' is in the tower pack'));
});

test("the owner's icon picture's cells to the game's icons: cells 1-9 are the first nine, cell 10 the pearl, the '?' none", () => {
  const { iconFrom, SRC_ICONS } = require('../tools/tower/shop-import');
  assert.deepStrictEqual(plain(C.TOWER_ICONS), ['k_hat', 'k_boots', 'k_coat', 'k_lantern', 'h_saddle', 'h_bridle', 'h_lantern', 'horse_dye', 'tide', 'weapon_soon', 'pearl']);
  assert.deepStrictEqual(plain(iconFrom(C.TOWER_ICONS)), [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10]);
  assert.strictEqual(SRC_ICONS.length, 10, "ten icons in the owner's picture");
});
