"""Build all Explorer datasets from one master workbook. No JSON fallback inputs."""
from __future__ import annotations

import hashlib
import json
import math
import re
from collections import Counter, defaultdict
from pathlib import Path

from openpyxl import load_workbook

EXPORTER_VERSION = "2.0.0"


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(value):
    return "sha256:" + hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False).encode()).hexdigest()


def text(value):
    return "" if value is None else str(value).strip()


def integer(value, context):
    require(not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value) and int(value) == value, f"{context}: expected an integer, got {value!r}")
    return int(value)


def number(value, context):
    require(not isinstance(value, bool) and isinstance(value, (int, float)) and math.isfinite(value), f"{context}: expected a finite number")
    return value


def parts(value):
    return [x.strip() for x in text(value).split(";") if x.strip()]


def id_parts(value, context):
    result = []
    for token in parts(value):
        require(re.fullmatch(r"\d+", token), f"{context}: invalid ID {token!r}")
        result.append(int(token))
    require(len(result) == len(set(result)), f"{context}: duplicate IDs")
    return result


def unique(rows, field, context):
    result = {}
    for row in rows:
        key = row[field]
        require(key is not None and key != "" and key not in result, f"{context}: missing or duplicate {field}: {key!r}")
        result[key] = row
    return result


class Master:
    def __init__(self, path):
        self.path = Path(path)
        self.wb = load_workbook(self.path, data_only=False)
        self.cached = load_workbook(self.path, data_only=True, read_only=True)

    def records(self, sheet, header=1, stop_blank=False, fields=None):
        require(sheet in self.wb.sheetnames, f"Missing worksheet: {sheet}")
        ws = self.wb[sheet]
        names = [text(c.value) for c in ws[header]]
        active = [x for x in names if x]
        require(len(active) == len(set(active)), f"{sheet}: duplicate column headers")
        if fields:
            require(set(fields) <= set(names), f"{sheet}: missing columns {sorted(set(fields) - set(names))}")
        rows = []
        for line in range(header + 1, ws.max_row + 1):
            vals = [c.value for c in ws[line]]
            if stop_blank and vals[0] is None:
                break
            if not any(v is not None for v in vals):
                if stop_blank:
                    break
                continue
            # A blank key is not a data record (some templates contain footer formatting).
            if vals[0] is None:
                continue
            row = {k: v for k, v in zip(names, vals) if k and (fields is None or k in fields)}
            for k, v in row.items():
                if (isinstance(v, str) and v.startswith('=')) or getattr(v, 'text', '').startswith('='):
                    value = self.cached[sheet].cell(line, names.index(k)+1).value
                    require(value is not None and not (isinstance(value, str) and value.startswith('#')), f'{sheet}!row {line}, {k}: missing or invalid cached formula result; recalculate and save in Excel')
                    row[k] = value
            row['_row'] = line
            rows.append(row)
        return rows


def attrs(row):
    return {k: v for k, v in row.items() if k != '_row'}


def origin(sheet, row):
    return {'sheet': sheet, 'row': row['_row']}


def graph_analysis(ids, edges):
    upstream = {i: set() for i in ids}
    downstream = {i: set() for i in ids}
    for e in edges:
        upstream[e['blockerId']].add(e['dependsOnBlockerId'])
        downstream[e['dependsOnBlockerId']].add(e['blockerId'])

    def reachable(start, graph):
        seen, todo = set(), list(graph[start])
        while todo:
            node = todo.pop()
            if node not in seen:
                seen.add(node)
                todo.extend(graph[node] - seen)
        return seen

    reach = {i: reachable(i, upstream) for i in ids}
    cycles, assigned = [], set()
    for i in sorted(ids):
        if i in assigned:
            continue
        group = {j for j in reach[i] if i in reach[j]}
        if len(group) > 1:
            assigned.update(group)
            cycles.append({'blocker_ids': sorted(group), 'relationship_ids': sorted(e['id'] for e in edges if e['blockerId'] in group and e['dependsOnBlockerId'] in group), 'action': 'joint_review_required'})
    detail = [{'blockerId': i, 'directPrerequisites': sorted(upstream[i]), 'directDependents': sorted(downstream[i]), 'allUpstreamBlockers': sorted(reach[i] - {i}), 'allDownstreamBlockers': sorted(reachable(i, downstream) - {i}), 'cycleMembersIncludingSelf': next((c['blocker_ids'] for c in cycles if i in c['blocker_ids']), []), 'sourceEdgeCount': len(upstream[i])} for i in sorted(ids)]
    return detail, cycles


