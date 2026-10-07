# scripts/blender/build_props_classical.py
# The Classical decorative battlefield props, src/assets/battle/props/props-classical.glb
# (plans/ART-MODELS-PLAN.md 8.2; placed by src/battle/art/battleProps.js, the same twelve names as
# props-bronze.glb): fence-a (a post-and-rail fence), field-wall-a (a dry ashlar field wall), well (a
# round ashlar curb under a pulley beam), cart (a two-wheeled cart with spoked wheels), haystack,
# crate, barrel (an amphora rack: two rows of amphorae in a timber frame), market-stall (a tiled
# stall roof on posts, amphorae on the counter), standard (a vexillum: a Team cloth on a crossbar
# under a bronze disc), campfire, shrine (a small marble altar under a pedimented niche) and
# road-marker (a milestone column). Original procedural work (CC0-1.0), made with the Bronze kit's
# machinery (build_props_bronze.py: its colour + AO bake, grounding and transfer), one 1024 atlas.
#   blender -b --factory-startup -t 8 -P scripts/blender/build_props_classical.py -- art-build/props-classical
import os
import sys
import math
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_classical as tc  # noqa: E402,F401 (ashlar, tile, marble)
import build_props_bronze as pb  # noqa: E402
from build_props_bronze import pole, rope, ring  # noqa: E402


def fence(ms, rng):
    for x in (-.12, 0, .12):
        ms.box('timber', (.012, .012, .12), at=(x, 0, 0), bevel=.001)
    for z in (.04, .09):
        ms.box('timber', (.27, .008, .014), at=(0, -.009, z), lod=1)


