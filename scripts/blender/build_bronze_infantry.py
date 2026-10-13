# scripts/blender/build_bronze_infantry.py
# Bronze infantry (spearman), quality pass of 2026-10-13 (the first unit taken to the higher bar):
#   blender -b --factory-startup -P scripts/blender/build_bronze_infantry.py
# Same contract as before (the canonical rig of ti_units.py, flat material colours, the Team, Skin
# and Emblem tags, the spear and shield as attachments, the 12 foot-melee clips), with:
#   - a shaped head (jaw, cheeks, brow, nose, ears, eyes, eyebrows) and hair under the cap
#   - a banded leather corselet with a bronze pectoral, shoulder pieces and linen sleeves
#   - a belted Team kilt with a pale tufted hem, a dagger at the hip, laced sandals
#   - fists that close round the spear and the shield grip
#   - a domed shield with a bronze rim, a spear with a leaf blade and a butt spike
#   - baked ambient occlusion and a ground-to-head gradient in COLOR_0 (the battle shader shades
#     Team cloth and skin with it too: gltfUnitLoader.js aShade), so the figure keeps its depth
#     at every zoom
# Outputs go to art-build/units/bronze-infantry/ (ti_units.out_dir); copy the GLB to
# src/assets/units/bronze-infantry.glb.
import bpy, bmesh, sys, math, json, random
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

sys.path.insert(0, str(Path(__file__).resolve().parent))
import ti_units as u  # noqa: E402

OUT = u.out_dir('bronze-infantry')
bpy.ops.wm.read_factory_settings(use_empty=True)
u.COLORS.update({'Hair': '2B201A', 'Leather': '6A3D27', 'Metal': 'C9994F', 'Wood': '7A5636', 'Cloth': 'EADFC6'})
u.palette()
arm = u.rig(ready=True)
meshes = []


def tube(name, rings, mat, sides=8, caps=(True, True), attachment=False):
    """Rings of (centre, (rx, ry) or r, weight) joined into a tube; caps close the first / last ring.
    For a vertical tube rx is the half width (X) and ry the half depth (Y); vertex 0 faces -Y."""
    verts, faces, vw = [], [], []
    n = len(rings)
    for i, (centre, rad, wt) in enumerate(rings):
        c = Vector(centre)
        d = Vector(rings[min(n - 1, i + 1)][0]) - Vector(rings[max(0, i - 1)][0])
        d.normalize()
        a0 = Vector((0, -1, 0))
        a0 -= d * a0.dot(d)
        if a0.length < .05:
            a0 = Vector((1, 0, 0))
            a0 -= d * a0.dot(d)
        a0.normalize()
        a1 = d.cross(a0).normalized()
        rx, ry = (rad, rad) if isinstance(rad, (int, float)) else rad
        w = {wt: 1} if isinstance(wt, str) else wt
        for j in range(sides):
            a = 2 * math.pi * j / sides
            verts.append(tuple(c + a0 * math.cos(a) * ry + a1 * math.sin(a) * rx))
            vw.append(w)
        if i:
            for j in range(sides):
                p, q = (i - 1) * sides + j, (i - 1) * sides + (j + 1) % sides
                faces += [(p, q, i * sides + (j + 1) % sides), (p, i * sides + (j + 1) % sides, i * sides + j)]
    for end, on in ((0, caps[0]), (n - 1, caps[1])):
        if not on:
            continue
        idx = len(verts)
        verts.append(tuple(rings[end][0]))
        vw.append(vw[end * sides])
        for j in range(sides):
            p, q = end * sides + j, end * sides + (j + 1) % sides
            faces.append((idx, q, p) if end == 0 else (idx, p, q))
    ob = u.mesh_obj(name, verts, faces, mat, weights=vw, arm=arm, attachment=attachment)
    meshes.append(ob)
    return ob


def box(name, centre, size, mat, bone, attachment=False):
    ob = u.box(name, centre, size, mat, bone, arm, attachment)
    meshes.append(ob)
    return ob


