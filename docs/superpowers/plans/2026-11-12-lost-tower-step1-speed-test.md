# The Lost Tower, step 1: the 60-enemy speed test, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure on the OPPO (and the iPhone 11) how smooth the game is with 0, 20, 40 and 60 enemies on a 46 x 38
cave floor, to decide whether the Lost Tower's floors put all their enemies out at once or in waves
(docs/superpowers/specs/2026-11-12-lost-tower-design.md, "Phones first").

**Architecture:** A throwaway probe, never merged or published. On a `probe/tower60` branch of the game, the dev-only
SAMPLE place's cave (`sample_cave`, already in the game for tests) becomes 46 x 38 and gets N enemies from the existing
cave creatures; a probe file walks the farmer into it at 0, 20, 40 and 60 enemies, 15 seconds each, and shows each
stage's frame rate on screen. The page goes into a probe branch of the app for the phone test builds.

**Tech Stack:** Phaser game (hv-e54, `node build.js`), tools/make-map.js, the app repo's phone test build scripts
(scratchpad `ph/oppo-build.sh`, `swap-e52.sh`).

---

### Task 1: the probe branch and a 46 x 38 sample cave

**Files:**
- Modify: `tools/make-map.js` (the `sample_cave` entry of `MAPS`)
- Regenerate: `maps/sample_cave.json`

- [ ] **Step 1: Branch off e56/game**

```bash
cd ~/Documents/hv-e54 && git checkout -b probe/tower60 e56/game
```

- [ ] **Step 2: Make the sample cave the Tower's biggest floor**

In `tools/make-map.js`, replace the `sample_cave` entry in `MAPS` with:

```js
sample_cave: () => placeCave('sample_cave', 'sample_place', { seed: 9907, w: 46, h: 38,
  pillars: [[10, 8], [22, 8], [34, 8], [10, 18], [34, 18], [10, 28], [22, 28], [34, 28]],
  pools: [[16, 13, 19, 15], [26, 22, 29, 24], [5, 33, 8, 35]],
  gate: [22, 34],
  props: [['lava_boulder', 3, 12], ['lava_boulder', 40, 20], ['lava_boulder', 18, 31]] }),
```

- [ ] **Step 3: Regenerate the map and check its size**

Run: `npm run map -- --force=sample_cave && python3 -c "import json;m=json.load(open('maps/sample_cave.json'));print(m['width'],m['height'])"`
Expected: `46 38`

### Task 2: the probe

**Files:**
- Create: `src/99-tower-probe.js`

- [ ] **Step 1: Write the probe**

