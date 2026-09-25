import {learningCard,journeyStep} from './learning.mjs';
import {prepareData,hash} from './data.mjs';
import {buildJourney} from './world-builder.mjs';
import {createRun,step,currentEncounter,availableRelations,cycleCapability,objective} from './engine.mjs';
import {readProgress,writeProgress,captureProgress,freshProgress,reconcileProgress,restartProgress} from './storage.mjs';
import {Renderer} from './renderer.mjs';
import {createInput} from './input.mjs';
import {createAudio} from './audio.mjs';
import {powerStyle} from './config.mjs';
import {esc,knowledgeHTML,mapHTML,recapHTML,finaleHTML,gateURL} from './ui.mjs';

const $=id=>document.getElementById(id),canvas=$('game'),audio=createAudio(),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const discoveryQueue=[];
let storage,renderer,data,worlds=[],progress,run,index=0,mode='loading',dialogPrevious='ready',lastFocus=null,lastTime=0,accumulator=0,toastUntil=0,lastHUD=0,lastHUDFocus=null,lastRender=0,storageWarned=false;
try{renderer=new Renderer(canvas);}catch(error){console.error(error);}
const input=createInput(canvas,{isPlaying:()=>mode==='playing',pause:togglePause,lostFocus:()=>{if(mode==='playing')pause();},cycle:cycle,knowledge:()=>showKnowledge(),map:showMap,family:i=>showInventory(data?.mechanisms[i]?.key)});
function notify(message,seconds=4){$('toast').textContent=message;toastUntil=performance.now()+seconds*1000;}
function persist(){if(!progress)return;if(run)progress=captureProgress(progress,run,data);if(!writeProgress(storage,progress)&&!storageWarned){storageWarned=true;notify('This browser cannot save progress. You can keep playing.',6);}}
function reduced(){return motionQuery.matches||progress?.settings.reducedMotion===true;}
function applySettings(){if(renderer)renderer.reduced=reduced();document.body.classList.toggle('no-motion',reduced());$('sound').setAttribute('aria-pressed',String(!!progress?.settings.sound));$('sound').setAttribute('aria-label',progress?.settings.sound?'Mute music and sound':'Enable music and sound');$('sound').title=progress?.settings.sound?'Music and sound on':'Music and sound off';}
motionQuery.addEventListener('change',applySettings);

function gates(){
  $('gates').style.gridTemplateColumns=`repeat(${worlds.length},1fr)`;
  $('gates').innerHTML=worlds.map((w,i)=>{const completed=progress.completed.includes(w.gate.id),unlocked=i===0||progress.completed.includes(worlds[i-1].gate.id);return `<button class="gate ${i===index?'active':''} ${completed?'done':''}" data-level="${i}" ${unlocked?'':'disabled'} ${i===index?'aria-current="step"':''} aria-label="Stage Gate ${esc(w.gate.id)}: ${esc(w.gate.label)}${completed?', journey completed':unlocked?'':', not yet reached'}"><b>${completed?'✓':i+1}</b><span>${esc(w.alias)}</span></button>`;}).join('');
  $('gates').querySelectorAll('[data-level]').forEach(b=>b.onclick=()=>{persist();prepare(Number(b.dataset.level));});
}

