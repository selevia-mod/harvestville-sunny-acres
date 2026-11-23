// "Can I see every part of the map?" (a player, 23 Nov 2026: in Decorate the farm's last rows, the pen, the stand and the
// road, stayed under the Decorate panel however far they dragged: the camera stopped too soon. Fixed in 55cd29e; the robot
// had opened that panel and read its words, but never asked this.)
//
// Two kinds of screen:
//  - a camera you drag (Decorate on the farm and at home): the robot drags it with a finger to each edge, as far as it
//    goes, and then asks, for every tile you can walk on and every piece and building: is there a spot the camera
//    reached where that tile is on the screen and NOT under the panel or the bars (what the UI covers is measured from
//    the screen itself: screen.js coverMask)?
//  - a camera that follows you (every place): for every tile you can stand on, are you (the farmer) under the bars or
//    the buttons there? And for everything you use (a door, a shop, a sign): standing where you use it, can you see it?
const { open, go } = require('./page');
const S = require('./screen');
const path = require('path');

const dbg = (s) => { if (process.env.ROBOT_DEBUG) process.stdout.write('    [' + new Date().toISOString().slice(11, 19) + '] ' + s + '\n'); };
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 70);

// The world camera now: what turns a world point into layout px.
const camNow = (page) => page.evaluate(() => {
  const c = Farm.world.cameras.main;
  return { x: c.x, y: c.y, w: c.width, h: c.height, z: c.zoom, sx: c.scrollX, sy: c.scrollY, R: Farm.R, T: Farm.Config.TILE };
});
// world x -> layout x for a camera scrolled to sx (Phaser zooms round the camera's middle)
const lx = (cam, wx, sx) => (cam.x + (wx - (sx + cam.w / 2 - cam.w / (2 * cam.z))) * cam.z) / cam.R;
const ly = (cam, wy, sy) => (cam.y + (wy - (sy + cam.h / 2 - cam.h / (2 * cam.z))) * cam.z) / cam.R;

// What there is to see on this map: the tiles you can walk on (a string of 0/1, W x H), and the things on it (a yard
// piece, a piece of furniture, a door, a shop...) with their tiles.
const mapThings = (page) => page.evaluate(() => {
  const w = Farm.world, C = Farm.Config, s = Farm.session.state, W = w.map.width, H = w.map.height;
  let walk = '';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) walk += w.walkable(x, y) ? '1' : '0';
  // in Decorate on the farm: the tiles a piece may go on (a planter or a path), what you must be able to see to place one
  let place = '';
  if (w.yd) {
    const O = C.OUTDOOR, L = Farm.Logic, farm = Farm.farm();
    const kinds = [O.types.findIndex((t) => t.w === 1 && t.h === 1 && t.kind === 'path'), O.types.findIndex((t) => t.w === 1 && t.h === 1 && !/path|fence|hedge/.test(t.kind || ''))].filter((k) => k >= 0);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) place += kinds.some((k) => !L.yardCantPlace(s, farm, k, x, y)) ? '1' : '0';
  }
  const things = [];
  (w.objects || []).forEach((o) => {
    if (o.x0 == null || o.x1 < 0 || o.y1 < 0 || o.x0 >= W || o.y0 >= H) return;
    // (a walk-through warp at the map's edge is a road out: you walk into it, you need not see it)
    if (o.type === 'warp' && o.props && o.props.walk) return;
    things.push({ what: o.name || o.type, x0: Math.max(0, o.x0), y0: Math.max(0, o.y0), x1: Math.min(W - 1, o.x1), y1: Math.min(H - 1, o.y1), use: true, type: o.type });
  });
  if (w.mapKey === 'farm' && s.yard) s.yard.items.forEach((it) => {
    const t = C.OUTDOOR.types[it.t];
    if (t) things.push({ what: t.name, x0: it.x, y0: it.y, x1: it.x + t.w - 1, y1: it.y + t.h - 1, piece: true });
  });
  if (w.mapKey === 'house' && s.home) s.home.items.forEach((it) => {
    const t = C.HOME.types[it.t];
    if (t) things.push({ what: t.name, x0: it.x, y0: it.y, x1: it.x + t.w - 1, y1: it.y + t.h - 1, piece: true });
  });
  return { map: w.mapKey, W, H, walk, place, things };
});

