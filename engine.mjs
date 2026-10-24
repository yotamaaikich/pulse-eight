export const CHART_VERSION = 'piano8-hold-v2';
export const SESSION_SECONDS = 60;
export const WINDOW = 0.17;
export const HOLD_GRACE = 0.12;
export const DIFFICULTIES = ['EASY', 'NORMAL', 'HARD'];
export const SONGS = [
  {id:'monitoring',rank:1,title:'モニタリング',artist:'DECO*27',vocal:'初音ミク',video:'kbNdx0yqbZE',bpm:132,color:'#f1aac4',offset:0.12},
  {id:'tetoris',rank:2,title:'テトリス',artist:'柊マグネタイト',vocal:'重音テトSV',video:'Soy4jGPHr3g',bpm:170,color:'#e8be54',offset:0.08},
  {id:'mesmerizer',rank:3,title:'メズマライザー',artist:'サツキ',vocal:'初音ミク・重音テトSV',video:'19y8YTbvri8',bpm:185,color:'#89d8c6',offset:0.02},
  {id:'override',rank:4,title:'オーバーライド',artist:'吉田夜世',vocal:'重音テトSV',video:'LLjfal8jCYI',bpm:145,color:'#b6b3ee',offset:0.05},
  {id:'telepathy',rank:5,title:'テレパシ',artist:'DECO*27',vocal:'初音ミク',video:'c56TpxfO9q0',bpm:205,color:'#92c4e7',offset:0.02},
  {id:'mimukauwa',rank:6,title:'みむかｩわナイストライ',artist:'ぬぬぬぬぬぬぬぬぬぬぬぬぬぬぬぬ',vocal:'初音ミク',video:'Ljr2wMSBHqU',bpm:126,color:'#c6d98e',offset:0.12},
  {id:'daikirai',rank:7,title:'ダイダイダイダイダイキライ',artist:'雨良 Amala',vocal:'初音ミク VS 重音テト',video:'klIxS5o65C4',bpm:130,color:'#ed9f94',offset:0.06},
  {id:'rinne',rank:8,title:'いますぐ輪廻',artist:'なきそ',vocal:'初音ミク',video:'3iUgKH8c7p4',bpm:145,color:'#d0b4d9',offset:0.02},
  {id:'mothergoose',rank:9,title:'アンノウン・マザーグース',artist:'wowaka',vocal:'初音ミク',video:'P_CSdxSGfaA',bpm:222,color:'#bac4cb',offset:0.03},
  {id:'heat',rank:10,title:'熱異常',artist:'いよわ',vocal:'足立レイ',video:'b2NTglk9tvI',bpm:183,color:'#e5a079',offset:0.02},
];

const REFERENCES = {
  monitoring:'https://www.gyename.com/2024/12/deco27-monitoring.html',
  tetoris:'https://www.gyename.com/2024/12/hiiragi-magnetite-tetoris.html',
  mesmerizer:'https://www.gyename.com/2024/10/satsuki-mesmerizer.html',
  override:'https://www.gyename.com/2024/08/yoshida-yasei-override.html',
  telepathy:'https://www.gyename.com/2025/03/deco27-telepathy.html',
  mimukauwa:'https://song.link/y/Ljr2wMSBHqU',
  daikirai:'https://store.piascore.com/scores/340349',
  rinne:'https://www.gyename.com/2025/08/nakiso-retry-now.html',
  mothergoose:'https://www.ymm.co.jp/p/detail.php?code=GTP01100045&dm=sl&dso=2',
  heat:'https://store.piascore.com/scores/332566',
};
for(const song of SONGS){song.source=REFERENCES[song.id];song.chartLabel='主旋律の輪郭を使った簡略アレンジ';}

