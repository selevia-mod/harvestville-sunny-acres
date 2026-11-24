// The robot's checks (tools/robot-check.js). Each one plays a part of the game like a player would, and returns
// { name, did, problems: [{ what, where, pic }] }. A picture is taken only of a problem.
const path = require('path');
const { ACTION_BTN, open, frames, go, words, layout, fresh } = require('./page');

const day = (y, m, d, h = 10) => new Date(y, m - 1, d, h, 0).getTime();
const TOOL_LABELS = /^(Till|Water|Chop|Smash|Cut|Plant|Eat|Use|Action|Harvest|Fish|Shoot|Throw|Sow|Feed|Hit|Pick|Swing)$/;
const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60);
async function picture(page, out, name) { const file = path.join(out, slug(name) + '.png'); await page.screenshot({ path: file }); return file; }
async function cleanUp(page) {
  await page.evaluate(() => { try { Farm.ui.closeAll(); } catch (e) {} const d = document.getElementById('farm-ask'); if (d) d.remove(); });
}
async function report(page, problems, from, where, out, extra) {
  const list = [];
  fresh(problems, from).forEach((p) => list.push({ what: p, where }));
  if (extra) {
    (extra.off || []).forEach((p) => list.push({ what: 'Words off the screen: ' + p, where }));
    (extra.overlap || []).forEach((p) => list.push({ what: 'Words on top of each other: ' + p, where }));
  }
  if (list.length) { const pic = await picture(page, out, where); list.forEach((p) => { p.pic = pic; }); }
  return list;
}

// ---- 1. every panel in the game, opened, its words checked ----
const ARGS = {
  openCalendar: [[0]], openSurfaces: [['floor', 0], ['wall', 0]], openRibbons: [[0]], openNews: [[0]], openQuests: [['daily', 0]],
  openGearSlot: [['head']], openWorkshop: [['$WORKSHOP']], openContest: [['$CONTEST', 0]], openFestival: [['$FESTIVAL', 0]],
};
// (these open from another panel with what it hands them: tested through their own e2e tests)
const SKIP = ['openModal', 'openBook', 'openBuilding', 'openMenuShop', 'openRefillQty', 'openSellLot', 'openStoreItem', 'openTownBoard', 'openCatchBoard', 'openDerbyBoard'];
async function panels(browser, out) {
  const { page, problems, context } = await open(browser);
  const version = await page.evaluate(() => String(Farm.Config.NEWS_LATEST || '?'));
  const names = await page.evaluate(() => { const out = new Set(); let p = Object.getPrototypeOf(Farm.ui); while (p && p !== Object.prototype) { Object.getOwnPropertyNames(p).forEach((k) => out.add(k)); p = Object.getPrototypeOf(p); } return [...out].filter((k) => /^open/.test(k)).sort(); });
  const todo = names.filter((n) => !SKIP.includes(n)).sort((a, b) => (a === 'openDecor') - (b === 'openDecor')); // (Decorate last: it stays)
  const found = [];
  let did = 0;
  for (const n of todo) for (const args of ARGS[n] || [[]]) {
    const where = 'Panel ' + n.replace(/^open/, '') + (args.length ? ' (' + args.join(', ') + ')' : '');
    const from = problems.length;
    const err = await page.evaluate(([n, args]) => {
      const C = Farm.Config, real = args.map((a) => (a === '$WORKSHOP' ? Object.keys(C.WORKSHOPS || {})[0] : a === '$CONTEST' ? (C.CONTESTS || [])[0] : a === '$FESTIVAL' ? (C.FESTIVALS || [])[0] : a));
      try { Farm.ui.closeAll(); Farm.ui[n].apply(Farm.ui, real); return null; } catch (e) { return e.message; }
    }, [n, args]);
    await frames(page, 5);
    await page.waitForTimeout(120);
    if (err) problems.push('opening it broke: ' + err);
    found.push(...(await report(page, problems, from, where, out, await layout(page))));
    did++;
    await cleanUp(page);
  }
  await context.close();
  return { name: 'Every panel', did: did + ' panels opened', problems: found, version };
}

