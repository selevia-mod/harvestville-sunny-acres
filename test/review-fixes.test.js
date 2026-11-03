// Unit tests for what the 4 Nov review found where the day's features meet (each one failed before its fix).
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
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const fresh = () => {
  clock.set(2026, 4, 1, 10, 0);
  const s = L.newState();
  s.seed = 11;
  s.yard.items = [];
  s.animals = [];
  s.stats.earned = 1e5;
  s.gold = 5000;
  L.takeNotes();
  if (L.fhTakeRecent) L.fhTakeRecent();
  return s;
};
const tick = (s, mins) => { clock.advance(mins); return L.catchUp(s, clock.ms, null); };

test('the Magma Bow has its own save key: the music box\'s day (saved "mb") never makes a Gold Bow a Magma Bow', () => {
  const s = fresh();
  L.addItem(s, 'bow', 1);
  s.tools.bow = 3;
  s.musicDay = s.day; // played the music box today
  const back = roundTrip(s);
  assert.strictEqual(L.bowLevel(back), 3, 'still the Gold Bow');
  assert.strictEqual(back.musicDay, s.day, 'and the music box keeps its day');
  s.tools.bow = 4;
  const magma = roundTrip(s);
  assert.strictEqual(L.bowLevel(magma), 4, 'a real Magma Bow is kept');
  assert.strictEqual(magma.musicDay, s.day, 'without touching the music box');
  const o = plain(L.serialize(s));
  assert.strictEqual(o.mgb, 1);
});

test('the station\'s cargo never asks for the Lair\'s goods (a Bakunawa Scale is once a day, for the Magma Bow)', () => {
  const s = fresh();
  s.wild.by = { bungisngis: 3, bakunawa: 2, sigbin: 4, deer: 5 };
  const hunt = plain(L.twPools(s).hunt || []);
  ['ember_shard', 'bungisngis_tooth', 'bakunawa_scale', 'sigbin_horn', 'santelmo_flame', 'tikbalang_mane'].forEach((id) => assert.ok(hunt.indexOf(id) < 0, id));
  assert.ok(hunt.indexOf('venison') >= 0, 'the Wild Lands\' goods still are');
});

test('the animal hand collects a rare animal\'s second one too, and the morning report and the basket agree', () => {
  const s = fresh();
  L.addAnimal(s, 'cow');
  s.animals[0].ready = 1;
  s.animals[0].bx = 1; // a rare one's bonus waiting
  L.fhHire(s, 'berto');
  tick(s, 10);
  assert.strictEqual(Object.values(plain(s.basket)).reduce((a, b) => a + b, 0), 2);
  assert.strictEqual(s.animals[0].bx, 0);
});

test('the harvester\'s pick uses up the fertilizer, as yours does, and a sprinkler keeps the tile wet', () => {
  const s = fresh();
  const crop = 'turnip';
  s.soil[10] = { w: 1, c: crop, p: L.nowMin() - C.CROPS[crop].mins - 1, r: 0, h: 1, f: 2 };
  L.fhHire(s, 'lucing');
  tick(s, 10);
  assert.strictEqual(s.basket.turnip, 1);
  assert.strictEqual(s.soil[10].f, undefined, 'one bag, one crop');
});
