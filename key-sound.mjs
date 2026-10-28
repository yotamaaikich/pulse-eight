// Piano on physical note heads; a separate chime on FLOAT completion.
// Every library head has a source-derived piano pitch. No noise/strike substitute.
export function keySoundRequests(notifications,float=false){
 const requests=[];
 for(const event of notifications){
  const n=event.note;if(!n||n.assist||event.result==='miss')continue;
  const attack=float?event.kind==='judge'&&n.flick:
   event.kind==='holdstart'||event.kind==='flickstart'||event.kind==='judge'&&!n.end&&!n.flick;
  if(!attack)continue;
  if(!Number.isFinite(n.soundMidi))continue;
  requests.push({midi:n.soundMidi,hold:n.end?n.end-n.t:0,float,velocity:n.soundVelocity??1});
 }
 return requests;
}
