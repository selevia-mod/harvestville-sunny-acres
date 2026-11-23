// Every panel, looked at as a player's thumb would (tools/robot-check.js --only lists,buttons):
//  - every button (anything that takes a tap) has its middle on the screen, and a tap there reaches IT, not something
//    drawn over it (the game's own hit test: Phaser's, the top one wins);
//  - words do not run past the panel's sides;
//  - a list that scrolls: dragged with a finger to its end, the last row is all there (not cut by the panel's bottom)
//    and its buttons take a tap.
// Each tab of a panel too (tapped with a finger). On each phone size asked for.
const path = require('path');
const { open, frames } = require('./page');
const { ARGS, SKIP } = require('./checks');
const S = require('./screen');

const slug = (s) => String(s).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80);

// Instruments the page (the robot's copy only): each tab bar remembers its tabs and where they are.
const SPY = `(() => {
  const ui = Farm.ui, ts = ui.tabSwitch;
  if (!ts || ui.__robotTabs) return;
  ui.__robotTabs = true;
  ui.tabSwitch = function (c, y, tabs, current) {
    const W = Farm.Config.WIDTH || 360, n = tabs.length, x0 = 30, tw = Math.floor((W - 60) / n);
    c.__tabs = tabs.map((t, k) => ({ key: t[0], label: String(t[1]), x: x0 + tw * k + tw / 2, y: y + c.y, on: t[0] === current }));
    return ts.apply(this, arguments);
  };
})()`;

// What is wrong on the panel on top now. Layout units throughout.
const inspect = (page) => page.evaluate(() => {
  const ui = Farm.ui, W = Farm.Config.WIDTH || 360, H = Farm.Config.VIEW_H, R = Farm.R, cam = ui.cameras.main;
  const m = ui.modals[ui.modals.length - 1];
  if (!m) return { none: true };
  const c = m.c;
  const shown = (o) => { for (let p = o; p; p = p.parentContainer) if (!p.visible || p.alpha < 0.05) return false; return true; };
  const label = (o) => {
    // the words on a button: a Text in the same container, else the nearest words
    const box = o.getBounds(), texts = [];
    const walk = (l) => l.forEach((x) => { if (x.type === 'Text' && x.visible && x.text && x.text.trim()) texts.push(x); if (x.list) walk(x.list); });
    walk(o.parentContainer ? o.parentContainer.list : [o]);
    let best = null, bd = 1e9;
    texts.forEach((t) => { const b = t.getBounds(), d = Math.hypot(b.centerX - box.centerX, b.centerY - box.centerY); if (d < bd) { bd = d; best = t; } });
    if (best && bd < 60) return best.text.replace(/\n/g, ' / ').slice(0, 40);
    const all = [];
    walk(c.list.length ? [c] : []);
    return 'a button at ' + Math.round(box.centerX) + ',' + Math.round(box.centerY);
  };
  const topAt = (x, y) => {
    const ptr = { x: x * R, y: y * R, camera: cam, positionToCamera(cm, o) { return cm.getWorldPoint(this.x, this.y, o); } };
    const over = ui.input.manager.hitTest(ptr, ui.input._list, cam).slice();
    ui.input.sortGameObjects(over, ptr);
    return over[0] || null;
  };
  const within = (o, top) => { for (let p = top; p; p = p.parentContainer) if (p === o) return true; for (let p = o; p; p = p.parentContainer) if (p === top) return true; return false; };
  // the panel's picture: the biggest image in it (its sides: where words must stay inside)
  let panel = null;
  c.list.forEach((o, i) => { if (i && (o.type === 'Image' || o.type === 'NineSlice') && o.visible) { const b = o.getBounds(); if (!panel || b.width * b.height > panel.width * panel.height) panel = b; } });
  // a scrolling list: the container with a mask
  let list = null;
  const findList = (l) => l.forEach((o) => { if (o.type === 'Container' && o.mask && o.mask.geometryMask) list = list || o; if (o.list) findList(o.list); });
  findList(c.list);
  let view = null;
  if (list) { const cb = list.mask.geometryMask.commandBuffer, n = cb.length; view = { x: cb[n - 4], y: cb[n - 3], w: cb[n - 2], h: cb[n - 1] }; view.top = view.y; view.bottom = view.y + view.h; }
  const inList = (o) => { for (let p = o; p; p = p.parentContainer) if (p === list) return true; return false; };
  const bad = [];
  const buttons = [];
  const walk = (l) => l.forEach((o) => {
    if (o.input && o.input.enabled && o !== c.list[0] && shown(o)) buttons.push(o);
    if (o.list) walk(o.list);
  });
  walk(c.list);
  let n = 0;
  buttons.forEach((o) => {
    const b = o.getBounds();
    if (b.width * b.height > 0.4 * W * H) return; // (a panel's own tap-catcher)
    if (b.width < 2 || b.height < 2) return;
    // a row of a list scrolled out of view takes no taps (19i-look.js): only the rows in view are buttons now
    if (inList(o) && view && (b.centerY < view.top || b.centerY > view.bottom)) return;
    n++;
    const x = b.centerX, y = b.centerY;
    if (x < 0 || x > W || y < 0 || y > H) { bad.push({ kind: 'off', what: '"' + label(o) + '" is off the screen (its middle at ' + Math.round(x) + ',' + Math.round(y) + ')' }); return; }
    const top = topAt(x, y);
    if (!top) { bad.push({ kind: 'dead', what: '"' + label(o) + '" does not take a tap at its middle' }); return; }
    if (within(o, top)) return;
    // (something else of the same button, its picture say: fine; something else: covered)
    if (o.parentContainer && top.parentContainer === o.parentContainer && o.parentContainer !== c && o.parentContainer !== list) return;
    bad.push({ kind: 'under', what: '"' + label(o) + '" is under "' + (top.input ? label(top) : top.type) + '": a tap on it goes to that' });
  });
  // words past the panel's sides (not a list's words scrolled away; the title ribbon sits on the top edge by design)
  if (panel) {
    const walkT = (l) => l.forEach((o) => {
      if (o.type === 'Text' && o.text && o.text.trim() && shown(o) && !(list && inList(o))) {
        const b = o.getBounds();
        if (b.width > 1 && (b.left < panel.left - 3 || b.right > panel.right + 3) && b.bottom > panel.top + 4) bad.push({ kind: 'cut', what: 'Words "' + o.text.replace(/\n/g, ' / ').slice(0, 40) + '" run past the panel\'s ' + (b.left < panel.left - 3 ? 'left' : 'right') + ' side' });
      }
      if (o.list) walkT(o.list);
    });
    walkT(c.list);
  }
  const out = { n, bad, tabs: c.__tabs || null, list: null };
  if (list && c.slimScroll) {
    const rows = list.list.filter((r) => r.visible);
    let last = null;
    rows.forEach((r) => { if (!last || r.y > last.y) last = r; });
    out.list = { rows: rows.length, at: c.slimAt || 0, view, last: last ? (() => { const b = last.getBounds(); return { top: b.top, bottom: b.bottom }; })() : null };
  }
  return out;
});