def build(path):
    m = Master(path)
    try:
        return build_master(m)
    finally:
        m.wb.close()
        m.cached.close()


def build_master(m):
    criticality_rows = m.records('Dependency_Analysis', fields=['Blocker ID', 'Criticality composite', 'Classification'])
    criticality = {integer(r['Blocker ID'], 'Blocker ID'): (number(r['Criticality composite'], 'criticality'), text(r['Classification'])) for r in criticality_rows}
    require(len(criticality) == len(criticality_rows), 'Dependency_Analysis: duplicate blocker ID')
    gates = [attrs(r) for r in m.records('Stage_Gates')]
    gate_map = unique(gates, 'gate_id', 'Stage_Gates')
    require(set(gate_map) == {f'G{i}' for i in range(6)}, 'Stage_Gates: expected G0 through G5')
    iso = [attrs(r) for r in m.records('ISO_Lines')]
    iso_map = unique(iso, 'iso_line', 'ISO_Lines')
    for g in gates:
        gid = g['gate_id']
        require(g['gate_order'] == int(gid[1:]) and g['blocker_link_key'] == gid and g['enabler_link_key'] == gid, f'{gid}: conflicting gate keys/order')
        tokens = text(g['iso_lines']).split('|')
        require(len(tokens) == len(set(tokens)) == g['iso_line_count'] and set(tokens) <= set(iso_map), f'{gid}: invalid ISO mapping')
        for token in iso_map:
            flag = g['iso_' + token.lower()]
            require(type(flag) is bool and flag == (token in tokens), f'{gid}: inconsistent ISO flag {token}')
        require(type(g['show_in_timeline']) is bool and type(g['show_guidance']) is bool, f'{gid}: visibility flags must be booleans')
        for key in ['gate_title', 'gate_purpose', 'action_1_text', 'action_2_text', 'action_3_text']:
            require(text(g[key]), f'{gid}: missing {key}')
    gates.sort(key=lambda g: g['gate_order'])

    def parse_gate(value):
        if value is None or text(value) == '':
            return None
        match = re.fullmatch(r'Gate\s*([0-5])\s*[-\u2013\u2014]\s*(.+)', text(value), re.I)
        if match:
            n = int(match[1])
            # The master uses both singular Operation and plural Operations for G4.
            normalize = lambda s: re.sub(r'\W+', '', s).lower().replace('operations', 'operation')
            require(normalize(match[2]) == normalize(gate_map[f'G{n}']['gate_title']), f'Conflicting Stage Gate label: {value}')
            return n
        if re.fullmatch(r'G[0-5]', text(value)):
            return int(text(value)[1])
        n = integer(value, 'Stage Gate')
        require(0 <= n <= 5, 'Stage Gate must be 0 through 5')
        return n

    community_rows = m.records('Communities', fields=['Community ID', 'Community name'])
    communities = [{'id': integer(r['Community ID'], 'Community ID'), 'name': text(r['Community name'])} for r in community_rows]
    cm = unique(communities, 'id', 'Communities')
    require(all(c['name'] for c in communities), 'Empty community name')
    domains = [attrs(r) for r in m.records('Explorer_Domains')]
    dm = unique(domains, 'slug', 'Explorer_Domains')
    cluster_rows = m.records('Cluster_Domain_Map')
    clusters = unique(cluster_rows, 'Cluster', 'Cluster_Domain_Map')
    require(all(r['Domain slug'] in dm for r in cluster_rows), 'Unknown domain in cluster mapping')
    mechanisms = [attrs(r) for r in m.records('Enabling_Mechanisms')]
    mm = unique(mechanisms, 'key', 'Enabling_Mechanisms')

    raw_blockers = m.records('Blockers', fields=['ID','Code','Title','Blocker Statement','Cluster','Subcluster','Dimension','Why it matters','Consequence','Stage Gate','Stakeholders','Source','gate_id','Community ID','Criticality composite','Classification','Criticality source','Dependency analysis type','Dependency analysis source'])
    blockers, cat_blockers, analyses = [], [], []
    for r in raw_blockers:
        bid = integer(r['ID'], 'Blockers.ID')
        gid = parse_gate(r['Stage Gate'])
        require(gid is not None and r['gate_id'] == f'G{gid}', f'Blocker {bid}: inconsistent gate_id')
        cid = integer(r['Community ID'], f'Blocker {bid} community')
        require(cid in cm, f'Blocker {bid}: unknown community {cid}')
        require(r['Cluster'] in clusters, f'Blocker {bid}: cluster has no domain mapping')
        require(r['Dependency analysis type'] in ['Org','Tech'], f'Blocker {bid}: invalid dependency analysis type')
        require(text(r['Classification']) and text(r['Title']), f'Blocker {bid}: missing title/classification')
        score = number(r['Criticality composite'], f'Blocker {bid} criticality')
        common = {'id': bid, 'code': r['Code'], 'title': r['Title'], 'statement': r['Blocker Statement'], 'cluster': r['Cluster'], 'dimension': r['Dimension'], 'whyItMatters': r['Why it matters'], 'consequence': r['Consequence'], 'stageGate': gid, 'stageGateDescription': gate_map[f'G{gid}']['gate_title'], 'stakeholders': parts(r['Stakeholders']), 'source': r['Source'], 'domain': clusters[r['Cluster']]['Domain slug'], 'communityId': cid, 'communityName': cm[cid]['name'], 'criticalityComposite': score, 'classification': r['Classification'], 'dependencyAnalysisType': r['Dependency analysis type'], 'criticalitySource': r['Criticality source'], 'dependencyAnalysisSource': r['Dependency analysis source']}
        blockers.append(common)
        analysis = {'blocker_id': bid, 'blocker_label': r['Subcluster'], 'community': cm[cid]['name'], 'community_id': cid, 'state': r['Classification'], 'type': r['Dependency analysis type'], 'criticality_composite': score, 'source': origin('Blockers',r), 'source_attributes': {'Node ID': bid, 'Blocker': r['Subcluster'], 'Community': cm[cid]['name'], 'State': r['Classification'], 'Type': r['Dependency analysis type']}}
        analyses.append(analysis)
        cat_blockers.append({'blocker_id':bid,'code':r['Code'],'title':r['Title'],'statement':r['Blocker Statement'],'cluster':r['Cluster'],'cluster_id':'cluster:'+digest([r['Dimension'],r['Cluster']])[7:],'dimension':r['Dimension'],'subcluster':r['Subcluster'],'why_it_matters':r['Why it matters'],'consequence':r['Consequence'],'stage_gate':r['Stage Gate'],'stakeholders':r['Stakeholders'],'source_reference':r['Source'],'source':origin('Blockers',r),'source_attributes':attrs(r),'dependency_analysis':analysis})
    bm = unique(blockers,'id','Blockers')

    enablers, cat_enablers = [], []
    for r in m.records('Enablers', fields=['enabler_id','enabler_title','Cluster','enabler_description','practical_actions','expected_outcome','stakeholders','Stage Gate']):
        eid = integer(r['enabler_id'],'Enablers.enabler_id'); gid = parse_gate(r['Stage Gate'])
        enablers.append({'id':eid,'title':r['enabler_title'],'cluster':r['Cluster'],'description':r['enabler_description'],'practicalActions':r['practical_actions'],'expectedOutcome':r['expected_outcome'],'stageGate':gid,'stageGateDescription':gate_map[f'G{gid}']['gate_title'] if gid is not None else None,'stakeholders':parts(r['stakeholders'])})
        cat_enablers.append({'enabler_id':eid,'enabler_title':r['enabler_title'],'cluster':r['Cluster'],'enabler_description':r['enabler_description'],'practical_actions':r['practical_actions'],'expected_outcome':r['expected_outcome'],'stage_gate':r['Stage Gate'],'stakeholders':r['stakeholders'],'source':origin('Enablers',r),'source_attributes':attrs(r)})
    em = unique(enablers,'id','Enablers')
    edges, cat_edges = [], []
    for r in m.records('Blocker_Dependency_map', fields=['relationship_id','blocker_id','Dependens_on_blocker_id','dependency_importance','review_status']):
        rid,bid,dep = [integer(r[k],f'Dependency {k}') for k in ['relationship_id','blocker_id','Dependens_on_blocker_id']]
        require(bid in bm and dep in bm and bid != dep, f'Dependency {rid}: unknown endpoint or self-link')
        imp = None if r['dependency_importance'] is None else integer(r['dependency_importance'],f'Dependency {rid} importance')
        require(imp is None or 1 <= imp <= 4, f'Dependency {rid}: importance must be 1 through 4 or blank')
        require(text(r['review_status']), f'Dependency {rid}: missing review status')
        edges.append({'id':rid,'blockerId':bid,'dependsOnBlockerId':dep,'dependencyImportance':imp,'reviewStatus':r['review_status']})
        cat_edges.append({'relationship_id':rid,'blocker_id':bid,'depends_on_blocker_id':dep,'dependency_importance':imp,'review_status':r['review_status'],'direction':'blocker_id_depends_on_depends_on_blocker_id','source':origin('Blocker_Dependency_map',r),'source_attributes':attrs(r)})
    unique(edges,'id','Blocker_Dependency_map')
    require(len({(e['blockerId'],e['dependsOnBlockerId']) for e in edges}) == len(edges), 'Duplicate dependency pairs')

    relationships, cat_relationships = [], []
    for r in m.records('Enablers_Dependency_Map', fields=['relationship_id','blocker_id','enabler_id','relationship_type','relationship_strength','rationale','Attribute','Attribute description']):
        rid,bid,eid = [integer(r[k],k) for k in ['relationship_id','blocker_id','enabler_id']]
        require(bid in bm and eid in em, f'Relationship {rid}: unknown blocker or enabler')
        require(r['Attribute'] in mm and r['Attribute description'] == mm[r['Attribute']]['description'], f'Relationship {rid}: invalid mechanism or conflicting description')
        relationships.append({'id':rid,'blockerId':bid,'enablerId':eid,'mechanism':r['Attribute'],'rationale':r['rationale'],'relationshipType':r['relationship_type'],'relationshipStrength':r['relationship_strength']})
        cat_relationships.append({'relationship_id':rid,'blocker_id':bid,'enabler_id':eid,'attribute':r['Attribute'],'attribute_description':r['Attribute description'],'relationship_type':r['relationship_type'],'relationship_strength':r['relationship_strength'],'rationale':r['rationale'],'source':origin('Enablers_Dependency_Map',r),'source_attributes':attrs(r)})
    unique(relationships,'id','Enablers_Dependency_Map')
    require(len({(r['blockerId'],r['enablerId']) for r in relationships}) == len(relationships), 'Duplicate blocker-enabler pairs')
    detail, cycles = graph_analysis(bm,edges)
    for b in cat_blockers:
        bid=b['blocker_id']
        b['upstream_dependency_relationship_ids']=[e['id'] for e in edges if e['blockerId']==bid]
        b['downstream_impact_relationship_ids']=[e['id'] for e in edges if e['dependsOnBlockerId']==bid]
        b['enabler_relationship_ids']=[r['id'] for r in relationships if r['blockerId']==bid]

    questionnaires, mappings = [], []
    qfields=['Question ID','Question','Weight','0 — Absent','1 — Recognised','2 — Defined / tested locally','3 — Implemented','4 — Measured / sustained','Blocker IDs (primary keys)','Criteria to assess','Topic','Why this matters','What to consider','Evidence examples','When to use N/A','When to use Don’t Know']
    for sheet in ['Company_Expert','Project_Expert']:
        assessment,mode=sheet.lower().split('_')
        ws=m.wb[sheet]
        headers=[i for i,row in enumerate(ws.values,1) if row[0]=='Question ID' and row[1]=='Question']
        require(len(headers)==1,f'{sheet}: missing/ambiguous question header')
        records=m.records(sheet,header=headers[0],stop_blank=True,fields=qfields)
        qs=[]
        for r in records:
            ids=id_parts(r['Blocker IDs (primary keys)'],sheet)
            require(ids and set(ids)<=set(bm),f"{sheet} {r['Question ID']}: unknown/missing blocker")
            require(mode!='expert' or len(ids)==1,f'{sheet}: expert question must map to one blocker')
            require(ids[0] in criticality, f"{sheet} {r['Question ID']}: missing Dependency_Analysis for blocker {ids[0]}")
            score, classification = criticality[ids[0]]
            require(classification, f"{sheet} {r['Question ID']}: missing criticality classification for blocker {ids[0]}")
            weight=number(r['Weight'],f"{sheet} {r['Question ID']} weight")
            require(weight>=0,f'{sheet}: negative weight')
            q={'assessment_type':assessment,'mode':mode,'question_id':r['Question ID'],'text':r['Question'],'default_weight':weight,'blocker_ids':ids,'criteria':r['Criteria to assess'],'topic':r['Topic'],'source':origin(sheet,r),'why_this_matters':r['Why this matters'],'what_to_consider':r['What to consider'],'evidence_examples':r['Evidence examples'],'when_to_use_na':r['When to use N/A'],'when_to_use_dont_know':r['When to use Don’t Know']}
            q['criticality_composite'], q['criticality'] = score, classification
            for n,key in enumerate(qfields[3:8]):
                require(text(r[key]),f"{sheet} {r['Question ID']}: missing rubric {n}")
                q[f'rubric_{n}']=r[key]
            require(text(q['text']),f'{sheet}: missing question text')
            qs.append(q)
        unique(qs,'question_id',sheet)
        coverage=Counter(i for q in qs for i in q['blocker_ids'])
        require(set(coverage)==set(bm) and all(n==1 for n in coverage.values()),f'{sheet}: each blocker must be mapped exactly once')
        version=digest(qs)
        trace_headers=[i for i,row in enumerate(ws.values,1) if row[0]=='Question ID' and len(row)>2 and row[2]=='Blocker ID']
        require(len(trace_headers)==1,f'{sheet}: missing traceability header')
        traces=m.records(sheet,header=trace_headers[0],fields=['Question ID','Blocker ID','Suggested evidence'])
        tm={}
        for t in traces:
            key=(t['Question ID'],integer(t['Blocker ID'],'Traceability Blocker ID'))
            require(key not in tm,f'{sheet}: duplicate traceability pair {key}')
            tm[key]=t
        expected={(q['question_id'],i) for q in qs for i in q['blocker_ids']}
        require(set(tm)==expected,f'{sheet}: traceability pairs differ from question mappings; update both sections')
        for q in qs:
            q['questionnaire_version']=version
            for bid in q['blocker_ids']:
                t=tm[(q['question_id'],bid)]
                mappings.append({'assessment_type':assessment,'mode':mode,'question_id':q['question_id'],'questionnaire_version':version,'blocker_id':bid,'allocated_weight':q['default_weight']/len(q['blocker_ids']),'suggested_evidence':t['Suggested evidence'],'evidence_source':origin(sheet,t)})
        questionnaires.append({'assessment_type':assessment,'mode':mode,'questionnaire_version':version,'published_at':None,'questions':qs,'source_sheet':sheet})

        selected = sorted(qs, key=lambda q: (q['criticality_composite'], q['blocker_ids'][0], q['question_id']))[:15]
        quick_questions = [{**q, 'mode':'quick'} for q in selected]
        quick_version = digest(quick_questions)
        for q in quick_questions:
            q['questionnaire_version'] = quick_version
            original = next(x for x in mappings if x['assessment_type'] == assessment and x['mode'] == 'expert' and x['question_id'] == q['question_id'])
            mappings.append({**original, 'mode':'quick', 'questionnaire_version':quick_version})
        questionnaires.append({'assessment_type':assessment,'mode':'quick','questionnaire_version':quick_version,'published_at':None,'questions':quick_questions,'source_sheet':sheet})

    legacy=[]
    for r in m.records('Legacy_Readiness'):
        q=attrs(r)
        for key in ['dimensions','evidenceExamples']:
            q[key]=parts(q[key])
        q['sourceBlockerIds']=id_parts(q['sourceBlockerIds'],'Legacy_Readiness')
        require(set(q['sourceBlockerIds'])<=set(bm),'Legacy_Readiness: unknown blocker')
        q['provisionalStageGate']=integer(q['provisionalStageGate'],'Legacy provisional gate')
        require(0<=q['provisionalStageGate']<=5,'Legacy provisional gate outside 0..5')
        legacy.append(q)
    lm=unique(legacy,'id','Legacy_Readiness')
    legacy_maps=[attrs(r) for r in m.records('Legacy_Question_Blocker_Map')]
    pairs=set()
    for r in legacy_maps:
        bid=integer(r['blockerId'],'Legacy mapping blockerId');qid=r['questionId']
        require(bid in bm and qid in lm,'Legacy mapping: unknown endpoint')
        require(r['blockerCode']==bm[bid]['code'] and r['blockerTitle']==bm[bid]['title'],'Legacy mapping: stale blocker metadata')
        require(r['relationship'] in ['Direct','Contextual'],'Legacy mapping: invalid relationship')
        require((qid,bid) not in pairs,'Duplicate legacy mapping');pairs.add((qid,bid))
    require(all({r['blockerId'] for r in legacy_maps if r['questionId']==q['id'] and r['relationship']=='Direct'}==set(q['sourceBlockerIds']) for q in legacy),'Legacy question IDs and Direct mappings disagree')

    require(len(bm)==41 and len(em)==109 and len(relationships)==152,'Current website compatibility requires 41 blockers, 109 enablers and 152 enabler links; review the website contract before changing inventory')
    require([len(q['questions']) for q in questionnaires]==[41,15,41,15] and len(mappings)==112,'Current website questionnaire inventory changed')
    for d in domains:
        d['enabled']=any(b['domain']==d['slug'] for b in blockers)
    source={'workbook_name':m.path.name,'workbook_sha256':hashlib.sha256(m.path.read_bytes()).hexdigest(),'exporter_version':EXPORTER_VERSION}
    readiness={'schemaVersion':'1.0','gateAssignments':'Provisional - review per question','mappingSemantics':{'Direct':'Explicit assessment of the blocker issue; review status is separate.','Contextual':'Supporting context; does not diagnose or clear the blocker.'},'automaticBlockerClearance':False}
    explorer={'meta':{'title':'AI Scalability Explorer','schemaVersion':'3.1','sourceWorkbook':m.path.name,'sourceWorkbookSha256':source['workbook_sha256'],'exporterVersion':EXPORTER_VERSION,'internalIdsVisibleInUi':False,'relationshipTypeUsedInUi':False,'relationshipStrengthUsedInUi':False,'counts':{'blockers':len(blockers),'enablers':len(enablers),'relationships':len(relationships),'blockerDependencies':len(edges),'readinessQuestions':len(legacy),'questionBlockerMappings':len(legacy_maps)},'readiness':readiness},'stageGates':[{'id':g['gate_order'],'label':g['gate_title']} for g in gates],'mechanisms':mechanisms,'domains':domains,'blockers':blockers,'enablers':enablers,'relationships':relationships,'blockerDependencies':edges,'readinessQuestions':legacy,'questionBlockerMap':legacy_maps,'communities':communities,'dependencyGraphAnalysis':detail}
    cluster_groups={}
    for b in cat_blockers:
        item=cluster_groups.setdefault(b['cluster_id'],{'cluster_id':b['cluster_id'],'label':b['cluster'],'dimension':b['dimension'],'blocker_ids':[]})
        item['blocker_ids'].append(b['blocker_id'])
    catalog={'schema_version':'1.0.0','rules_version':EXPORTER_VERSION,'source':source,'assessment_instances':[],'blockers':cat_blockers,'enablers':cat_enablers,'blocker_dependencies':cat_edges,'blocker_enabler_relationships':cat_relationships,'dependency_analysis':analyses,'dependency_cycle_groups':cycles,'dependency_graph_analysis':detail,'clusters':list(cluster_groups.values()),'questionnaires':questionnaires,'question_blocker':mappings,'communities':communities,'blocker_community':[{'blocker_id':b['id'],'community_id':b['communityId'],'community':b['communityName']} for b in blockers],'community_candidates':[],'community_mapping_status':'defined_in_master_workbook','community_radar_available':True}
    catalog['counts']={'blockers':len(blockers),'enablers':len(enablers),'dependencies':len(edges),'blocker_enabler_relationships':len(relationships),'dependency_analysis':len(analyses),'cycle_groups':len(cycles),'clusters':len(cluster_groups),'questionnaires':len(questionnaires),'questions':sum(len(q['questions']) for q in questionnaires),'question_blocker':len(mappings),'rubrics':5*sum(len(q['questions']) for q in questionnaires)}
    catalog['maps_version']=digest(mappings)
    catalog['catalog_version']=digest(catalog)
    guidance={'sourceWorkbook':m.path.name,'sourceWorkbookSha256':source['workbook_sha256'],'stageGates':gates,'isoLines':iso}
    return {'explorer-data.json':explorer,'explorer_catalog.json':catalog,'stage-gate-guidance.json':guidance}
