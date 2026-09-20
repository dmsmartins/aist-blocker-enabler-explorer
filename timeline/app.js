import React,{useEffect,useMemo,useState,useCallback,useRef} from "https://esm.sh/react@18.3.1";
import {createRoot} from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";
import {ReactFlow,ReactFlowProvider,Background,Controls,Handle,Position,MarkerType,useReactFlow,useNodesInitialized} from "https://esm.sh/@xyflow/react@12?deps=react@18.3.1,react-dom@18.3.1";

const html=htm.bind(React.createElement);
const MECH_COLORS={Frame:"#6e68d8",Commit:"#c67b2b",Equip:"#2478b5",Assure:"#a05486",Operate:"#27865e",Learn:"#73883c"};
const truncate=(s,n=120)=>{s=String(s||"");return s.length>n?s.slice(0,n).trimEnd()+"…":s};
const byId=(rows,id)=>rows.find(x=>x.id===Number(id));
const uniq=arr=>[...new Set(arr)];
const ASSESSMENT_KEY="aistCompanyAssessmentV1";
function readCompanyAssessment(){
  try{
    const requested=new URLSearchParams(window.location.search).get("assessment")==="company";
    if(!requested)return null;
    const raw=JSON.parse(localStorage.getItem(ASSESSMENT_KEY)||"null");
    return raw&&raw.blockerStatuses?raw:null;
  }catch{return null}
}

function StageNode({data}){
  const {gate,count,selected,assessmentState,remaining}=data;
  const cls="stage-node"+(selected?" selected":"")+(count===0?" empty":"")+(assessmentState?` assessment-${assessmentState}`:"");
  const countLabel=assessmentState==="done"?"✓ Done":assessmentState==="empty"?"No blockers mapped":assessmentState?`${remaining} remaining`:`${count} blocker${count===1?"":"s"}`;
  return html`<div className=${cls+(data.dimmed?" dimmed":"")} role="button" tabIndex="0" aria-pressed=${selected?"true":"false"} onKeyDown=${e=>{if((e.key==="Enter"||e.key===" ")&&data.keyboardActivate){e.preventDefault();data.keyboardActivate()}}}>
    <${Handle} type="target" position=${Position.Left} style=${{opacity:0}} />
    <div className="stage-top"><span className="stage-number">${assessmentState==="done"?"✓":gate.id}</span><span className="stage-count">${countLabel}</span></div>
    <strong>${gate.label}</strong><p>${data.zoom>0.62?(assessmentState==="done"?"All mapped blockers were marked resolved.":assessmentState==="empty"?"No blockers are currently mapped to this gate.":"Click to reveal the blockers at this stage."):""}</p>
    <${Handle} type="source" position=${Position.Right} style=${{opacity:0}} />
  </div>`;
}
function BlockerNode({data}){
  const {blocker,selected,domainTitle,zoom,relationLabel,status}=data;
  const showStatement=selected||zoom>0.92;
  const statusCls=status?` status-${status}`:"";
  return html`<div className=${"blocker-node"+(selected?" selected":"")+statusCls+(data.dimmed?" dimmed":"")} role=${selected?"group":"button"} tabIndex=${selected?-1:0} data-blocker-node=${blocker.id} aria-pressed=${selected?undefined:"false"} onKeyDown=${e=>{if(!selected&&(e.key==="Enter"||e.key===" ")&&data.keyboardActivate){e.preventDefault();data.keyboardActivate()}}}>
    <${Handle} type="target" position=${Position.Left} style=${{opacity:0}} />
    <div className="node-kicker"><span>Gate ${blocker.stageGate} · ${domainTitle}</span><span>${relationLabel||""}</span></div>
    ${status?html`<div className="assessment-status">${status==="resolved"?"✓ Resolved":status==="partial"?"◐ Partial":"● Open"}</div>`:null}
    <strong>${blocker.title}</strong>
    ${showStatement?html`<p>${truncate(blocker.statement,selected?185:100)}</p>`:null}
    ${selected?html`<button className="deep-dive-plus" title="Open blocker details and enablers" aria-label="Open blocker details and enablers" onClick=${(e)=>{e.preventDefault();e.stopPropagation();data.onDeepDive?.(blocker)}}><span>+</span><em>Details & enablers</em></button>`:null}
    <${Handle} type="source" position=${Position.Right} style=${{opacity:0}} />
  </div>`;
}
function MechanismNode({data}){
  const color=MECH_COLORS[data.mechanism]||"#397db0";
  return html`<div className=${"mechanism-node"+(data.selected?" selected":"")} style=${{"--mech":color}} role="button" tabIndex="0" aria-pressed=${data.selected?"true":"false"} onKeyDown=${e=>{if((e.key==="Enter"||e.key===" ")&&data.keyboardActivate){e.preventDefault();data.keyboardActivate()}}}>
    <${Handle} type="target" position=${Position.Top} style=${{opacity:0}} />
    <div className="mech-top"><strong>${data.mechanism}</strong><span>${data.count}</span></div><p>${data.description}</p>
    <${Handle} type="source" position=${Position.Bottom} style=${{opacity:0}} />
  </div>`;
}
function EnablerNode({data}){
  return html`<div className=${"enabler-node"+(data.selected?" selected":"")} role="button" tabIndex="0" aria-pressed=${data.selected?"true":"false"} onKeyDown=${e=>{if((e.key==="Enter"||e.key===" ")&&data.keyboardActivate){e.preventDefault();data.keyboardActivate()}}}>
    <${Handle} type="target" position=${Position.Top} style=${{opacity:0}} />
    <div className="mini-label">${data.mechanism} enabler</div><strong>${data.enabler.title}</strong><p>${truncate(data.enabler.description,110)}</p>
  </div>`;
}
const nodeTypes={stage:StageNode,blocker:BlockerNode,mechanism:MechanismNode,enabler:EnablerNode};

