# Terra Imperium: model brief for Claude (paste this whole document)

You are the 3D artist, rigger, animator and technical artist for **Terra Imperium**, a grand
strategy game on a real Earth map with real-time tactical battles, built for phones first. You
turn the reference images of `plans/art-image-spec.md` into game-ready models in **Blender 4.x**
driven by Python (`blender -b --python`, or a Blender MCP connection), and you deliver files the
developer drops into the repository unchanged. Work in phases, **STOP** at every checkpoint
marked STOP, and keep the log of section 12.

This brief replaces the two older ones (`town-art-brief.md`, `unit-art-brief.md`). Where they
disagree with this file, this file wins. The big change: **detail follows the zoom**. The game
draws icons when zoomed out and real models only from the close zoom; at the super zoom one
town fills the screen. So you build one full-detail textured model per asset and the pipeline
derives the lower levels of detail. The old "1,500 flat-colour triangles" rule is gone.

---

## 1. How the game shows your models

### 1.1 Zoom bands (the flat map)

| Band | Zoom k | What is drawn | Models on screen |
|---|---|---|---|
| world | the globe | icons only | none |
| region | 1 to 3 | icons only | none |
| local | 3 to 10 | the hexes, glyphs for improvements, districts and resources, roads | none |
| close | 10 to 40 | rendered land (real relief, terrain textures, rivers, roads) and your models | 60 towns at k 10 falling to 5 at k 40, a few soldier stacks, a few ships |
| super | 40 to 200 | the same scene up close | 1 to 4 towns, a few stacks |
| battle | its own screen | the battlefield | 200 to 300 soldiers, the battlefield's own buildings |

Nothing off screen is built or drawn. Every hex on screen is at the same scale, so the level of
detail is picked by **k**, not by distance: LOD2 at k 10 to 20, LOD1 at 20 to 40, LOD0 from 40.
The battle picks by distance from the camera as before.

### 1.2 Cameras

- **Close and super zoom (the map):** orthographic, looking from the south (glTF +Z is the side
  the camera sees), tilted from 55 degrees above the horizon at k 10 down to 30 degrees at k 200,
  so at the super zoom the player looks at a town's south face from a low angle. Design the south
  face and the roofs first; the north side needs no detail but must not be hollow.
- **Battle:** orthographic, fixed, direction from the target to the camera (1, 1.25, 1) in the
  game's Y-up space, which is (1, -1, 1.25) in Blender's Z-up space: elevation 41.5 degrees,
  azimuth 45 degrees.
