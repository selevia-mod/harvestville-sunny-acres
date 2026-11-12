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
const Farm_SPEED = 1152; // C.SPEED
const VISIT_FAN = { Like: [156, 86], Gift: [148, 126], Wave: [124, 164], More: [86, 188], Home: [34, 196] };
// The round button at the top left fans out (owner, 2 Nov): open it, then tap.
const tapVisit = async (page, name) => {
  await page.touchscreen.tap(32, 88);
  await page.waitForTimeout(400);
  await shot(page, 'visit-fan');
  await page.touchscreen.tap(VISIT_FAN[name][0], VISIT_FAN[name][1]);
};

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
  // the new-game look picker and welcome
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());
  // online straight away, with the app's account
  await page.waitForFunction(() => Farm.Online.on, null, SLOW);
  await page.evaluate(() => { Farm.Config.ONLINE.trackEvery = 100; }); // (the tests do not wait out the real gap)
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
    // (a slim list's rows out of view are hidden: still found, then scrolled into view: 19i-look.js)
    const shown = (o) => { for (let p = o.parentContainer; p && p !== m.c; p = p.parentContainer) if (!p.visible && !(m.c.slimInto && p.rowH)) return false; return true; };
    const walk = (list) => list.forEach((o) => {
      if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c && shown(o)) found.push(o);
      if (o.list) walk(o.list);
    });
    walk(m.c.list);
    // a row named like its button (News: "Write"): the button, not the row's name
    const btns = found.filter((o) => o.parentContainer.list.some((x) => x.type === 'Zone'));
    if (btns.length && btns.length < found.length) found.splice(0, found.length, ...btns);
    // not on screen: a tile that offers it in its own panel (Buy 5, a second button)
    if (!found[nth]) { const tiles = []; const walk2 = (l) => l.forEach((o) => { if (o.row && (o.row.buttons || []).some((x) => x.label === label)) tiles.push(o); if (o.list) walk2(o.list); }); walk2(m.c.list); if (tiles[nth]) { if (m.c.slimInto) m.c.slimInto(tiles[nth].list[0]); const tb = tiles[nth].getBounds(); return { x: tb.centerX, y: tb.centerY, tile: true }; } }
    if (found[nth] && m.c.slimInto) m.c.slimInto(found[nth]); // (a slim list scrolls it into view: 19i-look.js)
    const b = found[nth] && found[nth].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  const n0 = await page.evaluate(() => Farm.ui.modals.length);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
  // a tile (a shop's picture: 19i-look.js) opens its own panel first: its button of the same name is the one meant
  if (await page.evaluate((n0) => Farm.ui.modals.length === n0 + 1 && !!Farm.ui.modals[n0].c.tileDetail, n0)) await tapButton(page, label);
}
// A tile, by its name: tapped (scrolled into view first).
async function tapTile(page, name) {
  const pos = await page.evaluate((name) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    let hit = null; const walk = (l) => l.forEach((o) => { if (!hit && o.type === 'Text' && o.text === name && o.parentContainer && o.parentContainer.rowH) hit = o; if (o.list) walk(o.list); });
    walk(m.c.list);
    if (!hit) return null;
    if (m.c.slimInto) m.c.slimInto(hit);
    const b = hit.parentContainer.getBounds();
    return { x: b.centerX, y: b.centerY };
  }, name);
  assert.ok(pos, `tile "${name}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 2);
}
// A tile's own panel (its words), by its name: opened, read, closed.
async function tileText(page, name, keep) {
  const pos = await page.evaluate((name) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1];
    let hit = null; const walk = (l) => l.forEach((o) => { if (!hit && o.type === 'Text' && o.text === name && o.parentContainer && o.parentContainer.rowH) hit = o; if (o.list) walk(o.list); });
    walk(m.c.list);
    if (!hit) return null;
    if (m.c.slimInto) m.c.slimInto(hit);
    const b = hit.getBounds();
    return { x: b.centerX, y: b.centerY };
  }, name);
  assert.ok(pos, `tile "${name}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 2);
  const text = await modalText(page);
  if (!keep) await page.evaluate(() => { if (Farm.ui.modals[Farm.ui.modals.length - 1].c.tileDetail) Farm.ui.closeModal(); });
  return text;
}

const modalText = (page) => page.evaluate(() => {
  const out = [];
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return '';
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return out.join(' | ');
});
// A friend went somewhere: the banner at the top (owner, 7 Nov 2026: no pop-up for it; 19r-follow.js followNote)
const followText = (page) => page.evaluate(() => { const b = Farm.ui.followBox, out = []; if (!b || !b.active) return ''; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(b.list); return out.join(' | '); });
const waitFollow = (page, re) => page.waitForFunction((src) => { const b = Farm.ui.followBox, out = []; if (!b || !b.active) return false; const walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); }); walk(b.list); return new RegExp(src).test(out.join(' | ')) && !Farm.ui.modals.length; }, re.source, SLOW);
async function tapFollow(page) {
  const pos = await page.evaluate(() => { const b = Farm.ui.followBox; let at = null; const walk = (l) => l.forEach((o) => { if (!at && o.type === 'Text' && /^(Follow|Join them)$/.test(o.text)) { const r = o.getBounds(); at = { x: r.centerX, y: r.centerY }; } if (o.list) walk(o.list); }); walk(b.list); return at; });
  assert.ok(pos, 'the banner\'s Follow is there');
  await page.touchscreen.tap(pos.x, pos.y);
}
const waitModal = (page, re) => page.waitForFunction((src) => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return false;
  const out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  walk(m.c.list);
  return new RegExp(src).test(out.join(' | '));
}, re.source, SLOW).catch(async (e) => { // (says what was there instead)
  throw new Error(e.message.split('\n')[0] + '\n  wanted: ' + re + '\n  shown: ' + await modalText(page).catch(() => '?'));
});
const toast = (page) => page.evaluate(() => (Farm.ui.toastText.visible ? Farm.ui.toastText.text : ''));
// (a toast shows for 2 s or so: a test that keeps a log of them (window.__tl) also finds one it was too slow to see)
const waitToast = (page, re) => page.waitForFunction((src) => (Farm.ui.toastText.visible && new RegExp(src).test(Farm.ui.toastText.text)) || (window.__tl || []).some((m) => new RegExp(src).test(m)), re.source, SLOW);
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
  assert.deepStrictEqual(anaVisit, { map: 'farm', own: false, bench: 109, ownMap: 'farm', host: 'Moon Meadow' }); // the bench, the field's fence, (Edit Farm, 10 Nov 2026) the farm's 7 buildings and 16 field plots, (round 2, 11 Nov 2026) the 24 pen and dog fences, and (Farm Economy v2) the Silo
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
  await tapVisit(ana.page, 'Like');
  await waitToast(ana.page, /You liked Moon Meadow's farm!/);
  await waitToast(owner.page, /Ana Acres liked your farm!/);
  await tapVisit(ana.page, 'Like');
  await waitToast(ana.page, /already liked/);
  await tapVisit(ana.page, 'Gift');
  await waitModal(ana.page, /LEAVE A GIFT/);
  await tapButton(ana.page, '100G');
  await waitToast(ana.page, /You left Moon Meadow a 100G gift!/);
  await waitToast(owner.page, /Ana Acres left you a gift!/);
  await tapVisit(ben.page, 'Wave');
  await waitModal(ben.page, /SAY SOMETHING[\s\S]*Hi![\s\S]*Love[\s\S]*Haha![\s\S]*Wow![\s\S]*Yay![\s\S]*Aww/); // (owner, 3 Nov: more than a wave)
  await shot(ben.page, 'online-6-react');
  await tapButton(ben.page, 'Hi!');
  await ben.page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Text' && o.text === 'Hi!'), null, SLOW);
  await owner.page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Text' && o.text === 'Hi!'), null, SLOW);
  await shot(ben.page, 'online-6-wave');
  await ben.page.waitForTimeout(2200);
  await tapVisit(ben.page, 'Wave');
  await waitModal(ben.page, /SAY SOMETHING/);
  await tapButton(ben.page, 'Haha!');
  await owner.page.waitForFunction(() => Farm.world.children.list.some((o) => o.type === 'Text' && o.text === 'Haha!'), null, SLOW);
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
  await tapVisit(ana.page, 'Home');
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
  const W = 75, tiles = [[10, 15], [11, 15], [12, 15], [13, 15], [14, 15], [15, 15], [16, 15]].map(([x, y]) => y * W + x);
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

test('online: a visitor sees the owner\'s sprinklers, each its own kind (owner, 8 Nov 2026: "i cannot see them")', async () => {
  const server = createServer();
  const host = await open(server), friend = await open(server);
  await nameFarm(host.page, 'Snow Park');
  await nameFarm(friend.page, 'Ana Acres');
  const tiles = await host.page.evaluate(() => {
    const s = Farm.session.state, W = Farm.world.map.width, a = 21 * W + 25, b = 22 * W + 28;
    [a, b].forEach((k) => Farm.Logic.till(s, k));
    s.soil[a].sp = 1; s.soil[b].sp = 3;
    return [a, b];
  });
  await host.page.evaluate(() => Farm.Online.publish(true));
  await friend.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await friend.page.waitForFunction(() => Farm.world && Farm.world.state && Farm.world.state.isVisit && !Farm.world.busy, null, SLOW);
  await friend.page.waitForTimeout(2500); // (the owner's phone sends the whole field once the visitor is there: 19zg-live-farm.js)
  await friend.page.waitForFunction((t) => t.every((k) => Farm.world.ftSp && Farm.world.ftSp[k]), tiles, SLOW);
  assert.deepStrictEqual(await friend.page.evaluate((t) => t.map((k) => Farm.world.state.soil[k].sp), tiles), [1, 3]);
  await friend.page.evaluate((t) => { const W = Farm.world.map.width, T = Farm.Config.TILE; Farm.world.player.body.reset((t[0] % W) * T + T / 2, (Math.floor(t[0] / W) + 2) * T); }, tiles);
  await friend.page.waitForTimeout(500);
  await shot(friend.page, 'visit-sprinklers');
  for (const p of [host, friend]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, friend]) await p.context.close();
});

test('online: hold food, face a friend: Give puts it in their bag at once; not friends, it stays yours (owner, 30 Oct)', async () => {
  const server = createServer();
  const host = await open(server), friend = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  await host.page.evaluate(() => Farm.Online.publish(true));
  await friend.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await friend.page.waitForFunction((id) => Farm.world && Farm.world.state && Farm.world.state.isVisit && Farm.world.remotes && Farm.world.remotes[id], host.uid, { timeout: 60000 });
  // the friend holds 5 grilled fish and faces the owner's farmer
  const face = () => friend.page.evaluate((id) => {
    const w = Farm.world, s = Farm.session.state, r = w.remotes[id], T = Farm.Config.TILE;
    s.inv[8] = s.inv[8] || { id: 'grilled_fish', n: 5 };
    s.sel = 8;
    w.player.body.reset(r.x, r.y + 0.75 * T);
    w.dir = 'up';
    const a = w.resolve();
    return a && [a.label, !!a.disabled];
  }, host.uid);
  assert.deepStrictEqual(await face(), ['Give', false]);
  // not friends yet: the server says no, and the fish come back
  await friend.page.evaluate((id) => Farm.world.give(Farm.Online.others[id], 8, 2), host.uid);
  await friend.page.waitForFunction(() => !Farm.world.giving, null, { timeout: 60000 });
  assert.deepStrictEqual(await friend.page.evaluate(() => Farm.session.state.inv[8]), { id: 'grilled_fish', n: 5 }, 'nothing lost');
  // friends: the dialog, then Give 5
  server.db.follows.push({ by: host.uid, who: friend.uid }, { by: friend.uid, who: host.uid });
  assert.deepStrictEqual(await face(), ['Give', false]);
  await friend.page.evaluate((id) => Farm.world.askGive(Farm.Online.others[id]), host.uid);
  assert.match(await friend.page.evaluate(() => Farm.ui.modals[Farm.ui.modals.length - 1].c.list.map((o) => o.text || '').join(' ')), /Give Moon Meadow your Grilled Fish \(you have 5\)\?/);
  await friend.page.evaluate(() => { Farm.ui.closeAll(); });
  await friend.page.evaluate((id) => Farm.world.give(Farm.Online.others[id], 8, 5), host.uid);
  await friend.page.waitForFunction(() => !Farm.world.giving, null, { timeout: 60000 });
  assert.strictEqual(await friend.page.evaluate(() => Farm.session.state.inv[8]), null, 'out of your bag');
  assert.deepStrictEqual(server.db.gives.map((g) => [g.item, g.n, g.claimed]).slice(-1)[0].slice(0, 2), ['grilled_fish', 5]);
  // the owner gets it in their bag right away
  await host.page.waitForFunction(() => Farm.Logic.countItem(Farm.session.state, 'grilled_fish') === 5, null, { timeout: 60000 });
  // empty hands or a tool: Wave as before
  const wave = await friend.page.evaluate((id) => { const w = Farm.world, s = Farm.session.state; s.sel = 0; const a = w.resolve(); return a && a.label; }, host.uid);
  assert.strictEqual(wave, 'Wave');
  for (const p of [host, friend]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, friend]) await p.context.close();
});

test('online: a friend picks your ripe fruit tree into your basket; they see it bare after, and so do you (owner, 29 Oct)', async () => {
  const server = createServer();
  const host = await open(server), friend = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  server.db.follows.push({ by: host.uid, who: friend.uid }, { by: friend.uid, who: host.uid });
  await host.page.evaluate(() => {
    const s = Farm.session.state, OD = Farm.Config.OUTDOOR;
    s.day = Farm.Logic.dayOf(Date.UTC(2026, 9, 15, 4)); // fall: apples are in season
    s.yard.items.push({ t: OD.index.apple_tree, x: 26, y: 11 });
    Farm.world.renderYard();
    return Farm.Online.publish(true);
  });
  await friend.page.evaluate(() => { const s = Farm.session.state; s.day = Farm.Logic.dayOf(Date.UTC(2026, 9, 15, 4)); });
  await friend.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await friend.page.waitForFunction(() => Farm.world && Farm.world.state && Farm.world.state.isVisit && Farm.world.yardSprites && Farm.world.yardSprites.length, null, { timeout: 60000 });
  const tree = () => friend.page.evaluate(() => Farm.world.yardSprites.map((sp) => sp.texture.key).filter((k) => /tree/.test(k))[0]);
  assert.strictEqual(await tree(), 'props/tree_apple', 'ripe: with fruit');
  const a = await friend.page.evaluate(() => { const r = Farm.world.helpAction({ x: 26, y: 13 }); return r && [r.label, !!r.disabled]; });
  assert.deepStrictEqual(a, ['Pick', false]);
  await friend.page.evaluate(() => Farm.world.helpAction({ x: 26, y: 13 }).run());
  await friend.page.waitForFunction(() => Object.keys(Farm.Online.picked).length > 0, null, { timeout: 60000 });
  assert.strictEqual(await tree(), 'props/tree_apple_bare', 'picked: bare on their screen');
  assert.ok(server.db.picks[0].tile >= 50000 && server.db.picks[0].crop === 'apple', 'sent as the tree');
  // the owner, at home: three apples in the basket, and the tree is bare
  await host.page.waitForFunction(() => Farm.Logic.basketCount(Farm.session.state) === 3, null, { timeout: 60000 });
  assert.deepStrictEqual(await host.page.evaluate(() => Farm.session.state.basket), { apple: 3 });
  await host.page.waitForFunction(() => Farm.world.yardSprites.some((sp) => sp.texture.key === 'props/tree_apple_bare'), null, { timeout: 60000 });
  for (const p of [host, friend]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, friend]) await p.context.close();
});

test('online: a visitor sees the farm as its owner laid it out: the moved house (its door), the moved ranch (its pen and animals) (Edit Farm, 10 Nov 2026)', async () => {
  const server = createServer();
  const host = await open(server), friend = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  await host.page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, O = Farm.Config.OUTDOOR, i = (k) => s.yard.items.findIndex((it) => it.t === O.index[k]);
    if (L.moveYard(s, Farm.farm(), i('farmhouse'), 24, 4) !== 'ok' || L.moveYard(s, Farm.farm(), i('ranch'), 24, 14) !== 'ok') throw new Error('no room');
    L.addAnimal(s, 'cow', false);
    return Farm.Online.publish(true);
  });
  await friend.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(friend.page, true);
  const r = await friend.page.evaluate(() => {
    const w = Farm.world, d = w.objects.find((o) => o.type === 'warp' && o.props.to === 'house'), z = w.zones.pen[0], T = 256;
    return { door: [d.x0, d.y0], pen: [z.x0, z.y0, z.x1, z.y1], inPen: w.herd.members.length > 0 && w.herd.members.every((m) => m.x >= z.x0 * T && m.x <= (z.x1 + 1) * T && m.y >= z.y0 * T && m.y <= (z.y1 + 1) * T), oldRanch: !!w.blocked[w.idx(2, 27)] };
  });
  assert.deepStrictEqual(r, { door: [26, 7], pen: [25, 18, 31, 21], inPen: true, oldRanch: false });
  assert.deepStrictEqual(host.problems, []);
  assert.deepStrictEqual(friend.problems, []);
  await Promise.all([host.context.close(), friend.context.close()]);
});

