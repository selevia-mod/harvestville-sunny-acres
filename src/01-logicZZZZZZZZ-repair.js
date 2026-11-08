// The birthday repair (owner, 8 Nov 2026: "Lets repair all of them ... Make 10k gold and some materials that wasted on
// that"; then "give them 20k to cover the 19k lost"). From 29 Oct to 8 Nov 2026 a farm's birthday was saved over its builds list (01-logicB.js wrote o.bd), so the
// next load forgot the Stable, the Bigger Coop and Barn and Mira's furniture, and let go of the animals the small coop
// and barn could not hold. 01-logic.js gives back the buildings it can tell from the save (s.repairBd); here, once the
// whole farm is loaded: the Cat Basket when the cat is there, the furniture still in the house (placed or stored), and
// for every such farm the lumber and stone the Stable, Bigger Coop and Bigger Barn take, and a letter from the mayor
// saying sorry with 20,000 gold in it (owner: enough to buy back the most a farm lost, about 19,000). The save it writes has the builds list back (the birthday is o.bb), so it is once.
// Loaded after every other 01- file (its deserialize runs last).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;
  var H = C.HOME;

  C.REPAIR_BD = { gold: 20000, lumber: 180, stone: 20 }; // (lumber: Stable 60 + Bigger Coop 40 + Bigger Barn 80; stone: the Barn's 20)
  C.LETTERS.sorry_bd = {
    from: 'hollis',
    text: 'We are so sorry! A mix-up in the town records made some farms forget their buildings, and some animals wandered off. Your Bigger Coop and Bigger Barn are built, your Stable is back if you had a horse, and we added 180 lumber and 20 stone. Here are 20,000 gold to bring back your animals. - Mayor Hollis',
    gift: ['gold', 20000], // (C.REPAIR_BD.gold: a letter with a gift is never let go from a full mailbox, 01-logic2.js)
  };
  var FURN = { f_plant: 'big_plant', f_music: 'music_box', f_aquarium: 'aquarium', f_cat: 'cat_bed' };

  // Is a piece of this home furniture type in the house, placed or stored?
  var inHouse = function (s, key) {
    var t = H.typeIndex[key], home = s.home;
    if (t == null || !home) return false;
    if ((home.items || []).some(function (it) { return it.t === t; })) return true;
    return Object.keys(home.bag || {}).some(function (k) { return home.bag[k] > 0 && Number(k.split('.')[0]) === t; });
  };

  // The coloured animals (owner, 8 Nov 2026: "Add a small extra repair"). The animals let go were the newest, so the ones
  // bred or bought in a colour; the colours are still in the Breeds book (s.brf), and an animal never leaves a farm any
  // other way, so a colour in the book with none in the pen was lost: one grown animal of each comes home while there is
  // room (the plain colour aside: everyone has it), with a letter from Lily. Once per farm: every save written from now
  // on says so (o.rb), new farms included (they lost nothing).
  C.LETTERS.breeds_back = {
    from: 'lily',
    text: 'Good news! The animals that wandered off in the mix-up found their way home. One of each colour in your Breeds book is back in your coop and barn. Take good care of them! - Lily',
  };
  // Brings back the lost colours; returns how many came.
  L.breedsBack = function (s) {
    var n = 0;
    C.ANIMAL_KEYS.forEach(function (kind) {
      var defs = C.BREEDS[kind] || [];
      for (var b = 1; b < defs.length; b++) {
        if (!L.breedFound(s, kind, b) || L.space(s, kind) <= 0) continue;
        if (s.animals.some(function (a) { return a.kind === kind && L.breedOf(a) === b; })) continue;
        s.animals.push({ kind: kind, name: L.nextName(s, kind), love: 0, fed: 0, pet: 0, ready: 0, brushed: 0, young: 0, preg: 0, br: b });
        n++;
      }
    });
    return n;
  };
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    o.rb = 1;
    return o;
  };
  var deserializeB = L.deserialize;
  L.deserialize = function (o) {
    var s = deserializeB(o);
    if (s && !o.rb && L.breedsBack(s) && s.mail.indexOf('breeds_back') < 0) s.mail.unshift('breeds_back');
    return s;
  };

  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s || !s.repairBd) return s;
    delete s.repairBd;
    if (s.cat) s.builds.f_cat = 1;
    Object.keys(FURN).forEach(function (id) { if (inHouse(s, FURN[id])) s.builds[id] = 1; });
    s.lumber += C.REPAIR_BD.lumber;
    s.stone += C.REPAIR_BD.stone;
    if (s.mail.indexOf('sorry_bd') < 0) s.mail.unshift('sorry_bd'); // (first in the mailbox: the first letter read)
    return s;
  };
})(window.Farm = window.Farm || {});
