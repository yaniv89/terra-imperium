# Terra Imperium: unit art brief v2 for GPT-6 Astra (paste this whole document)

You are the 2D concept artist, 3D character artist, animator and technical artist for
**Terra Imperium**, a mobile-first grand strategy game with real-time tactical battles. Produce every
unit below **end to end**: 2D concept art, 3D model, rig, animations, validation, game exports and
sprite sheets, packaged so the developer can drop the files into the game repository unchanged.

Work in **Blender 4.x** driven by Python scripts (background `blender -b --python`, or a Blender MCP
connection). Use your image generation for all 2D work. Work in phases and **STOP** at every
checkpoint marked STOP until you get approval. Keep the log described in section 12.

This is version 2. It replaces the first brief. Section 0 lists what changed after the pilot.

---

## 0. What we learned from the pilot (classical swordsman, revision 2)

The pilot was tested inside the game. It loaded first try with no errors: the rig, bone names,
triangle budget, facing and GLB export were all correct. Keep doing all of that. Change these:

1. **No `Emblem` material, anywhere.** The game paints its own heraldry texture on anything named
   Emblem; on the pilot it came out white with stretched marks. Shield faces, banners and painted
   panels use the **`Team`** material.
2. **Do not put `height` in the bake-options JSON.** The game scales each model to match its own
   unit heights automatically. Model at the real scale in section 4.3 and leave the scaling to it.
3. **More team colour visible from above.** The camera looks down at 41.5 degrees, so most of what
   the player sees is helmet top, shoulders, shield top and back. Make crests, plumes, shoulder
   guards, shield faces and rims larger and Team-coloured (section 3.4).
4. **Full sprite sheets and team masks are required for every unit** (section 7). A preview strip
   is not enough.
5. **Animations will be visible.** The game is moving to sprite rendering, so your clips are what
   players will see. Follow the key-pose timings in section 6 exactly.
6. **Log time, revision rounds and tokens per unit.** If tokens can't be measured, say so and
   estimate.

---

## 1. The game, the camera and the light

- **Camera:** fixed, orthographic, never rotates. Direction from the target to the camera is the
  vector (1, 1.25, 1) normalised in the game's Y-up space, which is **(1, -1, 1.25) in Blender's
  Z-up space**. That is an elevation of **41.5 degrees** and an azimuth of 45 degrees. Every render
  in this brief that says "game camera" uses exactly this.
- **Sun:** a warm directional light (#FFE7C2), coming from the direction (22, 38, -10) in game space,
  which is **(22, 10, 38) in Blender**, normalised. **Sky fill:** hemisphere light, sky #E3EEF8 and
  ground #5A503F. **Tone mapping:** ACES Filmic (Blender: "AgX" is not the same; use "Filmic" or a
  matching ACES-like look and keep it identical for every unit), exposure about 1.05.
- **Size on screen:** on a phone a soldier is only **30 to 60 pixels tall**. Shapes must read at
  that size. Detail you can't see at 60 px doesn't exist.
- **Crowds:** a squad draws infantry 12, ranged 10, cavalry 8, siege 3, support 4, tanks 4,
  aircraft 3 copies, up to 64 squads per battle. Hundreds of copies at once on a phone, so stay
  inside the triangle and texture budgets.
- **Spacing:** soldiers in a squad stand on a grid about **0.52 m** apart (infantry, ranged),
  0.95 m (cavalry), 1.05 m (support), 1.5 m (siege). Keep each model's footprint inside that,
  except long weapons (spears, pikes) that may stick out forward.
- **Two armies:** blue **#3B82F6** and orange **#F97316**. The game recolours the `Team` material.
  Blue and orange must never appear anywhere else on a unit.
- **Any of 240 nations, 2000 BCE to 2300 CE.** Units are generic to their era, not tied to one
  country: a "Classical swordsman" must read as a classical soldier for Rome, Persia, Han China or
  Aksum alike. Team colour carries the nation. No real modern national flags, symbols or uniforms.
- **Tone:** stylised and friendly, Clash of Clans level of readability. Blood exists in the game as
  a separate effect, so models and animations stay clean: no gore, no wounds, no blood on models.

---

## 2. Workflow: 2D first, then 3D (every unit)

Image generation is fast and cheap; 3D revisions are slow and expensive. So every unit is designed
in 2D and approved before any modelling. Follow these steps in order for each unit:

1. **Hero concept** at the game camera angle (41.5 degrees down, three-quarter view), on a plain
   light-grey background, the unit in its Idle pose, in neutral grey team colour. 1024 x 1024.
