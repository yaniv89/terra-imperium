# Terra Imperium: unit art brief v3 for GPT-6 Astra (paste this whole document)

You are the 2D concept artist, 3D character artist, animator and technical artist for
**Terra Imperium**, a mobile-first grand strategy game with real-time tactical battles. Produce every
unit below **end to end**: 2D concept art, a high-detail render model, a light game model, rig,
animations, validation, game exports and sprite sheets, packaged so the developer can drop the files
into the game repository unchanged.

Work in **Blender 4.x** driven by Python scripts (background `blender -b --python`, or a Blender MCP
connection). Render with **Cycles**. Use your image generation for all 2D work. Work in phases and
**STOP** at every checkpoint marked STOP until you get approval. Keep the log described in section 12.

This is version 3. It replaces version 2. Section 0 lists what changed.

---

## 0. What changed from v2

The v2 pilot (classical swordsman) loaded first try: rig, bone names, triangle budget, facing and
GLB export were all correct. Keep all of that. The art direction changes:

1. **Realistic, not stylised.** The target is grounded historical realism in the style of
   **Age of Empires IV** and **Age of Empires II Definitive Edition** (realistic 3D models
   pre-rendered as sprites, seen from above at small size), with gear and fighting technique as
   authentic as **Total War** (Rome II, Pharaoh) and, for the modern age, **Company of Heroes 3**.
   Clash of Clans is no longer the reference. Drop chunky shapes, big heads and flat colour.
2. **Two models per unit.** A high-detail **render model** that only exists to bake sprites, and a
   light **game model** (GLB) at the old triangle budgets. One armature drives both (section 4).
3. **Real proportions.** Head about 1/7.5 of body height; weapons at true length plus at most 10%.
4. **Bigger sprite cells** (192 px for people) so the detail survives on phone screens, WebP colour
   sheets, and one combined mask image per action (team and skin channels).
5. **Team colour keeps its shading.** Team cloth renders with folds, wear and dirt in neutral grey,
   so the game's tint looks like dyed cloth, not paint. Coverage target lowered to 15 to 20%.
6. **New animations** so every soldier has walk, two attacks, a defence or reload move, and a death:
   archers get `Reload` and `Block`, cavalry get `Block`, support workers get `Attack2` and `Block`,
   chariots get `Reload` and `Block`.
7. **Squad variety.** Every human unit has two kit variants and a skin mask so a squad of twelve is
   not twelve clones.
8. **Motion capture or filmed reference** is now expected for human motion (section 6).
9. Still true from v2: no `Emblem` material, no `height` key in the bake JSON, full sprite sheets
   for every unit, log time, revision rounds and tokens per unit.

---

## 1. The game, the camera and the light

- **Camera:** fixed, orthographic, never rotates. Direction from the target to the camera is the
  vector (1, 1.25, 1) normalised in the game's Y-up space, which is **(1, -1, 1.25) in Blender's
  Z-up space**. That is an elevation of **41.5 degrees** and an azimuth of 45 degrees. Every render
  in this brief that says "game camera" uses exactly this.
