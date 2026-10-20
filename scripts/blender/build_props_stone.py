# scripts/blender/build_props_stone.py
# The Stone Age decorative battlefield props, src/assets/battle/props/props-stone.glb (eight-ages
# plan U91; placed by src/battle/art/battleProps.js, the same twelve names as props-bronze.glb):
# fence-a (a wattle fence on stakes), field-wall-a (a low bank of piled fieldstones), well (a spring
# hole in a ring of stones with a gourd on a pole), cart (a travois: two poles dragged behind, a
# lashed hide load), haystack (a stook of cut grass bundles), crate (a stack of woven baskets),
# barrel (two hide water bags and a clay pot on a forked stand), market-stall (a hide awning on
# poles over a mat of flints, furs and baskets), standard (a short carved pole with a Team hide
# streamer and an antler crown), campfire, shrine (three standing stones round an offering stone)
# and road-marker (a cairn). Original procedural work (CC0-1.0) with the Bronze props' machinery
# (build_props_bronze.py: its colour + AO bake, grounding and transfer) and the Stone map parts
# (ti_stone_map.py), one 1024 atlas, LOD0 at most 800 triangles a prop.
#   blender -b --factory-startup -t 8 -P scripts/blender/build_props_stone.py -- art-build/props-stone
import os
import sys
import math
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_stone_map as ts  # noqa: E402  (st_* materials, basket, cairn, drying_rack)
import build_props_bronze as pb  # noqa: E402
from build_props_bronze import pole, ring  # noqa: E402


