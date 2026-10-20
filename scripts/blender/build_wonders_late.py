# scripts/blender/build_wonders_late.py
# The ten wonders of the eight-ages plan (U92: four Stone, three Information, three Future) for the map's close view,
# src/assets/map/wonders/<id>.glb, on ti_wonder.build (three tiers that only add parts, one bake, LOD0..LOD2 under
# tier1..tier3; 1 unit = 10 m, the front to -Y, at most 12 units across). The ids are the plan's (U29, U51, U69):
#   stonehenge            1 the inner horseshoe of five trilithons and the bluestones; 2 the sarsen circle with its
#                         lintels; 3 the bank and ditch, the avenue, the Heel Stone and round barrows
#   catalhoyuk            1 a block of flat-roofed mud-brick houses with roof hatches and ladders; 2 the block grown
#                         over a low mound; 3 the whole town on its mound, shrine rooms with bull horns, ovens, pens
#   walls_of_jericho      1 the great round stone tower with its inner stair; 2 a stretch of the stone wall and the
#                         rock-cut ditch; 3 the full ring wall round round houses and a spring
#   white_temple_of_uruk  1 the stepped mud-brick terrace (the Anu ziggurat); 2 the White Temple on top, whitewashed,
#                         with buttresses; 3 the stair ramps, a reed-hut court and a canal
#   world_wide_web        1 a server hall with cooling units; 2 a second hall, a fibre mast with antennas; 3 a field of
#                         satellite dishes and a glass head office
#   large_hadron_collider 1 the detector hall over its shaft; 2 the ring (a pale line with access buildings round
#                         it); 3 the control centre, cooling towers and a magnet hall
#   global_seed_vault     1 the concrete portal wedge with its light-art band; 2 the snow-capped mountain round it;
#                         3 the access road, a service building and solar panels
#   space_elevator        1 the anchor platform (a broad ring on piers) with its terminal; 2 the tether rising with
#                         climbers; 3 the support towers round it, docking arms and a landing pad
#   mars_colony           1 three habitat domes linked by tubes; 2 a greenhouse dome and solar fields; 3 the launch pad
#                         with a tall heavy rocket and its tower
#   arcology_prime        1 the broad terraced base; 2 the stepped middle with garden terraces; 3 the crown with the spire
#   blender -b --factory-startup -P scripts/blender/build_wonders_late.py -- <out_dir> <id> [atlas]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402,F401
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402,F401
import ti_modern as tmd  # noqa: E402,F401 (md_ materials)
import ti_future_kit as fk  # noqa: E402 (fu_ materials)
import build_town_stone as bs  # noqa: E402,F401 (st_ materials)
import ti_wonder as tw  # noqa: E402
from ti_town import G  # noqa: E402


def ring(n, r, a0=0.0):
    return [(r * math.cos(math.radians(a0 + 360 * k / n)), r * math.sin(math.radians(a0 + 360 * k / n)), a0 + 360 * k / n) for k in range(n)]


def disc(ms, mat, r, h, x=0, y=0, z=G, segs=(32, 16, 10), lod_top=2):
    for k, s in enumerate(segs):
        ms.cyl(mat, r, r, h, at=(x, y, z), segs=s, lod=k, only=(k,))


def tree(ms, x, y, h=.5, r=.14):
    ms.cyl('timber', .015, .012, h * .5, at=(x, y, G), segs=5, lod=0)
    ms.sphere('st_turf', r, at=(x, y, G + h * .6), scale=(1, 1, .9), u=6, v=4, lod=1)


# ---- Stone ---------------------------------------------------------------------------------------

def stonehenge_1(ms, rng):
    disc(ms, 'st_turf', 1.9, .01)
    for k, a in enumerate((-60, -30, 0, 30, 60)):  # the horseshoe of trilithons, open to the north-east
        ar = math.radians(a - 90 + 180)
        x, y = .75 * math.cos(ar), .75 * math.sin(ar)
        h = .62 if k == 2 else .5
        f = tm.house_frame(x, y, a)
        for s in (-1, 1):
            ms.box('stone', (.09, .11, h), at=(s * .07, 0, G), lod=2, frame=f, taper=.85)
        ms.box('stone', (.28, .11, .06), at=(0, 0, G + h), lod=1, frame=f)
    for x, y, a in ring(19, .55, 90):  # the bluestones
        if math.sin(math.radians(a)) > .55:
            continue
        ms.box('st_pebble', (.04, .04, .18), at=(x, y, G), rot_z=a, lod=0, taper=.7)


