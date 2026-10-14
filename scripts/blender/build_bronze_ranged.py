# scripts/blender/build_bronze_ranged.py
# Bronze ranged (archer), quality pass of 2026-10-13 (after the spearman, build_bronze_infantry.py):
#   blender -b --factory-startup -P scripts/blender/build_bronze_ranged.py
# Same contract as the first archer (Codex, 2026-10-07): the canonical rig plus the Prop_String bone,
# flat material colours, the Team and Skin tags, the equipment's object names (self-bow, bow-grip,
# bow-string, back-quiver, arrow-*, knife-*, nocked-arrow-*), and the bow clips (since 2026-10-14 the
# eight of ti_foot_clips.py: Idle, Walk, Run, Draw-aim-release with the string and the arrow,
# Melee-fallback, Hit, Death, DeathAlt; the nocked arrow on its own bone Tool_Arrow).
# What changed (the look follows plans/art/concepts/oct13/units-bronze-set.png, design reference only):
#   - the body parts of ti_figure.py: shaped head with eyes, brows and a short dark beard, closed
#     fists, laced sandals, the tufted kilt hem
#   - no armour and no shield: a sleeveless linen tunic, a broad Team shawl over the left shoulder
#     and across the chest and the back, a leather belt, a knife
#   - a white headcloth with a dark band, dark hair at the nape
#   - the arms in the ready pose: the bow upright in the left fist (a thicker stave, a string you can
#     see, canted so the string runs inside the forearm), an arrow in the right fist
#   - a slanted leather quiver on the back with four fletched arrows, its strap across the chest
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0
# Outputs go to art-build/units/bronze-ranged/; copy the GLB to src/assets/units/bronze-ranged.glb.
import bpy, sys, os, math, json
from pathlib import Path
from mathutils import Vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402
import ti_figure as F  # noqa: E402
import ti_clips as C  # noqa: E402
import ti_foot_clips as FC  # noqa: E402

UID = 'bronze-ranged'
OUT = u.out_dir(UID)
arm = F.start({'Hair': '2B201A'}, ready=True)
tube, box, raw, vertical = F.tube, F.box, F.raw, F.vertical

# The bow's hand and the string's bone. The bow stands upright through the left fist, its belly to the
# front; the string sits behind it and a little inward, so it passes inside the forearm.
GRIP = Vector((.222, -.132, .606))
BOW_LEN, BRACE = .86, .086  # 1.5 m at a 1.75 m body; the string's distance from the grip
BACK = Vector((-math.sin(math.radians(40)), math.cos(math.radians(40)), 0))  # from the belly to the string
STRING = GRIP + BACK * BRACE
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
bs = arm.data.edit_bones.new('Prop_String')
bs.head = tuple(STRING)
bs.tail = (STRING.x, STRING.y, STRING.z + .02)
bs.parent = arm.data.edit_bones['Prop_L']
bpy.ops.object.mode_set(mode='OBJECT')
arm.pose.bones['Prop_String'].rotation_mode = 'QUATERNION'

# ---- body ----------------------------------------------------------------------------------------
F.legs(laces=True)
F.arms(shoulder='Skin')
F.fist('L', GRIP, (0, 0, 1))
ARROW_HAND = Vector((-.219, -.137, .605))
F.fist('R', ARROW_HAND, (0, 1, 0), half=.020)
F.head()

# ---- kilt, hem, belt, knife ------------------------------------------------------------------------
tube('linen-kilt', vertical([.335, .385, .450, .515, .548], 0,
                            [(.136, .098), (.129, .093), (.117, .085), (.101, .073), (.090, .064)], 'Hips'), 'Team', 10, caps=(False, False))
F.tufted_hem('kilt-hem')
tube('belt', vertical([.520, .548], 0, [(.101, .074), (.099, .072)], 'Spine'), 'Leather', 10, caps=(False, False))
box('belt-buckle', (0, -.076, .534), (.030, .012, .026), 'Metal', 'Spine')
box('knife-sheath', (-.106, .012, .470), (.020, .024, .110), 'Leather', 'Hips', True)
box('knife-hilt', (-.106, .012, .543), (.014, .016, .036), 'Metal', 'Hips', True)

# ---- linen tunic and the Team shawl: a broad band over the left shoulder, across the chest and the back ----
profile = [(.525, .094, .066), (.575, .090, .064), (.615, .091, .066), (.655, .102, .072), (.695, .118, .078),
           (.735, .132, .081), (.762, .128, .075), (.790, .072, .050)]
