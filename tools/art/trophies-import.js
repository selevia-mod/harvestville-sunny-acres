'use strict';
// What the hunting game adds to the older sheets (owner, 30 Oct 2026), without redrawing them:
//   art-src/icons/white_antler.png, gold_tusk.png  the antler and tusk icons, recoloured, and painted into items.png/.webp
//   furn_0.png/.webp  the trophies (C.WILD.trophies), in the classic sheet's cells for their C.HOME.types index
// The owner's pictures are art-src/trophies/<type>.png (prompts: art-src/TROPHY-PROMPTS.md): stray specks are dropped,
// the picture is trimmed and fitted to its wall or floor space without stretching. A trophy with no picture yet is its
// icon on a wooden plaque. Run it again after npm run art, which redraws furn_0 and items.
// node tools/art/trophies-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets');
const ICONS = path.join(ROOT, 'art-src', 'icons');
const ART = path.join(ROOT, 'art-src', 'trophies');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const CELL = 384, U = 128, GAP = 16;
const ICON_OF = { trophy_antler: 'antler', trophy_tusk: 'tusk', wolf_rug: 'pelt_wolf', trophy_stag: 'white_antler', trophy_goldboar: 'gold_tusk',
  trophy_rhino: 'horn_rhino', bear_rug: 'fur_bear', tiger_rug: 'pelt_tiger', trophy_mammoth: 'tusk_mammoth' };

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: `
window.load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad image')); i.src = s; });
// the picture without its specks (anything far smaller than the biggest piece), cut to what is left
window.clean = (img) => {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(img, 0, 0);
  const w = c.width, h = c.height, px = g.getImageData(0, 0, w, h), d = px.data, lab = new Int32Array(w * h), sizes = [0];
  for (let k0 = 0; k0 < w * h; k0++) {
    if (lab[k0] || d[k0 * 4 + 3] < 24) continue;
    const id = sizes.length, q = [k0];
    lab[k0] = id;
    let n = 0;
    while (q.length) {
      const m = q.pop(), x = m % w;
      n++;
      [x > 0 ? m - 1 : -1, x < w - 1 ? m + 1 : -1, m - w, m + w].forEach((o) => { if (o >= 0 && o < w * h && !lab[o] && d[o * 4 + 3] >= 24) { lab[o] = id; q.push(o); } });
    }
    sizes.push(n);
  }
  const big = Math.max(...sizes);
  let x0 = w, x1 = 0, y0 = h, y1 = 0;
  for (let k = 0; k < w * h; k++) {
    const keep = lab[k] && sizes[lab[k]] >= big * 0.02;
    if (!keep) { d[k * 4 + 3] = lab[k] ? 0 : d[k * 4 + 3] < 24 ? 0 : d[k * 4 + 3]; continue; }
    const x = k % w, y = (k - x) / w;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  g.putImageData(px, 0, 0);
  return { c, x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};
window.tone = (img, kind) => {
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0);
  const px = g.getImageData(0, 0, c.width, c.height), d = px.data, mix = (a, b, t) => a + (b - a) * t;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
    if (kind === 'white') {
      if (l < 0.2) continue;
      const v = mix(205, 255, Math.min(1, (l - 0.2) / 0.5));
      d[i] = v; d[i + 1] = v * 0.985; d[i + 2] = v * 0.95;
    } else {
      if (l < 0.1) continue;
      const c0 = l < 0.42 ? [mix(95, 232, l / 0.42), mix(58, 168, l / 0.42), mix(12, 36, l / 0.42)] : [mix(232, 255, (l - 0.42) / 0.58), mix(168, 244, (l - 0.42) / 0.58), mix(36, 176, (l - 0.42) / 0.58)];
      d[i] = c0[0]; d[i + 1] = c0[1]; d[i + 2] = c0[2];
    }
  }
  g.putImageData(px, 0, 0);
  return c.toDataURL('image/png');
};` });
  // the two new icons
  const white = await p.evaluate(async (s) => tone(await load(s), 'white'), data(path.join(ICONS, 'antler.png')));
  const gold = await p.evaluate(async (s) => tone(await load(s), 'gold'), data(path.join(ICONS, 'tusk.png')));
  fs.writeFileSync(path.join(ICONS, 'white_antler.png'), Buffer.from(white.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ICONS, 'gold_tusk.png'), Buffer.from(gold.split(',')[1], 'base64'));
  const order = C.ICON_ORDER;
  const items = await p.evaluate(async ([old, list]) => {
    const im = await load(old), rows = Math.ceil(list.length / 8), sheet = document.createElement('canvas');
    sheet.width = 1152; sheet.height = rows * 144;
    const g = sheet.getContext('2d');
    g.drawImage(im, 0, 0);
    for (const [i, src] of list.map((x, i) => [i, x]).filter((x) => x[1])) {
      const ic = await load(src), x = 8 + (i % 8) * 144, y = 8 + Math.floor(i / 8) * 144;
      g.clearRect(x, y, 128, 128);
      g.drawImage(ic, x, y);
    }
    return { png: sheet.toDataURL('image/png'), webp: sheet.toDataURL('image/webp', 0.86) };
  }, [data(path.join(OUT, 'items.png')), order.map((n) => (n === 'white_antler' ? white : n === 'gold_tusk' ? gold : null))]);
  fs.writeFileSync(path.join(OUT, 'items.png'), Buffer.from(items.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'items.webp'), Buffer.from(items.webp.split(',')[1], 'base64'));

  // the trophies, into the classic furniture sheet (one row more than the others have)
  const list = C.WILD.trophies.map((t) => {
    const i = C.HOME.typeIndex[t.type], type = C.HOME.types[i], own = path.join(ART, t.type + '.png'), ic = ICON_OF[t.type];
    return { i, w: type.w * U, h: type.h * U, place: type.place, own: fs.existsSync(own) ? data(own) : null,
      icon: ic === 'white_antler' ? white : ic === 'gold_tusk' ? gold : data(path.join(ICONS, ic + '.png')) };
  });
  const rows = Math.ceil(C.HOME.types.length / 4), height = rows * (CELL + GAP);
  const r = await p.evaluate(async ([old, list, CELL, GAP, height]) => {
    const im = await load(old), sheet = document.createElement('canvas');
    sheet.width = im.width; sheet.height = height;
    const g = sheet.getContext('2d');
    g.imageSmoothingQuality = 'high';
    g.drawImage(im, 0, 0);
    for (const t of list) {
      const x = 8 + (t.i % 4) * (CELL + GAP), y = 8 + Math.floor(t.i / 4) * (CELL + GAP) + CELL - t.h;
      g.clearRect(x, y, t.w, t.h);
      if (t.own) { // as big as it goes without stretching, in the middle of its space
        const o = clean(await load(t.own)), k = Math.min((t.w - 6) / o.w, (t.h - 6) / o.h), dw = o.w * k, dh = o.h * k;
        g.drawImage(o.c, o.x, o.y, o.w, o.h, x + (t.w - dw) / 2, y + (t.h - dh) / 2, dw, dh);
        continue;
      }
      const ic = await load(t.icon);
      if (t.place === 'flat') { g.drawImage(ic, x + 8, y + 8, t.w - 16, t.h - 16); continue; }
      // a wooden plaque, the icon on it
      const m = 6, R = 26, X = x + m, Y = y + m, W = t.w - m * 2, H = t.h - m * 2;
      g.beginPath(); g.roundRect(X, Y, W, H, R);
      g.fillStyle = '#7a4a26'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#3d2412'; g.stroke();
      g.beginPath(); g.roundRect(X + 12, Y + 12, W - 24, H - 24, R - 10); g.lineWidth = 3; g.strokeStyle = '#a06a3a'; g.stroke();
      const s = H * 0.82;
      g.drawImage(ic, x + t.w / 2 - s / 2, y + t.h / 2 - s / 2, s, s);
    }
    const small = document.createElement('canvas');
    small.width = Math.round(sheet.width * 0.75); small.height = Math.round(sheet.height * 0.75);
    const sg = small.getContext('2d');
    sg.imageSmoothingQuality = 'high';
    sg.drawImage(sheet, 0, 0, small.width, small.height);
    return { png: sheet.toDataURL('image/png'), webp: small.toDataURL('image/webp', 0.86), w: sheet.width, h: sheet.height };
  }, [data(path.join(OUT, 'furn_0.png')), list, CELL, GAP, height]);
  fs.writeFileSync(path.join(OUT, 'furn_0.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'furn_0.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  const sizes = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8'));
  sizes.furn_0 = [r.w, r.h];
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  console.log('items + furn_0', r.w + 'x' + r.h);
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
