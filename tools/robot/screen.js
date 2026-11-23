// The robot's eyes and fingers on any phone size (tools/robot/*): what part of the screen the game's buttons and panels
// cover, real finger drags and taps (Chrome's touch events, as a phone sends them), and the game's layout units (360 wide,
// Farm.Config.VIEW_H tall) turned into the page's pixels whatever the screen.

// What the UI covers now, in layout units: the UI drawn alone (the world hidden) over black and again over white; where
// the two agree the UI is opaque there (alpha = 1 - (white - black) / 255). The falling leaves and the joystick's faint
// ring (it goes where the thumb is) are left out, and a toast. A grid of CELL layout px; bits[r * cols + c] = 1: covered
// (more than half opaque: a shadow or a see-through ring does not hide what is under it).
const CELL = 2;
const coverMask = (page) => page.evaluate(async (CELL) => {
  const g = Farm.game, ui = Farm.ui, w = Farm.world, C = Farm.Config;
  const shot = () => new Promise((res) => g.renderer.snapshot((img) => res(img)));
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  const pixels = async () => {
    const img = await shot();
    if (!img.complete) await new Promise((r) => { img.onload = r; });
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d');
    cx.drawImage(img, 0, 0);
    return cx.getImageData(0, 0, cv.width, cv.height);
  };
  const W = C.WIDTH || 360, H = C.VIEW_H;
  const hidden = [];
  ui.children.list.forEach((o) => { if (o.visible && (o.type === 'ParticleEmitter' || o === ui.joyBase || o === ui.joyKnob)) { o.setVisible(false); hidden.push(o); } });
  try { if (ui.hideToast) ui.hideToast(); } catch (e) {}
  const back = ui.add.rectangle(-W, -H, W * 3, H * 3, 0x000000, 1).setOrigin(0).setDepth(-1e9).setScrollFactor(0);
  w.sys.setVisible(false);
  let a, b;
  try {
    await frame(); await frame();
    a = await pixels();
    back.setFillStyle(0xffffff, 1);
    await frame(); await frame();
    b = await pixels();
  } finally {
    back.destroy();
    w.sys.setVisible(true);
    hidden.forEach((o) => o.setVisible(true));
  }
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL), px = a.width / W;
  const bits = new Array(cols * rows).fill(0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let n = 0, sum = 0;
    const x0 = Math.floor(c * CELL * px), x1 = Math.min(a.width, Math.floor((c + 1) * CELL * px)), y0 = Math.floor(r * CELL * px), y1 = Math.min(a.height, Math.floor((r + 1) * CELL * px));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const i = (y * a.width + x) * 4;
      sum += 1 - ((b.data[i] - a.data[i]) + (b.data[i + 1] - a.data[i + 1]) + (b.data[i + 2] - a.data[i + 2])) / 765;
      n++;
    }
    bits[r * cols + c] = n && sum / n > 0.5 ? 1 : 0;
  }
  return { cell: CELL, cols, rows, W, H, R: Farm.R, bits: bits.join('') };
}, CELL);

// Where on the page a layout point is (the canvas is fitted into the window: a tablet has bands at the sides).
const layoutBox = (page) => page.evaluate(() => { const r = Farm.game.canvas.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, W: Farm.Config.WIDTH || 360, H: Farm.Config.VIEW_H }; });
const toPage = (box, x, y) => ({ x: box.x + x * box.w / box.W, y: box.y + y * box.h / box.H });

// A finger: down, moved in small steps (a phone sends about one move a frame), up. Points in layout units.
async function cdpOf(page) {
  if (!page.__cdp) page.__cdp = await page.context().newCDPSession(page);
  return page.__cdp;
}
async function drag(page, from, to, opts = {}) {
  const cdp = await cdpOf(page), box = opts.box || (await layoutBox(page)), steps = opts.steps || 8;
  const a = toPage(box, from.x, from.y), b = toPage(box, to.x, to.y);
  const pt = (t) => [{ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(0) });
  for (let i = 1; i <= steps; i++) {
    await page.waitForTimeout(opts.stepMs || 12);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(i / steps) });
  }
  await page.waitForTimeout(opts.holdMs || 40); // (held still at the end: no fling)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(30);
}
async function tap(page, x, y, box) {
  const p = toPage(box || (await layoutBox(page)), x, y);
  await page.touchscreen.tap(p.x, p.y);
}