2. **Readability test** from that image: the same unit as a pure black silhouette, then downscaled
   to 40 px and 60 px tall, in blue and orange versions. If it doesn't read at 40 px, redesign it
   now, not after modelling.
3. **Orthographic turnaround sheet**: front, side (facing right), back and top views of the same
   design, side by side on one sheet, **exactly the same scale**, feet on one ground line, a 0.1 m
   grid behind them, no perspective. 2048 x 1024. This is the modelling reference.
4. **Key-pose sheet**: 6 to 8 thumbnails of the unit's most important animation poses from
   section 6 (anticipation and contact frame of Attack, Block, Death end pose, Victory, Rout).
5. **STOP** for approval of the whole age's 2D sheets together (see section 10).
6. **Model in 3D** using the turnaround as reference image planes in Blender (front view on the XZ
   plane, side view on the YZ plane, scaled to the 0.1 m grid). Match proportions and shapes to the
   sheet; simplify detail to the triangle budget.
7. **Game-camera check render** of the 3D model next to the hero concept, same angle and size. They
   must read as the same unit. If not, fix the model.
8. **Rig, animate** (section 6), **validate** (section 8), **export** (section 7).

Consistency rules for image generation:
- Use one **style prompt prefix** for every image (write it once from the approved style bible and
  paste it at the start of every prompt), and attach the approved style bible and the previous
  units' hero concepts as references each time.
- Same lighting direction in every 2D image as the game sun (light from the upper right of the
  screen, warm), same plain background, same line weight, same colour palette.
- Keep a `prompts.md` with the exact prompt used for every image, so any image can be regenerated.

---

## 3. Style bible (Phase 1)

### 3.1 Proportions (people)
- Total height to the top of the head **1.0 m**; crest or plume extra above that.
- Head (with helmet) about **0.26 m**: slightly large, heroic, not chibi.
- Shoulders about 0.36 m wide; hands and feet slightly oversized; thick limbs; short neck.
- Weapons oversized by about 20% so they read at 40 px: a short sword about 0.45 m, a spear about
  1.6 m, a pike about 2.5 m, a bow about as tall as the body for longbows.

### 3.2 Shapes and surface
- Rounded, chunky forms with clear shape language: soft bevels on armour and shields, rounded
  helmets, simple cylinders and boxes with chamfered edges. Flat or softly smooth shading, no
  noisy texture.
- Big colour blocks. At most 6 or 7 flat materials per unit.

### 3.3 Palette (neutral, everything that isn't team colour)
| Use | Colour |
|---|---|
| Leather, dark | #4A3524 |
| Leather, mid | #7A5236 |
| Bronze | #B8862E |
| Iron / steel | #8C949C |
| Dark metal | #3C4248 |
| Wood | #8A6238 |
| Linen / cloth, light | #D8CFB8 |
| Cloth, dark | #5B5448 |
| Rope / wicker | #B49A64 |
| Skin tones (vary per unit) | #F1C7A0, #D9A07A, #A86B48, #6E4630 |
| Team placeholder | #BFBFBF (material `Team`) |

### 3.4 Team colour placement (at least 25% of what the game camera sees)
Priority order, use as many as fit the unit: helmet crest or plume, shoulder guards, shield face
and rim, tunic or tabard front and back, cloak, banner or pennant, saddle cloth, vehicle top panels
and turret sides. Everything Team-coloured uses the one `Team` material.

### 3.5 Phase 1 deliverables
- One style sheet image: the proportions diagram, the palette swatches, lighting reference, and
  three example shape studies (a helmet, a shield, a horse head).
- The **style prompt prefix** text (section 2).
- A 2D lineup of all 26 battlefield units' hero concepts at the same scale, plus the same lineup as
  black silhouettes and as 40 px thumbnails in blue and orange.

**STOP: wait for approval of the style bible, prompt prefix and lineup.**

---

## 4. Technical specification (every unit)

### 4.1 Modelling
- **Triangle budgets:** people 800 to **1,500** (hard max 1,500), cavalry and chariots up to
  **2,500**, siege engines, vehicles and aircraft up to **3,000**. The game rejects anything above
  3,000. Reuse one base body mesh and one horse mesh across units.
- **Colour:** flat materials (or vertex colours). No painted texture detail: the game samples one
  colour per triangle.
- **Orientation:** origin at the centre between the feet, feet on Blender Z = 0, the model facing
  **Blender -Y** (exports to glTF +Z, which the game expects). Apply all transforms.
- Closed, clean meshes; no faces below the ground; no hidden interior faces.

