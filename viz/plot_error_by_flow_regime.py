#!/usr/bin/env python3
"""WRR-style error decomposition by flow regime.

Partitions the test period into flow-magnitude bins and computes RMSE, MAE,
PBIAS, and NSE for NWM and Hydra-corrected predictions within each bin.
Produces grouped bar charts showing where the model helps most.

Usage:
    python viz/plot_error_by_flow_regime.py \
        --eval-csv data/clean/modeling/exp_physics_03161000_eval.csv \
        --site-id 03161000 --site-name "South Fork New River near Jefferson, NC" \
        --output results/figures/error_regime_03161000.png
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker

from viz.colors import COLORS
from viz.style import apply_wrr_style
from viz.utils import ensure_parent


# Flow-regime bins defined by exceedance-quantile thresholds
REGIME_BINS = [
    ("Low\n(<Q25)", 0.0, 0.25),
    ("Mid-Low\n(Q25–Q50)", 0.25, 0.50),
    ("Mid-High\n(Q50–Q75)", 0.50, 0.75),
    ("High\n(Q75–Q90)", 0.75, 0.90),
    ("Flood\n(>Q90)", 0.90, 1.0),
]


def _compute_bin_metrics(
    obs: np.ndarray, pred: np.ndarray, mask: np.ndarray
) -> Dict[str, float]:
    """Compute hydrological metrics for a bin subset."""
    o = obs[mask]
    p = pred[mask]
    if len(o) == 0:
        return {"rmse": np.nan, "mae": np.nan, "pbias": np.nan, "nse": np.nan, "n": 0}
    diff = p - o
    rmse = float(np.sqrt(np.mean(diff**2)))
    mae = float(np.mean(np.abs(diff)))
    pbias = float(100.0 * np.sum(diff) / (np.sum(o) + 1e-8))
    denom = np.sum((o - np.mean(o)) ** 2)
    nse = float(1.0 - np.sum(diff**2) / denom) if denom > 0 else np.nan
    return {"rmse": rmse, "mae": mae, "pbias": pbias, "nse": nse, "n": int(len(o))}


def plot_error_by_flow_regime(
    *,
    csv_path: str | Path,
    output: str | Path,
    site_id: str = "",
    site_name: str = "",
) -> None:
    apply_wrr_style()
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])

    obs_col = "corrected_true_cms" if "corrected_true_cms" in df.columns else "usgs_cms"
    corr_col = "corrected_pred_cms"
    nwm_col = "nwm_cms"
    df = df.dropna(subset=[obs_col, corr_col, nwm_col])

    obs = df[obs_col].to_numpy()
    nwm = df[nwm_col].to_numpy()
    corr = df[corr_col].to_numpy()

    # Compute quantile thresholds from observed flow
    quantiles = np.quantile(obs, [b[2] for b in REGIME_BINS[:-1]])  # Q25, Q50, Q75, Q90
    thresholds = np.concatenate([[obs.min() - 1], quantiles, [obs.max() + 1]])

    labels = [b[0] for b in REGIME_BINS]
    nwm_metrics_list: List[Dict[str, float]] = []
    corr_metrics_list: List[Dict[str, float]] = []

    for i, (label, q_lo, q_hi) in enumerate(REGIME_BINS):
        lo = thresholds[i]
        hi = thresholds[i + 1]
        mask = (obs >= lo) & (obs < hi) if i < len(REGIME_BINS) - 1 else (obs >= lo)
        nwm_metrics_list.append(_compute_bin_metrics(obs, nwm, mask))
        corr_metrics_list.append(_compute_bin_metrics(obs, corr, mask))

    # Plot 2×2: RMSE, MAE, PBIAS, NSE per regime
    fig, axes = plt.subplots(2, 2, figsize=(12, 8))
    x = np.arange(len(labels))
    width = 0.35

    metrics_to_plot = [
        ("rmse", "RMSE (m³/s)", False),
        ("mae", "MAE (m³/s)", False),
        ("pbias", "PBIAS (%)", False),
        ("nse", "NSE", True),
    ]

    for ax, (key, ylabel, higher_better) in zip(axes.flat, metrics_to_plot):
        nwm_vals = [m[key] for m in nwm_metrics_list]
        corr_vals = [m[key] for m in corr_metrics_list]

        bars_nwm = ax.bar(x - width / 2, nwm_vals, width, label="NWM v2.1",
                          color=COLORS["nwm"], alpha=0.85, edgecolor="white", linewidth=0.5)
        bars_corr = ax.bar(x + width / 2, corr_vals, width, label="Hydra",
                           color=COLORS["ml"], alpha=0.85, edgecolor="white", linewidth=0.5)

        ax.set_ylabel(ylabel, fontsize=10)
        ax.set_xticks(x)
        ax.set_xticklabels(labels, fontsize=8)
        ax.legend(fontsize=8, loc="best")
        ax.grid(axis="y", alpha=0.3)

        if key == "pbias":
            ax.axhline(0, color="black", linewidth=0.8, linestyle="-")

        # Add sample count annotation
        for i_bin, n_nwm in enumerate(nwm_metrics_list):
            ax.annotate(
                f"n={n_nwm['n']}",
                xy=(x[i_bin], 0),
                xytext=(0, -18),
                textcoords="offset points",
                ha="center",
                fontsize=6,
                color="gray",
            )

    title = "Error Decomposition by Flow Regime"
    if site_name:
        title += f"\n{site_name}"
    if site_id:
        title += f" ({site_id})"
    fig.suptitle(title, fontsize=12, fontweight="bold", y=1.02)

    panel_labels = ["(a)", "(b)", "(c)", "(d)"]
    for ax, label in zip(axes.flat, panel_labels):
        ax.text(-0.1, 1.05, label, transform=ax.transAxes, fontsize=11, fontweight="bold")

    ensure_parent(output)
    fig.tight_layout()
    fig.savefig(output, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {output}")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--eval-csv", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--site-id", default="")
    ap.add_argument("--site-name", default="")
    return ap


def main() -> None:
    args = build_parser().parse_args()
    plot_error_by_flow_regime(
        csv_path=args.eval_csv,
        output=args.output,
        site_id=args.site_id,
        site_name=args.site_name,
    )


if __name__ == "__main__":
    main()