def stonehenge_2(ms, rng):
    for x, y, a in ring(30, 1.45, 4):  # the sarsen circle and its lintel ring
        ms.box('stone', (.13, .1, .42), at=(x, y, G), rot_z=a + 90, lod=2, taper=.92)
        ms.box('stone', (.31, .1, .06), at=(x * 1.0, y * 1.0, G + .42), rot_z=a + 96, lod=1)


def stonehenge_3(ms, rng):
    for lod, segs in ((0, 64), (1, 32), (2, 16)):  # the bank and the ditch
        for r, h, mat in ((3.9, .08, 'st_turf'), (3.6, .02, 'mudwall_bare')):
            ms.cyl(mat, r, r - .25, h, at=(0, 0, G), segs=segs, lod=lod, only=(lod,), caps=False)
    for k in range(4):  # the avenue (within the wonder's 60 m radius)
        for s in (-1, 1):
            ms.box('st_turf', (.08, .5, .05), at=(s * .35, -4.0 - .5 * k, G), lod=1)
    ms.box('stone', (.14, .12, .5), at=(.2, -2.9, G), lod=2, taper=.8)  # the Heel Stone
    for x, y in ((3.0, 3.6), (-3.2, 3.4), (4.2, -1.0), (-4.3, -1.6)):
        ms.sphere('st_turf', .4, at=(x, y, G), scale=(1, 1, .4), u=10, v=4, lod=2, cut_below=0.0)


def catal_house(ms, rng, x, y, w, d, h, horns=False):
    f = tm.house_frame(x, y, 0)
    ms.box('st_clay' if rng.random() < .6 else 'mudwall_bare', (w, d, h), at=(0, 0, G), lod=2, frame=f)
    ms.box('dark', (.06, .06, .004), at=(w * .2, d * .1, G + h), lod=0, frame=f)
    ms.box('timber', (.012, .012, .18), at=(w * .2, d * .1, G + h), lod=0, frame=f)
    if horns:
        for s in (-1, 1):
            ms.cyl('st_bone', .012, .004, .1, at=(s * .05, -d / 2, G + h), rot=(-30, s * 30, 0), segs=4, lod=0, frame=f)


def catal_block(ms, rng, x0, y0, cols, rows, horns_every=7, base=0.0):
    k = 0
    for i in range(cols):
        for j in range(rows):
            w, d = .36 + rng.uniform(-.04, .04), .36 + rng.uniform(-.04, .04)
            h = .2 + rng.uniform(-.03, .05)
            catal_house(ms, rng, x0 + i * .4, y0 + j * .4, w, d, h + base, horns=(k % horns_every == 3))
            k += 1


def catal_1(ms, rng):
    disc(ms, 'mudwall_bare', 1.4, .02)
    catal_block(ms, rng, -.6, -.6, 4, 4)


def catal_2(ms, rng):
    """The mound (21 m high at the real site, here 6 m over 60 m) with the houses stepping up its slope."""
    for k, s in enumerate((24, 14, 10)):
        ms.sphere('mudwall_bare', 1.0, at=(0, 0, G - .05), scale=(4.4, 3.6, .65), u=s, v=max(4, s // 3), lod=k, only=(k,), cut_below=0.0)
    for ring_r, n, z in ((3.4, 22, .14), (2.6, 16, .36), (1.8, 11, .52)):
        for k in range(n):
            a = 2 * math.pi * k / n + rng.uniform(-.05, .05)
            x, y = ring_r * math.cos(a) * 1.2, ring_r * math.sin(a)
            if abs(x) < .9 and y < -1.0:
                continue
            catal_house(ms, rng, x, y, .34, .34, .2 + z, horns=(k % 6 == 2))


def catal_3(ms, rng):
    catal_block(ms, rng, -.6, 1.0, 4, 3)
    catal_block(ms, rng, -.6, -1.8, 4, 2)
    for x, y in ((-3.0, -2.2), (3.0, 2.0), (3.2, -2.4)):  # ovens and pens round the foot of the mound
        ms.sphere('st_clay', .1, at=(x, y, G), u=8, v=4, lod=1, cut_below=0.0)
        for k in range(8):
            a = math.radians(45 * k)
            ms.cyl('st_stake', .008, .008, .1, at=(x + .4 + .25 * math.cos(a), y + .25 * math.sin(a), G), segs=4, lod=0)


def jericho_1(ms, rng):
    disc(ms, 'mudwall_bare', 1.2, .02)
    for k, s in enumerate((20, 12, 8)):  # the tower: 9 m across, 8.5 m tall (raised 1.3x)
        ms.cyl('stone', .45, .40, 1.1, at=(0, .3, G), segs=s, lod=k, only=(k,))
    ms.box('dark', (.12, .02, .16), at=(0, -.12, G), lod=0)
    ms.cyl('st_pebble', .41, .41, .03, at=(0, .3, G + 1.1), segs=16, lod=1)


def jericho_wall_arc(ms, a0, a1, r=3.4, h=.55, step=6.0):
    for lod, st in ((0, step), (1, step * 2), (2, step * 4)):
        m = max(1, int(round((a1 - a0) / st)))
        for k in range(m):
            a = a0 + (a1 - a0) * (k + .5) / m
            ar = math.radians(a)
            seg = 2 * math.pi * r * (a1 - a0) / 360 / m * 1.02
            ms.box('stone', (seg, .28, h), at=(r * math.cos(ar), r * math.sin(ar), G), rot_z=a + 90, lod=lod)
            ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], lod, (lod,))
            ms.box('dark', (seg, .3, .01), at=(r * 1.09 * math.cos(ar), r * 1.09 * math.sin(ar), G - .005), rot_z=a + 90, lod=lod)
            ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], lod, (lod,))