// A spot on the free part of the screen where a finger can press the ground (no piece under it, so the press pans), with
// the most room to move the way the finger will go (dx, dy: -1, 0, 1).
const groundSpot = (page, band, dx, dy, avoid) => page.evaluate(([band, dx, dy, avoid]) => {
  const w = Farm.world, cam = w.cameras.main, R = Farm.R;
  let best = null, bestRoom = -1;
  for (let y = band.top + 16; y <= band.bottom - 16; y += 14) for (let x = 16; x <= 344; x += 14) {
    if (avoid && Math.abs(x - avoid.x) < 40 && Math.abs(y - avoid.y) < 40) continue;
    const p = cam.getWorldPoint(x * R, y * R);
    const piece = w.yd ? w.yardAt(p.x, p.y) : w.decor ? w.furnAt(p.x, p.y) : null;
    if (piece != null) continue;
    // (nothing of the world's that takes taps there either: an animal, the dog)
    if (w.input.hitTestPointer({ x: x * R, y: y * R, positionToCamera: (c, o) => c.getWorldPoint(x * R, y * R, o) }).length) continue;
    const room = dx > 0 ? 352 - x : dx < 0 ? x - 8 : dy > 0 ? band.bottom - 6 - y : y - band.top - 6;
    if (room > bestRoom) { bestRoom = room; best = { x, y, room }; }
  }
  return best;
}, [band, dx, dy, avoid || null]);

// Drag the camera with a finger toward one edge (finger moves the other way), as far as it goes. Returns the scroll at
// the end, and whether it was still moving after `max` drags (a camera with no edge).
async function dragToEdge(page, band, edge, max = 10) {
  const dir = { bottom: [0, -1], top: [0, 1], right: [-1, 0], left: [1, 0] }[edge]; // (to see the bottom, the finger goes up)
  const box = await S.layoutBox(page);
  let last = await camNow(page), moving = true, still = null;
  for (let i = 0; i < max + 1; i++) {
    const from = await groundSpot(page, band, dir[0], dir[1], still);
    if (!from || from.room < 40) return { cam: last, moving: false, stuck: 'no bare ground to press on' };
    const len = Math.min(from.room, dir[1] ? 320 : 260);
    const to = { x: from.x + dir[0] * len, y: from.y + dir[1] * len };
    await S.drag(page, from, to, { box });
    await page.waitForTimeout(60);
    const now = await camNow(page);
    moving = Math.abs(now.sx - last.sx) + Math.abs(now.sy - last.sy) > 1;
    last = now;
    // (it did not move: at the edge, or that press did not pan; once more from somewhere else to be sure)
    if (!moving && still) break;
    still = moving ? null : from;
  }
  return { cam: last, moving };
}

// Red boxes on the world round the tiles never seen, for the picture (the robot's page only; the game is not changed).
const outline = (page, tiles, color = 0xff2020) => page.evaluate(([tiles, color]) => {
  const w = Farm.world, T = Farm.Config.TILE;
  if (w.__robotG) w.__robotG.destroy();
  const g = w.__robotG = w.add.graphics().setDepth(1e9);
  g.lineStyle(T * 0.1, color, 1);
  tiles.slice(0, 600).forEach((t) => g.strokeRect(t[0] * T + T * 0.08, t[1] * T + T * 0.08, T * 0.84, T * 0.84));
}, [tiles, color]);
const unOutline = (page) => page.evaluate(() => { const w = Farm.world; if (w.__robotG) { w.__robotG.destroy(); w.__robotG = null; } });

