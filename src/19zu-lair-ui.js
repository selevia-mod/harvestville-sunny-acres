// Bakunawa's Lair at Kanor's Lodge and its tour (content 00-zzzzzzlair.js, rules 01-logicN.js, the cave 19zt-lair.js).
// Kanor's Buy tab: the Magma Bow once you have the Gold Bow (gold, Ember Shards, Bakunawa Scales and Obsidian), and the
// Fire Charm among Hunter's gear (gold and the Lair's goods). He already buys what the Lair gives (kind 'hunt').
// The tour opens the first time you walk into the Lair, and again from What's new.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, INK = K.INK;
  var GREEN = 0x5fa84a, GREY = 0xa08a68;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var needText = function (s, needs) {
    return needs.map(function (n) { return n[1] + ' ' + C.ITEMS[n[0]].name + ' (' + L.countItem(s, n[0]) + ')'; }).join(', ');
  };
  // the row's own, shorter: every need fits its card ("40 Ember Shards (12), 3 Scales (0), 5 Obsidian (2)")
  var SHORT = { ember_shard: 'Ember Shards', bakunawa_scale: 'Scales', santelmo_flame: 'Santelmo Flames', obsidian: 'Obsidian', bungisngis_tooth: 'Teeth',
    fur_amomongo: 'Fur', moss_nuno: 'Moss', pearl_berberoka: 'Pearls', bark_kapre: 'Bark', feather_minokawa: 'Feathers' }; // (the Moon Bow's parts: 6 Fur (0), 3 Moss (0)...)
  var needShort = function (s, needs) {
    return needs.map(function (n) { return n[1] + ' ' + (SHORT[n[0]] || C.ITEMS[n[0]].name) + ' (' + L.countItem(s, n[0]) + ')'; }).join(', ');
  };
  var has = function (s, needs) { return needs.every(function (n) { return L.countItem(s, n[0]) >= n[1]; }); };

  // ---------- Kanor's Buy tab ----------
  var gearRows = U.gearRows;
  U.gearRows = function (s, done) {
    var self = this, rows = gearRows.call(this, s, done), m = C.MAGMA_BOW;
    // the Fire Charm: its goods, and a word when they are short
    C.GEAR.forEach(function (g, i) {
      if (!g.needs || L.hasGear(s, g.key)) return;
      rows[i] = { icon: g.icon, name: g.name, desc: (g.short || g.desc) + ' Needs ' + needShort(s, g.needs) + '.', buttons: [{ label: g.gold + 'G', color: has(s, g.needs) ? GREEN : GREY, cb: function () {
        var r = L.buyGear(s, g.key);
        if (r === 'short') { sfx('nope'); return self.toast('You need ' + needText(s, g.needs) + '. Hunt in Bakunawa\'s Lair!', 3000); }
        if (r === 'ok' && F.Online && F.Online.retrack && F.Online.on) F.Online.retrack();
        done(r, g.name + '! Always on when you hunt.');
      } }] };
    });
    // the Fire look (the Tailor Shop's): Kanor makes it, very dear; a Bakunawa can also give it by luck
    var fl = C.FIRE_LOOK, look = L.lookDef(fl.key);
    if (look && !L.ownsLook(s, fl.key)) {
      if (F.ensureTexture) F.ensureTexture(this, 'looks_thumbs');
      rows.push({ sheet: { key: 'looks_thumbs', frame: C.LOOK_INDEX[fl.key] * 2 + (s.look === 'girl' ? 1 : 0), scale: 0.36 }, name: look.name + ' look',
        desc: '1 in 10 from a Bakunawa. Or ' + needShort(s, fl.needs) + '.',
        buttons: [{ label: String(fl.gold).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'G', color: has(s, fl.needs) && s.gold >= fl.gold ? GREEN : GREY, cb: function () {
          var r = L.buyFireLook(s);
          if (r === 'short') { sfx('nope'); return self.toast('You need ' + needText(s, fl.needs) + '. Hunt in Bakunawa\'s Lair!', 3000); }
          if (r === 'ok') sfx('fanfare');
          done(r, 'The ' + look.name + ' look is yours! Wear it from Looks.');
        } }] });
    }
    // each cave's look (owner, 8 Nov 2026): Kanor makes it, once its place is open; 1 in 10 from its floor-50 boss
    if (L.caveLookOf) C.PLACE_ORDER.filter(function (id) { return L.placeShown(id) && L.placeOpen(s, id) && L.caveLookOf(id); }).forEach(function (id) {
      var key = L.caveLookOf(id), cl = L.lookDef(key), needs = L.caveLookNeeds(id), cg = C.CAVE_LOOK.gold;
      if (!cl || !needs || L.ownsLook(s, key)) return;
      if (F.ensureTexture) F.ensureTexture(self, 'looks_thumbs');
      rows.push({ sheet: { key: 'looks_thumbs', frame: C.LOOK_INDEX[key] * 2 + (s.look === 'girl' ? 1 : 0), scale: 0.36 }, name: cl.name + ' look',
        desc: '1 in 10 from the ' + C.WILD.animals[C.PLACES[id].dungeon.boss].name + '. Or ' + needShort(s, needs) + '.',
        buttons: [{ label: String(cg).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'G', color: has(s, needs) && s.gold >= cg ? GREEN : GREY, cb: function () {
          var r = L.buyCaveLook(s, id);
          if (r === 'short') { sfx('nope'); return self.toast('You need ' + needText(s, needs) + '. They wait in ' + C.PLACES[id].dungeon.name + '.', 3200); }
          if (r === 'ok') sfx('fanfare');
          done(r, 'The ' + cl.name + ' look is yours! Wear it from Looks.');
        } }] });
    });
    // the Magma Bow, after the Gold Bow
    if (L.hasBow(s) && L.bowLevel(s) === m.level - 1) {
      rows.unshift({ icon: C.ICON.bow_4, name: m.name, desc: 'Range ' + C.WILD.bow.range[m.level] + '. Needs ' + needShort(s, m.needs) + '.',
        buttons: [{ label: m.gold + 'G', color: has(s, m.needs) ? GREEN : GREY, cb: function () {
          var r = L.makeMagmaBow(s);
          if (r === 'short') { sfx('nope'); return self.toast('You need ' + needText(s, m.needs) + '. Hunt in Bakunawa\'s Lair!', 3000); }
          if (r === 'ok') sfx('found');
          done(r, 'The Magma Bow! It shoots ' + C.WILD.bow.range[m.level] + ' tiles.');
        } }] });
    }
    // Haliya's Moon Bow, after the Magma Bow (owner, 8 Nov 2026): the Magma Bow, every cave's boss part, scales, Gold
    var mb = C.MOON_BOW;
    if (mb && L.hasBow(s) && L.bowLevel(s) === mb.level - 1) {
      var gold = String(mb.gold).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + 'G';
      rows.unshift({ icon: C.ICON.bow_5, name: mb.name, desc: 'Arrows go through to hit the one behind. Your Magma Bow, ' + needShort(s, mb.needs) + '.',
        buttons: [{ label: gold, color: has(s, mb.needs) && s.gold >= mb.gold ? GREEN : GREY, cb: function () {
          var r = L.makeMoonBow(s);
          if (r === 'short') { sfx('nope'); return self.toast('You need ' + needText(s, mb.needs) + '. Their bosses wait on floor 50 of each cave.', 3600); }
          if (r === 'ok') sfx('fanfare');
          done(r, "Haliya's Moon Bow! Each arrow goes through and hits the one behind.");
          // its tour, once (new features get one: owner, 4 Oct)
          if (r === 'ok' && !L.tipSeen(s, 'moonbow_tour') && !(window.gameHost && window.gameHost.quiet)) {
            L.takeTip(s, 'moonbow_tour');
            F.Host.save(s);
            self.time.delayedCall(700, function () { if (!F.ui) return; F.ui.closeAll(); F.ui.tour('moonbow'); }); // (over Kanor's list, which came back)
          }
        } }] });
    }
    return rows;
  };

  // ---------- the tour ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.lair = {
    title: "BAKUNAWA'S LAIR",
    steps: [
      {
        text: 'Under Magayon, floor after floor of lava caves. Fire creatures from the old stories live here.',
        draw: function (ui, sc, move) {
          var f = icon(ui, sc, 136, 60, C.ICON.santelmo_flame, 0.42);
          tw(ui, move, { targets: f, y: 50, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          words(ui, sc, 136, 112, 'Floor 1', 14, '#a8402a');
        },
      },
      {
        text: 'Clear every creature on a floor with your Bow, and the gate down opens.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 80, 66, C.ICON.bow, 0.34);
          var g = words(ui, sc, 196, 66, 'Gate open!', 15, '#2f5a22');
          if (move) { g.setAlpha(0); ui.tweens.add({ targets: g, alpha: 1, duration: 400, delay: 500, hold: 900, yoyo: true, repeat: -1 }); }
        },
      },
      {
        text: 'A Bungisngis guards every 10th floor. On floor 50 the Bakunawa rises, but only for two hunters or more.',
        draw: function (ui, sc, move) {
          var t = icon(ui, sc, 90, 66, C.ICON.bungisngis_tooth, 0.34), b = icon(ui, sc, 190, 66, C.ICON.bakunawa_scale, 0.36);
          tw(ui, move, { targets: [t, b], scale: '*=1.12', duration: 480, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Kanor makes the Magma Bow and the Fire Charm from Ember Shards and scales. The lift stops every 10 floors.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 70, 66, C.ICON.ember_shard, 0.3);
          var bow = icon(ui, sc, 150, 66, C.ICON.bow_4, 0.38);
          icon(ui, sc, 222, 66, C.ICON.gear_charm, 0.3);
          tw(ui, move, { targets: bow, angle: { from: -8, to: 8 }, duration: 500, yoyo: true, repeat: -1 });
        },
      },
    ],
  };
  // Haliya's Moon Bow (00-zzzzzzzzzzzz-moon.js): what it is, the Moon arrow, the shine friends see
  F.TOURS.moonbow = {
    title: "HALIYA'S MOON BOW",
    steps: [
      {
        text: 'Haliya keeps the moon safe from the Bakunawa. Her bow is yours now: it shoots as far and hits as hard as the Magma Bow.',
        draw: function (ui, sc, move) {
          var b = icon(ui, sc, 136, 66, C.ICON.bow_5, 0.5);
          tw(ui, move, { targets: b, angle: 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
      {
        text: 'The Moon arrow: each arrow goes through the first creature it hits, and hits the one behind it too.',
        draw: function (ui, sc, move) {
          icon(ui, sc, 60, 66, C.ICON.bow_5, 0.3);
          icon(ui, sc, 150, 66, C.ICON.santelmo_flame, 0.32);
          icon(ui, sc, 220, 66, C.ICON.santelmo_flame, 0.32);
          var a = ui.add.rectangle(84, 66, 34, 6, C.MOON_BOW.shine);
          sc.add(a);
          tw(ui, move, { targets: a, x: 250, duration: 900, repeat: -1, repeatDelay: 300 });
        },
      },
      {
        text: 'It shines with moonlight when you draw it, and your friends see your silver arrows fly. Hunt deep: the bosses wait on floor 50.',
        draw: function (ui, sc, move) {
          var g = ui.add.circle(136, 66, 46, C.MOON_BOW.shine, 0.35);
          sc.add(g);
          icon(ui, sc, 136, 66, C.ICON.bow_5, 0.42);
          tw(ui, move, { targets: g, scale: 1.25, alpha: 0.15, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
        },
      },
    ],
  };

  var create = P.create;
  P.create = function () {
    create.call(this);
    var self = this, s = F.session && F.session.state;
    if (this.mapKey !== 'lair' || !s || F.session.visit || L.tipSeen(s, 'lair_tour') || (window.gameHost && window.gameHost.quiet)) return;
    var tries = 0, open = function () {
      if (!self.sys || !self.sys.isActive() || L.tipSeen(s, 'lair_tour')) return;
      if ((self.busy || !F.ui || F.ui.modals.length) && tries++ < 40) return self.time.delayedCall(1500, open);
      L.takeTip(s, 'lair_tour');
      F.Host.save(s);
      F.ui.tour('lair');
    };
    this.time.delayedCall(1600, open);
  };
})(window.Farm = window.Farm || {});