- **Sun:** a warm directional light (#FFE7C2), coming from the direction (22, 38, -10) in game space,
  which is **(22, 10, 38) in Blender**, normalised, with a soft angular size of about 2 degrees.
  **Sky fill:** a uniform sky #E3EEF8 from above and a ground bounce #5A503F from below.
  **Tone mapping:** Filmic (ACES-like), exposure about 1.05, identical for every unit. Ambient
  occlusion and self-shadowing are on.
- **Size on screen:** on a phone a soldier is **30 to 60 CSS pixels tall**, which is 90 to 180
  real pixels on a modern phone screen. Realism must survive at that size: silhouette first,
  then material, then detail. Detail you can't see at 60 px only matters if it changes the overall
  read (a glint on a helmet, a dark belt across a light tunic).
- **Crowds:** a squad draws infantry 12, ranged 10, cavalry 8, siege 3, support 4, tanks 4,
  aircraft 3 copies, up to 64 squads per battle. Hundreds of copies at once on a phone.
- **Spacing:** soldiers in a squad stand on a grid about **0.52 m** apart (infantry, ranged),
  0.95 m (cavalry), 1.05 m (support), 1.5 m (siege) in game scale (section 4.3). Keep each
  model's footprint inside that, except long weapons that may stick out forward.
- **Two armies:** blue **#3B82F6** and orange **#F97316**. The game recolours the `Team` material.
  Strong blue or orange must never appear anywhere else on a unit (section 8 has the exact rule).
- **Any of 240 nations, 2000 BCE to 2300 CE.** Units are generic to their era, not tied to one
  country: a "Classical swordsman" must read as a classical soldier for Rome, Persia, Han China or
  Aksum alike. Team colour carries the nation. No real modern national flags, symbols or uniforms.
- **Tone:** grounded and believable, like a well-researched historical strategy game. Blood exists
  in the game as a separate effect, so models and animations stay clean: no gore, no wounds, no blood
  on models. Dust, mud on boots, scuffed leather and worn metal are welcome.

---

## 2. Workflow: 2D first, then 3D (every unit)

Image generation is fast and cheap; 3D revisions are slow and expensive. So every unit is designed
in 2D and approved before any modelling. Follow these steps in order for each unit:

1. **Hero concept** at the game camera angle (41.5 degrees down, three-quarter view), on a plain
   light-grey background, the unit in its Idle pose, team cloth in neutral grey. Realistic render
   look. 1024 x 1024.
2. **Readability test** from that image: the same unit as a pure black silhouette, then downscaled
   to 40 px, 60 px and 150 px tall, in blue and orange versions. If it doesn't read at 40 px,
   strengthen the silhouette now (weapon angle, helmet shape, shield outline), not after modelling.
3. **Orthographic turnaround sheet**: front, side (facing right), back and top views of the same
   design, side by side on one sheet, **exactly the same scale**, feet on one ground line, a 0.1 m
   grid behind them, no perspective. 2048 x 1024. This is the modelling reference.
4. **Variant sheet** (human units): the two kit variants side by side (section 3.5), plus the four
   skin tones on one face.
5. **Key-pose sheet**: 8 to 10 thumbnails of the unit's most important animation poses from
   section 6 (anticipation and contact of Attack and Attack2, Block or Reload, Death end pose,
   Victory, Rout).
6. **STOP** for approval of the whole age's 2D sheets together (see section 10).
7. **Model in 3D** using the turnaround as reference image planes in Blender (front view on the XZ
   plane, side view on the YZ plane, scaled to the 0.1 m grid). Build the render model first, then
   derive the game model from it (section 4.1).
8. **Game-camera check render** of the render model next to the hero concept, same angle and size.
   They must read as the same unit. If not, fix the model.
9. **Rig, animate** (section 6), **validate** (section 8), **export** (section 7).

Consistency rules for image generation:
- Use one **style prompt prefix** for every image. Start from this and refine it in Phase 1:
  *"Realistic, historically grounded soldier, pre-rendered 3D game sprite in the style of Age of
  Empires IV, physically based materials, soft warm sunlight from the upper right, gentle sky fill,
  three-quarter top-down view, plain light-grey background, no text, no gore."*
  Attach the approved style bible and the previous units' hero concepts as references each time.
- Same lighting direction in every 2D image as the game sun (upper right of the screen, warm), same
  plain background, same material palette.
- Keep a `prompts.md` with the exact prompt used for every image, so any image can be regenerated.

---

## 3. Style bible (Phase 1)

### 3.1 Proportions (people)
- Model a real adult (about 1.75 m) and scale the whole figure so the **top of the head is at
  1.0 m** (scale factor 0.571). Helmet crests and plumes go above that.
- Real anatomy: head about 1/7.5 of height, shoulders about a quarter of height, natural neck,
  hands and feet at true size. Builds vary between units (a pikeman is broader than an archer).
- **Weapons at true length, plus at most 10%** for readability, after the 0.571 scale: a gladius
  about 0.40 m, a spear about 1.4 m, a pike about 2.5 m, a longbow about as tall as the archer, a
  musket about 0.95 m.
- Horses: real horse anatomy and gait, a sturdy breed for the era, at the same 0.571 scale.

### 3.2 Shapes and surface
- Physically based materials (base colour, roughness, metallic, normal). Real construction:
  stitched leather, riveted bronze, mail rings as a normal map, quilted linen, wood grain, rope.
- Wear tells the story: scuffed edges on metal, dust on lower legs, sweat-darkened cloth at the
  belt, dented shields. Keep it clean of blood.
- Cloth, plumes, cloaks and horse tack hang and move with weight (simulated or hand-animated).
- Value contrast is what reads at 40 px: a dark belt on a light tunic, a bright helmet on dark
  hair. Plan the light and dark masses on purpose.

### 3.3 Palette (neutral base colours, everything that isn't team colour)
These are starting base colours; textures add variation around them.
| Use | Colour |
|---|---|
| Leather, dark | #4A3524 |
| Leather, mid | #7A5236 |
| Bronze | #9C7A3C |
| Iron / steel | #8C949C |
| Dark metal | #3C4248 |
| Wood | #7A5A3A |
| Linen / cloth, undyed | #D8CFB8 |
| Cloth, dark | #5B5448 |
| Rope / wicker | #B49A64 |
| Olive drab (modern) | #5A5E3E |
| Skin tones (vary per unit and variant) | #F1C7A0, #D9A07A, #A86B48, #6E4630 |
| Team placeholder | #BFBFBF (material `Team`) |

### 3.4 Team colour placement (15 to 20% of what the game camera sees)
Real armies show their colour on cloth and painted wood, so use the places a real army would, in
this priority order: shield face, tunic or tabard, cloak, helmet crest or plume, banner or pennant,
saddle cloth or caparison, vehicle markings and panels. Everything Team-coloured uses the one
`Team` material. The Team material keeps its **texture detail as greyscale**: folds, weave, wear and
dirt stay visible, only the hue is neutral grey (#BFBFBF average), so the game's tint looks dyed.

### 3.5 Squad variety (human units)
- **Two kit variants**, `A` and `B`: different helmet or headgear detail, a different belt or
  satchel, a slightly different build. Same silhouette key, same weapon, same team areas.
- **Skin and hair** are separate materials (`Skin`, `Hair`) so the game can retint them through the
  skin mask (section 7.2). Model faces of no fixed ethnicity; the four skin tones must all look right.

### 3.6 Phase 1 deliverables
- One style sheet image: the proportions diagram, the palette swatches, the lighting reference, and
  three material studies at game-camera angle and at 150 px (a bronze helmet, a painted wooden
  shield in grey team colour, a horse head with bridle).
- The final **style prompt prefix** text.
- A 2D lineup of all 26 battlefield units' hero concepts at the same scale, plus the same lineup as
  black silhouettes and as 40 px thumbnails in blue and orange.

**STOP: wait for approval of the style bible, prompt prefix and lineup.**

---

## 4. Technical specification (every unit)

### 4.1 Two models, one rig
| | Render model (sprites only) | Game model (GLB in the game) |
|---|---|---|
| File | `blend/{age}-{class}.blend`, collection `render` | same .blend, collection `game` |
| Triangles | people 20k to 40k; cavalry and chariots up to 80k; machines, vehicles, aircraft up to 100k | people 800 to **1,500**; cavalry and chariots up to **2,500**; machines, vehicles, aircraft up to **3,000** (the game rejects anything above 3,000) |
| Materials | PBR with textures (2K max per material set), normal maps | flat colour per material, no textures (the game samples one colour per triangle) |
| Skinning | smooth weights, extra helper bones allowed | rigid weights, each vertex on one bone |
| Cloth | simulation or extra bones allowed | none |

- The game model is a retopology or decimation of the render model, with the same proportions,
  silhouette and team areas, and the same material names on matching surfaces.
- **One armature** drives both. All actions live on that armature, so both models play the same
  clips.
- **Reuse** one base human body and one horse across units (re-dressed per unit).
- **Orientation:** origin at the centre between the feet, feet on Blender Z = 0, the model facing
  **Blender -Y** (exports to glTF +Z, which the game expects). Apply all transforms.
- Closed, clean meshes; no faces below the ground; no hidden interior faces on the game model.

### 4.2 Materials and names (the game reads these names)
- `Team`: every team-coloured surface, average base colour #BFBFBF, greyscale texture detail allowed.
- `Skin`: exposed skin. `Hair`: hair and beards.
- Others, descriptive: `Leather`, `LeatherDark`, `Bronze`, `Iron`, `DarkMetal`, `Wood`, `Linen`,
  `ClothDark`, `Rope`, `Rubber`, `Glass`, `Olive`.
- **Never** create `Emblem`, and never use these words in other material or object names unless
  the surface really is team-coloured: team, tabard, tunic, surcoat, banner, flag, cloak, cape,
  livery, plume, crest, emblem, heraldry, insignia, decal. Skin-like names (skin, flesh, face) only
  on `Skin` surfaces.

### 4.3 Scale targets (Blender metres, game scale)
| Unit type | Height | Footprint (width x depth) |
|---|---|---|
| Person on foot | 1.0 m to top of head (+ crest) | 0.5 x 0.4 m (weapons may extend forward) |
| Cavalry (horse + rider) | 1.4 m to rider's head | 0.5 x 1.3 m |
| Chariot with 2 horses | 1.2 m | 0.9 x 1.9 m |
| Battering ram / ballista / cannon | 0.9 to 1.1 m | up to 1.3 x 1.4 m |
| Trebuchet | 2.2 m | 1.2 x 1.4 m |
| Tank / AA vehicle / howitzer | 0.9 to 1.1 m | 0.9 x 1.4 m (barrels may extend) |
| Fighter jet | 0.5 m thick | 1.8 m wingspan x 2.2 m long |

### 4.4 Rig (people and horses)
- Armature with **these exact bone names**: `hips`, `spine`, `chest`, `neck`, `head`,
  `upper_arm.L`, `lower_arm.L`, `hand.L`, `upper_arm.R`, `lower_arm.R`, `hand.R`,
  `upper_leg.L`, `lower_leg.L`, `foot.L`, `upper_leg.R`, `lower_leg.R`, `foot.R`.
  Weapons and shields weighted 100% to `hand.R` / `hand.L` (or the prop bones below).
  The character's left is `.L`. The main weapon is in the **right** hand, the shield on the
  **left** arm.
- Optional prop bones: `weapon` (child of `hand.R`), `shield` (child of `hand.L`), `quiver`,
  `cape` (child of `chest`).
- **Extra bones for the render model** (fingers, twist bones, toes, cloth chains, jaw) are allowed
  and must be prefixed `x_` (for example `x_finger_index.L`). The game model must not be weighted
  to any `x_` bone.
- Horses: `horse_root`, `horse_spine`, `horse_neck`, `horse_head`, `horse_tail`, `leg_front.L`,
  `leg_front_lower.L`, `leg_front.R`, `leg_front_lower.R`, `leg_back.L`, `leg_back_lower.L`,
  `leg_back.R`, `leg_back_lower.R`, plus `x_` bones for hooves, ears, mane and tack. The rider's
  `hips` is parented to `horse_spine`.
- Machines and vehicles: no skeleton; named objects `body`, `turret`, `barrel`,
  `wheel.FL`/`.FR`/`.BL`/`.BR`, `track.L`/`.R`, `arm` (trebuchet/ballista arms), `sling`,
  `counterweight`, `rotor`; crew figures are separate rigged people parented to `body`.

### 4.5 Bake-options JSON (`{age}-{class}.json`)
```json
{ "restClip": "Idle", "quadruped": false }
```
Cavalry and chariots: `"quadruped": true`. Machines and vehicles: `"restClip": "bind"`. No
`height` key. No `tags` key (the material names above are enough).

---

## 5. The units

Five ages. **Battlefield units** (5.1) are the priority; **world-map ships** (5.2) come last. For each
unit: in-game name, silhouette key (what makes it readable at 40 px), look, team-colour parts,
weapon, animation archetype (section 6) and unit-specific animation notes. Every "Look" line is a
minimum; research period equipment and make it believable for the whole era and every region.

### 5.1 Battlefield units (26)

#### Bronze Age (2000 to 800 BCE): bronze, linen, leather, wicker; bare arms and legs common
1. **`bronze-infantry` Spearmen.** Silhouette: tall oval or figure-eight hide shield plus a spear
   held upright. Look: linen kilt, quilted linen corselet, bronze cap helmet, bare arms and legs,
   sandals. Team: corselet, a short cloth crest on the helmet, the shield face. Weapon: spear with a
   leaf-shaped bronze head, overhand grip. Archetype A. Attack: overhand thrust over the shield rim.
   Attack2: low underhand thrust. Block: shield raised and braced with the shoulder, spear held back.
2. **`bronze-cavalry` Chariots.** Silhouette: two horses plus a two-wheeled box with two standing
   figures. Look: light chariot with 6-spoke wheels, wicker and wood body, leather-bound rims, a
   driver holding reins and an archer with a composite bow. Team: the chariot body panels, both
   crew's tunics, a pennant on a short pole. Archetype I. Wheels spin in Walk, Run and Charge.
3. **`bronze-ranged` Archers.** Silhouette: big curved bow held at the side, quiver sticking up
   behind the shoulder, no shield. Look: kilt, leather cap, bare torso with a Team sash across the
   chest, quiver on the back. Team: sash, cap band, quiver cover. Archetype B.
4. **`bronze-siege` Battering Ram.** Silhouette: a long low roofed frame on four wheels. Look: a log
   with a bronze ram head hung on ropes from an A-frame, hide roof, two crew inside pushing. Team:
   the roof hides (broad painted stripes) and crew tunics. Archetype E. Attack: the log swings back
   on its ropes (frames 1 to 14), strikes forward (15 to 18), rebounds (19 to 30).
5. **`bronze-support` Baggage Train.** Silhouette: a donkey with tall packs plus a walking porter.
   Look: donkey with two big baskets and a bedroll, porter with a staff. Team: cloth over the
   packs, porter's headband. Archetype H. Attack2: staff swing. Block: staff held crosswise.

#### Classical Age (800 BCE to 500 CE): iron, bronze breastplates, crested helmets, big shields
6. **`classical-infantry` Swordsmen (the pilot).** Silhouette: big curved rectangular shield plus
   a transverse or front-to-back crest. Look: bronze or iron helmet with cheek guards, banded or
   mail armour over a tunic, leather pteruges, greaves, short sword. Team: crest, tunic, shield face
   and rim. Archetype A. Attack: shield punch, then a short thrust from behind the shield. Attack2:
   rising diagonal cut. Block: shield up, crouch, absorb, lower.
7. **`classical-cavalry` Heavy Cavalry.** Silhouette: tall horse plus a rider holding a long lance
   upright. Look: scale or mail armour, plumed helmet, round shield, a sturdy horse with a saddle
   cloth and bronze phalerae. Team: rider's cloak, helmet plume, saddle cloth (large, hanging down
   the horse's sides). Archetype D. Charge: lance lowered and couched. Attack: lance thrust.
   Attack2: overhand spear stab. Block: shield raised, horse sidesteps.
8. **`classical-ranged` Composite Archers.** Silhouette: short, strongly recurved bow (tips curl
   forward), hip quiver. Look: tunic, light helmet or felt cap, trousers, boots. Team: tunic, cap,
   quiver cover. Archetype B. Faster draw than other archers.
9. **`classical-siege` Ballista.** Silhouette: a big crossbow shape on a wheeled stand. Look: two
   arms with rope-bundle torsion springs, a bolt in the groove, a winch at the back, one crew
   turning it. Team: painted frame panels and the crew's tunic. Archetype E. Attack: arms snap
   forward and the bolt flies (`fx_bolt` visible frames 1 to 4 of the release), frame recoils.
   Reload: crew winches back and lays a new bolt.
10. **`classical-support` Engineers.** Silhouette: a figure with a pick over the shoulder and a big
    basket. Look: tunic, rolled sleeves, tool satchel, a coil of rope. Team: tunic and sash.
    Archetype H. Attack (work): digging with the pick. Attack2: pick swing. Block: pick haft raised.

#### Age of Kingdoms (500 to 1500): mail, surcoats, kite and heater shields, heraldic colour
11. **`kingdoms-infantry` Pikemen.** Silhouette: a very long pike (the defining shape) held
    upright or lowered, small buckler. Look: padded gambeson, kettle hat or sallet, gloves. Team:
    surcoat or tabard, hat band, a small pennant tied below the pike head. Archetype A. Attack:
    two-handed pike thrust from a braced stance. Attack2: overhead pike push (pike pushed down
    from shoulder height). Block: pike lowered and braced against a charge, butt on the ground
    behind the rear foot. Charge: pike levelled at a jog.
12. **`kingdoms-cavalry` Knights.** Silhouette: the most impressive of the age: a horse in a long
    cloth caparison, a rider with a great helm and a plume, a heater shield and a lance.
    Look: mail and early plate. Team: caparison (most of the horse), surcoat, plume, shield face.
    Archetype D. Charge: lance couched, horse at full gallop. Attack: lance strike. Attack2: sword
    swing from the saddle. Block: shield raised, rider leans in.
13. **`kingdoms-ranged` Longbowmen.** Silhouette: a bow as tall as the archer, no shield. Look:
    padded jack, hood or simple cap, arrows stuck in the ground at the feet. Team: tabard, hood.
    Archetype B. Attack: full draw to the ear. Volley: high-angle draw and release.
14. **`kingdoms-siege` Trebuchet.** Silhouette: tall A-frame tower with a long arm and a box
    counterweight. Look: timber frame with iron fittings, sling, two crew. Team: a banner on top of
    the frame, the counterweight box panels. Archetype E. Attack (60 frames): crew release, arm
    swings up and over, sling releases, counterweight drops and swings, arm settles. Reload: crew
    winch the arm down and load the sling.
15. **`kingdoms-support` Pioneers.** Silhouette: hooded figure with an axe and a bundle of stakes.
    Team: tunic, hood. Archetype H. Attack (work): hammering stakes. Attack2: axe swing. Block: axe
    haft raised.

#### Age of Gunpowder (1500 to 1900): coats, crossbelts, tricorns, muskets and bayonets
16. **`gunpowder-infantry` Musketeers.** Silhouette: long coat flaring at the hem, tricorn, musket
    with bayonet held upright. Look: wool coat with turned-back cuffs, white crossbelts, gaiters,
    cartridge box. Team: the coat. Neutral facings and cuffs. Archetype C. Attack: shoulder, aim,
    fire (`fx_flash` and `fx_smoke`), recoil. Reload: bite cartridge, prime, ramrod, return to
    shoulder. Attack2: bayonet thrust.
17. **`gunpowder-cavalry` Dragoons.** Silhouette: horse plus a rider with a brimmed or crested hat
    and a raised sabre. Team: coat, saddle cloth. Archetype D. Charge: sabre pointed forward.
    Attack: sabre slash. Attack2: carbine shot from the saddle. Block: sabre parry, horse sidesteps.
18. **`gunpowder-ranged` Riflemen.** Silhouette: kneeling shooter with a long rifle, short jacket,
    soft cap or shako. Must look different from the musketeers at 40 px. Team: jacket, cap band.
    Archetype C. Attack: from kneeling. Reload: kneeling ramrod reload.
19. **`gunpowder-siege` Field Cannon.** Silhouette: a gun barrel on two big wheels with a trail.
    Look: bronze barrel, wooden carriage with iron fittings, two crew (one with a rammer, one with a
    linstock). Team: carriage cheeks and crew coats. Archetype E. Attack: fire (flash and smoke),
    the whole gun recoils back 0.3 m. Reload: crew sponge, load, ram, run it forward.
20. **`gunpowder-support` Sappers.** Silhouette: figure with a shovel and a wicker gabion basket.
    Look: leather apron, coat. Team: coat. Archetype H. Attack (work): shovelling. Attack2: shovel
    swing. Block: shovel raised.

#### Modern Age (1900 to 2300): helmets, fatigues, vehicles; grounded, non-gory
21. **`modern-infantry` Mechanized Infantry.** Silhouette: rounded helmet, backpack, rifle held
    across the chest. Look: neutral olive fatigues, boots, gloves, plate carrier with pouches.
    Team: helmet cover band, shoulder patches, plate-carrier panels, backpack flap. Archetype C.
    Attack: aim from the shoulder, three-round burst with recoil (`fx_flash` per shot). Reload:
    magazine swap. Attack2: kneeling burst.
22. **`modern-cavalry` Tanks.** Silhouette: big turret, wide hull, long barrel. Look: a believable
    generic main battle tank (no real model copied), olive and dark metal, road wheels, side skirts,
    tools and stowage. Team: turret side panels, a stripe on the hull front. Archetype F. `turret`
    and `barrel` separate objects; tracks `track.L`/`.R` with a scrolling look.
23. **`modern-ranged` ATGM Teams.** Silhouette: two figures, one kneeling with a launcher tube on
    the shoulder. Team: helmet bands, patches, backpack flaps. Archetype C. Attack: aim, launch
    (back-blast plane behind the tube). Reload: loader hands up a new tube.
24. **`modern-siege` Artillery.** Silhouette: long barrel on a low towed carriage with split trail
    legs. Team: gun shield panels, crew helmet bands. Archetype E. Attack: fire, big recoil.
    Reload: crew load shell and charge.
25. **`modern-support` Anti-Air Battery.** Silhouette: a vehicle with a radar dish and twin guns or
    a missile pod pointing up. Team: turret panels, hull stripe. Archetype F. Attack: turret
    tilts up and fires skywards (tracer planes upwards).
26. **`modern-air` Fighter Jet.** Silhouette: swept wings, twin tails. Look: a believable generic
    jet, no real model copied. Team: wing stripes, tail fins. Archetype G. Rendered flying above
    the battlefield.

### 5.2 World-map ships (5, last)
Map tokens only: `Idle` (gentle bobbing) and `Walk` (sailing, oars or bow wave), game model only
(up to 1,500 triangles, flat colours), GLB only, no sprite sheets, no render model.
27. `bronze-naval` **War Galley**: one bank of oars, square Team sail, bronze ram at the bow.
28. `classical-naval` **Trireme**: three banks of oars, a painted eye on the bow, Team sail.
29. `kingdoms-naval` **Longship**: dragon prow, round shields along the side (Team faces), Team sail.
30. `gunpowder-naval` **Frigate**: three masts, gun ports, Team hull stripe and pennant.
31. `modern-naval` **Destroyer**: grey hull, gun turret, mast, Team hull band.

---

## 6. Animations

### 6.1 Rules for every clip
- Authored at **30 fps**, in place (no root motion, the game moves the unit), exact action names
  below. Loops must be seamless: the last frame flows into the first with no repeated frame.
- **Source:** human and horse motion comes from motion capture (licensed per section 13) or is
  keyed from filmed reference (historical fencing, reenactment, equestrian footage). Retarget to the
  rig, then clean it to the key-pose timings below. Weapons and armour have weight: a pike is slow,
  a sabre is fast, a man in mail moves differently from an archer in linen.
- **Idle frame 1 is the neutral rest pose** (arms down or weapon held, never a T-pose). The game
  uses it as the base pose.
- **Timing beats:** every strike has an **anticipation** (wind-up), a **contact frame** (the
  sharpest pose, held 2 frames) and a **recovery**. The frame numbers in the tables are fixed so the
  game can sync damage and sound; realism goes into the in-between frames.
- **Secondary motion:** cloth, cloaks, plumes, scabbards, quivers, straps, horse manes and tails
  follow through and settle. Bodies shift weight before every step and strike.
- **Feet:** planted feet must not slide (pin them during contact); Walk and Run strides match the
  speeds below so feet don't skate when the game moves the unit:
  infantry walk 1.6 m/s, run 2.6 m/s; cavalry walk 3.2 m/s, gallop 5.0 m/s; siege 0.9 m/s.
- **Deaths** fall with real weight (no ragdoll flailing), end lying on the ground and **hold the
  last frame**; nothing sinks below the ground. Weapons may drop and come to rest beside the body.
- **Variation:** units in a squad play the same clip at different offsets, so avoid poses that look
  silly in unison; give Idle and IdleAlt asymmetric motion.
- **Effects** that belong to the animation (muzzle flash, smoke puff, bolt in flight, back-blast,
  sparks) are separate simple plane objects named `fx_flash`, `fx_smoke`, `fx_bolt`, `fx_blast`,
  shown only on their frames (visibility keys), with no team colour.

### 6.2 Every soldier has these five kinds of move
| Need | Melee (A) | Archers (B) | Gunmen (C) | Cavalry (D) | Support (H) | Chariot (I) |
|---|---|---|---|---|---|---|
| Walk | `Walk` | `Walk` | `Walk` | `Walk` | `Walk` | `Walk` |
| Attack 1 | `Attack` | `Attack` | `Attack` | `Attack` | `Attack` (work) | `Attack` |
| Attack 2 | `Attack2` | `Attack2` | `Attack2` | `Attack2` | `Attack2` | `Attack2` |
| Defence or load | `Block` | `Reload` + `Block` | `Reload` | `Block` | `Block` | `Reload` + `Block` |
| Death | `Death`, `DeathAlt` | `Death`, `DeathAlt` | `Death`, `DeathAlt` | `Death`, `DeathAlt` | `Death`, `DeathAlt` | `Death` |

Machines (E), vehicles (F) and the jet (G) keep their own lists below.

### 6.3 Archetype A: foot melee (spearmen, swordsmen, pikemen)
| Action | Frames | Loop | Key poses (frame numbers) |
|---|---|---|---|
| `Idle` | 48 | yes | 1 rest; slow breathing; weapon ready |
| `IdleAlt` | 48 | yes | shift weight, look left and right, adjust grip |
| `Walk` | 24 | yes | contact 1 and 13, passing 7 and 19; shield steady |
| `Run` | 16 | yes | contact 1 and 9; leaning forward |
| `Charge` | 16 | yes | run with weapon levelled forward, shield up, shouting |
| `Attack` | 24 | yes | 1 ready; 2 to 9 anticipation; 10 to 11 contact; 12 to 24 recover |
| `Attack2` | 30 | yes | a different strike (see unit); contact at 13 to 14 |
| `Block` | 24 | no | 1 ready; 4 shield or weapon up; 8 impact absorbed (knees bend, body pushed back); 16 to 24 lower |
| `Hit` | 10 | no | 1 to 3 jolt back; 4 to 10 recover |
| `Death` | 36 | no | knees buckle, fall backwards, on the ground by 28, hold |
| `DeathAlt` | 36 | no | twist and fall forward onto the shield, on the ground by 30, hold |
| `Victory` | 40 | yes | weapon raised, cheer |
| `Rout` | 16 | yes | running away: weapon lowered, shield slung on the back, looking back |

### 6.4 Archetype B: foot bow (all archers)
Attack starts and ends with an arrow already nocked; `Reload` draws and nocks the next one. The game
plays Attack, then Reload, then Attack again.
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle`, `IdleAlt`, `Walk`, `Run`, `Hit`, `Death`, `DeathAlt`, `Victory`, `Rout` | as in A | | bow held at the side; Rout drops nothing, bow carried |
| `Attack` | 24 | yes | 1 nocked, ready; 2 to 12 raise and draw; 13 to 14 release (string snaps forward); 15 to 24 follow-through and lower |
| `Reload` | 18 | yes | 1 to 6 reach to the quiver; 7 to 12 draw an arrow out; 13 to 18 nock and settle |
| `Attack2` | 20 | yes | rapid shot with its own quick nock: draw shorter, release at 11 to 12 |
| `Volley` | 36 | yes | aim high (about 40 degrees up), full draw, release at 26 to 27 |
| `AimHold` | 24 | yes | held at full draw, small tremble |
| `Block` | 20 | no | 1 ready; 4 step back, bow arm raised to cover the head; 8 impact; 12 to 20 recover |

### 6.5 Archetype C: foot gun (musketeers, riflemen, modern infantry, ATGM)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle`, `IdleAlt`, `Walk`, `Run`, `Hit`, `Death`, `DeathAlt`, `Victory`, `Rout` | as in A | | gun held at port arms |
| `Attack` | 24 | yes | 1 to 8 raise and aim; 9 fire (flash 9 to 10, smoke 9 to 14); 10 to 14 recoil; 15 to 24 lower |
| `Reload` | 48 (musket 72) | yes | era-correct: musket cartridge and ramrod, rifle ramrod kneeling, modern magazine swap, ATGM new tube |
| `Attack2` | 24 | yes | musketeers: bayonet thrust (contact 10 to 11); modern: kneeling burst; others: fire from cover pose |
| `Kneel` | 12 | no | stand to kneel (riflemen, ATGM) |

### 6.6 Archetype D: cavalry (horse and rider animated together)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle` | 48 | yes | horse shifts weight, tail swish, ear flick, head bob; rider relaxed |
| `IdleAlt` | 48 | yes | horse paws the ground, snorts (head toss) |
| `Walk` | 32 | yes | true 4-beat horse walk; rider sways with the horse |
| `Run` | 16 | yes | gallop; rider rises in the saddle and leans forward |
| `Charge` | 16 | yes | full gallop, lance couched or sabre forward |
| `Attack` | 24 | yes | rider strike (see unit), contact 10 to 11, horse keeps cantering in place |
| `Attack2` | 30 | yes | second strike (see unit), contact 13 to 14 |
| `Block` | 24 | no | 1 ready; 4 shield or weapon raised, horse sidesteps; 8 impact; 16 to 24 recover |
| `Rear` | 30 | no | horse rears up, front hooves high at 12, lands at 24 |
| `Hit` | 12 | no | horse flinches sideways, rider jolts |
| `Death` | 40 | no | horse stumbles, falls on its side; rider thrown and lands on the ground; hold |
| `DeathAlt` | 40 | no | rider falls off backwards, horse stays standing then lies down |
| `Victory` | 40 | yes | rider raises weapon, horse prances |
| `Rout` | 16 | yes | galloping away, rider looking back |

### 6.7 Archetype E: crewed machines (ram, ballista, trebuchet, cannon, artillery)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle` | 48 | yes | crew idle, check the machine |
| `Walk` | 32 | yes | crew push or haul with effort, wheels turn at the right speed |
| `Attack` | 30 to 60 | yes | firing cycle described in the unit entry |
| `Reload` | 30 to 60 | yes | crew reload as described in the unit entry |
| `Hit` | 12 | no | machine shakes, crew duck |
| `Death` | 40 | no | machine breaks: wheel off, frame tilts, crew fall; hold |

### 6.8 Archetype F: vehicles (tank, anti-air)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle` | 48 | yes | engine idle vibration, turret slow scan left and right |
| `Walk` | 24 | yes | tracks or wheels move, suspension bob, slight body pitch |
| `Run` | 16 | yes | faster track cycle, more pitch |
| `Attack` | 30 | yes | turret aims (or tilts up for AA), fires (flash and smoke), barrel recoils, hull rocks |
| `Reload` | 30 | yes | barrel returns, small settle |
| `Hit` | 12 | no | jolt, small spark plane |
| `Death` | 40 | no | big jolt, tilt, hatch opens, smoke plane; hold |

### 6.9 Archetype G: aircraft (fighter jet)
`Idle` = `Walk` = level flight (48, loop, slight bob); `Run` (24, loop, banking turn);
`Attack` (30, loop, nose dips, missile or gun flash); `Hit` (12); `Death` (48, smoking spiral down to
the ground, hold the wreck).

### 6.10 Archetype H: support workers
`Idle`, `IdleAlt`, `Walk`, `Run`, `Hit`, `Death`, `DeathAlt`, `Rout` as in A (load carried);
`Attack` = the work cycle (48, loop: digging, hammering or shovelling as in the unit entry, contact
at 20 to 21); `Attack2` (30, loop: a self-defence swing with the tool, contact 13 to 14); `Block`
(24, no loop: tool raised crosswise, as in A); `Victory` (40, loop, tools raised). The baggage
train's donkey uses horse-like Idle and Walk.

### 6.11 Archetype I: chariot
Horses as in D (`Idle`, `Walk`, `Run`, `Charge`, `Rear`), wheels spinning at the right speed, the
driver holding the reins. The archer as in B: `Attack` (shoot from the chariot), `Reload`,
`Attack2` (rapid shot). `Block` (24, no loop: driver swerves, archer ducks behind the panel).
`Hit`, `Death` (chariot overturns, horses fall, crew thrown; hold), `Victory`, `Rout`.

---

## 7. Exports per unit

### 7.1 GLB and JSON (game model)
- `units/{age}-{class}.glb`: glTF binary of the **game model** collection only, **uncompressed**
  (no Draco, no Meshopt): mesh, armature (without `x_` bones), all actions, materials. Export +Y
  up, apply modifiers, include all actions, no cameras or lights.
- `units/{age}-{class}.json`: the bake options of section 4.5.

### 7.2 Sprite sheets (render model, required)
- Render the **render model** in Cycles with the **game camera and light of section 1**,
  orthographic, transparent background, no ground plane, no shadows on the ground (the game draws
  its own shadow and selection ring). Denoise every frame.
- **8 directions.** Rotate the unit, not the camera, about Blender +Z. **Direction 0 = the unit
  facing Blender -Y (glTF +Z). Each next direction turns it 45 degrees counter-clockwise seen from
  above.** So direction 2 faces Blender +X, direction 4 faces +Y, direction 6 faces -X. Do not mirror
  directions; the weapon must stay in the right hand.
- **Sampling:** every second frame of each 30 fps clip, so sprites play at **15 fps**.
- **Cell size, scale and anchor** (the foot centre sits on the anchor pixel in every frame):
  | Class | Cell | Pixels per metre | Anchor |
  |---|---|---|---|
  | People (infantry, ranged, support) | 192 x 192 | 150 | (96, 180) |
  | Cavalry, chariots, machines, vehicles, aircraft | 256 x 256 | 100 | (128, 240) |
  | Trebuchet | 320 x 320 | 100 | (160, 304) |
- **Layout:** one sheet per action, `sprites/{age}-{class}/{age}-{class}_{Action}.webp`, with **8 rows
  (direction 0 at the top) and one column per sampled frame**. Maximum sheet width 4096 px; a
  longer clip wraps onto further row blocks of 8, recorded in the JSON.
- **Colour pass:** WebP, lossy colour (quality about 85) with **lossless alpha**
  (`cwebp -q 85 -alpha_q 100 -exact`). Team cloth renders in its neutral grey with its texture detail;
  skin renders at the middle tone #D9A07A.
- **Mask** per action, `{age}-{class}_{Action}_mask.png`, identical layout, lossless PNG:
  **red = Team coverage, green = Skin and Hair coverage, blue = 0**. Render the masks as AOV passes
  in the **same render** as the colour pass so edges match exactly (soft, anti-aliased values are
  fine). The game tints Team areas with the army colour and can shift skin tones per soldier.
- **Variants:** kit variant `A` gets every action. Kit variant `B` gets `Idle`, `IdleAlt`, `Walk`,
  `Run`, `Attack` and `Death` only, named `{age}-{class}_B_{Action}.webp` and `_B_{Action}_mask.png`.
  The game mixes A and B inside a squad and uses A for the rest.
- **Optimise** every PNG losslessly (oxipng). **Budget: 16 MB of sprite files per human unit,
  20 MB per cavalry or chariot unit, 12 MB per machine, vehicle or aircraft.** Report the sizes.
- **`{age}-{class}.sprites.json`:**
```json
{
  "unit": "classical-infantry",
  "cell": [192, 192],
  "anchor": [96, 180],
  "pixelsPerMetre": 150,
  "directions": 8,
  "direction0": "facing Blender -Y (glTF +Z)",
  "directionOrder": "counter-clockwise seen from above, 45 degrees each",
  "camera": { "type": "orthographic", "elevationDeg": 41.5, "azimuthDeg": 45 },
  "fps": 15,
  "mask": { "r": "team", "g": "skin", "b": "unused" },
  "skinBase": "#D9A07A",
  "variants": ["A", "B"],
  "variantBActions": ["Idle", "IdleAlt", "Walk", "Run", "Attack", "Death"],
  "actions": {
    "Idle":   { "file": "classical-infantry_Idle.webp",   "mask": "classical-infantry_Idle_mask.png",   "frames": 24, "loop": true },
    "Attack": { "file": "classical-infantry_Attack.webp", "mask": "classical-infantry_Attack_mask.png", "frames": 12, "loop": true, "contactFrame": 5 },
    "Block":  { "file": "classical-infantry_Block.webp",  "mask": "classical-infantry_Block_mask.png",  "frames": 12, "loop": false, "impactFrame": 3 },
    "Death":  { "file": "classical-infantry_Death.webp",  "mask": "classical-infantry_Death_mask.png",  "frames": 18, "loop": false, "holdLast": true }
  }
}
```
  Every action of the unit's archetype appears. `contactFrame` (0-based sprite frame index of the
  hit or release) is required for every attack, `impactFrame` for every `Block`, and
  `releaseFrame` for every `Reload` that ends with a projectile ready. These let the game sync
  damage, sound and blood.

### 7.3 2D files (keep them all)
`concepts/{age}-{class}_hero.png`, `_silhouette.png`, `_thumbs.png` (40, 60 and 150 px, blue and
orange), `_turnaround.png`, `_variants.png`, `_keyposes.png`, `_compare.png` (concept vs render
model at the game camera, and the game model beside them).

### 7.4 Previews
`previews/{age}-{class}_{Action}.gif` for every action at the game angle, in blue, at the real
sprite size and at 2x.

---

## 8. Validation (automated, every unit, before export)

Write `scripts/validate_unit.py` (run in Blender) that writes `reports/{age}-{class}.validation.json`
and fails the unit if any check fails:
- triangles within the budgets of section 4.1, for both models;
- height and footprint within 5% of section 4.3; feet at Z = 0; facing -Y; transforms applied;
- required bone or object names present (section 4.4); every vertex weighted; the game model not
  weighted to any `x_` bone; game-model weights rigid (one bone per vertex);
- every action of the archetype present (including the new ones in 6.2), frame counts as listed,
  loops seamless (last pose flows into the first), Idle frame 1 not a T-pose, feet pinned during
  contact frames (foot bone moves under 1 cm while planted), no vertex below Z = -0.01 in any frame;
- materials: `Team` present; **no `Emblem`**; no reserved words in other names; outside `Team`, no
  material whose average base colour is within 20 degrees of hue of blue #3B82F6 or orange #F97316
  **and** has saturation above 60% **and** value above 70% (browns, bronze and leather pass);
- **team coverage**: from the mask's red channel at the game camera, direction 0, Idle frame 1,
  Team pixels must be 15 to 30% of the unit's opaque pixels;
- GLB re-import round trip keeps every action, bone and material name;
- sprite sheets: every action and variant, 8 rows, frame counts match the JSON, anchor pixel on the
  feet in every cell (check the lowest opaque pixel), mask coverage inside the colour pass's alpha,
  totals within the section 7.2 budgets.

Also write `scripts/render_sprites.py` and `scripts/build_unit.py` so any unit can be rebuilt and
re-rendered from its .blend with one command.

---

## 9. Quality checklist (answer per unit in the log)
- Reads as its unit at 40 px? Different from the other units of its age as a silhouette?
- Looks believable at 150 px: materials read as metal, leather and cloth; nothing looks like plastic?
- Team colour 15 to 30% from the game camera, tint looks like dyed cloth, no strong blue or orange
  elsewhere?
- Render model, game model and 2D concept read as the same unit (`_compare.png`)?
- Every attack has anticipation, a held contact frame and recovery? Motion has weight and
  follow-through? Feet don't slide? Deaths fall with weight and hold?
- Variants A and B look like two different soldiers of the same unit?
- Validation passes? Sprite budget met?

---

## 10. Production phases and checkpoints

1. **Setup**: Blender, Cycles, folder layout (section 11), the three scripts, the style prompt prefix.
2. **Style bible and 2D lineup** (section 3.6). **STOP.**
3. **Pilot revision 3: `classical-infantry`, rebuilt in the realistic style.** Keep the v2 rig and
   bone names; build the render model, the game model, variant B, every action of Archetype A,
   everything in section 7 and the validation report. **STOP**: the developer tests it in the
   game, sprites and 3D, on a phone.
4. **Per age, in this order: Classical (rest), Kingdoms, Gunpowder, Bronze, Modern.** For each age:
   a. 2D for all of its units (section 2, steps 1 to 5) plus a lineup of the age. **STOP.**
   b. 3D, animation, validation, exports for all of its units, a lineup render at the game camera
      and the logs. **STOP.**
5. **Ships** (section 5.2).
6. **Final package** with the complete log.

Keep every unit consistent with the approved pilot: same proportions, lighting, camera, material
logic and animation quality. Reuse the base body, rig and horse.

---

## 11. Folder layout to deliver (one zip per checkpoint)
```
terra-imperium-units/
  units/                -> src/assets/units/      ({age}-{class}.glb + .json)
  sprites/              -> src/assets/sprites/    ({age}-{class}/ WebP sheets, PNG masks, .sprites.json)
  concepts/             2D files of section 7.3, plus style-bible.png, lineups, prompts.md
  previews/             GIFs
  blend/                one .blend per unit (collections `render` and `game`), textures packed
  scripts/              validate_unit.py, render_sprites.py, build_unit.py
  reports/              validation JSON per unit
  LOG.md
  LICENSE.md
```

---

## 12. Log (`LOG.md`)
Per unit: date, phases done, revision rounds, **input and output tokens** (or an estimate, marked as
such), wall-clock time (including render time), triangle counts for both models, sprite sizes,
validation result, open issues. A running total at the top, so the developer can see the real cost
per unit and for the whole roster.

## 13. Licensing
Models, textures and concept art are original, made for this project. Two exceptions are allowed:
**CC0 textures** (for example Poly Haven, ambientCG) and **motion capture** whose licence permits use
in a commercial game (for example the CMU motion capture database, or capture you record yourself).
List every third-party source with its licence in `LICENSE.md`. No copied reference images, no
traced photos, no real vehicle or aircraft models copied. `LICENSE.md` states the developer may use,
modify and distribute the assets commercially, and notes any tool whose terms add conditions.

---
*Developer note (for the human, not the artist): send each checkpoint's zip to Claude in the repo
session. It wires the files into the game, takes in-game screenshots at phone size and tells you
what to send back. The game still needs a sprite renderer, WebP loading, the mask (team and skin)
tint and variant mixing before these sprites show up; the current 3D path only uses the game model.*
