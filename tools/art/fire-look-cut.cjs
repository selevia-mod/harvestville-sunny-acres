'use strict';
// The Fire look (art-src/LAIR-PROMPTS.md 14-19), cut into the farmer's own sheet layout exactly the way the 8 Tailor Shop
// looks were: ~/Documents/harvest-hat-art/looks-cutter/cut.cjs, whose helpers (lib.cjs) this borrows untouched. Each
// pose of the new picture is stood on the feet of the same pose in the farmer's EDIT TARGET (targets/ in
// looks-5-job.zip), at the farmer's own scale, so tools, the bow and the walk land where they always do. Writes
//   art-src/looks/cut/fire-<boy|girl>.png         15 frames of 256x384 (9 walk, then 6 tool swings), 1024 x 2048
//   art-src/looks/cut/fire-<boy|girl>-archer.png  9 frames of 288x384, 912 x 1200
// and prints any pose that had to be cut off at its frame edge. Then: node tools/art/tailor-import.js
// node tools/art/fire-look-cut.cjs <folder with targets/boy-walk.png ...>
const path = require('path');
const os = require('os');
const L = require(path.join(os.homedir(), 'Documents', 'harvest-hat-art', 'looks-cutter', 'lib.cjs'));
const { createCanvas, fs } = L;

const ROOT = path.join(__dirname, '..', '..');
const T = path.join(process.argv[2] || '.', 'targets');
const SRC = path.join(ROOT, 'art-src', 'looks');
const OUT = path.join(SRC, 'cut');
fs.mkdirSync(OUT, { recursive: true });

// The image model gave these see-through backgrounds instead of magenta, with the body at alpha 250-254: made solid,
// so the farmer is not faintly see-through over dark ground (the soft edge stays soft).
const load = async (f, W, H) => {
  const q = await L.load(f, W, H);
  for (let i = 3; i < q.d.length; i += 4) if (q.d[i] >= 240) q.d[i] = 255;
  return q;
};
// cut.cjs's put(), unchanged but for the loader
const put = async (sheetX, tgt, src, c, r, W, H, fw, first, cols, rep, tag) => {
  const a = await L.load(tgt, W, H), b = await load(src, W, H), ga = L.grid(L.blobs(a), c, r, W, H), gb = L.grid(L.blobs(b), c, r, W, H), n = c * r, s = fw === 288 ? 0.75 : L.scaleOf(ga, n);
  for (let k = 0; k < n; k++) {
    const p = ga[k], q = gb[k];
    if (!q) { rep.push(`${tag}${k}:EMPTY`); continue; }
    const fp = L.feetMid(a, p), fq = L.feetMid(b, q);
    // where the farmer's own picture lands in the frame, then the new picture moved onto the same feet
    const pw = (p.r - p.l + 1) * s, ox = fw === 288 ? fw / 2 - fp * s : (fw - pw) / 2 - p.l * s, oy = L.BASE - (p.b + 1) * s;
    const dx = ox + (fp - fq) * s, dy = oy + (p.b - q.b) * s, sx = dx + q.l * s, sy = dy + q.t * s, sw = (q.r - q.l + 1) * s, sh = (q.b - q.t + 1) * s;
    const over = [-sx, sx + sw - fw, -sy, sy + sh - L.FH].map((v) => Math.max(0, Math.round(v)));
    if (over.some(Boolean)) rep.push(`${tag}${k} cut L${over[0]} R${over[1]} T${over[2]} B${over[3]}`);
    const fr = first + k, fx = 8 + (fr % cols) * (fw + 16), fy = 8 + Math.floor(fr / cols) * 400;
    sheetX.save(); sheetX.beginPath(); sheetX.rect(fx, fy, fw, L.FH); sheetX.clip(); sheetX.imageSmoothingQuality = 'high';
    sheetX.drawImage(L.drawBlob(b, q), fx + sx, fy + sy, sw, sh); sheetX.restore();
  }
};

(async () => {
  for (const who of ['boy', 'girl']) {
    const rep = [], src = (k) => path.join(SRC, `fire-${who}-${k}.png`);
    const c = createCanvas(1024, 2048), x = c.getContext('2d');
    await put(x, `${T}/${who}-walk.png`, src('walk'), 3, 3, 1024, 1536, 256, 0, 3, rep, 'W');
    await put(x, `${T}/${who}-tools.png`, src('tools'), 3, 2, 1024, 1024, 256, 9, 3, rep, 'T');
    fs.writeFileSync(path.join(OUT, `fire-${who}.png`), c.toBuffer('image/png'));
    const c2 = createCanvas(912, 1200), x2 = c2.getContext('2d');
    await put(x2, `${T}/${who}-archer.png`, src('archer'), 3, 3, 1024, 1536, 288, 0, 3, rep, 'A');
    fs.writeFileSync(path.join(OUT, `fire-${who}-archer.png`), c2.toBuffer('image/png'));
    console.log(`fire-${who}`.padEnd(14), rep.length ? rep.join(', ') : 'nothing cut off');
  }
})().catch((e) => { console.error(e); process.exit(1); });
