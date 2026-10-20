# scripts/blender/ti_future_kit.py
# The Future age's building kit (eight-ages plan U87 to U91) on the town kit (ti_town.py, ti_map.Mesher): white
# composite panels with dark glazing bands, graphite plinths, tinted glass domes, landing pads with markings,
# shield pylons and solar arrays, thin cyan light lines (a bright flat colour: the atlas bakes no emission).
# Every material carries the `fu_` prefix; registered with ti_town like the other ages' kits.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_modern as tmd  # noqa: E402
from ti_town import G  # noqa: E402

NEW = ['fu_panel', 'fu_panel_win', 'fu_graphite', 'fu_glass', 'fu_glow', 'fu_pad', 'fu_solar', 'fu_green', 'fu_plinth', 'fu_mark']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)


def make_materials():
    s = tm.mat_simple
    s('fu_panel', ['#dfe3e6', '#e9ecee', '#d3d8dc'], scale=10.0, stripes={'dir': 'X', 'scale': 40.0, 'distortion': 0.1}, rough=0.45, bump=0.1)
    tmd.mat_facade('fu_panel_win', tmd._wall_render(('#dfe3e6', '#e9ecee')), cell_u=0.5, cell_z=tt.STOREY, win_w=0.48, z0=0.12, z1=0.24,
                   glass=('#18242e', '#22323f', '#3c5566'), frame='#b8bec4', frame_w=0.004, dirt=False, rough=0.4)
    s('fu_graphite', ['#3a3f45', '#444a51', '#33383e'], scale=14.0, rough=0.5, bump=0.15)
    s('fu_glass', ['#1e3442', '#284556', '#365a6e'], scale=6.0, rough=0.2, bump=0.0)
    s('fu_glow', ['#4fe0f0', '#6fe8f4'], scale=20.0, rough=0.3, bump=0.0)
    s('fu_pad', ['#2c3034', '#33383c', '#2a2d31'], scale=30.0, rough=0.7, bump=0.2)
    s('fu_solar', ['#1a2a44', '#22355a', '#162238'], scale=8.0, stripes={'dir': 'X', 'scale': 120.0, 'distortion': 0.0}, rough=0.3, bump=0.1)
    s('fu_green', ['#4f8a3a', '#64a044', '#3c7030'], scale=60.0, bump=0.6)
    s('fu_plinth', ['#8a9096', '#9aa0a6', '#7c8288'], scale=16.0, rough=0.6, bump=0.2)
    s('fu_mark', ['#e8e2c8', '#f0ead2'], scale=30.0, bump=0.0)


if not any(n == 'future' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('future', make_materials))


