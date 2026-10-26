// Screenshots of the HUD, the side buttons and the panels they open, on a tall phone (for UI polish reviews).
//   node tools/ui-shots.js <out dir> [label]
// Online data comes from the test server stand-in (test/net-mock.js) through the real app bridge.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { createServer } = require('../test/net-mock');
const { createSunnyAcresBridge } = require('../bridge/sunnyAcresBridge');

const PAGE = 'file://' + path.resolve(__dirname, '..', 'dist', 'index.html');
const [out, label = 'now'] = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch();
  const server = createServer();
  const open = async (name, extra) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
    const page = await context.newPage();
    const uid = server.newUser();
    const webViewRef = { current: { injectJavaScript: (code) => { page.evaluate(code).catch(() => {}); } } };
    const bridge = createSunnyAcresBridge({ supabase: server.supabaseFor(uid), webViewRef });
    await context.exposeBinding('__rnPost', (source, data) => { bridge.onMessage({ nativeEvent: { data } }); });
    await page.addInitScript(() => {
      window.ReactNativeWebView = { postMessage: (data) => window.__rnPost(data) };
      window.gameHost = { state: null, quiet: true, save(s) { this.state = s; }, exit() {}, remind() {} };
    });
    await page.addInitScript(bridge.injectedJavaScriptBeforeContentLoaded);
    await page.goto(PAGE, { timeout: 90000 });
    await page.waitForFunction(() => window.Farm && Farm.world && Farm.world.player && Farm.ui && Farm.ui.refresh, null, { timeout: 90000 });
    await page.evaluate(() => { Farm.Logic.weather = () => 'sunny'; Farm.ui.closeAll(); });
    await page.waitForFunction(() => Farm.Online.on, null, { timeout: 90000 });
    await page.evaluate(([n, extra]) => Farm.Net.rpc('farm_join_v1', { p_farm_name: n }).then((r) => {
      Farm.Online.me.name = r.farm_name; Farm.session.state.net.named = 1;
      const s = Farm.session.state; s.gold = 600; s.energy = 80; if (extra) eval(extra); Farm.ui.refresh(); return Farm.Online.publish(true);
    }), [name, extra || '']);
    return { page, context };
  };
  await open('Moon Meadow');
  await open('Rosa Farm');
  const { page } = await open('Dear Jen', 'L = Farm.Logic; s.cnt = s.cnt || {};');
  const shot = (n) => page.screenshot({ path: path.join(out, label + '-' + n + '.png') });
  await page.waitForTimeout(800);
  await shot('1-hud');
  await page.evaluate(() => Farm.ui.openQuests('daily', 0)); await page.waitForTimeout(600); await shot('2-quests');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openOnline('visit', 0)); await page.waitForTimeout(1200); await shot('3-online');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openDecor()); await page.waitForTimeout(1200); await shot('4-decorate');
  await page.evaluate(() => { if (Farm.world.endYard) Farm.world.endYard(); Farm.ui.closeAll(); });
  await page.waitForTimeout(600);
  // a quest done, one ready to claim, one claimed; a HARD one shows its tag
  await page.evaluate(() => {
    const L = Farm.Logic, s = Farm.session.state, set = L.questOf(s, 'daily');
    set.list[0].done = 1; set.list[1].b = L.count(s, set.list[1].c) - set.list[1].n;
  });
  await page.evaluate(() => Farm.ui.openQuests('daily', 0)); await page.waitForTimeout(600); await shot('5-quests-states');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openQuests('monthly', 0)); await page.waitForTimeout(600); await shot('6-monthly');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openQuests('badges', 0)); await page.waitForTimeout(600); await shot('7-badges');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openOnline('me', 0)); await page.waitForTimeout(1200); await shot('8-online-me');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => { Farm.session.state.time = 600; Farm.ui.openWoodshop('build'); }); await page.waitForTimeout(800); await shot('9-woodshop');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openCatalog(0, 0)); await page.waitForTimeout(800); await shot('10-catalog');
  await page.evaluate(() => Farm.ui.closeAll());
  await page.evaluate(() => Farm.ui.openBoard(0)); await page.waitForTimeout(800); await shot('11-board');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
