// Riding + Raid battle v2 (owner, 10 Nov 2026; prompts art-src/RAID-BATTLE-V2-PROMPTS.md):
//   art-src/battle2/raid_moves_a.png + raid_moves_b.png (4 x 4 each: run, attack, run off with loot, knocked out; one
//     raider a row) -> assets/raid_moves.* : 4 frames a row, a row a raider in C.FRAID.raiderOrder, MW x MH a frame,
//     standing on the line MH * 0.9; each row at one scale (its poses keep their sizes)
//   art-src/battle2/battle_fx.png (4 x 3) -> assets/battle_fx.* : 12 frames of 160 x 160 in a row (C.BATTLE_FX order)
//   art-src/battle2/horse_ride.png (3 x 3) -> art-src/battle2/horse_ride_3x4.png (row 4 added) for
//     node tools/art/animals3q-import.js battle2
// node tools/art/battle2-import.js
// ONLY=<outfit> node tools/art/battle2-import.js   (only that outfit's riding pictures: nothing else is made again)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..');
const ART = path.join(ROOT, 'art-src', 'battle2');
const OUT = path.join(ROOT, 'assets');
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => { const b = Buffer.from(url.split(',')[1], 'base64'); fs.writeFileSync(f, b); return (b.length / 1024).toFixed(0) + ' KB'; };
const ONLY = process.env.ONLY || '';
const MW = 220, MH = 176; // keep in step with C.RAID_MOVES (00-zzzzzzzzzzzzzzzzz-raids.js)

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const done = [];
  if (!ONLY && fs.existsSync(path.join(ART, 'raid_moves_a.png')) && fs.existsSync(path.join(ART, 'raid_moves_b.png'))) {
    const r = await p.evaluate(async ([a, bb, MW, MH]) => {
      const rows = [];
      for (const s of [a, bb]) {
        const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), 4, 4, 0.02);
        for (let r = 0; r < 4; r++) rows.push([0, 1, 2, 3].map((c) => { const x = cl[r * 4 + c]; if (!x) throw new Error('raider ' + (rows.length) + ' pose ' + c + ' is missing'); return x; }));
      }
      const o = W.canvas(4 * MW, rows.length * MH), g = o.getContext('2d'), runW = [];
      rows.forEach((poses, r) => {
        const k = Math.min(...poses.map((x) => Math.min(MW * 0.96 / x.w, MH * 0.88 / x.h)));
        runW.push(Math.round(poses[0].w * k));
        poses.forEach((x, c) => W.draw(g, x.c, x, k, c * MW + MW / 2, r * MH + MH * 0.92));
      });
      return Object.assign(W.out(o, 0.82), { runW });
    }, [data(path.join(ART, 'raid_moves_a.png')), data(path.join(ART, 'raid_moves_b.png')), MW, MH]);
    done.push('moves ' + save(path.join(OUT, 'raid_moves.webp'), r.webp) + ' (run widths ' + r.runW.join(',') + ')');
    save(path.join(OUT, 'raid_moves.png'), r.png);
  }
  if (!ONLY && fs.existsSync(path.join(ART, 'battle_fx.png'))) {
    const r = await p.evaluate(async (s) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), 4, 3, 0.02), S = 160, o = W.canvas(S * 12, S), g = o.getContext('2d');
      for (let i = 0; i < 12; i++) {
        const x = cl[i];
        if (!x) throw new Error('effect ' + i + ' is missing');
        W.draw(g, x.c, x, Math.min(S * 0.94 / x.w, S * 0.94 / x.h), S / 2 + i * S, null, S / 2);
      }
      return W.out(o, 0.82);
    }, data(path.join(ART, 'battle_fx.png')));
    done.push('fx ' + save(path.join(OUT, 'battle_fx.webp'), r.webp));
    save(path.join(OUT, 'battle_fx.png'), r.png);
  }
  if (!ONLY && fs.existsSync(path.join(ART, 'horse_ride.png'))) {
    const url = await p.evaluate(async (s) => {
      const im = await W.load(s), cw = im.width / 3, ch = im.height / 3, o = W.canvas(im.width, ch * 4), g = o.getContext('2d');
      g.drawImage(im, 0, 0);
      [[0, 0], [2, 0], [2, 1]].forEach(([r, c], k) => g.drawImage(im, c * cw, r * ch, cw, ch, k * cw, 3 * ch, cw, ch)); // standing (you), standing (side), a step
      return o.toDataURL('image/png');
    }, data(path.join(ART, 'horse_ride.png')));
    save(path.join(ART, 'horse_ride_3x4.png'), url);
    done.push('horse 3x4');
  }
  // The farmer ON the horse, drawn together (owner, 10 Nov 2026: cut pictures "so ugly"; art-src/RIDING-ON-HORSE-PROMPTS.md):
  // art-src/riding/<outfit>-<boy|girl>.png (3 x 3, as the saddled horse) -> art-src/riding/_3x4/<outfit>-<boy|girl>.png
  // (row 4 added, as the horse's) for node tools/art/animals3q-import.js battle2 -> assets/ride_<outfit>_<boy|girl>.*
  const RIDING = path.join(ROOT, 'art-src', 'riding'), PAD = path.join(RIDING, '_3x4');
  for (const f of fs.existsSync(RIDING) ? fs.readdirSync(RIDING).filter((x) => /^[a-z]+-(boy|girl)\.png$/.test(x) && (!ONLY || x.startsWith(ONLY + '-'))) : []) {
    fs.mkdirSync(PAD, { recursive: true });
    const url = await p.evaluate(async (s) => {
      const im = await W.load(s), cw = im.width / 3, ch = im.height / 3, o = W.canvas(im.width, ch * 4), g = o.getContext('2d');
      g.drawImage(im, 0, 0);
      [[0, 0], [2, 0], [2, 1]].forEach(([r, c], k) => g.drawImage(im, c * cw, r * ch, cw, ch, k * cw, 3 * ch, cw, ch));
      return o.toDataURL('image/png');
    }, data(path.join(RIDING, f)));
    save(path.join(PAD, f), url);
    done.push('riding ' + f.slice(0, -4));
  }
  await b.close();
  console.log('battle2 art:', done.join('; '));
})().catch((e) => { console.error(e); process.exit(1); });
