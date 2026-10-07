# scripts/blender/build_rts_gunpowder.py
# The Gunpowder battle buildings, src/assets/battle/rts/rts-gunpowder.glb (plans/ART-MODELS-PLAN.md
# section 5; src/assets/battle/rts/README.md): the 13 roles of a battle economy, each with a
# `<role>-damaged` sibling and its sockets, plus the four construction stages, in the Gunpowder town
# kit's look (ti_gunpowder.py: brick and cream-stucco houses on sandstone plinths with quoins, tile
# and slate roofs, sash windows and shutters) so a battle's buildings match the towns on the map.
# The layouts, sockets, damage and grounding are build_rts_classical.py's (as for build_rts_kingdoms.py:
# its Roman house answered by ti_gunpowder.gp_house, its cypresses by the kit's trees, the materials
# renamed), with the plan's Gunpowder parts in their own layouts:
#   town-hall       a brick town hall with a clock tower in its walled court (the keep, 20 m, centred)
#   tower           a bastion gun platform: a battered brick-and-sandstone artillery tower, a cannon
#                   on the platform behind a parapet, a sentry box under slate
#   siege-workshop  a gun foundry: the gantry lifting a new cannon barrel off trestles, a brick
#                   furnace with a tall chimney, gun wheels, a store house
#   expedition-camp the Classical camp with gabions at its gate
#   mine            the Classical mine with a timber headframe over the shaft
#   range           the Classical range with an earth gun butt behind the targets
# One atlas for the file, LOD0..LOD2 per object.
#   blender -b --factory-startup -P scripts/blender/build_rts_gunpowder.py -- [out_dir] [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_gunpowder as tg  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
from ti_town import G  # noqa: E402

# the Classical stuff in its Gunpowder counterpart
MATS = {'ashlar': 'gp_sandstone', 'cream': 'gp_stucco', 'tile': 'gp_tile', 'tile_dark': 'gp_slate', 'marble': 'gp_sandstone',
        'mudwall': 'gp_brick', 'mudwall_bare': 'gp_stucco', 'roof': 'gp_tile', 'pylon': 'gp_brick'}
WORLD = rc.WORLD


def gp_house(ms, rng, x, y, w, d, storeys=1, yaw=None, rise=0.15, awning_w=None, chimney=False, door=0.0,
             balcony=False, jar_n=0, gable_front=False, h=None):
    """ti_classical.roman_house's call, answered by a Gunpowder brick or stucco house (its frame)."""
    wall = 'gp_brick' if (int(abs(x) * 10 + abs(y) * 7) % 2) else 'gp_stucco'
    kw = dict(h=h) if h else {}
    return tg.gp_house(ms, rng, x, y, w, d, yaw=yaw, wall=wall, roof='gp_tile', kind='gable' if storeys < 2 else 'hip',
                       storeys=max(1, storeys), rise=max(0.1, rise), chimneys=1 if chimney or w > 0.6 else 0,
                       dormers=0, props=min(2, jar_n), gable_front=gable_front, back_windows=False, side_windows=w > 0.5, **kw)


def tree(ms, x, y, h=None, r=None, lod=1):
    tg.tree(ms, x, y, h=0.42, r=0.13)


tc.roman_house = gp_house
tc.cypress = tree


def remat(layout):
    return rc.remat(layout, MATS)


# ---- the roles drawn new ---------------------------------------------------------------------------

def town_hall(ms, rng):
    """20 x 20 m: the keep, a three-storey brick town hall under a mansard with its clock tower to the
    front, inside a walled court with a gate, a well, lamps and banners."""
    tg.town_hall(ms, rng, 0, 0.3, 1.0, 0.8, 1.55, yaw=0, storeys=3, tw=0.28, shaft=0.6)
    tc.court_wall(ms, -0.95, -0.92, 0.95, -0.92, h=0.2, gaps=((0.5, 0.36),))
    tc.court_wall(ms, -0.95, -0.92, -0.95, 0.92, h=0.2)
    tc.court_wall(ms, 0.95, -0.92, 0.95, 0.92, h=0.2)
    tc.court_wall(ms, -0.95, 0.92, 0.95, 0.92, h=0.2)
    for sx in (-1, 1):
        ms.box('gp_sandstone', (0.12, 0.12, 0.34), at=(sx * 0.22, -0.92, G), lod=2, bevel=0.005)
        tb.banner(ms, WORLD, sx * 0.22, -0.99, G + 0.32, w=0.08, h=0.2)
        tg.lamp(ms, sx * 0.55, -0.62)
    tg.well(ms, -0.62, -0.45)
    tg.tree(ms, 0.65, -0.55)
    tg.tree(ms, 0.75, 0.68)
    top = rc.flag_pole(ms, -0.7, 0.65, 1.05, w=0.24, fh=0.15)
    return {'socket-door': (0, -0.95, 0), 'socket-rally': (0, -1.4, 0), 'socket-drop': (0.35, -0.98, 0), 'socket-banner': top,
            'socket-fire-1': (-0.2, 0.3, 0.85), 'socket-fire-2': (0.2, 0.0, 0.85), 'socket-fire-3': (0, -0.2, 1.3), 'socket-fire-4': (-0.6, -0.6, 0.2), 'socket-smoke-1': (0, 0.3, 1.0)}