// Scroll the list on top to its end with a finger (drags up, each held still at the end so it does not glide on).
async function scrollToEnd(page) {
  await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; if (m && m.c.slimAll) m.c.slimAll(); });
  await frames(page, 2);
  const box = await S.layoutBox(page);
  let info = await inspect(page);
  if (!info.list) return info;
  const v = info.list.view;
  for (let i = 0; i < 40; i++) {
    const before = info.list.at;
    await S.drag(page, { x: v.x + v.w * 0.35, y: v.bottom - 12 }, { x: v.x + v.w * 0.35, y: v.top + 12 }, { box, holdMs: 120 });
    await page.waitForTimeout(80);
    info = await inspect(page);
    if (!info.list || Math.abs(info.list.at - before) < 0.5) break;
  }
  return info;
}

async function shoot(page, out, name) {
  const file = path.join(out, slug(name) + '.png');
  await page.screenshot({ path: file });
  return file;
}

async function look(page, out, where, results, stats) {
  let info = await inspect(page);
  if (info.none) return;
  stats.panels++;
  stats.buttons += info.n;
  const add = (kind, list, pic) => list.forEach((b) => results[kind].push({ what: b.what, where, pic }));
  if (info.bad.length) {
    const pic = await shoot(page, out, where);
    add('buttons', info.bad, pic);
  }
  if (info.list) {
    stats.lists++;
    info = await scrollToEnd(page);
    const L = info.list;
    stats.rows += L.rows;
    const problems = [];
    if (L.last && (L.last.bottom > L.view.bottom + 2 || L.last.top < L.view.top - 2)) problems.push({ what: 'Scrolled to the end, the last row is cut off: its bottom at ' + Math.round(L.last.bottom) + ', the list shows down to ' + Math.round(L.view.bottom) });
    // the last row's buttons, now in view (and anything wrong at the end of the list)
    info.bad.forEach((b) => problems.push({ what: 'At the end of the list: ' + b.what }));
    if (problems.length) {
      const pic = await shoot(page, out, where + ' list end');
      problems.forEach((p) => results.lists.push({ ...p, where, pic }));
    }
  }
  return info;
}

