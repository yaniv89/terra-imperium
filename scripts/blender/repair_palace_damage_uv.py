"""Bound lower-LOD face UVs within one matching LOD0 atlas triangle.
For newly built planes/hulls which cannot inherit an entire source surface island.
No atlas, LOD0 geometry or LOD0 UV mutation. Material roles are preserved.
"""
import bpy,math
from mathutils import Vector,kdtree

def repair_lod_uvs(roots):
 report={}
 for root in roots:
  src=next(c for c in root.children if c.type=='MESH' and c.name.split('.')[0]=='LOD0');me=src.data;me.calc_loop_triangles();layer=me.uv_layers.active.data
  triangles=[];groups={}
  for t in me.loop_triangles:
   p=me.polygons[t.polygon_index];points=[me.vertices[i].co.copy() for i in t.vertices];uv=[layer[i].uv.copy() for i in t.loops];center=sum(points,Vector())/3;uc=sum(uv,Vector((0,0)))/3
   radius=min(abs((uv[(i+1)%3]-uv[i]).cross(uc-uv[i]))/max((uv[(i+1)%3]-uv[i]).length,1e-10) for i in range(3))
   if radius<1e-8:continue
   mat=me.materials[p.material_index].name;idx=len(triangles);triangles.append((center,p.normal.copy(),uc,radius,mat,(points[1]-points[0]).cross(points[2]-points[0]).length/2));groups.setdefault(mat,[]).append(idx)
  trees={}
  for mat,indices in groups.items():
   kd=kdtree.KDTree(len(indices))
   for idx in indices:kd.insert(triangles[idx][0],idx)
   kd.balance();trees[mat]=kd
  objrep={}
  for dst in [c for c in root.children if c.type=='MESH' and c!=src]:
   dm=dst.data;dl=dm.uv_layers.active.data;fixed=0
   for p in dm.polygons:
    mat=dm.materials[p.material_index].name
    if mat not in trees:raise RuntimeError('No matching source material '+mat)
    pos=[dm.vertices[dm.loops[i].vertex_index].co.copy() for i in p.loop_indices];center=sum(pos,Vector())/len(pos)
    candidates=trees[mat].find_n(center,min(160,len(groups[mat])))
    large=[c for c in candidates if triangles[c[1]][5]>=max(.0005,p.area*.20)]
    if large:candidates=large
    idx=min(candidates,key=lambda v:v[2]+.20*(1-p.normal.dot(triangles[v[1]][1])))[1]
    sc,sn,uv,radius,_,area=triangles[idx]
    # Circular projection stays entirely inside the triangle's inscribed disc.
    u=(pos[1]-pos[0]).normalized();v=p.normal.cross(u).normalized();xy=[Vector(((q-center).dot(u),(q-center).dot(v))) for q in pos];extent=max(q.length for q in xy)
    scale=min(radius*.62,.0025)/max(extent,1e-9)
    for loop,q in zip(p.loop_indices,xy):dl[loop].uv=uv+q*scale
    fixed+=1
   objrep[dst.name.split('.')[0]]=fixed
  report[root.name]=objrep
 return report


