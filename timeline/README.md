# Spatial Timeline

This folder contains an isolated React + React Flow prototype of the AI Scalability Explorer.

This is the promoted visual Timeline used by the main Explorer navigation.

Live path on GitHub Pages:

```text
/timeline/
```

## What it demonstrates

- real canvas pan and zoom
- semantic zoom / progressive disclosure
- Stage Gate overview
- blockers revealed within a selected Stage Gate
- blocker-centred upstream/downstream dependency graph
- double-click blocker to open full detail
- mechanisms revealed as the next semantic layer
- enablers revealed by selected mechanism
- enabler details and relationship rationale
- breadcrumb navigation and reset/back controls

The prototype reads the existing shared dataset at `../data/explorer-data.json`, so production data is not duplicated.

## Technology

For rapid prototyping without changing the current build/deployment pipeline, this version uses browser ESM modules:

- React 18
- React DOM
- React Flow / XYFlow
- HTM for JSX-like templates without a bundler

If this interaction model is approved, the next engineering step is to move the same component model into a conventional Vite build and, if desired, a separate repository.
# Stage Gate guidance

Expand a Stage Gate, then use **+ Guidance** to open its guidance. The panel uses
the blocker inspector's visual style and leaves the timeline selection and
assessment state unchanged. Close it with × or Escape; focus returns to Guidance.
Missing guidance is reported inside the panel without blocking the timeline.

`../data/stage-gate-guidance.json` is exported from `Stage_Gates` and `ISO_Lines`
in the integrated workbook. It also loads in questionnaire timelines, independently
of their saved assessment snapshot. Numeric timeline IDs map to stable `G0`–`G5`
keys. ISO tokens remain unchanged; only `display_label` is shown to users.

Regenerate this supplemental data without replacing the live Explorer catalog:

```sh
python tools/export_stage_gate_guidance.py Blockers_Enablers_Integrated_Stage_Gates.xlsx data/stage-gate-guidance.json
node --test timeline/guidance.test.mjs
```
