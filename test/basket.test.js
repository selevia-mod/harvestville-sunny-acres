// Unit tests for src/01-logicB.js: friends picking your ripe crops into the Harvest Basket, your birthday, and
// saying hello for the first-days goal (owner, 29 Oct 2026).
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
const fresh = (y = 2026, m = 4, d = 1) => { clock.set(y, m, d, 10, 0); const s = L.newState(); s.seed = 11; return s; };
const ripe = (s, idx, crop) => { s.soil[idx] = { w: 0, c: crop, p: L.nowMin() - C.CROPS[crop].mins - 1, r: 0 }; };

test('a friend picks a ripe crop off their copy of your farm; it goes back if the server says no', () => {
  const s = fresh();
  ripe(s, 10, 'turnip');
  s.soil[11] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 }; // still growing
  ripe(s, 12, 'grass'); // the sickle's, not a hand pick
  const v = L.visitState(L.snapshot(s), s);
  assert.strictEqual(L.pickable(v, 10), 'turnip');
  assert.strictEqual(L.pickable(v, 11), null);
  assert.strictEqual(L.pickable(v, 12), null);
  assert.strictEqual(L.pickable(v, 99), null);
  const keep = L.pickOff(v, 10);
  assert.strictEqual(v.soil[10].c, null, 'gone from their screen');
  assert.strictEqual(keep.c, 'turnip');
  assert.strictEqual(L.pickOff(v, 10), null, 'once');
});

test('at home, what friends picked goes into the basket only while that crop is still there and ripe (or has withered since)', () => {
  const s = fresh();
  ripe(s, 10, 'turnip');
  ripe(s, 11, 'turnip');
  ripe(s, 12, 'potato');
  s.soil[13] = { w: 1, c: 'turnip', p: L.nowMin(), r: 0 }; // replanted since: not ripe
  ripe(s, 14, 'grass');
  s.soil[15] = { w: 0, c: 'turnip', p: L.nowMin() - 1e6, r: 0 }; // withered after they picked it
  const n = L.applyPicks(s, [[10, 'turnip'], [11, 'turnip'], [12, 'turnip'], [13, 'turnip'], [14, 'grass'], [99, 'turnip'], [15, 'turnip'], 'junk', [10, 'turnip']]);
  assert.strictEqual(n, 3);
  assert.deepStrictEqual(plain(s.basket), { turnip: 3 });
  assert.strictEqual(s.soil[10].c, null, 'picked = harvested');
  assert.strictEqual(s.soil[12].c, 'potato', 'a different crop there: left alone');
  assert.strictEqual(s.soil[13].c, 'turnip');
  assert.strictEqual(L.basketCount(s), 3);
  assert.deepStrictEqual(plain(roundTrip(s).basket), { turnip: 3 }, 'the basket is saved');
  // you take it into your bag; what does not fit stays
  for (let i = 0; i < s.inv.length; i++) if (!s.inv[i]) s.inv[i] = { id: 'stone_x', n: 1 };
  s.inv = s.inv.map((x) => (x && x.id === 'stone_x' ? { id: 'potato', n: L.stackLimit('potato') } : x));
  assert.deepStrictEqual(plain(L.takeBasket(s)), { got: 0, left: 3 }, 'bag full');
  s.inv[s.inv.length - 1] = null;
  assert.deepStrictEqual(plain(L.takeBasket(s)), { got: 3, left: 0 });
  assert.strictEqual(L.countItem(s, 'turnip'), 3);
  assert.deepStrictEqual(plain(s.basket), {});
});

test('a broken saved basket is cleaned up', () => {
  const s = fresh(), o = plain(L.serialize(s));
  o.bk = ['turnip', 5, 'not_an_item', 3, 'potato', -2, 'carrot', 1e9];
  assert.deepStrictEqual(plain(L.deserialize(o).basket), { turnip: 5, carrot: 999 });
  o.bk = 'nope';
  assert.deepStrictEqual(plain(L.deserialize(o).basket), {});
});