### 4.2 Materials and names (the game reads these names)
- `Team`: every team-coloured surface, base colour #BFBFBF.
- `Skin`: exposed skin.
- Others, descriptive: `Leather`, `LeatherDark`, `Bronze`, `Iron`, `DarkMetal`, `Wood`, `Linen`,
  `ClothDark`, `Rope`, `Rubber`, `Glass`.
- **Never** create `Emblem`, and never use these words in other material or object names unless
  the surface really is team-coloured: team, tabard, tunic, surcoat, banner, flag, cloak, cape,
  livery, plume, crest, emblem, heraldry, insignia, decal. Skin-like names (skin, flesh, face) only
  on `Skin` surfaces.

### 4.3 Real-scale targets (Blender metres)
| Unit type | Height | Footprint (width x depth) |
|---|---|---|
| Person on foot | 1.0 m to top of head (+ crest) | 0.5 x 0.4 m (weapons may extend forward) |
| Cavalry (horse + rider) | 1.8 m to rider's head | 0.5 x 1.0 m |
| Chariot with 2 horses | 1.5 m | 0.9 x 1.9 m |
| Battering ram / ballista / cannon | 0.9 to 1.1 m | up to 1.3 x 1.4 m |
| Trebuchet | 2.2 m | 1.2 x 1.4 m |
| Tank / AA vehicle / howitzer | 0.9 to 1.1 m | 0.9 x 1.4 m (barrels may extend) |
| Fighter jet | 0.5 m thick | 1.8 m wingspan x 2.2 m long |

### 4.4 Rig (people and horses)
- Armature with **these exact bone names**: `hips`, `spine`, `chest`, `neck`, `head`,
  `upper_arm.L`, `lower_arm.L`, `hand.L`, `upper_arm.R`, `lower_arm.R`, `hand.R`,
  `upper_leg.L`, `lower_leg.L`, `foot.L`, `upper_leg.R`, `lower_leg.R`, `foot.R`.
  Weapons and shields weighted 100% to `hand.R` / `hand.L`. The character's left is `.L`.
  The main weapon is in the **right** hand, the shield on the **left** arm.
- Optional extra bones for props: `weapon` (child of `hand.R`), `shield` (child of `hand.L`),
  `quiver`, `cape` (child of `chest`). Use them when a prop must move separately.
- Horses: `horse_root`, `horse_spine`, `horse_neck`, `horse_head`, `horse_tail`, `leg_front.L`,
  `leg_front_lower.L`, `leg_front.R`, `leg_front_lower.R`, `leg_back.L`, `leg_back_lower.L`,
  `leg_back.R`, `leg_back_lower.R`. The rider's `hips` is parented to `horse_spine`.
- Machines and vehicles: no skeleton; named objects `body`, `turret`, `barrel`,
  `wheel.FL`/`.FR`/`.BL`/`.BR`, `track.L`/`.R`, `arm` (trebuchet/ballista arms), `sling`,
  `counterweight`, `rotor`; crew figures are separate rigged people parented to `body`.
- Rigid or near-rigid weights (each vertex on one bone).

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
weapon, animation archetype (section 6) and unit-specific animation notes.

### 5.1 Battlefield units (26)

#### Bronze Age (2000 to 800 BCE): bronze, linen, leather, wicker; bare arms and legs common
1. **`bronze-infantry` Spearmen.** Silhouette: tall oval shield plus a long spear held upright.
   Look: linen kilt, quilted linen corselet, simple bronze cap helmet, bare arms and legs, sandals.
   Team: corselet, a short cloth crest on the helmet, the shield face. Weapon: 1.6 m spear with a
   leaf-shaped bronze head, overhand grip. Archetype A (foot melee). Attack: overhand spear thrust
   over the shield rim. Attack2: low underhand thrust. Block: shield raised, spear held back.
2. **`bronze-cavalry` Chariots.** Silhouette: two horses plus a two-wheeled box with two standing
   figures. Look: light chariot with 6-spoke wheels, wicker body, a driver holding reins and an
   archer with a self bow. Team: the chariot body panels, both crew's tunics, a pennant on a short
   pole. Archetype I (chariot). Wheels must spin in Walk, Run and Charge.
3. **`bronze-ranged` Archers.** Silhouette: big curved bow held at the side, quiver sticking up
   behind the shoulder, no shield. Look: kilt, leather cap, bare torso with a Team sash across the
   chest, quiver on the back. Team: sash, cap band, quiver. Archetype B (foot bow).
4. **`bronze-siege` Battering Ram.** Silhouette: a long low roofed frame on four wheels. Look: a log
   with a bronze ram head hung on ropes from an A-frame, hide roof, two crew inside pushing. Team:
   the roof hides (broad stripes) and crew tunics. Archetype E (crewed machine). Attack: the log
   swings back on its ropes (frames 1 to 14), strikes forward (15 to 18), rebounds (19 to 30).
