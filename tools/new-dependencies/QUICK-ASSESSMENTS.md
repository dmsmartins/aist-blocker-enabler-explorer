# Criticality-based questionnaires

Company and project quick assessments use the 15 expert questions associated with the lowest `Criticality composite` values in `Dependency_Analysis`. Ties are ordered by numeric blocker ID, then question ID. The `Criticality` classification is also exported with each question. No criticality columns are needed in the Expert sheets.

Update the Master workbook, then validate and export all datasets together:

```sh
python tools/new-dependencies/export_master.py path/to/master.xlsx --check-only
python tools/new-dependencies/export_master.py path/to/master.xlsx --output-dir output
```

Review the generated files and publish all three to `data/` together. The feedback service checks the current published catalogue version. Historic browser assessments retain their own catalogue snapshots.

Question-change suggestions are sent as optional question feedback and are included in the assessment JSON export. Respondents must download and share the JSON themselves; assessment answers are not automatically submitted to a central baseline.