function hud(){
  if(!run)return;$('journeySteps').querySelectorAll('li').forEach((li,i)=>{li.classList.toggle('active',i===journeyStep(run));li.setAttribute('aria-current',i===journeyStep(run)?'step':'false');});const e=currentEncounter(run),selected=run.selected&&data.enablerMap.get(run.selected);
  $('chapterAlias').textContent=`STAGE GATE ${run.world.gate.id} · ${run.world.alias}`;$('gateTitle').textContent=run.world.gate.label;
  $('contextKicker').textContent=e?`${e.opened?'PATH OPENED':e.encountered?'ENCOUNTERED':'EXPLORE'}${e.knot?' · CONNECTED SYSTEMS':''}`:run.world.epilogue?'A NARRATIVE HANDOVER':'EXPLORE AT YOUR OWN PACE';
  $('objective').textContent=objective(run);$('coverage').textContent=`${run.encounters.length} selected challenges · ${run.world.mappedCount} blockers mapped to this Stage Gate`;
  $('selectedCapability').textContent=selected?.title||'No capabilities discovered yet';$('inventoryButton').title=selected?.title||'Explore to discover a capability';
  $('inventoryButton').disabled=!run.inventory.size;$('touchCycle').disabled=!run.inventory.size;
  $('knowledge').disabled=!e&&!run.world.epilogue&&!run.world.unavailable;
  $('powerTray').innerHTML=data.mechanisms.map(m=>{const found=run.mechanisms.has(m.key),active=e?e.relations.some(r=>r.enablerId===run.selected&&r.mechanism===m.key):data.relationships.some(r=>r.enablerId===run.selected&&r.mechanism===m.key);return `<button class="power ${found?'discovered':''} ${active?'active':''}" data-family="${esc(m.key)}" style="--power:${m.style.color}" aria-label="${esc(m.key)} capabilities${found?', discovered':''}" aria-pressed="${active}"><b aria-hidden="true">${m.style.symbol}</b>${esc(m.key)}</button>`;}).join('');
  $('powerTray').querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>showInventory(b.dataset.family));
}

function overlay({title,text,button,kicker='A LIVING KNOWLEDGE LANDSCAPE',note='',extra='',map=false}){
  $('overlayTitle').textContent=title;$('overlayText').textContent=text;$('overlayKicker').textContent=kicker;$('overlayNote').textContent=note;$('overlayExtra').innerHTML=extra;$('start').textContent=button;$('start').disabled=false;$('overlayMap').hidden=!map;$('overlay').hidden=false;
}
function prepare(i){
  discoveryQueue.length=0;audio.setPlaying(false);index=i;run=createRun(worlds[i],progress);mode='ready';input.clear();renderer.reset(run);$('toast').textContent='';$('pause').disabled=true;$('mapButton').disabled=false;$('orientation').disabled=false;$('restart').disabled=false;gates();hud();
  const learned=run.inventory.size>0,empty=run.world.epilogue||run.world.unavailable;
  overlay({title:i===0&&!learned?'A little light. A world of possibility.':run.world.alias.toLowerCase().replace(/^./,s=>s.toUpperCase())+'.',text:empty?'Carry what you have learned through the living network. Visit the handover signals, then return to the central portal.':'1. Find a blocker. 2. Collect a linked gold enabler. 3. Return to that blocker and press E / Use. 4. When every path is open, return to the CENTRAL PORTAL and press E again.',button:learned?'Continue this path →':'Begin the journey →',kicker:`STAGE GATE ${run.world.gate.id} · ${run.world.gate.label}`,note:run.world.epilogue?'No mapped blocker challenges in this gate. This epilogue uses narrative game metaphors.':run.world.unavailable?'Mapped blockers exist, but usable enabling relationships are not available. This is a narrative fallback.':`${run.encounters.length} selected challenges · ${run.world.mappedCount} mapped blockers. Challenges come from the live Explorer.`,map:true});
  progress.settings.currentGate=run.world.gate.id;persist();
}
function play(){
  if(mode==='error'){load();return;}
  if(mode==='complete'){if(index<worlds.length-1){prepare(index+1);return;}newPath();return;}
  if(!run)return;mode='playing';input.clear();$('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game');audio.unlock(progress.settings.sound);audio.setPlaying(true);lastTime=performance.now();accumulator=0;canvas.focus({preventScroll:true});
  if(innerWidth<600)$('gameShell').scrollIntoView({block:'start',behavior:'instant'});
}
function pause(){if(mode!=='playing')return;mode='paused';audio.setPlaying(false);input.clear();persist();$('pause').textContent='▶';$('pause').setAttribute('aria-label','Resume game');overlay({title:'A quiet moment.',text:'Your place in the network is saved. Take a look at the map, or continue when you are ready.',button:'Return to the spark →',kicker:run.world.gate.label,note:'No timer. No score. Discover the system at your own pace.',map:true});}
function togglePause(){if(mode==='paused')play();else pause();}
function newPath(seed=String(crypto.getRandomValues(new Uint32Array(1))[0])){progress=restartProgress(progress,data,seed);worlds=buildJourney(data,progress.seed);run=null;lastHUDFocus=null;accumulator=0;prepare(0);}
function requestRestart(){
  if(!run)return;
  showPanel('START AGAIN',`<h2>Restart the journey?</h2><p>Return to Stage Gate 1 with the same challenges. This clears completed chapters, discovered capabilities and opened paths from this game on this device.</p><p>Your sound and motion preferences are kept.</p><div class="panel-actions"><button id="cancelRestart" class="secondary">Keep playing</button><button id="confirmRestart" class="primary">Restart from Stage Gate 1</button></div>`);
  $('cancelRestart').onclick=()=>$('details').close();
  $('confirmRestart').onclick=()=>{newPath(progress.seed);lastFocus=$('start');$('details').close();$('start').focus({preventScroll:true});};
  $('cancelRestart').focus({preventScroll:true});
}

