# scripts/blender/build_signature_special.py
# The 13 signature units on the special rigs of src/data/signatureUnits.js (rig camel 3, elephant 4, ox 2,
# tank 2, frame 2) on the quality pipeline of the base units (2026-10-20), each with the clip set of its
# role's base unit:
#   camels (Saba, Qedar, Kindah) and the Khoekhoe ox rider: a fine animal of their own here (rounder tubes,
#     shaped legs, round pads or cloven hooves), the rider astride on the quality figure (ti_figure), the
#     mounted clips of the base cavalry (ti_mounted_clips.mounted: Idle, Walk, Trot, Gallop, Charge, Attack,
#     Hit, Death, DeathAlt, Cheer). The camel paces instead of trotting and kneels down in its falls (it does
#     not roll onto its back); the gaits keep the horse's stride and cadence, so the battle's speed matching
#     (clipPlayer.js MOUNTED_TPS) holds
#   war elephants (Magadha, Kalinga, Kamarupa, Champa): a fine elephant (a trunk on a bone of its own that
#     swings and rises), a howdah, a mahout on the neck and two crew standing in the howdah; the mounted clip
#     set authored here (author_elephant) on the shared machinery (Horse, Person, RiderLib, CrewLib, Unit):
#     the elephant walks in every gait (an amble, no suspension: elephants never gallop), at the horse's
#     stride and cadence; it sinks to its knees and lies down in the falls, the crew slumped in the howdah
#   Kitara's cattle guard (infantry): a spearman on foot with the foot soldiers' clips (ti_foot_clips) and a
#     long-horned Ankole ox beside him whose own clips follow his (it walks when he walks, trots when he
#     runs, goes down when he falls)
#   tanks (the Merkava, the LT vz. 38): the base tank's rig and builder calls as before (the old builder's),
#     with the base tank's clips (ti_vehicle_clips.tank: Idle, Move, Fire, Hit, Wreck)
#   siege frames (the Bosporan stone-thrower, the Tondo lantaka): the machines of the old builders, the crew
#     lifted to the figure standard (ti_figure LITE, as the base siege units), the siege clips
#     (ti_vehicle_clips: Idle, Move, Fire, Hit, Death, Wreck)
# Shared modules are used, not changed: anything that differs per beast is set here for the time of one
# build (beast_gaits) and put back after.
#   blender -b --factory-startup -P scripts/blender/build_signature_special.py -- [model ...]
# Writes art-build/units/signature/<model>/<model>.(blend|glb|json); copy the GLB to
# src/assets/units/signature/ and merge the JSON's clips into the asset's JSON (ship_json below does it
# when TI_SHIP=1).
import json
import math
import os
import sys
from contextlib import contextmanager
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_mounts as tm  # noqa: E402
import ti_mounted_clips as MC  # noqa: E402
import ti_foot_clips as FC  # noqa: E402
import ti_signature as TS  # noqa: E402
import ti_signature_mounted as SM  # noqa: E402
import ti_units as u  # noqa: E402
import ti_vehicle_clips as VC  # noqa: E402
from ti_clips import Clip, spec_at, upd, FPS  # noqa: E402

V = Vector
BUDGET = 5000          # an animal and its riders: 5,000 hard
MACHINE_BUDGET = 4000  # a machine with its crew: unitScale.test.js holds machines to 4,000
SIG = u.REPO / 'src' / 'assets' / 'units' / 'signature'
BRONZE = ('C2995A', .4, .6)
IRON = ('8E9094', .4, .72)
GOLD = ('D4A84A', .35, .8)
TAGS = {'team': '(^|\\s)Team(\\s|$)', 'skin': '(^|\\s)Skin(\\s|$)', 'emblem': '(^|\\s)Emblem(\\s|$)'}


def out_root():
    os.environ['TI_UNITS_OUT'] = str(u.REPO / 'art-build' / 'units' / 'signature')


def start(colors):
    out_root()
    pal = dict(SM.BASE)
    pal.update(colors or {})
    F.start(pal, rig=False)


def dens(rows, k):
    return tm._densify(rows, k)


def _rows(pts, radii, bone, k):
    bones = bone if isinstance(bone, (list, tuple)) else [bone] * len(pts)
    rr = [r if isinstance(r, tuple) else (r, r) for r in radii]
    rows = [(*p, *r) for p, r in zip(pts, rr)]
    if k > 1:
        d = dens(rows, k)
        bw = [bones[min(len(bones) - 1, round(i / k))] for i in range(len(d))]  # the nearest authored point's weight
        rows, bones = d, bw
    return rows, bones


def ftube(name, pts, radii, mat, bone, sides, k=1, caps=(True, True)):
    """A tube on the current rig (F.use) through `pts` with `radii` ((a, b) or r per point), Catmull-Rom
    densified k times; `bone` one name, or one per point (a weight dict allowed)."""
    rows, bones = _rows(pts, radii, bone, k)
    return F.tube(name, [((q[0], q[1], q[2]), (q[3], q[4]), b) for q, b in zip(rows, bones)], mat, sides, caps=caps)


def btube(name, pts, radii, mat, bone, sides, k=1, caps=(True, True)):
    """A body tube in the animal's middle plane (a barrel, a neck, a head, a trunk): like ftube, but every ring
    keeps X as its side axis, so a neck that curves through the horizontal never twists. radii (the other
    axis, X): for a tube along Y that is (height, width)."""
    rows, bones = _rows(pts, radii, bone, k)
    n = len(rows)
    X = V((1, 0, 0))
    verts, faces, vw = [], [], []
    for i, q in enumerate(rows):
        c = V(q[:3])
        d = V(rows[min(n - 1, i + 1)][:3]) - V(rows[max(0, i - 1)][:3])
        d.x = 0
        d.normalize()
        a1 = d.cross(X).normalized()
        rx, ry = q[3], q[4]
        w = bones[i]
        w = {w: 1} if isinstance(w, str) else w
        for j in range(sides):
            a = 2 * math.pi * j / sides
            verts.append(tuple(c + X * math.cos(a) * ry + a1 * math.sin(a) * rx))
            vw.append(w)
        if i:
            for j in range(sides):
                p, r = (i - 1) * sides + j, (i - 1) * sides + (j + 1) % sides
                faces += [(p, r, i * sides + (j + 1) % sides), (p, i * sides + (j + 1) % sides, i * sides + j)]
    for end, on in ((0, caps[0]), (n - 1, caps[1])):
        if not on:
            continue
        idx = len(verts)
        verts.append(tuple(rows[end][:3]))
        vw.append(vw[end * sides])
        for j in range(sides):
            p, r = end * sides + j, end * sides + (j + 1) % sides
            faces.append((idx, r, p) if end == 0 else (idx, p, r))
    return F.raw(name, verts, faces, mat, weights=vw)


# ---- beast gaits and falls (set on ti_mounted_clips for one build, then put back) -------------------------

def couch_keys(sign, drop, kind='Death'):
    """A big beast going down: struck, the forelegs buckle (the nose dips), the hindquarters follow, it lies on
    its chest with a list to `sign` (-1 its right) and the neck down along the ground. `drop`: how far the
    body sinks (its belly onto the ground)."""
    d = drop
    s = sign
    if kind == 'Death':
        return [(1, {}), (5, {'neck': -14, 'head': 6, 'pitch': -3, 'tail': 10, 'ease': 'out'}),
                (12, {'neck': 6, 'head': 6, 'pitch': 13, 'bob': -.30 * d, 'roll': 3 * s, 'tail': 4}),
                (20, {'neck': 18, 'head': 10, 'pitch': 7, 'bob': -.72 * d, 'roll': 7 * s, 'tail': -4, 'ease': 'in'}),
                (27, {'neck': 34, 'head': 18, 'pitch': 1, 'bob': -1.0 * d, 'roll': 12 * s, 'tail': -10, 'ease': 'in'}),
                (31, {'neck': 30, 'head': 16, 'pitch': 2, 'bob': -.97 * d, 'roll': 10 * s, 'tail': -8, 'ease': 'out'}),
                (36, {'neck': 38, 'head': 22, 'pitch': 1, 'bob': -1.0 * d, 'roll': 12 * s, 'tail': -12}),
                (40, {'neck': 38, 'head': 22, 'pitch': 1, 'bob': -1.0 * d, 'roll': 12 * s, 'tail': -12})]
    # DeathAlt: the hindquarters give first (it sits back), then the forelegs fold and it lists over
    return [(1, {}), (5, {'neck': -20, 'head': 8, 'pitch': -6, 'tail': 14, 'ease': 'out'}),
            (12, {'neck': -8, 'head': 6, 'pitch': -12, 'bob': -.32 * d, 'roll': 3 * s, 'tail': 2}),
            (20, {'neck': 8, 'head': 8, 'pitch': -5, 'bob': -.70 * d, 'roll': 9 * s, 'tail': -6, 'ease': 'in'}),
            (27, {'neck': 30, 'head': 16, 'pitch': 0, 'bob': -1.0 * d, 'roll': 16 * s, 'tail': -12, 'ease': 'in'}),
            (31, {'neck': 26, 'head': 14, 'pitch': 1, 'bob': -.97 * d, 'roll': 14 * s, 'tail': -10, 'ease': 'out'}),
            (36, {'neck': 34, 'head': 20, 'pitch': 0, 'bob': -1.0 * d, 'roll': 16 * s, 'tail': -14}),
            (40, {'neck': 34, 'head': 20, 'pitch': 0, 'bob': -1.0 * d, 'roll': 16 * s, 'tail': -14})]


# The gaits of the other beasts at the horse's stride and cadence (T, amp: the same natural ground speed).
PACE = dict(T=14, d=.46, amp=.20, lift=(.12, .10), ph={'FL': 0, 'HL': 0, 'FR': .5, 'HR': .5}, hop=0)  # the camel's pace: both legs of a side
# The elephant: a four-beat amble at every speed (a lateral sequence, always a foot down, no suspension), the
# faster gaits a longer stride on its long legs, a shorter stance and a higher step. Each gait's natural ground
# speed 40 amp / (d T) (model units a second; a unit is 0.95 tiles) matches the battle's MOUNTED_TPS for its
# role (clipPlayer.js: walk .52, trot 1.29, gallop 2.74, charge 3.29 tiles a second), as the horse's do.
AMBLE = {
    'walk': dict(T=20, d=.66, amp=.180, lift=(.07, .06), ph={'HL': 0, 'FL': .22, 'HR': .5, 'FR': .72}, hop=0),     # .545 u/s
    'trot': dict(T=14, d=.52, amp=.247, lift=(.13, .11), ph={'HL': 0, 'FL': .2, 'HR': .5, 'FR': .7}, hop=0),       # 1.357
    'gallop': dict(T=12, d=.44, amp=.381, lift=(.19, .16), ph={'HL': 0, 'FL': .2, 'HR': .5, 'FR': .7}, hop=0),     # 2.886
    'charge': dict(T=10, d=.42, amp=.364, lift=(.21, .17), ph={'HL': 0, 'FL': .2, 'HR': .5, 'FR': .7}, hop=0),     # 3.467
}
AMBLE_SWING = {'walk': 1.0, 'trot': 1.9, 'gallop': 2.8, 'charge': 3.2}  # the body's rock, the head's nod, the tail's swing


