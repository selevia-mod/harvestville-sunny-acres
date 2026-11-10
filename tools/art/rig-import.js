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
// RIG_ARMS=<sheet>: the arm pieces (upper arm, forearm, open hand, fist: 4 cells side by side) from
// that sheet instead of row 4, scaled so the arm (shoulder to the fist's grip) is RIG_ARM_SHARE of his height (0.26, the
// walking sheet's), or by RIG_ARMS_SCALE.
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
// (the arm pieces: art-src/rig/boy-arms-big.png when it is there, owner 11 Nov 2026: they look better than row 4's thin
// ones; RIG_ARMS=none: row 4)
const BIG = path.join(ROOT, 'art-src', 'rig', 'boy-arms-big.png');
const ARMS = process.env.RIG_ARMS === 'none' ? null : process.env.RIG_ARMS ? path.resolve(process.env.RIG_ARMS) : !process.env.RIG_SRC && fs.existsSync(BIG) ? BIG : null;
const ARM_SHARE = Number(process.env.RIG_ARM_SHARE) || 0.26, ARMS_SCALE = Number(process.env.RIG_ARMS_SCALE) || 0;
// The walking sheet's proportions (assets/player.png, facing you: cap to chin, collar to hips, hips to boots). The body and
// the legs are scaled (each evenly, at most 40% either way) to them, so the rig is the shape of the frame it fades from;
// RIG_FIT=0 keeps the sheet's own.
const FIT = process.env.RIG_FIT !== '0', SHARE = { head: 0.45, body: 0.33, legs: 0.22 };

(async () => {
  if (!fs.existsSync(SRC)) throw new Error('no ' + path.relative(ROOT, SRC) + ' (the owner\'s parts sheet; RIG_SRC=art-src/rig/boy-parts-standin.png for the stand-in)');
  const b = await chromium.launch(), p = await b.newPage();
  await p.addScriptTag({ content: require('./wild-lib') });
  const r = await p.evaluate(async ([src, NAMES, S, arms, share, armScale, fit, SHARE]) => {
    const im = await W.load(src);
    if (im.width !== im.height) throw new Error('the sheet should be square (1536 x 1536), it is ' + im.width + ' x ' + im.height);
    const cut = W.cutout(im), cell = im.width / 4, out = {}, report = [];
    // the cell's picture, trimmed: { c, w, h, a(x, y) alpha } (from the parts sheet, or another: its cell at cx, cy of cw x ch)
    const part = (i, from, cx, cy, cw, ch, k) => {
      from = from || cut; cw = cw || cell; ch = ch || cell;
      if (cx == null) { cx = (i % 4) * cell; cy = Math.floor(i / 4) * cell; }
      const c = W.canvas(cw, ch), g = c.getContext('2d');
      g.drawImage(from, cx, cy, cw, ch, 0, 0, cw, ch);
      const d = g.getImageData(0, 0, cw, ch).data;
      let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) if (d[(y * cw + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) return null;
      if (x0 < 2 || y0 < 2 || x1 > cw - 3 || y1 > ch - 3) throw new Error('cell ' + (i + 1) + ' touches its edge: each part needs empty space round it');
      k = k || 1;
      const w = Math.max(1, Math.round((x1 - x0 + 1) * k)), h = Math.max(1, Math.round((y1 - y0 + 1) * k)), t = W.canvas(w, h);
      const tg = t.getContext('2d'); tg.imageSmoothingQuality = 'high';
      tg.drawImage(c, x0, y0, x1 - x0 + 1, y1 - y0 + 1, 0, 0, w, h);
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
    let parts = NAMES.map((n, i) => (n ? part(i) : null));
    if (fit) { // body and legs to the walking sheet's shares, against the head (front view)
      const head = parts[0].h * 0.96, body = parts[4].h * 0.86, legs = parts[8].h * 0.94, clamp = (v) => Math.max(0.6, Math.min(1.4, v));
      const kb = clamp(SHARE.body / SHARE.head * head / body), kl = clamp(SHARE.legs / SHARE.head * head / legs);
      parts = parts.map((q, i) => (!q ? q : i >= 4 && i <= 6 ? part(i, null, null, null, null, null, kb) : i >= 8 && i <= 10 ? part(i, null, null, null, null, null, kl) : q));
      report.push('fitted to the walking sheet: body x' + kb.toFixed(2) + ', legs x' + kl.toFixed(2));
    }
    let armK = 0;
    if (arms) { // the arm pieces from their own sheet (4 cells side by side), at the scale that gives a walking sheet's arm
      const ai = W.cutout(await W.load(arms)), aw = ai.width / 4, ah = ai.height, raw = [0, 1, 2, 3].map((j) => part(12 + j, ai, j * aw, 0, aw, ah, 1));
      const len = (q, top) => { const a = end(q, true), b = end(q, false); return Math.hypot(b[0] - a[0], b[1] - a[1]); };
      const reach = len(raw[0]) + len(raw[1]) + Math.abs(gap(raw[3])[1] - end(raw[3], true)[1]);
      const tallRaw = parts[0].h * 0.96 + (parts[4].h * 0.9 - parts[4].h * 0.04) + (parts[8].h - parts[8].h * 0.06);
      armK = armScale || share * tallRaw / reach;
      [0, 1, 2, 3].forEach((j) => { parts[12 + j] = part(12 + j, ai, j * aw, 0, aw, ah, armK); });
      report.push('arms from the arms sheet at ' + armK.toFixed(3) + ' (their reach ' + Math.round(reach * armK) + ' of ' + Math.round(tallRaw) + ' tall)');
    }
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
  }, ['data:image/png;base64,' + fs.readFileSync(SRC).toString('base64'), NAMES, OUT_SCALE, ARMS ? 'data:image/png;base64,' + fs.readFileSync(ARMS).toString('base64') : null, ARM_SHARE, ARMS_SCALE, FIT, SHARE]);
  await b.close();
  fs.writeFileSync(path.join(ROOT, 'assets', 'rig_boy.png'), Buffer.from(r.png.split(',')[1], 'base64'));
  fs.writeFileSync(path.join(ROOT, 'assets', 'rig_boy.webp'), Buffer.from(r.webp.split(',')[1], 'base64'));
  const js = '// Made by tools/art/rig-import.js from ' + path.relative(ROOT, SRC) + ' (do not edit: run it again). The farmer boy\'s rig parts:\n' +
    '// each part\'s place in assets/rig_boy (f: x, y, w, h) and its joints (pv, in that picture\'s pixels); tall: cap to boots.\n' +
    '(function (F) {\n  \'use strict\';\n  F.Config.RIG_BOY = ' + JSON.stringify({ src: path.basename(SRC) + (ARMS ? ' + ' + path.basename(ARMS) : ''), tall: r.tall, parts: r.parts }) + ';\n})(window.Farm = window.Farm || {});\n';
  fs.writeFileSync(path.join(ROOT, 'src', '00-zzzzzzzzzzzzzzzzzzzz-rig-boy.js'), js);
  r.report.forEach((l) => console.log(l));
  console.log('tall', r.tall, '| wrote assets/rig_boy.png/.webp and src/00-zzzzzzzzzzzzzzzzzzzz-rig-boy.js');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
