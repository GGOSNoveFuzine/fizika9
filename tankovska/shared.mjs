/* ===== config.js ===== */
/* Tankovska bitka 0.3 — all gameplay values use SI. No runtime dependencies. */
(function(root){
'use strict';
const J=root.JD=root.JD||{};
J.VERSION='0.3';
J.C=Object.freeze({
 g:10, worldWidth:120, battleWidth:180, launchStroke:2, worldHeight:90, bedrock:3, terrainStep:0.2, shotStep:1/90, sweepLength:0.16,
 maxFlightTime:40, animationSpeed:3, tankWidth:3.4, tankHeight:2.6, tankMass:800,
 shieldRadius:2.8, shotRadius:0.25, rockRadius:0.72, moveTime:2, resistance:4000/3, airSpeed:12, airScatterBase:6, airScatterHeight:.30, airHPFactor:.40, airShieldFactor:.10, airClearance:6,
 hp:100, initialShield:10000, shieldMax:30000,
 criticalChance:.75, criticalMultiplier:1.5, weakChance:.25, weakMultiplier:.5,
 power:4000, bonus:1.5, shieldRecharge:16000,
 initialCredits:60, creditsMax:150, turnCredits:15, saveCredits:10,
 creditsPerKJ:1, creditPrecision:1000, shieldCredits:1, dangerRadius:4,
 barrelLength:3.8, barrelPivotX:.2, barrelPivotY:2.3,
 cameraMinZoom:.8, cameraWorldMargin:1.1, cameraMobileSpan:76, cameraSkyHeight:70,
 hpJoules:450, splashRadius:8, splashShare:.1, splashMaxHP:6, directTerrainShare:0.12, fallJoules:4000,
 craterEnergyScale:14000, craterRadiusMax:8, craterDepthMax:6,
 maxRockHeight:90, masses:[20,40,80], rockMasses:[50,100,200],
 angleMin:5, angleMax:85, defaultAngle:45, materializeTime:.65,
 forceMin:2000, forceStep:1000,
 heightMin:10, heightBaseMax:60, seed:'JOULE-9', storageKey:'joulski-dvoboj-v1'
});
J.PROFILES=Object.freeze({
 player:{label:'Tvoj tank',hp:100,shield:10000,power:4000},
 light:{label:'Lahek',hp:80,shield:6000,power:4000},
 medium:{label:'Srednji',hp:100,shield:10000,power:4000},
 heavy:{label:'Težki',hp:130,shield:18000,power:5000}
});
J.PROJECTILES=Object.freeze({
 ball:{label:'Jeklena krogla',fee:2,factor:1,glyph:'●',description:'Osnovni izstrelek; običajna poškodba telesa.'},
 cone:{label:'Konični izstrelek',fee:6,factor:1.2,glyph:'◆',description:'Probojna oblika; ×1,2 poškodbe telesa po ščitu.'},
 rod:{label:'Volframova palica',fee:10,factor:1.5,glyph:'━',description:'×1,5 HP škode po izpraznitvi ščita. Računski bonus velja tudi proti ščitu.'},
 rock:{label:'Letalski spust',fee:20,factor:1,glyph:'⬡',description:'Velik raztros. Šibek proti ščitu. Višina in cena dviga se merita od skupne ravni 0 m.'}
});
J.STAGES=Object.freeze({
 1:{name:'Planota',subtitle:'Spoznaj areno',enemies:['light','light'],names:['BOLT','ISKRA'],heights:[19,24,19],platforms:[[5,31],[48,73],[89,115]],previewSeconds:Infinity,ai:{angleError:7,forceNoise:.4,blunderChance:.35,rockScatter:12,rockChance:.10,correction:.35,stayChance:.75,questionChance:.04},mode:'challenge'},
 2:{name:'Greben',subtitle:'Višina in taktika',enemies:['light','medium'],names:['BOLT','VEKTOR'],heights:[19,31,23],platforms:[[9,28],[53,69],[94,112]],previewSeconds:.5,ai:{angleError:5,forceNoise:.30,blunderChance:.22,rockScatter:8,rockChance:.15,correction:.4,stayChance:.60,questionChance:.18},mode:'challenge'},
 3:{name:'Kotlina',subtitle:'Končni boj',enemies:['medium','heavy'],names:['VEKTOR','TITAN'],heights:[25,17,34],platforms:[[11,26],[54,67],[96,110]],previewSeconds:0,ai:{angleError:3,forceNoise:.22,blunderChance:.15,rockScatter:3.5,rockChance:.22,correction:.6,stayChance:.45,questionChance:.42},mode:'challenge'}
});
J.previewSeconds=id=>(J.STAGES[id]||J.STAGES[1]).previewSeconds;
J.aiSettings=(id,version=26)=>version>=26?(J.STAGES[id]||J.STAGES[1]).ai:{angleError:[0,3,1.5,.5][id]||.5,forceNoise:[0,.22,.12,.06][id]||.06,blunderChance:[0,.2,.1,.05][id]||.05,rockScatter:[0,9,6,3.5][id]||3.5,rockChance:[0,.14,.18,.22][id]||.22,correction:1,stayChance:.45,questionChance:[0,.08,.25,.42][id]||.42};
J.PHASE=Object.freeze({PREP:'PRIPRAVA',LOCK:'NAPAD_ZAKLENJEN',DEFEND:'OBRAMBA',MOVE:'PREMIK',FLIGHT:'LET_ALI_PADEC',RESULT:'POSLEDICE',NEXT:'NASLEDNJA_POTEZA',END:'KONEC_BOJA'});
J.playerName=s=>Array.from(String(s??'').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g,'').trim()).slice(0,18).join('')||'Igralec';
J.clone=o=>JSON.parse(JSON.stringify(o));
J.freeze=o=>{if(o&&typeof o==='object'){Object.freeze(o);Object.values(o).forEach(v=>{if(v&&typeof v==='object'&&!Object.isFrozen(v))J.freeze(v);});}return o;};
J.clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
J.seed=s=>{let n=2166136261;for(const c of String(s)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;};
J.random=state=>{state.rng=(state.rng+0x6D2B79F5)>>>0;let t=state.rng;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;};
J.num=(v,d=1)=>Number(v).toLocaleString('sl-SI',{maximumFractionDigits:d});
J.money=v=>String(Math.round(v*1000)).replace(/\B(?=(\d{3})+(?!\d))/g,'.')+' €';
J.energy=v=>Math.abs(v)>=1000?J.num(v/1000,2)+' kJ':J.num(v,1)+' J';
J.Economy=Object.freeze({
 itemPrice(projectile='ball',mass=40){return J.Economy.money(J.PROJECTILES[projectile].fee*(projectile==='rock'?1:mass/40));},
 forceLimit(credits,projectile='ball',mass=40){return Math.max(0,Math.floor(((credits-J.Economy.itemPrice(projectile,mass))*1000/J.C.creditsPerKJ/J.C.launchStroke+1e-7)/J.C.forceStep)*J.C.forceStep);},
 money(value){return Math.round(value*J.C.creditPrecision)/J.C.creditPrecision;},
 energyPrice(joules){return J.Economy.money(joules/1000*J.C.creditsPerKJ);},
 quote(weapon,baseEnergy,projectile='ball',mass=40){
  const kind=weapon==='rock'?'rock':projectile,item=J.Economy.itemPrice(kind,mass),energy=J.Economy.energyPrice(baseEnergy);
  return {baseEnergy,projectile:kind,item,energy,total:J.Economy.money(item+energy)};
 },
 income(current,amount,cap=J.C.creditsMax){return J.Economy.money(Math.max(0,Math.min(amount,cap-current)));},
 debit(tank,cost){if(!Number.isFinite(cost)||cost<0||tank.credits+1e-7<cost)throw Error('Premalo denarja.');tank.credits=J.Economy.money(tank.credits-cost);}
});
J.attackEffect=(status,roll)=>{const kind=status==='correct'&&roll<J.C.criticalChance?'critical':status==='wrong'&&roll<J.C.weakChance?'weak':'normal';return {kind,multiplier:kind==='critical'?J.C.criticalMultiplier:kind==='weak'?J.C.weakMultiplier:1,roll};};
J.resultDelay=r=>r?.action==='attack'?Math.max(.7,r.carrier?((r.carrier.vx>0?r.carrier.worldWidth+7-r.carrier.airDrop.entryX:r.carrier.airDrop.entryX+7)/J.C.airSpeed-r.carrier.impactTime)/J.C.animationSpeed:0,...(r.falls||[]).map(f=>Math.sqrt(2*f.height/J.C.g)/J.C.animationSpeed+.2)):.7;
// Presentation time is independent of physical time; rate stays constant throughout a flight.
J.attackTiming=(shot,flight)=>{if(shot.airDrop){const prep=shot.airDrop.dropTime/J.C.animationSpeed,flightSeconds=flight.duration/J.C.animationSpeed;return {prep,flightSeconds,total:prep+flightSeconds,rate:J.C.animationSpeed};}const prep=shot.weapon==='rock'?J.C.materializeTime:(shot.attackerId===0?.12:.45),flightSeconds=J.clamp(flight.duration/J.C.animationSpeed,1.35,3);return {prep,flightSeconds,total:prep+flightSeconds,rate:flight.duration/flightSeconds};};
})(typeof globalThis!=='undefined'?globalThis:this);