5. **`bronze-support` Baggage Train.** Silhouette: a donkey with tall packs plus a walking porter.
   Look: donkey with two big baskets and a bedroll, porter with a staff. Team: cloth over the
   packs, porter's headband. Archetype H (support).

#### Classical Age (800 BCE to 500 CE): iron, bronze breastplates, crested helmets, big shields
6. **`classical-infantry` Swordsmen (the pilot).** Silhouette: big curved rectangular shield plus
   a tall transverse or front-to-back crest. Look: bronze crested helmet with cheek guards, bronze
   cuirass or banded armour over a tunic, leather skirt strips, greaves, short sword. Team: crest
   (make it big), shoulder guards, tunic, shield face and rim. Archetype A. Attack: shield punch then
   short thrust from behind the shield. Attack2: raised diagonal cut. Block: shield up, crouch,
   absorb, lower.
7. **`classical-cavalry` Heavy Cavalry.** Silhouette: tall horse plus a rider holding a long lance
   upright. Look: scale or mail armour, plumed helmet, round shield on the back, a sturdy horse.
   Team: rider's cloak, helmet plume, saddle cloth (large, hanging down the horse's sides).
   Archetype D (cavalry). Charge: lance lowered and couched. Attack2: overhand spear stab.
8. **`classical-ranged` Composite Archers.** Silhouette: short, strongly recurved bow (tips curl
   forward), hip quiver. Look: tunic, light helmet or felt cap, trousers, boots. Team: tunic, cap,
   quiver cover. Archetype B. Faster draw than other archers.
9. **`classical-siege` Ballista.** Silhouette: a big crossbow shape on a wheeled stand. Look: two
   arms with torsion springs, a bolt in the groove, a winch at the back, one crew turning it.
   Team: painted frame panels and the crew's tunic. Archetype E. Attack: arms snap forward and the
   bolt flies (a separate bolt object visible frames 1 to 4 of the release), frame recoils, crew
   winches back.
10. **`classical-support` Engineers.** Silhouette: a figure with a pick over the shoulder and a big
    basket. Look: tunic, rolled sleeves, tool satchel, a coil of rope. Team: tunic and sash.
    Archetype H. Work: digging with the pick.

#### Age of Kingdoms (500 to 1500): mail, surcoats, kite and heater shields, heraldic colour
11. **`kingdoms-infantry` Pikemen.** Silhouette: a very long pike (2.5 m, the defining shape) held
    upright or lowered, small buckler. Look: padded gambeson, kettle hat or sallet, gloves. Team:
    surcoat or tabard, hat band, a small pennant tied below the pike head. Archetype A. Attack:
    two-handed pike thrust from a braced stance. Block: pike lowered and braced against a charge
    (butt on the ground behind the foot). Charge: pike levelled at a jog.
12. **`kingdoms-cavalry` Knights.** Silhouette: the most impressive of the age: a horse in a long
    cloth caparison, a rider with a great helm and a tall plume, a heater shield and a lance.
    Look: mail and early plate. Team: caparison (most of the horse), surcoat, plume, shield face.
    Archetype D. Charge: lance couched, horse at full gallop. Attack2: sword swing from the saddle.
13. **`kingdoms-ranged` Longbowmen.** Silhouette: a bow as tall as the archer, no shield. Look:
    padded jack, hood or simple cap, arrows stuck in the ground at the feet. Team: tabard, hood.
    Archetype B. Attack: full draw to the ear. Volley: high-angle draw and release.
14. **`kingdoms-siege` Trebuchet.** Silhouette: tall A-frame tower with a long arm and a box
    counterweight. Look: timber frame, sling, two crew. Team: a banner on top of the frame, the
    counterweight box panels. Archetype E. Attack (60 frames): crew pull, arm swings up and over,
    sling releases, counterweight drops and swings, arm settles.
15. **`kingdoms-support` Pioneers.** Silhouette: hooded figure with an axe and a bundle of stakes.
    Team: tunic, hood. Archetype H. Work: hammering stakes.

#### Age of Gunpowder (1500 to 1900): coats, crossbelts, tricorns, muskets and bayonets
16. **`gunpowder-infantry` Musketeers.** Silhouette: long coat flaring at the hem, tricorn, musket
    with bayonet held upright. Look: coat with turned-back cuffs, white crossbelts, gaiters. Team:
    the coat. Neutral facings and cuffs. Archetype C (foot gun). Attack: shoulder, aim, fire
    (muzzle-flash plane and smoke-puff plane as separate objects, visible only frames 9 to 12),
    recoil. Reload: bite cartridge, ramrod, return to shoulder. Attack2: bayonet thrust.
