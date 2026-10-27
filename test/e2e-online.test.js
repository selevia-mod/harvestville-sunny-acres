// Online play end to end: three phones (the owner and two visitors), each a WebView in the Selebox app running
// the real app bridge (bridge/sunnyAcresBridge.js) over a stand-in for the app's Supabase (test/net-mock.js).
// Run alone: node --test test/e2e-online.test.js (SHOTS=/some/dir saves screenshots).
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');
const { createServer } = require('./net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const VISIT_BAR = { Like: 46, Gift: 113, Wave: 180, More: 247, Home: 314, y: 174 };

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
  // the app: signed in to Selebox, the game in a WebView with the bridge
  const uid = server.newUser();
  const webViewRef = { current: { injectJavaScript: (code) => { page.evaluate(code).catch(() => {}); } } };
  const bridge = createSunnyAcresBridge({ supabase: server.supabaseFor(uid), webViewRef });
  await context.exposeBinding('__rnPost', (source, data) => { bridge.onMessage({ nativeEvent: { data } }); });
  await page.addInitScript(() => {
    window.ReactNativeWebView = { postMessage: (data) => window.__rnPost(data) };
    window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; } };
  });
  await page.addInitScript(bridge.injectedJavaScriptBeforeContentLoaded);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  // the new-game look picker and welcome
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());
  // online straight away, with the app's account
  await page.waitForFunction(() => Farm.Online.on, null, SLOW);
  return { page, problems, context, uid, bridge };
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
  return out.join(' | ');
});
const waitModal = (page, re) => page.waitForFunction((src) => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return false;
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return new RegExp(src).test(out.join(' | '));
}, re.source, SLOW);
const toast = (page) => page.evaluate(() => (Farm.ui.toastText.visible ? Farm.ui.toastText.text : ''));
const waitToast = (page, re) => page.waitForFunction((src) => Farm.ui.toastText.visible && new RegExp(src).test(Farm.ui.toastText.text), re.source, SLOW);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

// Types into the text box over the game and presses OK.
async function type(page, text) {
  await page.waitForSelector('#farm-ask input', SLOW);
  await page.fill('#farm-ask input', text);
  await page.click('#farm-ask button:last-child');
  await page.waitForSelector('#farm-ask', { state: 'detached' });
}

const remotes = (page) => page.evaluate(() => Object.keys(Farm.world.remotes || {}).map((id) => Farm.world.remotes[id].tag.text).sort());
const waitRemotes = (page, names) => page.waitForFunction((want) => {
  const r = Farm.world.remotes || {};
  return JSON.stringify(Object.keys(r).map((id) => r[id].tag.text).sort()) === JSON.stringify(want);
}, names.slice().sort(), SLOW);
const waitWorld = (page, visiting) => page.waitForFunction((v) => Farm.world && !Farm.world.busy && Farm.world.player.active && !!Farm.world.state.isVisit === v, visiting, SLOW);

// Names the farm, as the first opening of the Online panel would.
async function nameFarm(page, name) {
  await page.evaluate((n) => Farm.Net.rpc('farm_join_v1', { p_farm_name: n }).then((r) => {
    Farm.Online.me.name = r.farm_name;
    Farm.session.state.net.named = 1;
    Farm.Online.chan.track(Farm.Online.myState());
  }), name);
}

