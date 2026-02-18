#!/usr/bin/env python3
"""
Journal-rigor evaluation framework for Hydra streamflow correction.

Computes skill scores, regime-stratified metrics, bootstrap CIs,
and Diebold-Mariano significance tests from eval CSVs.

Usage:
    python scripts/evaluation/compute_rigorous_eval.py                     # full run
    python scripts/evaluation/compute_rigorous_eval.py --skip-bootstrap    # fast dev
    python scripts/evaluation/compute_rigorous_eval.py --parallel 4        # parallel
"""
from __future__ import annotations

import argparse
import glob
import json
import math
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor, as_completed
from datetime import datetime
from typing import Any, Callable

import numpy as np
import pandas as pd
from scipy.signal import find_peaks
from scipy.stats import norm

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
EVAL_DIR = "data/clean/modeling"
UNREGULATED_SITES = {"03161000", "03164000", "03479000"}
BLOCK_SIZE = 24       # hours for block bootstrap
BOOTSTRAP_REPS = 2000
CI_LEVEL = 0.95
SEASONS = {
    "DJF": [12, 1, 2],
    "MAM": [3, 4, 5],
    "JJA": [6, 7, 8],
    "SON": [9, 10, 11],
}
PEAK_SEPARATION_H = 24
MIN_SAMPLES_FOR_CI = 100

FILENAME_RE = re.compile(r"^exp_(.+?)_(\d{8})_eval\.csv$")

# Legacy -> canonical experiment ID mapping (mirrors export_results_to_json.py)
LEGACY_ID_MAP: dict[str, str] = {
    "lstm": "lstm_nwm_era5",
    "hydra_v1": "transformer_nwm_era5",
    "hydra_v2": "gru_transformer_v2_nwm_era5",
    "baseline": "gru_transformer_v2_nwm_era5_tuned",
    "causal": "gru_transformer_v2_causal",
    "direct": "gru_transformer_v2_direct",
    "physics": "gru_transformer_v2_nonneg",
    "combined": "gru_transformer_v2_causal_nonneg",
    "v3_baseline": "hydra_v3_nwm_era5",
    "v3_causal": "hydra_v3_causal",
    "v3_physics": "hydra_v3_nonneg",
    "v3_combined": "hydra_v3_causal_nonneg",
    "v3_eventsample": "hydra_v3_event_oversample",
    "v3_full": "hydra_v3_causal_nonneg_event",
    "v3_autonorm": "hydra_v3_full_autonorm",
    "usgs_only_v3": "hydra_v3_era5_only",
    "usgs_only_simple": "gru_era5_only",
    "usgs_nwm_era5_v3": "hydra_v3_usgs_nwm_era5",
    "usgs_era5_v3": "hydra_v3_usgs_era5",
}


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------
def discover_eval_files() -> list[tuple[str, str, str]]:
    """Return list of (experiment, site_id, filepath) for unregulated sites."""
    results = []
    for path in sorted(glob.glob(os.path.join(EVAL_DIR, "exp_*_eval.csv"))):
        basename = os.path.basename(path)
        m = FILENAME_RE.match(basename)
        if not m:
            continue
        raw_experiment, site_id = m.group(1), m.group(2)
        experiment = LEGACY_ID_MAP.get(raw_experiment, raw_experiment)
        if site_id not in UNREGULATED_SITES:
            continue
        results.append((experiment, site_id, path))
    return results


def load_eval_csv(path: str) -> pd.DataFrame:
    """Load an eval CSV and add derived error columns."""
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.set_index("timestamp").sort_index()

    # Handle both residual-mode and direct-mode CSVs
    obs_col = "usgs_cms"
    nwm_col = "nwm_cms"
    hydra_col = "corrected_pred_cms"

    for col in [obs_col, nwm_col, hydra_col]:
        if col not in df.columns:
            raise ValueError(f"Missing required column '{col}' in {path}")

    # Cast to float64
    df[obs_col] = df[obs_col].astype(np.float64)
    df[nwm_col] = df[nwm_col].astype(np.float64)
    df[hydra_col] = df[hydra_col].astype(np.float64)

    # Drop rows with any NaN in the three core columns
    mask = df[[obs_col, nwm_col, hydra_col]].notna().all(axis=1)
    df = df[mask].copy()

    # Derived error columns
    df["nwm_error"] = df[nwm_col] - df[obs_col]
    df["hydra_error"] = df[hydra_col] - df[obs_col]

    return df


