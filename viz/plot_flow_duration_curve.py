#!/usr/bin/env python3
"""WRR-style Flow Duration Curve (FDC) comparison.

Plots exceedance-probability vs. streamflow for Observed, NWM, and Hydra-corrected
on log-scale y-axis. Standard hydrology figure expected by WRR reviewers.

Usage:
    python viz/plot_flow_duration_curve.py \
        --eval-csv data/clean/modeling/exp_physics_03161000_eval.csv \
        --site-id 03161000 --site-name "South Fork New River near Jefferson, NC" \
        --output results/figures/fdc_03161000.png
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from viz.colors import COLORS
from viz.style import apply_wrr_style
from viz.utils import ensure_parent


def _exceedance(values: np.ndarray):
    """Return (sorted_values, exceedance_probability) for an FDC."""
    sorted_vals = np.sort(values)[::-1]
    n = len(sorted_vals)
    prob = np.arange(1, n + 1) / (n + 1) * 100  # Weibull plotting position
    return sorted_vals, prob


def plot_flow_duration_curve(
    *,
    csv_path: str | Path,
    output: str | Path,
    site_id: str = "",
    site_name: str = "",
    log_y: bool = True,
) -> None:
    apply_wrr_style()
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])

    obs_col = "corrected_true_cms" if "corrected_true_cms" in df.columns else "usgs_cms"
    corr_col = "corrected_pred_cms"
    nwm_col = "nwm_cms"

    df = df.dropna(subset=[obs_col, corr_col, nwm_col])

    obs_vals, obs_prob = _exceedance(df[obs_col].to_numpy())
    nwm_vals, nwm_prob = _exceedance(df[nwm_col].to_numpy())
    corr_vals, corr_prob = _exceedance(df[corr_col].to_numpy())

    fig, ax = plt.subplots(figsize=(8, 5))

    ax.plot(obs_prob, obs_vals, color=COLORS["obs"], linewidth=1.4, label="Observed (USGS)", zorder=3)
    ax.plot(nwm_prob, nwm_vals, color=COLORS["nwm"], linewidth=1.2, alpha=0.85, label="NWM v2.1", zorder=2)
    ax.plot(corr_prob, corr_vals, color=COLORS["ml"], linewidth=1.2, alpha=0.85, label="Hydra-Corrected", zorder=2)

    if log_y:
        ax.set_yscale("log")
    ax.set_xlabel("Exceedance Probability (%)")
    ax.set_ylabel("Streamflow (m³/s)")
    ax.set_xlim(0, 100)

    title = "Flow Duration Curve"
    if site_name:
        title += f"\n{site_name}"
    if site_id:
        title += f" ({site_id})"
    ax.set_title(title, fontsize=11)
    ax.legend(loc="upper right", fontsize=9, framealpha=0.9)
    ax.grid(True, which="both", alpha=0.3)

    ensure_parent(output)
    fig.tight_layout()
    fig.savefig(output, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {output}")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--eval-csv", type=Path, required=True, help="Hydra eval CSV")
    ap.add_argument("--output", type=Path, required=True, help="Output PNG path")
    ap.add_argument("--site-id", default="")
    ap.add_argument("--site-name", default="")
    ap.add_argument("--no-log", action="store_true", help="Use linear y-axis instead of log")
    return ap


def main() -> None:
    args = build_parser().parse_args()
    plot_flow_duration_curve(
        csv_path=args.eval_csv,
        output=args.output,
        site_id=args.site_id,
        site_name=args.site_name,
        log_y=not args.no_log,
    )


if __name__ == "__main__":
    main()
