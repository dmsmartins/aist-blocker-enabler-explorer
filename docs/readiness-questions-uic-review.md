# Candidate project readiness review

The supplied `Final_Blockers&Enablers_Explorer (5).xlsx` is now versioned at `data/Final_Blockers&Enablers_Explorer.xlsx`. It contains the four original sheets plus `Readiness_Questions` and `Question_Blocker_Map`. JSON schema 3.1 now includes the candidate readiness data. The UI behaviour is unchanged.

## Candidate content
- 26 English questions cover all 41 source blockers through 41 Direct and 4 Contextual draft mappings.
- Questions group blockers when a common assessment and evidence set is useful. Each component still needs separate evidence and gap recording.
- Every question and mapping starts as `Draft - UIC review`. Direct means the question explicitly assesses a blocker issue; it does not mean the mapping is validated. Contextual means supporting context, not a diagnosis.
- Stable question IDs use `RQ-<anchor numeric blocker ID>-01`. Keep the assigned ID when rewording or reordering. Do not derive new IDs from row positions or renumber existing IDs.
- The authoritative relationship key is the numeric Blocker ID. ID 3734 has no source code and stays blank.
- Dimension preserves all source dimensions for grouped questions. Lifecycle stage describes the proposed first review; source gate assignments for every mapped blocker remain visible.
- Provisional gates generally follow the earliest source gate in the group, with review at later mapped gates. The grouped scale/performance question first appears at Gate 2 and should be revisited at Gate 4. Operating model/handover first appears at Gate 3 and should be revisited at Gate 4.
- Blocker 1433 retains its source Gate 5 allocation; earlier lifecycle applicability is explicitly flagged for UIC review. Source blocker gates were not modified.
- No readiness scoring, automatic blocker clearance, validated mapping claims or new production JSON fields were introduced.

## UIC review
Confirm wording, grouping, applicability, evidence sufficiency, provisional gate assignments and each relationship separately. Record disagreements and reasons in Review_Comments. A positive grouped answer cannot clear all linked blockers automatically. Explain N/A decisions and partial readiness.

## Verification
The supplied workbook's 41 blocker IDs, codes, titles, statements and dimensions match the current repository JSON. Four original sheets preserve values, cell styles and native XML parts byte-for-byte. The original has zero formula cells. Only workbook registration, content types and an appended styles collection change among existing package parts; 24 original package parts remain byte-identical.

Workbook ZIP integrity, six sheet names, 26 unique question IDs, 45 unique question/blocker pairs, valid numeric blocker references, all 41 blockers covered, and draft statuses were checked. New sheets have Excel tables, filters, frozen headers and review-status validation lists; the relationship field allows Direct/Contextual. Both new sheets were visually inspected.

The repository converter check-only validation passes: 41 blockers, 109 enablers, 152 blocker/enabler relationships and 127 blocker dependencies. Existing cycles and reciprocal pairs are allowed by the converter. Validation used package inspection, independent workbook loading and the repository converter; native Microsoft Excel recalculation was not exercised.

## Updating source data later
Use the existing converter workflow with the versioned workbook:
```sh
python tools/excel_to_explorer_json_v2.py "data/Final_Blockers&Enablers_Explorer.xlsx" --check-only
```
The converter now exports the two candidate readiness sheets as readinessQuestions and questionBlockerMap in JSON schema 3.1. Rendering an assessment in the UI requires a separate application change. All review statuses and provisional gate assignments are preserved.

## Excel compatibility correction
The initial generated package rewrote XML namespace prefixes without preserving the prefix declarations used by markup-compatibility attributes. This revision preserves namespace declarations and validates every Ignorable and Choice Requires prefix in every XML part. The original sheets and their associated package parts remain byte-identical, and all content and converter checks pass again. Native Excel verification was attempted but could not complete: Excel COM startup failed and Computer Use access to Excel was not approved. Native Excel opening is therefore not claimed.

## Second compatibility revision
User screenshots confirmed that the first namespace correction still failed in native Excel. The two added sheets were rebuilt using openpyxl because the prior artifact export did not establish native Excel compatibility. The rebuilt sheet, table and validation parts were appended to the original package while keeping all four original worksheet XML parts, original table and related components byte-identical. Existing style entries remain at their original indices. The 26 questions and 45 mappings are unchanged. Namespace prefix checks, independent workbook loading, original cell values/styles, table counts and repository converter validation pass. Native Excel opening remains unverified because access was unavailable; the previous claim of a sufficient correction is superseded.

## JSON export validation
26 questions and 45 mappings (41 Direct, 4 Contextual) are exported. All seven existing Explorer data collections match the JSON currently on main exactly. Nine readiness converter tests cover grouped questions, blank blocker codes, legacy workbooks, missing paired sheets, duplicate IDs/mappings, unknown references, gate conflicts, invalid statuses/relationships, source-to-Direct consistency and stale blocker metadata.
