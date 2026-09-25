import {THEMES,powerStyle} from './config.mjs?v=4';
import {platforms,currentEncounter,portalOpen,portalZones} from './engine.mjs?v=4';
import {hash} from './data.mjs?v=4';

export class Renderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');if(!this.ctx)throw new Error('Canvas 2D is unavailable');this.camera={x:0,y:0,zoom:1};this.width=1000;this.height=600;this.effects=[];this.reduced=false;this.overview=0;this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.resize();}
  resize(){const rect=this.canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;this.width=rect.width<600?470:rect.width;this.height=rect.height*this.width/rect.width;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=Math.round(rect.width*dpr);this.canvas.height=Math.round(rect.height*dpr);}
  reset(run){this.camera={x:run.player.x-this.width*.5,y:run.player.y-this.height*.68,zoom:1};this.effects=[];}
  react(event){if(event.type==='encounter')this.effects.push({x:event.encounter.x,y:event.encounter.y-50,age:0,type:'notice'});if(event.type==='open'){this.overview=1.8;this.effects.push({x:event.encounter.x,y:event.encounter.y-25,mechanism:event.relation.mechanism,age:0,type:'open'});}if(event.type==='collect')this.effects.push({x:event.pickup.x,y:event.pickup.y-28,mechanism:event.pickup.relation.mechanism,age:0,type:'collect'});if(event.type==='return')this.overview=.8;}
  line(x1,y1,x2,y2,color,width=1){const c=this.ctx;c.strokeStyle=color;c.lineWidth=width;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
  circle(x,y,r,fill,stroke){const c=this.ctx;c.beginPath();c.arc(x,y,Math.max(.1,r),0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1.5;c.stroke();}}
  label(text,x,y,size=12,color='#355c69',align='center'){const c=this.ctx;c.font=`600 ${size}px system-ui,sans-serif`;c.fillStyle=color;c.textAlign=align;c.fillText(text,x,y);}
  rounded(x,y,w,h,r,fill,stroke){const c=this.ctx;c.beginPath();c.roundRect(x,y,w,h,r);if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}}
  background(run,time){const c=this.ctx,theme=THEMES[run?.world.index%THEMES.length||0],w=this.width,h=this.height;
    const sky=c.createLinearGradient(0,0,0,h);sky.addColorStop(0,theme.sky);sky.addColorStop(1,theme.low);c.fillStyle=sky;c.fillRect(0,0,w,h);
    const sunX=w*.77-this.camera.x*.035,sunY=h*.19-this.camera.y*.025,light=c.createRadialGradient(sunX,sunY,8,sunX,sunY,w*.45);light.addColorStop(0,'#fff9eab8');light.addColorStop(.4,'#fff9ea48');light.addColorStop(1,'#fff9ea00');c.fillStyle=light;c.fillRect(0,0,w,h);
    for(let layer=0;layer<3;layer++){
      const base=h*(.48+layer*.18)-this.camera.y*(.035+layer*.025),step=w/4;
      c.beginPath();c.moveTo(-step,h);for(let i=-1;i<7;i++){const x=i*step-(this.camera.x*(.04+layer*.03))%step,top=base-35*Math.sin(i*2.7+layer*3);c.bezierCurveTo(x-step*.2,top+95,x+step*.15,top-90,x+step*.8,top+40);}c.lineTo(w+step,h);c.closePath();c.fillStyle=['#8fbbc51a','#79adb325','#649ba32a'][layer];c.fill();
    }
    // Painterly mist, not a layer over interactive foreground silhouettes.
    for(let i=0;i<5;i++){const x=((i*.27*w+time*(i%2?1:-1)*2)% (w+280))+100,y=h*.22+i*67;c.fillStyle=theme.mist+'22';c.beginPath();c.ellipse(x,y,180,25,0,0,Math.PI*2);c.fill();}
    for(let i=0;i<22;i++){const x=((i*137.2-this.camera.x*.08+time*(i%2?2:-1))%(w+80)+w+80)%(w+80),y=(i*71.7+Math.sin(time*.3+i)*8)%h;this.circle(x,y,i%3===0?2:1.1,'#ffffff8a');}
    if(run&&run.world.index>0){c.strokeStyle='#6595a520';c.lineWidth=1;for(let i=0;i<run.world.index+2;i++){const x=w*.3+i*110-this.camera.x*.08,y=h*.4+(i%2)*50;c.beginPath();c.arc(x,y,50+i*5,0,Math.PI*1.4);c.stroke();}}
  }
  island(p,theme,run,time){const c=this.ctx,w=p.w,x=p.x,y=p.y,seed=hash(p.id),depth=p.kind==='hub'?70:p.kind==='bridge'?15:32+seed%22;
    let alpha=1,shift=0,scale=1;
    if(p.kind==='bridge'){const e=run.encounters.find(e=>e.id===p.encounterId),a=this.reduced?1:e.animation;alpha=Math.max(.15,a);if(p.mechanism==='Commit')shift=(1-a)*45*(x<e.x?-1:1);if(p.mechanism==='Equip')scale=.25+.75*a;if(p.mechanism==='Learn')shift=Math.sin((1-a)*Math.PI)*25;if(p.mechanism==='Operate')shift=(1-a)*Math.sin(time*6)*13;}
    c.save();c.globalAlpha=alpha;c.translate(shift,0);
    const fill=c.createLinearGradient(x,y,x,y+depth);fill.addColorStop(0,p.kind==='bridge'?'#689e9b':theme.rock);fill.addColorStop(1,theme.rock+'19');
    c.beginPath();c.moveTo(x,y+3);c.lineTo(x+w,y+3);c.bezierCurveTo(x+w*.98,y+depth*.8,x+w*.73,y+depth*.35,x+w*.64,y+depth);c.bezierCurveTo(x+w*.45,y+depth*.7,x+w*.26,y+depth*1.18,x+w*.12,y+depth*.5);c.closePath();c.fillStyle=fill;c.fill();
    this.rounded(x+w*(1-scale)/2,y,w*scale,9,4,p.kind==='bridge'?'#b0d9ca':'#c5ded0',theme.rock+'88');this.line(x+5,y+2,x+w-5,y+2,'#eff9e5',2);
    if(p.kind!=='bridge'&&p.kind!=='support')for(let i=0;i<Math.min(5,w/35);i++){const tx=x+12+(seed+i*41)%(w-24),height=6+(seed+i)%9;this.line(tx,y,tx-3,y-height,theme.leaf,1.6);c.fillStyle=theme.leaf+'b0';c.beginPath();c.ellipse(tx-6,y-height+2,5,2,-.6,0,7);c.fill();}
    if(p.kind==='garden'){c.fillStyle='#b9cfae';for(let i=0;i<3;i++){const xx=x+30+i*35;c.beginPath();c.ellipse(xx,y-4,12,5,0,Math.PI,Math.PI*2);c.fill();}}
    c.restore();
  }
  node(x,y,color,active,time,size=11){const c=this.ctx;const glow=c.createRadialGradient(x,y,2,x,y,size*3);glow.addColorStop(0,active?'#fff0b6b0':color+'40');glow.addColorStop(1,color+'00');c.fillStyle=glow;c.fillRect(x-size*3,y-size*3,size*6,size*6);this.circle(x,y,size,active?'#f9e5a4':'#eef7ee',color);this.circle(x,y,3,active?'#bd9147':color);}
  encounter(e,run,time){const c=this.ctx,theme=THEMES[run.world.index%THEMES.length],x=e.x+e.dir*205,y=e.y-56,a=e.opened?(this.reduced?1:e.animation):0,noise=1-a,color=e.opened?'#447f79':'#6b8998';
    c.save();c.globalAlpha=e.encountered?1:.65;
    if(e.archetype==='split-network'){
      for(let i=0;i<4;i++){const xx=x+(i<2?-65:65)+(i%2?6:-6)*noise,yy=y+(i%2?25:-30);this.node(xx,yy,color,false,time,8);if(a)this.line(x-65,yy,x+65,yy,'#599c90aa',2);else this.line(xx,yy,xx+(i<2?33:-33),yy,'#6b899888',1.5);}if(!a)this.line(x,y-45,x,y+40,'#8daab966');
    }else if(e.archetype==='broken-stream'){
      for(let i=0;i<7;i++){const xx=x-95+i*30,yy=y+noise*Math.sin(time*1.4+i)*18;this.rounded(xx,yy,22,12,3,i%3===0&&noise>.5?'#82aab14d':'#7aa7a2',null);if(a)this.line(xx+22,yy+6,xx+30,yy+6,'#6f9f98',1.5);}for(let j=0;j<3;j++)this.line(x-90,y+35+j*8,x+90,y+35+j*8,'#91b8b344');
    }else if(e.archetype==='routing-knot'){
      for(let i=0;i<5;i++){const angle=i*Math.PI*2/5,xx=x+Math.cos(angle)*58,yy=y+Math.sin(angle)*48;this.node(xx,yy,color,false,time,7);c.beginPath();c.moveTo(xx,yy);c.quadraticCurveTo(x+noise*45*Math.sin(i),y-noise*40,x,y);c.strokeStyle='#6d99a099';c.lineWidth=1.5;c.stroke();}this.circle(x,y,12,a?'#b2d8bd':'#e1ebe5',color);
    }else if(e.archetype==='misaligned-interfaces'){
      this.rounded(x-85,y-30-noise*16,60,60,8,'#88aeb55a','#71939b');this.rounded(x+25,y-30+noise*16,60,60,8,'#a0bfb35a','#71939b');for(let i=0;i<3;i++){this.line(x-25,y-16+i*16-noise*16,x+(-5+30*a),y-16+i*16+noise*16,'#58979b',2);this.circle(x+25,y-16+i*16+noise*16,3,'#c5dfd1','#608b96');}
    }else if(e.archetype==='missing-structure'){
      c.setLineDash([4,6]);this.rounded(x-86,y-34,172,65,4,null,'#729fa5');c.setLineDash([]);for(let i=0;i<4;i++){const xx=x-77+i*42,yy=y-15+(i%2?1:-1)*noise*19;this.rounded(xx,yy,32,27,3,a?'#8fbbb0':'#9bb9b569','#6c929b');}
    }else if(e.archetype==='veil'){
      for(let i=0;i<6;i++){const xx=x-70+i*27,yy=y+Math.sin(i+time*.5)*noise*20;this.circle(xx,yy,26,`rgba(151,177,190,${.13+noise*.12})`);}c.beginPath();c.ellipse(x,y+20,98,75,0,Math.PI,0);c.strokeStyle=a?'#6caaa0':'#849fab';c.lineWidth=a?2:1;c.setLineDash(a?[]:[4,6]);c.stroke();c.setLineDash([]);if(a)this.label('✓',x,y,22,'#48877a');
    }else if(e.archetype==='oscillating-flow'){
      c.beginPath();for(let i=0;i<=180;i+=3){const xx=x-90+i,yy=y+Math.sin(i*.065+time*1.8)*(noise*28+3);if(i===0)c.moveTo(xx,yy);else c.lineTo(xx,yy);}c.strokeStyle='#6699a0';c.lineWidth=3;c.stroke();for(let i=0;i<3;i++)this.rounded(x-72+i*58,y+35+Math.sin(time*1.8+i)*noise*14,34,10,3,'#8ab4aa');
    }else{
      for(let i=0;i<2;i++){c.beginPath();c.ellipse(x+(i?34:-34),y,58,37,(i?1:-1)*(noise*.6),0,Math.PI*2);c.strokeStyle='#73a299';c.lineWidth=1.8;c.stroke();const angle=time*.35+i*3;this.circle(x+(i?34:-34)+Math.cos(angle)*58,y+Math.sin(angle)*37,5,'#d6deb6','#7aab98');}
    }
    // Source stakeholders become a sparse constellation, never literal people.
    if(e.encountered)for(let i=0;i<Math.min(4,e.blocker.stakeholders.length);i++){const xx=e.x-30+i*20,yy=e.y-103;this.circle(xx,yy,2.5,e.opened?'#519c8b':'#90aab2');if(e.opened&&i)this.line(xx-20,yy,xx,yy,'#73a59877');}
    if(e.knot&&e.encountered){c.beginPath();c.ellipse(e.x,e.y-36,29,16,-.5,0,Math.PI*2);c.strokeStyle='#8ba5b466';c.stroke();}
    this.node(e.x,e.y-32,e.opened?'#478e80':'#668995',false,time,12);
    const near=Math.hypot(run.player.x+12-e.x,run.player.y+14-(e.y-25))<105;
    const collected=e.alternatives.filter(a=>run.inventory.has(a.enabler.id)).length;
    if(near)this.label(e.opened?'E · return shortcut':e.requiredAll&&collected<e.alternatives.length?`${collected}/${e.alternatives.length} tools collected`:run.inventory.has(run.selected)&&e.relations.some(r=>r.enablerId===run.selected)?'E or ability · unlock':'Choose a linked capability',e.x,e.y-72,12,'#315969');
    if(e.support&&!e.opened)this.label('Connected support',e.x,e.y+48,10,'#56877d');
    if(e.opened&&!(run.world.portals||[]).some(p=>p.hostId===e.id)){this.node(e.anchorX,e.y-27,'#579a88',false,time,9);this.label('↩',e.anchorX,e.y-48,18,'#53877c');}
    c.restore();
  }
  dependencies(run,time){const c=this.ctx,focus=currentEncounter(run);if(!focus)return;
    for(const link of run.world.dependencyLinks.filter(l=>l.to===focus.id||l.from===focus.id).slice(0,7)){
      const from=run.encounters.find(e=>e.id===link.from),to=run.encounters.find(e=>e.id===link.to);if(!to?.encountered)continue;
      if(!from){const supported=run.priorOpened.has(link.from),x=to.x-55,y=to.y-135;this.circle(x,y,5,supported?'#8abc9f':'#dcebe5','#87a8b4');this.line(x,y,to.x,to.y-48,supported?'#498e86a0':'#799eaf55',supported?2:1);continue;}
      if(!from.encountered)continue;
      c.beginPath();c.moveTo(from.x,from.y-35);c.bezierCurveTo(from.x,Math.min(from.y,to.y)-140,to.x,Math.min(from.y,to.y)-140,to.x,to.y-35);c.strokeStyle=from.opened?'#498e86a0':'#799eaf55';c.lineWidth=from.opened?1.8:1;c.setLineDash(from.opened?[]:[4,8]);c.stroke();c.setLineDash([]);
      this.label('↓',to.x,to.y-59,11,from.opened?'#4c9789':'#8aabb5');
    }
  }
  portals(run,time){const c=this.ctx;
    for(const z of portalZones(run)){this.rounded(z.x,z.y,z.w,z.h,18,'#d5e5e755','#7796a877');c.setLineDash([3,6]);this.rounded(z.x+5,z.y+5,z.w-10,z.h-10,14,null,'#8ca4b280');c.setLineDash([]);}
    for(const p of run.world.portals||[]){const open=portalOpen(run,p),phase=this.reduced?0:time*.3;c.save();c.translate(p.x,p.y);c.globalAlpha=open?1:.5;const g=c.createRadialGradient(0,0,7,0,0,32);g.addColorStop(0,'#172235dd');g.addColorStop(.48,'#34445b88');g.addColorStop(1,'#7499b000');c.fillStyle=g;c.fillRect(-34,-34,68,68);this.circle(0,0,13,'#142032','#7397a9');for(let i=0;i<3;i++){c.beginPath();c.ellipse(0,0,21+i*3,8+i*2,phase+i*.9,0,Math.PI*1.65);c.strokeStyle=i%2?'#abcbd3aa':'#789dacaa';c.lineWidth=1.1;c.stroke();}c.restore();const near=Math.hypot(run.player.x+12-p.x,run.player.y+14-p.y)<145;this.label(near?(open?'E · '+p.label:'Passage sealed'):String(p.targetRoom+1),p.x,p.y-46,near?11:10,open?'#345968':'#6c8291');}
  }
  spark(run,time){const c=this.ctx,p=run.player,x=p.x+p.w/2,y=p.y+p.h/2;const glow=c.createRadialGradient(x,y,1,x,y,31);glow.addColorStop(0,'#fffdfbe6');glow.addColorStop(.32,'#fff8cfb0');glow.addColorStop(1,'#fffcdf00');c.fillStyle=glow;c.fillRect(x-31,y-31,62,62);this.circle(x,y,8.5,'#fffdf4','#9fbdb3');
    if(run.timers?.Assure>run.time){c.strokeStyle='#6baab6';c.beginPath();c.arc(x,y,23,Math.PI,Math.PI*2);c.stroke();}if(run.timers?.Equip>run.time)this.label('↑',x,y-30,19,'#568d76');
    const list=[...run.mechanisms],coherence=Math.min(1,run.world.index/5),r=17;
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
    if(run){const desiredZoom=!this.reduced&&this.width>700&&this.overview>0?.94:1;this.camera.zoom+=(desiredZoom-this.camera.zoom)*Math.min(1,delta*3);const vw=this.width/this.camera.zoom,vh=this.height/this.camera.zoom,targetX=Math.max(-50,Math.min(run.world.width-vw+50,run.player.x-vw*.5+run.player.vx*.22)),targetY=Math.max(-80,Math.min(run.world.height-vh+35,run.player.y-vh*.64));const ease=this.reduced?1:Math.min(1,delta*4.5);this.camera.x+=(targetX-this.camera.x)*ease;this.camera.y+=(targetY-this.camera.y)*ease;}
    c.setTransform(this.canvas.width/this.width,0,0,this.canvas.height/this.height,0,0);this.background(run,motion);if(!run)return;
    c.save();c.scale(this.camera.zoom,this.camera.zoom);c.translate(-this.camera.x,-this.camera.y);const theme=THEMES[run.world.index%THEMES.length];
    this.dependencies(run,motion);
    for(const p of platforms(run)){if(p.x+p.w<this.camera.x-80||p.x>this.camera.x+this.width/this.camera.zoom+80||p.y<this.camera.y-100||p.y>this.camera.y+this.height/this.camera.zoom+100)continue;this.island(p,theme,run,motion);}
    for(const e of run.encounters){if(Math.abs(e.x-run.player.x)<this.width+500&&Math.abs(e.y-run.player.y)<this.height+300)this.encounter(e,run,motion);}
    for(const pickup of run.world.pickups){const e=run.encounters.find(e=>e.id===pickup.encounterId),acquired=run.inventory.has(pickup.enabler.id);if(Math.abs(pickup.x-run.player.x)>this.width||Math.abs(pickup.y-run.player.y)>this.height)continue;
      if(!e.encountered){this.circle(pickup.x,pickup.y-28,4,'#e8e8ce','#9cb5b0');continue;}
      const bob=this.reduced?0:Math.sin(motion*1.6+pickup.x)*3;
      if(acquired){this.label('✓',pickup.x,pickup.y-26,16,'#669b82');continue;}
      this.node(pickup.x,pickup.y-28+bob,'#b89451',true,motion,12);this.label(powerStyle(pickup.relation.mechanism).symbol,pickup.x,pickup.y-23+bob,14,'#886e3e');
      if(Math.hypot(run.player.x-pickup.x,run.player.y-pickup.y)<150)this.label(pickup.relation.mechanism,pickup.x,pickup.y-56,11,'#6d643f');
    }
    this.portals(run,motion);
    for(const s of run.world.signals){this.node(s.x,s.y,'#7ca092',!run.signals.has(s.key),motion,12);this.label(run.signals.has(s.key)?'✓':s.label,s.x,s.y-27,12,'#547c76');}
    const exit=run.world.exit,opened=new Set([...run.priorOpened,...run.encounters.filter(e=>e.opened).map(e=>e.id)]),ready=run.encounters.length?(run.world.chapterIds||run.encounters.map(e=>e.id)).every(id=>opened.has(id)):run.signals.size===run.world.signals.length;
    c.strokeStyle=ready?'#609f90':'#8eacae';c.lineWidth=2;c.beginPath();c.ellipse(exit.x,exit.y-45,26,44,0,Math.PI,Math.PI*3);c.stroke();this.circle(exit.x,exit.y-45,13,ready?'#faf0c777':'#e9f3ec44');
    this.label(ready?'E · continue the journey':'CENTRAL PORTAL',exit.x,exit.y-108,12,'#466b75');
    if(run.time<18&&!run.encounters.some(e=>e.encountered)){this.label('← explore     jump ↑     explore →',exit.x,exit.y-152,13,'#456d78');}
    const cp=run.checkpoint;this.circle(cp.x+12,cp.y+32,4,'#b9d8c2','#76a494');
    for(const effect of this.effects){effect.age+=delta;if(effect.type==='notice'||effect.type==='collect'){this.label('!',effect.x,effect.y-30-effect.age*14,28,'#946c25');if(effect.type==='notice')continue;}const a=Math.min(1,effect.age/1.4),color=powerStyle(effect.mechanism).color;c.globalAlpha=(1-a)*.5;c.lineWidth=1.4;c.strokeStyle=color;c.beginPath();if(effect.mechanism==='Frame')c.arc(effect.x,effect.y,30+a*260,0,7);else if(effect.mechanism==='Assure')c.ellipse(effect.x,effect.y,35+a*95,35+a*80,0,0,7);else c.arc(effect.x,effect.y,15+a*75,-Math.PI*.3,Math.PI*1.3);if(!this.reduced)c.stroke();c.globalAlpha=1;}this.effects=this.effects.filter(e=>e.age<1.4);
    this.spark(run,motion);c.restore();
    if(mode==='complete'&&run.world.index===5){c.fillStyle='#f0f7ef40';c.fillRect(0,0,this.width,this.height);}
  }
}
