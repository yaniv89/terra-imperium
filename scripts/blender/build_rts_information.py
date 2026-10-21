# scripts/blender/build_rts_information.py
# The Information battle buildings, src/assets/battle/rts/rts-information.glb (eight-ages plan U87, KTD16): the 13 roles
# of a battle economy and the late extras (generator, airfield, radar-aa), each whole, `-damaged` and `-ruined`, with
# LOD0..LOD2, their sockets and the four construction stages, in today's look (ti_information_kit.py: aluminium
# cladding and curtain-wall glass, concrete plinths, glass atria, cell masts, helipads, solar arrays, drones,
# shipping containers, wheeled armour). Fourteen roles are new; the materials yard, the range and the house are the
# Modern layouts (build_rts_modern.py) re-dressed in today's materials (md_* to in_*):
#   expedition-camp  a forward operating base: stacked containers, a satellite dish, a cell mast, a helipad with a drone
#   town-hall        the headquarters: a glass office tower on a podium (the keep, centred, the largest building),
#                    a glass atrium, a cell mast on the roof, a helipad, an armoured vehicle, the flag plaza
#   food-depot       a logistics warehouse: a long clad shed with dock doors, a container stack, a truck
#   farm-plot        polytunnel greenhouse rows, a solar array, a water tank
#   barracks         two modular accommodation blocks, a drill pad with painted lines, the flag
#   aid-post         a field hospital: a glass-fronted clinic block with a red cross, a helipad, the flag
#   tower            a cell mast over a concrete guard post with its blast wall
#   generator        a solar farm: rows of panels, battery containers, a wind turbine, a transformer
#   airfield         a drone field: two helipads with drones, a control block with a dish, a short strip
#   radar-aa         a radar under a white dome on a mast, two missile launchers on trucks
#   trade-post       a shopping arcade: a glass atrium, two canopies, a container, a parking strip
#   mine             a quarry plant: a conveyor up to a hopper tower, a processing block, spoil, a dumper
#   stable           the vehicle depot: a clad hangar with an open bay, two armoured vehicles, a wash gantry
#   siege-workshop   the rocket artillery park: three launcher trucks behind a blast wall, ammunition containers
#   blender -b --factory-startup -P scripts/blender/build_rts_information.py -- [out_dir] [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_information_kit as ik  # noqa: E402,F401 (registers the in_ materials)
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
import build_rts_modern as rm  # noqa: E402
from ti_town import G  # noqa: E402

# the Modern stuff in today's counterpart (crops, hedges and soil stay as they are)
IN = {'md_render': 'in_panel', 'md_render_win': 'in_panel_win', 'md_brick': 'in_brick', 'md_brick_win': 'in_brick_win', 'md_concrete': 'in_plinth',
      'md_bunker': 'in_plinth', 'md_corrugated': 'in_panel', 'md_prefab': 'in_panel', 'md_slate': 'in_graphite', 'md_slate_dark': 'in_graphite',
      'md_roof': 'in_graphite', 'md_steel': 'in_graphite', 'md_glass': 'in_glass', 'md_shop': 'in_glass', 'md_asphalt': 'in_pad', 'md_gravel': 'in_pad',
      'md_sandbag': 'in_plinth', 'md_wood': 'in_graphite', 'md_lime': 'in_panel',
      'md_olive': 'in_graphite', 'md_olive_dark': 'in_graphite', 'md_camo': 'in_graphite', 'md_tyre': 'in_graphite', 'md_jerry': 'in_panel',
      'md_pipe': 'in_graphite', 'md_mesh': 'in_graphite', 'md_wire': 'in_graphite', 'md_marking': 'in_mark', 'md_pave': 'in_pad', 'md_dome': 'in_glass'}
DAMAGE_MATS = dict(IN, mudwall='in_plinth', pylon='in_plinth')
flag_pole = rm.flag_pole
sockets = rm.sockets


def remat(layout, mapping=IN):
    return rc.remat(layout, mapping)