def jericho_2(ms, rng):
    jericho_wall_arc(ms, 40, 140)


def jericho_3(ms, rng):
    jericho_wall_arc(ms, 140, 400 - 12)
    for k in range(16):
        a, rr = rng.uniform(0, 2 * math.pi), rng.uniform(1.0, 2.8)
        x, y = rr * math.cos(a), rr * math.sin(a)
        if abs(x) < .7 and -0.3 < y < 1.0:
            continue
        ms.cyl('st_clay', .2, .2, .16, at=(x, y, G), segs=8, lod=1)
        ms.cyl('thatch', .22, .04, .14, at=(x, y, G + .16), segs=8, lod=1)
    ms.cyl('dark', .3, .3, .01, at=(-1.6, -1.6, G), segs=10, lod=1)  # the spring


def uruk_1(ms, rng):
    disc(ms, 'mudwall_bare', 3.0, .02)
    for k, (w, h) in enumerate(((4.4, .35), (3.6, .35), (2.8, .3))):  # the Anu terrace in three buttressed steps
        z = G + .35 * k
        ms.box('mudwall', (w, w * .8, h), at=(0, .3, z), lod=2, bevel=.03, taper=.97)
        n = int(w / .3)
        for i in range(n):  # the buttresses along the front and the sides
            ms.box('mudwall', (.08, .06, h * .95), at=(-w / 2 + .15 + i * (w - .3) / max(1, n - 1), .3 - w * .4 - .03, z), lod=0)
        for sx in (-1, 1):
            for i in range(int(w * .8 / .3)):
                ms.box('mudwall', (.06, .08, h * .95), at=(sx * (w / 2 + .03), .3 - w * .4 + .15 + i * .3, z), lod=0)


def uruk_2(ms, rng):
    """The White Temple: whitewashed, niched and buttressed, a bent-axis door, a corner stair tower."""
    z = G + 1.0
    ms.box('limewash', (2.2, 1.3, .6), at=(0, .4, z), lod=2)
    for k in range(11):  # the buttresses and niches all round
        ms.box('limewash', (.09, .05, .6), at=(-1.0 + .2 * k, -.27, z), lod=0)
        ms.box('limewash', (.09, .05, .6), at=(-1.0 + .2 * k, 1.07, z), lod=0)
    for k in range(6):
        for sx in (-1, 1):
            ms.box('limewash', (.05, .09, .6), at=(sx * 1.12, -.1 + .2 * k, z), lod=0)
    ms.box('dark', (.2, .02, .3), at=(.4, -.26, z), lod=0)
    ms.box('limewash', (2.26, 1.36, .05), at=(0, .4, z + .6), lod=1)
    ms.box('limewash', (.4, .4, .9), at=(-.85, .9, z), lod=1)
    ms.box('team_cloth', (.3, .01, .14), at=(0, -.27, z + .4), lod=1)