test('online: a friend picks your ripe crops into your Harvest Basket (5 a day, 20G each); you take them at home', async () => {
  const server = createServer();
  const host = await open(server), friend = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  server.db.follows.push({ by: host.uid, who: friend.uid }, { by: friend.uid, who: host.uid });
  const W = 75, tiles = [10, 11, 12, 13, 14, 15].map((x) => 15 * W + x);
  await host.page.evaluate((tiles) => {
    const s = Farm.session.state, now = Farm.Logic.nowMin();
    tiles.forEach((i) => { delete s.debris[i]; s.soil[i] = { w: 0, c: 'turnip', p: now - 30, r: 0 }; }); // ripe
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

  await friend.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(friend.page, true);
  await waitRemotes(friend.page, ['Moon Meadow (owner)']);
  const gold = await friend.page.evaluate(() => Farm.session.state.gold);
  // not friends: Pick is there but says why (owner, 29 Oct: it only said "look, but don't touch")
  assert.deepStrictEqual(await friend.page.evaluate(() => {
    const v = Farm.session.visit, was = v.friend;
    v.friend = false;
    const a = Farm.world.helpAction({ x: 10, y: 15 });
    v.friend = was;
    return [a.label, !!a.disabled, /Only friends can pick ripe crops and fruit\. Add Moon Meadow as a friend/.test(a.why)];
  }), ['Pick', true, true]);
  // the owner's birthday starts: the friend sees them in the party hat
  await host.page.evaluate(() => { const d = new Date(Farm.Logic.clock()); Farm.Logic.setBirthday(Farm.session.state, d.getMonth() + 1, d.getDate()); Farm.world.startParty(true); });
  await friend.page.waitForFunction(() => Object.values(Farm.world.remotes).some((r) => /_bday$/.test(r.spr.texture.key)), null, SLOW);
  await host.page.evaluate(() => Farm.ui.closeAll());
  await face(friend.page, 10, 15);
  assert.strictEqual(await label(friend.page), 'Pick');
  await friend.page.touchscreen.tap(294, 512);
  await friend.page.waitForFunction(() => Object.keys(Farm.Online.picked).length > 0, null, SLOW);
  assert.strictEqual(await friend.page.evaluate(() => Farm.session.state.gold), gold + 20);
  assert.strictEqual(await friend.page.evaluate((i) => Farm.world.state.soil[i].c, tiles[0]), null, 'picked off their copy');
  assert.strictEqual(await friend.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'turnip')), 0, 'it goes to their basket, not your bag');
  await shot(friend.page, 'online-pick-1');
  // the owner, at home, finds it in the basket (and the crop is gone from the field)
  await waitToast(host.page, /Ana Acres picked 1 of your ripe crop!/);
  assert.deepStrictEqual(await host.page.evaluate((i) => [Farm.Logic.basketCount(Farm.session.state), Farm.session.state.soil[i].c], tiles[0]), [1, null]);
  // four more, then no more today
  for (const x of [11, 12, 13, 14]) {
    await face(friend.page, x, 15);
    await friend.page.touchscreen.tap(294, 512);
    await friend.page.waitForFunction((n) => Farm.Online.picked[Object.keys(Farm.Online.picked)[0]] === n, 4 - (x - 10), SLOW);
  }
  // (the 6th tile, asked directly)
  assert.deepStrictEqual(await friend.page.evaluate(() => { const a = Farm.world.helpAction({ x: 15, y: 15 }); return [a.label, !!a.disabled, /picked 5/.test(a.why)]; }), ['Pick', true, true], '5 a day');
  assert.strictEqual(server.db.picks.length, 5);
  await host.page.waitForFunction(() => Farm.Logic.basketCount(Farm.session.state) === 5, null, SLOW);
  // the owner takes the basket into the bag
  await host.page.evaluate(() => { const T = Farm.Config.TILE; Farm.ui.closeAll(); Farm.world.setFeet(10 * T + T / 2, 7 * T + T / 2); Farm.world.dir = 'up'; Farm.world.idle(); Farm.world.hintKey = null; });
  assert.strictEqual(await label(host.page), 'Take');
  await host.page.touchscreen.tap(294, 512);
  await host.page.waitForFunction(() => Farm.Logic.countItem(Farm.session.state, 'turnip') === 5, null, SLOW);
  assert.strictEqual(await host.page.evaluate(() => Farm.Logic.basketCount(Farm.session.state)), 0);
  await shot(host.page, 'online-pick-2-owner');

  for (const p of [host, friend]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, friend]) await p.context.close();
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

test('online: Invite Friends rewards arrive once when the game connects: gold, and free refills to use (owner, 2 Nov 2026)', async () => {
  const server = createServer();
  const me = await open(server);
  await nameFarm(me.page, 'Moon Meadow');
  await me.page.evaluate(() => Farm.Online.inviteCollect()); // (the game's own collection, when it connected, is over first)
  server.db.invites = { [me.uid]: { harvest_gold: 10000, harvest_energy: 10 } };
  const gold = await me.page.evaluate(() => Farm.session.state.gold);
  await me.page.evaluate(async () => { await Farm.Online.inviteCollect(); });
  await waitModal(me.page, /INVITE FRIENDS[\s\S]*10,000G[\s\S]*10 free energy refills/);
  assert.deepStrictEqual(await me.page.evaluate(() => { const s = Farm.session.state; return { gold: s.gold, rf: s.rf }; }), { gold: gold + 10000, rf: 10 });
  await shot(me.page, 'invite-reward');
  await me.page.evaluate(async () => { Farm.ui.closeAll(); await Farm.Online.inviteCollect(); });
  assert.deepStrictEqual(await me.page.evaluate(() => { const s = Farm.session.state; return { gold: s.gold, rf: s.rf, open: Farm.ui.modals.length }; }), { gold: gold + 10000, rf: 10, open: 0 }, 'once');
  await me.page.evaluate(() => { Farm.session.state.energy = 20; Farm.ui.openEnergy(); });
  await waitModal(me.page, /Free refill \(10\)/);
  await tapButton(me.page, 'Free refill (10)');
  assert.deepStrictEqual(await me.page.evaluate(() => { const s = Farm.session.state; return { e: s.energy, rf: s.rf }; }), { e: 120, rf: 9 }); // (the whole 100 on top, 5 Nov 2026)
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
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
  await waitModal(guest.page, /Chat[\s\S]*Nice farm!/);
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
  // owner, 2 Nov, from players: a line reaches you when the speaker is off screen, in the small box, and stays in the panel
  const boxText = (p) => p.evaluate(() => Farm.ui.chatBox.visible ? Farm.ui.chatBox.list.filter((o) => o.text).map((o) => o.text).join(' ') : '');
  await owner.page.waitForFunction(() => Farm.Online.chatLog.length >= 3, null, SLOW);
  await guest.page.evaluate(() => { const w = Farm.world, T = Farm.Config.TILE; w.setFeet(34.5 * T, 6.5 * T); });
  await owner.page.evaluate(() => { const w = Farm.world, T = Farm.Config.TILE; w.setFeet(5.5 * T, 30.5 * T); });
  await owner.page.waitForTimeout(1300);
  await guest.page.waitForTimeout(1300);
  await guest.page.evaluate(() => Farm.Online.say('Far away hello'));
  await owner.page.waitForFunction(() => Farm.Online.chatLog.some((l) => l.text === 'Far away hello'), null, SLOW);
  assert.match(await boxText(owner.page), /Ana Rose: Far away hello/);
  await shot(owner.page, 'chat-4-box');
  await owner.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openSay(); });
  await waitModal(owner.page, /Nice farm![\s\S]*Welcome! Come see my cows[\s\S]*Far away hello/);
  await shot(owner.page, 'chat-5-history');
  await owner.page.evaluate(() => Farm.ui.closeAll());
  // a long line stays a small bubble
  const size = await guest.page.evaluate(() => { const w = Farm.world, long = new Array(13).join('wide words '); w.bubble('x', long); const b = w.bubbles.x || null; return b; });
  assert.strictEqual(size, null, 'a bubble for nobody is dropped');
  const small = await guest.page.evaluate((id) => { const w = Farm.world; delete w.bubbles[id]; w.bubble(id, new Array(13).join('wide words ')); const t = w.bubbles[id].c.list[1]; return { h: t.height, w: t.width, cut: /…$/.test(t.text), tile: Farm.Config.TILE }; }, guest.uid);
  assert.ok(small.cut && small.w <= 4.5 * small.tile && small.h <= 1.4 * small.tile, JSON.stringify(small));
  for (const p of [owner, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [owner, guest]) await p.context.close();
});

test('online: a friend walks smoothly on your screen: no stops and starts, no flicker on a diagonal, and they end where they stopped (owner, 30 Oct)', async () => {
  const server = createServer();
  const owner = await open(server), guest = await open(server);
  await nameFarm(owner.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(owner.page, ['Ana Acres']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  const feet = () => guest.page.evaluate(() => { const f = Farm.world.feet(); return { x: f.x, y: f.y }; });
  const walk = async (jx, jy) => {
    const from = await feet();
    const seen = owner.page.evaluate(() => new Promise((done) => { // every frame the owner sees, for 2.8 s
      const w = Farm.world, r = w.remotes[Object.keys(w.remotes)[0]], list = [], t0 = performance.now();
      const step = () => { const t = performance.now() - t0; list.push([t, r.x, r.y, r.anim]); if (t < 2800) requestAnimationFrame(step); else done(list); };
      step();
    }));
    await guest.page.evaluate(([x, y]) => { Farm.input.jx = x; Farm.input.jy = y; }, [jx, jy]);
    await new Promise((r) => setTimeout(r, 2200));
    const to = await feet();
    await guest.page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
    const list = await seen, mid = list.filter((f) => f[0] > 900 && f[0] < 2100);
    const gone = Math.hypot(to.x - from.x, to.y - from.y) / 256;
    assert.ok(gone > 4, 'the guest really walked: ' + gone.toFixed(1) + ' tiles');
    let stalls = 0, frames = 0, swaps = 0;
    for (let i = 1; i < mid.length; i++) {
      const dt = mid[i][0] - mid[i - 1][0];
      if (dt < 1) continue;
      frames++;
      if (Math.hypot(mid[i][1] - mid[i - 1][1], mid[i][2] - mid[i - 1][2]) / dt * 1000 < Farm_SPEED * 0.25) stalls++;
      if (mid[i][3] !== mid[i - 1][3]) swaps++;
    }
    assert.ok(frames > 10, 'enough frames to judge: ' + frames);
    assert.ok(stalls / frames < 0.05, 'stopped on ' + stalls + ' of ' + frames + ' frames');
    assert.ok(swaps <= 1, 'the walk changed ' + swaps + ' times');
    await owner.page.waitForFunction((f) => { // they end where they stopped, standing
      const r = Object.values(Farm.world.remotes)[0];
      return r.anim === '' && Math.hypot(r.x - f.x, r.y - f.y) < 12;
    }, await feet(), SLOW);
  };
  // (out in the open meadow first: since Edit Farm, 10 Nov 2026, the dog's yard has fenced sides, right of the house door)
  await guest.page.evaluate(() => { const T = Farm.Config.TILE; Farm.world.setFeet(22.5 * T, 12.5 * T); Farm.world.idle(); });
  await owner.page.waitForFunction(() => { const r = Object.values(Farm.world.remotes)[0]; return r && r.anim === '' && Math.hypot(r.x - 22.5 * 256, r.y - 12.5 * 256) < 12; }, null, SLOW);
  await walk(1, 0);
  await walk(-0.71, 0.7);
  assert.deepStrictEqual(owner.problems, []);
  assert.deepStrictEqual(guest.problems, []);
  await Promise.all([owner.context.close(), guest.context.close()]);
});

test('online: a friend who keeps stopping keeps their line: presence updates stay rare (31 Oct: the server closed it, and Eliska vanished)', async () => {
  const server = createServer();
  const owner = await open(server), guest = await open(server);
  await nameFarm(owner.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(owner.page, ['Ana Acres']);
  await new Promise((r) => setTimeout(r, 300));
  await guest.page.evaluate(() => { Farm.Config.ONLINE.trackEvery = 20000; });
  await guest.page.evaluate(() => new Promise((done) => setTimeout(done, 400)));
  server.db.tracks.length = 0;
  for (let i = 0; i < 8; i++) { // mining: a few steps, stop, a few steps, stop
    await guest.page.evaluate((x) => { Farm.input.jx = x; Farm.input.jy = 0; }, i % 2 ? 1 : -1);
    await new Promise((r) => setTimeout(r, 450));
    await guest.page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
    await new Promise((r) => setTimeout(r, 450));
  }
  const sent = server.db.tracks.filter((x) => x.uid === guest.uid).length;
  assert.ok(sent <= 1, 'presence updates in 7 s of stopping and starting: ' + sent);
  const f = await guest.page.evaluate(() => { const p = Farm.world.feet(); return { x: p.x, y: p.y }; });
  await owner.page.waitForFunction((f) => { // the moves still tell them where the guest stopped
    const r = Object.values(Farm.world.remotes)[0];
    return r.anim === '' && Math.hypot(r.x - f.x, r.y - f.y) < 12;
  }, f, SLOW);
  assert.deepStrictEqual(owner.problems, []);
  assert.deepStrictEqual(guest.problems, []);
  await Promise.all([owner.context.close(), guest.context.close()]);
});

test('online: a friend whose line drops for a moment stays on your screen, nothing is said, and they walk to where they went (31 Oct)', async () => {
  const server = createServer();
  const owner = await open(server), guest = await open(server);
  await nameFarm(owner.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(owner.page, ['Ana Acres']);
  await owner.page.waitForFunction(() => !Farm.ui.toastText.visible, null, SLOW); // (the hello is over)
  const seen = owner.page.evaluate(() => new Promise((done) => { // every frame for 6 s: where they are, the sprite, any toast
    const w = Farm.world, first = w.remotes[Object.keys(w.remotes)[0]], list = [], toasts = [], t0 = performance.now();
    const step = () => {
      const t = performance.now() - t0, r = w.remotes[first.id];
      list.push([t, r ? r.x : -1, r ? r.y : -1, r === first]);
      if (Farm.ui.toastText.visible && toasts.indexOf(Farm.ui.toastText.text) < 0) toasts.push(Farm.ui.toastText.text);
      if (t < 6000) requestAnimationFrame(step); else done({ list, toasts });
    };
    step();
  }));
  await guest.page.evaluate(() => { Farm.input.jx = 1; Farm.input.jy = 0; });
  await new Promise((r) => setTimeout(r, 300));
  server.kick(guest.uid, 'farm:' + owner.uid);
  await new Promise((r) => setTimeout(r, 1500));
  await guest.page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
  const { list, toasts } = await seen;
  assert.ok(list.every((f) => f[3]), 'the same farmer all along');
  assert.deepStrictEqual(toasts.filter((x) => /went home|is visiting|came to visit/.test(x)), []);
  let fastest = 0; // over a tenth of a second: a frame's clock and the game's are not quite the same
  for (let i = 0, j = 0; i < list.length; i++) {
    while (j < list.length && list[j][0] - list[i][0] < 100) j++;
    if (j < list.length) fastest = Math.max(fastest, Math.hypot(list[j][1] - list[i][1], list[j][2] - list[i][2]) / (list[j][0] - list[i][0]) * 1000);
  }
  assert.ok(fastest < Farm_SPEED * 3.5, 'no jump: fastest ' + (fastest / Farm_SPEED).toFixed(1) + ' x walking');
  const f = await guest.page.evaluate(() => { const p = Farm.world.feet(); return { x: p.x, y: p.y }; });
  await owner.page.waitForFunction((f) => {
    const r = Object.values(Farm.world.remotes)[0];
    return Math.hypot(r.x - f.x, r.y - f.y) < 12;
  }, f, SLOW);
  assert.deepStrictEqual(owner.problems, []);
  assert.deepStrictEqual(guest.problems, []);
  await Promise.all([owner.context.close(), guest.context.close()]);
});

test('online: a friend who really leaves is gone at once, not after the wait for a dropped line (31 Oct, two phones: 8 s)', async () => {
  const server = createServer();
  const owner = await open(server), guest = await open(server);
  await nameFarm(owner.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(owner.page, ['Ana Acres']);
  server.db.presenceLagMs = 500;
  const t0 = Date.now();
  await guest.page.evaluate(() => Farm.Online.leaveVisit(''));
  await waitRemotes(owner.page, []);
  assert.ok(Date.now() - t0 < 3000, 'gone after ' + (Date.now() - t0) + ' ms');
  await waitToast(owner.page, /Ana Acres went home/);
  assert.deepStrictEqual(owner.problems, []);
  assert.deepStrictEqual(guest.problems, []);
  await Promise.all([owner.context.close(), guest.context.close()]);
});

test('online: a friend on a horse: you see it under them, and see it go when they get off', async () => {
  const server = createServer();
  const owner = await open(server), guest = await open(server);
  await nameFarm(owner.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), owner.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  const state = () => guest.page.evaluate(() => {
    const r = Object.values(Farm.world.remotes)[0];
    return { horse: !!(r.horse && r.horse.sprite.visible), shadow: r.shadow.visible, x: r.horse ? r.horse.x - r.x : null };
  });
  assert.strictEqual(await owner.page.evaluate(() => { Farm.session.riding = true; return Farm.Online.myState().rd; }), 1, 'told in the presence list');
  await owner.page.evaluate(() => Farm.Online.chan.track(Farm.Online.myState()));
  await guest.page.waitForFunction(() => { const r = Object.values(Farm.world.remotes)[0]; return !!r.horse; }, null, SLOW);
  assert.deepStrictEqual(await state(), { horse: true, shadow: false, x: 0 });
  // riding v2 (owner's art, 11 Nov 2026): their horse and farmer one galloping picture, as your own; in the farm clothes
  await guest.page.waitForFunction(() => { const r = Object.values(Farm.world.remotes)[0]; return r.horse && /^ride2_default_(boy|girl)$/.test(r.horse.sprite.texture.key); }, null, SLOW);
  assert.ok(await guest.page.evaluate(() => { const r = Object.values(Farm.world.remotes)[0]; return !r.spr.visible && r.horse.v2 && r.horse.sprite.frame.name >= 0 && r.horse.sprite.frame.name < 16; }), 'their v2 horse, no farmer stacked on it');
  // a busy screen: the others' outfit sheets held at once are capped (10; a cheap phone 4), past it the farm clothes';
  // one unseen for 30 s is let go
  const cap = await guest.page.evaluate(() => {
    const R2 = Farm.Config.RIDE2, held = Farm.ride2Held, n0 = R2.outfits.length, clear = () => Object.keys(held).forEach((k) => delete held[k]);
    const more = ['elf', 'straw', 'ranch', 'winter', 'flower', 'santa', 'fiesta', 'bunny', 'fire', 'terrace', 'hills', 'lake'];
    R2.outfits.push(...more); // (as if their v2 sheets were all made: none is in a pack yet, so the farm clothes' stand in)
    clear();
    const out = more.map((o) => Farm.ride2For(o, 'boy')), n = Object.keys(held).length;
    clear(); window.gameHost.lite = true;
    more.forEach((o) => Farm.ride2For(o, 'boy'));
    const cheap = Object.keys(held).length;
    Object.keys(held).forEach((k) => { held[k] = Date.now() - 31000; });
    Farm.ride2Sweep();
    const after = Object.keys(held).length;
    R2.outfits.splice(n0); window.gameHost.lite = false;
    return { out: [...new Set(out)], n, cheap, after };
  });
  assert.deepStrictEqual(cap, { out: ['ride2_default_boy'], n: 10, cheap: 4, after: 0 }, 'capped, the farm clothes past it, let go after 30 s');
  await owner.page.evaluate(() => { Farm.session.riding = false; Farm.Online.chan.track(Farm.Online.myState()); });
  await guest.page.waitForFunction(() => { const r = Object.values(Farm.world.remotes)[0]; return !r.horse; }, null, SLOW);
  assert.deepStrictEqual(await state(), { horse: false, shadow: true, x: null });
  assert.ok(await guest.page.evaluate(() => Object.values(Farm.world.remotes)[0].spr.visible), 'off it: their farmer walks again');
  assert.deepStrictEqual(guest.problems, []);
  await Promise.all([owner.context.close(), guest.context.close()]);
});

test('online: out hunting, a friend on their horse shows on your screen too (the horse goes out, farm economy v2 part 5)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow went to town\./);
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow is hunting in Pulag Grassland\. \| Join them/);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Object.keys(Farm.world.remotes).length === 1, null, SLOW);
  await host.page.evaluate(() => { Farm.session.riding = true; Farm.Online.chan.track(Farm.Online.myState()); });
  await guest.page.waitForFunction(() => { const r = Object.values(Farm.world.remotes)[0]; return !!(r && r.horse && r.horse.sprite.visible); }, null, SLOW);
  await host.page.evaluate(() => { Farm.session.riding = false; Farm.Online.chan.track(Farm.Online.myState()); });
  await guest.page.waitForFunction(() => { const r = Object.values(Farm.world.remotes)[0]; return !!r && !r.horse; }, null, SLOW);
  assert.deepStrictEqual(guest.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('online: hunting with friends: asked to join, the same animals on both phones, a hit shared, a charge felt, and the hunt goes on when the first hunter leaves (owner, 30 Oct)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  for (const who of [host, guest]) {
    await who.page.evaluate(() => { const s = Farm.session.state; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 20); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  }
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  // the owner walks to town and on to Pulag: the guest is asked once, and the road takes two steps
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow went to town\./); // (a banner: it fades by itself, nothing to close)
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow is hunting in Pulag Grassland\. \| Join them/);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild && Farm.world.wild.animals.length > 0, null, SLOW);
  await waitRemotes(host.page, ['Ana Acres']);
  // one phone runs it: the first there. The other shows the same animals, the same size, in about the same place.
  const herd = (page) => page.evaluate(() => Farm.world.wild.animals.map((a) => [a.slot, a.kind, Math.round(a.size * 100)]).sort((x, y) => x[0] - y[0]));
  assert.strictEqual(await host.page.evaluate(() => Farm.world.wildFollowing()), null);
  assert.strictEqual(await guest.page.evaluate(() => Farm.world.wildFollowing()), host.uid);
  await guest.page.waitForFunction((n) => Farm.world.wild.animals.length === n, await host.page.evaluate(() => Farm.world.wild.animals.length), SLOW);
  assert.deepStrictEqual(await herd(guest.page), await herd(host.page));
  // the guest's arrow takes down an animal the owner never touched: it is the guest's hunt, and gone for both
  const hold = (slot) => host.page.evaluate((slot) => { // it stands still, hurt, on open ground
    const w = Farm.world, a = w.wild.animals.filter((x) => x.slot === slot)[0], T = Farm.Config.TILE;
    a.def = Object.assign({}, a.def, { shy: 0, angry: 0 });
    a.vx = a.vy = 0; a.mode = 'idle'; a.t = 1e9; a.hp = 1;
    return { x: a.x, y: a.y, T };
  }, slot);
  const shootAt = async (who, slot, at) => {
    await who.page.evaluate(([slot, at]) => {
      const w = Farm.world, T = at.T;
      w.setFeet(at.x - 1.2 * T, at.y);
      w.dir = 'right';
      w.idle();
    }, [slot, at]);
    await frames(who.page, 3);
    await who.page.evaluate(() => Farm.world.shoot());
  };
  const first = (await herd(host.page)).filter((a) => a[1] === 'rabbit' || a[1] === 'deer')[0][0];
  const at = await hold(first);
  await guest.page.waitForFunction((slot) => { const a = Farm.world.wild.animals.filter((x) => x.slot === slot)[0]; return a && a.mode === 'idle' && a.path; }, first, SLOW);
  await new Promise((r) => setTimeout(r, 900)); // (it has come to rest on the guest's phone)
  await shootAt(guest, first, at);
  // (every toast the owner gets from here on: the one for the guest's kill shows for 2 s, and a loaded machine can take longer to look)
  for (const who of [host, guest]) await who.page.evaluate(() => { window.__tl = []; const t = Farm.ui.toast; Farm.ui.toast = function (m) { window.__tl.push(String(m)); return t.apply(this, arguments); }; });
  // the owner sees the guest draw and let go, not just an arrow coming out of a farmer standing still (owner, 3 Nov)
  const theirShot = await host.page.waitForFunction((id) => {
    const r = Farm.world.remotes[id], s = r && r.shot;
    return s && s.body.active ? { body: s.body.texture.key, hidden: !r.spr.visible, bow: !!s.bow.active } : null;
  }, guest.uid, { ...SLOW, polling: 10 }).then((h) => h.jsonValue());
  assert.deepStrictEqual(theirShot, { body: 'archer', hidden: true, bow: true });
  await shot(host.page, 'hunt-friend-shoots');
  await host.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && !r.shot && r.spr.visible; }, guest.uid, SLOW);
  const gone = (page, slot) => page.waitForFunction((slot) => !Farm.world.wild.animals.some((x) => x.slot === slot), slot, SLOW);
  await gone(host.page, first);
  await gone(guest.page, first);
  await guest.page.waitForFunction(() => Farm.world.wildDrops.length > 0, null, SLOW);
  const counts = (page) => page.evaluate(() => ({ n: Farm.session.state.wild.n, drops: Farm.world.wildDrops.length }));
  assert.strictEqual((await counts(guest.page)).n, 1, 'the guest hunted it');
  assert.deepStrictEqual(await counts(host.page), { n: 0, drops: 0 }, 'nothing for the owner, who never hit it');
  assert.ok(await host.page.evaluate((slot) => Farm.session.state.wild.gone['pulag:' + slot] != null, first), 'and it waits to come back on the phone running the hunt (OPPO, 31 Oct)');
  await host.page.waitForFunction(() => (window.__tl || []).some((m) => /Ana Acres got the /.test(m)), null, SLOW);
  // both hit one: it is a hunt for both, and each has their own drops
  const second = (await herd(host.page)).filter((a) => a[1] === 'rabbit' || a[1] === 'deer')[0][0];
  const at2 = await hold(second);
  await host.page.evaluate((slot) => { const w = Farm.world, a = w.wild.animals.filter((x) => x.slot === slot)[0]; a.hp = 2; a.def = Object.assign({}, a.def); w.wildStruck(a); a.mode = 'idle'; a.vx = a.vy = 0; a.t = 1e9; }, second);
  await new Promise((r) => setTimeout(r, 900));
  await shootAt(guest, second, at2);
  await gone(host.page, second);
  await guest.page.waitForFunction(() => Farm.session.state.wild.n === 2, null, SLOW);
  await host.page.waitForFunction(() => Farm.session.state.wild.n === 1, null, SLOW);
  // not friends yet: after a hunt together, each is asked once (owner, 3 Nov: "i like the hunting ideas")
  await waitModal(guest.page, /HUNTED TOGETHER[\s\S]*You and Moon Meadow hunted the (Rabbit|Deer) together/);
  await tapButton(guest.page, 'Add friend');
  await waitToast(guest.page, /Friend request sent to Moon Meadow/);
  await waitModal(host.page, /HUNTED TOGETHER[\s\S]*Add Ana Acres as a friend\?/);
  await tapButton(host.page, 'Add friend');
  await waitToast(host.page, /You and Ana Acres are friends now!/);
  assert.ok(server.db.friends.some((f) => f.accepted && [f.a, f.b].sort().join() === [host.uid, guest.uid].sort().join()), 'friends on the server');
  // and each hunt went to the server's biggest catch of the week
  assert.ok([...server.db.catches.keys()].some((k) => k.endsWith(':' + guest.uid)) && [...server.db.catches.keys()].some((k) => k.endsWith(':' + host.uid)));
  // a charge at a friend costs THEM the energy, when it reaches them on THEIR screen, and it backs off on both phones
  const stand = await guest.page.evaluate(() => {
    const w = Farm.world, z = w.wild.zone;
    for (let x = z.x0 + 3; x < z.x1 - 10; x++) for (let y = z.y0 + 3; y < z.y1; y++) if (w.walkable(x, y)) { w.setFeet((x + 0.5) * 256, (y + 0.5) * 256); const f = w.feet(); return { x: f.x, y: f.y }; }
  });
  await new Promise((r) => setTimeout(r, 900)); // (the owner's phone sees the guest there)
  await guest.page.evaluate(() => {
    const w = Farm.world, hit = w.wildHit;
    window.hitFrom = null;
    w.wildHit = function (a) { const f = w.feet(); window.hitFrom = Math.hypot(a.x - f.x, a.y - f.y) / 256; w.wildHit = hit; return hit.call(w, a); };
  });
  const charger = await host.page.evaluate((at) => {
    const w = Farm.world, a = w.wild.animals[0];
    a.def = Object.assign({}, a.def, { run: 4, hit: 7, shy: 0, angry: 0 }); // (a shy one would turn and run)
    a.x = at.x + 6 * 256; a.y = at.y; a.cool = 0;
    w.wildFree = () => true;
    const crew = w.wildCrew;
    w.wildCrew = () => crew.call(w, false); // (the owner stands out of it: it goes for the guest)
    w.wildCharge(a);
    a.t = 8000;
    return a.slot;
  }, stand);
  await guest.page.waitForFunction(() => window.hitFrom != null, null, SLOW);
  assert.ok(await guest.page.evaluate(() => window.hitFrom) < 0.8, 'it had reached them, on their own screen');
  await host.page.waitForFunction((slot) => { const a = Farm.world.wild.animals.filter((x) => x.slot === slot)[0]; return a && a.mode === 'walk' && a.cool > 0; }, charger, SLOW);
  // the owner goes back to town: the guest's phone takes over the animals, which go on moving, and is asked
  const left = (await herd(guest.page)).length;
  await host.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.wildKeep(); Farm.Online.follow('town'); });
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow went back to town\./);
  await guest.page.waitForFunction(() => Farm.world.wildFollowing() === null && Farm.world.wild.animals.every((a) => a.t < 1e8), null, SLOW);
  assert.ok((await herd(guest.page)).length >= left, 'nothing vanished');
  const spot = () => guest.page.evaluate(() => Farm.world.wild.animals.map((a) => Math.round(a.x) + ':' + Math.round(a.y)).join());
  const was = await spot();
  await guest.page.waitForFunction((w) => Farm.world.wild.animals.map((a) => Math.round(a.x) + ':' + Math.round(a.y)).join() !== w, was, SLOW);
  // Home from the hunt: what lay on the ground comes along
  const bagged = await guest.page.evaluate(() => { const w = Farm.world; w.dropWild('venison', w.feet().x + 256 * 3, w.feet().y); return Farm.Logic.countItem(Farm.session.state, 'venison'); });
  await guest.page.evaluate(() => Farm.Online.leaveVisit());
  await guest.page.waitForFunction(() => !Farm.session.visit && !Farm.world.busy && Farm.world.mapKey === 'farm', null, SLOW);
  assert.strictEqual(await guest.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'venison')), bagged + 1);
  assert.deepStrictEqual(guest.problems, []);
  assert.deepStrictEqual(host.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

// Players hunting together, 6 Nov 2026: "sometimes hindi visible ang characters. like bow and arrows lang nakikita na parang
// they're lumulutang" and "minsan hindi gumagalaw ang ibang kasama sa game" ("si nadya naging parang tuod na"). On the phones
// a presence update goes out at most every 20 s (02-net.js), so what a player does in between reaches the others only through
// their moves. Here the presence is held back for longer than each check waits, which is what a phone sees in those 20 s.
// The owner and a visitor, both with a bow (and Makiling open: 50 hunts), in Pulag, seeing each other (setup at the tests' quick presence pace).
async function huntInPulag(server, setup) {
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  if (setup) await setup(host, guest);
  for (const who of [host, guest]) {
    await who.page.evaluate(() => { const s = Farm.session.state; s.wild.n = 50; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 20); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  }
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow went to town\./); // (a banner: it fades by itself, nothing to close)
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await waitFollow(guest.page, /is hunting in/);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await waitRemotes(host.page, ['Ana Acres']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  for (const who of [host, guest]) await who.page.evaluate(() => { Farm.ui.closeAll(); Farm.Config.ONLINE.trackEvery = 600000; });
  await new Promise((r) => setTimeout(r, 300));
  return { host, guest };
}
// owner, 8 Nov 2026 ("A"): on a visit, a hunting place has the same round visit button as a farm, its painted Wave, More
// and Home in the same places, and the place's chip ("Pulag 1 · 2 here") beside it, not plain buttons under the chip.
test('online: visiting, out hunting: the round visit button as on a farm (Wave, More, Home fan out), the place beside it', async () => {
  const server = createServer();
  const { host, guest } = await huntInPulag(server);
  const plain = await guest.page.evaluate(() => {
    const out = [], walk = (l) => l.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
    walk(Farm.ui.visitBar.list);
    return out;
  });
  assert.ok(!plain.includes('Wave') && !plain.includes('Home'), 'no plain Wave / Home buttons: ' + plain.join(', '));
  assert.strictEqual(await guest.page.evaluate(() => typeof Farm.ui.visitFan), 'function');
  // Wave from the fan
  await guest.page.evaluate(() => { const w = Farm.Online.wave; window.__waves = 0; Farm.Online.wave = function () { window.__waves++; return w.apply(this, arguments); }; });
  await tapVisit(guest.page, 'Wave');
  assert.strictEqual(await guest.page.evaluate(() => window.__waves), 1);
  await waitModal(guest.page, /SAY SOMETHING/); // (Wave's own picker, as on a farm)
  await guest.page.evaluate(() => Farm.ui.closeAll());
  // Home from the fan: back to your own farm
  await tapVisit(guest.page, 'Home');
  await guest.page.waitForFunction(() => !Farm.session.visit && Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  for (const p of [host, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, guest]) await p.context.close();
});

const hereIn = (who, map) => who.page.waitForFunction((m) => Farm.world.mapKey === m && !Farm.world.busy && Farm.world.wild, map, SLOW);
const drawn = (who, id) => who.page.evaluate((id) => { const r = Farm.world.remotes[id]; return !!(r && r.spr.active && r.spr.visible); }, id);
const within = async (ms, fn) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await fn()) return true; await new Promise((r) => setTimeout(r, 100)); } return !!(await fn()); };

