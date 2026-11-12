// The Lost Tower's weekly board and First in Selebox, end to end in the built page (dist/index.html), with a fake
// online world (window.gameHost.net: a pretend server in the page, F.Net.rpc answered by it): a big boss beaten is
// claimed as a first ("FIRST IN SELEBOX!"), each new floor is sent with its request id, the board page (from Mang Ilaw's
// Tower tab) shows the top 10, your line and the Champion, last week's prize is paid once by its claim id, the
// lighthouse wall in Manila reads the names and shows the Champion's banner; offline and a server without the board:
// floors wait in the save, the pages say so.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-tower-board.test.js   (SHOTS=/some/dir: screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const NOON = [2026, 11, 12, 12, 0];
const UID = '11111111-2222-4333-8444-555555555555';
const CLAIM = '0f8b2c4e-1d2a-4b3c-9d4e-5f6a7b8c9d0e';

const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

// the pretend server: the board's three functions as the SQL answers them, the Hall's two, joining; anything else is
// "not on the server" (as a server without that part). noBoard: the board's part not applied yet.
const FAKE = ([UID, CLAIM, noBoard]) => {
  const db = window.__db = { calls: [], floors: new Set(), reqs: new Map(), firsts: {}, claims: 0, noBoard };
  const nf = (n) => Promise.reject(new Error('Could not find the function public.' + n + ' in the schema cache'));
  const me = () => ({ week: '2026-11-09', floors: db.floors.size, rank: db.floors.size ? 2 : null });
  const fns = {
    farm_join_v1: () => ({ id: UID, farm_name: 'Ana Acres', friend_code: 'ABCDEFGH', listed: true }),
    farm_hall_first_v1: (a) => { if (!/^tower_\d+$|^bakunawa$/.test(a.p_key)) return { ok: false, code: 'bad-key' }; const mine = !db.firsts[a.p_key]; if (mine) db.firsts[a.p_key] = UID; return { ok: true, first: db.firsts[a.p_key] === UID, id: db.firsts[a.p_key], name: 'Ana Acres' }; },
    farm_hall_v1: () => ({ catches: [], fish: [], champs: {}, top: [], more: [], firsts: Object.keys(db.firsts).map((k) => ({ key: k, id: db.firsts[k], name: 'Ana Acres' })).concat([{ key: 'tower_200', id: 'x', name: 'Ben' }]) }),
    farm_tower_floor_v1: (a) => {
      if (db.noBoard) return nf('farm_tower_floor_v1');
      const fresh = !db.reqs.has(a.p_request_id), took = [];
      db.reqs.set(a.p_request_id, a.p_floors.slice());
      a.p_floors.forEach((f) => { if (db.floors.has(f) || fresh) { db.floors.add(f); took.push(f); } });
      return Object.assign(me(), { ok: true, added: fresh ? took.length : 0, took, again: !fresh, left: 99 });
    },
    farm_tower_board_v1: () => db.noBoard ? nf('farm_tower_board_v1') : ({ week: '2026-11-09', me: me(), prizes: [300, 200, 150],
      top: [{ rank: 1, id: 'b', name: 'Ben', floors: 30 }].concat(db.floors.size ? [{ rank: 2, id: UID, name: 'Ana Acres', floors: db.floors.size }] : []),
      champ: { id: 'b', name: 'Ben', floors: 44 } }),
    farm_tower_week_prize_v1: () => db.noBoard ? nf('farm_tower_week_prize_v1') : ({ ok: true, id: CLAIM, week: '2026-11-02', rank: 3, floors: 20, pearls: 150, frame: 'bronze', title: null, again: db.claims++ > 0 }),
  };
  window.gameHost.net = {
    session: () => Promise.resolve(UID),
    token: () => Promise.resolve(null),
    rpc: (name, args) => {
      db.calls.push([name, JSON.parse(JSON.stringify(args || {}))]);
      if (!fns[name]) return nf(name);
      return Promise.resolve().then(() => fns[name](args || {}));
    },
    join: () => ({ track() {}, send() { return Promise.resolve(); }, leave() { return Promise.resolve(); } }),
  };
};

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(savedState, { online = true, noBoard = false } = {}) {
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
  await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([state, now, here]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, at(NOON), allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  if (online) await page.addInitScript(FAKE, [UID, CLAIM, noBoard]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  if (online) await page.waitForFunction(() => Farm.Online.on && Farm.Online.me, null, SLOW);
  await page.waitForTimeout(300);
  await page.evaluate(() => Farm.ui.closeAll());
  return { page, problems, context };
}
async function makeSave(edit) {
  const { page, context } = await open(null, { online: false });
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, s = L.newState();
    eval(edit); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
async function teleport(page, tx, ty, dir) {
  await page.evaluate(([tx, ty, dir]) => { const T = 256; Farm.world.setFeet(tx * T + T / 2, ty * T + T / 2); Farm.world.dir = dir; Farm.world.idle(); }, [tx, ty, dir]);
  await frames(page);
}
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(150);
}
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});
const waitModal = (page, re) => page.waitForFunction((src) => {
  const re = new RegExp(src), m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [];
  const walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  if (m) walk(m.c.list);
  return re.test(out.join(' | '));
}, re.source, SLOW);
async function tapButton(page, label, nth = 0) {
  const pos = await page.evaluate(([label, nth]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (found[nth] && m.c.slimInto) m.c.slimInto(found[nth]);
    const b = found[nth] && found[nth].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
const calls = (page, name) => page.evaluate((n) => window.__db.calls.filter((c) => c[0] === n).map((c) => c[1]), name);
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function waitFloor(page, f) {
  await page.waitForFunction((f) => Farm.world.mapKey === 'tower' && Farm.session.lairFloor === f && !Farm.world.busy && Farm.world.player.active && Farm.world.lair && Farm.world.lair.floor === f, f, SLOW);
  await frames(page, 3);
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

const SETUP = "s.map = 'manila'; s.energy = 200; s.wild.n = 5; const d = L.towerDoor(); s.player = { x: (d.x + 0.5) * 256, y: (d.y + 1.5) * 256, dir: 'up' }; ";

test('online: the boss of floor 100 beaten is a First in Selebox; the floor goes to the server once; the board, the prize once, the lighthouse wall and banner', async () => {
  const save = await makeSave(SETUP + 's.pearls = 10; s.tower.deep = 100; s.tower.cl = 99;');
  const { page, problems, context } = await open(save);
  await waitMap(page, 'manila');
  // last week's prize: asked when the game goes somewhere (and once a minute), paid once
  await page.evaluate(() => Farm.world.travel('tower', 'entrance', 100));
  await waitFloor(page, 100);
  await page.waitForFunction(() => Farm.session.state.pearls === 160, null, SLOW);
  await waitModal(page, /LIGHTHOUSE BOARD PRIZE![\s\S]*#3 last week, with 20 new floors\. \+150 Pearls!/);
  await shot(page, 'board-1-prize');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => { Farm.Online.tower.prized = ''; Farm.Online.towerPrize(); });
  await page.waitForFunction(() => window.__db.claims === 2, null, SLOW);
  await page.waitForTimeout(300);
  assert.strictEqual((await state(page)).pearls, 160, 'the same claim again: not paid twice');
  // the boss of floor 100
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.paid, null, SLOW);
  await waitModal(page, /A TOWER BLESSING/);
  await page.evaluate(() => Farm.ui.closeAll());
  await waitModal(page, /FIRST IN SELEBOX![\s\S]*first player ever to beat Tambanakua on floor 100 of The Lost Tower![\s\S]*lighthouse wall in Manila/);
  await shot(page, 'board-2-first');
  await page.evaluate(() => Farm.ui.closeAll());
  assert.deepStrictEqual(await calls(page, 'farm_hall_first_v1'), [{ p_key: 'tower_100' }]);
  let s = await state(page);
  assert.deepStrictEqual([s.tr.fq, s.tr.fd], [[], ['tower_100']], 'claimed, never asked again');
  // the floor went to the server, with a request id; nothing left waiting
  await page.waitForFunction(() => window.__db.floors.has(100), null, SLOW);
  const sends = await calls(page, 'farm_tower_floor_v1');
  assert.deepStrictEqual(sends.map((a) => a.p_floors), [[100]]);
  assert.match(sends[0].p_request_id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  s = await state(page);
  assert.deepStrictEqual([s.twr.q, s.twr.out], [[], null]);
  // the board, from Mang Ilaw's Tower tab
  await page.evaluate(() => Farm.ui.openKeeper('tower'));
  assert.match(await modalText(page), /The weekly board[\s\S]*Open[\s\S]*Tower Blessings/);
  await tapButton(page, 'Open');
  await waitModal(page, /LIGHTHOUSE BOARD/);
  const board = await modalText(page);
  assert.match(board, /This week: 1 new floor {2}· {2}#2/);
  assert.match(board, /Starts over in 4 days \(Monday, Manila time\)/);
  assert.match(board, /Lighthouse Champion: Ben/);
  assert.match(board, /TOP 10 THIS WEEK[\s\S]*#1 \| Ben \| 30[\s\S]*#2 \| Ana Acres \(you\) \| 1/);
  await shot(page, 'board-3-page');
  await tapButton(page, 'Prizes');
  assert.match(await modalText(page), /WEEKLY PRIZES[\s\S]*1st: 300 Pearls, the title "Lighthouse Champion"[\s\S]*4th to 10th: 50 Pearls[\s\S]*10 or more new floors: 10 Pearls/);
  await tapButton(page, 'OK');
  await waitModal(page, /LIGHTHOUSE BOARD/);
  await tapButton(page, 'Close');
  await waitModal(page, /Mang Ilaw's Shop/); // (back where it was opened)
  await page.evaluate(() => Farm.ui.closeAll());
  // out to Manila: the lighthouse wall, beside the door
  await page.evaluate(() => Farm.world.travel('manila', 'from_tower'));
  await waitMap(page, 'manila');
  await page.waitForFunction(() => Farm.world.towerWall && Farm.world.towerWall.banner, null, SLOW);
  const banner = await page.evaluate(() => Farm.world.towerWall.banner.map((o) => o.text || '').filter(Boolean));
  assert.deepStrictEqual(banner, ['CHAMPION', 'Ben'], "last week's Champion on the banner");
  const door = await page.evaluate(() => Farm.Logic.towerDoor());
  await teleport(page, door.x - 1, door.y + 1, 'up');
  assert.strictEqual(await actionLabel(page), 'Read');
  await shot(page, 'board-4-wall-spot');
  await tapAction(page);
  await waitModal(page, /FIRST IN SELEBOX[\s\S]*Floor 100, Tambanakua: Ana Acres {2}That's you!/);
  const wall = await modalText(page);
  assert.ok(!/Next/.test(wall), 'one page');
  assert.match(wall, /Floor 200, Pugita: Ben/, 'a boss someone beat is named');
  assert.match(wall, /Floor 300, \?\?\?: nobody yet\./);
  assert.match(wall, /^FIRST IN SELEBOX \| Lighthouse Champion \(last week\): Ben, 44 new floors\./);
  await shot(page, 'board-5-wall');
  await tapButton(page, 'Weekly board');
  await waitModal(page, /LIGHTHOUSE BOARD/);
  await page.evaluate(() => Farm.ui.closeAll());
  // the door itself still goes in
  await teleport(page, door.x, door.y + 1, 'up');
  assert.strictEqual(await actionLabel(page), 'Go in');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('offline: a new floor waits in the save; the board and the wall say "Join online play"; online later, it is sent', async () => {
  const save = await makeSave(SETUP + 's.tower.deep = 5; s.tower.cl = 4;');
  const off = await open(save, { online: false });
  await waitMap(off.page, 'manila');
  await off.page.evaluate(() => Farm.world.travel('tower', 'entrance', 5));
  await waitFloor(off.page, 5);
  await off.page.evaluate(() => Farm.towerClearFloor());
  await off.page.waitForFunction(() => Farm.world.lair.paid, null, SLOW);
  assert.deepStrictEqual((await state(off.page)).twr.q, [5]);
  await off.page.evaluate(() => Farm.ui.openTowerBoard());
  const b = await modalText(off.page);
  assert.match(b, /Join online play to see the board\./);
  assert.match(b, /1 to send/);
  await off.page.evaluate(() => Farm.ui.closeAll());
  await off.page.evaluate(() => Farm.ui.openLighthouseWall());
  assert.match(await modalText(off.page), /FIRST IN SELEBOX \| Join online play to see the names\./);
  const saved = await off.page.evaluate(() => JSON.stringify(Farm.Logic.serialize(Farm.session.state)));
  assert.deepStrictEqual(off.problems, []);
  await off.context.close();
  // the next time, online: it goes
  const on = await open(JSON.parse(saved));
  await on.page.evaluate(() => Farm.Online.towerSend());
  await on.page.waitForFunction(() => window.__db.floors.has(5), null, SLOW);
  assert.deepStrictEqual((await state(on.page)).twr.q, []);
  assert.deepStrictEqual(on.problems, []);
  await on.context.close();
});

test('a server without the board yet: the floors are kept, the board says "very soon", nothing breaks', async () => {
  const save = await makeSave(SETUP + 's.tower.deep = 7; s.tower.cl = 6;');
  const { page, problems, context } = await open(save, { noBoard: true });
  await waitMap(page, 'manila');
  await page.evaluate(() => Farm.world.travel('tower', 'entrance', 7));
  await waitFloor(page, 7);
  await page.evaluate(() => Farm.towerClearFloor());
  await page.waitForFunction(() => Farm.world.lair.paid && Farm.Online.tower.off, null, SLOW);
  const s = await state(page);
  assert.deepStrictEqual([...s.twr.q, ...(s.twr.out ? s.twr.out.f : [])], [7], 'kept for when the board comes');
  await page.evaluate(() => Farm.ui.openTowerBoard());
  assert.match(await modalText(page), /The weekly board opens very soon\. Your new floors are kept until then\./);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openLighthouseWall());
  await waitModal(page, /FIRST IN SELEBOX[\s\S]*Floor 100, \?\?\?: nobody yet/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
