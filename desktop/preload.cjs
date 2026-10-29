const {contextBridge,ipcRenderer}=require('electron');
const listen=(channel,callback)=>{if(typeof callback!=='function')return()=>{};const handler=(_event,value)=>callback(value);ipcRenderer.on(channel,handler);return()=>ipcRenderer.removeListener(channel,handler);};
let authCallback=null,pendingAuth=null;
ipcRenderer.on('pulse:auth-callback',(_event,value)=>{if(authCallback)authCallback(value);else pendingAuth=value;});
contextBridge.exposeInMainWorld('pianoPulse',Object.freeze({
  desktop:true,
  updatePresence:state=>ipcRenderer.send('pulse:presence',state),
  openSettings:()=>ipcRenderer.invoke('pulse:settings'),
  getStatus:()=>ipcRenderer.invoke('pulse:status'),
  setDiscordEnabled:enabled=>ipcRenderer.invoke('pulse:discord',enabled===true),
  onStatus:callback=>listen('pulse:status',callback),
  beginGoogleSignIn:url=>ipcRenderer.invoke('pulse:google',url),
  onAuthCallback:callback=>{if(typeof callback!=='function')return()=>{};authCallback=callback;if(pendingAuth){const value=pendingAuth;pendingAuth=null;callback(value);}return()=>{authCallback=null;};}
}));