function showPanel(kicker,html){
  if(!$('details').open){dialogPrevious=mode;lastFocus=document.activeElement;if(mode==='playing'){mode='dialog';audio.setPlaying(false);input.clear();} $('details').showModal();}
  $('dialogKicker').textContent=kicker;$('dialogBody').innerHTML=html;$('details').scrollTop=0;$('closeDialog').focus({preventScroll:true});
}
$('details').addEventListener('close',()=>{if(mode==='dialog'){mode=dialogPrevious;lastTime=performance.now();accumulator=0;}input.clear();if(mode==='playing'){audio.setPlaying(true);canvas.focus({preventScroll:true});if(discoveryQueue.length)queueMicrotask(showNextDiscovery);}else if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});});
$('closeDialog').onclick=()=>$('details').close();
function showNextDiscovery(){
 if(!discoveryQueue.length||$('details').open)return;
 const ev=discoveryQueue.shift(),card=learningCard(ev,run);if(!card)return;
 showPanel(card.kicker,card.html+'<div class="panel-actions"><button class="primary" id="continueDiscovery">Continue exploring →</button><button class="secondary" id="readDiscovery">Read the full connection</button></div>');
 $('continueDiscovery').onclick=()=>$('details').close();$('readDiscovery').onclick=()=>showKnowledge(ev.encounter.id,ev.pickup?.enabler.id||ev.relation?.enablerId);$('continueDiscovery').focus({preventScroll:true});
}
function showKnowledge(id=null,enablerId=null){if(!run)return;const e=run.encounters.find(e=>e.id===id)||currentEncounter(run);if(!e&&!run.world.epilogue&&!run.world.unavailable){notify('Find an incomplete system to reveal its knowledge.');return;}showPanel('BEHIND THIS CHALLENGE',knowledgeHTML(data,run,e,enablerId));$('dialogBody').querySelectorAll('[data-connection]').forEach(b=>b.onclick=()=>showKnowledge(e.id,b.dataset.connection));}
function showMap(){if(!run)return;showPanel('THE JOURNEY · GAME STATE',`<div class="map-gates">${worlds.map((w,i)=>`<span class="map-gate-label ${i===index?'current':''}">${progress.completed.includes(w.gate.id)?'✓':i+1} ${esc(w.alias)}</span>`).join('')}</div>`+mapHTML(run,data));$('dialogBody').querySelectorAll('[data-map-node]').forEach(b=>b.onclick=()=>showKnowledge(b.dataset.mapNode));}
function showInventory(family=null){
  if(!run)return;const e=currentEncounter(run),records=[];
  for(const id of run.inventory){const links=e?e.relations.filter(r=>r.enablerId===id):[],source=links.length?links:data.relationships.filter(r=>r.enablerId===id);const families=[...new Set(source.map(r=>r.mechanism))];if(family&&!families.includes(family))continue;records.push({enabler:data.enablerMap.get(id),families,relevant:links.length>0});}
  records.sort((a,b)=>Number(b.relevant)-Number(a.relevant));
  showPanel('YOUR CAPABILITY CONSTELLATION',`<h2>${family?esc(family):'What you can bring to the system.'}</h2>${family?`<p class="source-text">${esc(data.mechanismMap.get(family)?.description)}</p>`:'<p>Select an individual enabling capability. A shared mechanism does not make different enablers interchangeable.</p>'}${records.length?records.map(r=>`<button class="alternative ${run.selected===r.enabler.id?'selected':''}" data-select-capability="${esc(r.enabler.id)}"><strong>${esc(r.enabler.title)}</strong><span>${esc(r.families.join(' · '))}${e?r.relevant?' · Linked to this challenge':' · Not linked to this challenge':''}${run.selected===r.enabler.id?' · Selected':''}</span></button>`).join(''):'<p>No capabilities in this family discovered yet. Explore the gold-lit branches near an encountered system.</p>'}`);
  $('dialogBody').querySelectorAll('[data-select-capability]').forEach(b=>b.onclick=()=>{run.selected=b.dataset.selectCapability;hud();$('details').close();notify('Capability selected.');});
}
function cycle(){if(!run)return;const selected=cycleCapability(run);if(selected){notify(data.enablerMap.get(selected).title,3);hud();}}
function help(){showPanel('HOW THE JOURNEY WORKS',`<h2>Explore. Return. Change the system.</h2><p>You are a small light moving through a connected landscape. The central portal is your point of return.</p><ol><li><strong>Move and jump along the stepping stones.</strong> Hold a direction and jump to climb. Follow a branch until you find an incomplete system.</li><li><strong>Look elsewhere for a capability.</strong> Encountering a system illuminates linked enablers on nearby upper and lower routes. Each gold light is an individual capability from the Explorer.</li><li><strong>Return and choose your approach.</strong> Use the capability selector or Q. At the round node, press E or Use. Only a genuinely linked enabler changes that system.</li><li><strong>Follow the change.</strong> Cross the new route. The round node and the far anchor now provide an E shortcut back to the central portal. Connected challenges may gain a supporting route.</li><li><strong>Continue when the selected paths are open.</strong> Return to the central portal and press E.</li></ol><p><strong>Keyboard:</strong> arrows / A / D move; Space / W / Up jump; Down / S drop through a platform; E use; Q cycle; 1–6 capability family; K knowledge; M map; P / Escape pause. On touchscreens, hold movement and tap or hold Jump. Use ◇ to choose a capability.</p><p>Use Restart to begin again at Stage Gate 1; a confirmation protects your progress from accidental clicks. Falls return you to a recent safe checkpoint. Acquired capabilities stay with you. Different enablers may offer legitimate alternative approaches. Dependency knots and echoes influence routes, but never create impossible prerequisite cycles.</p><label class="settings"><input id="motionSetting" type="checkbox" ${progress?.settings.reducedMotion?'checked':''}> Reduce atmospheric motion and camera effects</label><p class="small">The system's reduced-motion preference is always respected. Use ♫ Music in the game header to enable the ambient soundtrack and effects. Music pauses while you read or pause the game. Progress is stored on this device. Game state does not alter Explorer bookmarks or maturity answers.</p>`);$('motionSetting').onchange=event=>{if(progress){progress.settings.reducedMotion=event.target.checked;applySettings();persist();}};}

