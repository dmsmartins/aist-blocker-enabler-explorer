# Temporary questionnaire evaluation

Branch: `preview/questionnaires-2026-10-19`. Open `/assessment-preview/`. Merge remains manual after evaluation.

The catalogue is the user-supplied explorer_catalog.json. Company / Project x Quick / Expert contain 16 / 41 / 16 / 41 questions.

The simplified flow starts directly with questions and level 0-4, unknown or N/A choices. Metadata, evidence fields, weight editing, feedback and source details are hidden. Generic rubric paragraphs are omitted pending question-specific guides in the source workbook.

Results contain a six-axis Stage Gate radar, a personalised timeline link and a print/save-as-PDF report of recommended enablers, actions and outcomes. Missing scores remain blank; real zero scores remain zero. Recommendations are deduplicated and reflect answered gaps only.

This preview uses explicit self-reported scoring without evidence requirements. Historical evidence-based assessments remain preserved; reopening them creates a separate self-reported copy with catalogue weights. No score closes a blocker automatically. The original evidence-based model remains for historical records.

Drafts stay in this browser under aistQuestionnairePreviewV1. Timeline snapshots use sessionStorage aistQuestionnaireTimelineV1 and the consolidated catalogue. The legacy timeline and its assessment storage remain separate. No answers are submitted to a server or shared by sharing the URL.

Serve the repository root with python -m http.server 8000 and open /assessment-preview/.

Tests: node --test assessment-preview/model.test.mjs assessment-preview/views.test.mjs readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs

Before merging: evaluate the questions, author question-specific workbook guides and decide the scope of full Explorer migration. No automatic merge or production replacement is configured.
