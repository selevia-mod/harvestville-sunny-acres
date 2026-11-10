'use strict';
// The farmer boy's rig parts (owner, 11 Nov 2026: "lets go to light"; the prompt ~/Downloads/RIG-PROTOTYPE-PROMPT.md):
// art-src/rig/boy-parts.png, 1536 x 1536, 4 x 4 cells of 384, one part a cell (transparent or flat magenta):
//   row 1 heads: front, back, left, left aiming (no neck)    row 2 body: front, back, left (the neck on, no arms)
//   row 3 legs: front, back, left                              row 4 upper arm, forearm, hand open, hand gripping
// Each part is cut and trimmed, and its joints are found from its shape: the centre of a rounded end (an arm's shoulder,
// elbow, wrist), the empty gap in the gripping hand, the neck and hips, the shoulders on the body. Out:
//   assets/rig_boy.png / .webp: the parts at 2/3 size, packed (tools/packs.js 'rig': a pack, not the page)
//   src/00-zzzzzzzzzzzzzzzzzzzz-rig-boy.js: C.RIG_BOY, each part's place in that picture and its joints (a few hundred bytes)
// Until the owner's sheet is here: RIG_SRC=art-src/rig/boy-parts-standin.png (tools/art/rig-standin.js makes it).
// It prints what it found; a part it cannot read is an error that says which cell and why.
// node tools/art/rig-import.js
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..', '..');
const SRC = process.env.RIG_SRC ? path.resolve(process.env.RIG_SRC) : path.join(ROOT, 'art-src', 'rig', 'boy-parts.png');
const NAMES = ['head_front', 'head_back', 'head_left', 'head_aim', 'body_front', 'body_back', 'body_left', null,
  'legs_front', 'legs_back', 'legs_left', null, 'arm_upper', 'arm_fore', 'hand_open', 'hand_grip'];
const OUT_SCALE = 2 / 3; // 384 cells -> 256

