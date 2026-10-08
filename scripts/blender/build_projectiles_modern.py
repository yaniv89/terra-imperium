# scripts/blender/build_projectiles_modern.py
# The Modern projectiles, src/assets/battle/projectiles/modern.glb (plans/ART-MODELS-PLAN.md 8.3;
# src/assets/battle/projectiles/README.md; projectiles.js): `shell` (a 155 mm high-explosive shell, about
# 70 cm, ogive nose and a copper driving band, for the howitzers), `missile` (a guided anti-tank missile,
# about 1.2 m, four mid fins and four tail fins, for the ATGM teams and the AA batteries) and the Gunpowder
# `cannonball` for any older gun on the field. Rifles and machine guns keep the tracer streak. Under 60
# triangles each, origin at the middle, true size, the nose to -Y (glTF +Z). One small atlas, one level.
#   blender -b --factory-startup -P scripts/blender/build_projectiles_modern.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_modern  # noqa: E402,F401 (registers the md_ materials)
import ti_modern_battle  # noqa: E402,F401 (md_olive, md_tarmac_line)
import build_projectiles_kingdoms as pk  # noqa: E402
import build_projectiles_gunpowder as pg  # noqa: E402


def shell(ms, rng):
    L, r = 0.07, 0.0078
    tn.limb(ms, 'md_olive', (0, L / 2, 0), (0, -L / 2 + 0.024, 0), r, r, segs=6, lod=2, caps=True)
    tn.limb(ms, 'bronze', (0, L / 2 - 0.012, 0), (0, L / 2 - 0.016, 0), r * 1.08, r * 1.08, segs=6, lod=2, caps=False)
    tn.limb(ms, 'md_olive', (0, -L / 2 + 0.024, 0), (0, -L / 2 + 0.004, 0), r, r * 0.35, segs=6, lod=2, caps=False)
    tn.limb(ms, 'md_tarmac_line', (0, -L / 2 + 0.004, 0), (0, -L / 2, 0), r * 0.35, 0.0, segs=6, lod=2)


def missile(ms, rng):
    L, r = 0.12, 0.0065
    tn.limb(ms, 'md_olive', (0, L / 2, 0), (0, -L / 2 + 0.012, 0), r, r, segs=4, lod=2, caps=True)
    tn.limb(ms, 'md_olive', (0, -L / 2 + 0.012, 0), (0, -L / 2, 0), r, r * 0.5, segs=4, lod=2)
    for p in ((0.012, 0), (0, 0.012), (-0.012, 0), (0, -0.012)):
        pk.fin(ms, 'md_steel', [(0, L / 2 - 0.004, 0), (p[0], L / 2 - 0.008, p[1]), (p[0], L / 2 - 0.02, p[1]), (0, L / 2 - 0.024, 0)])
    for p in ((0.009, 0.009), (-0.009, 0.009)):
        pk.fin(ms, 'md_steel', [(-p[0], -0.005, -p[1]), (p[0], -0.005, p[1]), (p[0], 0.015, p[1]), (-p[0], 0.015, -p[1])])


ITEMS = [('shell', shell, None), ('missile', missile, None), ('cannonball', pg.cannonball, None)]

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out = os.path.abspath(argv[0]) if argv else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'art-build', 'projectiles')
    tt.build_file('modern', ITEMS, out, atlas=256, seed=6600)
    sys.stdout.flush()
    os._exit(0)