17. **`gunpowder-cavalry` Dragoons.** Silhouette: horse plus a rider with a brimmed or crested hat
    and a raised sabre. Team: coat, saddle cloth. Archetype D. Charge: sabre pointed forward.
    Attack: sabre slash. Attack2: carbine shot from the saddle.
18. **`gunpowder-ranged` Riflemen.** Silhouette: kneeling shooter with a long rifle, short jacket,
    soft cap or shako. Must look different from the musketeers at 40 px. Team: jacket, cap band.
    Archetype C. Attack: from kneeling. Reload: kneeling ramrod reload.
19. **`gunpowder-siege` Field Cannon.** Silhouette: a gun barrel on two big wheels with a trail.
    Look: bronze barrel, wooden carriage, two crew (one with a rammer, one with a linstock).
    Team: carriage cheeks and crew coats. Archetype E. Attack: fire (flash and smoke planes), the
    whole gun recoils back 0.3 m, crew sponge, load, run it forward.
20. **`gunpowder-support` Sappers.** Silhouette: figure with a shovel and a wicker gabion basket.
    Look: leather apron, coat. Team: coat. Archetype H. Work: shovelling.

#### Modern Age (1900 to 2300): helmets, fatigues, vehicles; stylised, non-gory
21. **`modern-infantry` Mechanized Infantry.** Silhouette: rounded helmet, backpack, rifle held
    across the chest. Look: neutral olive fatigues, boots, gloves, chest rig. Team: helmet cover
    band, shoulder patches, chest-rig panels, backpack flap. Archetype C. Attack: aim from the
    shoulder, three-round burst with recoil (flash plane per shot). Reload: magazine swap.
22. **`modern-cavalry` Tanks.** Silhouette: big turret, short wide hull, long barrel. Look: chunky
    stylised main battle tank, olive and dark metal, rounded edges. Team: turret sides and top
    panels, a stripe on the hull front. Archetype F (vehicle). `turret` and `barrel` separate
    objects; tracks `track.L`/`.R` with a scrolling or rotating look.
23. **`modern-ranged` ATGM Teams.** Silhouette: two figures, one kneeling with a launcher tube on
    the shoulder. Team: helmet bands, patches, backpack flaps. Archetype C. Attack: aim, launch
    (back-blast plane behind the tube), reload a new tube.
24. **`modern-siege` Artillery.** Silhouette: long barrel on a low towed carriage with split trail
    legs. Team: gun shield panels, crew helmet bands. Archetype E. Attack: fire, big recoil, crew
    load.
25. **`modern-support` Anti-Air Battery.** Silhouette: a vehicle with a radar dish and twin guns or
    a missile pod pointing up. Team: turret panels, hull stripe. Archetype F. Attack: turret
    tilts up and fires skywards (tracer planes upwards).
26. **`modern-air` Fighter Jet.** Silhouette: swept wings, twin tails, chunky fuselage. Team: wing
    stripes, tail fins. Archetype G (aircraft). Rendered flying above the battlefield.

### 5.2 World-map ships (5, last)
Map tokens only: `Idle` (gentle bobbing) and `Walk` (sailing, oars or bow wave), up to 1,500
triangles, GLB only, no sprite sheets.
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
- **Idle frame 1 is the neutral rest pose** (arms down or weapon held, never a T-pose). The game
  uses it as the base pose.
- Timing beats: every strike has an **anticipation** (wind-up), a **contact frame** (the sharpest
  pose, held 2 frames) and a **recovery**. Use ease-in on wind-ups, a fast snap into contact.
- Feet: planted feet must not slide (pin them during contact); Walk and Run strides match the
  speeds below so feet don't skate when the game moves the unit:
  infantry walk 1.6 m/s, run 2.6 m/s; cavalry walk 3.2 m/s, gallop 5.0 m/s; siege 0.9 m/s.
- Deaths end lying flat and **hold the last frame**; nothing sinks below the ground.
- Variation: units in a squad play the same clip at different offsets, so avoid poses that look
  silly in unison; give Idle and IdleAlt small asymmetric motion.
- Effects that belong to the animation (muzzle flash, smoke puff, bolt in flight, sparks) are
  separate simple plane objects named `fx_flash`, `fx_smoke`, `fx_bolt`, shown only on their frames
  (use visibility keys), with no team colour.

