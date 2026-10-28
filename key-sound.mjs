// Piano on physical note heads; a separate chime on FLOAT completion.
// Missing pitch data uses a short recorded hammer attack, never an invented tune.
export function keySoundRequests(notifications,float=false){
 const requests=[];
 for(const event of notifications){
  const n=event.note;if(!n||n.assist||event.result==='miss')continue;
  const attack=float?event.kind==='judge'&&n.flick:
   event.kind==='holdstart'||event.kind==='flickstart'||event.kind==='judge'&&!n.end&&!n.flick;
  if(!attack)continue;
  const pitched=Number.isFinite(n.soundMidi);
  requests.push({midi:pitched?n.soundMidi:62,hold:n.end?n.end-n.t:0,float,percussive:!pitched&&!float});
 }
 return requests;
}