test('online: hunting together (players, 6 Nov 2026: "si nadya naging parang tuod na"): a friend who goes on to the next hunting ground is gone from yours at once, not left standing there frozen while they walk', async () => {
  const server = createServer();
  const { host, guest } = await huntInPulag(server);
  // the owner takes the trail north to Makiling, where nobody is yet; the visitor stays in Pulag
  await host.page.evaluate(() => Farm.Online.follow('makiling'));
  await hereIn(host, 'makiling');
  await host.page.evaluate(() => { Farm.input.jx = 1; Farm.input.jy = 0; }); // walking there, on their own phone
  const gone = await within(3000, async () => !(await drawn(guest, host.uid)));
  await host.page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
  assert.ok(gone, 'the owner, in Makiling, still stands frozen in Pulag on the visitor\'s phone');
  assert.strictEqual(await guest.page.evaluate((id) => Farm.Online.others[id].map, host.uid), 'makiling', 'the visitor knows where they went');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('online: hunting together (players, 6 Nov 2026: "bow and arrows lang nakikita na parang lumulutang"): arriving where a friend hunts, their farmer is there at once, and their shot is their farmer drawing the bow, in their own clothes when their look\'s bow sheet is not on this phone', async () => {
  const server = createServer();
  const { host, guest } = await huntInPulag(server, async (host, guest) => {
    // the visitor wears the Fire look; the owner's phone never gets its bow sheet (not downloaded, or refused)
    server.db.looksOwned.set(guest.uid, ['fire']);
    await guest.page.evaluate(() => Farm.Online.loadLooks());
    await guest.page.evaluate(() => Farm.ui.wearLook('fire'));
    await guest.page.waitForFunction(() => Farm.world.player.texture.key === 'look_fire_boy', null, SLOW);
    await host.page.evaluate(() => {
      const asset = window.gameHost.asset;
      window.gameHost.asset = function (f, save) { if (/-archer(\.[0-9a-f]{8})?$/.test(f)) return setTimeout(function () { window.__gameAsset(f, null); }, 0); return asset.call(this, f, save); };
    });
  });
  // the visitor goes ahead to Makiling; the owner follows a little later
  await guest.page.evaluate(() => Farm.Online.follow('makiling'));
  await hereIn(guest, 'makiling');
  await new Promise((r) => setTimeout(r, 600));
  await host.page.evaluate(() => { Farm.ui.closeAll(); Farm.Online.follow('makiling'); });
  await hereIn(host, 'makiling');
  const knows = await host.page.evaluate((id) => Farm.Online.others[id] && Farm.Online.others[id].map, guest.uid);
  assert.ok(await within(3000, () => drawn(host, guest.uid)), 'the owner arrived and the visitor, there all along, is not drawn (this phone has them in ' + knows + ')');
  assert.ok(await within(3000, () => drawn(guest, host.uid)), 'the visitor does not see the owner arrive');
  // the visitor shoots: on the owner's phone, their farmer draws and lets go (no bow and arrow flying on its own)
  await host.page.evaluate(() => { const w = Farm.world, flash = w.bowFlash; window.flashes = 0; w.bowFlash = function () { window.flashes++; return flash.apply(this, arguments); }; });
  await guest.page.evaluate(() => { Farm.world.dir = 'right'; Farm.world.idle(); });
  await frames(guest.page, 3);
  await guest.page.evaluate(() => Farm.world.shoot());
  const theirShot = await host.page.waitForFunction((id) => {
    const r = Farm.world.remotes[id], s = r && r.shot;
    return s && s.body.active ? { body: s.body.texture.key, real: Farm.world.textures.exists(s.body.texture.key), hidden: !r.spr.visible, bow: !!s.bow.active } : null;
  }, guest.uid, { timeout: 5000, polling: 10 }).then((h) => h.jsonValue()).catch(() => null);
  assert.deepStrictEqual(theirShot, { body: 'archer', real: true, hidden: true, bow: true }, 'their farmer draws the bow, in the plain archer sheet');
  assert.strictEqual(await host.page.evaluate(() => window.flashes), 0, 'no bow flashing with nobody behind it');
  await host.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && !r.shot && r.spr.visible; }, guest.uid, SLOW);
  // their look changes the moment their shot starts (their farmer is made again): nothing of the shot is left floating
  const left = await host.page.evaluate(async (id) => {
    const w = Farm.world, O = Farm.Online, r = w.remotes[id];
    w.remoteShot(r, r.x, r.y, 0, 4 * 256, 0);
    O.others[id] = Object.assign({}, O.others[id], { cs: '' });
    O.syncSprites();
    await new Promise((done) => setTimeout(done, 700));
    const r2 = w.remotes[id];
    return { bows: w.children.list.filter((o) => o.active && o.texture && /^fx-bow-|^archer/.test(o.texture.key)).length, seen: !!(r2 && r2.spr.visible && !r2.shot) };
  }, guest.uid);
  assert.deepStrictEqual(left, { bows: 0, seen: true }, 'a bow (or archer) left behind on the map');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('online: the Great Mammoth: only with two hunters, strength for the crew; 3 hits share the hunt and a Great Tusk, fewer do not (owner, 30 Oct)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server), third = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await nameFarm(third.page, 'Sam Fields');
  const crew = [host, guest, third];
  for (const who of crew) await who.page.evaluate(() => { Farm.Logic.weekendMarket = () => true; Farm.session.state.wild.n = 50; });
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await third.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(third.page, true);
  await waitRemotes(host.page, ['Ana Acres', 'Sam Fields']);
  await host.page.evaluate(() => Farm.world.travel('town', 'from_farm'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await host.page.evaluate(() => Farm.world.travel('magayon', 'trail_south'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'magayon' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  // alone on a weekend: find someone to hunt with? (19zm-hunt-together.js)
  await waitModal(host.page, /THE GREAT MAMMOTH[\s\S]*never shows for one hunter alone/);
  await tapButton(host.page, 'Not now');
  // alone: it never comes
  const arrive = (page) => page.evaluate(() => { const w = Farm.world; for (let i = 0; i < 60; i++) { w.wild.next = 0; w.wildArrive(0); } return w.wild.animals.some((a) => a.def.great); });
  assert.strictEqual(await arrive(host.page), false, 'not for one hunter');
  for (const who of [guest, third]) {
    await who.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('town', 'from_farm'); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
    await who.page.evaluate(() => { Farm.ui.closeAll(); Farm.session.visit.chase = null; Farm.world.travel('magayon', 'trail_south'); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'magayon' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  }
  await waitRemotes(host.page, ['Ana Acres', 'Sam Fields']);
  await host.page.waitForFunction(() => { const w = Farm.world; w.wild.next = 0; w.wildArrive(0); return w.wild.animals.some((a) => a.def.great); }, null, SLOW);
  const great = (page) => page.evaluate(() => { const a = Farm.world.wild.animals.filter((x) => x.def.great)[0]; return a ? { hp: a.hp, max: a.max, slot: a.slot, bar: !!a.bar } : null; });
  assert.deepStrictEqual(await great(host.page).then((g) => [g.hp, g.max, g.bar]), [36, 36, true], '12 for each of the 3 hunters');
  for (const who of [guest, third]) await who.page.waitForFunction(() => Farm.world.wild.animals.some((a) => a.def.great), null, SLOW);
  await waitToast(guest.page, /The Great Mammoth is here/);
  // the guest lands 3 hits, the third hunter 1, and the owner the rest
  const hit = (who, n) => who.page.evaluate((n) => { const w = Farm.world, a = w.wild.animals.filter((x) => x.def.great)[0]; for (let i = 0; i < n; i++) w.wildStruck(a); }, n);
  await hit(guest, 3);
  await hit(third, 1);
  await host.page.waitForFunction(() => { const a = Farm.world.wild.animals.filter((x) => x.def.great)[0]; return a && a.hp === 32; }, null, SLOW);
  await host.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.filter((x) => x.def.great)[0]; w.wildStruck(a); w.wildStruck(a); a.hp = 1; w.wildStruck(a); });
  for (const who of crew) await who.page.waitForFunction(() => !Farm.world.wild.animals.some((a) => a.def.great), null, SLOW);
  const tusk = (who) => who.page.evaluate(() => Farm.world.wildDrops.filter((d) => d.id === 'great_tusk').length + Farm.Logic.countItem(Farm.session.state, 'great_tusk'));
  assert.strictEqual(await tusk(guest), 1, '3 hits');
  assert.strictEqual(await tusk(host), 1, 'the owner too');
  assert.strictEqual(await tusk(third), 0, 'one hit is not enough');
  await waitToast(third.page, /It took 3 hits/);
  for (const who of crew) assert.deepStrictEqual(who.problems, []);
  await Promise.all(crew.map((who) => who.context.close()));
});

test('online: visitors follow the owner to town and into the mine: asked, Follow, both see each other there, on the same rocks', async () => {
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
  await waitFollow(guest.page, /Moon Meadow went to town\. \| Follow/);
  await shot(guest.page, 'follow-1-ask');
  await tapFollow(guest.page);
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
  await waitFollow(guest.page, /went back to the farm/);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy && Farm.world.state.isVisit, null, SLOW);
  assert.strictEqual(await guest.page.evaluate(() => Farm.session.state.map), 'farm', 'your own save is back where it was');
  // Home from their town: your own farm
  await guest.page.evaluate(() => Farm.Online.follow('town'));
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await guest.page.evaluate(() => Farm.Online.leaveVisit());
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy && !Farm.session.visit && !Farm.world.state.isVisit, null, SLOW);
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  // their town's market stall shows what THEY sell (owner, 29 Oct: "i saw my selling and not her")
  await guest.page.evaluate(() => Farm.Online.follow('town'));
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  const stall = await guest.page.evaluate(() => { const o = Farm.world.objects.filter((x) => x.type === 'stand')[0]; const a = Farm.world.extraObjectAction(o); a.run(); return a.label; });
  assert.strictEqual(stall, 'Look');
  await waitModal(guest.page, /Moon Meadow's stall/);
  await guest.page.evaluate(() => Farm.ui.closeAll());
  // the owner goes into the mine (owner, 29 Oct: "i should able to follow her through mine cave"): asked, Follow
  await host.page.evaluate(() => Farm.Online.follow('town'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await host.page.evaluate(() => Farm.world.travel('mine', 'entrance', 2));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'mine' && !Farm.world.busy, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow went to floor 2 of the mine\./);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'mine' && !Farm.world.busy && Farm.session.mineFloor === 2, null, SLOW);
  assert.strictEqual(await guest.page.evaluate(() => Farm.session.visit && Farm.session.visit.name), 'Moon Meadow', 'still visiting');
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await waitRemotes(host.page, ['Ana Acres']);
  // the same rocks, and a rock the owner breaks is gone for the guest too
  const rocks = (page) => page.evaluate(() => Farm.world.mine.rocks.join(','));
  assert.strictEqual(await rocks(guest.page), await rocks(host.page), 'the same rocks');
  const sparks = (page) => page.evaluate(() => Farm.world.mine.spark.join(','));
  assert.strictEqual(await sparks(guest.page), await sparks(host.page), 'the same sparkling rocks');
  const idx = await host.page.evaluate(() => { const w = Farm.world, i = w.mine.rocks.filter((r) => r !== w.mine.stairs)[0]; const t = { x: i % w.map.width, y: Math.floor(i / w.map.width) }; const f = w.breakRock(i, t, {}); if (f) f(); return i; });
  await guest.page.waitForFunction((i) => Farm.world.mine.broken[i] === 1, idx, SLOW);
  await shot(guest.page, 'follow-3-mine');
  // and back up the ladder: their town, still on the visit
  await guest.page.evaluate(() => Farm.world.travel('town', 'from_mine'));
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  assert.strictEqual(await guest.page.evaluate(() => !!(Farm.session.visit && Farm.session.visit.inTown)), true, 'still in their town');
  for (const p of [host, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, guest]) await p.context.close();
});

test('online: a message to a friend shows in the chat at once: the chat stays open while it sends (no flicker), and a second one too', async () => {
  // owner, 8 Nov 2026: "Sending DM looks like off, its flickering or junky" (it closed, waited for the server, opened again)
  const server = createServer();
  const a = await open(server), b = await open(server);
  await nameFarm(a.page, 'Moon Meadow');
  await nameFarm(b.page, 'Sun Patch');
  const code = await b.page.evaluate(() => Farm.Online.me.code);
  await a.page.evaluate((c) => Farm.Net.rpc('farm_friend_add_v1', { p_code: c }), code);
  await b.page.evaluate((id) => Farm.Net.rpc('farm_friend_answer_v1', { p_other: id, p_accept: true }), a.uid);
  await a.page.evaluate(([id]) => Farm.ui.openChat(id, 'Sun Patch'), [b.uid]);
  await waitModal(a.page, /No messages yet/);
  for (const [n, text] of [[1, 'Saan ka na'], [2, 'Saan ka na?']]) {
    // watch every frame: the chat panel is the same one the whole time, never gone
    await a.page.evaluate(() => {
      const panel = Farm.ui.modals[0];
      window.__chat = { panel, lost: 0 };
      const watch = () => { if (Farm.ui.modals[0] !== panel) window.__chat.lost++; window.__chat.raf = requestAnimationFrame(watch); };
      watch();
    });
    await tapButton(a.page, 'Write');
    await type(a.page, text);
    await waitModal(a.page, new RegExp('(^| \\| )' + text.replace('?', '\\?') + '( \\| |$)'));
    await a.page.waitForFunction((k) => Farm.ui.modals.length === 1 && !document.querySelector('#farm-ask'), n, SLOW);
    await a.page.waitForTimeout(600);
    const lost = await a.page.evaluate(() => { cancelAnimationFrame(window.__chat.raf); return window.__chat.lost; });
    assert.strictEqual(lost, 0, 'the chat never closed or swapped while sending (' + text + ')');
    assert.strictEqual(server.db.messages.length, n, 'sent to the server');
  }
  assert.deepStrictEqual(server.db.messages.map((m) => m.body), ['Saan ka na', 'Saan ka na?']);
  // the friend sees both
  await b.page.evaluate(([id]) => Farm.ui.openChat(id, 'Moon Meadow'), [a.uid]);
  await waitModal(b.page, /Saan ka na\?/);
  await shot(a.page, 'online-dm-sent');
  for (const p of [a, b]) assert.deepStrictEqual(p.problems, []);
  for (const p of [a, b]) await p.context.close();
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
  await tapVisit(troll.page, 'More');
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

const tabsOf = (page) => page.evaluate(() => Farm.Online.TABS.map((t) => t[0]).join(','));
const crowns = (page) => page.evaluate(() => {
  let n = 0;
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  const walk = (list) => list.forEach((o) => { if (o.texture && o.texture.key === 'ui-crown') n++; if (o.list) walk(o.list); });
  walk(m.c.list);
  return n;
});

test('online: before part 12 is applied the Town tab, the crown and their calls stay quietly away', async () => {
  const server = createServer();
  const me = await open(server);
  await nameFarm(me.page, 'Quiet Farm');
  await me.page.evaluate(() => Farm.Online.prizes());
  assert.strictEqual(await me.page.evaluate(() => Farm.Online.town), null);
  assert.strictEqual(await me.page.evaluate(() => Farm.Online.best), null);
  assert.ok(!/town/.test(await tabsOf(me.page)), 'no Town tab');
  await me.page.evaluate(() => Farm.ui.openOnline('ranks', 0));
  await waitModal(me.page, /Top 10 win prizes/);
  assert.strictEqual(await toast(me.page), '', 'no message');
  assert.strictEqual(await crowns(me.page), 0);
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});

test('online: the Town Goal: give from the bag, the server takes only 40 a day, the bar moves, and a prize comes once', async () => {
  const server = createServer();
  server.db.town = { kind: 'crop', target: 100, total: 45 };
  const me = await open(server);
  await nameFarm(me.page, 'Town Farm');
  await me.page.evaluate(() => {
    const s = Farm.session.state;
    s.inv[10] = { id: 'tomato', n: 60 };
    s.inv[11] = { id: 'turnip', n: 7 };
    s.inv[12] = { id: 'ore_gold', n: 5 };
    return Farm.Online.townLoad();
  });
  assert.match(await tabsOf(me.page), /market,town,me/);
  await me.page.evaluate(() => Farm.ui.openOnline('town', 0));
  await waitModal(me.page, /Town Goal: crops.*45\/100.*You gave 0.*Give 10 more for the prize.*Best Farm of the Week.*Turnip x7.*Give 7.*Tomato x\d+.*Give 10/);
  await shot(me.page, 'town-1-tab');
  assert.ok(!/Gold Ore/.test(await modalText(me.page)), 'a crop week takes crops, not ore');
  await tapButton(me.page, 'Give 7');
  await waitToast(me.page, /7 more for the goal/);
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'turnip')), 0, 'seven left the bag');
  assert.strictEqual(server.db.town.total, 52);
  for (let i = 0; i < 3; i++) {
    await waitModal(me.page, /Tomato x\d+.*Give 10/);
    await tapButton(me.page, 'Give 10');
    await waitToast(me.page, /10 more for the goal/);
  }
  await waitModal(me.page, /Tomato x30.*Give 3/);
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'tomato')), 30);
  // a game that asks for more than the day's room gets only what the server took
  const paid = await me.page.evaluate(() => Farm.Net.rpc('farm_town_give_v1', { p_n: 500 }).then((r) => Farm.Logic.townPaid(Farm.session.state, 'tomato', 500, r.given)));
  assert.strictEqual(paid, 3);
  assert.strictEqual(server.db.town.mine[me.uid], 40);
  await me.page.evaluate(() => Farm.ui.swapTo(() => Farm.ui.openOnline('town', 0)));
  await waitModal(me.page, /That is all the town can take/);
  await shot(me.page, 'town-3-done');
  await me.page.evaluate(() => Farm.ui.closeAll());
  // the week was reached: the prize, once
  const before = await me.page.evaluate(() => ({ g: Farm.session.state.gold, st: Farm.session.state.stars }));
  server.db.town.prize = { [me.uid]: ['2026-10-26'] };
  server.db.town.bestPrize = me.uid;
  server.db.town.best = { id: me.uid, likes: 12 };
  await me.page.evaluate(() => Farm.Online.prizes());
  await waitModal(me.page, /TOWN PRIZES.*The town reached its goal: \+1,000G and 1 Sunbeam.*Best Farm of the Week: \+5,000G and 5 Sunbeams/);
  await shot(me.page, 'town-4-prizes');
  assert.deepStrictEqual(await me.page.evaluate(() => ({ g: Farm.session.state.gold, st: Farm.session.state.stars })), { g: before.g + 6000, st: before.st + 6 });
  await me.page.evaluate(() => Farm.ui.closeAll());
  await me.page.evaluate(() => Farm.Online.prizes());
  assert.deepStrictEqual(await me.page.evaluate(() => ({ g: Farm.session.state.gold, st: Farm.session.state.stars })), { g: before.g + 6000, st: before.st + 6 }, 'only once');
  // a prize bigger than a prize can be is cut down to size
  server.db.town.prize = {};
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.claimRead([{ gold: 1e9, stars: 1e9 }], 1000, 1)[0].gold), 1000);
  // should the server go away, the tab goes too, with no fuss
  server.db.town = null;
  await me.page.evaluate(() => Farm.Online.townLoad());
  assert.ok(!/town/.test(await tabsOf(me.page)));
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});

