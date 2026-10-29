# Lane battle-hud-9: report (plan U5, wave 5)

Ponytail loaded first (Skill `ponytail:ponytail`, the whole SKILL.md printed; the session start hook also printed PONYTAIL MODE ACTIVE).
Local worktree session, branch `claude/battle-hud-9` from claude/integration b25b72a4. No API use. No sim, renderer,
autoBattle.js or engine file changed; battleLoop.js untouched (F99 is solved in the HUD, see row 4), so no replay or parity rerun.

## For the lead

1. **F99 design call (asked by message, no answer yet).** The only timed prompts left in a battle are the HUD alerts (Go, Rally);
   "Attack it" already stays until tapped (battle-truth). They fire often (troops hit every 20 s, squad lost, shaken, reinforcements,
   enemy built). Pausing the sim until each is answered would freeze the battle every ~20 s of fighting. **Built (B):** an alert stays
   8 real seconds at every speed (was 8 battle seconds: 2.7 s at 3x). If you want the literal pause (C: the sim stops until Go or close),
   it is a change in TacticalBattleScreen.jsx (pause while `shownAlerts` is not empty), not in battleLoop.js; say so and a lane adds it.
2. **Phone bug found, not mine to fix (RegionInfoModal.jsx):** at 844x390, "Invade <city>" in the city sheet closes the sheet and the
   pre-battle card never shows (desktop 1600x900 opens it). Validation is ok (`validateInvasion` ok: true); the card is rendered inside
   the city sheet and goes with it. Evidence: battle-hud-9-shots/after/risk-phone-sheet-gone.png, `.claude/skills/battle-lab/risk-tap.mjs`
   (prints the test ids left: only `goal-tracker-chip`). Same nesting in ArmySheet.jsx. Worth a small lane: render PreBattleModal outside
   the sheet (it already portals to body) or keep the sheet mounted while the card is open.

## Findings

| # | Finding | Cause | Fix | Before / after evidence |
|---|---|---|---|---|
| 1 | Deploy card covers a third of the phone field (F116, BC 35) | Opened full: help text, presets, Start, 20rem wide | On a short screen (max-height 480) it opens compact: title, Start, formations; the chevron (the reopen handle) shows the help. 22rem wide so the title fits beside Start (BattleHud.jsx `deployFolded` starts at `short`) | Open panels at 844x390 deploy: **33.1% to 20.3%** (hud-shot.mjs `open`). before/844x390-1-deploy.png, after/844x390-1-deploy.png, after/844x390-he-1-deploy.png |
| 2 | Economy panel half the field (BC 53); closed when the build phase starts | Full sheet 26rem with the steward's explanation and a label row; opened only by the Economy button | Opens at Start in an economy battle (build phase); compact on a phone: steward in the title row, explanation in its title, 20rem (EconomyHud.jsx `compact`). A selection's own panel (laborers, building, placing) closes it so they never stack. The Economy button stays its reopen handle | Open panels with the economy sheet at 844x390: **37.9% to 23.4%**. before/844x390-7-economy.png, after/844x390-7-economy.png; first 10 s after Start (objective line still open, selection pill): 26.0% |
| 3 | Objective box always open | No fold | The objective line folds 10 s after Start; a chevron (44 px, the only part that takes taps, so attack-move clicks still pass) brings it back (en, he) | after/844x390-2b-folded.png, after/844x390-he-2b-folded.png |
| 4 | Alerts too short to hit at 3x (F99) | `visibleAlerts` counted 8 s in battle ticks | 8 real seconds at every speed: the window is `ALERT_SHOW_TICKS * speed` (battleHudModel.js) | battleHudModel.test.js "F99" (at 3x an alert is still shown after 8 battle seconds, gone after 24) |
| 5 | Continue on the result screen can scroll away (NC 162) | Continue was the last row of a scrolling card | The footer (Auto line and Continue) is sticky at the bottom (BattleResultScreen.jsx `battle-result-footer`) | result-pin.mjs: 844x390 en/he, 844x340 en, 1600x900 en/he: Continue in view each time; at 844x340 the card scrolls and Continue stays at 280-330. The sandbox result fit before too (before/result-844x340-en.png), so the campaign case (notice plus more rows) is the one this protects; not shot (no campaign end in a script) |
| 6 | A Hopeless Command was one tap (WM fix 5) | No confirm | With Unlikely or Hopeless odds (Auto under 35%, the verdicts' own line; `risk` in preBattleModel.js) the first tap on Begin battle turns it red: "Command anyway: Hopeless" (or Unlikely) for 3 s; a second tap starts the battle; the timeout or a tap anywhere else on the card resets it. Auto and Call off stay one tap; nothing is ever blocked | preBattleModel.test.js (risk word); risk-tap.mjs at 1600x900: one tap "Command anyway: Hopeless", 3 s later "Begin battle", a tap on Auto resets, two taps open the battle. after/risk-en-1600x900-2-armed.png |

## Tools added or changed

- `.claude/skills/battle-lab/hud-shot.mjs`: prints `panels` (HUD share of the field under the top bar) and `open` (the open panels
  alone: deploy card, economy sheet, status box, alerts, city card, minimap, selection), plus a `2b-folded` state 10 s after Start.
- `.claude/skills/battle-lab/result-pin.mjs`: a sandbox battle ended by Retreat; whether Continue is in view per size and language.
- `.claude/skills/battle-lab/risk-tap.mjs`: a hopeless attack on a real game, the two-tap Command on the pre-battle card.

## Tests

- `npx eslint --no-ignore --max-warnings 0` on every changed file: clean.
- Targeted vitest (11 files: battleHudModel, battleHud, preBattleScouts, preBattleModel, battleReceiptView, battleHebrew,
  attackAvailability, i18n hardcodedText, i18n, copyPass, sweep): 164 passed.

## Not checked / risks

- The pre-battle "Command anyway" card at 844x390 is not shot: the phone path to the card is broken (For the lead 2). The label is
  longer than "Begin battle"; on a phone the button column is `auto` wide, so the footer may wrap.
- With the economy sheet and the objective line both open (first 10 s after Start, an army selected) the open panels are 26.0%,
  just over the quarter; after the fold 23.4%.
- Vite does not watch `.claude/**`: every shot run here needed a restart of the lane's own server (port 5231) to see edits.
- The wand and build sheets (opened by the player, 56% and 44% of the field) were left as they are: menus the player opens and closes.
