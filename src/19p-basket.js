// The Harvest Basket (owner, 29 Oct 2026: "allow visitors to pick up ripe plants and it will automatically put in the
// basket... so they can help users not to waste their plant"). On a friend's farm, a ripe crop shows Pick: it goes
// into their basket by the farmhouse (5 a friend a day, 20G each, server part 8). At home, the crops friends picked
// wait in the basket until you tap it. Rules in 01-logicB.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var O = F.Online;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var noop = function () {};
  var BASKET_AT = [10, 6]; // on the grass by the mailbox, at the end of the path (not solid: you walk past it)

  var P = F.WorldScene.prototype;
  var visiting = function (w) { return !!(w.state && w.state.isVisit); };
  var cropItem = function (crop) { return C.ITEMS[C.CROPS[crop].item]; };

  // ---------- the basket by the farmhouse ----------
  var create = P.create;
  P.create = function () {
    create.call(this);
    this.basket = null;
    if (this.mapKey !== 'farm') return;
    var x = BASKET_AT[0], y = BASKET_AT[1];
    F.ensureTexture(this, 'props/basket_empty');
    F.ensureTexture(this, 'props/basket_full');
    var img = this.add.image((x + 0.5) * T, (y + 0.92) * T, 'props/basket_empty').setOrigin(0.5, 1);
    img.setScale((0.9 * T) / img.width);
    F.depthTo(img, DEPTH.actor + (y + 0.92) * T / 1e5);
    var badge = this.add.text((x + 0.86) * T, (y + 0.1) * T, '', { fontFamily: '"Trebuchet MS", Verdana, sans-serif', fontSize: '72px', fontStyle: 'bold', color: '#ffffff', backgroundColor: '#d2452f', padding: { x: 18, y: 4 } })
      .setOrigin(0.5).setDepth(DEPTH.Above + 1);
    this.basket = { img: img, badge: badge };
    this.objects.push({ type: 'basket', name: 'basket', x0: x, y0: y, x1: x, y1: y, props: {} });
    this.drawBasket();
  };
  P.drawBasket = function () {
    var b = this.basket;
    if (!b || !this.sys || !this.sys.isActive()) return;
    var n = visiting(this) ? this.state.basketN || 0 : L.basketCount(this.state);
    b.img.setTexture(n ? 'props/basket_full' : 'props/basket_empty');
    b.badge.setText(String(Math.min(n, 99))).setVisible(n > 0);
  };

  var extraObjectAction = P.extraObjectAction;
  P.extraObjectAction = function (o, held, def) {
    if (o.type !== 'basket') return extraObjectAction.call(this, o, held, def);
    var self = this;
    if (visiting(this)) {
      var v = F.session.visit;
      return { label: 'Basket', icon: C.ICON.crate, run: function () {
        F.ui.dialog((v ? v.name.toUpperCase() + "'S " : '') + 'HARVEST BASKET\n' + (v && v.friend
          ? 'Pick their ripe crops before they wither: they go in here, and you earn ' + C.PICK.gold + 'G for each (up to ' + C.PICK.tiles + ' a day).'
          : 'Friends can pick ripe crops into it. Become friends to help on this farm.'));
      } };
    }
    if (!L.basketCount(this.state)) {
      return { label: 'Basket', icon: C.ICON.crate, run: function () {
        F.ui.dialog('YOUR HARVEST BASKET\nWhen friends visit, they can pick your ripe crops so none go to waste. What they pick waits here for you.');
      } };
    }
    var first = C.ITEMS[Object.keys(this.state.basket)[0]];
    return { label: 'Take', icon: first ? first.icon : C.ICON.crate, run: function () { self.takeBasket(); } };
  };

  P.takeBasket = function () {
    var s = this.state, r = L.takeBasket(s);
    if (!r.got) return F.ui.toast('Your bag is full. Make some room first.');
    sfx('pick');
    this.floatTextAt((BASKET_AT[0] + 0.5) * T, BASKET_AT[1] * T, '+' + r.got);
    F.ui.toast('You took ' + r.got + (r.got > 1 ? ' crops' : ' crop') + ' from the basket.' + (r.left ? ' ' + r.left + ' did not fit in your bag.' : ''), 2600, 0x2f5a22);
    this.changed();
    this.save();
    this.drawBasket();
  };

  // ---------- picking a friend's ripe crop (on their farm) ----------
  O.picked = {}; // host -> crops you may still pick there today (as the server last said)
  var helpAction = P.helpAction;
  P.helpAction = function (t) {
    var v = F.session.visit, self = this, idx = this.idx(t.x, t.y), crop = L.pickable(this.state, idx);
    // a ripe fruit tree picks too (owner, 29 Oct 2026), all its fruit at once
    var ti = crop || !this.pieceAt ? -1 : this.pieceAt(t.x, t.y), fruit = ti >= 0 ? L.pickableTree(this.state, ti) : null;
    var icon = crop ? cropItem(crop).icon : fruit ? C.ITEMS[fruit].icon : 0;
    if ((crop || fruit) && v && !v.friend && O.on && !O.pickOff) { // say why, instead of "look, but don't touch" (owner, 29 Oct)
      return { label: 'Pick', icon: icon, disabled: true, why: 'Only friends can pick ripe crops and fruit. Add ' + v.name + ' as a friend in Online first.' };
    }
    if (!(crop || fruit) || !v || !v.friend || !O.on || O.pickOff) return helpAction.call(this, t);
    if (O.picked[v.host] === 0) return { label: 'Pick', icon: icon, disabled: true, why: 'You picked ' + C.PICK.tiles + ' times on ' + v.name + "'s farm today. Thank you!" };
    if (fruit) return { label: 'Pick', icon: icon, run: function () { self.pickTreeFor(t, ti, fruit); } };
    return { label: 'Pick', icon: icon, run: function () { self.pickFor(t, idx, crop); } };
  };

  P.pickFor = function (t, idx, crop) {
    var self = this, st = this.state;
    if (this.picking) return;
    var keep = L.pickOff(st, idx);
    if (!keep) return;
    this.refreshTile(idx);
    this.sendPick(t, idx, crop, cropItem(crop).name, 1, function () { st.soil[idx] = keep; if (self.sys.isActive()) self.refreshTile(idx); });
  };

  P.pickTreeFor = function (t, i, fruit) {
    var self = this, st = this.state, it = st.yard.items[i];
    if (this.picking) return;
    var keep = L.pickTreeOff(st, i);
    if (!keep) return;
    this.treeLooks();
    var n = L.treeOf(it.t).n, f = C.ITEMS[fruit];
    this.sendPick(t, L.treeTile(it), fruit, n + ' ' + (n > 1 ? f.plural : f.name.toLowerCase()), n, function () { L.putTreeBack(st, keep); if (self.sys.isActive()) self.treeLooks(); });
  };

  // Tells the server (5 picks a friend a day); what the friend sees is already picked, and goes back if it says no.
  P.sendPick = function (t, tile, crop, what, n, undo) {
    var self = this, v = F.session.visit, st = this.state;
    this.picking = true;
    sfx('pick');
    F.Net.rpc('farm_pick_v1', { p_host: v.host, p_tile: tile, p_crop: crop }).then(function (r) {
      self.picking = false;
      if (F.session.visit !== v) return;
      if (r && r.ok) {
        O.picked[v.host] = Math.max(0, Number(r.left) || 0);
        var s = F.session.state; // your own farm, not the one you are on
        s.gold += C.PICK.gold;
        F.Host.save(s);
        F.bus.emit('hud');
        sfx('coin');
        st.basketN = (st.basketN || 0) + n;
        self.drawBasket();
        self.floatTextAt((t.x + 0.5) * T, t.y * T, '+' + C.PICK.gold + 'G');
        O.send('pick', {});
        F.ui.toast(O.picked[v.host] === 0 ? 'That was your 5th today. ' + v.name + ' will be glad!'
          : what.charAt(0).toUpperCase() + what.slice(1) + (n > 1 ? ' are' : ' is') + ' in ' + v.name + "'s basket. Thank you!", 2400, 0x2f5a22);
        return;
      }
      undo();
      var code = r && r.code;
      if (code === 'limit') { O.picked[v.host] = 0; F.ui.toast(Number(r.left) === 0 ? 'You picked enough for today. Thank you!' : 'You helped a lot of farms today! Come back tomorrow.'); } else if (code === 'friends') F.ui.toast('Only friends can pick on a farm.');
      else if (code === 'done') F.ui.toast('A friend already picked that one.');
      else F.ui.toast('Could not pick right now. Try again in a moment.');
    }).catch(function (e) {
      self.picking = false;
      undo();
      if (/Could not find the function/i.test((e && e.message) || '')) { O.pickOff = true; return F.ui.toast('Picking for friends opens soon!'); }
      F.ui.toast('Could not reach the online world. Check your connection.');
    });
  };

  // At home: the crops friends picked for you go into your basket (taken once).
  O.claimPicks = function () {
    if (!O.on || O.pickOff || O.claimingPicks || F.session.visit) return Promise.resolve(0);
    O.claimingPicks = true;
    return F.Net.rpc('farm_picks_v1', {}).then(function (r) {
      O.claimingPicks = false;
      var picks = r && Array.isArray(r.picks) ? r.picks : [];
      if (!picks.length || F.session.visit) return 0;
      var s = F.session.state, n = L.applyPicks(s, picks);
      var from = (Array.isArray(r.from) ? r.from : []).map(function (x) { return L.cleanText(x, 24); }).filter(Boolean);
      F.Host.save(s);
      var w = F.world;
      if (w && w.mapKey === 'farm' && !visiting(w)) {
        if (w.refreshAllSoil) w.refreshAllSoil();
        w.drawBasket();
      }
      if (n && F.ui) F.ui.toast((from.length ? from.slice(0, 3).join(', ') + (from.length > 3 ? ' and more' : '') : 'Friends') + ' picked ' + n +
        (n > 1 ? ' of your ripe crops' : ' of your ripe crop') + '! They are in your basket by the house.', 3600, 0x2f5a22);
      return n;
    }, function (e) {
      O.claimingPicks = false;
      if (/Could not find the function/i.test((e && e.message) || '')) O.pickOff = true;
      return 0;
    });
  };
  var collect = O.collect;
  O.collect = function (auto) {
    return collect.call(O, auto).then(function (got) { O.claimPicks().catch(noop); return got; });
  };
  var onMessage = O.onMessage;
  O.onMessage = function (event, payload) {
    if (event === 'pick' && !F.session.visit && payload && O.others[payload.id]) { O.claimPicks().catch(noop); return; }
    onMessage.call(O, event, payload);
  };
})(window.Farm = window.Farm || {});
