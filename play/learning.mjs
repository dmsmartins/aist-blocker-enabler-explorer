import {esc} from './ui.mjs?v=3';
export function excerpt(text,limit=240){const s=String(text||'').trim();if(s.length<=limit)return s;const end=s.lastIndexOf(' ',limit);return s.slice(0,end>0?end:limit)+'…';}
export function discoveryNotice(event){return event.type==='encounter'?`! ${event.encounter.blocker.title}\n${excerpt(event.encounter.blocker.statement,210)}`:event.type==='collect'?`! ${event.pickup.enabler.title}\n${excerpt(event.pickup.enabler.description,210)}`:'';}
export function learningCard(event,run){
 const e=event.encounter;if(event.type!=='open')return null;
 const acquired=e.relations.filter(r=>run.inventory.has(r.enablerId)),unique=[...new Map(acquired.map(r=>[r.enablerId,r])).values()];
 return {kicker:'TOOLS BECOME A PATH',html:`<p class="eyebrow">TOOLS BECOME A PATH</p><h3>${esc(e.blocker.title)}</h3><div class="key-assembly" aria-hidden="true">${unique.map((r,i)=>`<span style="--i:${i}" title="${esc(e.alternatives.find(a=>a.enabler.id===r.enablerId)?.enabler.title||r.mechanism)}">⚿</span>`).join('')}<b>◇ → ◇</b></div><p><strong>${unique.length} ${unique.length===1?'capability':'capabilities'} connected.</strong> ${esc(excerpt(event.relation?.rationale||unique[0]?.rationale,220))}</p>`};
}
export function journeyStep(run){if(run.world.epilogue||run.world.unavailable)return run.signals.size===run.world.signals.length?3:1;if(run.encounters.every(e=>e.opened))return 3;const e=run.encounters.find(e=>e.id===run.focusId);if(!e||e.opened)return 0;return e.requiredAll?e.alternatives.every(a=>run.inventory.has(a.enabler.id))?2:1:e.relations.some(r=>run.inventory.has(r.enablerId))?2:1;}
