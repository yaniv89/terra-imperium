import{V as Xt,g as ae,Y as Jo,r as I,a as es,j as rt,a3 as ts}from"./index-0526b255.js";import{i as Fe,g as ns,w as An,s as Ve,d as os,c as ss}from"./worldRaster-f135ea56.js";import{R as Le,L as ge,M as Ye,N as rs,O as He,P as as,Q as ls,S as is,T as En,U as Jt,V as cs,W as fs,X as us,Y as ds,H as hs,I as ps,Z as Tn,_ as ms,$ as ws,a0 as gs,a1 as vs,g as Cn,y as ks,l as bs,d as ys,t as Ms,s as Ss,f as As,h as Es,a2 as Ts,a3 as Cs,a4 as Ps,a5 as Is,u as Ls,a6 as $s,a7 as Os,q as Rs,r as Fs,a8 as _s,a9 as zs,aa as Ns,ab as yt,ac as Ds,ad as xs,ae as zt,af as Ws,ag as Nt,ah as Us,ai as Bs,aj as Gs,ak as js,al as at,am as qs,w as Vs,F as Ks,an as Hs,A as Xs,B as Zs,n as Ys,ao as Pn,i as Qs,ap as Dt,E as Js,aq as er,ar as tr,C as In,K as nr,as as or}from"./App-5bf6830d.js";import{as as Be,d$ as Lt,ad as Te,s as We,aq as Je,z as vo,C as ko,ah as bo,bh as Ne,N as Ce,Z as Se,ai as de,bj as yo,dZ as Mo,j as Ue,aQ as At,V as So,T as sr,dJ as Ao,av as rr,p as ar,bb as Et,R as lr,f as ir,ar as cr,H as fr,k as ur,aw as dr,G as hr}from"./three.module-934c39c3.js";import{hO as pr,dX as mr,hR as wr,hr as Eo,hs as gr,ht as pe,hu as To,hQ as Ln,hT as $n,hS as On,h_ as vr,hx as kr,hY as Rn,hZ as br,gQ as yr,J as Co,q as Mr,h5 as Sr}from"./buildBattleSetup-4616034d.js";import{C as Ar,D as Er}from"./rasterLook-de22fccd.js";import{R as Tr}from"./unitModels-029744d8.js";import{M as Cr,m as Pr,r as Ir,P as Lr,p as $r,c as Or,a as Rr,l as Fr}from"./closeViewScene-a447735d.js";import{c as _r,T as en,p as zr,a as Nr}from"./terrainShader-4d33137c.js";import{h as tn,c as Dr}from"./nations-68d2b1d6.js";import"./polygon-clipping.esm-6fdcc057.js";import"./tileGeometry-ab3a65ba.js";import"./audioContext-60a60510.js";import"./BufferGeometryUtils-5dff834c.js";import"./groundMaterials-7ed1caa0.js";const Z=1024,he=1024,Ae=512,Po=3,Fn=new WeakMap,_n=(e,t)=>e[0]*t[0]+e[1]*t[1]+e[2]*t[2],xr=(e,t,n,r=64)=>{let a=n;for(let o=0;o<r;o++){let s=_n(e.centres[a],t),i=a;const l=e.neighbors[a];for(let d=0;d<l.length;d++){const f=_n(e.centres[l[d]],t);f>s&&(s=f,i=l[d])}if(i===a)return a;a=i}return a},Wr=(e,t)=>{const n=e*Math.PI/180,r=t*Math.PI/180;return[Math.cos(n)*Math.cos(r),Math.cos(n)*Math.sin(r),Math.sin(n)]},zn=(e,t,n=he,r=Ae)=>({lat:90-(t+.5)*180/r,lon:-180+(e+.5)*360/n}),Nn=(e,t)=>Math.ceil(e*t/Z),Zt=e=>{const t=Fn.get(e);if(t)return t;const n=e.count,r=Nn(n,1),a=new Float32Array(Z*r*4);for(let f=0;f<n;f++){const u=e.centres[f];a[f*4]=u[0],a[f*4+1]=u[1],a[f*4+2]=u[2],a[f*4+3]=e.land[f]===1?1:0}const o=Nn(n,2),s=new Float32Array(Z*o*4).fill(-1);for(let f=0;f<n;f++){const u=e.neighbors[f];for(let m=0;m<u.length&&m<6;m++)s[f*8+m]=u[m]}const i=new Float32Array(he*Ae);let l=0;for(let f=0;f<Ae;f++){const{lat:u}=zn(0,f),m=e.nearest(u,-180+180/he);l=m!=null&&m>=0?m:l;for(let w=0;w<he;w++){const c=zn(w,f);l=xr(e,Wr(c.lat,c.lon),l),i[f*he+w]=l}}const d={count:n,rows:r,centres:a,neighbours:s,neighbourRows:o,lookup:i};return Fn.set(e,d),d},Io=Object.freeze(["water","ice","rock","desert","steppe","grassland","forest","rainforest","tundra","wetland","irrigated"]),nn=()=>{const e=typeof import.meta<"u"&&{VITE_SUPABASE_URL:"https://visxnnbemirhpigvwiry.supabase.co",VITE_SUPABASE_ANON_KEY:"sb_publishable_aobvW_XKHP6bO_-KLq12mA_XdSpu80U",BASE_URL:"/terra-imperium/",MODE:"production",DEV:!1,PROD:!0,SSR:!1}&&"/terra-imperium/"||"/";return e.endsWith("/")?e:`${e}/`},Ur=()=>`${nn()}map/tiles/detail.json`,Br=(e,t,n)=>`${nn()}map/tiles/${e}/${t}-${n}.webp`,Gr=(e,t,n)=>`${nn()}map/cover/${e}/${t}-${n}.png`,jr=e=>{var a,o;const t=new Map,n=new Map;return Object.entries((e==null?void 0:e.detail)||{}).forEach(([s,i])=>t.set(Number(s),new Set(i))),Object.entries(((a=e==null?void 0:e.cover)==null?void 0:a.levels)||{}).forEach(([s,i])=>n.set(Number(s),new Set(i))),{maxZ:Math.max(Le,...t.keys()),classes:((o=e==null?void 0:e.cover)==null?void 0:o.classes)||Io,hasColour:(s,i,l)=>{var d;return s<=Le||!!((d=t.get(s))!=null&&d.has(`${i}-${l}`))},hasCover:(s,i,l)=>{var d;return!!((d=n.get(s))!=null&&d.has(`${i}-${l}`))},coverLevels:[...n.keys()].sort((s,i)=>s-i)}},qr=(e,t,n,r)=>{let a=Math.min(t,e.maxZ),o=n>>t-a,s=r>>t-a;for(;a>0&&!e.hasColour(a,o,s);)a--,o>>=1,s>>=1;const i=2**(t-a),l=(n-o*i)/i,d=(r-s*i)/i;return{z:a,x:o,y:s,url:Br(a,o,s),u0:l,v0:d,u1:l+1/i,v1:d+1/i}};let Dn=null;const Vr=()=>(Dn||(Dn=fetch(Ur()).then(e=>e.ok?e.json():null).then(e=>e?jr(e):null).catch(()=>null)),Dn),ce=Object.fromEntries(Io.map((e,t)=>[e,t])),Kr=1,Hr=2,Xr=4,Zr=({feature:e,koppen:t})=>t==="EF"?ce.ice:e==="marsh"?ce.wetland:e==="oasis"||e==="floodplain"?ce.irrigated:e==="jungle"?ce.rainforest:e==="forest"?ce.forest:t?t==="ET"?ce.tundra:t.startsWith("BW")?ce.desert:t.startsWith("BS")||t==="Csa"||t==="Csb"?ce.steppe:t==="Af"||t==="Am"?ce.rainforest:/^D.[cd]$/.test(t)?ce.forest:ce.grassland:ce.grassland,xn=new WeakMap,Yr=e=>{const t=xn.get(e);if(t)return t;const n=e.count,r=Math.ceil(n*2/Z),a=new Float32Array(Z*r*4),o=e.terrainNames,s=e.featureNames,i=o.indexOf("lake"),l=o.indexOf("snow"),d=s.indexOf("ice"),f=w=>e.land[w]===1&&e.terrain[w]!==i,u=w=>{const c=e.climate&&e.climate[w]>=0?e.climateNames[e.climate[w]]:null;return c&&Ar[c]||Er};for(let w=0;w<n;w++){const c=f(w);let y=u(w);if(!c){const E=e.neighbors[w].find(f);E!=null&&(y=u(E))}const M=e.terrain[w]===i,k=e.feature[w]===d||e.terrain[w]===l,p=e.elevation[w],h=w*8;a[h]=y[0]/255,a[h+1]=y[1]/255,a[h+2]=y[2]/255,a[h+3]=c?Math.max(p,2):Math.min(p,-80);const g=e.climate&&e.climate[w]>=0?e.climateNames[e.climate[w]]:null,A=c?Zr({feature:s[e.feature[w]],koppen:g}):ce.water;a[h+4]=(c?Kr:0)+(M?Hr:0)+(k?Xr:0)+8*A,a[h+5]=e.roughness?e.roughness[w]:50,a[h+6]=e.rivers?e.rivers[w]:0,a[h+7]=e.riverSize?e.riverSize[w]:0}const m={data:a,rows:r};return xn.set(e,m),m},Yt=6371,Wn=.0095,Un=.0115,xt=[0,.9,1.6,2.6],Qr=.12,Jr=7,ea=`
out vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
`,ta=`
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uCentres;
uniform sampler2D uNeigh;
uniform sampler2D uLookup;
uniform sampler2D uPaint;
uniform vec4 uGeo;     // lon0, lat0 (the top edge), lon span, lat span (radians)
uniform float uKmPx;   // km a pixel north to south
uniform float uMode;   // 0 colour, 1 land cover class
uniform float uSeed;
in vec2 vUv;
out vec4 fragColor;

const float PI = 3.14159265358979;
const float R_KM = ${Yt.toFixed(1)};
ivec2 at(int i) { return ivec2(i % ${Z}, i / ${Z}); }
vec4 centreOf(int i) { return texelFetch(uCentres, at(i), 0); }
vec4 paintA(int i) { return texelFetch(uPaint, at(i * 2), 0); }
vec4 paintB(int i) { return texelFetch(uPaint, at(i * 2 + 1), 0); }
void neighbours(int i, out int n[6]) {
  vec4 a = texelFetch(uNeigh, at(i * 2), 0);
  vec4 b = texelFetch(uNeigh, at(i * 2 + 1), 0);
  n[0] = int(floor(a.x + 0.5)); n[1] = int(floor(a.y + 0.5)); n[2] = int(floor(a.z + 0.5)); n[3] = int(floor(a.w + 0.5));
  n[4] = int(floor(b.x + 0.5)); n[5] = int(floor(b.y + 0.5));
}
vec3 unitOf(float lon, float lat) { float cl = cos(lat); return vec3(cl * cos(lon), cl * sin(lon), sin(lat)); }
int walk(int a, vec3 p, int steps) {
  int n[6];
  for (int it = 0; it < 8; it++) {
    if (it >= steps) break;
    neighbours(a, n);
    float best = dot(p, centreOf(a).xyz); int next = a;
    for (int k = 0; k < 6; k++) {
      if (n[k] < 0) continue;
      float d = dot(p, centreOf(n[k]).xyz);
      if (d > best) { best = d; next = n[k]; }
    }
    if (next == a) break;
    a = next;
  }
  return a;
}
int tileAt(float lon, float lat, vec3 p) {
  int ix = clamp(int((lon + PI) / (2.0 * PI) * ${he}.0), 0, ${he-1});
  int iy = clamp(int((0.5 * PI - lat) / PI * ${Ae}.0), 0, ${Ae-1});
  return walk(int(floor(texelFetch(uLookup, ivec2(ix, iy), 0).r + 0.5)), p, ${Po+1});
}

// 3D value noise (seamless on the sphere), a seeded offset per world.
float hash3(vec3 q) { q = fract(q * 0.3183099 + 0.1); q *= 17.0; return fract(q.x * q.y * q.z * (q.x + q.y + q.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
// noise with a wavelength of wl km at p (-0.5 to 0.5), in its own band of the noise space
float nkm(vec3 p, float wl, float band) { return vnoise(p * (R_KM / wl) + vec3(band * 17.31 + uSeed, band * 5.17, band * 11.9 - uSeed)) - 0.5; }

// The seven tiles of the blend (the pixel's tile and its neighbours) and what they carry.
int T[7]; vec4 TA[7]; vec4 TB[7]; vec3 TC[7];
void gather(int a) {
  int n[6]; neighbours(a, n);
  T[0] = a;
  for (int k = 0; k < 6; k++) T[k + 1] = n[k];
  for (int j = 0; j < 7; j++) {
    if (T[j] < 0) { TA[j] = vec4(0.0); TB[j] = vec4(0.0); TC[j] = vec3(0.0); continue; }
    TA[j] = paintA(T[j]); TB[j] = paintB(T[j]); TC[j] = centreOf(T[j]).xyz;
  }
}
float flag(vec4 b, float bit) { return mod(floor(b.x / bit), 2.0); }
// the blend at p: x land share, y mean elevation, z roughness, w ice; colour and lake share out
vec4 blendAt(vec3 p, out vec3 colour, out float lake) {
  float ws = 0.0; float wls = 0.0; float ls = 0.0; vec4 s = vec4(0.0); vec3 c = vec3(0.0); float lk = 0.0;
  for (int j = 0; j < 7; j++) {
    if (T[j] < 0) continue;
    float d = dot(p, TC[j]);
    float w = exp(-(2.0 * (1.0 - d)) / ${(Wn*Wn).toExponential(6)});
    float wl = exp(-(2.0 * (1.0 - d)) / ${(Un*Un).toExponential(6)});
    ws += w; wls += wl;
    s += w * vec4(0.0, TA[j].w, TB[j].y, flag(TB[j], 4.0));
    ls += wl * flag(TB[j], 1.0);
    c += w * TA[j].rgb;
    lk += wl * flag(TB[j], 2.0);
  }
  ws = max(ws, 1e-30); wls = max(wls, 1e-30);
  colour = c / ws; lake = lk / wls;
  return vec4(ls / wls, s.yzw / ws);
}
// relief under the hex scale (metres): octaves from 64 km down to two pixels, ridged where rough
float detail(vec3 p, float rough) {
  float ridge = smoothstep(120.0, 420.0, rough);
  float s = 0.0; float wl = 64.0; float amp = 1.0;
  for (int o = 0; o < 7; o++) {
    float fade = smoothstep(1.5, 3.0, wl / uKmPx);
    if (fade <= 0.0) break;
    float v = nkm(p, wl, float(o));
    float r = 0.25 - abs(v);            // ridged: sharp crests
    s += fade * amp * mix(v, r * 1.6, ridge);
    wl *= 0.5; amp *= 0.62;
  }
  return s * max(rough, 90.0) * 3.2;
}
float elevAt(vec3 p) {
  vec3 c; float lk;
  vec4 b = blendAt(p, c, lk);
  float landN = b.x;
  return b.y + detail(p, b.z) * (landN > 0.5 ? 1.0 : 0.15);
}
// the coast's wobble: the land share is pushed by noise of 40, 12 and 4 km
float shoreNoise(vec3 p) { return nkm(p, 110.0, 10.0) * 0.3 + nkm(p, 40.0, 11.0) * 0.36 + nkm(p, 12.0, 12.0) * 0.18 + nkm(p, 4.0, 13.0) * 0.07 * smoothstep(1.0, 3.0, 4.0 / uKmPx); }

// The distance (km) from p to the river on edge k of tile T[0] (its meander), and its size; big when none.
float riverDist(vec3 p, int k, int m, float bits, float sizes, out float size) {
  size = 0.0;
  if (mod(floor(bits / exp2(float(k))), 2.0) < 0.5) return 1e6;
  int kp = k == 0 ? m - 1 : k - 1; int kn = k == m - 1 ? 0 : k + 1;
  int a = T[0]; int b = T[k + 1]; int tp = T[kp + 1]; int tn = T[kn + 1];
  vec3 cp = normalize(TC[0] + TC[kp + 1] + TC[k + 1]);
  vec3 cn = normalize(TC[0] + TC[k + 1] + TC[kn + 1]);
  // the same orientation from both sides: from the corner of the smaller third tile
  vec3 c0 = tp < tn ? cp : cn; vec3 c1 = tp < tn ? cn : cp;
  float sz = mod(floor(sizes / exp2(float(2 * k))), 4.0);
  size = max(sz, 1.0);
  float lo = float(min(a, b)); float hi = float(max(a, b));
  float h = fract(sin(lo * 12.9898 + hi * 78.233) * 43758.5453);
  float h2 = fract(sin(lo * 39.346 + hi * 11.135) * 24634.6345);
  vec3 e = c1 - c0; float L = length(e);
  float t = dot(p - c0, e) / (L * L);
  vec3 nrm = normalize(cross(c0, c1));
  float side = dot(p, nrm);
  float amp = ${Qr.toFixed(3)} * L;
  // the bend: one or two loops plus a wobble, nothing at the corners
  float f = 1.0 + floor(h * 2.0);
  float tc = clamp(t, 0.0, 1.0);
  float env = sin(tc * PI);
  float wav = sin(tc * PI * f + h2 * 6.2831) * 0.75 + sin(tc * PI * (f * 2.0 + 1.0) + h * 6.2831) * 0.25;
  float off = amp * env * wav;
  // its slope along the edge (to keep the width even through the bends)
  float dt = 0.01; float tc2 = clamp(t + dt, 0.0, 1.0);
  float off2 = amp * sin(tc2 * PI) * (sin(tc2 * PI * f + h2 * 6.2831) * 0.75 + sin(tc2 * PI * (f * 2.0 + 1.0) + h * 6.2831) * 0.25);
  float slope = (off2 - off) / max((tc2 - tc) * L, 1e-9);
  float d = abs(side - off) / sqrt(1.0 + slope * slope);
  if (t < 0.0) d = length(p - c0);
  else if (t > 1.0) d = length(p - c1);
  return d * R_KM;
}

void main() {
  float lon = uGeo.x + vUv.x * uGeo.z;
  float lat = uGeo.y - (1.0 - vUv.y) * uGeo.w;
  lon = mod(lon + PI, 2.0 * PI) - PI;
  vec3 p = unitOf(lon, lat);
  int a = tileAt(lon, lat, p);
  gather(a);
  vec3 colour; float lake;
  vec4 b = blendAt(p, colour, lake);
  float land = b.x + shoreNoise(p) * (1.0 - abs(b.x - 0.5) * 1.2);
  float aa = max(fwidth(land) * 0.75, 1e-4);
  float isLand = smoothstep(0.5 - aa, 0.5 + aa, land);
  float e = b.y + detail(p, b.z) * (b.x > 0.5 ? 1.0 : 0.15);
  float iceW = b.w + nkm(p, 18.0, 21.0) * 0.4;
  float isIce = smoothstep(0.45, 0.55, iceW);
  float latDeg = degrees(lat);
  float snowLine = 5400.0 - abs(latDeg) * 40.0;
  e = isLand > 0.5 ? max(e, 2.0) : min(e, -80.0);

  if (uMode > 0.5) {
    // land cover (rasterDetail.js LAND_COVER): the base class of the tile under a warped point
    // (wavy edges), ice above the snow line, rock above the tree line, water off the land
    float cls = 0.0;
    if (isLand > 0.5) {
      vec3 q = normalize(p + (vec3(nkm(p, 30.0, 31.0), nkm(p, 30.0, 32.0), nkm(p, 30.0, 33.0)) * 0.006 + vec3(nkm(p, 8.0, 34.0), nkm(p, 8.0, 35.0), nkm(p, 8.0, 36.0)) * 0.0018));
      int c = walk(a, q, 3);
      cls = floor(paintB(c).x / 8.0);
      float treeLine = 3900.0 - max(0.0, abs(latDeg) - 25.0) * 70.0;
      if (isIce > 0.5 || e > snowLine) cls = 1.0;
      else if (e > treeLine) cls = 2.0;
    }
    fragColor = vec4(cls / 255.0, 0.0, 0.0, 1.0);
    return;
  }

  // hillshade: the elevation one pixel east and one pixel south (the Earth build's light)
  float kmLon = max(0.05, uKmPx * (uGeo.z / uGeo.w) * cos(lat));
  vec3 pe = unitOf(lon + uGeo.z / ${ge}.0, lat);
  vec3 ps = unitOf(lon, lat - uGeo.w / ${ge}.0);
  float ee = elevAt(pe); float es = elevAt(ps);
  float gx = ((ee - e) / (kmLon * 1000.0)) * 14.0;
  float gy = ((es - e) / (uKmPx * 1000.0)) * 14.0;
  if (isLand < 0.5) { gx *= 0.15; gy *= 0.15; }
  vec3 nl = normalize(vec3(-gx, -gy, 1.0));
  float dotL = dot(nl, vec3(-0.5, -0.6, 0.62));
  float shade = 0.62 + 0.5 * max(0.0, dotL);
  vec3 landC;
  float landShade = shade;
  if (isIce > 0.5) { landC = vec3(232.0, 238.0, 244.0) / 255.0; landShade = 0.8 + 0.3 * max(0.0, dotL); }
  else {
    landC = colour;
    landC = mix(landC, vec3(152.0, 128.0, 102.0) / 255.0, clamp((e - 700.0) / 2400.0, 0.0, 1.0) * 0.75);
    landC = mix(landC, vec3(168.0, 160.0, 152.0) / 255.0, clamp((e - 2600.0) / 1800.0, 0.0, 1.0) * 0.8);
    landC = mix(landC, vec3(240.0, 243.0, 246.0) / 255.0, clamp((e - snowLine) / 600.0, 0.0, 1.0));
    if (e < 50.0) landC = mix(landC, landC * vec3(0.92, 0.98, 0.9), 0.5);
    // a little patchiness at the scale of fields and woods
    landC *= 1.0 + nkm(p, 9.0, 41.0) * 0.12 * smoothstep(1.0, 3.0, 9.0 / uKmPx);
  }
  vec3 waterC; float waterShade;
  bool isLake = lake / max(1.0 - b.x, 1e-3) > 0.5;
  if (isLake) { waterC = vec3(58.0, 118.0, 170.0) / 255.0; waterShade = 0.9 + 0.1 * max(0.0, dotL); }
  else {
    float depth = max(0.0, -e);
    waterC = mix(vec3(92.0, 160.0, 205.0), vec3(48.0, 104.0, 165.0), clamp(depth / 220.0, 0.0, 1.0)) / 255.0;
    waterC = mix(waterC, vec3(18.0, 42.0, 92.0) / 255.0, clamp((depth - 220.0) / 3800.0, 0.0, 1.0));
    waterShade = 0.88 + 0.2 * max(0.0, dotL);
    if (isIce > 0.5) { waterC = vec3(226.0, 234.0, 242.0) / 255.0; waterShade = 0.95; }
  }
  vec3 col = mix(waterC * waterShade, landC * landShade, isLand);

  // Rivers on the edges of the tile under a warped point: the warp (a smooth field of about
  // RIVER_WARP_KM) bends the whole network, so reaches leave the hex edges and the corners round
  // off, and stays connected (a continuous deformation). Each edge is drawn from both its tiles.
  vec3 q = normalize(p + (vec3(nkm(p, 100.0, 51.0), nkm(p, 100.0, 52.0), nkm(p, 100.0, 53.0)) * 3.0 + vec3(nkm(p, 35.0, 54.0), nkm(p, 35.0, 55.0), nkm(p, 35.0, 56.0)) * 0.7) * ${(Jr/Yt).toExponential(4)});
  int aq = walk(a, q, 2);
  if (aq != a) gather(aq);
  float bits = TB[0].z; float sizes = TB[0].w;
  if (bits > 0.5 && isLand > 0.0) {
    int m = T[6] < 0 ? 5 : 6;
    float bank = 0.0; float water = 0.0; float stream = 0.0;
    bool dry = floor(TB[0].x / 8.0) == 3.0; // desert: a stream is a dry wadi, not blue water
    for (int k = 0; k < 6; k++) {
      if (k >= m) break;
      float size;
      float d = riverDist(q, k, m, bits, sizes, size);
      if (d > 50.0) continue;
      float hw = max(${xt[1].toFixed(2)} * step(size, 1.5) + ${xt[2].toFixed(2)} * step(1.5, size) * step(size, 2.5) + ${xt[3].toFixed(2)} * step(2.5, size), 0.0) / uKmPx;
      // streams fade out on the small levels (as Earth's picture shows only the larger rivers there)
      float vis = size < 1.5 ? smoothstep(0.22, 0.6, hw) : clamp(hw * 3.0, 0.5, 1.0);
      hw = max(hw, 0.45);
      float dp = d / uKmPx;
      // a stream is a thin line without a bank (the grid has river edges on a third of the land:
      // drawn like the rivers they would hide the land, Earth's picture shows only the larger ones)
      if (size < 1.5) { stream = max(stream, clamp(hw * 0.75 - dp + 0.5, 0.0, 1.0) * vis); continue; }
      water = max(water, clamp(hw - dp + 0.5, 0.0, 1.0) * vis);
      bank = max(bank, clamp(hw + 0.9 - dp + 0.5, 0.0, 1.0) * vis);
    }
    col = mix(col, dry ? col * vec3(0.78, 0.74, 0.7) : vec3(96.0, 150.0, 200.0) / 255.0, stream * (dry ? 0.5 : 0.7) * isLand);
    col = mix(col, vec3(58.0, 108.0, 168.0) / 255.0, bank * 0.6 * isLand);
    col = mix(col, vec3(112.0, 172.0, 228.0) / 255.0, water * 0.92 * isLand);
  }
  float grain = 1.0 + (fract(sin(dot(gl_FragCoord.xy + vUv * 977.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.05;
  fragColor = vec4(clamp(col * grain, 0.0, 1.0), 1.0);
}
`,Mt=(e,t,n,r)=>{const a=new bo(e,t,n,r,Ne);return a.minFilter=Ce,a.magFilter=Ce,a.generateMipmaps=!1,a.wrapS=Se,a.wrapT=Se,a.flipY=!1,a.needsUpdate=!0,a},na=(e,t,n)=>{const r=2**(e+1),a=2**e,o=2*Math.PI/r,s=Math.PI/a;return{geo:[-Math.PI+t*o,Math.PI/2-n*s,o,s],kmPx:s*Yt/ge}},oa=(e,t,{seed:n=0}={})=>{const r=Zt(t),a=Yr(t),o=[Mt(r.centres,Z,r.rows,de),Mt(r.neighbours,Z,r.neighbourRows,de),Mt(r.lookup,he,Ae,yo),Mt(a.data,Z,a.rows,de)],s={uCentres:{value:o[0]},uNeigh:{value:o[1]},uLookup:{value:o[2]},uPaint:{value:o[3]},uGeo:{value:[0,0,1,1]},uKmPx:{value:1},uMode:{value:0},uSeed:{value:n%997*.731}},i=new Be({glslVersion:Lt,vertexShader:ea,fragmentShader:ta,uniforms:s,depthTest:!1,depthWrite:!1}),l=new Te,d=new We(new Je(2,2),i);d.frustumCulled=!1,l.add(d);const f=new vo(-1,1,1,-1,-1,1),u=new ko,m=new Set,w=(c,y,M,k)=>{const p=k?Ce:Ue,h=new Mo(ge,ge,{minFilter:p,magFilter:p,generateMipmaps:!1,depthBuffer:!1});h.texture.wrapS=Se,h.texture.wrapT=Se;const{geo:g,kmPx:A}=na(c,y,M);s.uGeo.value=g,s.uKmPx.value=A,s.uMode.value=k;const E=e.getRenderTarget(),R=e.getClearAlpha();e.getClearColor(u);const N=e.autoClear;return e.autoClear=!1,e.setRenderTarget(h),e.render(l,f),e.setRenderTarget(E),e.setClearColor(u,R),e.autoClear=N,h.texture.userData.target=h,m.add(h),h.texture};return{colour:(c,y,M)=>w(c,y,M,0),cover:(c,y,M)=>w(c,y,M,1),release:c=>{var M;const y=(M=c==null?void 0:c.userData)==null?void 0:M.target;y&&(m.delete(y),y.dispose())},dispose:()=>{m.forEach(c=>c.dispose()),m.clear(),i.dispose(),d.geometry.dispose(),o.forEach(c=>c.dispose())}}},sa=he,ra=Ae,Bn=6371,aa=34,la=24,Gn=e=>{const t=Math.max(1,Math.ceil(e*2.5)),n=new Float32Array(2*t+1);let r=0;for(let a=-t;a<=t;a++){const o=Math.exp(-(a*a)/(2*e*e));n[a+t]=o,r+=o}for(let a=0;a<n.length;a++)n[a]/=r;return{r:t,w:n}},ia=({states:e,lookup:t,width:n=sa,height:r=ra,sigmaKm:a=aa})=>{const o=n*r,s=new Float32Array(o),i=new Float32Array(o);for(let h=0;h<o;h++){const g=e[t[h]];s[h]=g>.5?1:0,i[h]=g>1.5?1:0}const l=Math.PI*Bn/r,d=2*Math.PI*Bn/n,f=new Float32Array(o),u=new Float32Array(o),m=new Int8Array(r);for(let h=0;h<r;h++){const g=h*n;let A=!0;for(let U=1;U<n&&A;U++)(s[g+U]!==s[g]||i[g+U]!==i[g])&&(A=!1);if(m[h]=A?s[g]+2*i[g]:-1,A){f.fill(s[g],g,g+n),u.fill(i[g],g,g+n);continue}const E=Math.PI/2-(h+.5)*Math.PI/r,R=Math.min(la,a/(d*Math.max(.02,Math.cos(E)))),{r:N,w:O}=Gn(R);for(let U=0;U<n;U++){let z=0,B=0;for(let W=-N;W<=N;W++){let V=U+W;V<0?V+=n:V>=n&&(V-=n);const _=O[W+N];z+=s[g+V]*_,B+=i[g+V]*_}f[g+U]=z,u[g+U]=B}}const{r:w,w:c}=Gn(a/l),y=new Uint8Array(o*4),M=new Float32Array(n),k=new Float32Array(n),p=(h,g)=>m[h]>=0&&m[h]===m[g];for(let h=0;h<r;h++){let g=m[h]>=0;for(let A=-w;A<=w&&g;A++)g=p(Math.min(r-1,Math.max(0,h+A)),h);if(g){const A=m[h]&1?255:0,E=m[h]&2?255:0;for(let R=0,N=h*n*4;R<n;R++,N+=4)y[N]=A,y[N+1]=E;continue}M.fill(0),k.fill(0);for(let A=-w;A<=w;A++){const E=Math.min(r-1,Math.max(0,h+A))*n,R=c[A+w];for(let N=0;N<n;N++)M[N]+=f[E+N]*R,k[N]+=u[E+N]*R}for(let A=0,E=h*n*4;A<n;A++,E+=4)y[E]=Math.round(M[A]*255),y[E+1]=Math.round(k[A]*255)}return{data:y,width:n,height:r}},jn=new Map,ca=(e,t,n)=>{const r=s=>(s+e/30)%12,a=t*Math.min(n,1-n),o=s=>n-a*Math.max(-1,Math.min(r(s)-3,Math.min(9-r(s),1)));return[o(0),o(8),o(4)]},fa=e=>{const t=String(e||"").trim().toLowerCase();if(t.startsWith("#")){const d=t.slice(1),f=d.length===3||d.length===4?d.split("").map(m=>m+m).join(""):d,u=m=>parseInt(f.slice(m,m+2),16)/255;return[u(0),u(2),u(4),f.length>=8?u(6):1]}const n=t.match(/^(rgba?|hsla?)\(([^)]*)\)$/);if(!n)return[0,0,0,0];const r=n[2].split(/[\s,/]+/).filter(Boolean),a=(d,f)=>d.endsWith("%")?parseFloat(d)/100:parseFloat(d)/f,o=r[3]!=null?a(r[3],1):1;if(n[1].startsWith("rgb"))return[a(r[0],255),a(r[1],255),a(r[2],255),o];const[s,i,l]=ca(parseFloat(r[0])||0,a(r[1],100),a(r[2],100));return[s,i,l,o]},fe=e=>{let t=jn.get(e);return t||(t=fa(e).map(n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0),jn.set(e,t)),t},Lo="#4ade80",it=1024,ua=1,da=2,ha=4,on=(e,t)=>Math.max(1,Math.ceil(e/t)),pa=e=>{const t=Object.keys(e||{}).sort(),n=new Map(t.map((a,o)=>[a,o])),r=new Map;return t.forEach(a=>{const o=e[a].owner;o&&!r.has(o)&&r.set(o,r.size)}),{ids:t,cityIndex:n,nationIndex:r}},$o=(e,t)=>{var a,o;const n=new Uint8Array(e);if(!(t!=null&&t.on))return n.fill(2);const r=(a=t.explored)==null?void 0:a.bytes;if(r)for(let s=0;s<r.length;s++){const i=r[s];if(i){for(let l=0;l<8;l++)if(i>>l&1){const d=s*8+l;d<e&&(n[d]=1)}}}return(o=t.visible)==null||o.forEach(s=>{s<e&&pr(t.explored,s)&&(n[s]=2)}),n},ma=({tileCount:e,tileOwner:t,regions:n,fog:r,index:a,fogStates:o=null})=>{const s=on(e,Z),i=new Float32Array(Z*s*4),{cityIndex:l,nationIndex:d}=a,f=o||$o(e,r);for(let u=0;u<e;u++)i[u*4+2]=f[u];return Object.keys(t||{}).forEach(u=>{var M;const m=Number(u),w=t[u],c=l.get(w);if(c==null||m>=e)return;i[m*4]=c+1;const y=(M=n[w])==null?void 0:M.owner;i[m*4+1]=y&&d.has(y)?d.get(y)+1:0}),{data:i,rows:s}},wa=({regions:e,index:t,playerNationId:n,selectedRegion:r,atWarNationIds:a,nations:o=null})=>{const s=on(t.ids.length*2,it),i=new Float32Array(it*s*4);return t.ids.forEach((l,d)=>{const f=e[l],u=f.owner===n,m=Ye(f.owner)||"#94a3b8",w=fe(u?Lo:mr(o,f.owner)?wr(m):m),c=d*8;i[c]=w[0],i[c+1]=w[1],i[c+2]=w[2],i[c+3]=(f.owner&&(a!=null&&a.has(f.owner))?ua:0)+(f.ghost?da:0)+(u?ha:0);const y=rs(e,n,l,r,a||new Set),M=fe(y);i[c+4]=M[0],i[c+5]=M[1],i[c+6]=M[2],i[c+7]=l===r?2:y==="#000000"?0:1}),{data:i,rows:s}},ga=(e,t)=>{const n=on(e,Z),r=new Uint8Array(Z*n*4);return(t||[]).forEach(({tile:a,colour:o})=>{if(a==null||a<0||a>=e)return;const s=fe(o);r.set([s[0]*255,s[1]*255,s[2]*255,s[3]*255].map(Math.round),a*4)}),{data:r,rows:n}},qn=4,va=1.7,ka=.3,Vn=.75,Kn=.4,ba=.25,Wt=[11/255,17/255,32/255],ya=.002,Hn=.22,Xn=.62,Ma=45,Zn=16,Sa=.6,Aa=22,Ea=36,Yn=6371,Ta=`
uniform vec4 uView;     // world x and y of the screen's top left, world units per CSS px, unused
uniform vec2 uViewport; // CSS px
out vec2 vWorld;
void main() {
  vec2 s = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5) * uViewport;
  vWorld = uView.xy + s * uView.z;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,Ca=`
