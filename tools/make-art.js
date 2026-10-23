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
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'src', '00-config.js'), 'utf8'), ctx);
  return ctx.window.Farm.Config;
}

const OUT = path.join(__dirname, '..', 'assets');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  for (const f of ['draw.js', 'icons2.js', 'tiles2.js', 'people.js', 'props.js']) {
    await page.addScriptTag({ path: path.join(__dirname, 'art', f) });
  }
  const C = gameConfig();
  const sheets = await page.evaluate((L) => window.makeArt(L), JSON.parse(JSON.stringify({
    TILES: layout.TILES, RANCH: layout.RANCH, SEASONS: layout.SEASONS, INDOOR: layout.INDOOR, PROPS: layout.PROPS,
    SEASON_NAMES: layout.SEASON_NAMES, SEASONAL: layout.SEASONAL,
    ICON_ORDER: C.ICON_ORDER, CROP_KEYS: C.CROP_KEYS, VILLAGER_ORDER: C.VILLAGER_ORDER,
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
