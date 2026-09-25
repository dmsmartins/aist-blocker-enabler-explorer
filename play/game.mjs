import {POWERS,GROUND,HEIGHT,buildLevels,createRun,platforms,currentEncounter,step} from './engine.mjs';

const $=id=>document.getElementById(id);
const canvas=$('game'),ctx=canvas.getContext('2d');
const input={left:false,right:false,jump:false,action:false};
const SAVE_KEY='aistScaleRunProgressV1';
const shortNames=['Align','Design','Build','Deploy','Evolve','Transition'];
const themes=['#143853','#19354c','#133f4c','#26354c','#16464a','#20354c'];
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
let data,levels=[],run=null,levelIndex=0,mode='loading',completed=[],viewWidth=960,camera=0,lastTime=0,toastUntil=0,particles=[],dialogResume=false,storageWarned=false;
try{const saved=JSON.parse(localStorage.getItem(SAVE_KEY)||'[]');if(Array.isArray(saved))completed=[...new Set(saved.filter(n=>Number.isInteger(n)&&n>=1&&n<=6))];}catch{}
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function notify(text,seconds=3){$('toast').textContent=text;toastUntil=performance.now()+seconds*1000;}
function clearInput(){for(const key of Object.keys(input))input[key]=false;document.querySelectorAll('[data-hold]').forEach(b=>b.classList.remove('held'));}
function save(){try{localStorage.setItem(SAVE_KEY,JSON.stringify(completed));}catch{if(!storageWarned){notify('Progress cannot be saved in this browser. You can keep playing.',5);storageWarned=true;}}}
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);viewWidth=HEIGHT*rect.width/rect.height;canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);ctx.setTransform(canvas.width/viewWidth,0,0,canvas.height/HEIGHT,0,0);}
new ResizeObserver(resize).observe(canvas);

function renderGates(){
  $('gates').innerHTML=levels.map((l,i)=>{const done=completed.includes(Number(l.gate.id)),unlocked=i===0||completed.includes(Number(levels[i-1].gate.id));return `<button class="gate ${i===levelIndex?'active':''} ${done?'done':''}" data-level="${i}" ${unlocked?'':'disabled'} ${i===levelIndex?'aria-current="step"':''} aria-label="Stage Gate ${l.gate.id}: ${esc(l.gate.label)}${done?', completed':unlocked?'':', locked'}"><b>${done?'✓':l.gate.id}</b><span>${shortNames[i]||'Stage '+l.gate.id}</span></button>`;}).join('');
  $('gates').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>prepare(Number(b.dataset.level))));
}

function updateHUD(){
  if(!run)return;
  $('gateNumber').textContent=`STAGE GATE ${run.level.gate.id} / ${levels.length}`;
  $('gateTitle').textContent=run.level.gate.label;
  $('progress').textContent=`${completed.length} / ${levels.length} gates`;
  const active=currentEncounter(run);
  $('powerTray').innerHTML=Object.entries(POWERS).map(([key,p])=>{const acquired=run.encounters.some(e=>e.mechanism===key&&e.collected),current=active?.mechanism===key&&!active.resolved;return `<span class="power ${acquired?'acquired':''} ${current?'current':''}" style="--power:${p.color}" title="${key}: ${p.effect}${acquired?' Collected.':''}"><b aria-hidden="true">${p.glyph}</b>${key}</span>`;}).join('');
  if(run.level.transition){$('objective').textContent=`${run.beacons.filter(b=>b.collected).length} / 3 handover signals collected`;}
  else {const n=run.encounters.filter(e=>e.resolved).length;$('objective').textContent=`${n} / ${run.encounters.length} paths opened${active&&!active.resolved?' · '+(active.collected?'Use '+active.mechanism+' near the barrier':'Find the '+active.mechanism+' enabler'): ' · Reach the portal'}`;}
  $('knowledge').disabled=false;
}

function showOverlay(title,text,button,note){
  $('overlayTitle').textContent=title;$('overlayText').textContent=text;$('start').textContent=button;$('start').disabled=false;$('overlayNote').textContent=note;$('overlay').hidden=false;
}

