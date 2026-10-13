"""Isolated remaining battle-terrain geometry and delivery helpers.
Uses ti_map.Mesher and the ti_town atlas conventions; never edits shared files.
All dimensions are Blender units (10 m); terrain is true height, not storey-raised.
"""
import bpy
import bmesh
import math
import json
import hashlib
import runpy
import subprocess
from pathlib import Path
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree
import ti_map as tm
import ti_town as tt

PREFIX='btr_'
BUDGETS=(4000,1000,200)
TILE=.36
MATERIALS=('btr_ashlar','btr_wood','btr_endgrain','btr_stone','btr_steel','btr_rust','btr_concrete','btr_soil','btr_grass','btr_water','btr_shallows','btr_fringe')
GROUND={'btr_soil','btr_grass','btr_water','btr_shallows','btr_fringe'}


def register_materials():
    # Registration follows the existing age-kit pattern. This affects only this
    # builder's process, not the shared module files or another worker's process.
    for name in MATERIALS:
        if name not in tt.PROC:tt.PROC.append(name)
    for name in GROUND:tt.TO_FINAL[name]='Ground'
    def make():
        tm.mat_simple('btr_wood',['#A98355','#BE9868','#92734F'],scale=12,stripes={'dir':'Y','scale':120,'distortion':3},rough=.88,bump=.28)
        tm.mat_simple('btr_endgrain',['#CEAF82','#B79A70'],scale=30,rough=.92,bump=.2)
        tm.mat_simple('btr_stone',['#B1AA99','#CAC1AE','#968F80'],scale=24,rough=.92,bump=.35)
        ash=bpy.data.materials.new('btr_ashlar');nt,bs=tm._nodes(ash)
        tc=nt.nodes.new('ShaderNodeTexCoord');sep=nt.nodes.new('ShaderNodeSeparateXYZ');nt.links.new(tc.outputs['Object'],sep.inputs['Vector'])
        add=nt.nodes.new('ShaderNodeMath');add.operation='ADD';nt.links.new(sep.outputs['X'],add.inputs[0]);nt.links.new(sep.outputs['Y'],add.inputs[1])
        coord=nt.nodes.new('ShaderNodeCombineXYZ');nt.links.new(add.outputs[0],coord.inputs[0]);nt.links.new(sep.outputs['Z'],coord.inputs[1])
        bond=nt.nodes.new('ShaderNodeTexBrick');bond.inputs['Scale'].default_value=1;bond.inputs['Brick Width'].default_value=.045;bond.inputs['Row Height'].default_value=.025;bond.inputs['Mortar Size'].default_value=.0009
        for slot,color in [('Color1','#BBB6A8'),('Color2','#C9C2B0'),('Mortar','#8F9083')]:bond.inputs[slot].default_value=tm._srgb(color)
        nt.links.new(coord.outputs[0],bond.inputs['Vector']);nt.links.new(bond.outputs['Color'],bs.inputs['Base Color']);bs.inputs['Roughness'].default_value=.96;tm._bump(nt,bs,bond.outputs['Fac'],.24,.0012)

        tm.mat_simple('btr_steel',['#8E9EA1','#ABB8B9','#798B8F'],scale=35,rough=.57,bump=.12,metal=.65)
        tm.mat_simple('btr_rust',['#AA7753','#936C51'],scale=45,rough=.9,bump=.28,metal=.1)
        tm.mat_simple('btr_concrete',['#A6A89C','#C0C0B0','#96998F'],scale=28,rough=.96,bump=.3)
        tm.mat_simple('btr_soil',['#A18C67','#BCA57D','#8F815E'],scale=35,rough=.96,bump=.2)
        tm.mat_simple('btr_grass',['#81916B','#94A279','#778665'],scale=45,rough=.97,bump=.15)
        tm.mat_simple('btr_water',['#467B85','#538A93','#487F89'],scale=12,rough=.36,bump=.035)
        tm.mat_simple('btr_shallows',['#7A9A92','#93ADA0','#6F928B'],scale=22,rough=.48,bump=.06)
        tm.mat_simple('btr_fringe',['#81916B','#94A279'],scale=40,rough=.97,bump=.12)
    if not any(k=='battle-terrain-remaining' for k,_ in tt.EXTRA_MATERIALS):tt.EXTRA_MATERIALS.append(('battle-terrain-remaining',make))


def polygon(ms,mat,points,lod=2,only=None):
    bm=bmesh.new();verts=[bm.verts.new(p) for p in points];bm.faces.new(verts);bm.normal_update();ms.add(bm,mat,lod,only=only)


def strip(ms,mat,rows,lod=2,only=None):
    """Open upward-facing terrain quad strip. No normal recalc on open banks."""
    bm=bmesh.new();vs=[[bm.verts.new(p) for p in row] for row in rows]
    for a,b in zip(vs,vs[1:]):
        for k in range(len(a)-1):bm.faces.new((a[k],b[k],b[k+1],a[k+1]))
    bm.normal_update();ms.add(bm,mat,lod,only=only)


