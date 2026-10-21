# scripts/blender/ti_information_kit.py
# The Information age's building kit (eight-ages plan U87 to U91) on the town kit (ti_town.py, ti_map.Mesher): today's
# buildings, between the Modern (20th-century) kit and the Future one: aluminium cladding and blue-green curtain-wall
# glass, concrete plinths, glass atria with skylights, rooftop plant, cell masts with antenna panels, square
# helipads, solar arrays, quadcopter drones, wheeled armour, thin warm LED strips (a bright flat colour: the atlas
# bakes no emission). Every material carries the `in_` prefix. The helpers keep the Future kit's names and
# arguments (ti_future_kit.py: dome, pod, pylon, landing_pad, solar_array, vtol, hover_tank_prop) so the Future
# layouts can be built again here in today's look: a `dome` is a glass atrium, a `pod` an office block, a `pylon`
# a cell mast, a `vtol` a drone, a `hover_tank_prop` an armoured vehicle on eight wheels.
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_modern as tmd  # noqa: E402
from ti_town import G  # noqa: E402

NEW = ['in_panel', 'in_panel_win', 'in_graphite', 'in_glass', 'in_glow', 'in_pad', 'in_solar', 'in_green', 'in_plinth', 'in_mark',
       'in_sand', 'in_sand_win', 'in_lacquer', 'in_brick', 'in_brick_win', 'in_ochre', 'in_ochre_win', 'in_cont_red', 'in_cont_blue']
for _n in NEW:
    if _n not in tt.PROC:
        tt.PROC.append(_n)

GLASS = ('#2c4a55', '#36596a', '#4a7486')


def make_materials():
    s = tm.mat_simple
    s('in_panel', ['#c6cbcf', '#d2d6d9', '#bcc1c5'], scale=10.0, stripes={'dir': 'Z', 'scale': 60.0, 'distortion': 0.1}, rough=0.4, bump=0.1)
    # the curtain wall: a tight grid of tall panes in slim aluminium mullions
    tmd.mat_facade('in_panel_win', tmd._wall_render(('#b9bfc4', '#c6cbcf')), cell_u=0.16, cell_z=tt.STOREY, win_w=0.14, z0=0.03, z1=0.4,
                   glass=GLASS, frame='#9aa2a8', frame_w=0.003, dirt=False, rough=0.35)
    s('in_graphite', ['#454a50', '#4f555b', '#3e4348'], scale=14.0, rough=0.5, bump=0.15)
    s('in_glass', list(GLASS), scale=6.0, rough=0.15, bump=0.0)
    s('in_glow', ['#f4eedc', '#fbf6e8'], scale=20.0, rough=0.3, bump=0.0)
    s('in_pad', ['#36393c', '#3e4144', '#323538'], scale=30.0, rough=0.75, bump=0.25)
    s('in_solar', ['#1a2a44', '#22355a', '#162238'], scale=8.0, stripes={'dir': 'X', 'scale': 120.0, 'distortion': 0.0}, rough=0.3, bump=0.1)
    s('in_green', ['#5a8a3c', '#6c9a46', '#4a7a34'], scale=60.0, bump=0.6)
    s('in_plinth', ['#a7a7a1', '#b4b4ae', '#9a9a94'], scale=16.0, rough=0.65, bump=0.25, dirt=True)
    s('in_mark', ['#ece6cc', '#f4eed6'], scale=30.0, bump=0.0)
    s('in_sand', ['#d6c09a', '#e0cca8', '#cab28c'], scale=12.0, rough=0.6, bump=0.15)
    tmd.mat_facade('in_sand_win', tmd._wall_render(('#d6c09a', '#e0cca8')), cell_u=0.24, cell_z=tt.STOREY, win_w=0.14, z0=0.1, z1=0.3,
                   glass=GLASS, frame='#a8977a', frame_w=0.004, dirt=False, rough=0.5)
    s('in_lacquer', ['#8a2c24', '#9c3429', '#782620'], scale=12.0, rough=0.4, bump=0.1)
    s('in_brick', ['#8e4a36', '#9c5640', '#7e4030'], scale=18.0, rough=0.7, bump=0.4)
    tmd.mat_facade('in_brick_win', tmd._wall_render(('#8e4a36', '#9c5640')), cell_u=0.2, cell_z=tt.STOREY, win_w=0.13, z0=0.08, z1=0.32,
                   glass=GLASS, frame='#d8d4c8', frame_w=0.004, dirt=False, rough=0.6)
    s('in_ochre', ['#c48a4a', '#d09a5a', '#b87c40'], scale=12.0, rough=0.6, bump=0.15)
    tmd.mat_facade('in_ochre_win', tmd._wall_render(('#c48a4a', '#d09a5a')), cell_u=0.22, cell_z=tt.STOREY, win_w=0.14, z0=0.1, z1=0.3,
                   glass=GLASS, frame='#f0e6d0', frame_w=0.004, dirt=False, rough=0.55)
    s('in_cont_red', ['#9a3424', '#a83c2a', '#8a2e20'], scale=10.0, stripes={'dir': 'Z', 'scale': 160.0, 'distortion': 0.0}, rough=0.5, bump=0.2)
    s('in_cont_blue', ['#2c5a8a', '#346698', '#28507c'], scale=10.0, stripes={'dir': 'Z', 'scale': 160.0, 'distortion': 0.0}, rough=0.5, bump=0.2)


