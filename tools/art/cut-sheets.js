'use strict';
// Small sheets cut from big ones, so a list or a first frame does not have to decode and upload a whole sheet
// (performance review, 4 Nov 2026). build.js runs this whenever what they are cut from changes (assets/cut-sheets.json
// keeps a hash of it). Writes:
//   assets/furn_thumbs.png/.webp   each furniture style's armchair, 64 x 128 a frame, 4 px apart (Mira's style list)
//   assets/fh_standin.png/.webp    the farmhands' stand-ins: each one's 9 frames of 128 x 192 from the visitor they wear
//                                  in the people sheet, in C.FH_KEYS order (19zz-farmhands.js). Not made (and removed)
//                                  once their real pictures are in, assets/farmhands.webp (tools/art/farmhands-import.js)
// node tools/art/cut-sheets.js [--if-changed]
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'assets');
const SRC = path.join(ROOT, 'src');
const STAMP = path.join(OUT, 'cut-sheets.json');
const CONFIG = ['00-config.js', '00-home.js', '00-town2.js', '00-zzzzzzz-farmhands.js'];
const THUMB = { w: 64, h: 128, gap: 4 };

const furnSheets = () => fs.readdirSync(OUT).filter((f) => /^furn_\d+\.webp$/.test(f)).sort((a, b) => parseInt(a.slice(5), 10) - parseInt(b.slice(5), 10));
const inputs = () => furnSheets().concat(['people.webp', 'sizes.json']).map((f) => path.join(OUT, f)).concat(CONFIG.map((f) => path.join(SRC, f)), [__filename]);
const REAL_FH = () => fs.existsSync(path.join(OUT, 'farmhands.webp'));
const hashOf = () => {
  const h = crypto.createHash('sha256');
  h.update(REAL_FH() ? 'real farmhands' : 'farmhand stand-ins');
  inputs().forEach((f) => { h.update(path.basename(f)); h.update(fs.readFileSync(f)); });
  return h.digest('hex').slice(0, 16);
};

// --if-changed: nothing to do when the stamp matches (build.js)
if (process.argv.includes('--if-changed')) {
  const want = hashOf(), was = fs.existsSync(STAMP) ? JSON.parse(fs.readFileSync(STAMP, 'utf8')).hash : null;
  const there = ['furn_thumbs.webp'].concat(REAL_FH() ? [] : ['fh_standin.webp']).every((f) => fs.existsSync(path.join(OUT, f)));
  if (want === was && there) process.exit(0);
}

// the game's own content (the furniture types and styles, the farmhands and the visitors they wear)
const ctx = { window: {}, console, Math };
vm.createContext(ctx);
fs.readdirSync(SRC).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx));
const C = ctx.window.Farm.Config, H = C.HOME;
const sizes = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8'));
const data = (f) => 'data:image/webp;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64');

(async () => {
  const { chromium } = require('playwright');
  const b = await chromium.launch(), p = await b.newPage();
  const save = (name, r) => {
    fs.writeFileSync(path.join(OUT, name + '.png'), Buffer.from(r.png.split(',')[1], 'base64'));
    fs.writeFileSync(path.join(OUT, name + '.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
    console.log(('assets/' + name).padEnd(24), (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
  };

  // ---------- the armchair of each style (19d-home.js: CELL 384, U 128, GAP 16, 4 a row, standing on its cell's floor) ----------
  const t = H.typeIndex.armchair, type = H.types[t], CELL = 384, U = 128, GAP = 16;
  const cut = { x: 8 + (t % 4) * (CELL + GAP), y: 8 + Math.floor(t / 4) * (CELL + GAP) + CELL - type.h * U, w: type.w * U, h: type.h * U };
  const sheets = furnSheets().map((f) => ({ src: data(f), full: sizes[f.slice(0, -5)] || null }));
  if (sheets.length !== H.styles.length) throw new Error('furn_thumbs: ' + sheets.length + ' furn_*.webp sheets for ' + H.styles.length + ' styles');
  const thumbs = await p.evaluate(async ([sheets, cut, TH]) => {
    const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = s; });
    const c = document.createElement('canvas');
    c.width = sheets.length * (TH.w + TH.gap) - TH.gap;
    c.height = TH.h;
    const g = c.getContext('2d');
    g.imageSmoothingQuality = 'high';
    for (let i = 0; i < sheets.length; i++) {
      const im = await load(sheets[i].src), k = sheets[i].full ? im.width / sheets[i].full[0] : 1; // (stored at half size)
      const s = Math.min(TH.w / cut.w, TH.h / cut.h), w = cut.w * s, h = cut.h * s;
      g.drawImage(im, cut.x * k, cut.y * k, cut.w * k, cut.h * k, i * (TH.w + TH.gap) + (TH.w - w) / 2, TH.h - h, w, h);
    }
    return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.86) };
  }, [sheets, cut, THUMB]);
  save('furn_thumbs', thumbs);

  // ---------- the farmhands' stand-ins (as 19zz-farmhands.js cut them at runtime before) ----------
  // (none once the real sheet is there: the page would carry a sheet nobody sees)
  if (REAL_FH()) {
    ['png', 'webp'].forEach((ext) => fs.rmSync(path.join(OUT, 'fh_standin.' + ext), { force: true }));
    await b.close();
    fs.writeFileSync(STAMP, JSON.stringify({ hash: hashOf(), note: 'tools/art/cut-sheets.js: what furn_thumbs and fh_standin were cut from' }, null, 1) + '\n');
    return;
  }
  const n = C.VILLAGER_ORDER.length, faces = C.SHOPPERS.map((x) => x.key);
  const rows = C.FH_KEYS.map((key) => (n + Math.max(0, faces.indexOf(C.FARMHANDS[key].face))) * 9);
  const fh = await p.evaluate(async ([src, rows]) => {
    const load = (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = s; });
    const im = await load(src), cols = Math.floor((im.width + 8) / 144), c = document.createElement('canvas');
    c.width = 9 * 128;
    c.height = rows.length * 192;
    const g = c.getContext('2d');
    rows.forEach((base, r) => { for (let k = 0; k < 9; k++) { const f = base + k; g.drawImage(im, 8 + (f % cols) * 144, 8 + Math.floor(f / cols) * 208, 128, 192, k * 128, r * 192, 128, 192); } });
    return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.72) };
  }, [data('people.webp'), rows]);
  save('fh_standin', fh);
  await b.close();
  fs.writeFileSync(STAMP, JSON.stringify({ hash: hashOf(), note: 'tools/art/cut-sheets.js: what furn_thumbs and fh_standin were cut from' }, null, 1) + '\n');
})().catch((e) => { console.error(e); process.exit(1); });