function prepare(index){
  levelIndex=index;run=createRun(levels[index]);camera=0;particles=[];mode='ready';clearInput();$('toast').textContent='';$('pause').disabled=true;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game');$('restart').disabled=false;
  renderGates();updateHUD();
  const transition=run.level.transition;
  showOverlay(index===0?'Scale Run.':`Gate ${run.level.gate.id} · ${shortNames[index]||'Continue'}`,transition?'Carry the knowledge forward. Collect the three handover signals, then reach the portal.':'Jump to collect the glowing enabler. Move to the barrier and use it to open the path.',completed.includes(Number(run.level.gate.id))?'Replay this gate →':'Enter this gate →',transition?'No blockers are mapped to this gate. This is an illustrative handover sequence.':`${run.encounters.length} selected challenges · ${run.level.mappedCount} blockers in this gate`);
}

function start(){
  if(mode==='error'){load();return;}
  if(mode==='complete'){const next=levelIndex+1;if(next<levels.length)prepare(next);else prepare(0);return;}
  if(!run)return;
  mode='playing';clearInput();$('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='Ⅱ';$('pause').setAttribute('aria-label','Pause game');canvas.focus({preventScroll:true});lastTime=performance.now();
}

function pause(){
  if(mode==='paused'){start();return;}
  if(mode!=='playing')return;
  mode='paused';clearInput();$('pause').textContent='▶';$('pause').setAttribute('aria-label','Resume game');showOverlay('Take a breath.','Your spark will be right here.','Resume →','There is no timer. Progress at your own pace.');
}

function finish(){
  mode='complete';clearInput();if(!completed.includes(Number(run.level.gate.id))){completed.push(Number(run.level.gate.id));save();}renderGates();updateHUD();$('pause').disabled=true;
  const final=levelIndex===levels.length-1;
  showOverlay(final?'Knowledge carries on.':'A path made possible.',final?'You have travelled through all six Stage Gates — from the first idea to a considered transition.':'Every crossing began with the right enabling action. Take those insights into the next Stage Gate.',final?'Play again →':'Next Stage Gate →',final?'Game complete. Explore the real blockers and enablers to continue learning.':'Game completion illustrates a relationship; it does not establish real-world readiness.');
  $('start').focus({preventScroll:true});
}

function openDialog(kicker,html){dialogResume=mode==='playing';if(dialogResume){mode='dialog';clearInput();}$('dialogKicker').textContent=kicker;$('dialogBody').innerHTML=html;$('details').showModal();}
$('details').addEventListener('close',()=>{if(dialogResume&&mode==='dialog'){mode='playing';lastTime=performance.now();canvas.focus({preventScroll:true});}dialogResume=false;});
$('closeDialog').addEventListener('click',()=>$('details').close());
$('help').addEventListener('click',()=>openDialog('HOW TO PLAY',`<h2>Find what changes the path.</h2><p>You are a small AI spark travelling through six lifecycle Stage Gates. There are no enemies, scores or time limits.</p><ol class="mini-list"><li><strong>Move and jump.</strong> Use ← / → or A / D. Jump with Space, ↑ or W. On a phone, hold the on-screen controls.</li><li><strong>Collect the glowing enabler</strong> above each small platform. Its symbol shows the enabling mechanism.</li><li><strong>Activate it near the barrier.</strong> Press E or tap Use. The path changes according to the mechanism.</li><li><strong>Reach the portal</strong> after opening each path. If you fall, return to a checkpoint with your collected enablers.</li></ol><p>Use <strong>Behind this challenge</strong> to read the actual blocker, enabler and relationship. You can pause with P or Escape. Stage Gate 6 illustrates handover and closure; it currently has no mapped blockers.</p><p>Each level samples up to three blockers. The six mechanisms are ways of enabling progress, not a mandatory sequence. Playing does not assess an organisation's maturity or prove that a real blocker is resolved.</p>`));

$('knowledge').addEventListener('click',()=>{
  if(!run)return;
  const e=currentEncounter(run);
  if(!e){openDialog('RETIREMENT & TRANSITION',`<h2>Carry knowledge into what comes next.</h2><p>No blockers are currently mapped to this Stage Gate in the Explorer. The three handover signals are game metaphors for preserving knowledge, transferring responsibility and closing with care. They are not new entries in the AIST dataset.</p><a href="../timeline/" target="_blank" rel="noopener">Explore the lifecycle ↗</a>`);return;}
  const href=`../#domain/${encodeURIComponent(e.blocker.domain)}/blocker/${e.blocker.id}/enabler/${e.enabler.id}`;
  openDialog(`STAGE GATE ${run.level.gate.id} · ${e.mechanism.toUpperCase()}`,`<span class="chip">THE BLOCKER</span><h2>${esc(e.blocker.title)}</h2><p>${esc(e.blocker.statement)}</p><div class="knowledge-enabler"><span class="chip">${esc(e.mechanism.toUpperCase())} · THE ENABLER</span><h3>${esc(e.enabler.title)}</h3><p>${esc(e.enabler.description)}</p><p><strong>Why this connection matters</strong><br>${esc(e.relation.rationale)}</p>${e.enabler.practicalActions?`<p><strong>Practical actions</strong><br>${esc(e.enabler.practicalActions)}</p>`:''}</div><p>${esc(POWERS[e.mechanism].effect)} This is a game metaphor for the enabling mechanism, not a claim that one action eliminates a real-world barrier.</p><a href="${href}" target="_blank" rel="noopener">Open this connection in the Explorer ↗</a>`);
});
$('start').addEventListener('click',start);$('pause').addEventListener('click',pause);$('restart').addEventListener('click',()=>{if(run)prepare(levelIndex);});

const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'jump',KeyW:'jump',Space:'jump',KeyE:'action'};
document.addEventListener('keydown',e=>{
  if($('details').open)return;
  if((e.code==='KeyP'||e.code==='Escape')&&!e.repeat&&(mode==='playing'||mode==='paused')){e.preventDefault();pause();return;}
  if(mode!=='playing'||(e.target!==canvas&&e.target!==document.body))return;
  if(keyMap[e.code]){e.preventDefault();input[keyMap[e.code]]=true;}
});
document.addEventListener('keyup',e=>{if(keyMap[e.code])input[keyMap[e.code]]=false;});
document.querySelectorAll('[data-hold]').forEach(button=>{
  const key=button.dataset.hold;
  button.addEventListener('pointerdown',e=>{if(mode!=='playing')return;e.preventDefault();button.setPointerCapture(e.pointerId);input[key]=true;button.classList.add('held');});
  const release=()=>{input[key]=false;button.classList.remove('held');};
  button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
  button.addEventListener('keydown',e=>{if(mode==='playing'&&(e.key===' '||e.key==='Enter')){e.preventDefault();input[key]=true;button.classList.add('held');}});
  button.addEventListener('keyup',release);button.addEventListener('blur',release);
});
window.addEventListener('blur',()=>{clearInput();if(mode==='playing')pause();});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(mode==='playing')pause();}});

