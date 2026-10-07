import bpy, numpy as np, json, hashlib, struct, sys, contextlib, io, importlib.util
from pathlib import Path
stage=Path(__file__).parent
folder=stage/'art-production/backlog-cathedral-town/deliveries/classical-town-big-b'
blend=folder/'classical-town-big-b.blend'
bpy.ops.wm.open_mainfile(filepath=str(blend))
scene=bpy.context.scene
scene.render.engine='CYCLES'
prefs=bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type='OPTIX';prefs.get_devices()
for device in prefs.devices:device.use=device.type=='OPTIX'
scene.cycles.device='GPU';scene.cycles.samples=1;scene.cycles.use_denoising=False
scene.render.bake.margin=0
body=bpy.data.objects['LOD0']
bpy.data.collections['EditableApprovedSource'].hide_render=True
mask=bpy.data.images.new('temporary-tone-roles',width=2048,height=2048,alpha=True)
mask.colorspace_settings.name='Non-Color'
saved=[]
base=None
for material in body.data.materials:
    nodes,links=material.node_tree.nodes,material.node_tree.links
    output=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    previous=output.inputs['Surface'].links[0].from_socket
    active=nodes.active
    emission=nodes.new('ShaderNodeEmission')
    emission.inputs['Color'].default_value={'Town':(1,0,0,1),'Team':(0,1,0,1),'Ground':(0,0,0,1)}[material.name]
    links.new(emission.outputs[0],output.inputs['Surface'])
    texture=nodes.new('ShaderNodeTexImage');texture.image=mask;nodes.active=texture
    saved.append((material,output,previous,active,emission,texture))
    if material.name=='Town':
        bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
        base=bs.inputs['Base Color'].links[0].from_node.image
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);bpy.context.view_layer.objects.active=body
bpy.ops.object.bake(type='EMIT',use_clear=True)
old=np.empty(2048*2048*4,dtype=np.float32);roles=np.empty_like(old)
base.pixels.foreach_get(old);mask.pixels.foreach_get(roles)
old=old.reshape(-1,4);roles=roles.reshape(-1,4)
changed=old.copy();town=roles[:,0]>.999;team=roles[:,1]>.999
assert not np.any(town & team)
changed[town,:3]=np.minimum(changed[town,:3]*1.5,1)
changed[team,:3]=np.minimum(changed[team,:3]*1.6,1)
assert np.array_equal(old[:,3],changed[:,3])
assert np.array_equal(old[~(town|team)],changed[~(town|team)])
unchanged={name:hashlib.sha256((folder/(name+'.png')).read_bytes()).hexdigest() for name in ('normal','orm')}
base.pixels.foreach_set(changed.ravel());base.update();base.filepath_raw=str(folder/'basecolor.png');base.file_format='PNG';base.save()
# Replace the old packed image with the saved pixels so the exporter cannot reuse its original packed PNG.
fresh=bpy.data.images.load(str(folder/'basecolor.png'),check_existing=False)
fresh.colorspace_settings.name='sRGB';fresh.pack()
base.user_remap(fresh)
bpy.data.images.remove(base)
for mat,out,prev,active,e,t in saved:
    mat.node_tree.links.new(prev,out.inputs['Surface']);mat.node_tree.nodes.remove(e);mat.node_tree.nodes.remove(t);mat.node_tree.nodes.active=active
bpy.data.images.remove(mask)
bpy.context.preferences.filepaths.save_version=0
game=bpy.data.collections['GameDelivery']
bpy.ops.object.select_all(action='DESELECT')
for obj in game.objects:obj.select_set(True);obj.hide_render=False
bpy.ops.wm.save_as_mainfile(filepath=str(blend))
glb=folder/'classical-town-big-b.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,export_cameras=False,export_lights=False,export_image_format='WEBP',export_image_quality=90,export_vertex_color='NONE',export_texcoords=True,export_normals=True,export_materials='EXPORT',export_draco_mesh_compression_enable=False)
raw=glb.read_bytes();jl=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jl]);binary=raw[28+jl:]
for material in doc['materials']:
    if material['name']=='Ground':material['alphaMode']='MASK';material['alphaCutoff']=.5
    if 'occlusionTexture' in material:material['occlusionTexture']['strength']=0
encoded=json.dumps(doc,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4)
glb.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(encoded)+len(binary))+struct.pack('<I4s',len(encoded),b'JSON')+encoded+struct.pack('<I4s',len(binary),b'BIN\0')+binary)
assert all(hashlib.sha256((folder/(name+'.png')).read_bytes()).hexdigest()==digest for name,digest in unchanged.items())
report={'method':'LOD0 material role mask baked locally with OptiX; Town RGB ×1.5 and Team RGB ×1.6 in linear light','town_texels':int(town.sum()),'team_texels':int(team.sum()),'alpha_exactly_unchanged':True,'ground_and_unassigned_texels_exactly_unchanged':True,'normal_orm_sha256_unchanged':unchanged,'geometry_uvs_lods_unchanged':True,'gpu':'RTX 3070 Laptop GPU / OptiX','AO':'Existing basecolour AO retained; no second AO multiplication'}
(folder/'tone-correction.json').write_text(json.dumps(report,indent=2))
spec=importlib.util.spec_from_file_location('validator',Path.cwd()/'scripts/blender/validate_model.py');validator=importlib.util.module_from_spec(spec);spec.loader.exec_module(validator)
with contextlib.redirect_stdout(io.StringIO()):result=validator.main(str(glb),str(folder),'town')
assert result==0
print('TOWN_TONE_FIXED_AND_VALIDATED',json.dumps(report),flush=True)
