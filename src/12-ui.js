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
  var HOTBAR_Y = 606;
  var ACTION = { x: 294, y: 512, r: 42 };
  var JOY = { x: 86, y: 512, r: 46, knob: 22 };
  var ICON = 32 / 128; // item icons are 128px; slots show them at 32 layout px

  var HELP = [
    'HOW TO PLAY\n' +
    'Drag anywhere to walk. Tap the big button to act on the highlighted tile. Hold it with an upgraded tool to work a whole patch.\n\n' +
    'Clear the field: Sickle for weeds, Axe for branches and stumps (lumber), Hammer for stones (stone).\n\n' +
    'Hoe the soil, plant a seed bag (it sows 3x3), water every day. Rain waters for you.',
    'SELLING AND ANIMALS\n' +
    'Put crops, fish, ore and more in the shipping box by your house. You get paid overnight.\n\n' +
    'Feed animals once a day for eggs and milk (a Milker is needed for cows). Pet and brush them: happy animals give large produce.',
    'TOWN\n' +
    'Willowbrook is down the road south. Talk to people every day and give gifts to make friends.\n\n' +
    'Bram upgrades tools, Mira builds (kitchen, bigger house, coop, barn), Rosa feeds you, Ivy sells tonics. ' +
    'The mine east of town has ore. Fish at the river or the pond.',
    'SEASONS AND FESTIVALS\n' +
    'Seasons last 28 days and crops wither when theirs ends. Check the calendar for festivals and birthdays.\n\n' +
    'With 8 hearts, the House Extension and a Blue Feather, you can propose. Go to bed in your house to end the day.',
  ];

  function style(size, color, extra) {
    var s = { fontFamily: FONT, fontSize: size + 'px', color: color || '#ffffff', resolution: F.R };
    if (extra) Object.keys(extra).forEach(function (k) { s[k] = extra[k]; });
    return s;
  }

  F.UI_CONST = { W: W, H: H, INK: INK, COL: COL, SLOT: SLOT, ICON: ICON };

  F.UIScene = class extends Phaser.Scene {
    constructor() {
      super('UI');
    }

    create() {
      F.ui = this;
      this.modals = [];
      this.input.addPointer(2);
      // The canvas is WIDTH*R x HEIGHT*R; zoom so all UI code works in WIDTH x HEIGHT layout px.
      this.cameras.main.setZoom(F.R).centerOn(W / 2, H / 2);
      this.night = this.add.rectangle(0, 0, W, H, 0x0d1440, 1).setOrigin(0).setAlpha(0).setDepth(-1);
      this.weatherKey = ''; // petals / leaves / snow / rain, rebuilt when the season or weather changes
      this.buildHud();
      this.buildHotbar();
      this.buildAction();
      this.buildJoystick();
      this.buildToast();
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
        this.dialog('WELCOME TO SUNNY ACRES!\nGrandpa\'s old field is overgrown. Clear a patch with the Sickle, Axe and Hammer, ' +
          'then hoe it, plant your turnip seeds and water them every day.\n\nClucky the chicken is in the pen, and the town of Willowbrook is down the road south.', [{ label: 'How to play', color: 0x4a90c9, cb: this.help.bind(this) }, { label: "Let's go!" }]);
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

    baked(parent, x, y, key, w, h, draw) {
      var img = this.add.image(x, y, this.bake(key, w, h, draw)).setOrigin(0).setScale(1 / F.R);
      if (parent) parent.add(img);
      return img;
    }

    panelImg(parent, x, y, w, h) {
      var self = this;
      return this.baked(parent, x, y, 'ui-panel-' + w + 'x' + h, w, h, function (g) { self.panel(g, 0, 0, w, h); });
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
      var bg = this.baked(null, -w / 2, -h / 2, 'ui-btn-' + w + 'x' + h + '-' + color, w, h, function (g) {
        g.fillStyle(0x3d2614, 1).fillRoundedRect(0, 0, w, h, 9);
        g.fillStyle(color, 1).fillRoundedRect(2, 2, w - 4, h - 4, 8);
        g.fillStyle(0xffffff, 0.22).fillRoundedRect(5, 4, w - 10, (h - 8) / 2, 6);
      });
      var t = this.txt(0, 0, label, 15, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
      var z = this.add.zone(0, 0, w, h).setInteractive({ useHandCursor: true });
      z.on('pointerdown', function () { c.setScale(0.94); });
      z.on('pointerout', function () { c.setScale(1); });
      z.on('pointerup', function () { c.setScale(1); onTap(); });
      c.add([bg, t, z]);
      if (parent) parent.add(c);
      return c;
    }

    // An inventory slot widget: background, icon, count, and the watering-can level bar.
    slotWidget(parent, x, y, onTap) {
      var w = { x: x, y: y };
      w.bg = this.add.image(x - 2, y - 2, this.slotTex('plain')).setOrigin(0).setScale(1 / F.R);
      w.icon = this.add.image(x + SLOT / 2, y + SLOT / 2 - 1, 'items', 0).setScale(ICON);
      w.count = this.txt(x + SLOT - 5, y + SLOT - 4, '', 12, '#ffffff', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(1, 1);
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
        w.count.setText('');
        return;
      }
      w.icon.setVisible(true).setFrame(L.iconOf(s, slot.id));
      w.count.setText(slot.n > 1 ? String(slot.n) : '');
      if (can) w.bar.setSize(Math.max(0.01, (SLOT - 16) * s.water / L.canCapacity(s)), 3);
    }

    // ---------- HUD ----------
    buildHud() {
      this.panelImg(null, 6, 6, W - 12, 58);
      this.seasonIcon = this.add.image(26, 21, 'items', C.SEASONS[0].icon).setScale(0.13);
      this.dayText = this.txt(36, 14, '', 13, INK, { fontStyle: 'bold' });
      this.timeText = this.txt(22, 30, '', 19, INK, { fontStyle: 'bold' });
      this.weatherIcon = this.add.image(143, 18, 'items', 0).setScale(0.15);
      this.weatherText = this.txt(154, 10, '', 11, INK, { fontStyle: 'bold' });
      this.add.image(124, 35, 'items', C.ICON.bolt).setScale(ICON * 0.8);
      this.baked(null, 136, 28, 'ui-energy', 74, 15, function (g) { g.fillStyle(0x3d2614, 1).fillRoundedRect(0, 0, 74, 15, 5); });
      this.energyBar = this.add.rectangle(138, 30, 70, 11, 0x5fc24a).setOrigin(0);
      this.add.image(228, 35, 'items', C.ICON.coin).setScale(ICON * 0.8);
      this.goldText = this.txt(242, 26, '', 17, INK, { fontStyle: 'bold' });
      var self = this;
      var menu = this.add.container(326, 35);
      var mg = this.baked(null, -17, -17, 'ui-menu', 34, 34, function (g) {
        g.fillStyle(COL.slotEdge, 1).fillRoundedRect(0, 0, 34, 34, 8);
        g.fillStyle(COL.slot, 1).fillRoundedRect(3, 3, 28, 28, 6);
        g.fillStyle(0x5a3a1e, 1).fillRect(10, 9, 5, 16).fillRect(19, 9, 5, 16);
      });
      var mz = this.add.zone(0, 0, 44, 44).setInteractive({ useHandCursor: true });
      mz.on('pointerdown', function () { if (!self.modals.length) self.openPause(); });
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
      this.weatherText.setText(C.WEATHER[weather].name);
      var wkey = date.season + '|' + weather + '|' + outdoors;
      if (wkey !== this.weatherKey) this.buildWeather(date.season, weather, outdoors, wkey);
      this.timeText.setText(L.formatTime(s.time));
      this.goldText.setText(s.gold + 'G');
      var pct = s.energy / C.MAX_ENERGY;
      this.energyBar.setFillStyle(pct > 0.5 ? 0x5fc24a : pct > 0.2 ? 0xf2c53d : 0xe5484d);
      this.energyBar.setSize(Math.max(0.01, 70 * pct), 11).setVisible(pct > 0);
      for (var i = 0; i < C.HOTBAR; i++) this.drawSlot(this.slots[i], s.inv[i], s.sel === i);
      var dark = this.nightAlpha(s.time);
      if (mapKey === 'house') dark *= 0.35; // the lamps are on
      if (mapKey === 'mine') dark = 0.3;
      if (outdoors && weather === 'storm') dark = Math.max(dark, 0.28);
      else if (outdoors && weather === 'rain') dark = Math.max(dark, 0.16);
      this.night.setAlpha(dark);
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
              var flash = self.add.rectangle(0, 0, W, H, 0xffffff, 0.55).setOrigin(0).setDepth(-1);
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
    }

    select(i) {
      if (this.modals.length) return;
      F.session.state.sel = i;
      F.session.dirty = true;
      this.refresh();
      F.world.hintKey = null; // force the action button to re-evaluate
    }

    // ---------- action button ----------
    buildAction() {
      var a = this.actionBtn = this.add.container(ACTION.x, ACTION.y);
      var r = ACTION.r;
      var g = this.baked(null, -r, -r, 'ui-action', r * 2, r * 2 + 4, function (b) {
        b.fillStyle(0x000000, 0.2).fillCircle(r, r + 4, r);
        b.fillStyle(COL.edge, 1).fillCircle(r, r, r);
        b.fillStyle(0xffd23f, 1).fillCircle(r, r, r - 4);
        b.fillStyle(COL.panel, 1).fillCircle(r, r, r - 9);
        b.fillStyle(0xffffff, 0.35).fillEllipse(r - 8, r - 16, 34, 16);
      });
      this.actionIcon = this.add.image(0, -7, 'items', 0).setScale(ICON * 1.15);
      this.actionLabel = this.txt(0, 21, '', 13, INK, { fontStyle: 'bold' }).setOrigin(0.5);
      var z = this.add.zone(0, 0, ACTION.r * 2 + 20, ACTION.r * 2 + 20).setInteractive();
      var up = function () {
        if (F.input.holding) F.input.released = true;
        F.input.holding = false;
        a.setScale(1);
      };
      z.on('pointerdown', function () {
        if (F.Audio) F.Audio.unlock();
        F.input.action = true;
        F.input.holding = true;
        a.setScale(0.92);
      });
      z.on('pointerup', up);
      z.on('pointerout', up);
      a.add([g, this.actionIcon, this.actionLabel, z]);
      // charge meter: one pip per charge level, shown while an upgraded tool is held down
      this.chargeText = this.txt(ACTION.x, ACTION.y - ACTION.r - 14, '', 14, '#fff27a', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 4 })
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
      var held = L.held(F.session.state);
      if (!a) {
        this.actionIcon.setVisible(!!held).setAlpha(0.5);
        if (held) this.actionIcon.setFrame(C.ITEMS[held.id].icon);
        this.actionLabel.setText(held ? '' : 'Action').setAlpha(0.6).setY(held ? 21 : 0);
        return;
      }
      var hasIcon = a.icon != null && a.icon >= 0;
      this.actionIcon.setVisible(hasIcon).setAlpha(a.disabled ? 0.45 : 1);
      if (hasIcon) this.actionIcon.setFrame(a.icon);
      this.actionLabel.setText(a.label).setAlpha(a.disabled ? 0.5 : 1).setY(hasIcon ? 21 : 0);
    }

    // ---------- joystick ----------
    buildJoystick() {
      this.joyBase = this.add.circle(JOY.x, JOY.y, JOY.r, 0xffffff, 0.16).setStrokeStyle(3, 0xffffff, 0.45);
      this.joyKnob = this.add.circle(JOY.x, JOY.y, JOY.knob, 0xffffff, 0.5).setStrokeStyle(2, 0x5a3a1e, 0.5);
      this.joyId = null;
      var cam = this.cameras.main;
      this.input.on('pointerdown', function (p, over) {
        if (F.Audio) F.Audio.unlock();
        if (this.joyId !== null || this.modals.length || over.length) return;
        var pt = cam.getWorldPoint(p.x, p.y);
        if (pt.y < 70 || pt.y > HOTBAR_Y - 34) return;
        this.joyId = p.id;
        this.joyOrigin = { x: pt.x, y: pt.y };
        this.joyBase.setPosition(pt.x, pt.y).setAlpha(1);
        this.joyKnob.setPosition(pt.x, pt.y).setAlpha(1);
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
      this.joyBase.setPosition(JOY.x, JOY.y).setAlpha(0.7);
      this.joyKnob.setPosition(JOY.x, JOY.y).setAlpha(0.7);
    }

    // ---------- frame-rate meter (toggled from the pause menu) ----------
    buildFpsMeter() {
      this.fpsText = this.txt(W - 10, 70, '', 12, '#ffffff', { fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 })
        .setOrigin(1, 0).setDepth(400).setVisible(!!F.showFps);
      this.fpsFrames = 0;
      this.fpsSince = 0;
    }

    update(time) {
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

    toast(msg) {
      if (!msg) return;
      this.toastText.setText(msg).setVisible(true);
      var b = this.toastText.getBounds();
      this.toastBg.clear().setVisible(true);
      this.toastBg.fillStyle(0x24160b, 0.82).fillRoundedRect(b.x - 12, b.y - 8, b.width + 24, b.height + 16, 10);
      if (this.toastTimer) this.toastTimer.remove();
      this.toastTimer = this.time.delayedCall(2400, this.hideToast, [], this);
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

    openModal(onBack) {
      var c = this.add.container(0, 0).setDepth(100 + this.modals.length);
      var dim = this.add.rectangle(0, 0, W, H, 0x000000, 0.45).setOrigin(0).setInteractive();
      c.add(dim);
      this.modals.push({ c: c, onBack: onBack });
      F.input.reset();
      return c;
    }

    closeModal() {
      var m = this.modals.pop();
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
      var titleText = title ? this.txt(W / 2, 0, title, 18, INK, { fontStyle: 'bold', align: 'center', wordWrap: { width: 270 } }).setOrigin(0.5, 0) : null;
      var body = this.txt(W / 2, 0, lines.join('\n'), 15, INK, { align: 'center', wordWrap: { width: 272 }, lineSpacing: 3 }).setOrigin(0.5, 0);
      var th = titleText ? titleText.height + 10 : 0;
      if (opts.portrait) th = 92;
      var h = Math.round(28 + th + body.height + 24 + 44 + 20);
      var y0 = Math.round(Math.max(80, (H - h) / 2 - 40));
      this.panelImg(c, 24, y0, W - 48, h);
      if (opts.portrait) {
        F.ensureTexture(this, 'people');
        var vi = C.VILLAGER_ORDER.indexOf(opts.portrait);
        this.baked(c, 44, y0 + 18, 'ui-portrait-bg', 70, 80, function (g) {
          g.fillStyle(COL.slotEdge, 1).fillRoundedRect(0, 0, 70, 80, 10);
          g.fillStyle(0xbfe0f0, 1).fillRoundedRect(3, 3, 64, 74, 8);
        });
        c.add(this.add.image(79, y0 + 98, 'people', vi * 9).setOrigin(0.5, 0.83).setScale(0.42).setCrop(0, 0, 128, 150));
        c.add(this.txt(126, y0 + 26, opts.name || C.VILLAGERS[opts.portrait].name, 18, INK, { fontStyle: 'bold' }));
        c.add(this.txt(126, y0 + 50, C.VILLAGERS[opts.portrait].role, 12, '#7a5a3a'));
        c.add(this.heartsText(126, y0 + 66, L.friendHearts(F.session.state, opts.portrait)));
      } else if (titleText) { titleText.y = y0 + 24; c.add(titleText); }
      body.y = y0 + 26 + th;
      c.add(body);
      var bw = buttons.length > 1 ? 120 : 150;
      buttons.forEach(function (b, i) {
        var bx = W / 2 + (i - (buttons.length - 1) / 2) * (bw + 14);
        self.button(c, bx, y0 + h - 42, bw, 42, b.label, function () {
          self.closeModal();
          if (b.cb) b.cb();
        }, b.color);
      });
      return c;
    }

    confirm(text, onYes) {
      return this.dialog(text, [{ label: 'No', color: 0xc0703a }, { label: 'Yes', cb: onYes }]);
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
        if (self.modals.length) return;
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'j') {
          F.input.action = true;
          F.input.holding = true;
        }
        else if (e.key === 'e' || e.key === 'i') self.openInventory();
        else if (e.key >= '1' && e.key <= '6') self.select(Number(e.key) - 1);
      });
      kb.on('keyup', function (e) {
        if ((e.key === ' ' || e.key === 'Enter' || e.key === 'j') && F.input.holding) {
          F.input.holding = false;
          F.input.released = true;
        }
      });
    }
  };
})(window.Farm = window.Farm || {});
