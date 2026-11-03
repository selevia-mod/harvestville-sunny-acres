// Unit tests for Skills (src/00-zzzzzzz-skills.js, src/01-logicZ-skills.js): XP from farming, mining, fishing and
// hunting, levels 1 to 10, the perks and how they stack with the dish powers, only your own actions counting, the save
// ('sk2') and old saves, and friends seeing your levels in the snapshot.
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
const SK = C.SKILLS;
const clock = require('./clock')(ctx);
L.weather = () => 'sunny';
const fresh = () => { clock.set(2026, 4, 1, 10, 0); const s = L.newState(); s.seed = 11; L.takeNotes(); L.takeSkillUps(); L.takeSkillPops(); L.skillRnd = () => 0.99; return s; };
const plain = (o) => JSON.parse(JSON.stringify(o));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));
const at = (s, key, level) => { s.sk2[key] = SK.need[level]; };
const act = (s, fn) => L.skillAct(s, fn);
const ripe = (s, idx, crop) => { s.soil[idx] = { w: 1, c: crop, p: L.nowMin() - C.CROPS[crop].mins - 1, r: 0 }; };

test('the four skills, ten levels, a curve that takes weeks, and perks at 3, 5, 7 and 10', () => {
  assert.deepStrictEqual(plain(SK.order), ['farm', 'mine', 'fish', 'hunt']);
  assert.strictEqual(SK.need.length, SK.max + 1);
  for (let n = 3; n <= SK.max; n++) assert.ok(SK.need[n] - SK.need[n - 1] > SK.need[n - 1] - SK.need[n - 2], 'each level takes longer: ' + n);
  assert.ok(SK.need[SK.max] / 400 > 14, 'even a big field (about 400 XP a day) takes more than two weeks');
  SK.order.forEach((k) => {
    const def = SK.skills[k];
    assert.ok(def.name && C.ICON[def.icon] != null && def.verb, k);
    assert.deepStrictEqual(plain(def.perks.map((p) => p.at)), [3, 5, 7, 10], k);
    def.perks.forEach((p) => assert.ok(p.text.length < 70, 'short words: ' + p.text));
  });
  assert.strictEqual(L.skillLevelOf(0), 1);
  assert.strictEqual(L.skillLevelOf(99), 1);
  assert.strictEqual(L.skillLevelOf(100), 2);
  assert.strictEqual(L.skillLevelOf(7199), 9);
  assert.strictEqual(L.skillLevelOf(1e9), 10);
  assert.ok(C.TIPS.some((t) => t.key === 'skills_tour'));
});

test('XP adds up, a level-up is told once, and it stops at the top', () => {
  const s = fresh();
  assert.strictEqual(L.skillLevel(s, 'fish'), 1);
  assert.strictEqual(L.skillAdd(s, 'fish', 99), 0);
  assert.strictEqual(L.skillAdd(s, 'fish', 1), 2, 'level 2');
  assert.deepStrictEqual(plain(L.takeSkillUps()), [{ key: 'fish', level: 2 }]);
  assert.deepStrictEqual(plain(L.takeSkillUps()), [], 'once');
  const info = L.skillInfo(s, 'fish');
  assert.deepStrictEqual(plain(info), { level: 2, xp: 100, from: 100, to: 300, part: 0 });
  assert.strictEqual(L.skillNextPerk(s, 'fish').at, 3);
  L.skillAdd(s, 'fish', 1e7);
  assert.strictEqual(L.skillXp(s, 'fish'), SK.need[SK.max], 'kept at the top');
  assert.strictEqual(L.skillInfo(s, 'fish').to, null);
  assert.strictEqual(L.skillNextPerk(s, 'fish'), null);
  assert.strictEqual(L.skillAdd(s, 'nope', 5), 0);
  assert.strictEqual(L.skillAdd(s, 'farm', -5), 0);
  s.isVisit = true;
  assert.strictEqual(L.skillAdd(s, 'farm', 500), 0, 'nothing counts on a visit');
  assert.strictEqual(L.skillXp(s, 'farm'), 0);
});

test('a later perk with the same field replaces the earlier one', () => {
  const s = fresh();
  assert.strictEqual(L.skillPerk(s, 'farm', 'extra'), 0);
  at(s, 'farm', 7);
  assert.strictEqual(L.skillPerk(s, 'farm', 'extra'), 0.05);
  at(s, 'farm', 10);
  assert.strictEqual(L.skillPerk(s, 'farm', 'extra'), 0.1);
  assert.strictEqual(L.skillPerks(s, 'farm').length, 4);
});

