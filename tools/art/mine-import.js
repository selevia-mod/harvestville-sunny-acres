'use strict';
// Stand-in icons for the deeper Mine (owner, 2 Nov 2026): the Gold Ore and Gem icons recoloured, until the real pictures
// come (art-src/icons/<name>.png replaces one: this keeps a picture that is already there unless it was made here).
// Writes assets/items.png (8 columns) and assets/items.webp (16 columns, see squeeze.js). Icons keep their numbers.
// node tools/art/mine-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
// [icon, drawn from, dark, middle, light]
const ICONS = [
  ['crystal', 'ore_gold', '#5a2ea8', '#a878f0', '#efe2ff'], ['amethyst', 'gem', '#3c0f7a', '#b050e8', '#f4d8ff'],
  ['jade', 'ore_gold', '#0c5c3c', '#2fae78', '#c8f4dc'], ['emerald', 'gem', '#064a30', '#18c070', '#d4ffe6'],
  ['obsidian', 'ore_gold', '#08060e', '#34304a', '#a8a0c8'], ['ruby', 'gem', '#5c0612', '#e02438', '#ffd0c8'],
  ['moonstone', 'ore_gold', '#3a5a94', '#9cc0e8', '#f4fbff'], ['sapphire', 'gem', '#0c2a8c', '#2a78f0', '#d8f0ff'],
  ['starstone', 'ore_gold', '#a86a08', '#ffc838', '#fffbe0'], ['diamond', 'gem', '#5fa8c8', '#c4f0fa', '#ffffff'],
];
const FRESH = path.join(ROOT, 'art-src', 'mine-stand-ins.json');
const made = fs.existsSync(FRESH) ? JSON.parse(fs.readFileSync(FRESH, 'utf8')) : {};
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const rows = Math.ceil(C.ICON_ORDER.length / 8);
  const icons = ICONS.map(([name, from, a, m, l]) => {
    const file = path.join(ROOT, 'art-src', 'icons', name + '.png');
    return { name, frame: C.ICON[name], from: C.ICON[from], cols: [a, m, l], own: fs.existsSync(file) && !made[name] ? data(file) : null, recolourBase: from === 'gem' };
  });
  const r = await p.evaluate(async ([src, icons, rows, n]) => {
    const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = s; });
    const im = await load(src), canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const sheet = canvas(1152, rows * 144), g = sheet.getContext('2d', { willReadFrequently: true });
    g.drawImage(im, 0, 0);
    const hex = (c) => { const v = parseInt(c.slice(1), 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    const cell = (i) => [8 + (i % 8) * 144, 8 + Math.floor(i / 8) * 144];
    const out = {};
    for (const ic of icons) {
      const [x, y] = cell(ic.frame), [fx, fy] = cell(ic.from);
      g.clearRect(x - 8, y - 8, 144, 144);
      if (ic.own) { g.drawImage(await load(ic.own), x, y, 128, 128); continue; }
      const d = g.getImageData(fx, fy, 128, 128), q = d.data, c = ic.cols.map(hex);
      for (let i = 0; i < q.length; i += 4) {
        if (!q[i + 3]) continue;
        const max = Math.max(q[i], q[i + 1], q[i + 2]), min = Math.min(q[i], q[i + 1], q[i + 2]), sat = max ? (max - min) / max : 0, l = max / 255;
        if (!ic.recolourBase && sat < 0.28) continue; // the grey rock around the ore stays
        const t = Math.min(1, Math.pow(l, ic.recolourBase ? 1.5 : 1.2)), lo = t < 0.5 ? c[0] : c[1], hi = t < 0.5 ? c[1] : c[2], k = t < 0.5 ? t * 2 : t * 2 - 1;
        for (let j = 0; j < 3; j++) q[i + j] = lo[j] + (hi[j] - lo[j]) * k;
        if (sat < 0.12 && l > 0.9) { q[i] = q[i + 1] = q[i + 2] = 255; } // the glint stays white
      }
      g.putImageData(d, x, y);
      const one = canvas(128, 128);
      one.getContext('2d').putImageData(d, 0, 0);
      out[ic.name] = one.toDataURL('image/png');
    }
    const cols = 16, wide = canvas(8 * 2 + cols * 144 - 16, 8 * 2 + Math.ceil(n / cols) * 144 - 16), h = wide.getContext('2d');
    for (let i = 0; i < n; i++) { const [sx, sy] = cell(i); h.drawImage(sheet, sx, sy, 128, 128, 8 + (i % cols) * 144, 8 + Math.floor(i / cols) * 144, 128, 128); }
    return { png: sheet.toDataURL('image/png'), webp: wide.toDataURL('image/webp', 0.72), out };
  }, [data(path.join(OUT, 'items.png')), icons, rows, rows * 8]);
  fs.writeFileSync(path.join(OUT, 'items.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'items.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  Object.keys(r.out).forEach((n) => { fs.writeFileSync(path.join(ROOT, 'art-src', 'icons', n + '.png'), Buffer.from(r.out[n].split(',')[1], 'base64')); made[n] = 1; });
  fs.writeFileSync(FRESH, JSON.stringify(made));
  await b.close();
  console.log('items', rows, 'rows,', (fs.statSync(path.join(OUT, 'items.webp')).size / 1024).toFixed(0) + ' KB webp');
})().catch((e) => { console.error(e); process.exit(1); });
