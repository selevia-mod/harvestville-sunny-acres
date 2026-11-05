'use strict';
// Central Park (owner, 6 Nov 2026): the Hall of Fame, the park's one building. There is no painted picture for it yet, so
// this is a stand-in made from the Town Hall's own picture (assets/props/mayor.png: the same columns and double door),
// with the blue roof turned a deep museum red and its window glass lit warm, so it reads as a different building and
// matches the town's art. A real painting can replace assets/props/hall_of_fame.* later, at the same 6 x 5 tiles.
// Writes assets/props/hall_of_fame.png (for Tiled) and .webp (in the page). node tools/art/park-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'assets', 'props', 'mayor.png');
const OUT = path.join(ROOT, 'assets', 'props', 'hall_of_fame');

(async () => {
  const b = await chromium.launch(), p = await b.newPage();
  const r = await p.evaluate(async (src) => {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad image')); i.src = src; });
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
    for (let i = 0; i < px.length; i += 4) {
      if (!px[i + 3]) continue;
      const r0 = px[i] / 255, g0 = px[i + 1] / 255, b0 = px[i + 2] / 255;
      const mx = Math.max(r0, g0, b0), mn = Math.min(r0, g0, b0), l = (mx + mn) / 2, sat = mx - mn;
      // only the blues: the roof tiles and the window glass (the cream walls, the columns and the door stay)
      if (!(b0 === mx && sat > 0.12 && b0 > r0 + 0.08)) continue;
      // the window glass: every blue below the eaves, and the two dormers' panes in the roof
      const x = (i / 4) % c.width, y = Math.floor(i / 4 / c.width);
      const glass = y >= 330 || (y >= 195 && y <= 258 && ((x >= 108 && x <= 178) || (x >= 590 && x <= 662)));
      if (glass) { // warm lamplight, like the library's windows
        const k = Math.min(1, 0.35 + l * 0.9);
        px[i] = Math.round(255 * Math.min(1, 0.62 + k * 0.38));
        px[i + 1] = Math.round(255 * (0.42 + k * 0.4));
        px[i + 2] = Math.round(255 * (0.12 + k * 0.22));
      } else { // the roof: royal blue to a deep red, keeping each tile's light and shade
        const k = Math.min(1, l * 1.25);
        px[i] = Math.round(255 * Math.min(1, 0.22 + k * 0.78));
        px[i + 1] = Math.round(255 * (0.05 + k * 0.16));
        px[i + 2] = Math.round(255 * (0.07 + k * 0.17));
      }
    }
    g.putImageData(d, 0, 0);
    // a gold star in the pediment: the hall of the town's stars
    const star = (cx, cy, R) => {
      g.beginPath();
      for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? R * 0.45 : R; g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a)); }
      g.closePath();
    };
    star(384, 226, 30);
    const gr = g.createLinearGradient(0, 196, 0, 256);
    gr.addColorStop(0, '#fff1a0');
    gr.addColorStop(1, '#e0a020');
    g.fillStyle = gr;
    g.fill();
    g.lineWidth = 4;
    g.strokeStyle = '#8a5a10';
    g.stroke();
    return { png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', 0.82) };
  }, 'data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'));
  fs.writeFileSync(OUT + '.png', Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(OUT + '.webp', Buffer.from(r.webp.split(',')[1], 'base64'));
  console.log('assets/props/hall_of_fame', (Buffer.from(r.webp.split(',')[1], 'base64').length / 1024).toFixed(0) + ' KB webp');
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
