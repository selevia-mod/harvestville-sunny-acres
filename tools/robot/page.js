// The robot's game page (tools/robot-check.js): dist/index.html in Chromium at a phone's size, the packs served as the
// app serves them (tests' HOST_ASSETS), every page error, console error and network request kept as a problem.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DIST = process.env.ROBOT_DIST || path.join(ROOT, 'dist'); // (ROBOT_DIST: check another build, e.g. an older one)
const PAGE = 'file://' + path.join(DIST, 'index.html');
const SLOW = { timeout: 90000 };
const ACTION_BTN = { x: 294, y: 512 };
const NOISE = /GL Driver Message|Image tile area not tile size|gameHost\.save failed/;

const assetFile = (file) => {
  const m = /^packs\/([a-z0-9_-]+\.[0-9a-f]{8})$/.exec(file);
  const p = m ? path.join(DIST, 'packs', m[1] + '.webp') : null;
  return p && fs.existsSync(p) ? 'data:image/webp;base64,' + fs.readFileSync(p).toString('base64') : null;
};
const allPackFiles = () => fs.readdirSync(path.join(DIST, 'packs')).map((f) => 'packs/' + f.replace(/\.webp$/, ''));
const HOST_ASSETS = 'window.gameHost.here = window.__here || []; window.gameHost.asset = function (f, save) { window.__testAsset(f).then(function (url) { if (save) window.__gameAssetSaved(f, !!url); else window.__gameAsset(f, url); }); };';

// A rich farm to play with: gold, energy, a full set of machines and some goods, the hunting grounds open.
const RICH = `
  const s = Farm.session.state, L = Farm.Logic, C = Farm.Config;
  L.weather = () => 'sunny'; s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; s.wv = C.NEWS_LATEST; s.name = 'Robot';
  s.goal = 1e6; s.gold = 250000; s.energy = 500; s.lumber = 300; s.stone = 300; if (s.wild) s.wild.n = 200;
  ['tractor', 'seeder', 'harvester'].forEach((k) => { if (C.ITEMS[k]) { L.addItem(s, k, 1); s.mk |= 1 << C.MACHINE_KINDS.indexOf(k); } }); s.mk |= 8;
  ['rod', 'seed_turnip', 'egg', 'milk', 'ore_copper', 'rope', 'farm_cement'].forEach((k) => { try { if (C.ITEMS[k]) L.addItem(s, k, 10); } catch (e) {} });
  Farm.bus.emit('hud'); Farm.ui.closeAll();`;

// A real farm as it is (its gold, its yard), only the first-time tips and the news already read, the weather fine, and
// any panel the start opened (welcome back, a new day) closed: the robot looks at the farm, not at the greetings.
const CALM = `
  const s = Farm.session.state, L = Farm.Logic, C = Farm.Config;
  L.weather = () => 'sunny'; s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; s.wv = C.NEWS_LATEST;
  Farm.bus.emit('hud'); Farm.ui.closeAll(); const d = document.getElementById('farm-ask'); if (d) d.remove();`;

// Real phone sizes (--sizes): the page's size in CSS px, its pixel density, and the phone's browser (the game draws at 2x on
// Android, up to 3x on an iPhone: 20-main.js). The first is the robot's usual phone.
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 13; SM-A145F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const SIZES = [
  { name: '360x640 small Android', w: 360, h: 640, dpr: 2, ua: null },
  { name: '375x667 iPhone SE', w: 375, h: 667, dpr: 2, ua: IPHONE_UA },
  { name: '390x844 iPhone 12-15', w: 390, h: 844, dpr: 3, ua: IPHONE_UA },
  { name: '412x915 big Android', w: 412, h: 915, dpr: 2.625, ua: ANDROID_UA },
  { name: '360x800 tall cheap Android', w: 360, h: 800, dpr: 2, ua: ANDROID_UA },
  { name: '768x1024 tablet', w: 768, h: 1024, dpr: 2, ua: IPAD_UA },
];

