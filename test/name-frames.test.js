// Unit tests for name frames (src/00-zzzzzzzzzzzzzzzzzzzzzzzzzz-name-frames.js, src/01-logicZZZZZZZZZZZZZZZZZZZZZZ-name-frames.js)
// and the server part's shape (supabase/farm_name_frames.sql, the owner's ~/Downloads/name-frames-SQL/APPLY-name-frames.sql).
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
const NF = C.NAME_FRAMES;
const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_name_frames.sql'), 'utf8');
const plain = (x) => JSON.parse(JSON.stringify(x));
const id = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const BOSSES = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000].map((f) => 'tower_' + f);

test('the frames: the 10 boss frames in floor order, then gold, silver, bronze (the picture sheet\'s order); each realm\'s colours', () => {
  assert.deepStrictEqual(plain(NF.keys), BOSSES.concat(['gold', 'silver', 'bronze']));
  assert.ok(NF.keys.length <= NF.cols * NF.cols, 'fits the 4 x 4 sheet');
  C.TOWER.zones.forEach((z) => {
    const k = NF.looks['tower_' + z.to];
    assert.strictEqual(k.name, C.WILD.animals[z.boss].name + ' Frame');
    assert.strictEqual(k.plate, z.look.wall[1], 'the realm\'s colour');
    assert.strictEqual(k.rim, z.lava.hot[0], 'a thin bright rim');
  });
  NF.keys.forEach((k) => ['plate', 'deep', 'light', 'rim', 'gem'].forEach((c) => assert.match(NF.looks[k][c], /^#[0-9a-f]{6}$/, k + ' ' + c)));
  assert.strictEqual(NF.title, 'Lighthouse Champion');
  assert.deepStrictEqual([NF.cache, NF.most], [600000, 60]);
});

test('which frame: this week\'s board frame, else the newest boss frame; a pick still owned; none; a pick no longer owned falls back', () => {
  const own = { firsts: ['tower_300', 'tower_100'], week: 'gold' };
  assert.strictEqual(L.frameWear(own, 'auto'), 'gold', 'Auto: the board frame first');
  assert.strictEqual(L.frameWear({ firsts: ['tower_300', 'tower_100'], week: null }, 'auto'), 'tower_300', 'else the newest boss frame');
  assert.strictEqual(L.frameWear(own, 'tower_100'), 'tower_100', 'a pick they own');
  assert.strictEqual(L.frameWear(own, 'none'), null);
  assert.strictEqual(L.frameWear({ firsts: ['tower_100'], week: null }, 'gold'), 'tower_100', 'last week\'s gold, gone this week: Auto');
  assert.strictEqual(L.frameWear({ firsts: [], week: 'silver' }, 'tower_500'), 'silver', 'a boss frame lost (they left online play): Auto');
  assert.strictEqual(L.frameWear({ firsts: [], week: null }, 'auto'), null);
  assert.strictEqual(L.frameWear({ firsts: ['dragon', 'tower_200'], week: 'platinum' }, undefined), 'tower_200', 'junk ignored');
  assert.strictEqual(L.frameWear(null, 'gold'), null);
  assert.deepStrictEqual(plain(L.frameOwned(own)), ['gold', 'tower_100', 'tower_300'], 'the page\'s order: the week\'s, then floor order');
});

test('the server\'s answers, checked: known frames only, ids only, a title cleaned', () => {
  const rows = L.frameRows([
    { id: id(1).toUpperCase(), frame: 'gold', title: 'Lighthouse Champion' },
    { id: id(2), frame: 'tower_700', title: null },
    { id: 'not-an-id', frame: 'gold' }, null, 5,
    { id: id(3), frame: 'diamond', title: 42 },
  ]);
  assert.deepStrictEqual(plain(rows), {
    [id(1)]: { f: 'gold', t: 'Lighthouse Champion' }, [id(2)]: { f: 'tower_700', t: null }, [id(3)]: { f: null, t: null },
  });
  assert.deepStrictEqual(plain(L.frameRows({ ok: false, code: 'bad' })), {});
  const m = L.frameMine({ pick: 'tower_100', firsts: ['tower_300', 'tower_100', 'x'], week: 'bronze', title: null, until: '2026-11-16', wear: { frame: 'tower_100', title: null } });
  assert.deepStrictEqual(plain(m), { pick: 'tower_100', firsts: ['tower_300', 'tower_100'], week: 'bronze', title: null, until: '2026-11-16', owned: ['bronze', 'tower_100', 'tower_300'], wear: { f: 'tower_100', t: null } });
  assert.strictEqual(L.frameMine({ pick: 'evil' }).pick, 'auto');
  assert.strictEqual(L.frameMine(null), null);
  assert.strictEqual(L.frameMine([]), null);
});

test('the cache: each new player asked for once, in batches of 60; kept 10 minutes; an unanswered ask asked again after 30 s', () => {
  const c = L.frameCache();
  const ids = Array.from({ length: 130 }, (_, i) => id(i + 1));
  const b = L.frameAsk(c, ids.concat([ids[0], 'junk', null]), 1000);
  assert.deepStrictEqual(plain(b.map((x) => x.length)), [60, 60, 10], 'batches of 60, every id once');
  assert.deepStrictEqual(plain(L.frameAsk(c, ids, 2000)), [], 'asked and waiting: not again');
  L.frameGot(c, b[0], [{ id: ids[0], frame: 'gold', title: 'Lighthouse Champion' }], 3000);
  assert.deepStrictEqual(plain(L.frameOf(c, ids[0])), { f: 'gold', t: 'Lighthouse Champion' });
  assert.deepStrictEqual(plain(L.frameOf(c, ids[1])), { f: null, t: null }, 'asked, no row: no frame (known)');
  assert.strictEqual(L.frameOf(c, ids[70]), null, 'not answered yet: unknown');
  assert.deepStrictEqual(plain(L.frameAsk(c, ids.slice(0, 60), 3000 + NF.cache - 1)), [], 'answered: kept 10 minutes');
  assert.deepStrictEqual(plain(L.frameAsk(c, ids.slice(0, 2), 3000 + NF.cache)), [[ids[0], ids[1]]], 'then asked again');
  assert.deepStrictEqual(plain(L.frameAsk(c, ids.slice(60, 62), 1000 + NF.retry - 1)), []);
  assert.deepStrictEqual(plain(L.frameAsk(c, ids.slice(60, 62), 1000 + NF.retry)), [[ids[60], ids[61]]], 'no answer: asked again after 30 s');
  assert.deepStrictEqual(plain(L.frameOf(c, ids[0])), { f: 'gold', t: 'Lighthouse Champion' }, 'an old answer still shows while it is asked again');
  L.frameSet(c, ids[5], { f: 'tower_100', t: null }, 5000);
  assert.deepStrictEqual(plain(L.frameOf(c, ids[5].toUpperCase())), { f: 'tower_100', t: null }, 'our own, from a pick');
});

test('the SQL file: additive, safe twice, security definer with an empty search_path, players only, the undo at the bottom', () => {
  assert.match(SQL.split('\n')[0], /^-- Harvest Ville online: name frames/);
  assert.match(SQL, /Run AFTER the Tower's weekly board/);
  assert.match(SQL, /set local lock_timeout = '5s';/);
  assert.match(SQL, /notify pgrst, 'reload schema';/);
  const live = SQL.split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
  assert.ok(!/\b(drop|truncate|delete)\b/i.test(live.replace(/on delete cascade/g, '')), 'nothing dropped or deleted outside the undo');
  assert.ok(!/^create function/m.test(live) && !/^create table (?!if not exists)/m.test(live), 'create or replace, if not exists');
  assert.ok(!/alter table farm\.(players|hall_firsts|hall_first_keys|tower_week_claims)/.test(live), 'nothing that exists changes');
  assert.ok(!/(insert into|update) farm\.(players|hall_firsts|hall_first_keys|tower_week_claims)/.test(live), 'writes only its own table');
  const fns = [...live.matchAll(/create or replace function (public|farm)\.([a-z_0-9]+)\(/g)];
  assert.deepStrictEqual(fns.filter((m) => m[1] === 'public').map((m) => m[2]).sort(), ['farm_frame_pick_v1', 'farm_frames_mine_v1', 'farm_frames_v1']);
  fns.forEach((m) => {
    const body = live.slice(live.indexOf(m[0])).split(/\$\$;/)[0];
    assert.match(body, /set search_path = ''/, m[2] + ': an empty search_path');
    if (m[1] === 'public') {
      assert.match(m[2], /^farm_[a-z_]{1,40}_v1$/, 'a name the bridge allows');
      assert.match(body, /security definer/);
      assert.match(body, /uid uuid := farm\.me\(\)/, m[2] + ': signed in and joined');
      assert.ok(new RegExp('revoke all on function[^;]*public\\.' + m[2] + '\\([^;]*from public, anon, authenticated').test(live), m[2] + ' revoked');
      assert.ok(new RegExp('grant execute on function[^;]*public\\.' + m[2] + '\\([^;]*to authenticated').test(live), m[2] + ' for players');
    } else assert.ok(new RegExp('revoke all on function[^;]*farm\\.' + m[2] + '\\([^;]*from public, anon, authenticated').test(live), 'farm.' + m[2] + ': no client calls it');
  });
  assert.ok(!/grant[^;]*\bto (anon|public)\b/i.test(live), 'nothing for anon');
  [...live.matchAll(/create table if not exists (farm\.[a-z_]+)/g)].forEach((m) => {
    assert.strictEqual(m[1], 'farm.player_frames_choice');
    assert.ok(live.includes('alter table ' + m[1] + ' enable row level security'), m[1] + ': RLS on');
    assert.ok(new RegExp('revoke all on table[^;]*' + m[1].replace('.', '\\.') + '\\b[^;]*from public, anon, authenticated').test(live), m[1] + ': revoked');
  });
  const undo = SQL.indexOf('-- ---------- to undo ----------');
  assert.ok(undo > live.length / 2 && !/^[^-\n]/m.test(SQL.slice(undo)), 'the undo at the bottom, all commented out');
  assert.match(SQL.slice(undo), /drop function if exists public\.farm_frames_v1\(uuid\[\]\), public\.farm_frames_mine_v1\(\), public\.farm_frame_pick_v1\(text\)/);
  assert.match(SQL.slice(undo), /drop table if exists farm\.player_frames_choice;/);
});

test('the SQL\'s rules are the game\'s: 60 ids, the ten boss frames, the board\'s three, last week\'s claim, Auto then the pick', () => {
  assert.match(SQL, /cardinality\(p_ids\), 0\) > 60\b/);
  const bosses = SQL.match(/select array\[([^\]]+)\]/)[1].match(/'([a-z0-9_]+)'/g).map((s) => s.slice(1, -1));
  assert.deepStrictEqual(bosses, BOSSES);
  assert.deepStrictEqual(plain(C.HALL.FIRSTS.filter((f) => f.tower).map((f) => f.key)), BOSSES, 'the Hall\'s firsts');
  assert.match(SQL, /wk not in \('gold', 'silver', 'bronze'\)/);
  assert.deepStrictEqual(plain(C.TOWER_BOARD.frames), ['gold', 'silver', 'bronze']);
  assert.match(SQL, /c\.week = farm\.tower_week\(now\(\)\) - 7/, 'last week\'s claim (the week before this Manila week)');
  assert.match(SQL, /order by h\.at desc/, 'the newest boss frame first');
  assert.match(SQL, /f := coalesce\(o->>'week', o->'firsts'->>0\); -- \(Auto\)/, 'Auto: the week\'s, else the newest boss frame');
  assert.match(SQL, /if pick = 'none' then f := null;/);
  assert.match(SQL, /elsif pick is not null and pick <> 'auto' and \(pick = coalesce\(o->>'week', ''\) or \(o->'firsts'\) @> to_jsonb\(pick\)\) then f := pick;/, 'a pick only while owned');
  assert.match(SQL, /p_frame !~ '\^\[a-z0-9_\]\{1,20\}\$' or not \(p_frame in \('auto', 'none'\) or p_frame = coalesce\(o->>'week', ''\) or \(o->'firsts'\) @> to_jsonb\(p_frame\)\)/, 'a pick must be owned');
  assert.match(SQL, /not pl\.hidden and not farm\.blocked\(uid, pl\.user_id\)/, 'hidden and blocked players show none');
  assert.match(SQL, /'until', to_char\(farm\.tower_week\(now\(\)\) \+ 7, 'YYYY-MM-DD'\)/);
});