/* ===== physics.js ===== */
(function(root){
'use strict';
const J=root.JD,C=J.C,P=J.Physics={};
P.work=(force,distance)=>force*distance;
P.kinetic=(mass,speed)=>mass*speed*speed/2;
P.potential=(mass,height)=>mass*C.g*height;
P.speed=(energy,mass)=>Math.sqrt(2*energy/mass);
P.power=(work,time)=>work/time;
P.movement=(power,time=C.moveTime,force=C.resistance)=>power*time/force;
P.absorb=(energy,shield)=>({absorbed:Math.min(energy,shield),excess:Math.max(0,energy-shield)});
P.impactAbsorb=(energy,shield,shot)=>{
 const air=shot?.airDrop&&shot.combatVersion>=30,shieldFactor=air?C.airShieldFactor:1,hpFactor=air?C.airHPFactor:1;
 const absorbed=Math.min(shield,energy*shieldFactor),stopped=absorbed/shieldFactor;
 return {absorbed,stopped,excess:Math.max(0,energy-stopped),hpFactor,shieldFactor};
};
P.position=(shot,t)=>({x:shot.origin.x+shot.vx*t,y:shot.origin.y+shot.vy*t-C.g*t*t/2,vx:shot.vx,vy:shot.vy-C.g*t,t});
P.width=terrain=>(terrain.length-1)*C.terrainStep;
P.terrain=function(seed,stageId=1,width=C.worldWidth){
 const s={rng:J.seed(seed+'-teren')}, phase=J.random(s)*6.28,stage=J.STAGES[stageId]||J.STAGES[1];
 const out=[];
 for(let i=0;i<=Math.round(width/C.terrainStep);i++){
  const x=i*C.terrainStep*C.worldWidth/width;
  let y=18+4*Math.sin(x*0.095+phase)+3*Math.cos(x*.19);
  if(x>=5&&x<=31)y=19;
  else if(x>=48&&x<=73)y=24;
  else if(x>=89&&x<=115)y=19;
  else if(x>31&&x<48)y=19+(x-31)*5/17+10*Math.sin((x-31)/17*Math.PI);
  else if(x>73&&x<89)y=24-(x-73)*5/16+8*Math.sin((x-73)/16*Math.PI);
  if(stageId>1){
   const ps=stage.platforms,ys=stage.heights;
   y=ys[0];
   if(x<ps[0][0])y=ys[0]-Math.min(6,(ps[0][0]-x)*.45);
   else if(x>ps[2][1])y=ys[2]-Math.min(8,(x-ps[2][1])*.6);
   else for(let n=0;n<3;n++){
    if(x>=ps[n][0]&&x<=ps[n][1]){y=ys[n];break;}
    if(n<2&&x>ps[n][1]&&x<ps[n+1][0]){const q=(x-ps[n][1])/(ps[n+1][0]-ps[n][1]);y=ys[n]+(ys[n+1]-ys[n])*q+(stageId===3?-12:8)*Math.sin(Math.PI*q);break;}
   }
  }
  out.push(Math.max(C.bedrock+2,y));
 }
 return out;
};
P.height=(terrain,x)=>{const u=J.clamp(x,0,P.width(terrain))/C.terrainStep,i=Math.min(terrain.length-2,Math.floor(u));return terrain[i]+(terrain[i+1]-terrain[i])*(u-i);};
P.support=(terrain,x)=>{let y=-Infinity;for(let d=-C.tankWidth/2;d<=C.tankWidth/2+.001;d+=.1)y=Math.max(y,P.height(terrain,x+d));return y;};
P.flatAt=(terrain,x,y)=>{for(let d=-C.tankWidth/2;d<=C.tankWidth/2+.001;d+=.1)if(Math.abs(P.height(terrain,x+d)-y)>.12)return false;return true;};
P.moveResistance=version=>version>=28?C.resistance:2000;
P.moveBudget=function(tank,bonus=1,version=28){
 const available=tank.legacyMoveEnergy??tank.credits*1000/C.creditsPerKJ;
 const base=Math.min(available,tank.power*C.moveTime),extra=(version>=25?base:tank.power*C.moveTime)*(bonus-1);
 return {maximum:(base+extra)/P.moveResistance(version),baseBudget:base,bonusBudget:extra};
};
// One quote powers the invoice, payment and bonus accounting.
P.moveQuote=function(state,tank,distance,bonus=1){
 const budget=P.moveBudget(tank,bonus,state.moveVersion||24),resistance=P.moveResistance(state.moveVersion||24),total=resistance*Math.abs(distance);
 const baseUsed=(state.moveVersion||24)>=25?total/bonus:Math.min(total,budget.baseBudget),bonusUsed=total-baseUsed;
 return {baseUsed,bonusUsed,credits:J.Economy.energyPrice(baseUsed),paidDistance:baseUsed/resistance,bonusDistance:bonusUsed/resistance};
};
// Motor time and gravitational fall time are separate. No powered climbing.
P.movePath=function(state,tank,distance,bonus=1){
 const budget=P.moveBudget(tank,bonus,state.moveVersion||24),wanted=Math.min(Math.abs(distance),budget.maximum),sign=Math.sign(distance)||1;
 let x=tank.x,y=tank.y,time=0,travelled=0,hp=tank.hp;const segments=[],falls=[];
 const motorSpeed=wanted/C.moveTime||1;
 let blocked=null;
 while(travelled<wanted-1e-7){
  const step=Math.min(.1,wanted-travelled),nx=tank.x+sign*(travelled+step),ny=P.support(state.terrain,nx);
  if(nx<C.tankWidth/2+.3-1e-7||nx>P.width(state.terrain)-C.tankWidth/2-.3+1e-7){blocked='rob';break;}
  if(ny>y+.12){blocked='vzpon';break;}
  if(state.legacyAttack&&state.tanks.some(t=>t.id!==tank.id&&t.hp>0&&Math.abs(t.x-nx)<C.tankWidth+.6&&Math.min(y,ny)<t.y+C.tankHeight+.2&&y+C.tankHeight>t.y-.2)){blocked='tank';break;}
  const duration=step/motorSpeed;
  segments.push({kind:'drive',from:{x,y},to:{x:nx,y},start:time,duration});time+=duration;x=nx;travelled+=step;
  if(y-ny>.12||travelled>=wanted-1e-7&&y-ny>1e-6){
   const height=y-ny,energy=C.tankMass*C.g*height,damage=energy/C.fallJoules,duration=Math.sqrt(2*height/C.g);
   segments.push({kind:'fall',from:{x,y},to:{x,y:ny},start:time,duration});
   falls.push({tankId:tank.id,from:y,to:ny,x,height,energy,damage,start:time,duration});time+=duration;y=ny;hp-=damage;
   if(hp<=0){blocked='izločen';break;}
  }
 }
 return {from:tank.x,fromY:tank.y,to:x,toY:y,distance:Math.round(sign*travelled*1e9)/1e9,segments,falls,duration:time||.15,blocked,complete:Math.abs(travelled-Math.abs(distance))<1e-6};
};
P.moveRange=function(state,tank,bonus=1){
 const budget=P.moveBudget(tank,bonus,state.moveVersion||24);
 const left=P.movePath(state,tank,-budget.maximum,bonus),right=P.movePath(state,tank,budget.maximum,bonus);
 return {...budget,left:Math.floor((Math.abs(left.distance)+1e-6)*10)/10,right:Math.floor((right.distance+1e-6)*10)/10};
};
P.moveSample=function(move,time){
 if(!move.segments)return {x:move.from+(move.to-move.from)*J.clamp(time/(move.duration||C.moveTime),0,1),y:move.y,kind:'drive'};
 const segment=move.segments.find(q=>time<q.start+q.duration);
 if(!segment)return {x:move.to,y:move.toY,kind:'done'};
 const k=J.clamp((time-segment.start)/segment.duration,0,1),v=segment.kind==='fall'?k*k:k;
 return {x:segment.from.x+(segment.to.x-segment.from.x)*k,y:segment.from.y+(segment.to.y-segment.from.y)*v,kind:segment.kind};
};
P.launchAngle=function(tank,speed,degrees,direction=1){
 const angle=degrees*Math.PI/180,ux=direction*Math.cos(angle),uy=Math.sin(angle);
 return {origin:{x:tank.x+C.barrelPivotX+C.barrelLength*ux,y:tank.y+C.barrelPivotY+C.barrelLength*uy},vx:speed*ux,vy:speed*uy,angle};
};
P.solve=function(origin,target,speed,arc='low'){
 const dx=target.x-origin.x,dy=target.y-origin.y,d=Math.abs(dx),v2=speed*speed;
 if(d<.2||!Number.isFinite(speed)||speed<=0)return null;
 const discriminant=v2*v2-C.g*(C.g*d*d+2*dy*v2);
 if(discriminant<0)return null;
 const angle=Math.atan((v2+(arc==='high'?1:-1)*Math.sqrt(discriminant))/(C.g*d));
 return {vx:Math.sign(dx)*speed*Math.cos(angle),vy:speed*Math.sin(angle),angle};
};
P.launch=function(tank,target,speed,arc='low'){
 const pivot={x:tank.x+C.barrelPivotX,y:tank.y+C.barrelPivotY},dx=target.x-pivot.x,d=Math.abs(dx),dy=target.y-pivot.y,L=C.barrelLength;
 if(d<=L+.1||!Number.isFinite(speed)||speed<=0)return null;
 // Solve from the rotating muzzle, not from a fixed point beside the tank.
 const residual=a=>d*Math.tan(a)-C.g*(d/Math.cos(a)-L)**2/(2*speed*speed)-dy;
 const lower=-Math.PI/2+.00001,upper=Math.PI/2-.00001;
 let lo=lower,hi=upper;
 for(let i=0;i<90;i++){const a=lo+(hi-lo)/3,b=hi-(hi-lo)/3;if(residual(a)<residual(b))lo=a;else hi=b;}
 const peak=(lo+hi)/2;if(residual(peak)<-1e-8)return null;
 lo=arc==='high'?peak:lower;hi=arc==='high'?upper:peak;
 for(let i=0;i<65;i++){const mid=(lo+hi)/2;if((residual(mid)>0)===(arc==='high'))lo=mid;else hi=mid;}
 const angle=(lo+hi)/2,ux=Math.sign(dx)*Math.cos(angle),uy=Math.sin(angle);
 return {origin:{x:pivot.x+L*ux,y:pivot.y+L*uy},vx:speed*ux,vy:speed*uy,angle};
};
function circle(a,b,c,r){
 const dx=b.x-a.x,dy=b.y-a.y,ox=a.x-c.x,oy=a.y-c.y,A=dx*dx+dy*dy,B=2*(ox*dx+oy*dy),D=ox*ox+oy*oy-r*r;
 if(D<=0)return 0;if(A<1e-18)return null;const disc=B*B-4*A*D;if(disc<0)return null;
 const f=(-B-Math.sqrt(disc))/(2*A);return f>=0&&f<=1?f:null;
}
function box(a,b,l,r,bottom,top){
 let lo=0,hi=1;
 for(const [p,d,mn,mx] of [[a.x,b.x-a.x,l,r],[a.y,b.y-a.y,bottom,top]]){
  if(Math.abs(d)<1e-12){if(p<mn||p>mx)return null;continue;}
  let s=(mn-p)/d,e=(mx-p)/d;if(s>e)[s,e]=[e,s];lo=Math.max(lo,s);hi=Math.min(hi,e);if(lo>hi)return null;
 }
 return lo;
}
function cross(a,b,c,d){
 const rx=b.x-a.x,ry=b.y-a.y,sx=d.x-c.x,sy=d.y-c.y,det=rx*sy-ry*sx;
 if(Math.abs(det)<1e-12)return null;
 const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/det,u=((c.x-a.x)*ry-(c.y-a.y)*rx)/det;
 return t>=0&&t<=1&&u>=0&&u<=1?t:null;
}
P.firstCollision=function(a,b,shot,terrain,tanks){
 let best=null;const accept=(f,type,id)=>{if(f!==null&&f>=0&&f<=1&&(!best||f<best.f-1e-9))best={f,type,id};};
 // Frontmost depth wins an exact tie, matching the stable back-to-front drawing order.
 const ordered=shot.legacyRules?tanks:[...tanks].sort((a,b)=>(b.depth??b.id)-(a.depth??a.id));
 for(const tank of ordered){if(tank.hp<=0)continue;
  // The muzzle is outside the owner's collision envelope; the return path may hit it.
  if(tank.shield>0)accept(circle(a,b,{x:tank.x,y:tank.y+1.3},C.shieldRadius+shot.radius),'tank',tank.id);
  else accept(box(a,b,tank.x-C.tankWidth/2-shot.radius,tank.x+C.tankWidth/2+shot.radius,tank.y-shot.radius,tank.y+C.tankHeight+shot.radius),'tank',tank.id);
 }
 if(a.x>=0&&a.x<=P.width(terrain)&&a.y-shot.radius<=P.height(terrain,a.x))accept(0,'terrain',null);
 const start=Math.max(0,Math.floor(Math.min(a.x,b.x)/C.terrainStep)-1),end=Math.min(terrain.length-2,Math.ceil(Math.max(a.x,b.x)/C.terrainStep)+1);
 for(let i=start;i<=end;i++)accept(cross(a,b,{x:i*C.terrainStep,y:terrain[i]+shot.radius},{x:(i+1)*C.terrainStep,y:terrain[i+1]+shot.radius}),'terrain',null);
 if(a.x<0||a.x>P.width(terrain)){const entering=shot.combatVersion>=30&&shot.airDrop&&((a.x<0&&shot.vx>0)||(a.x>P.width(terrain)&&shot.vx<0));if(!entering)accept(0,'boundary',null);}
 if(shot.worldHeight){
  if(a.y<0||!shot.openSky&&a.y>shot.worldHeight)accept(0,'boundary',null);
  for(const y of (shot.openSky?[0]:[0,shot.worldHeight]))if((b.y<y&&a.y>=y)||(b.y>y&&a.y<=y))accept((y-a.y)/(b.y-a.y),'boundary',null);
 }
 for(const x of [0,P.width(terrain)]){const crossing=(b.x<x&&a.x>=x)||(b.x>x&&a.x<=x);const leaving=x===0?b.x<0:b.x>P.width(terrain);if(crossing&&(!(shot.combatVersion>=30&&shot.airDrop)||leaving))accept((x-a.x)/(b.x-a.x),'boundary',null);}
 if(b.y<C.bedrock-4)accept((C.bedrock-4-a.y)/(b.y-a.y),'boundary',null);
 return best;
};
P.simulate=function(shot,terrain,tanks){
 const points=[P.position(shot,0)];let t=0,a=points[0],peak=a.y;
 // Bound an open-sky flight by its return below the world, not by its apex.
 const bottom=C.bedrock-4,returnTime=(shot.vy+Math.sqrt(shot.vy**2+2*C.g*Math.max(0,a.y-bottom)))/C.g;
 const timeLimit=shot.openSky?Math.max(C.maxFlightTime,returnTime+C.shotStep):C.maxFlightTime;
 while(t<timeLimit){
  const speed=Math.hypot(a.vx,a.vy),dt=Math.min(C.shotStep,C.sweepLength/Math.max(1,speed),timeLimit-t);
  const b=P.position(shot,t+dt),hit=P.firstCollision(a,b,shot,terrain,tanks);
  if(hit){const tt=t+dt*hit.f,p=P.position(shot,tt);points.push(p);return {points,hit:{...hit,point:p,speed:Math.hypot(p.vx,p.vy),energy:P.kinetic(shot.mass,Math.hypot(p.vx,p.vy))},duration:tt,peak};}
  t+=dt;a=b;peak=Math.max(peak,a.y);points.push(a);
 }
 return {points,hit:{type:'timeout',id:null,point:a,speed:Math.hypot(a.vx,a.vy),energy:P.kinetic(shot.mass,Math.hypot(a.vx,a.vy))},duration:t,peak};
};
// Used only by an intentional pointer gesture. Changing power never invokes this solver.
P.aimAt=function(tank,target,speed,currentAngle){
 const solutions=['low','high'].map(arc=>P.launch(tank,target,speed,arc)).filter(v=>v&&v.angle*180/Math.PI>=C.angleMin-1e-6&&v.angle*180/Math.PI<=C.angleMax+1e-6);
 solutions.sort((a,b)=>Math.abs(a.angle*180/Math.PI-currentAngle)-Math.abs(b.angle*180/Math.PI-currentAngle));
 return solutions.length?{angle:J.clamp(solutions[0].angle*180/Math.PI,C.angleMin,C.angleMax),direction:Math.sign(target.x-tank.x-C.barrelPivotX)}:null;
};
P.threats=function(shot,state,guide=P.simulate(shot,state.terrain,[])){
 const candidates=new Set(),impacts=[],direct=[],effect=shot.combatVersion>=27?(shot.effect?.multiplier||1):1,terrainShare=shot.combatVersion>=27?1-C.splashShare:1;
 if(guide.hit.type==='terrain')impacts.push({point:guide.hit.point,terrainEnergy:guide.hit.energy*effect*terrainShare});
 for(const tank of state.tanks){
  if(tank.hp<=0)continue;
  const h=P.simulate(shot,state.terrain,[tank]).hit;
  if(h.type==='tank'){direct.push(tank.id);candidates.add(tank.id);impacts.push({point:h.point,terrainEnergy:P.impactAbsorb(h.energy*effect,tank.shield,shot).excess*C.directTerrainShare*terrainShare});}
 }
 for(const impact of impacts){
  const changed=state.terrain.slice();if(impact.terrainEnergy>0)P.crater(changed,impact.point.x,impact.terrainEnergy);
  for(const t of state.tanks){
   if(t.hp<=0)continue;
   const dx=Math.max(0,Math.abs(t.x-impact.point.x)-C.tankWidth/2),dy=Math.max(t.y-impact.point.y,impact.point.y-t.y-C.tankHeight,0);
   const near=impact.terrainEnergy>0&&Math.hypot(dx,dy)<=(shot.combatVersion>=24?P.splashRadius(shot):C.dangerRadius);
   const lostSupport=P.support(changed,t.x)<t.y-1e-5;
   if(near||lostSupport)candidates.add(t.id);
  }
 }
 return {ids:[...candidates].filter(id=>id!==shot.attackerId).sort((a,b)=>a-b),selfDanger:candidates.has(shot.attackerId),direct};
};
// Centrality uses the incoming line, not the surface contact point.
P.centrality=function(hit,tank,shot){
 const v=hit.point,speed=Math.hypot(v.vx,v.vy);if(!speed)return 1;
 const nx=-v.vy/speed,ny=v.vx/speed,half=Math.abs(nx)*C.tankWidth/2+Math.abs(ny)*C.tankHeight/2+shot.radius;
 const d=Math.abs((tank.x-v.x)*nx+(tank.y+C.tankHeight/2-v.y)*ny),offset=d/half;
 return offset>1?0:1-.75*J.clamp(offset,0,1);
};
P.splashRadius=shot=>shot?.combatVersion>=29?C.splashRadius:6;
P.splashCandidates=function(point,state,excluded,radius=C.splashRadius){
 const source={x:point.x,y:Math.max(point.y,P.height(state.terrain,point.x)+.08)};
 return state.tanks.filter(t=>t.hp>0&&t.id!==excluded).map(t=>{
  const dx=Math.max(0,Math.abs(t.x-point.x)-C.tankWidth/2),dy=Math.max(t.y-point.y,point.y-t.y-C.tankHeight,0),distance=Math.hypot(dx,dy);
  let clear=distance<radius;
  const target={x:t.x,y:t.y+C.tankHeight/2},steps=Math.max(2,Math.ceil(Math.hypot(target.x-source.x,target.y-source.y)/.2));
  for(let i=1;clear&&i<steps;i++){const k=i/steps,x=source.x+(target.x-source.x)*k,y=source.y+(target.y-source.y)*k;if(y<P.height(state.terrain,x)-.02)clear=false;}
  return {tank:t,distance,weight:clear?(1-distance/radius)**2:0};
 }).filter(v=>v.weight>0);
};
P.crater=function(terrain,x,energy){
 if(energy<=.01)return null;
 const radius=Math.min(C.craterRadiusMax,.8+2.4*Math.sqrt(energy/C.craterEnergyScale)),depth=Math.min(C.craterDepthMax,radius*.67),cy=P.height(terrain,x),before=terrain.slice();
 for(let i=0;i<terrain.length;i++){const d=Math.abs(i*C.terrainStep-x);if(d<radius)terrain[i]=Math.max(C.bedrock,Math.min(terrain[i],cy-depth*Math.sqrt(1-(d/radius)**2)));}
 return {x,y:cy,radius,depth,before};
};
// Altitude and purchase energy use the common y=0 datum. Flight uses the actual height above terrain.
P.airLimits=(terrain,targetX,worldHeight=C.worldHeight)=>({min:Math.max(C.heightMin,Math.ceil(Math.max(...terrain)+C.airClearance)),max:Math.floor(worldHeight-3)});
P.airShot=(terrain,targetX,height,mass,worldHeight=C.worldHeight)=>{
 const width=P.width(terrain),referenceY=P.height(terrain,targetX),direction=targetX<width/2?-1:1;
 const fallHeight=Math.max(0,height-referenceY),vx=direction*C.airSpeed,fallTime=Math.sqrt(2*fallHeight/C.g),releaseX=targetX-vx*fallTime,spread=C.airScatterBase+C.airScatterHeight*fallHeight,entryX=direction>0?Math.min(-7,releaseX-spread-7):Math.max(width+7,releaseX+spread+7);
 return {radius:C.rockRadius,referenceY,height:fallHeight,altitude:height,origin:{x:releaseX,y:height},vx,vy:0,direction,
  airDrop:{targetX,nominalReleaseX:releaseX,entryX,speed:C.airSpeed,direction,spread,offset:0,dropTime:(releaseX-entryX)/vx},
  liftEnergy:P.potential(mass,height),horizontalEnergy:P.kinetic(mass,C.airSpeed)};
};
P.lockAir=(shot,random)=>{
 const a=shot.airDrop;if(!a)return;
 // Draw once, before defense. Restore keeps this release point and never rerolls.
 a.offset=(random()*2-1)*a.spread;shot.origin.x=a.nominalReleaseX+a.offset;
 a.dropTime=(shot.origin.x-a.entryX)/shot.vx;
};
P.ownTraces=(state,viewerId=0)=>(state.shotTraces||[]).filter(t=>t.actor===viewerId&&t.weapon==='shell');
P.tracePoints=trace=>{
 const count=Math.max(2,Math.min(600,Math.ceil(trace.duration*30))),out=[];
 for(let i=0;i<count;i++)out.push(P.position(trace,trace.duration*i/count));
 out.push(trace.end);return out;
};
P.flightSample=function(flight,time){
 const pts=flight.points;let lo=0,hi=pts.length-1;
 while(lo<hi){const mid=(lo+hi)>>1;if(pts[mid].t<time)lo=mid+1;else hi=mid;}
 if(lo===0)return pts[0];const a=pts[lo-1],b=pts[lo],k=J.clamp((time-a.t)/(b.t-a.t||1),0,1);return {x:a.x+(b.x-a.x)*k,y:a.y+(b.y-a.y)*k,t:time,vx:b.vx,vy:b.vy};
};
})(globalThis);