// Say which tiles: by what is on them, else by rows and columns.
function describe(tiles, info) {
  const named = new Map();
  const bare = [];
  for (const [x, y] of tiles) {
    const t = info.things.find((o) => x >= o.x0 && x <= o.x1 && y >= o.y0 && y <= o.y1);
    if (t) named.set(t.what, (named.get(t.what) || 0) + 1); else bare.push([x, y]);
  }
  const parts = [];
  if (named.size) parts.push([...named.keys()].slice(0, 8).join(', ') + (named.size > 8 ? ' and ' + (named.size - 8) + ' more' : ''));
  if (bare.length) {
    const ys = bare.map((t) => t[1]), xs = bare.map((t) => t[0]);
    parts.push(bare.length + ' ground tile' + (bare.length > 1 ? 's' : '') + ' (rows ' + Math.min(...ys) + '-' + Math.max(...ys) + ', columns ' + Math.min(...xs) + '-' + Math.max(...xs) + ' of ' + info.W + 'x' + info.H + ')');
  }
  return parts.join('; ');
}

// ---- a camera you drag (Decorate) ----
// Returns { problems, did }. `where`: e.g. 'Decorate (farm), 390x844'.
async function draggedCamera(page, out, where, opts = {}) {
  const problems = [];
  const mask = await S.coverMask(page), band = S.freeBand(mask), Sum = S.prefix(mask);
  const info = await mapThings(page);
  const before = await page.evaluate(() => JSON.stringify((Farm.world.yd ? Farm.session.state.yard.items : Farm.session.state.home.items)));
  const ends = {};
  dbg('  mask ' + JSON.stringify(band) + ' covered cells ' + (mask.bits.match(/1/g) || []).length + ' targets ' + (info.place || info.walk).split('').filter((c) => c === '1').length + ' things ' + info.things.length);
  for (const edge of ['bottom', 'top', 'right', 'left']) ends[edge] = await dragToEdge(page, band, edge, opts.maxDrags || 10);
  const after = await page.evaluate(() => JSON.stringify((Farm.world.yd ? Farm.session.state.yard.items : Farm.session.state.home.items)));
  if (after !== before) problems.push({ what: 'The robot moved a piece while dragging the ground (its finger landed on one): this check is not to be trusted here', where });
  for (const e of Object.keys(ends)) if (ends[e].stuck) problems.push({ what: 'Could not drag toward the ' + e + ': ' + ends[e].stuck, where });
  const cam = ends.bottom.cam;
  // the scrolls reached (a camera with no edge: as far as you like)
  const big = 1e7;
  const sx0 = ends.left.moving ? -big : Math.min(ends.left.cam.sx, ends.right.cam.sx), sx1 = ends.right.moving ? big : Math.max(ends.left.cam.sx, ends.right.cam.sx);
  const sy0 = ends.top.moving ? -big : Math.min(ends.top.cam.sy, ends.bottom.cam.sy), sy1 = ends.bottom.moving ? big : Math.max(ends.top.cam.sy, ends.bottom.cam.sy);
  const T = cam.T, tl = T * cam.z / cam.R; // (a tile on the screen, layout px)
  const fitTile = S.fitGrid(mask, Sum, tl, tl, 0.25); // (seen: the middle half of the tile, where you tap it, is uncovered)
  const seen = (x0, y0) => fitTile(lx(cam, x0 * T, sx1), ly(cam, y0 * T, sy1), lx(cam, x0 * T, sx0), ly(cam, y0 * T, sy0));
  // (Decorate on the farm: every tile a piece may go on; at home, every tile of the room's floor)
  const want = new Set(), ground = info.place || info.walk;
  for (let i = 0; i < ground.length; i++) if (ground[i] === '1') want.add(i);
  info.things.forEach((o) => { for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0; x <= o.x1; x++) want.add(y * info.W + x); });
  const never = [];
  for (const i of want) { const x = i % info.W, y = Math.floor(i / info.W); if (!seen(x, y)) never.push([x, y]); }
  dbg('  reached x ' + [sx0, sx1].map(Math.round) + ' y ' + [sy0, sy1].map(Math.round) + ', never ' + never.length);
  if (never.length) {
    // the picture: dragged as far as it goes toward where those tiles are, with them outlined
    const cx = never.reduce((a, t) => a + t[0], 0) / never.length, cy = never.reduce((a, t) => a + t[1], 0) / never.length;
    const ry = (cy + 0.5) / info.H - 0.5, rx = (cx + 0.5) / info.W - 0.5, edges = [];
    if (Math.abs(ry) > 0.12) edges.push(ry > 0 ? 'bottom' : 'top');
    if (Math.abs(rx) > 0.12) edges.push(rx > 0 ? 'right' : 'left');
    if (!edges.length) edges.push(Math.abs(ry) >= Math.abs(rx) ? (ry > 0 ? 'bottom' : 'top') : (rx > 0 ? 'right' : 'left'));
    for (const e of edges) await dragToEdge(page, band, e, opts.maxDrags || 10);
    const edge = edges.join(' and ');
    await outline(page, never);
    // (the panels and bars see-through in the picture: the red tiles are the ones under them)
    await page.evaluate(() => Farm.ui.cameras.main.setAlpha(0.45));
    const pic = path.join(out, slug(where + ' never seen') + '.png');
    await page.waitForTimeout(80);
    await page.screenshot({ path: pic });
    await page.evaluate(() => Farm.ui.cameras.main.setAlpha(1));
    await unOutline(page);
    problems.push({ what: never.length + ' tile' + (never.length > 1 ? 's' : '') + ' can never be dragged out from under the panel or the bars (red in the picture, where the panel and bars are drawn see-through; the camera dragged as far as it goes toward the ' + edge + '): ' + describe(never, info), where, pic, tiles: never.length });
  }
  return { problems, did: want.size + ' tiles', band, edges: { sx0, sx1, sy0, sy1 } };
}