function finish(){mode='complete';audio.setPlaying(false);input.clear();if(!progress.completed.includes(run.world.gate.id))progress.completed.push(run.world.gate.id);persist();gates();hud();$('pause').disabled=true;audio.play('complete');const final=index===worlds.length-1;overlay({title:final?'The system keeps moving.':'Path established.',text:final?'Scaling is not the end of the journey. It is the ability to keep learning, operating and adapting as conditions change.':run.world.gate.label,button:final?'Run another path →':`Continue to Stage Gate ${worlds[index+1].gate.id} →`,kicker:final?'LIGHT · CONNECTION · CONTINUITY':`STAGE GATE ${run.world.gate.id}`,note:'Game progress is not an assessment of organisational maturity or readiness.',extra:final?finaleHTML(run):recapHTML(run,data),map:true});$('start').focus({preventScroll:true});}
function handle(events){let changed=false;for(const ev of events){renderer.react(ev);if(['encounter','collect','open'].includes(ev.type))discoveryQueue.push(ev);
  if(ev.type==='encounter'){notify('Path incomplete. Another route exists.\nExplore the gold-lit branches, then return.',6);changed=true;}
  if(ev.type==='collect'){notify(`${ev.pickup.relation.mechanism} acquired.\n${ev.pickup.enabler.title}`,5);audio.play('collect');changed=true;}
  if(ev.type==='open'){notify(powerStyle(ev.relation.mechanism).message+(ev.supported.length?'\nA connected system gains a supporting route.':''),5);audio.play('open');changed=true;}
  if(ev.type==='crossed'){notify('A return shortcut is ready. Use E at the anchor.');changed=true;}
  if(ev.type==='return'){notify('Connection followed. Back at the central portal.');audio.play('return');}
  if(ev.type==='unavailable')notify(ev.hasAlternative?'Choose a linked capability with Q or the capability selector.':'Another capability is needed. Explore the nearby gold-lit branches.');
  if(ev.type==='distant')notify('Use a capability at an incomplete system’s round node.');
  if(ev.type==='home')notify(run.encounters.length?`${ev.remaining} selected paths remain. Explore the branches above and to either side.`:'Visit each handover signal, then return here.');
  if(ev.type==='signal'){notify(ev.signal.label+'.');audio.play('signal');changed=true;}
  if(ev.type==='respawn')notify('A soft landing. Your discovered capabilities are still with you.');
  if(ev.type==='complete'){finish();return;}
 }if(changed){hud();persist();}if(mode==='playing')showNextDiscovery();}

