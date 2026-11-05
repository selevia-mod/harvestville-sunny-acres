// Bayanihan Projects online, end to end (owner, 6 Nov 2026): two phones, each a WebView in the Selebox app running the
// real app bridge (bridge/sunnyAcresBridge.js) over the test server (test/net-mock.js, test/mock-bayanihan.js: the same
// answers as supabase/farm_online_20.sql). Both give to the Old Bridge; the progress is one for both; the last gift
// builds it; the bridge is mended in town on both phones; each claims a reward by what they gave, once.
// Run alone, after a build: node build.js && node --test test/e2e-bayanihan-online.test.js (SHOTS=/some/dir saves screenshots)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: Number(process.env.SLOW_MS) || 90000 };
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file) || null;
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && require('fs').existsSync(p) ? 'data:image/webp;base64,' + require('fs').readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => require('fs').readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(server) {
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
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript((here) => {
    window.ReactNativeWebView = { postMessage: (data) => window.__rnPost(data) };
    window.__here = here;
    window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } };
  }, allPackFiles());
  await page.addInitScript(HOST_ASSETS);
  await page.addInitScript(bridge.injectedJavaScriptBeforeContentLoaded);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.waitForFunction(() => Farm.Online.on, null, SLOW);
  return { page, problems, context, uid };
}

const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => {
  const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step));
  step();
}), n);
async function tapButton(page, label, nth = 0) {
  const pos = await page.evaluate(([label, nth]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    const found = [];
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c && o.parentContainer.visible) found.push(o.getBounds());
      if (o.list) walk(o.list);
    });
    walk(m.c.list);
    const b = found[nth];
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}
const modalText = (page) => page.evaluate(() => {
  const out = [];
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return '';
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return out.join(' | ').replace(/\n/g, ' ');
});
const waitModal = (page, re) => waitModalIn(page, re).catch(async (e) => { throw new Error(e.message + '\nOn screen: ' + (await modalText(page))); });
const waitModalIn = (page, re) => page.waitForFunction((src) => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return false;
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return new RegExp(src).test(out.join(' | ').replace(/\n/g, ' '));
}, re.source, SLOW);
const waitToast = (page, re) => page.waitForFunction((src) => Farm.ui.toastText.visible && new RegExp(src).test(Farm.ui.toastText.text), re.source, SLOW);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const waitTown = (page) => page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy && Farm.world.player.active && Farm.world.bh, null, SLOW);
async function nameFarm(page, name) {
  await page.evaluate((n) => Farm.Net.rpc('farm_join_v1', { p_farm_name: n }).then((r) => { Farm.Online.me.name = r.farm_name; Farm.session.state.net.named = 1; }), name);
}
// gives n of the need in row k of the board (Give, then the amount)
async function give(page, k, amount) {
  await page.evaluate(() => { Farm.ui.closeAll(); return Farm.ui.openBayanihan('now', 0); });
  await waitModal(page, /Bayanihan Projects.*The Old Bridge/);
  await tapButton(page, 'Give', k);
  await waitModal(page, /GIVE /);
  await tapButton(page, amount);
}

