# scripts/blender/build_props_gunpowder.py
# The Gunpowder decorative battlefield props, src/assets/battle/props/props-gunpowder.glb
# (plans/ART-MODELS-PLAN.md 8.2; placed by src/battle/art/battleProps.js, the twelve names of
# props-bronze.glb): fence-a (a picket fence on rails), field-wall-a (a brick field wall with a
# sandstone coping), well (a brick well with a windlass under a small tile roof), cart (a two-wheeled
# ammunition cart with iron-tyred wheels and powder barrels), haystack, crate, barrel (three powder
# barrels, two lying), market-stall (ti_gunpowder's stall under a Team awning), standard (a regimental
# colour: a square Team flag on a pike with a spear finial), campfire, shrine (a sandstone wayside
# shrine with a tiled cap) and road-marker (a sandstone milestone with an iron plate). Original
# procedural work (CC0-1.0), made with the Bronze kit's machinery (build_props_bronze.py: its colour +
# AO bake, grounding and transfer), one 1024 atlas.
#   blender -b --factory-startup -t 8 -P scripts/blender/build_props_gunpowder.py -- art-build/props-gunpowder
import os
import sys
import math
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
from mathutils import Matrix  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_gunpowder as tg  # noqa: E402
import build_props_bronze as pb  # noqa: E402
from build_props_bronze import pole  # noqa: E402
from ti_town import G  # noqa: E402
import build_props_classical as pc  # noqa: E402
import build_props_kingdoms as pk  # noqa: E402


def fence(ms, rng):
    for x in (-.13, .13):
        pole(ms, (x, 0, 0), (x, 0, .12), .006, 'timber', 2)
    for z in (.03, .085):
        ms.box('timber', (.27, .008, .012), at=(0, .006, z), lod=1)
    for k in range(9):  # the pickets
        ms.box('gp_stucco', (.016, .006, .11), at=(-.12 + .03 * k, -.004, .0), lod=1)
    ms.box('gp_stucco', (.27, .006, .1), at=(0, -.004, 0), lod=2, )
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def wall(ms, rng):
    ms.box('gp_sandstone', (.3, .07, .02), at=(0, 0, 0), bevel=.002, lod=1)
    ms.box('gp_brick', (.28, .05, .08), at=(0, 0, .02), bevel=.002)
    ms.box('gp_sandstone', (.3, .07, .016), at=(0, 0, .1), bevel=.002, lod=1)  # the coping
    for x in (-.14, .14):
        ms.box('gp_brick', (.05, .07, .1), at=(x, 0, .02), bevel=.002, lod=1)  # the piers


def well(ms, rng):
    for i in range(12):
        a = math.tau * i / 12
        ms.box('gp_brick', (.034, .026, .065), at=(.06 * math.sin(a), .06 * math.cos(a), 0), rot_z=-math.degrees(a), bevel=.003)
    ms.cyl('gp_sandstone', .074, .074, .012, at=(0, 0, .065), segs=12, lod=1)
    ms.cyl('dark', .048, .048, .001, at=(0, 0, .01), segs=8)
    for x in (-.075, .075):
        ms.box('timber', (.016, .016, .2), at=(x, 0, .05), lod=1)
    tc.gable_roof(ms, tm.house_frame(0, 0, 0), .2, .14, .245, .06, over=.012, mat='gp_tile', gable='timber', lod=2, ridge='gp_tile')
    pole(ms, (-.075, 0, .19), (.075, 0, .19), .008, 'timber', 1)
    pole(ms, (0, 0, .19), (0, 0, .11), .0018, 'reed', 0)
    ms.cyl('timber', .014, .016, .024, at=(0, 0, .086), segs=8, lod=1)
    ms.box('gp_iron', (.006, .03, .006), at=(.085, -.015, .19), lod=0)


