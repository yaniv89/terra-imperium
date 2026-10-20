# scripts/blender/build_map_future.py
# The Future close-view map art (eight-ages plan U90, U84's robot ship), on the town kit (ti_town.build_file: one
# baked 1024 atlas per file, LOD0..LOD2 under a root named after the file, materials Town / Team / Ground) with
# the Future kit (ti_future_kit.py) and the Stone map builder's helpers (build_map_stone.py: sockets, trims):
#   improvements/farm-future            hydroponic tunnels in rows, a farm dome, a solar array, water tanks
#   improvements/fishing_boats-future   a floating dock with aquaculture ring pens and a hover boat (no ground)
#   improvements/fort-future            six shield pylons round a domed bunker, a landing pad, a hover tank
#   improvements/mine-future            an extractor tower over the shaft, a processing pod, a conveyor, canisters
#   outposts/outpost-future             two pods, a landing pad, a comms mast, the `smoke` socket
#   ships/warship-future                a stealth cruiser: a faceted hull, an angular superstructure, two railgun
#                                       turrets, missile cells, a Team band, the waterline at z 0 (26 m)
#   ships/autonomous_warship-future     the robot ship: a low trimaran drone hull, a sensor mast, no bridge
# Budgets: improvements 8,000 / 1,500 / 300, ships 12,000 / 3,000 / 400 (validate_model.py).
#   blender -b --factory-startup -P scripts/blender/build_map_future.py -- <out_dir> [farm fishing_boats ...]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import bmesh  # noqa: E402
from mathutils import Vector  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_future_kit as fk  # noqa: E402
import ti_stone_map as ts  # noqa: E402 (trim, on_ground, budgeted)
import build_map_stone as bms  # noqa: E402 (with_socket)
from ti_town import G  # noqa: E402

DISC = dict(rx=2.37, ry=2.37, square=None, mat='earth', n=32)


def prism(ms, mat, outline, z0, z1, lod=2, only=None, shrink=1.0):
    """A vertical prism over a closed outline [(x, y)], its top scaled by `shrink` about the outline's centre."""
    bm = bmesh.new()
    cx = sum(p[0] for p in outline) / len(outline)
    cy = sum(p[1] for p in outline) / len(outline)
    bot = [bm.verts.new((x, y, z0)) for x, y in outline]
    top = [bm.verts.new((cx + (x - cx) * shrink, cy + (y - cy) * shrink, z1)) for x, y in outline]
    bm.faces.new(list(reversed(bot)))
    bm.faces.new(top)
    n = len(outline)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    ms.add(bm, mat, lod, only=only)


# ---- improvements ----------------------------------------------------------------------------------

def farm(ms, rng):
    for k, x in enumerate((-1.1, -.65, -.2, .25)):
        f = tm.house_frame(x, -.2, 0)
        ms.box('fu_green', (.30, 1.6, .03), at=(0, 0, G), lod=1, frame=f)
        ms.cyl('fu_glass', .16, .16, 1.6, at=(0, -.8, G + .02), rot=(-90, 0, 0), segs=10, lod=1, frame=f)
        ms.box('fu_glass', (.32, 1.6, .16), at=(0, 0, G), lod=2, frame=f)
    fk.dome(ms, .95, .55, .42, mat='fu_green')
    fk.solar_array(ms, .9, -.6, w=.8, d=.3)
    fk.solar_array(ms, .9, -1.05, w=.8, d=.3)
    for k in range(2):
        ms.cyl('fu_panel', .12, .12, .3, at=(-.3 + .3 * k, 1.05, G), segs=10, lod=1)
    ms.box('fu_glow', (.012, 1.8, .004), at=(-1.4, -.2, G + .004), lod=0)
    return None


