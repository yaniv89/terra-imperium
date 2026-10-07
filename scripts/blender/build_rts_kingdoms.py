# scripts/blender/build_rts_kingdoms.py
# The Kingdoms battle buildings, src/assets/battle/rts/rts-kingdoms.glb (plans/ART-MODELS-PLAN.md
# section 5; src/assets/battle/rts/README.md): the 13 roles of a battle economy, each with a
# `<role>-damaged` sibling and its sockets, plus the four construction stages, in the Kingdoms town
# kit's look (ti_kingdoms.py: half-timbered lime houses on rubble footings under steep slate roofs,
# grey wall stone, stone arcades) so a battle's buildings match the medieval towns on the map.
# The layouts, sockets, damage and grounding are build_rts_classical.py's (and through it
# build_rts_bronze.py's): its Roman house is swapped for ti_kingdoms.town_house and its cypresses
# for broadleaf trees, and the Classical materials are renamed to the Kingdoms ones (`remat`).
# One atlas for the file, LOD0..LOD2 per object.
#   blender -b --factory-startup -P scripts/blender/build_rts_kingdoms.py -- [out_dir] [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_kingdoms as tk  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
from ti_town import G  # noqa: E402

# the Classical stuff in its medieval counterpart
MATS = {'ashlar': 'kg_wallstone', 'cream': 'lime', 'tile': 'slate', 'tile_dark': 'slate', 'marble': 'kg_stone',
        'mudwall': 'kg_wallstone', 'mudwall_bare': 'lime', 'roof': 'slate', 'pylon': 'kg_wallstone'}


def medieval_house(ms, rng, x, y, w, d, storeys=1, yaw=None, rise=0.15, awning_w=None, chimney=False, door=0.0,
                   balcony=False, jar_n=0, gable_front=False, h=None):
    """ti_classical.roman_house's call, answered by a half-timbered Kingdoms town house (its frame)."""
    return tk.town_house(ms, rng, x, y, w, d, yaw=yaw, storeys=storeys, roof='slate', gable_front=gable_front,
                         chimneys=1 if chimney or w > 0.6 else 0, awning_w=awning_w, barrels=min(2, jar_n))


def broadleaf(ms, x, y, h=None, r=None, lod=1):
    tk.tree(ms, x, y, h=0.42, r=0.13)


tc.roman_house = medieval_house
tc.cypress = broadleaf


def remat(layout):
    return rc.remat(layout, MATS)


STAGES = [(n, remat(fn)) for n, fn in rb.STAGES]
ROLES = [(n, remat(fn)) for n, fn in rc.ROLES]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-kingdoms')
    atlas = int(argv[1]) if len(argv) > 1 else 1024
    only = [a for a in os.environ.get('ONLY', '').split(',') if a]
    items = []
    for name, fn in ROLES:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
        items.append((name + '-damaged', rb.grounded(name + '-damaged', remat(rb.damaged(fn))), None))
    for name, fn in STAGES:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
    counts = tt.build_file('rts-kingdoms', items, out_dir, atlas=atlas, seed=3400, write=False)
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.type == 'EMPTY' and o.name in {n for n, _, _ in items}]
    for root in roots:
        for sname, (x, y, z) in rb.SOCKETS.get(root.name, {}).items():
            e = bpy.data.objects.new(sname, None)
            scene.collection.objects.link(e)
            e.empty_display_size = 0.05
            e.parent = root
            e.location = (x, y, max(0.0, z - (G if sname == 'socket-banner' else 0)))
            if sname == 'socket-door':
                e.rotation_euler = (0, 0, math.pi)
    exported = [o for o in scene.objects if o.type in ('MESH', 'EMPTY')]
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'rts-kingdoms.blend'))
    tm.export_glb(os.path.join(out_dir, 'rts-kingdoms.glb'), exported)
    import json
    with open(os.path.join(out_dir, 'report.json'), 'w') as fh:
        json.dump({'file': 'rts-kingdoms.glb', 'triangles': counts, 'sockets': rb.SOCKETS, 'atlas': atlas}, fh, indent=2)
    print('RTS_KINGDOMS_BUILT', len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
