import {AUDIO_ATTACKS} from '../audio-attacks.mjs';
import {SONG_PIANO_NOTES} from '../song-piano-data.mjs';
import {writeFileSync} from 'node:fs';
// Reviewed full-video windows. Times select existing attacks, never a new grid.
// [start seconds, end seconds, preferred key A, preferred key B, maximum heads].
const phrases={
 disappearance:{
  1:[[135.2,137.5,1,5,8],[186.5,188.1,2,6,6],[213.4,215.1,3,4,6],[226.5,228.1,1,5,6],[241.8,243.1,2,6,6],[268.4,270,3,4,6],[273.2,274.9,1,5,8]],
  2:[[28.8,30.2,3,4,10],[41.2,43.3,2,3,16],[43.4,44.6,4,5,8],[57.2,58.6,4,5,8],[101.7,102.9,3,4,8],[107.5,108.6,1,2,8],[115.2,116.4,2,3,8],[135.2,137,5,6,8],[186.6,188.1,2,3,8],[226.6,228.1,3,4,8],[252.8,254.2,4,5,8],[268,270.4,1,2,16]]},
 intensevoice:{
  1:[[140,140.9,1,5,6],[242.8,244.7,2,6,8],[254.8,256,3,4,6],[267,269.1,1,5,6]],
  2:[[26.9,28.5,2,3,8],[94,95.4,4,5,8],[179.2,180.5,3,4,8],[186.5,187.8,1,2,8],[239.8,241.4,2,3,8],[246.6,249.3,4,5,16],[250.4,252.5,1,2,12],[262.7,264,3,4,8]]},
 machinegun:{
  1:[[24,25.4,1,5,6],[34.4,35.8,2,6,6],[56.7,58.6,3,4,8]],
  2:[[9.7,11.4,2,3,8],[24,25.4,4,5,8],[30.6,32.2,3,4,8],[52.5,53.9,1,2,8],[56.6,58.7,4,5,12],[68,69.9,2,3,12],[92.6,93.9,5,6,8]]},
 yaminabe:{
  1:[[15.3,17.3,1,5,8],[27.6,28.8,2,6,6],[44.5,46.7,3,4,8],[111.8,114.1,1,5,8]],
  2:[[13.3,15.1,2,3,8],[29.6,31.1,4,5,8],[44.9,46.7,3,4,8],[53.1,55.7,1,2,12],[74.8,76.1,4,5,8],[111.7,114.4,2,3,16],[119.7,123.2,3,4,16]]},
 whatsuppop:{
  1:[[81,82.8,1,5,6],[93.8,96.1,2,6,8],[129.5,131.8,3,4,12],[146.6,148.6,1,5,8]],
  2:[[66.7,68,2,3,8],[84.8,86.6,4,5,8],[90.3,93.3,3,4,16],[120.4,122.2,1,2,12],[129.7,131.8,2,3,12],[146.2,148.6,4,5,12]]},
 tetoris:{
  1:[[29.1,31.2,1,5,8],[51.1,53.3,2,6,8],[81.3,82.9,3,4,8],[107.4,110.1,1,5,12]],
  2:[[25.4,28.7,1,2,16],[50.3,53.3,2,3,16],[78.5,81.2,3,4,12],[81.3,82.9,4,5,8],[101.6,104.5,1,2,16],[108,110.1,4,5,12]]},
 mesmerizer:{
  1:[[47.2,48.3,1,5,6],[70.8,72.3,2,6,8],[116.2,117.7,3,4,8]],
  2:[[40.5,42.2,2,3,8],[56.1,57.9,4,5,8],[70.8,72.3,3,4,8],[92.3,94.7,1,2,12],[116.2,117.7,4,5,8],[129.5,131.4,2,3,8]]}
};
const contours={};
for(const [id,difficulties]of Object.entries(phrases)){
 const windows=Object.values(difficulties).flat(),pitch=new Map(SONG_PIANO_NOTES[id].map(n=>[n[0],n[1]]));
 contours[id]=AUDIO_ATTACKS[id].filter(n=>windows.some(w=>n[0]>=w[0]*1000&&n[0]<=w[1]*1000)).map(n=>[n[0],pitch.get(n[0]),n[1]]);
}
writeFileSync(new URL('../trill-data.mjs',import.meta.url),'// Authored full-video windows and source-derived pitch/contour snapshot v17.\n// This is shape evidence only: changing piano timbre cannot change chart lanes.\nexport const TRILL_PHRASES='+JSON.stringify(phrases)+';\nexport const TRILL_CONTOURS='+JSON.stringify(contours)+';\n');
console.log(JSON.stringify({songs:Object.keys(phrases).length,windows:Object.values(phrases).flatMap(x=>Object.values(x).flat()).length,sourceAttacks:Object.values(contours).reduce((s,x)=>s+x.length,0)}));
