# scripts/blender/build_houses_damage_bronze.py
# Damaged and ruined Bronze houses for the battle and the map's close view (plans/ART-MODELS-PLAN.md
# section 6; src/assets/battle/city/README.md; read by src/battle/art/cityArt.js): for one theme,
# `house-poor`, `house-common` and `house-rich` of that theme's Bronze town kit, each as
#   <house>-damaged  (30 to 70% HP) a top corner broken off and capped, a burnt hole in the roof,
#                    charred beams, cracks, a heap of its own wall material in the gap
#   <house>-ruined   (down) the walls cut to 1.4 to 3 m on a slanting line, the roof gone, the
#                    inside filled with rubble, charred beams and loose bricks or stones
# Same origin, footprint and look as the intact house (the footprint stays inside it), so the game
# can fit a piece to a house's ground in the town layout.
#   base, europe, indic, sinic: the houses come from the procedural kits (ti_town.house,
#     ti_europe_bronze, ti_indic_bronze, ti_sinic_bronze), as the towns are built;
#   americas, levant, steppe, monsoon, eastafrica, maghreb, nile, westafrica, israelite: the kit's
#     delivered plans/art/kits/<theme>/bronze/houses/model.glb (house-poor, -common, -rich), loaded
#     like assemble_kit_towns.py does (its textures bake through Cycles into the file's atlas).
# Output <out_dir>/bronze[-<theme>]-houses-damage.glb, one atlas, LOD0..LOD2 (budgets damaged
# 2,500 / 600 / 120, ruined 1,200 / 300 / 80).
#   blender -b --factory-startup -P scripts/blender/build_houses_damage_bronze.py -- <out_dir> <theme> [kit_root]
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
from ti_town import G  # noqa: E402

KIT_THEMES = ('americas', 'levant', 'steppe', 'monsoon', 'eastafrica', 'maghreb', 'nile', 'westafrica', 'israelite')
# rubble: (main heap material, bits) in the kit's building stuff
RUBBLE = {
    'base': ('mudwall_bare', 'timber'), 'levant': ('mudwall_bare', 'timber'), 'nile': ('mudwall_bare', 'reed'),
    'maghreb': ('mudwall_bare', 'timber'), 'israelite': ('stone', 'timber'), 'indic': ('mudwall_bare', 'timber'),
    'europe': ('mud', 'thatch'), 'steppe': ('mud', 'timber'), 'eastafrica': ('mud', 'thatch'), 'westafrica': ('mud', 'thatch'),
    'monsoon': ('timber', 'thatch'), 'americas': ('stone', 'thatch'), 'sinic': ('mud', 'timber'),
}
SIZES = {'poor': (0.6, 0.55), 'common': (0.68, 0.64), 'rich': (0.74, 0.68)}  # the procedural kits' town slots


# ---- the intact houses ----------------------------------------------------------------------------

def procedural_house(theme, kind):
    """A layout that builds one intact house of a procedural kit at the origin, front to -Y."""
    def build(ms, rng):
        w, d = SIZES[kind]
        if theme == 'base':
            if kind == 'poor':
                tt.house(ms, rng, 0, 0, 0.55, 0.46, yaw=0, jars=0)
            elif kind == 'common':
                tt.house(ms, rng, 0, 0, 0.7, 0.58, yaw=0, jars=0, front='shade', roof_items=[('vent', 0.2, 0.05), ('mat', -0.15, 0.02)])
            else:
                tt.house(ms, rng, 0, 0, 0.9, 0.68, storeys=2, upper=(0.1, 0.1), yaw=0, jars=0, front='team')
            return
        mod = __import__('ti_%s_bronze' % theme)
        getattr(mod, '%s_house' % theme)(ms, rng, dict(x=0.0, y=0.0, w=w, d=d, kind=kind, yaw=0))
    return build


# ---- damage -------------------------------------------------------------------------------------

def bounds(parts):
    lo = Vector((1e9, 1e9, 1e9))
    hi = Vector((-1e9, -1e9, -1e9))
    for bm, _m, lod, only in parts:
        for v in bm.verts:
            lo = Vector((min(lo.x, v.co.x), min(lo.y, v.co.y), min(lo.z, v.co.z)))
            hi = Vector((max(hi.x, v.co.x), max(hi.y, v.co.y), max(hi.z, v.co.z)))
    return lo, hi


def normalise(ms):
    """Centre the house on the origin with its foot on Z = 0; returns (w, d, top). Loose vertices and
    edges (some delivered kits carry them) are dropped first: they would survive the file's LOD0
    split and stretch every object's bounds."""
    for bm, _m, _l, _o in ms.parts:
        loose = [v for v in bm.verts if not v.link_faces]
        if loose:
            bmesh.ops.delete(bm, geom=loose, context='VERTS')
        wires = [e for e in bm.edges if not e.link_faces]
        if wires:
            bmesh.ops.delete(bm, geom=wires, context='EDGES')
    ms.parts[:] = [p for p in ms.parts if p[0].faces]
    lo, hi = bounds(ms.parts)
    shift = Vector((-(lo.x + hi.x) / 2, -(lo.y + hi.y) / 2, -lo.z))
    for bm, _m, _l, _o in ms.parts:
        bmesh.ops.translate(bm, vec=shift, verts=bm.verts)
    return hi.x - lo.x, hi.y - lo.y, hi.z - lo.z


