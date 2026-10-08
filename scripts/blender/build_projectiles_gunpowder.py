# scripts/blender/build_projectiles_gunpowder.py
# The Gunpowder projectiles, src/assets/battle/projectiles/gunpowder.glb (plans/ART-MODELS-PLAN.md 8.3;
# src/assets/battle/projectiles/README.md): `cannonball` (a cast iron round shot, about 12 cm, for the
# field guns, the lantaka and the bastion towers) and, for the signature archers, slingers and
# javelin men of the age, the Kingdoms `arrow`, `javelin`, `sling-stone`, `bolt` and `stone`
# (build_projectiles_kingdoms.py's shapes). Muskets and rifles keep the tracer streak (projectiles.js).
# Under 60 triangles each, origin at the middle, true size. One small atlas, one level.
#   blender -b --factory-startup -P scripts/blender/build_projectiles_gunpowder.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import build_projectiles_kingdoms as pk  # noqa: E402


def cannonball(ms, rng):
    tn.blob(ms, 'dark', (0, 0, 0), 0.006, (1.0, 1.0, 1.0), rng, 0.0, 1, lod=2)


ITEMS = [('arrow', pk.arrow, None), ('javelin', pk.javelin, None), ('sling-stone', pk.sling_stone, None),
         ('bolt', pk.bolt, None), ('stone', pk.stone, None), ('cannonball', cannonball, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('gunpowder', ITEMS, out, atlas=256, seed=6400)
    sys.stdout.flush()
    os._exit(0)
