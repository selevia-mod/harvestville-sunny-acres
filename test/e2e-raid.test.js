// The Town Raid end to end, alone (offline: no app, no server), in a phone-sized headless Chromium (owner, 6 Nov 2026).
// Run after a build: node --test test/e2e-raid.test.js (SHOTS=/some/dir saves screenshots). Taps are real taps; the
// farmer is moved next to a raider to keep it quick. The game's clock is window.gameHost.now (Manila times below).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const ACTION_BTN = { x: 294, y: 512 };
const manila = (y, mo, d, h, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, s);

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// (packs: the app's side of the packs, as e2e-farm-raids.test.js: the files in dist/packs, as the CDN would serve them)
const packFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file), p = m && path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp');
  return p && require('fs').existsSync(p) ? 'data:image/webp;base64,' + require('fs').readFileSync(p).toString('base64') : null;
};
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

async function open(state, now, packs) {
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
  await page.addInitScript(([state, now]) => {
    window.__now = now;
    // quiet keeps the daily popups away; raids: this test wants the raids (quiet alone keeps them off)
    window.gameHost = { state, quiet: true, raids: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [state || null, now]);
  if (packs) {
    await context.exposeBinding('__testAsset', (src, file) => packFile(file));
    await page.addInitScript((here) => { window.__here = here; }, require('fs').readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, '')));
    await page.addInitScript(HOST_ASSETS);
  }
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  if (!state) { // a new game: the look picker first
    await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
    await page.evaluate(() => Farm.ui.closeAll());
  }
  return { page, problems, context };
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const setNow = (page, ms) => page.evaluate((ms) => { window.__now = ms; }, ms);
const modalText = (page) => page.evaluate(() => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [];
  if (!m) return '';
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return out.join(' | ');
});
const waitModal = (page, re) => page.waitForFunction((src) => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [];
  if (!m) return false;
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return new RegExp(src).test(out.join(' | '));
}, re.source, SLOW);
const waitToast = (page, re) => page.waitForFunction((src) => Farm.ui.toastText.visible && new RegExp(src).test(Farm.ui.toastText.text), re.source, SLOW);
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c && o.parentContainer.visible) found.push(o.getBounds());
      if (o.list) walk(o.list);
    });
    walk(m.c.list);
    return found[0] && { x: found[0].centerX, y: found[0].centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}
const hold = async (page, id) => {
  await page.evaluate((id) => {
    const s = Farm.session.state;
    if (s.inv.findIndex((x) => x && x.id === id) < 0) Farm.Logic.addItem(s, id, 1);
    s.sel = s.inv.findIndex((x) => x && x.id === id);
    Farm.world.hintKey = null;
    Farm.bus.emit('hud');
  }, id);
  await frames(page);
};
// The farmer next to a raider that is not leaving (gap: tiles to its left), facing it. What the action button says.
const nextTo = (page, gap) => page.evaluate((gap) => {
  const w = Farm.world, T = Farm.Config.TILE, a = w.raiders.filter((x) => x.mode !== 'flee' && x.fade >= 1)[0];
  if (!a) return null;
  w.setFeet(a.x - gap * T, a.y);
  w.dir = 'right';
  w.idle();
  w.acting = 0;
  const act = w.resolve();
  return act ? { label: act.label, disabled: !!act.disabled, why: act.why || '' } : { label: '' };
}, gap);
const tapAction = async (page) => {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(380);
};
const raid = (page) => page.evaluate(() => Object.assign({}, Farm.session.state.raid));
const plant = (page, n) => page.evaluate((n) => {
  const s = Farm.session.state, w = Farm.world, W = w.map.width, L = Farm.Logic;
  const tiles = [];
  for (let y = 13; y < 15; y++) for (let x = 4; x < 4 + n / 2; x++) tiles.push(y * W + x);
  tiles.forEach((idx) => { delete s.debris[idx]; s.soil[idx] = { w: 1, c: 'turnip', p: L.nowMin() - 5, r: 0 }; });
  w.renderDebris && w.renderDebris();
  tiles.forEach((idx) => w.refreshTile(idx));
  w.setFeet(7.5 * 256, 12 * 256);
  return tiles.length;
}, n);
const crops = (page) => page.evaluate(() => Farm.Logic.raidCrops(Farm.session.state).length);

