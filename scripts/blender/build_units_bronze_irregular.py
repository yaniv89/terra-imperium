# scripts/blender/build_units_bronze_irregular.py
# The Bronze irregulars of plans/ART-MODELS-PLAN.md 4.3, quality pass of 2026-10-14 (after the
# spearman, the archer and the labourer: the figure parts of ti_figure.py, the horse of
# ti_mounts.fine_horse, baked shade in COLOR_0). Rest pose only, as before: the soldier loader bakes
# the rest pose and its vertex rig walks the legs and swings the arms.
#   bronze-mercenary  a hired foot soldier in foreign kit: a feathered crown on a bronze band, a
#                     leather jerkin under three bronze hoops, a baldric, bronze greaves and armlets, a
#                     Team waist sash with a coin pouch, a round shield (the squad's Emblem) and a long
#                     bronze sword held upright. Drawn for mercenary squads of the infantry class
#                     (unitModels.js `mercenary`).
#   bronze-raider     a light mounted raider: a small bay horse with a blaze, socks and a bridle, a
#                     hide saddle cloth, loot (a sack on each flank, a rolled rug and a jar on the
#                     croup); the rider sits astride in a linen tunic and a hide vest with a Team
#                     shawl and a Team headcloth, a lit torch raised in the right fist, the reins in the
#                     left, a javelin across the back. Drawn for raider squads of the cavalry class
#                     (raids and sacks: the attacking party), unitModels.js `raider`.
# Culture neutral (no national motifs). The battle draws the side's colour only on the Spine, Chest
# and Head bones (gltfUnitLoader.js), so the Team accents sit there. Flame is its own flat material.
#   blender -b --factory-startup -P scripts/blender/build_units_bronze_irregular.py -- bronze-raider bronze-mercenary
# Outputs go to art-build/units/<id>/ (TI_PREVIEW=1 adds stills); copy the GLB to src/assets/units/.
import bpy, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
from mathutils import Vector  # noqa: E402

tube, box, raw, vertical, sheet = F.tube, F.box, F.raw, F.vertical, F.sheet


