'use strict';
// Generates every sprite sheet into assets/ by drawing them with Canvas 2D in headless
// Chromium (tools/art/draw.js). Run: npm run art
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const layout = require('./tiles');

const OUT = path.join(__dirname, '..', 'assets');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.setContent('<!DOCTYPE html><html><body></body></html>');
  await page.addScriptTag({ path: path.join(__dirname, 'art', 'draw.js') });
  const sheets = await page.evaluate((L) => window.makeArt(L), JSON.parse(JSON.stringify({ TILES: layout.TILES, RANCH: layout.RANCH })));
  await browser.close();
  if (errors.length) throw new Error(errors.join('\n'));
  Object.keys(sheets).forEach((name) => {
    const png = Buffer.from(sheets[name].split(',')[1], 'base64');
    fs.writeFileSync(path.join(OUT, name + '.png'), png);
    console.log(`assets/${name}.png  ${(png.length / 1024).toFixed(0)} KB`);
  });
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
