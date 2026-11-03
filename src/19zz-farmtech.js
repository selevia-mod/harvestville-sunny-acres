// Farm tech on the farm and in the shops (rules 01-logicZ-farmtech.js, content 00-zzzzzzz-farmtech.js): sprinklers you
// place on tilled soil and pick up again (a little spray turns on each), fertilizer spread on a 3x3 patch (a speckle on
// the soil), the star of a Silver or Gold crop on its bag slot, Bram's sprinklers at the Forge, Lily's fertilizer under
// Supplies, and the greenhouse (a plot of soil under a glass frame) from Mira. The greenhouse and the spray are drawn on
// canvases here until there is art (art-src/FARMTECH-PROMPTS.md). The tours: 19zz-farmtech-tours.js.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var OD = C.OUTDOOR;
  var DEPTH = F.WorldScene.DEPTH;
  var P = F.WorldScene.prototype;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, SLOT = K.SLOT;
  var GREEN = 0x5fa84a, BLUE = 0x4a90c9;
  var GH = OD.index.greenhouse;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var visiting = function (w) { return !!(w.state && w.state.isVisit); };
  var world = function () { return F.world; };
  var cropName = function (id) { return C.ITEMS[id].name; };

  // ---------- pictures drawn here (once each, shared by every scene) ----------
  var canvasTex = function (scene, key, w, h, draw) {
    if (scene.textures.exists(key)) return key;
    var t = scene.textures.createCanvas(key, w, h), g = t.getContext();
    g.lineJoin = 'round';
    draw(g, w, h);
    t.refresh();
    return key;
  };
  // fertilizer on the soil: pale grains (Rich: more, with gold flecks)
  var fertTex = function (scene, level) {
    return canvasTex(scene, 'ft-fert' + level, 128, 128, function (g) {
      var seed = 7;
      var rnd = function () { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      for (var i = 0; i < (level > 1 ? 46 : 30); i++) {
        var x = 10 + rnd() * 108, y = 10 + rnd() * 108, r = 2 + rnd() * 2.5;
        g.beginPath();
        g.arc(x, y, r, 0, Math.PI * 2);
        g.fillStyle = level > 1 && i % 4 === 0 ? 'rgba(255,214,90,0.95)' : 'rgba(238,226,196,0.85)';
        g.fill();
      }
    });
  };
  // the spray over a sprinkler: two arcs of drops (it turns)
  var sprayTex = function (scene) {
    return canvasTex(scene, 'ft-spray', 160, 160, function (g) {
      for (var a = 0; a < 2; a++) for (var i = 0; i < 6; i++) {
        var ang = a * Math.PI + i * 0.22, rr = 34 + i * 8;
        g.beginPath();
        g.ellipse(80 + Math.cos(ang) * rr, 80 + Math.sin(ang) * rr * 0.6, 5, 7, ang, 0, Math.PI * 2);
        g.fillStyle = 'rgba(160,220,255,' + (0.9 - i * 0.1) + ')';
        g.fill();
      }
    });
  };
  // The greenhouse, 128 px a tile: the floor under the soil (a stone edge), the glass frame over it (corner posts, thin
  // mullions, a peaked roof standing above its top row), and both together for lists and Decorate.
  var GW = 4 * 128, GHH = 3 * 128, ROOF = 112;
  var ghFloor = function (g) {
    g.fillStyle = '#9a917f'; // a gravel floor
    g.fillRect(0, 0, GW, GHH);
    g.fillStyle = 'rgba(70,60,48,0.25)';
    for (var k = 0; k < 160; k++) g.fillRect((k * 97) % GW, (k * 61) % GHH, 5, 4);
    // a bed of soil on every tile, edged with boards
    for (var r = 0; r < 3; r++) for (var c = 0; c < 4; c++) {
      g.fillStyle = '#7a5230';
      g.fillRect(c * 128 + 14, r * 128 + 14, 100, 100);
      g.fillStyle = '#5a3a20';
      g.fillRect(c * 128 + 22, r * 128 + 22, 84, 84);
    }
  };
  var ghFrame = function (g, top) {
    var y0 = top; // the glass box from y0 to y0 + GHH
    // the roof: a low peak of glass panes above the top row
    g.beginPath();
    g.moveTo(-2, y0 + 6);
    g.lineTo(GW / 2, y0 - ROOF + 10);
    g.lineTo(GW + 2, y0 + 6);
    g.closePath();
    g.fillStyle = 'rgba(200,236,255,0.55)';
    g.fill();
    g.strokeStyle = '#f6f2e8';
    g.lineWidth = 10;
    g.stroke();
    g.lineWidth = 5;
    for (var k = 1; k < 4; k++) { g.beginPath(); g.moveTo(GW * k / 4, y0 + 6); g.lineTo(GW / 2, y0 - ROOF + 10); g.stroke(); }
    // a light sheen of glass on the walls, kept clear over the soil
    g.fillStyle = 'rgba(200,236,255,0.22)';
    g.fillRect(0, y0, 18, GHH);
    g.fillRect(GW - 18, y0, 18, GHH);
    g.fillRect(0, y0, GW, 16);
    // the frame
    g.strokeStyle = '#3b2312';
    g.lineWidth = 14;
    g.strokeRect(7, y0 + 7, GW - 14, GHH - 14);
    g.strokeStyle = '#f6f2e8';
    g.lineWidth = 9;
    g.strokeRect(7, y0 + 7, GW - 14, GHH - 14);
    g.lineWidth = 4;
    g.strokeStyle = 'rgba(246,242,232,0.8)';
    for (var x = 128; x < GW; x += 128) { g.beginPath(); g.moveTo(x, y0 + 4); g.lineTo(x, y0 + 18); g.moveTo(x, y0 + GHH - 18); g.lineTo(x, y0 + GHH - 4); g.stroke(); }
    // corner posts
    [[0, y0], [GW - 22, y0], [0, y0 + GHH - 30], [GW - 22, y0 + GHH - 30]].forEach(function (p) {
      g.fillStyle = '#f6f2e8';
      g.strokeStyle = '#3b2312';
      g.lineWidth = 4;
      g.beginPath();
      g.rect(p[0] + 2, p[1] + 2, 20, 26);
      g.fill();
      g.stroke();
    });
    // a little sign: a sprout
    g.fillStyle = '#6fbf4a';
    g.beginPath();
    g.ellipse(GW / 2 - 10, y0 - 34, 12, 6, -0.5, 0, Math.PI * 2);
    g.ellipse(GW / 2 + 10, y0 - 38, 12, 6, 0.5, 0, Math.PI * 2);
    g.fill();
  };
  var ghFloorTex = function (scene) { return canvasTex(scene, 'ft-gh-floor', GW, GHH, ghFloor); };
  var ghFrameTex = function (scene) { return canvasTex(scene, 'ft-gh-frame', GW, GHH + ROOF, function (g) { ghFrame(g, ROOF); }); };
  var ghWholeTex = function (scene) {
    return canvasTex(scene, 'ft-gh-whole', GW, GHH + ROOF, function (g) {
      g.save();
      g.translate(0, ROOF);
      ghFloor(g);
      g.restore();
      ghFrame(g, ROOF);
    });
  };
  // A list row or Decorate shows the whole greenhouse; the farm draws its floor here and its frame over the crops.
  var yardImg = F.yardImg;
  F.yardImg = function (scene, t, shape) {
    if (t !== GH) return yardImg(scene, t, shape);
    var type = OD.types[t];
    return { key: ghWholeTex(scene), frame: undefined, w: type.w * 128, h: type.h * 128 + ROOF }; // (the roof stands above)
  };
  var yardInfo = F.yardInfo;
  F.yardInfo = function (s, i) {
    if (i !== GH) return yardInfo ? yardInfo(s, i) : null;
    return 'Any crop grows inside in any season. 4x3 soil that waters itself, and no weeds.' + (L.yardCantBuy(s, i) ? ' You have one.' : '');
  };

  // ---------- the farm: sprinklers, fertilizer, the greenhouse ----------
  var create = P.create;
  P.create = function () {
    this.ftSp = null; // (a restarted scene keeps its properties, not its pictures)
    this.ftFe = null;
    this.ftFrames = [];
    create.call(this);
  };
  var setupFarm = P.setupFarm;
  P.setupFarm = function () {
    this.ftSp = {};
    this.ftFe = {};
    setupFarm.call(this);
  };
  // What a soil tile shows on top: its sprinkler (the icon, standing on it, and its turning spray) and its fertilizer.
  P.ftTile = function (idx) {
    if (!this.ftSp || this.mapKey !== 'farm') return;
    var self = this, t = this.state.soil[idx], w = this.map.width, x = idx % w, y = Math.floor(idx / w);
    var sp = this.ftSp[idx], fe = this.ftFe[idx], tier = t && t.sp ? t.sp - 1 : -1;
    if (tier >= 0 && (!sp || sp.tier !== tier)) {
      if (sp) { this.tweens.killTweensOf(sp.spray); sp.img.destroy(); sp.spray.destroy(); }
      var cx = x * T + T / 2, cy = y * T + T / 2;
      sp = this.ftSp[idx] = {
        tier: tier,
        img: this.add.image(cx, y * T + T - 10, 'items', C.ITEMS[C.SPRINKLERS[tier].id].icon).setOrigin(0.5, 1).setScale(2).setDepth(DEPTH.crops + 0.1),
        spray: this.add.image(cx, cy - 60, sprayTex(this)).setScale([2.4, 3, 4.6][tier]).setAlpha(0.85).setDepth(DEPTH.crops + 0.2),
      };
      this.tweens.add({ targets: sp.spray, angle: 360, duration: 2600, repeat: -1, delay: (idx * 37) % 900 });
    } else if (tier < 0 && sp) {
      this.tweens.killTweensOf(sp.spray);
      sp.img.destroy();
      sp.spray.destroy();
      delete this.ftSp[idx];
    }
    var lvl = t && t.f && !t.sp ? t.f : 0;
    if (lvl && (!fe || fe.lvl !== lvl)) {
      if (fe) fe.img.destroy();
      this.ftFe[idx] = { lvl: lvl, img: this.add.image(x * T + T / 2, y * T + T / 2, fertTex(self, lvl)).setDisplaySize(T - 24, T - 24).setDepth(DEPTH.Soil + 0.2) };
    } else if (!lvl && fe) {
      fe.img.destroy();
      delete this.ftFe[idx];
    }
  };
  var refreshTile = P.refreshTile;
  P.refreshTile = function (idx) {
    refreshTile.call(this, idx);
    this.ftTile(idx);
  };
  P.ftRefreshAll = function () {
    if (!this.ftSp) return;
    var self = this, s = this.state;
    Object.keys(this.ftSp).concat(Object.keys(this.ftFe)).forEach(function (k) { if (!s.soil[k]) self.ftTile(Number(k)); });
    Object.keys(s.soil).forEach(function (k) { if (s.soil[k].sp || s.soil[k].f) self.ftTile(Number(k)); });
  };
  var refreshAllSoil = P.refreshAllSoil;
  P.refreshAllSoil = function () {
    refreshAllSoil.call(this);
    this.ftRefreshAll();
  };
  // the greenhouse: its floor under the soil (a plot), its glass frame over the crops
  var renderYard = P.renderYard;
  P.renderYard = function () {
    var self = this;
    (this.ftFrames || []).forEach(function (img) { img.destroy(); });
    this.ftFrames = [];
    renderYard.call(this);
    this.state.yard.items.forEach(function (it, i) {
      if (it.t !== GH || !self.yardSprites[i]) return;
      var type = OD.types[GH];
      self.yardSprites[i].setTexture(ghFloorTex(self)).setDisplaySize(type.w * T, type.h * T);
      self.ftFrames.push(self.add.image(it.x * T, (it.y + type.h) * T, ghFrameTex(self)).setOrigin(0, 1)
        .setDisplaySize(type.w * T, (type.h + ROOF / 128) * T).setDepth(DEPTH.crops + 0.5));
    });
    this.ftRefreshAll();
  };
  // Putting a plot away gives its sprinklers back: say so when the bag can't hold them.
  var yardStore = P.yardStore;
  P.yardStore = function () {
    var got = null, store = L.storeYard;
    L.storeYard = function (s, i) { got = store(s, i); return got; };
    try { yardStore.call(this); } finally { L.storeYard = store; }
    if (got === 'sprinklers') F.ui.toast('Your bag is full. Make room for the sprinklers on it first.', 3000);
    this.refreshAllSoil();
  };

  // No tool works on a sprinkler's tile (the hammer would flatten its soil away).
  var toolEffect = P.toolEffect;
  P.toolEffect = function (tool, x, y) {
    if (this.mapKey === 'farm' && this.inMap(x, y)) {
      var t = this.state.soil[this.idx(x, y)];
      if (t && t.sp) return null;
    }
    return toolEffect.call(this, tool, x, y);
  };
  // More squares to show a Gold Sprinkler's 5x5.
  var showArea = P.showArea;
  P.showArea = function (tiles) {
    while (tiles && tiles.length > this.areaCells.length) {
      this.areaCells.push(this.add.rectangle(0, 0, T - 24, T - 24, 0xffffff, 0.28).setOrigin(0).setDepth(DEPTH.cursor).setVisible(false));
    }
    return showArea.call(this, tiles);
  };

  // ---------- the action button ----------
  var resolve = P.resolve;
  P.resolve = function () {
    if (this.mapKey === 'farm' && !visiting(this) && !F.session.riding) {
      var a = this.ftAction();
      if (a) return a;
    }
    return resolve.call(this);
  };
  var tileList = function (w, idxs) { return idxs.map(function (k) { return [k % w.map.width, Math.floor(k / w.map.width)]; }); };
  P.ftAction = function () {
    var self = this, s = this.state, t = this.facing(), pt = this.front(0.7);
    if (!this.inMap(t.x, t.y)) return null;
    if ((this.villagers && this.villagers.at(pt.x, pt.y)) || (this.herd && this.herd.at(pt.x, pt.y)) || (this.dog && this.dog.near(pt.x, pt.y))) return null;
    if (this.pieceAt && this.pieceAt(t.x, t.y) >= 0) return null;
    var held = L.held(s), def = held && C.ITEMS[held.id], idx = this.idx(t.x, t.y), soil = s.soil[idx];
    if (def && def.kind === 'sprinkler') {
      var why = L.sprinklerCantPlace(s, idx), area = tileList(this, L.sprinklerTiles(idx, def.tier)).concat([[t.x, t.y]]);
      var words = {
        nosoil: 'Place a sprinkler on tilled soil. Till it with the Hoe first.',
        taken: 'There is a sprinkler here already.',
        crop: 'Place it on a tilled tile with nothing growing on it.',
        greenhouse: 'The greenhouse waters itself. Place sprinklers out in your field.',
      };
      if (why) return { label: 'Place', icon: def.icon, preview: why === 'nosoil' ? null : area, disabled: true, why: words[why] };
      return { label: 'Place', icon: def.icon, preview: area, run: function () { self.ftPlace(t, idx); } };
    }
    if (def && def.kind === 'fert') {
      var patch = this.seedArea(t).filter(function (p) { return self.inMap(p[0], p[1]); });
      var can = patch.filter(function (p) { return L.canFertilize(s, self.idx(p[0], p[1]), def.level); }).length;
      if (!can) return { label: 'Spread', icon: def.icon, preview: patch, disabled: true, why: 'Spread ' + def.name + ' on tilled soil, before you plant or on seeds and sprouts. One bag covers the 3x3 around this tile.' };
      return { label: 'Spread', icon: def.icon, preview: patch, run: function () { self.ftFertilize(t, patch); } };
    }
    if (soil && soil.sp && !(def && def.kind === 'seed')) {
      var sp = C.SPRINKLERS[soil.sp - 1];
      return { label: 'Pick up', icon: C.ITEMS[sp.id].icon, preview: tileList(this, L.sprinklerTiles(idx, soil.sp - 1)), run: function () { self.ftPickUp(t, idx); } };
    }
    return null;
  };
  P.ftPlace = function (t, idx) {
    var self = this, s = this.state, held = L.held(s), def = held && C.ITEMS[held.id];
    if (!def || L.placeSprinkler(s, idx, s.sel) !== 'ok') return;
    var wet = L.sprinklerTiles(idx, def.tier);
    this.refreshTile(idx);
    wet.forEach(function (k) { if (s.soil[k]) { self.refreshTile(k); } });
    this.puff(t, 0x9fd3ea, 4);
    sfx('water');
    this.floatText(t, def.name);
    this.changed();
    this.save();
  };
  P.ftPickUp = function (t, idx) {
    var s = this.state, r = L.pickUpSprinkler(s, idx);
    if (r === 'full') { sfx('nope'); return F.ui.toast('Your bag is full!'); }
    if (r !== 'ok') return;
    this.refreshTile(idx);
    this.puff(t, 0xd9c8a8, 2);
    sfx('pick');
    this.changed();
    this.save();
  };
  P.ftFertilize = function (t, patch) {
    var self = this, s = this.state, held = L.held(s), def = held && C.ITEMS[held.id];
    var idxs = patch.map(function (p) { return self.idx(p[0], p[1]); });
    var n = L.fertilize(s, idxs, s.sel);
    if (typeof n !== 'number') return;
    idxs.forEach(function (k) { self.refreshTile(k); });
    this.animateUse(def.icon, 'pour');
    this.puff(t, 0xeee2c4, 5);
    sfx('plant');
    this.floatText(t, def.name + ' x' + n);
    this.changed();
  };
  // Seeds: in the greenhouse anything can be planted, even out of season; a sprinkler's tile takes no seed.
  var seedAction = P.seedAction;
  P.seedAction = function (t, def) {
    var self = this, s = this.state;
    if (this.mapKey !== 'farm') return seedAction.call(this, t, def);
    var area = this.seedArea(t), idxs = area.filter(function (p) { return self.inMap(p[0], p[1]); }).map(function (p) { return self.idx(p[0], p[1]); });
    var open = function (k) { return s.soil[k] && !s.soil[k].c && !s.soil[k].sp; };
    if (!L.cropInSeason(def.crop, s.day) && L.canPlantHere(s, def.crop, idxs)) {
      var inside = idxs.filter(function (k) { return L.inGreenhouse(s, k) && open(k); }).length;
      if (!inside) return { label: 'Plant', icon: def.icon, preview: area, disabled: true, why: 'Out of season, ' + def.name + ' grow only in the greenhouse. Till its soil first.' };
      return { label: 'Plant', icon: def.icon, preview: area, run: function () { self.plantArea(t, area); } };
    }
    var a = seedAction.call(this, t, def);
    if (a && a.run && !idxs.some(open)) return { label: 'Plant', icon: def.icon, preview: area, disabled: true, why: 'A seed bag plants the 3x3 tilled patch around this tile. Till the soil first.' };
    return a;
  };
  // A Silver or Gold crop says so as you pick it.
  var harvest = P.harvest;
  P.harvest = function (t, idx) {
    L.takeFtNotes();
    harvest.call(this, t, idx);
    var notes = L.takeFtNotes();
    if (!notes.length) return;
    var best = notes.reduce(function (a, b) { return b.q > a.q ? b : a; });
    sfx('found');
    this.floatTextAt((t.x + 0.5) * T, (t.y - 0.6) * T, (notes.length > 1 ? notes.length + ' ' : '') + L.qualityName(best.q) + ' ' + cropName(best.item) + '!');
    if (F.ftQualityFound) F.ftQualityFound(best);
  };

  // ---------- the bag: a star on a Silver or Gold slot ----------
  var starTex = function (ui, q) {
    return ui.bakeCanvas('ft-star-' + q, 16, 16, function (g) {
      g.beginPath();
      for (var i = 0; i < 10; i++) {
        var r = i % 2 ? 3.2 : 7.4, a = -Math.PI / 2 + i * Math.PI / 5;
        g.lineTo(8 + Math.cos(a) * r, 8.4 + Math.sin(a) * r);
      }
      g.closePath();
      g.fillStyle = q > 1 ? '#ffd23a' : '#e4ebf2';
      g.strokeStyle = q > 1 ? '#8a5a08' : '#4e5a6a';
      g.lineWidth = 1.6;
      g.fill();
      g.stroke();
    });
  };
  U.ftStarTex = function (q) { return starTex(this, q); };
  var slotWidget = U.slotWidget;
  U.slotWidget = function (parent, x, y, onTap) {
    var w = slotWidget.call(this, parent, x, y, onTap);
    w.star = this.add.image(x + 11, y + 11, starTex(this, 2)).setScale(1 / F.R).setVisible(false);
    if (parent) parent.add(w.star);
    return w;
  };
  var drawSlot = U.drawSlot;
  U.drawSlot = function (w, slot, selected) {
    drawSlot.call(this, w, slot, selected);
    if (!w.star) return;
    var q = slot && slot.q;
    w.star.setVisible(!!q);
    if (q) w.star.setTexture(starTex(this, q));
  };
  // the held item's name says its quality ("Gold Turnip"), in the bag and over the toolbar
  var itemName = L.itemName;
  L.itemName = function (s, id) {
    var name = itemName(s, id), held = s && s.inv && s.inv[s.sel];
    return held && held.id === id && held.q ? L.qualityName(held.q) + ' ' + name : name;
  };
  // Selling one at the stall: its quality's prices, and a star under its picture.
  var openSellOptions = U.openSellOptions;
  if (openSellOptions) {
    U.openSellOptions = function (shelf, inv, n) {
      var self = this, slot = F.session.state.inv[inv], q = slot && slot.q;
      var c = L.withQuality(q, function () { return openSellOptions.call(self, shelf, inv, n); });
      if (c && q) {
        var name = C.ITEMS[slot.id].name;
        c.list.forEach(function (o) { if (o.type === 'Text' && o.text === name) o.setText(L.qualityName(q) + ' ' + name); }); // the ribbon
        c.add(this.add.image(W / 2 + 26, 160, starTex(this, q)).setScale(1.4 / F.R));
      }
      return c;
    };
  }
  // the bag: a Silver or Gold item's price
  var openInventory = U.openInventory;
  U.openInventory = function () {
    var self = this, r = openInventory.apply(this, arguments), inner = this.invRefresh;
    if (inner) this.invRefresh = function () { inner.apply(this, arguments); self.ftBagPrice(); };
    this.ftBagPrice();
    return r;
  };
  U.ftBagPrice = function () {
    var s = F.session.state, held = L.held(s), m = this.modals[this.modals.length - 1];
    if (!held || !held.q || !m || !C.ITEMS[held.id].sell) return;
    var was = ' Sells for ' + C.ITEMS[held.id].sell + 'G.';
    m.c.list.forEach(function (o) {
      if (o.type === 'Text' && o.text.slice(-was.length) === was) o.setText(o.text.slice(0, -was.length) + ' ' + L.qualityName(held.q) + ': sells for ' + L.qualityPrice(held.id, held.q) + 'G.');
    });
  };

  // ---------- Bram's Forge: the sprinklers ----------
  // (the Forge's own rows come first, then these three)
  var withRows = function (ui, extra, fn) {
    var lp = ui.listPanel;
    ui.listPanel = function (o) { o.rows = o.rows.concat(extra(o)); return lp.call(this, o); };
    try { return fn(); } finally { if (ui.hasOwnProperty('listPanel')) delete ui.listPanel; }
  };
  // at: how many rows come before them; per: rows a page (to come back to the same page after Make)
  U.sprinklerRows = function (at, per) {
    var self = this, s = F.session.state;
    return C.SPRINKLERS.map(function (sp, tier) {
      var page = Math.floor((at + tier) / per);
      return {
        icon: C.ITEMS[sp.id].icon, name: sp.name + (L.countItem(s, sp.id) ? '  x' + L.countItem(s, sp.id) : ''),
        desc: sp.what + ' Place it on tilled soil.', reward: { gold: sp.gold, item: sp.ore, n: sp.n }, rewardPrefix: 'Cost', buttonsBelow: true,
        buttons: [{
          label: 'Make', color: BLUE, cb: function () {
            var r = L.makeSprinkler(s, tier);
            if (r === 'gold') { sfx('nope'); return self.toast('Not enough gold.'); }
            if (r === 'ore') { sfx('nope'); return self.toast('You need ' + sp.n + ' ' + C.ITEMS[sp.ore].name + '. Find ore in the mine.'); }
            if (r === 'full') { sfx('nope'); return self.toast('Your bag is full.'); }
            sfx('anvil');
            world().changed();
            world().save();
            self.closeModal();
            self.openForge(page);
            self.toast('Clang! Bram made you a ' + sp.name + '. Hold it and face tilled soil to place it.', 3200);
          },
        }],
      };
    });
  };
  var openForge = U.openForge;
  U.openForge = function (page) {
    var self = this;
    return withRows(this, function (o) {
      var at = o.rows.length;
      return self.sprinklerRows(at, at + C.SPRINKLERS.length > 5 ? 4 : 5);
    }, function () { return openForge.call(self, page); });
  };

  // ---------- Lily: fertilizer by 1 or 5 (Supplies); with a greenhouse, every seed (Seeds) ----------
  var openShop = U.openShop;
  U.openShop = function (tab, page) {
    var self = this, s = F.session.state, tb = tab || 'seeds', gh = tb === 'seeds' && L.hasGreenhouse(s);
    if (tb !== 'supplies' && !gh) return openShop.call(this, tab, page);
    var lp = this.listPanel, sis = L.seedsInSeason;
    this.listPanel = function (o) {
      o.rows.forEach(function (row) {
        var id = ['fert', 'fert_rich'].filter(function (k) { return C.ITEMS[k].icon === row.icon; })[0];
        if (id && tb === 'supplies') row.buttons = self.buyButtons(id, [1, 5], function () { if (o.refresh) o.refresh(); });
        var seed = gh && C.SHOP_STOCK.filter(function (k) { return C.ITEMS[k].icon === row.icon; })[0];
        if (seed && !L.cropInSeason(C.ITEMS[seed].crop, s.day)) row.desc = 'Out of season: for your greenhouse. ' + row.desc;
      });
      return lp.call(this, o);
    };
    // (in season first, then the rest for the greenhouse)
    if (gh) L.seedsInSeason = function (day) { var now = sis(day); return now.concat(C.SHOP_STOCK.filter(function (k) { return now.indexOf(k) < 0; })); };
    try { return openShop.call(this, tab, page); } finally {
      L.seedsInSeason = sis;
      if (this.hasOwnProperty('listPanel')) delete this.listPanel;
    }
  };
})(window.Farm = window.Farm || {});