test('online: an owner and two visitors see each other, like, gift, befriend, chat and rank', async () => {
  const server = createServer();
  const owner = await open(server), ana = await open(server), ben = await open(server);
  const pages = [owner, ana, ben];

  // ----- no sign-in: everyone is online with their app account. The first time the owner opens Online, they
  // name the farm in the text box, then the panel opens
  const ownerId = owner.uid;
  assert.strictEqual(await owner.page.evaluate(() => Farm.Online.me.id), ownerId, 'the app account');
  await owner.page.touchscreen.tap(330, 196);
  await page_waitAsk(owner.page);
  await shot(owner.page, 'online-1-name-farm');
  assert.strictEqual(await owner.page.inputValue('#farm-ask input'), 'Sunny Acres', 'the name to start from (the app name in Selebox)');
  await type(owner.page, 'Moon Meadow');
  await waitModal(owner.page, /Showing: Most beautiful/);
  assert.strictEqual(await owner.page.evaluate(() => Farm.Online.me.name), 'Moon Meadow');
  await owner.page.evaluate(() => Farm.ui.closeAll());
  assert.ok(server.db.snaps.has(ownerId), 'the farm is published for visitors');
  // something to see: a bench in the yard
  await owner.page.evaluate(() => {
    const L = Farm.Logic, s = Farm.session.state, t = Farm.Config.OUTDOOR.types.findIndex((x) => x && x.key === 'bench');
    const at = L.yardFindSpot(s, Farm.farm(), t, 19, 22);
    if (!at || typeof L.placeYard(s, Farm.farm(), t, at.x, at.y) !== 'number') throw new Error('no bench');
    return Farm.Online.publish(true);
  });

  await nameFarm(ana.page, 'Ana Acres');

  // ----- Ana finds the farm in the Visit list and goes there
  await ana.page.touchscreen.tap(330, 196);
  await waitModal(ana.page, /Moon Meadow \| online/);
  assert.match(await modalText(ana.page), /Showing: Most beautiful/);
  await shot(ana.page, 'online-2-visit-list');
  await tapButton(ana.page, 'Visit', 1); // (the first is the tab)
  await waitWorld(ana.page, true);
  const anaVisit = await ana.page.evaluate(() => ({
    map: Farm.world.mapKey, own: Farm.session.state === Farm.world.state, bench: Farm.world.state.yard.items.length,
    ownMap: Farm.session.state.map, host: Farm.session.visit.name,
  }));
  assert.deepStrictEqual(anaVisit, { map: 'farm', own: false, bench: 1, ownMap: 'farm', host: 'Moon Meadow' });
  await waitRemotes(ana.page, ['Moon Meadow (owner)']);
  await waitToast(owner.page, /Ana Acres is visiting your farm!/);
  await waitRemotes(owner.page, ['Ana Acres']);
  await nameFarm(ben.page, 'Ben Barn');

  // ----- a farm holds 8 visitors: with room for only 1, Ben is turned away; then he fits
  await ben.page.evaluate(() => { Farm.Config.ONLINE.maxVisitors = 1; });
  await ben.page.evaluate((id) => Farm.Online.visit(id), ownerId);
  await ben.page.waitForFunction(() => /This farm is full/.test(Farm.ui.toastText.text), null, SLOW);
  await waitWorld(ben.page, false);
  await ben.page.evaluate(() => { Farm.Config.ONLINE.maxVisitors = 8; });
  await ben.page.evaluate((id) => Farm.Online.visit(id), ownerId);
  await waitWorld(ben.page, true);

  // ----- all three see each other
  await waitRemotes(ben.page, ['Ana Acres', 'Moon Meadow (owner)']);
  await waitRemotes(ana.page, ['Ben Barn', 'Moon Meadow (owner)']);
  await waitRemotes(owner.page, ['Ana Acres', 'Ben Barn']);

  // ----- moving: the owner walks, and the visitors see them get there
  const T = 256;
  await owner.page.evaluate((T) => { Farm.world.setFeet(16 * T + T / 2, 21 * T + T / 2); Farm.world.dir = 'down'; Farm.world.idle(); }, T);
  for (const p of [ana.page, ben.page]) {
    await p.waitForFunction(([id, x, y]) => {
      const r = Farm.world.remotes[id];
      return r && Math.abs(r.x - x) < 8 && Math.abs(r.y - y) < 8;
    }, [ownerId, 16 * T + T / 2, 21 * T + T / 2], SLOW);
  }
  // the visitors stand next to the owner, so all three are on screen
  await ana.page.evaluate((T) => { Farm.world.setFeet(15 * T + T / 2, 22 * T + T / 2); Farm.world.dir = 'right'; Farm.world.idle(); }, T);
  await ben.page.evaluate((T) => { Farm.world.setFeet(17 * T + T / 2, 22 * T + T / 2); Farm.world.dir = 'left'; Farm.world.idle(); }, T);
  for (const p of pages) {
    await p.page.waitForFunction(() => Object.values(Farm.world.remotes).every((r) => {
      const o = Farm.Online.others[r.id];
      return o && Math.abs(r.x - o.x) < 8 && Math.abs(r.y - o.y) < 8;
    }), null, SLOW);
  }
  await frames(owner.page, 5);
  await shot(owner.page, 'online-3-owner-sees-two');
  await shot(ana.page, 'online-4-ana-sees-owner-and-ben');
  await shot(ben.page, 'online-5-ben');

  // ----- look, don't touch: tools do nothing on someone else's farm, and the clock stands still
  const before = await ana.page.evaluate(() => ({ soil: Object.keys(Farm.world.state.soil).length, time: Farm.world.state.time, own: JSON.stringify([Farm.session.state.soil, Farm.session.state.gold, Farm.session.state.inv, Farm.session.state.debris]) }));
  await ana.page.evaluate((T) => {
    const s = Farm.session.state;
    s.sel = s.inv.findIndex((x) => x && x.id === 'hoe');
    Farm.world.setFeet(10 * T + T / 2, 20 * T + T / 2);
    Farm.world.dir = 'down';
    Farm.world.idle();
    Farm.world.hintKey = null;
  }, T);
  await frames(ana.page, 3);
  const act = await ana.page.evaluate(() => { const a = Farm.world.resolve(); return a && { label: a.label, disabled: !!a.disabled, why: a.why }; });
  assert.ok(act && act.disabled && /look, but don't touch/.test(act.why), 'tools are off: ' + JSON.stringify(act));
  await ana.page.touchscreen.tap(294, 512);
  await ana.page.waitForTimeout(1500);
  const after = await ana.page.evaluate(() => ({ soil: Object.keys(Farm.world.state.soil).length, time: Farm.world.state.time, own: JSON.stringify([Farm.session.state.soil, Farm.session.state.gold, Farm.session.state.inv, Farm.session.state.debris]) }));
  assert.strictEqual(after.soil, before.soil, 'no soil tilled');
  assert.strictEqual(after.own, before.own, 'your own farm is untouched');

  // ----- Ana likes the farm and leaves a gold gift; Ben waves; the owner hears about all of it
  await ana.page.touchscreen.tap(VISIT_BAR.Like, VISIT_BAR.y);
  await waitToast(ana.page, /You liked Moon Meadow's farm!/);
  await waitToast(owner.page, /Ana Acres liked your farm!/);
  await ana.page.touchscreen.tap(VISIT_BAR.Like, VISIT_BAR.y);
  await waitToast(ana.page, /already liked/);
  await ana.page.touchscreen.tap(VISIT_BAR.Gift, VISIT_BAR.y);
  await waitModal(ana.page, /LEAVE A GIFT/);
  await tapButton(ana.page, '100G');
  await waitToast(ana.page, /You left Moon Meadow a 100G gift!/);
  await waitToast(owner.page, /Ana Acres left you a gift!/);
  await ben.page.touchscreen.tap(VISIT_BAR.Wave, VISIT_BAR.y);
  await ben.page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Text' && o.text === 'Hi!'), null, SLOW);
  await owner.page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Text' && o.text === 'Hi!'), null, SLOW);
  await shot(ben.page, 'online-6-wave');
  const gold0 = await owner.page.evaluate(() => Farm.session.state.gold);
  await owner.page.evaluate(() => Farm.Online.collect(false));
  assert.strictEqual(await owner.page.evaluate(() => Farm.session.state.gold), gold0 + 100, 'the gift is 100G');
  assert.match(await toast(owner.page), /Visitors left you gifts: \+100G! *\nFrom Ana Acres\./);

  // ----- Ben steps into the farmhouse: he leaves the others' farm view and sees no one there
  await ben.page.evaluate(() => {
    const o = Farm.world.objects.find((w) => w.type === 'warp' && w.props.to === 'house');
    Farm.world.travel(o.props.to, o.props.spawn);
  });
  await ben.page.waitForFunction(() => Farm.world.mapKey === 'house' && !Farm.world.busy && Farm.world.state.isVisit, null, SLOW);
  await waitRemotes(owner.page, ['Ana Acres']);
  await waitRemotes(ben.page, []);
  // and the road to town takes a visitor into the owner's town, still visiting (owner, 28 Oct: "follow who they visit");
  // Home takes him home
  await ben.page.evaluate(() => Farm.world.travel('farm', 'house_door'));
  await ben.page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  await ben.page.evaluate(() => Farm.world.travel('town', 'from_farm'));
  await ben.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy && Farm.session.visit && Farm.session.visit.inTown, null, SLOW);
  await ben.page.evaluate(() => Farm.Online.leaveVisit());
  await waitWorld(ben.page, false);
  await waitRemotes(owner.page, ['Ana Acres']);

  // ----- friends: Ana adds the owner by code, the owner accepts, they chat
  const code = await owner.page.evaluate(() => Farm.Online.me.code);
  await ana.page.evaluate(() => Farm.ui.addFriend());
  await type(ana.page, code.toLowerCase());
  await waitToast(ana.page, /Friend request sent!/);
  await owner.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(owner.page, /Ana Acres.*Wants to be your friend/);
  await tapButton(owner.page, 'Accept');
  await waitToast(owner.page, /You and Ana Acres are friends now!/);
  await waitModal(owner.page, /Ana Acres \| online/);
  await tapButton(owner.page, 'Chat');
  await waitModal(owner.page, /No messages yet/);
  await tapButton(owner.page, 'Write');
  await type(owner.page, 'Thanks for the gift, Ana!');
  await waitModal(owner.page, /Thanks for the gift, Ana!/);
  await ana.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(ana.page, /1 new message!/);
  await tapButton(ana.page, 'Chat (1)');
  await waitModal(ana.page, /Thanks for the gift, Ana!/);
  await shot(ana.page, 'online-7-chat');
  await ana.page.evaluate(() => Farm.ui.closeAll());

  // ----- the weekly ranks list all three farms
  await owner.page.evaluate(() => Farm.ui.closeAll());
  await owner.page.evaluate(() => Farm.ui.openOnline('ranks', 0));
  await waitModal(owner.page, /Showing: Home Beauty/);
  const ranks = await modalText(owner.page);
  for (const n of ['Moon Meadow \\(you\\)', 'Ana Acres', 'Ben Barn']) assert.match(ranks, new RegExp(n));
  await shot(owner.page, 'online-8-ranks');
  await owner.page.evaluate(() => Farm.ui.closeAll());

  // ----- Ana goes home with the Home button; her own game is just as she left it
  await ana.page.touchscreen.tap(VISIT_BAR.Home, VISIT_BAR.y);
  await waitWorld(ana.page, false);
  const home = await ana.page.evaluate(() => ({ same: Farm.session.state === Farm.world.state, saved: Farm.Logic.deserialize(JSON.parse(window.gameHost.saves[window.gameHost.saves.length - 1])).map }));
  assert.deepStrictEqual(home, { same: true, saved: 'farm' });
  await waitRemotes(owner.page, []);
  assert.strictEqual(await ana.page.evaluate(() => Farm.Online.topic), 'farm:' + (await ana.page.evaluate(() => Farm.Online.me.id)), 'back on her own channel');

  // ----- Ben leaves online play (his online farm is deleted), and later joins again from the Online button
  await ben.page.evaluate(() => Farm.ui.openOnline('me', 0));
  await waitModal(ben.page, /Leave online play/);
  await tapButton(ben.page, 'Leave');
  await waitModal(ben.page, /LEAVE ONLINE PLAY/);
  await tapButton(ben.page, 'Yes');
  await ben.page.waitForFunction(() => !Farm.Online.on && Farm.session.state.net.off === 1, null, SLOW);
  assert.ok(!server.db.players.has(ben.uid), 'his online farm is gone');
  // the app restarts the game with its last save
  const lastSave = await ben.page.evaluate(() => window.gameHost.saves[window.gameHost.saves.length - 1]);
  await ben.page.addInitScript((saved) => { window.gameHost.state = JSON.parse(saved); }, lastSave);
  await ben.page.reload();
  await ben.page.waitForFunction(() => window.Farm && Farm.ui && Farm.ui.refresh && Farm.world && Farm.world.player, null, SLOW);
  await ben.page.waitForTimeout(1500);
  const restarted = await ben.page.evaluate(() => ({ on: Farm.Online.on, off: Farm.session.state.net.off, isNew: Farm.session.isNew }));
  assert.deepStrictEqual(restarted, { on: false, off: 1, isNew: false }, 'he stays off after a restart');
  await ben.page.evaluate(() => Farm.ui.closeAll());
  await ben.page.touchscreen.tap(330, 196);
  await waitModal(ben.page, /PLAY ONLINE/);
  await tapButton(ben.page, 'Join');
  await page_waitAsk(ben.page);
  await type(ben.page, 'Ben Again');
  await waitModal(ben.page, /Showing: Most beautiful/);
  assert.strictEqual(server.db.players.get(ben.uid).farm_name, 'Ben Again');

  for (const p of pages) assert.deepStrictEqual(p.problems, []);
  for (const p of pages) await p.context.close();
});

test('online: the owner is away on another farm: "not here, join them?"', async () => {
  const server = createServer();
  const a = await open(server), b = await open(server), c = await open(server);
  await nameFarm(a.page, 'Apple Acres');
  await nameFarm(b.page, 'Berry Barn');
  await nameFarm(c.page, 'Clover Cove');
  const visitHost = (p) => p.page.evaluate(() => Farm.session.visit && Farm.session.visit.host);

  // ----- B visits A; C comes to B's farm and finds it empty: B is not drawn there, and C is asked to join B
  await b.page.evaluate((id) => Farm.Online.visit(id), a.uid);
  await waitWorld(b.page, true);
  await waitRemotes(a.page, ['Berry Barn']);
  await c.page.evaluate((id) => Farm.Online.visit(id), b.uid);
  await waitWorld(c.page, true);
  await waitModal(c.page, /NOT HERE RIGHT NOW/);
  assert.match(await modalText(c.page), /Berry Barn is visiting another farm right now\.\nJoin Berry Barn there\?/);
  assert.deepStrictEqual(await remotes(c.page), [], 'B is not drawn on their own farm while away');
  assert.strictEqual(await c.page.evaluate(() => Farm.Online.away), a.uid);
  await shot(c.page, 'online-away-1-join');
  await tapButton(c.page, 'Join');
  await c.page.waitForFunction((id) => Farm.session.visit && Farm.session.visit.host === id && !Farm.world.busy && Farm.world.state.isVisit, a.uid, SLOW);
  await waitRemotes(c.page, ['Apple Acres (owner)', 'Berry Barn']);
  await waitRemotes(b.page, ['Apple Acres (owner)', 'Clover Cove']);
  await waitRemotes(a.page, ['Berry Barn', 'Clover Cove']);

  // ----- C goes home; B goes to C's farm; C visits B: B is on C's own farm, so going home meets them
  await c.page.evaluate(() => Farm.Online.leaveVisit());
  await waitWorld(c.page, false);
  await b.page.evaluate((id) => Farm.Online.visit(id), c.uid);
  await c.page.waitForFunction((id) => Farm.session.visit === null && Object.keys(Farm.world.remotes).indexOf(id) >= 0, b.uid, SLOW);
  await waitRemotes(a.page, []);
  // (B walks somewhere on C's farm while C is away: C must see B there, not where B arrived)
  await b.page.evaluate(() => { const T = Farm.Config.TILE; Farm.world.setFeet(30 * T + T / 2, 20 * T + T / 2); Farm.world.dir = 'down'; Farm.world.idle(); });
  await frames(b.page, 10);
  await c.page.evaluate((id) => Farm.Online.visit(id), b.uid);
  await waitWorld(c.page, true);
  await waitModal(c.page, /visiting your farm right now/);
  assert.match(await modalText(c.page), /Go home to meet them\?/);
  await tapButton(c.page, 'Go home');
  await waitWorld(c.page, false);
  await waitRemotes(c.page, ['Berry Barn']);
  await waitToast(c.page, /Berry Barn is visiting your farm!/);
  await c.page.waitForFunction((id) => {
    const T = Farm.Config.TILE, r = Farm.world.remotes[id];
    return r && Math.abs(r.x - (30 * T + T / 2)) < 8 && Math.abs(r.y - (20 * T + T / 2)) < 8;
  }, b.uid, { timeout: 15000 });

  // ----- B goes home with C on B's farm; then B leaves for A's farm: C is asked to follow, not told B "went home"
  await b.page.evaluate(() => Farm.Online.leaveVisit());
  await waitWorld(b.page, false);
  await c.page.evaluate((id) => Farm.Online.visit(id), b.uid);
  await waitWorld(c.page, true);
  await waitRemotes(c.page, ['Berry Barn (owner)']);
  assert.strictEqual(await c.page.evaluate(() => Farm.ui.modals.length), 0, 'no question while B is home');
  await b.page.evaluate((id) => Farm.Online.visit(id), a.uid);
  await waitModal(c.page, /Berry Barn is visiting another farm right now/);
  assert.doesNotMatch(await toast(c.page), /went home/);
  await waitRemotes(c.page, []);
  await tapButton(c.page, 'Stay here');
  assert.strictEqual(await visitHost(c), b.uid, 'C stays on B\'s farm');
  await frames(c.page, 10);
  assert.strictEqual(await c.page.evaluate(() => Farm.ui.modals.length), 0, 'asked once for that farm');

  // ----- B comes home: C sees them again
  await b.page.evaluate(() => Farm.Online.leaveVisit());
  await waitRemotes(c.page, ['Berry Barn (owner)']);
  await waitToast(c.page, /Berry Barn is home! Say hi\./);

  for (const p of [a, b, c]) assert.deepStrictEqual(p.problems, []);
  for (const p of [a, b, c]) await p.context.close();
});

test('online: helping a friend: water their growing crops on a visit (5 a day, 20G each); they see it at home', async () => {
  const server = createServer();
  const host = await open(server), friend = await open(server), stranger = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  await nameFarm(stranger.page, 'Ben Barn');
  server.db.follows.push({ by: host.uid, who: friend.uid }, { by: friend.uid, who: host.uid }); // friends (mutual Selebox follows)
  const W = 38, tiles = [[10, 15], [11, 15], [12, 15], [13, 15], [14, 15], [15, 15], [16, 15]].map(([x, y]) => y * W + x);
  await host.page.evaluate((tiles) => {
    const s = Farm.session.state, now = Farm.Logic.nowMin();
    tiles.forEach((i) => { delete s.debris[i]; s.soil[i] = { w: 0, c: 'turnip', p: now, r: 0 }; });
    Farm.world.refreshAllSoil();
    return Farm.Online.publish(true);
  }, tiles);
  const face = (page, x, y) => page.evaluate(([x, y]) => {
    const T = Farm.Config.TILE;
    Farm.world.setFeet(x * T + T / 2, (y + 1) * T + T / 2);
    Farm.world.dir = 'up';
    Farm.world.idle();
    Farm.world.hintKey = null;
  }, [x, y]);
  const label = async (page) => { await page.waitForTimeout(120); return page.evaluate(() => Farm.ui.actionLabel.text); };

  // a stranger can only look
  await stranger.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(stranger.page, true);
  await face(stranger.page, 10, 15);
  assert.notStrictEqual(await label(stranger.page), 'Water');
  await stranger.page.evaluate(() => Farm.Online.leaveVisit());
  await waitWorld(stranger.page, false);

  // a friend waters: the tile is wet on their copy, the server has it, they get 20G
  await friend.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(friend.page, true);
  await waitRemotes(friend.page, ['Moon Meadow (owner)']);
  const gold = await friend.page.evaluate(() => Farm.session.state.gold);
  await face(friend.page, 10, 15);
  assert.strictEqual(await label(friend.page), 'Water');
  await friend.page.touchscreen.tap(294, 512);
  await friend.page.waitForFunction(() => Farm.session.state.gold > 0 && Object.keys(Farm.Online.helped).length > 0, null, SLOW);
  assert.strictEqual(await friend.page.evaluate(() => Farm.session.state.gold), gold + 20);
  assert.strictEqual(await friend.page.evaluate((i) => Farm.world.state.soil[i].w, tiles[0]), 1);
  assert.strictEqual(server.db.helps.length, 1);
  await shot(friend.page, 'online-help-1-water');
  // the owner, at home, sees it right away (and that crop grows faster)
  await waitToast(host.page, /Ana Acres watered 1 of your crops!/);
  assert.strictEqual(await host.page.evaluate((i) => Farm.session.state.soil[i].w, tiles[0]), 1);
  await shot(host.page, 'online-help-2-owner');
  // four more, then no more today
  for (const [x] of [[11], [12], [13], [14]]) {
    await face(friend.page, x, 15);
    await friend.page.touchscreen.tap(294, 512);
    await friend.page.waitForFunction((n) => (window.__h = Farm.Online.helped[Object.keys(Farm.Online.helped)[0]]) === n, 4 - (x - 10), SLOW);
  }
  await face(friend.page, 15, 15);
  assert.strictEqual(await label(friend.page), 'Water');
  assert.strictEqual(await friend.page.evaluate(() => { const a = Farm.world.resolve(); return a.disabled && /helped water 5/.test(a.why); }), true, '5 a day');
  assert.strictEqual(server.db.helps.length, 5);
  assert.strictEqual(await friend.page.evaluate(() => Farm.session.state.gold), gold + 100);

  for (const p of [host, friend, stranger]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, friend, stranger]) await p.context.close();
});