def build_mercenary():
    arm = F.start({'Leather': '6E4630', 'Wood': '5A4130', 'Cloth': 'E6DCC0', 'Metal': ('C8A058', .4, .6), 'Hair': '3A2A1E', 'Skin': 'B9805C', 'Emblem': 'E6D6AF'})
    arm.name = 'MercenaryRig'
    GRIP_R, GRIP_L = Vector((-.223, -.137, .604)), Vector((.225, -.130, .608))
    # ---- body ----
    F.legs(laces=False)
    sides = F.arms(shoulder='Skin')
    F.fist('R', GRIP_R, (0, 0, 1))
    F.fist('L', GRIP_L, (0, 0, 1))
    F.head()
    F.hair_nape()
    for side, s in (('L', 1), ('R', -1)):
        tube('Greave_' + side, [((s * .074, .004, .098), (.031, .032), 'Shin_' + side), ((s * .073, .004, .200), (.045, .045), 'Shin_' + side),
                                ((s * .071, -.010, .262), (.040, .041), 'Shin_' + side)], 'Metal', 6, caps=(False, False))
        sh, el, _ = sides[side]
        tube('Armlet_' + side, [(tuple(sh.lerp(el, .50)), .0445, 'Arm_' + side), (tuple(sh.lerp(el, .66)), .0425, 'Arm_' + side)], 'Metal', 6, caps=(False, False))
    # ---- kilt with a leather front panel, the jerkin and its three bronze hoops, the baldric ----
    F.kilt('Kilt', 'Team')
    F.tufted_hem()
    sheet('KiltPanel', (-.036, -.079, .532), (.036, -.079, .532), (.020, -.104, .352), (-.020, -.104, .352), .008, 'Leather', 'Hips')
    F.bronze_torso('Jerkin', 'Leather')
    for i, z in enumerate((.588, .645, .702)):
        rx, ry = F.torso_radius(z)
        rx2, ry2 = F.torso_radius(z + .030)
        tube(f'CorseletBand{i}', [((0, 0, z - .016), (rx + .011, ry + .010), 'Spine' if z < .66 else 'Chest'),
                                  ((0, 0, z + .016), (rx2 + .007, ry2 + .006), 'Spine' if z < .66 else 'Chest')], 'Metal', 10, caps=(False, False))
    for side, s in (('L', 1), ('R', -1)):
        tube('JerkinStrap_' + side, [((s * .082, -.082, .728), (.019, .010), 'Chest'), ((s * .078, -.020, .805), (.019, .010), 'Chest'), ((s * .082, .068, .752), (.019, .010), 'Chest')], 'Leather', 4)
    strap = [((-.074, .096, .796), 'Chest'), ((-.086, .000, .808), 'Chest'), ((-.062, -.088, .758), 'Chest'), ((.000, -.106, .690), 'Chest'),
             ((.058, -.080, .620), 'Spine'), ((.108, -.012, .575), 'Spine'), ((.062, .082, .580), 'Spine')]
    tube('Baldric', [(p, (.014, .006), w) for p, w in strap], 'Wood', 4)
    # ---- the Team sash at the waist (Spine: the battle dyes it) and the coin pouch that hangs from it ----
    F.sash('Sash', 'Team')
    tube('CoinPouch', [((-.112, -.050, .505), .014, 'Hips'), ((-.118, -.056, .470), .034, 'Hips'), ((-.118, -.056, .432), .030, 'Hips'), ((-.116, -.054, .412), .010, 'Hips')], 'Leather', 6)
    tube('CoinPouchTie', [((-.113, -.051, .494), .019, 'Hips'), ((-.114, -.052, .506), .019, 'Hips')], 'Metal', 5, caps=(False, False))
    # ---- the feathered crown: a bronze band, a Team band above it, a flaring ring of pale feathers ----
    tube('CrownBand', vertical([.944, .970], -.003, [(.0705, .0665), (.0700, .0660)], 'Head'), 'Metal', 10, caps=(False, False))
    tube('CrownCloth', vertical([.970, .990], -.003, [(.0715, .0675), (.0715, .0675)], 'Head'), 'Team', 10, caps=(False, False))
    n = 12
    crown = tube('FeatherCrown', vertical([.986, 1.040, 1.112], -.003, [(.067, .063), (.078, .074), (.092, .088)], 'Head'), 'Cloth', n, caps=(False, True), attachment=True)
    for j in range(n):
        if j % 2:  # every second feather is shorter and set in: a fluted, notched ring
            for ring, k, drop in ((1, .90, 0), (2, .80, .030)):
                v = crown.data.vertices[ring * n + j]
                v.co.x *= k
                v.co.y = -.003 + (v.co.y + .003) * k
                v.co.z -= drop
    crown.data.vertices[3 * n].co.z = 1.060  # the ring is hollow at the top
    # ---- the long bronze sword, upright in the right fist (long, thin and upright: it survives the far detail level) ----
    P = 'Prop_R'
    x, y, z = GRIP_R
    tube('SwordGrip', [((x, y, z - .040), .0125, P), ((x, y, z + .040), .0125, P)], 'Wood', 6, caps=(False, False), attachment=True)
    tube('SwordPommel', [((x, y, z - .066), .006, P), ((x, y, z - .052), .020, P), ((x, y, z - .038), .014, P)], 'Metal', 6, attachment=True)
    box('SwordGuard', (x, y, z + .047), (.078, .024, .016), 'Metal', P, True)
    tube('SwordBlade', [((x, y, z + .052), (.019, .007), P), ((x, y, z + .200), (.017, .007), P), ((x, y, z + .360), (.024, .007), P),
                        ((x, y, z + .470), (.016, .005), P), ((x, y, z + .535), (.0015, .0015), P)], 'Metal', 4, attachment=True)
    # ---- the round shield on the left arm, its face the squad's Emblem ----
    F.round_shield((.225, -.166, .612), .176)
    F.normalize_weights()
    tris = F.finish_unit('bronze-mercenary', [arm], {
        'role': 'Bronze mercenary: a hired foot soldier in foreign kit (feathered crown on a bronze band, leather jerkin under three bronze hoops, baldric, greaves, armlets), a kilt with a leather front panel, a Team waist sash with a coin pouch, a round Emblem shield and a long bronze sword held upright',
        'pose': 'rest pose only; the vertex rig walks the legs and swings the arms',
        'notes': 'Quality pass of 2026-10-14 on ti_figure.py. Team: the waist sash (Spine) and the band under the feathers (Head). The kilt is Team by tag but hangs from the hips, so the battle draws it as plain cloth.'},
        open_facing=F.shield_facing(), centre=(0, 0, .58), scale=1.45)
    assert tris <= 2000, tris