test('online: the Town Goal tour opens once, the first time the Town tab opens, and then the tab', async () => {
  const server = createServer();
  server.db.town = { kind: 'crop', target: 100, total: 45 };
  const me = await open(server);
  await nameFarm(me.page, 'Tour Farm');
  await me.page.evaluate(() => Farm.Online.townLoad());
  await me.page.evaluate(() => { window.gameHost.quiet = false; });
  await me.page.evaluate(() => Farm.ui.openOnline('visit', 0));
  await waitModal(me.page, /Online/);
  await me.page.evaluate(() => Farm.ui.swapTo(() => Farm.ui.openOnline('town', 0)));
  await waitModal(me.page, /TOWN GOAL.*Each week all farms work together.*Skip.*Next/);
  assert.strictEqual(await me.page.evaluate(() => Farm.ui.modals.length), 1, 'in place of the Online panel, not over it');
  await me.page.waitForTimeout(600); // the picture fades in
  assert.ok(await me.page.evaluate(() => { let n = 0; const walk = (l) => l.forEach((o) => { if (o.texture && o.texture.key === 'items' && o.alpha > 0 && o.parentContainer && o.parentContainer.alpha === 1) n++; if (o.list) walk(o.list); }); walk(Farm.ui.modals[0].c.list); return n >= 3; }), 'the picture is drawn');
  await shot(me.page, 'town-tour-1');
  await tapButton(me.page, 'Skip');
  await waitModal(me.page, /Town Goal: crops.*45\/100/);
  await me.page.evaluate(() => Farm.ui.closeAll());
  await me.page.evaluate(() => Farm.ui.openOnline('town', 0));
  await waitModal(me.page, /Town Goal: crops.*45\/100/);
  assert.ok(!/TOWN GOAL/.test(await modalText(me.page)), 'once');
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});

test('online: Best Farm of the Week: last week\'s winner wears a crown in the Online lists', async () => {
  const server = createServer();
  server.db.town = {};
  const a = await open(server), b = await open(server);
  await nameFarm(a.page, 'Crown Farm');
  await nameFarm(b.page, 'Plain Farm');
  await a.page.evaluate(() => Farm.Online.publish(true));
  await b.page.evaluate(() => Farm.Online.publish(true));
  await b.page.evaluate(() => Farm.Online.townLoad());
  await b.page.evaluate(() => Farm.ui.openOnline('visit', 0));
  await waitModal(b.page, /Crown Farm/);
  assert.strictEqual(await crowns(b.page), 0, 'no winner yet, no crown');
  await b.page.evaluate(() => Farm.ui.closeAll());
  server.db.town.best = { id: a.uid, likes: 23 };
  await b.page.evaluate(() => Farm.Online.townLoad());
  await b.page.evaluate(() => Farm.ui.openOnline('visit', 0));
  await waitModal(b.page, /Crown Farm/);
  assert.strictEqual(await crowns(b.page), 1, 'one crown, by the winner');
  await shot(b.page, 'town-5-crown');
  await b.page.evaluate(() => Farm.ui.swapTo(() => Farm.ui.openOnline('town', 0)));
  await waitModal(b.page, /Best Farm of the Week.*Crown Farm won last week with 23 likes/);
  assert.strictEqual(await crowns(b.page), 1);
  await shot(b.page, 'town-6-best');
  assert.deepStrictEqual(a.problems, []);
  assert.deepStrictEqual(b.problems, []);
  await a.context.close();
  await b.context.close();
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
  await tapButton(a.page, 'Farm photo');
  // photo mode (19zs-photo.js): the frame, then Snap
  await a.page.waitForFunction(() => Farm.ui.photo, null, SLOW);
  const snapAt = await a.page.evaluate(() => { let b = null; const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text === 'Snap') b = o.getBounds(); if (o.list) walk(o.list); }); walk(Farm.ui.photo.bar.list); return { x: b.centerX, y: b.centerY }; });
  await a.page.touchscreen.tap(snapAt.x, snapAt.y);
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
  server.db.noPart24 = true; // (one refill at a time: before part 24; many at once: the next test)
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
  await waitModal(me.page, /REFILL ENERGY\?.*\+100 energy \(40 to 140\) for 5 Selebox Coins\./); // (always the whole 100, 5 Nov 2026)
  // the server takes the payment but the answer is lost: no energy yet, and the request is kept in the save
  server.db.loseNextBuyAnswer = true;
  await tapButton(me.page, 'Yes');
  await me.page.waitForFunction(() => /If it was paid, the energy comes/.test(Farm.ui.toastText ? Farm.ui.toastText.text : ''), null, SLOW);
  assert.strictEqual(await me.page.evaluate(() => Farm.session.state.energy), 40, 'no energy without an answer');
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.serialize(Farm.session.state).pb.length), 1, 'kept in the save');
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 7, stars: 5 }, 'it was paid');
  // a while later (the game reopened, or a new tap): the server says it was paid, so the energy arrives, once
  await me.page.evaluate(() => { Farm.session.state.net.pb[0][4] -= 60000; return Farm.Logic.settleRefills(); });
  await me.page.waitForFunction(() => Farm.session.state.energy === 140, null, SLOW);
  assert.match(await me.page.evaluate(() => Farm.ui.toastText.text), /Your last refill arrived: \+100 energy\./);
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
  await me.page.waitForFunction(() => Farm.session.state.energy === 170 && Farm.ui.modals.length === 0, null, SLOW);
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 2, stars: 5 });
  assert.strictEqual(await me.page.evaluate(() => window.__spent), 2);
  // full: Refill is still there (it adds its whole 100 on top), and the energy past the max survives a reload
  await me.page.evaluate(() => Farm.ui.openEnergy());
  await waitModal(me.page, /Energy 170 \/ 100[\s\S]*Your energy is full!/);
  assert.ok(/\| Refill$|\| Refill \|/.test(await modalText(me.page)), 'Refill when full');
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.deserialize(JSON.parse(JSON.stringify(Farm.Logic.serialize(Farm.session.state)))).energy), 170);
  // not enough Coins: Get Coins opens the Selebox store
  server.db.wallets.set(me.uid, { coins: 2, stars: 0 });
  await me.page.evaluate(() => { Farm.ui.closeAll(); Farm.session.state.energy = 10; Farm.ui.openRefill(); });
  await waitModal(me.page, /You have 2 Selebox Coins: not enough/); // (the row's words end in … beside Get Coins)
  await tapButton(me.page, 'Get Coins');
  assert.strictEqual(await me.page.evaluate(() => window.__store), 1);
  assert.deepStrictEqual(me.problems, []);
  await me.context.close();
});

test('online: many refills in one payment: x10, x50, Max (owner, 8 Nov 2026: "refill it x10, or x100")', async () => {
  const server = createServer();
  const me = await open(server);
  server.db.wallets.set(me.uid, { coins: 600, stars: 100 });
  server.db.refillsLeft = 1000;
  await me.page.evaluate(() => {
    window.__spent = 0;
    window.gameHost.shop = true;
    window.gameHost.spent = () => { window.__spent++; };
    Farm.session.state.energy = 40;
    Farm.ui.closeAll();
    Farm.ui.openRefill();
  });
  await waitModal(me.page, /Refill energy.*You have 600 Selebox Coins\./);
  // Buy (Coins): how many, starting at 10
  await tapButton(me.page, 'Buy');
  await waitModal(me.page, /Refill energy.*\+100 energy each.*5 Selebox Coins each  ·  you have 600.*x10.*up to 99 now.*\+1,000 energy.*Energy 40 to 1,040.*Buy x10: 50 Selebox Coins/);
  const picks = await me.page.evaluate(() => Farm.ui.modals[Farm.ui.modals.length - 1].c.list.filter((o) => o.qty).map((o) => o.qty));
  assert.deepStrictEqual(picks, [1, 10, 50, 99], 'x100 does not fit under 9,999 energy: Max (99) instead');
  await shot(me.page, 'online-15b-refill-qty');
  // Max: 99 refills (what fits under 9,999)
  await tapButton(me.page, 'Max');
  await waitModal(me.page, /x99.*\+9,900 energy.*Energy 40 to 9,940.*Max: what fits \(energy goes up to 9,999\).*Buy x99: 495 Selebox Coins/);
  // back to 50
  await tapButton(me.page, 'x50');
  await waitModal(me.page, /x50.*\+5,000 energy.*Buy x50: 250 Selebox Coins/);
  await tapButton(me.page, 'Buy x50: 250 Selebox Coins');
  await waitModal(me.page, /REFILL ENERGY\?.*50 refills: \+5,000 energy \(40 to 5,040\) for 250 Selebox Coins\./);
  await tapButton(me.page, 'Yes');
  await me.page.waitForFunction(() => Farm.session.state.energy === 5040 && Farm.ui.modals.length === 0, null, SLOW);
  assert.match(await me.page.evaluate(() => Farm.ui.toastText.text), /\+5,000 energy! Paid 250 Selebox Coins\./);
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 350, stars: 100 }, 'one payment of 250');
  assert.strictEqual(server.db.purchases.size, 1, 'one receipt');
  assert.strictEqual(server.db.refillsLeft, 950, 'the day counts 50 refills');
  // a lost answer for many: settled once, by its request id, the whole 5,000
  server.db.loseNextBuyAnswer = true;
  await me.page.evaluate(() => { Farm.session.state.energy = 40; Farm.ui.openRefill(); });
  await tapButton(me.page, 'Buy');
  await waitModal(me.page, /Buy x10: 50 Selebox Coins/);
  await tapButton(me.page, 'Buy x10: 50 Selebox Coins');
  await tapButton(me.page, 'Yes');
  await me.page.waitForFunction(() => /If it was paid, the energy comes/.test(Farm.ui.toastText ? Farm.ui.toastText.text : ''), null, SLOW);
  assert.strictEqual(await me.page.evaluate(() => Farm.session.state.energy), 40);
  await me.page.evaluate(() => { Farm.session.state.net.pb[0][4] -= 60000; return Farm.Logic.settleRefills(); });
  await me.page.waitForFunction(() => Farm.session.state.energy === 1040, null, SLOW);
  assert.match(await me.page.evaluate(() => Farm.ui.toastText.text), /Your last refill arrived: \+1000 energy\./);
  assert.deepStrictEqual(server.db.wallets.get(me.uid), { coins: 300, stars: 100 }, 'charged once: 50');
  // Stars: energy goes up to 1,000 with Stars, so at 40 energy at most 9 refills
  await me.page.evaluate(() => { Farm.ui.closeAll(); Farm.session.state.energy = 40; Farm.ui.openRefill(); });
  await waitModal(me.page, /You have 100 Selebox Stars\./);
  await tapButton(me.page, 'Buy', 1);
  await waitModal(me.page, /x9.*up to 9 now.*Max: what fits \(energy goes up to 1,000\).*Buy x9: 90 Selebox Stars/);
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
  // wearing a look (owner, 8 Nov 2026: "when i visit and my character landed, it was in old clothes")
  server.db.looksOwned.set(guest.uid, ['fire']);
  await guest.page.evaluate(() => Farm.Online.loadLooks());
  await guest.page.evaluate(() => Farm.ui.wearLook('fire'));
  await guest.page.waitForFunction(() => Farm.world.player.texture.key === 'look_fire_boy', null, SLOW);
  await guest.page.waitForTimeout(1500);
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  assert.strictEqual(await guest.page.evaluate(() => Farm.world.player.texture.key), 'look_fire_boy', 'you land in your look, before a step');
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

test('online: on a visit the rain sound follows the weather you see (29 Oct, OPPO: rain sound on a sunny visit)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  // (the suite keeps every day sunny: here odd days rain, on both phones) a rainy day for their copy, a dry one for you
  const wx = () => { Farm.Logic.weather = (s, d) => (d % 2 ? 'rain' : 'sunny'); };
  await host.page.evaluate(wx);
  await guest.page.evaluate(wx);
  const start = await guest.page.evaluate(() => Farm.session.state.day);
  const days = { rain: start + (start % 2 ? 2 : 3), dry: start + (start % 2 ? 3 : 2) };
  await host.page.evaluate((d) => { Farm.session.state.day = d; return Farm.Online.publish(true); }, days.rain);
  await guest.page.evaluate((d) => { Farm.session.state.day = d; Farm.ui.refresh(); }, days.dry);
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await guest.page.waitForTimeout(300);
  const seen = await guest.page.evaluate(() => ({ sound: Farm.Audio.ambientKind, rainFx: /rain|storm/.test(Farm.ui.weatherKey || '') }));
  assert.strictEqual(seen.rainFx, false, 'the screen shows your dry day');
  assert.strictEqual(seen.sound, null, 'so no rain sound');
  // and on a wet day of yours, the rain sound plays on their farm too
  await guest.page.evaluate(() => Farm.Online.leaveVisit());
  await waitWorld(guest.page, false);
  await guest.page.evaluate((d) => { Farm.session.state.day = d; }, days.rain);
  await host.page.evaluate((d) => { Farm.session.state.day = d; return Farm.Online.publish(true); }, days.dry);
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await guest.page.waitForTimeout(300);
  assert.ok(await guest.page.evaluate(() => /rain|storm/.test(Farm.ui.weatherKey) && !!Farm.Audio.ambientKind), 'rain on screen and in your ears');
  assert.deepStrictEqual(guest.problems, []);
  assert.deepStrictEqual(host.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('online: a friend\'s hammer swing plays on your screen, and the rock pops when it lands (owner, 3 Nov)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await host.page.evaluate(() => Farm.Online.follow('town'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await waitFollow(guest.page, /went to town\./);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await host.page.evaluate(() => Farm.world.travel('mine', 'entrance', 2));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'mine' && !Farm.world.busy, null, SLOW);
  await waitFollow(guest.page, /went to floor 2 of the mine\./);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'mine' && !Farm.world.busy && Farm.session.mineFloor === 2, null, SLOW);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await waitRemotes(host.page, ['Ana Acres']);
  // the owner hammers a rock (the guest knows which, to see it still there as the swing starts)
  const pick = await host.page.evaluate(() => { const w = Farm.world; return w.mine.rocks.filter((r) => r !== w.mine.stairs && !w.mine.broken[r])[0]; });
  await guest.page.evaluate((i) => { window.__rock = i; }, pick);
  const idx = await host.page.evaluate(() => {
    const w = Farm.world, T = Farm.Config.TILE, i = w.mine.rocks.filter((r) => r !== w.mine.stairs && !w.mine.broken[r])[0];
    const t = { x: i % w.map.width, y: Math.floor(i / w.map.width) };
    w.setFeet((t.x + 0.5) * T, (t.y + 1.5) * T); w.dir = 'up'; w.idle();
    Farm.Online.tellPlace();
    return new Promise((r) => setTimeout(() => { w.useTool('hammer', t, 0); r(i); }, 600));
  });
  // the guest sees them raise and strike it, with the hammer in hand, and the rock is still there as it starts
  const swing = await guest.page.waitForFunction((hostId) => {
    const w = Farm.world, r = w.remotes[hostId];
    if (!r || !r.tool || !(r.useUntil > w.time.now)) return null;
    const i = window.__rock, t = { x: i % w.map.width, y: Math.floor(i / w.map.width) };
    return { frame: Number(r.spr.frame.name), tool: r.tool.texture.key, rock: !!w.layers.Walls.getTileAt(t.x, t.y) };
  }, host.uid, { ...SLOW, polling: 10 }).then((h) => h.jsonValue()).catch(() => null);
  void idx;
  assert.ok(swing, 'their swing shows');
  assert.ok(swing.frame >= 9 && swing.frame <= 14, 'a tool pose, not the walk: ' + swing.frame);
  assert.strictEqual(swing.tool, 'items');
  await shot(guest.page, 'swing-1-friend-strikes');
  await guest.page.waitForFunction((i) => Farm.world.mine.broken[i] === 1, idx, SLOW);
  // when it is done, their hammer goes and they stand as before
  await guest.page.waitForFunction((hostId) => { const w = Farm.world, r = w.remotes[hostId]; return r && !r.tool && !(r.useUntil > w.time.now); }, host.uid, SLOW);
  // a big moment is shared: the owner finds the ladder down, and the guest hears it (owner, 3 Nov)
  await host.page.evaluate(() => { const w = Farm.world, i = w.mine.stairs; w.breakRock(i, { x: i % w.map.width, y: Math.floor(i / w.map.width) }, {}); });
  await waitToast(guest.page, /Moon Meadow found the ladder down!/);
  for (const p of [host, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, guest]) await p.context.close();
});

