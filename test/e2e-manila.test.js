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
// (owner, 11 Nov 2026: the city is turned round, the bay on the right and the way in on the left: 00-...-manila-flip.js.
// The places below are the layout's, turned the same way: a tile x -> X(x) = 89 - x, a point x -> PX(x) = 90 - x.)
const X = (x) => 89 - x;
const PX = (x) => 90 - x;

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
async function tapButton(page, label, nth = 0) {
  const pos = await page.evaluate(([label, nth]) => {
    const m = Farm.ui.modals[Farm.ui.modals.length - 1], found = [];
    const walk = (list) => list.forEach((o) => { if (o.type === 'Text' && o.text === label && o.parentContainer && o.parentContainer !== m.c) found.push(o); if (o.list) walk(o.list); });
    walk(m.c.list);
    const b = found[nth] && found[nth].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
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
  assert.deepStrictEqual(await feetTile(page), [X(64), 9], 'off the train on the platform');
  await page.waitForTimeout(600);
  await shot(page, 'manila-2-platform');
  // the 7 people are out (at their places by the hour)
  const who = await page.evaluate(() => Farm.world.mn.people.map((v) => v.key));
  assert.deepStrictEqual(who, ['rosa', 'danny', 'lando', 'kardo', 'marisol', 'tibo', 'amparo']);
  // (Mang Tibo stands on the platform: out of the way of this walk)
  await page.evaluate(() => { const v = Farm.world.mn.people.find((p) => p.key === 'tibo'); v.hold = 1e9; v.path = []; v.x = 19.5 * 256; v.y = 7.4 * 256; Farm.world.mnPlace(v); });
  // walk: east along the platform to the north road, then down it into the Central Plaza
  await walk(page, 'ArrowRight', () => Farm.world.feet().x > 42.1 * 256);
  await page.evaluate(() => { const f = Farm.world.feet(); Farm.world.setFeet(42.5 * 256, f.y); }); // (the middle of the road: a slow frame can carry you a little past)
  await walk(page, 'ArrowDown', () => Farm.world.feet().y > 41.5 * 256);
  const t = await feetTile(page);
  assert.strictEqual(await page.evaluate(() => Farm.world.mapKey), 'manila');
  assert.ok(t[0] >= X(58) && t[0] <= X(40) && t[1] >= 36 && t[1] <= 54, 'on the plaza: ' + t);
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
  await teleport(page, X(67), 43, 'up');
  if (await page.evaluate(() => { const v = Farm.world.mn.people.find((p) => p.key === 'rosa'); return Math.abs(v.x - 22.5 * 256) < 300 && Math.abs(v.y - 42.6 * 256) < 400; })) await teleport(page, X(66), 43, 'up');
  assert.strictEqual(await actionLabel(page), 'Look');
  await tapAction(page);
  assert.match(await modalText(page), /GRAND MARKET.*coming soon/is);
  await page.evaluate(() => Farm.ui.closeAll());
  // the Gorge Gate is shut for now
  await teleport(page, X(45), 2, 'up');
  assert.strictEqual(await actionLabel(page), 'Gate');
  await tapAction(page);
  assert.match(await modalText(page), /Coming soon/);
  await page.evaluate(() => Farm.ui.closeAll());
  // home: Manila Central's door, 250G
  await page.evaluate(() => { const v = Farm.world.mn.people.find((p) => p.key === 'tibo'); v.hold = 1e9; v.x = 19.5 * 256; v.y = 7.4 * 256; Farm.world.mnPlace(v); });
  await teleport(page, X(60), 8, 'up');
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
  // (owner, 11 Nov 2026: off the town's right side, you come in on Manila's left side, by the Plains Gate, facing in)
  assert.deepStrictEqual(await feetTile(page), [X(80), 44], 'in at the Plains Gate, on the city\'s left side');
  assert.strictEqual(await page.evaluate(() => Farm.world.dir), 'right', 'facing into the city');
  assert.strictEqual((await state(page)).gold, 100, 'walking is free');
  await shot(page, 'manila-5-plains-gate');
  await walk(page, 'ArrowLeft', () => Farm.world.busy || Farm.world.mapKey === 'town'); // (west past the gate, over the jeep's road)
  await waitMap(page, 'town');
  assert.deepStrictEqual(await feetTile(page), [51, 11], 'back at the town\'s right (east) end');
  assert.strictEqual(await page.evaluate(() => Farm.world.dir), 'left', 'facing into the town');
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
  await teleport(page, X(30), 44, 'left');
  const saved = await page.evaluate(() => { Farm.world.save(); return Farm.Logic.serialize(Farm.session.state); });
  const townIndex = await page.evaluate(() => Farm.Logic.serialize(Object.assign({}, Farm.session.state, { map: 'town' })).m);
  assert.strictEqual(saved.m, townIndex);
  assert.ok(Array.isArray(saved.mp) && saved.mp[0] === X(30) * 256 + 128);
  assert.deepStrictEqual(problems, []);
  await context.close();
  const again = await open(saved);
  await waitMap(again.page, 'manila');
  assert.deepStrictEqual(await feetTile(again.page), [X(30), 44]);
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
    // city life's: the jeepney's driving sheet, the Ferris wheel in parts, the asphalt, a Mall floor
    Farm.images.manila_jeepney = await pic(1536, 1152, '#ff8800');
    Farm.images['props/manila_ferris_stand'] = await pic(896, 1280, '#888888');
    Farm.images['props/manila_ferris_wheel'] = await pic(896, 896, '#eeeeee');
    Farm.images['props/manila_ferris_car_1'] = await pic(128, 128, '#ff0000');
    Farm.images.manila_tex_asphalt = await pic(256, 256, '#0000ff');
    Farm.images.manila_tex_mallfloor_main = await pic(256, 256, '#ff00ff');
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
  const life = await page.evaluate(() => { const w = Farm.world, g = Farm.images.manila_ground.getContext('2d'), G = Farm.Config.MANILA.GROUND, S = 128, i = G.T.asphalt, x = 4 + (i % G.COLS) * (S + 8) + 64, y = 4 + Math.floor(i / G.COLS) * (S + 8) + 64;
    return { jeep: w.mn.jeep.img.texture.key, jeepType: w.mn.jeep.img.type, cars: (w.mn.cars || []).length, stand: w.props.some((p) => p.texture.key === 'props/manila_ferris_stand'), asphalt: Array.from(g.getImageData(x, y, 1, 1).data).slice(0, 3) }; });
  assert.strictEqual(life.jeep, 'manila_jeepney');
  assert.strictEqual(life.jeepType, 'Sprite', 'the driving sheet: a sprite with frames');
  assert.strictEqual(life.cars, 8, 'the 8 gondolas hang from the wheel');
  assert.ok(life.stand, 'the stand is the building');
  assert.deepStrictEqual(life.asphalt, [0, 0, 255], 'the owner\'s asphalt');
  await page.evaluate(() => Farm.world.travel('mall', 'entrance'));
  await waitMap(page, 'mall');
  const floor = await page.evaluate(() => { const M = Farm.Config.MALLG || Farm.Config.MANILA.MALLG, g = Farm.images[M.NAME].getContext('2d'); return Array.from(g.getImageData(4 + 64, 4 + 64, 1, 1).data).slice(0, 3); });
  assert.deepStrictEqual(floor, [255, 0, 255], 'the Mall\'s main floor is the owner\'s');
  await shot(page, 'manila-7-own-art');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// the crowd (owner, 11 Nov 2026: "make it crowded, we need at least 30 people")
const cityCount = (page) => page.evaluate(() => Farm.world.mn.people.length + Farm.world.mn.folk.filter((v) => !v.leaving && !v.inside && !v.riding).length);
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
        B.forEach((b) => { if (!b.flat && x >= b.box[0] && x < b.box[0] + b.box[2] && y >= b.box[1] && y < b.box[1] + b.box[3]) bad.push(b.key + '@' + x + ',' + y); });
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
  assert.ok(n >= 12 && n <= 20, 'at night: ' + n);
  assert.deepStrictEqual(night.problems, []);
  await night.context.close();
  const cheap = await toManila(NOON, { lite: true });
  assert.strictEqual(await cheap.page.evaluate(() => Farm.cheapPhone()), true);
  const c = await cityCount(cheap.page);
  assert.ok(c >= 10 && c <= 20, 'a cheap phone: ' + c);
  assert.deepStrictEqual(cheap.problems, []);
  await cheap.context.close();
});

// ---------- city life: the jeepney and the Mall (owner, 11 Nov 2026: docs/manila-city-life.md) ----------
// the jeep keeps the clock the test sets: it starts waiting at stop `key` in `lead` ms
const jeepSoon = (page, key, lead) => page.evaluate(([key, lead]) => {
  const L = Farm.Logic, M = Farm.Config.MANILA, i = M.jeep.stops.findIndex((s) => s.key === key);
  let day = Date.UTC(2026, 3, 1, 4, 0);
  if (L.jeepAt(day).stop >= 0) day += M.jeep.stopMs + 1000;
  const base = day + L.jeepWait(day, i) - lead, p0 = performance.now();
  M.jeepNow = () => base + (performance.now() - p0);
  if (Farm.world.mn.jeep) Farm.world.mn.jeep.lag = 0;
}, [key, lead]);
test('the jeepney: "Para po" at the Plaza\'s shed, 15G, on board when it stops, the camera with it, off at the Station', async () => {
  const { page, problems, context } = await toManila(NOON);
  const g0 = (await state(page)).gold;
  await jeepSoon(page, 'plaza', 5000);
  const st0 = await page.evaluate(() => Farm.Config.MANILA.jeep.stops.find((s) => s.key === 'plaza')), w = st0.wait;
  await teleport(page, Math.floor(w[0]), Math.floor(w[1]), st0.shed[0] + st0.shed[2] / 2 < w[0] ? 'left' : 'right'); // (facing its shed)
  assert.strictEqual(await actionLabel(page), 'Para po');
  await tapAction(page);
  assert.match(await modalText(page), /Jeepney/);
  await tapButton(page, '15G', 0); // (the first row: the Station)
  assert.strictEqual((await state(page)).gold, g0 - 15, 'the fare');
  await page.waitForFunction(() => Farm.world.mnRide && Farm.world.mnRide.stage === 'on', null, SLOW);
  await page.waitForTimeout(2500);
  const ride = await page.evaluate(() => { const w = Farm.world, j = w.mn.jeep.at, f = w.feet(); return { j: [j.x * 256, j.y * 256], d: j.dir, f: [f.x, f.y], face: w.dir, cam: w.cameras.main.midPoint.x, label: Farm.ui.actionLabel.text }; });
  if (ride.d === 'left' || ride.d === 'right') { // side on: on its back step, seen from the side, facing its way (owner, 12 Nov 2026)
    const back = (ride.d === 'left' ? 1 : -1) * (ride.f[0] - ride.j[0]) / 256;
    assert.ok(back > 1.2 && back < 1.7 && Math.abs(ride.f[1] - ride.j[1]) < 1.0 * 256, 'on the back step of the jeep: ' + back);
    assert.strictEqual(ride.face, ride.d, 'facing the way it drives');
  } else assert.ok(Math.abs(ride.f[0] - ride.j[0]) < 0.6 * 256 && Math.abs(ride.f[1] - ride.j[1]) < 0.6 * 256 && ride.face === 'down', 'in the jeep, facing you');
  assert.ok(Math.abs(ride.cam - ride.f[0]) < 6 * 256, 'the camera with it');
  await shot(page, 'manila-9-riding');
  await page.waitForFunction(() => !Farm.world.mnRide, null, { timeout: 60000 });
  const off = await feetTile(page);
  const st = await page.evaluate(() => Farm.Config.MANILA.jeep.stops[0].wait);
  assert.deepStrictEqual(off, [Math.floor(st[0]), Math.floor(st[1])], 'off at the Station\'s shed');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
test('the jeepney stops and honks for someone in front of it, never through them, and goes on after', async () => {
  const { page, problems, context } = await toManila(NOON);
  await jeepSoon(page, 'talipapa', 9000); // (on the north road and down the east one before that)
  await page.waitForTimeout(500);
  // stand on the road 3 tiles ahead of it
  const spot = await page.evaluate(() => { const L = Farm.Logic, M = Farm.Config.MANILA, a = L.jeepAt(M.jeepNow() + 1200); return [a.x, a.y, a.dir]; });
  await page.evaluate((p) => { const w = Farm.world; w.setFeet(p[0] * 256, p[1] * 256 + 64); }, spot);
  await page.waitForTimeout(3000);
  const held = await page.evaluate((p) => { const w = Farm.world, j = w.mn.jeep, f = w.feet(); return { lag: j.lag, gap: Math.hypot(j.at.x * 256 - f.x, j.at.y * 256 - f.y) }; }, spot);
  assert.ok(held.lag > 800, 'it waited: ' + held.lag);
  assert.ok(held.gap > 0.6 * 256, 'it never drove into you: ' + held.gap);
  // step aside: it goes on (and catches up)
  await page.evaluate(() => { const w = Farm.world, f = w.feet(); w.setFeet(f.x, f.y + 3 * 256); });
  const d0 = await page.evaluate(() => Farm.world.mn.jeep.at.d);
  await page.waitForTimeout(2500);
  assert.ok(await page.evaluate((d0) => Farm.world.mn.jeep.at.d !== d0, d0), 'it went on');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
test('the Mall: in by its door, a guard and a sales lady and people inside, the food court for energy, out the same door', async () => {
  const { page, problems, context } = await toManila(NOON);
  // (a role is out only once its own sheet is in: owner, 11 Nov 2026; here, as the pack would bring them)
  assert.strictEqual(await page.evaluate(() => Farm.world.mn.roles.length), 0, 'no role wears another\'s look');
  await page.evaluate(async () => { for (const k of ['npc_mall_guard', 'npc_sales_lady']) { const c = document.createElement('canvas'); c.width = 1296; c.height = 208; c.getContext('2d').fillStyle = '#336699'; c.getContext('2d').fillRect(8, 8, 1280, 192); const i = new Image(); await new Promise((ok) => { i.onload = ok; i.src = c.toDataURL(); }); Farm.images[k] = i; } });
  await teleport(page, X(29), 81, 'up');
  await page.evaluate(() => Farm.world.mn.folk.forEach((v) => { if (Math.abs(v.x / 256 - 60.5) < 2 && Math.abs(v.y / 256 - 81.5) < 2) { v.hold = 1e9; v.x = 256; v.y = 256; Farm.world.mnFolkPlace(v); } }));
  await page.waitForTimeout(200);
  assert.strictEqual(await actionLabel(page), 'Enter');
  await shot(page, 'manila-10-mall-outside');
  await tapAction(page);
  await waitMap(page, 'mall');
  const inside = await page.evaluate(() => ({ roles: Farm.world.mn.roles.map((v) => v.role), folk: Farm.world.mn.folk.filter((v) => !v.role).length }));
  assert.deepStrictEqual(inside.roles.sort(), ['guard', 'sales']);
  assert.ok(inside.folk >= 6, 'people walking about: ' + inside.folk);
  // the sales lady
  const sp = await page.evaluate(() => { Farm.world.mn.folk.forEach((p) => { if (!p.role) { p.hold = 1e9; p.path = []; p.x = 24 * 256; p.y = 15 * 256; Farm.world.mnFolkPlace(p); } }); const v = Farm.world.mn.roles.find((r) => r.role === 'sales'); v.hold = 1e9; v.path = []; v.x = 4.5 * 256; v.y = 5.6 * 256; Farm.world.mnFolkPlace(v); return [4, 6]; });
  await teleport(page, sp[0], sp[1], 'up');
  assert.strictEqual(await actionLabel(page), 'Talk');
  await tapAction(page);
  assert.match(await modalText(page), /THE SALES LADY/);
  await page.evaluate(() => Farm.ui.closeAll());
  // the food court: eat for energy
  await page.evaluate(() => { Farm.session.state.energy = 10; Farm.session.state.gold = 500; Farm.world.mn.folk.forEach((v) => { v.hold = 1e9; v.x = 20 * 256; v.y = 15 * 256; Farm.world.mnFolkPlace(v); }); });
  await teleport(page, 3, 9, 'up');
  assert.strictEqual(await actionLabel(page), 'Eat');
  await tapAction(page);
  assert.match(await modalText(page), /Food Court/);
  await tapButton(page, 'Eat', 0);
  const fed = await state(page);
  assert.ok(fed.energy > 10 && fed.gold < 500, 'ate: ' + fed.energy + ', ' + fed.gold);
  await page.evaluate(() => Farm.ui.closeAll());
  await shot(page, 'manila-11-mall-inside');
  // saved in here: as Manila at the door
  const saved = await page.evaluate(() => Farm.Logic.serialize(Farm.session.state));
  assert.ok(saved.mp, 'saved as Manila');
  // out by the door
  await teleport(page, 13, 16, 'down');
  await walk(page, 'ArrowDown', () => Farm.world.busy || Farm.world.mapKey === 'manila');
  await waitMap(page, 'manila');
  const out = await feetTile(page);
  assert.ok(Math.abs(out[0] - X(29)) <= 1 && Math.abs(out[1] - 82) <= 1, 'out in front of the Mall: ' + out);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
test('a city: 50 or more people by day', async () => {
  const { page, problems, context } = await toManila(NOON);
  await page.waitForTimeout(3000);
  const n = await cityCount(page);
  assert.ok(n >= 50, 'at noon: ' + n);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Owner's bug on the phone, 11 Nov 2026: "Manila" said on your phone in Downloads, yet the city showed its stand-ins.
// The app's way (lib/sunny-acres in the app): no pack in the page; gameHost.here lists the files on the phone, and
// gameHost.asset(file) answers a moment later with window.__gameAsset (a data URL) or __gameAssetSaved.
const fs = require('fs');
const PACKS = path.resolve(__dirname, '..', 'dist', 'packs');
async function openApp(savedState, here, city = true) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 } });
  await context.exposeBinding('__appAsset', (src, file) => {
    const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file), p = m && path.join(PACKS, m[1] + '.webp');
    return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
  });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  await page.addInitScript(([state, now, here]) => {
    window.gameHost = { state, quiet: true, save(s) { this.state = s; }, now: () => now, here,
      asset(f, save) { setTimeout(() => window.__appAsset(f).then((u) => (save ? window.__gameAssetSaved(f, !!u) : window.__gameAsset(f, u))), 20 + Math.random() * 60); } };
  }, [savedState, at(NOON), here]);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction((city) => window.Farm && Farm.world && Farm.world.player && (!city || Farm.world.mn), city, SLOW);
  return { page, problems, context };
}
const cityLook = (page) => page.evaluate(() => {
  const w = Farm.world, keys = w.children.list.filter((o) => o.texture).map((o) => o.texture.key);
  return { map: w.mapKey, ready: Farm.packReady('manila'), station: keys.includes('props/manila_station_manila'), towers: keys.filter((k) => /^props\/manila_office_tower/.test(k)).length,
    rail: keys.filter((k) => k === 'props/manila_rail_deck').length, jeep: w.mn.jeep && w.mn.jeep.img.texture.key };
});
test('the city\'s pack from the phone (the app\'s way): a game opened in Manila has its pictures; a pack that reaches the phone while you are there redraws the city where you stand', async () => {
  const save = await makeSave("s.gold = 500; s.map = 'manila'; s.player = { x: 49 * 256 + 128, y: 44 * 256 + 128, dir: 'left' };");
  const all = fs.readdirSync(PACKS).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
  // 1. opened where it was left, the pack on the phone: no travel, the pictures in from the start
  const a = await openApp(save, all);
  const first = await cityLook(a.page);
  assert.strictEqual(first.map, 'manila');
  assert.ok(first.ready, 'the pack went in before the city was drawn');
  assert.ok(first.station, 'Manila Central is the owner\'s picture, not the town-style stand-in');
  assert.strictEqual(first.towers, 2, 'both Business Towers');
  assert.ok(first.rail > 0, 'the elevated rail');
  assert.strictEqual(first.jeep, 'manila_jeepney');
  assert.deepStrictEqual(await feetTile(a.page), [49, 44]);
  assert.deepStrictEqual(a.problems, []);
  await a.context.close();
  // 2. nothing on the phone yet: the stand-ins; then the pack comes down while you stand there
  const b = await openApp(save, []);
  const bare = await cityLook(b.page);
  assert.ok(!bare.ready && !bare.station && !bare.rail, 'the stand-ins meanwhile');
  await b.page.evaluate(() => Farm.downloadPack('manila'));
  await b.page.waitForFunction(() => Farm.packReady('manila') && Farm.world.mn && Farm.world.children.list.some((o) => o.texture && o.texture.key === 'props/manila_station_manila'), null, SLOW);
  const after = await cityLook(b.page);
  assert.ok(after.station && after.towers === 2 && after.rail > 0 && after.jeep === 'manila_jeepney', 'drawn again with the owner\'s pictures');
  assert.deepStrictEqual(await feetTile(b.page), [49, 44], 'where you stood');
  assert.deepStrictEqual(b.problems, []);
  await b.context.close();
});

// Owner's bug, 11 Nov 2026: at the east entry the farmer stood INSIDE the Plains Gate's picture, only her head showing
// between its doors. No gate's picture is ever drawn over her: not where she comes in, not on the way out, not while
// she walks through a gate's opening (the walled quarter's, the Chinatown arch, the race's finish arch).
const gateOver = (page) => page.evaluate(() => {
  const w = Farm.world, p = w.player, a = p.getBounds(), feet = w.feet().y; // (her body: down to her feet, not the frame's empty edge)
  a.bottom = Math.min(a.bottom, feet);
  return w.props.filter((i) => /gate|arch/.test(i.texture.key) && i.depth > p.depth).filter((i) => { const b = i.getBounds(); return b.x < a.right && a.x < b.right && b.y < a.bottom && a.y < b.bottom; }).map((i) => i.texture.key);
});
test('no gate is ever drawn over the farmer: in at the Plains Gate, out along the avenue, and through the openings of the gates you walk through', async () => {
  const save = await makeSave("s.gold = 500; s.map = 'town';");
  const all = fs.readdirSync(PACKS).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
  const { page, problems, context } = await openApp(save, all, false);
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.world.travel('manila', 'from_valley'));
  await waitMap(page, 'manila');
  await frames(page, 4);
  const keys = await page.evaluate(() => Farm.world.props.map((i) => i.texture.key).filter((k) => /gate|arch/.test(k)).sort());
  assert.ok(['props/manila_gate_plains', 'props/manila_wall_gate', 'props/manila_chinatown_arch', 'props/manila_race_arch'].every((k) => keys.includes(k)), 'the gates are the owner\'s pictures: ' + keys);
  assert.deepStrictEqual(await feetTile(page), [X(80), 44], 'in on the city\'s left side');
  assert.deepStrictEqual(await gateOver(page), [], 'nothing of the gate over her where she comes in');
  await shot(page, 'manila-8-plains-gate-entry');
  // out west along the avenue to the valley road, looking every few frames
  await page.keyboard.down('ArrowLeft');
  for (let i = 0; i < 200 && !(await page.evaluate(() => Farm.world.busy || Farm.world.mapKey !== 'manila')); i++) {
    assert.deepStrictEqual(await gateOver(page), [], 'on the way out at ' + (await feetTile(page)));
    await frames(page, 2);
  }
  await page.keyboard.up('ArrowLeft');
  await waitMap(page, 'town');
  await page.evaluate(() => Farm.world.travel('manila', 'from_valley'));
  await waitMap(page, 'manila');
  // through each walk-through gate, north to south, on her own feet
  const M = await page.evaluate(() => JSON.parse(JSON.stringify({ decor: Farm.Config.MANILA.decor, buildings: Farm.Config.MANILA.buildings, pass: Farm.Config.MANILA.pass })));
  const gates = M.decor.map((d) => ({ art: d[0], box: [d[1], d[2], d[3], d[4]] })).concat(M.buildings).filter((b) => M.pass[b.art]);
  assert.strictEqual(gates.length, 3);
  for (const g of gates) {
    const x = g.box[0] + M.pass[g.art][0], y1 = g.box[1] + g.box[3];
    await page.evaluate(() => Farm.world.mn.folk.forEach((v) => { v.sp.setVisible(false); })); // (nobody in her way)
    await teleport(page, x, g.box[1] - 1, 'down');
    await page.keyboard.down('ArrowDown');
    for (let i = 0; i < 200 && (await feetTile(page))[1] <= y1; i++) {
      assert.deepStrictEqual(await gateOver(page), [], g.art + ' at ' + (await feetTile(page)));
      await frames(page, 2);
    }
    await page.keyboard.up('ArrowDown');
    assert.ok((await feetTile(page))[1] >= y1, g.art + ': she walked through it (' + (await feetTile(page)) + ')');
    if (g.art === 'wall_gate') await shot(page, 'manila-9-through-the-wall-gate');
  }
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// Owner, 11 Nov 2026: the city turned round. A game saved in Manila before that may stand where the bay is now: it opens by
// the Plains Gate on the left, facing into the city, never in a wall or the sea.
test('an older game saved where the bay is now opens by the Plains Gate, facing in', async () => {
  const save = await makeSave("s.gold = 500; s.map = 'manila'; s.player = { x: 85 * 256 + 128, y: 30 * 256 + 128, dir: 'right' };");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'manila');
  await frames(page, 3);
  const sp = await page.evaluate(() => Farm.Config.MANILA.spawns.from_valley);
  assert.deepStrictEqual(await feetTile(page), [Math.floor(sp[0]), Math.floor(sp[1])], 'in by the Plains Gate');
  assert.strictEqual(await page.evaluate(() => Farm.world.dir), 'right');
  assert.ok(await page.evaluate(() => { const f = Farm.world.feet(); return Farm.Logic.manilaGrid(Farm.ASSETS.maps.manila, false).ok(Math.floor(f.x / 256), Math.floor(f.y / 256)); }), 'on ground she can walk');
  assert.deepStrictEqual(problems, []);
  await context.close();
});

test('no invisible walls (owner, 12 Nov 2026): a picture narrower than its box is solid only where it stands; the talipapa stalls leave their side tiles free', async () => {
  const save = await makeSave("s.gold = 500; s.map = 'town';");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'town');
  // a stall's picture taller than wide, as the owner's are: in its 4 x 3 box it stands about 1.8 tiles wide, centred
  await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 300; c.height = 512;
    c.getContext('2d').fillRect(0, 0, 300, 512);
    const i = new Image();
    await new Promise((ok) => { i.onload = ok; i.src = c.toDataURL(); });
    Farm.images['props/manila_talipapa_meat'] = i;
  });
  await page.evaluate(() => Farm.ui.mnTrain('manila'));
  await tapButton(page, 'Ride free');
  await waitMap(page, 'manila');
  const at = await page.evaluate(([x0, x1]) => {
    const w = Farm.world, b = (x, y) => !!w.blocked[w.idx(x, y)], spot = w.objects.find((o) => o.type === 'mn_spot' && o.props.art === 'talipapa_meat');
    return { row: [x0, x0 + 1, x0 + 2, x1].map((x) => [b(x, 31), b(x, 32)]), above: b(x0 + 1, 30), spot: spot && [spot.x0, spot.x1] };
  }, [X(84), X(81)]);
  assert.deepStrictEqual(at.row, [[false, false], [true, true], [true, true], [false, false]], 'the stall: its 2 middle tiles solid, the side tiles free');
  assert.strictEqual(at.above, false, 'its top row (the awning) is walked behind');
  assert.deepStrictEqual(at.spot, [X(84) + 1, X(84) + 2], 'facing it: where it stands');
  assert.deepStrictEqual(problems, []);
  await context.close();
});
