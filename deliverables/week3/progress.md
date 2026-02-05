# Week 3 Progress Report

**Date:** February 4, 2026  
**Project:** NWM Streamflow Error Correction using Hydra Transformer

---

## Overview

This week focused on implementing advisor feedback, building a visualization dashboard, and running a comprehensive experiment suite across multiple study sites.

---

## Completed Tasks

### 1. Advisor Feedback Implementation

Implemented four key features based on advisor recommendations:

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Causal Masking** | Prevents future information leakage in transformer attention | `--use-causal-mask` flag in training script |
| **Direct Mode** | Predicts USGS streamflow directly instead of NWM residuals | `--target-mode direct` option |
| **Physics Constraint** | Non-negativity penalty to enforce physical plausibility | `--weight-nonneg 0.1` regularization |
| **Gradient Tracking** | Records layer-wise gradient norms for training diagnostics | `--track-gradients` with JSON output |

### 2. Visualization Dashboard

Built a complete Next.js 14 dashboard for visualizing experiment results:

**Tech Stack:**
- Next.js 14 with TypeScript and Tailwind CSS
- D3.js v7 for custom visualizations
- Recharts for bar charts
- Supabase integration (optional)

**Components Created:**
- `Hydrograph.tsx` - Time series of observed vs corrected streamflow
- `ErrorDistribution.tsx` - Histogram of prediction errors with KDE
- `GradientHeatmap.tsx` - Layer-wise gradient norms heatmap
- `MetricsBarChart.tsx` - Comparison of evaluation metrics

**Deployment:**
- ✅ Successfully deployed to Vercel
- ✅ Framework detection fixed with `vercel.json`
- 🔗 Live at: `hydra-nwm-streamflow-correction-*.vercel.app`

### 3. Experiment Suite Execution

**Configuration:**
- 5 experiment types × 4 study sites = 20 total experiments
- Training period: 2010-01-01 to 2017-12-31
- Validation period: 2018-01-01 to 2018-12-31
- Test period: 2019-01-01 to 2020-12-31

**Experiment Types:**
1. `baseline` - Current Hydra v2 model (GRU-Transformer hybrid)
2. `causal` - Transformer with causal attention masking
3. `direct` - Predict USGS directly (no NWM residual)
4. `physics` - Non-negativity penalty on streamflow
5. `combined` - Causal mask + physics constraint

**Study Sites:**
| Site ID | Name | Watershed | Type |
|---------|------|-----------|------|
| 03161000 | South Fork New River near Jefferson, NC | New River | Mid-basin |
| 03164000 | New River near Galax, VA | New River | Mainstem |
| 03479000 | Watauga River near Sugar Grove, NC | Watauga | Headwaters |
| 03486000 | Watauga River at Elizabethton, TN | Watauga | Regulated |

---

## Results (Site 03161000 - Completed)

### RMSE Improvement Summary

| Experiment | RMSE Improvement | NSE (Corrected) | KGE (Corrected) |
|------------|------------------|-----------------|-----------------|
| **Physics Constraint** | **21.5%** | 0.650 | 0.678 |
| Causal Mask | 14.7% | - | - |
| Direct Mode | 12.0% | - | - |
| Baseline | 7.8% | - | - |

**Key Finding:** The physics constraint (non-negativity penalty) shows the largest improvement, suggesting that enforcing physical plausibility is highly effective for error correction.

### Detailed Metrics (Physics Constraint)

| Metric | NWM Baseline | Corrected | Change |
|--------|--------------|-----------|--------|
| RMSE | 15.68 | 12.31 | -21.5% |
| MAE | 6.32 | 5.53 | -12.5% |
| NSE | 0.431 | 0.650 | +50.8% |
| KGE | 0.369 | 0.678 | +83.7% |
| PBIAS | -24.7% | -10.4% | +58.0% |
| Pearson r | 0.765 | 0.815 | +6.5% |

---

## In Progress

### Remaining Experiments (Sites 03164000, 03479000, 03486000)

- **Status:** Running successfully! ✅
- **Started:** Wed Feb 4 20:38:35 EST 2026
- **Monitor:** `tail -f logs/experiments_v2_stdout.log`

**Completed so far:**
| Experiment | Site | RMSE Improvement | Training Time |
|------------|------|------------------|---------------|
| baseline | 03164000 | 10.57% | 16.0 min |

**Currently running:** causal @ site 03164000

**Progress:**
- [x] baseline @ 03164000 (10.57% RMSE improvement)
- [ ] causal @ 03164000
- [ ] direct @ 03164000  
- [ ] physics @ 03164000
- [ ] combined @ 03164000
- [ ] all 5 experiments @ 03479000
- [ ] all 5 experiments @ 03486000

**Estimated total time:** ~4 hours (15 experiments × ~16 min each)

---

## Technical Issues Resolved

### Git Push Errors
- **Issue:** `pack-objects died of signal 10` bus errors
- **Solution:** Upgraded git from 2.29.2 to 2.52.0 via Homebrew, removed stale lock files

### Vercel 404 Errors
- **Issue:** "No framework detected" despite successful build
- **Solution:** Added `vercel.json` with explicit Next.js framework configuration

### Empty Experiment Logs
- **Issue:** Experiments for sites other than 03161000 had empty logs
- **Investigation:** Re-running with explicit logging to diagnose

---

## File Structure Updates

```
dashboard/
├── src/
│   ├── app/
│   │   └── page.tsx          # Main dashboard page
│   ├── components/
│   │   └── charts/
│   │       ├── Hydrograph.tsx
│   │       ├── ErrorDistribution.tsx
│   │       ├── GradientHeatmap.tsx
│   │       └── MetricsBarChart.tsx
│   └── lib/
│       └── data.ts           # Data fetching utilities
├── public/
│   └── data/
│       └── experiment_results.json
├── vercel.json               # Vercel deployment config
└── package.json
```

---

## Next Steps

1. **Complete remaining experiments** - Wait for sites 03164000, 03479000, 03486000
2. **Aggregate multi-site results** - Compare performance across watersheds
3. **Update dashboard** - Push new results after experiments complete
4. **Statistical analysis** - Bootstrap confidence intervals for metrics
5. **Thesis writing** - Document methodology and findings

---

## Commands Reference

```bash
# Monitor running experiments
tail -f logs/experiment_remaining_sites.log

# Check experiment status
ps aux | grep train_quick_transformer

# Export results to dashboard
python scripts/export_results_to_json.py

# Push updates to Vercel
git add -A && git commit -m "update results" && git push
```

---

## Repository

- **GitHub:** [hydra-nwm-streamflow-correction](https://github.com/Mitchel34/hydra-nwm-streamflow-correction)
- **Branch:** `feat/dashboard-experiments`
- **Dashboard:** Deployed on Vercel
