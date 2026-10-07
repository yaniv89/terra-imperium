"""Single-thread Cycles phone-size preview; studio never saved into deliverables."""
import os,sys,math,json
from pathlib import Path

import bpy
from mathutils import Vector
path=Path(sys.argv[sys.argv.index('--')+1]).resolve();bpy.ops.wm.open_mainfile(filepath=str(path))
s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='GPU';s.cycles.samples=32;s.cycles.adaptive_threshold=.06;s.cycles.use_denoising=False
s.render.threads_mode='AUTO'
p=bpy.context.preferences.addons['cycles'].preferences;p.compute_device_type='OPTIX';p.get_devices()
for d in p.devices:d.use=d.type=='OPTIX'
s.render.resolution_x=844;s.render.resolution_y=390;s.render.resolution_percentage=100
s.view_settings.view_transform='AgX';s.view_settings.exposure=.7
level=sys.argv[sys.argv.index('--')+2] if len(sys.argv)>sys.argv.index('--')+2 else '0'
body=bpy.data.objects['LOD'+level];framing=bpy.data.objects['LOD0']
for o in s.objects:
 if o.type=='MESH':o.hide_render=o!=body
bpy.data.collections['EditableApprovedSource'].hide_render=True
world=bpy.data.worlds.new('DeliverySky');world.use_nodes=True;s.world=world
world.node_tree.nodes['Background'].inputs['Color'].default_value=(.776,.855,.93,1);world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
def light(name,kind,pos,power,color,size=None):
 data=bpy.data.lights.new(name,kind);data.energy=power;data.color=color
 if size is not None:data.size=size
 o=bpy.data.objects.new(name,data);s.collection.objects.link(o);o.location=pos;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler();return o
sun=light('PreviewSun','SUN',(22,10,38),2.4,(1,.799,.54));sun.data.angle=math.radians(2)
light('PreviewGroundBounce','AREA',(0,-2,.1),30,(.102,.080,.05),4)
target=Vector((0,0,framing.dimensions.z*.43));cam=bpy.data.objects.new('PreviewCamera',bpy.data.cameras.new('PreviewCamera'));s.collection.objects.link(cam)
cam.location=target+Vector((1,-1,1.25)).normalized()*max(6,max(framing.dimensions)*5);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO'
basis=cam.rotation_euler.to_matrix();points=[basis.transposed()@(framing.matrix_world@Vector(c)-cam.location) for c in framing.bound_box]
low=[min(p[i] for p in points) for i in range(2)];high=[max(p[i] for p in points) for i in range(2)]
cam.data.ortho_scale=max(high[0]-low[0],(high[1]-low[1])*844/390)*1.13
cam.location+=basis@Vector(((low[0]+high[0])/2,(low[1]+high[1])/2,0));s.camera=cam
s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.filepath=str(path.parent/('preview.png' if level=='0' else 'preview-lod'+level+'.png'))
bpy.ops.render.render(write_still=True)
(path.parent/('preview-settings.json' if level=='0' else 'preview-lod'+level+'-settings.json')).write_text(json.dumps({'resolution':[844,390],'samples':32,'device':'OPTIX','gpu':'RTX 3070 Laptop GPU','sun':'#FFE7C2','sky':'#E3EEF8','bounce':'#5A503F','view_transform':'AgX','exposure':.7},indent=2))


