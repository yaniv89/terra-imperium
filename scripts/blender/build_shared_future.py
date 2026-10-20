# scripts/blender/build_shared_future.py
# The Future shared map file (eight-ages plan U90; the same objects as shared-modern.glb): the town hall
# `palace-small`, the assembly `palace`, the shield rings `walls-small`, `walls-medium`, `walls-big` (the Modern
# rings' radii and gate gaps), the outpost `colony-camp` and the fields `field-1` (hydroponic beds), `field-2`
# (greenhouse tunnels), `field-3` (algae pools), `field-4` (a vertical farm frame), on the Future kit
# (ti_future_kit.py), in one GLB with one atlas.
#   blender -b --factory-startup -P scripts/blender/build_shared_future.py -- <out_dir> [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_modern as md  # noqa: E402,F401 (the md_ ground materials)
import ti_future_kit as fk  # noqa: E402
from ti_town import G, STOREY  # noqa: E402


def palace_small(ms, rng):
    """`palace-small`, the town hall (9.5 m wide): a glass dome on a white drum between two low white pods, a
    forecourt pad with light lines, a slim spire, two Team banners."""
    f = tm.house_frame(0, .05, 0)
    ms.box('fu_plinth', (.95, .75, .04), at=(0, 0, G), lod=2, frame=f)
    for k, s in enumerate((16, 10, 8)):
        ms.cyl('fu_panel_win', .26, .26, .26, at=(0, .08, G + .04), segs=s, lod=k, only=(k,), frame=f)
        ms.sphere('fu_glass', 1.0, at=(0, .08, G + .30), scale=(.25, .25, .2), u=s, v=max(4, s // 2), lod=k, only=(k,), cut_below=0.0, frame=f)
    for sx in (-1, 1):
        ms.box('fu_panel_win', (.26, .40, .22), at=(sx * .34, .1, G + .04), lod=2, frame=f, bevel=.04)
        ms.box('team_cloth', (.06, .006, .14), at=(sx * .18, -.33, G + .1), lod=1, frame=f)
    ms.cyl('fu_graphite', .015, .005, .45, at=(0, .08, G + .48), segs=6, lod=1, frame=f)
    ms.box('fu_glow', (.6, .006, .008), at=(0, -.30, G + .045), lod=0, frame=f)


def palace(ms, rng):
    """`palace`, the assembly (13.4 m wide): a large glass dome on a drum with light rings, two long white
    wings, a spire, a broad forecourt with steps and light lines, Team banners."""
    f = tm.house_frame(0, .1, 0)
    ms.box('fu_plinth', (1.34, 1.0, .06), at=(0, 0, G), lod=2, frame=f)
    for k, s in enumerate((20, 12, 8)):
        ms.cyl('fu_panel_win', .36, .36, .34, at=(0, .12, G + .06), segs=s, lod=k, only=(k,), frame=f)
        ms.sphere('fu_glass', 1.0, at=(0, .12, G + .40), scale=(.35, .35, .3), u=s, v=max(4, s // 2), lod=k, only=(k,), cut_below=0.0, frame=f)
    ms.cyl('fu_glow', .362, .362, .012, at=(0, .12, G + .40), segs=20, lod=0, caps=False, frame=f)
    for sx in (-1, 1):
        ms.box('fu_panel_win', (.36, .56, .30), at=(sx * .48, .12, G + .06), lod=2, frame=f, bevel=.05)
        ms.box('fu_glow', (.362, .566, .01), at=(sx * .48, .12, G + .33), lod=0, frame=f)
        ms.box('team_cloth', (.07, .006, .18), at=(sx * .22, -.42, G + .12), lod=1, frame=f)
    ms.cyl('fu_graphite', .02, .006, .6, at=(0, .12, G + .70), segs=6, lod=1, frame=f)
    for k in range(3):
        ms.box('fu_plinth', (.5 - .08 * k, .05, .02), at=(0, -.46 + .05 * k, G + .02 * k), lod=1, frame=f)


def shield_ring(ms, rng, R_in, R_out, h, gate_w, pylons):
    """A shield ring: a low white composite wall on a graphite footing round the town (open at the south for
    `gate_w`), a glowing line along its top, shield pylons at `pylons` (degrees) and two at the gate."""
    r = (R_in + R_out) / 2
    t = (R_out - R_in) * .4
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
            if lod < 2:
                ms.box('fu_graphite', (seg * 1.01, t * 1.4, .03), at=(x, y, G), rot_z=a + 90, lod=lod)
                only(lod)
            ms.box('fu_panel', (seg * 1.01, t, h), at=(x, y, G + (.03 if lod < 2 else 0)), rot_z=a + 90, lod=lod)
            only(lod)
            if lod == 0:
                ms.box('fu_glow', (seg * 1.01, t + .004, .01), at=(x, y, G + .03 + h - .02), rot_z=a + 90, lod=0)
    for a in list(pylons) + [-90 - gate - 2, -90 + gate + 2]:
        ar = math.radians(a)
        fk.pylon(ms, r * math.cos(ar), r * math.sin(ar), h=h * 2.6, r=.05, rings=2, lod=1)


def walls_small(ms, rng):
    shield_ring(ms, rng, 1.9, 2.15, .12, .4, (45, 135, 225, 315))


def walls_medium(ms, rng):
    shield_ring(ms, rng, 2.9, 3.3, .14, .5, (0, 60, 120, 180, 237, 303))


def walls_big(ms, rng):
    shield_ring(ms, rng, 3.9, 4.4, .16, .6, (0, 45, 90, 135, 180, 232, 308))


def colony_camp(ms, rng):
    """`colony-camp` (18 by 16 m): two pods, a dome, a landing pad, a comms mast, cargo, the team flag."""
    fk.pod(ms, 0, .42, .42, .26, .16)
    fk.dome(ms, -.5, .02, .2)
    fk.pod(ms, .5, .05, .26, .36, .14, yaw=90)
    fk.landing_pad(ms, 0, -.3, r=.22)
    ms.cyl('fu_graphite', .01, .005, .45, at=(.6, .55, G), segs=4, lod=1)
    for k in range(3):
        ms.box('fu_panel', (.07, .07, .06), at=(-.62 + .08 * k, -.5, G), lod=0, bevel=.008)
    ms.cyl('fu_graphite', .008, .008, .4, at=(-.3, -.6, G), segs=4, lod=1)
    tt.pennant(ms, tm.house_frame(0, 0, 0), -.3, -.6, G + .4, yaw=-150, lod=1, w=.16, h=.1)


def field_1(ms, rng):
    """`field-1` (16 by 12 m): six long hydroponic beds under light rails."""
    for i in range(6):
        y = .43 - .165 * i
        ms.box('fu_plinth', (1.48, .14, .03), at=(0, y, G), lod=1)
        ms.box('fu_green', (1.44, .11, .03), at=(0, y, G + .03), lod=1)
        ms.box('fu_glow', (1.44, .01, .006), at=(0, y, G + .09), lod=0)
    ms.box('fu_green', (1.5, 1.0, .05), at=(0, 0, G), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def field_2(ms, rng):
    """`field-2`: four greenhouse tunnels of tinted glass over green beds."""
    for i in range(4):
        x = -.54 + .36 * i
        f = tm.house_frame(x, 0, 0)
        ms.box('fu_green', (.26, 1.0, .02), at=(0, 0, G), lod=1, frame=f)
        ms.cyl('fu_glass', .13, .13, 1.0, at=(0, -.5, G + .01), rot=(-90, 0, 0), segs=8, lod=1, frame=f)
    ms.box('fu_glass', (1.4, 1.0, .12), at=(0, 0, G), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def field_3(ms, rng):
    """`field-3`: three round algae pools with white rims and a pump pod."""
    for k, (x, y) in enumerate(((-.45, .15), (.1, .2), (.52, -.15))):
        ms.cyl('fu_panel', .26, .26, .04, at=(x, y, G), segs=12, lod=1)
        ms.cyl('fu_green', .23, .23, .045, at=(x, y, G), segs=12, lod=1)
    fk.pod(ms, -.1, -.35, .24, .16, .1)
    ms.box('fu_green', (1.4, .9, .04), at=(0, 0, G), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def field_4(ms, rng):
    """`field-4`: a vertical farm frame of four green tiers on graphite posts, solar panels on top."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('fu_graphite', (.03, .03, .5), at=(sx * .6, sy * .3, G), lod=1)
    for k in range(4):
        ms.box('fu_green', (1.2, .6, .02), at=(0, 0, G + .08 + .12 * k), lod=1 if k % 2 else 0)
    ms.box('fu_solar', (1.24, .64, .015), at=(0, 0, G + .52), lod=2)


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
    ('field-4', field_4, dict(tb.FIELD_GROUND, rx=.84, ry=.64, mat='md_tilled')),
]

if __name__ == '__main__':
    tt.main_file('shared-future', ITEMS)
