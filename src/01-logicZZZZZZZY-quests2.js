// Quests v2, the rules (owner, 8 Nov 2026; docs/quests-v2.md): your dog's name (it was Biscuit for everyone; owner:
// "let users name it"), where each daily quest leads (the dog guide: 19zzzzzzzzzzzz-guide.js), a villager's reason on
// every daily quest (owner: "this will make the quest more reasonable"), and the one quest on the card.
// Saved: 'dn' (the dog's name, once you named it), 'qp' ([day, quest]: the pinned quest).
(function (F) {
  'use strict';
  var C = F.Config;
  var L = F.Logic;

  // ---------- your dog's name ----------
  L.dogName = function (s) { return (s && s.dog && s.dog.name) || C.DOG.name; };
  L.dogNamed = function (s) { return !!(s && s.dogNamed); };
  // 'ok' | 'empty' | 'rude' (the farmer's name's rules: 01-logicA.js)
  L.setDogName = function (s, text) {
    var raw = L.cleanText(text, C.FARMER_NAME);
    if (!raw) return 'empty';
    var t = L.cleanName(raw);
    if (!t) return 'rude';
    s.dog = s.dog || { name: C.DOG.name, love: 0, pet: 0 };
    s.dog.name = t;
    s.dogNamed = 1;
    return 'ok';
  };

  // ---------- where each quest leads (by its counter): a map and the spot on it ----------
  // to: an object's name on that map, or 'field' (your field's soil), 'water' (the nearest water's edge), 'debris' (the
  // nearest weed or stone), 'zone:<kind>' (a zone of the map: the animal pen, the dog's yard, a forage spot)
  C.QUEST_PLACES = {
    water: { map: 'farm', to: 'field', say: 'To the field!' },
    till: { map: 'farm', to: 'field', say: 'To the field!' },
    plant: { map: 'farm', to: 'field', say: 'To the field!' },
    harvest: { map: 'farm', to: 'field', say: 'To the field!' },
    clear: { map: 'farm', to: 'debris', say: 'I found a weed!' },
    fish: { map: 'farm', to: 'water', here: true, say: 'To the water!' }, // (here: the nearest on the map you are on first)
    care: { map: 'farm', to: 'zone:pen', say: 'To the animals!' },
    collect: { map: 'farm', to: 'zone:pen', say: 'To the animals!' },
    pet: { map: 'farm', to: 'zone:dogarea', say: 'Pet me, pet me!' },
    forage: { map: 'farm', to: 'zone:forage', here: true, say: 'I smell something!' },
    // (to a villager you have not talked to / given a gift to today, the nearest; the fountain when none is out:
    // owner, 8 Nov 2026, "I tap Go for talk to 5 villagers and nothing happen")
    talk: { map: 'town', to: 'villager', not: 'talked', here: true, say: 'Let\'s say hi!' },
    gift: { map: 'town', to: 'villager', not: 'gifted', here: true, say: 'Give them a gift!' },
    earned: { map: 'town', to: 'farm_stand', say: 'To the market!' },
    cooked: { map: 'farm', to: 'house_door', say: 'To your kitchen!' },
    order: { map: 'town', to: 'order_board', say: 'To the order board!' },
    request: { map: 'town', to: 'notice', say: 'To the notice board!' },
    floor: { map: 'town', to: 'mine_door', say: 'To the mine!' },
  };
  L.questPlace = function (c) { return C.QUEST_PLACES[c] || null; };

  // ---------- a villager's reason on each daily quest (two to pick from, the same all day) ----------
  C.QUEST_REASONS = { // (short: they fit on the Quests list's row, owner's screenshot 8 Nov 2026)
    water: [['ivy', 'Ivy: dry crops grow slowly.'], ['poppy', 'Poppy wants a green field.']],
    till: [['mira', 'Mira: good soil, good crops.']],
    harvest: [['hana', 'Hana needs crops for bread.'], ['marco', 'Marco buys crops today.']],
    plant: [['ivy', 'Ivy wants her seeds to grow.'], ['daisy', 'Daisy\'s class studies seeds.']],
    care: [['owen', 'Owen wants happy animals.'], ['pearl', 'Pearl says love them well.']],
    collect: [['hana', 'Hana\'s ovens need eggs.'], ['rosa', 'Rosa needs milk for the inn.']],
    forage: [['ivy', 'Ivy needs herbs for tea.'], ['sora', 'Sora paints wild flowers.']],
    clear: [['mira', 'Mira wants a clear field.'], ['pip', 'Pip tripped on a stone!']],
    fish: [['leo', 'Leo: the fish are biting!'], ['finn', 'Finn\'s cat loves fish.']],
    gift: [['pearl', 'Pearl: gifts make friends.'], ['jules', 'Jules: gifts make songs.']],
    talk: [['hollis', 'The Mayor: meet the town!'], ['rosa', 'Rosa: the inn has news.']],
    earned: [['marco', 'Marco: the market is busy.'], ['hollis', 'The Mayor wants full stalls.']],
    pet: [['pip', 'Pip: {dog} looks lonely.'], ['owen', 'Owen: {dog} needs love.']],
    cooked: [['hana', 'Hana wants a taste.'], ['rosa', 'Rosa\'s guests are hungry.']],
    floor: [['bram', 'Bram needs ore to forge.'], ['ewan', 'Ewan: what\'s down there?']],
    order: [['finn', 'Finn: an order is waiting.'], ['hollis', 'The town needs your goods.']],
    request: [['hollis', 'Villagers need help today.'], ['clara', 'Clara\'s class wants to help.']],
  };
  // { who (a villager's key), text } for daily quest i, or null
  L.questReason = function (s, i) {
    var q = s.dq && s.dq.list[i], list = q && C.QUEST_REASONS[q.c];
    if (!list || !list.length) return null;
    var r = list[Math.floor(L.rand(s.seed || 1, s.dq.d * 31 + i, 7) * list.length) % list.length];
    return { who: r[0], text: r[1].replace('{dog}', L.dogName(s)) };
  };

  // ---------- the quest on the card ----------
  // The pinned one (today's), else one ready to claim, else the first unfinished one with a place to go, else the first
  // unfinished one. { i, q, ready } or null.
  L.pinQuest = function (s, i) {
    if (!s.dq || i < 0 || !s.dq.list[i]) { delete s.qp; return i < 0; }
    s.qp = { d: s.dq.d, i: i };
    return true;
  };
  L.questCard = function (s) {
    var set = s.dq;
    if (!set) return null;
    var list = set.list, at = function (i) { return { i: i, q: list[i], ready: L.questReady(s, list[i]) }; };
    if (s.qp && s.qp.d === set.d && list[s.qp.i] && !list[s.qp.i].done) return at(s.qp.i);
    var k;
    for (k = 0; k < list.length; k++) if (L.questReady(s, list[k])) return at(k);
    for (k = 0; k < list.length; k++) if (!list[k].done && L.questPlace(list[k].c)) return at(k);
    for (k = 0; k < list.length; k++) if (!list[k].done) return at(k);
    return null;
  };

  // ---------- the save ----------
  var serialize = L.serialize;
  L.serialize = function (s) {
    var o = serialize(s);
    if (s.dogNamed && s.dog) o.dn = s.dog.name;
    if (s.qp && s.dq && s.qp.d === s.dq.d) o.qp = [s.qp.d, s.qp.i];
    return o;
  };
  var deserialize = L.deserialize;
  L.deserialize = function (o) {
    var s = deserialize(o);
    if (!s) return s;
    var n = typeof o.dn === 'string' ? L.cleanName(o.dn) : '';
    if (n && s.dog) { s.dog.name = n; s.dogNamed = 1; }
    if (Array.isArray(o.qp) && s.dq && Number(o.qp[0]) === s.dq.d && s.dq.list[Number(o.qp[1])]) s.qp = { d: s.dq.d, i: Number(o.qp[1]) };
    return s;
  };
  // friends see your dog's name on a visit (the snapshot's pets.dog: 01-logic8.js)
})(window.Farm = window.Farm || {});
