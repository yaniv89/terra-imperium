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
| `bronze-infantry.glb` | Spearmen: pointed bronze cap, beard, banded leather corselet with a bronze chest disc, Team sash with a knot, tufted kilt, laced sandals, domed round shield with a bronze rim (Emblem), 2.2 m leaf-bladed spear; baked shade in COLOR_0 | 2,000 | `scripts/blender/build_bronze_infantry.py` (Claude, quality pass 2026-10-13) |
| `bronze-ranged.glb` | Archers: sleeveless linen tunic, Team shawl over the left shoulder and across the chest, white headcloth with a dark band, beard, self bow with a visible string, an arrow in the hand, back quiver, knife; baked shade in COLOR_0 | 1,976 | `build_bronze_ranged.py` on `ti_figure.py` (quality pass of 2026-10-13) |
| `bronze-cavalry.glb` | Chariots: two small horses (bridles, blazes, breast bands, pale blankets) under a curved yoke, a hide-sided car with a Team front in a wooden frame, six-spoke wheels with bronze tyres, a quiver; the driver (bronze cap, Team shawl) holds four reins, the archer (headcloth with a Team band, Team sash) half draws his bow; baked shade in COLOR_0 | 5,674 | `build_units_bronze.py` on `ti_figure.py` and `ti_mounts.fine_horse` (quality pass of 2026-10-14) |
| `bronze-siege.glb` | Battering ram: covered ram on four plank wheels, hide roof, Team side curtains, a pointed bronze ram head, the hide roof now drawn (a closed slab), four bare-chested pushers (Team sash and headband, the lighter crew figure) leaning on the push handles; baked shade in COLOR_0 | 3,932 | `build_bronze_siege_machinery.py` (Codex) + `build_bronze_siege.py` on `ti_figure.crew` (quality pass of 2026-10-14) |
| `bronze-support.glb` | Baggage train: a long-horned ox (pale face and patch) under a withers yoke, a railed cart with plank wheels, jars and a sack, the load under a Team cover lashed with ropes, a seated driver with a goad and a lead rope; baked shade in COLOR_0 | 3,354 | `build_units_bronze.py` on `ti_figure.py` and `ti_mounts.fine_ox` (quality pass of 2026-10-14) |
| `bronze-worker.glb` | Laborer: bare chest, kilt, Team waist sash and headband on a white headcloth, beard, a wicker basket of stone high on the back with the left fist on its rope, a mattock held upright like a staff; baked shade in COLOR_0 | 1,784 | `build_bronze_worker.py` on `ti_figure.py` (quality pass of 2026-10-13) |
| `bronze-raider.glb` | Raider: a light horseman on a bay horse (blaze, socks, bridle, hide saddle cloth, girth), loot (sacks on both flanks, a rolled rug and a jar on the croup), the rider astride in a tunic and hide vest with a Team shawl and headcloth, a raised torch (orange `Flame` material, no baked shade), a slung javelin, the reins in his fist; baked shade in COLOR_0. Drawn for a raid party's cavalry squads (unit `raidOf`, and the attackers of a raid or sack battle) | 3,160 | `build_units_bronze_irregular.py` on `ti_figure.py` (quality pass of 2026-10-14) |
| `bronze-mercenary.glb` | Mercenary: a fluted feather crown on a bronze band and a Team band, a leather jerkin under three bronze hoops, baldric, greaves and armlets, a kilt with a leather front panel, a Team waist sash with a coin pouch, a domed Emblem shield, a long bronze sword held upright; baked shade in COLOR_0. Drawn for hired bands' infantry squads (unit `mercenary`) | 1,998 | `build_units_bronze_irregular.py` on `ti_figure.py` (quality pass of 2026-10-14) |
| `bronze-general.glb` | General: a mounted commander on a pale horse (Team saddle cloth, bronze scale corselet and shoulder pieces, helmet with a Team crest, Team cloak and collar, a mace held upright) and a standard bearer whose banner is the squad's Emblem; baked shade in COLOR_0 | 4,486 | `build_units_bronze.py` on `ti_figure.py` (quality pass of 2026-10-14) |

## Delivered: the Classical set (Wave 3 in the production order, 2026-10-07)

