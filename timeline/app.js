import React,{useEffect,useMemo,useState,useCallback,useRef} from "https://esm.sh/react@18.3.1";
import {createRoot} from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1";
import {ReactFlow,ReactFlowProvider,Background,Controls,Handle,Position,MarkerType,useReactFlow} from "https://esm.sh/@xyflow/react@12?deps=react@18.3.1,react-dom@18.3.1";
import {gateKey,guidanceFor} from "./guidance.mjs";
import {mechanismGroups,initialMechanism,selectionFromHash,selectionHash,firstSentence,enablerLayout} from "./unlock.mjs";

const html=htm.bind(React.createElement);
const MECH_COLORS={Frame:"#6e68d8",Commit:"#c67b2b",Equip:"#2478b5",Assure:"#a05486",Operate:"#27865e",Learn:"#73883c"};
const truncate=(s,n=120)=>{s=String(s||"");return s.length>n?s.slice(0,n).trimEnd()+"…":s};
const byId=(rows,id)=>rows.find(x=>x.id===Number(id));
const uniq=arr=>[...new Set(arr)];
const ASSESSMENT_KEY="aistCompanyAssessmentV1";
function readCompanyAssessment(){
  try{
    const query=new URLSearchParams(window.location.search);
    if(query.get("assessment")==="questionnaire"){
      const snapshot=JSON.parse(sessionStorage.getItem("aistQuestionnaireTimelineV1")||"null");
      return snapshot?.preview && snapshot.assessment_id===query.get("id") && snapshot.data ? snapshot : null;
    }
    const requested=query.get("assessment")==="company";
    if(!requested)return null;
    const raw=JSON.parse(localStorage.getItem(ASSESSMENT_KEY)||"null");
    return raw&&raw.blockerStatuses?raw:null;
  }catch{return null}
}

function StageNode({data}){
  const {gate,count,selected,assessmentState,remaining}=data;
  const cls="stage-node"+(selected?" selected":"")+(count===0?" empty":"")+(assessmentState?` assessment-${assessmentState}`:"");
  const countLabel=data.preview?`${data.gapCount} gaps · ${data.unanswered} unanswered`:assessmentState==="done"?"✓ Done":assessmentState==="empty"?"No blockers mapped":assessmentState?`${remaining} remaining`:`${count} blocker${count===1?"":"s"}`;
  return html`<div className=${cls+(data.dimmed?" dimmed":"")} role=${selected?"group":"button"} tabIndex="0" aria-label=${`Gate ${gate.id}: ${gate.label}`} aria-pressed=${selected?undefined:"false"} onKeyDown=${e=>{if(e.key==="Enter"||e.key===" "){e.stopPropagation();if(e.target===e.currentTarget&&data.keyboardActivate){e.preventDefault();data.keyboardActivate()}}}}>
    <${Handle} type="target" position=${Position.Left} style=${{opacity:0}} />
    <div className="stage-top"><span className="stage-number">${assessmentState==="done"?"✓":gate.id}</span><span className="stage-count">${countLabel}</span></div>
    <strong>${gate.label}</strong><p>${data.zoom>0.62?(assessmentState==="done"?"All mapped blockers were marked resolved.":assessmentState==="empty"?"No blockers are currently mapped to this gate.":"Click to reveal the blockers at this stage."):""}</p>
    ${selected?html`<button className="deep-dive-plus stage-guidance-more nodrag nopan" data-guidance-key=${gateKey(gate)} aria-label=${`Guidance — Stage Gate ${gate.id} guidance`} aria-haspopup="dialog" onClick=${e=>{e.preventDefault();e.stopPropagation();data.onGuidance?.(gate,e.currentTarget)}}><span aria-hidden="true">+</span><em>Guidance</em></button>`:null}
    <${Handle} type="source" position=${Position.Right} style=${{opacity:0}} />
  </div>`;
}
function BlockerNode({data}){
  const {blocker,selected,domainTitle,zoom,relationLabel,status}=data;
  const showStatement=selected||zoom>0.92;
  const score=data.maturityScore;
  const statusCls=status?` status-${status}`:"";
  return html`<div className=${"blocker-node"+(selected?" selected":"")+statusCls+(blocker.classification==='Critical core'?' critical-core':'')+(data.relationsHighlighted?" relations-highlighted":"")} role="button" tabIndex="0" data-blocker-node=${blocker.id} aria-pressed=${selected} aria-expanded=${selected?data.detailOpen:undefined} onKeyDown=${e=>{if((e.key==="Enter"||e.key===" ")&&data.keyboardActivate){e.preventDefault();e.stopPropagation();data.keyboardActivate()}}}>
    <${Handle} type="target" position=${Position.Left} style=${{opacity:0}} />
    <div className="node-kicker"><span>Gate ${blocker.stageGate} · ${domainTitle}</span><span>${relationLabel||""}</span></div>
    ${status?html`<div className=${"assessment-status"+(status==="review"?(score>=4?" maturity-4":" maturity-3"):"")} title=${status==="review"?"Self-reported maturity; not yet verified":undefined}>${status==="gap"?"● Gap identified":status==="review"?(score>=4?"◆ L4 · Sustained*":"◕ L3 · Implemented*"):status==="unanswered"?"Not assessed":status==="not_applicable"?"Not applicable":status==="resolved"?"✓ Resolved":status==="partial"?"◐ Partial":"● Open"}</div>`:null}
    <strong>${blocker.title}</strong>${blocker.classification?html`<div className="criticality-label">${blocker.classification}</div>`:null}
    ${showStatement?html`<p>${truncate(blocker.statement,selected?185:100)}</p>`:null}
    <${Handle} type="source" position=${Position.Right} style=${{opacity:0}} />
    <${Handle} id="unlock" type="source" position=${Position.Bottom} style=${{opacity:0}} />
  </div>`;
}
function EnablerNode({data}){
  return html`<div className=${"enabler-node"+(data.selected?" selected":"")} style=${{"--mech":MECH_COLORS[data.mechanism]}} data-enabler-node=${data.enabler.id} role="button" tabIndex="0" aria-pressed=${data.selected?"true":"false"} onKeyDown=${e=>{if((e.key==="Enter"||e.key===" ")&&data.keyboardActivate){e.preventDefault();e.stopPropagation();data.keyboardActivate()}}}>
    <${Handle} type="target" position=${Position.Top} style=${{opacity:0}} />
    <div className="mini-label">${data.number} · ${data.mechanism} enabler ${data.selected?"· Selected":""}</div><strong>${data.enabler.title}</strong><p>${truncate(data.enabler.description,110)}</p>
  </div>`;
}
function MechanismLegend({data}){
  return html`<div className="mechanism-legend" style=${{"--mech":MECH_COLORS[data.mechanism]}}><i aria-hidden="true"></i>${data.mechanism} · ${data.count} enabler${data.count===1?"":"s"}</div>`;
}
const nodeTypes={stage:StageNode,blocker:BlockerNode,legend:MechanismLegend,enabler:EnablerNode};

