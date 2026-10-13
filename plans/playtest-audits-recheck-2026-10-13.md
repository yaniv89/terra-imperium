# Playtest audit re-check (wave 0), 2026-10-13

Base: `claude/integration` at `b90623d9`. Rows come from conflicts section 5. Method: inventory row, current
code, the named commits (all 13 are ancestors of the base), targeted tests, and a real-browser look at the
battle sandbox (`/?battleSandbox`, 844x390, bronze/kingdoms mixed terrain, run from this worktree).
I did not start a full campaign in the browser, so campaign-screen layout items say "needs a visual check".

Tests run (all pass, 6 files, 35 tests): `mapCamera.test.js`, `marchAttack.test.js`, `battleOpenGuard.test.js`,
`attackAvailability.test.js`, `appViewport.test.js`, `RazeControl.test.js`.

## Verdicts

| ID | Verdict | Evidence | What remains |
|---|---|---|---|
| I217 trees read as noise | CLOSED (by sight, one size) | `58527447` is in the base. Sandbox at 844x390: trees show as lit, varied green canopies with visible trunks and shadows, not dark blobs. | Look once at far zoom on a real phone. Silhouette variety by biome (desert, snow) not checked. |
| I218 soldiers too tiny | PARTLY, needs a visual check | `1d31e518` (true scale), `375dc995`, `bf979d33` (LODs), `d135e898` (team colour) are in the base. Sandbox: figures are small but readable, with banners, at near zoom. Selection pick radius not measured. | Tap size on a real phone, and the pick radius against `inspectAt`/`ownSquadAt` in `TacticalBattleScreen.jsx`. |
| I209 friendly vs enemy buildings (part) | PARTLY, needs a visual check | Own camp shows a blue banner and a "Yours" card. The sandbox is a field fight with no enemy buildings, so the enemy side was not seen. `d135e898` made team colour an accent. | Open a city assault (enemy keep, houses) at 844x390 and check an owner marker or outline that works without colour. |
| I215 town in the wrong style | PARTLY | `23ac32a4` and `1b9e13c3` are in the base. `styleOfLand` (`src/data/architecture.js`) gives Akkad and Elam the `levant` theme (not `europe`) and Israel `israelite`. Town art follows the land's theme, battle buildings follow culture skins. | Sack of Kish with a Mesopotamian people: does the `levant` town read as Mesopotamian in Bronze? If not, a Mesopotamian theme is an art task. |
| I072 camera jumps on resize | CLOSED | `b1ae931b` in base. `carryTransform` keeps the place at the centre on resize, `cameraTarget` never uses a default spot, `rememberCamera` restores per game; `mapCamera.test.js` covers all three and passes. | A sheet that overlays the map does not resize it; one visual check with a docked panel is still cheap. |
| I064 city-card attack teleports | CLOSED | `13b56886` in base. `RegionInfoModal.jsx` sends `SET_ROUTE` with `attack: true` for a far city (shows "N turns to arrive"). `LAUNCH_INVASION` is only offered for an adjacent source, and `validateInvasion` (`invasion.js:81-91`) refuses `not_adjacent`. `marchAttack.test.js` passes. | Nothing for the city card. W03 task 3 should still audit other callers of `validateInvasion` (AI, `PreBattleModal`). |
| I007 Command falls back to Auto (empty garrison) | CLOSED | `bdc1fc28` in base. `battleOpenGuard.js` settles a battle with no side as Auto and `ABANDON_TACTICAL_BATTLE` writes "The battle at X was settled on Auto: no defenders were left to fight". `PreBattleModal` with a known empty garrison shows a single "March in" button and no Command. `battleOpenGuard.test.js` passes. | Without intel the player can still pick Command, and the guard then explains on the log only. The militia of a city is in the setup, which is why an "empty" garrison still opens a fight. |
| I176 no build space | PARTLY | Measured legal slots 20 tiles around the camp (placement rule from the sim, 5 terrains x 3 seeds, sandbox economy setup): house/yard/tower 116 to 147, farm/barracks/range 83 to 117, stable/siege 51 to 79, mine 19 to 27. Plenty of room. | Only the sandbox camp was measured. City assaults and raids (manifest town, walls, forest) were not. Plan keeps I173 to I181 open. |
| I183 cancel placement taps through | PARTLY, needs a touch check | `83578fa5` in base. Cancel is a DOM button (`battle-place-cancel`, `onClick={disarm}`), not a canvas tap, so the tap that cancels cannot also reach the canvas. Not shown on a real touch device. | Touch test on the phone: cancel, then check no tower or build tile arms. |
| I197 Keep focus | PARTLY | `focusKeep` centres on `setup.structures[0]`, the keep by construction (`cityBattle.js` "the keep stays first"); the chip shows only when a keep exists. No test of the button itself. | Add a check per battle type if wanted; no "why unavailable" text. Not run in a city battle. |
| I152 cramped decision cards | PARTLY, needs a visual check | Event card: width `min(34rem, 100vw - rail)` (`EventModal.jsx:53`). Pre-battle card: `min(56rem, 100vw - rail)` with a 3 column grid from `sm`. Peace offer, tribute and first contact were not checked. | Check peace offer, tribute and first contact at 844x340 with a dock open. L4 owns it. |
| I159 event options below the fold | PARTLY | Options sit inside the scrolling body (`EventModal.jsx:81`, `overflow-y-auto`, card `max-h-full`), so they are reachable by scrolling but with a 4 rem header and `p-4` option cards at 340 px height the first option is likely the only one visible. | Visual check at 844x340. Fix idea for L4: pin the option list or tighten padding under `data-layout=phone-landscape`. |
| I156 End Turn moves when sheets open | OPEN | `TurnDock.jsx:71-72` places the dock at `right: var(--rail-inset) + 0.75rem`, and `PanelDrawer.jsx:81-88` changes `--rail-inset` whenever the dock opens or closes. So End Turn and its chips move by design. `5430acce` does not touch this. | L4 item 2: anchor the controls (or freeze them while a tap is in flight). |
| I160 sheets clipped by Safari bars | PARTLY, needs a device check | `5430acce` in base: `appViewport.js` writes `--app-height` and `--app-vh` from `visualViewport`, tested (`appViewport.test.js`, passes). The audit's P3 still saw clipping. | Check on the iPhone in Safari with the compact bar. Reuse `appViewport.js` for U03 as planned. |
| I129 capture choice | PARTLY | `RazeControl.jsx` (Raze and Stop razing, `canRaze`) exists. No Conquer, Free city, or Tributary choice, and no shared flow for battle and surrender captures (nothing found for those actions in `src/`). | The shared disposition card is still to build. |

## Summary

Closed: I072, I064, I007, I217. Open: I156. Everything else is partly done, mostly waiting on a real phone or a
city-assault visual check.
