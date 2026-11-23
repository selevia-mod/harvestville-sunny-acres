#!/usr/bin/env node
// The robot check (owner, 22 Nov 2026: "I am alone here ... I dont think I can always test it on my own"): one command
// that plays the whole game like a careful tester, and makes a one-page report with a picture of every problem.
//
//   node tools/robot-check.js               the build, then: every panel, every place, festival days and the clock,
//                                           a full bag, random play everywhere, and npm test (about 15 minutes)
//   node tools/robot-check.js --quick       less random play (a few minutes)
//   node tools/robot-check.js --all-tests   and every e2e test file too, one at a time (before an OTA: about an hour);
//                                           a test that fails is run again alone, to tell a slow Mac from a real bug
//   --no-build   use dist/ as it is          --out DIR   where the report goes (else ~/Downloads/robot-check-<date>)
//
// What a human tester sees and the old robot did not (24 Nov 2026, after a player could not drag the farm's last rows out
// from under the Decorate panel):
//   reach   drag every draggable camera (Decorate on the farm and at home) to each edge with a finger, and walk every
//           place: every tile, piece and building must come out from under the panels and bars (tools/robot/reach.js)
//   lists   every list scrolled to its end with a finger: the last row whole, its buttons pressable; every button on
//           every panel and tab has its middle on the screen and takes the tap itself (tools/robot/panels-fit.js)
//   sizes   reach and lists on real phone sizes: 375x667 iPhone SE, 390x844 iPhone 12-15, 412x915 big Android,
//           360x800 tall cheap Android, 768x1024 tablet (360x640 is the usual one); --all-sizes: lists on all of them
//   farms   reach and lists on copies of the biggest real farms (ROBOT_FARMS, else ~/Documents/hv-robot-farms/*.json,
//           names taken out; never in git)
//   slow    a busy phone (CPU 5x slower, long frames): Manila's jeepney and calesa with you in the road, random play,
//           reach (tools/robot/slow.js)
//   The full run does them all (about 40 minutes without --all-tests); --quick does reach and lists on the usual phone;
//   --sizes, --farms, --slow add those to --quick. --only reach,lists,... runs just those (also: panels, places, days,
//   bag, random, tests). Every night: tools/robot-nightly.sh (tools/robot-nightly.plist says how to switch it on).
//
// It never changes the game: it plays a copy of dist/index.html in Chromium (headless), at a phone's size, the packs
// served as the app serves them. Exit code 1 when it found a problem.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const { chromium } = require('playwright');
const { ROOT, DIST } = require('./robot/page');
const checks = require('./robot/checks');
const { reach } = require('./robot/reach');
const { panelsFit } = require('./robot/panels-fit');
const { slowPhone } = require('./robot/slow');
const { SIZES } = require('./robot/page');

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const QUICK = has('--quick'), ALL = has('--all-tests');
const ONLY = argv.includes('--only') ? argv[argv.indexOf('--only') + 1].split(',').map((x) => x.trim()) : null;
const PARTS = ['panels', 'places', 'days', 'bag', 'random', 'reach', 'lists', 'sizes', 'farms', 'slow', 'tests'];
if (ONLY && ONLY.some((x) => !PARTS.includes(x))) { process.stdout.write('--only takes: ' + PARTS.join(',') + '\n'); process.exit(2); }
// a part runs: asked for with --only; else everything (the full run), or for --quick all but sizes, farms and slow
// unless asked for (--sizes, --farms, --slow)
const runs = (part) => (ONLY ? ONLY.includes(part) : !QUICK || !['sizes', 'farms', 'slow'].includes(part) || has('--' + part));
const stamp = (() => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); })();
const OUT = argv.includes('--out') ? path.resolve(argv[argv.indexOf('--out') + 1]) : path.join(os.homedir(), 'Downloads', 'robot-check-' + stamp);
const PICS = path.join(OUT, 'pictures');
fs.mkdirSync(PICS, { recursive: true });
const say = (s) => process.stdout.write(s + '\n');
const git = (a) => { const r = spawnSync('git', a, { cwd: ROOT, encoding: 'utf8' }); return (r.stdout || '').trim(); };

