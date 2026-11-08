// Turning furniture (owner, 8 Nov 2026: "Furniture should be turned not just flip"; prompts
// art-src/FURNITURE-TURN-PROMPTS.md): art-src/furniture/<style>_turn.png, a 4 x 3 grid per style (side and back of the
// bed, double bed, chair, armchair, sofa, table), cut into assets/furnturn_<v>.png / .webp: 12 cells of 256 x 256, each
// piece fitted in its cell and standing on its bottom edge, in the prompt's order. Classic's (furnturn_0) is in the page;
// the other styles' go in the Furniture styles pack (tools/packs.js). node tools/art/furn-turn-import.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const H = ctx.window.Farm.Config.HOME;
const data = (f) => 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
const save = (f, url) => fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64'));
const CELL = 256;
// each cell's box: the piece's footprint shape (as L.furnTurnBox in 01-logicZZZZZZZZZZ-furn-turn.js)
const TURNS = { bed: 0, double_bed: 1, chair: 2, armchair: 3, sofa: 4, table: 5 };
const BOXES = [];
Object.keys(TURNS).forEach((k) => {
  const type = H.types[H.typeIndex[k]], w = type.w, h = type.h;
  const box = { w: w >= h ? CELL : Math.round(CELL * w / h), h: h >= w ? CELL : Math.round(CELL * h / w) };
  BOXES[TURNS[k] * 2] = box;
  BOXES[TURNS[k] * 2 + 1] = box;
});

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const done = [];
  for (let v = 0; v < H.styles.length; v++) {
    const src = path.join(ROOT, 'art-src', 'furniture', H.styles[v].key + '_turn.png');
    if (!fs.existsSync(src)) continue;
    const r = await p.evaluate(async ([s, CELL, boxes]) => {
      const cl = W.cells(W.dehalo(W.cutout(await W.load(s))), 4, 3, 0.02), o = W.canvas(4 * CELL, 3 * CELL), g = o.getContext('2d');
      for (let i = 0; i < 12; i++) {
        const x = cl[i], b = boxes[i];
        if (!x) throw new Error('piece ' + (i + 1) + ' is missing');
        // (in its footprint's shape, standing on the bottom edge, as the game's frames are: L.furnTurnBox)
        const k = Math.min((b.w - 6) / x.w, (b.h - 4) / x.h);
        W.draw(g, x.c, x, k, (i % 4) * CELL + CELL / 2, Math.floor(i / 4) * CELL + CELL - 2);
      }
      return W.out(o, 0.85);
    }, [data(src), CELL, BOXES]);
    save(path.join(ROOT, 'assets', 'furnturn_' + v + '.png'), r.png);
    save(path.join(ROOT, 'assets', 'furnturn_' + v + '.webp'), r.webp);
    done.push(H.styles[v].key + ' ' + Math.round(Buffer.from(r.webp.split(',')[1], 'base64').length / 1024) + ' KB');
  }
  await b.close();
  console.log('turned furniture:', done.join(', '));
})().catch((e) => { console.error(e); process.exit(1); });
