# Lane art-2: report

ponytail read in full at 2026-10-28T10:49Z (`cat .claude/skills/ponytail/SKILL.md`, whole file; the session start hook also printed PONYTAIL MODE ACTIVE). Blender 4.0.2 installed with `bash scripts/blender/install.sh` (not needed in the end: every gap this round was in rendering, not in an asset).

Branch `claude/art-2` from `claude/integration` f60660b8, integration merged back before the final push.
Shots in `plans/lanes/art-2-shots/` (844x390 at DPR 2 and 1600x900 at DPR 1). This machine has no GPU: every shot ran on SwiftShader (`SWGL=1`).

## How it was checked

New battle-lab scripts (dev server on 5199):
- `shot-fx.mjs`: projectiles, landing puffs and the minimap. SwiftShader draws a frame in about 1.5 s, longer than a whole shot's flight, so the script caps the effects' clock at 1/20 s a frame; every shot fired since the last frame then shows early in its flight.
- `collapse-shot.mjs`: one tower, three houses and the town hall of a Classical city fall (drawing side only) and are shot at 0, 15, 40, 70 and 100% of the collapse with the renderer's clock frozen.
- `transition-shot.mjs`: frames from the loading screen into the field, then the end-of-battle pull back.
- Existing: battle-lab `zoom-shots.mjs`, `scripts/perf/map-shots.mjs` (Akkad, k 6, 20, 40).

## Scores (an RTS veteran's eye, AoE IV / Total War / Northgard as reference)

| Area | Before | After | Evidence |
|---|---|---|---|
| Arrows and projectiles at phone zoom | 5 | 8 | before-bronze-archers-18s.jpg: 26 shots in flight, none visible. after-bronze-archers-18s.jpg and after-desktop-archers-18s.jpg: every shot trails a tapered streak at least 2.2 css px thick in the shooter's colour mixed with white (yours blue, theirs orange), arcs readable from bow to target |
| Impacts | 5 | 7 | each shot leaves a small dust puff where it lands; barrage explosions unchanged (the playtest already praised them) |
| Building damage and collapse | never seen | 8 | after-collapse-standing / k15 / k40 / k70 / k100: the town hall and houses lean and sink into their own ruin over 1.3 s; economy buildings do the same with debris, a dust cloud and smoke (the sim sends no event for them; the layer does it once it sees the death) |
| Transition into battle | 4 (hard cut from the loading screen) | 7 | after-trans-in-0..4: the field fades in from black (0.8 s) while the camera settles from 72% zoom to the player's view (1.6 s, ease out); any player zoom takes over at once |
| Transition out of battle | 4 (result sheet on the instant) | 7 | after-trans-out-0..4: the camera pulls slowly back (3 s to 80%) and the result comes up after 0.9 s, so the last moment is seen; reduced motion turns the delay off |
| Minimap legibility | 4 | 7 | before/after-bronze-archers-18s-minimap.png: squads 2.5 to 3.5 px, buildings 4 to 5, the enemy objective 5 to 7, each with a dark edge; brighter blue and red |
| Campaign map units | 5 | 7 | map-before/akkad-phone-k20.png vs map-after/akkad-phone-k20 and k40: every army and settler party in the close view stands on a ring of its owner's colour with a dark inside (Civ VI's unit bases); the figures read on sand and whose they are shows without a tap |
| Unit scale and silhouettes | 6 | 7 | models unchanged. Zoomed out the flags now carry the class (merged from battle-touch's class flags, which landed on integration while this lane ran; my own glyph flags were dropped in the merge in their favour) |
| Melee side readability | 7 | 7 | unchanged (rims, crests) |
| Death and corpses | 6 | 6 | unchanged |
| Hit feedback | 5 | 5 | unchanged |
| Sea readability | 7 | 7 | unchanged |
| Idle, walk, attack clips | 6 | 6 | unchanged |

Target 8 reached for projectiles and building collapse only. The rest sit at 7 or below; see Open items.

## What changed

- `src/battle/render/BattleRenderer.js`: `shotLife` (a shot flies 0.24 to 0.7 s by its length, art only: the sim's hit is already in), `shotTrail` and the `trails` mesh (a tapered cone behind each shot, at least `SHOT_TRAIL_PX` thick on screen at any zoom, one draw call for up to 128), a landing puff when a shot's flight ends; `startIntro` / `startOutro` / `stepCamMove` with `easeZoom` (a player's zoom cancels the move).
- `src/battle/art/structureArt.js`: `COLLAPSE_S`, `collapseMatrix` (sink by the piece's height, easing in, lean up to 0.3 rad about its base).
- `src/battle/render/cityLayer.js`: remembers when a structure in sight falls (`fell`), redraws while a collapse runs, draws the standing piece sinking into its ruin (keep, palace, ring towers, houses from the damage kit). Walls and gates keep their breach piece as before.
- `src/battle/render/economyLayer.js`: `fallAt` (only buildings that die while the battle is watched collapse; wrecks present at the start do not), the sinking building and `collapseDust`.
- `src/components/battle/TacticalBattleScreen.jsx`: two calls (`startIntro` on the first frame, `startOutro` on the end). `BattleResultScreen.jsx` + `src/index.css`: the result fades in after a beat (`battle-result-in`).
- `src/components/battle/BattleMinimap.jsx`: bigger marks with a dark edge.
- `src/components/map/closeView/closeViewScene.js`: `bases` and `baseShade` instanced meshes under army and settler figures.
- Tests: `src/battle/render/collapse.test.js` (collapse matrix, a watched fall draws the sinking piece and dust for COLLAPSE_S, a wreck at the start does not, shot life and trail, the camera ease).

These touch two HUD files of the battle-screens lane (TacticalBattleScreen: two one-line calls; BattleResultScreen: a class name). Flag it to them if they object.

## Speed (perf skill: against the base commit, interleaved, same machine)

Renderer main-thread ms a frame (`BattleRenderer.render` timed), Bronze archers duel at 3x, 844x390 DPR 2, 40 s, SwiftShader; base = `origin/claude/integration` f60660b8 served from a worktree on 5198.

| run | render p50 ms | draw calls |
|---|---|---|
| base 1 | 11.3 | 118 |
| change 1 | 10.3 | 118 |
| base 2 | 9.3 | 116 |
| change 2 | 11.2 | 118 |

No difference beyond run-to-run noise (p95 is dominated by SwiftShader stalls of 2 s on both sides). The trails are one more instanced draw call only while shots fly; collapses redraw the city layer only for 1.3 s each. **Open for the lead:** a real-GPU `render-bench.mjs --bench 300` before main, as the first art lane asked.

## Open items (not done)

- Hit feedback (5): the white rank flash cannot be seen on SwiftShader; it needs a real-GPU frame capture or a longer, stronger flash. Corpses (6) and clips (6) untouched.
- The fade from black on the way in is not visible in SwiftShader stills (CSS opacity over a 1.5 s frame); verify on a real phone.
- City structures fall with the existing debris and smoke sprites (the `structureDestroyed` event); a bigger dust cloud sized to the building would match the economy buildings.
- Walls and gates do not collapse (their breach piece is the state); a wall segment crumbling would need a falling-stones piece in the walls kit (Blender, scripts/blender/).
- A map-to-battle zoom (the campaign camera diving onto the tile before the loading screen) would lift transitions to 8; it crosses the map and battle screens.

## Final checks

`npm run lint` clean. Full `npx vitest run`: see the last line below.
