# AI playtest report

From 3 headless game(s) of scripts/simulate.mjs --policy scripted; digest: `plans/ai-output/playtester/digest.json`.

## Game 1: The Akkadian tribes, seed 1000, 301 turns to 700 (ACTIVE)

# Playtest Report: Game 1, seed 1000, Akkadian tribes (headless, passive script)

## 1. Summary

The run reached T301 (700 CE) with no crash, no city lost and no bankruptcy. For the player, though, it was mostly a waiting game. Akkad sat on one city for 100 turns, then crept to 7 cities. Gold piled up from 552 to 20,857 without ever dropping, and research collapsed after T158. The AI world was busy and stable: 18 wars, 14 peaces, 91 battles, 29 captures, and all 36 majors still alive. The three things that matter most:

1. **Research stalls almost completely after T158.** One tech (governance_feudal_charters) took about 100 turns.
2. **The calendar is tied to that stall.** The year is frozen at 500 CE from T122 to T251 and moves only 200 years in the last 180 turns.
3. **There is no economic pressure.** Gold rises in every single block, there is nothing to spend it on, and the build logic produces no settler before T87 and no unit before T156.

## 2. Findings

### Critical

**C1. Research collapses mid-game.**
- Evidence:
  - T1-T91: 22 techs, roughly one every 4 turns.
  - T91-T301: only 10 more techs.
  - governance_feudal_charters is the current research from the T152-161 block, finishes at T258, and the tech count stays at 30 for ten straight blocks.
  - governance_royal_chancery then runs T258-T295 (37 turns).
  - Earlier slow spots: science_geometry T91-T102 and military_iron_weapons T77-T91. So the slowdown builds, then falls off a cliff.
- Numbers vs opinion: the numbers show the stall. The cause is my guess: tech cost may scale with cities or era faster than research output does, or a prerequisite or penalty may be choking progress.
- Why a player cares: a hundred turns with no new unlocks removes the main reward loop of a Civ-like game.

**C2. Gold has no sink.**
- Evidence: gold rises in all 30 blocks, from 552 (T2-11) to 20,857 (T292-301). The minimum ever was 503, and spending never dipped the total.
- T120-T301 in detail: 2 to 7 cities, units 1 to 3, gold 3,350 to 20,857.
- The AI also averages 8,950 gold, so hoarding is systemic and not only a quirk of the script.
- Why a player cares: a resource that only grows stops being a decision. If buying, rushing or upkeep exist, they are not biting.

### High

**H1. The calendar freezes and jumps.**
- Evidence:
  - The year reads -2000 in both T22-31 and T32-41.
  - It jumps from -150 (T112-121) to 500 CE (T122-131), which is 650 years in 10 turns.
  - It then stays at 500 CE for 13 blocks (T122-T251).
  - It reads 600 for T252-T291 and 700 at T301.
- The year appears to follow tech or era progress rather than turns.
- Why a player cares: a frozen date on a real-Earth map is confusing and makes the game feel stuck. At this rate, reaching 2300 CE would take an extremely long game.

**H2. Early expansion is far too slow.**
- Evidence:
  - First building T16.
  - First settler T87, second city T100, third city by T142-151.
  - 7 cities at T301, while the top AI has 38.
- Both city choice and builds are delegated to the AI build logic, so this reflects the AI's own build priorities, not a passive-player choice.
- Why a player cares: following the in-game advice leaves you a one-city minor for a third of the game.

**H3. The player stays undefended through two wars and a sack.**
- Evidence:
  - Units sat at 1 from T2 to T151. First unit built T156.
  - Kingdom of Israel declared war at T126 and the player still had 1 unit.
  - T223: "Sack of Eshnunna", player defending, auto-resolved, 1,800 men lost.
- Never moving armies is the script's fault. Never building defenders while at war is the build logic's choice.
- Why a player cares: the advisor-driven queue does not react to being at war.

### Medium

**M1. The T223 sack has no attacker attached.**
- Evidence: the T222-231 block shows 1 battle lost and an empty warsWithPlayer list. Telemetry shows 1 rebellion on the player and 2 wars on the player (T126 and T297), neither active at T223.
- Why a player cares: losing 1,800 men to an unnamed attacker feels unfair. The sack should name the rebel, raider or power responsible.

