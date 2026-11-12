// Unit tests for The Lost Tower's weekly board and First in Selebox (src/00-zzzzzzzzzzzzzzzzzzzzzzzz-tower-board.js,
// src/01-logicZZZZZZZZZZZZZZZZZZZZ-tower-board.js) and the server part's shape (supabase/farm_tower_board.sql; its
// behaviour is played on a local Postgres by test/sql/tower-board-checks.sql, test/sql/run.sh).
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
const BD = C.TOWER_BOARD;
const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_tower_board.sql'), 'utf8');
const fresh = () => { clock.set(2026, 11, 12, 10, 0); const s = L.newState(); s.seed = 11; return s; };
const roundTrip = (s) => L.deserialize(JSON.parse(JSON.stringify(L.serialize(s))));
const plain = (x) => JSON.parse(JSON.stringify(x));
const manila = (y, mo, d, h = 10, mi = 0) => Date.UTC(y, mo - 1, d, h - 8, mi);
const ID = '0f8b2c4e-1d2a-4b3c-9d4e-5f6a7b8c9d0e';

test('First in Selebox: the ten big bosses are Hall of Fame firsts, with their own words; a hunt never wins one by itself', () => {
  const keys = C.HALL.FIRSTS.filter((f) => f.tower).map((f) => f.key);
  assert.deepStrictEqual(plain(keys), [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((f) => 'tower_' + f));
  const f = L.hallFirst('tower_100');
  assert.strictEqual(f.kind, TW.zones[0].boss);
  assert.match(f.name, /^Tambanakua \(floor 100\)$/);
  assert.match(f.words, /^FIRST IN SELEBOX!\n.*Tambanakua on floor 100 of The Lost Tower!.*lighthouse wall in Manila/);
  // (the world's wildDown asks with floor 0 outside the Lair: never one of these)
  TW.zones.forEach((z) => assert.strictEqual(L.hallFirstOf('tower', z.boss, 0), null));
  const s = fresh();
  assert.strictEqual(L.hallWant(s, 'tower_100'), true);
  assert.strictEqual(L.hallWant(s, 'tower_100'), false, 'asked once');
  assert.deepStrictEqual(plain(roundTrip(s).tr.fq), ['tower_100'], 'the claim waits in the save (offline)');
  L.hallClaimed(s, 'tower_100');
  assert.deepStrictEqual(plain(roundTrip(s).tr.fd), ['tower_100']);
});

test('the server\'s allow-list has the ten, and its numbers are the game\'s', () => {
  const rows = [...SQL.match(/insert into farm\.hall_first_keys \(key, what\) values([^;]+?)on conflict/)[1].matchAll(/\('([a-z0-9_]+)', '([^']+)'\)/g)];
  assert.deepStrictEqual(rows.map((m) => m[1]), plain(C.HALL.FIRSTS.filter((f) => f.tower).map((f) => f.key)));
  rows.forEach((m) => { const f = L.hallFirst(m[1]); assert.strictEqual(m[2], C.WILD.animals[f.kind].name + ', floor ' + f.floor + ' of The Lost Tower'); });
  assert.match(SQL, /'day_cap', 100\b/);
  assert.match(SQL, /'per_call', 50\b/);
  assert.match(SQL, new RegExp("'prizes', jsonb_build_array\\(" + BD.prizes.join(', ') + '\\)'));
  assert.match(SQL, /'every_floors', 10\b/);
  assert.match(SQL, /'every_pearls', 10\b/);
  assert.match(SQL, /'title', 'Lighthouse Champion'/);
  assert.deepStrictEqual([BD.dayCap, BD.perSend, BD.every.floors, BD.every.pearls, BD.title], [100, 50, 10, 10, 'Lighthouse Champion']);
});

test('the SQL file: additive, safe twice, security definer with an empty search_path, players only, the undo at the bottom', () => {
  assert.match(SQL.split('\n')[0], /Lost Tower's weekly board and First in Selebox/);
  assert.match(SQL, /Run AFTER part 22/);
  assert.match(SQL, /set local lock_timeout = '5s';/);
  assert.match(SQL, /notify pgrst, 'reload schema';/);
  const live = SQL.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\b(drop|truncate|delete from farm\.hall)/i.test(live.replace(/delete from farm\.tower_requests where user_id = uid/, '')), 'nothing dropped or deleted outside the undo');
  assert.ok(!/^create function/m.test(live) && !/^create table (?!if not exists)/m.test(live), 'create or replace, if not exists');
  assert.ok(!/alter table farm\.(players|hall_first_keys|hall_firsts)/.test(live), 'nothing that exists changes');
  const fns = [...live.matchAll(/create or replace function (public|farm)\.([a-z_0-9]+)\(/g)];
  assert.deepStrictEqual(fns.filter((m) => m[1] === 'public').map((m) => m[2]).sort(), ['farm_tower_board_v1', 'farm_tower_floor_v1', 'farm_tower_week_prize_v1']);
  fns.forEach((m) => {
    const body = live.slice(live.indexOf(m[0])).split(/\$\$;/)[0];
    assert.match(body, /set search_path = ''/, m[2] + ': an empty search_path');
    if (m[1] === 'public') {
      assert.match(m[2], /^farm_[a-z_]{1,40}_v1$/, 'a name the bridge allows');
      assert.match(body, /security definer/);
      assert.match(body, /uid uuid := farm\.me\(\)/, m[2] + ': signed in and joined');
      assert.ok(new RegExp('revoke all on function[^;]*public\\.' + m[2] + '\\([^;]*from public, anon, authenticated').test(live), m[2] + ' revoked');
      assert.ok(new RegExp('grant execute on function[^;]*public\\.' + m[2] + '\\([^;]*to authenticated').test(live), m[2] + ' for players');
    } else assert.ok(new RegExp('revoke all on function[^;]*farm\\.' + m[2] + '\\(').test(live), 'farm.' + m[2] + ': no client calls it');
  });
  [...live.matchAll(/create table if not exists (farm\.[a-z_]+)/g)].forEach((m) => {
    assert.ok(live.includes('alter table ' + m[1] + ' enable row level security'), m[1] + ': RLS on');
    assert.ok(new RegExp('revoke all on table[^;]*' + m[1].replace('.', '\\.') + '\\b').test(live), m[1] + ': revoked');
  });
  assert.match(SQL, /Asia\/Manila/);
  assert.match(SQL, /pg_advisory_xact_lock/);
  assert.match(SQL, /-- ---------- to undo ----------/);
});

test('a new floor waits to be sent: only the first clear of each floor, once, in the save', () => {
  const s = fresh();
  assert.deepStrictEqual(plain(s.twr), { q: [], out: null, paid: [] });
  assert.ok(!('twr' in L.serialize(s)), 'nothing saved while empty');
  L.towerPay(s, 1);
  L.towerPay(s, 2);
  L.towerPay(s, 2); // (cleared before: nothing new)
  L.towerTeamPay(s, 3, 1); // (with a team: new to you)
  L.towerTeamPay(s, 1, 1); // (helping on a floor you cleared)
  assert.deepStrictEqual(plain(s.twr.q), [1, 2, 3]);
  assert.strictEqual(s.pearls, 1 + 1 + 1 + 1, '(the Pearls as before: 3 floors and a helper Pearl)');
  assert.strictEqual(L.towerBoardAdd(s, 0), false);
  assert.strictEqual(L.towerBoardAdd(s, 1001), false);
  assert.strictEqual(L.towerBoardAdd(s, 2.5), false);
  assert.strictEqual(L.towerBoardAdd(s, 3), false, 'already waiting');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.twr.q), [1, 2, 3]);
  assert.strictEqual(L.towerRec(back).cl, 3, 'the Tower\'s own save is untouched');
  // the queue keeps the newest
  for (let f = 4; f <= 400; f++) L.towerBoardAdd(s, f);
  assert.strictEqual(s.twr.q.length, BD.queue);
  assert.strictEqual(s.twr.q[s.twr.q.length - 1], 400);
});

test('sending: the same send until answered; the floors the server took go, the rest wait (today\'s cap)', () => {
  const s = fresh();
  for (let f = 1; f <= 60; f++) L.towerBoardAdd(s, f);
  const a = L.towerBoardTake(s);
  assert.strictEqual(a.f.length, BD.perSend);
  assert.match(a.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.deepStrictEqual(plain(L.towerBoardTake(s)), plain(a), 'not answered: the same id and floors');
  assert.deepStrictEqual(plain(roundTrip(s).twr.out), plain(a), 'the unanswered send is saved, id and all');
  assert.strictEqual(L.towerBoardWaiting(s), 60);
  assert.strictEqual(L.towerBoardSent(s, 'another-id', a.f), 0, 'an answer to another send: nothing');
  // the server took 1-40 (the cap is full after 40): 41-50 wait at the front
  assert.strictEqual(L.towerBoardSent(s, a.id, a.f.slice(0, 40)), 40);
  assert.strictEqual(s.twr.out, null);
  assert.deepStrictEqual(plain(s.twr.q), [41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
  const b = L.towerBoardTake(s);
  assert.notStrictEqual(b.id, a.id, 'a new send, a new id');
  L.towerBoardSent(s, b.id, b.f);
  assert.strictEqual(L.towerBoardWaiting(s), 0);
  assert.strictEqual(L.towerBoardTake(s), null);
});

test("Manila's week: Monday 00:00 to Monday 00:00, Philippine time; the days left", () => {
  assert.strictEqual(L.towerWeek(manila(2026, 11, 12, 10)).key, '2026-11-09'); // (a Thursday)
  assert.strictEqual(L.towerWeek(manila(2026, 11, 15, 23, 59)).key, '2026-11-09', 'Sunday night is still the same week');
  assert.strictEqual(L.towerWeek(manila(2026, 11, 16, 0, 0)).key, '2026-11-16', 'Monday midnight in Manila (Sunday 4 PM UTC)');
  assert.strictEqual(L.towerWeek(manila(2026, 11, 9, 0, 0)).next, manila(2026, 11, 16, 0, 0));
  assert.strictEqual(L.towerWeekLeft(manila(2026, 11, 12, 10)), 4);
  assert.strictEqual(L.towerWeekLeft(manila(2026, 11, 15, 23, 0)), 1);
  assert.strictEqual(L.towerWeekLeft(manila(2026, 11, 16, 0, 0)), 7);
});

test("last week's prize: the places' Pearls; a claim pays once by its id, never twice", () => {
  assert.deepStrictEqual([1, 2, 3, 4, 10].map((r) => L.towerPrizeFor(r, 20)), [300, 200, 150, 50, 50]);
  assert.deepStrictEqual([L.towerPrizeFor(0, 12), L.towerPrizeFor(11, 12), L.towerPrizeFor(0, 9), L.towerPrizeFor(1, 0)], [10, 10, 0, 0]);
  const s = fresh();
  s.pearls = 5;
  const claim = { ok: true, id: ID, week: '2026-11-02', rank: 2, floors: 30, pearls: 200, frame: 'silver', title: null, again: false };
  assert.strictEqual(L.towerPrizePay(s, claim), 200);
  assert.strictEqual(L.towerPrizePay(s, Object.assign({}, claim, { again: true })), 0, 'asked again: the same id, nothing more');
  assert.strictEqual(L.towerPrizePay(roundTrip(s), Object.assign({}, claim, { id: ID.toUpperCase() })), 0, 'after a reload too');
  assert.strictEqual(s.pearls, 205);
  [null, 'x', { ok: false, code: 'none' }, { ok: true, pearls: 10 }, { ok: true, id: 'not-an-id', pearls: 10 }, { ok: true, id: ID.replace('0f', '1f'), pearls: 0 }]
    .forEach((c) => assert.strictEqual(L.towerPrizePay(s, c), 0));
  assert.strictEqual(L.towerPrizePay(s, { ok: true, id: ID.replace('0f', '2f'), pearls: 1e9 }), 1000, 'never more than 1,000 in one claim');
  const back = roundTrip(s);
  assert.deepStrictEqual(plain(back.twr.paid), [ID, ID.replace('0f', '2f')]);
});

test('the lighthouse wall: the ten bosses\' firsts from the Hall\'s answer, "That\'s you!", ??? for a boss not reached; offline and reading', () => {
  const s = fresh();
  L.towerRec(s).deep = 150;
  const data = { firsts: [{ key: 'tower_100', id: 'u1', name: 'Ana <b>' }, { key: 'bakunawa', id: 'u2', name: 'Ben' }, { key: 'tower_300', id: 'me', name: null }] };
  const rows = L.towerWallRows(data, 'me', s).map((r) => r[1]);
  assert.strictEqual(rows.length, 10, '(one page with the Champion\'s line and the buttons)');
  assert.match(rows[0], /^Floor 100, Tambanakua: Ana/);
  assert.strictEqual(rows[1], 'Floor 200, ???: nobody yet.');
  assert.strictEqual(rows[2], "Floor 300, Berberoka: Farmer  That's you!", 'a name hidden from you: Farmer; beaten, the boss is named');
  assert.strictEqual(rows[9], 'Floor 1000, ???: nobody yet.');
  assert.match(L.towerWallRows(null, 'me', s)[0][1], /Join online play/);
  assert.strictEqual(L.towerWallRows(false, 'me', s)[0][1], C.HALL.loading);
  assert.strictEqual(L.towerWallRows('soon', 'me', s)[0][1], C.HALL.later);
});

test('the board\'s answer, checked: top 10, your line, last week\'s Champion; junk refused', () => {
  const top = Array.from({ length: 12 }, (_, i) => ({ rank: i + 1, id: 'u' + i, name: 'P' + i, floors: 100 - i }));
  const b = L.towerBoardShape({ week: '2026-11-09', top, me: { floors: 7, rank: 33 }, champ: { id: 'me', name: 'Ana', floors: 40 } }, 'me');
  assert.strictEqual(b.top.length, 10);
  assert.deepStrictEqual(plain(b.top[0]), { rank: 1, id: 'u0', name: 'P0', floors: 100, you: false });
  assert.deepStrictEqual(plain(b.me), { rank: 33, floors: 7 });
  assert.deepStrictEqual(plain(b.champ), { id: 'me', name: 'Ana', floors: 40, you: true });
  assert.strictEqual(b.week, '2026-11-09');
  const j = L.towerBoardShape({ top: [null, 5, { id: 'x', name: '', floors: 'lots' }], me: 'x', champ: { name: 'no id' }, week: 'DROP' }, null);
  assert.deepStrictEqual(plain(j), { week: '', top: [{ rank: 1, id: 'x', name: 'Farmer', floors: 0, you: false }], me: { rank: 0, floors: 0 }, champ: null });
  assert.strictEqual(L.towerBoardShape(null), null);
});

test('the save: a broken twr is cleaned; an old save without it is fine; other keys untouched', () => {
  const s = fresh();
  const o = L.serialize(s);
  o.twr = { q: [1, 1, 'x', 0, 5000, 7], o: ['nope', 3], p: [ID, 'junk', 4] };
  const back = L.deserialize(JSON.parse(JSON.stringify(o)));
  assert.deepStrictEqual(plain(back.twr), { q: [1, 7], out: null, paid: [ID] });
  const old = L.serialize(fresh());
  delete old.twr;
  assert.deepStrictEqual(plain(L.deserialize(old).twr), { q: [], out: null, paid: [] });
  const t = fresh();
  L.towerPay(t, 1);
  const keys = Object.keys(L.serialize(t));
  assert.ok(keys.includes('twr') && keys.includes('tw2') && keys.includes('prl'));
});