def fishing_boats(ms, rng):
    # the shore strip: the Ground patch shifted to the back (land side), as the Stone and Bronze files'
    first = len(ms.parts)
    tt.ground_patch(ms, rng, rx=2.36, ry=.82, square=None, power=3.0, mat='earth', n=32)
    for bm, *_ in ms.parts[first:]:
        bmesh.ops.translate(bm, vec=(0, .75, 0), verts=bm.verts)
    ms.box('fu_plinth', (2.4, .40, .06), at=(0, .9, 0), lod=2)  # the quay
    ms.box('fu_glow', (2.36, .012, .006), at=(0, .7, .06), lod=0)
    for k in range(4):
        ms.box('fu_plinth', (.18, .7, .05), at=(-.9 + .6 * k, .4, 0), lod=1)
    for k, (x, y) in enumerate(((-.9, -.4), (0, -.6), (.9, -.4))):  # aquaculture ring pens
        ms.cyl('fu_graphite', .34, .34, .05, at=(x, y, 0), segs=16, lod=1, caps=False)
        ms.cyl('fu_glow', .345, .345, .008, at=(x, y, .05), segs=16, lod=0, caps=False)
    fk.pod(ms, .9, 1.0, .40, .24, .16)
    f = tm.house_frame(-.6, .05, 15)  # a hover boat
    ms.box('fu_panel', (.16, .46, .06), at=(0, 0, 0), lod=1, frame=f, taper=.8)
    ms.box('fu_glass', (.10, .12, .05), at=(0, -.05, .06), lod=0, frame=f)
    return None


