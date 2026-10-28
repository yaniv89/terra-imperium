ponytail read in full at 17:45 UTC, 28 Oct 2026 (the session start hook also printed PONYTAIL MODE ACTIVE).

# Lane lead-ui-fixes: report

Branch `claude/lead-ui-fixes`, from `origin/claude/integration` (37cbf067). UI only: no game rule, no battle sim change.
The lead's own shots in `plans/ui/lead-check/` are the "before"; the "after" shots are in `plans/ui/lead-ui-fixes/`
(`after-<lang>-<size>-<n>.jpg`, made by `node scripts/ui/lead-ui-fixes-shots.mjs`, which prints one line per check).

## What was wrong and what changed

1. **Hebrew "2,200 2,200 מתוך"** on the battle result. `fa-num` forces left to right, and 21 elements wrapped a whole
   translated sentence in it (result screen, battle HUD, economy HUD, peace deal, pre-battle card, defence sheet,
   city panel, End Turn's Buy, independent sheet). Every Hebrew value of those keys has words, so all 21 read
   backwards. `fa-num` is now only on numbers (the loot `+gold` keeps it on its own span); t() already isolates
   signed numbers in Hebrew. Test: `src/i18n/faNumSentence.test.js` scans every .jsx for an `fa-num` element whose
   first child is a t() call (it fails on the old line, passes now).
2. **Battle deploy objective box on the deploy card.** Not Hebrew only: the sandbox (your army on the left, card on
   the right) overlapped in English too (`deploy-before-*`: en OVERLAP, he ok there; the lead's kingdoms battle was the
   mirror case). The top row is a flex row, so its side column moved with the language while the card is placed
   physically. While deploying, the side column now sits on the card's side and the objective box keeps to the far
   edge (BattleHud.jsx `battle-top-row`). Checked at 844x390 and 844x340, en and he: clear in all four.
3. **Notices over controls**
   - "Not enough resources: need 200 Gold" is the WhyTip bubble. The lead's script tapped a button below the fold
     (dispatched click, no scroll), so the bubble clamped to the screen bottom over End Turn. The tapped button now
     scrolls into view first (WhyTip.jsx, one line). Checked with the same no-scroll tap: bubble at y 191-221, dock
     at 325 (844x390), clear at every size and language.
   - Autosave toast moved from top-start (where the next-step chips are) to top centre (MenuSheet.jsx). Top centre is
     free on phones (the march and settle bars go to the bottom there). Not shot: it needs a real End Turn autosave.
   - "Raid party going home": the "?" is the party's own foreign army banner, which the close view lifts by the model
     height; the label sat at a fixed 30 px. The label now clears the banner top (raidShapes.js). Test added to
     independentsView.test.js (fails on the old code: -30 vs -45.8).
   - Log sheet on a phone: it gets the same bottom padding as `.sheet-panel`, so its last line ends above End Turn
     (LogDrawer.jsx). Checked: text ends at 312, dock starts at 325 (844x390); same at 844x340, en and he.
4. **Small ones**
   - 1600x900 legend peeking from under the city sheet: the legend hides while a city sheet is open (MapContainer.jsx).
   - "Tripoli" on Mycenae's tile card: a city's own tile now shows the city's name, as `placeLabel` already does
     (TileSheet.jsx; Tripoli is the Natural Earth place name under that hex).
   - Duplicate key `adv_adm_0`: HIRE_ADVISOR's fresh face always gets id `adv_<pool>_0`, in any slot, so ids repeat.
     Rule untouched (rulers.js unchanged); DomesticPanel keys the rows by slot. The same repeat also disabled a fresh
     candidate whose id matched the hired advisor's (`current?.id === candidate.id`): that check is removed, the
     reducer never needed it (the hired one leaves the list). Lead: say if you want the ids made unique in the engine
     instead (it changes saved ids, so I left it).
   - panels-shots age-banner timeout: **the script**, not the game. The banner shows and hides after 5 s; on this cloud
     machine one Playwright round trip takes about 2.6 s, so the script's separate reads landed on the removed element
     (read NaN). It now reads all three numbers in the page the moment the banner appears. Full run passes (exit 0).
   - Era saves asking for the Bronze landmark from Gunpowder on: **the saves**. The scripted player never picked a
     landmark, and `pendingLandmarkAge` shows the oldest unpicked age by design. build-era-saves.mjs now picks each
     age's landmark as it comes (`aiLandmark`, the AI's seeded pick); the seven saves were patched with the same picks
     (no 900-turn rebuild); eraSaves.test.mjs asserts no landmark is pending. All 8 tests pass.

## Evidence
- `node scripts/ui/panels-shots.mjs`: all checks ok, exit 0.
- `node scripts/ui/lead-ui-fixes-shots.mjs`: RESULT_PLACEHOLDER
- Tests: faNumSentence, independentsView, eraSaves, `npm run test:related` on the touched components (72 passed).
  Full `npx vitest run`: FULL_PLACEHOLDER
- `npm run lint`: clean.

## Not done / risks
- Autosave toast position is not shot (needs a played turn). The deploy check covers your-army-right only in the
  sandbox; the left case is the same rule mirrored (the lead's kingdoms shot was that case).
- Before-shots for items 3 and 4 are the lead's own (`plans/ui/lead-check/`); I did not re-shoot the base commit.
