# scripts/blender/build_shared_information.py
# The Information shared map file (eight-ages plan U90; the same objects as shared-modern.glb): the city hall
# `palace-small`, the parliament `palace` (a glass dome over a stone-clad hall), the security rings `walls-small`,
# `walls-medium`, `walls-big` (a steel fence on a concrete footing with barrier blocks and camera posts, at the Modern
# rings' radii and gate gaps), the outpost `colony-camp` (a container camp) and the fields `field-1` (crop rows),
# `field-2` (polytunnels), `field-3` (an orchard), `field-4` (a centre-pivot circle), on today's kit
# (ti_information_kit.py), in one GLB with one atlas.
#   blender -b --factory-startup -P scripts/blender/build_shared_information.py -- <out_dir> [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_modern as md  # noqa: E402,F401 (the md_ ground and crop materials)
import ti_information_kit as ik  # noqa: E402
from ti_town import G  # noqa: E402


def palace_small(ms, rng):
    """`palace-small`, the city hall (9.5 m wide): a glass and clad block on a plinth, a canopy, two flag poles."""
    f = tm.house_frame(0, .05, 0)
    ms.box('in_plinth', (.95, .75, .04), at=(0, 0, G), lod=2, frame=f)
    ms.box('in_panel_win', (.8, .5, .34), at=(0, .1, G + .04), lod=2, frame=f)
    ms.box('in_panel', (.82, .52, .025), at=(0, .1, G + .38), lod=1, frame=f)
    ms.box('in_panel', (.3, .1, .015), at=(0, -.2, G + .14), lod=1, frame=f)
    for sx in (-1, 1):
        ms.cyl('in_graphite', .008, .006, .5, at=(sx * .3, -.32, G), segs=4, lod=1, frame=f)
        ms.box('team_cloth', (.1, .006, .07), at=(sx * .3 + .05, -.32, G + .42), lod=1, frame=f)
    ms.box('in_glow', (.6, .006, .008), at=(0, -.152, G + .06), lod=0, frame=f)


