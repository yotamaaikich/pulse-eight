const {app,BrowserWindow,Menu,session,ipcMain,shell,powerSaveBlocker}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {APP_URL,trustedGame,bundledPath,externalURL,oauthURL,authCallback}=require('./security.cjs');
const {DiscordPresence}=require('./discord.cjs');
const {forwardingOptions}=require('./network.cjs');
const root=path.resolve(__dirname,'..'),preload=path.join(__dirname,'preload.cjs');
let mainWindow,settingsWindow,rpc,saveTimer,awake=null,pendingAuth=null;
const smoke=process.argv.includes('--smoke-test');let smokeTimer;
if(smoke){const smokeData=path.join(app.getPath('temp'),'piano-pulse-smoke-'+process.pid);fs.mkdirSync(smokeData,{recursive:true});app.setPath('userData',smokeData);smokeTimer=setTimeout(()=>{console.error('PIANO PULSE renderer startup timed out');app.exit(1);},20000);}
app.setName('PIANO PULSE');app.setAppUserModelId('io.github.yotamaaikich.pianopulse');
if(!app.requestSingleInstanceLock()){app.quit();process.exit(0);}
const settingsPath=()=>path.join(app.getPath('userData'),'desktop-settings.json');
let prefs={discordEnabled:true,width:1400,height:960};
try{const stored=JSON.parse(fs.readFileSync(settingsPath(),'utf8'));prefs={...prefs,discordEnabled:stored.discordEnabled!==false,width:Math.max(1000,Math.min(3840,Number(stored.width)||1400)),height:Math.max(680,Math.min(2160,Number(stored.height)||960))};}catch{}
function save(){try{fs.mkdirSync(path.dirname(settingsPath()),{recursive:true});fs.writeFileSync(settingsPath(),JSON.stringify(prefs));}catch{}}
function senderOK(event,allowSettings=false){return event.senderFrame===event.sender.mainFrame&&(event.sender===mainWindow?.webContents&&trustedGame(event.senderFrame.url)||allowSettings&&event.sender===settingsWindow?.webContents&&event.senderFrame.url===new URL('desktop/settings.html',APP_URL).href);}
function status(){return {version:app.getVersion(),discord:rpc.status()};}
function publishStatus(){for(const win of [mainWindow,settingsWindow])if(win&&!win.isDestroyed())win.webContents.send('pulse:status',status());}
function receivedAuth(raw){const callback=authCallback(raw);if(!callback)return;pendingAuth=callback;if(mainWindow&&!mainWindow.isDestroyed()){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();if(!mainWindow.webContents.isLoading()){mainWindow.webContents.send('pulse:auth-callback',pendingAuth);pendingAuth=null;}}}
app.on('second-instance',(_event,argv)=>{const raw=argv.find(arg=>arg.startsWith('pianopulse:'));if(raw)receivedAuth(raw);else if(mainWindow){if(mainWindow.isMinimized())mainWindow.restore();mainWindow.show();mainWindow.focus();}});
app.on('open-url',(event,url)=>{event.preventDefault();receivedAuth(url);});
function secureWindow(win){
  win.webContents.setWindowOpenHandler(({url})=>{const allowed=externalURL(url);if(allowed)shell.openExternal(allowed).catch(()=>{});return {action:'deny'};});
  win.webContents.on('will-navigate',(event,url)=>{if(win===mainWindow&&trustedGame(url))return;if(win===settingsWindow&&url===new URL('desktop/settings.html',APP_URL).href)return;event.preventDefault();const allowed=externalURL(url);if(allowed)shell.openExternal(allowed).catch(()=>{});});
  win.webContents.on('will-attach-webview',event=>event.preventDefault());
}
function openSettings(){if(settingsWindow&&!settingsWindow.isDestroyed()){settingsWindow.focus();return;}settingsWindow=new BrowserWindow({width:520,height:380,resizable:false,parent:mainWindow,backgroundColor:'#0c0e12',title:'PIANO PULSE · アプリ設定',autoHideMenuBar:true,webPreferences:{preload,partition:'persist:piano-pulse',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});secureWindow(settingsWindow);settingsWindow.loadURL(new URL('desktop/settings.html',APP_URL).href);settingsWindow.on('closed',()=>{settingsWindow=null;});}
app.whenReady().then(async()=>{
  const ses=session.fromPartition('persist:piano-pulse');
  const types={'.html':'text/html; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.mp3':'audio/mpeg','.txt':'text/plain; charset=utf-8'};
  // Bundled game assets retain the published app origin, including YouTube's
  // required Referer identity. Other HTTPS requests use normal Chromium TLS.
  ses.protocol.handle('https',async request=>{const file=bundledPath(request.url,root);if(file===null)return ses.fetch(request,forwardingOptions(request));if(!file||request.method!=='GET')return new Response('Not found',{status:404});try{return new Response(await fs.promises.readFile(file),{headers:{'Content-Type':types[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'}});}catch{return new Response('Not found',{status:404});}});
  ses.setPermissionRequestHandler((_contents,permission,callback)=>callback(permission==='fullscreen'));
  ses.setPermissionCheckHandler((_contents,permission)=>permission==='fullscreen');
  const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'catalog.json'),'utf8'));
  const config=JSON.parse(fs.readFileSync(path.join(__dirname,'discord-config.json'),'utf8'));
  rpc=new DiscordPresence({applicationId:config.applicationId,catalog,onStatus:publishStatus});rpc.enabled=smoke?false:prefs.discordEnabled;
  mainWindow=new BrowserWindow({width:prefs.width,height:prefs.height,minWidth:880,minHeight:620,show:false,backgroundColor:'#0c0e12',title:'PIANO PULSE',icon:path.join(__dirname,'assets','icon.ico'),autoHideMenuBar:true,webPreferences:{preload,partition:'persist:piano-pulse',nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false}});
  secureWindow(mainWindow);
  Menu.setApplicationMenu(Menu.buildFromTemplate([{label:'ゲーム',submenu:[{label:'アプリ設定',click:openSettings},{type:'separator'},{label:'終了',role:'quit'}]},{label:'表示',submenu:[{role:'reload',label:'再読み込み'},{role:'resetZoom',label:'標準サイズ'},{role:'zoomIn',label:'拡大'},{role:'zoomOut',label:'縮小'}]}]));
  mainWindow.once('ready-to-show',()=>{if(!smoke)mainWindow.show();});
  mainWindow.webContents.on('did-finish-load',()=>{publishStatus();if(pendingAuth){mainWindow.webContents.send('pulse:auth-callback',pendingAuth);pendingAuth=null;}});
  mainWindow.on('resize',()=>{clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!mainWindow.isDestroyed()&&!mainWindow.isFullScreen()&&!mainWindow.isMaximized()){const size=mainWindow.getSize();prefs.width=size[0];prefs.height=size[1];save();}},400);});
  mainWindow.on('closed',()=>{settingsWindow?.close();rpc.stop();app.quit();});
  ipcMain.on('pulse:presence',(event,state)=>{if(!senderOK(event)||!state||typeof state!=='object')return;if(smoke){clearTimeout(smokeTimer);console.log(JSON.stringify({startup:'passed',phase:state.phase,song:state.songId,version:app.getVersion()}));app.exit(0);return;}rpc.update(state);if(state.phase==='running'&&awake===null)awake=powerSaveBlocker.start('prevent-display-sleep');else if(state.phase!=='running'&&awake!==null){powerSaveBlocker.stop(awake);awake=null;}});
  ipcMain.handle('pulse:settings',event=>{if(senderOK(event))openSettings();});
  ipcMain.handle('pulse:status',event=>senderOK(event,true)?status():null);
  ipcMain.handle('pulse:discord',(event,enabled)=>{if(!senderOK(event,true))return;prefs.discordEnabled=enabled===true;save();rpc.setEnabled(prefs.discordEnabled);return status();});
  ipcMain.handle('pulse:google',async(event,url)=>{if(!senderOK(event)||typeof url!=='string')throw Error('ログインを開始できません。');const allowed=oauthURL(url);if(!allowed)throw Error('ログイン先を確認できません。');await shell.openExternal(allowed);return true;});
  if(!smoke&&!app.isDefaultProtocolClient('pianopulse'))app.setAsDefaultProtocolClient('pianopulse');
  const initial=process.argv.find(arg=>arg.startsWith('pianopulse:'));if(initial)pendingAuth=authCallback(initial);
  await mainWindow.loadURL(APP_URL);rpc.start();
});
app.on('before-quit',()=>{clearTimeout(saveTimer);rpc?.stop();if(awake!==null)powerSaveBlocker.stop(awake);save();});
app.on('window-all-closed',()=>app.quit());
