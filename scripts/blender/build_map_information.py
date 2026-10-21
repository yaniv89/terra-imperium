# scripts/blender/build_map_information.py
# The Information close-view map art (eight-ages plan U90), on the town kit (ti_town.build_file: one baked 1024 atlas
# per file, LOD0..LOD2 under a root named after the file, materials Town / Team / Ground) with today's kit
# (ti_information_kit.py) and the Stone map builder's helpers (build_map_stone.py: sockets; ti_stone_map: trims):
#   improvements/farm-information           a centre-pivot circle, grain silos, a steel barn, a combine harvester
#   improvements/fishing_boats-information  a concrete quay with a cold store, two trawlers moored, fish-farm pens
#                                           (no ground: the shore strip is its own)
#   improvements/fort-information           a base: a square of earth-filled barrier walls, watchtowers at the corners,
#                                           container offices, a helipad, an armoured vehicle, a cell mast
#   improvements/mine-information           an open pit in terraced steps, a haul road, two dump trucks, a crusher plant
#   outposts/outpost-information            a container camp, a satellite dish, a cell mast, the `smoke` socket
#   ships/warship-information               a guided-missile frigate: a sloped grey hull, a stealthy superstructure
#                                           with a radar mast, a bow gun, missile cells, a helicopter deck (24 m)
# Budgets: improvements 8,000 / 1,500 / 300, ships 12,000 / 3,000 / 400 (validate_model.py).
#   blender -b --factory-startup -P scripts/blender/build_map_information.py -- <out_dir> [farm fishing_boats ...]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import bmesh  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_modern as md  # noqa: E402,F401 (md_ crop materials)
import ti_information_kit as ik  # noqa: E402
import ti_stone_map as ts  # noqa: E402 (trim, on_ground, budgeted)
import build_map_stone as bms  # noqa: E402 (with_socket)
import build_rts_information as ri  # noqa: E402 (the truck)
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
    for k, s in enumerate((28, 16, 10)):  # the pivot circle
        ms.cyl('md_veg', 1.15, 1.15, .02, at=(-.5, -.3, G), segs=s, lod=k, only=(k,))
    ms.cyl('in_graphite', .04, .04, .14, at=(-.5, -.3, G), segs=6, lod=1)
    ms.box('in_graphite', (1.1, .02, .02), at=(.05, -.3, G + .12), lod=1)
    for k in range(4):
        ms.box('in_graphite', (.02, .05, .12), at=(-.25 + .26 * k, -.3, G), lod=0)
    for k in range(3):  # grain silos
        ms.cyl('in_panel', .14, .14, .5, at=(.9 + .3 * (k % 2), .6 + .3 * (k // 2), G), segs=12, lod=2)
        ms.cyl('in_panel', .14, .02, .1, at=(.9 + .3 * (k % 2), .6 + .3 * (k // 2), G + .5), segs=12, lod=1)
    f = tm.house_frame(.9, -.4, 0)  # the steel barn
    ms.box('in_panel', (.7, .4, .24), at=(0, 0, G), lod=2, frame=f)
    ms.box('in_graphite', (.74, .44, .1), at=(0, 0, G + .24), lod=2, frame=f, taper=.3)
    ms.box('dark', (.24, .01, .18), at=(0, -.205, G), lod=1, frame=f)
    f = tm.house_frame(.4, .95, 30)  # a combine harvester
    ms.box('in_cont_red', (.18, .3, .14), at=(0, 0, G + .04), lod=1, frame=f)
    ms.box('in_graphite', (.34, .06, .04), at=(0, -.2, G + .04), lod=1, frame=f)
    ms.box('in_glass', (.12, .08, .06), at=(0, -.06, G + .18), lod=0, frame=f)
    return None


def trawler(ms, x, y, yaw, L=.6):
    f = tm.house_frame(x, y, yaw)
    ms.box('in_cont_blue', (.16, L, .08), at=(0, 0, 0), lod=2, frame=f, taper=.85)
    ms.box('in_panel', (.12, .16, .1), at=(0, -L * .2, .08), lod=1, frame=f)
    ms.box('in_glass', (.11, .005, .03), at=(0, -L * .2 - .08, .14), lod=0, frame=f)
    ms.box('in_graphite', (.01, .01, .3), at=(0, L * .15, .08), lod=1, frame=f)
    ms.box('in_graphite', (.2, .01, .01), at=(0, L * .3, .3), rot_z=0, lod=0, frame=f)


def fishing_boats(ms, rng):
    # the shore strip: the Ground patch shifted to the back (land side), as the Stone and Bronze files'
    first = len(ms.parts)
    tt.ground_patch(ms, rng, rx=2.36, ry=.82, square=None, power=3.0, mat='earth', n=32)
    for bm, *_ in ms.parts[first:]:
        bmesh.ops.translate(bm, vec=(0, .75, 0), verts=bm.verts)
    ms.box('in_plinth', (2.4, .40, .06), at=(0, .9, 0), lod=2)  # the quay
    ms.box('in_mark', (2.36, .012, .006), at=(0, .7, .06), lod=0)
    for k in range(3):
        ms.box('in_plinth', (.16, .7, .05), at=(-.9 + .9 * k, .4, 0), lod=1)
    trawler(ms, -.5, .25, 0)
    trawler(ms, .45, .25, 0)
    for k, (x, y) in enumerate(((-.9, -.5), (0, -.65), (.9, -.5))):  # fish-farm pens
        ms.cyl('in_graphite', .3, .3, .04, at=(x, y, 0), segs=16, lod=1, caps=False)
        ms.cyl('in_mark', .305, .305, .008, at=(x, y, .04), segs=16, lod=0, caps=False)
    ik.pod(ms, .9, 1.0, .40, .24, .16, mat='in_panel')  # the cold store
    ik.container(ms, -.9, 1.0, 0, mat='in_cont_red')
    return None


def fort(ms, rng):
    S = 1.5  # the square of barrier walls
    for side in range(4):
        for k in range(12):
            t = -S + (2 * S) * (k + .5) / 12
            if side == 0 and abs(t) < .25:
                continue  # the gate
            x, y = [(t, -S), (S, t), (t, S), (-S, t)][side]
            ms.box('md_sandbag', (.24, .12, .14), at=(x, y, G), rot_z=0 if side % 2 == 0 else 90, lod=1)
    for lod in (2,):
        for side in range(4):
            x, y = [(0, -S), (S, 0), (0, S), (-S, 0)][side]
            ms.box('md_sandbag', (2 * S + .1 if side % 2 == 0 else .12, .12 if side % 2 == 0 else 2 * S + .1, .14), at=(x, y, G), lod=2)
            bm, mat, _l, _o = ms.parts[-1]
            ms.parts[-1] = (bm, mat, 2, (2,))
    for sx in (-1, 1):  # watchtowers at the corners
        for sy in (-1, 1):
            ms.box('in_graphite', (.14, .14, .4), at=(sx * S, sy * S, G), lod=2, taper=.8)
            ms.box('in_panel', (.2, .2, .1), at=(sx * S, sy * S, G + .4), lod=1)
    for k in range(3):
        ik.container(ms, -.6 + .35 * k, .7, 0, mat='in_panel', lod=2)
    ik.landing_pad(ms, .6, -.4, r=.3)
    ik.hover_tank_prop(ms, -.7, -.5, yaw=20)
    ik.pylon(ms, -.9, .9, h=.9, r=.05, rings=2)
    ms.box('team_cloth', (.2, .01, .14), at=(0, -S - .07, G + .02), lod=1)
    return None


def mine(ms, rng):
    for k, (r, z) in enumerate(((1.1, .0), (.85, -.0), (.6, .0))):  # the pit's terraced steps, stepping in
        for lod, s in enumerate((24, 14, 10)):
            ms.cyl('in_plinth' if k % 2 else 'in_ochre', r, r * .95, .03 + .03 * k, at=(-.3, -.1, G), segs=s, lod=lod, only=(lod,), caps=k == 2)
    ms.cyl('dark', .35, .35, .005, at=(-.3, -.1, G + .095), segs=12, lod=1)
    ms.box('in_pad', (.12, 1.1, .006), at=(.8, -.1, G), rot_z=-20, lod=1)  # the haul road
    ri.truck(ms, .75, .25, yaw=160, load='in_ochre', lod=1)
    ri.truck(ms, -.3, .65, yaw=90, load='in_ochre', lod=1)
    ms.box('in_graphite', (.3, .3, .5), at=(1.2, .9, G), lod=2, taper=.8)  # the crusher plant
    ms.box('in_graphite', (.06, .8, .03), at=(.85, .7, G + .35), rot_z=40, lod=1)
    ms.sphere('in_ochre', .3, at=(1.3, 1.4, G - .02), scale=(1.2, 1, .5), u=8, v=4, cut_below=0.0, lod=2)
    return None


def outpost(ms, rng):
    for k, (x, y) in enumerate(((-.6, .4), (-.6, .25), (.5, .5))):
        ik.container(ms, x, y, 0, mat='in_panel' if k else 'in_cont_blue', lod=2)
    ik.dish(ms, .1, .4, r=.1)
    ik.landing_pad(ms, 0, -.5, r=.3)
    ik.pylon(ms, .9, -.2, h=.9, r=.04, rings=2)
    tt.pennant(ms, tm.house_frame(0, 0, 0), -.95, -.3, G + .55, yaw=-150, lod=1, w=.2, h=.12)
    ms.cyl('in_graphite', .012, .012, .55, at=(-.95, -.3, G), segs=4, lod=1)
    return (-.6, .4, .3)


# ---- ships ------------------------------------------------------------------------------------------

def warship(ms, rng):
    L, W = 2.4, .36
    hull = [(0, -L / 2), (W * .5, -L / 2 + .5), (W * .5, L / 2 - .05), (-W * .5, L / 2 - .05), (-W * .5, -L / 2 + .5)]
    prism(ms, 'in_graphite', hull, 0.0, .14, lod=2, shrink=.94)
    prism(ms, 'in_panel', [(-.14, -.25), (.14, -.25), (.15, .45), (-.15, .45)], .14, .38, lod=2, shrink=.75)  # the superstructure
    ms.box('in_graphite', (.08, .08, .3), at=(0, .05, .38), lod=1, taper=.5)  # the radar mast
    for k in range(2):
        ms.box('in_panel', (.16, .006, .1), at=(0, .05 + .04 * k, .5), rot_z=90 * k, lod=0)
    ms.box('team_cloth', (.30, .06, .05), at=(0, .4, .16), lod=1)
    ms.cyl('in_panel', .06, .05, .05, at=(0, -.75, .14), segs=8, lod=1)  # the bow gun
    ms.box('in_graphite', (.015, .2, .015), at=(0, -.88, .17), lod=0)
    for k in range(4):  # missile cells
        ms.box('in_plinth', (.18, .05, .01), at=(0, -.52 + .06 * k, .14), lod=0)
    ms.box('in_mark', (.28, .3, .002), at=(0, .9, .14), lod=0)  # the helicopter deck
    return None


IMPROVEMENTS = {'farm': farm, 'fishing_boats': fishing_boats, 'fort': fort, 'mine': mine}
SEEDS = {'farm': 9301, 'fishing_boats': 9302, 'fort': 9303, 'mine': 9304, 'outpost': 9305, 'warship': 9306}


def build(item, out_dir):
    if item in IMPROVEMENTS:
        name = '%s-information' % item
        ground = None if item == 'fishing_boats' else DISC
        counts = tt.build_file(name, [(name, ts.budgeted(IMPROVEMENTS[item]), ground)], out_dir, atlas=1024, seed=SEEDS[item])
        print('INFORMATION_BUILT', name, counts, flush=True)
    elif item == 'outpost':
        bms.with_socket('outpost-information', outpost, dict(rx=2.0, ry=1.85, square=None, power=3.0, mat='earth', n=32), out_dir, SEEDS[item], 'smoke',
                        budgets=(7600, 1400, 280))
    elif item == 'warship':
        name = 'warship-information'

        def run(ms, rng):
            warship(ms, rng)
            ts.on_ground(ms)
            for lod, b in zip((0, 1, 2), (11000, 2800, 380)):
                ts.trim(ms, lod, b)
            ts.on_ground(ms)
        counts = tt.build_file(name, [(name, run, None)], out_dir, atlas=1024, seed=SEEDS[item])
        print('INFORMATION_BUILT', name, counts, flush=True)


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out = os.path.abspath(argv[0])
    for it in (argv[1:] or list(IMPROVEMENTS) + ['outpost', 'warship']):
        build(it, out)
    sys.stdout.flush()
    os._exit(0)
