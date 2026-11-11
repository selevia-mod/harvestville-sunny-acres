// The Rifle, the Javelin and the Boomerang: the rules (content 00-zzzzzzzzzzzzzzzzzzz-weapons.js; the world and the panels
// 19zzzzzzzzzzzzzzzzzzzzzzzzzzz-weapons.js). Owning one is having its item (in the bag or in Storage, like the Bow); its
// level is s.wpn[kind]. One in your hands at a time, as the Bow. A shot takes a bullet or a javelin (the boomerang: one of
// its throws) and the Bow's energy. Saved as o.wp = [rifle level, javelin level, boomerang level, the boomerang's throws
// left]. A friend's phone learns which weapon a shot was from the low bits of its range (the 'ar' message the game
// server already passes on: L.shotRange / L.shotWeapon), so no server change is needed to see it.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var W = C.WEAPONS;
  var K = C.WEAPON_KINDS;
  var TOP = C.WEAPON_LEVELS.length - 1; // the Moon level
  var int = function (v, lo, hi, def) { v = Math.floor(Number(v)); return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : def; };
  var lvOf = function (lv) { return int(lv, 0, TOP, 0); };

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.wpn = { rifle: 0, javelin: 0, boomerang: 0, left: 0 };
    return s;
  };

  L.isWeapon = function (id) { return !!W[id]; };
  // Do they work on this map? Manila's grounds and every old hunting place, its cave and the Lair (C.WEAPONS_OLD_PLACES).
  L.weaponsWork = function (map) {
    return C.WEAPON_GROUNDS.indexOf(map) >= 0 || (!!C.WEAPONS_OLD_PLACES && L.isWildMap(map));
  };
  L.hasWeapon = function (s, k) { return !!W[k] && (L.hasItem(s, k) || (s.store || []).some(function (x) { return x && x.id === k; })); };
  L.weaponLevel = function (s, k) { return lvOf(s.wpn && s.wpn[k]); };
  L.weaponRange = function (k, lv) { return W[k].range[lvOf(lv)]; };
  L.weaponHit = function (k, lv) { return W[k].damage[lvOf(lv)]; };
  L.weaponGap = function (k) { return W[k].gap; };
  // The Moon level's special: 'pierce' (the Rifle), 'pair' (the Javelin, the Boomerang), or null below the Moon level.
  L.weaponMoon = function (k, lv) { return W[k] && lvOf(lv) >= TOP ? W[k].moon : null; };
  L.weaponName = function (k, lv) { lv = lvOf(lv); return (lv ? C.WEAPON_LEVELS[lv] + ' ' : '') + W[k].name; };
  L.weaponIcon = function (k, lv) { return C.wpnIcon(k + '_' + lvOf(lv)); };
  // the one in your hands: its kind, or null
  L.heldWeapon = function (s) { var h = L.held(s); return h && W[h.id] ? h.id : null; };

  var itemName = L.itemName;
  L.itemName = function (s, id) { return W[id] ? L.weaponName(id, L.weaponLevel(s, id)) : itemName(s, id); };
  var iconOf = L.iconOf;
  L.iconOf = function (s, id) { return W[id] ? L.weaponIcon(id, L.weaponLevel(s, id)) : iconOf(s, id); };

  // ---------- what things take ----------
  // A material the game does not have yet (the Mixer's Rope, Farm Cement and Beeswax; Manila's drops) is not asked for
  // until it does. 'lumber' is the farm's lumber (s.lumber).
  L.weaponNeeds = function (list) {
    return (list || []).filter(function (n) { return n[0] === 'lumber' || !!C.ITEMS[n[0]]; }).map(function (n) { return [n[0], n[1]]; });
  };
  L.weaponHave = function (s, id) { return id === 'lumber' ? s.lumber || 0 : L.countItem(s, id); };
  var short = function (s, cost) { return cost.needs.filter(function (n) { return L.weaponHave(s, n[0]) < n[1]; }); };
  var pay = function (s, cost) {
    s.gold -= cost.gold;
    cost.needs.forEach(function (n) { if (n[0] === 'lumber') s.lumber -= n[1]; else L.removeItem(s, n[0], n[1]); });
  };
  L.weaponNeedName = function (id) { return id === 'lumber' ? 'Lumber' : C.ITEMS[id].name; };

  // ---------- the Armory: buying and upgrading ----------
  // What comes next for this weapon: { level, gold, needs } (level 0: buying it), or null (the Moon one: the top).
  L.nextWeapon = function (s, k) {
    var have = L.hasWeapon(s, k), lv = have ? L.weaponLevel(s, k) + 1 : 0, b = W[k].buy[lv];
    return b ? { level: lv, gold: b.gold, needs: L.weaponNeeds(b.needs) } : null;
  };
  // Buy it, or take it a level up: 'ok' | 'max' | 'gold' | 'short' (materials) | 'full' (the bag)
  L.getWeapon = function (s, k) {
    var next = L.nextWeapon(s, k);
    if (!next) return 'max';
    if (s.gold < next.gold) return 'gold';
    if (short(s, next).length) return 'short';
    if (!next.level && !L.canAdd(s, k, 1)) return 'full';
    pay(s, next);
    if (!next.level) L.addItem(s, k, 1);
    s.wpn[k] = next.level;
    if (k === 'boomerang') s.wpn.left = W.boomerang.throws[next.level]; // (new, or back from the Armory a level up: like new)
    return 'ok';
  };

  // ---------- ammo ----------
  L.weaponAmmo = function (k) { return W[k].ammo; };
  L.ammoLeft = function (s, k) { return W[k].ammo ? L.countItem(s, W[k].ammo) : L.throwsLeft(s); };
  // packs of bullets (10) or javelins (5): 'ok' | 'gold' | 'full'
  L.buyAmmo = function (s, id, packs) {
    if (!C.AMMO[id]) return 'none';
    packs = int(packs, 1, 999, 1);
    var n = C.AMMO[id].pack * packs, price = C.ITEMS[id].price * packs;
    if (s.gold < price) return 'gold';
    if (!L.canAdd(s, id, n)) return 'full';
    s.gold -= price;
    L.addItem(s, id, n);
    return 'ok';
  };

  // ---------- the boomerang's wear ----------
  L.throwsMax = function (s) { return W.boomerang.throws[L.weaponLevel(s, 'boomerang')]; };
  L.throwsLeft = function (s) { return L.hasWeapon(s, 'boomerang') ? int(s.wpn.left, 0, L.throwsMax(s), 0) : 0; };
  L.throwsLow = function (s) { return L.hasWeapon(s, 'boomerang') && L.throwsLeft(s) <= W.boomerang.warn; };
  // To fix it, back to full: { gold, needs } (lumber + Gold, and Rope once the Mixer makes it), or null (none, or full)
  L.repairCost = function (s) {
    if (!L.hasWeapon(s, 'boomerang') || L.throwsLeft(s) >= L.throwsMax(s)) return null;
    var r = W.boomerang.repair[L.weaponLevel(s, 'boomerang')];
    return { gold: r.gold, needs: L.weaponNeeds(r.needs) };
  };
  // 'ok' | 'none' (no boomerang) | 'full' (nothing to fix) | 'gold' | 'short'
  L.repairBoomerang = function (s) {
    if (!L.hasWeapon(s, 'boomerang')) return 'none';
    var cost = L.repairCost(s);
    if (!cost) return 'full';
    if (s.gold < cost.gold) return 'gold';
    if (short(s, cost).length) return 'short';
    pay(s, cost);
    s.wpn.left = L.throwsMax(s);
    return 'ok';
  };

  // ---------- a shot ----------
  // The one in your hands: 'ok' | 'warn' (ok, and the boomerang has its warning number of throws left now) | 'broke'
  // (ok, and that was its last throw: it is gone) | 'none' | 'ammo' | 'tired'. Takes the bullet or javelin (or the
  // throw) and the energy.
  L.fireWeapon = function (s, k) {
    if (!L.hasItem(s, k)) return 'none';
    var ammo = W[k].ammo;
    if (ammo ? !L.hasItem(s, ammo) : L.throwsLeft(s) <= 0) return 'ammo';
    if (s.energy < C.WEAPON_ENERGY) return 'tired';
    s.energy -= C.WEAPON_ENERGY;
    if (ammo) { L.removeItem(s, ammo, 1); return 'ok'; }
    s.wpn.left = L.throwsLeft(s) - 1;
    if (s.wpn.left <= 0) { // broken: gone (owner, 11 Nov 2026); buying one again starts at Basic
      L.removeItem(s, 'boomerang', 1);
      s.wpn.boomerang = 0;
      s.wpn.left = 0;
      return 'broke';
    }
    return s.wpn.left === W.boomerang.warn ? 'warn' : 'ok';
  };

  // A hit from a weapon's shot lands with its own damage: the world says which shot (s.wpnHit = { k, lv }, never saved)
  // while wildStruck runs, so everything that counts a hit (a Strong shot, the game server, friends) counts this one too.
  var bowDamage = L.bowDamage;
  L.bowDamage = function (s) {
    var h = s && s.wpnHit;
    return h && W[h.k] ? L.weaponHit(h.k, h.lv) + (s.skHit || 0) : bowDamage(s);
  };

  // ---------- friends see it ----------
  // A shot goes out as the Bow's 'ar' (the game server passes x, y, a, l, b on, nothing else): its range `l` is rounded
  // down to 8 world units and the weapon's number (1, 2, 3) put in the low bits. A bow's range is whole tiles (256
  // units), so its low bits are 0. Old app versions just see an arrow.
  L.shotRange = function (range, k) {
    var code = K.indexOf(k) + 1;
    return Math.max(8, Math.floor(Math.min(range, 8 * C.TILE - 8) / 8) * 8) + (code > 0 ? code : 0);
  };
  L.shotWeapon = function (l) { var code = Math.floor(Number(l)) % 8; return code >= 1 && code <= K.length ? K[code - 1] : null; };

  // ---------- save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s), w = s.wpn || {};
    if (K.some(function (k) { return L.hasWeapon(s, k) || w[k]; })) o.wp = K.map(function (k) { return L.weaponLevel(s, k); }).concat([L.throwsLeft(s)]);
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.wpn = { rifle: 0, javelin: 0, boomerang: 0, left: 0 };
    var wp = Array.isArray(o.wp) ? o.wp : null;
    if (wp) {
      K.forEach(function (k, i) { s.wpn[k] = lvOf(wp[i]); });
      s.wpn.left = int(wp[K.length], 0, W.boomerang.throws[s.wpn.boomerang], 0);
    }
    return s;
  };
})(window.Farm = window.Farm || {});
