# Lane report: map-clarity (27 Oct)

Source: plans/ai-output/human-playtest/SUMMARY.md issues 6, 8, 13, 14, 17, 19, plus the lead's
notes from run 40550097406 (step 72: Show on map lands on sea with no marker; step 83: an army
starving at morale 0 for about 12 turns with no way back and nothing explaining supply).
Branch: claude/map-clarity. Shots: plans/ui/map-clarity/ (before-* is origin/claude/integration,
after-* this branch; script scripts/ui/map-clarity-shots.mjs, a classical era save built by the
playtest harness's own buildSlices).

## 1. Map dark after a pact or the Peoples sheet (issue 8)

- Problem: after signing a pact (new2 step 128, civ step 203) the map went dark; on a phone the whole
  screen was fog after Peoples closed.
- Cause, reproduced in a real browser (classical save, 844x390, pact with Muisca whose capital the
  player never saw): NationCard fires the pact's effect toward the other people's capital
  (`getNationCapital`) and GLMapView pans and follows every effect to its `toRegionId` with no fog
  check. The camera went from the player's coast to the unseen Muisca capital: transform x
  -9711 to -7968, the screen all fog (plans/ui/map-clarity/before-muisca-8-844-en-5-closed.png,
  the same picture as the playtest's step 128).
- Fix: an effect, and an event's city, pan only to a city on explored land
  (mapCamera.js `knownLatLngOfCity`). After: the camera stays on the player's coast
  (after-muisca-8-844-en-5-closed.png).
- Show on map (run 40550097406 step 72): a Stone Age people's remembered home is a tile with no town
  drawn on it, so the camera landed on a plain coast. Every fly to a place now outlines the place's
  tile for 8 s (MapContainer flyToPlaces, the existing pointAtTile outline): after-muisca-8-844-en-7-show-tiwanaku.png.
- Design call: a camera move from outside the map never lands on fog. Reference: Civilization VI
  never centres on unrevealed tiles (diplomacy screens open without moving the map); this keeps the
  project's own rule from mapCamera.js (H-19) for one more path.

## 2. Supply: a state, a way back, and the forecast (issue 6, run 40550097406 step 83)

- Problem: armies marched into empty land and starved walking home; a starving army sat 12 turns at
  morale 0 with no "back to supply" order and only a long paragraph to explain it.
- Fix:
  - Army sheet: a one-line supply state on top (Supplied / Supplies for N more turns / Starving: -5%
    strength and -10 morale a turn), red or amber, then one tap "Back to supply: <place>, N turns":
    a real SET_ROUTE to the nearest own, vassal or allied land (supplyZone 'home') with a path
    (armySheetModel `supplyState`, `resupplyTarget`). Shown only for a stack whose meter falls or is
    empty and has no march.
  - March bar: the meter over the whole march, End Turn by End Turn, as resolveTurn runs it (marches
    move before the supply phase): "Its supplies run out on the way (in N turns)" or "Arrives with
    supply X; out of supply there: -10 a turn, starves in about N" (supplyMeter `supplyAlongMarch`).
    The old line read the meter as if the stack were already at the target.
  - While a land march's target is picked, the political map shows the supply lens (supply line reach).
- Design calls: HoI4 puts an out-of-supply flag on the counter and EU4 an attrition line on the army
  plus a supply-limit map mode while moving armies; Civilization's attrition preview warns on the path
  before you commit. The state line and the forecast follow those; Back to supply is the one tap the
  lead asked for.
- No rule changed: the meter, the drain and the order are the engine's own.

## 3. Own vs foreign armies (issue 14)

- Problem: rts step 99, "the blue 9.7k marker is my own army".
- Cause: own banners were blue (#2563eb) while the player's land and city badges are green, and the
  nation palette (nationColors.js) keeps green for the player but has two blues for other peoples.
- Fix: own army, fleet and cluster banners and the close view's soldiers wear the player's green
  (#15803d, the land's #4ade80 darker for white text): mapBanners.js PLAYER_BANNER_COLOR.
- Design call: Civilization's unit flags carry the civ's border colour; here the colour reserved for
  the player is green, so the banner follows it.

## 4. Gold and food say where they come from (issue 13)

- Problem: "gold drains with no reason", log lines like "-800: +5g", a gold line every turn, food
  falling 44 to 25 unexplained.
- Fix (UI wording and display only, no rule change):
  - The top bar's gold sheet lists the four biggest cities, the rest, occupied land, trade routes and
    "Government, laws, wonders and tax rate" (the national multiplier), adding up exactly to the
    income, then the upkeep lines that were already there (topBarModel `goldIncomeRows`; calcIncome
    gets an optional `goldParts` out-parameter, the income is identical with or without it, tested).
  - The per-turn income line now reads "Income: +5g (each source: tap Gold on the top bar)" and folds
    into one line with a count like the upkeep line (logSummary.js), old saves' "-800: +5g" too.
  - The food note says why a city's bank drops: growth spends it; settlers, levies, battles and
    famine take people.
- Design call: Civilization VI's gold tooltip (one line per source) and EU4's ledger; neither logs
  income every turn.

## 5. Hebrew log and the men count (issues 17, 19)

- Signed numbers flipped in Hebrew ("11g+", "4700-"): every message in Hebrew isolates a signed number
  left to right (messageText.js `isolateSigned`, LRI ... PDI; a dash between numbers stays), and the
  log's years are integration's own fix (yearText in a bdi, merged from another lane).
- English event names in the Hebrew log: already fixed on integration (checked: "אירוע: סוחרים
  נודדים ← לסחור רק במה שדרוש").
- Men x10: not a wrong conversion (one strength point is 10 men by design, battleLedger menOf), but
  the unit row printed raw strength "913/1000" under a header in men "9,130 soldiers". The row now
  shows men too: "9,130/10,000 men".

## Evidence

- Tests (new): mapCamera.test.js (fogged city, place tile), armySheetModel.test.js (state, Back to
  supply is a real march), supplyMeter.test.js (march forecast: turn by turn, starves on the way,
  null at home), topBarModel.test.js (rows add up, parts do not change the income),
  logSummary.test.js (income folds), i18n/isolateSigned.test.js.
- Targeted runs: src/components/map, ui/topBarModel, engine/supplyMeter, engine/logSummary, src/i18n,
  src/audio: 59 files, 447 tests pass. Lint clean.
- Known failure not from this lane: resolveTurn.test.js "an aggressive, hostile Tier 1 neighbor
  eventually declares war" fails on origin/claude/integration too (checked with my changes stashed).
- Shots: plans/ui/map-clarity/{before,after}-{pact,army,march,banners,gold,log}-{phone,desktop}-{en,he}.jpg
  (24 each). before-pact-phone-en is the dark map; after-pact-phone-en keeps your coast.
- test:quick: 472 files pass; 3 failed under load (sight, battle sim economy, sim) while two browsers
  ran, all 3 pass alone (37 tests). None touch files of this lane.
- engine-rules-reviewer: no rule findings (calcIncome identical with or without goldParts; the
  forecast is pure and read-only).
- One desktop run went to a fully blank page at the march step once and did not repeat (no page
  error in the rerun); noted in case it shows again.
- Also fixed: the map legend's "Your land" swatch was blue; it is green like the map.

## What is left

- On desktop the army sheet opens under the Cities list (after-army-desktop-en.jpg): the panel
  stacking of issue 11, not changed here.
- On desktop the Peoples sheet covers the right of the map and the camera stays put (by design,
  I072), so the player's land can sit under the sheet; not changed.
- The supply lens shows supply line reach, which only matters in enemy land; wild land always drains.
  A lens that paints own land and line reach separately would read better.
- supplyReport().text (engine, English) is still read by tests; the sheet uses the translated
  supplyText.
