// Unit tests for the Wild Lands (owner, 30 Oct 2026): who roams where and when, hunts and their drops, Makiling
// opening after 10 hunts, the Bow and its upgrades, arrows, Kanor's shop, cooking the meat, and the save.
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
const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const kinds = (list) => plain(list.map((e) => e.kind));

test('the places and who roams there: wolves only at night', () => {
  const s = L.newState();
  assert.deepStrictEqual(kinds(L.wildSlots('pulag').filter((e) => !e.when)), ['labuyo', 'labuyo', 'labuyo', 'rabbit', 'rabbit', 'rabbit', 'deer', 'deer']);
  s.time = 10 * 60;
  assert.deepStrictEqual(kinds(L.wildHere(s, 'makiling').filter((e) => !e.when)), ['deer', 'deer', 'boar', 'boar', 'boar']);
  s.time = 21 * 60;
  assert.deepStrictEqual(kinds(L.wildHere(s, 'makiling')).filter((k) => k === 'wolf'), ['wolf', 'wolf']);
  s.time = 3 * 60;
  assert.ok(L.isNight(s));
  assert.ok(L.isWildMap('pulag') && L.isWildMap('makiling') && !L.isWildMap('town'));
});

test('a hunted animal is gone for 30 minutes, then back; Makiling opens on the 10th hunt', () => {
  const s = L.newState();
  s.time = 10 * 60;
  assert.strictEqual(L.wildOpen(s, 'pulag'), true);
  assert.strictEqual(L.wildOpen(s, 'makiling'), false);
  assert.strictEqual(L.hunted(s, 'pulag', 6, 'deer').opened, null);
  const plainOnes = () => L.wildHere(s, 'pulag').filter((e) => !e.when);
  assert.deepStrictEqual(kinds(plainOnes()).filter((k) => k === 'deer'), ['deer']);
  clock.advance(29);
  assert.strictEqual(plainOnes().length, 7);
  clock.advance(2);
  assert.strictEqual(plainOnes().length, 8, 'back after 30 minutes');
  for (let i = 0; i < 8; i++) L.hunted(s, 'pulag', 0, 'labuyo');
  assert.strictEqual(L.hunted(s, 'pulag', 1, 'labuyo').opened, 'makiling');
  assert.strictEqual(L.wildOpen(s, 'makiling'), true);
  assert.strictEqual(s.wild.by.labuyo, 9);
  assert.strictEqual(s.wild.by.deer, 1);
});

test('what an animal leaves: always its meat (or pelt), sometimes more', () => {
  assert.deepStrictEqual(plain(L.huntDrops('deer', () => 0.99)), [['venison', 2]]);
  assert.deepStrictEqual(plain(L.huntDrops('deer', () => 0.1)), [['venison', 2], ['antler', 1]]);
  assert.deepStrictEqual(plain(L.huntDrops('wolf', () => 0.99)), [['pelt_wolf', 1]]);
  C.WILD.order.forEach((k) => C.WILD.animals[k].drops.forEach((d) => assert.ok(C.ITEMS[d[0]] && C.ITEMS[d[0]].sell > 0, d[0])));
});

test('the Bow: buy it once, upgrade it with gold and ore, shoot with arrows and energy', () => {
  const s = L.newState();
  s.gold = 500;
  assert.strictEqual(L.buyBow(s), 'gold');
  s.gold = 100000;
  assert.strictEqual(L.buyBow(s), 'ok');
  assert.strictEqual(L.buyBow(s), 'have');
  assert.strictEqual(L.bowRange(s), 6);
  assert.strictEqual(L.shoot(s), 'arrows');
  assert.strictEqual(L.buyWild(s, 'arrows'), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 10);
  s.energy = 1;
  assert.strictEqual(L.shoot(s), 'tired');
  s.energy = 50;
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 9);
  assert.strictEqual(s.energy, 48);
  assert.strictEqual(L.upgradeBow(s), 'ore');
  L.addItem(s, 'ore_copper', 5);
  assert.strictEqual(L.upgradeBow(s), 'ok');
  assert.strictEqual(L.countItem(s, 'ore_copper'), 0);
  assert.strictEqual(L.itemName(s, 'bow'), 'Copper Bow');
  assert.strictEqual(L.iconOf(s, 'bow'), C.ICON.bow_1);
  assert.strictEqual(L.bowRange(s), 7);
  L.addItem(s, 'ore_silver', 5);
  L.upgradeBow(s);
  assert.strictEqual(L.bowDamage(s), 2);
  L.addItem(s, 'ore_gold', 5);
  assert.strictEqual(L.upgradeBow(s), 'ok');
  assert.strictEqual(L.upgradeBow(s), 'max');
  assert.ok(!C.TOOL_KEYS.includes('bow'), 'the forge never upgrades it');
});

