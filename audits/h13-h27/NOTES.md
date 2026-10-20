# H-13 and H-27 notes

## H-27 (battle one-finger pan)
- Touch one-finger drag already pans (gestures.js). Checked at 844x390: drag on empty ground and with All selected pans (a0/a1/a2 and b0..b2 shots).
- Real cause found: a tap followed within 300 ms by a drag ANYWHERE armed the lasso (box select). Now the second touch must land within 40 px of the first tap (DOUBLE_TAP_PX). Test: gestures.test.js "a tap then a drag from somewhere else pans".
- Still by design: a drag that STARTS on a selected squad draws a formation line (not a pan); with a big selection, pan from empty ground or with two fingers. Not changed.
- Pointer events were dispatched synthetically (pointerType touch); no real touch hardware.

## H-13 (gold sinks)
- Building upkeep: player pays (tier+1) gold a turn per standing building, Defense line excluded (forts have their own). AI pays none (AI treasuries median 56 at T100, nothing to drain).
- Forecast (calcNationBalance), the turn charge (resolveTurn) and the Domestic expense list all carry the new `buildingUpkeep` line.
- Scripted-bot sim (peoples, 3 games, 100 turns, seed 3): before and after identical (gold median 56/58/59, bankruptcies 1, nationsAlive 82.7). The bot owns almost no buildings, so it cannot show the player hoard.
- NOT verified: the acceptance "median gold at T100 under 2,000 with a full queue". No headless human-like builder exists. Fresh-start test world: all 8 categories at tier 1 = 16 gold a city vs 18 income a city.
