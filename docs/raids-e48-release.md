# e48 = Farm Raids step 1 (practice), on top of e47 once it is live

Game: `feat/raids` (hv-raids). Build on the e47 app commit, copy `dist/index.html` to
`assets/sunny-acres/sunny-acres.html`, set `SUNNY_ACRES_GAME_COMMIT`, bump `OTA_RELEASE` to 48, and add the What's New
below (the last 3 updates: e48, e47, e46). All packs are already on the CDN (checked 9 Nov: 211/211).

## What's New (RELEASE_2_6_2_E48_OWN)

```js
const RELEASE_2_6_2_E48_OWN = Object.freeze([
    { kind: 'feature', title: 'Harvest Ville: Farm Raids', description: 'Buy a Raid Camp at Mira\'s (Workshops), train goats and crows, then press and drag to send them into a bandit farm. Grab crops, eggs and Gold in 2 minutes for up to 3 stars.' },
    { kind: 'feature', title: 'Harvest Ville: Guard your farm', description: 'Ten defenses like the Guard Goose, Bee Box, Mud Pit and Sprinkler Blaster, sold at Mira\'s and placed with Decorate. Your dog and fences help too. Try "Test my farm" to see how it holds.' },
    { kind: 'feature', title: 'Harvest Ville: Farm Shield', description: 'Each day\'s story chapter gives a Farm Shield: use it from your bag to keep your farm safe for 24 hours.' },
]);
```

## Checked on the phone (OPPO, 9 Nov 2026)

- Raid Camp bought at Mira's Workshops (3,000G), placed with Decorate; the Raids button shows next to it.
- The Farm Raids tour shows the first time (after the tips fix).
- Trained 4 goats + 3 crows; Bandit Shack: 3 stars, +810 Gold, +50 Raid Points; Bandit Patch opened.
- Test my farm: the dog beat all 7 raiders, 1 star, 38% taken ("Your farm held up well!").
- iPhone: opens the raids build fine (its account has no Gold for a camp).
