# Original procedural tundra, CC0-1.0, 2026-10-07.
# Blender 5.2: -b --factory-startup -P scripts/blender/build_tundra_ground.py -- art-build/tundra
import os, sys, json
sys.path.insert(0, os.path.dirname(__file__))
import bpy
import numpy as np
from build_ground_materials import N, spectral, hexc, ramp, ao_of, save_png

def smooth(x, a, b):
    t=np.clip((x-a)/(b-a),0,1)
    return t*t*(3-2*t)

def tundra(seed=20261007):
    rng=np.random.default_rng(seed)
    patch=spectral(rng,2.9,2,18)
    stone=spectral(rng,2.1,12,90)
    grit=spectral(rng,.8,95,360)
    blades=spectral(rng,1.3,65,290,aniso=(1,.45))
    moss=spectral(rng,2.3,5,45)
    peat=ramp(.65*patch+.35*grit,[(0,'#66594b'),(.45,'#887865'),(1,'#a0947d')])
    rock=ramp(.65*stone+.35*grit,[(0,'#707774'),(.5,'#909692'),(1,'#afb4ad')])
    lich=ramp(.75*moss+.25*grit,[(0,'#77846a'),(.5,'#9fa88a'),(1,'#bcc2a1')])
    grass=ramp(.45*moss+.55*blades,[(0,'#646c50'),(.5,'#8b8b60'),(1,'#adab79')])
    rm=smooth(patch,.48,.68)*.85
    lm=smooth(moss,.52,.7)*smooth(stone,.3,.65)*.72
    gm=smooth(1-patch,.46,.72)*smooth(moss,.37,.61)*.5
    col=peat*(1-rm[...,None])+rock*rm[...,None]
    col=col*(1-lm[...,None])+lich*lm[...,None]
    col=col*(1-gm[...,None])+grass*gm[...,None]
    height=.24*patch+.31*stone+.26*grit+.19*blades
    ao=ao_of(height,strength=.46,radius=5)
    col*= (.7+.3*ao)[...,None]
    return np.clip(col,0,1),height,ao

def main():
    args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
    out=os.path.abspath(args[0] if args else 'art-build/tundra')
    os.makedirs(os.path.join(out,'tundra'),exist_ok=True)
    col,h,ao=tundra()
    save_png(os.path.join(out,'tundra','color.png'),col)
    tiled=np.tile(col,(2,2,1))
    im=bpy.data.images.new('tundra 2x2',width=2*N,height=2*N,alpha=False)
    rgba=np.dstack([tiled,np.ones(tiled.shape[:2])])
    im.pixels.foreach_set(rgba[::-1].astype(np.float32).ravel())
    im.filepath_raw=os.path.join(out,'tundra-2x2.png'); im.file_format='PNG'; im.save()
    report={'seed':20261007,'size':[N,N],'license':'CC0-1.0','pipeline':'Blender 5.2 periodic FFT noise; color plus baked AO only','rgb_mean':col.mean((0,1)).tolist(),'white_fraction':float(np.mean(np.min(col,axis=2)>.82))}
    for axis,label in [(0,'vertical'),(1,'horizontal')]:
        interior=np.sqrt(np.mean(np.diff(col,axis=axis)**2,axis=2))
        seam=np.sqrt(np.mean((np.take(col,0,axis=axis)-np.take(col,-1,axis=axis))**2,axis=1))
        report[label]={'seam_rms':float(np.sqrt(np.mean(seam**2))),'interior_rms':float(np.sqrt(np.mean(interior**2))),'ratio':float(np.sqrt(np.mean(seam**2))/np.sqrt(np.mean(interior**2)))}
    assert all(report[k]['ratio']<1.25 for k in ['vertical','horizontal']),report
    json.dump(report,open(os.path.join(out,'synthesis-audit.json'),'w'),indent=2)
    print(json.dumps(report));sys.stdout.flush();os._exit(0)
if __name__=='__main__':main()

