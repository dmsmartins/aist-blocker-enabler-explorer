# Criticality-based questionnaires

Company and project quick assessments use the 15 expert questions associated with the lowest `Criticality composite` values in `Dependency_Analysis`. Ties are ordered by numeric blocker ID, then question ID. The `Criticality` classification is also exported with each question. No criticality columns are needed in the Expert sheets.

To update only questionnaire data while retaining the live catalogue's dependency graph:

```sh
python tools/new-dependencies/export_questionnaires.py path/to/master.xlsx data/explorer_catalog.json path/to/new-explorer-catalog.json
```

The exporter validates blocker identities, complete expert mappings and criticality values. Review the generated file before replacing `data/explorer_catalog.json`. It records the questionnaire workbook separately from the original catalogue source. Updating this catalogue changes its version: add that version to the feedback service's allowlist and deploy the service before releasing the Explorer. Historic browser assessments retain their own catalogue snapshots.

Question-change suggestions are sent as optional question feedback and are included in the assessment JSON export. Respondents must download and share the JSON themselves; assessment answers are not automatically submitted to a central baseline.