test('online: the Market: sell at your stall; a buyer finds what an order needs, buys it; the seller collects the gold', async () => {
  const server = createServer();
  const seller = await open(server), buyer = await open(server);
  await nameFarm(seller.page, 'Moon Meadow');
  await nameFarm(buyer.page, 'Ana Acres');
  server.db.follows.push({ by: seller.uid, who: buyer.uid }, { by: buyer.uid, who: seller.uid });
  await seller.page.evaluate(() => { Farm.Logic.addItem(Farm.session.state, 'milk', 4); Farm.ui.closeAll(); });

  // the seller puts 4 milk up at the Fair price (1.4x)
  await seller.page.evaluate(() => Farm.ui.openOnline('market', 0));
  await waitModal(seller.page, /Shopping list[\s\S]*Sell at your stall[\s\S]*0 of 4 lots/);
  // switching tabs keeps a panel on screen the whole time (owner, 28 Oct: it closed, the farm flashed, then reopened)
  await seller.page.evaluate(() => {
    window.__gaps = 0;
    const check = () => { if (window.__watch) { if (!Farm.ui.modals.length) window.__gaps++; requestAnimationFrame(check); } };
    window.__watch = true; requestAnimationFrame(check);
  });
  for (const t of ['Ranks', 'Me', 'Visit', 'Market']) {
    await tapButton(seller.page, t);
    await seller.page.waitForTimeout(400);
  }
  assert.strictEqual(await seller.page.evaluate(() => { window.__watch = false; return window.__gaps; }), 0, 'never a frame with no panel');
  assert.strictEqual(await seller.page.evaluate(() => Farm.ui.modals.length), 1, 'one panel, not stacked');
  await waitModal(seller.page, /Shopping list[\s\S]*Sell at your stall/);
  await shot(seller.page, 'market-1-tab');
  await tapButton(seller.page, 'Sell');
  await waitModal(seller.page, /Sell at your stall[\s\S]*Milk/);
  await tapButton(seller.page, 'Choose');
  await waitModal(seller.page, /4 Milk for 400G[\s\S]*4 Milk for 560G/);
  await tapButton(seller.page, 'Put up', 1);
  await waitModal(seller.page, /4 Milk  560G[\s\S]*For sale/);
  assert.strictEqual(await seller.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'milk')), 0, 'off the bag');
  assert.strictEqual(server.db.market.length, 1);
  await shot(seller.page, 'market-2-stall');
  await seller.page.evaluate(() => Farm.ui.closeAll());

  // the buyer has an order for milk: it is on the shopping list; Find shows the friend's lot; Buy
  await buyer.page.evaluate(() => {
    const s = Farm.session.state;
    s.orders = [{ from: 'lily', items: [['milk', 3]], gold: 400 }, { wait: 60 }, { wait: 60 }];
    s.gold = 1000;
    Farm.ui.openShoppingList(0);
  });
  await waitModal(buyer.page, /3 Milk[\s\S]*An order from Lily/);
  await shot(buyer.page, 'market-3-shopping-list');
  await tapButton(buyer.page, 'Find');
  await waitModal(buyer.page, /Moon Meadow  \(friend\)[\s\S]*4 Milk for 560G/);
  await shot(buyer.page, 'market-4-find');
  await tapButton(buyer.page, 'Buy');
  await waitToast(buyer.page, /Bought 4 Milk from Moon Meadow for 560G/);
  const b = await buyer.page.evaluate(() => ({ gold: Farm.session.state.gold, milk: Farm.Logic.countItem(Farm.session.state, 'milk') }));
  assert.deepStrictEqual(b, { gold: 440, milk: 4 });
  assert.match(await modalText(buyer.page), /Nobody is selling Milk/, 'sold once');

  // the seller's Market says sold; Collect pays them
  const gold = await seller.page.evaluate(() => Farm.session.state.gold);
  await seller.page.evaluate(() => Farm.ui.openOnline('market', 0));
  await waitModal(seller.page, /Sold to Ana Acres!/);
  await tapButton(seller.page, 'Collect');
  await waitToast(seller.page, /Ana Acres bought from your stall: \+560G!/);
  assert.strictEqual(await seller.page.evaluate(() => Farm.session.state.gold), gold + 560);
  await shot(seller.page, 'market-5-collected');

  // a farm's stall from its More menu
  await seller.page.evaluate(() => { Farm.Logic.addItem(Farm.session.state, 'egg', 2); Farm.ui.closeAll(); });
  await seller.page.evaluate(() => Farm.Net.rpc('farm_market_list_v1', { p_item: 'egg', p_qty: 2, p_price: 80 }));
  await buyer.page.evaluate(([id]) => { Farm.ui.closeAll(); Farm.ui.playerMenu(id, 'Moon Meadow'); }, [seller.uid]);
  await tapButton(buyer.page, 'Look');
  await waitModal(buyer.page, /Moon Meadow's stall[\s\S]*2 Egg[\s\S]*80G/);

  for (const p of [seller, buyer]) assert.deepStrictEqual(p.problems, []);
  for (const p of [seller, buyer]) await p.context.close();
});