if not any(n == 'information' for n, _ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('information', make_materials))


def dome(ms, x, y, r, h=None, mat='in_glass', ring='in_panel', glow=True, lod=2, segs=(16, 10, 8)):
    """A glass atrium of half size r: a clad base with a glazed band, under a hipped glass skylight (a
    greenhouse when `mat` is in_green)."""
    h = h or r * .8
    w = 2 * r * .9
    base = .05 + r * .45
    ms.box(ring, (w, w, base), at=(x, y, G), lod=lod)
    ms.box('in_glass', (w + .004, w + .004, base * .45), at=(x, y, G + base * .3), lod=1)
    ms.box(mat, (w * .96, w * .96, h * .55), at=(x, y, G + base), lod=lod, taper=.35)
    if glow:
        ms.box('in_glow', (w + .006, w + .006, .006), at=(x, y, G + base - .008), lod=0)


def pod(ms, x, y, w, d, h, yaw=0.0, mat='in_panel_win', lod=2):
    """An office block: a concrete plinth, the curtain-wall body, a parapet, rooftop plant and an entrance canopy."""
    f = tm.house_frame(x, y, yaw)
    ms.box('in_plinth', (w + .02, d + .02, .04), at=(0, 0, G), lod=lod, frame=f)
    ms.box(mat, (w, d, h), at=(0, 0, G + .04), lod=lod, frame=f)
    ms.box('in_panel', (w + .006, d + .006, .02), at=(0, 0, G + .04 + h), lod=1, frame=f)
    for k in range(max(1, int(w / .18))):  # rooftop plant
        ms.box('in_graphite', (.06, .05, .03), at=(-w / 2 + .07 + k * .16, d * .15, G + .06 + h), lod=0, frame=f)
    ms.box('in_panel', (min(.2, w * .6), .06, .012), at=(0, -d / 2 - .03, G + .1), lod=0, frame=f)
    ms.box('in_glow', (w * .5, .006, .006), at=(0, -d / 2 - .003, G + .055), lod=0, frame=f)
    return f


def pylon(ms, x, y, h=1.0, r=.07, rings=3, lod=2):
    """A cell mast: a tapering lattice mast on a concrete pad, antenna panels on platforms, a red light on top."""
    ms.box('in_plinth', (r * 3.6, r * 3.6, .04), at=(x, y, G), lod=lod)
    ms.box('in_graphite', (r * 1.1, r * 1.1, h), at=(x, y, G + .04), lod=lod, taper=.45)
    for k in range(rings):
        z = G + .04 + h * (.55 + .4 * k / max(1, rings))
        for j in range(3):
            a = 2 * math.pi * j / 3 + .3
            ms.box('in_panel', (.028, .014, .1), at=(x + math.cos(a) * r * .55, y + math.sin(a) * r * .55, z - .05), rot_z=math.degrees(a) + 90, lod=0 if k else 1)
    ms.box('in_cont_red', (.02, .02, .02), at=(x, y, G + .04 + h), lod=1)
    return (x, y, G + .04 + h + .02)


