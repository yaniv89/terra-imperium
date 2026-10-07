"""Keep the delivered African round hall/conical roof silhouette at far LOD."""
import bpy,math
def replace_african_far(roots):
 for root in roots:
  state=2 if root.name.endswith('ruined') else 1 if root.name.endswith('damaged') else 0
  obj=next(c for c in root.children if c.name.split('.')[0]=='LOD2')
  verts=[];faces=[];roles=[]
  def face(points,role=0,both=False):
   start=len(verts);verts.extend(points);faces.append(tuple(range(start,len(verts))));roles.append(role)
   if both:face(points[::-1],role)
  def ring(x,y,rx,ry,h,n):
   for i in range(n):
    a=2*math.pi*i/n;b=2*math.pi*(i+1)/n
    x1,y1=x+rx*math.cos(a),y+ry*math.sin(a);x2,y2=x+rx*math.cos(b),y+ry*math.sin(b)
    face([(x1,y1,0),(x2,y2,0),(x2,y2,h),(x1,y1,h)],both=True)
  def cone(x,y,rx,ry,z,h,n,broken=False):
   for i in range(n):
    if broken and i in (0,1):continue
    a=2*math.pi*i/n;b=2*math.pi*(i+1)/n
    face([(x+rx*math.cos(a),y+ry*math.sin(a),z),(x+rx*math.cos(b),y+ry*math.sin(b),z),(x,y,z+h)])
  h=(.62,.45,.16)[state];ring(0,.28,.62,.39,h,8);ring(-.61,-.35,.23,.22,h*.68,6)
  for x1,y1,x2,y2 in ((-.92,-.85,-.92,.85),(.92,-.85,.92,.85),(-.92,.85,.92,.85),(-.92,-.85,-.35,-.85),(.35,-.85,.92,-.85)):
   face([(x1,y1,0),(x2,y2,0),(x2,y2,.15),(x1,y1,.15)],both=True)
  if state<2:
   cone(0,.28,.7,.45,h,.3,8,state==1);cone(-.61,-.35,.27,.26,h*.68,.15,6)
   face([(-.25,-.35,.38),(.25,-.35,.38),(.25,-.11,.38),(-.25,-.11,.38)],1)
  else:
   p=[(-.31,.04,0),(.34,.04,0),(.34,.5,0),(-.31,.5,0)]
   for i in range(4):face([p[i],p[(i+1)%4],(0,.26,.13)])
  old=obj.data;me=bpy.data.meshes.new('African far silhouette');me.from_pydata(verts,[],faces);me.uv_layers.new(name='UVMap')
  me.materials.append(bpy.data.materials['Town']);me.materials.append(bpy.data.materials['Team'])
  for p,role in zip(me.polygons,roles):p.material_index=role
  obj.data=me;bpy.data.meshes.remove(old)
