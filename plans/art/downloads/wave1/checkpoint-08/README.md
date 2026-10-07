# Wave 1 checkpoint 08: Bronze culture skins for the battle buildings

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (12 new queue items `rts/bronze/skins/<theme>`).
[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png) (the game's
kit loader: each column a theme, barracks at the back, tower, trade post in front; the shared
Bronze buildings in the first column of every picture).

## Delivered: 48 variants
- 36 new: `src/assets/battle/rts/rts-bronze-<theme>.glb` for americas, eastafrica, europe, indic,
  israelite, levant, maghreb, monsoon, nile, sinic, steppe, westafrica, each with `barracks`,
  `tower`, `trade-post` and their `-damaged` states (the shared file's sockets: door, rally,
  banner, fire, smoke; LOD0..2). Packed 0.60 to 0.99 MB each, 9.38 MB together (1024 atlases; the 2048
  rule for buildings was not needed, they were baked at 1024).
- 12 town-hall skins: the themes' civic halls (`battle/city/civic-bronze-<theme>.glb`, checkpoint
  05), which is what a battle draws for the town hall (the keep); no new file.

Built by `scripts/blender/build_rts_skins_bronze.py`: the theme's own house kit (the delivered kits
of the 9 kit themes; the procedural europe, indic and sinic kits) fitted into each role, a tower body
of the theme's building stuff (mud brick or stone with merlons and slits; timber posts and braces in
europe, steppe and monsoon) under a look-out in the theme's house form, and the shared roles' props
(spear racks, drill posts, stalls, the balance, flags). Original procedural geometry, no outside assets.

## Checks
- `validate_model.py ... prefab` passes all 12 (LOD0 1,140 to 4,600 triangles, LOD2 under 400).
- In the game: `economyLayer.js` draws a side's barracks, towers and trade posts from its people's
  theme (`themeOfNation`, else the land's style, along the style chain; same age as the shared file
  it uses), else the shared building (test: `economyArt.test.js`). The sandbox takes
  `&people=shang&enemy=kemet` to give the sides peoples.
- Build menu icons rerun (`scripts/art/build-icons.mjs`): unchanged, the menu shows the shared
  buildings (one icon per role).
- Lint clean; battle render, art and pack tests pass.
