# Lane map-art-8 report (U12, wave 5)

Branch `claude/map-art-8`. Target: "campaign map units" art at 8/10 (today 5-6). Findings from the manual
playtest of 29 Oct (help-map-8 section). Shots: real browser (built-in browser, this PC's GPU), own
vite port 5231, 844x390, Ahhiyawa (Mycenae, Stone Age), close view k 80, in `plans/lanes/map-art-8/`.

## For the lead

1. Design call (please confirm): on a city's hex the army figure now stands at 0.55 of the field size
   (`CITY_FIGURE_SHARE`, scale.js); off a city it keeps the user's Civilization size (`FIGURE_HEIGHT_HEX`
   0.85, user 22 Oct), so the user's earlier call is kept where the figure is alone in its hex.
   A scout party stands at 0.7 (`SCOUT_FIGURE_SHARE`). Constant world size, no zoom rescaling (user rule).
2. Design call (please confirm): a scout party counts 30 men at full strength (`SCOUT_PARTY_MEN`,
   battleLedger.js `unitMenOf`), scaled by its strength. Its strength (300) stays its health; nothing
   in the engine changed. Shown on the banner, the army sheet (header and unit row) and the board list.
3. Blender (user, with the MCP add-on): there is no scout model. Scouts draw the age's `support`
   figure (a robed walker with a staff), only smaller. Asset wanted: one light scout per age band
   (Stone/Bronze: a hunter-runner with a short spear and pack; later ages: a light rider), file
   `src/assets/units/{age}-scout.glb` beside the other unit GLBs, same rig as the support figure so
   the map's walk cycle works. The map then needs a small change to draw it when `m.scout` (marker
   flag added in this lane). Not built headless (lane rule).

## Findings

| Finding | Cause | Fix | Before | After |
|---|---|---|---|---|
| The soldier figure dwarfs the town | Every army figure is `FIGURE_HEIGHT_HEX` 0.85 of a hex (the Civ size), also on a city hex where it stands in front of a Stone town of a few huts: figure as tall as the whole town | `figureShareOf(marker)` (scale.js): 0.55 on a city hex, 0.7 for a scout; used by the figure (closeViewScene.js) and by both banner placements (sceneModel.js, Map2DMarkersOverlay.jsx via `armyBannerOffset(hexPx, inCity, share)`), so the flag sits just over the smaller head | before-en.jpg, before-he.jpg | after-en.jpg, after-he.jpg |
| Scouts show as "3,000 men" | A scout's strength is 300 (`EXPLORER_STRENGTH`), and the map turns strength into men at 10 a point | `unitMenOf` (battleLedger.js): a scout party is 30 men at full strength; mapMarkers.js, armySheetModel.js and ArmySheet.jsx read it. Banner "3k" now "30"; sheet "30 soldiers", "30/30" | before-en.jpg, before-he.jpg (banner 3k) | after-en.jpg (banner 30), after-he-scout-sheet.jpg |
| Tiryns once drew as placeholder cubes | A town draws the procedural block town (townModels.js, boxes and cones) while its GLB loads, again after the file is evicted (assetMemory, lost context), and forever if the load fails (the failed url stayed `null` in `t.assets`) | closeViewScene.js: no town is drawn while its file loads; a failed file is replaced by another town file of the age (`townFallbackUrl`, townAssets.js: the base kit's layouts of the size first, then any file of the age); the procedural town is left only when every file of the age failed | not reproduced in the browser (no failing file on this PC) | unit test `a town whose file fails` (townAssets.test.js) |

## Checks

- Tests: battleLedger, mapMarkers, armySheetModel, townAssets, hexFit: 54 pass. `npm run test:related`
  on the changed files: 3080 pass; sight.test and tacticalBattle.test timed out under load and pass alone.
- Lint: `npx eslint --no-ignore --max-warnings 0` on the changed files: clean.
- Not checked: the cube fallback in a real browser (would need a failing GLB); 1600x900 desktop shots.