# ---------------------------------------------------------------------------
# Core metric functions
# ---------------------------------------------------------------------------
def _rmse(pred: np.ndarray, obs: np.ndarray) -> float:
    return float(np.sqrt(np.mean((pred - obs) ** 2)))


def _mae(pred: np.ndarray, obs: np.ndarray) -> float:
    return float(np.mean(np.abs(pred - obs)))


def _nse(pred: np.ndarray, obs: np.ndarray) -> float:
    denom = np.sum((obs - np.mean(obs)) ** 2)
    if denom == 0:
        return float("nan")
    return float(1.0 - np.sum((pred - obs) ** 2) / denom)


def _kge_components(pred: np.ndarray, obs: np.ndarray) -> dict[str, float]:
    """KGE 2009 with components."""
    pred_m, obs_m = np.mean(pred), np.mean(obs)
    pred_s, obs_s = np.std(pred), np.std(obs)
    if obs_s == 0 or obs_m == 0 or pred_s == 0:
        return {"kge": float("nan"), "r": float("nan"),
                "alpha": float("nan"), "beta": float("nan")}
    r = float(np.corrcoef(pred, obs)[0, 1])
    alpha = float(pred_s / obs_s)
    beta = float(pred_m / obs_m)
    kge = float(1.0 - math.sqrt((r - 1) ** 2 + (alpha - 1) ** 2 + (beta - 1) ** 2))
    return {"kge": kge, "r": r, "alpha": alpha, "beta": beta}


def _pbias(pred: np.ndarray, obs: np.ndarray) -> float:
    s = np.sum(obs)
    if s == 0:
        return float("nan")
    return float(100.0 * np.sum(pred - obs) / s)


def _me(pred: np.ndarray, obs: np.ndarray) -> float:
    return float(np.mean(pred - obs))


def compute_skill_scores(df: pd.DataFrame, mask: np.ndarray | None = None) -> dict:
    """Compute all deterministic skill scores for a dataframe subset."""
    if mask is not None:
        d = df.loc[mask]
    else:
        d = df

    n = len(d)
    if n < 10:
        return {"n_samples": n, "insufficient": True}

    obs = d["usgs_cms"].values
    nwm = d["nwm_cms"].values
    hydra = d["corrected_pred_cms"].values

    rmse_nwm = _rmse(nwm, obs)
    rmse_hydra = _rmse(hydra, obs)
    mae_nwm = _mae(nwm, obs)
    mae_hydra = _mae(hydra, obs)

    ss_rmse = 1.0 - rmse_hydra / rmse_nwm if rmse_nwm > 0 else float("nan")
    ss_mae = 1.0 - mae_hydra / mae_nwm if mae_nwm > 0 else float("nan")

    nse_nwm = _nse(nwm, obs)
    nse_hydra = _nse(hydra, obs)
    delta_nse = nse_hydra - nse_nwm

    kge_nwm = _kge_components(nwm, obs)
    kge_hydra = _kge_components(hydra, obs)
    delta_kge = kge_hydra["kge"] - kge_nwm["kge"]

    pbias_nwm = _pbias(nwm, obs)
    pbias_hydra = _pbias(hydra, obs)
    me_nwm = _me(nwm, obs)
    me_hydra = _me(hydra, obs)

    # Error variance reduction
    var_nwm = np.var(d["nwm_error"].values)
    var_hydra = np.var(d["hydra_error"].values)
    ss_var_err = 1.0 - var_hydra / var_nwm if var_nwm > 0 else float("nan")

    return {
        "n_samples": n,
        "rmse_nwm": round(rmse_nwm, 4),
        "rmse_hydra": round(rmse_hydra, 4),
        "mae_nwm": round(mae_nwm, 4),
        "mae_hydra": round(mae_hydra, 4),
        "ss_rmse": round(ss_rmse, 4),
        "ss_mae": round(ss_mae, 4),
        "nse_nwm": round(nse_nwm, 4),
        "nse_hydra": round(nse_hydra, 4),
        "delta_nse": round(delta_nse, 4),
        "kge_nwm": {k: round(v, 4) for k, v in kge_nwm.items()},
        "kge_hydra": {k: round(v, 4) for k, v in kge_hydra.items()},
        "delta_kge": round(delta_kge, 4),
        "pbias_nwm": round(pbias_nwm, 2),
        "pbias_hydra": round(pbias_hydra, 2),
        "me_nwm": round(me_nwm, 4),
        "me_hydra": round(me_hydra, 4),
        "delta_abs_pbias": round(abs(pbias_nwm) - abs(pbias_hydra), 2),
        "delta_abs_me": round(abs(me_nwm) - abs(me_hydra), 4),
        "ss_var_err": round(ss_var_err, 4),
    }


