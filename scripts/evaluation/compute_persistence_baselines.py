#!/usr/bin/env python3
"""
Compute persistence baselines for WRR manuscript comparison.

Two baselines:
1. Residual persistence: r̂(t) = r(t-1), Q̂(t) = Q_NWM(t) + r(t-1)
2. Flow persistence: Q̂(t) = Q_obs(t-1)

Computes RMSE, NSE, PBIAS on 2019-2020 test period.
"""

import argparse
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
TEST_END_EXCLUSIVE = "2021-01-01"

def load_eval_data(site_id: str, eval_prefix: str, eval_dir: Path = Path("data/clean/modeling")) -> pd.DataFrame:
    """Load evaluation CSV for a site."""
    path = eval_dir / f"{eval_prefix}_{site_id}_eval.csv"
    df = pd.read_csv(path, parse_dates=["timestamp"])
    df = df.sort_values("timestamp").drop_duplicates("timestamp").set_index("timestamp")
    df = df[(df.index >= pd.Timestamp(TEST_START)) & (df.index < pd.Timestamp(TEST_END_EXCLUSIVE))]
    return df


def exact_hour_pairs(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return current/previous rows only where timestamps differ by exactly one hour."""

    if df.empty:
        return df.copy(), df.copy()
    valid = df.index.to_series().diff().eq(pd.Timedelta(hours=1)).to_numpy()
    current_positions = np.flatnonzero(valid)
    current = df.iloc[current_positions].copy()
    previous = df.iloc[current_positions - 1].copy()
    previous.index = current.index
    return current, previous

def compute_metrics(obs: np.ndarray, pred: np.ndarray) -> dict:
    """Compute RMSE, NSE, PBIAS."""
    # Single-predictor helper rejects all non-finite pairs.
    mask = np.isfinite(obs) & np.isfinite(pred)
    obs = obs[mask]
    pred = pred[mask]

    if not len(obs):
        return {"rmse": float("nan"), "nse": float("nan"), "pbias": float("nan")}
    # RMSE
    rmse = np.sqrt(np.mean((pred - obs) ** 2))

    # NSE
    ss_res = np.sum((obs - pred) ** 2)
    ss_tot = np.sum((obs - np.mean(obs)) ** 2)
    nse = 1 - ss_res / ss_tot if ss_tot > 0 else float("nan")

    # PBIAS (%)
    pbias = 100 * np.sum(pred - obs) / np.sum(obs) if np.sum(obs) != 0 else float("nan")

    return {"rmse": rmse, "nse": nse, "pbias": pbias}

def compute_persistence_baselines(
    eval_prefix: str = "exp_usgs_nwm_era5_v3",
    eval_dir: Path = Path("data/clean/modeling"),
    output_path: Path = Path("results/persistence_baselines.csv"),
):
    """Compute persistence baselines for all sites."""
    results = []

    for site_id in SITES:
        print(f"\nProcessing {SITE_NAMES[site_id]} ({site_id})...")
        df = load_eval_data(site_id, eval_prefix, eval_dir=eval_dir)
        current, previous = exact_hour_pairs(df)
        if current.empty:
            raise ValueError(f"No exact one-hour pairs found for {site_id} in {eval_prefix}")

        # Extract arrays
        usgs = current["usgs_cms"].values
        nwm = current["nwm_cms"].values
        previous_usgs = previous["usgs_cms"].values
        previous_residual = previous["y_true_residual_cms"].values

        # All three predictors share one finite comparison population.
        res_persist_pred = nwm + previous_residual
        flow_persist_pred = previous_usgs
        common = np.isfinite(usgs) & np.isfinite(nwm) & np.isfinite(res_persist_pred) & np.isfinite(flow_persist_pred)
        n_comparison_pairs = int(common.sum())
        if not n_comparison_pairs:
            raise ValueError(f"No common finite persistence comparison pairs for {site_id}")
        nwm_metrics = compute_metrics(usgs[common], nwm[common])
        nwm_rmse = nwm_metrics["rmse"]
        res_persist_metrics = compute_metrics(usgs[common], res_persist_pred[common])
        flow_persist_metrics = compute_metrics(usgs[common], flow_persist_pred[common])
        res_persist_reduction = 100 * (1 - res_persist_metrics["rmse"] / nwm_rmse) if nwm_rmse > 0 else float("nan")
        flow_persist_reduction = 100 * (1 - flow_persist_metrics["rmse"] / nwm_rmse) if nwm_rmse > 0 else float("nan")

        # Store results
        results.append({
            "site": SITE_NAMES[site_id],
            "site_id": site_id,
            "study_task": "retrospective_target_valid_time_correction",
            "nwm_product": "NWM v2.1 retrospective CHRTOUT",
            "eval_prefix": eval_prefix,
            "n_exact_hour_pairs": int(len(current)),
            "n_comparison_pairs": n_comparison_pairs,
            "n_pairs_excluded_nonfinite": int(len(current) - n_comparison_pairs),
            "comparison_support": "common_finite_observation_nwm_residual_persistence_flow_persistence",
            "n_rows_excluded_nonhourly_or_first": int(len(df) - len(current)),
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--eval-prefix", default="exp_usgs_nwm_era5_v3")
    parser.add_argument("--eval-dir", type=Path, default=Path("data/clean/modeling"))
    parser.add_argument("--output", type=Path, default=Path("results/persistence_baselines.csv"))
    args = parser.parse_args()
    compute_persistence_baselines(eval_prefix=args.eval_prefix, eval_dir=args.eval_dir, output_path=args.output)
