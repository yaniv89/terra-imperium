"""Retain one readable charred roof beam at far LOD using an existing dark atlas island."""
import bpy,bmesh,math
from mathutils import Vector

def add_far_charred_beams(roots,level='LOD2'):
 for r in roots:
  src=next(c for c in r.children if c.type=='MESH' and c.name.split('.')[0]=='LOD0');dst=next(c for c in r.children if c.type=='MESH' and c.name.split('.')[0]==level)
  small='small' in r.name;ruin='ruined' in r.name
  target=Vector((-.07,.02,.25) if small and ruin else (0,.1,.58) if ruin else (.08,-.1,.43) if small else (.12,.12,1.17))
  base=next(n.image for n in bpy.data.materials['Town'].node_tree.nodes if n.type=='TEX_IMAGE' and '_base' in n.image.name);pixels=base.pixels[:];w,h=base.size
  src.data.calc_loop_triangles();uvs=src.data.uv_layers.active.data;candidates=[]
  for t in src.data.loop_triangles:
   p=src.data.polygons[t.polygon_index]
   if src.data.materials[p.material_index].name!='Town':continue
   uv=[uvs[i].uv.copy() for i in t.loops];center=sum(uv,Vector((0,0)))/3;pixel=(min(h-1,max(0,int(center.y*h)))*w+min(w-1,max(0,int(center.x*w))))*4;light=sum(pixels[pixel:pixel+3])/3
   if light>.22:continue
   co=sum((src.data.vertices[i].co for i in t.vertices),Vector())/3
   candidates.append(((co-target).length,uv,center))
  assert candidates,'No dark source atlas region for charred beam'
  _,uv,center=min(candidates,key=lambda x:x[0]);radius=min(abs((uv[(i+1)%3]-uv[i]).cross(center-uv[i]))/max((uv[(i+1)%3]-uv[i]).length,1e-9) for i in range(3))*.35
  group=dst.vertex_groups.get('FarCharredBeam')
  if not group:
   old=len(dst.data.vertices);bm=bmesh.new();bm.from_mesh(dst.data);box=[]
   if level=='LOD1':
    for xyz in ((-.5,-.5,-.5),(-.5,.5,-.5),(-.5,0,.5),(.5,-.5,-.5),(.5,.5,-.5),(.5,0,.5)):box.append(bm.verts.new(xyz))
    for face in ((0,1,2),(3,5,4),(0,3,4,1),(1,4,5,2),(2,5,3,0)):bm.faces.new([box[i] for i in face])
   else:box=bmesh.ops.create_cube(bm,size=1)['verts']
   angle=.35;length=.18 if small else .26
   for v in box:
    x,y=v.co.x*length,v.co.y*.018;v.co=target+Vector((x*math.cos(angle)-y*math.sin(angle),x*math.sin(angle)+y*math.cos(angle),(v.co.z+.5)*.018))
   mi=next(i for i,m in enumerate(dst.data.materials) if m.name=='Town')
   for f in bm.faces:
    if all(v in box for v in f.verts):f.material_index=mi
   bm.normal_update();bm.to_mesh(dst.data);bm.free();group=dst.vertex_groups.new(name='FarCharredBeam');group.add(list(range(old,len(dst.data.vertices))),1,'REPLACE')
  indices={v.index for v in dst.data.vertices if any(g.group==group.index for g in v.groups)};layer=dst.data.uv_layers.active.data
  for p in dst.data.polygons:
   if set(p.vertices)<=indices:
    for k,loop in enumerate(p.loop_indices):layer[loop].uv=center+Vector((math.cos(k*2*math.pi/len(p.loop_indices)),math.sin(k*2*math.pi/len(p.loop_indices))))*radius