// Short, reduced phrase contours; rhythm and transitions are an original arrangement.
// Pitches are folded into C4–C5. Black notes are accompaniment, never scored.
const MOTIFS = {
  monitoring:[9,7,5,0,2,9,7,2,2,2,2,2,0,2,9,7,8,7,5,5],
  tetoris:[4,11,0,2,0,11,9,9,0,4,2,0,11,0,2,4,0,9,9],
  mesmerizer:[10,5,5,5,5,5,5,5,5,6,5,6,5,3,1,3,1,3,3,5],
  override:[1,11,1,1,1,11,1,3,4,4,3,11,1,11,1,1,1,11,1,4],
  telepathy:[9,8,7,6,4,3,2,1,4,3,2,11,4,3,2,1,4,3,2,11],
  mimukauwa:[7,7,9,7,4,2,4,7,7,9,7,4,2,0,2,4,7,4,2,0],
  daikirai:[7,7,7,9,7,5,4,5,7,7,7,9,7,5,4,2,4,5,7,4],
  rinne:[5,4,4,4,4,5,9,7,5,1,1,1,1,4,2,0,10,9,9,9],
  mothergoose:[4,4,7,9,7,4,2,4,7,9,11,9,7,4,2,0,2,4,7,4],
  heat:[5,8,5,3,1,0,0,1,3,5,3,1,0,3,5,8,10,8,5,3],
};
const WHITE=[0,2,4,5,7,9,11,12];
const BLACK=[1,3,6,8,10];
const BOUNDARIES=[1,2,4,5,6];
const TRANSPOSE={mesmerizer:2,override:3,heat:2};

