import React,{useEffect,useMemo,useState,useCallback} from "https://esm.sh/react@18.3.1";
import {createRoot} from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";
import {ReactFlow,ReactFlowProvider,Background,Controls,Handle,Position,MarkerType,useReactFlow} from "https://esm.sh/@xyflow/react@12?deps=react@18.3.1,react-dom@18.3.1";

const html=htm.bind(React.createElement);
const MECH_COLORS={Frame:"#6e68d8",Commit:"#c67b2b",Equip:"#2478b5",Assure:"#a05486",Operate:"#27865e",Learn:"#73883c"};
const truncate=(s,n=120)=>{s=String(s||"");return s.length>n?s.slice(0,n).trimEnd()+"…":s};
const byId=(rows,id)=>rows.find(x=>x.id===Number(id));
const uniq=arr=>[...new Set(arr)];

function StageNode({data}){
  const {gate,count,selected}=data;
  return html`<div className=${"stage-node"+(selected?" selected":"")}>
    <${Handle} type="target" position=${Position.Left} style=${{opacity:0}} />
    <div className="stage-top"><span className="stage-number">${gate.id}</span><span className="stage-count">${count} blocker${count===1?"":"s"}</span></div>
    <strong>${gate.label}</strong><p>${data.zoom>0.62?"Click to reveal the blockers at this stage.":""}</p>
    <${Handle} type="source" position=${Position.Right} style=${{opacity:0}} />
  </div>`;
}
function BlockerNode({data}){
  const {blocker,selected,domainTitle,zoom,relationLabel}=data;
  const showStatement=selected||zoom>0.92;
  return html`<div className=${"blocker-node"+(selected?" selected":"")}>
    <${Handle} type="target" position=${Position.Left} style=${{opacity:0}} />
    <div className="node-kicker"><span>Gate ${blocker.stageGate} · ${domainTitle}</span><span>${relationLabel||""}</span></div>
    <strong>${blocker.title}</strong>
    ${showStatement?html`<p>${truncate(blocker.statement,selected?185:100)}</p>`:null}
    ${selected?html`<button className="deep-dive-plus" title="Open blocker details and enablers" aria-label="Open blocker details and enablers" onClick=${(e)=>{e.preventDefault();e.stopPropagation();data.onDeepDive?.(blocker)}}><span>+</span><em>Details & enablers</em></button>`:null}
    <${Handle} type="source" position=${Position.Right} style=${{opacity:0}} />
  </div>`;
}
function MechanismNode({data}){
  const color=MECH_COLORS[data.mechanism]||"#397db0";
  return html`<div className=${"mechanism-node"+(data.selected?" selected":"")} style=${{"--mech":color}}>
    <${Handle} type="target" position=${Position.Top} style=${{opacity:0}} />
    <div className="mech-top"><strong>${data.mechanism}</strong><span>${data.count}</span></div><p>${data.description}</p>
    <${Handle} type="source" position=${Position.Bottom} style=${{opacity:0}} />
  </div>`;
}
function EnablerNode({data}){
  return html`<div className=${"enabler-node"+(data.selected?" selected":"")}>
    <${Handle} type="target" position=${Position.Top} style=${{opacity:0}} />
    <div className="mini-label">${data.mechanism} enabler</div><strong>${data.enabler.title}</strong><p>${truncate(data.enabler.description,110)}</p>
  </div>`;
}
const nodeTypes={stage:StageNode,blocker:BlockerNode,mechanism:MechanismNode,enabler:EnablerNode};

