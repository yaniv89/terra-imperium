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

## Delivered
2026-10-07 (wave1 checkpoint-02, `scripts/blender/build_projectiles_bronze.py`): `bronze.glb` with
`arrow`, `javelin`, `sling-stone`; later ages fall back to it for arrows and javelins.

## Files
- `bronze.glb`: arrow, javelin, sling-stone (`scripts/blender/build_projectiles_bronze.py`).
- `classical.glb` (2026-10-08): arrow (iron head), javelin (a pilum with its long iron shank),
  sling-stone (a lead bullet), bolt (the ballista's, three wooden vanes), stone (a stone-thrower's
  round shot) (`scripts/blender/build_projectiles_classical.py`).
- `kingdoms.glb` (2026-10-08): arrow (a longbow shaft with a bodkin), javelin (a leaf-headed throwing
  spear), sling-stone (a pebble), bolt (a crossbow quarrel, two vanes), stone (the trebuchet's ball)
  (`scripts/blender/build_projectiles_kingdoms.py`).
- `gunpowder.glb` (2026-10-08): cannonball (cast iron round shot, for field guns, the lantaka and the
  bastion towers) and the Kingdoms arrow, javelin, sling-stone, bolt and stone for the age's signature
  archers and slingers (`scripts/blender/build_projectiles_gunpowder.py`).