test('Kanor buys what you hunt; the meat cooks into the new dishes', () => {
  const s = L.newState();
  L.addItem(s, 'venison', 3);
  L.addItem(s, 'pelt_wolf', 1);
  L.addItem(s, 'turnip', 4);
  assert.deepStrictEqual(plain(L.wildGoods(s)), ['venison', 'pelt_wolf']);
  const g = s.gold;
  assert.strictEqual(L.sellToKanor(s, 'venison'), 135);
  assert.strictEqual(s.gold, g + 135);
  assert.strictEqual(L.countItem(s, 'venison'), 0);
  ['tinola', 'rabbit_stew', 'venison_tapa', 'boar_adobo', 'inihaw'].forEach((d) => {
    const r = C.RECIPES.find((x) => x.dish === d);
    assert.ok(r && C.ITEMS[d].energy > 40, d);
    r.needs.forEach((n) => assert.ok(C.ITEMS[n] || C.FOOD_GROUPS[n], d + ' needs ' + n));
  });
  s.builds.kitchen = 1;
  L.addItem(s, 'meat_boar', 1);
  L.addItem(s, 'onion', 1);
  assert.strictEqual(L.cook(s, C.RECIPES.find((x) => x.dish === 'inihaw')), 'ok', 'any meat for inihaw');
  assert.strictEqual(L.countItem(s, 'inihaw'), 1);
});

test('saved: hunts, the bow and its level, animals still away; older saves start fresh', () => {
  const s = L.newState();
  s.gold = 1e6;
  L.buyBow(s);
  L.addItem(s, 'ore_copper', 5);
  L.upgradeBow(s);
  L.hunted(s, 'makiling', 3, 'boar');
  s.map = 'pulag';
  const b = roundTrip(s);
  assert.strictEqual(b.wild.n, 1);
  assert.strictEqual(b.wild.by.boar, 1);
  assert.strictEqual(L.bowLevel(b), 1);
  assert.strictEqual(b.map, 'pulag');
  assert.strictEqual(L.wildHere(b, 'makiling').filter((e) => e.slot === 3).length, 0, 'still away');
  const old = plain(L.serialize(L.newState()));
  delete old.wl;
  const o = L.deserialize(old);
  assert.deepStrictEqual(plain(o.wild), { n: 0, by: {}, gone: {}, job: 0, best: {} });
  assert.ok(!L.hasBow(o));
});

test('who comes out changes with the hour, the rain and the season; slots stay in place for old saves', () => {
  const s = L.newState();
  const count = (area, kind) => L.wildHere(s, area).filter((e) => e.kind === kind).length;
  assert.deepStrictEqual(plain(L.wildSlots('pulag').slice(0, 8).map((e) => e.slot)), [0, 1, 2, 3, 4, 5, 6, 7], 'the first eight are the old ones');
  s.time = 10 * 60;
  const noon = count('pulag', 'rabbit');
  s.time = 6 * 60;
  assert.strictEqual(count('pulag', 'rabbit'), noon + 2, 'dawn: more rabbits');
  s.time = 18 * 60;
  assert.strictEqual(L.wildWhen(s, 'pulag', 'dusk'), true);
  s.time = 10 * 60;
  const dry = count('makiling', 'boar');
  const weather = L.weather;
  L.weather = () => 'rain';
  assert.strictEqual(count('makiling', 'boar'), dry + 2, 'rain: more boars');
  assert.ok(L.wildNews(s).some((x) => /Rain/.test(x)));
  L.weather = weather;
  const date = L.date;
  L.date = (d) => Object.assign({}, date(d), { key: 'fall' });
  assert.strictEqual(count('makiling', 'boar'), dry + 1, 'fall: one more boar');
  L.date = date;
});

test('a rare animal is about some of the time, the same for everyone, and it takes 2 hours to come back', () => {
  const s = L.newState();
  s.time = 10 * 60;
  let on = 0;
  for (let d = 1; d <= 400; d++) { s.day = d; for (let b = 0; b < 12; b++) { s.time = b * 120; if (L.wildRare(s, 'pulag')) on++; } }
  assert.ok(on > 4800 * 0.06 && on < 4800 * 0.14, 'about 1 in 10: ' + on);
  const other = L.newState();
  other.seed = 777; other.day = s.day; other.time = s.time;
  assert.strictEqual(L.wildRare(other, 'pulag'), L.wildRare(s, 'pulag'), 'not by player');
  const rare = L.wildRare;
  L.wildRare = () => true;
  s.time = 10 * 60;
  const slot = L.wildSlots('pulag').find((e) => e.kind === 'whitedeer').slot;
  assert.ok(L.wildHere(s, 'pulag').some((e) => e.kind === 'whitedeer'));
  L.hunted(s, 'pulag', slot, 'whitedeer', 1);
  clock.advance(100);
  assert.ok(!L.wildHere(s, 'pulag').some((e) => e.kind === 'whitedeer'), 'still gone');
  const b = roundTrip(s);
  assert.ok(!L.wildHere(b, 'pulag').some((e) => e.kind === 'whitedeer'), 'still gone after a reload');
  clock.advance(25);
  assert.ok(L.wildHere(s, 'pulag').some((e) => e.kind === 'whitedeer'), 'back');
  L.wildRare = rare;
  assert.deepStrictEqual(plain(L.huntDrops('whitedeer', () => 0.99)), [['venison', 3], ['white_antler', 1]]);
  assert.deepStrictEqual(plain(L.huntDrops('goldboar', () => 0.99)), [['meat_boar', 3], ['gold_tusk', 1]]);
});