def build_raider():
    F.start({'Coat': '7C4B2B', 'Mane': '241A15', 'Leather': '6A4028', 'Hide': 'B9A078', 'Wood': '5E4430', 'Cloth': 'E4D8BC', 'Rug': '9C3F2C', 'Sack': 'CDBB94', 'Clay': 'B4683F',
             'Metal': ('C09A54', .45, .6), 'Hair': '2B201A', 'Skin': 'C98E66', 'Flame': 'F6A22E'}, rig=False)
    parts = []
    horse, _ = tm.fine_horse('Mount', (0, 0, 0))
    parts.append(horse)
    S = 'Mount_Spine'
    F.meshes.extend([tm.drape('HideCloth', horse, 'Hide', -.27, .14, reach=100, fringe=.02),
             tm.drape('Girth', horse, 'Leather', -.215, -.165, reach=180, grow=.024, rows=2, steps=12)])
    F.use(horse)
    # loot: a tied sack on each flank behind the rider's legs, a rolled rug across the croup, a jar on it
    for sx in (-1, 1):
        tube(f'LootSack{sx}', [((sx * .165, .21, .700), .030, S), ((sx * .190, .21, .640), (.085, .075), S), ((sx * .205, .21, .540), (.105, .090), S),
                               ((sx * .200, .21, .455), (.080, .070), S), ((sx * .195, .21, .425), .020, S)], 'Sack', 7)
        tube(f'SackTie{sx}', [((sx * .166, .21, .688), .036, S), ((sx * .171, .21, .672), .040, S)], 'Leather', 6, caps=(False, False))
    tube('SackRope', [((-.160, .21, .715), .010, S), ((0, .21, .770), .010, S), ((.160, .21, .715), .010, S)], 'Leather', 4)
    tube('LootBundle', [((-.170, .345, .740), .020, S), ((-.160, .345, .745), .058, S), ((.160, .345, .745), .058, S), ((.170, .345, .740), .020, S)], 'Rug', 7)
    for sx in (-1, 1):
        tube(f'BundleTie{sx}', [((sx * .085, .345, .745), .061, S), ((sx * .105, .345, .745), .061, S)], 'Leather', 7, caps=(False, False))
    tube('LootJar', [((0, .255, .760), .030, S), ((0, .255, .800), .062, S), ((0, .255, .850), .058, S), ((0, .255, .885), .028, S), ((0, .255, .905), .036, S)], 'Clay', 7)
    # ---- the rider ----
    rider = F.figure('Raider')
    parts.append(rider)
    F.legs(laces=True)
    F.arms(shoulder='Skin')
    F.head()
    F.beard()
    F.hair_nape()
    F.headcloth('Leather', tail=True, cloth='Team')
    F.kilt('Kilt', 'Team', seated=True)
    F.bronze_torso('Tunic', 'Cloth')
    tube('HideVest', [((0, .004, z), (rx + .008, ry + .008), 'Spine' if z < .66 else 'Chest') for z, rx, ry in F.BRONZE_TORSO[1:6]], 'Leather', 10, caps=(False, False))
    F.shawl('Shawl', 'Team')
    tube('Belt', vertical([.520, .548], 0, [(.103, .076), (.101, .074)], 'Spine'), 'Leather', 10, caps=(False, False))
    # astride, the torch arm up and forward, the rein hand low in front
    F.pose({'Leg_L': (-60, -28, 0), 'Leg_R': (-60, 28, 0), 'Shin_L': (70, 0, 0), 'Shin_R': (70, 0, 0)})
    F.reach('R', (-.250, -.120, .900), pole=(-.8, .3, -1))
    F.reach('L', (.105, -.185, .640), pole=(.8, .2, -1))
    F.bake_rest()
    AT = Vector((0, -.07, .345))
    F.place(AT)
    g = F.fist('R', None, (0, 0, 1))
    P = 'Prop_R'
    tube('TorchHaft', [((g.x, g.y, g.z - .130), .0115, P), ((g.x, g.y, g.z + .250), .0105, P)], 'Wood', 5, attachment=True)
    tube('TorchWrap', [((g.x, g.y, g.z + .225), .020, P), ((g.x, g.y, g.z + .262), .030, P), ((g.x, g.y, g.z + .310), .028, P)], 'Leather', 6, attachment=True)
    flame = tube('TorchFlame', [((g.x, g.y, g.z + .300), .030, P), ((g.x, g.y - .006, g.z + .350), .046, P), ((g.x + .008, g.y - .004, g.z + .410), .030, P),
                                ((g.x - .004, g.y + .006, g.z + .480), .003, P)], 'Flame', 6, attachment=True)
    F.bright.add(flame.name)
    gl = F.fist('L', None, (0, 1, 0), half=.020)
    tube('Javelin', [((-.150, .100, .545), .0075, 'Chest'), ((.185, .078, .985), .0065, 'Chest')], 'Wood', 4, attachment=True)
    tube('JavelinHead', [((.180, .078, .978), (.012, .005), 'Chest'), ((.200, .077, 1.005), (.016, .005), 'Chest'), ((.228, .075, 1.045), .001, 'Chest')], 'Metal', 4, attachment=True)
    # the reins, from the bit to the left fist (they hang from the horse's neck bone, which the battle keeps
    # still: on the back bone they would count as the horse's height)
    F.use(horse)
    hand = AT + gl
    for sx in (-1, 1):
        bit = Vector((sx * .043, -.722, .898))
        mid = bit.lerp(hand, .5) + Vector((sx * .035, 0, -.050))
        tube(f'Rein{sx}', [(tuple(bit), .0065, 'Mount_Head'), (tuple(mid), .0065, 'Mount_Neck'), (tuple(hand), .0065, 'Mount_Neck')], 'Leather', 3)
    tris = F.finish_unit('bronze-raider', parts, {
        'role': 'Bronze raider: a light mounted raider on a small bay horse (blaze, socks, bridle, hide saddle cloth), loot sacks on both flanks, a rolled rug and a jar on the croup, a raised torch and a slung javelin; linen tunic and hide vest, Team shawl and headcloth',
        'pose': 'rest pose only (the rider seated, the torch arm raised); the vertex rig trots the horse',
        'notes': 'Quality pass of 2026-10-14 on ti_figure.py and ti_mounts.fine_horse. Mounted rather than in a chariot: a raid party rides light. The flame is a flat orange material named Flame with no baked shade; fire and smoke come from the battle effects.'},
        centre=(0, -.1, .7), scale=2.1)
    assert tris <= 3500, tris


BUILDERS = {'bronze-raider': build_raider, 'bronze-mercenary': build_mercenary}
ids = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else list(BUILDERS)
for uid in ids:
    BUILDERS[uid]()