def raw(name, verts, faces, mat, bone, attachment=False):
    ob = u.mesh_obj(name, verts, faces, mat, bone, attachment, arm=arm)
    meshes.append(ob)
    return ob


def vertical(zs, cy, radii, weights):
    """Rings up the Z axis: zs, the centre's Y per ring (or one number), (rx, ry) per ring."""
    cys = cy if isinstance(cy, (list, tuple)) else [cy] * len(zs)
    ws = weights if isinstance(weights, (list, tuple)) else [weights] * len(zs)
    return [((0, cys[i], zs[i]), radii[i], ws[i]) for i in range(len(zs))]


bone = arm.data.bones

# ---- legs, feet, sandals -----------------------------------------------------------------------
for side, s in (('L', 1), ('R', -1)):
    L, S, F = 'Leg_' + side, 'Shin_' + side, 'Foot_' + side
    tube('BodyLeg_' + side, [
        ((s * .061, 0, .470), (.053, .050), L), ((s * .064, 0, .405), (.051, .047), L),
        ((s * .070, -.003, .320), (.040, .039), L), ((s * .071, -.012, .268), (.034, .036), {L: .6, S: .4}),
        ((s * .071, -.014, .250), (.033, .036), {L: .4, S: .6}), ((s * .073, .004, .200), (.039, .040), S),
        ((s * .074, .008, .150), (.036, .037), S), ((s * .074, .005, .095), (.026, .027), S),
        ((s * .074, .001, .050), (.021, .023), F)], 'Skin', 8, caps=(False, False))
    tube('BodyFoot_' + side, [
        ((s * .074, .020, .028), (.021, .022), F), ((s * .074, -.020, .030), (.029, .028), F),
        ((s * .074, -.070, .022), (.034, .019), F), ((s * .074, -.108, .017), (.028, .012), F)], 'Skin', 6)
    box('SandalSole_' + side, (s * .074, -.042, .007), (.072, .146, .014), 'Leather', F)
    tube('SandalToeStrap_' + side, [((s * .074 - .037, -.072, .020), .009, F), ((s * .074, -.072, .043), .009, F),
                                    ((s * .074 + .037, -.072, .020), .009, F)], 'Leather', 4)
    tube('SandalAnkle_' + side, [((s * .074, .002, .052), (.026, .029), F), ((s * .074, .002, .070), (.025, .028), F)],
         'Leather', 8, caps=(False, False))
    for k, (z, r) in enumerate(((.105, .029), (.150, .039))):  # the sandal's laces up the calf
        tube(f'SandalLace{k}_{side}', [((s * .074, .006, z - .007), r, S), ((s * .074, .006, z + .007), r, S)],
             'Leather', 8, caps=(False, False))

# ---- kilt, hem, belt, dagger -------------------------------------------------------------------
tube('Kilt', vertical([.330, .385, .450, .515, .548], 0,
                      [(.136, .098), (.129, .093), (.117, .085), (.101, .073), (.090, .064)], 'Hips'), 'Team', 12, caps=(False, False))
hem = tube('KiltHem', vertical([.300, .318, .336], 0, [(.141, .103), (.140, .101), (.138, .0995)], 'Hips'), 'Cloth', 16, caps=(False, False))
for i in range(16):  # a tufted hem: every second point hangs lower
    if i % 2:
        hem.data.vertices[i].co.z -= .014
tube('Sash', vertical([.522, .534, .552, .564], 0, [(.101, .073), (.104, .076), (.100, .073), (.093, .067)], 'Spine'), 'Team', 12, caps=(False, False))
raw('SashEnd', [(.030, -.079, .530), (.066, -.070, .530), (.072, -.092, .405), (.026, -.100, .405), (.030, -.073, .530), (.066, -.064, .530), (.072, -.084, .405), (.026, -.092, .405)],
    [(0, 1, 2), (0, 2, 3), (5, 4, 7), (5, 7, 6), (4, 0, 3), (4, 3, 7), (1, 5, 6), (1, 6, 2), (3, 2, 6), (3, 6, 7), (4, 5, 1), (4, 1, 0)], 'Team', 'Spine')
