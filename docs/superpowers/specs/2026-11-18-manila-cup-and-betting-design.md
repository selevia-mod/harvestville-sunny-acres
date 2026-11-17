# The Manila Cup and race-day betting (owner, 18 Nov 2026)

Owner approved Phase B ("All Yes") with: prizes 10x, extra try 2,000 Gold, a sprint bar that is not the horse's stamina,
and "allow users to bet their gold also, meaning they can play a mini game inside to bet gold for horses". Gold is game
money only: it cannot be bought with real money and cannot be traded between players (owner, 18 Nov 2026). Ships only
after the 2.7.0 store build is approved. Mang Kardo (Stables and race host) runs both.

## 1. The Manila Cup: a weekly time trial on the oval (the grandstand and track are already on Manila's map)
- All week, Monday 8 AM to Sunday 7 PM (Manila time, like the daily resets): ride the track alone: **3 laps, 6 hurdles**
  (the race props: art-src/manila/city/race_props.png and race_cups.png).
- Controls: steer with the joystick as riding; **tap to jump** a hurdle (a knocked hurdle costs 1.5 s); **hold the action
  button to sprint**: a **sprint bar** that drains while sprinting and **refills fully at the start of each lap**. Riding
  itself costs the horse nothing (owner's rule). The sprint bar is the race's own bar, never the horse's stamina.
- Needs: a horse with **6 hearts** and **Horseshoes** (the valley road's rule).
- Tries: the **first try each day is free**, more tries **2,000 Gold** each. Your **best time of the week** counts.
- Results: Sunday 7 PM (the raids stay at 8 PM). Server-checked when online (no lap faster than a perfect ride: compute
  the perfect time from the track length, top speed with sprint, and jumps); offline tries count once synced. The board
  needs a server table and RPC: WRITE the SQL into the repo's supabase folder like the other farm_*_v1 functions, do NOT
  apply it (the owner applies SQL). Until it is applied, the game shows your own best time and "Results open soon".
- **Prizes (10x the old note):** 1st 150,000 Gold + the Gold Horseshoe Cup (a house trophy) + "Manila Cup Champion" on
  Manila's Hall of Fame for the week; 2nd 80,000 + the Silver Cup; 3rd 50,000 + the Bronze Cup; 4th-10th 20,000 + a
  ribbon; everyone with 3 runs that week 3,000 Gold + 3 oats. Paid through the game's existing reward/mail path the next
  time the player opens the game.
- Live 8-rider heats: later (not now).

## 2. Race-day betting: a mini game at the grandstand
- **Bet on the house races:** every **10 real minutes** from 6 AM to 10 PM a race of **6 named horses** (Manila names:
  e.g. Bagyo, Kidlat, Sampaguita, Lakas, Dalisay, Tala) runs on the oval. Each race's horses, their form and their **odds**
  come from the race's number and a fixed hash (the same on every phone; no server needed); the winner too (weighted by
  the odds, with a little luck), so nobody can see it in advance in the UI (never show or log it before the start).
- **Bet:** at the grandstand's betting window (Mang Kardo or a bet clerk), pick a horse and an amount: **100 to 50,000
  Gold a race** (decided by me), one bet per race. Bets close 30 s before the start.
- **Watch:** the race plays as a short mini game: the 6 horses run the oval (about 20-30 s), the crowd cheers, a photo
  finish when close. You can watch from the grandstand; leaving still pays you.
- **Pay:** a win pays the stake x the horse's odds (odds from 1.6x for the favourite to 9x for the long shot, set so the
  game keeps about 10%: the house edge makes betting a gold sink, not a gold fountain). A loss loses the stake.
- **Limits so nobody loses a fortune by mistake:** at most **200,000 Gold bet a day** (decided by me); a confirmation
  before any bet over 10,000; a small "Bets today: won/lost" line on the window.
- Bets are saved (a running race's bet survives closing the game and pays by the clock on the next open).

## First-time tours
"The Manila Cup" (the track, the sprint bar, the prizes) and "Race Day" (betting, odds, the daily limit). The owner's
art: race_props, race_cups, grandstand, npc_mang_kardo. Pop-ups centred.

## Save
New top-level key(s) only from the free list (check every `o.<key> =` in src/01-*.js; e.g. 'mc' for the cup and the
bets if free). Appended only; old saves load unchanged; generation stays 3; the save fuzz covers tries and bets.