@contextmanager
def beast_gaits(kind, drop):
    """ti_mounted_clips' gait table, gait shapes and falls for one beast ('camel', 'elephant', 'ox'), put back
    afterwards. The horse's stride and cadence stay (so the natural ground speeds do)."""
    saved = (dict(MC.GAITS), MC.gait_shape, MC.horse_keys)
    base_shape, base_keys = MC.gait_shape, MC.horse_keys

    def shape(k, p):
        s = base_shape(k, p)
        if kind == 'camel' and k == 'trot':  # the pace rocks the body from side to side
            s.update(pitch=.4 * MC.cosd(2 * p), roll=2.6 * MC.cosd(p), comp=-.006 * (.5 + .5 * MC.cosd(2 * p)))
        if kind == 'elephant':  # no bound: a level back, the head nodding with the steps, the tail swinging
            g = AMBLE_SWING.get(k, 1.)
            s.update(pitch=.5 * g * MC.cosd(2 * p), roll=1.4 * g * MC.sind(p), neck=2 * g * MC.cosd(2 * (p - .2)) - 2 * (g - 1),
                     head=-1 * g * MC.cosd(2 * (p - .2)), tail=4 * g, tail_y=9 * min(g, 2.) * MC.sind(p), comp=-.010 * (g - 1) * (.5 + .5 * MC.cosd(2 * p)))
        if kind == 'ox' and k in ('gallop', 'charge'):  # a heavy bound: the head carried low
            s.update(neck=s['neck'] + 4, head=s['head'] + 2)
        return s

    def keys(k, sign=-1):
        if k in ('Death', 'DeathAlt'):
            return couch_keys(sign, drop, k)
        return base_keys(k, sign)
    try:
        if kind == 'camel':
            MC.GAITS['trot'] = PACE
        if kind == 'elephant':
            MC.GAITS.update(AMBLE)
        MC.gait_shape = shape
        if kind in ('camel', 'elephant'):
            MC.horse_keys = keys
        yield
    finally:
        MC.GAITS.clear()
        MC.GAITS.update(saved[0])
        MC.gait_shape, MC.horse_keys = saved[1], saved[2]


def reins_to(beast, hand, bit, mat='Rope', spread=.03, sag=.05, thick=.0065):
    """Two reins (a halter rope's two ends) from the beast's nose `bit` (rig space, x the half spread) to the
    rider's fist (world); named Rein-1 and Rein1 so ti_mounted_clips moves their hand end on Mount_Rein."""
    F.use(beast)
    hand = V(hand)
    for sx in (-1, 1):
        b = V((sx * abs(bit[0]), bit[1], bit[2]))
        mid = b.lerp(hand, .5) + V((sx * spread, 0, -sag))
        F.tube(f'Rein{sx}', [(tuple(b), thick, 'Mount_Head'), (tuple(mid), thick, 'Mount_Neck'), (tuple(hand), thick, 'Mount_Neck')], mat, 3)


# ---- the camel ----------------------------------------------------------------------------------------------
# Built on the camel rig of ti_mounts (ti_units.quadruped 'camel', its old game size), dressed, then brought to
# its true size (tm.CAMEL_TRUE) before the rider is seated. (y, centre z, half height, half width).
CAMEL_BARREL = [(-.50, .940, .080, .070), (-.44, .910, .180, .140), (-.32, .880, .225, .175), (-.12, .870, .235, .190), (.10, .880, .225, .185),
                (.28, .900, .200, .165), (.40, .920, .140, .120), (.48, .930, .060, .055)]
# the hump and the barrel as one cloth's outline (a saddle cloth over both)
# the withers in front of the hump, where the saddle sits (a saddle cloth over the back there)
CAMEL_OUTLINE = [(-.38, .880, .232, .182), (-.30, .875, .240, .186), (-.22, .872, .248, .190), (-.14, .870, .256, .192), (-.08, .870, .262, .193)]
CAMEL_SADDLE_TOP = 1.165  # the cushion's top (game size), in front of the hump
CAMEL_SEAT_Y = -.240


def fine_camel(coat='Coat', dark='Mane', pad='Pad'):
    """A dromedary on the camel rig: a deep chest, the hump, a long S-curved neck, a long head with a split
    lip, small ears and eyes, long legs with knee pads and broad round feet, a thin tufted tail."""
    arm, meshes = u.quadruped('Camel', 'camel', (0, 0, 0), coat=coat, dark=dark)
    for ob in list(meshes):
        bpy.data.objects.remove(ob, do_unlink=True)
    F.use(arm)
    S, N, H = 'Mount_Spine', 'Mount_Neck', 'Mount_Head'
    btube('CamelBarrel', [(0, y, z) for y, z, _, _ in CAMEL_BARREL], [(h, w) for _, _, h, w in CAMEL_BARREL], coat, S, 14, k=3)
    # the single hump rises well above the back line behind the saddle (the camel's silhouette)
    hump = [(0, -.17, 1.060), (0, -.08, 1.150), (0, .03, 1.195), (0, .15, 1.165), (0, .26, 1.070)]
    btube('CamelHump', hump, [(.030, .100), (.100, .145), (.112, .158), (.095, .140), (.035, .100)], coat, S, 12, k=3)
    neck = [(0, -.44, .990), (0, -.56, .950), (0, -.66, .975), (0, -.74, 1.060), (0, -.80, 1.190), (0, -.82, 1.320)]
    nr = [(.130, .085), (.105, .070), (.090, .062), (.080, .056), (.070, .052), (.064, .050)]
    btube('CamelNeck', neck, nr, coat, [{S: .5, N: .5}, N, N, N, N, N], 10, k=3)
    head = [(0, -.805, 1.370), (0, -.880, 1.382), (0, -.960, 1.352), (0, -1.025, 1.302)]
    btube('CamelHead', head, [(.062, .055), (.057, .050), (.046, .040), (.036, .032)], coat, H, 10, k=2)
    btube('CamelLip', [(0, -1.015, 1.304), (0, -1.048, 1.286), (0, -1.065, 1.276)], [(.033, .031), (.027, .026), (.015, .015)], dark, H, 8)
    for sx in (-1, 1):
        ftube(f'CamelEar{sx}', [(sx * .044, -.815, 1.410), (sx * .056, -.810, 1.436), (sx * .060, -.806, 1.452)], [.015, .012, .002], coat, H, 4)
        F.box(f'CamelEye{sx}', (sx * .052, -.870, 1.398), (.010, .022, .015), dark, H)
    btube('CamelTail', [(0, .480, .975), (0, .508, .870), (0, .520, .750)], [.022, .017, .014], coat, 'Mount_Tail', 6)
    btube('CamelTailTuft', [(0, .520, .760), (0, .523, .700), (0, .520, .645)], [.017, .026, .006], dark, 'Mount_Tail', 6)
    for side, sx in (('L', 1), ('R', -1)):
        x = sx * .10
        for end, y0 in (('Front', -.30), ('Hind', .30)):
            leg, shin = f'Mount_Leg{end}_{side}', f'Mount_Shin{end}_{side}'
            if end == 'Front':  # shoulder, forearm, the knee pad, cannon, fetlock
                ring = [(0, .92, .075, .105, leg), (-.006, .74, .060, .075, leg), (0, .58, .042, .050, leg), (0, .500, .046, .052, leg),
                        (-.002, .440, .043, .050, shin), (0, .30, .030, .034, shin), (0, .13, .027, .031, shin), (-.006, .070, .034, .038, shin)]
            else:  # haunch, thigh, the hock, cannon, fetlock
                ring = [(.000, .95, .090, .130, leg), (.012, .78, .070, .100, leg), (.030, .60, .046, .056, leg), (.034, .490, .040, .050, shin),
                        (.030, .410, .032, .037, shin), (.012, .25, .028, .032, shin), (0, .13, .027, .031, shin), (-.006, .070, .034, .038, shin)]
            F.tube(f'CamelLeg{end}_{side}', [((x, y0 + dy, z), (rx, ry), bn) for dy, z, rx, ry, bn in ring], coat, 8)
            F.tube(f'CamelPad{end}_{side}', [((x, y0 - .016, .062), (.038, .044), shin), ((x, y0 - .022, .030), (.058, .068), shin),
                                             ((x, y0 - .024, .004), (.062, .072), shin)], pad, 9)
            if end == 'Front':  # the knee's callus
                F.tube(f'CamelKnee{side}', [((x, y0 - .034, .530), (.032, .016), leg), ((x, y0 - .040, .470), (.034, .018), shin)], dark, 6)
    return arm


def camel_saddle(camel, cloth='Saddle', frame='Wood', girth='Leather', fringe='Trim', bags=None, cushion=None):
    """The North Arabian saddle over the hump: a saddle cloth over the hump with a fringed edge, a girth, two
    arched wooden bows fore and aft of the seat with a cushion between, saddle bags behind (optional)."""
    F.use(camel)
    S = 'Mount_Spine'
    F.meshes.append(tm.drape('CamelCloth', camel, cloth, -.38, -.09, reach=72, grow=.012, barrel=CAMEL_OUTLINE, steps=12, rows=5, fringe=.025))
    if fringe:
        F.meshes.append(tm.drape('CamelClothHem', camel, fringe, -.385, -.085, reach=77, grow=.007, barrel=CAMEL_OUTLINE, steps=12, rows=2))
    F.meshes.append(tm.drape('CamelGirth', camel, girth, -.30, -.265, reach=180, grow=.010, barrel=CAMEL_BARREL, rows=2, steps=14))
    top = CAMEL_SADDLE_TOP
    for k, y in enumerate((-.35, -.12)):  # the bows: an arch over the withers before the seat and against the hump behind it
        F.tube(f'SaddleBow{k}', [((-.20, y, .98), .015, S), ((-.15, y, 1.10), .016, S), ((0, y, top + .005), .018, S), ((.15, y, 1.10), .016, S),
                                 ((.20, y, .98), .015, S)], frame, 5)
        F.tube(f'SaddlePost{k}', [((0, y, top), .020, S), ((0, y + (-.015 if k == 0 else .015), top + .075), .015, S)], frame, 5)
    F.tube('SaddleCushion', [((0, -.34, top - .040), (.026, .100), S), ((0, -.28, top - .012), (.034, .120), S), ((0, -.20, top - .010), (.034, .120), S),
                              ((0, -.13, top - .030), (.026, .100), S)], cushion or cloth, 8)
    if bags:
        for sx in (-1, 1):
            F.tube(f'SaddleBag{sx}', [((sx * .195, .30, 1.00), (.050, .040), S), ((sx * .208, .34, .93), (.075, .050), S), ((sx * .200, .38, .86), (.060, .045), S)], bags, 7)


def camel_mounted(model, r):
    """One camel unit: the dromedary, its saddle, the rider astride on the cushion, his weapon, the halter's
    reins, the mounted clips."""
    start(r.get('colors'))
    parts = []
    camel = fine_camel()
    camel_saddle(camel, **r.get('saddle', {}))
    tm.enlarge(camel, tm.CAMEL_TRUE)
    parts.append(camel)
    k = tm.CAMEL_TRUE
    # the rider's crotch on the cushion: the fine horse's rider sits .422 over his rig's origin
    seat = V((0, CAMEL_SEAT_Y * k, CAMEL_SADDLE_TOP * k - .422))
    rd = SM.rider(r)
    parts.append(rd)
    wide = {"Leg_L": (-55, -34, 0), "Leg_R": (-55, 34, 0), "Shin_L": (68, 0, 0), "Shin_R": (68, 0, 0)}
    wkind, wk = r['weapon'] if isinstance(r['weapon'], tuple) else (r['weapon'], {})
    if wkind == 'bow':
        F.astride(right=(-.010, -.170, .790), left=(.170, -.380, .770), right_pole=(-1, .6, -.2), seat=seat, extra=wide)
        F.pointing_hand('R')
        gl = F.fist('L', None, (0, 0, 1), half=.020)
        SM.composite_bow(gl, length=wk.get('length', .62))
        clip = 'hand'
    else:
        F.astride(right=(-.215, -.120, .660), left=(.105, -.185, .640), seat=seat, extra=wide)
        g = F.fist('R', None, (0, 0, 1))
        gl = F.fist('L', None, (0, 1, 0), half=.020)
        if wkind == 'lance':
            SM.lance(g, **wk)
        elif wkind == 'javelin':
            SM.javelins(g, **wk)
        elif wkind == 'rifle':
            rifle_upright(g, **wk)
        clip = 'lance'
    for fn in r.get('post', []):
        fn()
    nose = V((.030, -1.015, 1.295)) * k
    reins_to(camel, seat + gl, tuple(nose), mat=r.get('reins', 'Rope'), sag=.08)
    notes = {'name': r['name'], 'role': r['role'] + ': ' + r['look'], 'signature': True, 'rig': 'camel',
             'recipe': 'build_signature_special.camel_mounted (2026-10-20)', 'clipKind': clip,
             'notes': 'Quality pass of the camel signature units: a dromedary of its own (rounder tubes, shaped legs, round pads) at its true size, the rider astride on ti_figure.py, the mounted clips with a pace and a kneeling fall.'}
    with beast_gaits('camel', drop=(CAMEL_BARREL[3][1] - CAMEL_BARREL[3][2]) * k - .05):
        tris = F.finish_unit(model, parts, notes, centre=(0, -.1, 1.0), scale=3.0, mode='NLA_TRACKS',
                             clips=MC.hook(model, lambda: MC.mounted(camel, rd, clip), 'mounted', {'ortho': 3.0, 'aim': (0, -.15, .85)}))
    print('TRIS', model, tris, flush=True)
    assert tris <= BUDGET, (model, tris)
    return tris


