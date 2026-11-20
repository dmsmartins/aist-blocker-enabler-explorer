# Temporary new dependencies

This page uses `data/new-dependencies/explorer-data.json`, generated from the
updated AIST master workbook. The original Communities page and its data remain
unchanged. This is a comparison view, not a replacement for the live catalogue.

The source marks these dependencies as `reviewed`, not `Validated`. The page
displays them as reviewed in the source without claiming external validation.
The importance values were converted by the workbook owner from a 0–1 scale to
1–4. Interpret them according to the meaning of the original source measure.

To regenerate, use the consolidated master exporter in
`tools/new-dependencies/`. The export requires literal source values (not
formulas); save a working copy of the workbook with the dependency importance
results pasted as values, then run:

```sh
python tools/new-dependencies/export_master.py /path/to/workbook.xlsx --output-dir /path/to/output
```

Copy the generated `explorer-data.json` to
`data/new-dependencies/explorer-data.json`. The temporary exporter removes the
fixed count of 127 dependencies while retaining the other source checks.
`explorer_catalog.json` and `stage-gate-guidance.json` are not used by this
temporary page. The workbook itself is not included in the repository.
