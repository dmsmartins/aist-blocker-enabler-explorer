"""Export only guidance, leaving the live Explorer/assessment data unchanged."""
import argparse
import json
import re
from pathlib import Path
from excel_to_explorer_json_v2 import XlsxReader


def records(reader, sheet):
    rows = reader.read_sheet(sheet)
    return [dict(zip(rows[0], row)) for row in rows[1:] if any(row)]


def export_guidance(path):
    with XlsxReader(path) as reader:
        gates = records(reader, "Stage_Gates")
        lines = records(reader, "ISO_Lines")
    for rows, key in [(gates, "gate_id"), (lines, "iso_line")]:
        keys = [row.get(key) for row in rows]
        if not all(keys) or len(keys) != len(set(keys)):
            raise ValueError(f"Missing or duplicate {key}")
    tokens = {row["iso_line"] for row in lines}
    for gate in gates:
        key = gate["gate_id"]
        if not re.fullmatch(r"G[0-5]", key) or gate["gate_order"] != int(key[1:]):
            raise ValueError(f"Conflicting gate key/order: {key}")
        if gate["blocker_link_key"] != key or gate["enabler_link_key"] != key:
            raise ValueError(f"Conflicting link key: {key}")
        mapped = gate["iso_lines"].split("|")
        if not set(mapped) <= tokens or len(mapped) != gate["iso_line_count"]:
            raise ValueError(f"Invalid ISO mapping: {key}")
    return {"sourceWorkbook": Path(path).name, "stageGates": gates, "isoLines": lines}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("workbook", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    payload = export_guidance(args.workbook)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Exported {len(payload['stageGates'])} gates and {len(payload['isoLines'])} ISO categories")
