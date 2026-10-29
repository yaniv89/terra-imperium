First line, before anything else: load the ponytail skill by printing the whole file with `cat .claude/skills/ponytail/SKILL.md` (no pipe, no head) and follow it all session. Then follow all of CLAUDE.md.

You are lane odds-truth of Terra Imperium. The lead session is session_01GqDXUs3bi3nAUtStc5mV91. It decides design calls, not the user.
Target: Wars and AI, and the battle forecasts (wars 4 and 5) grades 8 or more in the next Opus playtest.
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
- Push branch claude/odds-truth. Never merge.
- Design calls: ask the lead with send_message. If that fails, write the question under "For the lead" in your report, keep working on everything else, and end idle.
Done means:
- plans/lanes/odds-truth-REPORT.md on your branch, with one row per finding: root cause, fix, before and after evidence (numbers, traces, shots).
- Then send_message the lead a 5-line summary.

Findings to fix:
1. Forecasts conflict:
   - Zafar showed 11,920-17,880 defenders and "Likely win", then 44,900 in the battle report, then 294,900 and "Hopeless" two turns later (civ-veteran 130, 132, 297, 314, 331).
   - Jerusalem with 3,000 militia showed "Auto holds 100%" against 33,340. The next turn it showed "0% Hopeless, Numbers x0.10" against 30,220.
   - Warmonger 271 vs 296: "holds 100%" against 77,600, then 0% against a similar threat.
   The march preview, the pre-battle card, the battle report and Auto must read the same forces (battleInputs.js, battleOdds.js, autoBattle.js, marchOddsText). Explain jumps on the card (walls broke, reinforcements arrived), using the r3-campaign wall wording.
2. Enemy armies were huge with no reason shown. Show where the numbers come from (allies, standby, levy).
3. The war felt passive (warmonger 219). Check with balance-sim how often the AI attacks the player once at war. Propose a fix to the lead before building it.
Add a test that the preview and Auto read the same strength on the same state.
