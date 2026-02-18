#!/usr/bin/env python3
"""WRR multi-site hydrograph panel with empirical uncertainty bands.

Produces a 3-row × 2-col figure (one row per unregulated site):
    Left column:  high-flow event window (7-day half-window around peak)
    Right column: typical-flow period (7-day half-window around median flow)

Each panel includes P10–P90 empirical prediction intervals derived from
test-set residuals.

Usage:
    PYTHONPATH=. python -m viz.plot_wrr_hydrograph_panel \
        --eval-csvs \
            data/clean/modeling/exp_v3_combined_03161000_eval.csv \
            data/clean/modeling/exp_v3_baseline_03164000_eval.csv \
            data/clean/modeling/exp_v3_baseline_03479000_eval.csv \
        --site-ids 03161000 03164000 03479000 \
        --site-names \
            "S. Fork New River, Jefferson NC" \
            "New River, Galax VA" \
            "Watauga River, Sugar Grove NC" \
        --output results/figures/wrr_hydrograph_panel.png
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import List

import matplotlib.dates as mdates
import matplotlib.gridspec as gridspec
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd

from viz.colors import COLORS
from viz.style import apply_wrr_style
from viz.utils import ensure_parent


def _load_eval(csv_path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])
    if "corrected_true_cms" not in df.columns and "usgs_cms" in df.columns:
        df["corrected_true_cms"] = df["usgs_cms"]
    return (
        df.dropna(subset=["corrected_true_cms", "corrected_pred_cms", "nwm_cms"])
        .sort_values("timestamp")
        .reset_index(drop=True)
    )


def _compute_bounds(df: pd.DataFrame) -> tuple[float, float]:
    """Empirical P10/P90 offsets from full-dataset residuals."""
    resid = df["corrected_pred_cms"].to_numpy() - df["corrected_true_cms"].to_numpy()
    return float(np.percentile(resid, 10)), float(np.percentile(resid, 90))


def _window_around_peak(df: pd.DataFrame, hours: int) -> pd.DataFrame:
    """Extract window centered on the peak observed flow."""
    peak_idx = int(df["corrected_true_cms"].idxmax())
    peak_loc = df.index.get_loc(peak_idx)
    start = max(0, peak_loc - hours)
    end = min(len(df), peak_loc + hours + 1)
    return df.iloc[start:end]


def _window_around_median(df: pd.DataFrame, hours: int) -> pd.DataFrame:
    """Extract window centered on the timestamp closest to median flow."""
    median_q = df["corrected_true_cms"].median()
    closest_idx = (df["corrected_true_cms"] - median_q).abs().idxmin()
    closest_loc = df.index.get_loc(closest_idx)
    start = max(0, closest_loc - hours)
    end = min(len(df), closest_loc + hours + 1)
    return df.iloc[start:end]


def _plot_panel(
    ax,
    window: pd.DataFrame,
    p10: float,
    p90: float,
    *,
    site_name: str,
    is_highflow: bool,
    show_legend: bool,
    panel_label: str,
) -> None:
    """Plot a single hydrograph panel with uncertainty band."""
    ts = window["timestamp"]
    obs = window["corrected_true_cms"]
    nwm = window["nwm_cms"]
    corr = window["corrected_pred_cms"]

    lower = (corr + p10).clip(lower=0.0)
    upper = corr + p90

    ax.fill_between(
        ts, lower, upper,
        alpha=0.15, color=COLORS["ml"], label="P10\u2013P90", zorder=0,
    )
    ax.plot(ts, obs, color=COLORS["obs"], linewidth=1.4, label="Observed", zorder=3)
    ax.plot(
        ts, nwm, color=COLORS["nwm"], linewidth=1.0, linestyle="--",
        alpha=0.8, label="NWM", zorder=1,
    )
    ax.plot(
        ts, corr, color=COLORS["ml"], linewidth=1.2, label="Hydra", zorder=4,
    )

    if is_highflow:
        peak_idx = obs.idxmax()
        peak_row = window.loc[peak_idx]
        ax.axvline(
            peak_row["timestamp"], color="k", linestyle=":", linewidth=0.8, alpha=0.7,
        )

    # MAE annotation
    mae_h = (corr - obs).abs().mean()
    mae_n = (nwm - obs).abs().mean()
    ax.text(
        0.02, 0.93,
        f"MAE \u2014 Hydra: {mae_h:.1f}  NWM: {mae_n:.1f}",
        transform=ax.transAxes, fontsize=7,
        bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.85, edgecolor="none"),
        verticalalignment="top",
    )

    ax.set_ylim(bottom=0)
    ax.set_ylabel("Q (m\u00b3/s)", fontsize=8)
    ax.tick_params(labelsize=7)

    ax.xaxis.set_major_locator(mdates.DayLocator(interval=2))
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%b %d"))
    ax.tick_params(axis="x", rotation=30)

    # Panel label
    ax.text(
        -0.10, 1.06, f"({panel_label})",
        transform=ax.transAxes, fontsize=9, fontweight="bold", va="top",
    )

    if show_legend:
        ax.legend(fontsize=6, loc="upper right", ncol=2, framealpha=0.8)


def plot_wrr_hydrograph_panel(
    *,
    eval_csvs: List[str | Path],
    site_ids: List[str],
    site_names: List[str],
    output: str | Path,
    hours: int = 168,
) -> None:
    apply_wrr_style()

    n_sites = len(eval_csvs)
    assert len(site_ids) == n_sites and len(site_names) == n_sites

    fig = plt.figure(figsize=(14, 4.0 * n_sites))
    gs = gridspec.GridSpec(n_sites, 2, figure=fig, hspace=0.38, wspace=0.25)

    for row, (csv_path, sid, sname) in enumerate(zip(eval_csvs, site_ids, site_names)):
        df = _load_eval(csv_path)
        p10, p90 = _compute_bounds(df)

        win_high = _window_around_peak(df, hours)
        win_typ = _window_around_median(df, hours)

        ax_high = fig.add_subplot(gs[row, 0])
        ax_typ = fig.add_subplot(gs[row, 1])

        label_high = chr(ord("a") + row * 2)
        label_typ = chr(ord("a") + row * 2 + 1)

        _plot_panel(
            ax_high, win_high, p10, p90,
            site_name=sname, is_highflow=True,
            show_legend=(row == 0), panel_label=label_high,
        )
        _plot_panel(
            ax_typ, win_typ, p10, p90,
            site_name=sname, is_highflow=False,
            show_legend=False, panel_label=label_typ,
        )

        # Row site name on left panel
        ax_high.set_title(sname, fontsize=9, fontweight="bold", loc="left")

    # Column headers
    fig.text(0.30, 0.99, "High-Flow Event", ha="center", fontsize=11, fontweight="bold")
    fig.text(0.74, 0.99, "Typical-Flow Period", ha="center", fontsize=11, fontweight="bold")

    ensure_parent(output)
    fig.savefig(output, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {output}")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--eval-csvs", nargs="+", type=Path, required=True)
    ap.add_argument("--site-ids", nargs="+", required=True)
    ap.add_argument("--site-names", nargs="+", required=True)
    ap.add_argument(
        "--output", type=Path, default=Path("results/figures/wrr_hydrograph_panel.pdf"),
    )
    ap.add_argument("--hours", type=int, default=168, help="Half-window hours (default 168 = 7 days)")
    return ap


def main() -> None:
    args = build_parser().parse_args()
    plot_wrr_hydrograph_panel(
        eval_csvs=args.eval_csvs,
        site_ids=args.site_ids,
        site_names=args.site_names,
        output=args.output,
        hours=args.hours,
    )


if __name__ == "__main__":
    main()
