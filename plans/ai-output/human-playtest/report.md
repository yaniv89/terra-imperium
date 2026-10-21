# Human playtest: battle-commander, battles

# Playtest Report: Battle Sandbox, battle-commander persona (phone 844x390, English)

## 1. Summary

This run never reached a battle. Over 40 steps and 8 sessions (stone-field to future-sack), every session followed the same five steps:

1. Scroll the setup screen.
2. Tap Fight.
3. Tap through three tutorial tips.

The step budget then ran out, before the player pressed start, deployed a single unit or saw any combat. Fun sat flat at 3 throughout. Frustration rose from 1 to 2 when the tutorial first appeared and stayed there. There are no notes, no screenshot paths, no page errors and no harness-error lines. So nothing was caught failing, but almost nothing about battles was tested.

**The three things that matter most:**
1. **No battle was played in any of the 8 ages.** Controls, readability, tactics, powers, workers, sieges and naval are all untested. This is mainly a run-design problem (5 steps per session), but the game's pre-battle flow is what ate those steps.
2. **The tutorial appeared in every session and took 3 taps each time** (24 of 40 steps). If the game really shows it before every sandbox battle, that is a real annoyance for a returning player. If the harness wipes saved state between sessions, it is a test artifact. The diary cannot tell which.
3. **The Fight button sits below the fold** on a 390 px tall landscape phone, so every session needed a scroll before Fight could be tapped.

Note: the diary lines carry no checklist-area tag. Areas below are inferred from the player's stated focus (setup screen, deploy phase, layout and language) and from the thoughts.

## 2. Scorecard by area

| Area | Score | Why |
|---|---|---|
| Battle setup screen (age, armies, terrain, walls) | 5/10 | Fight was always found and its tap worked first time (steps 2, 7, 12 ... 37). It always needed a scroll first (steps 1, 6, 11 ... 36). The player never commented on age, army, terrain or wall options. |
| Tutorial / onboarding | 4/10 | Tips were dismissable with a consistently placed button (about 275,284). They returned in all 8 sessions at 3 taps each, and the player raised frustration to 2 at step 3 and never lowered it. |
| Deploy phase | not reached | Thoughts say "to see the deploy screen" (steps 13, 18, 28, 33, 38), but no deploy action was ever taken. Whether the deploy screen was visible under the tips is unclear. |
| Layout on this screen and language | 5/10 | No complaints about text, clipping or language. The only layout signal is Fight being below the fold on 844x390. The judgement is thin. |
| Battle start / speed controls | not reached | Start was never pressed. |
| Unit selection, movement, focus fire, flanking | not reached | |
| Battle economy (workers, buildings) | not reached | |
| Powers | not reached | |
| Sieges and walls | not reached | bronze-walls and modern-walls never got past the tips. |
| Naval | not reached | classical-naval and information-naval never got past the tips. |
| Sack battles | not reached | kingdoms-sack and future-sack never got past the tips. |
| Battle end / results | not reached | |

## 3. Scorecard by age

None of the eight sessions could be scored, because no session got past the tutorial.

| Session | Age and kind | Score | Started? | Played to end / winner | Why |
|---|---|---|---|---|---|
| stone-field | Stone, open field | n/a | Unclear: Fight tapped (step 2), start never pressed | No / none | Steps 1 to 5: scroll, Fight, three tips. |
| bronze-walls | Bronze, walled | n/a | Unclear (step 7) | No / none | Same pattern, steps 6 to 10. Walls never seen in play. |
| classical-naval | Classical, naval | n/a | Unclear (step 12) | No / none | Steps 11 to 15. No ships moved. |
| kingdoms-sack | Kingdoms, sack defense | n/a | Unclear (step 17) | No / none | Steps 16 to 20. |
| gunpowder-field | Gunpowder, open field | n/a | Unclear (step 22) | No / none | Steps 21 to 25. |
| modern-walls | Modern, walled assault | n/a | Unclear (step 27) | No / none | Steps 26 to 30. |
| information-naval | Information, naval | n/a | Unclear (step 32) | No / none | Steps 31 to 35. |
| future-sack | Future, sack defense | n/a | Unclear (step 37) | No / none | Steps 36 to 40. |

"Started" is unclear in every session. Tapping Fight evidently opened a tutorial (the following taps treat it that way), but each session's last thought is "then start the battle", and no further step followed. The battle may have been sitting in deploy or running in real time behind the tips. The diary does not say.

## 4. Fun curve

- **Fun:** 3 on every step, 1 to 40. There was no peak and no dip, because nothing that could be fun or unfun (combat, tactics, powers) ever happened.
- **Frustration:**
  - 1 on steps 1 and 2, the first scroll and Fight tap.
  - 2 from step 3, the first tutorial tip, through step 40.
  - The rise lines up exactly with the tutorial. It never fell again because every new session began with the same scroll-and-tips routine (steps 6, 11, 16, 21, 26, 31, 36).
  - Step 6 ("Setup screen is showing again") is the first sign of the repetition registering.
