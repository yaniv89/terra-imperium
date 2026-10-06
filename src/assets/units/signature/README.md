# Signature units: `<peopleId>.glb`

Each people has ONE signature unit in ONE age (user decision 2026-10-06). It replaces that
people's base unit of the same role in that age. The table that says which age and role is
`src/data/signatureUnits.js` (`{ [peopleId]: { ageId, classId, name } }`, empty until the roster
is confirmed); people ids are those of `src/data/peoples.js`.

- File: `src/assets/units/signature/<peopleId>.glb` (for example `israel.glb`), optional
  `<peopleId>.json` beside it with the base units' bake options (`rotateY`, `restClip`, `tags`,
  `"enabled": false` to switch it off).
- Model: exactly as a base unit (`src/assets/units/README.md`, `plans/unit-art-brief.md`): one
  standing figure (or mount, crew, vehicle), faces +Z, feet on y = 0; unit materials `Team`,
  `Skin`, `Emblem`, `Metal`, `Wood`, `Leather`, `Cloth`, flat colours, no textures; the standard
  skeleton bone names. LOD0 only (the runtime builds its levels).
- Budget: person 1,500 (hard 3,000), mounted 2,500 (hard 4,000), machine 3,000 (hard 5,000).
- Rules: the base unit's (the signature rules are a later design phase).
- Fallback: no table entry, a different age or role, or no file: the base unit.
- Check: `validate_model.py <file> <out> auto` (kind `unit`), `npm run pack:models` (packed
  without quantization), `/?battleSandbox` with that people.
