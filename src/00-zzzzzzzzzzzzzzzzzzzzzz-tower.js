// The Lost Tower (owner, 12 Nov 2026: docs/superpowers/specs/2026-11-12-lost-tower-design.md). The door is the lighthouse
// at the end of Manila Bay's breakwater; inside, 1,000 floors in ten realms of Filipino mythology, each floor a room built in
// code from its number (L.towerMap), cleared to open the stairs up, paid in Pearls the first time. Content only: the rules
// are 01-logicZZZZZZZZZZZZZZZZZ-tower.js, the world 19zzz...z-tower.js (it runs on the Lair's cave code, 19zt-lair.js).
// Its creatures are saved by name (C.WILD.more), never by their place in a list. Each has its own picture to come
// (art-src/LOST-TOWER-PROMPTS.md, in the 'tower' pack: tools/tower/tower-art.js); until then a row of the wild sheet,
// tinted. Each realm's look: the cave tiles painted in its colours, until its own tiles come.
(function (F) {
  'use strict';
  var C = F.Config;
  var WI = C.WILD;

  C.TOWER = {
    floors: 1000,
    zoneSize: 100, // floors in a realm
    liftEvery: 10, // the lift stops at 1, 11, 21 ... (the ones you have reached)
    // the owner's bands: [up to floor, enemies, width, height] (a floor's room grows with its enemies)
    bands: [[100, 20, 28, 24], [200, 25, 30, 26], [300, 30, 34, 28], [400, 45, 40, 34], [500, 50, 42, 36], [1000, 60, 46, 38]],
    // 0: every enemy of a floor at once. N: waves of N, the next coming when at most waveLeft of the last is still up (the
    // phone speed test decides: spec, "Phones first")
    wave: 0,
    waveLeft: 0.2,
    hits: { base: 2, per: 25 }, // hits to beat a normal one at damage 1: 2 + floor(f / 25)
    loss: { base: 2, per: 50 }, // energy one costs when it reaches you: 2 + floor(f / 50)
    speed: { per: 100, step: 0.05, max: 0.5 }, // +5% every 100 floors, at most +50%
    // a floor's leader, against a normal enemy of its floor: hp = its hits x, hit = its energy x (each its own attack)
    roles: { guard: { hp: 5, hit: 1.5 }, mini: { hp: 10, hit: 2 }, boss: { hp: 40, hit: 3 } },
    // Pearls the first time a floor is cleared: realm z pays z x these; a helper on a floor they cleared before: 1, at most
    // 50 a day (the online part is a later step)
    pearls: { normal: 1, guard: 5, mini: 30, boss: 100, helper: 1, helperDay: 50 },
    seed: 20261112, // (every floor's room and enemies come from its number and this: the same for every player)
    zones: [],
  };

  // ---------- the ten realms ----------
  // Each: its creatures [id, name, stand-in row, tint, flies, art], 3 normal then the guard, the mini boss, the big boss (art:
  // the name in its picture's file, tower/zone<n>/wild_<art>.png, when it is not the id: three of the prompts' names are
  // taken by the hunting places' creatures, so their ids here start tw_); its
  // colours (look: floor, wall, top as the caves' 3-step ramps; lava: its pools; bg; propTint); its props (the caves' own,
  // in the wild pack, until its 6 props come); and trick: the id of what the realm adds (a later step: F.towerTricks).
  var Z = [
    { id: 'tide', name: "Tambanakua's Tide Stairs", trick: null, props: ['boulder_moss', 'mushroom_rock'],
      kinds: [['talangka', 'Talangka', 'sigbin', 0xe08a5a], ['kanaway', 'Kanaway', 'labuyo', 0xe8f0f4, 1], ['igat', 'Igat', 'wolf', 0x6f8f9c],
        ['alimango', 'Alimango Knight', 'bear', 0xc8643c], ['ulang', 'Ulang', 'rhino', 0xd45a44], ['tambanakua', 'Tambanakua', 'bungisngis', 0xb84e2c]],
      look: { floor: ['#141c20', '#34474c', '#6c8a8c'], wall: ['#0e1416', '#2e4248', '#5e7e84'], top: ['#080c0e', '#18242a', '#2e4248'] },
      lava: { rim: '#06161e', hot: ['#bff4ff', '#4ec4e0', '#1a6a8c'], plate: ['rgba(20,60,70,0.85)', 'rgba(30,90,100,0.8)'] }, bg: '#081216', propTint: 0xa8d0d8 },
    { id: 'deep', name: "Pugita's Deep", trick: 'shield', props: ['mushroom_rock', 'boulder_moss'],
      kinds: [['kugita', 'Kugita', 'boar', 0x9a6ac8], ['umang', 'Umang Shieldbearer', 'sigbin', 0xc89aa0], ['dikya', 'Dikya', 'santelmo', 0xc8a0f0, 1],
        ['kugita_kabalyero', 'Kugita Knight', 'bear', 0x7a4ab0], ['pating', 'Pating na Bakal', 'rhino', 0x7a8aa0], ['pugita', 'Pugita', 'bakunawa', 0x8a3ab0]],
      look: { floor: ['#120c22', '#2e2450', '#5a4c8a'], wall: ['#0a0818', '#28204a', '#544a86'], top: ['#06040e', '#140e28', '#28204a'] },
      lava: { rim: '#08061a', hot: ['#c8b8ff', '#5a4ad0', '#1a1260'], plate: ['rgba(40,20,90,0.85)', 'rgba(70,40,130,0.8)'] }, bg: '#0a0716', propTint: 0xb0a0e0 },
    { id: 'swamp', name: "Berberoka's Swamp", trick: 'burst', props: ['mossy_log', 'fern_bush'],
      kinds: [['palakang_putik', 'Mud Toad', 'rabbit', 0x8a9a5a], ['kuhol', 'Kuhol', 'boar', 0xa08a5a], ['parol_multo', 'Swamp Lantern', 'santelmo', 0xd8e070, 1],
        ['putik_golem', 'Mud Golem', 'mammoth', 0x6a5a3a], ['dambuhalang_kuhol', 'Giant Kuhol', 'rhino', 0x8a7a4a], ['tw_berberoka', 'Berberoka', 'bungisngis', 0x5a7a3a, 0, 'berberoka']],
      look: { floor: ['#14160a', '#3a3e1c', '#6e7034'], wall: ['#0e0e06', '#34361a', '#62643a'], top: ['#080804', '#1a1c0c', '#34361a'] },
      lava: { rim: '#10140a', hot: ['#d8f0a0', '#7aa040', '#2a4a14'], plate: ['rgba(50,60,20,0.85)', 'rgba(80,90,30,0.8)'] }, bg: '#0c0e06', propTint: 0xb8c890 },
    { id: 'lagoon', name: "Magindara's Lagoon", trick: 'song', props: ['boulder_moss', 'mushroom_rock'],
      kinds: [['sirena', 'Sirena', 'tikbalang', 0x9ad0e0], ['dikya_buwan', 'Moon Jelly', 'santelmo', 0xe0f0ff, 1], ['palakang_buwan', 'Moon Frog', 'rabbit', 0xb8d8f0],
        ['sirena_koro', 'Sirena Chorus Leader', 'tikbalang', 0x70b0d8], ['sirenang_bituin', 'Star Sirena', 'tiger', 0xf0e0a0], ['magindara', 'Magindara', 'bakunawa', 0x60a8d0]],
      look: { floor: ['#1a2230', '#5a6a80', '#b8c8d8'], wall: ['#10161e', '#46566a', '#9aaabc'], top: ['#080c12', '#1e2834', '#46566a'] },
      lava: { rim: '#081020', hot: ['#e8f4ff', '#6aa0e0', '#1a3a7a'], plate: ['rgba(200,220,255,0.35)', 'rgba(120,160,220,0.4)'] }, bg: '#0a1018', propTint: 0xd0e0f0 },
    { id: 'storm', name: "Anitun Tabu's Storm Gallery", trick: 'flock', props: ['boulder_moss', 'charred_log'],
      kinds: [['langay', 'Langay-langayan', 'labuyo', 0xa0a8b8, 1], ['kabag', 'Storm Bat', 'labuyo', 0x6a6a84, 1], ['ulap', 'Ulap', 'santelmo', 0xd0d8e8, 1],
        ['lawin_kidlat', 'Thunder Hawk', 'labuyo', 0xf0d050, 1], ['bagyo', 'Bagyo', 'mammoth', 0x7a8098], ['galura', 'Galura', 'labuyo', 0xc0a060, 1]],
      look: { floor: ['#16181c', '#464c56', '#8a929e'], wall: ['#0e1014', '#3a4048', '#7a828c'], top: ['#08090c', '#1c2026', '#3a4048'] },
      lava: { rim: '#0e1014', hot: ['#d0d8e0', '#7a8898', '#3a4450'], plate: ['rgba(60,70,80,0.8)', 'rgba(90,100,110,0.75)'] }, bg: '#0c0e12', propTint: 0xc0c8d4 },
    { id: 'court', name: 'The Kataw Court', trick: 'heal', props: ['mushroom_rock', 'boulder_moss'],
      kinds: [['tw_kataw', 'Kataw Courtier', 'tikbalang', 0x50c0b0, 0, 'kataw'], ['kataw_manggagamot', 'Kataw Healer', 'tikbalang', 0x90e0c0], ['kabayo_dagat', 'Seahorse Knight', 'deer', 0x40a0a0],
        ['bantay_hari', 'Royal Guard', 'bear', 0xd0b050], ['kataw_reyna', 'Kataw Queen', 'tiger', 0x60d0c0], ['kataw_hari', 'Kataw King', 'bungisngis', 0xe0c040]],
      look: { floor: ['#0a1e1c', '#1e6a62', '#c8b060'], wall: ['#081614', '#1e5a54', '#b8a050'], top: ['#040c0a', '#0e2c28', '#1e5a54'] },
      lava: { rim: '#062018', hot: ['#c8fff0', '#40d0c0', '#0a6a60'], plate: ['rgba(200,170,60,0.5)', 'rgba(40,140,130,0.6)'] }, bg: '#06140f', propTint: 0xd0e8c8 },
    { id: 'spire', name: "Santelmo's Lantern Spire", trick: 'dark', props: ['lava_boulder', 'charred_log'],
      kinds: [['santelmong_asul', 'Blue Santelmo', 'santelmo', 0x60a0ff, 1], ['alitaptap', 'Alitaptap', 'santelmo', 0xf0f080, 1], ['anino', 'Anino', 'wolf', 0x3a3a50],
        ['lampara_golem', 'Lamp Golem', 'mammoth', 0x5060a0], ['dambuhalang_anino', 'Great Anino', 'bear', 0x2a2a3c], ['dakilang_santelmo', 'Great Santelmo', 'bakunawa', 0x4080ff]],
      look: { floor: ['#06080e', '#1a2236', '#3a4a70'], wall: ['#04060a', '#161e30', '#36446a'], top: ['#020306', '#0a0e18', '#161e30'] },
      lava: { rim: '#04060e', hot: ['#c0e0ff', '#4080ff', '#0a2a80'], plate: ['rgba(10,20,60,0.85)', 'rgba(30,50,120,0.8)'] }, bg: '#030409', propTint: 0x8aa0e0 },
    { id: 'biringan', name: 'Biringan, the Invisible City', trick: 'split', props: ['boulder_moss', 'mushroom_rock'],
      kinds: [['engkanto', 'Engkanto', 'tikbalang', 0xf0e0b0], ['minokawa_sisiw', 'Minokawa Chick', 'labuyo', 0xe0c070, 1], ['ulap_blob', 'Sky Drop', 'rabbit', 0xe8e0ff],
        ['bantay_biringan', 'Biringan Gatekeeper', 'bear', 0xe0c060], ['tigmamanukan', 'Tigmamanukan', 'labuyo', 0x60a0e0, 1], ['tw_minokawa', 'Minokawa', 'labuyo', 0xd0a040, 1, 'minokawa']],
      look: { floor: ['#2a2010', '#8a7040', '#f0dca0'], wall: ['#1e170c', '#7a6236', '#e0c890'], top: ['#100c06', '#3a2e18', '#7a6236'] },
      lava: { rim: '#20180a', hot: ['#fff8d8', '#f0d070', '#a07a20'], plate: ['rgba(255,240,200,0.4)', 'rgba(220,190,110,0.45)'] }, bg: '#140f08', propTint: 0xf0e0b0 },
    { id: 'starfall', name: "Mayari's Starfall", trick: 'revive', props: ['mushroom_rock', 'lava_boulder'],
      kinds: [['tala', 'Tala', 'santelmo', 0xfff0c0], ['bituing_alimasag', 'Star Crab', 'sigbin', 0xd0c0ff], ['gamugamo_buwan', 'Moon Moth', 'labuyo', 0xe0e0ff, 1],
        ['bituing_golem', 'Star Golem', 'mammoth', 0xa090d0], ['pagong_batong_buwan', 'Moonstone Tortoise', 'rhino', 0xc0c0e0], ['tagapag_ingat_bituin', 'Star Keeper', 'bungisngis', 0xb0a0f0]],
      look: { floor: ['#120e22', '#3e3266', '#9a8ad0'], wall: ['#0c0a18', '#342a58', '#8a7ac0'], top: ['#06050c', '#18142c', '#342a58'] },
      lava: { rim: '#0a0818', hot: ['#fffbe0', '#c0a8ff', '#4a3a9a'], plate: ['rgba(60,50,120,0.8)', 'rgba(100,80,170,0.7)'] }, bg: '#08061a', propTint: 0xc8c0f0 },
    { id: 'moon', name: 'The Seventh Moon', trick: 'all', props: ['lava_boulder', 'boulder_moss'],
      kinds: [['bakunawa_anak', 'Bakunawa Hatchling', 'sigbin', 0x5a7ab0], ['laho', 'Laho', 'wolf', 0x40406a], ['parola_golem', 'Lighthouse Golem', 'mammoth', 0xe0d8c0],
        ['bakunawa_bata', 'Bakunawa Whelp', 'tiger', 0x4a6aa0], ['dakilang_laho', 'Great Laho', 'bear', 0x30305a], ['bakunawa_ng_look', 'Bakunawa of the Bay', 'bakunawa', 0x3a5aa0]],
      look: { floor: ['#0a0e1c', '#28304e', '#a0a8c8'], wall: ['#060a14', '#222a46', '#8a92b4'], top: ['#03050a', '#10162a', '#222a46'] },
      lava: { rim: '#040814', hot: ['#f8f8ff', '#a0b0e0', '#2a3a7a'], plate: ['rgba(30,40,90,0.85)', 'rgba(60,70,130,0.8)'] }, bg: '#04060e', propTint: 0xc0c8e8 },
  ];

  // How each kind of enemy stands and fights (hp and the energy a hit costs come from the floor: L.towerHits, L.towerLoss).
  // w: its size in tiles; angry: how near you must be before it charges (every tower enemy charges).
  var ROLE = {
    normal: { w: 1.15, kg: 6, walk: 0.8, run: 3.6, angry: 4, drops: [] },
    guard: { w: 1.9, kg: 90, walk: 0.7, run: 3.4, angry: 5, drops: [['tinola', 1, 1]] }, // (spec: the guard drops energy food)
    mini: { w: 2.5, kg: 400, walk: 0.6, run: 3.2, angry: 5.5, drops: [['kaldereta', 1, 1], ['tinola', 1, 1]] },
    boss: { w: 3.4, kg: 3000, walk: 0.5, run: 3, angry: 6, drops: [['kaldereta', 2, 1]] },
  };
  var ROLES = ['normal', 'normal', 'normal', 'guard', 'mini', 'boss'];
  WI.areas.tower = { name: 'The Lost Tower', animals: {}, unlock: 0, tower: true, shut: 'The Lost Tower is in Manila, at the lighthouse' };
  Z.forEach(function (z, i) {
    var n = i + 1;
    z.n = n;
    z.from = i * C.TOWER.zoneSize + 1;
    z.to = n * C.TOWER.zoneSize;
    z.look.crust = z.look.wall; // (cooled rock round the pools)
    z.lava.embers = false;
    // the owner's pictures when they come (tools/tower/tower-art.js): the stairs up (shut and open) and the cave's tiles
    z.art = { gate: 'props/tower_stairs_' + n, cave: 'tower_cave_' + n };
    z.normal = [];
    z.kinds.forEach(function (k, j) {
      var role = ROLES[j], r = ROLE[role], base = WI.animals[k[2]], fly = !!k[4];
      if (WI.animals[k[0]]) throw new Error('The Lost Tower: creature ' + k[0] + ' already exists');
      WI.animals[k[0]] = {
        name: k[1], sheetRow: k[2], tint: k[3], sheet: 'wild_' + k[0], px: base.px, w: fly && role === 'normal' ? 0.95 : r.w, kg: r.kg, hp: 2,
        walk: r.walk, run: r.run, angry: r.angry, hit: 2, flies: fly || undefined, ground: !fly, boss: role !== 'normal' || undefined,
        tower: true, zone: n, role: role, respawn: 0, drops: r.drops, art: k[5] || k[0],
      };
      WI.more.push(k[0]); // (by name: saved by name, sent to friends as its place in this list)
      if (role === 'normal') z.normal.push(k[0]);
      else z[role === 'boss' ? 'boss' : role] = k[0];
    });
    delete z.kinds;
    C.TOWER.zones.push(z);
  });

  // what each realm adds (shielded, bursting, ...): a later step registers them here by their zone's trick id
  F.towerTricks = F.towerTricks || {};

  // ---------- the door: Manila's lighthouse ----------
  var M = C.MANILA;
  var house = M && M.buildings.filter(function (b) { return b.key === 'lighthouse'; })[0];
  if (house) {
    house.name = 'The Lost Tower';
    house.text = 'The old lighthouse at the end of the breakwater. Its door opens on The Lost Tower: a thousand floors up from the bottom of Manila Bay. Go in at its door.';
  }
})(window.Farm = window.Farm || {});
