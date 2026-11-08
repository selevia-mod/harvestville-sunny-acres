// End-to-end playthrough of dist/index.html in a phone-sized headless Chromium.
// Uses real taps/keys for input; teleports the player between spots to keep it fast.
// Set SHOTS=/some/dir to save screenshots along the way.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const W = 64; // farm width in tiles
const ACTION_BTN = { x: 294, y: 512 };
// Headless Chromium renders on the CPU, so frames are slow; give clock- and fade-driven waits room.
const SLOW = { timeout: 90000 }; // headless frames can be slow

// The app's side of the packs (lib/sunny-acres/assets.js): files from dist/packs and assets/looks, as the CDN would serve them.
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file) || null, l = /^looks\/v1\/([a-z]+-(?:boy|girl)(?:-archer)?)$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : l ? path.join(__dirname, '..', 'assets', 'looks', l[1] + '.webp') : null;
  return p && require('fs').existsSync(p) ? 'data:image/webp;base64,' + require('fs').readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => require('fs').readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// The game's clock (window.gameHost.now): a spring Wednesday at 10 AM unless a test says otherwise.
const START = [2026, 4, 1, 10, 0];
const at = (when) => new Date(when[0], when[1] - 1, when[2], when[3] || 0, when[4] || 0).getTime();

async function open(savedState, when = START, viewport = { width: 360, height: 640 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
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
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([state, now, here]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = {
      state: state,
      quiet: !window.__loud, // no daily-gift popup or quest toasts in the way of the other tests
      saves: [],
      save(s) { this.saves.push(JSON.stringify(s)); this.state = s; },
      now: () => window.__now,
    };
  }, [savedState || null, at(when), allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; }); // no surprise rain
  await page.waitForTimeout(300);
  const cdp = await context.newCDPSession(page);
  return { page, problems, context, cdp };
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => {
  const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step));
  step();
}), n);

async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => {
    const T = Farm.Config.TILE;
    Farm.world.setFeet(tx * T + T / 2, ty * T + T / 2);
    Farm.world.dir = dir;
    Farm.world.idle();
  }, [tx, ty, dir]);
  await frames(page);
}

async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  // tools land a moment after the tap: wait for it, then let the effects play
  await page.waitForFunction(() => !Farm.world || !Farm.world.landing, null, { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(150);
}
const modalText = (page) => page.evaluate(() => {
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(Farm.ui.modals[Farm.ui.modals.length - 1].c.list);
  return out.join(' | ');
});
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
// Kanor's Jeep lists every hunting place, a few to a page: the text of all its pages (6 Nov 2026: eight places)
async function jeepText(page) {
  let out = '';
  for (let p = 0; p < 3; p++) { await page.evaluate((p) => { Farm.ui.closeAll(); Farm.ui.openJeep(p); }, p); out += ' | ' + await modalText(page); }
  await page.evaluate(() => Farm.ui.closeAll());
  return out;
}

const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const closeAll = async (page) => { await page.evaluate(() => Farm.ui.closeAll()); await frames(page, 2); };
const count = (s, id) => s.inv.filter((x) => x && x.id === id).reduce((a, b) => a + b.n, 0);

async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}

async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
}

// ---------- daily adventures (owner, 8 Nov 2026; docs/quests-adventures.md) ----------
// today's adventure at row k: the one with this key
const setAdventure = (page, k, key, hunts) => page.evaluate(([k, key, hunts]) => {
  const s = Farm.session.state, L = Farm.Logic;
  L.refreshQuests(s, Farm.today());
  s.wild.n = hunts == null ? 200 : hunts;
  s.dq.list[k] = L.advStart(s, L.advDef(key), s.dq.d);
  Farm.world.advSetup();
  Farm.ui.qcKey = null;
  Farm.ui.refreshQuestCard();
  return Farm.world.advSpots.filter((p) => p.i === k).map((p) => ({ x: p.x, y: p.y, hidden: p.hidden }));
}, [k, key, hunts]);
const quest = (page, k) => page.evaluate((k) => JSON.parse(JSON.stringify(Farm.session.state.dq.list[k])), k);
const toast = (page) => page.evaluate(() => (Farm.ui.toastText ? Farm.ui.toastText.text : ''));

