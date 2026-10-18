import {J} from './shared.mjs';
import {AI} from './ai.mjs';
import {RATE,COLORS,ROUND_NAMES,terrainFor,draftFor,cleanDraft,planFor,tanksAt,refreshImpacts,impactBatch,chargeMoveFalls} from './combat.mjs';
const {C,Physics:P}=J;
const assert=(ok,message='Dejanje trenutno ni na voljo.')=>{if(!ok)throw Error(message);};
const finite=(n,min,max)=>typeof n==='number'&&Number.isFinite(n)&&n>=min&&n<=max;
export const VERSION='0.4.0';
export const RULES={sequential:'Izmenične poteze',salvo:'Sočasne salve',rapid:'Hitri obračun'};
export const TOPICS={work:'Delo',kinetic:'Kinetična energija',potential:'Potencialna energija',power:'Moč'};
export function configOf(raw={}){
  const play=raw.play||'solo',rules=raw.rules||'sequential';
  assert(['solo','hotseat','online','training'].includes(play),'Neznan način igre.');assert(rules in RULES,'Neznana pravila.');
  const humanCount=Number(raw.humanCount??1),totalPlayers=Number(raw.totalPlayers??3);
  assert(Number.isInteger(totalPlayers)&&totalPlayers>=2&&totalPlayers<=5,'Skupaj je lahko od 2 do 5 tankov.');
  assert(Number.isInteger(humanCount)&&humanCount>=1&&humanCount<=totalPlayers,'Neveljavno število ljudi.');
  assert(play!=='hotseat'||humanCount<=3,'Hotseat podpira največ 3 ljudi.');
  assert(!['training','solo'].includes(play)||humanCount===1,'Za več ljudi izberi hotseat ali spletno igro.');
  assert(play!=='hotseat'||rules==='sequential','Hotseat uporablja izmenične poteze brez izmika.');
  const topics=Object.fromEntries(Object.keys(TOPICS).map(k=>[k,raw.topics?.[k]!==false]));assert(Object.values(topics).some(Boolean),'Izberi vsaj en sklop vprašanj.');
  const difficulty=Number(raw.difficulty??2),questionDifficulty=Number(raw.questionDifficulty??1),prepSeconds=Number(raw.prepSeconds??90),trainingRound=Number(raw.trainingRound??1);
  assert([1,2,3].includes(difficulty)&&[1,2,3].includes(questionDifficulty),'Neveljavna težavnost.');assert([30,60,90,120].includes(prepSeconds),'Čas priprave je lahko 30, 60, 90 ali 120 s.');assert([1,2,3].includes(trainingRound),'Neveljaven teren.');
  return {play,rules:play==='training'?'sequential':rules,humanCount,totalPlayers,topics,difficulty,questionDifficulty,prepSeconds,trainingRound};
}
function learning(seed,id){return {attempts:0,correct:0,wrong:0,skipped:0,hints:0,byKind:{},history:[],rng:J.seed(seed+':q:'+id),records:[]};}
function publicQuestion(q,hintStep=0){
  const p=J.Questions.public(q);if(p){p.instance=q.instance;p.hintStep=hintStep;p.formula=hintStep>=2||q.status!=='pending'?q.formula:null;}
  return p;
}
export class Match {
  constructor(state){this.state=state;}
  static create(raw={},names=[],seed=String(Date.now()),now=Date.now()){
    const config=configOf(raw),players=Array.from({length:config.totalPlayers},(_,id)=>({id,name:J.playerName(names[id]||(id<config.humanCount?'Igralec '+(id+1):['BOLT','VEKTOR','ISKRA','TITAN','NOVA'][id-config.humanCount])),kind:id<config.humanCount?'human':'cpu',autopilot:false}));
    const state={version:VERSION,id:crypto.randomUUID(),seed,rng:J.seed(seed),config,players,round:0,counter:0,rev:0,now,scores:players.map(()=>0),learning:players.map((p,i)=>learning(seed,i)),roundResults:[],worldHeight:90,moveVersion:28,worldVersion:30,legacyAttack:true};
    const m=new Match(state);m.startRound(config.play==='training'?config.trainingRound:1,now);return m;
  }
  random(){return J.random(this.state);}
  controlled(id){const p=this.state.players[id];return p.kind==='cpu'||p.autopilot;}
  isTraining(){return this.state.config.play==='training';}
  startRound(round,now){
    const s=this.state,{terrain,width,spawnXs}=terrainFor(s.seed,round,s.config.totalPlayers);
    Object.assign(s,{round,stageId:round,roundName:ROUND_NAMES[round-1],terrain,worldWidth:width,phase:'prep',cycle:0,turn:0,now,roundAt:now,timedOut:false,active:(round-1)%s.players.length,pending:[],flights:[],moves:[],impacts:[],effects:[],history:[],traces:[],deaths:[],slots:[],roundReady:[],transitionAt:null,deadline:null,incomeAt:s.config.rules==='rapid'?now+12000:null,message:''});
    s.tanks=s.players.map((p,id)=>{const x=spawnXs[id];return {id,name:p.name,x,y:P.support(terrain,x),hp:100,hpMax:100,shield:10000,shieldMax:30000,power:4000,credits:60,creditsMax:150,color:COLORS[id],profileId:'medium',depth:id,barrelAngle:x<width/2?Math.PI/4:Math.PI*3/4};});
    for(const t of s.tanks)t.barrelAngle=draftFor(s,t.id).direction===1?Math.PI/4:Math.PI*3/4;
    s.slots=s.players.map((p,id)=>this.emptySlot(id));
    this.beginPrep(now,true);
  }
  emptySlot(id){const s=this.state;return {id,token:++s.counter,draft:draftFor(s,id),q:null,feedback:null,hintStep:0,status:'waiting',answerStatus:'skipped',locked:null,aiAt:null,cooldownUntil:0,utilityAt:0,intent:'attack',moveToken:false,moveBonus:1,questionChoices:{},utility:null};}
  draw(id,intent='attack'){
    const s=this.state,l=s.learning[id],r=()=>J.random(l),allowed=Object.keys(TOPICS).filter(k=>s.config.topics[k]);
    const kind=intent==='move'&&allowed.includes('power')?'power':allowed[Math.floor(r()*allowed.length)];
    let pool=J.QuestionBank.filter(q=>q.kind===kind&&q.difficulty===s.config.questionDifficulty);
    if(!pool.length)pool=J.QuestionBank.filter(q=>q.kind===kind);
    assert(pool.length,'Zbirka vprašanj ni naložena.');
    const seen=id=>l.history.lastIndexOf(id),oldest=Math.min(...pool.map(q=>seen(q.id)));pool=pool.filter(q=>seen(q.id)===oldest);
    const q=J.clone(pool[Math.floor(r()*pool.length)]);l.history.push(q.id);l.history=l.history.slice(-1000);
    q.instance=++s.counter;q.status='pending';q.hinted=false;return q;
  }
  prepare(id,now,intent='attack',keepDraft=false){
    const s=this.state,old=s.slots[id],slot=this.emptySlot(id);
    // A human keeps the chosen aim across defense and subsequent turns.
    if(keepDraft||intent==='move'||!this.controlled(id))slot.draft=J.clone(old.draft);
    slot.feedback=old?.feedback??null;slot.utilityAt=old?.utilityAt||0;slot.moveToken=old?.moveToken||false;slot.moveBonus=old?.moveBonus||1;slot.intent=intent;slot.status='preparing';slot.q=this.draw(id,intent);
    s.slots[id]=slot;
    if(this.controlled(id)&&!this.isTraining())slot.aiAt=now+(s.config.rules==='rapid'?5000+this.random()*6000:800+this.random()*1400);
  }
  beginPrep(now,first=false){
    const s=this.state;s.phase='prep';s.pending=[];s.transitionAt=null;s.deadline=this.isTraining()?null:now+s.config.prepSeconds*1000;s.cycle++;s.turn++;
    if(s.config.rules==='sequential'){
      if(this.isTraining())s.active=0;
      while(s.tanks[s.active].hp<=0)s.active=(s.active+1)%s.tanks.length;
      if(!first)s.tanks[s.active].credits+=J.Economy.income(s.tanks[s.active].credits,C.turnCredits);
      this.prepare(s.active,now);
    }else{
      if(s.config.rules==='rapid')s.deadline=null;
      for(const t of s.tanks)if(t.hp>0){if(!first&&s.config.rules==='salvo')t.credits+=J.Economy.income(t.credits,C.turnCredits);this.prepare(t.id,now);}
    }
  }
  record(id,status){
    const s=this.state,slot=s.slots[id],q=slot.q,l=s.learning[id];
    if(!q||q.status!=='pending')return;
    q.status=status;slot.answerStatus=status;
    if(status==='skipped')l.skipped++;else{l.attempts++;l[status]++;const k=l.byKind[q.kind]??={attempts:0,correct:0};k.attempts++;if(status==='correct')k.correct++;}
    l.records.push({id:q.id,kind:q.kind,status,hinted:q.hinted,round:s.round});l.records=l.records.slice(-300);
    slot.feedback={status,question:publicQuestion(q),at:s.now,purpose:slot.intent};
  }
  eligible(id){const s=this.state;return s.tanks[id]?.hp>0&&(s.phase==='prep'&&(s.config.rules!=='sequential'||s.active===id)||s.phase==='defense'&&s.defenders.includes(id));}
  command(id,c,now=Date.now()){
    // Events already due remain committed even if the subsequent command is invalid.
    this.advance(now);const original=this.state;this.state=J.clone(original);
    try{this.apply(id,c,now);this.state.rev++;this.state.now=now;return true;}catch(e){this.state=original;throw e;}
  }
  apply(id,c,now){
    const s=this.state;assert(Number.isInteger(id)&&s.players[id],'Neznan igralec.');
    if(c.type==='next-round'){
      assert(s.phase==='intermission','Runda še poteka.');
      if(!s.roundReady.includes(id))s.roundReady.push(id);
      if(s.config.play!=='online'||s.players.every(p=>this.controlled(p.id)||s.roundReady.includes(p.id)))this.startRound(s.round+1,now);
      return;
    }
    if(c.type==='replay'){assert(this.isTraining(),'Ponovitev istega terena je del treninga.');this.startRound(s.config.trainingRound,now);return;}
    assert(c.matchId===s.id&&c.round===s.round&&c.token===s.slots[id].token,'Ta poteza je že potekla. Prikaz je osvežen.');
    assert(this.eligible(id)&&!this.controlled(id),'Zdaj nisi na potezi.');
    const slot=s.slots[id];assert(slot.status!=='locked','Poteza je že potrjena.');
    if(c.type==='hint'){
      assert(this.isTraining(),'Namigi so na voljo samo v treningu.');assert(slot.q?.status==='pending');slot.hintStep=Math.min(3,slot.hintStep+1);if(!slot.q.hinted){slot.q.hinted=true;s.learning[id].hints++;}return;
    }
    if(c.type==='answer'){
      assert(slot.q?.status==='pending'&&c.questionId===slot.q.instance,'Na to vprašanje je že odgovorjeno.');
      assert(now>=slot.cooldownUntil,'Počakaj do izteka premora.');
      assert(typeof c.text==='string'&&c.text.length<=80&&typeof c.unit==='string'&&c.unit.length<=5,'Neveljaven odgovor.');
      const check=J.Questions.check(slot.q,c.text,c.unit);assert(check.valid,check.reason);this.answer(id,check.correct,now);return;
    }
    if(slot.utility){
      if(c.type==='skip-utility'){assert(!slot.utility.result,'Na vprašanje je že odgovorjeno.');this.resolveUtility(id,'skipped',now);return;}
      if(c.type==='continue-utility'){assert(slot.utility.result,'Najprej odgovori ali nadaljuj brez bonusa.');this.completeUtility(id,now);return;}
      throw Error('Izbrano dejanje je zaklenjeno. Najprej dokončaj vprašanje in rezultat.');
    }
    if(c.type==='intent'){
      assert(s.config.rules==='rapid'&&s.phase==='prep'&&['attack','move'].includes(c.intent),'Izbira ni na voljo.');
      assert(!slot.moveToken||c.intent!=='move','Premik že imaš pripravljen.');
      // Keep one stable question for each choice; toggling cannot redraw the deck.
      assert(slot.q?.status==='pending'&&now>=slot.cooldownUntil,'Najprej porabi pripravljeno dejanje.');
      slot.questionChoices[slot.intent]=slot.q;slot.intent=c.intent;
      slot.q=slot.questionChoices[c.intent]||(slot.questionChoices[c.intent]=this.draw(id,c.intent));return;
    }
    if(c.type==='dodge'){
      assert(s.config.play!=='hotseat','Hotseat nima izmika.');
      assert(s.phase==='defense'||s.config.rules==='rapid'&&slot.moveToken,'Premik ni odklenjen.');
      assert(finite(c.distance,-9,9),'Neveljavna razdalja.');
      assert(!s.moves.some(m=>m.tankId===id),'Premik že poteka.');
      const bonus=s.config.rules==='rapid'?slot.moveBonus:slot.answerStatus==='correct'?1.5:1,path=P.movePath({...s,tanks:tanksAt(s,now)},s.tanks[id],c.distance,bonus);assert(path.complete,'Izbrana pot ni dosegljiva.');
      if(s.phase==='defense'){this.record(id,'skipped');slot.locked={type:'move',distance:c.distance,bonus};slot.status='locked';this.maybeDefense(now);}
      else{this.addMoves([{id,distance:c.distance,bonus}],now);slot.moveToken=false;slot.moveBonus=1;refreshImpacts(s,now);}
      return;
    }
    assert(s.phase==='prep','Najprej dokončaj obrambo.');
    if(c.type==='fire'){
      if(s.config.rules==='rapid'){assert(slot.answerStatus==='correct'&&slot.intent==='attack','Pravilni odgovor odklene strel.');assert(!s.flights.some(f=>f.shot.attackerId===id),'Tvoj prejšnji izstrelek je še v letu.');}
      slot.draft=cleanDraft(s,id,c.draft||{});const plan=planFor(s,id);assert(plan.valid,plan.reason);
      this.record(id,'skipped');this.lockAttack(id,now);return;
    }
    if(['save','shield'].includes(c.type)){
      if(c.draft)slot.draft=cleanDraft(s,id,c.draft);
      this.beginUtility(id,c.type,now);return;
    }
    if(c.type==='pass'){
      assert(s.config.rules!=='rapid','Za strel reši vprašanje.');this.record(id,'skipped');slot.locked={type:'pass'};slot.status='locked';this.maybeLocked(now);return;
    }
    throw Error('Neznan ukaz.');
  }
  answer(id,correct,now){
    const s=this.state,slot=s.slots[id];
    if(slot.utility){this.resolveUtility(id,correct?'correct':'wrong',now);return;}
    this.record(id,correct?'correct':'wrong');
    if(s.config.rules==='rapid'){
      if(correct&&slot.intent==='move'){slot.moveToken=true;slot.moveBonus=1.5;this.prepare(id,now,'attack',true);}
      else if(!correct){slot.cooldownUntil=now+3000;slot.aiAt=null;}
      else slot.status='armed';
    }
  }
  lockAttack(id,now){
    const s=this.state,slot=s.slots[id],plan=planFor(s,id),shot=plan.shot;
    J.Economy.debit(s.tanks[id],shot.credits);shot.effect=J.attackEffect(slot.answerStatus,this.random());P.lockAir(shot,()=>this.random());
    slot.locked={type:'attack',shot,draft:J.clone(slot.draft)};slot.status='locked';
    if(s.config.rules==='rapid'){this.launch(slot.locked,id,now);this.prepare(id,now,'attack',true);refreshImpacts(s,now);}
    else this.maybeLocked(now);
  }
  maybeLocked(now){
    const s=this.state,ids=s.config.rules==='sequential'?[s.active]:s.tanks.filter(t=>t.hp>0).map(t=>t.id);
    if(!ids.every(id=>s.slots[id].status==='locked'))return;
    s.pending=ids.map(id=>({id,...s.slots[id].locked}));
    const attacks=s.pending.filter(p=>p.type==='attack');
    if(!attacks.length||s.config.play==='hotseat'||this.isTraining()){this.launchPending(now);return;}
    s.phase='defense';s.deadline=now+s.config.prepSeconds*1000;
    s.defenders=s.config.rules==='salvo'?s.tanks.filter(t=>t.hp>0).map(t=>t.id):P.threats(attacks[0].shot,s).ids.filter(id=>id!==s.active);
    for(const id of s.defenders)this.prepare(id,now,'move');
    this.maybeDefense(now);
  }
  maybeDefense(now){
    const s=this.state;if(!s.defenders.every(id=>s.slots[id].status==='locked'))return;
    this.addMoves(s.defenders.map(id=>({id,...s.slots[id].locked})),now);
    s.phase='movement';s.deadline=null;
    s.transitionAt=s.moves.length?Math.max(...s.moves.map(m=>m.endAt)):now;
    if(!s.moves.length)this.launchPending(now);
  }
  addMoves(choices,now){
    const s=this.state;
    const plans=choices.filter(c=>c.distance!==0).map(c=>({id:c.id,bonus:c.bonus,path:P.movePath(s,s.tanks[c.id],c.distance,c.bonus)}));
    const conflicts=new Set();
    const all=plans.map(v=>({id:v.id,from:v.path.from,to:v.path.to})).concat(s.moves.map(m=>({id:m.tankId,from:P.moveSample(m,(now-m.at)*RATE/1000).x,to:m.to,existing:true})));
    for(let a=0;a<all.length;a++)for(let b=a+1;b<all.length;b++)if(Math.max(Math.min(all[a].from,all[a].to),Math.min(all[b].from,all[b].to))<Math.min(Math.max(all[a].from,all[a].to),Math.max(all[b].from,all[b].to))+C.tankWidth+.6){conflicts.add(all[a].id);conflicts.add(all[b].id);}
    for(const v of plans){
      if(conflicts.has(v.id)){s.message='Prekrivajoča se premika sta zadržana; strošek ni zaračunan.';continue;}
      if(!v.path.complete)continue;
      J.Economy.debit(s.tanks[v.id],P.moveQuote(s,s.tanks[v.id],v.path.distance,v.bonus).credits);
      s.moves.push({...v.path,tankId:v.id,at:now,endAt:now+v.path.duration*1000/RATE});
    }
  }
  beginUtility(id,type,now){
    const s=this.state,t=s.tanks[id],old=s.slots[id];
    assert(!old.utility,'Izbrano dejanje je že zaklenjeno.');
    if(s.config.rules==='rapid')assert(now>=old.utilityAt,'Varčevanje in ščit imata skupen 8-sekundni premor.');
    const base=type==='save'?J.Economy.income(t.credits,C.saveCredits,t.creditsMax):Math.max(0,Math.min(C.shieldRecharge,(t.credits-C.shieldCredits)*1000/C.creditsPerKJ,t.shieldMax-t.shield));
    assert(base>0,type==='save'?'Dosegel si največjo zalogo denarja.':'Ščit je poln ali ni dovolj denarja.');
    const credits=type==='shield'?J.Economy.money(J.Economy.energyPrice(base)+C.shieldCredits):0;
    this.record(id,'skipped');this.prepare(id,now,type,true);
    const slot=s.slots[id];slot.utility={type,base,credits,deadline:s.deadline??(this.isTraining()?null:now+s.config.prepSeconds*1000),result:null};
    slot.cooldownUntil=0;slot.status='utility-question';
    // Reserve the purchase once. Answering never spends the price again.
    if(credits)J.Economy.debit(t,credits);
  }
  resolveUtility(id,status,now){
    const s=this.state,slot=s.slots[id],u=slot.utility,t=s.tanks[id];
    assert(u&&!u.result,'Nagrada je že obračunana.');
    this.record(id,status);
    const correct=status==='correct',won=correct&&(u.type==='save'||this.random()<1/3),wantedBonus=won?u.base*(u.type==='save'?.5:.25):0;
    const capacity=Math.max(0,u.type==='save'?t.creditsMax-t.credits:t.shieldMax-t.shield),base=Math.min(u.base,capacity),bonus=Math.min(wantedBonus,Math.max(0,capacity-base));
    const total=u.type==='save'?J.Economy.money(base+bonus):base+bonus;
    if(u.type==='save')t.credits=J.Economy.money(t.credits+total);else t.shield+=total;
    u.result={type:u.type,base,total,bonus:total-base,credits:u.credits,won,status,capped:total<u.base+wantedBonus-1e-6};
    slot.feedback.utility=J.clone(u.result);slot.status='utility-result';
    if(s.config.rules==='rapid')slot.utilityAt=now+8000;
    if(this.controlled(id))slot.aiAt=now+700;
  }
  completeUtility(id,now,batch=false){
    const s=this.state,slot=s.slots[id];assert(slot.utility?.result,'Najprej dokončaj vprašanje.');
    slot.locked={type:'utility',utility:J.clone(slot.utility)};slot.status='locked';slot.aiAt=null;slot.utility.deadline=null;
    if(s.config.rules==='rapid')this.prepare(id,now,'attack',true);
    else if(!batch)this.maybeLocked(now);
  }
  utility(id,type){
    const s=this.state,t=s.tanks[id];
    if(type==='save')t.credits+=J.Economy.income(t.credits,10);
    if(type==='shield'){
      const amount=Math.max(0,Math.min(C.shieldRecharge,(t.credits-C.shieldCredits)*1000,t.shieldMax-t.shield));assert(amount>0,'Ščit je poln ali ni dovolj denarja.');
      J.Economy.debit(t,J.Economy.energyPrice(amount)+C.shieldCredits);t.shield+=amount;
    }
  }
  launch(action,id,now){
    const s=this.state,shot=J.clone(action.shot),t=tanksAt(s,now)[id];
    if(shot.weapon==='shell')Object.assign(shot,P.launchAngle(t,P.speed(shot.energy,shot.mass),action.draft.angle,action.draft.direction));
    s.tanks[id].barrelAngle=action.draft.direction===1?action.draft.angle*Math.PI/180:Math.PI-action.draft.angle*Math.PI/180;
    s.flights.push({id:s.id+':'+(++s.counter),shot,at:now+(shot.airDrop?Math.max(0,shot.airDrop.dropTime)*1000/RATE:100),confirmedAt:now});
  }
  launchPending(now){
    const s=this.state;s.phase='action';s.deadline=null;s.transitionAt=null;
    for(const p of s.pending){if(p.type==='attack')this.launch(p,p.id,now);else if(p.type==='shield')s.tanks[p.id].shield=Math.min(s.tanks[p.id].shieldMax,s.tanks[p.id].shield+p.amount);else if(p.type==='utility'){if(s.slots[p.id].utility)s.slots[p.id].utility.revealed=true;}else this.utility(p.id,p.type);}
    s.pending=[];refreshImpacts(s,now);
    if(!s.flights.length)s.transitionAt=now+500;
  }
  noteDeaths(ids){const s=this.state;const fresh=ids.filter(id=>!s.deaths.some(g=>g.ids.includes(id)));if(fresh.length){const last=s.deaths.at(-1);if(last&&Math.abs(last.at-s.now)<=.001)last.ids.push(...fresh);else s.deaths.push({at:s.now,ids:fresh});}}
  endRound(now,reason=''){
    const s=this.state;if(['intermission','finished'].includes(s.phase))return;
    const remaining=s.tanks.filter(t=>t.hp>0).map(t=>t.id),groups=[];
    if(remaining.length)groups.push(remaining); // A stalemate is a shared place, never an ID tie-break.
    groups.push(...s.deaths.map(d=>d.ids).reverse());
    for(const t of s.tanks)if(!groups.some(g=>g.includes(t.id)))groups.push([t.id]);
    let place=1;const rows=[];
    for(const group of groups){const points=[5,3,2,1,0][Math.min(4,place-1)];for(const id of group){s.scores[id]+=points;rows.push({id,place,points,hp:s.tanks[id].hp});}place+=group.length;}
    s.roundResults.push({round:s.round,name:s.roundName,rows,reason});s.phase=this.isTraining()||s.round===3?'finished':'intermission';s.deadline=null;s.transitionAt=null;s.incomeAt=null;s.roundReady=[];
    for(const slot of s.slots)slot.aiAt=null;
    s.now=now;
  }
  finishCycle(now){
    const s=this.state;
    if(s.timedOut){this.endRound(now,'Časovna omejitev 10 minut; preživeli si delijo mesto.');return;}
    if(s.tanks.filter(t=>t.hp>0).length<=1){this.endRound(now);return;}
    if(s.cycle>=60&&!this.isTraining()){this.endRound(now,'Po 60 potezah oziroma salvah si preživeli delijo mesto.');return;}
    if(s.config.rules==='sequential')s.active=(s.active+1)%s.tanks.length;
    this.beginPrep(now);
  }
  ai(id,now){
    const s=this.state,slot=s.slots[id],t=s.tanks[id];slot.aiAt=null;if(!this.eligible(id)||slot.status==='locked'||t.hp<=0)return;
    if(slot.utility){if(!slot.utility.result)this.answer(id,this.random()<[0,.55,.72,.87][s.config.difficulty],now);else this.completeUtility(id,now);return;}
    if(s.config.rules==='rapid'&&slot.moveToken&&!s.moves.some(m=>m.tankId===id)){
      const range=P.moveRange(s,t,slot.moveBonus),distance=AI.defend({range,stageId:s.config.difficulty,aiVersion:28},()=>this.random());
      this.addMoves([{id,distance,bonus:slot.moveBonus}],now);slot.moveToken=false;slot.moveBonus=1;slot.aiAt=now+1200;refreshImpacts(s,now);return;
    }
    if(s.config.rules==='rapid'&&slot.q?.status==='pending'&&s.flights.some(f=>f.shot.attackerId!==id)&&this.random()<.18){slot.intent='move';slot.q=this.draw(id,'move');}
    if(slot.q?.status==='pending')this.answer(id,this.random()<[0,.55,.72,.87][s.config.difficulty],now);
    if(s.slots[id]!==slot)return;
    if(s.phase==='defense'){
      const bonus=slot.answerStatus==='correct'?1.5:1,range=P.moveRange(s,t,bonus);
      slot.locked={type:'move',distance:AI.defend({range,stageId:s.config.difficulty,aiVersion:28},()=>this.random()),bonus};slot.status='locked';this.maybeDefense(now);return;
    }
    if(s.config.rules==='rapid'){
      if(slot.answerStatus!=='correct')return;
      if(s.flights.some(f=>f.shot.attackerId===id)){slot.aiAt=now+1000;return;}
    }
    const choice=AI.choose({actor:{id,x:t.x,y:t.y,credits:t.credits},targets:s.tanks.filter(v=>v.id!==id&&v.hp>0).map(v=>({id:v.id,x:v.x,y:v.y})),history:s.history,worldWidth:s.worldWidth,stageId:s.config.difficulty,aiVersion:28,airMinHeight:P.airLimits(s.terrain,0,90).min},()=>this.random());
    if(choice){slot.draft=cleanDraft(s,id,choice.patch);t.aiTargetId=choice.targetId;}
    if(choice&&planFor(s,id).valid){this.lockAttack(id,now);return;}
    if(s.config.rules==='rapid'&&now<slot.utilityAt){slot.aiAt=now+2000;return;}
    if(t.credits<t.creditsMax)this.beginUtility(id,'save',now);
    else if(s.config.rules==='rapid')slot.aiAt=now+2000;
    else{slot.locked={type:'pass'};slot.status='locked';this.maybeLocked(now);}
  }
  setAutopilot(id,value,now){
    const s=this.state;s.players[id].autopilot=value;
    if(value&&this.eligible(id)&&s.slots[id].status!=='locked')s.slots[id].aiAt=now+1000;
    if(!value)s.slots[id].aiAt=null;
  }
  nextDue(){
    const s=this.state;if(['intermission','finished'].includes(s.phase))return null;
    const times=[s.deadline,s.transitionAt,s.incomeAt,...s.impacts.map(e=>e.at),...s.moves.map(m=>m.endAt)];
    for(const slot of s.slots)if(this.eligible(slot.id)&&s.tanks[slot.id].hp>0){times.push(slot.aiAt,slot.utility?.deadline);if(slot.cooldownUntil>s.now)times.push(slot.cooldownUntil);}
    if(s.config.rules==='rapid'&&!s.timedOut)times.push(s.roundAt+10*60*1000);
    const next=Math.min(...times.filter(t=>t!==null&&t!==undefined&&Number.isFinite(t)));return Number.isFinite(next)?next:null;
  }
  advance(now=Date.now()){
    const s=this.state;let changed=false;
    // Bounded catch-up; remaining due events are picked up by the next alarm.
    for(let count=0;count<300;count++){
      const due=this.nextDue();if(due===null||!Number.isFinite(due)||due>now+.001)break;
      s.now=due;changed=true;
      const hits=s.impacts.filter(e=>e.at<=due+.001);
      if(hits.length){this.noteDeaths(impactBatch(s,hits,due));refreshImpacts(s,due);}
      const ended=s.moves.filter(m=>m.endAt<=due+.001);
      if(ended.length){
        const dead=[];for(const move of ended){const t=s.tanks[move.tankId],was=t.hp;t.x=move.to;t.y=Math.min(move.toY,P.support(s.terrain,move.to));chargeMoveFalls(s,move,due);if(was>0&&t.hp<=0)dead.push(t.id);}
        s.moves=s.moves.filter(m=>!ended.includes(m));this.noteDeaths(dead);refreshImpacts(s,due);
      }
      if(s.phase==='movement'&&!s.moves.length&&s.transitionAt<=due+.001)this.launchPending(due);
      if(s.phase==='action'&&!s.flights.length&&!s.moves.length){
        if(s.transitionAt===null)s.transitionAt=due+900;
        if(s.transitionAt<=due+.001){this.finishCycle(due);continue;}
      }
      if(s.config.rules==='rapid'&&!s.flights.length&&!s.moves.length&&s.tanks.filter(t=>t.hp>0).length<=1){this.endRound(due);continue;}
      if(s.config.rules==='rapid'&&!s.timedOut&&due>=s.roundAt+600000){
        // Stop accepting attacks, but let already launched shots finish.
        s.phase='action';s.incomeAt=null;s.timedOut=true;s.transitionAt=null;
        if(!s.flights.length&&!s.moves.length)this.endRound(due,'Časovna omejitev 10 minut; preživeli si delijo mesto.');
      }
      if(s.incomeAt!==null&&s.incomeAt<=due+.001){for(const t of s.tanks)if(t.hp>0)t.credits+=J.Economy.income(t.credits,15);s.incomeAt+=12000;}
      if(s.deadline!==null&&s.deadline<=due+.001){
        if(s.phase==='prep'){const ids=s.config.rules==='sequential'?[s.active]:s.tanks.filter(t=>t.hp>0).map(t=>t.id);for(const id of ids)if(s.slots[id].status!=='locked'){if(s.slots[id].utility){if(!s.slots[id].utility.result)this.resolveUtility(id,'skipped',due);this.completeUtility(id,due,true);}else{this.record(id,'skipped');s.slots[id].locked={type:'pass'};s.slots[id].status='locked';}}this.maybeLocked(due);}
        else if(s.phase==='defense'){for(const id of s.defenders)if(s.slots[id].status!=='locked'){this.record(id,'skipped');s.slots[id].locked={type:'move',distance:0,bonus:1};s.slots[id].status='locked';}this.maybeDefense(due);}
      }
      for(const slot of [...s.slots]){
        if(!this.eligible(slot.id)||s.slots[slot.id]!==slot)continue;
        if(slot.utility?.deadline!=null&&slot.utility.deadline<=due+.001){if(!slot.utility.result)this.resolveUtility(slot.id,'skipped',due);this.completeUtility(slot.id,due);continue;}
        if(slot.cooldownUntil&&slot.cooldownUntil<=due+.001){this.prepare(slot.id,due,slot.intent,true);continue;}
        if(slot.aiAt!==null&&slot.aiAt<=due+.001)this.ai(slot.id,due);
      }
    }
    s.now=now;if(changed)s.rev++;return changed;
  }
  snapshot(viewer,now=Date.now()){
    const s=this.state,v={};
    for(const key of ['version','id','config','players','round','roundName','stageId','scores','roundResults','worldWidth','worldHeight','moveVersion','worldVersion','legacyAttack','terrain','tanks','phase','active','cycle','turn','deadline','roundReady','message','rev'])v[key]=J.clone(s[key]);
    v.roundEndsAt=s.config.rules==='rapid'?s.roundAt+600000:null;
    v.now=now;v.viewer=viewer;v.defenders=s.phase==='defense'?[...s.defenders]:[];v.moves=J.clone(s.moves);v.flights=J.clone(s.flights);v.effects=J.clone(s.effects.filter(e=>now-e.at<2200));
    for(const f of v.flights){
      if(f.shot.effect)delete f.shot.effect.roll;
      // Public animation limit for an already launched shot, never a damage result.
      const impact=s.impacts.find(e=>e.flightId===f.id);
      if(impact)f.visualEnd={duration:impact.duration,point:{x:impact.hit.point.x,y:impact.hit.point.y}};
    }
    v.traces=J.clone(s.traces.filter(t=>t.actor===viewer));
    v.ready=s.slots.map(slot=>slot.status==='locked');
    const slot=s.slots[viewer];v.own=slot?Object.fromEntries(['id','token','draft','feedback','hintStep','status','answerStatus','cooldownUntil','utilityAt','intent','moveToken','moveBonus'].map(k=>[k,J.clone(slot[k])])):null;
    if(v.own)v.own.utility=slot.status==='locked'?null:J.clone(slot.utility??null);
    if(v.own){v.own.q=publicQuestion(slot.q,slot.hintStep);if(v.own.hintStep>=3&&this.isTraining())v.own.hintText=slot.q.solution;}
    // Owner-only committed aim survives the replacement of the attack slot by defense.
    // Public barrel angles remain unchanged until launch, preserving salvo secrecy.
    const ownAttack=s.pending.find(p=>p.id===viewer&&p.type==='attack')||(slot?.locked?.type==='attack'?slot.locked:null);
    if(v.own)v.own.committedAction=ownAttack?'attack':slot.locked?.type??null;
    if(v.own)v.own.lockedBarrelAngle=ownAttack?(ownAttack.draft.direction===1?ownAttack.draft.angle*Math.PI/180:Math.PI-ownAttack.draft.angle*Math.PI/180):null;
    v.learning=s.learning.map(({attempts,correct,wrong,skipped,hints,byKind})=>({attempts,correct,wrong,skipped,hints,byKind:J.clone(byKind)}));
    v.canAct=this.eligible(viewer)&&!this.controlled(viewer)&&slot.status!=='locked';
    // Conceal committed attack prices and barrel vectors until everyone fires.
    for(const t of v.tanks)if(t.id!==viewer&&['prep','defense','movement'].includes(s.phase)){
      const attack=s.pending.find(p=>p.id===t.id)||s.slots[t.id].locked;
      if(attack?.type==='attack')t.credits=J.Economy.money(t.credits+attack.shot.credits);
      if(attack?.type==='shield')t.credits=J.Economy.money(t.credits+attack.credits);
      // A settled utility is still private until the simultaneous commitments launch.
      const u=s.slots[t.id].utility||attack?.utility;
      if(u&&!u.revealed&&s.config.rules!=='rapid'){t.credits=J.Economy.money(t.credits+u.credits-(u.type==='save'?(u.result?.total||0):0));if(u.type==='shield')t.shield-=u.result?.total||0;}

    }
    return v;
  }
}
