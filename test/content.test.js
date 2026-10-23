// Unit tests for goals, tips, the collection book, mail, heart events, pets, furniture, the mine's depth,
// fishing and the dance score.
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
L.weather = () => 'sunny';

const plain = (v) => JSON.parse(JSON.stringify(v));
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const slotOf = (s, id) => s.inv.findIndex((x) => x && x.id === id);
const fresh = () => {
  const s = L.newState();
  s.seed = 7;
  return s;
};

test('goals advance in order, only on their own event, and pay their reward', () => {
  const s = fresh();
  assert.strictEqual(L.goal(s).event, 'clear');
  assert.strictEqual(L.progress(s, 'till'), null, 'the wrong event does not count');
  assert.strictEqual(L.progress(s, 'clear'), null);
  assert.strictEqual(L.progress(s, 'clear', 1), null);
  const gold = s.gold;
  const done = L.progress(s, 'clear');
  assert.ok(done && done.goal.event === 'clear');
  assert.strictEqual(s.gold, gold + 100);
  assert.strictEqual(L.goal(s).event, 'till');
  assert.strictEqual(s.gp, 0);
  s.goal = C.GOALS.length;
  assert.strictEqual(L.goal(s), null);
  assert.strictEqual(L.progress(s, 'clear'), null);
});

test('every goal has a target the pointer can find and a reward', () => {
  const maps = ['farm', 'house', 'town', 'mine'];
  C.GOALS.forEach((g) => {
    assert.ok(maps.includes(g.target.map), g.text);
    assert.ok(g.target.point || g.target.object || g.target.x != null, g.text);
    assert.ok(g.need >= 1);
  });
  maps.forEach((a) => maps.forEach((b) => { if (a !== b) assert.ok(C.ROUTES[a][b], a + ' -> ' + b); }));
});

test('sleeping counts for the sleep goal', () => {
  const s = fresh();
  s.goal = C.GOALS.findIndex((g) => g.event === 'sleep');
  const r = L.endDay(s, false);
  assert.strictEqual(r.goalDone, true);
  assert.strictEqual(L.goal(s).event, 'collect');
});

test('tips show once per kind of item', () => {
  const s = fresh();
  assert.strictEqual(L.tipKey('hoe'), 'hoe');
  assert.strictEqual(L.tipKey('seed_corn'), 'seed');
  assert.strictEqual(L.tipKey('jam'), 'food');
  assert.strictEqual(L.tipKey('turnip'), 'food');
  assert.strictEqual(L.tipKey('ore_gold'), null);
  assert.match(L.takeTip(s, 'seed'), /3x3/);
  assert.strictEqual(L.takeTip(s, 'seed'), null);
  assert.ok(L.takeTip(s, 'hoe'));
  assert.strictEqual(roundTrip(s).tips, s.tips);
});

test('the collection book fills as you harvest, ship, catch, forage and cook', () => {
  const s = fresh();
  assert.strictEqual(L.collectionCount(s), 0);
  s.soil[5] = { w: 0, c: 'turnip', d: 3 };
  assert.strictEqual(L.harvest(s, 5), 'turnip');
  assert.ok(L.discovered(s, 'turnip'));
  assert.strictEqual(L.discover(s, 'turnip'), false, 'only new the first time');
  L.catchFish(s, 'river', 0.99);
  assert.ok(L.discovered(s, 'fish_k'));
  assert.strictEqual(s.stats.fish, 1);
  s.builds.kitchen = 1;
  L.addItem(s, 'egg', 1);
  assert.strictEqual(L.cook(s, C.RECIPES[0]), 'ok');
  assert.ok(L.discovered(s, 'boiled_egg'));
  assert.strictEqual(s.stats.cooked, 1);
  L.addItem(s, 'gem', 1);
  L.ship(s, slotOf(s, 'gem'));
  assert.ok(L.discovered(s, 'gem'));
  assert.ok(L.discover(s, 'tonic'), 'the last item of the list (second number of the bitset)');
  const back = roundTrip(s);
  C.COLLECTION.forEach((id) => assert.strictEqual(L.discovered(back, id), L.discovered(s, id), id));
  assert.strictEqual(L.collectionCount(back), 5);
  assert.deepStrictEqual(plain(back.stats), plain(s.stats));
});

