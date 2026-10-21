# scripts/blender/build_rts_future.py
# The Future battle buildings, src/assets/battle/rts/rts-future.glb (eight-ages plan U87, KTD16): the 13 roles of a
# battle economy and the late extras (generator, airfield, radar-aa), each whole, `-damaged` and `-ruined`, with
# LOD0..LOD2, their sockets and the four construction stages, in the Future kit's look (ti_future_kit.py: white
# composite pods with dark glazing, graphite plinths, tinted glass domes, landing pads, shield pylons, solar
# arrays, thin cyan light lines). Fourteen roles are new; the materials yard and the range are the Modern layouts (build_rts_modern.py)
# re-dressed in the Future materials (md_* to fu_*):
#   expedition-camp  a forward base: three domes round a landing pad with a tilt-rotor, a shield pylon, crates
#   town-hall        the command spire: a large glass dome on a white drum (the keep, centred, the largest
#                    building), a slim spire with light rings, two pylons, a landing pad, a hover tank
#   food-depot       hydroponic store: two green-glass domes and a white pod with a loading bay
#   farm-plot        hydroponic greenhouse rows under arched glass, a solar array
#   barracks         two long white habitation pods, a drill pad with light lines, a flag
#   aid-post         a medical dome with a white pod, a landing pad, the team flag
#   tower            a shield pylon over a graphite bunker
#   generator        a fusion core: a white torus on a plinth with a glowing ring, two cooling stacks, cables
#   airfield         two landing pads with tilt-rotors, a control pod, a solar array
#   radar-aa         a sensor array (three panels on a mast) and two laser turret pods
#   blender -b --factory-startup -P scripts/blender/build_rts_future.py -- [out_dir] [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_future_kit as fk  # noqa: E402,F401 (registers the fu_ materials)
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
import build_rts_modern as rm  # noqa: E402
from ti_town import G  # noqa: E402

# the Modern stuff in its Future counterpart
FU = {'md_render': 'fu_panel', 'md_render_win': 'fu_panel_win', 'md_brick': 'fu_graphite', 'md_brick_win': 'fu_panel_win', 'md_concrete': 'fu_plinth',
      'md_bunker': 'fu_graphite', 'md_corrugated': 'fu_panel', 'md_prefab': 'fu_panel', 'md_slate': 'fu_graphite', 'md_slate_dark': 'fu_graphite',
      'md_roof': 'fu_graphite', 'md_steel': 'fu_graphite', 'md_glass': 'fu_glass', 'md_shop': 'fu_glass', 'md_asphalt': 'fu_pad', 'md_gravel': 'fu_pad',
      'md_sandbag': 'fu_plinth', 'md_wood': 'fu_graphite', 'md_poly': 'fu_glass', 'md_wheat': 'fu_green', 'md_veg': 'fu_green', 'md_lime': 'fu_panel',
      'md_olive': 'fu_graphite', 'md_olive_dark': 'fu_graphite', 'md_camo': 'fu_panel', 'md_tyre': 'fu_graphite', 'md_jerry': 'fu_panel',
      'md_soil': 'fu_plinth', 'md_mulch': 'fu_plinth', 'md_pipe': 'fu_graphite', 'md_mesh': 'fu_graphite', 'md_wire': 'fu_graphite', 'md_marking': 'fu_mark',
      'md_pave': 'fu_pad', 'md_turf': 'fu_green', 'md_leaf': 'fu_green', 'md_hedge': 'fu_green', 'md_dome': 'fu_glass'}
DAMAGE_MATS = dict(FU, mudwall='fu_plinth', pylon='fu_plinth')
flag_pole = rm.flag_pole
sockets = rm.sockets


def remat(layout, mapping=FU):
    return rc.remat(layout, mapping)


