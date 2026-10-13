"""RLP-only geometry, CPU baking, export and proof helpers. Original, CC0-1.0.
No monkey-patching of ti_map/ti_town, no binary GLB edits, no external texture inputs.
"""
import hashlib
import importlib.util
import json
import math
import os
from pathlib import Path
import shutil
import sys
import subprocess

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
import ti_map as tm

THREADS=4
MATERIALS={
 'rlp_canvas':(['#c9b797','#dbcbb0'],.92,0),
 'rlp_rope':(['#b4a07e','#d7c29b'],.94,0),
 'rlp_clay':(['#bd8764','#d4a079'],.86,0),
 'rlp_wood':(['#ac8c69','#c1a27d'],.88,0),
 'rlp_wood_light':(['#c0a17e','#d5ba94'],.9,0),
 'rlp_wood_dark':(['#a38d72','#bca184'],.91,0),
 'rlp_stone':(['#b8b3a4','#d4cdbb'],.92,0),
 'rlp_char':(['#62594e','#877969'],.98,0),
 'rlp_ash':(['#7c756c','#9b9184'],.98,0),
 'rlp_steel':(['#a7b0aa','#bec4be'],.75,.2),
 'rlp_steel_light':(['#c0c7bc','#d1d4c9'],.7,.2),
 'rlp_olive':(['#9da38a','#b9bda5'],.86,.05),
 'rlp_glass':(['#687b80','#8b9b99'],.58,0),
}

def configure_threads(count):
 global THREADS
 THREADS=min(4,max(1,count))
 if hasattr(os,'sched_getaffinity'):
  os.sched_setaffinity(0,set(sorted(os.sched_getaffinity(0))[-THREADS:]))
 for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','LP_NUM_THREADS']:os.environ[key]=str(THREADS)


def rod(ms,mat,a,b,r=.004,segments=6):
 a,b=Vector(a),Vector(b);bm=bmesh.new()
 bmesh.ops.create_cone(bm,cap_ends=True,cap_tris=False,segments=segments,radius1=r,radius2=r,depth=(b-a).length)
 transform=Matrix.Translation((a+b)*.5)@(b-a).to_track_quat('Z','Y').to_matrix().to_4x4()
 ms.add(bm,mat,2,transform)


def torus(ms,mat,at,major,minor,around=10,tube=3):
 bm=bmesh.new();rows=[]
 for i in range(around):
  a=math.tau*i/around;rows.append([bm.verts.new((at[0]+(major+minor*math.cos(math.tau*j/tube))*math.cos(a),at[1]+(major+minor*math.cos(math.tau*j/tube))*math.sin(a),at[2]+minor*math.sin(math.tau*j/tube))) for j in range(tube)])
 for i in range(around):
  for j in range(tube):bm.faces.new([rows[i][j],rows[(i+1)%around][j],rows[(i+1)%around][(j+1)%tube],rows[i][(j+1)%tube]])
 bm.normal_update();ms.add(bm,mat,2)


def slab(ms,mat,points,thickness):
 bm=bmesh.new();verts=[bm.verts.new(p) for p in points];face=bm.faces.new(verts);bm.normal_update()
 direction=face.normal.copy()*-thickness
 result=bmesh.ops.extrude_face_region(bm,geom=[face]);moved=[v for v in result['geom'] if isinstance(v,bmesh.types.BMVert)]
 bmesh.ops.translate(bm,vec=direction,verts=moved);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);ms.add(bm,mat,2)


def overlay_patch(ms,segments,rx,ry):
 bm=bmesh.new();centre=bm.verts.new((0,0,.001));rings=[]
 for radius in [.88,1]:
  rings.append([bm.verts.new((rx*radius*(1+.10*math.sin(3*t)+.055*math.sin(7*t))*math.cos(t),ry*radius*(1+.10*math.sin(3*t)+.055*math.sin(7*t))*math.sin(t),.001)) for t in [math.tau*i/segments for i in range(segments)]])
 for i in range(segments):
  j=(i+1)%segments;bm.faces.new([centre,rings[0][i],rings[0][j]])
  bm.faces.new([rings[0][i],rings[1][i],rings[1][j],rings[0][j]])
 ms.add(bm,'rlp_ground',2)


