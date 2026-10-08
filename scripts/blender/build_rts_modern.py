# scripts/blender/build_rts_modern.py
# The Modern battle buildings, src/assets/battle/rts/rts-modern.glb (plans/ART-MODELS-PLAN.md section 5;
# src/assets/battle/rts/README.md): the 13 roles of a battle economy, each with a `<role>-damaged`
# sibling and its sockets, the four construction stages (steel scaffold), and the three Modern extras
# (generator, airfield, radar-aa), in the Modern town kit's look (ti_modern.py: off-white render and red
# brick blocks with painted window grids, flat roofs, prefab cabins with corrugated roofs, chain-link
# fences) and the battle pieces of ti_modern_battle.py (olive vehicles, sandbags, masts, a Nissen hangar).
# Sockets, damage and grounding are build_rts_bronze.py's; the layouts are new except the materials yard
# and the range (the Classical layouts in Modern materials, with steel pipes and an earth butt added):
#   expedition-camp  the command camp: prefab cabins, a radio mast, parked trucks, sandbags, a fence
#   town-hall        the headquarters: a three-storey rendered block (the keep, 20 m, centred) behind a
#                    low wall and fence, a roof mast, flag poles, a sandbagged gate, a jeep
#   food-depot       a corrugated warehouse with a loading dock, pallets of sacks, a forklift
#   trade-post       a kiosk and two market gazebos with team-grey roofs, a van, benches
#   farm-plot        crop beds in a wire fence, a polytunnel, a machinery shed, drums
#   mine             a steel lattice headframe over the shaft, a spoil heap, a winding house
#   barracks         two prefab barrack huts, a drill square with sandbags, a flag
#   stable           the vehicle works: a Nissen hangar with an open bay, a tank on the apron, a fuel bowser
#   siege-workshop   the artillery park: three howitzers under camouflage nets, ammunition crates
#   aid-post         the field hospital: two white ward tents, a prefab, a team flag, a van, stretchers
#   tower            a concrete bunker and gun emplacement under an observation tower
#   generator        a diesel generator container, fuel tanks, a cable run, a fence
#   airfield         an asphalt strip with markings, a Nissen hangar, a control cabin, a parked jet
#   radar-aa         a radar on its mast and two sandbagged twin AA gun pits
# One atlas for the file, LOD0..LOD2 per object.
#   blender -b --factory-startup -P scripts/blender/build_rts_modern.py -- [out_dir] [atlas_px]
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
import ti_map as tm  # noqa: E402
import ti_town as tt  # noqa: E402
import ti_classical as tc  # noqa: E402
import ti_bronze as tb  # noqa: E402
import ti_modern as tmd  # noqa: E402
import ti_modern_battle as mb  # noqa: E402
import build_rts_bronze as rb  # noqa: E402
import build_rts_classical as rc  # noqa: E402
from ti_town import G  # noqa: E402

# the Classical stuff in its Modern counterpart
MATS = {'ashlar': 'md_concrete', 'cream': 'md_render', 'tile': 'md_slate', 'tile_dark': 'md_slate_dark', 'marble': 'md_concrete',
        'mudwall': 'md_brick', 'mudwall_bare': 'md_render', 'roof': 'md_corrugated', 'pylon': 'md_concrete', 'thatch': 'md_corrugated',
        'reed': 'md_corrugated', 'log': 'md_wood', 'bronze': 'md_steel'}
# the construction stages: steel scaffold and concrete
STAGE_MATS = dict(MATS, timber='md_steel', stone='md_concrete', mud='md_concrete')
# the damaged state's rubble heaps (rb.damaged's 'mudwall' when no older material is left) are concrete
DAMAGE_MATS = dict(MATS, mudwall='md_concrete')
WORLD = rc.WORLD
flag_pole = rc.flag_pole