test('online: a friend fishing: their bobber in the water, the bite, and the fish they land (owner, 3 Nov)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await waitRemotes(host.page, ['Ana Acres']);
  await guest.page.evaluate(() => { const P = Farm.WorldScene.prototype, end = P.remoteFishEnd; window.__landed = []; P.remoteFishEnd = function (r, icon) { if (r.fish) window.__landed.push(icon); return end.call(this, r, icon); }; });
  // the owner casts at the pond
  await host.page.evaluate(() => {
    const w = Farm.world, T = Farm.Config.TILE, s = Farm.session.state;
    Farm.Logic.addItem(s, 'rod', 1); Farm.Config.FISH_WINDOW = 1e9;
    w.setFeet(14 * T + T / 2, 4 * T + T / 2); w.dir = 'right'; w.idle(); Farm.Online.tellPlace();
  });
  await new Promise((r) => setTimeout(r, 800));
  await host.page.evaluate(() => Farm.world.startFishing({ x: 15, y: 4 }));
  const bob = await guest.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && r.fish && r.fish.bob.active ? { x: Math.round(r.fish.bob.x), y: Math.round(r.fish.bob.y) } : null; }, host.uid, SLOW).then((h) => h.jsonValue());
  const T = await host.page.evaluate(() => Farm.Config.TILE);
  assert.deepStrictEqual([Math.floor(bob.x / T), Math.floor(bob.y / T)], [15, 4], 'their bobber, where they cast');
  // a bite: the guest sees the "!" over them
  await host.page.evaluate(() => { Farm.world.fishing.biteAt = 0; });
  await guest.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && r.fish && r.fish.mark; }, host.uid, SLOW);
  await shot(guest.page, 'fish-1-friend-bite');
  // they reel it in: it jumps out of the water on the guest's phone, and the bobber goes
  await host.page.evaluate(() => { const G = Farm.Config.FISH_GAME; ['fish_s', 'fish_m', 'fish_l', 'fish_k'].forEach((k) => { G[k].zone = 1; }); G.fill = 50; G.drain = 0; Farm.input.action = true; });
  await host.page.waitForFunction(() => !Farm.world.fishing && !Farm.ui.game2, null, SLOW);
  await guest.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && !r.fish && window.__landed.length; }, host.uid, SLOW);
  const landed = await guest.page.evaluate(() => window.__landed);
  assert.strictEqual(landed.length, 1);
  assert.ok(landed[0] >= 0, 'a fish, with its picture');
  // a cast that ends without a fish just takes the bobber away
  await host.page.evaluate(() => Farm.world.startFishing({ x: 15, y: 4 }));
  await guest.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && r.fish; }, host.uid, SLOW);
  await host.page.evaluate(() => Farm.world.endFishing());
  await guest.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && !r.fish; }, host.uid, SLOW);
  assert.deepStrictEqual((await guest.page.evaluate(() => window.__landed)).slice(1), [-1]);
  for (const p of [host, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, guest]) await p.context.close();
});

test('online: the owner\'s farm changes live for a visitor: a weed cut, soil tilled and watered, and today\'s field on arrival (owner, 3 Nov)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  // before the visit: the owner tills a tile (the published copy does not have it yet)
  const plan = await host.page.evaluate(() => {
    const w = Farm.world, s = w.state, W = w.map.width;
    s.energy = 100;
    const weeds = Object.keys(s.debris).map(Number).filter((i) => s.debris[i] === 'weed');
    const early = weeds[0], weed = weeds[1];
    w.useTool('sickle', { x: early % W, y: Math.floor(early / W) }, 0);
    return { early, weed, W };
  });
  await host.page.waitForTimeout(400);
  const tillEarly = await host.page.evaluate((p) => { const w = Farm.world; w.useTool('hoe', { x: p.early % p.W, y: Math.floor(p.early / p.W) }, 0); return !!w.state.soil[p.early]; }, plan);
  assert.ok(tillEarly, 'the owner tilled it');
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  await waitRemotes(host.page, ['Ana Acres']);
  await guest.page.waitForFunction((i) => !!Farm.world.state.soil[i] && !Farm.world.state.debris[i], plan.early, SLOW);
  // while the guest watches: a weed cut, then tilled, then watered
  const at = (page, i) => page.evaluate((i) => ({ weed: Farm.world.state.debris[i] || null, soil: Farm.world.state.soil[i] ? { w: Farm.world.state.soil[i].w } : null, debrisTile: !!Farm.world.layers.Debris.getTileAt(i % Farm.world.map.width, Math.floor(i / Farm.world.map.width)) }), i);
  assert.deepStrictEqual(await at(guest.page, plan.weed), { weed: 'weed', soil: null, debrisTile: true });
  await host.page.evaluate((p) => Farm.world.useTool('sickle', { x: p.weed % p.W, y: Math.floor(p.weed / p.W) }, 0), plan);
  await guest.page.waitForFunction((i) => !Farm.world.state.debris[i] && !Farm.world.layers.Debris.getTileAt(i % Farm.world.map.width, Math.floor(i / Farm.world.map.width)), plan.weed, SLOW);
  await host.page.waitForTimeout(300);
  await host.page.evaluate((p) => Farm.world.useTool('hoe', { x: p.weed % p.W, y: Math.floor(p.weed / p.W) }, 0), plan);
  await guest.page.waitForFunction((i) => !!Farm.world.state.soil[i], plan.weed, SLOW);
  await host.page.waitForTimeout(300);
  await host.page.evaluate((p) => { Farm.world.state.water = 10; Farm.world.useTool('can', { x: p.weed % p.W, y: Math.floor(p.weed / p.W) }, 0); }, plan);
  await guest.page.waitForFunction((i) => Farm.world.state.soil[i] && Farm.world.state.soil[i].w === 1, plan.weed, SLOW);
  await shot(guest.page, 'live-farm-1-guest');
  // the guest's own farm is never touched
  assert.strictEqual(await guest.page.evaluate(() => Farm.world.state !== Farm.session.state), true, 'the visit is its own copy');
  for (const p of [host, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, guest]) await p.context.close();
});

test('online: a Coins look from the Tailor Shop: paid once on the server, yours on every phone, and a friend sees you in it (owner, 3 Nov)', async () => {
  const fs = require('fs');
  const server = createServer();
  const me = await open(server), friend = await open(server);
  await nameFarm(me.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  server.db.wallets.set(me.uid, { coins: 200, stars: 0 });
  void fs;
  for (const p of [me, friend]) {
    await p.page.evaluate(() => { window.gameHost.shop = true; window.gameHost.spent = () => { window.__spent = (window.__spent || 0) + 1; }; });
  }
  await me.page.evaluate(() => Farm.ui.openTailor('shop', 1));
  await waitModal(me.page, /Santa Claus[\s\S]*150 Coins/);
  await shot(me.page, 'tailor-online-1');
  await tapButton(me.page, '150 Coins');
  await waitModal(me.page, /BUY THIS LOOK\?[\s\S]*Santa Claus for 150 Coins/);
  await tapButton(me.page, 'Yes');
  await waitModal(me.page, /IT IS YOURS!/);
  assert.strictEqual(server.db.wallets.get(me.uid).coins, 50, 'paid once, on the server');
  assert.deepStrictEqual(server.db.looksOwned.get(me.uid), ['santa']);
  assert.strictEqual(await me.page.evaluate(() => window.__spent), 1, 'the app refreshes the wallet');
  await tapButton(me.page, 'Wear it');
  await me.page.waitForFunction(() => Farm.world.player.texture.key.indexOf('look_santa_') === 0, null, SLOW);
  // on another phone (a fresh save that never heard of it), the server says it is yours
  await me.page.evaluate(() => { Farm.session.state.lk = 0; Farm.session.state.cw = ''; Farm.Online.looks = null; });
  await me.page.evaluate(() => Farm.Online.loadLooks());
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.ownsLook(Farm.session.state, 'santa')), true);
  // the friend visits: they see the owner in Santa's suit
  await me.page.evaluate(() => Farm.ui.wearLook('santa'));
  await friend.page.evaluate((id) => Farm.Online.visit(id), me.uid);
  await waitWorld(friend.page, true);
  await waitRemotes(friend.page, ['Moon Meadow (owner)']);
  await friend.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && r.spr.texture.key.indexOf('look_santa_') === 0; }, me.uid, SLOW);
  await shot(friend.page, 'tailor-online-2-friend-sees');
  // taking it off: they see the farmer's own clothes again
  await me.page.evaluate(() => Farm.ui.wearLook(''));
  await friend.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && r.spr.texture.key.indexOf('look_') !== 0; }, me.uid, SLOW);
  // buying again is refused by the server, and nothing is taken
  const again = await me.page.evaluate(() => Farm.Net.rpc('farm_look_buy_v1', { p_look: 'santa', p_currency: 'coins', p_price: 150, p_version: 1, p_request_id: '11111111-1111-4111-8111-111111111111' }));
  assert.strictEqual(again.code, 'owned');
  assert.strictEqual(server.db.wallets.get(me.uid).coins, 50);
  for (const p of [me, friend]) assert.deepStrictEqual(p.problems, []);
  for (const p of [me, friend]) await p.context.close();
});

test('online: Hunting now: whoever is out hunting shows, with Join; Join walks you there without asking; home again, off the list; the Biggest catch board (owner, 3 Nov)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  // the owner goes hunting in their own game: the server knows
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await host.page.waitForFunction(() => true, null, SLOW);
  for (let i = 0; i < 50 && !(server.db.hunting.get(host.uid) || {}).map; i++) await new Promise((r) => setTimeout(r, 100));
  assert.strictEqual(server.db.hunting.get(host.uid).map, 'pulag');
  // the guest finds them under Online, Friends: Hunting now
  await guest.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(guest.page, /Hunting now/);
  await tapButton(guest.page, 'See');
  await waitModal(guest.page, /Hunting now[\s\S]*Moon Meadow[\s\S]*Pulag Grassland\. (Just went in|\d+ min so far)\./);
  await shot(guest.page, 'hunting-now');
  await tapButton(guest.page, 'Join');
  // to their farm, to town and on to Pulag, with no "hunt together?" on the way
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild && Farm.session.visit, null, SLOW);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  assert.ok(!(await guest.page.evaluate(() => Farm.ui.modals.length)), 'nothing to answer on the way');
  assert.ok(!server.db.hunting.has(guest.uid), 'on a visit you are not listed: the owner is');
  // their dogs: yours follows you, and the owner's follows them on your screen
  await guest.page.waitForFunction((id) => Farm.world.huntDog && Farm.world.friendDogs[id], host.uid, SLOW);
  // the Biggest catch: the guest's hunt is on the week's board for that animal
  await guest.page.evaluate(() => { Farm.Online.recordCatch('deer', 66.1); });
  await host.page.evaluate(() => { Farm.Online.recordCatch('deer', 59.4); });
  for (let i = 0; i < 50 && server.db.catches.size < 2; i++) await new Promise((r) => setTimeout(r, 100));
  await waitToast(guest.page, /#1 this week for the biggest Deer/);
  await guest.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.onlineKind = { visit: 'popular', ranks: 'catch' }; Farm.ui.catchKind = 'deer'; Farm.ui.openOnline('ranks', 0); });
  await waitModal(guest.page, /Showing: Biggest catch[\s\S]*Animal: Deer[\s\S]*#1 Ana Acres \(you\)[\s\S]*Deer, 66\.1 kg\.[\s\S]*#2 Moon Meadow[\s\S]*Deer, 59\.4 kg/);
  await shot(guest.page, 'biggest-catch');
  await tapButton(guest.page, 'Next');
  await waitModal(guest.page, /Animal: Wild Boar[\s\S]*No catches yet/);
  // home again: off the list
  await guest.page.evaluate(() => Farm.ui.closeAll());
  await host.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.wildKeep(); Farm.Online.follow('town'); });
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  for (let i = 0; i < 50 && server.db.hunting.has(host.uid); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(!server.db.hunting.has(host.uid));
  assert.deepStrictEqual(guest.problems, []);
  assert.deepStrictEqual(host.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('online: before part 14 is applied, Hunting now, the friend card and the Biggest catch hide quietly', async () => {
  const server = createServer();
  server.db.noHunt = true;
  const host = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
  await host.page.evaluate(() => Farm.Online.follow('pulag'));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'pulag' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await host.page.waitForFunction(() => Farm.Online.huntOff === true, null, SLOW);
  await host.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(host.page, /Your code/);
  assert.ok(!/Hunting now/.test(await modalText(host.page)), 'no Hunting now row');
  await host.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.onlineKind = { visit: 'popular', ranks: 'catch' }; Farm.ui.openOnline('ranks', 0); });
  await waitModal(host.page, /Coming soon/);
  assert.deepStrictEqual(host.problems, []);
  await host.context.close();
});

test('online: the Fishing Derby: on Fish Monday each fish goes to the board, the biggest of each kind; Next for another fish; not on other days (owner, 4 Nov)', async () => {
  const server = createServer();
  const a = await open(server), b = await open(server);
  await nameFarm(a.page, 'Moon Meadow');
  await nameFarm(b.page, 'Ana Acres');
  for (const who of [a, b]) await who.page.evaluate(() => { Farm.Logic.derbyOn = () => true; });
  // two fish each: only the bigger counts
  await a.page.evaluate(() => { Farm.Online.recordDerby({ id: 'fish_l', kg: 3.2 }); Farm.Online.recordDerby({ id: 'fish_l', kg: 4.1 }); });
  await b.page.evaluate(() => { Farm.Online.recordDerby({ id: 'fish_l', kg: 5.5 }); });
  for (let i = 0; i < 50 && server.db.derby.size < 2; i++) await new Promise((r) => setTimeout(r, 100));
  await new Promise((r) => setTimeout(r, 300));
  assert.strictEqual(server.db.derby.get('fish_l:' + a.uid), 4100);
  assert.strictEqual(server.db.derby.get('fish_l:' + b.uid), 5500);
  await waitToast(b.page, /#1 in the Fishing Derby for Large Fish!/);
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.onlineKind = { visit: 'popular', ranks: 'derby' }; Farm.ui.derbyKind = 'fish_l'; Farm.ui.openOnline('ranks', 0); });
  await waitModal(a.page, /Showing: Fishing Derby[\s\S]*Fish: Large Fish[\s\S]*#1 Ana Acres[\s\S]*Large Fish, 5\.5 kg\.[\s\S]*#2 Moon Meadow \(you\)[\s\S]*Large Fish, 4\.1 kg/);
  assert.match(await modalText(a.page), /The Derby is on until midnight/);
  await shot(a.page, 'derby-board');
  await tapButton(a.page, 'Next');
  await waitModal(a.page, /Fish: King Trout[\s\S]*No catches yet/);
  // another day: nothing is sent, and the board is last Monday's
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.Logic.derbyOn = () => false; Farm.Online.recordDerby({ id: 'fish_s', kg: 0.3 }); Farm.ui.derbyKind = 'fish_l'; Farm.ui.openOnline('ranks', 0); });
  await waitModal(a.page, /Monday's Derby\. Next one: Monday!/);
  assert.ok(!server.db.derby.has('fish_s:' + a.uid));
  for (const who of [a, b]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([a.context.close(), b.context.close()]);
});

