import {J} from './shared.mjs';
const {Physics:P,C}=J;
export const RATE=3;
export const COLORS=['#86e3bc','#e9ad76','#bca0ed','#79c9ef','#ef91ad'];
export const ROUND_NAMES=['Odprta planota','Gričevje','Višinske razlike'];

export function terrainFor(seed,round,count){
  const width=180+(count-2)*20,random={rng:J.seed(seed+':terrain:'+round)};
  const phase=J.random(random)*Math.PI*2;
  // Real random coordinates plus a seeded player shuffle. Leave room for movement.
  const margin=16,gap=26,slack=width-2*margin-gap*(count-1);
  const samples=Array.from({length:count},()=>J.random(random)).sort((a,b)=>a-b);
  const xs=samples.map((r,i)=>margin+i*gap+r*slack);
  const surface=x=>round===1?19+2*Math.sin(x*.04+phase):round===2?24+7*Math.sin(x*.07+phase)+2*Math.cos(x*.15):24+12*Math.sin(x*.045+phase)+4*Math.cos(x*.12);
  const levels=xs.map(surface);
  const terrain=Array.from({length:Math.round(width/C.terrainStep)+1},(_,i)=>{
    const x=i*C.terrainStep;let y=surface(x);
    xs.forEach((sx,j)=>{const d=Math.abs(x-sx);if(d<11){const blend=J.clamp((d-7)/4,0,1);y=levels[j]*(1-blend)+y*blend;}});
    return Math.max(C.bedrock+4,y);
  });
  const spawnXs=xs.slice();
  for(let i=spawnXs.length-1;i>0;i--){const j=Math.floor(J.random(random)*(i+1));[spawnXs[i],spawnXs[j]]=[spawnXs[j],spawnXs[i]];}
  return {terrain,width,xs,spawnXs};
}

export function draftFor(s,id){
  const t=s.tanks[id],target=s.tanks.filter(v=>v.id!==id&&v.hp>0).sort((a,b)=>Math.abs(a.x-t.x)-Math.abs(b.x-t.x))[0];
  return {weapon:'shell',projectile:'ball',mass:40,rockMass:50,force:10000,angle:45,direction:target?.x<t.x?-1:1,stroke:2,height:Math.max(50,P.airLimits(s.terrain,0,90).min),targetX:target?.x??90};
}
export function cleanDraft(s,id,patch={}){
  const d={...s.slots[id].draft};
  if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Neveljavna nastavitev napada.');
  for(const key of ['weapon','projectile','mass','rockMass','force','angle','direction','height','targetX'])if(key in patch)d[key]=patch[key];
  if(!['shell','rock'].includes(d.weapon)||!['ball','cone','rod'].includes(d.projectile))throw Error('Neznano orožje.');
  if(!C.masses.includes(d.mass)||!C.rockMasses.includes(d.rockMass))throw Error('Neveljavna masa.');
  for(const k of ['force','angle','direction','height','targetX'])if(typeof d[k]!=='number'||!Number.isFinite(d[k]))throw Error('Nastavitve morajo biti števila.');
  if(d.force<2000||d.force>75000||d.force%1000!==0||d.angle<5||d.angle>85||![-1,1].includes(d.direction)||d.targetX<0||d.targetX>s.worldWidth||d.height<10||d.height>90)throw Error('Nastavitev je zunaj dovoljenega območja.');
  d.stroke=2;return d;
}
export function planFor(s,id,draft=s.slots[id].draft){
  // Reuse the original SI weapon model, without its old two-player phase machine.
  const game=Object.create(J.Game.prototype);
  game.state={...s,active:id,draft,worldVersion:30,moveVersion:28};
  return game.plan();
}
export function tanksAt(s,now){
  return s.tanks.map(t=>{
    const move=s.moves.find(m=>m.tankId===t.id);
    return move?{...t,...P.moveSample(move,(now-move.at)*RATE/1000)}:{...t};
  });
}
export function predictImpact(s,f,now){
  const shot=f.shot;let t=Math.max(0,(now-f.at)*RATE/1000),a=P.position(shot,t);
  const maxTime=Math.max(40,(shot.vy+Math.sqrt(shot.vy**2+2*C.g*Math.max(0,shot.origin.y+4)))/C.g+1);
  while(t<maxTime){
    const dt=Math.min(C.shotStep,C.sweepLength/Math.max(1,Math.hypot(a.vx,a.vy)),maxTime-t);
    const b=P.position(shot,t+dt),wall=f.at+(t+dt)*1000/RATE;
    const hit=P.firstCollision(a,b,shot,s.terrain,tanksAt(s,wall));
    if(hit){const time=t+dt*hit.f,point=P.position(shot,time),speed=Math.hypot(point.vx,point.vy);return {flightId:f.id,at:Math.max(now,f.at+time*1000/RATE),duration:time,hit:{...hit,point,speed,energy:P.kinetic(shot.mass,speed)}};}
    t+=dt;a=b;
  }
  return {flightId:f.id,at:f.at+t*1000/RATE,duration:t,hit:{type:'timeout',id:null,point:a,speed:0,energy:0}};
}
export function refreshImpacts(s,now){s.impacts=s.flights.map(f=>predictImpact(s,f,now));}
export function chargeMoveFalls(s,move,now){
  const elapsed=(now-move.at)*RATE/1000;
  const total=move.falls.reduce((sum,f)=>sum+f.damage*J.clamp((elapsed-f.start)/f.duration,0,1)**2,0);
  const tank=s.tanks[move.tankId];tank.hp=Math.max(0,tank.hp-Math.max(0,total-(move.damageApplied||0)));move.damageApplied=total;
}

