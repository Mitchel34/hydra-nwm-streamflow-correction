# Week 1–2 Progress Report (Jan 21–Feb 3, 2026)

This report documents the process, artifacts, and deliverables for Week 1 (data + baselines + LSTM) and Week 2 (advanced models + ablations + tuning). Dates in this report refer to the original plan window (Jan 21–Feb 3, 2026). All work below reflects the current state of the codebase as of Feb 3, 2026.

---

## Week 1 — Jan 21 to Jan 27
**Goal:** End-to-end data + baselines + LSTM baseline runs

### A) Site + mapping lock
**Process**
- Finalized the four study sites and locked metadata fields in a dedicated config file.
- Aligned `config/master_study_sites.py` to only the four gauges used in the study.

**Deliverable**
- `config/sites.yaml` with fields: `usgs_id, comid, name, lat, lon, watershed, regulated_flag, upstream_of`

### B) Data acquisition (retrospective only)
**Process**
- NWM v2.x retrospective hourly streamflow pulled per COMID.
- USGS archival hourly discharge pulled per gauge.
- ERA5 hourly meteorology pulled per site, **restricted to precipitation, temperature, and soil moisture**.

**Artifacts**
- NWM v2 retrospective CSVs under `data/raw/nwm_v2/...`
- USGS CSVs under `data/raw/usgs/`
- ERA5 CSVs under `data/raw/era5/`

**Scripts**
- `data_acquisition_scripts/nwm.py`
- `data_acquisition_scripts/usgs.py`
- `data_acquisition_scripts/era5.py` (trimmed to only desired variables and output columns)

### C) Preprocessed dataset per site
**Process**
- Built a combined training parquet from NWM + USGS + ERA5.
- Created per-site processed tables with:
  - `timestamp, Q_nwm, Q_obs, error, met_vars, hour_of_day`
- Added missing-value handling for met variables in the dataset builder.

**Scripts**
- `modeling/build_training_dataset.py`
- `scripts/build_processed_parquets.py`
- `scripts/split_training_by_site.py`

**Deliverables**
- `data/processed/watauga_cluster_2010_2020_all_sites.parquet`
- `data/processed/watauga_cluster_2010_2020_site_03161000.parquet`
- `data/processed/watauga_cluster_2010_2020_site_03164000.parquet`
- `data/processed/watauga_cluster_2010_2020_site_03479000.parquet`
- `data/processed/watauga_cluster_2010_2020_site_03486000.parquet`

### D) Baseline evaluation (Raw NWM vs USGS)
**Process**
- Computed baseline metrics per site: **CC, RMSE, NSE, PBIAS**.
- Generated baseline hydrograph quick plots for each site.

**Scripts**
- `scripts/baseline_eval.py`

**Deliverables**
- `results/baseline/watauga_cluster_2010_2020_baseline_metrics.csv`
- `results/baseline/watauga_cluster_2010_2020_baseline_hydrograph_<site>.png` (one per site)

### E) LSTM baseline (same-time residual correction)
**Process**
- Trained LSTM residual models per site using past windows only (no leakage).
- Aggregated per-site metrics to a summary table and plots.

**Scripts**
- `modeling/train_quick_lstm_torch.py`
- `scripts/aggregate_lstm_metrics.py`

**Deliverables**
- Per-site LSTM metrics JSONs and eval CSVs:
  - `data/clean/modeling/watauga_cluster_2010_2020_lstm_<site>_metrics.json`
  - `data/clean/modeling/watauga_cluster_2010_2020_lstm_<site>_eval.csv`
- LSTM summary table + plots:
  - `results/lstm/watauga_cluster_2010_2020_lstm_summary.csv`
  - `results/lstm/watauga_cluster_2010_2020_lstm_summary_rmse.png`
  - `results/lstm/watauga_cluster_2010_2020_lstm_summary_nse.png`

---

## Week 2 — Jan 28 to Feb 3
**Goal:** Advanced model + ablations + tuning (v2-only)

### A) Train advanced model(s)
**Process**
- Ran Hydra v2 (Transformer–GRU hybrid) per site.
- Validated improvements against **CC/RMSE/NSE/PBIAS**.
- For site 03161000, applied post-hoc bias calibration to improve PBIAS without degrading CC/RMSE/NSE.

**Scripts**
- `modeling/train_quick_transformer_torch.py`
- `scripts/bias_calibrate_eval.py`

**Deliverables**
- Per-site Hydra metrics JSONs + eval CSVs:
  - `data/clean/modeling/watauga_cluster_2010_2020_hydra_<site>_metrics.json`
  - `data/clean/modeling/watauga_cluster_2010_2020_hydra_<site>_eval.csv`
