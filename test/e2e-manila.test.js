// Manila, step 1, end to end in the built page (dist/index.html) in a phone-sized headless Chromium: the train from
// Willowbrook Station to Manila Central and back (the first ride free, then 250G), walking from the platform to the
// Central Plaza with the arrow keys, talking to Aling Rosa, the valley road both ways (and its horse-rule hook), and a game
// saved in Manila opening there again. Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-manila.test.js
// SHOTS=/some/dir saves screenshots.
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { chromium } = require('playwright');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const SHOTS = process.env.SHOTS;
const ACTION_BTN = { x: 294, y: 512 };
const SLOW = { timeout: 90000 };
const T = 256;
const at = (w) => new Date(w[0], w[1] - 1, w[2], w[3] || 0, w[4] || 0).getTime();
const NOON = [2026, 4, 1, 12, 30]; // (Aling Rosa is on the plaza from noon to one)

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(savedState, when = NOON, host = {}) {
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
  await page.addInitScript(([state, now, host]) => {
    window.__now = now;
    window.gameHost = Object.assign({ state, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now }, host);
  }, [savedState || null, at(when), host]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
async function makeSave(edit, when = NOON) {
  const { page, context } = await open(null, when);
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
async function tapButton(page, label) {
  const pos = await page.evaluate((label) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const b = found[0] && found[0].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, label);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}
const state = (page) => page.evaluate(() => JSON.parse(JSON.stringify(Farm.session.state)));
const feetTile = (page) => page.evaluate(() => { const f = Farm.world.feet(); return [Math.floor(f.x / 256), Math.floor(f.y / 256)]; });
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
// holds an arrow key until `until` (run in the page) says so
async function walk(page, key, until, arg) {
  await page.keyboard.down(key);
  try { await page.waitForFunction(until, arg, { timeout: 60000, polling: 50 }); } catch (e) {
    throw new Error(key + ': stuck at ' + JSON.stringify(await page.evaluate(() => { const f = Farm.world.feet(); return [f.x / 256, f.y / 256, Farm.world.mapKey, Farm.ui.modals.length]; })));
  } finally { await page.keyboard.up(key); }
  await frames(page, 2);
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

test('the train to Manila and back: the station\'s Manila tab, the first ride free, walk to the plaza, talk to Aling Rosa, home for 250G', async () => {
  const save = await makeSave("s.gold = 1000; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  // Willowbrook Station: the Manila tab, then the ticket
  await teleport(page, 39, 6, 'up');
  assert.strictEqual(await actionLabel(page), 'Station');
  await tapAction(page);
  assert.match(await modalText(page), /Manila/, 'the station has a Manila tab');
  await tapButton(page, 'Manila');
  const ticket = await modalText(page);
  assert.match(ticket, /TRAIN TO MANILA/);
  assert.match(ticket, /first ride is free/);
  await shot(page, 'manila-1-ticket');
  await tapButton(page, 'Ride free');
  await waitMap(page, 'manila');
  let s = await state(page);
  assert.strictEqual(s.gold, 1000, 'the first ride was free');
  assert.deepStrictEqual(await feetTile(page), [64, 9], 'off the train on the platform');
  await page.waitForTimeout(600);
  await shot(page, 'manila-2-platform');
  // the 7 people are out (at their places by the hour)
  const who = await page.evaluate(() => Farm.world.mn.people.map((v) => v.key));
  assert.deepStrictEqual(who, ['rosa', 'danny', 'lando', 'kardo', 'marisol', 'tibo', 'amparo']);
  // (Mang Tibo stands on the platform: out of the way of this walk)
  await page.evaluate(() => { const v = Farm.world.mn.people.find((p) => p.key === 'tibo'); v.hold = 1e9; v.path = []; v.x = 70.5 * 256; v.y = 7.4 * 256; Farm.world.mnPlace(v); });
  // walk: west along the platform to the north road, then down it into the Central Plaza
  await walk(page, 'ArrowLeft', () => Farm.world.feet().x < 47.9 * 256);
  await page.evaluate(() => { const f = Farm.world.feet(); Farm.world.setFeet(47.5 * 256, f.y); }); // (the middle of the road: a slow frame can carry you a little past)
  await walk(page, 'ArrowDown', () => Farm.world.feet().y > 41.5 * 256);
  const t = await feetTile(page);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'manila');
  assert.ok(t[0] >= 40 && t[0] <= 58 && t[1] >= 36 && t[1] <= 54, 'on the plaza: ' + t);
  await shot(page, 'manila-3-plaza');
  // Aling Rosa (on the plaza at half past twelve): stand beside her and Talk
  const side = await page.evaluate(() => {
    const w = Farm.world, v = w.mn.people.find((p) => p.key === 'rosa');
    v.hold = 1e9;
    v.path = [];
    const x = Math.floor(v.x / 256), y = Math.floor(v.y / 256);
    for (const [dx, dy, dir] of [[0, 1, 'up'], [1, 0, 'left'], [-1, 0, 'right'], [0, -1, 'down']]) if (w.walkable(x + dx, y + dy)) return [x + dx, y + dy, dir, v.spot];
    return null;
  });
  assert.ok(side, 'room beside her');
  assert.strictEqual(side[3], 'plaza_s', 'Aling Rosa is on the plaza at noon');
  await teleport(page, side[0], side[1], side[2]);
  await page.evaluate(() => { const w = Farm.world, v = w.mn.people.find((p) => p.key === 'rosa'), f = w.feet(); v.x = f.x + (w.dir === 'left' ? -256 : w.dir === 'right' ? 256 : 0); v.y = f.y + (w.dir === 'up' ? -256 : w.dir === 'down' ? 256 : 0); w.mnPlace(v); });
  await frames(page, 3);
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  const hello = await modalText(page);
  assert.match(hello, /ALING ROSA/);
  assert.match(hello, /Grand Market/);
  await shot(page, 'manila-4-rosa');
  await page.evaluate(() => Farm.ui.closeAll());
  s = await state(page);
  assert.strictEqual(s.mn.met & 1, 1, 'she remembers you');
  // a shop: "coming soon" (the crowd out of the way of these checks: out in the bay, standing still)
  await page.evaluate(() => Farm.world.mn.folk.forEach((v) => { v.hold = 1e9; v.path = []; v.x = 256; v.y = 256; Farm.world.mnFolkPlace(v); }));
  await teleport(page, 67, 43, 'up');
  if (await page.evaluate(() => { const v = Farm.world.mn.people.find((p) => p.key === 'rosa'); return Math.abs(v.x - 67.5 * 256) < 300 && Math.abs(v.y - 42.6 * 256) < 400; })) await teleport(page, 66, 43, 'up');
  assert.strictEqual(await actionLabel(page), 'Look');
  await tapAction(page);
  assert.match(await modalText(page), /GRAND MARKET.*coming soon/is);
  await page.evaluate(() => Farm.ui.closeAll());
  // the Gorge Gate is shut for now
  await teleport(page, 45, 2, 'up');
  assert.strictEqual(await actionLabel(page), 'Gate');
  await tapAction(page);
  assert.match(await modalText(page), /Coming soon/);
  await page.evaluate(() => Farm.ui.closeAll());
  // home: Manila Central's door, 250G
  await page.evaluate(() => { const v = Farm.world.mn.people.find((p) => p.key === 'tibo'); v.hold = 1e9; v.x = 70.5 * 256; v.y = 7.4 * 256; Farm.world.mnPlace(v); });
  await teleport(page, 60, 8, 'up');
  assert.strictEqual(await actionLabel(page), 'Train');
  await tapAction(page);
  assert.match(await modalText(page), /MANILA CENTRAL.*250G one way/s);
  await tapButton(page, 'Ride 250G');
  await waitMap(page, 'town');
  s = await state(page);
  assert.strictEqual(s.gold, 750, 'the ride home was 250G');
  const home = await feetTile(page);
  assert.ok(Math.abs(home[0] - 43) <= 1 && Math.abs(home[1] - 5) <= 1, 'off the train at Willowbrook Station: ' + home);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('the valley road: off the town\'s east end to Manila\'s Plains Gate and back out of it; the horse rule\'s hook can close it', async () => {
  const save = await makeSave("s.gold = 100; s.map = 'town';", [2026, 4, 1, 10, 0]);
  const { page, problems, context } = await open(save, [2026, 4, 1, 10, 0]);
  await waitMap(page, 'town');
  // (a town visitor sometimes waits at the very end of the road: out of this walk's way)
  const clearRoad = () => page.evaluate(() => (Farm.world.villagers ? Farm.world.villagers.list : []).forEach((v) => { if (v.sprite.body && Math.abs(v.sprite.x / 256 - 52.5) < 3 && Math.abs(v.sprite.y / 256 - 11.8) < 3) v.sprite.body.enable = false; }));
  await clearRoad();
  await teleport(page, 51, 11, 'right');
  await walk(page, 'ArrowRight', () => Farm.world.busy || Farm.world.mapKey === 'manila');
  await waitMap(page, 'manila');
  assert.deepStrictEqual(await feetTile(page), [86, 44], 'in at the Plains Gate');
  assert.strictEqual((await state(page)).gold, 100, 'walking is free');
  await shot(page, 'manila-5-plains-gate');
  await walk(page, 'ArrowRight', () => Farm.world.busy || Farm.world.mapKey === 'town');
  await waitMap(page, 'town');
  assert.deepStrictEqual(await feetTile(page), [51, 11], 'back at the town\'s east end');
  // the horse rule (economy part 5) turned on and not met: the road says why, and you stay in town
  await clearRoad();
  await page.evaluate(() => { Farm.Config.MANILA.horseRoad = true; Farm.Logic.horseRoadOk = () => ({ ok: false, why: 'The valley road is long: ride your horse.' }); });
  await walk(page, 'ArrowRight', () => /ride your horse/.test(Farm.ui.toastText.text) || Farm.world.busy);
  await page.waitForTimeout(800);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'town');
  assert.match(await page.evaluate(() => Farm.ui.toastText.text), /ride your horse/);
  assert.ok((await feetTile(page))[0] <= 53, 'still at the east end');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('a game closed in Manila opens there again, at the same spot; its save says town (for an older game) with the city spot', async () => {
  const save = await makeSave("s.gold = 500; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.ui.mnTrain('manila'));
  await tapButton(page, 'Ride free');
  await waitMap(page, 'manila');
  await teleport(page, 30, 44, 'left');
  const saved = await page.evaluate(() => { Farm.world.save(); return Farm.Logic.serialize(Farm.session.state); });
  const townIndex = await page.evaluate(() => Farm.Logic.serialize(Object.assign({}, Farm.session.state, { map: 'town' })).m);
  assert.strictEqual(saved.m, townIndex);
  assert.ok(Array.isArray(saved.mp) && saved.mp[0] === 30 * 256 + 128);
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(saved);
  await waitMap(again.page, 'manila');
  assert.deepStrictEqual(await feetTile(again.page), [30, 44]);
  await shot(again.page, 'manila-6-calle-real');
  assert.deepStrictEqual(again.problems, []);
  await again.context.close();
});

test('the owner\'s pictures, once the pack brings them, take over the stand-ins: a building, a person, the ground', async () => {
  const save = await makeSave("s.gold = 500; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  // as the 'manila' pack would put them in (10b-packs.js F.fetchFile: F.images[key] = the decoded picture)
  await page.evaluate(async () => {
    const pic = (w, h, color) => new Promise((ok) => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d');
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      const i = new Image();
      i.onload = () => ok(i);
      i.src = c.toDataURL();
    });
    Farm.images['props/manila_plaza_fountain'] = await pic(640, 640, '#3366ff');
    Farm.images['props/manila_grand_market'] = await pic(1280, 896, '#ffcc00');
    Farm.images.npc_aling_rosa = await pic(1296, 208, '#ff3366');
    Farm.images.manila_tex_cobble = await pic(256, 256, '#00ff00');
  });
  await page.evaluate(() => Farm.ui.mnTrain('manila'));
  await tapButton(page, 'Ride free');
  await waitMap(page, 'manila');
  const r = await page.evaluate(() => {
    const w = Farm.world, keys = w.props.map((p) => p.texture.key);
    const rosa = w.mn.people.find((p) => p.key === 'rosa');
    const g = Farm.images.manila_ground.getContext('2d'), px = (x, y) => Array.from(g.getImageData(x, y, 1, 1).data);
    return {
      fountain: keys.includes('props/manila_plaza_fountain'), market: keys.includes('props/manila_grand_market'), standIn: keys.includes('props/fountain'),
      labels: w.mn.labels.map((t) => t.text), rosa: rosa.sp.texture.key, tint: rosa.sp.isTinted,
      cobble: px(4 + 64, 4 + 64), plaza: px(4 + 2 * 136 + 64, 4 + 64),
    };
  });
  assert.ok(r.fountain && r.market, 'their own pictures are drawn');
  assert.ok(!r.standIn, 'and the town\'s fountain stand-in is not');
  assert.ok(!r.labels.includes('Grand Market'), 'no label over a building with its own picture');
  assert.ok(r.labels.includes('Trading Post'), 'the others keep theirs');
  assert.strictEqual(r.rosa, 'npc_aling_rosa');
  assert.strictEqual(r.tint, false, 'her own sheet is not tinted');
  assert.deepStrictEqual(r.cobble.slice(0, 3), [0, 255, 0], 'the cobbles are the owner\'s texture');
  assert.notDeepStrictEqual(r.plaza.slice(0, 3), [0, 255, 0], 'the plaza (no picture yet) stays drawn');
  await shot(page, 'manila-7-own-art');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// the crowd (owner, 11 Nov 2026: "make it crowded, we need at least 30 people")
const cityCount = (page) => page.evaluate(() => Farm.world.mn.people.length + Farm.world.mn.folk.filter((v) => !v.leaving).length);
async function toManila(when, host) {
  const save = await makeSave("s.gold = 500; s.map = 'town';", when);
  const o = await open(save, when, host);
  await waitMap(o.page, 'town');
  await o.page.evaluate(() => Farm.ui.mnTrain('manila'));
  await tapButton(o.page, 'Ride free');
  await waitMap(o.page, 'manila');
  return o;
}
test('a crowded city: 30 or more by day, none ever inside a building\'s box, a passer-by says a line about the city', async () => {
  const { page, problems, context } = await toManila(NOON);
  assert.ok(await cityCount(page) >= 30, 'at least 30 in Manila at noon: ' + await cityCount(page));
  // for 10 s: nobody walks in a building's box (not through it, not behind it)
  const inside = await page.evaluate(() => new Promise((ok) => {
    const B = Farm.Config.MANILA.buildings, bad = [], t0 = Date.now();
    const tick = () => {
      const w = Farm.world;
      w.mn.folk.concat(w.mn.people).forEach((v) => {
        if (v.seated) return; // (on a bench: drawn over the bench's own tile)
        const x = Math.floor(v.x / 256), y = Math.floor(v.y / 256);
        B.forEach((b) => { if (x >= b.box[0] && x < b.box[0] + b.box[2] && y >= b.box[1] && y < b.box[1] + b.box[3]) bad.push(b.key + '@' + x + ',' + y); });
      });
      if (Date.now() - t0 < 10000) setTimeout(tick, 200); else ok(bad);
    };
    tick();
  }));
  assert.deepStrictEqual(inside, []);
  const moved = await page.evaluate(() => Farm.world.mn.folk.filter((v) => v.goal).length);
  assert.ok(moved > 10, 'they walk about: ' + moved);
  // a passer-by: stand beside one and Talk
  const side = await page.evaluate(() => {
    const w = Farm.world;
    for (const v of w.mn.folk) {
      if (v.seated) continue;
      const x = Math.floor(v.x / 256), y = Math.floor(v.y / 256);
      if (!w.walkable(x, y + 1)) continue;
      v.hold = 1e9; v.path = []; v.x = (x + 0.5) * 256; v.y = (y + 0.6) * 256; w.mnFolkPlace(v);
      w.mn.people.forEach((p) => { p.hold = 1e9; p.path = []; });
      return [x, y + 1];
    }
    return null;
  });
  assert.ok(side, 'someone to talk to');
  await teleport(page, side[0], side[1], 'up');
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  const said = await modalText(page);
  assert.match(said, /A PASSER-BY/);
  assert.ok(await page.evaluate((t) => Farm.Config.MANILA.crowd.lines.some((l) => t.includes(l)), said), 'one of the city lines');
  await shot(page, 'manila-8-crowd');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('fewer at night (about a third), and about 15 on a cheap phone', async () => {
  const night = await toManila([2026, 4, 1, 23, 0]);
  const n = await cityCount(night.page);
  assert.ok(n >= 8 && n <= 12, 'at night: ' + n);
  assert.deepStrictEqual(night.problems, []);
  await night.context.close();
  const cheap = await toManila(NOON, { lite: true });
  assert.strictEqual(await cheap.page.evaluate(() => Farm.cheapPhone()), true);
  const c = await cityCount(cheap.page);
  assert.ok(c >= 14 && c <= 16, 'a cheap phone: ' + c);
  assert.deepStrictEqual(cheap.problems, []);
  await cheap.context.close();
});
