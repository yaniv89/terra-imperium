# Wave 3 checkpoint 18: Classical culture skins and the map's Classical fort

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (13 new queue items: `rts/classical/skins/<theme>` for 12 themes and
`improvements/classical/fort`). [Manifest](manifest.json), [checksums](SHA256SUMS.txt),
[contact sheet](contact.png): proofs of the Europe, Nile, Sinic, Steppe and Americas skins (barracks,
tower, trade post, each with its damaged state) and the map fort. All proofs:
`plans/art/shots/wave3/skins-classical/`.

## Delivered (1024 atlases, packed)
- `src/assets/battle/rts/rts-classical-<theme>.glb` for americas, eastafrica, europe, indic, israelite,
  levant, maghreb, monsoon, nile, sinic, steppe, westafrica (0.59 to 0.94 MB each, 9.40 MB together):
  `barracks`, `tower`, `trade-post` and their `-damaged` states with the sockets of rts-classical.glb,
  built from the theme's own Classical houses (the same kits its towns and damaged houses use) with a
  tower body in the theme's stuff (ashlar in Europe, the Levant and the Maghreb; brick in India;
  stone in the Americas, East Africa and Israel; timber on posts in the Steppe and Monsoon lands; mud
  brick elsewhere). `scripts/blender/build_rts_skins_classical.py` (the Bronze skins builder for the
  Classical kits). validate_model.py `auto` (prefab): all 12 pass.
- `src/assets/map/improvements/fort-classical.glb` (589 KB): the battle's Classical castellum on a round
  earth Ground patch in the 50 m circle, LOD0 / LOD1 / LOD2 7,175 / 1,319 / 255 triangles (the wall ring
  lighter and the levels trimmed to the improvement budget);
  `scripts/blender/build_improvement_fort_classical.py`. validate_model.py improvement: pass.

Together 9.99 MB.

## Wired
- Skins: `artIndex.rtsSkin('classical', style)` finds them: a Classical side builds its barracks,
  towers and trade posts in its people's theme (economyLayer.js), else the shared rts-classical.glb.
  The build menu keeps one shared icon per role (user decision). Sandbox
  `city=medium&age=classical&people=kemet&enemy=zhou`: no console errors.
- Map fort: improvementModels.js takes the latest age's file first, so from the Classical Age on every
  land's fort shows the castellum (the Israelite Bronze fort stays for the Bronze Age, the Israelite
  Modern fort for the Modern Age); the test now says so. The close view's improvement shot script
  (`scripts/art/improvement-shots.mjs`) predates the peoples start screen and could not run; the file
  is read by the same tested lookup as the delivered improvements.
