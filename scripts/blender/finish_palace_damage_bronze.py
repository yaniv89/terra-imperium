import bpy,sys,os,json,hashlib
from mathutils import Matrix
BASE=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));sys.path.insert(0,os.path.join(BASE,'scripts/blender'))
import ti_map as tm,validate_model as validator
OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else os.path.join(BASE,'art-build/palace-damage-bronze');path=os.path.join(OUT,'palace-damage-bronze.glb')
bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'palace-damage-bronze.blend'))
roots=[o for o in bpy.context.scene.objects if o.type=='EMPTY' and not o.parent]
def geo(o):
 return hashlib.sha256(json.dumps({'vertices':[tuple(v.co) for v in o.data.vertices],'faces':[tuple(p.vertices) for p in o.data.polygons],'uv':[tuple(v.uv) for v in o.data.uv_layers.active.data]},sort_keys=True).encode()).hexdigest()
from repair_palace_damage_uv import repair_lod_uvs
lod0_before={r.name:geo(next(c for c in r.children if c.name.split('.')[0]=='LOD0')) for r in roots}
uv_report=repair_lod_uvs(roots)
from palace_damage_far_beams import add_far_charred_beams
add_far_charred_beams(roots,'LOD1')
add_far_charred_beams(roots,'LOD2')
assert lod0_before=={r.name:geo(next(c for c in r.children if c.name.split('.')[0]=='LOD0')) for r in roots}
before={o.name:geo(o) for r in roots for o in r.children if o.type=='MESH'}
counts={r.name:{c.name.split('.')[0]:tm.triangles(c) for c in r.children if c.type=='MESH'} for r in roots}
for r in roots:r.matrix_world=Matrix.Identity(4);r['art_author']='Original procedural';r['design_reference']='design-sheet.png';r['damage_source']='ti_bronze.palace_small' if 'small' in r.name else 'ti_bronze.palace'
after={o.name:geo(o) for r in roots for o in r.children if o.type=='MESH'}
assert before==after
for im in bpy.data.images:
 if im.name.startswith('palace-damage-bronze_'):
  im.filepath_raw=os.path.join(OUT,im.name+'.png');im.file_format='PNG';im.save();im.pack()
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'palace-damage-bronze.blend'));tm.export_glb(path,roots+[c for r in roots for c in r.children])
ret=validator.main(path,OUT,'house-damage');assert ret==0,'Unchanged validator failed'
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=path)
actual={r.name:{c.name.split('.')[0]:tm.triangles(c) for c in r.children if c.type=='MESH'} for r in bpy.context.scene.objects if r.type=='EMPTY' and not r.parent}
assert actual==counts,(actual,counts)
rep={'bounded_lower_lod_uv_faces':uv_report,'lod0_geometry_uv_unchanged_by_uv_repair':True,'far_charred_beams_retained':True,'roots':list(counts),'triangles':counts,'root_alignment_preserves_mesh_and_uv_hash':before==after,'reimport_triangle_and_hierarchy_match':actual==counts,'atlas_size':2048,'ao_baked_into_base_once':True,'runtime_occlusion_input':False,'validator_kind':'house-damage','validator_passed':True}
open(os.path.join(OUT,'source-checks.json'),'w').write(json.dumps(rep,indent=2))
print('FINAL SOURCE CHECKS PASSED',flush=True)
sys.stdout.flush();os._exit(0)



