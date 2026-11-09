// The Town Raid's walking raiders (the boar, the labuyo) cut out of the Wild Lands sheet into a small sheet of their own,
// so the raid's countdown does not load the whole Wild Lands picture (2880 x 4556: about 52 MB once on the GPU; a
// low-end phone, 10 Nov 2026). Rows in C.RAID_WILD order, frames as the wild sheet's. node tools/art/raid-wild-cut.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..', '..'), OUT = path.join(ROOT, 'assets');
const ctx = { window: {} };
vm.createContext(ctx);
fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /^00-/.test(f)).sort().forEach((f) => vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', f), 'utf8'), ctx));
const C = ctx.window.Farm.Config, ROWS = ['boar', 'labuyo'], FW = 224, FH = 252, M = 8, G = 16;
const sizes = JSON.parse(fs.readFileSync(path.join(OUT, 'sizes.json'), 'utf8'));
(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const full = sizes.wild, src = 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, 'wild.png')).toString('base64');
  const r = await p.evaluate(async ([src, full, rows, FW, FH, M, G]) => {
    const im = await new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = s = src; var s; });
    const k = im.width / full[0], W = full[0], H = M * 2 + rows.length * FH + (rows.length - 1) * G;
    const o = document.createElement('canvas'); o.width = Math.round(W * k); o.height = Math.round(H * k);
    const g = o.getContext('2d');
    rows.forEach((row, i) => g.drawImage(im, 0, (M + row * (FH + G) - G / 2) * k, im.width, (FH + G) * k, 0, (M + i * (FH + G) - G / 2) * k, o.width, (FH + G) * k));
    return { png: o.toDataURL('image/png'), webp: o.toDataURL('image/webp', 0.8), W, H };
  }, [src, full, ROWS.map((k) => C.WILD.order.indexOf(k)), FW, FH, M, G]);
  fs.writeFileSync(path.join(OUT, 'raid_wild.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(OUT, 'raid_wild.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  sizes.raid_wild = [r.W, r.H];
  fs.writeFileSync(path.join(OUT, 'sizes.json'), JSON.stringify(sizes, null, 1) + '\n');
  console.log('assets/raid_wild', r.W + 'x' + r.H, (fs.statSync(path.join(OUT, 'raid_wild.webp')).size / 1024).toFixed(0) + ' KB');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