# ---------------------------------------------------------------------------
# Regime segmentation
# ---------------------------------------------------------------------------
def compute_regime_masks(df: pd.DataFrame) -> dict[str, np.ndarray]:
    """Compute flow regime and hydrograph phase masks."""
    obs = df["usgs_cms"].values
    q10 = np.quantile(obs, 0.10)
    q90 = np.quantile(obs, 0.90)

    low = obs <= q10
    mid = (obs > q10) & (obs < q90)
    high = obs >= q90

    # Rising/falling limb
    d_obs = np.diff(obs, prepend=obs[0])
    rising = d_obs > 0
    falling = d_obs < 0

    masks = {
        "low": low,
        "mid": mid,
        "high": high,
        "rising": rising,
        "falling": falling,
        "high_rising": high & rising,
        "high_falling": high & falling,
        "low_rising": low & rising,
        "low_falling": low & falling,
    }
    return masks


# ---------------------------------------------------------------------------
# Peak timing analysis
# ---------------------------------------------------------------------------
def compute_peak_timing_error(df: pd.DataFrame) -> dict:
    """Compute peak timing errors for observed vs NWM and Hydra."""
    obs = df["usgs_cms"].values
    nwm = df["nwm_cms"].values
    hydra = df["corrected_pred_cms"].values

    q90 = np.quantile(obs, 0.90)
    obs_peaks, _ = find_peaks(obs, height=q90, distance=PEAK_SEPARATION_H)

    if len(obs_peaks) == 0:
        return {"n_peaks": 0}

    search_window = 12  # +/- hours

    def _timing_errors(sim: np.ndarray, obs_peak_indices: np.ndarray) -> list[float]:
        errors = []
        for oi in obs_peak_indices:
            lo = max(0, oi - search_window)
            hi = min(len(sim), oi + search_window + 1)
            sim_window = sim[lo:hi]
            sim_peaks_local, _ = find_peaks(sim_window)
            if len(sim_peaks_local) == 0:
                # Use argmax as fallback
                sim_peak_idx = lo + np.argmax(sim_window)
            else:
                # Closest local peak
                sim_peaks_global = sim_peaks_local + lo
                closest = sim_peaks_global[np.argmin(np.abs(sim_peaks_global - oi))]
                sim_peak_idx = closest
            errors.append(float(sim_peak_idx - oi))
        return errors

    nwm_errors = _timing_errors(nwm, obs_peaks)
    hydra_errors = _timing_errors(hydra, obs_peaks)

    return {
        "n_peaks": len(obs_peaks),
        "median_abs_timing_nwm_h": round(float(np.median(np.abs(nwm_errors))), 1),
        "median_abs_timing_hydra_h": round(float(np.median(np.abs(hydra_errors))), 1),
        "mean_abs_timing_nwm_h": round(float(np.mean(np.abs(nwm_errors))), 1),
        "mean_abs_timing_hydra_h": round(float(np.mean(np.abs(hydra_errors))), 1),
        "timing_improvement_h": round(
            float(np.median(np.abs(nwm_errors))) - float(np.median(np.abs(hydra_errors))), 1
        ),
    }