tube('linen-tunic', [((0, 0, z), (rx, ry), 'Spine' if z < .66 else 'Chest') for z, rx, ry in profile], 'Cloth', 10, caps=(False, True))


def torso_radius(z):
    for (z0, x0, y0), (z1, x1, y1) in zip(profile, profile[1:]):
        if z <= z1:
            t = max(0, (z - z0) / (z1 - z0))
            return x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
    return profile[-1][1], profile[-1][2]


SIDES = 10
sv, sf, sw = [], [], []
for k, (mid, slope) in enumerate(((.630, .085), (.690, .085), (.745, .068))):
    for j in range(SIDES):
        a = 2 * math.pi * j / SIDES
        z = mid + slope * math.sin(a)
        rx, ry = torso_radius(z)
        grow = .013 + (.004 if k == 1 else 0)
        sv.append(((rx + grow) * math.sin(a), -(ry + grow) * math.cos(a), z))
        sw.append({'Spine' if z < .64 else 'Chest': 1})
    if k:
        for j in range(SIDES):
            p, q = (k - 1) * SIDES + j, (k - 1) * SIDES + (j + 1) % SIDES
            sf += [(p, q, k * SIDES + (j + 1) % SIDES), (p, k * SIDES + (j + 1) % SIDES, k * SIDES + j)]
F.meshes.append(u.mesh_obj('team-shoulder-shawl', sv, sf, 'Team', weights=sw, arm=arm))
# the shawl's end hangs down the back from the left shoulder
raw('team-shawl-end', [(.050, .078, .790), (.112, .070, .775), (.118, .100, .640), (.052, .106, .632), (.050, .070, .790), (.112, .062, .775), (.118, .090, .640), (.052, .096, .632)],
    [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)], 'Team', 'Chest')

# ---- white headcloth with a dark band, dark hair at the nape, a short beard ---------------------------------
tube('hair-nape', vertical([.868, .888, .920, .950], [.018, .014, .008, .004], [(.046, .040), (.061, .052), (.064, .057), (.063, .058)], 'Head'),
     'Hair', 8, caps=(True, False))
F.headcloth('Leather', tail=False)
F.beard()

# ---- the bow (the left hand's attachment) --------------------------------------------------------------
P = 'Prop_L'
N = 8
bow = []
for i in range(N + 1):
    t = i / N
    p = GRIP + Vector((0, 0, (t - .5) * BOW_LEN)) + BACK * BRACE * (1 - max(0, math.sin(math.pi * t)) ** .8)
    bow.append((tuple(p), .0075 + .0055 * math.sin(math.pi * t), P))
tube('self-bow', bow, 'Wood', 5, attachment=True)
tube('bow-grip', [((GRIP.x, GRIP.y, GRIP.z - .040), .0155, P), ((GRIP.x, GRIP.y, GRIP.z + .040), .0155, P)], 'Leather', 6, caps=(False, False), attachment=True)
top, bottom = Vector(bow[-1][0]), Vector(bow[0][0])
tube('bow-string', [(tuple(bottom), .0032, P), (tuple(STRING), .0032, 'Prop_String'), (tuple(top), .0032, P)], 'Cloth', 3, attachment=True)

# ---- the arrow in the right hand: nock at the wrist, the point ahead (Prop_R carries it in the draw) ----
P = 'Prop_R'
ax, az = ARROW_HAND.x, ARROW_HAND.z
tube('nocked-arrow-shaft', [((ax, -.108, az), .0040, P), ((ax, -.505, az), .0040, P)], 'Wood', 4, attachment=True)
tube('nocked-arrow-head', [((ax, -.500, az), (.011, .004), P), ((ax, -.548, az), (.0012, .0012), P)], 'Metal', 4, attachment=True)
tube('nocked-arrow-fletching', [((ax, -.170, az), (.004, .015), P), ((ax, -.222, az), (.004, .011), P)], 'Cloth', 4, attachment=True)