def expedition_camp(ms, rng):
    """22 x 22 m: three domes round a landing pad with a tilt-rotor, a shield pylon, crates, a light-lined yard."""
    ms.box('fu_pad', (1.8, 1.8, .004), at=(0, 0, G), lod=1)
    fk.dome(ms, 0, .62, .30)
    fk.dome(ms, -.62, .05, .24)
    fk.dome(ms, .62, .15, .24)
    fk.landing_pad(ms, .0, -.35, r=.30)
    fk.vtol(ms, .0, -.35, yaw=20)
    top_p = fk.pylon(ms, -.70, -.70, h=.9)
    for k in range(3):
        ms.box('fu_graphite', (.08, .08, .07), at=(.62 + .1 * (k % 2), -.62 + .1 * k, G), lod=0)
    top = flag_pole(ms, -.15, -.85, .75)
    return sockets((0, -1.05, 0), (0, -1.45, 0), [(0, .62, .35), (-.62, .05, .3), (.62, .15, .3), (-.70, -.70, top_p[2])], (0, .62, .45), banner=top, drop=(0, -.85, 0))


def town_hall(ms, rng):
    """20 x 20 m: the command spire: a big tinted dome on a white drum, a slim spire with light rings, two
    pylons, a landing pad, a hover tank, light lines across a pad plaza."""
    ms.box('fu_pad', (1.9, 1.9, .004), at=(0, 0, G), lod=1)
    for k, s in enumerate((24, 14, 10)):
        ms.cyl('fu_panel_win', .62, .62, .26, at=(0, .15, G), segs=s, lod=k, only=(k,))
        ms.sphere('fu_glass', 1.0, at=(0, .15, G + .26), scale=(.60, .60, .45), u=s, v=max(4, s // 2), lod=k, only=(k,), cut_below=0.0)
    ms.cyl('fu_glow', .625, .625, .012, at=(0, .15, G + .26), segs=24, lod=0, caps=False)
    ms.cyl('fu_graphite', .05, .02, .70, at=(0, .15, G + .70), segs=8, lod=1)
    for k in range(3):
        ms.cyl('fu_glow', .06 - .012 * k, .06 - .012 * k, .015, at=(0, .15, G + .80 + .17 * k), segs=8, lod=0)
    fk.pylon(ms, -.80, -.80, h=.7)
    fk.pylon(ms, .80, -.80, h=.7)
    fk.landing_pad(ms, .60, .75, r=.22)
    fk.hover_tank_prop(ms, -.45, -.55, yaw=15)
    for x in (-.4, .4):
        ms.box('fu_glow', (.012, .5, .004), at=(x, -.70, G + .004), lod=0)
    top = flag_pole(ms, 0, -.70, .75)
    return sockets((0, -.97, 0), (0, -1.4, 0), [(-.3, .2, .6), (.3, .1, .6), (0, .2, .9), (-.45, -.55, .15)], (0, .2, 1.0), banner=top, drop=(.35, -.98, 0))


def food_depot(ms, rng):
    """10 x 10 m: two green-glass hydroponic domes and a white store pod with a loading bay, crates."""
    fk.dome(ms, -.22, .18, .18, mat='fu_green')
    fk.dome(ms, .22, .18, .18, mat='fu_green')
    fk.pod(ms, 0, -.20, .50, .20, .14)
    ms.box('fu_graphite', (.18, .02, .10), at=(0, -.305, G + .04), lod=0)
    for k in range(3):
        ms.box('fu_panel', (.07, .07, .06), at=(-.3 + .1 * k, -.42, G), lod=0)
    return sockets((0, -.5, 0), (0, -.85, 0), [(-.22, .18, .2), (.22, .18, .2), (0, -.2, .2), (.3, -.42, .1)], (0, -.2, .3), drop=(0, -.45, 0))


def farm_plot(ms, rng):
    """14 x 14 m: four hydroponic greenhouse rows under arched glass, a solar array, a water tank."""
    for k, x in enumerate((-.46, -.16, .16, .46)):
        f = tm.house_frame(x, .05, 90)
        ms.box('fu_green', (1.0, .20, .03), at=(0, 0, G), lod=1, frame=f)
        ms.cyl('fu_glass', .11, .11, 1.0, at=(-.5, 0, G + .02), rot=(0, 90, 0), segs=8, lod=1, frame=f)
        ms.box('fu_glass', (1.0, .2, .1), at=(0, 0, G), lod=2, frame=f)
    fk.solar_array(ms, 0, -.62, w=.8, d=.2)
    ms.cyl('fu_panel', .08, .08, .2, at=(.62, -.6, G), segs=10, lod=1)
    return sockets((0, -.7, 0), (0, -.95, 0), [(-.46, .1, .08), (.16, -.3, .08), (.46, .2, .08), (-.16, -.2, .08)], (0, 0, .1), drop=(0, -.6, 0))


def barracks(ms, rng):
    """16 x 12 m: two long white habitation pods, a drill pad with light lines, a weapon rack, a flag."""
    fk.pod(ms, 0, .36, 1.2, .26, .20)
    fk.pod(ms, -.35, -.12, .30, .50, .18, yaw=0)
    ms.box('fu_pad', (.6, .5, .004), at=(.3, -.15, G), lod=1)
    for y in (-.3, -.1, .1):
        ms.box('fu_glow', (.5, .01, .004), at=(.3, y, G + .004), lod=0)
    rb.spear_rack(ms, .45, -.05, yaw=0)
    top = flag_pole(ms, .3, -.25, .7)
    return sockets((0, -.55, 0), (0, -.9, 0), [(0, .36, .3), (-.35, -.12, .3), (.6, .36, .3), (.45, -.25, .1)], (0, .36, .4), banner=top)


def aid_post(ms, rng):
    """12 x 12 m: a medical dome with a white pod, a small landing pad, the team flag."""
    fk.dome(ms, -.2, .15, .24, mat='fu_panel', ring='fu_plinth')
    ms.box('fu_glow', (.12, .01, .03), at=(-.2, -.10, G + .14), lod=0)
    ms.box('fu_glow', (.03, .01, .12), at=(-.2, -.10, G + .095), lod=0)
    fk.pod(ms, .32, .30, .26, .30, .14)
    fk.landing_pad(ms, .30, -.30, r=.18)
    top = flag_pole(ms, 0, -.5, .6)
    return sockets((0, -.6, 0), (0, -.9, 0), [(-.2, .15, .25), (.32, .3, .2), (.3, -.3, .1), (0, .4, .1)], (.32, .3, .3), banner=top)


def tower(ms, rng):
    """8 x 8 m, 14 m: a shield pylon over a graphite bunker with a glowing slit."""
    f = tm.house_frame(0, .05, 0)
    ms.box('fu_graphite', (.5, .5, .18), at=(0, 0, G), lod=2, frame=f, bevel=.04)
    ms.box('fu_glow', (.3, .01, .02), at=(0, -.255, G + .12), lod=0, frame=f)
    top_p = fk.pylon(ms, 0, .05, h=1.1, r=.08)
    top = flag_pole(ms, -.3, .3, 1.2, w=.16, fh=.1)
    return sockets((0, -.34, 0), (0, -.65, 0), [(0, .05, 1.0), (0, .05, .2), (-.18, -.22, .1), (.12, .18, .6)], (0, .05, top_p[2]), banner=top)


def generator(ms, rng):
    """12 x 12 m: a fusion core: a white torus on a plinth with a glowing ring, two cooling stacks, cables."""
    ms.cyl('fu_plinth', .34, .34, .06, at=(-.1, .1, G), segs=16, lod=2)
    for k, s in enumerate((20, 12, 8)):
        ms.cyl('fu_panel', .30, .26, .22, at=(-.1, .1, G + .06), segs=s, lod=k, only=(k,))
    ms.cyl('fu_glow', .27, .27, .03, at=(-.1, .1, G + .17), segs=20, lod=0, caps=False)
    ms.sphere('fu_glow', .10, at=(-.1, .1, G + .30), u=10, v=5, lod=1)
    for x in (.35, .55):
        ms.cyl('fu_panel', .07, .05, .45, at=(x, .35, G), segs=10, lod=1)
        ms.cyl('fu_glow', .052, .052, .01, at=(x, .35, G + .45), segs=10, lod=0)
    for k in range(3):
        ms.box('fu_graphite', (.02, .5, .02), at=(.15 + .03 * k, -.15, G), lod=0)
    return sockets((0, -.6, 0), (0, -.9, 0), [(-.1, .1, .3), (.35, .35, .45), (.5, -.25, .1), (-.45, -.35, .1)], (.45, .35, .55))


def airfield(ms, rng):
    """30 x 30 m: two landing pads with tilt-rotors, a control pod with a glass top, a solar array, light lines."""
    fk.landing_pad(ms, -.55, .0, r=.42)
    fk.landing_pad(ms, .55, .0, r=.42)
    fk.vtol(ms, -.55, .0, yaw=30, s=1.4)
    fk.vtol(ms, .55, .0, yaw=-20, s=1.4)
    fk.pod(ms, 0, .85, .40, .26, .22)
    fk.dome(ms, 0, .85, .12, mat='fu_glass', ring='fu_graphite', glow=False)
    fk.solar_array(ms, -.9, .85, w=.6)
    for x in (-1.2, 1.2):
        ms.box('fu_glow', (.012, 1.6, .004), at=(x, 0, G + .004), lod=0)
    top = flag_pole(ms, .7, .85, .6)
    return sockets((0, -.8, 0), (0, -1.6, 0), [(-.55, 0, .2), (.55, 0, .2), (0, .85, .3), (-.9, .85, .1)], (0, .85, .4), banner=top)


def radar_aa(ms, rng):
    """16 x 16 m: a sensor array of three panels on a mast and two laser turret pods on plinths."""
    ms.cyl('fu_graphite', .04, .03, .7, at=(0, .35, G), segs=8, lod=1)
    for k in range(3):
        a = math.radians(120 * k)
        f = tm.house_frame(0, .35, math.degrees(a))
        ms.box('fu_panel', (.24, .02, .2), at=(0, -.06, G + .55), lod=1, frame=f)
        ms.box('fu_glow', (.2, .006, .01), at=(0, -.072, G + .6), lod=0, frame=f)
    for sx in (-1, 1):
        ms.cyl('fu_plinth', .16, .16, .06, at=(sx * .48, -.3, G), segs=12, lod=2)
        ms.sphere('fu_panel', .12, at=(sx * .48, -.3, G + .06), u=10, v=5, lod=1, cut_below=0.0)
        ms.box('fu_graphite', (.04, .26, .04), at=(sx * .48, -.42, G + .12), lod=1)
        ms.box('fu_glow', (.03, .01, .03), at=(sx * .48, -.555, G + .125), lod=0)
    top = flag_pole(ms, -.6, .55, .6)
    return sockets((0, -.8, 0), (0, -1.15, 0), [(0, .35, .5), (-.48, -.3, .1), (.48, -.3, .1), (.55, .45, .15)], (0, .62, .3), banner=top)


def trade_post(ms, rng):
    """14 x 14 m: an exchange: a glass kiosk dome, two white market canopies on slim posts, cargo pods, a landing pad."""
    ms.box('fu_pad', (1.3, 1.3, .004), at=(0, 0, G), lod=1)
    fk.dome(ms, 0, .38, .22)
    for x in (-.38, .38):
        for sx in (-1, 1):
            for sy in (-1, 1):
                ms.cyl('fu_graphite', .01, .01, .22, at=(x + sx * .14, -.25 + sy * .12, G), segs=4, lod=0)
        ms.box('fu_panel', (.34, .30, .02), at=(x, -.25, G + .22), lod=1)
        ms.box('fu_glow', (.30, .006, .01), at=(x, -.40, G + .225), lod=0)
    for k in range(3):
        ms.box('fu_panel', (.10, .10, .08), at=(.55, .1 + .12 * k, G), lod=0, bevel=.01)
    fk.landing_pad(ms, -.5, .45, r=.16)
    top = flag_pole(ms, -.6, -.6, .6)
    return sockets((0, -.7, 0), (0, -1.05, 0), [(0, .38, .3), (-.38, -.25, .25), (.38, -.25, .25), (.58, .1, .2)], (0, .38, .4), banner=top, drop=(0, -.6, 0))


def mine(ms, rng):
    """12 x 12 m: an extractor: a graphite drill tower over the shaft with light rings, a white processing pod, ore canisters."""
    x, y = .15, .05
    ms.cyl('fu_plinth', .20, .20, .05, at=(x, y, G), segs=8, lod=2)
    ms.cyl('fu_graphite', .10, .06, .75, at=(x, y, G + .05), segs=6, lod=2)
    for k in range(3):
        ms.cyl('fu_glow', .09 - .01 * k, .09 - .01 * k, .015, at=(x, y, G + .2 + .2 * k), segs=8, lod=0)
    for sx in (-1, 1):
        ms.box('fu_graphite', (.03, .03, .6), at=(x + sx * .16, y, G), lod=0, taper=.6)
    fk.pod(ms, -.35, .10, .30, .36, .16)
    for k in range(3):
        ms.cyl('fu_panel', .05, .05, .12, at=(.3 + .1 * (k % 2), -.35 + .1 * k, G), segs=8, lod=0)
    return sockets((0, -.5, 0), (0, -.85, 0), [(x, y, .7), (-.35, .1, .25), (.3, .42, .1), (.05, -.35, .1)], (-.35, .1, .3), drop=(0, -.45, 0))


def stable(ms, rng):
    """20 x 16 m: the vehicle bay: a long white hangar pod with an open bay to the front, two hover tanks on the
    pad, a service gantry, glowing bay lines."""
    ms.box('fu_pad', (1.9, 1.5, .004), at=(0, 0, G), lod=1)
    f = tm.house_frame(-.25, .25, 0)
    ms.box('fu_panel_win', (.9, .6, .32), at=(0, 0, G), lod=2, frame=f, bevel=.08)
    ms.box('fu_graphite', (.6, .02, .24), at=(0, -.305, G), lod=1, frame=f)
    ms.box('fu_glow', (.62, .006, .012), at=(0, -.312, G + .25), lod=0, frame=f)
    fk.hover_tank_prop(ms, -.25, -.45, yaw=0)
    fk.hover_tank_prop(ms, .55, -.35, yaw=-20)
    for sx in (-1, 1):
        ms.box('fu_graphite', (.03, .03, .4), at=(.55 + sx * .2, .25, G), lod=1)
    ms.box('fu_graphite', (.45, .04, .04), at=(.55, .25, G + .4), lod=1)
    for x in (-.7, .2):
        ms.box('fu_glow', (.012, .6, .004), at=(x, -.4, G + .004), lod=0)
    top = flag_pole(ms, -.8, -.65, .6)
    return sockets((-.25, -.75, 0), (0, -1.1, 0), [(-.25, .2, .35), (-.25, -.45, .1), (.55, .1, .4), (.55, -.35, .1)], (-.25, .25, .45), banner=top)


def siege_workshop(ms, rng):
    """20 x 16 m: the artillery yard: three emitter cannons on hover sleds behind a low graphite wall, power cells."""
    ms.box('fu_pad', (1.9, 1.5, .004), at=(0, 0, G), lod=1)
    for k, x in enumerate((-.6, 0.0, .6)):
        f = tm.house_frame(x, -.05, 0)
        ms.box('fu_graphite', (.26, .40, .06), at=(0, 0, G + .02), lod=1, frame=f, taper=.85)
        ms.cyl('fu_panel', .045, .035, .45, at=(0, .05, G + .1), rot=(-55, 0, 0), segs=8, lod=1, frame=f)
        ms.cyl('fu_glow', .05, .05, .02, at=(0, -.10, G + .22), rot=(-55, 0, 0), segs=8, lod=0, frame=f)
    ms.box('fu_graphite', (1.6, .06, .10), at=(0, -.6, G), lod=1)
    ms.box('fu_glow', (1.4, .006, .01), at=(0, -.632, G + .08), lod=0)
    for k in range(4):
        ms.box('fu_panel', (.08, .08, .10), at=(.6 + .1 * (k % 2), .5 + .1 * (k // 2), G), lod=0, bevel=.01)
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
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-future')
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
    counts = tt.build_file('rts-future', items, out_dir, atlas=atlas, seed=3800, write=False)
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
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'rts-future.blend'))
    tm.export_glb(os.path.join(out_dir, 'rts-future.glb'), exported)
    import json
    with open(os.path.join(out_dir, 'report.json'), 'w') as fh:
        json.dump({'file': 'rts-future.glb', 'triangles': counts, 'sockets': rb.SOCKETS, 'atlas': atlas}, fh, indent=2)
    print('RTS_FUTURE_BUILT', len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