test('farming: till, water, plant and pick give XP, but only your own (a sprinkler or a farmhand gives none)', () => {
  const s = fresh();
  s.soil = {};
  assert.strictEqual(L.till(s, 5), 'ok');
  assert.strictEqual(L.skillXp(s, 'farm'), 0, 'not inside skillAct: nothing');
  act(s, () => { L.till(s, 6); L.till(s, 7); L.till(s, 6); });
  assert.strictEqual(L.skillXp(s, 'farm'), 2, 'twice (the third was already tilled)');
  act(s, () => { L.water(s, 6); L.water(s, 7); });
  assert.strictEqual(L.skillXp(s, 'farm'), 4);
  s.inv[0] = { id: 'seed_turnip', n: 2 };
  assert.strictEqual(act(s, () => L.plantBag(s, [5, 6, 7], 0)), 3);
  assert.strictEqual(L.skillXp(s, 'farm'), 7, 'one a tile planted');
  [5, 6, 7].forEach((i) => ripe(s, i, 'turnip'));
  assert.ok(L.isRipe(s.soil[6]));
  assert.strictEqual(act(s, () => L.harvest(s, 6)), 'turnip');
  assert.strictEqual(L.skillXp(s, 'farm'), 9, 'a pick is 2');
  L.harvest(s, 7);
  assert.strictEqual(L.skillXp(s, 'farm'), 9, 'a pick outside skillAct: nothing');
  assert.strictEqual(L.skillActing(s), false);
});

test('farming perks: a bigger can (and an old save keeps its water), less energy for the hoe and can, one more crop', () => {
  const s = fresh();
  const can = L.canCapacity(s);
  at(s, 'farm', 3);
  assert.strictEqual(L.canCapacity(s), can + 5);
  L.refill(s);
  assert.strictEqual(roundTrip(s).water, can + 5, 'the bigger can keeps its water through the save');
  s.tools.hoe = 2;
  const e = L.toolEnergy(s, 'hoe', 9), axe = L.toolEnergy(s, 'axe', 9);
  at(s, 'farm', 5);
  assert.strictEqual(L.toolEnergy(s, 'hoe', 9), Math.round(e * 0.85));
  assert.strictEqual(L.toolEnergy(s, 'axe', 9), axe, 'not the axe');
  assert.strictEqual(L.toolEnergy(s, 'hoe', 1) >= 1, true);
  // with the tools power on as well: both, one after the other
  s.dp = { id: Object.keys(C.DISH_POWERS).filter((id) => C.DISH_POWERS[id].key === 'tools')[0], until: L.nowMin() + 10 };
  assert.ok(s.dp.id, 'a tools dish exists');
  assert.strictEqual(L.toolEnergy(s, 'hoe', 9), Math.max(1, Math.round(Math.max(1, Math.round(e * 0.8)) * 0.85)));
  // one more crop
  at(s, 'farm', 10);
  ripe(s, 3, 'turnip');
  L.skillRnd = () => 0.05;
  assert.strictEqual(act(s, () => L.harvest(s, 3)), 'turnip');
  assert.strictEqual(L.countItem(s, 'turnip'), 2, 'one more');
  assert.deepStrictEqual(plain(L.takeSkillPops()), [{ key: 'farm', id: 'turnip' }]);
  ripe(s, 3, 'turnip');
  L.skillRnd = () => 0.1;
  act(s, () => L.harvest(s, 3));
  assert.strictEqual(L.countItem(s, 'turnip'), 3, 'not this time (1 in 10)');
});

test('mining: a rock is 3, one with ore or a gem 5; rocks take less energy; now and then one more ore', () => {
  const s = fresh();
  assert.strictEqual(L.skillRock(s, null), null);
  assert.strictEqual(L.skillXp(s, 'mine'), 3);
  L.skillRock(s, 'stone');
  assert.strictEqual(L.skillXp(s, 'mine'), 6, 'stone is not ore');
  L.skillRock(s, 'ore_copper');
  assert.strictEqual(L.skillXp(s, 'mine'), 11);
  const e = L.mineEnergy(s, 40);
  at(s, 'mine', 3);
  assert.strictEqual(L.mineEnergy(s, 40), Math.round(e * 0.85));
  at(s, 'mine', 7);
  assert.strictEqual(L.mineEnergy(s, 40), Math.round(e * 0.75));
  assert.ok(L.mineEnergy(s, 1) >= 1);
  L.skillRnd = () => 0.01;
  const before = L.countItem(s, 'ore_copper');
  assert.strictEqual(L.skillRock(s, 'ore_copper'), 'ore_copper');
  assert.strictEqual(L.countItem(s, 'ore_copper'), before + 1);
  assert.strictEqual(L.skillRock(s, 'stone'), null, 'never one more stone');
  L.skillRnd = () => 0.06;
  assert.strictEqual(L.skillRock(s, 'ore_copper'), null, 'a 1 in 20 chance at level 5-9');
  at(s, 'mine', 10);
  assert.strictEqual(L.skillRock(s, 'ore_copper'), 'ore_copper', '1 in 10 at the top');
  s.isVisit = true;
  const xp = L.skillXp(s, 'mine');
  assert.strictEqual(L.skillRock(s, 'ore_copper'), null);
  assert.strictEqual(L.skillXp(s, 'mine'), xp);
});

