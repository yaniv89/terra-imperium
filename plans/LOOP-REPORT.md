# Improvement loop report

Dashboard: https://claude.ai/artifact/VCNKVfR3h4rvGmuC5i3SXD (datasets findings, scores, rounds, spend: JSON files uploaded as assets; source copies in the lead scratchpad loopdash/). Update it at every event: a lane finishes, a merge lands, a playtest returns, spend changes.
Started 27 Oct by the user's /loop request (production polish of gameplay, AI, visuals, UX, speed).
Rules kept: the lead (manager) gives the yes for design changes (user, 27 Oct) and records each call here; merges go to
API budget: $90 in total (user, 27 Oct). Spend so far is the sum of the dashboard spend rows; caps count until a run reports its real cost.
claude/integration, main gets the push once the quick suite and CI are green.

## Round 1 (27 Oct)
- Started: 4 AI playtests on today's game (civ-veteran desktop campaign with age slices, warmonger
  campaign, newcomer phone campaign, battle-commander battles in 4 ages) to set a new baseline.
- Lane: finish the crisis branch (log years, famine compare, checks, phone card check).
- Lane: speed, turn time and map frame time with identical game results.
- Merged: speed lane 1 (AI war declarations about 45% faster, sight about 25%, identical state hashes).
- Sub sessions started 18:06 (each pushes its branch and writes plans/lanes/<name>-REPORT.md):
  perf-loop-2 session_01S3hKeJAvNcwRMQhCHxbxdb; ai-gold-balance session_01S3hKeG4sgPUDEKd7cPAcEH;
  battle-feedback session_01S3hKeFiy6zNSYf1PXRmoFT; phone-pass session_01S3hKeHH6QsPTedrmMPkuVP.
  battle-stall session_01S3hKeJKGQw7jmvkQvMgdeD.
- Design calls by the lead (27 Oct, user made the lead the manager):
  - Follow-up 19 "gold piles up": approved gold sinks and cost or reward changes inside the
    ai-gold-balance lane, because idle gold removes decisions for both the AI and the player.
  - Follow-up 4 "Information parity gaps": approved an Auto retune in the battle-stall lane if the
    field 5 vs 2 rows stay out of the guardrail, because Auto must match Command to be honest.
  - battle-feedback may add a sim order to attack buildings (orderSchema row, SETUP_VERSION bump),
    because players cannot attack walls today and Q3 makes buildings the win condition.
  - All lanes keep Q3, a city falls only when its defence is beaten, units keep their age.
- API grants (user, 27 Oct): sub sessions may ask the lead for API budget; the lead grants a cap within the
  $90 total and records it in the dashboard spend data. Spend so far about $38 (caps for running jobs).