- **Reading:** this is a flat line of a player waiting to start, not a judgement of the battle game. The low-grade frustration comes from friction before play, not from play.

## 5. Top issues (ranked by harm to a real player)

No screenshot paths were recorded (the notes are empty), so none can be cited.

1. **The tutorial appears before every battle.**
   - **What happened:** three tip taps at steps 3 to 5, 8 to 10, 13 to 15, 18 to 20, 23 to 25, 28 to 30, 33 to 35 and 38 to 40.
   - **Harm:** for a player who has already seen the tips, this is pure friction before every sandbox fight. It is unclear whether the game or the harness (fresh state per session) caused the repeat.
   - **Fix:** remember that the tips have been seen, and add a "Skip all" or "Don't show again" option on the first tip.
2. **The pre-battle flow costs about 5 inputs before any command.**
   - **What happened:** scroll, Fight, three tips, and still not started (every session).
   - **Harm:** RTS players expect one or two taps from setup to the field.
   - **Fix:**
     - Keep Fight visible (see issue 3).
     - Fold the tips into the deploy screen as non-blocking hints.
     - Make "start the battle" reachable without first clearing a modal.
3. **The Fight button is below the fold on an 844x390 landscape phone.**
   - **What happened:** a scroll was needed at steps 1, 6, 11, 16, 21, 26, 31 and 36.
   - **Fix:** use a sticky Fight button anchored bottom-right of the setup screen.
4. **The tips may cover the deploy screen.**
   - **What happened:** the player repeatedly dismissed tips "to see the deploy screen" (steps 8, 13, 18, 28, 33, 38).
   - **Harm:** if the battle clock runs behind the tips, that would cost real time. The diary does not show this, so it is unconfirmed.
   - **Fix:** pause the battle while any tip is open, and dim rather than hide the map.

## 6. Bugs

No confirmed bugs: the harness caught no page errors and logged no harness-error lines. Suspected issues to check:

1. **The tutorial does not stay dismissed (suspected).**
   1. Open the battle sandbox.
   2. Scroll down the setup screen and tap Fight.
   3. Tap through the three tips (at about 275,284, the last one at about 273,284).
   4. Return to setup, pick another age or battle type, scroll and tap Fight.
   5. Expected: no tips. Seen: the same three tips again (steps 8 to 10 onward).
   6. Confirm first whether the harness resets local storage between sessions.
2. **Fight is not visible without scrolling at 844x390 (layout issue).**
   1. Open the battle sandbox on an 844x390 landscape viewport.
   2. Expected: Fight visible. Seen: a drag from y=330 to y=80 was needed before tapping Fight at about (421,318).
   3. This happens for every age (steps 1, 6, 11 and so on).

## 7. What was fun, and what else was good

- Nothing in the diary was fun beyond a neutral 3. No gameplay happened.
- What worked:
  - Fight responded to the first tap in all 8 sessions. There were no missed taps or retries.
  - The tutorial's Next/Close button stayed in the same spot every time, which made it fast to clear.
  - The setup screen loaded and reset cleanly for all 8 age and battle-type combinations, with no errors, blank screens or harness failures.
  - There were no language or text complaints on the English build.

## 8. Coverage

| Status | Areas and ages |
|---|---|
| Played | Battle setup screen, only to the extent of scrolling and tapping Fight. The tutorial tips. |
| Glanced at | Deploy phase (possibly visible behind the tips, never touched). Layout and language (no issues raised, but little was examined). |
| Missed | Every age's actual battle: deploying, starting, unit control, focus fire and flanking, battle speed, workers and buildings, powers, walls and siege, naval combat, sack defense, battle end and results. |
| Ages | All 8 were opened. None was played. |

**What the next run should aim at:**
- **Steps per session:** give each session far more steps (at least 25 to 30), or run 2 to 3 ages instead of 8.
- **Tutorial:** pre-dismiss it or use a saved profile, so steps go into play rather than tips. Keep one session with the tutorial on to judge onboarding once.
- **Priority order:**
  1. Deploy and start one open-field battle (e.g. gunpowder-field) and play it to the end.
  2. One walled siege (bronze-walls or modern-walls).
  3. One naval battle.
  4. Exercise powers, workers and the speed control in each.
- **Notes:** have the model record notes with screenshot paths for anything it judges. This run produced none.

---
40 steps, play $0.30 (claude-sonnet-5-5) + report $0.11 (claude-opus-5-5) = $0.41. Diary: `diary.jsonl`, noted screens: `shots/`.