test('mining with the mine power on: both cuts', () => {
  const s = fresh();
  const id = Object.keys(C.DISH_POWERS).filter((k) => C.DISH_POWERS[k].key === 'mine')[0];
  assert.ok(id);
  s.dp = { id, until: L.nowMin() + 10 };
  const e = L.mineEnergy(s, 60);
  at(s, 'mine', 7);
  assert.strictEqual(L.mineEnergy(s, 60), Math.max(1, Math.round(e * 0.75)));
});

test('fishing: XP by the fish, more for a giant, 1 for one that got away; only your own catch', () => {
  const s = fresh();
  const half = () => 0.5;
  assert.strictEqual(L.landFish(s, 'fish_s', half), 'fish_s');
  assert.strictEqual(L.skillXp(s, 'fish'), 0, 'not inside skillAct');
  act(s, () => L.landFish(s, 'fish_s', half));
  assert.strictEqual(L.skillXp(s, 'fish'), 4);
  act(s, () => L.landFish(s, 'fish_k', half));
  assert.strictEqual(L.skillXp(s, 'fish'), 34, 'the King Trout is 30');
  act(s, () => L.landFish(s, 'fish_l', () => 0.01)); // a giant
  assert.strictEqual(s.lastFish.giant, true);
  assert.strictEqual(L.skillXp(s, 'fish'), 34 + 8 + 4);
  L.skillFishMiss(s);
  assert.strictEqual(L.skillXp(s, 'fish'), 47);
  s.inv = s.inv.map(() => ({ id: 'stone', n: 999 }));
  const add = L.addItem;
  L.addItem = (st, id, n) => (st === s ? n : add(st, id, n));
  try { assert.strictEqual(act(s, () => L.landFish(s, 'fish_m', half)), '!full'); } finally { L.addItem = add; }
  assert.strictEqual(L.skillXp(s, 'fish'), 47, 'a full bag: nothing');
});

test('fishing perks: a bigger, gentler reel game; giants half again as often', () => {
  const s = fresh();
  const base = C.FISH_GAME.fish_l;
  assert.deepStrictEqual(plain(L.skillReel(s, base)), { speed: base.speed, zone: base.zone });
  at(s, 'fish', 3);
  assert.ok(Math.abs(L.skillReel(s, base).zone - base.zone * 1.1) < 1e-9);
  at(s, 'fish', 5);
  assert.ok(Math.abs(L.skillReel(s, base).speed - base.speed * 0.9) < 1e-9);
  at(s, 'fish', 10);
  assert.ok(Math.abs(L.skillReel(s, base).zone - base.zone * 1.2) < 1e-9);
  assert.ok(L.skillReel(s, { speed: 1, zone: 0.85 }).zone <= 0.9, 'never the whole track');
  // giants: the odds overall become m times the usual
  const g = C.FISH_SIZE.giant;
  const p = (g.odds * 1.5 - g.odds) / (1 - g.odds);
  const seq = (...xs) => { let i = 0; return () => xs[i++ % xs.length]; };
  assert.strictEqual(L.skillGiant(1, g, 1, seq(0)), 1, 'no perk: as it was');
  assert.strictEqual(L.skillGiant(1, g, 1.5, seq(p + 0.001)), 1);
  assert.ok(L.skillGiant(1, g, 1.5, seq(p - 0.001, 0.5)) >= g.size[0]);
  assert.strictEqual(L.skillGiant(1.5, g, 1.5, seq(0)), 1.5, 'a giant stays as it is');
  // and it is used when you land one at level 7+
  at(s, 'fish', 7);
  act(s, () => L.landFish(s, 'fish_m', seq(0.5, 0.5, p - 0.001, 0.5)));
  assert.strictEqual(s.lastFish.giant, true, 'the second chance made it a giant');
  L.landFish(s, 'fish_m', seq(0.5, 0.5, p - 0.001, 0.5));
  assert.strictEqual(s.lastFish.giant, false, 'not outside skillAct');
  let n = 0;
  for (let i = 0; i < 20000; i++) if (L.skillGiant(L.fishSize(Math.random), g, 1.5, Math.random) >= g.size[0]) n++;
  assert.ok(Math.abs(n / 20000 - g.odds * 1.5) < 0.012, 'about 1 in 10: ' + n / 20000);
});

