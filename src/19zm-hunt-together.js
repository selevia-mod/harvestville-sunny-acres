// Hunting together (owner, 3 Nov 2026: "i like the hunting ideas"; server: supabase/farm_online_14.sql).
//   Hunting now: who is out in the Wild Lands right now (friends, and anyone whose farm is listed), with Join. It walks
//     you to their farm and on to where they hunt, so a player on their own can find a partner for the Great Mammoth.
//     The game tells the server when you go into the Wild Lands in your own game, and when you come out.
//   After a hunt with someone who is not your friend yet: "add them as a friend?" (once each, each time the game opens).
//   The biggest catch of the week, for each animal: Online, Ranks, Biggest catch. Each hunt you make sends its weight.
// Before part 14 is applied all of it hides quietly (O.huntOff).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var WI = C.WILD;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var GREY = 0xa08a68, BLUE = 0x4a90c9, GREEN = 0x2f5a22, GOLD_INK = 0x7a5a12;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var name = function (n) { return L.cleanText(n, 24) || 'Farmer'; };
  // the server has no part 14 yet
  var missing = function (e) { return /does not exist|schema cache|PGRST202|could not find the function/i.test((e && e.message) || String(e || '')); };
  var off = function (e) { if (missing(e)) O.huntOff = true; return O.huntOff; };

  // ---------- telling the server where you hunt ----------
  var told; // the map last told (null: not hunting); undefined: not told yet this session
  O.tellHunt = function () {
    if (!O.on || O.huntOff || !F.Net.available()) return;
    var w = F.world, map = w && w.mapKey && !F.session.visit && L.isWildMap(w.mapKey) ? w.mapKey : null;
    if (map === told) return;
    told = map;
    F.Net.rpc('farm_hunt_here_v1', { p_map: map }).catch(function (e) { if (!off(e) && told === map) told = undefined; }); // (tried again on the next map)
  };
  var create = P.create;
  P.create = function () {
    create.call(this);
    this.time.delayedCall(400, O.tellHunt);
  };
  F.bus.on('online', function () { told = undefined; friends = null; O.tellHunt(); });

  // ---------- Hunting now ----------
  var AREA_ICON = { pulag: 'feather_labuyo', makiling: 'tusk', magayon: 'great_tusk' };
  // A row for another panel (the Friends tab, Kanor's Request tab); back() reopens that panel. null while it is hidden.
  U.huntRow = function (back) {
    var self = this;
    if (!O.on || O.huntOff) return null;
    return { icon: C.ICON.bow, name: 'Hunting now', desc: 'Who is out hunting right now. Join them!',
      buttons: [{ label: 'See', color: BLUE, cb: function () { self.closeModal(); self.openHunters(back); } }] };
  };
  U.openHunters = function (back, page) {
    var self = this, ticket = this.swapping;
    if (!O.on) return this.toast('Go online first: pause menu, Online.', 2400);
    F.Net.rpc('farm_hunting_v1', {}).then(function (list) {
      if (self.swapGone(ticket)) return;
      var rows = (Array.isArray(list) ? list : []).filter(function (h) { return h && h.id && !O.blocked[String(h.id)]; }).map(function (h) {
        var id = String(h.id), n = name(h.farm_name), area = WI.areas[h.map], mins = Math.max(0, Math.floor(Number(h.minutes) || 0));
        var v = F.session.visit, here = v && v.host === id && F.world && F.world.mapKey === h.map;
        return {
          id: id, icon: C.ICON[AREA_ICON[h.map]] != null ? C.ICON[AREA_ICON[h.map]] : C.ICON.bow, name: n + (h.friend ? '  (friend)' : ''), online: true,
          desc: (area ? area.name : 'The Wild Lands') + '. ' + (here ? 'You are hunting together.' : mins < 1 ? 'Just went in.' : mins + ' min so far.'),
          buttons: here ? [] : [{ label: 'Join', cb: function () { self.joinHunt(id, n, h.map); } }],
        };
      });
      self.listPanel({
        title: 'Hunting now', rows: rows, page: page || 0,
        sub: function () { return L.weekendMarket(F.session.state.day) ? 'The Great Mammoth is in Magayon this weekend. It only comes out for two or more hunters.' : 'Join a hunt. Everyone who lands enough hits gets their own share.'; },
        empty: 'Nobody is out hunting right now. Look again in a little while. When you hunt, others can find you here too.',
        corner: back ? { label: 'Back', color: GREY, cb: function () { self.closeModal(); back(); } } : null,
        reopen: function (t, p) { self.openHunters(back, p); },
      });
    }).catch(function (e) {
      self.swapping = null;
      self.toast(off(e) ? 'Coming soon!' : 'Could not reach the online world. Check your connection.', 2400);
    });
  };
  // To their farm, then on to where they hunt (O.hostMoved follows v.chase: 19v-wild.js), without asking again.
  U.joinHunt = function (id, n, map) {
    var self = this, v = F.session.visit;
    if (!F.packReady('wild') && !F.packOnPhone('wild') && this.askPack) { this.closeAll(); return this.askPack('wild', function () { self.joinHunt(id, n, map); }); }
    this.closeAll();
    var chase = function (vv) { vv.chase = map; vv.asked = vv.asked || {}; vv.asked['map:' + map] = 1; };
    if (v && v.host === id) {
      chase(v);
      if (O.others[id]) O.hostMoved(v, O.others[id]);
      return;
    }
    var w = F.world;
    if (w && w.wildKeep) w.wildKeep(); // (what is still on the ground goes in your bag)
    O.visit(id, n).then(function (ok) { var nv = F.session.visit; if (ok && nv && nv.host === id) chase(nv); });
  };
  // On your own in Magayon on a weekend: the Great Mammoth will not come. Once a session.
  U.greatAlone = function () {
    var self = this;
    if (!O.on || O.huntOff || F.session.saidGreat) return false;
    F.session.saidGreat = true;
    this.dialog('THE GREAT MAMMOTH\nIt is about this weekend, but it never shows for one hunter alone.\nFind someone to hunt with?', [
      { label: 'Not now', color: GREY },
      { label: 'Hunting now', cb: function () { self.openHunters(); } },
    ]);
    return true;
  };

  // ---------- after a hunt together: add them as a friend? ----------
  var friends = null, asked = {};
  var knownFriends = function () {
    if (friends) return Promise.resolve(friends);
    return F.Net.rpc('farm_friends_v1', {}).then(function (list) {
      friends = {};
      (Array.isArray(list) ? list : []).forEach(function (f) { if (f && f.id) friends[String(f.id)] = f.status || 'friend'; });
      return friends;
    });
  };
  O.huntedWith = function (ids, animal) {
    if (!O.on || O.huntOff || !ids.length) return;
    knownFriends().then(function (fr) {
      var id = ids.filter(function (x) { return !fr[x] && !asked[x] && !O.blocked[x] && O.others[x]; })[0];
      if (!id) return;
      asked[id] = 1;
      var who = O.others[id].name, tries = 0;
      var show = function () {
        if (!F.ui || !O.on || fr[id]) return;
        if ((F.ui.modals.length || (F.world && F.world.busy)) && tries++ < 30) return setTimeout(show, 1500);
        sfx('found');
        F.ui.dialog('HUNTED TOGETHER\nYou and ' + who + ' hunted the ' + animal + ' together!\nAdd ' + who + ' as a friend? Friends visit, write, and join each other\'s hunts.', [
          { label: 'Not now', color: GREY },
          { label: 'Add friend', cb: function () { F.ui.askFriend(id, who); } },
        ]);
      };
      setTimeout(show, 2600); // (after the hunt's own words)
    }).catch(noop);
  };
  U.askFriend = function (id, who) {
    var self = this;
    F.Net.rpc('farm_friend_ask_v1', { p_other: id }).then(function (r) {
      if (friends) friends[id] = r === 'friends' ? 'friend' : 'sent';
      if (r === 'friends') { sfx('found'); return self.toast('You and ' + who + ' are friends now!', 2600, GREEN); }
      if (r === 'requested') return self.toast('Friend request sent to ' + who + '. You will be friends when they say yes.', 3000, GREEN);
      if (r === 'waiting' || r === 'already') return self.toast(r === 'already' ? 'You and ' + who + ' are friends already.' : 'You asked ' + who + ' already.', 2400);
      if (r === 'limit') return self.toast('You have as many friends as you can have!', 2400);
      self.toast('You can\'t add ' + who + ' right now.', 2400);
    }).catch(function (e) { self.toast(off(e) ? 'Coming soon!' : 'Could not reach the online world. Check your connection.', 2400); });
  };

  // ---------- the biggest catch of the week ----------
  O.recordCatch = function (kind, kg) {
    if (!O.on || O.huntOff || !WI.animals[kind]) return;
    var kg10 = Math.round(kg * 10);
    F.Net.rpc('farm_catch_v1', { p_kind: kind, p_kg10: kg10 }).then(function (r) {
      if (!r || !r.ok || Number(r.best) !== kg10) return; // (not bigger than this week's)
      var rank = Math.floor(Number(r.rank)) || 0;
      if (rank < 1 || rank > 10) return;
      setTimeout(function () {
        if (F.ui) F.ui.toast('#' + rank + ' this week for the biggest ' + WI.animals[kind].name + '! See Online, Ranks.', 3000, GOLD_INK);
      }, 2800);
    }).catch(off);
  };
  var wildDown = P.wildDown;
  P.wildDown = function (a) {
    var me = O.me && O.me.id, mine = a.mine, kind = a.kind, size = a.def.rare ? 1 : a.size || 1;
    var by = Object.keys(a.by || {}).filter(function (id) { return id !== me; });
    wildDown.call(this, a);
    if (!mine) return;
    F.session.lastHunt = kind;
    O.recordCatch(kind, L.wildKg(kind, size));
    if (by.length) O.huntedWith(by, WI.animals[kind].name);
  };

  // Online, Ranks, Biggest catch (19h-online.js asks for it): the top 10 for one animal; Next for another.
  U.openCatchBoard = function (show, fail, kindRow, more) {
    var self = this, kinds = WI.order, k = this.catchKind || F.session.lastHunt || 'boar';
    if (kinds.indexOf(k) < 0) k = 'boar';
    this.catchKind = k;
    var def = WI.animals[k], head = [kindRow('ranks'), {
      icon: C.ITEMS[def.drops[0][0]].icon, name: 'Animal: ' + def.name, desc: 'Tap Next to see another animal.',
      buttons: [{ label: 'Next', color: GREY, cb: function () { self.catchKind = kinds[(kinds.indexOf(k) + 1) % kinds.length]; self.swapTo(function () { self.openOnline('ranks', 0); }); } }],
    }];
    F.Net.rpc('farm_catch_board_v1', { p_kind: k }).then(function (list) {
      var rows = head.concat((Array.isArray(list) ? list : []).map(function (r) {
        var id = String(r.id), n = name(r.farm_name), mineRow = !!r.me, rk = Math.floor(Number(r.rank)) || 0;
        return {
          id: id, icon: C.ICON.ribbon, name: '#' + rk + ' ' + n + (mineRow ? ' (you)' : ''), desc: def.name + ', ' + (Math.max(0, Number(r.kg10) || 0) / 10) + ' kg.',
          buttons: mineRow ? [] : [{ label: 'Visit', cb: function () { O.visit(id); } }, more(id, n, 'ranks')],
        };
      }));
      if (rows.length === head.length) rows.push({ icon: C.ICON.exclaim, name: 'No catches yet', desc: 'Nobody has hunted a ' + def.name + ' this week. Be the first!' });
      show(rows, 'The biggest of each animal hunted this week. A new week starts every Monday.', null);
    }).catch(function (e) {
      if (off(e)) return show(head.slice(0, 1).concat([{ icon: C.ICON.exclaim, name: 'Coming soon', desc: 'The biggest catch of the week is almost here.' }]), '', null);
      fail(e);
    });
  };
})(window.Farm = window.Farm || {});
