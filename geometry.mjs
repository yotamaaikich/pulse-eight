// One projection for the lane grid, tap centers, hold edges, and note widths.
export function projectPoint(x,width,depth,top,hitY){
  const progress=depth*depth;
  const scale=.28+.72*progress;
  return {x:width/2+(x-width/2)*scale,y:top+(hitY-top)*progress,scale};
}
