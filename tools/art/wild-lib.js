'use strict';
// Shared page code for the art importers: background removal, pieces, cells, fitting.
module.exports = `
window.W = {
  load: (s) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('bad image')); i.src = s; }),
  canvas: (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; },
  // transparent pictures stay as they are; a flat magenta/white background touching the edge is flood-filled away
  cutout(img) {
    const c = W.canvas(img.width, img.height), g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const w = c.width, h = c.height, d = g.getImageData(0, 0, w, h), px = d.data;
    if (px[3] < 32 && px[(w * h - 1) * 4 + 3] < 32) return c;
    const key = [px[0], px[1], px[2]], magenta = key[0] > 180 && key[1] < 90 && key[2] > 180;
    const TOL = magenta ? 150 : 60, SOFT = magenta ? 260 : 120, seen = new Uint8Array(w * h), st = [];
    const dist = (i) => Math.abs(px[i] - key[0]) + Math.abs(px[i + 1] - key[1]) + Math.abs(px[i + 2] - key[2]);
    for (let x = 0; x < w; x++) st.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) st.push(y * w, y * w + w - 1);
    while (st.length) {
      const p = st.pop();
      if (seen[p]) continue;
      seen[p] = 1;
      const i = p * 4, dd = dist(i);
      if (dd > SOFT) continue;
      px[i + 3] = dd < TOL ? 0 : Math.round(px[i + 3] * (dd - TOL) / (SOFT - TOL));
      if (dd >= TOL) continue;
      const x = p % w, y = (p - x) / w;
      if (x > 0) st.push(p - 1); if (x < w - 1) st.push(p + 1); if (y > 0) st.push(p - w); if (y < h - 1) st.push(p + w);
    }
    if (magenta) for (let i = 0; i < px.length; i += 4) if (px[i + 3] && px[i] > px[i + 1] + 60 && px[i + 2] > px[i + 1] + 60) {
      const m = Math.min(px[i], px[i + 2]) - px[i + 1]; px[i] -= m * 0.6; px[i + 2] -= m * 0.6;
    }
    g.putImageData(d, 0, 0);
    return c;
  },
  // the grid's cells: every visible piece goes to the cell its middle is in. Each cell comes back as its own canvas
  // holding only its pieces (a neighbour reaching into the box is left out), with the box of those pieces.
  cells(c, cols, rows, share) {
    const w = c.width, h = c.height, px = c.getContext('2d').getImageData(0, 0, w, h).data;
    const lab = new Int32Array(w * h), on = (k) => px[k * 4 + 3] >= 40, cellOf = [0], list = [null];
    const out = [];
    for (let k = 0; k < cols * rows; k++) out.push(null);
    let id = 0, top = 0;
    for (let k0 = 0; k0 < w * h; k0++) {
      if (lab[k0] || !on(k0)) continue;
      id++;
      lab[k0] = id;
      let x0 = w, x1 = 0, y0 = h, y1 = 0, n = 0, sx = 0, sy = 0;
      const q = [k0];
      while (q.length) {
        const m = q.pop(), mx = m % w, my = (m - mx) / w;
        n++; sx += mx; sy += my;
        if (mx < x0) x0 = mx; if (mx > x1) x1 = mx; if (my < y0) y0 = my; if (my > y1) y1 = my;
        if (mx > 0 && !lab[m - 1] && on(m - 1)) { lab[m - 1] = id; q.push(m - 1); }
        if (mx < w - 1 && !lab[m + 1] && on(m + 1)) { lab[m + 1] = id; q.push(m + 1); }
        if (my > 0 && !lab[m - w] && on(m - w)) { lab[m - w] = id; q.push(m - w); }
        if (my < h - 1 && !lab[m + w] && on(m + w)) { lab[m + w] = id; q.push(m + w); }
      }
      if (n > top) top = n;
      list[id] = { x0, x1, y0, y1, n, cx: sx / n, cy: sy / n };
    }
    for (let i = 1; i <= id; i++) {
      const p = list[i];
      if (p.n < 60 || (share && p.n < top * share)) { cellOf[i] = -1; continue; } // specks
      const k = Math.min(rows - 1, Math.floor(p.cy / (h / rows))) * cols + Math.min(cols - 1, Math.floor(p.cx / (w / cols)));
      cellOf[i] = k;
      const o = out[k];
      if (!o) out[k] = { x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1, big: p.n, foot: p.y1 };
      else {
        o.x0 = Math.min(o.x0, p.x0); o.y0 = Math.min(o.y0, p.y0); o.x1 = Math.max(o.x1, p.x1); o.y1 = Math.max(o.y1, p.y1);
        if (p.n > o.big) { o.big = p.n; o.foot = p.y1; }
      }
    }
    return out.map((b, k) => {
      if (!b) return null;
      const cw = b.x1 - b.x0 + 1, ch = b.y1 - b.y0 + 1, o = W.canvas(cw, ch), og = o.getContext('2d');
      og.drawImage(c, b.x0, b.y0, cw, ch, 0, 0, cw, ch);
      const d = og.getImageData(0, 0, cw, ch);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const L = lab[(b.y0 + y) * w + b.x0 + x];
        // keep this cell's pieces and the soft edge pixels around them (label 0 next to them)
        if (L ? cellOf[L] !== k : false) d.data[(y * cw + x) * 4 + 3] = 0;
      }
      og.putImageData(d, 0, 0);
      return { c: o, x: 0, y: 0, w: cw, h: ch, top: b.y0, bottom: b.y1, foot: b.foot };
    });
  },
  // a piece scaled by k, its middle at cx and its bottom at base (or centred when base is null)
  draw(g, c, b, k, cx, base, cy) {
    const w = b.w * k, h = b.h * k;
    g.imageSmoothingQuality = 'high';
    g.drawImage(c, b.x, b.y, b.w, b.h, cx - w / 2, base != null ? base - h : cy - h / 2, w, h);
  },
  out: (c, q) => ({ png: c.toDataURL('image/png'), webp: c.toDataURL('image/webp', q || 0.8) }),
};`;
