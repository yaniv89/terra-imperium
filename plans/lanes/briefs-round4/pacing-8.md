First line, before anything else: load the ponytail skill by printing the whole file with `cat .claude/skills/ponytail/SKILL.md` (no pipe, no head) and follow it all session. Then follow all of CLAUDE.md.

You are lane pacing-8 of Terra Imperium. The lead session is session_01GqDXUs3bi3nAUtStc5mV91. It decides design calls, not the user.
Target: Pacing and fun (now 7, 5 and 4), economy (6 and 7) grades 8 or more in the next Opus playtest.
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
- Push branch claude/pacing-8. Never merge.
- Design calls: ask the lead with send_message. If that fails, write the question under "For the lead" in your report, keep working on everything else, and end idle.
Done means:
- plans/lanes/pacing-8-REPORT.md on your branch, with one row per finding: root cause, fix, before and after evidence (numbers, traces, shots).
- Then send_message the lead a 5-line summary.

Findings to fix:
1. The late game is only End Turn plus event cards (civ-veteran 390-417, warmonger 310-328: "advisor fills queue, end turn"). Research how Civ VI/VII, Humankind, Old World and EU4 keep their late game busy, then propose 1-2 small engine changes to the lead before building them, for example late-age goals, a late crisis or a rival's late push. Prove the fix with balance-sim (decisions a turn in late ages, before vs after).
2. The early game is slow to reach action:
   - War costs 300 gold at +1 income (civ-veteran 64-70).
   - After a loss, one archer took 24 turns, or 539 gold at +17 a turn, and the advisor still picked it (127).
   - Have the advisor warn about or skip builds of 20 turns or more. Check the early war price with balance-sim.
3. New cities are Outposts for up to 29 turns with no warning (civ-veteran 109, 185-187, warmonger 181). Tell the player when founding, and show "builds in N turns" on the city.
4. Buy prices jumped with no reason (the Frigate fell from 1,122 to 929, 271). A Bank cost 2,324 against +303 income. A Harbor at 149/144 production still said 6 turns (264).
5. The queue dropdown opened empty (civ-veteran 46, 260; warmonger 145-146). Idle-city prompts repeat every turn until Always is found.