def cut(ms, co, no, fill):
    """Cut every part by the plane (co, no), dropping the side `no` points to; cap the cut when `fill`."""
    keep = []
    for bm, mat, lod, only in ms.parts:
        res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co, plane_no=no, clear_outer=True)
        if fill:
            edges = [e for e in res['geom_cut'] if isinstance(e, bmesh.types.BMEdge) and e.is_valid]
            if edges:
                try:
                    bmesh.ops.holes_fill(bm, edges=edges)
                except Exception:  # an open shell's cut: leave it open
                    pass
        if bm.faces:
            keep.append((bm, mat, lod, only))
        else:
            bm.free()
    ms.parts[:] = keep


def heap(ms, rng, mat, x, y, rx, ry, h):
    """A rubble heap inside the footprint: faceted at LOD0, plain further out."""
    r = max(rx, ry)
    sc = (rx / r, ry / r, h / r)
    tn.blob(ms, mat, (x, y, -0.004), r, sc, rng, 0.22, 2, lod=0, cut=0.0)
    tn.blob(ms, mat, (x, y, -0.004), r, sc, rng, 0.12, 1, lod=2, only=(1, 2), cut=0.0)


def bits(ms, rng, mat, w, d, n, z=0.0):
    for k in range(n):
        x, y = rng.uniform(-0.42, 0.42) * w, rng.uniform(-0.42, 0.42) * d
        ms.box(mat, (0.04, 0.028, 0.016), at=(x, y, z), rot_z=rng.uniform(0, 180), lod=0)


def charred(ms, rng, x, y, z0, z1, length, yaw):
    a = math.radians(yaw)
    tn.limb(ms, 'ash', (x - math.cos(a) * length / 2, y - math.sin(a) * length / 2, z0), (x + math.cos(a) * length / 2, y + math.sin(a) * length / 2, z1), 0.011, 0.009, segs=5, lod=0)


def damaged(intact, theme):
    def build(ms, rng):
        intact(ms, rng)
        w, d, top = normalise(ms)
        main, minor = RUBBLE[theme]
        sx, sy = rng.choice((-1, 1)), rng.choice((-1, 1))
        # a top corner broken off: a slanting cut, capped so the house stays closed
        co = Vector((sx * w * 0.28, sy * d * 0.28, top * 0.72))
        no = Vector((sx * 0.9, sy * 0.9, 1.3)).normalized()
        cut(ms, co, no, fill=True)
        # the burnt hole in the roof: a dark lump sunk into the top, charred beams standing out of it
        hx, hy = -sx * w * 0.15, -sy * d * 0.1
        tn.blob(ms, 'ash', (hx, hy, top * 0.86), min(w, d) * 0.2, (1.2, 1.0, 0.45), rng, 0.25, 1, lod=2)
        for k in range(3):
            charred(ms, rng, hx + rng.uniform(-0.06, 0.06), hy + rng.uniform(-0.05, 0.05), top * 0.8, top * 0.95 + rng.uniform(0, 0.05), 0.18, rng.uniform(0, 180))
        # the heap of the fallen corner inside the footprint, beams and cracks
        heap(ms, rng, main, sx * w * 0.26, sy * d * 0.26, w * 0.16, d * 0.14, min(0.09, top * 0.3))
        bits(ms, rng, main, w, d, 7)
        bits(ms, rng, minor, w, d, 3)
        charred(ms, rng, sx * w * 0.28, sy * d * 0.18, 0.01, 0.12, 0.24, rng.uniform(0, 180))
        for k in range(2):
            ms.box('dark', (0.012, 0.006, rng.uniform(0.06, 0.12)), at=(rng.uniform(-0.3, 0.3) * w, -d / 2 + 0.004, rng.uniform(0.08, 0.2) * top / 0.42), lod=0)
    return build


