#!/usr/bin/env python3
"""
Compute persistence baselines for WRR manuscript comparison.

Two baselines:
1. Residual persistence: r̂(t) = r(t-1), Q̂(t) = Q_NWM(t) + r(t-1)
2. Flow persistence: Q̂(t) = Q_obs(t-1)

Computes RMSE, NSE, PBIAS on 2019-2020 test period.
"""

import pandas as pd
import numpy as np
from pathlib import Path

# Sites to evaluate (unregulated only)
SITES = ["03161000", "03164000", "03479000"]
SITE_NAMES = {
    "03161000": "Jefferson",
    "03164000": "Galax",
    "03479000": "Sugar Grove",
}

# Test period
TEST_START = "2019-01-01"
TEST_END = "2020-12-31"

def load_eval_data(site_id: str) -> pd.DataFrame:
    """Load evaluation CSV for a site."""
    # Use the baseline experiment eval file (has USGS and NWM data)
    path = Path(f"data/clean/modeling/exp_baseline_{site_id}_eval.csv")
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.set_index("timestamp")
    # Filter to test period
    df = df.loc[TEST_START:TEST_END]
    return df

def compute_metrics(obs: np.ndarray, pred: np.ndarray) -> dict:
    """Compute RMSE, NSE, PBIAS."""
    # Remove NaN
    mask = ~(np.isnan(obs) | np.isnan(pred))
    obs = obs[mask]
    pred = pred[mask]

    # RMSE
    rmse = np.sqrt(np.mean((pred - obs) ** 2))

    # NSE
    ss_res = np.sum((obs - pred) ** 2)
    ss_tot = np.sum((obs - np.mean(obs)) ** 2)
    nse = 1 - ss_res / ss_tot

    # PBIAS (%)
    pbias = 100 * np.sum(pred - obs) / np.sum(obs)

    return {"rmse": rmse, "nse": nse, "pbias": pbias}

def compute_persistence_baselines():
    """Compute persistence baselines for all sites."""
    results = []

    for site_id in SITES:
        print(f"\nProcessing {SITE_NAMES[site_id]} ({site_id})...")
        df = load_eval_data(site_id)

        # Extract arrays
        usgs = df["usgs_cms"].values
        nwm = df["nwm_cms"].values
        residual = df["y_true_residual_cms"].values

        # NWM baseline metrics
        nwm_metrics = compute_metrics(usgs, nwm)
        nwm_rmse = nwm_metrics["rmse"]

        # --- Baseline 1: Residual Persistence ---
        # r̂(t) = r(t-1), Q̂(t) = Q_NWM(t) + r(t-1)
        residual_lagged = np.roll(residual, 1)
        residual_lagged[0] = residual[0]  # First value: use same
        res_persist_pred = nwm + residual_lagged
        res_persist_metrics = compute_metrics(usgs, res_persist_pred)
        res_persist_reduction = 100 * (1 - res_persist_metrics["rmse"] / nwm_rmse)

        # --- Baseline 2: Flow Persistence ---
        # Q̂(t) = Q_obs(t-1)
        flow_persist_pred = np.roll(usgs, 1)
        flow_persist_pred[0] = usgs[0]  # First value: use same
        flow_persist_metrics = compute_metrics(usgs, flow_persist_pred)
        flow_persist_reduction = 100 * (1 - flow_persist_metrics["rmse"] / nwm_rmse)

        # Store results
        results.append({
            "site": SITE_NAMES[site_id],
            "site_id": site_id,
            "nwm_rmse": nwm_rmse,
            "nwm_nse": nwm_metrics["nse"],
            "res_persist_rmse": res_persist_metrics["rmse"],
            "res_persist_nse": res_persist_metrics["nse"],
            "res_persist_reduction": res_persist_reduction,
            "flow_persist_rmse": flow_persist_metrics["rmse"],
            "flow_persist_nse": flow_persist_metrics["nse"],
            "flow_persist_reduction": flow_persist_reduction,
        })

        print(f"  NWM baseline: RMSE={nwm_rmse:.2f}, NSE={nwm_metrics['nse']:.3f}")
        print(f"  Residual persistence: RMSE={res_persist_metrics['rmse']:.2f}, "
              f"NSE={res_persist_metrics['nse']:.3f}, Δ={res_persist_reduction:.1f}%")
        print(f"  Flow persistence: RMSE={flow_persist_metrics['rmse']:.2f}, "
              f"NSE={flow_persist_metrics['nse']:.3f}, Δ={flow_persist_reduction:.1f}%")

    # Create summary DataFrame
    df_results = pd.DataFrame(results)

    # Save results
    output_path = Path("results/persistence_baselines.csv")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df_results.to_csv(output_path, index=False)
    print(f"\nResults saved to {output_path}")

    # Print summary table for manuscript
    print("\n" + "="*70)
    print("SUMMARY TABLE FOR MANUSCRIPT")
    print("="*70)
    print(f"{'Site':<15} {'NWM RMSE':<10} {'Res-Persist RMSE':<18} {'Flow-Persist RMSE':<18}")
    print(f"{'':15} {'':10} {'(Δ%)':<18} {'(Δ%)':<18}")
    print("-"*70)
    for r in results:
        print(f"{r['site']:<15} {r['nwm_rmse']:<10.2f} "
              f"{r['res_persist_rmse']:.2f} ({r['res_persist_reduction']:+.1f}%)    "
              f"{r['flow_persist_rmse']:.2f} ({r['flow_persist_reduction']:+.1f}%)")

    return df_results

if __name__ == "__main__":
    compute_persistence_baselines()
