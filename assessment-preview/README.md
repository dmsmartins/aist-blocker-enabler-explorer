# Temporary questionnaire evaluation

Branch: `preview/questionnaires-2026-10-19`. Open `/assessment-preview/` or follow the new link from Maturity Assessment. This is an evaluation workspace for the end-of-week review; do not merge or deploy over the main GitHub Pages site automatically.

The catalogue is an exact copy of the user-supplied `explorer_catalog.json`, SHA-256 `287f46f20376c1fe32f0ad21c6ee901f6db71627a4deda85a1ffa2488aa76be4`.

## Included

- Company / Project × Quick / Expert, 16 / 41 / 16 / 41 questions, 570 full rubric texts, numeric blocker IDs and evidence examples.
- Scores 0–4, unknown, justified N/A, evidence, editable finite non-negative assessment weights and separate question-review comments.
- Independent saved drafts, frozen catalogue/questionnaire/maps, JSON export and restoration, feedback-only export, and printable report/PDF using the same calculation as the screen.
- Evidence-gated maturity, completion and exclusions; allocated-weight cluster and Stage Gate coverage; unique enabler recommendations with individual contributions and full source relationships.
- Original dependency and enabler maps in traceability. `Dependency_analysis` classifications remain distinct from closure; community radar stays unavailable pending resolution of the source/rules conflict.
- Quick Expert guides in the same scope and a separate blank Expert run for mixed applicability. No automatic transfer of answers or operational closure.

The legacy Explorer pages still read `data/explorer-data.json`. Only this preview reads the new consolidated catalogue. This avoids silently changing existing community assignments, timelines and saved assessments during a questionnaire-only evaluation. Full migration of those consumers and an operational review/closure workflow are separate integration work for review before merging.

## Storage and sharing

No backend submissions or shared answer database. Drafts use a separate localStorage namespace `aistQuestionnairePreviewV1`. Sharing the URL shares the questionnaire, not answers. Reviewers download the feedback JSON or full backup and send it through their normal channel. Browser quota or storage errors are shown, and a backup can still be downloaded. Historical drafts retain their catalogue; changed versions do not silently recalculate them.

## Run and validate

Serve the repository root with `python -m http.server 8000` and open `http://localhost:8000/assessment-preview/`.

```sh
node --test assessment-preview/model.test.mjs readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs
```

Before merging: collect wording feedback, resolve community taxonomy and classification differences, decide whether the new questionnaires replace the legacy prototypes, and review the scope of the full Explorer data migration. Merge is manual after evaluation; no automatic merge or scheduled production replacement is configured.
