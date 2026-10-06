# Projectiles: `<age>.glb`

One file per age (`bronze.glb` ... `modern.glb`), read by `src/battle/art/projectiles.js`. Spec:
`plans/ART-MODELS-PLAN.md` 8.3.

## Objects
`arrow`, `javelin`, `sling-stone`, `bolt` (ballista), `stone` (trebuchet), `cannonball`, `shell`,
`missile`. One level (no LOD children needed), under 60 triangles each, flat colours (`Town`
material, no texture needed).

## Scale and orientation
1 Blender unit = 10 m, the point toward Blender -Y (glTF +Z, its front), origin at its middle.
Drawn at twice true size (it reads at the battle camera) along the shot's arc, nose following it.

## Who throws what
Ranged: arrows (Bronze to Kingdoms), missiles (Modern); Bronze and Classical infantry javelins;
Bronze cavalry arrows, Classical cavalry javelins; siege: bolt (Classical), stone (Kingdoms),
cannonball (Gunpowder), shell (Modern); Modern support missiles; towers arrows, Gunpowder towers
cannonballs. Muskets and rifles keep the tracer streak.

## Fallback
The shooter's age file, else the nearest earlier age's; an object missing from the file keeps the
tracer. Check: `validate_model.py <file> <out> auto` (kind `projectile`), `npm run pack:models`.
