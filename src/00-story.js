// Letters for the mailbox and the villagers' heart events (little story scenes at friendship milestones).
(function (F) {
  'use strict';
  var C = F.Config;

  // ---------- letters ----------
  // gift: [item id | 'gold' | 'lumber' | 'stone', amount]
  C.LETTERS = {
    welcome: { from: 'hollis', text: "Welcome to Sunny Acres! The whole town is glad you've come. Here's lunch from Rosa's inn, to keep your strength up. Do visit us in Willowbrook, just down the road south. - Mayor Hollis", gift: ['sandwich', 1] },
    fest: { from: 'hollis', text: 'Tomorrow is the {fest}! {desc} Everyone gathers in the town plaza. Shops will be closed for the day. - Mayor Hollis' },
    bday: { from: 'hollis', text: "Psst! Tomorrow is {who}'s birthday. A gift on the day counts double! - Mayor Hollis" },
    ship1: { from: 'lily', text: "Word is your crops are selling well! Here are some strawberry seeds. They keep giving after the first harvest. - Lily", gift: ['seed_strawberry', 1] },
    ship2: { from: 'lily', text: "5,000G earned! You're the talk of the valley. A little thank-you from my stand. - Lily", gift: ['gold', 500] },
    ship3: { from: 'hollis', text: '20,000G! Sunny Acres is the finest farm in the valley again. The town is proud of you. - Mayor Hollis', gift: ['gold', 2000] },
    mine10: { from: 'bram', text: "Heard you made it to floor 10 of the mine. Not bad! Take this silver, and keep digging. - Bram", gift: ['ore_silver', 2] },
    // a letter from each villager when you reach 3 hearts with them
    h_lily: { from: 'lily', text: "I just wanted to say... I'm really glad you moved here. Here's a bag of my best seeds! - Lily", gift: ['seed_potato', 1] },
    h_hollis: { from: 'hollis', text: 'You have made fine friends in town. Here is a little something from the town fund. - Mayor Hollis', gift: ['gold', 300] },
    h_bram: { from: 'bram', text: 'Found some copper while cleaning the forge. Figured you could use it. - Bram', gift: ['ore_copper', 3] },
    h_mira: { from: 'mira', text: 'Had leftover planks from a job. They are yours! Build something nice. - Mira', gift: ['lumber', 15] },
    h_rosa: { from: 'rosa', text: "You work too hard, dear. Here's a bowl of my soup. Eat it while it's hot! - Rosa", gift: ['hot_soup', 1] },
    h_leo: { from: 'leo', text: 'Caught too many today. Grilled one for you. Tastes like the river. - Leo', gift: ['grilled_fish', 1] },
    h_ivy: { from: 'ivy', text: 'I made extra tonic. Herbs from the forest, brewed with care. Stay healthy! - Ivy', gift: ['tonic', 2] },
  };

  // ---------- heart events ----------
  // Triggered when you talk to a villager who has reached the hearts. Lines: [speaker, text] ('me' = you).
  // choice: [label, friendship points, their reply]
  var E = C.HEART_EVENTS = {};
  E.lily = [
    { hearts: 2, lines: [['lily', 'Oh! You caught me daydreaming. I was thinking about my grandma\'s garden.'], ['lily', 'She grew the biggest strawberries in the valley. I want my stand to be like her garden someday.']],
      choice: { q: 'What do you say?', a: [['It will be. I can tell.', 6, 'You think so? ...Thank you. That means a lot.'], ['Strawberries are overrated.', -4, 'Oh. Well. I like them.']] } },
    { hearts: 4, lines: [['lily', "Can I tell you a secret? I'm scared of thunderstorms."], ['lily', 'When the thunder rolls I hide under my blanket with a cup of hot milk. Silly, right?']],
      choice: { q: 'What do you say?', a: [["Not silly. I'll check on you next storm.", 8, "You'd do that? You're really sweet."], ['Thunder is just noise.', -3, "Easy for you to say..."]] } },
    { hearts: 6, lines: [['lily', 'I watch the sunset from the hill behind my cottage sometimes.'], ['lily', "It's the prettiest when someone is there to share it with. Would you... come with me sometime?"]],
      choice: { q: 'What do you say?', a: [["I'd love to.", 10, 'Really? Then it is a date! ...I mean, a sunset. A sunset date.'], ['Maybe some other time.', 0, "Oh, okay. I'll save you a spot."]] } },
  ];
  E.mira = [
    { hearts: 2, lines: [['mira', "Look at this! I carved a little wooden chicken. It's for the town fair."], ['mira', 'Be honest. Does it look like a chicken, or a potato with legs?']],
      choice: { q: 'What do you say?', a: [['A very handsome chicken.', 6, 'Ha! I knew it. You have a good eye.'], ['...A potato with legs.', 2, 'Honest! Ugh. Back to the workbench.']] } },
    { hearts: 4, lines: [['mira', "My dad built half the houses in this town. Everyone says I'm just like him."], ['mira', "Sometimes I wonder if I'll ever build something that's mine, not his."]],
      choice: { q: 'What do you say?', a: [['Your work is your own, Mira.', 8, "...Thanks. I needed to hear that."], ['Your dad sounds great.', 1, 'He was. Yeah.']] } },
    { hearts: 6, lines: [['mira', "I've been drawing plans for my dream house. There's a big porch, a workshop, and a room full of windows."], ['mira', '...There might be room for two in it. Just saying.']],
      choice: { q: 'What do you say?', a: [['Two sounds perfect.', 10, "D-did I say that out loud? ...Good."], ['You need more windows.', 2, 'Everyone is a critic!']] } },
  ];
  E.leo = [
    { hearts: 2, lines: [['leo', "Shh. See that ripple by the reeds? That's the King Trout. I've been after him for years."], ['leo', "Some say he can't be caught. I say he just hasn't met me yet."]],
      choice: { q: 'What do you say?', a: [["Let's catch him together.", 6, 'Together? Ha! Deal, partner.'], ['Sounds like a waste of time.', -4, "...Fishing is never a waste of time."]] } },
    { hearts: 4, lines: [['leo', 'I almost left Willowbrook once. Had a boat ticket to the city and everything.'], ['leo', "Stood at the dock all night. Couldn't do it. The river's in my blood."]],
      choice: { q: 'What do you say?', a: [["I'm glad you stayed.", 8, 'Yeah. Me too. More now than ever.'], ['The city has better food.', 0, "Rosa would fight you for saying that."]] } },
    { hearts: 6, lines: [['leo', "I made you something. It's a lucky lure, carved from driftwood."], ['leo', 'My grandpa made one for my grandma, back in the day. Just... thought you should have it.']],
      choice: { q: 'What do you say?', a: [["I'll treasure it.", 10, "Good. ...Good. Now don't lose it in the river!"], ['Is it for fishing?', 3, 'Ha. Sort of. Mostly for you.']] } },
  ];
  E.ivy = [
    { hearts: 2, lines: [['ivy', 'Do you know which mushrooms are safe to eat? Most people don\'t.'], ['ivy', 'The red ones with white dots look pretty, but they are trouble. Remember that!']],
      choice: { q: 'What do you say?', a: [["Thanks, I'll remember.", 6, 'Good. I would hate for you to end up in my clinic.'], ['I eat whatever I find.', -4, 'Please do not do that.']] } },
    { hearts: 4, lines: [['ivy', "I came to Willowbrook to study the herbs in the forest. I was only going to stay a season."], ['ivy', 'That was three years ago. The people here grew on me. Like moss.']],
      choice: { q: 'What do you say?', a: [['Moss is cute.', 8, '...You are strange. I like it.'], ['Will you leave someday?', 2, 'Not anytime soon. Not now.']] } },
    { hearts: 6, lines: [['ivy', 'I wrote down every plant in the valley in this notebook. Look, I added a page about your farm.'], ['ivy', "\"Sunny Acres: home of the most stubborn farmer I know.\" ...And the kindest."]],
      choice: { q: 'What do you say?', a: [['Can I read the rest?', 10, 'Maybe... someday. When you are family.'], ['Stubborn?!', 4, 'See? Stubborn.']] } },
  ];
  E.hollis = [
    { hearts: 3, lines: [['hollis', 'Your grandfather and I started the Harvest Festival together, you know. Forty years ago!'], ['hollis', 'He brought a pumpkin so big we needed a wheelbarrow to carry it. Ha!']],
      choice: { q: 'What do you say?', a: [["I'll grow one even bigger.", 6, "That's the spirit! He would be proud."], ['Tell me more about him.', 8, 'He was a good man. Kind, like you. Come by anytime and I will tell you more.']] } },
  ];
  E.bram = [
    { hearts: 3, lines: [['bram', "This hammer was my mother's. She was the smith before me."], ['bram', 'Folks said a woman couldn\'t run a forge. She ran it for thirty years.']],
      choice: { q: 'What do you say?', a: [['She sounds amazing.', 8, 'She was. Hmph. Dust in my eye.'], ['Nice hammer.', 3, "...It is a nice hammer."]] } },
  ];
  E.rosa = [
    { hearts: 3, lines: [['rosa', 'Sit, sit! I am trying a new recipe. Tell me what you think.'], ['me', '(It is a warm soup with herbs and potatoes. It is delicious.)']],
      choice: { q: 'What do you say?', a: [['Best soup I ever had!', 8, 'Oh, you flatterer! It goes on the menu, then.'], ['Needs more salt.', 4, 'Hm! A critic. I like a critic.']] } },
  ];
})(window.Farm = window.Farm || {});