### 6.2 Archetype A: foot melee (spearmen, swordsmen, pikemen)
| Action | Frames | Loop | Key poses (frame numbers) |
|---|---|---|---|
| `Idle` | 48 | yes | 1 rest; slow breathing; weapon ready |
| `IdleAlt` | 48 | yes | shift weight, look left and right, adjust grip |
| `Walk` | 24 | yes | contact 1 and 13, passing 7 and 19; shield steady |
| `Run` | 16 | yes | contact 1 and 9; leaning forward |
| `Charge` | 16 | yes | run with weapon levelled forward, shield up, shouting pose |
| `Attack` | 24 | yes | 1 ready; 2 to 9 anticipation; 10 to 11 contact; 12 to 24 recover |
| `Attack2` | 30 | yes | a different strike (see unit); contact at 13 to 14 |
| `Block` | 24 | no | 1 ready; 4 shield up; 8 impact absorb (knees bend); 16 to 24 lower |
| `Hit` | 10 | no | 1 to 3 jolt back; 4 to 10 recover |
| `Death` | 36 | no | knees buckle, fall backwards, flat by 28, hold |
| `DeathAlt` | 36 | no | twist and fall forward onto the shield, flat by 30, hold |
| `Victory` | 40 | yes | weapon raised, cheer |
| `Rout` | 16 | yes | running away: weapon lowered, shield slung on the back, looking back |

### 6.3 Archetype B: foot bow (all archers)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle`, `IdleAlt`, `Walk`, `Run`, `Hit`, `Death`, `DeathAlt`, `Victory`, `Rout` | as in A | | bow held at the side; Rout drops nothing, bow carried |
| `Attack` | 30 | yes | 1 to 6 reach for arrow; 7 to 10 nock; 11 to 20 draw; 21 to 22 release (string snaps); 23 to 30 follow-through |
| `Attack2` | 20 | yes | rapid shot: shorter draw, release at 13 |
| `Volley` | 36 | yes | aim high (about 40 degrees up), full draw, release at 26 |
| `AimHold` | 24 | yes | held at full draw, small tremble |

### 6.4 Archetype C: foot gun (musketeers, riflemen, modern infantry, ATGM)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle`, `IdleAlt`, `Walk`, `Run`, `Hit`, `Death`, `DeathAlt`, `Victory`, `Rout` | as in A | | gun held at port arms |
| `Attack` | 24 | yes | 1 to 8 raise and aim; 9 fire (flash 9 to 10, smoke 9 to 14); 10 to 14 recoil; 15 to 24 lower |
| `Reload` | 48 (musket 72) | yes | era-correct: musket ramrod, rifle ramrod kneeling, modern magazine swap, ATGM new tube |
| `Attack2` | 24 | yes | musketeers: bayonet thrust; modern: kneeling burst; others: fire from cover pose |
| `Kneel` | 12 | no | stand to kneel (riflemen, ATGM) |

### 6.5 Archetype D: cavalry (horse and rider animated together)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle` | 48 | yes | horse shifts weight, tail swish, head bob; rider relaxed |
| `IdleAlt` | 48 | yes | horse paws the ground, snorts (head toss) |
| `Walk` | 32 | yes | 4-beat horse walk; rider sways |
| `Run` | 16 | yes | gallop; rider leans forward |
| `Charge` | 16 | yes | full gallop, lance couched or sabre forward |
| `Attack` | 24 | yes | rider strike (see unit), contact 10 to 11, horse keeps cantering in place |
| `Attack2` | 30 | yes | second strike (see unit) |
| `Rear` | 30 | no | horse rears up, front hooves high at 12, lands at 24 |
| `Hit` | 12 | no | horse flinches sideways, rider jolts |
| `Death` | 40 | no | horse stumbles, falls on its side; rider thrown and lands flat; hold |
| `DeathAlt` | 40 | no | rider falls off backwards, horse stays standing then lies down |
| `Victory` | 40 | yes | rider raises weapon, horse prances |
| `Rout` | 16 | yes | galloping away, rider looking back |

### 6.6 Archetype E: crewed machines (ram, ballista, trebuchet, cannon, artillery)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle` | 48 | yes | crew idle, check the machine |
| `Walk` | 32 | yes | crew push or haul, wheels turn at the right speed |
| `Attack` | 30 to 60 | yes | firing cycle described in the unit entry |
| `Reload` | 30 to 60 | yes | crew reload (if the unit has a separate reload) |
| `Hit` | 12 | no | machine shakes, crew duck |
| `Death` | 40 | no | machine breaks: wheel off, frame tilts, crew fall; hold |

