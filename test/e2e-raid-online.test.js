// The Town Raid online, end to end (owner, 6 Nov 2026): phones in the Selebox app (the real app bridge over the test
// server, test/net-mock.js with test/mock-raid.js), each on its OWN farm: their hits go to the server in batches and add
// to one town bar; a friend visiting a farm helps there (the hits count for them); after the raid everyone gets a chest
// and, the town having won, the bonus day. No shared live room: the only live message is "I helped" on the friend's farm.
// Run alone after a build: node --test test/e2e-raid-online.test.js (SHOTS=/some/dir saves screenshots).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const ACTION_BTN = { x: 294, y: 512 };
const manila = (y, mo, d, h, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, s);

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(server, now) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
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
  const uid = server.newUser();
  const webViewRef = { current: { injectJavaScript: (code) => { page.evaluate(code).catch(() => {}); } } };
  const bridge = createSunnyAcresBridge({ supabase: server.supabaseFor(uid), webViewRef });
  await context.exposeBinding('__rnPost', (source, data) => { bridge.onMessage({ nativeEvent: { data } }); });
  await page.addInitScript((now) => {
    window.ReactNativeWebView = { postMessage: (data) => window.__rnPost(data) };
    window.__now = now;
    window.gameHost = { state: null, quiet: true, raids: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, now);
  await page.addInitScript(bridge.injectedJavaScriptBeforeContentLoaded);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  // the new-game look picker first (the raid's card waits for it)
  await waitModal(page, /Who will you play/);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.Online.on, null, SLOW);
  await page.evaluate(() => { Farm.Config.ONLINE.trackEvery = 100; Farm.Config.RAID.sendEvery = 1; Farm.Config.RAID.pollEvery = 2; }); // (the tests don't wait out the real gaps)
  return { page, problems, context, uid };
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const textOf = () => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [];
  if (!m) return '';
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return out.join(' | ');
};
const modalText = (page) => page.evaluate(`(${textOf})()`);
const waitModal = (page, re) => page.waitForFunction(([src, f]) => new RegExp(src).test(eval('(' + f + ')')()), [re.source, textOf.toString()], SLOW); // eslint-disable-line no-eval
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
// The raid's start card (after the new game's own panels): Defend!
async function defend(page, re) {
  await waitModal(page, /TOWN RAID: /);
  await page.waitForFunction(() => { const m = Farm.ui.modals; return m.length === 1; }, null, SLOW).catch(() => {});
  if (re) assert.match(await modalText(page), re);
  await tapButton(page, 'Defend!');
  await page.evaluate(() => Farm.ui.closeAll());
}
async function nameFarm(page, name) {
  await page.evaluate((n) => Farm.Net.rpc('farm_join_v1', { p_farm_name: n }).then((r) => {
    Farm.Online.me.name = r.farm_name;
    Farm.session.state.net.named = 1;
    Farm.Online.chan.track(Farm.Online.myState());
    return Farm.Online.publish(true);
  }), name);
}
const setNow = async (server, phones, ms) => {
  server.db.raidNow = ms;
  for (const p of phones) await p.page.evaluate((ms) => { window.__now = ms; }, ms);
};
// Real taps on the action button next to raiders: n hits.
async function hitRaiders(page, n) {
  await page.evaluate(() => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'hoe'); Farm.world.hintKey = null; });
  let got = 0;
  for (let k = 0; k < 60 && got < n; k++) {
    const act = await page.evaluate(() => {
      const w = Farm.world, T = Farm.Config.TILE, a = w.raiders.filter((x) => x.mode !== 'flee' && x.fade >= 1)[0];
      if (!a || Farm.ui.modals.length) return null;
      w.setFeet(a.x - 0.7 * T, a.y);
      w.dir = 'right';
      w.idle();
      w.acting = 0;
      const r = w.resolve();
      return r && r.label;
    });
    if (act !== 'Hit') { await page.waitForTimeout(400); continue; }
    const before = await page.evaluate(() => Farm.session.state.raid.h);
    await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
    await frames(page);
    await page.waitForTimeout(380);
    got += (await page.evaluate(() => Farm.session.state.raid.h)) - before;
  }
  assert.strictEqual(got, n, n + ' hits landed with real taps');
}
// More hits counted straight in (to save time), then sent in the usual batches.
const addHits = (page, n) => page.evaluate((n) => { const r = Farm.Logic.raidNow(); for (let i = 0; i < n; i++) Farm.raid.hit(r); }, n);
const serverHits = (server, uid) => (server.db.raid.raids['20261109'] && server.db.raid.raids['20261109'].hits[uid]) || 0;
const waitServer = async (server, uid, n) => {
  const t0 = Date.now();
  while (serverHits(server, uid) !== n) {
    if (Date.now() - t0 > 60000) assert.fail('the server has ' + serverHits(server, uid) + ' hits, not ' + n);
    await new Promise((r) => setTimeout(r, 200));
  }
};

