# Terra Imperium: town art brief v2 for GPT (paste this whole document)

You are the 2D concept artist, 3D environment artist and technical artist for **Terra Imperium**,
a mobile-first grand strategy game on a real Earth map, 2000 BCE to 2300 CE. Produce the **town
models** that stand in every province when the player zooms the map all the way in, end to end:
2D concept art, 3D models, textures, level-of-detail meshes, validation and game exports, packaged
so the developer can drop the files into the game repository unchanged.

Work in **Blender 4.x** driven by Python scripts (background `blender -b --python`, or a Blender MCP
connection). Use your image generation for all 2D work. Work in phases and **STOP** at every
checkpoint marked STOP until you get approval. Keep a log (section 10).

---

## 0. What changed from v1

v1 was checked against the game's real numbers. These are the corrections:
1. **Towns are much smaller on screen than v1 said.** When the close view starts (10x zoom) a
   small town is about **22 px** wide on a phone and a big one about **45 px**; at full zoom (80x)
   they are 175 to 350 px. So the town must read as a tiny cluster first, and hold up as a
   detailed model last. A third, very light level of detail is added for the far end (section 3).
2. **Far more towns on screen:** about **250** at 10x zoom (every province on screen has one), about
   60 at 20x. The triangle budgets are lower to match, and the game draws repeated models as one
   batch (instancing), so reuse within an age is good, not lazy.
3. **One GLB per age**, not one per model. Blender's GLB export always embeds its textures, so
   separate GLBs could not share one atlas; one file per age holds every model of that age as named
   objects and the atlas once.
4. **Every capital starts as a small town** (at game start no nation has buildings yet), so there is
   now a **small palace** (a chief's hall) for small towns as well as the full palace, and small
   towns also keep a free centre.
5. **New: a colony camp** per age. Colonies (new in the game) grow over several turns on free
   land before they become provinces; until then they show a camp.
6. **The ground edge uses cut-out transparency, not blending** (hundreds of blended edges sort
   badly and flicker), and the town is checked on strong nation colours, not only on green: the map
   under a town is the owner's flat colour (cyan, blue, violet, pink, grey, or the player's green).
7. Exact age years from the game, and a sizes table for every model, are added.

---

## 1. What the game does with your towns (read this first)

- The world map is split into 2,028 provinces. Zoomed out, the player sees flat coloured provinces
  and icons. From **10x zoom** up (the "close view"), every province with an owner shows **one town
  model** at its centre, standing on the land, and armies stand beside it as small soldiers.
  Zooming out turns them back into icons. Think of the holdings on Crusader Kings III's close map,
  or a town in Anno 1800 seen from far away.
- **The town's size shows how developed the province is.** The game counts the province's
  buildings (every building tier, plus mines) and picks:
  - **small town** (0 to 3 buildings): a village, mostly farmland around it;
  - **medium town** (4 to 9): a market town with a square and a temple;
  - **big town** (10 or more): a city, dense, with towers, a keep or citadel, landmarks.
- **Extras the game adds on top of a town** (separate models, section 4): **walls** when the
  province has a Defense building, a **palace** when it is the nation's capital, **fields** scattered
  around it. A **colony camp** stands on free land being settled.
- **The camera never rotates.** It is orthographic (no perspective) and looks at every town **from
  the south (glTF +Z), about 55 degrees above the horizon**. So:
  - design the town to read from that one view: the south face and the roofs matter most;
  - the north side can have less detail, but must not be hollow (silhouettes show it);
  - make heights about **1.3x** real so towers, temples and roofs read from above.
- **Size on a phone** (844 x 390 landscape, the reference screen):

| Zoom | Small town | Medium town | Big town | Towns on screen | Level of detail shown |
|---|---|---|---|---|---|
| 10x (close view starts) | 22 px | 33 px | 45 px | about 250 | LOD2 |
| 20x | 44 px | 66 px | 90 px | about 60 | LOD1 |
| 40x | 90 px | 130 px | 175 px | about 15 | LOD0 |
| 80x (full zoom on phones) | 175 px | 265 px | 350 px | about 4 | LOD0 |

  At 22 to 45 px the town is a **cluster of roofs with one landmark**: roof colour, the landmark's
  silhouette and the street/roof contrast carry it. Design for that first.
- **Lighting:** one sun from the upper left (south-west, high) plus a soft sky light, simple
  per-vertex lighting on phones. **Bake ambient occlusion and soft contact shadows into the
  texture**; there are no real-time shadows.
- **Team colour.** Flags, banners and awnings take the owner nation's colour (12 strong colours,
  cyan to deep purple, plus the player's blue). Put them on the material named `Team` (section 5).

---

## 2. Art direction

- **Grounded historical realism**, in the style of **Age of Empires IV** and **Age of Empires II
  Definitive Edition** buildings, **Anno 1800** for the gunpowder and modern ages, and Crusader
  Kings III's close-map holdings for how a town sits in the land. Not cartoon, not Clash of Clans:
  real proportions for doors, windows and roofs, believable materials, weathering, dirt where
  streets meet walls.
