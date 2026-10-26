// A clock the tests control. The game reads the time from window.gameHost.now() when there is one
// (L.clock in src/01-logic.js), so the tests can set any date and move time on.
//   const clock = makeClock(ctx);  clock.set(2026, 4, 1, 10, 0);  clock.advance(90);  clock.nextDay(L, s);
module.exports = function makeClock(ctx, start) {
  const c = {
    ms: 0,
    // a local date and time (month 1-12)
    set(y, mo, d, h = 10, mi = 0) { c.ms = new Date(y, mo - 1, d, h, mi).getTime(); return c; },
    advance(mins) { c.ms += mins * 60000; return c; },
    min() { return Math.floor(c.ms / 60000); },
    // to the next morning (or `hour` o'clock), and the farm catches up with the days that went by
    nextDay(L, s, info, hour = 8) {
      const d = new Date(c.ms);
      c.ms = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, hour, 0).getTime();
      return L.catchUp(s, c.ms, info);
    },
  };
  ctx.window.gameHost = { now: () => c.ms };
  const s = start || [2026, 4, 1]; // a spring day (April 1st 2026, a Wednesday) unless a test says otherwise
  c.set(s[0], s[1], s[2], 10, 0);
  return c;
};