box('BeltBuckle', (0, -.078, .542), (.034, .012, .030), 'Metal', 'Spine')
box('DaggerSheath', (-.104, -.018, .478), (.020, .022, .105), 'Leather', 'Hips')
box('DaggerGrip', (-.104, -.018, .548), (.014, .016, .036), 'Wood', 'Hips')
box('DaggerPommel', (-.104, -.018, .571), (.024, .024, .012), 'Metal', 'Hips')
box('DaggerChape', (-.104, -.018, .424), (.024, .026, .012), 'Metal', 'Hips')

# ---- corselet: leather in overlapping bands, a bronze pectoral, shoulder straps -----------------
profile = [(.535, .092, .064), (.575, .089, .063), (.615, .090, .065), (.655, .101, .071), (.695, .117, .077),
           (.735, .132, .080), (.762, .128, .074), (.785, .090, .058), (.800, .050, .042)]
rings = []
for i, (z, rx, ry) in enumerate(profile):
    wt = 'Spine' if z < .66 else 'Chest'
    if 0 < i < 5:  # each band overlaps the one below
        rings.append(((0, 0, z - .002), (rx + .007, ry + .006), wt))
    rings.append(((0, 0, z), (rx, ry), wt))
tube('LeatherCorselet', rings, 'Leather', 12, caps=(False, True))
n = 8  # the pectoral: a bronze disc on the chest
pv = [(0, -.090, .705)] + [(.036 * math.cos(2 * math.pi * j / n), -.081, .705 + .036 * math.sin(2 * math.pi * j / n)) for j in range(n)]
raw('Pectoral', pv, [(0, (j + 1) % n + 1, j + 1) for j in range(n)], 'Metal', 'Chest')
for side, s in (('L', 1), ('R', -1)):
    tube('CorseletStrap_' + side, [((s * .082, -.079, .715), (.017, .010), 'Chest'), ((s * .078, -.050, .790), (.017, .010), 'Chest'),
                                   ((s * .078, .010, .806), (.017, .010), 'Chest'), ((s * .082, .066, .750), (.017, .010), 'Chest')], 'Leather', 4)

# ---- arms, sleeves, shoulder pieces, fists -------------------------------------------------------
for side, s in (('L', 1), ('R', -1)):
    A, FA, H = 'Arm_' + side, 'Forearm_' + side, 'Hand_' + side
    sh, el, wr = bone[A].head_local.copy(), bone[FA].head_local.copy(), bone[H].head_local.copy()
    tube('BodyArm_' + side, [
        (tuple(sh), (.043, .040), A), (tuple(sh.lerp(el, .35)), (.042, .039), A), (tuple(sh.lerp(el, .75)), (.035, .033), A),
        (tuple(el), (.032, .032), {A: .5, FA: .5}), (tuple(el.lerp(wr, .30)), (.035, .032), FA),
        (tuple(el.lerp(wr, .75)), (.027, .026), FA), (tuple(wr), (.022, .024), H)], 'Skin', 8, caps=(False, False))
    tube('LinenSleeve_' + side, [(tuple(sh.lerp(el, -.05)), (.050, .046), A), (tuple(sh.lerp(el, .30)), (.049, .044), A),
                                 (tuple(sh.lerp(el, .52)), (.047, .043), A)], 'Cloth', 8, caps=(True, False))
    top = sh + Vector((s * .004, 0, .012))
    tube('ShoulderPiece_' + side, [(tuple(top + Vector((-s * .030, 0, .012))), (.036, .042), 'Chest'), (tuple(top), (.049, .047), A),
                                   (tuple(top.lerp(el, .20)), (.051, .047), A)], 'Leather', 8, caps=(True, False))
    # a closed fist round the spear shaft (right) and the shield grip (left)
    grip = Vector((-.223, -.137, .604)) if side == 'R' else Vector((.225, -.130, .608))
    tube('BodyHand_' + side, [(tuple(wr), (.022, .024), H), (tuple(wr.lerp(grip, .55)), (.026, .027), H),
                              (tuple(grip), (.027, .030), H), (tuple(grip + (grip - wr).normalized() * .016), (.018, .024), H)], 'Skin', 6)
    tube('Fingers_' + side, [(tuple(grip + Vector((0, -.004, -.027))), (.024, .024), H), (tuple(grip + Vector((0, -.004, .027))), (.024, .024), H)], 'Skin', 6)

