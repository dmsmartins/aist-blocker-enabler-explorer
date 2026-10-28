# Explorer AI working rules (lean mode)

## Scope and safety
- This is a static GitHub Pages application. Preserve relative paths and existing functionality.
- Work on the requested feature branch; never merge into main without explicit approval.
- First inspect README.md and only the files directly relevant to the task. Do not scan or reproduce entire large files unless needed.
- Before edits, state a short plan and list affected paths. Prefer the smallest viable patch. Avoid unrelated refactoring.
- Treat the current data schema and IDs as contracts. Preserve blocker/enabler references, dependencies, gate mappings and review statuses.
- Data source of truth: Excel workbook -> tools/excel_to_explorer_json_v2.py -> data/explorer-data.json. Do not hand-edit generated JSON when source/converter should change.
- Keep the Explorer distinct from the planned Project & Stage Gate Tracker; do not introduce a multi-user backend into the static Explorer by accident.

## Verification
- Run targeted tests first. Existing documented baseline:
  node --test --test-isolation=none readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs
- For data changes, run converter --check-only against the available source workbook, and validate referential integrity.
- Report exactly which tests ran and whether they passed; never imply unexecuted tests passed.
- Prefer short diffs and concise summaries: files changed, behavioral impact, tests, remaining risks.

## Token discipline
- Search by filename/symbol before opening files; read bounded ranges where possible.
- Do not repeatedly fetch files already inspected unless changed.
- Do not paste whole HTML/JS/JSON files into chat; use commits/PRs and focused excerpts.
- Batch related independent reads; avoid repetitive repository-wide discovery.
- Ask only for decisions that change behavior, data contracts, publication, or architecture.
