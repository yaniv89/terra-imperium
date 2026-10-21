# scripts/blender/build_props_information.py
# The Information decorative battlefield props, src/assets/battle/props/props-information.glb (eight-ages plan U91;
# placed by src/battle/art/battleProps.js, the same twelve names as props-bronze.glb), on today's kit
# (ti_information_kit.py): fence-a (steel crowd barriers), field-wall-a (a concrete jersey barrier), well (a fire
# hydrant and a water tank), cart (a pallet trolley with boxes), haystack (round bales wrapped in white plastic), crate
# (boxes on a pallet), barrel (oil drums), market-stall (a food kiosk), standard (a flag pole in Team), campfire (a
# barrel brazier), shrine (a war memorial stone with a plaque) and road-marker (traffic cones). The Bronze props'
# machinery (build_props_bronze.py: its colour + AO bake, grounding and transfer), one 1024 atlas, LOD0 at most 800.
#   blender -b --factory-startup -P scripts/blender/build_props_information.py -- art-build/props-information
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_information_kit as ik  # noqa: E402,F401 (in_ materials)
import build_props_bronze as pb  # noqa: E402


def fence(ms, rng):
    for x in (-.13, .13):
        for sx in (-1, 1):
            ms.box('in_graphite', (.006, .03, .08), at=(x + sx * .01, 0, 0), lod=1)
    for z in (.02, .075):
        ms.box('in_panel', (.28, .006, .006), at=(0, 0, z), lod=1)
    for k in range(9):
        ms.box('in_panel', (.003, .003, .055), at=(-.12 + .03 * k, 0, .02), lod=0)
    ms.box('in_panel', (.28, .02, .08), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def wall(ms, rng):
    ms.box('in_plinth', (.28, .06, .09), at=(0, 0, 0), lod=2, taper=.45)
    ms.box('in_mark', (.28, .062, .008), at=(0, 0, .06), lod=0)


def well(ms, rng):
    ms.cyl('in_cont_red', .018, .016, .06, at=(-.05, 0, 0), segs=8, lod=2)
    ms.sphere('in_cont_red', .018, at=(-.05, 0, .06), u=8, v=4, lod=1)
    ms.cyl('in_panel', .045, .045, .12, at=(.04, 0, 0), segs=10, lod=2)


def cart(ms, rng):
    ms.box('in_graphite', (.1, .16, .012), at=(0, 0, .012), lod=2)
    for sx in (-1, 1):
        ms.cyl('dark', .012, .012, .01, at=(sx * .05, .06, .012), rot=(0, 90, 0), segs=6, lod=0)
    ms.box('in_graphite', (.006, .006, .1), at=(0, -.08, .012), lod=1)
    for k in range(3):
        ms.box('in_ochre', (.04, .04, .035), at=(-.02 + .03 * (k % 2), -.03 + .05 * k, .024), lod=1)


def hay(ms, rng):
    for k, (x, y, z) in enumerate(((-.04, 0, 0), (.04, 0, 0), (0, 0, .07))):
        ms.cyl('in_panel', .035, .035, .07, at=(x, y + .035, z + .035), rot=(90, 0, 0), segs=10, lod=1 if k < 2 else 0)
    ms.box('in_panel', (.15, .07, .12), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def crate(ms, rng):
    ms.box('in_ochre', (.1, .08, .012), at=(0, 0, 0), lod=2)
    ms.box('in_ochre', (.09, .07, .05), at=(0, 0, .012), lod=2)
    ms.box('in_panel', (.092, .072, .004), at=(0, 0, .04), lod=0)


def barrel(ms, rng):
    for k, x in enumerate((-.03, .03, 0)):
        ms.cyl('in_cont_blue' if k % 2 else 'in_cont_red', .025, .025, .07, at=(x, .02 if k < 2 else -.03, 0), segs=8, lod=1)
    ms.box('in_cont_blue', (.1, .08, .07), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def stall(ms, rng):
    ms.box('in_panel', (.18, .09, .1), at=(0, 0, .012), lod=2)
    for sx in (-1, 1):
        ms.cyl('dark', .012, .012, .01, at=(sx * .06, 0, .012), rot=(0, 90, 0), segs=6, lod=0)
    ms.box('in_glass', (.13, .006, .04), at=(0, -.046, .05), lod=1)
    ms.box('in_cont_red', (.2, .03, .01), at=(0, -.05, .1), lod=1, taper=.8)


def standard(ms, rng):
    ms.cyl('in_graphite', .005, .004, .3, at=(0, 0, 0), segs=6, lod=2)
    ms.box('team_cloth', (.09, .003, .06), at=(.048, 0, .22))
    ms.box('in_plinth', (.04, .04, .01), at=(0, 0, 0), lod=1)


def campfire(ms, rng):
    ms.cyl('in_graphite', .03, .03, .06, at=(0, 0, 0), segs=8, lod=2)
    ms.cyl('in_glow', .026, .026, .01, at=(0, 0, .06), segs=8, lod=1)
    for k in range(3):
        a = math.radians(120 * k)
        ms.box('dark', (.006, .006, .03), at=(.012 * math.cos(a), .012 * math.sin(a), .06), lod=0)


def shrine(ms, rng):
    ms.box('in_plinth', (.12, .08, .02), at=(0, 0, 0), lod=2)
    ms.box('in_plinth', (.08, .04, .16), at=(0, .01, .02), lod=2, taper=.8)
    ms.box('in_ochre', (.04, .004, .03), at=(0, -.011, .1), lod=0)


def marker(ms, rng):
    for k, (x, y) in enumerate(((-.03, 0), (.03, .02))):
        ms.cyl('in_cont_red', .014, .002, .06, at=(x, y, .004), segs=6, lod=1)
        ms.box('in_cont_red', (.03, .03, .004), at=(x, y, 0), lod=1)
        ms.cyl('in_panel', .009, .008, .008, at=(x, y, .03), segs=6, lod=0, caps=False)
    ms.box('in_cont_red', (.09, .05, .06), at=(0, .01, 0), lod=2, taper=.3)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


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
    counts = tt.build_file('props-information', ITEMS, out, atlas=1024, seed=7820)
    for name, c in counts.items():
        assert c['LOD0'] <= 800, (name, c)
    json.dump({'counts': counts, 'atlas': 1024, 'license': 'CC0-1.0', 'materials': ['Town', 'Team']}, open(os.path.join(out, 'source-audit.json'), 'w'), indent=2)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
