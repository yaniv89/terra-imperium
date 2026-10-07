# Signature units: `<model>.glb`

Each of the 150 peoples has ONE signature unit in ONE age (user decision 2026-10-06; roster in
`plans/ART-MODELS-PLAN.md` 4.5). In that age it replaces that people's base unit of the same
role; in every other age the people fields the ordinary base units. The role may be any base role,
vehicles included (Israel: the Merkava tank, Modern, the mobile role, on the base Tank's rig).

The table is `src/data/signatureUnits.js`: `{ [peopleId]: { ageId, classId, model, rig, name } }`,
seeded from the roster. The file is named by `model`, the roster's id:
`src/assets/units/signature/<model>.glb` (for example `kingdom-of-israel.glb`, `mari.glb`,
`bosporan-kingdom.glb`), with an optional `<model>.json` beside it holding the base units' bake
options (`rotateY`, `restClip`, `tags`, `quadruped`, `"enabled": false` to switch it off).

- Model: exactly as a base unit (`src/assets/units/README.md`, `plans/unit-art-brief.md`): one
  figure (or mount, crew, vehicle), faces +Z, feet on y = 0; unit materials `Team`, `Skin`,
  `Emblem`, `Metal`, `Wood`, `Leather`, `Cloth`, flat colours, no textures; the shared skeleton's
  bone names (person, mount or vehicle rig). LOD0 only (the runtime builds its levels).
- Rig: the horse, camel, elephant, chariot and ox rigs bake with the four-legged trot; person,
  frame and tank without. The figure is baked as tall as the base unit it replaces.
- Budget: person 1,500 (hard 3,000), mounted 2,500 (hard 4,000), machine and vehicle 3,000
  (hard 5,000).
- Rules: the base unit's until the signature rules phase ("SU").
- Fallback: another age or role, no file, or `enabled: false`: the base unit.
- Check: `python3 scripts/blender/validate_model.py <file> <out> unit` (or `unit-mounted`,
  `unit-machine`), `npm run pack:models` (packed without quantization), `/?battleSandbox` with
  that people in that age.

## Delivered
The 34 Bronze signature units (2026-10-07, wave2 checkpoint 09,
`scripts/blender/build_units_bronze_signature.py`): 27 on foot (person rig, 1,026 to 1,318
triangles) and 7 chariots (Ugarit, Kemet, Garamantes, Oxus, Andronovo, Kuru on the light chariot,
Zhou on the heavy chariot; 2,266 to 3,765 triangles), each with its `<model>.json`. Rigs:
`scripts/blender/ti_mounts.py` (horse, ox, light and heavy chariot). Check in battle:
`?battleSandbox&age=bronze&people=keftiu&enemy=kemet`.