def modern_house(ms, rng, x, y, w, d, storeys=1, yaw=None, rise=0.15, awning_w=None, chimney=False, door=0.0,
                 balcony=False, jar_n=0, gable_front=False, h=None):
    """ti_classical.roman_house's call, answered by a Modern flat-roofed block (render or brick)."""
    wall = 'md_brick_win' if (int(abs(x) * 10 + abs(y) * 7) % 2) else 'md_render_win'
    return tmd.block(ms, rng, x, y, w, d, storeys=max(1, storeys), wall=wall, yaw=0 if yaw is None else yaw, roof='flat',
                     h=h or None, units=1)


def tree(ms, x, y, h=None, r=None, lod=1):
    tmd.tree(ms, x, y, h=0.5, r=0.12)


tc.roman_house = modern_house
tc.cypress = tree


def remat(layout, mapping=MATS):
    return rc.remat(layout, mapping)


def sockets(door, rally, fires, smoke, banner=None, drop=None):
    s = {'socket-door': door, 'socket-rally': rally, 'socket-smoke-1': smoke}
    for k, p in enumerate(fires):
        s[f'socket-fire-{k + 1}'] = p
    if banner:
        s['socket-banner'] = banner
    if drop:
        s['socket-drop'] = drop
    return s


def fence_square(ms, half, gate=0.3):
    tmd.chain_fence(ms, [(-gate / 2, -half), (-half, -half), (-half, half), (half, half), (half, -half), (gate / 2, -half)])


# ---- the roles -------------------------------------------------------------------------------------

def expedition_camp(ms, rng):
    """22 x 22 m: the command camp: three prefab cabins round a gravel yard, a lattice radio mast, two
    lorries and a jeep, sandbags at the gate, a chain-link fence, the team flag."""
    ms.box('md_gravel', (1.7, 1.7, 0.004), at=(0, 0, G), lod=1)
    tmd.prefab(ms, 0.0, 0.62, 0.62, 0.38, wall_h=0.3, rise=0.06)
    tmd.prefab(ms, -0.66, 0.05, 0.36, 0.62, wall_h=0.28, rise=0.06, ridge_y=True)
    tmd.prefab(ms, 0.66, 0.15, 0.36, 0.5, wall_h=0.28, rise=0.06, ridge_y=True)
    mb.lattice_mast(ms, 0.62, 0.68, h=1.15)
    mb.truck(ms, 0.25, -0.28, yaw=180)
    mb.truck(ms, 0.55, -0.4, yaw=180)
    mb.jeep(ms, -0.3, -0.35, yaw=30)
    mb.sandbag_wall(ms, -0.48, -0.95, -0.16, -0.95)
    mb.sandbag_wall(ms, 0.16, -0.95, 0.48, -0.95)
    mb.crates(ms, -0.6, -0.6)
    mb.drums(ms, -0.45, 0.6)
    fence_square(ms, 1.02, gate=0.32)
    top = flag_pole(ms, -0.15, -0.6, 0.75)
    return sockets((0, -1.05, 0), (0, -1.45, 0), [(0, 0.62, 0.4), (-0.66, 0.05, 0.38), (0.66, 0.15, 0.38), (0.4, -0.35, 0.2)], (0, 0.62, 0.5), banner=top, drop=(0, -0.7, 0))


