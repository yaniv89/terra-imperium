"""Six original raid/landing props. CC0-1.0; no shared-module modifications.

Code preparation is safe without Blender: --prepare writes the target contract only.
Mesh construction requires the parent's sheet and its recorded visual review.
CLI: blender -b --factory-startup -t 4 --python-exit-code 1 -P SCRIPT -- OUT
     --sheet SHEET.png --sheet-review review.json [--only ID] [--install]
Module: python SCRIPT OUT --sheet SHEET.png --sheet-review review.json
"""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
REPO = SCRIPT_DIR.parents[1]
IDS = ('loot-sack', 'exit-marker', 'burnt-field-overlay',
       'landing-ancient', 'landing-middle', 'landing-modern')
# Props have no dedicated validator kind. These are explicit existing-kind checks,
# supplemented by stricter local caps from the small-prop quality bar.
CONTRACT = {
    'loot-sack': {'kind': 'node', 'caps': [800, 300, 80]},
    'exit-marker': {'kind': 'node', 'caps': [800, 300, 80]},
    'burnt-field-overlay': {'kind': 'terrain-kit', 'caps': [800, 300, 80]},
    **{name: {'kind': 'prefab', 'caps': [8000, 2000, 400]} for name in IDS[3:]},
}
for _id, _row in CONTRACT.items():
    _row.update(root=_id, target=f'src/assets/battle/props/{_id}.glb', atlas=1024)


def parser():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('out', type=Path)
    p.add_argument('--prepare', action='store_true')
    p.add_argument('--sheet', type=Path)
    p.add_argument('--sheet-review', type=Path)
    p.add_argument('--only', choices=IDS, action='append', help='Build selected ids; may be repeated')
    p.add_argument('--install', action='store_true', help='Copy only the six new GLBs to their target paths')
    p.add_argument('--threads', type=int, default=1, choices=range(1, 5))
    return p


def checked_sheet(args):
    if not args.sheet or not args.sheet.is_file() or not args.sheet_review or not args.sheet_review.is_file():
        raise ValueError('Mesh build is waiting for the parent 2D sheet and a recorded visual review.')
    review = json.loads(args.sheet_review.read_text())
    digest = hashlib.sha256(args.sheet.read_bytes()).hexdigest()
    if review.get('sheet_sha256') != digest or review.get('visually_reviewed') is not True:
        raise ValueError('The sheet review must record visual inspection of this exact sheet hash.')
    if not all(name in review.get('items', {}) for name in IDS):
        raise ValueError('The sheet review must cover all six props, including dimensions and design notes.')
    return digest, review


def profiles(ms, material, profile, at, segments):
    ms.lathe(material, profile, at=at, segs=segments, lod=2)


def loot(ms, level, rng, h):
    n = (10, 7, 4)[level]
    main = [(0.017, 0), (.0275, .020), (.025, .050), (.009, .065)]
    small = [(0.015, 0), (.020, .025), (.007, .046)]
    jar = [(.010, 0), (.020, .025), (.011, .048), (.012, .060)]
    profiles(ms, 'rlp_canvas', main, (-.025, .008, 0), n)
    profiles(ms, 'rlp_canvas', small, (.026, .028, 0), n)
    if level<2:jar += [(.008,.060),(.008,.048)]
    profiles(ms, 'rlp_clay', jar, (.021, -.023, 0), n)
    if level < 2:
        h.torus(ms,'rlp_rope',(-.025,.008,.063),.011,.0025,around=(10 if level==0 else 8))
        ms.sphere('rlp_canvas', .007, at=(-.025, .008, .066), u=6, v=4)
        for x in (.004, .038):
            h.rod(ms, 'rlp_clay', (x, -.023, .029), (x, -.023, .051), .0025, 6)
    if level == 0:
        profiles(ms,'rlp_canvas',[(.009,.065),(.014,.073),(.012,.078)],(-.025,.008,0),n)
        h.rod(ms, 'rlp_rope', (-.034, .008, .061), (-.013, .008, .043), .0025, 6)