- **Light (both):** one warm sun (#FFE7C2) from the upper left, a soft sky fill (#E3EEF8) and a
  ground bounce (#5A503F); per-vertex lighting plus your baked ambient occlusion and the normal
  map. There are no real-time shadows on phones: bake contact shadows into the atlas.

### 1.3 Scale and orientation

- **The map:** 1 game unit is 10 metres. A town's footprint is 40, 60 or 80 m (small, medium,
  big); a house is about 10 m wide. Heights are drawn real and then raised 1.3x in the model so
  roofs and towers read from above. Origin at the centre of the footprint at ground level,
  ground at Blender Z = 0, the front facing **Blender -Y** (exports to glTF +Z). Apply all
  transforms. Nothing below Z = 0.
- **Battle units:** a person is 1.0 m tall in Blender (the game scales to 1.8 m), a horse and
  rider 1.4 m, a chariot 1.2 m, machines 0.9 to 1.1 m, a trebuchet 2.2 m, a tank 1.0 m, the jet
  0.5 m thick with a 1.8 m wingspan. Origin between the feet at Z = 0, facing -Y.
- **Ships:** real length divided by 10 (a trireme 3.7 units long), the waterline at Z = 0, the
  hull below it kept (the game sinks the model 0.2 units into the water plane), the bow facing
  -Y.

### 1.4 Team colour

The owner's nation colour (12 strong colours, cyan to deep purple, plus the player's blue) is
applied by the game to every surface on the `Team` material. Author those surfaces in neutral
light grey (#BFBFBF average) with greyscale folds, wear and dirt so the tint looks like dyed
cloth, not paint. Keep team colour to 15 to 20% of what the camera sees on a unit, and to
flags, banners, awnings and pennants on buildings and ships. Never put a word like team, flag,
banner, tabard, cloak, livery, crest, emblem or heraldry in any other material or object name.

---

## 2. Budgets (triangles and textures)

Set by what each band shows at once, not by a global cap.

| Asset | LOD0 (super zoom, k 40 and up) | LOD1 (k 20 to 40) | LOD2 (k 10 to 20) | Atlas |
|---|---|---|---|---|
| Town kit house (per house type) | 2,500 | 600 | 120 | the kit's 4K atlas |
| Landmark, building, palace | 15,000 | 3,000 | 500 | the kit's 4K atlas |
| Whole town (layout x kit, assembled) | 60,000 | 10,000 | 1,500 | the kit's 4K atlas |
| Wall ring | 12,000 | 2,500 | 400 | the kit's atlas |
| Wonder (tier 3) | 60,000 | 10,000 | 1,500 | its own 4K atlas |
| Improvement on a tile | 8,000 | 1,500 | 300 | a shared 2K improvements atlas per age |
| Ship | 12,000 | 3,000 | 400 | its own 2K atlas |
| Soldier (map and battle game model) | 8,000 | 1,500 | imposter | 2K per unit, a shared skin atlas |
| Horse and rider, chariot | 12,000 | 2,500 | imposter | 2K |
| Machine, vehicle, aircraft | 12,000 | 3,000 | imposter | 2K |
| Battlefield building | 20,000 | 4,000 | 600 | the age's atlas |

Textures: base colour with baked ambient occlusion (sRGB), a normal map (linear), and one
packed map (roughness in G, metalness in B, cavity in R). WebP for colour, PNG for normals,
through Blender's glTF exporter with "WebP" image format where it is lossless enough; **no
texture over 4096 and no more than one atlas set per kit, wonder, ship or unit**. LOD1 and LOD2
reuse the LOD0 atlas (lower mip levels do the rest). Imposters (a billboard of the LOD1 render
from 8 directions, 256 by 256 per direction) are generated by `scripts/build_imposters.py`, not
by hand.

**Generated, not hand-built.** You model and texture LOD0. The pipeline makes LOD1 and LOD2
with Blender's decimate (planar for buildings, collapse for organics) at the ratios above, then
you fix what broke (a roof ridge, a spire, a sail edge) and keep the silhouette. Both lower
levels keep the LOD0 material and UVs. A town's LOD2 is its roofs, its landmark and its ground
patch.

Size on disk: a kit file at most 12 MB (the atlas is most of it), a wonder 6 MB, a ship 3 MB, a
unit 3 MB. The game loads a file only when something of that age and style is on screen.

---

## 3. Materials and names the game reads

**Map models** (kits, landmarks, buildings, palaces, walls, wonders, improvements, ships):
- `Town`: everything that is not one of the others;
- `Ground`: the ground patch under a town or improvement, its edge alpha-cut (glTF alphaMode
  `MASK`, cutoff 0.5), never blended, 0.02 to 0.05 units high, irregular;
- `Team`: flags, banners, awnings, sails, pennants (section 1.4);
- `Glass` (modern only): windows, dark blue-grey, may glow at night later;
- `Water` (ships only): none; the game draws the water.

**Units** (the battle and the map soldiers):
- `Team`, `Skin`, `Hair`, and descriptive others: `Leather`, `LeatherDark`, `Bronze`, `Iron`,
  `DarkMetal`, `Wood`, `Linen`, `ClothDark`, `Rope`, `Rubber`, `Glass`, `Olive`;
- never `Emblem`; skin-like names only on `Skin`.

One UV map, no overlapping islands on unique areas (tiling trims may overlap), no vertex
colours, closed meshes, no interiors, no hidden faces on LOD1 and LOD2.

---

## 4. The asset kinds and how each is built

### 4.1 Town kits (the regional kits of the art spec, section 3b)

A town is **layout x kit**. The layouts are the game's (`src/components/map/closeView/
townLayouts.js`, delivered with the pilot): for each age and town size (small, medium, big)
and variant (a, b), a list of slots with a position, a rotation, a kind (`house-poor`,
`house-common`, `house-rich`, `landmark-1`, `landmark-2`, `palace`, `prop`), and the lanes and
the square as ground paths. A kit supplies what stands on the slots.

A kit file is `kit-{age}-{style}.glb` with these objects at the scene root, each with `LOD0`,
`LOD1`, `LOD2` children:
- `house-poor-1` to `-3`, `house-common-1` to `-3`, `house-rich-1` to `-2`: the house types
  with their yard walls; footprint 1.0 by 1.0 units (poor) to 1.6 by 1.2 (rich);
- `landmark-1`, `landmark-2`: the two signature buildings of that region and age;
- `prop-1` to `prop-6`: the small things (a well, a shrine, jars, racks, a loom, a canoe, a
  cart), under 0.3 units, no LODs;
- `ground-lane`, `ground-square`: tiling ground pieces 1 by 1 units for the lanes and the
  square, `Ground` material, flat;
- `tree-1` to `tree-3`: the region's trees, 0.6 to 1.2 units, LOD0 and LOD1 only.
The Kingdoms kit of each style adds `palace`, `palace-small` and `walls-medium`; every other
age shares the palaces and wall rings of the shared file (4.2).

The game assembles the town at load time and merges it into one instanced mesh per (layout,
kit, LOD), so reuse within a kit is free. Variation comes from the layouts and from the three
house types; do not make ten house models.

### 4.2 Shared age files

`shared-{age}.glb`: `palace`, `palace-small`, `walls-small`, `walls-medium`, `walls-big`,
`colony-camp`, `field-1` to `field-4`, the 38 building landmarks of the art spec's section 4
by their ids (`granary`, `library`, `market` and so on, the age's tiers only), and the age's
improvement models (section 4.4). Objects at the root with LOD children as above.

### 4.3 Wonders

`wonder-{id}.glb` with `tier1`, `tier2`, `tier3` at the root, each with LOD children, a shared
atlas, the footprint up to 12 units, the origin at the centre of the tile. Tier 1 is a finished
first stage, not a construction site; tier 3 is the whole monument.

### 4.4 Improvements and districts

In `shared-{age}.glb`: `farm`, `pasture`, `camp`, `mine`, `quarry`, `lumber_camp`,
`fishing_boats`, `plantation`, `oil_well`, `fort`, each a scene of about 5 by 5 units
(scaled to the hex by the game), flat `Ground` under it, and the ancient or modern version by
age as the art spec says. Districts reuse the landmark of their line (`library` for the Campus,
`temple` or `shrine` for the Temple Quarter, `market` for the Market Quarter) placed by the
game on the district's tile.

### 4.5 Ships

`ship-{line}-{age}.glb`: `hull` at the root with LOD children, sails and pennants on `Team`,
oars as separate objects named `oars` (the game animates them), a `wake` plane is not needed.
Real length divided by 10, waterline at Z = 0.

### 4.6 Units (the battle)

Exactly the old unit brief's rig and clips, with the new budgets:
- **One armature**, these bone names: `hips`, `spine`, `chest`, `neck`, `head`,
  `upper_arm.L/R`, `lower_arm.L/R`, `hand.L/R`, `upper_leg.L/R`, `lower_leg.L/R`,
  `foot.L/R`; optional `weapon` (child of `hand.R`), `shield` (child of `hand.L`), `quiver`,
  `cape` (child of `chest`); helper bones prefixed `x_` are allowed on the render model and
  must carry no weight on the game model. Horses: `horse_root`, `horse_spine`, `horse_neck`,
  `horse_head`, `horse_tail`, `leg_front.L/R`, `leg_front_lower.L/R`, `leg_back.L/R`,
  `leg_back_lower.L/R`; the rider's `hips` parented to `horse_spine`. Machines and vehicles: no
  skeleton; objects `body`, `turret`, `barrel`, `wheel.FL/FR/BL/BR`, `track.L/R`, `arm`,
  `sling`, `counterweight`, `rotor`; crew as separate rigged people parented to `body`.
- **Clips** at 30 fps, in place, seamless loops, Idle frame 1 the rest pose: `Idle`,
  `IdleAlt`, `Walk`, `Run`, `Attack`, `Attack2`, `Block` or `Reload` by archetype, `Hit`,
  `Death`, `DeathAlt`, `Rout`, `Victory`; cavalry add `Charge` and `Rear`; chariots the
  horse set plus the archer's; machines and vehicles their own (`Fire`, `Reload`, `Move`,
  `Destroyed`); the jet `Fly`, `Strafe`, `Bank`. Strides match the game's speeds: infantry
  walk 1.6 m/s and run 2.6, cavalry 3.2 and 5.0, siege 0.9. Contact frames held two frames.
- **Game model** LOD0 8,000 triangles with the 2K atlas, rigid weights (one bone per vertex)
  on LOD1 and smooth on LOD0; the imposters generated.
- The same model stands on the map at the close and super zooms (1 to 3 soldiers per stack).

---

## 5. Export

- GLB, **uncompressed** (no Draco, no Meshopt), +Y up, +Z forward, modifiers applied, all
  actions included, textures embedded, no cameras or lights.
- File names and object names exactly as in section 4; an object's children named `LOD0`,
  `LOD1`, `LOD2`.
- Map files go to `src/assets/raw-models/map/`, unit files to `src/assets/raw-models/units/`;
  `npm run import:models` builds `src/assets/units/`, and `npm run import:map-models` (to be
  written with the pilot) builds `public/models/`.
- Every delivery ships with `manifest.json` written by your validation script: per object and
  LOD the triangles, the footprint, the height, the materials, the atlas size and the file size.

---

## 6. Validation (automated, before every delivery)

Write `scripts/validate_model.py` (run in Blender) that writes `reports/{file}.validation.json`
and fails the file on any of:
- triangles over the section 2 budget at any LOD; a missing LOD;
- footprint or height off the spec by more than 5%; any vertex below Z = -0.01; not facing -Y;
  transforms not applied;
- a material name outside section 3; `Emblem` anywhere; a reserved word in a non-team name;
- `Ground` not alpha-cut; a texture over 4096; more than one atlas set per file;
- units: a bone or object name missing, a vertex unweighted, an `x_` bone weighted on the game
  model, a clip missing, a loop that does not close, feet sliding during a contact frame;
- team coverage on a unit outside 15 to 30% of its opaque pixels at the battle camera;
- a GLB re-import that loses an action, a bone or a material name.
Also write `scripts/build_lods.py`, `scripts/build_imposters.py` and `scripts/render_previews.py`
so any file can be rebuilt from its .blend with one command.

---

## 7. Previews with every delivery

Per file, PNGs from the game's own camera: the close view at k 10 (the asset 90 pixels wide on
a 844 by 390 frame), k 40 and k 150, on grass green and on a strong nation blue (#3B82F6), and
for units the battle camera at 60 pixels tall in all 8 directions. The developer judges from
these before loading anything.

---

## 8. Style bible

- **Realistic, not stylised**: grounded historical realism in the manner of Age of Empires IV
  and Humankind for towns and land, Total War for soldiers. Real proportions (a head is 1/7.5
  of a body), real materials, weathering and wear, no chunky shapes, no flat colour.
- **Regional truth**: the kits follow the art spec's region notes exactly. A Levant village and a
  Sinic village share nothing but the ground.
- **Readable at the first close zoom**: at k 10 a town is 90 pixels wide. Roof colour, the
  landmark's silhouette and the street rhythm must tell the age and the region at that size.
- **No text, no real flags or emblems, no logos.** Models may be mirrored by the game.

---

## 9. Phases and checkpoints

1. **Pipeline first.** The validation, LOD, imposter and preview scripts, run on a placeholder
   cube, with their reports. **STOP.**
2. **Pilot: the `europe` Kingdoms kit** (houses, two landmarks, props, trees, the palace, the
   small palace, the medium wall ring) and the `town-medium-a` layout assembled, with previews
   at k 10, 40 and 150. **STOP.** The developer loads it in the game and reports back.
3. **Pilot: `classical-infantry`** (Swordsmen) with its rig, clips, LODs, imposters and the
   battle previews. **STOP.**
4. The four priority kits (`europe`, `levant`, `sinic`, `indic`) across the five ages, one age
   at a time, each with its shared file. **STOP** after each age.
5. Wonders (15), then ships (14), then the remaining units (24), then the other seven kits.
   **STOP** after each group.

---

## 10. What the developer gives you

- `plans/art-image-spec.md`: every asset, its id, its references and its views.
- `plans/art/`: the reference images as they arrive.
- `townLayouts.js` (with the pilot) and the three battle camera and light values above.
- Answers within a checkpoint. Do not guess a missing reference; ask.

## 11. Rules

- Deterministic scripts: the same .blend and the same command give the same GLB.
- Never hand-edit a generated file; fix the script.
- Keep the .blend files, the textures' source files (the PSD or the Substance project) and
  the scripts in the delivery.
- Licensing: everything you make is original or CC0; motion capture only with a licence that
  allows redistribution in a game; keep the licence files next to the sources.

## 12. Log (`LOG.md`)

One entry per asset: the date, the time taken, the triangle counts per LOD, the atlas size,
the file size, the validation result, the revision rounds, and what you would change next time.
