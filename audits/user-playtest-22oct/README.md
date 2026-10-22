# User playtest 22 Oct: map side

Shots from `node audits/user-playtest-22oct/shots.mjs --tag before|after` (Israel, turn 1, an
infantry unit and a farm two rings from Jerusalem), phone 844x390 and desktop 1600x900:
`<tag>-<phone|desktop>-<start-zoom|close-view|closer|farm|far>.png`.

## 1. Unit size

Civilization reference (looked at in the browser, not copied): a Civ VII press screenshot at a
close playing zoom shows each unit as a group of soldiers that spans nearly its whole hex, the
figures about half a hex tall; Civ VI screenshots at the normal zoom read the same way, one unit
filling most of its tile. Ours drew one figure 0.6 of a hex spacing tall.

Change: `FIGURE_HEIGHT_HEX` 0.6 to 0.85 (src/components/map/closeView/scale.js), the plain-tile
spot 0.1 to 0.15 of a hex toward the viewer so the head stays inside the hex, settlers' share
0.6 to 0.55 (they stay about half a hex). Still one world size: pixels are proportional to the zoom.

| shot | before (figure px) | after |
|---|---|---|
| phone, start zoom (k 30.8) | 28 | 39 |
| phone, close view opens (k 14) | 13 | 18 |
| phone, k 40 | 36 | 51 |
| desktop, start zoom (k 34.6) | 64 | 90 |
| desktop, close view opens (k 14) | 26 | 36 |
| desktop, k 40 | 74 | 104 |

The far shot (k 6) shows banners only, as before.

## 2. Scout on water

The engine never let a land unit onto water (armies.js `passableTile`, scouting.js, aiScouting.js
`scoutPath`); land units cross the sea only as cargo of a fleet (fleets.js `embarkedOn`), and the
map draws cargo as the fleet's ships. The water walk was the map's glide (marchGlide.js): a move
ordered now is walked at once, so the map saw no old route and glided a straight line of up to
400 km. A scout's 408 km along a curved coast was drawn across the bay. The glide now follows the
fewest steps over the unit's own ground (land for armies, water for fleets).

## 3. Farm squares

Source: the footprint's field plots (closeViewScene.js, `plotTiles` with `PLOT_TINTS`, flat
green and yellow rectangles) drawn around a farm that already has its model. Not in the model
files. A farm with its model now draws no plots; a farm without one keeps them.