def town_hall(ms, rng):
    """20 x 20 m: the headquarters (the keep, centred, the largest building): a three-storey rendered
    block with a stair house and roof plant, a radio mast on the roof, a low wall and fence, two flag
    poles, a sandbagged gate, a jeep."""
    f = tmd.block(ms, rng, 0, 0.18, 1.3, 0.8, storeys=3, wall='md_render_win', yaw=0, roof='flat', stair=True, units=3)
    hz = G + 3 * tt.STOREY
    ms.cyl('md_steel', 0.008, 0.005, 0.55, at=(0.42, 0.3, hz), segs=4, lod=1)
    ms.cyl('md_steel', 0.006, 0.004, 0.35, at=(-0.45, 0.4, hz), segs=4, lod=0)
    tmd.rect(ms, 'md_asphalt', -0.95, -0.95, 0.95, -0.25, G + 0.002, lod=1)
    for k in range(4):
        ms.box('md_marking', (0.012, 0.18, 0.002), at=(-0.6 + 0.2 * k, -0.45, G + 0.003), lod=0)
    tc.court_wall(ms, -0.95, -0.95, -0.95, 0.95, h=0.1)
    tc.court_wall(ms, 0.95, -0.95, 0.95, 0.95, h=0.1)
    tc.court_wall(ms, -0.95, 0.95, 0.95, 0.95, h=0.1)
    tc.court_wall(ms, -0.95, -0.95, 0.95, -0.95, h=0.1, gaps=((0.5, 0.34),))
    mb.sandbag_wall(ms, -0.32, -1.04, -0.18, -1.04)
    mb.sandbag_wall(ms, 0.18, -1.04, 0.32, -1.04)
    mb.jeep(ms, 0.5, -0.55, yaw=0)
    mb.jeep(ms, -0.55, -0.6, yaw=10)
    tmd.tree(ms, -0.75, 0.75, h=0.5, r=0.12)
    tmd.tree(ms, 0.75, 0.75, h=0.5, r=0.12)
    tmd.lamp(ms, -0.3, -0.3)
    tmd.lamp(ms, 0.3, -0.3)
    flag_pole(ms, -0.2, -0.3, 0.75)
    top = flag_pole(ms, 0.2, -0.3, 0.75)
    return sockets((0, -0.97, 0), (0, -1.4, 0), [(-0.3, 0.2, 1.0), (0.3, 0.1, 1.0), (0, 0.2, 1.3), (-0.55, -0.6, 0.15)], (0, 0.2, 1.35), banner=top, drop=(0.35, -0.98, 0))


def food_depot(ms, rng):
    """10 x 10 m: a corrugated warehouse with a raised loading dock, pallets of sacks and crates, a
    forklift."""
    f = tm.house_frame(0, 0.12, 0)
    ms.box('md_corrugated', (0.8, 0.56, 0.34), at=(0, 0, G), lod=2, frame=f)
    tc.gable_roof(ms, f, 0.8, 0.56, G + 0.34, 0.08, over=0.03, mat='md_corrugated', gable='md_corrugated', ridge='md_steel', thick=0.012)
    ms.box('md_concrete', (0.8, 0.16, 0.06), at=(0, -0.36, G), lod=1, frame=f)
    for x in (-0.2, 0.2):
        ms.box('dark', (0.24, 0.012, 0.22), at=(x, -0.284, G + 0.06), lod=1, frame=f)
    ms.box('md_steel', (0.86, 0.14, 0.012), at=(0, -0.35, G + 0.3), lod=0, frame=f)
    for k in range(3):
        px = -0.32 + 0.18 * k
        ms.box('md_wood', (0.12, 0.12, 0.015), at=(px, -0.42, G), lod=0)
        for j in range(3):
            rb.sack(ms, px - 0.03 + 0.03 * j, -0.42, s=0.9, z=G + 0.015)
    mb.crates(ms, 0.3, -0.42)
    ms.box('md_jerry', (0.06, 0.1, 0.06), at=(0.42, -0.2, G), lod=0, bevel=0.004)  # the forklift
    ms.box('md_steel', (0.05, 0.012, 0.12), at=(0.42, -0.26, G), lod=0)
    return sockets((0, -0.5, 0), (0, -0.85, 0), [(-0.2, 0.12, 0.4), (0.2, 0.12, 0.4), (0, -0.42, 0.1), (0.3, -0.42, 0.1)], (0, 0.12, 0.5), drop=(0, -0.48, 0))


