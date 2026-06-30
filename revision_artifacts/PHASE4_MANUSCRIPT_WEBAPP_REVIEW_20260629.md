# Phase 4 Manuscript and Web App Review

Generated: 2026-06-29

## Manuscript Critique and Improvements

1. Main-text ERA5 evidence was discussed without the locked summary table adjacent to the claim.
   - Action: added `locks/table_era5_hydra_sweep_summary.tex` to the Phase 4 main manuscript immediately after the all-eligible/reduced feature-set result.

2. The distinction between exploratory diagnostics and confirmatory Hydra results needed to be more explicit for reviewers.
   - Action: added language stating that correlations and redundancy diagnostics are hypothesis-generating, while retrained Hydra sweeps provide confirmatory performance evidence.

3. The ERA5 feature eligibility count was hard-coded in prose.
   - Action: replaced the hard-coded count with `\LockERA5EligibleFeatureCount`.

4. Bias interpretation was too thin relative to the manuscript notes asking how biased the model remains.
   - Action: added a PBIAS interpretation tied to the locked ERA5 sweep summary table and noted that gauge-free ERA5 corrections remain negatively biased at all three sites.

5. Feature-importance wording risked becoming a single ranking across metrics.
   - Action: added Discussion text that KGE and PBIAS do not always move with RMSE, so feature choices should be interpreted by metric and as predictive sensitivity rather than causality.

## Web App Critique and Improvements

1. The dashboard manuscript page did not expose the updated Phase 4 source package when the PDF was unavailable.
   - Action: added a public source-bundle asset and manuscript metadata so visitors can still access the updated manuscript package without falling back to older PDFs.

2. The ERA5 page did not mirror the new main-text summary table closely enough.
   - Action: added a native all-eligible versus reduced feature-set summary table with RMSE reduction, KGE, PBIAS, and seed count.

3. ERA5 chart uncertainty was not visible even though the sweep summaries include seed spread/interval fields.
   - Action: added confidence-interval error bars to the all-eligible gauge-free performance chart.

4. The dashboard did not clearly surface the updated manuscript evidence change on the home page.
   - Action: updated manuscript calls to action to point to the Phase 4 package and explain that the public app tracks the Phase 4 evidence chain.

5. The dashboard needed stronger alignment with manuscript guardrails.
   - Action: tightened ERA5 and manuscript page language around predictive sensitivity, missing-feature exclusions, persistence limits, and source provenance.

## Evidence Sources Used

- `revision_artifacts/era5_feature_sweep/ERA5_HYDRA_SWEEP_CLAIM_GRAPH.md`
- `revision_artifacts/era5_feature_sweep/FULL_SWEEP_COMPLETION_AUDIT_20260628T231250Z.md`
- `revision_artifacts/era5_feature_sweep/tables/ERA5_HYDRA_SWEEP_SUMMARY.csv`
- `revision_artifacts/era5_feature_sweep/tables/ERA5_HYDRA_SWEEP_IMPACTS.csv`
- `dashboard/public/data/experiment_results.json`
- `dashboard/public/data/rigorous_eval.json`
- `dashboard/public/data/era5_sweep.json`

## Compile Status

- LaTeX compile could not be run locally because `latexmk`, `pdflatex`, and `tectonic` were not available on PATH.
- The Overleaf/source zip was rebuilt from the updated Phase 4 package.
- The public dashboard source bundle copy has the same SHA-256 checksum as the Overleaf zip.
- `npm run lint` passed with four pre-existing unused-variable warnings in untouched components.
- `npx tsc --noEmit --pretty false` passed.
- `npm run build` passed with Next.js 16.1.6.
- HTTP smoke checks returned 200 for `/era5`, `/manuscript`, `/data/manuscript_phase4.json`, and `/docs/wrr_phase4_era5_revision_20260629_overleaf.zip`; `/docs/hydra_phase4_manuscript.pdf` correctly returned 404 because no local LaTeX compiler produced the PDF.
