# Battle effects: `<id>/` sprite sheets

Read by `src/battle/art/fxSheets.js`, the map sprites' format (`src/assets/map/sprites/`): frames
`<id>-0.png`, `<id>-1.png`, ... and `sheet.json`:

```json
{ "frame": [128, 128], "frames": 12, "fps": 12, "blend": "additive", "size": 1.5, "loop": false }
```
`blend` is `additive` (fire, flashes, sparks) or `alpha` (smoke, dust, debris); `size` is how many
battle tiles across the sprite is drawn. Frames 64 to 256 px, 8 to 16 frames, no gore. (`map/`
holds the map's own effects and is not read here.)

| Id | Used for (replacing) |
|---|---|
| `impact-sparks` | melee blows (the code sparks) |
| `explosion` | artillery and bomb impacts (the fire sparks) |
| `smoke` | after explosions, burning machines and destroyed squads (new) |
| `fire-small` | a machine or vehicle destroyed (the fire sparks) |
| `fire-large` | buildings and city structures under 30% HP, looping (new) |
| `debris` | a squad or a structure destroyed (the grey sparks) |
| `muzzle-flash` | Gunpowder and Modern shots (new) |
| `dust` | cavalry contact (new) |

Each sheet is one instanced camera-facing mesh (up to 128 at once); effects count against the
battle's effects cap (`BATTLE_GRAPHICS.effects`). A missing sheet keeps the code effects.
