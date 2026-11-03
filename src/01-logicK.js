// Looks (00-zzzlooks.js; on screen: 19zj-looks.js). s.lk is which looks you own (a bit each, saved 'co'); s.cw is the one
// you wear ('' for your own clothes, saved 'cw'). Gold looks are bought here; a Coins or Stars look is owned when the
// server says so (L.ownLooks), and the save only remembers it for when you are offline. The Christmas Elf is everyone's.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var ALL = (1 << C.LOOKS.length) - 1;

  // the tours that came with the looks, and with Today's Event, Rare surprises and the deeper Mine (19zk-tours.js).
  // Appended last: a tip's place in the list is its bit in the saved number.
  C.TIPS.push({ key: 'tailor_tour', text: 'THE TAILOR SHOP' }, { key: 'event_tour', text: "TODAY'S EVENT" }, { key: 'rare_tour', text: 'RARE SURPRISES' },
    { key: 'mine_tour', text: 'THE DEEP MINE' });

  L.lookDef = function (key) { var i = C.LOOK_INDEX[key]; return i == null ? null : C.LOOKS[i]; };
  L.ownsLook = function (s, key) {
    var i = C.LOOK_INDEX[key];
    return i != null && (C.LOOKS[i].free || !!(((s.lk || 0) >> i) & 1));
  };
  L.wornLook = function (s) { return s && s.cw && L.ownsLook(s, s.cw) ? s.cw : ''; };

  // 'ok' | 'owned' | 'gold' (not enough) | 'paid' (Coins or Stars: the server sells it) | 'none'
  L.buyLookGold = function (s, key) {
    var d = L.lookDef(key);
    if (!d) return 'none';
    if (L.ownsLook(s, key)) return 'owned';
    if (!d.gold) return 'paid';
    if (s.gold < d.gold) return 'gold';
    s.gold -= d.gold;
    s.lk = (s.lk || 0) | (1 << C.LOOK_INDEX[key]);
    return 'ok';
  };
  // What the server says you own (farm_looks_v1): those looks are yours, on this phone too.
  L.ownLooks = function (s, keys) {
    var n = 0;
    (Array.isArray(keys) ? keys : []).forEach(function (k) {
      var i = C.LOOK_INDEX[k];
      if (i == null || ((s.lk || 0) >> i) & 1) return;
      s.lk = (s.lk || 0) | (1 << i);
      n++;
    });
    return n;
  };
  // '' takes it off. False when you don't own it.
  L.wearLook = function (s, key) {
    if (key && !L.ownsLook(s, key)) return false;
    s.cw = key || '';
    return true;
  };

  var newState = L.newState;
  L.newState = function (info) {
    var s = newState(info);
    s.lk = 0;
    s.cw = '';
    return s;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.lk) o.co = s.lk & ALL;
    if (L.wornLook(s)) o.cw = C.LOOK_INDEX[s.cw];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    s.lk = (Math.floor(Number(o.co)) || 0) & ALL;
    var w = Math.floor(Number(o.cw));
    s.cw = o.cw != null && C.LOOKS[w] && L.ownsLook(s, C.LOOKS[w].key) ? C.LOOKS[w].key : '';
    return s;
  };
})(window.Farm = window.Farm || {});