precision highp float;
precision highp int;
precision highp sampler2D;
uniform sampler2D uCentres;
uniform sampler2D uNeigh;
uniform sampler2D uLookup;
uniform sampler2D uTile;
uniform sampler2D uCity;
uniform sampler2D uTint;
uniform sampler2D uFog;   // the soft fog field: r explored, g in sight, blurred (fogField.js)
uniform vec3 uProj;      // projection: centre x, centre y (world px), world px per radian
uniform float uK;         // zoom (CSS px per world px)
uniform float uDpr;
uniform float uHex;       // 1 from the hex zoom
uniform float uCityDetail;// 1 from the region zoom (faint borders between your own cities)
uniform float uNationHalf;// half width of the nation border, CSS px
uniform float uSelTile;   // the selected tile or -1
uniform float uTintOn;
uniform float uFogOn;
in vec2 vWorld;
out vec4 fragColor;

const float PI = 3.14159265358979;
ivec2 at(int i, int w) { return ivec2(i % w, i / w); }
vec4 centreOf(int i) { return texelFetch(uCentres, at(i, ${Z}), 0); }
vec4 tileOf(int i) { return texelFetch(uTile, at(i, ${Z}), 0); }
vec4 cityBand(int c) { return texelFetch(uCity, at(c * 2, ${it}), 0); }
vec4 cityStroke(int c) { return texelFetch(uCity, at(c * 2 + 1, ${it}), 0); }
void neighbours(int i, out int n[6]) {
  vec4 a = texelFetch(uNeigh, at(i * 2, ${Z}), 0);
  vec4 b = texelFetch(uNeigh, at(i * 2 + 1, ${Z}), 0);
  n[0] = int(floor(a.x + 0.5)); n[1] = int(floor(a.y + 0.5)); n[2] = int(floor(a.z + 0.5)); n[3] = int(floor(a.w + 0.5));
  n[4] = int(floor(b.x + 0.5)); n[5] = int(floor(b.y + 0.5));
}

