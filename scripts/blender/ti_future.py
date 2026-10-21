# scripts/blender/ti_future.py
# The Future age's shared kit (eight-ages plan U83) for build_future_*.py: a plausible near-future look, not
# cartoon sci-fi. People wear powered exo-suits on ti_figure.py (graphite armour plates over a dark undersuit,
# thin cyan glowing seams, a closed helmet with a visor band); vehicles float on hover pads (no wheels or
# tracks) and carry the hover clips here (archetype K): Idle (a slow float), Move (a glide, nose down a little),
# Fire (recoil and a rock), Hit, Death (the crews) and Wreck (the field fails: it drops to the ground with a list).
import math

import ti_figure as F
import ti_units as u
import ti_vehicle_clips as VC

COLORS = {'Skin': 'C99472', 'Hair': '2E241C', 'Armor': '3A3E44', 'Under': '1E2024', 'Plate': '5A6068', 'Glow': '4FE0F0', 'Visor': '15303A',
          'Gun': '2A2C30', 'Metal': ('8A9096', .35, .75), 'Glove': '24262A', 'Boot': '26282C', 'Sole': '141516', 'Gear': '2A2C30',
          'Cloth': '4A5058', 'Leather': '1E2024', 'Wood': '4A4038'}
HOVER = .20  # a hover hull's underside above the ground


def exo_suit(helmet=True, pack=True, heavy=False):
    """A powered exo-suit on the current rig: a dark undersuit, graphite plates on the shins, thighs, forearms and
    shoulders, a Team chest plate (Spine and Chest: the battle dyes it) with a glowing seam, a power pack on the
    back, a closed helmet with a visor band. Pose the arms, bake_rest(), then the fists (gloves)."""
    g = .010 if heavy else 0
    F.legs(boots='Boot', hose='Under')
    F.combat_boots('Boot', top=.200)
    F.arms(long='Under', pad=.008 + g)
    F.head(ears=False)
    F.torso('Undersuit', 'Under', grow=.006, chest=.004)
    F.torso('ChestPlate', 'Team', grow=.020 + g, chest=.016 + g, sides=10)
    F.band('Seam', 'Glow', .640, .650, grow=.030 + g, bone='Chest', sides=10)
    F.band('Belt', 'Armor', .510, .540, grow=.020 + g, bone='Spine', sides=10)
    F.skirt('Tassets', 'Armor', low=.430, grow=.016 + g, sides=8, flare=.010)
    for side, s in (('L', 1), ('R', -1)):
        F.box('ShinPlate_' + side, (s * .074, -.040, .170), (.060, .020, .110), 'Armor', 'Shin_' + side)
        F.box('ThighPlate_' + side, (s * .078, -.052, .350), (.070, .022, .100), 'Armor', 'Leg_' + side)
        F.box('ThighSeam_' + side, (s * .078, -.064, .350), (.008, .004, .080), 'Glow', 'Leg_' + side)
        F.box('Shoulder_' + side, (s * .150, -.004, .770), (.080 + g, .110 + g, .050), 'Plate', 'Arm_' + side)
    if pack:
        F.box('PowerPack', (0, .110, .650), (.160 + g, .060, .180), 'Armor', 'Chest')
        F.box('PackGlow', (0, .142, .650), (.100, .006, .012), 'Glow', 'Chest')
    if helmet:
        F.combat_helmet('Helmet', 'Plate', band='Glow', nvg=None, strap=None)
        F.box('Visor', (0, -.078, .915), (.110, .020, .036), 'Visor', 'Head')
        F.box('Faceplate', (0, -.070, .868), (.080, .024, .050), 'Armor', 'Head')


def hover_pad(prefix, rig, x, y, r=.12, z=HOVER):
    """A hover pad under the hull: a flat disc with a glowing ring under it."""
    u.tube(f'{prefix}Pad', [(x, y, z), (x, y, z + .05)], [r, r * .9], 'Armor', ['Hull'] * 2, 10, rig)
    u.tube(f'{prefix}PadGlow', [(x, y, z - .012), (x, y, z)], [r * .8, r * .8], 'Glow', ['Hull'] * 2, 10, rig)