def cart(ms, rng):
    ms.box('gp_plank', (.12, .19, .012), at=(0, 0, .055), bevel=.002)
    for x in (-.066, .066):
        ms.box('gp_plank', (.01, .19, .04), at=(x, 0, .067), bevel=.002)
    for y in (-.09, .09):
        ms.box('gp_plank', (.142, .01, .04), at=(0, y, .067), bevel=.002)
    pole(ms, (-.095, 0, .05), (.095, 0, .05), .005, 'timber')
    for x in (-.09, .09):
        pc.wheel(ms, x, .05, .05)
        ms.cyl('gp_iron', .052, .052, .006, at=(x, 0, .05), rot=(0, 90, 0), segs=10, lod=1)
    for x in (-.035, .035):
        pole(ms, (x, -.095, .062), (x, -.25, .045), .005, 'timber')
    for x, y in ((-.028, .04), (.028, .04), (0, -.03)):  # powder barrels in the bed
        ms.cyl('timber', .022, .022, .05, at=(x, y, .067), segs=8, lod=1)


def hay(ms, rng):
    pb.hay(ms, rng)


def crate(ms, rng):
    pb.crate(ms, rng)


def barrel(ms, rng):
    pk.staved(ms, 0, .03, lod=2)
    for k, x in enumerate((-.045, .045)):  # two lying in front, chocked
        n0 = len(ms.parts)
        pk.staved(ms, 0, 0, lod=1)
        for p in ms.parts[n0:]:
            bmesh.ops.translate(p[0], vec=(0, 0, -.035), verts=p[0].verts)
            bmesh.ops.transform(p[0], matrix=Matrix.Rotation(math.radians(90), 4, 'Y'), verts=p[0].verts)
            bmesh.ops.translate(p[0], vec=(x, -.06, .031), verts=p[0].verts)


def stall(ms, rng):
    tg.stall(ms, rng, 0, 0, yaw=0)
    ms.box('team_cloth', (.34, .28, .22), at=(0, 0, G), lod=2)  # the far level: one block
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, (2,))


def standard(ms, rng):
    pole(ms, (0, 0, 0), (0, 0, .34), .0045, 'timber')
    ms.box('team_cloth', (.12, .003, .1), at=(.064, 0, .225))
    ms.cyl('gp_iron', .006, .0, .03, at=(0, 0, .34), segs=6, lod=1)  # the spear finial
    for x in (.005, .01):  # the cords and tassels
        pole(ms, (x, 0, .33), (x + .01, 0, .29), .0016, 'reed', 0)


def campfire(ms, rng):
    pb.campfire(ms, rng)


def shrine(ms, rng):
    ms.box('gp_sandstone', (.1, .1, .02), at=(0, 0, 0), bevel=.003)
    ms.box('gp_sandstone', (.06, .05, .16), at=(0, 0, .02), bevel=.003)
    ms.box('dark', (.034, .004, .05), at=(0, -.026, .1), lod=0)  # the niche
    tc.gable_roof(ms, tm.house_frame(0, 0, 0), .08, .07, .18, .035, over=.008, mat='gp_tile', gable='gp_sandstone', lod=1, ridge='gp_tile')
    ms.box('gp_iron', (.004, .004, .03), at=(0, 0, .215), lod=0)
    ms.box('gp_iron', (.016, .004, .004), at=(0, 0, .232), lod=0)


def marker(ms, rng):
    ms.box('gp_sandstone', (.05, .03, .1), at=(0, 0, 0), bevel=.004)
    ms.cyl('gp_sandstone', .025, .025, .03, at=(0, 0, .1), rot=(90, 0, 0), segs=8, lod=1)  # the rounded top
    ms.box('gp_iron', (.034, .003, .03), at=(0, -.016, .06), lod=0)


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
        if not obj.data.vertices:
            print('EMPTY_LEVEL', obj.name, flush=True)
            return obj
        for v in obj.data.vertices:
            v.co.z = max(0, v.co.z)
        low = min(v.co.z for v in obj.data.vertices)
        if low > 0:
            for v in obj.data.vertices:
                v.co.z -= low
        return obj
    tm.Mesher.build = grounded_build
    counts = tt.build_file('props-gunpowder', ITEMS, out, atlas=1024, seed=7430)
    for name, c in counts.items():
        assert c['LOD0'] <= 800, (name, c)
    json.dump({'counts': counts, 'atlas': 1024, 'license': 'CC0-1.0', 'materials': ['Town', 'Team']}, open(os.path.join(out, 'source-audit.json'), 'w'), indent=2)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
