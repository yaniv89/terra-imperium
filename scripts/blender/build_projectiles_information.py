# scripts/blender/build_projectiles_information.py
# The Information projectiles, src/assets/battle/projectiles/information.glb (eight-ages plan U91): `shell` (an
# artillery shell: a grey body with a copper band and a pointed fuse), `missile` (a guided missile: a white body, a
# dark seeker nose, four fins, an exhaust glow) and `rocket` (a launcher rocket: a long olive tube, a cone, a flame).
# Under 60 triangles each, the point toward Blender -Y, origin at the middle, true size; one small atlas, LOD1 and
# LOD2 repeat LOD0.
#   blender -b --factory-startup -P scripts/blender/build_projectiles_information.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_information_kit as ik  # noqa: E402,F401 (in_ materials)
from build_projectiles_bronze import fin  # noqa: E402


def shell(ms, rng):
    tn.limb(ms, 'in_graphite', (0, 0.014, 0), (0, -0.01, 0), 0.006, 0.006, segs=6, lod=2)
    tn.limb(ms, 'in_ochre', (0, 0.016, 0), (0, 0.014, 0), 0.0062, 0.0062, segs=6, lod=2, caps=False)
    tn.limb(ms, 'in_graphite', (0, -0.01, 0), (0, -0.022, 0), 0.006, 0.0, segs=6, lod=2)


def missile(ms, rng):
    L = 0.10
    tn.limb(ms, 'in_panel', (0, L / 2, 0), (0, -L / 2 + 0.012, 0), 0.0035, 0.0035, segs=5, lod=2, caps=False)
    tn.limb(ms, 'in_graphite', (0, -L / 2 + 0.012, 0), (0, -L / 2, 0), 0.0035, 0.0, segs=5, lod=2)
    tn.limb(ms, 'in_glow', (0, L / 2 + 0.012, 0), (0, L / 2, 0), 0.0, 0.003, segs=5, lod=2)
    for p in ((0.006, 0), (0, 0.006)):
        fin(ms, 'in_graphite', [(0, L / 2, 0), (p[0], L / 2 - 0.004, p[1]), (p[0], L / 2 - 0.014, p[1]), (0, L / 2 - 0.018, 0)])


def rocket(ms, rng):
    L = 0.14
    tn.limb(ms, 'in_graphite', (0, L / 2, 0), (0, -L / 2 + 0.015, 0), 0.004, 0.004, segs=5, lod=2, caps=False)
    tn.limb(ms, 'in_panel', (0, -L / 2 + 0.015, 0), (0, -L / 2, 0), 0.004, 0.0, segs=5, lod=2)
    tn.limb(ms, 'in_glow', (0, L / 2 + 0.02, 0), (0, L / 2, 0), 0.0, 0.0035, segs=5, lod=2)


ITEMS = [('shell', shell, None), ('missile', missile, None), ('rocket', rocket, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('information', ITEMS, out, atlas=256, seed=6700)
    sys.stdout.flush()
    os._exit(0)
