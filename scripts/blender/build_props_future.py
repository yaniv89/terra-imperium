# scripts/blender/build_props_future.py
# The Future decorative battlefield props, src/assets/battle/props/props-future.glb (eight-ages plan U91; placed by
# src/battle/art/battleProps.js, the same twelve names as props-bronze.glb), on the Future kit (ti_future_kit.py):
# fence-a (a row of low light bollards with a glowing line), field-wall-a (a white composite barrier), well (a water
# condenser column), cart (a hover cargo sled), haystack (stacked supply canisters), crate (cargo boxes), barrel (a
# fuel cell rack), market-stall (a vending kiosk), standard (a holo-banner mast in Team), campfire (a heat lamp on a
# tripod), shrine (a memorial obelisk with a light line) and road-marker (a beacon post). The Bronze props'
# machinery (build_props_bronze.py: its colour + AO bake, grounding and transfer), one 1024 atlas, LOD0 at most 800.
#   blender -b --factory-startup -P scripts/blender/build_props_future.py -- art-build/props-future
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_future_kit as fk  # noqa: E402,F401 (fu_ materials)
import build_props_bronze as pb  # noqa: E402


def fence(ms, rng):
    for x in (-.12, -.04, .04, .12):
        ms.cyl('fu_graphite', .012, .010, .09, at=(x, 0, 0), segs=6, lod=1)
        ms.box('fu_glow', (.016, .016, .012), at=(x, 0, .09), lod=0)
    ms.box('fu_glow', (.26, .006, .008), at=(0, 0, .06), lod=0)
    ms.box('fu_graphite', (.26, .02, .08), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def wall(ms, rng):
    ms.box('fu_panel', (.28, .05, .09), at=(0, 0, 0), lod=2, bevel=.008, taper=.85)
    ms.box('fu_graphite', (.29, .055, .015), at=(0, 0, 0), lod=1)
    ms.box('fu_glow', (.24, .056, .006), at=(0, 0, .06), lod=0)


def well(ms, rng):
    ms.cyl('fu_plinth', .07, .07, .02, at=(0, 0, 0), segs=10, lod=2)
    ms.cyl('fu_panel', .045, .035, .2, at=(0, 0, .02), segs=10, lod=2)
    ms.cyl('fu_glass', .036, .036, .06, at=(0, 0, .08), segs=10, lod=1)
    ms.cyl('fu_glow', .047, .047, .008, at=(0, 0, .2), segs=10, lod=0, caps=False)


def cart(ms, rng):
    ms.box('fu_graphite', (.12, .22, .03), at=(0, 0, .02), lod=2, bevel=.01)
    for k in range(3):
        ms.box('fu_panel', (.05, .05, .04), at=(-.03 + .03 * (k % 2), -.06 + .06 * k, .05), lod=1, bevel=.006)
    for sy in (-1, 1):
        ms.box('fu_glow', (.10, .02, .004), at=(0, sy * .08, .016), lod=0)


def hay(ms, rng):
    for k, (x, y, z) in enumerate(((-.03, 0, 0), (.03, 0, 0), (0, .02, .07))):
        ms.cyl('fu_panel', .03, .03, .07, at=(x, y, z), segs=8, lod=1 if k < 2 else 0)
        ms.cyl('fu_glow', .031, .031, .006, at=(x, y, z + .05), segs=8, lod=0, caps=False)
    ms.box('fu_panel', (.12, .06, .12), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def crate(ms, rng):
    ms.box('fu_panel', (.08, .07, .06), at=(-.02, 0, 0), lod=2, bevel=.006)
    ms.box('fu_graphite', (.06, .06, .05), at=(.03, .01, .06), lod=1, bevel=.006)
    ms.box('fu_glow', (.06, .072, .004), at=(-.02, 0, .04), lod=0)


def barrel(ms, rng):
    ms.box('fu_graphite', (.12, .05, .01), at=(0, 0, 0), lod=1)
    for k in range(3):
        ms.cyl('fu_panel', .018, .018, .08, at=(-.04 + .04 * k, 0, .01), segs=8, lod=1)
        ms.cyl('fu_glow', .019, .019, .008, at=(-.04 + .04 * k, 0, .07), segs=8, lod=0, caps=False)
    ms.box('fu_panel', (.12, .05, .09), at=(0, 0, 0), lod=2)
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, 2)


def stall(ms, rng):
    ms.box('fu_panel', (.18, .09, .14), at=(0, 0, 0), lod=2, bevel=.012)
    ms.box('fu_glass', (.13, .006, .07), at=(0, -.046, .05), lod=1)
    ms.box('fu_graphite', (.22, .13, .012), at=(0, 0, .14), lod=1)
    ms.box('fu_glow', (.16, .006, .008), at=(0, -.047, .125), lod=0)


def standard(ms, rng):
    ms.cyl('fu_graphite', .006, .005, .28, at=(0, 0, 0), segs=6, lod=2)
    ms.box('team_cloth', (.09, .003, .12), at=(.048, 0, .14))
    ms.box('fu_glow', (.012, .012, .012), at=(0, 0, .28), lod=0)


def campfire(ms, rng):
    for k in range(3):
        import math
        a = math.radians(120 * k)
        pb.pole(ms, (.05 * math.cos(a), .05 * math.sin(a), 0), (0, 0, .12), .004, 'fu_graphite')
    ms.cyl('fu_glow', .03, .03, .02, at=(0, 0, .11), segs=8, lod=1)
    ms.cyl('fu_plinth', .07, .07, .006, at=(0, 0, 0), segs=10, lod=2)


def shrine(ms, rng):
    ms.box('fu_plinth', (.09, .09, .02), at=(0, 0, 0), lod=2)
    ms.box('fu_panel', (.04, .04, .2), at=(0, 0, .02), lod=2, taper=.5)
    ms.box('fu_glow', (.006, .042, .16), at=(0, 0, .03), lod=0)


def marker(ms, rng):
    ms.cyl('fu_graphite', .012, .010, .09, at=(0, 0, 0), segs=6, lod=2)
    ms.box('fu_glow', (.02, .02, .015), at=(0, 0, .09), lod=0)


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
    counts = tt.build_file('props-future', ITEMS, out, atlas=1024, seed=7830)
    for name, c in counts.items():
        assert c['LOD0'] <= 800, (name, c)
    json.dump({'counts': counts, 'atlas': 1024, 'license': 'CC0-1.0', 'materials': ['Town', 'Team']}, open(os.path.join(out, 'source-audit.json'), 'w'), indent=2)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
