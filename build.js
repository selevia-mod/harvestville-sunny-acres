'use strict';
// Builds dist/index.html: one offline page with Phaser, the game code, the Tiled maps
// and every image inlined (images as data URLs). No network requests at runtime.
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const list = (dir, ext) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).sort();

const images = {};
list('assets', '.png').forEach((f) => {
  images[path.basename(f, '.png')] = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', f)).toString('base64');
});

const maps = {};
list('maps', '.json').forEach((f) => {
  const map = JSON.parse(read(path.join('maps', f)));
  map.tilesets.forEach((ts) => {
    if (ts.source) throw new Error(`${f}: tileset "${ts.source}" is external. In Tiled, use "Embed Tileset" so it can be inlined.`);
    if (!images[ts.name]) throw new Error(`${f}: tileset "${ts.name}" needs a matching assets/${ts.name}.png`);
  });
  maps[path.basename(f, '.json')] = map;
});

// Keep inline scripts from closing the <script> tag early.
const inline = (code) => code.replace(/<\/script/gi, '<\\/script');

const phaser = fs.readFileSync(require.resolve('phaser/dist/phaser-arcade-physics.min.js'), 'utf8');
const assets = 'window.Farm=window.Farm||{};window.Farm.ASSETS=' + JSON.stringify({ images, maps }) + ';';
const game = list('src', '.js').map((f) => `// ---- src/${f}\n` + read(path.join('src', f))).join('\n');

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Sunny Acres</title>
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #1f3518; }
  body { touch-action: none; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; -webkit-tap-highlight-color: transparent; }
  #game { width: 100%; height: 100%; }
  canvas { display: block; image-rendering: pixelated; }
</style>
</head>
<body>
<div id="game"></div>
<script>${inline(phaser)}</script>
<script>${inline(assets)}</script>
<script>${inline(game)}</script>
</body>
</html>
`;

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'dist', 'index.html'), html);
console.log(`dist/index.html written (${(html.length / 1024).toFixed(0)} KB)`);
