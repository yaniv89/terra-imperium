First line, before anything else: load the ponytail skill by printing the whole file with `cat .claude/skills/ponytail/SKILL.md` (no pipe, no head) and follow it all session. Then follow all of CLAUDE.md.

You are lane naval-9 of Terra Imperium. The lead session is session_01GqDXUs3bi3nAUtStc5mV91. It decides design calls, not the user.
Target: Naval (now 2, 6 and 6) grades 8 or more in the next Opus playtest.
Source: the round 3b Opus playtests. Read plans/ai-output/human-playtest/report.md, diary.jsonl and shots/ on these branches:
- origin/ai/human-playtest-40746164607 (civ-veteran, 418 steps)
- origin/ai/human-playtest-40746170250 (warmonger, 329 steps)
- origin/ai/human-playtest-40746174323 (newcomer-phone, 255 steps)
Those runs played build a0312e08, before the r3-campaign, r3-battle (harness tap fix), lead-battle-fixes and lead-ui-fixes lanes merged. Read plans/lanes/r3-campaign-REPORT.md and r3-battle-REPORT.md first. Then check every finding below on current claude/integration (headless or a real browser) before fixing it. Skip what is already fixed and give the evidence.
Rules:
- No API dispatch.
- Run targeted tests only (`npm run test:related -- <files>`). Lint must show zero warnings.
- For UI changes, run mobile-check: 844x390 and 1600x900 shots, en and he.
- Engine changes follow the add-mechanic skill and the engine rules in CLAUDE.md. Battle sim changes follow battle-lab (parity, and a SETUP_VERSION bump if setups change).
- Kill only your own PIDs.
- Push branch claude/naval-9. Never merge.
- Design calls: ask the lead with send_message. If that fails, write the question under "For the lead" in your report, keep working on everything else, and end idle.
Done means:
- plans/lanes/naval-9-REPORT.md on your branch, with one row per finding: root cause, fix, before and after evidence (numbers, traces, shots).
- Then send_message the lead a 5-line summary.

Findings to fix:
1. It took until step 145 to find a city that could build ships (civ-veteran). Make ship building discoverable: which cities can build ships and why not, an advisor hint, a Ships filter.
2. A Frigate was bought (273) but never sailed or fought. Make the first ship's next step obvious: a prompt, a sea target, a naval battle against a pirate or an enemy fleet. No player saw naval combat.
3. It was unclear whether a marching army boards a ship by itself (warmonger 198-201). Open ocean was locked with little explanation (118).
4. Check that sea battles (pendingDefenses kind 'sea', fleets.js) actually happen to the player in a 150-turn balance-sim game. Report the count.
