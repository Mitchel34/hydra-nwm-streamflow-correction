#!/usr/bin/env python3
"""Aggregate per-site LSTM metrics into a summary CSV and bar plot."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List, Dict

import matplotlib.pyplot as plt
import pandas as pd

METRICS_KEYS = ["rmse", "nse", "pbias", "pearson_r"]


def load_metrics(files: List[Path]) -> pd.DataFrame:
    rows = []
    for fp in files:
        payload = json.loads(fp.read_text())
        site_id = fp.stem.split("_")[-1]
        baseline = payload.get("baseline", {})
        corrected = payload.get("corrected", {})
        row = {
            "site_id": site_id,
            "rmse_baseline": baseline.get("rmse"),
            "rmse_lstm": corrected.get("rmse"),
            "nse_baseline": baseline.get("nse"),
            "nse_lstm": corrected.get("nse"),
            "pbias_baseline": baseline.get("pbias"),
            "pbias_lstm": corrected.get("pbias"),
            "cc_baseline": baseline.get("pearson_r"),
            "cc_lstm": corrected.get("pearson_r"),
            "delta_rmse_pct": payload.get("rmse_improvement_pct"),
        }
        rows.append(row)
    return pd.DataFrame(rows).sort_values("site_id")


def plot_rmse_nse(df: pd.DataFrame, out_path: Path) -> None:
    plt.figure(figsize=(8, 4))
    x = range(len(df))
    width = 0.35
    plt.bar([i - width / 2 for i in x], df["rmse_baseline"], width, label="NWM RMSE", color="tab:gray")
    plt.bar([i + width / 2 for i in x], df["rmse_lstm"], width, label="LSTM RMSE", color="tab:blue", alpha=0.75)
    plt.xticks(list(x), df["site_id"], rotation=0)
    plt.ylabel("RMSE (cms)")
    plt.title("Baseline vs LSTM RMSE (2010–2020)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path.with_name(out_path.stem + "_rmse.png"), dpi=150)
    plt.close()

    plt.figure(figsize=(8, 4))
    plt.bar([i - width / 2 for i in x], df["nse_baseline"], width, label="NWM NSE", color="tab:gray")
    plt.bar([i + width / 2 for i in x], df["nse_lstm"], width, label="LSTM NSE", color="tab:blue", alpha=0.75)
    plt.xticks(list(x), df["site_id"], rotation=0)
    plt.ylabel("NSE")
    plt.title("Baseline vs LSTM NSE (2010–2020)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path.with_name(out_path.stem + "_nse.png"), dpi=150)
    plt.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--metrics-glob", default="data/clean/modeling/watauga_cluster_2010_2020_lstm_*_metrics.json")
    ap.add_argument("--out-prefix", default="results/lstm/watauga_cluster_2010_2020_lstm_summary")
    args = ap.parse_args()

    files = sorted(Path(".").glob(args.metrics_glob))
    if not files:
        raise FileNotFoundError(f"No metrics files matched {args.metrics_glob}")

    out_prefix = Path(args.out_prefix)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)

    df = load_metrics(files)
    csv_path = out_prefix.with_suffix(".csv")
    df.to_csv(csv_path, index=False)
    plot_rmse_nse(df, out_prefix)
    print(f"Wrote summary: {csv_path}")


if __name__ == "__main__":
    main()