def hull(ms,mat,x,y,length,width,modern=False,level=0,height=.16):
 bm=bmesh.new();rows=[]
 stations=[(-.5,.80),(-.28,1),(.26,1),(.5,.85)] if modern else [(-.5,.08),(-.32,.70),(0,1),(.30,.90),(.5,.26)]
 for along,fraction in stations:
  upper=width*fraction*.5;lower=upper*.55;bottom=height*.07 if abs(along)>.4 else 0
  rows.append([bm.verts.new((x-upper,y+length*along,height)),bm.verts.new((x-lower,y+length*along,bottom)),bm.verts.new((x+lower,y+length*along,bottom)),bm.verts.new((x+upper,y+length*along,height))])
 for first,second in zip(rows,rows[1:]):
  for i in range(3):bm.faces.new([first[i],first[i+1],second[i+1],second[i]])
 # The modern bow remains open for its lowered ramp; the stern has a transom.
 if not modern:bm.faces.new(list(reversed(rows[0])))
 bm.faces.new(rows[-1]);bm.normal_update();ms.add(bm,mat,2)


def make_materials():
 for name,(colours,rough,metal) in MATERIALS.items():
  tm.mat_simple(name,colours,scale=45,rough=rough,bump=.12,metal=metal)
 tm.mat_team('rlp_team')
 tm.mat_simple('rlp_ground',['#3e3a32','#62594c','#272624'],scale=65,rough=.98,bump=.16)
 mat=bpy.data.materials['rlp_ground'];nodes=mat.node_tree.nodes;links=mat.node_tree.links
 attr=nodes.new('ShaderNodeVertexColor');attr.layer_name='rlp_edge'
 links.new(attr.outputs['Alpha'],nodes.get('Principled BSDF').inputs['Alpha'])
 return list(MATERIALS)+['rlp_team','rlp_ground']


def edge_alpha(obj):
 attr=obj.data.color_attributes.new(name='rlp_edge',type='FLOAT_COLOR',domain='CORNER')
 counts={}
 for polygon in obj.data.polygons:
  if obj.data.materials[polygon.material_index].name!='rlp_ground':continue
  for edge in polygon.edge_keys:counts[edge]=counts.get(edge,0)+1
 boundary={vertex for edge,count in counts.items() if count==1 for vertex in edge}
 for polygon in obj.data.polygons:
  ground=obj.data.materials[polygon.material_index].name=='rlp_ground'
  for index in polygon.loop_indices:
   vertex=obj.data.loops[index].vertex_index
   attr.data[index].color=(1,1,1,0 if ground and vertex in boundary else 1)


def bake_maps(obj,size=1024):
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=THREADS
 bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj
 maps={};mats=list(obj.data.materials)
 def run(channel,kind,noncolor=True,outputs=None,samples=1):
  print('RLP_BAKE_START',obj.name,channel,flush=True)
  image=tm._img('rlp_bake_'+channel,size,alpha=True,non_color=noncolor);restore=[]
  if outputs:
   for mat in mats:
    nodes,links=mat.node_tree.nodes,mat.node_tree.links;bs=nodes.get('Principled BSDF');out=next(n for n in nodes if n.type=='OUTPUT_MATERIAL')
    previous=out.inputs['Surface'].links[0].from_socket;emit=nodes.new('ShaderNodeEmission');socket=bs.inputs[outputs]
    if socket.is_linked:links.new(socket.links[0].from_socket,emit.inputs['Color'])
    else:
     val=socket.default_value;emit.inputs['Color'].default_value=tuple(val) if hasattr(val,'__len__') else (val,val,val,1)
    links.new(emit.outputs[0],out.inputs['Surface']);restore.append((mat,out,previous,emit))
  tm._bake_target_nodes(mats,image);s.cycles.samples=samples
  bpy.ops.object.bake(type=kind,margin=8,use_clear=True)
  data=np.empty(size*size*4,np.float32);image.pixels.foreach_get(data);maps[channel]=data.reshape(size,size,4)[::-1].copy()
  for mat,out,previous,emit in restore:mat.node_tree.links.new(previous,out.inputs['Surface']);mat.node_tree.nodes.remove(emit)
  for mat in mats:
   n=mat.node_tree.nodes.get('_bake')
   if n:mat.node_tree.nodes.remove(n)
  bpy.data.images.remove(image)
 run('color','EMIT',False,'Base Color');run('rough','EMIT',True,'Roughness');run('metal','EMIT',True,'Metallic');run('alpha','EMIT',True,'Alpha')
 run('normal','NORMAL');run('ao','AO',samples=24)
 return maps


