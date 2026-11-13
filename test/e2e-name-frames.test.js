// Name frames, end to end in the built page (dist/index.html), with a fake online world (window.gameHost.net: a pretend
// server in the page answering farm_frames_v1, farm_frames_mine_v1 and farm_frame_pick_v1 as the SQL does): two players
// visit your farm, one wearing gold with the title "Lighthouse Champion": the frame round the name over their head, the
// title under it, nothing on the other; yours over your head while they are near; their card and their menu; the
// Lighthouse Board's rows and the lighthouse wall; your farmer card's "Frame" and the My frame page, picking another
// frame. Offline and a server without frames: nobody wears one, nothing breaks.
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-name-frames.test.js   (SHOTS=/some/dir: screenshots)
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 90000 };
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const NOON = [2026, 11, 13, 12, 0];
const UID = '11111111-2222-4333-8444-555555555555';
const BEN = 'bbbbbbbb-2222-4333-8444-555555555555';
const CARA = 'cccccccc-2222-4333-8444-555555555555';

// the pretend server. noFrames: the frames' part not applied yet (its functions are not there).
const FAKE = ([UID, BEN, CARA, noFrames]) => {
  const db = window.__db = { calls: [], pick: { [UID]: 'auto' }, firsts: { [UID]: ['tower_300', 'tower_100'] }, week: { [BEN]: ['gold', 'Lighthouse Champion'] }, noFrames };
  window.__rooms = {};
  const nf = (n) => Promise.reject(new Error('Could not find the function public.' + n + ' in the schema cache'));
  const owned = (id) => ({ firsts: db.firsts[id] || [], week: db.week[id] ? db.week[id][0] : null, title: db.week[id] ? db.week[id][1] : null });
  const wear = (id) => {
    const o = owned(id), p = db.pick[id] || 'auto';
    let f = o.week || o.firsts[0] || null;
    if (p === 'none') f = null;
    else if (p !== 'auto' && (p === o.week || o.firsts.includes(p))) f = p;
    return { frame: f, title: o.title };
  };
  const fns = {
    farm_join_v1: () => ({ id: UID, farm_name: 'Ana Acres', friend_code: 'ABCDEFGH', listed: true }),
    farm_frames_v1: (a) => {
      if (db.noFrames) return nf('farm_frames_v1');
      if (!Array.isArray(a.p_ids) || a.p_ids.length > 60) return { ok: false, code: 'bad' };
      return a.p_ids.map((id) => Object.assign({ id }, wear(id))).filter((r) => r.frame || r.title);
    },
    farm_frames_mine_v1: () => db.noFrames ? nf('farm_frames_mine_v1') : Object.assign({ pick: db.pick[UID], until: '2026-11-16', wear: wear(UID) }, owned(UID)),
    farm_frame_pick_v1: (a) => {
      if (db.noFrames) return nf('farm_frame_pick_v1');
      const o = owned(UID);
      if (!(a.p_frame === 'auto' || a.p_frame === 'none' || a.p_frame === o.week || o.firsts.includes(a.p_frame))) return { ok: false, code: 'not-yours' };
      db.pick[UID] = a.p_frame;
      return { ok: true, pick: a.p_frame, wear: wear(UID) };
    },
    farm_hall_v1: () => ({ catches: [], fish: [], champs: {}, top: [], more: [], firsts: [{ key: 'tower_100', id: UID, name: 'Ana Acres' }, { key: 'tower_300', id: UID, name: 'Ana Acres' }] }),
    farm_tower_board_v1: () => ({ week: '2026-11-09', me: { week: '2026-11-09', floors: 12, rank: 2 }, prizes: [300, 200, 150],
      top: [{ rank: 1, id: BEN, name: 'Ben', floors: 30 }, { rank: 2, id: UID, name: 'Ana Acres', floors: 12 }, { rank: 3, id: CARA, name: 'Cara', floors: 5 }],
      champ: { id: BEN, name: 'Ben', floors: 44 } }),
  };
  window.gameHost.net = {
    session: () => Promise.resolve(UID),
    token: () => Promise.resolve(null),
    rpc: (name, args) => {
      db.calls.push([name, JSON.parse(JSON.stringify(args || {}))]);
      if (!fns[name]) return nf(name);
      return Promise.resolve().then(() => fns[name](args || {}));
    },
    join: (topic, me, on) => { window.__rooms[topic] = on; return { track() {}, send() { return Promise.resolve(); }, leave() { return Promise.resolve(); } }; },
  };
};

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open({ online = true, noFrames = false } = {}) {
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
  await page.addInitScript(([now]) => {
    window.__now = now;
    window.gameHost = { state: null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [at(NOON)]);
  if (online) await page.addInitScript(FAKE, [UID, BEN, CARA, noFrames]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  if (online) await page.waitForFunction(() => Farm.Online.on && Farm.Online.me && Farm.Online.chan, null, SLOW);
  await page.waitForTimeout(300);
  await page.evaluate(() => Farm.ui.closeAll());
  return { page, problems, context };
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
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
// the name frames on the open page: [frame, the name in front of it]
const plates = (page) => page.evaluate(() => {
  const m = Farm.ui.modals[Farm.ui.modals.length - 1], out = [];
  const walk = (list) => list.forEach((o, i) => {
    if (o.nfKey) { const t = list.slice(i + 1).find((x) => x.type === 'Text'); out.push([o.nfKey, t ? t.text : null]); }
    if (o.list) walk(o.list);
  });
  if (m) walk(m.c.list);
  return out;
});
async function tapButton(page, label, nth = 0) {
  const pos = await page.evaluate(([label, nth]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && (o.parentContainer !== m.c || o.parentContainer.name)) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (found[nth] && m.c.slimInto) m.c.slimInto(found[nth]);
    const b = found[nth] && found[nth].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}
const calls = (page, name) => page.evaluate((n) => window.__db.calls.filter((c) => c[0] === n).map((c) => c[1]), name);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
// two players come to your farm, near you
const visitors = (page) => page.evaluate(([UID, BEN, CARA]) => {
  const f = Farm.world.feet(), t = Date.now();
  window.__rooms['farm:' + UID].presence([
    { id: BEN, name: 'Ben', look: 'boy', map: 'farm', x: f.x - 520, y: f.y + 120, dir: 'down', m: 0, at: 1, t },
    { id: CARA, name: 'Cara', look: 'girl', map: 'farm', x: f.x + 520, y: f.y + 120, dir: 'down', m: 0, at: 2, t },
  ]);
}, [UID, BEN, CARA]);

test('online: over the heads, the cards, the board, the wall, My frame and a pick', async () => {
  const { page, problems, context } = await open();
  await page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  await visitors(page);
  await page.waitForFunction((BEN) => { const r = Farm.world.remotes[BEN]; return r && r.nf && r.nf.plate && r.nf.title; }, BEN, SLOW);
  await page.waitForTimeout(300);
  await page.evaluate(() => Farm.ui.closeAll());
  await frames(page, 4);
  // one ask, the two of them and us together
  const asked = await calls(page, 'farm_frames_v1');
  assert.strictEqual(asked.length, 1, 'asked once, batched');
  assert.deepStrictEqual(asked[0].p_ids.slice().sort(), [BEN, CARA, UID].sort());
  const heads = await page.evaluate(([BEN, CARA]) => {
    const w = Farm.world, b = w.remotes[BEN], c = w.remotes[CARA], me = w.nfMe;
    return {
      ben: { frame: b.nf.plate.nfKey, title: b.nf.title.text, name: b.tag.text, plateUnderName: b.nf.plate.depth < b.tag.depth, plateAt: Math.abs(b.nf.plate.y - (b.tag.y - b.tag.displayHeight / 2)) < 1, titleUnder: b.nf.title.y > b.tag.y - 10 && b.nf.title.y < b.tag.y + 20, wide: b.nf.plate.nfW > b.tag.displayWidth },
      cara: { plate: !!(c.nf && c.nf.plate), title: !!(c.nf && c.nf.title) },
      me: me && { name: me.tag.text, shown: me.tag.visible, frame: me.n.plate && me.n.plate.nfKey, title: !!me.n.title },
    };
  }, [BEN, CARA]);
  assert.deepStrictEqual(heads.ben, { frame: 'gold', title: 'Lighthouse Champion', name: 'Ben', plateUnderName: true, plateAt: true, titleUnder: true, wide: true });
  assert.deepStrictEqual(heads.cara, { plate: false, title: false }, 'no frame: just the name, as before');
  assert.deepStrictEqual(heads.me, { name: 'Ana Acres', shown: true, frame: 'tower_300', title: false }, 'ours over our head while they are near: Auto, the newest boss frame');
  await shot(page, 'frames-1-heads');
  // their card (Wave / a tap): the name framed, the title under it
  await page.evaluate((BEN) => Farm.ui.parkPlayer(BEN, 'on your farm'), BEN);
  await waitModal(page, /SAY HI/);
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /SAY HI[\s\S]*Ben is on your farm with you\.[\s\S]*Ben \| Lighthouse Champion/);
  assert.deepStrictEqual(await plates(page), [['gold', 'Ben']]);
  await shot(page, 'frames-2-card');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate((CARA) => Farm.ui.parkPlayer(CARA, 'on your farm'), CARA);
  await waitModal(page, /SAY HI/);
  assert.deepStrictEqual(await plates(page), [], 'no frame: the card as before');
  assert.ok(!/Lighthouse Champion/.test(await modalText(page)));
  await page.evaluate(() => Farm.ui.closeAll());
  // their menu (More)
  await page.evaluate((BEN) => Farm.ui.playerMenu(BEN, 'Ben'), BEN);
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await plates(page), [['gold', 'Ben']]);
  assert.match(await modalText(page), /Ben \| [\s\S]*Lighthouse Champion/);
  await shot(page, 'frames-3-menu');
  await page.evaluate(() => Farm.ui.closeAll());
  // the Lighthouse Board's rows
  await page.evaluate(() => Farm.ui.openTowerBoard());
  await waitModal(page, /TOP 10 THIS WEEK/);
  await page.waitForFunction(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; return m && m.c.list.filter((o) => o.nfKey).length >= 2; }, null, SLOW);
  assert.deepStrictEqual(await plates(page), [['gold', 'Ben'], ['tower_300', 'Ana Acres (you)']], 'Cara has none');
  await shot(page, 'frames-4-board');
  await page.evaluate(() => Farm.ui.closeAll());
  // the lighthouse wall: each boss beaten, its frame under the star; My frame from there
  await page.evaluate(() => Farm.ui.openLighthouseWall());
  await waitModal(page, /Floor 100, Tambanakua: Ana Acres/);
  const wall = await page.evaluate(() => Farm.ui.modals[Farm.ui.modals.length - 1].c.list.filter((o) => o.nfKey).map((o) => o.nfKey));
  assert.deepStrictEqual(wall, ['tower_100', 'tower_300']);
  assert.match(await modalText(page), /Close \| Weekly board \| My frame|My frame/);
  await shot(page, 'frames-5-wall');
  await page.evaluate(() => Farm.ui.closeAll());
  // your farmer card: your name framed, and "Frame"
  await page.evaluate(() => Farm.ui.openPause());
  await page.waitForTimeout(300);
  assert.deepStrictEqual(await plates(page), [['tower_300', await page.evaluate(() => Farm.Logic.farmerName(Farm.session.state))]]);
  const link = await page.evaluate(() => { const l = Farm.ui.modals[Farm.ui.modals.length - 1].c.list.find((o) => o.name === 'frame-link'); return l && l.list[0].text; });
  assert.strictEqual(link, 'Frame');
  await shot(page, 'frames-6-pause');
  await tapButton(page, 'Frame');
  await waitModal(page, /MY FRAME/);
  await page.waitForTimeout(300);
  let mine = await modalText(page);
  assert.match(mine, /MY FRAME \| Back \| Wearing: Berberoka Frame\./, 'Auto: the newest boss frame');
  assert.match(mine, /Auto \| Board frame first, else your newest boss frame\. \| Wearing/);
  assert.match(mine, /Tambanakua Frame \| First to beat Tambanakua, floor 100\. \| Wear \|/);
  assert.match(mine, /Berberoka Frame \| First to beat Berberoka, floor 300\. \| Wear \|/);
  assert.match(mine, /No frame \| Just your name\. \| Wear$/);
  assert.deepStrictEqual((await plates(page)).sort(), [['tower_100', 'Tambanakua Frame'], ['tower_300', 'Berberoka Frame']], 'each frame shown in itself');
  await shot(page, 'frames-7-mine');
  // pick the Tambanakua frame (the first "Wear" is its row's: Auto is worn)
  await tapButton(page, 'Wear', 0);
  await page.waitForFunction(() => window.__db.pick['11111111-2222-4333-8444-555555555555'] === 'tower_100', null, SLOW);
  await waitModal(page, /Tambanakua Frame \| First to beat Tambanakua, floor 100\. \| Wearing/);
  assert.deepStrictEqual(await calls(page, 'farm_frame_pick_v1'), [{ p_frame: 'tower_100' }]);
  mine = await modalText(page);
  assert.match(mine, /Wearing: Tambanakua Frame\.[\s\S]*Auto \| Board frame first, else your newest boss frame\. \| Wear \|/, 'Auto no longer worn');
  await shot(page, 'frames-8-picked');
  await page.evaluate(() => Farm.ui.closeAll());
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Farm.world.nfMe.n.plate.nfKey), 'tower_100', 'over our head too, straight away');
  // a frame not ours: refused, nothing changes
  const r = await page.evaluate(() => Farm.Net.rpc('farm_frame_pick_v1', { p_frame: 'gold' }));
  assert.deepStrictEqual(r, { ok: false, code: 'not-yours' });
  // they go: their frames go with them; ours hides when nobody is near
  await page.evaluate((UID) => window.__rooms['farm:' + UID].presence([]), UID);
  await page.evaluate((ids) => ids.forEach((id) => Farm.Online.onMessage('bye', { id })), [BEN, CARA]);
  await page.evaluate((UID) => window.__rooms['farm:' + UID].presence([]), UID);
  await page.waitForFunction(() => !Object.keys(Farm.world.remotes).length, null, SLOW);
  await frames(page, 3);
  assert.strictEqual(await page.evaluate(() => Farm.world.nfMe.tag.visible), false);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('offline, and a server without frames: nobody wears one, the pages say so, nothing breaks', async () => {
  const off = await open({ online: false });
  await off.page.evaluate(() => Farm.ui.openPause());
  assert.strictEqual(await off.page.evaluate(() => !!Farm.ui.modals[Farm.ui.modals.length - 1].c.list.find((o) => o.name === 'frame-link')), false, 'no Frame link offline');
  await off.page.evaluate(() => Farm.ui.closeAll());
  await off.page.evaluate(() => Farm.ui.openMyFrame());
  assert.match(await modalText(off.page), /MY FRAME \| Join online play to see your frames\./);
  assert.deepStrictEqual(off.problems, []);
  await off.context.close();

  const { page, problems, context } = await open({ noFrames: true });
  await page.waitForFunction(() => Farm.world.mapKey === 'farm' && !Farm.world.busy, null, SLOW);
  await visitors(page);
  await page.waitForFunction(() => Farm.Online.frames.off, null, SLOW);
  await frames(page, 4);
  const worn = await page.evaluate(() => Object.values(Farm.world.remotes).filter((r) => r.nf && (r.nf.plate || r.nf.title)).length);
  assert.strictEqual(worn, 0);
  assert.strictEqual(await page.evaluate(() => Object.keys(Farm.world.remotes).length), 2, 'they are there, names as before');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openMyFrame());
  assert.match(await modalText(page), /MY FRAME \| Name frames are coming very soon\./);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openTowerBoard());
  await waitModal(page, /TOP 10 THIS WEEK/);
  assert.deepStrictEqual(await plates(page), []);
  assert.strictEqual((await calls(page, 'farm_frames_v1')).length, 1, 'asked once, never again');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
