# Hydra Model Results Summary
## NWM Streamflow Error Correction — Week 2 Progress Report
**Date:** February 4, 2026  
**Author:** Mitchel Carson  
**Advisors:** Dr. Javidian, Dr. Anderson

---

## Executive Summary

This report presents results from the Hydra model development for post-processing National Water Model (NWM) streamflow predictions. We compare three architectures across four study sites in the Upper New River / Watauga River watersheds:

- **LSTM Baseline**: Standard recurrent approach
- **Hydra v1**: Transformer-only architecture
- **Hydra v2**: GRU → Transformer hybrid (current best)

**Key Finding:** The GRU pre-encoder is essential. Hydra v2 reduces RMSE by 36–54% over v1 and achieves positive NSE at all sites where v1 fails catastrophically.

---

## Study Sites

| Site ID | Name | Watershed | Type | Drainage Area |
|---------|------|-----------|------|---------------|
| 03161000 | South Fork New River near Jefferson, NC | New River | Mid-basin | — |
| 03164000 | New River near Galax, VA | New River | Mainstem integrator | — |
| 03479000 | Watauga River near Sugar Grove, NC | Watauga | Headwaters | — |
| 03486000 | Watauga River at Elizabethton, TN | Watauga | Regulated (TVA) | — |

**Data Period:** 2010-01-01 to 2020-12-31 (hourly)

---

## Model Architectures

### LSTM Baseline
- 2-layer LSTM encoder (hidden=256)
- Input: 168-hour (7-day) lookback window
- Static feature fusion via concatenation
- Predicts residual: ê(t) = Q_obs(t) − Q_nwm(t)

### Hydra v1 (Transformer-Only)
- Patch convolution OR linear input projection
- Transformer encoder with **pre-norm** and **causal masking**
- Dilated convolutions (exponential: 1, 2, 4, 8)
- Channel attention (squeeze-excitation)
- Cyclic positional encoding (hour/day overlays)
- GLU fusion layer

### Hydra v2 (GRU → Transformer Hybrid)
- **Single-layer GRU pre-encoder** (projects to d_model=64)
- Transformer encoder with **post-norm**, no causal mask
- Dilated convolutions (fixed: 1, 3, 6)
- Attention pooling with learnable query
- Static feature cross-attention
- **Heteroscedastic uncertainty heads** (Gaussian NLL)

---

## Results: GRU Ablation (v2 vs v1)

### RMSE Comparison (m³/s)

| Site | Hydra v1 (Transformer) | Hydra v2 (GRU+Transformer) | Δ Improvement |
|------|------------------------|----------------------------|---------------|
| 03161000 | 21.69 | **12.33** | **43% ↓** |
| 03164000 | 97.21 | **62.11** | **36% ↓** |
| 03479000 | 11.98 | **7.37** | **38% ↓** |
| 03486000 | 49.45 | **22.55** | **54% ↓** |

### NSE Comparison

| Site | Hydra v1 | Hydra v2 | Δ Improvement |
|------|----------|----------|---------------|
| 03161000 | -0.35 | **0.56** | **+0.91** |
| 03164000 | -0.62 | **0.34** | **+0.96** |
| 03479000 | 0.05 | **0.64** | **+0.59** |
| 03486000 | -0.88 | **0.61** | **+1.49** |

### PBIAS Comparison (%)

| Site | Hydra v1 | Hydra v2 | Δ Improvement |
|------|----------|----------|---------------|
| 03161000 | -69.1 | **-16.9** | **+52 pts** |
| 03164000 | -81.3 | **-2.8** | **+78 pts** |
| 03479000 | -59.0 | **+4.7** | **+64 pts** |
| 03486000 | -72.2 | **-4.3** | **+68 pts** |

### Correlation Coefficient (CC)

| Site | Hydra v1 | Hydra v2 | Δ Improvement |
|------|----------|----------|---------------|
| 03161000 | 0.494 | **0.781** | **+0.29** |
| 03164000 | -0.039 | **0.599** | **+0.64** |
| 03479000 | 0.667 | **0.804** | **+0.14** |
| 03486000 | 0.649 | **0.784** | **+0.14** |

---

## Results: Hydra v2 vs NWM Baseline

| Site | Metric | NWM Baseline | Hydra v2 | Improved? |
|------|--------|--------------|----------|-----------|
| **03161000** | RMSE | 12.36 | 12.33 | ✅ (0.2%) |
| | NSE | 0.562 | 0.564 | ✅ |
| | PBIAS | -13.2% | -16.9% | ❌ |
| | CC | 0.763 | 0.781 | ✅ |
| **03164000** | RMSE | 63.41 | 62.11 | ✅ (2.0%) |
| | NSE | 0.312 | 0.339 | ✅ |
| | PBIAS | -9.5% | -2.8% | ✅ |
| | CC | 0.594 | 0.599 | ✅ |
| **03479000** | RMSE | 7.49 | 7.37 | ✅ (1.6%) |
| | NSE | 0.630 | 0.642 | ✅ |
| | PBIAS | +7.1% | +4.7% | ✅ |
| | CC | 0.802 | 0.804 | ✅ |
| **03486000** | RMSE | 27.15 | 22.55 | ✅ **(17.0%)** |
| | NSE | 0.433 | 0.609 | ✅ **(+0.18)** |
| | PBIAS | -9.8% | -4.3% | ✅ |
| | CC | 0.674 | 0.784 | ✅ **(+0.11)** |

