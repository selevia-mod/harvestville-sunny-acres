// Touch UI drawn over the world: HUD, joystick, action button, hotbar, and modal panels.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var W = C.WIDTH;
  var H = C.HEIGHT;
  var FONT = '"Trebuchet MS", "Segoe UI", Verdana, sans-serif';
  var INK = '#4a2c14';
  var COL = { panel: 0xf3e2b8, edge: 0x5a3a1e, inner: 0xc9a26b, slot: 0xe8cf98, slotEdge: 0x8a5a32, sel: 0xffd23f };
  var SLOT = 44;
  var GAP = 4;
  // the hotbar and the controls sit at the bottom of the screen, however tall (C.EXTRA)
  var HOTBAR_Y = 606 + C.EXTRA;
  var ACTION = { x: 294, y: 512 + C.EXTRA, r: 42 };
  // A button acts when the finger lifts on it only if the press also started on it: a finger that pressed something
  // else (the action button that opened this panel) and lifts here does nothing.
  var PANEL_BASE = 96; // the panel texture's own size, stretched to fit (panelImg)
  F.tapOn = function (z, fn) {
    z.on('pointerdown', function (p) { z.pressedBy = p.id; });
    z.on('pointerout', function () { z.pressedBy = null; });
    z.on('pointerup', function (p) {
      var mine = z.pressedBy === p.id;
      z.pressedBy = null;
      if (mine) fn.apply(this, arguments);
    });
    return z;
  };
  var JOY = { x: 86, y: 512 + C.EXTRA, r: 46, knob: 22 };
  // owner, 26 Oct: lighter, and fainter still while dragging, so the farm shows through it
  var JOY_ALPHA = { idle: 0.55, drag: 0.4 };
  var ICON = 32 / 128; // item icons are 128px; slots show them at 32 layout px

  var HELP = [
    'HOW TO PLAY\n' +
    'Drag anywhere to walk. Tap the big button to act on the highlighted tile. Hold it with an upgraded tool to work a whole patch.\n\n' +
    'Clear the field: Sickle for weeds, Axe for branches and stumps (lumber), Hammer for stones (stone).\n\n' +
    'Hoe the soil and plant a seed bag (it sows 3x3). Crops grow in real time, from 15 minutes to 2 days, once you water them (rain waters them too). ' +
    'Pick them when ripe: a crop left too long withers (clear it with the Hoe).',
    'SELLING AND ANIMALS\n' +
    'Sell crops, fish, ore and more at the market stall in the town plaza: right away, or on a shelf for more gold when a villager comes to buy it. The order board nearby has villagers\' requests that pay a bonus.\n\n' +
    'Feed animals once a day for eggs and milk (a Milker is needed for cows). Pet and brush them: happy animals give large produce.',
    'TOWN\n' +
    'Willowbrook is down the road south. Talk to people every day and give gifts to make friends.\n\n' +
    'Bram upgrades tools, Mira builds (kitchen, bigger house, coop, barn), Rosa feeds you, Ivy sells tonics. ' +
    'The mine east of town has ore. Fish at the river or the pond.',
    'TIME, SEASONS AND FESTIVALS\n' +
    'The game follows your phone\'s clock and date. A new day starts at midnight. Energy comes back by itself, 1 point every ' + C.ENERGY_EVERY + ' minutes: tap the energy bar to see when it is full.\n\n' +
    'Seasons follow the months (Spring Mar-May, Summer Jun-Aug, Fall Sep-Nov, Winter Dec-Feb), each with 10 crops. ' +
    'Festivals and birthdays are on the same dates for every player: check the calendar, where you can set your own birthday too. With 8 hearts, the House Extension and a Blue Feather, you can propose.\n\n' +
    'Online, friends can pick your ripe crops so none go to waste: they wait in the Harvest Basket by your mailbox.',
  ];

  // Canvas 2D drawing helpers for baked UI art.
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.roundRect(x, y, w, h, r);
  }
  function circle(g, x, y, r) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
  }
  function vgrad(g, y0, y1, top, bottom) {
    var gr = g.createLinearGradient(0, y0, 0, y1);
    gr.addColorStop(0, top);
    gr.addColorStop(1, bottom);
    return gr;
  }
  // A colour (0xRRGGBB) made lighter (amount > 0) or darker (< 0), as a CSS string.
  function shade(color, amount) {
    var c = [color >> 16 & 255, color >> 8 & 255, color & 255].map(function (v) {
      return Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
    });
    return 'rgb(' + c.join(',') + ')';
  }
  function card(g, x, y, w, h) {
    rrect(g, x, y, w, h, 9);
    g.fillStyle = vgrad(g, y, y + h, '#fffbee', '#f6e6c0');
    g.fill();
    g.lineWidth = 1.5;
    g.strokeStyle = '#d4b07a';
    g.stroke();
  }

  function style(size, color, extra) {
    var s = { fontFamily: FONT, fontSize: size + 'px', color: color || '#ffffff', resolution: F.R };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  }

  F.UI_CONST = { W: W, H: H, INK: INK, COL: COL, SLOT: SLOT, ICON: ICON };
  F.UI_DRAW = { rrect: rrect, circle: circle, vgrad: vgrad, shade: shade, card: card }; // for the later UI files (19i-look.js)

  F.UIScene = class extends Phaser.Scene {
    constructor() {
      super('UI');
    }

    create() {
      F.ui = this;
      this.modals = [];
      this.input.addPointer(2);
      // The canvas is WIDTH*R x VIEW_H*R; zoom so all UI code works in layout px (y = 0 at the top of the screen).
      this.cameras.main.setZoom(F.R).centerOn(W / 2, C.VIEW_H / 2);
      this.weatherKey = ''; // petals / leaves / snow / rain, rebuilt when the season or weather changes
      this.buildHud();
      this.buildHotbar();
      this.buildAction();
      this.buildJoystick();
      this.buildToast();
      this.buildGoal();
      this.setupKeys();
      F.bus.on('hud', this.refresh, this);
      F.bus.on('hint', this.setHint, this);
      this.events.once('shutdown', function () { // the scene restarts on New game
        F.bus.off('hud', this.refresh, this);
        F.bus.off('hint', this.setHint, this);
      }, this);
      this.refresh();
      this.setHint(null);
      this.buildFpsMeter();
      var boot = document.getElementById('boot');
      if (boot) boot.parentNode.removeChild(boot);
      if (F.session.isNew) {
        var self = this;
        this.chooseLook(function () {
          self.dialog('WELCOME TO HARVEST VILLE!\nGrandpa\'s old field is overgrown. Clear a patch with the Sickle, Axe and Hammer, ' +
            'then hoe it and plant your ' + C.CROPS[C.ITEMS[C.STARTER_SEEDS[L.date(F.session.state.day).season] || 'seed_turnip'].crop].item + ' seeds. Crops grow by the real clock; watering makes them faster.\n\nClucky the chicken is in the pen, and the town of Willowbrook is down the road south.', [{ label: 'How to play', color: 0x4a90c9, cb: self.help.bind(self) }, { label: "Let's go!" }]);
        });
      }
    }

    // ---------- drawing helpers ----------
    txt(x, y, str, size, color, extra) {
      return this.add.text(x, y, str, style(size, color, extra));
    }

    // Draws a picture once into a texture at render resolution; the result is shown as an image.
    // Live Graphics objects are re-tessellated on every frame, which is the slowest thing a
    // low-end phone CPU has to do here, so the UI only uses baked images and plain rectangles.
    bake(key, w, h, draw) {
      if (!this.textures.exists(key)) {
        var g = this.make.graphics({ x: 0, y: 0 }, false);
        g.scaleCanvas(F.R, F.R);
        draw(g);
        g.generateTexture(key, Math.ceil(w * F.R), Math.ceil(h * F.R));
        g.destroy();
      }
      return key;
    }

    // A short text drawn once per (style, string) into its own texture, then shown as an Image. Re-rendering a Text
    // (canvas draw + measure + upload) on every change is what made labels and the bag hitch on slow phones.
    textTex(str, size, color, extra) {
      var sk = size + '|' + color + '|' + JSON.stringify(extra || {}), key = 'tt|' + sk + '|' + str;
      if (this.textures.exists(key)) return key;
      this.ttScratch = this.ttScratch || {};
      var t = this.ttScratch[sk] || (this.ttScratch[sk] = this.make.text({ x: 0, y: 0, text: '', style: style(size, color, extra) }, false));
      t.setText(str);
      var ct = this.textures.createCanvas(key, Math.max(1, t.canvas.width), Math.max(1, t.canvas.height));
      ct.context.drawImage(t.canvas, 0, 0);
      ct.refresh();
      return key;
    }

    // Like bake(), but with a Canvas 2D context (gradients, soft shadows). Sizes are in layout px.
    bakeCanvas(key, w, h, draw) {
      if (!this.textures.exists(key)) {
        var t = this.textures.createCanvas(key, Math.ceil(w * F.R), Math.ceil(h * F.R)), g = t.getContext();
        g.scale(F.R, F.R);
        draw(g);
        t.refresh();
      }
      return key;
    }

    canvasImg(parent, x, y, key, w, h, draw) {
      var img = this.add.image(x, y, this.bakeCanvas(key, w, h, draw)).setOrigin(0).setScale(1 / F.R);
      if (parent) parent.add(img);
      return img;
    }

    baked(parent, x, y, key, w, h, draw) {
      var img = this.add.image(x, y, this.bake(key, w, h, draw)).setOrigin(0).setScale(1 / F.R);
      if (parent) parent.add(img);
      return img;
    }

    // A cream panel with a wooden frame. Drawn once and stretched (nine-slice: the corners keep their shape), so
    // panels of every size share one small texture instead of each new height baking (and keeping) its own.
    panelImg(parent, x, y, w, h) {
      var draw = function (g, w, h) {
        rrect(g, 4, 8, w, h, 16);
        g.fillStyle = 'rgba(30,16,6,0.4)';
        g.fill();
        rrect(g, 4, 2, w, h, 16);
        g.fillStyle = vgrad(g, 2, 2 + h, '#946036', '#5a3a1e');
        g.fill();
        rrect(g, 8, 6, w - 8, h - 8, 13);
        g.fillStyle = vgrad(g, 6, h - 2, '#fffaea', '#f1dcae');
        g.fill();
        rrect(g, 13, 11, w - 18, h - 18, 9);
        g.lineWidth = 1.5;
        g.strokeStyle = 'rgba(176,128,70,0.55)';
        g.stroke();
        // corner studs
        [[13, 10], [w - 5, 10], [13, h - 8], [w - 5, h - 8]].forEach(function (p) {
          circle(g, p[0], p[1], 2.6);
          g.fillStyle = '#c9963f';
          g.fill();
        });
      };
      if (this.game.renderer.type !== Phaser.WEBGL || w < 60 || h < 60) {
        return this.canvasImg(parent, x - 4, y - 2, 'ui-panel2-' + w + 'x' + h, w + 8, h + 10, function (g) { draw(g, w, h); });
      }
      var key = this.bakeCanvas('ui-panel2-ns', PANEL_BASE + 8, PANEL_BASE + 10, function (g) { draw(g, PANEL_BASE, PANEL_BASE); });
      var R = F.R, img = this.add.nineslice(x - 4, y - 2, key, null, (w + 8) * R, (h + 10) * R, 24 * R, 24 * R, 22 * R, 26 * R).setOrigin(0).setScale(1 / R);
      if (parent) parent.add(img);
      return img;
    }

    // Slot textures are SLOT + 4 wide so the selected glow fits; draw them 2px up and left.
    slotTex(kind) {
      var self = this;
      return this.bake('ui-slot-' + kind, SLOT + 4, SLOT + 4, function (g) {
        if (kind === 'bag') {
          g.fillStyle(0x6aa84f, 1).fillRoundedRect(2, 2, SLOT, SLOT, 7);
          g.fillStyle(0x8fd06a, 1).fillRoundedRect(5, 5, SLOT - 6, SLOT - 6, 5);
        } else {
          self.slotBox(g, 2, 2, SLOT, kind === 'sel');
        }
      });
    }

    panel(g, x, y, w, h) {
      g.fillStyle(COL.edge, 1).fillRoundedRect(x, y, w, h, 12);
      g.fillStyle(COL.panel, 1).fillRoundedRect(x + 3, y + 3, w - 6, h - 6, 10);
      g.lineStyle(2, COL.inner, 1).strokeRoundedRect(x + 7, y + 7, w - 14, h - 14, 7);
    }

    slotBox(g, x, y, size, selected) {
      if (selected) {
        g.fillStyle(0xffffff, 1).fillRoundedRect(x - 2, y - 2, size + 4, size + 4, 9);
        g.fillStyle(COL.sel, 1).fillRoundedRect(x, y, size, size, 7);
        g.fillStyle(0xfff3c4, 1).fillRoundedRect(x + 4, y + 4, size - 8, size - 8, 4);
        return;
      }
      g.fillStyle(COL.slotEdge, 1).fillRoundedRect(x, y, size, size, 7);
      g.fillStyle(COL.slot, 1).fillRoundedRect(x + 3, y + 3, size - 6, size - 6, 5);
    }

    button(parent, x, y, w, h, label, onTap, color) {
      var c = this.add.container(x, y);
      color = color || 0x5fa84a;
      var bg = this.canvasImg(null, -w / 2, -h / 2, 'ui-btn2-' + w + 'x' + h + '-' + color, w, h + 4, function (g) {
        rrect(g, 0, 3, w, h, 11);
        g.fillStyle = 'rgba(30,16,6,0.35)';
        g.fill();
        rrect(g, 0, 0, w, h, 11);
        g.fillStyle = '#3d2614';
        g.fill();
        rrect(g, 2, 2, w - 4, h - 4, 9);
        g.fillStyle = shade(color, -0.28); // the darker bottom edge
        g.fill();
        rrect(g, 2, 2, w - 4, h - 7, 9);
        g.fillStyle = vgrad(g, 2, h - 5, shade(color, 0.25), shade(color, 0));
        g.fill();
        rrect(g, 6, 4, w - 12, (h - 10) / 2, 7);
        g.fillStyle = 'rgba(255,255,255,0.3)';
        g.fill();
      });
      var t = this.txt(0, -1, label, 15, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
      if (t.width > w - 8) t.setScale((w - 8) / t.width); // long labels shrink to fit
      var z = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
      z.on('pointerdown', function () { c.setScale(0.93); });
      z.on('pointerout', function () { c.setScale(1); });
      F.tapOn(z, function () { c.setScale(1); onTap(); });
      c.add([bg, t, z]);
      if (parent) parent.add(c);
      return c;
    }

    // An inventory slot widget: background, icon, count, and the watering-can level bar.
    slotWidget(parent, x, y, onTap) {
      var w = { x: x, y: y };
      w.bg = this.add.image(x - 2, y - 2, this.slotTex('plain')).setOrigin(0).setScale(1 / F.R);
      w.icon = this.add.image(x + SLOT / 2, y + SLOT / 2 - 1, 'items', 0).setScale(ICON);
      w.count = this.add.image(x + SLOT - 5, y + SLOT - 4, '__DEFAULT').setOrigin(1, 1).setScale(1 / F.R).setVisible(false);
      w.barBg = this.add.rectangle(x + 7, y + SLOT - 9, SLOT - 14, 5, 0x3d2614).setOrigin(0).setVisible(false);
      w.bar = this.add.rectangle(x + 8, y + SLOT - 8, SLOT - 16, 3, 0x4aa3e8).setOrigin(0).setVisible(false);
      w.zone = this.add.zone(x + SLOT / 2, y + SLOT / 2, SLOT, SLOT).setInteractive({ useHandCursor: true });
      w.zone.on('pointerdown', onTap);
      if (parent) parent.add([w.bg, w.icon, w.count, w.barBg, w.bar, w.zone]);
      return w;
    }

    drawSlot(w, slot, selected) {
      var s = F.session.state;
      w.bg.setTexture(this.slotTex(selected ? 'sel' : 'plain'));
      var can = !!slot && slot.id === 'can';
      w.barBg.setVisible(can);
      w.bar.setVisible(can);
      if (!slot) {
        w.icon.setVisible(false);
        w.count.setVisible(false);
        w.count.text = '';
        return;
      }
      w.icon.setVisible(true).setFrame(L.iconOf(s, slot.id));
      w.count.text = slot.n > 1 ? String(slot.n) : '';
      if (w.count.text) w.count.setTexture(this.textTex(w.count.text, 12, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 })).setVisible(true);
      else w.count.setVisible(false);
      if (can) w.bar.setSize(Math.max(0.01, (SLOT - 16) * s.water / L.canCapacity(s)), 3);
    }

    // ---------- HUD ----------
    // A wooden frame with three cards: the date and time, the weather and energy, and the gold.
    buildHud() {
      var self = this;
      this.canvasImg(null, 4, 4, 'ui-hud', W - 8, 64, function (g) {
        rrect(g, 2, 4, W - 12, 58, 14);
        g.fillStyle = 'rgba(40,22,8,0.35)';
        g.fill();
        rrect(g, 2, 2, W - 12, 58, 14);
        g.fillStyle = vgrad(g, 2, 60, '#8a5a30', '#5a3a1e');
        g.fill();
        rrect(g, 5, 5, W - 18, 52, 11);
        g.fillStyle = vgrad(g, 5, 57, '#fff6dc', '#efd7a2');
        g.fill();
        rrect(g, 5, 5, W - 18, 26, 11);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fill();
        // cards
        card(g, 10, 9, 104, 44);
        card(g, 120, 9, 104, 44);
      });
      // date and time
      this.seasonIcon = this.add.image(27, 24, 'items', C.SEASONS[0].icon).setScale(0.17);
      this.dayText = this.txt(39, 16, '', 13, '#8a4f1c', { fontStyle: 'bold' });
      this.timeText = this.txt(65, 39, '', 19, INK, { fontStyle: 'bold' }).setOrigin(0.5);
      // weather and energy
      this.weatherIcon = this.add.image(136, 23, 'items', 0).setScale(0.16);
      this.weatherText = this.txt(148, 15, '', 12, '#8a4f1c', { fontStyle: 'bold' });
      this.canvasImg(null, 136, 33, 'ui-energy-trough', 82, 16, function (g) {
        rrect(g, 0, 0, 82, 16, 8);
        g.fillStyle = '#4a2c14';
        g.fill();
        rrect(g, 2, 2, 78, 12, 6);
        g.fillStyle = vgrad(g, 2, 14, '#2a170a', '#5a3a1e');
        g.fill();
      });
      var fill = function (key, top, bottom) {
        return self.bakeCanvas(key, 76, 10, function (g) {
          rrect(g, 0, 0, 76, 10, 5);
          g.fillStyle = vgrad(g, 0, 10, top, bottom);
          g.fill();
          rrect(g, 3, 1.5, 70, 3, 1.5);
          g.fillStyle = 'rgba(255,255,255,0.45)';
          g.fill();
        });
      };
      this.energyFills = [fill('ui-energy-red', '#ff8a7a', '#d93a3a'), fill('ui-energy-yellow', '#ffe680', '#e9a91c'), fill('ui-energy-green', '#a6ef7c', '#3fa535')];
      this.energyBar = this.add.image(139, 36, this.energyFills[2]).setOrigin(0).setScale(1 / F.R);
      this.add.image(134, 41, 'items', C.ICON.bolt).setScale(0.24);
      this.energyText = this.txt(180, 41, '', 10, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
      // gold
      this.canvasImg(null, 232, 18, 'ui-gold', 82, 28, function (g) {
        rrect(g, 0, 0, 82, 28, 14);
        g.fillStyle = vgrad(g, 0, 28, '#7a4d26', '#4a2c14');
        g.fill();
        rrect(g, 3, 2, 76, 10, 6);
        g.fillStyle = 'rgba(255,255,255,0.14)';
        g.fill();
      });
      this.add.image(238, 32, 'items', C.ICON.coin).setScale(0.28);
      this.goldText = this.txt(254, 32, '', 15, '#ffe27a', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0, 0.5);
      // pause
      var menu = this.add.container(335, 32);
      var mg = this.canvasImg(null, -16, -16, 'ui-menu', 32, 34, function (g) {
        rrect(g, 0, 2, 32, 32, 9);
        g.fillStyle = 'rgba(40,22,8,0.35)';
        g.fill();
        rrect(g, 0, 0, 32, 32, 9);
        g.fillStyle = vgrad(g, 0, 32, '#8a5a30', '#5a3a1e');
        g.fill();
        rrect(g, 3, 3, 26, 26, 7);
        g.fillStyle = vgrad(g, 3, 29, '#fff6dc', '#e8cf98');
        g.fill();
        g.fillStyle = '#5a3a1e';
        rrect(g, 10, 9, 4.5, 14, 2);
        g.fill();
        rrect(g, 17.5, 9, 4.5, 14, 2);
        g.fill();
      });
      var mz = this.add.zone(0, 0, 44, 44).setInteractive({ useHandCursor: true });
      mz.on('pointerdown', function () { menu.setScale(0.9); if (!self.modals.length) self.openPause(); });
      mz.on('pointerup', function () { menu.setScale(1); });
      mz.on('pointerout', function () { menu.setScale(1); });
      menu.add([mg, mz]);
    }

    refresh() {
      var s = F.session.state;
      var date = L.date(s.day);
      this.dayText.setText(L.formatDate(s.day));
      this.seasonIcon.setFrame(C.SEASONS[date.season].icon);
      var weather = L.weather(s, s.day), mapKey = F.world ? F.world.mapKey : 'farm';
      var outdoors = mapKey === 'farm' || mapKey === 'town';
      this.weatherIcon.setFrame(C.WEATHER[weather].icon);
      this.weatherText.setText(mapKey === 'mine' ? 'Mine B' + F.session.mineFloor : C.WEATHER[weather].name);
      var wkey = date.season + '|' + weather + '|' + outdoors;
      if (wkey !== this.weatherKey) this.buildWeather(date.season, weather, outdoors, wkey);
      this.timeText.setText(L.formatTime(s.time));
      this.showGold(s.gold);
      var pct = Math.max(0, Math.min(1, s.energy / L.maxEnergy(s)));
      this.energyBar.setTexture(this.energyFills[pct > 0.5 ? 2 : pct > 0.2 ? 1 : 0]).setVisible(pct > 0);
      this.energyBar.setCrop(0, 0, Math.max(10, 76 * pct) * F.R, 10 * F.R);
      this.energyText.setText(String(Math.round(s.energy)));
      for (var i = 0; i < C.HOTBAR; i++) this.drawSlot(this.slots[i], s.inv[i], s.sel === i);
      // the night sheet lives in the world, so windows and lamps can glow through it
      if (F.world && F.world.applyDark) F.world.applyDark(this.darkness());
      if (this.refreshGoal) this.refreshGoal();
      if (this.invRefresh) this.invRefresh();
    }

    // Gentle seasonal particles drifting down the screen (petals, leaves, snow), or rain and storms.
    // Outdoors only. Drawn under the night tint and the HUD.
    buildWeather(season, weather, outdoors, key) {
      this.weatherKey = key;
      if (this.weather) this.weather.destroy();
      if (this.flashTimer) this.flashTimer.remove();
      this.weather = null;
      this.flashTimer = null;
      if (!outdoors) return;
      if (weather === 'rain' || weather === 'storm') {
        var tex = this.bake('ui-raindrop', 3, 18, function (g) { g.fillStyle(0xbfe2ff, 0.8).fillRoundedRect(0, 0, 3, 18, 1.5); });
        this.weather = this.add.particles(0, 0, tex, {
          x: { min: -40, max: W + 60 }, y: -30, lifespan: 1400,
          speedY: { min: 520, max: 680 }, speedX: weather === 'storm' ? { min: -200, max: -150 } : { min: -60, max: -40 },
          rotate: weather === 'storm' ? 16 : 5, scale: 1 / F.R, alpha: { min: 0.45, max: 0.8 },
          frequency: weather === 'storm' ? 14 : 24,
        }).setDepth(-2);
        this.weather.fastForward(1500);
        if (weather === 'storm') {
          var self = this;
          this.flashTimer = this.time.addEvent({
            delay: 6000, loop: true, callback: function () {
              if (Math.random() < 0.55) return;
              var flash = self.add.rectangle(0, 0, W, C.VIEW_H, 0xffffff, 0.55).setOrigin(0).setDepth(-1);
              self.tweens.add({ targets: flash, alpha: 0, duration: 380, onComplete: function () { flash.destroy(); } });
              if (F.Audio) F.Audio.sfx('thunder');
            },
          });
        }
        return;
      }
      var p = C.SEASONS[season].particles;
      if (!p) return;
      var heavy = weather === 'snow' ? 0.35 : 1;
      this.weather = this.add.particles(0, 0, 'items', {
        frame: C.SEASONS[season].icon,
        x: { min: -20, max: W + 20 },
        y: -20,
        lifespan: 16000,
        speedY: { min: p.fall[0], max: p.fall[1] },
        speedX: { min: -18, max: 18 },
        scale: { min: p.scale[0], max: p.scale[1] },
        rotate: { start: 0, end: 360 },
        alpha: 0.85,
        frequency: p.every * heavy,
      }).setDepth(-2);
      this.weather.fastForward(12000); // start with the screen already filled
    }

    darkness() {
      var s = F.session.state, mapKey = F.world ? F.world.mapKey : 'farm', weather = L.weather(s, s.day);
      var outdoors = mapKey === 'farm' || mapKey === 'town';
      var dark = this.nightAlpha(s.time);
      if (mapKey === 'house') dark *= 0.35; // the lamps are on
      if (mapKey === 'mine') dark = 0.3;
      if (outdoors && weather === 'storm') dark = Math.max(dark, 0.28);
      else if (outdoors && weather === 'rain') dark = Math.max(dark, 0.16);
      return dark;
    }

    // The gold counter rolls up to the new amount.
    showGold(gold) {
      var self = this;
      if (this.goldShown == null || gold <= this.goldShown) {
        if (this.goldTween) this.goldTween.remove();
        this.goldShown = gold;
        this.goldTarget = null;
        this.goldText.setText(gold + 'G');
        return;
      }
      if (this.goldTarget === gold) return;
      this.goldTarget = gold;
      if (this.goldTween) this.goldTween.remove();
      var from = this.goldShown;
      this.goldTween = this.tweens.addCounter({
        from: from, to: gold, duration: Math.min(1200, 300 + (gold - from) / 2), ease: 'Quad.out',
        onUpdate: function (tw) { self.goldShown = Math.round(tw.getValue()); self.goldText.setText(self.goldShown + 'G'); },
        onComplete: function () { self.goldShown = gold; self.goldText.setText(gold + 'G'); },
      });
      this.tweens.add({ targets: this.goldText, scale: { from: 1.18, to: 1 }, duration: 300 });
    }

    nightAlpha(t) {
      if (t < C.NIGHT_START) return 0;
      if (t < C.NIGHT_FULL) return 0.45 * (t - C.NIGHT_START) / (C.NIGHT_FULL - C.NIGHT_START);
      return Math.min(0.58, 0.45 + 0.13 * (t - C.NIGHT_FULL) / (24 * 60 - C.NIGHT_FULL));
    }

    // ---------- hotbar ----------
    buildHotbar() {
      var self = this;
      this.panelImg(null, 4, HOTBAR_Y - 30, W - 8, 60);
      var total = (C.HOTBAR + 1) * SLOT + C.HOTBAR * GAP;
      var x0 = (W - total) / 2;
      this.slots = [];
      for (var i = 0; i < C.HOTBAR; i++) {
        this.slots.push(this.slotWidget(null, x0 + i * (SLOT + GAP), HOTBAR_Y - SLOT / 2, this.select.bind(this, i)));
      }
      var bx = x0 + C.HOTBAR * (SLOT + GAP);
      var bag = this.slotWidget(null, bx, HOTBAR_Y - SLOT / 2, function () { if (!self.modals.length) self.openInventory(); });
      bag.bg.setTexture(this.slotTex('bag'));
      bag.icon.setFrame(C.ICON.bag);
      this.bagWidget = bag;
    }

    select(i) {
      if (this.modals.length) return;
      F.session.state.sel = i;
      F.session.dirty = true;
      this.refresh();
      F.world.hintKey = null; // force the action button to re-evaluate
    }

    // ---------- action button ----------
    // A gold ring when there is something to do, a dull one when not; the action's name sits on a banner.
    buildAction() {
      var self = this, a = this.actionBtn = this.add.container(ACTION.x, ACTION.y);
      var r = ACTION.r, size = r * 2 + 12;
      var ring = function (key, light, dark) {
        return self.bakeCanvas(key, size, size, function (g) {
          var c = size / 2;
          g.beginPath();
          g.ellipse(c, c + 5, r, r - 2, 0, 0, Math.PI * 2);
          g.fillStyle = 'rgba(40,22,8,0.35)';
          g.fill();
          circle(g, c, c, r);
          g.fillStyle = '#5a3a1e';
          g.fill();
          circle(g, c, c, r - 3);
          g.fillStyle = vgrad(g, c - r, c + r, light, dark);
          g.fill();
          circle(g, c, c, r - 10);
          g.fillStyle = '#7a4d26';
          g.fill();
          circle(g, c, c, r - 12);
          var rg = g.createRadialGradient(c - 8, c - 12, 4, c, c, r - 12);
          rg.addColorStop(0, '#fffdf4');
          rg.addColorStop(1, '#f0d9a8');
          g.fillStyle = rg;
          g.fill();
          g.beginPath();
          g.ellipse(c - 6, c - r + 12, r - 20, 7, -0.15, 0, Math.PI * 2);
          g.fillStyle = 'rgba(255,255,255,0.55)';
          g.fill();
        });
      };
      this.ringOn = ring('ui-action-on', '#ffe98a', '#e59a12');
      this.ringOff = ring('ui-action-off', '#e6dcc6', '#a8977a');
      this.actionGlow = this.add.image(0, 0, this.bakeCanvas('ui-action-glow', size + 30, size + 30, function (g) {
        var c = (size + 30) / 2, gr = g.createRadialGradient(c, c, r - 6, c, c, c);
        gr.addColorStop(0, 'rgba(255,226,110,0.7)');
        gr.addColorStop(1, 'rgba(255,226,110,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, size + 30, size + 30);
      })).setScale(1 / F.R).setAlpha(0);
      this.tweens.add({ targets: this.actionGlow, scale: { from: 0.95 / F.R, to: 1.08 / F.R }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.actionRing = this.add.image(0, 0, this.ringOff).setScale(1 / F.R);
      this.actionIcon = this.add.image(0, -6, 'items', 0).setScale(0.36);
      this.bakeCanvas('ui-banner', 40, 22, function (g) {
        rrect(g, 0, 0, 40, 22, 11);
        g.fillStyle = vgrad(g, 0, 22, '#7a4d26', '#4a2c14');
        g.fill();
        rrect(g, 3, 2, 34, 7, 4);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fill();
      });
      this.actionBanner = this.add.nineslice(0, r - 8, 'ui-banner', null, 60 * F.R, 22 * F.R, 11 * F.R, 11 * F.R, 0, 0).setScale(1 / F.R);
      this.actionLabel = this.add.image(0, r - 8, '__DEFAULT').setOrigin(0.5).setScale(1 / F.R).setVisible(false);
      this.actionLabel.text = '';
      // the everyday labels are drawn ahead, one every 100 ms after the start, so none hitches the first time it shows
      var self2 = this, ahead = ['Harvest', 'Water', 'Till', 'Plant', 'Chop', 'Smash', 'Cut', 'Talk', 'Enter', 'Go down', 'Read',
        'Sell', 'Collect', 'Feed', 'Pet', 'Brush', 'Milk', 'Fish', 'Refill', 'Growing', 'Withered', 'Bed', 'Shop', 'Orders', 'Ride', 'Eat', 'Action'];
      this.time.delayedCall(1500, function () {
        self2.time.addEvent({ delay: 100, repeat: ahead.length - 1, callback: function () { self2.textTex(ahead.shift(), 13, '#fff3c8', { fontStyle: 'bold' }); } });
      });
      var z = this.add.zone(0, 0, ACTION.r * 2 + 20, ACTION.r * 2 + 20).setInteractive();
      var up = function () {
        if (F.input.holding) F.input.released = true;
        F.input.holding = false;
        self.tweens.add({ targets: a, scale: 1, duration: 160, ease: 'Back.out' });
      };
      z.on('pointerdown', function () {
        if (F.Audio) F.Audio.unlock();
        F.input.action = true;
        F.input.holding = true;
        self.tweens.killTweensOf(a);
        a.setScale(0.88);
      });
      z.on('pointerup', up);
      z.on('pointerout', up);
      a.add([this.actionGlow, this.actionRing, this.actionIcon, this.actionBanner, this.actionLabel, z]);
      // charge meter: one pip per charge level, shown while an upgraded tool is held down
      this.chargeText = this.txt(ACTION.x, ACTION.y - ACTION.r - 16, '', 14, '#fff27a', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 4 })
        .setOrigin(0.5).setVisible(false);
      F.bus.on('charge', this.showCharge, this);
      this.events.once('shutdown', function () { F.bus.off('charge', this.showCharge, this); }, this);
    }

    showCharge(level) {
      if (level < 0) {
        this.chargeText.setVisible(false);
        return;
      }
      this.chargeText.setVisible(true).setText(['1 tile', '3 tiles', '3 x 3', '3 x 5'][level] + '  ' + new Array(level + 2).join('\u25CF'));
      this.tweens.add({ targets: this.chargeText, scale: { from: 1.3, to: 1 }, duration: 160 });
    }

    setHint(a) {
      var held = L.held(F.session.state), on = !!a && !a.disabled;
      var label = a ? a.label : held ? '' : 'Action';
      var icon = a ? (a.icon != null && a.icon >= 0 ? a.icon : null) : held ? C.ITEMS[held.id].icon : null;
      this.actionRing.setTexture(on ? this.ringOn : this.ringOff);
      this.actionGlow.setAlpha(on ? 0.9 : 0);
      this.actionIcon.setVisible(icon != null).setAlpha(on ? 1 : 0.45);
      if (icon != null) this.actionIcon.setFrame(icon);
      this.actionIcon.setY(label ? -6 : 0);
      if (label) this.actionLabel.setTexture(this.textTex(label, 13, '#fff3c8', { fontStyle: 'bold' }));
      this.actionLabel.text = label || '';
      this.actionLabel.setVisible(!!label).setAlpha(on || !a ? 1 : 0.75);
      this.actionBanner.setVisible(!!label).setTint(on ? 0xffffff : 0xb8a890);
      if (label) this.actionBanner.setSize((this.actionLabel.displayWidth + 20) * F.R, 22 * F.R);
      var key = on ? label + '|' + icon : '';
      if (on && key !== this.hintKeyShown) { // a new thing to do: the icon pops
        this.tweens.killTweensOf(this.actionIcon);
        this.tweens.add({ targets: this.actionIcon, scale: { from: 0.46, to: 0.36 }, duration: 220, ease: 'Back.out' });
      }
      this.hintKeyShown = key;
    }

    // ---------- joystick ----------
    buildJoystick() {
      // drawn once into small textures (two vector circles were re-shaped into ~900 triangles every frame)
      var ring = function (r, fill, line, lineA) {
        return function (g) {
          g.fillStyle(0xffffff, fill).fillCircle(r + 2, r + 2, r);
          g.lineStyle(line, 0xffffff, lineA).strokeCircle(r + 2, r + 2, r);
        };
      };
      var R = F.R;
      this.joyBase = this.add.image(JOY.x, JOY.y, this.bake('ui-joy-base', JOY.r * 2 + 4, JOY.r * 2 + 4, ring(JOY.r, 0.06, 2, 0.5))).setScale(1 / R).setAlpha(JOY_ALPHA.idle);
      this.joyKnob = this.add.image(JOY.x, JOY.y, this.bake('ui-joy-knob', JOY.knob * 2 + 4, JOY.knob * 2 + 4, ring(JOY.knob, 0.35, 1.5, 0.6))).setScale(1 / R).setAlpha(JOY_ALPHA.idle);
      this.joyId = null;
      var cam = this.cameras.main;
      this.input.on('pointerdown', function (p, over) {
        if (F.Audio) F.Audio.unlock();
        if (this.joyId !== null || this.modals.length || this.decorating || over.length) return;
        var pt = cam.getWorldPoint(p.x, p.y);
        if (pt.y < 70 || pt.y > HOTBAR_Y - 34) return;
        this.joyId = p.id;
        this.joyOrigin = { x: pt.x, y: pt.y };
        this.joyBase.setPosition(pt.x, pt.y).setAlpha(JOY_ALPHA.drag);
        this.joyKnob.setPosition(pt.x, pt.y).setAlpha(JOY_ALPHA.drag);
      }, this);
      this.input.on('pointermove', function (p) {
        if (p.id !== this.joyId) return;
        var pt = cam.getWorldPoint(p.x, p.y);
        var dx = pt.x - this.joyOrigin.x, dy = pt.y - this.joyOrigin.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > JOY.r) { dx *= JOY.r / d; dy *= JOY.r / d; }
        this.joyKnob.setPosition(this.joyOrigin.x + dx, this.joyOrigin.y + dy);
        F.input.jx = dx / JOY.r;
        F.input.jy = dy / JOY.r;
      }, this);
      var up = function (p) { if (p.id === this.joyId) this.releaseJoystick(); };
      this.input.on('pointerup', up, this);
      this.input.on('pointerupoutside', up, this);
    }

    releaseJoystick() {
      this.joyId = null;
      F.input.jx = F.input.jy = 0;
      if (!this.joyBase) return;
      this.joyBase.setPosition(JOY.x, JOY.y).setAlpha(JOY_ALPHA.idle);
      this.joyKnob.setPosition(JOY.x, JOY.y).setAlpha(JOY_ALPHA.idle);
    }

    // ---------- frame-rate meter (toggled from the pause menu) ----------
    buildFpsMeter() {
      this.fpsText = this.txt(W - 10, 70, '', 12, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(1, 0).setDepth(400).setVisible(!!F.showFps);
      this.fpsFrames = 0;
      this.fpsSince = 0;
    }

    update(time, delta) {
      this.updateArrow(time);
      if (this.game2) this.game2.update(Math.min(delta, 100), time);
      if (!this.fpsText.visible) return;
      this.fpsFrames++;
      if (time - this.fpsSince < 1000) return;
      this.fpsText.setText(Math.round(this.fpsFrames * 1000 / (time - this.fpsSince)) + ' fps  x' + F.R);
      this.fpsFrames = 0;
      this.fpsSince = time;
    }

    // ---------- toast + floating text ----------
    buildToast() {
      this.toastBg = this.add.graphics().setDepth(300);
      this.toastText = this.txt(W / 2, 84, '', 14, '#ffffff', { align: 'center', wordWrap: { width: W - 70 }, lineSpacing: 2 })
        .setOrigin(0.5, 0).setDepth(301);
      this.hideToast();
    }

    toast(msg, ms, color) {
      if (!msg) return;
      this.toastText.setText(msg).setVisible(true).setY(this.goalBar && this.goalBar.visible ? 114 : 84);
      var b = this.toastText.getBounds();
      this.toastBg.clear().setVisible(true);
      this.toastBg.fillStyle(color || 0x24160b, 0.86).fillRoundedRect(b.x - 12, b.y - 8, b.width + 24, b.height + 16, 10);
      if (this.toastTimer) this.toastTimer.remove();
      this.toastTimer = this.time.delayedCall(ms || 2400, this.hideToast, [], this);
    }

    // A tip the first time you hold something: stays up longer, on a green card.
    tip(text) {
      this.toast(text, 6000, 0x2f5a22);
      if (F.Audio) F.Audio.sfx('pick');
    }

    hideToast() {
      this.toastText.setVisible(false);
      this.toastBg.setVisible(false);
    }

    floatText(x, y, str) {
      var t = this.txt(x, y, str, 15, '#fff27a', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 4 }).setOrigin(0.5).setDepth(250);
      this.tweens.add({ targets: t, y: y - 34, alpha: { from: 1, to: 0 }, duration: 1000, ease: 'Quad.out', onComplete: function () { t.destroy(); } });
    }

    // ---------- modals ----------
    blocking() {
      return this.modals.length > 0;
    }

    // Moves from this panel to another (a tab, a page, a new list) without closing it first: it stays on screen until the
    // next panel opens, which then takes its place in the same frame (owner, 28 Oct: tabs closed and reopened the panel,
    // the farm flashing through while the next tab loaded). If nothing opens within a few seconds, it simply stays.
    // One swap at a time: while the last tap's panel is still loading, more taps wait for it (owner, 29 Oct: tapping Next
    // 100 times stacked 100 panels, each dimming the screen, and X had to be tapped 100 times).
    swapTo(open) {
      var top = this.modals[this.modals.length - 1], sw = this.swapping;
      if (top && sw && sw.m === top && Date.now() - sw.at < 8000) return;
      this.swapping = top ? { m: top, at: Date.now() } : null;
      open();
    }

    swapGone(ticket) {
      return !!(ticket && ticket.dropped);
    }

    openModal(onBack) {
      var sw = this.swapping;
      this.swapping = null;
      if (sw && this.modals[this.modals.length - 1] === sw.m && Date.now() - sw.at < 8000) this.closeModal();
      this.hideToast(); // don't cover the panel's title
      // panels are drawn in the 640 layout, centred on a taller screen; the dim covers all of it
      var c = this.add.container(0, C.EXTRA / 2).setDepth(100 + this.modals.length);
      var dim = this.add.rectangle(0, -C.EXTRA / 2, W, C.VIEW_H, 0x000000, 0.45).setOrigin(0).setInteractive();
      c.add(dim);
      this.modals.push({ c: c, onBack: onBack });
      F.input.reset();
      return c;
    }

    closeModal() {
      var m = this.modals.pop(), sw = this.swapping;
      // X on a panel whose next page is still loading: that page is not wanted any more (owner, 29 Oct). A loader
      // holds its ticket (this.swapping when it started) and checks .dropped before it opens (U.swapGone).
      if (sw && m && sw.m === m) { sw.dropped = true; this.swapping = null; }
      if (m) m.c.destroy();
      if (!this.modals.length) this.invRefresh = null;
    }

    closeAll() {
      while (this.modals.length) this.closeModal();
    }

    // Back button: close the top panel, otherwise open the pause menu.
    back() {
      if (this.modals.length) {
        var m = this.modals[this.modals.length - 1];
        if (m.onBack) m.onBack();
        else this.closeModal();
        return true;
      }
      if (F.world && F.world.busy) return true;
      this.openPause();
      return true;
    }

    // buttons: [{ label, cb, color }]; Back acts like the first button when there are two.
    // opts.portrait = villager key: their picture, name and hearts head the panel.
    // opts.rows = [[icon frame, text], ...]: the body as a list, each line with its own icon.
    dialog(text, buttons, opts) {
      var self = this;
      opts = opts || {};
      buttons = buttons || [{ label: 'OK' }];
      var c = this.openModal(function () {
        self.closeModal();
        if (buttons.length === 1 && buttons[0].cb) buttons[0].cb();
      });
      var lines = text.split('\n');
      var title = /^[A-Z0-9 !?.,:'-]+$/.test(lines[0]) && lines.length > 1 ? lines.shift() : null;
      if (opts.rows && !title) title = lines.shift();
      // one line on the ribbon: a long title shrinks instead of wrapping below it
      var titleText = title ? this.txt(W / 2, 0, title, 16, '#ffe9a8', { fontStyle: 'bold', align: 'center', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5, 0.5) : null;
      if (titleText && titleText.width > W - 90) titleText.setScale((W - 90) / titleText.width);
      var body = [], bodyH = 0;
      if (opts.rows) {
        opts.rows.forEach(function (r, k) {
          var t = self.txt(84, 0, r[1], 14, INK, { wordWrap: { width: 222 }, lineSpacing: 2 }).setOrigin(0, 0);
          var rh = Math.max(34, t.height + 10);
          body.push({ t: t, icon: r[0], y: bodyH, h: rh, line: k > 0 });
          bodyH += rh + 6;
        });
        bodyH -= 6;
        // never taller than the screen (the OK button must stay reachable): rows that don't fit become one line
        var room = H - 100 - (30 + (opts.portrait ? 92 : titleText ? 30 : 0) + 24 + 44 + 18), hidden = 0;
        while (body.length > 1 && bodyH + (hidden ? 40 : 0) > room) {
          body.pop().t.destroy();
          hidden++;
          bodyH = body[body.length - 1].y + body[body.length - 1].h;
        }
        if (hidden) {
          var more = self.txt(84, 0, '... and ' + hidden + ' more.', 14, INK, { wordWrap: { width: 222 } }).setOrigin(0, 0);
          body.push({ t: more, icon: C.ICON.letter, y: bodyH + 6, h: 34, line: true });
          bodyH += 40;
        }
      } else {
        var bt = this.txt(W / 2, 0, lines.join('\n'), 15, INK, { align: 'center', wordWrap: { width: 268 }, lineSpacing: 4 }).setOrigin(0.5, 0);
        body.push({ t: bt, y: 0, h: bt.height });
        bodyH = bt.height;
      }
      var th = titleText ? 30 : 0;
      if (opts.portrait) th = 92;
      var h = Math.round(30 + th + bodyH + 24 + 44 + 18);
      var y0 = Math.round(Math.max(84, (H - h) / 2 - 40));
      this.panelImg(c, 24, y0, W - 48, h);
      if (opts.portrait) {
        F.ensureTexture(this, 'people');
        var vi = C.VILLAGER_ORDER.indexOf(opts.portrait);
        this.baked(c, 44, y0 + 18, 'ui-portrait-bg', 70, 80, function (g) {
          g.fillStyle(COL.slotEdge, 1).fillRoundedRect(0, 0, 70, 80, 10);
          g.fillStyle(0xbfe0f0, 1).fillRoundedRect(3, 3, 64, 74, 8);
        });
        c.add(this.add.image(79, y0 + 98, 'people', vi * 9).setOrigin(0.5, 0.83).setScale(0.42).setCrop(0, 0, 128, 150));
        var who = this.txt(126, y0 + 22, opts.name || C.VILLAGERS[opts.portrait].name, 19, INK, { fontStyle: 'bold' });
        if (who.width > W - 126 - 40) who.setScale((W - 126 - 40) / who.width);
        c.add(who);
        c.add(this.txt(126, y0 + 46, C.VILLAGERS[opts.portrait].role, 12, '#7a5a3a'));
        this.heartRow(c, 126, y0 + 66, L.friend(F.session.state, opts.portrait).pts);
      } else if (titleText) { // a ribbon across the top edge
        var rw = Math.min(W - 40, Math.max(170, titleText.width + 44));
        this.ribbon(c, W / 2, y0 + 4, rw);
        titleText.y = y0 + 4;
        c.add(titleText);
      }
      var by = y0 + 22 + th;
      body.forEach(function (b) {
        if (b.icon != null) {
          if (b.line) {
            var ln = self.add.rectangle(W / 2, by + b.y - 4, W - 96, 1, 0xc9a26b, 0.6);
            c.add(ln);
          }
          self.canvasImg(c, 40, by + b.y + (b.h - 34) / 2, 'ui-row-icon', 34, 34, function (g) {
            circle(g, 17, 17, 16);
            g.fillStyle = vgrad(g, 1, 33, '#fff3cf', '#ead09a');
            g.fill();
            g.lineWidth = 1.5;
            g.strokeStyle = '#c9a26b';
            g.stroke();
          });
          c.add(self.add.image(57, by + b.y + b.h / 2, 'items', b.icon).setScale(0.2));
          b.t.y = by + b.y + (b.h - b.t.height) / 2;
        } else {
          b.t.y = by;
        }
        c.add(b.t);
      });
      var bw = buttons.length > 1 ? 120 : 150;
      buttons.forEach(function (b, i) {
        var bx = W / 2 + (i - (buttons.length - 1) / 2) * (bw + 14);
        self.button(c, bx, y0 + h - 40, bw, 42, b.label, function () {
          self.closeModal();
          if (b.cb) b.cb();
        }, b.color);
      });
      // everything but the dimmed backdrop pops in
      var parts = c.list.slice(1);
      parts.forEach(function (o) { o.setAlpha(0); o.y += 14; });
      this.tweens.add({ targets: parts, alpha: 1, duration: 140 });
      this.tweens.add({ targets: parts, y: '-=14', duration: 220, ease: 'Back.out' });
      return c;
    }

    // A ribbon banner centred at (x, y), w wide.
    ribbon(parent, x, y, w) {
      w = Math.ceil(w / 20) * 20; // a few widths, not one texture per title
      return this.canvasImg(parent, x - w / 2 - 8, y - 17, 'ui-ribbon-' + w, w + 16, 36, function (g) {
        var tail = function (x0, dir) { // the folded ends
          g.beginPath();
          g.moveTo(x0, 9);
          g.lineTo(x0 - dir * 16, 9);
          g.lineTo(x0 - dir * 9, 19);
          g.lineTo(x0 - dir * 16, 29);
          g.lineTo(x0, 29);
          g.closePath();
          g.fillStyle = '#7a2a1c';
          g.fill();
        };
        tail(16, 1);
        tail(w, -1);
        rrect(g, 8, 4, w, 28, 6);
        g.fillStyle = 'rgba(30,16,6,0.3)';
        g.fill();
        rrect(g, 8, 1, w, 28, 6);
        g.fillStyle = vgrad(g, 1, 29, '#c9473a', '#962c22');
        g.fill();
        rrect(g, 12, 3, w - 8, 9, 4);
        g.fillStyle = 'rgba(255,255,255,0.22)';
        g.fill();
        rrect(g, 11, 4, w - 6, 22, 4);
        g.setLineDash([3, 3]);
        g.lineWidth = 1;
        g.strokeStyle = 'rgba(255,220,170,0.6)';
        g.stroke();
        g.setLineDash([]);
      });
    }

    confirm(text, onYes) {
      return this.dialog(text, [{ label: 'No', color: 0xc0703a }, { label: 'Yes', cb: onYes }]);
    }

    // Friendship as ten of the game's own heart icons (owner, 28 Oct: picked option B of five): the hearts earned in
    // full colour, the next one filled from the bottom as far as you are toward it, the rest dark. pts: 0-100, 10 a heart.
    // step: px from one heart to the next. Returns the width.
    heartIcons(parent, x, y, pts, step) {
      pts = Math.max(0, Math.min(C.FRIEND.max, Number(pts) || 0));
      step = step || 18.6;
      var full = Math.floor(pts / 10), part = (pts % 10) / 10, sc = step * 0.86 / 128;
      for (var i = 0; i < 10; i++) {
        var hx = x + i * step + step / 2;
        var back = this.add.image(hx, y, 'items', C.ICON.heart).setScale(sc).setTint(0x8a7a6a); // dark red: not earned yet (the look picked)
        if (parent) parent.add(back);
        if (i < full || (i === full && part > 0)) {
          var im = this.add.image(hx, y, 'items', C.ICON.heart).setScale(sc);
          if (i === full) im.setCrop(0, im.height * (1 - part), im.width, im.height * part);
          if (parent) parent.add(im);
        }
      }
      return step * 10;
    }

    // The villager dialog's hearts: the icons, and "n of 10 hearts" under them.
    heartRow(parent, x, y, pts) {
      pts = Math.max(0, Math.min(C.FRIEND.max, Number(pts) || 0));
      var full = Math.floor(pts / 10), part = (pts % 10) / 10;
      this.heartIcons(parent, x, y + 7, pts);
      var label = full === 10 ? 'Best friends! 10 of 10 hearts' : full + ' of 10 hearts' + (part > 0 ? ', ' + Math.round(part * 100) + '% to the next' : '');
      if (parent) parent.add(this.txt(x, y + 19, label, 11, '#7a5a3a'));
    }

    heartsText(x, y, n) {
      var full = new Array(n + 1).join('\u2665'), empty = new Array(10 - n + 1).join('\u2661');
      return this.txt(x, y, full + empty, 13, '#d2394a', { fontStyle: 'bold' });
    }

    // A villager speaking, with their portrait.
    say(key, name, text) {
      return this.dialog(text, null, { portrait: key, name: name });
    }

    help(page) {
      var self = this;
      page = page || 0;
      var buttons = [{ label: 'Close' }];
      if (page < HELP.length - 1) buttons.push({ label: 'Next', color: 0x4a90c9, cb: function () { self.help(page + 1); } });
      this.dialog(HELP[page], buttons);
    }

    // ---------- keyboard (desktop testing) ----------
    setupKeys() {
      var self = this, kb = this.input.keyboard;
      if (!kb) return;
      kb.on('keydown', function (e) {
        if (e.repeat) return;
        if (F.Audio) F.Audio.unlock();
        if (e.key === 'Escape' || e.key === 'Backspace') { self.back(); return; }
        if (self.game2 && (e.key === ' ' || e.key === 'Enter' || e.key === 'j')) { self.game2.press(true); return; }
        if (self.modals.length) return;
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'j') {
          F.input.action = true;
          F.input.holding = true;
        }
        else if (e.key === 'e' || e.key === 'i') self.openInventory();
        else if (e.key >= '1' && e.key <= '6') self.select(Number(e.key) - 1);
      });
      kb.on('keyup', function (e) {
        if (self.game2 && (e.key === ' ' || e.key === 'Enter' || e.key === 'j')) self.game2.press(false);
        if ((e.key === ' ' || e.key === 'Enter' || e.key === 'j') && F.input.holding) {
          F.input.holding = false;
          F.input.released = true;
        }
      });
    }
  };
})(window.Farm = window.Farm || {});