def palace(ms, rng):
    """`palace`, the parliament (13.4 m wide): a stone-clad hall with a colonnade, a glass dome on its roof, two
    glass wings, broad steps, flags."""
    f = tm.house_frame(0, .1, 0)
    ms.box('in_plinth', (1.34, 1.0, .06), at=(0, 0, G), lod=2, frame=f)
    ms.box('in_panel', (.7, .6, .36), at=(0, .12, G + .06), lod=2, frame=f)
    for k in range(6):  # the colonnade
        ms.box('in_panel', (.04, .04, .3), at=(-.25 + .1 * k, -.2, G + .06), lod=1, frame=f)
    ms.box('in_panel', (.6, .08, .04), at=(0, -.2, G + .36), lod=1, frame=f)
    for k, s in enumerate((20, 12, 8)):
        ms.sphere('in_glass', 1.0, at=(0, .12, G + .42), scale=(.24, .24, .2), u=s, v=max(4, s // 2), lod=k, only=(k,), cut_below=0.0, frame=f)
    for sx in (-1, 1):
        ms.box('in_panel_win', (.3, .52, .26), at=(sx * .5, .12, G + .06), lod=2, frame=f)
        ms.box('team_cloth', (.07, .006, .16), at=(sx * .2, -.42, G + .12), lod=1, frame=f)
    for k in range(3):
        ms.box('in_plinth', (.5 - .08 * k, .05, .02), at=(0, -.46 + .05 * k, G + .02 * k), lod=1, frame=f)


def security_ring(ms, rng, R_in, R_out, h, gate_w, posts):
    """A security ring: a steel mesh fence on a concrete footing round the town (open at the south for `gate_w`),
    concrete barrier blocks before it, camera posts at `posts` (degrees) and a barrier gate."""
    r = (R_in + R_out) / 2
    gate = math.degrees(gate_w / r) / 2
    a0, a1 = -90 + gate, 270 - gate

    def only(lod):  # this level's segments only (the plain lower levels stand in for the detailed one)
        bm, mat, _lod, _only = ms.parts[-1]
        ms.parts[-1] = (bm, mat, lod, (lod,))
    for lod, step in ((0, 4.0), (1, 8.0), (2, 15.0)):
        m = int(round((a1 - a0) / step))
        for k in range(m):
            a = a0 + (a1 - a0) * (k + .5) / m
            ar = math.radians(a)
            seg = 2 * math.pi * r * (a1 - a0) / 360 / m
            x, y = r * math.cos(ar), r * math.sin(ar)
            ms.box('in_plinth', (seg * 1.01, .05, .04), at=(x, y, G), rot_z=a + 90, lod=lod)
            only(lod)
            if lod < 2:
                ms.box('in_graphite', (seg * 1.01, .006, h), at=(x, y, G + .04), rot_z=a + 90, lod=lod)
                only(lod)
            if lod == 0 and k % 3 == 0:  # a barrier block before the fence
                bx, by = (r + .1) * math.cos(ar), (r + .1) * math.sin(ar)
                ms.box('in_plinth', (.1, .05, .06), at=(bx, by, G), rot_z=a + 90, lod=0, taper=.7)
    for a in posts:
        ar = math.radians(a)
        x, y = r * math.cos(ar), r * math.sin(ar)
        ms.cyl('in_graphite', .012, .01, h * 2.4, at=(x, y, G), segs=5, lod=1)
        ms.box('in_panel', (.04, .03, .025), at=(x, y, G + h * 2.4), lod=0)
    for s in (-1, 1):  # the gate: two posts and a barrier arm
        ar = math.radians(-90 + s * (gate + 1))
        ms.box('in_panel', (.06, .06, h * 1.6), at=(r * math.cos(ar), r * math.sin(ar), G), lod=1)
    ms.box('in_cont_red', (gate_w * .9, .015, .015), at=(0, -r, G + h * .9), lod=0)


def walls_small(ms, rng):
    security_ring(ms, rng, 1.9, 2.15, .14, .4, (45, 135, 225, 315))


def walls_medium(ms, rng):
    security_ring(ms, rng, 2.9, 3.3, .16, .5, (0, 60, 120, 180, 237, 303))


def walls_big(ms, rng):
    security_ring(ms, rng, 3.9, 4.4, .18, .6, (0, 45, 90, 135, 180, 232, 308))


def colony_camp(ms, rng):
    """`colony-camp` (18 by 16 m): a container camp: accommodation containers, a stacked office, a dish, a cell
    mast, a generator, a parked truck, the team flag."""
    for k, (x, y) in enumerate(((-.45, .45), (-.45, .3), (.1, .5))):
        ik.container(ms, x, y, 0, mat='in_panel' if k else 'in_cont_blue', lod=2)
    z = ik.container(ms, .45, .1, 90, mat='in_panel', lod=2)
    ik.container(ms, .45, .1, 90, mat='in_panel', z=z)
    ik.dish(ms, -.1, .1, r=.08)
    ik.pylon(ms, .6, .55, h=.45, r=.03, rings=1)
    ms.box('in_graphite', (.12, .08, .08), at=(-.55, -.2, G), lod=1)
    for k in range(3):
        ms.box('in_panel', (.07, .07, .06), at=(-.62 + .08 * k, -.5, G), lod=0)
    ms.cyl('in_graphite', .008, .008, .4, at=(-.3, -.6, G), segs=4, lod=1)
    tt.pennant(ms, tm.house_frame(0, 0, 0), -.3, -.6, G + .4, yaw=-150, lod=1, w=.16, h=.1)


def field_1(ms, rng):
    """`field-1` (16 by 12 m): crop rows of a big field with a tractor track and an irrigation line."""
    for i in range(8):
        y = .44 - .125 * i
        ms.box('md_wheat' if i % 4 else 'md_veg', (1.48, .09, .03), at=(0, y, G), lod=1 if i % 2 else 0)
    ms.box('in_graphite', (.02, 1.0, .02), at=(.3, 0, G + .05), lod=0)
    ms.box('md_wheat', (1.5, 1.0, .03), at=(0, 0, G), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def field_2(ms, rng):
    """`field-2`: four polytunnels over green beds."""
    for i in range(4):
        x = -.54 + .36 * i
        f = tm.house_frame(x, 0, 0)
        ms.box('md_veg', (.26, 1.0, .02), at=(0, 0, G), lod=1, frame=f)
        ms.cyl('md_poly', .13, .13, 1.0, at=(0, -.5, G + .01), rot=(-90, 0, 0), segs=8, lod=1, frame=f)
    ms.box('md_poly', (1.4, 1.0, .12), at=(0, 0, G), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def field_3(ms, rng):
    """`field-3`: an orchard in rows on a drip line."""
    for i in range(4):
        for j in range(6):
            x, y = -.6 + .24 * j, -.36 + .24 * i
            ms.sphere('in_green', .08, at=(x, y, G + .1), scale=(1, 1, .9), u=6, v=4, lod=1 if (i + j) % 2 else 0)
            ms.cyl('in_graphite', .008, .008, .06, at=(x, y, G), segs=4, lod=0)
    ms.box('in_green', (1.4, .9, .1), at=(0, 0, G), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def field_4(ms, rng):
    """`field-4`: a centre-pivot circle of green crop with its irrigation arm on wheeled towers."""
    for k, s in enumerate((24, 14, 10)):
        ms.cyl('md_veg', .6, .6, .02, at=(0, 0, G), segs=s, lod=k, only=(k,))
    ms.cyl('in_graphite', .03, .03, .12, at=(0, 0, G), segs=6, lod=1)
    ms.box('in_graphite', (.6, .015, .015), at=(.3, 0, G + .1), lod=1)
    for k in range(3):
        ms.box('in_graphite', (.015, .03, .1), at=(.2 + .2 * k, 0, G), lod=0)


ITEMS = [
    ('palace-small', palace_small, None),
    ('palace', palace, None),
    ('walls-small', walls_small, None),
    ('walls-medium', walls_medium, None),
    ('walls-big', walls_big, None),
    ('colony-camp', colony_camp, dict(rx=.98, ry=.88, square=None, power=5, mat='grass')),
    ('field-1', field_1, dict(tb.FIELD_GROUND, rx=.84, ry=.64, mat='md_tilled')),
    ('field-2', field_2, dict(tb.FIELD_GROUND, rx=.84, ry=.64, mat='md_lawn')),
    ('field-3', field_3, dict(tb.FIELD_GROUND, rx=.84, ry=.64, mat='md_lawn')),
    ('field-4', field_4, dict(tb.FIELD_GROUND, rx=.84, ry=.64, mat='md_lawn')),
]

if __name__ == '__main__':
    tt.main_file('shared-information', ITEMS)
