// What the robot check's new looks found (24 Nov 2026; owner: "we really need hunting bugs ... I cant test it alone"):
//   1 "What to sell?" scrolled to its end: a tile half under the filter row took the tap meant for "All" (and opened that
//     tile's sale): a row half out of view takes taps only on its part in view (19i-look.js scrollList)
//   2 fishing ("Reel it in!") closed with every other panel: the game went on drawing its meter, already gone
//     ("Cannot read properties of null (reading 'setSize')"): the fish gets away and the game stops (16-games.js)
//   3 town's bottom-right beach corner: the farmer stood under the round action button (11-world.js clearOfAction)
// Run alone, after node build.js: node --test --test-concurrency=1 test/e2e-robot-finds.test.js   (SHOTS=/some/dir;
// HV_DIST=<a dist/index.html> checks another build)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(process.env.HV_DIST || path.join(__dirname, '..', 'dist', 'index.html'));
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };

let browser;
// (Playwright's own Chromium, or the Mac's Chrome when it is missing: headless, an empty profile, the network blocked below)
test.before(async () => { browser = await chromium.launch().catch(() => chromium.launch({ channel: 'chrome' })); });
test.after(async () => { await browser.close(); });

async function open(savedState) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text()); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
    problems.push('network: ' + url);
    return route.abort();
  });
  await page.addInitScript((state) => {
    window.gameHost = { state: state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } };
  }, savedState || null);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState(); // eslint-disable-line no-unused-vars
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; s.goal = 99; s.wv = C.NEWS_LATEST; s.name = 'Selene';
    eval(edit || ''); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit);
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
// a point of the UI's own world, on the page (the UI camera, then the canvas on the page)
const uiToPage = (page, x, y) => page.evaluate(([x, y]) => {
  const uc = Farm.ui.cameras.main, ow = uc.width * uc.originX, oh = uc.height * uc.originY, z = uc.zoom;
  const sx = uc.x + ow + (x - uc.scrollX - ow) * z, sy = uc.y + oh + (y - uc.scrollY - oh) * z;
  const cv = Farm.ui.game.canvas, r = cv.getBoundingClientRect(), gw = Farm.ui.game.scale.width, gh = Farm.ui.game.scale.height;
  return { x: r.left + sx * r.width / gw, y: r.top + sy * r.height / gh };
}, [x, y]);

test('1: "What to sell?" scrolled to its end: tapping "All" keeps the list (no tile under the filter row takes it)', async () => {
  // a bag of many different things that sell: more tiles than fit
  const save = await makeSave("const ids = Object.keys(C.ITEMS).filter((id) => L.basePrice(id) && !C.ITEMS[id].tool).slice(0, 30); s.bagLevel = 9; s.inv = ids.map((id) => ({ id: id, n: 7 })).slice(0, Math.max(24, s.inv.length));");
  const { page, problems, context } = await open(save);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openSellPicker(null));
  await page.waitForTimeout(400);
  const n = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; if (m.c.slimAll) m.c.slimAll(); m.c.slimScroll(-1e9); return Farm.ui.modals.length; });
  assert.strictEqual(n, 1);
  await frames(page, 3);
  const all = await page.evaluate(() => {
    const found = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === 'All') found.push(o); if (o.list) walk(o.list); });
    walk(Farm.ui.modals[0].c.list);
    const b = found[0].getBounds();
    return { x: b.centerX, y: b.centerY + 2 };
  });
  await shot(page, '1-sell-list-end');
  const p = await uiToPage(page, all.x, all.y);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => {
    const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    Farm.ui.modals.forEach((m) => walk(m.c.list));
    return { modals: Farm.ui.modals.length, text: out.join(' | ') };
  });
  await shot(page, '1-after-tapping-all');
  assert.strictEqual(after.modals, 1, 'no sale opened: ' + after.text.slice(0, 200));
  assert.match(after.text, /What to sell\?/);
  assert.ok(!/You have \d+/.test(after.text), 'no "You have" sale window');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('2: fishing closed with every other panel: the fish gets away, nothing breaks', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => { window.__fished = []; Farm.ui.startFishGame('fish_s', (ok) => window.__fished.push(ok)); });
  await frames(page, 10);
  assert.ok(await page.evaluate(() => !!Farm.ui.game2), 'fishing');
  await page.evaluate(() => Farm.ui.closeAll());
  await frames(page, 20);
  const seen = await page.evaluate(() => ({ fished: window.__fished, game: !!Farm.ui.game2 }));
  assert.deepStrictEqual(seen, { fished: [false], game: false });
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('3: town\'s bottom-right beach corner: the farmer shows clear of the action button', async () => {
  const save = await makeSave("s.map = 'town';");
  const { page, problems, context } = await open(save);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.world.mapKey === 'town', null, SLOW);
  const map = await page.evaluate(() => ({ w: Farm.world.map.width, h: Farm.world.map.height }));
  const seen = [];
  for (const [tx, ty] of [[map.w - 2, map.h - 3], [map.w - 2, map.h - 2], [map.w - 1, map.h - 2], [map.w - 1, map.h - 3]]) {
    await page.evaluate(([tx, ty]) => { const w = Farm.world; w.setFeet(tx * 256 + 128, ty * 256 + 180); w.dir = 'down'; w.idle(); w.updateCamera(1); }, [tx, ty]);
    await frames(page, 4);
    seen.push(await page.evaluate(([tx, ty]) => {
      const w = Farm.world, cam = w.cameras.main, b = w.player.getBounds(), a = Farm.ui.actionBtn, uc = Farm.ui.cameras.main;
      const ow = cam.width * cam.originX, oh = cam.height * cam.originY, z = cam.zoom, mid = cam.midPoint;
      const sx = (x) => cam.x + ow + (x - mid.x) * z, sy = (y) => cam.y + oh + (y - mid.y) * z;
      const uow = uc.width * uc.originX, uoh = uc.height * uc.originY, uz = uc.zoom;
      const bx = uc.x + uow + (a.x - uc.scrollX - uow) * uz, by = uc.y + uoh + (a.y - uc.scrollY - uoh) * uz, br = 42 * uz;
      // the farmer's box on the screen against the button's circle: the nearest point of the box to the circle's centre
      const nx = Math.max(sx(b.left), Math.min(bx, sx(b.right))), ny = Math.max(sy(b.top), Math.min(by, sy(b.bottom)));
      return { tile: [tx, ty], gap: Math.round(Math.hypot(nx - bx, ny - by) - br) };
    }, [tx, ty]));
  }
  await shot(page, '3-town-corner');
  for (const s of seen) assert.ok(s.gap > 0, 'clear of the button: ' + JSON.stringify(seen));
  assert.deepStrictEqual(problems, []);
  await context.close();
});
