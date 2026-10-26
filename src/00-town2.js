// Willowbrook grows: 16 more villagers (who they are, where they go, what they like, what they say, their
// letters and heart events), the new shops and homes, the bakery's and the vet's goods, and the visitors who
// come from out of town to shop. Loaded after 00-story.js; appended to the tables there, so older saves (which
// store villagers by their place in VILLAGER_ORDER) keep working.
(function (F) {
  'use strict';
  var C = F.Config;
  var H = 60; // minutes per hour, for the schedules

  // ---------- new goods ----------
  ['bread', 'cookie', 'cake', 'bouquet', 'treat'].forEach(function (n) { C.ICON_ORDER.push(n); });
  C.ICON_ORDER.forEach(function (name, i) { C.ICON[name] = i; });
  var NEW_ITEMS = {
    bread: { name: 'Fresh Bread', icon: 'bread', kind: 'dish', energy: 25, price: 60, desc: "Hana's crusty loaf, still warm." },
    cookie: { name: 'Cookies', icon: 'cookie', kind: 'dish', energy: 15, price: 40, desc: 'Butter cookies. Children love them.' },
    cake: { name: 'Strawberry Cake', icon: 'cake', kind: 'dish', energy: 70, price: 320, desc: 'A whole cake with cream and strawberries.' },
    bouquet: { name: 'Bouquet', icon: 'bouquet', kind: 'gift', price: 200, desc: 'A bunch of fresh flowers. Almost everyone loves one.' },
    treat: { name: 'Animal Treat', icon: 'treat', kind: 'treat', price: 120, desc: 'Give it to a farm animal: it loves you a little more.' },
  };
  Object.keys(NEW_ITEMS).forEach(function (id) {
    var it = NEW_ITEMS[id];
    it.icon = C.ICON[it.icon];
    C.ITEMS[id] = it;
  });
  C.TREAT_LOVE = 12;
  C.ITEMS.grilled_fish.price = 150; // sold at the Seaside Shack
  C.ITEMS.tomato_soup.price = 200;

  // ---------- the villagers ----------
  // places: Tiled points on the town map; 'in:x' = inside building x.
  // rest = the schedule on rest days (every 6th and 7th day of the week), when there is no school.
  var V = {
    pearl: {
      name: 'Grandma Pearl', role: 'Grandmother', home: 'lane1', birthday: [5, 27],
      loves: ['pumpkin_pie', 'bouquet', 'jam'], likes: ['berry', 'milk', 'cake', 'cookie'], dislikes: ['ore_copper', 'fish_s'],
      schedule: [[6 * H, 'in:lane1'], [8 * H, 'lane_garden'], [10 * H, 'park_bench'], [12 * H, 'in:lane1'], [15 * H, 'in:bakery'], [16 * H, 'plaza_s'], [18 * H, 'in:lane1']],
    },
    ewan: {
      name: 'Grandpa Ewan', role: 'Retired fisherman', home: 'lane1', birthday: [6, 3],
      loves: ['grilled_fish', 'fish_l', 'hot_soup'], likes: ['fish_m', 'baked_potato', 'bread', 'corn'], dislikes: ['cake', 'jam'],
      schedule: [[6 * H, 'pier'], [10 * H, 'in:shack'], [16 * H, 'park_pond'], [18 * H, 'in:inn'], [20 * H, 'in:lane1']],
    },
    pip: {
      name: 'Pip', role: 'Schoolboy', home: 'lane1', birthday: [9, 8], child: true,
      loves: ['cookie', 'strawberry', 'cake'], likes: ['berry', 'jam', 'corn', 'egg'], dislikes: ['carrot', 'herb', 'mushroom_soup'],
      schedule: [[6 * H, 'in:lane1'], [8 * H, 'in:school'], [14 * H, 'playground'], [17 * H, 'plaza_n'], [18 * H, 'in:lane1']],
      rest: [[6 * H, 'in:lane1'], [9 * H, 'playground'], [12 * H, 'beach'], [15 * H, 'park_pond'], [18 * H, 'in:lane1']],
    },
    daisy: {
      name: 'Daisy', role: 'Schoolgirl', home: 'lane1', birthday: [2, 19], child: true,
      loves: ['cookie', 'bouquet', 'strawberry'], likes: ['jam', 'berry', 'egg', 'milk'], dislikes: ['fish_s', 'mushroom', 'ore_copper'],
      schedule: [[6 * H, 'in:lane1'], [8 * H, 'in:school'], [14 * H, 'playground'], [16 * H, 'in:florist'], [17 * H, 'lane_garden'], [18 * H, 'in:lane1']],
      rest: [[6 * H, 'in:lane1'], [9 * H, 'lane_garden'], [11 * H, 'playground'], [14 * H, 'beach'], [17 * H, 'in:lane1']],
    },
    clara: {
      name: 'Clara', role: 'Teacher', candidate: true, home: 'lane2', birthday: [3, 11],
      loves: ['cake', 'tomato_soup', 'bouquet'], likes: ['bread', 'carrot', 'herb', 'hot_milk'], dislikes: ['fish_s', 'ore_copper'],
      schedule: [[6 * H, 'in:lane2'], [7 * H + 30, 'in:school'], [15 * H, 'in:library'], [17 * H, 'park_bench'], [19 * H, 'in:lane2']],
      rest: [[6 * H, 'in:lane2'], [10 * H, 'in:library'], [13 * H, 'gazebo'], [16 * H, 'market_w'], [18 * H, 'in:inn'], [21 * H, 'in:lane2']],
    },
    tomas: {
      name: 'Father Tomas', role: 'Priest', home: 'chapel', birthday: [12, 4],
      loves: ['bread', 'hot_soup', 'veggie_stew'], likes: ['milk', 'potato', 'egg', 'turnip'], dislikes: ['gem', 'ore_gold'],
      schedule: [[6 * H, 'in:chapel'], [11 * H, 'chapel_yard'], [13 * H, 'in:chapel'], [16 * H, 'plaza_c'], [17 * H, 'in:chapel']],
    },
    hana: {
      name: 'Hana', role: 'Baker', candidate: true, home: 'bakery', birthday: [7, 15],
      loves: ['strawberry', 'egg_l', 'milk_l'], likes: ['egg', 'milk', 'berry', 'pumpkin', 'jam'], dislikes: ['fish_m', 'ore_silver'],
      schedule: [[6 * H, 'in:bakery'], [15 * H, 'market_e'], [16 * H, 'beach'], [18 * H, 'in:bakery']],
    },
    marco: {
      name: 'Marco', role: 'Travelling merchant', candidate: true, home: 'inn', birthday: [11, 25],
      loves: ['gem', 'truffle', 'ore_gold'], likes: ['carabao_milk', 'pumpkin', 'corn', 'sandwich'], dislikes: ['root', 'herb'],
      schedule: [[6 * H, 'in:inn'], [9 * H, 'wagon'], [17 * H, 'plaza_e'], [19 * H, 'in:inn']],
    },
    sora: {
      name: 'Sora', role: 'Artist', candidate: true, home: 'lane3', birthday: [3, 2],
      loves: ['bouquet', 'gem', 'mushroom'], likes: ['berry', 'tomato', 'root', 'cookie'], dislikes: ['ore_copper', 'fish_l'],
      schedule: [[6 * H, 'in:lane3'], [9 * H, 'park_easel'], [13 * H, 'beach'], [16 * H, 'park_easel'], [19 * H, 'in:inn'], [21 * H, 'in:lane3']],
    },
    hale: {
      name: 'Dr. Hale', role: 'Doctor', home: 'lane4', birthday: [10, 22],
      loves: ['veggie_stew', 'tonic', 'fish_k'], likes: ['carrot', 'tomato', 'herb', 'hot_soup'], dislikes: ['cake', 'cookie'],
      schedule: [[6 * H, 'in:lane4'], [8 * H + 30, 'in:clinic'], [17 * H, 'park_pond'], [18 * H, 'in:lane4']],
    },
    nina: {
      name: 'Nina', role: 'Nurse', candidate: true, home: 'lane2', birthday: [8, 27],
      loves: ['cake', 'hot_milk', 'bouquet'], likes: ['tonic', 'berry', 'cookie', 'sandwich'], dislikes: ['ore_silver', 'fish_s'],
      schedule: [[6 * H, 'in:lane2'], [8 * H + 30, 'in:clinic'], [17 * H, 'market_e'], [18 * H, 'in:inn'], [20 * H, 'in:lane2']],
    },
    owen: {
      name: 'Owen', role: 'Veterinarian', candidate: true, home: 'vet', birthday: [1, 14],
      loves: ['carabao_milk', 'milk_l', 'baked_potato'], likes: ['egg', 'milk', 'carrot', 'corn'], dislikes: ['mushroom', 'jam'],
      schedule: [[6 * H, 'park_pond'], [8 * H, 'in:vet'], [17 * H, 'plaza_e'], [19 * H, 'in:vet']],
    },
    poppy: {
      name: 'Poppy', role: 'Florist', candidate: true, home: 'florist', birthday: [4, 16],
      loves: ['bouquet', 'strawberry', 'herb'], likes: ['berry', 'root', 'tomato', 'cookie'], dislikes: ['ore_copper', 'ore_silver', 'fish_m'],
      schedule: [[6 * H, 'lane_garden'], [8 * H, 'in:florist'], [17 * H, 'gazebo'], [19 * H, 'in:florist']],
    },
    finn: {
      name: 'Finn', role: 'Mail carrier', candidate: true, home: 'post', birthday: [8, 11],
      loves: ['sandwich', 'grilled_fish', 'corn'], likes: ['bread', 'boiled_egg', 'potato', 'turnip'], dislikes: ['mushroom_soup', 'herb'],
      schedule: [[6 * H, 'in:post'], [7 * H, 'lane'], [8 * H, 'plaza_n'], [9 * H, 'in:post'], [13 * H, 'market_w'], [14 * H, 'in:post'], [17 * H, 'beach'], [19 * H, 'in:inn'], [21 * H, 'in:post']],
    },
    elliot: {
      name: 'Elliot', role: 'Librarian', candidate: true, home: 'library', birthday: [10, 6],
      loves: ['mushroom_soup', 'hot_milk', 'truffle'], likes: ['bread', 'tomato_soup', 'berry', 'cake'], dislikes: ['fish_l', 'corn'],
      schedule: [[6 * H, 'in:library'], [18 * H, 'gazebo'], [20 * H, 'in:library']],
    },
    jules: {
      name: 'Jules', role: 'Musician', candidate: true, home: 'lane3', birthday: [2, 27],
      loves: ['pumpkin_pie', 'gem', 'berry'], likes: ['cookie', 'jam', 'sandwich', 'milk'], dislikes: ['turnip', 'root'],
      schedule: [[6 * H, 'in:lane3'], [10 * H, 'gazebo'], [13 * H, 'plaza_c'], [16 * H, 'beach'], [18 * H, 'in:inn'], [23 * H, 'in:lane3']],
    },
  };
  Object.keys(V).forEach(function (k) {
    C.VILLAGERS[k] = V[k];
    C.VILLAGER_ORDER.push(k);
  });

  // ---------- the new buildings ----------
  // offers: what the building's panel does (see 19e-town.js). days: open only on these days of the week (1..7).
  Object.assign(C.BUILDINGS, {
    bakery: { name: "Hana's Bakery", open: [7 * H, 23 * H], owner: 'hana', offers: ['bakery'] },
    florist: { name: "Poppy's Flowers", open: [7 * H, 23 * H], owner: 'poppy', offers: ['florist'] },
    post: { name: 'Post Office', open: [7 * H, 23 * H], owner: 'finn', offers: ['post'] },
    library: { name: 'Willow Library', open: [7 * H, 23 * H], owner: 'elliot', offers: ['library'] },
    school: { name: 'Willowbrook School', open: [8 * H, 15 * H], owner: 'clara', offers: ['school'], days: [1, 2, 3, 4, 5] },
    chapel: { name: 'Chapel', open: [6 * H, 22 * H], owner: 'tomas', offers: ['chapel'] },
    vet: { name: "Owen's Animal Clinic", open: [7 * H, 23 * H], owner: 'owen', offers: ['vet'] },
    shack: { name: 'Seaside Shack', open: [7 * H, 23 * H], owner: 'ewan', offers: ['shack'] },
    wagon: { name: "Marco's Wagon", open: [7 * H, 23 * H], owner: 'marco', offers: ['wagon'] },
    lane1: { name: "Pearl and Ewan's House" },
    lane2: { name: "Clara and Nina's House" },
    lane3: { name: 'The Studio' },
    lane4: { name: "Dr. Hale's House" },
  });
  C.REST_DAYS = [6, 7]; // days of the week with no school (day 1 of spring is day 1 of the week)

  C.BAKERY_MENU = ['bread', 'cookie', 'cake'];
  C.SHACK_MENU = ['grilled_fish', 'tomato_soup'];
  C.FLORIST_STOCK = ['bouquet'];
  C.VET_STOCK = ['treat', 'miracle', 'brush'];
  C.POST_FEE = 30; // to mail a gift; it counts as that day's gift, at this share of the friendship
  C.POST_SHARE = 0.75;
  C.CHAPEL_REST = { energy: 15, minutes: 30 }; // once a day
  C.SCHOOL_HELP = { minutes: 60, pts: 4 }; // help with a lesson once a day: friendship with the teacher and children
  C.WAGON = { deals: 4, off: 0.2 }; // Marco's imported furniture: 4 pieces a day, 20% off, any style

  // Books in the library: a page each.
  C.BOOKS = [
    { title: 'The Willowbrook Almanac', text: 'Spring: turnips, potatoes, strawberries. Summer: tomatoes and corn. Fall: carrots and pumpkins. Winter: rest the soil, visit the mine, and care for your animals. Rain waters every tilled tile, even ones you hoe in the rain.' },
    { title: 'A Short History of the Valley', text: 'Willowbrook began as a ferry stop on the river. The first farmers came for the black soil, the second for the fish, and the third, it is said, for the pumpkin pie at the inn.' },
    { title: 'Happy Animals, Happy Farm', text: 'Pet and brush your animals every day and keep the trough full. A treat from the vet makes any animal glad. Happy cows give large milk, and a loved pig finds more truffles.' },
    { title: 'Hearts and Gifts', text: 'Talk to your neighbours every day. A gift they love counts most, and twice as much on their birthday. A Blue Feather shows someone you are serious about them.' },
    { title: 'The Mine Below the Hill', text: 'Copper sits near the top, silver further down and gold deeper still. Every fifth floor hides a treasure chest. Bring food: digging is hungry work.' },
    { title: 'Selling at the Market', text: 'Price a lot Low to sell it quickly, or High to wait for a buyer who will pay more. Orders on the board pay a bonus and win the buyer\'s friendship.' },
  ];

  // Shoppers from out of town (no friendship, no gifts): they walk in, look around, buy at the market and leave.
  C.SHOPPERS = [
    { key: 'visitor_farmer', name: 'Visiting farmer', look: 'a farmer from the next valley in a straw hat and denim overalls', line: 'Your town has the best produce in the valley!' },
    { key: 'visitor_tourist', name: 'Tourist', look: 'a cheerful tourist with a sun hat, a camera and a floral shirt', line: 'What a charming little town. I must take a picture!' },
    { key: 'visitor_mother', name: 'Young mother', look: 'a young mother with a ponytail, a yellow cardigan and a shopping basket', line: 'I come here every week for fresh vegetables.' },
    { key: 'visitor_elder', name: 'Old traveller', look: 'an old man with a walking stick, a flat cap and a brown waistcoat', line: 'In my day this was all fields. Now look at it!' },
    { key: 'visitor_student', name: 'Student', look: 'a young student with a backpack, glasses and a green hoodie', line: 'I heard the stall here sells the freshest strawberries.' },
    { key: 'visitor_chef', name: 'City chef', look: 'a chef in a white jacket and a tall white hat, carrying a crate', line: 'Fresh ingredients make all the difference in my kitchen.' },
  ];
  C.SHOPPER = { max: 4, from: 8 * H, to: 21 * H, every: 20 }; // at most 4 in town; one arrives every ~20 minutes

  // ---------- what they say ----------
  var D = C.DIALOGUE;
  var gifts = function (love, like, neutral, dislike) { return { love: love, like: like, neutral: neutral, dislike: dislike }; };
  D.pearl = {
    intro: "Oh, a new face! I'm Pearl, but everyone calls me Grandma Pearl. The little ones, Pip and Daisy, are my grandchildren. Come for tea sometime, dear.",
    tiers: [
      ['My garden roses bloom early this year. A good sign!', 'Ewan goes fishing every morning. Forty years, and he still comes home smelling of river.', 'You look thin, dear. Are you eating properly?'],
      ['I knitted a scarf for the mayor. He wears it in July, bless him.', 'Pip asked me where carrots come from. I told him: hard work.', 'Your grandfather used to bring me pumpkins every fall.'],
      ['You remind me of my Ewan when he was young. Always busy, always smiling.', 'Come sit with me in the park. My knees and I enjoy company.', 'I saved you a slice of pie. Do not tell the children.'],
      ['You are family to us now, dear. Never forget that.', 'When I watch you work, I know the valley is in good hands.', 'Every evening I count my blessings. You are one of them.'],
    ],
    rain: 'Rain! Perfect weather for tea and a long story.',
    birthday: "My birthday? At my age I stopped counting, but I never stop enjoying presents! Thank you, dear.",
    gift: gifts('Oh, my favourite! You spoil an old lady.', 'How lovely. Thank you, dear.', 'Thank you, sweetheart.', 'Oh dear. Well, I will find a use for it.'),
    spouse: [],
  };
  D.ewan = {
    intro: "Ewan. Fished this river for forty years, and now I run the shack on the beach. If the fish bite, I sell them grilled. If they don't, I sell stories.",
    tiers: [
      ['Fish bite best at dawn. Remember that.', 'The lake down south is deeper than it looks. Big ones live there.', 'Pearl says I talk too much about fish. She is right.'],
      ['You fish? Show me your cast sometime.', 'Saw a King Trout once. Biggest thing I ever saw that was not a whale.', 'The shack makes the best grilled fish in the valley. Ask anyone. Ask me.'],
      ['Leo was my apprentice, you know. Good lad. You remind me of him.', 'The sea birds come back every summer. So do I, to the pier.', 'Sit down, sit down. Let me tell you about the storm of forty-two.'],
      ['You have the patience of a fisherman. Highest praise I give.', 'If I had a son, I would want him to work like you.', 'The river gave me a good life. So does this town. And you are part of it.'],
    ],
    rain: 'Rain makes the fish hungry. Best day to cast a line.',
    birthday: 'My birthday, is it? Pearl reminded me twice. Thank you, friend.',
    gift: gifts('Now that is a proper gift! Thank you!', 'Hm, nice. Thanks.', 'Thank you kindly.', 'Not for me, I think. But thank you.'),
    spouse: [],
  };
  D.pip = {
    intro: "Whoa, you're the farmer! Do you have cows? Can I ride one? I'm Pip. I'm eight and three quarters!",
    tiers: [
      ['Miss Clara says I have to do my sums before I play. Sums are boring.', 'I found a frog by the pond! I named him Captain.', 'Daisy is my little sister. She is okay. Mostly.'],
      ['When I grow up I want to be a farmer like you! Or a pirate.', 'Grandma makes the best cookies. Hana makes the second best. Do not tell Grandma.', 'Can you lift a whole pumpkin? I bet you can.'],
      ['You are my best grown-up friend. Except Grandpa. You are tied.', 'I practised fishing with Grandpa. I caught a boot!', 'Will you come watch me on the slide? I can go really fast.'],
      ['I told everyone at school that you are my friend. They were so jealous!', 'I drew a picture of your farm. The cow is purple because I ran out of brown.', 'Someday I am going to help on your farm. Okay? Promise?'],
    ],
    rain: "Rain means puddles! Puddles mean jumping!",
    birthday: "It's my birthday! You got me a present?! You're the best!",
    gift: gifts('WOW! This is the best thing ever!', 'Cool! Thanks!', 'Um, thanks.', "Eww. I don't like that."),
    spouse: [],
  };
  D.daisy = {
    intro: "Hi. I'm Daisy. I'm six. Do you like flowers? I like flowers. Poppy lets me help at her shop.",
    tiers: [
      ['Pip says frogs are better than flowers. Pip is wrong.', 'I can count to a hundred. Want to hear?', 'Grandma says I have green thumbs. My thumbs are pink though.'],
      ['I planted a seed in a cup. It is a baby flower now!', 'Your farm has so many colours. Like a rainbow.', 'Miss Clara gave me a gold star today!'],
      ['Can I give your cow a hug? A small one?', 'I made you a daisy chain. It is a crown. You are the farm king. Or queen. Or just the farmer!', 'You are my friend. Pip can find his own.'],
      ['When I grow up I want a flower farm. Will you show me how?', 'I love you this much! (She spreads her arms very wide.)', 'You are the nicest grown-up in the whole world.'],
    ],
    rain: 'The flowers are drinking! Shh, listen.',
    birthday: 'You remembered my birthday! I am so happy I could dance!',
    gift: gifts('Oh! I love it so, so much!', 'Thank you! That is pretty.', 'Thank you.', "I don't like that one..."),
    spouse: [],
  };
  D.clara = {
    intro: "Hello! I'm Clara, the teacher at Willowbrook School. My students talk about your farm all day. Pip insists you own a dragon.",
    tiers: [
      ['Teaching twelve children is easy. Teaching Pip to sit still is not.', 'I read in the library after class. It is the quietest place in town.', 'If you ever want to visit the class, the children would love a real farmer.'],
      ['The children planted beans in the schoolyard. Half of them are growing. Half of them are Pip.', 'I grew up in the city, but I never felt at home until I came here.', 'Do you have a favourite book? I am always looking for new ones.'],
      ['I have started a little reading club at the inn. You would be welcome.', 'You have a teacher\'s patience. Has anyone told you that?', 'Some days I grade papers until midnight. Some days I just watch the stars.'],
      ['I find myself looking out the window for you during class. That is terrible of me.', 'You make this town feel like a story with a happy ending.', 'I hope you know how much our talks mean to me.'],
    ],
    rain: 'Rainy days are reading days. The children love a story when it pours.',
    birthday: 'For my birthday? You are so thoughtful. Thank you!',
    gift: gifts('This is wonderful! You know me so well.', 'How nice. Thank you!', 'Thank you, that is kind.', 'Oh... thank you, I suppose.'),
    propose: { yes: 'A Blue Feather...? Yes. Yes! I have rehearsed this moment in my head a hundred times, and it is better than all of them.', no: 'You are very dear to me, but I need a little more time.' },
    spouse: ['Good morning! I packed my lesson plans and your lunch. Do not mix them up.', 'The children asked about you again. You are famous at school.', 'Come home early tonight? I want to read you a story.'],
  };
  D.tomas = {
    intro: 'Welcome, friend. I am Father Tomas. The chapel doors are open to everyone, and so is the bench outside, if you ever need a quiet moment.',
    tiers: [
      ['A quiet heart hears the birds better.', 'I bake bread for the needy on Sundays. Hana helps, bless her.', 'The chapel bell was cast the year this town was founded.'],
      ['I have married many couples in this chapel. Every wedding still makes me cry.', 'Rest is part of work. Even the fields rest in winter.', 'Grandma Pearl sings in the choir. Loudly. Wonderfully.'],
      ['You carry the valley on your shoulders. Remember to set it down sometimes.', 'I pray for good weather for your fields. I cannot promise results.', 'Come sit in the chapel whenever you are tired. It is good for the soul.'],
      ['You have been a blessing to this town.', 'When you find someone to love, I would be honoured to marry you two.', 'Kindness is the best harvest. You have plenty of it.'],
    ],
    rain: 'Rain is the sky watering your fields. A gift.',
    birthday: 'For my birthday? You honour me. Thank you, my friend.',
    gift: gifts('What a wonderful gift. Thank you!', 'Thank you, friend. Truly.', 'Bless you, thank you.', 'Ah. I am sure someone will enjoy this.'),
    spouse: [],
  };
  D.hana = {
    intro: "Hi! I'm Hana, I run the bakery on Market Street. I'm up at four every morning, so if I yawn, it's not you!",
    tiers: [
      ['Fresh bread comes out of the oven at seven. Come early!', 'Your eggs would make wonderful cakes, you know.', 'I tried a pumpkin bread recipe. It was... an experience.'],
      ['Grandma Pearl says my cookies are almost as good as hers. Almost!', 'Flour gets everywhere. I found some in my ear yesterday.', 'Strawberry season is my favourite. Cake, tarts, jam... everything!'],
      ['I saved you the first loaf of the morning. Shh.', 'Do you ever feel like you are exactly where you are meant to be? I do, when I bake.', 'You should taste my new honey bun. You are my official taste tester now.'],
      ['I bake a little better when you are around. Is that strange?', 'I have been working on a cake that tastes like sunshine. It is for you.', 'Would you... walk with me on the beach after closing?'],
    ],
    rain: 'Rain means everyone wants warm bread. Busy day!',
    birthday: 'For my birthday? Oh, you sweetheart! Thank you!',
    gift: gifts('I love this! I can bake something amazing with it!', 'Oh, thank you!', 'Thanks!', "Hmm, I can't bake with that... but thanks."),
    propose: { yes: 'A Blue Feather! Yes! A thousand times yes! I am going to bake our wedding cake myself!', no: 'Oh! You are wonderful, but I am not ready. Not yet.' },
    spouse: ['Morning, love! Fresh bread on the table, still warm.', "I'll be at the bakery till three. Don't forget to eat!", 'I tried a new recipe. You are the first to taste it, as always.'],
  };
  D.marco = {
    intro: "Marco, at your service! My wagon carries treasures from every corner of the kingdom. Furniture from the capital, the finest goods. Have a look!",
    tiers: [
      ['A merchant must always smile. Even in the rain. Especially in the rain.', 'I have sold carpets in seven cities. This town is my favourite.', 'Today\'s deals change every day. Come see what is new!'],
      ['Rosa gives me the room above the stairs. It squeaks, but it is home.', 'Gems! Truffles! Gold! The finer things in life.', 'In the capital, a carabao milk cheese sells for a fortune.'],
      ['Between you and me, the best deals are the ones made between friends.', 'I have travelled far, but I keep coming back here. Maybe now I know why.', 'You have the eye of a merchant. Want to go into business together?'],
      ['For you, no haggling. Ever.', 'I used to think home was a wagon. Now I think it might be a person.', 'I would trade every treasure on my wagon for one more day with you.'],
    ],
    rain: 'Rain! The wagon stays dry, but my hair does not.',
    birthday: 'A birthday gift, for me? Now this is a deal I cannot refuse!',
    gift: gifts('Magnificent! A treasure! Thank you!', 'Ah, a fine gift. Thank you.', 'Thank you, my friend.', 'Hmm. I cannot sell that... but thank you.'),
    propose: { yes: 'A Blue Feather...! My friend, my love, the greatest deal of my life! Yes!', no: 'Ah, my heart says yes, but my head says wait. A little longer.' },
    spouse: ['Good morning, my treasure! The wagon can wait. You cannot.', 'I found something special in the capital for you. Shh, it is a surprise.', 'Business is good, and home is better.'],
  };
  D.sora = {
    intro: "Oh, hello. I'm Sora. I paint. Landscapes, mostly. The light in this valley... it's like nowhere else. May I paint your farm sometime?",
    tiers: [
      ['The pond reflects the sky so perfectly in the morning.', 'I paint in the park most days. People stare, but I do not mind.', 'Colours change with the seasons. Fall is the most generous.'],
      ['I tried to paint the sunset yesterday. The sunset won.', 'Jules and I share a studio. She plays, I paint. It is a noisy kind of quiet.', 'Your fields look like a patchwork quilt from the hill.'],
      ['I started a painting of you working in the field. Do you mind?', 'Art is about noticing things. I notice a lot about you.', 'When I paint, I forget the time. When I talk to you, too.'],
      ['Every painting I make lately has you in it somewhere. Even the bowl of fruit.', 'You are my favourite colour. I do not know which one yet.', 'Stay still for a moment. I want to remember this.'],
    ],
    rain: 'Rain turns the world into a watercolour.',
    birthday: 'A gift? For my birthday? I... thank you. I will paint it.',
    gift: gifts('This is beautiful. Inspiring. Thank you!', 'Oh, thank you. I like it.', 'Thank you.', 'Hmm. Not really my palette.'),
    propose: { yes: 'A Blue Feather... I have painted this moment so many times, and I never got it right. Yes. A thousand brushstrokes of yes.', no: 'I care for you. But I need to see the whole picture first.' },
    spouse: ['Morning. The light on the farm is perfect today. I am going to paint it.', 'Come see the painting when you get home. It is finished. It is you.', 'You look tired. Sit. I will make tea.'],
  };
  D.hale = {
    intro: "I'm Dr. Hale. I run the clinic with Ivy and Nina. Ivy brews, Nina nurses, and I worry. If you feel unwell, come see us. Better yet, don't overwork yourself.",
    tiers: [
      ['Sleep before midnight. Doctor\'s orders.', 'Eat your vegetables. Yes, I know you grow them. Eat them too.', 'Ivy\'s tonics are better than half the medicine in the city.'],
      ['I have seen farmers work themselves to collapse. Do not be one of them.', 'Nina is the best nurse I have ever worked with. Do not tell her I said so.', 'A walk by the pond each evening keeps the doctor away. Mostly.'],
      ['You are looking healthier these days. Good.', 'I came here to retire, and then everyone got sick at once. Never left.', 'Friendship is good medicine. I prescribe more of it.'],
      ['You remind me why I became a doctor.', 'If you ever need anything, day or night, you knock on my door.', 'This town is healthier and happier with you in it.'],
    ],
    rain: 'Rain brings colds. Dress warmly, and drink something hot.',
    birthday: 'You remembered my birthday? How unexpectedly kind. Thank you.',
    gift: gifts('Now this is good for body and soul. Thank you!', 'Very nice. Thank you.', 'Thank you.', 'I would not recommend this. Medically.'),
    spouse: [],
  };
  D.nina = {
    intro: "Hi there! I'm Nina, the nurse at the clinic. Scraped knee? Sore back? Broken heart? I've got bandages for two of those.",
    tiers: [
      ['Remember to drink water when you work in the sun!', 'Dr. Hale is strict, but she has a heart of gold.', 'Pip came in with a frog bite today. The frog was fine.'],
      ['I love my job, but my feet do not.', 'After work I like to walk the market street and look at everything I cannot afford.', 'Ivy taught me which herbs help with sleep. I need all of them.'],
      ['You always ask how I am. Most people forget nurses have days too.', 'I make hot milk with honey when I cannot sleep. Want some?', 'Clara and I share a house. She is tidy. I am... learning.'],
      ['When you walk into the clinic, my whole day gets better.', 'I would bandage every scrape you ever get. Is that weird? That is weird.', 'Can I tell you something? I really, really like you.'],
    ],
    rain: 'Rainy days fill the clinic with sniffles. Stay dry!',
    birthday: 'For my birthday? You are the sweetest! Thank you!',
    gift: gifts('I love it! You made my whole week!', 'Aw, thank you!', 'Thanks, that is nice.', 'Um... thank you. I think.'),
    propose: { yes: 'A Blue Feather?! Yes! Oh, my heart is racing. Is this what a good kind of emergency feels like?', no: 'You are so sweet. But my heart needs a little more time to heal.' },
    spouse: ['Morning! I checked: you slept eight hours. Good job.', "Drink water today. I'll know if you didn't.", 'Come home safe. That is all I ask.'],
  };
  D.owen = {
    intro: "Hey there! Owen, the town vet. Cows, chickens, pigs, cats, the odd grumpy goat. If they've got fur or feathers, I've got treats.",
    tiers: [
      ['Brush your cows every day. They notice, believe me.', 'An animal treat now and then works wonders.', 'I walk by the pond every morning. The ducks expect me.'],
      ['I grew up on a ranch over the hills. Animals are family to me.', 'Happy animals give the best milk and eggs. Science!', 'Your animals look well cared for. That says a lot about you.'],
      ['I have a soft spot for carabaos. Big, gentle, stubborn. Like me.', 'Come by the clinic sometime. I will show you how to check a cow\'s health.', 'My dog back home used to sleep on my feet. I miss that.'],
      ['When I see you with your animals, I see someone I want to know better.', 'You and me, a farm full of animals... sounds like a dream.', 'I think about you more than I think about cows. And I think about cows a lot.'],
    ],
    rain: 'Rain makes the animals restless. Keep them warm and fed.',
    birthday: 'For my birthday? Wow. Thanks, friend!',
    gift: gifts('This is great! You are the best!', 'Thanks a lot!', 'Thanks!', 'Hmm. Not my thing, but thanks.'),
    propose: { yes: 'A Blue Feather? Me? YES! Our animals are going to be so happy. I mean, I am so happy!', no: 'You mean a lot to me. Give me a little more time, okay?' },
    spouse: ['Morning! I already checked on the animals. Everyone is happy.', "I'll be at the clinic. Call me if the cows need anything.", 'You and the farm. Best life I could ask for.'],
  };
  D.poppy = {
    intro: "Welcome! I'm Poppy, from the flower shop. Every flower means something. This one means 'nice to meet you'!",
    tiers: [
      ['A bouquet says what words cannot. Ask me for one anytime!', 'Daisy helps me after school. She has a gift for it.', 'Sunflowers follow the sun. I follow the coffee.'],
      ['I grow my flowers in the garden behind the lane houses.', 'Roses for love, lilies for peace, tulips for... I forget. Tulips are just nice.', 'Your farm could use a flower bed or two!'],
      ['I made a bouquet for you. It means friendship. Mostly.', 'When I was little, I wanted to be a bee. I still kind of do.', 'You always smell like fresh earth. It is a good smell.'],
      ['I have been pressing a flower from the day we met. Is that silly?', 'Every bouquet I make lately has a little piece of you in it.', 'Would you watch the sunset with me in the gazebo?'],
    ],
    rain: 'Rain! My flowers are dancing.',
    birthday: 'A birthday gift! You made me bloom. Thank you!',
    gift: gifts('Oh, I adore this! Thank you!', 'How sweet, thank you!', 'Thank you!', 'Oh no... I do not like that one.'),
    propose: { yes: 'A Blue Feather...! In the language of flowers, this means forever. Yes! Yes, yes!', no: 'You are lovely. But my heart is still a bud. Give it time to bloom.' },
    spouse: ['Morning, sunshine! I put fresh flowers by the bed.', "I'll be at the shop. Daisy is helping today.", 'Our home smells like flowers and you. Perfect.'],
  };
  D.finn = {
    intro: "Mail's here! Well, I'm here. I'm Finn, I run the post office and carry the letters. If your mailbox has something in it, I put it there!",
    tiers: [
      ['I walk every street in town twice a day. My shoes do not love me.', 'Want to send a gift? I can deliver it. For a small fee!', 'The mayor gets the most letters. Mostly complaints about the fountain.'],
      ['I know everyone\'s address. And everyone\'s dog\'s name.', 'Rain or shine, the mail goes out. Rain makes it soggy, though.', 'I race the stray cat to the plaza every morning. I usually lose.'],
      ['I like delivering your letters. You always smile.', 'Someday I want to deliver mail across the whole kingdom.', 'Got a minute? Walk with me on my route.'],
      ['I wrote you a letter. Then I got shy and kept it. It is in my bag.', 'You are my favourite stop on the route.', 'I think I would walk to the end of the world for you. With mail.'],
    ],
    rain: 'Soggy letters day. Sorry in advance!',
    birthday: 'For me? On my birthday? Special delivery! Thank you!',
    gift: gifts('Whoa, this is amazing! Thank you!', 'Nice, thanks!', 'Thanks!', 'Hm, I will pass this one along. Kidding. Thanks.'),
    propose: { yes: 'A Blue Feather? For me?! Yes! Signed, sealed, delivered: yes!', no: 'Oh wow. I like you a lot, but... can we wait a little?' },
    spouse: ['Morning! Your mail is on the table. And a kiss. The kiss is not in an envelope.', 'Route takes till two today. See you after!', "I'll race you home. I'll let you win."],
  };
  D.elliot = {
    intro: "Ah, hello. I'm Elliot, the librarian. If you need a book, I'll find it. If you need quiet, the library has plenty. Please return everything on time.",
    tiers: [
      ['The library has a book about every crop in the valley.', 'I read in the gazebo in the evenings. The light is nice.', 'Shh. Oh, sorry. Habit.'],
      ['I catalogued every book twice. Then I found more books.', 'Clara brings her class on Fridays. Pip always picks the book about pirates.', 'Mushroom soup and a good novel. That is my idea of a perfect evening.'],
      ['You are the first person in a while who asked what I am reading.', 'I am writing a book, actually. About the valley. You are in chapter three.', 'Would you like me to recommend something? I have a list. A long list.'],
      ['In every story I read, I picture you as the hero.', 'I have been trying to find the right words to tell you something. Me. Lost for words.', 'You make the quiet feel less lonely.'],
    ],
    rain: 'Rain is the best sound to read by.',
    birthday: 'For my birthday? I... do not know what to say. Thank you.',
    gift: gifts('This is perfect. Thank you, truly.', 'Thank you. That is thoughtful.', 'Thank you.', 'Oh. I see. Well. Thank you.'),
    propose: { yes: 'A Blue Feather. I have read a thousand love stories, and none of them felt like this. Yes. Yes, of course.', no: 'I am honoured. But I think our story needs a few more chapters first.' },
    spouse: ['Good morning. I left a book on your pillow. Chapter one is about us.', 'I will be at the library till six. Come visit?', 'Home is wherever you are reading next to me.'],
  };
  D.jules = {
    intro: "Hey! I'm Jules. I play guitar, fiddle, and anything that holds still long enough. You'll hear me in the gazebo and at the inn most nights.",
    tiers: [
      ['Every town needs a song. I am writing Willowbrook\'s.', 'Rosa lets me play at the inn for supper. Best deal ever.', 'Want to hear a song? It is about a cow. It is mostly mooing.'],
      ['I share a studio with Sora. He paints, I play, we both forget to eat.', 'Music sounds better near water. That is why I play at the beach.', 'I wrote a song about your farm. It has a lot of verses about turnips.'],
      ['You are a good listener. That is rare. And important, for a musician.', 'Do you sing? Everyone sings. Come on, just a little.', 'When I play at festivals, I look for you in the crowd.'],
      ['I wrote a love song. It is about you. Do not laugh!', 'You are the melody I could not find for years.', 'Will you dance with me? There is no music. I will hum.'],
    ],
    rain: 'The rain keeps the beat. I just play along.',
    birthday: 'A birthday gift? This deserves a song! Thank you!',
    gift: gifts('This rocks! I love it!', 'Hey, thanks!', 'Thanks!', 'Hmm, that is a sour note. Thanks anyway.'),
    propose: { yes: 'A Blue Feather? Oh, this is the best song I never wrote. Yes! Yes, encore!', no: 'You are sweet, but I need a few more verses before the chorus.' },
    spouse: ['Morning! I wrote you a song while you slept. It is very quiet.', "Gig at the inn tonight. You'll come, right?", 'Our home sounds like music now.'],
  };

  // ---------- their letters (at 3 hearts) ----------
  Object.assign(C.LETTERS, {
    h_pearl: { from: 'pearl', text: "Dear, I baked too many pies again. Here is one for you. Do share it with someone nice. - Grandma Pearl", gift: ['pumpkin_pie', 1] },
    h_ewan: { from: 'ewan', text: 'Caught a big one this morning. Grilled it the old way. Eat it while you think of the river. - Ewan', gift: ['grilled_fish', 1] },
    h_pip: { from: 'pip', text: 'DEAR FARMER. I made this for you. It is a cookie. I only ate a little bit. FROM PIP', gift: ['cookie', 2] },
    h_daisy: { from: 'daisy', text: 'Dear farmer, here are some berries I picked by the lane. You are my friend. Love, Daisy', gift: ['berry', 3] },
    h_clara: { from: 'clara', text: "The children asked me to send you this, with their thanks for being so kind. I am grateful too. - Clara", gift: ['jam', 1] },
    h_tomas: { from: 'tomas', text: 'A loaf from the chapel ovens, baked with Hana. May your table always be full. - Father Tomas', gift: ['bread', 2] },
    h_hana: { from: 'hana', text: "I made you a little cake! Fresh this morning. Let me know what you think! - Hana", gift: ['cake', 1] },
    h_marco: { from: 'marco', text: 'A small gem from my travels. For a friend who appreciates fine things. - Marco', gift: ['gem', 1] },
    h_sora: { from: 'sora', text: 'I found this lovely mushroom while painting in the forest. It reminded me of you. Is that odd? - Sora', gift: ['mushroom', 2] },
    h_hale: { from: 'hale', text: 'A tonic, on the house. Do try to rest more. - Dr. Hale', gift: ['tonic', 2] },
    h_nina: { from: 'nina', text: "Hot milk for long nights! Doctor's orders. Well, nurse's orders. - Nina", gift: ['hot_milk', 2] },
    h_owen: { from: 'owen', text: 'Some treats for your animals. They deserve it. So do you! - Owen', gift: ['treat', 3] },
    h_poppy: { from: 'poppy', text: "A bouquet, just because. It means 'I'm glad we met.' - Poppy", gift: ['bouquet', 1] },
    h_finn: { from: 'finn', text: 'Special delivery! A sandwich for the hardest-working farmer on my route. - Finn', gift: ['sandwich', 1] },
    h_elliot: { from: 'elliot', text: 'I found an old book of farming notes in the library basement. Inside was this. I think it was your grandfather\'s. - Elliot', gift: ['gold', 400] },
    h_jules: { from: 'jules', text: 'Wrote you a song. Could not fit it in the envelope, so here is a pie instead. - Jules', gift: ['pumpkin_pie', 1] },
  });

  // ---------- heart events ----------
  var E = C.HEART_EVENTS;
  var ev = function (hearts, who, l1, l2, a1, a2) {
    return { hearts: hearts, lines: [[who, l1], [who, l2]], choice: { q: 'What do you say?', a: [a1, a2] } };
  };
  E.pearl = [ev(3, 'pearl', 'Ewan proposed to me on the pier, fifty years ago. He dropped the ring in the lake.', 'He dove in after it, in November! Came up blue as a fish, ring in hand. Silly old man.',
    ['That is so romantic!', 8, 'It was, dear. It still is.'], ['Did he catch a cold?', 4, 'For a week! He still says it was worth it.'])];
  E.ewan = [ev(3, 'ewan', 'See that boat out there? I built her with my own hands. Named her after Pearl.', 'Haven\'t sailed her in years. My hands shake too much now.',
    ['I could sail her with you.', 8, 'Would you? ...Ha. I would like that, friend.'], ['She is a fine boat.', 4, 'The finest. Like her namesake.'])];
  E.pip = [ev(3, 'pip', 'Psst! I found a secret! There is a cave behind the waterfall in the forest!', 'Grandpa says it is just a hole. But I KNOW there is treasure. Do you believe me?',
    ['Of course I believe you!', 8, 'I knew it! We are treasure partners now!'], ['It is probably just a hole.', -2, 'Aww. You sound like Grandpa.'])];
  E.daisy = [ev(3, 'daisy', 'Look! I grew this flower all by myself. From a seed. It took forever. Like a whole week.', 'I want you to have it. Because you grow things too.',
    ['I will keep it forever.', 8, '(Daisy beams and hugs your leg.)'], ['Thank you, Daisy.', 5, 'You are welcome! Water it every day!'])];
  E.tomas = [ev(3, 'tomas', 'I was not always a priest, you know. I was a sailor, once. A rough one.', 'One stormy night I promised God that if I lived, I would serve. Here I am.',
    ['You kept your promise.', 8, 'I did. And I have never regretted it.'], ['Do you miss the sea?', 5, 'Every day. But the valley has its own tides.'])];
  E.hale = [ev(3, 'hale', 'I lost a patient once, in the city. Too young. I could not save her.', 'That is why I came here. Small town, fewer sorrows. But I care too much to ever really retire.',
    ['You help everyone here.', 8, '...Thank you. I needed that today.'], ['That must have been hard.', 5, 'It was. It still is, some days.'])];

  E.clara = [
    ev(2, 'clara', 'Pip wrote an essay called "My Hero". It was about you.', 'He spelled "farmer" with three Rs, but it was very touching.',
      ['That is so sweet!', 6, 'It is. Children see the best in people.'], ['Only three Rs?', 2, 'Ha! Progress, really.']),
    ev(4, 'clara', 'I wanted to be a writer before I was a teacher. I still have a drawer full of stories.', 'I have never shown them to anyone. ...Would you want to read one?',
      ['I would love to.', 8, 'Really? Then I will pick the best one. Or the least terrible.'], ['Maybe some other time.', 0, 'Of course. No pressure.']),
    ev(6, 'clara', 'I finished a new story last night. It is about a farmer and a teacher.', 'I have not written the ending yet. I was hoping... you might help me decide.',
      ['They live happily ever after.', 10, 'That is the ending I wanted too.'], ['A plot twist!', 3, 'Ha! You would say that.']),
  ];
  E.hana = [
    ev(2, 'hana', 'Taste this! It is a new recipe: strawberry cream bun. Be honest!', '(It is fluffy, sweet and still warm.)',
      ['Perfect! Sell it tomorrow!', 6, 'Yay! It goes on the menu!'], ['A bit too sweet.', 2, 'Hm. Noted. Less sugar, more love.']),
    ev(4, 'hana', 'My mother had a bakery in the city. It closed when she got sick.', 'I opened this one so her recipes would not be lost. Every loaf is a little bit her.',
      ['She would be so proud.', 8, '...I hope so. Thank you.'], ['That is a lot of pressure.', 1, 'It is. But it is a good kind.']),
    ev(6, 'hana', 'I am entering a baking contest in the capital. I need a name for my cake.', 'I want to call it... after someone special. Can I use your name?',
      ['I would be honoured.', 10, 'Then it is decided. It has to win now!'], ['Call it Hana\'s Best.', 3, 'Ha. Maybe. But I like my idea better.']),
  ];
  E.marco = [
    ev(2, 'marco', 'Look at this compass! It points to whatever you want most. Supposedly.', 'Mine has been pointing at Willowbrook for weeks. Strange, no?',
      ['Maybe you belong here.', 6, 'Maybe I do, my friend. Maybe I do.'], ['It is probably broken.', 1, 'Ha! Probably. I paid too much for it.']),
    ev(4, 'marco', 'My father was a merchant. My grandfather too. We never stayed anywhere long.', 'Sometimes I wonder what it feels like to have roots. Like your crops.',
      ['You could plant some here.', 8, 'With you around, I am tempted.'], ['Travel sounds exciting.', 2, 'It is. And lonely.']),
    ev(6, 'marco', 'I was offered a shop in the capital. A real one, with a roof and everything.', 'I said no. I said there is someone here I cannot leave. Do you know who?',
      ['I hope it is me.', 10, 'It is. It always was.'], ['Rosa? The inn?', 3, 'Ha! Close. Very close. Not quite.']),
  ];
  E.sora = [
    ev(2, 'sora', 'I have been trying to paint the pond for a month. It never looks right.', 'Tell me, what do you see when you look at it?',
      ['The whole sky, upside down.', 6, '...Yes. That is it. Thank you.'], ['Water?', 1, 'Ha. Well. Not wrong.']),
    ev(4, 'sora', 'My family wanted me to be an accountant. I ran away to paint.', 'Some days I wonder if I made a mistake. Then I see the light on the hills, and I know.',
      ['You were brave.', 8, 'Was I? You make it sound that way.'], ['Accounting pays better.', 0, 'So my mother keeps telling me.']),
    ev(6, 'sora', 'I finished it. The painting of you in the field. Would you like to see?', '(It is warm and golden, and you are smiling in it.)',
      ['It is beautiful.', 10, 'It is only what I see when I look at you.'], ['Is my nose that big?', 3, 'Ha! It is artistic interpretation.']),
  ];
  E.nina = [
    ev(2, 'nina', 'Ow! I tripped on the clinic steps. Again. Some nurse I am!', 'Can you help me up? And not tell Dr. Hale?',
      ['Your secret is safe.', 6, 'You are a lifesaver! Ha, nurse joke.'], ['Be more careful!', 2, 'I know, I know.']),
    ev(4, 'nina', 'I became a nurse because my little brother was sick when we were kids.', 'He is all better now. A sailor in the south. I still worry about him.',
      ['He is lucky to have you.', 8, '...Thanks. I hope he knows that.'], ['Sailors are tough.', 3, 'He is. Tougher than me.']),
    ev(6, 'nina', 'I took the evening off. Do you want to walk to the beach with me?', 'I have wanted to ask you for ages. My heart was beating so fast.',
      ['I would love to.', 10, 'Then let us go! Before I lose my nerve.'], ['Is your heart okay?', 3, 'Ha! Medically, yes. Otherwise, no.']),
  ];
  E.owen = [
    ev(2, 'owen', 'This little calf was born early. I have been up all night with her.', 'She is going to make it. Want to feed her?',
      ['Yes, please!', 6, 'Here. Gently. ...She likes you!'], ['You should sleep.', 2, 'Later. She comes first.']),
    ev(4, 'owen', 'I almost became a doctor for people. Dr. Hale even offered to teach me.', 'But animals cannot tell you where it hurts. Someone has to listen for them.',
      ['That is a beautiful reason.', 8, 'Ha. You are the first person who did not laugh.'], ['People are easier.', 1, 'People are louder.']),
    ev(6, 'owen', 'I keep imagining a farm. Big barn, lots of animals, a dog on the porch.', 'And you. You are always in the picture.',
      ['It sounds perfect.', 10, 'It does, does it not? Maybe someday.'], ['And a horse?', 4, 'Two horses. One for each of us.']),
  ];
  E.poppy = [
    ev(2, 'poppy', 'Do you know what a blue tulip means? Nobody does. I made it up.', 'I think it should mean "you make ordinary days special."',
      ['I like that meaning.', 6, 'Then it is official!'], ['Tulips are not blue.', 1, 'They are in my shop!']),
    ev(4, 'poppy', 'My grandmother had a garden as big as a field. When she passed, it was sold.', 'Every flower I grow is a little bit of her garden coming back.',
      ['She would love your shop.', 8, 'I hope so. I think she would.'], ['Buy the field back!', 3, 'Ha. Someday, maybe.']),
    ev(6, 'poppy', 'I made a flower crown. Sit still! There.', 'You look like a spring prince. Or princess. Or a spring farmer!',
      ['Make me one for every season.', 10, 'Deal! You will be my favourite model.'], ['I feel silly.', 3, 'You look adorable. Silly and adorable.']),
  ];
  E.finn = [
    ev(2, 'finn', 'Oops! I dropped a whole bag of letters in the fountain!', 'Help me fish them out before the mayor sees?',
      ['On it!', 6, 'You are a hero! A soggy hero!'], ['That is your job.', -2, 'Yeah... I know.']),
    ev(4, 'finn', 'Every letter I deliver is somebody saying "I care about you."', 'Sometimes I wish someone would write one to me.',
      ['I will write you one.', 8, 'Really?! I will keep it forever!'], ['You get bills, right?', 1, 'Ha. Those do not count.']),
    ev(6, 'finn', 'I have one more letter to deliver today. It is... from me. To you.', '(It says: "Will you be the one on my route forever?")',
      ['Yes, Finn.', 10, 'Signed, sealed, delivered. Best day ever!'], ['Your handwriting is messy.', 3, 'It was a nervous letter!']),
  ];
  E.elliot = [
    ev(2, 'elliot', 'Someone returned a book four years late. With a squashed tomato inside.', 'I am not angry. I am... disappointed. Very disappointed.',
      ['That is a crime.', 6, 'Thank you! Finally, someone understands.'], ['At least they returned it.', 2, 'Fine. Fair.']),
    ev(4, 'elliot', 'When I was young, the library was the only place I felt safe.', 'I promised myself I would make one, so others could feel that too.',
      ['You did. It is wonderful.', 8, '...Thank you. That means everything.'], ['Books are nice.', 2, 'They are. Nicer than most people.']),
    ev(6, 'elliot', 'I finished my book about the valley. The last chapter is about you.', 'I could not decide how it ends. Would you... write the ending with me?',
      ['Together.', 10, 'Together. That is the best ending.'], ['Make it a mystery.', 3, 'Ha. You are already a mystery to me.']),
  ];
  E.jules = [
    ev(2, 'jules', 'I broke a string right in the middle of a song at the inn. Everybody laughed.', 'I laughed too. Then I kept going on five strings!',
      ['That is the spirit!', 6, 'Right? The show must go on!'], ['How embarrassing.', 1, 'Thanks. Very comforting.']),
    ev(4, 'jules', 'I used to play in the city, in big halls. I was never happy there.', 'Here, people sing along. That is the music I was missing.',
      ['I will always sing along.', 8, 'Even off-key? Especially off-key.'], ['The city pays better.', 1, 'Money cannot sing.']),
    ev(6, 'jules', 'I wrote a song for you. Just you. No turnips this time.', '(She plays softly. It is the most beautiful thing you have ever heard.)',
      ['Play it again.', 10, 'As many times as you want. Forever, maybe.'], ['Where are the turnips?', 4, 'Ha! In the second verse.']),
  ];
})(window.Farm = window.Farm || {});
