First line, before anything else: load the ponytail skill by printing the whole file with `cat .claude/skills/ponytail/SKILL.md` (no pipe, no head) and follow it all session. Then follow all of CLAUDE.md.

You are lane battle-truth of Terra Imperium. The lead session is session_01GqDXUs3bi3nAUtStc5mV91. It decides design calls, not the user.
Target: RTS battles (now 3, 3 and 7) grades 8 or more in the next Opus playtest.
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
- Push branch claude/battle-truth. Never merge.
- Design calls: ask the lead with send_message. If that fails, write the question under "For the lead" in your report, keep working on everything else, and end idle.
Done means:
- plans/lanes/battle-truth-REPORT.md on your branch, with one row per finding: root cause, fix, before and after evidence (numbers, traces, shots).
- Then send_message the lead a 5-line summary.

Findings to fix:
1. In every commanded battle, the player lost the whole army fast, mostly out of sight. Civ-veteran steps 92-106, 225-242 and 298-317. Warmonger steps 81-91, 243-251 and 292-293. Replay the same setups headless with battle-lab, using the fixed harness taps from r3-battle. Find out whether the cause is the AI, the deploy, order handling or the camera, then fix the root cause. When a battle starts, the camera must show the clash.
2. "Finish now" does not end the battle. Retreat failed (civ-veteran 308-317, warmonger 292-293).
3. Switching to Auto mid-battle returns the player to the map with no result screen (civ-veteran 106, warmonger 218, 273, 294, 298, 300). A city fell and the player learned it only from a truce prompt. Every battle the player is in must end on a result screen or a report.
4. The result screen showed "Yours 16,160 of 16,160" after a total loss (warmonger 92). The post-battle report said Auto would have won 100% (civ-veteran 316). Make the receipt and the counterfactual honest.
5. The unit type in the battle did not match the army (civ-veteran 308).
Keep the user's battle rule Q3: a side with bases loses only when its base buildings are gone.
