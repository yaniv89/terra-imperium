# Unit art pilot: classical-infantry (the swordsman), built in Blender from GPT's 2D sheets

Date: 2026-10-02. Source: GPT's concept checkpoint (hero, turnaround, variants, key poses,
readability study). Built by `scripts/blender/build_classical_infantry.py` with Blender 4.2's
`bpy` module, no manual modelling. Only the game model exists (brief 4.1): no render model,
so the sprite sheets are rendered from the game model.

## Result
- `src/assets/units/classical-infantry.glb` + `.json`: 1,296 triangles, 9 flat materials
  (`Team`, `Skin`, `Hair`, `Leather`, `LeatherDark`, `Bronze`, `Iron`, `Wood`, `Linen`), the
  brief's 17 bones plus `weapon` and `shield`, rigid weights, all 13 Archetype A clips at their
  exact frame counts, loops seamless, 576 KB.
- Validation (`classical-infantry.validation.json`): every check passes. Team coverage 29.5%,
  head top at 1.00 m, body footprint 0.46 x 0.24 m (the sword arm reaches past the brief's 0.5 m
  width guide only with the blade), lowest vertex in any frame -0.8 cm, walk ground speed 1.22 m/s.
- The game loads it: `hasSoldierOverride('classical','infantry')` is true in the battle sandbox,
  `ingame-phone.png` and `ingame-close.png` are the sandbox at 844 x 390.
- Previews: `sheet_hero.png` (300 px, blue and orange), `sheet_small.png` (150, 60, 40 px),
  `sheet_dirs.png` (the 8 sprite directions), `sheet_clips.png` (one frame per clip),
  `sheet_map.png` (the map camera on grass, desert and snow at 95 and 24 px).

## Decisions and deviations from the brief
- The shield is 0.22 x 0.36 m at game scale (a real scutum would be about 0.38 x 0.6 at this
  scale) and the rim is iron, not team paint: at the brief's size the team coverage was 51%, far
  over the 15 to 30% band. This is the one visible departure from the concept.
- Walk speed: the brief's 1.6 m/s needs a 0.64 m step for a 1.0 m figure, which looks wrong. The
  cycle runs at 1.22 m/s; the game moves squads at its own speed, so the check accepts 0.9 to 2.0.
- The "feet pinned at contact" check of brief section 8 contradicts in-place animation: a planted
  foot must slide backward at walking speed. The validator checks that ground speed instead.
- The game scales the model to 1.0 including the helmet ridge (1.065 m), so in battle the
  figure stands 6% shorter than the brief's head height. Harmless; worth a loader option later.
- Motion is keyed from the brief's frame tables, not motion capture.

## Pipeline (scripts/blender/)
- `ti_blender.py`: camera, sun and sky, materials, the rig, the part builder, clip keying, a
  ground pass (no frame ever dips below the floor), GLB export.
- `build_classical_infantry.py`: the unit. `validate_unit.py`: brief section 8 as code.
  `render_previews.py`: the preview set and contact sheets. `render_sprites.py`: brief 7.2 sheets
  (192 px cells, 8 directions, 15 fps, WebP colour plus a PNG team and skin mask from an AOV).
- Setup: `python3.11 -m venv bpyenv && bpyenv/bin/pip install bpy==4.2.0`, then
  `bpyenv/bin/python scripts/blender/build_classical_infantry.py <out_dir>`.
- Sprite sheets are not committed (the game has no sprite renderer yet); a full set renders in
  about an hour on four CPU cores.

## Cost
About 2 hours wall clock in one Claude Code session, including five build and validate rounds.