$('restart').onclick=requestRestart;$('start').onclick=play;$('pause').onclick=togglePause;$('help').onclick=help;$('mapButton').onclick=showMap;$('orientation').onclick=showMap;$('overlayMap').onclick=showMap;$('knowledge').onclick=()=>showKnowledge();$('inventoryButton').onclick=()=>showInventory();$('touchCycle').onclick=()=>showInventory();
$('sound').onclick=()=>{if(!progress)return;progress.settings.sound=!progress.settings.sound;audio.unlock(progress.settings.sound);audio.play('collect');applySettings();persist();if(mode==='playing')canvas.focus({preventScroll:true});};
window.addEventListener('pagehide',persist);
function frame(now){const dt=Math.min(.05,(now-(lastTime||now))/1000);lastTime=now;if(mode==='playing'){accumulator+=dt;while(accumulator>=1/120&&mode==='playing'){handle(step(run,input.sample(),1/120));accumulator-=1/120;}}else accumulator=0;if(!document.hidden&&(mode==='playing'||now-lastRender>100)){renderer?.render(run,Math.min(.1,(now-lastRender)/1000),now/1000,mode);lastRender=now;}if(run&&run.focusId!==lastHUDFocus&&mode==='playing'){hud();lastHUDFocus=run.focusId;}if($('toast').textContent&&now>toastUntil)$('toast').textContent='';requestAnimationFrame(frame);}
async function load(){mode='loading';$('start').disabled=true;$('start').textContent='Loading the knowledge network…';$('overlayExtra').innerHTML='';try{if(!renderer)throw new Error('Canvas is unavailable');const response=await fetch('../data/explorer-data.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error(`Explorer data: HTTP ${response.status}`);data=prepareData(await response.json());if(data.warnings.length)console.warn('Scale Run data validation:',data.warnings);try{storage=window.localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw new Error('Unavailable storage');}};}progress=readProgress(storage,data);worlds=buildJourney(data,progress.seed);applySettings();let next=worlds.findIndex(w=>w.gate.id===progress.settings.currentGate);if(next<0)next=worlds.findIndex(w=>!progress.completed.includes(w.gate.id));if(next<0)next=0;if(next>0&&!progress.completed.includes(worlds[next-1].gate.id))next=0;prepare(next);}catch(error){console.error('Scale Run startup failed:',error);mode='error';overlay({title:'The knowledge network could not be loaded.',text:'Scale Run uses the live Explorer data. Please try again, or return to the Explorer.',button:'Try again',extra:'<a class="recap-link" href="../#explore">Return to Explorer ↗</a>',note:'Your saved progress has not been removed.'});}}
requestAnimationFrame(frame);load();
