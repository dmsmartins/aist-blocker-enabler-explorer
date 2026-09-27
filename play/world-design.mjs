import {hash} from './data.mjs?v=9';
import {platformGraph,routeBetween} from './world-builder.mjs?v=9';
export const WORLD_PROFILES=[
 {zones:3,reach:740,rise:90,span:2800,depth:1450,shape:'plateaus',names:['First ring','Quiet terraces','Open horizon'],layout:[[100,190],[370,190],[640,145]]},
 {zones:5,reach:1050,rise:94,span:3550,depth:1810,shape:'modules',names:['Foundation arch','Suspended spine','Lower archive','Signal tower','Upper observatory'],layout:[[100,230],[330,100],[330,340],[590,100],[590,340]]},
 {zones:4,reach:1240,rise:100,span:3950,depth:1970,shape:'suspended',names:['Assembly ring','Moving span','Verification well','Return loop'],layout:[[110,210],[340,90],[580,210],[340,330]]},
 {zones:7,reach:1430,rise:102,span:4350,depth:2140,shape:'network',names:['Commissioning hub','Western relay','Lower exchange','Northern span','Eastern relay','Distant archive','Integration ring'],layout:[[340,230],[110,230],[230,380],[340,70],[570,230],[640,380],[570,70]]},
 {zones:5,reach:1570,rise:105,span:4700,depth:2310,shape:'adaptive',names:['Living core','Learning canopy','Changing lattice','Memory reservoir','Evolving horizon'],layout:[[350,220],[110,100],[590,100],[110,360],[590,360]]},
 {zones:3,reach:1330,rise:85,span:4100,depth:2070,shape:'release',names:['Continuity ring','Handover lights','Open horizon'],layout:[[100,260],[350,170],[620,100]]}
];
const glyphs=['∴','⋄','◔','◎','∥','△','⁙'];
export function signatureFor(id,rank,seed){return {color:`hsl(${(hash(seed)%50+rank*137.508)%360} 30% 47%)`,glyph:glyphs[rank%glyphs.length],marks:1+Math.floor(rank/glyphs.length),pulse:rank%5,key:id};}
export function designOrder(challenges,index,seed){
 const scored=challenges.map(c=>({...c,load:c.alternatives.length+Math.min(5,c.upstream.length)*1.4+(c.knot?2:0)})).sort((a,b)=>a.load-b.load||hash(seed+a.blocker.id)-hash(seed+b.blocker.id));
 return scored.map((c,i)=>{const t=i/Math.max(1,scored.length-1),base=[0,1,2,3,4,0][index];return {...c,signature:signatureFor(c.blocker.id,i,seed),gameDesign:{traversalDifficulty:base+t,navigationDifficulty:base+t*2,dependencyDifficulty:Math.min(c.upstream.length,5),enablerDistance:base+t,backtrackingCost:base+t,overallGameDifficulty:base*10+t*8},journeyRank:i};});
}
export function route(world,id,from,to,width=150){const n=Math.max(1,Math.ceil(Math.abs(to.x-from.x)/160),Math.ceil(Math.abs(to.y-from.y)/85));for(let i=1;i<n;i++)world.platforms.push({id:id+'-'+i,x:from.x+(to.x-from.x)*i/n-width/2,y:from.y+(to.y-from.y)*i/n,w:width,kind:'branch'});}
export function expandRoom(world,profile,roomIndex){
 const hub={x:profile.span/2,y:profile.depth-250},dx=hub.x-world.entrance.x,dy=hub.y-world.entrance.y;
 world.width=profile.span;world.height=profile.depth;world.entrance={...hub};world.exit={...hub};world.design=profile;world.zoneName=profile.names[roomIndex%profile.names.length];world.mapPosition=profile.layout[roomIndex%profile.layout.length];
 for(const p of world.platforms){p.x+=dx;p.y+=dy;}for(const s of world.signals){s.x+=dx;s.y+=dy;}
 for(const e of world.encounters){e.x+=dx;e.y+=dy;e.anchorX+=dx;}for(const p of world.pickups){p.x+=dx;p.y+=dy;}
 world.platforms=world.platforms.filter(p=>!p.id.startsWith('branch-')&&!p.id.startsWith('spine-'));
 const tiers=Math.ceil((profile.depth-430)/profile.rise);for(let i=1;i<=tiers;i++)world.platforms.push({id:'spine-'+i,x:hub.x+(i%2?-62:62)-85,y:hub.y-i*profile.rise,w:170,kind:'spine'});
 world.encounters.forEach((e,i)=>{const tx=i===4?hub.x:hub.x+(i%2?1:-1)*profile.reach,ty=i===4?hub.y-850:hub.y-180-Math.floor(i/2)*(profile.rise*4.5),ex=tx-e.x,ey=ty-e.y;
  for(const p of world.platforms)if(p.encounterId===e.id||p.id.endsWith('-'+e.id)){p.x+=ex;p.y+=ey;}
  for(const p of world.pickups)if(p.encounterId===e.id){p.x+=ex;p.y+=ey;}
  e.x=tx;e.y=ty;e.anchorX+=ex;
  route(world,'outward-'+e.id,{x:hub.x,y:ty},{x:tx,y:ty},world.index?125:150);
 });
 // Broad cache terraces also support zones without blocker encounters.
 for(let i=0;i<3;i++){const x=hub.x+(i===0?-1:1)*(380+i*130),y=hub.y-180-i*profile.rise*2;world.platforms.push({id:'cache-'+i,x:x-110,y,w:220,kind:'garden'});route(world,'cache-route-'+i,{x:hub.x,y},{x,y},150);}
 world.landmark={x:hub.x+300,y:hub.y-410,kind:(world.index+roomIndex)%7,name:world.zoneName};
 world.checkpoints=world.platforms.filter(p=>p.kind==='garden'||p.kind==='approach'||p.kind==='hub'||p.id.startsWith('spine-')&&Number(p.id.split('-')[1])%3===0).map(p=>p.id);
 // Moving spans are forgiving optional alternatives over an existing safe route.
 if(world.index===4&&world.encounters.length){const e=world.encounters[0];for(let i=1;i<5;i++)world.platforms.push({id:'adaptive-'+i,x:hub.x+i*160-70,y:hub.y-i*65,w:140,kind:'support',requiresBlocker:e.id});}
 if(world.index>=2&&world.index<=4){const y=hub.y-180;world.platforms.push({id:'moving-span',x:hub.x+170,y:y-38,w:150,kind:'moving',motion:{amplitude:28,speed:.6,axis:'x'}});}
 return world;
}
export function validateCampaign(chapter){
 const errors=[],opened=new Set(),inventory=new Set(),encountered=new Set(),reachable=new Set([0]);let changed=true;
 while(changed){changed=false;for(const i of [...reachable]){const room=chapter.rooms[i];for(const e of room.encounters)if(!encountered.has(e.id)){encountered.add(e.id);changed=true;}for(const p of room.pickups)if(encountered.has(p.encounterId)&&!inventory.has(p.enabler.id)){inventory.add(p.enabler.id);changed=true;}for(const e of room.encounters)if(!opened.has(e.id)&&e.alternatives.every(a=>inventory.has(a.enabler.id))){opened.add(e.id);changed=true;}for(const p of room.portals)if((!p.hostId||opened.has(p.hostId))&&p.requirements.every(id=>opened.has(id))&&!reachable.has(p.targetRoom)){reachable.add(p.targetRoom);changed=true;}}}
 if(reachable.size!==chapter.rooms.length)errors.push('Unreachable zone');if(opened.size!==chapter.allChallenges.length)errors.push('Capability prerequisite cycle');
 for(const room of chapter.rooms){const graph=platformGraph(room.platforms.filter(p=>!p.lockedBy));for(const p of [...room.pickups,...room.signals,...room.portals.filter(p=>!p.hostId)])if(!routeBetween(graph,'home',p.platformId)||!routeBetween(graph,p.platformId,'home'))errors.push('No round trip: '+room.roomIndex+':'+p.id);for(const e of room.encounters)if(!routeBetween(graph,'home','approach-'+e.id))errors.push('Unreachable blocker '+e.id);}
 return {valid:!errors.length,errors};
}