def prism_beam(ms,mat,a,b,width,depth=None,lod=2,only=None,section='box'):
    """Genuine solid structural extrusion, including far-LOD triangular beams."""
    a,b=Vector(a),Vector(b);direction=(b-a).normalized();u=direction.cross(Vector((0,0,1)))
    if u.length<1e-5:u=Vector((1,0,0))
    u.normalize();v=direction.cross(u).normalized();d=depth or width
    if section=='triangle':profile=[(-width/2,-d/2),(width/2,-d/2),(0,d/2)]
    elif section=='I':
        w,h,t=width/2,d/2,width*.16
        profile=[(-w,-h),(w,-h),(w,-h+t),(t,-h+t),(t,h-t),(w,h-t),(w,h),(-w,h),(-w,h-t),(-t,h-t),(-t,-h+t),(-w,-h+t)]
    else:profile=[(-width/2,-d/2),(width/2,-d/2),(width/2,d/2),(-width/2,d/2)]
    bm=bmesh.new();rings=[[bm.verts.new(p+u*x+v*y) for x,y in profile] for p in (a,b)];n=len(profile)
    for i in range(n):j=(i+1)%n;bm.faces.new((rings[0][i],rings[0][j],rings[1][j],rings[1][i]))
    bm.faces.new(list(reversed(rings[0])));bm.faces.new(rings[1]);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));ms.add(bm,mat,lod,only=only)


def rock(ms,rng,x,y,r=.018,h=.012,lod=1,mat='btr_stone'):
    # Irregular polygonal cobble with a recognisable sloped shoulder, not spheres.
    n=5;angles=[2*math.pi*i/n for i in range(n)];base=[(x+math.cos(a)*r,y+math.sin(a)*r*.76,0) for a in angles]
    top=[(x+math.cos(a)*r*.72,y+math.sin(a)*r*.55,h*(.88+.12*rng.random())) for a in angles]
    bm=bmesh.new();low=[bm.verts.new(p) for p in base];high=[bm.verts.new(p) for p in top]
    for i in range(n):j=(i+1)%n;bm.faces.new((low[i],low[j],high[j],high[i]))
    bm.faces.new(list(reversed(low)));bm.faces.new(high);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));ms.add(bm,mat,lod)


def grass_clump(ms,x,y,z=.027):
    for yaw,h in ((0,.032),(2.2,.041),(4.1,.027)):
        dx,dy=math.cos(yaw)*.009,math.sin(yaw)*.009
        side=Vector((-dy,dx,0)).normalized()*.003
        a=Vector((x,y,z));mid=a+Vector((dx*.4,dy*.4,h*.6));tip=a+Vector((dx,dy,h))
        polygon(ms,'btr_grass',[tuple(a-side),tuple(mid-side*.65),tuple(mid+Vector((0,0,.002))),tuple(a+side)],lod=0)
        polygon(ms,'btr_grass',[tuple(mid-side*.65),tuple(tip),tuple(mid+side*.65)],lod=0)


def bank(ms,rng):
    for level,n in enumerate((10,5,2)):
        rows=[]
        for i in range(n+1):
            x=-TILE/2+TILE*i/n;wobble=.007*math.sin(i/n*math.pi*4)*math.sin(i/n*math.pi)
            rows.append([(x,-.08,.001),(x,-.025+wobble,.003),(x,.005+wobble,.019),(x,.046,.029),(x,.08,.002)])
        # Separate material bands expose shallows, eroded soil and grassy crest.
        for k,mat in enumerate(('btr_shallows','btr_soil','btr_grass','btr_fringe')):strip(ms,mat,[[row[k],row[k+1]] for row in rows],only=(level,))
    for i in range(5):rock(ms,rng,-.14+i*.066,-.018,.023,.025,lod=0)
    for x in (-.12,-.035,.10):grass_clump(ms,x,.055)


def ford(ms,rng):
    # 3.6m square crossing: an unbroken readable stepping route through water,
    # two raised dry margins, and irregular cobbles rather than a gravel grid.
    for level,n in enumerate((16,12,8)):
        pts=[]
        for i in range(n):
            a=2*math.pi*i/n;r=.18/max(abs(math.cos(a)),abs(math.sin(a)))
            r*=.985+.015*math.cos(a*4);pts.append((r*math.cos(a),r*math.sin(a),.001))
        polygon(ms,'btr_shallows',pts,only=(level,))
        for side in (-1,1):
            rows=[]
            for i in range((6,4,2)[level]+1):
                y=-.17+.34*i/(6,4,2)[level]
                rows.append([(side*.125,y,.002),(side*.153,y,.029),(side*.177,y,.002)])
            strip(ms,'btr_soil',[[r[0],r[1]] for r in rows],only=(level,))
            strip(ms,'btr_grass',[[r[1],r[2]] for r in rows],only=(level,))
    def cobble(x,y,r,h,level):
        rock(ms,rng,x,y,r,h,lod=level)
        bm,mat,_,_=ms.parts[-1];ms.parts[-1]=(bm,mat,2,(level,))
        angle=rng.uniform(-.5,.5)
        for v in bm.verts:
            dx,dy=v.co.x-x,v.co.y-y
            v.co.x=x+math.cos(angle)*dx-math.sin(angle)*dy
            v.co.y=y+math.sin(angle)*dx+math.cos(angle)*dy
            if v.co.z>0:v.co.x=x+(v.co.x-x)*rng.uniform(.88,1.08)
    for level,count in ((0,8),(1,6),(2,5)):
        for k in range(count):cobble((-.026 if k%2 else .026),-.14+.28*k/(count-1),.026 if level<2 else .029,.014,level)
    for k in range(4):cobble((-.10 if k%2 else .10),-.12+.08*k,.013,.009,0)
    for side in (-1,1):
        for y in (-.10,.07):grass_clump(ms,side*.151,y,.028)