// ---- a camera that follows you ----
// For every tile you can stand on: the camera where the game puts it (its own updateCamera), and where you are then.
const followBoxes = (page, things) => page.evaluate((things) => {
  const w = Farm.world, cam = w.cameras.main, T = Farm.Config.TILE, R = Farm.R, W = w.map.width, H = w.map.height;
  const feet0 = w.feet, mid0 = { x: cam.scrollX, y: cam.scrollY };
  const toL = (wx, wy) => ({ x: (cam.x + (wx - (cam.scrollX + cam.width / 2 - cam.width / (2 * cam.zoom))) * cam.zoom) / R, y: (cam.y + (wy - (cam.scrollY + cam.height / 2 - cam.height / (2 * cam.zoom))) * cam.zoom) / R });
  const place = (fx, fy) => { w.feet = () => ({ x: fx, y: fy }); for (let k = 0; k < 3; k++) w.updateCamera(1); };
  const me = [], use = [];
  // (only the tiles you can walk to from where you came in: a walkable patch shut off by water or walls is not yours)
  const f0 = w.feet(), seen = new Uint8Array(W * H), q = [Math.floor(f0.y / T) * W + Math.floor(f0.x / T)];
  seen[q[0]] = 1;
  for (let i = 0; i < q.length; i++) {
    const x = q[i] % W, y = (q[i] - x) / W;
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => { const nx = x + dx, ny = y + dy, k = ny * W + nx; if (nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[k] && w.walkable(nx, ny)) { seen[k] = 1; q.push(k); } });
  }
  try {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!seen[y * W + x]) continue;
      place(x * T + T / 2, y * T + T / 2);
      // the farmer: a tile wide, from a tile and a half above the feet to a quarter tile below
      const a = toL(x * T + T * 0.2, y * T - T), b = toL(x * T + T * 0.8, y * T + T * 0.75);
      me.push([x, y, a.x, a.y, b.x, b.y]);
    }
    // the things you use: from each side you can stand on, is the thing (the tile you face) on the screen?
    things.forEach((o, k) => {
      if (!o.use) return;
      const cx = Math.floor((o.x0 + o.x1) / 2), cy = Math.floor((o.y0 + o.y1) / 2);
      const spots = [[cx, o.y1 + 1, cx, o.y1], [o.x0 - 1, cy, o.x0, cy], [o.x1 + 1, cy, o.x1, cy], [cx, o.y0 - 1, cx, o.y0]];
      spots.forEach(([sx, sy, fx, fy]) => {
        if (sx < 0 || sy < 0 || sx >= W || sy >= H || !seen[sy * W + sx]) return;
        place(sx * T + T / 2, sy * T + T / 2);
        const a = toL(fx * T, fy * T), b = toL(fx * T + T, fy * T + T), p = toL(sx * T + T * 0.2, sy * T - T), q = toL(sx * T + T * 0.8, sy * T + T * 0.75);
        use.push([k, sx, sy, a.x, a.y, b.x, b.y, p.x, p.y, q.x, q.y]);
      });
    });
  } finally {
    w.feet = feet0;
    cam.setScroll(mid0.x, mid0.y);
    w.updateCamera(1);
  }
  return { me, use };
}, things);

