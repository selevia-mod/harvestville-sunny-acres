// A made-up farm as this phone lays it out passes the game server's placement check (L.frGhostPlaced, security check
// 23 Nov 2026), for every tier and level, over many seeds: an honest made-up raid is never refused. And a forged copy
// (every defense parked off the map, the loot on the drop zone) is refused.
// Run alone, after node build.js: node --test --test-concurrency=1 test/e2e-ghost-placed.test.js
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.join(process.env.DIST || path.resolve(__dirname, '..', 'dist'), 'index.html');
const SLOW = { timeout: 90000 };
// test/net-mock.js's farm.fraid_ghost_spec (SQL part 28): the same numbers from the same seed and power
const NAMES = ['jhayvee', 'Kuya Ron', 'mikaela_07', 'AngelBee', 'rosalyn22'];
const frGhost = (seed, mine) => { const s = Math.abs(seed | 0) || 1, pw = Math.max(10, (mine | 0) + (s % 21) - 10), tier = Math.min(3, [0, 60, 120, 200].filter((t) => t <= pw).length - 1);
  return { seed: s, name: NAMES[s % NAMES.length], look: Math.floor(s / 7) % 2 ? 'girl' : 'boy', power: pw, tier, lv: Math.min(5, 1 + Math.floor(pw / 60)), value: Math.min(5000, Math.max(400, pw * 15)), home: Math.min(10, 2 + tier * 2 + (s % 2)) }; };

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

test('every made-up farm this phone lays out passes the server check; a forged one does not', { timeout: 600000 }, async () => {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await page.route('**/*', (route) => { const u = route.request().url(); return u.startsWith('file:') || u.startsWith('data:') ? route.continue() : route.abort(); });
  await page.addInitScript(() => { window.gameHost = { state: null, quiet: true, save(s) { this.state = s; } }; });
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());

  const specs = [];
  for (const mine of [10, 70, 130, 210, 300]) for (const seed of [1, 7, 13, 29, 4242, 9001]) specs.push(frGhost(seed, mine));
  const seen = new Set();
  for (const g of specs) {
    // as ghostStart does (19zzz...-farm-raids-real.js), without the server: the layout, then the world builds it
    await page.evaluate((g) => {
      const F = Farm, L = F.Logic, mine = F.session.state, loot = L.frGhostLoot(g), b = { key: 'ghost', defs: L.frGhostDefs(g), lv: g.lv, loot };
      if (F.world && F.world.raidB) F.world.raidB = null;
      const st = L.banditLayout(b, mine, (g.seed | 0) || 1);
      const lv = {};
      F.Config.FRAID.defenseOrder.forEach((k) => { lv[k] = g.lv; });
      F.session.raid = { kind: 'ghost', raid: 'x', ghost: g, cap: 0.3, seed: 77, army: { goat: { n: 4, lv: 1 } }, cut: L.clock(), gold: loot.gold, stall: loot.stall, produce: loot.produce, levels: lv };
      F.session.visit = { host: 'raid', name: g.name, state: st, raid: true, liked: false, gift: null, friend: false, likes: 0, beauty: 0 };
      F.ui.closeAll();
      F.Online.restartWorld();
    }, g);
    await page.waitForFunction(() => Farm.session.raid && Farm.session.raid.copy && Farm.world && Farm.world.raidB, null, SLOW);
    const why = await page.evaluate((g) => Farm.Logic.frGhostOk(Farm.session.raid.copy, g), g);
    assert.strictEqual(why, '', 'tier ' + g.tier + ' lv ' + g.lv + ' seed ' + g.seed + ': ' + why);
    seen.add(g.tier);
    await page.evaluate(() => { Farm.session.raid = null; Farm.session.visit = null; Farm.world.raidB = null; Farm.Online.restartWorld(); });
    await page.waitForFunction(() => Farm.world && Farm.world.player && !Farm.session.visit, null, SLOW);
  }
  assert.deepStrictEqual([...seen].sort(), [0, 1, 2, 3], 'every tier');

  // the forged farm from the security check: refused
  const forged = await page.evaluate(() => {
    const L = Farm.Logic, g = { seed: 7, tier: 3, lv: 5, value: 5000 }, want = L.frGhostDefs(g), defs = [], loot = [], w = 16, h = 22;
    Object.keys(want).forEach((t) => { for (let i = 0; i < want[t]; i++) defs.push({ t, x: 900 + i, y: 900, lv: 5 }); });
    for (let i = 0; i < 12; i++) loot.push({ kind: 'crops', x: i, y: 0, n: 30 });
    const off = L.frGhostOk({ w, h, solid: '0'.repeat(w * h), drop: '1'.repeat(w * h), defs, loot }, g);
    // on the map but far from the loot, and more loot than its numbers
    const far = defs.map((d, i) => ({ t: d.t, x: 15, y: 21 - (i % 3), lv: 5 }));
    const near = [{ kind: 'crops', x: 0, y: 0, n: 1 }];
    const big = [{ kind: 'gold', x: 1, y: 1, n: 999999 }];
    return { off, far: L.frGhostOk({ w: 40, h: 38, solid: '0'.repeat(40 * 38), drop: '1'.repeat(40 * 38), defs: far.map((d) => Object.assign({}, d, { x: 39, y: 37 })), loot: near }, g),
      big: L.frGhostOk({ w: 40, h: 38, solid: '0'.repeat(40 * 38), drop: '1'.repeat(40 * 38), defs: far.map((d) => Object.assign({}, d, { x: 2, y: 2 })), loot: big }, g),
      huge: L.frGhostOk({ w: 120, h: 120, solid: '0'.repeat(14400), drop: '1'.repeat(14400), defs: far, loot: near }, g) };
  });
  assert.strictEqual(forged.off, 'place', 'defenses off the map');
  assert.strictEqual(forged.far, 'place', 'defenses far from the loot');
  assert.strictEqual(forged.big, 'loot', 'more loot than its numbers');
  assert.strictEqual(forged.huge, 'size', 'no farm is that big');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