def final_material(role,images):
 mat=bpy.data.materials.new(role);mat.use_nodes=True;nodes,links=mat.node_tree.nodes,mat.node_tree.links;bs=nodes.get('Principled BSDF')
 tex=[]
 for image in images:
  n=nodes.new('ShaderNodeTexImage');n.image=image;tex.append(n)
 links.new(tex[0].outputs['Color'],bs.inputs['Base Color'])
 normal=nodes.new('ShaderNodeNormalMap');links.new(tex[1].outputs['Color'],normal.inputs['Color']);links.new(normal.outputs[0],bs.inputs['Normal'])
 sep=nodes.new('ShaderNodeSeparateColor');links.new(tex[2].outputs['Color'],sep.inputs['Color']);links.new(sep.outputs['Green'],bs.inputs['Roughness']);links.new(sep.outputs['Blue'],bs.inputs['Metallic'])
 # No runtime AO node: actual AO is stored in R and already modulates basecolour once.
 if role=='Ground':
  clip=nodes.new('ShaderNodeMath');clip.operation='ROUND';links.new(tex[0].outputs['Alpha'],clip.inputs[0]);links.new(clip.outputs[0],bs.inputs['Alpha'])
  if hasattr(mat,'blend_method'):mat.blend_method='CLIP'
  if hasattr(mat,'alpha_threshold'):mat.alpha_threshold=.5
  if hasattr(mat,'surface_render_method'):mat.surface_render_method='DITHERED'
  mat.use_backface_culling=False
 return mat


def unwrap_delivery(obj,size=1024):
 # Unique face charts with geometric coordinates and fixed ten-pixel gutters.
 # A deterministic shelf layout avoids the native concave nesting search.
 charts=[];margin=10/size;minimum=8/size
 for p in obj.data.polygons:
  coords=[obj.data.vertices[obj.data.loops[k].vertex_index].co for k in p.loop_indices]
  edges=[coords[(i+1)%len(coords)]-v for i,v in enumerate(coords)]
  u=max(edges,key=lambda edge:edge.length_squared).normalized();v=p.normal.cross(u).normalized()
  points=[Vector((co.dot(u),co.dot(v))) for co in coords]
  lo=Vector((min(pt.x for pt in points),min(pt.y for pt in points)));hi=Vector((max(pt.x for pt in points),max(pt.y for pt in points)))
  charts.append((p,points,lo,hi-lo))
 def pack(density):
  sizes=[(max(minimum,c[3].x*density)+2*margin,max(minimum,c[3].y*density)+2*margin,i) for i,c in enumerate(charts)]
  sizes.sort(key=lambda t:(-t[1],-t[0],t[2]));x=y=row=0;placements={}
  for w,h,i in sizes:
   if w>1 or h>1:return None
   if x+w>1+1e-9:x=0;y+=row;row=0
   if y+h>1+1e-9:return None
   placements[i]=(x+margin,y+margin);x+=w;row=max(row,h)
  return placements
 lo=0;hi=1
 if pack(0) is None:raise RuntimeError('Too many face charts for atlas gutters')
 while pack(hi) is not None:hi*=2
 for _ in range(24):
  mid=(lo+hi)/2
  if pack(mid) is not None:lo=mid
  else:hi=mid
 places=pack(lo*.99);uv=obj.data.uv_layers.new(name='DeliveryUV')
 for i,(p,points,origin,extent) in enumerate(charts):
  factors=Vector((max(minimum,extent.x*lo*.99)/max(extent.x,1e-12),max(minimum,extent.y*lo*.99)/max(extent.y,1e-12)))
  for loop,point in zip(p.loop_indices,points):
   delta=point-origin;uv.data[loop].uv=Vector(places[i])+Vector((delta.x*factors.x,delta.y*factors.y))
 obj.data.uv_layers.active=uv