def river_piece(kind,width_tiles):
    width=width_tiles*TILE;half=width/2;length=width*1.6
    def build(ms,rng):
        for level,n in enumerate((16,8,4)):
            if kind=='bend':
                radius=width*1.1
                path=[(radius*math.cos(math.pi/2*i/n),radius*math.sin(math.pi/2*i/n)) for i in range(n+1)]
            else:path=[(0,-length/2+length*i/n) for i in range(n+1)]
            def side(sign,offset):
                result=[]
                for i,(x,y) in enumerate(path):
                    p0=Vector(path[max(0,i-1)]);p1=Vector(path[min(n,i+1)]);t=(p1-p0).normalized();normal=Vector((t.y,-t.x))
                    result.append((x+normal.x*sign*offset,y+normal.y*sign*offset))
                return result
            if kind=='junction':
                # Nonoverlapping T-shaped water bed: horizontal bar and south stem.
                for x0,x1,y0,y1 in ((-length/2,length/2,-half,half),(-half,half,-length/2,-half)):
                    polygon(ms,'btr_water',[(x0,y0,.001),(x1,y0,.001),(x1,y1,.001),(x0,y1,.001)],only=(level,))
                boundary=[(-length/2,-half),(-half,-half),(-half,-length/2),(half,-length/2),(half,-half),(length/2,-half),(length/2,half),(-length/2,half)]
                # Keep the three river mouths open; shore wraps only dry banks.
                closed={(1,2),(3,4),(4,5),(6,7),(0,1)}
                for i,j in closed:
                    a=Vector(boundary[i]);b=Vector(boundary[j]);d=(b-a).normalized();out=Vector((d.y,-d.x));rows=[]
                    for p in (a,b):rows.append([(p.x,p.y,.001),(p.x+out.x*.07,p.y+out.y*.07,.035),(p.x+out.x*.12,p.y+out.y*.12,.002)])
                    for k,mat in enumerate(('btr_soil','btr_grass')):strip(ms,mat,[[r[k],r[k+1]] for r in rows],only=(level,))
                continue
            left=side(-1,half);right=side(1,half)
            strip(ms,'btr_water',[[(a[0],a[1],.001),(b[0],b[1],.001)] for a,b in zip(left,right)],only=(level,))
            for sign in (-1,1):
                coords=[side(sign,half+off) for off in (0,.055,.10,.14)]
                heights=(.001,.008,.037,.002)
                for k,mat in enumerate(('btr_shallows','btr_soil','btr_grass')):
                    strip(ms,mat,[[(coords[k][i][0],coords[k][i][1],heights[k]),(coords[k+1][i][0],coords[k+1][i][1],heights[k+1])] for i in range(n+1)],only=(level,))
            if kind=='end':
                # Shoaling rounded terminus. An open opposite end joins straight pieces.
                cy=length/2
                pts=[(half*math.cos(math.pi*i/n),cy+half*math.sin(math.pi*i/n),.001) for i in range(n+1)]
                polygon(ms,'btr_shallows',pts,only=(level,))
                rows=[[(x,y,z),(x*1.12,cy+(y-cy)*1.12,.028)] for x,y,z in pts]
                strip(ms,'btr_soil',rows,only=(level,))
        # Recenter each kit piece geometrically without altering its historical profile.
        vs=[v for bm,_,_,_ in ms.parts for v in bm.verts];cx=(min(v.co.x for v in vs)+max(v.co.x for v in vs))/2;cy=(min(v.co.y for v in vs)+max(v.co.y for v in vs))/2
        for v in vs:v.co.x-=cx;v.co.y-=cy
    return build


def deck_height(material,y):
    if material=='steel':return .055
    return .015+(.10 if material=='wood' else .23)*math.sin(math.pi*(y+.72)/1.44)


def approach(ms,material):
    # Only local ragged approach lips, never a square foundation plinth.
    for s in (-1,1):
        y=s*.72;polygon(ms,'btr_soil',[(-.20,y-s*.10,.002),(.20,y-s*.10,.002),(.22,y,.001),(.12,y+s*.025,.001),(-.17,y+s*.021,.001),(-.22,y,.001)])