function AppCanvas({data}){
  const flow=useReactFlow();
  const nodesInitialized=useNodesInitialized();
  const lastFocusedBlocker=useRef(null);
  const [savedCount,setSavedCount]=useState(()=>{try{const x=JSON.parse(localStorage.getItem("aistExplorerBookmarks")||"{\"blockers\":[],\"enablers\":[]}");return (x.blockers?.length||0)+(x.enablers?.length||0)}catch{return 0}});
  const [zoom,setZoom]=useState(.72);
  const [graphReady,setGraphReady]=useState(false);
  const readyTimer=useRef(null);
  const [selectedGate,setSelectedGate]=useState(null);
  const [selectedBlocker,setSelectedBlocker]=useState(null);
  const [detailOpen,setDetailOpen]=useState(false);
  const [selectedMechanism,setSelectedMechanism]=useState(null);
  const [selectedEnabler,setSelectedEnabler]=useState(null);
  const [showCompleted,setShowCompleted]=useState(false);
  const assessment=useMemo(()=>readCompanyAssessment(),[]);
  const assessmentMode=!!assessment;
  useEffect(()=>{
    readyTimer.current=setTimeout(()=>setGraphReady(true),700);
    return()=>{if(readyTimer.current)clearTimeout(readyTimer.current)};
  },[]);
  useEffect(()=>{const sync=()=>{try{const x=JSON.parse(localStorage.getItem("aistExplorerBookmarks")||"{\"blockers\":[],\"enablers\":[]}");setSavedCount((x.blockers?.length||0)+(x.enablers?.length||0))}catch{setSavedCount(0)}};window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync)},[]);
  const compactViewport=window.innerWidth<700;
  const stageX=id=>(id-1)*(compactViewport?240:270);
  const domains=useMemo(()=>Object.fromEntries(data.domains.map(d=>[d.slug,d.title])),[data]);