test('online: chat bubbles: the Chat button shows when someone is here; a line pops up over your head for both', async () => {
  const server = createServer();
  const owner = await open(server), guest = await open(server);
  await nameFarm(owner.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  const chatBtn = (p) => p.evaluate(() => Farm.ui.chatBtn.visible);
  assert.strictEqual(await chatBtn(owner.page), false, 'nobody here: no Chat button');
  await guest.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await waitRemotes(owner.page, ['Ana Acres']);
  await owner.page.waitForFunction(() => Farm.ui.chatBtn.visible, null, SLOW);
  await guest.page.waitForFunction(() => Farm.ui.chatBtn.visible, null, SLOW);
  // the name over your head is your farmer's, once named (and each phone checks it)
  await guest.page.evaluate(() => { Farm.session.state.name = 'Ana Rose'; Farm.Online.retrack(); });
  await waitRemotes(owner.page, ['Ana Rose']);
  // the guest taps Chat, then a quick line
  await guest.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openSay(); });
  await waitModal(guest.page, /Say something[\s\S]*Nice farm!/);
  await shot(guest.page, 'chat-1-panel');
  await tapButton(guest.page, 'Nice farm!');
  const bubbleText = (p, id) => p.evaluate((id) => { const b = Farm.world.bubbles[id]; return b ? b.c.list[1].text : null; }, id);
  assert.strictEqual(await bubbleText(guest.page, guest.uid), 'Nice farm!', 'over your own head');
  await owner.page.waitForFunction((id) => !!Farm.world.bubbles[id], guest.uid, SLOW);
  assert.strictEqual(await bubbleText(owner.page, guest.uid), 'Nice farm!', 'over the guest, on the owner\'s phone');
  await shot(owner.page, 'chat-2-owner-sees');
  // typed: the owner answers
  await owner.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openSay(); });
  await tapButton(owner.page, 'Type your own');
  await type(owner.page, 'Welcome! Come see my cows');
  await guest.page.waitForFunction((id) => !!Farm.world.bubbles[id], owner.uid, SLOW);
  assert.strictEqual(await bubbleText(guest.page, owner.uid), 'Welcome! Come see my cows');
  await shot(guest.page, 'chat-3-guest-sees');
  // rude words are refused; a modified game sending them anyway is not shown
  await owner.page.evaluate(() => Farm.ui.closeAll());
  await owner.page.waitForTimeout(1300);
  assert.match(await owner.page.evaluate(() => Farm.Online.say('you gago')), /friendly/);
  await guest.page.evaluate(() => { Farm.world.bubbles = {}; });
  await owner.page.evaluate(() => Farm.Online.send('say', { s: 'sh1t farm' }));
  await guest.page.waitForTimeout(600);
  assert.strictEqual(await bubbleText(guest.page, owner.uid), null, 'not shown');
  // a bubble goes away by itself
  await guest.page.evaluate(() => Farm.Online.say('Bye!'));
  await guest.page.waitForFunction((id) => !Farm.world.bubbles[id], guest.uid, { timeout: 15000 });
  for (const p of [owner, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [owner, guest]) await p.context.close();
});