# ---------------------------------------------------------------------------
# Moving block bootstrap
# ---------------------------------------------------------------------------
def moving_block_bootstrap(
    stat_fn: Callable[[pd.DataFrame], float],
    df: pd.DataFrame,
    block_size: int = BLOCK_SIZE,
    n_reps: int = BOOTSTRAP_REPS,
    ci_level: float = CI_LEVEL,
    rng: np.random.Generator | None = None,
) -> dict:
    """Circular moving block bootstrap for autocorrelated time series."""
    if rng is None:
        rng = np.random.default_rng(42)

    n = len(df)
    if n < block_size * 2:
        return {"value": None, "ci": None, "se": None}

    point_estimate = stat_fn(df)

    n_blocks = math.ceil(n / block_size)
    boot_stats = np.empty(n_reps)

    # Pre-generate all random start indices
    starts = rng.integers(0, n, size=(n_reps, n_blocks))

    for i in range(n_reps):
        indices = []
        for s in starts[i]:
            block_indices = np.arange(s, s + block_size) % n  # circular
            indices.append(block_indices)
        indices = np.concatenate(indices)[:n]
        boot_df = df.iloc[indices]
        boot_stats[i] = stat_fn(boot_df)

    alpha = 1.0 - ci_level
    ci_lo = float(np.nanpercentile(boot_stats, 100 * alpha / 2))
    ci_hi = float(np.nanpercentile(boot_stats, 100 * (1 - alpha / 2)))
    se = float(np.nanstd(boot_stats))

    return {
        "value": round(point_estimate, 4),
        "ci": [round(ci_lo, 4), round(ci_hi, 4)],
        "se": round(se, 4),
    }


# ---------------------------------------------------------------------------
# Diebold-Mariano test
# ---------------------------------------------------------------------------
def diebold_mariano_test(
    e_hydra: np.ndarray, e_nwm: np.ndarray, h: int = 1
) -> dict:
    """
    Diebold-Mariano test comparing forecast accuracy.

    d_t = e_nwm^2 - e_hydra^2  (positive = Hydra better)
    Uses Newey-West HAC variance estimator.
    """
    d = e_nwm ** 2 - e_hydra ** 2
    n = len(d)
    d_mean = np.mean(d)

    # Newey-West bandwidth
    bandwidth = int(np.ceil(n ** (1 / 3)))

    # HAC variance
    gamma_0 = np.mean((d - d_mean) ** 2)
    gamma_sum = 0.0
    for k in range(1, bandwidth + 1):
        weight = 1.0 - k / (bandwidth + 1)  # Bartlett kernel
        gamma_k = np.mean((d[k:] - d_mean) * (d[:-k] - d_mean))
        gamma_sum += 2 * weight * gamma_k

    hac_var = (gamma_0 + gamma_sum) / n

    if hac_var <= 0:
        return {
            "dm_statistic": float("nan"),
            "p_value": float("nan"),
            "mean_loss_diff": round(float(d_mean), 6),
            "significant_005": False,
            "significant_001": False,
        }

    dm_stat = d_mean / np.sqrt(hac_var)
    # Two-sided p-value (H0: equal predictive accuracy)
    p_value = 2.0 * (1.0 - norm.cdf(abs(dm_stat)))

    return {
        "dm_statistic": round(float(dm_stat), 4),
        "p_value": float(f"{p_value:.6g}"),
        "mean_loss_diff": round(float(d_mean), 6),
        "significant_005": p_value < 0.05,
        "significant_001": p_value < 0.01,
        "hydra_better": d_mean > 0,
    }


# ---------------------------------------------------------------------------
# Single experiment-site evaluation
# ---------------------------------------------------------------------------
def _make_ss_rmse_fn(obs_col="usgs_cms", nwm_col="nwm_cms", hydra_col="corrected_pred_cms"):
    """Create a statistic function for bootstrap: SS_RMSE."""
    def fn(df: pd.DataFrame) -> float:
        obs = df[obs_col].values
        nwm = df[nwm_col].values
        hydra = df[hydra_col].values
        rmse_nwm = np.sqrt(np.mean((nwm - obs) ** 2))
        rmse_hydra = np.sqrt(np.mean((hydra - obs) ** 2))
        return 1.0 - rmse_hydra / rmse_nwm if rmse_nwm > 0 else float("nan")
    return fn


def _make_delta_nse_fn():
    def fn(df: pd.DataFrame) -> float:
        obs = df["usgs_cms"].values
        nwm = df["nwm_cms"].values
        hydra = df["corrected_pred_cms"].values
        return _nse(hydra, obs) - _nse(nwm, obs)
    return fn


def _make_delta_kge_fn():
    def fn(df: pd.DataFrame) -> float:
        obs = df["usgs_cms"].values
        nwm = df["nwm_cms"].values
        hydra = df["corrected_pred_cms"].values
        return _kge_components(hydra, obs)["kge"] - _kge_components(nwm, obs)["kge"]
    return fn


