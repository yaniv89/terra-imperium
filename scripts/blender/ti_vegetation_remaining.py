"""Isolated conifer/tropical/cold geometry using the delivered nature/town API.
All lengths are Blender units (10m). No shared source files are changed.
Imported only AFTER the parent concept sheet gate in build_vegetation_remaining.
"""
import math
import random
import bpy
import bmesh
from mathutils import Vector
import ti_map as tm
import ti_town as tt
import ti_nature as tn

ROOTS=('tree-s','tree-m','tree-l','stump','felled','bush','rock-s','rock-m','grass-tuft')
PALETTES={
 'vr_bark':('#a58b68','#b59b77','#887153'),
 'vr_pale_bark':('#ded8c8','#c5c3b6','#8f9388'),
 'vr_cut':('#d8b786','#e4c697','#be9c70'),
 'vr_needle':('#728745','#899a58','#526c3f'),
 'vr_needle_tip':('#a0ad67','#8a9e55','#718b49'),
 'vr_tropical':('#70904f','#87a363','#5f8247'),
 'vr_frond':('#8ca65a','#a1b572','#6f954f'),
 'vr_cold':('#929f87','#a4af94','#7f927e'),
 'vr_cold_scrub':('#aca78a','#bbb698','#89997c'),
 'vr_rock':('#a3a599','#bab9a9','#8d9388'),
 'vr_tropical_rock':('#a3a18a','#b6b098','#909581'),
 'vr_cold_rock':('#b9bec0','#ced0ca','#a2afae'),
 'vr_grass':('#95a667','#b2b781','#82945f'),
 'vr_cold_grass':('#b5b59a','#cdc6a8','#97a68b'),
 'vr_snow':('#e4e6dd','#f1eee1','#c9d4d1'),
 'vr_winter_twig':('#b59271','#c5a27d','#92765c'),
 'vr_moss':('#aaa956','#bbb967','#8f9c56'),
}
for key in PALETTES:
    if key not in tt.PROC:tt.PROC.append(key)

def materials():
    scene=bpy.context.scene;scene.render.threads_mode='FIXED';scene.render.threads=4
    scene.cycles.device='CPU';scene.cycles.use_denoising=False
    for key,colors in PALETTES.items():
        stripes={'dir':'Z','scale':75,'distortion':5} if 'bark' in key else None
        tm.mat_simple(key,list(colors),scale=14,bump=.22,stripes=stripes)

if not any(key=='vegetation_remaining' for key,_ in tt.EXTRA_MATERIALS):
    tt.EXTRA_MATERIALS.append(('vegetation_remaining',materials))

def needle_whorl(ms,rng,z,r,top,segs,lod,only,mat):
    """Closed pointed whorl with scalloped drooping branch tips, not smooth cones."""
    bm=bmesh.new();ring=[]
    for k in range(segs):
        a=k*2*math.pi/segs
        rr=r*(1.0 if k%2==0 else .76)*rng.uniform(.95,1.05)
        ring.append(bm.verts.new((rr*math.cos(a),rr*math.sin(a),z+(.013 if k%2 else 0))))
    apex=bm.verts.new((r*.09,-r*.04,top))
    for k in range(segs):bm.faces.new((ring[k],ring[(k+1)%segs],apex))
    bm.faces.new(tuple(reversed(ring)));bm.normal_update();ms.add(bm,mat,lod,only=only)

def spruce(ms,rng,h,r,cold=False):
    leaf='vr_cold' if cold else 'vr_needle';bark='vr_pale_bark' if cold else 'vr_bark'
    tn.limb(ms,bark,(0,0,0),(.025 if cold else 0,0,h*.92),r*.14,r*.045,segs=7,lod=0)
    tn.limb(ms,bark,(0,0,0),(.025 if cold else 0,0,h*.92),r*.14,r*.045,segs=4,lod=2,only=(1,2))
    for k in range(5):
        z=h*(.18+k*.14);rad=r*(1-k*.16)
        needle_whorl(ms,rng,z,rad,min(h,z+h*.30),16,0,None,leaf if k<4 else 'vr_needle_tip')
        if k<3:
            for a in (k*.6,k*.6+math.pi):
                tn.limb(ms,bark,(0,0,z+h*.11),(math.cos(a)*rad*.86,math.sin(a)*rad*.86,z+.01),r*.032,r*.016,segs=4,lod=0)
    for lod in (1,2):
        for k in range(3):
            z=h*(.18+k*.23);rad=r*(1-k*.28)
            needle_whorl(ms,rng,z,rad,min(h,z+h*.43),8,lod,(lod,),leaf)

