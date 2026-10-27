# Temporary questionnaire evaluation

Open `/assessment-preview/`. The question review experience from 21 October is restored alongside the current Stage Gate guidance, communities and master-exported data.

The catalogue is the user-supplied explorer_catalog.json. Company / Project x Quick / Expert contain 16 / 41 / 16 / 41 questions.

Choose Company or Project, then Quick or Expert. Questions use a level 0–4 slider with question-specific examples. Context is collapsed under Why this matters, What to consider and Evidence examples. Don't Know records an information gap; N/A requires a reason when the catalogue provides applicability guidance. Current master exports and historical enriched question catalogues are supported without rewriting their data. Results can be named and reopened without creating duplicate assessments.

Rate this question offers optional, independent Relevance and Clarity stars (1–5). Ratings and anonymous ever-answered flags use the existing question-feedback service and separate browser storage `aistQuestionFeedbackV1`; they never change maturity scores. Only question IDs, the catalogue version, anonymous participant/assessment identifiers, ratings and an answered flag are sent. Names, maturity scores and notes remain in the browser. Failed requests remain pending with a Retry button. Feedback summaries remain in `dmsmartins/aist-dependency-votes/analysis/question-summary.csv`, grouped by catalogue version.

Results contain a six-axis Stage Gate radar, a personalised timeline link and a print/save-as-PDF report of recommended enablers, actions and outcomes. Missing scores remain blank; real zero scores remain zero. Recommendations are deduplicated and reflect answered gaps only.

This preview uses explicit self-reported scoring without evidence requirements. Historical evidence-based assessments remain preserved; reopening them creates a separate self-reported copy with catalogue weights. No score closes a blocker automatically. The original evidence-based model remains for historical records.

Drafts stay in this browser under aistQuestionnairePreviewV1. Timeline snapshots use sessionStorage aistQuestionnaireTimelineV1 and the consolidated catalogue. The legacy timeline and its assessment storage remain separate. Maturity answers are not submitted to a server or shared by sharing the URL; optional research ratings and question-use flags are shared as described above.

Serve the repository root with python -m http.server 8000 and open /assessment-preview/.

Tests (Node 24): node --test --test-isolation=none assessment-preview/model.test.mjs assessment-preview/views.test.mjs assessment-preview/feedback.test.mjs readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs timeline/guidance.test.mjs communities/zoom.test.mjs

Question wording, examples and mappings remain controlled by the master workbook export. New catalogue versions must also be enabled in the existing feedback service before collecting ratings.
