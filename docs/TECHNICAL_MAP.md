# Explorer technical map (verified on main, 2026-10-25)

This is a navigation aid, not a full architecture audit. Search within the indicated file for the relevant function before reading it in full.

| Work area | Start here | Notes |
|---|---|---|
| Landing page, navigation, timeline and main UI | `index.html` | Contains inline CSS and scripts; avoid reading/replacing the whole file. Search by UI label or function. |
| Dependency logic | `dependencies.js` | Relationship importance and connections. |
| Stage Gate dependency view | `stage-dependencies.js` | Loaded by index.html; see stage-dependencies tests. |
| Project readiness assessment | `readiness.js`, `readiness.css` | Also `readiness.test.mjs`. |
| Validation and review UI | `validation.js`, `validation.css` | Also `validation.test.mjs`. |
| Live dataset | `data/explorer-data.json` | Schema 3.1 per README; generated output, not a manual editing target. |
| Excel-to-JSON conversion | `tools/excel_to_explorer_json_v2.py` | Python standard library; check source workbook before generation. |
| Scale Run | `play/README.md` | Consult this architecture guide before touching game files. |
| Legacy/other app entry | `app.js` | Contains a different data URL; do NOT assume it is the active entry point. Confirm HTML script references before modifying. |
| Project behavior and publishing | `README.md` | GitHub Pages serves root from main. |

## Quick navigation by request
- Landing/Timeline: inspect `index.html` targeted sections first; preserve navigation and styles.
- Dependencies: inspect `dependencies.js` or `stage-dependencies.js`, then corresponding tests.
- Assessment: inspect `readiness.js` and tests; preserve local browser persistence, evidence requirements, mapping semantics.
- Data/question changes: inspect workbook schema and converter first, then validate generated JSON and IDs.
- Game: read `play/README.md` first.

## Validation shortcuts
```bash
node --test --test-isolation=none readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs
python tools/excel_to_explorer_json_v2.py "Final_Blockers&Enablers_Explorer.xlsx" --check-only
python -m http.server 8000
```
The Python check requires the source workbook. The web preview requires a local HTTP server. These commands are documented, not claimed as executed.

## Important distinctions
- `index.html` loads `dependencies.js`, `stage-dependencies.js`, `validation.js` and `readiness.js` in its head.
- `app.js` references `aist_roadmap_data.json`, unlike the README's live `data/explorer-data.json`; investigate before using it.
- The Explorer is static. Multi-user project collaboration belongs to the separate Project & Stage Gate Tracker.
- On new branches, confirm this map is still current; update it only when architecture or paths actually change.