def bridge(material,state):
    def build(ms,rng):
        damaged=state=='damaged';destroyed=state=='destroyed';deckmat={'wood':'btr_wood','stone':'btr_ashlar','steel':'btr_concrete'}[material]
        approach(ms,material)
        for level,n in enumerate((32,12,4)):
            for k in range(n):
                a=-.72+1.44*k/n;b=-.72+1.44*(k+1)/n
                if destroyed and a<.32 and b>-.32:continue
                if damaged and a<.085 and b>-.04:continue
                ha=deck_height(material,a);hb=deck_height(material,b)
                # Solid cambered slab or individual timber deck board, true depth.
                gap=.001 if material=='wood' and level==0 else 0
                pts=[(-.19,a+gap,ha+.012),(.19,a+gap,ha+.012),(.19,b-gap,hb+.012),(-.19,b-gap,hb+.012)]
                bm=bmesh.new();top=[bm.verts.new(p) for p in pts];bottom=[bm.verts.new((x,y,max(0,z-.015))) for x,y,z in pts]
                bm.faces.new(top);bm.faces.new(list(reversed(bottom)))
                for i in range(4):j=(i+1)%4;bm.faces.new((top[i],bottom[i],bottom[j],top[j]))
                bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));ms.add(bm,deckmat,only=(level,))
            sec='triangle' if level==2 else 'box'
            if material=='wood':
                for x in (-.145,.145):
                    for a,b in ((-.72,-.34),(.34,.72)) if destroyed else ((-.72,-.20),(-.20,.20),(.20,.72)):
                        prism_beam(ms,'btr_wood',(x,a,deck_height(material,a)),(x,b,deck_height(material,b)),.016,only=(level,),section=sec)
                stations=(-.66,.66) if level==2 else (-.66,-.39,0,.39,.66)
                for x in (-.20,.20):
                    for y in stations:
                        if destroyed and abs(y)<.32:continue
                        if damaged and x>0 and y==0:continue
                        h=deck_height(material,y);prism_beam(ms,'btr_wood',(x,y,max(.008,h-.06)),(x,y,h+.10),.012,only=(level,),section=sec)
                    for a,b in ((-.66,-.34),(.34,.66)) if destroyed else ((-.66,-.20),(-.20,.20),(.20,.66)):
                        if damaged and x>0 and a<0<b:continue
                        prism_beam(ms,'btr_wood',(x,a,deck_height(material,a)+.092),(x,b,deck_height(material,b)+.092),.010,only=(level,),section=sec)
                    if level<2:
                        for y in (-.45,.45):prism_beam(ms,'btr_wood',(x,y-.12,.012),(x,y,deck_height(material,y)-.005),.013,only=(level,))
            elif material=='stone':
                # Open load-bearing barrel vault. Separate voussoirs at LOD0;
                # reduced radial segments at distance keep the arch opening.
                count=(16,10,6)[level]
                for k in range(count):
                    t0=math.pi*k/count;t1=math.pi*(k+1)/count
                    if destroyed and t0<2.05 and t1>1.1:continue
                    if damaged and k==count//2:continue
                    gap=.004 if level==0 else 0;t0+=gap;t1-=gap
                    bm=bmesh.new();rings=[]
                    for x in (-.19,.19):rings.append([bm.verts.new((x,.60*math.cos(t),.012+r*math.sin(t))) for r,t in ((.175,t0),(.175,t1),(.222,t1),(.222,t0))])
                    bm.faces.new(list(reversed(rings[0])));bm.faces.new(rings[1])
                    for i in range(4):j=(i+1)%4;bm.faces.new((rings[0][i],rings[1][i],rings[1][j],rings[0][j]))
                    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));ms.add(bm,'btr_ashlar',only=(level,))
                for x in (-.205,.205):
                    for k in range((8,6,2)[level]):
                        a=-.70+1.4*k/(8,6,2)[level];b=-.70+1.4*(k+1)/(8,6,2)[level]
                        if destroyed and a<.32 and b>-.32:continue
                        if damaged and x>0 and a<.1 and b>-.1:continue
                        prism_beam(ms,'btr_ashlar',(x,a,deck_height(material,a)+.058),(x,b,deck_height(material,b)+.058),.035,.085,only=(level,))
                for y in (-.66,.66):ms.box('btr_ashlar',(.43,.12,.045),at=(0,y,0),lod=level if level==0 else 2) if level==0 else None
            else:
                # Warren truss with genuine I sections at LOD0, 3D solid members
                # at all distances. Two opposed planes, no flat rail-card cheats.
                bays=(6,6,4)[level];nodes=[-.68+1.36*i/bays for i in range(bays+1)]
                for x in (-.205,.205):
                    section='I' if level==0 else sec
                    for a,b in ((-.68,-.34),(.34,.68)) if destroyed else ((-.68,.68),):
                        for z in (.072,.24):prism_beam(ms,'btr_steel',(x,a,z),(x,b,z),.014,.02,only=(level,),section=section)
                    for k,(a,b) in enumerate(zip(nodes,nodes[1:])):
                        if destroyed and a<.32 and b>-.32:continue
                        if damaged and x>0 and k==bays//2:continue
                        za,zb=(.072,.24) if k%2==0 else (.24,.072)
                        prism_beam(ms,'btr_steel',(x,a,za),(x,b,zb),.014,.018,only=(level,),section=section)
                    if level==0:
                        for k,y in enumerate(nodes):
                            if destroyed and abs(y)<.32:continue
                            z=.072 if k%2==0 else .24;ms.box('btr_steel',(.005,.042,.034),at=(x,y,z-.017),lod=0)
                            # Raised rivet heads, readable only nearby.
                            ms.cyl('btr_steel',.004,.004,.004,at=(x-.002,y,z),rot=(0,90,0),segs=5,lod=0)
                for y in (-.66,.66):ms.box('btr_concrete',(.44,.10,.045),at=(0,y,0),lod=0)
        if destroyed:
            for k in range(5):
                y=-.22+k*.095;x=(-1)**k*.09
                if material=='stone':rock(ms,rng,x,y,.052,.034,lod=1)
                else:prism_beam(ms,'btr_rust' if material=='steel' else 'btr_endgrain',(x-.055,y,.022),(x+.035,y+.038,.035),.012,.018,lod=1)
        if damaged:rock(ms,rng,.12,.10,.018,.011,lod=0)
    return build


def bridge_scaled(material,state):
    def build(ms,rng):
        bridge(material,state)(ms,rng)
        sx=(.36 if material=='steel' else .30)/.44;sy=(1.2 if material=='steel' else 1.0)/1.44
        for bm,_,_,_ in ms.parts:
            for v in bm.verts:v.co.x*=sx;v.co.y*=sy
    return build


def file_items(ident):
    if ident=='river-kit':
        # Loader uses bank; extra full-width modules are ready for future placement.
        result=[('bank',bank)]
        for tiles in (3,5,8):
            for kind in ('straight','bend','junction','end'):result.append((kind+('' if tiles==3 else '-'+str(tiles)),river_piece(kind,tiles)))
        return result
    if ident=='ford':return [('ford',ford)]
    material=ident.split('-')[1]
    return [(ident+('' if state=='intact' else '-'+state),bridge_scaled(material,state)) for state in ('intact','damaged','destroyed')]


