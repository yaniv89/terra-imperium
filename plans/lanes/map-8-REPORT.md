# Lane report: map-8 (28 Oct)

ponytail read in full at 10:49 UTC (session start hook printed PONYTAIL MODE ACTIVE; whole SKILL.md printed with cat).

Target: "Map pan, zoom, close view and fog" 8/10 (5 in every round 2 playtest).
Branch: claude/map-8 from origin/claude/integration (f60660b8).

## 1. What the round 2 playtests said about the map

All four reports score the map 5 because it was barely tested ("one pinch, no comment"). Every map step
in the diaries (no screenshot was kept at any of them, so the evidence below is my own repro):

| Run | Step | What happened | Kind |
|---|---|---|---|
| 40650969714 newcomer | 10 | pinch out 0.6 to see more, no comment | zoom |
| 40650973042 warmonger | 24 | pinch out 0.6 "to see the map and fog", no comment | zoom, fog |
| 40650976677 civ veteran | 20 | pinch out 0.5, no comment | zoom |
| 40650976677 | 16-17, 54-55, 64-65 | closing the city screen leaves a tile panel to close | panels (newcomer-flow lane) |
| 40651416284 civ veteran | 57-58 | march north: "The north tile said 'already there', which is odd", zooms out to aim farther | march tap (bug) |
| 40651416284 | 60 | "My tap landed under the march banner" | march bar covers the top strip |
| 40651416284 | 70-72 | after End Turn, pans north to find the marching army | finding your army |
| 40651416284 | 148 | the Sippar siege marker went away without a message | marker (siege ended; log, not map) |
| 40651416284 | 168, 175, 221 | "the view is all fog", the army vanished off screen | RTS battle camera (battle lanes) |

## 2. Repro (real browser, the playtest harness's own openGame / loadSlice / perform)

`node scripts/ui/map-8-shots.mjs --tag before|after` (classical era save, Israel, turn 116) at 844x390
(iPhone insets) and 1600x900, en and he. Shots: plans/ui/map-8/{before,after}-<scene>-<size>-<lang>.jpg.

Base commit findings (same in all four runs):
- Pinch zoom tracks the fingers exactly (k 30.8 to 13.8 to 6.1 for two 0.5 pinches; 1,214 to 2,720 to
  6,094 km across the phone). Not a problem. (A first run of my script showed a tiny zoom: it sent a
  mouse wheel, not a pinch; the harness itself pinches correctly.)
- **Pan stops dead when the finger lifts**: a 120 px flick moved the map exactly 120 px. Polytopia, Civ VI
  mobile and every phone list glide on. Crossing a region takes many drags.
- **Step 58 reproduced**: in march mode, a tap on a hex of your own land beside the army said "The army is
  already there." The tap hit your city's name banner (it spills over the next hexes at this zoom), and a
  march aims at the city whose banner or land is tapped, which is where the army stands.
- **Far zoom: army banners sit on city names** ("Jer[10k]em", "Sa[10k]ia", before-out2-phone-en.jpg).
- Camera after opening and closing a city sheet from the map: moved 0 px, zoom unchanged (fine).
- Close view: max zoom about 600 km across a phone (HEXES_ACROSS_AT_MAX_ZOOM 3.5): towns, fields and
  soldiers readable (before-close-phone-en.jpg). Not changed.
- Fog: seen-but-not-visible cities stay drawn grey with their name (Sinope, Kerma in out2); never-seen land
  is dark. Matches the decided look. Not changed.

## 3. Fixes

1. **Fling on pan** (GLMapView.jsx zoom start/zoom/end, mapView.js `flingVelocity`):
   the speed over the drag's last 80 ms, kept only when the finger moved at 0.25 px/ms or more and lifted
   within 40 ms of its last move; the map glides on and slows by 0.996 a ms (about 1/3 speed in 0.3 s, the
   iOS scroll feel). Only a one-finger (or mouse) drag at one zoom flings; a pinch never does. A finger
   down, a wheel or any camera fly-to stops it; a tap that stops a glide only stops it (no tile sheet).
   Off with prefers-reduced-motion.
   After: a 120 px flick carries the map 424-443 px on the phone, 251 px with the mouse.
   Design call: Polytopia and Civ VI mobile both glide; Google Maps flings with the mouse too.
2. **March taps on your own land aim at the hex** (GLMapView.jsx `tapAt`): while a march is aimed, your own
   city's name banner is looked through to the land under it, and from the hex zoom a hex of your own land
   is the hex itself. Foreign land still aims at its city (march to attack, as before), the far zoom still
   aims at cities, and a tap on your town itself still aims at the city.
   After: "To Gaza City: this turn, it sets out now" instead of "The army is already there." (en and he).
3. **City names under the badge when an army banner stands on the city** (sceneModel.js `citySprites`
   `armyTiles`, from the fog-filtered markers, so it reveals nothing): after-out2-phone-en.jpg reads
   "Jerusalem" under the badge with the 10k banner above. Declutter still drops a name that would overlap
   another (Samaria under Hazor in that shot), as before.

## 4. Evidence

- Shots: plans/ui/map-8/ before-* (base) and after-* for start, out1, out2, fogfar, close, army, march,
  march-own, march-target, panel-open, panel-closed; phone and desktop, en and he.
- Tests: glMap.test.js new case (fling: speed, rest before lift, slow drag, empty). src/components/map:
  41 files, 247 tests pass. Lint clean.
- The fling was checked with touches fired inside the page: in this sandbox the software GL takes about
  1.7 s a frame, so CDP touches arrive seconds apart and no real flick speed is possible; the swipe's clock
  was held at 16 ms a move (map-8-shots.mjs says so).
- Full `npx vitest run` after merging origin/claude/integration (cece290d): 504 files passed, 2 skipped; 4,720 tests passed. Lint clean.
- Perf: see section 5.

## 5. Perf

`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium node scripts/perf/map-pan.mjs --gpu`, change then
base (git stash) back to back on this machine. The sandbox has no GPU (software GL, about 5 fps), so only
the delta means anything. Step median ms, change / base:

| profile | k 1 | k 4 | k 12 | k 40 |
|---|---|---|---|---|
| desktop 1600x900 | 250 / 211 | 258 / 269 | 172 / 174 | 1893 / 1928 |
| phone 844x390 | 216 / 219 | 282 / 271 | 216 / 221 | 2186 / 2344 |

No direction: the differences go both ways and sit inside the sandbox's 10-20% spread. The change adds
one array push per pan event and one Set per marker update; the glide itself is an ordinary pan per frame.

## 6. Left open (for the lead)

- Step 60: the march bar sits across the top of the map on a phone, where a march north is aimed. Moving it
  (to the bottom, or shrinking it while aiming) touches the newcomer-flow lane's prompt layout: not done.
- Step 70-72: after End Turn the camera does not show where marching armies went. A "next army" tap (Civ VI
  cycles units needing orders) would help; the Idle chip covers only idle stacks. Needs a design yes.
- Step 148: a siege that ends should say so in the turn report (log lane).
- The march ETA label under the arrow can sit under a town model at the hex zoom (after-march-own-phone-he.jpg).
- No new playtest was run (no API use in this lane): the 8/10 is not graded yet.
