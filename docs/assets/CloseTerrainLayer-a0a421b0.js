import{r as w,bB as q,bC as M,bD as K,bE as z,j as W}from"./index-12b28ca3.js";import{W as I,S as j,i as N,o as U,Y as V,b as A,dp as O,v as X,E as H,d as R,C as _}from"./three.module-136778e3.js";const Z=40075,m=[24,6,1.5],L=4,B=(i,l,n=1)=>i*l*n/Z,Y=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`,J=`
precision highp float;
uniform sampler2D uMap;
uniform vec2 uSize;      // texture size in pixels
uniform vec4 uGeo;       // lon0, lat0 (top edge), lon span, lat span (degrees)
uniform float uPxPerKm;  // device pixels per kilometre
varying vec2 vUv;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5; float s = 0.0; for (int i = 0; i < 3; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
float water(vec3 c) { return smoothstep(0.1, 0.2, c.b - c.r) * step(c.g, c.b + 0.08); }
float snow(vec3 c) { return smoothstep(0.58, 0.7, min(c.r, min(c.g, c.b))) * step(c.r, c.b + 0.004); }
float weight(float km) { float px = km * uPxPerKm; return smoothstep(${L.toFixed(1)}, ${(L*4).toFixed(1)}, px); }

void main() {
  // The four nearest pixels and the blend between them.
  vec2 st = vUv * uSize - 0.5;
  vec2 i0 = floor(st); vec2 f = st - i0;
  vec3 c00 = texture2D(uMap, (i0 + vec2(0.5, 0.5)) / uSize).rgb;
  vec3 c10 = texture2D(uMap, (i0 + vec2(1.5, 0.5)) / uSize).rgb;
  vec3 c01 = texture2D(uMap, (i0 + vec2(0.5, 1.5)) / uSize).rgb;
  vec3 c11 = texture2D(uMap, (i0 + vec2(1.5, 1.5)) / uSize).rgb;
  float w00 = water(c00); float w10 = water(c10); float w01 = water(c01); float w11 = water(c11);
  vec4 bw = vec4((1.0 - f.x) * (1.0 - f.y), f.x * (1.0 - f.y), (1.0 - f.x) * f.y, f.x * f.y);
  float m = dot(bw, vec4(w00, w10, w01, w11));
  vec3 blend = c00 * bw.x + c10 * bw.y + c01 * bw.z + c11 * bw.w;
  // Each side's own colour: the pixels of that class, weighted by nearness.
  vec4 ww = bw * vec4(w00, w10, w01, w11); vec4 lw = bw - ww;
  float sw = dot(ww, vec4(1.0)); float sl = dot(lw, vec4(1.0));
  vec3 waterC = sw > 0.001 ? (c00 * ww.x + c10 * ww.y + c01 * ww.z + c11 * ww.w) / sw : blend;
  vec3 landC = sl > 0.001 ? (c00 * lw.x + c10 * lw.y + c01 * lw.z + c11 * lw.w) / sl : blend;
  // Snow and glaciers get the same clean cut against bare ground.
  vec4 iw = lw * vec4(snow(c00), snow(c10), snow(c01), snow(c11)); vec4 gw = lw - iw;
  float si = dot(iw, vec4(1.0)); float sg = dot(gw, vec4(1.0));
  if (si > 0.001 && sg > 0.001) {
    float mi = si / (si + sg);
    float ai = max(fwidth(mi) * 0.8, 0.002);
    vec3 iceC = (c00 * iw.x + c10 * iw.y + c01 * iw.z + c11 * iw.w) / si;
    vec3 groundC = (c00 * gw.x + c10 * gw.y + c01 * gw.z + c11 * gw.w) / sg;
    landC = mix(groundC, iceC, smoothstep(0.5 - ai, 0.5 + ai, mi));
  }
  float aa = max(fwidth(m) * 0.8, 0.002);
  float isWater = smoothstep(0.5 - aa, 0.5 + aa, m);

  // World kilometres for the noise.
  float lat = uGeo.y - (1.0 - vUv.y) * uGeo.w; // v is 1 at the top edge
  float lon = uGeo.x + vUv.x * uGeo.z;
  float cl = cos(radians(lat));
  vec2 km = vec2(lon * 111.32 * cl, lat * 110.57);

  float w1 = weight(${m[0].toFixed(1)}); float w2 = weight(${m[1].toFixed(1)}); float w3 = weight(${m[2].toFixed(1)});
  // Land: what kind of ground the colour says.
  float lum = dot(landC, vec3(0.299, 0.587, 0.114));
  float green = clamp((landC.g - max(landC.r, landC.b)) * 6.0, 0.0, 1.0);
  float sand = clamp((landC.r - landC.b) * 3.0 - green, 0.0, 1.0) * smoothstep(0.35, 0.55, lum);
  float sat = max(landC.r, max(landC.g, landC.b)) - min(landC.r, min(landC.g, landC.b));
  float rock = clamp(1.0 - sat * 6.0, 0.0, 1.0) * (1.0 - smoothstep(0.82, 0.9, lum));
  float n1 = fbm(km / ${m[0].toFixed(1)}) - 0.5;
  float n2 = fbm(km / ${m[1].toFixed(1)} + 31.0) - 0.5;
  float n3 = vnoise(km / ${m[2].toFixed(1)} + 7.0) - 0.5;
  float mottle = n1 * 0.24 * w1 + n2 * 0.2 * w2 * (0.5 + green) + n3 * 0.12 * w3;
  float ripple = sin(dot(km, vec2(0.83, 0.55)) * 3.2 + n2 * 9.0) * 0.05 * w3 * sand;
  float crag = (0.25 - abs(n2)) * 0.3 * w2 * rock + (0.2 - abs(n3)) * 0.18 * w3 * rock;
  // A small hillshade from the broad noise: light from the north-west.
  float hx = fbm((km + vec2(0.6, 0.0)) / ${m[1].toFixed(1)} + 31.0) - 0.5 - n2;
  float hy = fbm((km + vec2(0.0, 0.6)) / ${m[1].toFixed(1)} + 31.0) - 0.5 - n2;
  float hill = (hy - hx) * 2.2 * w2 * (0.4 + rock);
  vec3 land = landC * (1.0 + mottle + ripple + crag + hill);

  // Water: slow swells and a light rim along the shore.
  float wave = (vnoise(km / 3.0 + vec2(0.0, n1 * 3.0)) - 0.5) * 0.06 * w2 + (vnoise(km * vec2(1.4, 0.5)) - 0.5) * 0.05 * w3;
  float rim = smoothstep(0.5, 0.56, m) * (1.0 - smoothstep(0.56, 0.7, m));
  vec3 sea = waterC * (1.0 + wave) + vec3(0.12, 0.14, 0.12) * rim * w2;

  gl_FragColor = vec4(mix(land, sea, isWater), 1.0);
}
`,$=96,D=(i,l,n)=>new O({vertexShader:Y,fragmentShader:J,uniforms:{uMap:{value:i},uSize:{value:new X(l[0],l[1])},uGeo:{value:new H(n[0],n[1],n[2],n[3])},uPxPerKm:{value:1}},depthTest:!1,depthWrite:!1}),G=i=>(i.magFilter=R,i.minFilter=R,i.generateMipmaps=!1,i.wrapS=_,i.wrapT=_,i.needsUpdate=!0,i),te=({rasterRect:i,worldUrl:l,worldSize:n,transform:T,width:C,height:E,active:b,onReady:F})=>{const S=w.useRef(null),p=w.useRef(null),c=w.useRef(F);c.current=F;const P=w.useRef(null);return w.useEffect(()=>{const e=S.current;if(!e)return;let a;try{a=new I({canvas:e,alpha:!1,antialias:!1,powerPreference:"low-power"})}catch{return}a.setPixelRatio(Math.min(2,window.devicePixelRatio||1)),a.setClearColor("#0f172a",1);const r=new j,d=new N(0,1,0,-1,-10,10),u=new U(1,1).translate(.5,-.5,0),k=new V,o={renderer:a,scene:r,camera:d,quad:u,loader:k,tiles:new Map,world:null,dirty:!0,disposed:!1};p.current=o;let f=0;return o.request=()=>{o.dirty=!0,!f&&(f=requestAnimationFrame(()=>{var v;f=0,!(o.disposed||!o.dirty)&&((v=o.layout)==null||v.call(o),a.render(r,d),o.dirty=!1)}))},()=>{var v;o.disposed=!0,f&&cancelAnimationFrame(f),o.tiles.forEach(x=>{var g,h;(g=x.texture)==null||g.dispose(),(h=x.mesh)==null||h.material.dispose()}),o.world&&(o.world.texture.dispose(),o.world.mesh.material.dispose()),u.dispose(),a.dispose(),p.current=null,(v=c.current)==null||v.call(c,!1)}},[]),w.useEffect(()=>{var a;const e=p.current;!e||!l||((a=e.world)==null?void 0:a.url)===l||e.loader.load(l,r=>{var u;if(e.disposed){r.dispose();return}G(r),e.world&&(e.scene.remove(e.world.mesh),e.world.texture.dispose(),e.world.mesh.material.dispose());const d=new A(e.quad,D(r,[n,n/2],[-180,90,360,180]));d.renderOrder=0,d.frustumCulled=!1,e.scene.add(d),e.world={url:l,texture:r,mesh:d},e.request(),(u=c.current)==null||u.call(c,!0)},void 0,()=>{var r;return(r=c.current)==null?void 0:r.call(c,!1)})},[l,n]),P.current={rasterRect:i,transform:T,width:C,height:E,active:b},w.useEffect(()=>{const e=p.current;e&&(e.layout=()=>{const a=P.current;if(!a.active||!a.rasterRect||a.width<=0||a.height<=0)return;const{k:r,x:d,y:u}=a.transform,k=Math.min(2,window.devicePixelRatio||1);e.renderer.setSize(a.width,a.height,!1),e.camera.left=0,e.camera.right=a.width,e.camera.top=0,e.camera.bottom=-a.height,e.camera.updateProjectionMatrix();const o=B(a.rasterRect.width,r,k),f=(t,s)=>{t.position.set(s.x*r+d,-(s.y*r+u),0),t.scale.set(s.width*r,s.height*r,1),t.material.uniforms.uPxPerKm.value=o};e.world&&f(e.world.mesh,a.rasterRect);const v=q({raster:a.rasterRect,transform:a.transform,width:a.width,height:a.height,forceZ:M,margin:0}),x=2**(M+1),g=2**M,h=new Set;v.forEach(t=>{h.add(t.key);let s=e.tiles.get(t.key);s||(s={key:t.key,mesh:null,texture:null,used:0},e.tiles.set(t.key,s),e.loader.load(K(t.z,t.x,t.y),y=>{if(e.disposed||!e.tiles.has(t.key)){y.dispose();return}G(y),s.texture=y,s.mesh=new A(e.quad,D(y,[z,z],[-180+t.x*360/x,90-t.y*180/g,360/x,180/g])),s.mesh.renderOrder=1,s.mesh.frustumCulled=!1,s.rect=t.rect,e.scene.add(s.mesh),e.request()},void 0,()=>{})),s.used=performance.now(),s.mesh&&(s.mesh.visible=!0,f(s.mesh,t.rect))}),e.tiles.forEach((t,s)=>{!h.has(s)&&t.mesh&&(t.mesh.visible=!1)}),e.tiles.size>$&&[...e.tiles.values()].filter(t=>!h.has(t.key)).sort((t,s)=>t.used-s.used).slice(0,e.tiles.size-$).forEach(t=>{var s;t.mesh&&(e.scene.remove(t.mesh),t.mesh.material.dispose()),(s=t.texture)==null||s.dispose(),e.tiles.delete(t.key)})})},[]),w.useEffect(()=>{var e;b&&((e=p.current)==null||e.request())},[b,i,T,C,E]),W.jsx("canvas",{ref:S,"data-testid":"close-terrain",className:"absolute inset-0 pointer-events-none",style:{width:C,height:E,visibility:b?"visible":"hidden"}})};export{te as default};
//# sourceMappingURL=CloseTerrainLayer-a0a421b0.js.map
