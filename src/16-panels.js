// The UI's bigger panels: the morning report, pause menu, bag, shops and town buildings, the kitchen,
// festivals, the calendar and the friends list. Mixed into UIScene.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var K = F.UI_CONST, W = K.W, INK = K.INK, COL = K.COL, SLOT = K.SLOT, ICON = K.ICON;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9, BROWN = 0x9a7a4a, GREY = 0xa08a68, RED = 0xc0503a;
  var ROW_H = 74, ROW_STEP = 80;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var world = function () { return F.world; };

  var M = {};

  // ---------- a generic list panel: title, a line of info, tabs, and rows with buttons ----------
  // o: { title, sub(): string, tabs: [[key, label]], tab, reopen(tab, page), rows: [row], page, talk: villager key }
  // row: { icon | people, name, desc, buttons: [{ label, cb, color }] } (at most two buttons, stacked)
  M.listPanel = function (o) {
    var self = this, c = this.openModal();
    this.panelImg(c, 12, 66, W - 24, 540);
    c.add(this.txt(W / 2, 82, o.title, 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 96, 46, 34, 'X', function () { self.closeModal(); }, RED);
    if (o.talk) {
      this.button(c, 50, 96, 56, 34, 'Talk', function () {
        var r = L.talk(F.session.state, o.talk);
        if (r.first) world().progress('meet');
        sfx('talk');
        world().changed();
        self.say(o.talk, C.VILLAGERS[o.talk].name, r.line);
      }, BLUE);
    }
    var sub = this.txt(W / 2, 114, '', 13, INK, { align: 'center', wordWrap: { width: 300 } }).setOrigin(0.5, 0);
    c.add(sub);
    var showSub = function () { sub.setText(o.sub ? o.sub() : ''); };
    showSub();
    o.refresh = showSub;
    var y0 = 146;
    if (o.tabs) {
      var tw = Math.min(136, Math.floor(300 / o.tabs.length) - 8);
      o.tabs.forEach(function (t, k) {
        var x = W / 2 + (k - (o.tabs.length - 1) / 2) * (tw + 8);
        self.button(c, x, 162, tw, 34, t[1], function () {
          if (t[0] === o.tab) return;
          self.closeModal();
          o.reopen(t[0], 0);
        }, t[0] === o.tab ? GREEN : GREY);
      });
      y0 = 186;
    }
    var rows = o.rows, page = o.page || 0, per = rows.length > 5 ? 4 : 5;
    var pages = Math.max(1, Math.ceil(rows.length / per));
    rows.slice(page * per, page * per + per).forEach(function (row, i) { self.listRow(c, y0 + i * ROW_STEP, row); });
    if (!rows.length && o.empty) c.add(this.txt(W / 2, y0 + 50, o.empty, 15, INK, { align: 'center', lineSpacing: 4, wordWrap: { width: 280 } }).setOrigin(0.5, 0));
    if (pages > 1) {
      var ny = y0 + per * ROW_STEP + 18;
      c.add(this.txt(W / 2, ny, (page + 1) + ' / ' + pages, 15, INK, { fontStyle: 'bold' }).setOrigin(0.5));
      if (page > 0) this.button(c, W / 2 - 90, ny, 90, 34, 'Back', function () { self.closeModal(); o.reopen(o.tab, page - 1); }, GREY);
      if (page < pages - 1) this.button(c, W / 2 + 90, ny, 90, 34, 'More', function () { self.closeModal(); o.reopen(o.tab, page + 1); }, BLUE);
    }
    return o;
  };

  M.listRow = function (c, y, row) {
    var self = this;
    this.baked(c, 28, y, 'ui-row', W - 56, ROW_H, function (g) { g.fillStyle(0xe8cf98, 1).fillRoundedRect(0, 0, W - 56, ROW_H, 10); });
    c.add(this.add.image(34, y + 13, this.slotTex('plain')).setOrigin(0).setScale(1 / F.R));
    if (row.people) {
      F.ensureTexture(this, 'people');
      c.add(this.add.image(36 + SLOT / 2, y + 15 + SLOT - 2, 'people', C.VILLAGER_ORDER.indexOf(row.people) * 9).setOrigin(0.5, 1).setScale(0.3).setCrop(0, 0, 128, 150));
    } else if (row.icon != null) {
      c.add(this.add.image(36 + SLOT / 2, y + 15 + SLOT / 2, 'items', row.icon).setScale(ICON));
    }
    c.add(this.txt(88, y + 7, row.name, 14, INK, { fontStyle: 'bold', wordWrap: { width: 138 } }));
    c.add(this.txt(88, y + 26, row.desc || '', 11, '#6a4a2a', { wordWrap: { width: 138 }, lineSpacing: 1 }));
    var b = row.buttons || [];
    b.forEach(function (btn, k) {
      var by = b.length === 1 ? y + ROW_H / 2 : y + 20 + k * 34;
      self.button(c, W - 82, by, 100, 30, btn.label, btn.cb, btn.color || GREEN);
    });
  };

  // ---------- morning report ----------
  M.dayReport = function (result, s) {
    var lines = [], names = function (keys) { return keys.map(function (k) { return C.VILLAGERS[k].name; }).join(' and '); };
    if (result.passedOut) lines.push('You stayed up too late and passed out. You only got half your energy back.');
    if (result.wedding) lines.push('Today you married ' + C.VILLAGERS[result.wedding].name + '! The whole town came to celebrate. Your spouse now lives with you on the farm.');
    if (result.newSeason) {
      var seeds = L.seedsInSeason(s.day).filter(function (id) { return id !== 'seed_grass'; });
      lines.push(result.newSeason + ' has arrived! ' + (seeds.length
        ? 'Lily now sells ' + seeds.map(function (id) { return C.ITEMS[C.ITEMS[id].crop].name.toLowerCase(); }).join(' and ') + ' seeds.'
        : 'Nothing grows in winter, so look after your animals and visit the mine.') +
        (result.withered ? ' ' + result.withered + (result.withered > 1 ? ' crops' : ' crop') + ' from last season withered.' : '') +
        (result.weeds ? ' Weeds sprouted in your field.' : ''));
    }
    if (result.festival) lines.push('Today is the ' + result.festival.name + '! ' + result.festival.desc + ' (Town plaza, ' + L.formatTime(result.festival.from) + ' to ' + L.formatTime(result.festival.to) + '.)');
    if (result.birthdays && result.birthdays.length) lines.push("It's " + names(result.birthdays) + "'s birthday. A gift today counts double!");
    var w = C.WEATHER[result.weather];
    lines.push('Weather: ' + w.name + '.' + (w.waters ? ' The rain watered your crops.' : ''));
    if (result.built) lines.push('Mira finished your ' + C.BUILDS[result.built].name + '!');
    (result.born || []).forEach(function (i) {
      var a = s.animals[i];
      lines.push(a.kind === 'chicken' ? 'A chick hatched! Say hello to ' + a.name + '.' : 'A calf was born! Say hello to ' + a.name + '.');
    });
    if (result.shipped.length) {
      var n = result.shipped.reduce(function (sum, b) { return sum + b.n; }, 0);
      lines.push('You shipped ' + n + (n > 1 ? ' items' : ' item') + ' and earned ' + result.earned + 'G!');
    }
    var made = Object.keys(result.produced || {}).map(function (id) { return result.produced[id] + ' ' + C.ITEMS[id].name; });
    if (made.length) lines.push('Your animals made ' + made.join(', ') + '. Collect them in the pen.');
    if (result.hungry && result.hungry.length) lines.push(result.hungry.join(', ') + (result.hungry.length > 1 ? ' were' : ' was') + ' hungry yesterday.');
    if (result.lunch && s.spouse) lines.push(C.VILLAGERS[s.spouse].name + ' packed you a ' + C.ITEMS[result.lunch].name + ' for lunch.');
    if (result.horse) lines.push('The stable is done, and ' + s.horse.name + ' the horse is waiting there! Walk up to ride.');
    if (result.mail) lines.push('You have ' + (result.mail > 1 ? result.mail + ' new letters' : 'a new letter') + ' in the mailbox by the house.');
    if (result.goalDone) lines.push('Goal complete! Check the next one at the top of the screen.');
    this.dialog('GOOD MORNING! ' + L.formatDate(s.day).toUpperCase() + '\n' + lines.join('\n\n'));
    sfx('morning');
  };

  // ---------- pause menu ----------
  M.openPause = function () {
    var self = this, s = F.session.state;
    var c = this.openModal();
    this.panelImg(c, 30, 96, W - 60, 470);
    c.add(this.txt(W / 2, 118, 'Paused', 22, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    c.add(this.txt(W / 2, 150, L.formatDate(s.day) + ', Year ' + L.date(s.day).year + '  ' + L.formatTime(s.time) + '\nYour game saves automatically.', 14, INK, { align: 'center' }).setOrigin(0.5, 0));
    var col = function (k) { return W / 2 + (k ? 68 : -68); };
    this.button(c, W / 2, 222, 266, 44, 'Resume', function () { self.closeModal(); });
    this.button(c, col(0), 274, 128, 40, 'Calendar', function () { self.openCalendar(0); }, BLUE);
    this.button(c, col(1), 274, 128, 40, 'Friends', function () { self.openFriends(); }, BLUE);
    this.button(c, col(0), 322, 128, 40, 'How to play', function () { self.help(); }, BLUE);
    this.button(c, col(1), 322, 128, 40, 'Save now', function () { world().save(); self.toast('Game saved.'); }, BROWN);
    var toggle = function (key, label) {
      return label + (s.opts[key] ? ': on' : ': off');
    };
    this.button(c, col(0), 370, 128, 40, toggle('music', 'Music'), function () {
      s.opts.music = s.opts.music ? 0 : 1;
      if (F.Audio) F.Audio.apply(s.opts);
      F.session.dirty = true;
      self.closeModal();
      self.openPause();
    }, BROWN);
    this.button(c, col(1), 370, 128, 40, toggle('sfx', 'Sounds'), function () {
      s.opts.sfx = s.opts.sfx ? 0 : 1;
      if (F.Audio) F.Audio.apply(s.opts);
      F.session.dirty = true;
      self.closeModal();
      self.openPause();
    }, BROWN);
    this.button(c, col(0), 418, 128, 40, this.fpsText.visible ? 'Hide FPS' : 'Show FPS', function () {
      F.showFps = !self.fpsText.visible;
      self.fpsText.setVisible(F.showFps);
      self.closeModal();
    }, BROWN);
    this.button(c, col(1), 418, 128, 40, 'Collection', function () { self.openCollection(); }, BLUE);
    this.button(c, W / 2, 510, 200, 42, 'New game', function () {
      self.confirm('START A NEW FARM?\nYour current farm, gold, crops, animals and friendships will be gone for good.', function () {
        self.newGame();
      });
    }, RED);
  };

  // Replaces the save with a fresh farm and restarts both scenes on it.
  M.newGame = function () {
    F.session = F.newSession(null);
    F.Host.save(F.session.state);
    F.input.reset();
    F.ui = null; // the world idles until the new UI scene is up
    world().scene.restart();
    this.scene.restart();
  };

  // ---------- the bag ----------
  M.openInventory = function () {
    var self = this, s = F.session.state;
    var c = this.openModal();
    this.panelImg(c, 14, 104, W - 28, 430);
    c.add(this.txt(W / 2, 122, 'Bag', 21, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    var cols = 6, gap = 6, x0 = (W - (cols * SLOT + (cols - 1) * gap)) / 2, y0 = 160;
    var widgets = [];
    var name = this.txt(W / 2, 318, '', 16, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0);
    var desc = this.txt(W / 2, 342, '', 13, INK, { align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5, 0);
    var mats = this.txt(W / 2, 404, '', 13, '#5a3a1e', { align: 'center', fontStyle: 'bold' }).setOrigin(0.5, 0);
    var note = this.txt(W / 2, 428, 'Tap an item to hold it. The first row is your hotbar.', 12, '#7a5a3a', { align: 'center', wordWrap: { width: 280 } }).setOrigin(0.5, 0);
    c.add([name, desc, mats, note]);
    for (var i = 0; i < C.INV_SIZE; i++) {
      (function (i) {
        var x = x0 + (i % cols) * (SLOT + gap), y = y0 + Math.floor(i / cols) * (SLOT + gap);
        widgets.push(self.slotWidget(c, x, y, function () {
          if (s.sel === i && s.inv[i]) { self.closeModal(); return; }
          s.sel = i;
          F.session.dirty = true;
          world().hintKey = null;
          self.refresh();
        }));
      })(i);
    }
    var eatBtn = this.button(c, W / 2 - 64, 488, 110, 42, 'Eat', function () {
      world().eat();
      self.refresh();
    }, BLUE);
    this.button(c, W / 2 + 64, 488, 110, 42, 'Close', function () { self.closeModal(); });
    this.invRefresh = function () {
      widgets.forEach(function (w, i) { self.drawSlot(w, s.inv[i], s.sel === i); });
      var held = L.held(s);
      name.setText(held ? L.itemName(s, held.id) + (held.n > 1 ? '  x' + held.n : '') : 'Empty hands');
      var d = held ? C.ITEMS[held.id].desc : 'Choose something to hold.';
      if (held && L.energyOf(held.id)) d += ' (+' + L.energyOf(held.id) + ' energy)';
      if (held && C.ITEMS[held.id].sell) d += ' Sells for ' + C.ITEMS[held.id].sell + 'G.';
      desc.setText(d);
      mats.setText('Lumber ' + s.lumber + '     Stone ' + s.stone);
      eatBtn.setVisible(!!held && L.energyOf(held.id) > 0);
    };
    this.invRefresh();
  };

  // ---------- Lily's seed stand ----------
  M.buyButtons = function (id, qtys, after) {
    var self = this, s = F.session.state, item = C.ITEMS[id];
    return qtys.map(function (qty, k) {
      return {
        label: (qty > 1 ? 'Buy ' + qty : 'Buy') + ' ' + item.price * qty + 'G', color: k ? BLUE : GREEN,
        cb: function () {
          if (item.kind === 'tool' && L.hasItem(s, id)) return self.toast('You already have a ' + item.name + '.');
          var r = L.buy(s, id, qty);
          if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
          if (r === 'full') return self.toast('Your bag is full.');
          sfx('coin');
          self.toast('Bought ' + qty + ' ' + item.name + '.');
          world().changed();
          world().save();
          if (after) after();
        },
      };
    });
  };

  M.openShop = function (tab, page) {
    var self = this, s = F.session.state, o;
    tab = tab || 'seeds';
    var rows = [];
    var itemRow = function (id, qtys) {
      var item = C.ITEMS[id];
      return { icon: item.icon, name: item.name, desc: item.shop || item.desc, buttons: self.buyButtons(id, qtys, function () { o.refresh(); }) };
    };
    if (tab === 'seeds') {
      L.seedsInSeason(s.day).forEach(function (id) { rows.push(itemRow(id, [1, 5])); });
    } else if (tab === 'animals') {
      C.SHOP_ANIMALS.forEach(function (kind) {
        var def = C.ANIMALS[kind];
        rows.push({
          icon: def.icon, name: def.name + ' ' + L.animalCount(s, kind) + '/' + L.capacity(s, kind), desc: def.shop,
          buttons: [{
            label: 'Buy ' + def.price + 'G', cb: function () {
              var r = L.buyAnimal(s, kind);
              if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
              if (r === 'full') return self.toast('The ' + def.home + ' is full. Mira can build a bigger one.');
              if (world().herd) world().herd.add(r);
              sfx('coin');
              world().changed();
              world().save();
              self.closeModal();
              self.openShop('animals');
              self.toast('Meet ' + s.animals[r].name + '! Your new ' + def.name.toLowerCase() + ' is in the pen.');
            },
          }],
        });
      });
      C.SHOP_FEED.forEach(function (id) { rows.push(itemRow(id, [1, 5])); });
    } else {
      C.SHOP_SUPPLIES.forEach(function (id) { rows.push(itemRow(id, [1])); });
    }
    o = this.listPanel({
      title: "Lily's Seed Stand", tab: tab, page: page,
      tabs: [['seeds', 'Seeds'], ['animals', 'Animals'], ['supplies', 'Supplies']],
      sub: function () { return 'You have ' + s.gold + 'G'; },
      rows: rows, reopen: this.openShop.bind(this), talk: 'lily',
      empty: 'LILY: Nothing grows in winter!\nCome back in spring for seeds.\nMeanwhile, see the Animals tab for feed.',
    });
  };

  // ---------- town buildings ----------
  M.openBuilding = function (key) {
    var s = F.session.state, b = C.BUILDINGS[key];
    var ownerInside = C.VILLAGER_ORDER.filter(function (k) { return L.villagerAt(s, k, s.time) === 'in:' + key; })[0];
    if (!b.open) { // a home
      if (ownerInside) {
        var r = L.talk(s, ownerInside);
        sfx('door');
        world().changed();
        return this.say(ownerInside, C.VILLAGERS[ownerInside].name, '(You knock, and the door opens.)\n' + r.line);
      }
      return this.dialog(b.name.toUpperCase() + '\nYou knock, but nobody is home.');
    }
    if (!L.buildingOpen(s, key)) {
      var fest = L.festivalOn(s.day);
      return this.dialog(b.name.toUpperCase() + '\n' + (fest ? 'Closed today: everyone is at the ' + fest.name + ' in the plaza.'
        : 'Closed. Open ' + L.formatTime(b.open[0]) + ' to ' + L.formatTime(b.open[1]) + '.'));
    }
    sfx('door');
    if (key === 'forge') return this.openForge();
    if (key === 'woodshop') return this.openWoodshop('build');
    if (key === 'inn') return this.openFoodShop('inn');
    if (key === 'clinic') return this.openFoodShop('clinic');
    if (key === 'mayor') return this.mayorTalk();
  };

  M.mayorTalk = function () {
    var s = F.session.state, r = L.talk(s, 'hollis'), next = this.upcoming(s.day, 60).filter(function (e) { return e.fest; })[0];
    world().changed();
    this.say('hollis', 'Mayor Hollis', r.line + (next ? '\n\n"Our next festival is the ' + next.fest.name + ' on ' + L.formatDate(next.day) + '. ' + next.fest.desc + '"' : ''));
  };

  M.openForge = function () {
    var self = this, s = F.session.state, o;
    var rows = C.TOOL_KEYS.map(function (tool) {
      var cost = L.upgradeCost(s, tool), next = L.toolLevel(s, tool) + 1;
      return {
        icon: L.iconOf(s, tool), name: L.itemName(s, tool),
        desc: cost ? 'To ' + C.TOOL_LEVELS[next] + ': ' + cost.gold + 'G and ' + cost.n + ' ' + C.ITEMS[cost.ore].name + '.' : 'Fully upgraded!',
        buttons: cost ? [{
          label: 'Upgrade', cb: function () {
            var r = L.upgradeTool(s, tool);
            if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
            if (r === 'ore') { sfx('nope'); return self.toast('You need ' + cost.n + ' ' + C.ITEMS[cost.ore].name + '. Find ore in the mine.'); }
            sfx('anvil');
            world().changed();
            world().save();
            self.closeModal();
            self.openForge();
            self.toast('Clang! Bram made you a ' + L.itemName(s, tool) + '. Hold the action button to charge it.');
          },
        }] : [],
      };
    });
    o = this.listPanel({
      title: "Bram's Forge", rows: rows, talk: 'bram', reopen: function () { self.openForge(); },
      sub: function () {
        return s.gold + 'G   Ore: ' + ['ore_copper', 'ore_silver', 'ore_gold'].map(function (id) { return L.countItem(s, id) + ' ' + C.ITEMS[id].name.split(' ')[0]; }).join(', ');
      },
    });
  };

  M.openWoodshop = function (tab, page) {
    var self = this, s = F.session.state, o, rows;
    tab = tab || 'build';
    if (tab === 'build') {
      rows = C.BUILD_KEYS.filter(function (id) { return C.BUILDS[id]; }).map(function (id) {
        var b = C.BUILDS[id], building = s.project && s.project.id === id;
        var cost = b.gold + 'G, ' + b.lumber + ' lumber' + (b.stone ? ', ' + b.stone + ' stone' : '');
        return {
          icon: { kitchen: C.ICON.lunch, bighouse: C.ICON.ring, coop2: C.ICON.chicken, barn2: C.ICON.cow, stable: C.ICON.horse }[id],
          name: b.name, desc: s.builds[id] ? 'Built!' : building ? 'Mira is building it. Ready tomorrow.' : cost + '. ' + b.desc,
          buttons: s.builds[id] || building ? [] : [{
            label: 'Build', cb: function () {
              var r = L.startBuild(s, id);
              var why = { busy: 'Mira is busy with another job. One at a time!', gold: 'Not enough gold.', lumber: 'You need ' + b.lumber + ' lumber. Chop branches and stumps, or buy some.', stone: 'You need ' + b.stone + ' stone.' };
              if (r !== 'ok') { sfx('nope'); return self.toast(why[r] || 'Hmm.'); }
              sfx('hammer');
              world().changed();
              world().save();
              self.closeModal();
              self.openWoodshop('build');
              self.say('mira', 'Mira', "Deal! I'll have your " + b.name + ' ready by tomorrow morning.');
            },
          }],
        };
      });
    } else if (tab === 'furniture') {
      rows = C.FURNITURE_KEYS.map(function (id) {
        var f = C.FURNITURE[id];
        return {
          icon: f.icon, name: f.name, desc: s.builds[id] ? 'In your house!' : f.gold + 'G. ' + f.desc,
          buttons: s.builds[id] ? [] : [{
            label: 'Buy ' + f.gold + 'G', cb: function () {
              var r = L.buyFurniture(s, id);
              if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
              if (r !== 'ok') return;
              sfx('coin');
              world().changed();
              world().save();
              self.closeModal();
              self.openWoodshop('furniture');
              self.toast(id === 'f_cat' ? 'A cat named ' + s.cat.name + ' moved into your house!' : 'Mira delivered the ' + f.name + ' to your house!');
            },
          }],
        };
      });
    } else {
      rows = [['lumber', C.LUMBER_PRICE], ['stone', C.STONE_PRICE]].map(function (m) {
        return {
          icon: C.ICON[m[0]], name: m[0] === 'lumber' ? 'Lumber' : 'Stone', desc: m[1] + 'G each. For building.',
          buttons: [1, 10].map(function (n, k) {
            return {
              label: 'Buy ' + n + ' ' + m[1] * n + 'G', color: k ? BLUE : GREEN, cb: function () {
                if (L.buyMaterial(s, m[0], n) !== 'ok') { sfx('nope'); return self.toast('Not enough gold.'); }
                sfx('coin');
                o.refresh();
                world().changed();
              },
            };
          }),
        };
      });
    }
    o = this.listPanel({
      title: "Mira's Woodshop", tab: tab, page: page, rows: rows, talk: 'mira', reopen: this.openWoodshop.bind(this),
      tabs: [['build', 'Build'], ['furniture', 'Furniture'], ['materials', 'Materials']],
      sub: function () { return s.gold + 'G   Lumber ' + s.lumber + '   Stone ' + s.stone; },
    });
  };

  // The inn (Rosa's meals) and the clinic (Ivy's tonic): eat it here, or take it with you.
  M.openFoodShop = function (key) {
    var self = this, s = F.session.state, o, inn = key === 'inn';
    var rows = (inn ? C.INN_MENU : C.CLINIC_MENU).map(function (id) {
      var item = C.ITEMS[id];
      return {
        icon: item.icon, name: item.name, desc: item.desc + ' +' + item.energy + ' energy.',
        buttons: [{
          label: (inn ? 'Eat ' : 'Drink ') + item.price + 'G', cb: function () {
            if (s.energy >= C.MAX_ENERGY) return self.toast("You're already full of energy.");
            if (s.gold < item.price) { sfx('nope'); return self.toast('Not enough gold.'); }
            s.gold -= item.price;
            s.energy = Math.min(C.MAX_ENERGY, s.energy + item.energy);
            sfx('eat');
            o.refresh();
            world().changed();
            self.toast('Delicious! +' + item.energy + ' energy.');
          },
        }].concat(self.buyButtons(id, [1], function () { o.refresh(); }).map(function (b) { b.label = 'Take ' + item.price + 'G'; b.color = BLUE; return b; })),
      };
    });
    o = this.listPanel({
      title: inn ? 'Sunny Inn' : "Ivy's Clinic", rows: rows, talk: inn ? 'rosa' : 'ivy', reopen: function () { self.openFoodShop(key); },
      sub: function () { return s.gold + 'G   Energy ' + s.energy + '/' + C.MAX_ENERGY + (inn ? '' : '\nIvy: "Rest well and eat well, farmer!"'); },
    });
  };

  // ---------- the kitchen ----------
  M.openKitchen = function (tab, page) {
    var self = this, s = F.session.state;
    var rows = C.RECIPES.map(function (r) {
      var dish = C.ITEMS[r.dish], ok = L.hasIngredients(s, r);
      return {
        icon: dish.icon, name: dish.name, desc: 'Needs ' + r.needs.map(L.ingredientName).join(' + ') + '. +' + dish.energy + ' energy.',
        buttons: [{
          label: 'Cook', color: ok ? GREEN : GREY, cb: function () {
            var res = L.cook(s, r);
            if (res === 'missing') { sfx('nope'); return self.toast('You need ' + r.needs.map(L.ingredientName).join(' + ') + '.'); }
            if (res === 'full') return self.toast('Your bag is full.');
            sfx('cook');
            world().changed();
            self.closeModal();
            self.openKitchen(null, page);
            self.toast('You cooked ' + dish.name + '!');
          },
        }],
      };
    });
    this.listPanel({
      title: 'Kitchen', rows: rows, page: page, reopen: this.openKitchen.bind(this),
      sub: function () { return 'Dishes restore lots of energy. Eat them from your bag.'; },
    });
  };

  // ---------- festivals ----------
  M.openFestival = function (fest, page) {
    var self = this, s = F.session.state;
    if (L.joinedFestival(s, fest)) return this.say('hollis', 'Mayor Hollis', 'Thank you for joining the ' + fest.name + '! Enjoy the rest of the day.');
    var finish = function (r) {
      if (r.error) {
        var why = { nocrop: 'Hold on, that is not a crop!', nocow: 'You need a grown cow to enter the Cow Festival.', choice: 'Hmm?' };
        return self.toast(why[r.error] || 'Hmm.');
      }
      sfx('fanfare');
      self.closeAll();
      self.fireworks(fest.key === 'flower' ? 'petals' : fest.key === 'starry' ? 'stars' : 'fireworks');
      s.time = Math.max(s.time, fest.to - 10);
      world().changed();
      world().save();
      self.dialog(fest.name.toUpperCase() + '\n' + r.text);
    };
    // the judging, with a drumroll
    var judged = function (intro, play) {
      self.closeAll();
      self.playLines([['hollis', intro]], function () {
        sfx('drumroll');
        self.dialog('...', [{ label: 'And the winner is...', cb: function () { finish(play()); } }]);
      });
    };
    if (fest.kind === 'cow') {
      var cows = s.animals.filter(function (a) { return a.kind === 'cow' && !a.young; });
      if (!cows.length) return this.say('hollis', 'Mayor Hollis', 'Welcome to the Cow Festival! Bring a grown cow next year and enter the contest.');
      var best = cows.reduce(function (a, b) { return b.love > a.love ? b : a; });
      return this.dialog('THE COW FESTIVAL\nYour happiest cow, ' + best.name + ', will compete for the blue ribbon. Ready?', [{ label: 'Not yet', color: GREY }, {
        label: 'Enter', cb: function () {
          judged('Here comes ' + best.name + ' from Sunny Acres! What a shiny coat. The judges are taking notes...', function () { return L.joinFestival(s, fest); });
        },
      }]);
    }
    // a dance (a rhythm mini-game) or an evening together
    var withPartner = function (k) {
      self.closeAll();
      if (fest.kind === 'dance') {
        self.startDance(k, function (score) { finish(L.joinFestival(s, fest, k, score)); });
        return;
      }
      self.fireworks(fest.key === 'starry' ? 'stars' : 'fireworks');
      var lines = fest.key === 'starry'
        ? [[k, 'So many stars tonight... Quick, make a wish!'], [k, 'I already know what mine is. Maybe someday I will tell you.']]
        : [[k, 'Ooh! Look at that one! It is like a flower blooming in the sky.'], [k, 'I am really glad I am watching this with you.']];
      self.playLines(lines, function () { finish(L.joinFestival(s, fest, k)); });
    };
    var rows;
    if (fest.kind === 'harvest') {
      var seen = {};
      rows = [];
      s.inv.forEach(function (slot, i) {
        if (!slot || C.ITEMS[slot.id].kind !== 'crop' || seen[slot.id]) return;
        seen[slot.id] = 1;
        rows.push({ icon: C.ITEMS[slot.id].icon, name: C.ITEMS[slot.id].name, desc: 'Sells for ' + C.ITEMS[slot.id].sell + 'G.', buttons: [{
          label: 'Enter', cb: function () {
            judged('Our next entry: a ' + C.ITEMS[slot.id].name + ' from Sunny Acres! The judges take a bite...', function () { return L.joinFestival(s, fest, i); });
          },
        }] });
      });
    } else {
      rows = C.VILLAGER_ORDER.filter(function (k) { return k !== 'hollis' && L.friend(s, k).met; }).map(function (k) {
        return {
          people: k, name: C.VILLAGERS[k].name, desc: L.friendHearts(s, k) + ' hearts',
          buttons: [{ label: fest.kind === 'dance' ? 'Dance' : 'Invite', cb: function () { withPartner(k); } }],
        };
      });
    }
    this.listPanel({
      title: fest.name, rows: rows, page: page, reopen: function (t, p) { self.openFestival(fest, p); },
      sub: function () { return fest.desc; },
      empty: fest.kind === 'harvest' ? 'Bring a crop in your bag to enter!' : 'Make some friends in town first!',
    });
  };

  // Celebration particles over the whole screen for a few seconds.
  M.fireworks = function (kind) {
    var self = this, tex = this.bake('ui-spark', 10, 10, function (g) { g.fillStyle(0xffffff, 1).fillCircle(5, 5, 5); });
    var colors = kind === 'stars' ? [0xfff6c0, 0xbfe0ff] : kind === 'petals' ? [0xffb3d1, 0xfff0f6, 0xffd23f] : [0xff5a5a, 0xffd23f, 0x6ad1ff, 0x9cff6a, 0xff8ae0];
    var n = 0;
    var timer = this.time.addEvent({
      delay: 420, repeat: 9, callback: function () {
        var x = Phaser.Math.Between(60, W - 60), y = Phaser.Math.Between(110, 330);
        var p = self.add.particles(x, y, tex, {
          speed: kind === 'fireworks' ? { min: 60, max: 170 } : { min: 15, max: 60 }, lifespan: 1100, scale: { start: 0.9 / F.R * 2, end: 0 },
          tint: colors[n++ % colors.length], gravityY: kind === 'fireworks' ? 120 : 30, emitting: false,
        }).setDepth(260);
        p.explode(kind === 'fireworks' ? 36 : 14);
        if (kind === 'fireworks') sfx('boom');
        self.time.delayedCall(1300, function () { p.destroy(); });
      },
    });
    return timer;
  };

  // ---------- calendar, notice board, friends ----------
  // Festivals and birthdays in the next `days` days (including today).
  M.upcoming = function (from, days) {
    var out = [];
    for (var d = from; d < from + days; d++) {
      var fest = L.festivalOn(d);
      if (fest) out.push({ day: d, fest: fest });
      L.birthdaysOn(d).forEach(function (k) { out.push({ day: d, birthday: k }); });
    }
    return out;
  };

  M.noticeBoard = function () {
    var s = F.session.state, events = this.upcoming(s.day, 14);
    var lines = events.map(function (e) {
      return (e.day === s.day ? 'TODAY' : L.formatDate(e.day)) + ': ' + (e.fest ? e.fest.name + ' (plaza)' : C.VILLAGERS[e.birthday].name + "'s birthday");
    });
    this.dialog('TOWN NOTICE BOARD\n' + (lines.length ? lines.join('\n') : 'Nothing planned in the next two weeks.') + '\n\nThe calendar in the pause menu shows the whole season.');
  };

  M.openCalendar = function (offset) {
    var self = this, s = F.session.state, n = C.DAYS_PER_SEASON;
    var first = Math.floor((s.day - 1) / n) * n + 1 + offset * n, d0 = L.date(first);
    var c = this.openModal();
    this.panelImg(c, 12, 70, W - 24, 520);
    c.add(this.txt(W / 2, 88, d0.name + ', Year ' + d0.year, 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 100, 46, 34, 'X', function () { self.closeModal(); }, RED);
    var cw = 44, ch = 50, x0 = (W - 7 * cw) / 2, y0 = 126;
    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach(function (name, k) {
      c.add(self.txt(x0 + k * cw + cw / 2, y0, name, 11, '#7a5a3a', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    });
    var events = [];
    for (var i = 0; i < n; i++) {
      var day = first + i, x = x0 + (i % 7) * cw, y = y0 + 18 + Math.floor(i / 7) * ch;
      var fest = L.festivalOn(day), bdays = L.birthdaysOn(day), today = day === s.day;
      this.baked(c, x + 2, y, today ? 'ui-cal-today' : day < s.day ? 'ui-cal-past' : 'ui-cal-day', cw - 4, ch - 4, (function (kind) {
        return function (g) {
          g.fillStyle(kind === 'today' ? 0xffd23f : kind === 'past' ? 0xd8bf8a : 0xe8cf98, 1).fillRoundedRect(0, 0, cw - 4, ch - 4, 6);
          if (kind === 'today') g.lineStyle(2, 0x5a3a1e, 1).strokeRoundedRect(1, 1, cw - 6, ch - 6, 6);
        };
      })(today ? 'today' : day < s.day ? 'past' : 'day'));
      c.add(this.txt(x + 7, y + 3, String(i + 1), 12, INK, { fontStyle: 'bold' }));
      if (fest) c.add(this.add.image(x + cw / 2 + 4, y + 30, 'items', C.ICON.ribbon).setScale(0.17));
      else if (bdays.length) c.add(this.add.image(x + cw / 2 + 4, y + 30, 'items', C.ICON.gift).setScale(0.17));
      else c.add(this.add.image(x + cw / 2 + 4, y + 30, 'items', C.WEATHER[day >= s.day && day <= s.day + 1 ? L.weather(s, day) : 'sunny'].icon).setScale(0.12).setAlpha(day >= s.day && day <= s.day + 1 ? 0.9 : 0));
      if (fest) events.push((i + 1) + '  ' + fest.name);
      bdays.forEach(function (k) { events.push((i + 1) + '  ' + C.VILLAGERS[k].name + "'s birthday"); });
    }
    c.add(this.txt(W / 2, y0 + 18 + 4 * ch + 10, events.join('\n') || 'No events this season.', 13, INK, { align: 'center', lineSpacing: 3 }).setOrigin(0.5, 0));
    if (offset > 0) this.button(c, W / 2 - 80, 556, 130, 38, 'This season', function () { self.closeModal(); self.openCalendar(offset - 1); }, GREY);
    if (offset < 3) this.button(c, W / 2 + 80, 556, 130, 38, 'Next season', function () { self.closeModal(); self.openCalendar(offset + 1); }, BLUE);
  };

  M.openCollection = function () {
    var self = this, s = F.session.state;
    var c = this.openModal();
    this.panelImg(c, 12, 70, W - 24, 530);
    c.add(this.txt(W / 2, 88, 'Collection', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 100, 46, 34, 'X', function () { self.closeModal(); }, RED);
    c.add(this.txt(W / 2, 116, L.collectionCount(s) + ' of ' + C.COLLECTION.length + ' found', 13, '#7a5a3a').setOrigin(0.5, 0));
    var cols = 7, cell = 44, x0 = (W - cols * cell) / 2, y0 = 140;
    C.COLLECTION.forEach(function (id, i) {
      var x = x0 + (i % cols) * cell, y = y0 + Math.floor(i / cols) * cell, got = L.discovered(s, id);
      self.baked(c, x + 2, y + 2, 'ui-colcell', cell - 4, cell - 4, function (g) { g.fillStyle(0xe8cf98, 1).fillRoundedRect(0, 0, cell - 4, cell - 4, 7); });
      var icon = self.add.image(x + cell / 2, y + cell / 2, 'items', C.ITEMS[id].icon).setScale(0.26);
      if (!got) icon.setTint(0x000000).setAlpha(0.22);
      c.add(icon);
    });
    var st = s.stats;
    c.add(this.txt(W / 2, y0 + 5 * cell + 18, 'RECORDS\nShipped: ' + st.earned + 'G\nFish caught: ' + st.fish + '\nDishes cooked: ' + st.cooked +
      '\nDeepest mine floor: ' + (st.deepest || '-') + '\nFriends with 5+ hearts: ' + C.VILLAGER_ORDER.filter(function (k) { return L.friendHearts(s, k) >= 5; }).length,
    14, INK, { align: 'center', lineSpacing: 4 }).setOrigin(0.5, 0));
  };

  M.openFriends = function () {
    var self = this, s = F.session.state;
    var c = this.openModal();
    this.panelImg(c, 12, 70, W - 24, 530);
    c.add(this.txt(W / 2, 88, 'Friends', 20, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
    this.button(c, W - 48, 100, 46, 34, 'X', function () { self.closeModal(); }, RED);
    F.ensureTexture(this, 'people');
    C.VILLAGER_ORDER.forEach(function (k, i) {
      var y = 124 + i * 64, f = L.friend(s, k), v = C.VILLAGERS[k];
      self.baked(c, 26, y, 'ui-friend-row', W - 52, 58, function (g) { g.fillStyle(0xe8cf98, 1).fillRoundedRect(0, 0, W - 52, 58, 9); });
      var face = self.add.image(56, y + 56, 'people', i * 9).setOrigin(0.5, 1).setScale(0.32).setCrop(0, 0, 128, 150);
      if (!f.met) face.setTint(0x333333);
      c.add(face);
      c.add(self.txt(86, y + 6, f.met ? v.name + (s.spouse === k ? '  (spouse)' : s.engaged && s.engaged.who === k ? '  (engaged)' : '') : '???', 14, INK, { fontStyle: 'bold' }));
      c.add(self.txt(86, y + 24, f.met ? v.role + (f.talked ? '  ✓ talked' : '') + (f.gifted ? '  ✓ gift' : '') : 'Not met yet', 11, '#7a5a3a'));
      if (f.met) c.add(self.heartsText(86, y + 38, L.friendHearts(s, k)));
    });
  };

  Object.assign(F.UIScene.prototype, M);
})(window.Farm = window.Farm || {});
