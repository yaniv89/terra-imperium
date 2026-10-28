# Lane events-8: report

Ponytail read in full at 10:49 UTC, 28 Oct 2026 (`cat .claude/skills/ponytail/SKILL.md`; the session start hook also printed PONYTAIL MODE ACTIVE).

Branch `claude/events-8`, merged with `origin/claude/integration` (54627085, which includes gold-sinks). The evidence runs below were made on cece290d, before gold-sinks. Target: "Crises, events, era goals, independents, raids, World Congress" from 5 to 7 (round 2) to 8. No API use.

## What round 2 said, and what I found in code

| Round 2 finding | Cause in code |
|---|---|
| Era goals were "not seen" in all four playtests | Only a closed chip on the map ("Goal: 2/4 cities"). Nothing asks the player about them. |
| World Congress "never seen" in three of four playtests | It opened with Global Institutions, an Information Age tech (the 7th of 8 ages). |
| Crises "rarely seen" | 3 or 4 crises a game, each striking at most 6 majors drawn at random. The scripted player was struck in 2 of 4 games. A crisis that spared the player showed nothing. |
| "A raid event had no visible follow-up"; "threats are fake, then suddenly real" | A raid on the player ended in a log line. Nothing asked for an answer, and nothing the player did changed the raiders' grudge, except fighting. |
| "Gold versus more gold"; "The River Rises 4 times" | Coastal Boom was 120 gold against 100 gold. 60 of the 612 drafted cards had an option that was as good or better than another on every count. A card rested only 14 reference turns, however often it had come before. |

## What changed

1. **The dawn card, once an age** (`eventDeck.js` `eraDawnCard`, `eraGoals.js` `setEraFocus`).
   - At the first free event slot of each age, the player picks the goal their people will be remembered for. Each option shows the goal's progress and its reward ("Expand: 1 of 8 cities (when met: +30% manpower)").
   - The chosen goal pays double. The map goal chip follows the chosen goal and marks it.
   - This gives every age a visible goal and a decision. It follows Civ VII's legacy paths and Humankind's era stars.
2. **Crisis answers** (`crises.js`, `data/crises.js` `answer`). This follows Civ VI's emergencies.
   - When a crisis strikes and spares a major player inside its age window, that player gets an answer card: aid the struck (their grudge against you falls), profit from them (it rises), or stay out.
   - In a world war, only the side under attack counts.
   - Two new crises cover the last two ages, which had none: a global pandemic and the climate shock.
3. **Raid aftermath** (`eventDeck.js` `raidAftermathCard`, `raids.js` keeps `cityId` on `lastRaidOnPlayer`).
   - Within 3 turns of an independent's raid on one of your cities, a card asks for an answer. A beaten raid offers: pursue, make peace, or mend the walls. A suffered raid offers: swear revenge, seek terms, or raise a watch.
   - The answer moves the raiders' grudge, which sets how often they raid and demand tribute (`effects.indepGrudge`).
4. **Consequences of the common draws** (`data/eventChains.js`). Six follow-up cards come a few turns later in the same city and name it.
   - Each is a new choice: the raiders return, hunger at the doors, black silt after a flood, the caravan returns, the harbour grows, the newcomers settle.
   - Coastal Boom is no longer gold against gold.
   - An option that leads on shows a "The story goes on" badge.
5. **Variety.**
   - A drawn card rests longer each time it comes: 1x its rest, then 2x, then at most 3x (`REST_GROWTH_MAX`).
   - The drafted cards with a dominated option leave the deck (`cardChoice`).
6. **World Congress** opens with Royal Chancery, in the Age of Kingdoms (`data/worldCongress.js` `CONGRESS_TECH`). Civ VI's congress also convenes in the middle of the game. The trade standard's text no longer says "data".
7. **Effect badges** for the new keys:
   - "Relations with the stricken +15"
   - "Their grudge +10", with a tooltip saying what grudge does
   - "The story goes on"

I did not change any existing event gold value; that is the gold-sinks lane's. The new cards' gold amounts are in the same range as the old ones, and since gold-sinks merged they are scaled by the player's income on the same path (`scaleEventGold`). The only merge conflict was in the imports of applyEventEffects.js.

## Evidence

### Headless whole games

`.claude/skills/balance-sim/storyPulse.sim.js`, Normal speed, standard peoples world, Akkad, seeds 11 to 14, full games. Both sides run on integration cece290d: the base is the integration commit itself, the lane is the same commit plus this branch. The scripted player answers every card with its first option and refuses demands.