test('online: Bakunawa\'s Lair: two hunters on floor 50, the Bakunawa rises only for two, a shared hunt pays both, it does not rise again that day, and a visitor is asked to follow the owner to another floor (owner, 4 Nov)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  for (const who of [host, guest]) {
    await who.page.evaluate(() => { const s = Farm.session.state; s.wild.n = 50; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 20); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  }
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  const down50 = async (who) => {
    await who.page.evaluate(() => { Farm.ui.closeAll(); if (Farm.session.visit) Farm.session.visit.chase = null; Farm.world.travel('town', 'from_farm'); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
    await who.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('lair', 'entrance', 50); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'lair' && Farm.session.lairFloor === 50 && !Farm.world.busy && Farm.world.wild, null, SLOW);
    await who.page.evaluate(() => Farm.ui.closeAll());
  };
  await down50(host);
  const arrive = (page) => page.evaluate(() => { const w = Farm.world; for (let i = 0; i < 60; i++) { w.wild.next = 0; w.wildArrive(0); } return w.wild.animals.some((a) => a.kind === 'bakunawa'); });
  assert.deepStrictEqual(await host.page.evaluate(() => Farm.world.wild.animals.map((a) => a.kind)), ['tikbalang', 'tikbalang'], 'it sleeps: only its two Tikbalang');
  assert.strictEqual(await arrive(host.page), false, 'not for one hunter');
  // the guest comes down to the same floor: they see each other and hunt together (the owner, there first, runs it)
  await down50(guest);
  await waitRemotes(host.page, ['Ana Acres']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  assert.strictEqual(await host.page.evaluate((id) => Farm.Online.others[id].fl, guest.uid), 50);
  assert.strictEqual(await guest.page.evaluate(() => Farm.world.wildFollowing()), host.uid);
  await host.page.waitForFunction(() => { const w = Farm.world; w.wild.next = 0; w.wildArrive(0); return w.wild.animals.some((a) => a.kind === 'bakunawa'); }, null, SLOW);
  const bk = (page) => page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'bakunawa'); return a ? { hp: a.hp, max: a.max, bar: !!a.bar, own: a.img.tintTopLeft === 0xffffff } : null; }); // (own: its own picture, no tint over it)
  assert.deepStrictEqual(await bk(host.page), { hp: 40, max: 40, bar: true, own: true }, '20 for each of the 2 hunters');
  await guest.page.waitForFunction(() => Farm.world.wild.animals.some((a) => a.kind === 'bakunawa'), null, SLOW);
  await waitToast(guest.page, /The Bakunawa rises/);
  await shot(guest.page, 'lair-bakunawa');
  // the Fire look's 1 in 10 (owner, 5 Nov): the guest's roll comes up, the owner's does not
  await guest.page.evaluate(() => { const h = Farm.Logic.bakunawaHunted; Farm.Logic.bakunawaHunted = (s) => h(s, 0.05); });
  await host.page.evaluate(() => { const h = Farm.Logic.bakunawaHunted; Farm.Logic.bakunawaHunted = (s) => h(s, 0.5); });
  // the guest lands 3 hits and the owner the rest: a hunt for both, with its scales, and no Great Tusk
  await guest.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'bakunawa'); for (let i = 0; i < 3; i++) w.wildStruck(a); });
  await host.page.waitForFunction(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'bakunawa'); return a && a.hp === 37; }, null, SLOW);
  await host.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'bakunawa'); w.wildStruck(a); w.wildStruck(a); a.hp = 1; w.wildStruck(a); });
  for (const who of [host, guest]) await who.page.waitForFunction(() => !Farm.world.wild.animals.some((a) => a.kind === 'bakunawa'), null, SLOW);
  const paid = (who) => who.page.evaluate(() => {
    const s = Farm.session.state, have = (id) => Farm.world.wildDrops.filter((d) => d.id === id).length + Farm.Logic.countItem(s, id);
    return { scales: have('bakunawa_scale'), tusk: have('great_tusk'), today: s.lair.bk === s.day, ready: Farm.Logic.bakunawaReady(s) };
  });
  for (const who of [host, guest]) await who.page.waitForFunction(() => Farm.session.state.lair.bk === Farm.session.state.day, null, SLOW);
  assert.deepStrictEqual(await paid(guest), { scales: 2, tusk: 0, today: true, ready: false });
  assert.deepStrictEqual(await paid(host), { scales: 2, tusk: 0, today: true, ready: false });
  await guest.page.waitForFunction(() => /The Lair's fire chose you! The Fire look is yours/.test(Farm.ui.toastText.text), null, SLOW);
  await shot(guest.page, 'lair-fire-look-won');
  assert.deepStrictEqual(await Promise.all([guest, host].map((who) => who.page.evaluate(() => Farm.Logic.ownsLook(Farm.session.state, 'fire')))), [true, false], 'only the lucky one');
  // not again today, whoever runs the floor
  assert.strictEqual(await arrive(host.page), false);
  await host.page.evaluate(() => Farm.ui.closeAll());
  await host.page.evaluate(() => Farm.world.travel('lair', 'entrance', 50));
  await host.page.waitForFunction(() => Farm.world.mapKey === 'lair' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await waitRemotes(host.page, ['Ana Acres']);
  assert.strictEqual(await guest.page.evaluate(() => Farm.world.wildFollowing()), null, 'the guest was there first now');
  assert.strictEqual(await arrive(guest.page), false);
  // the owner takes the lift up to floor 41: the guest, still on 50, is asked to follow, and goes straight there
  await guest.page.evaluate(() => Farm.ui.closeAll());
  await host.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('lair', 'entrance', 41); });
  await host.page.waitForFunction(() => Farm.session.lairFloor === 41 && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await waitRemotes(guest.page, []);
  for (let i = 0; i < 20 && !/went up to floor 41/.test(await followText(guest.page)); i++) { if (await modalText(guest.page)) await guest.page.evaluate(() => Farm.ui.closeModal()); await new Promise((r) => setTimeout(r, 500)); }
  assert.match(await followText(guest.page), /Moon Meadow went up to floor 41 of the Lair\. \| Follow/);
  await tapFollow(guest.page);
  await guest.page.waitForFunction(() => Farm.session.lairFloor === 41 && Farm.world.mapKey === 'lair' && !Farm.world.busy && Farm.world.wild, null, SLOW);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  assert.ok(await guest.page.evaluate(() => Farm.session.state.lair.deep < 41), 'a floor reached behind a friend is not yours');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

// ---------- animal breeds (src/19zz-breeding.js) ----------
test('online: animal breeds: a visitor sees the owner\'s Golden Hen and Moonlight Pig in their own colours, and nothing new goes in the visitor\'s Breeds book', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await host.page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic;
    s.gold = 9999;
    L.buyAnimal(s, 'pig');
    s.animals[0].br = 3;
    s.animals[1].br = 3;
    return Farm.Online.publish(true);
  });
  await guest.page.waitForTimeout(1500);
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await guest.page.waitForFunction(() => Farm.world.herd && Farm.world.herd.members.length === 2, null, SLOW);
  // (a colour is painted after the map's first frame, one a frame: 19zz-breeding.js)
  await guest.page.waitForFunction(() => !Farm.world.breedQueue, null, SLOW);
  assert.deepStrictEqual(await guest.page.evaluate(() => Farm.world.herd.members.map((m) => m.sprite.texture.key)), ['animals_br_chicken_3', 'animals_br_pig_3']);
  assert.deepStrictEqual(await guest.page.evaluate(() => Farm.world.herd.members.map((m) => m.sprite.alpha)), [1, 1], 'shown once painted');
  // the owner's colours are their pictures (art-src/breeds), shadows too
  assert.deepStrictEqual(await guest.page.evaluate(() => Farm.world.herd.members.map((m) => { const kind = Farm.world.state.animals[m.i].kind; return [m.sprite.texture.source[0].image === Farm.images['breed_' + kind + '_' + Farm.Config.BREEDS[kind][3].key], m.sh.texture.key]; })),
    [[true, 'animalshade_br_chicken_3'], [true, 'animalshade_br_pig_3']]);
  assert.deepStrictEqual(await guest.page.evaluate(() => [Farm.Logic.breedsFound(Farm.session.state, 'chicken'), Farm.Logic.breedsFound(Farm.session.state, 'pig')]), [1, 0], 'seeing is not finding');
  await shot(guest.page, 'breeds-visit');
  await guest.page.evaluate(() => Farm.Online.leaveVisit());
  await waitWorld(guest.page, false);
  assert.deepStrictEqual(await guest.page.evaluate(() => Farm.world.herd.members.map((m) => m.sprite.texture.key)), ['animals']);
  // and the owner's colours are let go again on the guest's own farm
  await guest.page.waitForFunction(() => !Object.keys(Farm.game.textures.list).some((k) => /^animal(s|shade)_br_/.test(k)), null, SLOW);
  assert.deepStrictEqual(guest.problems, []);
  assert.deepStrictEqual(host.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

// ---------- barangays and the Bayanihan Cup (supabase/farm_online_16.sql), the Market board (_17.sql) ----------
// Does the picked Cup task in the game (the counter it counts), as playing would.
const doCupTask = (page) => page.evaluate(() => {
  const s = Farm.session.state, c = Farm.Config.NB.tasks[s.nb.k].counter;
  if (c === 'fish' || c === 'cooked') s.stats[c] += s.nb.g; else Farm.Logic.bump(s, c, s.nb.g);
});

test('online: barangays: make one, a friend finds and joins it, a Cup task done counts by itself, the League, Members and News; last week\'s prize, once (owner, 4 Nov)', async () => {
  const server = createServer();
  server.db.cupFast = true; // (the real server waits a task's least minutes: test/sql/social-checks.sql)
  const a = await open(server), b = await open(server);
  await nameFarm(a.page, 'Moon Meadow');
  await nameFarm(b.page, 'Ana Acres');
  for (const p of [a, b]) await p.page.evaluate(() => Farm.Online.nbLoad());
  // Online, Friends: the Barangays row; Find; Make your own
  await a.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(a.page, /Barangays[\s\S]*Team up with up to 30 farms/);
  await shot(a.page, 'nb-1-friends-row');
  await tapButton(a.page, 'Find');
  await waitModal(a.page, /Make your own[\s\S]*Have a code\?/);
  await tapButton(a.page, 'Make');
  await type(a.page, 'Barangay Mabuhay');
  await waitModal(a.page, /A badge for Barangay Mabuhay/);
  await shot(a.page, 'nb-2-badge');
  await tapButton(a.page, 'Choose', 0);
  await waitModal(a.page, /WHO CAN JOIN\?/);
  await tapButton(a.page, 'Open');
  await waitModal(a.page, /Barangay Mabuhay[\s\S]*Pick a task/);
  await waitToast(a.page, /Barangay Mabuhay is yours! Anyone can join/);
  await shot(a.page, 'nb-3-cup-tab');
  assert.strictEqual([...server.db.hoods.values()][0].leader, a.uid);
  // the friend finds it and joins
  await b.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(b.page, /Barangays/);
  await tapButton(b.page, 'Find');
  await waitModal(b.page, /Barangay Mabuhay[\s\S]*1 of 30 farms/);
  await shot(b.page, 'nb-4-find');
  await tapButton(b.page, 'Join');
  await waitToast(b.page, /Welcome to Barangay Mabuhay! Pick a Cup task/);
  // pick a task: it counts only from now, and turns itself in when it is done
  const kind = await b.page.evaluate(() => Farm.Online.nb.tasks[0].kind);
  await b.page.evaluate(() => { const s = Farm.session.state; Farm.Logic.bump(s, 'harvest', 500); s.stats.fish += 99; });
  await tapButton(b.page, 'Pick');
  await waitToast(b.page, /Your task: .*\. Go for it!/);
  assert.strictEqual(await b.page.evaluate(() => Farm.Logic.nbProgress(Farm.session.state).n), 0, 'what was done before the pick does not count');
  assert.strictEqual(server.db.cupPicks.get(b.uid).kind, kind);
  await shot(b.page, 'nb-5-picked');
  await b.page.evaluate(() => Farm.ui.closeAll());
  await doCupTask(b.page);
  await waitToast(b.page, /Bayanihan Cup: .* done! \+\d+ points for Barangay Mabuhay\./);
  await shot(b.page, 'nb-6-done-toast');
  assert.strictEqual(server.db.cupDone.length, 1);
  assert.strictEqual(await b.page.evaluate(() => Farm.session.state.nb), null);
  // the League tab: the barangay is #1 of its group; the Members tab: who did what; the friend's save keeps nothing extra
  await b.page.evaluate(() => Farm.ui.openHood('league', 0));
  await waitModal(b.page, /Small league[\s\S]*#1 Barangay Mabuhay \(you\)[\s\S]*\d+ points/);
  await shot(b.page, 'nb-7-league');
  await b.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openHood('members', 0); });
  await waitModal(b.page, /Open to all[\s\S]*Ana Acres \(you\)[\s\S]*1 task, \d+ points this week[\s\S]*Moon Meadow \(leader\)/);
  await shot(b.page, 'nb-8-members');
  assert.ok(!/Code:|New code|Code [A-Z0-9]{6} for friends/.test(await modalText(b.page)), 'only the leader is shown the code');
  // the leader makes a new code (a kicked member's old code stops working)
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openHood('members', 0); });
  await waitModal(a.page, /Open to all \| Code [A-Z0-9]{6} for friends/);
  const oldCode = [...server.db.hoods.values()][0].code;
  await tapButton(a.page, 'New code');
  await waitModal(a.page, /MAKE A NEW CODE\?/);
  await tapButton(a.page, 'Yes');
  await waitToast(a.page, /The new code is [A-Z0-9]{6}\./);
  assert.notStrictEqual([...server.db.hoods.values()][0].code, oldCode);
  // News: a line from the friend; the leader reads it, with who joined and the task
  await b.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openHood('news', 0); });
  await waitModal(b.page, /Write/);
  await tapButton(b.page, 'Write');
  await type(b.page, 'Kumusta, mga kapitbahay!');
  await waitModal(b.page, /"Kumusta, mga kapitbahay!"/);
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openHood('news', 0); });
  await waitModal(a.page, /Ana Acres[\s\S]*"Kumusta, mga kapitbahay!"[\s\S]*Finished a Cup task: \+\d+ points![\s\S]*Joined the barangay/);
  await shot(a.page, 'nb-9-news');
  // the Friends tab says how the barangay stands
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.Online.nbLoad().then(() => Farm.ui.openOnline('friends', 0)); });
  await waitModal(a.page, /Barangay Mabuhay[\s\S]*2 farms\. Cup: #1, \d+ points\./);
  // the week ends: the friend's prize when the game connects, once
  for (const d of server.db.cupDone) d.week = '2026-01-05';
  for (const [k, v] of [...server.db.cupHoods]) { server.db.cupHoods.delete(k); v.week = '2026-01-05'; server.db.cupHoods.set('2026-01-05:' + v.hood, v); }
  const gold = await b.page.evaluate(() => Farm.session.state.gold);
  await b.page.evaluate(() => { Farm.ui.closeAll(); Farm.Online.cupClaim(); });
  await waitModal(b.page, /BAYANIHAN CUP PRIZES[\s\S]*Thank you for taking part! Barangay Mabuhay: \+500G\./);
  await shot(b.page, 'nb-10-prize');
  assert.strictEqual(await b.page.evaluate(() => Farm.session.state.gold), gold + 500);
  assert.strictEqual((await b.page.evaluate(() => Farm.Online.cupClaim())).length, 0, 'paid once');
  // leaving: the friend is out; the leader alone
  await b.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openHood('members', 0); });
  await waitModal(b.page, /Leave/);
  await b.page.evaluate(() => Farm.ui.openHood('members', 1));
  await waitModal(b.page, /The tasks you finished still count/);
  await tapButton(b.page, 'Leave');
  await waitModal(b.page, /LEAVE BARANGAY MABUHAY\?/);
  await tapButton(b.page, 'Yes');
  await waitToast(b.page, /You left the barangay/);
  assert.ok(!server.db.hoodOf.has(b.uid));
  for (const p of [a, b]) assert.deepStrictEqual(p.problems, []);
  await Promise.all([a.context.close(), b.context.close()]);
});

test('online: the Market board: Advertise puts your stall on it for 4 hours, once a day; a friend Looks, opens the stall and buys (owner, 4 Nov)', async () => {
  const server = createServer();
  const a = await open(server), b = await open(server);
  await nameFarm(a.page, 'Moon Meadow');
  await nameFarm(b.page, 'Ana Acres');
  // nothing for sale yet: Advertise says so
  await a.page.evaluate(() => Farm.ui.openOnline('market', 0));
  await waitModal(a.page, /Market board[\s\S]*Advertise free once a day/);
  await tapButton(a.page, 'Advertise');
  await waitToast(a.page, /Put something up for sale first/);
  // a lot at the stall, then Advertise
  await a.page.evaluate(() => { Farm.Logic.addItem(Farm.session.state, 'turnip', 10); });
  await a.page.evaluate(() => Farm.Net.rpc('farm_market_list_v1', { p_item: 'turnip', p_qty: 10, p_price: 300 }).then(() => { Farm.Logic.removeItem(Farm.session.state, 'turnip', 10); }));
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openOnline('market', 0); });
  await waitModal(a.page, /Market board/);
  await tapButton(a.page, 'Advertise');
  await waitToast(a.page, /Your stall is on the Market board for 4 hours!/);
  await waitModal(a.page, /Your stall is on it: 4 h left/);
  await shot(a.page, 'ads-1-advertised');
  assert.ok(!/Advertise/.test(await modalText(a.page)), 'once a day');
  assert.strictEqual((await a.page.evaluate(() => Farm.Net.rpc('farm_market_ad_v1', {}))).code, 'used');
  // the friend: the board, the stall, Buy
  const turnips = await b.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'turnip'));
  await b.page.evaluate(() => { Farm.session.state.gold = 1000; Farm.ui.openOnline('market', 0); });
  await waitModal(b.page, /Market board[\s\S]*1 farm on it\. Advertise free/);
  await shot(b.page, 'ads-2-market-tab');
  await tapButton(b.page, 'Look');
  await waitModal(b.page, /Market board[\s\S]*Moon Meadow[\s\S]*10 Turnip for 300G\./);
  await shot(b.page, 'ads-3-board');
  assert.match(await modalText(b.page), /Visit/);
  await tapButton(b.page, 'Stall');
  await waitModal(b.page, /Moon Meadow's stall[\s\S]*10 Turnip[\s\S]*300G \(30G each\)/);
  await tapButton(b.page, 'Buy');
  await waitToast(b.page, /Bought 10 Turnip from Moon Meadow for 300G/);
  await waitModal(b.page, /Moon Meadow sold everything already!/);
  await shot(b.page, 'ads-4-bought');
  assert.strictEqual(await b.page.evaluate(() => Farm.session.state.gold), 700);
  assert.strictEqual(await b.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'turnip')), turnips + 10);
  // Back to the board: sold out, off it
  await tapButton(b.page, 'Back');
  await waitModal(b.page, /No stalls on the board right now/);
  for (const p of [a, b]) assert.deepStrictEqual(p.problems, []);
  await Promise.all([a.context.close(), b.context.close()]);
});

test('online: before parts 16 and 17 are applied, barangays and the Market board hide quietly', async () => {
  const server = createServer();
  server.db.noHood = true;
  server.db.noAds = true;
  const a = await open(server);
  await nameFarm(a.page, 'Moon Meadow');
  await a.page.waitForFunction(() => Farm.Online.nbOff === true, null, SLOW);
  await a.page.evaluate(() => Farm.ui.openOnline('friends', 0));
  await waitModal(a.page, /Your code/);
  assert.ok(!/Barangay/.test(await modalText(a.page)), 'no Barangays row');
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openOnline('market', 0); });
  await waitModal(a.page, /Shopping list/);
  assert.ok(!/Market board/.test(await modalText(a.page)), 'no Market board row');
  assert.strictEqual(await a.page.evaluate(() => Farm.Online.adsOff), true);
  assert.deepStrictEqual(a.problems, []);
  await a.context.close();
});

test('online: the Barangays tour the first time Online, Friends opens with its row, the Market board tour the first time the Market tab opens; each once (owner, 4 Nov)', async () => {
  const server = createServer();
  const a = await open(server);
  await nameFarm(a.page, 'Moon Meadow');
  await a.page.evaluate(() => Farm.Online.nbLoad());
  await a.page.evaluate(() => { window.gameHost.quiet = false; Farm.ui.openOnline('friends', 0); });
  await waitModal(a.page, /BARANGAYS[\s\S]*A barangay is a team of up to 30 farms/);
  await shot(a.page, 'nb-tour-1');
  await tapButton(a.page, 'Next');
  await waitModal(a.page, /Bayanihan Cup: the same tasks for all/);
  await tapButton(a.page, 'Next');
  await waitModal(a.page, /Prizes every Monday/);
  await tapButton(a.page, 'Got it');
  await waitModal(a.page, /Your code[\s\S]*Barangays/);
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openOnline('friends', 0); });
  await waitModal(a.page, /Your code[\s\S]*Barangays/);
  assert.ok(!/A barangay is a team/.test(await modalText(a.page)), 'once');
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openOnline('market', 0); });
  await waitModal(a.page, /THE MARKET BOARD[\s\S]*Advertise puts your Market stall on the board/);
  await shot(a.page, 'ads-tour-1');
  await tapButton(a.page, 'Next');
  await tapButton(a.page, 'Got it');
  await waitModal(a.page, /Shopping list[\s\S]*Market board/);
  await a.page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openOnline('market', 0); });
  await waitModal(a.page, /Shopping list[\s\S]*Market board/);
  assert.ok(!/THE MARKET BOARD/.test(await modalText(a.page)), 'once');
  assert.deepStrictEqual(a.problems, []);
  await a.context.close();
});

test('online: a changed game cannot flood the owner\'s phone with server calls or clear a mine floor it was not asked about (4 Nov review)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(host.page, ['Ana Acres']);
  await host.page.evaluate(() => { window.__claims = 0; const c = Farm.Online.claimHelps; Farm.Online.claimHelps = function () { window.__claims++; return c.apply(this, arguments); }; });
  await guest.page.evaluate(() => { for (let i = 0; i < 25; i++) Farm.Online.send('help', {}); });
  await new Promise((r) => setTimeout(r, 2000));
  assert.strictEqual(await host.page.evaluate(() => window.__claims), 1, 'one call now');
  await host.page.waitForFunction(() => window.__claims === 2, null, { timeout: 30000 });
  await new Promise((r) => setTimeout(r, 1000));
  assert.strictEqual(await host.page.evaluate(() => window.__claims), 2, 'and one after the wait: not 25');
  // a rocks list nobody asked for is ignored
  const took = await host.page.evaluate(() => {
    let n = 0;
    const w = Farm.world, r = w.remoteRock;
    w.remoteRock = function () { n++; };
    Farm.Online.rocksAsked = 0;
    Farm.Online.onMessage('rocks', { id: Object.keys(Farm.Online.others)[0], fl: Farm.session.mineFloor, l: [1, 2, 3] });
    w.remoteRock = r;
    return n;
  });
  assert.strictEqual(took, 0);
  assert.deepStrictEqual(host.problems, []);
  assert.deepStrictEqual(guest.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('online: the Lair\'s Fire look, given by the server, is worn, and a visiting friend sees it, swinging a tool in it too (5 Nov 2026)', async () => {
  const server = createServer();
  const me = await open(server), friend = await open(server);
  await nameFarm(me.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  // (how it is won is the owner's to say; here the server simply says it is yours)
  server.db.looksOwned.set(me.uid, ['fire']);
  await me.page.evaluate(() => Farm.Online.loadLooks());
  assert.strictEqual(await me.page.evaluate(() => Farm.Logic.ownsLook(Farm.session.state, 'fire')), true);
  await me.page.evaluate(() => Farm.ui.wearLook('fire'));
  await me.page.waitForFunction(() => Farm.world.player.texture.key === 'look_fire_boy', null, SLOW);
  await friend.page.evaluate((id) => Farm.Online.visit(id), me.uid);
  await waitWorld(friend.page, true);
  await waitRemotes(friend.page, ['Moon Meadow (owner)']);
  await friend.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && r.spr.texture.key === 'look_fire_boy'; }, me.uid, SLOW);
  await waitRemotes(me.page, ['Ana Acres']);
  // the owner swings the hoe: the friend sees the raise and strike from the Fire look's own frames
  await me.page.evaluate(() => { const w = Farm.world; w.dir = 'left'; w.idle(); Farm.Online.tellPlace(); });
  await me.page.waitForTimeout(600);
  await me.page.evaluate(() => Farm.world.animateUse(Farm.Config.ICON.hoe, 'swing'));
  const swing = await friend.page.waitForFunction((id) => {
    const w = Farm.world, r = w.remotes[id];
    if (!r || !r.tool || !(r.useUntil > w.time.now)) return null;
    return { key: r.spr.texture.key, frame: Number(r.spr.frame.name) };
  }, me.uid, { ...SLOW, polling: 10 }).then((h) => h.jsonValue()).catch(() => null);
  assert.ok(swing, 'their swing shows');
  assert.strictEqual(swing.key, 'look_fire_boy');
  assert.ok(swing.frame >= 9 && swing.frame <= 14, 'a tool pose: ' + swing.frame);
  await shot(friend.page, 'fire-look-online-friend-sees');
  for (const p of [me, friend]) assert.deepStrictEqual(p.problems, []);
  for (const p of [me, friend]) await p.context.close();
});

test('online: something dropped on a farm, a friend there walks onto it and it reaches their bag as a gift; not friends, it stays on the ground (5 Nov 2026)', async () => {
  const server = createServer();
  const host = await open(server), friend = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(friend.page, 'Ana Acres');
  await host.page.evaluate(() => Farm.Online.publish(true));
  await friend.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await friend.page.waitForFunction((id) => Farm.world && Farm.world.state && Farm.world.state.isVisit && Farm.world.remotes && Farm.world.remotes[id], host.uid, { timeout: 60000 });
  // the friend drops 5 grilled fish next to them
  await friend.page.evaluate(() => { const s = Farm.session.state; s.inv[8] = { id: 'grilled_fish', n: 5 }; Farm.world.dropOnGround(8, 5); });
  assert.strictEqual(await friend.page.evaluate(() => Farm.session.state.inv[8]), null, 'out of their bag');
  // the owner sees it on their farm
  await host.page.waitForFunction(() => Object.keys(Farm.ground.theirs).length === 1, null, { timeout: 60000 });
  await host.page.waitForFunction(() => Object.keys(Farm.world.groundImgs || {}).length === 1, null, { timeout: 60000 });
  const walkOnto = () => host.page.evaluate(() => { const d = Object.values(Farm.ground.theirs)[0]; Farm.world.player.body.reset(d.x, d.y); });
  // not friends: the server says no, it stays on the ground
  await walkOnto();
  await host.page.waitForTimeout(3000);
  assert.strictEqual(await friend.page.evaluate(() => Farm.ground.mine.length), 1, 'still on the ground');
  assert.strictEqual(await host.page.evaluate(() => Farm.Logic.countItem(Farm.session.state, 'grilled_fish')), 0);
  // friends now: still standing on it, the owner's phone asks again (every 4 s) and it reaches their bag
  server.db.follows.push({ by: host.uid, who: friend.uid }, { by: friend.uid, who: host.uid });
  await host.page.waitForFunction(() => Farm.Logic.countItem(Farm.session.state, 'grilled_fish') === 5, null, { timeout: 60000 });
  await friend.page.waitForFunction(() => Farm.ground.mine.length === 0, null, { timeout: 60000 });
  await host.page.waitForFunction(() => Object.keys(Farm.ground.theirs).length === 0, null, { timeout: 60000 });
  assert.deepStrictEqual(server.db.gives.map((g) => [g.item, g.n]).slice(-1)[0], ['grilled_fish', 5]);
  // a pile is at most 99 (a slot holds 999 since 7 Nov 2026, a gift is up to 99): of 500, 99 go down and 401 stay
  await friend.page.evaluate(() => { const s = Farm.session.state; s.inv[8] = { id: 'egg', n: 500 }; Farm.world.dropOnGround(8, 500); });
  assert.deepStrictEqual(await friend.page.evaluate(() => [Farm.session.state.inv[8].n, Farm.ground.mine[0].n]), [401, 99]);
  await walkOnto();
  await host.page.waitForFunction(() => Farm.Logic.countItem(Farm.session.state, 'egg') === 99, null, { timeout: 60000 });
  assert.deepStrictEqual(server.db.gives.map((g) => [g.item, g.n]).slice(-1)[0], ['egg', 99], 'the whole pile, as one gift');
  for (const p of [host, friend]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, friend]) await p.context.close();
});

