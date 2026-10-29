import {ApiError} from './service.mjs';
// Verify with Auth, rather than decoding a client-supplied JWT or user ID.
export async function verifiedActor(header,{baseUrl,clientKey,fetcher=fetch}){
  if(!header)return null;
  if(!/^Bearer [A-Za-z0-9._~-]{20,8000}$/.test(header))throw new ApiError('ログイン情報を確認できませんでした。',401);
  let response;try{response=await fetcher(baseUrl+'/auth/v1/user',{headers:{apikey:clientKey,Authorization:header},signal:AbortSignal.timeout(8000)});}catch{throw new ApiError('ログインの確認先に接続できませんでした。',503);}
  if(!response.ok)throw new ApiError('ログインの有効期限が切れています。ログインし直してください。',401);
  const user=await response.json();if(!/^[a-f0-9-]{36}$/i.test(user.id??''))throw new ApiError('ログイン情報を確認できませんでした。',401);
  return {id:user.id};
}