def fort(ms, rng):
    for k in range(6):
        a = math.radians(30 + 60 * k)
        fk.pylon(ms, 1.6 * math.cos(a), 1.6 * math.sin(a), h=.8, r=.06)
    for lod, segs in ((0, 36), (1, 18), (2, 12)):  # the shield's light ring on the ground
        ms.cyl('fu_glow', 1.62, 1.62, .01, at=(0, 0, G), segs=segs, lod=lod, only=(lod,), caps=False)
    for k, s in enumerate((16, 10, 8)):
        ms.cyl('fu_graphite', .55, .5, .18, at=(0, .2, G), segs=s, lod=k, only=(k,))
        ms.sphere('fu_panel', 1.0, at=(0, .2, G + .18), scale=(.5, .5, .3), u=s, v=max(4, s // 2), lod=k, only=(k,), cut_below=0.0)
    ms.box('fu_glow', (.4, .01, .02), at=(0, -.33, G + .12), lod=0)
    fk.landing_pad(ms, .9, -.6, r=.3)
    fk.hover_tank_prop(ms, -.8, -.6, yaw=20)
    ms.box('team_cloth', (.2, .01, .14), at=(0, -.31, G + .02), lod=1)
    return None


def mine(ms, rng):
    x, y = .2, .1
    ms.cyl('fu_plinth', .4, .4, .08, at=(x, y, G), segs=12, lod=2)
    ms.cyl('fu_graphite', .2, .12, 1.3, at=(x, y, G + .08), segs=8, lod=2)
    for k in range(3):
        ms.cyl('fu_glow', .18 - .02 * k, .18 - .02 * k, .03, at=(x, y, G + .35 + .35 * k), segs=8, lod=0)
    fk.pod(ms, -.8, .4, .7, .5, .3)
    ms.box('fu_graphite', (.9, .1, .08), at=(-.3, .25, G + .25), rot_z=10, lod=1)
    for k in range(5):
        ms.cyl('fu_panel', .09, .09, .2, at=(.7 + .2 * (k % 2), -.8 + .22 * k, G), segs=8, lod=0)
    return None


def outpost(ms, rng):
    fk.pod(ms, -.6, .4, .55, .34, .2)
    fk.pod(ms, .55, .5, .45, .3, .18, yaw=10)
    fk.landing_pad(ms, 0, -.6, r=.35)
    ms.cyl('fu_graphite', .02, .008, .9, at=(.9, -.2, G), segs=5, lod=1)
    ms.box('fu_glow', (.04, .04, .03), at=(.9, -.2, G + .9), lod=0)
    tt.pennant(ms, tm.house_frame(0, 0, 0), -.95, -.3, G + .55, yaw=-150, lod=1, w=.2, h=.12)
    ms.cyl('fu_graphite', .012, .012, .55, at=(-.95, -.3, G), segs=4, lod=1)
    return (-.6, .4, .3)


# ---- ships ------------------------------------------------------------------------------------------

def warship(ms, rng):
    L, W = 2.6, .42
    hull = [(0, -L / 2), (W * .5, -L / 2 + .55), (W * .5, L / 2 - .1), (W * .35, L / 2), (-W * .35, L / 2), (-W * .5, L / 2 - .1), (-W * .5, -L / 2 + .55)]
    prism(ms, 'fu_graphite', hull, 0.0, .16, lod=2, shrink=.92)
    ms.box('fu_glow', (W * .9, .012, .006), at=(0, .3, .16), lod=0)
    prism(ms, 'fu_panel', [(-.14, -.15), (.14, -.15), (.16, .45), (-.16, .45)], .16, .42, lod=2, shrink=.7)  # the angular superstructure
    ms.box('team_cloth', (.30, .06, .05), at=(0, .3, .2), lod=1)
    ms.cyl('fu_graphite', .025, .01, .3, at=(0, .25, .42), segs=5, lod=1)
    for y in (-.75, .85):  # railgun turrets
        ms.cyl('fu_panel', .09, .08, .06, at=(0, y, .16), segs=8, lod=1)
        for sx in (-1, 1):
            ms.box('fu_graphite', (.012, .32, .02), at=(sx * .02, y - (.16 if y < 0 else -.16), .2), lod=0)
    for k in range(4):
        ms.box('fu_plinth', (.18, .06, .01), at=(0, -.4 + .08 * k, .16), lod=0)
    return None


def autonomous_warship(ms, rng):
    L = 2.2
    prism(ms, 'fu_graphite', [(0, -L / 2), (.12, -L / 2 + .4), (.12, L / 2), (-.12, L / 2), (-.12, -L / 2 + .4)], 0.0, .12, lod=2, shrink=.9)
    for sx in (-1, 1):  # the outrigger hulls
        prism(ms, 'fu_graphite', [(sx * .38, -.6), (sx * .44, -.4), (sx * .44, .7), (sx * .32, .7), (sx * .32, -.4)], 0.0, .07, lod=2, shrink=.9)
        ms.box('fu_graphite', (.30, .05, .03), at=(sx * .2, -.1, .07), lod=1)
        ms.box('fu_graphite', (.30, .05, .03), at=(sx * .2, .5, .07), lod=1)
    ms.box('fu_panel', (.2, .5, .1), at=(0, .1, .12), lod=2, taper=.7)
    ms.box('team_cloth', (.22, .04, .04), at=(0, .35, .13), lod=1)
    ms.cyl('fu_graphite', .02, .01, .4, at=(0, .05, .22), segs=5, lod=1)
    for k in range(3):
        a = math.radians(120 * k)
        ms.box('fu_panel', (.08, .01, .06), at=(.04 * math.cos(a), .05 + .04 * math.sin(a), .5), rot_z=math.degrees(a), lod=0)
    ms.box('fu_glow', (.04, .04, .03), at=(0, .05, .62), lod=0)
    ms.box('fu_glow', (.2, .012, .006), at=(0, -.4, .12), lod=0)
    ms.cyl('fu_panel', .07, .06, .05, at=(0, -.55, .12), segs=8, lod=1)
    ms.box('fu_graphite', (.012, .24, .02), at=(0, -.75, .15), lod=0)
    return None


IMPROVEMENTS = {'farm': farm, 'fishing_boats': fishing_boats, 'fort': fort, 'mine': mine}
SEEDS = {'farm': 9201, 'fishing_boats': 9202, 'fort': 9203, 'mine': 9204, 'outpost': 9205, 'warship': 9206, 'autonomous_warship': 9207}


def build(item, out_dir):
    if item in IMPROVEMENTS:
        name = '%s-future' % item
        ground = None if item == 'fishing_boats' else DISC
        counts = tt.build_file(name, [(name, ts.budgeted(IMPROVEMENTS[item]), ground)], out_dir, atlas=1024, seed=SEEDS[item])
        print('FUTURE_BUILT', name, counts, flush=True)
    elif item == 'outpost':
        bms.with_socket('outpost-future', outpost, dict(rx=2.0, ry=1.85, square=None, power=3.0, mat='earth', n=32), out_dir, SEEDS[item], 'smoke',
                        budgets=(7600, 1400, 280))
    elif item in ('warship', 'autonomous_warship'):
        fn = warship if item == 'warship' else autonomous_warship
        name = '%s-future' % item

        def run(ms, rng):
            fn(ms, rng)
            ts.on_ground(ms)
            for lod, b in zip((0, 1, 2), (11000, 2800, 380)):
                ts.trim(ms, lod, b)
            ts.on_ground(ms)
        counts = tt.build_file(name, [(name, run, None)], out_dir, atlas=1024, seed=SEEDS[item])
        print('FUTURE_BUILT', name, counts, flush=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    for it in (argv[1:] or list(IMPROVEMENTS) + ['outpost', 'warship', 'autonomous_warship']):
        build(it, out)
    sys.stdout.flush()
    os._exit(0)
