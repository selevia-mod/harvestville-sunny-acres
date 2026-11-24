// A busy phone (--slow, --only slow): the page's CPU 5 times slower, and now and then a frame of 120-400 ms with nothing
// drawn (page.js opts.slow). On it: Manila's jeepney and calesa with you standing in the road ahead of them (held for
// you, they must never creep into you, and a long frame must never jump them through you: fixed in fcdd93e), random
// play in Manila, on the farm and in town, and the reach check (real finger drags on a slow phone).
const path = require('path');
const { open, go } = require('./page');
const { randomPlay } = require('./checks');
const { reach } = require('./reach');

const RATE = 5;

// Stand in the road where the vehicle will be in 1.5 s, and watch it for `secs` real seconds of real frames.
const watchVehicle = (page, kind, secs) => page.evaluate(([kind, secs]) => new Promise((done) => {
  const w = Farm.world, L = Farm.Logic, M = Farm.Config.MANILA, T = Farm.Config.TILE;
  const at = kind === 'jeep' ? L.jeepAt : L.calesaAt;
  const v = () => (kind === 'jeep' ? w.mn && w.mn.jeep : w.mn && w.mn.cal);
  const moving = (s) => s && s.on && (kind === 'jeep' ? s.stop < 0 : !s.stop);
  const drives = (t) => { for (let k = 0; k <= 9000; k += 200) if (!moving(at(t + k))) return false; return true; };
  // the vehicle's clock moved on to a stretch where it drives (the e2e tests do the same: M.jeepNow)
  let off = 0;
  const real = Date.now();
  while (!drives(real + off) && off < 6 * 3600e3) off += 500;
  if (off >= 6 * 3600e3) return done({ skip: 'it never drives' });
  M.jeepNow = () => Date.now() + off;
  const p = at(Date.now() + off + 1500);
  w.setFeet(p.x * T, p.y * T + 64);
  if (w.player.body) w.player.body.setVelocity(0, 0);
  let min = 1e9, held = false, frames = 0, longest = 0, lastT = performance.now();
  const t0 = performance.now();
  const step = () => {
    const now = performance.now();
    longest = Math.max(longest, now - lastT); lastT = now; frames++;
    const vv = v();
    if (vv && vv.at) {
      const f = w.feet();
      min = Math.min(min, Math.hypot(vv.at.x * T - f.x, vv.at.y * T - f.y));
      if (vv.held) held = true;
    }
    if (now - t0 < secs * 1000) requestAnimationFrame(step);
    else { delete M.jeepNow; done({ min: Math.round(min), held, frames, longest: Math.round(longest), secs }); }
  };
  requestAnimationFrame(step);
}), [kind, secs]);

async function slowPhone(browser, out, opts = {}) {
  const results = [];
  const found = [];
  const did = [];
  // 1. Manila's jeepney and calesa, you in the road
  {
    const { page, problems, context } = await open(browser, { slow: RATE, seeded: true });
    if (!(await go(page, 'manila'))) found.push({ what: 'Could not get to Manila', where: 'Slow phone: Manila' });
    else for (const kind of ['jeep', 'calesa']) for (let k = 0; k < (opts.quick ? 1 : 3); k++) {
      const from = problems.length;
      const r = await watchVehicle(page, kind, 8);
      if (r.skip) { found.push({ what: 'Not checked: the ' + kind + ' ' + r.skip, where: 'Slow phone: Manila' }); break; }
      did.push(kind + ' ' + r.frames + ' frames (longest ' + r.longest + ' ms), closest ' + (r.min / 256).toFixed(1) + ' tiles');
      const where = 'Slow phone: Manila, standing in the ' + (kind === 'jeep' ? 'jeepney' : 'calesa') + '\'s road (try ' + (k + 1) + ')';
      const list = problems.slice(from).map((p) => ({ what: p, where }));
      if (r.min < 0.6 * 256) list.push({ what: 'The ' + (kind === 'jeep' ? 'jeepney' : 'calesa') + ' came into you: its middle ' + (r.min / 256).toFixed(2) + ' tiles from you (held for you: ' + (r.held ? 'yes' : 'no') + '; longest frame ' + r.longest + ' ms)', where });
      if (list.length) {
        const pic = path.join(out, ('slow-manila-' + kind + '-' + k) + '.png');
        await page.screenshot({ path: pic });
        list.forEach((p) => { p.pic = pic; });
        found.push(...list);
      }
    }
    await context.close();
  }
  results.push({ name: 'Slow phone: Manila\'s jeepney and calesa', did: did.length ? did.join('; ') : 'nothing watched', problems: found });
  // 2. random play
  results.push(await randomPlay(browser, out, opts.quick ? 40 : 120, { maps: ['manila', 'farm', 'town'], slow: RATE, name: 'Slow phone: random play' }));
  // 3. reach: Decorate dragged with a finger, and walking in Manila, on a slow phone
  const r = await reach(browser, out, { slow: RATE, maps: ['manila', 'farm'] });
  r.name = 'Slow phone: reach every part of the map';
  results.push(r);
  return results;
}

module.exports = { slowPhone };