def rifle_upright(g, length=.86, prop='Prop_R', wood='Wood', metal='Iron', below=.30):
    """A rifle held upright by the wrist of the stock (Rifle*: kept at its length by the battle)."""
    z0, z1 = g.z - below, g.z - below + length
    F.tube('RifleStock', [((g.x, g.y + .010, z0), (.012, .030), prop), ((g.x, g.y + .004, z0 + .20), (.010, .018), prop), ((g.x, g.y, g.z + .06), .011, prop),
                          ((g.x, g.y, z0 + length * .78), (.010, .013), prop)], wood, 5, attachment=True)
    F.tube('RifleBarrel', [((g.x, g.y - .004, g.z + .04), .0055, prop), ((g.x, g.y - .004, z1), .0050, prop)], metal, 4, attachment=True)


# ---- tanks: built here on the base tank's rig (Hull, Track_L/R, Turret, Barrel; road wheels TankWheel<side><k>),
# authored at their drawn size (two thirds of real, MD09), with the base tank's clips -----------------------------

def tank_rig(ax, wheel_r, turret, barrel_head, barrel_dir=(0, -1, 0), hull_z=.4):
    tx, ty, tz = turret
    bh = V(barrel_head)
    return u.make_armature('TankRig', [('Hull', (0, 0, hull_z), (0, 0, hull_z + .2), None),
                                       ('Track_L', (ax, 0, wheel_r), (ax + .06, 0, wheel_r), 'Hull'),
                                       ('Track_R', (-ax, 0, wheel_r), (-ax - .06, 0, wheel_r), 'Hull'),
                                       ('Turret', (tx, ty, tz), (tx, ty, tz + .2), 'Hull'),
                                       ('Barrel', tuple(bh), tuple(bh + V(barrel_dir) * .2), 'Turret')])


def merkava():
    """The Merkava, generic (no markings): the engine in front under a long, steep glacis; a long, low,
    sharply wedged turret set well back with a big bustle and basket and a ball-and-chain curtain under the
    bustle's rear edge; a long gun with a thermal sleeve and fume extractor; side skirts over six large road
    wheels a side; the rear door with its step. Drawn size: hull 2.7 H (about 5 m), 3.75 H with the gun."""
    H, T, M, D, TM = 'Cloth', 'Leather', 'Metal', 'Leather', 'Team'
    hl, ax, tw, wr = 1.35, .53, .30, .165
    tz, ty = .66, .40
    zr = .80
    rig = tank_rig(ax, wr, (0, ty, tz), (0, -.40, zr))
    for side, sx in (('L', 1), ('R', -1)):
        bone = f'Track_{side}'
        tm.track_loop(f'Tank{side}', rig, bone, sx * ax, tw, -hl + .02, hl - .02, wr * .92, wr * 1.05, top=.40, mat=T, steps=6)
        span = 2 * hl - 2 * wr - .16
        for k in range(6):
            y = -span / 2 + span * k / 5
            tm.road_wheel(f'TankWheel{side}{k}', rig, bone, sx * (ax + tw / 2 + .004), y, wr, wr * .94, width=.04, mat=M, hub=T, sides=12)
    # the lower hull between the tracks, the upper hull over them: the long steep glacis to the engine deck
    tm.side_profile('TankLowerHull', [(-hl + .10, .30), (-hl + .25, .17), (hl - .12, .17), (hl, .30), (hl, .44), (-hl + .05, .44)], -.38, .38, H, 'Hull', rig)
    tm.side_profile('TankUpperHull', [(-hl, .40), (hl + .02, .40), (hl + .02, .66), (-.42, .68), (-hl + .02, .44)], -.70, .70, H, 'Hull', rig)
    u.box('TankEngineGrille', (0, -.78, .610), (.70, .40, .03), D, 'Hull', rig)
    u.box('TankDriverHatch', (-.26, -.50, .675), (.20, .16, .03), M, 'Hull', rig)
    for sx in (-1, 1):  # side skirts over the upper run of the track, a Team stripe along them
        tm.side_profile(f'TankSkirt{sx}', [(-hl + .14, .27), (hl - .05, .27), (hl, .33), (hl, .55), (-hl + .02, .55), (-hl + .02, .36)],
                        min(sx * .70, sx * .73), max(sx * .70, sx * .73), H, 'Hull', rig)
        u.box(f'TankSkirtStripe{sx}', (sx * .735, .05, .50), (.008, 2.1, .05), TM, 'Hull', rig)
        for k in range(5):  # the skirt's plate joints
            u.box(f'TankSkirtJoint{sx}{k}', (sx * .735, -1.0 + .5 * k, .40), (.008, .02, .2), D, 'Hull', rig)
        u.box(f'TankLight{sx}', (sx * .52, -1.05, .56), (.07, .05, .05), M, 'Hull', rig)
    # the rear door with its step (the Merkava's back hatch), and the exhaust louvres beside it
    u.box('TankRearDoor', (0, hl + .025, .45), (.36, .03, .30), M, 'Hull', rig)
    u.box('TankRearDoorHandle', (.12, hl + .045, .48), (.04, .015, .08), D, 'Hull', rig)
    u.box('TankRearStep', (0, hl + .07, .22), (.40, .10, .03), M, 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'TankRearLouvre{sx}', (sx * .45, hl + .02, .52), (.22, .02, .14), D, 'Hull', rig)
    # the turret: long, low and sharply wedged, set well back, a big bustle behind the ring
    # the turret: long, low and sharply wedged, set well back; the bustle behind the ring stands clear of the deck
    outline = [(-.10, -.52), (.10, -.52), (.46, -.12), (.52, .30), (.52, .56), (-.52, .56), (-.52, .30), (-.46, -.12)]
    tm.prism('TankTurret', outline, tz, tz + .28, H, 'Turret', rig, top=.90, top_shift=(0, .07))
    ring = [(x * 1.02, y - (.004 if y < 0 else 0)) for x, y in outline]
    tm.prism('TankTurretStripe', ring, tz + .10, tz + .15, TM, 'Turret', rig, top=.985, top_shift=(0, .02))
    tm.prism('TankBustle', [(-.50, .50), (.50, .50), (.50, 1.02), (.44, 1.12), (-.44, 1.12), (-.50, 1.02)], tz + .19, tz + .285, H, 'Turret', rig, top=.96)
    u.box('TankBasket', (0, 1.21, tz + .24), (.86, .18, .10), D, 'Turret', rig)
    u.box('TankBasketLoad', (.10, 1.20, tz + .30), (.50, .12, .05), TM, 'Turret', rig)
    # the ball-and-chain curtain: hung from the bustle's lower edge along its back and both sides, the balls in
    # the gap between the bustle and the deck
    drops = [(-.42 + .105 * k, 1.11) for k in range(9)] + [(sx * .515, y) for sx in (-1, 1) for y in (.66, .78, .90, 1.01)]
    for k, (x, y) in enumerate(drops):
        u.box(f'TankChain{k}', (x, y, tz + .150), (.010, .010, .08), D, 'Turret', rig)
        u.tube(f'TankChainBall{k}', [(x, y, tz + .052), (x, y, tz + .108)], [.040, .034], M, ['Turret'] * 2, 6, rig)
    # the gun: a small mantlet in the wedge's nose, a long tube with a thermal sleeve and a fume extractor
    u.box('TankMantlet', (0, -.47, zr), (.16, .12, .11), H, 'Barrel', rig)
    u.tube('TankBarrel', [(0, -.50, zr), (0, -1.20, zr + .003), (0, -2.24, zr + .008)], [.046, .040, .036], H, ['Barrel'] * 3, 10, rig)
    u.tube('TankEvacuator', [(0, -1.00, zr + .002), (0, -1.22, zr + .003)], [.060, .060], H, ['Barrel'] * 2, 10, rig)
    for k, y in enumerate((-.70, -1.55, -1.95)):  # the sleeve's bands
        u.tube(f'TankSleeveBand{k}', [(0, y, zr + .004), (0, y - .03, zr + .004)], [.048, .048], D, ['Barrel'] * 2, 8, rig)
    u.tube('TankMuzzleRef', [(-.0, -2.12, zr + .06), (0, -2.12, zr + .09)], [.012, .010], D, ['Barrel'] * 2, 5, rig)
    top = tz + .28
    u.tube('TankCupola', [(.20, .45, top), (.20, .45, top + .08)], [.10, .09], H, ['Turret'] * 2, 10, rig)
    u.box('TankCupolaHatch', (.20, .56, top + .14), (.15, .02, .12), M, 'Turret', rig)
    u.tube('TankLoaderHatch', [(-.22, .55, top), (-.22, .55, top + .03)], [.08, .08], M, ['Turret'] * 2, 8, rig)
    u.tube('TankMG', [(-.22, .40, top + .09), (-.22, .10, top + .10)], [.013, .011], D, ['Turret'] * 2, 5, rig)
    u.box('TankMGMount', (-.22, .44, top + .05), (.04, .06, .06), D, 'Turret', rig)
    u.box('TankSight', (.30, .05, top + .04), (.14, .12, .08), D, 'Turret', rig)
    for sx in (-1, 1):
        u.box(f'TankSmoke{sx}', (sx * .42, .00, tz + .20), (.10, .10, .07), D, 'Turret', rig)
        u.tube(f'TankAntenna{sx}', [(sx * .40, 1.00, top), (sx * .40, 1.00, top + .45)], [.007, .003], D, ['Turret'] * 2, 4, rig)
    return [rig]