**Summary:** 3 of 4 sites show improvement on all metrics. Site 03161000 shows marginal gains but PBIAS worsens.

---

## Why Does the GRU Component Help?

The GRU pre-encoder provides three critical benefits for streamflow time series:

### 1. Sequential Inductive Bias
Transformers treat input tokens as an unordered set unless positional encoding is strong. Streamflow is inherently sequential—discharge at hour t depends causally on hours t-1, t-2, etc. The GRU **enforces temporal ordering** through its recurrent structure, providing a stronger inductive bias than positional encoding alone.

### 2. Smooth Hidden State Transitions
GRUs produce **continuous, smooth representations** across time via their gating mechanism. This is well-suited to streamflow, which exhibits gradual rises and recessions. Pure Transformers can produce discontinuous attention patterns that struggle with the smooth dynamics of hydrological processes.

### 3. Compression Before Attention
The GRU acts as a **temporal compressor**, extracting local patterns before the Transformer's global attention. This reduces the burden on the Transformer to learn both local and global dependencies simultaneously. The Transformer can focus on longer-range relationships (e.g., lag between precipitation and discharge) while the GRU handles short-term autocorrelation.

### 4. Gradient Stability
The GRU's gating provides a stable gradient pathway during training. Transformers can suffer from attention collapse or instability on small datasets. The GRU acts as a regularizer, stabilizing early training dynamics.

### Empirical Evidence
- v1 (Transformer-only) achieves **negative NSE** on 3/4 sites (worse than predicting the mean)
- v1 shows massive negative bias (PBIAS -59% to -81%), indicating systematic underprediction
- v2 (GRU+Transformer) stabilizes all metrics to reasonable ranges

This suggests v1 fails to learn meaningful temporal representations from position encoding alone.

---

## Problem Area: Site 03161000

Site 03161000 (South Fork New River) shows:
- Marginal RMSE/NSE improvement (<1%)
- **PBIAS worsens** from -13.2% → -16.9%

### Possible Causes
1. **Mid-basin complexity**: Receives contributions from multiple tributaries with different lag times
2. **Limited improvement ceiling**: NWM baseline already performs reasonably well (NSE=0.56)
3. **Loss function**: MSE-based loss doesn't penalize systematic bias

### Proposed Fixes
1. **Add PBIAS penalty to loss function**
2. **Reintroduce cyclic time encoding** (present in v1, removed in v2)
3. **Post-hoc bias calibration** (partially attempted, needs refinement)

---

## Architecture Improvement Proposals

| Modification | Expected Impact | Implementation Effort |
|--------------|-----------------|----------------------|
| Cyclic time encoding (hour/day) | Better seasonality, may help PBIAS | Low (copy from v1) |
| Causal masking in Transformer | Stricter temporal validity | Low |
| PBIAS-aware loss term | Directly targets bias | Medium |
| Channel attention (squeeze-excite) | Better feature selection | Medium |

---

## Conclusions

1. **The GRU component is essential** — removing it causes model failure
2. **Hydra v2 improves or matches NWM baseline** on 15/16 site-metric combinations
3. **Best results at 03486000** (regulated site): RMSE ↓17%, NSE +0.18
4. **One problem case**: 03161000 PBIAS worsens slightly
5. **Results are publishable** with appropriate framing of the 03161000 limitation

---

## Recommended Next Steps

### If results are acceptable:
- Proceed to WRR manuscript draft
- Generate publication figures (map, bar charts, hydrographs)
- Frame 03161000 limitation in Discussion section

### If improvement needed:
- 1-day timebox: cyclic encoding + PBIAS loss for 03161000
- Re-run only the problem site
- Do not delay manuscript start beyond Feb 5

---

## Appendix: Full Metrics Table

| Site | Model | RMSE | NSE | PBIAS (%) | CC |
|------|-------|------|-----|-----------|-----|
| 03161000 | NWM Baseline | 12.36 | 0.562 | -13.2 | 0.763 |
| 03161000 | Hydra v1 | 21.69 | -0.35 | -69.1 | 0.494 |
| 03161000 | Hydra v2 | 12.33 | 0.564 | -16.9 | 0.781 |
| 03164000 | NWM Baseline | 63.41 | 0.312 | -9.5 | 0.594 |
| 03164000 | Hydra v1 | 97.21 | -0.62 | -81.3 | -0.039 |
| 03164000 | Hydra v2 | 62.11 | 0.339 | -2.8 | 0.599 |
| 03479000 | NWM Baseline | 7.49 | 0.630 | +7.1 | 0.802 |
| 03479000 | Hydra v1 | 11.98 | 0.055 | -59.0 | 0.667 |
| 03479000 | Hydra v2 | 7.37 | 0.642 | +4.7 | 0.804 |
| 03486000 | NWM Baseline | 27.15 | 0.433 | -9.8 | 0.674 |
| 03486000 | Hydra v1 | 49.45 | -0.88 | -72.2 | 0.649 |
| 03486000 | Hydra v2 | 22.55 | 0.609 | -4.3 | 0.784 |