const blockerStatus=useCallback(id=>assessment?.blockerStatuses?.[id]||"open",[assessment]);
  const gateAssessment=useCallback(gateId=>{
    const bs=data.blockers.filter(b=>b.stageGate===gateId);
    if(!bs.length)return{state:"empty",remaining:0};
    const remaining=bs.filter(b=>blockerStatus(b.id)!=="resolved").length;
    return{state:remaining===0?"done":"active",remaining};
  },[data,blockerStatus]);

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
    lastFocusedBlocker.current=blocker.id;
    setSelectedBlocker(blocker.id);
    setSelectedGate(blocker.stageGate);
    setDetailOpen(true);
    setSelectedMechanism(null);
    setSelectedEnabler(null);
  },[]);
  const closeDetail=useCallback(()=>{
    setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null);
    const id=lastFocusedBlocker.current||selectedBlocker;
    requestAnimationFrame(()=>document.querySelector(`[data-blocker-node="${id}"]`)?.focus());
  },[selectedBlocker]);
  useEffect(()=>{if(!detailOpen)return;const onKey=e=>{if(e.key==="Escape"){e.preventDefault();closeDetail()}};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey)},[detailOpen,closeDetail]);

  const graph=useMemo(()=>{
    const nodes=[],edges=[];
    const edgeBase={type:"smoothstep",style:{stroke:"#aec7d7",strokeWidth:1.2},markerEnd:{type:MarkerType.ArrowClosed,width:14,height:14,color:"#aec7d7"}};
    data.stageGates.forEach(g=>{
      const ga=assessmentMode?gateAssessment(g.id):null;
      nodes.push({id:`stage-${g.id}`,type:"stage",position:{x:stageX(g.id),y:0},data:{gate:g,count:data.blockers.filter(b=>b.stageGate===g.id).length,selected:selectedGate===g.id,zoom,assessmentState:ga?.state,remaining:ga?.remaining,dimmed:!!selectedBlocker&&selectedGate!==g.id,keyboardActivate:()=>{setSelectedGate(g.id);setSelectedBlocker(null);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}},zIndex:selectedGate===g.id?5:1});
      if(g.id<data.stageGates.length)edges.push({id:`stage-edge-${g.id}`,source:`stage-${g.id}`,target:`stage-${g.id+1}`,...edgeBase,style:{stroke:"#c9dce8",strokeWidth:2}});
    });

    if(selectedGate&&!selectedBlocker){
      const blockers=data.blockers.filter(b=>b.stageGate===selectedGate && (!assessmentMode || showCompleted || blockerStatus(b.id)!=="resolved")),baseX=stageX(selectedGate)-(compactViewport?220:280),cols=3;
      blockers.forEach((b,i)=>{const row=Math.floor(i/cols),col=i%cols,x=baseX+col*(compactViewport?270:300),y=205+row*160;
        nodes.push({id:`blocker-${b.id}`,type:"blocker",position:{x,y},data:{blocker:b,selected:false,domainTitle:domains[b.domain]||"",zoom,status:assessmentMode?blockerStatus(b.id):null,keyboardActivate:()=>{setSelectedBlocker(b.id);setSelectedGate(b.stageGate);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}}});
        edges.push({id:`gate-blocker-${b.id}`,source:`stage-${selectedGate}`,target:`blocker-${b.id}`,...edgeBase,style:{stroke:"#d8e6ee",strokeWidth:1}});
      });
    }

    if(selectedBlocker){
      const b=byId(data.blockers,selectedBlocker),deps=dependencyContext(b.id);
      nodes.push({id:`blocker-${b.id}`,type:"blocker",position:{x:760,y:350},data:{blocker:b,selected:true,domainTitle:domains[b.domain]||"",zoom,onDeepDive:openDeepDive,status:assessmentMode?blockerStatus(b.id):null,keyboardActivate:()=>openDeepDive(b)},zIndex:8});
      const placeSide=(items,side)=>{const x=side==="up"?380:1140,label=side==="up"?"Depends on":"Depends on this";
        items.filter(xBlock=>!assessmentMode || showCompleted || blockerStatus(xBlock.id)!=="resolved").forEach((xBlock,i)=>{const y=210+i*145;
          nodes.push({id:`blocker-${xBlock.id}`,type:"blocker",position:{x,y},data:{blocker:xBlock,selected:false,domainTitle:domains[xBlock.domain]||"",zoom,relationLabel:label,status:assessmentMode?blockerStatus(xBlock.id):null,keyboardActivate:()=>{setSelectedBlocker(xBlock.id);setSelectedGate(xBlock.stageGate);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}}});
          const edge=side==="up"?{source:`blocker-${xBlock.id}`,target:`blocker-${b.id}`}:{source:`blocker-${b.id}`,target:`blocker-${xBlock.id}`};
          edges.push({id:`dep-${side}-${xBlock.id}`,...edge,...edgeBase,animated:true,style:{stroke:side==="up"?"#6e97b3":"#3b86b7",strokeWidth:1.5}});
        });
      };
      placeSide(deps.upstream,"up");placeSide(deps.downstream,"down");

      if(detailOpen){
        const groups=mechanismGroups(b.id),mechanisms=data.mechanisms.filter(m=>groups[m.key]?.length),startX=760-((mechanisms.length-1)*205)/2;
        mechanisms.forEach((m,i)=>{
          nodes.push({id:`mechanism-${m.key}`,type:"mechanism",position:{x:startX+i*205,y:760},data:{mechanism:m.key,description:m.description,count:groups[m.key].length,selected:selectedMechanism===m.key,keyboardActivate:()=>{setSelectedMechanism(m.key);setSelectedEnabler(null)}}});
          edges.push({id:`blocker-mech-${m.key}`,source:`blocker-${b.id}`,target:`mechanism-${m.key}`,...edgeBase,style:{stroke:MECH_COLORS[m.key]||"#7a9bb1",strokeWidth:1.3}});
        });
        if(selectedMechanism&&groups[selectedMechanism]){
          const items=groups[selectedMechanism],cols=Math.min(4,Math.max(1,items.length)),center=760,width=(cols-1)*270,base=center-width/2;
          items.forEach((item,i)=>{const row=Math.floor(i/cols),col=i%cols;
            nodes.push({id:`enabler-${item.enabler.id}`,type:"enabler",position:{x:base+col*270,y:1010+row*150},data:{enabler:item.enabler,mechanism:selectedMechanism,selected:selectedEnabler===item.enabler.id,keyboardActivate:()=>setSelectedEnabler(item.enabler.id)}});
            edges.push({id:`mech-enabler-${item.enabler.id}`,source:`mechanism-${selectedMechanism}`,target:`enabler-${item.enabler.id}`,...edgeBase,style:{stroke:MECH_COLORS[selectedMechanism]||"#7a9bb1",strokeWidth:1.1}});
          });
        }
      }
    }
    return{nodes,edges};
  },[data,selectedGate,selectedBlocker,detailOpen,selectedMechanism,selectedEnabler,zoom,domains,dependencyContext,mechanismGroups,openDeepDive,assessmentMode,showCompleted,blockerStatus,gateAssessment]);

  useEffect(()=>{
    if(flow.getNodes().length) setGraphReady(true);
    if(!nodesInitialized)return;
    let raf2=0;
    const raf1=requestAnimationFrame(()=>{raf2=requestAnimationFrame(()=>{
      const all=flow.getNodes();
      let focus=[];
      const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const mobile=window.innerWidth<700;
      if(selectedBlocker){
        focus=all.filter(n=>n.type==="blocker");
      }else if(selectedGate){
        const gate=all.find(n=>n.id===`stage-${selectedGate}`);
        const blockers=all.filter(n=>n.type==="blocker");
        focus=[gate,...blockers.slice(0,mobile?3:6)].filter(Boolean);
      }else{
        const stages=all.filter(n=>n.type==="stage");
        focus=mobile?stages.slice(0,3):stages;
      }
      flow.fitView({
        nodes:focus.length?focus:all,
        padding:selectedBlocker?.12:selectedGate?.10:.10,
        duration:reduced?0:360,
        minZoom:selectedBlocker?.52:selectedGate?(mobile?.58:.52):(mobile?.58:.48),
        maxZoom:selectedBlocker?1.05:selectedGate?.92:.90
      });
      setGraphReady(true);
    })});
    return()=>{cancelAnimationFrame(raf1);if(raf2)cancelAnimationFrame(raf2)};
  },[nodesInitialized,selectedGate,selectedBlocker,detailOpen,showCompleted]);

  const reset=()=>{setSelectedGate(null);setSelectedBlocker(null);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)};
  const back=()=>{if(selectedEnabler){setSelectedEnabler(null);return}if(selectedMechanism){setSelectedMechanism(null);return}if(detailOpen){closeDetail();return}if(selectedBlocker){setSelectedBlocker(null);return}if(selectedGate){setSelectedGate(null)}};

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

  useEffect(()=>{if(selectedBlocker&&!detailOpen)requestAnimationFrame(()=>document.querySelector(`[data-blocker-node="${selectedBlocker}"]`)?.focus())},[selectedBlocker,detailOpen]);

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
      <a className="brand" href="../#home"><span className="brand-mark"></span><span>AI Scalability Explorer</span></a>
      <div className="top-title">${assessmentMode?"My AI Scalability Timeline":"Spatial Timeline"}</div>
      <div className="top-actions">
        <a className="icon-top" href="../?search=1#explore" aria-label="Search" title="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg></a>
        <a className="icon-top" href="../#selection" aria-label="My selection" title="My selection"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10v15l-5-3.1-5 3.1z"></path></svg>${savedCount?html`<span className="saved-count">${savedCount}</span>`:null}</a>
        ${selectedGate?html`<button className="ghost-top" onClick=${back}>← Back one level</button>`:null}
        ${assessmentMode?html`<button className=${"ghost-top"+(showCompleted?" active-toggle":"")} onClick=${()=>setShowCompleted(v=>!v)}>${showCompleted?"Hide completed":"Show completed"}</button>`:null}
        <button className="ghost-top" onClick=${reset}>Reset</button><a className="top-link" href="../#explore">Explorer ↗</a>
      </div>
    </header>
    <main className=${"workspace"+(detailOpen?" detail-open":"")}>
      <div className=${"intro"+(selectedGate?" compact":"")}><div className="eyebrow">${assessmentMode?"Assessment result · illustrative":"Semantic zoom"}</div><h1>${assessmentMode?(selectedGate?"Focus on what remains.":"Your AI scalability path."):(selectedGate?"Keep exploring.":"Start with the lifecycle.")}</h1><p>${assessmentMode?(selectedGate?"Resolved blockers are hidden by default. Open a remaining blocker to explore dependencies and enablers.":"Done gates have all currently mapped blockers resolved. Other gates show what remains."):(selectedGate?"Pan and zoom freely. Click a blocker to focus it, then use the + button on the central blocker to open details and enablers.":"Choose a Stage Gate. Complexity only appears when you ask for it.")}</p></div>
      <div className="depth"><span>Overview</span><i></i><span>Deep dive</span></div>
      <div className="flow-wrap">
        <${ReactFlow} nodes=${graph.nodes} edges=${graph.edges} nodeTypes=${nodeTypes} minZoom=${0.35} maxZoom=${1.7} fitView fitViewOptions=${{padding:.08,maxZoom:.96}} onInit=${()=>setGraphReady(true)} onNodeClick=${onNodeClick} zoomOnDoubleClick=${false} onMove=${(_,viewport)=>setZoom(viewport.zoom)} nodesDraggable=${false} nodesConnectable=${false} elementsSelectable panOnScroll zoomOnScroll zoomOnPinch selectionOnDrag=${false}>
          <${Background} gap=${32} size=${1} color="#d9e5ec" />
          <${Controls} showInteractive=${false} position="bottom-left" />
        </${ReactFlow}>
      </div>
      ${!graphReady?html`<div className="canvas-loading" aria-hidden="true"><span className="loading-spinner"></span></div>`:null}
      ${!selectedGate?html`<div className="hint"><strong>${assessmentMode?"Your personalised timeline":"Click a Stage Gate"}</strong><span>${assessmentMode?"Open a gate to explore remaining blockers.":"Then keep zooming into what interests you."}</span></div>`:null}
      <div className="breadcrumbs"><button onClick=${reset}>Timeline</button>${crumbs.map((c,i)=>html`<${React.Fragment} key=${i}><i>›</i>${c.action?html`<button onClick=${c.action}>${c.label}</button>`:html`<span>${c.label}</span>`}</${React.Fragment}>`)}</div>
      <div className="zoom-readout">Zoom ${Math.round(zoom*100)}%</div>

      ${detailOpen&&selectedBlockerObj?html`<aside className="inspector" aria-labelledby="timeline-inspector-title">
        <div className="inspector-head"><div><div className="eyebrow">Gate ${selectedBlockerObj.stageGate} · blocker detail</div><h2 id="timeline-inspector-title">${selectedBlockerObj.title}</h2></div><button className="close-inspector" onClick=${closeDetail} aria-label="Close" title="Close">×</button></div>
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
  if(!data)return html`<div className="timeline-loading"><span className="loading-spinner" aria-hidden="true"></span><span>Loading spatial timeline…</span></div>`;
  return html`<${ReactFlowProvider}><${AppCanvas} data=${data}/></${ReactFlowProvider}>`;
}
createRoot(document.getElementById("root")).render(html`<${Root}/>`);
