# scripts/blender/build_modern20_mercenary.py
# The 20th-century Modern mercenary (eight-ages plan U81; drawn for mercenary squads of the infantry class), a
# hired soldier of fortune on the shared parts of ti_figure.py, with authored clips (ti_foot_clips.py):
#   blender -b --factory-startup -P scripts/blender/build_modern20_mercenary.py
# He must not be taken for the rifleman (build_modern20_infantry.py: steel helmet, wool tunic, long rifle), so:
#   - a wide slouch hat with one side pinned up and a Team band, a moustache, stubble
#   - a khaki shirt with the sleeves rolled to the elbow, a Team bandolier from the left shoulder, a
#     webbing belt with a holster, khaki breeches, puttees and ankle boots
#   - a submachine gun with a drum magazine upright in the right fist; the left thumb in the belt
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Of no real army. Outputs go to art-build/units/modern-mercenary/; copy the GLB to src/assets/units/.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_figure as F  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'modern-mercenary'
arm = F.start({'Skin': 'B9805C', 'Hair': '2B201A', 'Shirt': 'B8A47A', 'Khaki': '8A7A56', 'Gaiter': '6A5E44', 'Boot': '4A3626', 'Hat': '6E5E44',
               'Gear': '4A3C2A', 'Gun': '27282A', 'Metal': ('5A5D60', .4, .7), 'Wood': '6A4A30'}, ready=True)
tube, box, vertical = F.tube, F.box, F.vertical

# ---- body ----------------------------------------------------------------------------------------
F.legs(boots='Boot', hose='Khaki')
F.gaiters('Gaiter', top=.200)
F.arms(sleeve='Shirt')
F.head()
F.beard()
F.hair(crown=False)
F.skirt('ShirtTail', 'Shirt', low=.470, grow=.010, sides=10, flare=.004)
F.torso('Shirt', 'Shirt', grow=.008, chest=.004)
for s in ('L', 'R'):  # the sleeves rolled to the elbow
    e = arm.data.bones['Forearm_' + s].head_local
    tube('Roll_' + s, [((e.x, e.y, e.z + .030), .040, 'Arm_' + s), ((e.x, e.y, e.z - .004), .040, 'Arm_' + s)], 'Shirt', 6)

# ---- bandolier, belt, holster -------------------------------------------------------------------------
F.cross_belts('Bandolier', 'Team', plate=None, low=.520, high=.800, width=.030, grow=.016, which='L')
F.band('Belt', 'Gear', .520, .548, grow=.016, bone='Spine')
box('Holster', (-.112, -.020, .470), (.030, .060, .090), 'Gear', 'Spine')

# ---- the slouch hat --------------------------------------------------------------------------------------
F.lathe('Hat', [(0, 1.050), (.050, 1.046), (.072, 1.020), (.078, .980), (.080, .962), (.150, .950), (.152, .940), (.078, .946), (0, .950)], 'Hat', sides=12)
tube('HatBand', vertical([.956, .978], 0, [(.0820, .0820), (.0800, .0800)], 'Head'), 'Team', 12, caps=(False, False))
F.box('HatPin', (.120, 0, .990), (.010, .120, .060), 'Hat', 'Head')  # the left side pinned up

# ---- the submachine gun low in the right fist, the left thumb in the belt: posed, then the rest pose ------------
F.hold('R', (-.150, -.150, .560), pole=(-1, .4, -.5))
F.hold('L', (.090, -.100, .560), pole=(1, .2, -.8))
F.bake_rest()
g = F.fist('R', None, (0, 0, 1), half=.022)
F.fist('L', None, (0, 1, 0), half=.018)
F.assault_rifle(g, body='Gun', optic='Wood', below=.120, above=.260)
tube('Drum', [((g.x, g.y - .040, g.z + .080), .040, 'Prop_R'), ((g.x + .030, g.y - .040, g.z + .080), .040, 'Prop_R')], 'Gun', 8, attachment=True)

F.finish_rest(UID, 'Mercenary (20th century): a soldier of fortune in a wide slouch hat pinned up at one side with a Team band, a moustache, a khaki shirt with '
              'rolled sleeves, a Team bandolier, a belt with a holster, khaki breeches, puttees and boots, a submachine gun with a drum magazine upright '
              'in the right fist', notes={'role': 'mercenary (drawn for mercenary squads of the infantry class)'},
              clips=FC.clips_hook(UID, FC.Kit('gun')))
