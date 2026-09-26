import {worldMapHTML} from './world-map.mjs?v=7';
import {installFullscreen} from './fullscreen.mjs?v=7';
import {learningCard,journeyStep,discoveryNotice} from './learning.mjs?v=7';
import {prepareData,hash} from './data.mjs?v=7';
import {buildCampaign,roomUnlocked,reconcileCampaign} from './campaign.mjs?v=7';
import {createRun,step,currentEncounter,availableRelations,cycleCapability,objective,useAbility,portalOpen} from './engine.mjs?v=7';
import {readProgress,writeProgress,captureProgress,freshProgress,reconcileProgress,restartProgress} from './storage.mjs?v=7';
import {Renderer} from './renderer.mjs?v=7';
import {createInput} from './input.mjs?v=7';
import {createAudio} from './audio.mjs?v=7';
import {powerStyle,ABILITIES} from './config.mjs?v=7';
import {esc,knowledgeHTML,mapHTML,recapHTML,finaleHTML,gateURL} from './ui.mjs?v=7';

const $=id=>document.getElementById(id),canvas=$('game'),audio=createAudio(),motionQuery=matchMedia('(prefers-reduced-motion: reduce)');
const discoveryQueue=[],noticeQueue=[];let deliveryUntil=0;
let storage,renderer,data,worlds=[],progress,run,index=0,mode='loading',dialogPrevious='ready',lastFocus=null,lastTime=0,accumulator=0,toastUntil=0,lastHUD=0,lastHUDFocus=null,lastRender=0,storageWarned=false;
try{renderer=new Renderer(canvas);}catch(error){console.error(error);}
$('gameShell').append($('details'));installFullscreen($('gameShell'),$('fullscreen'),()=>{renderer?.resize();if(mode==='playing')canvas.focus({preventScroll:true});});
const input=createInput(canvas,{isPlaying:()=>mode==='playing',pause:togglePause,lostFocus:()=>{if(mode==='playing')pause();},cycle:cycle,knowledge:()=>showKnowledge(),map:showMap,family:i=>applyAbility(Object.keys(ABILITIES)[i]),portals:showPortals});
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
  if(!run)return;$('journeySteps').querySelectorAll('li').forEach((li,i)=>{li.classList.toggle('active',i===journeyStep(run));li.setAttribute('aria-current',i===journeyStep(run)?'step':'false');});const e=currentEncounter(run),selected=run.selected&&data.enablerMap.get(run.selected);$('portals').disabled=false;$('portals').textContent='◎ Locate portals';
  $('chapterAlias').textContent=`STAGE GATE ${run.world.gate.id} · ${run.world.alias} · ${run.world.zoneName||'MAP '+((run.world.roomIndex||0)+1)}`;$('gateTitle').textContent=run.world.gate.label;
  $('contextKicker').textContent=e?`${e.opened?'PATH OPENED':e.encountered?'ENCOUNTERED':'EXPLORE'}${e.knot?' · CONNECTED SYSTEMS':''}`:run.world.epilogue?'A NARRATIVE HANDOVER':'EXPLORE AT YOUR OWN PACE';
  $('objective').textContent=objective(run);$('coverage').textContent=`${run.encounters.length} blockers in this mini-map · ${run.world.chapterIds.filter(id=>run.priorOpened.has(id)||run.encounters.some(e=>e.id===id&&e.opened)).length}/${run.world.chapterIds.length} paths opened in this Stage Gate`;
  $('selectedCapability').textContent=selected?.title||'No capabilities discovered yet';$('inventoryButton').title=selected?.title||'Explore to discover a capability';
  $('inventoryButton').disabled=!run.inventory.size;$('touchCycle').disabled=!run.inventory.size;
  $('knowledge').disabled=!e&&!run.world.epilogue&&!run.world.unavailable;
  $('powerTray').innerHTML=data.mechanisms.map(m=>{const found=run.mechanisms.has(m.key),active=e?e.relations.some(r=>r.enablerId===run.selected&&r.mechanism===m.key):data.relationships.some(r=>r.enablerId===run.selected&&r.mechanism===m.key);return `<button class="power ${found?'discovered':''} ${active?'active':''}" data-family="${esc(m.key)}" style="--power:${m.style.color}" aria-label="${esc(m.key)}: ${esc(ABILITIES[m.key]?.name||'Activate')} · key ${esc(ABILITIES[m.key]?.key||'')}${found?', ready':', undiscovered'}" aria-pressed="${active}"><b aria-hidden="true">${m.style.symbol}</b>${esc(ABILITIES[m.key]?.key||'')} ${esc(m.key)}</button>`;}).join('');
  $('powerTray').querySelectorAll('[data-family]').forEach(b=>b.onclick=()=>applyAbility(b.dataset.family));
}

