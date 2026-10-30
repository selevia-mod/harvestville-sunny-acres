'use strict';
// The animals redrawn from the game's three-quarter angle (owner, 30 Oct 2026; prompts in art-src/ANIMALS-3Q-PROMPTS.md,
// pictures in art-src/wild-3q and art-src/farm-3q: 3 columns x 4 rows each) into two sheets, a row per animal, 12 frames
// of FW x FH in the pictures' own order:
//   assets/wild.png/.webp     C.WILD.order
//   assets/animals.png/.webp  the farm: FARM below (each one's frame0 in the game is its row x 12)
//   0-2 walking toward you, 3-5 walking away, 6-8 walking left (stand, step, step), 9-11 the last row, different for each
//   animal (`front` says which of those faces you; `lying` that it lies down).
// Each cell is copied as it is, scaled by K, so the artist's placement stays (no jitter between steps); every animal
// stands on its set's ground line in the pictures and that line lands on FEET.
// Prints each animal's walking-left width in the sheet: `px` in the game.
// assets/wildshade, assets/animalshade: the same frames again, holding only the shadow on the ground under that pose, so
// it stays down when the animal hops. In a three-quarter view the feet are not on one line (the far legs stand higher),
// so one oval never touches them all: each foot is found from the art (the low points of the outline), a small dark
// patch goes under each, and a soft shape joins them. Leaps and flights (frame 11 of what is not `ground`ed) touch
// nothing: a soft oval below; so does a body lying down. Shadows are stored at 1/SHADE of the size (they are all soft);
// assets/sizes.json holds the full sizes. The farm sheet is stored at `store` of its size: it is on the GPU from the
// start. SHOW=<folder> saves a picture of each set on grass.
// node tools/art/animals3q-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'art-src', 'wild-3q');
const OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config;

const FW = 224, FH = 252, M = 8, G = 16, K = 0.65, FEET = 233; // keep FW/FH/FEET in step with 10-boot.js, 13-animals.js and 19v-wild.js
const SHADE = 3;
const RARE = { whitedeer: ['wild_deer', 'white'], goldboar: ['wild_boar', 'gold'] }; // the rare ones are these, recoloured
// the farm's rows; barn animals' last row: eating, asleep, happy facing you
const BARN = { front: 11, lying: 10, ground: true };
const FARM = [['farm_chicken', BARN], ['farm_cow', BARN], ['farm_pig', BARN], ['farm_carabao', BARN],
  ['pet_dog', { front: 9, lying: 10, ground: true }], ['pet_cat', { front: 9, lying: 10, ground: true }], ['horse', { front: 9, ground: true }]];
