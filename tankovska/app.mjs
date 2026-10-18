import {J} from './shared.mjs';
import {Match,RULES,TOPICS,VERSION} from './match.mjs';
import {planFor,cleanDraft} from './combat.mjs';
import {Arena,previewAllowed} from './arena.mjs';
import {icon} from './icons.mjs';
import {rulesBrief,rulesDetails,guideSteps} from './guide.mjs';
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k,session=false){try{return JSON.parse((session?sessionStorage:localStorage).getItem(k));}catch{return null;}},set(k,v,session=false){try{(session?sessionStorage:localStorage).setItem(k,JSON.stringify(v));}catch{}}};
const descriptions={sequential:'Vsak pripravi svoj strel. Pravilen odgovor lahko okrepi napad; ogroženi se lahko pred strelom umaknejo.',salvo:'Vsi pripravljajo hkrati. Ko poteze zaklenete, sledi obramba in skupen izstrel. Nastavitve drugih ostanejo skrite.',rapid:'Pravilni odgovor odklene en strel. Naslednje vprašanje rešuješ že med letom. Napačen odgovor pomeni 3 s premora.'};
let mode='solo',local=null,state=null,room=null,viewer=0,draft=null,draftKey='',questionKey='',socket=null,seq=0,online=false,credentials=null,retry=null,retryCount=0,offset=0,pending=new Set(),handoffKey='',acceptedHandoff='',lastPaint=0,lastLocalRev=-1,feedbackKey='',demoState=null;
let guide=null,initialPause=null,settingsOpen=false,questionInstance=null,questionCollapsed=false,answerMatch=null;
const answerInputs=new Map(),guidedRooms=new Set();
const arena=new Arena($('arena')),demo=new Arena($('demo')),sound=new J.Sound(false);
const serverNow=()=>Date.now()+offset;
let traceSelection=null,traceUntil=0,traceHold=false,traceContext='';
let toastTimer;
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5500);}
function setupMode(value){
  mode=value;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('selected',b.dataset.mode===mode));
  const restricted=['training','hotseat'].includes(mode);$('rules').disabled=restricted;if(restricted)$('rules').value='sequential';
  $('humans-label').hidden=!['online','hotseat'].includes(mode);if(!['online','hotseat'].includes(mode))$('humans').value='1';
  for(const o of $('humans').options)o.disabled=Number(o.value)>Number($('total').value)||mode==='hotseat'&&Number(o.value)>3;
  if($('humans').selectedOptions[0]?.disabled)$('humans').value=String(Math.min(Number($('total').value),mode==='hotseat'?3:5));
  $('training-terrain-label').hidden=mode!=='training';$('timer-label').hidden=mode==='training'||$('rules').value==='rapid';
  $('join-section').hidden=mode!=='online';$('resume').hidden=!lastCredentials();
  const number=mode==='hotseat'?Number($('humans').value):1,old=Array.from($('names').querySelectorAll('input')).map(i=>i.value);
  $('names').innerHTML=Array.from({length:number},(_,i)=>`<label>${number>1?'Igralec '+(i+1):'Tvoje ime'}<input id="name-${i}" maxlength="18" autocomplete="off" value="${esc(old[i]||(i===0?store.get('tank-name'):null)||('Igralec '+(i+1)))}"></label>`).join('');
  $('cpu-count').textContent=(Number($('total').value)-Number($('humans').value))+' × CPU';
  $('rules-description').textContent=mode==='training'?'Brez časovne omejitve. Mirujoči nasprotniki, postopni namigi in ponovitev istega terena.':mode==='hotseat'?'Na isti tipkovnici se izmenjuje največ 3 ljudi; skupaj je lahko do 5 tankov. Izmika ni za nikogar.':descriptions[$('rules').value];
  $('rules-brief').innerHTML=rulesBrief(getConfig());
  $('start').textContent=mode==='online'?'Ustvari spletno sobo':mode==='training'?'Začni trening':'Začni tri runde';
  $('mode-title').textContent=mode==='training'?'Razišči, kaj spremeni strel.':mode==='hotseat'?'Ena tipkovnica. Do trije igralci.':mode==='online'?'Vsak svoj zaslon. Ista arena.':'Vsak strel spremeni areno.';
  $('mode-detail').textContent=mode==='training'?'Spreminjaj maso, silo in kot. Sledi poti izstrelka ter preveri račun s postopnimi namigi.':mode==='hotseat'?'Izberi število ljudi in skupno število tankov. Preostale sedeže zasede računalnik.':mode==='online'?'Ustvari sobo, deli njeno kodo in počakaj na ostale. Vsak izbira in rešuje na svojem zaslonu.':'Eksplozije naredijo kraterje. Teren pod tankom se lahko udre. Med rundami dobiš svežo areno in novo zalogo.';
  if(J.Bank.ready){demoState=Match.create({...getConfig(),play:'training',humanCount:1},[], 'preview',Date.now()).snapshot(0);demoState.canAct=false;demo.draw(demoState,null,Date.now());}
}
function getConfig(){return {play:mode,rules:$('rules').value,totalPlayers:Number($('total').value),humanCount:Number($('humans').value),difficulty:Number($('difficulty').value),questionDifficulty:Number($('question-difficulty').value),prepSeconds:Number($('prep').value),trainingRound:Number($('training-terrain').value),topics:Object.fromEntries([...document.querySelectorAll('.topics input')].map(i=>[i.value,i.checked]))};}
function showOnly(id){if(id!=='battle')endAimDrag();for(const name of ['home','lobby','battle','results'])$(name).hidden=name!==id;$('menu').hidden=id==='home';document.body.classList.toggle('playing',id==='battle');}
function names(){return Array.from($('names').querySelectorAll('input')).map(i=>J.playerName(i.value));}
function rememberLocal(){if(local)store.set('tank-local-v04',local.state);}
function localSnapshot(){
  const s=local.state;
  if(s.config.play==='hotseat'&&s.phase==='prep'&&s.players[s.active].kind==='human'){
    viewer=s.active;handoffKey=s.id+':'+s.round+':'+s.turn+':'+viewer;
  }
  state=local.snapshot(viewer);render();
}
function startLocal(){online=false;viewer=0;acceptedHandoff='';handoffKey='';questionKey='';draftKey='';settingsOpen=false;feedbackKey='';answerInputs.clear();local=Match.create(getConfig(),names(),crypto.randomUUID());lastLocalRev=-1;store.set('tank-name',names()[0]);localSnapshot();rememberLocal();if(!store.get('tank-hide-guide-v042'))openGuide(true);}
function send(type,extra={}){
  if(guide)return;
  if(online&&pending.size)return false;
  sound.unlock();
  const command={type,matchId:state?.id,round:state?.round,token:state?.own?.token,...extra};
  try{
    if(online){if(socket?.readyState!==WebSocket.OPEN)throw Error('Povezava se obnavlja. Počakaj.');command.protocol=2;command.seq=++seq;pending.add(seq);socket.send(JSON.stringify(command));updateButtons();}
    else{local.command(viewer,command);localSnapshot();rememberLocal();}
    if(['fire','save','shield','dodge','continue-utility'].includes(type)){hideTrace();settingsOpen=false;refreshControls();}
    return true;
  }catch(e){toast(e.message);if(local&&!online)localSnapshot();return false;}
}
function lastCredentials(){return store.get('tank-session-v04',true)||store.get('tank-last-room-v04');}
function rememberCredentials(){store.set('tank-session-v04',credentials,true);store.set('tank-last-room-v04',credentials);}
async function createRoom(){
  const config=getConfig();$('start').disabled=true;
  try{const response=await fetch('/api/rooms',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(config)});let data;try{data=await response.json();}catch{throw Error('Za spletne sobe zaženi npm run dev:online ali objavi paket na Cloudflare. Lokalni načini že delujejo.');}if(!response.ok)throw Error(data.error||'Sobe ni mogoče ustvariti.');credentials={code:data.code,hostToken:data.hostToken,name:names()[0]};rememberCredentials();connect();}catch(e){toast(e.message);}finally{$('start').disabled=false;}
}
function connect(){
  clearTimeout(retry);online=true;local=null;state=null;room=null;questionKey='';draftKey='';seq=0;pending.clear();offset=0;
  $('connection').hidden=false;$('connection').textContent='Povezovanje v sobo '+credentials.code+' …';
  if(socket){socket.onclose=null;socket.close();}
  const url=new URL('/ws/'+credentials.code,location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('name',credentials.name);
  if(credentials.resumeToken)url.searchParams.set('resume',credentials.resumeToken);else if(credentials.hostToken)url.searchParams.set('host',credentials.hostToken);
  const ws=socket=new WebSocket(url);
  ws.onmessage=e=>{
    if(ws!==socket)return;let data;try{data=JSON.parse(e.data);}catch{return;}
    if(data.type==='welcome'){credentials.resumeToken=data.resumeToken;delete credentials.hostToken;rememberCredentials();retryCount=0;}
    if(data.type==='ack'){pending.delete(data.seq);updateButtons();}
    if(data.type==='error'){pending.delete(data.seq);toast(data.message);updateButtons();}
    if(data.type==='state'){
      room=data;viewer=data.viewer;offset=data.serverNow-Date.now();state=data.game;
      $('connection').hidden=true;
      const me=data.players[viewer];if(me?.pendingReturn){$('connection').hidden=false;$('connection').textContent='Računalnik zaključuje potezo. Upravljanje se vrne ob naslednji pripravi.';}
      if(state)render();else renderLobby();
    }
  };
  ws.onerror=()=>{};
  ws.onclose=event=>{
    if(!online||ws!==socket)return;pending.clear();$('connection').hidden=false;
    if(event?.reason?.startsWith('Sedež je obnovljen')){$('connection').textContent='Ta sedež je odprt v drugem zavihku. Za vrnitev uporabi Nadaljuj spletno sobo v meniju.';updateButtons();return;}
    retryCount++;$('connection').textContent=retryCount<5?'Povezava je prekinjena. Obnavljam … Po 30 s sedež začasno prevzame CPU.':'Povezava ni uspela. Preveri omrežje ali se iz menija znova pridruži sobi.';
    if(retryCount<5)retry=setTimeout(connect,Math.min(8000,1000*2**(retryCount-1)));updateButtons();
  };
}
function renderLobby(){
  showOnly('lobby');$('room-code').textContent=room.code;$('lobby-config').textContent=RULES[room.config.rules]+' · '+room.config.humanCount+' ljudi · '+(room.config.totalPlayers-room.config.humanCount)+' CPU';
  $('lobby-players').innerHTML=room.players.map((p,i)=>`<div class="lobby-seat"><strong>${p?esc(p.name):'Prost sedež '+(i+1)}</strong><span>${p?(p.connected?(p.ready?'✓ Pripravljen':'Čaka na potrditev'):'Brez povezave'):'Čakamo igralca'}</span></div>`).join('');
  $('ready').textContent=room.players[viewer]?.ready?'Prekliči pripravljenost':'Pripravljen sem';
}
function render(){
  if(!state)return;const s=state,slot=s.own,t=s.tanks[viewer];
  if(['intermission','finished'].includes(s.phase)){renderResults();return;}
  showOnly('battle');
  const traceOwner=s.id+':'+s.round+':'+viewer;if(traceOwner!==traceContext){hideTrace();traceContext=traceOwner;}
  $('match-label').textContent=(s.config.play==='training'?'TRENING':s.config.play==='hotseat'?'HOTSEAT':online?'SOBA '+room.code:'PROTI RAČUNALNIKU')+' · '+RULES[s.config.rules];
  $('round-title').textContent=(s.config.play==='training'?'Trening · ':'Runda '+s.round+'/3 · ')+s.roundName;
  const phase={prep:s.config.rules==='salvo'?'Priprava salve':s.config.rules==='rapid'?'Boj poteka':s.tanks[s.active].name+' pripravlja potezo',defense:'Obrambni premiki',movement:'Premikanje',action:'Izvedba napadov'};
  const namesOf=ids=>ids.map(id=>s.tanks[id].name).join(', ');
  $('phase-label').textContent=s.phase==='prep'?(s.config.rules==='salvo'?'Pripravljajo: '+namesOf(s.tanks.filter(t=>t.hp>0&&!s.ready[t.id]).map(t=>t.id)):s.config.rules==='rapid'?'Sočasni boj · vsi živi igralci':'Na potezi: '+s.tanks[s.active].name):s.phase==='defense'?'Obramba: '+namesOf(s.defenders):phase[s.phase]||s.phase;
  $('score-strip').hidden=s.config.play==='training';
  $('score-strip').innerHTML='<span class="score-caption">Skupne točke vseh rund:</span>'+s.tanks.map(t=>`<span class="player-score ${t.id===viewer?'mine':''} ${t.hp<=0?'dead':''}" style="--color:${t.color}" title="${esc(t.name)}: ${s.scores[t.id]} skupnih točk">${esc(t.name)} <b>${s.scores[t.id]}</b></span>`).join('');
  const key=s.id+':'+s.round+':'+slot.token;
  if(draftKey!==key){endAimDrag();draft=J.clone(slot.draft);draftKey=key;syncDraftInputs();$('dodge').value='0';settingsOpen=false;}
  const handoff=s.config.play==='hotseat'&&s.phase==='prep'&&s.players[s.active].kind==='human'&&acceptedHandoff!==handoffKey;
  $('handoff').hidden=!handoff||initialPause!==null;$('handoff-name').textContent=t.name;$('controls').inert=handoff;$('question-panel').inert=handoff;
  $('question-panel').style.visibility=handoff&&initialPause===null?'hidden':'visible';
  $('actor-name').textContent=t.name+(t.hp<=0?' · izločen':'');$('wallet').textContent=J.money(t.credits);
  $('training-help').hidden=s.config.play!=='training';$('rapid-intent').hidden=s.config.rules!=='rapid'||!s.canAct||!!slot.utility;$('intent').value=slot.intent;
  renderQuestion();renderFeedback();refreshControls();updateButtons();
  const l=s.learning[viewer];$('learning-summary').textContent=l.correct+' / '+l.attempts+' pravilno'+(l.hints?' · '+l.hints+' z namigom':'');
  for(const f of s.flights)if(serverNow()-f.confirmedAt<700)sound.once(f.id,f.shot.weapon==='rock'?'portal':'cannon');
  for(const e of s.effects)sound.once(e.id+'hit',e.absorbed?'shield':e.weapon==='rock'?'rockImpact':'earth');
}
function syncDraftInputs(){
  $('target').max=state.worldWidth;const limits=J.Physics.airLimits(state.terrain,draft.targetX,state.worldHeight);draft.height=J.clamp(draft.height,limits.min,limits.max);$('height').min=limits.min;$('height').max=limits.max;
  $('height').value=draft.height;$('target').value=draft.targetX;
}
function renderMassChoices(){
  const selected=draft.weapon==='rock'?'rock':draft.projectile,mass=draft.weapon==='rock'?draft.rockMass:draft.mass;
  const html=(draft.weapon==='rock'?[50,100,200]:[20,40,80]).map(m=>`<button id="mass-${m}" type="button" data-mass="${m}" class="${mass===m?'selected':''}" aria-pressed="${mass===m}">${m} kg<small>${J.money(J.Economy.itemPrice(selected,m))}</small></button>`).join('');
  if($('mass-choices').innerHTML===html)return;
  $('mass-choices').innerHTML=html;
  for(const b of $('mass-choices').querySelectorAll('button'))b.addEventListener('click',()=>{
    if(!canAim())return;draft[draft.weapon==='rock'?'rockMass':'mass']=Number(b.dataset.mass);
    settingsOpen=draft.weapon==='rock';refreshControls();$('arena').focus({preventScroll:true});
  });
}
function refreshControls(){
  if(!state||!draft)return;const s=state,t=s.tanks[viewer],defense=s.phase==='defense'&&s.defenders.includes(viewer),rapidMove=s.config.rules==='rapid'&&s.own.moveToken;
  $('arena-note').textContent=defense?'← / → premik · presledek potrdi premik':draft.weapon==='rock'?'Miška: cilj · ← / → cilj · ↑ / ↓ višina · presledek strel':'Miška: klikni in vleci · ← / → cev · ↑ / ↓ sila · presledek strel';
  $('attack-controls').hidden=defense||!s.canAct||!!s.own.utility;$('defense-controls').hidden=!(defense||rapidMove)||!s.canAct||!!s.own.utility;
  $('battlefield').classList.toggle('rapid-move',!!rapidMove);
  $('battle-actions').hidden=!!rapidMove||defense;
  $('weapon-popover').hidden=!settingsOpen||!s.canAct||defense||!!s.own.utility;$('aim-readout').hidden=false;
  $('aim-settings').setAttribute('aria-expanded',String(settingsOpen));
  $('rock-controls').hidden=draft.weapon!=='rock';$('flip-direction').hidden=draft.weapon==='rock';
  $('height-output').textContent=J.num(draft.height)+' m';$('target-output').textContent=J.num(draft.targetX)+' m';
  $('aim-label').textContent=draft.weapon==='rock'?'VIŠINA':'KOT';renderMassChoices();
  const plan=planFor({...s,slots:[]},viewer,draft);$('quote').textContent=plan.valid?'Cena strela: '+J.money(plan.shot.credits):plan.reason;$('quote').classList.toggle('invalid',!plan.valid);
  const selected=draft.weapon==='rock'?'rock':draft.projectile;
  $('weapon-title').textContent=J.PROJECTILES[selected].label;
  $('item-price').textContent=draft.weapon==='rock'?'Energija dviga in gibanja se prišteje ceni.\n↑ ↓ višina · ← → cilj':'Energija se prišteje ceni izstrelka.\n↑ ↓ sila · ← → naklon';
  $('energy-value').textContent=J.energy(plan.shot.baseCost);$('aim-value').textContent=J.num(draft.weapon==='rock'?draft.height:draft.angle,1)+(draft.weapon==='rock'?' m':'°');
  $('aim-secondary').textContent=draft.weapon==='rock'?draft.rockMass+' kg · cilj '+J.num(draft.targetX,1)+' m · raztros ±'+J.num(plan.shot.airDrop.spread)+' m':J.num(draft.force/1000)+' kN · '+draft.mass+' kg · '+(draft.direction===1?'desno →':'← levo');
  for(const key of ['ball','cone','rod','rock']){
    const chosen=key===selected,b=$('weapon-'+key),fee=J.Economy.itemPrice(key,draft.mass),label=J.PROJECTILES[key].label;
    const html=icon(key)+`<span class="tool-badge">${chosen?(draft.weapon==='rock'?draft.rockMass:draft.mass)+' kg':J.money(fee)}</span>`;if(b.innerHTML!==html)b.innerHTML=html;
    b.classList.toggle('selected',chosen);b.setAttribute('aria-pressed',String(chosen));b.setAttribute('aria-expanded',String(chosen&&settingsOpen));b.setAttribute('aria-controls','weapon-popover');b.title=label+' · izstrelek '+J.money(fee)+' + energija. Klikni za maso in ceno.';
  }
  if(defense||rapidMove){const bonus=rapidMove?s.own.moveBonus:s.own.answerStatus==='correct'?1.5:1,range=J.Physics.moveRange(s,t,bonus);$('dodge').min=-range.left;$('dodge').max=range.right;$('dodge').value=J.clamp(Number($('dodge').value),-range.left,range.right);updateDodge();$('defense-description').textContent=defense?'Izberi premik ali ostani. Pravilni odgovor omogoči 1,5-kratno razdaljo ob enakem strošku.':'Pripravljen imaš en obrambni premik.';}
  $('wait-message').textContent=s.canAct?'':t.hp<=0?'Izločen si v tej rundi. Naslednjo začneš z novo zalogo.':s.own.status==='locked'?'Poteza je potrjena. Čakamo ostale igralce.':s.config.rules==='sequential'?'Opazuj izvedbo. Kmalu sledi naslednja poteza.':'Počakaj na naslednjo pripravo.';
  updateButtons();
}
function updateButtons(){
  if(!state)return;const s=state,busy=online&&(pending.size>0||socket?.readyState!==WebSocket.OPEN),armed=s.own.answerStatus==='correct'&&s.own.intent==='attack';
  const flight=s.flights.some(f=>f.shot.attackerId===viewer),plan=draft?planFor({...s,slots:[]},viewer,draft):null,t=s.tanks[viewer];
  const waiting=s.config.rules==='salvo'?s.tanks.filter(t=>t.hp>0&&!s.ready[t.id]).map(t=>t.name).join(', '):'';
  let label=s.config.rules==='salvo'?'Zakleni strel':'Strel',reason='',question=false;
  if(busy){label='Potrjujem …';reason='Čakamo povezavo ali potrditev dejanja.';}
  else if(s.own.utility){label=s.own.utility.result?'Nadaljuj':'Reši vprašanje';reason=s.own.utility.result?'Nagrada je obračunana. Nadaljuj po pregledu postopka.':'Izbrano: '+(s.own.utility.type==='save'?'varčevanje':'obnova ščita')+'. Odgovori ali nadaljuj brez bonusa.';question=s.canAct;}
  else if(!s.canAct){label=s.own.status==='locked'?(s.own.committedAction==='attack'?'Napad potrjen':'Dejanje potrjeno'):'Počakaj';reason=t.hp<=0?'Izločen si v tej rundi.':s.own.status==='locked'?(waiting?'Potrjeno. Čakamo: '+waiting:'Dejanje je potrjeno. Sledi izvedba.'):'Na potezi: '+(s.tanks[s.active]?.name||'drugi igralci');}
  else if(s.phase!=='prep'){label='Obramba';reason='Izberi premik ali ostani na mestu.';}
  else if(s.config.rules==='rapid'&&flight){label='Izstrelek leti';reason='Tvoj izstrelek je še v letu. Medtem lahko rešiš naslednje vprašanje.';}
  else if(!plan?.valid){label='Premalo denarja';reason=plan?.reason||'Izberi nastavitve.';if(plan?.shot.credits>t.credits)reason='Manjka '+J.money(plan.shot.credits-t.credits)+'. Zmanjšaj energijo ali izberi Varčuj.';else label='Preveri nastavitve';}
  else if(s.config.rules==='rapid'&&s.own.cooldownUntil>serverNow()){label='Novo vprašanje';reason='Novo vprašanje čez '+Math.ceil((s.own.cooldownUntil-serverNow())/1000)+' s.';}
  else if(s.config.rules==='rapid'&&!armed){label='Reši za strel';reason='Pravilen odgovor odklene naslednji strel. Klikni za vprašanje.';question=true;}
  $('fire').disabled=!!reason&&!question;$('fire').dataset.question=String(question);
  paintAction('fire',label,s.own.utility?'Vprašanje':J.money(plan?.shot.credits||0),reason||'Presledek · cena izstrelka in energije');
  $('action-status').textContent=reason;$('wait-message').textContent='';
  const cooldown=s.config.rules==='rapid'?Math.max(0,Math.ceil((s.own.utilityAt-serverNow())/1000)):0;
  const amount=Math.max(0,Math.min(J.C.shieldRecharge,(t.credits-J.C.shieldCredits)*1000/J.C.creditsPerKJ,t.shieldMax-t.shield));
  const shieldCost=amount>0?J.Economy.money(J.Economy.energyPrice(amount)+J.C.shieldCredits):0,gain=J.Economy.income(t.credits,J.C.saveCredits,t.creditsMax);
  for(const id of ['save','shield'])$(id).disabled=busy||!s.canAct||!!s.own.utility||s.phase!=='prep'||cooldown>0||(id==='shield'&&amount<=0)||(id==='save'&&gain<=0);
  paintAction('shield','Ščit',J.money(shieldCost),cooldown?'Ponovno čez '+cooldown+' s':amount>0?'Obnovi '+J.energy(amount):'Ščit je poln ali ni dovolj denarja.');
  paintAction('save','Varčuj','+'+J.money(gain),cooldown?'Ponovno čez '+cooldown+' s':gain>0?'Izrecno varčevanje doda '+J.money(gain):'Dosegel si največjo zalogo denarja.');
  for(const id of ['move','stay'])$(id).disabled=busy||!s.canAct||!!s.own.utility||s.moves.some(m=>m.tankId===viewer);
  if($('answer-button'))$('answer-button').disabled=busy||!s.canAct||serverNow()<s.own.cooldownUntil;
  for(const id of ['skip-utility','continue-utility'])$(id).disabled=busy||!s.canAct;
  $('intent').disabled=busy||!!s.own.utility||s.own.q?.status!=='pending'||s.own.cooldownUntil>serverNow();
}
function paintAction(id,label,badge,detail){const b=$(id),html=icon(id)+`<span class="tool-name">${label}</span><span class="tool-badge">${badge}</span>`;if(b.innerHTML!==html)b.innerHTML=html;b.title=label+' · '+badge+' · '+detail;b.setAttribute('aria-label',b.title);}
function updateDodge(){if(!state)return;const d=Number($('dodge').value),bonus=state.config.rules==='rapid'?state.own.moveBonus:state.own.answerStatus==='correct'?1.5:1,cost=J.Physics.moveQuote(state,state.tanks[viewer],d,bonus).credits;$('dodge-output').textContent=J.num(d)+' m · '+J.money(cost);}
function renderQuestion(){
  const s=state,q=s.own.q,key=[s.id,s.round,q?.instance,q?.status,s.own.hintStep,s.canAct,s.phase,s.own.intent].join(':');
  if(answerMatch!==s.id){answerInputs.clear();questionInstance=null;answerMatch=s.id;}
  $('question-badge').textContent=q?TOPICS[q.kind]:'';
  $('question-heading').textContent=s.own.utility?(s.own.utility.type==='save'?'Varčevanje — dodatni denar':'Obnova ščita — možnost bonusa'):s.phase==='defense'||s.own.intent==='move'?'Obrambni izziv':'Fizikalni izziv';
  $('question-context').textContent=s.tanks[viewer].name+' · '+(s.own.utility?(s.own.utility.type==='save'?'Varčevanje':'Ščit'):s.phase==='defense'||s.own.intent==='move'?'Obramba':'Napad')+(q?' · '+TOPICS[q.kind]:'');
  const moving=s.phase==='defense'||s.own.intent==='move';
  $('question-purpose').hidden=!s.canAct||!q||q.status!=='pending';
  $('utility-actions').hidden=!s.own.utility||!s.canAct;$('skip-utility').hidden=!!s.own.utility?.result;$('continue-utility').hidden=!s.own.utility?.result;
  $('question-purpose').textContent=s.own.utility?(s.own.utility.type==='save'?'Pravilen odgovor prinese 50 % več denarja za to varčevanje.':'Pravilen odgovor: ⅓ možnosti za 25 % dodatne obnove ščita brez doplačila.') :moving?(s.config.rules==='rapid'?'Reši vprašanje in odkleni obrambni premik z 1,5-kratnim dosegom.':'Reši vprašanje za 1,5-krat daljši obrambni premik ob enakem strošku.'):(s.config.rules==='rapid'?'Reši vprašanje in odkleni naslednji strel. ':'Reši vprašanje za možnost močnejšega naslednjega zadetka. ')+`Pravilen odgovor: ${Math.round(J.C.criticalChance*100)} % možnosti za ${J.num(J.C.criticalMultiplier)}-kratni učinek napada.`;
  if(q?.instance!==questionInstance)questionCollapsed=false;
  paintQuestionVisibility();
  if(questionKey===key)return;
  if($('answer')&&questionInstance!==null)answerInputs.set(questionInstance,{text:$('answer').value,unit:$('unit').value});
  questionKey=key;questionInstance=q?.instance??null;
  if(answerInputs.size>30)answerInputs.delete(answerInputs.keys().next().value);
  if(!s.canAct||!q){$('question').innerHTML='<p class="muted">Vprašanje se pojavi, ko pripravljaš svoje dejanje.</p>';return;}
  if(q.status!=='pending'){
    if(!guide&&['answer','unit','answer-button'].includes(document.activeElement?.id))$('arena').focus({preventScroll:true});
    $('question').innerHTML='';return;
  }
  const note=s.own.utility?'Dejanje je izbrano. Napačen ali preskočen odgovor ohrani osnovno nagrado.':s.config.rules==='rapid'?'Pravilen odgovor odklene dejanje.':s.phase==='defense'?'Pravilen odgovor izboljša premik.':'Pravilen odgovor lahko okrepi napad. Strel lahko potrdiš tudi brez odgovora.';
  $('question').innerHTML=`<p class="question-note">${note}</p><h3 class="question-title">${esc(q.title)}</h3>${q.givenLines?.length?'<div class="given">'+esc(q.givenLines.join('\n'))+'</div>':''}<p class="question-note">${esc(q.note)}</p><form id="answer-form"><div class="answer-row"><label for="answer" class="sr-only">Odgovor</label><input id="answer" inputmode="decimal" autocomplete="off" placeholder="Rezultat" aria-label="Številski odgovor"><label for="unit" class="sr-only">Enota</label><select id="unit" aria-label="Enota">${q.units.map(u=>`<option>${esc(u)}</option>`).join('')}</select></div><button id="answer-button" class="answer-button" type="submit">Preveri odgovor</button></form>${s.config.play==='training'?`<button id="hint-button" class="quiet" style="width:100%;margin-top:10px" ${s.own.hintStep>=3?'disabled':''}>Namig ${Math.min(3,s.own.hintStep+1)} / 3</button>`:''}${s.own.hintStep?'<div class="hint">'+esc(s.own.hintStep===1?'Izpiši podane količine in iskano količino. Pretvori jih v ustrezne enote. Nato izberi zvezo med njimi.':s.own.hintStep===2?q.formula:s.own.hintText)+'</div>':''}`;
  $('answer-form').addEventListener('submit',e=>{e.preventDefault();send('answer',{questionId:q.instance,text:$('answer').value,unit:$('unit').value});});
  $('hint-button')?.addEventListener('click',()=>send('hint'));
  const saved=answerInputs.get(q.instance);if(saved){$('answer').value=saved.text;$('unit').value=saved.unit;}
}
function renderFeedback(){
  const f=state.own.feedback,current=f?.question.instance===state.own.q?.instance;
  $('feedback').hidden=!f||!current&&f.status==='skipped'&&!f.utility;if($('feedback').hidden)return;
  const key=state.id+':'+f.question.instance+':'+f.at+':'+f.status+':'+current;
  if(key===feedbackKey)return;feedbackKey=key;sound.once(state.id+':'+f.at,f.status==='correct'?'bonus':'wrong');
  const correct=f.status==='correct',label=correct?'PRAVILEN ODGOVOR':f.status==='wrong'?'NAPAČEN ODGOVOR':'VPRAŠANJE PRESKOČENO';
  $('feedback').className='feedback '+f.status;
  const u=f.utility,reward=u?(u.type==='save'?`Prejel si ${J.money(u.total)}${u.bonus>0?' · bonus '+J.money(u.bonus):' · brez dodatnega bonusa'}.`:`Ščit obnovljen za ${J.energy(u.total)}${u.bonus>0?' · bonus '+J.energy(u.bonus):u.capped?' · dosežen največji ščit':u.status==='correct'?' · pravilno, tokrat brez dodatnega ščita':' · brez dodatnega bonusa'}.`):'';
  const result=`<div class="feedback-result"><span class="feedback-symbol" aria-hidden="true">${correct?'✓':f.status==='wrong'?'✕':'—'}</span><h3 class="feedback-title">${label}</h3></div>${reward?`<p class="feedback-reward">${esc(reward)}</p>`:''}<div class="feedback-working"><h4>Postopek reševanja</h4>${f.question.formula?`<p class="feedback-formula">${esc(f.question.formula)}</p>`:''}<p class="feedback-solution">${esc(f.question.solution||'')}</p></div>`;
  $('feedback').innerHTML=current?result:`<details open><summary>Rezultat prejšnjega vprašanja · ${esc(TOPICS[f.question.kind]||'')}</summary>${result}</details>`;
  $('question-body').scrollTop=0;
  if(f.status!=='skipped'||current&&f.utility){questionCollapsed=false;paintQuestionVisibility();}

}
function renderResults(){
  showOnly('results');const s=state,done=s.phase==='finished',latest=s.roundResults.at(-1),ordered=s.players.map(p=>({...p,points:s.scores[p.id]})).sort((a,b)=>b.points-a.points),training=s.config.play==='training';
  const rows=ordered.map((p,i)=>{const r=latest.rows.find(r=>r.id===p.id),rank=ordered.findIndex(x=>x.points===p.points)+1;return `<tr><td>${rank}.</td><td style="color:${s.tanks[p.id].color}">${esc(p.name)}</td><td>${r.place}. / +${r.points}</td><td><strong>${p.points}</strong></td></tr>`;}).join('');
  const learningRows=s.players.filter(p=>p.kind==='human').map(p=>{const l=s.learning[p.id];return `<tr><td>${esc(p.name)}</td><td>${l.correct} / ${l.attempts}</td><td>${l.skipped}</td><td>${l.hints}</td></tr>`;}).join('');
  $('results').innerHTML=`<p class="eyebrow">${training?'TRENING KONČAN':done?'KONEC TREH RUND':'RUNDA '+s.round+' / 3'}</p><h1>${training?'Čas za nov poskus.':done?'Skupni rezultat':'Runda je zaključena.'}</h1><p class="muted">${esc(latest.reason||'Enako mesto prinese enake točke. Vrstni red prikaza ne odloča o zmagovalcu.')}</p><table><thead><tr><th>Skupno mesto</th><th>Igralec</th><th>Mesto / točke te runde</th><th>Skupne točke vseh rund</th></tr></thead><tbody>${rows}</tbody></table><h2>Učni rezultat</h2><table><thead><tr><th>Igralec</th><th>Pravilno / rešeno</th><th>Preskočeno</th><th>Z namigom</th></tr></thead><tbody>${learningRows}</tbody></table><p class="muted">${training?'Ponovi isti teren in primerjaj drug kot, maso ali silo.':done?'Točke boja in učni rezultat ostaneta ločena.':'V naslednji rundi se obnovijo zdravje, ščit in denar. Teren in razpored tankov se spremenita.'}</p><div class="result-buttons">${training?'<button id="result-replay" class="primary">Ponovi trening</button>':!done?`<button id="next-round" class="primary" ${s.roundReady.includes(viewer)?'disabled':''}>${s.roundReady.includes(viewer)?'Čakamo ostale …':'Pripravljen na '+(s.round+1)+'. rundo'}</button>`:''}<button id="result-menu">V meni</button></div>`;
  $('next-round')?.addEventListener('click',()=>send('next-round'));$('result-replay')?.addEventListener('click',()=>send('replay'));$('result-menu').addEventListener('click',goHome);
}
function helpConfig(){return state?.config||room?.config||getConfig();}
function openGuide(initial=false,after=null){
  endAimDrag();guide={step:0,steps:guideSteps(helpConfig()),initial,after,previousFocus:document.activeElement};
  if(initial&&!online&&local){initialPause=Date.now();$('handoff').hidden=true;$('question-panel').style.visibility='visible';}
  $('hide-guide').checked=!!store.get('tank-hide-guide-v042');$('help-layer').hidden=false;paintGuide();$('help-card').focus();
}
function openRules(){
  endAimDrag();guide={rules:true,previousFocus:document.activeElement};$('help-layer').hidden=false;$('help-count').textContent='PRAVILA IGRE';$('help-title').textContent='Kako poteka boj';$('help-content').innerHTML=rulesDetails(helpConfig());
  $('guide-highlight').hidden=true;$('hide-guide-label').hidden=true;$('help-prev').hidden=true;$('help-skip').hidden=true;$('help-next').textContent='Razumem';$('help-clock-note').textContent=state?'Boj med branjem pravil teče naprej.':'';$('help-card').focus();
}
function paintGuide(){
  if(!guide||guide.rules)return;const step=guide.steps[guide.step];
  $('help-count').textContent='KRATKI VODIČ · '+(guide.step+1)+' / '+guide.steps.length;$('help-title').textContent=step.title;$('help-content').innerHTML=step.art+'<p>'+step.text+'</p>';
  $('hide-guide-label').hidden=false;$('help-prev').hidden=false;$('help-prev').disabled=guide.step===0;$('help-skip').hidden=false;$('help-next').textContent=guide.step===guide.steps.length-1?(guide.initial?(online?'Pripravljen sem':'Začni boj'):'Končaj'):'Naprej →';
  $('help-clock-note').textContent=initialPause!==null?'Ura še ne teče. Boj se začne, ko zapreš vodič.':online&&!state?'Pomoč zaključi pred potrditvijo pripravljenosti.':state?'Boj med pomočjo teče naprej.':'';
  positionGuide();
}
function positionGuide(){
  if(!guide||guide.rules)return;const target=$(guide.steps[guide.step].target),visible=target&&!$('battle').hidden;
  $('guide-highlight').hidden=!visible;if(!visible)return;
  const r=target.getBoundingClientRect();Object.assign($('guide-highlight').style,{left:(r.left-5)+'px',top:(r.top-5)+'px',width:(r.width+10)+'px',height:(r.height+10)+'px'});
}
function shiftLocalClock(ms){
  const s=local.state;for(const k of ['now','deadline','transitionAt','incomeAt','roundAt'])if(Number.isFinite(s[k]))s[k]+=ms;
  for(const a of [s.flights,s.impacts,s.moves,s.effects])for(const e of a)for(const k of ['at','endAt','confirmedAt'])if(Number.isFinite(e[k]))e[k]+=ms;
  for(const slot of s.slots)for(const k of ['aiAt','cooldownUntil','utilityAt'])if(slot[k])slot[k]+=ms;
  s.rev++;
}
function closeHelp(){
  if(!guide)return;const old=guide;
  if(!old.rules)store.set('tank-hide-guide-v042',$('hide-guide').checked);
  guide=null;$('help-layer').hidden=true;
  if(initialPause!==null){shiftLocalClock(Math.max(0,Date.now()-initialPause));initialPause=null;localSnapshot();rememberLocal();}
  old.previousFocus?.focus?.({preventScroll:true});if(old.after)old.after();
}
function paintQuestionVisibility(){
  const available=!!state?.canAct&&!!state.own.q;
  $('question-panel').hidden=!available||questionCollapsed;
  $('question-body').hidden=questionCollapsed;
  $('question-toggle').hidden=!available||!$('handoff').hidden;
  $('question-toggle').setAttribute('aria-expanded',String(available&&!questionCollapsed));
  $('question-toggle-icon').textContent=questionCollapsed?'+':'−';
}
function toggleQuestion(open=questionCollapsed){
  if(open){endAimDrag();hideTrace();settingsOpen=false;refreshControls();}
  questionCollapsed=!open;paintQuestionVisibility();
  if(open)$('answer')?.focus({preventScroll:true});else $('arena').focus({preventScroll:true});
}
function toggleSettings(open=!settingsOpen){settingsOpen=open;endAimDrag();if(open)toggleQuestion(false);refreshControls();if(!open)$('arena').focus({preventScroll:true});}
function fieldObstacles(){
  if(typeof getComputedStyle!=='function')return [];
  const base=$('arena').getBoundingClientRect();return [...document.querySelectorAll('.hud-obstacle')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{const r=e.getBoundingClientRect();return {x:r.left-base.left,y:r.top-base.top,w:r.width,h:r.height};}).filter(r=>r.w>0&&r.h>0);
}
function fitSettings(){
  if(!settingsOpen||!arena.tankBoxes?.length)return false;
  const ceiling=Math.min(...arena.tankBoxes.map(t=>t.bounds.y))-16;
  const top=104,height=Math.max(140,Math.min(310,ceiling-top));
  const value=Math.floor(height)+'px';if($('weapon-popover').style.maxHeight===value)return false;$('weapon-popover').style.maxHeight=value;return true;
}
function goHome(){if(guide){guide.after=null;closeHelp();}rememberLocal();online=false;clearTimeout(retry);if(socket){socket.onclose=null;socket.close();socket=null;}sound.pause();$('connection').hidden=true;state=null;showOnly('home');setupMode(mode);refreshLocalResume();}
function refreshLocalResume(){
  let b=$('resume-local');if(!b){b=document.createElement('button');b.id='resume-local';b.type='button';b.className='quiet';b.style.cssText='width:100%;margin-top:10px';b.textContent='Nadaljuj lokalni boj';$('start').after(b);b.addEventListener('click',()=>{const saved=store.get('tank-local-v04');try{if(saved?.version!==VERSION||saved.tanks.length<2||saved.tanks.length>5||!saved.terrain.every(Number.isFinite))throw Error('Shranjeni boj ni veljaven.');const elapsed=Date.now()-saved.now;for(const k of ['deadline','transitionAt','incomeAt','roundAt'])if(Number.isFinite(saved[k]))saved[k]+=elapsed;for(const a of [saved.flights,saved.impacts,saved.moves,saved.effects])for(const e of a){for(const k of ['at','endAt','confirmedAt'])if(Number.isFinite(e[k]))e[k]+=elapsed;}for(const slot of saved.slots)for(const k of ['aiAt','cooldownUntil','utilityAt'])if(slot[k])slot[k]+=elapsed;saved.now=Date.now();local=new Match(saved);online=false;viewer=0;draftKey='';questionKey='';acceptedHandoff='';localSnapshot();}catch(e){toast(e.message);}});}
  b.hidden=!store.get('tank-local-v04');
}
$('setup').addEventListener('submit',e=>{e.preventDefault();sound.unlock();try{mode==='online'?createRoom():startLocal();}catch(e){toast(e.message);}});
for(const button of document.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>setupMode(button.dataset.mode));
for(const id of ['total','humans','rules','training-terrain','prep'])$(id).addEventListener('change',()=>{try{setupMode(mode);}catch(e){toast(e.message);}});
$('join').addEventListener('click',()=>{const code=$('code').value.toUpperCase().replace(/\s/g,'');if(!/^[A-Z2-9]{8}$/.test(code)){toast('Vpiši 8-mestno kodo sobe.');return;}credentials={code,name:names()[0]};rememberCredentials();retryCount=0;connect();});
$('resume').addEventListener('click',()=>{credentials=lastCredentials();if(credentials){retryCount=0;connect();}});
$('ready').addEventListener('click',()=>{const ready=!room.players[viewer].ready;if(ready&&!guidedRooms.has(room.code)&&!store.get('tank-hide-guide-v042'))openGuide(true,()=>{guidedRooms.add(room.code);send('ready',{ready:true});});else send('ready',{ready});});
$('copy-room').addEventListener('click',async()=>{const url=new URL(location.href);url.search='?room='+room.code;try{await navigator.clipboard.writeText(url.href);toast('Povezava je kopirana.');}catch{toast('Koda sobe: '+room.code);}});
$('menu').addEventListener('click',goHome);$('audio').addEventListener('click',()=>{sound.setEnabled(!sound.enabled);$('audio').textContent='Zvok: '+(sound.enabled?'vklopljen':'izklopljen');$('audio').setAttribute('aria-pressed',String(sound.enabled));});
$('take-seat').addEventListener('click',()=>{acceptedHandoff=handoffKey;render();});
$('replay').addEventListener('click',()=>send('replay'));
function requestFire(){
  if(guide||!state||!$('handoff').hidden)return;updateButtons();if($('fire').disabled)return;
  if($('fire').dataset.question==='true'){toggleQuestion(true);return;}
  if(send('fire',{draft}))toast(state.config.rules==='salvo'?'Napad potrjen. Čakamo ostale igralce.':'Napad potrjen.');
}
$('fire').addEventListener('click',requestFire);
for(const type of ['shield','save'])$(type).addEventListener('click',()=>{updateButtons();if(!$(type).disabled&&!guide&&$('handoff').hidden)send(type,{draft});});
$('skip-utility').addEventListener('click',()=>{if(!state?.own.utility?.result)send('skip-utility');});
$('continue-utility').addEventListener('click',()=>{if(state?.own.utility?.result)send('continue-utility');});
$('move').addEventListener('click',()=>send('dodge',{distance:Number($('dodge').value)}));$('stay').addEventListener('click',()=>send('dodge',{distance:0}));$('dodge').addEventListener('input',updateDodge);
$('intent').addEventListener('change',()=>send('intent',{intent:$('intent').value}));
$('help').addEventListener('click',()=>openGuide());$('show-rules').addEventListener('click',openRules);$('help-close').addEventListener('click',closeHelp);$('help-skip').addEventListener('click',closeHelp);
$('help-prev').addEventListener('click',()=>{if(guide&&!guide.rules){guide.step=Math.max(0,guide.step-1);paintGuide();}});
$('help-next').addEventListener('click',()=>{if(!guide)return;if(guide.rules||guide.step===guide.steps.length-1)closeHelp();else{guide.step++;paintGuide();}});
$('question-toggle').addEventListener('pointerdown',endAimDrag);
$('question-toggle').addEventListener('click',()=>toggleQuestion());$('question-close').addEventListener('click',()=>toggleQuestion(false));$('question-back').addEventListener('click',()=>toggleQuestion(false));$('aim-settings').addEventListener('click',()=>toggleSettings());$('close-weapon').addEventListener('click',()=>toggleSettings(false));
$('flip-direction').addEventListener('click',()=>{if(!canAim())return;draft.direction*=-1;toggleQuestion(false);refreshControls();$('arena').focus({preventScroll:true});});
for(const key of ['ball','cone','rod','rock'])$('weapon-'+key).addEventListener('click',()=>{
  if(!canAim())return;const selected=draft.weapon==='rock'?'rock':draft.projectile;
  if(selected===key){toggleSettings();return;}draft.weapon=key==='rock'?'rock':'shell';if(key!=='rock')draft.projectile=key;syncDraftInputs();toggleSettings(true);
});
for(const id of ['height','target'])$(id).addEventListener('input',()=>{
  if(!canAim())return;draft[id==='target'?'targetX':id]=Number($(id).value);syncDraftInputs();refreshControls();
});
$('copy-trace').addEventListener('click',()=>{
  if(!canAim()||!$('traces').checked)return;
  const trace=state.traces.find(t=>t.id===traceSelection&&t.actor===viewer);if(!trace)return;
  const patch=trace.weapon==='rock'?{weapon:'rock',rockMass:trace.mass,height:trace.altitude??trace.origin.y,targetX:trace.targetX??trace.end.x}:{weapon:'shell',projectile:trace.projectile,mass:trace.mass,force:trace.force,angle:trace.angle,direction:trace.direction};
  try{draft=cleanDraft({...state,slots:{[viewer]:{draft}}},viewer,patch);}catch{toast('Te sledi ni mogoče prenesti v veljavne nastavitve.');return;}
  const height=draft.height;endAimDrag();syncDraftInputs();settingsOpen=false;arena.options.tracePinned=trace.id;arena.options.traceHover=null;toggleQuestion(false);refreshControls();
  hideTrace();toast('Nastavitve prevzete. '+(height!==draft.height?'Višina prilagojena trenutnemu terenu. ':'')+'Pot je odvisna od trenutnega položaja in terena.');$('arena').focus({preventScroll:true});
});
function hideTrace(){traceSelection=null;traceHold=false;$('trace-panel').hidden=true;}
function showTrace(id){hideTrace();traceSelection=id;traceUntil=Date.now()+4000;arena.options.tracePinned=id;toggleQuestion(false);settingsOpen=false;refreshControls();}
window.addEventListener('pointerdown',e=>{if(!traceSelection||e.target?.id==='arena')return;for(let el=e.target;el;el=el.parentElement)if(el.id==='trace-panel')return;hideTrace();});
$('close-trace').addEventListener('click',()=>{hideTrace();$('arena').focus({preventScroll:true});});
$('trace-panel').addEventListener('pointerenter',()=>{traceHold=true;});
$('trace-panel').addEventListener('pointerleave',()=>{traceHold=false;traceUntil=Date.now()+4000;});
$('traces').addEventListener('change',()=>{if(!$('traces').checked)hideTrace();});
$('latest-trace').addEventListener('click',()=>{const t=state?.traces.at(-1);if(t)showTrace(t.id);$('arena').focus({preventScroll:true});});
// Controls follow 0.3: arrows adjust aim/force or the defensive move;
// pointer capture keeps aiming continuous until the mouse button is released.
let aimDrag=null;
function canAim(){return !guide&&state?.canAct&&state.phase==='prep'&&!state.own.utility&&!$('battle').hidden&&$('handoff').hidden;}
function canMove(){return !guide&&state?.canAct&&!$('battle').hidden&&$('handoff').hidden&&!$('defense-controls').hidden&&!$('move').disabled;}
function endAimDrag(){
  if(!aimDrag)return;const id=aimDrag.id;aimDrag=null;arena.dragging=false;
  try{if($('arena').hasPointerCapture?.(id))$('arena').releasePointerCapture(id);}catch{}
}
function isFieldControl(element){
  for(let el=element;el;el=el.parentElement)if(el.id==='battlefield')return true;
  return false;
}
function ownsKeyboardInput(element){
  if(element?.isContentEditable||['SELECT','TEXTAREA'].includes(element?.tagName))return true;
  // Field checkboxes and details headings may keep focus after a click.
  // Their arrows return to aiming, while text entry and outside menus keep theirs.
  if(element?.tagName==='SUMMARY')return !isFieldControl(element);
  if(element?.tagName==='INPUT')return element.type!=='range'&&!(element.type==='checkbox'&&isFieldControl(element));
  return false;
}
function pointerAim(e){
  if(!aimDrag||e.pointerId!==aimDrag.id)return;
  if(!canAim()){endAimDrag();return;}
  const p=arena.world(e.clientX,e.clientY),t=state.tanks[viewer];
  if(draft.weapon==='rock')draft.targetX=J.clamp(p.x,2,state.worldWidth-2);
  else if(aimDrag.kind==='path'){
    const plan=planFor({...state,slots:[]},viewer,draft),target={x:p.x+aimDrag.offset.x,y:p.y+aimDrag.offset.y};
    if(!plan.valid)return;
    const patch=J.Physics.aimAt(t,target,J.Physics.speed(plan.shot.baseCost,draft.mass),draft.angle);
    if(!patch){$('arena-note').textContent='Ta točka pri izbrani energiji ni dosegljiva. Povečaj silo ali spremeni cilj.';return;}
    Object.assign(draft,patch);
  }else{
    draft.direction=p.x<t.x+J.C.barrelPivotX?-1:1;
    draft.angle=J.clamp(Math.atan2(p.y-t.y-J.C.barrelPivotY,Math.abs(p.x-t.x-J.C.barrelPivotX))*180/Math.PI,J.C.angleMin,J.C.angleMax);
  }
  if(draft.weapon==='rock'){
    const limits=J.Physics.airLimits(state.terrain,draft.targetX,state.worldHeight);
    draft.height=J.clamp(draft.height,limits.min,limits.max);
  }
  syncDraftInputs();refreshControls();
}
$('arena').addEventListener('pointerdown',e=>{
  if(guide||!state||!$('handoff').hidden||e.isPrimary===false||e.button>0)return;
  if(!canAim()){toggleQuestion(false);const trace=$('traces').checked?arena.traceAt(state.traces||[],e.clientX,e.clientY):null;if(trace)showTrace(trace.id);else hideTrace();return;}
  sound.unlock();e.preventDefault();toggleQuestion(false);$('arena').focus({preventScroll:true});
  const trace=$('traces').checked?arena.traceAt(state.traces||[],e.clientX,e.clientY):null;
  if(trace&&!e.shiftKey){showTrace(trace.id);return;}
  hideTrace();
  const p=arena.world(e.clientX,e.clientY);let nearest=null,best=24/arena.scale;
  if(previewAllowed(state)&&draft.weapon==='shell'&&arena.preview){
    for(const point of arena.previewPoints(arena.preview,Infinity)){
      const distance=Math.hypot(p.x-point.x,p.y-point.y);
      if(distance<best){best=distance;nearest=point;}
    }
  }
  aimDrag={id:e.pointerId,kind:nearest?'path':'angle',offset:nearest?{x:nearest.x-p.x,y:nearest.y-p.y}:{x:0,y:0}};
  arena.dragging=true;$('arena').setPointerCapture?.(e.pointerId);
  if(!nearest||draft.weapon==='rock')pointerAim(e);
});
$('arena').addEventListener('pointermove',e=>{if(aimDrag&&e.buttons===0)endAimDrag();if(aimDrag){e.preventDefault();pointerAim(e);}else{const trace=state&&$('traces').checked?arena.traceAt(state.traces||[],e.clientX,e.clientY):null;arena.options.traceHover=trace?.id||null;$('arena').style.cursor=trace?'pointer':'crosshair';}});
$('arena').addEventListener('pointerleave',e=>{if(e.relatedTarget?.id!=='copy-trace')arena.options.traceHover=null;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('arena').addEventListener(type,e=>{if(aimDrag?.id===e.pointerId)endAimDrag();});
window.addEventListener('blur',endAimDrag);
window.addEventListener('keydown',e=>{
  if(guide){
    if(e.key==='Escape'){e.preventDefault();closeHelp();return;}
    if(e.key==='Tab'&&typeof getComputedStyle==='function'){const focusable=[...$('help-card').querySelectorAll('button,input')].filter(el=>!el.disabled&&el.getClientRects().length),first=focusable[0],last=focusable.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===$('help-card'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
    return;
  }
  if(e.key==='Escape'&&traceSelection){e.preventDefault();hideTrace();$('arena').focus({preventScroll:true});return;}
  if(e.key==='Escape'&&settingsOpen){e.preventDefault();toggleSettings(false);$('arena').focus();return;}
  if(e.key==='Escape'&&!$('question-panel').hidden){e.preventDefault();toggleQuestion(false);return;}
  if(e.ctrlKey||e.metaKey||e.altKey||e.isComposing||!state||$('battle').hidden||!$('handoff').hidden)return;
  const active=document.activeElement;
  if(ownsKeyboardInput(active))return;
  if(e.key.toLowerCase()==='q'&&state.canAct&&state.own.q){e.preventDefault();toggleQuestion(true);return;}
  if(e.key===' '&&(active?.tagName==='BUTTON'||active?.tagName==='SUMMARY'||active?.tagName==='INPUT'&&active.type==='checkbox'))return;
  const defense=canMove()&&(state.phase==='defense'||state.own.moveToken),attack=canAim()&&!defense;
  if(attack&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){
    e.preventDefault();endAimDrag();sound.unlock();hideTrace();toggleQuestion(false);const sign=['ArrowRight','ArrowUp'].includes(e.key)?1:-1;
    if(e.key==='ArrowUp'||e.key==='ArrowDown'){
      if(draft.weapon==='rock'){
        const limits=J.Physics.airLimits(state.terrain,draft.targetX,state.worldHeight);
        draft.height=J.clamp(draft.height+sign,limits.min,limits.max);
      }else{
        const limit=Math.min(75000,Math.max(J.C.forceMin,J.Economy.forceLimit(state.tanks[viewer].credits,draft.projectile,draft.mass)));
        draft.force=J.clamp(draft.force+sign*J.C.forceStep,J.C.forceMin,limit);
      }
    }else if(draft.weapon==='rock')draft.targetX=J.clamp(draft.targetX+sign*.5,2,state.worldWidth-2);
    else {
      const next=draft.angle-sign*draft.direction;
      // Cross the top into the opposite facing, retaining legal launch angles.
      if(next>J.C.angleMax){draft.direction*=-1;draft.angle=J.C.angleMax;}
      else draft.angle=J.clamp(next,J.C.angleMin,J.C.angleMax);
    }
    if(draft.weapon==='rock'){
      const limits=J.Physics.airLimits(state.terrain,draft.targetX,state.worldHeight);
      draft.height=J.clamp(draft.height,limits.min,limits.max);
    }
    syncDraftInputs();refreshControls();
  }else if(defense&&['ArrowLeft','ArrowRight'].includes(e.key)){
    e.preventDefault();endAimDrag();sound.unlock();
    $('dodge').value=String(J.clamp(Math.round((Number($('dodge').value)+(e.key==='ArrowLeft'?-.1:.1))*10)/10,Number($('dodge').min),Number($('dodge').max)));updateDodge();
    $('arena').focus({preventScroll:true});
  }else if(e.key===' '&&(attack||defense)){
    e.preventDefault();if(e.repeat)return;
    if(defense){if(!$('move').disabled)send('dodge',{distance:Number($('dodge').value)});}
    else requestFire();
  }
});
window.addEventListener('resize',()=>{if(demoState&&!$('home').hidden)demo.draw(demoState,null,Date.now());positionGuide();});
function frame(){
  const now=Date.now();
  if(local&&!online&&state&&initialPause===null){try{local.advance(now);if(local.state.rev!==lastLocalRev){lastLocalRev=local.state.rev;localSnapshot();rememberLocal();}}catch(e){toast('Napaka pri izvedbi: '+e.message);console.error(e);local=null;}}
  if(state&&!$('battle').hidden){
    $('latest-trace').hidden=!state.traces?.length;
    const qr=$('question-panel').getBoundingClientRect(),ar=$('arena').getBoundingClientRect();
    const traceObstacles=$('question-panel').hidden?[]:[{x:qr.left-ar.left,y:qr.top-ar.top,w:qr.width,h:qr.height}];
    const options={traceObstacles,traceDetailsId:traceSelection,traces:$('traces').checked,inset:$('inset').checked,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches,battleLayout:true,concealed:!$('handoff').hidden,obstacles:fieldObstacles()};
    arena.draw(state,draft,serverNow(),options);if(fitSettings())arena.draw(state,draft,serverNow(),{...options,obstacles:fieldObstacles()});
    const traceRect=arena.traceLabelRect,panel=$('trace-panel'),copy=$('copy-trace');
    if(traceHold||['copy-trace','close-trace'].includes(document.activeElement?.id))traceUntil=now+4000;
    if(now>=traceUntil)hideTrace();
    panel.hidden=!traceSelection||!traceRect||!options.traces||options.concealed;
    if(!panel.hidden){Object.assign(panel.style,{left:traceRect.x+'px',top:traceRect.y+'px',width:traceRect.w+'px',height:traceRect.h+'px'});const info=arena.traceInfo;$('trace-title').textContent=info.name+' · '+info.settings;$('trace-values').textContent=info.energy;panel.title=$('trace-title').textContent+' · '+info.energy;copy.disabled=!canAim();copy.title=copy.disabled?'Na voljo med pripravo napada':'Prenesi nastavitve brez sprožitve strela';}
    if(now-lastPaint>200){const seconds=state.roundEndsAt?Math.max(0,Math.ceil((state.roundEndsAt-serverNow())/1000)):0;$('clock').textContent=initialPause!==null?'POMOČ':(state.own.utility?.deadline||state.deadline)?Math.max(0,Math.ceil(((state.own.utility?.deadline||state.deadline)-serverNow())/1000))+' s':state.config.play==='training'?'BREZ URE':state.roundEndsAt?Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0'):'';updateButtons();lastPaint=now;}
  }
  requestAnimationFrame(frame);
}
try{await J.Bank.load();$('start').disabled=false;setupMode(mode);refreshLocalResume();const query=new URL(location.href).searchParams,code=query.get('room');if(code||query.get('mode')==='online'){setupMode('online');$('code').value=code?.toUpperCase()||'';}}catch(e){toast('Vprašanj ni mogoče naložiti: '+e.message);$('start').textContent='Napaka pri nalaganju vprašanj';}
requestAnimationFrame(frame);
// Read-only inspection for browser diagnostics; commands use the same public UI path.
Object.defineProperty(window,'Tankovska',{value:{get state(){return state;},get local(){return local;},get room(){return room;},get draft(){return draft;},get socket(){return socket;},get arena(){return arena;}}});
