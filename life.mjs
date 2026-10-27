export const MAX_LIFE=1000;
// Visual endurance gauge; score and replay rules are independent.
export function nextLife(life,event){
  let delta=0;
  if(event.kind==='judge')delta=({perfect:3,great:1,good:-10,bad:-40,miss:-80})[event.result]??0;
  else if(event.kind==='airbreak')delta=-40;
  return Math.max(0,Math.min(MAX_LIFE,life+delta));
}