# ---- neck, head, face, hair, cap -----------------------------------------------------------------
tube('BodyNeck', vertical([.770, .815, .850], [0, -.002, -.004], [(.044, .040), (.036, .034), (.037, .036)], 'Neck'), 'Skin', 8, caps=(False, False))
tube('LinenCollar', vertical([.782, .806, .822], 0, [(.060, .050), (.050, .043), (.042, .039)], ['Chest', 'Chest', 'Neck']), 'Cloth', 8, caps=(False, False))
tube('BodyHead', vertical([.838, .850, .868, .892, .920, .948, .975, .994],
                          [-.026, -.017, -.012, -.009, -.007, -.005, -.003, -.002],
                          [(.016, .016), (.036, .036), (.047, .047), (.055, .053), (.058, .055), (.058, .056), (.050, .049), (.030, .030)],
                          'Head'), 'Skin', 10)
raw('FaceNose', [(-.014, -.060, .932), (.014, -.060, .932), (-.015, -.064, .896), (.015, -.064, .896), (0, -.084, .902)],
    [(0, 1, 4), (0, 4, 2), (1, 3, 4), (2, 4, 3), (0, 2, 3), (0, 3, 1)], 'Skin', 'Head')
box('FaceMouth', (0, -.0585, .874), (.024, .006, .005), 'Leather', 'Head')
for s in (-1, 1):
    tube(f'Ear_{s}', [((s * .056, .002, .900), (.010, .012), 'Head'), ((s * .064, .004, .918), (.010, .015), 'Head'),
                      ((s * .056, .002, .938), (.010, .011), 'Head')], 'Skin', 4)
    box(f'FaceEye_{s}', (s * .024, -.0585, .924), (.012, .008, .007), 'Hair', 'Head')
    box(f'FaceBrow_{s}', (s * .025, -.0600, .940), (.026, .010, .008), 'Hair', 'Head')
tube('HairNape', vertical([.868, .888, .920, .950], [.018, .014, .008, .004], [(.046, .040), (.061, .052), (.064, .057), (.063, .058)], 'Head'),
     'Hair', 10, caps=(True, False))
tube('BronzeCap', vertical([.944, .949, .957, .985, 1.012, 1.032, 1.044], -.003,
                           [(.069, .064), (.072, .067), (.067, .062), (.055, .051), (.034, .032), (.014, .013), (.010, .010)], 'Head'),
     'Metal', 12, caps=(True, True), attachment=True)
tube('CapKnob', vertical([1.044, 1.054, 1.064], -.003, [.009, .014, .006], 'Head'), 'Metal', 6, attachment=True)

# ---- spear (the right hand's attachment): total length 2.2 m at a 1.75 m body ----------------------
x, y, base = -.223, -.137, .040
length = 2.2 / 1.75
top = base + length - .150  # where the blade's socket starts
P = 'Prop_R'
tube('SpearShaft', [((x, y, base), .0105, P), ((x, y, top), .0085, P)], 'Wood', 6, caps=(False, False), attachment=True)
tube('SpearButt', [((x, y, .006), .002, P), ((x, y, base - .004), .011, P), ((x, y, base + .022), .012, P)], 'Metal', 6, attachment=True)
tube('SpearLashing', [((x, y, top - .060), .012, P), ((x, y, top - .028), .012, P)], 'Leather', 6, caps=(False, False), attachment=True)
tube('SpearSocket', [((x, y, top - .028), .0125, P), ((x, y, top + .014), .010, P)], 'Metal', 6, caps=(False, False), attachment=True)
tube('LeafSpearHead', [((x, y, top + .010), (.008, .008), P), ((x, y, top + .034), (.021, .007), P), ((x, y, top + .066), (.030, .008), P),
                       ((x, y, top + .108), (.019, .006), P), ((x, y, top + .150), (.0015, .0015), P)], 'Metal', 4, attachment=True)

