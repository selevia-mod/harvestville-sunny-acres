// Unit tests for farm economy v2, part 3 (docs/farm-economy-v2.md section 3; src/00-zzzzzzzzzzzzzzzzzzzzzz-economy2.js,
// src/01-logicZZZZZZZZZZZZZZZZZ-economy2.js): the Mixer (a workshop like the Bakery, one per farm), its four materials
// (the owner's table), materials on defense and Raid Camp levels (a level reached stays), sold at the Market, and the
// horse's Saddlebags (Rope: the bag +12).
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
const R = C.FRAID, O = C.OUTDOOR, H = C.HORSE_OUT;
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const withMixer = () => { const s = L.newState(); s.gold = 1e6; s.yard.items.push({ t: O.index.mixer, x: 30, y: 30 }); return s; };

test("the Mixer: the owner's table (Farm Cement, Rope, Sili Powder, Beeswax), 3 at a time, its own building, one per farm", () => {
  const w = C.WORKSHOPS.mixer;
  assert.strictEqual(w.slots, 3);
  assert.deepStrictEqual(plain(w.recipes), [
    { out: 'farm_cement', mins: 60, needs: [['corn', 3], ['wheat', 3], ['carrot', 3]] },
    { out: 'rope', mins: 45, needs: [['cotton', 3], ['sugarcane', 2]] },
    { out: 'sili_powder', mins: 45, needs: [['chili', 3], ['garlic', 2]] },
    { out: 'beeswax', mins: 60, needs: [['sunflower', 3], ['wild_honey', 1]] },
  ]);
  assert.strictEqual(C.WORKSHOP_KEYS[C.WORKSHOP_KEYS.length - 1], 'mixer', 'appended: the save keeps a workshop by its place');
  assert.deepStrictEqual(plain(C.WORKSHOP_KEYS.slice(0, 4)), ['bakery', 'dairy', 'jam_maker', 'tannery']);
  const t = O.index.mixer, type = O.types[t];
  assert.ok(type.cat === 'workshops' && type.one && type.w === 3 && type.h === 3 && type.price > 0 && type.prop === 'mixer');
  assert.deepStrictEqual(plain(L.yardSolid(t, 0, 0)), [[0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]], 'solid only where the picture stands');
  assert.strictEqual(O.types.length - 2, t, 'appended after every piece before (then the Silo)');
  const s = L.newState();
  s.gold = 1e5;
  assert.strictEqual(L.buyYard(s, t, 1), 'ok');
  assert.strictEqual(L.buyYard(s, t, 1), 'have', 'one per farm');
  // every material sells, and can go on a Market stall
  ['farm_cement', 'rope', 'sili_powder', 'beeswax'].forEach((id) => {
    const it = C.ITEMS[id];
    assert.ok(it.sell > 0 && it.icon === C.ICON_ORDER.indexOf(id) && L.marketable(id), id);
    assert.strictEqual(C.MADE_IN[id], 'mixer');
  });
});

test('making Farm Cement: its crops from the Silo first, ready in an hour, collected; the line saved and loaded', () => {
  const s = withMixer();
  assert.strictEqual(L.startJob(s, 'mixer', 0), 'missing');
  L.siloPut(s, 'corn', 3); L.siloPut(s, 'wheat', 1);
  L.addItem(s, 'wheat', 5); L.addItem(s, 'carrot', 3);
  assert.strictEqual(L.canMake(s, 'mixer', 0), true);
  assert.strictEqual(L.startJob(s, 'mixer', 0), 'ok');
  assert.deepStrictEqual([L.siloHas(s, 'corn'), L.siloHas(s, 'wheat'), L.countItem(s, 'wheat'), L.countItem(s, 'carrot')], [0, 0, 3, 0]);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.ws.mixer), plain(s.ws.mixer), 'the line is saved');
  clock.advance(59);
  assert.strictEqual(L.collectJobs(back, 'mixer'), '!none');
  clock.advance(1);
  assert.deepStrictEqual(plain(L.collectJobs(back, 'mixer')), ['farm_cement']);
  assert.strictEqual(L.countItem(back, 'farm_cement'), 1);
  // 3 in line at most
  const f = withMixer();
  L.siloPut(f, 'cotton', 12); L.siloPut(f, 'sugarcane', 8);
  for (let i = 0; i < 3; i++) assert.strictEqual(L.startJob(f, 'mixer', 1), 'ok');
  assert.strictEqual(L.startJob(f, 'mixer', 1), 'full');
  // not placed: not made
  const n = L.newState();
  L.siloPut(n, 'chili', 3); L.siloPut(n, 'garlic', 2);
  assert.strictEqual(L.startJob(n, 'mixer', 2), 'none');
});