function AppCanvas({data,guidance,guidanceLoading}){
  const flow=useReactFlow();
  const canvasRef=useRef(null);
  const inspectorClose=useRef(null);
  const returnBlockerFocus=useRef(false);
  const restoringHistory=useRef(null);
  const historyReady=useRef(false);
  const initialSelection=useMemo(()=>selectionFromHash(data,location.hash,location.search),[data]);
  const [canvasSize,setCanvasSize]=useState({width:800,height:600});
  useEffect(()=>{const observer=new ResizeObserver(([entry])=>setCanvasSize({width:Math.round(entry.contentRect.width),height:Math.round(entry.contentRect.height)}));observer.observe(canvasRef.current);return()=>observer.disconnect()},[]);
  const guidanceTrigger=useRef(null);
  const guidanceClose=useRef(null);
  const [guidanceKey,setGuidanceKey]=useState(null);
  const openGuidance=useCallback((gate,trigger)=>{guidanceTrigger.current=trigger;setGuidanceKey(gateKey(gate))},[]);
  const closeGuidance=useCallback(()=>{setGuidanceKey(null);requestAnimationFrame(()=>guidanceTrigger.current?.isConnected&&guidanceTrigger.current.focus({preventScroll:true}))},[]);
  const gateGuidance=useMemo(()=>guidanceFor(guidance,guidanceKey),[guidance,guidanceKey]);
  useEffect(()=>{if(!guidanceKey)return;guidanceClose.current?.focus({preventScroll:true});const escape=e=>{if(e.key==="Escape"){e.preventDefault();e.stopImmediatePropagation();closeGuidance()}};document.addEventListener("keydown",escape,true);return()=>document.removeEventListener("keydown",escape,true)},[guidanceKey,closeGuidance]);
  const [savedCount,setSavedCount]=useState(()=>{try{const x=JSON.parse(localStorage.getItem("aistExplorerBookmarks")||"{\"blockers\":[],\"enablers\":[]}");return (x.blockers?.length||0)+(x.enablers?.length||0)}catch{return 0}});
  const [zoom,setZoom]=useState(.72);
  const [selectedGate,setSelectedGate]=useState(initialSelection.gate);
  const [selectedBlocker,setSelectedBlocker]=useState(initialSelection.blocker);
  const [detailOpen,setDetailOpen]=useState(initialSelection.detail);
  const [selectedMechanism,setSelectedMechanism]=useState(initialSelection.mechanism);
  const [selectedEnabler,setSelectedEnabler]=useState(null);
  const [relationsOpen,setRelationsOpen]=useState(false);
  const [unlockOpen,setUnlockOpen]=useState(true);
  const [showCompleted,setShowCompleted]=useState(false);
  useEffect(()=>{setGuidanceKey(null)},[selectedGate,selectedBlocker]);
  const assessment=useMemo(()=>readCompanyAssessment(),[]);
  const assessmentMode=!!assessment;
  const previewMode=!!assessment?.preview;
  useEffect(()=>{const sync=()=>{try{const x=JSON.parse(localStorage.getItem("aistExplorerBookmarks")||"{\"blockers\":[],\"enablers\":[]}");setSavedCount((x.blockers?.length||0)+(x.enablers?.length||0))}catch{setSavedCount(0)}};window.addEventListener("storage",sync);return()=>window.removeEventListener("storage",sync)},[]);
  const phoneViewport=window.innerWidth<600;
  const compactViewport=window.innerWidth<900;
  const stageX=id=>id*(phoneViewport?250:compactViewport?260:270);
  const domains=useMemo(()=>Object.fromEntries(data.domains.map(d=>[d.slug,d.title])),[data]);
const blockerStatus=useCallback(id=>assessment?.blockerStatuses?.[id]||"open",[assessment]);
  const gateAssessment=useCallback(gateId=>{
    const bs=data.blockers.filter(b=>b.stageGate===gateId);
    if(!bs.length)return{state:"empty",remaining:0};
    if(assessment?.preview)return{state:"active",remaining:bs.filter(b=>blockerStatus(b.id)==="gap").length,gaps:bs.filter(b=>blockerStatus(b.id)==="gap").length,unanswered:bs.filter(b=>blockerStatus(b.id)==="unanswered").length};
    const remaining=bs.filter(b=>blockerStatus(b.id)!=="resolved").length;
    return{state:remaining===0?"done":"active",remaining};
  },[data,blockerStatus,assessment]);

  const dependencyContext=useCallback(id=>{
    const upstreamIds=uniq(data.blockerDependencies.filter(d=>d.blockerId===id).map(d=>d.dependsOnBlockerId));
    const downstreamIds=uniq(data.blockerDependencies.filter(d=>d.dependsOnBlockerId===id).map(d=>d.blockerId));
    return{upstream:upstreamIds.map(x=>byId(data.blockers,x)).filter(Boolean),downstream:downstreamIds.map(x=>byId(data.blockers,x)).filter(Boolean)};
  },[data]);

  const groupsForBlocker=useCallback(id=>mechanismGroups(data,id),[data]);

  // Store panel visibility in this entry, while keeping shareable IDs in the hash.
  useEffect(()=>{
    const restore=()=>{
      const stored=history.state?.timeline;
      const parsed=selectionFromHash(data,location.hash,location.search);
      const next=stored?.hash===location.hash?{...parsed,detail:!!stored.detail,mechanism:stored.detail&&stored.mechanism?parsed.mechanism:null}:parsed;
      restoringHistory.current=JSON.stringify(next);
      setSelectedGate(next.gate);setSelectedBlocker(next.blocker);setDetailOpen(next.detail);setSelectedMechanism(next.mechanism);setSelectedEnabler(null);setRelationsOpen(false);setUnlockOpen(true);
    };
    window.addEventListener("popstate",restore);window.addEventListener("hashchange",restore);
    return()=>{window.removeEventListener("popstate",restore);window.removeEventListener("hashchange",restore)};
  },[data]);
  useEffect(()=>{
    const selection={gate:selectedGate,blocker:selectedBlocker,detail:detailOpen,mechanism:selectedMechanism};
    const restored=restoringHistory.current===JSON.stringify(selection);
    restoringHistory.current=null;
    if(restored)return;
    const hash=selectionHash(selection),state={...history.state,timeline:{hash,detail:detailOpen,mechanism:selectedMechanism}};
    const url=location.pathname+location.search+hash;
    if(!historyReady.current||location.hash===hash)history.replaceState(state,"",url);else history.pushState(state,"",url);
    historyReady.current=true;
  },[selectedGate,selectedBlocker,detailOpen,selectedMechanism]);
  useEffect(()=>{setRelationsOpen(false);setUnlockOpen(true)},[selectedBlocker]);
  useEffect(()=>{if(detailOpen)inspectorClose.current?.focus({preventScroll:true})},[detailOpen,selectedBlocker]);
  useEffect(()=>{if(selectedEnabler&&unlockOpen)document.querySelector(`[data-enabler-item="${selectedEnabler}"]`)?.scrollIntoView({block:"nearest"})},[selectedEnabler,unlockOpen]);
  const selectEnabler=useCallback(id=>{setSelectedEnabler(id);setUnlockOpen(true)},[]);

  const openDeepDive=useCallback((blocker)=>{
    if(!blocker)return;
    if(blocker.id===selectedBlocker&&detailOpen){inspectorClose.current?.focus({preventScroll:true});return;}
    setSelectedBlocker(blocker.id);
    setSelectedGate(blocker.stageGate);
    setDetailOpen(true);
    setSelectedMechanism(initialMechanism(data,blocker.id));
    setSelectedEnabler(null);
    setRelationsOpen(false);setUnlockOpen(true);
  },[data,selectedBlocker,detailOpen]);
  const closeDetail=useCallback(()=>{
    returnBlockerFocus.current=true;
    setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null);
  },[selectedBlocker]);
  useEffect(()=>{if(!detailOpen)return;const onKey=e=>{if(e.key==="Escape"){e.preventDefault();closeDetail()}};document.addEventListener("keydown",onKey);return()=>document.removeEventListener("keydown",onKey)},[detailOpen,closeDetail]);

  const graph=useMemo(()=>{
    const nodes=[],edges=[];
    const edgeBase={type:"smoothstep",style:{stroke:"#aec7d7",strokeWidth:1.2},markerEnd:{type:MarkerType.ArrowClosed,width:14,height:14,color:"#aec7d7"}};
    data.stageGates.forEach(g=>{
      const ga=assessmentMode?gateAssessment(g.id):null;
      nodes.push({id:`stage-${g.id}`,type:"stage",position:{x:stageX(g.id),y:0},data:{gate:g,count:data.blockers.filter(b=>b.stageGate===g.id).length,selected:selectedGate===g.id,zoom,assessmentState:ga?.state,remaining:ga?.remaining,preview:previewMode,gapCount:ga?.gaps,unanswered:ga?.unanswered,dimmed:!!selectedBlocker&&selectedGate!==g.id,onGuidance:openGuidance,keyboardActivate:()=>{setSelectedGate(selectedGate===g.id&&!selectedBlocker?null:g.id);setSelectedBlocker(null);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}},zIndex:selectedGate===g.id?5:1});
      if(g.id<data.stageGates.length-1)edges.push({id:`stage-edge-${g.id}`,source:`stage-${g.id}`,target:`stage-${g.id+1}`,...edgeBase,style:{stroke:"#c9dce8",strokeWidth:2}});
    });

    if((selectedGate != null)&&!selectedBlocker){
      const blockers=data.blockers.filter(b=>b.stageGate===selectedGate && (!assessmentMode || showCompleted || blockerStatus(b.id)!=="resolved"));
      const cols=phoneViewport?1:compactViewport?2:3;
      const stepX=phoneViewport?0:compactViewport?275:300;
      const baseX=phoneViewport?stageX(selectedGate):stageX(selectedGate)-(compactViewport?138:280);
      blockers.forEach((b,i)=>{const row=Math.floor(i/cols),col=i%cols,x=baseX+col*stepX,y=(phoneViewport?180:195)+row*(phoneViewport?150:165);
        nodes.push({id:`blocker-${b.id}`,type:"blocker",position:{x,y:y+55},data:{blocker:b,selected:false,domainTitle:domains[b.domain]||"",zoom,maturityScore:assessment?.blockerScores?.[b.id],status:assessmentMode?blockerStatus(b.id):null,keyboardActivate:()=>openDeepDive(b)}});
        edges.push({id:`gate-blocker-${b.id}`,source:`stage-${selectedGate}`,target:`blocker-${b.id}`,...edgeBase,style:{stroke:"#d8e6ee",strokeWidth:1}});
      });
    }

    if(selectedBlocker){
      const b=byId(data.blockers,selectedBlocker),deps=dependencyContext(b.id);
      const focusX=phoneViewport?stageX(b.stageGate):compactViewport?620:760;
      const focusY=phoneViewport?235:350,items=detailOpen&&selectedMechanism?groupsForBlocker(b.id)[selectedMechanism]||[]:[];
      const layout=enablerLayout(items.length,canvasSize.width,focusX,focusY,phoneViewport?260:330,canvasSize.height);
      nodes.push({id:`blocker-${b.id}`,type:"blocker",position:{x:focusX,y:focusY},data:{blocker:b,selected:true,detailOpen,domainTitle:domains[b.domain]||"",zoom,maturityScore:assessment?.blockerScores?.[b.id],status:assessmentMode?blockerStatus(b.id):null,keyboardActivate:()=>openDeepDive(b)},zIndex:8});
      const placeSide=(items,side)=>{const x=detailOpen?(side==="up"?layout.dependencyLeft:layout.dependencyRight):phoneViewport?(side==="up"?focusX-285:focusX+315):(side==="up"?380:1140),label=side==="up"?"Depends on":"Depends on this";
        items.filter(xBlock=>!assessmentMode || showCompleted || blockerStatus(xBlock.id)!=="resolved").forEach((xBlock,i)=>{const y=(phoneViewport?180:210)+i*(detailOpen?230:phoneViewport?138:145);
          // Reciprocal dependencies use one card with both directional edges.
          if(!nodes.some(n=>n.id===`blocker-${xBlock.id}`))nodes.push({id:`blocker-${xBlock.id}`,type:"blocker",position:{x,y},data:{blocker:xBlock,selected:false,relationsHighlighted:relationsOpen,domainTitle:domains[xBlock.domain]||"",zoom,relationLabel:label,maturityScore:assessment?.blockerScores?.[xBlock.id],status:assessmentMode?blockerStatus(xBlock.id):null,keyboardActivate:()=>openDeepDive(xBlock)}});
          const edge=side==="up"?{source:`blocker-${xBlock.id}`,target:`blocker-${b.id}`}:{source:`blocker-${b.id}`,target:`blocker-${xBlock.id}`};
          edges.push({id:`dep-${side}-${xBlock.id}`,...edge,...edgeBase,animated:true,style:{stroke:side==="up"?"#6e97b3":"#3b86b7",strokeWidth:relationsOpen?2.5:1.5,opacity:detailOpen&&!relationsOpen?.25:1}});
        });
      };
      placeSide(deps.upstream,"up");placeSide(deps.downstream,"down");

      if(items.length){
        const color=MECH_COLORS[selectedMechanism];
        nodes.push({id:"mechanism-legend",type:"legend",position:layout.legend,data:{mechanism:selectedMechanism,count:items.length},selectable:false});
        items.forEach((item,i)=>{
          nodes.push({id:`enabler-${item.enabler.id}`,type:"enabler",position:layout.positions[i],data:{enabler:item.enabler,number:i+1,mechanism:selectedMechanism,selected:selectedEnabler===item.enabler.id,keyboardActivate:()=>selectEnabler(item.enabler.id)}});
          edges.push({id:`unlock-enabler-${item.enabler.id}`,source:`blocker-${b.id}`,sourceHandle:"unlock",target:`enabler-${item.enabler.id}`,...edgeBase,markerEnd:{...edgeBase.markerEnd,color},style:{stroke:color,strokeWidth:1.6}});
        });
      }
    }
    return{nodes,edges};
  },[data,selectedGate,selectedBlocker,detailOpen,selectedMechanism,selectedEnabler,zoom,domains,dependencyContext,groupsForBlocker,openDeepDive,assessmentMode,showCompleted,blockerStatus,gateAssessment,relationsOpen,canvasSize.width,canvasSize.height,selectEnabler]);

  useEffect(()=>{
    let cancelled=false,raf2=0,retry=0;
    const fit=()=>{
      if(cancelled)return;
      const all=flow.getNodes();
      if(!all.length||all.some(n=>!flow.getInternalNode(n.id)?.measured?.width)){retry=setTimeout(fit,60);return;}
      let focus=[];
      const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const phone=window.innerWidth<600;
      const tablet=window.innerWidth<900;
      if(selectedBlocker){
        const selected=all.find(n=>n.id===`blocker-${selectedBlocker}`);
        focus=detailOpen?all.filter(n=>n.id===selected?.id||n.type==="enabler"||n.type==="legend"||(relationsOpen&&n.type==="blocker")):phone?[selected].filter(Boolean):all.filter(n=>n.type==="blocker");
      }else if((selectedGate != null)){
        const gate=all.find(n=>n.id===`stage-${selectedGate}`);
        const blockers=all.filter(n=>n.type==="blocker");
        focus=[gate,...blockers.slice(0,phone?2:tablet?4:6)].filter(Boolean);
      }else{
        const stages=all.filter(n=>n.type==="stage");
        focus=phone?stages.slice(0,2):tablet?stages.slice(0,3):stages;
      }
      Promise.resolve(flow.fitView({
        nodes:focus.length?focus:all,
        padding:detailOpen?.2:selectedBlocker?(phone?.22:.12):(selectedGate != null)?(phone?.16:.10):.10,
        duration:reduced?0:320,
        minZoom:detailOpen?.1:selectedBlocker?(phone?.88:.56):(selectedGate != null)?(phone?.78:tablet?.64:.52):(phone?.76:tablet?.62:.48),
        maxZoom:selectedBlocker?(phone?1.02:1.05):(selectedGate != null)?(phone?.96:.92):(phone?.92:.90)
      })).then(()=>{if(!cancelled&&returnBlockerFocus.current)requestAnimationFrame(()=>{if(cancelled)return;document.querySelector(`[data-blocker-node="${selectedBlocker}"]`)?.focus({preventScroll:true});returnBlockerFocus.current=false})});
    };
    const raf1=requestAnimationFrame(()=>{raf2=requestAnimationFrame(fit)});
    return()=>{cancelled=true;cancelAnimationFrame(raf1);if(raf2)cancelAnimationFrame(raf2);if(retry)clearTimeout(retry)};
  },[selectedGate,selectedBlocker,detailOpen,selectedMechanism,relationsOpen,showCompleted,graph.nodes.length,canvasSize.width,canvasSize.height]);

  const reset=()=>{setSelectedGate(null);setSelectedBlocker(null);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)};
  const back=()=>{if(selectedEnabler){setSelectedEnabler(null);return}if(selectedMechanism){setSelectedMechanism(null);return}if(detailOpen){closeDetail();return}if(selectedBlocker){setSelectedBlocker(null);return}if((selectedGate != null)){setSelectedGate(null)}};

  const onNodeClick=(evt,node)=>{
    if(node.type==="stage"){
      setSelectedGate(selectedGate===node.data.gate.id&&!selectedBlocker?null:node.data.gate.id);
      setSelectedBlocker(null);
      setDetailOpen(false);
      setSelectedMechanism(null);
      setSelectedEnabler(null);
      return;
    }
    if(node.type==="blocker"){
      if(!node.data.selected||!detailOpen)openDeepDive(node.data.blocker);
      return;
    }
    if(node.type==="enabler") selectEnabler(node.data.enabler.id);
  };

  useEffect(()=>{returnBlockerFocus.current=!!selectedBlocker&&!detailOpen},[selectedBlocker,detailOpen]);

  const selectedBlockerObj=selectedBlocker?byId(data.blockers,selectedBlocker):null;
  const groups=selectedBlockerObj?groupsForBlocker(selectedBlockerObj.id):{};
  const availableMechanisms=data.mechanisms.filter(m=>groups[m.key]?.length);
  const deps=selectedBlockerObj?dependencyContext(selectedBlockerObj.id):{upstream:[],downstream:[]};
  const selectedEnablerPair=groups[selectedMechanism]?.find(x=>x.enabler.id===selectedEnabler);

  const crumbs=[];
  if((selectedGate != null))crumbs.push({label:`Gate ${selectedGate}`,action:()=>{setSelectedBlocker(null);setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}});
  if(selectedBlockerObj)crumbs.push({label:truncate(selectedBlockerObj.title,38),action:()=>{setDetailOpen(false);setSelectedMechanism(null);setSelectedEnabler(null)}});
  if(detailOpen)crumbs.push({label:"Detail",action:()=>{setSelectedMechanism(null);setSelectedEnabler(null)}});
  if(selectedMechanism)crumbs.push({label:selectedMechanism,action:()=>setSelectedEnabler(null)});
  if(selectedEnablerPair)crumbs.push({label:truncate(selectedEnablerPair.enabler.title,28),action:null});

  return html`<div className="shell">
    ${previewMode?html`<header className="topbar"><a className="brand" href=${"../assessment-preview/?resume="+encodeURIComponent(assessment.assessment_id)}><span className="brand-mark"></span><span>AI Scalability Explorer</span></a><div className="top-title">My scalability timeline</div><div className="top-actions"><a className="top-link" href=${"../assessment-preview/?resume="+encodeURIComponent(assessment.assessment_id)}>← Results</a>${selectedGate!=null?html`<button className="ghost-top" onClick=${back}>← Back one level</button>`:null}<button className="ghost-top" onClick=${reset}>Reset view</button></div></header>`:html`    <header className="topbar">
      <a className="brand" href="../#home"><span className="brand-mark"></span><span>AI Scalability Explorer</span></a>
      <div className="top-title">${assessmentMode?"My AI Scalability Timeline":"Spatial Timeline"}</div>
      <div className="top-actions">
        <a className="icon-top" href="../?search=1#explore" aria-label="Search" title="Search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"></circle><path d="m16 16 4 4"></path></svg></a>
        <a className="icon-top" href="../#selection" aria-label="My selection" title="My selection"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5h10v15l-5-3.1-5 3.1z"></path></svg>${savedCount?html`<span className="saved-count">${savedCount}</span>`:null}</a>
        ${(selectedGate != null)?html`<button className="ghost-top" onClick=${back}>← Back one level</button>`:null}
        ${assessmentMode?html`<button className=${"ghost-top"+(showCompleted?" active-toggle":"")} onClick=${()=>setShowCompleted(v=>!v)}>${showCompleted?"Hide completed":"Show completed"}</button>`:null}
        <button className="ghost-top" onClick=${reset}>Reset</button><a className="top-link" href="../#explore">Explorer ↗</a><a className="top-link" href="../#dependencies">Dependencies ↗</a><a className="top-link" href="../play/">Play ↗</a>
      </div>
    </header>`}
    <main className=${"workspace"+(detailOpen?" detail-open":"")}>
      <div className=${"intro"+((selectedGate != null)?" compact":"")}><div className="eyebrow">${previewMode?"Self-reported assessment":assessmentMode?"Assessment result · illustrative":"Semantic zoom"}</div><h1>${assessmentMode?((selectedGate != null)?"Focus on what remains.":"Your AI scalability path."):((selectedGate != null)?"Keep exploring.":"Start with the lifecycle.")}</h1><p>${previewMode?"Choose a Stage Gate to explore assessed gaps, dependencies and enablers. * Self-reported, not yet verified. No blockers are closed.":assessmentMode?((selectedGate != null)?"Resolved blockers are hidden by default. Open a remaining blocker to explore dependencies and enablers.":"Done gates have all currently mapped blockers resolved. Other gates show what remains."):((selectedGate != null)?"Pan and zoom freely. Choose a blocker, then select a mechanism in How to unlock to explore its enablers.":"Choose a Stage Gate. Complexity only appears when you ask for it.")}</p></div>
      <div className="depth"><span>Overview</span><i></i><span>Deep dive</span></div>
      <div className="flow-wrap" ref=${canvasRef}>
        <${ReactFlow} nodes=${graph.nodes} edges=${graph.edges} nodeTypes=${nodeTypes} minZoom=${detailOpen?.1:.35} maxZoom=${1.7} onNodeClick=${onNodeClick} zoomOnDoubleClick=${false} onMove=${(_,viewport)=>setZoom(viewport.zoom)} nodesDraggable=${false} nodesConnectable=${false} elementsSelectable panOnScroll zoomOnScroll zoomOnPinch selectionOnDrag=${false}>
          <${Background} gap=${32} size=${1} color="#d9e5ec" />
          <${Controls} showInteractive=${false} position="bottom-left" />
        </${ReactFlow}>
      <div className="breadcrumbs"><button onClick=${reset}>Timeline</button>${crumbs.map((c,i)=>html`<${React.Fragment} key=${i}><i>›</i>${c.action?html`<button onClick=${c.action}>${c.label}</button>`:html`<span>${c.label}</span>`}</${React.Fragment}>`)}</div>
      <div className="zoom-readout">Zoom ${Math.round(zoom*100)}%</div>
      </div>
      ${selectedGate == null?html`<div className="hint"><strong>${assessmentMode?"Your personalised timeline":"Click a Stage Gate"}</strong><span>${previewMode?"Explore gaps and enablers by Stage Gate.":assessmentMode?"Open a gate to explore remaining blockers.":"Then keep zooming into what interests you."}</span></div>`:null}

      ${guidanceKey?html`<aside className="inspector guidance-inspector" role="dialog" aria-modal="false" aria-labelledby="gate-guidance-title">
        <div className="inspector-head"><div><div className="eyebrow">Stage Gate Guidance</div><h2 id="gate-guidance-title">${gateGuidance?.display_title||`Gate ${guidanceKey.slice(1)}`}</h2></div><button ref=${guidanceClose} className="close-inspector" onClick=${closeGuidance} aria-label="Close guidance" title="Close guidance">×</button></div>
        <div className="inspector-body">${guidanceLoading?html`<p role="status">Loading guidance…</p>`:!gateGuidance?html`<p role="status">Guidance is not available for this Stage Gate.</p>`:html`
          <div className="info-box"><small>Lifecycle transition</small><span>${gateGuidance.phase_label||"Not provided"}</span></div>
          <section className="inspector-section"><h3>Gate purpose</h3><p>${gateGuidance.gate_purpose||"Not provided"}</p></section>
          <section className="inspector-section"><h3>Key actions</h3>${gateGuidance.actions.length?html`<ol className="guidance-actions">${gateGuidance.actions.map(a=>html`<li key=${a.id}>${a.text}</li>`)}</ol>`:html`<p>Not provided</p>`}</section>
          <section className="inspector-section"><h3>Intersecting ISO lines</h3><div className="guidance-categories">${gateGuidance.categories.map(c=>html`<span className="guidance-category" key=${c.token}><i style=${{background:c.color}} aria-hidden="true"></i>${c.label}</span>`)}</div></section>
        `}</div>
      </aside>`:null}
      ${!guidanceKey&&detailOpen&&selectedBlockerObj?html`<aside key=${selectedBlockerObj.id} className="inspector blocker-inspector" aria-labelledby="timeline-inspector-title">
        <div className="inspector-head"><div><div className="eyebrow">GATE ${selectedBlockerObj.stageGate} · BLOCKER DETAIL</div><h2 id="timeline-inspector-title">${selectedBlockerObj.title}</h2><p className="blocker-summary" title=${firstSentence(selectedBlockerObj.statement)}>${firstSentence(selectedBlockerObj.statement)}</p></div><button ref=${inspectorClose} className="close-inspector" onClick=${closeDetail} aria-label="Close blocker details" title="Close blocker details">×</button></div>
        <div className="inspector-body">
          <details className="unlock-section" open=${unlockOpen} onToggle=${e=>setUnlockOpen(e.currentTarget.open)}>
            <summary>How to unlock</summary>
            <div className="mechanism-grid" aria-label="Enabling mechanisms">
              ${availableMechanisms.map(m=>{const count=groups[m.key].length,active=selectedMechanism===m.key;return html`<button key=${m.key} className=${"mechanism-choice"+(active?" active":"")} style=${{"--mech":MECH_COLORS[m.key]}} aria-pressed=${active} aria-controls="mechanism-enablers" onClick=${()=>{setSelectedMechanism(m.key);setSelectedEnabler(null)}}><i aria-hidden="true"></i><span>${m.key}<small>${count} enabler${count===1?"":"s"}</small></span><b aria-hidden="true">${active?"✓":""}</b></button>`})}
            </div>
            <div id="mechanism-enablers">
              ${selectedMechanism?html`<div className="mechanism-content" style=${{"--mech":MECH_COLORS[selectedMechanism]}}><h3>${selectedMechanism}</h3><p>${data.mechanisms.find(m=>m.key===selectedMechanism)?.description}</p>
                <ol className="unlock-enablers">${groups[selectedMechanism].map(({enabler,relationship},i)=>html`<li key=${enabler.id} data-enabler-item=${enabler.id} className=${selectedEnabler===enabler.id?"selected":""}><button className="enabler-item" aria-pressed=${selectedEnabler===enabler.id} aria-expanded=${selectedEnabler===enabler.id} aria-controls=${selectedEnabler===enabler.id?`enabler-detail-${enabler.id}`:undefined} onClick=${()=>selectEnabler(enabler.id)}><span className="enabler-number">${i+1}</span><span>${enabler.title}</span>${selectedEnabler===enabler.id?html`<b aria-label="Selected">✓</b>`:null}</button><p>${enabler.description}</p>
                  ${selectedEnabler===enabler.id?html`<div id=${`enabler-detail-${enabler.id}`} className="enabler-detail"><h4>Practical actions</h4><p>${enabler.practicalActions||"—"}</p><h4>Expected outcome</h4><p>${enabler.expectedOutcome||"—"}</p><h4>Stakeholders</h4><p>${enabler.stakeholders.join(" · ")||"—"}</p>${relationship.rationale?html`<div className="rationale">${relationship.rationale}</div>`:null}</div>`:null}
                </li>`)}</ol>
              </div>`:html`<p className="unlock-hint">${availableMechanisms.length?"Choose a mechanism to explore how to overcome this blocker.":"No enablers are mapped to this blocker yet."}</p>`}
            </div>
          </details>
          <details className="blocker-accordion relations-section" open=${relationsOpen} onToggle=${e=>setRelationsOpen(e.currentTarget.open)}><summary>Relations<small>${deps.upstream.length} this depends on · ${deps.downstream.length} depend on this</small></summary><div className="relation-list">${[{label:"This depends on",items:deps.upstream},{label:"Depend on this",items:deps.downstream}].map(({label,items})=>html`<h3>${label}</h3>${items.length?items.map(b=>html`<button key=${b.id} onClick=${()=>openDeepDive(b)}>${b.title}<span aria-hidden="true"> →</span></button>`):html`<p>No dependencies mapped.</p>`}`)}</div></details>
          <details className="blocker-accordion"><summary>Why it matters</summary><p>${selectedBlockerObj.whyItMatters||"—"}</p></details>
          <details className="blocker-accordion"><summary>Consequence if not addressed</summary><p>${selectedBlockerObj.consequence||"—"}</p></details>
          <details className="blocker-accordion"><summary>Stakeholders</summary><p>${selectedBlockerObj.stakeholders.join(" · ")||"—"}</p></details>
          <p className="blocker-metadata"><span title=${selectedBlockerObj.stageGateDescription}>Stage Gate ${selectedBlockerObj.stageGate}</span><span title="Dimension">${selectedBlockerObj.dimension}</span><span title="Domain">${domains[selectedBlockerObj.domain]||"—"}</span><span title="Community">${selectedBlockerObj.communityName||"—"}</span></p>
        </div>
      </aside>`:null}
    </main>
  </div>`;
}

