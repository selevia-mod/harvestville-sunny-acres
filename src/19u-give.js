// Giving items to a friend you play with (owner, 30 Oct 2026, from players: "give your friend food in the mine when
// they are tired"). Hold an item and face their farmer: the action button says Give. It goes to their bag (to their
// Harvest Basket if the bag is full), at once while they play. Friends only, up to 99 at a time (server part 9:
// 10 gives a day to the same friend, 30 in all). Runs after 19h-online.js and 19p-basket.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var O = F.Online;
  var P = F.WorldScene.prototype;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};

  // The item you may give: anything in your hand but a tool.
  var givable = function (s) {
    var held = L.held(s);
    return held && C.ITEMS[held.id] && C.ITEMS[held.id].kind !== 'tool' ? held : null;
  };

  var resolve = P.resolve;
  P.resolve = function () {
    var pt = this.front(0.7), r = this.remoteAt(pt.x, pt.y), s = F.session.state, held = givable(s);
    if (r && held && O.on && !O.giveOff) {
      var p = O.others[r.id], self = this;
      if (p) return { label: 'Give', icon: L.iconOf(s, held.id), run: function () { self.askGive(p); } };
    }
    return resolve.call(this);
  };

  P.askGive = function (p) {
    var self = this, s = F.session.state, held = givable(s), slot = s.sel;
    if (!held) return;
    var name = L.itemName(s, held.id), buttons = [{ label: 'Cancel', color: 0xa08a68 }, { label: 'Give 1', cb: function () { self.give(p, slot, 1); } }];
    if (held.n > 1) buttons.push({ label: 'Give ' + Math.min(99, held.n), color: 0x4a90c9, cb: function () { self.give(p, slot, Math.min(99, held.n)); } });
    F.ui.dialog('GIVE TO ' + p.name.toUpperCase() + '\nGive ' + p.name + ' your ' + name + (held.n > 1 ? ' (you have ' + held.n + ')' : '') + '?', buttons);
  };

  // Out of your bag at once; back into it if the server says no.
  P.give = function (p, slot, n) {
    var s = F.session.state, it = s.inv[slot];
    if (this.giving || !it || C.ITEMS[it.id].kind === 'tool') return;
    var id = it.id, name = L.itemName(s, id), took = L.removeAt(s, slot, n), self = this;
    if (!took) return;
    this.giving = true;
    sfx('pick');
    F.bus.emit('hud');
    if (F.ui) F.ui.refresh();
    var back = function () {
      var left = L.addItem(s, id, took);
      if (left) s.basket[id] = Math.min(999, (s.basket[id] || 0) + left);
      if (F.ui) F.ui.refresh();
    };
    F.Net.rpc('farm_give_v1', { p_to: p.id, p_item: id, p_n: took }).then(function (r) {
      self.giving = false;
      if (r && r.ok) {
        F.Host.save(s);
        O.send('give', { to: p.id });
        sfx('coin');
        return F.ui.toast('You gave ' + p.name + ' ' + (took > 1 ? took + ' ' : 'your ') + name + '. How kind!', 2400, 0x2f5a22);
      }
      back();
      var code = r && r.code;
      if (code === 'friends') F.ui.toast('Only friends can give things. Add ' + p.name + ' as a friend in Online first.', 2800);
      else if (code === 'limit') F.ui.toast('You gave ' + p.name + ' a lot today! Come back tomorrow.', 2600);
      else F.ui.toast('Could not give right now. Try again in a moment.');
    }).catch(function (e) {
      self.giving = false;
      back();
      if (/Could not find the function/i.test((e && e.message) || '')) { O.giveOff = true; return F.ui.toast('Giving to friends opens soon!'); }
      F.ui.toast('Could not reach the online world. Check your connection.');
    });
  };

  // What friends gave you: into your own bag (wherever you are), the rest into your basket at home.
  O.claimGives = function () {
    if (!O.on || O.giveOff || O.claimingGives) return Promise.resolve(0);
    O.claimingGives = true;
    return F.Net.rpc('farm_gives_v1', {}).then(function (r) {
      O.claimingGives = false;
      var gives = r && Array.isArray(r.gives) ? r.gives : [];
      if (!gives.length) return 0;
      var s = F.session.state, got = {}, total = 0, basket = 0; // your own farm, not the one you are on
      gives.slice(0, 100).forEach(function (g) {
        var id = Array.isArray(g) && String(g[0]), n = Array.isArray(g) ? Math.max(0, Math.min(99, Math.floor(Number(g[1]) || 0))) : 0;
        if (!id || !n || !C.ITEMS[id] || C.ITEMS[id].kind === 'tool') return;
        var left = L.addItem(s, id, n);
        if (left) { s.basket[id] = Math.min(999, (s.basket[id] || 0) + left); basket += left; }
        got[id] = (got[id] || 0) + n;
        total += n;
      });
      if (!total) return 0;
      F.Host.save(s);
      F.bus.emit('hud');
      var w = F.world;
      if (w && w.drawBasket) w.drawBasket();
      if (F.ui) F.ui.refresh();
      var from = (Array.isArray(r.from) ? r.from : []).map(function (x) { return L.cleanText(x, 24); }).filter(Boolean);
      var what = Object.keys(got).slice(0, 3).map(function (id) { return got[id] + ' ' + L.itemName(s, id); }).join(', ');
      sfx('coin');
      if (F.ui) F.ui.toast((from.length ? from.slice(0, 2).join(' and ') : 'A friend') + ' gave you ' + what + (Object.keys(got).length > 3 ? ' and more' : '') + '!' +
        (basket ? ' Your bag was full: ' + basket + ' wait in your basket at home.' : ''), 3600, 0x2f5a22);
      return total;
    }, function (e) {
      O.claimingGives = false;
      if (/Could not find the function/i.test((e && e.message) || '')) O.giveOff = true;
      return 0;
    });
  };
  var collect = O.collect;
  O.collect = function (auto) {
    return collect.call(O, auto).then(function (got) { O.claimGives().catch(noop); return got; });
  };
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event === 'give' && payload && O.me && payload.to === O.me.id && O.others[payload.id]) { O.claimGives().catch(noop); return; }
    onMessage.call(O, event, payload);
  };
})(window.Farm = window.Farm || {});
