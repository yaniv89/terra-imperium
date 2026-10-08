# scripts/blender/build_props_kingdoms.py
# The Kingdoms decorative battlefield props, src/assets/battle/props/props-kingdoms.glb
# (plans/ART-MODELS-PLAN.md 8.2; placed by src/battle/art/battleProps.js, the same twelve names as
# props-bronze.glb and props-classical.glb): fence-a (a woven wattle hurdle between stakes),
# field-wall-a (a dry-stone field wall with a coping), well (a round stone curb under a shingled
# roof on two posts, a windlass and a bucket), cart (a two-wheeled cart with plank sides and iron-
# tyred spoked wheels, sacks in the bed), haystack, crate, barrel (two staved barrels with iron
# hoops), market-stall (a Team awning on posts over a plank counter with crates and a barrel, a
# striped valance), standard (a Team gonfanon with tails hanging from a crossbar under an iron cross),
# campfire, shrine (a wayside stone cross on a stepped base) and road-marker (a rough waymark stone
# with a cut cross). Original procedural work (CC0-1.0), made with the Bronze kit's machinery
# (build_props_bronze.py: its colour + AO bake, grounding and transfer), one 1024 atlas.
#   blender -b --factory-startup -t 8 -P scripts/blender/build_props_kingdoms.py -- art-build/props-kingdoms
import os
import sys
import math
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402,F401
from mathutils import Matrix  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_nature as tn  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_kingdoms as tk  # noqa: E402,F401 (kg_stone, kg_wallstone, kg_shingle, kg_wattle, kg_iron, kg_planks)
import build_props_bronze as pb  # noqa: E402
from build_props_bronze import pole  # noqa: E402
import build_props_classical as pc  # noqa: E402


def fence(ms, rng):
    for x in (-.13, -.045, .045, .13):
        pole(ms, (x, 0, 0), (x, 0, .13), .006, 'log', 2 if x in (-.13, .13) else 1)
    ms.box('kg_wattle', (.27, .012, .085), at=(0, 0, .025), lod=2)


