import {test,expect} from '@playwright/test';
const interior = feature => {
  const groups=feature.geometry.type==='MultiPolygon'?feature.geometry.coordinates:[feature.geometry.coordinates];
  const rings=groups.reduce((a,b)=>b[0].length>a[0].length?b:a,groups[0]);
  const outer=rings[0];
  const insideRing=(x,y,r)=>{let hit=false;for(let i=0,j=r.length-1;i<r.length;j=i++){const a=r[i],b=r[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  const xs=outer.map(p=>p[0]),ys=outer.map(p=>p[1]);
  const loX=Math.min(...xs),hiX=Math.max(...xs),loY=Math.min(...ys),hiY=Math.max(...ys);
  let best=null,clearance=-1;
  for(let k=0;k<20;k++)for(let i=0;i<20;i++){
    const x=loX+(hiX-loX)*(i+.5)/20,y=loY+(hiY-loY)*(k+.5)/20;
    if(insideRing(x,y,outer)&&!rings.slice(1).some(r=>insideRing(x,y,r))){
      const distance=Math.min(...outer.slice(1).map((b,j)=>{const a=outer[j],dx=b[0]-a[0],dy=b[1]-a[1];const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy || 1)));return Math.hypot(x-a[0]-t*dx,y-a[1]-t*dy);}));
      if(distance>clearance){clearance=distance;best={lat:y,lng:x};}
    }
  }
  if(best)return best;
  throw new Error('No interior sample found');
};
test('actual globe pointer hits preserve selected province at two zoom levels',async({page})=>{
  test.setTimeout(240000);
  await page.addInitScript(()=>{window.__E2E_DISABLE_GLOBE_AUTOROTATE__=true;window.__E2E_MAP_TEST__=true;});
  await page.goto('/');
  await page.getByPlaceholder('Search 240 nations...').fill('Israel');
  await page.getByRole('button',{name:'Israel',exact:true}).dispatchEvent('click');
  await page.getByRole('button',{name:'Begin as Israel'}).dispatchEvent('click');
  await page.getByRole('button',{name:'Skip',exact:true}).click();
  await page.waitForFunction(()=>window.__mapTest?.features?.length>0,{timeout:90000});
  const sample=await page.evaluate(()=>window.__mapTest.features.filter(f=>f.properties.owner==='il').slice(0,3));
  expect(sample.length).toBeGreaterThan(0);
  for(const feature of sample){
    const point=interior(feature),id=feature.properties.gameRegionId;
    for(const zoom of [.25,.65]){
      await page.evaluate(({point,zoom})=>window.__mapTest.focus(point.lat,point.lng,zoom),{point,zoom});
      await page.waitForTimeout(1000);
      const p=await page.evaluate(point=>window.__mapTest.project(point.lat,point.lng),point);
      const canvas=page.locator('canvas').first();const bounds=await canvas.boundingBox();
      await page.mouse.click(bounds.x+p.x,bounds.y+p.y);
      await expect.poll(()=>page.evaluate(()=>({selected:window.__mapTest.selected,last:window.__mapLastClick})),{timeout:15000}).toMatchObject({selected:id});
      // Selection reframes the camera; close the panel before projecting the next point.
      await page.getByRole('button',{name:'Close',exact:true}).click();
      await expect.poll(()=>page.evaluate(()=>window.__mapTest.selected)).toBeNull();

    }
  }
});
test('2D province fills select their own region at two zoom levels',async({page})=>{
  test.setTimeout(180000);
  await page.addInitScript(()=>{window.__E2E_DISABLE_GLOBE_AUTOROTATE__=true;window.__E2E_MAP_TEST__=true;});
  await page.goto('/');
  await page.getByPlaceholder('Search 240 nations...').fill('Israel');
  await page.getByRole('button',{name:'Israel',exact:true}).dispatchEvent('click');
  await page.getByRole('button',{name:'Begin as Israel'}).dispatchEvent('click');
  await page.getByRole('button',{name:'Skip',exact:true}).click();
  await page.getByTitle('Flat map view').click();
  await page.waitForFunction(()=>window.__map2DTest?.features?.length>0);
  const features=await page.evaluate(()=>window.__map2DTest.features.filter(f=>f.properties.owner==='il').slice(0,3));
  for(const feature of features)for(const zoom of [10,30]){
    const point=interior(feature),id=feature.properties.gameRegionId;
    await page.evaluate(({point,zoom})=>window.__map2DTest.focus(point.lat,point.lng,zoom),{point,zoom});
    await page.waitForTimeout(100);
    const p=await page.evaluate(point=>window.__map2DTest.project(point.lat,point.lng),point);
    const bounds=await page.getByTestId('flat-map').boundingBox();
    await page.mouse.click(bounds.x+p.x,bounds.y+p.y);
    await expect.poll(()=>page.evaluate(()=>window.__map2DTest.selected)).toBe(id);
    await page.getByRole('button',{name:'Close',exact:true}).click();
    await expect.poll(()=>page.evaluate(()=>window.__map2DTest.selected)).toBeNull();
  }
});