| File | Unit | Triangles |
|---|---|---:|
| `classical-infantry.glb` | Swordsmen: bronze helmet with cheek pieces, neck guard and a tall Team crest, bronze muscled cuirass with shoulder guards over a white tunic, leather pteruges, Team waist sash, greaves, a big domed oval shield (Emblem) with a bronze rim, a short iron sword held upright; baked shade in COLOR_0 | 1,904 | `build_classical_swordsman.py` on `ti_figure.py` (quality pass of 2026-10-14) |
| `classical-ranged.glb` | Composite archers: pointed felt cap with a neck flap and a Team band, beard, leather corselet over a pale tunic, Team waist sash, boots, a short recurved composite bow with horn tips and a visible string, an arrow in the hand, back quiver; baked shade in COLOR_0 | 1,980 | `build_classical_ranged.py` on `ti_figure.py` (quality pass of 2026-10-14) |
| `classical-cavalry.glb` | Heavy cavalry: scale coat, crested helmet, long spear, small round shield, horse with a Team saddle cloth, no stirrups | 1,682 |
| `classical-siege.glb` | Ballista: torsion bolt thrower on the siege frame rig (`ti_mounts.frame`, `torsion_engine`), three crew | 2,103 |
| `classical-support.glb` | Engineers: Team over-tunic on a white tunic, belt and cross strap, beard, Team headband, a short ladder on the back with its rails above the head, a tall wicker mantlet in a wooden frame beside him, a pick-axe held upright; baked shade in COLOR_0 | 1,866 | `build_classical_support.py` on `ti_figure.py` (quality pass of 2026-10-14) |
| `classical-worker.glb` | Laborer: long belted sleeveless tunic, beard, Team headband, neckcloth and waist sash, a wicker pannier of earth on the back with the left fist on its strap, a pick held upright like a staff; baked shade in COLOR_0 | 1,802 | `build_classical_worker.py` on `ti_figure.py` (quality pass of 2026-10-14) |
| `classical-general.glb` | General: muscled cuirass, transverse Team crest, Team cloak and saddle cloth, sword; a standard bearer with a cloth standard (Emblem) | 2,295 |
| `classical-raider.glb` | Raider: a light horseman on a fleece, loot sacks on both flanks, a rolled bundle and a looted bronze cauldron on the croup; Team tunic, pinned cloak, felt cap, a raised torch (`Flame`), two javelins on the back | 1,764 | `build_units_classical_irregular.py` (Claude) |
| `classical-mercenary.glb` | Mercenary: grey iron mail shirt with shoulder capes over a dark wool tunic, a tall pointed iron helmet with cheek pieces and a black horsehair tail, beard, an ochre sash with a coin pouch, a Team waist sash, iron greaves, a long oval Emblem shield with rawhide rim, wooden spine and iron boss, a curved sword held upright; baked shade in COLOR_0 | 1,982 | `build_classical_mercenary.py` on `ti_figure.py` (quality pass of 2026-10-14) |
| `kingdoms-raider.glb` | Raider: a light horseman on a sheepskin, loot sacks on both flanks, a rolled bundle, a looted iron pot and a church candlestick on the croup; padded Team jack, hood, a raised torch, a short spear slung on the back | 1,968 | `build_units_kingdoms_irregular.py` (Claude) |
| `kingdoms-mercenary.glb` | Mercenary: pointed bascinet with a mail aventail, riveted brigandine over Team sleeves and skirt, greaves, a striped sash with a coin pouch, a round Emblem buckler, a falchion | 1,408 | `build_units_kingdoms_irregular.py` (Claude) |
| `gunpowder-infantry.glb` | Line infantry: long Team coat with turnbacks, white cross belts, tricorne, gaiters, musket with a fixed bayonet | 1,388 | `build_units_gunpowder.py` (Claude) |
| `gunpowder-ranged.glb` | Riflemen: short Team jacket, round hat with a turned-up brim, rifle at the ready, powder horn, pouch | 1,396 | `build_units_gunpowder.py` (Claude) |
| `gunpowder-cavalry.glb` | Dragoons: brass helmet with a horsehair crest, Team coat, high boots, sabre drawn, carbine slung, horse with a Team saddle cloth and holsters | 1,796 | `build_units_gunpowder.py` (Claude) |
| `gunpowder-siege.glb` | Field cannon: bronze gun on a two-wheeled carriage with a trail (its own Hull and wheel rig), rammer, ball pile, three crew | 2,385 | `build_units_gunpowder.py` (Claude) |
| `gunpowder-support.glb` | Sappers: wicker gabion on the back, shovel, fuse coil, leather apron, cap | 1,446 | `build_units_gunpowder.py` (Claude) |
| `gunpowder-worker.glb` | Laborer: shirt and Team waistcoat, broad hat, shovel, wheelbarrow | 1,390 | `build_units_gunpowder.py` (Claude) |
| `gunpowder-general.glb` | General: plumed bicorne, Team coat with epaulettes and sash, Team cloak, sabre; a colour bearer with the Emblem colour | 2,297 | `build_units_gunpowder.py` (Claude) |
| `gunpowder-raider.glb` | Raider: a horseman on a blanket with loot sacks, a brass kettle and a clock on the croup; loose Team coat, slouch hat, bandolier, raised torch, carbine slung | 2,028 | `build_units_gunpowder_irregular.py` (Claude) |
| `gunpowder-mercenary.glb` | Mercenary: buff leather coat over a Team waistcoat, broad plumed hat, bandolier of powder chargers, striped sash and coin pouch, boots, matchlock, short sword | 1,442 | `build_units_gunpowder_irregular.py` (Claude) |
| `modern-infantry.glb` | Rifle infantry: helmet with a Team band, Team plate carrier with pouches, olive uniform with sleeves, knee pads, boots, assault rifle at the ready | 1,493 | `build_units_modern.py` (Claude) |
| `modern-ranged.glb` | ATGM team: the gunner kneeling behind a tripod missile launcher, the loader with a spare missile tube | 2,998 | `build_units_modern.py` (Claude) |
| `modern-cavalry.glb` | Tank: tracked rig (Hull, Track_L/R, Turret, Barrel), side skirts and turret band in Team, cupola, loader's MG, stowage basket | 1,340 | `build_units_modern.py` (Claude) |
| `modern-siege.glb` | Towed 155 mm howitzer in the firing position (wheeled rig with Turret and Barrel), split trails, muzzle brake, three crew in Team vests | 2,973 | `build_units_modern.py` (Claude) |
| `modern-support.glb` | Anti-air battery: three-axle truck (wheeled rig) with a twin AA gun mount and radar panel, Team doors, a gunner | 1,827 | `build_units_modern.py` (Claude) |
| `modern-worker.glb` | Engineer: overalls, Team high-visibility vest, Team hard hat, tool bag, sledgehammer | 1,403 | `build_units_modern.py` (Claude) |
| `modern-general.glb` | General: open command car (wheeled rig) with a whip mast and an Emblem pennant, a driver, the general standing in a peaked cap | 2,948 | `build_units_modern.py` (Claude) |
| `modern-raider.glb` | Raider: a technical on the wheeled rig, a machine gun on a pintle (Turret, Barrel), loot in the bed, Team tailgate and doors, a gunner in a headscarf with a raised torch | 2,108 | `build_units_modern_irregular.py` (Claude) |
| `modern-mercenary.glb` | Mercenary: ball cap and headset, tan shirt, Team chest rig, cargo trousers, striped sash and coin pouch, beard, carbine | 1,409 | `build_units_modern_irregular.py` (Claude) |
| `modern-air.glb` | Fighter jet (`air` squads): twin-tail multirole fighter, gear up, Team fins, emblem roundels, two missiles (one Hull bone; `segment: false`) | 556 | `build_units_modern.py` (Claude) |