function Root(){
  const[data,setData]=useState(null),[error,setError]=useState(null);
  const[guidance,setGuidance]=useState(null),[guidanceLoading,setGuidanceLoading]=useState(true);
  useEffect(()=>{let active=true;fetch("../data/stage-gate-guidance.json",{cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("Guidance unavailable");return r.json()}).then(value=>{if(active)setGuidance(value)}).catch(()=>{if(active)setGuidance(null)}).finally(()=>{if(active)setGuidanceLoading(false)});return()=>{active=false}},[]);
  useEffect(()=>{
    if(new URLSearchParams(location.search).get("assessment")==="questionnaire"){
      const snapshot=readCompanyAssessment();
      if(snapshot?.data)setData(snapshot.data);else setError("This assessment is not available in this tab. Return to the questionnaire results and open the timeline again.");
      return;
    }
    fetch("../data/explorer-data.json?v=20261001-gates-0-5", {cache:"no-cache"}).then(r=>{if(!r.ok)throw new Error("Could not load explorer-data.json");return r.json()}).then(setData).catch(e=>setError(e.message))},[]);
  if(error)return html`<div style=${{padding:"40px",fontFamily:"system-ui"}}><h2>Could not load data</h2><p>${error}</p></div>`;
  if(!data)return html`<div className="timeline-loading"><span className="loading-spinner" aria-hidden="true"></span><span>Loading spatial timeline…</span></div>`;
  return html`<${ReactFlowProvider}><${AppCanvas} data=${data} guidance=${guidance} guidanceLoading=${guidanceLoading}/></${ReactFlowProvider}>`;
}
createRoot(document.getElementById("root")).render(html`<${Root}/>`);
