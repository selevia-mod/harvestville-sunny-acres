// e44 quests v2 (owner, 8 Nov 2026; docs/quests-v2.md): your dog's name, where each quest leads, a reason from a
// villager on every daily quest, the one quest on the card (pinned, else the next one to do).
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
const plain = (x) => JSON.parse(JSON.stringify(x));
const roundTrip = (s) => L.deserialize(plain(L.serialize(s)));

test('your dog\'s name: Biscuit until you name it, kept by the save, friendly words only', () => {
  const s = L.newState();
  assert.strictEqual(L.dogName(s), 'Biscuit');
  assert.strictEqual(L.dogNamed(s), false);
  assert.strictEqual(L.setDogName(s, '   '), 'empty');
  assert.strictEqual(L.setDogName(s, 'gago'), 'rude');
  assert.strictEqual(L.setDogName(s, 'Choco'), 'ok');
  assert.strictEqual(L.dogName(roundTrip(s)), 'Choco');
  assert.strictEqual(L.dogNamed(roundTrip(s)), true);
  assert.strictEqual(L.setDogName(s, 'A very very long dog name'), 'ok');
  assert.ok(L.dogName(s).length <= C.FARMER_NAME);
  assert.strictEqual(plain(L.snapshot(s)).pets.dog, L.dogName(s), 'friends see it');
  const old = plain(L.serialize(L.newState())); delete old.dn;
  assert.strictEqual(L.dogName(L.deserialize(old)), 'Biscuit', 'an older save');
});

test('every daily quest has a place to go or says it has none; each has a villager\'s reason, the same all day', () => {
  ['water', 'harvest', 'plant', 'clear', 'fish', 'care', 'collect', 'forage', 'pet', 'talk', 'gift', 'earned', 'cooked', 'order', 'request', 'floor']
    .forEach((c) => { const g = L.questPlace(c); assert.ok(g && g.map && g.to, c); });
  ['login', 'decor', 'trade', 'dquest', 'wchest'].forEach((c) => assert.strictEqual(L.questPlace(c), null, c));
  clock.set(2026, 11, 9, 7, 0);
  const s = L.newState();
  L.refreshQuests(s, '2026-11-09');
  s.dq.list.forEach((q, i) => {
    const r = L.questReason(s, i);
    assert.ok(r && C.VILLAGERS[r.who] && r.text.length > 10, q.c);
    assert.deepStrictEqual(plain(L.questReason(s, i)), plain(r), 'the same all day');
    assert.ok(!/\{dog\}/.test(r.text));
  });
});

test('the quest card: the pinned one, else one ready to claim, else the next one with a place to go', () => {
  clock.set(2026, 11, 9, 7, 0);
  const s = L.newState();
  L.refreshQuests(s, '2026-11-09');
  let card = L.questCard(s);
  assert.ok(card && card.i >= 0 && L.questPlace(s.dq.list[card.i].c), 'the first one with a place');
  const other = s.dq.list.findIndex((q, i) => i !== card.i && L.questPlace(q.c));
  assert.strictEqual(L.pinQuest(s, other), true);
  assert.strictEqual(L.questCard(s).i, other, 'pinned');
  assert.strictEqual(L.questCard(roundTrip(s)).i, other, 'kept by the save');
  // one is ready: it comes first, so you claim it
  const k = s.dq.list.findIndex((q, i) => i !== other);
  s.dq.list[k].b = L.count(s, s.dq.list[k].c) - s.dq.list[k].n;
  assert.strictEqual(L.questCard(s).i, other, 'the pin still wins');
  L.pinQuest(s, -1);
  assert.strictEqual(L.questCard(s).i, k, 'ready to claim first');
  assert.strictEqual(L.questCard(s).ready, true);
  // a pin from yesterday is forgotten
  s.qp = { d: s.dq.d - 1, i: other };
  assert.notStrictEqual(L.questCard(s).i, other);
  // all done and claimed: nothing on the card
  s.dq.list.forEach((q) => { q.done = 1; });
  assert.strictEqual(L.questCard(s), null);
});