def ltvz38():
    """The LT vz. 38 (1938), a small light tank: a riveted boxy hull with a vertical front plate (the driver's
    visor and the hull machine gun), four large road wheels a side with return rollers, a raised front
    sprocket, a small riveted box turret with a cupola and a short 37 mm gun. Drawn size: about 1.95 H long
    (3.5 m) with the gun, under half the Merkava."""
    H, T, M, D, TM = 'Cloth', 'Leather', 'Metal', 'Leather', 'Team'
    hl, ax, tw, wr = .84, .30, .17, .135
    tz, ty, zr = .62, -.04, .75
    rig = tank_rig(ax, wr, (0, ty, tz), (0, ty - .34, zr))
    for side, sx in (('L', 1), ('R', -1)):
        bone = f'Track_{side}'
        tm.track_loop(f'Tank{side}', rig, bone, sx * ax, tw, -hl - .02, hl, .10, .085, top=.33, mat=T, steps=6)
        for k, y in enumerate((-.45, -.15, .15, .45)):
            tm.road_wheel(f'TankWheel{side}{k}', rig, bone, sx * (ax + tw / 2 + .004), y, wr, wr * .95, width=.04, mat=M, hub=T, sides=12)
        for k, y in enumerate((-.30, .30)):  # return rollers
            u.tube(f'TankRoller{side}{k}', [(sx * (ax + tw / 2 - .02), y, .30), (sx * (ax + tw / 2 + .02), y, .30)], [.035, .035], M, [bone] * 2, 6, rig)
        u.tube(f'TankSprocket{side}', [(sx * (ax + tw / 2 - .02), -hl + .07, .24), (sx * (ax + tw / 2 + .03), -hl + .07, .24)], [.085, .085], M, [bone] * 2, 10, rig)
    tm.side_profile('TankLowerHull', [(-hl + .02, .30), (-hl + .12, .15), (hl - .05, .15), (hl, .26), (hl, .36), (-hl + .02, .36)], -.22, .22, H, 'Hull', rig)
    # the riveted superstructure: a box over the tracks, a near-vertical front plate, a sloped rear deck
    tm.side_profile('TankUpperHull', [(-hl + .02, .34), (hl, .34), (hl, .50), (.30, .62), (-.56, .62), (-hl + .03, .58)], -.40, .40, H, 'Hull', rig)
    u.box('TankVisor', (-.13, -hl + .02, .54), (.16, .03, .06), D, 'Hull', rig)
    u.box('TankVisorSlit', (-.13, -hl + .005, .55), (.12, .01, .015), M, 'Hull', rig)
    u.tube('TankHullMG', [(.14, -hl + .02, .52), (.14, -hl - .14, .52)], [.016, .012], D, ['Hull'] * 2, 6, rig)
    u.tube('TankHullMGBall', [(.14, -hl + .03, .52), (.14, -hl - .01, .52)], [.035, .030], H, ['Hull'] * 2, 8, rig)
    for sx in (-1, 1):
        u.box(f'TankSideStripe{sx}', (sx * .405, .02, .44), (.008, 1.15, .04), TM, 'Hull', rig)
        u.box(f'TankFender{sx}', (sx * ax, 0, .345), (tw + .04, 2 * hl - .02, .015), H, 'Hull', rig)
        u.box(f'TankLight{sx}', (sx * .30, -hl + .03, .64), (.06, .05, .05), M, 'Hull', rig)
        u.box(f'TankExhaust{sx}', (sx * .15, hl + .02, .43), (.14, .04, .06), D, 'Hull', rig)
        for k in range(7):  # rows of rivets along the superstructure
            u.box(f'TankRivet{sx}{k}', (sx * .403, -.65 + .21 * k, .58), (.012, .02, .02), M, 'Hull', rig)
    for k in range(6):
        u.box(f'TankFrontRivet{k}', (-.30 + .12 * k, -hl + .005, .59), (.02, .012, .02), M, 'Hull', rig)
    u.box('TankEngineGrille', (0, .55, .555), (.50, .30, .03), D, 'Hull', rig)
    # the small riveted box turret, a cupola, the short 37 mm gun with its coaxial MG
    outline = [(-.20, -.34), (.20, -.34), (.27, -.22), (.27, .30), (-.27, .30), (-.27, -.22)]
    tm.prism('TankTurret', outline, tz, tz + .22, H, 'Turret', rig, top=.88)
    for sx in (-1, 1):
        u.box(f'TankTurretStripe{sx}', (sx * .262, ty + .02, tz + .11), (.008, .40, .05), TM, 'Turret', rig)
        for k in range(4):
            u.box(f'TankTurretRivet{sx}{k}', (sx * .262, ty - .20 + .14 * k, tz + .19), (.012, .018, .018), M, 'Turret', rig)
    u.tube('TankCupola', [(.08, ty + .14, tz + .21), (.08, ty + .14, tz + .30)], [.075, .07], H, ['Turret'] * 2, 10, rig)
    u.tube('TankCupolaTop', [(.08, ty + .14, tz + .30), (.08, ty + .14, tz + .32)], [.072, .05], M, ['Turret'] * 2, 10, rig)
    u.box('TankMantlet', (0, ty - .36, zr), (.24, .06, .13), H, 'Barrel', rig)
    u.tube('TankBarrel', [(-.04, ty - .38, zr), (-.04, ty - .62, zr), (-.04, ty - .88, zr)], [.030, .022, .020], H, ['Barrel'] * 3, 8, rig)
    u.tube('TankCoaxMG', [(.07, ty - .38, zr), (.07, ty - .54, zr)], [.018, .012], D, ['Barrel'] * 2, 6, rig)
    u.tube('TankAntenna', [(-.22, ty + .25, tz + .22), (-.22, ty + .25, tz + .60)], [.006, .003], D, ['Turret'] * 2, 4, rig)
    return [rig]


TANK_SPECS = {
    'kingdom-of-israel': dict(name='Merkava main battle tank', build=merkava,
                              colors={'Skin': 'C99472', 'Cloth': 'A39A80', 'Leather': '2C2A26', 'Metal': ('5A5A54', .45, .6), 'Wood': '4A4038'},
                              look='the Merkava: the engine in front under a long steep glacis, a long low sharply wedged turret set far back with a big bustle, basket and a ball-and-chain curtain, a long gun with a thermal sleeve, side skirts over six road wheels a side, the rear door with its step; sand grey, a Team stripe on the skirts and the turret, no markings'),
    'marcomannia': dict(name='LT vz. 38 light tank', build=ltvz38,
                        colors={'Skin': 'C99472', 'Cloth': '5C6248', 'Leather': '2A2A28', 'Metal': ('4A4C48', .45, .6), 'Wood': '4A4038'},
                        look='the LT vz. 38 of 1938: a small riveted boxy hull and turret, four large road wheels a side with return rollers, a raised front sprocket, a short 37 mm gun, a hull machine gun beside the driver\'s visor, a cupola; olive, a Team stripe on the hull and the turret'),
}


def tank_unit(model):
    """A signature tank on the base tank's rig with the base tank's clips (ti_vehicle_clips.tank: Idle, Move,
    Fire, Hit, Wreck; the turret left to the game's aim, the barrel's recoil in location only)."""
    import build_units_bronze_signature as lib
    out_root()
    lib.reset()
    spec = TANK_SPECS[model]
    parts = spec['build']()
    state = {}

    def clips():
        state['table'], state['order'] = VC.tank(parts)
        return state['table']
    lib.finish(model, parts, spec['colors'], {'name': spec['name'], 'role': 'cavalry', 'rig': 'tank', 'look': spec['look'],
                                              'recipe': 'build_signature_special.tank_unit (2026-10-20)'},
               BUDGET, False, clips=clips)
    tm.mark_machine(model)
    VC.write_options(model, state['table'], state['order'])
    if os.environ.get('TI_PREVIEW'):
        MC.set_clip('Idle', 1)
        F.preview_scene(u.out_dir(model), model, centre=(0, -.3, .5), scale=4.6)
    tris = u.scene_triangles()
    print('TRIS', model, tris, flush=True)
    assert tris <= MACHINE_BUDGET, (model, tris)
    return tris


# ---- siege frames: the old machines, the crew on the figure standard (LITE), the siege clips -----------------

def crewman(name, at, yaw, left, right, lean=8, dress=None):
    """A machine's crewman (LITE, as the base siege crews): `dress()` dresses him; both wrists reached to
    points of his own space (before he is turned and placed), fists closed there."""
    rig = F.figure(name)
    F.LITE = True
    dress()
    F.pose({'Spine': (lean, 0, 0), 'Chest': (lean * .7, 0, 0), 'Head': (-lean, 0, 0)})
    F.reach('L', left, pole=(.8, .7, -.6))
    F.reach('R', right, pole=(-.8, .7, -.6))
    F.bake_rest()
    F.fist('L', None, (1, 0, 0), half=.020)
    F.fist('R', None, (1, 0, 0), half=.020)
    F.place(at, yaw)
    return rig


def greek_linen():
    """A Bosporan crewman: a white linen cuirass with a Team waist sash over a short tunic, a felt pilos, a
    beard, bare legs and sandals."""
    F.legs(laces=False, straps=True)
    F.arms()
    F.head(ears=False)
    F.cap('Pilos', 'Felt', attachment=False, height=1.080)
    F.skirt('Tunic', 'Cloth', low=.400, grow=.006, sides=8)
    F.torso('Cuirass', 'Linen', grow=.014, chest=.008, sides=8)
    F.band('Sash', 'Team', .515, .550, grow=.020, bone='Spine', sides=8)


def tondo_sarong():
    """A Tondo gunner: a Team sarong to the calves, bare chest, a headcloth, a powder gourd at the hip."""
    F.legs(laces=False, straps=False)
    F.arms()
    F.head()
    F.hair(crown=False)
    F.headcloth('Team', tail=False, cloth='Cloth')
    F.bronze_torso('BodyTorso', 'Skin', chest=True, grow=-.004, sides=8)
    F.skirt('Sarong', 'Team', low=.180, grow=.008, sides=8)
    F.band('SarongBelt', 'Cloth', .520, .545, grow=.012, bone='Spine', sides=8)
    F.tube('Gourd', [((.125, -.010, .500), .014, 'Hips'), ((.135, -.020, .450), .034, 'Hips'), ((.130, -.026, .395), .022, 'Hips')], 'Gourd', 6)


def frame_unit(model):
    if model == 'bosporan-kingdom':
        import build_units_classical_signature as cs
        start({'Skin': 'C99472', 'Cloth': 'E8DEC6', 'Linen': 'EFE9DA', 'Felt': '8A6A48', 'Leather': '6B4630', 'Metal': IRON, 'Wood': '8A6646',
               'Hair': '2B201A'})
        parts, info = tm.frame('Frame', length=1.1, width=.52)
        tm.torsion_engine(info, stone=True, scale=1.1)
        cs.stone_pile(info['rig'], (.62, .55))
        tm.enlarge(info['rig'], 1.25)  # two thirds of real size (MD09), as before
        spots = [(-.68, .30, 90, (.140, -.290, .470), (-.120, -.300, .470), 16), (.68, .22, -90, (.120, -.300, .470), (-.140, -.290, .470), 16),
                 (0, 1.00, 0, (.132, -.320, .594), (-.132, -.320, .594), 10)]
        for i, (x, y, yaw, left, right, lean) in enumerate(spots):
            parts.append(crewman(f'Crew{i}', (x, y, 0), yaw, left, right, lean, greek_linen))
        author = VC.ballista
        look = 'a torsion stone-thrower on the wheeled siege frame (two spring bundles, a pouch with a stone, the winch), a pile of stones; three crew in white linen cuirasses with Team sashes and felt caps: two lean in to the arms, one works the winch'
        name = 'Bosporan stone-thrower crews (improvised)'
    else:
        import build_units_gunpowder_signature as gs
        start({'Skin': '8A573A', 'Cloth': 'C9A66B', 'Leather': '2E2A28', 'Metal': ('A8823C', .55, .75), 'Wood': '6E5236', 'Hair': '1A1410',
               'Gourd': 'B89A5A'})
        parts, info = tm.frame('Frame', wheels=False, deck_z=.24, length=.9, width=.44)
        gs.lantaka(info)
        (x0, y0, _, _), (x1, y1, _, _), (x2, y2, _, _) = info['crew']
        spots = [(x0, y0, 90, (.140, -.290, .470), (-.120, -.300, .470), 14), (x1, y1, -90, (.120, -.300, .470), (-.140, -.290, .470), 14),
                 (x2, y2 - .04, 0, (.040, -.240, .600), (-.030, -.250, .590), 12)]  # the gunner behind, both hands on the tiller
        for i, (x, y, yaw, left, right, lean) in enumerate(spots):
            parts.append(crewman(f'Crew{i}', (x, y, 0), yaw, left, right, lean, tondo_sarong))
        author = tondo_clips
        look = 'a bronze lantaka swivel gun on a yoke atop a post in a wooden rest, a few balls; three crew in Team sarongs with headcloths and powder gourds: the gunner behind on the tiller, two beside'
        name = 'Tondo lantaka gun crews'
    CLIPS = {}
    notes = {'name': name, 'role': 'siege: ' + look, 'signature': True, 'rig': 'frame', 'recipe': 'build_signature_special.frame_unit (2026-10-20)',
             'notes': 'The machine of the old builder (unchanged calls); the crew are ti_figure.py LITE figures as the base siege units.'}
    tris = F.finish_unit(model, parts, notes, centre=(0, .2, .5), scale=2.6, mode='NLA_TRACKS',
                         clips=MC.hook(model, lambda: CLIPS.setdefault('r', author(parts)), 'vehicle'))
    out = u.out_dir(model)
    (out / f'{model}.json').write_text(json.dumps({'enabled': True, 'quadruped': False, 'triangleBudget': 6000, 'tags': TAGS}, indent=2) + '\n')
    tm.mark_machine(model)
    VC.write_options(model, *CLIPS['r'])
    print('TRIS', model, tris, flush=True)
    assert tris <= MACHINE_BUDGET, (model, tris)
    return tris


