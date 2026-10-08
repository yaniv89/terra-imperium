# Wave 6 checkpoint 37: the Gunpowder battle walls as a bastion trace

2026-10-08, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). A known gap closed (checkpoint
29: "the wall kit keeps the shared wall-piece shapes (with merlons), in the age's stone; a true bastion
trace in battle would need new wall pieces"). The queue item `battle-city/gunpowder/wall-kit` is
re-delivered. [Manifest](manifest.json), [checksums](SHA256SUMS.txt), [contact sheet](contact.png): a
Gunpowder city ringed by the new curtain in the battle sandbox at 844x390 (wide and close, Europe and
Levant) and the Blender proof of all 15 pieces. Shots: `plans/art/shots/wave6/walls-bastion-gunpowder/`.

## Delivered
`src/assets/battle/city/walls-gunpowder.glb` replaced (0.67 MB packed, -0.15 MB against the old kit),
built by the new `scripts/blender/build_walls_bastion_gunpowder.py` (called by build_city_gunpowder.py),
with the same pieces, sizes and origins as every age's wall kit:
- wall-straight: 10 m of curtain, a low battered grey stone scarp, a sandstone cordon, a turf parapet and
  rampart (ti_gunpowder.curtain, the map walls' own section), no merlons;
- wall-corner: two half curtains and a round stone sentry box (echauguette) under a slate cap on the salient;
- tower: an arrow-head bastion pointing out, with its gun platform and cannon (ti_gunpowder.bastion);
- gate-open, gate-closed: the sandstone gatehouse with its arched doors (shut, or the passage dark);
- each -damaged (the parapet bitten, the gun knocked askew, scarp rubble, shot craters) and -breached (the
  curtain down to stubs either side of a ramp of stone and turf).
LOD0 and LOD1 are the full section; LOD2 is one block per run (the 80-triangle far budget).
validate_model.py `auto`: pass.

## Wired
Nothing new: `artIndex.walls('gunpowder')` draws the file; the city layer places the same pieces.
No console errors.
