# Terra Imperium: unit art brief for GPT-6 Astra (paste this whole document)

You are the 3D character artist and technical artist for **Terra Imperium**, a mobile-first grand
strategy game with real-time tactical battles. Produce every unit below **end to end**: concept art,
3D model, rig, animations, validation, game exports and sprite sheets, packaged so the developer can
drop the files into the game repository unchanged.

Work in **Blender** (free, blender.org; version 4.0 or newer) driven by Python scripts. Use your image
generation for concept art. Work in phases, stop at the checkpoints marked **STOP** and wait for
approval. Keep a running log (section 9) that includes your token usage per unit.

---

## 1. The game, and what the art must do

- Battles are seen from a **fixed isometric camera**, orthographic, looking down at about
  **41.5 degrees** (camera direction vector (1, 1.25, 1) normalised, pointing at the target). The
  camera never rotates. On a phone a soldier is only **30 to 60 pixels tall**.
- Each squad shows several soldiers (infantry 12, ranged 10, cavalry 8, siege 3, support 4, tanks 4,
  aircraft 3), up to 64 squads per battle, so **hundreds of copies on screen at once on a phone**.
- Two armies fight: **blue (#3b82f6) and orange (#f97316)**. The game tints the team-colour parts
  of each unit at runtime, so every unit must have clearly marked team-colour surfaces.
- The game spans 2000 BCE to 2300 CE and any of 240 nations worldwide. Units are **generic to their
  era, not tied to one country**: a "Classical swordsman" should read as a classical soldier
  whether the player is Rome, Persia, Han China or Aksum. Team colour carries the nation. Avoid
  flags, symbols or uniforms belonging to any real modern state or military.

**Readability rules (most important):**
1. Silhouette first. Each class must be recognisable as a black shape at 40 px:
   infantry = shield + weapon, ranged = bow/gun raised and no shield, cavalry = tall mounted
   shape, siege = machine bigger than a person, support = carried load or tools.
2. Chunky, slightly heroic proportions (head about 1/4 of body height, big hands, big weapons,
   thick limbs), like Clash of Clans: stylised, friendly, readable, not realistic and not chibi.
3. Big colour blocks, no tiny details. Detail comes from shape, not from texture noise.
4. Team-colour area large and visible from above: tunic/tabard, shoulders, helmet plume or crest,
   shield face, banners, vehicle panels. At least 20% of the visible surface from the camera angle.
5. Neutral palette for everything that is not team colour: leather browns, bronze/iron/steel greys,
   cloth off-whites, wood; skin tones varied across units. Never use blue or orange outside the
   team-colour material, so the two armies never get confused.

## 2. Style bible (Phase 1 output, used for every unit)

Before modelling, produce and get approval for:
- A one-page style sheet: proportions diagram (heights in head units), palette swatches (neutral
  palette + a mid-grey "team" placeholder), lighting reference, line of action examples.
- A lineup image of all 26 battlefield units side by side at the same scale, front three-quarter
  view, plus the same lineup as black silhouettes, to prove readability.

**STOP: wait for approval of the style bible and lineup.**

## 3. Technical specification (every unit)

### Modelling
- Low-poly, flat or softly shaded. **Triangle budget per single model: 800 to 1,500 for a person,
  up to 2,500 for cavalry (horse + rider), up to 3,000 for siege engines, vehicles and aircraft.
  Hard maximum 3,000.** The game rejects anything above that.
- **Colours as flat materials or vertex colours, not detailed textures.** The game samples one
  colour per triangle, so painted texture detail is lost. If you use a palette texture, keep each
  triangle on one flat colour.
- Units: Blender metres. A standing person is **1.0 m tall** (feet at 0, top of head at 1.0).
  The game rescales, but proportions between units must be consistent: a horse with rider about
  1.4 m to the rider's head, a battering ram about 0.9 m tall and 2 m long, a trebuchet about
  2.2 m tall, a tank about 0.9 m tall and 2 m long, a fighter jet 2.5 m long.
- **Origin at the feet centre, feet on Z = 0 in Blender, model facing Blender's -Y** (which
  exports to glTF +Z, the direction the game expects). Apply all transforms (scale 1, rotation 0).