def repair_open_normals(ms):
    for bm,mat,_,_ in ms.parts:
        bm.normal_update()
        if mat in GROUND:
            for f in bm.faces:
                if f.normal.z<0:f.normal_flip()
            bm.normal_update()


def audit_geometry(obj,budget):
    obj.data.calc_loop_triangles();count=len(obj.data.loop_triangles)
    coords=np.array([tuple(v.co) for v in obj.data.vertices]);assert np.isfinite(coords).all()
    assert count<=budget,(obj.name,count,budget)
    assert coords[:,2].min()>=-1e-7,(obj.name,'subground',coords[:,2].min())
    assert max(abs(v) for v in obj.location)<1e-7
    return {'triangles':count,'min':coords.min(axis=0).tolist(),'max':coords.max(axis=0).tolist()}


def fringe_uvs(joined,items,only_fringe=False,item_override=None,position_index=None):
    # Preserve one unique atlas for ordinary faces; only intentional alpha-strip
    # repetition overlaps. The bank's dry edge and ford's irregular outline cut.
    uv=joined.data.uv_layers.active;matnames=[m.name for m in joined.data.materials];tags=joined.data.attributes.get('item')
    for p in joined.data.polygons:
        k=tags.data[p.index].value if item_override is None else item_override;name=items[k][0]
        for li in p.loop_indices:
            if matnames[p.material_index]!='btr_fringe':
                if not only_fringe:uv.data[li].uv.y=.07+.93*uv.data[li].uv.y
                continue
            co=joined.data.vertices[joined.data.loops[li].vertex_index].co;local=co-Vector(((k if position_index is None else position_index)*tt.SPACING,0,0))
            if name=='bank':u=(local.x+.18)/.36;t=(.08-local.y)/(.08-.046)
            else:
                u=(math.atan2(local.y,local.x)/math.tau)%1;t=(.18-max(abs(local.x),abs(local.y)))/.038
            uv.data[li].uv=(.004+.992*u,.004+.047*min(1,max(0,t)))



def bake_metal(joined,size):
    materials=list(joined.data.materials);restore=[]
    image=tm._img('btr_metal',size,non_color=True)
    for mat in materials:
        nt=mat.node_tree;bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
        original=out.inputs['Surface'].links[0].from_socket;em=nt.nodes.new('ShaderNodeEmission');value=float(bs.inputs['Metallic'].default_value);em.inputs['Color'].default_value=(value,value,value,1);nt.links.new(em.outputs[0],out.inputs['Surface']);restore.append((nt,out,original,em))
    tm._bake_target_nodes(materials,image);bpy.context.view_layer.objects.active=joined;bpy.context.scene.cycles.samples=1
    bpy.ops.object.bake(type='EMIT',margin=3,use_clear=True)
    arr=np.empty(size*size*4,dtype=np.float32);image.pixels.foreach_get(arr);arr=arr.reshape(size,size,4)[::-1].copy()
    for nt,out,original,em in restore:nt.links.new(original,out.inputs['Surface']);nt.nodes.remove(em)
    for mat in materials:
        node=mat.node_tree.nodes.get('_bake')
        if node:mat.node_tree.nodes.remove(node)
    bpy.data.images.remove(image);return arr[...,0]


def bake_basecolour(joined,size):
    """Bake authored colour independently of metallic energy splitting."""
    materials=list(joined.data.materials);restore=[];image=tm._img('btr_basecolour',size,non_color=False)
    for mat in materials:
        nt=mat.node_tree;bs=next(n for n in nt.nodes if n.type=='BSDF_PRINCIPLED');out=next(n for n in nt.nodes if n.type=='OUTPUT_MATERIAL')
        original=out.inputs['Surface'].links[0].from_socket;em=nt.nodes.new('ShaderNodeEmission');colour=bs.inputs['Base Color']
        if colour.links:nt.links.new(colour.links[0].from_socket,em.inputs['Color'])
        else:em.inputs['Color'].default_value=colour.default_value
        nt.links.new(em.outputs[0],out.inputs['Surface']);restore.append((nt,out,original,em))
    tm._bake_target_nodes(materials,image);bpy.context.view_layer.objects.active=joined;bpy.context.scene.cycles.samples=1
    bpy.ops.object.bake(type='EMIT',margin=3,use_clear=True)
    arr=np.empty(size*size*4,dtype=np.float32);image.pixels.foreach_get(arr);arr=arr.reshape(size,size,4)[::-1].copy()
    for nt,out,original,em in restore:nt.links.new(original,out.inputs['Surface']);nt.nodes.remove(em)
    for mat in materials:
        node=mat.node_tree.nodes.get('_bake')
        if node:mat.node_tree.nodes.remove(node)
    bpy.data.images.remove(image);return arr