def pine(ms,rng,h,r):
    # Open Scots-pine canopy: visible long trunk, irregular forks and needle pads.
    tn.broadleaf(ms,rng,h,r,.018,bark='vr_bark',leaf='vr_needle',shape=(1.12,1,.7),crown_z=.55,blobs=4,lean=.06)
    for a in (0,2.1,4.2):
        tn.limb(ms,'vr_bark',(0,0,h*.48),(math.cos(a)*r*.8,math.sin(a)*r*.8,h*.74),.010,.005,segs=4,lod=0)

def tropical_broadleaf(ms,rng,h,r):
    tn.broadleaf(ms,rng,h,r,.023,bark='vr_bark',leaf='vr_tropical',shape=(1,1,.85),crown_z=.56,blobs=4)
    # Real buttress fins continue the trunk to ground, no slab beneath the tree.
    for a in (0,2.1,4.2):
        pts=[(0,0,h*.19),(math.cos(a)*.10,math.sin(a)*.10,0),(math.cos(a+.22)*.025,math.sin(a+.22)*.025,0)]
        bm=bmesh.new();vs=[bm.verts.new(p) for p in pts];bm.faces.new(vs);ms.add(bm,'vr_bark',0)

def palm(ms,rng,h):
    tn.palm(ms,rng,h,frond=h*.43,leaf='vr_frond',bark='vr_bark',fronds=10)

def cold_birch(ms,rng,h,r):
    tn.broadleaf(ms,rng,h,r,.013,bark='vr_pale_bark',leaf='vr_cold',shape=(.85,1,1),crown_z=.53,blobs=3,lean=.10)

def rocks(ms,rng,r,mat,large=False):
    seed=rng.randrange(1<<30)
    for lod,sub in ((0,2),(1,1),(2,1)):
        tn.rock(ms,mat,0,0,r,random.Random(seed),flat=.68,subdiv=sub,lod=lod,only=(lod,))
    if large:
        for lod in (0,1,2):tn.rock(ms,mat,.11,-.04,r*.36,random.Random(seed+1),flat=.55,subdiv=1,lod=lod,only=(lod,))

def normalize_layout(fn,height=None):
    def layout(ms,rng):
        fn(ms,rng)
        # Remap the nature helper's internal default cut ends/date clusters locally.
        ms.parts=[(bm,{'cut_wood':'vr_cut','bark':'vr_bark'}.get(mat,mat),lod,only) for bm,mat,lod,only in ms.parts]
        # Existing nature parts permit slight negative feet. This task requires 0.
        for bm,_,_,_ in ms.parts:
            for v in bm.verts:v.co.z=max(0,v.co.z)
        near=[v for bm,_,lod,only in ms.parts if (only is None or 0 in only) for v in bm.verts]
        foot=min(v.co.z for v in near)
        if foot>0:
            for bm,_,_,_ in ms.parts:
                for v in bm.verts:v.co.z=max(0,v.co.z-foot)
        if height is not None:
            ratio=height/max(v.co.z for v in near)
            for bm,_,_,_ in ms.parts:
                for v in bm.verts:v.co.z*=ratio
        cx=(min(v.co.x for v in near)+max(v.co.x for v in near))/2
        cy=(min(v.co.y for v in near)+max(v.co.y for v in near))/2
        for bm,_,_,_ in ms.parts:
            for v in bm.verts:v.co.x-=cx;v.co.y-=cy
            bm.normal_update()
        # Budget assertion happens before the common bake/UV/export pipeline.
        for level,limit in enumerate((600,150,150)):
            count=sum(sum(len(f.verts)-2 for f in bm.faces) for bm,_,lod,only in ms.parts if (level in only if only is not None else level<=lod))
            if count>limit:raise RuntimeError('Vegetation geometry budget exceeded: %s > %s at LOD%s'%(count,limit,level))
    return layout

