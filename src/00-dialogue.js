// What the villagers say. Lines are picked by friendship (hearts 0-2, 3-5, 6-8, 9-10) and change from day
// to day. Kept apart from the rules so it is easy to edit.
(function (F) {
  'use strict';

  F.Config.DIALOGUE = {
    lily: {
      intro: "Oh! You're the new farmer at Harvest Ville? I'm Lily. I run the seed stand by your field, so we'll see a lot of each other!",
      tiers: [
        ['Turnips are the easiest crop to start with: ready in 15 minutes. Water them and they grow even faster!', 'I open my stand at six in the morning. Come by for seeds anytime.', 'Grandpa used to farm your land. He would be happy to see it green again.'],
        ['Your field is looking better every day. I peek at it on my way to the stand!', 'I love the smell of the soil after it rains.', 'Have you tried strawberries? They keep giving after the first harvest.'],
        ['I saved you the best seeds this morning. Just kidding... or am I?', 'Walking home past your farm is the best part of my day.', 'You work so hard. Promise you will rest sometimes?'],
        ['I feel like I can tell you anything.', 'When I see your lights on at night, I feel safe somehow.', 'Hey... I really like spending time with you.'],
      ],
      rain: "Rainy days mean free watering for your crops. Nature's gift!",
      birthday: "You remembered my birthday? That makes me so happy!",
      gift: { love: 'For me? I love this! Thank you so much!', like: 'Oh, how nice! Thank you.', neutral: 'Thanks, that is kind of you.', dislike: "Oh... um, I'm not really into this. Thanks anyway." },
      propose: { yes: 'A blue feather...? Yes! Of course, yes! I have been hoping you would ask.', no: "That's... really sweet. But I don't think I'm ready for that yet." },
      spouse: ['Good morning, love! I watered the flowers by the door.', "Don't overwork yourself today, okay?", "I'll open the stand, you tend the farm. We make a great team!"],
    },
    hollis: {
      intro: "Welcome, welcome! I'm Mayor Hollis. Our little town is glad to have a farmer again. Do come to our festivals!",
      tiers: [
        ['The town plaza is where we hold all our festivals. Check the calendar!', 'In my day, the farm produced the finest pumpkins in the valley.', 'If you need lumber, Mira at the woodshop can help.'],
        ['You are becoming quite the farmer! People in town are talking.', 'The Harvest Festival is my favourite. Bring your best crop!', 'A good farmer talks to the townsfolk. Friendships matter here.'],
        ['You remind me of your grandfather. Stubborn, hard-working, kind.', 'Our town feels livelier since you arrived.', 'Have you been to the mine? Bram says there is gold deep down.'],
        ['I am proud to call you a friend of this town.', 'If you ever need anything, my door is always open.', 'This valley is lucky to have you.'],
      ],
      rain: 'Rain again! Good for the fields, hard on my knees.',
      birthday: 'A gift for an old man on his birthday? You are too kind.',
      gift: { love: 'Oh my! This is splendid! Thank you!', like: 'How thoughtful. Thank you.', neutral: 'Thank you, young farmer.', dislike: "Hm. Well. It's the thought that counts." },
      spouse: [],
    },
    bram: {
      intro: "Name's Bram. I run the forge. Bring me ore and gold, and I'll make your tools sing.",
      tiers: [
        ['Copper ore is easy to find in the upper floors of the mine.', 'A good tool saves your back. Upgrade early.', 'Hmph. Hot today. Or is that the furnace?'],
        ["You've got strong arms for a farmer. Ever think of smithing?", 'Charge a tool by holding it. A gold hoe tills a whole patch!', 'The deeper you dig, the better the ore. Watch your energy.'],
        ['Not many folks stop to chat with me. Thanks for that.', 'Your tools are well kept. I respect that.', "I'd go mining with you anytime." ],
        ['You are a true friend. Rare thing, these days.', 'If you ever need a hand, just say the word.', 'Ha! You again. Best part of my day, honestly.'],
      ],
      rain: "Rain cools the forge. Can't complain.",
      birthday: "Didn't think anyone knew my birthday. ...Thanks.",
      gift: { love: 'Now THAT is a fine gift. Much obliged!', like: 'Good stuff. Thanks.', neutral: 'Huh. Thanks.', dislike: "Too sweet for me. Keep it." },
      spouse: [],
    },
    mira: {
      intro: "Hi! I'm Mira, the carpenter. Need a kitchen? A bigger barn? I build it all. Bring lumber!",
      tiers: [
        ['Chop branches and stumps with your axe for lumber.', 'A kitchen lets you cook. Food gives you way more energy!', 'I like the smell of fresh-cut pine.'],
        ['Your farm has good bones. With some work it could be amazing.', 'I drew a few ideas for your barn. Want to see them sometime?', 'Sawdust in my hair again... does it show?'],
        ["Honestly, you're my favourite customer.", 'I love watching the sunset from the dock after work.', 'Building things with you around feels different. In a good way.'],
        ["I'd build you anything you asked for. You know that, right?", "When I'm with you, time flies.", 'Want to watch the sunset together sometime?'],
      ],
      rain: "Rain means indoor projects. I'm carving a little wooden chicken!",
      birthday: 'A birthday gift? You really pay attention, huh. Thank you!',
      gift: { love: 'No way! I love it! You get me.', like: 'Ooh, nice! Thanks!', neutral: 'Thanks, I appreciate it.', dislike: 'Eh... not really my thing.' },
      propose: { yes: "You... want to marry me? Yes! Let's build a life together!", no: "I really like you, but... let's get to know each other better first." },
      spouse: ['Morning! I fixed the squeaky door while you slept.', 'I packed some tools in case you need help today.', 'Our home is the best thing I ever built. With you.'],
    },
    rosa: {
      intro: "Welcome to the Sunny Inn! I'm Rosa. Hungry? My kitchen is always open for a hardworking farmer.",
      tiers: [
        ['Try my sandwich. It will keep you going all morning!', 'The inn is the heart of town in the evenings.', 'Fresh milk makes the best soup, you know.'],
        ['Your eggs are lovely. I might buy them for the inn!', 'Bram eats here every single night. Same table, same soup.', 'Cooking is just love you can taste.'],
        ['You are always welcome at my table.', 'I made extra stew today, thinking you might drop by.', 'You have brightened this whole town, dear.'],
        ["You're like family to me now.", "Don't ever skip meals, promise me.", 'Seeing you here makes an old cook very happy.'],
      ],
      rain: 'Nothing like soup on a rainy day!',
      birthday: 'For my birthday? Oh, you sweetheart!',
      gift: { love: "Oh! I'll cook something wonderful with this. Thank you!", like: 'How lovely, thank you dear.', neutral: 'Thank you, dear.', dislike: "Oh, I can't cook with this. But thank you." },
      spouse: [],
    },
    leo: {
      intro: "Hey there. I'm Leo. I fish the river most days. Here, take this old rod. The fish are biting!",
      tiers: [
        ['Cast your line and wait. Tap the moment it bites!', 'The river has bigger fish than your pond.', "They say a King Trout lives in this river. I've never caught one."],
        ['Early mornings are the best time to fish. So quiet.', 'You have a natural patience. Good for fishing.', 'Grilled fish with a little salt. Perfect.'],
        ['I usually fish alone. It is nice having company.', 'I saw you at the pond the other day. Nice cast!', 'The river sounds different when you are around. Calmer.'],
        ['You are the best catch in this valley. ...Did I really just say that?', "I'd share my secret fishing spot with you. Only you.", 'Want to watch the river with me for a while?'],
      ],
      rain: "Fish love the rain. So do I.",
      birthday: 'You remembered my birthday? ...Wow. Thanks.',
      gift: { love: "Seriously? This is awesome. Thank you!", like: 'Nice. Thanks a lot.', neutral: 'Oh, thanks.', dislike: 'Ugh, not a fan. Sorry.' },
      propose: { yes: 'You... want to marry me? Yes. A thousand times yes.', no: "I like you a lot. But I need a little more time." },
      spouse: ['Morning. I caught breakfast already.', 'The river was calm today. Like me, with you.', "Need anything today? I'm here."],
    },
    ivy: {
      intro: "Hello, I'm Ivy. I run the little clinic and gather herbs in the forest. My tonics will perk you right up.",
      tiers: [
        ['Wild herbs grow at the forest edge in spring.', 'An energy tonic helps when you are worn out.', 'Remember to eat properly. Your body is your best tool.'],
        ['Mushrooms pop up in the fall after rain. Some are delicious!', 'You look healthier than when you first arrived.', 'I am drying lavender today. Smells lovely, right?'],
        ['I always look forward to your visits.', 'I made a tonic just for you. Kidding! ...Mostly.', 'The forest feels brighter when we walk it together.'],
        ['You make my heart race. Medically speaking, that is a good sign.', "I'd wander every forest with you.", 'Stay a little longer today?'],
      ],
      rain: 'Rain wakes up the whole forest. Can you smell it?',
      birthday: 'A birthday present? You are so thoughtful!',
      gift: { love: 'Oh! This is perfect. Thank you!', like: 'How nice, thank you!', neutral: 'Thank you.', dislike: "Hmm, I'll pass on this one." },
      propose: { yes: 'A blue feather... Yes! I would love to marry you!', no: "You mean a lot to me. But not yet... okay?" },
      spouse: ['Good morning! I brewed you some herbal tea.', 'Take care of yourself today, my love.', 'I picked herbs for our garden. Look!'],
    },
  };

  // The TV in the farmhouse: tomorrow's forecast plus a rotating extra.
  F.Config.TV = [
    'COOKING CORNER: Eggs and milk make a quick meal. A kitchen lets you cook bigger dishes!',
    'FARM TIP: Hold the action button to charge an upgraded tool and work a whole patch at once.',
    'NEWS: The mine below town is said to have gold on its deeper floors.',
    'FARM TIP: Happy animals give large eggs and milk. Pet and brush them every day!',
    'TOWN TALK: Festivals are held in the plaza. Check your calendar so you never miss one.',
    'FARM TIP: Pick your crops when they are ripe. A crop left as long again withers!',
    'FISHING REPORT: The river holds bigger fish than the farm pond.',
  ];
})(window.Farm = window.Farm || {});
