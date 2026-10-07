# Decorative Bronze battlefield props

`props-bronze.glb`: fence-a, field-wall-a, well, cart, haystack, crate, barrel,
market-stall, standard, campfire, shrine, road-marker. Each named root has LOD0,
LOD1, LOD2 with one shared 1024 color+AO atlas, matte Town and neutral grey Team cloth.
1 model unit = 10 metres, ground origin, glTF+Y up and +Z front. No alpha ground plates.

Source: scripts/blender/build_props_bronze.py; editable delivery in art-build/props-bronze.
Geometry and procedural texture synthesis are original, CC0-1.0. The generated 2D
sheet is a design reference only and is not sampled or embedded in the texture.

Placed by `src/battle/art/battleProps.js` (BattleRenderer): standards in the side's colour before the
keep and at the attacker's camp, a well, cart, stalls, crates, barrels, haystacks and a shrine round
the keep or in the city, a campfire and stores at the camp, marker stones by the roads, and up to
three farm corners (fences, a field wall, haystacks) in the open. Decorative only (no tiles, no
sim state); a prop under a new economy building hides. Scale: 2.75 battle tiles per model unit.
The age's file, else an earlier age's, but never for a Modern battle.
Campfire geometry is intentionally unlit logs; flames are a separate runtime effect.