def truck(ms, x, y, yaw=0.0, load='in_cont_blue', launcher=False, lod=1):
    """A three-axle truck: a cab, a flatbed with a container, or a launcher box with its tubes facing the rear."""
    f = tm.house_frame(x, y, yaw)
    ms.box('in_panel', (.09, .08, .07), at=(0, -.16, G + .03), lod=lod, frame=f)
    ms.box('in_glass', (.08, .005, .03), at=(0, -.2, G + .07), lod=0, frame=f)
    ms.box('in_graphite', (.09, .26, .02), at=(0, .03, G + .03), lod=lod, frame=f)
    if launcher:
        ms.box('in_graphite', (.08, .2, .06), at=(0, .04, G + .05), lod=lod, frame=f)
        for k in range(3):
            for j in range(2):
                ms.box('dark', (.014, .004, .014), at=(-.022 + .022 * k, .142, G + .065 + .022 * j), lod=0, frame=f)
    else:
        ms.box(load, (.085, .22, .06), at=(0, .04, G + .05), lod=lod, frame=f)
    for sx in (-1, 1):
        for y2 in (-.16, .02, .1):
            ms.cyl('dark', .025, .025, .02, at=(sx * .05, y2, G + .025), rot=(0, 90, 0), segs=8, lod=0, frame=f)


def blast_wall(ms, x0, y, n, step=.12, lod=1):
    for k in range(n):
        ms.box('in_plinth', (step * .85, .05, .12), at=(x0 + step * k, y, G), lod=lod, taper=.8)


def expedition_camp(ms, rng):
    """22 x 22 m: a forward operating base: stacked containers round a yard, a satellite dish, a cell mast, a
    helipad with a drone, a blast-wall line, the flag."""
    ms.box('in_pad', (1.8, 1.8, .004), at=(0, 0, G), lod=1)
    for k, (x, y) in enumerate([(-.55, .55), (-.55, .45), (.1, .7), (.45, .7)]):
        z = ik.container(ms, x, y, 0, mat='in_cont_blue' if k % 2 else 'in_panel', lod=2)
        if k < 2:
            ik.container(ms, x, y, 0, mat='in_panel', z=z, lod=1)
    ik.dish(ms, .7, .3, r=.1)
    top_p = ik.pylon(ms, -.70, -.70, h=.9)
    ik.landing_pad(ms, .3, -.25, r=.26)
    ik.vtol(ms, .3, -.25, yaw=20, s=1.4)
    blast_wall(ms, -.7, -.5, 6)
    top = flag_pole(ms, -.15, -.85, .75)
    return sockets((0, -1.05, 0), (0, -1.45, 0), [(-.55, .55, .15), (.1, .7, .1), (.7, .3, .15), (-.70, -.70, top_p[2])], (-.55, .45, .2), banner=top, drop=(0, -.85, 0))


def town_hall(ms, rng):
    """20 x 20 m: the headquarters: a glass office tower on a wide podium (the keep, centred, the largest building),
    a glass atrium at its foot, a cell mast on the roof, a helipad, an armoured vehicle, the flag plaza."""
    ms.box('in_pad', (1.9, 1.9, .004), at=(0, 0, G), lod=1)
    ms.box('in_plinth', (1.3, .9, .04), at=(0, .25, G), lod=2)
    ms.box('in_panel_win', (1.2, .8, .16), at=(0, .25, G + .04), lod=2)
    ms.box('in_panel', (1.21, .81, .015), at=(0, .25, G + .2), lod=1)
    ms.box('in_panel_win', (.5, .4, .62), at=(0, .3, G + .2), lod=2)
    ms.box('in_panel', (.52, .42, .03), at=(0, .3, G + .82), lod=1)
    for k in range(4):  # the tower's spandrel bands
        ms.box('in_panel', (.505, .405, .012), at=(0, .3, G + .32 + .14 * k), lod=0)
    ms.box('in_graphite', (.04, .04, .28), at=(.12, .38, G + .85), lod=1, taper=.5)
    ik.dome(ms, -.42, -.18, .14, glow=False)
    ik.landing_pad(ms, .65, .75, r=.2)
    ik.hover_tank_prop(ms, -.55, -.6, yaw=15)
    for x in (-.4, .4):
        ms.box('in_mark', (.012, .5, .004), at=(x, -.70, G + .004), lod=0)
    top = flag_pole(ms, 0, -.70, .75)
    return sockets((0, -.97, 0), (0, -1.4, 0), [(-.3, .2, .3), (.3, .1, .3), (0, .3, .85), (-.55, -.6, .15)], (0, .3, 1.0), banner=top, drop=(.35, -.98, 0))


