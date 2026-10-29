const bridge=window.pianoPulse,checkbox=document.getElementById('discord');
function render(value){if(!value)return;checkbox.checked=value.discord.enabled;document.getElementById('status').textContent=!value.discord.enabled?'プレイ表示 OFF':value.discord.connected?'Discordに接続済み':'Discordの起動を待っています';document.getElementById('version').textContent='PIANO PULSE '+value.version;}
bridge.getStatus().then(render);bridge.onStatus(render);checkbox.addEventListener('change',async()=>{checkbox.disabled=true;try{render(await bridge.setDiscordEnabled(checkbox.checked));}finally{checkbox.disabled=false;}});