async function followCamera(page, out, where) {
  const problems = [];
  const mask = await S.coverMask(page), Sum = S.prefix(mask);
  const info = await mapThings(page);
  const { me, use } = await followBoxes(page, info.things);
  const hidden = me.filter((m) => S.coveredShare(mask, Sum, m[2], m[3], m[4], m[5]) > 0.6);
  // (only where the map lets you walk right up to its edge: a lone tile in a corner under a button is noted, not a bug,
  // unless there are several)
  if (hidden.length >= 3) {
    const tiles = hidden.map((m) => [m[0], m[1]]);
    // the picture: standing on the hidden tile nearest the middle of them
    const cx = tiles.reduce((a, t) => a + t[0], 0) / tiles.length, cy = tiles.reduce((a, t) => a + t[1], 0) / tiles.length;
    const at = tiles.slice().sort((p, q) => Math.hypot(p[0] - cx, p[1] - cy) - Math.hypot(q[0] - cx, q[1] - cy))[0];
    const pic = await standAndShoot(page, out, where + ' farmer hidden', at, tiles);
    problems.push({ what: 'Standing on ' + tiles.length + ' tiles, the farmer is under the bars or buttons (cannot be seen): ' + describe(tiles, info), where, pic, tiles: tiles.length });
  }
  const byThing = new Map();
  use.forEach((u) => { const cov = S.coveredShare(mask, Sum, u[3], u[4], u[5], u[6]); const k = u[0]; const best = byThing.get(k); if (!best || cov < best.cov) byThing.set(k, { cov, spot: [u[1], u[2]] }); });
  const unseen = [...byThing.entries()].filter(([, v]) => v.cov > 0.6);
  if (unseen.length) {
    const names = unseen.map(([k]) => info.things[k].what);
    const [k0, v0] = unseen[0];
    const o = info.things[k0];
    const tiles = [];
    for (let y = o.y0; y <= o.y1; y++) for (let x = o.x0; x <= o.x1; x++) tiles.push([x, y]);
    const pic = await standAndShoot(page, out, where + ' cannot see ' + names[0], v0.spot, tiles);
    problems.push({ what: 'Standing where you use it, you cannot see ' + names.slice(0, 6).join(', ') + (names.length > 6 ? ' and ' + (names.length - 6) + ' more' : '') + ' (it is under the bars or buttons)', where, pic });
  }
  return { problems, did: me.length + ' tiles, ' + byThing.size + ' things' };
}
async function standAndShoot(page, out, name, at, tiles) {
  await page.evaluate(([x, y]) => { const w = Farm.world, T = Farm.Config.TILE; Farm.ui.closeAll(); w.setFeet(x * T + T / 2, y * T + T / 2); w.updateCamera(1); }, at);
  await page.waitForTimeout(150);
  await outline(page, tiles);
  const pic = path.join(out, slug(name) + '.png');
  await page.evaluate(() => Farm.ui.cameras.main.setAlpha(0.45));
  await page.screenshot({ path: pic });
  await page.evaluate(() => Farm.ui.cameras.main.setAlpha(1));
  await unOutline(page);
  return pic;
}