function overlay({title,text,button,kicker='A LIVING KNOWLEDGE LANDSCAPE',note='',extra='',map=false}){
  $('overlayTitle').textContent=title;$('overlayText').textContent=text;$('overlayKicker').textContent=kicker;$('overlayNote').textContent=note;$('overlayExtra').innerHTML=extra;$('start').textContent=button;$('start').disabled=false;$('overlayMap').hidden=!map;$('overlay').hidden=false;
}
function prepare(i,room=0){
  discoveryQueue.length=0;noticeQueue.length=0;$('delivery').hidden=true;audio.setPlaying(false);index=i;run=createRun(worlds[i].rooms[room]||worlds[i].rooms[0],progress);mode='ready';input.clear();renderer.reset(run);$('toast').textContent='';$('pause').disabled=true;$('mapButton').disabled=false;$('orientation').disabled=false;$('restart').disabled=false;gates();hud();
  const learned=run.inventory.size>0,empty=run.world.epilogue||run.world.unavailable;
  overlay({title:i===0&&!learned?'A little light. A world of possibility.':run.world.alias.toLowerCase().replace(/^./,s=>s.toUpperCase())+'.',text:empty?'Carry what you have learned through the living network. Visit the handover signals, then return to the central portal.':'1. Find a blocker. 2. Collect ALL its linked gold tools. 3. Return to that blocker and press E / Use (or a linked ability key). 4. Explore physical portals to other regions; some passages require a blocker to be opened. Use M / Map to orient yourseex/5),r=17;
    list.forEach((key,i)=>{c.save();c.translate(x,y);const angular=this.reduced?0:time*(key==='Learn'?.24:.06);c.rotate((i*.8)*(1-coherence*.35)+angular);c.strokeStyle='#507f8799';c.lineWidth=1.1;
      if(key==='Equip'){c.beginPath();c.moveTo(-r,r*.5);c.lineTo(0,-r);c.lineTo(r,r*.5);c.stroke();}
      else {c.beginPath();c.ellipse(0,0,r+i*1.8,9+i*.9,-.4,0,key==='Assure'?Math.PI*2:Math.PI*1.5);c.stroke();}
      if(key==='Commit'||key==='Operate')this.circle(r,0,2,'#628e8e');c.restore();});
    // A late directional arc echoes the logo; the original light remains present.
    if(run.world.index===5&&list.length){c.beginPath();c.moveTo(x-19,y+17);c.quadraticCurveTo(x+5,y+12,x+14,y-16);c.strokeStyle='#488c9790';c.lineWidth=2;c.stroke();}
    if(!p.grounded&&!this.reduced){this.circle(x-p.vx*.024,y+7,3,'#fffaf380');this.circle(x-p.vx*.05,y+12,1.8,'#fffaf350');}
  }
  render(run,delta,time,mode='playing') {
    const c=this.ctx;this.overview=Math.max(0,this.overview-delta);const motion=this.reduced?0:time;
    if(run){const desiredZoom=this.mapView?Math.min(this.width/run.world.width,this.height/run.world.height)*.95:!this.reduced&&this.width>700&&this.overview>0?.94:1;this.camera.zoom+=(desiredZoom-this.camera.zoom)*Math.min(1,delta*(this.mapView?8:3));const vw=this.width/this.camera.zoom,vh=this.height/this.camera.zoom,targetX=Math.max(-50,Math.min(run.world.width-vw+50,run.player.x-vw*.5+run.player.vx*.22)),targetY=Math.max(-80,Math.min(run.world.height-vh+35,run.player.y-vh*.64));const ease=this.reduced?1:Math.min(1,delta*4.5);this.camera.x+=(targetX-this.camera.x)*ease;this.camera.y+=(targetY-this.camera.y)*ease;}
    c.setTransform(this.canvas.width/this.width,0,0,this.canvas.height/this.height,0,0);this.background(run,motion);if(!run)return;
    c.save();c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);const theme=THEMES[run.world.index%THEMES.length];
    this.landmark(run,motion);this.dependencies(run,motion);
    for(const p of this.surfacePlatforms(run)){if(p.kind==='seal')continue;if(p.x+p.w<this.camera.x-80||p.x>this.camera.x+this.width/this.camera.zoom+80||p.y<this.camera.y-100||p.y>this.camera.y+this.height/this.camera.zoom+100)continue;this.island(p,theme,run,motion);}
    for(const e of run.encounters){if(Math.abs(e.x-run.player.x)<this.width+500&&Math.abs(e.y-run.player.y)<this.height+300)this.encounter(e,run,motion);}
    for(const pickup of run.world.pickups){const e=run.encounters.find(e=>e.id===pickup.encounterId)||pickup.encounter,acquired=run.inventory.has(pickup.enabler.id);if(Math.abs(pickup.x-run.player.x)>this.width||Math.abs(pickup.y-run.player.y)>this.height)continue;
      if(!pickup.signature&&!e?.encountered){this.circle(pickup.x,pickup.y-28,4,'#e8e8ce','#9cb5b0');continue;}
      const bob=this.reduced?0:Math.sin(motion*1.6+pickup.x)*3;
      if(pickup.signature)this.signature(pickup.signature,pickup.x,pickup.y-28+bob,motion,20);
      if(acquired){this.label('✓',pickup.x,pickup.y-26,16,'#669b82');continue;}
      this.node(pickup.x,pickup.y-28+bob,'#b89451',true,motion,12);this.label(powerStyle(pickup.relation.mechanism).symbol,pickup.x,pickup.y-23+bob,14,'#886e3e');
      if(Math.hypot(run.player.x-pickup.x,run.player.y-pickup.y)<150)this.label(pickup.relation.mechanism,pickup.x,pickup.y-56,11,'#6d643f');
    }
    this.portals(run,motion);
    for(const s of run.world.signals){this.node(s.x,s.y,'#7ca092',!run.signals.has(s.key),motion,12);this.label(run.signals.has(s.key)?'✓':s.label,s.x,s.y-27,12,'#547c76');}
    const exit=run.world.exit,opened=new Set([...run.priorOpened,...run.encounters.filter(e=>e.opened).map(e=>e.id)]),ready=(run.world.chapterIds||run.encounters.map(e=>e.id)).length?(run.world.chapterIds||run.encounters.map(e=>e.id)).every(id=>opened.has(id)):(run.world.chapterSignalKeys||run.world.signals.map(s=>s.key)).every(key=>run.signals.has(key)||run.priorSignals.has(run.world.gate.id+':'+key));
    c.strokeStyle=ready?'#609f90':'#8eacae';c.lineWidth=2;c.beginPath();c.ellipse(exit.x,exit.y-45,26,44,0,Math.PI,Math.PI*3);c.stroke();this.circle(exit.x,exit.y-45,13,ready?'#faf0c777':'#e9f3ec44');
    this.label(ready?'E · continue the journey':'CENTRAL PORTAL',exit.x,exit.y-108,12,'#466b75');
    if(run.time<18&&!run.encounters.some(e=>e.encountered)){this.label('← explore     jump ↑     explore →',exit.x,exit.y-152,13,'#456d78');}
    const cp=run.checkpoint;this.circle(cp.x+12,cp.y+32,4,'#b9d8c2','#76a494');
    for(const effect of this.effects){effect.age+=delta;if(effect.type==='notice'||effect.type==='collect'){this.label('!',effect.x,effect.y-30-effect.age*14,28,'#946c25');if(effect.type==='notice')continue;}const a=Math.min(1,effect.age/1.4),color=powerStyle(effect.mechanism).color;c.globalAlpha=(1-a)*.5;c.lineWidth=1.4;c.strokeStyle=color;c.beginPath();if(effect.mechanism==='Frame')c.arc(effect.x,effect.y,30+a*260,0,7);else if(effect.mechanism==='Assure')c.ellipse(effect.x,effect.y,35+a*95,35+a*80,0,0,7);else c.arc(effect.x,effect.y,15+a*75,-Math.PI*.3,Math.PI*1.3);if(!this.reduced)c.stroke();c.globalAlpha=1;}this.effects=this.effects.filter(e=>e.age<1.4);
    this.spark(run,motion);c.restore();
    if(mode==='complete'&&run.world.index===5){c.fillStyle='#f0f7ef40';c.fillRect(0,0,this.width,this.height);}
  }
}