def final_material(name,images):
    mat=bpy.data.materials.get(name) or bpy.data.materials.new(name);nt,bs=tm._nodes(mat)
    tex=[]
    for image in images:
        node=nt.nodes.new('ShaderNodeTexImage');node.image=image;tex.append(node)
    nt.links.new(tex[0].outputs['Color'],bs.inputs['Base Color'])
    normal=nt.nodes.new('ShaderNodeNormalMap');nt.links.new(tex[1].outputs['Color'],normal.inputs['Color']);nt.links.new(normal.outputs['Normal'],bs.inputs['Normal'])
    sep=nt.nodes.new('ShaderNodeSeparateColor');nt.links.new(tex[2].outputs['Color'],sep.inputs['Color']);nt.links.new(sep.outputs[1],bs.inputs['Roughness']);nt.links.new(sep.outputs[2],bs.inputs['Metallic'])
    if name=='Ground':
        rnd=nt.nodes.new('ShaderNodeMath');rnd.operation='ROUND';nt.links.new(tex[0].outputs['Alpha'],rnd.inputs[0]);nt.links.new(rnd.outputs[0],bs.inputs['Alpha'])
        if hasattr(mat,'surface_render_method'):mat.surface_render_method='DITHERED'
        if hasattr(mat,'blend_method'):mat.blend_method='CLIP'
        if hasattr(mat,'alpha_threshold'):mat.alpha_threshold=.5
    return mat


class TerrainExportExtension:
    # Names are canonicalized during glTF gathering, never by editing a GLB.
    # Blender itself cannot hold three identically named socket objects.
    def gather_node_hook(self,node,obj,settings):
        if obj.get('btr_socket_id'):node.name=obj['btr_socket_id']
        if obj.get('btr_lod') is not None:node.name='LOD'+str(obj['btr_lod'])
    def gather_material_hook(self,material,*args):
        if material.name=='Ground':material.alpha_mode='MASK';material.alpha_cutoff=.5


def export_file(path,objects):
    from io_scene_gltf2.blender.exp import export as exp
    original=exp.save
    def with_extension(context,settings):
        settings['gltf_user_extensions'].append(TerrainExportExtension());return original(context,settings)
    exp.save=with_extension
    try:
        for o in bpy.context.scene.objects:o.select_set(o in objects)
        bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_yup=True,export_apply=True,
            export_image_format='WEBP',export_image_quality=90,export_image_add_webp=False,export_image_webp_fallback=False,
            export_animations=False,export_skins=False,export_morph=False,export_cameras=False,export_lights=False,
            export_extras=True,export_draco_mesh_compression_enable=False)
    finally:exp.save=original


def town_bake_value(mesh,base):
    """Check every root/LOD's actual colour+AO before exporting its atlas."""
    mesh.calc_loop_triangles();samples=[];uv=mesh.uv_layers.active.data;size=base.shape[0]
    for tri in mesh.loop_triangles:
        if mesh.materials[tri.material_index].name!='Town':continue
        p=[mesh.vertices[i].co for i in tri.vertices]
        if (p[1]-p[0]).cross(p[2]-p[0]).length_squared<=1e-30:continue
        a,b,c=[uv[i].uv.copy() for i in tri.loops]
        for u in ((a+b+c)/3,a*.6+b*.2+c*.2,a*.2+b*.6+c*.2,a*.2+b*.2+c*.6):
            rgb=base[min(size-1,max(0,int((1-u.y)*size))),min(size-1,max(0,int(u.x*size))),:3]
            encoded=np.where(rgb<=.0031308,rgb*12.92,1.055*np.maximum(rgb,0)**(1/2.4)-.055)
            samples.append(float(encoded.max()))
    return float(np.mean(samples)) if samples else None


