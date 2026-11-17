// Manila Friends end to end in the built page (dist/index.html) in a phone-sized headless Chromium, every network call
// blocked (the 'manila' pack comes from dist/packs, as the phone holds it): talking to each of the 10, a gift, a story
// scene (Lola Amparo's first photo), the Friendship Book's Manila page, Father Ramon at the Old Stone Church (his
// blessing; knocking at night), and the first-time tour. Run alone, after `node build.js`:
//   node --test --test-concurrency=1 test/e2e-manila-friends.test.js      (SHOTS=/some/dir saves the screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const START = [2026, 11, 18, 12, 30]; // (a Wednesday, half past noon: everyone is out)
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();

// the app's side of the packs (as e2e-grand-market.test.js): files from dist/packs
const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true }); });
test.after(async () => { await browser.close(); });

async function open(savedState, when = START, quiet = true) {
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
  await page.addInitScript(([state, now, here, quiet]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state: state, quiet: quiet, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, at(when), allPackFiles(), quiet]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a farm in town, every tip seen but this tour's, plenty of gold: `edit` runs in the page (s, L, C)
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    s.gold = 50000; s.energy = 100; s.map = 'town';
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1;
    const i = C.TIPS.findIndex((t) => t.key === 'mn_friends_tour');
    if (i < 31) s.tips &= ~(1 << i); else if (i < 63) s.tq &= ~(1 << (i - 31)); else s.tq2 &= ~(1 << (i - 63));
    eval(edit); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const actionLabel = (page) => page.evaluate(() => Farm.ui.actionLabel.text);
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
async function tapAction(page) {
  await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
  await frames(page);
  await page.waitForTimeout(250);
}
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function toManila(page) {
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.world.travel('manila', 'from_train'));
  await waitMap(page, 'manila');
  await page.waitForTimeout(500);
  await page.evaluate(() => Farm.ui.closeAll());
}
const modalText = (page) => page.evaluate(() => {
  const out = [], walk = (list) => list.forEach((o) => { if (o.type === 'Text') out.push(o.text); if (o.list) walk(o.list); });
  const m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (m) walk(m.c.list);
  return out.join(' | ');
});
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    if (!found[0]) { const any = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label) found.push(o); if (o.list) any(o.list); }); any(m.c.list); } // (a tab)
    if (found[0] && m.c.slimInto) m.c.slimInto(found[0]);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
  await page.waitForTimeout(200);
}
// taps the button `label` in the row whose name starts with `row`
async function tapIn(page, row, label) {
  const pos = await page.evaluate(([row, label]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], names = [], btns = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text.indexOf(row) === 0) names.push(o); if (o.type === 'Text' && o.text === label) btns.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const n = names[0];
    if (!n) return null;
    if (m.c.slimInto) m.c.slimInto(n);
    const b = btns.sort((a, b2) => Math.abs(a.getBounds().centerY - n.getBounds().centerY) - Math.abs(b2.getBounds().centerY - n.getBounds().centerY))[0];
    if (!b) return null;
    if (m.c.slimInto) m.c.slimInto(b);
    const bb = b.getBounds();
    return { x: bb.centerX, y: bb.centerY };
  }, [row, label]);
  assert.ok(pos, `"${label}" in the row "${row}"`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
  await page.waitForTimeout(200);
}
// an open spot on the plaza; the friend `key` brought to stand right in front of you (everyone else out of the way)
async function meet(page, key) {
  const ok = await page.evaluate((key) => {
    const w = Farm.world, C = Farm.Config, d = C.MNF.friends[key], T = 256;
    const v = d.person ? w.mn.people.find((p) => p.key === d.person) : w.mn.roles.find((r) => r.role === d.role2 && r.n === (d.n || 0));
    if (!v) return 'not in the city';
    const free = (x, y) => w.walkable(x, y) && !w.objects.some((o) => x >= o.x0 - 1 && x <= o.x1 + 1 && y >= o.y0 - 1 && y <= o.y1 + 1);
    let spot = null;
    for (let y = 40; y < 60 && !spot; y++) for (let x = 30; x < 55 && !spot; x++) {
      let fine = true;
      for (let dy = -3; dy <= 2 && fine; dy++) for (let dx = -2; dx <= 2 && fine; dx++) fine = free(x + dx, y + dy);
      if (fine) spot = [x, y];
    }
    if (!spot) return 'no open spot';
    w.mn.folk.forEach((f) => { if (f !== v) { f.hold = 1e9; f.path = []; f.x = 2 * T; f.y = 2 * T; w.mnFolkPlace(f); } });
    w.mn.people.forEach((p) => { if (p !== v) { p.hold = 1e9; p.path = []; p.x = 3 * T; p.y = 2 * T; w.mnPlace(p); } });
    w.setFeet((spot[0] + 0.5) * T, (spot[1] + 0.6) * T); w.dir = 'up'; w.idle();
    const f = w.feet();
    v.hold = 1e9; v.path = []; v.x = f.x; v.y = f.y - T;
    if (d.person) { w.mnPlace(v); w.mnFace(v, 'down'); } else { v.inside = false; v.near = true; v.sp.setVisible(true); w.mnFolkPlace(v); w.mnFolkFace(v, 'down'); }
    return true;
  }, key);
  assert.strictEqual(ok, true, key);
  await frames(page, 4);
  await page.waitForTimeout(200);
}
const ORDER = ['mn_rosa', 'mn_danny', 'mn_lando', 'mn_kardo', 'mn_marisol', 'mn_tibo', 'mn_amparo', 'mn_ramon', 'mn_bea', 'mn_nena'];
const NAMES = { mn_rosa: 'Aling Rosa', mn_danny: 'Mang Danny', mn_lando: 'Panday Lando', mn_kardo: 'Mang Kardo', mn_marisol: 'Kapitana Marisol',
  mn_tibo: 'Mang Tibo', mn_amparo: 'Lola Amparo', mn_ramon: 'Father Ramon', mn_bea: 'Bea', mn_nena: 'Aling Nena' };

