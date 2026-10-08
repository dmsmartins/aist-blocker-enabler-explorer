# AIST Blocker & Enabler Explorer

Static GitHub Pages application for exploring AI scalability blockers, enablers, lifecycle Stage Gates and blocker dependencies.

## AI Project Readiness

Open Maturity Assessment → Assess my project, or `#project-readiness`.
The assessment reads `readinessQuestions` and `questionBlockerMap` from the live JSON.
Candidate questions and mappings retain their UIC review statuses and provisional gates.

Choose Yes, Partly, No, Not sure, or Not applicable. Yes needs recorded evidence;
N/A needs a reason. Responses, evidence, comments, planned actions, owners, target
dates and the current question save in this browser. Storage failure is reported;
download the assessment JSON for a backup. This is one local assessment per browser,
with no server submission, multi-user collaboration or cross-device sync.

The report lists all questions by provisional gate. Direct mappings create candidate
issues for reported gaps or missing evidence. For grouped questions, users may select
which Direct blocker issues need attention. Contextual mappings remain supporting
information and never create diagnoses or suggested actions. Suggested Enablers,
actions, mechanisms and relationship rationale come from the existing source links.
There is no overall score, automatic blocker clearance or gate approval. Recorded
evidence is self-reported, not verified. A changed question or mapping flags the saved
answer for review rather than retaining a healthy status.

Download the full assessment as JSON and the report as Markdown, or print / save PDF.
Starting a new assessment asks before replacing the current local answers. Assessment
JSON import is not included in this version. The company assessment remains separate.

Validation: `node --test --test-isolation=none readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs`.

## Current experience

- **Explore by Domain**
- **Explore by Stage Gate**
- **All Blockers**
- **All Enablers**, organised by enabling mechanism
- **Dependencies** tab with **By Blocker** and **By Stage Gate** views, importance filters and directional connections
- **Timeline**, a lightweight semantic-zoom experience:
  Stage Gate → blockers → dependency map → blocker detail → mechanisms → enablers
- **View for my role**
- **My Selection**
- **Play — Scale Run**, an abstract platformer using the same blockers and enablers across the six Stage Gates (see `play/README.md`)
- **Maturity Assessment**, with an illustrative company assessment and candidate **AI Project Readiness**

The interface deliberately uses progressive disclosure: the first view stays light and additional detail appears only as the user explores deeper.

## Data model

The live application reads:

```text
data/explorer-data.json
```

Current schema: **3.1**

It contains:

- `stageGates`
- `mechanisms`
- `domains`
- `blockers`
- `enablers`
- `relationships` (Blocker ↔ Enabler + enabling mechanism)
- `readinessQuestions` (grouped candidate questions, evidence guidance and UIC review status)
- `questionBlockerMap` (Direct/Contextual candidate mappings using source blocker IDs)
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

## Stage Gate dependency map

Open `#stage-dependencies` or choose Dependencies → By Stage Gate. Each directed connection aggregates blocker dependencies from the dependent gate to the gate it depends on. Line thickness represents the number of blocker dependencies; colour represents their highest importance. The importance 3–4 filter is applied to individual relationships before computing counts and colours.

Curves above the gates show dependencies on later stages; curves below show dependencies on earlier stages. Within-gate dependencies have selectable badges. Select a curve or use the keyboard-accessible connection list to inspect every underlying blocker pair. Selecting a gate focuses its incoming and outgoing connections. Unknown gate assignments are omitted and counted explicitly.

A dependency on a later stage is not automatically an error or a requirement to complete that entire stage first. The panel describes possible interpretations and preserves access to blocker details.

Validation: `node --test --test-isolation=none stage-dependencies.test.mjs dependencies.test.mjs`.

