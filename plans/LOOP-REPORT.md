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