test('talking to each of the 10 Manila friends: their own picture, their hearts, the Story button (and Aling Nena from her stall)', async () => {
  // all met, 3 hearts each (Aling Nena 8: her free meal), no story step ready (each one's first step taken)
  const save = await makeSave("Farm.Config.MNF.order.forEach((k) => { const f = L.friend(s, k); f.met = 1; f.pts = k === 'mn_nena' ? 80 : 30; f.vs = k === 'mn_nena' ? 4 : 1; }); s.energy = 20;");
  const { page, problems, context } = await open(save);
  await toManila(page);
  assert.ok(await page.evaluate(() => ['npc_aling_rosa', 'npc_priest', 'npc_student_1', 'npc_carinderia_cook'].every((k) => !!Farm.images[k])), 'the owner\'s pictures are in');
  for (let i = 0; i < ORDER.length; i++) {
    const k = ORDER[i];
    await meet(page, k);
    if (k === 'mn_nena') {
      assert.strictEqual(await actionLabel(page), 'Buy', 'her stall stays her stall');
      await tapAction(page);
      const stall = await modalText(page);
      assert.match(stall, /A friend's meal/);
      await shot(page, 'talk-10b-mn_nena-stall-free-meal');
      await tapIn(page, "A friend's meal", 'Eat');
      assert.strictEqual((await state(page)).energy, 20 + 15, 'the free meal: +15 energy');
      await page.waitForTimeout(300);
      await tapButton(page, 'Talk');
    } else {
      assert.strictEqual(await actionLabel(page), 'Talk', k);
      await tapAction(page);
    }
    const txt = await modalText(page);
    assert.ok(txt.includes(NAMES[k]), k + ': ' + txt);
    assert.match(txt, /Story/, k + ': the Story button');
    assert.ok(await page.evaluate((sheet) => Farm.ui.modals[Farm.ui.modals.length - 1].c.list.some((o) => o.type === 'Image' && o.texture && o.texture.key === sheet),
      { mn_rosa: 'npc_aling_rosa', mn_danny: 'npc_mang_danny', mn_lando: 'npc_panday_lando', mn_kardo: 'npc_mang_kardo', mn_marisol: 'npc_kapitana_marisol',
        mn_tibo: 'npc_mang_tibo', mn_amparo: 'npc_lola_amparo', mn_ramon: 'npc_priest', mn_bea: 'npc_student_1', mn_nena: 'npc_carinderia_cook' }[k]), k + ': their own picture');
    await shot(page, 'talk-' + String(i + 1).padStart(2, '0') + '-' + k);
    await page.evaluate(() => Farm.ui.closeAll());
  }
  const s = await state(page);
  ORDER.forEach((k) => assert.strictEqual(s.friends[k].pts, (k === 'mn_nena' ? 80 : 30) + 3, k + ': +3 for the chat'));
  assert.strictEqual(s.mn.met & 1, 1, 'Aling Rosa remembers you, as before');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a gift: hold it, face them, Gift; a love is +15 with their line; once a day', async () => {
  const save = await makeSave("const f = L.friend(s, 'mn_rosa'); f.met = 1; f.pts = 10; f.talked = 1; L.addItem(s, 'pumpkin', 2); s.sel = s.inv.findIndex((x) => x && x.id === 'pumpkin');");
  const { page, problems, context } = await open(save);
  await toManila(page);
  await meet(page, 'mn_rosa');
  assert.strictEqual(await actionLabel(page), 'Gift');
  await tapAction(page);
  const txt = await modalText(page);
  assert.match(txt, /You gave the Pumpkin/);
  assert.match(txt, /Naku! This is the best I have seen all week/);
  await page.waitForTimeout(400);
  await shot(page, 'gift-rosa-loves-pumpkin');
  await page.evaluate(() => Farm.ui.closeAll());
  let s = await state(page);
  assert.strictEqual(s.friends.mn_rosa.pts, 25);
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Talk', 'once a day: then it is Talk again');
  s = await state(page);
  assert.strictEqual(s.inv.find((x) => x && x.id === 'pumpkin').n, 1);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a story scene: Lola Amparo at 2 hearts tells of the walls, a choice, her reply, the reward card with a framed photo', async () => {
  const save = await makeSave("const f = L.friend(s, 'mn_amparo'); f.met = 1; f.pts = 20;");
  const { page, problems, context } = await open(save);
  await toManila(page);
  await meet(page, 'mn_amparo');
  await tapAction(page);
  let txt = await modalText(page);
  assert.match(txt, /they built these walls/);
  assert.match(txt, /Lola Amparo/);
  await shot(page, 'story-1-amparo-scene');
  await tapButton(page, 'Next');
  await tapButton(page, 'Next');
  txt = await modalText(page);
  assert.match(txt, /What do you say\?/);
  await shot(page, 'story-2-amparo-choice');
  await tapButton(page, "The city's arms.");
  txt = await modalText(page);
  assert.match(txt, /now you are inside them too/);
  await shot(page, 'story-3-amparo-reply');
  await tapButton(page, 'OK');
  txt = await modalText(page);
  assert.match(txt, /THE WALLS/);
  assert.match(txt, /A framed photo: "The old walls of the city"/);
  assert.match(txt, /story, 1 of 4/);
  await shot(page, 'story-4-amparo-reward-card');
  await tapButton(page, 'OK');
  const s = await state(page);
  assert.strictEqual(s.friends.mn_amparo.vs, 1, 'step 1 done, the first answer');
  assert.strictEqual(s.friends.mn_amparo.pts, 20 + 3 + 4 + 3, 'the chat, the step, the answer');
  const painting = await page.evaluate(() => { const C = Farm.Config; return Farm.session.state.home.bag[Farm.Logic.furnKey(C.HOME.typeIndex.painting, C.HOME.styleIndex.classic)] || 0; });
  assert.strictEqual(painting, 1, 'a Painting in the house storage');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the Friendship Book: a Manila page beside Willowbrook\'s, a friend\'s page with their unlock and birthday, the old photos', async () => {
  const save = await makeSave("['mn_rosa', 'mn_tibo', 'mn_amparo', 'mn_ramon', 'mn_bea'].forEach((k, i) => { const f = L.friend(s, k); f.met = 1; f.pts = 25 + i * 12; }); L.friend(s, 'mn_tibo').pts = 64; L.friend(s, 'mn_amparo').vs = 2;");
  const { page, problems, context } = await open(save);
  await toManila(page);
  await page.evaluate(() => Farm.ui.openFriends());
  await page.waitForTimeout(400);
  let txt = await modalText(page);
  assert.match(txt, /Friendship Book/);
  assert.match(txt, /Willowbrook.*Manila|Manila.*Willowbrook/s, 'the two pages');
  await shot(page, 'book-1-willowbrook-page-with-manila-tab');
  await tapButton(page, 'Manila');
  await page.waitForTimeout(400);
  txt = await modalText(page);
  assert.match(txt, /met in Manila/);
  assert.match(txt, /Aling Rosa/);
  assert.match(txt, /Mang Tibo/);
  assert.match(txt, /Not met yet. Say hello at/);
  await shot(page, 'book-2-manila-page');
  await tapIn(page, 'Mang Tibo', 'Story');
  await page.waitForTimeout(300);
  assert.match(await modalText(page), /The train at half price \(unlocked\)/, "his page: what he gives");
  await shot(page, 'book-2b-tibo-page-unlocked');
  await tapButton(page, 'Back');
  await page.waitForTimeout(300);
  await tapIn(page, 'Lola Amparo', 'Story');
  await page.waitForTimeout(300);
  txt = await modalText(page);
  assert.match(txt, /The walls/);
  assert.match(txt, /The galleons/);
  assert.match(txt, /Birthday: February 8/);
  assert.match(txt, /framed old-Manila photo/);
  await shot(page, 'book-3-amparo-page');
  await tapButton(page, 'Back');
  await page.waitForTimeout(300);
  await tapButton(page, 'Photos');
  await page.waitForTimeout(400);
  txt = await modalText(page);
  assert.match(txt, /OLD MANILA/);
  assert.match(txt, /The old walls of the city/);
  assert.match(txt, /A galleon on Manila Bay/);
  assert.match(txt, /2 of 4 photos/);
  await shot(page, 'book-4-old-manila-photos');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Father Ramon at the Old Stone Church: at its door by day (his blessing), inside at night (knock)', async () => {
  const save = await makeSave("const f = L.friend(s, 'mn_ramon'); f.met = 1; f.pts = 60; f.vs = 3; s.energy = 30;");
  let { page, problems, context } = await open(save);
  await toManila(page);
  const pr = await page.evaluate(() => { const v = Farm.world.mn.roles.find((r) => r.role === 'priest'); return v && { x: v.x / 256, y: v.y / 256, inside: v.inside, key: v.look.key, post: v.def.post }; });
  assert.ok(pr && !pr.inside, 'out by day');
  assert.strictEqual(pr.key, 'npc_priest', 'in his own picture');
  const church = await page.evaluate(() => Farm.Config.MANILA.buildings.find((b) => b.key === 'church').box);
  assert.ok(pr.x >= church[0] && pr.x <= church[0] + church[2] && pr.y > church[1] + church[3] && pr.y < church[1] + church[3] + 3, 'at the church door: ' + JSON.stringify([pr, church]));
  // stand below him, facing him
  await page.evaluate((p) => {
    const w = Farm.world, v = w.mn.roles.find((r) => r.role === 'priest');
    v.hold = 1e9; v.path = [];
    w.mn.folk.forEach((f) => { if (f !== v && Math.hypot(f.x - v.x, f.y - v.y) < 4 * 256) { f.hold = 1e9; f.path = []; f.x = 512; f.y = 512; w.mnFolkPlace(f); } });
    w.setFeet(v.x + 2.2 * 256, v.y + 0.4 * 256); w.dir = 'left'; w.idle(); // (beside him first, for the picture)
  }, pr);
  await frames(page, 4);
  await page.waitForTimeout(500);
  await shot(page, 'ramon-1-at-the-church-door');
  await page.evaluate(() => { const w = Farm.world, v = w.mn.roles.find((r) => r.role === 'priest'); w.setFeet(v.x, v.y + 256); w.dir = 'up'; w.idle(); });
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  assert.match(await modalText(page), /Blessing/);
  await shot(page, 'ramon-2-talk-with-blessing');
  await tapButton(page, 'Blessing');
  assert.match(await modalText(page), /God bless you/);
  await shot(page, 'ramon-3-blessing');
  assert.strictEqual((await state(page)).energy, 55, '+25 energy');
  await page.evaluate(() => Farm.ui.closeAll());
  assert.deepStrictEqual(problems, []);
  await context.close();
  // at night: inside; knock at the church
  ({ page, problems, context } = await open(save, [2026, 11, 18, 21, 0]));
  await toManila(page);
  const inside = await page.evaluate(() => Farm.world.mn.roles.find((r) => r.role === 'priest').inside);
  assert.strictEqual(inside, true, 'inside at night');
  await page.evaluate((b) => { const w = Farm.world; w.setFeet((b[0] + b[2] / 2) * 256, (b[1] + b[3] + 0.6) * 256); w.dir = 'up'; w.idle(); }, church);
  await frames(page, 4);
  assert.strictEqual(await actionLabel(page), 'Knock');
  await tapAction(page);
  assert.match(await modalText(page), /Father Ramon/);
  await shot(page, 'ramon-4-knock-at-night');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the first-time tour: the first talk to any of the 10 (their own hello, then MANILA FRIENDS, with the owner\'s portraits)', async () => {
  const save = await makeSave('');
  const { page, problems, context } = await open(save, START, true);
  await toManila(page);
  await meet(page, 'mn_tibo');
  await page.evaluate(() => { window.gameHost.quiet = false; });
  await tapAction(page);
  let txt = await modalText(page);
  assert.match(txt, /MANG TIBO/);
  assert.match(txt, /Station master/);
  await shot(page, 'tour-0-first-hello-tibo');
  await tapButton(page, 'OK');
  await page.waitForTimeout(500);
  txt = await modalText(page);
  assert.match(txt, /MANILA FRIENDS/);
  await shot(page, 'tour-1');
  for (let i = 2; i <= 4; i++) {
    await tapButton(page, 'Next');
    await page.waitForTimeout(400);
    await shot(page, 'tour-' + i);
  }
  assert.match(await modalText(page), /Manila page/);
  await tapButton(page, 'Got it');
  const s = await state(page);
  assert.strictEqual(s.friends.mn_tibo.met, 1);
  const seen = await page.evaluate(() => Farm.Logic.tipSeen(Farm.session.state, 'mn_friends_tour'));
  assert.ok(seen, 'shown once');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the frame: the friends add almost nothing (the action button\'s look-up, measured, on a busy plaza)', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await toManila(page);
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const w = Farm.world, P = Object.getPrototypeOf(w), n = 3000;
    const time = (fn) => { const t0 = performance.now(); for (let i = 0; i < n; i++) fn(); return (performance.now() - t0) / n * 1000; };
    const all = time(() => w.resolve());
    const mine = time(() => w.mnFriendAt(w.front(0.7)));
    return { folk: w.mn.folk.length, resolveUs: +all.toFixed(2), friendLookUpUs: +mine.toFixed(2) };
  });
  console.log('Manila friends frame cost (microseconds a call):', JSON.stringify(r));
  assert.ok(r.friendLookUpUs < 100, 'well under a millisecond: ' + JSON.stringify(r));
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('name tags: all 10 have one, just over their own head, following them; two standing close never share or swap tags', async () => {
  const { page, problems, context } = await open(await makeSave(''));
  await toManila(page);
  await meet(page, 'mn_bea');
  // Aling Nena right beside Bea, Father Ramon just behind her (the case of Panday Lando's tag over Father Ramon)
  await page.evaluate(() => {
    const w = Farm.world, R = w.mn.roles, T = 256, bea = R.find((r) => r.role === 'students' && r.n === 0);
    const put = (v, dx, dy) => { v.hold = 1e9; v.path = []; v.inside = false; v.near = true; v.sp.setVisible(true); v.x = bea.x + dx * T; v.y = bea.y + dy * T; w.mnFolkPlace(v); };
    put(R.find((r) => r.role === 'carinderia_cook'), 1, 0);
    put(R.find((r) => r.role === 'priest'), 0, -1);
    const f = w.feet(); w.setFeet(f.x + 2.5 * T, f.y + T); w.dir = 'left'; w.idle();
  });
  await frames(page, 6);
  await page.waitForTimeout(400);
  await shot(page, 'tags-two-friends-close');
  const r = await page.evaluate(() => {
    const w = Farm.world, mn = w.mn, list = mn.ft.map((v) => ({ name: v.tag.text, x: v.x / 256, y: v.y / 256, tx: v.tag.x / 256, ty: v.tag.y / 256, h: v.tag.displayHeight / 256,
      wd: v.tag.displayWidth / 256, vis: v.tag.visible, depth: v.tag.depth, sd: v.sp.depth, near: Math.abs(v.x - w.feet().x) < 4 * 256 && Math.abs(v.y - w.feet().y) < 4 * 256 }));
    return list;
  });
  assert.deepStrictEqual(r.map((t) => t.name).sort(), ['Aling Nena', 'Aling Rosa', 'Bea', 'Father Ramon', 'Kapitana Marisol', 'Lola Amparo', 'Mang Danny', 'Mang Kardo', 'Mang Tibo', 'Panday Lando']);
  const close = r.filter((t) => t.near && t.vis);
  assert.ok(close.length >= 3, 'the three near: ' + JSON.stringify(close));
  close.forEach((t) => {
    assert.ok(Math.abs(t.tx - t.x) < 0.01, t.name + ': over its own person');
    assert.ok(t.ty <= t.y - 1.29 && t.ty > t.y - 3, t.name + ': just over the head ' + JSON.stringify(t));
    assert.ok(t.depth > t.sd && t.depth < t.sd + 1e-6, t.name + ': in its person\'s depth');
  });
  for (let i = 0; i < close.length; i++) for (let j = i + 1; j < close.length; j++) {
    const a = close[i], b = close[j], overlap = Math.abs(a.tx - b.tx) < (a.wd + b.wd) / 2 + 0.19 && a.ty > b.ty - b.h && a.ty - a.h < b.ty;
    assert.ok(!overlap, a.name + ' and ' + b.name + ' tags apart');
  }
  // they follow: Bea walks a tile right, her tag with her
  await page.evaluate(() => { const w = Farm.world, v = w.mn.roles.find((r) => r.role === 'students' && r.n === 0); v.x += 256; w.mnFolkPlace(v); });
  await frames(page, 3);
  const bea = await page.evaluate(() => { const v = Farm.world.mn.roles.find((r) => r.role === 'students' && r.n === 0); return [v.tag.x - v.x, v.tag.visible]; });
  assert.deepStrictEqual(bea, [0, true]);
  // far from the camera: not shown
  const far = await page.evaluate(() => Farm.world.mn.ft.filter((v) => Math.abs(v.x - Farm.world.feet().x) > 30 * 256).every((v) => !v.tag.visible));
  assert.ok(far, 'tags far off are culled');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