// ---------- Central Park (owner, 6 Nov 2026: "its for everyone park"; src/19zzz-c-park-online.js) ----------
const PT = 256;
const stickOn = (page, jx, jy) => page.evaluate(([x, y]) => { Farm.input.jx = x; Farm.input.jy = y; }, [jx, jy]);
const waitMapOn = (page, map) => page.waitForFunction((m) => Farm.world && Farm.world.mapKey === m && !Farm.world.busy && Farm.world.player.active, map, SLOW);
const until = async (fn, what, ms = 20000) => {
  const end = Date.now() + ms;
  while (!(await fn())) {
    if (Date.now() > end) throw new Error('waited for ' + what);
    await new Promise((r) => setTimeout(r, 100));
  }
};
// To the top of the park road in town (in the game you walk there from the Station), then up it into the park.
async function walkIntoPark(page) {
  await page.evaluate(() => Farm.world.travel('town', 'from_park'));
  await waitMapOn(page, 'town');
  await stickOn(page, 0, -1);
  await waitMapOn(page, 'park');
  await stickOn(page, 0, 0);
}
// Out of the south gate, back to town.
async function walkOutOfPark(page) {
  await page.evaluate((T) => { Farm.world.setFeet(20.5 * T, 31.5 * T); Farm.world.dir = 'down'; }, PT);
  await stickOn(page, 0, 1);
  await waitMapOn(page, 'town');
  await stickOn(page, 0, 0);
}
const waitChip = (page, text) => page.waitForFunction((t) => Farm.ui.parkChipBox && Farm.ui.parkChipBox.visible && Farm.ui.parkChipText.text === t, text, SLOW);
const chipShown = (page) => page.evaluate(() => !!(Farm.ui.parkChipBox && Farm.ui.parkChipBox.visible));
const tapChip = async (page) => {
  const at = await page.evaluate(() => { const b = Farm.ui.parkChipBox; return { x: b.x + Farm.ui.parkChipW / 2, y: b.y + 12 }; });
  await page.touchscreen.tap(at.x, at.y);
  await waitModal(page, /CENTRAL PARK/);
};
// the park's position messages one phone sent (the server's count: one sent, plus one for each phone that hears it)
const parkMoves = (server, uid, from, to = Infinity) => server.db.sends.filter((s) => s.uid === uid && /^park:/.test(s.room) && s.event === 'mv' && s.at >= from && s.at < to);
const seats = (server) => [1, 2, 3].map((n) => [...server.db.parkSeats.values()].filter((s) => s.park === n && Date.now() - s.seen < 75e3).length);

test('online: Central Park: two walk in from town and see each other and chat; a third makes 3; Park 2 moves one away; full parks; leaving frees the seat; one move a second, none standing (owner, 6 Nov 2026)', async () => {
  const server = createServer();
  const ana = await open(server), ben = await open(server);
  await nameFarm(ana.page, 'Ana Acres');
  await nameFarm(ben.page, 'Ben Barn');
  await ben.page.evaluate(() => { Farm.Config.ONLINE.park.beatEvery = 1500; }); // (his "still here" comes quickly, for the test)

  // ----- in from town: Park 1, a toast and the chip; each sees the other, by name
  await walkIntoPark(ana.page);
  await waitToast(ana.page, /^Central Park 1 · 1 here$/);
  await waitChip(ana.page, 'Park 1 · 1/30');
  // alone in the park, the Chat button is there all the same (owner, 7 Nov 2026: "chat is not showing in the central
  // park"): a public place, where whoever comes next can be greeted
  await ana.page.waitForFunction(() => Farm.ui.chatBtn.visible, null, SLOW);
  assert.strictEqual(await ana.page.evaluate(() => Farm.Online.say('Anyone here?')), '', 'she may talk with nobody else there yet');
  await walkIntoPark(ben.page);
  await waitToast(ben.page, /^Central Park 1 · 2 here$/);
  await waitRemotes(ana.page, ['Ben Barn']);
  await waitRemotes(ben.page, ['Ana Acres']);
  await waitChip(ana.page, 'Park 1 · 2/30');
  await waitChip(ben.page, 'Park 1 · 2/30');
  assert.deepStrictEqual(await ana.page.evaluate(() => [Farm.Online.topic, Farm.Online.home && Farm.Online.home.topic]), ['park:1', 'farm:' + ana.uid], 'the park\'s room; her own farm\'s room kept');
  // her own farm's room says she went to the park (a friend on her farm sees where she went)
  await until(() => [...(server.topics.get('farm:' + ana.uid) || [])].some((c) => c.key === ana.uid && c.state && c.state.map === 'park'), 'her farm room to say park');
  assert.deepStrictEqual(seats(server), [2, 0, 0]);
  await shot(ana.page, 'park-1-two');

  // ----- chat: the Chat button, a line over her head on both phones
  await ana.page.waitForFunction(() => Farm.ui.chatBtn.visible, null, SLOW);
  const chatGap = await ana.page.evaluate(() => Farm.Config.CHAT.gap); // (her line before, alone: the gap between two lines)
  await new Promise((r) => setTimeout(r, chatGap + 50));
  assert.strictEqual(await ana.page.evaluate(() => Farm.Online.say('Hello, park!')), '');
  await ben.page.waitForFunction((id) => Farm.world.bubbles[id] && Farm.world.bubbles[id].c.list[1].text === 'Hello, park!', ana.uid, SLOW);
  assert.ok(await ben.page.evaluate(() => Farm.Online.chatLog.some((l) => l.name === 'Ana Acres' && l.text === 'Hello, park!')));

  // ----- the message budget: Ben walks across the plaza for 6 s, then stands 3 s; Ana watches him walk
  await ben.page.evaluate((T) => { Farm.world.setFeet(13.5 * T, 21.5 * T); Farm.world.dir = 'right'; }, PT); // (across the plaza, below the fountain)
  await new Promise((r) => setTimeout(r, 1500));
  await ana.page.evaluate((T) => Farm.world.setFeet(20.5 * T, 13.5 * T), PT); // (where she can see the walk)
  const seen = ana.page.evaluate((id) => new Promise((done) => { // every frame Ana sees of him, for 4 s
    const r = Farm.world.remotes[id], list = [], t0 = performance.now();
    const step = () => { const t = performance.now() - t0; list.push([t, r.x, r.y]); if (t < 4000) requestAnimationFrame(step); else done(list); };
    step();
  }), ben.uid);
  const t0 = Date.now();
  await stickOn(ben.page, 1, 0);
  await new Promise((r) => setTimeout(r, 2200));
  await stickOn(ben.page, -1, 0);
  await new Promise((r) => setTimeout(r, 2200));
  await stickOn(ben.page, 1, 0);
  await new Promise((r) => setTimeout(r, 1600));
  const t1 = Date.now();
  await stickOn(ben.page, 0, 0);
  const walking = parkMoves(server, ben.uid, t0, t1);
  await new Promise((r) => setTimeout(r, 3600));
  const stopping = parkMoves(server, ben.uid, t1, t1 + 500), standing = parkMoves(server, ben.uid, t1 + 500, t1 + 3600);
  const rate = walking.length / ((t1 - t0) / 1000);
  console.log('park moves: walking ' + walking.length + ' in ' + ((t1 - t0) / 1000).toFixed(1) + ' s (' + rate.toFixed(2) + '/s), stopping ' + stopping.length + ', standing 3.1 s: ' + standing.length);
  assert.ok(rate >= 0.8 && rate <= 1.4, 'about one a second while walking: ' + rate.toFixed(2));
  assert.ok(stopping.length >= 1 && stopping.length <= 2, 'one "stopped": ' + stopping.length);
  assert.strictEqual(stopping.filter((s) => s.event === 'mv').length, stopping.length);
  assert.strictEqual(standing.length, 0, 'nothing while standing still');
  // smooth on Ana's phone: drawn about a second behind, at an even walk (no stops and starts between the messages), no jumps
  const list = await seen, mid = list.filter((f) => f[0] > 1600 && f[0] < 3100);
  let stalls = 0, frames = 0, jump = 0;
  for (let i = 1; i < list.length; i++) jump = Math.max(jump, Math.hypot(list[i][1] - list[i - 1][1], list[i][2] - list[i - 1][2]));
  for (let i = 1; i < mid.length; i++) {
    const dt = mid[i][0] - mid[i - 1][0];
    if (dt < 1) continue;
    frames++;
    if (Math.hypot(mid[i][1] - mid[i - 1][1], mid[i][2] - mid[i - 1][2]) / dt * 1000 < Farm_SPEED * 0.25) stalls++;
  }
  assert.ok(frames > 10, 'enough frames to judge: ' + frames);
  assert.ok(stalls / frames < 0.05, 'stopped on ' + stalls + ' of ' + frames + ' frames');
  assert.ok(jump < 0.5 * PT, 'no jump: the biggest step in a frame was ' + Math.round(jump));
  const benAt = await ben.page.evaluate(() => { const f = Farm.world.feet(); return { x: f.x, y: f.y }; });
  await ana.page.waitForFunction(([id, f]) => { // he ends where he stopped, standing
    const r = Farm.world.remotes[id];
    return r && r.anim === '' && Math.hypot(r.x - f.x, r.y - f.y) < 12;
  }, [ben.uid, benAt], SLOW);

  // ----- a crowd (more than 20 others; here the line is moved to 0 for the test): one move every 2 s, and Ana draws him
  // that much further behind
  await ben.page.evaluate(() => { Farm.Config.ONLINE.park.busyAt = 0; });
  const t2 = Date.now();
  await stickOn(ben.page, -1, 0);
  await new Promise((r) => setTimeout(r, 2000));
  await stickOn(ben.page, 1, 0);
  await new Promise((r) => setTimeout(r, 2000));
  await stickOn(ben.page, -1, 0);
  await new Promise((r) => setTimeout(r, 2000));
  const t3 = Date.now();
  await stickOn(ben.page, 0, 0);
  const crowd = parkMoves(server, ben.uid, t2, t3), crowdRate = crowd.length / ((t3 - t2) / 1000);
  console.log('park moves in a crowd: ' + crowd.length + ' in ' + ((t3 - t2) / 1000).toFixed(1) + ' s (' + crowdRate.toFixed(2) + '/s)');
  assert.ok(crowdRate >= 0.3 && crowdRate <= 0.7, 'about one every 2 s: ' + crowdRate.toFixed(2));
  assert.strictEqual(await ana.page.evaluate((id) => Farm.Online.trails[id].every, ben.uid), 2000);
  await ben.page.evaluate(() => { Farm.Config.ONLINE.park.busyAt = 20; });
  await new Promise((r) => setTimeout(r, 2500));

  // ----- "still here": a seat the server lost comes back at the next beat, in the same park
  server.db.parkSeats.delete(ben.uid);
  await until(() => server.db.parkSeats.has(ben.uid), 'Ben seated again');
  assert.strictEqual(server.db.parkSeats.get(ben.uid).park, 1);
  assert.strictEqual(await ben.page.evaluate(() => Farm.Online.topic), 'park:1');

  // ----- a third phone: 3 here
  const cy = await open(server);
  await nameFarm(cy.page, 'Cy Coop');
  await walkIntoPark(cy.page);
  await waitToast(cy.page, /^Central Park 1 · 3 here$/);
  await waitRemotes(ana.page, ['Ben Barn', 'Cy Coop']);
  await waitRemotes(cy.page, ['Ana Acres', 'Ben Barn']);
  await waitChip(ana.page, 'Park 1 · 3/30');
  await waitChip(cy.page, 'Park 1 · 3/30');
  await shot(cy.page, 'park-2-three');

  // ----- the chip opens the parks: Cy goes to Park 2, and the others no longer see him
  await tapChip(cy.page);
  assert.match(await modalText(cy.page), /Park 1 \| 3\/30 \| You are here \| Park 2 \| 0\/30 \| Go \| Park 3 \| 0\/30 \| Go \| Close/);
  await shot(cy.page, 'park-3-parks');
  await tapButton(cy.page, 'Go', 0);
  await waitToast(cy.page, /^Central Park 2 · 1 here$/);
  await waitChip(cy.page, 'Park 2 · 1/30');
  assert.strictEqual(await cy.page.evaluate(() => Farm.Online.topic), 'park:2');
  await waitRemotes(ana.page, ['Ben Barn']);
  await waitRemotes(ben.page, ['Ana Acres']);
  await waitRemotes(cy.page, []);
  await waitChip(ana.page, 'Park 1 · 2/30');
  assert.deepStrictEqual(seats(server), [2, 1, 0]);

  // ----- full parks (2 a park for the test): Park 1 is full for Cy; a fourth phone goes where there is room
  server.db.parkCap = 2;
  await tapChip(cy.page);
  await tapButton(cy.page, 'Go', 0); // (Park 1)
  await waitToast(cy.page, /^Park 1 is full right now\.$/);
  assert.strictEqual(await cy.page.evaluate(() => Farm.Online.topic), 'park:2');
  const dee = await open(server);
  await nameFarm(dee.page, 'Dee Dairy');
  await walkIntoPark(dee.page);
  await waitToast(dee.page, /^Central Park 2 · 2 here$/);
  await waitRemotes(dee.page, ['Cy Coop']);
  await waitRemotes(cy.page, ['Dee Dairy']);

  // ----- Wave on someone in the park: their card, to say hi, add a friend, or More; a blocked player is not drawn
  await cy.page.evaluate(() => Farm.ui.parkPlayer(Object.keys(Farm.world.remotes)[0]));
  assert.match(await modalText(cy.page), /SAY HI \| Dee Dairy is in Central Park with you\. \| More \| Add friend \| Wave/);
  await tapButton(cy.page, 'Add friend');
  await waitToast(cy.page, /Friend request sent to Dee Dairy/);
  await cy.page.evaluate((id) => Farm.ui.blockPlayer(id, 'Dee Dairy', true), dee.uid);
  await waitModal(cy.page, /BLOCK THIS FARMER/);
  await tapButton(cy.page, 'Yes');
  await waitRemotes(cy.page, []);
  await new Promise((r) => setTimeout(r, 1200));
  assert.deepStrictEqual(await remotes(cy.page), [], 'still not drawn after the next presence and moves');

  // ----- Ana leaves the park: her seat is free at once, and Ben sees her go
  const leftAt = Date.now();
  await walkOutOfPark(ana.page);
  await until(() => !server.db.parkSeats.has(ana.uid), 'Ana\'s seat freed');
  assert.deepStrictEqual(seats(server), [1, 2, 0]);
  await waitRemotes(ben.page, []);
  // gone from Ben's park at once (she said bye), not after the wait for a dropped line (owner, 7 Nov 2026: "stuck at the exit")
  assert.ok(Date.now() - leftAt < 3000, 'gone in ' + (Date.now() - leftAt) + ' ms');
  assert.ok(server.db.sends.some((x) => x.uid === ana.uid && x.event === 'bye' && x.room === 'park:1'), 'she said bye in the park');
  await waitChip(ben.page, 'Park 1 · 1/30');
  assert.strictEqual(await ana.page.evaluate(() => Farm.Online.topic), 'farm:' + ana.uid, 'back in her own farm\'s room');
  assert.strictEqual(await chipShown(ana.page), false);

  // ----- every park full (players on other phones fill the rest): Ana is turned back at the gate
  const crypto = require('crypto');
  server.db.parkSeats.set(crypto.randomUUID(), { park: 1, seen: Date.now() });
  for (let i = 0; i < 2; i++) server.db.parkSeats.set(crypto.randomUUID(), { park: 3, seen: Date.now() });
  await ana.page.evaluate(() => Farm.world.travel('park', 'from_town'));
  await waitModal(ana.page, /CENTRAL PARK \| Central Park is full right now\. Try again in a minute\./);
  assert.strictEqual(await ana.page.evaluate(() => Farm.world.mapKey), 'town', 'stepped back out to town');
  assert.deepStrictEqual(await ana.page.evaluate(() => { const f = Farm.world.feet(), T = Farm.Config.TILE; return [Math.floor(f.x / T), Math.floor(f.y / T)]; }), [36, 1], 'at from_park');
  await shot(ana.page, 'park-4-full');
  assert.ok(!server.db.parkSeats.has(ana.uid));
  assert.strictEqual(await chipShown(ana.page), false);

  for (const p of [ana, ben, cy, dee]) assert.deepStrictEqual(p.problems, []);
  for (const p of [ana, ben, cy, dee]) await p.context.close();
});

test('online: Central Park from a friend\'s town ends the visit: you are in the park as yourself, and the friend joins you; leaving online play there leaves the park, and it says to join online play (owner, 6 Nov 2026)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  // into their town (your own game there), up the park road
  await guest.page.evaluate(() => Farm.world.travel('town', 'from_park'));
  await guest.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy && Farm.session.visit && Farm.session.visit.inTown, null, SLOW);
  await waitFollow(guest.page, /Moon Meadow went back to the farm\./); // (the owner is on the farm: a banner, nothing to close)
  await stickOn(guest.page, 0, -1);
  await waitMapOn(guest.page, 'park');
  await stickOn(guest.page, 0, 0);
  await waitChip(guest.page, 'Park 1 · 1/30');
  assert.deepStrictEqual(await guest.page.evaluate(() => ({
    visit: Farm.session.visit, own: Farm.session.state === Farm.world.state, isVisit: !!Farm.world.state.isVisit, topic: Farm.Online.topic, home: Farm.Online.home.topic,
  })), { visit: null, own: true, isVisit: false, topic: 'park:1', home: 'farm:' + guest.uid });
  await until(() => ![...(server.topics.get('farm:' + host.uid) || [])].some((c) => c.key === guest.uid), 'out of the friend\'s room');
  // the friend comes too: both in Park 1, and nobody is the owner here
  await walkIntoPark(host.page);
  await waitRemotes(host.page, ['Ana Acres']);
  await waitRemotes(guest.page, ['Moon Meadow']);
  await waitChip(host.page, 'Park 1 · 2/30');
  await shot(guest.page, 'park-5-from-a-visit');
  // the friend rides in on a horse (the park rides like town): the guest sees it under them
  await host.page.evaluate(() => {
    const w = Farm.world, s = Farm.session.state;
    s.horse = s.horse || { name: 'Chestnut' };
    Farm.session.riding = true;
    w.setFeet(10.5 * 256, 20.5 * 256);
  });
  await stickOn(host.page, 1, 0);
  await guest.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && !!r.horse; }, host.uid, SLOW);
  await stickOn(host.page, 0, 0);
  // leaving online play in the park: the seat goes at once; then the park is empty and says so, once
  await guest.page.evaluate(() => { Farm.session.state.net.off = 1; Farm.Online.disconnect(); });
  await until(() => !server.db.parkSeats.has(guest.uid), 'the guest\'s seat freed');
  await waitRemotes(host.page, []);
  assert.strictEqual(await chipShown(guest.page), false);
  await walkOutOfPark(guest.page);
  await walkIntoPark(guest.page);
  await waitToast(guest.page, /^Join online play to meet everyone here\.$/);
  assert.deepStrictEqual(await remotes(guest.page), []);
  for (const p of [host, guest]) assert.deepStrictEqual(p.problems, []);
  for (const p of [host, guest]) await p.context.close();
});

