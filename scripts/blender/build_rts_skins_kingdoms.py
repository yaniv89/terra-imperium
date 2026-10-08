# scripts/blender/build_rts_skins_kingdoms.py
# Per-theme Kingdoms battle buildings (build_rts_skins_classical.py for the Kingdoms age: the same roles,
# props and damage, the Kingdoms house kits) (plans/ART-MODELS-PLAN.md section 5, "Culture skins"): the
# barracks, the tower and the trade post in a theme's own architecture, each with its `-damaged`
# sibling and the sockets of rts-kingdoms.glb, into src/assets/battle/rts/rts-kingdoms-<theme>.glb
# (artIndex.rtsSkin). In battle the town hall is the keep (civic-kingdoms.glb).
# Original procedural geometry: the theme's delivered house kit (art-build/kitsrc, the same houses
# its towns are built from; procedural kits for europe, indic, levant and sinic) fitted into each role, with
# the role's props from build_rts_bronze.py (spear racks, stalls, the balance, flags) and a body in
# the theme's building stuff (mud brick, stone or timber).
#   blender -b -t 8 -P scripts/blender/build_rts_skins_kingdoms.py -- OUT THEME [atlas_px]
# Scale 1 unit = 10 m, front to -Y, origin at the footprint centre on Z = 0, no ground plate.
import inspect
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402,F401
from mathutils import Matrix, Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import build_houses_damage_bronze as hd  # noqa: E402
import build_houses_damage_classical as hc  # noqa: E402
import build_houses_damage_kingdoms as hk  # noqa: E402
import ti_kingdoms as tk  # noqa: E402,F401 (kg_wallstone, kg_stone)
import ti_classical as tc  # noqa: E402,F401 (ashlar, tile, marble)
import build_rts_bronze as rb  # noqa: E402
from ti_town import G  # noqa: E402

THEMES = ('americas', 'eastafrica', 'europe', 'indic', 'israelite', 'levant', 'maghreb', 'monsoon', 'nile', 'sinic', 'steppe', 'westafrica')
argv = sys.argv[sys.argv.index('--') + 1:]
OUT = os.path.abspath(argv[0])
THEME = argv[1]
ATLAS = int(argv[2]) if len(argv) > 2 else 1024
assert THEME in THEMES, THEME

# Convex packing (the civic builds' speed-up) and a GPU bake when there is one.
exec(inspect.getsource(tm.smart_uv).replace('CONCAVE', 'CONVEX'), tm.__dict__)
exec(inspect.getsource(tm.bake_atlas).replace("scene.cycles.device = 'CPU'", "scene.cycles.device = 'GPU'\n    prefs = bpy.context.preferences.addons['cycles'].preferences\n    prefs.compute_device_type = 'OPTIX'\n    prefs.get_devices()\n    for device in prefs.devices: device.use = device.type == 'OPTIX'\n    scene.render.threads_mode = 'FIXED'\n    scene.render.threads = 8"), tm.__dict__)

STATE = {}
AK = None
if THEME in hc.KIT_THEMES:
    HOUSE, _ruins, AK = hk.kit_layouts(THEME, os.path.abspath(os.path.join('art-build', 'kitsrc', 'plans', 'art', 'kits')), STATE)
else:
    __import__('ti_%s_kingdoms' % THEME)  # registers the kit's materials
    HOUSE = {k: hk.procedural_house(THEME, k) for k in ('poor', 'common', 'rich')}

# The theme's building stuff for the parts that are not houses (the tower's body, the court walls).
WALL = {'europe': 'kg_wallstone', 'levant': 'lvk_ashlar', 'maghreb': 'ashlar', 'steppe': 'timber', 'monsoon': 'timber', 'sinic': 'snk_brick',
        'eastafrica': 'stone', 'westafrica': 'mud', 'americas': 'stone', 'israelite': 'stone', 'indic': 'ink_sandstone'}.get(THEME, 'mudwall_bare')
STILTS = WALL == 'timber'  # a timber land's tower stands on posts


