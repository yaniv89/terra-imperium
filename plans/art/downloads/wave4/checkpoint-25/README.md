# Wave 4 checkpoint 25: the close-view shots of the map forts

2026-10-08, branch `claude/bronze-towns` (Claude). No new model files (0 MB); no queue items change.
[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png).

## Fixed
`scripts/art/improvement-shots.mjs` predated the peoples start screen and could not start a game. It now
searches the people (`Search peoples`), picks Israel (`data-people="israel"`), goes Next through the
four steps to Ready and presses Begin there (Begin is on Ready only, as `e2e/startHelpers.js`), skips
the guided intro and the research choice, and reads the player's nation from `state.playerNationId`
(nation ids are people slugs now). `SWIFTSHADER=0` runs it on a real GPU browser (Chrome on Windows).

## Shots (`plans/art/shots/wave4/map-forts/`, 844x390 phone landscape at 2x)
The fort improvement on the tile south-west of Jerusalem (30.74 N, 34.78 E), the game set to each age:
- `fort-classical.png`, `fort-classical-close.png`: the Classical castellum (`fort-classical.glb`).
- `fort-kingdoms.png`, `fort-kingdoms-close.png`: the Kingdoms fort (`fort-kingdoms.glb`, checkpoint 24).

Both stand on their tile with the farm, pasture and plantation round them; no console errors from the
game (only the worktree's font files outside the Vite root, 403).

Run: `SWIFTSHADER=0 CHROMIUM=<chrome.exe> URL=http://localhost:5243/terra-imperium/ node
scripts/art/improvement-shots.mjs <out> 844 390 kingdoms warm:30.74:34.78:60 fort:30.74:34.78:160`.