// Town Rank and the Hall of Fame (owner, 6 Nov 2026: "Town Rank is better than Hunter ranking"; "inside the museum is
// the name of the player who get the big boar, or first defeat boss"), over the test server's part 22 (test/mock-rank.js).
test('online: Town Rank and the Hall of Fame: two earn points, the board orders them, a badge by a name in the park, a first goes to whoever claims it first, the plaques show names and "That\'s you!"; before part 22, quiet (owner, 6 Nov 2026)', async () => {
  const server = createServer();
  const ana = await open(server), ben = await open(server);
  await nameFarm(ana.page, 'Ana Acres');
  await nameFarm(ben.page, 'Ben Barn');
  const month = (uid) => { const m = [...server.db.rankMonths.values()].find((x) => x.has(uid)); return m ? m.get(uid).points : 0; };

  // ----- points, as the game counts them (crops picked, hunts, fish), go to the server
  await ana.page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.bump(s, 'harvest', 250); L.bump(s, 'hunt', 12); }); // 250 + 60
  await ben.page.evaluate(() => { const s = Farm.session.state, L = Farm.Logic; L.bump(s, 'harvest', 400); L.rankAdd(s, 'fish', 90); }); // 300 (the cap) + 90
  assert.strictEqual(await ana.page.evaluate(() => Farm.Online.rankSend()), true);
  assert.strictEqual(await ben.page.evaluate(() => Farm.Online.rankSend()), true);
  assert.deepStrictEqual([month(ana.uid), month(ben.uid)], [310, 390]);
  assert.deepStrictEqual(server.db.rankCalls.filter((c) => c.uid === ana.uid).map((c) => [c.args.p_source, c.args.p_points]), [['farm', 250], ['hunt', 60]], 'one send for each kind');
  assert.strictEqual(await ana.page.evaluate(() => Farm.Online.rankSend()), false, 'nothing more to send');
  assert.deepStrictEqual(await ana.page.evaluate(() => [Farm.Online.rank.points, Farm.Online.rank.tier, Farm.session.state.tr.out.length]), [310, 1, 0], 'the server\'s word: Bronze');

  // ----- the Town Rank page: the board in order, you marked
  await ana.page.evaluate(() => Farm.ui.openTownRank());
  await waitModal(ana.page, /TOP 100 THIS MONTH/);
  const page = await modalText(ana.page);
  assert.match(page, /^TOWN RANK \| Bronze {2}· {2}310 points \| "Town Helper" \| /, page);
  assert.match(page, /#2 in town/);
  assert.match(page, /TOP 100 THIS MONTH \| #1 \| Ben Barn \| 390 \| #2 \| Ana Acres \(you\) \| 310 \| How to earn \| Close$/, page);
  await shot(ana.page, 'town-rank-online');
  await ana.page.evaluate(() => Farm.ui.closeAll());
  // ...and in Online > Ranks, with the other boards
  await ana.page.evaluate(() => { Farm.ui.onlineKind = { visit: 'popular', ranks: 'town' }; Farm.ui.openOnline('ranks', 0); });
  await waitModal(ana.page, /Showing: Town Rank/);
  assert.match(await modalText(ana.page), /Bronze: 310 points \| #2 this month\. Looks only, never power\. \| Open \| #1 Ben Barn \| 390 points this month, Bronze\. \| #2 Ana Acres \(you\)/);
  await ana.page.evaluate(() => Farm.ui.closeAll());

  // ----- in the park, Ben sees Ana's Bronze badge by her name
  await walkIntoPark(ana.page);
  await walkIntoPark(ben.page);
  await waitRemotes(ben.page, ['Ana Acres']);
  await ana.page.evaluate((T) => { Farm.world.setFeet(18.5 * T, 29.5 * T); Farm.world.dir = 'down'; Farm.Online.chan.track(Farm.Online.myState()); }, PT); // (a step aside, so the shot shows her)
  await ben.page.waitForFunction((id) => { const r = Farm.world.remotes[id]; return r && r.rk && r.rkTier === 1 && r.rk.visible && Math.abs(r.rk.y - r.tag.y) < 120 && r.rk.x < r.tag.x; }, ana.uid, SLOW);
  await shot(ben.page, 'rank-badge');

  // ----- a first: Ben claims the Bakunawa first; Ana, after him, does not get it
  await ben.page.evaluate(() => { Farm.Logic.hallWant(Farm.session.state, 'bakunawa'); Farm.Online.claimFirsts(); });
  await waitModal(ben.page, /^A FIRST FOR HARVEST VILLE! \| You are the first player ever to beat the Bakunawa!/);
  await ben.page.evaluate(() => Farm.ui.closeAll());
  await ana.page.evaluate(() => { Farm.Logic.hallWant(Farm.session.state, 'bakunawa'); Farm.Online.claimFirsts(); });
  await ana.page.waitForFunction(() => Farm.session.state.tr.fd.indexOf('bakunawa') >= 0, null, SLOW);
  assert.strictEqual(server.db.firsts.get('bakunawa').uid, ben.uid);
  await new Promise((r) => setTimeout(r, 3000));
  assert.strictEqual(await modalText(ana.page), '', 'no "first" for Ana');

  // ----- the Hall: the biggest boar is Ana's (That's you!), the Bakunawa's first is Ben's, the board
  await ana.page.evaluate(() => Farm.Online.recordCatch('boar', 110));
  await ben.page.evaluate(() => Farm.Online.recordCatch('boar', 100));
  await until(() => server.db.catches.size === 2, 'two boars on the server');
  await ana.page.evaluate((T) => { Farm.world.setFeet(20.5 * T, 7.5 * T); Farm.world.dir = 'up'; }, PT);
  await ana.page.evaluate(() => { const a = Farm.world.resolve(); if (a && a.run) a.run(); });
  await waitMapOn(ana.page, 'hall');
  await ana.page.waitForFunction(() => Farm.world.hallNames && typeof Farm.world.hallNames === 'object', null, SLOW);
  const read = async (spot) => { await ana.page.evaluate((k) => Farm.world.readPlaque(k), spot); await frames(ana.page); const t = await modalText(ana.page); await ana.page.evaluate(() => Farm.ui.closeAll()); return t; };
  assert.strictEqual(await read('d1'), 'THE BIGGEST WILD BOAR | Wild Boar: Ana Acres, 110.0 kg  That\'s you! | OK');
  assert.strictEqual(await read('d2'), 'FIRST TO BEAT THE BAKUNAWA | First to beat the Bakunawa: Ben Barn | OK');
  assert.strictEqual(await read('board'), 'TOWN RANK: THIS MONTH | #1 Ben Barn, 390 (Bronze) | #2 Ana Acres, 310 (Bronze)  That\'s you! | Close | Town Rank');
  assert.match(await read('w2'), /^BIGGEST CATCHES: MAKILING \| Deer: nobody yet\. Be the first! \| Wild Boar: Ana Acres, 110\.0 kg {2}That's you! \| /);
  await ana.page.evaluate((T) => { Farm.world.setFeet(4.5 * T, 6.5 * T); }, PT);
  await shot(ana.page, 'hall-online');
  // inside the hall she is off the park's room (her seat is given back), and Ben does not see her
  await waitRemotes(ben.page, []);
  await until(() => seats(server)[0] === 1, 'one in Park 1');
  // out of the door: in the park again, in front of the hall, and Ben sees her
  await ana.page.evaluate(() => Farm.world.travel('park', 'door_hall'));
  await waitMapOn(ana.page, 'park');
  await waitRemotes(ben.page, ['Ana Acres']);

  // ----- before part 22 is on the server: the points wait, the page and the hall say "soon"
  server.db.noRank = true;
  await ana.page.evaluate(() => { Farm.Logic.rankAdd(Farm.session.state, 'goods', 9); });
  assert.strictEqual(await ana.page.evaluate(() => Farm.Online.rankSend()), false);
  assert.deepStrictEqual(await ana.page.evaluate(() => [Farm.Online.rank.off, Farm.session.state.tr.out.map((o) => o.n)]), [true, [9]], 'kept for later');
  await ana.page.evaluate(() => Farm.ui.openTownRank());
  await waitModal(ana.page, /opens very soon/);
  await ana.page.evaluate(() => { Farm.ui.closeAll(); Farm.Online.hallCache = null; Farm.world.travel('hall', 'entrance'); });
  await waitMapOn(ana.page, 'hall');
  await ana.page.waitForFunction(() => Farm.world.hallNames === 'soon', null, SLOW);
  assert.strictEqual(await read('w1'), 'BIGGEST CATCHES: PULAG | The names go up here very soon. | OK');
  for (const p of [ana, ben]) assert.deepStrictEqual(p.problems, []);
  for (const p of [ana, ben]) await p.context.close();
});

// ---------- hunting places (owner, 6 Nov 2026; src/19zzzzz-places.js) ----------
// SAMPLE: the place agents replace this with their own place's cave.
test('online: hunting places (SAMPLE): two hunters in the sample cave\'s bottom floor, the boss is stronger for two, a shared hunt gives each their own daily chest (owner, 6 Nov 2026)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  for (const who of [host, guest]) {
    await who.page.evaluate(() => { window.gameHost.devPlaces = true; const s = Farm.session.state; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 20); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  }
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  const bottom = async (who) => {
    await who.page.evaluate(() => { Farm.ui.closeAll(); if (Farm.session.visit) Farm.session.visit.chase = null; Farm.world.travel('town', 'from_farm'); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
    await who.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('sample_cave', 'entrance', 2); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'sample_cave' && Farm.session.lairFloor === 2 && !Farm.world.busy && Farm.world.wild, null, SLOW);
    await who.page.evaluate(() => Farm.ui.closeAll());
  };
  const boss = (page) => page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'sample_boss'); return a ? { hp: a.hp, max: a.max, bar: !!a.bar } : null; });
  await bottom(host);
  assert.deepStrictEqual(await boss(host.page), { hp: 6, max: 6, bar: true }, 'one hunter: its own strength');
  await bottom(guest);
  await waitRemotes(host.page, ['Ana Acres']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  assert.strictEqual(await host.page.evaluate((id) => Farm.Online.others[id].fl, guest.uid), 2, 'the same floor');
  assert.strictEqual(await guest.page.evaluate(() => Farm.world.wildFollowing()), host.uid, 'the owner, there first, runs it');
  await host.page.waitForFunction(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'sample_boss'); return a && a.max === 10; }, null, SLOW);
  await guest.page.waitForFunction(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'sample_boss'); return a && a.max === 10 && a.hp === 10; }, null, SLOW);
  // the guest lands its 2 hits (a share), the owner the rest
  await host.page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'sample_boss'); a.def = Object.assign({}, a.def, { angry: 0 }); });
  await guest.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'sample_boss'); w.wildStruck(a); w.wildStruck(a); });
  await host.page.waitForFunction(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'sample_boss'); return a && a.hp === 8; }, null, SLOW);
  await host.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'sample_boss'); w.wildStruck(a); a.hp = 1; w.wildStruck(a); });
  for (const who of [host, guest]) await who.page.waitForFunction(() => !Farm.world.wild.animals.some((a) => a.kind === 'sample_boss') && !!Farm.world.bossChest, null, SLOW);
  await shot(guest.page, 'places-online-boss-chest');
  // each opens their own
  for (const who of [host, guest]) {
    const got = await who.page.evaluate(() => { const s = Farm.session.state, n = Farm.Logic.countItem(s, 'sample_fang'); Farm.world.openBossChest(); return { before: n, after: Farm.Logic.countItem(s, 'sample_fang'), waiting: Farm.Logic.bossChests(s, 'sample_place'), boss: s.places.sample_place.b, medal: Farm.Logic.hasMedal(s, 9902) }; });
    assert.deepStrictEqual([got.after - got.before >= 2, got.waiting, got.boss, got.medal], [true, 0, 1, true]);
  }
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

test('online: two hunters on a dungeon floor (owner, 7 Nov 2026: "I just kill the monster but then it showing again"): one list on both phones, a kill stays killed, and a friend who comes to a floor already cleared finds its gate open', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  for (const who of [host, guest]) {
    await who.page.evaluate(() => { const s = Farm.session.state; s.wild.n = 60; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 99); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  }
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  const go = async (who, floor) => {
    await who.page.evaluate(() => { Farm.ui.closeAll(); if (Farm.session.visit) Farm.session.visit.chase = null; if (Farm.world.mapKey !== 'town' && Farm.world.mapKey !== 'banaue_cave') Farm.world.travel('town', 'from_farm'); });
    await who.page.waitForFunction(() => (Farm.world.mapKey === 'town' || Farm.world.mapKey === 'banaue_cave') && !Farm.world.busy, null, SLOW);
    await who.page.evaluate((f) => { Farm.ui.closeAll(); Farm.world.travel('banaue_cave', 'entrance', f); }, floor);
    await who.page.waitForFunction((f) => Farm.world.mapKey === 'banaue_cave' && Farm.session.lairFloor === f && !Farm.world.busy && Farm.world.wild, floor, SLOW);
    await who.page.evaluate(() => Farm.ui.closeAll());
  };
  const list = (page) => page.evaluate(() => Farm.world.wild.animals.map((a) => a.slot + ':' + a.kind + ':' + a.hp + '/' + a.max).sort().join(' '));
  // both on floor 3: the same creatures on both phones
  await go(host, 3);
  await go(guest, 3);
  await waitRemotes(host.page, ['Ana Acres']);
  await guest.page.waitForFunction((id) => Farm.world.wildFollowing() === id, host.uid, SLOW);
  await new Promise((r) => setTimeout(r, 800));
  const both = await list(host.page);
  assert.ok(both.length > 0);
  assert.strictEqual(await list(guest.page), both, 'one list');
  for (const who of [host, guest]) await who.page.evaluate(() => Farm.world.wild.animals.forEach((a) => { a.def = Object.assign({}, a.def, { angry: 0, shy: 0 }); }));
  // the guest hunts one with its own arrows: gone from both, and it stays gone
  const slot = await guest.page.evaluate(() => { const w = Farm.world, a = w.wild.animals[0]; for (let i = 0; i < 30 && a.hp > 0; i++) w.wildStruck(a); return a.slot; });
  for (const who of [host, guest]) await who.page.waitForFunction((n) => !Farm.world.wild.animals.some((a) => a.slot === n), slot, SLOW);
  await new Promise((r) => setTimeout(r, 2500));
  for (const who of [host, guest]) assert.ok(!(await who.page.evaluate((n) => Farm.world.wild.animals.some((a) => a.slot === n), slot)), 'still gone a while later');
  // the guest steps out to the cave's top floor; the owner clears floor 3; the guest comes back down: the gate is open
  await go(guest, 1);
  await host.page.evaluate(() => { const w = Farm.world; w.wild.animals.slice().forEach((a) => { a.hp = 0; }); });
  await host.page.waitForFunction(() => !Farm.world.wild.animals.length && Farm.world.lair.open, null, SLOW);
  await go(guest, 3);
  await guest.page.waitForFunction((id) => Farm.world.wildFollowing() === id, host.uid, SLOW);
  await guest.page.waitForFunction(() => Farm.world.lair.open, null, SLOW);
  assert.strictEqual(await list(guest.page), '', 'nothing came back');
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});

// ---------- Banaue Terraces (owner, 6 Nov 2026; src/00-zzzzzzzzzz-place-11-banaue.js) ----------
test('online: a friend sees the bow in your hands on your back (owner, 8 Nov 2026: "bow must be seen while equipped"): your Moon Bow, with its glow; put away, gone', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  await guest.page.evaluate(() => { const s = Farm.session.state; Farm.Logic.addItem(s, 'bow', 1); s.tools.bow = 5; Farm.Logic.addItem(s, 'arrows', 20); s.sel = s.inv.findIndex((x) => x && x.id !== 'bow'); });
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(host.page, ['Ana Acres']);
  const seen = () => host.page.evaluate(() => { const w = Farm.world, r = Object.values(w.remotes)[0]; return r && { on: !!(r.slung && r.slung.visible), frame: r.slung ? r.slung.frame.name : null, glow: !!(r.slungGlow && r.slungGlow.visible) }; });
  await host.page.waitForTimeout(800);
  assert.strictEqual((await seen()).on, false, 'nothing on their back while they hold something else');
  // they take up the bow: the host sees it on their back, the Moon Bow's own picture, glowing
  await guest.page.evaluate(() => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  const icon = await host.page.evaluate(() => Farm.Config.ICON.bow_5);
  await host.page.waitForFunction((f) => { const r = Object.values(Farm.world.remotes)[0]; return r && r.slung && r.slung.visible && r.slung.frame.name === f; }, icon, SLOW);
  assert.deepStrictEqual(await seen(), { on: true, frame: icon, glow: true });
  await shot(host.page, 'online-friend-slung-moon-bow');
  // put away: gone from their back
  await guest.page.evaluate(() => { const s = Farm.session.state; s.sel = s.inv.findIndex((x) => x && x.id === 'arrows'); });
  await host.page.waitForFunction(() => { const r = Object.values(Farm.world.remotes)[0]; return r && !(r.slung && r.slung.visible); }, null, SLOW);
  assert.deepStrictEqual([host.problems, guest.problems], [[], []]);
  await host.context.close(); await guest.context.close();
});

test('online: Banaue Terraces: two hunters on the Terrace Tunnels\' floor 50 (its bottom since 8 Nov 2026), the Amomongo is stronger for two (30, 42), a shared hunt gives each their own daily chest (owner, 6 Nov 2026)', async () => {
  const server = createServer();
  const host = await open(server), guest = await open(server);
  await nameFarm(host.page, 'Moon Meadow');
  await nameFarm(guest.page, 'Ana Acres');
  for (const who of [host, guest]) {
    await who.page.evaluate(() => { const s = Farm.session.state; s.wild.n = 60; Farm.Logic.addItem(s, 'bow', 1); Farm.Logic.addItem(s, 'arrows', 20); s.sel = s.inv.findIndex((x) => x && x.id === 'bow'); });
  }
  await guest.page.evaluate((id) => Farm.Online.visit(id), host.uid);
  await waitWorld(guest.page, true);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  const bottom = async (who) => {
    await who.page.evaluate(() => { Farm.ui.closeAll(); if (Farm.session.visit) Farm.session.visit.chase = null; Farm.world.travel('town', 'from_farm'); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'town' && !Farm.world.busy, null, SLOW);
    await who.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.travel('banaue_cave', 'entrance', 50); });
    await who.page.waitForFunction(() => Farm.world.mapKey === 'banaue_cave' && Farm.session.lairFloor === 50 && !Farm.world.busy && Farm.world.wild, null, SLOW);
    await who.page.evaluate(() => Farm.ui.closeAll());
  };
  const boss = (page) => page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'amomongo'); return a ? { hp: a.hp, max: a.max, bar: !!a.bar } : null; });
  await bottom(host);
  assert.deepStrictEqual(await boss(host.page), { hp: 30, max: 30, bar: true }, 'one hunter: soloable');
  await bottom(guest);
  await waitRemotes(host.page, ['Ana Acres']);
  await waitRemotes(guest.page, ['Moon Meadow (owner)']);
  assert.strictEqual(await host.page.evaluate((id) => Farm.Online.others[id].fl, guest.uid), 50, 'the same floor');
  await host.page.waitForFunction(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'amomongo'); return a && a.max === 42; }, null, SLOW);
  await guest.page.waitForFunction(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'amomongo'); return a && a.max === 42 && a.hp === 42; }, null, SLOW);
  await shot(guest.page, 'banaue-online-boss');
  // the guest lands its 3 hits (a share), the owner the rest
  await host.page.evaluate(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'amomongo'); a.def = Object.assign({}, a.def, { angry: 0 }); });
  await guest.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'amomongo'); w.wildStruck(a); w.wildStruck(a); w.wildStruck(a); });
  await host.page.waitForFunction(() => { const a = Farm.world.wild.animals.find((x) => x.kind === 'amomongo'); return a && a.hp === 39; }, null, SLOW);
  await host.page.evaluate(() => { const w = Farm.world, a = w.wild.animals.find((x) => x.kind === 'amomongo'); w.wildStruck(a); w.wildStruck(a); a.hp = 1; w.wildStruck(a); });
  for (const who of [host, guest]) await who.page.waitForFunction(() => !Farm.world.wild.animals.some((a) => a.kind === 'amomongo') && !!Farm.world.bossChest, null, SLOW);
  await shot(guest.page, 'banaue-online-boss-chest');
  // each opens their own
  for (const who of [host, guest]) {
    const got = await who.page.evaluate(() => { const s = Farm.session.state, n = Farm.Logic.countItem(s, 'fur_amomongo'); Farm.world.openBossChest(); return { before: n, after: Farm.Logic.countItem(s, 'fur_amomongo'), waiting: Farm.Logic.bossChests(s, 'banaue'), boss: s.places.banaue.b, medal: Farm.Logic.hasMedal(s, 1102) }; });
    assert.deepStrictEqual([got.after - got.before >= 1, got.waiting, got.boss, got.medal], [true, 0, 1, true]);
  }
  for (const who of [host, guest]) assert.deepStrictEqual(who.problems, []);
  await Promise.all([host.context.close(), guest.context.close()]);
});