def exit_prop(ms, level, rng, h):
    h.rod(ms, 'rlp_wood', (-.12, .07, 0), (-.12, .07, .25), .006, (8, 6, 4)[level])
    h.slab(ms,'rlp_team',[(-.12,.07,.235),(0,.07,.235),(-.028,.07,.202),(0,.07,.170),(-.12,.07,.170)],.003)
    if level<2:
        h.torus(ms,'rlp_rope',(-.12,.07,.177),.008,.002,around=8)
    if level==0:
        h.torus(ms,'rlp_rope',(-.12,.07,.231),.008,.002,around=8)
    ms.sphere('rlp_stone',.033,at=(-.12,.07,.019),scale=(1,.8,.57),u=(6 if level<2 else 4),v=(4 if level<2 else 3))
    # Raised arrow silhouette points toward the local -Y exit. No lettering/emblem.
    points=[(-.115,.055,.112),(-.115,.055,.132),(-.115,-.010,.132),
            (-.115,-.010,.145),(-.115,-.060,.122),(-.115,-.010,.099),(-.115,-.010,.112)]
    h.slab(ms, 'rlp_wood_light', points, .004)


def burnt(ms, level, rng, h):
    h.overlay_patch(ms, segments=(24, 18, 12)[level], rx=.20, ry=.20)
    # Original procedural ash/char detail, plus a few readable burnt stalks.
    count=(20, 10, 3)[level]
    for k in range(count):
        angle=rng.random()*math.tau; radius=math.sqrt(rng.random())*.13
        x=math.cos(angle)*radius; y=math.sin(angle)*radius
        ms.box('rlp_char', (.004, .004, .012), at=(x, y, .001), rot_z=rng.uniform(-8, 8))
    if level<2:
        for k in range((8,4)[level]):
            angle=rng.random()*math.tau; radius=math.sqrt(rng.random())*.13
            ms.sphere('rlp_char',.008,at=(math.cos(angle)*radius,math.sin(angle)*radius,.002),scale=(1.4,1,.33),u=(6 if level==0 else 4),v=3)
    if level == 0:
        for k in range(6):
            ms.box('rlp_ash', (.15, .005, .002), at=(0, -.075+k*.03, .001), rot_z=1)


def boat(ms, level, h, x, y, length, width, material='rlp_wood', modern=False, height=.12):
    h.hull(ms, material, x, y, length, width, modern=modern, level=level, height=height)
    ms.box(material, (width*.72, length*.68, .008), at=(x, y, height*.38))
    if level < 2:
        for k in range((6, 3)[level]):
            ms.box('rlp_wood_light', (width*.84, .012, .009), at=(x, y+length*(k*.10-.25), height*.67))
        for side in (-1,1):
            h.rod(ms, material, (x+side*width*.47,y-length*.30,height*.96),
                  (x+side*width*.47,y+length*.30,height*.96), .006, 6)


def plank(ms, h, x, y, width=.08, length=.25, high=.09, material='rlp_wood_light'):
    h.slab(ms, material, [(x-width/2,y,.004), (x+width/2,y,.004),
              (x+width/2,y+length,high), (x-width/2,y+length,high)], .004)


def ancient(ms, level, rng, h):
    boat(ms, level, h, 0, .13, 1.8, .30, height=.24)
    plank(ms,h,0,-1.04,.12,.37,.15)
    h.rod(ms,'rlp_wood',(0,.13,.12),(0,.13,.76),.009,(8,6,4)[level])
    # Beached galley: furled canvas on a yard, not a deployed rectangular sail.
    h.rod(ms,'rlp_canvas',(-.24,.13,.66),(.24,.13,.66),.026,(10,6,4)[level])
    h.rod(ms,'rlp_wood',(-.27,.13,.67),(.27,.13,.67),.006,(8,6,4)[level])
    ms.box('rlp_team',(.075,.003,.040),at=(.037,.13,.71))
    for y in (-.75,.99):
        h.rod(ms,'rlp_wood',(0,y,.12),(0,y,.37),.012,(8,6,4)[level])
    if level < 2:
        for side in (-1,1):
            for k in range((8,4)[level]):
                y=-.48+k*(.15 if level==0 else .30)
                h.rod(ms,'rlp_wood_light',(side*.11,y,.15),(side*.40,y-.08,.018),.004,6)
        for y in (-.61,.84):h.rod(ms,'rlp_rope',(0,.13,.72),(0,y,.18),.003,6)
        if level==0:
            for x in (-.17,-.085,0,.085,.17):h.rod(ms,'rlp_rope',(x,.13,.628),(x,.13,.694),.0025,6)