test('shipping earnings are recorded and unlock letters', () => {
  const s = fresh();
  L.addItem(s, 'gem', 3);
  L.ship(s, slotOf(s, 'gem'));
  const r = L.endDay(s, false);
  assert.strictEqual(r.earned, 1200);
  assert.strictEqual(s.stats.earned, 1200);
  assert.ok(s.mail.includes('ship1'));
  assert.ok(s.mail.includes('welcome'), 'the welcome letter arrives on day 2');
  L.endDay(s, false);
  assert.strictEqual(s.mail.filter((m) => m === 'welcome').length, 1, 'one-time letters come once');
});

test('letters: festival invitations and birthday notes the day before; gifts are taken when read', () => {
  const s = fresh();
  s.day = 13; // Spring 13: the Flower Festival is tomorrow
  L.checkMail(s);
  assert.ok(s.mail.includes('fest:flower'));
  assert.match(L.letter('fest:flower').text, /Flower Festival/);
  s.mail = [];
  s.day = 19; // Lily's birthday is Spring 20
  L.checkMail(s);
  assert.ok(s.mail.includes('bday:lily'));
  assert.match(L.letter('bday:lily').text, /Lily/);

  s.mail = ['welcome', 'h_mira'];
  const before = L.countItem(s, 'sandwich');
  let r = L.readMail(s);
  assert.strictEqual(r.key, 'welcome');
  assert.strictEqual(L.countItem(s, 'sandwich'), before + 1);
  r = L.readMail(s);
  assert.strictEqual(s.lumber, 15);
  assert.strictEqual(L.readMail(s).error, 'empty');

  // a full bag keeps the letter until there is room
  s.mail = ['welcome'];
  s.inv = s.inv.map(() => ({ id: 'gem', n: 99 }));
  assert.strictEqual(L.readMail(s).error, 'full');
  assert.deepStrictEqual(plain(s.mail), ['welcome']);
  assert.deepStrictEqual(plain(roundTrip(s).mail), ['welcome']);
});

test('every letter and heart event refers to real people and items', () => {
  Object.keys(C.LETTERS).forEach((k) => {
    const l = C.LETTERS[k];
    assert.ok(C.VILLAGERS[l.from], k);
    if (l.gift) assert.ok(C.ITEMS[l.gift[0]] || ['gold', 'lumber', 'stone'].includes(l.gift[0]), k);
  });
  C.VILLAGER_ORDER.forEach((k) => assert.ok(C.LETTERS['h_' + k], 'a 3-heart letter from ' + k));
  Object.keys(C.HEART_EVENTS).forEach((k) => {
    assert.ok(C.VILLAGERS[k]);
    C.HEART_EVENTS[k].forEach((ev) => {
      ev.lines.forEach((l) => assert.ok(l[0] === 'me' || C.VILLAGERS[l[0]], k));
      assert.strictEqual(ev.choice.a.length, 2);
    });
  });
});

test('heart events play once each, in order, when the hearts are reached', () => {
  const s = fresh();
  assert.strictEqual(L.heartEvent(s, 'lily'), null, 'no hearts yet');
  L.friend(s, 'lily').pts = 45;
  let e = L.heartEvent(s, 'lily');
  assert.strictEqual(e.i, 0);
  assert.match(L.finishEvent(s, 'lily', 0, 0), /Thank you/);
  assert.strictEqual(s.friends.lily.pts, 51);
  e = L.heartEvent(s, 'lily');
  assert.strictEqual(e.i, 1, 'the 4-heart event is next');
  L.finishEvent(s, 'lily', 1, 1);
  assert.strictEqual(s.friends.lily.pts, 48);
  assert.strictEqual(L.heartEvent(s, 'lily'), null, 'the 6-heart one needs 6 hearts');
  assert.strictEqual(roundTrip(s).friends.lily.ev, 3);
});

test('the stable brings a horse; the cat basket brings a cat; pets want a daily pat', () => {
  const s = fresh();
  s.gold = 10000;
  s.lumber = C.BUILDS.stable.lumber;
  assert.strictEqual(L.startBuild(s, 'stable'), 'ok');
  let r = L.endDay(s, false);
  assert.strictEqual(r.built, 'stable');
  assert.strictEqual(r.horse, true);
  assert.strictEqual(s.horse.name, 'Chestnut');
  assert.strictEqual(L.petHorse(s), 'ok');
  assert.strictEqual(L.petHorse(s), 'already');
  assert.strictEqual(L.buyFurniture(s, 'f_cat'), 'ok');
  assert.strictEqual(s.cat.name, 'Mochi');
  assert.strictEqual(L.buyFurniture(s, 'f_cat'), 'owned');
  L.petCat(s);
  r = L.endDay(s, false);
  assert.strictEqual(s.horse.pet, 0);
  assert.strictEqual(s.horse.love, C.LOVE.pet);
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.horse), plain(s.horse));
  assert.deepStrictEqual(plain(back.cat), plain(s.cat));
  assert.strictEqual(back.builds.f_cat, 1);
  assert.strictEqual(back.builds.stable, 1);
});