def food_depot(ms, rng):
    """10 x 10 m: a logistics warehouse: a long clad shed with three dock doors, a container stack, a truck."""
    f = tm.house_frame(0, .18, 0)
    ms.box('in_panel', (.8, .36, .18), at=(0, 0, G), lod=2, frame=f)
    ms.box('in_graphite', (.82, .38, .015), at=(0, 0, G + .18), lod=1, frame=f)
    for k in range(3):
        ms.box('in_graphite', (.14, .01, .12), at=(-.26 + .26 * k, -.185, G), lod=1, frame=f)
    ms.box('in_glow', (.8, .006, .006), at=(0, -.184, G + .15), lod=0, frame=f)
    z = ik.container(ms, -.3, -.3, 90, mat='in_cont_red')
    ik.container(ms, -.3, -.3, 90, mat='in_cont_blue', z=z)
    truck(ms, .25, -.32, yaw=90, load='in_panel')
    return sockets((0, -.5, 0), (0, -.85, 0), [(-.26, .18, .2), (.26, .18, .2), (0, .18, .22), (.25, -.32, .1)], (0, .18, .3), drop=(0, -.45, 0))


def farm_plot(ms, rng):
    """14 x 14 m: four polytunnel greenhouse rows, a solar array, a water tank."""
    for x in (-.46, -.16, .16, .46):
        f = tm.house_frame(x, .05, 90)
        ms.box('md_soil', (1.0, .20, .02), at=(0, 0, G), lod=1, frame=f)
        ms.cyl('md_poly', .11, .11, 1.0, at=(-.5, 0, G + .02), rot=(0, 90, 0), segs=8, lod=1, frame=f)
        ms.box('md_poly', (1.0, .2, .1), at=(0, 0, G), lod=2, frame=f)
    ik.solar_array(ms, 0, -.62, w=.8, d=.2)
    ms.cyl('in_panel', .08, .08, .2, at=(.62, -.6, G), segs=10, lod=1)
    return sockets((0, -.7, 0), (0, -.95, 0), [(-.46, .1, .08), (.16, -.3, .08), (.46, .2, .08), (-.16, -.2, .08)], (0, 0, .1), drop=(0, -.6, 0))


def barracks(ms, rng):
    """16 x 12 m: two modular accommodation blocks with window rows, a drill pad with painted lines, a weapon rack, the flag."""
    ik.pod(ms, 0, .36, 1.2, .26, .2, mat='in_panel')
    ik.pod(ms, -.35, -.12, .30, .50, .18, mat='in_panel')
    for k in range(5):
        ms.box('in_glass', (.08, .005, .05), at=(-.45 + .22 * k, .225, G + .12), lod=0)
    ms.box('in_pad', (.6, .5, .004), at=(.3, -.15, G), lod=1)
    for y in (-.3, -.1, .1):
        ms.box('in_mark', (.5, .01, .004), at=(.3, y, G + .004), lod=0)
    rb.spear_rack(ms, .45, -.05, yaw=0)
    top = flag_pole(ms, .3, -.25, .7)
    return sockets((0, -.55, 0), (0, -.9, 0), [(0, .36, .3), (-.35, -.12, .3), (.6, .36, .3), (.45, -.25, .1)], (0, .36, .4), banner=top)


