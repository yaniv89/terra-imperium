# Lane diplomacy-depth: report

Branch `claude/diplomacy-depth`, from `claude/integration`. AI war planning not touched.

## What the playtests showed
- Run 40550097406 (newcomer, phone), Diplomacy 3/10: the army sheet's "Toward Mycenae" sent a march
  to attack. At peace the target city's land is closed, so the bar said "declare war before attacking"
  and offered no March at all (step 51, shots/step-051.jpg). A peaceful player had no way to go and
  meet a neighbour.
- Run 40550092795 (warmonger), Diplomacy 5/10: only the declare-war dialog was seen (it was praised).
- Both scores are mostly coverage: neither player reached the people card's actions. The one real
  defect was the war prompt on a peaceful approach.

## What the headless trace found (before)
New harness `.claude/skills/balance-sim/diplomacy.sim.js`: a peaceful player (pays demands, never
declares war) plus a diplomat policy every 5 turns (open borders and stele when they would accept,
trade while slots last, an alliance at opinion 20 or more, a gift when open borders would be refused).
- A gift (100 gold) only lowered `hostility`, and a stranger has none: 4 to 6 gifts per game moved
  opinion by 1 point in total. The button said "Lowers their hostility".
- Open borders need opinion 20; strangers sit at 8. With gifts useless, open borders came at turn
  30 to 35 and were refused 16 to 25 times before that.
- Trade agreement and alliance refusals in the reducer returned the state silently (the people card
  warns before the tap, but any other caller got nothing).

## Changes
1. **Peaceful approach** (Civ: closed borders stop units at the border; EU4: military access is asked
   for). A march toward a city whose land is closed to the player now plans to the nearest open land
   tile at their border (`routes.js approachTile`, used by MarchContext). The march bar says
   "Closed land of X: the march stops at their border near Y, N turns", shows their answer to open
   borders with the numbers (opinion a of 20, "gifts and trade raise it") and offers an
   "Open borders (50 gold)" button. A refused offer is not sent (it would still cost gold): the tap
   logs why. Once borders are open the same target plans straight to the city. Covers the army
   sheet's "Toward X" and the people card's "March to" (both start the same march).
2. **Gifts warm opinion** (EU4 "gift received": goodwill that wears off). Each gift adds +10 to a
   warmth that fades 1 a turn, capped at +20 (`nation.giftsFrom[giver] = { value, turn }`,
   opinion.js `giftWarmth` / `withGift`, constants GIFT_OPINION and GIFT_OPINION_MAX in
   data/opinion.js), shown as "Your gifts" in the opinion breakdown, and it still lowers hostility.
   The button reads "Gift (100 Gold): +10 opinion"; the log line gives the new opinion. Ripples:
   open borders and stele acceptance, the AI war roll (opinion 20+ stops it) and AI demands (opinion
   15+ demands nothing). Player only: no AI or scripted harness sends gifts, so the AI world is
   unchanged.
3. **Refusals say why**: TRADE_AGREEMENT at war or with no slot left, MILITARY_ALLIANCE refused, now
   log a reason (en and he) instead of returning silently.

## Evidence
Peaceful trace, 80 turns, Normal, Akkad, seeds 11 to 14 (base = origin/claude/integration 76cae73b):

| seed | first open borders (base / head) | open-borders refusals | opinion gained by gifts | alliances | gold at turn 80 |
|---|---|---|---|---|---|
| 11 | 35 / 10 | 25 / 17 | 1 / 31 | 0 / 1 | 462 / 612 |
| 12 | 35 / 10 | 20 / 11 | 1 / 31 | 0 / 1 | 472 / 522 |
| 13 | 35 / 10 | 16 / 3 | 1 / 21 | 0 / 2 | 509 / 509 |
| 14 | 30 / 10 | 2 / 0 | 1 / 21 | 1 / 2 | 629 / 679 |

Wars with the player stayed 0 on every seed, both sides. At turn 20 every major whose land was
closed to the player could be approached peacefully (approachT20 = closedT20 on all seeds).

Real browser (`node scripts/ui/diplomacy-shots.mjs --swgl`, dev server 5197): the approach line,
the verdict and the Open borders button at 844x390 and 1600x900, en and he, all pass; shots in
plans/ui/diplomacy/. On a phone the verdict and the button sit on their own row so the plan text
keeps its width.

Tests: src/engine/peacefulApproach.test.js (approach tile, open borders lift it, the bar model, gift
warmth and cap and fade, refusals logged); GameContext.test.js no-op tests now expect the reason.

## Review
engine-rules-reviewer: no determinism, save or explore-mode findings. Two fixed: the approach reach
is now km (`APPROACH_KM` 925 through `ringsForKm`, not 12 rings), and the per-candidate A* searches
(up to 12 per hover) became one breadth-first search from the army per ring, capped at 6,000 tiles.
The approach only finds land routes; a people reachable only by sea keeps the old at-peace line.
`npm run test:quick` after merging integration: 477 files passed.

## Not done / for the lead
- "Show on map lands on open sea" (same playtest) is a camera issue (mapCamera.js), not diplomacy.
- `resolveTurn.test.js` "an aggressive, hostile Tier 1 neighbor eventually declares war" fails on
  origin/claude/integration too (AI war logic, campaign-ai-wars lane).
- The alliance answer still reads `hostility`, not opinion, so it can disagree with the opinion the
  card shows. Moving it to opinion is a rule change worth its own balance run.
