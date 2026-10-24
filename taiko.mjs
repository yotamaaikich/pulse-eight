// Original eight-key rhythm arrangements of official Taiko soundtrack releases.
// These patterns are not transcriptions of the arcade game's drum charts.
export const TAIKO_SONGS=[
  {id:'kitasaitama',rank:21,title:'きたさいたま2000',artist:'LindaAI-CUE',vocal:'太鼓の達人 / 公式サウンドトラック',video:'TABWSPDMXaE',duration:121,bpm:222,color:'#f3ab86',pack:'taiko',offset:.1},
  {id:'madasaitama',rank:22,title:'まださいたま2000',artist:'LindaAI-CUE',vocal:'太鼓の達人 / 公式サウンドトラック',video:'j4LWHsmAufw',duration:129,bpm:280,color:'#e7ba79',pack:'taiko',offset:.1},
  {id:'yuugen',rank:23,title:'幽玄ノ乱',artist:'世阿弥',vocal:'太鼓の達人 / 公式サウンドトラック',video:'0xOwiA2gCtw',duration:126,bpm:300,color:'#c9a4c1',pack:'taiko',offset:.08},
  {id:'donkama',rank:24,title:'ドンカマ2000',artist:'LindaAI-CUE',vocal:'太鼓の達人 / 120 BPM基準の簡略アレンジ',video:'LEoxASk_V2g',duration:133,bpm:120,color:'#b2c2d7',pack:'taiko',offset:.1},
  {id:'angeldream',rank:25,title:'エンジェル ドリーム',artist:'たかみつようこ',vocal:'太鼓の達人 / 公式サウンドトラック',video:'qcfupB_h59M',duration:146,bpm:180,color:'#a9ddd0',pack:'taiko',offset:.08},
];
for(const song of TAIKO_SONGS){song.source='https://www.youtube.com/watch?v='+song.video;song.sourceLabel='公式サウンドトラック ↗';song.chartLabel='太鼓収録曲を8鍵で遊ぶ簡略リズムアレンジ';}
const PATTERNS={
  kitasaitama:{lanes:[0,4,1,5,2,6,3,7,2,5,1,6,0,4,3,7],rhythms:[[0,.5,1,2,2.5,3.5],[0,1,1.5,2,3,3.5]],accents:[20,47,76,99]},
  madasaitama:{lanes:[0,4,2,6,1,5,3,7,3,4,1,6,2,5,0,7],rhythms:[[0,.5,1,1.5,2,3],[0,1,1.5,2.5,3,3.5]],accents:[18,44,73,103]},
  yuugen:{lanes:[0,4,1,5,2,6,3,7,6,2,5,1,4,0,7,3],rhythms:[[0,.5,1,2,2.5,3],[0,1,1.5,2,3,3.5]],accents:[19,45,73,99]},
  donkama:{lanes:[0,0,4,1,5,5,2,6,3,7,3,6,2,5,1,4],rhythms:[[0,.75,1.5,2,2.75,3.5],[0,.5,4/3,2,8/3,3.5]],accents:[19,46,75,105]},
  angeldream:{lanes:[2,4,5,6,5,3,4,2,1,3,4,7,6,4,3,2],rhythms:[[0,.5,1,2,2.5,3.5],[0,1,1.5,2,2.5,3.5]],accents:[23,54,87,116]},
};
export function makeTaikoChart(song,difficulty){
  const profile=PATTERNS[song.id];if(!profile)return null;
  const beat=60/song.bpm,notes=[],busy=Array(8).fill(-1);let cursor=0;
  function add(time,lane,length=0,flick=false){
    const t=Math.round(time*1000)/1000;if(t<1||t>=song.duration-1||t<busy[lane]+.08)return;
    const end=length?Math.round(Math.min(t+length,song.duration-1.2)*1000)/1000:0;
    notes.push({t,lane,degree:lane,assist:false,...(end>t+.12?{end}:{}),...(flick&&!end?{flick:true}:{})});busy[lane]=end||t+(flick?.39:0);
  }
  for(let bar=2;bar*4*beat<song.duration-1;bar++){
    const start=bar*4*beat+song.offset,accent=profile.accents.some(t=>start>=t&&start<t+14),quiet=start<10||start>song.duration-9;
    let rhythm=difficulty===0?(song.bpm>240?[0,2]:[0,1,2,3]):profile.rhythms[Math.floor(bar/4)%2];
    if(difficulty===2&&accent&&bar%2===0)rhythm=song.id==='donkama'?[0,1/3,2/3,1,1.5,2,7/3,8/3,3,3.5]:[0,.5,1,1.5,2,2.5,3,3.5];
    if(quiet)rhythm=difficulty===0?[0,2]:[0,1,3];
    for(let i=0;i<rhythm.length;i++,cursor++){
      const time=start+rhythm[i]*beat,lane=profile.lanes[(cursor+Math.floor(bar/8)*2)%profile.lanes.length],last=i===rhythm.length-1;
      const hold=(i===0&&bar%8===0)||(last&&bar%4===3),length=hold?beat*(last?2:4):0;
      const flick=difficulty===2&&accent&&!hold&&i===1&&bar%3===1;
      add(time,lane,length,flick);
      if(difficulty>0&&i===0&&bar%2===0){const other=(lane+4)%8;add(time,other);if(difficulty===2&&accent&&bar%4===0)add(time,(lane+2)%8);}
    }
  }
  const counts=new Map();for(const n of notes)counts.set(n.t,(counts.get(n.t)||0)+1);for(const n of notes)n.chord=counts.get(n.t)>1;
  return notes.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
