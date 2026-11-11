'use strict';
// Builds dist/index.html: one offline page with Phaser, the game code, the Tiled maps
// and every image inlined (images as data URLs). No network requests at runtime.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const list = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort();

// Small sheets cut from big ones (the furniture styles' thumbnails, the farmhands' stand-ins): cut again whenever what
// they are cut from changes (tools/art/cut-sheets.js keeps a hash of it in assets/cut-sheets.json).
{
  const r = require('child_process').spawnSync(process.execPath, [path.join(ROOT, 'tools', 'art', 'cut-sheets.js'), '--if-changed'], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('tools/art/cut-sheets.js failed');
}

// Each sheet is inlined from its .webp copy when there is one (about 6x smaller than the PNG,
// which stays in assets/ for Tiled), otherwise from the PNG.
const images = {};
list('assets', '.png').forEach((f) => {
  const name = path.basename(f, '.png');
  const webp = path.join(ROOT, 'assets', name + '.webp');
  images[name] = fs.existsSync(webp)
    ? 'data:image/webp;base64,' + fs.readFileSync(webp).toString('base64')
    : 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', f)).toString('base64');
});

// Props (furniture, buildings) are one image each, keyed "props/<name>".
list('assets/props', '.png').forEach((f) => {
  const name = path.basename(f, '.png');
  const webp = path.join(ROOT, 'assets', 'props', name + '.webp');
  images['props/' + name] = fs.existsSync(webp)
    ? 'data:image/webp;base64,' + fs.readFileSync(webp).toString('base64')
    : 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'props', f)).toString('base64');
});

// Packs (tools/packs.js): out of the page, each its own file named by what is in it, so a phone never keeps old art.
const PACKS = require('./tools/packs');
const crypto = require('crypto');
const packs = {};
fs.rmSync(path.join(ROOT, 'dist', 'packs'), { recursive: true, force: true });
fs.mkdirSync(path.join(ROOT, 'dist', 'packs'), { recursive: true });
Object.keys(PACKS).forEach((pack) => {
  packs[pack] = {};
  PACKS[pack].forEach((key) => {
    if (!images[key]) throw new Error(`pack ${pack}: no image "${key}"`);
    if (!images[key].startsWith('data:image/webp')) throw new Error(`pack ${pack}: "${key}" needs a .webp copy`);
    const data = Buffer.from(images[key].split(',')[1], 'base64'), hash = crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);
    const file = key.replace('/', '-') + '.' + hash;
    fs.writeFileSync(path.join(ROOT, 'dist', 'packs', file + '.webp'), data);
    packs[pack][key] = { file: 'packs/' + file, bytes: data.length };
    delete images[key];
  });
});
// the Tailor Shop's looks (assets/looks): their sizes, for the Downloads page, and each one's file. They were on the CDN as
// looks/v1/<name>.webp; since the 30-degree pictures (12 Nov 2026) each is a pack file named by what is in it,
// packs/look-<name>.<hash> (app-assets/packs/, like every pack), so a phone holding the old picture fetches the new one.
const lookBytes = {}, lookFiles = {};
if (fs.existsSync(path.join(ROOT, 'assets', 'looks'))) list('assets/looks', '.webp').forEach((f) => {
  const name = path.basename(f, '.webp'), data = fs.readFileSync(path.join(ROOT, 'assets', 'looks', f));
  const file = 'look-' + name + '.' + crypto.createHash('sha256').update(data).digest('hex').slice(0, 8);
  fs.writeFileSync(path.join(ROOT, 'dist', 'packs', file + '.webp'), data);
  lookBytes[name] = data.length;
  lookFiles[name] = 'packs/' + file;
});

const maps = {};
list('maps', '.json').forEach((f) => {
  const map = JSON.parse(read(path.join('maps', f)));
  map.tilesets.forEach((ts) => {
    if (ts.source) throw new Error(`${f}: tileset "${ts.source}" is external. In Tiled, use "Embed Tileset" so it can be inlined.`);
    if (ts.name === 'props') return;
    if (!images[ts.name]) throw new Error(`${f}: tileset "${ts.name}" needs a matching assets/${ts.name}.png (and it cannot be in a pack)`);
  });
  maps[path.basename(f, '.json')] = map;
});