def build_file(ident,out,game_dir,sheet,threads=2):
    out.mkdir(parents=True,exist_ok=True);bpy.ops.wm.read_factory_settings(use_empty=True);scene=bpy.context.scene
    scene.render.threads_mode='FIXED';scene.render.threads=min(2,threads);scene.cycles.use_denoising=False
    register_materials();tt.make_materials();items=file_items(ident);meshers=[];source=[];pre={}
    # Every authored LOD is an actual bake source, with its own atlas islands.
    # This avoids interpolating simplified faces across tiny near-LOD charts and
    # prevents near-only rail/cobble AO from appearing as ghost far geometry.
    cols=4 if ident=='river-kit' else len(items);rows=math.ceil(len(items)/cols)
    bands=((.07,.48),(.56,.20),(.77,.22))
    for k,(name,layout) in enumerate(items):
        ms=tm.Mesher();layout(ms,tm.seeded(8217+k*41));repair_open_normals(ms);meshers.append(ms);pre[name]=[]
        for level,budget in enumerate(BUDGETS):
            j=3*k+level;o=ms.build('_source'+str(j),level,tt.PROC);pre[name].append(audit_geometry(o,budget))
            low,height=bands[level];minimum_cell_pixels=min(1024/cols,1024*height/rows)
            tm.smart_uv(o,margin=max(.03,7/minimum_cell_pixels))
            def valid_surface_uvs():
                o.data.calc_loop_triangles()
                uv=o.data.uv_layers.active.data;coverage=0
                for tri in o.data.loop_triangles:
                    vertices=[o.data.vertices[i].co for i in tri.vertices]
                    if (vertices[1]-vertices[0]).cross(vertices[2]-vertices[0]).length_squared<=1e-30:
                        continue  # No physical surface on collinear cap triangles.
                    a,b,c=[uv[i].uv.copy() for i in tri.loops]
                    area2=abs((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))
                    if area2<=2e-12:return False
                    coverage+=area2
                return coverage>=.02  # Reject microscopic but nonzero pack results.
            if not valid_surface_uvs():
                # Infeasible fractional padding silently collapses islands.
                # Re-project from geometry at feasible spacing before baking.
                print('TERRAIN_UV_REPACK',ident,name,level,flush=True)
                tm.smart_uv(o,margin=.004)
            assert valid_surface_uvs(),'Collapsed bake-source UV surface'
            # Dense structural islands can exceed one UDIM when the packer's
            # fixed fractional padding cannot fit. Fit the complete result as
            # one affine transform, preserving every island and relative UV.
            uvdata=o.data.uv_layers.active.data
            lo=[min(loop.uv[a] for loop in uvdata) for a in (0,1)]
            hi=[max(loop.uv[a] for loop in uvdata) for a in (0,1)]
            if min(lo)<0 or max(hi)>1:
                fit=1/max(1,hi[0]-lo[0],hi[1]-lo[1])
                for loop in uvdata:
                    loop.uv.x=(loop.uv.x-lo[0])*fit;loop.uv.y=(loop.uv.y-lo[1])*fit
                print('TERRAIN_UV_FIT',ident,name,level,lo,hi,flush=True)
            for loop in o.data.uv_layers.active.data:
                loop.uv.x=(k%cols+.025+.95*loop.uv.x)/cols
                loop.uv.y=low+(k//cols+.025+.95*loop.uv.y)*height/rows
            o.data.transform(Matrix.Translation((j*tt.SPACING,0,0)));tt._tag_item(o,j)
            fringe_uvs(o,items,only_fringe=True,item_override=k,position_index=j);source.append(o)
    joined=tt._join(source,'_btr_bake') if len(source)>1 else source[0]
    print('TERRAIN_BAKE_START',ident,flush=True)
    maps=tm.bake_atlas(joined,size=1024,ao_samples=24,margin=3);metal=bake_metal(joined,1024)
    if ident=='bridge-steel':maps['color']=bake_basecolour(joined,1024)
    print('TERRAIN_BAKE_FINISHED',ident,flush=True)
    ao=maps['ao'][...,0];base=maps['color'].copy();base[...,:3]*=(.35+.65*ao[...,None]);base[...,3]=tt.fringe_alpha(1024,tm.seeded(7781))
    normal=maps['normal'].copy();normal[...,3]=1;packed=np.zeros_like(base);packed[...,0]=ao;packed[...,1]=maps['rough'][...,0];packed[...,2]=metal;packed[...,3]=1
    # Deliberate shared edge-strip texels, kept separate from unique baked islands.
    rows=int(tt.FRINGE_V*1024);base[-rows:,:,:3]=tm._srgb('#899674')[:3];normal[-rows:,:,:3]=(.5,.5,1);packed[-rows:,:,:3]=(1,.97,0)
    images=[tm.image_from_array(ident+'_'+label,arr,'PNG',non_color=label!='basecolor') for label,arr in [('basecolor',base),('normal',normal),('orm',packed)]]
    for image,label in zip(images,('basecolor','normal','orm')):image.filepath_raw=str(out/(label+'.png'));image.file_format='PNG';image.save();image.pack()
    finals=[final_material(name,images) for name in ('Town','Ground')];roots=[];exported=[];reports={}
    for k,((name,_),ms) in enumerate(zip(items,meshers)):
        lods=[tt._split_faces(joined,3*k+level,'LOD'+str(level)) for level in (0,1,2)]
        root=bpy.data.objects.new(name,None);scene.collection.objects.link(root);root['btr_asset']=ident;root['concept_sheet']=str(sheet);root['metres_per_unit']=10
        if ident=='river-kit' and name!='bank':
            root['river_width_tiles']=int(name.rsplit('-',1)[-1]) if name.rsplit('-',1)[-1].isdigit() else 3
            root['river_shape']=name.split('-')[0]
        reports[name]=[]
        for level,o in enumerate(lods):
            o.data.transform(Matrix.Translation((-(3*k+level)*tt.SPACING,0,0)));o.parent=root;o['btr_lod']=level
            indices=[0 if o.data.materials[p.material_index].name not in GROUND else 1 for p in o.data.polygons]
            # Assign all custom data first, then reacquire UV to avoid stale RNA.
            o.data.materials.clear()
            for mat in finals:o.data.materials.append(mat)
            for p,i in zip(o.data.polygons,indices):p.material_index=i;p.use_smooth=False
            if 'item' in o.data.attributes:o.data.attributes.remove(o.data.attributes['item'])
            reports[name].append(audit_geometry(o,BUDGETS[level]))
            value=town_bake_value(o.data,base)
            if value is not None:
                reports[name][-1]['Town_bake_value']=round(value,4)
                assert value>=.26,(ident,name,level,'Dark or unbaked Town surface',value)
            assert reports[name][-1]['triangles']==pre[name][level]['triangles']
            assert all(-1e-6<=x<=1+1e-6 for loop in o.data.uv_layers.active.data for x in loop.uv)
        if ident.startswith('bridge-'):
            span=1.2 if ident=='bridge-steel' else 1.0;root['socket_span_metres']=span*10
            for label,sign in (('a',-1),('b',1)):
                socket=bpy.data.objects.new('socket-end-'+label+'__'+name,None);scene.collection.objects.link(socket);socket.parent=root;socket.location=(0,sign*span/2,0);socket['btr_socket_id']='socket-end-'+label;exported.append(socket)
        exported += [root]+lods;roots.append(root)
    bpy.data.objects.remove(joined,do_unlink=True)
    for image in list(bpy.data.images):
        if image not in images and not image.users:bpy.data.images.remove(image)
    for mat in list(bpy.data.materials):
        if mat not in finals and not mat.users:bpy.data.materials.remove(mat)
    for root in roots:
        for o in root.children:o.select_set(True)
        root.select_set(True)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/(ident+'.blend')))
    file=out/(ident+'.glb');export_file(file,exported)
    validator=runpy.run_path(str(Path(tt.__file__).parent/'validate_model.py'),run_name='terrain_validator')
    assert validator['main'](str(file),str(out),'terrain-kit')==0
    doc,binary,total=validator['read_glb'](str(file))
    assert len(doc['images'])==3 and {m['name'] for m in doc['materials']}=={'Town','Ground'}
    for node in doc['nodes']:
        if node.get('name','').startswith('bridge-'):
            sockets={doc['nodes'][c]['name']:doc['nodes'][c].get('translation',[0,0,0]) for c in node.get('children',[]) if doc['nodes'][c]['name'].startswith('socket-end-')}
            assert set(sockets)=={'socket-end-a','socket-end-b'}
            assert abs(abs(sockets['socket-end-a'][2]-sockets['socket-end-b'][2])-(1.2 if ident=='bridge-steel' else 1))<1e-6
    assert len(images)==3 and all(image.packed_file and tuple(image.size)==(1024,1024) for image in images)
    tone_script=Path(tt.__file__).parents[1]/'art/town-tone.mjs'
    measured=subprocess.run(['node',str(tone_script),'--json',str(file)],capture_output=True,text=True,check=True)
    tone=json.loads(measured.stdout);assert tone[str(file)]['Town']['effective']>=.26,'Town tone below required floor'
    (out/'tone-lod0.json').write_text(json.dumps(tone,indent=2)+'\n')
    # Publish only our five new assets, after validation; never overwrite a foreign file.
    game_dir.mkdir(parents=True,exist_ok=True);target=game_dir/(ident+'.glb');receipt=out/'delivery.json'
    if target.exists():
        old=json.loads(receipt.read_text()) if receipt.exists() else {};assert old.get('glb_sha256')==hashlib.sha256(target.read_bytes()).hexdigest(),'Refusing to overwrite an unowned game file'
    target.write_bytes(file.read_bytes());assert validator['main'](str(target),str(out),'auto')==0
    record={'id':ident,'game_path':str(target),'glb_sha256':hashlib.sha256(file.read_bytes()).hexdigest(),'sheet':str(sheet),'sheet_sha256':hashlib.sha256(sheet.read_bytes()).hexdigest(),'atlas':[1024,1024],'materials':['Town','Ground'],'budgets':BUDGETS,'objects':reports,'bytes':total,'validated':True,'runtime_integration_pending':True,'unused_variants':'damaged/destroyed bridge roots require bridge HP; current runtime uses intact only','extra_river_modules':'straight/bend/junction/end 3/5/8-tile modules delivered; current placement uses bank only','AO':'physical bake applied once; no vertex colour or extra occlusion multiply','geometry_compression':False,'LOD_texture_method':'all authored LOD geometries physically baked into separate islands of one shared1024atlas; no UV projection'}
    receipt.write_text(json.dumps(record,indent=2)+'\n');return roots,record