def tondo_clips(parts):
    """The lantaka's shot: the gunner behind sights along it and touches it off, the two beside crouch and
    turn away; the gun kicks on its rest (a short jolt, no wheels)."""
    at, n = 24, 40
    cover = VC._cover(at)
    aim = {'r': {'Spine': (16, 0, 0), 'Chest': (6, 0, 0), 'Head': (-12, 0, 0)}, 'root': (0, 0, -.04), 'plant': 1}
    gunner = [(1, {}), (8, aim), (at - 1, aim), (at + 2, dict(aim, r={'Spine': (6, 0, 0), 'Chest': (-4, 0, 0), 'Head': (-16, 0, 8)}, ease='out')), (at + 10, aim), (n, {})]
    side = [(1, {}), (10, {'r': {'Spine': (10, 0, 0)}, 'plant': 1}), (at - 4, cover), (at + 8, cover), (n, {})]
    return VC.old_machine('tondo', parts, at, n, .010, 1.4, lambda i: gunner if i == 2 else side)


# ---- the ox (the Khoekhoe war ox ridden; Kitara's Ankole beside its guard) ------------------------------------

def fine_ox_q(prefix='Ox', at=(0, 0, 0), horns='wide'):
    """tm.fine_ox raised to the close version: the barrel a rounder tube (14 sides, Catmull-Rom rows), shaped legs
    (a muscled forearm and haunch, knees and hocks, slim cannons, cloven hooves) and horns of the breed:
    'wide' (the Khoekhoe's long, wide-curving horns) or 'ankole' (huge thick lyre horns)."""
    arm, meshes = tm.fine_ox(prefix, at, coat='Coat', dark='Mane', horn='Horn', pale='Pale')
    drop = {f'{prefix}{n}' for n in ('Barrel', 'Horn-1', 'Horn1')}
    for ob in [o for o in bpy.data.objects if o.parent == arm and o.type == 'MESH'
               and (o.name in drop or any(o.name.startswith(f'{prefix}{k}') for k in ('Thigh', 'Cannon', 'Hoof')))]:
        bpy.data.objects.remove(ob, do_unlink=True)
    F.use(arm)
    S, H = 'Mount_Spine', 'Mount_Head'
    btube(f'{prefix}Barrel', [(0, y, z) for y, z, _, _ in tm.OX_BARREL], [(h, w) for _, _, h, w in tm.OX_BARREL], 'Coat', S, 14, k=3)
    for side, sx in (('L', 1), ('R', -1)):
        x = sx * .105
        for end, y0 in (('Front', -.34), ('Hind', .36)):
            leg, shin = f'Mount_Leg{end}_{side}', f'Mount_Shin{end}_{side}'
            if end == 'Front':
                ring = [(0, .50, .062, .090, leg), (-.004, .36, .050, .064, leg), (0, .245, .034, .040, leg), (0, .200, .030, .035, shin),
                        (0, .110, .024, .028, shin), (-.004, .058, .028, .032, shin)]
            else:
                ring = [(0, .52, .072, .115, leg), (.016, .38, .056, .082, leg), (.040, .26, .032, .042, leg), (.046, .205, .030, .036, shin),
                        (.020, .110, .024, .028, shin), (-.002, .058, .028, .032, shin)]
            F.tube(f'{prefix}Leg{end}_{side}', [((x, y0 + dy, z), (rx, ry), bn) for dy, z, rx, ry, bn in ring], 'Coat', 8)
            for c in (-1, 1):  # the cloven hoof
                F.tube(f'{prefix}Claw{end}_{side}{c}', [((x + c * .013, y0 - .010, .055), (.014, .020), shin), ((x + c * .014, y0 - .016, .024), (.017, .026), shin),
                                                       ((x + c * .015, y0 - .020, .002), (.018, .028), shin)], 'Mane', 6)
    if horns == 'ankole':
        pts = [(.050, -.612, .655), (.180, -.605, .760), (.285, -.580, .940), (.300, -.560, 1.120), (.255, -.555, 1.270)]
        rad = [.034, .032, .027, .018, .004]
    else:
        pts = [(.045, -.612, .650), (.170, -.610, .690), (.265, -.625, .780), (.290, -.655, .880)]
        rad = [.024, .021, .015, .003]
    for sx in (-1, 1):
        F.tube(f'{prefix}Horn{sx}', [((sx * x, y, z), r, H) for (x, y, z), r in zip(pts, rad)], 'Horn', 6)
    return arm


OX_SADDLE_TOP = .715  # the hide saddle over the ox's back (OX_BARREL's top at y 0, the hide on it)


def ox_mounted(model, r):
    """The Khoekhoe war ox ridden: the fine ox, a hide saddle and a nose-ring halter, the rider astride with a
    spear, the mounted clips (the horse's gaits on the ox's shorter legs; the base horse's falls)."""
    start(r.get('colors'))
    ox = fine_ox_q('Mount', horns='wide')
    F.use(ox)
    S = 'Mount_Spine'
    F.meshes.append(tm.drape('HideSaddle', ox, 'Hide', -.20, .14, reach=72, grow=.012, barrel=tm.OX_BARREL, steps=12, rows=5, fringe=.020))
    F.meshes.append(tm.drape('SaddleGirth', ox, 'Leather', -.17, -.135, reach=180, grow=.016, barrel=tm.OX_BARREL, rows=2, steps=14))
    F.tube('NoseRing', [((-.022, -.812, .405), .006, 'Mount_Head'), ((0, -.826, .392), .006, 'Mount_Head'), ((.022, -.812, .405), .006, 'Mount_Head')], 'Rope', 4)
    rd = SM.rider(r)
    seat = V((0, -.03, OX_SADDLE_TOP - .422))
    wide = {'Leg_L': (-58, -36, 0), 'Leg_R': (-58, 36, 0), 'Shin_L': (66, 0, 0), 'Shin_R': (66, 0, 0)}
    F.astride(right=(-.215, -.120, .660), left=(.105, -.185, .640), seat=seat, extra=wide)
    g = F.fist('R', None, (0, 0, 1))
    gl = F.fist('L', None, (0, 1, 0), half=.020)
    SM.lance(g, **r['weapon'][1])
    reins_to(ox, seat + gl, (.024, -.810, .410), mat='Rope', sag=.06)
    notes = {'name': r['name'], 'role': r['role'] + ': ' + r['look'], 'signature': True, 'rig': 'ox',
             'recipe': 'build_signature_special.ox_mounted (2026-10-20)', 'clipKind': 'lance',
             'notes': 'Quality pass of the Khoekhoe ox rider: tm.fine_ox with a rounder barrel, shaped legs and cloven hooves, the rider astride on ti_figure.py, the mounted clips.'}
    with beast_gaits('ox', drop=.4):
        tris = F.finish_unit(model, [ox, rd], notes, centre=(0, -.1, .6), scale=2.6, mode='NLA_TRACKS',
                             clips=MC.hook(model, lambda: MC.mounted(ox, rd, 'lance'), 'mounted', {'ortho': 2.4, 'aim': (0, -.15, .6)}))
    print('TRIS', model, tris, flush=True)
    assert tris <= BUDGET, (model, tris)
    return tris


KHOEKHOE = dict(name='Khoekhoe ox riders', role='War-ox riders',
                colors={'Coat': '7A4A2C', 'Mane': '2A1E16', 'Pale': 'E8DED0', 'Horn': 'D8CBB0', 'Skin': '8A573A', 'Hair': '1A1410', 'Hide': 'A07A50',
                        'Kaross': '8A6440', 'Cloth': 'E8DCC0', 'Leather': '5A3A26', 'Wood': '4A3426', 'Rope': 'A08A64', 'Iron': IRON, 'Metal': IRON},
                legs='bare', hair='full', beard=True, dress=dict(skirt='Kaross', skirt_low=.420, top='Skin', belt='Team', cloak='Kaross'),
                head=None, weapon=('lance', {'top': 1.45}),
                look='a red-brown war ox with a pale back and wide curving horns under a hide saddle, a nose-ring halter; the rider bare-chested under a skin kaross, a Team waist band, a long spear')


# Kitara: the spearman on foot with the foot soldiers' clips, the Ankole ox beside him with its own clips that
# follow his (one glTF animation per clip over both rigs).
OX_SIDE = .62  # the ox stands this far to the man's left (+X)
OX_WALK = dict(T=10, d=.62, amp=.14, lift=(.06, .05), ph={'HL': 0, 'FL': .25, 'HR': .5, 'FR': .75}, hop=0)    # his walk: 1.6 m/s
OX_TROT = dict(T=7, d=.42, amp=.106, lift=(.09, .07), ph={'FL': 0, 'HR': 0, 'FR': .5, 'HL': .5}, hop=.006)   # his run: 2.6 m/s


def kitara_unit(model):
    TS.start({'Skin': '6A4430', 'Hair': '1A1410', 'Leather': '7E5A3A', 'Cloth': 'E6DDC5', 'Wood': '5A4130', 'Metal': IRON, 'Emblem': 'E6D6AF',
              'Coat': '8A4A2A', 'Mane': '2A1E16', 'Pale': 'EDE4D4', 'Horn': 'E2D6BC', 'Rope': 'A08A64', 'Hide': 'B89A72'})
    F.LITE = False  # (a crew built before in this run left the lighter figure on)
    man = F.arm
    man.name = 'GuardRig'
    TS.body(legs='bare', beard=True, hair='full')
    TS.dress('kilt', 'Leather', team='sash')
    F.band('Necklace', 'Horn', .770, .785, grow=.020, bone='Chest', sides=10)
    kit = TS.spear(length=2.1, head='broad')
    TS.shield('oval', size=1.05, rim='Leather', back='Leather')
    kit.shield = True
    man_meshes = [m for m in F.meshes if m.parent == man]
    ox = fine_ox_q('Ox', at=(OX_SIDE, .05, 0), horns='ankole')
    F.use(ox)
    F.meshes.append(tm.drape('OxNeckRope', ox, 'Rope', -.42, -.40, reach=180, grow=.004, barrel=tm.OX_BARREL, rows=2, steps=10))
    notes = {'name': 'Kitaran longhorn cattle guards (improvised)', 'role': 'infantry: a spearman in a leather skirt with a Team sash, an oxhide shield, a broad-bladed spear; a long-horned Ankole ox beside him',
             'signature': True, 'rig': 'ox', 'recipe': 'build_signature_special.kitara_unit (2026-10-20)',
             'notes': 'The man on ti_signature/ti_figure with the base infantry clips (ti_foot_clips); the ox (fine_ox_q) keyed per clip to follow him.'}
    state = {}

    def run():
        table, order, _ = FC.author(kit, man, man_meshes)
        man.animation_data.action = None
        table = dict(table)
        ox_follow(ox, table, order)
        state['table'] = table
        return table, order
    tris = F.finish_unit(model, [man, ox], notes, open_facing=TS.SHIELD_FACING, centre=(.3, 0, .6), scale=2.8, mode='NLA_TRACKS', clips=(run, None))
    print('TRIS', model, tris, flush=True)
    assert tris <= BUDGET, (model, tris)
    return tris


