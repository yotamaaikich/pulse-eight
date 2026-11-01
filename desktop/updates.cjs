const RELEASE_API='https://api.github.com/repos/yotamaaikich/pulse-eight/releases/latest';
const RELEASE_BASE='https://github.com/yotamaaikich/pulse-eight/releases/tag/';
function versionParts(value){if(typeof value!=='string'||!/^v?(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})\.(0|[1-9]\d{0,5})$/.test(value))return null;return value.replace(/^v/,'').split('.').map(Number);}
function newerVersion(remote,current){const a=versionParts(remote),b=versionParts(current);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
async function latestUpdate(current,{fetcher=fetch,timeoutMs=3000}={}){
  const started=Date.now();let fetchTimer;
  try{
    const response=await Promise.race([fetcher(RELEASE_API,{headers:{Accept:'application/vnd.github+json','User-Agent':'PIANO-PULSE/'+current},redirect:'error',signal:AbortSignal.timeout(timeoutMs)}),new Promise((_,reject)=>{fetchTimer=setTimeout(()=>reject(Error('Update check timed out')),timeoutMs);})]);clearTimeout(fetchTimer);
    if(!response.ok||!response.body)return null;
    const reader=response.body.getReader(),chunks=[];let size=0,timer;
    const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Update check timed out')),Math.max(1,timeoutMs-(Date.now()-started)));});
    try{
      while(true){const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;size+=value.byteLength;if(size>128000)throw Error('Release metadata too large');chunks.push(value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
      const data=JSON.parse(new TextDecoder().decode(bytes));
      if(data.draft!==false||data.prerelease!==false||!/^v\d+\.\d+\.\d+$/.test(data.tag_name??'')||!newerVersion(data.tag_name,current))return null;
      const url=RELEASE_BASE+data.tag_name;if(data.html_url!==url)return null;
      return {version:data.tag_name.slice(1),url};
    }catch(error){reader.cancel().catch(()=>{});throw error;}finally{clearTimeout(timer);}
  }catch{return null;}finally{clearTimeout(fetchTimer);}
}
async function notifyUpdate({current,showMessageBox,openExternal,fetcher,timeoutMs,canPrompt=()=>true}){
  const update=await latestUpdate(current,{fetcher,timeoutMs});if(!update||!canPrompt())return true;
  let response;try{({response}=await showMessageBox({type:'info',title:'PIANO PULSE',message:'最新版があります',detail:'現在のバージョン: '+current+'\n最新のバージョン: '+update.version+'\n\n公式のダウンロードページを開きますか？',buttons:['ダウンロードページを開く','このまま起動'],defaultId:0,cancelId:1,noLink:true}));}catch{return true;}
  if(response!==0)return true;
  try{await openExternal(update.url);return false;}catch{return true;}
}
module.exports={latestUpdate,newerVersion,notifyUpdate,RELEASE_API};