def tower(ms, rng):
    """8 x 8 m, 14 m: a bastion gun platform: a battered brick tower on a sandstone footing with a
    string course and gun ports, a parapet with embrasures, a cannon on the platform facing the
    front, a sentry box under a slate roof, a team pennant."""
    w, h = 0.6, 0.86
    ms.box('gp_sandstone', (w + 0.1, w + 0.1, 0.14), at=(0, 0, G), lod=2, bevel=0.005, taper=0.9)
    ms.box('gp_brick', (w, w, h), at=(0, 0, G + 0.12), lod=2, bevel=0.004, taper=0.88)
    ms.box('gp_sandstone', (w * 0.92, w * 0.92, 0.04), at=(0, 0, G + 0.5), lod=1)  # the string course
    top_z = G + 0.12 + h
    ms.box('gp_sandstone', (w * 0.92, w * 0.92, 0.04), at=(0, 0, top_z - 0.02), lod=2)
    # the parapet: four low walls with embrasures at the front
    pw = w * 0.9
    for k, (x, y, sx, sy) in enumerate([(0, -pw / 2, pw, 0.05), (0, pw / 2, pw, 0.05), (-pw / 2, 0, 0.05, pw), (pw / 2, 0, 0.05, pw)]):
        if k == 0:
            for px in (-pw / 2 + 0.09, 0.0, pw / 2 - 0.09):
                ms.box('gp_brick', (0.12, 0.05, 0.09), at=(px, y, top_z + 0.02), lod=1)
        else:
            ms.box('gp_brick', (sx, sy, 0.09), at=(x, y, top_z + 0.02), lod=1)
    for k in range(4):  # gun ports and slits
        a = k * math.pi / 2
        ms.box('dark', (0.06, 0.012, 0.05), at=(math.sin(a) * (w * 0.44 + 0.004), -math.cos(a) * (w * 0.44 + 0.004), G + 0.35), rot_z=math.degrees(a), lod=0)
    tg.cannon(ms, WORLD, -0.06, -0.12, top_z + 0.02, 0, s=1.4)
    # the sentry box on the back corner
    sf = tm.house_frame(0.16, 0.16, 0)
    ms.box('gp_stucco', (0.16, 0.16, 0.2), at=(0, 0, top_z + 0.02), lod=1, frame=sf)
    tg.hip(ms, sf, 0.16, 0.16, top_z + 0.22, 0.09, mat='gp_slate', lod=1)
    ms.box('door', (0.12, 0.012, 0.22), at=(0, -w * 0.47, G + 0.12), lod=1)
    top = rc.flag_pole(ms, -0.2, 0.2, 1.45, w=0.16, fh=0.1)
    return {'socket-door': (0, -0.34, 0), 'socket-rally': (0, -0.65, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0, top_z + 0.1), 'socket-fire-2': (-0.15, -0.2, 0.6), 'socket-fire-3': (0.16, 0.16, top_z + 0.2), 'socket-fire-4': (0, -0.26, 0.3), 'socket-smoke-1': (0, 0, top_z + 0.3)}