// ---- the free part of the screen (node side) ----
// sum[r][c]: covered cells above and left of (r, c); a box of cells is free when its sum is 0.
function prefix(mask) {
  const { cols, rows, bits } = mask, S = new Int32Array((cols + 1) * (rows + 1));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) S[(r + 1) * (cols + 1) + c + 1] = (bits[r * cols + c] === '1' ? 1 : 0) + S[r * (cols + 1) + c + 1] + S[(r + 1) * (cols + 1) + c] - S[r * (cols + 1) + c];
  return S;
}
const boxSum = (S, cols, r0, c0, r1, c1) => S[r1 * (cols + 1) + c1] - S[r0 * (cols + 1) + c1] - S[r1 * (cols + 1) + c0] + S[r0 * (cols + 1) + c0];
// A thing w x h (layout px) can be shown uncovered with its top-left at which cells? fit[r * cols + c] = 1 there (on the
// screen, nothing over it). `slack`: this share of each side may be under something (a shadow, a rounded corner).
function fitGrid(mask, S, w, h, slack = 0.15) {
  const { cols, rows, cell } = mask, cw = Math.max(1, Math.round(w * (1 - 2 * slack) / cell)), ch = Math.max(1, Math.round(h * (1 - 2 * slack) / cell));
  const F = new Uint8Array(cols * rows);
  for (let r = 0; r + ch <= rows; r++) for (let c = 0; c + cw <= cols; c++) if (!boxSum(S, cols, r, c, r + ch, c + cw)) F[r * cols + c] = 1;
  // (the grid of the shrunk box: its top-left moved back to the thing's own top-left)
  const off = { c: Math.round(w * slack / mask.cell), r: Math.round(h * slack / mask.cell) };
  const P = new Int32Array((cols + 1) * (rows + 1));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) P[(r + 1) * (cols + 1) + c + 1] = F[r * cols + c] + P[r * (cols + 1) + c + 1] + P[(r + 1) * (cols + 1) + c] - P[r * (cols + 1) + c];
  // anyFit(x0, y0, x1, y1): can the thing's top-left be anywhere in that box (layout px) and be uncovered?
  return (x0, y0, x1, y1) => {
    const c0 = Math.max(0, Math.ceil(x0 / cell) + off.c), r0 = Math.max(0, Math.ceil(y0 / cell) + off.r);
    const c1 = Math.min(cols, Math.floor(x1 / cell) + off.c + 1), r1 = Math.min(rows, Math.floor(y1 / cell) + off.r + 1);
    if (c1 <= c0 || r1 <= r0) return false;
    return boxSum(P, cols, r0, c0, r1, c1) > 0;
  };
}
// How much of a box (layout px) is covered: 0..1
function coveredShare(mask, S, x0, y0, x1, y1) {
  const { cols, rows, cell } = mask;
  const c0 = Math.max(0, Math.floor(x0 / cell)), r0 = Math.max(0, Math.floor(y0 / cell)), c1 = Math.min(cols, Math.ceil(x1 / cell)), r1 = Math.min(rows, Math.ceil(y1 / cell));
  const all = Math.max(1, Math.ceil((x1 - x0) / cell) * Math.ceil((y1 - y0) / cell));
  const inside = c1 > c0 && r1 > r0 ? (c1 - c0) * (r1 - r0) : 0;
  const cov = inside ? boxSum(S, cols, r0, c0, r1, c1) : 0;
  return Math.min(1, (cov + (all - inside)) / all); // (off the screen counts as covered)
}
// The free band: the rows from the top bar's bottom to the first row (from the middle down) mostly covered.
function freeBand(mask) {
  const { cols, rows, bits, cell } = mask, rowCov = (r) => { let n = 0; for (let c = 0; c < cols; c++) n += bits[r * cols + c] === '1'; return n / cols; };
  const mid = Math.floor(rows / 2);
  let top = mid, bot = mid;
  while (top > 0 && rowCov(top - 1) < 0.6) top--;
  while (bot < rows - 1 && rowCov(bot + 1) < 0.6) bot++;
  return { top: top * cell, bottom: (bot + 1) * cell };
}

module.exports = { coverMask, layoutBox, toPage, drag, tap, prefix, fitGrid, coveredShare, freeBand, CELL };