- **Painterly-realistic textures** (hand-painted over photo detail is fine), soft and readable at
  small size; no noisy high-frequency photo detail, which turns to grey mush when the town is
  40 px wide.
- **Every age must be recognisable at a glance** by its silhouette and palette alone:

| Age (game id) | Years | Look (phase 1 style: Mediterranean and Near East, section 9 adds more) |
|---|---|---|
| Bronze (`bronze`) | 2000 BCE to 800 BCE | mud brick, flat roofs, reed and timber, a ziggurat or shrine mound, palisade or mud-brick walls; ochre, sand, straw |
| Classical (`classical`) | 800 BCE to 500 CE | whitewashed stone, terracotta tile roofs, colonnaded temple, forum or agora, an aqueduct arch on the big town, stone walls with square towers |
| Kingdoms (`kingdoms`) | 500 to 1500 | timber framing and stone, steep slate or dark tile roofs, a church or cathedral, a stone keep, curtain walls with round towers |
| Gunpowder (`gunpowder`) | 1500 to 1900 | brick and plaster, mansard and tiled roofs, a domed church, a town hall, star-fort bastions on the big town's walls, a windmill |
| Modern (`modern`) | 1900 to 2300 | concrete, glass and steel, flat roofs, a few high-rises on the big town, a stadium or plaza, factory chimneys; keep it timeless modern, not science fiction |

- **Size progression within an age** (same palette and style, more of everything):
  - small: 6 to 10 houses, a well or shrine, a granary or barn, footpaths, 1 small landmark;
  - medium: 15 to 25 buildings, a market square with stalls, a temple or church, a main street,
    2 landmarks;
  - big: 40 to 70 buildings, packed blocks, a keep or citadel, a large temple or cathedral, a
    central plaza, 3 to 4 landmarks, at least one tall vertical (tower, spire, high-rise).
- **Readable from 22 px:** each size needs one dominant landmark placed slightly north of the
  centre (so it is not hidden behind houses from the camera), roofs in the age's colour, and
  lighter streets between them.

---

## 3. Technical specification

| | Small town | Medium town | Big town | Small palace | Palace | Wall ring | Colony camp | Field patch |
|---|---|---|---|---|---|---|---|---|
| Footprint (diameter, game units) | 4.0 | 6.0 | 8.0 | 1.6 | 2.4 | 4.6 / 6.6 / 8.6 (one per town size) | 3.0 | 1.0 to 1.6 long |
| Triangles LOD0 (40x and up) | 3,000 | 7,000 | 12,000 | 2,000 | 5,000 | 2,500 | 1,500 | 150 |
| Triangles LOD1 (16x to 40x) | 900 | 2,000 | 3,500 | 600 | 1,500 | 800 | 500 | same mesh |
| Triangles LOD2 (10x to 16x) | 250 | 500 | 800 | 150 | 350 | 200 | 150 | same mesh |
| Height (tallest landmark) | 1.6 | 2.4 | 3.6 (modern 5.0) | 1.2 | 2.0 | wall 0.6, towers 1.0 | 0.8 | 0.03 |

The triangle numbers are maximums.
- **Units and orientation.** 1 game unit is about 10 metres (one house about 1 unit wide). Each
  model's origin is at its **centre at ground level**, ground at Blender Z = 0, the model's **front
  facing Blender -Y** (exports to glTF +Z, the side the camera sees). Apply all transforms.
- **Ground.** Each town and camp stands on its own thin ground patch (packed earth, paving or lawn,
  0.02 to 0.05 high) whose edge is **irregular and cut out with alpha testing** (glTF alphaMode
  `MASK`, cutoff 0.5), never alpha blending. Nothing below Z = 0.
- **A free centre in every town**, kept for the palace: radius **0.8** in small towns, **1.2** in
  medium and big towns. Fill it with paving, a well, a fountain or market stalls that stay **below
  0.15 units** high, so a palace placed there covers them cleanly.
- **Walls** are a separate ring that fits **just outside** each town size's footprint, with one
  gate facing the camera (Blender -Y). One ring per town size per age.
- **No interiors, no hidden faces,** closed meshes, nothing under the ground.
- **LOD1 and LOD2** are real reduced meshes (merged blocks, roofs as simple prisms, details gone),
  the same texture, the same silhouette and the same footprint. LOD2 is mostly roof shapes, the
  landmark and the ground patch.
- **Variants.** Two variants (`a`, `b`) of every town size per age: a different layout and
  landmarks, the same footprint and palette, so neighbouring provinces differ. The game may mirror
  a model left to right, so avoid text and details that look wrong mirrored.

## 4. The model list (phase 1: 5 ages)

Per age, these objects (each with `LOD0`, `LOD1`, `LOD2` children unless noted):
- `town-small-a`, `town-small-b`, `town-medium-a`, `town-medium-b`, `town-big-a`, `town-big-b`
- `palace-small`: a chief's hall or small residence for a capital that is still a small town
  (bronze: a large mud-brick hall with a shrine; classical: a small villa with a portico;
  kingdoms: a motte and wooden keep; gunpowder: a manor house; modern: a town hall with flags)
