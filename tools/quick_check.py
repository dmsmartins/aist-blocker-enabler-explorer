#!/usr/bin/env python3
"""Fast, read-only Explorer checks. Python standard library only."""
import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=pathlib.Path, default=ROOT)
    args = parser.parse_args()
    root = args.root.resolve()
    problems = []
    html_path = root / "index.html"
    data_path = root / "data/explorer-data.json"
    if not html_path.is_file():
        problems.append("Missing index.html")
    else:
        html = html_path.read_text(encoding="utf-8")
        assets = re.findall(r'<(?:script|link)\\b[^>]*?\\b(?:src|href)\\s*=\\s*["\']([^"\']+)', html, re.I)
        for asset in assets:
            path = asset.split("?", 1)[0].split("#", 1)[0]
            if not path or path.startswith(("http:", "https:", "//", "data:", "#")):
                continue
            candidate = (root / path.lstrip("/")).resolve()
            if not candidate.is_relative_to(root) or not candidate.is_file():
                problems.append(f"Missing local script/stylesheet: {asset}")
    if not data_path.is_file():
        problems.append("Missing data/explorer-data.json")
    else:
        try:
            data = json.loads(data_path.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                problems.append("Explorer JSON root must be an object")
            else:
                for field in ("stageGates", "blockers", "enablers", "relationships", "blockerDependencies"):
                    if field not in data or not isinstance(data[field], list):
                        problems.append(f"Missing or non-list JSON collection: {field}")
        except (ValueError, UnicodeError) as exc:
            problems.append(f"Invalid Explorer JSON: {exc}")
    if problems:
        for item in problems:
            print("FAIL:", item)
        return 1
    print("PASS: local HTML asset references and JSON structure")
    return 0

if __name__ == "__main__":
    sys.exit(main())