def fence(ms, rng):
    """Stakes with brushwood woven between them."""
    for x in (-.12, -.04, .04, .12):
        pole(ms, (x, 0, 0), (x + rng.uniform(-.004, .004), 0, .12 + rng.uniform(-.008, .008)), .006, 'timber')
    for z in (.03, .055, .08, .1):
        for k, (x0, x1) in enumerate(((-.13, -.04), (-.04, .04), (.04, .13))):
            s = .006 if (k + int(z * 100)) % 2 else -.006
            pole(ms, (x0, s, z), (x1, -s, z + .004), .0035, 'reed', 1 if z in (.03, .08) else 0)
    ms.box('reed', (.26, .008, .08), at=(0, 0, .025), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def wall(ms, rng):
    """A low bank of fieldstones cleared off the land."""
    for k in range(9):
        x = -.12 + k * .03 + rng.uniform(-.006, .006)
        tn.blob(ms, 'stone', (x, rng.uniform(-.008, .008), .0), .021, (1.1, .9, .75), rng, .2, 1, lod=1)
    for k in range(5):
        tn.blob(ms, 'stone', (-.09 + k * .045, rng.uniform(-.005, .005), .028), .018, (1.1, .9, .7), rng, .2, 1, lod=0)
    ms.box('stone', (.29, .045, .05), at=(0, 0, 0), lod=2, taper=.6)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def well(ms, rng):
    """A spring hole: dark water in a ring of stones, a gourd hung on a forked pole."""
    ms.cyl('dark', .05, .05, .002, at=(0, 0, .002), segs=10)
    for i in range(9):
        a = math.tau * i / 9
        tn.blob(ms, 'stone', (.062 * math.cos(a), .062 * math.sin(a), 0), .02, (1.1, 1, .8), rng, .15, 1, lod=1)
    ring(ms, 'stone', .062, .01, .012, 6, 2)
    for k in range(len(ms.parts) - 6, len(ms.parts)):
        ms.parts[k] = (ms.parts[k][0], ms.parts[k][1], 2, 2)
    pole(ms, (.09, 0, 0), (.09, 0, .17), .005, 'timber')
    pole(ms, (.09, 0, .16), (.035, 0, .19), .004, 'timber', 1)
    pole(ms, (.035, 0, .19), (.035, 0, .13), .0012, 'reed', 0)
    tn.blob(ms, 'st_ochre', (.035, 0, .1), .016, (1, 1, 1.3), rng, .05, 1, lod=1)


def cart(ms, rng):
    """A travois: two long poles crossed at the front, a frame and a lashed hide bundle."""
    for sx in (-1, 1):
        pole(ms, (sx * .075, .12, 0), (sx * .01, -.17, .14), .006, 'timber')
    for y in (.06, -.02):
        f = .5 + y
        pole(ms, (-.075 * f * 1.6, y, .035 + (.06 - y) * .4), (.075 * f * 1.6, y, .035 + (.06 - y) * .4), .004, 'timber', 1)
    tn.blob(ms, 'op_hide', (0, .03, .05), .045, (1, 1.4, .55), rng, .1, 1, lod=2)
    for y in (0, .06):  # thongs lashing the load
        pole(ms, (-.042, y, .05), (.042, y, .05), .0025, 'reed', 0)


def hay(ms, rng):
    """A stook of cut grass: bundles leaning together, tied at the top."""
    for k in range(6):
        a = math.tau * k / 6
        base = (.045 * math.cos(a), .045 * math.sin(a), 0)
        tn.limb(ms, 'thatch', base, (.006 * math.cos(a), .006 * math.sin(a), .13), .02, .008, segs=5, lod=1)
    ms.lathe('thatch', [(.06, 0), (.05, .06), (.02, .12), (.0, .14)], segs=6, lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)
    ring(ms, 'reed', .016, .11, .003, 6, 0)


def crate(ms, rng):
    """Woven baskets, two on the ground and one on top."""
    ts.basket(ms, -.025, 0, 1.4)
    ts.basket(ms, .027, .008, 1.25)
    ts.basket(ms, 0, .002, 1.1)
    for bm, *_ in ms.parts[-1:]:
        for v in bm.verts:
            v.co.z += .05
    ms.cyl('reed', .055, .05, .07, segs=6, lod=2, only=(1, 2))


def barrel(ms, rng):
    """Water: two hide bags hung on a forked stand and a round clay pot."""
    for sx in (-1, 1):
        pole(ms, (sx * .05, 0, 0), (sx * .05, 0, .14), .005, 'timber')
    pole(ms, (-.06, 0, .13), (.06, 0, .13), .004, 'timber', 1)
    for sx in (-1, 1):
        tn.blob(ms, 'op_hide', (sx * .025, 0, .085), .022, (.9, .8, 1.3), rng, .1, 1, lod=1)
    ms.lathe('terracotta', [(0, 0), (.03, .004), (.04, .03), (.03, .058), (.02, .064), (.022, .07)], at=(0, -.06, 0), segs=10, lod=1)
    ms.cyl('terracotta', .035, .025, .07, at=(0, -.06, 0), segs=6, lod=2, only=(2,))


def stall(ms, rng):
    """A trade spot: a hide awning on four poles over a mat laid with flints, furs and baskets."""
    for x in (-.11, .11):
        for y, h in ((-.065, .16), (.065, .2)):
            pole(ms, (x, y, 0), (x, y, h), .005, 'timber')
    ms.quad_strip('op_hide', [(-.125, -.08, .155), (.125, -.08, .155), (.125, .08, .205), (-.125, .08, .205)], thickness=.003)
    ms.box('reed', (.22, .12, .004), at=(0, 0, 0), lod=1)
    for k in range(5):
        tn.blob(ms, 'st_flint', (-.08 + k * .025, -.03, .006), .008, (1.3, .8, .5), rng, .2, 1, lod=0)
    tn.blob(ms, 'hide_pale', (.05, .02, .006), .03, (1.4, 1, .25), rng, .1, 1, lod=1)
    ts.basket(ms, -.06, .035, .9)
    ts.basket(ms, .085, -.035, .8)


def standard(ms, rng):
    """A short carved pole with an antler crown and a Team hide streamer."""
    ms.lathe('st_ochre', [(.009, 0), (.008, .1), (.011, .14), (.008, .18), (.011, .22), (.007, .26), (.0, .27)], segs=6, lod=2)
    for sx in (-1, 1):
        tn.limb(ms, 'horn', (0, 0, .255), (sx * .03, 0, .3), .004, .003, segs=4, lod=1)
        tn.limb(ms, 'horn', (sx * .03, 0, .3), (sx * .05, -.004, .33), .003, .0015, segs=4, lod=0)
        tn.limb(ms, 'horn', (sx * .02, 0, .28), (sx * .035, .01, .31), .0025, .001, segs=3, lod=0)
    ms.box('team_cloth', (.09, .003, .11), at=(.048, 0, .12))


def campfire(ms, rng):
    pb.campfire(ms, rng)


def shrine(ms, rng):
    """Three standing stones round a flat offering stone with a skull and an ochre handprint."""
    for k, h in enumerate((.17, .13, .15)):
        a = math.radians(90 + 120 * k)
        ms.box('stone', (.035, .022, h), at=(.07 * math.cos(a), .07 * math.sin(a), 0), rot_z=math.degrees(a) + 90, bevel=.005, taper=.7)
    ms.box('stone', (.06, .045, .02), at=(0, 0, 0), bevel=.004)
    tn.blob(ms, 'horn', (0, 0, .03), .012, (1.2, 1, .9), rng, .1, 1, lod=0)
    ms.box('st_ochre', (.016, .002, .02), at=(0, -.081, .08), lod=0)


def marker(ms, rng):
    ts.cairn(ms, rng, 0, 0, r=.035, h=.08)


ITEMS = [('fence-a', fence, None), ('field-wall-a', wall, None), ('well', well, None), ('cart', cart, None),
         ('haystack', hay, None), ('crate', crate, None), ('barrel', barrel, None), ('market-stall', stall, None),
         ('standard', standard, None), ('campfire', campfire, None), ('shrine', shrine, None), ('road-marker', marker, None)]


def main():
    out = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
    tm.bake_atlas = pb.color_ao_bake
    tm.final_material = pb.final
    tm.transfer_uvs = pb.bounded_transfer
    original_build = tm.Mesher.build

    def grounded_build(ms, *a, **kw):
        obj = original_build(ms, *a, **kw)
        for v in obj.data.vertices:
            v.co.z = max(0, v.co.z)
        low = min(v.co.z for v in obj.data.vertices)
        if low > 0:
            for v in obj.data.vertices:
                v.co.z -= low
        return obj
    tm.Mesher.build = grounded_build
    counts = tt.build_file('props-stone', ITEMS, out, atlas=1024, seed=7030)
    for name, c in counts.items():
        assert c['LOD0'] <= 800, (name, c)
    json.dump({'counts': counts, 'atlas': 1024, 'license': 'CC0-1.0', 'materials': ['Town', 'Team']}, open(os.path.join(out, 'source-audit.json'), 'w'), indent=2)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
