#!/usr/bin/env python3
"""Convert the AIST Blocker & Enabler Excel workbook to Explorer JSON v2.

No third-party packages are required: the script reads .xlsx files directly with
Python's standard library (xlsx is a ZIP archive containing XML files).

Usage:
    python excel_to_explorer_json_v2.py "Final_Blockers&Enablers_Explorer.xlsx"
    python excel_to_explorer_json_v2.py input.xlsx explorer-data.json
    python excel_to_explorer_json_v2.py input.xlsx --check-only

Output schema (camelCase) is designed to be consumed directly by the GitHub
Pages Explorer, including Stage Gates and blocker-to-blocker dependencies.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path, PurePosixPath
from typing import Any, Dict, Iterable, List, Optional, Tuple
from xml.etree import ElementTree as ET


# ---------------------------------------------------------------------------
# Configuration / source-of-truth metadata
# ---------------------------------------------------------------------------

SCHEMA_VERSION = "2.0"

# Excel uses Stage Gates 1..6. These labels are also used when a gate has no
# blocker/enabler row yet (currently Gate 6 can legitimately be empty).
STAGE_GATES = {
    1: "Strategic Alignment & Idea Validation",
    2: "Solution Architecture & Feasibility",
    3: "Solution Build & Verification",
    4: "Operational Deployment & Commissioning",
    5: "Steady-State Operations & Evolution",
    6: "Retirement & Transition",
}

MECHANISM_ORDER = ["Frame", "Commit", "Equip", "Assure", "Operate", "Learn"]

DOMAINS = [
    {
        "slug": "data-foundations",
        "title": "Data Foundations",
        "description": "Data availability, quality, integration and governance.",
    },
    {
        "slug": "technology-infrastructure",
        "title": "Technology & Infrastructure",
        "description": "Platforms, compute, integration, performance and technical foundations.",
    },
    {
        "slug": "governance-organisation",
        "title": "Governance & Organisation",
        "description": "Vision, decision rights, ownership and operating models.",
    },
    {
        "slug": "people-adoption",
        "title": "People, Skills & Adoption",
        "description": "Skills, trust, change and organisational readiness.",
    },
    {
        "slug": "legal-safety-assurance",
        "title": "Legal, Safety & Assurance",
        "description": "Regulatory, legal, safety and assurance expectations.",
    },
    {
        "slug": "value-delivery-scale",
        "title": "Value, Delivery & Scale",
        "description": "Problem framing, value, readiness, delivery and progression.",
    },
]

# Explicit mapping avoids silently putting a new/renamed cluster in the wrong
# visual domain. If the Excel taxonomy changes, add/update the mapping here.
BLOCKER_CLUSTER_TO_DOMAIN = {
    "6) Data, Architecture, security & Sharing foundations (Organizational side.)": "data-foundations",
    "1) Data foundations, quality & access": "data-foundations",
    "2) IT architecture, infrastructure & stack readiness": "technology-infrastructure",
    "3) Integration with railway operations & enterprise systems": "technology-infrastructure",
    "5) Model performance, explainability & trust": "technology-infrastructure",
    "2) Vision, strategy & Decision making": "governance-organisation",
    "3) Ownership, Accountability & Operating model": "governance-organisation",
    "4) People, change & organisational readiness": "people-adoption",
    "5) Technology awareness & Solutioning capability": "people-adoption",
    "7) Legal, Safety, Compliance": "legal-safety-assurance",
    "7.1 Legal capability": "legal-safety-assurance",
    "7.2 Regulatory Uncertainty": "legal-safety-assurance",
    "1) Problem framing, value & business case": "value-delivery-scale",
    "8) Scaling Logic, Readiness Frameworks & Stage gates": "value-delivery-scale",
    "9) Delivery approach, MVP Focus & Timing constraints": "value-delivery-scale",
    "4) Model lifecycle & operationalisation": "value-delivery-scale",
}

SHEET_NAMES = {
    "blockers": "Blockers",
    "blocker_dependencies": "Blocker_Dependency_map",
    "enablers": "Enablers",
    "relationships": "Enablers_Dependency_Map",
}


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def norm_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def norm_header(value: Any) -> str:
    s = norm_text(value).lower()
    s = s.replace("&", "and")
    s = re.sub(r"[^a-z0-9]+", "_", s).strip("_")
    return s


def as_int(value: Any, field: str, allow_blank: bool = False) -> Optional[int]:
    if value is None or norm_text(value) == "":
        if allow_blank:
            return None
        raise ValueError(f"Missing integer value for {field}")
    if isinstance(value, bool):
        raise ValueError(f"Invalid boolean for integer field {field}: {value!r}")
    try:
        f = float(value)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid integer for {field}: {value!r}") from None
    if not f.is_integer():
        raise ValueError(f"Expected whole number for {field}, got {value!r}")
    return int(f)


def split_semicolon(value: Any) -> List[str]:
    s = norm_text(value)
    if not s:
        return []
    return [part.strip() for part in s.split(";") if part.strip()]


def unique_preserve(items: Iterable[str]) -> List[str]:
    seen = set()
    out = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def resolve_column(headers: List[str], aliases: Iterable[str], required: bool = True) -> Optional[int]:
    normalized = {norm_header(h): i for i, h in enumerate(headers)}
    for alias in aliases:
        key = norm_header(alias)
        if key in normalized:
            return normalized[key]
    if required:
        raise ValueError(
            f"Required column not found. Expected one of {list(aliases)!r}. "
            f"Available columns: {headers!r}"
        )
    return None


def row_value(row: List[Any], idx: Optional[int]) -> Any:
    if idx is None or idx >= len(row):
        return None
    return row[idx]


def clean_source(value: Any) -> Optional[str]:
    s = norm_text(value)
    return s or None


# ---------------------------------------------------------------------------
# Minimal XLSX reader (standard library only)
# ---------------------------------------------------------------------------

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKG_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"


def _xml_text(si: ET.Element) -> str:
    # shared strings can contain rich text runs; concatenate all <t> nodes.
    return "".join((t.text or "") for t in si.iter(f"{{{MAIN_NS}}}t"))


def _col_index(cell_ref: str) -> int:
    m = re.match(r"([A-Z]+)", cell_ref.upper())
    if not m:
        raise ValueError(f"Invalid Excel cell reference: {cell_ref!r}")
    n = 0
    for ch in m.group(1):
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def _numeric_value(text: Optional[str]) -> Any:
    if text is None or text == "":
        return None
    try:
        f = float(text)
    except ValueError:
        return text
    return int(f) if f.is_integer() else f


class XlsxReader:
    def __init__(self, path: Path):
        self.path = path
        self.zf = zipfile.ZipFile(path, "r")
        self.shared_strings = self._read_shared_strings()
        self.sheet_paths = self._read_sheet_paths()

    def close(self) -> None:
        self.zf.close()

    def __enter__(self) -> "XlsxReader":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        self.close()

    def _read_shared_strings(self) -> List[str]:
        name = "xl/sharedStrings.xml"
        if name not in self.zf.namelist():
            return []
        root = ET.fromstring(self.zf.read(name))
        return [_xml_text(si) for si in root.findall(f"{{{MAIN_NS}}}si")]

    def _read_sheet_paths(self) -> Dict[str, str]:
        workbook = ET.fromstring(self.zf.read("xl/workbook.xml"))
        rels = ET.fromstring(self.zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            rel.attrib["Id"]: rel.attrib["Target"]
            for rel in rels.findall(f"{{{PKG_REL_NS}}}Relationship")
        }
        out: Dict[str, str] = {}
        sheets = workbook.find(f"{{{MAIN_NS}}}sheets")
        if sheets is None:
            return out
        for sheet in sheets.findall(f"{{{MAIN_NS}}}sheet"):
            name = sheet.attrib["name"]
            rid = sheet.attrib[f"{{{REL_NS}}}id"]
            target = rel_map[rid]
            if target.startswith("/"):
                path = target.lstrip("/")
            else:
                path = str(PurePosixPath("xl") / target)
            # Normalize any ../ pieces.
            path = str(PurePosixPath(path))
            while "/../" in path:
                parts = []
                for p in path.split("/"):
                    if p == "..":
                        if parts:
                            parts.pop()
                    elif p != ".":
                        parts.append(p)
                path = "/".join(parts)
            out[name] = path
        return out

    def sheet_names(self) -> List[str]:
        return list(self.sheet_paths)

    def resolve_sheet_name(self, wanted: str) -> str:
        if wanted in self.sheet_paths:
            return wanted
        lookup = {norm_header(name): name for name in self.sheet_paths}
        key = norm_header(wanted)
        if key in lookup:
            return lookup[key]
        raise ValueError(f"Required sheet {wanted!r} not found. Available sheets: {self.sheet_names()!r}")

    def read_sheet(self, name: str) -> List[List[Any]]:
        actual = self.resolve_sheet_name(name)
        path = self.sheet_paths[actual]
        root = ET.fromstring(self.zf.read(path))
        sheet_data = root.find(f"{{{MAIN_NS}}}sheetData")
        if sheet_data is None:
            return []

        rows_out: List[List[Any]] = []
        max_col = -1
        sparse_rows: List[Dict[int, Any]] = []

        for row in sheet_data.findall(f"{{{MAIN_NS}}}row"):
            values: Dict[int, Any] = {}
            for c in row.findall(f"{{{MAIN_NS}}}c"):
                ref = c.attrib.get("r", "")
                col = _col_index(ref)
                max_col = max(max_col, col)
                cell_type = c.attrib.get("t", "n")
                v = c.find(f"{{{MAIN_NS}}}v")
                raw = v.text if v is not None else None

                if cell_type == "s":
                    value = self.shared_strings[int(raw)] if raw is not None else ""
                elif cell_type == "inlineStr":
                    is_el = c.find(f"{{{MAIN_NS}}}is")
                    value = _xml_text(is_el) if is_el is not None else ""
                elif cell_type == "str":
                    value = raw or ""
                elif cell_type == "b":
                    value = raw == "1"
                elif cell_type == "e":
                    value = raw or ""
                else:
                    value = _numeric_value(raw)
                values[col] = value
            sparse_rows.append(values)

        width = max_col + 1 if max_col >= 0 else 0
        for values in sparse_rows:
            rows_out.append([values.get(i) for i in range(width)])

        # Remove completely empty trailing rows/columns if any.
        while rows_out and not any(norm_text(v) for v in rows_out[-1]):
            rows_out.pop()
        if rows_out:
            last_used = 0
            for row in rows_out:
                for i, value in enumerate(row):
                    if norm_text(value):
                        last_used = max(last_used, i + 1)
            rows_out = [row[:last_used] for row in rows_out]
        return rows_out


# ---------------------------------------------------------------------------
# Graph utility for dependency diagnostics
# ---------------------------------------------------------------------------

def strongly_connected_components(nodes: Iterable[int], edges: Iterable[Tuple[int, int]]) -> List[List[int]]:
    graph: Dict[int, List[int]] = defaultdict(list)
    for a, b in edges:
        graph[a].append(b)

    index = 0
    stack: List[int] = []
    on_stack = set()
    indices: Dict[int, int] = {}
    low: Dict[int, int] = {}
    comps: List[List[int]] = []

    sys.setrecursionlimit(max(1000, len(list(nodes)) * 20 + 100))

    def visit(v: int) -> None:
        nonlocal index
        indices[v] = index
        low[v] = index
        index += 1
        stack.append(v)
        on_stack.add(v)

        for w in graph.get(v, []):
            if w not in indices:
                visit(w)
                low[v] = min(low[v], low[w])
            elif w in on_stack:
                low[v] = min(low[v], indices[w])

        if low[v] == indices[v]:
            comp: List[int] = []
            while True:
                w = stack.pop()
                on_stack.remove(w)
                comp.append(w)
                if w == v:
                    break
            comps.append(comp)

    nodes_list = list(nodes)
    for v in nodes_list:
        if v not in indices:
            visit(v)
    return comps


# ---------------------------------------------------------------------------
# Workbook conversion
# ---------------------------------------------------------------------------

def rows_from_sheet(reader: XlsxReader, sheet_name: str) -> Tuple[List[str], List[List[Any]]]:
    table = reader.read_sheet(sheet_name)
    if not table:
        raise ValueError(f"Sheet {sheet_name!r} is empty")
    headers = [norm_text(x) for x in table[0]]
    rows = [row for row in table[1:] if any(norm_text(v) for v in row)]
    return headers, rows


def validate_gate(gate_value: Any, desc_value: Any, context: str, warnings: List[str]) -> Tuple[Optional[int], Optional[str]]:
    gate = as_int(gate_value, f"{context} Stage Gate", allow_blank=True)
    desc = norm_text(desc_value) or None

    if gate is None:
        if desc:
            warnings.append(f"{context}: Stage Gate description is populated but Stage Gate is blank")
        return None, desc

    if gate not in STAGE_GATES:
        raise ValueError(f"{context}: Stage Gate must be 1..6, got {gate}")

    expected = STAGE_GATES[gate]
    if not desc:
        warnings.append(f"{context}: Stage Gate {gate} has no description; using {expected!r}")
        desc = expected
    elif norm_header(desc) != norm_header(expected):
        raise ValueError(
            f"{context}: Stage Gate {gate} description is {desc!r}, expected {expected!r}"
        )
    return gate, desc


def convert(input_path: Path) -> Tuple[Dict[str, Any], List[str], List[str]]:
    warnings: List[str] = []
    info: List[str] = []

    with XlsxReader(input_path) as reader:
        # ---- Blockers ------------------------------------------------------
        h, rows = rows_from_sheet(reader, SHEET_NAMES["blockers"])
        c_id = resolve_column(h, ["ID"])
        c_code = resolve_column(h, ["Code"], required=False)
        c_title = resolve_column(h, ["Title"])
        c_statement = resolve_column(h, ["Blocker Statement", "blocker_statement"])
        c_cluster = resolve_column(h, ["Cluster"])
        c_dimension = resolve_column(h, ["Dimension"])
        c_why = resolve_column(h, ["Why it matters", "why_it_matters"])
        c_consequence = resolve_column(h, ["Consequence"])
        c_gate = resolve_column(h, ["Stage Gate"])
        c_gate_desc = resolve_column(h, ["Stage Gate - Description", "Stage Gate Description"])
        c_stakeholders = resolve_column(h, ["Stakeholders"])
        c_source = resolve_column(h, ["Source"], required=False)

        blockers: List[Dict[str, Any]] = []
        blocker_ids: List[int] = []
        for excel_row, row in enumerate(rows, start=2):
            bid = as_int(row_value(row, c_id), f"Blockers row {excel_row} ID")
            blocker_ids.append(bid)
            cluster = norm_text(row_value(row, c_cluster))
            if cluster not in BLOCKER_CLUSTER_TO_DOMAIN:
                raise ValueError(
                    f"Blockers row {excel_row} (ID {bid}): cluster {cluster!r} has no macro-domain mapping. "
                    "Add it to BLOCKER_CLUSTER_TO_DOMAIN in the converter."
                )
            gate, gate_desc = validate_gate(
                row_value(row, c_gate), row_value(row, c_gate_desc), f"Blocker {bid}", warnings
            )
            blockers.append(
                {
                    "id": bid,
                    "code": norm_text(row_value(row, c_code)) or None,
                    "title": norm_text(row_value(row, c_title)),
                    "statement": norm_text(row_value(row, c_statement)),
                    "cluster": cluster,
                    "dimension": norm_text(row_value(row, c_dimension)),
                    "whyItMatters": norm_text(row_value(row, c_why)),
                    "consequence": norm_text(row_value(row, c_consequence)),
                    "stageGate": gate,
                    "stageGateDescription": gate_desc,
                    "stakeholders": split_semicolon(row_value(row, c_stakeholders)),
                    "source": clean_source(row_value(row, c_source)),
                    "domain": BLOCKER_CLUSTER_TO_DOMAIN[cluster],
                }
            )

        duplicate_blocker_ids = [x for x, n in Counter(blocker_ids).items() if n > 1]
        if duplicate_blocker_ids:
            raise ValueError(f"Duplicate blocker IDs: {duplicate_blocker_ids}")
        blocker_id_set = set(blocker_ids)

        # ---- Enablers ------------------------------------------------------
        h, rows = rows_from_sheet(reader, SHEET_NAMES["enablers"])
        c_eid = resolve_column(h, ["enabler_id", "Enabler ID"])
        c_etitle = resolve_column(h, ["enabler_title", "Enabler Title"])
        c_ecluster = resolve_column(h, ["Cluster"])
        c_edesc = resolve_column(h, ["enabler_description", "Enabler Description"])
        c_actions = resolve_column(h, ["practical_actions", "Practical Actions"])
        c_outcome = resolve_column(h, ["expected_outcome", "Expected Outcome"])
        c_estakeholders = resolve_column(h, ["stakeholders", "Stakeholders"])
        c_egate = resolve_column(h, ["Stage Gate"])
        c_egate_desc = resolve_column(h, ["Stage Gate - Description", "Stage Gate Description"])

        enablers: List[Dict[str, Any]] = []
        enabler_ids: List[int] = []
        for excel_row, row in enumerate(rows, start=2):
            eid = as_int(row_value(row, c_eid), f"Enablers row {excel_row} enabler_id")
            enabler_ids.append(eid)
            gate, gate_desc = validate_gate(
                row_value(row, c_egate), row_value(row, c_egate_desc), f"Enabler {eid}", warnings
            )
            enablers.append(
                {
                    "id": eid,
                    "title": norm_text(row_value(row, c_etitle)),
                    "cluster": norm_text(row_value(row, c_ecluster)),
                    "description": norm_text(row_value(row, c_edesc)),
                    "practicalActions": norm_text(row_value(row, c_actions)),
                    "expectedOutcome": norm_text(row_value(row, c_outcome)),
                    "stageGate": gate,
                    "stageGateDescription": gate_desc,
                    "stakeholders": split_semicolon(row_value(row, c_estakeholders)),
                }
            )

        duplicate_enabler_ids = [x for x, n in Counter(enabler_ids).items() if n > 1]
        if duplicate_enabler_ids:
            raise ValueError(f"Duplicate enabler IDs: {duplicate_enabler_ids}")
        enabler_id_set = set(enabler_ids)

        # ---- Blocker -> blocker dependencies ------------------------------
        h, rows = rows_from_sheet(reader, SHEET_NAMES["blocker_dependencies"])
        c_did = resolve_column(h, ["relationship_id", "Relationship ID"])
        c_db = resolve_column(h, ["blocker_id", "Blocker ID"])
        # Accept both the workbook's current typo and corrected future spellings.
        c_dep = resolve_column(
            h,
            [
                "Dependens_on_blocker_id",
                "depends_on_blocker_id",
                "Depends on blocker ID",
                "dependency_blocker_id",
            ],
        )

        blocker_dependencies: List[Dict[str, Any]] = []
        dep_ids: List[int] = []
        dep_pairs: List[Tuple[int, int]] = []
        for excel_row, row in enumerate(rows, start=2):
            rid = as_int(row_value(row, c_did), f"Blocker_Dependency_map row {excel_row} relationship_id")
            bid = as_int(row_value(row, c_db), f"Blocker_Dependency_map row {excel_row} blocker_id")
            depends_on = as_int(row_value(row, c_dep), f"Blocker_Dependency_map row {excel_row} depends_on_blocker_id")
            if bid not in blocker_id_set:
                raise ValueError(f"Dependency {rid}: blocker_id {bid} does not exist in Blockers")
            if depends_on not in blocker_id_set:
                raise ValueError(f"Dependency {rid}: dependsOnBlockerId {depends_on} does not exist in Blockers")
            if bid == depends_on:
                raise ValueError(f"Dependency {rid}: blocker {bid} cannot depend on itself")
            dep_ids.append(rid)
            dep_pairs.append((bid, depends_on))
            blocker_dependencies.append(
                {
                    "id": rid,
                    "blockerId": bid,
                    "dependsOnBlockerId": depends_on,
                }
            )

        dup_dep_ids = [x for x, n in Counter(dep_ids).items() if n > 1]
        if dup_dep_ids:
            raise ValueError(f"Duplicate blocker-dependency relationship IDs: {dup_dep_ids}")
        dup_dep_pairs = [x for x, n in Counter(dep_pairs).items() if n > 1]
        if dup_dep_pairs:
            raise ValueError(f"Duplicate blocker-dependency pairs: {dup_dep_pairs}")

        reciprocal = sorted(
            (a, b) for a, b in dep_pairs if a < b and (b, a) in set(dep_pairs)
        )
        sccs = strongly_connected_components(blocker_id_set, dep_pairs)
        cyclic_sccs = [c for c in sccs if len(c) > 1]
        if reciprocal:
            info.append(f"Dependency graph contains {len(reciprocal)} reciprocal blocker pairs (allowed).")
        if cyclic_sccs:
            info.append(
                "Dependency graph contains cycles (allowed). "
                f"Largest strongly connected component: {max(len(c) for c in cyclic_sccs)} blockers."
            )

        # ---- Blocker <-> Enabler relationships ----------------------------
        h, rows = rows_from_sheet(reader, SHEET_NAMES["relationships"])
        c_rid = resolve_column(h, ["relationship_id", "Relationship ID"])
        c_rb = resolve_column(h, ["blocker_id", "Blocker ID"])
        c_re = resolve_column(h, ["enabler_id", "Enabler ID"])
        c_rationale = resolve_column(h, ["rationale", "Rationale"])
        c_mech = resolve_column(h, ["Attribute", "mechanism", "Enabling Mechanism"])
        c_mech_desc = resolve_column(h, ["Attribute description", "mechanism_description", "Mechanism Description"])

        relationships: List[Dict[str, Any]] = []
        rel_ids: List[int] = []
        rel_pairs: List[Tuple[int, int]] = []
        mechanism_descriptions: Dict[str, str] = {}

        for excel_row, row in enumerate(rows, start=2):
            rid = as_int(row_value(row, c_rid), f"Enablers_Dependency_Map row {excel_row} relationship_id")
            bid = as_int(row_value(row, c_rb), f"Enablers_Dependency_Map row {excel_row} blocker_id")
            eid = as_int(row_value(row, c_re), f"Enablers_Dependency_Map row {excel_row} enabler_id")
            mechanism = norm_text(row_value(row, c_mech))
            mechanism_desc = norm_text(row_value(row, c_mech_desc))

            if bid not in blocker_id_set:
                raise ValueError(f"Relationship {rid}: blocker_id {bid} does not exist in Blockers")
            if eid not in enabler_id_set:
                raise ValueError(f"Relationship {rid}: enabler_id {eid} does not exist in Enablers")
            if mechanism not in MECHANISM_ORDER:
                raise ValueError(
                    f"Relationship {rid}: unknown mechanism {mechanism!r}. "
                    f"Expected one of {MECHANISM_ORDER!r}"
                )

            previous = mechanism_descriptions.get(mechanism)
            if previous is None:
                mechanism_descriptions[mechanism] = mechanism_desc
            elif norm_header(previous) != norm_header(mechanism_desc):
                raise ValueError(
                    f"Mechanism {mechanism!r} has inconsistent descriptions: {previous!r} vs {mechanism_desc!r}"
                )

            rel_ids.append(rid)
            rel_pairs.append((bid, eid))
            relationships.append(
                {
                    "id": rid,
                    "blockerId": bid,
                    "enablerId": eid,
                    "mechanism": mechanism,
                    "rationale": norm_text(row_value(row, c_rationale)),
                }
            )

        dup_rel_ids = [x for x, n in Counter(rel_ids).items() if n > 1]
        if dup_rel_ids:
            raise ValueError(f"Duplicate blocker-enabler relationship IDs: {dup_rel_ids}")
        dup_rel_pairs = [x for x, n in Counter(rel_pairs).items() if n > 1]
        if dup_rel_pairs:
            raise ValueError(f"Duplicate blocker-enabler pairs: {dup_rel_pairs}")

        # Mechanisms are always emitted in the intended UI order.
        mechanisms = [
            {
                "key": key,
                "description": mechanism_descriptions.get(key, ""),
            }
            for key in MECHANISM_ORDER
        ]
        missing_mechanisms = [m["key"] for m in mechanisms if not m["description"]]
        if missing_mechanisms:
            warnings.append(f"No description found for mechanisms: {missing_mechanisms}")

        # ---- Stage-gate and domain metadata -------------------------------
        stage_gates = [
            {"id": gate_id, "label": label}
            for gate_id, label in STAGE_GATES.items()
        ]

        domains = []
        blocker_domain_counts = Counter(b["domain"] for b in blockers)
        for d in DOMAINS:
            domains.append({**d, "enabled": blocker_domain_counts[d["slug"]] > 0})

        # Useful data-quality diagnostics, without blocking generation.
        linked_blocker_ids = {r["blockerId"] for r in relationships}
        linked_enabler_ids = {r["enablerId"] for r in relationships}
        orphan_blockers = sorted(blocker_id_set - linked_blocker_ids)
        orphan_enablers = sorted(enabler_id_set - linked_enabler_ids)
        if orphan_blockers:
            warnings.append(f"Blockers with no enabler relationship: {orphan_blockers}")
        if orphan_enablers:
            warnings.append(f"Enablers with no blocker relationship: {orphan_enablers}")

        empty_gate_blockers = Counter(b["stageGate"] for b in blockers if b["stageGate"] is not None)
        empty_gate_enablers = Counter(e["stageGate"] for e in enablers if e["stageGate"] is not None)
        for gate_id in STAGE_GATES:
            if empty_gate_blockers[gate_id] == 0 and empty_gate_enablers[gate_id] == 0:
                info.append(f"Stage Gate {gate_id} currently has no blockers or enablers.")

        data = {
            "meta": {
                "title": "AI Scalability Explorer",
                "schemaVersion": SCHEMA_VERSION,
                "sourceWorkbook": input_path.name,
                "internalIdsVisibleInUi": False,
                "relationshipTypeUsedInUi": False,
                "relationshipStrengthUsedInUi": False,
                "counts": {
                    "blockers": len(blockers),
                    "enablers": len(enablers),
                    "relationships": len(relationships),
                    "blockerDependencies": len(blocker_dependencies),
                },
            },
            "stageGates": stage_gates,
            "mechanisms": mechanisms,
            "domains": domains,
            "blockers": blockers,
            "enablers": enablers,
            "relationships": relationships,
            "blockerDependencies": blocker_dependencies,
        }

        return data, warnings, info


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert AIST Blocker & Enabler Excel workbook to Explorer JSON v2."
    )
    parser.add_argument("input", type=Path, help="Path to the source .xlsx workbook")
    parser.add_argument(
        "output",
        nargs="?",
        type=Path,
        default=Path("explorer-data.json"),
        help="Output JSON path (default: explorer-data.json)",
    )
    parser.add_argument(
        "--check-only",
        action="store_true",
        help="Validate the workbook but do not write JSON",
    )
    parser.add_argument(
        "--minify",
        action="store_true",
        help="Write compact JSON instead of pretty-printed JSON",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"ERROR: input file not found: {args.input}", file=sys.stderr)
        return 2
    if args.input.suffix.lower() != ".xlsx":
        print("ERROR: input must be an .xlsx file", file=sys.stderr)
        return 2

    try:
        data, warnings, info = convert(args.input)
    except (ValueError, KeyError, zipfile.BadZipFile, ET.ParseError) as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    counts = data["meta"]["counts"]
    print("Validation OK")
    print(f"  Blockers:             {counts['blockers']}")
    print(f"  Enablers:             {counts['enablers']}")
    print(f"  Blocker–Enabler rel.: {counts['relationships']}")
    print(f"  Blocker dependencies: {counts['blockerDependencies']}")

    gate_blockers = Counter(b["stageGate"] for b in data["blockers"])
    gate_enablers = Counter(e["stageGate"] for e in data["enablers"])
    print("  Stage Gates:")
    for gate in data["stageGates"]:
        gid = gate["id"]
        print(
            f"    {gid}: {gate['label']} | "
            f"{gate_blockers[gid]} blockers | {gate_enablers[gid]} enablers"
        )

    for msg in info:
        print(f"INFO: {msg}")
    for msg in warnings:
        print(f"WARNING: {msg}", file=sys.stderr)

    if args.check_only:
        print("Check-only mode: no JSON written.")
        return 0

    args.output.parent.mkdir(parents=True, exist_ok=True)
    if args.minify:
        text = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    else:
        text = json.dumps(data, ensure_ascii=False, indent=2)
    args.output.write_text(text + "\n", encoding="utf-8")
    print(f"JSON written to: {args.output.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())