test('online: visitors follow the owner to town: asked once, Follow, both see each other there; the mine ends a visit', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  // the owner walks to town: the guest is asked to follow
  await host.page.evaluate(() => Farm.Online.follow('town'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await waitModal(guest.page, /MOON MEADOW WENT TO TOWN[\s\S]*Follow them\?/);
  await shot(guest.page, 'follow-1-ask');
  await tapButton(guest.page, 'Follow');
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy && Farm.session.visit && Farm.session.visit.inTown, null, SLOW);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await waitRemotes(host.page, ['Ana Acres']);
  await shot(guest.page, 'follow-2-town');
  assert.strictEqual(await guest.page.evaluate(() => Farm.session.visit && Farm.session.visit.name), 'Moon Meadow', 'still visiting');
  // in their town you play your own game (owner, 28 Oct): your own save runs the town, and doors and shops answer
  const town = await guest.page.evaluate(() => {
    const w = Farm.world, door = (w.objects || []).filter((o) => o.type === 'door' || o.type === 'shop')[0];
    const T = Farm.Config.TILE;
    w.setFeet((door.x0 + 0.5) * T, (door.y1 + 1.5) * T); w.dir = 'up'; w.idle();
    const a = w.resolve();
    return { own: w.state === Farm.session.state, isVisit: !!w.state.isVisit, label: a && a.label, blocked: !!(a && a.disabled && /look, but don't touch/.test(a.why || '')) };
  });
  assert.deepStrictEqual(town, { own: true, isVisit: false, label: town.label, blocked: false });
  assert.ok(town.label, 'a door or shop to use');
  // your own Market, from More on the visit bar
  await guest.page.evaluate((id) => Farm.ui.playerMenu(id, 'Moon Meadow'), host.uid);
  await waitModal(guest.page, /Your Market[\s\S]*Moon Meadow's stall/);
  await tapButton(guest.page, 'Open');
  await waitModal(guest.page, /Shopping list[\s\S]*Sell at your stall/);
  await guest.page.evaluate(() => Farm.ui.closeAll());
  // back to the farm: asked again (the other way)
  await host.page.evaluate(() => Farm.Online.follow('farm'));
  await waitModal(guest.page, /went back to the farm/);
  await tapButton(guest.page, 'Follow');
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy && Farm.world.state.isVisit, null, SLOW);
  assert.strictEqual(await guest.page.evaluate(() => Farm.session.state.map), 'farm', 'your own save is back where it was');
  // Home from their town: your own farm
  await guest.page.evaluate(() => Farm.Online.follow('town'));
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await guest.page.evaluate(() => Farm.Online.leaveVisit());
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy && !Farm.session.visit && !Farm.world.state.isVisit, null, SLOW);
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  // the mine is your own: heading there from their town ends the visit
  await guest.page.evaluate(() => Farm.Online.follow('town'));
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await guest.page.evaluate(() => Farm.world.travel('mine', 'entrance', 1));
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'mine' && !Farm.world.busy, null, SLOW);
  assert.strictEqual(await guest.page.evaluate(() => Farm.session.visit), null, 'in your own mine');
  for (const p of [host, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, guest]) await p.context.close();
});

