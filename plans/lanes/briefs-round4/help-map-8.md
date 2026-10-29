First line, before anything else: load the ponytail skill by printing the whole file with `cat .claude/skills/ponytail/SKILL.md` (no pipe, no head) and follow it all session. Then follow all of CLAUDE.md.

You are lane help-map-8 of Terra Imperium. The lead session is session_01GqDXUs3bi3nAUtStc5mV91. It decides design calls, not the user.
Target: Glossary and help (now 7, 8 and 3), map (6, 6 and 5), units and armies (5, 6 and 6) grades 8 or more in the next Opus playtest.
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
- Push branch claude/help-map-8. Never merge.
- Design calls: ask the lead with send_message. If that fails, write the question under "For the lead" in your report, keep working on everything else, and end idle.
Done means:
- plans/lanes/help-map-8-REPORT.md on your branch, with one row per finding: root cause, fix, before and after evidence (numbers, traces, shots).
- Then send_message the lead a 5-line summary.

Findings to fix:
1. Long-pressing Research for help just opened the panel (warmonger 42). Tech names in the research panel do not link to the glossary (civ-veteran 156-158). Make hold-for-help work on every rail button and on tech names. Make it discoverable with a one-line hint on first open.
2. The camera jumps away after confirming a march (civ-veteran 198, warmonger 159). Target labels hide behind the march banner (warmonger 157, 276-277).
3. March is greyed out after a landing, with no reason shown (warmonger 127). Every disabled army button says why.
4. Double tap only zoomed. It is unclear that a close view exists (civ-veteran 39-40). Make the close view discoverable on a phone.
5. A full-screen banner X needed a second tap (civ-veteran 141-143). The autosave toast covers prompts (warmonger 108).
6. Diplomacy: the Declare war text was stale (civ-veteran 357). Check whether the r3-campaign bubbles cover civ-veteran 23, 63, 65 and 288, and fix what is left.
