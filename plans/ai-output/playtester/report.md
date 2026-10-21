# AI playtest report

From 1 headless game(s) of scripts/simulate.mjs --policy scripted; digest: `plans/ai-output/playtester/digest.json`.

## Game 1: The Akkadian tribes, seed 1000, 301 turns to 700 (ACTIVE)

# Playtest Report: Game 1 (seed 1000, Akkad, T2-T301, 5000 BCE to 700 CE)

## 1. Summary

The scripted Akkad game was quiet and safe. It lost no cities and fought one battle as defender. It was also very slow: 1 city for the first 100 turns, 7 cities by T301, and 1 to 3 units all game. Gold rose every block from 552 to 20,857 and was never spent. The AI world was busy around the player: 18 wars, 91 battles and 29 captures, but all 36 majors were still alive at the end.

The three things that matter most:

1. **Research and the calendar stall in the midgame.** The player sat on 30 techs from T152 to T251, and `governance_feudal_charters` took roughly 100 turns. The year stayed at 500 CE from T122 to T251.
2. **The economy has no visible sink.** Gold climbed without a single dip, and the AI-style build queue produced a second city only at T100 and the first military unit only at T156.
3. **Late-game content runs on repeat.** After about T100 the events cycle through the same five or six cards. Era goals scored 1 goal with no legacy three times, and the medieval era never scored at all.

Caveat: the policy is passive. It never buys, never declares war and never moves armies. Some of the quiet is the policy, not the game. The findings below say which is which.

## 2. Findings

### Critical

**C1. Research stalls for about 100 turns on one tech.**
- Evidence: the tech count is 30 in every block from T152-161 to T242-251. The current research is `governance_feudal_charters` from the T152 block until it completes at T258.
- The next tech, `governance_royal_chancery`, took T258 to T295, about 37 turns.
- For comparison, early techs came every 2 to 6 turns (T4 to T64: 19 techs), and even the T64 to T158 stretch averaged about 9 turns per tech.
- The stall began as the player went from 3 to 5 cities, so tech cost may scale with city count or the medieval era jump. The digest cannot say which.
- Why a player cares: 100 turns with no unlock is a third of this game with no new buildings, units or choices. The advisor kept the same target the whole time, so a human would see a progress bar that barely moves.

**C2. The calendar freezes.**
- Evidence: the year is 500 CE in every block from T122 to T251 (130 turns), then 600 CE for T252 to T291, then 700 CE at T292-301.
- There are earlier flat spots too: 2000 BCE across T22-T41, 800 BCE across T52-T71, 540 BCE across T82-T101.
- There are also jumps: 3800 BCE to 2000 BCE in one block, and 150 BCE to 500 CE in one block.
- The date seems tied to tech or era progress rather than to turns.
- Why a player cares: on a real-history map the date is the main sense of progress. A frozen year combined with frozen research reads as a stuck game. It also means 2300 CE is unreachable at this pace; the game is at 700 CE after 301 turns.

### High

**H1. Gold piles up with nothing to spend it on.**
- Evidence: gold rises every single block, from 552 (T2-11) to 20,857 (T292-301). The minimum was 503 and there were no dips.
- The late-game slope is about +150 to +170 per turn while research was stalled.
- The AI is similar: mean AI gold is 8,950 and there were 0 bankruptcies.
- Opinion: the policy never buys, so part of this is the policy. But the AIs also hoard, which points to too few or too weak sinks: maintenance, upkeep, purchases, or converting gold into research.
- Why a player cares: 20k of idle gold means the economy gives no decisions. It also means a human could likely break the game by buying everything once they find the button.

**H2. Expansion is very slow under the game's own build logic.**
- Evidence: the first settler came at T87 and the second city at T100. Then cities 3, 4, 5, 6 and 7 arrived at about T142-151, T212-221, T232-241, T252-261 and T282-291.
- Combined city size grew from 4 to 34. Player production averaged 10.9, below the AI city median of 15.6, and the minimum was 1.
- These queues are 
