# Battle unit models (optional)

The bundled prototype recipes are disabled with `enabled: false`: their blocky
characters and vehicle substitutions no longer match the intended presentation.
The default roster now uses smooth procedural bodies, period equipment, rounded
horses, tracked tanks and swept-wing aircraft. Reduced detail meshes preserve the
same silhouette and equipment. An approved replacement can opt in by removing the
flag; model imports still require a visual and licensing review.

## Delivered: the Bronze set (Wave 1 of plans/ART-MODELS-PLAN.md, 2026-10-07)

| File | Unit | Triangles | Built by |
|---|---|---:|---|
| `bronze-infantry.glb` | Spearmen: kilt, leather corselet, bronze cap, round shield (Emblem), 2.2 m spear | 1,508 | `scripts/blender/build_bronze_infantry.py` (Codex) |
| `bronze-ranged.glb` | Archers: linen tunic, Team kilt and shawl, self bow, quiver, knife | 1,494 | `build_bronze_ranged.py` (Codex; kilt made Team by Claude) |
| `bronze-cavalry.glb` | Chariots: two small horses side by side, six-spoke wheels, driver and archer | 2,388 | `build_units_bronze.py` (Claude) |
| `bronze-siege.glb` | Battering ram: covered ram on four wheels, hide roof, four pushers | 2,900 | `build_bronze_siege_machinery.py` + `build_bronze_siege.py` (Codex) |
| `bronze-support.glb` | Baggage train: one ox in shafts with a withers yoke, solid-wheeled cart, jars, sacks under a Team cover, seated driver | 2,000 | `build_units_bronze.py` (Claude) |
| `bronze-worker.glb` | Laborer: Team kilt, headcloth, basket and mattock | 1,348 | `build_bronze_worker.py` (Codex) |
| `bronze-raider.glb` | Raider: a light horseman (hide saddle cloth, loot sacks on both flanks, a bundle and a jar on the croup), Team tunic and headcloth, a raised torch (orange `Flame` material), a slung javelin. Drawn for a raid party's cavalry squads (unit `raidOf`, and the attackers of a raid or sack battle) | 1,696 | `build_units_bronze_irregular.py` (Claude) |
| `bronze-mercenary.glb` | Mercenary: feathered crown on a bronze band, banded corselet, Team kilt, greaves, a neutral sash with a coin pouch, round Emblem shield, long bronze sword. Drawn for hired bands' infantry squads (unit `mercenary`) | 1,410 | `build_units_bronze_irregular.py` (Claude) |
| `bronze-general.glb` | General: mounted commander (Team cloak, saddle cloth, plume; bronze scale and helmet; mace) and a standard bearer whose banner is the squad's Emblem | 2,005 | `build_units_bronze.py` (Claude) |

## Delivered: the Classical set (Wave 3 in the production order, 2026-10-07)

| File | Unit | Triangles |
|---|---|---:|
| `classical-infantry.glb` | Swordsmen: bronze cuirass with leather pteruges, crested helmet with cheek pieces, large oval shield (Emblem), short sword, greaves | 1,488 |
| `classical-ranged.glb` | Composite archers: recurve bow with bent tips, back quiver, leather corselet, felt cap | 1,216 |
| `classical-cavalry.glb` | Heavy cavalry: scale coat, crested helmet, long spear, small round shield, horse with a Team saddle cloth, no stirrups | 1,682 |
| `classical-siege.glb` | Ballista: torsion bolt thrower on the siege frame rig (`ti_mounts.frame`, `torsion_engine`), three crew | 2,103 |
| `classical-support.glb` | Engineers: wicker mantlet, pick, short ladder on the back | 1,228 |
| `classical-worker.glb` | Laborer: tunic, headcloth, pick, basket on the back | 1,102 |
| `classical-general.glb` | General: muscled cuirass, transverse Team crest, Team cloak and saddle cloth, sword; a standard bearer with a cloth standard (Emblem) | 2,295 |
| `classical-raider.glb` | Raider: a light horseman on a fleece, loot sacks on both flanks, a rolled bundle and a looted bronze cauldron on the croup; Team tunic, pinned cloak, felt cap, a raised torch (`Flame`), two javelins on the back | 1,764 | `build_units_classical_irregular.py` (Claude) |
| `classical-mercenary.glb` | Mercenary: crested helmet with cheek pieces, mail shirt with shoulder capes, Team tunic, a neutral sash with a coin pouch, greaves, an oval Emblem shield with spine and boss, a curved single-edged sword | 1,392 | `build_units_classical_irregular.py` (Claude) |
| `kingdoms-raider.glb` | Raider: a light horseman on a sheepskin, loot sacks on both flanks, a rolled bundle, a looted iron pot and a church candlestick on the croup; padded Team jack, hood, a raised torch, a short spear slung on the back | 1,968 | `build_units_kingdoms_irregular.py` (Claude) |
| `kingdoms-mercenary.glb` | Mercenary: pointed bascinet with a mail aventail, riveted brigandine over Team sleeves and skirt, greaves, a striped sash with a coin pouch, a round Emblem buckler, a falchion | 1,408 | `build_units_kingdoms_irregular.py` (Claude) |