def _make_ss_var_err_fn():
    def fn(df: pd.DataFrame) -> float:
        var_nwm = np.var(df["nwm_error"].values)
        var_hydra = np.var(df["hydra_error"].values)
        return 1.0 - var_hydra / var_nwm if var_nwm > 0 else float("nan")
    return fn


def evaluate_window(
    df: pd.DataFrame,
    do_bootstrap: bool = True,
    rng: np.random.Generator | None = None,
) -> dict:
    """Evaluate a single time window (full period or seasonal)."""
    if len(df) < 10:
        return {"insufficient": True, "n_samples": len(df)}

    # --- Deterministic metrics ---
    scores = compute_skill_scores(df)

    # --- Regime segmentation ---
    masks = compute_regime_masks(df)
    regimes = {}
    for name, mask in masks.items():
        n_in_regime = int(np.sum(mask))
        if n_in_regime < 10:
            regimes[name] = {"n_samples": n_in_regime, "insufficient": True}
            continue
        regime_scores = compute_skill_scores(df, mask)
        regimes[name] = regime_scores

    # --- Peak timing ---
    peak_timing = compute_peak_timing_error(df)

    # --- DM test ---
    dm = diebold_mariano_test(df["hydra_error"].values, df["nwm_error"].values)

    result: dict[str, Any] = {
        "headline": {
            "ss_rmse": {"value": scores["ss_rmse"]},
            "delta_nse": {"value": scores["delta_nse"]},
            "delta_kge": {"value": scores["delta_kge"]},
            "kge_components": {
                "nwm": scores["kge_nwm"],
                "hydra": scores["kge_hydra"],
            },
        },
        "error_structure": {
            "pbias_nwm": scores["pbias_nwm"],
            "pbias_hydra": scores["pbias_hydra"],
            "me_nwm": scores["me_nwm"],
            "me_hydra": scores["me_hydra"],
            "delta_abs_pbias": scores["delta_abs_pbias"],
            "delta_abs_me": scores["delta_abs_me"],
            "high_flow": {
                "ss_rmse": {"value": regimes.get("high", {}).get("ss_rmse")},
                "ss_mae": {"value": regimes.get("high", {}).get("ss_mae")},
                "n_samples": regimes.get("high", {}).get("n_samples", 0),
            },
            "low_flow": {
                "ss_rmse": {"value": regimes.get("low", {}).get("ss_rmse")},
                "ss_mae": {"value": regimes.get("low", {}).get("ss_mae")},
                "n_samples": regimes.get("low", {}).get("n_samples", 0),
            },
        },
        "distribution": {
            "ss_var_err": {"value": scores["ss_var_err"]},
            "peak_timing": peak_timing,
        },
        "significance": {"dm_test": dm},
        "regimes": regimes,
        "n_samples": scores["n_samples"],
        "raw_metrics": {
            "rmse_nwm": scores["rmse_nwm"],
            "rmse_hydra": scores["rmse_hydra"],
            "mae_nwm": scores["mae_nwm"],
            "mae_hydra": scores["mae_hydra"],
            "nse_nwm": scores["nse_nwm"],
            "nse_hydra": scores["nse_hydra"],
        },
    }

    # --- Bootstrap CIs ---
    if do_bootstrap and len(df) >= MIN_SAMPLES_FOR_CI:
        if rng is None:
            rng = np.random.default_rng(42)

        # Headline CIs
        for key, fn in [
            ("ss_rmse", _make_ss_rmse_fn()),
            ("delta_nse", _make_delta_nse_fn()),
            ("delta_kge", _make_delta_kge_fn()),
        ]:
            boot = moving_block_bootstrap(fn, df, rng=rng)
            result["headline"][key] = boot

        # Var err CI
        boot_var = moving_block_bootstrap(_make_ss_var_err_fn(), df, rng=rng)
        result["distribution"]["ss_var_err"] = boot_var

        # High-flow and low-flow CIs (only if enough samples)
        for regime_key, struct_key in [("high", "high_flow"), ("low", "low_flow")]:
            regime_mask = masks.get(regime_key)
            if regime_mask is not None and np.sum(regime_mask) >= MIN_SAMPLES_FOR_CI:
                regime_df = df.loc[regime_mask]
                boot_regime = moving_block_bootstrap(_make_ss_rmse_fn(), regime_df, rng=rng)
                result["error_structure"][struct_key]["ss_rmse"] = boot_regime

    return result