def middle(ms, level, rng, h):
    for x in (-.32,.32):
        boat(ms,level,h,x,-1.3,.5,.19,height=.12)
        plank(ms,h,x,-1.8,.075,.29,.07)
    boat(ms,level,h,0,.46,3.0,.80,'rlp_wood_dark',height=.30)
    ms.box('rlp_wood',(.58,.48,.21),at=(0,1.48,.16))
    ms.box('rlp_wood',(.46,.31,.14),at=(0,-.72,.16))
    for y,top,width in [(-.22,1.04,.53),(.52,1.22,.63),(1.19,.92,.38)]:
        h.rod(ms,'rlp_wood',(0,y,.18),(0,y,top),.010,(8,6,4)[level])
        # Canvas square sails and wooden yards, with the Team pennant separate.
        for z,wid,ht in [(top-.40,width,.24),(top-.16,width*.65,.14)]:
            ms.box('rlp_canvas',(wid,.006,ht),at=(0,y,z))
            if level<2:h.rod(ms,'rlp_wood',(-wid*.54,y,z+ht),(wid*.54,y,z+ht),.004,6)
        if level<2:
            h.rod(ms,'rlp_rope',(0,y,top-.02),(-.31,y+.18,.27),.003,6)
            h.rod(ms,'rlp_rope',(0,y,top-.02),(.31,y+.18,.27),.003,6)
    ms.box('rlp_team',(.13,.003,.050),at=(.065,.52,1.15))
    if level==0:
        for x in (-.305,.305):
            for k in range(4):ms.box('rlp_glass',(.008,.040,.045),at=(x,1.27+k*.105,.27))


def modern(ms, level, rng, h):
    boat(ms,level,h,0,.12,1.0,.30,'rlp_steel',modern=True,height=.23)
    plank(ms,h,0,-.70,.25,.33,.09,'rlp_steel')
    ms.box('rlp_olive',(.17,.19,.14),at=(0,.49,.15),bevel=.002 if level==0 else 0)
    ms.box('rlp_team',(.055,.003,.035),at=(0,.587,.215))
    if level<2:
        ms.box('rlp_glass',(.085,.003,.042),at=(0,.393,.215))
        for side in (-1,1):
            h.rod(ms,'rlp_steel',(side*.14,-.30,.23),(side*.14,.39,.23),.004,6)
            for k in range((6,3)[level]):
                y=-.25+k*(.12 if level==0 else .24)
                h.rod(ms,'rlp_steel_light',(side*.145,y,.09),(side*.145,y,.225),.004,6)
    if level==0:
        for k in range(5):ms.box('rlp_steel_light',(.24,.01,.003),at=(0,-.68+k*.067,.012+k*.017))


LAYOUTS = dict(zip(IDS, (loot, exit_prop, burnt, ancient, middle, modern)))


def main(argv=None):
    args=parser().parse_args(argv);args.out.mkdir(parents=True,exist_ok=True)
    if args.prepare:
        record={'status':'prepared_waiting_for_parent_sheet','mesh_built':False,
                'sheet_gate':'parent image plus hash-matched visual review for all six items',
                'items':CONTRACT,'threads_max':4,'atlas':1024,
                'target_mapping':'props README contract + artFiles glob + raidLandingProps exact resolver',
                'shared_module_edits':False,'renderer_edits':['src/battle/art/raidLandingProps.js','src/battle/render/BattleRenderer.js']}
        (args.out/'prepared-contract.json').write_text(json.dumps(record,indent=2));print(json.dumps(record,indent=2));return 0
    try:sheet_hash,review=checked_sheet(args)
    except ValueError as exc:raise SystemExit(str(exc)) from exc
    for key in ('OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS','LP_NUM_THREADS'):
        os.environ[key]=str(args.threads)
    sys.path.insert(0,str(SCRIPT_DIR))
    import raid_landing_support as support
    support.configure_threads(args.threads)
    for ident in (args.only if args.only else IDS):
        support.build_one(ident,LAYOUTS[ident],CONTRACT[ident],args.out,
                          sheet_hash,review['items'][ident],REPO,install=args.install)
    return 0


if __name__=='__main__':
    cli=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else sys.argv[1:]
    raise SystemExit(main(cli))
