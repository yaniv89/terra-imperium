# Lane naval-campaign: report

Goal: a coastal player builds ships, moves a fleet, carries an army, fights at sea and lands
within a normal game, and the AI does the same. No playtest had ever reached naval play.

## What blocked it (headless trace)

Harness: `.claude/skills/balance-sim/navalTrace.sim.js` (new). Coastal starts Ahhiyawa, Tartessos
and Butuan, seeds 11 and 12, 200 turns, the scripted player (worldStats POLICY=scripted) with the
research advisor on. It records per nation the first turn it could build a ship (tech and a sea
coast city), queued one, owned one, had one at sea, carried an army, landed, and its first sea
battle (every `applyBattleOutcome` of kind naval, landing or intercept). `NAVAL=1` adds a player
who also queues a ship once it can, walks an army to the port, boards, sails 4+ tiles to free
coast and lands, as a player would in the UI.

Root cause: each age's ship needs that age's ship tech (unitClasses.js UNIT_UNLOCKS), and in every
age that tech is the one the research advisor takes last, the sixth of ten that ends the age.
Star Lore at turn 32 to 36 moved the nation to Bronze, whose War Galley needs Early Astronomy;
Early Astronomy at turn 86 to 92 moved it to Classical, whose Trireme needs Minted Coinage. So the
window to build a ship was zero turns in every age before Kingdoms (whose ship needs no tech).

| start, seed | could build a ship, before | after |
|---|---|---|
| Ahhiyawa 11 / 12 | turn 194 / 179 | turn 36 / 36 |
| Tartessos 11 / 12 | turn 157 / 161 | turn 35 / 35 |
| Butuan 11 / 12 | turn 184 / 186 | turn 32 / 32 |
| AI coastal majors (12 a world) | 5 to 7 of 12, median turn 134 to 162 | 12 of 12, median turn 69 to 84 |

With the fix, the naval-minded player (NAVAL=1, 110 turns, seed 11 and 12):

| start | ship queued | ship built | army aboard | at sea | landed |
|---|---|---|---|---|---|
| Ahhiyawa | 39 | 46 | 48 | 49 | 50 |
| Tartessos | 36 | 61 | 63 | 64 | 65 |
| Butuan | 42 | 54 | 55 | 56 | 57 |

Before the fix the same player got its first ship at turn 192 to 198 of 200.

## Fixes

1. Ships carry over (src/data/unitClasses.js `isUnitUnlocked`, class `naval` only): a nation that
   knows the ship tech of its age or of any earlier age builds its age's ship. Research: Civ VI
   (Sailing opens the sea once; later hulls come with their techs, the old one stays buildable
   meanwhile) and EU4 (ships follow the naval tech level, never a gap with none). Land classes keep
   the per-age gate. Units still take the age they are built in (the user's rule is unchanged).
   Kingdoms ships, open with no tech, also carry forward, so once a nation reaches Kingdoms the
   sea never closes. Test: unitClasses.test.js "ships stay open once a ship tech is known".
2. "Land here" is the tile sheet's sticky main action when a fleet beside the tile carries troops
   (src/components/map/TileSheet.jsx). At 844x390 it sat under the tile facts, off screen.

## Real browser (scripts/ui/naval-shots.mjs, 844x390 and 1600x900, en and he)

Tartessos, Stone techs known, Bronze age, no Early Astronomy: the build list offers the War
Galley; a ship and an army in port: the army sheet shows "Board", the army goes aboard; the fleet
beside free land: "Land here" is on screen, the army lands. 24 of 24 checks pass, no page errors.
Shots: plans/ui/naval/ (phone, en and he).

## Balance

`compare.sh origin/claude/integration 150 11-14` (PLAYER=tartessos, 4 paired seeds): no metric
moved significantly; 194 metrics identical on every seed (wars, conquests, AI gold and units,
ages). The rule only opens ships, and the AI builds them only in wars, so the world is unchanged
at 150 turns. engine-rules-reviewer: no blocking findings; its two points are applied (an earlier
age open with no tech, Kingdoms, also carries the sea forward; `isAgeBefore` instead of indexOf).

## Not done (follow-ups for the lead)

- AI fleets never sail on the map: the AI's naval invasion is `AMPHIBIOUS_ASSAULT` straight from
  its port (aiOperations.js, war code), so "at sea" stays 0 for every AI. AI ships come only
  during wars and only with 300+ gold (0 to 3 of 12 coastal majors in 200 turns, both before and
  after). Making AI fleets sail tile by tile (Total War style visible invasions) touches AI war
  logic, which the campaign-ai-wars lane owns.
- AI city production never queues a ship (aiProduction.js has no naval item): a coastal AI keeps
  no standing navy, so the player meets few fleets at sea. Worth a small rule once AI fleets move.
- Ship build time in a young port can be long (Tartessos 25 turns for its first War Galley in the
  trace's harness, in a new small coastal city).
- Pre-existing red on the base: resolveTurn.test.js "an aggressive, hostile Tier 1 neighbor
  eventually declares war" fails on origin/claude/integration too.
