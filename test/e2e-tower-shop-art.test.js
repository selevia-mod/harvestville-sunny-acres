// Mang Ilaw's shop pictures (owner, 13 Nov 2026; tools/tower/shop-import.js), end to end in the built page
// (dist/index.html) with the tower pack's files as the app gives them: the shop's icons, Mang Ilaw in his own sheet facing
// you, the farmer walking in the Keeper's gear (one piece, a pair, the set, a Tailor Shop look wins, the
// tools' poses stay the farmer's own), and the horse in its look's sheet standing and going alone (the stand-ins until
// the picture is in, and while ridden).
// Run alone, after `node build.js`: node --test --test-concurrency=1 test/e2e-tower-shop-art.test.js
//   (SHOTS=/some/dir: screenshots, and a sheet of the farmer in each piece, each way, next to the farmer's own)
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
const NOON = [2026, 11, 13, 12, 0];

const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(__dirname, '..', 'dist', 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(__dirname, '..', 'dist', 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

let browser;
test.before(async () => { browser = await chromium.launch(); });
test.after(async () => { await browser.close(); });

async function open(savedState, when = NOON) {
  const context = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || (m.type() === 'warning' && /Missing animation|Frame missing|Texture/.test(m.text()))) problems.push('console: ' + m.text()); });
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
  }, [savedState || null, at(when), allPackFiles()]);
  await page.addInitScript(HOST_ASSETS);
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; });
  await page.waitForTimeout(300);
  return { page, problems, context };
}
async function makeSave(edit) {
  const { page, context } = await open(null);
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
    if (found[nth] && m.c.slimInto) m.c.slimInto(found[nth]);
    const b = found[nth] && found[nth].getBounds();
    return b && { x: b.centerX, y: b.centerY };
  }, [label, nth]);
  assert.ok(pos, `button "${label}" is on screen`);
  await page.touchscreen.tap(pos.x, pos.y);
  await frames(page);
}
async function waitMap(page, key) {
  await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, key, SLOW);
  await frames(page, 3);
}
const shot = async (page, name, clip) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), clip }); } };
// the camera held on a point (world units), zoomed in by k from where it was, for a screenshot; let go again
const lookAt = (page, x, y, k = 1.6) => page.evaluate(([x, y, k]) => { const w = Farm.world, cam = w.cameras.main; if (!w.__cam) { w.__cam = [w.updateCamera, cam.zoom]; w.updateCamera = function () {}; } cam.setZoom(w.__cam[1] * k).centerOn(x, y); }, [x, y, k]);
const letGo = (page) => page.evaluate(() => { const w = Farm.world; if (w.__cam) { w.updateCamera = w.__cam[0]; w.cameras.main.setZoom(w.__cam[1]); delete w.__cam; } });
const playerTex = (page) => page.evaluate(() => Farm.world.player.texture.key);
const waitTex = (page, key) => page.waitForFunction((k) => Farm.world.player.texture.key === k, key, SLOW);

const SETUP = "s.map = 'manila'; s.energy = 200; const d = L.towerDoor(); s.player = { x: (d.x + 0.5) * 256, y: (d.y + 1.5) * 256, dir: 'up' }; ";
const keeperAt = (page) => page.evaluate(() => { const k = Farm.world.keeper; return k && { x: Math.floor(k.x / 256), y: Math.floor(k.y / 256 - 0.3), visible: k.sp.visible && k.sp.active }; });
const faceKeeper = async (page) => {
  const k = await keeperAt(page);
  assert.ok(k && k.visible, 'the keeper is there');
  for (const [dx, dy, dir] of [[0, 1, 'up'], [-1, 0, 'right'], [1, 0, 'left'], [0, -1, 'down']]) {
    await teleport(page, k.x + dx, k.y + dy, dir);
    if ((await actionLabel(page)) === 'Shop') return dir;
  }
  assert.fail('no Shop by the keeper');
};

