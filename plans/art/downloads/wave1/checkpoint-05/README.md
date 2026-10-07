# Wave 1 checkpoint 05: Bronze civic halls per theme, palace damage, Bronze props

2026-10-07, branch `claude/bronze-towns` (Claude, finishing the work GPT and an earlier agent left
uncommitted). Status `in_game_awaiting_review` for every item.

[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [in-game contact sheet](contact.png)
(844x390 shots from `?battleSandbox&city=medium&age=bronze&style=<theme>`, in plans/art/shots/wave1/).

## Delivered
| File | What | Packed size |
|---|---|---:|
| `src/assets/battle/city/civic-bronze-<theme>.glb` x 12 (americas, eastafrica, europe, indic, israelite, levant, maghreb, monsoon, nile, sinic, steppe, westafrica) | the town hall (battle keep) in each theme: `keep`, `keep-damaged`, `keep-ruined`, LOD0..2 each | 0.24 to 0.51 MB, 4.67 MB together |
| `src/assets/battle/city/civic-bronze.glb` | the base hall of checkpoint 04, re-shipped at 1024 | 0.34 MB (was 2.02 MB unpacked, 1.73 MB packed) |
| `src/assets/battle/city/palace-damage-bronze.glb` | `palace-damaged`, `palace-ruined`, `palace-small-damaged`, `palace-small-ruined` | 0.37 MB |
| `src/assets/battle/props/props-bronze.glb` | fence-a, field-wall-a, well, cart, haystack, crate, barrel, market-stall, standard, campfire, shrine, road-marker | 0.37 MB |

Shipped size 5.75 MB for these 15 files; net added to the branch about 3.7 MB against
9739c310 (the base civic hall shrank by 1.7 MB). Every civic and palace atlas is 1024 in the game
(`scripts/art/shrink-glb-textures.mjs`, then `npm run pack:models`); the 2048 sources stay in the
editable deliveries under `art-build/` (outside Git).

## Checks
- `validate_model.py` passes every civic file (all budgets: keep LOD0 488 to 4,074 triangles,
  LOD2 at most 92), palace damage (explicit house-damage spec) and props (each under 800).
- In the game: every theme loads its own civic file (`style` chain, then base), the three states
  swap by HP, a capital's palace stands on the keep; no console errors besides the dev server's
  font 403s. Close shots of six halls without units: `bronze-city-<theme>-keep-close-844x390.png`.
- Lint clean; 229 art, battle render, close view and pack tests pass.

## Wired
- Battle keep: `cityLayer.js` (city battles, the city's land style) and `structureArt.js`
  `CivicStructures` (open-field keeps now take the defender's style, `styleOfLand`).
- Palace damage: `cityLayer.js` in battle, and now the map's close view: a damaged or ruined capital
  swaps its palace for the damage piece (`townDamage.js applyTownDamage({ palace })`).
- Wonders in a city battle: the map's own wonder model (highest tier) instead of a box; rubble when
  it falls (a `ruin` object is used when a wonder file gets one).
- Props: `src/battle/art/battleProps.js` places them (keep yard or the city's gaps, the attacker's
  camp, roadside markers, farm corners) as instances; decorative only, hidden under new buildings.

## Known
- The Blender proof renders of sinic, eastafrica and israelite frame too wide (a camera bug in
  `render_civic_bronze.py`, not the models: the GLB sizes validate and the halls look right in game).
- The levant town file's two blue glazed blocks read flat at battle zoom (town art, not this delivery).
