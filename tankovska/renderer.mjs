/* ===== renderer.js ===== */
(function(root){
'use strict';
const J=root.JD,C=J.C,P=J.Physics,F=J.PHASE;
class Renderer {
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.width=1000;this.height=470;this.scale=1;this.top=70;this.left=0;this.options={reduced:false,hitboxes:false};this.preview=null;this.time=0;this.camera=null;this.barrels={};this.lastTime=null;this.lastSize="";}
 resize(){const r=this.canvas.getBoundingClientRect(),dpr=Math.min(2,root.devicePixelRatio||1);this.width=Math.max(1,r.width);this.height=Math.max(1,r.height);const w=Math.round(this.width*dpr),h=Math.round(this.height*dpr);if(this.canvas.width!==w||this.canvas.height!==h){this.canvas.width=w;this.canvas.height=h;}this.ctx.setTransform(dpr,0,0,dpr,0,0);}
 point(x,y){return {x:(x-this.left)*this.scale,y:(this.top-y)*this.scale};}
 world(clientX,clientY){const r=this.canvas.getBoundingClientRect();return {x:this.left+(clientX-r.left)/this.scale,y:this.top-(clientY-r.top)/this.scale};}
 rounded(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.stroke();}}
 text(txt,x,y,size,color='#fff',align='left',weight='bold'){const c=this.ctx;c.font=`${weight} ${size}px Trebuchet MS, Arial, sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(txt,x,y);}
 cameraFor(s,ui,projectile,visibleShot){
  const w=this.width,h=this.height,alive=s.tanks.filter(t=>t.hp>0);
  if(s.worldVersion>=24){const width=P.width(s.terrain),height=s.worldHeight||C.worldHeight,scale=Math.min((w-44)/width,(h-42)/height);return {scale,left:(width-w/scale)/2,top:height+(h/scale-height)/2,baseScale:scale};}
  let span=C.worldWidth*C.cameraWorldMargin,center=C.worldWidth/2;
  if(w<620&&!ui.menu&&!this.options.overview){
   span=C.cameraMobileSpan;center=s.tanks[this.options.viewerId??0].x;
   if(s.phase===F.PREP&&s.active===(this.options.viewerId??0)){const x=this.preview?.guide?.hit.point.x??s.tanks[this.options.viewerId??0].x;span=Math.min(120,Math.max(C.cameraMobileSpan,Math.abs(x-s.tanks[this.options.viewerId??0].x)+26));center=(x+s.tanks[this.options.viewerId??0].x)/2;}
   if(s.phase===F.DEFEND)center=s.tanks[s.defense.ids[s.defense.index]].x;
   if(s.phase===F.MOVE)center=s.move.plans.reduce((n,m)=>n+m.from,0)/Math.max(1,s.move.plans.length);
   if(s.phase===F.FLIGHT&&visibleShot)center=visibleShot.weapon==='rock'?visibleShot.origin.x:(projectile?.x??visibleShot.origin.x);
   if(s.phase===F.RESULT&&s.result?.point)center=s.result.point.x;
  }
  const low=Math.min(...(alive.length?alive:s.tanks).map(t=>t.y));
  // Start with more sky. Extra zoom-out is bounded at 20%, regardless of apex height.
  const baseScale=Math.min(w/span,Math.max(1,h-100)/C.cameraSkyHeight);
  let peak=low+C.cameraSkyHeight;
  if(visibleShot)peak=visibleShot.weapon==='rock'?visibleShot.origin.y:visibleShot.origin.y+Math.max(0,visibleShot.vy)**2/(2*C.g);
  const fit=visibleShot?Math.max(1,h-116)/Math.max(1,peak-low+10):baseScale;
  const scale=J.clamp(fit,baseScale*C.cameraMinZoom,baseScale),bottom=low-10;
  const top=bottom+h/scale,actualSpan=w/scale;
  const left=actualSpan>=C.worldWidth?(C.worldWidth-actualSpan)/2:J.clamp(center-actualSpan/2,0,C.worldWidth-actualSpan);
  return {scale,left,top,baseScale};
 }
 publicBarrelAngle(s,t,visibleShot){
  if(visibleShot?.weapon==='shell'&&visibleShot.attackerId===t.id)return Math.atan2(visibleShot.vy,visibleShot.vx);
  if(s.phase===F.PREP&&s.active===(this.options.viewerId??0)&&t.id===(this.options.viewerId??0)&&!visibleShot)return this.barrels[t.id]??Math.PI/2;
  if(t.id===(this.options.viewerId??0)&&s.locked?.attackerId===(this.options.viewerId??0)&&s.locked.weapon==='shell'&&[F.LOCK,F.DEFEND,F.MOVE].includes(s.phase))return Number.isFinite(s.locked.vy)?Math.atan2(s.locked.vy,s.locked.vx):t.barrelAngle;
  return t.barrelAngle??(t.id===2?Math.PI-.15:.15);
 }
 draw(game,ui={}){
  const frameKey=game.state.id+':'+game.state.turn+':'+game.state.phase+':'+(game.state.active===(this.options.viewerId??0)?JSON.stringify(game.state.draft):''),rect=this.canvas.getBoundingClientRect();
  if(ui.paused&&this.hasFrame&&this.frozenFrameKey===frameKey&&this.width===rect.width&&this.height===rect.height)return;
  this.frozenFrameKey=frameKey;
  this.hasFrame=true;if(this.lastGameId!==game.state.id)this.traceCache=new Map();this.lastGameId=game.state.id;this.hudEntries=[];this.previewLabel=null;this.stageId=game.state.stageId||1;
  this.worldWidth=P.width(game.state.terrain);this.worldHeight=game.state.worldHeight||C.worldHeight;this.resize();const c=this.ctx,s=game.state,w=this.width,h=this.height,elapsed=ui.elapsed||0;
  this.time=ui.time||0;this.options=ui.options||this.options;
  const dt=this.lastTime===null?1/60:J.clamp(this.time-this.lastTime,0,.1);this.lastTime=this.time;
  const showPreview=s.phase===F.PREP&&s.active===(this.options.viewerId??0)&&!ui.menu;
  // Hidden enemy aim cannot affect camera, barrel, rock, labels or trajectory before the move is committed.
  const visibleShot=showPreview&&this.preview?.reachable?this.preview.shot:!ui.menu&&[F.FLIGHT,F.RESULT].includes(s.phase)&&s.locked?s.locked:null;
  let projectile=null,timing=null,flightElapsed=-1,edgeTarget=null;
  if(s.phase===F.FLIGHT&&s.flight){timing=J.attackTiming(s.locked,s.flight);flightElapsed=elapsed-timing.prep;
   if(flightElapsed>=0)projectile=P.flightSample(s.flight,Math.min(s.flight.duration,flightElapsed*timing.rate));
  }
  const target=this.cameraFor(s,ui,projectile,visibleShot),size=w+':'+h;
  const goal={scale:target.scale,center:target.left+w/(2*target.scale),bottom:target.top-h/target.scale};
  if(!this.camera||this.camera.id!==s.id)this.barrels={};
  if(!this.camera||this.camera.id!==s.id||this.lastSize!==size||this.options.reduced&&!this.dragging||s.worldVersion>=24)this.camera={...goal,id:s.id};
  else if(!this.dragging){
   const k=1-Math.exp(-dt*12);
   for(const field of ['scale','center','bottom'])this.camera[field]+=(goal[field]-this.camera[field])*k;
  }
  this.lastSize=size;this.scale=this.camera.scale;this.left=this.camera.center-w/(2*this.scale);this.top=this.camera.bottom+h/this.scale;
  c.clearRect(0,0,w,h);this.sky(s);c.save();
  if(s.worldVersion>=24){const tl=this.point(0,this.worldHeight);c.beginPath();c.rect(tl.x,tl.y,this.worldWidth*this.scale,this.worldHeight*this.scale);c.clip();}
  if(!this.options.reduced&&s.phase===F.RESULT&&s.result?.action==='attack'&&elapsed<.3){const e=1-elapsed/.3;c.translate(Math.sin(this.time*90)*3*e,Math.cos(this.time*73)*2*e);}
  this.ground(s.terrain);
  if(!ui.menu&&this.options.showTraces)this.drawTraces(P.ownTraces(s,this.options.viewerId??0));
  if(showPreview&&this.preview?.reachable){this.terrainForAir=s.terrain;this.drawPreview(this.preview,J.previewSeconds(s.stageId));}
  if(s.phase===F.DEFEND&&game.defender?.id===(this.options.viewerId??0)){const range=P.moveRange(s,s.tanks[this.options.viewerId??0],s.defenseBonus.multiplier);this.movement(s.tanks[this.options.viewerId??0],range,ui.dodge||0,s.defenseBonus.multiplier,s);}
  for(const t of [...s.tanks].sort((a,b)=>(a.depth??a.id)-(b.depth??b.id))){
   let x=t.x,y=t.y;const move=s.move?.plans.find(p=>p.tankId===t.id);
   let driving=false;if(s.phase===F.MOVE&&move){const sample=P.moveSample(move,elapsed*C.animationSpeed);x=sample.x;y=sample.y;driving=sample.kind==='drive';}
   if(s.phase===F.RESULT&&s.result?.falls){const fall=s.result.falls.find(f=>f.tankId===t.id);if(fall){const k=J.clamp(elapsed*C.animationSpeed/Math.sqrt(2*fall.height/C.g),0,1);y=fall.from+(fall.to-fall.from)*k*k;}}
   const desired=this.publicBarrelAngle(s,t,visibleShot),previous=this.barrels[t.id]??desired;
   const delta=Math.atan2(Math.sin(desired-previous),Math.cos(desired-previous));
   const angle=t.id===(this.options.viewerId??0)||this.options.reduced||flightElapsed>=0?desired:previous+delta*(1-Math.exp(-dt*12));this.barrels[t.id]=angle;
   const firing=visibleShot?.weapon==='shell'&&visibleShot.attackerId===t.id&&s.phase===F.FLIGHT&&flightElapsed>=0;
   const recoil=firing&&!this.options.reduced?.65*Math.max(0,1-flightElapsed/.38):0;
   const shown=s.phase===F.MOVE&&move?{...t,hp:Math.max(0,t.hp-(move.falls||[]).filter(f=>elapsed*C.animationSpeed>=f.start+f.duration).reduce((sum,f)=>sum+f.damage,0))}:t;
   const overlap=s.tanks.some(other=>other.id!==t.id&&other.hp>0&&Math.abs(other.x-x)<C.tankWidth&&Math.abs(other.y-y)<C.tankHeight);
   c.save();if(overlap)c.translate((t.depth??t.id)*2,-(t.depth??t.id)*2);
   this.tank(shown,x,y,s.active===t.id,angle,driving,recoil);c.restore();
   if(!ui.menu&&s.active===t.id&&t.hp>0)this.activeMarker(t,x,y);
   if(!ui.menu&&s.phase===F.DEFEND&&game.defender?.id===t.id&&t.id===(this.options.viewerId??0)){const q=this.point(x,y+1.3);c.strokeStyle='#ffba89';c.lineWidth=3;c.beginPath();c.arc(q.x,q.y,Math.max(20,this.scale*3.5),0,Math.PI*2);c.stroke();}
  }
  if(s.phase===F.FLIGHT&&s.locked.weapon==='rock'&&!s.locked.airDrop&&flightElapsed<0)edgeTarget=this.materialize(s.locked,elapsed,timing.prep);
  if(s.phase===F.FLIGHT&&s.locked.weapon==='shell'&&flightElapsed>=0&&flightElapsed<.35)this.muzzleFlash(s.locked,flightElapsed);
  if(s.phase===F.FLIGHT&&s.locked.airDrop)this.plane(s.locked,elapsed*C.animationSpeed,flightElapsed<0);
  if(projectile){
   edgeTarget=projectile;const shot=s.locked,time=projectile.t;
   c.beginPath();let begun=false;
   for(const p of s.flight.points){if(p.t>time)break;if(p.t<time-.65)continue;const q=this.point(p.x,p.y);if(!begun){c.moveTo(q.x,q.y);begun=true;}else c.lineTo(q.x,q.y);}
   c.strokeStyle='#9dfaeadd';c.lineWidth=Math.max(3,this.scale*.2);if(shot.weapon==='shell')c.stroke();
   this.projectile(projectile,shot.weapon,shot.radius,false,shot.projectile);
  }
  if(s.phase===F.RESULT&&s.result?.action==='shield'){const t=s.tanks[s.result.actor],p=this.point(t.x,t.y+1.3);c.strokeStyle='#bcafff';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,(C.shieldRadius+Math.min(elapsed,.7)*4)*this.scale,0,Math.PI*2);c.stroke();}
  if(s.phase===F.RESULT&&s.result?.carrier)this.plane(s.result.carrier,s.result.carrier.impactTime+elapsed*C.animationSpeed,false);
  if(s.phase===F.RESULT&&s.result?.action==='attack')this.impact(s.result,elapsed);
  c.restore();if(s.worldVersion>=24)this.worldBorder();else this.scaleLegend();if(!ui.menu)this.drawTankHud();this.aimAnchor=null;if(showPreview&&s.draft.weapon==='shell'){const p=this.point(s.tanks[this.options.viewerId??0].x,s.tanks[this.options.viewerId??0].y);let x=J.clamp(p.x+42,96,w-148),y=J.clamp(p.y+12,72,h-118);if(x+124>w-300&&y+78>h-122)x=J.clamp(p.x-164,96,w-300-124);this.aimAnchor={x,y};}if(this.previewLabel)this.drawPreviewLabel();
  for(const t of s.tanks){if(t.hp<=0)continue;const x=this.point(t.x,t.y).x;
   if(x<15)this.text('← '+t.name,10,112+t.id*18,11,t.color);
   if(x>w-15)this.text(t.name+' →',w-10,112+t.id*18,11,t.color,'right');
  }
  if(s.worldVersion<24&&!ui.menu&&!ui.notice&&[F.LOCK,F.DEFEND,F.MOVE,F.FLIGHT].includes(s.phase))this.battleCaption(s,flightElapsed);
  if(s.worldVersion<24&&!ui.menu&&this.scale<5.8){const id=s.phase===F.DEFEND?game.defender?.id:s.active;this.tankInset(s.tanks[id]||s.tanks[this.options.viewerId??0]);}
  if(edgeTarget)this.offscreen(edgeTarget,s.locked.weapon==='rock'?'TOVOR':edgeTarget.y>this.worldHeight?'IZSTRELEK · '+(edgeTarget.vy>0?'SE DVIGA':'PADA'):'IZSTRELEK',s.locked.weapon==='rock'?'#ffcf91':'#a8fff1');
 }
 edgePosition(position){
  const p=this.point(position.x,position.y),w=this.width,h=this.height,tl=this.point(0,this.worldHeight),br=this.point(this.worldWidth,0);
  const left=Math.max(12,tl.x),right=Math.min(w-12,br.x),top=Math.max(12,tl.y),bottom=Math.min(h-12,br.y);
  if(p.x>=left&&p.x<=right&&p.y>=top&&p.y<=bottom)return null;
  return {x:J.clamp(p.x,88,w-88),y:J.clamp(p.y,Math.max(166,top+22),h-48),arrow:p.y<top?'↑':p.y>bottom?'↓':p.x<left?'←':'→'};
 }
 offscreen(position,label,color='#ffe4b4'){
  const p=this.edgePosition(position);if(!p)return;
  const caption=p.arrow+' '+label;this.ctx.font='bold 20px Trebuchet MS, Arial, sans-serif';
  const width=Math.min(this.width-24,(this.ctx.measureText?.(caption)?.width??caption.length*7.4)+24),x=J.clamp(p.x,width/2+12,this.width-width/2-12);
  this.rounded(x-width/2,p.y-21,width,42,10,'#102437f0',color);
  this.text(caption,x,p.y,20,color,'center');
 }
 tankInset(t){
  const c=this.ctx,x=12,y=136,w=142,h=118,old={scale:this.scale,left:this.left,top:this.top};
  c.save();this.rounded(x,y,w,h,10,'#102437e8',t.color);
  c.beginPath();c.rect(x+1,y+1,w-2,h-2);c.clip();
  this.text(t.name+' · POVEČAVA',x+w/2,y+16,10,t.color,'center');
  this.scale=12;this.left=t.x-(x+w/2)/12;this.top=t.y+(y+h-14)/12;
  this.tank(t,t.x,t.y,false,this.barrels[t.id]??.15,false,0,true);
  Object.assign(this,old);c.restore();
 }
 activeMarker(t,x,y){
  const c=this.ctx,p=this.point(x,y),yy=p.y-this.scale*8.6;
  c.fillStyle=t.color;c.beginPath();c.moveTo(p.x-6,yy-5);c.lineTo(p.x+6,yy-5);c.lineTo(p.x,yy+3);c.closePath();c.fill();
 }
 battleCaption(s,flightElapsed){
  const shot=s.locked,t=s.tanks[shot.attackerId];
  const width=Math.min(390,this.width-24),x=(this.width-width)/2,y=62;
  this.rounded(x,y,width,45,9,'#102437ee',t.color);
  const verb=s.phase===F.FLIGHT?(flightElapsed<0?(shot.weapon==='rock'?'PRIPRAVLJA SKALO':'MERI S TOPOM'):(shot.weapon==='rock'?'SKALA PADA':'STRELJA')):'PRIPRAVLJA NAPAD';
  this.text(t.name+' · '+(s.phase===F.DEFEND?'ODZIV OGROŽENIH':'NAPAD'),this.width/2,y+13,12,t.color,'center');
  this.text(verb,this.width/2,y+32,11,'#fff0d1','center');
 }
 materialize(shot,elapsed,prep){
  const c=this.ctx,p=this.point(shot.origin.x,shot.origin.y),progress=J.clamp(elapsed/.28,0,1);
  c.save();c.globalAlpha=progress;
  this.projectile(shot.origin,'rock',shot.radius);
  if(!this.options.reduced){c.strokeStyle='#affff0';c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,12+12*(1-progress),5+8*(1-progress),0,0,Math.PI*2);c.stroke();}
  c.restore();return shot.origin;
 }
 muzzleFlash(shot,t){
  const c=this.ctx,p=this.point(shot.origin.x,shot.origin.y),angle=-Math.atan2(shot.vy,shot.vx);
  c.save();c.translate(p.x,p.y);c.rotate(angle);c.globalAlpha=Math.max(0,1-t/.35);c.fillStyle='#ffe4a0';
  c.beginPath();c.moveTo(-2,-4);c.lineTo(19*(1-t/.5),0);c.lineTo(-2,4);c.closePath();c.fill();c.restore();
 }
 sky(state){
  const c=this.ctx,w=this.width,h=this.height,g=c.createLinearGradient(0,0,0,h);g.addColorStop(0,this.stageId===3?'#302c4c':this.stageId===2?'#163e43':'#173751');g.addColorStop(.58,this.stageId===3?'#735477':this.stageId===2?'#4b7d76':'#40738a');g.addColorStop(1,'#a7b9ab');c.fillStyle=g;c.fillRect(0,0,w,h);
  // Decorative sky remains independent of gameplay random state.
  for(let i=0;i<45;i++){const x=((i*73.37)%100)/100*w,y=((i*43.31)%100)/100*h*.57;c.fillStyle=`rgba(213,240,230,${.15+(i%4)*.1})`;c.beginPath();c.arc(x,y,i%5===0?1.5:.65,0,Math.PI*2);c.fill();}
  const px=w*.79,py=h*.24,r=Math.min(60,w*.07),pg=c.createRadialGradient(px-r*.4,py-r*.35,r*.15,px,py,r);pg.addColorStop(0,'#ffe0ad');pg.addColorStop(1,'#d3957a');c.fillStyle=pg;c.beginPath();c.arc(px,py,r,0,Math.PI*2);c.fill();
  c.strokeStyle='#ebc5a750';c.lineWidth=2;c.beginPath();c.ellipse(px,py,r*1.7,r*.25,-.3,0,Math.PI*2);c.stroke();
  c.fillStyle='#15395344';c.beginPath();c.arc(px+r*.35,py-r*.08,r*.86,0,Math.PI*2);c.fill();
  const base=this.point(0,24).y;
  for(let layer=0;layer<3;layer++){
   const y=base-40+layer*32;c.fillStyle=['#2f5e79','#355c72','#3e6574'][layer];c.beginPath();c.moveTo(0,h);
   for(let i=0;i<=16;i++){const x=i*w/16,peak=(Math.sin(i*3.7+layer*2)*.5+.5)*(65-layer*12);c.lineTo(x,y-peak);if(i%3===0)c.lineTo(x+w/40,y-peak);}
   c.lineTo(w,h);c.closePath();c.fill();
  }
  c.fillStyle='#f6ecdf12';for(let i=0;i<3;i++){const x=(i*.37+.04)*w,y=h*(.2+i*.12);c.beginPath();c.ellipse(x,y,80,6,0,0,Math.PI*2);c.fill();}
 }
 ground(terrain){
  const c=this.ctx,h=this.height,w=this.width;
  const path=(depth)=>{c.beginPath();c.moveTo(0,h+10);c.lineTo(0,this.point(0,terrain[0]-depth).y);for(let i=0;i<terrain.length;i++){const p=this.point(i*C.terrainStep,terrain[i]-depth);c.lineTo(p.x,p.y);}c.lineTo(w,this.point(P.width(terrain),terrain[terrain.length-1]-depth).y);c.lineTo(w,h+10);c.closePath();};
  const grad=c.createLinearGradient(0,this.point(0,25).y,0,h);grad.addColorStop(0,'#b1906a');grad.addColorStop(.2,'#887353');grad.addColorStop(1,'#3d4b50');path(0);c.fillStyle=grad;c.fill();
  for(const [dep,col] of [[2.1,'#716955'],[6,'#555c51'],[11,'#414f4e']]){path(dep);c.fillStyle=col;c.fill();c.strokeStyle='#d5b88b17';c.lineWidth=2;c.stroke();}
  c.beginPath();for(let i=0;i<terrain.length;i++){const p=this.point(i*C.terrainStep,terrain[i]);if(i===0)c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}c.strokeStyle='#d6cc91';c.lineWidth=Math.max(2,this.scale*.26);c.lineJoin='round';c.stroke();
  c.strokeStyle='#afbd893d';c.lineWidth=1;for(let i=0;i<85;i++){const x=(i*19.333)%P.width(terrain),y=P.height(terrain,x)-1.5-((i*7.717)%14),p=this.point(x,y);if(p.y>h)continue;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x+3+(i%4),p.y-1);c.stroke();}
  for(let i=0;i<16;i++){const x=(i*17.87+6)%P.width(terrain),y=P.height(terrain,x),p=this.point(x,y);c.strokeStyle='#d9c784';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-2,p.y-4);c.moveTo(p.x,p.y);c.lineTo(p.x+2,p.y-3);c.stroke();}
 }
 tank(tank,x,y,active,angle,moving,recoil=0,inset=false){
  const c=this.ctx,p=this.point(x,y),sc=this.scale,dead=tank.hp<=0;let color=dead?'#536573':tank.color;
  if(tank.shield>0&&!dead){const q=this.point(x,y+1.3),r=C.shieldRadius*sc;const g=c.createRadialGradient(q.x,q.y,r*.3,q.x,q.y,r);g.addColorStop(0,'#72e1d605');g.addColorStop(1,tank.id===0?'#88fff42a':'#ded5ff2a');c.fillStyle=g;c.beginPath();c.arc(q.x,q.y,r,0,Math.PI*2);c.fill();c.strokeStyle= tank.id===0?'#8ffff496':'#d6c6ff90';c.lineWidth=1.4;c.stroke();
   if(tank.shield<4000){c.beginPath();c.moveTo(q.x+r*.4,q.y-r*.8);c.lineTo(q.x+r*.1,q.y-r*.2);c.lineTo(q.x+r*.5,q.y);c.stroke();}
  }
  c.save();c.translate(p.x,p.y);const u=sc,type=tank.profileId||'medium',light=type==='light',heavy=type==='heavy';
  c.fillStyle='#142a3977';c.beginPath();c.ellipse(0,2,u*2.1,u*.38,0,0,Math.PI*2);c.fill();
  if(moving&&!this.options.reduced){for(let i=0;i<4;i++){c.fillStyle='#f0d5a64c';c.beginPath();c.arc((i-2)*u*1.4,u*.1-i*u*.25,u*(.3+i*.12),0,Math.PI*2);c.fill();}}
  this.rounded(-1.85*u,-.95*u,3.7*u,1.05*u,.4*u,'#132737','#829596');
  for(let i=heavy?-1.5:-1;i<=(heavy?1.5:1);i++){c.fillStyle='#4e6c79';c.beginPath();c.arc(i*u*1.15,-.44*u,.34*u,0,Math.PI*2);c.fill();c.fillStyle='#223943';c.beginPath();c.arc(i*u*1.15,-.44*u,.13*u,0,Math.PI*2);c.fill();}
  c.beginPath();c.moveTo(-1.8*u,-1.15*u);c.lineTo(-(light?.85:1.15)*u,-(light?1.75:2)*u);c.lineTo((light?.85:1.23)*u,-(light?1.75:2)*u);c.lineTo(1.8*u,-1.15*u);c.closePath();c.fillStyle=color;c.fill();c.strokeStyle='#142b39';c.lineWidth=Math.max(1,u*.1);c.stroke();
  this.rounded(-(light?.55:heavy?.96:.72)*u,-2.63*u,(light?1.2:heavy?2:1.6)*u,1.05*u,(heavy?.12:.35)*u,color,'#173240');
  if(heavy){for(const side of [-1,1])this.rounded(side*1.25*u-.26*u,-1.8*u,.52*u,.7*u,.08*u,'#b9b4c0','#233343');}else if(light){c.strokeStyle='#ffe6a1';c.lineWidth=Math.max(1,u*.12);c.beginPath();c.moveTo(-u,-1.4*u);c.lineTo(u,-1.4*u);c.stroke();}
  const length=C.barrelLength-recoil,px=C.barrelPivotX*u,py=-C.barrelPivotY*u;
  c.strokeStyle='#173341';c.lineWidth=.7*u;c.lineCap='round';c.beginPath();c.moveTo(px,py);c.lineTo(px+Math.cos(angle)*length*u,py-Math.sin(angle)*length*u);c.stroke();c.strokeStyle=dead?'#62717a':'#d5ecdf';c.lineWidth=.38*u;c.stroke();
  this.rounded(-1.1*u,-1.55*u,.9*u,.33*u,.1*u,'#173844');
  c.fillStyle=dead?'#677b82':'#f7ffcf';c.beginPath();c.arc(1.34*u,-1.31*u,.16*u,0,Math.PI*2);c.fill();
  c.strokeStyle='#91a9b0';c.lineWidth=1;c.beginPath();c.moveTo(-.6*u,-2.5*u);c.lineTo(-.95*u,-3.55*u);c.stroke();c.fillStyle=color;c.beginPath();c.arc(-.95*u,-3.55*u,Math.max(1.2,u*.13),0,Math.PI*2);c.fill();
  c.restore();
  if(inset)return;
  this.hudEntries?.push({tank,x,y,active});
  if(this.options.hitboxes){c.save();c.setLineDash([3,3]);c.strokeStyle='#fff8';c.lineWidth=1;if(tank.shield>0){const q=this.point(x,y+1.3);c.beginPath();c.arc(q.x,q.y,C.shieldRadius*sc,0,Math.PI*2);c.stroke();}else c.strokeRect(p.x-C.tankWidth/2*sc,p.y-C.tankHeight*sc,C.tankWidth*sc,C.tankHeight*sc);c.restore();}
 }
 drawTankHud(){
  const c=this.ctx,rects=[];this.hudRects=rects;
  for(const entry of this.hudEntries){
   const {tank,x,y,active}=entry,p=this.point(x,y),w=176,h=76;
   if(p.x<0||p.x>this.width)continue;
   let left=J.clamp(p.x-w/2,6,this.width-w-6),top=Math.max(128,p.y-Math.max(38,this.scale*4.2)-h);
   for(let tries=0;tries<5&&rects.some(r=>left<r.x+r.w+3&&left+w>r.x-3&&top<r.y+r.h+3&&top+h>r.y-3);tries++)top=top>h+135?top-h-5:p.y+12+tries*(h+4);
   top=J.clamp(top,125,this.height-h-8);rects.push({x:left,y:top,w,h});
   c.strokeStyle='#b9d2d555';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y-this.scale*3);c.lineTo(left+w/2,top+h);c.stroke();
   this.rounded(left,top,w,h,9,'#112b3af0',active?tank.color:'#6a8d9866');
   c.font='bold 18px Trebuchet MS, Arial, sans-serif';let label=tank.name+(tank.hp<=0?' ×':'');while(label.length>1&&(c.measureText?.(label)?.width??label.length*10)>w-16)label=label.slice(0,-2)+'…';this.text(label,left+8,top+17,18,tank.color);
   const hp=J.clamp(tank.hp/(tank.hpMax||100),0,1),shield=J.clamp(tank.shield/tank.shieldMax,0,1);
   for(const [label,value,ratio,color,dy] of [['HP',J.num(tank.hp,0),hp,'#73e5a2',40],['◇',J.energy(Math.max(0,tank.shield)),shield,'#b3a1ff',61]]){
    this.text(label,left+8,top+dy,16,color);this.rounded(left+37,top+dy-4,35,8,3,'#3e5363');if(ratio>0)this.rounded(left+37,top+dy-4,35*ratio,8,3,color);this.text(value,left+w-8,top+dy,16,'#eef8f9','right');
   }
  }
 }
 drawPreviewLabel(){
  const label=this.previewLabel,w=94,h=25,rects=this.hudRects||[];
  const xs=[label.x,label.x+36,label.x-w-30,label.x-w-66,this.width-w-8,8],ys=[label.y-h/2,...rects.map(r=>r.y-h-5),112];let spot=null;
  for(const y of ys){for(const x of xs){const box={x:J.clamp(x,8,this.width-w-8),y:J.clamp(y,110,this.height-h-65),w,h};
   if(!rects.some(r=>box.x<r.x+r.w+3&&box.x+w>r.x-3&&box.y<r.y+r.h+3&&box.y+h>r.y-3)){spot=box;break;}}
   if(spot)break;
  }
  if(spot){this.rounded(spot.x,spot.y,w,h,6,'#102437d9','#84cac2');this.text(label.text,spot.x+w/2,spot.y+h/2,12,'#d8ffef','center');}
 }
 previewPoints(preview,seconds){return seconds<=0||preview.shot.airDrop?[]:preview.guide.points.filter(p=>p.t<=seconds);}
 drawPreview(preview,seconds=Infinity){
  const c=this.ctx,shot=preview.shot,f=preview.guide,first=preview.flight.hit,intercept=first.type==='tank';
  if(shot.airDrop){this.airPlacement(shot);return;}
  if(seconds!==Infinity){
   const points=this.previewPoints(preview,seconds);
   if(points.length){c.save();c.setLineDash([5,6]);c.lineWidth=1.8;c.strokeStyle='#ffe3aadd';c.beginPath();points.forEach((p,i)=>{const q=this.point(p.x,p.y);if(i)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);});c.stroke();c.restore();}
   // Position and height of a rock are controls, not a predicted impact.
   if(shot.weapon==='rock')this.drawRockPlacement(shot);
   return;
  }
  c.save();c.lineWidth=1.8;c.setLineDash([5,6]);
  const drawPart=(after)=>{c.beginPath();let begun=false;
   for(const point of f.points){if(intercept&&(after?point.t<first.point.t:point.t>first.point.t))continue;
    const p=this.point(point.x,point.y);if(!begun){c.moveTo(p.x,p.y);begun=true;}else c.lineTo(p.x,p.y);}
   c.strokeStyle=after?'#ffe3aa55':'#ffe3aadd';c.stroke();
  };
  drawPart(false);if(intercept)drawPart(true);c.setLineDash([]);
  const end=f.hit.point,hit=this.point(end.x,end.y);c.strokeStyle='#ffd380';c.lineWidth=2;
  if(f.hit.type==='terrain'){
   c.beginPath();c.arc(hit.x,hit.y,8,0,Math.PI*2);c.moveTo(hit.x-13,hit.y);c.lineTo(hit.x+13,hit.y);c.moveTo(hit.x,hit.y-13);c.lineTo(hit.x,hit.y+13);c.stroke();
  }else if(f.hit.type==='boundary'){
   const label=(!shot.openSky&&end.y>=this.worldHeight-.1?'↑ ':end.x<this.worldWidth/2?'← ':'→ ')+'Izven bojišča',tl=this.point(0,shot.worldHeight||this.top),br=this.point(this.worldWidth,0),x=J.clamp(hit.x,Math.max(72,tl.x+70),Math.min(this.width-72,br.x-70)),y=J.clamp(hit.y,Math.max(30,tl.y+16),this.height-44);
   this.rounded(x-68,y-14,136,28,8,'#102437ee','#ffd380');this.text(label,x,y,11,'#ffe5b3','center');
  }else this.text('Pot se ni zaključila – spremeni nastavitev',this.width/2,120,11,'#ffd380','center');
  if(intercept){
   const p=this.point(first.point.x,first.point.y);c.strokeStyle='#fff0c9';c.beginPath();c.moveTo(p.x,p.y-9);c.lineTo(p.x+9,p.y);c.lineTo(p.x,p.y+9);c.lineTo(p.x-9,p.y);c.closePath();c.stroke();

  }

  if(shot.weapon==='rock'){
   const a=this.point(shot.origin.x,shot.origin.y),b=this.point(shot.origin.x,shot.referenceY),offset=18,visibleY=a.y;
   c.strokeStyle='#a1f0ec';c.beginPath();c.moveTo(a.x+offset,visibleY);c.lineTo(b.x+offset,b.y);c.moveTo(a.x+offset-4,visibleY);c.lineTo(a.x+offset+4,visibleY);c.moveTo(b.x+offset-4,b.y);c.lineTo(b.x+offset+4,b.y);c.stroke();
   this.previewLabel={text:'h = '+J.num(shot.height)+' m',x:a.x+offset+7,y:(visibleY+b.y)/2};this.projectile(shot.origin,'rock',C.rockRadius,true);this.offscreen(shot.origin,'SKALA · '+J.num(shot.height)+' m');
  }
  if((shot.openSky||!shot.worldHeight)&&shot.weapon==='shell'&&f.peak>this.worldHeight)this.offscreen(P.position(shot,Math.max(0,shot.vy/C.g)),'POT NAD POGLEDOM');
  c.restore();
 }
 drawRockPlacement(shot){
  const a=this.point(shot.origin.x,shot.origin.y);this.projectile(shot.origin,'rock',C.rockRadius,true);
  this.previewLabel={text:'h = '+J.num(shot.height)+' m',x:a.x+18,y:a.y+8};
 }
 plane(shot,time,carrying){
  const a=shot.airDrop,x=a.entryX+shot.vx*time,c=this.ctx,p=this.point(x,shot.origin.y+1.8),sc=Math.max(3,this.scale);
  if(x<-9||x>this.worldWidth+9)return;
  c.save();c.translate(p.x,p.y);c.scale(a.direction*sc,sc);c.fillStyle='#b9d5df';c.strokeStyle='#365868';c.lineWidth=.25;
  c.beginPath();c.moveTo(-4,0);c.lineTo(-2.8,-.7);c.lineTo(-3.7,-2.2);c.lineTo(-2.9,-2.2);c.lineTo(-1,-.7);c.lineTo(1,-.7);c.lineTo(-.7,-3.1);c.lineTo(.4,-3.1);c.lineTo(2.5,-.7);c.lineTo(4.4,-.3);c.lineTo(5,0);c.lineTo(3.8,.6);c.lineTo(1,.6);c.lineTo(-.3,2.7);c.lineTo(-1.3,2.7);c.lineTo(-.3,.6);c.lineTo(-3,.5);c.closePath();c.fill();c.stroke();
  c.fillStyle='#334f68';c.fillRect(2,-.5,1.3,.5);c.restore();
  if(carrying)this.projectile({x,y:shot.origin.y},'rock',shot.radius);
 }
 airPlacement(shot){
  const c=this.ctx,a=shot.airDrop,top=this.point(shot.targetX,shot.origin.y),base=this.point(shot.targetX,shot.altitude===undefined?shot.referenceY:0),ground=this.point(shot.targetX,shot.referenceY);
  c.save();c.strokeStyle='#ffcf92';c.fillStyle='#ffd18a22';c.lineWidth=3;c.setLineDash([5,6]);
  const left=shot.targetX-a.spread,right=shot.targetX+a.spread;
  // Terrain-following nominal band. Hills may intercept the cargo before this band.
  c.beginPath();for(let x=Math.max(0,left);x<=Math.min(shot.worldWidth,right)+.01;x+=.5){const p=this.point(x,J.Physics.height(this.terrainForAir||[],x));if(x===Math.max(0,left))c.moveTo(p.x,p.y);else c.lineTo(p.x,p.y);}c.stroke();
  c.beginPath();c.moveTo(top.x,top.y);c.lineTo(base.x,base.y);c.stroke();c.setLineDash([]);
  c.beginPath();c.moveTo(top.x-8,top.y);c.lineTo(top.x+8,top.y);c.moveTo(base.x-8,base.y);c.lineTo(base.x+8,base.y);c.stroke();
  const label=`h = ${J.num(shot.altitude??shot.height)} m · ${J.num(shot.mass)} kg`,w=300,x=J.clamp(top.x-w/2,12,this.width-w-12),y=J.clamp(top.y-70,128,this.height-120);
  this.rounded(x,y,w,86,8,'#102437ef','#ffcf92');this.text(label,x+w/2,y+17,20,'#ffe0ad','center');this.text('Nad tlemi: '+J.num(shot.height)+' m',x+w/2,y+44,19,'#d5e4e9','center');this.text('Približen raztros: ±'+J.num(a.spread)+' m',x+w/2,y+69,18,'#ffe0ad','center');
  c.restore();
 }

 tracePoints(trace){const cache=this.traceCache||(this.traceCache=new Map());if(!cache.has(trace.id))cache.set(trace.id,P.tracePoints(trace));return cache.get(trace.id);}
 drawTraces(traces){
  const c=this.ctx,selected=this.options.tracePinned||this.options.traceHover;
  for(const trace of traces){const strong=trace.id===selected;c.save();c.strokeStyle=strong?'#fff0a6':'#adfff080';c.lineWidth=strong?3.5:1.3;c.setLineDash(strong?[]:[4,5]);c.beginPath();
   this.tracePoints(trace).forEach((v,i)=>{const p=this.point(v.x,v.y);if(i)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);});c.stroke();
   if(strong){const p=this.point(trace.end.x,trace.end.y);c.setLineDash([]);c.beginPath();c.arc(p.x,p.y,7,0,Math.PI*2);c.stroke();}c.restore();
  }
 }
 traceAt(traces,clientX,clientY){
  const r=this.canvas.getBoundingClientRect(),p={x:clientX-r.left,y:clientY-r.top};let nearest=null,best=12;
  for(const trace of traces){const pts=this.tracePoints(trace);for(let i=1;i<pts.length;i++){
   const a=this.point(pts[i-1].x,pts[i-1].y),b=this.point(pts[i].x,pts[i].y),dx=b.x-a.x,dy=b.y-a.y,k=J.clamp(((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1),dist=Math.hypot(p.x-a.x-k*dx,p.y-a.y-k*dy);
   if(dist<best){best=dist;nearest=trace;}
  }}return nearest;
 }
 movement(tank,range,selected,bonus,state){
  const c=this.ctx,sc=this.scale,left=this.point(tank.x-range.left,tank.y),right=this.point(tank.x+range.right,tank.y),y=left.y+6;
  c.fillStyle=bonus>1?'#b6fbd034':'#69dacd2b';c.fillRect(left.x-2,left.y-4.4*sc,right.x-left.x+4,4.4*sc);
  c.strokeStyle=bonus>1?'#c8ff99':'#7df2d5';c.lineWidth=3;c.beginPath();c.moveTo(left.x,y);c.lineTo(right.x,y);c.stroke();
  for(const p of [left,right]){c.beginPath();c.moveTo(p.x,y-5);c.lineTo(p.x,y+5);c.stroke();}
  const path=state?P.movePath(state,tank,selected,bonus):null;
  if(path){c.strokeStyle='#ffe59b';c.lineWidth=2;c.beginPath();for(const segment of path.segments){const a=this.point(segment.from.x,segment.from.y),b=this.point(segment.to.x,segment.to.y);c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);}c.stroke();}
  const q=this.point(path?path.to:tank.x+selected,path?path.toY:tank.y);c.strokeStyle='#f8ffdb';c.setLineDash([3,3]);c.strokeRect(q.x-1.8*sc,q.y-2.8*sc,3.6*sc,2.8*sc);c.setLineDash([]);
  this.text('← '+J.num(range.left)+' m  |  '+J.num(range.right)+' m →',(left.x+right.x)/2,y+19,11,'#e7ffdc','center');
 }
 projectile(position,weapon,radius,ghost=false,kind='ball'){
  const c=this.ctx,p=this.point(position.x,position.y),r=Math.max(3,radius*this.scale);c.save();if(ghost)c.globalAlpha=.65;
  if(weapon==='rock'){
   c.translate(p.x,p.y);c.rotate((position.t||0)*1.3);c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=r*(i%2?.88:1.1);if(i===0)c.moveTo(Math.cos(a)*rr,Math.sin(a)*rr);else c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fillStyle='#d2baa2';c.strokeStyle='#675760';c.lineWidth=2;c.fill();c.stroke();c.fillStyle='#927f7b';c.beginPath();c.arc(-r*.3,-r*.15,r*.25,0,Math.PI*2);c.arc(r*.4,r*.2,r*.16,0,Math.PI*2);c.fill();
   c.save();c.strokeStyle='#ffe1aaa0';c.lineWidth=1;c.setLineDash([3,3]);c.beginPath();c.arc(0,0,Math.max(10,r+5),0,Math.PI*2);c.stroke();c.restore();
  }else{c.shadowColor='#8fffee';c.shadowBlur=10;c.fillStyle=kind==='rod'?'#d9e7ff':kind==='cone'?'#ffd495':'#efffb8';
   c.save();c.translate(p.x,p.y);c.rotate(-Math.atan2(position.vy||0,position.vx||1));c.beginPath();
   if(kind==='rod')c.roundRect(-r*2.3,-r*.55,r*4.6,r*1.1,1);
   else if(kind==='cone'){c.moveTo(r*2,0);c.lineTo(-r*1.3,-r);c.lineTo(-r*1.3,r);c.closePath();}
   else c.arc(0,0,r,0,Math.PI*2);c.fill();c.restore();}
  if(this.options.hitboxes){c.shadowBlur=0;c.strokeStyle='#fff';c.lineWidth=1;c.setLineDash([2,2]);c.beginPath();c.arc(weapon==='rock'?0:p.x,weapon==='rock'?0:p.y,radius*this.scale,0,Math.PI*2);c.stroke();}
  c.restore();
 }
 impact(result,elapsed){
  if(elapsed>1.7||result.hitType==='boundary')return;const c=this.ctx,p=this.point(result.point.x,result.point.y),t=elapsed,energy=result.energy;
  c.save();c.globalAlpha=Math.max(0,1-t/1.4);const radius=(8+Math.sqrt(energy/1000)*4)*Math.min(1,t*4+.1);
  c.strokeStyle=result.absorbed>0?'#a3fff3':'#ffd288';c.lineWidth=3;c.beginPath();c.arc(p.x,p.y,radius,0,Math.PI*2);c.stroke();
  if(!this.options.reduced)for(let i=0;i<16;i++){const a=i*2.399,r=radius*(.6+(i%5)*.16),xx=p.x+Math.cos(a)*r,yy=p.y+Math.sin(a)*r+t*t*20;c.fillStyle=i%2?'#ffd592':'#bcecd6';c.fillRect(xx,yy,3+(i%3),3+(i%3));}
  if(result.splash?.length||result.combatVersion>=29&&result.terrainEnergy>0){c.strokeStyle='#ffd48b';c.setLineDash([4,4]);c.beginPath();c.arc(p.x,p.y,(result.splashRadius||6)*this.scale,0,Math.PI*2);c.stroke();c.setLineDash([]);}
  this.text(result.absorbed>0&&result.absorbed>=(result.effectEnergy??energy)-.01?'ŠČIT ZADRŽI!':result.hitType==='tank'?'ZADETEK!':'KRATER',p.x,p.y-radius-15,Math.max(14,this.scale*1.7),'#ffe6b5','center');
  if(result.absorbed>0)this.text('Ščit −'+J.energy(result.absorbed),J.clamp(p.x,70,this.width-70),p.y-radius-37,12,'#bbfff6','center');
  if(result.damage>0)this.text('−'+J.num(result.damage,1)+' HP',J.clamp(p.x,50,this.width-50),p.y-radius-58,17,'#ffaf92','center');c.restore();
 }
 worldBorder(){
  const c=this.ctx,tl=this.point(0,this.worldHeight),br=this.point(this.worldWidth,0);
  c.fillStyle='#0d2335e8';c.fillRect(0,0,tl.x,this.height);c.fillRect(br.x,0,this.width-br.x,this.height);c.fillRect(tl.x,0,br.x-tl.x,tl.y);c.fillRect(tl.x,br.y,br.x-tl.x,this.height-br.y);
  c.strokeStyle='#b0cddd';c.lineWidth=1;c.strokeRect(tl.x,tl.y,br.x-tl.x,br.y-tl.y);
  for(let y=0;y<=this.worldHeight;y+=10){const p=this.point(0,y);c.beginPath();c.moveTo(p.x-4,p.y);c.lineTo(p.x,p.y);c.stroke();this.text(String(y),p.x-6,p.y,9,'#cee6eb','right','normal');}
  this.text('m',tl.x-7,Math.max(8,tl.y-9),9,'#cee6eb','right');
  for(let x=0;x<=this.worldWidth;x+=20){const p=this.point(x,0);this.text(String(x),p.x,p.y+12,9,'#cee6eb','center','normal');}
 }
 scaleLegend(){const c=this.ctx,sz=this.scale*10,x=this.width-20-sz,y=this.height-20;c.strokeStyle='#deebe2aa';c.lineWidth=1;c.beginPath();c.moveTo(x,y-3);c.lineTo(x,y+3);c.moveTo(x,y);c.lineTo(x+sz,y);c.moveTo(x+sz,y-3);c.lineTo(x+sz,y+3);c.stroke();this.text('10 m',x+sz/2,y-11,9,'#e9efde','center','normal');}
}
J.Renderer=Renderer;
})(globalThis);


/* ===== audio.js ===== */
(function(root){
'use strict';
const J=root.JD;
// Each effect has a deterministic private noise source, independent of game RNG.
const effects={
 cannon:{seconds:.65,bass:78,end:29,noise:.65,bright:1800},
 earth:{seconds:.8,bass:57,end:24,noise:.85,bright:1100},
 rockImpact:{seconds:1,bass:46,end:23,noise:.7,bright:750},
 shield:{seconds:.6,bass:340,end:120,noise:.12,bright:5000},
 shieldBreak:{seconds:.7,bass:230,end:60,noise:.7,bright:4500},
 portal:{seconds:.65,bass:280,end:760,noise:.25,bright:2500},
 bonus:{seconds:.5,bass:440,end:880,noise:0,bright:3000},
 wrong:{seconds:.25,bass:210,end:160,noise:0,bright:1000},
 win:{seconds:1.1,bass:440,end:880,noise:.015,bright:3000},
 lose:{seconds:.85,bass:280,end:130,noise:.03,bright:1000},
 land:{seconds:.45,bass:69,end:27,noise:.6,bright:900},
 warning:{seconds:.3,bass:470,end:380,noise:0,bright:2000},
 motor:{seconds:.5,bass:68,end:68,noise:.2,bright:420,loop:true},
 shellAir:{seconds:.5,bass:520,end:520,noise:.45,bright:1800,loop:true},
 rockAir:{seconds:.5,bass:86,end:86,noise:.7,bright:600,loop:true}
};
function samples(kind,rate=22050){
 const p=effects[kind]||effects.earth,n=Math.ceil(p.seconds*rate),out=new Float32Array(n);
 let rng=2166136261,low=0,phase=0;for(const c of kind)rng=Math.imul(rng^c.charCodeAt(0),16777619)>>>0;
 const smooth=1-Math.exp(-2*Math.PI*p.bright/rate);
 for(let i=0;i<n;i++){
  rng^=rng<<13;rng^=rng>>>17;rng^=rng<<5;
  const noise=(rng>>>0)/2147483648-1;low+=smooth*(noise-low);
  const t=i/rate,u=t/p.seconds;
  let frequency=p.bass*Math.pow(p.end/p.bass,u);
  if(kind==='bonus'||kind==='win'){const notes=kind==='win'?[1,1.25,1.5,2]:[1,1.25,1.5];frequency=p.bass*notes[Math.min(notes.length-1,Math.floor(u*notes.length))];}
  phase+=2*Math.PI*frequency/rate;
  let envelope=p.loop?.48:Math.min(1,t/.012)*Math.pow(1-u,1.6)*Math.exp(-u*(kind==='cannon'?3:.8));
  if(p.loop)envelope*=.8+.2*Math.sin(2*Math.PI*8*t);
  const tone=(Math.sin(phase)+.25*Math.sin(phase*2))*.38;
  let value=(tone+low*p.noise*.7)*envelope;
  if(!p.loop&&['cannon','earth','rockImpact','land'].includes(kind))value+=low*.12*Math.exp(-(((t-.045)/.025)**2));
  out[i]=value;
 }
 if(p.loop){const edge=Math.min(256,Math.floor(n/10));for(let i=0;i<edge;i++){const a=i/edge;out[n-edge+i]=out[n-edge+i]*(1-a)+out[i]*a;}}
 return out;
}
class Sound {
 constructor(enabled=true){this.enabled=enabled;this.context=null;this.master=null;this.ready=false;this.voices=new Set();this.events=new Set();this.buffers=new Map();this.currentLoop=null;}
 unlock(){
  if(!this.enabled)return;
  try{
   if(!this.context){const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)return;this.context=new Audio();this.master=this.context.createGain();this.master.gain.value=.38;const limiter=this.context.createDynamicsCompressor();limiter.threshold.value=-12;limiter.ratio.value=8;this.master.connect(limiter);limiter.connect(this.context.destination);}
   this.ready=this.context.state==='running';
   const promise=this.context.resume();promise?.then(()=>{this.ready=true;}).catch(()=>{this.ready=false;});
  }catch(e){this.ready=false;}
 }
 buffer(kind){
  if(!this.buffers.has(kind)){const data=samples(kind,this.context.sampleRate),buffer=this.context.createBuffer(1,data.length,this.context.sampleRate);buffer.getChannelData(0).set(data);this.buffers.set(kind,buffer);}
  return this.buffers.get(kind);
 }
 play(kind,loop=false){
  if(!this.enabled||!this.context||!this.ready)return null;
  try{
   if(this.voices.size>10){const oldest=this.voices.values().next().value;oldest.stop();this.voices.delete(oldest);}
   const source=this.context.createBufferSource();source.buffer=this.buffer(kind);source.loop=loop;source.connect(this.master);this.voices.add(source);source.onended=()=>{this.voices.delete(source);source.disconnect();};source.start();return source;
  }catch(e){return null;}
 }
 once(key,kind){if(this.events.has(key))return;this.events.add(key);if(this.events.size>256)this.events.delete(this.events.values().next().value);this.play(kind);}
 loop(kind){
  if(this.currentLoop?.kind===kind&&this.currentLoop.source)return;
  if(this.currentLoop?.source){try{this.currentLoop.source.stop();}catch(e){}this.voices.delete(this.currentLoop.source);}
  this.currentLoop=kind?{kind,source:this.play(kind,true)}:null;
 }
 pause(){this.currentLoop=null;for(const source of this.voices){try{source.stop();}catch(e){}}this.voices.clear();}
 setEnabled(enabled){this.enabled=enabled;if(!enabled)this.pause();else this.unlock();}
}
Sound.samples=samples;Sound.effects=effects;J.Sound=Sound;
})(globalThis);


