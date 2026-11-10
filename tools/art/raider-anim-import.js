// The raiders' animation sheets (owner's art, 10 Nov 2026; art-src/RAIDER-ANIM-PROMPTS.md): art-src/raider-anim/<k>.png
// (side, facing left), <k>-front.png (toward you), <k>-back.png (away), each 4 x 4: run, attack, run with loot, then hurt
// / tumbling / knocked out / idle. -> assets/ranim_<k>.* : 4 columns x 12 rows of FR x FR frames (side rows 0-3, front
// 4-7, back 8-11), every frame at one scale, keeping where the artist put it in its cell (a leap stays a leap).
// Prints each raider's side-run width (C.RAID_ANIM, 19zz...-raid-battle-v2.js). node tools/art/raider-anim-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), ART = path.join(ROOT, 'art-src', 'raider-anim'), OUT = path.join(ROOT, 'assets');
const KINDS = ['goat', 'crow', 'cat', 'carabao', 'monkey', 'boar', 'rooster', 'bayawak'], FR = 200, GROUND = 0.9; // (the frames' feet line: setOrigin(0.5, 0.9))
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const widths = {};
  for (const k of KINDS) {
    const files = [k + '.png', k + '-front.png', k + '-back.png'].map((f) => path.join(ART, f));
    if (!files.every((f) => fs.existsSync(f))) { console.log('skip', k); continue; }
    const r = await p.evaluate(async ([srcs, FR, GROUND]) => {
      const o = W.canvas(FR * 4, FR * 12), g = o.getContext('2d');
      let runW = 0;
      for (let d = 0; d < 3; d++) {
        const im = await W.load(srcs[d]), cellH = im.height / 4, cl = W.cells(W.dehalo(W.cutout(im)), 4, 4, 0.02), k = FR / cellH;
        // (owner, 10 Nov 2026: "Why my carabao is flying?": the artist drew each direction's animal at its own height in its
        // cells, and the game stands every frame on one line, 0.9 of the frame. Each direction is moved, all 16 frames
        // together, so its run's lowest feet touch that line: a leap still rises from it.)
        const at = [];
        for (let i = 0; i < 16; i++) {
          const x = cl[i];
          if (!x) throw new Error('frame ' + d + '/' + i + ' is missing');
          const row = Math.floor(i / 4), col = i % 4, topIn = x.top - row * cellH, kk = Math.min(k, FR * 0.98 / x.w, FR * 0.98 / x.h);
          at.push({ x, row, col, kk, y: topIn * k });
        }
        const ground = Math.max(...at.slice(0, 3).map((a) => a.y + a.x.h * a.kk)), shift = Math.round(FR * GROUND) - ground;
        at.forEach(({ x, row, col, kk, y }) => {
          g.imageSmoothingQuality = 'high';
          g.drawImage(x.c, x.x, x.y, x.w, x.h, col * FR + FR / 2 - x.w * kk / 2, (d * 4 + row) * FR + Math.max(0, Math.min(FR - x.h * kk, y + shift)), x.w * kk, x.h * kk);
          if (d === 0 && row === 0 && col === 0) runW = Math.round(x.w * kk);
        });
      }
      return Object.assign(W.out(o, 0.82), { runW });
    }, [files.map(data), FR, GROUND]);
    fs.writeFileSync(path.join(OUT, 'ranim_' + k + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, 'ranim_' + k + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
    widths[k] = r.runW;
    console.log('assets/ranim_' + k, (fs.statSync(path.join(OUT, 'ranim_' + k + '.webp')).size / 1024).toFixed(0) + ' KB');
  }
  console.log('RUNW', JSON.stringify(widths));
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