### 6.7 Archetype F: vehicles (tank, anti-air)
| Action | Frames | Loop | Key poses |
|---|---|---|---|
| `Idle` | 48 | yes | engine idle vibration, turret slow scan left and right |
| `Walk` | 24 | yes | tracks or wheels move, slight body pitch |
| `Run` | 16 | yes | faster track cycle, more pitch |
| `Attack` | 30 | yes | turret aims (or tilts up for AA), fires (flash and smoke), barrel recoils |
| `Reload` | 30 | yes | barrel returns, small settle |
| `Hit` | 12 | no | jolt, small spark plane |
| `Death` | 40 | no | big jolt, tilt, hatch opens, smoke plane; hold |

### 6.8 Archetype G: aircraft (fighter jet)
`Idle` = `Walk` = level flight (48, loop, slight bob); `Run` (24, loop, banking turn);
`Attack` (30, loop, nose dips, missile or gun flash); `Hit` (12); `Death` (48, smoking spiral down to
the ground, hold the wreck).

### 6.9 Archetype H: support workers
`Idle`, `IdleAlt`, `Walk`, `Run`, `Hit`, `Death`, `DeathAlt`, `Rout` as in A (load carried);
`Attack` = the work cycle (48, loop: digging, hammering or shovelling as in the unit entry);
`Victory` (40, loop, tools raised). The baggage train's donkey uses horse-like Idle and Walk.

### 6.10 Archetype I: chariot
Horses as in D (`Idle`, `Walk`, `Run`, `Charge`, `Rear`), wheels spinning at the right speed, the
driver holding the reins, the archer as in B: `Attack` (shoot from the chariot), `Attack2` (rapid
shot). `Hit`, `Death` (chariot overturns, horses fall, crew thrown; hold), `Victory`, `Rout`.

---

## 7. Exports per unit

### 7.1 GLB and JSON
- `units/{age}-{class}.glb`: glTF binary, **uncompressed** (no Draco, no Meshopt), mesh, armature,
  all actions, materials. Export +Y up, apply modifiers, include all actions, no cameras or lights.
- `units/{age}-{class}.json`: the bake options of section 4.5.

### 7.2 Sprite sheets (the Clash of Clans technique, required)
- Render with the **game camera and light of section 1**, orthographic, transparent background,
  no ground plane, no shadows on the ground (the game draws its own shadow and selection ring).
- **8 directions.** Rotate the unit, not the camera, about Blender +Z. **Direction 0 = the unit
  facing Blender -Y (glTF +Z). Each next direction turns it 45 degrees counter-clockwise seen from
  above.** So direction 2 faces Blender +X, direction 4 faces +Y, direction 6 faces -X.
- **Sampling:** every second frame of each 30 fps clip, so sprites play at **15 fps**.
- **Cell size:** **128 x 128 px** for people, **192 x 192 px** for cavalry, chariots, machines,
  vehicles and aircraft. The same orthographic scale for every unit of a size class (so a 1.0 m
  person is about 100 px tall in a 128 cell for every human unit), and the unit's foot centre on
  the same anchor pixel in every frame: **(64, 116)** for 128 cells, **(96, 176)** for 192 cells.
- **Layout:** one PNG per action, `sprites/{age}-{class}/{age}-{class}_{Action}.png`, with **8 rows
  (direction 0 at the top) and one column per sampled frame**. Maximum sheet width 4096 px; a
  longer clip wraps onto further row blocks of 8, recorded in the JSON.
- **Team mask** per action, `{age}-{class}_{Action}_team.png`, identical layout: white where the
  `Team` material is visible, black elsewhere (render the Team material as pure white emission and
  everything else as black emission, same camera, no anti-alias differences from the colour pass).
- **Colour pass with team colour as the neutral #BFBFBF**; the game tints it using the mask.
- **Optimise** every PNG losslessly (oxipng or similar). Budget: **8 MB of sprite files per unit**.
  Report the sizes.
- **`{age}-{class}.sprites.json`:**
```json
{
  "unit": "classical-infantry",
  "cell": [128, 128],
  "anchor": [64, 116],
  "pixelsPerMetre": 100,
  "directions": 8,
  "direction0": "facing Blender -Y (glTF +Z)",
  "directionOrder": "counter-clockwise seen from above, 45 degrees each",
  "camera": { "type": "orthographic", "elevationDeg": 41.5, "azimuthDeg": 45 },
  "fps": 15,
  "actions": {
    "Idle":   { "file": "classical-infantry_Idle.png",   "team": "classical-infantry_Idle_team.png",   "frames": 24, "loop": true },
    "Attack": { "file": "classical-infantry_Attack.png", "team": "classical-infantry_Attack_team.png", "frames": 12, "loop": true, "contactFrame": 5 },
    "Death":  { "file": "classical-infantry_Death.png",  "team": "classical-infantry_Death_team.png",  "frames": 18, "loop": false, "holdLast": true }
  }
}
```
  Every action of the unit's archetype appears. `contactFrame` (sprite frame index of the hit or
  release) is required for every attack, so the game can sync damage, sound and blood.

