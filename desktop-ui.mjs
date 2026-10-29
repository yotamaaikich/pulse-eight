export function initDesktop({bridge,button,snapshot,timer=setInterval}){
  if(!bridge?.desktop)return()=>{};
  button.hidden=false;button.onclick=()=>bridge.openSettings();
  let last='';const update=()=>{const value=snapshot(),key=[value.songId,value.difficulty,value.phase,Math.floor(value.position/15)].join(':');if(key!==last){last=key;bridge.updatePresence(value);}};
  update();const interval=timer(update,1000);return()=>clearInterval(interval);
}
