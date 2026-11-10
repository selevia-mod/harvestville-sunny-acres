// Contests at the festivals on screen (content 00-zzzzzzz-contests.js, rules 01-logicZ-contests.js).
// Talk to Mayor Hollis at the Cow Festival (Animal Contest), the Harvest Festival (Crop Contest) or Starry Night (the
// Noche Buena Cook-off, next to the evening with someone): pick your entry from a list that shows its points, then the
// judging: the host and the judge say a word, and the four entries are shown from 4th place up, each score filling its
// bar, a ribbon on the top three. 1st place is that year's trophy. Ribbons and trophies: Collection, Ribbons.
// The morning report says so the day before and on the day; so does the calendar. A tour the first time.
// The ribbons and the cup are the owner's pictures (assets/contests: tools/art/contests-import.js), not item icons (the
// items sheet is full); each size is painted once from that small sheet, with the place written on the ribbon's centre.
// The drawn ones stay for when the sheet is not there.
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var U = F.UIScene.prototype;
  var K = F.UI_CONST, W = K.W, H = K.H, INK = K.INK;
  var D = F.UI_DRAW;
  var KC = C.CONTEST;
  var GREEN = 0x5fa84a, GREY = 0xa08a68, BLUE = 0x4a90c9, GOLD = 0xd9a62a;
  var sfx = function (name) { if (F.Audio) F.Audio.sfx(name); };
  var world = function () { return F.world; };
  var fmt = function (n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var still = function () {
    try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  };
  var who = function (k) { return C.VILLAGERS[k].name; };

  // ---------- the ribbons and the cup ----------
  // The sheet's frames (the same numbers as tools/art/contests-import.js): the 4 ribbons, 1st to 4th, each fw x fh and
  // fw + gap apart, its cream centre at (fw / 2, cy); then the cup in a cup x cup square. Painted at each size it is shown
  // (with the browser's good downscaling, sharper than the GPU shrinking a big frame), so no sheet stays on the GPU.
  var ART = { fw: 176, fh: 288, cy: 100, gap: 4, cup: 240 };
  var sheet = function () { var i = F.images && F.images.contests; return i && i.naturalWidth ? i : null; };
  // A rosette for a place (1 blue, 2 red, 3 yellow, 4 green "thanks"), size px across.
  U.ctRosette = function (parent, x, y, place, size) {
    var col = KC.colors[place] || KC.colors[4], S = size, pic = sheet();
    return this.canvasImg(parent, x, y, (pic ? 'ct-rosp-' : 'ct-ros-') + place + '-' + S, S, S * 1.25, function (g) {
      var r = S * 0.3, cx = S / 2, cy = S * 0.42;
      if (pic) { // the picture, its cream centre where the drawn one has its centre
        var q = cy / ART.cy, w = ART.fw * q;
        g.imageSmoothingQuality = 'high';
        g.drawImage(pic, (Math.min(place, 4) - 1) * (ART.fw + ART.gap), 0, ART.fw, ART.fh, cx - w / 2, 0, w, ART.fh * q);
      } else drawn(g, r, cx, cy, col);
      g.fillStyle = '#3d2614';
      g.font = 'bold ' + Math.round(r * 0.95) + 'px "Trebuchet MS", Verdana, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(place <= 3 ? String(place) : '♥', cx, cy + 1);
    }).setOrigin(0.5, 0.42 / 1.25); // (x, y) is the middle of the rosette
  };
  // The drawn rosette (no picture): a pleated circle, two tails, a cream centre.
  var drawn = function (g, r, cx, cy, col) {
    [-1, 1].forEach(function (d) { // the two tails
      g.beginPath();
      g.moveTo(cx + d * r * 0.2, cy);
      g.lineTo(cx + d * r * 1.05, cy + r * 2.3);
      g.lineTo(cx + d * r * 0.62, cy + r * 1.95);
      g.lineTo(cx + d * r * 0.3, cy + r * 2.4);
      g.lineTo(cx - d * r * 0.25, cy + r * 0.4);
      g.closePath();
      g.fillStyle = col[1];
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = '#3d2614';
      g.stroke();
    });
    for (var i = 0; i < 14; i++) { // the pleated edge
      var a = i * Math.PI / 7;
      D.circle(g, cx + Math.cos(a) * r * 1.02, cy + Math.sin(a) * r * 1.02, r * 0.38);
      g.fillStyle = i % 2 ? col[0] : col[1];
      g.fill();
    }
    D.circle(g, cx, cy, r * 1.06);
    g.lineWidth = 1.5;
    g.strokeStyle = 'rgba(61,38,20,0.5)';
    g.stroke();
    D.circle(g, cx, cy, r * 0.72);
    g.fillStyle = '#fff6d8';
    g.fill();
    g.strokeStyle = '#3d2614';
    g.stroke();
  };
  // The year's trophy: a little gold cup on a wooden base.
  U.ctCup = function (parent, x, y, size) {
    var S = size, pic = sheet();
    return this.canvasImg(parent, x, y, (pic ? 'ct-cupp-' : 'ct-cup-') + S, S, S, function (g) {
      if (pic) {
        g.imageSmoothingQuality = 'high';
        return g.drawImage(pic, 4 * (ART.fw + ART.gap), 0, ART.cup, ART.cup, 0, 0, S, S);
      }
      var u = S / 48;
      g.save();
      g.scale(u, u);
      g.lineWidth = 2;
      g.strokeStyle = '#5a3a12';
      // handles
      [-1, 1].forEach(function (d) {
        g.beginPath();
        g.arc(24 + d * 13, 14, 6, d < 0 ? Math.PI * 0.5 : Math.PI * 1.5, d < 0 ? Math.PI * 1.5 : Math.PI * 0.5, d > 0);
        g.lineWidth = 3.5;
        g.strokeStyle = '#c8961a';
        g.stroke();
      });
      // the bowl
      g.beginPath();
      g.moveTo(11, 6);
      g.lineTo(37, 6);
      g.quadraticCurveTo(37, 27, 24, 29);
      g.quadraticCurveTo(11, 27, 11, 6);
      g.closePath();
      g.fillStyle = D.vgrad(g, 6, 29, '#ffe27a', '#d9a020');
      g.fill();
      g.lineWidth = 2;
      g.strokeStyle = '#7a5212';
      g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(15, 9, 3, 12);
      // stem and base
      g.fillStyle = '#d9a020';
      g.fillRect(21, 29, 6, 6);
      g.strokeRect(21, 29, 6, 6);
      D.rrect(g, 13, 35, 22, 9, 2);
      g.fillStyle = '#8a5a32';
      g.fill();
      g.strokeStyle = '#4a2e18';
      g.stroke();
      g.fillStyle = '#ffe27a';
      g.fillRect(19, 38, 10, 3);
      g.restore();
    }).setOrigin(0.5);
  };

  // ---------- at the festival ----------
  var openFestival = U.openFestival;
  U.openFestival = function (fest, page) {
    var self = this, s = F.session.state, ct = L.ctOf(fest);
    if (!ct || F.session.visit) return openFestival.apply(this, arguments);
    var res = L.ctResult(s, ct.key);
    if (fest.kind === 'harvest' || fest.kind === 'cow') { // the contest is the festival
      if (res) return this.say('hollis', 'Mayor Hollis', this.ctThanks(ct, res));
      if (L.joinedFestival(s, fest)) return openFestival.apply(this, arguments);
      return this.openContest(ct, page);
    }
    // Starry Night: the evening with someone, and the Cook-off
    if (res) return openFestival.apply(this, arguments);
    if (L.joinedFestival(s, fest)) return this.openContest(ct, page);
    return this.dialog('"Tonight there is something for everyone! Spend the evening with someone dear, or bring a dish to our ' + ct.name + '. Why not both?"', [
      { label: 'The evening', color: BLUE, cb: function () { openFestival.call(self, fest, page); } },
      { label: 'Cook-off', cb: function () { self.openContest(ct, 0); } },
    ], { portrait: 'hollis' });
  };

  U.ctThanks = function (ct, res) {
    var what = ct.what === 'animal' ? res.w : C.ITEMS[res.w] ? 'your ' + C.ITEMS[res.w].name : 'your entry';
    return 'Thank you for entering the ' + ct.name + '! ' + (res.p <= 3 ? KC.places[res.p] + ' with ' + what + ': well done!' : 'Better luck next year with ' + what + '.') +
      ' Enjoy the rest of the day.';
  };

  // The entry list: everything you could bring, the best first, with its points.
  U.openContest = function (ct, page) {
    var self = this, s = F.session.state;
    if (!L.tipSeen(s, 'contest_tour') && !F.session.visit && !(window.gameHost && window.gameHost.quiet)) {
      L.takeTip(s, 'contest_tour');
      F.Host.save(s);
      return this.tour('contest', function () { self.openContest(ct, page); });
    }
    var rows = L.ctChoices(s, ct.key).map(function (o) {
      var desc;
      if (ct.what === 'animal') {
        desc = Math.floor(o.love / 20) + ' hearts' + (o.breed && o.breed.name ? ', ' + o.breed.name : '') + '. ' + o.score + ' points.\n' +
          (o.fed ? 'Fed ✓' : 'Not fed') + '  ' + (o.pet ? 'Petted ✓' : 'Not petted') + '  ' + (o.brushed ? 'Brushed ✓' : 'Not brushed');
      } else if (ct.what === 'crop') {
        desc = o.score + ' points. Sells for ' + o.sell + 'G.' + (o.stars ? ' ' + new Array(o.stars + 1).join('★') : ''); // (every crop is in season since economy v2: no "In season!" line)
      } else {
        desc = o.score + ' points. ' + o.parts + (o.parts > 1 ? ' things' : ' thing') + ' in it, ' + o.energy + ' energy.';
      }
      return {
        icon: o.icon, name: o.name, desc: desc,
        buttons: [{ label: 'Enter', cb: function () { self.ctConfirm(ct, o); } }],
      };
    });
    var empty = { animal: 'Bring a grown animal next year! Feed, pet and brush it on the day.',
      crop: 'Bring a crop in your bag to enter!', dish: 'Cook a dish in your kitchen and bring it in your bag. Food from a shop does not count!' };
    this.listPanel({
      title: ct.name, rows: rows, page: page || 0,
      reopen: function (t, p) { self.openContest(ct, p); },
      sub: function () { return 'Judge: ' + who(ct.judge) + ', ' + C.VILLAGERS[ct.judge].role.toLowerCase() + '. 1st ' + fmt(KC.gold[1]) + 'G and the trophy, 2nd ' + fmt(KC.gold[2]) + 'G, 3rd ' + fmt(KC.gold[3]) + 'G.'; },
      empty: empty[ct.what],
    });
  };

  U.ctConfirm = function (ct, o) {
    var self = this, s = F.session.state;
    var keep = ct.what === 'animal' ? ' (it comes home after)' : ' (the judges keep it)';
    this.dialog(ct.name.toUpperCase() + '\nEnter ' + (ct.what === 'animal' ? o.name : 'your ' + o.name) + keep + '? You can enter once a year.', [
      { label: 'Not yet', color: GREY },
      {
        label: 'Enter', cb: function () {
          var r = L.ctEnter(s, ct.key, o.choice);
          if (r.error) {
            self.closeAll();
            return self.toast({ closed: 'The contest is over for today.', entered: 'You already entered this year.', choice: 'That cannot be entered.' }[r.error] || 'Hmm.');
          }
          world().changed();
          world().save();
          self.ctJudge(ct, r);
        },
      },
    ]);
  };

  // ---------- the judging ----------
  U.ctJudge = function (ct, r) {
    var self = this;
    this.closeAll();
    var names = r.entries.filter(function (e) { return !e.me; }).map(function (e) { return who(e.who).replace(/^(Grandma|Grandpa|Father|Dr\.) /, ''); });
    this.playLines([
      ['hollis', ct.intro + ' This year ' + names.slice(0, 2).join(', ') + ' and ' + names[2] + ' entered too.'],
      [ct.judge, ct.look],
    ], function () { self.ctCard(ct, r); });
  };

  // The card: four rows, 1st on top, shown from 4th place up.
  U.ctCard = function (ct, r) {
    var self = this, move = !still(), timers = [];
    var ROW = 64, GAP = 6, ph = 62 + 4 * (ROW + GAP) + 92, y0 = Math.round(Math.max(70, (H - ph) / 2 - 20));
    var done = false, finish = function () {
      if (done) return;
      done = true;
      timers.forEach(function (t) { t.remove(false); });
      self.tweens.killTweensOf(c.list);
      self.closeModal();
      self.ctAfter(ct, r);
    };
    var c = this.openModal(finish);
    this.panelImg(c, 18, y0, W - 36, ph);
    var title = this.txt(W / 2, y0 + 4, ct.name.toUpperCase(), 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, Math.min(W - 40, Math.max(170, title.width + 44)));
    c.add(title);
    c.add(this.txt(W / 2, y0 + 28, 'Judge: ' + who(ct.judge) + '   ' + r.year, 12, '#7a5a3a', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    var top = y0 + 52, BX = 98, BW = 132;
    var rows = r.entries.map(function (e, k) {
      var y = top + k * (ROW + GAP), row = self.add.container(0, y);
      c.add(row);
      self.canvasImg(row, 30, 0, 'ct-row-' + (e.me ? 'me' : 'v'), W - 60, ROW, function (g) {
        D.rrect(g, 1, 1, W - 62, ROW - 2, 10);
        g.fillStyle = e.me ? '#fff1b8' : '#f4e3b8';
        g.fill();
        g.lineWidth = e.me ? 3 : 1.5;
        g.strokeStyle = e.me ? '#d9a62a' : '#c9a26b';
        g.stroke();
      });
      if (e.who) {
        F.ensureTexture(self, 'people');
        row.add(self.add.image(60, ROW - 3, 'people', C.VILLAGER_ORDER.indexOf(e.who) * 9).setOrigin(0.5, 1).setScale(0.26).setCrop(0, 0, 128, 150));
        row.add(self.add.image(78, ROW - 16, 'items', e.icon).setScale(0.16));
      } else {
        row.add(self.add.image(62, ROW / 2, 'items', e.icon).setScale(0.28));
      }
      var nm = self.txt(BX, 7, e.name + (e.me ? '  (you)' : ''), 12, INK, { fontStyle: 'bold', wordWrap: { width: 160 } });
      if (nm.height > 32) nm.setScale(32 / nm.height);
      row.add(nm);
      self.baked(row, BX, 44, 'ct-bar-bg', BW, 10, function (g) { g.fillStyle(0xd8bf8a, 1).fillRoundedRect(0, 0, BW, 10, 5); });
      var bar = self.add.rectangle(BX + 1, 49, BW - 2, 8, e.me ? 0xe0a020 : 0x6fa84a).setOrigin(0, 0.5);
      row.add(bar);
      var num = self.txt(BX + BW + 8, 49, '', 14, INK, { fontStyle: 'bold' }).setOrigin(0, 0.5);
      row.add(num);
      var place = k + 1, badge = self.ctRosette(row, W - 62, ROW / 2 - 3, place, place <= 3 ? 40 : 34); // (4th: the green one)
      return { row: row, bar: bar, num: num, badge: badge, e: e };
    });
    var result = this.txt(W / 2, top + 4 * (ROW + GAP) + 4, r.text, 14, INK, { fontStyle: 'bold', align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5, 0);
    c.add(result);
    var btn = this.add.container(0, 0);
    c.add(btn);
    var show = function (o, animate) {
      o.row.setAlpha(1);
      var sc = o.e.score / 100;
      if (!animate) { o.bar.scaleX = sc; o.num.setText(String(o.e.score)); o.badge.setAlpha(1); return; }
      o.bar.scaleX = 0;
      var n = { v: 0 };
      self.tweens.add({ targets: o.bar, scaleX: sc, duration: 420, ease: 'Quad.out' });
      self.tweens.add({ targets: n, v: o.e.score, duration: 420, onUpdate: function () { o.num.setText(String(Math.round(n.v))); } });
      self.tweens.add({ targets: o.badge, alpha: 1, scale: { from: o.badge.scale * 1.6, to: o.badge.scale }, duration: 260, delay: 420 });
    };
    var end = function () {
      result.setAlpha(1);
      self.button(btn, W / 2, top + 4 * (ROW + GAP) + 62, 150, 40, r.place <= 3 ? 'Hooray!' : 'OK', finish, r.place <= 3 ? GOLD : GREEN);
      if (r.place <= 3) sfx('fanfare');
    };
    if (!move) {
      rows.forEach(function (o) { show(o, false); });
      return end();
    }
    rows.forEach(function (o) { o.row.setAlpha(0); o.badge.setAlpha(0); });
    result.setAlpha(0);
    sfx('drumroll');
    [3, 2, 1, 0].forEach(function (k, n) {
      timers.push(self.time.delayedCall(350 + n * 750, function () { show(rows[k], true); if (k === 0) sfx('coin'); }));
    });
    timers.push(self.time.delayedCall(350 + 4 * 750, end));
    return c;
  };

  // After the card: the confetti, and the prize on its own card (the ribbon, and the cup for 1st).
  U.ctAfter = function (ct, r) {
    var self = this, prize = r.place <= 3;
    if (prize) this.fireworks(ct.key === 'cook' ? 'stars' : 'fireworks');
    var c = this.openModal(function () { self.closeModal(); });
    var ph = prize ? 306 : 270, y0 = Math.round((H - ph) / 2 - 30);
    this.panelImg(c, 30, y0, W - 60, ph);
    var title = this.txt(W / 2, y0 + 4, (prize ? KC.places[r.place] : 'THANK YOU').toUpperCase() + '!', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, Math.max(170, title.width + 44));
    c.add(title);
    var ty = y0 + 34;
    if (prize) {
      var ros = this.ctRosette(c, r.trophy ? W / 2 - 44 : W / 2, y0 + 82, r.place, 76), big = [ros];
      if (r.trophy) big.push(this.ctCup(c, W / 2 + 46, y0 + 80, 80));
      if (!still()) this.tweens.add({ targets: big, y: '-=6', duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      ty = y0 + 158;
    } else { // 4th: the green thank-you ribbon, smaller and without the fanfare
      this.ctRosette(c, W / 2, y0 + 70, r.place, 56);
      ty = y0 + 128;
    }
    c.add(this.txt(W / 2, ty, r.text + '\nSee it in the Collection: tap Ribbons.', 14, INK, { align: 'center', lineSpacing: 3, wordWrap: { width: W - 96 } }).setOrigin(0.5, 0));
    this.button(c, W / 2, y0 + ph - 34, 130, 40, 'OK', function () { self.tweens.killTweensOf(c.list); self.closeModal(); }, GREEN);
    if (r.gold) this.toast('+' + fmt(r.gold) + 'G', 2200, 0x7a4d12);
    return c;
  };

  // ---------- Ribbons: in the Collection ----------
  var label = { animal: 'Animal', crop: 'Crop', cook: 'Cook-off' };
  U.openRibbons = function (page) {
    var self = this, s = F.session.state, list = L.ctRibbons(s).slice().reverse(), per = 9;
    page = page || 0;
    var pages = Math.max(1, Math.ceil(list.length / per));
    page = Math.min(page, pages - 1);
    var c = this.openModal(function () { self.closeModal(); self.openCollection(); });
    var ph = 500, y0 = Math.round((H - ph) / 2 - 10);
    this.panelImg(c, 12, y0, W - 24, ph);
    var title = this.txt(W / 2, y0 + 4, 'RIBBONS & TROPHIES', 16, '#ffe9a8', { fontStyle: 'bold', stroke: '#3d2614', strokeThickness: 3 }).setOrigin(0.5);
    this.ribbon(c, W / 2, y0 + 4, Math.max(200, title.width + 44));
    c.add(title);
    c.add(this.txt(W / 2, y0 + 30, 'Trophies ' + L.ctTrophies(s).length + '    Ribbons ' + list.length, 13, '#7a5a3a', { fontStyle: 'bold' }).setOrigin(0.5, 0));
    var cw = 100, ch = 120, x0 = (W - 3 * cw) / 2, gy = y0 + 56;
    list.slice(page * per, page * per + per).forEach(function (r, k) {
      var x = x0 + (k % 3) * cw, y = gy + Math.floor(k / 3) * ch, ct = L.ctDef(r.c);
      self.baked(c, x + 3, y, 'ct-cell', cw - 6, ch - 6, function (g) { g.fillStyle(0xe8cf98, 1).fillRoundedRect(0, 0, cw - 6, ch - 6, 10); });
      if (r.p === 1) {
        self.ctCup(c, x + cw / 2 - 18, y + 28, 38);
        self.ctRosette(c, x + cw / 2 + 18, y + 24, 1, 32);
      } else self.ctRosette(c, x + cw / 2, y + 24, r.p, 36);
      var what = ct.what === 'animal' ? r.w : C.ITEMS[r.w] ? C.ITEMS[r.w].name : '';
      c.add(self.txt(x + cw / 2, y + 70, label[r.c] + ' ' + r.y, 12, INK, { fontStyle: 'bold' }).setOrigin(0.5, 0));
      var t = self.txt(x + cw / 2, y + 88, what, 11, '#6a4a2a', { align: 'center' }).setOrigin(0.5, 0);
      if (t.width > cw - 12) t.setScale((cw - 12) / t.width);
      c.add(t);
    });
    if (!list.length) {
      var next = C.CONTESTS.map(function (ct) { var f = L.ctFest(ct); return C.MONTHS[f.date[0] - 1].slice(0, 3) + ' ' + f.date[1] + '  ' + ct.name + ' (' + f.name + ')'; });
      c.add(this.txt(W / 2, gy + 30, 'No ribbons yet!\n\nEnter a contest at a festival:\n' + next.join('\n') + '\n\nTalk to Mayor Hollis in the plaza on the day.', 13, INK,
        { align: 'center', lineSpacing: 4, wordWrap: { width: 290 } }).setOrigin(0.5, 0));
    }
    var by = y0 + ph - 34;
    if (page > 0) this.button(c, W / 2 - 110, by, 90, 36, 'Back', function () { self.closeModal(); self.openRibbons(page - 1); }, GREY);
    if (page < pages - 1) this.button(c, W / 2 + 110, by, 90, 36, 'More', function () { self.closeModal(); self.openRibbons(page + 1); }, BLUE);
    this.button(c, W / 2, by, 110, 36, 'Close', function () { self.closeModal(); self.openCollection(); }, GREEN);
    return c;
  };
  var openCollection = U.openCollection;
  U.openCollection = function () {
    openCollection.apply(this, arguments);
    var self = this, c = this.modals[this.modals.length - 1].c;
    this.button(c, 64, 100, 84, 32, 'Ribbons', function () { self.closeModal(); self.openRibbons(0); }, GOLD);
  };

  // ---------- the morning report: a contest today or tomorrow ----------
  var dayReport = U.dayReport;
  U.dayReport = function (result, s) {
    var note = L.ctNote(s), self = this, dialog = this.dialog;
    if (!note) return dayReport.apply(this, arguments);
    this.dialog = function (text, buttons, opts) {
      delete self.dialog;
      if (opts && opts.rows) {
        var at = 0;
        opts.rows.forEach(function (r, k) { if (/^(Today is the |Weekend Market)/.test(r[1])) at = k + 1; });
        opts.rows.splice(at, 0, [C.ICON.ribbon, note]);
        text = text.split('\n')[0] + '\n' + opts.rows.map(function (r) { return r[1]; }).join('\n');
      }
      return dialog.call(self, text, buttons, opts);
    };
    try { return dayReport.apply(this, arguments); } finally { if (Object.prototype.hasOwnProperty.call(this, 'dialog')) delete this.dialog; }
  };

  // ---------- the tour ----------
  var icon = function (ui, sc, x, y, frame, scale) { var i = ui.add.image(x, y, 'items', frame).setScale(scale || 0.3); sc.add(i); return i; };
  var words = function (ui, sc, x, y, str, size, color) { var t = ui.txt(x, y, str, size || 12, color || INK, { fontStyle: 'bold' }).setOrigin(0.5); sc.add(t); return t; };
  var tw = function (ui, move, cfg) { if (move) ui.tweens.add(cfg); };
  F.TOURS.contest = {
    title: 'FESTIVAL CONTESTS',
    steps: [
      {
        text: 'Three festivals have a contest: animals at the Cow Festival, crops at Harvest, dishes on Starry Night.',
        draw: function (ui, sc, move) {
          [[54, C.ANIMALS.cow.icon, 'Nov 20'], [136, C.ITEMS.pumpkin.icon, 'Oct 12'], [218, C.ITEMS.pumpkin_pie.icon, 'Dec 24']].forEach(function (p, k) {
            var i = icon(ui, sc, p[0], 54, p[1], 0.34);
            words(ui, sc, p[0], 104, p[2], 13);
            tw(ui, move, { targets: i, y: 46, duration: 420, delay: k * 140, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          });
        },
      },
      {
        text: 'Bring your best. A loved animal you fed, petted and brushed that day scores high. Three villagers enter too!',
        draw: function (ui, sc, move) {
          var a = icon(ui, sc, 76, 64, C.ANIMALS.cow.icon, 0.4);
          [[150, 'heart'], [190, 'fodder'], [230, 'brush']].forEach(function (p, k) {
            var i = icon(ui, sc, p[0], 50, C.ICON[p[1]], 0.22);
            tw(ui, move, { targets: i, scale: 0.27, duration: 380, delay: k * 160, yoyo: true, repeat: -1 });
          });
          words(ui, sc, 190, 96, '92 points', 16, '#a8740c');
          tw(ui, move, { targets: a, angle: { from: -4, to: 4 }, duration: 500, yoyo: true, repeat: -1 });
        },
      },
      {
        text: 'Win a ribbon and Gold. 1st place takes home the year\'s trophy. See them in the Collection: Ribbons.',
        draw: function (ui, sc, move) {
          var r1 = ui.ctRosette(sc, 70, 58, 1, 48), r2 = ui.ctRosette(sc, 136, 62, 2, 40), r3 = ui.ctRosette(sc, 192, 64, 3, 36);
          var cup = ui.ctCup(sc, 244, 60, 50);
          words(ui, sc, 136, 112, '1st  1,500G', 13, '#a8740c');
          tw(ui, move, { targets: [r1, cup], y: '-=6', duration: 460, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          tw(ui, move, { targets: [r2, r3], angle: { from: -6, to: 6 }, duration: 600, yoyo: true, repeat: -1 });
        },
      },
    ],
  };
})(window.Farm = window.Farm || {});