**M2. Late-game events repeat heavily.**
- Evidence: T2-T104 brings about 25 distinct, flavourful cards. From T100 on, the deck narrows to:
  - Raiders on the Frontier: 6 times (T4, T101, T160, T205, T239, T276)
  - Traveling Merchants: 6 times (T88-T248)
  - Plague in the Streets: 4 times (T167-T270)
  - Failed Harvest: 4 times (T123-T292)
  - The River Rises: 3 times
- The T282-291 block had 0 events.
- Why a player cares: repetition reads as filler and undercuts the historical story.

**M3. Era goals are always minimal.**
- Evidence: stone T31, bronze T55 and classical T129 each scored "1 goals met, no legacy". No medieval scoring happened by T301.
- Part of this is the passive policy. Still, the same single goal every era suggests one goal that passive play always meets, with nothing in between that and the rest.
- Why a player cares: era goals that never pay a legacy do not steer play.

**M4. Crises are rare, never touched the player, and one is anachronistic.**
- Evidence: only 2 crises in 301 turns.
  - steppe_surge at T60.
  - little_ice_age at T165, dated 500 CE. The historical Little Ice Age is roughly 1300-1850.
- Neither hit Akkad.
- Why a player cares: crises are a key source of mid-game tension and are nearly absent here.

**M5. AI overextension appears unchecked.**
- Evidence: top AI overextension is 255 and the top-5 mean is 232.7 (the player's is 0), yet 0 of 12 rebellions succeeded and 0 conquered land. 23 of 25 tracked conquests were kept for 20 turns.
- My opinion: if overextension has teeth, they are not showing. Big AIs may snowball unchecked in longer games.

### Low

**L1. Player ADM, DIP and MIL telemetry all read 0.** Either these points never accrue or the harness is not reading them. Worth checking.

**L2. Wars against the player do nothing.** Both T126 (Israel) and T297 (Pontus) were declared "(none)", and 2 wars overall had zero battles. The Israel war ended by T142-151 with no fighting, so declarations against the player carry little weight. Of 8 tribute demands, all refused, no visible consequence appears in the digest.

**L3. AI stacks are mostly idle.**
- 48.5% of stack turns are idle at home. Peace move rate is 0.059, against 0.616 at war.
- War behaviour looks fine: 5.1 battles per war and 44 sieges.
- Peacetime armies look static, which may be fine but leaves the map motionless for a watching player.

**L4. Repeated dogpiles and rematches.**
- Shu is attacked by Pyu, Shang and Nanyue twice each (T166-T178 and again T282-T293).
- Ahhiyawa and Dacia fight 4 times.
- This is plausible, but rivalry variety could be wider.

**L5. Event timing reads odd.** "The Wheel" event fires at T15, but infrastructure_the_wheel is researched at T41. "The Horse" fires at T5. This is minor, but the story can run ahead of the tech it describes.

## 3. Scorecard

| Area | Score | Why |
|---|---|---|
| Core loop and fun | 3/10 | Long stretches with no new techs, nothing to buy and one city until T100. |
| Pacing | 2/10 | 22 techs in 91 turns, then 10 in 210; the year is frozen at 500 CE for 130 turns. |
| Economy and sinks | 2/10 | Gold rises in every block to 20,857; the AI averages 8,950; no bankruptcies, no pressure. |
| Research | 2/10 | feudal_charters takes about 100 turns (T158-T258); this is the single worst number in the run. |
| Expansion | 3/10 | First settler T87, second city T100, 7 cities vs the AI top's 38. |
| AI macro | 5/10 | Active wars and captures and stable majors, but overextension around 250 with no consequence and a 48% home-idle share. |
| War and battles | 5/10 | 91 AI battles, 5.1 per war, sieges happen; the player sack at T223 has no attributed attacker. |
| Diplomacy | 4/10 | 14 peaces from 18 wars is healthy; wars on the player are empty; demands have no visible follow-up. |
| Events and story | 5/10 | Rich, distinct early cards; after T100 a handful of cards loop. |
| Crises and era goals | 3/10 | 2 crises, none on the player, one anachronistic; every era scores 1 goal with no legacy. |
| Performance | 7/10 | Mean 158 ms and p95 305 ms are fine, but turn time grows about 6x (49 to 354 ms mean). |

## 4. Top 10 fixes (ranked)

1. Fix the research stall: cap or rebalance late tech cost against research output (T152-T258 on feudal_charters, T258-T295 on royal_chancery).
2. Decouple the calendar from tech progress, or smooth it (T112-T131 jump of 650 years; frozen at 500 CE T122-T251).
3. Add real gold sinks such as rush buying, upkeep and projects, and make the AI build logic use them (gold 552 to 20,857, monotonic T2-T301).
4. Raise settler priority in the AI build logic early on (first settler T87, second city T100).
5. Make the build queue react to war by queuing defenders (war declared T126 with 1 unit; first unit T156; 1,800 men lost at T223).
6. Name the attacker and the cause on sack and battle reports when no war is active (T223 Sack of Eshnunna, empty war list).
7. Widen the late event deck and add repeat cooldowns (Raiders x6, Merchants x6, Plague x4, Harvest x4 after T100; zero events T282-291).
8. Give era goals intermediate tiers and a reachable legacy (T31, T55, T129 all "1 goal, no legacy").
9. Raise crisis frequency, include the player in the target pool, and date-gate little_ice_age (only T60 and T165; Little Ice Age at 500 CE).
10. Make overextension bite and profile turn-time growth (AI overextension 255 with 0 rebellions succeeding; turn mean 49 ms at T12-21 vs 354 ms at T292-301).

## 5. What a headless run cannot tell

- **Player-driven war:** whether war feels good when the player declares it and moves armies. The script never did either, so the low player battle count is not the game's fault.
- **Tactical battles:** everything was auto-resolved. Battle feel, readability and the gap between auto-resolve and hand-played results are untested.
- **Story card choices:** only the first option was taken and drawn situational cards were dismissed, so balance across other options and the value of situational cards are unknown.
- **Diplomacy:** accepting demands, proposing deals and alliances, and how AI attitudes respond to player diplomacy were never exercised.
- **UI and clarity:** whether tooltips explain the research slowdown, the frozen year or the sack. A human might notice and react sooner.
- **Human expansion:** a human would likely settle far earlier than T87. Expansion pacing for real players may differ from the advisor's.
- **Feel and session length:** at about 0.16 s of simulation per turn, real-time feel, animation and AI-turn waiting time on actual hardware are unknown. So is whether 300 turns to 700 CE is tolerable for a human session.
- **Late game:** the medieval era and beyond, including late-game crises and era goals, were never reached.
## Game 2: The Elamite tribes, seed 1001, 301 turns to 1500 (ACTIVE)

# Playtest Report: Game 2, seed 1001, Elam (T2 to T301, 5000 BCE to 1500 CE)

## 1. Summary

Elam grew slowly from 1 city to a peak of 11 (T252-T281) and finished with 9. It met 3 of 4 era scoring windows with legacy and was never in danger of bankruptcy. The run looks healthy for the first 110 turns. After that it turns into a long, flat middle game: research nearly stops, gold climbs without limit, and the empire sat on 1 unit until it was invaded. The AI world is busy (19 wars, 108 battles, 28 captures), but only one major civ died in 300 turns. The three things that matter most:

1. **The automated build queue left the player defenceless for 150 turns.** Units stayed at 1 from T2 to T151, the first unit arrived at T154, and Shimashki fell at T153, one turn after its first siege.
2. **Research collapses after the classical era.** There were 20 techs by T52 but only 16 more in the next 250 turns. Techs sat at 31 from T152 to T211, and Banking Houses alone took about 58 turns (T155 to T213).
3. **Gold has no outlet.** Gold rose from 540 to 56,626 and never dipped meaningfully (minimum 507), ending at about 7 times the AI mean of 8,158, while the empire lost 4 cities in the last 20 turns.

The scripted player never buys, never declares war and never moves armies. So the gold hoard and the weak defence are partly the policy's doing. However, the idle-city queue is supposed to mirror what the AI would build, so the defence gap is a game finding.

## 2. Findings

### Critical

**C1. The idle-city build logic builds no defenders, and the first war costs a city instantly.**
- Evidence: units were 1 in every block from T2 to T151 (firstUnitTurn 154).
- Israel declared war at T145 with no casus belli ('none').
- The first siege of Shimashki came at T152, and the city was taken at T153 (1,500 men lost).
- Units then jumped from 1 to 5, 6, 7 and 9 only after the loss. Total city size dropped from 35 to 23 in T152-T161.
- Why it matters: anyone relying on the advisor or automation gets punished with no warning. If the AI's own queue logic is this blind, AI empires probably have the same hole. That may explain why independents supplied 15 of the 28 captures.

**C2. Cities change hands with no war or battle, and telemetry disagrees with the log.**
- Evidence: Kabnak was lost to the Israelite Empire at T284, and Hamanu was lost to the Israelite Empire at T300. Israel is not in warsWithPlayer after T170, and neither city has a battle entry.
- The notables list 5 lost cities (Shimashki, Marhashi, Kabnak, Ayapir, Hamanu), but telemetry says playerCitiesLost 3.
- Telemetry also shows rebellionsSucceeded 0, so these were not logged as rebellions either.
- Why it matters: from the player's side, losing a city at peace with no explanation reads as a bug. Either this is an unlabelled mechanic (culture flip, a peace-deal transfer, a vassal split) or a bug. Either way the player is not told why.

### High

**H1. The middle-game research wall.**
- Evidence:
  - Guild Charters was in progress from T124 to T155 (about 31 turns).
  - Banking Houses took from T155 to T213 (about 58 turns).
  - Postal Relay took from T217 to T255 (about 38 turns).
  - Only 6 techs were gained between T124 and T301.
- Output does not explain it: production mean was 15.8 (on par with the AI median of 15.4), and the empire had 6 to 11 cities.
- Why it matters: for 180 turns there is nothing new to unlock. The tech-driven part of the core loop goes silent, and the empire is still in the kingdoms era at 1500 CE.

**H2. Gold piles up with no sink.**
- Evidence:
  - T2: 540. T101: 3,324. T201: 18,379. T301: 56,626.
  - Late income was roughly 470 gold per turn.
  - Bankruptcies: 0. The AI mean was 8,158.
- Opinion: even allowing for the passive policy, nothing in the economy pulled gold down. Upkeep, unit costs and events all failed to dent it.
- Why it matters: in 1500 CE the player is losing cities while holding 56k gold. If gold cannot be turned into defence, science or growth easily, the number is meaningless. If it can, the game needs to make that obvious.

**H3. The calendar is erratic and clashes with historical events.**
- Evidence:
  - The year jumped from -280 (T92-T101) to 500 (T102-T111).
  - It then stayed at 500 for 40 turns (T102-T151), at 600 for 60 turns (T152-T211), and at 800 for 40 turns.
  - It jumped from 1000 to 1500 in T282-T301.
  - The Black Death fired at T276, around 1000 CE.
- Opinion: the date appears to follow tech or era progress, not turns. Combined with H1, history freezes.
- Why it matters: on a real Earth map, dates are part of the fantasy. Spending 60 turns in the year 600 and then skipping 500 years feels broken.

**H4. The kingdoms era drags on.**
- Evidence: classical goals scored at T110, and kingdoms goals at T296, an era of 186 turns. Stone (T35) and bronze (T52) took 35 and 17 turns.
- Why it matters: era goals are the main medium-term objective, and one era takes up 60% of the run.

### Medium

**M1. Overextension and rebellions have no teeth.**
- Evidence:
  - The top AI had overextension 291 against authority 64, and the top-5 mean was 245.5 against 65.2.
  - There were 50 rebellions started, 0 succeeded and 0 took land.
  - 6 rebellions were against the player, and none appeared in the player's notables.
- Why it matters: if overextension can run at 4 to 5 times authority with no outcome, the system is noise. Large AI empires never fracture, and the map stays static (majors alive went from 36 to 35 over 300 turns).

**M2. The AI world is busy but slow to change.**
- Evidence:
  - 19 wars, 13 peace deals, 108 battles, 45 sieges begun and 28 captures (21 kept).
  - Only the Yarlung were destroyed (T131).
  - No AI wars at all before T114.
  - 3 wars had zero battles.
  - In peacetime, AI armies moved on only about 7% of turns (aiMoveRatePeace 0.066), and 48% of stack-turns were spent idle at home.
- Opinion: 113 turns of total world peace is a long quiet opening, and a near-static map of majors removes the sense of rising and falling empires.

**M3. Siege auto-resolve results are hard to read.**
- Evidence: the Siege of Susa at T166, T167 and T169 was recorded as an 'attacker' win each time, with 9,220, 8,490 and 8,180 men lost, yet Susa did not fall and peace followed at T170. The Siege of Ayapir at T294 cost 8,720 men.
- Why it matters: three defeats in a row that still hold the city, with casualty totals far larger than a 6 to 9 unit army suggests, will confuse players reading the battle report.

**M4. Wars on the player without a reason.**
- Evidence: Israel at T145 and Sabaea at T277 both declared with casus belli 'none'. Bactria at T276 at least had a claim. Sabaea then won by naval landings and took Marhashi (T284) and Ayapir (T296).
- Why it matters: a peaceful, non-threatening player being attacked with no stated reason feels arbitrary. It also teaches nothing about how diplomacy could have prevented it.

**M5. Story events repeat.**
- Evidence:
  - Raiders on the Frontier fired 6 times (T55 to T246), plus Raiders From the North (T215).
  - Failed Harvest fired 6 times (T3, T139, T178, T206, T236, T273).
  - Harsh Winter, The River Rises and Plague in the Streets fired 3 times each.
  - There were zero events in T122-T131 and T282-T291.
- Why it matters: the early cards are varied and flavourful, with era-specific titles like The Wheel, The First Writing and The Tin Trade. Later the deck thins into weather and raiders.

### Low

**L1. The crisis log names the wrong player.** The steppe_surge entry at T75 lists 'The Shu tribes (the player)', but the player is Elam, which is also in the list. This is a label bug and may hide a targeting bug.

**L2. A peace deal is missing from the log.** Bactria drops out of warsWithPlayer by T292-T301, but there is no peace entry. Telemetry shows 19 wars and 13 peace deals, so endings are not logged consistently.

**L3. Leader stats are flat.** playerAdm, playerDip and playerMil are all 0 for the whole run. Either these are not tracked for the player or they never grow.

**L4. Early expansion is slow.**
- Evidence: the first settler came at T12 and the second city at T26. The empire stayed at 2 cities from T22 to T61, then climbed steadily to 11 by T252.
- Opinion: this is acceptable for a river civ, but a 40-turn plateau early on is long.

**L5. Turn time keeps growing.** The mean turn rose from 38 ms (T2-T11) to 353 ms (T292-T301), with a peak of 543 ms at T272-T281 (p95 347 ms). This is fine headless, but it is still rising with 800 years of calendar left.

## 3. Scorecard

| Area | Score | Why |
|---|---|---|
| Core loop and fun | 4/10 | Lively first 110 turns, then about 180 turns of nothing unlocking and gold piling up. |
| Pacing | 3/10 | A 186-turn kingdoms era, a frozen calendar (year 600 for 60 turns) and a 500-year jump at the end. |
| Economy and sinks | 3/10 | Gold went from 540 to 56,626 with no pressure; 0 bankruptcies anywhere. |
| Research | 3/10 | 20 techs by T52, then 16 more in 250 turns; 58 turns on one tech. |
| Expansion | 6/10 | Steady growth to 11 cities, with a slow 2-city plateau from T22 to T61. |
| AI macro | 5/10 | Many wars and captures, but 48% of stack-turns idle at home, overextension ignored, and the AI build logic skips defence. |
| War and battles | 4/10 | Defence collapses on first contact (T153); siege results are unclear; cities change hands without battles (T284, T300). |
| Diplomacy | 4/10 | Two wars with no casus belli; 2 demands refused with unclear consequences; little visible sign of how to prevent wars. |
| Events and story | 6/10 | Strong early era flavour; later repetition of raiders and harvests; two empty blocks. |
| Crises and era goals | 5/10 | Goals met in 3 of 4 eras, but crises are few (2 in 300 turns), mislabelled at T75, and the Black Death came at about 1000 CE. |
| Performance | 7/10 | Mean 165 ms and p95 347 ms headless; turn time grew roughly 9 times over the run. |

## 4. Top 10 fixes (ranked)

1. Make the idle-city and AI build logic keep a minimum garrison, scaled to neighbours and threat (1 unit from T2 to T151; Shimashki lost at T153).
2. Explain or fix cities lost at peace with no battle, and reconcile playerCitiesLost 3 with the 5 losses in the notables (Kabnak T284, Hamanu T300).
3. Flatten mid-game tech costs or raise science scaling (Guild Charters T124 to T155, Banking Houses T155 to T213, techs flat at 31 from T152 to T211).
4. Add visible gold sinks or gold-to-science and gold-to-defence conversions, plus late-game upkeep pressure (56,626 gold at T301 while losing 4 cities in T284-T300).
5. Decouple the calendar from tech, or at least smooth it (-280 to 500 in T92-T111; year 600 across T152-T211; 1000 to 1500 in T282-T301).
6. Shorten the kingdoms era or add intermediate goals (classical scored T110, kingdoms scored T296).
7. Give overextension real consequences and let some rebellions succeed (overextension 291 against authority 64; 50 rebellions, 0 succeeded).
8. Require or penalise wars without a casus belli, and warn the target (Israel T145 and Sabaea T277, both 'none').
9. Clarify siege auto-resolve outcomes and casualty scale (Susa T166 to T169: three 'attacker' wins, about 26k men lost, city kept).
10. Reduce repeats in the event deck, fix the crisis target label, and log all peace deals (Failed Harvest 6 times, Raiders 7 times, steppe_surge label at T75, no Bactria peace entry around T292).

## 5. What a headless run cannot tell

- **Real-time tactical battles.** Every battle was auto-resolved, so we cannot judge controls, readability or whether manual play changes the Susa and Ayapir outcomes.
- **An active player's use of gold.** The policy never buys, so we cannot tell whether good sinks exist but are hidden, or are missing entirely.
- **Army movement and offence.** The player never declared war or moved a stack, so offensive war, conquest, holding conquered land and player-made peace deals were not tested.
- **Diplomacy depth.** Demands were always refused and no treaties were sought, so alliances, trade and bribes were not tried.
- **Story card choices.** Only the first option was ever taken, and drawn situational cards were dismissed, so branching and balance between options were not tested.
- **UI and clarity.** Whether the player is warned before invasions or city flips, or can see tech and era progress, is not visible here.
- **Feel and readability.** The digest says nothing about map readability, hex legibility, or how 36 majors feel on screen.
- **Performance with rendering.** The headless figures (p95 347 ms) exclude drawing, animation and battle scenes, and the run stopped at T301 with 800 years still to go.
## Game 3: The Pontic tribes, seed 1002, 301 turns to 900 (ACTIVE)

# Playtest Report: Game 3, seed 1002, Pontic tribes (T1 to T301, 5000 BCE to 900 CE)

## 1. Summary

The Pontic tribes spent 67 turns on one city and peaked at 6 cities around T182-T211. From T200 they lost 5 cities in 56 turns and finished with 3 cities and 19,509 gold. The player won no battles: 5 auto-resolved sieges were lost and 3 others fell with no battle logged. The world stayed busy (18 AI wars, 21 captures), but no major died (36 alive all game), no rebellion ever succeeded, and research nearly stopped after T190.

The scripted player never declares war, moves armies or buys anything, so some of this is the policy. The digest still points to three game-side problems:

1. **The AI build logic that fills idle cities does not react to danger.** There was 1 unit until T142 and 7 units flat from T152 to T301, through three wars and five city losses.
2. **Gold has no sink or no visible use.** The treasury rose every block from 510 to 19,509, including while cities were being taken.
3. **Several city losses have no visible cause.** T213, T246 and T256 show no battle, and two of them happened with no war listed in that block.

## 2. Findings

### Critical

**C1. The idle-city build queue never builds defence, even at war.**
- Evidence (numbers):
  - Units were 1 from T2 to T141 (2 only at T42-51, the settler), and the first unit was built on T143.
  - Ahhiyawa declared war on T130 against a 1-unit empire.
  - Units rose to 7 by T152-161 and then never changed: 7 to 8 to 7 from T162 to T301.
  - That held through the Israel war (T186), three Israeli captures (T200, T213, T218) and the second Ahhiyawa war (T214).
  - Mean player production was 21.1, close to the AI median of 13.2 and the AI top-5 mean of 21.1, so the capacity existed.
- Opinion: the policy only queues "what an AI would build", so this is a finding about that AI build logic. AI empires use the same logic, so they may also be soft targets. A human who trusts the advisor or the default queue will lose cities without seeing it coming.

**C2. Gold piles up with nothing to spend it on, even during collapse.**
- Evidence (numbers):
  - Gold was 510 at T11, 2,072 at T121, 8,449 at T201 and 19,509 at T301. It rose in every single block (only T72-81 dipped, from 956 to 793).
  - In T192-T261 the player lost 5 cities while holding 8,000 to 15,000 gold.
  - The AI is no different: AI gold mean is 6,838 and there were 0 bankruptcies.
- Opinion: the policy does not buy, so I cannot say a buy option is missing. What the numbers do show is that normal play (buildings, upkeep, events) consumes almost nothing. In a war of 7-unit stacks, roughly 20,000 unused gold suggests either no meaningful sink exists or none is surfaced. Players will find money meaningless by mid-game.

### High

**H1. Some city losses have no visible cause.**
- Evidence (numbers):
  - **T213 Pharnacia:** lost to Israel with no siege logged. The 2 battles in the T212-221 block are both Cotyora (T216, T218).
  - **T246 Comana Pontica:** lost to the Khazar Empire. No Khazar war on the player appears anywhere, warsOnPlayer is 3 (Ahhiyawa twice, Israel once), and T242-251 lists no wars.
  - **T256 Amisus:** lost to Ahhiyawa while T252-261 lists no wars. The Ahhiyawa war had already dropped off by T232-241.
  - rebellionsOnPlayer is 0, so rebellion is not the cause.
- Possibilities: a peace-treaty cession (there were 13 peaces), a cultural or loyalty flip, or an undefended walk-in.
- Opinion: whatever the mechanic is, the digest does not name it. A player losing a city in peacetime with no message would call it a bug.

**H2. Research slows to a crawl after the classical era.**
- Evidence (numbers):
  - T1-T101: 20 techs. T102-T201: 10 techs. T202-T301: 4 techs.
  - The late techs took a long time each:

| Tech | Turns |
|---|---|
| feudal_levies | T182-T215, about 33 |
| feudal_charters | T215-T241, 26 |
| royal_chancery | T241-T260, 19 |
| stone_bridges | T260-T287, 27 |

- Partly expected: city count fell from 6 to 3 in this window.
- Opinion: at about one tech per 25 turns, the medieval era becomes a long stretch with nothing to unlock. With 1,400 game years still to go at T301, the cost curve looks too steep for a small empire.

**H3. Expansion starts very late.**
- Evidence (numbers):
  - firstSettlerTurn is 49 and secondCityTurn is 68, so the empire had 1 city for 67 turns.
  - It had 2 cities until T121 and 4 to 6 only from T132 on.
- Opinion: the first 60 turns are one city clicking end turn. Eight events and 9 techs land in that window, and nothing else changes.

**H4. AI wars on the player have no stated reason.**
- Evidence (numbers):
  - All three declarations read "(none)": Ahhiyawa T130, Israel T186, Ahhiyawa T214.
  - The player had refused 2 major demands and 6 tribute demands. The digest does not link those refusals to the wars.
- Opinion: a passive, peaceful player is attacked three times without a stated casus belli. The war system can feel arbitrary if the reason is never shown.

### Medium

**M1. Era goals barely register.**
- Evidence (numbers):
  - Each scored era met 1 goal with no legacy: stone (T35), bronze (T78) and classical (T153).
  - No medieval scoring had happened by T301, 148 turns after the last one.
- Opinion: if a passive builder hits exactly 1 goal every era, the goals are either trivial or unreachable. Either way they are not steering play.

**M2. Crises never touched the player.**
- Evidence (numbers):
  - steppe_surge (T85) hit 6 polities and sea_peoples (T190) hit 5. Pontus was never among them.
  - Sea Peoples firing at 500 CE is out of period.
- Opinion: in this seed the crises were notifications about someone else. They should either reach the player more often, or let the player react to them.

**M3. Event titles repeat a lot after mid-game.**
- Evidence (numbers):

| Event | Times | Turns |
|---|---|---|
| Raiders on the Frontier | 6 | T69, T171, T202, T230, T266, T292 |
| The River Rises | 5 | T63, T119, T157, T207, T252 |
| A Coastal Boom | 4 | |
| Refugees at the Border | 4 | |
| Plague in the Streets | 3 | |
| A Harsh Winter | 3 | |

  - The early game has varied, era-flavoured cards (The Wheel, The First Writing, The Tin Trade).
- Opinion: story texture thins out just as the player has the most to manage.

**M4. The calendar stalls and then leaps.**
- Evidence (numbers):
  - The year stays at -2000 for T32-T61, at -800 for T72-T101, at 500 for T152-T211 (60 turns) and at 600 to 900 in 100-year steps afterwards.
  - It jumps from -150 to 500 within one block (T142-161).
- Opinion: the year looks tied to research or era rather than turns. Frozen dates make long stretches feel stuck.

**M5. Rebellions and overextension seem to have no teeth.**
- Evidence (numbers):
  - 58 rebellions started and 0 succeeded.
  - The top AI's overextension was 264 (top-5 mean 236.4) against the player's 0.
  - conquestsKept20 was 20 against conquestsLost20 of 1.
  - majorsAlive stayed 36 for all 301 turns.
- Opinion: conquest is close to free to hold, and the map's major powers never change. That removes a source of late-game drama.

**M6. AI armies mostly sit at home.**
- Evidence (numbers):
  - aiMoveRate was 0.112 overall: 0.066 in peace and 0.701 at war.
  - Over half of stack turns (51.6%) were idle at home.
  - 4 of 18 wars had zero battles, and the median war stack was 2.
- Opinion: sieges against the player did happen, so the AI can attack. Many wars are still declarations with nothing behind them.

### Low

**L1. Turn time grows about tenfold.** Mean turn time rose from 34 ms (T2-11) to 332 ms (T282-291), with a max of 379 ms and p95 of 318. That is fine for now, but the growth tracks the turn number. With 1,400 years left, check the 2300 CE end state.

**L2. Large casualty figures on small stacks.** The T198 siege reports 7,040 men lost, set against 7-8 player units. The scale may confuse players if unit headcounts are not shown.

**L3. Monarch-style points stayed at zero.** playerAdm, playerDip and playerMil are all 0. Either the system is unused by this policy or it never accrues. It is worth confirming which.

## 3. Scorecard

| Area | Score /10 | Why |
|---|---|---|
| Core loop and fun | 3 | 67 turns on one city, then a long quiet build-up and a collapse the player had no tools to see coming |
| Pacing | 3 | Calendar freezes (T152-T211 at 500 CE), and research nearly stops after T190 |
| Economy and sinks | 2 | Gold rises every block to 19,509, and AI gold mean is 6,838 with no bankruptcies |
| Research | 4 | Steady early (20 techs by T101), only 4 techs in the last 100 turns |
| Expansion | 3 | Second city T68, peak of 6, ended at 3 |
| AI macro | 5 | 18 wars and 21 captures show activity, but 51.6% of stack turns are idle at home and no major is eliminated |
| War and battles | 3 | 0 wins and 5 losses as defender, flat army through three wars, and some captures with no battle shown |
| Diplomacy | 2 | Three wars with casus belli "(none)", demands refused with no visible follow-up, and unexplained peacetime losses |
| Events and story | 5 | A good early variety of cards, heavy repetition after T150 |
| Crises and era goals | 3 | Crises never hit the player, each era scores 1 goal with no legacy, and no medieval scoring by T301 |
| Performance | 7 | Mean 162 ms and p95 318 ms, but a tenfold rise over the game |

## 4. Top 10 fixes, ranked

1. Make the default and advisor build logic raise defenders when a neighbour is hostile or at war (T130 with 1 unit; T186-T218 with 7 units and three cities lost).
2. Add or surface gold sinks (rush-buy, levies, walls, bribes) and have the default logic use them when cities are threatened (T192-T261: 8,449 to 15,385 gold while losing 5 cities).
3. Log and explain every city transfer, whether by battle, treaty cession or flip (T213 Pharnacia with no battle; T246 Comana Pontica to an enemy with no war; T256 Amisus with no war listed).
4. Speed up early expansion and give the first settler priority (single city T1-T67, first settler T49).
5. Flatten the medieval tech cost curve or scale it to empire size (T182-T301: 4 techs, 19 to 33 turns each).
6. Require and display a casus belli for AI declarations, and tie refused demands to visible consequences (T130, T186, T214 all "(none)").
7. Rework era goals so they reward and steer play, and check why medieval scoring had not fired by T301 (T35, T78, T153: 1 goal each, no legacy).
8. Add cooldowns and late-era variants for repeating events (Raiders on the Frontier x6, The River Rises x5 from T63 to T292).
9. Make the calendar advance smoothly instead of stalling and leaping (500 CE for T152-T211; -150 to 500 within T142-T161).
10. Give rebellions and overextension real outcomes, and let weak majors die (58 rebellions with 0 successes, AI overextension 264, 36 majors alive for all 301 turns).

## 5. What a headless run cannot tell

- **Tactical battles.** Every battle was auto-resolved, so this run says nothing about the real-time layer's feel, balance or the gap between auto-resolve and manual play.
- **Player agency.** The policy never declared war, moved an army, bought units or pursued diplomacy. A human might have held Trapezus and Cotyora, so the war score reflects the defaults, not the ceiling.
- **UI and notifications.** I cannot see whether the peacetime losses (T246, T256) came with a message, a treaty screen or a warning.
- **Story choices.** Only the first option of each story card was taken, and drawn situational cards were dismissed. Branch quality, card writing and how much choices matter are untested.
- **Diplomacy screens.** I cannot judge the clarity of the demand screens, whether paying tribute would have avoided the wars, or how peace terms are presented.
- **The late game.** The run ends at 900 CE with 1,400 years left. Pacing, performance and AI behaviour in the gunpowder and modern eras are unknown.
- **Map readability and fairness of the start.** The digest cannot show whether Pontus's start position explains the slow expansion.
- **Single seed.** These findings come from one seed and one faction, so frequencies such as crisis targeting may differ on other maps.
