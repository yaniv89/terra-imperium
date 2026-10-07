"""Read-only textured civic source proof renderer. Never saves or changes a source BLEND.
Blender -b -t 8 -P this.py -- REPO THEME...
Use --roof-only for keep LOD0/2 geometry comparison before source finishing.
"""
import bpy,os,sys,json,hashlib,numpy as np
from mathutils import Vector
ROOT=os.path.abspath(sys.argv[sys.argv.index('--')+1]);sys.path.insert(0,os.path.join(ROOT,'scripts/blender'));import ti_map as tm
THEMES=['base','europe','levant','nile','maghreb','indic','sinic','steppe','monsoon','americas','eastafrica','westafrica','israelite']
args=sys.argv[sys.argv.index('--')+2:];themes=[a for a in args if not a.startswith('--')] or THEMES
roof_only='--roof-only' in args;contacts_only='--contacts-only' in args
OUT=os.path.join(ROOT,'art-build','civic-bronze','proof-local');os.makedirs(OUT,exist_ok=True)
def sha(p):return hashlib.sha256(open(p,'rb').read()).hexdigest()
def read_png(path):
 img=bpy.data.images.load(path,check_existing=False);w,h=img.size;arr=np.array(img.pixels[:],dtype=np.float32).reshape(h,w,4)[::-1].copy();bpy.data.images.remove(img);return arr

def contact(path,rows):
 canvas=np.concatenate([np.concatenate([read_png(p) for p in row],axis=1) for row in rows],axis=0)
 img=tm.image_from_array(os.path.basename(path),canvas,'PNG');img.filepath_raw=path;img.save();bpy.data.images.remove(img)

for theme in [] if contacts_only else themes:
 name='civic-bronze'+('' if theme=='base' else '-'+theme);source=os.path.join(ROOT,'art-build','civic-bronze',theme,name+'.blend');finish=os.path.join(os.path.dirname(source),'finish-report.json')
 if not roof_only and not os.path.exists(finish):raise RuntimeError('Finish report required before textured delivery QA: '+theme)
 source_sha=sha(source);bpy.ops.wm.open_mainfile(filepath=source)
 roots=[o for o in bpy.context.scene.objects if o.type=='EMPTY' and o.parent is None and o.name in ('keep','keep-damaged','keep-ruined')];roots.sort(key=lambda r:('damaged' in r.name or 'ruined' in r.name,'ruined' in r.name))
 for r in roots:r.location=(0,0,0)
 bpy.context.view_layer.update()
 geometry=[c for r in roots for c in r.children if c.type=='MESH']
 points=[c.matrix_world@v.co for c in geometry if c.name.split('.')[0]=='LOD0' for v in c.data.vertices]
 low=Vector(tuple(min(v[k] for v in points) for k in range(3)));high=Vector(tuple(max(v[k] for v in points) for k in range(3)));target=(low+high)/2
 scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=12;scene.render.threads_mode='FIXED';scene.render.threads=8
 prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
 for device in prefs.devices:device.use=device.type=='OPTIX'
 scene.cycles.device='GPU';scene.world=bpy.data.worlds.new('Civic bright phone proof');scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.65,.69,.74,1);bg.inputs['Strength'].default_value=.6
 for loc,power,size in [((3,-4,6),600,5),((-4,-1,3),400,4)]:
  bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=size
 bpy.ops.object.camera_add(location=target+Vector((2.6,-3.8,2.7)));cam=bpy.context.object;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';scene.camera=cam
 rotation=cam.rotation_euler.to_matrix();right=rotation@Vector((1,0,0));up=rotation@Vector((0,1,0));xp=[(p-target).dot(right) for p in points];yp=[(p-target).dot(up) for p in points];aspect=844/390
 cam.data.ortho_scale=max(max(xp)-min(xp),(max(yp)-min(yp))*aspect)*1.24
 # Camera-facing label, outside source geometry and excluded from all deliveries.
 bpy.ops.object.text_add();label=bpy.context.object;label.data.align_x='LEFT';label.data.size=cam.data.ortho_scale*.022;label.rotation_euler=cam.rotation_euler
 label.location=target+right*(-cam.data.ortho_scale*.47)+up*(-cam.data.ortho_scale/aspect*.46)
 mat=bpy.data.materials.new('ProofLabel');mat.use_nodes=True;mat.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=(.01,.01,.01,1);label.data.materials.append(mat)
 scene.render.resolution_x=844;scene.render.resolution_y=390;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
 out=os.path.join(OUT,theme,'roof-precheck' if roof_only else 'delivery');os.makedirs(out,exist_ok=True);proofs=[];counts={}
 for r in roots[:1] if roof_only else roots:
  counts[r.name]={}
  for lod in (0,2) if roof_only else range(3):
   for c in geometry:c.hide_render=c.parent!=r or c.name.split('.')[0]!='LOD'+str(lod)
   ob=next(c for c in r.children if c.name.split('.')[0]=='LOD'+str(lod));counts[r.name]['LOD'+str(lod)]=tm.triangles(ob)
   label.data.body=theme+' / '+r.name+' / LOD'+str(lod)
   path=os.path.join(out,r.name+'-lod'+str(lod)+'-844x390.png');scene.render.filepath=path;bpy.ops.render.render(write_still=True);proofs.append({'root':r.name,'lod':lod,'path':path,'sha256':sha(path)})
 rows=[[p['path'] for p in proofs if p['root']==r.name] for r in roots[:1] if roof_only] if roof_only else [[p['path'] for p in proofs if p['root']==r.name] for r in roots]
 contact(os.path.join(out,'contact.png'),rows)
 report={'theme':theme,'source':source,'source_sha256':source_sha,'source_unchanged_during_render':sha(source)==source_sha,'finished_source':not roof_only,'triangles':counts,'camera_ortho_scale':cam.data.ortho_scale,'proofs':proofs,'source_modified':False,'game_browser_validation_claimed':False}
 json.dump(report,open(os.path.join(out,'proof-report.json'),'w'),indent=2);print('CIVIC PROOFS COMPLETE '+theme,flush=True)

complete=[t for t in THEMES if os.path.exists(os.path.join(OUT,t,'delivery','proof-report.json'))]
if complete:
 for lod in (0,2):
  rows=[[os.path.join(OUT,t,'delivery',r+'-lod'+str(lod)+'-844x390.png') for r in ('keep','keep-damaged','keep-ruined')] for t in complete]
  contact(os.path.join(OUT,'all-complete-lod'+str(lod)+'.png'),rows)
 print('Complete themes: '+', '.join(complete),flush=True)
sys.stdout.flush();os._exit(0)


