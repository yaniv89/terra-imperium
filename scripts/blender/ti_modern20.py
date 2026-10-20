# scripts/blender/ti_modern20.py
# The 20th-century Modern dress and kit (eight-ages plan U81), shared by build_modern20_*.py on ti_figure.py.
# Generic, of no real army: no insignia, no national helmet shape, no named weapon. What tells it from the
# present day (information-*) at 20 px: a round olive steel helmet, an olive wool tunic with pockets
# instead of a plate carrier, Team webbing braces, canvas gaiters, a long bolt-action rifle.
import ti_figure as F

COLORS = {'Skin': 'C99472', 'Hair': '3A2A1E', 'Uniform': '5B5A3A', 'Wool': '66603F', 'Gaiter': 'A49A72', 'Boot': '2C2520',
          'Helmet': '4E5236', 'Leather': '3A2C20', 'Metal': ('6E7174', .4, .7), 'Wood': '6A4A30', 'Canvas': '8A8260',
          'Gun': '2E2F30', 'Glass': '1E2228'}


def steel_helmet(name='Helmet', mat='Helmet', band='Team', strap='Leather'):
    """A round steel helmet with a narrow flared rim, a Team band round the crown and the chin straps."""
    F.lathe(name, [(0, 1.060), (.040, 1.054), (.066, 1.032), (.080, 1.000), (.085, .968), (.088, .950), (.100, .938), (.101, .932), (.084, .934), (0, .940)],
            mat, sides=12)
    if band:
        F.tube(name + 'Band', F.vertical([.958, .984], -.003, [(.0870, .0900), (.0830, .0860)], 'Head'), band, 12, caps=(False, False))
    if strap:
        for s in (-1, 1):
            F.box(f'{name}Strap_{s}', (s * .060, -.016, .896), (.008, .010, .060), strap, 'Head')


def field_cap(name='Cap', mat='Wool', band='Team'):
    """A soft peaked field cap (an officer's or a crewman's), a Team band."""
    F.lathe(name, [(0, 1.020), (.050, 1.016), (.074, 1.000), (.078, .972), (.074, .952), (0, .952)], mat, sides=12, sy=1.04)
    F.tube(name + 'Band', F.vertical([.952, .972], -.002, [(.0790, .0800), (.0760, .0770)], 'Head'), band, 12, caps=(False, False))
    F.box(name + 'Peak', (0, -.084, .954), (.090, .040, .008), 'Leather', 'Head')


def soldier(helmet=True, webbing=True, pockets=True, gaiters=True, tunic='Wool', trousers='Uniform', pouches=2):
    """An olive drab soldier on the current rig: tunic to the hips, trousers into canvas gaiters, boots;
    Team webbing (belt, braces, ammunition pouches) and the steel helmet. Pose the arms, bake_rest(),
    then the fists and what they hold."""
    F.legs(boots='Boot', hose=trousers)
    if gaiters:
        F.gaiters('Gaiter', top=.200)
    F.arms(long=tunic, pad=.006)
    F.head()
    F.hair(crown=False)
    F.skirt('TunicSkirt', tunic, low=.440, grow=.012, sides=10, flare=.006)
    F.torso('Tunic', tunic, grow=.008, chest=.006, sides=10)
    if pockets:
        for s in (-1, 1):
            F.box(f'ChestPocket_{s}', (s * .052, -.112, .690), (.044, .010, .044), tunic, 'Chest')
            F.box(f'SkirtPocket_{s}', (s * .066, -.112, .480), (.052, .010, .052), tunic, 'Spine')
    if webbing:
        F.band('Belt', 'Team', .520, .548, grow=.020, bone='Spine')
        F.cross_belts('Brace', 'Team', plate=None, low=.530, high=.800, width=.020, grow=.016)
        for s in (-1, 1):
            for k in range(pouches):
                F.box(f'Pouch_{s}{k}', (s * (.040 + .040 * k), -.120, .520), (.036, .022, .040), 'Team', 'Spine')
    if helmet:
        steel_helmet()


def bolt_rifle(grip, bayonet=.200, name='Rifle'):
    """A bolt-action rifle upright at the order through the fist at `grip` (ti_figure.musket's stock
    and barrel), the bolt handle on its right and the magazine under the receiver."""
    top = F.musket(grip, length=.900, bayonet=bayonet, wood='Wood', metal='Metal', lock='Metal', name=name)
    F.box(name + 'Bolt', (grip.x - .016, grip.y - .004, .312), (.018, .008, .008), 'Metal', 'Prop_R', True)
    F.box(name + 'Mag', (grip.x, grip.y - .020, .342), (.012, .016, .030), 'Metal', 'Prop_R', True)
    return top
