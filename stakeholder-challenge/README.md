# Stakeholder Challenge — phase 2

Open `../stakeholder-challenge.html` through a local HTTP server. The root navigation includes **Review**, a simple hub linking to dependency review, stakeholder review and assessment question ratings. Assessment question review uses the existing questionnaire's **Rate this question** controls for relevance and clarity; it does not introduce another assessment or change scoring. The Stakeholder Challenge is a browser-only preview; there is no POST request, Worker integration, receipt, or claim that stakeholder votes have been collected.

## Preview

From the repository root:

```sh
python -m http.server 8000
```

Open `http://localhost:8000/stakeholder-challenge.html`. HTTPS or localhost is required for Web Crypto. Do not open the HTML directly with `file://`.

## Experience

The role order is shuffled once per session. Each NO advances to a different role; after all eleven rejections the participant can leave or explicitly restart. YES and SOMEWHAT both continue, with qualification retained in the draft and export. There are six unique blockers per session. Back, pause/resume, answer editing, review, local completion and JSON download are supported.

RESPONSIBLE, AFFECTED and CONTRIBUTOR can coexist. NOT_RELEVANT and NOT_SURE each replace every other selection. Selecting an ordinary relationship clears either exclusive option. Every blocker needs at least one selection. The explanation follows Q03's `required` and `max_length` configuration.

The storage key `aist-stakeholder-challenge-preview-v1` is separate from existing assessments and dependency voting. Storage failures are shown. Changed datasets or invalid drafts offer a raw draft download before replacement. A new session asks before replacing the prior draft. Concurrent editing in multiple tabs is not synchronised; use one tab per draft. Exported files are marked `is_test: true`, `submitted: false` and `submission_status: not_submitted`; they are not production vote records or trusted assignments.

## Data and selection

`data/explorer-data.json` remains unchanged and supplies all blocker cards. Its numeric internal `id` is preserved in exports; no new blocker IDs are invented. `data/stakeholder-challenge.json` supplies roles and questions. Role-to-blocker matching uses exact `Stakeholder_Name` membership in the Explorer's `stakeholders` arrays. The mapping is validated at load; all eleven names match the current dataset. Do not silently rename roles in one dataset only.

Selection aims for three linked and three unlinked blockers. If a pool is too small, fill from the remaining blockers without replacement. Five roles are linked to all 41 blockers, so all six selected blockers are necessarily existing links for those roles. Within each pool, shuffled candidates from unused Stage Gates are preferred; the pool priority and final order are also shuffled. Existing link status, priorities, counts and other stakeholders are hidden in the voting interface. These data remain public in the Explorer: this is interface blinding, not access control. Selection is not weighted by prior votes in phase 2.

The local draft pins both the challenge `dataset_version` and a SHA-256 of the parsed Explorer JSON serialized with `JSON.stringify`. Changing either dataset requires a fresh session. Draft IDs and qualification history are preserved across reloads; no server trust is implied.

## Source correction and regeneration

The phase-2 source workbook copy `AIST_Explorer_Master_Stakeholder_Roles_Phase2.xlsx` changes only `Challenge_Questions!H10` from Yes to No, making Q03 optional. The original workbook was left untouched because it was open. Use that corrected copy for future generation, or apply the same cell correction to the authoritative source before regenerating. The corrected workbook is delivered separately, not committed to the public repository. All content remains Draft. The maximum explanation length remains unspecified (`null`).

```sh
python -m pip install openpyxl
python tools/generate_stakeholder_challenge.py /path/to/AIST_Explorer_Master_Stakeholder_Roles_Phase2.xlsx --output data/stakeholder-challenge.json
```

The generator requires Python 3.10+. It keeps existing IDs, validates repeated question metadata and response codes, rejects invalid cells, and writes the dedicated JSON atomically. Use `--check` to validate without writing. Do not hand-edit the generated JSON. The original Explorer converter and JSON are not changed.

## Verification

```sh
node --test --test-isolation=none stakeholder-challenge/model.test.mjs readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs
python tools/excel_to_explorer_json_v2.py /path/to/AIST_Explorer_Master_Stakeholder_Roles_Phase2.xlsx --check-only
```

30 Node tests passed: 10 challenge tests plus 20 existing tests. The existing Excel converter's check-only validation passed. Browser checks in isolated Edge covered keyboard start, role rejection/reassignment, required selections, multi-selection/exclusivity, refresh/resume, answer editing, HTML-safe explanations, completion/download, 390px layout, stale drafts, denied browser storage and failed data loading. No page errors or POST requests occurred during the complete test flow. Desktop and mobile screenshots were visually inspected.

## Phase 3 boundary

The private `dmsmartins/aist-dependency-votes` repository was inspected read-only. Existing `/session` and `/votes` endpoints store signed dependency assignments; `/question-feedback` stores a different versioned questionnaire payload. Do not send these preview exports to those endpoints. Phase 3 needs a separate stakeholder contract, server validation of role/blocker/question versions and exclusive codes, idempotent submission, separate records/analysis and optional coverage-aware assignment. Retain the existing endpoint contracts and the repository's private visibility. No infrastructure or vote records were changed here.