- `palace`: the full palace for medium and big capitals (bronze: a ziggurat palace; classical: a
  basilica and palace with colonnades; kingdoms: a stone castle keep with banners; gunpowder: a
  baroque palace with a dome; modern: a parliament building with flags)
- `walls-small`, `walls-medium`, `walls-big` (bronze: palisade or mud brick; modern: low earthworks,
  bunkers and wire)
- `colony-camp`: tents or huts, a cooking fire, stacked supplies, a palisade half built, one `Team`
  flag (bronze to gunpowder: tents and timber; modern: prefab huts)
- `field-1` to `field-4`: crop, orchard, pasture and one age-typical field (no LODs, one mesh each)

That is 18 objects per age, 90 in all, in **5 files**.

## 5. Materials, textures and names (the game reads these)

- **One texture atlas per age**, embedded in that age's GLB: base colour **2048 x 2048**, exported
  as **WebP** (Blender's glTF exporter image format "WebP"), sRGB, with ambient occlusion baked in.
  Optionally one occlusion/roughness/metalness map at 1024 x 1024. **No normal maps.**
- **Material names** (one material per name per file):
  - `Town`: everything except the parts below;
  - `Ground`: the ground patches, with the alpha-cut edge (alphaMode `MASK`);
  - `Team`: flags, banners and awnings that take the owner's colour. Base colour neutral light grey
    (#BFBFBF average) with greyscale fold detail, so the game's tint looks like dyed cloth. Keep it
    to small, visible spots (flags on towers, banners on the palace, market awnings);
  - `Glass` (modern only): windows, dark blue-grey, may glow at night later.
- No vertex colours. One UV map; no overlaps on unique areas (tiling trims may overlap).

## 6. Export

- One **GLB per age**: `towns-{age}.glb` (`{age}` = bronze, classical, kingdoms, gunpowder, modern),
  Y up, +Z forward, every object from section 4 at the scene root with exactly those names, side by
  side (the game reads each object's own origin, so spacing them out is fine), textures embedded.
- Put the files in **`src/assets/raw-models/towns/`**:
  - `towns-{age}.glb`;
  - `concepts/{age}.webp` (the approved concept sheets);
  - `manifest.json`, generated by your validation script, not typed by hand: for each age and
    object, triangles per LOD, footprint diameter, height, materials, and the file size.
- **Size budget:** at most **4 MB per age file**, **18 MB** in all. The game downloads an age's file
  only when a town of that age is on screen.

## 7. Phases and checkpoints

1. **Concept sheet for the classical age.** One image: the small, medium and big town side by side
   from the game's view (from the south, 55 degrees above the horizon, as close to orthographic as
   you can, like an isometric strategy game), plus `palace-small`, `palace`, a wall ring and the
   colony camp. Show it twice: on grass green and on a strong nation blue (#3b82f6). Add one copy
   **downscaled so the small town is 22 px wide** to prove it still reads. **STOP.**
2. **Pilot: `town-medium-a` of the classical age** with its three LODs, the classical atlas, the
   manifest, and renders from the game view at 33 px, 66 px and 265 px wide. **STOP.** The developer
   loads it in the game and reports back.
3. **Concept sheets for the other four ages** (same layout as step 1). **STOP.**
4. **The classical age complete** (`towns-classical.glb`, all 18 objects). **STOP.**
5. **The other four ages,** one age at a time. **STOP** after each.

## 8. Checks before every delivery

- Every object's triangle counts are within section 3 for every LOD.
- The footprint (the bounding circle on the ground) is within 5% of section 3; the origin is at the
  centre at Z = 0; the front faces glTF +Z (check with a render from the game camera: the gate of
  every wall ring and the entrance of every palace face the camera).
- A palace placed at a town's origin covers the free centre without touching houses.
- Each wall ring placed on its town size clears the houses and stays inside the next footprint up.
- Only the material names of section 5; the `Ground` material uses alphaMode `MASK`.
- Renders of every town at its three on-screen sizes from the table in section 1, on green and on
  #3b82f6, saved next to the log.

## 9. Later phases (not now, keep the structure ready)

- **Regional styles.** The game has 240 nations. Phase 2 adds regional sets with the same object
  list, in files named `towns-{age}-{region}.glb`. Planned regions: `europe`, `mideast` (phase 1's
  style), `eastasia`, `southasia`, `africa`, `americas`, `steppe`.
- **Building props** placed round the town by building type (farm, market, barracks, temple,
  library, workshop, dock, mine, road post), 3 tiers per age; and **harbours** for coastal towns.

## 10. Log

Keep `src/assets/raw-models/towns/LOG.md`: for each step, what you produced, the check output of
section 8, the renders, and anything you were unsure about, so the developer can review quickly.

## 11. Rules

- Original work only. No copying of buildings, textures or logos from existing games; the games
  named above are style references.
- Historically plausible: no anachronisms (no glass windows in the Bronze Age, no domes on Bronze
  Age shrines, no cars in the gunpowder age).
- Names exactly as listed: lowercase, hyphens, no spaces.