def materials_yard_extra(ms, rng):
    for k in range(6):  # a stack of steel pipes on bearers
        ms.cyl('md_steel', 0.018, 0.018, 0.3, at=(-0.3 + (k % 3) * 0.04, -0.3, G + 0.02 + (k // 3) * 0.034), rot=(-90, 0, 0), segs=6, lod=0 if k > 2 else 1)


def trade_post(ms, rng):
    """14 x 14 m: a glazed kiosk with a team awning, two market gazebos, a delivery van, benches,
    lamps, a paved square."""
    tmd.rect(ms, 'md_pave', -0.68, -0.68, 0.68, 0.68, G + 0.002, lod=1)
    tmd.block(ms, rng, 0, 0.38, 0.62, 0.36, storeys=1, wall='md_render', yaw=0, roof='flat', shop=True, awning=True, h=0.32, units=1)
    tmd.market_tent(ms, rng, -0.38, -0.25, s=0.3)
    tmd.market_tent(ms, rng, 0.38, -0.25, s=0.3)
    mb.truck(ms, 0.58, 0.1, yaw=90, body='md_jerry', canvas='md_jerry', s=0.7)
    for x in (-0.15, 0.15):
        tmd.bench(ms, x, -0.55)
    tmd.lamp(ms, -0.6, -0.6)
    tmd.lamp(ms, 0.6, -0.6)
    top = flag_pole(ms, -0.6, 0.55, 0.6)
    return sockets((0, -0.7, 0), (0, -1.05, 0), [(0, 0.38, 0.35), (-0.38, -0.25, 0.25), (0.38, -0.25, 0.25), (0.58, 0.1, 0.2)], (0, 0.38, 0.45), banner=top, drop=(0, -0.6, 0))


def farm_plot(ms, rng):
    """14 x 14 m: four beds of ripe wheat inside a wire fence, a polytunnel on the north edge, a
    machinery shed, drums."""
    tmd.chain_fence(ms, [(-0.14, -0.68), (-0.68, -0.68), (-0.68, 0.68), (0.68, 0.68), (0.68, -0.68), (0.14, -0.68)], h=0.14, step=0.34)
    for x in (-0.46, -0.16, 0.16, 0.46):
        tb.crop_bed(ms, 'md_wheat', x, -0.16, 0.24, 0.7, rng.uniform(0.07, 0.085), rng)
    tmd.polytunnel(ms, -0.2, 0.48, w=0.24, length=0.8, h=0.13, n=8)
    tmd.prefab(ms, 0.45, 0.48, 0.3, 0.26, wall_h=0.18, rise=0.05)
    mb.drums(ms, 0.5, -0.55, n=3)
    return sockets((0, -0.7, 0), (0, -0.95, 0), [(-0.46, 0.1, 0.08), (0.16, -0.3, 0.08), (0.46, 0.2, 0.08), (-0.16, -0.2, 0.08)], (0, 0, 0.1), drop=(0, -0.6, 0))


def mine(ms, rng):
    """12 x 12 m: a steel lattice headframe with its sheave wheel over the shaft, a brick winding
    house, a spoil heap, ore tubs on rails."""
    x, y = 0.15, 0.05
    for sx in (-1, 1):
        for sy in (-1, 1):
            tmd.rod(ms, 'md_steel', (x + sx * 0.14, y + sy * 0.12, G), (x + sx * 0.05, y + sy * 0.05, G + 0.72), 0.012, segs=4, lod=1)
    for z in (0.2, 0.4, 0.6):
        t = z / 0.72
        hw = 0.14 - 0.09 * t
        ms.box('md_steel', (2 * hw + 0.02, 0.012, 0.012), at=(x, y - (0.12 - 0.07 * t), G + z), lod=0)
        ms.box('md_steel', (2 * hw + 0.02, 0.012, 0.012), at=(x, y + (0.12 - 0.07 * t), G + z), lod=0)
    ms.cyl('md_steel', 0.1, 0.1, 0.015, at=(x - 0.008, y, G + 0.74), rot=(0, 90, 0), segs=12, lod=1)
    ms.box('dark', (0.2, 0.2, 0.01), at=(x, y, G), lod=0)
    tmd.rod(ms, 'md_steel', (x, y, G + 0.74), (-0.3, y + 0.05, G + 0.3), 0.004, segs=3, lod=0)
    tmd.block(ms, rng, -0.35, 0.1, 0.34, 0.3, storeys=1, wall='md_brick_win', yaw=90, roof='gable', rise=0.1, h=0.3)
    ms.sphere('md_soil', 0.25, at=(0.3, 0.42, G - 0.05), scale=(1.3, 0.8, 0.6), u=8, v=4, cut_below=0.0, lod=2)
    for k in range(2):
        ms.box('md_steel', (0.06, 0.09, 0.05), at=(0.0 + 0.1 * k, -0.35, G + 0.01), lod=0, bevel=0.004)
    ms.box('md_steel', (0.4, 0.012, 0.006), at=(0.05, -0.32, G), lod=0)
    ms.box('md_steel', (0.4, 0.012, 0.006), at=(0.05, -0.38, G), lod=0)
    return sockets((0, -0.5, 0), (0, -0.85, 0), [(x, y, 0.7), (-0.35, 0.1, 0.35), (0.3, 0.42, 0.1), (0.05, -0.35, 0.1)], (-0.35, 0.1, 0.45), drop=(0, -0.45, 0))


def barracks(ms, rng):
    """16 x 12 m: two long prefab barrack huts, a drill square with sandbag walls, a rifle rack, a flag."""
    tmd.prefab(ms, 0, 0.36, 1.4, 0.3, wall_h=0.3, rise=0.06, door=-0.3)
    tmd.prefab(ms, -0.35, -0.12, 0.7, 0.28, wall_h=0.28, rise=0.06, door=0.15)
    ms.box('md_gravel', (0.6, 0.5, 0.004), at=(0.45, -0.25, G), lod=1)
    mb.sandbag_wall(ms, 0.15, -0.52, 0.75, -0.52)
    mb.sandbag_wall(ms, 0.75, -0.52, 0.75, 0.0)
    rb.spear_rack(ms, 0.45, -0.05, yaw=0)
    top = flag_pole(ms, 0.3, -0.25, 0.7)
    return sockets((0, -0.55, 0), (0, -0.9, 0), [(0, 0.36, 0.38), (-0.35, -0.12, 0.35), (0.6, 0.36, 0.38), (0.45, -0.25, 0.1)], (0, 0.36, 0.48), banner=top)


def range_extra(ms, rng):
    ms.sphere('md_soil', 0.3, at=(0, 0.66, G - 0.05), scale=(2.6, 0.45, 0.55), u=8, v=4, cut_below=0.0, lod=2)
    mb.sandbag_wall(ms, -0.25, -0.38, 0.55, -0.38)


def stable(ms, rng):
    """20 x 16 m: the vehicle works: a Nissen hangar with its open bay facing the front, a tank on the
    concrete apron, a lifting gantry, a fuel bowser, drums."""
    tmd.rect(ms, 'md_concrete', -0.95, -0.75, 0.95, 0.75, G + 0.002, lod=1)
    mb.nissen(ms, -0.25, 0.2, span=0.8, length=1.0, yaw=0)
    mb.tank(ms, -0.25, -0.5, yaw=0)
    for sx in (-1, 1):
        ms.box('md_steel', (0.03, 0.03, 0.55), at=(0.55 + sx * 0.2, 0.1, G), lod=1)
    ms.box('md_steel', (0.46, 0.04, 0.04), at=(0.55, 0.1, G + 0.55), lod=1)
    tmd.rod(ms, 'md_wire', (0.55, 0.1, G + 0.55), (0.55, 0.1, G + 0.25), 0.004, segs=3, lod=0)
    ms.box('md_olive', (0.14, 0.1, 0.08), at=(0.55, 0.1, G + 0.17), lod=0, bevel=0.006)  # an engine on the hook
    mb.truck(ms, 0.6, -0.45, yaw=90, s=0.8)
    mb.drums(ms, 0.8, 0.5)
    top = flag_pole(ms, -0.8, -0.65, 0.6)
    return sockets((-0.25, -0.75, 0), (0, -1.1, 0), [(-0.25, 0.2, 0.4), (-0.25, -0.5, 0.2), (0.55, 0.1, 0.5), (0.6, -0.45, 0.2)], (-0.25, 0.2, 0.5), banner=top)


def siege_workshop(ms, rng):
    """20 x 16 m: the artillery park: three howitzers under camouflage nets, ammunition crates and
    shells, a prefab store, a sandbag wall at the front."""
    for k, x in enumerate((-0.6, 0.0, 0.6)):
        mb.howitzer(ms, x, -0.1, yaw=0, elev=18 + 6 * k)
        mb.camo_net(ms, x, -0.05, 0.45, 0.55, h=0.2)
    for x in (-0.3, 0.3):
        mb.crates(ms, x, 0.4, n=4)
    tmd.prefab(ms, 0.65, 0.58, 0.5, 0.22, wall_h=0.24, rise=0.05)
    mb.sandbag_wall(ms, -0.9, -0.7, -0.15, -0.7)
    mb.sandbag_wall(ms, 0.15, -0.7, 0.9, -0.7)
    top = flag_pole(ms, -0.85, 0.6, 0.65)
    return sockets((0, -0.75, 0), (0, -1.1, 0), [(-0.6, -0.1, 0.2), (0, -0.1, 0.2), (0.6, -0.1, 0.2), (0.65, 0.58, 0.3)], (0, 0.4, 0.3), banner=top)


def aid_post(ms, rng):
    """12 x 12 m: the field hospital: two white ward tents end to end, a prefab with a team band, a
    white van, stretchers on trestles, the team flag."""
    for y in (0.0, 0.42):
        tb.tent(ms, -0.25, y, w=0.36, d=0.42, h=0.26)
    tmd.prefab(ms, 0.32, 0.3, 0.36, 0.4, wall_h=0.26, rise=0.05, ridge_y=True)
    ms.box('team_cloth', (0.37, 0.41, 0.04), at=(0.32, 0.3, G + 0.2), lod=1)
    mb.truck(ms, 0.35, -0.3, yaw=180, body='md_jerry', canvas='md_jerry', s=0.75)
    for k in range(2):
        ms.box('md_steel', (0.2, 0.06, 0.05), at=(-0.25 + 0.0 * k, -0.35 - 0.1 * k, G), lod=0)
        ms.box('md_jerry', (0.19, 0.055, 0.012), at=(-0.25, -0.35 - 0.1 * k, G + 0.05), lod=0)
    top = flag_pole(ms, 0.0, -0.5, 0.6)
    return sockets((0, -0.6, 0), (0, -0.9, 0), [(-0.25, 0.0, 0.25), (-0.25, 0.42, 0.25), (0.32, 0.3, 0.3), (0.35, -0.3, 0.15)], (0.32, 0.3, 0.4), banner=top)


def tower(ms, rng):
    """8 x 8 m, 14 m: a concrete bunker with firing slits at the foot of an observation tower: a
    concrete shaft, a cab with slit windows and a searchlight, a mast, a sandbagged gun position."""
    mb.sandbag_ring(ms, 0, -0.05, 0.36, h=0.08, gap=70, n=10)
    f = tm.house_frame(0, 0.05, 0)
    tmd.bunker(ms, f @ tm.house_frame(0, 0, 0), 0.22, 0.2)
    ms.box('md_bunker', (0.2, 0.2, 1.0), at=(0.12, 0.18, G), lod=2, bevel=0.01, taper=0.92)
    cab_z = G + 1.0
    ms.box('md_concrete', (0.34, 0.34, 0.03), at=(0.12, 0.18, cab_z), lod=2)
    ms.box('md_concrete', (0.3, 0.3, 0.16), at=(0.12, 0.18, cab_z + 0.03), lod=2, bevel=0.006)
    for k in range(4):
        a = k * math.pi / 2
        ms.box('dark', (0.2, 0.012, 0.04), at=(0.12 + math.sin(a) * 0.152, 0.18 - math.cos(a) * 0.152, cab_z + 0.11), rot_z=math.degrees(a), lod=0)
    ms.box('md_concrete', (0.36, 0.36, 0.03), at=(0.12, 0.18, cab_z + 0.19), lod=1)
    mb.searchlight(ms, 0.02, 0.08, cab_z + 0.22)
    ms.cyl('md_steel', 0.006, 0.004, 0.3, at=(0.24, 0.3, cab_z + 0.22), segs=4, lod=0)
    ms.cyl('md_olive', 0.05, 0.045, 0.05, at=(-0.18, -0.22, G), segs=8, lod=1)
    for sx in (-1, 1):
        ms.cyl('md_olive_dark', 0.007, 0.006, 0.22, at=(-0.18 + sx * 0.02, -0.24, G + 0.07), rot=(60, 0, 0), segs=5, lod=0)
    top = flag_pole(ms, -0.3, 0.3, 1.45, w=0.16, fh=0.1)
    return sockets((0, -0.34, 0), (0, -0.65, 0), [(0.12, 0.18, cab_z + 0.1), (0, 0.05, 0.2), (-0.18, -0.22, 0.1), (0.12, 0.18, 0.6)], (0.12, 0.18, cab_z + 0.3), banner=top)


def generator(ms, rng):
    """12 x 12 m: a diesel generator in a steel container with exhaust stacks and vents, two fuel
    tanks, a cable run to a switch cabinet, a fence."""
    f = tm.house_frame(-0.1, 0.1, 0)
    ms.box('md_olive', (0.6, 0.25, 0.26), at=(0, 0, G + 0.02), lod=2, frame=f, bevel=0.005)
    ms.box('md_concrete', (0.66, 0.31, 0.02), at=(0, 0, G), lod=1, frame=f)
    for x in (-0.2, 0.0, 0.2):
        ms.box('dark', (0.12, 0.012, 0.12), at=(x, -0.13, G + 0.08), lod=0, frame=f)
    for x in (-0.15, 0.15):
        ms.cyl('md_steel', 0.025, 0.025, 0.2, at=(x, 0.05, G + 0.28), segs=6, lod=1, frame=f)
    mb.fuel_tank(ms, 0.35, 0.4, yaw=90, r=0.08, length=0.38)
    mb.fuel_tank(ms, 0.5, -0.25, yaw=0, r=0.06, length=0.3)
    ms.box('md_steel', (0.12, 0.08, 0.2), at=(-0.45, -0.35, G), lod=1)
    tmd.rod(ms, 'md_pipe', (-0.3, 0.0, G + 0.01), (-0.45, -0.3, G + 0.01), 0.008, segs=4, lod=0)
    fence_square(ms, 0.58, gate=0.26)
    return sockets((0, -0.6, 0), (0, -0.9, 0), [(-0.1, 0.1, 0.35), (0.35, 0.4, 0.2), (0.5, -0.25, 0.15), (-0.45, -0.35, 0.2)], (-0.1, 0.15, 0.55))


def airfield(ms, rng):
    """30 x 30 m: a short asphalt strip with a centre line and threshold bars, a Nissen hangar, a
    control cabin with a windsock and a mast, a parked jet, a fuel tank."""
    tmd.rect(ms, 'md_asphalt', -0.45, -1.45, 0.45, 1.45, G + 0.003, lod=2)
    for k in range(8):
        ms.box('md_marking', (0.025, 0.16, 0.002), at=(0, -1.2 + 0.34 * k, G + 0.004), lod=0)
    for x in (-0.3, -0.18, 0.18, 0.3):
        ms.box('md_marking', (0.06, 0.2, 0.002), at=(x, -1.3, G + 0.004), lod=0)
        ms.box('md_marking', (0.06, 0.2, 0.002), at=(x, 1.3, G + 0.004), lod=0)
    mb.nissen(ms, 1.0, 0.7, span=0.9, length=1.1, yaw=-90)
    tmd.rect(ms, 'md_concrete', 0.45, -0.2, 1.4, 0.2, G + 0.003, lod=1)
    mb.jet(ms, 0.0, 0.2, yaw=0)
    tmd.block(ms, rng, -1.0, -0.6, 0.3, 0.3, storeys=1, wall='md_render_win', yaw=-90, roof='flat', h=0.32, units=1)
    ms.box('md_glass', (0.22, 0.22, 0.12), at=(-1.0, -0.6, G + 0.32), lod=1)
    ms.box('md_concrete', (0.26, 0.26, 0.02), at=(-1.0, -0.6, G + 0.44), lod=1)
    mb.windsock(ms, -0.75, -1.2)
    mb.lattice_mast(ms, -1.15, -0.25, h=0.8, w=0.05)
    mb.fuel_tank(ms, -1.0, 0.6, yaw=90)
    top = flag_pole(ms, -0.7, -0.2, 0.6)
    return sockets((0.45, 0, 0), (0, -1.6, 0), [(1.0, 0.7, 0.4), (0.0, 0.2, 0.2), (-1.0, -0.6, 0.4), (-1.0, 0.6, 0.15)], (1.0, 0.7, 0.5), banner=top)


def radar_aa(ms, rng):
    """16 x 16 m: a radar dish on its mast and cabin, two sandbagged twin AA gun pits, a generator
    trailer, cables, the team flag."""
    mb.radar(ms, 0.0, 0.35, h=0.45, r=0.16)
    ms.box('md_olive', (0.3, 0.2, 0.2), at=(0.0, 0.62, G), lod=1, bevel=0.005)
    mb.gun_pit(ms, -0.48, -0.3, r=0.22, gun='aa')
    mb.gun_pit(ms, 0.48, -0.3, r=0.22, gun='aa')
    ms.box('md_olive', (0.16, 0.24, 0.12), at=(0.55, 0.45, G + 0.04), lod=1, bevel=0.004)
    for sx in (-1, 1):
        ms.cyl('md_tyre', 0.04, 0.04, 0.02, at=(0.55 + sx * 0.09 - 0.01, 0.45, G + 0.04), rot=(0, 90, 0), segs=8, lod=0)
    tmd.rod(ms, 'md_pipe', (0.45, 0.45, G + 0.01), (0.15, 0.55, G + 0.01), 0.006, segs=4, lod=0)
    fence_square(ms, 0.78, gate=0.3)
    top = flag_pole(ms, -0.6, 0.55, 0.6)
    return sockets((0, -0.8, 0), (0, -1.15, 0), [(0, 0.35, 0.5), (-0.48, -0.3, 0.1), (0.48, -0.3, 0.1), (0.55, 0.45, 0.15)], (0, 0.62, 0.3), banner=top)


NEW = {'expedition-camp': expedition_camp, 'town-hall': town_hall, 'food-depot': food_depot, 'trade-post': trade_post,
       'farm-plot': farm_plot, 'mine': mine, 'barracks': barracks, 'stable': stable, 'siege-workshop': siege_workshop,
       'aid-post': aid_post, 'tower': tower}
EXTRA_ON = {'materials-yard': materials_yard_extra, 'range': range_extra}
MODERN_ONLY = [('generator', generator), ('airfield', airfield), ('radar-aa', radar_aa)]


def with_extras(layout, extra):
    def build(ms, rng):
        s = layout(ms, rng)
        extra(ms, rng)
        return s
    build.__doc__ = layout.__doc__
    return build


STAGES = [(n, remat(fn, STAGE_MATS)) for n, fn in rb.STAGES]
ROLES = [(n, remat(NEW.get(n) or (with_extras(fn, EXTRA_ON[n]) if n in EXTRA_ON else fn))) for n, fn in rc.ROLES] + \
        [(n, remat(fn)) for n, fn in MODERN_ONLY]


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    out_dir = argv[0] if argv else os.path.join(tm.__file__.rsplit(os.sep, 3)[0], 'art-build', 'rts-modern')
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
    counts = tt.build_file('rts-modern', items, out_dir, atlas=atlas, seed=3600, write=False)
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
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, 'rts-modern.blend'))
    tm.export_glb(os.path.join(out_dir, 'rts-modern.glb'), exported)
    import json
    with open(os.path.join(out_dir, 'report.json'), 'w') as fh:
        json.dump({'file': 'rts-modern.glb', 'triangles': counts, 'sockets': rb.SOCKETS, 'atlas': atlas}, fh, indent=2)
    print('RTS_MODERN_BUILT', len(roots), 'objects', flush=True)
    sys.stdout.flush()
    os._exit(0)


if __name__ == '__main__':
    main()