def siege_workshop(ms, rng):
    """20 x 16 m: a gun foundry yard: the timber gantry lifting a new cannon barrel off its trestles,
    gun wheels and a carriage trail lying by, a brick furnace with a tall chimney, a store house."""
    for sx in (-0.55, 0.55):
        for sy in (-0.25, 0.35):
            ms.box('timber', (0.045, 0.045, 1.05), at=(sx, sy, G), lod=2)
        ms.box('timber', (0.05, 0.66, 0.05), at=(sx, 0.05, G + 1.02), lod=2)
    for sy in (-0.25, 0.35):
        ms.box('timber', (1.16, 0.05, 0.05), at=(0, sy, G + 1.02), lod=2)
    rc.beam(ms, 'timber', (-0.55, -0.25, G + 0.5), (-0.55, 0.35, G + 1.0), r=0.014)
    rc.beam(ms, 'linen', (0.05, 0.05, G + 1.02), (0.05, 0.05, G + 0.34), r=0.005, segs=4, lod=0)
    for sx in (-0.25, 0.25):  # the trestles and the barrel
        ms.box('timber', (0.05, 0.2, 0.16), at=(sx, 0.05, G), lod=1)
    ms.cyl('bronze', 0.055, 0.04, 0.72, at=(0.36, 0.05, G + 0.27), rot=(0, -90, 0), segs=10, lod=2)
    ms.cyl('bronze', 0.065, 0.065, 0.06, at=(0.36, 0.05, G + 0.27), rot=(0, -90, 0), segs=10, lod=0)  # the breech ring
    for sx in (-0.2, 0.15):  # gun wheels lying by
        ms.cyl('timber', 0.13, 0.13, 0.03, at=(sx, -0.48, G), segs=12, lod=1)
        ms.cyl('gp_iron', 0.135, 0.135, 0.012, at=(sx, -0.48, G + 0.03), segs=12, lod=0)
    ms.box('timber', (0.1, 0.6, 0.06), at=(0.55, -0.45, G), lod=1, rot_z=20)  # a carriage trail
    # the furnace and its chimney at the back left
    ms.box('gp_brick', (0.42, 0.34, 0.32), at=(-0.62, 0.55, G), lod=2, bevel=0.004)
    ms.box('dark', (0.12, 0.012, 0.1), at=(-0.62, 0.38, G + 0.03), lod=0)
    ms.box('gp_brick', (0.14, 0.14, 1.25), at=(-0.72, 0.62, G), lod=2, taper=0.8)
    ms.box('gp_sandstone', (0.15, 0.15, 0.04), at=(-0.72, 0.62, G + 1.24), lod=1)
    tb.log_bundle(ms, -0.75, -0.45, 90, length=0.36)
    gp_house(ms, rng, 0.6, 0.62, 0.55, 0.3, yaw=0, rise=0.1, h=0.26)
    top = rc.flag_pole(ms, -0.2, 0.7, 0.7)
    return {'socket-door': (0, -0.5, 0), 'socket-rally': (0, -1.1, 0), 'socket-banner': top,
            'socket-fire-1': (0, 0.05, 1.05), 'socket-fire-2': (0.6, 0.62, 0.35), 'socket-fire-3': (-0.62, 0.55, 0.35), 'socket-fire-4': (0.2, 0.05, 0.25), 'socket-smoke-1': (-0.72, 0.62, 1.35)}


def with_extras(layout, extra):
    def build(ms, rng):
        sockets = layout(ms, rng)
        extra(ms, rng)
        return sockets
    build.__doc__ = layout.__doc__
    return build


def gabions(ms, rng):
    """Gabions either side of the camp's gate."""
    for x in (-0.36, -0.25, 0.25, 0.36):
        ms.cyl('timber', 0.05, 0.05, 0.12, at=(x, -0.98, G), segs=8, lod=1)
        ms.cyl('earth', 0.044, 0.044, 0.004, at=(x, -0.98, G + 0.12), segs=8, lod=0)


def headframe(ms, rng):
    """A timber headframe over the shaft: an A-frame with a wheel at the top, at the back right."""
    x, y = 0.38, -0.38
    for sx in (-1, 1):
        rc.beam(ms, 'timber', (x + sx * 0.12, y - 0.1, G), (x + sx * 0.04, y, G + 0.55), r=0.014)
        rc.beam(ms, 'timber', (x + sx * 0.12, y + 0.1, G), (x + sx * 0.04, y, G + 0.55), r=0.014)
    ms.cyl('timber', 0.07, 0.07, 0.016, at=(x - 0.008, y, G + 0.55), rot=(0, 90, 0), segs=10, lod=1)
    ms.box('dark', (0.16, 0.16, 0.012), at=(x, y, G), lod=0)


def gun_butt(ms, rng):
    """An earth gun butt behind the targets."""
    ms.sphere('earth', 0.3, at=(0, 0.62, G - 0.05), scale=(2.6, 0.5, 0.55), u=8, v=4, cut_below=0.0, lod=2)


EXTRAS = {'expedition-camp': gabions, 'mine': headframe, 'range': gun_butt}
NEW = {'town-hall': town_hall, 'tower': tower, 'siege-workshop': siege_workshop}
STAGES = [(n, remat(fn)) for n, fn in rb.STAGES]
ROLES = [(n, remat(NEW.get(n) or (with_extras(fn, EXTRAS[n]) if n in EXTRAS else fn))) for n, fn in rc.ROLES]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-gunpowder')
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
    counts = tt.build_file('rts-gunpowder', items, out_dir, atlas=atlas, seed=3500, write=False)
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
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'rts-gunpowder.blend'))
    tm.export_glb(os.path.join(out_dir, 'rts-gunpowder.glb'), exported)
    import json
    with open(os.path.join(out_dir, 'report.json'), 'w') as fh:
        json.dump({'file': 'rts-gunpowder.glb', 'triangles': counts, 'sockets': rb.SOCKETS, 'atlas': atlas}, fh, indent=2)
    print('RTS_GUNPOWDER_BUILT', len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