def atlas_uv(src,dst):
 # Each face samples a tiny, same-material patch; no interpolation across atlas islands.
 uv=dst.data.uv_layers.new(name='DeliveryUV');srcuv=src.data.uv_layers.active
 bymat={}
 for p in src.data.polygons:
  bymat.setdefault(src.data.materials[p.material_index].name,[]).append(p)
 for p in dst.data.polygons:
  candidates=bymat[dst.data.materials[p.material_index].name]
  best=max(q.normal.dot(p.normal) for q in candidates)
  aligned=[q for q in candidates if q.normal.dot(p.normal)>=best-.06]
  q=min(aligned,key=lambda q:(q.center-p.center).length_squared)
  point=sum((srcuv.data[k].uv for k in q.loop_indices),Vector((0,0)))/len(q.loop_indices)
  for index,k in enumerate(p.loop_indices):
   angle=math.tau*index/len(p.loop_indices);uv.data[k].uv=point+Vector((math.cos(angle),math.sin(angle)))*.00015


def render_proof(body,out):
 s=bpy.context.scene
 for obj in s.objects:
  if obj.type=='MESH':obj.hide_render=obj!=body
 s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=24;s.cycles.use_denoising=False;s.render.threads_mode='FIXED';s.render.threads=THREADS
 s.render.resolution_x=844;s.render.resolution_y=390;s.render.resolution_percentage=100;s.view_settings.view_transform='AgX';s.view_settings.exposure=.7
 s.world=bpy.data.worlds.new('rlp_proof_sky');s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs['Color'].default_value=(.776,.855,.93,1);s.world.node_tree.nodes['Background'].inputs['Strength'].default_value=.65
 for name,kind,pos,power,color in [('rlp_sun','SUN',(22,10,38),2.4,(1,.799,.54)),('rlp_bounce','AREA',(0,-2,.1),30,(.102,.080,.05))]:
  light=bpy.data.lights.new(name,kind);light.energy=power;light.color=color
  if kind=='AREA':light.shape='DISK';light.size=4
  else:light.angle=math.radians(2)
  obj=bpy.data.objects.new(name,light);s.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(-obj.location).to_track_quat('-Z','Y').to_euler()
 target=Vector((0,0,body.dimensions.z*.45));cam=bpy.data.objects.new('rlp_camera',bpy.data.cameras.new('rlp_camera'));s.collection.objects.link(cam)
 cam.location=target+Vector((1,-1,1.25)).normalized()*max(6,max(body.dimensions)*5);cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO'
 basis=cam.rotation_euler.to_matrix();points=[basis.transposed()@(Vector(c)-cam.location) for c in body.bound_box];lo=[min(p[i] for p in points) for i in range(2)];hi=[max(p[i] for p in points) for i in range(2)]
 cam.data.ortho_scale=max(hi[0]-lo[0],(hi[1]-lo[1])*844/390)*1.15;cam.location+=basis@Vector(((lo[0]+hi[0])/2,(lo[1]+hi[1])/2,0));s.camera=cam
 s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.filepath=str(out/'preview.png');bpy.ops.render.render(write_still=True)