def dome(ms, x, y, r, h=None, mat='fu_glass', ring='fu_panel', glow=True, lod=2, segs=(16, 10, 8)):
    """A dome of radius r on a low ring wall, a glowing line round its foot."""
    h = h or r * .8
    for k, s in enumerate(segs):
        ms.cyl(ring, r, r, .05, at=(x, y, G), segs=s, lod=k, only=(k,))
        ms.sphere(mat, 1.0, at=(x, y, G + .05), scale=(r * .98, r * .98, h), u=s, v=max(3, s // 2), lod=k, only=(k,), cut_below=0.0)
    if glow:
        ms.cyl('fu_glow', r * 1.01, r * 1.01, .008, at=(x, y, G + .045), segs=segs[0], lod=0, caps=False)


def pod(ms, x, y, w, d, h, yaw=0.0, mat='fu_panel_win', lod=2):
    """A rounded-corner block (a habitation pod) with a dark glazing band and a graphite plinth."""
    f = tm.house_frame(x, y, yaw)
    ms.box('fu_plinth', (w + .02, d + .02, .04), at=(0, 0, G), lod=lod, frame=f)
    ms.box(mat, (w, d, h), at=(0, 0, G + .04), lod=lod, frame=f, bevel=min(w, d) * .18)
    ms.box('fu_graphite', (w * .9, d * .9, .02), at=(0, 0, G + .04 + h), lod=1, frame=f)
    ms.box('fu_glow', (w * .7, .006, .01), at=(0, -d / 2 - .003, G + .06), lod=0, frame=f)
    return f


def pylon(ms, x, y, h=1.0, r=.07, rings=3, lod=2):
    """A shield pylon: a tapering graphite mast on a plinth with glowing rings and an emitter on top."""
    ms.cyl('fu_plinth', r * 2.2, r * 2.0, .06, at=(x, y, G), segs=8, lod=lod)
    ms.cyl('fu_graphite', r, r * .55, h, at=(x, y, G + .06), segs=8, lod=lod)
    for k in range(rings):
        z = G + .06 + h * (k + 1) / (rings + 1)
        rr = r * (1 - .45 * (k + 1) / (rings + 1)) + .012
        ms.cyl('fu_glow', rr, rr, .02, at=(x, y, z), segs=8, lod=0 if k else 1)
    ms.sphere('fu_glow', r * .9, at=(x, y, G + .06 + h + r * .3), u=8, v=4, lod=1)
    return (x, y, G + .06 + h + r)


def landing_pad(ms, x, y, r=.34, lod=2):
    """A round landing pad on a low plinth, a pale H-ring marking and glowing edge lights."""
    ms.cyl('fu_plinth', r * 1.05, r * 1.05, .03, at=(x, y, G), segs=16, lod=1)
    ms.cyl('fu_pad', r, r, .006, at=(x, y, G + .03), segs=16, lod=1)
    if lod >= 2:  # the far level: one low eight-sided disc
        ms.cyl('fu_pad', r * 1.05, r * 1.05, .036, at=(x, y, G), segs=8, lod=2, only=(2,))
    ms.cyl('fu_mark', r * .72, r * .72, .002, at=(x, y, G + .036), segs=16, lod=1, caps=False)
    ms.cyl('fu_pad', r * .66, r * .66, .003, at=(x, y, G + .037), segs=16, lod=1)
    for sx in (-1, 1):
        ms.box('fu_mark', (.03, r * .5, .002), at=(x + sx * r * .18, y, G + .04), lod=0)
    ms.box('fu_mark', (r * .36, .03, .002), at=(x, y, G + .04), lod=0)
    for k in range(8):
        a = 2 * math.pi * k / 8
        ms.box('fu_glow', (.02, .02, .012), at=(x + math.cos(a) * r, y + math.sin(a) * r, G + .03), lod=0)


def solar_array(ms, x, y, w=.5, d=.24, yaw=0.0, tilt=.06, lod=1):
    f = tm.house_frame(x, y, yaw)
    for sx in (-1, 1):
        ms.box('fu_graphite', (.02, .02, .08), at=(sx * w * .4, 0, G), lod=lod, frame=f)
    ms.box('fu_solar', (w, d, .015), at=(0, 0, G + .08), lod=lod, frame=f, taper=1.0)


def vtol(ms, x, y, yaw=0.0, s=1.0, lod=1):
    """A small tilt-rotor transport parked on a pad: a fuselage, a high wing, two rotor pods."""
    f = tm.house_frame(x, y, yaw)
    ms.box('fu_panel', (.10 * s, .42 * s, .08 * s), at=(0, 0, G + .05), lod=lod, frame=f, bevel=.02 * s)
    ms.box('fu_glass', (.07 * s, .08 * s, .03 * s), at=(0, -.16 * s, G + .12), lod=0, frame=f)
    ms.box('fu_panel', (.46 * s, .07 * s, .015 * s), at=(0, .02 * s, G + .14), lod=lod, frame=f)
    for sx in (-1, 1):
        ms.cyl('fu_graphite', .035 * s, .035 * s, .08 * s, at=(sx * .23 * s, .02 * s, G + .10), segs=8, lod=lod, frame=f)
        ms.cyl('fu_glow', .07 * s, .07 * s, .004, at=(sx * .23 * s, .02 * s, G + .19), segs=10, lod=0, frame=f, caps=False)
    ms.box('fu_panel', (.14 * s, .05 * s, .07 * s), at=(0, .20 * s, G + .10), lod=0, frame=f)


def hover_tank_prop(ms, x, y, yaw=0.0, lod=1):
    """A parked hover tank (a building's prop): the wedge hull on four pods, a flat turret, the twin rails."""
    f = tm.house_frame(x, y, yaw)
    ms.box('fu_graphite', (.22, .40, .06), at=(0, 0, G + .03), lod=lod, frame=f, taper=.85)
    ms.box('fu_panel', (.14, .16, .04), at=(0, .04, G + .09), lod=lod, frame=f)
    ms.box('fu_graphite', (.02, .22, .015), at=(0, -.18, G + .11), lod=0, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.cyl('fu_glow', .03, .03, .006, at=(sx * .10, sy * .14, G + .002), segs=6, lod=0, frame=f)
