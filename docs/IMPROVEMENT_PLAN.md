# Hydra System Improvement Plan — Appalachian Unregulated Sites

**Date:** February 7, 2026  
**Scope:** 3 unregulated sites (03161000 Jefferson NC, 03164000 Galax VA, 03479000 Sugar Grove NC)  
**Goal:** Substantial RMSE/NSE gains + WRR-quality visualizations for publication & dashboard

---

## Current Performance Baseline (Best per Site)

| Site | Best Config | RMSE Δ% | NSE (baseline → corrected) | KGE (baseline → corrected) |
|------|------------|---------|---------------------------|---------------------------|
| 03161000 Jefferson | Physics | **+21.5%** | 0.431 → 0.650 | 0.369 → 0.678 |
| 03164000 Galax | Causal | **+21.3%** | 0.268 → 0.547 | 0.473 → 0.683 |
| 03479000 Sugar Grove | Direct | **+5.8%** | 0.617 → 0.661 | 0.682 → 0.694 |

**Key observation:** Sugar Grove already has high baseline NSE (0.617) and KGE (0.682). NWM does well here, so the correctable error margin is small. Jefferson and Galax have much more room — NWM is weakest at these larger/mid-basin sites.

---

## Part A — Model Architecture Improvements

### A1. Flow-Regime-Aware Multi-Scale Attention (HIGH IMPACT)

**Problem:** The current Hydra v2 uses fixed dilated convolutions (dilation 1, 3, 6) applied uniformly. These don't explicitly separate base-flow vs. storm-event temporal scales, yet NWM errors are highly regime-dependent (large negative bias during peaks at Jefferson/Galax, ~−25% PBIAS).

**Proposed change in `hydra_temporal.py`:**
- Replace the fixed `scale_convs` with a **Temporal Cross-Scale Attention** block:
  - **Short-range branch** (dilation 1–2, kernel 3): captures rapid storm response (1–6h)
  - **Mid-range branch** (dilation 4–8, kernel 5): captures rising/falling limbs (6–48h)
  - **Long-range branch** (dilation 12–24, kernel 7): captures antecedent moisture / recession (2–7d)
- Add a **gated fusion** (softmax-weighted sum) to let the model learn which scale matters per sample
- This directly targets the PBIAS problem: the model can attend more heavily to mid/long-range moisture state when correcting peak underestimation

**Implementation effort:** Medium (modify `HydraTemporalModel.__init__` and `forward`)  
**Expected gain:** 3–8% additional RMSE reduction at Jefferson/Galax where peak errors dominate

### A2. Precipitation-Aware Feature Gating (HIGH IMPACT)

**Problem:** ERA5 precipitation (`precip_mm`) enters the model as just another normalized feature, treated equally to temperature or DOY. But precipitation timing/intensity is THE primary driver of NWM error — when NWM under-routes a rain event, the error spikes. The model has no mechanism to "pay extra attention" during rain events.

**Proposed change:**
- Add a **Feature Importance Gate** (FIG) before the GRU in `hydra_temporal.py`:
  ```python
  class FeatureImportanceGate(nn.Module):
      def __init__(self, input_dim, d_model):
          self.gate = nn.Sequential(
              nn.Linear(input_dim, d_model),
              nn.GELU(),
              nn.Linear(d_model, input_dim),
              nn.Sigmoid()
          )
      def forward(self, x):
          return x * self.gate(x)
  ```
- Insert between `input_norm` and `pre_gru` — lets the model learn to upweight precip/soil-moisture when they deviate from climatology

**Implementation effort:** Low  
**Expected gain:** 2–5% RMSE reduction; significant PBIAS improvement at high flows

### A3. Event-Stratified Training Sampler (MEDIUM IMPACT)

**Problem:** The current `SeqDataset` samples sequences uniformly. In a 10-year hourly dataset, >90% of timesteps are low-flow/baseflow. The model is optimized for the easy majority case but under-learns the hard rain-event correction. The existing `flow_emphasis` weight only partially addresses this — it reweights losses but doesn't change sampling frequency.

**Proposed change in `train_quick_transformer_torch.py`:**
- Add a `WeightedRandomSampler` that oversamples sequences containing high-flow events (e.g., top 10th percentile) by 3–5×
- Combine with the existing `flow_emphasis` loss weighting for a two-pronged approach
- Can be toggled via `--event-oversample-factor 3`

**Implementation effort:** Low (sampler only, no model change)  
**Expected gain:** 2–4% RMSE reduction on peak events; better NSE at Jefferson (peak misses dominate NSE)

### A4. Learnable Residual Bias per Flow Regime (MEDIUM IMPACT)

**Problem:** The current model has a single scalar `residual_bias = -0.15`. But NWM systematic bias differs by flow regime: NWM tends to under-predict peaks and over-predict recessions. A single bias can't fix both.

**Proposed change:**
- Replace the scalar `residual_bias` with a small regime-conditioned bias:
  ```python
  self.regime_bias = nn.Sequential(
      nn.Linear(d_model, d_model // 4),
      nn.GELU(),
      nn.Linear(d_model // 4, 1)
  )
  ```
