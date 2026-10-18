// CSS-pixel geometry. Labels are recomputed from the current animated tank,
// never kept at a previous screen coordinate. Nearby vertical lanes avoid overlaps.
export const overlaps=(a,b,gap=4)=>a.x<b.x+b.w+gap&&a.x+a.w>b.x-gap&&a.y<b.y+b.h+gap&&a.y+a.h>b.y-gap;
export function placeTankLabels(tanks,obstacles,width,height){
  const placed=[],w=142,h=54,margin=8;
  const inside=r=>r.x>=margin&&r.y>=margin&&r.x+r.w<=width-margin&&r.y+r.h<=height-margin;
  const free=r=>inside(r)&&![...obstacles,...tanks.map(t=>t.bounds),...placed].some(b=>overlaps(r,b,5));
  for(const tank of [...tanks].sort((a,b)=>a.anchor.x-b.anchor.x)){
    const ideal={x:tank.anchor.x-w/2,y:tank.bounds.y-h-12,w,h},candidates=[];
    for(let row=0;row<6;row++)for(const dx of [0,-24,24,-48,48,-78,78]){
      candidates.push({x:Math.max(margin,Math.min(width-w-margin,ideal.x+dx)),y:ideal.y-row*(h+10),w,h});
    }
    // A label may sit just below its tank when a nearby toolbar occupies the sky.
    for(const dx of [0,-48,48])candidates.push({x:Math.max(margin,Math.min(width-w-margin,ideal.x+dx)),y:tank.bounds.y+tank.bounds.h+12,w,h});
    const distance=r=>Math.abs(r.x-ideal.x)*2+Math.abs(r.y-ideal.y)+(r.y>tank.anchor.y?120:0);
    candidates.sort((a,b)=>distance(a)-distance(b));
    const spot=candidates.find(free);
    if(spot)placed.push({...spot,id:tank.id,anchor:tank.anchor});
  }
  return placed;
}
export function placeTraceLabel(points,obstacles,width,height,w=242,h=84,edge=false){
  const free=r=>r.x>=8&&r.y>=8&&r.x+w<=width-8&&r.y+h<=height-8&&!obstacles.some(b=>overlaps(r,b,7));
  if(edge){
    // Prefer the perimeter; never cover a tank, HUD, question or action target.
    const candidates=[];
    for(let y=height-h-8;y>=96;y-=20)for(const x of [8,width-w-8])candidates.push({x,y,w,h});
    for(const y of [96,height-h-8])for(let x=8;x<=width-w-8;x+=24)candidates.push({x,y,w,h});
    const r=candidates.find(free);if(r)return {...r,anchor:points.at(-1)||{x:0,y:0}};
    return null;
  }
  const samples=points.filter((_,i)=>i%Math.max(1,Math.floor(points.length/24))===0).filter(p=>p.x>=8&&p.x<width-8&&p.y>=8&&p.y<height-8);
  samples.sort((a,b)=>Math.abs(a.x-width/2)-Math.abs(b.x-width/2));
  for(const p of samples)for(const dy of [-h-14,14])for(const dx of [-w/2,14,-w-14]){
    const r={x:Math.max(8,Math.min(width-w-8,p.x+dx)),y:p.y+dy,w,h};
    if(free(r))return {...r,anchor:p};
  }
  // If the path hugs a tank or the screen edge, keep its data in the nearest
  // free part of the battlefield rather than silently dropping the label.
  const anchor=samples[0]||points.at(-1)||{x:width/2,y:height/2},fallback=[];
  for(let y=96;y<=height-h-8;y+=20)for(let x=8;x<=width-w-8;x+=24){const r={x,y,w,h};if(free(r))fallback.push(r);}
  fallback.sort((a,b)=>Math.hypot(a.x+w/2-anchor.x,a.y+h/2-anchor.y)-Math.hypot(b.x+w/2-anchor.x,b.y+h/2-anchor.y));
  return fallback[0]?{...fallback[0],anchor}:null;
}
