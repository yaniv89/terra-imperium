# Wave 2 checkpoint 09: the 34 Bronze signature units and the mount rigs

2026-10-07, branch `claude/bronze-towns` (Claude, Blender 5.2 headless). Status
`in_game_awaiting_review` (38 new queue items: `units/signature/<model>` x 34, `units/rigs/<rig>` x 4).
[Manifest](manifest.json), [checksums](SHA256SUMS.txt), [in-game contact sheet](contact.png)
(844x390 battle sandbox: Keftiu spearmen, Kemet chariot archers, Zhou chariot lords),
[Blender proofs of all 34](../../../shots/wave2/signature-bronze-proofs.png).

## Delivered
- `src/assets/units/signature/<model>.glb` + `<model>.json` for every Bronze people of the roster
  (plans/ART-MODELS-PLAN.md 4.5): mari, akkad, elam, kanesh, phrygia, urartu, colchis, magan,
  dilmun, kerma, libu, keftiu, ahhiyawa, tartessos, cucuteni, botai, meluhha, saurashtra, shang, shu,
  gojoseon, van-lang, tichitt, punt, caral, lapita, wahgi (on foot, 1,026 to 1,318 triangles) and
  ugarit, kemet, garamantes, oxus, andronovo, kuru (light chariot) and zhou (heavy chariot)
  (2,266 to 3,765 triangles; three are over the 2,500 target, all under the hard 4,000).
  Packed 2.79 MB together.
- Rigs (track E): `scripts/blender/ti_mounts.py`: horse and ox (ti_units.quadruped), the light
  chariot (two or four horses, six-spoke or solid wheels, an optional bronze tyre) and the heavy
  chariot (four horses, eight spokes, a car for three); bare reference files in
  `art-build/units/rigs/` (outside Git, not shipped: each unit carries its rig).

Built by `scripts/blender/build_units_bronze_signature.py` from a part library (garments: kilt,
fringe, kaunakes, robe, trousers, cloaks; headgear: helmets with crests, cheek flaps or horns,
boar's tusk, Phrygian cap, feathers, headbands; weapons: spear, javelins, ge, axe, sharur, sword,
bows, crossbow, sling; shields: round, figure-eight, tower, crescent, oxhide, rectangular, the face
the squad's Emblem). Original procedural geometry; flat unit materials, no textures.

## Wired
Already in the game: `unitModels.js findSignatureModel` draws a people's file for its age and
role (the base unit elsewhere). Verified in the sandbox with `&people=keftiu&enemy=kemet` and
`&people=zhou&enemy=elam` (layers `infantry~keftiu` 1,284, `cavalry~kemet` 2,364,
`cavalry~zhou` triangles, the GLBs; no console errors).

## Checks
`validate_model.py` (unit, unit-mounted) passes all 34; lint clean; render and pack tests pass.