test('furniture costs gold; the music box gives a little energy once a day', () => {
  const s = fresh();
  s.gold = 500;
  assert.strictEqual(L.buyFurniture(s, 'f_music'), 'gold');
  s.gold = 900;
  assert.strictEqual(L.buyFurniture(s, 'f_music'), 'ok');
  assert.strictEqual(s.gold, 100);
  s.energy = 50;
  assert.strictEqual(L.playMusicBox(s), 5);
  assert.strictEqual(L.playMusicBox(s), 0, 'once a day');
  assert.strictEqual(roundTrip(s).musicDay, s.day);
});

test('deeper mine floors cost more energy; every 5th floor has a chest, opened once', () => {
  const s = fresh();
  assert.strictEqual(L.mineEnergy(s, 1), L.toolEnergy(s, 'hammer', 1));
  assert.strictEqual(L.mineEnergy(s, 10), L.toolEnergy(s, 'hammer', 1) + 2);
  assert.ok(!L.hasChest(4) && L.hasChest(5) && L.hasChest(10));
  const gold = s.gold;
  const r = L.openChest(s, 10);
  assert.strictEqual(r.gold, 600);
  assert.strictEqual(s.gold, gold + 600);
  assert.strictEqual(L.countItem(s, 'ore_silver'), 3);
  assert.strictEqual(L.openChest(s, 10).error, 'opened');
  assert.ok(L.chestOpened(s, 10) && !L.chestOpened(s, 5));
  assert.strictEqual(roundTrip(s).chests, s.chests);
  L.reachFloor(s, 12);
  L.reachFloor(s, 3);
  assert.strictEqual(s.stats.deepest, 12);
  L.endDay(s, false);
  assert.ok(s.mail.includes('mine10'));
});

test('fishing: the fish is picked first, then landed after the mini-game', () => {
  const s = fresh();
  assert.strictEqual(L.rollFish('pond', 0.1), 'fish_s');
  assert.strictEqual(L.rollFish('river', 0.999), 'fish_k');
  Object.keys(C.FISH_TABLE).forEach((w) => Object.keys(C.FISH_TABLE[w]).forEach((id) => assert.ok(C.FISH_GAME[id], id)));
  assert.strictEqual(L.landFish(s, 'fish_m'), 'fish_m');
  assert.strictEqual(L.countItem(s, 'fish_m'), 1);
});

test('a good dance earns extra friendship at the Flower Festival', () => {
  const flower = C.FESTIVALS[0];
  const a = fresh(), b = fresh();
  L.friend(a, 'lily');
  L.friend(b, 'lily');
  L.joinFestival(a, flower, 'lily', 1);
  const r = L.joinFestival(b, flower, 'lily', 0);
  assert.strictEqual(a.friends.lily.pts - b.friends.lily.pts, C.DANCE_BONUS);
  assert.match(r.text, /toes/);
});

test('older saves skip the starter goals; new farms start them', () => {
  const s = fresh();
  s.day = 20;
  const o = plain(L.serialize(s));
  delete o.gl;
  assert.strictEqual(L.deserialize(o).goal, C.GOALS.length);
  assert.strictEqual(roundTrip(fresh()).goal, 0);
});

test('the save stays under 16 KB with everything filled in', () => {
  const s = fresh();
  s.mail = ['welcome', 'ship1', 'ship2', 'ship3', 'mine10', 'h_lily', 'h_mira', 'fest:flower'];
  s.sent = Object.keys(C.LETTERS).filter((k) => k !== 'fest' && k !== 'bday');
  C.COLLECTION.forEach((id) => L.discover(s, id));
  C.VILLAGER_ORDER.forEach((k) => { L.friend(s, k).pts = 100; L.friend(s, k).ev = 7; });
  s.horse = { name: 'Chestnut', love: 100, pet: 1 };
  s.cat = { name: 'Mochi', love: 100, pet: 1 };
  for (let i = 0; i < 400; i++) s.soil[i] = { w: 1, c: 'corn', d: 5 };
  for (let i = 400; i < 900; i++) s.debris[i] = 'stump';
  const json = JSON.stringify(L.serialize(s));
  assert.ok(json.length < 16384, json.length + ' bytes');
  assert.strictEqual(L.collectionCount(roundTrip(s)), C.COLLECTION.length);
});