def landing_pad(ms, x, y, r=.34, lod=2):
    """A square helipad on a concrete deck: a painted circle, the H, edge lights."""
    ms.box('in_plinth', (r * 2.1, r * 2.1, .03), at=(x, y, G), lod=lod)
    ms.box('in_pad', (r * 1.9, r * 1.9, .006), at=(x, y, G + .03), lod=lod)
    ms.cyl('in_mark', r * .72, r * .72, .002, at=(x, y, G + .036), segs=16, lod=1, caps=False)
    ms.cyl('in_pad', r * .66, r * .66, .003, at=(x, y, G + .037), segs=16, lod=1)
    for sx in (-1, 1):
        ms.box('in_mark', (.03, r * .5, .002), at=(x + sx * r * .18, y, G + .04), lod=0)
    ms.box('in_mark', (r * .36, .03, .002), at=(x, y, G + .04), lod=0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('in_glow', (.02, .02, .012), at=(x + sx * r * .95, y + sy * r * .95, G + .03), lod=0)


def solar_array(ms, x, y, w=.5, d=.24, yaw=0.0, tilt=.06, lod=1):
    f = tm.house_frame(x, y, yaw)
    for sx in (-1, 1):
        ms.box('in_graphite', (.02, .02, .08), at=(sx * w * .4, 0, G), lod=lod, frame=f)
    ms.box('in_solar', (w, d, .015), at=(0, 0, G + .08), lod=lod, frame=f, taper=1.0)


def vtol(ms, x, y, yaw=0.0, s=1.0, lod=1):
    """A quadcopter drone parked on a pad: a body, four arms, four rotors, a camera pod."""
    f = tm.house_frame(x, y, yaw)
    ms.box('in_panel', (.12 * s, .16 * s, .05 * s), at=(0, 0, G + .03), lod=lod, frame=f, bevel=.012 * s)
    ms.box('in_graphite', (.04 * s, .04 * s, .03 * s), at=(0, -.09 * s, G + .02), lod=0, frame=f)
    for sx in (-1, 1):
        for sy in (-1, 1):
            ms.box('in_graphite', (.12 * s, .016 * s, .012 * s), at=(sx * .07 * s, sy * .07 * s, G + .06), rot_z=sx * sy * 45, lod=lod, frame=f)
            ms.cyl('in_graphite', .012 * s, .012 * s, .03 * s, at=(sx * .12 * s, sy * .12 * s, G + .05), segs=6, lod=0, frame=f)
            ms.cyl('in_glass', .06 * s, .06 * s, .003, at=(sx * .12 * s, sy * .12 * s, G + .085), segs=10, lod=0, frame=f, caps=False)


def hover_tank_prop(ms, x, y, yaw=0.0, lod=1):
    """A parked armoured vehicle (a building's prop): a sloped hull on eight wheels, a small turret, its gun."""
    f = tm.house_frame(x, y, yaw)
    ms.box('in_graphite', (.2, .40, .07), at=(0, 0, G + .04), lod=lod, frame=f, taper=.9)
    ms.box('in_graphite', (.11, .12, .04), at=(0, .04, G + .11), lod=lod, frame=f)
    ms.box('in_graphite', (.015, .18, .015), at=(0, -.1, G + .13), lod=0, frame=f)
    for sx in (-1, 1):
        for k in range(4):
            ms.cyl('dark', .03, .03, .03, at=(sx * .105, -.15 + .1 * k, G + .03), rot=(0, 90, 0), segs=8, lod=0, frame=f)


def container(ms, x, y, yaw=0.0, mat='in_cont_red', long=True, z=G, lod=1):
    """A shipping container (12 or 6 m) with its corrugation and door end."""
    f = tm.house_frame(x, y, yaw)
    L = .24 if long else .12
    ms.box(mat, (L, .05, .052), at=(0, 0, z), lod=lod, frame=f)
    ms.box('in_graphite', (.004, .046, .046), at=(L / 2 + .001, 0, z + .003), lod=0, frame=f)
    return z + .052


def dish(ms, x, y, r=.08, yaw=0.0, lod=1):
    """A satellite dish on a short post, tilted up."""
    f = tm.house_frame(x, y, yaw)
    ms.cyl('in_graphite', .012, .012, r * .9, at=(0, 0, G), segs=6, lod=lod, frame=f)
    ms.sphere('in_panel', r, at=(0, 0, G + r * 1.2), scale=(1, .35, 1), u=10, v=4, lod=lod, frame=f)