def blade(ms,mat,base,tip,width,lod=0,only=None):
    """Tapered arched leaf with a raised central rib; four broad opaque facets."""
    base=Vector(base);tip=Vector(tip);d=tip-base
    side=Vector((-d.y,d.x,0)).normalized()*width
    mid=base+d*.54+Vector((0,0,width*.52))
    bm=bmesh.new();vs=[bm.verts.new(v) for v in (base,mid-side,mid,mid+side,tip)]
    for f in ((0,1,2),(0,2,3),(1,4,2),(2,4,3)):bm.faces.new([vs[i] for i in f])
    bm.normal_update();ms.add(bm,mat,lod,only=only)

def sheet_palm(ms,rng,h=.5):
    bend=.045;pts=[(bend*(k/3)**2,0,h*k/3) for k in range(4)]
    for k in range(3):tn.limb(ms,'vr_bark',pts[k],pts[k+1],.022-k*.003,.019-k*.003,segs=7,lod=0,caps=False)
    for level in (1,2):tn.limb(ms,'vr_bark',pts[0],pts[-1],.022,.013,segs=5,lod=level,only=(level,))
    crown=Vector(pts[-1])
    for level,count in ((0,10),(1,7),(2,6)):
        for k in range(count):
            a=k*2*math.pi/count
            end=crown+Vector((math.cos(a)*.235,math.sin(a)*.235,-.09 if k%2 else -.045))
            blade(ms,'vr_frond',crown,end,.045 if level==0 else .052,level,(level,))
    for k in range(3):blade(ms,'vr_frond',crown,crown+Vector((.05*math.cos(k*2.1),.05*math.sin(k*2.1),.10)),.026,0)

def rainforest(ms,rng,h=.8,r=.36):
    trunk=[(0,0,0),(-.03,.01,h*.32),(.025,0,h*.59)]
    for k in range(2):tn.limb(ms,'vr_bark',trunk[k],trunk[k+1],.035-k*.006,.029-k*.007,segs=7,lod=0)
    for a in (0,2.1,4.2):
        tn.limb(ms,'vr_bark',trunk[-1],(math.cos(a)*r*.58,math.sin(a)*r*.58,h*.84),.022,.01,segs=5,lod=0)
        bm=bmesh.new();vs=[bm.verts.new(v) for v in ((0,0,.20),(math.cos(a)*.12,math.sin(a)*.12,0),(math.cos(a+.28)*.035,math.sin(a+.28)*.035,0))];bm.faces.new(vs);ms.add(bm,'vr_bark',0)
    pads=[(-.18,-.01,h*.81,.16),(.18,.01,h*.83,.16),(0,.15,h*.91,.18),(0,-.14,h*.77,.17),(0,0,h*.96,.17)]
    for x,y,z,rr in pads:tn.blob(ms,'vr_tropical',(x,y,z),rr,(1.2,1,.42),rng,.15,2,lod=0)
    # Hanging lianas are a signature part of the sheet's large rainforest tree.
    for x,y,z,_ in pads[:3]:tn.limb(ms,'vr_moss',(x,y,z-.01),(x-.01,y,z-.24),.005,.003,segs=3,lod=0,caps=False)
    for level in (1,2):
        tn.limb(ms,'vr_bark',(0,0,0),trunk[-1],.033,.02,segs=5,lod=level,only=(level,))
        for x,y,z,rr in (pads[0],pads[1],pads[2]):tn.blob(ms,'vr_tropical',(x,y,z),rr*1.13,(1.2,1,.48),rng,.1,1,lod=level,only=(level,))

