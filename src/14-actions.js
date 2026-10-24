// What the action button does: the contextual action for the tile (or animal, or villager) in front of
// the farmer, charged tool swings, the field, debris, fishing, foraging and the mine.
// Mixed into WorldScene.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var T = C.TILE;
  var DEPTH = F.WorldScene.DEPTH;
  var TOOL_VERB = { hoe: 'Till', can: 'Water', axe: 'Chop', hammer: 'Smash', sickle: 'Cut' };
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };

  var M = {};

  // ---------- setting up the map's contents ----------
  M.setupFarm = function () {
    this.crops = {};
    this.refreshAllSoil();
    this.refreshDebris();
    var pen = this.zones.pen && this.zones.pen[0];
    this.herd = new F.Herd(this, pen ? { x0: pen.px, y0: pen.py, x1: pen.px + pen.pw, y1: pen.py + pen.ph } : null);
    var yard = this.zones.dogarea && this.zones.dogarea[0];
    if (yard) this.dog = new F.Dog(this, { x0: yard.px, y0: yard.py, x1: yard.px + yard.pw, y1: yard.py + yard.ph });
  };

  M.refreshDebris = function () {
    var self = this, layer = this.layers.Debris, s = this.state;
    if (!layer) return;
    layer.forEachTile(function (t) { if (t.index !== -1) layer.removeTileAt(t.x, t.y); });
    Object.keys(s.debris).forEach(function (idx) {
      idx = Number(idx);
      self.putTile('Debris', self.gids['debris_' + s.debris[idx]], idx % self.map.width, Math.floor(idx / self.map.width));
    });
    layer.setCollisionByProperty({ collides: true });
  };

  M.removeDebrisTile = function (idx) {
    this.layers.Debris.removeTileAt(idx % this.map.width, Math.floor(idx / this.map.width));
  };

  M.setupMine = function () {
    var self = this, s = this.state, floor = F.session.mineFloor, rect = this.zones.minefloor[0];
    var tiles = [];
    for (var y = rect.y0; y <= rect.y1; y++) for (var x = rect.x0; x <= rect.x1; x++) if (!this.tileAt('Walls', x, y)) tiles.push(this.idx(x, y));
    this.mine = L.mineFloor(s, floor, tiles);
    var key = s.day + ':' + floor, broken = F.session.mineBroken[key] = F.session.mineBroken[key] || {};
    this.mine.broken = broken;
    this.mine.rocks.forEach(function (idx) {
      var x = idx % self.map.width, y = Math.floor(idx / self.map.width);
      if (!broken[idx]) self.putTile('Walls', self.gids.mine_rock, x, y);
      else if (idx === self.mine.stairs) self.putTile('Walls', self.gids.ladder_down, x, y);
    });
    this.recollide();
  };

  M.setupForage = function () {
    var self = this, s = this.state, zones = this.zones.forage;
    this.forage = {};
    if (!zones || !C.FORAGE_COUNT[this.mapKey]) return;
    var candidates = [];
    zones.forEach(function (z) {
      for (var y = z.y0; y <= z.y1; y++) for (var x = z.x0; x <= z.x1; x++) {
        var idx = self.idx(x, y);
        if (self.walkable(x, y) && !s.debris[idx] && !s.soil[idx] && !self.objectAt(x, y)) candidates.push(idx);
      }
    });
    var taken = L.forageTaken(s, this.mapKey), icon = C.ITEMS[L.forageItem(s.day)].icon;
    L.forageSpots(s, this.mapKey, candidates).forEach(function (idx) {
      if (taken.indexOf(idx) >= 0) return;
      var x = idx % self.map.width, y = Math.floor(idx / self.map.width);
      var img = self.add.image(x * T + T / 2, y * T + T / 2 + 20, 'items', icon).setScale(1.25).setDepth(DEPTH.forage);
      self.tweens.add({ targets: img, scale: 1.4, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (idx * 53) % 700 });
      self.forage[idx] = img;
    });
  };

  // ---------- the action button ----------
  M.updateAction = function (time) {
    var t = this.facing();
    var action = this.resolve();
    var key = action ? action.label + '|' + action.icon + '|' + !!action.disabled : '';
    if (key !== this.hintKey) {
      this.hintKey = key;
      F.bus.emit('hint', action);
    }

    if (this.charge) {
      var c = this.charge, lvl = Math.min(c.max, Math.floor((time - c.start) / C.CHARGE_MS));
      if (lvl !== c.level) {
        c.level = lvl;
        F.bus.emit('charge', lvl);
        if (lvl) sfx('charge');
      }
      this.showArea(c.action.area(lvl));
      if (F.input.released || !F.input.holding) {
        this.charge = null;
        F.bus.emit('charge', -1);
        c.action.run(lvl);
      }
      F.input.released = false;
      F.input.action = false;
      return;
    }

    this.cursor.setPosition(t.x * T, t.y * T).setVisible(this.inMap(t.x, t.y));
    this.showArea(action && action.preview ? action.preview : null);
    if (F.input.action) {
      F.input.action = false;
      if (action && action.disabled) {
        F.ui.toast(action.why);
        sfx('nope');
      } else if (action && action.charge && F.input.holding) {
        this.charge = { start: time, max: action.charge, level: 0, action: action };
        F.bus.emit('charge', 0);
      } else if (action) {
        action.run(0);
      }
    }
    F.input.released = false;
  };

  M.showArea = function (tiles) {
    var cells = this.areaCells;
    for (var i = 0; i < cells.length; i++) {
      var p = tiles && tiles[i];
      cells[i].setVisible(!!p && this.inMap(p[0], p[1]));
      if (p) cells[i].setPosition(p[0] * T + 12, p[1] * T + 12);
    }
  };

  M.front = function (reach) {
    var f = this.feet(), d = this.dirVec();
    return { x: f.x + d[0] * T * reach, y: f.y + d[1] * T * reach };
  };

  // What the action button would do right now (or null).
  M.resolve = function () {
    var self = this, s = this.state, t = this.facing();
    var pt = this.front(0.7);
    if (this.villagers) {
      var npc = this.villagers.at(pt.x, pt.y);
      if (npc) return this.villagerAction(npc);
    }
    if (this.herd) {
      var m = this.herd.at(pt.x, pt.y);
      if (m) {
        this.herd.hold(m);
        return this.animalAction(m);
      }
    }
    if (this.dog && this.dog.near(pt.x, pt.y)) return this.dogAction();
    var pet = this.petAction(pt);
    if (pet) return pet;
    if (!this.inMap(t.x, t.y)) return null;
    var held = L.held(s), def = held ? C.ITEMS[held.id] : null;
    var o = this.objectAt(t.x, t.y);
    if (o) {
      var oa = this.objectAction(o, held, def);
      if (oa) return oa;
    }
    if (F.session.riding) return this.rideAction(held, def);
    var idx = this.idx(t.x, t.y);
    if (this.forage[idx]) return { label: 'Pick', icon: C.ITEMS[L.forageItem(s.day)].icon, run: function () { self.pickForage(idx); } };
    var wt = this.tileAt('Walls', t.x, t.y);
    if (wt && wt.properties.name === 'ladder_down') {
      return { label: 'Go down', icon: -1, run: function () { self.travel('mine', 'entrance', F.session.mineFloor + 1); } };
    }
    var soil = this.mapKey === 'farm' ? s.soil[idx] : null;
    if (L.isRipe(soil) && !C.CROPS[soil.c].sickle) return { label: 'Harvest', icon: C.ICON.sparkle, run: function () { self.harvest(t, idx); } };
    if (!def) return null;
    if (def.tool && C.TOOLS[def.tool]) return this.toolAction(def.tool, t);
    if (held.id === 'rod') {
      if (this.isWater(t.x, t.y)) return { label: 'Fish', icon: C.ICON.rod, run: function () { self.startFishing(t); } };
      return { label: 'Fish', icon: C.ICON.rod, disabled: true, why: 'Face the pond or the river to fish.' };
    }
    if (def.kind === 'seed') return this.seedAction(t, def);
    if (def.kind === 'feed') {
      var eaters = C.ANIMAL_KEYS.filter(function (k) { return C.ANIMALS[k].feed === held.id; }).map(function (k) { return C.ANIMALS[k].name.toLowerCase(); });
      return { label: 'Feed', icon: def.icon, disabled: true, why: 'Face a ' + eaters.join(' or ') + ' in the pen and tap to feed it.' };
    }
    if (def.kind === 'feather') return { label: 'Propose', icon: def.icon, disabled: true, why: 'Show the Blue Feather to the one you love (8+ hearts, and you need the bigger house).' };
    if (def.kind === 'potion') return { label: 'Potion', icon: def.icon, disabled: true, why: 'Give it to a happy cow (2+ hearts) in the pen.' };
    if (L.energyOf(held.id)) return { label: 'Eat', icon: def.icon, run: function () { self.eat(); } };
    return null;
  };

  M.objectAction = function (o, held, def) {
    var self = this, s = this.state;
    switch (o.type) {
      case 'sleep': return { label: 'Sleep', icon: C.ICON.moon, run: function () { self.askSleep(); } };
      case 'tv': return { label: 'Watch', icon: C.WEATHER[L.weather(s, s.day + 1)].icon, run: function () { self.watchTv(); } };
      case 'kitchen': return { label: 'Cook', icon: C.ICON.lunch, run: function () { F.ui.openKitchen(); } };
      case 'shop': return { label: 'Shop', icon: C.ICON.tag, run: function () { self.openShop(); } };
      case 'sign': return { label: 'Read', icon: -1, run: function () { F.ui.dialog(o.props.text || '...'); } };
      case 'notice': return { label: 'Read', icon: C.ICON.calendar, run: function () { F.ui.noticeBoard(); } };
      case 'door': return { label: 'Enter', icon: -1, run: function () { F.ui.openBuilding(o.props.building); } };
      case 'warp':
        if (o.props.walk) return null;
        return { label: o.props.label || 'Enter', icon: -1, run: function () { self.travel(o.props.to, o.props.spawn); } };
      case 'ship':
        if (def && def.sell) return { label: 'Ship', icon: C.ICON.crate, run: function () { self.ship(); } };
        return { label: 'Box', icon: C.ICON.crate, run: function () { self.showBox(); } };
      case 'incubator':
        if (held && C.FOOD_GROUPS.egg.indexOf(held.id) >= 0 && !s.inc) return { label: 'Incubate', icon: def.icon, run: function () { self.incubate(); } };
        return { label: 'Coop', icon: C.ICON.chicken, run: function () { self.coopInfo(); } };
    }
    return this.extraObjectAction(o, held, def);
  };

  // ---------- tools ----------
  // The tiles a tool swing covers at a charge level, and what it would do to each.
  M.toolTiles = function (tool, t, level) {
    var d = this.dirVec();
    return level ? L.chargeTiles(t.x, t.y, d[0], d[1], level) : [[t.x, t.y]];
  };

  M.toolEffect = function (tool, x, y) {
    var s = this.state;
    if (!this.inMap(x, y)) return null;
    var idx = this.idx(x, y), farm = this.mapKey === 'farm';
    var soil = farm ? s.soil[idx] : null, debris = farm ? s.debris[idx] : null;
    if (debris) {
      var hits = L.debrisHits(s, debris, tool);
      if (hits > 0) return { kind: 'debris', idx: idx, debris: debris, hits: hits };
      if (hits === 0) return { kind: 'hard', idx: idx, debris: debris };
      return null;
    }
    if (tool === 'hoe') return this.isTillable(x, y) && !soil && !this.forage[idx] ? { kind: 'till', idx: idx } : null;
    if (tool === 'can') return soil && !soil.w ? { kind: 'water', idx: idx } : null;
    if (tool === 'sickle') return soil && L.isRipe(soil) && C.CROPS[soil.c].sickle ? { kind: 'cut', idx: idx } : null;
    if (tool === 'hammer') {
      var wt = this.tileAt('Walls', x, y);
      if (wt && wt.properties.name === 'mine_rock') return { kind: 'rock', idx: idx };
      if (soil && !soil.c) return { kind: 'untill', idx: idx };
    }
    return null;
  };

  M.toolAction = function (tool, t) {
    var self = this, s = this.state, level = L.toolLevel(s, tool), icon = L.iconOf(s, tool);
    if (tool === 'can' && this.isWater(t.x, t.y)) return { label: 'Refill', icon: C.ICON.drop, run: function () { self.refill(); } };
    var any = false, hard = null;
    this.toolTiles(tool, t, level).forEach(function (p) {
      var e = self.toolEffect(tool, p[0], p[1]);
      if (e && e.kind === 'hard') hard = hard || e;
      else if (e) any = true;
    });
    var single = this.toolEffect(tool, t.x, t.y);
    if (!any) {
      if (hard) return { label: TOOL_VERB[tool], icon: icon, disabled: true, why: 'This ' + hard.debris + ' is too big. Upgrade your ' + C.ITEMS[tool].name + ' at the forge.' };
      return { label: TOOL_VERB[tool], icon: icon, disabled: true, why: this.toolWhy(tool, t) };
    }
    var label = TOOL_VERB[tool];
    if (single && single.kind === 'debris') label = single.debris === 'weed' ? 'Cut' : tool === 'axe' ? 'Chop' : 'Smash';
    if (single && single.kind === 'rock') label = 'Smash';
    if (single && single.kind === 'untill') label = 'Flatten';
    return {
      label: label, icon: icon, charge: level,
      area: function (lvl) { return self.toolTiles(tool, t, lvl); },
      run: function (lvl) { self.useTool(tool, t, lvl); },
    };
  };

  M.toolWhy = function (tool, t) {
    var s = this.state, soil = s.soil[this.idx(t.x, t.y)];
    switch (tool) {
      case 'hoe': return soil ? 'This soil is already tilled.' : this.mapKey === 'farm' ? 'You can only till the soil in your field.' : 'Till the field back on your farm.';
      case 'can': return soil ? 'Already watered today.' : 'Water tilled soil, or refill the can at the pond.';
      case 'axe': return 'Chop branches and stumps in your field for lumber.';
      case 'hammer': return this.mapKey === 'mine' ? 'Smash the rocks to find ore and the ladder down.' : 'Smash stones and boulders, or flatten empty tilled soil.';
      case 'sickle': return 'Cut weeds, or cut ripe grass into fodder.';
    }
    return '';
  };

  M.useTool = function (tool, t, level) {
    var self = this, s = this.state;
    var effects = this.toolTiles(tool, t, level).map(function (p) { return self.toolEffect(tool, p[0], p[1]); })
      .filter(function (e) { return e && e.kind !== 'hard'; });
    if (tool === 'can') {
      if (s.water <= 0) return F.ui.toast('The can is empty. Refill it at the pond.');
      effects = effects.slice(0, s.water);
    }
    if (!effects.length) return F.ui.toast(this.toolWhy(tool, t));
    var rocks = effects.filter(function (e) { return e.kind === 'rock'; }).length;
    var cost = rocks ? rocks * L.mineEnergy(s, F.session.mineFloor) : L.toolEnergy(s, tool, effects.length);
    if (!L.spendEnergy(s, cost)) return this.tired();
    var gotLumber = 0, gotStone = 0, items = {}, counts = { till: 0, water: 0, clear: 0, cut: 0 };
    this.animateUse(L.iconOf(s, tool), tool === 'can' ? 'pour' : 'swing');
    effects.forEach(function (e) {
      var x = e.idx % self.map.width, y = Math.floor(e.idx / self.map.width), tile = { x: x, y: y };
      if (e.kind === 'till') {
        L.till(s, e.idx);
        counts.till++;
        self.refreshTile(e.idx);
        self.puff(tile, 0x8a5a30, 4);
      } else if (e.kind === 'water') {
        L.water(s, e.idx);
        counts.water++;
        self.refreshTile(e.idx);
        self.wiggle(e.idx);
        self.drops(tile);
      } else if (e.kind === 'cut') {
        var got = L.cut(s, e.idx);
        if (got[0] === '!') return;
        items[got] = (items[got] || 0) + 1;
        counts.cut++;
        self.refreshTile(e.idx);
        self.puff(tile, 0x93d66b, 5);
        self.flyTile(tile, C.ITEMS[got].icon);
      } else if (e.kind === 'untill') {
        delete s.soil[e.idx];
        self.refreshTile(e.idx);
        self.puff(tile, 0x8a5a30, 3);
      } else if (e.kind === 'debris') {
        self.hits[e.idx] = (self.hits[e.idx] || 0) + 1;
        var chip = e.debris === 'weed' ? 0x6cbf4a : e.debris === 'branch' || e.debris === 'stump' ? 0xc48945 : 0x9aa0a8;
        if (self.hits[e.idx] < e.hits) {
          self.shake(tile);
          self.chips(tile, chip, 3);
          return;
        }
        delete self.hits[e.idx];
        var r = L.clearDebris(s, e.idx);
        gotLumber += r.lumber;
        gotStone += r.stone;
        counts.clear++;
        self.removeDebrisTile(e.idx);
        self.puff(tile, chip, 4);
        self.chips(tile, chip, e.debris === 'weed' ? 4 : 7);
        if (r.lumber) self.flyTile(tile, C.ICON.lumber);
        if (r.stone) self.flyTile(tile, C.ICON.stone);
      } else if (e.kind === 'rock') {
        self.breakRock(e.idx, tile, items);
      }
    });
    sfx({ hoe: 'till', can: 'water', axe: 'chop', hammer: 'smash', sickle: 'cut' }[tool]);
    if (counts.clear) this.progress('clear', counts.clear);
    if (counts.till) this.progress('till', counts.till);
    if (counts.water) this.progress('water', counts.water);
    if (counts.cut) this.progress('harvest', counts.cut);
    var notes = [];
    if (gotLumber) notes.push('+' + gotLumber + ' Lumber');
    if (gotStone) notes.push('+' + gotStone + ' Stone');
    Object.keys(items).forEach(function (id) { notes.push('+' + items[id] + ' ' + (id === 'stone' ? 'Stone' : C.ITEMS[id].name)); });
    if (notes.length) this.floatText(t, notes.join('  '));
    if (this.layers.Debris) this.layers.Debris.setCollisionByProperty({ collides: true });
    this.changed();
    if (this.mapKey === 'mine' && s.energy <= 0) this.faint();
  };

  // Out of energy deep in the mine: everything goes dark, and you wake up at home.
  M.faint = function () {
    F.ui.toast('You collapsed from exhaustion...', 2500);
    this.endDay(true);
  };

  M.shake = function (t) {
    var layer = this.layers.Debris, tile = layer && layer.getTileAt(t.x, t.y);
    this.puff(t, 0xc9a26b, 2);
    if (!tile) return;
    var cam = this.cameras.main;
    cam.shake(80, 0.002);
  };

  M.breakRock = function (idx, t, items) {
    var s = this.state, floor = F.session.mineFloor, drop = L.mineDrop(floor, Math.random());
    if (drop && drop !== 'stone' && !L.canAdd(s, drop, 1)) {
      F.ui.toast('Your bag is full!');
      return;
    }
    this.mine.broken[idx] = 1;
    if (idx === this.mine.stairs) {
      this.putTile('Walls', this.gids.ladder_down, t.x, t.y);
      F.ui.toast('You found the ladder down!');
      sfx('found');
    } else {
      this.layers.Walls.removeTileAt(t.x, t.y);
    }
    this.recollide();
    this.puff(t, 0x8a7a6a, 7);
    if (!drop) return;
    if (drop === 'stone') s.stone += 1;
    else {
      L.addItem(s, drop, 1);
      L.discover(s, drop);
    }
    items[drop] = (items[drop] || 0) + 1;
    this.flyTile(t, C.ICON[drop]);
  };

  M.tired = function () {
    F.ui.toast("You're too tired. Eat something, or go to bed to recover.");
    sfx('nope');
  };

  M.refill = function () {
    L.refill(this.state);
    this.animateUse(L.iconOf(this.state, 'can'), 'pour');
    this.drops(this.facing());
    sfx('water');
    F.ui.toast('Watering can refilled!');
    this.changed();
  };

  // ---------- seeds, harvest, food ----------
  M.seedArea = function (t) {
    var out = [];
    for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) out.push([t.x + dx, t.y + dy]);
    return out;
  };

  M.seedAction = function (t, def) {
    var self = this, s = this.state, area = this.seedArea(t);
    if (this.mapKey !== 'farm') return { label: 'Plant', icon: def.icon, disabled: true, why: 'Plant seeds in your field on the farm.' };
    if (!L.cropInSeason(def.crop, s.day)) {
      return { label: 'Plant', icon: def.icon, disabled: true, why: def.name + ' only grow in ' + L.seasonsOf(def.crop) + '. Keep them for then!' };
    }
    var free = area.filter(function (p) { var soil = s.soil[self.idx(p[0], p[1])]; return self.inMap(p[0], p[1]) && soil && !soil.c; }).length;
    if (!free) return { label: 'Plant', icon: def.icon, preview: area, disabled: true, why: 'A seed bag plants the 3x3 tilled patch around this tile. Till the soil first.' };
    return { label: 'Plant', icon: def.icon, preview: area, run: function () { self.plantArea(t, area); } };
  };

  M.plantArea = function (t, area) {
    var self = this, s = this.state;
    var idxs = area.filter(function (p) { return self.inMap(p[0], p[1]); }).map(function (p) { return self.idx(p[0], p[1]); });
    var r = L.plantBag(s, idxs, s.sel);
    if (typeof r !== 'number') return;
    idxs.forEach(function (idx) { self.refreshTile(idx); });
    this.animateUse(C.ITEMS[L.held(s) ? L.held(s).id : 'seed_turnip'].icon, 'pour');
    this.puff(t, 0x4a2e18, 6);
    sfx('plant');
    this.floatText(t, 'Planted ' + r);
    this.changed();
    this.progress('plant');
  };

  M.harvest = function (t, idx) {
    var got = L.harvest(this.state, idx);
    if (got === '!full') return F.ui.toast('Your bag is full!');
    if (got[0] === '!') return;
    this.refreshTile(idx);
    this.puff(t, 0x93d66b, 6);
    this.flyTile(t, C.ITEMS[got].icon);
    sfx('harvest');
    this.changed();
    this.progress('harvest');
  };

  M.eat = function () {
    var s = this.state, held = L.held(s), name = C.ITEMS[held.id].name;
    var gain = L.eat(s, s.sel);
    if (gain < 0) return F.ui.toast("You're full of energy already.");
    if (!gain) return;
    sfx('eat');
    var f = this.feet();
    this.floatTextAt(f.x, f.y - 2 * T, '+' + gain + ' energy');
    F.ui.toast('You ate the ' + name + '.');
    this.changed();
  };

  M.pickForage = function (idx) {
    var got = L.takeForage(this.state, this.mapKey, idx);
    if (got === '!full') return F.ui.toast('Your bag is full!');
    var img = this.forage[idx];
    delete this.forage[idx];
    img.destroy();
    this.flyItem(img.x, img.y, C.ITEMS[got].icon);
    sfx('pick');
    this.changed();
  };

  // ---------- shipping, shop, TV, coop ----------
  M.ship = function () {
    var r = L.ship(this.state, this.state.sel);
    if (!r) return;
    sfx('coin');
    F.ui.toast('Shipped ' + r.n + ' ' + C.ITEMS[r.id].name + '. ' + r.value + 'G arrives in the morning.');
    this.changed();
    this.progress('ship');
    this.save();
  };

  M.showBox = function () {
    var s = this.state;
    var lines = s.box.map(function (b) { return b.n + ' x ' + C.ITEMS[b.id].name; });
    F.ui.dialog('SHIPPING BOX\n' + (lines.length
      ? lines.join('\n') + '\nTotal: ' + L.boxValue(s) + 'G, paid while you sleep.'
      : 'Hold a crop, fish, ore or anything else that sells, and press the action button here to ship it. You get paid while you sleep.'));
  };

  M.openShop = function () {
    if (!L.shopOpen(this.state)) {
      var fest = L.festivalOn(this.state.day);
      F.ui.dialog("LILY'S SEED STAND\n" + (fest ? 'Closed today for the ' + fest.name + '. See you in the town plaza!' : 'Closed. The seed stand is open from 9:00 AM to 5:00 PM.'));
      return;
    }
    F.ui.openShop();
  };

  M.watchTv = function () {
    var s = this.state, today = C.WEATHER[L.weather(s, s.day)].name, tomorrow = C.WEATHER[L.weather(s, s.day + 1)].name;
    var extra = [], fest = L.festivalOn(s.day + 1), bdays = L.birthdaysOn(s.day + 1);
    if (fest) extra.push('Tomorrow is the ' + fest.name + '! ' + fest.desc);
    if (bdays.length) extra.push('Tomorrow is ' + bdays.map(function (k) { return C.VILLAGERS[k].name; }).join(' and ') + "'s birthday.");
    sfx('tv');
    F.ui.dialog('WEATHER REPORT\nToday: ' + today + '.  Tomorrow: ' + tomorrow + '.' +
      (tomorrow === 'Rain' || tomorrow === 'Storm' ? ' The rain will water your crops.' : '') + '\n\n' +
      (extra.length ? extra.join('\n') : C.TV[s.day % C.TV.length]));
  };

  M.incubate = function () {
    var r = L.incubate(this.state, this.state.sel);
    if (r === 'full') return F.ui.toast('The coop is full. Build a bigger coop at the woodshop.');
    if (r !== 'ok') return;
    sfx('pick');
    F.ui.toast('You put the egg in the incubator. A chick hatches in ' + C.INCUBATE_DAYS + ' days!');
    this.changed();
  };

  M.coopInfo = function () {
    var s = this.state;
    F.ui.dialog('COOP\n' + L.animalCount(s, 'chicken') + ' of ' + L.capacity(s, 'chicken') + ' chickens.\n' +
      (s.inc ? 'An egg is in the incubator: it hatches in ' + s.inc + (s.inc > 1 ? ' days.' : ' day.') : 'Hold an egg and use the coop to put it in the incubator. A chick hatches in ' + C.INCUBATE_DAYS + ' days.'));
  };

  // ---------- animals and the dog ----------
  M.animalAction = function (m) {
    var self = this, s = this.state, a = s.animals[m.i], def = C.ANIMALS[a.kind];
    var held = L.held(s), hdef = held ? C.ITEMS[held.id] : null;
    if (a.ready) return { label: def.milk ? 'Milk' : 'Collect', icon: C.ITEMS[a.ready === 2 ? def.large : def.product].icon, run: function () { self.collectFrom(m); } };
    if (hdef && hdef.kind === 'feed' && !a.fed) {
      if (a.young) return { label: 'Feed', icon: hdef.icon, disabled: true, why: a.name + ' is still little and drinks from mum. Grown in ' + a.young + (a.young > 1 ? ' days.' : ' day.') };
      if (def.feed === held.id) return { label: 'Feed', icon: hdef.icon, run: function () { self.feedAnimal(m); } };
      return { label: 'Feed', icon: hdef.icon, disabled: true, why: def.name + 's eat ' + C.ITEMS[def.feed].name + ', not ' + hdef.name + '.' };
    }
    if (held && held.id === 'brush' && !a.brushed) return { label: 'Brush', icon: C.ICON.brush, run: function () { self.brushAnimal(m); } };
    if (held && held.id === 'miracle') return { label: 'Potion', icon: C.ICON.miracle, run: function () { self.potion(m); } };
    if (!a.pet) return { label: 'Pet', icon: C.ICON.heart, run: function () { self.petAnimal(m); } };
    return { label: a.name, icon: def.icon, run: function () { self.animalInfo(m); } };
  };

  M.collectFrom = function (m) {
    var got = L.collect(this.state, m.i);
    if (got === '!milker') return F.ui.toast('You need a Milker to milk cows. Lily sells them.');
    if (got === '!full') return F.ui.toast('Your bag is full!');
    if (got[0] === '!') return;
    this.flyItem(m.x, m.y - m.def.height * T * 0.5, C.ITEMS[got].icon);
    sfx('pick');
    this.changed();
    this.progress('collect');
  };

  M.feedAnimal = function (m) {
    if (L.feedAnimal(this.state, m.i, this.state.sel) !== 'ok') return;
    m.eat = true;
    m.wait = 3000;
    this.herd.hearts(m, 1);
    sfx(m.def === C.ANIMALS.cow ? 'moo' : 'cluck');
    this.floatTextAt(m.x, m.y - m.def.height * T, 'Yum!');
    this.changed();
    this.progress('feed');
  };

  M.petAnimal = function (m) {
    L.petAnimal(this.state, m.i);
    this.herd.hearts(m, 3);
    sfx(m.def === C.ANIMALS.cow ? 'moo' : 'cluck');
    this.floatTextAt(m.x, m.y - m.def.height * T, this.state.animals[m.i].name + ' is happy!');
    this.changed();
  };

  M.brushAnimal = function (m) {
    if (L.brushAnimal(this.state, m.i) !== 'ok') return;
    this.herd.hearts(m, 2);
    sfx('brush');
    this.floatTextAt(m.x, m.y - m.def.height * T, 'So shiny!');
    this.changed();
  };

  M.potion = function (m) {
    var a = this.state.animals[m.i];
    var r = L.givePotion(this.state, m.i, this.state.sel);
    var why = {
      notcow: 'The Miracle Potion is for cows.', young: a.name + ' is too young.', already: a.name + ' is already expecting a calf!',
      love: a.name + ' needs 2 hearts first. Pet, feed and brush every day.', full: 'The barn is full. Build a bigger barn first.',
    };
    if (r !== 'ok') return F.ui.toast(why[r] || 'Hmm.');
    this.herd.hearts(m, 4);
    sfx('found');
    F.ui.dialog('GOOD NEWS!\n' + a.name + ' is expecting a calf! It will arrive in ' + C.PREGNANT_DAYS + ' days.');
    this.changed();
  };

  M.animalInfo = function (m) {
    var a = this.state.animals[m.i], def = C.ANIMALS[a.kind], h = L.hearts(a);
    var lines = [a.name + '  ' + (h ? new Array(h + 1).join('♥') + ' (' + h + '/5)' : 'no hearts yet')];
    if (a.young) lines.push('Still little: grown in ' + a.young + (a.young > 1 ? ' days.' : ' day.'));
    else lines.push((a.fed ? 'Fed today. ' : 'Hungry! Give it ' + C.ITEMS[def.feed].name + '. ') + (a.pet ? 'Petted today.' : 'Wants a pet.'));
    if (a.preg) lines.push('A calf is on the way: ' + a.preg + (a.preg > 1 ? ' days.' : ' day.'));
    if (!a.young && h < 3) lines.push('At 3 hearts it gives large produce.');
    F.ui.toast(lines.join('\n'));
  };

  M.dogAction = function () {
    var self = this, d = this.state.dog;
    if (!d.pet) return { label: 'Pet', icon: C.ICON.dog, run: function () { self.petDog(); } };
    return { label: d.name, icon: C.ICON.dog, run: function () {
      var h = Math.floor(d.love / 20);
      F.ui.toast(d.name + '  ' + (h ? new Array(h + 1).join('♥') : 'no hearts yet') + '\nYour loyal dog. Pet him every day.');
    } };
  };

  M.petDog = function () {
    L.petDog(this.state);
    this.dog.happy();
    sfx('woof');
    this.floatTextAt(this.dog.x, this.dog.y - T, this.state.dog.name + ' wags his tail!');
    this.changed();
  };

  // ---------- fishing ----------
  M.startFishing = function (t) {
    var s = this.state;
    if (!L.spendEnergy(s, C.FISH_ENERGY)) return this.tired();
    var bob = this.add.image(t.x * T + T / 2, t.y * T + T / 2, 'items', C.ICON.bobber).setScale(1).setDepth(DEPTH.fx);
    this.tweens.add({ targets: bob, y: bob.y + 16, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.fishing = { state: 'wait', biteAt: this.time.now + Phaser.Math.Between(C.FISH_BITE[0], C.FISH_BITE[1]), bob: bob, t: t };
    this.animateUse(C.ICON.rod, 'swing');
    sfx('cast');
    F.bus.emit('hint', { label: 'Wait...', icon: C.ICON.rod });
    this.hintKey = 'fishing';
    this.changed();
  };

  M.updateFishing = function (time) {
    var f = this.fishing, s = this.state;
    if (f.state === 'wait' && time >= f.biteAt) {
      f.state = 'bite';
      f.until = time + C.FISH_WINDOW;
      var p = this.feet();
      f.mark = this.add.image(p.x, p.y - 2.4 * T, 'items', C.ICON.exclaim).setScale(1.3).setDepth(DEPTH.Above + 1);
      this.tweens.killTweensOf(f.bob);
      this.tweens.add({ targets: f.bob, y: f.bob.y + 40, duration: 90, yoyo: true, repeat: 4 });
      sfx('bite');
      F.bus.emit('hint', { label: 'Reel!', icon: C.ICON.exclaim });
    }
    if (F.input.action) {
      F.input.action = false;
      if (f.state === 'bite') {
        // hooked! now reel it in with the mini-game
        var self = this, fish = L.rollFish(this.mapKey === 'town' ? 'river' : 'pond', Math.random());
        f.state = 'game';
        if (f.mark) f.mark.destroy();
        f.mark = null;
        F.ui.startFishGame(fish, function (ok) {
          var bx = f.bob.x, by = f.bob.y;
          self.endFishing();
          if (!ok) {
            sfx('nope');
            return F.ui.toast('It got away...');
          }
          var got = L.landFish(s, fish);
          if (got === '!full') return F.ui.toast('Your bag is full!');
          sfx('catch');
          self.flyItem(bx, by, C.ITEMS[got].icon);
          F.ui.toast('You caught a ' + C.ITEMS[got].name + '!' + (got === 'fish_k' ? ' The legendary King Trout!' : ''));
          self.changed();
        });
      } else if (f.state === 'game') {
        return;
      } else {
        this.endFishing();
        F.ui.toast('Too soon! Wait for the "!" before you reel in.');
      }
      return;
    }
    if (f.state === 'bite' && time > f.until) {
      this.endFishing();
      sfx('nope');
      F.ui.toast('It got away...');
    }
  };

  M.endFishing = function () {
    var f = this.fishing;
    if (!f) return;
    f.bob.destroy();
    if (f.mark) f.mark.destroy();
    this.fishing = null;
    this.hintKey = null;
  };

  // ---------- soil & crop rendering ----------
  M.refreshTile = function (idx) {
    var w = this.map.width, x = idx % w, y = Math.floor(idx / w);
    var tile = this.state.soil[idx];
    if (tile) this.putTile('Soil', tile.w ? this.gids.tilled_wet : this.gids.tilled, x, y);
    else this.layers.Soil.removeTileAt(x, y);

    var stage = L.cropStage(tile), spr = this.crops[idx];
    if (stage < 0) {
      if (spr) { spr.destroy(); delete this.crops[idx]; }
      return;
    }
    if (!spr) {
      spr = this.crops[idx] = this.add.image(x * T + T / 2, y * T + T - 12, 'crops').setOrigin(0.5, 1).setDepth(DEPTH.crops);
    }
    spr.setFrame(stage < 2 ? stage : 2 + C.CROPS[tile.c].art * 2 + (stage - 2)); // seeds, sprout, then per-crop frames
    if (stage === 3 && !spr.sway) {
      spr.sway = this.tweens.add({ targets: spr, angle: { from: -4, to: 4 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut', delay: (idx * 37) % 500 });
    } else if (stage !== 3 && spr.sway) {
      spr.sway.remove();
      spr.sway = null;
      spr.angle = 0;
    }
  };

  M.refreshAllSoil = function () {
    var self = this, soil = this.layers.Soil;
    soil.forEachTile(function (t) { if (t.index !== -1) soil.removeTileAt(t.x, t.y); });
    Object.keys(this.crops).forEach(function (idx) {
      if (!self.state.soil[idx]) {
        self.crops[idx].destroy();
        delete self.crops[idx];
      }
    });
    Object.keys(this.state.soil).forEach(function (idx) { self.refreshTile(Number(idx)); });
  };

  Object.assign(F.WorldScene.prototype, M);
})(window.Farm = window.Farm || {});