test('Town Raid alone: the countdown, the boars come at your crops, you drive them off with the Hoe (no energy), at most 2 crops lost, the results and your chest (owner, 6 Nov 2026)', async () => {
  const { page, problems, context } = await open(null, manila(2026, 11, 9, 19, 35));
  assert.strictEqual(await plant(page, 12), 12);

  // ----- 25 minutes before: a small chip in the left column counts down (no second bar), its word slides out beside it
  // (owner, 9 Nov 2026: the bar and the two-line notice took space)
  await page.waitForFunction(() => Farm.ui.raidBadge && Farm.ui.raidBadge.visible && !Farm.ui.raidBox.visible, null, SLOW);
  await page.waitForFunction(() => Farm.ui.raidNote && /Giant Boars in 2[45] min!/.test(Farm.ui.raidNote.list[1].text), null, SLOW);
  assert.match(await page.evaluate(() => Farm.ui.raidBadgeTime.text), /^2[45]:\d\d$/);
  assert.ok(!(await page.evaluate(() => Farm.ui.toastText.visible && /Town Raid in/.test(Farm.ui.toastText.text))), 'no big notice over the farm');
  // (9 Nov 2026, OPPO: Farm Raids once shared this bar's name and hid the whole HUD while it showed)
  await page.waitForTimeout(400);
  assert.ok(await page.evaluate(() => Farm.ui.goldText.visible && Farm.ui.energyText.visible), 'the HUD stays while the Town Raid countdown shows');
  assert.strictEqual(await page.evaluate(() => Farm.world.raiders.length), 0, 'nothing comes before it starts');
  await shot(page, 'raid-1-countdown');

  // ----- 8 PM: the card, centred; alone it says how to defend with everyone
  await setNow(page, manila(2026, 11, 9, 20, 0, 5));
  await waitModal(page, /TOWN RAID: GIANT BOAR STAMPEDE/);
  const card = await modalText(page);
  assert.match(card, /Giant boars are stampeding toward the fields/);
  assert.match(card, /Drive off 40 for your own chest\. Join online play to defend with everyone!/);
  assert.match(card, /at most 2 crops/);
  const box = await page.evaluate(() => { const m = Farm.ui.modals[0].c, b = m.getBounds(); return { cx: b.centerX }; });
  assert.ok(Math.abs(box.cx - 180) < 4, 'the card is centred');
  await shot(page, 'raid-2-start-card');
  await tapButton(page, 'Defend!');

  // ----- they come
  await page.waitForFunction(() => Farm.world.raiders.some((a) => a.mode !== 'flee' && a.fade >= 1), null, SLOW);
  assert.ok(await page.evaluate(() => Farm.world.raiders.every((a) => a.kind === 'boar')), 'Monday 9 Nov: boars');
  await page.waitForFunction(() => /Defend your farm · 0\/40/.test(Farm.ui.raidText.text), null, SLOW);
  await shot(page, 'raid-3-boars');

  // ----- Hit them with the Hoe: real taps on the action button. Hits use no energy.
  await hold(page, 'hoe');
  const energy = await page.evaluate(() => Farm.session.state.energy);
  let taps = 0, off = 0;
  for (let k = 0; k < 40 && (taps < 8 || !off); k++) {
    const act = await nextTo(page, 0.7);
    if (!act) { await page.waitForTimeout(400); continue; }
    assert.strictEqual(act.label, 'Hit', 'the action button says Hit next to a boar');
    const before = await page.evaluate(() => Farm.world.raiders.filter((a) => a.mode === 'flee').length);
    await tapAction(page);
    taps++;
    off += Math.max(0, (await page.evaluate(() => Farm.world.raiders.filter((a) => a.mode === 'flee').length)) - before);
  }
  assert.ok(off >= 1, 'a boar was chased off (3 hits)');
  const mid = await raid(page);
  assert.strictEqual(mid.h, taps, 'every tap was a hit');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.energy), energy, 'hits use no energy');
  await page.waitForFunction((n) => Farm.ui.raidText.text === 'Defend your farm · ' + n + '/40', taps, SLOW);
  await shot(page, 'raid-4-hits');

  // ----- left alone, they take crops: never more than 2 a raid
  await page.evaluate(() => { const k = Farm.Config.RAID.kinds.boar; k.eat = 0.5; k.every = [0.3, 0.6]; k.most = 6; }); // (quicker, for the test)
  await waitToast(page, /A boar trampled your Turnip!/);
  await page.waitForFunction(() => Farm.session.state.raid.l === 2, null, SLOW);
  await waitToast(page, /That is the most a raid can take/);
  await page.waitForTimeout(5000);
  assert.strictEqual((await raid(page)).l, 2);
  assert.strictEqual(await crops(page), 10, '12 crops, 2 lost, the rest safe');
  await shot(page, 'raid-5-two-lost');

  // ----- the farm's own goal (the rest of the 40 counted straight in, to save time)
  await page.evaluate(() => { const r = Farm.Logic.raidNow(); while (Farm.session.state.raid.h < 40) Farm.raid.hit(r); });
  await page.waitForFunction(() => /Defend your farm · 40\/40/.test(Farm.ui.raidText.text), null, SLOW);

  // ----- 8:31: the results, the chest
  const gold = await page.evaluate(() => Farm.session.state.gold);
  const had = await page.evaluate(() => ({ fert: Farm.Logic.countItem(Farm.session.state, 'fert'), arrows: Farm.Logic.countItem(Farm.session.state, 'arrows') }));
  await setNow(page, manila(2026, 11, 9, 20, 31));
  await waitModal(page, /RAID RESULTS/);
  const res = await modalText(page);
  assert.match(res, /You saved your farm from the Giant Boars! 40 hits\./);
  assert.match(res, /Farm Guard Chest: \+400G, 2 Fertilizer, 5 Arrows\./);
  assert.match(res, /The raid took 2 crops from your field\./);
  assert.match(res, /Join online play to defend with everyone/);
  await shot(page, 'raid-6-results');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.gold), gold + 400);
  assert.deepStrictEqual(await page.evaluate(() => ({ fert: Farm.Logic.countItem(Farm.session.state, 'fert'), arrows: Farm.Logic.countItem(Farm.session.state, 'arrows') })), { fert: had.fert + 2, arrows: had.arrows + 5 });
  await tapButton(page, 'OK');
  await page.waitForFunction(() => Farm.world.raiders.length === 0 && !Farm.ui.raidBox.visible, null, SLOW);
  const saved = await page.evaluate(() => window.gameHost.state);
  assert.deepStrictEqual(saved.rai.slice(0, 5), [20261109, 40, 0, 2, 1], 'saved: the raid, 40 hits, 2 lost, results shown');
  assert.deepStrictEqual(problems, []);
  await context.close();

  // ----- opened again later: no second chest, no raiders, nothing wrong
  const again = await open(saved, manila(2026, 11, 9, 20, 45));
  await again.page.waitForTimeout(3000);
  assert.strictEqual(await again.page.evaluate(() => Farm.ui.modals.length), 0, 'the results showed once');
  assert.strictEqual(await again.page.evaluate(() => Farm.world.raiders.length), 0);
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('Town Raid tools: the Bow shoots crows from 4 tiles, empty hands shoo them; sparks need the Watering Can (no arrows or energy used)', async () => {
  const { page, problems, context } = await open(null, manila(2026, 11, 12, 20, 2));
  await plant(page, 12);
  await waitModal(page, /TOWN RAID: CROW SWARM/);
  await tapButton(page, 'Defend!');
  await page.waitForFunction(() => Farm.world.raiders.some((a) => a.mode !== 'flee' && a.fade >= 1), null, SLOW);
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.addItem(s, 'arrows', 3); });
  await hold(page, 'bow');
  const arrows = await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows'));
  let act = await nextTo(page, 4);
  assert.strictEqual(act.label, 'Shoot', 'the Bow reaches a crow 4 tiles off');
  await shot(page, 'raid-7-crows');
  const fled = () => page.evaluate(() => Farm.world.raiders.filter((a) => a.mode === 'flee').length);
  const f0 = await fled();
  await tapAction(page);
  await page.waitForFunction((n) => Farm.world.raiders.filter((a) => a.mode === 'flee').length > n, f0, SLOW);
  assert.strictEqual((await raid(page)).h, 1, 'the arrow hit: one hit');
  assert.strictEqual(await page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'arrows')), arrows, 'no arrow used in a raid');
  // empty hands: Shoo
  await page.evaluate(() => { Farm.session.state.sel = Farm.session.state.inv.findIndex((x) => !x); Farm.world.hintKey = null; });
  await page.waitForFunction(() => Farm.world.raiders.some((a) => a.mode !== 'flee' && a.fade >= 1), null, SLOW);
  act = await nextTo(page, 0.6);
  assert.strictEqual(act.label, 'Shoo');
  await tapAction(page);
  assert.strictEqual((await raid(page)).h, 2, 'shooed: a second hit');

  // ----- Monday 16 Nov: sparks. The Hoe can't, the can douses them.
  await setNow(page, manila(2026, 11, 16, 20, 3));
  await waitModal(page, /RAID RESULTS/); // (Thursday's, alone: 2 hits, too few for a chest)
  assert.match(await modalText(page), /You landed 2 of the 40 hits/);
  await tapButton(page, 'OK');
  await waitModal(page, /TOWN RAID: LAVA BAKUNAWA'S SPARKS/);
  await tapButton(page, 'Defend!');
  // (four days went by: the farm's own "welcome back" report may come too)
  await page.waitForFunction(() => { if (Farm.ui.modals.length) Farm.ui.closeAll(); return Farm.world.raiders.some((a) => a.kind === 'spark' && a.mode !== 'flee' && a.fade >= 1); }, null, SLOW);
  await hold(page, 'hoe');
  act = await nextTo(page, 0.7);
  assert.deepStrictEqual([act.label, act.disabled, act.why], ['Douse', true, 'Sparks need water! Hold your Watering Can.']);
  await tapAction(page);
  await waitToast(page, /Sparks need water!/);
  await hold(page, 'can');
  const water = await page.evaluate(() => Farm.session.state.water);
  for (let k = 0; k < 2; k++) {
    act = await nextTo(page, 0.7);
    assert.strictEqual(act.label, 'Douse');
    await tapAction(page);
  }
  await page.waitForTimeout(300);
  assert.strictEqual((await raid(page)).id, '20261116');
  assert.strictEqual((await raid(page)).h, 2, 'two splashes');
  assert.strictEqual(await page.evaluate(() => Farm.session.state.water), water, 'dousing a spark takes no water');
  await shot(page, 'raid-8-sparks');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a boar running off the farm finds no way out of the map and gives up at once (10 Nov 2026: its way off the map was built for ever until the page ran out of memory)', async () => {
  const { page, context } = await open(null);
  const r = await page.evaluate(() => { const w = Farm.world, t0 = Date.now(); const out = [w.raidRoute(20, 20, -6, 20), w.raidRoute(20, 20, 300, -8), w.raidRoute(30, 25, 30, 999)]; return { ok: out.every((x) => x === null || Array.isArray(x)), ms: Date.now() - t0 }; });
  assert.ok(r.ok, 'a way, or none');
  assert.ok(r.ms < 500, 'at once: ' + r.ms + ' ms');
  await context.close();
});

