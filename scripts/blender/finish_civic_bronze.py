"""Finish existing civic atlas builds without rebaking; validate exact damage budgets."""
import os,sys,json
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import bpy
import ti_map as tm
import validate_model as vm
from repair_palace_damage_uv import repair_lod_uvs
from civic_african_far import replace_african_far
args=sys.argv[sys.argv.index('--')+1:]
repo=os.path.abspath(args[0])
report={}
spec=json.dumps({'keep':['prefab-hq',None,None],'keep-damaged':['house-damaged',None,None],'keep-ruined':['ruin',None,None]})
for theme in args[1:]:
 name='civic-bronze'+('' if theme=='base' else '-'+theme)
 out=os.path.join(repo,'art-build','civic-bronze',theme)
 bpy.ops.wm.open_mainfile(filepath=os.path.join(out,name+'.blend'))
 roots=[o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.parent is None]
 if theme in ('eastafrica','westafrica'):replace_african_far(roots)
 intact=next(r for r in roots if r.name=='keep')
 source=next(c for c in intact.children if c.name.split('.')[0]=='LOD0')
 lo=[min(v.co[i] for v in source.data.vertices) for i in range(3)]
 hi=[max(v.co[i] for v in source.data.vertices) for i in range(3)]
 for root in roots:
  for child in root.children:
   if child.type=='MESH':
    for v in child.data.vertices:
     v.co.z=max(0,v.co.z)
     for axis in (0,1):v.co[axis]=min(hi[axis],max(lo[axis],v.co[axis]))
 repairs=repair_lod_uvs(roots)
 for root in roots:root.location=(0,0,0);root.rotation_euler=(0,0,0);root.scale=(1,1,1)
 for img in list(bpy.data.images):
  if img.name.startswith(name+'_'):
   img.file_format='PNG';img.filepath_raw=os.path.join(out,img.name+'.png');img.save()
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out,name+'.blend'))
 exported=roots+[c for r in roots for c in r.children]
 glb=os.path.join(out,name+'.glb');tm.export_glb(glb,exported)
 rc=vm.main(glb,os.path.join(out,'validation'),spec)
 if rc:raise RuntimeError('Validation failed '+theme)
 import shutil
 shutil.copyfile(glb,os.path.join(repo,'src','assets','battle','city',name+'.glb'))
 report[theme]={'uvRepair':repairs,'bytes':os.path.getsize(glb)}
 with open(os.path.join(out,'finish-report.json'),'w') as f:json.dump(report[theme],f,indent=2)
 print('CIVIC_FINISHED '+theme,flush=True)
sys.stdout.flush();os._exit(0)