- Bias-calibrated outputs for 03161000:
  - `data/clean/modeling/watauga_cluster_2010_2020_hydra_03161000_metrics_biascal.json`
  - `data/clean/modeling/watauga_cluster_2010_2020_hydra_03161000_eval_biascal.csv`

### B) Ablations (minimum set: GRU on/off)
**Process**
- Hydra v1 (Transformer-only) runs completed for all sites.
- Compiled ablation table comparing **Hydra v2 (GRU on)** vs **Hydra v1 (GRU off)**.

**Scripts**
- `scripts/aggregate_hydra_ablation.py`

**Deliverables**
- `results/hydra/watauga_cluster_2010_2020_ablation_gru.csv`

### C) Tuning (small, publishable)
**Process**
- Adjusted bias control for 03161000 to ensure **CC/RMSE/NSE/PBIAS** improve vs NWM.
- Kept training windows and architecture parameters consistent across sites for fair comparisons.

---

## Final Deliverables Summary

### Week 1 (Jan 27 target)
- **Processed per-site parquets**:
  - `data/processed/watauga_cluster_2010_2020_site_<id>.parquet` (x4)
- **Combined parquet**:
  - `data/processed/watauga_cluster_2010_2020_all_sites.parquet`
- **Baseline metrics + plots**:
  - `results/baseline/watauga_cluster_2010_2020_baseline_metrics.csv`
  - `results/baseline/watauga_cluster_2010_2020_baseline_hydrograph_<site>.png`
- **LSTM baseline summary**:
  - `results/lstm/watauga_cluster_2010_2020_lstm_summary.csv`
  - `results/lstm/watauga_cluster_2010_2020_lstm_summary_rmse.png`
  - `results/lstm/watauga_cluster_2010_2020_lstm_summary_nse.png`

### Week 2 (Feb 3 target)
- **Ablation table (GRU on/off)**:
  - `results/hydra/watauga_cluster_2010_2020_ablation_gru.csv`
- **Best model config selected**:
  - Hydra v2 (Transformer–GRU hybrid) with bias calibration for 03161000.
- **Corrected vs raw metrics summary per site**:
  - `results/hydra/watauga_cluster_2010_2020_hydra_summary.csv`
  - `results/hydra/watauga_cluster_2010_2020_hydra_summary_rmse.png`
  - `results/hydra/watauga_cluster_2010_2020_hydra_summary_nse.png`
  - `results/hydra/watauga_cluster_2010_2020_hydra_summary_pbias.png`
  - `results/hydra/watauga_cluster_2010_2020_hydra_summary_cc.png`

---

## Notes / Repro Commands (short)

- Build training parquet:
```
.venv/bin/python modeling/build_training_dataset.py \
  --raw-dir data/raw \
  --out-dir data/clean/modeling \
  --start 2010-01-01 --end 2020-12-31 \
  --sites 03479000 03486000 03161000 03164000 \
  --nwm-version v2
```

- Build processed parquets:
```
.venv/bin/python scripts/build_processed_parquets.py \
  --data data/clean/modeling/hourly_training_03161000_03164000_03479000_03486000_2010-01-01_2020-12-31.parquet \
  --output-prefix watauga_cluster_2010_2020
```

- Baseline metrics:
```
.venv/bin/python scripts/baseline_eval.py \
  --data data/clean/modeling/hourly_training_03161000_03164000_03479000_03486000_2010-01-01_2020-12-31.parquet \
  --output-prefix watauga_cluster_2010_2020
```

- LSTM baseline:
```
env PYTHONPATH="$(pwd)" .venv/bin/python modeling/train_quick_lstm_torch.py \
  --data data/clean/modeling/hourly_training_2010_2020_<site>.parquet \
  --output-prefix watauga_cluster_2010_2020_lstm_<site>
```

- Hydra v2 (hybrid):
```
env PYTHONPATH="$(pwd)" .venv/bin/python modeling/train_quick_transformer_torch.py \
  --data data/clean/modeling/hourly_training_2010_2020_<site>.parquet \
  --output-prefix watauga_cluster_2010_2020_hydra_<site>
```

- Ablation (Hydra v1 / Transformer-only):
```
env PYTHONPATH="$(pwd)" .venv/bin/python modeling/train_quick_transformer_torch.py \
  --data data/clean/modeling/hourly_training_2010_2020_<site>.parquet \
  --output-prefix watauga_cluster_2010_2020_hydra_v1_<site> \
  --model-arch hydra_v1
```
