#!/usr/bin/env python3
"""WRR-style seasonal × diurnal error heatmap.

Produces a 1×2 figure showing mean absolute error as a 12-month × 24-hour
heatmap for (a) NWM baseline and (b) Hydra-corrected.  Reveals seasonal and
diurnal patterns of NWM under/over-prediction and where Hydra adds value.

Usage:
    python viz/plot_seasonal_error_heatmap.py \
        --eval-csv data/clean/modeling/exp_physics_03161000_eval.csv \
        --site-id 03161000 --site-name "S. Fork New River, Jefferson NC" \
        --output results/figures/seasonal_heatmap_03161000.png
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

from viz.style import apply_wrr_style
from viz.utils import ensure_parent


def plot_seasonal_error_heatmap(
    *,
    csv_path: str | Path,
    output: str | Path,
    site_id: str = "",
    site_name: str = "",
) -> None:
    apply_wrr_style()
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])

    obs_col = "corrected_true_cms" if "corrected_true_cms" in df.columns else "usgs_cms"
    df = df.dropna(subset=[obs_col, "corrected_pred_cms", "nwm_cms"])

    df["hour"] = df["timestamp"].dt.hour
    df["month"] = df["timestamp"].dt.month
    df["mae_nwm"] = np.abs(df["nwm_cms"] - df[obs_col])
    df["mae_hydra"] = np.abs(df["corrected_pred_cms"] - df[obs_col])

    # Pivot to month × hour grids
    nwm_grid = df.pivot_table(values="mae_nwm", index="month", columns="hour", aggfunc="mean")
    hydra_grid = df.pivot_table(values="mae_hydra", index="month", columns="hour", aggfunc="mean")

    # Shared color scale
    vmax = max(nwm_grid.max().max(), hydra_grid.max().max())
    vmin = 0

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5), sharey=True)

    month_labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    im1 = ax1.imshow(nwm_grid.values, aspect="auto", cmap="YlOrRd", vmin=vmin, vmax=vmax, origin="lower")
    ax1.set_title("(a) NWM Baseline MAE", fontsize=10, fontweight="bold")
    ax1.set_xlabel("Hour (UTC)", fontsize=9)
    ax1.set_ylabel("Month", fontsize=9)
    ax1.set_yticks(range(len(month_labels)))
    ax1.set_yticklabels(month_labels, fontsize=8)
    ax1.set_xticks(range(0, 24, 3))
    ax1.set_xticklabels(range(0, 24, 3), fontsize=8)

    im2 = ax2.imshow(hydra_grid.values, aspect="auto", cmap="YlOrRd", vmin=vmin, vmax=vmax, origin="lower")
    ax2.set_title("(b) Hydra-Corrected MAE", fontsize=10, fontweight="bold")
    ax2.set_xlabel("Hour (UTC)", fontsize=9)
    ax2.set_xticks(range(0, 24, 3))
    ax2.set_xticklabels(range(0, 24, 3), fontsize=8)

    cbar = fig.colorbar(im2, ax=[ax1, ax2], shrink=0.8, label="MAE (m³/s)")

    title = "Seasonal × Diurnal Error"
    if site_name:
        title += f" — {site_name}"
    if site_id:
        title += f" ({site_id})"
    fig.suptitle(title, fontsize=12, fontweight="bold", y=1.02)

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
    plot_seasonal_error_heatmap(
        csv_path=args.eval_csv,
        output=args.output,
        site_id=args.site_id,
        site_name=args.site_name,
    )


if __name__ == "__main__":
    main()