def wind_tree(ms,rng,h):
    pts=[(0,0,0),(-h*.10,0,h*.25),(h*.12,0,h*.53),(-h*.045,.012,h*.79),(0,0,h*.98)]
    for level in (0,1,2):
        seg=6 if level==0 else 3
        chain=pts if level==0 else [pts[0],pts[2],pts[-1]]
        for k,(a,b) in enumerate(zip(chain,chain[1:])):tn.limb(ms,'vr_bark',a,b,h*(.061-.01*k),h*(.046-.009*k),segs=seg,lod=level,only=(level,))
        branches=5 if level==0 else 2
        for k in range(branches):
            z=h*(.28+k*.13) if level==0 else h*(.40+k*.38)
            sign=-1 if k%2 else 1;r=h*(.34-.035*k) if level==0 else h*.28
            x=sign*r*.85
            if level==0:tn.limb(ms,'vr_bark',(0,0,z),(x,0,z+.035),h*.022,h*.01,segs=4,lod=0)
            tn.blob(ms,'vr_cold',(x,0,z+.045),r,(1,.70,.23),rng,.12,1,lod=level,only=(level,))
            # Thin discontinuous snow rests on branches, never a ground patch.
            tn.blob(ms,'vr_snow',(x+r*.14,0,z+.064),r*.71,(1,.68,.12),rng,.14,1,lod=level,only=(level,))

def fern_bush(ms,rng):
    for level,count in ((0,9),(1,6),(2,5)):
        for k in range(count):
            a=k*2*math.pi/count;end=(math.cos(a)*.14,math.sin(a)*.14,.09+(k%3)*.028)
            blade(ms,'vr_frond',(0,0,.012),end,.034,level,(level,))

def winter_bush(ms,rng):
    for level,count in ((0,8),(1,4),(2,3)):
        for k in range(count):
            a=k*2*math.pi/count;end=(math.cos(a)*.07,math.sin(a)*.07,.105+(k%3)*.012)
            tn.limb(ms,'vr_winter_twig',(0,0,0),end,.005,.002,segs=3,lod=level,only=(level,),caps=False)
            if level==0:tn.limb(ms,'vr_winter_twig',(end[0]*.6,end[1]*.6,end[2]*.6),(end[0]*1.2,end[1]*1.2,end[2]*.80),.003,.0015,segs=3,lod=0,caps=False)

def kit_felled(ms,rng,bark,leaf,kit):
    tn.felled(ms,rng,.45,.03,bark=bark,leaf=leaf)
    if kit in ('tropical','cold'):
        for k in range(3):tn.blob(ms,'vr_moss',(-.11+k*.10,0,.055),.025,(1.4,.65,.3),rng,.1,1,lod=0)
    if kit=='cold':tn.blob(ms,'vr_snow',(-.06,.005,.061),.06,(2,.4,.12),rng,.1,1,lod=0)

def items(kit):
    cold=kit=='cold';tropical=kit=='tropical'
    if kit=='conifer':
        trees=(lambda m,r:spruce(m,r,.3,.09),lambda m,r:spruce(m,r,.5,.14),lambda m,r:spruce(m,r,.8,.20));heights=(.3,.5,.8)
    elif tropical:
        trees=(lambda m,r:tropical_broadleaf(m,r,.3,.13),sheet_palm,rainforest);heights=(.3,.5,.8)
    elif cold:
        trees=tuple((lambda m,r,h=h:wind_tree(m,r,h)) for h in (.2,.3,.5));heights=(.2,.3,.5)
    else:raise ValueError(kit)
    bark='vr_bark'
    leaf='vr_cold_scrub' if cold else 'vr_tropical' if tropical else 'vr_needle'
    rock='vr_cold_rock' if cold else 'vr_tropical_rock' if tropical else 'vr_rock'
    functions=list(trees)+[
        lambda m,r:tn.stump(m,r,.035,.06,bark=bark),
        lambda m,r:kit_felled(m,r,bark,leaf,kit),
        winter_bush if cold else fern_bush if tropical else lambda m,r:tn.bush(m,r,.072,leaf=leaf,n=3),
        lambda m,r:rocks(m,r,.055,rock),
        lambda m,r:rocks(m,r,.115,rock,True),
        lambda m,r:tn.grass_tuft(m,r,.045 if cold else .065,mat='vr_cold_grass' if cold else 'vr_grass',blades=9),
    ]
    return [(name,normalize_layout(fn,heights[k] if k<3 else None),None) for k,(name,fn) in enumerate(zip(ROOTS,functions))]