test('Town Raid attackers in their own animations (owner, 10 Nov 2026): the Giant Boar, the crows, the sparks and the debris each from its sheet, facing where they go; a hit tints red; a doused spark and cleared debris stay where they were hit', async () => {
  const days = [[9, 'boar', 'GIANT BOAR STAMPEDE', 'ranim_tboar'], [12, 'crow', 'CROW SWARM', 'ranim_crow'], [16, 'spark', "LAVA BAKUNAWA'S SPARKS", 'ranim_tspark'], [19, 'typhoon', 'TYPHOON NIGHT', 'ranim_tdebris']];
  for (const [day, kind, title, key] of days) {
    const { page, problems, context } = await open(null, manila(2026, 11, day, 20, 2), true);
    await plant(page, 12);
    await waitModal(page, new RegExp('TOWN RAID: ' + title));
    await tapButton(page, 'Defend!');
    await page.waitForFunction((key) => Farm.world.raiders.some((a) => a.anim && a.img.texture.key === key && a.mode !== 'flee' && a.fade >= 1), key, SLOW);
    // frames change as it goes (its run, or the debris tumbling), within its own sheet
    const seen = await page.evaluate(async (key) => {
      const out = new Set(), w = Farm.world;
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        w.raiders.forEach((a) => { if (a.anim && a.img.texture.key === key) out.add(a.img.frame.name); });
      }
      return [...out];
    }, key);
    assert.ok(seen.length >= 3, kind + ': its frames move (' + seen.join(',') + ')');
    assert.ok(seen.every((f) => f >= 0 && f < (key === 'ranim_tboar' || key === 'ranim_crow' ? 48 : 16)), kind + ': frames from its sheet');
    // a hit: light red, not a white fill
    const hit = await page.evaluate(() => {
      const w = Farm.world, a = w.raiders.filter((x) => x.anim && x.mode !== 'flee' && x.fade >= 1)[0];
      a.hp = 1;
      const at = [a.x, a.y];
      w.raiderStruck(a);
      return { tint: a.img.tintTopLeft, fill: a.img.tintFill, out: !!a.out, flee: a.mode, stay: a.tx === at[0] && a.ty === at[1] };
    });
    assert.strictEqual(hit.fill, false, kind + ': no white fill');
    assert.strictEqual(hit.tint, 0xff9a8a, kind + ': tinted light red');
    assert.ok(hit.out && hit.flee === 'flee', kind + ': driven off');
    assert.strictEqual(hit.stay, kind === 'spark' || kind === 'typhoon', kind + (kind === 'spark' || kind === 'typhoon' ? ': goes out where it was hit' : ': runs off'));
    await shot(page, 'raid-anim-' + kind);
    assert.deepStrictEqual(problems, []);
    await context.close();
  }
});

test('Town Raid attackers without their sheets (offline, before the pack is in): the old look, no errors', async () => {
  const { page, problems, context } = await open(null, manila(2026, 11, 9, 20, 2));
  await plant(page, 12);
  await waitModal(page, /TOWN RAID: GIANT BOAR STAMPEDE/);
  await tapButton(page, 'Defend!');
  await page.waitForFunction(() => Farm.world.raiders.some((a) => a.mode !== 'flee' && a.fade >= 1), null, SLOW);
  assert.ok(await page.evaluate(() => Farm.world.raiders.every((a) => !a.anim && a.img.texture.key === 'raid_wild')), 'the wild boar sheet');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