# ---- shield (the left hand's attachment): a domed round shield, its face the squad's emblem --------
cx, cy, cz, R, n = .225, -.166, .612, .192, 16
P = 'Prop_L'
ang = [2 * math.pi * j / n for j in range(n)]
fv = [(cx, cy - .036, cz)]
for r, depth in ((R * .5, -.028), (R - .018, -.012)):
    fv += [(cx + r * math.cos(a), cy + depth, cz + r * math.sin(a)) for a in ang]
ff = [(0, 1 + (j + 1) % n, 1 + j) for j in range(n)]
for j in range(n):
    a, b = 1 + j, 1 + (j + 1) % n
    ff += [(a, b, b + n), (a, b + n, a + n)]
face = raw('ShieldFace', fv, ff, 'Emblem', P, True)
uv = face.data.uv_layers.active.data
for poly in face.data.polygons:
    for li in poly.loop_indices:
        co = face.data.vertices[face.data.loops[li].vertex_index].co
        uv[li].uv = ((co.x - cx) / (R * 2) + .5, (co.z - cz) / (R * 2) + .5)
rv, rf = [], []
for a in ang:
    for r, depth in ((R - .018, -.012), (R - .004, -.016), (R + .002, -.006), (R + .002, .012), (R - .018, .016)):
        rv.append((cx + r * math.cos(a), cy + depth, cz + r * math.sin(a)))
for j in range(n):
    for k in range(4):
        a, b = j * 5 + k, j * 5 + k + 1
        c, d = ((j + 1) % n) * 5 + k + 1, ((j + 1) % n) * 5 + k
        rf += [(a, b, c), (a, c, d)]
raw('ShieldBronzeRim', rv, rf, 'Metal', P, True)
bv = [(cx, cy + .010, cz)] + [(cx + (R - .018) * math.cos(a), cy + .016, cz + (R - .018) * math.sin(a)) for a in ang]
raw('ShieldBack', bv, [(0, 1 + j, 1 + (j + 1) % n) for j in range(n)], 'Wood', P, True)
tube('ShieldGrip', [((cx - .060, cy + .020, cz), .010, P), ((cx, cy + .040, cz), .011, P), ((cx + .060, cy + .020, cz), .010, P)],
     'Leather', 6, attachment=True)
tube('ShieldArmStrap', [((cx - .085, cy + .018, cz - .060), .008, P), ((cx - .070, cy + .046, cz), .008, P),
                        ((cx - .085, cy + .018, cz + .060), .008, P)], 'Leather', 4, attachment=True)

# ---- consistent outward normals -------------------------------------------------------------------
OPEN_FACING = {'ShieldFace': Vector((0, -1, 0)), 'Pectoral': Vector((0, -1, 0)), 'ShieldBack': Vector((0, 1, 0))}
for ob in meshes:
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    want = OPEN_FACING.get(ob.name)
    if want:
        total = Vector((0, 0, 0))
        for f in bm.faces:
            total += f.normal * f.calc_area()
        if total.dot(want) < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
    else:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        # an open tube has no inside to tell: make its faces point away from its own axis
        centre = sum((v.co for v in bm.verts), Vector((0, 0, 0))) / len(bm.verts)
        bm.normal_update()
        out = sum(f.normal.dot(f.calc_center_median() - centre) * f.calc_area() for f in bm.faces)
        if out < 0:
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()