def wall(ms, rng):
    for row in range(3):
        for j in range(3):
            ms.box('ashlar', (.094, .05, .03), at=(-.096 + j * .096 + (row % 2) * .02, 0, row * .031), bevel=.003, lod=1)
    ms.box('ashlar', (.3, .05, .093), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def well(ms, rng):
    for i in range(10):
        a = math.tau * i / 10
        ms.box('ashlar', (.04, .024, .06), at=(.058 * math.sin(a), .058 * math.cos(a), 0), rot_z=-math.degrees(a), bevel=.002)
    ms.cyl('dark', .046, .046, .001, at=(0, 0, .009), segs=8)
    for x in (-.075, .075):
        ms.box('ashlar', (.022, .022, .17), at=(x, 0, .055), bevel=.002, lod=1)
    ms.box('timber', (.19, .02, .02), at=(0, 0, .225), lod=1)
    ms.cyl('timber', .014, .014, .018, at=(0, 0, .2), rot=(0, 90, 0), segs=8, lod=0)
    pole(ms, (0, 0, .2), (0, 0, .1), .0018, 'reed', 1)
    ms.cyl('bronze', .012, .016, .022, at=(0, 0, .078), segs=8, lod=1)


def wheel(ms, x, z, r):
    ms.cyl('timber', r, r, .01, at=(x, 0, z), rot=(0, 90, 0), segs=10)
    ms.cyl('dark', r * .3, r * .3, .014, at=(x, 0, z), rot=(0, 90, 0), segs=8, lod=1)
    for k in range(4):
        a = math.tau * k / 4 + .4
        pole(ms, (x, r * .25 * math.cos(a), z + r * .25 * math.sin(a)), (x, r * .9 * math.cos(a), z + r * .9 * math.sin(a)), .0025, 'timber', 0)


def cart(ms, rng):
    ms.box('timber', (.11, .17, .014), at=(0, 0, .05), bevel=.002)
    for x in (-.062, .062):
        ms.box('timber', (.012, .17, .05), at=(x, 0, .062), bevel=.002)
    for y in (-.08, .08):
        ms.box('timber', (.134, .011, .05), at=(0, y, .062), bevel=.002)
    pole(ms, (-.09, 0, .045), (.09, 0, .045), .005)
    for x in (-.084, .084):
        wheel(ms, x, .045, .045)
    for x in (-.03, .03):
        pole(ms, (x, -.085, .06), (x, -.23, .04), .005)
    for k, (x, y) in enumerate(((-.02, .02),)):
        tt.jar(ms, None, x, y, s=.6, z=.065)


def hay(ms, rng):
    pb.hay(ms, rng)


def crate(ms, rng):
    pb.crate(ms, rng)


def amphora(ms, x, y, z, s=1.0, lod=1):
    ms.lathe('terracotta', [(.004 * s, 0), (.016 * s, .02 * s), (.022 * s, .05 * s), (.014 * s, .075 * s), (.007 * s, .085 * s), (.008 * s, .095 * s)], segs=8, lod=lod)
    for b in ms.parts[-1:]:
        tm_translate(b[0], (x, y, z))


def tm_translate(bm, vec):
    import bmesh
    bmesh.ops.translate(bm, vec=vec, verts=bm.verts)


def barrel(ms, rng):
    for x in (-.04, .04):
        for y in (-.03, .03):
            ms.box('timber', (.008, .008, .1), at=(x, y, 0), lod=1)
    ms.box('timber', (.09, .068, .008), at=(0, 0, .002), lod=2)
    ms.box('timber', (.09, .068, .006), at=(0, 0, .05), lod=1)
    for k, (x, y) in enumerate(((-.022, -.015), (.022, -.015), (-.022, .015), (.022, .015))):
        amphora(ms, x, y, .006 if k < 2 else .056, .55, lod=1 if k < 2 else 0)
    ms.box('terracotta', (.07, .05, .045), at=(0, 0, .006), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def stall(ms, rng):
    for x in (-.11, .11):
        for y in (-.065, .065):
            pole(ms, (x, y, 0), (x, y, .2), .006, 'timber')
    ms.box('ashlar', (.25, .08, .085), at=(0, -.03, 0), bevel=.002)
    tc.gable_roof(ms, tm.house_frame(0, 0, 0), .27, .17, .2, .035, over=.01, mat='tile', gable='timber', lod=2, ridge='tile_dark')
    for x, s in ((-.07, .5), (.0, .7), (.065, .45)):
        tt.jar(ms, None, x, -.03, s=s, z=.085)
    ms.box('team_cloth', (.2, .004, .03), at=(0, -.088, .165), lod=1)


def standard(ms, rng):
    pole(ms, (0, 0, 0), (0, 0, .3), .0045, 'timber')
    pole(ms, (-.06, 0, .245), (.06, 0, .245), .0035, 'timber')
    ms.box('team_cloth', (.11, .003, .11), at=(0, 0, .135))
    for x in (-.04, -.013, .013, .04):
        pole(ms, (x, 0, .135), (x, 0, .118), .0018, 'linen', 0)
    ms.cyl('bronze', .016, .016, .006, at=(0, .004, .28), rot=(90, 0, 0), segs=12)
    ms.cyl('bronze', .006, .0, .02, at=(0, 0, .3), segs=6, lod=1)


def campfire(ms, rng):
    pb.campfire(ms, rng)


def shrine(ms, rng):
    ms.box('ashlar', (.14, .1, .02), at=(0, 0, 0), bevel=.002)
    ms.box('marble', (.06, .05, .055), at=(0, -.01, .02), bevel=.002)
    ms.box('marble', (.07, .06, .01), at=(0, -.01, .075), lod=1)
    ms.box('ashlar', (.1, .03, .13), at=(0, .035, .02), bevel=.002)
    ms.box('dark', (.05, .004, .06), at=(0, .019, .06), lod=0)
    tc.gable_roof(ms, tm.house_frame(0, .035, 0), .12, .05, .15, .025, over=.008, mat='tile', gable='marble', lod=1, ridge='tile_dark')
    ms.cyl('bronze', .012, .016, .012, at=(0, -.01, .085), segs=8, lod=0)


def marker(ms, rng):
    ms.box('ashlar', (.06, .06, .015), at=(0, 0, 0), bevel=.002)
    ms.cyl('marble', .022, .02, .1, at=(0, 0, .015), segs=10)
    ms.box('dark', (.024, .002, .02), at=(0, -.021, .07), lod=0)


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
    counts = tt.build_file('props-classical', ITEMS, out, atlas=1024, seed=7230)
    for name, c in counts.items():
        assert c['LOD0'] <= 800, (name, c)
    json.dump({'counts': counts, 'atlas': 1024, 'license': 'CC0-1.0', 'materials': ['Town', 'Team']}, open(os.path.join(out, 'source-audit.json'), 'w'), indent=2)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