// opts: save (a save's JSON: the farm to start on), now, rich (false: the save as it is), packs, size (one of SIZES),
// slow (a busy phone: the CPU this many times slower, and now and then a long frame)
async function open(browser, opts = {}) {
  const size = opts.size || SIZES[0];
  const context = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: size.dpr, hasTouch: true, isMobile: true, ...(size.ua ? { userAgent: size.ua } : {}) });
  const page = await context.newPage();
  if (opts.slow) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: opts.slow });
    page.__cdp = cdp;
    // (now and then a long frame, as a phone busy with something else: 120-400 ms with nothing drawn)
    await page.addInitScript(() => {
      let seed = 7;
      const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      setInterval(() => { if (rnd() < 0.35) { const end = performance.now() + 120 + rnd() * 280; while (performance.now() < end) { /* busy */ } } }, 1500);
    });
  }
  const problems = [];
  page.on('pageerror', (e) => problems.push('page error: ' + e.message + ' ' + String(e.stack || '').split('\n').slice(1, 2).join('').replace(/file:\/\/[^\s)]*/g, 'page').trim()));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.test(m.text())) problems.push('console error: ' + m.text()); });
  await page.route('**/*', (route) => {
    const url = route.request().url();
    if (url.startsWith('file:') || url.startsWith('data:')) return route.continue();
    problems.push('network: ' + url);
    return route.abort();
  });
  if (opts.packs !== false) await context.exposeBinding('__testAsset', (src, file) => assetFile(file));
  await page.addInitScript(([now, save, here]) => {
    window.__now = now;
    window.__here = here;
    window.gameHost = { state: save ? JSON.parse(save) : null, quiet: true, saves: [], save(s) { this.saves.push(JSON.stringify(s)); this.state = s; }, now: () => window.__now };
  }, [opts.now || Date.now(), opts.save || null, opts.packs === false ? [] : allPackFiles()]);
  if (opts.packs !== false) await page.addInitScript(HOST_ASSETS);
  // (seeded: the same farm every run, its stones and weeds where they were last night: a change in the report is the game's)
  if (opts.seeded) await page.addInitScript(() => { let seed = 12345; Math.random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; });
  await page.goto(PAGE, { timeout: 90000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, SLOW);
  if (!opts.save && opts.rich !== false) await page.evaluate(RICH);
  if (opts.calm) await page.evaluate(CALM);
  await page.waitForTimeout(200);
  return { page, problems, context };
}
const frames = (page, n = 3) => page.evaluate((n) => new Promise((r) => { const step = () => (n-- <= 0 ? r() : requestAnimationFrame(step)); step(); }), n);
async function go(page, map, viaFarm) {
  if (await page.evaluate(() => Farm.world.mapKey) === map) return true;
  await page.evaluate((m) => { Farm.ui.closeAll(); const d = document.getElementById('farm-ask'); if (d) d.remove(); Farm.world.travel(m); }, map);
  const ok = await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, map, { timeout: 45000 }).then(() => true, () => false);
  await frames(page, 4);
  if (ok || viaFarm || map === 'farm') return ok;
  // (not every place goes straight to every other: home first, as a player would)
  return (await go(page, 'farm', true)) && go(page, map, true);
}
// The words of every panel open, top last
const words = (page) => page.evaluate(() => {
  const out = [];
  Farm.ui.modals.forEach((m) => { const w = (l) => l.forEach((o) => { if (o.type === 'Text' && o.visible && o.text.trim()) out.push(o.text); if (o.list) w(o.list); }); w(m.c.list); });
  return out;
});
// What is wrong with the words on the panel on top: off the sides of the screen, or on top of each other.
// (Words scrolled away, above or below the screen, are a list's: not a problem.)
const layout = (page) => page.evaluate(() => {
  const W = Farm.ui.scale.width, H = Farm.ui.scale.height, m = Farm.ui.modals[Farm.ui.modals.length - 1];
  if (!m) return { off: [], overlap: [] };
  const shown = (o) => { for (let p = o; p; p = p.parentContainer) if (!p.visible || p.alpha < 0.05) return false; return true; };
  const boxes = [];
  const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text && o.text.trim() && shown(o)) { const b = o.getBounds(); boxes.push({ s: o.text.replace(/\n/g, ' / ').slice(0, 60), l: b.left, r: b.right, t: b.top, b: b.bottom }); } if (o.list) walk(o.list); });
  walk(m.c.list);
  const on = boxes.filter((r) => r.t >= 0 && r.b <= H && r.r - r.l > 1);
  const out = { off: [], overlap: [] };
  on.forEach((r) => { if (r.l < -1 || r.r > W + 1) out.off.push('"' + r.s + '" runs off the ' + (r.l < -1 ? 'left' : 'right')); });
  for (let i = 0; i < on.length; i++) for (let j = i + 1; j < on.length; j++) {
    const a = on[i], c = on[j], w = Math.min(a.r, c.r) - Math.max(a.l, c.l), h = Math.min(a.b, c.b) - Math.max(a.t, c.t);
    if (w > 2 && h > 2 && w * h > 0.15 * Math.min((a.r - a.l) * (a.b - a.t), (c.r - c.l) * (c.b - c.t))) out.overlap.push('"' + a.s + '" on top of "' + c.s + '"');
  }
  return out;
});
const fresh = (problems, from) => problems.slice(from);

module.exports = { ROOT, DIST, ACTION_BTN, SIZES, open, frames, go, words, layout, fresh };