/* ===== question-bank.js ===== */
/* Editable question bank. The CSV is the source of truth. */
(function(root){
'use strict';
const J=root.JD;
J.QuestionBank=[];
const kinds={'Delo':'work','Kinetična energija':'kinetic','Potencialna energija':'potential','Moč':'power'};
const headers=['id','sklop','vrsta','zahtevnost','aktivna','besedilo','namig','odgovor','enota','decimalke','resitev'];
const B=J.Bank={ready:false,error:'',revision:null,filename:'fizikavprasanja9.csv'};
B.parse=function(input){
 const text=String(input).replace(/^\uFEFF/,''),records=[];
 let row=[],field='',quoted=false,closed=false,line=1,start=1;
 const fail=message=>{throw Error('Vrstica '+line+': '+message);};
 const endField=()=>{row.push(field);field='';closed=false;};
 const endRow=()=>{endField();if(row.some(v=>v.trim()))records.push({row,line:start});row=[];start=line+1;};
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(quoted){
   if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
   else{field+=c;if(c==='\n')line++;}
  }else if(c==='"'){if(field||closed)fail('Neveljavni narekovaji.');quoted=true;}
  else if(c===';')endField();
  else if(c==='\n'||c==='\r'){endRow();if(c==='\r'&&text[i+1]==='\n')i++;line++;start=line;}
  else{if(closed){if(!/\s/.test(c))fail('Za narekovajem pričakujem podpičje.');}else field+=c;}
 }
 if(quoted)fail('Manjka zaključni narekovaj.');
 if(field||row.length||closed)endRow();
 if(!records.length)throw Error('CSV je prazen.');
 const names=records.shift().row.map(v=>v.trim());
 if(new Set(names).size!==names.length)throw Error('CSV ima podvojena imena stolpcev.');
 for(const name of headers)if(!names.includes(name))throw Error('Manjka stolpec '+name+'.');
 const ids=new Set(),questions=[];
 for(const record of records){
  const {row,line}=record;
  if(row.length!==names.length)throw Error('Vrstica '+line+': napačno število stolpcev.');
  const v=Object.fromEntries(names.map((key,i)=>[key,row[i].trim()]));
  const error=msg=>{throw Error('Vrstica '+line+' ('+(v.id||'?')+'): '+msg);};
  if(!v.id||ids.has(v.id))error('ID manjka ali se ponavlja.');ids.add(v.id);
  if(!['0','1'].includes(v.aktivna))error('aktivna mora biti 0 ali 1.');
  if(v.aktivna==='0')continue;
  if(!kinds[v.sklop])error('Neznan sklop.');
  if(!['Računska','Razumevanje besedila'].includes(v.vrsta))error('Neznana vrsta naloge.');
  if(!/^[123]$/.test(v.zahtevnost))error('zahtevnost mora biti 1, 2 ali 3.');
  if(!/^[012]$/.test(v.decimalke))error('decimalke morajo biti 0, 1 ali 2.');
  if(!v.besedilo||!v.namig||!v.resitev)error('Manjka besedilo, namig ali rešitev.');
  if(!/^[+-]?\d+(?:[.,]\d{1,2})?$/.test(v.odgovor))error('Odgovor mora biti število z največ dvema decimalkama.');
  const answer=Number(v.odgovor.replace(',','.')),decimals=Number(v.decimalke);
  if(!Number.isFinite(answer)||Math.abs(answer*10**decimals-Math.round(answer*10**decimals))>1e-7)error('Odgovor presega dovoljeno število decimalk.');
  const kind=kinds[v.sklop];
  if(!(kind==='power'?['W','kW']:['J','kJ']).includes(v.enota))error('Napačna enota za sklop.');
  questions.push({id:v.id,source:'bank',version:27,kind,difficulty:Number(v.zahtevnost),category:v.vrsta,title:v.sklop,
   given:v.besedilo,givenLines:[v.besedilo],formula:v.namig,answer,units:[v.enota],decimals,integerAnswer:decimals===0,
   allowNegative:answer<0,note:decimals?'Rezultat vpiši z največ '+decimals+' decimalnima mestoma.':'Vpiši celo število.',
   solution:v.resitev,hinted:false,status:'pending',family:kind+':'+v.besedilo.toLowerCase().replace(/\d+(?:[.,]\d+)?/g,'#')});
 }
 if(!questions.length)throw Error('CSV nima aktivnih vprašanj.');
 return questions;
};
B.install=function(text){const questions=B.parse(text);J.QuestionBank=questions;B.revision=String(J.seed(text));B.ready=true;B.error='';return questions.length;};
B.load=async function(){
 if(typeof root.fetch!=='function'||root.location?.protocol==='file:')throw Error('Izberi datoteko fizikavprasanja9.csv.');
 const controller=typeof AbortController==='function'?new AbortController():null;
 const timeout=controller?setTimeout(()=>controller.abort(),8000):null;
 try{const response=await root.fetch(B.filename,{cache:'no-store',...(controller?{signal:controller.signal}:{})});if(!response.ok)throw Error('Datoteka fizikavprasanja9.csv ni dosegljiva.');return B.install(await response.text());}
 finally{if(timeout)clearTimeout(timeout);}
};
})(globalThis);


