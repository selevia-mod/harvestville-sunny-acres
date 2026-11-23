// The Race Day server file (supabase/farm_race_day.sql: written, not applied) against the game's own numbers (C.RACE_DAY,
// L.rdStart): if one changes, the other must too (owner, 24 Nov 2026: the server picks the winners and takes the bets).
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
const RD = C.RACE_DAY;
const SQL = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'farm_race_day.sql'), 'utf8');
const body = SQL.split('-- STEP 3')[0].split('\nbegin;')[1];

test('the server\'s race times are the game\'s: 96 a day from 6 AM Manila, every 10 minutes', () => {
  assert.strictEqual(RD.perDay, 96);
  const m = /select \(p_n \/ (\d+)\) \* 86400000 \+ \((\d+) \+ \(p_n % (\d+)\) \* (\d+)\) \* 60000 - 28800000/.exec(body);
  assert.ok(m, 'the start formula');
  assert.deepStrictEqual(m.slice(1).map(Number), [RD.perDay, RD.first, RD.perDay, RD.every]);
  const start = (n) => Math.floor(n / 96) * 86400000 + (360 + (n % 96) * 10) * 60000 - 28800000;
  for (const n of [0, 1, 95, 96, 197, 1994425, 1994496, 2000000]) assert.strictEqual(start(n), L.rdStart(n), 'race ' + n);
});

test('the server\'s bet rules are the game\'s', () => {
  assert.match(body, new RegExp('t >= st - ' + RD.closeMs + ' or t < st - ' + RD.every * 60000));
  assert.match(body, new RegExp('farm\\.race_start_ms\\(p_n\\) \\+ ' + RD.resultMs + '\\b'));
  assert.match(body, new RegExp('p_a < ' + RD.min + ' then'));
  assert.match(body, new RegExp('p_a > ' + RD.max + ' then'));
  assert.match(body, new RegExp('staked \\+ p_a > ' + RD.day + ' then'));
  assert.match(body, new RegExp('check \\(a between ' + RD.min + ' and ' + RD.max + '\\)'));
  assert.match(body, /b\.n \/ 96 = p_n \/ 96/, 'the daily limit by the race\'s own Manila day');
});

test('the SQL file: not applied, one transaction, players only, the secret unreadable, nothing dropped above the undo', () => {
  assert.match(SQL, /NOT APPLIED/);
  assert.match(body, /set local lock_timeout = '5s';/);
  assert.match(body, /notify pgrst, 'reload schema';/);
  assert.ok(!/\bdrop (table|function)\b/.test(body.replace(/^--.*$/gm, '')), 'nothing dropped above the undo');
  ['farm_race_v1', 'farm_race_bet_v1', 'farm_race_settle_v1'].forEach((f) => {
    assert.match(body, new RegExp('create or replace function public\\.' + f + '\\([^)]*\\)\\s*returns jsonb language plpgsql (stable|volatile) security definer set search_path = \'\''));
    assert.match(body, new RegExp('grant execute on function public\\.' + f + '\\([^)]*\\) to authenticated;'));
    assert.match(body, new RegExp('revoke all on function public\\.' + f + '\\([^)]*\\) from public, anon;'));
  });
  assert.ok(!/to anon/.test(body), 'never to anon');
  assert.match(body, /revoke all on table farm\.race_secret from public, anon, authenticated/);
  assert.match(body, /revoke all on table farm\.race_bets from public, anon, authenticated/);
  assert.match(body, /if auth\.uid\(\) is null then raise exception/);
});