def fitted(ms, kind, at, dims):
    """The theme's `kind` house (poor, common, rich) fitted into the box `dims` at `at` (its foot)."""
    part = tm.Mesher()
    if AK:
        p = STATE['parts']['house-' + kind]
        for lod, store in ((0, p.lod0), (1, p.lod1), (2, p.lod2)):
            for role, bm in store.items():
                part.add(bm.copy(), 'nl_houses_%s' % (role if role in ('town', 'team') else 'town'), lod=2, only=(lod,))
    else:
        HOUSE[kind](part, random.Random(7331))
    w, d, h = hd.normalise(part)
    matrix = Matrix.Translation(Vector(at)) @ Matrix.Diagonal(Vector((dims[0] / w, dims[1] / d, dims[2] / h, 1)))
    for bm, mat, lod, only in part.parts:
        ms.add(bm, mat, lod, matrix, only)


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


def budgeted(layout):
    def build(ms, rng):
        sockets = layout(ms, rng)
        for lod, budget in ((0, 7600), (1, 1900), (2, 380)):
            trim(ms, lod, budget)
        return sockets
    return build


# ---- the roles ----------------------------------------------------------------------------------

def barracks(ms, rng):
    """16 x 12 m: two of the theme's houses joined as a long hall under one team awning, spear racks
    and drill posts in front."""
    fitted(ms, 'common', (-0.37, 0.24, G), (0.72, 0.6, 0.5))
    fitted(ms, 'common', (0.37, 0.24, G), (0.72, 0.6, 0.5))
    ms.box('team_cloth', (0.9, 0.22, 0.014), at=(0, -0.17, G + 0.3), lod=1)
    for x in (-0.42, 0.42):
        ms.cyl('timber', 0.012, 0.012, 0.3, at=(x, -0.27, G), segs=6, lod=1)
    rb.spear_rack(ms, -0.55, -0.42)
    rb.spear_rack(ms, 0.55, -0.42)
    for k in range(3):
        ms.cyl('timber', 0.022, 0.02, 0.2, at=(-0.2 + 0.2 * k, -0.5, G), segs=6, lod=1)
    top = rb.flag_pole(ms, 0.76, -0.5, 0.75)
    return {'socket-door': (0, -0.08, 0), 'socket-rally': (0, -0.9, 0), 'socket-banner': top,
            'socket-fire-1': (-0.4, 0.24, 0.45), 'socket-fire-2': (0.1, 0.24, 0.45), 'socket-fire-3': (0.45, 0.24, 0.45), 'socket-fire-4': (-0.5, -0.4, 0.1), 'socket-smoke-1': (0, 0.24, 0.55)}


def tower(ms, rng):
    """8 x 8 m, 14 m: a look-out in the theme's own house form on a body of its building stuff
    (battered mud brick or stone with merlons; timber posts and braces in timber lands)."""
    body = 0.86
    if STILTS:
        for x in (-0.24, 0.24):
            for y in (-0.24, 0.24):
                ms.cyl('timber', 0.03, 0.026, body, at=(x, y, G), segs=7, lod=2)
        for z0, z1 in ((0.12, 0.5), (0.5, 0.84)):
            for (x0, y0, x1, y1) in ((-0.24, -0.24, 0.24, -0.24), (0.24, 0.24, -0.24, 0.24), (-0.24, 0.24, -0.24, -0.24), (0.24, -0.24, 0.24, 0.24)):
                rb.beam(ms, 'timber', (x0, y0, G + z0), (x1, y1, G + z1), r=0.011, lod=1)
        ms.box('timber', (0.62, 0.62, 0.04), at=(0, 0, G + body - 0.04), lod=2)
        for k in range(6):  # a ladder up the front
            ms.box('timber', (0.12, 0.012, 0.012), at=(0, -0.3, G + 0.1 + k * 0.13), lod=0)
        for x in (-0.06, 0.06):
            ms.box('timber', (0.012, 0.012, body), at=(x, -0.3, G), lod=1)
    else:
        ms.box(WALL, (0.56, 0.56, body), at=(0, 0, G), lod=2, bevel=0.006, taper=0.86)
        ms.box(WALL, (0.6, 0.6, 0.05), at=(0, 0, G + body - 0.05), lod=2)
        for x in (-0.24, 0.0, 0.24):  # merlons on the parapet's front and back
            for y in (-0.27, 0.27):
                ms.box(WALL, (0.08, 0.05, 0.07), at=(x, y, G + body), lod=0)
        for z in (0.35, 0.6):  # arrow slits
            ms.box('ash', (0.03, 0.012, 0.09), at=(0, -0.26 + (z - 0.35) * 0.04, G + z), lod=0)
        ms.box('timber', (0.12, 0.02, 0.2), at=(0, -0.29, G), lod=1)  # the door
    fitted(ms, 'poor', (0, 0.02, G + body), (0.44, 0.44, 0.4))
    top = rb.flag_pole(ms, 0.24, 0.24, body + 0.62, w=0.16, fh=0.1)
    return {'socket-door': (0, -0.32, 0), 'socket-rally': (0, -0.65, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0, body + 0.25), 'socket-fire-2': (-0.15, -0.2, 0.55), 'socket-fire-3': (0.15, 0.2, 0.8), 'socket-fire-4': (0, -0.24, 0.3), 'socket-smoke-1': (0, 0, body + 0.45)}


