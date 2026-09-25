export function createInput(canvas,handlers) {
  const held=new Map(),pulses=new Set();
  const keys={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',Space:'jump',ArrowUp:'jump',KeyW:'jump',KeyE:'action',ArrowDown:'down',KeyS:'down'};
  const buttons=[...document.querySelectorAll('[data-hold]')];
  function paint(){for(const b of buttons){if([...held.values()].includes(b.dataset.hold))b.classList.add('held');else b.classList.remove('held');}}
  function clear(){held.clear();pulses.clear();document.querySelectorAll('[data-hold]').forEach(b=>b.classList.remove('held'));}
  document.addEventListener('keydown',event=>{
    if(document.querySelector('dialog[open]'))return;
    if((event.code==='KeyP'||event.code==='Escape')&&!event.repeat){event.preventDefault();handlers.pause();return;}
    if(!handlers.isPlaying()||(event.target!==canvas&&event.target!==document.body))return;
    if(keys[event.code]){event.preventDefault();if(!held.has(event.code)&&['jump','action','down'].includes(keys[event.code]))pulses.add(keys[event.code]);held.set(event.code,keys[event.code]);}
    if(event.repeat)return;
    if(event.code==='KeyQ'){event.preventDefault();handlers.cycle();}
    if(event.code==='KeyK'){event.preventDefault();handlers.knowledge();}
    if(event.code==='KeyT'){event.preventDefault();handlers.portals?.();}
    if(event.code==='KeyM'){event.preventDefault();handlers.map();}
    if(/^Digit[1-6]$/.test(event.code)){event.preventDefault();handlers.family(Number(event.code.slice(-1))-1);}
  });
  document.addEventListener('keyup',event=>held.delete(event.code));
  for(const button of buttons){
    const key=button.dataset.hold;
    button.addEventListener('pointerdown',event=>{if(!handlers.isPlaying())return;event.preventDefault();button.setPointerCapture(event.pointerId);held.set('pointer-'+event.pointerId,key);if(key==='jump'||key==='action'||key==='down')pulses.add(key);button.classList.add('held');});
    button.addEventListener('pointermove',event=>{const id='pointer-'+event.pointerId;if(!held.has(id)||!['left','right'].includes(key))return;event.preventDefault();const target=document.elementFromPoint(event.clientX,event.clientY)?.closest?.('[data-hold]');if(target&&['left','right'].includes(target.dataset.hold)){held.set(id,target.dataset.hold);paint();}});
    const release=event=>{held.delete('pointer-'+event.pointerId);paint();};
    button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
    button.addEventListener('keydown',event=>{if(!handlers.isPlaying()||![' ','Enter'].includes(event.key))return;event.preventDefault();held.set('button-'+key,key);if(!event.repeat)pulses.add(key);button.classList.add('held');});
    const unkey=()=>{held.delete('button-'+key);button.classList.remove('held');};button.addEventListener('keyup',unkey);button.addEventListener('blur',unkey);
  }
  window.addEventListener('blur',()=>{clear();handlers.lostFocus();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden){clear();handlers.lostFocus();}});
  return {clear,sample(){const state={};for(const key of held.values())state[key]=true;for(const key of pulses)state[key]=true;pulses.clear();return state;}};
}
