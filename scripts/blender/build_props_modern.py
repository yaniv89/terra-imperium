# scripts/blender/build_props_modern.py
# The Modern decorative battlefield props, src/assets/battle/props/props-modern.glb
# (plans/ART-MODELS-PLAN.md 8.2; placed by src/battle/art/battleProps.js, the twelve names of
# props-bronze.glb): fence-a (a chain-link fence panel on steel posts), field-wall-a (a concrete road
# barrier), well (a hand water pump on a concrete pad with a steel tank), cart (a two-wheeled army trailer
# with jerrycans), haystack (round bales, one wrapped), crate (olive ammunition boxes), barrel (oil drums,
# one lying), market-stall (the ti_modern gazebo under a Team roof), standard (a Team flag on a steel pole),
# campfire, shrine (a small concrete memorial with a plaque and a wreath) and road-marker (a road sign on a
# post). Original procedural work (CC0-1.0), made with the Bronze kit machinery (build_props_bronze.py:
# its colour + AO bake, grounding and transfer), one 1024 atlas.
#   blender -b --factory-startup -t 8 -P scripts/blender/build_props_modern.py -- art-build/props-modern
import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bmesh  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_modern as tmd  # noqa: E402
import ti_modern_battle  # noqa: E402,F401 (md_olive, md_tyre)
import build_props_bronze as pb  # noqa: E402
from build_props_bronze import pole  # noqa: E402
from ti_town import G  # noqa: E402


def fence(ms, rng):
    for x in (-.13, .13):
        pole(ms, (x, 0, 0), (x, 0, .16), .006, 'md_steel', 2)
    pole(ms, (-.13, 0, .155), (.13, 0, .155), .004, 'md_steel', 1)
    ms.box('md_mesh', (.26, .004, .14), at=(0, 0, .01), lod=2)
    for k in range(3):  # barbed wire strands over the top
        pole(ms, (-.13, 0, .165 + .01 * k), (.13, 0, .165 + .01 * k), .0015, 'md_wire', 0)


def wall(ms, rng):
    """A precast concrete road barrier: a wide foot sloping to a narrow top."""
    bm = bmesh.new()
    prof = [(-.04, 0), (.04, 0), (.04, .012), (.016, .03), (.012, .085), (-.012, .085), (-.016, .03), (-.04, .012)]
    a = [bm.verts.new((-.15, y, z)) for y, z in prof]
    b = [bm.verts.new((.15, y, z)) for y, z in prof]
    for i in range(len(prof)):
        j = (i + 1) % len(prof)
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ms.add(bm, 'md_concrete', 2)
    for x in (-.08, .08):
        ms.box('md_marking', (.04, .002, .02), at=(x, -.012, .06), lod=0)


def well(ms, rng):
    ms.box('md_concrete', (.16, .16, .02), at=(0, 0, 0), bevel=.003)
    ms.cyl('md_steel', .012, .012, .12, at=(0, 0, .02), segs=8, lod=1)
    pole(ms, (0, 0, .13), (.05, 0, .1), .004, 'md_steel', 1)  # the handle
    pole(ms, (0, -.012, .1), (0, -.05, .1), .005, 'md_steel', 1)  # the spout
    ms.cyl('md_jerry', .045, .045, .1, at=(.04, .05, .02), segs=10, lod=1)
    ms.box('md_olive', (.04, .03, .04), at=(-.05, -.05, .02), lod=0, bevel=.003)


def cart(ms, rng):
    ms.box('md_olive', (.12, .19, .05), at=(0, 0, .05), bevel=.003)
    ms.box('md_olive_dark', (.125, .19, .045), at=(0, 0, .1), bevel=.006, lod=1)  # the canvas cover
    for x in (-.075, .075):
        ms.cyl('md_tyre', .042, .042, .02, at=(x - .01, 0, .042), rot=(0, 90, 0), segs=10, lod=1)
    pole(ms, (0, -.095, .06), (0, -.22, .045), .006, 'md_steel')
    for k in range(3):
        ms.box('md_olive', (.025, .04, .05), at=(-.04 + .04 * k, .11, .0), lod=0, bevel=.003)


def hay(ms, rng):
    for x, y in ((-.05, 0), (.06, .02)):
        ms.cyl('md_wheat', .05, .05, .08, at=(x - .04, y, .05), rot=(0, 90, 0), segs=10, lod=2)
    ms.cyl('md_jerry', .05, .05, .08, at=(-.04, -.1, .05), rot=(0, 90, 0), segs=10, lod=1)


def crate(ms, rng):
    for k, (x, y, z) in enumerate(((0, 0, 0), (.075, 0, 0), (.035, 0, .04), (0, .05, 0))):
        ms.box('md_olive', (.07, .045, .04), at=(x, y, z), bevel=.003, lod=2 if k < 2 else 0)
        ms.box('md_marking', (.03, .002, .01), at=(x, y - .023, z + .015), lod=0)


def barrel(ms, rng):
    for k, (x, y) in enumerate(((-.03, .03), (.03, .03), (0, .08))):
        ms.cyl('md_olive' if k != 1 else 'md_steel', .022, .022, .065, at=(x, y, 0), segs=10, lod=2)
        ms.cyl('md_wire', .0225, .0225, .004, at=(x, y, .03), segs=10, lod=0)
    ms.cyl('md_olive', .022, .022, .065, at=(-.03, -.05, .022), rot=(0, 90, 0), segs=10, lod=1)


def stall(ms, rng):
    tmd.market_tent(ms, rng, 0, 0, s=.3, h=.2)
    ms.box('team_cloth', (.32, .32, .24), at=(0, 0, G), lod=2)  # the far level: one block
    ms.parts[-1] = (ms.parts[-1][0], ms.parts[-1][1], 2, (2,))


def standard(ms, rng):
    pole(ms, (0, 0, 0), (0, 0, .36), .004, 'md_steel')
    ms.box('team_cloth', (.13, .003, .085), at=(.067, 0, .26))
    ms.cyl('md_steel', .007, .007, .008, at=(0, 0, .36), segs=6, lod=0)
    ms.box('md_concrete', (.05, .05, .015), at=(0, 0, 0), lod=1)


def campfire(ms, rng):
    pb.campfire(ms, rng)


def shrine(ms, rng):
    """A small concrete memorial: a stepped base, a slab with a plaque, a wreath."""
    ms.box('md_concrete', (.12, .08, .015), at=(0, 0, 0), bevel=.002)
    ms.box('md_concrete', (.09, .06, .015), at=(0, 0, .015), bevel=.002, lod=1)
    ms.box('md_concrete', (.06, .025, .16), at=(0, 0, .03), bevel=.003)
    ms.box('bronze', (.035, .003, .04), at=(0, -.014, .1), lod=0)
    ms.cyl('md_hedge', .018, .018, .008, at=(0, -.03, .03), segs=8, lod=0)


def marker(ms, rng):
    pole(ms, (0, 0, 0), (0, 0, .17), .004, 'md_steel')
    ms.box('md_marking', (.09, .004, .05), at=(0, -.004, .12), lod=1, bevel=.002)
    ms.box('md_olive', (.07, .002, .02), at=(0, -.007, .135), lod=0)


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
    counts = tt.build_file('props-modern', ITEMS, out, atlas=1024, seed=7530)
    for name, c in counts.items():
        assert c['LOD0'] <= 800, (name, c)
    json.dump({'counts': counts, 'atlas': 1024, 'license': 'CC0-1.0', 'materials': ['Town', 'Team']}, open(os.path.join(out, 'source-audit.json'), 'w'), indent=2)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