test('online: keeping it friendly: rude words refused, report and block, unblock', async () => {
  const server = createServer();
  const owner = await open(server), troll = await open(server);
  await nameFarm(owner.page, 'Moon Meadow');
  await nameFarm(troll.page, 'Troll Farm');
  for (const p of [owner, troll]) await p.page.evaluate(() => { Farm.session.state.net.named = 1; });
  // friends (by code, through the real functions)
  const code = await owner.page.evaluate(() => Farm.Online.me.code);
  await troll.page.evaluate((c) => Farm.Net.rpc('farm_friend_add_v1', { p_code: c }), code);
  await owner.page.evaluate((id) => Farm.Net.rpc('farm_friend_answer_v1', { p_other: id, p_accept: true }), troll.uid);

  // a rude message is refused, with a kind word
  await troll.page.evaluate(([id]) => Farm.ui.openChat(id, 'Moon Meadow'), [owner.uid]);
  await waitModal(troll.page, /No messages yet/);
  await tapButton(troll.page, 'Write');
  await type(troll.page, 'you are a gago');
  await waitToast(troll.page, /Please keep it kind/);
  await troll.page.evaluate((id) => Farm.Net.rpc('farm_message_send_v1', { p_to: id, p_body: 'not nice at all' }), owner.uid);
  await troll.page.evaluate(() => Farm.ui.closeAll());

  // the owner reports the messages from the chat, then blocks
  await owner.page.evaluate(([id]) => Farm.ui.openChat(id, 'Troll Farm'), [troll.uid]);
  await waitModal(owner.page, /not nice at all/);
  await tapButton(owner.page, 'More');
  await waitModal(owner.page, /Keep Harvest Ville friendly/);
  await shot(owner.page, 'online-9-player-menu');
  await tapButton(owner.page, 'Report');
  await waitModal(owner.page, /Rude messages/);
  await tapButton(owner.page, 'Report', 1);
  await waitModal(owner.page, /REPORT SENT/);
  assert.deepStrictEqual(server.db.reports.map((r) => [r.by, r.target, r.reason]), [[owner.uid, troll.uid, 'messages']]);
  await tapButton(owner.page, 'Block');
  await waitModal(owner.page, /BLOCK THIS FARMER/);
  await tapButton(owner.page, 'Yes');
  await waitToast(owner.page, /Troll Farm is blocked/);
  assert.ok(server.db.blocks.some((b) => b.by === owner.uid && b.who === troll.uid));
  assert.strictEqual(await owner.page.evaluate((id) => !!Farm.Online.blocked[id], troll.uid), true);
  await owner.page.evaluate(() => Farm.ui.closeAll());

  // blocked: the farm is gone for them, and so is the friendship
  await troll.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitToast(troll.page, /not online any more/);
  assert.strictEqual(await troll.page.evaluate(() => Farm.Net.rpc('farm_friends_v1', {}).then((l) => l.length)), 0);

  // the owner unblocks from Me > Blocked farms; then the troll can visit, and More works from the visit bar
  await owner.page.evaluate(() => Farm.ui.openOnline('me', 0));
  await waitModal(owner.page, /Farm shown in lists/);
  await tapButton(owner.page, 'Blocked');
  await waitModal(owner.page, /Troll Farm/);
  await tapButton(owner.page, 'Unblock');
  await waitToast(owner.page, /Troll Farm is unblocked/);
  await troll.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitWorld(troll.page, true);
  await troll.page.touchscreen.tap(VISIT_BAR.More, VISIT_BAR.y);
  await waitModal(troll.page, /Moon Meadow.*Report.*Block/);
  await shot(troll.page, 'online-10-visit-more');

  for (const p of [owner, troll]) assert.deepStrictEqual(p.problems, []);
  for (const p of [owner, troll]) await p.context.close();
});