def wall(ms, rng):
    for row in range(3):
        for j in range(4):
            w = rng.uniform(.06, .085)
            ms.box('kg_stone', (w, .055, .028), at=(-.11 + j * .073 + (row % 2) * .018, 0, row * .029), rot_z=rng.uniform(-6, 6), bevel=.004, lod=1)
    ms.box('kg_wallstone', (.3, .065, .016), at=(0, 0, .087), bevel=.003, lod=1)  # the coping
    ms.box('kg_stone', (.3, .055, .1), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def well(ms, rng):
    for i in range(12):
        a = math.tau * i / 12
        ms.box('kg_stone', (.034, .026, .065), at=(.06 * math.sin(a), .06 * math.cos(a), 0), rot_z=-math.degrees(a), bevel=.003)
    ms.cyl('dark', .048, .048, .001, at=(0, 0, .01), segs=8)
    for x in (-.075, .075):
        ms.box('timber', (.016, .016, .2), at=(x, 0, .05), lod=1)
    tc.gable_roof(ms, tm.house_frame(0, 0, 0), .2, .14, .245, .06, over=.012, mat='kg_shingle', gable='timber', lod=2, ridge='timber')
    pole(ms, (-.075, 0, .19), (.075, 0, .19), .008, 'timber', 1)  # the windlass
    pole(ms, (0, 0, .19), (0, 0, .11), .0018, 'reed', 0)
    ms.cyl('timber', .014, .016, .024, at=(0, 0, .086), segs=8, lod=1)  # the bucket
    ms.box('timber', (.006, .03, .006), at=(.085, -.015, .19), lod=0)  # the crank


def cart(ms, rng):
    ms.box('kg_planks', (.12, .19, .012), at=(0, 0, .055), bevel=.002)
    for x in (-.066, .066):
        ms.box('kg_planks', (.01, .19, .045), at=(x, 0, .067), bevel=.002)
    for y in (-.09, .09):
        ms.box('kg_planks', (.142, .01, .045), at=(0, y, .067), bevel=.002)
    pole(ms, (-.095, 0, .05), (.095, 0, .05), .005, 'timber')
    for x in (-.09, .09):
        pc.wheel(ms, x, .05, .05)
        ms.cyl('kg_iron', .052, .052, .006, at=(x, 0, .05), rot=(0, 90, 0), segs=10, lod=1)
    for x in (-.035, .035):
        pole(ms, (x, -.095, .062), (x, -.25, .045), .005, 'timber')
    for x, y in ((-.025, .03), (.03, -.02)):  # two sacks in the bed
        ms.lathe('linen', [(.0, 0), (.026, .004), (.03, .03), (.02, .05), (.006, .058)], segs=8, lod=1)
        pc.tm_translate(ms.parts[-1][0], (x, y, .067))


def hay(ms, rng):
    pb.hay(ms, rng)


def crate(ms, rng):
    pb.crate(ms, rng)


def staved(ms, x, y, lod=1):
    """A staved barrel with two iron hoops, standing."""
    n0 = len(ms.parts)
    ms.lathe('timber', [(.0, 0), (.026, 0), (.031, .035), (.026, .07), (.0, .07)], segs=10, lod=lod)
    for h in (.014, .052):
        ms.cyl('kg_iron', .0305, .0305, .005, at=(0, 0, h), segs=10, lod=0)
    for p in ms.parts[n0:]:
        pc.tm_translate(p[0], (x, y, 0))


def barrel(ms, rng):
    staved(ms, -.036, 0, lod=2)
    staved(ms, .04, .012, lod=1)


def stall(ms, rng):
    for x in (-.12, .12):
        for y in (-.07, .07):
            pole(ms, (x, y, 0), (x, y, .2), .006, 'timber')
    ms.box('kg_planks', (.25, .08, .075), at=(0, -.03, 0), bevel=.002)
    tc.gable_roof(ms, tm.house_frame(0, 0, 0), .28, .18, .2, .05, over=.012, mat='team_cloth', gable='team_cloth', lod=2, ridge='timber')
    ms.box('log', (.04, .035, .03), at=(-.08, -.03, .075), rot_z=rng.uniform(-15, 15), bevel=.002, lod=0)
    ms.cyl('timber', .018, .02, .04, at=(0, -.03, .075), segs=8, lod=0)
    ms.box('log', (.04, .035, .03), at=(.075, -.03, .075), rot_z=rng.uniform(-15, 15), bevel=.002, lod=0)
    for k in range(5):  # the striped valance at the front
        ms.box('team_cloth' if k % 2 else 'linen', (.05, .004, .03), at=(-.11 + k * .055, -.096, .165), lod=1)


def standard(ms, rng):
    pole(ms, (0, 0, 0), (0, 0, .32), .0045, 'timber')
    pole(ms, (-.055, 0, .265), (.055, 0, .265), .0035, 'timber')
    ms.box('team_cloth', (.1, .003, .12), at=(0, 0, .145))
    for x, h in ((-.033, .022), (0, .032), (.033, .022)):  # the gonfanon's tails
        ms.box('team_cloth', (.026, .003, h), at=(x, 0, .145 - h), lod=1)
    ms.box('kg_iron', (.005, .005, .03), at=(0, 0, .318), lod=1)
    ms.box('kg_iron', (.022, .005, .005), at=(0, 0, .336), lod=1)


def campfire(ms, rng):
    pb.campfire(ms, rng)


def shrine(ms, rng):
    ms.box('kg_stone', (.12, .12, .02), at=(0, 0, 0), bevel=.003)
    ms.box('kg_stone', (.085, .085, .02), at=(0, 0, .02), bevel=.003, lod=1)
    ms.box('kg_wallstone', (.024, .024, .19), at=(0, 0, .04), bevel=.002)
    ms.box('kg_wallstone', (.09, .022, .022), at=(0, 0, .17), bevel=.002)
    ms.cyl('kg_wallstone', .032, .032, .008, at=(0, .004, .181), rot=(90, 0, 0), segs=10, lod=0)  # the ring of the cross head
    ms.box('timber', (.03, .03, .02), at=(.05, -.05, .02), lod=0)  # an offering box


def marker(ms, rng):
    tn.blob(ms, 'kg_stone', (0, 0, .025), .03, (.8, .55, 2.0), rng, .1, 1, lod=2)
    ms.box('dark', (.004, .004, .026), at=(0, -.015, .026), lod=0)  # the cross cut in its face
    ms.box('dark', (.016, .004, .004), at=(0, -.015, .041), lod=0)


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
    counts = tt.build_file('props-kingdoms', ITEMS, out, atlas=1024, seed=7330)
    for name, c in counts.items():
        assert c['LOD0'] <= 800, (name, c)
    json.dump({'counts': counts, 'atlas': 1024, 'license': 'CC0-1.0', 'materials': ['Town', 'Team']}, open(os.path.join(out, 'source-audit.json'), 'w'), indent=2)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