// All direct hits in one instant share the available shield proportionally.
// Splash is then shared in a second pass. No player-array order wins a tie.
export function impactBatch(s,events,now){
  const before=tanksAt(s,now),alive=before.filter(t=>t.hp>0).map(t=>t.id);
  s.tanks=before.map(t=>{const out={...t};delete out.kind;return out;});
  for(const move of s.moves)chargeMoveFalls(s,move,now);
  const results=events.map(e=>{
    const f=s.flights.find(v=>v.id===e.flightId),shot=f.shot,h=e.hit;
    return {id:f.id,at:now,actor:shot.attackerId,shot,hit:h,duration:e.duration,point:h.point,hitType:h.type,weapon:shot.weapon,energy:h.energy,effectEnergy:h.energy*(shot.effect?.multiplier||1),absorbed:0,damage:0,terrainEnergy:0,splash:[],combatVersion:30};
  });
  for(const t of s.tanks){
    const hits=results.filter(r=>r.hitType==='tank'&&r.hit.id===t.id),demand=hits.reduce((n,r)=>n+r.effectEnergy*(r.shot.airDrop?C.airShieldFactor:1),0);
    const ratio=demand?Math.min(1,t.shield/demand):0;
    for(const r of hits){
      const factor=r.shot.airDrop?C.airShieldFactor:1,hpf=r.shot.airDrop?C.airHPFactor:1;
      r.absorbed=r.effectEnergy*factor*ratio;t.shield=Math.max(0,t.shield-r.absorbed);
      r.excess=r.effectEnergy-r.absorbed/factor;
      r.terrainEnergy=r.excess*(1-C.splashShare)*C.directTerrainShare;
      r.damage=r.excess*(1-C.splashShare)*(1-C.directTerrainShare)/C.hpJoules*(r.shot.damageFactor||1)*P.centrality(r.hit,before[t.id],r.shot)*hpf;
      t.hp=Math.max(0,t.hp-r.damage);
    }
  }
  const splash=[];
  for(const r of results){
    if(r.hitType==='terrain'){r.terrainEnergy=r.effectEnergy*(1-C.splashShare);r.excess=r.effectEnergy;}
    if(!['terrain','tank'].includes(r.hitType))continue;
    const candidates=P.splashCandidates(r.point,{...s,tanks:before},r.hitType==='tank'?r.hit.id:null,P.splashRadius(r.shot));
    const sum=Math.max(1,candidates.reduce((n,c)=>n+c.weight,0));
    for(const c of candidates)splash.push({r,tankId:c.tank.id,energy:Math.min(r.excess*C.splashShare*c.weight/sum,C.splashMaxHP*C.hpJoules)});
  }
  for(const t of s.tanks){
    const hits=splash.filter(v=>v.tankId===t.id),demand=hits.reduce((n,v)=>n+v.energy*(v.r.shot.airDrop?C.airShieldFactor:1),0),ratio=demand?Math.min(1,t.shield/demand):0;
    for(const v of hits){const factor=v.r.shot.airDrop?C.airShieldFactor:1,absorbed=v.energy*factor*ratio,damage=(v.energy-absorbed/factor)/C.hpJoules*(v.r.shot.airDrop?C.airHPFactor:1);t.shield=Math.max(0,t.shield-absorbed);t.hp=Math.max(0,t.hp-damage);v.r.splash.push({tankId:t.id,energy:v.energy,absorbed,damage});}
  }
  const base=s.terrain.slice();let changed=false;
  for(const r of results)if(r.terrainEnergy>0){
    const copy=base.slice(),crater=P.crater(copy,r.point.x,r.terrainEnergy);
    if(crater){changed=true;for(let i=0;i<copy.length;i++)s.terrain[i]=Math.min(s.terrain[i],copy[i]);const {before:unused,...visible}=crater;r.crater=visible;}
  }
  // An impact interrupts drive paths: new ground is authoritative immediately.
  // Movement is charged for the committed distance; ground collapse is a tactical risk.
  if(changed)s.moves=[];
  for(const t of s.tanks){
    if(!changed&&s.moves.some(m=>m.tankId===t.id))continue;
    const y=Math.min(t.y,P.support(s.terrain,t.x)),drop=t.y-y;
    if(drop>0){t.hp=Math.max(0,t.hp-C.tankMass*C.g*drop/C.fallJoules);t.y=y;}
  }
  for(const r of results){
    const shot=r.shot;
    s.history.push({actor:r.actor,point:r.point,hitType:r.hitType,aimTargetId:s.tanks[r.actor].aiTargetId,shot:{origin:shot.origin,weapon:shot.weapon,force:shot.force,stroke:2,mass:shot.mass,angle:shot.aimAngle}});
    s.traces.push({id:r.id,actor:r.actor,weapon:shot.weapon,projectile:shot.projectile,mass:shot.mass,force:shot.force,angle:shot.aimAngle,direction:shot.direction,altitude:shot.altitude,targetX:shot.targetX,baseCost:shot.baseCost,credits:shot.credits,origin:J.clone(shot.origin),vx:shot.vx,vy:shot.vy,duration:r.duration,end:J.clone(r.point),hitType:r.hitType});
    delete r.shot;delete r.hit;delete r.excess;
  }
  s.effects=s.effects.filter(e=>now-e.at<2000).concat(results);
  s.history=s.history.slice(-50);s.traces=s.traces.slice(-50);
  s.flights=s.flights.filter(f=>!events.some(e=>e.flightId===f.id));
  return alive.filter(id=>s.tanks[id].hp<=0);
}