test('Town Raid online: two phones on their own farms add to one town bar, a friend visiting helps (their hits count for them), the town wins: chests and the bonus day for all', async () => {
  const server = createServer();
  const T0 = manila(2026, 11, 9, 20, 1);
  server.db.raidNow = T0;
  const ana = await open(server, T0), ben = await open(server, T0);
  await defend(ana.page, /ONE goal the whole town shares/);
  await defend(ben.page, /Everyone who helps gets a chest\. If the town wins: Double Drops for everyone until midnight tomorrow!/);
  await nameFarm(ana.page, 'Ana Acres');
  await nameFarm(ben.page, 'Ben Barn');
  await shot(ana.page, 'raid-online-1');

  // ----- each on their own farm: real hits, sent in a batch
  await ana.page.waitForFunction(() => Farm.world.raiders.some((a) => a.mode !== 'flee' && a.fade >= 1), null, SLOW);
  await hitRaiders(ana.page, 3);
  await hitRaiders(ben.page, 3);
  await waitServer(server, ana.uid, 3);
  await waitServer(server, ben.uid, 3);
  // more, a few minutes in (the server allows about 2 a second since the start)
  await setNow(server, [ana, ben], manila(2026, 11, 9, 20, 10));
  await addHits(ana.page, 150);
  await addHits(ben.page, 100);
  await waitServer(server, ana.uid, 153);
  await waitServer(server, ben.uid, 103);
  // the same bar on both phones: 2 farmers, 256 of 500
  for (const p of [ana, ben]) await p.page.waitForFunction(() => Farm.ui.raidText.text === '2 farmers defending · 51%', null, SLOW);
  await shot(ben.page, 'raid-online-2-bar');

  // ----- Cara visits Ana's farm and helps there: her hits count for her, and Ana sees she helped
  const cara = await open(server, manila(2026, 11, 9, 20, 10));
  await defend(cara.page);
  await nameFarm(cara.page, 'Cara Corn');
  await cara.page.evaluate((id) => Farm.Online.visit(id), ana.uid);
  await cara.page.waitForFunction(() => Farm.world && !Farm.world.busy && Farm.world.player.active && Farm.world.state.isVisit, null, SLOW);
  await cara.page.waitForFunction(() => Farm.world.raiders.some((a) => a.mode !== 'flee' && a.fade >= 1), null, SLOW);
  assert.ok(await cara.page.evaluate(() => Farm.world.mapKey === 'farm' && !Farm.Logic.raidLossOk(Farm.world.state, Farm.Logic.raidNow())), 'raiders on Ana\'s farm, but Cara\'s phone never takes Ana\'s crops');
  await hitRaiders(cara.page, 3);
  await addHits(cara.page, 60);
  await waitServer(server, cara.uid, 63);
  await ana.page.waitForFunction((id) => Farm.raid.helpers[id] && Farm.raid.helpers[id].n === 63, cara.uid, SLOW);
  await cara.page.waitForFunction(() => Farm.ui.raidText.text === '3 farmers defending · 63%', null, SLOW);
  await shot(cara.page, 'raid-online-3-visitor');

  // ----- the town gets there: 300 (the most one farmer adds) + 143 + 63 = 506 of 500
  await addHits(ana.page, 200);
  await addHits(ben.page, 40);
  await waitServer(server, ana.uid, 300);
  await waitServer(server, ben.uid, 143);
  assert.strictEqual(await ana.page.evaluate(() => Farm.session.state.raid.h), 300, 'the phone stops counting at the cap too');

  // ----- 8:31: everyone's results
  const gold = {};
  for (const [k, p] of Object.entries({ ana, ben, cara })) gold[k] = await p.page.evaluate(() => Farm.session.state.gold);
  await setNow(server, [ana, ben, cara], manila(2026, 11, 9, 20, 31));
  const want = { ana: ['Hero\'s Chest: \\+2,250G', 300, 2250], ben: ['Defender\'s Chest: \\+1,200G', 143, 1200], cara: ['Helper\'s Chest: \\+450G', 63, 450] };
  for (const [k, p] of Object.entries({ ana, ben, cara })) {
    await waitModal(p.page, /RAID RESULTS/);
    const t = await modalText(p.page);
    assert.match(t, /The town won! 3 farmers drove off the Giant Boars \(101%\)\./, k);
    assert.match(t, new RegExp('Your hits: ' + want[k][1] + '\\.'), k);
    assert.match(t, new RegExp(want[k][0]), k);
    assert.match(t, /Bonus day: Double Drops for everyone until midnight tomorrow!/, k);
    assert.strictEqual(await p.page.evaluate(() => Farm.session.state.gold), gold[k] + want[k][2], k + '\'s chest');
    assert.strictEqual(await p.page.evaluate(() => Farm.session.state.stars) >= 0, true);
    assert.strictEqual(await p.page.evaluate((ms) => !!Farm.Logic.doubleNow(ms), manila(2026, 11, 10, 9, 0)), true, k + ': Double Drops on Tuesday');
    assert.strictEqual(await p.page.evaluate((ms) => Farm.Logic.doubleNow(ms), manila(2026, 11, 11, 0, 5)), null, k + ': over at midnight');
  }
  assert.match(await modalText(ana.page), /Friends who helped on your farm: Cara Corn \(63\)\./);
  await shot(ana.page, 'raid-online-4-results');

  // ----- the message budget: a handful of small calls each, and only Cara's "I helped" on the live line
  const calls = (uid) => server.db.raidCalls.filter((c) => c.uid === uid).length;
  for (const p of [ana, ben, cara]) assert.ok(calls(p.uid) < 40, 'a few calls a phone (' + calls(p.uid) + ')');
  const rdh = server.db.sends.filter((s) => s.event === 'rdh');
  assert.ok(rdh.length >= 1 && rdh.length <= 6 && rdh.every((s) => s.uid === cara.uid && s.room === 'farm:' + ana.uid), 'only the visitor\'s word, on that farm\'s line');
  // asked again (another phone, a retry): no second chest
  assert.strictEqual((await ana.page.evaluate(() => Farm.Net.rpc('farm_raid_claim_v1', { p_raid: '20261109' }))).code, 'claimed');

  for (const p of [ana, ben, cara]) {
    assert.deepStrictEqual(p.problems, []);
    await p.context.close();
  }
});

