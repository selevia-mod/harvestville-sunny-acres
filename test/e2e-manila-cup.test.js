// Browser playthroughs of The Manila Cup and Race Day (owner, 18 Nov 2026; src/*manila-cup.js): the track with its arch
// and hurdles, the two first-time tours, a ride (Mang Kardo's stable boy brings the horse; Jump, Sprint, three laps, the
// finish card), the board until the SQL is applied (your own best, "Results open soon") and once it is (mocked), the
// betting window and its odds, a big bet's confirmation, the race in Manila with the crowd, watching it (a photo finish),
// the payout, a bet across a reload, the cups in the house, and the frame time with the CPU slowed 4x. Run alone, after
// HV_PAGE_LIMIT=26214400 node build.js:
// node --test --test-concurrency=1 test/e2e-manila-cup.test.js   (SHOTS=/some/dir saves the screenshots)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const SLOW = { timeout: 120000 };
const manila = (y, mo, d, h = 10, mi = 0, s = 0) => Date.UTC(y, mo - 1, d, h - 8, mi, s);
const START = manila(2026, 11, 18, 10, 3);

const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true }); browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

// the page at `now` (ms); the game's clock runs on from there in real time (window.__run) or stands still
async function open(savedState, now = START, quiet = true) {
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
    window.__run = false;
    let last = null;
    const tick = (t) => { if (window.__run && last != null) window.__now += t - last; last = t; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    window.gameHost = { state: state, quiet: quiet, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [savedState || null, now, allPackFiles(), quiet]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
// a farm with a horse of 6 hearts and Horseshoes, plenty of Gold, every older tip seen: `edit` runs in the page (s, L, C)
async function makeSave(edit) {
  const { page, context } = await open(null);
  const save = await page.evaluate((edit) => {
    const L = Farm.Logic, C = Farm.Config, s = L.newState();
    s.builds.stable = 1;
    s.horse = { name: 'Chestnut', love: 60, pet: 0, g: 1 << C.HORSE_OUT.gearOrder.indexOf('horseshoes'), st: 70 };
    s.gold = 500000;
    s.energy = 200;
    s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1;
    s.mn.met = 0xffff;
    s.map = 'town';
    eval(edit); // eslint-disable-line no-eval
    return L.serialize(s);
  }, edit || '');
  await context.close();
  return save;
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
async function go(page, map, spawn) {
  await page.evaluate(([m, sp]) => Farm.world.travel(m, sp), [map, spawn]);
  await waitMap(page, map);
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
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label) found.push(o); if (o.list) walk(o.list); });
    if (m) walk(m.c.list);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
}
async function tapText(page, startsWith) {
  const pos = await page.evaluate((t) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text.indexOf(t) === 0) found.push(o); if (o.list) walk(o.list); });
    if (m) walk(m.c.list);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, startsWith);
  assert.ok(pos, `"${startsWith}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page, 4);
}
async function tour(page, name, steps) {
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, SLOW);
  await page.waitForTimeout(700);
  for (let i = 1; i <= steps; i++) {
    await shot(page, name + '-' + i);
    await tapButton(page, i < steps ? 'Next' : 'Got it');
    await page.waitForTimeout(300);
  }
}
// rides the Cup by itself: steers along the track, sprints, jumps before each hurdle (shots: the first jump mid-air)
const DRIVE = () => {
  const L = Farm.Logic, I = Farm.input;
  window.__midJump = false;
  const step = () => {
    const w = Farm.world, mc = w && w.mc;
    if (!mc) { I.jx = I.jy = 0; I.holding = false; if (!window.__stopDrive) requestAnimationFrame(step); return; }
    if (mc.count <= 0 && !mc.t.done) {
      const f = w.feet(), x = f.x / 256, y = f.y / 256, pr = L.mcProj(x, y), a = L.mcPoint(pr.s + 1.8, -0.25), dx = a.x - x, dy = a.y - y, d = Math.hypot(dx, dy) || 1;
      I.jx = dx / d; I.jy = dy / d; I.holding = true;
      const LEN = L.mcLen(), lapD = ((mc.t.d % LEN) + LEN) % LEN;
      if (L.mcHurdles().some((h) => h.s - lapD > 0.6 && h.s - lapD < 1.6)) w.mcJump();
      if (!window.__midJump && mc.t.air > 180 && mc.t.bar < 0.95) window.__midJump = true;
    }
    if (!window.__stopDrive) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
// The page's frame time over ms (requestAnimationFrame, headless Chrome holds at most 60 a second) and the world scene's
// own work in each (its update and drawing): average, 95th, worst
const frameTimes = (page, ms) => page.evaluate((ms) => new Promise((resolve) => {
  const d = [], work = [], sys = Farm.world.sys, step = sys.step, render = sys.render;
  let w = 0;
  sys.step = function () { const t = performance.now(); try { return step.apply(this, arguments); } finally { w += performance.now() - t; } };
  sys.render = function () { const t = performance.now(); try { return render.apply(this, arguments); } finally { w += performance.now() - t; } };
  let last = performance.now();
  const t0 = last;
  const sum = (a) => { a.sort((x, y) => x - y); return { avg: +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1), p95: +a[Math.floor(a.length * 0.95)].toFixed(1), worst: +a[a.length - 1].toFixed(1) }; };
  const tick = (now) => {
    d.push(now - last); work.push(w); w = 0; last = now;
    if (now - t0 < ms) return requestAnimationFrame(tick);
    delete sys.step; delete sys.render;
    resolve({ frame: sum(d), world: sum(work), frames: d.length });
  };
  requestAnimationFrame(tick);
}), ms);

test('the Manila Cup: the track and its hurdles, the tour, a ride (jump, sprint, 3 laps), the finish card, the board', async () => {
  const save = await makeSave('');
  const { page, problems, context } = await open(save, START, false);
  await page.waitForTimeout(1500);
  await page.evaluate(() => Farm.ui.closeAll());
  await waitMap(page, 'town');
  await page.evaluate(() => { window.gameHost.quiet = true; });
  await go(page, 'manila', 'from_train'); // (by train: the horse stays home)
  await page.evaluate(() => { Farm.ui.closeAll(); window.gameHost.quiet = false; });
  assert.strictEqual(await page.evaluate(() => Farm.world.horse), null, 'no horse here');
  // the track: the arch across the west straight, three hurdles on it
  await page.evaluate(() => { Farm.world.setFeet(7.5 * 256, 73 * 256); Farm.world.dir = 'left'; Farm.world.idle(); });
  await frames(page, 30);
  await page.waitForTimeout(500);
  await shot(page, '01-track-hurdles');
  const art = await page.evaluate(() => ['props/manila_race_arch', 'props/manila_hurdle'].every((k) => !!Farm.images[k]));
  assert.ok(art, 'the owner\'s arch and hurdles are drawn');
  // Mang Kardo: the Cup, Race Day or a chat
  await page.evaluate(() => { const w = Farm.world, v = w.mn.people.filter((p) => p.key === 'kardo')[0]; w.mnTalk(v); });
  await frames(page, 4);
  assert.match(await modalText(page), /MANG KARDO.*Manila Cup.*Race Day.*Chat/);
  await tapButton(page, 'Manila Cup');
  await tour(page, '02-tour-cup', 4);
  assert.match(await modalText(page), /THE MANILA CUP.*Your first try today is free/);
  await shot(page, '03-cup-panel');
  await page.evaluate(DRIVE);
  await tapButton(page, 'Ride');
  await page.waitForFunction(() => Farm.world.mc && Farm.world.mc.count > 0, null, SLOW);
  assert.ok(await page.evaluate(() => Farm.world.horse && Farm.session.riding), 'the stable boy brought the horse, and you are on it');
  await page.evaluate(() => { window.__run = true; });
  // the Jump button
  await page.waitForFunction(() => Farm.world.mc && Farm.world.mc.count <= 0, null, SLOW);
  await page.waitForFunction(() => window.__midJump, null, SLOW);
  await shot(page, '04-trial-mid-jump-sprint-bar');
  const mid = await page.evaluate(() => ({ air: Farm.world.mc.t.air, bar: Farm.world.mc.t.bar, label: Farm.ui.actionLabel.text, hud: !!Farm.ui.mcH }));
  assert.ok(mid.air > 0 && mid.bar < 1 && mid.label === 'Sprint' && mid.hud, JSON.stringify(mid));
  const tapAt = await page.evaluate(() => { const b = Farm.ui.mcH.jb; return { x: b.x, y: b.y }; });
  await page.waitForFunction(() => Farm.world.mc && Farm.world.mc.t.air === 0 && Farm.world.mc.t.gap === 0, null, SLOW);
  await page.touchscreen.tap(tapAt.x, tapAt.y);
  await frames(page, 2);
  assert.ok(await page.evaluate(() => !Farm.world.mc || Farm.world.mc.t.air > 0 || Farm.world.mc.t.gap > 0), 'the Jump button jumps');
  await page.waitForFunction(() => Farm.ui.modals.length && Farm.ui.modals[0].c.list.some((o) => o.type === 'Text' && /^FINISH!/.test(o.text)), null, { timeout: 150000 });
  await page.evaluate(() => { window.__run = false; window.__stopDrive = true; });
  await page.waitForTimeout(400);
  await shot(page, '05-finish-time-card');
  const s = await state(page);
  assert.strictEqual(s.mc.wr, 1, 'one run this week');
  assert.ok(s.mc.wb > 26988 && s.mc.wb < 60000, 'a real time: ' + s.mc.wb);
  assert.strictEqual(s.horse.st, 70, 'the horse\'s stamina never touched');
  assert.strictEqual(s.gold, 500000, 'the first try today was free');
  assert.ok(s.mc.wl.length === 3);
  assert.ok(await page.evaluate(() => !Farm.world.horse && !Farm.session.riding), 'the stable boy took the horse home again');
  console.log('[the ride] ' + JSON.stringify({ time: s.mc.wb, laps: s.mc.wl }));
  // the board, the SQL not applied yet: your own best, "Results open soon"
  await page.evaluate(() => {
    Farm.Online.on = true; Farm.Net.available = () => true;
    Farm.Net.rpc = () => Promise.reject(new Error('Could not find the function public.farm_mcup_board_v1 in the schema cache'));
  });
  await tapButton(page, 'Board');
  await page.waitForTimeout(500);
  assert.match(await modalText(page), /MANILA CUP BOARD.*Your best this week: \d:\d\d\.\d\d.*Results open soon/);
  await shot(page, '06-board-results-open-soon');
  // and once it is applied (the server mocked): the top 10, you among them, last week's champion
  await page.evaluate(() => {
    Farm.ui.closeAll();
    const N = Farm.mcNet; N.off = false; N.board = null;
    Farm.Online.me = { id: 'me-1', name: 'Sunny Acres' };
    const names = ['Kalye Farm', 'Bukid ni Lola', 'Mabuhay Ranch', 'Sunny Acres', 'Pasig Fields', 'Tala Farm', 'Ilog Acres', 'Bahay Kubo', 'Masaya Farm', 'Ulan Fields'];
    Farm.Net.rpc = (fn) => Promise.resolve(fn === 'farm_mcup_board_v1' ? { week: '2026-11-16', top: names.map((n, i) => ({ rank: i + 1, id: i === 3 ? 'me-1' : 'u' + i, name: n, ms: 29870 + i * 913 })),
      me: { rank: 4, ms: 32609 }, champ: { id: 'u9', name: 'Kalye Farm', ms: 29544 } } : { ok: false, code: 'none' });
  });
  await page.evaluate(() => Farm.ui.mcOpenBoard());
  await page.waitForTimeout(500);
  const board = await modalText(page);
  assert.match(board, /TOP 10 THIS WEEK.*Sunny Acres \(you\)/);
  assert.match(board, /Manila Cup Champion: Kalye Farm, 0:29\.54/);
  await shot(page, '07-weekly-board');
  // the Hall of Fame: the champion
  await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.mcHall(); });
  await page.waitForTimeout(400);
  assert.match(await modalText(page), /HALL OF FAME.*Manila Cup Champion: Kalye Farm/);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('Race Day: the tour, the window and its odds, a big bet confirmed, the race in Manila, watching it, a photo finish, the payout; a bet across a reload', async () => {
  const save = await makeSave('');
  // a race with a photo finish: bet on its winner (the test may know; the game never shows it before the start)
  const { page, problems, context } = await open(save, START, false);
  const pick = await page.evaluate((now) => {
    const L = Farm.Logic;
    for (let n = L.rdNext(now); ; n++) { const r = L.rdResult(n, 1e15); if (r.photo) return { n, win: r.order[0], start: L.rdStart(n) }; }
  }, START);
  await page.evaluate((t) => { window.__now = t; }, pick.start - 300000);
  await page.waitForTimeout(1500);
  await page.evaluate(() => Farm.ui.closeAll());
  await waitMap(page, 'town');
  await page.evaluate(() => { window.gameHost.quiet = true; });
  await go(page, 'manila', 'from_train');
  await page.evaluate(() => { Farm.ui.closeAll(); window.gameHost.quiet = false; Farm.world.setFeet(15.5 * 256, 60.6 * 256); Farm.world.dir = 'up'; Farm.world.idle(); });
  await frames(page, 5);
  assert.strictEqual(await page.evaluate(() => Farm.ui.actionLabel.text), 'Race Day', 'facing the grandstand');
  await page.evaluate(() => Farm.ui.rdOpen());
  await tour(page, '08-tour-race', 3);
  const txt = await modalText(page);
  assert.match(txt, /RACE DAY.*race.*Bets close in/);
  assert.match(txt, /x\d\.\d.*x\d\.\d.*x\d\.\d.*x\d\.\d.*x\d\.\d.*x\d\.\d/, 'six horses and their odds');
  assert.match(txt, /Bets today: won 0 · lost 0 · 0 of 200,000 bet/);
  const race = await page.evaluate((n) => Farm.Logic.rdRace(n), pick.n);
  await tapText(page, race.horses[pick.win].name);
  await tapButton(page, '50K');
  await shot(page, '09-betting-window-odds');
  await tapButton(page, 'Bet');
  assert.match(await modalText(page), /A BIG BET.*50,000 Gold on/);
  await shot(page, '10-bet-confirmation');
  await tapButton(page, 'Yes');
  await page.waitForTimeout(300);
  let s = await state(page);
  assert.deepStrictEqual(s.mc.bets, [{ n: pick.n, h: pick.win, a: 50000 }]);
  assert.strictEqual(s.gold, 450000);
  assert.match(await modalText(page), /Your bet: 50,000 on/);
  // a reload with the bet waiting: it is still there
  await page.evaluate(() => Farm.world.save());
  const saved = await page.evaluate(() => JSON.parse(window.gameHost.saves[window.gameHost.saves.length - 1]));
  assert.deepStrictEqual(saved.mc.b, [pick.n, pick.win, 50000], 'the bet is in the save');
  await context.close();
  const again = await open(saved, pick.start - 25000);
  await waitMap(again.page, 'manila');
  await again.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.setFeet(15.5 * 256, 60.6 * 256); Farm.world.dir = 'up'; Farm.world.idle(); });
  assert.deepStrictEqual((await state(again.page)).mc.bets, [{ n: pick.n, h: pick.win, a: 50000 }], 'still waiting after the reload');
  // watch it: the camera on the leader, the crowd cheering, a photo finish
  await again.page.evaluate(() => { window.__run = true; Farm.world.rdWatchStart(); });
  await again.page.waitForFunction((st) => window.__now > st + 11000, pick.start, SLOW);
  await shot(again.page, '11-race-running');
  const live = await again.page.evaluate(() => ({ horses: Farm.world.rd.horses.filter((h) => h.img.visible).length, crowd: Farm.world.rd.crowd.filter((p) => p.img.visible).length, hud: !!Farm.ui.rdH }));
  assert.deepStrictEqual(live, { horses: 6, crowd: 10, hud: true });
  await again.page.waitForFunction(() => Farm.ui.modals.length && Farm.ui.modals[0].c.list.some((o) => o.type === 'Text' && o.text === 'PHOTO FINISH!'), null, SLOW);
  await again.page.waitForTimeout(300);
  await shot(again.page, '12-photo-finish');
  await tapButton(again.page, 'OK');
  await again.page.waitForTimeout(800);
  await shot(again.page, '13-race-result');
  await again.page.waitForFunction(() => Farm.ui.modals.length && Farm.ui.modals[0].c.list.some((o) => o.type === 'Text' && / RACE$/.test(o.text)), null, SLOW);
  await again.page.evaluate(() => { window.__run = false; });
  await again.page.waitForTimeout(400);
  assert.match(await modalText(again.page), /won, in a photo finish!.*you won [\d,]+ Gold!/);
  await shot(again.page, '14-payout');
  s = await state(again.page);
  assert.deepStrictEqual(s.mc.bets, [], 'paid');
  assert.strictEqual(s.gold, 450000 + Math.floor(50000 * Math.round(race.horses[pick.win].odds * 10) / 10));
  assert.strictEqual(await again.page.evaluate(() => Farm.world.rdWatch), null, 'the watch is over');
  // far from the track: the horses and the crowd are not drawn
  await again.page.evaluate(() => { Farm.ui.closeAll(); Farm.world.setFeet(60 * 256, 20 * 256); });
  await frames(again.page, 30);
  assert.strictEqual(await again.page.evaluate(() => Farm.world.rd.crowd.filter((p) => p.img.visible).length), 0);
  assert.deepStrictEqual(problems.concat(again.problems), []);
  await again.context.close();
});

test('the cups and the ribbon in the house: the owner\'s cups (or their stand-ins), placed and shown', async () => {
  const save = await makeSave("s.map = 'farm'; s.home.level = 6; const H = C.HOME; ['mc_cup_gold', 'mc_cup_silver', 'mc_cup_bronze', 'mc_ribbon'].forEach((k) => { const t = H.typeIndex[k], at = L.findSpot(s, t, 2 + Object.keys(s.home.bag).length * 2, 3, null); s.home.bag[L.furnKey(t, 0)] = 1; L.placeFurn(s, t, 0, at.x, at.y, 0); });");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  await page.evaluate(() => Farm.needImage('props/manila_cup_gold'));
  await page.evaluate(() => Promise.all(['props/manila_cup_silver', 'props/manila_cup_bronze'].map(Farm.needImage)));
  await go(page, 'house', 'bed');
  const shown = await page.evaluate(() => {
    const H = Farm.Config.HOME, keys = ['mc_cup_gold', 'mc_cup_silver', 'mc_cup_bronze', 'mc_ribbon'].map((k) => H.typeIndex[k]);
    return Farm.world.children.list.filter((o) => o.type === 'Image' && /^furn_/.test(o.texture.key) && keys.includes(o.frame.name) && o.frame.sourceIndex > 0).length;
  });
  assert.strictEqual(shown, 4, 'four pieces drawn from the cups\' picture');
  const top = await page.evaluate(() => { const it = Farm.session.state.home.items.filter((x) => Farm.Config.HOME.types[x.t].mc)[0]; return { x: it.x, y: it.y }; });
  await page.evaluate((p) => { Farm.world.setFeet((p.x + 1.5) * 256, (p.y + 2.5) * 256); Farm.world.idle(); }, top);
  await frames(page, 10);
  await shot(page, '15-cups-in-house');
  await page.evaluate(() => Farm.ui.openStorage && Farm.ui.openStorage(0));
  await page.waitForTimeout(300);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the frame time with the CPU 4x slower: a ride, and watching a race with the crowd (and nothing drawn off the screen)', async () => {
  const save = await makeSave('');
  const { page, problems, context } = await open(save, START);
  await waitMap(page, 'town');
  await go(page, 'manila', 'from_train');
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => { Farm.world.setFeet(12 * 256, 60.6 * 256); });
  await frames(page, 30);
  const idle = await frameTimes(page, 4000);
  await page.evaluate(DRIVE);
  await page.evaluate(() => { window.__run = true; Farm.world.mcRide(); });
  await page.waitForFunction(() => Farm.world.mc && Farm.world.mc.count <= 0, null, SLOW);
  const ride = await frameTimes(page, 8000);
  await page.evaluate(() => { window.__stopDrive = true; if (Farm.world.mc) Farm.world.mcStop(); Farm.ui.closeAll(); });
  const n = await page.evaluate(() => Farm.Logic.rdNext(window.__now));
  await page.evaluate((st) => { window.__now = st - 3000; Farm.world.setFeet(15.5 * 256, 60.6 * 256); Farm.world.rdWatchStart(); }, await page.evaluate((n) => Farm.Logic.rdStart(n), n));
  await page.waitForFunction(() => Farm.world.rd && Farm.world.rd.on, null, SLOW);
  const race = await frameTimes(page, 8000);
  await page.evaluate(() => { Farm.world.rdWatchEnd(); Farm.ui.closeAll(); Farm.world.setFeet(60 * 256, 20 * 256); });
  await frames(page, 30);
  const away = await frameTimes(page, 4000);
  console.log('[CPU x4] Manila by the track: ' + JSON.stringify(idle) + '\n[CPU x4] riding the Cup: ' + JSON.stringify(ride) + '\n[CPU x4] watching a race (6 horses, 10 cheering): ' + JSON.stringify(race) + '\n[CPU x4] the race running off the screen: ' + JSON.stringify(away));
  assert.ok(ride.frames > 0 && race.frames > 0);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  assert.deepStrictEqual(problems.filter((p) => !/Ride stopped/.test(p)), []);
  await context.close();
});