test('adventures: the day is 6 (any 5 open the chest), the week 5 good days; an adventure row says who, what and where', async () => {
  const { page, problems, context } = await open(null);
  await setAdventure(page, 3, 'silk');
  await page.evaluate(() => Farm.ui.openQuests('daily', 0));
  await page.waitForTimeout(300);
  const t = await modalText(page);
  assert.match(t, /Finish any 5 of today's 6/);
  assert.match(t, /Tita Luz: 3 Golden Silk Threads/);
  assert.match(t, /ADVENTURE/);
  assert.match(t, /Find them in Sierra Madre\. "Golden silk/);
  assert.strictEqual(await page.evaluate(() => Farm.session.state.dq.list.length), 6);
  await shot(page, 'adv-quests');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openQuests('weekly', 0); });
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /Weekly chest: 5 good days.*A good day: open the daily chest\. None yet this week\./);
  await shot(page, 'adv-weekly');
  // the first time (not quiet): the tour first, once
  await page.evaluate(() => { Farm.ui.closeAll(); window.gameHost.quiet = false; Farm.ui.openQuests('daily', 0); });
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /DAILY ADVENTURES/);
  await shot(page, 'adv-tour');
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openQuests('daily', 0); });
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /Finish any 5 of today's 6/, 'once');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('adventures: a hidden piece shows within 4 tiles, walking onto it picks it up; Give hands it to whoever asked', async () => {
  const { page, problems, context } = await open(null);
  const spots = await setAdventure(page, 3, 'moonflower');
  assert.strictEqual(spots.length, 1);
  assert.ok(spots[0].hidden, 'one piece: hidden');
  const T = await page.evaluate(() => Farm.Config.TILE);
  // far: not shown; 3 tiles away: shown
  await page.waitForTimeout(700); // (where you are now: at least 10 tiles from it, as every piece is placed)
  const far = await page.evaluate(() => { const p = Farm.world.advSpots.find((x) => x.i === 3); return p && p.img.alpha; });
  await page.evaluate(([x, y]) => { Farm.world.setFeet(x + 3 * Farm.Config.TILE, y); }, [spots[0].x, spots[0].y]);
  await page.waitForTimeout(700);
  await closeAll(page);
  const near = await page.evaluate(() => { const p = Farm.world.advSpots.find((x) => x.i === 3); return p && p.img.alpha; });
  assert.strictEqual(far, 0, 'hidden from afar');
  assert.strictEqual(near, 1, 'it shows when you are close');
  await shot(page, 'adv-hidden-near');
  await page.evaluate(([x, y]) => Farm.world.setFeet(x, y), [spots[0].x, spots[0].y]);
  await page.waitForFunction(() => !Farm.world.advSpots.some((x) => x.i === 3), null, SLOW);
  assert.match(await toast(page), /You found the Moon Flower! Bring it to Ivy\./);
  assert.strictEqual((await quest(page, 3)).got, 1);
  await page.evaluate(() => { Farm.Logic.pinQuest(Farm.session.state, 3); Farm.ui.qcKey = null; Farm.ui.refreshQuestCard(); });
  assert.match(await page.evaluate(() => Farm.ui.qcSub.text), /Bring it to Ivy/);
  // in town: next to Ivy, the action is Give (or, if she is not out, Finn takes it)
  await go(page, 'town');
  const ivy = await page.evaluate(() => { const v = Farm.world.villagers.list.find((x) => x.key === 'ivy' && x.visible); return v ? { x: v.sprite.x, y: v.sprite.y } : null; });
  if (ivy) {
    await page.evaluate(([x, y]) => { const w = Farm.world, T = Farm.Config.TILE; w.setFeet(x - T, y); w.dir = 'right'; w.idle(); }, [ivy.x, ivy.y]);
    await frames(page, 4);
    await page.waitForFunction(() => Farm.ui.actionLabel.text === 'Give', null, SLOW);
    await tapAction(page);
  } else {
    await page.evaluate(() => Farm.world.guideTo(3));
    await page.waitForFunction(() => Farm.ui.modals.length && /Finn the mail carrier can take it/.test(JSON.stringify(Farm.ui.modals[Farm.ui.modals.length - 1].c.list.map((o) => o.text))), null, SLOW);
    await page.evaluate(() => Farm.world.advGive(3, null, true));
  }
  await page.waitForFunction(() => Farm.session.state.dq.list[3].done === 1, null, SLOW);
  assert.ok((await quest(page, 3)).gv);
  await shot(page, 'adv-given');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('adventures: a hunt: the marked Bear in Magayon takes more hits, and drops the Ember Stone', async () => {
  const { page, problems, context } = await open(null);
  await setAdventure(page, 5, 'ember');
  await go(page, 'magayon');
  await page.waitForFunction(() => Farm.world.wild && Farm.world.wild.animals.some((a) => a.quest != null), null, SLOW);
  const a = await page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.quest != null); return { kind: a.kind, hp: a.hp, base: Farm.Config.WILD.animals.bear.hp, mark: !!Farm.world.advMark, run: a.def.run, baseRun: Farm.Config.WILD.animals.bear.run }; });
  assert.strictEqual(a.kind, 'bear');
  assert.ok(a.hp > a.base, 'more hits than a plain one');
  assert.ok(a.run > a.baseRun, 'a little quicker');
  assert.ok(a.mark, 'its gold mark');
  await page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.quest != null); w.setFeet(a.x - 2 * Farm.Config.TILE, a.y); });
  await closeAll(page);
  await frames(page, 3);
  await shot(page, 'adv-marked-bear');
  await page.evaluate(() => { const w = Farm.world; for (let k = 0; k < 40; k++) { const a = w.wild.animals.find((x) => x.quest != null); if (!a) break; w.wildStruck(a); } });
  await page.waitForFunction(() => Farm.session.state.dq.list[5].got === 1, null, SLOW);
  await page.waitForFunction(() => /You got the Ember Stone! Bring it to Sora\./.test(Farm.ui.toastText ? Farm.ui.toastText.text : ''), null, SLOW);
  assert.strictEqual(await page.evaluate(() => !!Farm.world.advMark), false);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('adventures: Go takes you to the place (through Kanor\'s jeep); the dog sniffs, and after 2 minutes leads you to a piece', async () => {
  const { page, problems, context } = await open(null);
  await setAdventure(page, 4, 'silk');
  await go(page, 'pulag');
  await page.waitForTimeout(1600); // (Pulag's first-time hello)
  await closeAll(page);
  await page.evaluate(() => { const w = Farm.world, o = w.objects.find((x) => x.type === 'jeep'), T = Farm.Config.TILE; w.setFeet((o.x0 - 2) * T, (o.y1 + 1.5) * T); w.idle(); });
  await frames(page, 3);
  assert.ok(await page.evaluate(() => Farm.world.guideTo(4)), 'the dog leads');
  await waitMap(page, 'sierra');
  await page.waitForFunction(() => Farm.session.sniff && Farm.session.sniff.map === 'sierra', null, SLOW);
  assert.match(await toast(page), /sniff, sniff\.\.\. the golden silk threads must be close/);
  assert.strictEqual(await page.evaluate(() => Farm.world.advSpots.filter((x) => x.i === 4).length), 3);
  assert.ok(await page.evaluate(() => { const f = Farm.world.feet(), T = Farm.Config.TILE; return Farm.world.advSpots.filter((x) => x.i === 4).every((p) => Math.abs(p.x - f.x) + Math.abs(p.y - f.y) >= 9 * T); }), 'none where the jeep drops you');
  await page.waitForFunction(() => Farm.world.advBarkAt > 0 && !!Farm.world.guideDog, null, SLOW);
  await shot(page, 'adv-sniff');
  // 2 minutes, nothing found: it leads you to the next piece, and walking onto it picks it up
  await page.evaluate(() => { Farm.session.sniff.at = Date.now() - 121000; });
  await page.waitForFunction(() => Farm.world.guide && Farm.world.guide.spot.advPiece, null, SLOW);
  await page.waitForFunction(() => Farm.world.advSpots.filter((x) => x.i === 4).length === 2, null, { timeout: 120000 });
  assert.strictEqual((await quest(page, 4)).got, 1);
  assert.match(await toast(page), /Found 1 of 3 Golden Silk Threads!/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
