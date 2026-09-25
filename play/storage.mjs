import {SAVE_KEY} from './config.mjs?v=5';
import {idOf} from './data.mjs?v=5';
export function freshProgress(seed='first-light'){return {version:2,fingerprint:'',seed,completed:[],handover:[],encountered:[],capabilities:[],applied:[],mechanisms:[],settings:{sound:false,reducedMotion:false,currentGate:null,currentRoom:0}};}
export function reconcileProgress(raw,data) {
  if(!raw||typeof raw!=='object'||Array.isArray(raw))return freshProgress();
  const value=freshProgress(typeof raw.seed==='string'&&raw.seed.length<100?raw.seed:'first-light');
  const validIds=(items,map)=>[...new Set((Array.isArray(items)?items:[]).map(idOf).filter(id=>map.has(id)))];
  value.completed=validIds(raw.completed,data.gateMap);value.encountered=validIds(raw.encountered,data.blockerMap);value.capabilities=validIds(raw.capabilities,data.enablerMap);
  value.applied=(Array.isArray(raw.applied)?raw.applied:[]).flatMap(r=>{const blockerId=idOf(r?.blockerId),enablerId=idOf(r?.enablerId);return value.capabilities.includes(enablerId)&&data.relationships.some(link=>link.blockerId===blockerId&&link.enablerId===enablerId)?[{blockerId,enablerId}]:[];});
  value.mechanisms=[...new Set(data.relationships.filter(r=>value.capabilities.includes(r.enablerId)&&(Array.isArray(raw.mechanisms)?raw.mechanisms:[]).includes(r.mechanism)).map(r=>r.mechanism))];
  value.handover=[...new Set((Array.isArray(raw.handover)?raw.handover:[]).filter(k=>typeof k==='string'&&/^.+:signal-[0-9]+$/.test(k)&&data.gateMap.has(k.split(':')[0])))];
  value.fingerprint=data.fingerprint;value.settings={sound:raw.settings?.sound===true,reducedMotion:raw.settings?.reducedMotion===true,currentRoom:Number.isInteger(raw.settings?.currentRoom)&&raw.settings.currentRoom>=0?raw.settings.currentRoom:0,currentGate:data.gateMap.has(idOf(raw.settings?.currentGate))?idOf(raw.settings.currentGate):null};
  return value;
}
export function readProgress(storage,data){let raw;try{raw=JSON.parse(storage.getItem(SAVE_KEY)||'null');if(!raw){const old=JSON.parse(storage.getItem('aistScaleRunProgressV1')||'null');if(Array.isArray(old))raw={completed:old};}}catch{}return reconcileProgress(raw,data);}
export function writeProgress(storage,progress){try{storage.setItem(SAVE_KEY,JSON.stringify(progress));return true;}catch{return false;}}
export function captureProgress(progress,run,data) {
  const encountered=new Set([...progress.encountered,...run.encounters.filter(e=>e.encountered).map(e=>e.id)]);
  const applied=new Map(progress.applied.map(p=>[p.blockerId,p]));run.encounters.filter(e=>e.opened).forEach(e=>applied.set(e.id,{blockerId:e.id,enablerId:e.chosen}));
  return reconcileProgress({...progress,handover:[...new Set([...progress.handover||[],...run.signals].map(k=>String(k).includes(':')?k:run.world.gate.id+':'+k))],encountered:[...encountered],capabilities:[...run.inventory],applied:[...applied.values()],mechanisms:[...run.mechanisms],settings:{...progress.settings,currentGate:run.world.gate.id,currentRoom:run.world.roomIndex||0}},data);
}

export function restartProgress(progress,data,seed=progress.seed){return reconcileProgress({...freshProgress(seed),settings:{...progress.settings,currentGate:null,currentRoom:0}},data);}