test('your birthday: month and day only; the mayor sends a cake once a year; villagers wish you a happy birthday', () => {
  const s = fresh(2026, 4, 1);
  s.name = 'Ana';
  assert.strictEqual(L.birthdayOf(s), null);
  assert.strictEqual(L.birthdayText(s), 'Not set');
  assert.strictEqual(L.setBirthday(s, 13, 1), 'bad');
  assert.strictEqual(L.setBirthday(s, 4, 31), 'bad');
  assert.strictEqual(L.setBirthday(s, 'x', 2), 'bad');
  assert.strictEqual(L.setBirthday(s, 4, 3), 'ok');
  assert.strictEqual(L.birthdayText(s), 'April 3');
  assert.strictEqual(L.myBirthdayOn(s, s.day), false);
  assert.strictEqual(L.myBirthdayOn(s, s.day + 2), true);
  assert.strictEqual(L.birthdayMail(s), false, 'not today');
  // two days on: the letter with a cake comes in the morning mail
  clock.nextDay(L, s);
  clock.nextDay(L, s);
  assert.ok(L.myBirthdayOn(s, s.day));
  assert.ok(s.mail.includes('mybday'));
  assert.strictEqual(L.birthdayMail(s), false, 'once a year');
  const r = L.readMail(Object.assign(s, { mail: ['mybday'] }));
  assert.strictEqual(r.letter.from, 'hollis');
  assert.strictEqual(L.countItem(s, 'cake'), 1);
  // villagers you have met wish you a happy birthday, once each on the day
  L.talk(s, 'lily');
  const r2 = L.talk(s, 'hollis');
  assert.strictEqual(r2.first, true, 'meeting someone for the first time still gives their hello');
  const r3 = L.talk(s, 'lily');
  assert.strictEqual(r3.birthday, true);
  assert.match(r3.line, /Ana/);
  assert.notStrictEqual(L.talk(s, 'lily').birthday, true, 'once each');
  // saved, and set again by a broken save only when it is a real date
  const back = roundTrip(s);
  assert.strictEqual(back.bd, 403);
  assert.strictEqual(back.bdy, 2026);
  const o = plain(L.serialize(s));
  o.bd = [1399, 2026];
  assert.strictEqual(L.deserialize(o).bd, 0);
  // a February 29th birthday is on the 28th in other years
  const f = fresh(2027, 2, 28);
  L.setBirthday(f, 2, 29);
  assert.ok(L.myBirthdayOn(f, f.day));
  const g = fresh(2028, 2, 28);
  L.setBirthday(g, 2, 29);
  assert.ok(!L.myBirthdayOn(g, g.day));
  assert.ok(L.myBirthdayOn(g, g.day + 1));
});

test('friends see only that today is your birthday (never the date), and how full your basket is', () => {
  const s = fresh(2026, 4, 3);
  s.name = 'Ana';
  s.basket = { turnip: 2 };
  let snap = L.snapshot(s);
  assert.strictEqual(snap.bday, undefined);
  assert.strictEqual(snap.basket, 2);
  assert.ok(!JSON.stringify(snap).includes('403'));
  L.setBirthday(s, 4, 3);
  snap = L.snapshot(s);
  assert.strictEqual(snap.bday, s.day);
  const v = L.visitState(snap, fresh(2026, 4, 3));
  assert.strictEqual(v.hostBirthday, true);
  assert.strictEqual(v.hostName, 'Ana');
  assert.strictEqual(v.basketN, 2);
  assert.strictEqual(L.visitState(snap, fresh(2026, 4, 9)).hostBirthday, false, 'an old snapshot');
});

test('saying hello: each different person counts once while the goal is open, villagers met before and shoppers too', () => {
  const s = fresh();
  s.goal = C.GOALS.findIndex((g) => g.event === 'meet');
  L.friend(s, 'lily').met = 1; // met long ago (owner, 29 Oct: talking again never counted)
  assert.strictEqual(L.hello(s, 'lily'), true);
  assert.strictEqual(L.hello(s, 'lily'), false);
  assert.strictEqual(L.hello(s, 'visitor_mother'), true);
  s.goal += 1;
  assert.strictEqual(L.hello(s, 'hollis'), false, 'only while that goal is open');
});

test("What's new: versions newest first (v1 a major update, v1.1 a minor one); a new farm has seen them, an older save has not", () => {
  assert.strictEqual(C.NEWS_LATEST, C.NEWS[0].v);
  C.NEWS.forEach((n) => assert.match(n.v, /^\d+(\.\d+)?$/));
  C.NEWS.forEach((n) => n.lines.forEach((l) => assert.ok(C.ICON[l[0]] != null, 'icon ' + l[0])));
  const s = fresh();
  assert.strictEqual(s.wv, C.NEWS_LATEST);
  assert.strictEqual(roundTrip(s).wv, C.NEWS_LATEST);
  const o = plain(L.serialize(s));
  delete o.wv;
  assert.strictEqual(L.deserialize(o).wv, '', 'a farm from before: shown once');
  o.wv = '<b>9</b>';
  assert.strictEqual(L.deserialize(o).wv, '');
});