@contextmanager
def ox_gaits():
    saved = (dict(MC.GAITS), MC.gait_shape)
    base = MC.gait_shape
    try:
        MC.GAITS['oxwalk'], MC.GAITS['oxtrot'] = OX_WALK, OX_TROT
        MC.gait_shape = lambda k, p: base({'oxwalk': 'walk', 'oxtrot': 'trot'}.get(k, k), p)
        yield
    finally:
        MC.GAITS.clear()
        MC.GAITS.update(saved[0])
        MC.gait_shape = saved[1]


def ox_follow(ox, table, order):
    """Key the ox for every clip of the man (the same frames): it stands and shifts while he stands, fights or
    blocks, walks with his walk and trots with his run, flinches with him, goes down when he falls, tosses its
    head when he cheers. One action per clip on an NLA track named after it (ti_mounted_clips.write)."""
    horse = MC.Horse(ox, [m for m in F.meshes if m.parent == ox])

    def keyed(kind, n, sign=1):
        keys = MC.horse_keys(kind, sign)
        last = keys[-1][0]
        keys = [(1 + round((f - 1) * (n - 1) / (last - 1)), s) for f, s in keys]
        return lambda f: spec_at(keys, f)
    with ox_gaits():
        for act in order:
            n = table[act]['frames']
            if act in ('Walk',):
                fn = MC.horse_gait(horse, 'oxwalk', n)
            elif act in ('Run', 'Retreat-run'):
                fn = MC.horse_gait(horse, 'oxtrot', n)
            elif act == 'Hit':
                fn = keyed('Hit', n)
            elif act in ('Death', 'DeathAlt'):
                fn = keyed(act, n, 1)  # onto its left side, away from the man
            elif act == 'Cheer':
                fn = keyed('Cheer', n)
            elif act in ('Attack', 'Attack2'):
                fn = keyed('Attack', n)
            else:  # Idle, IdleAlt, Block
                fn = keyed('Idle', n)
            frames = []
            for f in range(1, n + 1):
                horse.pose(None if (act == 'Idle' and f in (1, n)) else fn(f))
                frames.append(MC.snapshot(ox))
            MC.write(ox, act, frames, table[act]['loop'])
    MC.reset(ox)
    upd()


# ---- the war elephant -----------------------------------------------------------------------------------------
# On the elephant rig of ti_mounts (ti_units.quadruped 'elephant', already its true size: about 3 m at the back),
# plus Mount_Trunk (a child of Mount_Head) so the trunk swings, rises in the attack and trumpets in the cheer.
ELE_BARREL = [(-.70, 1.240, .170, .200), (-.62, 1.240, .380, .360), (-.45, 1.230, .440, .420), (-.20, 1.220, .460, .440), (.10, 1.210, .450, .430),
              (.35, 1.180, .420, .400), (.52, 1.130, .340, .320), (.62, 1.080, .170, .170)]
HOWDAH = dict(y=.02, floor=1.715, w=.64, d=.66, h=.30)


def add_bone(arm, name, head, tail, parent):
    bpy.ops.object.select_all(action='DESELECT')
    bpy.context.view_layer.objects.active = arm
    arm.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT')
    b = arm.data.edit_bones.new(name)
    b.head, b.tail, b.roll = head, tail, 0
    b.parent = arm.data.edit_bones[parent]
    bpy.ops.object.mode_set(mode='OBJECT')
    for pb in arm.pose.bones:
        pb.rotation_mode = 'QUATERNION'


def fine_elephant(tusks=1.0):
    """An Asian war elephant: a deep barrel with a sloping back, a short thick neck, the domed head, big ears,
    a long trunk on its own bone, tusks (`tusks` their length), column legs with toenails, a thin tufted tail."""
    arm, meshes = u.quadruped('Elephant', 'elephant', (0, 0, 0), coat='Coat', dark='Mane')
    for ob in list(meshes):
        bpy.data.objects.remove(ob, do_unlink=True)
    add_bone(arm, 'Mount_Trunk', (0, -1.08, 1.02), (0, -1.12, .62), 'Mount_Head')
    F.use(arm)
    S, N, H, T = 'Mount_Spine', 'Mount_Neck', 'Mount_Head', 'Mount_Trunk'
    btube('ElephantBarrel', [(0, y, z) for y, z, _, _ in ELE_BARREL], [(h, w) for _, _, h, w in ELE_BARREL], 'Coat', S, 12, k=2)
    btube('ElephantNeck', [(0, -.56, 1.30), (0, -.66, 1.38)], [(.36, .33), (.32, .30)], 'Coat', [{S: .5, N: .5}, N], 12)
    head = [(0, -.62, 1.42), (0, -.76, 1.52), (0, -.90, 1.48), (0, -1.00, 1.32), (0, -1.05, 1.13)]
    btube('ElephantHead', head, [(.29, .26), (.30, .28), (.27, .26), (.20, .20), (.13, .13)], 'Coat', [N, H, H, H, H], 10)
    trunk = [(0, -1.06, 1.12), (0, -1.11, .90), (0, -1.13, .66), (0, -1.11, .42), (0, -1.06, .24), (0, -1.00, .15)]
    btube('ElephantTrunk', trunk, [.105, .088, .074, .062, .052, .040], 'Coat', [H, {H: .4, T: .6}, T, T, T, T], 8, k=2)
    for sx in (-1, 1):
        if tusks:
            ftube(f'ElephantTusk{sx}', [(sx * .13, -1.02, 1.08), (sx * .16, -1.02 - .16 * tusks, .98), (sx * .14, -1.02 - .28 * tusks, 1.02)], [.040, .030, .008], 'Ivory', H, 7)
        v = [(sx * .24, -.80, 1.66), (sx * .44, -.66, 1.56), (sx * .47, -.64, 1.26), (sx * .36, -.70, 1.02), (sx * .25, -.80, 1.14)]
        F.raw(f'ElephantEar{sx}', v, [(0, 1, 2), (0, 2, 3), (0, 3, 4), (0, 2, 1), (0, 3, 2), (0, 4, 3)], 'Coat', H)
        F.box(f'ElephantEye{sx}', (sx * .215, -.93, 1.42), (.020, .035, .022), 'Mane', H)
    btube('ElephantTail', [(0, .62, 1.10), (0, .67, .85), (0, .68, .62)], [.030, .022, .016], 'Coat', 'Mount_Tail', 6)
    btube('ElephantTailTuft', [(0, .68, .64), (0, .685, .57), (0, .68, .52)], [.020, .028, .006], 'Mane', 'Mount_Tail', 6)
    for side, sx in (('L', 1), ('R', -1)):
        x = sx * .22
        for end, y0 in (('Front', -.36), ('Hind', .34)):
            leg, shin = f'Mount_Leg{end}_{side}', f'Mount_Shin{end}_{side}'
            if end == 'Front':
                ring = [(0, 1.00, .170, .190, leg), (0, .80, .150, .160, leg), (0, .60, .130, .135, leg), (0, .52, .128, .132, shin),
                        (0, .30, .120, .124, shin), (0, .12, .126, .130, shin), (0, .045, .138, .142, shin)]
            else:
                ring = [(0, 1.00, .190, .230, leg), (.020, .78, .160, .175, leg), (.030, .58, .130, .140, leg), (.030, .50, .126, .132, shin),
                        (.020, .30, .118, .122, shin), (0, .12, .124, .128, shin), (0, .045, .136, .140, shin)]
            F.tube(f'ElephantLeg{end}_{side}', [((x, y0 + dy, z), (rx, ry), bn) for dy, z, rx, ry, bn in ring], 'Coat', 8)
            F.tube(f'ElephantPad{end}_{side}', [((x, y0, .050), (.140, .144), shin), ((x, y0, .004), (.142, .146), shin)], 'Mane', 10)
            for k in ((-1, 1) if end == 'Front' else (0,)):  # the toenails
                a = math.radians(k * 32)
                F.box(f'ElephantNail{end}_{side}{k}', (x + math.sin(a) * .125, y0 - math.cos(a) * .125, .035), (.050, .022, .040), 'Ivory', shin)
    return arm


def howdah(arm, wall='Wood', rail='Wood', cloth='Saddle', trim=None, wicker=False):
    """The howdah on the back: a saddle cloth under it, a floor, low walls (wickerwork or planks), corner posts
    and a top rail; Mount_Spine."""
    F.use(arm)
    S = 'Mount_Spine'
    y, z, w, d, h = HOWDAH['y'], HOWDAH['floor'], HOWDAH['w'], HOWDAH['d'], HOWDAH['h']
    F.meshes.append(tm.drape('HowdahCloth', arm, cloth, y - d / 2 - .10, y + d / 2 + .10, reach=62, grow=.012, barrel=ELE_BARREL, steps=12, rows=4,
                             fringe=.030))
    if trim:
        F.meshes.append(tm.drape('HowdahClothHem', arm, trim, y - d / 2 - .105, y + d / 2 + .105, reach=66, grow=.008, barrel=ELE_BARREL, steps=12, rows=2))
    F.box('HowdahFloor', (0, y, z - .02), (w + .04, d + .04, .05), rail, S)
    F.box('HowdahBase', (0, y, z - .09), (w * .8, d * .8, .10), rail, S)
    for sx in (-1, 1):
        F.box(f'HowdahSide{sx}', (sx * w / 2, y, z + h / 2), (.03, d, h), wall, S)
        F.box(f'HowdahEnd{sx}', (0, y + sx * d / 2, z + h / 2), (w, .03, h), wall, S)
        for sy in (-1, 1):
            F.tube(f'HowdahPost{sx}{sy}', [((sx * w / 2, y + sy * d / 2, z - .02), .026, S), ((sx * w / 2, y + sy * d / 2, z + h + .07), .022, S)], rail, 4)
    for sx in (-1, 1):
        F.tube(f'HowdahRail{sx}', [((sx * w / 2, y - d / 2, z + h), .016, S), ((sx * w / 2, y + d / 2, z + h), .016, S)], rail, 5)
        F.tube(f'HowdahRailEnd{sx}', [((-w / 2, y + sx * d / 2, z + h), .016, S), ((w / 2, y + sx * d / 2, z + h), .016, S)], rail, 5)
    if wicker:  # the weave: dark bands round the walls
        for k, zz in enumerate((z + .08, z + .18)):
            F.box(f'WickerBand{k}a', (0, y - d / 2 - .002, zz), (w, .012, .025), 'Leather', S)
            F.box(f'WickerBand{k}b', (0, y + d / 2 + .002, zz), (w, .012, .025), 'Leather', S)
            for sx in (-1, 1):
                F.box(f'WickerBand{k}{sx}', (sx * (w / 2 + .002), y, zz), (.012, d, .025), 'Leather', S)
    # the girth and the crupper that hold it on
    F.meshes.append(tm.drape('HowdahGirth', arm, 'Rope', y - .05, y - .01, reach=180, grow=.016, barrel=ELE_BARREL, rows=2, steps=16))


def armour(arm, kind, mat, paint=None):
    """kind 'plates' (metal plates over the shoulders and the flanks, a brow plate), 'leather' (a hide coat over
    the barrel, a painted brow), 'quilt' (a quilted cloth to the knees)."""
    F.use(arm)
    H = 'Mount_Head'
    if kind == 'quilt':
        F.meshes.append(tm.drape('ArmourCloth', arm, mat, -.62, .48, reach=118, grow=.020, barrel=ELE_BARREL, steps=14, rows=6, fringe=.030))
    else:
        F.meshes.append(tm.drape('ArmourCoat', arm, mat, -.60, -.08, reach=112, grow=.024, barrel=ELE_BARREL, steps=14, rows=4, fringe=.0 if kind == 'leather' else .025))
        if kind == 'plates':
            for k, y in enumerate((-.52, -.36, -.20)):
                for sx in (-1, 1):
                    F.box(f'ArmourPlate{k}{sx}', (sx * .455, y, 1.05), (.03, .13, .22), 'Metal', 'Mount_Spine')
    brow = [(0, -.995, 1.60), (0, -1.045, 1.45), (0, -1.07, 1.28)]
    if paint:  # a painted forehead: a broad patch with a pale border
        F.tube('PaintedBrowEdge', [((0, -.985 + .0, 1.62), (.18, .010), H), ((0, -1.052, 1.43), (.17, .010), H), ((0, -1.075, 1.26), (.10, .010), H)], 'Ivory', 6)
        F.tube('PaintedBrow', [((0, -.990, 1.60), (.15, .014), H), ((0, -1.058, 1.43), (.14, .014), H), ((0, -1.080, 1.28), (.08, .014), H)], paint, 6)
    else:
        F.tube('BrowPlate', [(p, (.16 - .03 * i, .014), H) for i, p in enumerate(brow)], 'Metal', 6)
        F.tube('BrowSpike', [((0, -1.03, 1.60), .025, H), ((0, -1.10, 1.70), .003, H)], 'Metal', 5)