def hover_hull(prefix, rig, length=1.8, width=.92, height=.30, pods=True, deck=True, nose=.30, team=True):
    """A hover hull facing -Y on the Hull bone: a lower hull chamfered at the nose and the tail, a narrower upper
    deck (a stepped silhouette), three armour panels a side (the middle one in Team) with a glowing seam under
    them, an engine block at the back with two glowing vents, a dark sensor bar across the nose, and four hover
    pods on short pylons at the corners, a little outside the hull, glowing underneath. Returns the deck top."""
    import ti_mounts as tm
    hl, hw, z0 = length / 2, width / 2, HOVER
    z1 = z0 + height
    tm.side_profile(f'{prefix}Lower', [(-hl, z0 + height * .45), (-hl + nose, z0), (hl - .12, z0), (hl, z0 + height * .35), (hl, z1), (-hl + nose * .8, z1)],
                    -hw, hw, 'Armor', 'Hull', rig)
    top = z1
    if deck:
        top = z1 + height * .30
        tm.side_profile(f'{prefix}Deck', [(-hl + nose * .9, z1 - .01), (hl - .06, z1 - .01), (hl - .10, top), (-hl + nose * 1.4, top)],
                        -hw + .07, hw - .07, 'Plate', 'Hull', rig)
    span = 2 * hl - nose - .20
    for sx in (-1, 1):
        for k in range(3):
            y = -hl + nose + .08 + span * (k + .5) / 3
            mat = 'Team' if (k == 1 and team) else 'Plate'
            u.box(f'{prefix}Panel{sx}{k}', (sx * (hw + .008), y, z0 + height * .60), (.016, span / 3 - .04, height * .55), mat, 'Hull', rig)
        u.box(f'{prefix}Seam{sx}', (sx * (hw + .006), (nose - .2) / 2, z0 + height * .22), (.008, span, .014), 'Glow', 'Hull', rig)
    u.box(f'{prefix}Engine', (0, hl - .14, top + .05), (width * .55, .22, .10), 'Armor', 'Hull', rig)
    for sx in (-1, 1):
        u.box(f'{prefix}Vent{sx}', (sx * width * .14, hl - .02, top + .05), (width * .16, .012, .05), 'Glow', 'Hull', rig)
    u.box(f'{prefix}Sensor', (0, -hl + nose * .55, z0 + height * .78), (width * .70, .02, .04), 'Visor', 'Hull', rig)
    if pods:
        for sx in (-1, 1):
            for sy in (-1, 1):
                x, y = sx * (hw + .02), sy * (hl - .26)
                u.box(f'{prefix}Pylon{sx}{sy}', (x - sx * .05, y, z0 + .06), (.10, .08, .05), 'Armor', 'Hull', rig)
                u.tube(f'{prefix}Pod{sx}{sy}', [(x, y, z0 - .03), (x, y, z0 + .09)], [.10, .085], 'Plate', ['Hull'] * 2, 10, rig)
                u.tube(f'{prefix}PodGlow{sx}{sy}', [(x, y, z0 - .045), (x, y, z0 - .03)], [.075, .075], 'Glow', ['Hull'] * 2, 10, rig)
    return top


def hover_clips(uid, parts, crews=(), fire=None, bore=None, wreck_drop=HOVER - .02):
    """The hover clips for a rig with Hull (and optional Turret and Barrel): `crews` [(arm, fire_keys or None,
    death)] stand on it; `fire` the hull's Fire keys (default: a recoil of the barrel along `bore`)."""
    rig = parts[0]
    v = VC.Vehicle(rig, [], bore=bore)
    T = 40
    table = VC.acts(30, 8, T + 1, crew=bool(crews))
    float_ = {'Idle': lambda f: None if f in (1, 41) else {'bob': .012 * math.sin(2 * math.pi * (f - 1) / 40), 'pitch': .4 * math.sin(2 * math.pi * (f - 1) / 40 + 1.0)},
              'Move': lambda f: {'bob': .008 * math.sin(2 * math.pi * 2 * (f - 1) / T), 'pitch': 1.6 + .4 * math.sin(2 * math.pi * (f - 1) / T),
                                 'roll': .6 * math.sin(2 * math.pi * (f - 1) / T)},
              'Fire': VC.keyed(fire or VC.recoil_keys(8, .10, 30, rock=1.0)), 'Hit': VC.keyed(VC.HIT),
              'Wreck': VC.keyed([(1, {}), (4, {'bob': .02, 'pitch': -2, 'ease': 'out'}), (12, {'bob': -wreck_drop, 'pitch': 2.5, 'roll': 4, 'ease': 'in'}),
                                 (16, {'bob': -wreck_drop * .85, 'pitch': 2, 'roll': 3.4, 'ease': 'out'}), (22, {'bob': -wreck_drop, 'pitch': 2.5, 'roll': 4}),
                                 (40, {'bob': -wreck_drop, 'pitch': 2.5, 'roll': 4})])}
    if crews:
        float_['Death'] = lambda f: {}
    cl = []
    for arm, fkeys, death in crews:
        per = VC.crew_person(arm)
        clips = VC.standing_crew(per, table, fire=fkeys, death=death)
        cl.append((per, clips, True, None))
    return VC.run(uid, parts, table, v, float_, cl, 'vehicle')