// Value noise on the unit sphere's 3D position: stable in world space and seamless east to west.
float hash3(vec3 q) { q = fract(q * 0.3183099 + 0.1); q *= 17.0; return fract(q.x * q.y * q.z * (q.x + q.y + q.z)); }
float vnoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hash3(i), hash3(i + vec3(1.0, 0.0, 0.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 0.0)), hash3(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
             mix(mix(hash3(i + vec3(0.0, 0.0, 1.0)), hash3(i + vec3(1.0, 0.0, 1.0)), f.x), mix(hash3(i + vec3(0.0, 1.0, 1.0)), hash3(i + vec3(1.0, 1.0, 1.0)), f.x), f.y), f.z);
}
float fbm(vec3 x) {
  float s = 0.0; float amp = 0.5;
  for (int i = 0; i < 4; i++) { s += amp * vnoise(x); x = x * 2.03 + 17.1; amp *= 0.5; }
  return s / 0.9375;
}

vec2 fogFieldAt(float lon, float lat) { return texture(uFog, vec2((lon + PI) / (2.0 * PI), (0.5 * PI - lat) / PI)).rg; }

vec4 acc;
void over(vec3 rgb, float a) { acc = vec4(rgb * a, a) + acc * (1.0 - a); }
// A line of half width hw (CSS px) at distance d (CSS px) from the edge, one device pixel of AA.
float line(float d, float hw) { return clamp((hw - d) * uDpr + 0.5, 0.0, 1.0); }