def ruined(intact, theme):
    def build(ms, rng):
        intact(ms, rng)
        w, d, top = normalise(ms)
        main, minor = RUBBLE[theme]
        zc = min(top * 0.55, rng.uniform(0.14, 0.3))
        no = Vector((rng.uniform(-0.18, 0.18), rng.uniform(-0.18, 0.18), 1.0)).normalized()
        cut(ms, Vector((0, 0, zc)), no, fill=False)
        # half the small LOD0-only details (beam ends, pots, tools) are gone with the house
        def small(bm):
            lo, hi = bounds([(bm, None, 0, None)])
            return max(hi.x - lo.x, hi.y - lo.y, hi.z - lo.z) < 0.1
        ms.parts[:] = [p for p in ms.parts if not (p[2] == 0 and p[3] is None and small(p[0]) and rng.random() < 0.65)]
        heap(ms, rng, main, 0, 0, w * 0.36, d * 0.34, zc * 0.9)  # the fallen walls and roof inside
        r = max(w * 0.2, d * 0.18)  # a smaller heap of roof stuff, LOD0 and LOD1 only
        hx, hy = rng.uniform(-0.15, 0.15) * w, rng.uniform(-0.15, 0.15) * d
        tn.blob(ms, minor, (hx, hy, -0.004), r, (w * 0.2 / r, d * 0.18 / r, zc * 0.95 / r), rng, 0.2, 1, lod=1, cut=0.0)
        bits(ms, rng, main, w, d, 5)
        for k in range(3):
            charred(ms, rng, rng.uniform(-0.25, 0.25) * w, rng.uniform(-0.25, 0.25) * d, zc * 0.5, zc * rng.uniform(0.6, 1.1), rng.uniform(0.2, 0.32), rng.uniform(0, 180))
    return build


# ---- kits -------------------------------------------------------------------------------------

def kit_layouts(theme, kit_root, state):
    import assemble_kit_towns as ak  # noqa: E402 (wraps tm.smart_uv / transfer_uvs for the 'orig' UVs)
    path = os.path.join(kit_root, theme, 'bronze', 'houses', 'model.glb')

    def kit_maker():
        def lod1_ratio(p):
            return min(1.0, 270 / max(1, p.tris))
        boxes = ('house-poor', 'house-common', 'house-rich')
        parts, images = ak.load_kit({'houses': path}, lod1_ratio, lambda p: 60, lod2_box=boxes)
        # the same houses decimated to about 900 triangles: the ruins' LOD0 of a heavy kit (budget 1,200)
        light, _ = ak.load_kit({'houses': path}, lambda p: min(1.0, 900 / max(1, p.tris)), lambda p: 60, lod2_box=boxes)
        state['light'] = light
        tone = ak.KIT_TONE.get((theme, 'bronze'))
        for key, img in images.items():
            town = ak.lifted(img, [p.lod0['town'] for p in parts.values() if p.key == key and 'town' in p.lod0], *tone) if tone else None
            ak.kit_material('nl_%s_town' % key, town or img)
            ak.kit_material('nl_%s_team' % key, ak.team_retoned(img, parts, key) or img)
        state['parts'] = parts
    ak.register_materials(['nl_houses_town', 'nl_houses_team'], team=['nl_houses_team'])
    tt.EXTRA_MATERIALS[:] = [(n, m) for n, m in tt.EXTRA_MATERIALS if n != 'assemble_kit'] + [('assemble_kit', kit_maker)]

    def house(kind, ruin=False):
        def build(ms, rng):
            part = state['parts']['house-' + kind]
            if not ruin or part.tris <= 1000:
                ak.add_part(ms, part, tm.house_frame(0, 0, 0))
                return
            light = state['light']['house-' + kind]
            for lod, store in ((0, light.lod1), (1, part.lod1), (2, part.lod2)):
                for role, bm in store.items():
                    mat = 'nl_houses_%s' % role if role in ('town', 'team') else 'nl_houses_town'
                    ms.add(bm.copy(), mat, lod=2, only=(lod,))
        return build
    return {k: house(k) for k in ('poor', 'common', 'rich')}, {k: house(k, True) for k in ('poor', 'common', 'rich')}, ak


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = os.path.abspath(argv[0])
    theme = argv[1]
    kit_root = argv[2] if len(argv) > 2 else os.path.join('art-build', 'kitsrc', 'plans', 'art', 'kits')
    state = {}
    ak = None
    if theme in KIT_THEMES:
        intact, intact_ruin, ak = kit_layouts(theme, os.path.abspath(kit_root), state)
    else:
        if theme != 'base':
            __import__('ti_%s_bronze' % theme)  # registers the kit's materials
        intact = {k: procedural_house(theme, k) for k in ('poor', 'common', 'rich')}
        intact_ruin = intact
    items = []
    for k in ('poor', 'common', 'rich'):
        items.append(('house-%s-damaged' % k, damaged(intact[k], theme), None))
        items.append(('house-%s-ruined' % k, ruined(intact_ruin[k], theme), None))
    name = 'bronze-houses-damage' if theme == 'base' else 'bronze-%s-houses-damage' % theme
    seed = 7000 + sum(ord(c) for c in theme)
    counts = tt.build_file(name, items, out_dir, atlas=1024, seed=seed, write=ak is None)
    if ak is not None:
        ak.finish(out_dir, name)
    import json
    with open(os.path.join(out_dir, name + '.report.json'), 'w') as fh:
        json.dump({'file': name + '.glb', 'theme': theme, 'triangles': counts}, fh, indent=2)
    print('HOUSES_BUILT', name, flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
