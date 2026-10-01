import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
const root=path.resolve('.');
const output=path.resolve(process.argv[2] || '../unit-model-review.html');
const source=`
import * as THREE from 'three';
import {getProceduralSoldierGeometry,getImposterGeometry} from './src/battle/render/soldierFactory.js';
import {UNIT_ROSTER} from './src/data/unitClasses.js';
const pairs=Object.entries(UNIT_ROSTER).flatMap(([age,roster])=>Object.entries(roster).filter(([cls])=>cls!=='naval').map(([cls,def])=>({age,cls,name:def.name})));
const gallery=document.querySelector('#gallery');
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.setSize(1200,Math.ceil(pairs.length/6)*230);gallery.append(renderer.domElement);
const overlay=document.querySelector('#labels');
pairs.forEach((p,i)=>{const el=document.createElement('div');el.style.left=(i%6*200)+'px';el.style.top=(Math.floor(i/6)*230+200)+'px';el.textContent=p.age+' · '+p.name;overlay.append(el);});
function render(){
  const far=document.querySelector('#detail').value==='far';
  renderer.setScissorTest(false);renderer.clear();renderer.setScissorTest(true);
  pairs.forEach((p,i)=>{
    const geometry=(far?getImposterGeometry(p.age,p.cls):getProceduralSoldierGeometry(p.age,p.cls)).clone();
    const colors=geometry.attributes.color,team=geometry.attributes.aTeam,blue=new THREE.Color('#557ca6');
    for(let n=0;n<team.count;n++)if(team.getX(n)>0.5)colors.setXYZ(n,blue.r,blue.g,blue.b);
    const scene=new THREE.Scene();scene.add(new THREE.HemisphereLight('#e5edf7','#6d6455',2.2));
    const sun=new THREE.DirectionalLight('#fff1da',2.5);sun.position.set(-2,4,3);scene.add(sun);
    const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:.12});
    const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);
    const box=geometry.boundingBox,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());mesh.position.sub(center);
    const extent=Math.max(size.y,size.x,size.z)*.7;
    const camera=new THREE.OrthographicCamera(-extent,extent,extent, -extent,.1,30);camera.position.set(2,1.2,3);camera.lookAt(0,0,0);
    const x=i%6*200,y=renderer.domElement.height/renderer.getPixelRatio()-(Math.floor(i/6)+1)*230;
    renderer.setViewport(x,y,200,230);renderer.setScissor(x,y+30,200,200);renderer.render(scene,camera);
    geometry.dispose();material.dispose();
  });
  document.querySelector('#status').textContent=far?'Distant meshes retain equipment and mounts':'Near meshes with smooth anatomical surfaces';
}
document.querySelector('#detail').addEventListener('change',render);render();
`;
const result=await build({stdin:{contents:source,resolveDir:root,sourcefile:'review.js'},bundle:true,write:false,minify:true,format:'iife',tsconfigRaw:{},plugins:[{name:'review-sources',setup(b){b.onResolve({filter:/.*/},a=>{
let target=a.path==='three'?path.join(root,'node_modules/three/build/three.module.js'):a.path.startsWith('three/')?path.join(root,'node_modules',a.path):path.resolve(a.importer?path.dirname(a.importer):root,a.path);
target=[target,target+'.js'].find(p=>fs.existsSync(p)&&fs.statSync(p).isFile());if(!target)throw Error(a.path);return{path:target,namespace:'review'};
});b.onLoad({filter:/.*/,namespace:'review'},a=>({contents:fs.readFileSync(a.path,'utf8'),loader:'js'}));}}]});
fs.writeFileSync(output,`<!doctype html><meta charset="utf-8"><title>Terra Imperium — unit model review</title><style>body{margin:24px;background:#202830;color:#edf0f3;font:15px system-ui}h1{font-size:24px}select{padding:8px;background:#354352;color:white;border:1px solid #66788a;border-radius:6px}#gallery{position:relative;width:1200px;margin-top:20px}#labels{position:absolute;inset:0;pointer-events:none}#labels div{position:absolute;width:200px;text-align:center;font-size:12px;color:#c6d2dd}p{color:#c6d2dd}</style><h1>Unit model review</h1><p>Inspect each unit's equipment and silhouette. This preview uses the game's geometry under a neutral studio light.</p><select id="detail" aria-label="Model detail"><option value="near">Near detail</option><option value="far">Distant detail</option></select><p id="status"></p><div id="gallery"><div id="labels"></div></div><script>${result.outputFiles[0].text.replaceAll('</script','<\\/script')}</script>`);
console.log(output);
