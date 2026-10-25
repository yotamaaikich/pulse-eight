// Vocaloid additions selected from Project SEKAI's high-difficulty repertoire.
// All charts are independent eight-key rhythm arrangements of the full videos.
export const PROSEKA_SONGS=[
  {id:'disappearance',rank:26,title:'初音ミクの消失',artist:'cosMo＠暴走P',vocal:'初音ミク / 公式リメイク版',video:'VWVtIg5cdDU',duration:290,bpm:240,color:'#96d7c9',offset:.08},
  {id:'intensevoice',rank:27,title:'初音ミクの激唱',artist:'cosMo＠暴走P',vocal:'初音ミク / 2018Remake',video:'MFEaIgMkR_0',duration:301,bpm:200,color:'#b6d6e3',offset:.08},
  {id:'machinegun',rank:28,title:'マシンガンポエムドール',artist:'cosMo＠暴走P',vocal:'初音ミク',video:'UgZFpO_Y6qo',duration:144,bpm:220,color:'#d7a6ba',offset:.08},
  {id:'jinsei',rank:29,title:'人生',artist:'gcmstyle（アンメルツP）',vocal:'ミク・リン・レン・ルカ・MEIKO・KAITO',video:'wpVa0cnEeIw',duration:149,bpm:185,color:'#e2bb8d',offset:.08},
  {id:'yaminabe',rank:30,title:'ヤミナベ!!!!',artist:'cosMo＠暴走P',vocal:'初音ミク',video:'NFT6GMPeYJI',duration:135,bpm:264,color:'#cab0d9',offset:.08},
  {id:'whatsuppop',rank:31,title:"What's up? Pop!",artist:'Capchii',vocal:'初音ミク',video:'pS31mdpYuh4',duration:165,bpm:230,color:'#f0b4cf',offset:.08},
  {id:'ogyarinizer',rank:32,title:'おぎゃりないざー',artist:'Ponchi♪',vocal:'初音ミク',video:'1AliuyQ3II4',duration:130,bpm:245,color:'#efc694',offset:.08},
  {id:'daijobu',rank:33,title:'ダイジョブですか？',artist:'cosMo＠暴走P',vocal:'初音ミク',video:'2AD1jTs516E',duration:156,bpm:224,color:'#aadbd5',offset:.08},
  {id:'kusaregedou',rank:34,title:'腐れ外道とチョコレゐト',artist:'ピノキオピー',vocal:'初音ミク',video:'sHnvEsNU1X0',duration:201,bpm:260,color:'#c3cc98',offset:.08},
  {id:'amara',rank:35,title:'ÅMARA(大未来電脳)',artist:'sasakure.UK',vocal:'初音ミク・KAITO',video:'p6snD1650ck',duration:197,bpm:230,color:'#a8b8db',offset:.08},
];
for(const song of PROSEKA_SONGS){song.pack='vocaloid';song.collection='proseka';song.source='https://www.youtube.com/watch?v='+song.video;song.sourceLabel='作者の公式動画 ↗';song.chartLabel='ボカロ高難度曲の8鍵向け簡略リズムアレンジ';}
const PHRASES={
  disappearance:{verse:[0,2,4,2,5,4,3,1,2,4,6,4,7,5,3,2],hook:[0,4,1,5,2,6,3,7,6,2,5,1,4,0,3,7],rhythm:[0,.5,1,1.5,2,2.5,3.5],peaks:[28,91,171,230]},
  intensevoice:{verse:[2,3,4,5,4,2,1,0,2,4,5,7,6,5,3,2],hook:[0,4,1,5,2,6,3,7,2,5,1,6,0,4,3,7],rhythm:[0,.75,1.5,2,2.5,3.5],peaks:[42,108,189,249]},
  machinegun:{verse:[0,0,4,4,1,5,2,6,3,3,7,7,2,5,1,4],hook:[0,4,2,6,1,5,3,7,0,5,1,6,2,7,3,4],rhythm:[0,.5,1,1.5,2,2.75,3.5],peaks:[17,46,78,110]},
  jinsei:{verse:[0,2,4,5,7,5,4,2,1,3,5,6,7,4,2,0],hook:[0,4,2,6,1,5,3,7,6,4,5,2,3,1,4,0],rhythm:[0,.5,1.5,2,2.5,3.5],peaks:[16,47,78,112]},
  yaminabe:{verse:[0,4,1,5,3,7,2,6,0,5,2,7,1,4,3,6],hook:[0,3,6,1,4,7,2,5,7,4,1,6,3,0,5,2],rhythm:[0,.5,1,1.75,2,2.5,3.5],peaks:[5,39,61,99,118],tempos:[[0,264],[19,200],[33,100],[39,174],[54,116],[57,232],[77,91],[90,137],[96,273],[103,285],[109,300],[116,75],[118,300]]},
  whatsuppop:{verse:[2,4,5,4,6,5,3,4,1,3,4,5,7,6,4,2],hook:[0,4,1,5,2,6,3,7,5,2,6,3,7,4,1,0],rhythm:[0,.5,1,2,2.5,3,3.5],peaks:[21,55,91,125]},
  ogyarinizer:{verse:[0,4,0,5,1,5,2,6,3,7,2,6,1,4,3,7],hook:[0,4,2,6,1,5,3,7,0,5,1,6,2,7,3,4],rhythm:[0,.5,1,1.5,2,3,3.5],peaks:[14,41,72,100]},
  daijobu:{verse:[0,2,4,2,1,3,5,3,2,4,6,4,3,5,7,5],hook:[0,4,1,6,2,5,3,7,6,2,5,1,4,0,7,3],rhythm:[0,.75,1.5,2,2.75,3.5],peaks:[19,51,87,119]},
  kusaregedou:{verse:[2,4,5,3,4,2,1,3,4,6,5,4,2,3,1,0],hook:[0,4,2,6,1,5,3,7,2,5,1,6,0,4,3,7],rhythm:[0,.5,1,1.5,2,3,3.5],peaks:[23,63,111,157]},
  amara:{verse:[0,3,2,5,1,4,3,6,2,5,4,7,3,6,5,1],hook:[0,4,1,6,2,5,3,7,6,1,5,2,4,0,7,3],rhythm:[0,.75,1.5,2,2.5,3.5],peaks:[26,69,115,157]},
};
export function makeProsekaChart(song,difficulty){
  const profile=PHRASES[song.id];if(!profile)return null;
  const notes=[],busy=Array(8).fill(-1),sections=profile.tempos||[[0,song.bpm]];let cursor=0,bar=0;
  function add(time,lane,length=0,flick=false,until=song.duration){
    const t=Math.round(time*1000)/1000;if(t<1||t>=song.duration-1||t<busy[lane]+.08)return;
    const end=length?Math.round(Math.min(t+length,song.duration-1.2,until-.08)*1000)/1000:0;
    notes.push({t,lane,degree:lane,assist:false,...(end>t+.12?{end}:{}),...(flick&&!end?{flick:true}:{})});busy[lane]=end||t+(flick?.39:0);
  }
  for(let section=0;section<sections.length;section++){
    const [from,bpm]=sections[section],until=sections[section+1]?.[0]??song.duration,beat=60/bpm;
    for(let start=from+song.offset;start<until-1e-6;start+=4*beat,bar++){
      const quiet=start<12||start>song.duration-10,peak=profile.peaks.some(t=>start>=t&&start<t+22),phrase=peak?profile.hook:profile.verse;
      let rhythm=difficulty===0?(bpm>240?[0,2]:[0,1,2,3]):profile.rhythm;
      if(difficulty===2)rhythm=peak&&bar%4!==3?[0,.5,1,1.25,1.5,2,2.5,2.75,3,3.5]:[0,.5,1,1.5,2,2.5,3,3.5];
      if(quiet)rhythm=difficulty===0?[0,2]:[0,1,2.5,3.5];
      for(let i=0;i<rhythm.length;i++,cursor++){
        const time=start+rhythm[i]*beat;if(time>=until-.05)continue;
        const lane=phrase[(cursor+Math.floor(bar/8)*2)%phrase.length],last=i===rhythm.length-1;
        const hold=(i===0&&bar%8===0)||(last&&bar%4===3),length=hold?beat*(last?2:4):0;
        const flick=difficulty===2&&!hold&&peak&&i===1&&bar%3===1;
        add(time,lane,length,flick,until);
        if(difficulty>0&&i===0&&bar%2===0){add(time,(lane+4)%8,0,false,until);if(difficulty===2&&peak&&bar%4===0)add(time,(lane+2)%8,0,false,until);}
      }
    }
  }
  const counts=new Map();for(const n of notes)counts.set(n.t,(counts.get(n.t)||0)+1);for(const n of notes)n.chord=counts.get(n.t)>1;
  return notes.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