function AppCanvas({data}){
  const flow=useReactFlow();
  const [zoom,setZoom]=useState(.72);
  const [selectedGate,setSelectedGate]=useState(null);
  const [selectedBlocker,setSelectedBlocker]=useState(null);
  const [detailOpen,setDetailOpen]=useState(false);
  const [selectedMechanism,setSelectedMechanism]=useState(null);
  const [selectedEnabler,setSelectedEnabler]=useState(null);
  const stageX=id=>(id-1)*430;
  const domains=useMemo(()=>Object.fromEntries(data.domains.map(d=>[d.slug,d.title])),[data]);

  const dependencyContext=useCallback(id=>{
    const upstreamIds=uniq(data.blockerDependencies.filter(d=>d.blockerId===id).map(d=>d.dependsOnBlockerId));
    const downstreamIds=uniq(data.blockerDependencies.filter(d=>d.dependsOnBlockerId===id).map(d=>d.blockerId));
    return{upstream:upstreamIds.map(x=>byId(data.blockers,x)).filter(Boolean),downstream:downstreamIds.map(x=>byId(data.blockers,x)).filter(Boolean)};
  },[data]);

  const mechanismGroups=useCallback(id=>{
    const out={};
    data.relationships.filter(r=>r.blockerId===id).forEach(r=>{const e=byId(data.enablers,r.enablerId);if(!e)return;(out[r.mechanism]||=[]).push({enabler:e,relationship:r})});
    return out;
  },[data]);

  const openDeepDive=useCallback((blocker)=>{
    if(!blocker)return;
    setSelectedBlocker(blocker.id);
    setSelectedGate(blocker.stageGate);
    setDetailOpen(true);
    setSelectedMechanism(null);
    setSelectedEnabler(null);
  },[]);

  const graph=useMemo(()=>{
    const nodes=[],edges=[];
    const edgeBase={type:"smoothstep",style:{stroke:"#aec7d7",strokeWidth:1.2},markerEnd:{type:MarkerType.ArrowClosed,width:14,height:14,color:"#aec7d7"}};
    data.stageGates.forEach(g=>{
      nodes.push({id:`stage-${g.id}`,type:"stage",position:{x:stageX(g.id),y:0},data:{gate:g,count:data.blockers.filter(b=>b.stageGate===g.id).length,selected:selectedGate===g.id,zoom},zIndex:selectedGate===g.id?5:1});
      if(g.id<data.stageGates.length)edges.push({id:`stage-edge-${g.id}`,source:`stage-${g.id}`,target:`stage-${g.id+1}`,...edgeBase,style:{stroke:"#c9dce8",strokeWidth:2}});
    });

    if(selectedGate&&!selectedBlocker){
      const blockers=data.blockers.filter(b=>b.stageGate===selectedGate),baseX=stageX(selectedGate)-380,cols=3;
      blockers.forEach((b,i)=>{const row=Math.floor(i/cols),col=i%cols,x=baseX+col*310,y=310+row*175;
        nodes.push({id:`blocker-${b.id}`,type:"blocker",position:{x,y},data:{blocker:b,selected:false,domainTitle:domains[b.domain]||"",zoom}});
        edges.push({id:`gate-blocker-${b.id}`,source:`stage-${selectedGate}`,target:`blocker-${b.id}`,...edgeBase,style:{stroke:"#d8e6ee",strokeWidth:1}});
      });
    }

    if(selectedBlocker){
      const b=byId(data.blockers,selectedBlocker),deps=dependencyContext(b.id);
      nodes.push({id:`blocker-${b.id}`,type:"blocker",position:{x:880,y:460},data:{blocker:b,selected:true,domainTitle:domains[b.domain]||"",zoom,onDeepDive:openDeepDive},zIndex:8});
      const placeSide=(items,side)=>{const x=side==="up"?260:1510,label=side==="up"?"Depends on":"Depends on this";
        items.forEach((xBlock,i)=>{const y=280+i*155;
          nodes.push({id:`blocker-${xBlock.id}`,type:"blocker",position:{x,y},data:{blocker:xBlock,selected:false,domainTitle:domains[xBlock.domain]||"",zoom,relationLabel:label}});
          const edge=side==="up"?{source:`blocker-${xBlock.id}`,target:`blocker-${b.id}`}:{source:`blocker-${b.id}`,target:`blocker-${xBlock.id}`};
          edges.push({id:`dep-${side}-${xBlock.id}`,...edge,...edgeBase,animated:true,style:{stroke:side==="up"?"#6e97b3":"#3b86b7",strokeWidth:1.5}});
        });
      };
      placeSide(deps.upstream,"up");placeSide(deps.downstream,"down");

      if(detailOpen){
        const groups=mechanismGroups(b.id),mechanisms=data.mechanisms.filter(m=>groups[m.key]?.length),startX=880-((mechanisms.length-1)*215)/2;
        mechanisms.forEach((m,i)=>{
          nodes.push({id:`mechanism-${m.key}`,type:"mechanism",position:{x:startX+i*215,y:900},data:{mechanism:m.key,description:m.description,count:groups[m.key].length,selected:selectedMechanism===m.key}});
          edges.push({id:`blocker-mech-${m.key}`,source:`blocker-${b.id}`,target:`mechanism-${m.key}`,...edgeBase,style:{stroke:MECH_COLORS[m.key]||"#7a9bb1",strokeWidth:1.3}});
        });
        if(selectedMechanism&&groups[selectedMechanism]){
          const items=groups[selectedMechanism],cols=Math.min(4,Math.max(1,items.length)),center=880,width=(cols-1)*285,base=center-width/2;
          items.forEach((item,i)=>{const row=Math.floor(i/cols),col=i%cols;
            nodes.push({id:`enabler-${item.enabler.id}`,type:"enabler",position:{x:base+col*285,y:1190+row*155},data:{enabler:item.enabler,mechanism:selectedMechanism,selected:selectedEnabler===item.enabler.id}});
            edges.push({id:`mech-enabler-${item.enabler.id}`,source:`mechanism-${selectedMechanism}`,target:`enabler-${item.enabler.id}`,...edgeBase,style:{stroke:MECH_COLORS[selectedMechanism]||"#7a9bb1",strokeWidth:1.1}});
          });
        }
      }
    }
    return{nodes,edges};
  },[data,selectedGate,selectedBlocker,detailOpen,selectedMechanism,selectedEnabler,zoom,domains,dependencyContext,mechanismGroups,openDeepDive]);

  useEffect(()=>{
    const t=setTimeout(()=>{
      const all=flow.getNodes();
      let focus=[];
      if(selectedBlocker){
        // Once a blocker is selected, keep the lifecycle timeline out of the fit calculation.
        // This lets the dependency graph use the viewport instead of shrinking to show all six gates.
        focus=all.filter(n=>n.type!=="stage");
      }else if(selectedGate){
        // Focus the selected gate plus its blockers; other lifecycle gates remain available by panning.
        focus=all.filter(n=>n.type!=="stage" || n.id===`stage-${selectedGate}`);
      }else{
        focus=all.filter(n=>n.type==="stage");
      }
      flow.fitView({
        nodes:focus.length?focus:all,
        padding:selectedBlocker?.08:selectedGate?.06:.10,
        duration:700,
        maxZoom:selectedBlocker?1.14:selectedGate?1.02:.92
      });
    },100);
    return()=>clearTimeout(t);
  },[selectedGate,selectedBlocker,detailOpen,selectedMechanism,selectedEnabler]);

  const reset=()=>{setSelectedGate(null);setSelectedBlocker(null);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null);setTimeout(()=>{const stages=flow.getNodes().filter(n=>n.type==="stage");flow.fitView({nodes:stages,padding:.10,duration:700,maxZoom:.92})},70)};
  const back=()=>{if(selectedEnabler){setSelectedEnabler(null);return}if(selectedMechanism){setSelectedMechanism(null);return}if(detailOpen){setDetailOpen(false);return}if(selectedBlocker){setSelectedBlocker(null);return}if(selectedGate){setSelectedGate(null)}};

  const onNodeClick=(evt,node)=>{
    if(node.type==="stage"){
      setSelectedGate(node.data.gate.id);
      setSelectedBlocker(null);
      setDetailOpen(false);
      setSelectedMechanism(null);
      setSelectedEnabler(null);
      return;
    }
    if(node.type==="blocker"){
      if(node.data.selected) return;
      setSelectedBlocker(node.data.blocker.id);
      setSelectedGate(node.data.blocker.stageGate);
      setDetailOpen(false);
      setSelectedMechanism(null);
      setSelectedEnabler(null);
      return;
    }
    if(node.type==="mechanism"){
      setSelectedMechanism(node.data.mechanism);
      setSelectedEnabler(null);
      return;
    }
    if(node.type==="enabler") setSelectedEnabler(node.data.enabler.id);
  };

  const selectedBlockerObj=selectedBlocker?byId(data.blockers,selectedBlocker):null;
  const groups=selectedBlockerObj?mechanismGroups(selectedBlockerObj.id):{};
  const selectedEnablerPair=selectedBlockerObj&&selectedEnabler?Object.values(groups).flat().find(x=>x.enabler.id===selectedEnabler):null;

  const crumbs=[];
  if(selectedGate)crumbs.push({label:`Gate ${selectedGate}`,action:()=>{setSelectedBlocker(null);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}});
  if(selectedBlockerObj)crumbs.push({label:truncate(selectedBlockerObj.title,38),action:()=>{setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}});
  if(detailOpen)crumbs.push({label:"Detail",action:()=>{setSelectedMechanism(null);setSelectedEnabler(null)}});
  if(selectedMechanism)crumbs.push({label:selectedMechanism,action:()=>setSelectedEnabler(null)});
  if(selectedEnablerPair)crumbs.push({label:truncate(selectedEnablerPair.enabler.title,28),action:null});

  return html`<div className="shell">
    <header className="topbar">
      <div className="brand"><span className="brand-mark"></span><span>AI Scalability Explorer</span></div>
      <div className="top-title">Spatial Timeline · React prototype</div>
      <div className="top-actions">
        ${selectedGate?html`<button className="ghost-top" onClick=${back}>← Back one level</button>`:null}
        <button className="ghost-top" onClick=${reset}>Reset</button><a className="top-link" href="../">Current Explorer ↗</a>
      </div>
    </header>
    <main className="workspace">
      <div className=${"intro"+(selectedGate?" compact":"")}><div className="eyebrow">Semantic zoom</div><h1>${selectedGate?"Keep exploring.":"Start with the lifecycle."}</h1><p>${selectedGate?"Pan and zoom freely. Click a blocker to focus it, then use the + button on the central blocker to open details and enablers.":"Choose a Stage Gate. Complexity only appears when you ask for it."}</p></div>
      <div className="depth"><span>Overview</span><i></i><span>Deep dive</span></div>
      <div className="flow-wrap">
        <${ReactFlow} nodes=${graph.nodes} edges=${graph.edges} nodeTypes=${nodeTypes} minZoom=${0.25} maxZoom=${2.2} fitView fitViewOptions=${{padding:.10,maxZoom:.92}} onNodeClick=${onNodeClick} zoomOnDoubleClick=${false} onMove=${(_,viewport)=>setZoom(viewport.zoom)} nodesDraggable=${false} nodesConnectable=${false} elementsSelectable panOnScroll zoomOnScroll zoomOnPinch selectionOnDrag=${false}>
          <${Background} gap=${32} size=${1} color="#d9e5ec" />
          <${Controls} showInteractive=${false} position="bottom-left" />
        </${ReactFlow}>
      </div>
      ${!selectedGate?html`<div className="hint"><strong>Click a Stage Gate</strong><span>Then keep zooming into what interests you.</span></div>`:null}
      <div className="breadcrumbs"><button onClick=${reset}>Timeline</button>${crumbs.map((c,i)=>html`<${React.Fragment} key=${i}><i>›</i>${c.action?html`<button onClick=${c.action}>${c.label}</button>`:html`<span>${c.label}</span>`}</${React.Fragment}>`)}</div>
      <div className="zoom-readout">Zoom ${Math.round(zoom*100)}%</div>

      ${detailOpen&&selectedBlockerObj?html`<aside className="inspector">
        <div className="inspector-head"><div><div className="eyebrow">Gate ${selectedBlockerObj.stageGate} · blocker detail</div><h2>${selectedBlockerObj.title}</h2></div><button className="close-inspector" onClick=${()=>{setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}}>×</button></div>
        <div className="inspector-body">
          ${selectedEnablerPair?html`<div className="enabler-detail"><span className="tag">${selectedMechanism} enabler</span><h3>${selectedEnablerPair.enabler.title}</h3><p>${selectedEnablerPair.enabler.description}</p><div className="inspector-section"><h3>Practical actions</h3><p>${selectedEnablerPair.enabler.practicalActions}</p></div><div className="inspector-section"><h3>Expected outcome</h3><p>${selectedEnablerPair.enabler.expectedOutcome||"—"}</p></div><div className="inspector-section"><h3>Stakeholders</h3><p>${selectedEnablerPair.enabler.stakeholders.join(" · ")}</p></div><div className="rationale">${selectedEnablerPair.relationship.rationale||""}</div></div>`
          :html`<div className="blocker-inspector-content"><p className="inspector-statement">${selectedBlockerObj.statement}</p>
            <div className="info-grid"><div className="info-box"><small>Stage Gate</small><span>${selectedBlockerObj.stageGateDescription}</span></div><div className="info-box"><small>Dimension</small><span>${selectedBlockerObj.dimension}</span></div><div className="info-box"><small>Domain</small><span>${domains[selectedBlockerObj.domain]||"—"}</span></div><div className="info-box"><small>Cluster</small><span>${selectedBlockerObj.cluster.replace(/^\d+[.)]?\s*/,"")}</span></div></div>
            <div className="inspector-section"><h3>Why it matters</h3><p>${selectedBlockerObj.whyItMatters}</p></div><div className="inspector-section"><h3>Consequence</h3><p>${selectedBlockerObj.consequence}</p></div><div className="inspector-section"><h3>Stakeholders</h3><p>${selectedBlockerObj.stakeholders.join(" · ")}</p></div>
            <div className="inspector-section"><h3>Enabling mechanisms</h3><p>Choose one to reveal its enablers directly on the canvas.</p><div className="mechanism-chips">${data.mechanisms.filter(m=>groups[m.key]?.length).map(m=>html`<button className=${"mech-chip"+(selectedMechanism===m.key?" active":"")} style=${{"--mech":MECH_COLORS[m.key]||"#397db0"}} onClick=${()=>{setSelectedMechanism(m.key);setSelectedEnabler(null)}}>${m.key} · ${groups[m.key].length}</button>`)}</div></div>
            ${!selectedMechanism?html`<button className="deep-button" onClick=${()=>{const first=data.mechanisms.find(m=>groups[m.key]?.length);if(first)setSelectedMechanism(first.key)}}>Go one layer deeper → mechanisms & enablers</button>`:null}
          </div>`}
        </div>
      </aside>`:null}
    </main>
  </div>`;
}

function Root(){
  const[data,setData]=useState(null),[error,setError]=useState(null);
  useEffect(()=>{fetch("../data/explorer-data.json").then(r=>{if(!r.ok)throw new Error("Could not load explorer-data.json");return r.json()}).then(setData).catch(e=>setError(e.message))},[]);
  if(error)return html`<div style=${{padding:"40px",fontFamily:"system-ui"}}><h2>Could not load data</h2><p>${error}</p></div>`;
  if(!data)return html`<div style=${{display:"grid",placeItems:"center",height:"100%",fontFamily:"system-ui",color:"#587185"}}>Loading spatial timeline…</div>`;
  return html`<${ReactFlowProvider}><${AppCanvas} data=${data}/></${ReactFlowProvider}>`;
}
createRoot(document.getElementById("root")).render(html`<${Root}/>`);
