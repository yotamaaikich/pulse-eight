import {ApiError} from './service.mjs';
export async function readJson(request,{limit=512000,timeoutMs=8000}={}){
  if(!/^application\/json(?:;|$)/i.test(request.headers.get('content-type')??''))throw new ApiError('JSON形式で送信してください。',415);
  if(Number(request.headers.get('content-length'))>limit)throw new ApiError('プレイデータが大きすぎます。',413);
  if(!request.body)throw new ApiError('データを読み取れませんでした。');
  const reader=request.body.getReader(),chunks=[];let length=0,timer;
  const timeout=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new ApiError('送信がタイムアウトしました。',408)),timeoutMs);});
  try{
    while(true){const {done,value}=await Promise.race([reader.read(),timeout]);if(done)break;length+=value.byteLength;if(length>limit)throw new ApiError('プレイデータが大きすぎます。',413);chunks.push(value);}
    const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    let data;try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new ApiError('データを読み取れませんでした。');}
    if(!data||typeof data!=='object'||Array.isArray(data))throw new ApiError('データが正しくありません。');return data;
  }catch(error){reader.cancel().catch(()=>{});throw error;}finally{clearTimeout(timer);}
}
export function requestAddress(headers){
  // Address hints are supplementary. The database also enforces a shared cap,
  // so changing a guest token or a forwarded-address header cannot remove it.
  const address=(headers.get('x-forwarded-for')??'').split(',').at(-1)?.trim()||headers.get('x-real-ip')||'unknown';
  return /^[a-fA-F0-9:.]{3,64}$/.test(address)?address:'unknown';
}
export async function consumeBudget(db,category,key){
  const allowed=await db('rpc/pulse_keys_consume_budget','POST',{p_category:category,p_key:key});
  if(allowed!==true)throw new ApiError('アクセスが続いています。1分ほど待ってから再度お試しください。',429);
}
