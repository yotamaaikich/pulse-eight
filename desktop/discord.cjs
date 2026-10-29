const net=require('node:net'),crypto=require('node:crypto'),path=require('node:path'),os=require('node:os');
function packet(op,data){const body=Buffer.from(JSON.stringify(data)),head=Buffer.alloc(8);head.writeUInt32LE(op);head.writeUInt32LE(body.length,4);return Buffer.concat([head,body]);}
function createActivity(state,catalog,now=Date.now()){
  const song=catalog.find(s=>s.id===state?.songId),difficulty=['EASY','NORMAL','HARD'][state?.difficulty];
  const phase=state?.phase;
  if(!song||!difficulty||!['idle','loading','countdown','running','buffering','paused','results'].includes(phase))return {type:0,details:'曲を選んでいます',state:'8キーのピアノ・リズムゲーム'};
  const labels={idle:'選曲中',loading:'動画を準備中',countdown:'スタート準備中',running:'プレイ中',buffering:'読み込み待ち',paused:'一時停止',results:'リザルト'};
  const activity={type:0,details:[...song.title].slice(0,100).join(''),state:difficulty+' · '+labels[phase],assets:{large_image:'piano_pulse',large_text:'PIANO PULSE'},buttons:[{label:'PIANO PULSEをダウンロード',url:'https://github.com/yotamaaikich/pulse-eight/releases/latest'}]};
  if(phase==='running'&&Number.isFinite(state.position)){const position=Math.max(0,Math.min(song.duration,state.position));activity.timestamps={start:Math.floor(now/1000-position),end:Math.floor(now/1000+song.duration-position)};}
  return activity;
}
class DiscordPresence{
  constructor({applicationId,catalog,onStatus=()=>{},paths,interval=4200}){Object.assign(this,{applicationId,catalog,onStatus,interval});this.paths=paths??Array.from({length:10},(_,i)=>process.platform==='win32'?'\\\\?\\pipe\\discord-ipc-'+i:path.join(process.env.XDG_RUNTIME_DIR||process.env.TMPDIR||os.tmpdir(),'discord-ipc-'+i));this.enabled=true;this.connected=false;this.socket=null;this.latest=null;this.lastSent=0;this.timer=null;this.retry=null;this.stopped=false;}
  status(){return {enabled:this.enabled,connected:this.connected,registered:/^\d{17,20}$/.test(this.applicationId||'')};}
  emit(){this.onStatus(this.status());}
  start(){this.stopped=false;this.connect(0);}
  connect(index){
    if(this.stopped||!this.enabled||this.socket||!this.status().registered)return this.emit();
    if(index>=this.paths.length){this.emit();this.retry=setTimeout(()=>this.connect(0),10000);this.retry.unref?.();return;}
    const socket=net.createConnection(this.paths[index]);this.socket=socket;let ready=false,data=Buffer.alloc(0),closed=false;
    const fail=()=>{if(closed)return;closed=true;if(this.socket===socket)this.socket=null;this.connected=false;socket.destroy();this.emit();if(!this.stopped&&this.enabled){if(!ready)this.connect(index+1);else{this.retry=setTimeout(()=>this.connect(0),10000);this.retry.unref?.();}}};
    socket.setTimeout(4000);socket.once('connect',()=>socket.write(packet(0,{v:1,client_id:this.applicationId})));
    socket.on('timeout',()=>{if(!ready)fail();});socket.on('error',fail);socket.on('close',fail);
    socket.on('data',chunk=>{data=Buffer.concat([data,chunk]);if(data.length>1048576)return fail();while(data.length>=8){const op=data.readUInt32LE(0),length=data.readUInt32LE(4);if(length>65536)return fail();if(data.length<8+length)return;const body=data.subarray(8,8+length);data=data.subarray(8+length);let value;try{value=JSON.parse(body.toString());}catch{return fail();}if(op===3){socket.write(packet(4,value));continue;}if(op===2)return fail();if(op!==1)continue;if(value.evt==='READY'){ready=true;socket.setTimeout(0);this.connected=true;this.lastSent=0;this.emit();this.flush();}else if(value.evt==='ERROR')return fail();}});
  }
  update(state){this.latest=createActivity(state,this.catalog);this.flush();}
  flush(){if(!this.connected||!this.socket||!this.enabled||!this.latest)return;const delay=this.interval-(Date.now()-this.lastSent);if(delay>0){if(!this.timer){this.timer=setTimeout(()=>{this.timer=null;this.flush();},delay);this.timer.unref?.();}return;}this.lastSent=Date.now();this.socket.write(packet(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:this.latest},nonce:crypto.randomUUID()}));}
  setEnabled(on){this.enabled=on===true;if(!this.enabled){this.stop();this.stopped=false;this.emit();}else this.start();}
  stop(){this.stopped=true;clearTimeout(this.timer);clearTimeout(this.retry);this.timer=null;this.retry=null;const socket=this.socket;this.socket=null;if(socket){if(this.connected)socket.end(packet(1,{cmd:'SET_ACTIVITY',args:{pid:process.pid,activity:null},nonce:crypto.randomUUID()}));else socket.destroy();}this.connected=false;this.emit();}
}
module.exports={DiscordPresence,createActivity,packet};
