# scripts/blender/build_improvement_fort_classical.py
# The map's Classical fort, src/assets/map/improvements/fort-classical.glb (the tile improvement
# `fort` from the Classical Age on; improvementModels.js): the battle's Classical castellum
# (build_city_classical.py fort: an ashlar ring with four corner towers and a gatehouse, a barrack
# block, a granary, a watch tower, tents, a well and the standard) on its own round earth Ground
# patch in the 50 m circle, as the delivered improvements stand. One root `fort-classical`, LOD0..LOD2,
# materials Town, Team and Ground, one 1024 atlas.
#   blender -b --factory-startup -P scripts/blender/build_improvement_fort_classical.py -- <out_dir>
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_town as tt  # noqa: E402
import inspect  # noqa: E402
import build_city_classical as bcc  # noqa: E402

GROUND = dict(rx=2.42, ry=2.42, square=None, mat='earth', n=40)
# the battle fort with a lighter wall ring (fewer segments) for the map's budget (8,000 / 1,500 / 300)
_src = inspect.getsource(bcc.fort).replace('n=(72, 36, 24)', 'n=(40, 20, 10)').replace('def fort(', 'def fort_map(')
exec(compile(_src, '<fort_map>', 'exec'), bcc.__dict__)
fort_map = bcc.fort_map


# build_rts_skins_bronze.py's budget trim (that module builds on import): decimate a level's parts
# when the object is over its budget at that level
import bpy  # noqa: E402
import bmesh  # noqa: E402


def levels(p):
    bm, mat, lod, only = p
    if isinstance(only, int):  # some kits give a single level
        only = (only,)
    return tuple(i for i in (0, 1, 2) if (only is None and i <= lod) or (only is not None and i in only))


def trim(ms, lod, budget):
    """Decimate the parts shown at `lod` when the object is over its budget (the civic builds' rule)."""
    shown = [p for p in ms.parts if lod in levels(p)]
    total = sum(sum(max(0, len(f.verts) - 2) for f in p[0].faces) for p in shown)
    if total <= budget:
        return
    ratio = (budget - 20) / total
    rest = []
    for p in ms.parts:
        bm, mat, maxlod, _only = p
        lv = levels(p)
        if lod not in lv:
            rest.append(p)
            continue
        others = tuple(i for i in lv if i != lod)
        if others:
            rest.append((bm.copy(), mat, maxlod, others))
        me = bpy.data.meshes.new('_trim'); bm.to_mesh(me)
        ob = bpy.data.objects.new('_trim', me); bpy.context.collection.objects.link(ob)
        mod = ob.modifiers.new('budget', 'DECIMATE'); mod.ratio = max(0.02, ratio)
        ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get())
        reduced = bmesh.new(); reduced.from_mesh(ev.to_mesh()); ev.to_mesh_clear()
        rest.append((reduced, mat, maxlod, (lod,)))
        bpy.data.objects.remove(ob, do_unlink=True); bpy.data.meshes.remove(me); bm.free()
    ms.parts[:] = rest


def fort_budgeted(ms, rng):
    fort_map(ms, rng)
    for lod, budget in ((0, 7400), (1, 1300), (2, 180)):
        trim(ms, lod, budget)

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    tt.build_file('fort-classical', [('fort-classical', fort_budgeted, GROUND)], out, atlas=1024, seed=6420)
    print('FORT_BUILT', flush=True)
    sys.stdout.flush()
    os._exit(0)
