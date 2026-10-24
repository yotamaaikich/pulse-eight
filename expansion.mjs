// New songs use authored beat phrases, alternate hands and leave room for holds.
// They are simplified rhythm arrangements, not copies of osu! hit objects.
export const EXTRA_SONGS=[
  {id:'connect',rank:11,title:'コネクト -season 03-',artist:'ClariS',vocal:'まどマギ OP / 公式セルフカバー',video:'eNvD-D6Gw6c',duration:273,bpm:175,color:'#eea9c4',pack:'madoka',offset:.12},
  {id:'magia',rank:12,title:'Magia',artist:'Kalafina',vocal:'まどマギ ED',video:'ks8WPvlQpbg',duration:319,bpm:125,color:'#b6a0cc',pack:'madoka',offset:.08},
  {id:'luminous',rank:13,title:'ルミナス -season 03-',artist:'ClariS',vocal:'始まりの物語 / 公式セルフカバー',video:'Rlp_4FQESts',duration:250,bpm:173,color:'#f4c1ad',pack:'madoka',offset:.1},
  {id:'colorful',rank:14,title:'カラフル -season 03-',artist:'ClariS',vocal:'叛逆の物語 / 公式セルフカバー',video:'xV0ccSNorlM',duration:274,bpm:178,color:'#cfb3e8',pack:'madoka',offset:.08},
  {id:'silvergarden',rank:15,title:'君の銀の庭',artist:'Kalafina',vocal:'叛逆の物語 / 3拍子',video:'kFhhLSbuXvI',duration:307,bpm:148,meter:3,color:'#b6c7de',pack:'madoka',offset:.08},
  {id:'freedomdive',rank:16,title:'FREEDOM DiVE',artist:'xi',vocal:'osu! 定番 / Parousia版',video:'k-3y2LVF_SE',duration:270,bpm:222.22,color:'#abcfe5',pack:'osu',offset:.05,map:39804},
  {id:'bluezenith',rank:17,title:'Blue Zenith',artist:'xi',vocal:'osu! 定番 / Parousia版',video:'vatcanQQJvQ',duration:259,bpm:200,color:'#8eaee6',pack:'osu',offset:.08,map:292301},
  {id:'ghost',rank:18,title:'GHOST',artist:'Camellia',vocal:'osu! 定番 / Cyphisonia E.P.',video:'OjbjZcBctuM',duration:350,bpm:220,color:'#c4adcd',pack:'osu',offset:.06,map:577187},
  {id:'crystallized',rank:19,title:'crystallized',artist:'Camellia',vocal:'osu! 定番 / album crystallized',video:'dkYHgxfQZBA',duration:277,bpm:174,color:'#a4ded8',pack:'osu',offset:.1,map:438613},
  {id:'exit',rank:20,title:"Exit This Earth's Atomosphere",artist:'Camellia',vocal:'osu! 定番 / PLANET//SHAPER',video:'QsuAKlNe_rI',duration:332,bpm:200,color:'#a9b7df',pack:'osu',offset:.08,map:517474},
];
for(const song of EXTRA_SONGS){song.source=song.map?'https://osu.ppy.sh/beatmapsets/'+song.map:'https://www.youtube.com/watch?v='+song.video;song.sourceLabel=song.map?'osu!での収録例 ↗':'公式動画・曲の情報 ↗';song.chartLabel='曲調に合わせた8鍵の簡略リズムアレンジ';}

