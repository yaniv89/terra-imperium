import { ActionTypes } from '../data/types';
export const applyActionPolitics = (previous,next,action) => {
  if(previous===next)return next;
  const id=next.playerNationId,n=next.nations[id];
  let estate=null,amount=0,message='';
  if(action.type===ActionTypes.SET_TAX_RATE && previous.nations[id].taxRate!==n.taxRate){
    estate='burghers';amount=['high','extortionate'].includes(n.taxRate)?-5:n.taxRate==='low'?3:0;
    message=`Tax changes affect merchant loyalty (${amount>0?'+':''}${amount}). Lower taxes or grant an estate concession to recover support.`;
  }
  if(action.type===ActionTypes.RECRUIT_UNIT && previous.units!==next.units){
    estate='nobility';amount=-1;message='Raising troops costs 1 nobility loyalty. Keep a reserve or allow loyalty to recover between mobilizations.';
  }
  if(!amount || !n.estates?.[estate])return next;
  return {...next,nations:{...next.nations,[id]:{...n,estates:{...n.estates,[estate]:{...n.estates[estate],loyalty:Math.max(0,Math.min(100,n.estates[estate].loyalty+amount))}}}},logs:[...next.logs,{year:next.year,type:'action',message}]};
};
