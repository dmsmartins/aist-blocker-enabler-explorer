# Stakeholder Challenge — persistence and validation

Open `stakeholder-challenge.html`, or Review → Stakeholders. Each questionnaire has **20 distinct blocker assessments** for one stakeholder, preceded by role qualification. NO offers another role; YES and SOMEWHAT continue, retaining the self-reported qualification. Each assessment supports multiple relationships and an optional explanation (maximum 500 characters). Not relevant and Not sure are exclusive.

The existing Cloudflare Worker issues signed 20-blocker assignments through `/stakeholder-session`. After review, Submit 20 assessments sends `/stakeholder-votes`. Only a matching server receipt displays success. Pending answers are locked after uncertain delivery; retrying sends the same payload and cannot create another record. Expired or invalid sessions can be exported before starting again. Confirmed submissions are immutable.

## Storage and privacy

Drafts use `aist-stakeholder-challenge-v1`; test mode adds `-test`. Anonymous browser IDs use `aist-stakeholder-participant-v1`. The earlier phase-2 preview key is untouched and its six-blocker drafts are not migrated or submitted. Browser storage failure is reported. Use one tab per draft; there is no cross-tab or cross-device synchronisation.

Submitted role, qualification history, 20 assessments and optional explanations go to the private votes repository under `stakeholder-sessions/`. No name or email is requested. Participants should avoid personal/confidential information. A receipt identifies the record. Test sessions (`?stakeholderTest=1`) use `test-stakeholder-sessions/` and are excluded from research results. Other exercises retain their existing endpoints and storage.

## Data and sampling

`data/stakeholder-challenge.json` and `data/explorer-data.json` remain unchanged. Existing IDs and exact stakeholder-name mappings are preserved. The browser pins the challenge version and a SHA-256 of `JSON.stringify` of the parsed Explorer dataset. The backend has its own matching catalogue snapshot, separate from dependency voting.

The server targets 10 linked and 10 unlinked blockers, fills from the remaining pool when necessary, prefers unused Stage Gates and shuffles the result. Five roles currently link to all 41 blockers, so their 20 assigned blockers necessarily come from existing links. Link status is hidden during assessment, though the underlying Explorer data is public. No coverage weighting is introduced in this release. Blockers may recur in a later questionnaire, but never within one questionnaire.

Q03 is optional in the phase-2 corrected source copy (`Challenge_Questions!H10 = No`). The workbook itself defines no text limit; the 500-character limit is an explicit service/UI transport rule. All role cards remain Draft. Regenerate only through `tools/generate_stakeholder_challenge.py`; do not hand-edit generated JSON. Coordinate any new dataset version with the backend snapshot before publication.

## Local validation

Serve the repository root with `python -m http.server 8000`. The production API accepts the published Explorer origin only. Local browser integration tests must mock the API or use the real Worker with an isolated in-memory GitHub store; they must not bypass production CORS.

Run `node --test --test-isolation=none stakeholder-challenge/model.test.mjs stakeholder-challenge/api.test.mjs readiness.test.mjs dependencies.test.mjs stage-dependencies.test.mjs validation.test.mjs assessment-preview/feedback.test.mjs`.

Publish the Worker first, verify `/health` reports 20 and the matching catalogue version, then publish the client. A live test submission must use test mode and its record must be verified in the private repository. Test duplicate submission returns the same receipt, and conflicting retries must fail.
