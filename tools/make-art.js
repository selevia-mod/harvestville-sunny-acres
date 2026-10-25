'use strict';
// Generates every sprite sheet into assets/ by drawing them with Canvas 2D in headless
// Chromium (tools/art/draw.js). Run: npm run art
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const vm = require('vm');
const layout = require('./tiles');

// The icon, crop and villager order come from the game's config, so sheets and code always agree.
function gameConfig() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  const dir = path.join(__dirname, '..', 'src');
  fs.readdirSync(dir).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(dir, f), 'utf8'), ctx));
  return ctx.window.Farm.Config;
}

const OUT = path.join(__dirname, '..', 'assets');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const SRC = path.resolve(process.env.ART_SRC || path.join(__dirname, '..', 'art-src'));
  // The page fetches the pictures one by one from a made-up origin (sending them all inside one call is too
  // much at once); the page itself is on that origin, so the canvases stay readable.
  const ORIGIN = 'http://art.local/';
  await page.route(ORIGIN + '**', (route) => {
    const rel = decodeURIComponent(route.request().url().slice(ORIGIN.length));
    if (rel === 'index.html') return route.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><html><body></body></html>' });
    const file = path.join(SRC, rel);
    if (!file.startsWith(SRC) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: 'image/png', body: fs.readFileSync(file) });
  });
  await page.goto(ORIGIN + 'index.html');
  for (const f of ['draw.js', 'icons2.js', 'tiles2.js', 'people.js', 'props.js', 'extra2.js', 'extra3.js', 'furniture.js', 'town2.js', 'outdoor.js']) {
    await page.addScriptTag({ path: path.join(__dirname, 'art', f) });
  }
  await page.addScriptTag({ path: path.join(__dirname, 'art', 'import.js') });
  const C = gameConfig();
  // generated pictures in art-src/ (see tools/art-manifest.js) replace the drawn art they cover
  const { jobs } = require('./art-manifest');
  const found = [];
  jobs.forEach((j) => {
    if (fs.existsSync(path.join(SRC, j.file))) found.push({ ...j, data: ORIGIN + j.file });
  });
  // single icons: art-src/icons/<icon name>.png
  C.ICON_ORDER.forEach((name) => {
    const file = 'icons/' + name + '.png';
    if (fs.existsSync(path.join(SRC, file))) found.push({ id: 'icon_' + name, file, mode: 'icon', name, data: ORIGIN + file });
  });
  console.log(`Using ${found.length} generated pictures from art-src/ (${jobs.length} possible, the rest keep the drawn art)`);
  if (found.length) await page.evaluate((list) => window.ART.prepareOverrides(list), found);
  const sheets = await page.evaluate((L) => window.makeArt(L), JSON.parse(JSON.stringify({
    TILES: layout.TILES, RANCH: layout.RANCH, SEASONS: layout.SEASONS, INDOOR: layout.INDOOR, PROPS: layout.PROPS,
    SEASON_NAMES: layout.SEASON_NAMES, SEASONAL: layout.SEASONAL,
    ICON_ORDER: C.ICON_ORDER, CROP_KEYS: C.CROP_KEYS, VILLAGER_ORDER: C.VILLAGER_ORDER, SHOPPER_KEYS: C.SHOPPERS.map((x) => x.key),
    FX_KINDS: require('./art-manifest').FX_KINDS, HOME: C.HOME, OUTDOOR: { types: C.OUTDOOR.types },
  })));
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  fs.mkdirSync(path.join(OUT, 'props'), { recursive: true });
  Object.keys(sheets).forEach((name) => {
    ['png', 'webp'].forEach((ext) => {
      const url = sheets[name][ext];
      if (!url.startsWith('data:image/' + ext)) throw new Error(`${name}: the browser could not encode ${ext}`);
      const buf = Buffer.from(url.split(',')[1], 'base64');
      fs.writeFileSync(path.join(OUT, `${name}.${ext}`), buf);
      console.log(`assets/${name}.${ext}`.padEnd(22), `${(buf.length / 1024).toFixed(0)} KB`);
    });
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