/* ===== questions.js ===== */
(function(root){
'use strict';
const J=root.JD,C=J.C,Q=J.Questions={};
Q.parse=function(text,unit){
 const s=String(text).trim().replace(/\s/g,'').replace(',','.');
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))return null;
 const x=Number(s),f={J:1,kJ:1000,W:1,kW:1000}[unit];
 return Number.isFinite(x)&&x>=0&&f?x*f:null;
};
Q.check=(q,text,unit)=>{
 if(q.source==='bank'){
  if(!q.units.includes(unit))return {valid:false,reason:'Uporabi enoto '+q.units[0]+'. Poskus ostaja na voljo.'};
  const raw=String(text).trim().replace(/\s/g,'').replace('−','-').replace(',','.');
  if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw))return {valid:false,reason:'Vpiši število. Poskus ostaja na voljo.'};
  const value=Number(raw),digits=(raw.split('.')[1]||'').length;
  if(!Number.isFinite(value)||!q.allowNegative&&value<0)return {valid:false,reason:'Pri tej nalogi uporabi nenegativno število.'};
  if(q.decimals===0&&(!Number.isSafeInteger(value)||/\.\d*[1-9]/.test(raw))||q.decimals>0&&digits>q.decimals)return {valid:false,reason:q.note+' Poskus ostaja na voljo.'};
  return {valid:true,correct:Math.abs(value-q.answer)<1e-8,value};
 }

 if(!q.units.includes(unit))return {valid:false,reason:'Uporabi enoto '+q.units[0]+'. Poskus ostaja na voljo.'};
 const value=Q.parse(text,unit);
 if(value===null)return {valid:false,reason:'Vpiši nenegativno število. Poskus ostaja na voljo.'};
 if(q.integerAnswer&&(!Number.isSafeInteger(value)||/[.,]\d*[1-9]/.test(String(text).replace(/\s/g,''))))return {valid:false,reason:'Vnesi rezultat, zaokrožen na '+(unit==='W'?'cele vate (1 W)':'cele joule (1 J)')+'. Poskus ostaja na voljo.'};
 return {valid:true,correct:q.integerAnswer?value===q.answer:Math.abs(value-q.answer)<=q.tolerance,value};
};
Q.create=function(kind,data){
 const one=x=>Math.round(x*10)/10,d=Object.fromEntries(Object.entries(data).map(([k,v])=>[k,typeof v==='number'?one(v):v]));
 let q={kind,units:['J'],integerAnswer:true,version:23,tolerance:0,hinted:false,status:'pending',note:'Rezultat zaokroži na cele joule (1 J).'};
 if(kind==='work')Object.assign(q,{title:'Koliko dela opravi izstreljevalnik?',givenLines:[`F = ${J.num(d.force)} N`,`s = ${J.num(d.stroke)} m`],answer:Math.round(d.force*d.stroke),formula:'A = F · s',solution:`A = ${J.num(d.force)} N · ${J.num(d.stroke)} m ≈ ${J.num(Math.round(d.force*d.stroke),0)} J.`});
 if(kind==='kinetic'){
  const v=one(J.Physics.speed(data.force*data.stroke,data.mass)),answer=Math.round(d.mass*v*v/2);
  Object.assign(q,{title:'Kolikšna je začetna kinetična energija?',givenLines:[`m = ${J.num(d.mass)} kg`,`v₀ ≈ ${J.num(v)} m/s`],note:'Računaj z zapisano približno hitrostjo. Rezultat zaokroži na cele joule (1 J).',answer,formula:'Wₖ = m · v² / 2',solution:`Wₖ = ${J.num(d.mass)} · (${J.num(v)})² / 2 ≈ ${J.num(answer,0)} J. Let uporablja natančno hitrost; naloga zapisano približno hitrost.`});
 }
 if(kind==='potential')Object.assign(q,{title:'Koliko dela potrebuje dvig skale?',givenLines:[`m = ${J.num(d.rockMass)} kg`,`h = ${J.num(d.height)} m`,`g = 10 m/s²`],answer:Math.round(d.rockMass*C.g*d.height),formula:'A = ΔWₚ = m · g · h',solution:`A = ${J.num(d.rockMass)} kg · 10 m/s² · ${J.num(d.height)} m ≈ ${J.num(Math.round(d.rockMass*C.g*d.height),0)} J.`});
 if(kind==='power'){
  const work=one(data.power*C.moveTime),time=one(C.moveTime),answer=Math.round(work/time);
  Object.assign(q,{title:'Kolikšna je osnovna moč motorja?',givenLines:[`A = ${J.num(work)} J`,`t = ${J.num(time)} s`],answer,units:['W'],note:'Rezultat zaokroži na cele vate (1 W).',formula:'P = A / t',solution:`P = ${J.num(work)} J / ${J.num(time)} s ≈ ${J.num(answer,0)} W.`});
 }
 if(!Number.isFinite(q.answer))throw Error('Neznana naloga.');
 q.given=q.givenLines.join('\n');return q;
};
// Separate RNG/decks: educational draws never alter projectile randomness.
Q.random=function(s){const box={rng:s.questionRng};const r=J.random(box);s.questionRng=box.rng;return r;};
Q.freshSeed=function(){
 if(root.crypto?.getRandomValues){const value=new Uint32Array(1);root.crypto.getRandomValues(value);return value[0];}
 return J.seed(String(Date.now())+'-'+Math.random());
};
Q.pool=function(s,kind){
 const all=J.QuestionBank.filter(q=>q.kind===kind),stage=s.stageId||1;
 const allowed=all.filter(q=>stage===1?q.difficulty===1:stage===2?q.difficulty<=2:q.difficulty>=2);
 if(allowed.length)return allowed;
 const distance=q=>Math.abs(q.difficulty-stage),best=Math.min(...all.map(distance));
 return all.filter(q=>distance(q)===best);
};
Q.selectKind=function(s){
 const allowed=['work','kinetic','potential','power'].filter(k=>s.topics[k]&&Q.pool(s,k).length);
 if(!allowed.length)throw Error(J.Bank.ready?'Izbrani sklopi nimajo aktivnih vprašanj.':'Najprej naloži vprašanja.');
 const recent=s.questionRecent||[],choices=allowed.filter(k=>k!==recent.at(-1));
 const pool=choices.length?choices:allowed;return pool[Math.floor(Q.random(s)*pool.length)];
};
Q.draw=function(s,kind,actor=0){
 const allowed=Q.pool(s,kind);if(!allowed.length)throw Error('Za ta sklop ni aktivnih vprašanj.');
 const key=actor===0?'questionHistory':'aiQuestionHistory',history=Array.isArray(s[key])?s[key]:[];
 const lastSeen=id=>{for(let i=history.length-1;i>=0;i--)if(history[i].id===id)return i;return -1;};
 const oldest=Math.min(...allowed.map(q=>lastSeen(q.id)));
 let choices=allowed.filter(q=>lastSeen(q.id)===oldest);
 const recentFamilies=history.slice(-3).map(q=>q.family),varied=choices.filter(q=>!recentFamilies.includes(q.family));
 if(varied.length)choices=varied;
 const tier=s.stageId||1,preferred=choices.filter(q=>q.difficulty===tier);
 if(preferred.length&&Q.random(s)<.7)choices=preferred;
 const q=J.clone(choices[Math.floor(Q.random(s)*choices.length)]);
 history.push({id:q.id,family:q.family});s[key]=history.slice(-Math.max(1000,J.QuestionBank.length*2));
 s.lastQuestionId=q.id;s.questionRecent=(s.questionRecent||[]).concat(kind).slice(-2);return q;
};
Q.public=q=>{
 if(!q)return null;
 const legacy=String(q.given||'').split('. Uporabi '),givenLines=q.givenLines||legacy[0].split(' · '),note=q.note||(legacy[1]?'Uporabi '+legacy[1]:null);
 return {id:q.id,source:q.source,decimals:q.decimals,allowNegative:q.allowNegative,kind:q.kind,title:q.title,given:q.given,givenLines,note,units:q.units,integerAnswer:!!q.integerAnswer,hinted:q.hinted,status:q.status,formula:q.hinted||q.status!=='pending'?q.formula:null,solution:q.status!=='pending'?q.solution:null};
};
})(globalThis);