def aid_post(ms, rng):
    """12 x 12 m: a field hospital: a glass-fronted clinic block with a red cross, a helipad, the flag."""
    ik.pod(ms, -.15, .18, .5, .34, .2)
    ms.box('in_cont_red', (.1, .01, .03), at=(-.15, .005, G + .2), lod=0)
    ms.box('in_cont_red', (.03, .01, .1), at=(-.15, .005, G + .165), lod=0)
    ik.landing_pad(ms, .30, -.30, r=.18)
    top = flag_pole(ms, -.4, -.5, .6)
    return sockets((0, -.6, 0), (0, -.9, 0), [(-.15, .18, .25), (.3, -.3, .1), (.3, .3, .1), (0, .4, .1)], (-.15, .18, .3), banner=top)


def tower(ms, rng):
    """8 x 8 m, 14 m: a cell mast over a concrete guard post with a slit and its blast wall."""
    f = tm.house_frame(0, .05, 0)
    ms.box('in_plinth', (.5, .5, .18), at=(0, 0, G), lod=2, frame=f)
    ms.box('dark', (.3, .01, .03), at=(0, -.255, G + .12), lod=0, frame=f)
    blast_wall(ms, -.18, -.34, 4)
    top_p = ik.pylon(ms, 0, .05, h=1.1, r=.08)
    top = flag_pole(ms, -.3, .3, 1.2, w=.16, fh=.1)
    return sockets((0, -.42, 0), (0, -.7, 0), [(0, .05, 1.0), (0, .05, .2), (-.18, -.22, .1), (.12, .18, .6)], (0, .05, top_p[2]), banner=top)


def generator(ms, rng):
    """12 x 12 m: a solar farm: rows of panels, two battery containers, a wind turbine, a transformer."""
    for k in range(3):
        ik.solar_array(ms, -.15, .45 - .3 * k, w=.7, d=.18)
    for k in range(2):
        ik.container(ms, -.35 + .3 * k, -.45, 0, mat='in_panel', lod=2)
    ms.cyl('in_panel', .025, .015, 1.0, at=(.55, .3, G), segs=8, lod=2)
    ms.box('in_panel', (.06, .1, .05), at=(.55, .25, G + 1.0), lod=1)
    for k in range(3):
        a = math.radians(120 * k + 15)
        ms.box('in_panel', (.02, .006, .36), at=(.55 + .18 * math.cos(a), .19, G + 1.02 + .18 * math.sin(a) - .18), lod=1)
    ms.box('in_graphite', (.12, .1, .1), at=(.5, -.4, G), lod=1)
    return sockets((0, -.6, 0), (0, -.9, 0), [(-.15, .45, .1), (-.35, -.45, .08), (.5, -.4, .1), (.55, .3, .5)], (.5, -.4, .12))


def airfield(ms, rng):
    """30 x 30 m: a drone field: two helipads with drones, a control block with a dish, a short strip with marks."""
    ik.landing_pad(ms, -.55, .0, r=.42)
    ik.landing_pad(ms, .55, .0, r=.42)
    ik.vtol(ms, -.55, .0, yaw=30, s=2.0)
    ik.vtol(ms, .55, .0, yaw=-20, s=2.0)
    ik.pod(ms, 0, .85, .40, .26, .22)
    ik.dish(ms, -.3, .85, r=.1)
    ms.box('in_pad', (2.2, .3, .004), at=(0, -.75, G), lod=1)
    for k in range(7):
        ms.box('in_mark', (.14, .02, .002), at=(-.9 + .3 * k, -.75, G + .004), lod=0)
    top = flag_pole(ms, .7, .85, .6)
    return sockets((0, -1.0, 0), (0, -1.6, 0), [(-.55, 0, .2), (.55, 0, .2), (0, .85, .3), (-.3, .85, .1)], (0, .85, .4), banner=top)