Built by `scripts/blender/build_units_classical.py` (Claude) on the same rig, body and part library
(`build_units_bronze_signature.py`); rest pose only. Culture-neutral.

All share the rig and body of `scripts/blender/ti_units.py` (bones `Root`, `Hips`, `Spine`,
`Chest`, `Neck`, `Head`, `Arm_*`, `Forearm_*`, `Hand_*`, `Leg_*`, `Shin_*`, `Foot_*`, `Prop_R`,
`Prop_L`, `Prop_Back`; mounts `Mount_Spine`, `Mount_Neck`, `Mount_Head`, `Mount_Leg{Front,Hind}_{L,R}`,
`Mount_Shin...`, `Rider`) and flat colours on the tag materials `Team`, `Skin`, `Emblem`, `Metal`,
`Wood`, `Leather`, `Cloth` (a file may recolour a tag: the ox cart's `Metal` is terracotta).
Infantry, ranged, siege and worker carry Codex's authored 20 fps clips (the loader bakes the first
frame of `Idle`); cavalry, support and general are rest pose only. No clip plays in battle yet: the
vertex rig walks the legs, swings the arms and trots the horses (in diagonal pairs) until the VAT
bake of Wave 0b (plan decision D5). Units are packed WITHOUT quantization (`npm run pack:models`).
Check: `node scripts/art/unit-shots.mjs sandbox <dir> bronze` and `... lineup <dir> bronze-infantry ...`.

Any `.glb` placed here replaces the built-in procedural soldier for that unit, with no code
changes needed.

| File name | Replaces |
|---|---|
| `bronze-infantry.glb` | Bronze Age infantry, e.g. a bronze spear bearer |
| `modern-infantry.glb` | Modern infantry, e.g. a rifleman |
| `cavalry.glb` | Cavalry of every age that has no `{age}-cavalry.glb` |

Ages: `bronze classical kingdoms gunpowder modern`. Classes: `infantry ranged cavalry siege support air`.

## Generals and signature units

- `{age}-general.glb` (or `general.glb` for every age): the age's general, a mounted commander a
  size up from cavalry with a cloak in `Team` (Modern: an open command car). Drawn beside the
  standard of every squad with a commander; baked as tall as the cavalry model and trotting like
  it. Budget: mounted 2,500 (hard 4,000). Without the file a general is only the standard.
- `signature/{model}.glb`: a people's signature unit (the roster's model id), see `signature/README.md`.

## What the model should look like

- **Low poly.** Aim for 300–1,500 triangles, with 3,000 as the hard budget. Hundreds are
  instanced on a phone. The loader warns in the console when a model is over budget.
- **Flat colours.** Use materials with plain base colours, or one palette texture (Kenney style).
  Everything is baked to vertex colour, so there are no texture binds at draw time.
- **Rigged (recommended) or named parts.** Mixamo, Rigify, Unity/Unreal and "Bip01" bone names
  are recognised: `LeftUpLeg`, `thigh.L`, `upper_arm.R`, `Bip01 L Thigh`, and so on. Legs and arms
  are then animated by the battle shader: walk, strike, shield up.
  - Unskinned models can name their parts' nodes instead: `Leg_L`, `Arm_R`, `Turret`.
  - A model with no usable names is split by height as a fallback.
- **Pose.** The first frame of a clip named like `Idle` is used. Otherwise the model is baked in
  the file's rest pose, so arms should hang down: A-pose or idle, not a T-pose.
- **Team colour.** Name the material (or node) of the surfaces that should wear the side's colour
  with a word like `Team`, `Tunic`, `Tabard`, `Cloak` or `Banner`.
- **Emblems.** A shield face named `Emblem` or `ShieldFace` prints the squad's heraldic device,
  mapped by its UVs.
- **Skin.** A material named `Skin` or `Face` takes each soldier's own skin tone.
- **Orientation.** The model faces +Z with +Y up, the glTF default. If it faces another way, add
  `"rotateY"` in a JSON file with the same name as the model.

## Optional `{name}.json`

```json
{ "rotateY": 3.14159, "restClip": "Idle", "quadruped": true, "tags": { "team": "Tunic|Cloak" } }
```

Cavalry models default to `"quadruped": true`. In that mode the horse's front and hind legs trot
in diagonal pairs, and the rider sits still.

Good CC0 sources: Quaternius (Ultimate Modular Men / Animated Men, Animals), Kenney (Mini
Characters, Blocky Characters).
