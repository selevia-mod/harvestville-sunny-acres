// Manila Friends (owner, 18 Nov 2026: "Also add some friends that users will need to increase heart, specially in Manila
// so theres something to do in Manila"; "Yes build the manila friends design as written":
// docs/superpowers/specs/2026-11-18-manila-friends-design.md). Ten people of the city become friends the way the town's
// villagers are: a chat once a day (+3), a gift once a day (loves +15, likes +8, neutral +3, dislikes -6, birthdays x2:
// C.FRIEND), a story of 4 steps at 2, 4, 6 and 8 hearts, and each friendship unlocks something in the city. No marriage.
// Content only. Rules and the save: 01-logicZZZZZZZZZZZZZZZZZZZZZZZZZ-manila-friends.js; the world, the talks, the
// Friendship Book's Manila page and the tour: 19zzz...z-manila-friends.js.
// KEYS: 'mn_' + name, so they never meet the town's own (Willowbrook has its own Rosa at the Sunny Inn). They live in
// s.friends beside the villagers but are NOT villagers: never in C.VILLAGERS or C.VILLAGER_ORDER (the town's loops: its
// calendar of birthdays and letters, marriage, heart events, ranks, the town Friendship Book).
// Numbers marked "decided by me" were not in the owner's design; the owner can change them.
// Adds nothing to a saved list (no icons, items, crops or furniture kinds), so it can load last among the 00- files.
(function (F) {
  'use strict';
  var C = F.Config;
  var M = C.MANILA;
  var H = 60;
  if (!M || !M.on) return;

  C.MNF = {
    on: true,
    // the order on the Manila page (a friend's place here is never saved: each is saved by its key)
    order: ['mn_rosa', 'mn_danny', 'mn_lando', 'mn_kardo', 'mn_marisol', 'mn_tibo', 'mn_amparo', 'mn_ramon', 'mn_bea', 'mn_nena'],
    hearts: [2, 4, 6, 8], // the hearts each story step opens at (the town's)
    pts: 4, // friendship for finishing a step (the town's)
    // who each one is in the city: one of the 7 city people (C.MANILA.people), or one of the city-life roles
    // (C.MANILA.roles; n: which of the role's people). sheet: their own picture (the 'manila' pack), for their portrait.
    // birthday: [month, day], never a town villager's birthday or a festival day (test/manila-friends.test.js checks).
    // loves, likes, dislikes: mostly from the farm (crops, dishes, the Mixer's goods, fish), so the farm feeds Manila.
    // (Hopia and fishballs are street food eaten on the spot, not bag items: the nearest farm goods stand in for them.)
    friends: {
      mn_rosa: { name: 'Aling Rosa', role: 'Grand Market buyer', person: 'rosa', sheet: 'npc_aling_rosa', where: 'the Grand Market', birthday: [5, 13],
        loves: ['pumpkin', 'watermelon', 'mango_jam'], likes: ['corn', 'tomato', 'rice', 'eggplant', 'cabbage'], dislikes: ['ore_copper', 'fish_s'] },
      mn_danny: { name: 'Mang Danny', role: 'Trading Post keeper', person: 'danny', sheet: 'npc_mang_danny', where: 'the Trading Post', birthday: [8, 3],
        loves: ['rope', 'beeswax', 'farm_cement'], likes: ['cotton', 'sugarcane', 'peanut_kisses', 'sili_powder'], dislikes: ['turnip', 'herb'] },
      mn_lando: { name: 'Panday Lando', role: 'Armory smith', person: 'lando', sheet: 'npc_panday_lando', where: 'the Armory', birthday: [1, 23],
        loves: ['ore_gold', 'boar_adobo', 'kapeng_barako'], likes: ['ore_silver', 'meat_boar', 'coffee', 'kare_kare'], dislikes: ['tulip', 'sampaguita', 'bouquet'] },
      mn_kardo: { name: 'Mang Kardo', role: 'Stable master and race host', person: 'kardo', sheet: 'npc_mang_kardo', where: 'the Stables', birthday: [9, 17],
        loves: ['oats', 'carrot', 'apple'], likes: ['fodder', 'sugarcane', 'hot_soup', 'pandesal'], dislikes: ['fish_m', 'chili'] },
      mn_marisol: { name: 'Kapitana Marisol', role: 'Harbor master', person: 'marisol', sheet: 'npc_kapitana_marisol', where: 'the Harbor', birthday: [6, 24],
        loves: ['fish_l', 'fish_k', 'grilled_fish'], likes: ['fish_m', 'pineapple', 'banana', 'pineapple_juice'], dislikes: ['mushroom', 'ore_copper'] },
      mn_tibo: { name: 'Mang Tibo', role: 'Station master', person: 'tibo', sheet: 'npc_mang_tibo', where: 'Manila Central', birthday: [4, 8],
        loves: ['kapeng_barako', 'pandesal', 'sikwate'], likes: ['coffee', 'egg', 'milk', 'bread'], dislikes: ['onion', 'garlic'] },
      mn_amparo: { name: 'Lola Amparo', role: 'Storyteller of the walled quarter', person: 'amparo', sheet: 'npc_lola_amparo', where: 'her house in the walled quarter', birthday: [2, 8],
        loves: ['kesong_puti', 'peanut_kisses', 'sampaguita'], likes: ['cassava', 'taro', 'sweet_potato', 'mango'], dislikes: ['chili', 'sili_powder'] },
      mn_ramon: { name: 'Father Ramon', role: 'Priest of the Old Stone Church', role2: 'priest', n: 0, sheet: 'npc_priest', where: 'the Old Stone Church', birthday: [12, 12],
        loves: ['sampaguita', 'rose', 'bouquet'], likes: ['pandesal', 'bread', 'milk', 'gumamela'], dislikes: ['tusk', 'fang_wolf'] },
      mn_bea: { name: 'Bea', role: 'College student, the leader of the three', role2: 'students', n: 0, sheet: 'npc_student_1', where: 'the College', birthday: [3, 21],
        loves: ['cookie', 'chocolate_cake', 'strawberry'], likes: ['peanut_kisses', 'mango', 'pineapple_juice', 'banana'], dislikes: ['bitter_gourd', 'okra'] },
      mn_nena: { name: 'Aling Nena', role: 'Carinderia cook', role2: 'carinderia_cook', n: 0, sheet: 'npc_carinderia_cook', where: 'the Carinderia', birthday: [11, 6],
        loves: ['bitter_gourd', 'eggplant', 'meat_boar'], likes: ['okra', 'tomato', 'onion', 'garlic', 'rice'], dislikes: ['ore_copper', 'feather_labuyo'] },
    },

    // ---------- what each friendship unlocks (the reason to go to Manila) ----------
    // at: the hearts it opens at. A friendship's highest hearts are kept (a dislike later never takes an unlock away).
    unlocks: {
      mn_tibo: { at: 6, half: 6, free: 10, text: 'The train at half price', text2: 'The train free' },
      mn_rosa: { at: 6, hot: 10, text: 'A 4th Grand Market contract every day', text2: "Tomorrow's 3 hot crops on her board" },
      mn_kardo: { at: 8, fee: 0.05, text: 'His driver fee: 5%, not 10%' },
      mn_lando: { at: 8, off: 0.1, text: '10% off bullets and javelins' },
      mn_marisol: { at: 6, text: 'Her fishing spot on the pier: the bay\'s bigger fish' },
      mn_danny: { at: 8, text: 'One rare trade a week' },
      mn_amparo: { at: 2, text: 'A framed old-Manila photo at each story step' },
      mn_ramon: { at: 6, energy: 25, text: 'A blessing once a day: +25 energy' }, // (25: decided by me)
      mn_bea: { at: 6, xp: 40, text: 'Study together once a day: +40 skill XP' }, // (40 XP: decided by me)
      mn_nena: { at: 8, food: 'meal', text: 'A free carinderia meal once a day' },
    },
    // Kapitana Marisol's spot: the city's better fish (the game's own fish, its bigger ones; decided by me)
    pierFish: { fish_m: 0.3, fish_l: 0.5, fish_k: 0.2 },
    // Mang Danny's rare trade: one a week (weeks from Monday), the same for every player that week, in turn. [give, n, get, m]:
    // a fair swap (what you give sells for about what you get), for something the mine or the wild keeps hard to find.
    // (decided by me)
    trades: [
      ['cheese', 4, 'emerald', 1], ['rope', 8, 'obsidian', 1], ['kesong_puti', 2, 'amethyst', 1],
      ['mango_jam', 6, 'jade', 1], ['pumpkin', 15, 'gem', 1], ['corn', 20, 'crystal', 1], ['fish_k', 2, 'obsidian', 1],
    ],
    stories: {},
  };
  var MF = C.MNF, Q = 'What do you say?';

  // ---------- what they say (the town's C.DIALOGUE shape: intro, rain, tiers 0-2, 3-5, 6-8, 9-10 hearts, gifts, birthday) ----------
  // (the 7 city people keep their own words: their first hello is their intro, and what they always said is their
  // 0-2 hearts tier, so nothing they said before changes; the tiers below are 3-5, 6-8 and 9-10 hearts)
  var say = function (key, d) {
    var p = MF.friends[key].person && M.people[MF.friends[key].person];
    if (p) { d.intro = p.met; d.tiers.unshift(p.lines.slice()); }
    d.spouse = [];
    C.DIALOGUE[key] = d;
  };
  say('mn_rosa', {
    rain: 'Rain again! The market roof leaks, but the buyers still come. Manila never stops.',
    tiers: [
      ['Your corn was the talk of the market yesterday.', 'Come early: the best buyers are here by six.', 'A good farmer and a good buyer are like rice and ulam.'],
      ['I keep the best corner of the board for your crops now.', 'You make an old market woman very proud.', 'Eat first before you sell, ha? Business can wait a little.'],
      ['You are family now. My stall is your stall.', 'When I retire, I will tell everyone: I knew that farmer first!', 'Salamat, anak. For every load you brought me.'],
    ],
    gift: { love: 'Naku! This is the best I have seen all week. Salamat, anak!', like: 'Ay, how nice. Salamat po!', neutral: 'Salamat, anak.', dislike: 'Hmm. I cannot sell this one. But salamat.' },
    birthday: 'For my birthday? Ay, you remembered! Come here, anak!',
    bday: 'It is my birthday today, anak! The whole market sang for me.',
  });
  say('mn_danny', {
    rain: 'Rain is good for business. Everybody suddenly needs rope for their tarps!',
    tiers: [
      ['A good trade leaves both sides smiling. Remember that, kuya.', 'I keep a little notebook of who trades fair. You are in it.', 'Your Mixer goods are good quality. I can tell.'],
      ['For you, I save the good stuff in the back.', 'Trading is not about things. It is about trust.', 'Sit, sit. Coffee? It is on the house.'],
      ['You are my best suki. Do not tell the others.', 'If I ever open a second Trading Post, you will be my partner.', 'Thirty years of trading, and you are my favourite deal.'],
    ],
    gift: { love: 'Now THAT is good stock! You know what is worth something. Salamat!', like: 'Not bad, not bad! Salamat po.', neutral: 'I will find a use for it. Salamat.', dislike: 'Ay, nobody trades for this. But it is the thought, ha?' },
    birthday: 'A birthday gift? For old Danny? You are a good trade, my friend!',
    bday: 'Birthday today! No discounts, though. Ha! Just kidding.',
  });
  say('mn_lando', {
    rain: 'The forge hisses in the rain. It does not like water. Neither do I.',
    tiers: [
      ['You hold a weapon better than last time. Good.', 'My hammer was my father\'s. Its handle is new. Its head is not.', 'Steel remembers every strike. So do I.'],
      ['Your arm is strong. You could be a smith, you know.', 'I made a little knife for my nephew today. He cried. Happy tears.', 'The forge is warmer when a friend is near.'],
      ['You are the only one I let watch me work.', 'One day I will make you something no one else has.', 'Salamat, friend. The fort feels less lonely.'],
    ],
    gift: { love: 'This! This is fine stuff. I will make something worthy of it.', like: 'Good. Useful. Salamat.', neutral: 'Hm. Salamat.', dislike: 'Flowers? For a smith? They will burn in a minute. Ay.' },
    birthday: 'You remembered my birthday? Hm. My eyes are sweating. It is the forge.',
    bday: 'My birthday. I made myself a cake. It was iron. Joke.',
  });
  say('mn_kardo', {
    rain: 'Rain makes the track soft. The horses love to splash. I do not love to clean them!',
    tiers: [
      ['Your horse looked at me today. I think it likes me.', 'Send your cart with me any time. I know every bump of the valley road.', 'A horse never forgets a kind hand.'],
      ['You treat your horse like family. I see it.', 'Kidlat, my old horse, would have liked you.', 'Come watch the evening run with me sometime.'],
      ['You are the best rider I know, and I know them all!', 'If you ever win the Manila Cup, I ring the bell for an hour.', 'Salamat, friend. Ding ding!'],
    ],
    gift: { love: 'Oh ho! The horses will be fighting over this. Salamat!', like: 'Very good, very good! Salamat po.', neutral: 'Salamat, friend.', dislike: 'Eh... the horses will not touch this. Neither will I. Ha!' },
    birthday: 'A gift on my birthday! Ding ding ding! Three dings for you!',
    bday: 'It is my birthday! The horses each got an extra carrot. Me too.',
  });
  say('mn_marisol', {
    rain: 'Rain on the bay is beautiful. The boats do not think so, but I do.',
    tiers: [
      ['You walk the pier like a sailor now.', 'The bay keeps its big fish far out. They come close only for friends.', 'My lola was a fisherwoman. I got her eyes and her stubbornness.'],
      ['When the sea is calm, I think of you farming. Strange, no?', 'I would sail you to every island if I had a boat.', 'You are always welcome on my pier.'],
      ['You are my crew now, Kapitan.', 'The sea taught me patience. You taught me friendship.', 'Salamat. The port feels like home with you here.'],
    ],
    gift: { love: 'A fine catch! You have the sea in you after all. Salamat!', like: 'Good, from the water. Salamat po.', neutral: 'Salamat.', dislike: 'Hm. That is no gift for a sailor. But salamat.' },
    birthday: 'For my birthday? The whole harbor will hear about this!',
    bday: 'My birthday today. The lighthouse keeper rang the bell for me.',
  });
  say('mn_tibo', {
    rain: 'Rain or shine, the train runs. Rain only makes the tickets wet.',
    tiers: [
      ['You ride my train so often, I know your face now!', 'I keep the oldest train timetable in the city. 1950!', 'Coffee keeps a station master awake. Lots of coffee.'],
      ['For a friend like you, the train has a friend price.', 'My wife packs me pandesal every morning. I share it with the pigeons.', 'Sit with me a moment. The next train is not for ten minutes.'],
      ['You are the best passenger this station ever had.', 'When I retire, I want you to wave me off on the last train.', 'Salamat, anak. You make the waiting short.'],
    ],
    gift: { love: 'Ay! My favourite! You know an old station master well. Salamat!', like: 'Very kind. Salamat po.', neutral: 'Salamat, anak.', dislike: 'Ay, the smell! The passengers will complain. But salamat.' },
    birthday: 'On my birthday! I will blow the whistle for you. Toot toot!',
    bday: 'It is my birthday today! The 7:15 was on time, as my gift to myself.',
  });
  say('mn_amparo', {
    rain: 'When it rains, the old stones smell like history. Sit, apo, and listen.',
    tiers: [
      ['You listen well, apo. Not many young ones do.', 'My lola told me these stories. Now I tell them to you.', 'Every stone in these walls has a name. I know some of them.'],
      ['You remind me of my husband. He also asked many questions.', 'Come back tomorrow. I will remember another story.', 'Eat, apo, eat. You are too thin.'],
      ['You are my apo now, blood or not.', 'When I am gone, you will keep the stories. Promise me.', 'Salamat, apo. My heart is full.'],
    ],
    gift: { love: 'Ay, apo! Just like the ones my lola made. Salamat, salamat!', like: 'How sweet of you, apo. Salamat po.', neutral: 'Salamat, apo.', dislike: 'Ay, too spicy for my old stomach, apo. But salamat.' },
    birthday: 'On my birthday? At my age, every birthday is a gift. And now two!',
    bday: 'It is my birthday, apo. I am ninety-one. Or ninety-two. Who counts!',
  });
  say('mn_ramon', {
    intro: 'Good day, my child. I am Father Ramon, of the Old Stone Church. You are always welcome here.',
    rain: 'The rain waters the gardens and empties the plaza. More room in the pews, at least!',
    tiers: [
      ['The bells ring at six. Come and listen.', 'Be kind to one another. That is the whole of it.', 'The church door is open all day. Come in and rest.'],
      ['Your crops feed this city. That is a kind of prayer too.', 'The sampaguita seller blesses my day with her flowers.', 'Peace be with you, my child.'],
      ['I pray for good weather on your farm. Do not tell the others.', 'You carry the city\'s burdens lightly. That is a gift.', 'Sit with me after mass on Sunday. We will share pandesal.'],
      ['You are a blessing to this city, my child.', 'When the bells ring, I think of all my friends. You are one.', 'God keeps you, and so do I. Salamat.'],
    ],
    gift: { love: 'Sampaguita for the altar! Bless you, my child. Salamat.', like: 'How kind. Salamat po.', neutral: 'Salamat, my child.', dislike: 'Hm. Perhaps this belongs out in the wild. But salamat.' },
    birthday: 'You remembered my birthday? The bells will ring a little louder today.',
    bday: 'It is my birthday today. The children sang for me after mass.',
  });
  say('mn_bea', {
    intro: 'Hi! I am Bea. That is Migs, that is Joy. We are never apart, since first year!',
    rain: 'Rain means no plaza after class. Library day! Ugh.',
    tiers: [
      ['Exams next week. Pray for us!', 'We always eat fishballs after class. Tradition!', 'The library closes at eight. Plaza after!'],
      ['You farm? For real? I study agriculture! Teach me things!', 'Migs says hi. Joy says hi too. She is shy.', 'My professor talks about soil like it is his child.'],
      ['Studying with you is better than studying with Migs. Do not tell him.', 'I want to visit a real farm one day. Yours!', 'You explain things better than my textbook.'],
      ['You are my best friend outside the three of us. That is big!', 'When I graduate, you are coming. No excuses!', 'Salamat, ha? You make the city feel smaller.'],
    ],
    gift: { love: 'NO WAY! For me? Joy, look! Salamat!', like: 'Yay, salamat po!', neutral: 'Salamat!', dislike: 'Ew, ampalaya-level bad. But salamat, ha.' },
    birthday: 'You know my birthday?! Migs did not even remember! Salamat!',
    bday: 'It is my birthday! Migs and Joy made me a fishball cake. Do not ask.',
  });
  say('mn_nena', {
    intro: 'Kain na! I am Aling Nena. Adobo, sinigang, pinakbet: point and eat, anak.',
    rain: 'Rainy days are sinigang days. Come, have a bowl. Sit, sit!',
    tiers: [
      ['Everything here is cooked this morning.', 'Unli-rice? Ay, not today, anak.', 'Point and eat. Pay after!'],
      ['You eat like a farmer. I like that.', 'My pinakbet needs good ampalaya. The farm ones are best.', 'My carinderia has fed this barangay for twenty years.'],
      ['I save the crispy part of the adobo for you now.', 'You are too thin, anak. Here, extra rice.', 'A full belly makes a happy heart.'],
      ['You are my anak now. My table is your table.', 'One day I will teach you my sinigang. Only you!', 'Salamat, anak. Kain ka pa!'],
    ],
    gift: { love: 'Ay, perfect for my pinakbet! Salamat, anak!', like: 'Good for the pot. Salamat po!', neutral: 'Salamat, anak.', dislike: 'Ay, I cannot cook with this. But salamat.' },
    birthday: 'On my birthday? Ay, anak! Free meal today. Well, for you, ha!',
    bday: 'My birthday today, anak! I cooked my own handa. Kain na!',
  });

  // ---------- the stories: 4 steps each, at 2, 4, 6 and 8 hearts (the town's C.VS format, header of 00-zzzzzzzzzzz-friends.js;
  // no `at` and no `after`: a Manila friend is met where they are in the city). Rewards from what the game has (decided by me).
  // (Each speaker's key is in a short name, ME is you: the page is nearly full.) ----------
  var S = MF.stories, ME = 'me';
  var R = 'mn_rosa';
  S.mn_rosa = [
    { t: 'Five in the morning', hint: 'Aling Rosa is at the market before dawn. Ask her why.',
      lines: [[R, 'Why five, anak? The best crops come at five. The valley farmers start walking at two.'],
        [R, 'Someone should be waiting for them when they arrive. For forty years, that someone is me.']],
      choice: { q: Q, a: [['I will come early too.', 'Then I save you a coffee. Here, for your trouble.', { pts: 3 }],
        ['Five is too early!', 'Ha! For you, six is fine. Take this anyway.']] },
      reward: [{ gold: 300 }] },
    { t: 'Too many orders', hint: 'A restaurant wants tomatoes, and Aling Rosa has none.', bring: ['tomato', 20],
      lines: [[R, 'Ay! A restaurant on the bay wants tomatoes today, and my baskets are empty. Bring me 20 Tomatoes, anak?']],
      choice: { q: Q, a: [['Leave it to me.', 'You are a lifesaver!'], ['Only for you, Aling Rosa.', 'Ay, you flatter an old woman. It works!', { pts: 2 }]] },
      thanks: [[R, 'Red as a jeepney! Here: rich fertilizer from a buyer down south, and your share of the order.']],
      reward: [{ item: 'fert_rich', n: 10 }, { gold: 400 }] },
    { t: 'Market day rush', hint: 'The Grand Market is packed. Aling Rosa could use a hand.', help: 15,
      lines: [[R, 'Busy, busy! Carry these baskets to the stalls, anak. Quick!'], [ME, '(You carry corn, kangkong and mangoes until noon.)'],
        [R, 'Not one mango dropped. I am impressed!']],
      choice: { q: Q, a: [['That was fun!', 'Fun? You are a market person after all. For your yard.', { pts: 3 }], ['My arms...', 'Ha! Now you know my life. Here, for shade.']] },
      reward: [{ yard: 'garden_umbrella' }] },
    { t: 'One basket', hint: 'Aling Rosa never says how her market began.',
      lines: [[R, 'A secret, anak. I came from the province with one basket of tomatoes, and sold them on the street.'],
        [R, 'Then two baskets. Then a stall. Then all this. Because one good farmer trusted me: your grandfather.']],
      choice: { q: Q, a: [['He trusted the right person.', 'And now I trust you. Take the shelf from my first stall.'],
        ['One basket! Amazing.', 'Never forget where you began. Take this shelf. It held that basket.']] },
      reward: [{ secret: "Aling Rosa's Grand Market began with one basket of tomatoes. Your grandfather was her first farmer." }, { furn: 'shelf', style: 'harvest' }, { gold: 800 }] },
  ];
  var DA = 'mn_danny';
  S.mn_danny = [
    { t: 'Rope tricks', hint: 'Mang Danny ties knots faster than anyone.',
      lines: [[DA, 'Watch. One loop, two loops, pull: a bowline! Fastest in Manila. A good knot is half of any building.']],
      choice: { q: Q, a: [['Teach me!', 'Over, under, through. Quick hands! Take rope to practise.', { pts: 3 }], ['Show off!', 'Guilty! Your turn: here, some rope.']] },
      reward: [{ item: 'rope', n: 2 }] },
    { t: 'The empty shelves', hint: 'The Trading Post still has empty shelves. Mang Danny has a plan.', bring: ['farm_cement', 3],
      lines: [[DA, 'The builders keep asking for cement, kuya. Bring me 3 Farm Cement from your Mixer: I pay better than fair.']],
      choice: { q: Q, a: [['Deal!', 'Deal! A trader at heart.'], ['Better than fair?', 'For a friend, always.', { pts: 2 }]] },
      thanks: [[DA, 'Smooth, no lumps. The builders will love it. As promised!']],
      reward: [{ gold: 600 }] },
    { t: 'Counting day', hint: 'Once a month Mang Danny counts everything. Everything.', help: 15,
      lines: [[DA, 'Counting day! The nails, the screws, the bolts.'], [ME, '(You count 1,204 nails, 856 screws and one lonely bolt.)'],
        [DA, 'One bolt? I was sure I had two. You count like an accountant!']],
      choice: { q: Q, a: [['Find the other bolt!', 'It is in my pocket, probably. My old desk is yours.', { pts: 2 }], ['Never again!', 'Everyone says that. Take my old desk.']] },
      reward: [{ furn: 'desk', style: 'rustic' }] },
    { t: 'The little notebook', hint: 'Mang Danny keeps a notebook he shows no one.',
      lines: [[DA, 'Every name in my notebook traded fair with me. Thirty years of names.'],
        [DA, 'A star for the very best. You are the only one with three stars.']],
      choice: { q: Q, a: [['Three stars!', 'In thirty years! Wax, and a little gold, for my best suki.'], ['Can I draw you one?', 'Draw me a star and I keep it forever. Take these.']] },
      reward: [{ secret: 'Mang Danny keeps a notebook of everyone who traded fair. You are the only one with three stars.' }, { item: 'beeswax', n: 3 }, { gold: 700 }] },
  ];
  var LA = 'mn_lando';
  S.mn_lando = [
    { t: 'Sparks', hint: 'Panday Lando works the forge in the old fort.',
      lines: [[LA, 'Stand back. Sparks. This fort kept enemies out. Now it keeps the heat in.'], [LA, 'Hm. You did not flinch. Brave or foolish.']],
      choice: { q: Q, a: [['Brave!', 'We will see. A brave one needs good ore.', { pts: 3 }], ['Foolish!', 'Honest. Honest is better. Take this silver.']] },
      reward: [{ item: 'ore_silver', n: 3 }] },
    { t: 'The old cannon', hint: "An old cannon rusts in the fort's yard. Panday Lando has a plan.", bring: ['ore_copper', 15],
      lines: [[LA, 'That cannon has been rusted shut for a hundred years. I will make it a bell. Bring me 15 Copper Ore.']],
      choice: { q: Q, a: [['A bell! Lovely.', 'Hm. Yes. Lovely.'], ['A cannon into a bell?', 'Something for war into something for peace. The best work a smith can do.', { pts: 3 }]] },
      thanks: [[ME, '(That night a deep bell rings from the fort. Even the pigeons listen.)'], [LA, 'Our bell. Arrows from the leftover, for your bow.']],
      reward: [{ item: 'arrows', n: 20 }, { gold: 300 }] },
    { t: 'Heat the forge', hint: 'The big forge needs two people to light it.', help: 20,
      lines: [[LA, 'Pump the bellows. Do not stop.'], [ME, '(You pump until the coals glow white and your arms shake.)'], [LA, 'Hot enough to melt a mountain. Very good work.']],
      choice: { q: Q, a: [['Again tomorrow?', 'Ha! Tomorrow. Take this fireplace: too big for the house I made it for.', { pts: 3 }], ['I need water.', 'Drink. Then take this fireplace home.']] },
      reward: [{ furn: 'fireplace', style: 'royal' }] },
    { t: "My father's hammer", hint: "Panday Lando's hammer has a story he never told.",
      lines: [[LA, 'My father wanted me to be a teacher. I wanted the forge. We did not speak for years.'],
        [LA, 'Old, he gave me this hammer. "You make good things. That is teaching too." I never told anyone that.']],
      choice: { q: Q, a: [['He was proud of you.', 'Hm. Yes. Take this gold ore, and a lamp I made for your yard.'], ['You teach me every day.', 'Then I am a teacher after all. Take these.']] },
      reward: [{ secret: 'Panday Lando\'s father wanted him to teach. He gave him his hammer: "You make good things. That is teaching too."' }, { item: 'ore_gold', n: 3 }, { yard: 'lamp' }] },
  ];
  var KA = 'mn_kardo';
  S.mn_kardo = [
    { t: 'Ding ding!', hint: 'Mang Kardo loves his bell a little too much.',
      lines: [[KA, 'Every horse here knows my bell. Watch: ding ding!'], [ME, '(Twelve horses look up at once.)']],
      choice: { q: Q, a: [['Let me ring it!', 'They looked at you too! Oat seeds: grow some for them.', { pts: 3 }], ['That is amazing.', 'Forty years of practice! Take these oat seeds.']] },
      reward: [{ item: 'seed_oats', n: 6 }] },
    { t: 'Brushing day', hint: 'Twelve horses, one Mang Kardo, one brush.', help: 15,
      lines: [[KA, 'Brushing day! Take a brush, take a horse.'], [ME, '(You brush until every horse shines like a new coin.)'], [KA, 'Like show horses! Gentle hands.']],
      choice: { q: Q, a: [['They are beautiful.', 'And spoiled. Treats, for your own animals.', { pts: 2 }], ['One more and I faint.', 'Then no more! Take these treats.']] },
      reward: [{ item: 'treat', n: 3 }] },
    { t: 'Carrots for the race', hint: 'The race horses are hungry. Very hungry.', bring: ['carrot', 20],
      lines: [[KA, 'Race week! The horses need carrots. Many carrots. Bring 20 Carrots from your farm?']],
      choice: { q: Q, a: [['Carrots coming!', 'Ding ding! My happy ding.'], ['Only the best for racers.', 'Spoken like a race host!', { pts: 2 }]] },
      thanks: [[KA, 'Crunch crunch! Happy horses! Hay bales for your yard, and gold from the race committee.']],
      reward: [{ yard: 'hay_bales' }, { gold: 500 }] },
    { t: 'The Manila Cup', hint: 'Mang Kardo once won something. He never says what.',
      lines: [[KA, 'I won the Manila Cup once, on Kidlat. The smallest horse in the race. Everyone laughed.'],
        [KA, 'He jumped the last hurdle like he had wings. Ding ding was the finish line bell. That is why I ring it.']],
      choice: { q: Q, a: [['Kidlat was a champion.', 'The best. Take this clock: it timed his race.'], ['Ding ding!', 'You understand! Take his old clock.']] },
      reward: [{ secret: 'Mang Kardo won the Manila Cup on Kidlat, the smallest horse in the race. "Ding ding" was the finish line bell.' }, { furn: 'clock', style: 'classic' }, { gold: 800 }] },
  ];
  var MA = 'mn_marisol';
  S.mn_marisol = [
    { t: 'The lighthouse lamp', hint: 'Kapitana Marisol checks the lighthouse every evening.',
      lines: [[MA, 'A hundred years this lamp has guided the boats home. The berths are empty, and still I keep it lit.']],
      choice: { q: Q, a: [['The boats will come.', 'They will. Bait: even an empty bay has fish.', { pts: 3 }], ['That is beautiful.', 'Do not tell anyone the harbor master is a poet. Take some bait.']] },
      reward: [{ item: 'bait', n: 10 }] },
    { t: 'Mending nets', hint: "The storm tore the fishermen's nets.", help: 15,
      lines: [[MA, 'Sit. Over, under, knot.'], [ME, '(You mend nets until the sun sets over the bay.)'], [MA, 'Not bad, for a farmer. They will catch well tomorrow.']],
      choice: { q: Q, a: [['I liked it.', 'You have the sea in you. The fishermen sent these.', { pts: 2 }], ['My fingers!', "Sailors' fingers. Take these."]] },
      reward: [{ item: 'fish_l', n: 2 }, { gold: 300 }] },
    { t: 'Fish for the port', hint: "The port's cook has nothing to cook.", bring: ['fish_m', 5],
      lines: [[MA, 'A port with no fish! The cook is crying. Bring me 5 Medium Fish?']],
      choice: { q: Q, a: [['Five, coming up.', 'Fast, ha?'], ['A port with no fish!', 'A scandal!', { pts: 2 }]] },
      thanks: [[MA, 'He stopped crying. Now he sings. Worse. Gold from the port, and an aquarium from my office.']],
      reward: [{ gold: 600 }, { furn: 'aquarium', style: 'modern' }] },
    { t: "The captain's compass", hint: 'Kapitana Marisol\'s old compass points somewhere strange.',
      lines: [[MA, "My lola's compass does not point north. It points to her island, far south. She never went back."],
        [MA, 'One day there will be a boat in my berth, and I will sail there. With a friend, maybe.']],
      choice: { q: Q, a: [['Take me with you.', 'A promise. Crew of two. Lanterns for the voyage.'], ['I hope you find it.', 'I will. Take these lanterns.']] },
      reward: [{ secret: "Kapitana Marisol's compass points to her lola's island, not north. One day she will sail there." }, { yard: 'paper_lanterns' }, { gold: 700 }] },
  ];
  var TI = 'mn_tibo';
  S.mn_tibo = [
    { t: 'On time', hint: 'Mang Tibo is very proud of his trains.',
      lines: [[TI, 'Forty years, and the 7:15 was late only three times. A carabao, a typhoon, and once I overslept. Shh!']],
      choice: { q: Q, a: [['Your secret is safe.', 'Salamat! My favourite coffee, for you.', { pts: 3 }], ['Only three times!', 'In forty years! Coffee, on the house.']] },
      reward: [{ item: 'kapeng_barako', n: 2 }] },
    { t: 'The lost-and-found', hint: 'Mang Tibo has a room full of things left on the train.', help: 10,
      lines: [[TI, 'Help me sort the lost-and-found, anak!'], [ME, '(Umbrellas, hats, a rubber chicken and one live duck.)'], [TI, 'A duck! Again! Who leaves a duck on a train?']],
      choice: { q: Q, a: [['Can I keep the chicken?', 'It is yours! And a reward from the station.', { pts: 2 }], ["Find the duck's owner!", 'I will put up a sign. Here, for your help.']] },
      reward: [{ gold: 400 }] },
    { t: 'The station clock', hint: 'The big station clock stopped. Mang Tibo is in a panic.', bring: ['ore_silver', 3],
      lines: [[TI, 'The clock stopped! Panday Lando can fix it with 3 Silver Ore. Please, anak!']],
      choice: { q: Q, a: [['Hold on, Mang Tibo!', 'Hurry! The 3:40 is in an hour!'], ['Breathe, Mang Tibo.', 'Breathing... salamat. Hurry, ha?', { pts: 2 }]] },
      thanks: [[TI, 'Tick, tock. Pure music! Lando made you a little copy of the clock.']],
      reward: [{ furn: 'clock', style: 'royal' }] },
    { t: 'The first train', hint: 'Mang Tibo remembers the day he came to Manila.',
      lines: [[TI, 'At sixteen I came to Manila on the first train from Willowbrook, with one shirt and half a pandesal.'],
        [TI, 'The station master gave me a broom. Now I am the station master. And you came from Willowbrook too.']],
      choice: { q: Q, a: [['We are train people.', 'Train people! A bench from the old platform, for your yard.'], ['Half a pandesal!', 'I was hungry! Take this bench from the old platform.']] },
      reward: [{ secret: 'Mang Tibo came to Manila on the first train from Willowbrook at sixteen, with one shirt and half a pandesal.' }, { yard: 'bench' }, { gold: 900 }] },
  ];
  // Lola Amparo: the old city's story (the walls, the galleons, the war, the city rising again), each step a framed photo
  var AM = 'mn_amparo';
  S.mn_amparo = [
    { t: 'The walls', hint: 'Lola Amparo wants to tell you about the old walls.',
      lines: [[AM, 'Long ago, apo, they built these walls round the city, stone by stone: churches, houses and schools inside.'],
        [AM, 'My lola said the walls were the city\'s arms, holding everyone close. Here, a photograph of them, new.']],
      choice: { q: Q, a: [["The city's arms.", 'Yes, apo. And now you are inside them too.', { pts: 3 }], ['How old are they?', "Older than my lola's lola's lola."]] },
      reward: [{ photo: 'The old walls of the city', people: [], style: 'classic' }] },
    { t: 'The galleons', hint: 'Lola Amparo remembers what her lola said about the big ships.',
      lines: [[AM, 'Once great galleons filled the bay. Months across the sea, with silk, spices and silver.'],
        [AM, 'The whole world came here. This little port was the door between two oceans. Look at the sails!']],
      choice: { q: Q, a: [['The door between two oceans.', 'And one day the boats come back. Kapitana Marisol believes it. So do I.'], ['Months at sea!', 'With only rice and dried fish. Poor sailors!', { pts: 2 }]] },
      reward: [{ photo: 'A galleon on Manila Bay', people: [], style: 'starry' }] },
    { t: 'The hard years', hint: 'Lola Amparo has a sad story. She wants sampaguita for it.', bring: ['sampaguita', 5],
      lines: [[AM, 'A war came, apo. The city was hurt badly. My family hid in the Old Stone Church. It shook, but it stood.'],
        [AM, 'Every year I bring sampaguita for the ones who did not come out. My hands are too old to pick them. Bring me 5?']],
      choice: { q: Q, a: [['Of course, Lola.', 'You have a good heart.'], ['The best ones.', 'Only the best, for them.', { pts: 2 }]] },
      thanks: [[AM, "They smell like my mother's hair. Father Ramon will put them on the altar. Here: the church that stood."]],
      reward: [{ photo: 'The church that stood', people: [], style: 'cottage' }, { gold: 300 }] },
    { t: 'The city rising', hint: 'Lola Amparo keeps one last photo in her apron.',
      lines: [[AM, 'After the war everyone came back with nothing but their hands. The market, the station, the plaza: all rebuilt.'],
        [AM, 'My secret? I rang the church bell the day it was fixed. I was seven. This is that day. Keep the stories, apo.']],
      choice: { q: Q, a: [['I will keep them, Lola.', 'Then I can rest. The stories are in good hands.'], ['You rang the bell!', 'Ding, dong! The whole city cried and cheered.']] },
      reward: [{ secret: 'Lola Amparo rang the church bell the day it was fixed after the war. She was seven.' }, { photo: 'Manila rising again', people: [], style: 'fireworks' }, { gold: 500 }] },
  ];
  var RA = 'mn_ramon';
  S.mn_ramon = [
    { t: 'The bells', hint: 'Father Ramon rings the church bells himself.',
      lines: [[RA, 'Six, noon, six. The bells call the city together. A city should be woken kindly. And loudly.']],
      choice: { q: Q, a: [['They are lovely.', 'Bless you. Sampaguita seeds: they grow by the church door.', { pts: 3 }], ['A little loud...', 'The pigeons agree! Take these seeds anyway.']] },
      reward: [{ item: 'seed_sampaguita', n: 6 }] },
    { t: 'Flowers for the altar', hint: "The church's altar has no flowers this week.", bring: ['sampaguita', 10],
      lines: [[RA, 'The flower seller is sick, and the altar is bare. Would you bring 10 Sampaguita, my child?']],
      choice: { q: Q, a: [['Gladly, Father.', 'Bless you.'], ['For her too.', 'A kind heart. I will tell her.', { pts: 3 }]] },
      thanks: [[RA, 'The church smells of heaven. She is better, and sent you this. And a gift from the church.']],
      reward: [{ item: 'bouquet', n: 1 }, { gold: 400 }] },
    { t: 'The feeding program', hint: "On Saturdays, Father Ramon cooks for the barangay's children.", help: 20,
      lines: [[RA, 'Two hundred children, two hundred bowls of arroz caldo. Stir, my child!'], [ME, '(You stir and serve until the last child smiles.)'],
        [RA, 'Two hundred full bellies. The best sermon I know.']],
      choice: { q: Q, a: [['Next Saturday too.', 'Bless you. This flower arch, for your yard.', { pts: 3 }], ['So many children!', 'More each week. Take this arch.']] },
      reward: [{ yard: 'flower_arch' }] },
    { t: 'Before the collar', hint: 'Father Ramon was not always a priest.',
      lines: [[RA, 'Before the collar I drove a jeepney. Twelve years, one route. I knew every passenger and their troubles.'],
        [RA, 'One day I thought: I listen to everyone already. Why not do it properly? Still listening, same streets.']],
      choice: { q: Q, a: [['You still drive us home.', 'The nicest thing I heard all year. Take this plant.'], ['Para po!', 'Ha! Old habits. Take this plant.']] },
      reward: [{ secret: 'Father Ramon drove a jeepney for twelve years before he was a priest. "I listened to everyone already."' }, { furn: 'big_plant', style: 'flower' }, { gold: 600 }] },
  ];
  var BE = 'mn_bea';
  S.mn_bea = [
    { t: 'Exam week', hint: 'Bea is cramming for an exam. Again.',
      lines: [[BE, 'Soil science exam tomorrow! What does good soil need? Quick!'], [ME, '(You tell her what your farm likes.)'], [BE, 'That is not in my book! You know more than my professor!']],
      choice: { q: Q, a: [['Good luck!', 'Salamat! Cookies: brain food!', { pts: 3 }], ['Farmers learn by doing.', 'Writing that on my exam! Take these.']] },
      reward: [{ item: 'cookie', n: 3 }] },
    { t: 'The interview', hint: 'Bea needs a real farmer for her project.',
      lines: [[BE, 'My project is farms that feed the city. Can I interview you? Please? Question one: the hardest part?']],
      choice: { q: 'The hardest part?', a: [['Waiting for the harvest.', 'Patience! So deep. Seeds from my class, for your patience.', { pts: 2 }], ['Waking up early.', 'Same with studying! Take these seeds.']] },
      reward: [{ seeds: 8 }] },
    { t: 'The class party', hint: 'The class wants to taste real farm strawberries.', bring: ['strawberry', 10],
      lines: [[BE, 'Everyone wants real farm strawberries now! Bring 10? I will say they are from my famous farmer friend.']],
      choice: { q: Q, a: [['Your famous farmer friend!', 'The most famous! Migs is jealous.'], ['Ten, coming up.', 'Yay!', { pts: 2 }]] },
      thanks: [[BE, 'They LOVED them! Joy ate four. Joy never eats four of anything! The class chipped in to thank you.']],
      reward: [{ gold: 500 }] },
    { t: 'After graduation', hint: 'Bea has a plan for after college. She has told no one.',
      lines: [[BE, 'Not even Migs and Joy know: after college I want to farm. Like you. Not an office in a tower.'],
        [BE, 'My parents want the city. But you showed me: the city needs farmers more than offices.']],
      choice: { q: Q, a: [['Follow your heart.', 'I will! My study desk, and a scarecrow from art class.'], ['Visit my farm first.', 'A field trip! Take my desk and my scarecrow.']] },
      reward: [{ secret: 'Bea wants to farm after college, not work in an office tower. Not even Migs and Joy know.' }, { furn: 'desk', style: 'modern' }, { yard: 'scarecrow' }] },
  ];
  var NE = 'mn_nena';
  S.mn_nena = [
    { t: 'Kain na!', hint: 'Aling Nena wants to feed you. Properly.',
      lines: [[NE, 'You look hungry, anak. Sit. Eat. No arguing.'], [ME, '(Rice, adobo and a little sinigang appear in front of you.)'], [NE, 'Now you look like a person. Soup for the road.']],
      choice: { q: Q, a: [['The best adobo in Manila!', 'You know how to talk to a cook! Two bowls, then.', { pts: 3 }], ['I was not hungry...', 'Everyone is hungry. Take the soup.']] },
      reward: [{ item: 'hot_soup', n: 2 }] },
    { t: 'Pinakbet day', hint: "Aling Nena's pinakbet needs eggplant. The market ran out.", bring: ['eggplant', 10],
      lines: [[NE, 'Pinakbet day and no eggplant in the whole Talipapa! Bring me 10 Eggplants from your farm, anak.']],
      choice: { q: Q, a: [['For your pinakbet, anything.', 'Sweet child.'], ['No pinakbet without eggplant!', 'You understand food.', { pts: 2 }]] },
      thanks: [[NE, 'Shiny and purple! The barangay eats well today. From the sales: fair is fair.']],
      reward: [{ gold: 450 }] },
    { t: 'The lunch rush', hint: "Twelve o'clock at the carinderia is chaos.", help: 20,
      lines: [[NE, 'Office workers, drivers, students! Help me serve!'], [ME, '(You scoop rice and ladle adobo until every plate is clean.)'], [NE, 'One hundred and twelve plates! A record!']],
      choice: { q: Q, a: [['I would work here!', 'Do not tempt me. My old table, for your kitchen.', { pts: 3 }], ['Never again!', 'My husband said that, twenty years ago. Take my old table.']] },
      reward: [{ furn: 'table', style: 'cottage' }] },
    { t: 'The secret ingredient', hint: "Everyone asks about Aling Nena's adobo. She never tells.",
      lines: [[NE, 'The secret of my adobo? A little sinigang broth. My mother\'s trick. Only you know now.'],
        [NE, 'And every day I keep a pot of rice for anyone who cannot pay. Shh.']],
      choice: { q: Q, a: [['Your secrets are safe.', 'I know, anak. This shelf, for your own recipes.'], ['That is a kind secret.', 'Kindness is the best seasoning. Take this shelf.']] },
      reward: [{ secret: "Aling Nena's adobo has a little sinigang broth in it, and she keeps rice for anyone who cannot pay." }, { furn: 'shelf', style: 'cottage' }, { gold: 700 }] },
  ];
})(window.Farm = window.Farm || {});