test('Town Raid online with no raid server yet (part 21 not applied): the raid comes alone, quietly', async () => {
  const server = createServer();
  server.db.noRaid = true;
  const T0 = manila(2026, 11, 12, 20, 1);
  server.db.raidNow = T0;
  const dee = await open(server, T0);
  await defend(dee.page);
  await dee.page.waitForFunction(() => Farm.raid.server === false && /Defend your farm · 0\/40/.test(Farm.ui.raidText.text), null, SLOW);
  await dee.page.waitForFunction(() => Farm.world.raiders.some((a) => a.mode !== 'flee' && a.fade >= 1), null, SLOW);
  const act = await dee.page.evaluate(() => { const w = Farm.world, a = w.raiders.find((x) => x.mode !== 'flee'); w.setFeet(a.x - 0.6 * 256, a.y); w.dir = 'right'; const r = w.resolve(); return r && r.label; });
  assert.strictEqual(act, 'Shoo', 'crows on Thursday');
  await addHits(dee.page, 12);
  await setNow(server, [dee], manila(2026, 11, 12, 20, 31));
  await waitModal(dee.page, /RAID RESULTS/);
  const t = await modalText(dee.page);
  assert.match(t, /You landed 12 of the 40 hits your farm needed\./);
  assert.match(t, /Helper's Chest: \+150G/);
  assert.doesNotMatch(t, /Join online play/, 'online already: no "join" line');
  assert.deepStrictEqual(dee.problems, []);
  await dee.context.close();
});
