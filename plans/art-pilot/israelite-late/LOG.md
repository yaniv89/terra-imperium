# Israelite towns, all five ages: re-toned and completed (checkpoints 01 to 04, quality revision 01)

## Why the Israelite towns were dark, and the fix
The towns in the game measured Town 0.155 to 0.19 and Team about 0.10 (mean HSV value of the base
colour texels under the LOD0 faces, `node scripts/art/town-tone.mjs`), against Town 0.27 to 0.30 and
Team 0.34 to 0.43 for the Levant towns of the same age. They had been built from the first
deliveries, which darkened the atlas twice (quality-revision-01/README.md). Every Israelite delivery
now in the repository (checkpoints 01 to 04, with the five quality-revision items overriding) already
follows the corrected workflow: base colour PNG light and undarkened (value 0.63 to 0.83 under Town),
AO once as COLOR_0 between 0.70 and 1.00 (checked in each model.glb).

So every Israelite town and shared file is rebuilt from those deliveries. `assemble_kit_towns.py`
reads only the base colour image and bakes its own AO once (ti_town.build_file); it does not read
COLOR_0, and the town files carry none, so nothing is darkened twice. The buildings keep the
delivered COLOR_0, which three.js multiplies in once (GLTFLoader turns on vertexColors);
townAssets.js, buildingLayer.js and the wonder path add no darkening of their own.

Two re-tones, pattern untouched (an HSV value scale on a copy of the kit image, as RETONE_TOWN does):
- Team (`TEAM_TONE`): the delivered mid-grey cloth (value about 0.52) baked to 0.28. The game
  multiplies Team by the nation colour, so the Team faces are lifted before the bake to come out at
  about 0.37 (measured bake loss 0.55). Result: 0.31 to 0.37.
- The Modern colony camp (`RETONE_AGE`): with the Bronze camp's numbers it kept Ground 0.264,
  Team 0.248 and Town 0.262. Its tall tents and vehicles lose more in the bake, so its losses are
  scaled by what it kept. Result after the bake: Ground 0.378 (target 0.375), Team 0.362, Town 0.320.

```
python scripts/blender/assemble_kit_towns.py <kits>/israelite <age> israelite <out_dir> 2048      # age: bronze .. modern
python scripts/blender/assemble_kit_towns.py shared-towns <towns>/<age> <age> israelite <out_dir> 2048
python scripts/blender/import_model.py <buildings>/<id>-israelite/model.glb <out>/<id>-israelite.glb <id> landmark
```

## Files (values measured on the packed files in the game)
Heights in units (1 unit = 10 m); every file passes `validate_model.py` (`*.validation.json` here;
towns at footprint 4 / 6 / 8 and their height; shared objects at their measured size, camp and
fields on the landmark budget as before). No town needed the LOD1 retry.

