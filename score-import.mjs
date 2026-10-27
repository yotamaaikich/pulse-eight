// Device-only import. Never evaluates score text or transmits it to the server.
export function validatePianoProfile(raw){
  if(!raw||!Array.isArray(raw.voices)||!raw.voices.length||raw.voices.length>16)throw Error('声部のある音程データを指定してください。');
  let count=0;
  const voices=raw.voices.map(voice=>{
    if(!Array.isArray(voice))throw Error('音符データが正しくありません。');
    return voice.map(n=>{if(!Array.isArray(n)||n.length<3||!n.slice(0,3).every(Number.isFinite)||n[0]<0||n[1]<=n[0]||n[1]>600000||!Number.isInteger(n[2])||n[2]<0||n[2]>127||++count>20000)throw Error('音程・時刻の範囲が正しくありません。');return [Math.round(n[0]),Math.round(n[1]),n[2],Number.isFinite(n[3])?Math.max(0,Math.min(15,n[3])):12];}).sort((a,b)=>a[0]-b[0]);
  });
  if(!count)throw Error('譜面に音符がありません。');
  return {title:String(raw.title||'読み込んだ譜面').slice(0,100),offsetMs:Math.max(-10000,Math.min(10000,Math.round(Number(raw.offsetMs)||0))),voices};
}
function parseVoice(source){
  let cursor=0,time=0,octave=4,length=4,dots=0,velocity=8,tempo=120,tie=false;const notes=[];
  function number(){const match=/^\d+/.exec(source.slice(cursor));if(!match)return null;cursor+=match[0].length;return Number(match[0]);}
  function dotCount(){let count=0;while(source[cursor]==='.'){cursor++;count++;}if(count>4)throw Error('音価の付点が多すぎます。');return count;}
  while(cursor<source.length){
    const token=source[cursor++].toLowerCase();if(/\s/.test(token))continue;
    if(token==='<'||token==='>'){octave+=token==='>'?1:-1;continue;}if(token==='&'){tie=true;continue;}
    if('tolv'.includes(token)){
      const value=number(),d=dotCount();if(value===null)throw Error('MMLコマンドの数値がありません。');
      if(token==='t'){if(value<20||value>500)throw Error('MMLテンポが範囲外です。');tempo=value;}
      if(token==='o'){if(value<0||value>8)throw Error('MMLオクターブが範囲外です。');octave=value;}
      if(token==='l'){if(value<1||value>128)throw Error('MML音価が範囲外です。');length=value;dots=d;}
      if(token==='v')velocity=Math.max(0,Math.min(15,value));continue;
    }
    if(!'abcdefgnr'.includes(token))throw Error('未対応のMML記号があります：'+token);
    let accidental=0;if('abcdefg'.includes(token)&&'+-#'.includes(source[cursor]||'!'))accidental=source[cursor++]==='-'?-1:1;
    const value=number(),d=dotCount(),den=token==='n'?length:(value||length),dot=token==='n'?dots:(value!==null||d?d:dots);
    if(den<1||den>128)throw Error('MML音価が範囲外です。');
    const duration=4/den*(2-2**(-dot))*60/tempo*1000;
    const midi=token==='r'?null:token==='n'?value:(octave+1)*12+({c:0,d:2,e:4,f:5,g:7,a:9,b:11}[token])+accidental;
    if(midi!==null&&velocity){
      const previous=notes.at(-1);
      if(tie&&previous&&previous[2]===midi&&Math.abs(previous[1]-time)<.001)previous[1]=time+duration;
      else notes.push([time,time+duration,midi,velocity]);
    }
    tie=false;time+=duration;if(time>600000||notes.length>20000)throw Error('MML譜面が長すぎます。');
  }
  return {notes,duration:time};
}
export function importPianoScore(text,name='譜面'){
  if(typeof text!=='string'||text.length>500000)throw Error('譜面ファイルが大きすぎます。');
  let input=text.trim();if(input.charCodeAt(0)===0xfeff)input=input.slice(1);
  if(input.startsWith('{'))return validatePianoProfile(JSON.parse(input));
  const scrolls=input.startsWith('[')?JSON.parse(input):(input.match(/MML@[^;]+;/gi)||[]);
  if(!Array.isArray(scrolls)||!scrolls.length||scrolls.length>32)throw Error('MMLまたは音程JSONファイルを選んでください。');
  const voices=[],cursors=[];
  for(const scroll of scrolls){
    if(typeof scroll!=='string'||!/^MML@/i.test(scroll)||!scroll.endsWith(';'))throw Error('MML譜面の形式が正しくありません。');
    const streams=scroll.slice(4,-1).split(',');if(streams.length>16)throw Error('声部が多すぎます。');
    for(let i=0;i<streams.length;i++){
      const parsed=parseVoice(streams[i]),offset=cursors[i]||0;voices[i]??=[];
      voices[i].push(...parsed.notes.map(n=>[n[0]+offset,n[1]+offset,n[2],n[3]]));cursors[i]=offset+parsed.duration;
    }
  }
  return validatePianoProfile({title:name,voices,offsetMs:0});
}