test('hunting: XP by how many arrows it takes, more for a giant or a rare one', () => {
  const s = fresh();
  L.hunted(s, 'pulag', 0, 'rabbit', 1);
  assert.strictEqual(L.skillXp(s, 'hunt'), 5);
  L.hunted(s, 'pulag', 1, 'deer', 1.3);
  assert.strictEqual(L.skillXp(s, 'hunt'), 5 + 10 + 5, 'a giant deer');
  L.hunted(s, 'pulag', 2, 'whitedeer', 1);
  assert.strictEqual(L.skillXp(s, 'hunt'), 20 + 15 + 20, 'a rare one');
  if (C.WILD.animals.greatmammoth) {
    const xp = L.skillXp(s, 'hunt');
    L.hunted(s, 'magayon', 0, 'greatmammoth', 1);
    assert.strictEqual(L.skillXp(s, 'hunt'), xp + 60 + 20, 'the Great Mammoth: the most there is');
  }
  assert.strictEqual(s.wild.n >= 3, true, 'hunts still counted');
});

test('hunting perks: an arrow kept now and then, a strong shot, giants more often', () => {
  const s = fresh();
  s.inv[0] = { id: 'arrows', n: 5 };
  L.skillRnd = () => 0;
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 4, 'no perk yet');
  assert.strictEqual(L.skillStrong(s), false);
  at(s, 'hunt', 3);
  assert.strictEqual(L.shoot(s), 'ok');
  assert.strictEqual(L.countItem(s, 'arrows'), 4, 'kept');
  L.skillRnd = () => 0.5;
  L.shoot(s);
  assert.strictEqual(L.countItem(s, 'arrows'), 3);
  s.energy = 0;
  L.skillRnd = () => 0;
  assert.strictEqual(L.shoot(s), 'tired');
  assert.strictEqual(L.countItem(s, 'arrows'), 3, 'no shot, nothing kept');
  at(s, 'hunt', 5);
  L.skillRnd = () => 0.09;
  assert.strictEqual(L.skillStrong(s), true);
  L.skillRnd = () => 0.11;
  assert.strictEqual(L.skillStrong(s), false);
  at(s, 'hunt', 10);
  assert.strictEqual(L.skillStrong(s), true, '1 in 5 at the top');
  const d = L.bowDamage(s);
  s.skHit = 1;
  assert.strictEqual(L.bowDamage(s), d + 1, 'a strong shot hits once more');
  s.skHit = 0;
  assert.strictEqual(L.skillPerk(s, 'hunt', 'giant'), 1.5);
});

test('the save: sk2 keeps each skill\'s XP; old saves and junk load', () => {
  const s = fresh();
  assert.strictEqual(plain(L.serialize(s)).sk2, undefined, 'nothing yet: nothing saved');
  s.sk2 = { farm: 1234, hunt: 7 };
  const o = plain(L.serialize(s));
  assert.deepStrictEqual(o.sk2, [1234, 0, 0, 7]);
  const back = L.deserialize(o);
  assert.deepStrictEqual(plain(back.sk2), { farm: 1234, hunt: 7 });
  assert.strictEqual(L.skillLevel(back, 'farm'), 5);
  delete o.sk2;
  const old = L.deserialize(o);
  assert.ok(old, 'an old save loads');
  assert.deepStrictEqual(plain(old.sk2), {});
  SK.order.forEach((k) => assert.strictEqual(L.skillLevel(old, k), 1));
  o.sk2 = ['x', -50, 1e12, null, 99];
  assert.deepStrictEqual(plain(L.deserialize(o).sk2), { fish: SK.need[SK.max] });
  o.sk2 = 'nope';
  assert.deepStrictEqual(plain(L.deserialize(o).sk2), {});
  assert.strictEqual(o.v, C.SAVE_VERSION, 'the save version is unchanged');
});

test('friends see your levels: in the snapshot, checked on the way in', () => {
  const s = fresh();
  assert.strictEqual(plain(L.snapshot(s)).sk2, undefined, 'all at 1: nothing sent');
  s.sk2 = { farm: SK.need[4] + 10, fish: SK.need[10] };
  const snap = plain(L.snapshot(s));
  assert.deepStrictEqual(snap.sk2, [4, 1, 10, 1]);
  const v = L.visitState(snap, s);
  assert.strictEqual(L.skillLevel(v, 'farm'), 4);
  assert.strictEqual(L.skillLevel(v, 'fish'), 10);
  assert.strictEqual(L.skillLevel(v, 'mine'), 1);
  const bad = L.visitState({ sk2: [99, -3, 'x', { a: 1 }] }, s);
  assert.deepStrictEqual([L.skillLevel(bad, 'farm'), L.skillLevel(bad, 'mine'), L.skillLevel(bad, 'fish'), L.skillLevel(bad, 'hunt')], [10, 1, 1, 1]);
  assert.deepStrictEqual(plain(L.visitState({ sk2: 'no' }, s).sk2), {});
  assert.deepStrictEqual(plain(L.visitState(null, s).sk2), {});
});
