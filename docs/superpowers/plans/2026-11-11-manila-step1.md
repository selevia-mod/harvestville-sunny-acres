# Manila, step 1: the city (plan, 11 Nov 2026)

Owner: "start it now"; it ships only on the owner's word. Design: docs/big-city-and-weapons.md (owner) and
docs/manila-proposals.md (proposals; owner decisions win). Branch feat/manila (worktree ~/Documents/hv-manila).

## What step 1 is
1. The 90 x 90 map, laid out per the proposals' tile boxes: the bay and port (3 empty berths, the lighthouse), the walled
   quarter (church, Armory, Lola Amparo's house), the station (NE), the Central Plaza (fountain, notice board, Hall of
   Fame board), the Grand Market + Trading Post, the Stables + race track, the Barrio, Calle Real, the three gates.
   Shops, the Hall of Fame, the gates to the grounds: "Coming soon".
2. Getting there and back: the train from Willowbrook Station (a "Manila" tab: 250G one way, the first ride free) and
   back from Manila Central; the valley road (walk off the town's east end, come back out the Plains Gate). The horse
   rule (6 hearts + Horseshoes, economy part 5) is one hook, L.manilaRoad, open for now.
3. The 7 city people (Rosa, Danny, Lando, Kardo, Marisol, Tibo, Amparo) at their places by the hour, wandering a little,
   with short talk lines. Stand-in looks: the train visitors' sheet (tw_people), tinted; their own sheets later.
4. Open to everyone: the game server's public rooms. The phone's public-room code was tied to the hunting places' wild
   runtime (`this.wild`), so it was not a pure config change: a few guards now also take the city (C.MANILA.pub), and
   the server gets a city room (players, chat, no animals; tests in server/). Not deployed: a server from before says
   no, and the phone plays Manila with the friends of its farm's room, as before. Deploy steps: docs/game-server.md.
5. Art: none yet. The page gets almost nothing: the map is BUILT AT RUN TIME from the layout in code (no maps/manila.json
   in the page), the ground tiles are drawn on a canvas (stand-ins), buildings and props borrow the town's pictures,
   scaled into the proposals' boxes with a small name label. The owner's batch 1-2 pictures go through
   tools/manila/manila-import.js into a download pack 'manila' (tools/packs.js); the game asks for it (F.needImage) and
   keeps the stand-ins until it is there.
6. Cheap phones: the tilemap culls by itself, still pictures are culled (19zzzz-perf.js), labels are culled here, no
   new texture over 4096 px (the drawn ground is 680 x 272), no water animation or sunset glow yet.
7. Tests: unit (map shape, every place reachable, tickets, the save), server (city room), e2e (train there, walk to the
   plaza, talk, train back; the valley road).

## Files
- src/00-zzzzzzzzzzzzzzzzzzz-manila.js: content (layout, people, lines, prices).
- src/01-logicZZZZZZZZZZZZZZ-manila.js: rules (the map builder, tickets, the road hook, the save key `mn`).
- src/19zzzzzzzzzzzzzzzzzzzzzzzzz-manila.js: the world side (ground canvas, buildings, people, station tabs, gates).
- tools/manila/manila-import.js, tools/packs.js: the art pack path.
- server/lib/pub.js, server/lib/game.js: city rooms; server/test/manila.test.js.
- test/manila.test.js, test/e2e-manila.test.js.

## Save
Manila is saved as the town (an older game opens in town) with its own spot (`mp`); rides in `mn`. Nothing else changes.