test('defense levels need their material, rising with the level; a level already reached stays', () => {
  assert.deepStrictEqual(plain(R.defMats), { tower: 'farm_cement', mudpit: 'farm_cement', fence: 'farm_cement', sili: 'sili_powder', sprinkler: 'sili_powder', beebox: 'beeswax' });
  assert.deepStrictEqual(plain(R.defLevel.mats), [0, 2, 4, 7, 10]);
  const s = L.newState();
  s.gold = 1e6;
  assert.strictEqual(L.defenseUp(s, 'tower'), 'mats');
  assert.deepStrictEqual(plain(L.defenseMats(s, 'tower')), ['farm_cement', 2]);
  L.addItem(s, 'farm_cement', 6);
  assert.strictEqual(L.defenseUp(s, 'tower'), 'ok');
  assert.strictEqual(L.countItem(s, 'farm_cement'), 4);
  assert.strictEqual(L.defenseUp(s, 'tower'), 'ok', 'level 3: 4 more');
  assert.strictEqual(L.countItem(s, 'farm_cement'), 0);
  assert.strictEqual(L.defenseUp(s, 'tower'), 'mats');
  assert.deepStrictEqual(plain(L.defenseMats(s, 'beebox')), ['beeswax', 2]);
  assert.deepStrictEqual(plain(L.defenseMats(s, 'sprinkler')), ['sili_powder', 2]);
  // the dog, the goose, the scarecrow and the Kampana need only Gold, as before
  ['dog', 'goose', 'scarecrow', 'kampana'].forEach((k) => assert.strictEqual(L.defenseMats(s, k), null, k));
  assert.strictEqual(L.defenseUp(s, 'dog'), 'ok');
  // Gold first, as before
  const poor = L.newState();
  poor.gold = 0;
  assert.strictEqual(L.defenseUp(poor, 'tower'), 'gold');
  // an old save with a level 4 tower keeps it
  const old = L.newState();
  old.fr = { camp: 3, army: {}, lv: {}, dlv: { tower: 4, fence: 5 }, train: [], pts: 0, won: {} };
  const back = roundTrip(old);
  assert.deepStrictEqual([L.defenseLv(back, 'tower'), L.defenseLv(back, 'fence')], [4, 5]);
  assert.deepStrictEqual(plain(L.defenseMats(back, 'tower')), ['farm_cement', 10]);
  assert.strictEqual(L.defenseMats(back, 'fence'), null, 'top level');
});

test('Raid Camp levels need Farm Cement and Rope (rising); the camp level reached stays; the rest as before', () => {
  assert.deepStrictEqual(plain(R.camp.levels.map((l) => [l.cement || 0, l.rope || 0])), [[0, 0], [3, 1], [5, 2], [8, 4], [12, 6], [16, 8], [20, 10]]);
  const s = L.newState(), t0 = 5e9;
  s.gold = 1e6; s.lumber = 1000; s.stone = 1000;
  assert.strictEqual(L.campUpgrade(s, t0), 'ok', 'level 1: bought, no materials');
  assert.strictEqual(L.campUpgrade(s, t0), 'cement');
  L.addItem(s, 'farm_cement', 3);
  assert.strictEqual(L.campUpgrade(s, t0), 'rope');
  L.addItem(s, 'rope', 1);
  assert.strictEqual(L.campUpgrade(s, t0), 'ok');
  assert.deepStrictEqual([L.countItem(s, 'farm_cement'), L.countItem(s, 'rope'), s.fr.up > t0], [0, 0, true]);
  assert.strictEqual(L.campUpgrade(s, t0 + 1000), 'busy');
  // lumber and stone are asked first, as before
  const l = L.newState();
  l.gold = 1e6; l.lumber = 0; l.stone = 1000;
  L.campUpgrade(l, t0);
  assert.strictEqual(L.campUpgrade(l, t0), 'lumber');
  // a camp at level 6 from before stays level 6
  const old = L.newState();
  old.fr = { camp: 6, army: { boar: 3 }, lv: {}, dlv: {}, train: [], pts: 0, won: {} };
  assert.strictEqual(roundTrip(old).fr.camp, 6);
});

test("the horse's Saddlebags: Rope from the Mixer; the bag gets 12 more slots, kept through a save (with what is in them) and a bigger bag", () => {
  assert.deepStrictEqual(plain(H.gear.saddlebags.needs), [['leather_soft', 2], ['rope', 3]]);
  assert.strictEqual(H.gear.saddlebags.soon, undefined, 'on now');
  const s = L.newState();
  s.horse = { name: 'Chestnut', love: 50, pet: 0 };
  s.gold = 1e6;
  L.addItem(s, 'leather_soft', 2);
  assert.strictEqual(L.horseMake(s, 'saddlebags'), 'needs');
  L.addItem(s, 'rope', 3);
  const size = s.inv.length;
  assert.strictEqual(L.horseMake(s, 'saddlebags'), 'ok');
  assert.strictEqual(s.inv.length, size + 12);
  assert.strictEqual(L.bagLevel(s), 0);
  // fill the last slot and save
  s.inv[s.inv.length - 1] = { id: 'corn', n: 7 };
  const back = roundTrip(s);
  assert.strictEqual(back.inv.length, size + 12);
  assert.deepStrictEqual(plain(back.inv[back.inv.length - 1]), { id: 'corn', n: 7 }, 'what is in the Saddlebags stays');
  assert.strictEqual(L.bagLevel(back), 0);
  // a bigger bag: its own size plus the 12
  const next = L.nextBag(back);
  assert.strictEqual(next.size, C.BAG_SIZES[1] + 12);
  assert.strictEqual(L.upgradeBag(back), 'ok');
  assert.deepStrictEqual([back.inv.length, L.bagLevel(back)], [C.BAG_SIZES[1] + 12, 1]);
  assert.deepStrictEqual(plain(back.inv[size + 11]), { id: 'corn', n: 7 });
  const again = roundTrip(back);
  assert.deepStrictEqual([again.inv.length, L.bagLevel(again)], [C.BAG_SIZES[1] + 12, 1]);
  // a farm without them: as before
  const plainBag = roundTrip(L.newState());
  assert.strictEqual(plainBag.inv.length, C.BAG_SIZES[0]);
});

test('the weapons ask for the Mixer\'s materials now the game has them (their recipe said so)', () => {
  assert.deepStrictEqual(plain(L.nextWeapon(L.newState(), 'javelin').needs), [['lumber', 12], ['rope', 2]]);
  assert.deepStrictEqual(plain(L.nextWeapon(L.newState(), 'boomerang').needs), [['lumber', 8], ['beeswax', 2]]);
});
