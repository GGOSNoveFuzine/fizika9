import {J} from './shared.mjs';
/* ===== ai.js ===== */
(function(root){
'use strict';
const J=root.JD,C=J.C,AI=J.AI={},P_AIR_PRICE=50*C.airSpeed*C.airSpeed/2000;
// Defense sees public movement bounds, never the locked aiming vector.
AI.defend=function(view,random){
 const r=view.range,p=random(),stay=J.aiSettings(view.stageId||1,view.aiVersion||25).stayChance;if(p<stay)return 0;
 const sign=(p-stay)/(1-stay)<.5?-1:1,limit=sign<0?r.left:r.right;
 return sign*Math.floor(Math.min(limit,1.5+random()*limit)*10)/10;
};
// Deliberately no terrain/path/collision simulator or exact aiming solver here.
// The only feedback is the location of a previous REAL impact.
AI.choose=function(view,random){
 const t=view.actor,stage=view.stageId,targets=view.targets;
 if(!targets.length)return null;
 const last=view.history.filter(h=>h.actor===t.id&&h.shot?.weapon==='shell').at(-1);
 const remembered=last&&targets.find(v=>v.id===last.aimTargetId);
 const target=remembered&&random()<.65?remembered:targets[Math.floor(random()*targets.length)];
 const tuning=J.aiSettings(stage,view.aiVersion??26),error=tuning.angleError,blunder=random()<tuning.blunderChance;
 const direction=target.x<t.x?-1:1,distance=Math.abs(target.x-t.x),mass=t.credits<12?20:stage===1?40:(random()<.65?40:80),stroke=C.launchStroke;
 // Equal-height range is just an estimate: no muzzle/terrain correction or oracle.
 let angle=52+J.clamp((target.y-t.y)*.35,-8,8),factor=1;
 if(last&&last.aimTargetId===target.id&&last.hitType==='terrain'&&Math.abs(last.shot.origin.x-t.x)<5){
  const actual=Math.abs(last.point.x-last.shot.origin.x),wanted=Math.abs(target.x-last.shot.origin.x);
  if(actual>8)factor=1+(J.clamp(wanted/actual,.82,1.18)-1)*tuning.correction;
 }
 let force=mass*C.g*Math.max(8,distance-3+(target.y-t.y)*.7)/(2*stroke*Math.sin(2*angle*Math.PI/180))*factor;
 if(last&&last.aimTargetId===target.id&&last.hitType==='terrain'&&Math.abs(last.shot.origin.x-t.x)<5&&last.shot.force&&Math.abs(last.shot.angle-angle)<12)force=last.shot.force*last.shot.stroke*mass/(last.shot.mass*stroke)*factor;
 force*=1+(random()-.5)*tuning.forceNoise;
 angle+=(random()*2-1)*error;
 if(blunder)angle+=(random()<.5?-1:1)*(6+random()*4);
 let projectile=stage===1?'ball':random()<.65?'ball':random()<.65?'cone':'rod';
 const minAltitude=view.airMinHeight??Math.ceil(target.y+C.airClearance);
 const useRock=random()<tuning.rockChance&&t.credits>=J.PROJECTILES.rock.fee+minAltitude*.5+P_AIR_PRICE;
 if(useRock){
  const scatter=tuning.rockScatter*(blunder?1.8:1),targetX=J.clamp(target.x+(random()*2-1)*scatter,2,(view.worldWidth||C.worldWidth)-2);
  const height=Math.min(Math.max(50,minAltitude),Math.floor((t.credits-J.PROJECTILES.rock.fee-P_AIR_PRICE)/.5));
  return {targetId:target.id,patch:{weapon:'rock',rockMass:50,height:Math.max(minAltitude,height),targetX}};
 }
 if(J.Economy.forceLimit(t.credits,projectile,mass)<C.forceMin)projectile='ball';
 const maxAffordable=J.Economy.forceLimit(t.credits,projectile,mass);
 if(maxAffordable<C.forceMin)return null;
 force=J.clamp(Math.round(force/1000)*1000,C.forceMin,maxAffordable);
 return {targetId:target.id,patch:{weapon:'shell',projectile,mass,force,angle:J.clamp(angle,C.angleMin,C.angleMax),direction,targetX:target.x}};
};
AI.act=function(game){
 const s=game.state,t=game.active,random=()=>J.random(s);
 if(t.credits<J.Economy.quote('shell',C.forceMin*C.launchStroke,'ball',20).total){game.dispatch({type:'save'});return;}
 const shieldChance=t.profileId==='heavy'?.2:s.stageId===1?.06:.12;
 if(t.shield<4000&&t.hp<t.hpMax*.75&&game.shieldQuote().amount>=8000&&random()<shieldChance){game.dispatch({type:'shield'});return;}
 const view={airMinHeight:J.Physics.airLimits(s.terrain,0,s.worldHeight).min,worldWidth:s.worldWidth||C.worldWidth,stageId:s.stageId,aiVersion:s.aiVersion||25,actor:{id:t.id,x:t.x,y:t.y,credits:t.credits},targets:s.tanks.filter(v=>v.hp>0&&v.id!==t.id).map(v=>({id:v.id,x:v.x,y:v.y})),history:s.history};
 const choice=AI.choose(view,random);if(!choice){game.dispatch({type:'save'});return;}
 t.aiTargetId=choice.targetId;game.dispatch({type:'configure',patch:choice.patch});
 if(!game.plan().valid){game.dispatch({type:'save'});return;}
 if(game.canQuestion()&&random()<J.aiSettings(s.stageId,s.aiVersion||25).questionChance){
  game.dispatch({type:'question'});const q=s.attackBonus.q,correct=random()<.85;
  game.dispatch({type:'answer',text:String(correct?q.answer:q.answer+2),unit:q.units[0]});
 }
 // Locking invokes the common game referee to determine threatened tanks,
 // after the AI has irrevocably selected its parameters. No feedback to choose().
 game.dispatch({type:'lock'});
};
})(globalThis);



export const AI=J.AI;
