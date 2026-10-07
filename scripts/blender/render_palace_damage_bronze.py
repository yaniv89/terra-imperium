import bpy,sys,os,numpy as np
from mathutils import Vector
BASE=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'));sys.path.insert(0,os.path.join(BASE,'scripts/blender'));import ti_map as tm
OUT=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else os.path.join(BASE,'art-build/palace-damage-bronze');bpy.ops.wm.open_mainfile(filepath=os.path.join(OUT,'palace-damage-bronze.blend'))
roots=sorted([o for o in bpy.context.scene.objects if o.type=='EMPTY' and not o.parent],key=lambda r:('small' in r.name,'ruined' in r.name))
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=16;scene.render.threads_mode='FIXED';scene.render.threads=8
prefs=bpy.context.preferences.addons['cycles'].preferences;prefs.compute_device_type='OPTIX';prefs.get_devices()
for dev in prefs.devices:dev.use=dev.type=='OPTIX'
scene.cycles.device='GPU';scene.world=bpy.data.worlds.new('Bright mobile studio');scene.world.use_nodes=True;bg=scene.world.node_tree.nodes.get('Background');bg.inputs['Color'].default_value=(.65,.69,.74,1);bg.inputs['Strength'].default_value=.6
for loc,power,size in [((3,-4,6),600,5),((-4,-1,3),400,4)]:
 bpy.ops.object.light_add(type='AREA',location=loc);bpy.context.object.data.energy=power;bpy.context.object.data.size=size
bpy.ops.object.camera_add(location=(2.6,-3.8,2.7));cam=bpy.context.object;cam.data.type='ORTHO';scene.camera=cam
scene.render.resolution_x=844;scene.render.resolution_y=390;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG'
contact=np.zeros((390*4,844*3,4),dtype=np.float32)
for row,r in enumerate(roots):
 target=Vector((0,.08,.65 if r.name=='palace-damaged' else .3));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.ortho_scale=4.7 if r.name=='palace-damaged' else 3.1 if r.name=='palace-ruined' else 2.5
 for lod in range(3):
  for root in roots:
   for c in root.children:c.hide_render=root!=r or c.name.split('.')[0]!='LOD'+str(lod)
  path=os.path.join(OUT,r.name+'-lod'+str(lod)+'-844x390.png');scene.render.filepath=path
  if not ('--reuse-lod0' in sys.argv and lod==0 and os.path.exists(path)):bpy.ops.render.render(write_still=True)
  img=bpy.data.images.load(path,check_existing=False);arr=np.array(img.pixels[:],dtype=np.float32).reshape(390,844,4)[::-1];contact[row*390:(row+1)*390,lod*844:(lod+1)*844]=arr;bpy.data.images.remove(img)
im=tm.image_from_array('palace-damage-mobile-contact',contact,'PNG');im.filepath_raw=os.path.join(OUT,'mobile-contact.png');im.save();print('TEXTURED MOBILE PROOFS COMPLETE',flush=True);sys.stdout.flush();os._exit(0)

