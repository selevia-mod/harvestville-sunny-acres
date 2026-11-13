// The Lost Tower's tricks, the rules (the spec: docs/superpowers/specs/2026-11-12-lost-tower-design.md, "Normal enemies
// get stronger every floor"). Each realm from the second adds one trick, and it stays on every realm above it; the Seventh
// Moon (floors 901-1000) has them all. Each is an entry of F.towerTricks, by its realm's trick id (C.TOWER.zones[n].trick):
// its numbers here, its pure rules as L.tower* below (no Phaser: test/tower.test.js), what it does in the world in
// 19zzz...zz-tower-tricks.js. Nothing here is saved: a floor is not saved, and every trick comes from the floor's number.
//   shield  (zone 2) some enemies carry a shield: no damage until a Rifle shot breaks it; other shots bounce off
//   burst   (zone 3) a beaten one leaves a puddle that slows you while you stand in it
//   song    (zone 4) while a singer is near and alive, your shots take longer between them
//   flock   (zone 5) fliers go in flocks of 3-5 that circle together and dive at you
//   heal    (zone 6) healers mend the most hurt one near them every few seconds (never themselves)
//   dark    (zone 7) the floor is dark but for a circle round you and round its fire creatures
//   split   (zone 8) a beaten one becomes two smaller ones with half its hits (once: the copies do not split)
//   revive  (zone 9) a beaten one lies a moment and stands again with half its hits, unless hit once more while down
// A trick tied to some kinds (shield, song, heal) also falls on a share of the normal enemies of the realms above its own
// (none of its kinds live there), so it stays all the way up; the shield's share is on its own realm too (the spec: "about
// 1 in 4 normal enemies on shielded floors"). Which ones: from the floor and the enemy's slot (L.rand), the same for everyone.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var TW = C.TOWER;
  var WI = C.WILD;
  var TR = F.towerTricks;

  TR.shield = { id: 'shield', zone: 2, name: 'Shielded', kinds: ['umang', 'kugita_kabalyero', 'pating', 'pugita'], share: 0.25, shareHome: true,
    breaker: 'rifle', tint: 0x9cc4e8 }; // tint: a shielded stand-in's colour until its shield breaks
  TR.burst = { id: 'burst', zone: 3, name: 'Bursting', size: 2, ms: 6000, slow: 0.4, most: 10 }; // size: tiles across; most: puddles at once (the oldest goes)
  TR.song = { id: 'song', zone: 4, name: "Sirena's song", kinds: ['sirena', 'sirena_koro', 'sirenang_bituin', 'magindara', 'palakang_buwan'], share: 0.125,
    reach: 6, slow: 0.5 }; // reach: tiles; slow: shots take this much longer between them
  TR.flock = { id: 'flock', zone: 5, name: 'Flying flocks', size: [3, 5], share: 0.25, ring: 0.65, circle: 4.5, rest: [2500, 4500], dive: 1600, back: 1200 };
  TR.heal = { id: 'heal', zone: 6, name: 'Healers', kinds: ['kataw_manggagamot', 'kataw_reyna', 'bantay_hari'], share: 0.1, reach: 5, part: 0.2, every: 4000 };
  TR.dark = { id: 'dark', zone: 7, name: 'Darkness', sight: 3.5, lantern: 2, fireSight: 2,
    // the fire creatures: they carry their own light (Santelmo's, the lanterns, the stars, the Lighthouse Golem)
    fire: ['santelmong_asul', 'alitaptap', 'lampara_golem', 'dakilang_santelmo', 'parol_multo', 'tala', 'parola_golem'] };
  TR.split = { id: 'split', zone: 8, name: 'Splitters', size: 0.6, part: 0.5, n: 2 };
  TR.revive = { id: 'revive', zone: 9, name: 'Revivers', ms: 3000, part: 0.5 };
  var ORDER = ['shield', 'burst', 'song', 'flock', 'heal', 'dark', 'split', 'revive'];
  L.TOWER_TRICKS = ORDER;
  var COPY = 10000; // a copy's slot: COPY + its parent's slot x 2 + 0 or 1 (a floor's own slots are under 100)

  // ---------- which tricks a floor has ----------
  // Each from its realm up: [] on floors 1-100, ['shield'] on 101-200 ... all eight on 901-1000.
  L.towerTricks = function (f) {
    var z = L.towerZone(f);
    return ORDER.filter(function (id) { return TR[id].zone <= z; });
  };
  L.towerHas = function (f, id) { return !!TR[id] && TR[id].zone <= L.towerZone(f); };

  // ---------- which enemy carries which ----------
  var roleOf = function (kind) { var d = WI.animals[kind]; return d && d.tower ? d.role : null; };
  // a trick tied to kinds: one of them, or one of the share of the normal enemies (on the realms above its own; the
  // shield's on its own realm too)
  var carries = function (f, id, kind, slot) {
    var t = TR[id], z = L.towerZone(f);
    if (t.kinds.indexOf(kind) >= 0) return true;
    if (roleOf(kind) !== 'normal' || (!t.shareHome && z <= t.zone)) return false;
    return L.rand(TW.seed, f, slot, 101 + ORDER.indexOf(id)) < t.share;
  };
  // What an enemy of floor f (its kind, its slot; copy: one of a splitter's two) does there. Every key is there, true or
  // false: { shield, sing, heal, fire, flock, split, revive }.
  L.towerFlags = function (f, kind, slot, copy) {
    var has = function (id) { return L.towerHas(f, id); }, role = roleOf(kind), def = WI.animals[kind] || {};
    var mid = role === 'normal' || role === 'mini'; // (split and revive: the normal enemies and the mini boss; never a guard or the big boss)
    return {
      shield: !copy && has('shield') && carries(f, 'shield', kind, slot),
      sing: has('song') && carries(f, 'song', kind, slot),
      heal: has('heal') && carries(f, 'heal', kind, slot),
      fire: has('dark') && TR.dark.fire.indexOf(kind) >= 0,
      flock: !copy && has('flock') && role === 'normal' && (!!def.flies || (L.towerZone(f) > TR.flock.zone && L.rand(TW.seed, f, slot, 104) < TR.flock.share)),
      split: !copy && has('split') && mid,
      revive: !copy && has('revive') && mid,
    };
  };

  // ---------- shield ----------
  // A shot at a shielded one: 'break' (a Rifle's: the shield is gone, the shot spent on it) or 'bounce' (anything else:
  // no damage). k: the weapon (null: the Bow).
  L.towerShieldHit = function (k) { return k === TR.shield.breaker ? 'break' : 'bounce'; };

  // ---------- burst ----------
  // Is (x, y) in one of the puddles [{ x, y, until }] at time now? (a puddle: size tiles across, round; tile: world units)
  L.towerInPuddle = function (puddles, x, y, now, tile) {
    var r = TR.burst.size / 2 * tile;
    for (var i = 0; i < puddles.length; i++) {
      var p = puddles[i];
      if (p.until > now && (x - p.x) * (x - p.x) + (y - p.y) * (y - p.y) <= r * r) return true;
    }
    return false;
  };
  // how fast you walk: slowed by 40% in a puddle
  L.towerWalk = function (inPuddle) { return inPuddle ? 1 - TR.burst.slow : 1; };

  // ---------- song ----------
  // Is a singer singing to you: alive (not lying down: a reviver) and within reach of (x, y)? list: the floor's enemies.
  L.towerSung = function (list, x, y, tile) {
    var r = TR.song.reach * tile;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a.sing && a.hp > 0 && !a.lying && (a.x - x) * (a.x - x) + (a.y - y) * (a.y - y) <= r * r) return true;
    }
    return false;
  };
  // the time between shots (ms): half as long again while you hear the song
  L.towerGap = function (gap, sung) { return sung ? Math.round(gap * (1 + TR.song.slow)) : gap; };

  // ---------- flocks ----------
  // The floor's flocks: { slot: flock number }. Its flockers (L.towerFlags ... flock) in roster order, in groups of 3 to 5
  // (sizes from the floor's number), never leaving 1 or 2 over (a floor with fewer than 3 fliers: they go together).
  L.towerFlocks = function (f) {
    var out = {}, list = L.towerRoster(f).filter(function (e) { return L.towerFlags(f, e.kind, e.slot).flock; }), g = 0, i = 0, sz = TR.flock.size;
    while (i < list.length) {
      var left = list.length - i, n = sz[0] + Math.floor(L.rand(TW.seed, f, 105, g) * (sz[1] - sz[0] + 1));
      if (left <= sz[1]) n = left; // (the rest, together)
      else if (left - n < sz[0]) n = left - sz[0]; // (leave a whole flock behind it)
      for (var k = 0; k < n; k++, i++) out[list[i].slot] = g;
      g++;
    }
    return out;
  };
  // where a flock's member k of n flies round its middle (angle a, radians): its offset in tiles, [x, y] (into out when
  // given: the world asks every frame, and makes no new array for it)
  L.towerRing = function (k, n, a, out) {
    var t = a + k * 2 * Math.PI / Math.max(1, n);
    out = out || [0, 0];
    out[0] = Math.cos(t) * TR.flock.ring;
    out[1] = Math.sin(t) * TR.flock.ring * 0.7;
    return out;
  };

  // ---------- healers ----------
  // Whom a healer mends: the most hurt (the least of its hits left, as a share) of the others within reach, alive and
  // standing, hurt; the nearer of two as hurt. null: nobody. (x, y, hp, max on each; tile: world units)
  L.towerHealPick = function (healer, list, tile) {
    var r = TR.heal.reach * tile, best = null, bk = 2, bd = 0;
    for (var i = 0; i < list.length; i++) {
      var a = list[i];
      if (a === healer || !(a.hp > 0) || a.lying || !(a.hp < a.max)) continue;
      var d = (a.x - healer.x) * (a.x - healer.x) + (a.y - healer.y) * (a.y - healer.y);
      if (d > r * r) continue;
      var k = a.hp / a.max;
      if (k < bk || (k === bk && d < bd)) { best = a; bk = k; bd = d; }
    }
    return best;
  };
  // how much: a fifth of its hits (at least 1), never past its full hits
  L.towerHealOf = function (a) { return Math.min(a.max - a.hp, Math.max(1, Math.round(a.max * TR.heal.part))); };

  // ---------- darkness ----------
  // How far you see on a dark floor, in tiles. (The Keeper's Lantern will add TR.dark.lantern: it wraps this.)
  L.towerSight = function (s) { return TR.dark.sight; }; // eslint-disable-line no-unused-vars

  // ---------- splitters and revivers ----------
  L.towerHalf = function (max, part) { return Math.max(1, Math.ceil(max * part)); };
  L.towerSplitHp = function (max) { return L.towerHalf(max, TR.split.part); };
  L.towerReviveHp = function (max) { return L.towerHalf(max, TR.revive.part); };
  // how long a beaten reviver lies (ms; s: the player, whose Tower dish may make it longer: 01-logic...-tower-food.js)
  L.towerReviveMs = function (s) { return TR.revive.ms; }; // eslint-disable-line no-unused-vars
  L.towerCopySlot = function (slot, i) { return COPY + slot * 2 + i; };
  L.towerIsCopy = function (slot) { return slot >= COPY; };
})(window.Farm = window.Farm || {});