def uruk_3(ms, rng):
    for k in range(10):  # the stair ramp up the front
        ms.box('mudwall_bare', (.5, .3, .1 * (k + 1)), at=(0, -2.0 + .3 * k, G), lod=1 if k % 2 else 0)
    ms.box('mudwall_bare', (.5, 3.0, .05), at=(0, -.6, G), lod=2, taper=1.0)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)
    for k in range(8):
        x = -4.2 + 1.2 * k
        if abs(x) < 2.6:
            continue
        for y in (-3.0, -4.0):
            ms.box('reed', (.5, .3, .22), at=(x, y, G), lod=1, taper=.8)
    ms.box('water', (11.0, .4, .01), at=(0, -5.2, G - .005), lod=2)
    for k in range(14):  # date palms along the canal
        tree(ms, -5.0 + .75 * k, -4.7, h=.6, r=.12)


# ---- Information ------------------------------------------------------------------------------------

def hall(ms, x, y, w, d, h, mat='md_render_win', roof='md_roof'):
    f = tm.house_frame(x, y, 0)
    ms.box(mat, (w, d, h), at=(0, 0, G), lod=2, frame=f)
    ms.box(roof, (w + .04, d + .04, .03), at=(0, 0, G + h), lod=1, frame=f)
    return f


def www_1(ms, rng):
    disc(ms, 'md_asphalt', 2.0, .01)
    hall(ms, 0, .4, 2.2, 1.0, .4, mat='md_concrete')
    for k in range(6):
        ms.box('md_steel', (.25, .25, .1), at=(-.9 + .36 * k, .4, G + .43), lod=1)
        ms.cyl('md_pipe', .09, .09, .02, at=(-.9 + .36 * k, .4, G + .53), segs=10, lod=0)
    ms.box('md_glass', (.6, .02, .2), at=(0, -.105, G + .1), lod=0)


def www_2(ms, rng):
    hall(ms, 0, -1.2, 2.2, .9, .36, mat='md_concrete')
    hall(ms, -2.6, -.4, 1.2, 1.8, .36, mat='md_concrete')
    for k in range(4):  # cooling towers
        ms.cyl('md_concrete', .22, .16, .5, at=(2.6, -1.8 + .55 * k, G), segs=12, lod=1, caps=False)
    ms.cyl('md_steel', .05, .02, 2.0, at=(1.8, .4, G), segs=6, lod=2)
    for k in range(3):
        ms.box('md_steel', (.03, .2, .12), at=(1.8, .4, G + 1.2 + .25 * k), lod=0)
    for k in range(5):
        ms.box('md_pipe', (.04, 1.6, .02), at=(-1.4 + .1 * k, -.4, G), lod=0)
    ms.box('md_asphalt', (2.0, 1.0, .01), at=(.4, -2.8, G), lod=2)
    for k in range(10):
        ms.box('md_marking', (.01, .2, .002), at=(-.5 + .2 * k, -2.8, G + .011), lod=0)
    for x in (-3.6, -3.0, 3.4, 3.8):
        tree(ms, x, -3.2, h=.5)