| File | Houses (poor/common/rich) | Landmarks (scale) | LOD0 / LOD1 / LOD2 | Height | Town | Team | Ground |
|---|---|---|---|---|---|---|---|
| bronze-town-big-a-israelite | 23 (14/7/2) | landmark-1 (1.00), landmark-2 (1.00) | 34586 / 7603 / 735 | 1.25 | 0.319 | 0.340 | 0.440 |
| bronze-town-big-b-israelite | 23 (14/7/2) | landmark-2 (1.00), landmark-1 (1.00) | 34282 / 7603 / 735 | 1.25 | 0.320 | 0.337 | 0.443 |
| bronze-town-medium-a-israelite | 12 (9/2/1) | landmark-1 (0.86), landmark-2 (0.88) | 19132 / 4963 / 625 | 1.08 | 0.324 | 0.344 | 0.445 |
| bronze-town-medium-b-israelite | 12 (9/2/1) | landmark-2 (0.88), landmark-1 (0.86) | 19116 / 4963 / 625 | 1.08 | 0.325 | 0.348 | 0.444 |
| bronze-town-small-a-israelite | 7 (6/1/0) | landmark-1 (0.54) | 11080 / 3012 / 466 | 0.67 | 0.328 | 0.361 | 0.422 |
| bronze-town-small-b-israelite | 7 (6/1/0) | landmark-2 (0.55) | 10384 / 2963 / 465 | 0.64 | 0.326 | 0.362 | 0.425 |
| classical-town-big-a-israelite | 23 (14/7/2) | landmark-1 (1.00), landmark-2 (1.00) | 35171 / 7533 / 736 | 2.30 | 0.349 | 0.339 | 0.475 |
| classical-town-big-b-israelite | 23 (13/8/2) | landmark-2 (1.00), landmark-1 (1.00) | 35825 / 7533 / 736 | 2.30 | 0.350 | 0.334 | 0.464 |
| classical-town-medium-a-israelite | 12 (9/2/1) | landmark-1 (0.85), landmark-2 (1.00) | 19761 / 4893 / 626 | 2.30 | 0.349 | 0.336 | 0.473 |
| classical-town-medium-b-israelite | 12 (9/2/1) | landmark-2 (1.00), landmark-1 (0.85) | 19617 / 4893 / 626 | 2.30 | 0.347 | 0.334 | 0.476 |
| classical-town-small-a-israelite | 7 (6/1/0) | landmark-1 (0.53) | 11493 / 3012 / 466 | 0.64 | 0.338 | 0.354 | 0.454 |
| classical-town-small-b-israelite | 7 (6/1/0) | landmark-2 (0.70) | 10160 / 2893 / 466 | 1.60 | 0.362 | 0.363 | 0.451 |
| gunpowder-town-big-a-israelite | 22 (14/6/2) | landmark-1 (0.99), landmark-2 (0.98) | 36481 / 7412 / 726 | 2.32 | 0.325 | 0.307 | 0.463 |
| gunpowder-town-big-b-israelite | 22 (16/3/3) | landmark-2 (0.98), landmark-1 (0.99) | 37774 / 7412 / 726 | 2.32 | 0.330 | 0.312 | 0.466 |
| gunpowder-town-medium-a-israelite | 12 (9/2/1) | landmark-1 (0.83), landmark-2 (0.82) | 23066 / 5012 / 626 | 1.95 | 0.332 | 0.316 | 0.467 |
| gunpowder-town-medium-b-israelite | 12 (9/2/1) | landmark-2 (0.82), landmark-1 (0.83) | 23274 / 5012 / 626 | 1.95 | 0.332 | 0.320 | 0.471 |
| gunpowder-town-small-a-israelite | 6 (5/1/0) | landmark-1 (0.52) | 12152 / 2772 / 456 | 1.22 | 0.343 | 0.334 | 0.464 |
| gunpowder-town-small-b-israelite | 7 (6/1/0) | landmark-2 (0.51) | 13003 / 3012 / 466 | 0.93 | 0.331 | 0.328 | 0.452 |
| kingdoms-town-big-a-israelite | 23 (14/7/2) | landmark-1 (1.00), landmark-2 (1.00) | 34787 / 7645 / 735 | 2.30 | 0.324 | 0.339 | 0.471 |
| kingdoms-town-big-b-israelite | 23 (14/6/3) | landmark-2 (1.00), landmark-1 (1.00) | 35689 / 7645 / 735 | 2.30 | 0.327 | 0.335 | 0.472 |
| kingdoms-town-medium-a-israelite | 12 (9/2/1) | landmark-1 (0.85), landmark-2 (0.99) | 20129 / 5005 / 625 | 2.29 | 0.315 | 0.339 | 0.477 |
| kingdoms-town-medium-b-israelite | 12 (10/1/1) | landmark-2 (0.99), landmark-1 (0.81) | 19091 / 5005 / 625 | 2.29 | 0.315 | 0.345 | 0.478 |
| kingdoms-town-small-a-israelite | 7 (6/1/0) | landmark-1 (0.53) | 11781 / 3012 / 465 | 0.64 | 0.294 | 0.352 | 0.457 |
| kingdoms-town-small-b-israelite | 7 (7/0/0) | landmark-2 (0.62) | 9346 / 3005 / 466 | 1.43 | 0.348 | 0.370 | 0.461 |
| modern-town-big-a-israelite | 22 (14/6/2) | landmark-1 (0.85), landmark-2 (1.00) | 28484 / 7151 / 726 | 3.85 | 0.314 | 0.340 | 0.326 |
| modern-town-big-b-israelite | 22 (15/5/2) | landmark-2 (1.00), landmark-1 (0.85) | 27598 / 7151 / 726 | 3.85 | 0.310 | 0.335 | 0.326 |
| modern-town-medium-a-israelite | 12 (9/2/1) | landmark-1 (0.53), landmark-2 (1.00) | 16584 / 4751 / 626 | 2.40 | 0.326 | 0.351 | 0.332 |
| modern-town-medium-b-israelite | 12 (9/2/1) | landmark-2 (1.00), landmark-1 (0.53) | 16584 / 4751 / 626 | 2.40 | 0.326 | 0.344 | 0.342 |
| modern-town-small-a-israelite | 6 (5/1/0) | landmark-1 (0.35) | 9168 / 2720 / 456 | 1.86 | 0.335 | 0.364 | 0.332 |
| modern-town-small-b-israelite | 6 (6/0/0) | landmark-2 (0.75) | 6174 / 2511 / 456 | 1.48 | 0.326 | 0.356 | 0.337 |
| shared-bronze-israelite | - | - | - | - | 0.373 | 0.421 | 0.346 |
| shared-classical-israelite | - | - | - | - | 0.552 | 0.439 | - |
| shared-gunpowder-israelite | - | - | - | - | 0.584 | 0.424 | - |
| shared-kingdoms-israelite | - | - | - | - | 0.422 | 0.396 | - |
| shared-modern-israelite | - | - | - | - | 0.330 | 0.364 | 0.380 |
Levant towns of the same age for comparison: Town 0.27 to 0.33, Team 0.34 to 0.43. The base
shared files: Town 0.29 to 0.39. The Classical and Gunpowder walls come out lighter (0.55 to
0.57, pale ashlar as delivered); left as they are.

