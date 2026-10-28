import {SECTION_CONTROLS,SUSTAIN_CANDIDATES} from './arrangement-data.mjs?v=arrangement-12';

const neutral=Object.freeze({density:1,chords:1,holdGap:2.5,mode:0,reference:false});
const holds=new Map(Object.entries(SUSTAIN_CANDIDATES).map(([id,rows])=>[id,new Map(rows)]));

// Half-open intervals keep a new phrase's controls out of the preceding phrase.
// Unmatched sections have their own full-audio controls, never a stretched cut.
export function sectionAt(id,seconds){
 const rows=SECTION_CONTROLS[id];if(!rows||!Number.isFinite(seconds))return neutral;
 const ms=seconds*1000;let low=0,high=rows.length;
 while(low<high){const mid=(low+high)>>>1;if(rows[mid][1]<=ms)low=mid+1;else high=mid;}
 const row=rows[low];if(!row||ms<row[0])return neutral;
 return {density:row[2],chords:row[3],holdGap:row[4],mode:row[5],reference:!!row[6]};
}

export function measuredSustain(id,row){return Math.max(row[2],holds.get(id)?.get(row[0])||0);}

export function attackGap(id,seconds,difficulty){
 const density=sectionAt(id,seconds).density;
 return Math.max([240,125,82][difficulty],Math.min([375,205,125][difficulty],[285,155,95][difficulty]/density));
}