// ---- 2. every place: walk up to everything on the map and press its button ----
const MAPS = ['farm', 'town', 'manila', 'mall', 'plains', 'jungle', 'gorge'];
async function places(browser, out) {
  const { page, problems, context } = await open(browser);
  await page.evaluate(() => { Farm.session.state.sel = -1; Farm.bus.emit('hud'); });
  const found = [];
  let did = 0;
  for (const map of MAPS) {
    if (!(await go(page, map))) { found.push({ what: 'Could not get there', where: 'Place ' + map }); continue; }
    const objs = await page.evaluate(() => (Farm.world.objects || []).map((o) => ({ name: o.name || o.type, x0: o.x0, y0: o.y0, x1: o.x1, y1: o.y1 })));
    const seen = new Set();
    for (const o of objs) {
      const cx = Math.floor((o.x0 + o.x1) / 2), cy = Math.floor((o.y0 + o.y1) / 2);
      for (const [tx, ty, dir] of [[cx, o.y1 + 1, 'up'], [cx - 1, o.y1 + 1, 'up'], [cx + 1, o.y1 + 1, 'up'], [o.x0 - 1, cy, 'right'], [o.x1 + 1, cy, 'left'], [cx, o.y0 - 1, 'down']]) {
        const label = await page.evaluate(([tx, ty, dir]) => { Farm.ui.closeAll(); Farm.world.setFeet(tx * 256 + 128, ty * 256 + 128); Farm.world.dir = dir; Farm.world.idle(); return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(Farm.ui.actionLabel.text)))); }, [tx, ty, dir]);
        if (!label || TOOL_LABELS.test(label)) continue;
        const key = o.name + ':' + label;
        if (seen.has(key)) break;
        seen.add(key);
        const from = problems.length;
        await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y);
        await frames(page, 6);
        await page.waitForTimeout(350);
        found.push(...(await report(page, problems, from, 'Place ' + map + ': ' + o.name + ' (' + label + ')', out, await layout(page))));
        did++;
        await cleanUp(page);
        if (!(await go(page, map))) { found.push({ what: 'Could not get back after ' + o.name, where: 'Place ' + map }); break; }
        break;
      }
    }
  }
  await context.close();
  return { name: 'Every place', did: did + ' spots used on ' + MAPS.length + ' maps', problems: found };
}

// ---- 3. days: each festival in town; the clock jumping forward and back ----
async function days(browser, out) {
  const found = [];
  let did = 0;
  // the festivals of the next year
  const now = new Date(), T0 = day(now.getFullYear(), now.getMonth() + 1, now.getDate(), 10); // (today, 10 AM)
  let { page, problems, context } = await open(browser, { rich: false, now: T0 });
  const fests = await page.evaluate(() => { const L = Farm.Logic, out = [], d0 = Farm.session.state.day; for (let d = d0; d < d0 + 366; d++) { const f = L.festivalOn(d); if (f) { const t = L.date(d); out.push([f.name || f.key, t.year, t.month, t.day]); } } return out; });
  await page.evaluate(() => { const s = Farm.session.state; s.tips = -1 >>> 1; s.tq = -1; s.tq2 = -1; s.wv = Farm.Config.NEWS_LATEST; Farm.world.save(); });
  const save = await page.evaluate(() => gameHost.saves[gameHost.saves.length - 1]);
  await context.close();
  for (const [name, y, m, d] of fests) {
    ({ page, problems, context } = await open(browser, { now: day(y, m, d, 11) }));
    const from = problems.length;
    const ok = await go(page, 'town');
    await page.waitForTimeout(500);
    if (!ok) problems.push('could not walk into town');
    found.push(...(await report(page, problems, from, 'Festival day: ' + name, out)));
    did++;
    await context.close();
  }
  // the clock: forward (the title says the days really gone), and back
  const later = (n) => day(now.getFullYear(), now.getMonth() + 1, now.getDate() + n, 10);
  for (const [label, at, n] of [['3 hours later', T0 + 3 * 3600e3, 0], ['1 day later', later(1), 1], ['2 days later', later(2), 2], ['7 days later', later(7), 7], ['40 days later', later(40), 40], ['400 days later', later(400), 400], ['the clock set back 1 day', later(-1), 0]]) {
    ({ page, problems, context } = await open(browser, { save, now: at }));
    await frames(page, 8);
    await page.waitForTimeout(800);
    const from = 0;
    const t = await words(page);
    if (n > 1 && !t.includes('WELCOME BACK! ' + n.toLocaleString('en-US') + ' DAYS WENT BY')) problems.push('the welcome-back title does not say ' + n + ' days: ' + (t[0] || '(none)'));
    if (n <= 0 && t.some((x) => /WELCOME BACK|A NEW DAY/.test(x))) problems.push('a new-day report although no day went by');
    found.push(...(await report(page, problems, from, 'Clock: ' + label, out, await layout(page))));
    did++;
    await context.close();
  }
  return { name: 'Festival days and the clock', did: fests.length + ' festival days, 7 clock jumps', problems: found };
}