// Keep inline scripts from closing the <script> tag early.
const inline = (code) => code.replace(/<\/script/gi, '<\\/script');

const phaser = fs.readFileSync(require.resolve('phaser/dist/phaser-arcade-physics.min.js'), 'utf8');
// WebP copies stored below full size (world art), with the size the game scales each back up to
const sizesFile = path.join(ROOT, 'assets', 'sizes.json');
const sizes = fs.existsSync(sizesFile) ? JSON.parse(read('assets/sizes.json')) : {};
const packed = (k) => Object.keys(packs).some((p) => packs[p][k]);
Object.keys(sizes).forEach((k) => { if ((!images[k] || !images[k].startsWith('data:image/webp')) && !packed(k)) delete sizes[k]; });
const assets = 'window.Farm=window.Farm||{};window.Farm.ASSETS=' + JSON.stringify({ images, maps, sizes, packs, lookBytes, lookFiles }) + ';';
// The code without its comments and indentation (tools/strip-js.js: ~0.4 MB less page; each line where it was)
const { strip } = require('./tools/strip-js');
const game = list('src', '.js').map((f) => {
  const code = read(path.join('src', f)), out = strip(code);
  if (out.split('\n').length !== code.split('\n').length) throw new Error(`tools/strip-js.js moved a line of src/${f}`);
  try { new Function(out); } catch (e) { throw new Error(`src/${f} without its comments does not parse (${e.message}): tools/strip-js.js`); } // eslint-disable-line no-new-func
  return `// ---- src/${f}\n` + out;
}).join('\n');

// Characters outside ASCII in scripts become \uXXXX escapes (the same string at run time).
const ascii = (js) => js.replace(/[^\x00-\x7f]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Harvest Ville</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #1f3518; }
  body { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  #game { width: 100%; height: 100%; }
  canvas { display: block; }
</style>
</head>
<body>
<div id="game"></div>
<div id="boot" style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#f3e2b8;font:bold 20px 'Trebuchet MS',Verdana,sans-serif;pointer-events:none">Loading your farm&hellip;</div>
<script>${inline(ascii(phaser))}</script>
<script>${inline(ascii(assets))}</script>
<script>${inline(ascii(game))}</script>
</body>
</html>
`;

// The page is pure ASCII: the app holds it as a string (React Native, Java, Objective-C), where a single character
// outside ASCII makes the whole 14 MB string take 2 bytes per character.
const odd = html.search(/[^\x00-\x7f]/);
if (odd >= 0) throw new Error('dist/index.html has a non-ASCII character at ' + odd + ': ' + JSON.stringify(html.slice(odd - 30, odd + 10)));

// Many cheaper phones cannot load a sheet over 4096 px on a side: they draw it black, with no error.
const webpSize = (f) => {
  const d = fs.readFileSync(f), k = d.toString('latin1', 12, 16);
  if (k === 'VP8X') return [1 + d.readUIntLE(24, 3), 1 + d.readUIntLE(27, 3)];
  if (k === 'VP8 ') return [d.readUInt16LE(26) & 0x3fff, d.readUInt16LE(28) & 0x3fff];
  const b = d.readUInt32LE(21);
  return [(b & 0x3fff) + 1, ((b >>> 14) & 0x3fff) + 1];
};
list('assets', '.webp').forEach((f) => {
  const [w, h] = webpSize(path.join(ROOT, 'assets', f));
  if (Math.max(w, h) > 4096) throw new Error(`assets/${f} is ${w}x${h}: phones with a 4096 limit draw it black. Run node tools/art/squeeze.js.`);
});
// Android's WebView shows a blank screen, with no error, for a page of 20 MiB or more (the app adds the save to it).
// Over this limit: node tools/art/squeeze.js, or smaller art.
const PAGE_LIMIT = 19.5 * 1024 * 1024;
if (Buffer.byteLength(html) > PAGE_LIMIT) throw new Error(`dist/index.html is ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB: Android cannot open that. Keep it under ${PAGE_LIMIT / 1048576} MiB.`);
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), html);
console.log(`dist/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
Object.keys(packs).forEach((p) => console.log(`dist/packs: ${p}, ${Object.keys(packs[p]).length} files, ${(Object.values(packs[p]).reduce((a, x) => a + x.bytes, 0) / 1024).toFixed(0)} KB`));
