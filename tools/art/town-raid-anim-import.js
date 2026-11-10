// The Town Raid attackers' animation sheets (owner's art, 10 Nov 2026; art-src/TOWN-RAID-ANIM-PROMPTS.md):
// art-src/town-raid-anim/giant_boar-side.png (facing left), -front.png (toward you), -back.png (away), spark.png,
// typhoon_debris.png, each 4 x 4. -> assets/ranim_tboar.* : 4 columns x 12 rows of FR x FR frames (side rows 0-3, front
// 4-7, back 8-11; in each: stampede run, trampling a crop, hit, running away scared); assets/ranim_tspark.* and
// ranim_tdebris.* : 4 x 4 (spark: float, burn, doused, flee; debris: branch, stone, roof piece, cleared). Every frame at
// one scale, keeping where the artist put it in its cell. The crows use the raiders' crow (ranim_crow).
// Prints each sheet's first-frame width (C.TOWN_ANIM, 19zzzz-raid.js). node tools/art/town-raid-anim-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), ART = path.join(ROOT, 'art-src', 'town-raid-anim'), OUT = path.join(ROOT, 'assets');
// (the boar's front and back are drawn as wide as its side is long: shrunk to about 0.62 of the side's length, as wide as
// the raiders' own front views are, so it doesn't grow when it turns toward you)
const SHEETS = { tboar: ['giant_boar-side', 'giant_boar-front', 'giant_boar-back'], tspark: ['spark'], tdebris: ['typhoon_debris'] }, FR = 200;
const SCALE = { 'giant_boar-front': 0.64, 'giant_boar-back': 0.74 };
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const widths = {};
  for (const k of Object.keys(SHEETS)) {
    const files = SHEETS[k].map((f) => path.join(ART, f + '.png'));
    if (!files.every((f) => fs.existsSync(f))) { console.log('skip', k); continue; }
    const r = await p.evaluate(async ([srcs, FR, sc]) => {
      const o = W.canvas(FR * 4, FR * 4 * srcs.length), g = o.getContext('2d');
      let w0 = 0;
      for (let d = 0; d < srcs.length; d++) {
        const im = await W.load(srcs[d]), cellH = im.height / 4, cl = W.cells(W.dehalo(W.cutout(im)), 4, 4, 0.02), k = FR / cellH * (sc[d] || 1);
        for (let i = 0; i < 16; i++) {
          const x = cl[i];
          if (!x) throw new Error('frame ' + d + '/' + i + ' is missing');
          const row = Math.floor(i / 4), col = i % 4, topIn = x.top - row * cellH, kk = Math.min(k, FR * 0.98 / x.w, FR * 0.98 / x.h);
          g.imageSmoothingQuality = 'high';
          g.drawImage(x.c, x.x, x.y, x.w, x.h, col * FR + FR / 2 - x.w * kk / 2, (d * 4 + row) * FR + Math.max(0, Math.min(FR - x.h * kk, topIn * k + (FR - (cellH * k)) )), x.w * kk, x.h * kk);
          if (d === 0 && i === 0) w0 = Math.round(x.w * kk);
        }
      }
      return Object.assign(W.out(o, 0.82), { w0 });
    }, [files.map(data), FR, SHEETS[k].map((f) => SCALE[f] || 1)]);
    fs.writeFileSync(path.join(OUT, 'ranim_' + k + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, 'ranim_' + k + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
    widths[k] = r.w0;
    console.log('assets/ranim_' + k, (fs.statSync(path.join(OUT, 'ranim_' + k + '.webp')).size / 1024).toFixed(0) + ' KB');
  }
  console.log('W0', JSON.stringify(widths));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