### 7.3 2D files (keep them all)
`concepts/{age}-{class}_hero.png`, `_silhouette.png`, `_thumbs.png` (40 and 60 px, blue and
orange), `_turnaround.png`, `_keyposes.png`, `_compare.png` (concept vs 3D game-camera render).

### 7.4 Previews
`previews/{age}-{class}_{Action}.gif` for every action at the game angle, in blue.

---

## 8. Validation (automated, every unit, before export)

Write `scripts/validate_unit.py` (run in Blender) that writes `reports/{age}-{class}.validation.json`
and fails the unit if any check fails:
- triangles within the budget of section 4.1;
- height and footprint within 5% of section 4.3; feet at Z = 0; facing -Y; transforms applied;
- required bone or object names present (section 4.4); every vertex weighted;
- every action of the archetype present, frame counts as listed, loops seamless (last pose
  flows into the first), Idle frame 1 not a T-pose, feet pinned during contact frames (foot bone
  moves under 1 cm while planted), no vertex below Z = -0.01 in any frame;
- materials: `Team` present; **no `Emblem`**; no reserved words in other names; no base colour
  within 25 degrees of hue of blue #3B82F6 or orange #F97316 outside `Team`;
- **team coverage**: render the team mask at the game camera, direction 0, Idle frame 1; Team
  pixels must be at least 25% of the unit's pixels;
- GLB re-import round trip keeps every action, bone and material name;
- sprite sheets: every action, 8 rows, frame counts match the JSON, anchor pixel on the feet in
  every cell (check the lowest opaque pixel), masks match the colour pass's alpha, total size
  under 8 MB.

Also write `scripts/render_sprites.py` and `scripts/build_unit.py` so any unit can be rebuilt and
re-rendered from its .blend with one command.

---

## 9. Quality checklist (answer per unit in the log)
- Reads as its unit at 40 px? Different from the other units of its age as a silhouette?
- Team colour at least 25% from the game camera, and none of blue or orange elsewhere?
- 3D matches the 2D concept (the `_compare.png`)?
- Every attack has anticipation, a held contact frame and recovery? Feet don't slide? Deaths
  end flat and hold?
- Validation passes? Sprite budget met?

---

## 10. Production phases and checkpoints

1. **Setup**: Blender, folder layout (section 11), the three scripts, the style prompt prefix.
2. **Style bible and 2D lineup** (section 3.5). **STOP.**
3. **Pilot revision 3: `classical-infantry`.** Apply section 0 to the existing pilot, add the new
   actions (IdleAlt, Charge, Block, DeathAlt, Rout), deliver everything in section 7 and the
   validation report. **STOP**: the developer tests it in the game, sprites and 3D, on a phone.
4. **Per age, in this order: Classical (rest), Kingdoms, Gunpowder, Bronze, Modern.** For each age:
   a. 2D for all of its units (section 2, steps 1 to 4) plus a lineup of the age. **STOP.**
   b. 3D, animation, validation, exports for all of its units, a 3D lineup render and the logs.
      **STOP.**
5. **Ships** (section 5.2).
6. **Final package** with the complete log.

Keep every unit consistent with the approved pilot: same proportions, lighting, camera, palette
logic and animation timing style. Reuse the base body, rig and horse.

---

## 11. Folder layout to deliver (one zip per checkpoint)
```
terra-imperium-units/
  units/                -> src/assets/units/      ({age}-{class}.glb + .json)
  sprites/              -> src/assets/sprites/    ({age}-{class}/ PNGs, masks, .sprites.json)
  concepts/             2D files of section 7.3, plus style-bible.png, lineups, prompts.md
  previews/             GIFs
  blend/                one .blend per unit
  scripts/              validate_unit.py, render_sprites.py, build_unit.py
  reports/              validation JSON per unit
  LOG.md
  LICENSE.md
```

---

## 12. Log (`LOG.md`)
Per unit: date, phases done, revision rounds, **input and output tokens** (or an estimate, marked as
such), wall-clock time, triangle count, sprite sizes, validation result, open issues. A running total
at the top, so the developer can see the real cost per unit and for the whole roster.

## 13. Licensing
Everything original, made for this project; no third-party models, textures or copied reference
images. `LICENSE.md` states the developer may use, modify and distribute the assets commercially,
and notes any tool whose terms add conditions.

---
*Developer note (for the human, not the artist): send each checkpoint's zip to Claude in the repo
session. It wires the files into the game, takes in-game screenshots at phone size and tells you
what to send back.*