// Identical, deterministic charts are used by the browser and score server.
// These are original beat-grid charts, not transcriptions of commercial game charts.
export function makeChart(song, difficulty) {
  const beat = 60 / song.bpm;
  const notes = [];
  const busy=Array(8).fill(-1);
  const motif=MOTIFS[song.id];
  let idx=0;
  function add(pitch,b,index){
    let p=(pitch+(TRANSPOSE[song.id]||0))%12;
    if(p===0&&pitch>=9)p=12;
    const t=Math.round((b*beat+song.offset)*1000)/1000;
    const blackIndex=BLACK.indexOf(p);
    if(blackIndex!==-1)notes.push({t,assist:true,blackIndex,boundary:BOUNDARIES[blackIndex]});
    else {
      const lane=WHITE.indexOf(p);
      if(t<busy[lane]+.08)return null;
      const hold=index% (difficulty===0?24:difficulty===1?16:12)===0;
      const end=hold?Math.round(Math.min(58.8,t+beat*(difficulty===0?2:4))*1000)/1000:undefined;
      const note={t,lane,degree:lane,assist:false,...(end&&end>t+.25?{end}:{})};
      if(note.end)busy[lane]=note.end;
      notes.push(note);return note;
    }
    return null;
  }
  for(let b=8;b*beat+song.offset<SESSION_SECONDS-1;b+=.5,idx++){
    const pitch=motif[idx%motif.length];
    if(difficulty===0&&idx%2===1)continue;
    // Phrase endings leave breathing room; harder charts retain repeated melody notes.
    if(idx%32===31)continue;
    const lead=add(pitch,b,idx);
    if(difficulty>0&&idx%(difficulty===1?16:8)===0){
      const t=Math.round((b*beat+song.offset)*1000)/1000;
      const bass=(Math.floor(idx/16)+song.rank)%4;
      if(lead?.lane!==bass&&t>=busy[bass]+.08)notes.push({t,lane:bass,degree:bass,assist:false});
      if(difficulty===2&&idx%32===0){const third=bass+4;if(lead?.lane!==third&&t>=busy[third]+.08)notes.push({t,lane:third,degree:third,assist:false});}
    }
  }
  const counts=new Map();for(const n of notes)if(!n.assist)counts.set(n.t,(counts.get(n.t)||0)+1);
  for(const n of notes)if(!n.assist)n.chord=counts.get(n.t)>1;
  return notes.sort((a,b)=>a.t-b.t||(a.lane??-1)-(b.lane??-1));
}
export function judgment(delta) {
  const d = Math.round(Math.abs(delta)*1000000)/1000000;
  return d <= 0.045 ? 'perfect' : d <= 0.09 ? 'great' : d <= 0.14 ? 'good' : d <= WINDOW ? 'bad' : null;
}
export const WEIGHTS = {perfect:1,great:0.8,good:0.5,bad:0.2,miss:0};
export function newStats() {return {perfect:0,great:0,good:0,bad:0,miss:0,combo:0,maxCombo:0,weight:0};}
export function addResult(stats, result) {
  stats[result]++; stats.weight += WEIGHTS[result];
  stats.combo = result === 'miss' || result === 'bad' ? 0 : stats.combo + 1;
  stats.maxCombo = Math.max(stats.combo, stats.maxCombo);
}
export function summary(stats, count) {
  const accuracy = count ? stats.weight / count * 100 : 0;
  return {score:Math.round(stats.weight / Math.max(1,count) * 1000000),accuracy:Math.round(accuracy*100)/100,maxCombo:stats.maxCombo,
    rank:accuracy>=99?'SS':accuracy>=95?'S':accuracy>=90?'A':accuracy>=80?'B':accuracy>=65?'C':'D'};
}
export class RhythmSession {
  constructor(chart){this.notes=chart.map(n=>({...n,done:false,started:false}));this.stats=newStats();this.down=new Set();this.holds=new Map();}
  complete(note,result,delta=0){if(note.done)return null;note.done=true;this.holds.delete(note.lane);addResult(this.stats,result);return {kind:'judge',note,result,delta};}
  advance(t){
    const due=[];
    for(const n of this.notes){
      if(n.done)continue;
      if(n.assist&&n.t<=t)due.push({at:n.t,n,type:'assist'});
      else if(n.started&&n.end<=t)due.push({at:n.end,n,type:'tail'});
      else if(!n.assist&&!n.started&&n.t+WINDOW<t)due.push({at:n.t+WINDOW,n,type:'miss'});
    }
    due.sort((a,b)=>a.at-b.at||((a.n.lane??-1)-(b.n.lane??-1)));
    const notifications=[];
    for(const {n,type}of due){if(n.done)continue;if(type==='assist'){n.done=true;notifications.push({kind:'assist',note:n});}else notifications.push(this.complete(n,type==='tail'&&this.down.has(n.lane)?n.headJudge:'miss',n.headDelta||0));}
    return notifications.filter(Boolean);
  }
  press(t,lane){
    const notifications=this.advance(t);if(this.down.has(lane))return notifications;this.down.add(lane);
    const n=this.notes.find(n=>!n.done&&!n.started&&!n.assist&&n.lane===lane&&Math.abs(n.t-t)<=WINDOW);
    if(!n)return notifications;
    const result=judgment(t-n.t),delta=t-n.t;
    if(n.end){n.started=true;n.headJudge=result;n.headDelta=delta;this.holds.set(lane,n);notifications.push({kind:'holdstart',note:n,result,delta});}
    else notifications.push(this.complete(n,result,delta));
    return notifications.filter(Boolean);
  }
  release(t,lane){
    const notifications=this.advance(t);this.down.delete(lane);const n=this.holds.get(lane);
    if(n)notifications.push(this.complete(n,n.end-t<=HOLD_GRACE+1e-9?n.headJudge:'miss',n.headDelta));
    return notifications.filter(Boolean);
  }
  finish(){const notifications=this.advance(SESSION_SECONDS+.2);for(const n of this.notes)if(!n.done&&!n.assist)notifications.push(this.complete(n,'miss'));return notifications.filter(Boolean);}
}
export function scoreReplay(song,difficulty,events){
  const session=new RhythmSession(makeChart(song,difficulty));
  for(const [ms,lane,action=1]of events){if(action===1)session.press(ms/1000,lane);else session.release(ms/1000,lane);}
  session.finish();return {...summary(session.stats,session.notes.filter(n=>!n.assist).length),stats:session.stats};
}
