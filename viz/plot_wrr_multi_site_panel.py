#!/usr/bin/env python3
"""WRR-style multi-site performance summary panel.

Produces a 3-row × 4-col figure (one row per unregulated site):
    (a) Hydrograph with uncertainty band for the peak-flow event window
    (b) Observed vs. Corrected scatter with 1:1 line + annotated NSE/KGE
    (c) Flow-duration curve overlay (Observed, NWM, Hydra)
    (d) Monthly RMSE grouped bars (NWM vs. Hydra)

This is the centerpiece publication figure for AGU WRR.

Usage:
    python viz/plot_wrr_multi_site_panel.py \
        --eval-csvs data/clean/modeling/exp_physics_03161000_eval.csv \
                    data/clean/modeling/exp_causal_03164000_eval.csv \
                    data/clean/modeling/exp_direct_03479000_eval.csv \
        --site-ids 03161000 03164000 03479000 \
        --site-names "S. Fork New River, Jefferson NC" \
                     "New River, Galax VA" \
                     "Watauga River, Sugar Grove NC" \
        --output results/figures/wrr_multi_site_panel.png
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import List, Optional

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec

from viz.colors import COLORS
from viz.style import apply_wrr_style
from viz.utils import ensure_parent


def _load_eval(csv_path: str | Path) -> pd.DataFrame:
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])
    if "corrected_true_cms" not in df.columns and "usgs_cms" in df.columns:
        df["corrected_true_cms"] = df["usgs_cms"]
    return df.dropna(subset=["corrected_true_cms", "corrected_pred_cms", "nwm_cms"]).sort_values("timestamp")


def _exceedance(values: np.ndarray):
    sorted_vals = np.sort(values)[::-1]
    n = len(sorted_vals)
    prob = np.arange(1, n + 1) / (n + 1) * 100
    return sorted_vals, prob


def _nse(pred: np.ndarray, obs: np.ndarray) -> float:
    denom = np.sum((obs - np.mean(obs)) ** 2)
    return float(1.0 - np.sum((pred - obs) ** 2) / denom) if denom > 0 else np.nan


def _kge(pred: np.ndarray, obs: np.ndarray) -> float:
    r = float(np.corrcoef(pred, obs)[0, 1]) if np.std(pred) > 0 and np.std(obs) > 0 else np.nan
    alpha = float(np.std(pred) / np.std(obs)) if np.std(obs) > 0 else np.nan
    beta = float(np.mean(pred) / np.mean(obs)) if np.mean(obs) != 0 else np.nan
    if any(np.isnan(v) for v in [r, alpha, beta]):
        return np.nan
    return float(1.0 - math.sqrt((r - 1) ** 2 + (alpha - 1) ** 2 + (beta - 1) ** 2))


def _panel_hydrograph(ax, df: pd.DataFrame, site_name: str, hours: int = 72) -> None:
    """(a) Hydrograph around peak-flow event with simple uncertainty band."""
    peak_idx = int(df["corrected_true_cms"].idxmax())
    peak_loc = df.index.get_loc(peak_idx)
    start = max(0, peak_loc - hours)
    end = min(len(df), peak_loc + hours + 1)
    window = df.iloc[start:end]

    ts = window["timestamp"]
    obs = window["corrected_true_cms"]
    nwm = window["nwm_cms"]
    corr = window["corrected_pred_cms"]

    # Simple empirical uncertainty band from full-dataset residuals
    resid = df["corrected_pred_cms"].to_numpy() - df["corrected_true_cms"].to_numpy()
    p10, p90 = float(np.percentile(resid, 10)), float(np.percentile(resid, 90))

    ax.fill_between(ts, corr + p10, corr + p90, alpha=0.15, color=COLORS["ml"], label="P10–P90 band")
    ax.plot(ts, obs, color=COLORS["obs"], linewidth=1.2, label="Observed")
    ax.plot(ts, nwm, color=COLORS["nwm"], linewidth=1.0, alpha=0.8, label="NWM")
    ax.plot(ts, corr, color=COLORS["ml"], linewidth=1.0, alpha=0.9, label="Hydra")
    ax.set_ylabel("Q (m³/s)", fontsize=8)
    ax.legend(fontsize=6, loc="upper right", ncol=2, framealpha=0.8)
    ax.tick_params(labelsize=7)
    ax.set_title(site_name, fontsize=9, fontweight="bold", loc="left")


def _panel_scatter(ax, df: pd.DataFrame) -> None:
    """(b) Observed vs. Corrected scatter with 1:1 line and metrics."""
    obs = df["corrected_true_cms"].to_numpy()
    corr = df["corrected_pred_cms"].to_numpy()

    ax.scatter(obs, corr, s=2, alpha=0.3, color=COLORS["ml"], rasterized=True)
    lims = [0, max(obs.max(), corr.max()) * 1.05]
    ax.plot(lims, lims, "--", color="gray", linewidth=0.8, label="1:1")
    ax.set_xlim(lims)
    ax.set_ylim(lims)
    ax.set_xlabel("Obs Q (m³/s)", fontsize=8)
    ax.set_ylabel("Hydra Q (m³/s)", fontsize=8)
    ax.tick_params(labelsize=7)
    ax.set_aspect("equal", adjustable="box")

    nse_val = _nse(corr, obs)
    kge_val = _kge(corr, obs)
    ax.text(
        0.05, 0.92,
        f"NSE={nse_val:.3f}\nKGE={kge_val:.3f}",
        transform=ax.transAxes, fontsize=7, verticalalignment="top",
        bbox=dict(boxstyle="round,pad=0.3", facecolor="white", alpha=0.8),
    )


def _panel_fdc(ax, df: pd.DataFrame) -> None:
    """(c) Flow duration curve overlay."""
    obs = df["corrected_true_cms"].to_numpy()
    nwm = df["nwm_cms"].to_numpy()
    corr = df["corrected_pred_cms"].to_numpy()

    obs_s, obs_p = _exceedance(obs)
    nwm_s, nwm_p = _exceedance(nwm)
    corr_s, corr_p = _exceedance(corr)

    ax.plot(obs_p, obs_s, color=COLORS["obs"], linewidth=1.2, label="Observed")
    ax.plot(nwm_p, nwm_s, color=COLORS["nwm"], linewidth=1.0, alpha=0.8, label="NWM")
    ax.plot(corr_p, corr_s, color=COLORS["ml"], linewidth=1.0, alpha=0.8, label="Hydra")
    ax.set_yscale("log")
    ax.set_xlabel("Exceedance (%)", fontsize=8)
    ax.set_ylabel("Q (m³/s)", fontsize=8)
    ax.set_xlim(0, 100)
    ax.legend(fontsize=6, loc="upper right")
    ax.tick_params(labelsize=7)
    ax.grid(True, which="both", alpha=0.2)


def _panel_monthly_rmse(ax, df: pd.DataFrame) -> None:
    """(d) Monthly RMSE grouped bars — NWM vs. Hydra."""
    df = df.copy()
    df["month"] = df["timestamp"].dt.month
    obs = df["corrected_true_cms"].to_numpy()
    nwm = df["nwm_cms"].to_numpy()
    corr = df["corrected_pred_cms"].to_numpy()
    df["nwm_sq_err"] = (nwm - obs) ** 2
    df["corr_sq_err"] = (corr - obs) ** 2

    monthly = df.groupby("month").agg(
        nwm_rmse=("nwm_sq_err", lambda x: float(np.sqrt(np.mean(x)))),
        corr_rmse=("corr_sq_err", lambda x: float(np.sqrt(np.mean(x)))),
    )

    months = monthly.index.to_numpy()
    x = np.arange(len(months))
    width = 0.35

    ax.bar(x - width / 2, monthly["nwm_rmse"], width, color=COLORS["nwm"], alpha=0.85, label="NWM")
    ax.bar(x + width / 2, monthly["corr_rmse"], width, color=COLORS["ml"], alpha=0.85, label="Hydra")
    ax.set_xticks(x)
    ax.set_xticklabels(["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][:len(months)], fontsize=7)
    ax.set_ylabel("RMSE (m³/s)", fontsize=8)
    ax.legend(fontsize=6, loc="upper right")
    ax.tick_params(labelsize=7)
    ax.grid(axis="y", alpha=0.2)


def plot_wrr_multi_site_panel(
    *,
    eval_csvs: List[str | Path],
    site_ids: List[str],
    site_names: List[str],
    output: str | Path,
    event_hours: int = 72,
) -> None:
    apply_wrr_style()
    n_sites = len(eval_csvs)
    assert len(site_ids) == n_sites and len(site_names) == n_sites

    fig = plt.figure(figsize=(17.8 / 2.54 * 2, 4.2 * n_sites))  # WRR double-column width
    gs = gridspec.GridSpec(n_sites, 4, figure=fig, hspace=0.35, wspace=0.40)

    panel_idx = 0
    for row, (csv_path, sid, sname) in enumerate(zip(eval_csvs, site_ids, site_names)):
        df = _load_eval(csv_path)

        ax_hydro = fig.add_subplot(gs[row, 0])
        ax_scatter = fig.add_subplot(gs[row, 1])
        ax_fdc = fig.add_subplot(gs[row, 2])
        ax_monthly = fig.add_subplot(gs[row, 3])

        _panel_hydrograph(ax_hydro, df, sname, hours=event_hours)
        _panel_scatter(ax_scatter, df)
        _panel_fdc(ax_fdc, df)
        _panel_monthly_rmse(ax_monthly, df)

        # Panel labels
        for j, ax in enumerate([ax_hydro, ax_scatter, ax_fdc, ax_monthly]):
            label = chr(ord("a") + row * 4 + j)
            ax.text(-0.12, 1.08, f"({label})", transform=ax.transAxes,
                    fontsize=9, fontweight="bold", va="top")

    fig.suptitle(
        "Hydra NWM Error Correction — Southern Appalachian Sites",
        fontsize=12, fontweight="bold", y=1.01,
    )

    ensure_parent(output)
    fig.savefig(output, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {output}")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--eval-csvs", nargs="+", type=Path, required=True, help="One eval CSV per site")
    ap.add_argument("--site-ids", nargs="+", required=True)
    ap.add_argument("--site-names", nargs="+", required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--event-hours", type=int, default=72, help="Half-window hours around peak for hydrograph")
    return ap


def main() -> None:
    args = build_parser().parse_args()
    plot_wrr_multi_site_panel(
        eval_csvs=args.eval_csvs,
        site_ids=args.site_ids,
        site_names=args.site_names,
        output=args.output,
        event_hours=args.event_hours,
    )


if __name__ == "__main__":
    main()