/* ===== core.js ===== */
(function(root){
'use strict';
const J=root.JD,C=J.C,P=J.Physics,F=J.PHASE;
const newBonus=()=>({used:false,status:'available',multiplier:1,q:null});
const stats=()=>({attempts:0,correct:0,independent:0,hints:0,skipped:0,invalidated:0,byKind:{}});
let gameSequence=0;
class Game {
 constructor(options={}){
  const seed=String(options.seed||C.seed).slice(0,60),upgrades=Object.assign({wallet:0,power:0,shield:0},options.upgrades||{});
  if(upgrades.energy!==undefined){upgrades.wallet+=upgrades.energy;delete upgrades.energy;}
  const stageId=J.STAGES[options.stageId]?Number(options.stageId):1,stage=J.STAGES[stageId],terrain=P.terrain(seed,stageId,C.battleWidth);
  this.state={version:J.VERSION,aiVersion:28,id:options.id||seed+'-'+Date.now()+'-'+(++gameSequence),seed,rng:J.seed(seed),mode:'challenge',topics:Object.assign({work:true,kinetic:true,potential:true,power:true},options.topics,{fall:false}),questionDifficulty:['basic','standard','mixed'].includes(options.questionDifficulty)?options.questionDifficulty:'basic',airHeightVersion:1,questionVersion:27,questionDecks:{},questionRecent:[],questionHistory:J.clone(options.questionHistory||[]),questionRng:options.questionSeed??J.Questions.freshSeed(),worldVersion:25,worldWidth:C.battleWidth,worldHeight:C.worldHeight,moveVersion:28,playerName:J.playerName(options.playerName),upgrades,stageId,battleNumber:options.battleNumber||options.level||1,level:options.battleNumber||options.level||1,terrain,terrainCuts:[],tanks:[],economyVersion:22,combatVersion:30,events:[],phase:F.PREP,defense:null,active:0,turn:1,locked:null,flight:null,move:null,result:null,feedback:null,shotTraces:[],history:[],stats:stats(),attackBonus:newBonus(),defenseBonus:newBonus(),winner:null};
  const layout={rng:J.seed(seed+'-layout')},slots=stage.platforms.map(([a,b])=>{const lo=a*C.battleWidth/120+4,hi=b*C.battleWidth/120-4;return Math.round((lo+J.random(layout)*(hi-lo))*10)/10;});
  for(let i=slots.length-1;i>0;i--){const j=Math.floor(J.random(layout)*(i+1));[slots[i],slots[j]]=[slots[j],slots[i]];}
  this.state.tanks=[[this.state.playerName,slots[0],'#53e2d5'],[stage.names[0],slots[1],'#ffbc63'],[stage.names[1],slots[2],'#cb9bfd']].map(([name,x,color],id)=>{
   const profileId=id===0?'player':stage.enemies[id-1],profile=J.PROFILES[profileId];
   return {id,name,profileId,hpMax:profile.hp,x,y:P.support(terrain,x),color,hp:profile.hp,shield:profile.shield,shieldMax:C.shieldMax+(id===0?upgrades.shield*10000:0),depth:id,creditsMax:C.creditsMax+(id===0?upgrades.wallet*20:0),power:profile.power+(id===0?upgrades.power*1000:0),credits:C.initialCredits,ownTurns:id===0?1:0,kills:0};
  });
  for(const t of this.state.tanks){const target=this.state.tanks.filter(v=>v.id!==t.id).sort((a,b)=>Math.abs(a.x-t.x)-Math.abs(b.x-t.x))[0];t.barrelAngle=(target.x<t.x?135:45)*Math.PI/180;}
  if(options.multiplayer){
   const s=this.state;s.multiplayer=true;s.playerStats=[stats(),stats()];
   s.tanks=s.tanks.slice(0,2).map((t,id)=>({...t,name:J.playerName(options.names[id]),profileId:'player',hp:C.hp,hpMax:C.hp,shield:C.initialShield,shieldMax:C.shieldMax,power:C.power,creditsMax:C.creditsMax}));
   s.active=Math.floor(J.random(s)*2);for(const t of s.tanks)t.ownTurns=t.id===s.active?1:0;
  }
  this.resetDraft();
 }
 get active(){return this.state.tanks[this.state.active];}
 get defender(){const s=this.state;return s.defense?s.tanks[s.defense.ids[s.defense.index]]||null:null;}
 resetDraft(){const s=this.state,target=s.tanks.filter(t=>t.hp>0&&t.id!==s.active).sort((a,b)=>Math.abs(a.x-this.active.x)-Math.abs(b.x-this.active.x))[0];s.draft={weapon:'shell',angle:C.defaultAngle,direction:target&&target.x<this.active.x?-1:1,mass:40,force:Math.min(10000,Math.max(C.forceMin,J.Economy.forceLimit(this.active.credits))),stroke:C.launchStroke,rockMass:100,height:J.clamp(50,P.airLimits(s.terrain,0,s.worldHeight).min,P.airLimits(s.terrain,0,s.worldHeight).max),projectile:'ball',targetX:target?target.x:60};}
 require(ok,message='Tega dejanja v tej fazi ni mogoče izvesti.'){if(!ok)throw Error(message);}
 bonusForPhase(){return this.state.phase===F.DEFEND?this.state.defenseBonus:this.state.attackBonus;}
 forceLimit(projectile=this.state.draft.projectile,mass=this.state.draft.mass){return J.Economy.forceLimit(this.active.credits,projectile,mass);}
 canHint(){return this.state.stageId<3;}
 canQuestion(){const s=this.state;return s.mode==='challenge'&&[F.PREP,F.DEFEND].includes(s.phase)&&['work','kinetic','potential','power'].some(k=>s.topics[k]);}
 baseCost(){const d=this.state.draft;return d.weapon==='shell'?d.force*C.launchStroke:d.rockMass*C.g*d.height+P.kinetic(d.rockMass,C.airSpeed);}
 price(){const d=this.state.draft;return J.Economy.quote(d.weapon,this.baseCost(),d.projectile,d.mass);}
 shieldQuote(){const t=this.active,amount=Math.max(0,Math.min(C.shieldRecharge,(t.credits-C.shieldCredits)*1000/C.creditsPerKJ,t.shieldMax-t.shield));return {amount,credits:amount>0?J.Economy.money(J.Economy.energyPrice(amount)+C.shieldCredits):0};}
 questionKind(){return J.Questions.selectKind(this.state);}
 plan(){
  const s=this.state,d=s.draft,a=this.active,b=1,base=this.baseCost();
  const issues=[],price=this.price();
  if(a.credits<price.total)issues.push(`Premalo denarja: napad stane ${J.money(price.total)}, na voljo imaš ${J.money(a.credits)}. Zmanjšaj energijo ali izberi Varčuj.`);
  const shot={combatVersion:30,openSky:true,force:d.force,worldHeight:s.worldVersion>=24?(s.worldHeight||C.worldHeight):null,worldWidth:P.width(s.terrain),moveVersion:s.moveVersion,attackerId:a.id,weapon:d.weapon,projectile:price.projectile,damageFactor:J.PROJECTILES[price.projectile].factor,invoice:price,mass:d.weapon==='shell'?d.mass:d.rockMass,baseCost:base,bonusEnergy:base*(b-1),energy:base*b,credits:price.total,bonus:b,targetX:d.targetX,startX:a.x};
  if(d.weapon==='shell'){
   shot.radius=C.shotRadius;
   const vector=P.launchAngle(a,P.speed(shot.energy,shot.mass),d.angle,d.direction);
   Object.assign(shot,vector,{aimAngle:d.angle,direction:d.direction});
  }else{
   const limits=P.airLimits(s.terrain,d.targetX,s.worldHeight);
   Object.assign(shot,P.airShot(s.terrain,d.targetX,d.height,d.rockMass,s.worldHeight));
   if(d.height<limits.min||d.height>limits.max)issues.push(`Za varen prelet izberi višino ${limits.min}–${limits.max} m.`);
  }
  return {valid:issues.length===0,reachable:true,shot,issues,reason:issues[0]||null};
 }
 preview(){const p=this.plan();if(!p.reachable)return p;const guide=P.simulate(p.shot,this.state.terrain,[]),flight=P.simulate(p.shot,this.state.terrain,this.state.tanks);return {...p,flight,guide,threats:P.threats(p.shot,this.state,guide)};}
 defenseView(id=this.defender?.id){
  const s=this.state,t=s.tanks[id],bonus=s.defense?.bonuses[id]?.multiplier||1,r=P.moveRange(s,t,bonus);
  // Public allowlist: no locked path, parameters, other choices, or attack energy.
  return {phase:s.phase,stageId:s.stageId,aiVersion:s.aiVersion||25,attacker:{id:s.locked.attackerId,name:s.tanks[s.locked.attackerId].name},danger:s.locked.weapon,defender:{id:t.id,x:t.x,y:t.y,power:t.power,credits:t.credits,shield:t.shield},range:r,mode:s.mode,topics:{power:s.topics.power},bonus};
 }
 beginMovement(){
  const s=this.state,plans=s.defense.ids.map(id=>s.defense.plans[id]);
  s.move={plans,duration:Math.max(.15,...plans.map(p=>p.duration)),falls:plans.flatMap(p=>p.falls||[]),eliminated:[],fallsApplied:false};
  s.phase=F.MOVE;
 }
 log(type,data){const s=this.state;s.events.push({type,turn:s.turn,...J.clone(data)});if(s.events.filter(e=>e.type!=='question').length>80){const i=s.events.findIndex(e=>e.type!=='question');s.events.splice(i,1);}}
 startFlight(){const s=this.state,a=s.tanks[s.locked.attackerId];if(s.locked.weapon==='shell')a.barrelAngle=Math.atan2(s.locked.vy,s.locked.vx);s.flight=P.simulate(s.locked,s.terrain,s.tanks);s.phase=F.FLIGHT;}
 record(kind,key){const s=this.state;s.stats[key]++;const by=s.stats.byKind[kind]||(s.stats.byKind[kind]={attempts:0,correct:0,independent:0,hints:0,skipped:0});if(key in by)by[key]++;}
 dispatch(command){
  const s=this.state,c=command,phase=s.phase;
  if(c.type==='continue-feedback'){this.require(s.feedback&&c.actor===s.feedback.actor,'Rešitev ni odprta.');s.feedback=null;return s;}
  this.require(!s.feedback,'Najprej preberi rešitev in izberi Nadaljuj.');
  const isDefense=phase===F.DEFEND,owner=isDefense?this.defender?.id:s.active;
  const actor=c.actor===undefined?owner:c.actor;
  if(!['beginDefense','moveDone','flightDone','next','startTurn'].includes(c.type))this.require(actor===owner,'Zdaj je na potezi drug tank.');
  if(c.type==='submit-answer'||c.type==='submit-skip'){
   this.require([F.PREP,F.DEFEND].includes(phase));
   if(!isDefense){const p=this.plan();this.require(p.valid,p.reason);}
   const b=this.bonusForPhase();this.require(b.q&&!b.used,'Poskus je že porabljen.');
   this.dispatch({...c,type:c.type==='submit-answer'?'answer':'skip',actor});
   const feedback={actor,defense:isDefense,status:b.status,question:J.clone(b.q),text:c.text??'',unit:c.unit??b.q.units[0]};
   if(!isDefense)this.dispatch({type:'lock',actor});
   s.feedback=feedback;
  }else if(c.type==='fire-answer'||c.type==='fire-skip'){
   this.require(phase===F.PREP);const plan=this.plan();this.require(plan.valid,plan.reason);
   this.dispatch({...c,type:c.type==='fire-answer'?'answer':'skip',actor});this.dispatch({type:'lock',actor});
  }else if(c.type==='configure'){
   this.require(phase===F.PREP);const prev=J.clone(s.draft),d=s.draft,p=c.patch||{};
   const allowed=['weapon','mass','force','rockMass','height','projectile','targetX','angle','direction'];
   this.require(Object.keys(p).every(k=>allowed.includes(k)),'Neznana nastavitev.');
   const candidate={...d,...p,stroke:C.launchStroke};
   this.require(['shell','rock'].includes(candidate.weapon));
   
   
   this.require(C.masses.includes(candidate.mass)&&C.rockMasses.includes(candidate.rockMass));
   this.require(candidate.direction===1||candidate.direction===-1,'Izberi smer cevi.');
   for(const [k,min,max] of [['angle',C.angleMin,C.angleMax],['force',C.forceMin,Number.MAX_SAFE_INTEGER],['height',C.heightMin,(s.worldHeight||C.worldHeight)-3],['targetX',2,P.width(s.terrain)-2]])this.require(Number.isFinite(candidate[k])&&candidate[k]>=min&&candidate[k]<=max,'Nastavitev je zunaj dovoljenih mej.');
   this.require(['ball','cone','rod'].includes(candidate.projectile),'Neznan izstrelek.');
   if(candidate.weapon==='shell'){
    const limit=Math.max(C.forceMin,this.forceLimit(candidate.projectile,candidate.mass));
    candidate.force=Math.min(candidate.force,limit);
   }else {const limits=P.airLimits(s.terrain,candidate.targetX,s.worldHeight);candidate.height=J.clamp(candidate.height,limits.min,limits.max);}
   s.draft=candidate;
   const linked=s.questionVersion>=24?[]:['weapon','mass','force','stroke','rockMass','height','projectile'];
   if(linked.some(k=>prev[k]!==candidate[k])&&s.attackBonus.q){
    s.attackBonus.used=true;s.attackBonus.status='invalidated';s.attackBonus.multiplier=1;s.attackBonus.q=null;if(s.multiplayer||actor===0)s.stats.invalidated++;
   }
  }else if(c.type==='question'){
   this.require([F.PREP,F.DEFEND].includes(phase)&&this.canQuestion(),'Bonusni račun pri tej vsebini ni omogočen.');const b=this.bonusForPhase();this.require(!b.used&&!b.q,'Na to akcijo je dovoljen en poskus.');
   const kind=this.questionKind();
   if(kind==='work'||kind==='kinetic')this.require(s.topics[kind],'Ta vsebina je izključena.');
   b.q=J.Questions.draw(s,kind,actor);b.status='pending';
  }else if(c.type==='hint'){
   this.require([F.PREP,F.DEFEND].includes(phase)&&this.canHint(),'Na 3. stopnji ni namigov.');const b=this.bonusForPhase();this.require(b.q&&b.q.status==='pending');
   if(!b.q.hinted){b.q.hinted=true;if(s.multiplayer||actor===0)this.record(b.q.kind,'hints');}
  }else if(c.type==='answer'){
   this.require([F.PREP,F.DEFEND].includes(phase));const b=this.bonusForPhase();this.require(b.q&&b.q.status==='pending'&&!b.used,'Poskus je že porabljen.');
   const answer=J.Questions.check(b.q,c.text,c.unit);this.require(answer.valid,answer.reason||'Vpiši nenegativno število. Poskus ostaja na voljo.');
   b.used=true;b.multiplier=isDefense&&answer.correct?C.bonus:1;b.q.status=b.status=answer.correct?'correct':'wrong';
   this.log('question',{actor,defense:isDefense,status:b.status,question:J.Questions.public(b.q),text:c.text,unit:c.unit});
   if(s.multiplayer||actor===0){this.record(b.q.kind,'attempts');if(answer.correct){this.record(b.q.kind,'correct');if(!b.q.hinted)this.record(b.q.kind,'independent');}}
  }else if(c.type==='skip'){
   this.require([F.PREP,F.DEFEND].includes(phase));const b=this.bonusForPhase();
   if(!b.used){b.used=true;b.status='skipped';if(b.q){b.q.status='skipped';if(s.multiplayer||actor===0)this.record(b.q.kind,'skipped');this.log('question',{actor,defense:isDefense,status:'skipped',question:J.Questions.public(b.q)});}else if((s.multiplayer||actor===0)&&this.canQuestion())s.stats.skipped++;}
  }else if(c.type==='lock'){
   this.require(phase===F.PREP);const plan=this.plan();this.require(plan.valid,plan.reason);
   if(!s.attackBonus.used&&s.mode==='challenge')this.dispatch({type:'skip',actor});
   const status=s.attackBonus.status,roll=['correct','wrong'].includes(status)?J.random(s):null;
   const effect=J.attackEffect(status,roll);P.lockAir(plan.shot,()=>J.random(s));const threat=P.threats({...plan.shot,effect},s);
   s.locked=J.freeze(J.clone({...plan.shot,effect,defenderIds:threat.ids}));J.Economy.debit(this.active,plan.shot.credits);s.defense=null;
   if((s.multiplayer||actor===0)&&plan.shot.weapon==='shell')this.active.barrelAngle=Math.atan2(plan.shot.vy,plan.shot.vx);
   s.phase=F.LOCK;s.result=null;s.flight=null;s.move=null;this.log('purchase',{actor,credits:plan.shot.credits,available:this.active.credits});
  }else if(c.type==='beginDefense'){
   this.require(phase===F.LOCK);
   const ids=s.legacyAttack?[s.locked.targetId]:(s.locked.defenderIds||[]);
   s.defense={ids:ids.filter(id=>s.tanks[id]?.hp>0),index:0,bonuses:{},plans:{},committedAI:{}};
   for(const id of s.defense.ids)s.defense.bonuses[id]=newBonus();
   if(!s.defense.ids.length){this.startFlight();}
   else{
    s.phase=F.DEFEND;s.defenseBonus=s.defense.bonuses[s.defense.ids[0]];
    // Commit every AI decision before a human response can reveal anything.
    for(const id of s.defense.ids)if(!s.multiplayer&&id!==0)s.defense.committedAI[id]=J.AI.defend(this.defenseView(id),()=>J.random(s));
   }
  }else if(c.type==='dodge'){
   this.require(phase===F.DEFEND);const t=this.defender,d=c.distance,r=P.moveRange(s,t,s.defenseBonus.multiplier);
   this.require(Number.isFinite(d)&&d>=-r.left-.00001&&d<=r.right+.00001,'Ta premik ni dovoljen. Izberi razdaljo znotraj označenega območja.');
   if(!s.defenseBonus.used&&s.mode==='challenge')this.dispatch({type:'skip',actor});
   const quote=P.moveQuote(s,t,d,s.defenseBonus.multiplier),{baseUsed,bonusUsed}=quote;
   this.require(bonusUsed<=r.bonusBudget+.0001);
   const path=P.movePath(s,t,d,s.defenseBonus.multiplier);this.require(path.complete,'Izbrana pot ni dosegljiva.');
   const cost=quote.credits;J.Economy.debit(t,cost);
   if(t.legacyMoveEnergy!==undefined)t.legacyMoveEnergy=Math.max(0,t.legacyMoveEnergy-baseUsed);
   s.defense.plans[t.id]={...path,tankId:t.id,y:t.y,baseUsed,bonusUsed,credits:cost};
   this.log('dodge',{actor:t.id,distance:d,credits:cost,bonusUsed});
   s.defense.bonuses[t.id]=s.defenseBonus;s.defense.index++;
   if(s.defense.index<s.defense.ids.length)s.defenseBonus=s.defense.bonuses[s.defense.ids[s.defense.index]];
   else this.beginMovement();
  }else if(c.type==='moveDone'){
   this.require(phase===F.MOVE);
   for(const move of s.move.plans){const t=s.tanks[move.tankId];t.x=move.to;t.y=move.toY??move.y;
    if(!s.move.fallsApplied){for(const fall of move.falls||[])t.hp=Math.max(0,t.hp-fall.damage);if(t.hp<=0)s.move.eliminated.push(t.id);}
   }
   s.move.fallsApplied=true;this.startFlight();
  }else if(c.type==='flightDone'){
   this.require(phase===F.FLIGHT);this.resolveImpact();s.phase=F.RESULT;
  }else if(c.type==='shield'){
   this.require(phase===F.PREP);const t=this.active,quote=this.shieldQuote();
   this.require(quote.amount>0,'Ščit je poln ali pa ni dovolj denarja.');J.Economy.debit(t,quote.credits);t.shield+=quote.amount;s.result={action:'shield',actor:t.id,amount:quote.amount,credits:quote.credits,falls:[],eliminated:[]};s.phase=F.RESULT;this.log('result',{result:s.result});
  }else if(c.type==='save'){
   this.require(phase===F.PREP);const t=this.active,gained=J.Economy.income(t.credits,C.saveCredits,t.creditsMax);t.credits=J.Economy.money(t.credits+gained);s.result={action:'save',actor:t.id,gained,falls:[],eliminated:[]};s.phase=F.RESULT;this.log('result',{result:s.result});
  }else if(c.type==='next'){
   this.require(phase===F.RESULT);const living=s.tanks.filter(t=>t.hp>0);
   if(living.length<=1||!s.multiplayer&&s.tanks[0].hp<=0){s.phase=F.END;s.winner=living.length===1?living[0].id:s.multiplayer?null:s.tanks[0].hp<=0?'ai':0;}
   else{let next=s.active;do{next=(next+1)%s.tanks.length;}while(s.tanks[next].hp<=0);s.active=next;s.phase=F.NEXT;}
  }else if(c.type==='startTurn'){
   this.require(phase===F.NEXT);s.turn++;const t=this.active;if(t.ownTurns>0){const gained=J.Economy.income(t.credits,C.turnCredits,t.creditsMax);t.credits=J.Economy.money(t.credits+gained);if(gained>0)this.log('income',{actor:t.id,gained,available:t.credits});}delete s.legacyAttack;for(const tank of s.tanks)delete tank.legacyMoveEnergy;s.defense=null;t.ownTurns=(t.ownTurns||0)+1;s.attackBonus=newBonus();s.defenseBonus=newBonus();s.locked=null;s.flight=null;s.move=null;s.phase=F.PREP;s.moveVersion=28;s.aiVersion=28;this.resetDraft();
  }else throw Error('Neznan ukaz.');
  return s;
 }
 resolveImpact(){
  const s=this.state,h=s.flight.hit,shot=s.locked;
  const r={action:'attack',actor:shot.attackerId,weapon:shot.weapon,credits:shot.credits,baseCost:shot.baseCost,target:h.id,hitType:h.type,point:h.point,speed:h.speed,energy:h.energy,absorbed:0,bodyEnergy:0,terrainEnergy:0,escapedEnergy:0,damage:0,splash:[],splashEnergy:0,dissipatedEnergy:0,directFactor:1,effect:shot.effect||{kind:'normal',multiplier:1},falls:[],moveFalls:J.clone(s.move?.falls||[]),eliminated:[...(s.move?.eliminated||[])],move:J.clone(s.move),crater:null};
  if(shot.airDrop)r.carrier={origin:shot.origin,vx:shot.vx,radius:shot.radius,airDrop:shot.airDrop,impactTime:shot.airDrop.dropTime+s.flight.duration,worldWidth:shot.worldWidth};
  r.hpFactor=shot.airDrop&&shot.combatVersion>=30?C.airHPFactor:1;r.shieldFactor=shot.airDrop&&shot.combatVersion>=30?C.airShieldFactor:1;r.combatVersion=shot.combatVersion||0;r.splashRadius=P.splashRadius(shot);r.effectEnergy=h.energy*(shot.combatVersion>=27?r.effect.multiplier:1);
  if(h.type==='tank'){
   const t=s.tanks[h.id],abs=P.impactAbsorb(r.effectEnergy,t.shield,shot);t.shield-=abs.absorbed;r.absorbed=abs.absorbed;r.stoppedEnergy=abs.stopped;r.hpFactor=abs.hpFactor;r.shieldFactor=abs.shieldFactor;
   const available=abs.excess*(shot.combatVersion>=24?1-C.splashShare:1);
   r.terrainEnergy=available*C.directTerrainShare;r.bodyEnergy=available-r.terrainEnergy;r.directFactor=shot.combatVersion>=24?P.centrality(h,t,shot):1;r.damageFactor=shot.damageFactor||1;r.damage=r.bodyEnergy/C.hpJoules*r.damageFactor*(shot.combatVersion>=27?1:r.effect.multiplier)*r.directFactor*abs.hpFactor;t.hp=Math.max(0,t.hp-r.damage);
   if(t.hp===0&&!r.eliminated.includes(t.id))r.eliminated.push(t.id);
  }else if(h.type==='terrain')r.terrainEnergy=r.effectEnergy*(shot.combatVersion>=24?1-C.splashShare:1);else r.escapedEnergy=r.effectEnergy;
  if(shot.combatVersion>=24&&['tank','terrain'].includes(h.type)){
   const pool=(r.effectEnergy-(r.stoppedEnergy??r.absorbed))*C.splashShare,candidates=P.splashCandidates(h.point,s,h.type==='tank'?h.id:null,r.splashRadius),denom=Math.max(1,candidates.reduce((a,v)=>a+v.weight,0));
   for(const v of candidates){
    const t=v.tank,energy=Math.min(pool*v.weight/denom,C.splashMaxHP*C.hpJoules),abs=P.impactAbsorb(energy,t.shield,shot),damage=abs.excess/C.hpJoules*abs.hpFactor;
    if(energy<1e-8)continue;t.shield-=abs.absorbed;t.hp=Math.max(0,t.hp-damage);r.splashEnergy+=energy;
    r.splash.push({tankId:t.id,energy,absorbed:abs.absorbed,bodyEnergy:abs.excess,damage,distance:v.distance});
    if(t.hp===0&&!r.eliminated.includes(t.id))r.eliminated.push(t.id);
   }
   r.dissipatedEnergy=Math.max(0,pool-r.splashEnergy);
  }
  if(r.terrainEnergy>0){r.crater=P.crater(s.terrain,h.point.x,r.terrainEnergy);if(r.crater&&s.terrainCuts){const c=r.crater;s.terrainCuts.push([c.x,c.y,c.radius,c.depth]);}}
  for(const t of s.tanks){
   const newY=Math.min(t.y,P.support(s.terrain,t.x)),height=t.y-newY;
   if(height>.00001){const e=C.tankMass*C.g*height,damage=e/C.fallJoules,from=t.y;t.y=newY;
    if(t.hp>0){t.hp=Math.max(0,t.hp-damage);if(t.hp===0&&!r.eliminated.includes(t.id))r.eliminated.push(t.id);}
    r.falls.push({tankId:t.id,from,to:newY,height,energy:e,damage});
   }
  }
  for(const id of r.eliminated)if(id!==shot.attackerId)s.tanks[shot.attackerId].kills++;
  if(shot.weapon==='shell'&&(s.multiplayer||shot.attackerId===0)){
   const traces=s.shotTraces||(s.shotTraces=[]);
   if(!traces.some(t=>t.turn===s.turn&&t.actor===shot.attackerId))traces.push({id:s.turn+':'+shot.attackerId,turn:s.turn,actor:shot.attackerId,weapon:'shell',projectile:shot.projectile,mass:shot.mass,force:shot.force??s.draft.force,angle:shot.aimAngle,direction:shot.direction,origin:J.clone(shot.origin),vx:shot.vx,vy:shot.vy,duration:s.flight.duration,end:J.clone(h.point),hitType:h.type});
  }
  s.result=r;this.log('result',{result:r});s.history.push({turn:s.turn,actor:shot.attackerId,defenders:s.defense?.ids||[],moves:(s.move?.plans||[]).map(p=>({tankId:p.tankId,distance:p.distance})),hit:h.id,point:{x:h.point.x,y:h.point.y},hitType:h.type,shot:{origin:shot.origin,force:s.draft.force,stroke:s.draft.stroke,mass:shot.mass,angle:shot.aimAngle,weapon:shot.weapon},aimTargetId:s.tanks[shot.attackerId].aiTargetId,energy:h.energy});if(s.history.length>30)s.history.shift();
 }
 score(){const s=this.state;return Math.round((s.tanks[0].hp>0&&s.phase===F.END?1000:0)+s.tanks[0].kills*500+s.tanks[0].hp*5);}
 snapshot(){return J.clone(this.state);}
 static restore(snapshot){
  if(!snapshot||!['0.3','0.29.1','0.29','0.28.1','0.28','0.27','0.26','0.25','0.24','0.23','0.22','0.21','1.3.0','1.2.0','1.1.0','1.0.0'].includes(snapshot.version)||!Object.values(F).includes(snapshot.phase)||!Array.isArray(snapshot.tanks)||snapshot.tanks.length!==3||![601,901].includes(snapshot.terrain?.length))throw Error('Shranjeni boj ni veljaven.');
  const legacy=!['0.22','0.23','0.24','0.25','0.26','0.27','0.28','0.3','0.29.1','0.29','0.28.1'].includes(snapshot.version);
  for(const t of snapshot.tanks){
   if(!Number.isFinite(t.x)||!Number.isFinite(t.y)||!Number.isFinite(t.hp)||t.x<0||t.x>P.width(snapshot.terrain)||t.hp<0)throw Error('Shranjeni podatki so poškodovani.');
   if(!Number.isFinite(t.credits)||t.credits<0||Math.abs(J.Economy.money(t.credits)-t.credits)>1e-7)throw Error('Dobroimetje je poškodovano.');
   if(legacy&&(!Number.isFinite(t.energy)||t.energy<0))throw Error('Stara energijska zaloga je poškodovana.');
  }
  if(!snapshot.terrain.every(Number.isFinite))throw Error('Teren je poškodovan.');
  if([F.LOCK,F.DEFEND,F.MOVE,F.FLIGHT].includes(snapshot.phase)&&!snapshot.locked)throw Error('Manjka zaklenjen napad.');
  const game=Object.create(Game.prototype);game.state=J.clone(snapshot);const s=game.state;
  s.shotTraces=s.shotTraces||[];s.feedback=s.feedback||null;s.aiVersion=s.aiVersion||25;s.worldWidth=P.width(s.terrain);s.worldHeight=s.worldHeight||C.worldHeight;s.playerName=J.playerName(s.playerName||s.tanks[0].name);s.tanks[0].name=s.playerName;
  s.moveVersion=s.moveVersion||(legacy&&[F.LOCK,F.DEFEND,F.MOVE,F.FLIGHT].includes(s.phase)?24:25);if(s.phase===F.PREP){s.draft.stroke=C.launchStroke;s.moveVersion=28;s.aiVersion=28;}
  s.battleNumber=s.battleNumber||s.level||1;s.stageId=J.STAGES[s.stageId]?s.stageId:1;
  s.upgrades=s.upgrades||{};s.upgrades.wallet=s.upgrades.wallet??s.upgrades.energy??0;delete s.upgrades.energy;
  if(legacy&&[F.LOCK,F.DEFEND,F.MOVE,F.FLIGHT].includes(s.phase))s.legacyAttack=true;
  for(const t of s.tanks){
   t.profileId=t.profileId||(t.id===0?'player':'medium');t.hpMax=t.hpMax||Math.max(100,t.hp);t.depth=t.depth??t.id;
   t.creditsMax=t.creditsMax||C.creditsMax+(t.id===0?s.upgrades.wallet*20:0);
   if(legacy){if(s.legacyAttack)t.legacyMoveEnergy=t.energy;t.credits=J.Economy.money(t.credits+J.Economy.energyPrice(t.energy));}
   delete t.energy;delete t.energyMax;t.ownTurns=t.ownTurns??(s.turn>t.id?1:0);
  }
  if(snapshot.version==='1.0.0'&&s.result?.action==='save')s.result.gained=2;
  if(!Number.isFinite(s.draft.angle)){
   const d=s.draft,a=s.tanks[s.active],v=P.launch(a,{x:d.targetX,y:P.height(s.terrain,d.targetX)+1.3},P.speed(d.force*d.stroke*(s.attackBonus?.multiplier||1),d.mass),'high');
   d.angle=J.clamp(v?v.angle*180/Math.PI:C.defaultAngle,C.angleMin,C.angleMax);d.direction=d.targetX<a.x?-1:1;
  }
  s.draft.projectile=s.draft.projectile||'ball';delete s.draft.targetId;delete s.draft.arc;delete s.draft.exercise;
  if(legacy&&s.locked){s.locked.legacyRules=true;s.locked.damageFactor=1;s.locked.projectile=s.locked.weapon==='rock'?'rock':'ball';}
  if(legacy&&[F.DEFEND,F.MOVE,F.FLIGHT].includes(s.phase)){
   const id=s.locked.targetId;s.defense={ids:[id],index:s.phase===F.DEFEND?0:1,bonuses:{[id]:s.defenseBonus||newBonus()},plans:{},committedAI:{}};
   if(s.phase===F.DEFEND&&id!==0)s.defense.committedAI[id]=J.AI.defend(game.defenseView(id),()=>J.random(s));
  }
  if(s.move&&!s.move.plans){const old=s.move;
   if(!old.segments){old.toY=old.y;old.fromY=old.y;old.falls=[];old.fallsApplied=true;old.eliminated=[];}
   s.move={plans:[old],duration:old.duration||C.moveTime,falls:old.falls||[],eliminated:old.eliminated||[],fallsApplied:!!old.fallsApplied};
  }
  if(s.phase===F.DEFEND){
   if(!s.defense||!s.defense.ids.every(id=>Number.isInteger(id)&&s.tanks[id])||!s.defense.ids[s.defense.index]&&s.defense.ids[s.defense.index]!==0)throw Error('Obramba je poškodovana.');
   s.defense.bonuses[s.defense.ids[s.defense.index]]=s.defenseBonus||s.defense.bonuses[s.defense.ids[s.defense.index]]||newBonus();
   s.defenseBonus=s.defense.bonuses[s.defense.ids[s.defense.index]];
  }
  if(!s.airHeightVersion){s.draft.height=P.height(s.terrain,s.draft.targetX)+s.draft.height;s.airHeightVersion=1;}
  s.worldVersion=s.worldVersion||23;s.mode='challenge';s.topics={work:true,kinetic:true,potential:true,power:true,...s.topics,fall:false};
  if(!['work','kinetic','potential','power'].some(k=>s.topics[k]))s.topics={work:true,kinetic:true,potential:true,power:true,fall:false};
  if(s.questionVersion!==27){s.questionDecks={};s.questionRng=J.Questions.freshSeed();}
  s.questionVersion=27;s.questionRecent=s.questionRecent||[];s.questionHistory=s.questionHistory||[];s.questionDecks=s.questionDecks||{};s.questionRng=s.questionRng??J.Questions.freshSeed();
  if(s.stageId===3){for(const b of [s.attackBonus,s.defenseBonus,...Object.values(s.defense?.bonuses||{})])if(b?.q?.status==='pending')b.q.hinted=false;}
  s.version=J.VERSION;s.economyVersion=22;s.combatVersion=30;s.events=s.events||[];
  // Old pending questions keep their original data and validation. Only paid shots keep old energy bonuses.
  if(!['0.23','0.24','0.25','0.26','0.27','0.28','0.3','0.29.1','0.29','0.28.1'].includes(snapshot.version)&&s.phase===F.PREP)s.attackBonus.multiplier=1;
  if(s.phase===F.PREP&&s.draft.weapon==='rock'){const l=P.airLimits(s.terrain,s.draft.targetX,s.worldHeight);s.draft.height=J.clamp(s.draft.height,l.min,l.max);}
  if(s.phase===F.PREP&&s.draft.weapon==='shell')s.draft.force=Math.min(s.draft.force,Math.max(C.forceMin,game.forceLimit()));
  if(s.locked)J.freeze(s.locked);return game;
 }

}
J.Game=Game;
})(globalThis);



export const J = globalThis.JD;
