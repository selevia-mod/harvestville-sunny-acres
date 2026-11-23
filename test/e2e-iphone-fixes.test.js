// The 8 things the iPhone 11 test found in the live game (22 Nov 2026; owner: "yes fix them all"):
//   1 the Market Hall's words said shelves hold 10 more (they hold C.BH.hallShelf more: unit test in bayanihan.test.js)
//   2 every quest's Go asked the dog's name again: Cancel was forgotten; the box was empty though he is Biscuit
//   3 the pause menu's Rank link: a blank circle, sitting on "Medals 0" (a link's width was kept in Phaser's own `w`)
//   4 Decorate showed plain green past the map's top with the farmer behind the house
//   5 Gear: every empty slot showed the bag; Change with nothing to wear did nothing
//   6 Online, Town: a crown on the "B" of "Best Farm of the Week" (it goes on the row's badge now)
//   7 What's new stopped at 2.13
//   8 the Calendar's "December 2026 (Winter)" ran into its X
// Run alone, after node build.js: node --test --test-concurrency=1 test/e2e-iphone-fixes.test.js   (SHOTS=/some/dir)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };

let browser;
test.before(async () => { browser = await chromium.launch(); });
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
const texts = (page) => page.evaluate(() => {
  const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out;
});

test('2: the dog\'s name box starts with Biscuit; Cancel keeps it for good, so a quest\'s Go no longer asks', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => Farm.ui.closeAll());
  assert.strictEqual(await page.evaluate(() => Farm.Logic.dogNamed(Farm.session.state)), false);
  await page.evaluate(() => { window.__led = 0; Farm.ui.askDogName(() => { window.__led++; }); });
  await page.waitForSelector('#farm-ask input');
  assert.strictEqual(await page.$eval('#farm-ask input', (i) => i.value), 'Biscuit');
  await shot(page, '2-dog-box');
  await page.evaluate(() => Array.from(document.querySelectorAll('#farm-ask *')).find((e) => e.textContent === 'Cancel' && !e.children.length).click());
  await page.waitForFunction(() => !document.getElementById('farm-ask'), null, SLOW);
  const after = await page.evaluate(() => ({ named: Farm.Logic.dogNamed(Farm.session.state), name: Farm.Logic.dogName(Farm.session.state), led: window.__led, dn: JSON.parse(gameHost.saves[gameHost.saves.length - 1]).dn }));
  assert.deepStrictEqual(after, { named: true, name: 'Biscuit', led: 1, dn: 'Biscuit' }, 'kept, saved, and the dog still leads on');
  // a quest's Go now goes at once (no box)
  await page.evaluate(() => { const U = Farm.ui; if (U.refreshQuestCard) U.refreshQuestCard(); });
  await frames(page, 4);
  const go = await page.evaluate(() => { const U = Farm.ui, card = Farm.Logic.questCard(Farm.session.state); U.questCardTap(); return { card: !!card, place: !!(card && Farm.Logic.questPlace(card.q.c)) }; });
  assert.deepStrictEqual(go, { card: true, place: true }, 'a quest the dog leads to');
  await frames(page, 4);
  assert.strictEqual(await page.evaluate(() => !!document.getElementById('farm-ask')), false, 'no box: the dog leads at once');
  assert.ok(await page.evaluate(() => !!Farm.session.guide), 'the dog is leading');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('3: the pause menu\'s four links side by side, none on another; Rank with no rank yet is a little medal', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  const r = await page.evaluate(() => {
    const U = Farm.ui; U.closeAll(); U.openPause();
    const m = U.modals[U.modals.length - 1];
    if (!m.c.list.find((o) => o.name === 'frame-link')) U.pauseLink(m.c, 'frame-link', Farm.Config.ICON.ribbon, 'Frame', () => {}); // (Frame shows online)
    const ls = ['medals-link', 'rank-link', 'skills-link', 'frame-link'].map((n) => m.c.list.find((o) => o.name === n));
    const b = ls.map((l) => { const t = l.list[0].getBounds(), a = l.getBounds(); return { n: l.name, x0: a.x + 5, textEnd: t.x + t.width, right: a.x + a.width }; });
    const rank = ls[1], mark = rank.list.find((o) => o.type === 'Container');
    return { b, medal: !!(mark && mark.list.some((o) => o.type === 'Star')), panelRight: m.c.getBounds().right };
  });
  for (let i = 1; i < r.b.length; i++) assert.ok(r.b[i].x0 >= r.b[i - 1].textEnd + 4, r.b[i - 1].n + ' then ' + r.b[i].n + ': ' + JSON.stringify(r.b));
  assert.ok(r.medal, 'a star on the Rank medal');
  await shot(page, '3-pause-links');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('4: Decorate with the farmer behind the house: the camera stays over the farm', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => { Farm.ui.closeAll(); const w = Farm.world; w.setFeet(18 * 256 + 128, 3 * 256 + 128); w.idle(); });
  await frames(page, 6);
  await page.evaluate(() => Farm.world.startYard());
  await frames(page, 6);
  // (inside the map; at the bottom, what is under the Decorate panel may be past it: test 4b)
  const v = await page.evaluate(() => { const wv = Farm.world.cameras.main.worldView, m = Farm.world.map; return { x: wv.x, y: wv.y, r: wv.right, b: wv.bottom, w: m.widthInPixels, h: m.heightInPixels, cover: Farm.world.yardCover() }; });
  assert.ok(v.y >= -1 && v.x >= -1 && v.r <= v.w + 1 && v.b <= v.h + v.cover + 1, 'inside the map: ' + JSON.stringify(v));
  await shot(page, '4-decorate');
  // dragging the grass far up and left: still inside
  await page.evaluate(() => { const cam = Farm.world.cameras.main; cam.setScroll(-5000, -5000); Farm.world.yardKeep(); });
  const v2 = await page.evaluate(() => { const wv = Farm.world.cameras.main.worldView; Farm.world.cameras.main.preRender(); return { x: Math.round(Farm.world.cameras.main.worldView.x), y: Math.round(Farm.world.cameras.main.worldView.y) }; });
  assert.ok(v2.x >= -1 && v2.y >= -1, JSON.stringify(v2));
  await page.evaluate(() => Farm.world.endYard());
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('4b: Decorate: the farm\'s last rows (the pen, the stand, the road) come up above the Decorate panel (a player, 23 Nov 2026)', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => { Farm.ui.closeAll(); const w = Farm.world; w.setFeet(30 * 256 + 128, 20 * 256 + 128); w.idle(); });
  await frames(page, 6);
  await page.evaluate(() => Farm.ui.openDecor());
  await frames(page, 6);
  assert.ok(await page.evaluate(() => !!(Farm.world.yd && Farm.ui.decorating)), 'decorating the yard, the panel up');
  // the grass dragged far down: the map's bottom edge reaches the panel's top, no further
  await page.evaluate(() => { const cam = Farm.world.cameras.main; cam.setScroll(0, 1e6); Farm.world.yardKeep(); cam.preRender(); });
  const v = await page.evaluate(() => { const w = Farm.world, wv = w.cameras.main.worldView; return { b: wv.bottom, y: wv.y, cover: w.yardCover(), h: w.map.heightInPixels }; });
  assert.ok(v.cover > 256, 'the panel hides the bottom of the screen: ' + JSON.stringify(v));
  assert.ok(Math.abs(v.b - v.cover - v.h) <= 2, 'the last row sits just above the panel: ' + JSON.stringify(v));
  await shot(page, '4b-decorate-bottom');
  // and up: the top edge still stops at the top
  await page.evaluate(() => { const cam = Farm.world.cameras.main; cam.setScroll(0, -1e6); Farm.world.yardKeep(); cam.preRender(); });
  assert.ok(await page.evaluate(() => Farm.world.cameras.main.worldView.y >= -1), 'the top stays inside the farm');
  await page.evaluate(() => Farm.ui.back());
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('5: Gear with nothing yet: each slot its own faint picture, not "Yours", no dead button; worn gear still has Change', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openGear(); });
  await frames(page, 4);
  const tiles = await page.evaluate(() => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [];
    const walk = (l) => l.forEach((o) => { if (o.row) out.push({ name: o.row.name, icon: o.row.icon, buttons: (o.row.buttons || []).length, words: o.list.filter((x) => x.type === 'Text').map((x) => x.text) }); else if (o.list) walk(o.list); });
    walk(m.c.list);
    return out;
  });
  assert.deepStrictEqual(tiles.map((t) => t.name), ['Head: nothing', 'Body: nothing', 'Feet: nothing', 'Charm: nothing']);
  const C = await page.evaluate(() => ({ bag: Farm.Config.ICON.bag }));
  tiles.forEach((t) => {
    assert.notStrictEqual(t.icon, C.bag, t.name + ': its own picture');
    assert.strictEqual(t.buttons, 0, t.name + ': no button to tap for nothing');
    assert.ok(!t.words.some((w) => /Yours/.test(w)), t.name + ': not "Yours"');
  });
  await shot(page, '5-gear');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('6, 7, 8: the Best Farm row\'s crown on its badge, not its words; What\'s new tells 2.14 and 2.15; December\'s title clear of the X', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await page.evaluate(() => Farm.ui.closeAll());
  // 6: the Best Farm of the Week row keeps its crown, on its round picture, clear of the words (the slim rows the
  // Online lists use, and the older big rows)
  const crown = await page.evaluate(() => {
    const O = Farm.Online, U = Farm.ui; O.best = O.best || {}; const was = O.best.last; O.best.last = { id: 'abc' };
    const row = { id: 'abc', icon: Farm.Config.ICON.star, name: 'Best Farm of the Week', reward: { gold: 5000, stars: 5 }, rewardPrefix: 'Prize', buttonsBelow: true, desc: 'Nadya won last week with 24 likes.', buttons: [{ label: 'Visit', cb: () => {} }] };
    const look = (list) => {
      const cr = list.filter((o) => o.texture && o.texture.key === 'ui-crown'), name = list.find((o) => o.type === 'Text' && o.text === 'Best Farm of the Week');
      const k = cr[0] && cr[0].getBounds(), n = name.getBounds();
      return { crowns: cr.length, clear: !!k && (k.right <= n.x + 1 || k.bottom <= n.y + 1) };
    };
    const c = U.add.container(0, 0);
    const slim = look(U.slimRow(c, 100, row).list);
    U.lookListRow(c, 300, row);
    const big = look(c.list);
    c.destroy(); O.best.last = was;
    return { slim, big };
  });
  assert.deepStrictEqual(crown, { slim: { crowns: 1, clear: true }, big: { crowns: 1, clear: true } });
  // 7
  const news = await page.evaluate(() => Farm.Config.NEWS.slice(0, 3).map((n) => n.v));
  assert.deepStrictEqual(news, ['2.15', '2.14', '2.13']);
  assert.strictEqual(await page.evaluate(() => Farm.Config.NEWS_LATEST), '2.15');
  // 8: every month of the next year: the title ends left of the X
  const clash = await page.evaluate(() => {
    const U = Farm.ui, out = [];
    for (let k = 0; k < 13; k++) {
      U.closeAll(); U.openCalendar(k);
      const m = U.modals[U.modals.length - 1], t = m.c.list.find((o) => o.type === 'Text' && /\d{4} {2}\(/.test(o.text));
      const x = m.c.list.find((o) => o.type === 'Container' && o.list.some((q) => q.type === 'Text' && q.text === 'X'));
      if (t.getBounds().right > x.getBounds().x - 2) out.push(t.text);
    }
    U.closeAll();
    return out;
  });
  assert.deepStrictEqual(clash, []);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
