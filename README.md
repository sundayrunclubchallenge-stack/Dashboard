# SRC 100 Day Challenge — Dashboard

Static 3-page dashboard (Overview / Teams / Individuals) that reads from `data/dashboard.json`.

## File map
```
index.html          Event Overview (hero + rankings + updates + team preview)
teams.html           Team Module (lane battle bars + drill-down member table)
individuals.html     Individual Module (search + profile + full sortable leaderboard)
assets/style.css     Design tokens + all component styles
assets/dashboard.js  Shared fetch/render helpers used by all 3 pages
data/dashboard.json  Sample data — replaced by the GitHub Action once live
apps-script-export-snippet.gs   Paste into your Dashboard workbook's Apps Script
.github/workflows/sync-dashboard.yml   Pulls fresh JSON every 15 min
```

## 1. Preview locally
Any static server works, e.g.:
```
npx serve .
```
The included sample `data/dashboard.json` renders immediately — check all 3 pages before wiring up live data.

## 2. Wire up the live data source
1. Open your Dashboard workbook → Extensions → Apps Script.
2. Add the contents of `apps-script-export-snippet.gs` (merge the `doGet` branch into your existing `doGet` if you already have one from the daily-log form).
3. Set `EVENT_START_DATE` and `EVENT_TOTAL_DAYS` to match your challenge.
4. Deploy → New deployment → Web app → "Anyone" access → copy the deployment URL.
5. Test it directly in a browser: `<your-webapp-url>?action=dashboardJson` should return JSON matching the shape in `data/dashboard.json`.

## 3. GitHub setup
1. Push this folder to a repo, enable GitHub Pages (serve from `main` / root).
2. Repo → Settings → Secrets and variables → Actions → New repository secret:
   - Name: `DASHBOARD_WEBAPP_URL`
   - Value: the Apps Script Web App URL from step 2 above
3. The workflow in `.github/workflows/sync-dashboard.yml` runs every 15 minutes, fetches fresh JSON, and commits it if changed. You can also trigger it manually from the Actions tab (`workflow_dispatch`).

## Extending later
- **New stat/metric**: add the field to `getDashboardJson()` in Apps Script, then read it in the relevant page's inline `<script>`. No changes needed to `dashboard.js`.
- **New team or new participant**: nothing to change — both pages loop over whatever's in the JSON.
- **New bonus type**: purely an Apps Script change (bonus engine) — the dashboard already just sums `bonus_points`, so no front-end change needed.
- **Styling changes**: everything is token-driven in `assets/style.css` under `:root` — change a color/font there and it propagates everywhere.