- Feed `fused` representation into `regime_bias` instead of using a fixed scalar
- The post-training `bias_shift` calibration step can still operate as a final adjustment

**Implementation effort:** Low  
**Expected gain:** 1–3% RMSE, significant PBIAS improvement (currently −10% to −21% at Jefferson)

### A5. Gradient-Balanced Multi-Objective Loss (MEDIUM IMPACT)

**Problem:** The loss function sums 6+ terms (Gaussian NLL on residual & corrected, NSE surrogate, KGE stabilizer, PBIAS penalty, quantile pinball, non-negativity). These have different gradient magnitudes and can conflict. The current approach uses static weights which were tuned via HPO but may leave performance on the table.

**Proposed change:**
- Implement **GradNorm** or a simpler PCGrad-style gradient projection to dynamically balance loss terms
- Alternative (simpler): Log each loss component per epoch and apply automatic normalization (divide each loss by its running exponential average)

**Implementation effort:** Medium  
**Expected gain:** 1–3% RMSE improvement through better convergence

---

## Part B — Data & Training Pipeline Improvements

### B1. Fix Train/Val/Test Split Inconsistency (CRITICAL)

**Problem found during review:** `configs/train_val_test.json` defines train=2010–2018, val=2019, test=2020. But `scripts/experiments/run_full_experiment_suite.sh` uses train=2010–2017, val=2018, test=2019–2020. The experiments used the *shell script* version, which means:
- Results are on a 2-year test set (2019–2020) — acceptable but should be documented
- The JSON config file is misleading

**Action:** Reconcile. Pick one split and enforce it everywhere. Recommended: keep the shell script split (longer test period is better for WRR) but update `configs/train_val_test.json` to match.

### B2. Rolling-Origin Validation (MEDIUM IMPACT)

**Problem:** `configs/rolling_windows.json` has val_start == test_start in every fold — there's no separate holdout. This is fine for expanding-window metrics but doesn't give honest validation for early stopping.

**Action:** Add 1-year gap: e.g., Fold 8 → train 2010–2018, val 2019, test 2020. The infrastructure for this already exists in `train_quick_transformer_torch.py` via `--rolling-config`.

### B3. Land-Use Static Features Integration (HIGH IMPACT)

**Problem:** NLCD land-use data exists in `data/raw/land_use/nlcd_2021_land_use_metrics.csv` (urban%, forest%, agriculture%, impervious%) and the model supports `static_feats` via the `static_encoder` + cross-attention in Hydra v2 — but the current experiments pass **no static features** (`STATIC_NUMERIC = []` is empty).

**Action:**
1. Add NLCD metrics to `build_training_dataset.py` as per-site static columns
2. Populate `STATIC_NUMERIC` in the training script with `['urban_percent', 'forest_percent', 'impervious_percent', 'agriculture_percent']`
3. The existing `static_encoder` + `static_cross` attention in `hydra_temporal.py` will now be activated

**Implementation effort:** Low (data integration only)  
**Expected gain:** 1–5% RMSE reduction, especially at Galax (largest basin, most land-use heterogeneity, currently worst NSE)

### B4. Longer Sequence Length Experiment: 336h (14 days)

**Problem:** Current `seq_len=168` (7 days). For Appalachian catchments with soil-saturated antecedent conditions, 14-day memory could capture inter-storm moisture persistence better.

**Action:** Run a `seq_len=336` experiment for all 3 sites. The architecture supports it; memory should be fine on MPS with `batch_size=32`.

**Expected gain:** 1–3% RMSE at Jefferson/Galax (longer antecedent window helps peak prediction)

---

## Part C — WRR Publication Visualizations

These are designed for AGU WRR style (single-column ≤ 8.5cm or double-column ≤ 17.8cm, 300 DPI, vector-friendly).

### C1. Multi-Site Performance Summary Panel (ESSENTIAL for WRR)

**Description:** 3-row × 4-col panel figure. Each row = one site. Columns: (a) hydrograph with uncertainty band for a representative high-flow event, (b) scatter of obs vs corrected with 1:1 line and skill metrics annotated, (c) flow-duration curve (NWM vs Hydra vs Observed), (d) monthly NSE/KGE bars.

**File:** `viz/plot_wrr_multi_site_panel.py`  
**Status:** Does not exist yet — must be created  
**Priority:** P0 (this is the centerpiece figure for WRR)

### C2. Flow Duration Curve Comparison (ESSENTIAL for WRR)

**Description:** Exceedance probability vs. streamflow (log y-axis) for each site. Shows where NWM fails (typically high exceedance = low flows and low exceedance = peaks) and where Hydra corrects.

**File:** `viz/plot_flow_duration_curve.py`  
**Status:** Does not exist — must be created  
**Priority:** P0 — standard WRR figure; reviewers expect this

### C3. Attention Weight Visualization During Flood Events (HIGH VALUE)