const SETS = [
  { name: 'wild', shade: 'wildshade', dir: 'wild-3q', ground: 358, store: 0.75, rows: C.WILD.order.map((a) => [RARE[a] ? RARE[a][0] : 'wild_' + a, { front: 9, ground: !!C.WILD.animals[a].ground, tone: RARE[a] && RARE[a][1] }]) },
  { name: 'animals', shade: 'animalshade', dir: 'farm-3q', ground: 352, store: 0.75, rows: FARM },
];
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const sizes = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8'));
  for (const set of SETS) {
  const r = await p.evaluate(async ([list, FW, FH, M, G, K, GROUND, FEET, SHADE, store]) => {
    const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad image')); i.src = s; });
    const sheet = document.createElement('canvas');
    sheet.width = M * 2 + 12 * FW + 11 * G;
    sheet.height = M * 2 + list.length * FH + (list.length - 1) * G;
    const g = sheet.getContext('2d', { willReadFrequently: true }), px = [], counts = [];
    // white: pale fur, with the dark outline, eyes and hooves kept. gold: dark bronze to bright gold to pale yellow.
    const recolour = (d, tone) => {
      const mix = (a, b, t) => a + (b - a) * t;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const l = (0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2]) / 255;
        if (tone === 'white') {
          if (l < 0.24) continue;
          const v = mix(205, 255, Math.min(1, (l - 0.24) / 0.5));
          d[i] = v; d[i + 1] = v * 0.985; d[i + 2] = v * 0.95;
        } else {
          if (l < 0.1) continue;
          const c = l < 0.42 ? [mix(95, 232, l / 0.42), mix(58, 168, l / 0.42), mix(12, 36, l / 0.42)]
            : [mix(232, 255, (l - 0.42) / 0.58), mix(168, 244, (l - 0.42) / 0.58), mix(36, 176, (l - 0.42) / 0.58)];
          d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
        }
      }
    };
    g.imageSmoothingQuality = 'high';
    const shade = document.createElement('canvas');
    shade.width = sheet.width; shade.height = sheet.height;
    const sg = shade.getContext('2d');
    // a frame's box, with a look at its pixels
    const frameBox = (g, fx, fy) => {
      const d = g.getImageData(fx, fy, FW, FH).data, on = (x, y) => d[(y * FW + x) * 4 + 3] > 60;
      let x0 = FW, x1 = -1, y0 = FH, y1 = -1;
      for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) if (on(x, y)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return { x0, x1, y0, y1, on };
    };
    // the feet: low points of the outline that stand clear of what is next to them, in the bottom part
    const findFeet = (b) => {
      const bot = new Array(FW).fill(-1), h = b.y1 - b.y0 + 1, top = b.y1 - h * 0.42;
      for (let x = b.x0; x <= b.x1; x++) for (let y = b.y1; y >= b.y0; y--) if (b.on(x, y)) { bot[x] = y; break; }
      const peaks = [];
      for (let x = b.x0; x <= b.x1; x++) {
        if (bot[x] < 0) continue;
        let e = x;
        while (e < b.x1 && bot[e + 1] === bot[x]) e++;
        if ((bot[x - 1] === undefined || bot[x - 1] < bot[x]) && (bot[e + 1] === undefined || bot[e + 1] < bot[x])) {
          const y = bot[x];
          let l = y, r = y;
          for (let k = x - 1; k >= b.x0 && bot[k] <= y; k--) l = Math.min(l, bot[k] < 0 ? b.y0 : bot[k]);
          for (let k = e + 1; k <= b.x1 && bot[k] <= y; k++) r = Math.min(r, bot[k] < 0 ? b.y0 : bot[k]);
          const rise = y - Math.max(l, r);
          if (y >= top && rise >= 8) peaks.push({ x: (x + e) / 2, y, rise });
        }
        x = e;
      }
      // one foot, one point (claws and toes make several): the lower of any two close together
      peaks.sort((p, q) => q.y - p.y);
      const near = Math.max(14, (b.x1 - b.x0) * 0.11), feet = [];
      peaks.forEach((p) => { if (!feet.some((f) => Math.abs(f.x - p.x) < near && Math.abs(f.y - p.y) < 22)) feet.push(p); });
      feet.forEach((f) => { // how wide it is, just above the ground
        let l = f.x, r = f.x;
        while (bot[Math.floor(l) - 1] >= f.y - 7) l--;
        while (bot[Math.ceil(r) + 1] >= f.y - 7) r++;
        f.x = (l + r) / 2; f.w = r - l + 1;
      });
      // a pose where the legs hide each other: the lowest point on each side of the body
      if (feet.length < 2) [[b.x0, (b.x0 + b.x1) / 2], [(b.x0 + b.x1) / 2, b.x1]].forEach(([a, z]) => {
        let at = -1;
        for (let x = Math.ceil(a); x <= z; x++) if (bot[x] >= 0 && (at < 0 || bot[x] > bot[at])) at = x;
        if (at >= 0 && bot[at] >= b.y1 - h * 0.55 && !feet.some((f) => Math.abs(f.x - at) < near)) feet.push({ x: at, y: bot[at], w: 18 });
      });
      return feet.slice(0, 4);
    };
    const hull = (pts) => {
      const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y), cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const side = (list) => { const h = []; list.forEach((q) => { while (h.length > 1 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop(); h.push(q); }); h.pop(); return h; };
      return side(p).concat(side(p.slice().reverse()));
    };
    const drawShade = (sg, fx, fy, i, b, feet, opt) => {
      sg.save();
      sg.beginPath(); sg.rect(fx, fy, FW, FH); sg.clip();
      sg.translate(fx, fy);
      const blob = (x, y, rx, ry, a, blur) => { sg.filter = 'blur(' + blur + 'px)'; sg.fillStyle = 'rgba(0,0,0,' + a + ')'; sg.beginPath(); sg.ellipse(x, y, rx, ry, 0, 0, 7); sg.fill(); };
      if (i === opt.lying) {
        const w = b.x1 - b.x0 + 1;
        blob((b.x0 + b.x1) / 2 + 2, b.y1 - 12, w * 0.5, w * 0.17, 0.5, 4);
      } else if ((i === 11 && !opt.ground) || feet.length < 2) {
        const w = b.x1 - b.x0 + 1, mid = (b.x0 + b.x1) / 2;
        const air = i === 11 && !opt.ground;
        blob(mid + 2, air || !feet.length ? FEET - 12 : feet[0].y - 6, w * 0.36, w * 0.13, 0.46, air ? 6 : 5);
        if (!air) feet.forEach((f) => { const rx = Math.min(20, Math.max(7, f.w * 0.66)); blob(f.x + 1, f.y - 1, rx, rx * 0.45, 0.55, 1.5); });
      } else {
        const span = Math.max(...feet.map((f) => f.x)) - Math.min(...feet.map((f) => f.x)), up = Math.min(...feet.map((f) => f.y));
        const pts = feet.map((f) => ({ x: f.x, y: f.y }));
        // walking toward you or away, the body lies back from the feet: the shadow goes under it too
        if (i < 6 || i === opt.front) pts.push({ x: Math.min(...feet.map((f) => f.x)), y: up - span * 0.5 - 14 }, { x: Math.max(...feet.map((f) => f.x)), y: up - span * 0.5 - 14 });
        const h = hull(pts), wide = 12 + span * 0.1;
        sg.filter = 'blur(5px)';
        sg.fillStyle = sg.strokeStyle = 'rgba(0,0,0,0.4)';
        sg.lineWidth = wide; sg.lineJoin = 'round';
        sg.beginPath();
        h.forEach((q, k) => (k ? sg.lineTo(q.x + 2, q.y - 1) : sg.moveTo(q.x + 2, q.y - 1)));
        sg.closePath();
        sg.fill(); sg.stroke();
        feet.forEach((f) => { const rx = Math.min(20, Math.max(7, f.w * 0.66)); blob(f.x + 1, f.y - 1, rx, rx * 0.45, 0.55, 1.5); });
      }
      sg.restore();
    };
    for (let row = 0; row < list.length; row++) {
      const im = await load(list[row].src), cw = im.width / 3, ch = im.height / 4, opt = list[row];
      for (let i = 0; i < 12; i++) {
        const sx = (i % 3) * cw, sy = Math.floor(i / 3) * ch, x = M + i * (FW + G), y = M + row * (FH + G);
        g.save();
        g.beginPath(); g.rect(x, y, FW, FH); g.clip();
        g.drawImage(im, sx, sy, cw, ch, x + FW / 2 - cw * K / 2, y + FEET - GROUND * K, cw * K, ch * K);
        g.restore();
        if (opt.tone) {
          const px = g.getImageData(x, y, FW, FH);
          recolour(px.data, opt.tone);
          g.putImageData(px, x, y);
        }
      }
      for (let i = 0; i < 12; i++) {
        const box = frameBox(g, M + i * (FW + G), M + row * (FH + G));
        if (i === 6) px.push(box.x1 - box.x0 + 1);
        const fr = { x: M + i * (FW + G), y: M + row * (FH + G) };
        drawShade(sg, fr.x, fr.y, i, box, findFeet(box), opt);
        counts.push(i === 11 && !opt.ground ? '-' : findFeet(box).length);
      }
      counts.push('|');
    }
    // the shadows, stored small
    const small = document.createElement('canvas');
    small.width = Math.round(sheet.width / SHADE); small.height = Math.round(sheet.height / SHADE);
    const smg = small.getContext('2d');
    smg.imageSmoothingQuality = 'high';
    smg.drawImage(shade, 0, 0, small.width, small.height);
    // the picture to look at: on grass, shadow and animal together
    const show = document.createElement('canvas');
    show.width = sheet.width; show.height = sheet.height;
    const shg = show.getContext('2d');
    shg.fillStyle = '#8fa63f'; shg.fillRect(0, 0, show.width, show.height);
    shg.drawImage(small, 0, 0, show.width, show.height); shg.drawImage(sheet, 0, 0);
    let stored = sheet;
    if (store < 1) {
      stored = document.createElement('canvas');
      stored.width = Math.round(sheet.width * store); stored.height = Math.round(sheet.height * store);
      const stg = stored.getContext('2d');
      stg.imageSmoothingQuality = 'high';
      stg.drawImage(sheet, 0, 0, stored.width, stored.height);
    }
    return { png: stored.toDataURL('image/png'), webp: stored.toDataURL('image/webp', 0.8), shadePng: small.toDataURL('image/png'), shadeWebp: small.toDataURL('image/webp', 0.7),
      show: show.toDataURL('image/png'), px, counts: counts.join(' '), w: sheet.width, h: sheet.height };
  }, [set.rows.map(([f, o]) => Object.assign({ src: data(path.join(ROOT, 'art-src', set.dir, f + '.png')) }, o)), FW, FH, M, G, K, set.ground, FEET, SHADE, set.store]);
  const put = (name, url) => { const buf = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(path.join(OUT, name), buf); return (buf.length / 1024).toFixed(0) + ' KB'; };
  put(set.name + '.png', r.png);
  console.log('assets/' + set.name, r.w + 'x' + r.h, put(set.name + '.webp', r.webp));
  set.rows.forEach((x, i) => console.log('  ' + x[0].padEnd(14), 'px', r.px[i]));
  put(set.shade + '.png', r.shadePng);
  console.log('assets/' + set.shade, put(set.shade + '.webp', r.shadeWebp), '; feet found:', r.counts);
  sizes[set.shade] = [r.w, r.h];
  if (set.store < 1) sizes[set.name] = [r.w, r.h];
  // ('wild' and 'animals': the game takes the size from here)
  if (process.env.SHOW) fs.writeFileSync(path.join(process.env.SHOW, set.name + '.png'), Buffer.from(r.show.split(',')[1], 'base64'));
  }
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