// ---- 4. buying with a full bag: never gold gone without the thing ----
async function fullBag(browser, out) {
  const { page, problems, context } = await open(browser);
  await page.evaluate(() => {
    const s = Farm.session.state, L = Farm.Logic, C = Farm.Config;
    s.gold = 2e6;
    [['ore_copper', 30], ['ore_silver', 30], ['ore_gold', 30], ['farm_cement', 30], ['rope', 30]].forEach((n) => L.addItem(s, n[0], n[1]));
    const fill = Object.keys(C.ITEMS).filter((k) => !/tractor|seeder|harvester|seed_|cart|truck|pickup|ore_|rope|cement|sprinkler|rifle|javelin|boomerang/.test(k));
    for (let i = 0; s.inv.some((x) => !x) && i < fill.length; i++) { try { L.addItem(s, fill[i], 1); } catch (e) {} }
    Farm.bus.emit('hud'); Farm.ui.closeAll();
  });
  const found = [];
  const tries = [['openForge', 'Copper Sprinkler', 'Make'], ['openForge', 'Tractor', 'Make'], ['openArmory', 'Rifle', 'Buy'], ['openShop', 'Turnip Seeds', 'Buy'], ['openFlorist', 'Bouquet', 'Buy'], ['openVet', 'Animal Treat', 'Buy']];
  for (const [op, row, label] of tries) {
    const from = problems.length;
    await page.evaluate((op) => { Farm.ui.closeAll(); Farm.ui[op](); }, op);
    await frames(page, 5);
    const before = await page.evaluate(() => ({ gold: Farm.session.state.gold }));
    const pos = await page.evaluate(([row, label]) => {
      const m = Farm.ui.modals[Farm.ui.modals.length - 1], names = [], btns = [];
      const walk = (l) => l.forEach((o) => { if (o.type === 'Text' && o.text.indexOf(row) === 0) names.push(o); if (o.type === 'Text' && o.text.indexOf(label) === 0) btns.push(o); if (o.list) walk(o.list); });
      walk(m.c.list);
      const n = names[0];
      if (!n) return null;
      if (m.c.slimInto) m.c.slimInto(n);
      const b = btns.sort((a, c) => Math.abs(a.getBounds().centerY - n.getBounds().centerY) - Math.abs(c.getBounds().centerY - n.getBounds().centerY))[0];
      if (!b) return null;
      const bb = b.getBounds();
      return { x: bb.centerX, y: bb.centerY };
    }, [row, label]);
    if (!pos) { found.push({ what: 'No "' + label + '" for ' + row, where: 'Full bag: ' + row }); continue; }
    await page.touchscreen.tap(pos.x, pos.y);
    await frames(page, 6);
    await page.waitForTimeout(250);
    const after = await page.evaluate(() => ({ gold: Farm.session.state.gold }));
    if (after.gold < before.gold) problems.push('gold was taken (' + (before.gold - after.gold) + ') with a full bag');
    found.push(...(await report(page, problems, from, 'Full bag: ' + row, out)));
  }
  await context.close();
  return { name: 'Buying with a full bag', did: tries.length + ' things tried', problems: found };
}