test('online: last week\'s rank prizes are claimed once, and the Ranks tab shows the prizes', async () => {
  const server = createServer();
  const me = await open(server);
  await nameFarm(me.page, 'Prize Farm');
  const before = await me.page.evaluate(() => ({ g: Farm.session.state.gold, st: Farm.session.state.stars }));
  server.db.prizes = { [me.uid]: [{ kind: 'beauty', rank: 1, gold: 5000, stars: 5, week: '2026-10-19' }, { kind: 'quests', rank: 7, gold: 1000, stars: 1, week: '2026-10-19' }] };
  await me.page.evaluate(() => Farm.Online.prizes());
  await waitModal(me.page, /LAST WEEK'S PRIZES.*#1 in Home Beauty: \+5,000G and 5 Sunbeams.*#7 in Daily quests done/);
  await shot(me.page, 'online-11-prizes');
  const after = await me.page.evaluate(() => ({ g: Farm.session.state.gold, st: Farm.session.state.stars }));
  assert.deepStrictEqual(after, { g: before.g + 6000, st: before.st + 6 });
  await me.page.evaluate(() => Farm.ui.closeAll());
  assert.strictEqual(await me.page.evaluate(() => Farm.Online.prizes().then((w) => w)), null, 'only once');
  await me.page.evaluate(() => Farm.ui.openOnline('ranks', 0));
  await waitModal(me.page, /Top 10 win prizes every Monday!.*Prize/);
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});

// the name box comes up after signing in
async function page_waitAsk(page) { await page.waitForSelector('#farm-ask input', SLOW); }

test('online: Selebox follows count as friends; staff review a report; share my farm', async () => {
  const server = createServer();
  const a = await open(server), b = await open(server);
  await nameFarm(a.page, 'Follow Farm');
  await nameFarm(b.page, 'Back Farm');
  await a.page.evaluate(() => Farm.ui.closeAll());
  await b.page.evaluate(() => Farm.ui.closeAll());
  // a follows b on Selebox: b's farm is under "People you follow"; following back makes them friends
  server.db.follows.push({ by: a.uid, who: b.uid });
  await a.page.evaluate(() => { Farm.ui.onlineKind = { visit: 'following', ranks: 'beauty' }; Farm.ui.openOnline('visit', 0); });
  await waitModal(a.page, /Showing: People you follow.*Back Farm/);
  await a.page.evaluate(() => Farm.ui.closeAll());
  server.db.follows.push({ by: b.uid, who: a.uid });
  await a.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(a.page, /Back Farm \|( online \|)? You follow each other on Selebox\./);
  await shot(a.page, 'online-12-selebox-friends');
  await a.page.evaluate(() => { Farm.ui.closeAll(); window.__shared = null; window.gameHost.share = (p) => { window.__shared = p; }; });
  // b reports a; a staff member (a, here) reviews it and resets the name
  await b.page.evaluate((id) => Farm.Net.rpc('farm_report_v1', { p_target: id, p_reason: 'name' }), a.uid);
  await a.page.evaluate(() => Farm.ui.openOnline('me', 0));
  await waitModal(a.page, /Farm: Follow Farm \| The name others see\. \| Rename \| Share/);
  assert.ok(!/Staff/.test(await modalText(a.page)), 'no staff rows for players');
  await a.page.evaluate(() => Farm.ui.closeAll());
  server.db.staff.add(a.uid);
  await a.page.evaluate(() => { window.gameHost.staff = true; Farm.ui.openOnline('me', 1); });
  await waitModal(a.page, /Staff: reported farms/);
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openReports(); });
  await waitModal(a.page, /Reported farms.*Follow Farm.*1 report: rude name/);
  await tapButton(a.page, 'Review');
  await waitModal(a.page, /Reported as "Follow Farm"/);
  await shot(a.page, 'online-13-staff-review');
  await tapButton(a.page, 'Rename');
  await waitModal(a.page, /No open reports/);
  assert.match(server.db.players.get(a.uid).farm_name, /^Farm [A-Z0-9]{4}$/);
  // play numbers
  await a.page.evaluate(() => Farm.Net.rpc('farm_track_v1', { p_opens: 1, p_minutes: 12 }));
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openStats(); });
  await waitModal(a.page, /Play numbers.*Last 7 days.*1 new player, 12 minutes played, busiest day 1 player\./);
  await shot(a.page, 'online-14-staff-stats');
  // share: a picture of the farm and the words go to the app
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openPause(); });
  await tapButton(a.page, 'Share farm');
  await a.page.waitForFunction(() => window.__shared, null, SLOW);
  const shared = await a.page.evaluate(() => ({ text: window.__shared.text, image: String(window.__shared.image).slice(0, 23), modals: Farm.ui.modals.length }));
  assert.match(shared.text, /^My farm in Harvest Ville! Home Beauty \d+, house level 1\. Visit me with my friend code [A-Z0-9]{8}\.$/);
  assert.strictEqual(shared.image, 'data:image/jpeg;base64,');
  assert.strictEqual(shared.modals, 0, 'the pause menu is not in the picture');
  assert.deepStrictEqual(a.problems, []);
  assert.deepStrictEqual(b.problems, []);
  await a.context.close();
  await b.context.close();
});

