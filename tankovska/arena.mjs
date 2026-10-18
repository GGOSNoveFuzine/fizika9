import {J} from './shared.mjs';
import './renderer.mjs';
import {RATE,planFor,tanksAt,predictImpact} from './combat.mjs';
import {placeTankLabels,placeTraceLabel} from './hud-layout.mjs';
const P=J.Physics;
export const previewAllowed=s=>s?.config.play==='training'||s?.round===1;
export function traceDetails(trace){
  const rock=trace.weapon==='rock',energy=trace.baseCost??(rock?null:trace.force*J.C.launchStroke);
  return {name:J.PROJECTILES[rock?'rock':trace.projectile||'ball'].label,
    settings:rock?`Masa ${J.num(trace.mass)} kg · višina ${J.num(trace.altitude??trace.origin.y,1)} m`:`Masa ${J.num(trace.mass)} kg · kot ${J.num(trace.angle,1)}° ${trace.direction===-1?'←':'→'}`,
    energy:rock?`Cilj ${J.num(trace.targetX??trace.end.x)} m · energija dviga in gibanja ${energy===null?'—':J.energy(energy)}`:`Sila ${J.num(trace.force/1000)} kN · energija ${J.energy(energy)}`};
}
export class Arena extends J.Renderer {
  flightView(s,f,now){
    let end=f.visualEnd;
    if(!Number.isFinite(end?.duration)||end.duration<0||!Number.isFinite(end?.point?.x)||!Number.isFinite(end?.point?.y)){
      // Older snapshots have no visualEnd. Predict once per revision, not per frame.
      const key=s.id+':'+s.round+':'+s.rev;
      if(this.flightEndKey!==key){this.flightEndKey=key;this.flightEnds=new Map();}
      end=this.flightEnds.get(f.id);
      if(!end){const impact=predictImpact(s,f,f.at);end={duration:impact.duration,point:{x:impact.hit.point.x,y:impact.hit.point.y}};this.flightEnds.set(f.id,end);}
    }
    const elapsed=(now-f.at)*RATE/1000,time=J.clamp(elapsed,0,end.duration),position=P.position(f.shot,time);
    if(elapsed>=end.duration)Object.assign(position,end.point);
    return {time,position,started:elapsed>=0};
  }
  draw(s,draft,now=Date.now(),options={}){
    if(!s)return;this.resize();const c=this.ctx,w=this.width,h=this.height;
    Object.assign(this.options,options);this.worldWidth=s.worldWidth;this.worldHeight=s.worldHeight;this.stageId=s.stageId;
    const own=s.tanks[s.viewer??0];
    if(previewAllowed(s)&&draft&&s.canAct&&s.phase==='prep'&&!s.own?.utility&&!options.concealed){
      const key=s.id+':'+s.viewer+':'+JSON.stringify(draft)+':'+s.rev+':'+s.round+(s.moves.length?':'+now:'');
      if(this.previewKey!==key){const tanks=tanksAt(s,now),plan=planFor({...s,tanks,slots:[]},own.id,draft),limits=P.airLimits(s.terrain,draft.targetX,s.worldHeight),validHeight=draft.weapon!=='rock'||draft.height>=limits.min&&draft.height<=limits.max;this.preview=validHeight?{...plan,guide:P.simulate(plan.shot,s.terrain,[]),flight:P.simulate(plan.shot,s.terrain,tanks)}:null;this.previewKey=key;}
    }else{this.preview=null;this.previewDrawnPoints=null;this.previewKey='';}
    if(!this.preview)this.previewDrawnPoints=null;
    // Fit the complete arc, including high shells and air releases beyond an edge.
    // Merely opening a question does not affect this camera calculation.
    const pad=options.battleLayout?(w>=1000?{l:96,r:24,t:152,b:145}:{l:70,r:12,t:170,b:148}):{l:22,r:22,t:22,b:22};
    const points=this.preview?.flight.points||[],xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    const flightViews=s.flights.map(f=>({f,...this.flightView(s,f,now)}));
    for(const {position:p} of flightViews){xs.push(p.x);ys.push(p.y);}
    const bounds={left:Math.min(0,...xs),right:Math.max(s.worldWidth,...xs),top:Math.max(s.worldHeight,...ys.map(y=>y+5))};
    const cameraKey=s.id+':'+s.round+':'+s.viewer;
    if(this.cameraKey!==cameraKey){this.cameraKey=cameraKey;this.viewBounds=null;this.flightBounds=null;}
    if(this.viewBounds&&(!s.canAct||s.phase!=='prep'||s.own?.utility)){bounds.left=Math.min(bounds.left,this.viewBounds.left);bounds.right=Math.max(bounds.right,this.viewBounds.right);bounds.top=Math.max(bounds.top,this.viewBounds.top);}
    // While a shot flies, retain the widest view reached instead of bouncing the camera.
    if(s.flights.length&&this.flightBounds){bounds.left=Math.min(bounds.left,this.flightBounds.left);bounds.right=Math.max(bounds.right,this.flightBounds.right);bounds.top=Math.max(bounds.top,this.flightBounds.top);}
    this.flightBounds=s.flights.length?bounds:null;this.viewBounds=bounds;
    this.scale=Math.min((w-pad.l-pad.r)/(bounds.right-bounds.left),(h-pad.t-pad.b)/bounds.top);
    const ox=pad.l+(w-pad.l-pad.r-(bounds.right-bounds.left)*this.scale)/2,oy=pad.t+(h-pad.t-pad.b-bounds.top*this.scale)/2;
    this.left=bounds.left-ox/this.scale;this.top=bounds.top+oy/this.scale;
    c.clearRect(0,0,w,h);this.sky(s);this.ground(s.terrain);
    const traceKey=s.id+':'+s.round+':'+s.viewer;
    if(traceKey!==this.traceKey){this.traceKey=traceKey;this.traceCache=new Map();this.options.tracePinned=null;this.options.traceHover=null;}
    const traces=options.concealed?[]:(s.traces||[]);
    const trace=traces.find(t=>t.id===this.options.traceHover)||traces.find(t=>t.id===this.options.tracePinned)||traces.at(-1);
    if(options.traces)this.drawTraces(traces,trace?.id);
    if(this.preview){this.terrainForAir=s.terrain;this.drawPreview(this.preview,Infinity);}
    this.hudEntries=[];
    const visible=tanksAt(s,now);
    for(const t of visible){
      const mine=t.id===s.viewer;let angle=t.barrelAngle;
      if(mine&&!options.concealed){
        const launching=s.flights.find(f=>f.shot.attackerId===t.id&&f.shot.weapon==='shell'&&now<=f.at);
        if(Number.isFinite(s.own?.lockedBarrelAngle))angle=s.own.lockedBarrelAngle;
        else if(launching)angle=Math.atan2(launching.shot.vy,launching.shot.vx);
        else if(draft&&s.canAct&&s.phase==='prep')angle=draft.direction===1?draft.angle*Math.PI/180:Math.PI-draft.angle*Math.PI/180;
      }
      this.barrels[t.id]=angle;this.tank(t,t.x,t.y,mine,angle,t.kind==='drive');
      if(mine&&t.hp>0)this.activeMarker(t,t.x,t.y);
    }
    for(const {f,time,position:pos,started} of flightViews){
      const shot=f.shot;
      if(shot.airDrop){const carrierTime=(now-f.confirmedAt)*RATE/1000;this.plane(shot,carrierTime,!started);}
      if(started){this.projectile(pos,shot.weapon,shot.radius,false,shot.projectile);this.offscreen(pos,shot.weapon==='rock'?'SKALA':'IZSTRELEK',s.tanks[shot.attackerId].color);if(time<.35&&shot.weapon==='shell'&&now<f.at+350/RATE)this.muzzleFlash(shot,time);}
    }
    for(const effect of s.effects||[])this.impact(effect,(now-effect.at)/1000);
    this.worldBorder();this.drawTankHud(options.obstacles||[]);
    this.traceLabelRect=null;this.traceInfo=null;
    const details=traces.find(t=>t.id===options.traceDetailsId);
    if(options.traces&&details)this.drawTraceData(details,details===traces.at(-1),[...(options.obstacles||[]),...(options.traceObstacles||[])]);
    if(options.inset&&own?.hp>0)this.inset(visible[own.id]);
    if(this.preview&&!options.battleLayout)this.text('PRIKAZ POTI',w/2,22,12,'#ffe3a8','center');
  }
  worldBorder(){
    // No opaque mask: an air release can legitimately begin outside the map.
    const c=this.ctx,top=this.viewBounds?.top||this.worldHeight,tl=this.point(0,top),br=this.point(this.worldWidth,0);
    c.save();c.strokeStyle='#b0cddd88';c.lineWidth=1;c.strokeRect(tl.x,tl.y,br.x-tl.x,br.y-tl.y);
    const step=Math.max(10,Math.ceil(top/120)*10);
    for(let y=0;y<=top;y+=step){const p=this.point(0,y);this.text(String(y),p.x-6,p.y,9,'#cee6eb','right','normal');}
    this.text('m',tl.x-7,Math.max(8,tl.y-9),9,'#cee6eb','right');
    for(let x=0;x<=this.worldWidth;x+=20){const p=this.point(x,0);this.text(String(x),p.x,p.y+12,9,'#cee6eb','center','normal');}c.restore();
  }
  drawPreview(preview){
    // Use the same collision simulation as the shot, all the way to its FIRST hit.
    // Air drops show the nominal arc; their random release stays hidden until commit.
    const c=this.ctx,flight=preview.flight,shot=preview.shot;
    this.previewDrawnPoints=flight.points;
    c.save();c.lineWidth=2;c.setLineDash([4,6]);c.strokeStyle='#ffe3aa';c.beginPath();
    flight.points.forEach((v,i)=>{const p=this.point(v.x,v.y);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();c.setLineDash([]);
    const hit=this.point(flight.hit.point.x,flight.hit.point.y);c.beginPath();c.arc(hit.x,hit.y,7,0,Math.PI*2);c.moveTo(hit.x-11,hit.y);c.lineTo(hit.x+11,hit.y);c.moveTo(hit.x,hit.y-11);c.lineTo(hit.x,hit.y+11);c.stroke();c.restore();
    if(shot.airDrop)this.airPlacement(shot);
  }
  previewPoints(preview,seconds=Infinity){return preview.flight.points.filter(p=>p.t<=seconds);}
  airPlacement(shot){
    const c=this.ctx,a=shot.airDrop,release=this.point(shot.origin.x,shot.origin.y);
    c.save();c.strokeStyle='#ffdc9e99';c.lineWidth=2;c.setLineDash([3,5]);c.beginPath();let first=true;
    for(let x=Math.max(0,shot.targetX-a.spread);x<=Math.min(this.worldWidth,shot.targetX+a.spread);x+=.5){const p=this.point(x,P.height(this.terrainForAir,x));if(first)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);first=false;}c.stroke();c.setLineDash([]);
    if(release.x>=8&&release.x<this.width-8){c.beginPath();c.arc(release.x,release.y,4,0,Math.PI*2);c.stroke();}
    c.restore();
  }
  drawTankHud(obstacles=[]){
    const scale=this.scale,c=this.ctx;
    this.tankBoxes=this.hudEntries.map(({tank,x,y})=>{
      const p=this.point(x,y),a=this.barrels[tank.id],tip={x:p.x+(J.C.barrelPivotX+Math.cos(a)*J.C.barrelLength)*scale,y:p.y-(J.C.barrelPivotY+Math.sin(a)*J.C.barrelLength)*scale};
      const left=Math.min(p.x-2.4*scale,tip.x-.5*scale),top=Math.min(p.y-3.9*scale,tip.y-.5*scale),right=Math.max(p.x+2.4*scale,tip.x+.5*scale),bottom=p.y+.6*scale;
      return {id:tank.id,anchor:{x:p.x,y:top},bounds:{x:left,y:top,w:right-left,h:bottom-top}};
    });
    if(this.options.inset)obstacles=[...obstacles,{x:10,y:this.height-110,w:112,h:86}];
    this.hudRects=placeTankLabels(this.tankBoxes,obstacles,this.width,this.height);
    for(const {id,x:left,y:top,w,h,anchor} of this.hudRects){
      const {tank:t,active}=this.hudEntries.find(e=>e.tank.id===id);
      const bounds=this.tankBoxes.find(b=>b.id===id).bounds;
      const start={x:J.clamp(left+w/2,bounds.x,bounds.x+bounds.w),y:J.clamp(top+h/2,bounds.y,bounds.y+bounds.h)},end={x:J.clamp(start.x,left,left+w),y:J.clamp(start.y,top,top+h)};
      // Only a short local pointer; no line crossing the battlefield.
      if(Math.hypot(end.x-start.x,end.y-start.y)<65){c.strokeStyle=t.color+'88';c.lineWidth=1;c.beginPath();c.moveTo(start.x,start.y);c.lineTo(end.x,end.y);c.stroke();}
      this.rounded(left,top,w,h,6,'#112b3ae8',active?t.color:'#73929577');
      c.font='bold 12px Trebuchet MS, Arial, sans-serif';let name=t.name+(t.hp<=0?' ×':'');while(name.length>1&&c.measureText(name).width>w-16)name=name.slice(0,-2)+'…';
      this.text(name,left+8,top+12,12,t.color);
      for(const [label,value,ratio,color,dy] of [['HP',J.num(t.hp,0),t.hp/(t.hpMax||100),'#73e5a2',29],['ŠČIT',J.energy(Math.max(0,t.shield)),t.shield/(t.shieldMax||30000),'#b3a1ff',44]]){
        this.text(label,left+8,top+dy,10,color);this.rounded(left+43,top+dy-4,37,6,3,'#3e5363');if(ratio>0)this.rounded(left+43,top+dy-4,37*J.clamp(ratio,0,1),6,3,color);this.text(value,left+w-7,top+dy,11,'#eef8f9','right');
      }
    }
  }
  drawTraces(traces,selected){
    const c=this.ctx;
    for(const trace of traces){
      const strong=trace.id===selected;c.save();c.strokeStyle=strong?'#aaf5e3':'#8edbce65';c.lineWidth=strong?2.3:1.2;c.setLineDash([]);c.beginPath();
      this.tracePoints(trace).forEach((v,i)=>{const p=this.point(v.x,v.y);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();
      if(strong){const p=this.point(trace.end.x,trace.end.y);c.beginPath();c.arc(p.x,p.y,6,0,Math.PI*2);c.stroke();}c.restore();
    }
  }
  drawTraceData(trace,latest,obstacles){
    const points=this.tracePoints(trace).map(p=>this.point(p.x,p.y));
    const blocked=[...obstacles,...this.hudRects,...this.tankBoxes.map(t=>t.bounds)];
    const r=placeTraceLabel(points,blocked,this.width,this.height,Math.min(540,this.width-32),62,true);
    this.traceInfo={id:trace.id,...traceDetails(trace)};if(!r)return;
    this.traceLabelRect=r;
  }
  inset(t){
    const old={scale:this.scale,left:this.left,top:this.top},w=112,h=86,x=10,y=this.height-110,c=this.ctx;
    c.save();this.rounded(x,y,w,h,9,'#102437dd',t.color);this.text('TVOJ TANK',x+w/2,y+14,10,t.color,'center');
    c.beginPath();c.rect(x+1,y+25,w-2,h-26);c.clip();this.scale=11;this.left=t.x-(x+w/2)/11;this.top=t.y+(y+h-8)/11;
    this.tank(t,t.x,t.y,false,this.barrels[t.id],false,0,true);Object.assign(this,old);c.restore();
  }
}