(async () => {
  if (!fs.existsSync(SRC)) throw new Error('no ' + path.relative(ROOT, SRC) + ' (the owner\'s parts sheet; RIG_SRC=art-src/rig/boy-parts-standin.png for the stand-in)');
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const r = await p.evaluate(async ([src, NAMES, S]) => {
    const im = await W.load(src);
    if (im.width !== im.height) throw new Error('the sheet should be square (1536 x 1536), it is ' + im.width + ' x ' + im.height);
    const cut = W.cutout(im), cell = im.width / 4, out = {}, report = [];
    const part = (i) => { // the cell's picture, trimmed: { c, w, h, a(x, y) alpha }
      const c = W.canvas(cell, cell), g = c.getContext('2d');
      g.drawImage(cut, (i % 4) * cell, Math.floor(i / 4) * cell, cell, cell, 0, 0, cell, cell);
      const d = g.getImageData(0, 0, cell, cell).data;
      let x0 = cell, y0 = cell, x1 = -1, y1 = -1;
      for (let y = 0; y < cell; y++) for (let x = 0; x < cell; x++) if (d[(y * cell + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return null;
      if (x0 < 2 || y0 < 2 || x1 > cell - 3 || y1 > cell - 3) throw new Error('cell ' + (i + 1) + ' touches its edge: each part needs empty space round it');
      const w = x1 - x0 + 1, h = y1 - y0 + 1, t = W.canvas(w, h);
      t.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
      const td = t.getContext('2d').getImageData(0, 0, w, h).data;
      return { c: t, w, h, a: (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : td[(y * w + x) * 4 + 3]) };
    };
    // the opaque span across row y: [left, right] (the outermost), or null
    const span = (q, y) => { y = Math.max(0, Math.min(q.h - 1, Math.round(y))); let l = -1, r = -1; for (let x = 0; x < q.w; x++) if (q.a(x, y) > 40) { if (l < 0) l = x; r = x; } return l < 0 ? null : [l, r]; };
    const mid = (s) => (s[0] + s[1]) / 2;
    // the centre of a rounded end, top or bottom: across the piece a little way in, half its width in from the end
    const end = (q, top) => {
      const y = top ? q.h * 0.15 : q.h * 0.85, s = span(q, y);
      const r = Math.min((s[1] - s[0]) / 2, q.h * 0.3);
      return [mid(s), top ? r : q.h - r];
    };
    // the gripping hand's empty gap: see-through pixels inside it (not reached from outside); their middle
    const gap = (q) => {
      const w = q.w, h = q.h, seen = new Uint8Array(w * h), st = [];
      for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
      for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
      while (st.length) {
        const k = st.pop();
        if (seen[k]) continue;
        const x = k % w, y = (k - x) / w;
        if (q.a(x, y) > 40) continue;
        seen[k] = 1;
        if (x > 0) st.push(k - 1); if (x < w - 1) st.push(k + 1); if (y > 0) st.push(k - w); if (y < h - 1) st.push(k + w);
      }
      let n = 0, sx = 0, sy = 0;
      for (let k = 0; k < w * h; k++) { const x = k % w, y = (k - x) / w; if (!seen[k] && q.a(x, y) <= 40) { n++; sx += x; sy += y; } }
      return n > 12 ? [sx / n, sy / n, true] : [w / 2, h * 0.62, false]; // (no closed gap: where a fist's middle is)
    };
    const parts = NAMES.map((n, i) => (n ? part(i) : null));
    NAMES.forEach((n, i) => {
      if (!n) return;
      const q = parts[i];
      if (!q) throw new Error('cell ' + (i + 1) + ' (' + n + ') is empty');
      const pv = {}, k = n.split('_')[0];
      if (k === 'head') { const s = span(q, q.h * 0.94); pv.neck = [mid(s), q.h * 0.96]; }
      if (k === 'body') {
        const top = span(q, q.h * 0.03), bot = span(q, q.h * 0.95), sh = span(q, q.h * 0.22);
        pv.neck = [mid(top), q.h * 0.04];
        pv.hip = [mid(bot), q.h * 0.9];
        if (n === 'body_left') pv.shoulder = [mid(sh), q.h * 0.22]; // (side on: the middle of the shoulders)
        else { const ins = (sh[1] - sh[0]) * 0.13; pv.shoulderL = [sh[0] + ins, q.h * 0.22]; pv.shoulderR = [sh[1] - ins, q.h * 0.22]; }
      }
      if (k === 'legs') { const top = span(q, q.h * 0.04); pv.hip = [mid(top), q.h * 0.06]; pv.foot = [q.w / 2, q.h]; }
      if (n === 'arm_upper') { pv.shoulder = end(q, true); pv.elbow = end(q, false); }
      if (n === 'arm_fore') { pv.elbow = end(q, true); pv.wrist = end(q, false); }
      if (n === 'hand_open') pv.wrist = end(q, true);
      if (n === 'hand_grip') { pv.wrist = end(q, true); const g = gap(q); pv.grip = [g[0], g[1]]; if (!g[2]) report.push('hand_grip: no closed gap found, the fist\'s middle is used'); }
      out[n] = { w: q.w, h: q.h, pv };
      report.push(n + ' ' + q.w + 'x' + q.h + ' ' + Object.keys(pv).map((j) => j + '@' + pv[j].map(Math.round).join(',')).join(' '));
    });
    // the arm pieces must be long enough to bend: a joint pair too close is a piece drawn sideways
    ['arm_upper', 'arm_fore'].forEach((n) => { const v = out[n].pv, a = v.shoulder || v.elbow, z = v.elbow === a ? v.wrist : v.elbow; if (z[1] - a[1] < out[n].h * 0.35) throw new Error(n + ': its joints are too close; it should hang straight down, the joint at the top'); });
    // packed at 2/3 size, in rows
    const sheet = W.canvas(1024, 1024), g = sheet.getContext('2d');
    g.imageSmoothingQuality = 'high';
    let x = 4, y = 4, row = 0;
    NAMES.forEach((n, i) => {
      if (!n) return;
      const q = parts[i], w = Math.ceil(q.w * S), h = Math.ceil(q.h * S);
      if (x + w + 4 > 1024) { x = 4; y += row + 6; row = 0; }
      if (y + h > 1024) throw new Error('the parts do not fit the 1024 picture');
      g.drawImage(q.c, 0, 0, q.w, q.h, x, y, w, h);
      out[n].f = [x, y, w, h];
      Object.keys(out[n].pv).forEach((j) => { out[n].pv[j] = out[n].pv[j].map((v) => Math.round(v * S * 10) / 10); });
      delete out[n].w; delete out[n].h;
      x += w + 6; row = Math.max(row, h);
    });
    // the standing height in this picture's pixels: cap to boots (head over the neck, the body, the legs)
    const F = (n) => out[n];
    const tall = F('head_front').pv.neck[1] + (F('body_front').pv.hip[1] - F('body_front').pv.neck[1]) + (F('legs_front').f[3] - F('legs_front').pv.hip[1]);
    return { parts: out, tall: Math.round(tall), png: sheet.toDataURL('image/png'), webp: sheet.toDataURL('image/webp', 0.85), report };
  }, ['data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), NAMES, OUT_SCALE]);
  await b.close();
  fs.writeFileSync(path.join(ROOT, 'assets', 'rig_boy.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'assets', 'rig_boy.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  const js = '// Made by tools/art/rig-import.js from ' + path.relative(ROOT, SRC) + ' (do not edit: run it again). The farmer boy\'s rig parts:\n' +
    '// each part\'s place in assets/rig_boy (f: x, y, w, h) and its joints (pv, in that picture\'s pixels); tall: cap to boots.\n' +
    '(function (F) {\n  \'use strict\';\n  F.Config.RIG_BOY = ' + JSON.stringify({ src: path.basename(SRC), tall: r.tall, parts: r.parts }) + ';\n})(window.Farm = window.Farm || {});\n';
  fs.writeFileSync(path.join(ROOT, 'src', '00-zzzzzzzzzzzzzzzzzzzz-rig-boy.js'), js);
  r.report.forEach((l) => console.log(l));
  console.log('tall', r.tall, '| wrote assets/rig_boy.png/.webp and src/00-zzzzzzzzzzzzzzzzzzzz-rig-boy.js');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
