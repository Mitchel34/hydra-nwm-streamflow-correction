#!/usr/bin/env python3
"""WRR-style performance bars (Baseline vs Hydra) per site."""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd


def _plot_metric(df: pd.DataFrame, metric: str, label: str, out_path: Path) -> None:
    x = range(len(df))
    width = 0.35
    plt.rcParams.update({
        "font.size": 14,
        "axes.labelsize": 14,
        "xtick.labelsize": 14,
        "ytick.labelsize": 14,
        "legend.fontsize": 13,
        "axes.titlesize": 14,
    })
    plt.figure(figsize=(8, 4))
    plt.bar([i - width / 2 for i in x], df[f"{metric}_baseline"], width, label="NWM", color="tab:gray")
    plt.bar([i + width / 2 for i in x], df[f"{metric}_hydra"], width, label="Hydra", color="tab:red", alpha=0.75)
    plt.xticks(list(x), df["site_id"])
    plt.ylabel(label)
    plt.title(f"Baseline vs Hydra: {label}")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=200)
    plt.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--hydra-summary", type=Path, required=True, help="Hydra summary CSV")
    ap.add_argument("--out-dir", type=Path, default=Path("results/figures"))
    args = ap.parse_args()

    df = pd.read_csv(args.hydra_summary, dtype={"site_id": str})
    args.out_dir.mkdir(parents=True, exist_ok=True)

    _plot_metric(df, "rmse", "RMSE (m³/s)", args.out_dir / "wrr_rmse_bar.pdf")
    _plot_metric(df, "nse", "NSE", args.out_dir / "wrr_nse_bar.pdf")
    _plot_metric(df, "pbias", "PBIAS (%)", args.out_dir / "wrr_pbias_bar.pdf")
    _plot_metric(df, "cc", "CC (Pearson r)", args.out_dir / "wrr_cc_bar.pdf")


if __name__ == "__main__":
    main()