def evaluate_single(
    experiment: str,
    site_id: str,
    path: str,
    do_bootstrap: bool = True,
) -> dict:
    """Full evaluation for one experiment-site pair."""
    df = load_eval_csv(path)
    rng = np.random.default_rng(42)

    result: dict[str, Any] = {}

    # Full period
    result["full_period"] = evaluate_window(df, do_bootstrap=do_bootstrap, rng=rng)

    # Seasonal windows
    seasonal: dict[str, Any] = {}
    for season, months in SEASONS.items():
        season_mask = df.index.month.isin(months)
        season_df = df[season_mask]
        if len(season_df) < 10:
            seasonal[season] = {"insufficient": True, "n_samples": len(season_df)}
        else:
            # Skip bootstrap for seasonal (smaller samples, less critical)
            seasonal[season] = evaluate_window(
                season_df, do_bootstrap=do_bootstrap, rng=rng
            )
    result["seasonal"] = seasonal

    return result


# ---------------------------------------------------------------------------
# Cross-site aggregation
# ---------------------------------------------------------------------------
def aggregate_cross_site(
    all_results: dict[str, dict[str, dict]],
) -> dict[str, dict]:
    """Compute median + IQR of skill scores across sites for each experiment."""
    cross_site = {}
    experiments = set()
    for exp_results in all_results.values():
        experiments.update(exp_results.keys())

    # Actually, results are keyed [experiment][site], so:
    for experiment in all_results:
        site_results = all_results[experiment]
        ss_rmses = []
        delta_nses = []
        delta_kges = []
        sig_005 = 0
        sig_001 = 0

        for site_id, site_eval in site_results.items():
            fp = site_eval.get("full_period", {})
            headline = fp.get("headline", {})

            ss = headline.get("ss_rmse", {})
            val = ss.get("value") if isinstance(ss, dict) else ss
            if val is not None and not (isinstance(val, float) and math.isnan(val)):
                ss_rmses.append(val)

            dn = headline.get("delta_nse", {})
            val = dn.get("value") if isinstance(dn, dict) else dn
            if val is not None and not (isinstance(val, float) and math.isnan(val)):
                delta_nses.append(val)

            dk = headline.get("delta_kge", {})
            val = dk.get("value") if isinstance(dk, dict) else dk
            if val is not None and not (isinstance(val, float) and math.isnan(val)):
                delta_kges.append(val)

            dm = fp.get("significance", {}).get("dm_test", {})
            if dm.get("significant_005"):
                sig_005 += 1
            if dm.get("significant_001"):
                sig_001 += 1

        cross_site[experiment] = {
            "n_sites": len(site_results),
            "median_ss_rmse": round(float(np.median(ss_rmses)), 4) if ss_rmses else None,
            "iqr_ss_rmse": [
                round(float(np.percentile(ss_rmses, 25)), 4),
                round(float(np.percentile(ss_rmses, 75)), 4),
            ] if len(ss_rmses) >= 2 else None,
            "median_delta_nse": round(float(np.median(delta_nses)), 4) if delta_nses else None,
            "iqr_delta_nse": [
                round(float(np.percentile(delta_nses, 25)), 4),
                round(float(np.percentile(delta_nses, 75)), 4),
            ] if len(delta_nses) >= 2 else None,
            "median_delta_kge": round(float(np.median(delta_kges)), 4) if delta_kges else None,
            "sites_significant_005": sig_005,
            "sites_significant_001": sig_001,
        }

    return cross_site