def ele_person(name, at, dress, seated=False, kind='lance', weapon=None):
    """A LITE figure for the elephant (the mahout astride the neck, or a man standing in the howdah)."""
    rig = F.figure(name)
    F.LITE = True
    dress()
    if seated:
        F.pose({'Leg_L': (-55, -42, 0), 'Leg_R': (-55, 42, 0), 'Shin_L': (72, 0, 0), 'Shin_R': (72, 0, 0)})
    if kind == 'hand':  # a bowman: the bow held out in the left fist, the right hand drawn back to the chest
        F.reach('R', (-.010, -.170, .790), pole=(-1, .6, -.2))
        F.reach('L', (.170, -.380, .770), pole=(.8, .2, -1))
        F.bake_rest()
        F.pointing_hand('R')
        gl = F.fist('L', None, (0, 0, 1), half=.020)
        F.self_bow(gl, .80, back=(0, 1, 0), brace=.040, n=6)
    else:
        F.reach('R', (-.215, -.120, .660), pole=(-.8, .3, -1))
        F.reach('L', (.105, -.185, .640) if seated else (.150, -.200, .620), pole=(.8, .2, -1))
        F.bake_rest()
        g = F.fist('R', None, (0, 0, 1))
        F.fist('L', None, (0, 1, 0), half=.020)
        if weapon:
            weapon(g)
    F.place(at)
    return rig


def ankus(g, mat='Metal'):
    """The mahout's goad: a short staff with a hook and a point (not a Spear: kept at its length)."""
    P = 'Prop_R'
    F.tube('AnkusStaff', [((g.x, g.y, g.z - .10), .010, P), ((g.x, g.y, g.z + .34), .009, P)], 'Wood', 5, attachment=True)
    F.tube('AnkusHook', [((g.x, g.y, g.z + .33), .008, P), ((g.x, g.y - .05, g.z + .40), .007, P), ((g.x, g.y - .07, g.z + .36), .002, P)], mat, 4, attachment=True)


def dress_fn(d):
    """d: skin (bare chest), top (mat), skirt (mat, low), head ('turban', 'cap', 'headband', 'helmet'), sash."""
    def fn():
        F.legs(laces=False, straps=False, simple=d.get('simple', False))
        F.arms(long=d.get('sleeves'))
        F.head(ears=d.get('head') not in ('helmet',))
        if d.get('beard', False):
            F.beard()
        F.skirt('Skirt', d.get('skirt', 'Cloth'), low=d.get('low', .380), grow=.006, sides=8)
        F.torso('Top', d.get('top', 'Skin'), grow=.004 if d.get('top', 'Skin') != 'Skin' else 0, sides=7)
        if d.get('sash', 'Team'):
            F.band('Sash', d.get('sash', 'Team'), .515, .552, grow=.016, bone='Spine', sides=8)
        hd = d.get('head')
        if hd == 'turban':
            F.tube('Turban', [((0, .004, .925), (.090, .100), 'Head'), ((0, .004, .985), (.096, .106), 'Head'), ((0, .010, 1.040), (.072, .080), 'Head')],
                   d.get('head_mat', 'Team'), 8)
        elif hd == 'helmet':
            F.helmet(d.get('head_mat', 'Metal'), cheeks=False, neck=False, peak=1.090)
        elif hd == 'headband':
            F.headband(d.get('head_mat', 'Team'))
    return fn


def slump_keys(L, seated):
    """Killed in his place: struck, then folding forward over the howdah's wall (standing) or the neck (seated)."""
    r0 = L.rest()
    struck = L.key({'Spine': (-8, 0, 4), 'Chest': (-14, 0, 8), 'Head': (-14, 0, 0)}, (0, 0, .01), ease='out')
    if seated:
        a = L.key({'Spine': (26, 0, 6), 'Chest': (18, 0, 4), 'Head': (26, 0, 10)}, (0, 0, -.01), ease='in')
        b = L.key({'Spine': (36, 0, 10), 'Chest': (24, 0, 6), 'Head': (34, 0, 14)}, (0, -.02, -.02))
    else:
        a = L.key({'Spine': (24, 0, 8), 'Chest': (16, 0, 6), 'Head': (22, 0, 8)}, (0, 0, -.16), ease='in')
        b = L.key({'Spine': (40, 0, 12), 'Chest': (24, 0, 8), 'Head': (30, 0, 14)}, (0, -.03, -.26))
    keys = [(1, r0), (6, struck), (18, a), (27, b), (31, dict(b, ease='out')), (40, b)]
    return [(f, dict(s, space='chest')) for f, s in keys]


def trunk_pose(arm, act, f, ph):
    """The trunk's swing (world degrees: -X lifts it forward and up)."""
    if act in ('Walk', 'Trot', 'Gallop', 'Charge'):
        lift = {'Walk': 0, 'Trot': -6, 'Gallop': -12, 'Charge': -16}[act]
        g = {'Walk': 1., 'Trot': 1.8, 'Gallop': 2.6, 'Charge': 2.6}[act]  # the trunk swings wider the faster it goes
        x, z = lift + 6 * g * MC.sind(ph), 7 * g * MC.sind(ph + .25)
        if act == 'Charge':  # raised for the impact
            w = max(0., 1 - abs(f - 23) / 8)
            x -= 40 * w
    elif act == 'Idle':
        x, z = 4 * MC.sind((f - 1) / 40), 8 * MC.sind((f - 1) / 40 + .2)
        if f in (1, 41):
            x, z = 0, 0
    elif act == 'Attack':  # swung up and lashed down with the head's strike
        x = spec_at([(1, {'a': 0.}), (7, {'a': -50.}), (11, {'a': 10., 'ease': 'in'}), (12, {'a': 12.}), (16, {'a': -6.}), (21, {'a': 0.})], f)['a']
        z = 0
    elif act == 'Cheer':  # raised high: the trumpet
        x = spec_at([(1, {'a': -20.}), (9, {'a': -75.}), (17, {'a': -20.}), (25, {'a': -75.}), (33, {'a': -20.})], f)['a']
        z = 0
    elif act == 'Hit':
        x = spec_at([(1, {'a': 0.}), (4, {'a': -30., 'ease': 'out'}), (10, {'a': 0.})], f)['a']
        z = 0
    else:  # the falls: it curls under, then lies limp
        x = spec_at([(1, {'a': 0.}), (6, {'a': -30., 'ease': 'out'}), (20, {'a': 10.}), (40, {'a': 22.})], f)['a']
        z = spec_at([(1, {'a': 0.}), (40, {'a': 18.})], f)['a']
    if abs(x) > 1e-6 or abs(z) > 1e-6:
        u.rotate_world(arm, 'Mount_Trunk', (x, 0, z))
        upd()


def author_elephant(ele, mahout, crew, crew_kinds, mahout_kind='sword'):
    """The mounted clip set for an elephant, its mahout and the two men in the howdah (one action per rig per
    clip): the elephant on the amble and its kneeling falls (beast_gaits 'elephant'), the trunk on its own
    bone; the mahout carried by the neck, the crew by the back; all three ride, strike, flinch and cheer with
    the base riders' library, and are killed where they are (slumped over the neck or the howdah's wall)."""
    horse = MC.Horse(ele, [m for m in F.meshes if m.parent == ele])
    unit = MC.Unit('mounted')
    acts = unit.acts
    ACTS = MC.ACTS
    hspec = {}
    for act in acts:
        if act in MC.GAITS_OF:
            hspec[act] = MC.horse_gait(horse, MC.GAITS_OF[act], ACTS[act][0])
        else:
            keys = MC.horse_keys(act, -1 if act != 'DeathAlt' else 1)
            hspec[act] = (lambda keys: (lambda f: spec_at(keys, f)))(keys)
    state = {}
    W = ele.matrix_world

    def pose_ele(act, f):
        s = None if (act == 'Idle' and f in (1, ACTS[act][0])) else hspec[act](f)
        horse.pose(s)
        trunk_pose(ele, act, f, (s or {}).get('phase', ((f - 1) % 20) / 20))
        state['spine'] = W @ horse.D @ W.inverted()
        state['neck'] = W @ horse.neck_delta() @ W.inverted()
    unit.add(ele, pose_ele)
    people = []
    for arm, kind, seated in [(mahout, mahout_kind, True)] + [(c, k, False) for c, k in zip(crew, crew_kinds)]:
        kit = FC.Kit('spear' if kind == 'lance' else 'sword', side='R')
        per = MC.Person(arm, kit, axes={'R': 'point'} if kind == 'hand' else None, weapon=kind != 'hand')
        L = (MC.RiderLib if seated else MC.CrewLib)(per.P, kit, kind)
        L.side_x = .1
        clips = MC.rider_clips(L, acts, hspec)
        for a in ('Death', 'DeathAlt'):
            frames, loop, events = ACTS[a]
            clips[a] = Clip(a, frames, loop, None, keys=slump_keys(L, seated), events=events)
        M = arm.matrix_world.copy()
        key = 'neck' if seated else 'spine'

        def pose(act, f, per=per, clips=clips, M=M, key=key):
            clip = clips[act]
            spec = clip.fn(f) if clip.fn else spec_at(clip.keys, f)
            per.pose(clip, spec, f, M.inverted() @ state[key] @ M)
        unit.add(arm, pose, lambda act, per=per, clips=clips: per.begin(clips[act]))
        people.append(per)
    bpy.context.scene.render.fps = FPS
    table = unit.run()
    for per in people:
        print('REACH', per.arm.name, json.dumps(sorted(((round(e, 4), c, s) for (c, s), e in per.A.reach.items()), reverse=True)[:4]), flush=True)
    MC.set_clip('Idle', 1)
    return table, unit.acts