Machines bigger, crews at human size (manifest MD09, MD10: only machines get bigger, never their
crews). A land machine's file (siege engines, guns, tanks, trucks, the command car, the technical)
is drawn at the same scale as the infantry beside it (unitModels.js `ART_UNIT_WORLD`), so it is
authored against a 1.8 m person (a person = 1 unit) with its crew at 1.0, the machine at about TWO
THIRDS of its real size (the user's cap: bigger than a man, small enough for the 3 tiles the battle
leaves between squads). The builders make the machine on the game-sized rigs, `ti_mounts.enlarge`
it and place the crew afterwards. Its JSON carries `footprint` ([width, length] in units, crew
included, written by `ti_mounts.mark_machine`) and no `height`: a fitted height would shrink the
crew with the machine. The renderer spaces a squad's machines by the footprint and draws as many as
fit the squad's ground (unitModels.js `machineLayout`: one trebuchet, howitzer or tank; three guns
or ballistas). Camels and elephants the same way: no `height`, the animal at its true size (a
dromedary about 1.9 m at the hump, `ti_mounts.true_camel`; an elephant 2.8 m at the shoulder), the
riders at 1.0. Only aircraft keep `height`. `unitScale.test.js` checks every such file: crew and
riders the infantryman's size within 3%, the machine's length and height and the animal's back in
metres.

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
