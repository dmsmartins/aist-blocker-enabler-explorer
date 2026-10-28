# Spatial Timeline

This folder contains the shared React + React Flow canvas of the AI Scalability Explorer.

Both **Timeline** and **Communities** load this implementation and its styles.
Timeline starts with Stage Gates; Communities starts with the existing community
groups. Blocker cards, dependencies, the How to unlock inspector, mechanisms,
enablers, keyboard interaction, pan, zoom and fullscreen are shared.

Live path on GitHub Pages:

```text
/timeline/
/communities/
```

## What it demonstrates

- real canvas pan and zoom
- semantic zoom / progressive disclosure
- Stage Gate overview
- blockers revealed within a selected Stage Gate
- blocker-centred upstream/downstream dependency graph
- select a blocker to open **How to unlock** first
- mechanism buttons with blocker-specific enabler counts (only mechanisms with mapped enablers are shown)
- the blocker card itself opens or reopens details by click, Enter or Space, without an extra details button
- a sole available mechanism is selected automatically; otherwise choose one
- numbered enabler list synchronized with the cards below the central blocker
- direct connections and a legend use the selected mechanism's colour
- enabler details and relationship rationale
- breadcrumb navigation and reset/back controls
- collapsed Relations, Why it matters, Consequence if not addressed and Stakeholders
- expand Relations to emphasize incoming/outgoing dependencies and navigate to them
- shareable `#blocker=1323&mech=assure` links and browser Back/Forward
- Community + Stakeholder filters in Communities, Stage Gate + Stakeholder filters in Timeline
- source-based matching counts, with dependency context still available across groups
- solid validated dependencies and dashed unreviewed dependencies, with an Unreviewed links toggle

The collection filter and the canvas selection stay in sync. Role filters refine
the blocker list; a linked blocker outside that role clears the incompatible role
when opened. Reset clears filters and selection. No matching blockers is an
explicit empty state with a Clear filters action.
Assessment completion still considers all mapped blockers in the collection;
stakeholder filters refine displayed counts without turning a partial view into Done.

Collection and stakeholder filters are shareable, for example `#community=1`
or `#gate=0&role=Asset+management`. Both entry points accept the same blocker and
mechanism hashes. The alternate-view link preserves the active blocker, mechanism,
compatible stakeholder and assessment query. Communities are not presented as a
lifecycle sequence; Stage Gate progression and Guidance remain specific to Timeline.

The prototype reads the existing shared dataset at `../data/explorer-data.json`, so production data is not duplicated.

`unlock.mjs` groups the existing `relationships` by `blockerId` and `mechanism`,
resolving each `enablerId` against `enablers`. It retains the original enabler
content and relationship rationale. No schema, association or source data changes
are needed. Cards occupy a central band; dependency cards sit outside that band.
The canvas fits the blocker and all selected enablers within its available area
when the panel opens, a mechanism changes or the viewport is resized. Pan and
zoom remain manual between these changes. Dense views may need manual zoom to
read canvas cards; the full text is available in the panel.

Mechanism buttons support Tab and Enter/Space, including visible focus. Escape
closes the blocker panel and returns focus to the central blocker. Supplementary
sections reset closed on a different blocker. A closed panel remains closed when
revisiting its browser history entry; a freshly opened share link opens the panel.

Targeted checks:

```sh
node --test --test-isolation=none timeline/unlock.test.mjs timeline/explore.test.mjs timeline/guidance.test.mjs communities/zoom.test.mjs
```

Manual browser checks: select multi-mechanism and single-mechanism blockers;
compare counts to source relationships; switch mechanisms; select an enabler in
both places; expand Relations and follow a dependency; close with Escape; reopen
by clicking the blocker card or pressing Enter/Space on it; reload a share link
and use browser Back/Forward. Mechanisms with zero mapped enablers stay hidden.
Repeat in Communities, compare each group's members with source community IDs,
intersect the collection and stakeholder filters, and exercise an empty selection,
filter links, reload/history, the alternate-view link and fullscreen.
Check overview, all six Stage Gates, Guidance, canvas controls, pan/zoom, company
and questionnaire timeline filters. Repeat at desktop and narrow widths,
including a mechanism with seven enablers, and check the console for errors.

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
