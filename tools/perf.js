// Measures how smooth the game runs on a slow phone: Chromium at phone size with the CPU slowed down (CDP
// Emulation.setCPUThrottlingRate), the built page (dist/index.html), and a few everyday scenes. For each scene:
// frames per second, the slowest frames (p95 / max), how many frames missed 30 fps, long tasks, and what is on
// screen (game objects, textures, JS heap).
// Usage: node tools/perf.js [--cpu 4] [--dpr 2] [--secs 6] [--json out.json]
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const arg = (name, def) => {
  const i = process.argv.indexOf('--' + name);
  return i > 0 ? process.argv[i + 1] : def;
};
const CPU = Number(arg('cpu', 4));
const DPR = Number(arg('dpr', 2));
const SECS = Number(arg('secs', 6));
const OUT = arg('json', null);
const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');

async function main() {
  const browser = await chromium.launch({ headless: process.env.HEADED ? false : true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization'] });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: DPR, hasTouch: true, isMobile: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(() => {
    window.gameHost = { state: null, quiet: true, save(s) { this.state = s; } };
    window.__longTasks = [];
    try {
      new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__longTasks.push(e.duration))).observe({ entryTypes: ['longtask'] });
    } catch (e) { /* not supported */ }
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });

  const t0 = Date.now();
  await page.goto(PAGE, { timeout: 180000 });
  await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 180000 });
  const boot = Date.now() - t0;
  await page.waitForFunction(() => Farm.ui.modals.length > 0, null, { timeout: 60000 }).catch(() => {});
  await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; Farm.ui.closeAll(); });
  const gl = await page.evaluate(() => {
    const r = Farm.game.renderer;
    let name = r.type === 2 ? 'WebGL' : 'Canvas';
    try { const g = r.gl, d = g.getExtension('WEBGL_debug_renderer_info'); if (d) name += ' / ' + g.getParameter(d.UNMASKED_RENDERER_WEBGL); } catch (e) { /* hidden */ }
    return { renderer: name, canvas: Farm.game.canvas.width + 'x' + Farm.game.canvas.height, R: Farm.R };
  });

  const settle = () => page.evaluate(() => new Promise((r) => setTimeout(r, 800)));
  const measure = async (name, during) => {
    await settle();
    await page.evaluate(() => { window.__longTasks.length = 0; });
    const run = page.evaluate((secs) => new Promise((resolve) => {
      const d = [];
      let last = performance.now();
      const end = last + secs * 1000;
      const step = (t) => {
        d.push(t - last);
        last = t;
        if (t < end) requestAnimationFrame(step);
        else resolve(d);
      };
      requestAnimationFrame((t) => { last = t; requestAnimationFrame(step); });
    }), SECS);
    if (during) await during();
    const d = (await run).slice(1).sort((a, b) => a - b);
    const sum = d.reduce((a, b) => a + b, 0);
    const info = await page.evaluate(() => {
      const count = (s) => { let n = 0; const walk = (l) => l.forEach((o) => { n++; if (o.list) walk(o.list); }); walk(s.children.list); return n; };
      return {
        objects: count(Farm.world) + count(Farm.ui),
        textures: Object.keys(Farm.game.textures.list).length,
        tweens: Farm.world.tweens.getTweens().length + Farm.ui.tweens.getTweens().length,
        heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
        long: window.__longTasks.slice(),
      };
    });
    const row = {
      scene: name,
      fps: Math.round((d.length / sum) * 1000 * 10) / 10,
      p50: +d[Math.floor(d.length * 0.5)].toFixed(1),
      p95: +d[Math.floor(d.length * 0.95)].toFixed(1),
      max: +d[d.length - 1].toFixed(1),
      slow: Math.round((d.filter((x) => x > 34).length / d.length) * 1000) / 10, // % of frames under 30 fps
      longTasks: info.long.length,
      longMs: Math.round(info.long.reduce((a, b) => a + b, 0)),
      objects: info.objects,
      textures: info.textures,
      tweens: info.tweens,
      heapMB: info.heapMB,
    };
    console.log(JSON.stringify(row));
    return row;
  };
  const walk = async (dx, dy, ms) => {
    await page.evaluate(([x, y]) => { Farm.input.jx = x; Farm.input.jy = y; }, [dx, dy]);
    await page.waitForTimeout(ms);
    await page.evaluate(() => { Farm.input.jx = 0; Farm.input.jy = 0; });
  };
  const go = async (map, spawn) => {
    await page.evaluate(([m, sp]) => { Farm.ui.closeAll(); Farm.world.travel(m, sp); }, [map, spawn]);
    await page.waitForFunction((k) => Farm.world.mapKey === k && !Farm.world.busy && Farm.world.player.active, map, { timeout: 60000 });
  };

  const rows = [];
  console.log(JSON.stringify({ cpu: CPU, dpr: DPR, boot, ...gl }));
  rows.push(await measure('farm idle'));
  rows.push(await measure('farm walking', async () => {
    for (let i = 0; i < Math.ceil(SECS / 2); i++) { await walk(1, 0, 700); await walk(0, 1, 300); await walk(-1, 0, 700); await walk(0, -1, 300); }
  }));
  rows.push(await measure('panels open/close', async () => {
    for (let i = 0; i < SECS; i++) {
      await page.evaluate(() => Farm.ui.openQuests('daily', 0));
      await page.waitForTimeout(450);
      await page.evaluate(() => { Farm.ui.closeAll(); Farm.ui.openInventory(); });
      await page.waitForTimeout(450);
      await page.evaluate(() => Farm.ui.closeAll());
    }
  }));
  await go('house');
  rows.push(await measure('house walking', async () => { for (let i = 0; i < SECS; i++) { await walk(1, 0, 400); await walk(-1, 0, 400); } }));
  const tMap = Date.now();
  await go('town');
  const townLoad = Date.now() - tMap;
  rows.push(await measure('town idle'));
  rows.push(await measure('town walking', async () => { for (let i = 0; i < SECS; i++) { await walk(1, 0, 500); await walk(0, 1, 400); await walk(-1, 0, 500); await walk(0, -1, 400); } }));
  const tBack = Date.now();
  await go('farm');
  const farmLoad = Date.now() - tBack;
  rows.push(await measure('farm again (after town)'));
  console.log(JSON.stringify({ mapChangeMs: { toTown: townLoad, toFarm: farmLoad }, errors }));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify({ cpu: CPU, dpr: DPR, boot, gl, townLoad, farmLoad, rows, errors }, null, 1));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