**Description:** Extract and plot the transformer attention weights during a historical flood event. Show which timesteps and which features the model attends to when making peak corrections. 2-panel: (a) attention heatmap over the 168h input, (b) feature importance gate values if A2 is implemented.

**File:** `viz/plot_attention_analysis.py`  
**Status:** Does not exist — requires model hook to extract intermediate activations  
**Priority:** P1 — WRR reviewers will want mechanistic interpretability

### C4. Error Decomposition by Flow Regime (HIGH VALUE for WRR)

**Description:** Partition test-period errors into flow regime bins (e.g., Q < Q25 = low, Q25–Q75 = mid, Q > Q75 = high, Q > Q95 = flood). Show NWM vs Hydra RMSE/PBIAS per bin as grouped bars. This directly demonstrates that the correction is flow-regime-dependent, supporting the thesis argument.

**File:** `viz/plot_error_by_flow_regime.py`  
**Status:** Does not exist  
**Priority:** P0 — essential for WRR discussion of when/why the model helps

### C5. Seasonal Error Heatmap (MEDIUM VALUE)

**Description:** 12-month × 24-hour heatmap of mean absolute error for NWM and for Hydra. Shows seasonal/diurnal error patterns and where correction is strongest (likely summer convective storms and winter frontal events in the Appalachians).

**File:** `viz/plot_seasonal_error_heatmap.py`  
**Status:** Does not exist  
**Priority:** P1

### C6. Improvement Over Time / Rolling NSE (MEDIUM VALUE)

**Description:** Rolling 30-day NSE/KGE computed across the test period for NWM and Hydra. Shows temporal stability of the correction — important for WRR to demonstrate the model doesn't degrade during particular seasons.

**File:** `viz/plot_rolling_metrics.py`  
**Status:** Does not exist  
**Priority:** P1

### C7. Fix Existing Visualization Inconsistencies

Issues found in current viz code:
- `plot_high_flow_event.py` and `plot_hydrograph_with_uncertainty.py` hardcode colors instead of using `colors.COLORS`
- Multiple scripts hardcode "Watauga River" as title — must parameterize for multi-site
- No shared `load_eval_csv()` helper — duplicated loading logic
- `plot_wrr_performance_bars.py` expects columns like `rmse_baseline`/`rmse_hydra` that don't match the actual output format

**Actions:**
1. Refactor `viz/utils.py` to add `load_eval_csv(path, site_id, site_name)` helper
2. Update all viz scripts to use `colors.COLORS` consistently
3. Parameterize site name in titles

---

## Part D — Dashboard Enhancements

### D1. Interactive Flow Duration Curve (React)

Add a Recharts/D3-based interactive FDC to the dashboard `/dashboard` page where users can toggle NWM/Hydra/Observed traces per site.

### D2. Event Explorer

Clickable timeline on the dashboard that lets users zoom into specific storm events and see NWM vs. Hydra correction in real time. Uses the eval CSV data already exported to `public/data/`.

### D3. Attention Heatmap in Dashboard

Render the attention analysis (C3) as an interactive Plotly-style heatmap on the `/analysis` page.

---

## Recommended Execution Order

| Phase | Items | Est. Time | Expected Cumulative RMSE Gain |
|-------|-------|-----------|-------------------------------|
| **Phase 1: Quick Wins** | B1 (fix split), B3 (land-use features), A3 (event sampler) | 1–2 days | +3–8% |
| **Phase 2: Architecture** | A1 (multi-scale attn), A2 (feature gate), A4 (regime bias) | 3–4 days | +6–15% additional |
| **Phase 3: Viz for WRR** | C1, C2, C4 (multi-site panel, FDC, error decomp) | 2–3 days | N/A (pub-ready figs) |
| **Phase 4: Interpretability** | C3 (attention viz), C5 (seasonal heatmap), C6 (rolling metrics) | 2 days | N/A (pub + thesis) |
| **Phase 5: Dashboard** | D1, D2, D3 | 2–3 days | N/A (web app) |
| **Phase 6: Polish** | B2 (rolling validation), A5 (grad-balanced loss), B4 (seq=336) | 2 days | +1–3% final |

**Total estimated timeline: 12–16 working days**

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Sugar Grove gains remain small | Acceptable — NWM already performs well here. Focus WRR narrative on difficult sites. |
| Architecture changes overfit small dataset | Use rolling-origin validation (B2) and report confidence intervals |
| Training time increases | A1 adds ~15% compute; A2 is negligible; event sampler (A3) is free |
| Attention visualization may not show clear patterns | Fall back to SHAP/gradient-based feature importance if attention is diffuse |

---

## Summary

The highest-ROI changes are:
1. **Activate static features** (B3) — free performance from data you already have
2. **Multi-scale attention** (A1) — directly targets peak-flow errors, the hardest problem
3. **Feature importance gating** (A2) — lets precip drive corrections during storms
4. **Flow-duration curves & error decomposition** (C2, C4) — WRR reviewers will require these

These together could push Jefferson and Galax from ~21% RMSE improvement to **25–35%**, and generate the publication-quality figures needed for AGU WRR.
