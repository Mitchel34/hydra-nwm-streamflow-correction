# Hydra Public Dashboard

Public-facing companion dashboard for the Hydra streamflow-correction manuscript. The app explains
the evidence chain behind local National Water Model correction, input-source ablations, and the
completed ERA5-Land feature sweep.

## Current Focus

- **Findings**: Plain-English summary of gauge-informed correction, input-source attribution, ERA5
  results, and limitations.
- **ERA5 Evidence**: Native interactive charts generated from the completed 216-run ERA5 feature
  sweep.
- **Experiments**: Archived controlled experiment explorer with hydrographs and metric tables.
- **Model**: Concise residual-correction workflow without unsupported deployment claims.
- **Manuscript**: In-browser Phase 4 PDF reader and download link when
  `public/docs/hydra_phase4_manuscript.pdf` is available.

## Evidence Sources

- `public/data/experiment_results.json`
- `public/data/rigorous_eval.json`
- `public/data/era5_sweep.json`

Regenerate the ERA5 dashboard data from repository artifacts:

```bash
python3 scripts/export/export_era5_sweep_to_dashboard.py
```

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS
- Recharts and D3
- Optional Supabase fallback for legacy experiment results

## Development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