| Over 4 games | Base | Lane |
|---|---|---|
| Turns played | 3,348 | 3,583 |
| Event cards | 813 (one per 4.1 turns) | 898 (one per 4.0 turns) |
| Cards with options that differ only in gold | 42 | 4 |
| Follow-up cards (a consequence of an earlier choice) | 244 | 294 |
| Crisis cards the player saw (struck or answer) | 2 | 12 |
| Raid aftermath cards | 0 | 37 |
| Dawn cards (one per age reached) | 0 | 31 |
| World Congress votes while the player sat | 5 | 119 |
| Era goals the player met | 12 | 20 |
| Cards with a real trade-off (no option as good or better on every count, `cardChoice`) | 91% | 93% |

Turns per event card, by the player's age:

| Age | Stone | Bronze | Classical | Kingdoms | Gunpowder | Modern | Information | Future |
|---|---|---|---|---|---|---|---|---|
| Base | 2.5 | 3.3 | 3.4 | 4.4 | 4.4 | 4.1 | 4.3 | 5.5 |
| Lane | 2.4 | 2.8 | 3.1 | 3.6 | 3.8 | 4.1 | 4.6 | 6.2 |

- Without the 3x cap, the rest grew without limit and the last two ages ran short of cards (Information 5.7, Future 8.1 turns per card). With the cap they are 4.6 and 6.2, close to the base.
- Game length and ages reached stay in the base's range: games end between turns 764 and 924 on both sides.
- An isolation run (seed 12, the lane with the old Congress tech) showed that the early Congress does not cause the long Gunpowder Ages. That age also takes 178 to 200 turns on the base for seeds 13 and 14.

### Tests

- New tests:
  - The dawn card, and focus paying double.
  - Crisis answers: bound to the struck, the hostility floor holds, a war counts only the side under attack, every crisis has three options with a real choice.
  - Raid aftermath: shown once, in time only, and the grudge moves.
  - Consequences: in the city, named, and they pass if the city is lost.
  - Rest growth and its cap.
  - No dominated drafted card.
  - `cardChoice` itself, and the new badges.
- Full `npx vitest run` after the final merge (gold-sinks included): 506 files and 4,754 tests passed, 0 failed. `npm run lint` is clean.

### Shots

`scripts/ui/events8-shots.mjs`, saved to `plans/ui/events8/`. Each of the three new cards at 844x390 and 1600x900, in English and Hebrew: no raw placeholders and no page errors. The options sit side by side on the phone, so every choice is on screen without scrolling.

### Engine review

The `engine-rules-reviewer` agent found no rule broken. I fixed two of its findings:
- The aid option now respects a broken truce's hostility floor.
- In a world war, the answer card concerns only the side under attack.

## For the lead (design calls I made, please confirm)

1. **The Congress moves to the Age of Kingdoms.**
   - The reason: Civ VI convenes its congress in the Medieval era, and here three of four playtests never saw ours.
   - The cost: arms limits and sanctions now reach the AI and the player about 300 turns earlier.
   - A mid-game save where majors already know Royal Chancery seats a Congress on its next turn.
2. **The chosen era goal pays double, for the player only.**
   - AI majors have no dawn card, and spared AI majors never answer crises. AI parity is unchanged otherwise.
   - If parity is wanted, an AI pick could be its doctrine's playstyle.
3. **Crisis answers do not change who a crisis strikes.**
   - Follow-up 25 still holds: the player is struck as often as any major.
4. **Old saves that are part way through an age** get the dawn card for that age at the next free slot.

## Not done, and risks

- The playtests' "gold versus more gold" comes mostly from the gold glut. My metric finds a real trade-off in 91 to 93% of cards on both sides, so the fix that will be felt is the gold-sinks lane's treasury scaling, which builds on these cards.
- Raids that "can't be countered" (Hazor sacked every 24 turns at 10 to 1 odds) are raid balance, not events. The integration's raid changes (635e2e25, 8c0a3ab9) cover the warning side. The aftermath card gives a way to lower the grudge, but I did not retune raid strength.
- The dawn card counts as "free" in the metric: all its options gain, so it is not a trade-off by `cardChoice`'s definition. It is still a choice between goals.
- I only measured the scripted player picking option 0. A player who picks "Swear revenge" every time draws more raids, which is intended.
- There is no fresh AI playtest. It needs a budget from the lead.
