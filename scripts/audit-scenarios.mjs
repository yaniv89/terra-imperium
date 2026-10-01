import {buildSimEngine,advanceCampaign} from './simulate.mjs';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import {isDeepStrictEqual} from 'node:util';
const file=await buildSimEngine();const e=await import(pathToFileURL(file).href);fs.rmSync(file);
const count=process.argv.includes('--long')?150:10;
const results=[];
const option=name=>process.argv.find(a=>a.startsWith(name+'='))?.split('=')[1];
const seeds=option('--seed')?[Number(option('--seed'))]:[7,4242,2026];
const modes=option('--mode')?[option('--mode')==='full'?'full':Number(option('--mode'))]:['full',15,30,45,60,75];
for(const seed of seeds)for(const mode of modes){
 let s=e.createInitialState({playerNationId:'fr',rngSeed:seed,scenario:mode==='full'?{mode:'full'}:{mode:'emergent',nationCount:mode,seed}});
 s={...s,firedEvents:Object.fromEntries(Object.keys(e.HISTORICAL_EVENTS).map(id=>[id,true])),proceduralEventCooldown:999999,battleSettings:{defaultMode:'ask',autoDefend:true}};
 const times=[],first=s.turnNumber;let changes=0,shortages=0,idle=0;
 for(let i=0;i<count&&s.gameStatus==='ACTIVE';i++){
  if(mode!=='full'){
   const target=Object.values(s.regions).filter(r=>r.owner==='fr').flatMap(r=>e.getNeighborIds(r.id)).find(id=>s.regions[id]?.owner===null);
   if(target)s=e.gameReducer(s,{type:e.ActionTypes.FRONTIER_EXPEDITION,payload:{targetRegionId:target}});
  }
  const before=s,start=performance.now();s=advanceCampaign(e,s);times.push(performance.now()-start);
  changes+=Object.values(s.regions).filter(r=>before.regions[r.id]?.owner!==r.owner).length;
  shortages+=Object.values(s.nations).filter(n=>n.isAtWar&&(n.economy?.supplies || 0)<=0).length;
  idle+=Object.values(s.units).filter(u=>s.nations[u.ownerId]?.isAtWar&&u.movesLeft>0).length;
  if(i%10===9){
   const loaded=e.migrateSave({version:e.CURRENT_SAVE_VERSION,state:JSON.parse(JSON.stringify(s))}).state;
   e.assertGameState(loaded);
   const a=advanceCampaign(e,s),b=advanceCampaign(e,loaded);
   if(!isDeepStrictEqual(JSON.parse(JSON.stringify(a)),JSON.parse(JSON.stringify(b)))){const diff=(x,y,p='')=>{if(isDeepStrictEqual(x,y))return [];if(x&&y&&typeof x==='object'&&typeof y==='object')return [...new Set([...Object.keys(x),...Object.keys(y)])].flatMap(k=>diff(x[k],y[k],p+'.'+k)).slice(0,10);return [{path:p,a:x,b:y}];};fs.writeFileSync('../failure-snapshot.json',JSON.stringify(s));console.log('Before reload',diff(JSON.parse(JSON.stringify(s)),JSON.parse(JSON.stringify(loaded))));console.log('Next turn',diff(a,b));throw new Error('Reload divergence: '+mode+'/'+seed+'/'+i);}
   s=loaded;
  }
 }
 times.sort((a,b)=>a-b);const result={mode,seed,completedTurns:s.turnNumber-first,status:s.gameStatus,ownershipChanges:changes,shortageNationTurns:shortages,idleArmyTurns:idle,p50:times[Math.floor((times.length-1)*.5)],p95:times[Math.floor((times.length-1)*.95)]};
 results.push(result);console.log(JSON.stringify(result));
}
console.log('Audited scenarios complete: '+results.length);