def preview(roots,out,threads=2):
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.render.threads_mode='FIXED';scene.render.threads=min(2,threads);scene.cycles.samples=16;scene.cycles.use_denoising=False
    scene.render.resolution_x=844;scene.render.resolution_y=390;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.render.film_transparent=True
    scene.view_settings.view_transform='AgX';scene.view_settings.exposure=.5
    world=bpy.data.worlds.new('TerrainPreviewSky');world.use_nodes=True;world.node_tree.nodes['Background'].inputs['Color'].default_value=tm._srgb('#E3EEF8');world.node_tree.nodes['Background'].inputs['Strength'].default_value=.75;scene.world=world
    created=[]
    for name,kind,power,color,pos in [('PreviewSun','SUN',2.5,'#FFE7C2',(4,-6,10)),('PreviewBounce','AREA',25,'#5A503F',(-2,-2,1))]:
        light=bpy.data.objects.new(name,bpy.data.lights.new(name,kind));scene.collection.objects.link(light);light.data.energy=power;light.data.color=tm._srgb(color)[:3];light.location=pos;light.rotation_euler=(-light.location).to_track_quat('-Z','Y').to_euler();created.append(light)
    camera=bpy.data.objects.new('TerrainPreviewCamera',bpy.data.cameras.new('TerrainPreviewCamera'));scene.collection.objects.link(camera);camera.data.type='ORTHO';created.append(camera);scene.camera=camera
    direction=Vector((-1,-1,1.35)).normalized();camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler();right=camera.rotation_euler.to_matrix()@Vector((1,0,0));up=camera.rotation_euler.to_matrix()@Vector((0,1,0))
    for root in roots:
        for level in (0,2):
            for r in roots:
                for o in r.children:
                    if o.type=='MESH':o.hide_render=(r!=root or o['btr_lod']!=level)
            obj=next(o for o in root.children if o.type=='MESH' and o['btr_lod']==level);coords=[v.co for v in obj.data.vertices];xs=[p.dot(right) for p in coords];ys=[p.dot(up) for p in coords]
            target=right*((min(xs)+max(xs))/2)+up*((min(ys)+max(ys))/2);camera.location=target+direction*10;camera.data.ortho_scale=max(max(xs)-min(xs),(max(ys)-min(ys))*844/390)*1.2
            scene.render.filepath=str(out/(root.name+'-lod'+str(level)+'.png'));bpy.ops.render.render(write_still=True)
    for root in roots:
        for o in root.children:o.hide_render=False
    scene.camera=None
    for o in created:bpy.data.objects.remove(o,do_unlink=True)
