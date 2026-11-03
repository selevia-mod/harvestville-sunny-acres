// Looks: whole-farmer costumes, sold at Tita Luz's Tailor Shop in the park (owner, 2-3 Nov 2026). Each look is a full
// set of the farmer's pictures (walk, tools, bow) for the boy and the girl; one purchase is both. The pictures are too
// big for the page (6 MB in all), so they come from the CDN through the app when worn (19zj-looks.js).
// Prices (owner, 2 Nov): Christmas Elf free for everyone; Straw Farmer, Ranch Hand and Cozy Winter for Gold, bought in
// the game; the others for Coins or Stars, bought through the server (supabase/farm_online_13.sql decides the price).
// Append only: a look's place in this list is its bit in the save.
(function (F) {
  'use strict';
  var C = F.Config;

  C.LOOKS = [
    { key: 'elf', name: 'Christmas Elf', free: true, desc: 'A green elf suit and a pointed hat with a bell.' },
    { key: 'straw', name: 'Straw Farmer', gold: 50000, desc: 'A straw hat, a plaid shirt and sturdy work boots.' },
    { key: 'ranch', name: 'Ranch Hand', gold: 150000, desc: 'A cowboy hat, a red flannel shirt and a leather vest.' },
    { key: 'winter', name: 'Cozy Winter', gold: 300000, desc: 'A knit beanie, a warm sweater and a cream scarf.' },
    { key: 'flower', name: 'Spring Festival', coins: 100, stars: 150, desc: 'A flower crown for the spring fair, with a lei or a sundress.' },
    { key: 'santa', name: 'Santa Claus', coins: 150, desc: 'The red suit with white trim, the hat and the big black boots.' },
    { key: 'fiesta', name: 'Barrio Fiesta', coins: 150, stars: 200, desc: 'A salakot, with a barong for him and a blue Filipiniana for her.' },
    { key: 'bunny', name: 'Bunny Hop', coins: 150, stars: 200, desc: 'A soft pink suit and a hood with bunny ears.' },
  ];
  C.LOOK_INDEX = {};
  C.LOOKS.forEach(function (l, i) { C.LOOK_INDEX[l.key] = i; });

  // Tita Luz the tailor, at her shop's door
  C.TAILOR = {
    name: 'Tita Luz', open: 8 * 60, close: 20 * 60,
    hello: "Magandang araw, iha, iho! I'm Tita Luz. I sew for the whole town. Try on a look, and wear it anywhere you go. Your friends will see it too!",
  };
})(window.Farm = window.Farm || {});
