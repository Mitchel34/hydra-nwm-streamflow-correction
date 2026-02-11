#!/usr/bin/env python3
"""WRR-style rolling-window metric time series.

Computes rolling 30-day NSE and KGE for both NWM and Hydra-corrected predictions
over the test period.  Shows temporal stability of the correction and identifies
seasons where performance degrades.

Usage:
    python viz/plot_rolling_metrics.py \
        --eval-csv data/clean/modeling/exp_physics_03161000_eval.csv \
        --site-id 03161000 \
        --site-name "S. Fork New River, Jefferson NC" \
        --output results/figures/rolling_metrics_03161000.png
"""

from __future__ import annotations

import argparse
import math
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

from viz.colors import COLORS
from viz.style import apply_wrr_style
from viz.utils import ensure_parent


def _rolling_nse(pred: pd.Series, obs: pd.Series, window: int) -> pd.Series:
    """Compute rolling NSE with a given window size (in timesteps)."""
    sq_err = (pred - obs) ** 2
    obs_var = (obs - obs.rolling(window, min_periods=window // 2).mean()) ** 2
    numer = sq_err.rolling(window, min_periods=window // 2).sum()
    denom = obs_var.rolling(window, min_periods=window // 2).sum()
    return 1.0 - numer / denom.replace(0, np.nan)


def _rolling_kge(pred: pd.Series, obs: pd.Series, window: int) -> pd.Series:
    """Compute rolling KGE with a given window size."""
    results = []
    half = window // 2
    for i in range(len(pred)):
        lo = max(0, i - half)
        hi = min(len(pred), i + half + 1)
        if hi - lo < half:
            results.append(np.nan)
            continue
        p = pred.iloc[lo:hi].to_numpy()
        o = obs.iloc[lo:hi].to_numpy()
        mask = np.isfinite(p) & np.isfinite(o)
        if mask.sum() < half:
            results.append(np.nan)
            continue
        p, o = p[mask], o[mask]
        r = float(np.corrcoef(p, o)[0, 1]) if np.std(p) > 0 and np.std(o) > 0 else np.nan
        alpha = float(np.std(p) / np.std(o)) if np.std(o) > 0 else np.nan
        beta = float(np.mean(p) / np.mean(o)) if np.mean(o) != 0 else np.nan
        if any(np.isnan(v) for v in [r, alpha, beta]):
            results.append(np.nan)
        else:
            results.append(1.0 - math.sqrt((r - 1) ** 2 + (alpha - 1) ** 2 + (beta - 1) ** 2))
    return pd.Series(results, index=pred.index)


def plot_rolling_metrics(
    *,
    csv_path: str | Path,
    output: str | Path,
    site_id: str = "",
    site_name: str = "",
    window_days: int = 30,
) -> None:
    apply_wrr_style()
    df = pd.read_csv(csv_path, parse_dates=["timestamp"])

    obs_col = "corrected_true_cms" if "corrected_true_cms" in df.columns else "usgs_cms"
    df = df.dropna(subset=[obs_col, "corrected_pred_cms", "nwm_cms"]).sort_values("timestamp").reset_index(drop=True)

    # Infer timestep (hourly = 24 steps/day)
    if len(df) > 1:
        dt = (df["timestamp"].iloc[1] - df["timestamp"].iloc[0]).total_seconds()
        steps_per_day = max(1, int(86400 / dt))
    else:
        steps_per_day = 24
    window = window_days * steps_per_day

    obs = df[obs_col]
    nwm = df["nwm_cms"]
    corr = df["corrected_pred_cms"]
    ts = df["timestamp"]

    nwm_nse = _rolling_nse(nwm, obs, window)
    corr_nse = _rolling_nse(corr, obs, window)
    nwm_kge = _rolling_kge(nwm, obs, window)
    corr_kge = _rolling_kge(corr, obs, window)

    fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(12, 6), sharex=True)

    # NSE panel
    ax1.plot(ts, nwm_nse, color=COLORS["nwm"], linewidth=1.0, alpha=0.8, label="NWM")
    ax1.plot(ts, corr_nse, color=COLORS["ml"], linewidth=1.0, alpha=0.9, label="Hydra")
    ax1.axhline(0, color="gray", linewidth=0.6, linestyle="--")
    ax1.set_ylabel(f"Rolling {window_days}-day NSE", fontsize=10)
    ax1.legend(fontsize=9, loc="lower left")
    ax1.set_ylim(-1.5, 1.05)
    ax1.text(-0.08, 1.05, "(a)", transform=ax1.transAxes, fontsize=11, fontweight="bold")

    # KGE panel
    ax2.plot(ts, nwm_kge, color=COLORS["nwm"], linewidth=1.0, alpha=0.8, label="NWM")
    ax2.plot(ts, corr_kge, color=COLORS["ml"], linewidth=1.0, alpha=0.9, label="Hydra")
    ax2.axhline(0, color="gray", linewidth=0.6, linestyle="--")
    ax2.set_ylabel(f"Rolling {window_days}-day KGE", fontsize=10)
    ax2.set_xlabel("Date", fontsize=10)
    ax2.legend(fontsize=9, loc="lower left")
    ax2.set_ylim(-1.5, 1.05)
    ax2.text(-0.08, 1.05, "(b)", transform=ax2.transAxes, fontsize=11, fontweight="bold")
    ax2.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    ax2.xaxis.set_major_locator(mdates.MonthLocator(interval=3))

    title = f"Rolling {window_days}-Day Performance"
    if site_name:
        title += f" — {site_name}"
    if site_id:
        title += f" ({site_id})"
    fig.suptitle(title, fontsize=12, fontweight="bold", y=1.01)

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
    ap.add_argument("--window-days", type=int, default=30)
    return ap


def main() -> None:
    args = build_parser().parse_args()
    plot_rolling_metrics(
        csv_path=args.eval_csv,
        output=args.output,
        site_id=args.site_id,
        site_name=args.site_name,
        window_days=args.window_days,
    )


if __name__ == "__main__":
    main()