def trade_post(ms, rng):
    """14 x 14 m: the theme's rich house as the storehouse behind three stalls with team awnings
    round a balance scale, jars and baskets."""
    fitted(ms, 'rich', (0, 0.4, G), (0.86, 0.46, 0.52))
    for x, y in [(-0.46, -0.12), (0.46, -0.12), (-0.3, -0.52)]:
        tb.stall(ms, x, y, rng)
    f = tm.house_frame(0.15, -0.35, 0)  # the balance: a post, a beam, two pans
    ms.box('timber', (0.016, 0.016, 0.16), at=(0, 0, G), lod=1, frame=f)
    ms.box('timber', (0.2, 0.012, 0.012), at=(0, 0, G + 0.16), lod=0, frame=f)
    for sx in (-0.09, 0.09):
        ms.cyl('bronze', 0.03, 0.035, 0.012, at=(sx, 0, G + 0.09), segs=8, lod=0, frame=f)
    tt.clutter(ms, rb.WORLD, 0.45, -0.52, rng, 4)
    top = rb.flag_pole(ms, -0.62, 0.45, 0.66)
    return {'socket-door': (0, -0.68, 0), 'socket-rally': (0, -1.0, 0), 'socket-drop': (0.15, -0.55, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.4, 0.45), 'socket-fire-2': (-0.46, -0.12, 0.25), 'socket-fire-3': (0.46, -0.12, 0.25), 'socket-fire-4': (-0.3, -0.52, 0.25), 'socket-smoke-1': (0, 0.4, 0.5)}


def damaged(layout):
    """rb.damaged (cloth and upper works fallen, rubble of its own stuff, scorch, beams) plus a cut
    through the upper back corner, so the theme's house shows a broken roof."""
    inner = rb.damaged(layout)

    def build(ms, rng):
        sockets = inner(ms, rng)
        top = max((v.co.z for bm, _m, _l, _o in ms.parts for v in bm.verts), default=0.5)
        hd.cut(ms, Vector((0.22, 0.3, max(0.25, top * 0.62))), Vector((0.55, 0.25, 1)), fill=False)
        return sockets
    return build


ROLES = [('barracks', barracks), ('tower', tower), ('trade-post', trade_post)]


def main():
    name = 'rts-kingdoms-' + THEME
    items = []
    for role, fn in ROLES:
        items.append((role, rb.grounded(role, budgeted(fn)), None))
        items.append((role + '-damaged', rb.grounded(role + '-damaged', budgeted(damaged(fn))), None))
    counts = tt.build_file(name, items, OUT, atlas=ATLAS, seed=3400 + THEMES.index(THEME), write=False)
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.type == 'EMPTY' and o.parent is None and o.name in {n for n, _, _ in items}]
    for root in roots:
        for sname, (x, y, z) in rb.SOCKETS.get(root.name, {}).items():
            e = bpy.data.objects.new(sname, None)
            scene.collection.objects.link(e)
            e.empty_display_size = 0.05
            e.parent = root
            e.location = (x, y, max(0.0, z - (G if sname == 'socket-banner' else 0)))
            if sname == 'socket-door':
                e.rotation_euler = (0, 0, 3.141592653589793)
    os.makedirs(OUT, exist_ok=True)
    if AK:
        AK.finish(OUT, name)
    else:
        exported = roots + [c for r in roots for c in r.children]
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, name + '.blend'))
        tm.export_glb(os.path.join(OUT, name + '.glb'), exported)
    with open(os.path.join(OUT, name + '.report.json'), 'w') as fh:
        json.dump({'file': name + '.glb', 'theme': THEME, 'atlas': ATLAS, 'triangles': counts, 'sockets': rb.SOCKETS,
                   'license': 'original procedural geometry; the project\'s own Classical house kits'}, fh, indent=2)
    print('RTS_SKIN_BUILT', name, len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)


main()