test('every animal has a size: giants are rare, the biggest goes in the book, and friends can see it', () => {
  let giants = 0, i = 0;
  const seq = (n) => () => { i = (i * 16807 + 11) % 2147483647; return i / 2147483647; };
  const rnd = seq();
  for (let k = 0; k < 4000; k++) {
    const size = L.wildSize(rnd);
    assert.ok(size >= 0.8 && size <= 1.5, String(size));
    if (L.wildGiant(size)) giants++;
  }
  assert.ok(giants > 200 && giants < 480, 'about 1 in 12: ' + giants);
  const s = L.newState();
  assert.strictEqual(L.hunted(s, 'pulag', 6, 'deer', 1).record, false, 'the first is not a record yet');
  assert.strictEqual(s.wild.best.deer, 600);
  assert.strictEqual(L.hunted(s, 'pulag', 7, 'deer', 0.9).record, false);
  const big = L.hunted(s, 'pulag', 7, 'deer', 1.4);
  assert.strictEqual(big.record, true);
  assert.strictEqual(big.kg, 84);
  assert.strictEqual(roundTrip(s).wild.best.deer, 840);
  const snap = plain(L.snapshot(s));
  const seen = L.visitState(snap, L.newState());
  assert.strictEqual(seen.wild.best.deer, 840);
  assert.strictEqual(seen.wild.by.deer, 3);
  const bad = L.visitState(Object.assign({}, snap, { hb: [['x'], [-5, 'y']] }), L.newState());
  assert.ok(bad.wild.best.rabbit === 0 && !bad.wild.by.deer, 'an odd snapshot is ignored');
  assert.ok(JSON.stringify(snap).length < 16 * 1024);
});

test("Kanor's request: one a day, it pays well, it needs the real goods; Makiling's only once it is open", () => {
  const s = L.newState();
  s.gold = 0;
  s.wild.n = 0;
  const seen = new Set();
  for (let d = 1; d <= 300; d++) { s.day = d; seen.add(L.wildJob(s).item); }
  assert.ok(![...seen].some((id) => ['meat_boar', 'tusk', 'pelt_wolf', 'fang_wolf'].includes(id)), 'not before Makiling');
  assert.ok(seen.size >= 5);
  s.wild.n = 10;
  s.day = 5;
  for (let d = 1; d <= 300; d++) { s.day = d; seen.add(L.wildJob(s).item); }
  assert.ok(seen.has('pelt_wolf'));
  s.day = 40;
  const j = L.wildJob(s);
  assert.ok(j.gold >= C.ITEMS[j.item].sell * j.n * 2, 'it pays more than selling');
  assert.strictEqual(L.doWildJob(s), 'short');
  L.addItem(s, j.item, j.n);
  assert.strictEqual(L.doWildJob(s), 'ok');
  assert.strictEqual(s.gold, j.gold);
  assert.strictEqual(L.countItem(s, j.item), 0);
  assert.strictEqual(L.doWildJob(s), 'done');
  assert.strictEqual(roundTrip(s).wild.job, 40);
  s.day = 41;
  assert.strictEqual(L.wildJob(s).done, false, 'a new one tomorrow');
});

test('trophies: made from rare drops, into furniture storage, and never for sale', () => {
  const s = L.newState();
  s.gold = 5000;
  assert.strictEqual(L.makeTrophy(s, 0), 'short');
  L.addItem(s, 'antler', 3);
  s.gold = 100;
  assert.strictEqual(L.makeTrophy(s, 0), 'gold');
  s.gold = 5000;
  assert.strictEqual(L.makeTrophy(s, 0), 'ok');
  assert.strictEqual(s.gold, 4500);
  assert.strictEqual(L.countItem(s, 'antler'), 0);
  const t = C.HOME.typeIndex.trophy_antler;
  assert.strictEqual(s.home.bag[L.furnKey(t, 0)], 1);
  assert.strictEqual(roundTrip(s).home.bag[L.furnKey(t, 0)], 1);
  assert.strictEqual(L.buyFurn(s, t, 0), 'bad', 'not sold');
  C.WILD.trophies.forEach((x) => {
    assert.ok(C.HOME.types[C.HOME.typeIndex[x.type]].trophy, x.type);
    x.needs.forEach((n) => assert.ok(C.ITEMS[n[0]], n[0]));
  });
  for (let d = 1; d < 400; d++) { s.day = d; L.wagonDeals(s).forEach((w) => assert.ok(!C.HOME.types[w.t].trophy)); }
  assert.ok(!C.HOME.types[L.swapPiece(s, 'furniture').t].trophy);
});
