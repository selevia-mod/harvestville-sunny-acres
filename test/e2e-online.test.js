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
  // and the road to town takes a visitor home
  await ben.page.evaluate(() => Farm.world.travel('farm', 'house_door'));
  await ben.page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  await ben.page.evaluate(() => Farm.world.travel('town', 'from_farm'));
  await waitWorld(ben.page, false);
  assert.strictEqual(await ben.page.evaluate(() => Farm.world.mapKey), 'farm', 'back on his own farm');
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

// the name box comes up after signing in
async function page_waitAsk(page) { await page.waitForSelector('#farm-ask input', SLOW); }
