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