function burst(x,y,color){if(reducedMotion)return;for(let i=0;i<22;i++)particles.push({x,y,vx:Math.cos(i*2.4)*70,vy:Math.sin(i*2.4)*80-25,life:1,color});}
function handleEvents(events){
  for(const ev of events){
    if(ev.type==='collect'){burst(ev.encounter.x+190,301,POWERS[ev.encounter.mechanism].color);notify(`${ev.encounter.mechanism} acquired · ${POWERS[ev.encounter.mechanism].effect}`);}
    if(ev.type==='resolve'){burst(ev.encounter.x+400,330,POWERS[ev.encounter.mechanism].color);notify(`${POWERS[ev.encounter.mechanism].verb} · The path is open.`);}
    if(ev.type==='missing')notify('Jump to collect the glowing enabler first.');
    if(ev.type==='outOfRange')notify('Move closer to the next barrier to use your enabler.');
    if(ev.type==='respawn')notify('Back at the checkpoint. Your enablers are still with you.');
    if(ev.type==='beacon'){burst(ev.beacon.x,301,'#7fe1d7');notify(ev.beacon.label+' · Handover signal collected.');}
    if(ev.type==='unfinished')notify('Collect all three handover signals before entering the portal.');
    if(ev.type==='complete')finish();
  }
  if(events.length)updateHUD();
}