def build_one(ident,layout,contract,out,sheet_hash,sheet_notes,repo,install=False):
 out=Path(out)/ident;out.mkdir(parents=True,exist_ok=True)
 target=repo/contract['target'];prior_report=out/'source-audit.json';prior_hash=json.loads(prior_report.read_text()).get('sha256') if prior_report.is_file() else None
 if install and target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=prior_hash:raise FileExistsError('Refusing to overwrite an unowned or changed target: '+str(target))
 print('RLP_BEGIN',ident,'scene_threads',THREADS,flush=True)
 bpy.ops.wm.read_factory_settings(use_empty=True);names=make_materials();s=bpy.context.scene
 raw=[]
 seed=8100+sum(ord(c) for c in ident)
 helper=sys.modules[__name__]
 for level in range(3):
  ms=tm.Mesher();layout(ms,level,tm.seeded(seed),helper);obj=ms.build('LOD'+str(level),level,names)
  for part,*_ in ms.parts:part.free()
  if not obj.data.vertices:raise RuntimeError('Empty LOD')
  raw.append(obj)
 lo=[min(v.co[i] for v in raw[0].data.vertices) for i in range(3)];hi=[max(v.co[i] for v in raw[0].data.vertices) for i in range(3)]
 shift=Vector((-(lo[0]+hi[0])/2,-(lo[1]+hi[1])/2,-lo[2]))
 for obj in raw:
  for v in obj.data.vertices:v.co+=shift
  for p in obj.data.polygons:p.use_smooth=False
  obj.data.update()
 counts={obj.name:tm.triangles(obj) for obj in raw}
 for level,cap in enumerate(contract['caps']):
  if counts['LOD'+str(level)]>cap:raise RuntimeError(f'{ident}: LOD{level} exceeds local cap {cap}: {counts}')
 for obj in raw:
  used=sorted({p.material_index for p in obj.data.polygons});materials=[obj.data.materials[i] for i in used];indices={old:new for new,old in enumerate(used)};faces=[indices[p.material_index] for p in obj.data.polygons]
  obj.data.materials.clear()
  for material in materials:obj.data.materials.append(material)
  for polygon,index in zip(obj.data.polygons,faces):polygon.material_index=index
 print('RLP_GEOMETRY',ident,counts,'used_materials',len(raw[0].data.materials),flush=True)
 # Edge alpha coordinates are local to the field footprint, shifted with the geometry.
 edge_alpha(raw[0]);print('RLP_UV_START',ident,flush=True);unwrap_delivery(raw[0]);print('RLP_UV_DONE',ident,flush=True);raw[0].data.uv_layers.active.name='DeliveryUV'
 original=raw[0].copy();original.data=raw[0].data.copy();original.name='rlp_editable_source'
 source_collection=bpy.data.collections.new('RLP_EditableSource');s.collection.children.link(source_collection);source_collection.objects.link(original);source_collection.hide_render=True;source_collection.hide_viewport=True
 for obj in raw[1:]:obj.hide_render=True
 maps=bake_maps(raw[0]);base=maps['color'].copy();base[...,:3]*=.82+.18*maps['ao'][...,0:1];base[...,3]=maps['alpha'][...,0]
 orm=np.zeros_like(base);orm[...,0]=maps['ao'][...,0];orm[...,1]=maps['rough'][...,0];orm[...,2]=maps['metal'][...,0];orm[...,3]=1
 maps_out=[base,maps['normal'],orm];images=[]
 for label,data,noncolor in zip(['basecolor','normal','orm'],maps_out,[False,True,True]):
  image=tm.image_from_array(ident+'_'+label,data,'PNG',non_color=noncolor);image.filepath_raw=str(out/(label+'.png'));image.save();image.pack();images.append(image)
 for obj in raw[1:]:atlas_uv(raw[0],obj)
 finals={role:final_material(role,images) for role in ['Town','Ground','Team']}
 for obj in raw:
  roles=['Team' if m.name=='rlp_team' else 'Ground' if m.name=='rlp_ground' else 'Town' for m in obj.data.materials]
  indices=[['Town','Ground','Team'].index(roles[p.material_index]) for p in obj.data.polygons]
  obj.data.materials.clear()
  for role in ['Town','Ground','Team']:obj.data.materials.append(finals[role])
  for p,index in zip(obj.data.polygons,indices):p.material_index=index
  for attr in list(obj.data.color_attributes):obj.data.color_attributes.remove(attr)
 root=bpy.data.objects.new(ident,None);s.collection.objects.link(root)
 for obj in raw:obj.parent=root
 sockets=[]
 if ident.startswith('landing-'):
  socket=bpy.data.objects.new('socket-door',None);s.collection.objects.link(socket);socket.parent=root;socket.location=(0,lo[1]+shift.y,0);sockets.append(socket)
 bpy.ops.wm.save_as_mainfile(filepath=str(out/(ident+'.blend')))
 # The current exporter reads ROUND as alpha MASK 0.5, without any binary edits.
 tm.export_glb(str(out/(ident+'.glb')),[root]+raw+sockets)
 validator=repo/'scripts/blender/validate_model.py';spec=importlib.util.spec_from_file_location('rlp_current_validator',validator);validation=importlib.util.module_from_spec(spec);spec.loader.exec_module(validation)
 if validation.main(str(out/(ident+'.glb')),str(out),contract['kind']):raise RuntimeError('Current validator failed')
 document,binary,size=validation.read_glb(str(out/(ident+'.glb')))
 roots=document['scenes'][document.get('scene',0)]['nodes']
 checks={'one_exact_root':len(roots)==1 and document['nodes'][roots[0]].get('name')==ident,'three_1024_atlases':len(document.get('images',[]))==3,'no_vertex_rgb':all(not any(a.startswith('COLOR_') for a in p['attributes']) for m in document['meshes'] for p in m['primitives']),'packed_editable_images':all(image.packed_file for image in images),'no_runtime_double_ao':all('occlusionTexture' not in m for m in document['materials'])}
 checks['uncompressed_meshes']=not any(e in document.get('extensionsUsed',[]) for e in ['KHR_draco_mesh_compression','EXT_meshopt_compression'])
 checks['exact_lods']=sorted(document['nodes'][i].get('name') for i in document['nodes'][roots[0]].get('children',[]) if not document['nodes'][i].get('name','').startswith('socket-'))==['LOD0','LOD1','LOD2']
 checks['normal_and_orm_linked']=all('normalTexture' in m and 'metallicRoughnessTexture' in m.get('pbrMetallicRoughness',{}) for m in document['materials'])
 checks['ground_cutout']=all(m.get('alphaMode')=='MASK' for m in document['materials'] if m.get('name')=='Ground')
 for im in document['images']:
  view=document['bufferViews'][im['bufferView']];data=binary[view.get('byteOffset',0):view.get('byteOffset',0)+view['byteLength']]
  checks['three_1024_atlases']&=validation.image_size(data)==(1024,1024) and im.get('mimeType')=='image/webp'
 if not all(checks.values()):raise RuntimeError('Delivery contract check failed: '+str(checks))
 tone_path=out/'tone.json'
 tone_run=subprocess.run(['node',str(repo/'scripts/art/town-tone.mjs'),'--json',str(out/(ident+'.glb'))],capture_output=True,text=True,check=True,cwd=repo)
 tone=json.loads(tone_run.stdout)[str(out/(ident+'.glb'))];tone_path.write_text(json.dumps(tone,indent=2))
 for role,floor in [('Town',.26),('Team',.30)]:
  if role in tone and (tone[role]['samples']<=0 or tone[role]['effective']<floor):raise RuntimeError(f'{ident}: {role} actual tone below {floor}: {tone[role]}')
 if 'Town' not in tone:raise RuntimeError('No Town tone samples')
 report={'id':ident,'tone':tone,'tone_floors':{'Town':.26,'Team':.30},'target':contract['target'],'status':'built_awaiting_parent_runtime_visual_gate','counts':counts,'local_caps':contract['caps'],'validator_kind':contract['kind'],'auto_kind_warning':'Current validator does not infer battle/props; explicit existing-kind budget plus local cap used.','checks':checks,'atlas':1024,'ao':'Actual CPU Cycles AO: base *= (0.82 + 0.18 * AO), exactly once; ORM R retains raw AO.','threads':THREADS,'sheet_sha256':sheet_hash,'sheet_notes':sheet_notes,'bytes':size,'license':'CC0-1.0','sha256':hashlib.sha256((out/(ident+'.glb')).read_bytes()).hexdigest()}
 source_files=[repo/'scripts/blender/build_raid_landing_props.py',repo/'scripts/blender/raid_landing_support.py',repo/'scripts/blender/ti_map.py',validator]
 report['source_files']={str(path.relative_to(repo)):hashlib.sha256(path.read_bytes()).hexdigest() for path in source_files}
 for path in source_files:shutil.copy2(path,out/path.name)
 report['rebuild']='OMP_NUM_THREADS=4 OPENBLAS_NUM_THREADS=4 /tmp/bpyenv/bin/python '+str(source_files[0])+' '+str(out.parent)+' --sheet <corrected-sheet.png> --sheet-review <review.json> --only '+ident+' --threads 4'
 (out/'source-audit.json').write_text(json.dumps(report,indent=2));render_proof(raw[0],out)
 if install:
  target=repo/contract['target']
  if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest()!=prior_hash:raise FileExistsError('Target changed during build: '+str(target))
  shutil.copy2(out/(ident+'.glb'),target)
 print('RLP_DELIVERED',ident,counts,flush=True)