def elephant_unit(model, r):
    start(r['colors'])
    ele = fine_elephant(tusks=r.get('tusks', 1.0))
    armour(ele, r['armour'], r.get('armour_mat', 'Hide'), paint=r.get('paint'))
    howdah(ele, wall=r.get('wall', 'Wood'), cloth=r.get('cloth', 'Saddle'), trim=r.get('trim'), wicker=r.get('wicker', False))
    if r.get('banner'):
        S = 'Mount_Spine'
        F.use(ele)
        y = HOWDAH['y'] + HOWDAH['d'] / 2
        F.tube('BannerPole', [((.30, y, HOWDAH['floor']), .013, S), ((.30, y, HOWDAH['floor'] + 1.05), .010, S)], 'Wood', 5)
        F.tube('BannerFinial', [((.30, y, HOWDAH['floor'] + 1.05), .022, S), ((.30, y, HOWDAH['floor'] + 1.12), .002, S)], 'Gold', 5)
        F.slab('Banner', [(.30, y + .01, HOWDAH['floor'] + 1.00), (.30, y + .30, HOWDAH['floor'] + .97), (.30, y + .30, HOWDAH['floor'] + .66),
                          (.30, y + .01, HOWDAH['floor'] + .70)], 'Team', S, depth=.008)
    md = r['mahout']
    mahout = ele_person('Mahout', (0, -.58, 1.69 - .422), dress_fn(md), seated=True, kind='sword', weapon=ankus)
    crew = []
    for i, (kind, d) in enumerate(r['crew']):
        d = dict(d, simple=True)  # the legs behind the howdah's walls
        x = (-.15, .15)[i]
        crew.append(ele_person(f'Crew{i}', (x, HOWDAH['y'] + (.06 if i else -.06), HOWDAH['floor'] + .005), dress_fn(d), kind=kind,
                               weapon=(lambda g: SM.lance(g, top=1.50)) if kind == 'lance' else None))
    parts = [ele, mahout] + crew
    notes = {'name': r['name'], 'role': 'cavalry: ' + r['look'], 'signature': True, 'rig': 'elephant',
             'recipe': 'build_signature_special.elephant_unit (2026-10-20)',
             'notes': 'Quality pass of the war elephants: a fine elephant with a trunk bone, a howdah, a mahout and two crew (ti_figure LITE), the mounted clips authored here (an amble at every speed, a kneeling fall).'}
    drop = ELE_BARREL[3][1] - ELE_BARREL[3][2] - .05
    with beast_gaits('elephant', drop=drop):
        tris = F.finish_unit(model, parts, notes, centre=(0, -.2, 1.2), scale=3.8, mode='NLA_TRACKS',
                             clips=MC.hook(model, lambda: author_elephant(ele, mahout, crew, [k for k, _ in r['crew']]), 'mounted',
                                           {'ortho': 4.2, 'aim': (0, -.2, 1.1)}))
    print('TRIS', model, tris, flush=True)
    assert tris <= BUDGET, (model, tris)
    return tris


INDIC = {'Skin': 'A06A48', 'Hair': '1A1410', 'Coat': '6E6A66', 'Mane': '3A3632', 'Ivory': 'E8DFC8', 'Cloth': 'EFE6D0', 'Wood': '6A4A30', 'Leather': '5A3A26',
         'Rope': 'A08A64', 'Gold': GOLD, 'Boot': '4A2F20'}
ELEPHANTS = {
    'magadha': dict(name='Magadhan war elephants', armour='plates', armour_mat='Bronze', cloth='Saddle', trim='Gold',
                    colors=dict(INDIC, Bronze=BRONZE, Metal=BRONZE, Saddle='8A2E28'),
                    mahout=dict(top='Skin', skirt='Cloth', head='turban', head_mat='Cloth', sash='Team'),
                    crew=[('hand', dict(top='Cloth', skirt='Cloth', head='turban', head_mat='Team', sash='Leather')),
                          ('hand', dict(top='Cloth', skirt='Cloth', head='turban', head_mat='Team', sash='Leather'))],
                    look='a grey elephant in bronze armour (a coat over the shoulders with plates, a brow plate and spike) under a red howdah cloth with a gold edge; a turbaned mahout with a goad on the neck, two archers in Team turbans in the howdah'),
    'kalinga': dict(name='Kalingan elephant corps', armour='leather', armour_mat='Hide', paint='Paint', cloth='Saddle', trim='Ivory',
                    colors=dict(INDIC, Skin='8A573A', Hide='7A5A3A', Paint='B8402A', Metal=IRON, Saddle='2E4A3A'),
                    mahout=dict(top='Skin', skirt='Cloth', head='headband', head_mat='Team'),
                    crew=[('lance', dict(top='Hide', skirt='Cloth', head='turban', head_mat='Cloth', sash='Team')),
                          ('lance', dict(top='Hide', skirt='Cloth', head='turban', head_mat='Cloth', sash='Team'))],
                    look='a grey elephant in a hide coat with a painted red forehead under a green howdah cloth; a mahout with a Team headband and a goad, two spearmen in leather jerkins with Team sashes in the howdah'),
    'kamarupa': dict(name='Kamarupan war elephants', armour='quilt', armour_mat='Quilt', cloth='Saddle', wall='Wicker', wicker=True, tusks=.7,
                     colors=dict(INDIC, Skin='8A573A', Coat='5E5A56', Quilt='C9A66B', Wicker='B8964E', Metal=IRON, Saddle='6A3A5A'),
                     mahout=dict(top='Skin', skirt='Cloth', head='headband', head_mat='Team'),
                     crew=[('hand', dict(top='Skin', skirt='Cloth', head='headband', head_mat='Team', sash='Leather')),
                           ('hand', dict(top='Skin', skirt='Cloth', head='headband', head_mat='Team', sash='Leather'))],
                     look='a dark forest elephant with short tusks under a quilted ochre cloth to the knees, a wicker howdah; a mahout with a goad, two bare-chested archers with Team headbands'),
    'champa': dict(name='Cham elephant lancers', armour='plates', armour_mat='Iron', cloth='Saddle', trim='Gold', banner=True,
                   colors=dict(INDIC, Skin='8A573A', Iron=IRON, Metal=IRON, Saddle='7A1E2A'),
                   mahout=dict(top='Skin', skirt='Cloth', head='headband', head_mat='Team'),
                   crew=[('lance', dict(top='Team', skirt='Cloth', head='helmet', head_mat='Metal', sash='Leather')),
                         ('lance', dict(top='Team', skirt='Cloth', head='helmet', head_mat='Metal', sash='Leather'))],
                   look='a grey elephant in iron armour with a brow plate under a crimson howdah cloth, a Team tower banner on the howdah; a mahout with a goad, two lancers in Team tunics and iron helmets'),
}


# ---- recipes -------------------------------------------------------------------------------------------------
CAMELS = {
    'saba': dict(name='Sabaean camel archers', role='Camel archers',
                 colors={'Coat': 'C9A06A', 'Mane': '6A4A30', 'Pad': '5A4636', 'Skin': 'A8724E', 'Hair': '1E1712', 'Cloth': 'E8DEC6', 'Saddle': '8A2E28',
                         'Trim': 'D8C99A', 'Wood': '6A4A30', 'Leather': '8A6040', 'Rope': 'B89E74', 'Metal': BRONZE, 'Gold': BRONZE},
                 saddle=dict(cloth='Saddle', fringe='Trim', cushion='Cloth'),
                 legs='bare', hair='full', beard=True, dress=dict(skirt='Cloth', skirt_low=.430, top='Skin', sash='Team', belt='Leather'),
                 head=('headband', {'mat': 'Team'}), weapon=('bow', {}), pre=[lambda: SM.hip_quiver('Leather')],
                 look='a tawny dromedary under a red saddle cloth with a pale fringe on the North Arabian saddle; a bare-chested archer with long curled hair, a loincloth with a Team sash and a Team headband, a quiver at the hip, a short curved bow'),
    'qedar': dict(name='Qedarite camel raiders', role='Camel raiders',
                  colors={'Coat': 'A87A4A', 'Mane': '4A3220', 'Pad': '4A3A2C', 'Skin': 'A8724E', 'Hair': '1A1410', 'Cloth': 'E2D6BC', 'Goat': '2E2622',
                          'Saddle': '3A2E26', 'Trim': 'B8763A', 'Wood': '4A3626', 'Leather': '7A5236', 'Rope': 'A08A64', 'Metal': IRON, 'Iron': IRON},
                  saddle=dict(cloth='Saddle', fringe='Trim', cushion='Goat', bags='Leather'),
                  legs='bare', hair='nape', beard=True, dress=dict(skirt='Cloth', skirt_low=.410, top='Team', belt='Leather', cloak='Goat'),
                  head=('headcloth', {'band': 'Leather', 'cloth': 'Cloth'}), weapon=('lance', {'top': 1.50}),
                  pre=[lambda: SM.gorytos('Leather', 'Trim')],
                  look='a brown dromedary under a black goat-hair cloth with an ochre fringe, saddle bags; a Team tunic under a dark goat-hair cloak, a white headcloth, a spear, a bow case at the hip'),
    'kindah': dict(name='Arab Revolt camel riflemen', role='Camel riflemen',
                   colors={'Coat': 'D2B080', 'Mane': '7A5A3A', 'Pad': '5A4636', 'Skin': 'A8724E', 'Hair': '1A1410', 'Cloth': 'E8E0CC', 'Robe': 'EFE8DA',
                           'Saddle': '2A3A6A', 'Trim': 'C8302A', 'Wood': '5A3E28', 'Leather': '6A4A30', 'Rope': 'B89E74', 'Metal': IRON, 'Iron': IRON, 'Agal': '1A1714'},
                   saddle=dict(cloth='Saddle', fringe='Trim', cushion='Cloth', bags='Leather'),
                   legs='bare', hair='nape', beard=True, sleeves='Robe',
                   dress=dict(skirt='Robe', skirt_low=.360, top='Team', belt='Leather', cloak='Cloth'),
                   head=('headcloth', {'band': 'Agal', 'cloth': 'Cloth'}), weapon=('rifle', {}),
                   pre=[lambda: bandolier('Leather', 'Metal')],
                   look='a pale dromedary under an indigo saddle cloth with a red fringe, saddle bags; a white headcloth held by a black cord, a Team robe under a light cloak, a bandolier, a Lee-Enfield held upright'),
}


def bandolier(mat='Leather', brass='Metal'):
    """A cartridge belt over the left shoulder to the right hip (Chest and Spine)."""
    pts = [(.110, -.030, .790), (.060, -.085, .720), (-.010, -.095, .640), (-.090, -.070, .560), (-.120, -.020, .520)]
    F.tube('Bandolier', [(p, (.010, .020), 'Chest' if p[2] > .64 else 'Spine') for p in pts], mat, 4, caps=(False, False))
    for k, p in enumerate(pts[1:4]):
        F.box(f'Cartridge{k}', (p[0], p[1] - .012, p[2]), (.022, .010, .026), brass, 'Chest' if p[2] > .64 else 'Spine')


# ---- shipping -------------------------------------------------------------------------------------------------

def ship_json(model, extra=None):
    """Merge the build's clips (art-build/.../<model>.json) into the shipped options file, keeping its keys."""
    built = json.loads((u.REPO / 'art-build' / 'units' / 'signature' / model / f'{model}.json').read_text())
    p = SIG / f'{model}.json'
    o = json.loads(p.read_text()) if p.exists() else {'enabled': True, 'tags': TAGS}
    o['clips'] = built['clips']
    o['restClip'] = '^Idle$'
    for k in ('footprint',):
        if k in built:
            o[k] = built[k]
    o.update(extra or {})
    p.write_text(json.dumps(o, indent=2) + '\n')


def build(model):
    if model in CAMELS:
        t = camel_mounted(model, CAMELS[model])
        return t, {'quadruped': True, 'triangleBudget': BUDGET}
    if model in ELEPHANTS:
        return elephant_unit(model, ELEPHANTS[model]), {'quadruped': True, 'triangleBudget': BUDGET}
    if model == 'khoekhoe':
        return ox_mounted(model, KHOEKHOE), {'quadruped': True, 'triangleBudget': BUDGET}
    if model == 'kitara':
        return kitara_unit(model), {'quadruped': True, 'triangleBudget': BUDGET}
    if model in TANKS:
        return tank_unit(model), {'quadruped': False, 'triangleBudget': BUDGET}
    if model in FRAMES:
        return frame_unit(model), {'quadruped': False, 'triangleBudget': BUDGET}
    raise KeyError(model)


TANKS = ('kingdom-of-israel', 'marcomannia')
FRAMES = ('bosporan-kingdom', 'tondo')
ALL = list(CAMELS) + list(ELEPHANTS) + ['khoekhoe', 'kitara'] + list(TANKS) + list(FRAMES)


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    models = argv or ALL
    done, failed = {}, {}
    for m in models:
        try:
            t, extra = build(m)
            done[m] = t
            if os.environ.get('TI_SHIP'):
                ship_json(m, extra)
        except Exception as e:  # keep building the rest; the summary lists it
            import traceback
            traceback.print_exc()
            failed[m] = repr(e)
    print('SUMMARY', done, 'FAILED', failed, flush=True)
    sys.stdout.flush()
    os._exit(1 if failed else 0)


main()