test('online: energy refills for Selebox Coins or Stars, never paid twice', async () => {
  const server = createServer();
  const me = await open(server);
  server.db.wallets.set(me.uid, { coins: 12, stars: 5 });
  await me.page.evaluate(() => {
    window.__spent = 0;
    window.__store = 0;
    window.gameHost.shop = true;
    window.gameHost.spent = () => { window.__spent++; };
    window.gameHost.store = () => { window.__store++; };
    Farm.session.state.energy = 40;
    Farm.ui.closeAll();
    Farm.ui.openEnergy();
  });
  await waitModal(me.page, /Energy 40 \/ 100.*Refill with Selebox Coins or Stars.*Refill/);
  await tapButton(me.page, 'Refill');
  await waitModal(me.page, /Refill energy.*Energy 40 \/ 100\.  20 refills left today\..*\+100 energy for 5 Selebox Coins \| You have 12 Selebox Coins\..*\+100 energy for 10 Selebox Stars \| You have 5 Selebox Stars: not enough yet\./);
  await shot(me.page, 'online-15-refill');
  // it asks first, saying exactly what you get
  await tapButton(me.page, 'Buy');
  await waitModal(me.page, /REFILL ENERGY\?.*\+60 energy \(40 to 100\) for 5 Selebox Coins\./);
  // the server takes the payment but the answer is lost: no energy yet, and the request is kept in the save
  server.db.loseNextBuyAnswer = true;
  await tapButton(me.page, 'Yes');
  await me.page.waitForFunction(() => /If it was paid, the energy comes/.test(Farm.ui.toastText ? Farm.ui.toastText.text : ''), null, SLOW);
  assert.strictEqual(await me.page.evaluate(() => Farm.session.state.energy), 40, 'no energy without an answer');
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.serialize(Farm.session.state).pb.length), 1, 'kept in the save');
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 7, stars: 5 }, 'it was paid');
  // a while later (the game reopened, or a new tap): the server says it was paid, so the energy arrives, once
  await me.page.evaluate(() => { Farm.session.state.net.pb[0][4] -= 60000; return Farm.Logic.settleRefills(); });
  await me.page.waitForFunction(() => Farm.session.state.energy === 100, null, SLOW);
  assert.match(await me.page.evaluate(() => Farm.ui.toastText.text), /Your last refill arrived: \+60 energy\./);
  assert.strictEqual(await me.page.evaluate(() => Farm.session.state.net.pb.length), 0);
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 7, stars: 5 }, 'charged once: 5 Coins');
  assert.strictEqual(server.db.purchases.size, 1);
  assert.strictEqual(await me.page.evaluate(() => window.__spent), 1, 'the app is told to refresh the balance');
  // a request the server never got is dropped without paying
  await me.page.evaluate(() => { Farm.session.state.net.pb = [['0b6c1c52-6a4e-4c1f-9f0e-2d3c4b5a6978', 'coins', 5, 1, Date.now() - 60000]]; return Farm.Logic.settleRefills(); });
  assert.strictEqual(await me.page.evaluate(() => Farm.session.state.net.pb.length), 0);
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 7, stars: 5 });
  // a normal refill
  await me.page.evaluate(() => { Farm.ui.closeAll(); Farm.session.state.energy = 70; Farm.ui.openRefill(); });
  await waitModal(me.page, /You have 7 Selebox Coins\./);
  await tapButton(me.page, 'Buy');
  await tapButton(me.page, 'Yes');
  await me.page.waitForFunction(() => Farm.session.state.energy === 100 && Farm.ui.modals.length === 0, null, SLOW);
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 2, stars: 5 });
  assert.strictEqual(await me.page.evaluate(() => window.__spent), 2);
  // full: no Refill button
  await me.page.evaluate(() => Farm.ui.openEnergy());
  await waitModal(me.page, /Your energy is full!/);
  assert.ok(!/\| Refill$|\| Refill \|/.test(await modalText(me.page)), 'no Refill when full');
  // not enough Coins: Get Coins opens the Selebox store
  server.db.wallets.set(me.uid, { coins: 2, stars: 0 });
  await me.page.evaluate(() => { Farm.ui.closeAll(); Farm.session.state.energy = 10; Farm.ui.openRefill(); });
  await waitModal(me.page, /You have 2 Selebox Coins: not enough yet\./);
  await tapButton(me.page, 'Get Coins');
  assert.strictEqual(await me.page.evaluate(() => window.__store), 1);
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});

test('online: on a visit the top bar is yours: your gold, your bag, your date (28 Oct, OPPO: 300G and a starter bag)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await host.page.evaluate(() => { Farm.session.state.day += 3; return Farm.Online.publish(true); }); // their calendar is ahead
  const before = await guest.page.evaluate(() => {
    const s = Farm.session.state;
    s.gold = 2354;
    const sickle = s.inv.findIndex((it) => it && it.id === 'sickle');
    if (sickle > 2) { const t = s.inv[2]; s.inv[2] = s.inv[sickle]; s.inv[sickle] = t; }
    Farm.ui.refresh();
    return { day: Farm.ui.dayText.text, slot2: s.inv[2] && s.inv[2].id };
  });
  await guest.page.waitForTimeout(1500);
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await guest.page.waitForTimeout(300); // well before the clock's next minute
  const hud = await guest.page.evaluate(() => ({
    gold: Farm.ui.goldText.text, day: Farm.ui.dayText.text,
    slot2: (Farm.world.state.inv[2] || {}).id, mine2: (Farm.session.state.inv[2] || {}).id,
    same: Farm.world.state === Farm.session.state,
  }));
  assert.strictEqual(hud.gold, '2,354', 'your gold, not the 300 of their look-only copy');
  assert.strictEqual(hud.day, before.day, 'your date');
  assert.strictEqual(hud.slot2, 'sickle', 'the farm you are on sees your bag');
  assert.strictEqual(hud.mine2, 'sickle');
  // picking a hotbar slot there picks it in your own game
  await guest.page.evaluate(() => Farm.ui.select(2));
  assert.deepStrictEqual(await guest.page.evaluate(() => [Farm.session.state.sel, Farm.world.state.sel]), [2, 2]);
  // home again: still your gold and your bag, nothing of theirs came along
  await guest.page.evaluate(() => Farm.Online.leaveVisit());
  await waitWorld(guest.page, false);
  await guest.page.waitForTimeout(1500);
  assert.strictEqual(await guest.page.evaluate(() => Farm.ui.goldText.text), '2,354');
  assert.strictEqual(await guest.page.evaluate(() => Farm.session.state.inv[2].id), 'sickle');
  assert.deepStrictEqual(guest.problems, []);
  assert.deepStrictEqual(host.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});