void main() {
  float lon = (vWorld.x - uProj.x) / uProj.z;
  lon = mod(lon + PI, 2.0 * PI) - PI;
  float lat = (uProj.y - vWorld.y) / uProj.z;
  if (abs(lat) > 0.5 * PI) discard;
  float cl = cos(lat); float sl = sin(lat); float co = cos(lon); float so = sin(lon);
  vec3 p = vec3(cl * co, cl * so, sl);
  vec3 dLon = vec3(-cl * so, cl * co, 0.0);
  vec3 dLat = vec3(-sl * co, -sl * so, cl);
  float pxPerRad = uProj.z * uK;

  int ix = clamp(int((lon + PI) / (2.0 * PI) * ${he}.0), 0, ${he-1});
  int iy = clamp(int((0.5 * PI - lat) / PI * ${Ae}.0), 0, ${Ae-1});
  int a = int(floor(texelFetch(uLookup, ivec2(ix, iy), 0).r + 0.5));
  // The soft fog field (fogField.js). Deep in the unexplored dark (the field all but zero, no
  // explored tile within reach) the mask alone, with no tile search.
  // Near an edge the field is read through a world-space noise warp (a domain warp of up to
  // FOG_WARP_KM), so the edge wanders like a cloud's instead of following the hexes; the deep
  // checks are made before the warp, far enough out that the warp cannot reach an edge.
  vec2 fogF = vec2(1.0); float warp = 0.0;
  if (uFogOn > 0.5) {
    fogF = fogFieldAt(lon, lat);
    if (fogF.r < ${ya.toFixed(4)}) { fragColor = vec4(${Wt.map(e=>e.toFixed(4)).join(", ")}, 1.0); return; }
    if (fogF.r < 0.999 || fogF.g < 0.999) {
      vec3 q = p * ${Zn.toFixed(1)};
      float wx = fbm(q) - 0.5; float wy = fbm(q + vec3(31.7, 11.3, 5.9)) - 0.5;
      warp = wx;
      float amp = 2.0 * ${(Ma/Yn).toFixed(6)};
      fogF = fogFieldAt(lon + wx * amp / max(cl, 0.05), clamp(lat + wy * amp, -0.5 * PI, 0.5 * PI));
    }
  }
  int n[6];
  for (int it = 0; it < ${Po}; it++) {
    neighbours(a, n);
    float best = dot(p, centreOf(a).xyz); int next = a;
    for (int k = 0; k < 6; k++) {
      if (n[k] < 0) continue;
      float d = dot(p, centreOf(n[k]).xyz);
      if (d > best) { best = d; next = n[k]; }
    }
    if (next == a) break;
    a = next;
  }
  neighbours(a, n);
  vec4 ca = centreOf(a);
  vec4 ta = tileOf(a);
  int cityA = int(floor(ta.x + 0.5)) - 1;
  float natA = ta.y;
  float fogA = ta.z;
  bool landA = ca.w > 0.5;

  // Per neighbour: the distance in CSS px to the shared edge, and what lies beyond it.
  float dist[6]; vec4 tn[6]; bool landN[6];
  for (int k = 0; k < 6; k++) {
    dist[k] = 1e6; tn[k] = vec4(0.0); landN[k] = false;
    if (n[k] < 0) continue;
    vec4 cn = centreOf(n[k]);
    vec3 ab = ca.xyz - cn.xyz;
    float f = dot(p, ab);
    vec2 g = vec2(dot(ab, dLon), dot(ab, dLat)) / pxPerRad;
    dist[k] = max(0.0, f) / max(length(g), 1e-12);
    tn[k] = tileOf(n[k]);
    landN[k] = cn.w > 0.5;
  }

  acc = vec4(0.0);
  // The fog, soft: how much of the dark mask and of the grey wash this pixel gets. The blurred
  // field is warped by world-space noise inside its band, then every tile's centre is held on its
  // own side (a lone explored tile stays open, a lone unexplored one dark): the rules stay per tile.
  float maskA = 0.0; float washA = 0.0;
  if (uFogOn > 0.5) {
    // finer wisps inside the band: a second, smaller noise on the field value itself
    // (weighted to nothing near 0 and 1, so the deep checks above stay exact)
    vec2 inBand = smoothstep(vec2(0.08), vec2(0.3), fogF) * (1.0 - smoothstep(vec2(0.7), vec2(0.92), fogF));
    float fine = inBand.r + inBand.g > 0.0 ? (fbm(p * ${(Zn*4.3).toFixed(1)} + vec3(7.1, 3.3, 1.9)) - 0.5) * ${Sa.toFixed(2)} : 0.0;
    maskA = 1.0 - smoothstep(${Hn.toFixed(2)}, ${Xn.toFixed(2)}, fogF.r + fine * inBand.r);
    washA = 1.0 - smoothstep(${Hn.toFixed(2)}, ${Xn.toFixed(2)}, fogF.g + fine * inBand.g);
    float dEdge = 1e6;
    for (int k = 0; k < 6; k++) dEdge = min(dEdge, dist[k]);
    float core = smoothstep(${Aa.toFixed(1)}, ${Ea.toFixed(1)}, dEdge / pxPerRad * ${Yn.toFixed(1)} + warp * 16.0);
    maskA = fogA < 0.5 ? max(maskA, core) : min(maskA, 1.0 - core);
    washA = fogA < 1.5 ? max(washA, core) : min(washA, 1.0 - core);
  }
  if (uFogOn > 0.5 && fogA < 0.5) {
    // Unexplored: no territory, only the edge of the wash and the mask over the Earth.
    over(vec3(0.059, 0.09, 0.165), 0.55 * washA);
    over(vec3(${Wt.map(e=>e.toFixed(4)).join(", ")}), maskA);
    if (acc.a <= 0.0) discard;
    fragColor = acc;
    return;
  }

  vec4 bandA = cityA >= 0 ? cityBand(cityA) : vec4(0.0);
  vec4 strokeA = cityA >= 0 ? cityStroke(cityA) : vec4(0.0);
  bool enemyA = cityA >= 0 && mod(floor(bandA.w + 0.5), 2.0) > 0.5;

  // City outlines: the plain faint line between two of a nation's cities from the region zoom,
  // then the coloured outlines (both sides of the edge), the selected city last.
  for (int pass = 0; pass < 3; pass++) {
    for (int k = 0; k < 6; k++) {
      if (n[k] < 0) continue;
      int cityN = int(floor(tn[k].x + 0.5)) - 1;
      if (cityN == cityA) continue;
      if (pass == 0) {
        if (uCityDetail > 0.5 && cityA >= 0 && cityN >= 0 && tn[k].y == natA && strokeA.w < 0.5 && cityStroke(cityN).w < 0.5)
          over(vec3(1.0), 0.35 * line(dist[k], ${ba.toFixed(2)}));
        continue;
      }
      vec4 sn = cityN >= 0 ? cityStroke(cityN) : vec4(0.0);
      float want = pass == 1 ? 1.0 : 2.0;
      if (abs(strokeA.w - want) < 0.5) over(strokeA.rgb, line(dist[k], want > 1.5 ? ${Vn.toFixed(2)} : ${Kn.toFixed(2)}));
      if (abs(sn.w - want) < 0.5) over(sn.rgb, line(dist[k], want > 1.5 ? ${Vn.toFixed(2)} : ${Kn.toFixed(2)}));
    }
  }

  // The nation's band just inside its border.
  if (natA > 0.5) {
    float dBand = 1e6;
    for (int k = 0; k < 6; k++) if (n[k] >= 0 && tn[k].y != natA) dBand = min(dBand, dist[k]);
    if (dBand < ${qn.toFixed(1)} + 1.0) over(bandA.rgb, 0.9 * line(dBand, ${qn.toFixed(1)}));
  }
  // The nation border.
  for (int k = 0; k < 6; k++) {
    if (n[k] < 0 || tn[k].y == natA || (natA < 0.5 && tn[k].y < 0.5)) continue;
    over(vec3(0.008, 0.024, 0.09), 0.85 * line(dist[k], uNationHalf));
  }
  // War: a red band round every enemy city, a dark red hairline on its edge.
  for (int k = 0; k < 6; k++) {
    if (n[k] < 0) continue;
    int cityN = int(floor(tn[k].x + 0.5)) - 1;
    if (cityN == cityA) continue;
    bool enemyN = cityN >= 0 && mod(floor(cityBand(cityN).w + 0.5), 2.0) > 0.5;
    if (!enemyA && !enemyN) continue;
    over(vec3(0.937, 0.267, 0.267), line(dist[k], ${va.toFixed(2)}));
    over(vec3(0.5, 0.114, 0.114), 0.55 * line(dist[k], 0.2));
  }
  // The hex overlay over land.
  if (uHex > 0.5) {
    for (int k = 0; k < 6; k++) if (n[k] >= 0 && (landA || landN[k])) over(vec3(1.0), 0.2 * line(dist[k], ${ka.toFixed(2)}));
  }
  // Explored, out of sight: the grey wash.
  if (washA > 0.0) over(vec3(0.059, 0.09, 0.165), 0.55 * washA);
  // The lens tints.
  if (uTintOn > 0.5) { vec4 t = texelFetch(uTint, at(a, ${Z}), 0); if (t.a > 0.0) over(t.rgb, t.a); }
  // The selected tile.
  if (uSelTile >= 0.0) {
    int sel = int(floor(uSelTile + 0.5));
    if (a == sel) {
      over(vec3(1.0), 0.15);
      for (int k = 0; k < 6; k++) if (n[k] >= 0) over(vec3(1.0), line(dist[k], 0.8));
    } else {
      for (int k = 0; k < 6; k++) if (n[k] == sel) over(vec3(1.0), line(dist[k], 0.8));
    }
  }
  // The soft edge of the unexplored dark, over everything.
  if (maskA > 0.0) over(vec3(${Wt.map(e=>e.toFixed(4)).join(", ")}), maskA);
  if (acc.a <= 0.0) discard;
  fragColor = acc;
}
`,$e=(e,t,n,r,a)=>{const o=new bo(e,t,n,r,a);return o.minFilter=Ce,o.magFilter=Ce,o.generateMipmaps=!1,o.wrapS=Se,o.wrapT=Se,o.flipY=!1,o.needsUpdate=!0,o},Qn=(e,t,n)=>{const r=$e(e,t,n,de,Et);return r.minFilter=Ue,r.magFilter=Ue,r.wrapS=lr,r},Pa=(e,t)=>{const n=$e(t.centres,Z,t.rows,de,Ne),r=$e(t.neighbours,Z,t.neighbourRows,de,Ne),a=$e(t.lookup,he,Ae,yo,Ne),o=()=>$e(new Float32Array(4),1,1,de,Ne),s={uCentres:{value:n},uNeigh:{value:r},uLookup:{value:a},uTile:{value:o()},uCity:{value:o()},uFog:{value:Qn(new Uint8Array(4),1,1)},uTint:{value:$e(new Uint8Array(4),1,1,de,Et)},uView:{value:new At},uViewport:{value:new So(1,1)},uProj:{value:new At},uK:{value:1},uDpr:{value:1},uHex:{value:0},uCityDetail:{value:0},uNationHalf:{value:.55},uSelTile:{value:-1},uTintOn:{value:0},uFogOn:{value:0}},i=new Be({glslVersion:Lt,vertexShader:Ta,fragmentShader:Ca,uniforms:s,transparent:!0,premultipliedAlpha:!0,depthTest:!1,depthWrite:!1}),l=new We(new Je(2,2),i);l.frustumCulled=!1,l.renderOrder=10,e.add(l);const d=(u,m,w,c,y,M)=>{var p,h;const k=s[u].value;if(((p=k.image)==null?void 0:p.width)===w&&((h=k.image)==null?void 0:h.height)===c&&k.image.data.length===m.length){k.image.data=m,k.needsUpdate=!0;return}s[u].value=$e(m,w,c,y,M),k.dispose()},f={mesh:l,version:0,setTiles:({data:u,rows:m})=>{d("uTile",u,Z,m,de,Ne),f.version+=1},setCities:({data:u,rows:m})=>{d("uCity",u,it,m,de,Ne),f.version+=1},setTints:({data:u,rows:m})=>{d("uTint",u,Z,m,de,Et),f.version+=1},setFog:({data:u,width:m,height:w})=>{var y,M;const c=s.uFog.value;((y=c.image)==null?void 0:y.width)===m&&((M=c.image)==null?void 0:M.height)===w?(c.image.data=u,c.needsUpdate=!0):(s.uFog.value=Qn(u,m,w),c.dispose()),f.version+=1},update:(u,m)=>{s.uView.value.set(u.worldLeft,u.worldTop,1/u.k,0),s.uViewport.value.set(u.width,u.height),s.uProj.value.set(u.proj.cx,u.proj.cy,u.proj.s,0),s.uK.value=u.k,s.uDpr.value=u.dpr,Object.entries(m).forEach(([w,c])=>{s[w].value=c})},dispose:()=>{e.remove(l),l.geometry.dispose(),i.dispose(),[n,r,a,s.uTile.value,s.uCity.value,s.uTint.value,s.uFog.value].forEach(u=>u.dispose())}};return f},Ia=.3,La="uniform sampler2D uMap; varying vec2 vUv; void main() { gl_FragColor = texture2D(uMap, vUv); }",$a=e=>{const t=new Te;t.add(e.mesh);const n=new Te,r=new Mo(1,1,{minFilter:Ce,magFilter:Ce,depthBuffer:!1}),a=new Be({vertexShader:en,fragmentShader:La,uniforms:{uMap:{value:r.texture}},transparent:!0,premultipliedAlpha:!0,depthTest:!1,depthWrite:!1}),o=new We(new Je(1,1).translate(.5,-.5,0),a);o.frustumCulled=!1,n.add(o);const s=new ko;let i=null;const l=(d,f)=>{if(!i||i.key!==f||i.k!==d.k)return!1;const u=He(i.left,d.worldLeft,d.worldW);return d.worldLeft>=u&&d.worldLeft+d.width/d.k<=u+i.w&&d.worldTop>=i.top&&d.worldTop+d.height/d.k<=i.top+i.h};return{invalidate:()=>{i=null},draw:(d,f,u,m,w)=>{const c=`${e.version}|${JSON.stringify(m)}|${u.width}x${u.height}@${u.dpr}`;if(!l(u,c)&&w){const y=Ia,M=u.width*(1+2*y),k=u.height*(1+2*y),p=Math.min(4096,Math.round(M*u.dpr)),h=Math.min(4096,Math.round(k*u.dpr)),g={...u,worldLeft:u.worldLeft-y*u.width/u.k,worldTop:u.worldTop-y*u.height/u.k,width:M,height:k,dpr:p/M};r.setSize(p,h),e.update(g,m);const A=d.getRenderTarget(),E=d.getClearAlpha();d.getClearColor(s),d.setRenderTarget(r),d.setClearColor(0,0),d.clear(!0,!1,!1),d.render(t,f),d.setRenderTarget(A),d.setClearColor(s,E),i={key:c,k:u.k,left:g.worldLeft,top:g.worldTop,w:M/u.k,h:k/u.k}}return l(u,c)?(o.position.set(He(i.left,u.worldLeft,u.worldW),-i.top,0),o.scale.set(i.w,i.h,1),d.render(n,f),"cached"):(e.update(u,m),d.render(t,f),"live")},dispose:()=>{r.dispose(),a.dispose(),o.geometry.dispose()}}},Jn=160,Oa=1.25,Ra=6,eo=5,Fa=4,to=(e,t)=>(e.magFilter=Ue,e.minFilter=t?ur:Ue,e.generateMipmaps=!!t,e.wrapS=Se,e.wrapT=Se,e.needsUpdate=!0,e),Ut=e=>new Be({vertexShader:en,fragmentShader:"uniform sampler2D uMap; varying vec2 vUv; void main() { gl_FragColor = vec4(texture2D(uMap, vUv).rgb, 1.0); }",uniforms:{uMap:{value:e}},depthTest:!1,depthWrite:!1});let _a=null;const za=()=>_a||(_a=$e(new Uint8Array(4),1,1,de,Et)),no=_r(),Bt=(e,t,n)=>new Be({vertexShader:en,fragmentShader:Nr,defines:{...no.defines},uniforms:{uMap:{value:e},uSize:{value:new So(t[0],t[1])},uGeo:{value:new At(...n)},uPxPerKm:{value:1},uCover:{value:za()},uCoverOn:{value:0},uRiverOff:{value:0},...no.uniforms},depthTest:!1,depthWrite:!1}),Na=e=>(e.magFilter=Ce,e.minFilter=Ce,e.generateMipmaps=!1,e.wrapS=Se,e.wrapT=Se,e.needsUpdate=!0,e),Da=(e,{request:t,onReady:n,source:r=null})=>{const a=new Je(1,1).translate(.5,-.5,0),o=new sr,s={world:null,tiles:new Map,disposed:!1,detail:null,stats:{level:0,tiles:0,fallback:0,pending:0}};let i=0;Xt()||Vr().then(c=>{!s.disposed&&c&&(s.detail=c,t())});const l=(c,y)=>{var M;((M=s.world)==null?void 0:M.url)!==c&&o.load(c,k=>{if(s.disposed){k.dispose();return}to(k,!0),s.world&&(s.world.meshes.forEach(A=>e.remove(A)),s.world.plain.dispose(),s.world.terrain.dispose(),s.world.texture.dispose());const p=Ut(k),h=Bt(k,[y,y/2],[-180,90,360,180]),g=[-1,0,1].map(()=>{const A=new We(a,p);return A.renderOrder=0,A.frustumCulled=!1,e.add(A),A});s.world={url:c,texture:k,plain:p,terrain:h,meshes:g},t(),n==null||n(!0)},void 0,()=>n==null?void 0:n(!1))},d=(c,y,M)=>{const k=`${c}/${y}-${M}`;let p=s.tiles.get(k);if(!p){if(p={key:k,z:c,x:y,y:M,texture:null,plain:null,terrain:null,cover:null,coverAsked:!1,meshes:[],used:0},s.tiles.set(k,p),r)return p;o.load(ls(c,y,M),h=>{if(s.disposed||!s.tiles.has(k)){h.dispose();return}p.texture=to(h,!1),p.plain=Ut(h);const g=2**(c+1),A=2**c;p.terrain=Bt(h,[ge,ge],[-180+y*360/g,90-M*180/A,360/g,180/A]),p.cover&&(p.terrain.uniforms.uCover.value=p.cover,p.terrain.uniforms.uCoverOn.value=1),t()},void 0,()=>{p.failed=!0})}return p},f=c=>{if(c.texture)return!0;if(i<=0)return!1;i-=1;const y=r.colour(c.z,c.x,c.y);c.texture=y,c.plain=Ut(y);const M=2**(c.z+1),k=2**c.z;return c.terrain=Bt(y,[ge,ge],[-180+c.x*360/M,90-c.y*180/k,360/M,180/k]),!0},u=c=>{c&&(r?r.release(c):c.dispose())},m=c=>{var y;if(r){if(c.coverAsked||c.z<eo||i<=0)return;i-=1,c.coverAsked=!0,c.cover=r.cover(c.z,c.x,c.y),c.terrain&&(c.terrain.uniforms.uCover.value=c.cover,c.terrain.uniforms.uCoverOn.value=1);return}c.coverAsked||!((y=s.detail)!=null&&y.hasCover(c.z,c.x,c.y))||(c.coverAsked=!0,o.load(Gr(c.z,c.x,c.y),M=>{if(s.disposed||!s.tiles.has(c.key)){M.dispose();return}c.cover=Na(M),c.terrain&&(c.terrain.uniforms.uCover.value=c.cover,c.terrain.uniforms.uCoverOn.value=1),t()},void 0,()=>{}))};return{update:(c,{closeK:y,baseZ:M,worldUrl:k,worldSize:p})=>{l(k,p);const h=c.k>=y,g=c.raster,A=zr(g.width,c.k,c.dpr);if(s.world){const z=h?s.world.terrain:s.world.plain;h&&(s.world.terrain.uniforms.uPxPerKm.value=A),s.world.meshes.forEach((B,W)=>{B.material=z,B.position.set(g.x+(W-1)*g.width+c.copyShift,-g.y,0),B.scale.set(g.width,g.height,1)})}const E=Math.ceil(Math.log2(Math.max(1,g.width*c.k*c.dpr)/(ge*2))),R=g.width*c.k*c.dpr/(ge*2**(Le+1)),N=s.detail&&E>Le&&R>=Oa?Math.min(s.detail.maxZ,E):h?Le:as(g.width*c.k*c.dpr),O=r?Math.max(0,Math.min(Ra,h?Math.max(E,eo):E)):N,U=(h||O>M)&&(r?!0:!Xt());if(i=r?Fa:0,s.tiles.forEach(z=>{z.meshes.forEach(B=>{B.visible=!1})}),s.stats={level:U?O:0,tiles:0,fallback:0,pending:0},U){const z=2**(O+1),B=2**O,W=g.width/z,V=g.height/B,_=Math.floor((c.worldLeft-g.x)/W)-1,J=Math.floor((c.worldLeft+c.width/c.k-g.x)/W)+1,le=Math.max(0,Math.floor((c.worldTop-g.y)/V)-1),ke=Math.min(B-1,Math.floor((c.worldTop+c.height/c.k-g.y)/V)+1),G=performance.now(),be=(q,te,ie)=>{const x=2**(q.z+1),P=2**q.z,H=g.width/x,ee=g.height/P,K=q.meshes.find(ue=>!ue.visible)||(()=>{const ue=new We(a,q.plain);return ue.frustumCulled=!1,e.add(ue),q.meshes.push(ue),ue})();K.renderOrder=ie,K.material=h?q.terrain:q.plain,h&&(q.terrain.uniforms.uPxPerKm.value=A,m(q)),K.position.set(g.x+(te*x+q.x)*H,-(g.y+q.y*ee),0),K.scale.set(H*1.003,ee*1.003,1),K.visible=!0,s.stats.tiles+=1},Q=new Set;for(let q=le;q<=ke;q++)for(let te=_;te<=J;te++){const ie=(te%z+z)%z,x=Math.floor(te/z);if(r){const me=d(O,ie,q);if(me.used=G,f(me)){be(me,x,2);continue}s.stats.pending+=1;for(let Pe=1;O-Pe>M;Pe++){const ye=s.tiles.get(`${O-Pe}/${ie>>Pe}-${q>>Pe}`);if(!(ye!=null&&ye.texture))continue;ye.used=G;const Ge=`${ye.key}@${x}`;Q.has(Ge)||(Q.add(Ge),be(ye,x,1),s.stats.fallback+=1);break}continue}if(O<=Le){const me=d(O,ie,q);me.used=G,me.texture&&be(me,x,1);continue}const H=qr(s.detail,O,ie,q).z===O?d(O,ie,q):null;if(H&&(H.used=G),H!=null&&H.texture){be(H,x,2);continue}const ee=O-Le,K=d(Le,ie>>ee,q>>ee);K.used=G;const ue=`${K.key}@${x}`;K.texture&&!Q.has(ue)&&(Q.add(ue),be(K,x,1),s.stats.fallback+=1)}}s.tiles.size>Jn&&[...s.tiles.values()].filter(z=>!z.meshes.some(B=>B.visible)).sort((z,B)=>z.used-B.used).slice(0,s.tiles.size-Jn).forEach(z=>{var B,W;z.meshes.forEach(V=>e.remove(V)),u(z.texture),(B=z.plain)==null||B.dispose(),(W=z.terrain)==null||W.dispose(),u(z.cover),s.tiles.delete(z.key)}),(s.stats.pending>0||r&&i<=0)&&t()},ready:()=>!!s.world,stats:()=>s.stats,dispose:()=>{s.disposed=!0,s.world&&(s.world.meshes.forEach(c=>e.remove(c)),s.world.plain.dispose(),s.world.terrain.dispose(),s.world.texture.dispose()),s.tiles.forEach(c=>{var y,M;c.meshes.forEach(k=>e.remove(k)),u(c.texture),(y=c.plain)==null||y.dispose(),(M=c.terrain)==null||M.dispose(),u(c.cover)}),r==null||r.dispose(),a.dispose()}}},Oo=`
uniform vec4 uView;     // world x, y of the screen's top left; zoom k; world width (the wrap)
uniform vec3 uScreen;   // CSS width, height, device pixel ratio
uniform float uCamX;    // the view centre's world x
float wrapX(float x) { return x + uView.w * floor((uCamX - x) / uView.w + 0.5); }
vec2 toScreen(vec2 world) { return (world - uView.xy) * uView.z; }
vec4 toClip(vec2 s) { return vec4(s.x / uScreen.x * 2.0 - 1.0, 1.0 - s.y / uScreen.y * 2.0, 0.0, 1.0); }
`,Ro=()=>({uView:{value:new At},uScreen:{value:new fr(1,1,1)},uCamX:{value:0}}),Fo=(e,t)=>{e.uView.value.set(t.worldLeft,t.worldTop,t.k,t.worldW),e.uScreen.value.set(t.width,t.height,t.dpr),e.uCamX.value=t.camX},_o=(e,t,n)=>{const r={capacity:0,attrs:{}};return r.ensure=a=>{if(a<=r.capacity)return;const o=Math.max(n,2**Math.ceil(Math.log2(a)));Object.entries(t).forEach(([s,i])=>{const l=new ir(new Float32Array(o*i),i).setUsage(cr);r.attrs[s]=l,e.setAttribute(s,l)}),r.capacity=o,e._maxInstanceCount=void 0},r.ensure(n),r},xa=`
${Oo}
in vec2 aAnchor;  // world position
in vec4 aOffset;  // CSS px offset: xy fixed, zw times k^aExp.y
in vec2 aSize;    // CSS px size times k^aExp.x
in vec2 aExp;
in vec4 aUv;      // atlas rect u0, v0, u1, v1
in vec4 aColor;   // multiplier (alpha: opacity)
out vec2 vUv;
out vec4 vColor;
void main() {
  vec2 anchor = vec2(wrapX(aAnchor.x), aAnchor.y);
  float k = uView.z;
  vec2 size = aSize * pow(k, aExp.x);
  vec2 centre = toScreen(anchor) + aOffset.xy + aOffset.zw * pow(k, aExp.y);
  // whole device pixels at the top left, so text and icons stay sharp
  vec2 tl = floor((centre - size * 0.5) * uScreen.z + 0.5) / uScreen.z;
  vec2 corner = vec2(position.x + 0.5, 0.5 - position.y);
  vUv = mix(aUv.xy, aUv.zw, corner);
  vColor = aColor;
  gl_Position = toClip(tl + corner * size);
}
`,Wa=`
precision highp float;
uniform sampler2D uAtlas;
in vec2 vUv;
in vec4 vColor;
out vec4 fragColor;
void main() {
  vec4 c = texture(uAtlas, vUv) * vColor;
  if (c.a < 0.004) discard;
  fragColor = c;
}
`,St=(e,t,n)=>{const r=new Ao,a=new Je(1,1);r.index=a.index,r.setAttribute("position",a.getAttribute("position"));const s=_o(r,{aAnchor:2,aOffset:4,aSize:2,aExp:2,aUv:4,aColor:4},256),i=new rr(t.canvas);i.flipY=!1,i.generateMipmaps=!1,i.minFilter=Ue,i.magFilter=Ue;const l={...Ro(),uAtlas:{value:i}},d=new Be({glslVersion:Lt,vertexShader:xa,fragmentShader:Wa,uniforms:l,transparent:!0,depthTest:!1,depthWrite:!1}),f=new We(r,d);f.frustumCulled=!1,f.renderOrder=n,e.add(f);let u=-1;return{mesh:f,set:m=>{s.ensure(m.length);const w=s.attrs;m.forEach((c,y)=>{w.aAnchor.array.set(c.anchor,y*2),w.aOffset.array.set(c.offset||[0,0,0,0],y*4),w.aSize.array.set(c.size,y*2),w.aExp.array.set(c.exp||[0,0],y*2),w.aUv.array.set([c.uv.u0,c.uv.v0,c.uv.u1,c.uv.v1],y*4),w.aColor.array.set(c.color||[1,1,1,1],y*4)}),Object.values(w).forEach(c=>{c.needsUpdate=!0}),r.instanceCount=m.length,f.visible=m.length>0},update:m=>{Fo(l,m),u!==t.version&&(i.needsUpdate=!0,u=t.version)},dispose:()=>{e.remove(f),r.dispose(),a.dispose(),d.dispose(),i.dispose()}}},Ua=`
${Oo}
in vec2 aA;       // world start
in vec2 aB;       // world end (unwrapped next to the start)
in vec4 aStyle;   // half width, dash, gap (CSS px, times k^exp), exp
in vec4 aColor;
out float vAcross;
out float vAlong;
out float vHalf;
out vec2 vDash;
out vec4 vColor;
void main() {
  float shift = wrapX(aA.x) - aA.x;
  vec2 a = toScreen(aA + vec2(shift, 0.0)); vec2 b = toScreen(aB + vec2(shift, 0.0));
  float scale = pow(uView.z, aStyle.w);
  float hw = aStyle.x * scale;
  vec2 d = b - a; float len = max(length(d), 1e-4); vec2 dir = d / len; vec2 nrm = vec2(-dir.y, dir.x);
  float t = position.x + 0.5;            // 0 at the start, 1 at the end
  float side = position.y * 2.0;          // -1 or 1
  float ext = hw + 1.0;                   // room for the round end and the soft edge
  vec2 s = mix(a, b, t) + dir * (t * 2.0 - 1.0) * hw + nrm * side * ext;
  vAcross = side * ext; vAlong = t * len + (t * 2.0 - 1.0) * hw; vHalf = hw;
  vDash = aStyle.yz * scale; vColor = aColor;
  gl_Position = toClip(s);
}
`,Ba=`
precision highp float;
uniform vec3 uScreen;
in float vAcross;
in float vAlong;
in float vHalf;
in vec2 vDash;
in vec4 vColor;
out vec4 fragColor;
void main() {
  float a = clamp((vHalf - abs(vAcross)) * uScreen.z + 0.5, 0.0, 1.0);
  if (vDash.x > 0.0 && mod(vAlong, vDash.x + vDash.y) > vDash.x) discard;
  if (a <= 0.0) discard;
  fragColor = vec4(vColor.rgb, vColor.a * a);
}
`,oo=(e,t)=>{const n=new Ao,r=new Je(1,1);n.index=r.index,n.setAttribute("position",r.getAttribute("position"));const a=_o(n,{aA:2,aB:2,aStyle:4,aColor:4},256),o=Ro(),s=new Be({glslVersion:Lt,vertexShader:Ua,fragmentShader:Ba,uniforms:o,transparent:!0,depthTest:!1,depthWrite:!1,side:ar}),i=new We(n,s);return i.frustumCulled=!1,i.renderOrder=t,e.add(i),{mesh:i,set:l=>{a.ensure(l.length);const d=a.attrs;l.forEach((f,u)=>{d.aA.array.set(f.a,u*2),d.aB.array.set(f.b,u*2),d.aStyle.array.set([f.half,f.dash||0,f.gap||0,f.exp||0],u*4),d.aColor.array.set(f.color,u*4)}),Object.values(d).forEach(f=>{f.needsUpdate=!0}),n.instanceCount=l.length,i.visible=l.length>0},update:l=>Fo(o,l),dispose:()=>{e.remove(i),n.dispose(),r.dispose(),s.dispose()}}},zo=2048,so=2,Ga=(e,t,n,r=zo)=>{const a=Math.ceil(t)+so,o=Math.ceil(n)+so;if(a>r||o>r)return null;let s=e.shelves.find(l=>l.h>=o&&l.h<=o*2+4&&l.x+a<=r);if(!s){if(e.top+o>r)return null;s={y:e.top,h:o,x:0},e.shelves.push(s),e.top+=o}const i={x:s.x,y:s.y};return s.x+=a,i},ja=(e=zo)=>{const t=document.createElement("canvas");t.width=e,t.height=e;const n=t.getContext("2d"),r={canvas:t,size:e,version:0,entries:new Map,pack:{shelves:[],top:0},full:!1},a=o=>{const s=Ga(r.pack,o.w,o.h,e);if(!s)return null;n.save(),n.translate(s.x,s.y),n.beginPath(),n.rect(0,0,Math.ceil(o.w),Math.ceil(o.h)),n.clip();try{o.draw(n)}catch(l){console.warn("map sprite failed to draw:",o.key,l.message)}n.restore();const i={x:s.x,y:s.y,w:o.w,h:o.h,u0:s.x/e,v0:s.y/e,u1:(s.x+o.w)/e,v1:(s.y+o.h)/e,pending:!!o.pending};return r.entries.set(o.key,i),r.version+=1,i};return r.get=o=>{const s=r.entries.get(o.key);if(s)return s;const i=a(o);return i||(r.full=!0),i},r.reset=()=>{n.clearRect(0,0,e,e),r.entries.clear(),r.pack={shelves:[],top:0},r.full=!1,r.version+=1},r.dropPending=()=>{let o=!1;return r.entries.forEach((s,i)=>{s.pending&&(r.entries.delete(i),o=!0)}),o},r},qa=Object.assign({}),Va=Object.assign({}),ct={};Object.entries(qa).forEach(([e,t])=>{var r;const n=(r=e.match(/sprites\/([a-z0-9-]+)\/sheet\.json$/))==null?void 0:r[1];n&&(ct[n]={...t,urls:[]})});Object.entries(Va).forEach(([e,t])=>{const n=e.match(/sprites\/([a-z0-9-]+)\/[a-z0-9-]+-(\d+)\.png$/);n&&ct[n[1]]&&(ct[n[1]].urls[Number(n[2])]=t)});const ro=e=>{var t,n;return(n=(t=ct[e])==null?void 0:t.urls)!=null&&n.length?ct[e]:null},Ka=(e,t=0)=>{var n;return((n=ro(e))==null?void 0:n.urls[t%ro(e).urls.length])||null},Ha='ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',Qt=new Map,Tt=new Set,Xa=e=>(Tt.add(e),()=>Tt.delete(e)),No=e=>{if(!e||typeof Image>"u")return null;let t=Qt.get(e);return t||(t=new Image,t.decoding="async",t.onload=()=>Tt.forEach(n=>n(e)),t.onerror=()=>{t.failed=!0,Tt.forEach(n=>n(e))},t.src=e,Qt.set(e,t)),t.complete&&t.naturalWidth>0?t:null},re=e=>{var t;return!!e&&typeof Image<"u"&&!No(e)&&!((t=Qt.get(e))!=null&&t.failed)},oe=(e,t,n,r,a,o)=>{const s=No(t);return s&&e.drawImage(s,n,r,a,o),!!s};let lt=null;const sn=(e,t)=>(!lt&&typeof document<"u"&&(lt=document.createElement("canvas").getContext("2d")),lt?(lt.font=e,lt.measureText(t).width):t.length*6),ne=(e,t=700)=>`${t} ${e}px ${Ha}`,Ze=(e,{size:t=11,weight:n=700,fill:r="#fff",stroke:a="rgba(0,0,0,0.75)",strokeW:o=2.5}={},s=1)=>{const i=String(e),l=sn(ne(t,n),i)+o+4,d=Math.ceil(t*1.45+o),f=Math.round(t*1.05+o/2);return{key:`label|${i}|${t}|${n}|${r}|${a}|${o}|${s}`,w:Math.ceil(l*s),h:Math.ceil(d*s),css:{w:Math.ceil(l*s)/s,h:Math.ceil(d*s)/s,baseline:f},draw:u=>{u.scale(s,s),u.font=ne(t,n),u.textAlign="center",u.textBaseline="alphabetic",u.lineJoin="round",a&&o>0&&(u.strokeStyle=a,u.lineWidth=o,u.strokeText(i,l/2,f)),u.fillStyle=r,u.fillText(i,l/2,f)}}},Xe=(e=64,{ring:t=0,dash:n=null}={})=>({key:`disc|${e}|${t}|${n?n.join(","):""}`,w:e,h:e,css:{w:e,h:e},draw:r=>{r.beginPath(),r.arc(e/2,e/2,e/2-t/2-.5,0,Math.PI*2),t>0?(n&&r.setLineDash(n),r.strokeStyle="#fff",r.lineWidth=t,r.stroke()):(r.fillStyle="#fff",r.fill())}}),Gt=[[[0,1],[.32,.28],[.44,.42],[.58,.08],[1,1]],[[0,1],[.46,.04],[.62,.36],[.74,.24],[1,1]],[[0,1],[.28,.4],[.4,.3],[.54,.12],[.8,.5],[1,1]]],Za=.38,Ya=(e,t,n,r)=>{const a=Math.max(4,Math.round(t/2)*2),o=Math.round(a*.72),s=Math.ceil(a*r)+2,i=Math.ceil(o*r)+2,l=Gt[e%Gt.length];return{key:`peak|${e%Gt.length}|${a}|${n?1:0}|${r}`,w:s,h:i,css:{w:s/r,h:i/r},draw:d=>{const f=c=>1+c*(s-2),u=c=>1+c*(i-2),m=l.reduce((c,y)=>y[1]<c[1]?y:c,l[0]),w=()=>{d.beginPath(),l.forEach(([c,y],M)=>M?d.lineTo(f(c),u(y)):d.moveTo(f(c),u(y))),d.closePath()};w(),d.fillStyle="#6f5f4c",d.fill(),d.save(),w(),d.clip(),d.beginPath(),d.moveTo(f(0),u(1)),l.slice(1).forEach(([c,y])=>{c<=m[0]&&d.lineTo(f(c),u(y))}),d.lineTo(f(m[0]+.1),u(1)),d.closePath(),d.fillStyle="#b9a586",d.fill(),n&&(d.fillStyle="rgba(248,250,252,0.95)",d.fillRect(0,0,s,u(m[1]+.3))),d.restore(),w(),d.strokeStyle="rgba(48,38,28,0.85)",d.lineWidth=Math.max(.8,r*.7),d.lineJoin="round",d.stroke()}}},Qa=(e,t)=>{const n=Math.ceil(e*t);return{key:`pass|${n}`,w:n,h:n,css:{w:n/t,h:n/t},draw:r=>{const a=n/2;r.beginPath(),r.arc(a,a,a-.5,0,Math.PI*2),r.fillStyle="rgba(254,243,199,0.8)",r.fill(),r.strokeStyle="#3f2d1d",r.lineWidth=Math.max(1,n*.12),r.lineCap="round",r.beginPath(),r.arc(a-n*.62,a,n*.42,-.75,.75),r.stroke(),r.beginPath(),r.arc(a+n*.62,a,n*.42,Math.PI-.75,Math.PI+.75),r.stroke()}}},jt=[6,8,10,12,16,20,24,32,40,48],Ja=e=>jt.find(t=>t>=e)||jt[jt.length-1],Do=1.9,el=(e,t)=>{const{r0:n,iconUrl:r,capitalUrl:a,colour:o,fill:s,outpost:i,siege:l,walls:d,disloyal:f,disaster:u,size:m,siegeUrl:w}=e,c=Math.ceil(t*Do*2),y=re(r)||re(a)||re(w),M=k=>k==null?"":Math.round(k*20);return{key:`badge|${t}|${Math.round(n*10)}|${r||""}|${a||""}|${o}|${s}|${M(i)}|${M(l)}|${d?1:0}|${f?1:0}|${u||""}|${m??""}`,w:c,h:c,pending:y,draw:k=>{var E;const p=t,h=c/2,g=1.6/n*p;k.translate(h,h);const A=(R,N,O,U)=>{const z=Math.max(.02,Math.min(1,R))*Math.PI*2;k.beginPath(),k.arc(0,0,N,-Math.PI/2,-Math.PI/2+z),k.strokeStyle=O,k.lineWidth=U,k.lineCap="round",k.stroke()};if(k.beginPath(),k.arc(0,0,p,0,Math.PI*2),k.fillStyle=s,k.fill(),i!=null&&k.setLineDash([2/n*p,2/n*p]),k.strokeStyle=o,k.lineWidth=2/n*p,k.stroke(),k.setLineDash([]),i==null&&r&&oe(k,r,-p*.92,-p*.92,p*1.84,p*1.84),a?oe(k,a,-p*1.35,-p*1.35,p*.95,p*.95):e.capital&&(k.beginPath(),k.arc(0,0,p*.4,0,Math.PI*2),k.fillStyle=o,k.fill()),i!=null&&A(i,p+g*1.2,"#fde68a",g),l!=null){A(l,p+g*1.2,"#f97316",g);const R=p*.95;w&&oe(k,w,-R/2,-p-g*2.5-R*.8,R,R)||(k.font=ne(p*.9),k.textAlign="center",k.fillStyle="#fb923c",k.strokeStyle="rgba(0,0,0,0.7)",k.lineWidth=g*.8,k.strokeText("⚔",0,-p-g*2.5),k.fillText("⚔",0,-p-g*2.5))}if(d&&i==null&&(k.fillStyle="#475569",k.strokeStyle="#0f172a",k.lineWidth=g*.4,k.fillRect(-p*.9,p*.45,p*1.8,p*.35),k.strokeRect(-p*.9,p*.45,p*1.8,p*.35)),f&&(k.beginPath(),k.arc(p*.85,-p*.85,p*.38,0,Math.PI*2),k.fillStyle="#ef4444",k.fill(),k.strokeStyle="#0f172a",k.lineWidth=g*.4,k.stroke()),u&&(k.font=ne(p*.9,400),k.textAlign="center",k.fillStyle="#fff",k.fillText(u==="flood"?"≈":u==="fire"?"🔥":"☠",-p*.95,-p*.6)),m!=null){const R=p*.35,N=p*.3,O=p*1.05,U=p*.85;k.beginPath(),(E=k.roundRect)==null||E.call(k,R,N,O,U,p*.3),k.roundRect||k.rect(R,N,O,U),k.fillStyle="#0f172a",k.fill(),k.strokeStyle=o,k.lineWidth=g*.5,k.stroke(),k.font=ne(p*.72),k.textAlign="center",k.fillStyle="#f8fafc",k.fillText(String(m),R+O/2,p*.97)}}}},ao="M2 2 H24 V17 Q24 25 13 30 Q2 25 2 17 Z",lo={infantry:"M2 8 L8 2 M6.5 2 H8 V3.5",ranged:"M3 2 Q8 5 3 8 M3 2 V8",cavalry:"M2 8 L3 4 L6 3 L8 4 L7 5 L6 5 L6 8",siege:"M1.5 8 H8.5 M3 8 L5 3 L7 8 M5 3 L8.5 1.5",mixed:"M2 5 H8 M5 2 V8"},tl={small:1,medium:2,large:3},nl="#ea580c",De=e=>typeof Path2D<"u"?new Path2D(e):null,xo=(e,t)=>e.own?Jt:e.rebels?nl:Ye(e.ownerId)||(t?"#ef4444":"#64748b"),Ke=6,Re=(e,t,n,r,a,o)=>({key:`${e}|${r}`,w:Math.ceil((t+Ke*2)*r),h:Math.ceil((n+Ke*2)*r),pending:a,css:{w:Math.ceil((t+Ke*2)*r)/r,h:Math.ceil((n+Ke*2)*r)/r},draw:s=>{s.scale(r,r),s.translate(Ke,Ke),s.shadowColor="rgba(0,0,0,0.7)",s.shadowBlur=2*r,s.shadowOffsetY=1*r,o(s)}}),Qe=(e,t,n,r,a,o)=>{const s=Math.min(r/t,a/n);e.save(),e.translate((r-t*s)/2,(a-n*s)/2),e.scale(s,s),o(),e.restore()},Wo=(e,t,n)=>{e.beginPath(),e.arc(t,n,3.5,0,Math.PI*2),e.fillStyle="#facc15",e.fill(),e.lineWidth=1.5,e.strokeStyle="#0f172a",e.stroke()},ol=(e,t,n)=>{const r=xo(e,t);if(e.own){const o=Eo(e.mainClass),s=is(e.men);return Re(`army|own|${r}|${En(e.morale)}|${e.mainClass}|${s}|${e.canMove?1:0}|${o?"i":"g"}`,30,34,n,re(o),i=>{Qe(i,26,32,30,34,()=>{i.fillStyle=r,i.strokeStyle=En(e.morale),i.lineWidth=2.4;const l=De(ao);if(l&&(i.fill(l),i.shadowColor="transparent",i.stroke(l)),!(o&&oe(i,o,5.5,13,15,15))){i.save(),i.translate(8,17.5),i.strokeStyle="#e2e8f0",i.lineWidth=1.3,i.lineCap="round";const d=De(lo[e.mainClass]||lo.infantry);d&&i.stroke(d),i.restore()}}),i.shadowColor="rgba(0,0,0,0.9)",i.shadowBlur=1,i.shadowOffsetY=1,i.font=ne(10,800),i.textAlign="center",i.textBaseline="top",i.fillStyle="#fff",i.fillText(s,15,4),i.shadowColor="transparent",e.canMove&&Wo(i,28.5,1.5)})}const a=tl[e.band]||0;return Re(`army|foreign|${r}|${t?1:0}|${a}`,22,26,n,!1,o=>{Qe(o,26,32,22,26,()=>{o.fillStyle=r,o.strokeStyle=t?"#ef4444":"rgba(15,23,42,0.9)",o.lineWidth=t?2.6:1.6;const s=De(ao);if(s&&(o.fill(s),o.shadowColor="transparent",o.stroke(s)),o.fillStyle="#f8fafc",a)for(let i=0;i<a;i++)o.beginPath(),o.arc(13+(i-(a-1)/2)*5,14,1.8,0,Math.PI*2),o.fill();else o.font=ne(12,800),o.textAlign="center",o.fillText("?",13,18)})})},sl=(e,t,n)=>{const r=xo(e,t),a=e.own?24:18,o=e.own?gr(e.navalLine):null;return Re(`fleet|${e.own?1:0}|${r}|${t?1:0}|${o||""}|${e.own&&e.embarked||0}|${e.own&&e.canMove?1:0}`,a,a,n,re(o),s=>{var i;Qe(s,24,24,a,a,()=>{if(s.beginPath(),s.arc(12,12,10.5,0,Math.PI*2),s.fillStyle=r,s.fill(),s.shadowColor="transparent",s.strokeStyle=t?"#ef4444":e.own?"#e2e8f0":"rgba(15,23,42,0.9)",s.lineWidth=1.6,s.stroke(),!(o&&oe(s,o,3.5,3.5,17,17))){const l=De("M5 13 H19 L16.5 17 H7.5 Z M12 6 V13 M12 6 L16 11 H12");l&&(s.fillStyle="#f8fafc",s.strokeStyle="#f8fafc",s.lineWidth=.8,s.fill(l),s.stroke(l))}}),e.own&&e.embarked&&(s.beginPath(),(i=s.roundRect)==null||i.call(s,a-7,a-9,13,13,6.5),s.fillStyle="#0f172a",s.fill(),s.font=ne(9),s.textAlign="center",s.textBaseline="middle",s.fillStyle="#fde68a",s.fillText(String(e.embarked),a-.5,a-2.5)),e.own&&e.canMove&&Wo(s,a-1.5,1.5)})},rl=(e,t,{sea:n=!1}={})=>{const r=n&&pe("sea-battle")||pe("battle"),a=e.won?"#22c55e":e.outcome==="stalemate"?"#f59e0b":"#f87171";return Re(`battle|${a}|${r||""}`,22,22,t,re(r),o=>{Qe(o,24,24,22,22,()=>{if(o.beginPath(),o.arc(12,12,10.5,0,Math.PI*2),o.fillStyle="#7f1d1d",o.fill(),o.shadowColor="transparent",o.strokeStyle=a,o.lineWidth=2,o.stroke(),!(r&&oe(o,r,4,4,16,16))){const s=De("M7 7 L17 17 M17 7 L7 17 M6 9.5 L9.5 6 M14.5 6 L18 9.5");s&&(o.strokeStyle="#f8fafc",o.lineWidth=2,o.lineCap="round",o.stroke(s))}})})},al=(e,t)=>{const n=e.own?Jt:Ye(e.ownerId)||"#64748b",r=e.own?24:18,a=Math.max(0,Math.min(1,(e.progress||0)/100));return Re(`colony|${n}|${r}|${Math.round(a*20)}`,r,r,t,!1,o=>{Qe(o,24,24,r,r,()=>{o.beginPath(),o.arc(12,12,10,0,Math.PI*2),o.fillStyle=n,o.fill(),o.shadowColor="transparent",o.strokeStyle="rgba(15,23,42,0.9)",o.lineWidth=2.4,o.stroke(),a>0&&(o.beginPath(),o.arc(12,12,10,-Math.PI/2,-Math.PI/2+a*Math.PI*2),o.strokeStyle="#4ade80",o.stroke());const s=De("M6.5 16.5 L12 7 L17.5 16.5 Z M12 16.5 V12.5");s&&(o.fillStyle="#f8fafc",o.strokeStyle="#0f172a",o.lineWidth=.8,o.fill(s),o.stroke(s))})})},ll=(e,t)=>{const n=e.own?Jt:Ye(e.ownerId)||"#64748b",r=e.own?24:20,a=To(e.id)||pe("wonder");return Re(`wonder|${n}|${r}|${a||""}|${e.tier||1}`,r,r,t,re(a),o=>{Qe(o,24,24,r,r,()=>{var s;if(o.beginPath(),(s=o.roundRect)==null||s.call(o,3,3,18,18,4),o.roundRect||o.rect(3,3,18,18),o.fillStyle=n,o.fill(),o.shadowColor="transparent",o.strokeStyle="rgba(15,23,42,0.9)",o.lineWidth=2,o.stroke(),!(a&&oe(o,a,4,3,16,16))){const i=De("M12 5 L15.5 17.5 H8.5 Z M6.5 18 H17.5");i&&(o.fillStyle="#fef3c7",o.fill(i))}[1,2,3].forEach(i=>{o.beginPath(),o.arc(6+(i-1)*6,21.5,1.6,0,Math.PI*2),o.fillStyle=i<=(e.tier||1)?"#fde68a":"rgba(15,23,42,0.6)",o.fill()})})})},il=e=>{const t=pe("event");return Re(`event|${t||""}`,24,24,e,re(t),n=>{n.beginPath(),n.arc(12,12,10.5,0,Math.PI*2),n.fillStyle="#b45309",n.fill(),n.shadowColor="transparent",n.strokeStyle="#fde68a",n.lineWidth=2,n.stroke(),t&&oe(n,t,4,4,16,16)||(n.strokeStyle="#fffbeb",n.lineWidth=2.6,n.lineCap="round",n.beginPath(),n.moveTo(12,6),n.lineTo(12,13.5),n.stroke(),n.beginPath(),n.arc(12,17.2,1.5,0,Math.PI*2),n.fillStyle="#fffbeb",n.fill())})},cl=(e,t,n)=>{const r=String(e),a=Math.max(24,sn(ne(11,800),r)+14);return Re(`cluster|${r}|${t?1:0}`,a,24,n,!1,o=>{var s;o.beginPath(),(s=o.roundRect)==null||s.call(o,1,1,a-2,22,11),o.roundRect||o.rect(1,1,a-2,22),o.fillStyle=t?"#2563eb":"#334155",o.fill(),o.shadowColor="transparent",o.strokeStyle=t?"#e2e8f0":"#94a3b8",o.lineWidth=2,o.stroke(),o.font=ne(11,800),o.textAlign="center",o.textBaseline="middle",o.fillStyle="#fff",o.fillText(r,a/2,12.5)})},qt=({kind:e,iconUrl:t,letter:n,own:r},a)=>{const i=Math.ceil(13.4*a);return{key:`glyph|${e}|${t||""}|${n||""}|${r?1:0}|${a}`,w:i,h:i,pending:re(t),css:{w:i/a,h:i/a},draw:l=>{var d;l.scale(a,a),l.translate(i/a/2,i/a/2),e==="district"?(l.beginPath(),(d=l.roundRect)==null||d.call(l,-5.2,-5.2,5.2*2,5.2*2,5.2*.25),l.roundRect||l.rect(-5.2,-5.2,5.2*2,5.2*2),l.fillStyle="#c4b5fd",l.fill(),l.strokeStyle="#312e81",l.lineWidth=.8,l.stroke(),l.font=ne(8),l.textAlign="center",l.fillStyle="#1e1b4b",l.fillText(n||"",0,8*.36)):e==="improvement"?(l.beginPath(),l.arc(0,0,5.2,0,Math.PI*2),l.fillStyle=r?"#fef3c7":"#e2e8f0",l.fill(),l.strokeStyle="#44403c",l.lineWidth=.8,l.stroke(),t&&oe(l,t,-5.2*.85,-5.2*.85,5.2*1.7,5.2*1.7)||(l.font=ne(8),l.textAlign="center",l.fillStyle="#292524",l.fillText(n||"•",0,8*.36))):t?(l.beginPath(),l.arc(0,0,5.2*1.05,0,Math.PI*2),l.fillStyle="rgba(248,250,252,0.85)",l.fill(),l.strokeStyle="#701a75",l.lineWidth=.7,l.stroke(),oe(l,t,-5.2*.95,-5.2*.95,5.2*1.9,5.2*1.9)):(l.beginPath(),l.moveTo(0,-5.2),l.lineTo(5.2,0),l.lineTo(0,5.2),l.lineTo(-5.2,0),l.closePath(),l.fillStyle="#f0abfc",l.fill(),l.strokeStyle="#701a75",l.lineWidth=.7,l.stroke())}}},Uo=(e,t,n)=>{const r=Math.ceil(t*n);return{key:`icon|${e}|${r}`,w:r,h:r,pending:re(e),css:{w:r/n,h:r/n},draw:a=>{oe(a,e,0,0,r,r)}}},fl=(e,t,n)=>{const r=Ka("ai-battle-clash",0),a=pe("battle"),o=Math.ceil(t*n);return{key:`groundBattle|${e}|${o}|${r||""}`,w:o,h:o,pending:re(r)||re(a),css:{w:o/n,h:o/n},draw:s=>{r&&oe(s,r,0,0,o,o)||(s.beginPath(),s.arc(o/2,o/2,o*.3,0,Math.PI*2),s.fillStyle=e==="attacker"?"rgba(127,29,29,0.7)":"rgba(30,41,59,0.7)",s.fill(),a&&oe(s,a,0,0,o,o))}}},ul=({own:e,idle:t,iconUrl:n},r,a)=>{const o=Math.max(2,r),s=Math.ceil((o*3.6+2)*a),i=Math.round(o*a);return{key:`settler|${e?1:0}|${t?1:0}|${n||""}|${i}`,w:s,h:s,pending:re(n),css:{w:s/a,h:s/a},draw:l=>{l.scale(a,a),l.translate(s/a/2,s/a/2);const d=e?"#fde68a":"#e2e8f0",f=e?"#92400e":"#334155";n?(l.beginPath(),l.arc(0,0,o*1.15,0,Math.PI*2),l.fillStyle=d,l.fill(),l.strokeStyle=f,l.lineWidth=Math.max(.8,o*.24),l.stroke(),oe(l,n,-o,-o,o*2,o*2)):(l.beginPath(),l.moveTo(0,-o),l.lineTo(o,o*.8),l.lineTo(-o,o*.8),l.closePath(),l.fillStyle=d,l.fill(),l.strokeStyle=f,l.stroke()),t&&(l.beginPath(),l.setLineDash([o*.6,o*.4]),l.arc(0,0,o*1.6,0,Math.PI*2),l.strokeStyle="#fde68a",l.lineWidth=Math.max(.6,o*.2),l.stroke())}}},dl='"Spectral SC", Georgia, serif',hl='"JetBrains Mono", ui-monospace, Menlo, monospace',pl=e=>{var t;try{return typeof document<"u"&&!!((t=document.fonts)!=null&&t.check(`700 ${e}px "Spectral SC"`))}catch{return!1}},ml=(e,t,n=12)=>{const r=pe("capital"),a=pe("siege")||pe("battle"),o=e.outpost!=null?"⛺":String(e.size||1),s=pl(n+1),i=s?`700 ${n+1}px ${dl}`:ne(n),l=s?`600 ${n-1}px ${hl}`:ne(n-1,800),d=sn(i,e.name),f=n+6,u=(e.capital?17:0)+(e.disloyal?16:0)+(e.siege!=null?17:0),m=Math.ceil(3+f+6+d+u+9),w=Math.ceil(n+12),c=e.siege??e.outpost??e.build??null,y=6,M=m+y*2,k=w+y*2+5,p=h=>h==null?"":Math.round(h*20);return{key:`cityBanner|${e.name}|${o}|${e.colour}|${e.selected?1:0}|${e.capital?1:0}|${e.disloyal?1:0}|${p(e.siege)}|${p(e.outpost)}|${p(e.build)}|${n}|${s?1:0}|${t}`,w:Math.ceil(M*t),h:Math.ceil(k*t),pending:re(e.capital?r:null)||re(e.siege!=null?a:null),css:{w:Math.ceil(M*t)/t,h:Math.ceil(k*t)/t,pillW:m,pillH:w,pad:y},draw:h=>{var E,R,N;h.scale(t,t),h.translate(y,y);const g=(O=.5,U=.5,z=m-1,B=w-1)=>{var W;h.beginPath(),(W=h.roundRect)==null||W.call(h,O,U,z,B,B/2),h.roundRect||h.rect(O,U,z,B)};h.shadowColor="rgba(0,0,0,0.5)",h.shadowBlur=6,h.shadowOffsetY=2,g(),h.fillStyle="rgba(26,33,43,0.92)",h.fill(),h.shadowColor="transparent",h.beginPath(),h.arc(3+f/2,w/2,f/2,0,Math.PI*2),h.fillStyle=e.colour,h.fill(),h.font=l,h.textAlign="center",h.textBaseline="middle",h.fillStyle="#10141A",h.fillText(o,3+f/2,w/2+.5);let A=3+f+6;if(h.font=i,h.textAlign="left",h.fillStyle="#ECE5D3",h.fillText(e.name,A,w/2+.5),A+=d+3,e.capital&&(r&&oe(h,r,A,w/2-7,14,14)||(h.fillStyle="#ECE5D3",h.font=ne(11),h.textAlign="left",h.fillText("★",A,w/2)),A+=17),e.disloyal&&(h.beginPath(),(E=h.roundRect)==null||E.call(h,A,w/2-6.5,12,13,6),h.fillStyle="#E5604D",h.fill(),h.fillStyle="#10141A",h.font=ne(10),h.textAlign="center",h.fillText("!",A+6,w/2+.5),A+=16),e.siege!=null&&(a&&oe(h,a,A,w/2-7,14,14)||(h.fillStyle="#EE8A3A",h.font=ne(11),h.textAlign="left",h.fillText("⚔",A,w/2))),g(),h.strokeStyle=e.colour,h.lineWidth=1,h.stroke(),e.selected&&(g(-1.5,-1.5,m+3,w+3),h.strokeStyle="#ECE5D3",h.lineWidth=2,h.stroke()),c!=null){const O=Math.min(56,m-16),U=(m-O)/2;h.beginPath(),(R=h.roundRect)==null||R.call(h,U,w+3,O,3,1.5),h.roundRect||h.rect(U,w+3,O,3),h.fillStyle="#33404F",h.fill(),h.beginPath(),(N=h.roundRect)==null||N.call(h,U,w+3,Math.max(1.5,O*Math.max(0,Math.min(1,c))),3,1.5),h.roundRect||h.rect(U,w+3,O*c,3),h.fillStyle=e.siege!=null?"#EE8A3A":e.outpost!=null?"#ECE5D3":"#CDB27A",h.fill()}}}},Ct=3/tn(),wl=5/tn(),Pt=2.5,gl=1.5,Me=10/tn(),vl=2,kl=22,bl={farm:"F",pasture:"P",camp:"H",mine:"M",quarry:"Q",lumber_camp:"L",fishing_boats:"B",plantation:"N",oil_well:"O",fort:"W"},ve=[1,1,1,1],It=e=>[1,1,1,e],xe=(e,t)=>{const{lat:n,lon:r}=ae().latLonOf(t);return e([r,n])},io=(e,t=1.5)=>{const n=e.width/e.k*t,r=e.height/e.k*t,a=e.worldTop+e.height/e.k/2;return n*2>=e.worldW?o=>Math.abs(o[1]-a)<=r:o=>{const s=o[0]-e.camX,i=s-e.worldW*Math.round(s/e.worldW);return Math.abs(i)<=n&&Math.abs(o[1]-a)<=r}},yl=({state:e,projection:t,k:n,selectedRegion:r,dpr:a,bannerFont:o=12,isTown:s,near:i=null})=>{const l=[],d=[],f=[],u=n>=Me,m={},w=p=>m[p]||(m[p]=Dr(e.age,Mr(e,p))),c=pe("capital"),y=pe("siege")||pe("battle"),M=Math.sqrt(n),k=u?new Map(cs(e).map(p=>[p.id,p.buildShare])):null;return Object.values(e.regions).forEach(p=>{var U,z,B,W,V;const h=fs(e,p.id);if(!h)return;const g=t([h.lng,h.lat]);if(!g||i&&!i(g))return;const A=p.ghost?"#94a3b8":p.owner?Ye(p.owner):"#94a3b8",E=p.isCapital?5+(p.size||1)*.35:3.5+(p.size||1)*.3;if(u){if(f.push({kind:"city",id:p.id,anchor:g,offset:[0,0,0,0],size:[E*2,E*2],exp:[.5,0],round:!0,pad:0}),!(p.owner||p.colony))return;const _=p.owner&&!p.outpost?Ln(p):null,J=_?_.modelRadius:1,le=J+((((z=(U=p.buildings)==null?void 0:U.categories)==null?void 0:z.defense)??-1)>=0?.3:0),ke=Math.sin(Ts(n)),G=us({projection:t,tiles:ae(),tile:p.tile,k:n,radius:le,lean:ke,fill:!!_,isTown:s,tierScale:_&&ds[_.id]||1}),be=Cs(J,G,ke),Q=p.owner||((B=p.colony)==null?void 0:B.ownerId),q=Q===e.playerNationId,te=ml({name:p.name,size:p.size,colour:q?Lo:Ye(Q)||"#94a3b8",selected:p.id===r,capital:!!p.isCapital,disloyal:!!p.owner&&$n(p)<=25,siege:p.siege?Math.max(0,Math.min(1,p.siege.hp/Math.max(1,p.siege.maxHp))):null,outpost:p.outpost?Math.max(0,Math.min(1,(p.outpost.progress||0)/On)):null,build:q?k.get(p.id)??null:null},a,o),ie=be+te.css.h/2-te.css.pad;d.push({art:te,anchor:g,offset:[0,ie,0,0],size:[te.css.w,te.css.h],exp:[0,0],color:ve}),f.push({kind:"banner",id:p.id,anchor:g,offset:[0,be+te.css.pillH/2,0,0],size:[te.css.pillW,te.css.pillH],exp:[0,0],pad:[4,9]});return}const R=E*M,N=el({r0:E,colour:A,capital:!!p.isCapital,fill:p.id===r?"#fde68a":p.outpost?"#e2e8f0":"#f8fafc",iconUrl:p.outpost?null:vr((W=Ln(p))==null?void 0:W.id,w(p.owner)),capitalUrl:p.isCapital?c:null,outpost:p.outpost?(p.outpost.progress||0)/On:null,siege:p.siege?p.siege.hp/Math.max(1,p.siege.maxHp):null,siegeUrl:p.siege?y:null,walls:kr(p)>0,disloyal:!!p.owner&&$n(p)<=25,disaster:((V=p.disaster)==null?void 0:V.kind)||null,size:n>=Pt?p.size||1:null},Ja(R*a)),O=E*Do*2;if(l.push({art:N,anchor:g,offset:[0,0,0,0],size:[O,O],exp:[.5,0],color:It(p.ghost?.6:1)}),f.push({kind:"city",id:p.id,anchor:g,offset:[0,0,0,0],size:[E*2,E*2],exp:[.5,0],round:!0,pad:0}),n>=Pt||n>=gl&&(p.isCapital||p.owner===e.playerNationId)){const _=Ze(p.ghost&&p.lastSeen?`${p.name} · last seen T${p.lastSeen}`:p.name,{size:11,weight:700,fill:p.ghost?"#B9B19F":"#fff"},a);d.push({art:_,anchor:g,offset:[0,-2-_.css.baseline+_.css.h/2,0,-E],size:[_.css.w,_.css.h],exp:[0,.5],color:It(p.ghost?.6:1)})}}),{sprites:l,names:d,hits:f}},Ml=({markers:e,projection:t,k:n,atWar:r,dpr:a,waterTile:o})=>{const s=n>=Me,i=[];hs(e,n>=vl).forEach(f=>{const u=ps(f),m=u&&t([u.lng,u.lat]);if(!m)return;const w=Ps(n),c=s&&f.kind==="army"?[w*Tn.x,w*Tn.y-w*2.2-10]:ms[f.kind]||[0,0];i.push({...f,anchor:m,off:c,x:m[0]*n+c[0],y:m[1]*n+c[1]})});const l=[],d=[];return ws(i,kl).forEach(f=>{const u=f.members.length===1,m=s&&u&&f.kind==="army",w=a*(m?.72:1),c=u?f.kind==="event"?il(w):f.kind==="wonder"?ll(f,w):f.kind==="colony"?al(f,w):f.kind==="battle"?rl(f,w,{sea:f.tile!=null&&(o==null?void 0:o(f.tile))}):f.kind==="fleet"?sl(f,r.has(f.ownerId),w):ol(f,r.has(f.ownerId),w):cl(f.members.length,f.members.some(k=>k.own&&k.kind!=="battle"),w),y=c.w/a,M=c.h/a;l.push({art:c,anchor:f.anchor,offset:[f.off[0],f.off[1],0,0],size:[y,M],exp:[0,0],color:It(u&&!f.own?.92:1)}),d.push({kind:u?"marker":"cluster",marker:f,anchor:f.anchor,offset:[f.off[0],f.off[1],0,0],size:[y-12*(m?.72:1),M-12*(m?.72:1)],exp:[0,0],pad:7})}),{sprites:l,hits:d}},Sl=({state:e,projection:t,k:n,window:r,isExplored:a,lens:o,closeGround:s,dpr:i})=>{var h,g;const l=[],d=[];if(n<Ct||!r)return{sprites:l,lines:d};const f=ae(),u=((h=e.world)==null?void 0:h.tileState)||{},m=((g=e.world)==null?void 0:g.tileOwner)||{},w=n>=wl,c=new Set(Object.values(e.regions).map(A=>A.tile)),y=A=>{var E,R;return c.has(A)||!!((E=u[A])!=null&&E.road)&&!((R=u[A])!=null&&R.pillaged)},M=gs(r).filter(a),k=new Set(M.filter(y)),p=fe("#7c5a32");return k.forEach(A=>{const E=xe(t,A);f.neighbors[A].forEach(R=>{if(R<=A||!k.has(R))return;const N=xe(t,R),O=t.scale()*Math.PI,U=N[0]-E[0]>O?N[0]-2*O:N[0]-E[0]<-O?N[0]+2*O:N[0];d.push({a:E,b:[U,N[1]],half:.8,exp:0,color:[p[0],p[1],p[2],.85]})})}),M.forEach(A=>{var B,W;const E=u[A],R=w&&f.resourceOf?f.resourceOf(A):null,N=R&&((B=Jo[R])==null?void 0:B.kind)!=="bonus"&&(o==="yields"||m[A]!=null||f.neighbors[A].some(V=>m[V]!=null))?R:null;if(!(E!=null&&E.improvement)&&!(E!=null&&E.district)&&!N)return;const O=xe(t,A),U=E!=null&&E.pillaged?.45:1;let z=null;if(E!=null&&E.district&&Rn[E.district]?z=qt({kind:"district",letter:Rn[E.district].glyph},i):E!=null&&E.improvement&&E.improvement!=="road"&&!(s&&vs.includes(E.improvement))&&(z=qt({kind:"improvement",iconUrl:br(E.improvement),letter:bl[E.improvement]||"•",own:m[A]&&((W=e.regions[m[A]])==null?void 0:W.owner)===e.playerNationId},i)),z&&l.push({art:z,anchor:O,size:[z.css.w,z.css.h],color:It(U)}),N&&!(E!=null&&E.improvement)&&!(E!=null&&E.district)){const V=qt({kind:"resource",iconUrl:yr(N)},i);l.push({art:V,anchor:O,size:[V.css.w,V.css.h],color:ve})}}),{sprites:l,lines:d}},Al=({projection:e,k:t,near:n=null,dpr:r})=>{const a=[];if(t>=Cr&&t<Me&&Pr(Ir(e),t,n).forEach(o=>{const s=Ya(o.variant,o.px,o.snow,r);a.push({art:s,anchor:o.anchor,offset:[0,-s.css.h*Za,0,0],size:[s.css.w,s.css.h],exp:[0,0],color:ve})}),t>=Lr){const o=Math.min(13,6+Math.sqrt(t)*1.2);$r(e).forEach(({anchor:s})=>{if(n&&!n(s))return;const i=Qa(o,r);a.push({art:i,anchor:s,size:[i.css.w,i.css.h],exp:[0,0],color:ve})})}return a},El=({state:e,projection:t,k:n,dpr:r})=>{var o;const a=[];return n<Pt||Object.entries(((o=e.world)==null?void 0:o.tileState)||{}).forEach(([s,i])=>{if(!(i.wonder||i.battle&&i.battle.until>=e.turnNumber))return;const l=xe(t,Number(s));if(i.wonder){const f=To(i.wonder)||pe("wonder");if(f){const u=Uo(f,18,r);a.push({art:u,anchor:l,size:[u.css.w,u.css.h],color:ve})}return}const d=fl(i.battle.outcome,15,r);a.push({art:d,anchor:l,size:[d.css.w,d.css.h],color:ve})}),a},Tl=({state:e,projection:t,k:n,isVisible:r,dpr:a})=>{const o=[],s=[],i=n>=Me;return Object.values(e.units||{}).forEach(l=>{if(!Co(l)||l.tile==null)return;const d=l.ownerId===e.playerNationId;if(!d&&!(n>=2&&r(l.tile)))return;const f=xe(t,l.tile),u=i?Math.min(5*Math.sqrt(n),6):5*Math.sqrt(n),m=ul({own:d,idle:d&&l.target==null&&!i,iconUrl:Eo("settler")},u,a);o.push({art:m,anchor:f,size:[m.css.w,m.css.h],color:ve}),s.push({kind:"settler",tile:l.tile,anchor:f,offset:[0,0,0,0],size:[u*2.3,u*2.3],exp:[0,0],round:!0,pad:4})}),{sprites:o,hits:s}},Cl=({marchLines:e,projection:t,k:n,selectedArmy:r,dpr:a})=>{const o=[],s=[],i=Math.sqrt(n),l=t.scale()*Math.PI;return(e||[]).forEach(d=>{const f=[];if(d.points.forEach(g=>{const A=xe(t,g);if(!A)return;const E=f[f.length-1],R=E&&A[0]-E[0]>l?A[0]-2*l:E&&A[0]-E[0]<-l?A[0]+2*l:A[0];f.push([R,A[1]])}),f.length<2)return;const u=d.kind==="preview",m=fe(u?"#fde68a":d.halted?"#f87171":"#34d399"),w=!u&&r!=null&&d.points[0]!==r,c=w?.5:1,y=2.2;for(let g=1;g<f.length;g++)o.push({a:f[g-1],b:f[g],half:y*.9,exp:.5,color:[15/255,23/255,42/255,.55*c]});for(let g=1;g<f.length;g++)o.push({a:f[g-1],b:f[g],half:y*.45,dash:u?y*3:0,gap:u?y*2:0,exp:.5,color:[m[0],m[1],m[2],c]});const M=f[f.length-1],k=f[f.length-2],p=Math.atan2(M[1]-k[1],M[0]-k[0]),h=5*i/n;if([2.5,-2.5].forEach(g=>o.push({a:M,b:[M[0]+Math.cos(p+g)*h,M[1]+Math.sin(p+g)*h],half:y*.5,exp:.5,color:[m[0],m[1],m[2],c]})),u&&d.marks.slice(0,-1).forEach(g=>{const A=f[g.index];if(!A)return;const E=Xe(16);s.push({art:E,anchor:A,size:[3.2,3.2],exp:[.5,0],color:[m[0],m[1],m[2],1]})}),!w){const g=d.marks.length?d.marks[d.marks.length-1].turn:null,A=d.halted?"halted":g!=null?`${g} turn${g===1?"":"s"}`:"";if(A){const E=Ze(A,{size:10,weight:700,fill:d.halted?"#fecaca":"#fff",stroke:"rgba(15,23,42,0.85)",strokeW:2.2},a);s.push({art:E,anchor:M,offset:[0,-E.css.baseline+E.css.h/2,0,-9],size:[E.css.w,E.css.h],exp:[0,.5],color:ve})}}}),{lines:o,sprites:s}},co=(e,t,n)=>{const r=[];for(let o=0;o<48;o++){const s=o/48*Math.PI*2,i=(o+1)/48*Math.PI*2;r.push({...n,a:[e[0]+Math.cos(s)*t,e[1]+Math.sin(s)*t],b:[e[0]+Math.cos(i)*t,e[1]+Math.sin(i)*t]})}return r},Pl=({state:e,projection:t,k:n,lens:r,dpr:a,settlerTile:o=null})=>{const s={tints:null,sprites:[],lines:[]};if(o!=null&&(!r||r==="political"))return{...s,tints:Cn(e,[o])};if(!r||r==="political")return s;const i=l=>xe(t,l);if(r==="yields"){if(n<Ct)return s;ks(e).forEach(l=>{const d=Ze(`${l.food}·${l.production}·${l.gold}`,{size:9,weight:700,fill:l.worked?"#fef3c7":"#cbd5e1",strokeW:2},a);s.sprites.push({art:d,anchor:i(l.tile),offset:[0,-d.css.baseline+d.css.h/2,0,0],size:[d.css.w,d.css.h],color:ve})})}else if(r==="loyalty")bs(e).forEach(l=>{const d=fe(l.colour);s.sprites.push({art:Xe(64),anchor:i(l.tile),size:[28,28],exp:[.5,0],color:[d[0],d[1],d[2],.45]})});else if(r==="threat")ys(e).forEach(l=>{const d=i(l.tile),f=i(l.edgeTile),u=Math.max(6/n,Math.hypot(f[0]-d[0],f[1]-d[1])),m=fe(l.own?"#60a5fa":"#f87171");s.sprites.push({art:Xe(64),anchor:d,size:[u*2,u*2],exp:[1,0],color:[m[0],m[1],m[2],.08]}),s.lines.push(...co(d,u,{half:.5,dash:6,gap:4,color:[m[0],m[1],m[2],1]}));const w=Ze(`✈ ${l.count}`,{size:9,weight:700,fill:l.own?"#60a5fa":"#f87171",strokeW:2},a);s.sprites.push({art:w,anchor:d,offset:[0,-10-w.css.baseline+w.css.h/2,0,0],size:[w.css.w,w.css.h],color:ve})}),Ms(e).forEach(l=>{const d=i(l.tile),f=i(l.edgeTile),u=Math.max(6/n,Math.hypot(f[0]-d[0],f[1]-d[1]));s.sprites.push({art:Xe(64),anchor:d,size:[u*2,u*2],exp:[1,0],color:[239/255,68/255,68/255,.14]}),s.lines.push(...co(d,u,{half:.5,dash:4,gap:3,color:[239/255,68/255,68/255,.6]}));const m=Ze(l.strength.toLocaleString(),{size:10,weight:700,fill:"#fca5a5",strokeW:2},a);s.sprites.push({art:m,anchor:d,offset:[0,-2-m.css.baseline+m.css.h/2,0,-u],size:[m.css.w,m.css.h],exp:[0,1],color:ve})});else if(r==="supply")s.tints=[...Ss(e),...As(e)];else if(r==="settle")s.tints=Cn(e);else if(r==="trade"){const l=t.scale()*Math.PI;Es(e).forEach(d=>{const f=fe(d.plundered?"#f87171":d.kind==="sea"?"#38bdf8":"#fbbf24"),u=[];d.tiles.forEach(m=>{const w=i(m),c=u[u.length-1],y=c&&w[0]-c[0]>l?w[0]-2*l:c&&w[0]-c[0]<-l?w[0]+2*l:w[0];u.push([y,w[1]])});for(let m=1;m<u.length;m++)s.lines.push({a:u[m-1],b:u[m],half:1.25,dash:d.kind==="sea"?6:0,gap:d.kind==="sea"?4:0,color:[f[0],f[1],f[2],.9]});if(d.plunderTile!=null){const m=fe("#f87171");s.sprites.push({art:Xe(64),anchor:i(d.plunderTile),size:[14,14],exp:[.5,0],color:[m[0],m[1],m[2],.35]})}})}return s},fo=[1,1,1,1],Vt=5,Kt="#f87171",uo="#9C8FD0",Il="#fb923c",Oe=(e,t)=>{const{lat:n,lon:r}=ae().latLonOf(t);return e([r,n])},Ht=(e,t,n)=>{const r=[];for(let o=0;o<40;o++){const s=o/40*Math.PI*2,i=(o+1)/40*Math.PI*2;r.push({...n,a:[e[0]+Math.cos(s)*t,e[1]+Math.sin(s)*t],b:[e[0]+Math.cos(i)*t,e[1]+Math.sin(i)*t]})}return r},ho=(e,t)=>{var o;const n=(o=ae().neighbors[t])==null?void 0:o[0],r=Oe(e,t),a=n!=null?Oe(e,n):null;return r&&a?Math.hypot(a[0]-r[0],a[1]-r[1])*.75:.5},Ll=({model:e,projection:t,k:n,dpr:r})=>{const a=[],o=[],s=[];if(!e||!t)return{lines:a,sprites:o,hits:s};const i=t.scale()*Math.PI,l=(f,u,m,w,c)=>{const y=Ze(f,{size:10,weight:700,fill:u,stroke:"rgba(15,23,42,0.92)",strokeW:3},r),M=[0,w-y.css.h/2,0,0];o.push({art:y,anchor:m,offset:M,size:[y.css.w,y.css.h],exp:[0,0],color:fo}),c&&s.push({kind:"indep",id:c,anchor:m,offset:M,size:[Math.max(44,y.css.w),Math.max(28,y.css.h)],exp:[0,0],pad:4})};e.parties.forEach(f=>{if(!f.route.length)return;const u=[];[f.tile,...f.route].forEach(w=>{const c=Oe(t,w);if(!c)return;const y=u[u.length-1];u.push([y&&c[0]-y[0]>i?c[0]-2*i:y&&c[0]-y[0]<-i?c[0]+2*i:c[0],c[1]])});const m=fe(f.againstYou?Kt:uo);for(let w=1;w<u.length;w++)a.push({a:u[w-1],b:u[w],half:2.4,exp:0,color:[15/255,23/255,42/255,.55]});for(let w=1;w<u.length;w++)a.push({a:u[w-1],b:u[w],half:1.2,dash:7,gap:4,exp:0,color:[m[0],m[1],m[2],.95]})}),e.warnings.forEach(f=>{const u=Oe(t,f.tile);if(!u)return;const m=Math.max(ho(t,f.tile),11/n),w=fe(Kt);a.push(...Ht(u,m,{half:1.6,dash:5,gap:3,exp:0,color:[w[0],w[1],w[2],.95]})),a.push(...Ht(u,m*1.35,{half:.8,exp:0,color:[w[0],w[1],w[2],.45]}));const c=e.parties.find(M=>M.id===f.id),y=c?Oe(t,c.tile):null;n<Vt||y&&Math.hypot(y[0]-u[0],y[1]-u[1])*n<60||l(`Raid target: ${f.target}${f.eta!=null?` · ${f.eta}t`:""}`,"#fecaca",u,-m*n-8,f.id)});const d=Is("raid");return e.parties.forEach(f=>{const u=Oe(t,f.tile);if(!u)return;const m=fe(f.againstYou?Kt:uo),w=d?Uo(d,16,r):Xe(32);o.push({art:w,anchor:u,offset:[0,-18,0,0],size:d?[w.css.w,w.css.h]:[10,10],exp:[0,0],color:d?fo:[m[0],m[1],m[2],1]}),l(`Raid party${f.phase==="home"?", going home":f.eta!=null?` · ${f.eta}t`:""}`,f.againstYou?"#fecaca":"#e9e5fb",u,-30,f.id)}),e.sieges.forEach(f=>{const u=Oe(t,f.tile);if(!u)return;const m=fe(Il);a.push(...Ht(u,Math.max(ho(t,f.tile)*1.2,14/n),{half:1.4,dash:3,gap:3,exp:0,color:[m[0],m[1],m[2],.9]})),n>=Vt&&l(`${f.byName} besiege · ${Math.round(f.hp*100)}%`,"#fed7aa",u,-30,f.owner)}),e.burning.forEach(f=>{const u=Oe(t,f.tile);u&&n>=Vt&&l(`Burning · ${f.size} turn${f.size===1?"":"s"} left`,"#fecaca",u,34,null)}),{lines:a,sprites:o,hits:s}},po="#0f172a",_e=200,mo=1.6,$l=150,wo=1.8,ze=5,Ol=650,go=.35,Rl=(e,t)=>n=>[e[0]+(t[0]-e[0])*n,e[1]+(t[1]-e[1])*n,e[2]+(t[2]-e[2])*n],Fl=()=>Math.min(2,typeof window<"u"&&window.devicePixelRatio||1),_l=()=>{var e;return typeof window<"u"&&((e=window.matchMedia)==null?void 0:e.call(window,"(prefers-reduced-motion: reduce)").matches)},Yl=()=>{try{return!!document.createElement("canvas").getContext("webgl2")}catch{return!1}},Ql=({onAmbiguousTap:e=null,width:t,height:n,selectedRegion:r,onSelectRegion:a,hudOffset:o=!1,initialFocusRegionId:s=null,focusRegionId:i=null,navigateTarget:l=null,onViewportChange:d=null,selectedTile:f=null,onSelectTile:u=null,onSelectArmy:m=null,selectedArmy:w=null,lens:c="political",onFail:y=null})=>{var bn,yn;const{state:M}=Ls(),k=I.useRef(M);k.current=M;const p=$s(M),h=I.useMemo(()=>Os(M),[M]),g=h.state,A=I.useMemo(()=>f!=null&&Object.values(M.units).some(v=>Co(v)&&v.ownerId===M.playerNationId&&v.tile===f)?f:null,[f,M.units,M.playerNationId]),E=c==="supply"||c==="settle"||A!=null&&c==="political",{effects:R}=Rs(),N=Fs(),O=o?N:{top:0,bottom:0,left:0,right:0},U=Sr(),z=_s(),B=z==null?void 0:z.lines,W=I.useRef(null),V=I.useRef(null),_=I.useRef(null),J=I.useRef(Fe),le=I.useRef(null),ke=I.useRef(!1),[G,be]=I.useState(()=>({k:1,x:0,y:0,n:0})),[Q,q]=I.useState(!1),[te,ie]=I.useState(0),x=Fl(),P=I.useMemo(()=>t>0&&n>0?ns().fitSize([t,n],{type:"Sphere"}):null,[t,n]),H=I.useMemo(()=>P?zs(P):null,[P]),ee=H?Ns(t,H):1,K=I.useCallback(()=>P?yt({transform:J.current,width:t,height:n,dpr:x,projection:P,raster:H}):null,[P,H,t,n,x]);I.useEffect(()=>{var bt;const v=V.current;if(!v)return;let b;try{if(b=new dr({canvas:v,antialias:!0,powerPreference:"high-performance"}),!b.capabilities.isWebGL2)throw new Error("WebGL2 is needed")}catch(Ee){console.warn("The WebGL map is not available here, using the SVG map:",Ee.message),b==null||b.dispose(),y==null||y();return}b.setClearColor(po,1),b.info.autoReset=!1;const T=new Te,C=new Te,S=new Te,L=new Te,F=new Te,D=new hr;L.add(D);const X=new vo(0,1,0,-1,-1,1),j=ja(),$={renderer:b,camera:X,ground:T,terrain:C,base:S,close:L,top:F,closeRoot:D,atlas:j,raf:0,dirty:!0,closeActive:!1,closeLayout:null,groups:{},hits:[],frames:0};$.frame=()=>{$.raf=0},$.request=()=>{!$.raf&&!$.disposed&&($.raf=requestAnimationFrame(Ee=>$.frame(Ee)))};const Ie=Xt()?oa(b,ae(),{seed:((bt=ae().world)==null?void 0:bt.seed)||0}):null;$.raster=Da(T,{request:$.request,onReady:()=>$.request(),source:Ie}),$.territory=Pa(new Te,Zt(ae())),$.territoryCache=$a($.territory),$.terrainSprites=St(C,j,6),$.lowLines=oo(S,20),$.groundSprites=St(S,j,30),$.marchLines=oo(S,40),$.upperSprites=St(S,j,45),$.topSprites=St(F,j,50),$.closeScene=Or(L,D,{onAssets:()=>ie(Ee=>Ee+1)}),_.current=$;const qe=()=>{$.territoryCache.invalidate(),$.request()},st=()=>{document.visibilityState==="visible"&&qe()};return v.addEventListener("webglcontextrestored",qe),document.addEventListener("visibilitychange",st),q(!0),()=>{v.removeEventListener("webglcontextrestored",qe),document.removeEventListener("visibilitychange",st),$.disposed=!0,cancelAnimationFrame($.raf),[$.raster,$.territory,$.terrainSprites,$.lowLines,$.groundSprites,$.marchLines,$.upperSprites,$.topSprites,$.closeScene,$.territoryCache].forEach(Ee=>Ee.dispose()),b.dispose(),_.current=null}},[]);const ue=I.useRef({}),me=((bn=ts())==null?void 0:bn.size)||ss(t,n);ue.current={selectedTile:f,lens:c,tintOn:E,fogOn:h.on,worldUrl:An(me),worldSize:me,baseZ:Ds(me)};const Pe=I.useCallback(v=>{const b=_.current;if(!b)return;b.raf=0;const T=K();if(!T)return;const C=ue.current,{renderer:S,camera:L}=b;S.info.reset(),b.raster.update(T,{closeK:Me,baseZ:C.baseZ,worldUrl:C.worldUrl,worldSize:C.worldSize});const F={uHex:T.k>=Ct?1:0,uCityDetail:T.k>=Pt?1:0,uNationHalf:T.k<3?.55:.45,uSelTile:C.selectedTile??-1,uTintOn:C.tintOn?1:0,uFogOn:C.fogOn?1:0};[b.terrainSprites,b.lowLines,b.groundSprites,b.marchLines,b.upperSprites,b.topSprites].forEach(j=>j.update(T)),L.left=T.worldLeft,L.right=T.worldLeft+t/T.k,L.top=-T.worldTop,L.bottom=-(T.worldTop+n/T.k);const D=b.closeLayout,X=8e3/Math.min(T.k,(D==null?void 0:D.k)||T.k);if(L.near=-X,L.far=X,L.updateProjectionMatrix(),S.autoClear=!0,S.render(b.ground,L),S.autoClear=!1,S.render(b.terrain,L),b.lastTerritory=b.territoryCache.draw(S,L,T,F,T.k===Ge.current.k),S.render(b.base,L),b.closeActive=T.k>=Me&&!!D,b.closeActive){const j=He(D.camX,T.camX,T.worldW)-D.camX;b.closeRoot.position.set(-D.tx/D.k+j,D.ty/D.k,0),b.closeRoot.scale.setScalar(1/D.k),Tr.value=(v??performance.now())/1e3,S.clearDepth(),S.render(b.close,L)}S.render(b.top,L),b.frames+=1,b.closeActive&&b.closeScene.moving()&&b.request()},[K,t,n]);I.useEffect(()=>{_.current&&(_.current.frame=Pe,_.current.request())},[Pe,Q]),I.useEffect(()=>{const v=_.current;!v||t<=0||n<=0||(v.renderer.setPixelRatio(x),v.renderer.setSize(t,n,!1),v.request())},[Q,t,n,x]);const ye=I.useRef(0),Ge=I.useRef(G);Ge.current=G;const rn=I.useCallback(v=>{var S;J.current=v,(S=_.current)==null||S.request(),clearTimeout(ye.current);const b=Ge.current.k,T=v.k/b,C=()=>be({k:v.k,x:v.x,y:v.y,n:Date.now()});T>wo||T<1/wo?C():ye.current=setTimeout(C,$l)},[]);I.useEffect(()=>()=>clearTimeout(ye.current),[]);const an=I.useRef(null);I.useEffect(()=>{const v=W.current;if(!v||!Q||t<=0||n<=0||!P)return;const b=an.current;if(b&&b.projection!==P){Ve(v).interrupt();const S=xs({transform:J.current,from:b,to:{projection:P,width:t,height:n},minK:ee,maxK:_e});S&&(J.current=Fe.translate(S.x,S.y).scale(S.k))}an.current={projection:P,width:t,height:n},zt(J.current)||(J.current=Fe.scale(ee));const T=os().interpolate(Rl).scaleExtent([ee,_e]).translateExtent([[-1/0,0],[1/0,n]]).on("zoom",S=>rn(S.transform));le.current=T;const C=Ve(v);return C.call(T),C.call(T.transform,J.current.k<ee?Fe.scale(ee):J.current),()=>{C.on(".zoom",null)}},[Q,t,n,ee,rn,P]);const se=I.useCallback((v,b,T=ze,C=!1,S=!0)=>{if(!P||!le.current||!W.current)return!1;const L=Ws({lat:v,lng:b});if(!L||!Number.isFinite(T)||T<=0)return!1;const F=Math.min(_e,Math.max(ee,T)),D=P([L.lng,L.lat]);if(!D||!Number.isFinite(D[0])||!Number.isFinite(D[1]))return!1;const X=K(),j=J.current,$=X&&zt(j)?He(D[0],(t/2-j.x)/j.k,X.worldW):D[0],Ie=S?{left:O.left,right:O.right,top:O.top,bottom:O.bottom}:{left:0,right:0,top:0,bottom:0},qe=t-Ie.left-Ie.right,st=n-Ie.top-Ie.bottom,bt=qe>40?Ie.left+qe/2:t/2,Ee=st>40?Ie.top+st/2:n/2,Mn=Fe.translate(bt-$*F,Ee-D[1]*F).scale(F);if(!zt(Mn))return!1;const Sn=Ve(W.current);return(C?Sn.transition().duration(450):Sn).call(le.current.transform,Mn),!0},[P,K,t,n,ee,O.left,O.right,O.top,O.bottom]),ln=I.useCallback((v,b=ze,T=!1)=>{const C=Nt(k.current,v);return C?se(C.lat,C.lng,b,T):!1},[se]),cn=I.useRef(null);I.useEffect(()=>{if(cn.current!==p&&(cn.current=p,ke.current=!1),ke.current||!Q||!P)return;const v=tr(p);if(v&&se(v.lat,v.lng,v.scaleK/P.scale(),!1,!1)){ke.current=!0;return}const b=Us(k.current,[{regionId:s}],{selectedArmyTile:w}),T=Bs({height:n,scale:P.scale(),viewKm:Ol,minK:Me*1.05,maxK:_e})??ze;b&&se(b.lat,b.lng,T)&&(ke.current=!0)},[s,se,Q,P,p,w,n]);const fn=I.useRef(R.length?R[R.length-1].id:null),un=I.useRef(null);I.useEffect(()=>{const v=R[R.length-1];if(!v||v.id===fn.current)return;fn.current=v.id;const b=Nt(k.current,v.toRegionId);if(!b)return;const T=Math.max(J.current.k,ze);un.current={lat:b.lat,lng:b.lng,k:T,until:Date.now()+Gs(v.actionType)},se(b.lat,b.lng,T,!0)},[R,se]),I.useEffect(()=>{const v=un.current;if(v&&Date.now()<v.until){se(v.lat,v.lng,v.k,!0);return}i&&ln(i,js(J.current.k,ze,_e),!0)},[i,ln,se]),I.useEffect(()=>{l&&se(l.lat,l.lng,Math.max(J.current.k,ze),!0)},[l,se]),I.useEffect(()=>{if(!d||!P)return;const v=K(),b=P.invert(at(v,t/2,n/2));if(!b)return;ke.current&&qs(p,{lat:b[1],lng:b[0],scaleK:P.scale()*v.k});const T=360/(v.worldW*v.k);d({centerLng:b[0],centerLat:b[1],halfWidthDeg:t/2*T,halfHeightDeg:n/2*T})},[G,d,P,K,t,n,p]);const dn=I.useCallback(v=>{le.current&&W.current&&Ve(W.current).transition().duration(200).call(le.current.scaleBy,v)},[]),$t=I.useCallback(()=>{le.current&&W.current&&Ve(W.current).transition().duration(200).call(le.current.transform,Fe.scale(ee))},[ee]),ft=I.useMemo(()=>Vs(g.wars,g.playerNationId),[g.wars,g.playerNationId]),ut=I.useMemo(()=>pa(g.regions),[g.regions]),hn=(yn=g.world)==null?void 0:yn.tileOwner,dt=I.useMemo(()=>$o(ae().count,h),[h.on,h.explored,h.visible]);I.useEffect(()=>{const v=_.current;v&&(v.territory.setTiles(ma({tileCount:ae().count,tileOwner:hn,regions:g.regions,fog:h,index:ut,fogStates:dt})),v.request())},[Q,hn,dt,ut]),I.useEffect(()=>{const v=_.current;!v||!h.on||(v.territory.setFog(ia({states:dt,lookup:Zt(ae()).lookup})),v.request())},[Q,h.on,dt]),I.useEffect(()=>{const v=_.current;v&&(v.territory.setCities(wa({regions:g.regions,index:ut,playerNationId:g.playerNationId,selectedRegion:r,atWarNationIds:ft,nations:g.nations})),v.request())},[Q,g.regions,g.nations,ut,g.playerNationId,r,ft]);const we=I.useMemo(()=>P?Pl({state:g,projection:P,k:G.k,lens:c,dpr:x,settlerTile:A}):null,[g,P,G.k,c,x,A]);I.useEffect(()=>{const v=_.current;v&&(v.territory.setTints(ga(ae().count,(we==null?void 0:we.tints)||[])),v.request())},[Q,we]),I.useEffect(()=>{var v;(v=_.current)==null||v.request()},[f,c,E,h.on]);const Y=G.k,pn=Y>=Me,ht=I.useMemo(()=>Ks(M),[M.units,M.regions,M.nations,M.intel,M.battleReports,M.turnNumber,M.playerNationId]),pt=I.useMemo(()=>Rr(g),[g]),et=I.useMemo(()=>P?yt({transform:{k:G.k,x:G.x,y:G.y},width:t,height:n,dpr:x,projection:P,raster:H}):null,[P,H,G,t,n,x]),tt=I.useMemo(()=>P?yl({state:g,projection:P,k:Y,selectedRegion:r,dpr:x,bannerFont:U==="phone-landscape"?11:12,isTown:pt.isTown,near:io(et)}):null,[g,P,Y,r,x,U,pt,et]),mt=I.useMemo(()=>P?Ml({markers:ht,projection:P,k:Y,atWar:ft,dpr:x,waterTile:v=>ae().land[v]!==1}):null,[ht,P,Y,ft,x]),je=I.useMemo(()=>{if(!P||Y<Ct)return null;const v=yt({transform:{k:G.k,x:G.x,y:G.y},width:t,height:n,dpr:x,projection:P,raster:H}),b=P.invert(at(v,-t*.5,-n*.5)),T=P.invert(at(v,t*1.5,n*1.5));if(!b||!T)return null;const C=S=>Math.round(S/2)*2;return{west:C(b[0]),east:C(T[0]),north:C(Math.min(90,b[1])),south:C(Math.max(-90,T[1]))}},[P,H,G,Y,t,n,x]),Bo=je?`${je.west},${je.east},${je.south},${je.north}`:"",wt=I.useMemo(()=>P?Sl({state:g,projection:P,k:Y,window:je,isExplored:h.isExplored,lens:c,closeGround:pn,dpr:x}):null,[g,P,Y,Bo,h,c,pn,x]),mn=I.useMemo(()=>P?El({state:g,projection:P,k:Y,dpr:x}):[],[g,P,Y,x]),gt=I.useMemo(()=>P?Tl({state:g,projection:P,k:Y,isVisible:h.isVisible,dpr:x}):null,[g,P,Y,h,x]),vt=I.useMemo(()=>P?Cl({marchLines:B,projection:P,k:Y,selectedArmy:w,dpr:x}):null,[B,P,Y,w,x]),wn=I.useMemo(()=>Hs(M),[M.units,M.nations,M.regions,M.world,M.turnNumber,M.playerNationId]),nt=I.useMemo(()=>P?Ll({model:wn,projection:P,k:Y,dpr:x}):null,[wn,P,Y,x]),Ot=I.useMemo(()=>P?Al({projection:P,k:Y,near:et?io(et):null,dpr:x}):null,[P,Y,et,x]),[Go,jo]=I.useState(0);I.useEffect(()=>Xa(()=>{const v=_.current;v&&v.atlas.dropPending()&&jo(b=>b+1)}),[]),I.useEffect(()=>{const v=_.current;if(!v||!tt||!mt||!wt||!gt||!vt||!Ot||!nt)return;const b={terrain:Ot,ground:[...(we==null?void 0:we.sprites)||[],...wt.sprites,...mn],upper:[...vt.sprites,...gt.sprites],top:[...tt.sprites,...tt.names,...mt.sprites,...nt.sprites]},T=()=>{const S={};for(const[L,F]of Object.entries(b)){const D=[];for(const X of F){const j=v.atlas.get(X.art);if(!j)return null;D.push({...X,uv:j})}S[L]=D}return S};let C=T();if(C||(v.atlas.reset(),C=T()),!C){console.warn("map sprites: the atlas is too small for this view");return}v.terrainSprites.set(C.terrain),v.groundSprites.set(C.ground),v.upperSprites.set(C.upper),v.topSprites.set(C.top),v.lowLines.set([...wt.lines,...(we==null?void 0:we.lines)||[]]),v.marchLines.set([...vt.lines,...nt.lines]),v.hits=[...nt.hits,...gt.hits,...tt.hits,...mt.hits],v.request()},[Q,tt,mt,wt,mn,gt,vt,nt,we,Ot,Go]);const[ot,qo]=I.useState(null),Rt=I.useRef(null),gn=Y>=Me*.7;I.useEffect(()=>{if(!gn||ot)return;let v=!1;return es().then(b=>{v||qo(b)}),()=>{v=!0}},[gn,ot]),I.useEffect(()=>{!ot||Rt.current||Fr(ot,An(2048)).then(v=>{Rt.current=v,ie(b=>b+1)})},[ot]),I.useEffect(()=>{const v=_.current;if(!v||!P||Y<Me)return;const b=yt({transform:{k:G.k,x:G.x,y:G.y},width:t,height:n,dpr:x,projection:P,raster:H}),T=t*go,C=n*go,S=-b.worldLeft*b.k+T,L=-b.worldTop*b.k+C,F={fwd:(D,X)=>{const j=P([D,X]);return j?[He(j[0],b.camX,b.worldW),j[1]]:null},inv:(D,X)=>P.invert([He(D,H.x+H.width/2,H.width),X])};v.closeScene.layout({projection:P,proj:F,transform:{x:S,y:L,k:b.k},width:t+2*T,height:n+2*C,state:g,fog:h,towns:pt,markers:ht,ground:Rt.current}),v.closeLayout={k:b.k,tx:S,ty:L,camX:b.camX},v.request()},[G,Y,P,H,t,n,x,g,h,pt,ht,te]);const Vo=(v,b)=>{var D,X;const T=_.current,C=K();if(!T||!C)return null;const S=Dt(C,T.hits,v,b);if((S==null?void 0:S.kind)==="marker")return S.marker.regionId;if((S==null?void 0:S.kind)==="city"||(S==null?void 0:S.kind)==="banner")return S.id;const L=P.invert(at(C,v,b)),F=L?In(L[1],L[0]):null;return F!=null&&F>=0&&((X=(D=g.world)==null?void 0:D.tileOwner)==null?void 0:X[F])||null},Ko=I.useCallback((v,b,T,C)=>{if((b==null?void 0:b.pointerType)==="touch"&&e){const S=Xs(Zs(T,C).map(([L,F])=>Vo(L,F)));if(S.length>1){const L=W.current.getBoundingClientRect();e({x:T+L.left,y:C+L.top,ids:S});return}}a(v===r?null:v)},[e,a,r]),Ho=I.useCallback(v=>{const b=Nt(k.current,v);b&&se(b.lat,b.lng,Math.min(_e,Math.max(J.current.k*2.5,ze)),!0)},[se]),kt=(v,b)=>{var X,j;const T=_.current,C=K();if(!T||!C||!P)return null;const S=Dt(C,T.hits,v,b);if((S==null?void 0:S.kind)==="cluster"||(S==null?void 0:S.kind)==="marker")return{kind:S.kind,marker:S.marker,id:S.marker.regionId};if((S==null?void 0:S.kind)==="indep")return{kind:"indep",id:S.id};if((S==null?void 0:S.kind)==="settler")return{kind:"settler",tile:S.tile};if((S==null?void 0:S.kind)==="city"||(S==null?void 0:S.kind)==="banner")return{kind:"city",id:S.id,via:S.kind};const L=P.invert(at(C,v,b));if(!L)return null;const F=In(L[1],L[0]),D=F!=null&&F>=0?(j=(X=g.world)==null?void 0:X.tileOwner)==null?void 0:j[F]:null;return D&&g.regions[D]?{kind:"city",id:D,via:"land",tile:F}:{kind:"tile",tile:F,land:F!=null&&F>=0&&ae().land[F]===1,explored:F!=null&&F>=0&&h.isExplored(F)}},vn=I.useRef(kt);vn.current=kt;const kn=I.useRef(0),Xo=v=>{var L;if(v.pointerType!=="mouse"||v.buttons||!W.current)return;const b=performance.now();if(b-kn.current<120)return;kn.current=b;const T=W.current.getBoundingClientRect(),C=kt(v.clientX-T.left,v.clientY-T.top),S=(C==null?void 0:C.kind)==="city"&&((L=g.regions[C.id])==null?void 0:L.name)||"";W.current.title!==S&&(W.current.title=S)},Ft=I.useRef(null),Zo=I.useCallback(v=>{Ft.current={x:v.clientX,y:v.clientY}},[]),Yo=v=>{var D,X,j;const b=Ft.current;Ft.current=null;const T=_.current;if(!b||!T||!P||Math.hypot(v.clientX-b.x,v.clientY-b.y)>6||v.target!==V.current)return;const C=W.current.getBoundingClientRect(),S=v.clientX-C.left,L=v.clientY-C.top,F=kt(S,L);if(F){if(F.kind==="cluster"){Ho(F.marker.regionId);return}if(F.kind==="marker"){const $=F.marker;$.kind==="battle"?nr($.id):!$.own&&$.kind==="army"&&$.tile!=null&&u?u($.tile):$.own&&($.kind==="army"||$.kind==="fleet")&&$.tile!=null&&m&&((j=M.regions[(X=(D=M.world)==null?void 0:D.tileOwner)==null?void 0:X[$.tile]])==null?void 0:j.tile)!==$.tile?m($.tile):a==null||a($.regionId);return}if(F.kind==="indep"){or(F.id);return}if(F.kind==="settler"){u==null||u(F.tile);return}if(F.kind==="city"){Ko(F.id,v,S,L);return}if(u){if(F.tile==null||F.tile<0){u(null);return}u(F.tile===f?null:F.tile)}}},Qo=I.useCallback(()=>{const v=K();if(!v||!P)return null;const b=P.scale()*v.k;return{zoom:Ys(.75+v.k*.05,.75,1.5),project:(T,C,S=0)=>{const L=P([C,T]);if(!L)return{x:NaN,y:NaN,visible:!1};const[F,D]=Pn(v,L[0],L[1]);return{x:F,y:D-S*b*.6,visible:!0}}}},[K,P]);I.useEffect(()=>{var v;if(!(!o||typeof window>"u"||window.__E2E_MAP_TEST__!==!0||!P))return window.__map2DTest={get features(){return Qs(g).map(b=>{var T;return{...b,properties:{...b.properties,owner:((T=g.regions[b.properties.gameRegionId])==null?void 0:T.owner)||null}}})},selected:r,focus:(b,T,C)=>se(b,T,C,!1),project:(b,T)=>{const C=P([T,b]),[S,L]=Pn(K(),C[0],C[1]);return{x:S,y:L}},hitAt:(b,T)=>{var S,L;const C=Dt(K(),((S=_.current)==null?void 0:S.hits)||[],b,T);return C?{kind:C.kind,id:C.id??((L=C.marker)==null?void 0:L.regionId)??null}:null},pickAt:(b,T)=>{var S,L;const C=vn.current(b,T);return C?{kind:C.kind,id:C.id??null,tile:C.tile??null,land:C.land??null,explored:C.explored??null,via:C.via??null,marker:((S=C.marker)==null?void 0:S.kind)??null,own:((L=C.marker)==null?void 0:L.own)??null}:null},transform:()=>({...J.current}),setTransform:({x:b,y:T,k:C})=>{le.current&&W.current&&Ve(W.current).call(le.current.transform,Fe.translate(b,T).scale(C))},worldView:()=>$t()},window.__glMap={info:()=>({..._.current.renderer.info.render,frames:_.current.frames,territory:_.current.lastTerritory,raster:_.current.raster.stats(),terrainSprites:_.current.terrainSprites.mesh.geometry.instanceCount}),renderer:(v=_.current)==null?void 0:v.renderer},()=>{delete window.__map2DTest,delete window.__glMap}},[o,P,g,r,se,K,Q,$t]);const _t=G.k;return rt.jsxs("div",{className:"relative w-full h-full",style:{background:po},children:[rt.jsx("div",{ref:W,"data-testid":o?"flat-map":void 0,"data-renderer":"webgl",className:"absolute inset-0",style:{touchAction:"none",cursor:"pointer"},onPointerDown:Zo,onPointerUp:Yo,onPointerMove:Xo,children:rt.jsx("canvas",{ref:V,"data-testid":"gl-map",style:{width:t,height:n,display:"block"}})}),!_l()&&rt.jsx(Js,{effects:R,getProjector:Qo,width:t,height:n,ageId:g.age,testId:"map2d-effects"}),rt.jsx(er,{style:{right:O.right+8},className:o?"top-[calc(var(--header-height,2.25rem)+0.625rem)]":"top-12",onZoomIn:()=>dn(mo),canZoomIn:_t<_e,onZoomOut:()=>dn(1/mo),canZoomOut:_t>ee,onReset:$t,canReset:_t>ee})]})};export{Yl as canRunGLMap,Ql as default};
//# sourceMappingURL=GLMapView-90260715.js.map