- Manifold, no hidden interior faces, no faces below the ground plane.

### Materials and names (the game reads these names)
- Team-colour surfaces: one material named **`Team`** (base colour mid light grey #BFBFBF). The
  game recolours it blue or orange.
- Shield faces / emblems: a material named **`Emblem`** (light grey, separate from `Team`).
- Exposed skin: a material named **`Skin`**.
- All other materials: descriptive names (`Leather`, `Bronze`, `Iron`, `Wood`, `Cloth`, `Steel`,
  `Rubber`, `Glass`), never containing the words team, tunic, tabard, cloak, cape, banner, flag,
  livery, plume, skin or face unless they really are those surfaces.

### Rig (people and horses)
- Armature with **these exact bone names** (the game maps limbs by name):
  `hips`, `spine`, `chest`, `neck`, `head`,
  `upper_arm.L`, `lower_arm.L`, `hand.L`, `upper_arm.R`, `lower_arm.R`, `hand.R`,
  `upper_leg.L`, `lower_leg.L`, `foot.L`, `upper_leg.R`, `lower_leg.R`, `foot.R`.
  Weapons and shields are parented to `hand.R` / `hand.L` (one-piece weapons may be skinned 100% to
  the hand). Character's left is .L.
- Horses: a separate armature or the same one with `horse_spine`, `horse_neck`, `horse_head`,
  `leg_front.L`, `leg_front.R`, `leg_back.L`, `leg_back.R` (plus lower segments `_lower`).
- Vehicles and machines: no skeleton needed; split into named objects: `body`, `turret`,
  `barrel`, `wheel.FL/FR/BL/BR` or `track.L/R`, `arm` (trebuchet/catapult throwing arm),
  `rotor` / `propeller` where relevant.
- Weight painting: rigid or near-rigid (each vertex mostly on one bone). Low-poly, no muscles.

### Animations (glTF actions, these exact names)
All in place (no root motion), 30 fps, looping where marked.
| Action | Frames | Loop | Notes |
|---|---|---|---|
| `Idle` | 30 | yes | breathing, weapon ready; **frame 1 is the neutral pose** (arms down, not a T-pose) |
| `Walk` | 24 | yes | marching gait; cavalry: horse trot |
| `Run` | 16 | yes | charge; cavalry gallop; vehicles: faster wheel/track cycle |
| `Attack` | 24 | yes | the class's attack (see each unit): melee swing with anticipation, contact, recoil; ranged draw-aim-release or aim-fire-recoil; siege fire cycle |
| `Hit` | 10 | no | flinch backwards |
| `Death` | 30 | no | fall and lie flat; last frame holds; vehicles: jolt, smoke pose, tilt |
| `Victory` | 30 | yes | optional, weapon raised |

Timing matters more than polish: clear anticipation before every strike, a crisp contact frame,
follow-through. Keep weapons from clipping through bodies.

### Exports per unit
1. **GLB** (glTF binary, uncompressed: no Draco, no Meshopt): `{age}-{class}.glb` containing the
   mesh, armature, all actions and materials. +Y up, apply modifiers, include animations, export
   materials, no cameras or lights.
2. **Bake options** `{age}-{class}.json`, for example
   `{ "restClip": "Idle", "quadruped": false, "height": 1.0 }`
   (cavalry: `"quadruped": true`; vehicles: `"restClip": "bind"`).
3. **Sprite sheets** (the Clash of Clans technique, used by the game's upcoming sprite renderer):
   - Render with an **orthographic camera at 41.5 degrees elevation** looking at the unit, fixed
     soft key light from the upper left of the screen plus a soft fill, transparent background,
     Filmic or Standard view transform kept the same for every unit.
   - **8 directions**: rotate the unit (not the camera) in 45 degree steps; direction 0 = the unit
     facing the camera's left-down screen direction, then clockwise as seen from above. Use the
     same order for every unit.
   - Every action above, every frame, at **256 x 256 px per frame** (people), 384 x 384 (cavalry,
     siege, vehicles, aircraft), unit feet at the same anchor point in every frame.
   - One PNG per action: `{age}-{class}_{action}.png`, **8 rows (directions) x N columns (frames)**.
   - A matching **team mask** per action, `{age}-{class}_{action}_team.png`: white where the `Team`
     material is visible, black elsewhere (render with an emission override), same layout.
   - One `{age}-{class}.sprites.json`:
     `{ "frame": [256, 256], "anchor": [128, 232], "directions": 8, "fps": 30,
        "actions": { "Idle": { "file": "...png", "frames": 30, "loop": true }, ... } }`
4. **Concept sheet** `{age}-{class}_concept.png` (front, side, back, three-quarter) for the record.

### Validation (automate it, run it on every unit before export)
Write a Blender Python script `validate_unit.py` that prints a JSON report per unit and fails the
unit if any check fails:
- triangle count within budget; bounding-box height within 5% of the target; feet at Z = 0;
  facing -Y; transforms applied;
- all required bone names present (people/horses) or object names (machines);
- all required actions present with the right frame counts; `Idle` frame 1 not a T-pose;
- materials `Team` (and `Emblem`, `Skin` where relevant) present; no other material name contains
  the reserved words; no blue/orange outside `Team` (check base colours' hue);
- GLB re-import round trip succeeds and the action list survives export.

## 4. The units

The game has 5 ages. **Battlefield units** (section 4.1) are the priority. **Naval** (4.2) appear on
the world map only and are lower priority. Each entry: in-game name, then what to make.

### 4.1 Battlefield units (26)

**Bronze Age (2000 to 800 BCE)**: bronze, linen, leather, wicker; bare arms and legs common.
1. `bronze-infantry` **Spearmen**: linen kilt and quilted linen corselet (Team), simple bronze
   cap helmet, big round or tall oval wicker-and-hide shield (Emblem face), long spear held
   overhand. Attack: two-handed overhand spear thrust behind the shield.
2. `bronze-cavalry` **Chariots**: a light two-wheeled chariot (spoked wheels, wicker body with Team
   panels) pulled by two horses, a driver and an archer standing in it. Horses use the horse rig;
   driver and archer use the person rig. Attack: the archer draws and shoots from the moving
   chariot while the driver holds the reins. Walk/Run: horses trot/gallop, wheels spin.
   Budget up to 3,000.
3. `bronze-ranged` **Archers**: kilt with Team sash, leather cap, simple self bow (long, slightly
   curved), quiver on the back, no shield. Attack: draw, aim, release, reach for the next arrow.
4. `bronze-siege` **Battering Ram**: a heavy log with a bronze ram head hung from a wooden A-frame
   on four solid wheels, a hide roof (Team stripes on the roof edge), with 2 crew figures inside
   pushing (person rig or animated as part of the machine). Attack: ram swings back and strikes.
5. `bronze-support` **Baggage Train**: a donkey or ox with packs, led by a porter carrying a load;
   Team cloth over the packs. Idle/Walk only matter; Attack can reuse Idle (support doesn't fight).

**Classical Age (800 BCE to 500 CE)**: iron, bronze breastplates, crested helmets, big shields.
6. `classical-infantry` **Swordsmen**: crested helmet with a Team crest or plume, cuirass or
   banded armour over a Team tunic, large rectangular curved shield (Emblem face) or large round
   shield, short sword. Attack: shield push then short thrust/stab. **This is the pilot unit.**
7. `classical-cavalry` **Heavy Cavalry**: armoured rider (scale or mail, Team cloak and saddle
   cloth), helmet with plume, long lance or spear, on a sturdy horse with a Team saddle cloth.
   Attack: couched-lance strike / overhand spear thrust at the gallop.
8. `classical-ranged` **Composite Archers**: Team tunic, light helmet or cap, a short recurved
   composite bow (strongly reflexed tips, very readable silhouette), quiver at the hip.
   Attack: fast draw, release, nock.
9. `classical-siege` **Ballista**: a large two-armed bolt thrower on a wheeled wooden stand, torsion
   springs, a Team-painted frame, 1 crew figure turning the winch. Attack: winch back, release,
   the arms snap forward, recoil.
10. `classical-support` **Engineers**: tunic with Team sash, carrying a shovel or pick and a coil of
    rope or a wicker basket of earth; a small tool satchel. Attack = working animation (digging).

**Age of Kingdoms (500 to 1500)**: mail, surcoats, kite and heater shields, heraldic colour.
11. `kingdoms-infantry` **Pikemen**: padded gambeson with a Team surcoat or tabard, kettle hat or
    sallet, a very long pike (2.5x body height, the defining silhouette), small buckler at the
    belt. Attack: two-handed pike thrust, braced stance.
12. `kingdoms-cavalry` **Knights**: full mail or early plate, great helm or bascinet with a Team
    plume, Team surcoat, heater shield (Emblem face), lance; horse in a Team caparison (cloth
    covering). The most impressive silhouette of the age. Attack: lance charge then sword swing.
13. `kingdoms-ranged` **Longbowmen**: Team tabard over a padded jack, simple cap or hood, a bow as
    tall as the archer, arrows stuck in the ground or a quiver. Attack: full draw to the ear,
    release with an upward angle.
14. `kingdoms-siege` **Trebuchet**: counterweight trebuchet on a wooden frame with a Team banner on
    top, the long throwing arm and sling, 2 crew. About 2.2 m tall. Attack: arm swings over, sling
    releases, counterweight drops and swings, reset. Budget up to 3,000.
15. `kingdoms-support` **Pioneers**: hooded worker in a Team tunic carrying an axe and a bundle of
    stakes or a wooden mantlet; digging/hammering work cycle.

**Age of Gunpowder (1500 to 1900)**: tricorns, coats, crossbelts, muskets and bayonets.
16. `gunpowder-infantry` **Musketeers**: long coat in Team colour with neutral facings, crossbelts,
    tricorn or bicorne hat, musket with a fixed bayonet. Attack: shoulder, aim, fire (muzzle
    flash pose with smoke puff as a separate plane), recoil, bring to the hip.
17. `gunpowder-cavalry` **Dragoons**: Team coat, crested or brimmed hat, sabre and carbine, on a
    horse with a Team saddle cloth. Attack: sabre slash from the saddle.
18. `gunpowder-ranged` **Riflemen**: skirmisher in a short jacket in Team colour, soft cap or
    shako, long rifle, kneeling-fire stance distinct from the musketeers. Attack: kneel, aim,
    fire, reload with the ramrod.
19. `gunpowder-siege` **Field Cannon**: a bronze or iron gun barrel on a two-wheeled carriage with
    a trail, Team-painted carriage and wheels' hubs, 2 crew (one with a rammer). Attack: fire,
    the cannon recoils back, crew sponge and reload.
20. `gunpowder-support` **Sappers**: leather apron, Team coat or sash, a shovel and a gabion
    (wicker basket) or a powder keg; digging work cycle.

**Modern Age (1900 to 2300)**: helmets, fatigues, vehicles; stylised and non-gory.
21. `modern-infantry` **Mechanized Infantry**: helmet with a Team helmet band or cover, Team
    shoulder patches and chest rig panels on neutral fatigues, assault rifle, backpack.
    Attack: shoulder the rifle, burst fire with recoil.
22. `modern-cavalry` **Tanks**: a main battle tank, stylised chunky (big turret, short wide hull,
    clear tracks), Team panels on the turret sides and hull top, `turret` and `barrel` separate
    named objects. Walk/Run: tracks move, slight body sway. Attack: turret aims, gun fires,
    barrel recoils. Death: jolt, tilt, open hatch. 4 per squad.
23. `modern-ranged` **ATGM Teams**: a two-person anti-tank team: one with a launcher tube on the
    shoulder or a tripod missile launcher, one spotter with binoculars; Team bands and patches.
    Attack: aim, launch (back-blast pose), reload.
24. `modern-siege` **Artillery**: a towed howitzer with a long barrel and split trail legs, Team
    panels on the gun shield, 2 crew. Attack: fire, big recoil, crew reload.
25. `modern-support` **Anti-Air Battery**: a truck or tracked chassis with a radar dish and twin
    anti-air guns or missile pods on a rotating mount (`turret`), Team panels. Attack: the turret
    tracks upwards and fires skywards.
26. `modern-air` **Fighter Jet**: a stylised jet fighter (swept wings, twin tails, chunky
    proportions), Team stripes on the wings and tail, flying pose. Animations: `Idle`/`Walk`/`Run`
    = flight with slight banking, `Attack` = missile release or gun burst, `Death` = smoking spiral.
    Rendered as seen from below the camera altitude: it flies above the battlefield.

### 4.2 World-map ships (5, lower priority, after all battlefield units)
Small map tokens, Team sails or hull stripes, `Idle` (bobbing) and `Walk` (sailing) only, up to
1,500 triangles, no sprite sheets needed.
27. `bronze-naval` **War Galley**: one bank of oars, square sail (Team), ram at the bow.
28. `classical-naval` **Trireme**: three banks of oars, eye painted on the bow, Team sail.
29. `kingdoms-naval` **Longship**: dragon prow, round shields along the side (Emblem), Team sail.
30. `gunpowder-naval` **Frigate**: three masts, gun ports, Team flag and hull stripe.
31. `modern-naval` **Destroyer**: grey hull, gun turret, mast, Team hull number band.

## 5. Production phases

1. **Setup.** Install Blender 4.0+ and connect to it (Blender MCP or background `blender -b
   --python`). Create the project folder layout of section 7. Write `validate_unit.py` and a
   sprite render script `render_sprites.py` first.
2. **Style bible** (section 2). **STOP for approval.**
3. **Pilot: `classical-infantry` only**, fully finished: concept, model, rig, all actions, validation
   report, GLB + JSON, sprite sheets + team masks + sprites.json, concept sheet. Report the
   tokens, time and number of revision rounds it took. **STOP for approval**: the developer will
   test it in the game on a phone and send back changes.
4. **Batch by age**, in this order: Classical (rest), Kingdoms, Gunpowder, Bronze, Modern. For each
   age deliver all of its units together, each with its validation report, then a lineup render
   of that age's units at the same scale. **STOP after each age** for a quick review.
5. **Support units, aircraft, then ships.**
6. **Final package** (section 7) with the complete log.

Keep every unit consistent with the approved pilot: same proportions, same lighting, same
camera, same palette logic. Reuse the base body mesh and rig across all human units and change
only equipment, clothing and silhouettes; reuse one horse across all cavalry.

## 6. Quality checklist (each unit, include the answers in the log)
- Readable as a silhouette at 40 px from the game camera? Distinct from the other units of its age?
- Team-colour area large and visible from above? No blue or orange elsewhere?
- Animations: clear anticipation and contact frame in `Attack`; `Walk` feet don't slide; `Death`
  ends flat and holds; `Idle` frame 1 neutral?
- Triangles within budget; validation script passes?
- Sprite sheets: feet on the same anchor in every frame, all 8 directions, matching team masks?

## 7. Folder layout to deliver (zip it)
```
terra-imperium-units/
  units/                         -> goes to src/assets/units/ in the repo
    classical-infantry.glb
    classical-infantry.json
    ...
  sprites/                       -> goes to src/assets/sprites/
    classical-infantry/
      classical-infantry_Idle.png, classical-infantry_Idle_team.png, ...
      classical-infantry.sprites.json
    ...
  concepts/
    style-bible.png, lineup-all.png, lineup-silhouettes.png
    classical-infantry_concept.png, ...
  blend/                         -> source .blend files, one per unit
  scripts/
    validate_unit.py, render_sprites.py
  reports/
    classical-infantry.validation.json, ...
  LOG.md
  LICENSE.md
```

## 8. Licensing
Everything must be original work created for this project, with no third-party models, textures,
or reference images copied into the assets. State in `LICENSE.md` that the assets are created for
Terra Imperium and may be used, modified and distributed by the developer commercially. Note any
tool whose terms add conditions.

## 9. The log (`LOG.md`)
For each unit: date, phases done, revision rounds, **input and output tokens used**, wall-clock
time, triangle count, validation result, open issues. A running total at the top. Report the
pilot's numbers at the pilot checkpoint, so the developer can estimate the cost of the rest.

---
*Developer note (for the human, not the artist): when files arrive, put `units/` into
`src/assets/units/` and `sprites/` into `src/assets/sprites/`, or just send them to Claude in the
repo session, which will wire them in, run the battle-lab screenshot check and report how they
look on a phone-sized screen.*