test('online: Bayanihan Projects: two phones give to the Old Bridge, one progress for both, the last gift builds it, the bridge is mended on both, and each claims a reward by what they gave, once (owner, 6 Nov 2026)', async () => {
  const server = createServer();
  // small numbers: the bridge needs 30 lumber and 4 copper; Builder from 20 points
  const p = server.db.bh.projects[0];
  p.needs = [{ item: 'lumber', goal: 30, pts: 1, dayMax: 60, have: 0 }, { item: 'ore_copper', goal: 4, pts: 2, dayMax: 25, have: 0 }];
  p.tier2 = 20;
  const ana = await open(server), ben = await open(server);
  await nameFarm(ana.page, 'Ana Farm');
  await nameFarm(ben.page, 'Ben Farm');
  server.db.hoods.set(7, { id: 7, name: 'Bayan Uno' });
  server.db.hoodOf.set(ana.uid, { hood: 7, joined: 1 });
  for (const ph of [ana, ben]) {
    await ph.page.evaluate(() => { const s = Farm.session.state; s.lumber = 25; s.inv[10] = { id: 'ore_copper', n: 5 }; Farm.world.travel('town', 'from_farm'); });
    await waitTown(ph.page);
    assert.strictEqual(await ph.page.evaluate(() => Farm.world.walkable(6, 33)), false, 'the Old Bridge is broken');
  }
  // the Online panel has its row
  await ana.page.evaluate(() => Farm.Online.bhLoad().then(() => Farm.ui.openOnline('friends', 0)));
  await waitModal(ana.page, /Bayanihan: The Old Bridge.*0% built by the whole town/);
  await shot(ana.page, 'bh-online-row');
  // Ana gives 25 lumber: the town has 25 of 30, and her barangay counts it
  await give(ana.page, 0, 'All 25');
  await waitToast(ana.page, /Salamat! 25 Lumber for The Old Bridge/);
  await waitModal(ana.page, /Lumber 25\/30/);
  assert.strictEqual(await ana.page.evaluate(() => Farm.session.state.lumber), 0);
  await ana.page.evaluate(() => Farm.ui.openBayanihan('now', 1));
  await waitModal(ana.page, /Your help: 25 points.*Bayan Uno.*25 points from your barangay/);
  await shot(ana.page, 'bh-ana-help');
  // Ben sees the same progress, and gives the last 5 lumber (only 5: the town needed no more)
  await ben.page.evaluate(() => Farm.Online.bhLoad());
  await give(ben.page, 0, 'All 5');
  await waitToast(ben.page, /Salamat! 5 Lumber/);
  assert.strictEqual(await ben.page.evaluate(() => Farm.session.state.lumber), 20, 'only the 5 the town took left his bag');
  await waitModal(ben.page, /Lumber 30\/30.*all it needs/);
  // the top givers, on Ben's phone
  await ben.page.evaluate(() => { Farm.ui.closeAll(); return Farm.ui.openBayanihan('top', 0); });
  await waitModal(ben.page, /#1 Ana Farm.*25 points.*#2 Ben Farm \(you\).*5 points/);
  // Ben's 4 copper build it: his town changes at once
  await give(ben.page, 0, 'All 4'); // (the lumber row has no Give any more: the copper's is the first)
  await ben.page.waitForFunction(() => Farm.Logic.bhBuilt(Farm.session.state, 'bridge') && Farm.world.walkable(6, 33) && Farm.world.walkable(6, 34), null, SLOW);
  assert.strictEqual(await ben.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'ore_copper')), 1);
  // and Ana's, the next time her game asks (every 10 minutes, or walking into town)
  await ana.page.evaluate(() => { Farm.ui.closeAll(); return Farm.Online.bhLoad(); });
  await ana.page.waitForFunction(() => Farm.Logic.bhBuilt(Farm.session.state, 'bridge') && Farm.world.walkable(6, 33), null, SLOW);
  assert.strictEqual(server.db.bh.projects[1].started > 0, true, 'the Market Hall is on now');
  await ana.page.evaluate(() => { const T = Farm.Config.TILE; Farm.world.setFeet(6 * T + T / 2, 31 * T + T / 2); });
  await frames(ana.page, 30);
  await shot(ana.page, 'bh-bridge-built');
  // the shortcut: Ana walks over the river
  await ana.page.evaluate(() => { const T = Farm.Config.TILE; Farm.world.setFeet(6 * T + T / 2, 34 * T + T / 2); });
  await frames(ana.page, 3);
  assert.strictEqual(await ana.page.evaluate(() => Farm.world.bhOnBridge()), true, 'on the bridge: its fishing spot');
  // the rewards: Ana (25 points) Builder 1,000G, Ben (13) Helper 300G, each once, with the title and the bench
  for (const [ph, gold, tier] of [[ana, 1000, 'Builder'], [ben, 300, 'Helper']]) {
    const before = await ph.page.evaluate(() => Farm.session.state.gold);
    await ph.page.evaluate(() => { Farm.ui.closeAll(); return Farm.ui.openBayanihan('town', 0); });
    await waitModal(ph.page, /The Old Bridge.*Claim/);
    await tapButton(ph.page, 'Claim');
    await waitModal(ph.page, new RegExp('THANK YOU, BRIDGE BUILDER!.*' + tier + ' of The Old Bridge: \\+' + gold.toLocaleString('en-US') + 'G.*Bayanihan Bench'));
    await shot(ph.page, 'bh-claim-' + tier);
    const after = await ph.page.evaluate(() => ({ gold: Farm.session.state.gold, bench: Farm.session.state.yard.bag[Farm.Config.OUTDOOR.index.bh_bench], titles: Farm.Logic.bhTitles(Farm.session.state) }));
    assert.deepStrictEqual(after, { gold: before + gold, bench: 1, titles: ['Bridge Builder'] });
    await ph.page.evaluate(() => { Farm.ui.closeAll(); return Farm.ui.openBayanihan('town', 0); });
    await waitModal(ph.page, /Your titles.*Bridge Builder/);
    assert.ok(!/Claim/.test(await modalText(ph.page)), 'claimed once: no Claim any more');
  }
  // the board moved on to the Market Hall for both
  await ben.page.evaluate(() => { Farm.ui.closeAll(); return Farm.Online.bhLoad().then(() => Farm.ui.openBayanihan('now', 0)); });
  await waitModal(ben.page, /Project 2 of 5.*The Market Hall/);
  assert.deepStrictEqual(ana.problems, []);
  assert.deepStrictEqual(ben.problems, []);
  await ana.context.close();
  await ben.context.close();
});

test('online: Bayanihan Projects before part 20 is applied: the board says they open soon, the Online row stays away, no errors', async () => {
  const server = createServer();
  server.db.noBh = true;
  const me = await open(server);
  await nameFarm(me.page, 'Early Farm');
  await me.page.evaluate(() => { Farm.session.state.lumber = 9; Farm.world.travel('town', 'from_farm'); });
  await waitTown(me.page);
  await me.page.evaluate(() => Farm.ui.openBayanihan('now', 0));
  await waitModal(me.page, /The Old Bridge.*Opening soon/);
  assert.ok(!/Give/.test(await modalText(me.page)));
  await me.page.evaluate(() => { Farm.ui.closeAll(); return Farm.ui.openOnline('friends', 0); });
  await waitModal(me.page, /Your code/);
  assert.ok(!/Bayanihan:|Bayanihan Projects/.test(await modalText(me.page)), 'no row in Online (the Bayanihan Cup\'s barangay row is another thing)');
  assert.strictEqual(await me.page.evaluate(() => Farm.session.state.lumber), 9);
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});
