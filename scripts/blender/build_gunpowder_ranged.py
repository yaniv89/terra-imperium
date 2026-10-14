# scripts/blender/build_gunpowder_ranged.py
# Gunpowder ranged (riflemen, about 1750), quality pass of 2026-10-14 on the shared parts of
# ti_figure.py; replaces g_ranged of build_units_gunpowder.py:
#   blender -b --factory-startup -P scripts/blender/build_gunpowder_ranged.py
# Same contract as that builder: the canonical rig (UnitRig) under a root empty named after the unit,
# flat material colours, the Team and Skin tags, the old names of the rifle (RifleStock, RifleBarrel),
# and since 2026-10-14 authored clips (ti_foot_clips.py; Idle frame 1 is the rest pose, unchanged). He must not be taken for the line infantryman
# (build_gunpowder_infantry.py: tricorne, long coat, white cross belts, musket and bayonet on the
# right), so he is a light skirmisher. The look follows plans/art/concepts/oct13/units-gunpowder-set.png
# (design reference only):
#   - a round felt hat with a broad brim hooked up on the left, a Team band and a dark feather
#   - a short Team jacket with brass buttons and short tails (Spine), plain sleeves, a leather belt
#     with a bullet pouch, brown trousers to the ankle, short boots
#   - a leather strap from the right shoulder to a cream powder horn at the left hip
#   - a short rifle without a bayonet held upright in the LEFT fist, butt off the ground; the right arm
#     hangs at the side
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/gunpowder-ranged/; copy the GLB to src/assets/units/gunpowder-ranged.glb.
import sys
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'gunpowder-ranged'
arm = F.start({'Skin': 'C99472', 'Hair': '3A2A1E', 'Felt': '2E2924', 'Sleeve': '5A5446', 'Trews': '7A6A4E', 'Leather': '553623', 'Horn': 'E6D9B8',
               'Feather': '23302A', 'Iron': ('4E4F52', .45, .7), 'Blanket': '8C8676', 'Metal': ('8F9399', .4, .8), 'Brass': ('C9A04E', .4, .7), 'Wood': '5A3E28'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Leather', hose='Trews')
F.arms(long='Sleeve', pad=.003)
F.head()
F.hair(crown=False)
box('Moustache', (0, -.061, .884), (.046, .011, .009), 'Hair', 'Head')

# ---- the jacket, belt, pouch, strap and horn ----------------------------------------------------------------
F.torso('Jacket', 'Team', grow=.008, chest=.008, sides=10)
F.coat_skirts('JacketTail', 'Team', 'Sleeve', low=.462, grow=.014, flare=.010, open_deg=42, cols=10)
for k, z in enumerate((.585, .640, .700, .750)):
    ry = F.radius_at(z, F.TORSO)[1] + .008 + (.008 if .68 < z < .75 else 0)
    box(f'Button{k}', (0, -ry - .003, z), (.013, .008, .013), 'Brass', 'Spine' if z < .66 else 'Chest')
F.band('Belt', 'Leather', .528, .552, grow=.018, bone='Spine', bulge=.002)
box('Pouch', (-.090, -.086, .505), (.070, .034, .060), 'Leather', 'Hips')
F.cross_belts('HornCord', 'Leather', plate=None, width=.016, grow=.016, which='R')
tube('PowderHorn', [((.104, -.070, .545), .012, 'Hips'), ((.128, -.060, .500), .024, 'Hips'), ((.132, -.040, .452), .021, 'Hips'),
                    ((.118, -.018, .418), .010, 'Hips')], 'Horn', 6)
tube('HornTip', [((.118, -.018, .420), .010, 'Hips'), ((.110, -.012, .404), .005, 'Hips')], 'Wood', 5)

# ---- a knapsack with a rolled blanket on top (Prop_Back) ------------------------------------------------------
box('Knapsack', (0, .118, .640), (.150, .060, .160), 'Leather', 'Prop_Back', True)
tube('BlanketRoll', [((-.096, .118, .742), .034, 'Prop_Back'), ((.096, .118, .742), .034, 'Prop_Back')], 'Blanket', 7, attachment=True)

# ---- the round hat --------------------------------------------------------------------------------------
F.round_hat('RoundHat', 'Felt', 'Team', brim=.130, crown=1.030, up=.056)
F.ridge('HatPlume', [(-.006, .996, 1.010), (.018, 1.004, 1.068), (.040, 1.000, 1.100)], 'Feather', half=(.007, .012))
for o in F.meshes[-1:]:
    for v in o.data.vertices:
        v.co.x += .060

# ---- the right arm hangs at the side: posed, then made the rest pose ------------------------------------------
F.reach('R', (-.196, -.030, .505), pole=(-.3, 1, .1))
F.bake_rest()
F.fist('L', None, (0, 0, 1))
F.fist('R', None, (0, 1, 0), half=.020)

# ---- the rifle (the left hand's attachment), upright, held off the ground ---------------------------------------
g = F.grip_point('L')
F.musket(Vector((g.x, g.y, g.z)), butt=.200, length=.820, bayonet=0, prop='Prop_L', name='Rifle', metal='Iron', lock='Brass')

F.finish_rest(UID, 'Riflemen: a round felt hat hooked up on the left with a Team band and a dark feather, a short Team jacket with brass buttons, a leather belt and '
              'bullet pouch, a strap to a powder horn at the hip, brown trousers and short boots, a short rifle upright in the left hand',
              notes={'role': 'ranged'},
              clips=FC.clips_hook(UID, FC.Kit('gun', side='L')))
