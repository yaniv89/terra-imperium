# Lane naval-8: report

ponytail read in full at 10:49 UTC, 28 Oct (session start hook printed PONYTAIL MODE ACTIVE; `cat` of the whole SKILL.md).

Target: "Naval" 8/10 (3 to 5 in round 2). Scope: campaign naval play (fleets.js, aiLanding.js, embark and
landing in armies.js and routes.js, ship building, fleet UI). Not touched: naval battle screens and
wording (battle-screens lane), the AI's amphibious odds (battle-odds lane; LANDING_MIN_P unchanged).

## What round 2 saw, and the cause

| Report | Seen | Cause found | Fixed |
|---|---|---|---|
| civ veteran 40651416284, step 197 | "Your amphibious assault on Sinope was repelled. Fallen: 6,720 of yours", never ordered | Not the player's army at all. The AI's naval phase (aiOperations.js `processAINavalOperations`) runs `AMPHIBIOUS_ASSAULT` through the reducer as the AI (`playerNationId` = the AI), so the reducer wrote its lines in the "you" voice, and `apply()` copied them into the player's log. Here: Ahhiyawa's landing on Pontic Sinope (both AI; Ahhiyawa declared war on Pontus at step 194). Battle reports were already filtered; the log lines were not. | `apply()` keeps no reducer log lines (every action there is AI against AI; the player's battles are queued). Test: aiLanding.test.js "AI against AI ..." asserts the player's log is unchanged (it got 4 "Your ..." lines before). |
| civ veteran, 53-54; warmonger 47 | Naval play hard to find, "glanced" only, no naval play happened | AI coastal majors owned no ship in 3 of 4 traced games (0 of 12 majors), so there was no enemy fleet to meet, no blockade and no sea threat; and nothing on the build list said what a ship is for | A small AI navy; AI fleets that sail on the map; ship rows with cargo and pace (below) |
| civ veteran 231 | Landing at Tirzah card odds | battle-odds lane's (odds math) | not touched |

## Changes

1. **AI fleets sail on the map (Total War style visible invasions).** An AI fleet at war boards troops in
   port only when the landing's odds pass, sails tile by tile (routes.js `sailFleet`, the player's own
   rules) to the waters off the nearest reachable enemy coastal city, **stands off the coast a turn**
   and lands the next. The player gets a turn report line, with a jump button:
   "Enemy fleet off Tartessos (The Ulaid tribes), troops aboard (regiments: 1): it can land next turn.
   Garrison the city or meet the fleet at sea." (`m.battle.fleetOffCoast`, en and he).
   A warship with no troops sails to blockade the target (fleets.js `isBlockaded` then stops its sea
   trade); an empty transport goes back for troops; a fleet with nothing to do, a lost home port, a
   refused landing or a peace goes home (its last port, else the nearest own sea port) and unloads.
   Before: the landing came straight from the AI's port with no warning.
   Research: Total War (an invasion fleet is a visible army at sea that can be met before it lands),
   EU4 (transports carry, warships blockade ports), Civ VI (embarked units are visible and vulnerable).
2. **Interception is honest.** The city owner's fleets at sea beside the threatened coast now meet the
   landing (before: only fleets docked in that very city); a third people's fleet in the port no
   longer joins the player's side (it did). aiLanding.js `guardsCoast`.