def radar_aa(ms, rng):
    """16 x 16 m: a radar under a white dome on a lattice mast, two missile launchers on trucks, a cabin."""
    ms.box('in_graphite', (.1, .1, .55), at=(0, .35, G), lod=2, taper=.6)
    ms.sphere('in_panel', .16, at=(0, .35, G + .66), u=12, v=6, lod=2)
    truck(ms, -.45, -.3, yaw=0, launcher=True)
    truck(ms, .45, -.3, yaw=0, launcher=True)
    ik.pod(ms, .5, .45, .26, .2, .14, mat='in_panel')
    top = flag_pole(ms, -.6, .55, .6)
    return sockets((0, -.8, 0), (0, -1.15, 0), [(0, .35, .5), (-.45, -.3, .1), (.45, -.3, .1), (.5, .45, .15)], (0, .35, .7), banner=top)


def trade_post(ms, rng):
    """14 x 14 m: a shopping arcade: a glass atrium, two canopies on slim posts, a container, a parking strip."""
    ms.box('in_pad', (1.3, 1.3, .004), at=(0, 0, G), lod=1)
    ik.dome(ms, 0, .38, .22)
    for x in (-.38, .38):
        for sx in (-1, 1):
            for sy in (-1, 1):
                ms.cyl('in_graphite', .01, .01, .22, at=(x + sx * .14, -.25 + sy * .12, G), segs=4, lod=0)
        ms.box('in_panel', (.34, .30, .02), at=(x, -.25, G + .22), lod=1)
        ms.box('in_glow', (.30, .006, .01), at=(x, -.40, G + .225), lod=0)
    ik.container(ms, .55, .1, 90, mat='in_cont_red')
    for k in range(4):
        ms.box('in_mark', (.01, .12, .002), at=(-.6 + .1 * k, .55, G + .004), lod=0)
    top = flag_pole(ms, -.6, -.6, .6)
    return sockets((0, -.7, 0), (0, -1.05, 0), [(0, .38, .3), (-.38, -.25, .25), (.38, -.25, .25), (.58, .1, .2)], (0, .38, .4), banner=top, drop=(0, -.6, 0))


def mine(ms, rng):
    """12 x 12 m: a quarry plant: a conveyor up to a hopper tower, a processing block, a spoil heap, a dumper truck."""
    ms.box('in_graphite', (.16, .16, .55), at=(.3, .25, G), lod=2, taper=.85)
    ms.box('in_panel', (.2, .2, .1), at=(.3, .25, G + .55), lod=1)
    ms.box('in_graphite', (.05, .6, .02), at=(.05, 0, G + .25), rot_z=35, lod=1)
    ik.pod(ms, -.35, .2, .3, .3, .16, mat='in_panel')
    ms.sphere('in_plinth', .22, at=(-.25, -.3, G - .02), scale=(1.2, 1, .5), u=8, v=4, cut_below=0.0, lod=2)
    truck(ms, .35, -.35, yaw=-30, load='in_ochre')
    return sockets((0, -.5, 0), (0, -.85, 0), [(.3, .25, .6), (-.35, .2, .25), (.3, -.42, .1), (-.25, -.3, .1)], (-.35, .2, .3), drop=(0, -.45, 0))


def stable(ms, rng):
    """20 x 16 m: the vehicle depot: a clad hangar with an open bay to the front, two armoured vehicles on the
    apron, a wash gantry, painted bay lines."""
    ms.box('in_pad', (1.9, 1.5, .004), at=(0, 0, G), lod=1)
    f = tm.house_frame(-.25, .25, 0)
    ms.box('in_panel', (.9, .6, .32), at=(0, 0, G), lod=2, frame=f)
    ms.box('in_graphite', (.92, .62, .02), at=(0, 0, G + .32), lod=1, frame=f)
    ms.box('dark', (.6, .02, .24), at=(0, -.305, G), lod=1, frame=f)
    ik.hover_tank_prop(ms, -.25, -.45, yaw=0)
    ik.hover_tank_prop(ms, .55, -.35, yaw=-20)
    for sx in (-1, 1):
        ms.box('in_graphite', (.03, .03, .4), at=(.55 + sx * .2, .25, G), lod=1)
    ms.box('in_graphite', (.45, .04, .04), at=(.55, .25, G + .4), lod=1)
    for x in (-.7, .2):
        ms.box('in_mark', (.012, .6, .004), at=(x, -.4, G + .004), lod=0)
    top = flag_pole(ms, -.8, -.65, .6)
    return sockets((-.25, -.75, 0), (0, -1.1, 0), [(-.25, .2, .35), (-.25, -.45, .1), (.55, .1, .4), (.55, -.35, .1)], (-.25, .25, .45), banner=top)