# ---------------------------------------------------------------------------
# Worker for parallel execution
# ---------------------------------------------------------------------------
def _worker(args: tuple) -> tuple[str, str, dict]:
    experiment, site_id, path, do_bootstrap = args
    result = evaluate_single(experiment, site_id, path, do_bootstrap=do_bootstrap)
    return experiment, site_id, result


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------
def evaluate_all(
    do_bootstrap: bool = True,
    parallel: int = 1,
) -> dict:
    """Evaluate all experiment-site combinations and aggregate."""
    files = discover_eval_files()
    print(f"Found {len(files)} eval CSVs for {len(UNREGULATED_SITES)} unregulated sites")

    # results[experiment][site_id] = {...}
    all_results: dict[str, dict[str, dict]] = {}

    if parallel > 1:
        tasks = [(exp, sid, path, do_bootstrap) for exp, sid, path in files]
        with ProcessPoolExecutor(max_workers=parallel) as executor:
            futures = {executor.submit(_worker, t): t for t in tasks}
            done = 0
            for future in as_completed(futures):
                experiment, site_id, result = future.result()
                all_results.setdefault(experiment, {})[site_id] = result
                done += 1
                print(f"  [{done}/{len(files)}] {experiment} @ {site_id}")
    else:
        for i, (experiment, site_id, path) in enumerate(files):
            print(f"  [{i + 1}/{len(files)}] {experiment} @ {site_id} ...", end=" ", flush=True)
            result = evaluate_single(experiment, site_id, path, do_bootstrap=do_bootstrap)
            all_results.setdefault(experiment, {})[site_id] = result
            fp = result.get("full_period", {}).get("headline", {})
            ss = fp.get("ss_rmse", {})
            val = ss.get("value") if isinstance(ss, dict) else None
            print(f"SS_RMSE={val}")

    # Cross-site aggregation
    cross_site = aggregate_cross_site(all_results)

    output = {
        "generated_at": datetime.utcnow().isoformat(),
        "bootstrap": {
            "block_size": BLOCK_SIZE,
            "n_reps": BOOTSTRAP_REPS if do_bootstrap else 0,
            "ci_level": CI_LEVEL,
        },
        "sites": sorted(UNREGULATED_SITES),
        "experiments": sorted(all_results.keys()),
        "results": all_results,
        "cross_site": cross_site,
    }

    return output


def print_summary(output: dict) -> None:
    """Print a human-readable summary table."""
    print("\n" + "=" * 80)
    print("RIGOROUS EVALUATION SUMMARY")
    print("=" * 80)

    for experiment in sorted(output["results"].keys()):
        sites = output["results"][experiment]
        cs = output["cross_site"].get(experiment, {})
        median_ss = cs.get("median_ss_rmse")
        print(f"\n--- {experiment} (median SS_RMSE: {median_ss}) ---")

        for site_id in sorted(sites.keys()):
            fp = sites[site_id].get("full_period", {})
            headline = fp.get("headline", {})
            dm = fp.get("significance", {}).get("dm_test", {})

            ss = headline.get("ss_rmse", {})
            ss_val = ss.get("value") if isinstance(ss, dict) else ss
            ci = ss.get("ci") if isinstance(ss, dict) else None

            dn = headline.get("delta_nse", {})
            dn_val = dn.get("value") if isinstance(dn, dict) else dn

            p = dm.get("p_value", "N/A")
            sig = "***" if dm.get("significant_001") else ("*" if dm.get("significant_005") else "n.s.")

            ci_str = f" CI[{ci[0]:.3f}, {ci[1]:.3f}]" if ci else ""
            print(f"  {site_id}: SS_RMSE={ss_val:.4f}{ci_str}  ΔNSE={dn_val:.4f}  DM p={p} {sig}")


def main():
    parser = argparse.ArgumentParser(description="Compute rigorous evaluation metrics")
    parser.add_argument(
        "--output", default="dashboard/public/data/rigorous_eval.json",
        help="Output JSON path",
    )
    parser.add_argument(
        "--skip-bootstrap", action="store_true",
        help="Skip bootstrap CIs for faster dev runs",
    )
    parser.add_argument(
        "--parallel", type=int, default=1,
        help="Number of parallel workers (default: 1)",
    )
    args = parser.parse_args()

    do_bootstrap = not args.skip_bootstrap
    print(f"Bootstrap: {'ON (reps={BOOTSTRAP_REPS})' if do_bootstrap else 'OFF (--skip-bootstrap)'}")
    print(f"Parallel workers: {args.parallel}")

    output = evaluate_all(do_bootstrap=do_bootstrap, parallel=args.parallel)

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w") as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\nWrote {args.output} ({os.path.getsize(args.output) / 1024:.1f} KB)")

    print_summary(output)


if __name__ == "__main__":
    main()