async function panelsFit(browser, out, opts = {}) {
  const results = { lists: [], buttons: [] };
  const stats = { panels: 0, buttons: 0, lists: 0, rows: 0 };
  const sizes = opts.sizes || [undefined];
  const saves = opts.saves || [{ name: 'the robot\'s farm', save: null }];
  for (const farm of saves) for (const size of sizes) {
    const tag = (saves.length > 1 || farm.save ? ' (' + farm.name + ')' : '') + (size ? ', ' + size.name : '');
    const { page, problems, context } = await open(browser, { save: farm.save, size, slow: opts.slow, calm: !!farm.save, seeded: true });
    await page.evaluate(SPY);
    const names = await page.evaluate(() => { const out = new Set(); let p = Object.getPrototypeOf(Farm.ui); while (p && p !== Object.prototype) { Object.getOwnPropertyNames(p).forEach((k) => out.add(k)); p = Object.getPrototypeOf(p); } return [...out].filter((k) => /^open/.test(k)).sort(); });
    const todo = names.filter((n) => !SKIP.includes(n) && n !== 'openDecor');
    for (const n of todo) for (const args of ARGS[n] || [[]]) {
      const where = 'Panel ' + n.replace(/^open/, '') + (args.length ? ' (' + args.join(', ') + ')' : '') + tag;
      const from = problems.length;
      try {
        await page.evaluate(([n, args]) => {
          const C = Farm.Config, real = args.map((a) => (a === '$WORKSHOP' ? Object.keys(C.WORKSHOPS || {})[0] : a === '$CONTEST' ? (C.CONTESTS || [])[0] : a === '$FESTIVAL' ? (C.FESTIVALS || [])[0] : a));
          Farm.ui.closeAll(); const d = document.getElementById('farm-ask'); if (d) d.remove();
          try { Farm.ui[n].apply(Farm.ui, real); } catch (e) {}
        }, [n, args]);
        await frames(page, 4);
        await page.waitForTimeout(150);
        const info = await look(page, out, where, results, stats);
        // each other tab, tapped with a finger
        const tabs = (info && info.tabs) || [];
        const box = tabs.length ? await S.layoutBox(page) : null;
        for (const t of tabs.filter((x) => !x.on).slice(0, 8)) {
          // (back to the first tab's list top: tap the tab as it is on the panel open now)
          const cur = await page.evaluate(() => { const m = Farm.ui.modals[Farm.ui.modals.length - 1]; return m && m.c.__tabs; });
          const tt = cur && cur.find((x) => x.key === t.key);
          if (!tt) break;
          await S.tap(page, tt.x, tt.y, box);
          await frames(page, 4);
          await page.waitForTimeout(250);
          await look(page, out, where + ', tab ' + t.label, results, stats);
        }
      } catch (e) {
        results.buttons.push({ what: 'The robot could not look at it: ' + e.message.split('\n')[0], where });
      }
      // (errors while doing it: the panels check reports them already)
      problems.splice(from);
      await page.evaluate(() => { try { Farm.ui.closeAll(); } catch (e) {} const d = document.getElementById('farm-ask'); if (d) d.remove(); });
    }
    await context.close();
  }
  const n = saves.length * sizes.length;
  return [
    { name: 'Every list to its end', did: stats.lists + ' lists scrolled to the end (' + stats.rows + ' rows)' + (n > 1 ? ' on ' + n + ' farm x phone' : ''), problems: results.lists },
    { name: 'Every button can be pressed', did: stats.buttons + ' buttons on ' + stats.panels + ' panels and tabs' + (n > 1 ? ' on ' + n + ' farm x phone' : ''), problems: results.buttons },
  ];
}

module.exports = { panelsFit, inspect, scrollToEnd };
