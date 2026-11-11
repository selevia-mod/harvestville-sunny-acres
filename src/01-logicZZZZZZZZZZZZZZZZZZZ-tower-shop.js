// The Lost Tower's Keeper's shop, gear and big boss rewards: the rules (content 00-zzzzzzzzzzzzzzzzzzzzzzz-tower-shop.js,
// the world 19zzz...z-tower-shop.js; the spec docs/superpowers/specs/2026-11-12-lost-tower-design.md). Pure, no Phaser.
// - The Keeper sells for Pearls only (s.pearls): too few and nothing is taken.
// - The Keeper's gear: pieces 'k:<id>' in the gear slots (L.gearPiece, L.ownsPiece, L.piecesFor learn them); each worn piece
//   takes its share off a Tower enemy's hit (L.towerLess: all four, 60%), only in the Tower; the Boots walk faster there and
//   the Lantern sees farther on the Darkness floors (L.towerSight).
// - Horse gear looks: owned and worn, looks only.
// - A big boss (floor 100, 200 ... 1000) beaten: once per player, its Tower Blessing (L.towerDamage, the most energy) and
//   its piece of the Tide set.
// The save: 'kpr' the Keeper's gear owned (bits), 'hlk' [horse looks owned, worn] (bits), 'twb' the big bosses beaten (bits).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = C.KEEPER;
  var TW = C.TOWER;
  var TR = F.towerTricks;
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var bit = function (b, i) { return ((b || 0) >> i & 1) === 1; };
  var count = function (b) { var n = 0; for (; b; b >>= 1) n += b & 1; return n; };

  // ---------- the shop ----------
  L.keeperIndex = function (id) { for (var i = 0; i < K.gear.length; i++) if (K.gear[i].id === id) return i; return -1; };
  L.keeperOwns = function (s, id) { var i = L.keeperIndex(id); return i >= 0 && bit(s.kpr, i); };
  // A piece of the Keeper's gear: 'ok' | 'owned' | 'pearls' | 'none'. Bought, it goes on (its slot, if nothing is worn there).
  L.keeperBuy = function (s, id) {
    var i = L.keeperIndex(id), g = K.gear[i];
    if (!g) return 'none';
    if (bit(s.kpr, i)) return 'owned';
    if ((s.pearls || 0) < g.price) return 'pearls';
    s.pearls -= g.price;
    s.kpr = (s.kpr || 0) | (1 << i);
    s.gwear = s.gwear || {};
    if (!L.worn(s, g.slot)) s.gwear[g.slot] = 'k:' + id;
    return 'ok';
  };
  var hIndex = function (id) { for (var i = 0; i < K.horse.length; i++) if (K.horse[i].id === id) return i; return -1; };
  var hl = function (s) { return s.hlk || (s.hlk = { own: 0, on: 0 }); };
  L.horseLookOwns = function (s, id) { var i = hIndex(id); return i >= 0 && bit(hl(s).own, i); };
  L.horseLookOn = function (s, id) { var i = hIndex(id); return i >= 0 && bit(hl(s).own & hl(s).on, i); };
  // 'ok' | 'owned' | 'pearls' | 'none'; bought, it is on
  L.horseLookBuy = function (s, id) {
    var i = hIndex(id), h = K.horse[i], r = hl(s);
    if (!h) return 'none';
    if (bit(r.own, i)) return 'owned';
    if ((s.pearls || 0) < h.price) return 'pearls';
    s.pearls -= h.price;
    r.own |= 1 << i;
    r.on |= 1 << i;
    return 'ok';
  };
  L.horseLookWear = function (s, id, on) {
    var i = hIndex(id), r = hl(s);
    if (i < 0 || !bit(r.own, i)) return 'none';
    r.on = on ? r.on | (1 << i) : r.on & ~(1 << i);
    return 'ok';
  };
  // the looks worn, in order: [{ id, tint, glow ... }]
  L.horseLooks = function (s) { return K.horse.filter(function (h) { return L.horseLookOn(s, h.id); }); };

  // ---------- the Keeper's gear, worn in the gear slots ----------
  var piece = function (i) {
    var g = K.gear[i];
    return { id: 'k:' + g.id, old: 'keeper', keeper: g.id, slot: g.slot, name: g.name, icon: C.towerIcon('k_' + g.id), less: 0, desc: L.keeperText(g) };
  };
  L.keeperText = function (g) {
    return Math.round(g.less * 100) + '% less energy when a Tower enemy reaches you' + (g.speed ? ', and ' + Math.round(g.speed * 100) + '% faster walking there' : '') +
      (g.sight ? ', and you see ' + TR.dark.lantern + ' tiles farther on its Darkness floors' : '') + '. Only in The Lost Tower.';
  };
  var keeperId = function (id) { var m = /^k:([a-z]+)$/.exec(id || ''); return m ? L.keeperIndex(m[1]) : -1; };
  var gearPiece = L.gearPiece;
  L.gearPiece = function (id) { var i = keeperId(id); return i >= 0 ? piece(i) : gearPiece(id); };
  var ownsPiece = L.ownsPiece;
  L.ownsPiece = function (s, id) { var i = keeperId(id); return i >= 0 ? bit(s.kpr, i) : ownsPiece(s, id); };
  var piecesFor = L.piecesFor;
  L.piecesFor = function (s, slot) {
    var out = piecesFor(s, slot);
    K.gear.forEach(function (g, i) { if (g.slot === slot && bit(s.kpr, i)) out.push('k:' + g.id); });
    return out;
  };
  // the Keeper's pieces worn now
  L.keeperWorn = function (s) { return K.gear.filter(function (g) { return L.worn(s, g.slot) === 'k:' + g.id; }); };
  // the share of a Tower hit the worn pieces take off: 0.1 + 0.1 + 0.2 + 0.2 = 0.6 for the set
  L.keeperLess = function (s) { return Math.round(L.keeperWorn(s).reduce(function (a, g) { return a + g.less; }, 0) * 100) / 100; };
  L.keeperSpeed = function (s) { return 1 + L.keeperWorn(s).reduce(function (a, g) { return a + (g.speed || 0); }, 0); };
  var towerLess = L.towerLess;
  L.towerLess = function (s, lost) {
    lost = towerLess(s, lost);
    var p = L.keeperLess(s);
    return p > 0 && lost > 0 ? Math.max(1, Math.round(lost * (1 - p))) : lost;
  };
  var towerSight = L.towerSight;
  L.towerSight = function (s) { return towerSight(s) + (L.keeperWorn(s).some(function (g) { return g.sight; }) ? TR.dark.lantern : 0); };

  // ---------- the big bosses: Blessings and the Tide set, once each ----------
  // boss n (1 to 10) is floor n x 100. Odd: +5% damage in the Tower; even: +10 most energy.
  L.towerBossNo = function (f) { f = Math.floor(f); return L.towerRole(f) === 'boss' ? f / TW.zoneSize : 0; };
  L.towerBeat = function (s, n) { return n >= 1 && n <= 10 && bit(s.twb, n - 1); };
  L.towerBlessOf = function (n) { return n % 2 ? { damage: TW.bless.damage } : { energy: TW.bless.energy }; };
  L.towerDamage = function (s) { return 1 + TW.bless.damage * count((s.twb || 0) & 0x155); }; // (bits 0, 2, 4, 6, 8: bosses 1, 3, 5, 7, 9)
  L.towerEnergy = function (s) { return TW.bless.energy * count((s.twb || 0) & 0x2aa); };
  L.tidePieces = function (s) { return TW.tide.filter(function (name, i) { return bit(s.twb, i); }); };
  // Floor f's big boss beaten (its floor cleared): its rewards the first time, { n, bless, tide }, else null
  L.towerBossWin = function (s, f) {
    var n = L.towerBossNo(f);
    if (!n || L.towerBeat(s, n)) return null;
    s.twb = (s.twb || 0) | (1 << (n - 1));
    return { n: n, floor: f, bless: L.towerBlessOf(n), tide: TW.tide[n - 1] };
  };
  // the floor's last enemy fell: the boss's rewards with its Pearls (the world shows L.towerWon)
  L.towerWon = null;
  var towerPay = L.towerPay;
  L.towerPay = function (s, f) {
    var n = towerPay.apply(L, arguments);
    L.towerWon = L.towerBossWin(s, f) || L.towerWon;
    return n;
  };
  var maxEnergy = L.maxEnergy;
  L.maxEnergy = function (s) { return maxEnergy(s) + L.towerEnergy(s); };
  // a shot's damage in the Tower, with the damage Blessings
  var bowDamage = L.bowDamage;
  L.bowDamage = function (s) { var d = bowDamage(s); return s && s.map === 'tower' && s.twb ? d * L.towerDamage(s) : d; };

  // ---------- the save ----------
  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.kpr = 0;
    s.hlk = { own: 0, on: 0 };
    s.twb = 0;
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), h = s.hlk || {};
    if (s.kpr) o.kpr = s.kpr & 15;
    if (h.own) o.hlk = [h.own & 7, h.on & h.own & 7];
    if (s.twb) o.twb = s.twb & 1023;
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var h = o && Array.isArray(o.hlk) ? o.hlk : [];
    s.kpr = int(o && o.kpr, 0, 15, 0);
    s.hlk = { own: int(h[0], 0, 7, 0), on: int(h[1], 0, 7, 0) & int(h[0], 0, 7, 0) };
    s.twb = int(o && o.twb, 0, 1023, 0);
    // the Keeper's pieces worn (the places' layer read 'gw' before it knew what you own)
    if (s.kpr && Array.isArray(o.gw)) C.GEAR_SLOTS.forEach(function (k, j) { var id = String(o.gw[j] || ''); if (keeperId(id) >= 0 && L.gearPiece(id).slot === k && L.ownsPiece(s, id)) s.gwear[k] = id; });
    // the energy Blessings' energy (01-logic8.js capped it before they were read)
    if (L.towerEnergy(s)) s.energy = Math.max(s.energy, int(o.e, 0, L.maxEnergy(s), 0));
    return s;
  };
})(window.Farm = window.Farm || {});
