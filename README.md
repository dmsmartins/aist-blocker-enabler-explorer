# AIST Blocker & Enabler Explorer

Static GitHub Pages application for exploring AI scalability blockers, enablers, lifecycle Stage Gates and blocker dependencies.

## Current experience

- **Explore by Domain**
- **Explore by Stage Gate**
- **All Blockers**
- **All Enablers**, organised by enabling mechanism
- **Dependencies** tab with upstream/downstream navigation, importance filters and weighted, directional connections
- **Timeline**, a lightweight semantic-zoom experience:
  Stage Gate → blockers → dependency map → blocker detail → mechanisms → enablers
- **View for my role**
- **My Selection**
- **Play — Scale Run**, an abstract platformer using the same blockers and enablers across the six Stage Gates (see `play/README.md`)
- Illustrative **Maturity Assessment** placeholder

The interface deliberately uses progressive disclosure: the first view stays light and additional detail appears only as the user explores deeper.

## Data model

The live application reads:

```text
data/explorer-data.json
```

Current schema: **3.0**

It contains:

- `stageGates`
- `mechanisms`
- `domains`
- `blockers`
- `enablers`
- `relationships` (Blocker ↔ Enabler + enabling mechanism)
- `blockerDependencies` (Blocker → Blocker), including numeric `dependencyImportance` (1–4; higher values mean greater importance). Missing importance is shown as unspecified.

Internal blocker/enabler IDs are used for relationships but are not displayed in the UI.

## Excel → JSON workflow

The converter is stored at:

```text
tools/excel_to_explorer_json_v2.py
```

Typical workflow:

1. Update the Excel source.
2. Validate it:

```bash
python tools/excel_to_explorer_json_v2.py "Final_Blockers&Enablers_Explorer.xlsx" --check-only
```

3. Generate the live JSON:

```bash
python tools/excel_to_explorer_json_v2.py "Final_Blockers&Enablers_Explorer.xlsx" "explorer-data.json"
```

4. Replace `data/explorer-data.json` with the generated file.
5. Commit and push to `main`.
6. GitHub Pages updates automatically.

## Main source tables

The converter currently expects the workbook structure used by the Explorer, including:

- `Blockers`
- `Blocker_Dependency_map`
- `Enablers`
- `Enablers_Dependency_Map`

Both Blockers and Enablers include:

- `Stage Gate`
- `Stage Gate - Description` (optional; the converter uses its standard labels when a Stage Gate is populated)

The converter accepts both `dependency_importance` and the workbook spelling `depdencency_importance`. `Subcluster` is deliberately not exported. Importance describes a relationship, not a blocker score.

Text Stage Gates such as `Gate 0-Strategic Alignment & Idea Validation` are accepted. Excel and JSON both use Gate 0..5 with the names from the workbook; the description is validated against the matching lifecycle stage. Bare numeric inputs also use 0..5. Blank gates remain null.

## Local preview

Because the app loads JSON with `fetch()`, use a local web server rather than opening `index.html` directly.

### Python

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## GitHub Pages

The application is served from the repository root on the `main` branch.

Live site:

```text
https://dmsmartins.github.io/aist-blocker-enabler-explorer/
```
