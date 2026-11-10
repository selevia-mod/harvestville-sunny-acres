'use strict';
// A stand-in for the owner's rig parts sheet (art-src/rig/boy-parts.png, art-src/RIG-PROTOTYPE-PROMPT: 4 x 4 cells of 384),
// so the rig can be built and tried before it comes: the head, body and legs cut from the farmer boy's own standing frames
// (assets/player.png: facing you, away, left), the arms rubbed off the body, and the arm pieces drawn. Same layout and the
// same rules as the owner's (each part on its own, the joints at the top, round ends), so tools/art/rig-import.js reads
// either. Writes art-src/rig/boy-parts-standin.png.
// node tools/art/rig-standin.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'art-src', 'rig');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch(), p = await b.newPage();
  const src = 'data:image/png;base64,' + fs.readFileSync(path.join(ROOT, 'assets', 'player.png')).toString('base64');
  const url = await p.evaluate(async (src) => {
    const im = new Image(); im.src = src; await im.decode();
    const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
    const FW = 256, FH = 384, K = 1.5; // (the parts at 1.5 times the frame, about the owner's cell size)
    const frame = (k) => { const c = canvas(FW, FH); c.getContext('2d').drawImage(im, 8 + (k % 3) * (FW + 16), 8 + Math.floor(k / 3) * (FH + 16), FW, FH, 0, 0, FW, FH); return c; };
    // a band of a frame (y0..y1), with `keep(x, y, rgba)` saying which pixels stay
    const band = (c, y0, y1, keep) => {
      const o = canvas(FW, y1 - y0), g = o.getContext('2d');
      g.drawImage(c, 0, y0, FW, y1 - y0, 0, 0, FW, y1 - y0);
      const d = g.getImageData(0, 0, FW, y1 - y0), q = d.data;
      for (let y = 0; y < y1 - y0; y++) for (let x = 0; x < FW; x++) { const i = (y * FW + x) * 4; if (q[i + 3] && keep && !keep(x, y + y0, q[i], q[i + 1], q[i + 2])) q[i + 3] = 0; }
      g.putImageData(d, 0, 0);
      return o;
    };
    const skin = (r, g, b) => r > 200 && g > 120 && g < 200 && b > 80 && b < 170 && r - b > 50;
    const front = frame(0), back = frame(3), side = frame(6);
    const parts = [
      band(front, 0, 186), band(back, 0, 182), band(side, 0, 182), band(side, 0, 182),
      // the body: from the collar to the hips; the hanging arms rubbed off (outside the overalls, below the sleeves)
      band(front, 178, 302, (x, y) => y < 240 || (x > 80 && x < 176)),
      band(back, 174, 302, (x, y) => y < 240 || (x > 80 && x < 176)),
      band(side, 174, 302, (x, y, r, g, bl) => !(y > 236 && (skin(r, g, bl) || x > 186))),
      null,
      band(front, 294, 384, (x, y) => y > 312 || (x > 76 && x < 180)),
      band(back, 294, 384, (x, y) => y > 312 || (x > 76 && x < 180)),
      band(side, 294, 384, (x, y, r, g, bl) => !(y < 312 && skin(r, g, bl))),
      null,
    ];
    // the arm pieces, drawn in the farmer's colours, hanging down, the joint at the top
    const OUTL = '#3b2312', SKIN = '#f3b98a', SKIN2 = '#e09a6c', SHIRT = '#f6cd2c';
    const piece = (w, h, fn) => { const c = canvas(w, h), g = c.getContext('2d'); g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = OUTL; fn(g); return c; };
    const pill = (g, x, y, w, h, fill) => { g.beginPath(); g.moveTo(x + w / 2, y); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h - w / 2); g.arc(x + w / 2, y + h - w / 2, w / 2, 0, Math.PI); g.closePath(); g.fillStyle = fill; g.fill(); g.stroke(); };
    parts.push(
      // (as long as the farmer's own: shoulder to elbow about 45 of the frame's pixels, elbow to wrist about 36)
      piece(44, 80, (g) => { pill(g, 6, 20, 32, 58, SKIN); g.beginPath(); g.moveTo(3, 22); g.arc(22, 22, 19, Math.PI, 0); g.lineTo(41, 40); g.quadraticCurveTo(22, 47, 3, 40); g.closePath(); g.fillStyle = SHIRT; g.fill(); g.stroke(); }),
      piece(34, 66, (g) => { pill(g, 4, 2, 26, 62, SKIN); g.beginPath(); g.moveTo(10, 36); g.lineTo(10, 48); g.strokeStyle = SKIN2; g.lineWidth = 2; g.stroke(); }),
      piece(40, 44, (g) => { g.beginPath(); g.ellipse(20, 22, 15, 18, 0, 0, Math.PI * 2); g.fillStyle = SKIN; g.fill(); g.stroke(); [10, 17, 24, 31].forEach((x) => { g.beginPath(); g.moveTo(x, 30); g.lineTo(x, 40); g.lineWidth = 2; g.stroke(); }); }),
      // the gripping hand: a fist round an empty gap (see-through, for the weapon)
      piece(44, 50, (g) => { g.beginPath(); g.ellipse(22, 27, 19, 20, 0, 0, Math.PI * 2); g.fillStyle = SKIN; g.fill(); g.lineWidth = 3; g.stroke(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.ellipse(22, 30, 7, 8, 0, 0, Math.PI * 2); g.fill(); g.globalCompositeOperation = 'source-over'; g.beginPath(); g.ellipse(22, 30, 7, 8, 0, 0, Math.PI * 2); g.lineWidth = 2; g.stroke(); })
    );
    const sheet = canvas(1536, 1536), sg = sheet.getContext('2d');
    sg.imageSmoothingQuality = 'high';
    parts.forEach((c, i) => {
      if (!c) return;
      const w = c.width * K, h = c.height * K;
      sg.drawImage(c, (i % 4) * 384 + (384 - w) / 2, Math.floor(i / 4) * 384 + (384 - h) / 2, w, h);
    });
    return sheet.toDataURL('image/png');
  }, src);
  fs.writeFileSync(path.join(OUT, 'boy-parts-standin.png'), Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
  console.log('wrote art-src/rig/boy-parts-standin.png');
})().catch((e) => { console.error(e); process.exit(1); });