def siege_workshop(ms, rng):
    """20 x 16 m: the rocket artillery park: three launcher trucks behind a blast wall, ammunition containers."""
    ms.box('in_pad', (1.9, 1.5, .004), at=(0, 0, G), lod=1)
    for x in (-.6, 0.0, .6):
        truck(ms, x, -.05, yaw=180, launcher=True)
    blast_wall(ms, -.75, -.6, 10, step=.165)
    for k in range(2):
        ik.container(ms, .6, .55 + .1 * k, 0, mat='in_cont_blue' if k else 'in_panel')
    top = flag_pole(ms, -.85, .6, .65)
    return sockets((0, -.75, 0), (0, -1.1, 0), [(-.6, -.1, .2), (0, -.1, .2), (.6, -.1, .2), (.65, .58, .2)], (0, .4, .3), banner=top)


NEW = {'expedition-camp': expedition_camp, 'town-hall': town_hall, 'food-depot': food_depot, 'farm-plot': farm_plot,
       'barracks': barracks, 'aid-post': aid_post, 'tower': tower, 'trade-post': trade_post, 'mine': mine, 'stable': stable,
       'siege-workshop': siege_workshop}
EXTRAS = {'generator': generator, 'airfield': airfield, 'radar-aa': radar_aa}
ROLES = [(n, NEW[n] if n in NEW else remat(fn)) for n, fn in rm.ROLES if n not in EXTRAS] + [(n, fn) for n, fn in EXTRAS.items()]
STAGES = [(n, remat(fn)) for n, fn in rm.STAGES]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-information')
    atlas = int(argv[1]) if len(argv) > 1 else 1024
    only = [a for a in os.environ.get('ONLY', '').split(',') if a]
    items = []
    for name, fn in ROLES:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
        items.append((name + '-damaged', rb.grounded(name + '-damaged', remat(rb.damaged(fn), DAMAGE_MATS)), None))
    for name, fn in STAGES:
        if only and name not in only:
            continue
        items.append((name, rb.grounded(name, fn), None))
    items += rb.ruined_items([(n, fn) for n, fn in ROLES if not only or n in only])
    counts = tt.build_file('rts-information', items, out_dir, atlas=atlas, seed=3700, write=False)
    scene = bpy.context.scene
    roots = [o for o in scene.objects if o.type == 'EMPTY' and o.name in {n for n, _, _ in items}]
    for root in roots:
        for sname, (x, y, z) in rb.SOCKETS.get(root.name, {}).items():
            e = bpy.data.objects.new(sname, None)
            scene.collection.objects.link(e)
            e.empty_display_size = 0.05
            e.parent = root
            e.location = (x, y, max(0.0, z - (G if sname == 'socket-banner' else 0)))
            if sname == 'socket-door':
                e.rotation_euler = (0, 0, math.pi)
    exported = [o for o in scene.objects if o.type in ('MESH', 'EMPTY')]
    os.makedirs(out_dir, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'rts-information.blend'))
    tm.export_glb(os.path.join(out_dir, 'rts-information.glb'), exported)
    import json
    with open(os.path.join(out_dir, 'report.json'), 'w') as fh:
        json.dump({'file': 'rts-information.glb', 'triangles': counts, 'sockets': rb.SOCKETS, 'atlas': atlas}, fh, indent=2)
    print('RTS_INFORMATION_BUILT', len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