// Canvas artwork is intentionally procedural: no external assets, engines or trackers.
function roundRect(x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function line(x1,y1,x2,y2,color,width=1){ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke();}
function label(text,x,y,color='#a8c9dd',size=11,align='left'){ctx.fillStyle=color;const readableSize=size<20&&viewWidth<800?size*1.35:size;ctx.font=`${size>=20?650:500} ${readableSize}px system-ui,sans-serif`;ctx.textAlign=align;ctx.fillText(text,x,y);}
function wrap(text,x,y,maxWidth,color,size=12,maxLines=3){ctx.font=`500 ${size}px system-ui,sans-serif`;const words=String(text).split(' ');let row='',lineIndex=0;for(let i=0;i<words.length;i++){const next=row?row+' '+words[i]:words[i];if(ctx.measureText(next).width>maxWidth&&row){label(row,x,y+lineIndex*(size+5),color,size);row=words[i];lineIndex++;if(lineIndex===maxLines-1){const rest=[row,...words.slice(i+1)].join(' ');row=rest;while(ctx.measureText(row).width>maxWidth-12)row=row.slice(0,-1);if(row!==rest)row+='…';break;}}else row=next;}if(row)label(row,x,y+lineIndex*(size+5),color,size);}

function background(t){
  const gradient=ctx.createLinearGradient(0,0,0,HEIGHT);gradient.addColorStop(0,'#071b2f');gradient.addColorStop(1,themes[levelIndex]||themes[0]);ctx.fillStyle=gradient;ctx.fillRect(0,0,viewWidth,HEIGHT);
  // Sparse constellation, distant skyline and lifecycle orbit.
  for(let i=0;i<48;i++){const x=((i*137.53-camera*.12)%(viewWidth+180)+viewWidth+180)%(viewWidth+180)-90,y=34+(i*79.13)%285;ctx.globalAlpha=.2+(i%4)*.1;ctx.fillStyle='#9acde5';ctx.fillRect(x,y,i%5===0?2:1,i%5===0?2:1);}ctx.globalAlpha=1;
  const moonX=viewWidth*.77-camera*.04;ctx.strokeStyle='#558caf22';ctx.lineWidth=1;for(let r=65;r<120;r+=23){ctx.beginPath();ctx.arc(moonX,145,r,0,Math.PI*2);ctx.stroke();}ctx.fillStyle='#598bb413';ctx.beginPath();ctx.arc(moonX,145,55,0,Math.PI*2);ctx.fill();
  for(let i=-1;i<15;i++){const x=i*140-((camera*.22)%140),h=45+((i+17)*47)%120;ctx.fillStyle='#23476444';ctx.beginPath();ctx.moveTo(x,430);ctx.lineTo(x,430-h);ctx.lineTo(x+42,409-h);ctx.lineTo(x+86,430-h);ctx.lineTo(x+86,430);ctx.fill();line(x+42,409-h,x+42,430,'#6998b215');}
  for(let i=0;i<8;i++)line(0,GROUND+14+i*i*1.6,viewWidth,GROUND+14+i*i*1.6,'#4b879317');
  for(let i=-8;i<18;i++)line(viewWidth/2+(i*100-camera*.2)%1600,GROUND,viewWidth/2+(i*180-camera*.35)%2400,HEIGHT,'#4b879317');
  label(String(levelIndex+1).padStart(2,'0'),28,80,'#426c8750',54);label((shortNames[levelIndex]||'Align').toUpperCase(),31,102,'#668fa8',10);
}

function orb(x,y,mechanism,t,collected=false){
  const p=POWERS[mechanism]||{color:'#81e5d7',glyph:'◇'};y+=reducedMotion?0:Math.sin(t*2.7+x)*4;
  if(collected){label('✓',x,y,p.color,19,'center');return;}
  const glow=ctx.createRadialGradient(x,y,2,x,y,38);glow.addColorStop(0,p.color+'55');glow.addColorStop(1,p.color+'00');ctx.fillStyle=glow;ctx.fillRect(x-38,y-38,76,76);
  ctx.save();ctx.translate(x,y);ctx.rotate(Math.PI/4);roundRect(-15,-15,30,30,5,'#19354f',p.color);ctx.restore();label(p.glyph,x,y+6,p.color,22,'center');
}

function barrier(e,t){
  const x=e.x+385-camera,color=POWERS[e.mechanism].color;
  if(x < -350 || x > viewWidth+120)return;
  if(!e.resolved){
    const alpha=e.mechanism==='Frame'?.5:.9;
    ctx.globalAlpha=alpha;const glow=ctx.createLinearGradient(x-20,0,x+55,0);glow.addColorStop(0,color+'00');glow.addColorStop(.5,color+'30');glow.addColorStop(1,color+'00');ctx.fillStyle=glow;ctx.fillRect(x-20,160,75,270);
    for(let i=0;i<7;i++){const by=185+i*35;let shift=0;if(e.mechanism==='Operate'&&!reducedMotion)shift=Math.sin(t*2+i)*5;if(e.mechanism==='Learn'&&!reducedMotion)shift=Math.sin(t+i)*8;roundRect(x+shift,by,30,27,4,'#1c3650',color+'99');if(e.mechanism==='Assure')label('×',x+15+shift,by+19,color,17,'center');else if(e.mechanism==='Equip')line(x+7+shift,by+13,x+23+shift,by+13,color);else if(e.mechanism==='Commit')line(x+15+shift,by+5,x+15+shift,by+22,color);}
    ctx.globalAlpha=1;
    label(POWERS[e.mechanism].glyph,x+15,156,color,23,'center');
    const close=run.player.x>e.x+230 && run.player.x<e.x+430;
    if(close){roundRect(x-108,110,246,28,6,'#0a2037',color+'55');label(e.collected?`E / Use · ${POWERS[e.mechanism].verb}`:'Collect the enabler ←',x+15,129,color,11,'center');}
  }else{
    line(x+14,GROUND-25,x+14,GROUND,color,2);label('✓',x+14,GROUND-35,color,18,'center');
    if(e.mechanism==='Assure'){ctx.beginPath();ctx.arc(x+100,GROUND,104,Math.PI,0);ctx.strokeStyle=color+'60';ctx.lineWidth=2;ctx.stroke();}
  }
  if(!e.resolved&&viewWidth>=800)wrap(e.blocker.title,x-95,66,235,'#bdd3e1',12,3);
}

function draw(t,dt){
  ctx.setTransform(canvas.width/viewWidth,0,0,canvas.height/HEIGHT,0,0);
  if(run){const target=Math.max(0,Math.min(run.length-viewWidth,run.player.x-viewWidth*.29));camera+= (target-camera)*(reducedMotion?1:Math.min(1,dt*7));}
  background(t);
  if(!run)return;
  for(const p of platforms(run)){const x=p.x-camera;if(x+p.w<0||x>viewWidth)continue;const isFloor=p.y===GROUND;
    roundRect(x,p.y,p.w,isFloor?80:14,3,p.bridge?'#204b59':isFloor?'#132e43':'#315c70');
    line(x,p.y+1,x+p.w,p.y+1,p.bridge?POWERS[p.mechanism].color:'#78b5c1',2);
    if(!isFloor){line(x+12,p.y+14,x+12,GROUND,'#51819844');line(x+p.w-12,p.y+14,x+p.w-12,GROUND,'#51819844');}
    if(isFloor)for(let sx=x+20;sx<x+p.w;sx+=42){if(sx<0||sx>viewWidth)continue;line(sx,p.y+12,sx+15,p.y+12,p.bridge?'#72daca55':'#6d9fb033');}
  }
  for(const e of run.encounters){const ox=e.x+190-camera;if(ox>-100&&ox<viewWidth+100){orb(ox,301,e.mechanism,t,e.collected);label(e.collected?'ACQUIRED':e.mechanism.toUpperCase(),ox,267,POWERS[e.mechanism].color,9,'center');}barrier(e,t);}
  for(const b of run.beacons){const bx=b.x-camera;orb(bx,301,null,t,b.collected);label(b.label,bx,264,'#b9e5e1',12,'center');}
  const portalX=run.length-95-camera;
  if(portalX<viewWidth+70){const ready=run.level.transition?run.beacons.every(b=>b.collected):run.encounters.every(e=>e.resolved);const c=ready?'#8ee8de':'#63849a';roundRect(portalX-26,GROUND-95,52,95,25,'#27496344',c);roundRect(portalX-17,GROUND-87,34,87,17,ready?'#7cddd51a':'#385b7011',c+'44');label('→',portalX,GROUND-40,c,28,'center');label(levelIndex===5?'HANDOVER':'NEXT GATE',portalX,GROUND-112,c,9,'center');}
  const p=run.player,px=p.x-camera,py=p.y;
  const earned=run.encounters.filter(e=>e.collected).length;
  if(earned){ctx.strokeStyle='#63e7dc66';ctx.lineWidth=1.5;for(let i=0;i<earned;i++){ctx.beginPath();ctx.ellipse(px+14,py+21,25+i*5,9+i*3,-.35,0,Math.PI*1.65);ctx.stroke();}}
  const glow=ctx.createRadialGradient(px+14,py+17,2,px+14,py+17,32);glow.addColorStop(0,'#52deda55');glow.addColorStop(1,'#52deda00');ctx.fillStyle=glow;ctx.fillRect(px-20,py-17,70,70);
  ctx.save();ctx.translate(px+14,py+17);if(p.vx<0)ctx.scale(-1,1);ctx.beginPath();ctx.moveTo(-11,13);ctx.lineTo(-4,-1);ctx.lineTo(12,-14);ctx.lineTo(12,1);ctx.lineTo(5,-2);ctx.lineTo(-1,9);ctx.closePath();ctx.fillStyle='#91f6e6';ctx.fill();ctx.restore();
  if(mode==='playing')for(const pt of particles){pt.life-=dt;pt.x+=pt.vx*dt;pt.y+=pt.vy*dt;ctx.globalAlpha=Math.max(0,pt.life);ctx.fillStyle=pt.color;ctx.fillRect(pt.x-camera,pt.y,3,3);}ctx.globalAlpha=1;particles=particles.filter(p=>p.life>0);
}

let accumulator=0;
function frame(now){const dt=Math.min((now-(lastTime||now))/1000,.05);lastTime=now;
  if(mode==='playing'){accumulator+=dt;while(accumulator>=1/120&&mode==='playing'){handleEvents(step(run,input,1/120));accumulator-=1/120;}}else accumulator=0;
  draw(reducedMotion?0:now/1000,dt);
  if($('toast').textContent&&now>toastUntil)$('toast').textContent='';
  requestAnimationFrame(frame);
}

async function load(){
  mode='loading';$('start').disabled=true;$('start').textContent='Loading Explorer data…';$('overlayText').classList.remove('load-error');
  try{
    const response=await fetch('../data/explorer-data.json',{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error(`HTTP ${response.status}`);data=await response.json();levels=buildLevels(data);if(levels.length!==6)throw new Error('Expected six Stage Gates.');
    // Reject stale or tampered non-sequential progress instead of unlocking arbitrary levels.
    const valid=[];for(const l of levels){if(!completed.includes(Number(l.gate.id)))break;valid.push(Number(l.gate.id));}completed=valid;
    $('legendItems').innerHTML=Object.entries(POWERS).map(([key,p])=>`<div class="legend-item"><strong><b aria-hidden="true">${p.glyph}</b>${key}</strong><p>${esc(p.effect)}</p></div>`).join('');
    const next=levels.findIndex(l=>!completed.includes(Number(l.gate.id)));prepare(next<0?0:next);
  }catch(error){console.error('Scale Run could not load Explorer data:',error);mode='error';showOverlay('The path is not ready.','The Explorer data could not be loaded. Check your connection and try again.','Try again','You can also return to the Explorer using the navigation above.');$('overlayText').classList.add('load-error');}
}
resize();requestAnimationFrame(frame);load();