// ---- 5. random play: taps, walks, the action button, the bag, closing panels ----
const PLAY_MAPS = ['farm', 'town', 'manila', 'mine', 'mall', 'plains', 'jungle', 'gorge', 'tower'];
// opts: maps (else every place), slow (a busy phone: page.js), size, name (the report's line)
async function randomPlay(browser, out, actions, opts = {}) {
  const found = [];
  let total = 0;
  const maps = opts.maps || PLAY_MAPS;
  for (const [k, map] of maps.entries()) {
    const { page, problems, context } = await open(browser, { slow: opts.slow, size: opts.size });
    await page.evaluate(() => { const s = Farm.session.state; window.__keep = setInterval(() => { s.energy = Math.max(s.energy, 300); }, 2000); });
    if (!(await go(page, map))) { found.push({ what: 'Could not get there to play', where: 'Random play: ' + map }); await context.close(); continue; }
    let seed = 1000 + k;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    const log = [];
    let seenErr = 0;
    for (let i = 0; i < actions; i++) {
      const r = rnd();
      let act = '';
      try {
        if (await page.$('#farm-ask')) { act = 'cancel a question'; await page.evaluate(() => { const c = Array.from(document.querySelectorAll('#farm-ask *')).find((e) => /^(Cancel|Close|No|Not now)$/.test(e.textContent) && !e.children.length); if (c) c.click(); else document.getElementById('farm-ask').remove(); }); }
        else if (r < 0.45) { const x = Math.round(rnd() * 360), y = Math.round(rnd() * 640); act = 'tap ' + x + ',' + y; await page.touchscreen.tap(x, y); }
        else if (r < 0.6) { act = 'the action button'; await page.touchscreen.tap(ACTION_BTN.x, ACTION_BTN.y); }
        else if (r < 0.8) { const jx = rnd() * 2 - 1, jy = rnd() * 2 - 1, ms = 200 + rnd() * 1000; act = 'walk'; await page.evaluate(([jx, jy, ms]) => new Promise((res) => { Farm.input.jx = jx; Farm.input.jy = jy; setTimeout(() => { Farm.input.jx = 0; Farm.input.jy = 0; res(); }, ms); }), [jx, jy, ms]); }
        else if (r < 0.9) { act = 'close a panel'; await page.evaluate(() => { if (Farm.ui.modals.length) Farm.ui.closeModal(); }); }
        else { const slot = Math.floor(rnd() * 7); act = 'bag slot ' + slot; await page.touchscreen.tap(28 + slot * 49, 610); }
        await page.waitForTimeout(50 + rnd() * 120);
      } catch (e) { problems.push('the robot could not go on (' + act + '): ' + e.message.split('\n')[0]); break; }
      log.push(act);
      total++;
      if (problems.length > seenErr) {
        const where = (opts.slow ? 'Slow phone, random play: ' : 'Random play: ') + map + ', after ' + log.slice(-4).join(', ');
        found.push(...(await report(page, problems, seenErr, where, out)));
        seenErr = problems.length;
      }
    }
    await context.close();
  }
  return { name: opts.name || 'Random play', did: total + ' random taps and walks on ' + maps.length + ' maps', problems: found };
}

module.exports = { panels, places, days, fullBag, randomPlay, ARGS, SKIP, picture, slug };