- Design call (27 Oct, after the user's question): the battle-stall fix's 60 s march-out is too short for
  economy battles (it skips the build phase). Rework sent to battle-stall: about 3 minutes of grace,
  early march only when 1.5x stronger, a fallback at about a third of the clock, the AI builds while it
  waits. References: AoE II attack waves by army size and treaty mode, StarCraft rush cost. main keeps
  the old behaviour until the rework is measured.
- Sub sessions started 18:42 (from the lowest playtest scores): map-clarity session_01S3hKeK7JN4YccSps9QkYym
  (Map 4.8, Economy 4.7); playtest-saves session_01S3hKeFLgfVcScfjZZN8Hh4 (RTS, naval "not reached");
  campaign-ai-wars session_01S3hKeG1EPz8RAPY9Xsqn3n (Wars and AI 2.0); turn-pacing
  session_01S3hKeG5pV6nJKZHb7FzPbX (Fun 3.1, Help 3.5).
- battle-stall merged into integration locally (review: no findings); push waits on test:quick; main
  waits on the grace rework.
- Sub sessions started 19:04: tech-depth session_01S3hKeJ43dWiNRDrVDT79Ba (Tech 5-6); diplomacy-depth
  session_01S3hKeGb9LhXRYf9yuZ2uPA (Diplomacy 3-5, no peaceful approach); naval-campaign
  session_01S3hKeJM2aN5B3eXvzye2Fr (naval never reached); i18n-sweep session_01S3hKeGCDD7j6R5QE9AYmu9 (Hebrew 5).
- Merged: crisis branch (early answer, famine once at the Granary, log years en/he) plus a fix from its review
  (an unaffordable early choice reopens the card). Integration green (4035 tests).
- Round 1 campaign playtests: newcomer-phone $1.25, warmonger $2.38 (real). Fun 3 in both; worst: army
  orders hidden on phone, at war 90 turns with no contact, production loop. Each sent to its lane.
- Plan: when the lanes are merged, round 2 = full retest (campaign personas with the new era saves, battle
  commander) and new grades on the dashboard.
- Sub session started 19:24: art-animation session_01S3hKeGseHCpBTmPVFxYE1T (user: criticise the art and
  animations too): reviewer-style scores per area (map, units, animations, VFX, transitions) against AoE IV,
  Total War, Northgard and Civ VI, then fixes in code and Blender, re-scored on the same shots.
- Round 2 retest adds art and animation rows to the grades (from this lane's rubric plus the battle playtest).
- Merged 19:55: turn-pacing (production advisor, quieter turn report, closest-goal chip, 3-card tutorial),
  playtest-saves (era saves from real play), map-clarity (supply along the march, log sources, map fixes).
  Review: no findings. Lint clean, test:quick 4061 passed. civ-veteran playtest real cost $3.25 (spend $34.03).
- send_message allowed in .claude/settings.json (user, 27 Oct) so lanes report without a prompt.
- Sub sessions started 20:09: city-builds session_01S3hKeFjWbrkqj8haEnXNUz (builds 18-51 turns, Cities 3-6);
  battle-ai-tactics session_01S3hKeHk2QRgBieK44CSY78 (counters, focus fire, flanks; mirror match vs old AI).
- Lead mistake (20:40): cloud lanes had no ponytail plugin and the art lane had no Blender; neither was checked
  before the briefs. Fixed: ponytail vendored in .claude/skills/ponytail, scripts/blender/install.sh (Blender 4.0.2
  headless, tested), all 10 running lanes told to load it; the art lane told to install Blender and fix assets.
- 28 Oct 05:50: merged battle-feedback, ai-gold-balance, campaign-ai-wars (+ war test fix), diplomacy-depth
  (+ gift fade by speedTurns), naval-campaign, i18n-sweep, battle-ai-tactics (SETUP_VERSION 28, new AI wins
  243/520 vs old 161), audio (mix, limiter), art-animation (side rims, sail colours, corpse angles, rank hit flash,
  Blender crest; scores melee 3->7, sea 3->7, unit size 4->6, deaths 4->6, hit 3->5). Reviews: no findings left.
  Full vitest (slow files included): 4679 passed. Ponytail: every cloud lane before 27 Oct 20:45 ran without it
  (plugin missing); now vendored + session start hook; city-builds and phone-pass replaced by fresh sessions
  (hook and full read confirmed in transcripts).
- Round 2 (28 Oct 07:35): retest dispatched on integration, same 4 personas as round 1 for a fair compare,
  with the era saves; caps $15 (spend with caps $49.03 of $90). Plan: new grades, then a lane per area below 8.
- Target (user, 28 Oct): every area at 8/10 or more; each area below 8 after round 2 gets its own lane.
- Round 2 adds two Opus playtests with full coverage (user: "cover it all"): civ-veteran campaign over all 8 ages
  (400 steps, cap $11) and battle-commander over every age (320 steps, cap $9). Spend with caps $69.03 of $90.
- Round 2 results (3 of 6, 08:40): grades barely moved (newcomer: Units 3, Wars 2, Fun 3, Glossary 3; civ veteran:
  Gold 3, Naval 3, Fun 3; battles 4-7, gunpowder field 1). Critical: gunpowder field battles never engage, lost
  battles cannot be ended. Lesson: lanes fixed what earlier playtests named, but the next playtest finds the next
  layer; only a retest proves a grade. Five lanes started 08:42: battle-engage session_01S3hKeHj5rji3KbwDmD1SZs,
  battle-touch session_01S3hKeGMJPicF3ohf5ZWqnJ, gold-sinks session_01S3hKeJ4vxmpksQdZvP4Hsg, newcomer-flow
  session_01S3hKeGsvQ56fHfNHdvLCTM, battle-odds session_01S3hKeJH1jTbRuQwHYLS21e. Real costs 1.85, 2.21, 1.88.
- Final deliverable (user, 28 Oct): when the loop ends (every area 8+ or the budget stops it), a very extensive,
  detailed report of everything done and the current status of every area, with screenshots and explanations
  (published as an artifact; before/after shots from the playtests and lanes, grades per round, what is left).

### 28 Oct 12:20: auto-assault merged; four more lanes
- Design call (lead): Auto under-rated even walled assaults (Auto 13/32 and 2/32 against Command 31/32 and 29/32; the same on f60660b8, an old gap). Cause: resolveBattle ended the battle when the attacker's regiments broke, though its trained auxiliaries kept storming in real time (rule Q3). Fix: on a walled assault the auxiliaries hold the line (`holdsLine`, battle.js ownLeft, only autoBattle sets it) and AUX_TRAINED.assault [22, 5]. Evidence: parityEco N=32 18/18 IN, even assaults now 28/32 and 26/32 on Auto (Command 31 and 29: Auto a little below Command, as in Total War), field and town rows identical; robot garrisons 6/6 IN. Lead approved the one line outside the lane.
- Lanes started 12:08, ponytail verified by transcript (start hook): wars-8 (wars, AI, armies, diplomacy), tech-help-8 (tech, glossary), cities-8 (cities, builds, settlers), battle-hud-8 (deploy, camera, economy HUD, powers). Earlier at 10:48: map-8, naval-8, events-8, art-2, audio-2 (all verified).
- Live site: f60660b8 deployed 11:06. cece290d (battle-engage, battle-touch, battle-odds, newcomer-flow) is CI green and waits for the user's go to push main.

### 28 Oct 13:20: design call, AI war roll on a weak neighbour player (wars-8)
- Evidence: a player who starts no war meets a major's war in 1 of 4 games by turn 200 (worldStats seeds 11-14); two of four round 2 testers found no fight; Wars and AI 3.3-4/10. AI-AI wars are healthy (25-31 sieges, 9-16 captures a game).
- Research: Civ VI and Old World AIs target the weaker neighbour; EU4 and Humankind warn before a forced peace.
- Decision: yes to a 1.5x war roll by a bordering Tier-1 major that outnumbers the player, not before speedTurns(40), not under a truce or a met demand, through declareWar (explore mode blocks it), with the warning shown first. Target: 2-3 of 4 games see a major's war on the player; passive-player defeats no higher than base, else 1.25x. Idle 2-unit stacks (arm before declaring) left for a later lane.

### 28 Oct 14:20: the user's go for main
- User: "u have my go to push when all sessions done and ready for main". Plan: when wars-8, perf-8 and events-8 (held back: passive world reaches the Future goal before the turn limit) are merged, reviewed and tested, and integration CI is green, push integration to main once (deploys the 18-lane wave).

### 28 Oct 16:50: final five lanes merged (integration 0cc85a67)
- Merged: events-8 (Congress gold fix: compounding +5%/+3% from the Age of Kingdoms made a passive world reach the Future goal early), wars-8 (war roll lowered 1.5 to 1.25x: 1.5x let Gojoseon finish the Future at turn 776 of 923 in the passive run), perf-8 (End Turn page JS -23% at phone speed, boot JS 4.5 to 2.3 s, longest boot task 3.2 to 0.9 s, game results unchanged), battle-ai-2 (gunpowder and sea AI, SETUP_VERSION 30), raids-march (raids weigh the militia, March order odds warning). Full suite 4,787 passed (pack-map-models flake only). Engine review: one break (raid aftermath window not in speedTurns), fixed in 0cc85a67.
- Lead answers: perf-8 Concede on an empty field already exists (battle-engage "Finish now" and Auto); pausing the clock during timed prompts at 3x is a yes, small follow-up. battle-ai-2 Prince cavalry flanking yes; wind and broadside rules only if sea battles grade under 8; walled mirror assaults 88% attacker is a balance finding. raids-march: an unguarded town stays raidable (the player's choice), the set-out warning may come from the fog (scouts' report).
- New lane: ai-armies (idle 2-unit war stacks, 228k-342k garrisons, arm before declaring).
- Process fix after a lost wakeup (90 idle minutes): hourly create_trigger heartbeat plus send_later check-ins, plan in the task list.

### 28 Oct 21:20: round 3b grades in; round 4 planned, on hold for the user
- Opus full-length runs on a0312e08: newcomer 255 steps $5.28, civ-veteran 418 steps $9.01, warmonger 329 steps $6.78 (October $85.57 of $90).
- Averages: start 8.0 and save 8.3. Everything else is 4.3 to 7.0. RTS battles, tech and naval are the lowest.
- The worst finding, shared by all three runs: commanded battles wiped out out of sight, and the forecasts conflicted.
- Several findings predate r3-campaign and r3-battle, which fixed them.
- Five round 4 lanes were planned: battle-truth, odds-truth, pacing-8, naval-9 and help-map-8. Briefs are in plans/lanes/briefs-round4/.
- ai-armies got the answer "option (a)". All of them were interrupted on the user's order ("make plans, wait for my go").
- Integration 460a7f94 has green CI. Main is still at 0cc85a67. Details: plans/HANDOFF-2026-10-29.md.

### 29 Oct: round 4 lanes started (user's go)
- User: "start lanes and make sure theyre all using /ponytail". Started as local worktree sessions from the PC lead (no cloud tools here): battle-truth local_54e9f7b4, odds-truth local_b3f58d78, pacing-8 local_1e8840c9, naval-9 local_0b1b947b, help-map-8 local_6661810c (all from claude/integration af3ee70e), ai-armies local_c06bfad0 (from claude/ai-armies, building option (a)).
- Every brief's first line invokes the ponytail skill (fallback: cat the vendored SKILL.md); the lead checks each transcript. Lanes push HEAD:claude/<lane>, report by ending their turn (no send_message locally), node_modules as a junction.
- Design call (lead, ai-armies round 4): accept AI wars 7.13 a game against the 7.5 target. Evidence: 8 seeds, diff +1.13 with 95% CI [-1.04, 3.29], target inside the CI, the base 8.38 also not significantly different; idle stacks 18% (target 20% met). No extra knob (option b or ARM_SLACK 3): a gap inside the noise does not justify more rules. Recheck in the next grade round (Wars and AI grade) and a 42-seed run if the grade stays under 8.
- Design call (lead, naval-9 finding 4): yes to pirate fleets, no to AI fleets hunting. Evidence: navalTrace 8 games x 150 turns, 3 player sea battles (all landings), 0 fleet battles anywhere; AI ships sail only at war. Reference: Civ VI barbarian galleys, EU4 pirates. Rules: Bronze age+, one weak raider per port at most once per N reference turns (speedTurns), never in Explore, blockade through tradeDisruptions.js, AI majors get them too. Target: 1+ player sea battle a game by turn 150 for a ship-building coastal player.
- Manual playtest 29 Oct (session local_914e57a4, af3ee70e, 60 turns Fast): findings routed per lane in plans/playtests/manual-2026-10-29.md and sent to battle-truth, odds-truth, pacing-8, naval-9 (landing contradiction), help-map-8. New lane polish-8 proposed for text, names, buy confirm and a manual save slot. Design call: warn (not block) before a walled assault without siege engines.
- Design call (lead, odds-truth Q1): Auto fights with the same standby troops (within 410 km) as a commanded battle, both sides, via battleInputs.js. Evidence: Zafar (civ-veteran 297/314/316) showed three force counts for one state; Total War auto-resolve counts reinforcements in range. Check: battle-lab autoCalib and parityEco before/after.
- Design call (lead, odds-truth Q2): P1 yes (turn-report line for each enemy stack marching on a player city, Show on map). P2 yes after ai-armies merges: war plan keeps its target while the strike is on the road; muster within supply reach. Evidence: era saves show 7-8 turn gaps with no enemy near, gunpowder stacks arriving at 0 supply (343-515 of 1000).
- Design call (lead, pacing-8 Q1): build both chained late-age era goals (Old World ambitions) and one late crisis per age that may pick the player (Civ VII). Evidence: storyPulse seed 11, the last three ages are 53% of turns with 0.17-0.24 cards a turn, no crisis or raid reaches the player.
- Design call (lead, pacing-8 Q2): unjustified war price = 150 x unitCostMult of the payer's age. Evidence: warPrice.sim, a flat 300 is 34-38 turns of income in the Stone Age and 2-3 turns in Kingdoms.
- User (29 Oct): playtests run through Claude sessions, not the API; art fixes that need Blender wait for the user to open Blender MCP. Plan updated (KTD3-KTD5, U2, U3, U14). polish-8 calls answered: name pools accepted, settle card shows the founding name, fix "The" mid-sentence in UI strings, merge integration first.
- Lead calls (29 Oct, afternoon): ai-armies widens the Future-age margin on its branch (one research-cost knob, proof over seeds 1-8); pacing-8 builds the event card gap with each age's dawn card exempt (Fast: Stone 0.73 to 0.45 cards a turn, Kingdoms repeats 7 to 3); era goal targets go to wave 5 U8; polish-8 makes longRun accept the passive player's defeat as a normal end instead of a third seed swap.
- Merged 29 Oct: odds-truth and battle-truth (e740515a), help-map-8, polish-8 and naval-9 (a77d0136). Engine reviews: no findings on any. Quick tests: the failures pass alone (load flakes: sight, stoneAI, battleLoop, sim, economy, buildingAttack, claudeJob; challengeFiles is Windows only).
- Lead calls: battle-hud-9 F99 alerts last 8 real seconds at every speed, no pause (a pause every ~20 s of fighting would break flow); map-art-8 figure scale 0.55 on a city hex, 0.85 alone, scouts 0.7 and 30 men through menOf; odds-truth P2 waits for ai-armies; scout models wait on the user's Blender.
- Merged pacing-8 (review: no findings; one import conflict in cityBuildModel.js fixed). Quick-test failures pass alone.
- Lead calls: ai-armies raises fast.costMult.future (about 1.6-2) so passive Fast seeds end on turnLimit; sieges-sea-8 builds option A for walled mirror assaults (defender keeps laborers and soldiers inside the ring, city stores keep it training), with autoCalib retune allowed. Fun brainstorm stopped at the user's request (no artifact).
- Merged tech-tree-8, map-art-8, sound-hebrew-8, answers-8 (reviews: no findings; PanelDrawer conflict resolved). Quick tests: only the known load flakes.
- Merged ai-armies (Future cost Normal 36000, Fast x1.6; ages.test updated) and map-speed-8 (plus a catch so a failed shader compile still draws). Quick tests: only challengeFiles (Windows).
- Scout models: 8 ages built in the user's Blender (scripts/blender/build_scouts.py; bronze, modern and future from infantry because their support is a vehicle), map draws them for a scout party, settlerModels.test checks each loads.
- Merged battle-hud-9 (review clean; Invade card on phones fixed). Scout models packed (3 MB to 1 MB). Note: scripts/ui/hebrew-audit.mjs and map-camera-shots.mjs click battle-go once and stop at the new hopeless-odds confirm.
- Merged odds-truth P2 (review clean; plans keep their target while it is the enemy's, supplied routes only, replan after 3 reference turns without progress; AI wars 7.00). Follow-up: ROUTE_RETRY_TURNS (aiOperations.js, 7 uses) is a fixed 3 turns, not speedTurns; changing it needs its own balance run.
- Lead calls: sieges-sea-8 Siwa option (a), the walled hall trains only while the city's garrison holds a regiment (walled mirror now 18-21 of 32, was 32 of 32). battle-skill-8: same rules both sides (AI squads no longer rout and rally, they fight Shaken like the player's; Shaken softened to 0.85/1.1); save mapping Settler/Chieftain Easy, Prince Normal, King/Emperor Hard; horse rear charge on foot left for later. User: the camera stays where the player puts it (no auto follow or jumps).
- User go (29 Oct): push claude/integration to main once the four running lanes (sieges-sea-8, battle-skill-8, early-pace-8, battle-art-8) are merged and integration CI is green.
- battle-skill-8 call: accept Normal without the AI cavalry reserve (novice 29%, skilled 79%, Hard novice 6% skilled 43%); beginners winning sometimes beats capping skilled at 70%. Integration CI c0d08286 green.
- Merged sieges-sea-8 (review clean; walled mirror 18-21 of 32, SETUP_VERSION 33). battle-skill-8 to merge it in, set SETUP_VERSION 34, rerun walled parity with no-rout; early-pace-8 to route FUND_RESEARCH through costs.js.
- Merged early-pace-8 (FUND_RESEARCH via costs.js) and battle-art-8 (buildings block movement, camera only on player actions, roof fade off, SETUP_VERSION 35). battle-skill-8 next: retune Auto to no-rout, take SETUP_VERSION 36.