# ---- quiver on the back, its arrows, the strap across the chest ---------------------------------------------
P = 'Prop_Back'
qb, qt = Vector((.052, .122, .560)), Vector((-.080, .116, .850))
qa = (qt - qb).normalized()
tube('back-quiver', [(tuple(qb), .029, P), (tuple(qb.lerp(qt, .5)), .036, P), (tuple(qt), .041, P), (tuple(qt - qa * .014), .031, P)], 'Leather', 8, attachment=True)
tube('quiver-binding', [(tuple(qt - qa * .050), .044, P), (tuple(qt - qa * .026), .045, P)], 'Wood', 8, caps=(False, False), attachment=True)
side_a = qa.cross(Vector((0, 1, 0))).normalized()
side_b = qa.cross(side_a).normalized()
for n in range(4):
    a = n * 2 * math.pi / 4 + .6
    off = side_a * math.cos(a) * .019 + side_b * math.sin(a) * .019
    lean = off * 1.1
    tip = qt + off + lean + qa * (.100 + .014 * (n % 3))
    tube(f'arrow-shaft-{n}', [(tuple(qt + off - qa * .020), .0036, P), (tuple(tip), .0036, P)], 'Wood', 3, attachment=True)
    flat = (.0145, .0035) if n % 2 else (.0035, .0145)
    tube(f'arrow-fletching-{n}', [(tuple(tip - qa * .062), flat, P), (tuple(tip - qa * .008), flat, P)], 'Cloth', 4, attachment=True)
strap = [((-.074, .096, .796), 'Chest'), ((-.086, .000, .806), 'Chest'), ((-.062, -.084, .756), 'Chest'), ((.000, -.101, .688), 'Chest'),
         ((.056, -.070, .615), 'Spine'), ((.103, -.012, .562), 'Spine'), ((.062, .078, .566), 'Spine')]
tube('diagonal-quiver-strap', [(p, (.013, .0055), w) for p, w in strap], 'Leather', 4)

meshes = F.meshes
F.fix_normals()
shade_range = F.bake_shade()

# ---- clips (2026-10-14, ti_foot_clips.py): the eight bow clips authored anew (hand targets on the bow and
# the arrow, the body turned side on to draw, the string bone following the drawing fist, the nocked arrow on
# its own bone Tool_Arrow, hidden from the release until the next arrow comes out of the quiver). The old
# keys (the generic gait of ti_units.add_actions and the 2026-10-07 draw that flew the arrow on Prop_R) are gone.
KIT = FC.Kit('bow', side='L', arrow=('nocked-arrow-shaft', 'nocked-arrow-head', 'nocked-arrow-fletching'), string=True, quiver='back')
clips, order, floor_audit = FC.author(KIT, arm, meshes)

# ---- export ------------------------------------------------------------------------------------------
bpy.context.scene.render.fps = 20
F.normalize_weights()
tris = u.triangles(meshes)
assert tris <= 2000, tris
arm['equipment'] = {'bow_length_H': BOW_LEN, 'body_height_H': 1.0}
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / f'{UID}.blend'))
F.export_glb(OUT / f'{UID}.glb')
(OUT / 'clips.json').write_text(json.dumps({'fps': 20, 'clips': clips}, indent=2))
(OUT / f'{UID}.json').write_text(C.options_json(clips, order))
(OUT / 'palette.json').write_text(json.dumps(u.COLORS, indent=2))
report = {'unit': UID, 'triangles': tris, 'budget': 2000, 'objects': len(meshes), 'bones': [b.name for b in arm.data.bones], 'clips': clips,
          'floorAudit': floor_audit,
          'string': 'Prop_String skins the bowstring midpoint; it follows the drawing fist in Draw-aim-release',
          'arrow': 'Tool_Arrow (a child of Prop_R) carries the nocked arrow: scale 0 from the release until the next arrow is drawn from the quiver',
          'material_contract': 'flat colours; no textures; COLOR_0 = baked ambient occlusion and ground gradient (greyscale)',
          'shade_range': shade_range, 'fps': 20, 'by_object': {o.name: u.triangles([o]) for o in meshes}}
(OUT / 'production-report.json').write_text(json.dumps(report, indent=2))
(OUT / 'source-report.json').write_text(json.dumps(report, indent=2))
if os.environ.get('TI_PREVIEW'):
    F.preview(OUT, UID, [('draw', 'Draw-aim-release', 16), ('loose', 'Draw-aim-release', 22)])
if os.environ.get('TI_SHEETS'):  # contact sheets of every clip from the battle camera (TI_SHEETS=side: from the side too)
    FC.sheets(UID, clips, arm, KIT)
    if os.environ.get('TI_SHEETS') == 'side':
        FC.sheets(UID, clips, arm, KIT, view='side')
print('FINISHED', OUT, 'TRIANGLES', tris, 'SHADE', shade_range, flush=True)