# ---- baked shade: ambient occlusion and a ground-to-head gradient, in COLOR_0 -----------------------
random.seed(11)
tv, tf = [], []
for ob in meshes:
    o = len(tv)
    tv += [ob.matrix_world @ v.co for v in ob.data.vertices]
    tf += [tuple(o + i for i in p.vertices) for p in ob.data.polygons]
bvh = BVHTree.FromPolygons(tv, tf)
DIRS = []
while len(DIRS) < 40:
    d = Vector((random.uniform(-1, 1), random.uniform(-1, 1), random.uniform(-1, 1)))
    if 0.05 < d.length <= 1:
        DIRS.append(d.normalized())
AO_REACH, AO_STRENGTH = .11, .62
shade_range = [1, 0]
for ob in meshes:
    me = ob.data
    layer = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    cache = {}
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            if vi not in cache:
                p = ob.matrix_world @ me.vertices[vi].co
                nrm = (ob.matrix_world.to_3x3() @ me.vertices[vi].normal).normalized()
                hits = weight = 0.0
                for d in DIRS:
                    k = d.dot(nrm)
                    if k <= .05:
                        continue
                    weight += k
                    hit = bvh.ray_cast(p + nrm * .004, d, AO_REACH)
                    if hit[0] is not None:
                        hits += k * (1 - hit[3] / AO_REACH * .5)
                ao = 1 - AO_STRENGTH * (hits / weight if weight else 0)
                ground = .86 + .14 * min(1, max(0, p.z / .55))  # darker towards the feet
                cache[vi] = max(.42, min(1, ao * ground))
            v = cache[vi]
            layer.data[li].color = (v, v, v, 1)
            shade_range = [min(shade_range[0], v), max(shade_range[1], v)]
    me.color_attributes.active_color = layer
    me.color_attributes.render_color_index = 0

# ---- clips, floor, export ------------------------------------------------------------------------
clips = u.add_actions(arm)
floor_report = u.ground_actions(arm, meshes)
arm.animation_data.action = bpy.data.actions['Idle']
bpy.context.scene.frame_set(1)
for track in arm.animation_data.nla_tracks:
    track.mute = True
bpy.context.scene.render.fps = 20
arm['equipment'] = {'spear_total_H': length, 'shield_diameter_H': R * 2, 'body_height_H': 1.0}
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'bronze-infantry.blend'))
bpy.ops.object.select_all(action='DESELECT')
arm.select_set(True)
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.export_scene.gltf(filepath=str(OUT / 'bronze-infantry.glb'), export_format='GLB', use_selection=True, export_yup=True,
                          export_skins=True, export_animations=True, export_animation_mode='ACTIONS', export_force_sampling=True,
                          export_frame_range=False, export_cameras=False, export_lights=False, export_extras=True,
                          export_materials='EXPORT', export_image_format='NONE', export_optimize_animation_size=False,
                          export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_active_vertex_color_when_no_material=True)
tris = u.triangles(meshes)
(OUT / 'clips.json').write_text(json.dumps({'fps': 20, 'clips': clips, 'events': {'Attack': {'contact_frame': 11}, 'Attack2': {'contact_frame': 13}, 'Death': {'settle_frame': 30}, 'DeathAlt': {'settle_frame': 30}}, 'runtime_animation_playback': 'pending VAT integration'}, indent=2))
(OUT / 'palette.json').write_text(json.dumps(u.COLORS, indent=2))
(OUT / 'floor-correction.json').write_text(json.dumps(floor_report, indent=2))
(OUT / 'source-report.json').write_text(json.dumps({
    'triangles': tris, 'objects': len(meshes), 'bones': list(arm.data.bones.keys()),
    'material_contract': 'flat colours; no textures; COLOR_0 = baked ambient occlusion and ground gradient (greyscale)',
    'shade_range': [round(v, 3) for v in shade_range], 'fps': 20, 'spear_total_H': length, 'shield_diameter_H': R * 2,
    'by_object': {o.name: u.triangles([o]) for o in meshes}}, indent=2))
print('FINISHED', OUT, 'TRIANGLES', tris, 'SHADE', shade_range, flush=True)