```js
// PROBE (12 Nov 2026), branch probe/tower60 only, never merged: how smooth is a 46 x 38 floor with 0, 20, 40, 60 enemies?
(function (F) {
  'use strict';
  F.devPlaces = true;
  var C = F.Config, L = F.Logic, STAGES = [0, 20, 40, 60], SETTLE = 3000, SEC = 15000;
  var d = C.PLACES.sample_place.dungeon;
  d.floorKinds = [['sample_bat', 1, 2], ['sigbin', 1, 2], ['santelmo', 1, 2]]; // fliers and chargers, as the Tower will have
  d.guardFloor = 99; d.bossFloor = 99; // (no guard, no boss: only the floor's enemies)
  var setN = function (n) { d.count = { base: n, per: 1000, max: n }; };
  L.chargeLoss = function () { return 0; }; // (the farmer never runs out of energy: the probe keeps going)
  var box = null, results = [];
  var show = function (text) {
    if (!box) {
      box = document.createElement('div');
      box.style.cssText = 'position:fixed;left:6px;top:60px;z-index:99999;background:rgba(0,0,0,.75);color:#fff;font:15px/1.35 monospace;padding:8px 10px;border-radius:8px;white-space:pre;pointer-events:none';
      document.body.appendChild(box);
    }
    box.textContent = text;
  };
  var ready = function () { var w = F.world; return w && w.sys && w.sys.isActive() && !w.busy && w.mapKey; };
  var wait = function (test, then) { var t = setInterval(function () { if (test()) { clearInterval(t); then(); } }, 200); };
  var measure = function (ms, done) { // frame times over ms
    var times = [], last = performance.now(), end = last + ms;
    var step = function (now) { times.push(now - last); last = now; if (now < end) requestAnimationFrame(step); else done(times); };
    requestAnimationFrame(step);
  };
  var sum = function (n, times) {
    var s = times.slice().sort(function (a, b) { return a - b; }), avg = times.reduce(function (a, b) { return a + b; }, 0) / times.length;
    var live = F.world && F.world.wild ? F.world.wild.animals.length : 0;
    return { n: n, live: live, fps: Math.round(1000 / avg), p95: Math.round(s[Math.floor(s.length * 0.95)]), worst: Math.round(s[s.length - 1]) };
  };
  var line = function (r) { return r.n + ' enemies (' + r.live + ' out): ' + r.fps + ' fps, 95% under ' + r.p95 + ' ms, worst ' + r.worst + ' ms'; };
  var stage = function (i) {
    if (i >= STAGES.length) { show('TOWER SPEED TEST DONE\n' + results.map(line).join('\n')); return; }
    setN(STAGES[i]);
    show('TOWER SPEED TEST\n' + results.map(line).join('\n') + '\nnow: ' + STAGES[i] + ' enemies...');
    F.world.travel('sample_cave', 'entrance', 1);
    wait(function () { return ready() && F.world.mapKey === 'sample_cave'; }, function () {
      var T = C.TILE; F.world.setFeet(23 * T, 19 * T); // (the middle of the floor: they come from every side)
      setTimeout(function () { measure(SEC, function (times) { results.push(sum(STAGES[i], times)); stage(i + 1); }); }, SETTLE);
    });
  };
  wait(function () { return ready() && F.ui && !(F.ui.modals && F.ui.modals.length); }, function () { setTimeout(function () { stage(0); }, 2000); });
  // (a welcome card or a tip on start: close it)
  wait(function () { return F.ui && F.ui.modals && F.ui.modals.length; }, function () { F.ui.closeAll && F.ui.closeAll(); });
})(window.Farm = window.Farm || {});
```

- [ ] **Step 2: Build, and run it once in the desktop browser**

Run: `node build.js && open dist/index.html` (or the preview server), wait about 80 s.
Expected: the box ends with `TOWER SPEED TEST DONE` and four lines (0, 20, 40, 60 enemies) with their `out` counts
matching (60 out at 60). No errors in the console.

- [ ] **Step 3: Commit on the probe branch**

```bash
git add tools/make-map.js maps/sample_cave.json src/99-tower-probe.js dist/index.html
git commit -m "probe(tower): 46 x 38 floor at 0/20/40/60 enemies, frame rate on screen (not for release)"
```

### Task 3: the phones

- [ ] **Step 1: Ask the session that borrowed the phones whether they are free** (the Writer's Lounge session).
- [ ] **Step 2: An app probe branch with the probe page**

```bash
cd ~/Documents/sb-2.6.2-game-test && git checkout -b probe/tower60 e55/harvest-on-e54
cp ~/Documents/hv-e54/dist/index.html assets/sunny-acres/sunny-acres.html
git commit -qam "probe: tower speed test page (not for release)"
```

- [ ] **Step 3: Build and install** (scratchpad scripts): `bash ph/oppo-build.sh t60a` then `adb install -r ph/t60a/t60a.apk`;
`bash swap-e52.sh t60a`. Check the page md5 in both builds matches `dist/index.html`.
- [ ] **Step 4: Back to the release branch:** `git checkout e55/harvest-on-e54` (app repo).
- [ ] **Step 5: Run it:** open Harvest Ville on each phone, wait about 80 s, screenshot the result box.

### Task 4: the decision

- [ ] **Step 1:** Rule: **all at once** if 60 enemies stay at **45 fps or more on the OPPO** with 95% of frames under 33 ms;
otherwise **waves** of the largest count that does (for example 3 waves of 20).
- [ ] **Step 2:** Write the numbers and the choice into the spec ("Phones first") and tell the owner. Restore the phones
to their builds after. The probe branches stay unmerged.