// ---- the tests ----
const count = (text, what) => { const m = new RegExp('^ℹ ' + what + ' (\\d+)', 'm').exec(text); return m ? Number(m[1]) : 0; };
const failedNames = (text) => [...new Set(text.split('\n').filter((l) => /^✖ /.test(l)).map((l) => l.replace(/^✖ /, '').replace(/ \(\d+(\.\d+)?ms\)$/, '')))].filter((n) => !/^failing tests:/.test(n));
function runTests() {
  const out = { name: 'The tests', did: '', problems: [], warnings: [] };
  say('  npm test ...');
  const unit = spawnSync('npm', ['test', '--silent'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
  const text = (unit.stdout || '') + (unit.stderr || '');
  const pass = count(text, 'pass'), fail = count(text, 'fail');
  out.did = pass + fail + ' game tests (' + fail + ' failed)';
  failedNames(text).forEach((n) => out.problems.push({ what: 'Game test failed: ' + n, where: 'npm test' }));
  if (!pass && !fail) out.problems.push({ what: 'npm test did not run: ' + text.slice(-300), where: 'npm test' });
  if (!ALL) return out;
  // The online tests start the REAL game server (server/), which needs its own packages: without them every one of
  // them fails, and that is this Mac's setup, not the game. Say so once, plainly, instead.
  if (!fs.existsSync(path.join(ROOT, 'server', 'node_modules', 'ws'))) {
    out.problems.push({ what: 'Not checked: the game server\'s packages are missing here, so the online tests cannot run. Fix: cd server && npm ci (then run again)', where: 'setup' });
    return out;
  }
  const files =fs.readdirSync(path.join(ROOT, 'test')).filter((f) => /^e2e.*\.test\.js$/.test(f)).sort();
  let n = 0, bad = 0;
  for (const f of files) {
    say('  ' + f + ' ...');
    const r = spawnSync('node', ['--test', '--test-concurrency=1', 'test/' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 40 * 60000 });
    const t = (r.stdout || '') + (r.stderr || '');
    n += count(t, 'pass') + count(t, 'fail');
    for (const name of failedNames(t)) {
      // again, alone, up to 3 times: a slow Mac (it passes once) or a real problem (it fails every time). (The speed
      // tests, e.g. "drawn about 0.1 s behind", can miss once alone when the Mac is busy: 1 in 7 at load 10.)
      let passed = false;
      for (let k = 0; k < 3 && !passed; k++) {
        const again = spawnSync('node', ['--test', '--test-concurrency=1', '--test-name-pattern=' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'test/' + f], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26, timeout: 20 * 60000 });
        const t2 = (again.stdout || '') + (again.stderr || '');
        passed = count(t2, 'fail') === 0 && count(t2, 'pass') > 0;
      }
      if (!passed) { bad++; out.problems.push({ what: 'Test failed (again, 3 times, when run alone): ' + name, where: f }); }
      else out.warnings.push({ what: 'Failed once, then passed alone (a slow moment, not a bug): ' + name, where: f });
    }
  }
  out.did += '; ' + n + ' screen tests in ' + files.length + ' files (' + bad + ' really failed)';
  return out;
}

// ---- the report: one page, the verdict first ----
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function page(results, meta) {
  const problems = results.flatMap((r) => r.problems.map((p) => ({ ...p, part: r.name })));
  const warnings = results.flatMap((r) => (r.warnings || []).map((p) => ({ ...p, part: r.name })));
  const ok = !problems.length;
  const rows = results.map((r) => `<tr><td>${r.problems.length ? '&#10060;' : '&#9989;'}</td><td><b>${esc(r.name)}</b></td><td>${esc(r.did)}</td><td>${r.problems.length ? r.problems.length + ' problem' + (r.problems.length > 1 ? 's' : '') : 'fine'}</td></tr>`).join('');
  const seenPic = new Set();
  const cards = problems.slice(0, 40).map((p, i) => {
    const pic = p.pic && !seenPic.has(p.pic) ? (seenPic.add(p.pic), `<img src="pictures/${esc(path.basename(p.pic))}">`) : '';
    return `<div class="card"><div class="n">${i + 1}</div><div><div class="w">${esc(p.where)}</div><div>${esc(p.what)}</div>${pic}</div></div>`;
  }).join('');
  const warn = warnings.length ? `<h2>Notes (not bugs)</h2><ul>${warnings.map((w) => `<li>${esc(w.where)}: ${esc(w.what)}</li>`).join('')}</ul>` : '';
  return `<!doctype html><html><head><meta charset="utf-8"><title>Robot check</title><style>
  body{margin:0;background:#f3ead8;font-family:-apple-system,Helvetica,sans-serif;color:#3b2a18;width:1000px;padding:0 0 20px}
  .top{padding:22px 26px;color:#fff;background:${ok ? '#2f7a22' : '#b8402a'}}.top h1{margin:0;font-size:30px}.top div{margin-top:6px;font-size:16px;opacity:.95}
  table{margin:16px 26px;border-collapse:collapse;width:948px;background:#fff;border-radius:12px;overflow:hidden}td{padding:10px 12px;border-bottom:1px solid #eee;font-size:15px}
  h2{margin:18px 26px 8px;font-size:20px}.card{display:flex;gap:12px;background:#fff;margin:0 26px 10px;padding:12px;border-radius:12px;font-size:15px}
  .n{background:#b8402a;color:#fff;border-radius:50%;min-width:28px;height:28px;text-align:center;line-height:28px;font-weight:700}.w{font-weight:700;margin-bottom:4px}
  .card img{display:block;width:240px;margin-top:8px;border:1px solid #d9c6a0;border-radius:8px}ul{margin:0 26px;font-size:14px}
  </style></head><body><div class="top"><h1>${ok ? 'Robot check: no problems found' : 'Robot check: ' + problems.length + ' problem' + (problems.length > 1 ? 's' : '') + ' found'}</h1>
  <div>Harvest Ville v${esc(meta.version)}, build ${esc(meta.build)} (${esc(meta.branch)} @${esc(meta.commit)}). ${esc(meta.when)}, ${esc(meta.minutes)} minutes.</div></div>
  <table>${rows}</table>${ok ? '' : '<h2>Problems</h2>' + cards + (problems.length > 40 ? `<ul><li>and ${problems.length - 40} more: report.json</li></ul>` : '')}${warn}</body></html>`;
}

(async () => {
  const t0 = Date.now();
  if (!has('--no-build')) {
    say('Building the game ...');
    const b = spawnSync('node', ['build.js'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 26 });
    if (b.status !== 0) { say((b.stdout || '') + (b.stderr || '')); process.exit(2); }
  }
  const html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8'); // (ROBOT_DIST: another build, e.g. an older one)
  const meta = {
    build: (/window\.Farm\.BUILD = '([0-9a-f]+)'/.exec(html) || [])[1] || '?',
    version: (/NEWS_LATEST\s*=\s*'([^']+)'/.exec(html) || [])[1] || '?',
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD']), commit: git(['rev-parse', '--short', 'HEAD']) + (git(['status', '--porcelain', 'src']) ? ' + changes' : ''),
    when: new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
  };
  const browser = await chromium.launch();
  const results = [];
  const step = async (label, fn) => {
    say(label + ' ...');
    try { results.push(await fn()); } catch (e) { results.push({ name: label, did: 'stopped', problems: [{ what: 'The robot itself stopped: ' + e.message.split('\n')[0], where: label }] }); }
    const r = results[results.length - 1];
    say('  ' + r.did + ': ' + (r.problems.length ? r.problems.length + ' problem(s)' : 'fine'));
  };
  // (a check that gives back several report lines: each its own)
  const steps = async (label, fn) => {
    say(label + ' ...');
    let rs;
    try { rs = await fn(); } catch (e) { rs = [{ name: label, did: 'stopped', problems: [{ what: 'The robot itself stopped: ' + e.message.split('\n')[0], where: label }] }]; }
    for (const r of rs) { results.push(r); say('  ' + r.name + ': ' + r.did + ': ' + (r.problems.length ? r.problems.length + ' problem(s)' : 'fine')); }
  };
  const timed = (fn) => async () => { const t = Date.now(), r = await fn(); (Array.isArray(r) ? r : [r]).forEach((x) => { x.did += ' (' + Math.max(1, Math.round((Date.now() - t) / 60000)) + ' min)'; }); return r; };
  if (runs('panels')) await step('Every panel', timed(() => checks.panels(browser, PICS)));
  if (runs('places')) await step('Every place', timed(() => checks.places(browser, PICS)));
  if (runs('days')) await step('Festival days and the clock', timed(() => checks.days(browser, PICS)));
  if (runs('bag')) await step('Buying with a full bag', timed(() => checks.fullBag(browser, PICS)));
  if (runs('random')) await step('Random play', timed(() => checks.randomPlay(browser, PICS, QUICK ? 80 : 300)));
  if (runs('reach')) await step('Reach every part of the map', timed(() => reach(browser, PICS)));
  if (runs('lists')) await steps('Every list and every button', timed(() => panelsFit(browser, PICS)));
  if (runs('sizes')) {
    const others = SIZES.slice(1);
    await step('Phone sizes: reach', timed(async () => { const r = await reach(browser, PICS, { sizes: others }); r.name = 'Phone sizes: reach every part of the map'; return r; }));
    // (lists on every size: --all-sizes; else the short iPhone, a tall phone and the tablet: the three shapes)
    const listSizes = has('--all-sizes') ? others : others.filter((z) => /iPhone SE|iPhone 12|tablet/.test(z.name));
    await steps('Phone sizes: lists and buttons', timed(async () => { const rs = await panelsFit(browser, PICS, { sizes: listSizes }); rs.forEach((r) => { r.name = 'Phone sizes: ' + r.name.toLowerCase(); }); return rs; }));
  }
  if (runs('farms')) {
    const dir = process.env.ROBOT_FARMS || path.join(os.homedir(), 'Documents', 'hv-robot-farms');
    const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => /\.json$/.test(f)).sort() : [];
    const saves = files.map((f, i) => ({ name: 'Robot Farm ' + (i + 1), save: fs.readFileSync(path.join(dir, f), 'utf8') }));
    if (!saves.length) results.push({ name: 'Big real farms', did: 'not checked', problems: [], warnings: [{ what: 'No copies of real farms in ' + dir + ' (see tools/robot-check.js)', where: 'setup' }] });
    else {
      await step('Big real farms: reach', timed(async () => { const r = await reach(browser, PICS, { saves }); r.name = 'Big real farms: reach every part of the map'; return r; }));
      await steps('Big real farms: lists and buttons', timed(async () => { const rs = await panelsFit(browser, PICS, { saves: saves.slice(0, QUICK ? 1 : 2) }); rs.forEach((r) => { r.name = 'Big real farms: ' + r.name.toLowerCase(); }); return rs; }));
    }
  }
  if (runs('slow')) await steps('Slow phone', timed(() => slowPhone(browser, PICS, { quick: QUICK })));
  await browser.close();
  if (runs('tests')) {
    results.push(runTests());
    const r = results[results.length - 1];
    say('  ' + r.did + ': ' + (r.problems.length ? r.problems.length + ' problem(s)' : 'fine'));
  }
  meta.minutes = Math.round((Date.now() - t0) / 60000);
  meta.version = (results.find((x) => x.version) || {}).version || meta.version;
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ meta, results }, null, 1));
  fs.writeFileSync(path.join(OUT, 'report.html'), page(results, meta));
  const b2 = await chromium.launch(), p = await b2.newPage({ viewport: { width: 1000, height: 300 } });
  await p.goto('file://' + path.join(OUT, 'report.html'));
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(OUT, 'report.png'), fullPage: true });
  await b2.close();
  const n = results.reduce((a, x) => a + x.problems.length, 0);
  say('\n' + (n ? n + ' problem(s) found.' : 'No problems found.') + ' Report: ' + path.join(OUT, 'report.png'));
  process.exit(n ? 1 : 0);
})();