Shared files: Bronze (palace-small, palace, walls-medium, colony-camp, field-1 to field-4),
Classical (palace-small, palace, walls-medium), Kingdoms (palace-small, palace: a new file; its
walls come from shared-kingdoms-levant.glb), Gunpowder (walls-medium: new; palaces and the other
walls from shared-gunpowder.glb), Modern (colony-camp: new, checkpoint-04; the rest from
shared-modern.glb).

Towns new in this round: Kingdoms (checkpoint-02 houses, checkpoint-03 street, roofscape,
materials and landmark-2, quality-revision landmark-1, the tiled basilica synagogue with a basalt
facade), Gunpowder (checkpoint-03) and Modern (checkpoint-03, quality-revision houses: kibbutz
cottage, stone apartment with a solar water heater, Bauhaus house on pilotis). Classical is rebuilt
with the revised Galilean synagogue as landmark-1. The Modern small towns' landmarks are scaled
down to 0.35 (small-a) to fit the 40 m town.

## Buildings
The ten buildings are re-imported from the current checkpoint-02 deliveries (library and
scriptorium now have shapes of their own). Effective value with COLOR_0: 0.47 to 0.54 (market
0.33), against 0.10 to 0.18 before. That is lighter than the towns (about 0.32), as delivered:
pale limestone, AO once. Not darkened to match; worth a look by the lead next to a town.

## Game side
`styleOfLand('il', age)` is `israelite` in every age and falls back to `levant`, then the base
(architecture.js). townAssetUrl and sharedAssetUrls follow that chain, so every age now finds the
Israelite town files and its shared file first. Tests: townAssets.test.js (every age and size, the
shared chain) and scripts/art/town-tone.test.mjs (a Town or Team below the Levant level fails).

## Browser check
`node plans/art-pilot/israelite-late/jerusalem-shots.mjs` (with `npx vite` running) sets each age
by LOAD_GAME and frames Jerusalem as a medium town with walls and palace. Ramallah, a Levant-style
town (Palestine), stands next to it in the same frame. Screenshots:
`<age>-jerusalem-desktop.png` and `<age>-jerusalem-phone.png` (844x390), and
`bronze-jerusalem-desktop-before.png` (the old files).