// ---- the check ----
// Places where the camera follows you (the hunting grounds, Manila, the town...). The mine and the Tower floors are
// rooms that fit the screen mostly; they are in too (cheap).
const FOLLOW_MAPS = ['farm', 'town', 'manila', 'mall', 'plains', 'jungle', 'gorge', 'house', 'mine'];
async function reach(browser, out, opts = {}) {
  const found = [], notes = [];
  const sizes = opts.sizes || [undefined];
  const saves = opts.saves || [{ name: 'the robot\'s farm', save: null }];
  let did = 0;
  for (const farm of saves) for (const size of sizes) {
    const sz = size ? ', ' + size.name : '';
    const fname = saves.length > 1 || farm.save ? ' (' + farm.name + ')' : '';
    const { page, problems, context } = await open(browser, { save: farm.save, size, slow: opts.slow, calm: !!farm.save, seeded: true });
    const from = problems.length;
    try {
      // Decorate on the farm
      if (await go(page, 'farm')) {
        await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openDecor(); });
        await page.waitForTimeout(opts.slow ? 3000 : 1200); // (the quest card and the side buttons fade out first)
        if (!(await page.evaluate(() => !!Farm.world.yd))) found.push({ what: 'Decorate did not start on the farm', where: 'Decorate (farm)' + fname + sz });
        else {
          dbg('decorate farm');
          const r = await draggedCamera(page, out, 'Decorate (farm)' + fname + sz);
          found.push(...r.problems); did++;
          notes.push('Decorate farm' + sz + ': ' + r.did);
          await page.evaluate(() => Farm.world.endYard());
          await page.waitForTimeout(200);
        }
      }
      // Decorate at home
      if (await go(page, 'house')) {
        await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openDecor(); });
        await page.waitForTimeout(opts.slow ? 3000 : 1200); // (the quest card and the side buttons fade out first)
        if (await page.evaluate(() => !!Farm.world.decor)) {
          dbg('decorate home');
          const r = await draggedCamera(page, out, 'Decorate (home)' + fname + sz, { maxDrags: 3 });
          found.push(...r.problems); did++;
          await page.evaluate(() => Farm.world.endDecor());
          await page.waitForTimeout(200);
        }
      }
      // every place, walking
      for (const map of opts.maps || FOLLOW_MAPS) {
        if (!(await go(page, map))) { found.push({ what: 'Could not get there', where: 'Reach: ' + map + fname + sz }); continue; }
        await page.evaluate(() => Farm.ui.closeAll());
        dbg('walking ' + map);
        const r = await followCamera(page, out, 'Walking on ' + map + fname + sz);
        found.push(...r.problems); did++;
      }
    } catch (e) {
      found.push({ what: 'The robot itself stopped: ' + e.message.split('\n')[0], where: 'Reach' + fname + sz });
    }
    dbg('done');
    problems.slice(from).forEach((p) => found.push({ what: p, where: 'Reach' + fname + sz }));
    await context.close();
  }
  return { name: 'Reach every part of the map', did: did + ' screens on ' + saves.length + ' farm' + (saves.length > 1 ? 's' : '') + ' x ' + sizes.length + ' phone size' + (sizes.length > 1 ? 's' : ''), problems: found };
}

module.exports = { reach, draggedCamera, followCamera, mapThings, dragToEdge, camNow };
