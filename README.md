# AIST Blocker & Enabler Explorer

Static HTML explorer for the UIC AIST Blocker & Enabler roadmap.

## Files

```text
index.html
style.css
app.js
data/aist_roadmap_data.json
```

The file `data/aist_roadmap_data.json` should be generated from Excel using the R script.

## Local preview

Because the app loads JSON with `fetch()`, do not open `index.html` directly by double-clicking.

Use a local server:

### Option 1 — Python

```bash
cd aist_explorer_project
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

### Option 2 — VS Code

Install the Live Server extension and click **Go Live**.

## GitHub Pages deploy

1. Create a GitHub repository, for example:
   `aist-blocker-enabler-explorer`

2. Upload these files to the repository root:

```text
index.html
style.css
app.js
data/aist_roadmap_data.json
.nojekyll
```

3. In GitHub:
   - Go to **Settings**
   - Go to **Pages**
   - Under **Build and deployment**, choose **Deploy from a branch**
   - Branch: `main`
   - Folder: `/root`
   - Save

4. After GitHub publishes the site, open the Pages URL.

## Updating the roadmap

1. Update the Excel file.
2. Run the R script to regenerate `data/aist_roadmap_data.json`.
3. Replace the JSON file in GitHub.
4. Commit changes.
5. GitHub Pages updates automatically.