test("Mang Ilaw in his own sheet at the lighthouse, facing you; the shop's icons are the owner's (the '?' still ours)", async () => {
  const save = await makeSave(SETUP + 's.pearls = 100;');
  const { page, problems, context } = await open(save);
  await waitMap(page, 'manila');
  // near him: his sheet is asked for and he wears it (no tint)
  await page.waitForFunction(() => Farm.world.keeper && Farm.world.keeper.sp.texture.key === 'npc_keeper', null, SLOW);
  const k0 = await page.evaluate(() => { const sp = Farm.world.keeper.sp; return { tint: sp.tintTopLeft, frames: sp.texture.frameTotal - 1, own: Farm.world.keeper.own }; });
  assert.deepStrictEqual(k0, { tint: 0xffffff, frames: 9, own: true }, 'his own row of 9, untinted');
  const dir = await faceKeeper(page);
  await tapAction(page);
  assert.match(await modalText(page), /Mang Ilaw's Shop/);
  // he turned to you: you stand below him (facing up), so he faces you: frame 0; from the side, his side frame (6)
  const fr = await page.evaluate(() => Farm.world.keeper.sp.frame.name);
  assert.strictEqual(fr, dir === 'up' ? 0 : dir === 'down' ? 3 : 6);
  // the icons: the owner's picture in the items texture's tower frames
  await page.waitForFunction(() => { const t = Farm.ui.textures.get('items'); return t && t.towerArt; }, null, SLOW);
  const px = await page.evaluate(() => {
    const C = Farm.Config, t = Farm.ui.textures.get('items'), cv = t.towerSrc.image, g = cv.getContext('2d');
    // each icon's cell has the owner's picture (the hat's navy, the pearl's white) where the stand-ins were drawn
    const cell = (name) => { const i = C.TOWER_ICONS.indexOf(name); return g.getImageData((i % 8) * 128, Math.floor(i / 8) * 128, 128, 128).data; };
    const solid = (d) => { let n = 0; for (let j = 3; j < d.length; j += 4) if (d[j] > 200) n++; return n; };
    return C.TOWER_ICONS.map((n) => [n, solid(cell(n))]);
  });
  px.forEach(([n, solid]) => assert.ok(solid > 1500, n + ' has a picture (' + solid + ' px)'));
  await shot(page, 'shop-icons');
  await page.evaluate(() => Farm.ui.closeAll());
  await frames(page, 4);
  await faceKeeper(page);
  await page.evaluate(() => { const w = Farm.world, k = w.keeper, f = w.feet(); k.sp.setFrame(Math.abs(f.x - k.x) > Math.abs(f.y - k.y) ? 6 : f.y < k.y ? 3 : 0).setFlipX(f.x > k.x + 128); });
  // (a step back, so he is not behind your head: still facing you)
  const kp = await page.evaluate(() => { const w = Farm.world, k = w.keeper, f = w.feet(); if (f.y > k.y) w.setFeet(f.x + 0.6 * 256, f.y + 0.7 * 256); return [k.x, k.y]; });
  await lookAt(page, kp[0], kp[1], 1.8);
  await frames(page, 4);
  await shot(page, 'keeper-lighthouse');
  await letGo(page);
  // inside the Tower too: his own sheet
  await page.evaluate(() => Farm.world.travel('tower', 'entrance', 1));
  await page.waitForFunction(() => Farm.world.mapKey === 'tower' && !Farm.world.busy && Farm.world.keeper && Farm.world.keeper.sp.texture.key === 'npc_keeper', null, SLOW);
  await frames(page, 4);
  await faceKeeper(page);
  await page.evaluate(() => { const w = Farm.world, k = w.keeper, f = w.feet(); k.sp.setFrame(Math.abs(f.x - k.x) > Math.abs(f.y - k.y) ? 6 : f.y < k.y ? 3 : 0).setFlipX(f.x > k.x + 128); });
  const kt = await page.evaluate(() => { const w = Farm.world, k = w.keeper, f = w.feet(); if (f.y > k.y) w.setFeet(f.x + 0.6 * 256, f.y + 0.7 * 256); return [k.x, k.y]; });
  await lookAt(page, kt[0], kt[1], 1.8);
  await frames(page, 4);
  await shot(page, 'keeper-tower');
  await letGo(page);
  assert.deepStrictEqual(problems, []);
  await context.close();
});

// the farmer (frames 0-8) in each piece, each way, standing and a step: a picture to look at
async function farmerSheet(page, who, out) {
  const pieces = ['', 'coat', 'hat', 'lantern', 'boots', 'coat_hat', 'set'];
  const cells = [];
  for (const p of pieces) {
    await page.evaluate((p) => { const s = Farm.session.state; ['head', 'feet', 'body', 'charm'].forEach((sl) => Farm.Logic.takeOff(s, sl)); (p === 'set' ? ['coat', 'hat', 'lantern', 'boots'] : p ? p.split('_') : []).forEach((id) => Farm.Logic.wear(s, 'k:' + id)); }, p);
    await waitTex(page, p ? 'kgear_keeper_' + p + '_' + who : who === 'girl' ? 'player_girl' : 'player');
    for (const f of [0, 1, 3, 4, 6, 7]) {
      cells.push(await page.evaluate((f) => {
        const w = Farm.world, sp = w.player, fr = sp.texture.get(f), src = fr.source.image, c = document.createElement('canvas');
        c.width = 256; c.height = 384;
        c.getContext('2d').drawImage(src, fr.cutX, fr.cutY, 256, 384, 0, 0, 256, 384);
        return c.toDataURL('image/png');
      }, f));
    }
  }
  if (!out) return;
  const png = await page.evaluate(async (cells) => {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    c.width = 6 * 140; c.height = 7 * 210;
    g.fillStyle = '#8fc46a'; g.fillRect(0, 0, c.width, c.height);
    for (let i = 0; i < cells.length; i++) {
      const im = await new Promise((r) => { const m = new Image(); m.onload = () => r(m); m.src = cells[i]; });
      const x = (i % 6) * 140, y = Math.floor(i / 6) * 210;
      g.drawImage(im, x + 6, y + 6, 128, 192);
      g.strokeStyle = 'rgba(200,0,0,0.6)'; g.beginPath(); g.moveTo(x, y + 6 + 186); g.lineTo(x + 140, y + 6 + 186); g.stroke(); // (the ground line)
    }
    return c.toDataURL('image/png');
  }, cells);
  fs.writeFileSync(out, Buffer.from(png.split(',')[1], 'base64'));
}

for (const who of ['boy', 'girl']) {
  test(`the ${who} in the Keeper's gear: the coat and hat's pair, the set, three pieces (the two most visible), a Tailor Shop look wins, the tools' poses stay the farmer's own`, async () => {
    const own = who === 'girl' ? 'player_girl' : 'player';
    const save = await makeSave("s.look = '" + who + "'; s.map = 'farm'; s.pearls = 5000; s.energy = 200;");
    const { page, problems, context } = await open(save);
    await waitMap(page, 'farm');
    assert.strictEqual(await playerTex(page), own);
    // the hat, bought at the Keeper's: the farmer walks in the hat's sheet
    await page.evaluate(() => Farm.ui.openKeeper('gear'));
    await tapButton(page, '300 Pearls'); // (the hat: the first 300)
    await page.waitForFunction(() => Farm.Logic.worn(Farm.session.state, 'head') === 'k:hat', null, SLOW);
    await page.evaluate(() => Farm.ui.closeAll());
    await waitTex(page, 'kgear_keeper_hat_' + who);
    // the coat too: the coat and hat's pair sheet
    await page.evaluate(() => Farm.ui.openKeeper('gear'));
    await tapButton(page, '500 Pearls');
    await page.waitForFunction(() => Farm.Logic.worn(Farm.session.state, 'body') === 'k:coat', null, SLOW);
    await page.evaluate(() => Farm.ui.closeAll());
    await waitTex(page, 'kgear_keeper_coat_hat_' + who);
    // its frames: the pair's walking ones, the farmer's own tools' poses (9-14), and its own walk cycles
    const tex = await page.evaluate(([who, own]) => {
      const t = Farm.world.textures.get('kgear_keeper_coat_hat_' + who), o = Farm.world.textures.get(own), px = (tex, f, x, y) => {
        const fr = tex.get(f), c = document.createElement('canvas'); c.width = c.height = 1;
        c.getContext('2d').drawImage(fr.source.image, fr.cutX + x, fr.cutY + y, 1, 1, 0, 0, 1, 1);
        return Array.from(c.getContext('2d').getImageData(0, 0, 1, 1).data).join();
      };
      // a tool pose is the farmer's own, pixel for pixel (a few points down its middle)
      const same = [9, 12, 14].every((f) => [100, 200, 300].every((y) => px(t, f, 128, y) === px(o, f, 128, y)));
      const differs = [0, 3, 6].some((f) => [150, 200, 250].some((y) => px(t, f, 128, y) !== px(o, f, 128, y)));
      return { frames: t.frameTotal - 1, same, differs, anims: ['down', 'up', 'side'].every((d) => Farm.world.anims.exists('walk-' + d + '-kgear_keeper_coat_hat_' + who)) };
    }, [who, own]);
    assert.deepStrictEqual(tex, { frames: 15, same: true, differs: true, anims: true });
    // walking: the coat's walk cycle; a swing of the hoe: the farmer's own tool frames on that texture
    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(500);
    assert.strictEqual(await page.evaluate(() => Farm.world.player.anims.currentAnim && Farm.world.player.anims.currentAnim.key), 'walk-side-kgear_keeper_coat_hat_' + who);
    await page.keyboard.up('ArrowLeft');
    await frames(page, 4);
    const swing = await page.evaluate(() => { const w = Farm.world; w.animateUse(Farm.Config.ICON.hoe || 0, 'swing'); return [w.player.texture.key, w.player.frame.name]; });
    assert.strictEqual(swing[0], 'kgear_keeper_coat_hat_' + who);
    assert.ok(swing[1] >= 9 && swing[1] <= 14, 'a tool pose: ' + swing[1]);
    await page.waitForTimeout(500);
    // a Tailor Shop look worn: it wins; off again: the pair
    await page.evaluate(() => { Farm.session.state.cw = 'elf'; });
    await waitTex(page, 'look_elf_' + who);
    await page.evaluate(() => { Farm.session.state.cw = ''; });
    await waitTex(page, 'kgear_keeper_coat_hat_' + who);
    // the coat off: the hat's sheet; the hat off: the farmer's own (and the pair's sheet let go)
    await page.evaluate(() => Farm.Logic.takeOff(Farm.session.state, 'body'));
    await waitTex(page, 'kgear_keeper_hat_' + who);
    await page.waitForFunction((who) => !Farm.world.textures.exists('kgear_keeper_coat_hat_' + who), who, SLOW);
    await page.evaluate(() => Farm.Logic.takeOff(Farm.session.state, 'head'));
    await waitTex(page, own);
    // the save: nothing new in it (the gear's own keys)
    const keys = await page.evaluate(() => Object.keys(Farm.Logic.serialize(Farm.session.state)).sort().join());
    assert.ok(!/kgear|keeper_/.test(keys));
    // the whole set: its own sheet; three pieces (coat, lantern, boots): the two most visible's pair (coat + lantern)
    await page.evaluate(() => { const s = Farm.session.state; s.kpr = 15; ['coat', 'hat', 'lantern', 'boots'].forEach((id) => Farm.Logic.wear(s, 'k:' + id)); });
    await waitTex(page, 'kgear_keeper_set_' + who);
    await page.evaluate(() => Farm.Logic.takeOff(Farm.session.state, 'head'));
    const three = await page.evaluate(() => Farm.Logic.keeperSheets(Farm.session.state));
    assert.deepStrictEqual(three, ['keeper_coat_lantern_' + who, 'keeper_coat_' + who]);
    await waitTex(page, (await page.evaluate((k) => !!(Farm.packedFile && Farm.packedFile(k)), three[0])) ? 'kgear_' + three[0] : 'kgear_keeper_coat_' + who);
    // each piece and the set, each way (a picture to look at), and on screen walking in each
    await page.evaluate(() => { const s = Farm.session.state; s.kpr = 15; });
    await farmerSheet(page, who, SHOTS ? path.join(SHOTS, 'farmer-' + who + '-pieces.png') : null);
    // on screen: walking each way in each piece, next to a farmer in their own clothes standing still (a friend's
    // look-alike: the same sheet), for size and ground
    for (const piece of ['coat', 'hat', 'lantern', 'boots', 'coat_hat', 'set']) {
      await page.evaluate((p) => { const s = Farm.session.state; ['head', 'feet', 'body', 'charm'].forEach((sl) => Farm.Logic.takeOff(s, sl)); (p === 'set' ? ['coat', 'hat', 'lantern', 'boots'] : p.split('_')).forEach((id) => Farm.Logic.wear(s, 'k:' + id)); }, piece);
      await waitTex(page, 'kgear_keeper_' + piece + '_' + who);
      for (const [dir, k] of [['down', 'down'], ['up', 'up'], ['left', 'side']]) {
        await teleport(page, 30, 20, dir);
        await page.evaluate(([own, k, dir]) => {
          const w = Farm.world, f = w.feet();
          if (!w.__twin) w.__twin = w.add.sprite(0, 0, own, 0).setDepth(w.player.depth);
          w.__twin.setTexture(own, { down: 0, up: 3, side: 6 }[k]).setPosition(w.player.x - 200, w.player.y).setOrigin(w.player.originX, w.player.originY).setScale(w.player.scaleX, w.player.scaleY);
          w.player.anims.play(Farm.walkAnim(k), true);
          w.player.setFlipX(dir === 'right');
          void f;
        }, [own, k, dir]);
        await page.waitForTimeout(180);
        const f = await page.evaluate(() => { const p = Farm.world.player.anims; p.pause(); return Farm.world.feet(); });
        await lookAt(page, f.x - 100, f.y - 180, 2.2);
        await frames(page, 2);
        await shot(page, 'farmer-' + who + '-' + piece + '-walk-' + dir);
        await letGo(page);
        await page.evaluate(() => Farm.world.player.anims.resume());
      }
    }
    await page.evaluate(() => { const w = Farm.world; if (w.__twin) w.__twin.destroy(); });
    assert.deepStrictEqual(problems, []);
    await context.close();
  });
}

test("the horse's looks: its look's sheet standing and going alone (saddle beats lantern), the stand-ins until the picture comes and while ridden", async () => {
  const save = await makeSave("s.pearls = 5000; s.builds.stable = 1; s.horse = { name: 'Kidlat', love: 50, pet: 0 }; s.energy = 200;");
  const { page, problems, context } = await open(save);
  await waitMap(page, 'farm');
  await page.waitForFunction(() => Farm.world.horse && Farm.world.horse.v2 && Farm.world.horse.sprite.texture.key === 'ride2_horse', null, SLOW);
  const hs = () => page.evaluate(() => { const h = Farm.world.horse; return { key: h.sprite.texture.key, shade: h.sh.texture.key, tint: h.sprite.tintTopLeft, glow: !!(h.hlGlow && h.hlGlow.visible), scale: +h.sprite.scaleX.toFixed(4) }; });
  const scale0 = (await hs()).scale;
  // its picture not on the phone yet: the stand-ins (a tint, the lantern's glow)
  await page.evaluate(() => { const pf = Farm.packedFile; Farm.__pf = pf; Farm.packedFile = (k) => (/^horse_look_/.test(k) ? null : pf(k)); });
  await page.evaluate(() => Farm.ui.openKeeper('horse'));
  await tapButton(page, '400 Pearls');
  await page.waitForFunction(() => Farm.Logic.horseLookOn(Farm.session.state, 'saddle'), null, SLOW);
  await tapButton(page, '600 Pearls');
  await page.waitForFunction(() => Farm.Logic.horseLookOn(Farm.session.state, 'lantern'), null, SLOW);
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => { const w = Farm.world, p = w.horse; w.setFeet(p.x, p.y + 1.6 * 256); w.dir = 'up'; w.idle(); });
  await frames(page, 6);
  assert.deepStrictEqual(await hs(), { key: 'ride2_horse', shade: 'ride2_horseshade', tint: 0xffd8b0, glow: true, scale: scale0 });
  // the picture can come: the saddle's sheet (the saddle beats the lantern), no stand-ins, the same size and shadow
  await page.evaluate(() => { Farm.packedFile = Farm.__pf; });
  await page.waitForFunction(() => Farm.world.horse.sprite.texture.key === 'horse_look_saddle', null, SLOW);
  await frames(page, 3);
  assert.deepStrictEqual(await hs(), { key: 'horse_look_saddle', shade: 'ride2_horseshade', tint: 0xffffff, glow: false, scale: scale0 });
  // its frames: ride2_horse's 16
  assert.strictEqual(await page.evaluate(() => Farm.world.horse.sprite.texture.frameTotal - 1), 16);
  // (out in the open field for the pictures)
  await page.evaluate(() => { const w = Farm.world, h = w.horse; w.setFeet(30 * 256 + 128, 20 * 256 + 128); w.dir = 'up'; w.idle(); h.x = 30 * 256 + 128; h.y = 18.6 * 256; });
  await frames(page, 4);
  const looks = [['saddle', 'saddle'], ['lantern', 'lantern'], ['bridle', 'bridle']];
  for (const [id] of looks) {
    await page.evaluate((id) => { const s = Farm.session.state; ['saddle', 'bridle', 'lantern'].forEach((x) => { if (!Farm.Logic.horseLookOwns(s, x)) { s.pearls += 1000; Farm.Logic.horseLookBuy(s, x); } Farm.Logic.horseLookWear(s, x, x === id); }); }, id);
    await page.waitForFunction((id) => Farm.world.horse.sprite.texture.key === 'horse_look_' + id, id, SLOW);
    // standing: toward you, side on
    for (const [face, fr] of [['down', 12], ['side', 14]]) {
      const hp = await page.evaluate((face) => { const h = Farm.world.horse; h.face = face; h.faceFlip = false; return [h.x, h.y]; }, face);
      await lookAt(page, hp[0], hp[1] - 200, 1.6);
      await frames(page, 4);
      assert.strictEqual(await page.evaluate(() => Farm.world.horse.sprite.frame.name), fr);
      await shot(page, 'horse-' + id + '-stand-' + face);
      await letGo(page);
    }
    // going alone (following you): its own gallop's frames, side on 8-11, away 4-7
    const seen = await page.evaluate(async () => {
      const w = Farm.world, h = w.horse, out = {};
      Farm.session.horseFollow = true;
      for (const [dx, dy, k] of [[8, 0, 'side'], [0, -8, 'up']]) {
        const f = w.feet();
        h.x = f.x - dx * 256; h.y = f.y - dy * 256 + 20;
        out[k] = [];
        for (let i = 0; i < 6; i++) { await new Promise((r) => setTimeout(r, 40)); out[k].push(h.sprite.frame.name); } // (before it catches you up)
      }
      return out;
    });
    assert.ok(seen.side.every((f) => f >= 8 && f <= 11), 'side on: ' + seen.side);
    assert.ok(seen.up.every((f) => f >= 4 && f <= 7), 'away: ' + seen.up);
    assert.strictEqual(await page.evaluate(() => Farm.world.horse.sprite.texture.key), 'horse_look_' + id, 'still in its look');
    await page.evaluate(() => { const w = Farm.world, h = w.horse, f = w.feet(); h.x = f.x + 5 * 256; h.y = f.y + 20; });
    await page.waitForTimeout(200);
    const gp = await page.evaluate(() => { Farm.world.time.timeScale = 0; return [Farm.world.horse.x, Farm.world.horse.y]; });
    await lookAt(page, gp[0], gp[1] - 200, 1.6);
    await frames(page, 2);
    await shot(page, 'horse-' + id + '-gallop');
    await letGo(page);
    await page.evaluate(() => { Farm.world.time.timeScale = 1; });
    await page.evaluate(() => { const w = Farm.world, h = w.horse; Farm.session.horseFollow = false; w.setFeet(30 * 256 + 128, 20 * 256 + 128); h.x = 30 * 256 + 128; h.y = 18.6 * 256; });
    await frames(page, 4);
  }
  // ridden: the riding picture (horse and farmer as one), the lantern's glow; got off: its look again
  await page.evaluate(() => { const s = Farm.session.state; Farm.Logic.horseLookWear(s, 'saddle', true); Farm.Logic.horseLookWear(s, 'lantern', true); });
  await page.evaluate(() => { const w = Farm.world, h = w.horse; w.setFeet(h.x, h.y + 0.6 * 256); w.dir = 'up'; w.idle(); w.mount(); });
  await page.keyboard.down('ArrowLeft');
  await page.waitForTimeout(700);
  const ridden = await hs();
  const rp = await page.evaluate(() => [Farm.world.horse.x, Farm.world.horse.y]);
  await lookAt(page, rp[0], rp[1] - 200, 1.6);
  await frames(page, 2);
  await shot(page, 'horse-ridden-gallop');
  await letGo(page);
  await page.keyboard.up('ArrowLeft');
  assert.ok(/^ride2_default_/.test(ridden.key), 'ridden: the riding picture, ' + ridden.key);
  assert.strictEqual(ridden.glow, true, "ridden: the lantern's glow stands in");
  await page.evaluate(() => Farm.world.dismount());
  await page.waitForFunction(() => Farm.world.horse.sprite.texture.key === 'horse_look_saddle', null, SLOW);
  // all off: the horse's own
  await page.evaluate(() => { const s = Farm.session.state; ['saddle', 'bridle', 'lantern'].forEach((x) => Farm.Logic.horseLookWear(s, x, false)); });
  await page.waitForFunction(() => Farm.world.horse.sprite.texture.key === 'ride2_horse', null, SLOW);
  await frames(page, 3);
  const off = await hs();
  assert.deepStrictEqual([off.tint, off.glow], [0xffffff, false]);
  assert.deepStrictEqual(problems, []);
  await context.close();
});