3. **A small AI navy.** A coastal major's sea-coast city keeps NAVY_PEACE = 1 ship (NAVY_WAR = 2 at war),
   at NAVY_UTILITY 0.5 (war 1.2), a warship (or the age's first line). Counted per turn so the coastal
   cities do not each queue one (resolveTurn production phase). The player's "Advisor builds" uses the
   same chooser, so it also suggests one ship for a coastal player.
4. **Boarding from far away refused.** A fleet at sea keeps its last port's `regionId`; `EMBARK_UNIT`
   checked only that, so an army in port could board a ship far out at sea. Now troops board a ship
   in port only.
5. **Putting in at a port.** A fleet already in a port's waters but not beside the city's centre tile
   could not put in (its one-step route failed the "starts next door" check and was dropped); found
   while testing AI fleets going home, and it hit the player's fleets too. routes.js `sailFleet`.
6. **Build list says what a ship is for.** Each ship row: "Carries troops: N · sails T sea tiles a turn"
   (T from the nation's real pace), "Carries no troops" for raiders and carriers. en and he.

## Evidence

### Headless trace (balance-sim navalTrace.sim.js, 150 turns, NAVAL=1 player, seeds 11 and 12)

Fixed seeds, the same harness before (origin/claude/integration f60660b8) and after (final merged head).
The naval-minded player (NAVAL=1: queues a ship, boards, sails, lands) is unchanged, as intended:

| start, seed | could build | ship | army aboard | at sea | landed | first sea battle, before / after |
|---|---|---|---|---|---|---|
| Ahhiyawa 11 | 8 | 19 | 20 | 21 | 22 | none / 121 |
| Ahhiyawa 12 | 8 | 19 | 20 | 21 | 22 | 131 / none |
| Tartessos 11 | 8 | 19 | 20 | 21 | 22 | none / none |
| Tartessos 12 | 8 | 19 | 20 | 21 | 22 | none / none |

AI coastal majors (12 a world):

| start, seed | own a ship, before | after (median turn) | fleet at sea, before | after (median turn) |
|---|---|---|---|---|
| Ahhiyawa 11 | 0/12 | 9/12 (104) | 0/12 | 0/12 |
| Ahhiyawa 12 | 0/12 | 9/12 (106) | 0/12 | 2/12 (141) |
| Tartessos 11 | 0/12 | 9/12 (107) | 0/12 | 1/12 (85) |
| Tartessos 12 | 1/12 (132) | 10/12 (104) | 0/12 | 0/12 |

Sea battles (naval, landing, intercept) per game stay rare (0 to 4 before, 0 to 1 after): the AI
world is quiet by design, and an AI fleet goes to sea only at war. The player's first sea battle
moves with the seed (one game gains one, one loses one). The real change is that a coastal player
now meets AI ships and sees invasions coming, rather than more battles.

### Balance (compare.sh origin/claude/integration 150 11-14, PLAYER=tartessos, paired)

4 paired seeds (11 to 14), final turn. No health or runaway change: nonFinite and auditViolations
identical (0); 96 metrics identical on every seed; warsTotal, conquests, capturesTotal,
nationsAlive, topLandShare and effectiveNations not starred. Starred rows:

| metric | base | head | diff [95%] | seeds up/down |
|---|---|---|---|---|
| sacks | 15.8 | 18.0 | +2.25 [0.25, 4.25] | 4/0 |
| warStackMean | 1.83 | 2.08 | +0.25 [0.04, 0.46] | 4/0 |
| branchShare_sage | 0.20 | 0.19 | -0.0025 [-0.0046, -0.0004] | 0/4 |

Reading: AI coastal cities now spend some production on one ship (NAVY_UTILITY 0.5 in peace), a
little less on garrison and walls, so independents sack about 2 more AI cities a game over 150
turns; war stacks are slightly bigger. For the lead: if the sacks matter, lower NAVY_UTILITY or
start the peacetime navy from the Classical age. msPerTurn not starred (parallel runs).

### Real browser (scripts/ui/naval-shots.mjs --he, dev server 5197)

32 of 32 checks pass at 844x390 and 1600x900, en and he, no page errors. Shots in plans/ui/naval/:
1 build list with the War Galley row (cargo and pace), 2 Board in the army sheet, 3 Land here,
4 landed, 5 (new) an enemy fleet with troops sails up to the player's port: after End Turn the turn
report shows the warning with a jump to the city.

### Tests

New or changed: aiLanding.test.js (stands off the coast and warns, then queues the landing a turn later;
a player fleet at sea off the coast intercepts and a bystander's fleet does not; a fleet whose port was
lost goes to another own port and unloads; an empty transport does not park off an enemy coast; AI vs
AI writes nothing to the player's log), fleets.test.js (no boarding a fleet at sea; putting in from a
port water not beside the centre), aiOperations.test.js and sallyLanding.test.js (landings now come after
the voyage: testWorld.js `aiVoyage`). Each new assertion was checked to fail without its fix.
Full `npx vitest run` on the merged head: 4,721 passed, 17 skipped, 1 failed: ruleYearPurity.test.js
caught my `{year:next.year}` (no space) as a year read. It was only a label copy; it is now written as
`year: next.year` and that test passes. `npm run lint` clean.

engine-rules-reviewer: three real findings, all fixed (a fleet could move twice the turn it reached
port; a fleet whose home port fell was stranded at sea; an empty transport parked off an enemy coast)
plus one smaller (a refused landing for cost left the fleet waiting off the coast: it now goes home).

## For other lanes and the lead

- battle-odds: the AI landing gate is unchanged (`LANDING_MIN_P`, `estimateBattle` with
  battleType 'landing'); it is now checked when boarding and again when standing off the coast.
- battle-screens: the interception (`kind: 'intercept'`) can now include the player's fleets at sea
  beside the coast, not only in port.
- Not done: AI fleets do not patrol in peace (they sit in port); AI fleets do not hunt the player's
  fleets beyond the existing one-tile `aiFleetAttack`; a fleet halted by an enemy fleet on its route waits
  until that fleet moves or it is strong enough to attack.
- Design call for the lead: the one-turn "stands off the coast" wait applies to AI-vs-AI landings too
  (one rule, and the player sees the AI's wars at sea). It delays AI landings by the voyage plus a turn.
