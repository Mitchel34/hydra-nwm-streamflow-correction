#!/usr/bin/env python3
"""WRR-style hydrograph overlays for high-flow and typical periods."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


def _window_around(df: pd.DataFrame, center_idx: int, hours: int) -> pd.DataFrame:
    start = max(0, center_idx - hours)
    end = min(len(df), center_idx + hours + 1)
    return df.iloc[start:end]


def _plot(df: pd.DataFrame, out_path: Path, title: str) -> None:
    plt.figure(figsize=(10, 4))
    plt.plot(df["timestamp"], df["usgs_cms"], label="USGS", color="black", linewidth=1.2)
    plt.plot(df["timestamp"], df["nwm_cms"], label="NWM", color="tab:blue", alpha=0.8)
    plt.plot(df["timestamp"], df["hydra_cms"], label="Hydra", color="tab:red", alpha=0.85)
    plt.title(title)
    plt.ylabel("Streamflow (cms)")
    plt.xlabel("Timestamp")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=200)
    plt.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--eval-csv", type=Path, required=True, help="Hydra eval CSV")
    ap.add_argument("--site-id", required=True)
    ap.add_argument("--site-name", required=True)
    ap.add_argument("--out-dir", type=Path, default=Path("results/figures"))
    ap.add_argument("--hours", type=int, default=72, help="Half-window hours around center event")
    args = ap.parse_args()

    df = pd.read_csv(args.eval_csv)
    df["timestamp"] = pd.to_datetime(df["timestamp"])
    if "corrected_true_cms" in df.columns:
        df["usgs_cms"] = df["corrected_true_cms"]
    if "corrected_pred_cms" in df.columns:
        df["hydra_cms"] = df["corrected_pred_cms"]
    df = df.dropna(subset=["usgs_cms", "nwm_cms", "hydra_cms"]).sort_values("timestamp").reset_index(drop=True)

    # High-flow window (max USGS)
    peak_idx = int(df["usgs_cms"].idxmax())
    high_df = _window_around(df, peak_idx, args.hours)
    args.out_dir.mkdir(parents=True, exist_ok=True)
    _plot(
        high_df,
        args.out_dir / f"wrr_hydrograph_highflow_{args.site_id}.pdf",
        f"High-Flow Event: {args.site_name} ({args.site_id})",
    )

    # Typical window (median flow)
    median_val = df["usgs_cms"].median()
    mid_idx = int((df["usgs_cms"] - median_val).abs().idxmin())
    typical_df = _window_around(df, mid_idx, args.hours)
    _plot(
        typical_df,
        args.out_dir / f"wrr_hydrograph_typical_{args.site_id}.pdf",
        f"Typical Period: {args.site_name} ({args.site_id})",
    )


if __name__ == "__main__":
    main()