def www_3(ms, rng):
    for k in range(6):  # the dish field
        x, y = -3.4 + (k % 3) * .9, 1.8 + (k // 3) * .9
        ms.cyl('md_concrete', .08, .08, .2, at=(x, y, G), segs=8, lod=1)
        ms.sphere('md_render', .35, at=(x, y, G + .5), scale=(1, 1, .35), u=12, v=4, lod=1, cut_below=0.0)
    f = tm.house_frame(2.8, -2.4, 0)
    ms.box('md_glass', (.9, .7, 1.6), at=(0, 0, G), lod=2, frame=f)
    ms.box('team_cloth', (.4, .01, .1), at=(0, -.355, G + 1.4), lod=1, frame=f)


def lhc_1(ms, rng):
    disc(ms, 'md_concrete', 1.6, .01)
    f = hall(ms, 0, .3, 1.8, 1.0, .6, mat='md_prefab', roof='md_corrugated')
    for k, s in enumerate((16, 10, 8)):  # the detector, its end open to the front
        ms.cyl('md_steel', .45, .45, 1.0, at=(0, -.2, G + .5), rot=(90, 0, 0), segs=s, lod=k, only=(k,))
    for k in range(6):
        ms.box('team_cloth' if k % 3 == 0 else 'md_render', (.06, .02, .8), at=(-.3 + .12 * k, -.71, G + .1), lod=0)
    ms.cyl('md_steel', .25, .25, .4, at=(1.2, .2, G), segs=12, lod=1)
    ms.box('team_cloth', (.5, .01, .15), at=(0, -.205, G + .62), lod=1)


def lhc_2(ms, rng):
    for lod, segs in ((0, 96), (1, 48), (2, 24)):  # the ring marked on the ground
        ms.cyl('md_marking', 5.4, 5.4, .02, at=(0, 0, G), segs=segs, lod=lod, only=(lod,), caps=False)
    for x, y, a in ring(6, 5.4, 15):
        hall(ms, x, y, .5, .4, .25, mat='md_prefab', roof='md_corrugated')


def lhc_3(ms, rng):
    hall(ms, -2.4, -1.6, 1.4, .8, .5, mat='md_glass')
    for x, y in ((-3.6, 0), (-3.2, .8), (3.4, 1.2), (3.8, .4), (0, -3.6), (.8, -3.8)):
        tree(ms, x, y, h=.5)
    for x in (2.2, 2.8):
        ms.cyl('md_concrete', .3, .22, .9, at=(x, -1.8, G), segs=12, lod=2, caps=False)
    hall(ms, 0, 2.4, 2.4, .6, .4, mat='md_prefab', roof='md_corrugated')


def vault_1(ms, rng):
    f = tm.house_frame(0, -.6, 0)
    ms.box('md_concrete', (.7, 1.2, .9), at=(0, 0, G), lod=2, frame=f, taper=.6)
    ms.box('md_steel', (.3, .02, .4), at=(0, -.61, G), lod=1, frame=f)
    ms.box('fu_glow', (.5, .02, .2), at=(0, -.62, G + .55), lod=0, frame=f)


def vault_2(ms, rng):
    """The mountain round the vault: bare grey rock with a snow cap and scree, the portal in its north face."""
    for k, s in enumerate((24, 14, 10)):
        ms.sphere('stone', 1.0, at=(0, 2.0, G - .3), scale=(4.6, 3.4, 2.2), u=s, v=max(5, s // 2), lod=k, only=(k,), cut_below=0.12)
        ms.sphere('md_marking', 1.0, at=(0, 2.0, G - .3), scale=(2.4, 1.8, 2.24), u=s, v=max(5, s // 2), lod=k, only=(k,), cut_below=0.7)
    for k in range(12):  # scree and boulders at the foot
        a = math.radians(200 + 12 * k)
        tn_r = rng.uniform(.12, .25)
        ms.sphere('stone', tn_r, at=(4.0 * math.cos(a), 2.0 + 3.0 * math.sin(a), G), scale=(1, 1, .6), u=6, v=3, lod=0, cut_below=0.0)


def vault_3(ms, rng):
    ms.box('md_asphalt', (.5, 4.0, .02), at=(0, -3.0, G), lod=2)
    hall(ms, 1.6, -3.0, .8, .6, .3, mat='md_prefab', roof='md_corrugated')
    fk.solar_array(ms, -1.8, -3.2, w=1.2, d=.4)


# ---- Future -----------------------------------------------------------------------------------------

def elevator_1(ms, rng):
    disc(ms, 'fu_plinth', 2.4, .06)
    for x, y, a in ring(8, 2.0, 22.5):
        ms.cyl('fu_graphite', .12, .12, .4, at=(x, y, G + .06), segs=8, lod=1)
    for k, s in enumerate((32, 16, 10)):
        ms.cyl('fu_panel', 2.3, 2.1, .2, at=(0, 0, G + .46), segs=s, lod=k, only=(k,))
    ms.cyl('fu_glow', 2.31, 2.31, .02, at=(0, 0, G + .62), segs=32, lod=0, caps=False)
    fk.pod(ms, 0, -1.2, 1.0, .5, .3)


def elevator_2(ms, rng):
    ms.cyl('fu_graphite', .12, .05, 9.0, at=(0, 0, G + .66), segs=8, lod=2)
    for k in range(3):
        z = G + 2.0 + 2.5 * k
        ms.cyl('fu_panel', .3, .3, .25, at=(0, 0, z), segs=10, lod=1)
        ms.cyl('fu_glow', .31, .31, .03, at=(0, 0, z + .12), segs=10, lod=0, caps=False)


def elevator_3(ms, rng):
    for x, y, a in ring(4, 3.4, 45):
        fk.pylon(ms, x, y, h=2.2, r=.14, rings=4)
        ms.cyl('fu_graphite', .03, .03, math.hypot(x, y), at=(x, y, G + 2.1), rot=(0, 90, a + 180), segs=4, lod=1)
    fk.landing_pad(ms, 3.2, -3.2, r=.8)


def mars_1(ms, rng):
    disc(ms, 'fu_pad', 2.0, .01)
    for x, y in ((-.8, .4), (.8, .4), (0, -.6)):
        fk.dome(ms, x, y, .55)
    for (x0, y0), (x1, y1) in (((-.8, .4), (.8, .4)), ((-.8, .4), (0, -.6)), ((.8, .4), (0, -.6))):
        L = math.hypot(x1 - x0, y1 - y0)
        ms.box('fu_panel', (L, .1, .1), at=((x0 + x1) / 2, (y0 + y1) / 2, G), rot_z=math.degrees(math.atan2(y1 - y0, x1 - x0)), lod=1)


def mars_2(ms, rng):
    fk.dome(ms, -2.6, -2.0, .9, mat='fu_green')
    for k in range(3):
        fk.solar_array(ms, 2.4, -1.8 - .5 * k, w=1.4, d=.35)


def mars_3(ms, rng):
    disc(ms, 'fu_plinth', 1.1, .1, x=2.6, y=2.4)
    ms.cyl('fu_panel', .22, .22, 3.2, at=(2.6, 2.4, G + .1), segs=12, lod=2)
    ms.cyl('fu_panel', .22, .0, .5, at=(2.6, 2.4, G + 3.3), segs=12, lod=2)
    ms.box('team_cloth', (.2, .01, .5), at=(2.6, 2.17, G + 2.2), lod=1)
    for s in (-1, 1):
        ms.box('fu_graphite', (.12, .12, .5), at=(2.6 + s * .25, 2.4, G + .1), lod=1, taper=.6)
    ms.box('fu_graphite', (.25, .25, 3.0), at=(3.3, 2.4, G + .1), lod=2)
    for k in range(4):
        ms.box('fu_graphite', (.5, .04, .04), at=(3.0, 2.4, G + .8 + .7 * k), lod=0)


def arco_1(ms, rng):
    disc(ms, 'fu_pad', 4.2, .02)
    for k, (w, h) in enumerate(((7.0, .5), (6.0, .5))):
        ms.box('fu_panel_win', (w, w * .85, h), at=(0, 0, G + .02 + .5 * k), lod=2, bevel=.2)
        ms.box('fu_green', (w + .1, w * .85 + .1, .04), at=(0, 0, G + .02 + .5 * k + h - .04), lod=1)


def arco_2(ms, rng):
    for k, w in enumerate((5.0, 4.0, 3.2)):
        z = G + 1.02 + .55 * k
        ms.box('fu_panel_win', (w, w * .85, .55), at=(0, 0, z), lod=2, bevel=.18)
        ms.box('fu_green', (w + .08, w * .85 + .08, .04), at=(0, 0, z + .51), lod=1)
        ms.box('fu_glow', (w + .02, .02, .02), at=(0, -w * .425 - .01, z + .3), lod=0)


def arco_3(ms, rng):
    z = G + 2.67
    for k, w in enumerate((2.4, 1.6)):
        ms.box('fu_glass', (w, w * .85, .6), at=(0, 0, z + .6 * k), lod=2, bevel=.15)
    ms.cyl('fu_graphite', .12, .02, 2.0, at=(0, 0, z + 1.2), segs=8, lod=1)
    for k in range(3):
        ms.cyl('fu_glow', .1 - .02 * k, .1 - .02 * k, .04, at=(0, 0, z + 1.5 + .4 * k), segs=8, lod=0)
    ms.box('team_cloth', (.6, .01, .4), at=(0, -2.14, G + .5), lod=1)


WONDERS = {
    'stonehenge': (stonehenge_1, stonehenge_2, stonehenge_3),
    'catalhoyuk': (catal_1, catal_2, catal_3),
    'walls_of_jericho': (jericho_1, jericho_2, jericho_3),
    'white_temple_of_uruk': (uruk_1, uruk_2, uruk_3),
    'world_wide_web': (www_1, www_2, www_3),
    'large_hadron_collider': (lhc_1, lhc_2, lhc_3),
    'global_seed_vault': (vault_1, vault_2, vault_3),
    'space_elevator': (elevator_1, elevator_2, elevator_3),
    'mars_colony': (mars_1, mars_2, mars_3),
    'arcology_prime': (arco_1, arco_2, arco_3),
}

if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    out, wid = os.path.abspath(argv[0]), argv[1]
    tw.build(wid, WONDERS[wid], out, atlas=int(argv[2]) if len(argv) > 2 else 1024, seed=5000 + sum(map(ord, wid)))
    sys.stdout.flush()
    os._exit(0)