// Eight-note keyboard contours, plus different phrase rhythms for each track.
const PHRASES={
  connect:{verse:[2,3,4,4,3,2,1,2,4,5,4,3,2,1,2,4],hook:[4,4,5,6,5,4,3,2,3,4,5,4,2,3,4,7],rhythm:[0,.5,1,1.5,2,3,3.5],chorus:[38,100,173,214]},
  magia:{verse:[0,2,3,2,0,1,2,0,4,3,2,1,0,2,1,0],hook:[4,3,4,6,5,4,2,3,4,3,2,0,1,2,3,0],rhythm:[0,.75,1.5,2,2.5,3.5],chorus:[62,132,219,272]},
  luminous:{verse:[1,2,4,3,2,1,0,2,3,4,5,4,2,3,1,2],hook:[3,4,5,7,6,5,4,3,4,5,4,2,3,4,5,7],rhythm:[0,.5,1.5,2,2.5,3,3.5],chorus:[43,106,169,207]},
  colorful:{verse:[0,2,3,4,3,2,4,5,4,3,1,2,3,4,2,1],hook:[4,5,6,7,5,4,5,3,2,3,4,6,5,4,3,4],rhythm:[0,.5,1,2,2.75,3,3.5],chorus:[49,115,183,228]},
  silvergarden:{verse:[2,3,4,3,2,1,2,4,5,4,2,3],hook:[4,5,6,5,4,2,3,4,5,4,3,2],rhythm:[0,1,1.5,2],chorus:[49,123,201,258]},
  freedomdive:{verse:[0,2,4,5,7,5,4,2,1,3,5,6,7,6,4,2],hook:[0,4,2,5,4,7,5,6,4,5,3,4,2,3,1,0],rhythm:[0,.5,1,1.5,2,2.5,3,3.5],chorus:[27,78,143,208]},
  bluezenith:{verse:[0,2,3,5,4,2,1,3,2,4,5,7,6,4,3,1],hook:[2,4,6,7,6,4,2,3,1,3,5,6,5,3,1,0],rhythm:[0,.5,1.5,2,2.5,3.5],chorus:[30,88,151,211]},
  ghost:{verse:[0,0,4,2,0,3,5,2,1,1,5,3,1,4,6,3],hook:[0,4,1,5,2,6,3,7,6,2,5,1,4,0,3,7],rhythm:[0,.5,1,1.75,2,3,3.5],chorus:[41,113,197,275]},
  crystallized:{verse:[0,2,4,6,5,3,1,2,3,5,7,6,4,2,1,3],hook:[4,6,7,5,6,4,2,3,5,7,6,4,3,1,2,4],rhythm:[0,.75,1.5,2,2.5,3.5],chorus:[36,98,162,224]},
  exit:{verse:[0,4,2,5,3,6,4,7,5,3,6,2,4,1,3,0],hook:[0,3,6,4,7,5,2,4,1,5,3,6,4,7,2,0],rhythm:[0,.5,1,2,2.5,3,3.5],chorus:[44,116,194,268]},
};
export function makeExpansionChart(song,difficulty){
  const profile=PHRASES[song.id];if(!profile)return null;
  const beat=60/song.bpm,meter=song.meter||4,notes=[],busy=Array(8).fill(-1);let cursor=0;
  const add=(t,lane,hold=0,flick=false)=>{
    t=Math.round(t*1000)/1000;if(t<1||t>=song.duration-1||t<busy[lane]+.08)return;
    const end=hold?Math.round(Math.min(t+hold,song.duration-1.2)*1000)/1000:0;
    notes.push({t,lane,degree:lane,assist:false,...(end>t+.12?{end}:{}),...(flick&&!end?{flick:true}:{})});
    busy[lane]=end||t+(flick?.39:0);
  };
  // Sections deliberately alternate full phrases, sparse interludes and finales.
  for(let bar=2;bar*meter*beat<song.duration-1;bar++){
    const start=bar*meter*beat+song.offset,chorus=profile.chorus.some(at=>start>=at&&start<at+24),intro=start<18,outro=start>song.duration-16;
    const phrase=chorus?profile.hook:profile.verse;
    let rhythm=difficulty===0?Array.from({length:meter},(_,i)=>i):profile.rhythm;
    if(meter===3)rhythm=difficulty===0?[0,1,2]:[0,.5,1,1.5,2,2.5];
    if(intro||outro)rhythm=difficulty===0?[0,meter-1]:[0,1,meter-1];
    // Hard sections have short offbeat runs; alternating quiet bars prevent fatigue.
    if(difficulty===2&&chorus&&bar%4===2&&song.pack==='osu')rhythm=[0,.5,1,1.5,2,2.5,3,3.5];
    for(let i=0;i<rhythm.length;i++,cursor++){
      const b=rhythm[i];if(b>=meter)continue;
      if(difficulty===0&&bar%4===3&&i===meter-1)continue;
      const t=start+b*beat,lane=phrase[(cursor+Math.floor(bar/8)*2)%phrase.length],last=i===rhythm.length-1;
      const hold=(bar%8===0&&i===0)||(last&&bar%4===3);
      const length=hold?beat*(last?(difficulty===0?1:2):meter):0;
      const flick=difficulty===2&&!hold&&chorus&&i===1&&bar%3===1;
      add(t,lane,length,flick);
      if(difficulty>0&&i===0&&bar%2===(chorus?0:1)){
        const bass=(bar+song.rank)%4;if(bass!==lane)add(t,bass);
        if(difficulty===2&&chorus&&bar%4===0){const high=(bass+4)%8;if(high!==lane)add(t,high);}
      }
    }
  }
  const counts=new Map();for(const note of notes)counts.set(note.t,(counts.get(note.t)||0)+1);for(const note of notes)note.chord=counts.get(note.t)>1;
  return notes.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
