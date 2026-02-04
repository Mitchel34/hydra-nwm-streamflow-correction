#!/usr/bin/env python3
"""Aggregate per-site Hydra metrics into a summary CSV and plots."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

import matplotlib.pyplot as plt
import pandas as pd


def _site_id_from_path(fp: Path) -> str:
    parts = fp.stem.split("_")
    if "hydra" in parts:
        idx = parts.index("hydra")
        if idx + 1 < len(parts):
            return parts[idx + 1]
    return parts[-1]


def load_metrics(files: List[Path]) -> pd.DataFrame:
    rows = []
    for fp in files:
        payload = json.loads(fp.read_text())
        site_id = _site_id_from_path(fp).zfill(8)
        baseline = payload.get("baseline", {})
        corrected = payload.get("corrected", {})
        row = {
            "site_id": site_id,
            "rmse_baseline": baseline.get("rmse"),
            "rmse_hydra": corrected.get("rmse"),
            "nse_baseline": baseline.get("nse"),
            "nse_hydra": corrected.get("nse"),
            "pbias_baseline": baseline.get("pbias"),
            "pbias_hydra": corrected.get("pbias"),
            "cc_baseline": baseline.get("pearson_r"),
            "cc_hydra": corrected.get("pearson_r"),
            "delta_rmse_pct": payload.get("rmse_improvement_pct"),
            "bias_calibration_delta_cms": payload.get("bias_calibration_delta_cms"),
        }
        rows.append(row)
    return pd.DataFrame(rows).sort_values("site_id")


def plot_metric(df: pd.DataFrame, metric: str, label: str, out_path: Path) -> None:
    x = range(len(df))
    width = 0.35
    plt.figure(figsize=(8, 4))
    plt.bar([i - width / 2 for i in x], df[f"{metric}_baseline"], width, label=f"NWM {label}", color="tab:gray")
    plt.bar([i + width / 2 for i in x], df[f"{metric}_hydra"], width, label=f"Hydra {label}", color="tab:red", alpha=0.75)
    plt.xticks(list(x), df["site_id"], rotation=0)
    plt.ylabel(label)
    plt.title(f"Baseline vs Hydra {label} (2010–2020)")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--metrics-glob", default="data/clean/modeling/watauga_cluster_2010_2020_hydra_*_metrics*.json")
    ap.add_argument("--out-prefix", default="results/hydra/watauga_cluster_2010_2020_hydra_summary")
    args = ap.parse_args()

    raw_files = sorted(Path(".").glob(args.metrics_glob))
    if not raw_files:
        raise FileNotFoundError(f"No metrics files matched {args.metrics_glob}")

    # Keep only hydra_v2 (exclude hydra_v1 and biasfix/pbias runs). Prefer bias-calibrated files per site.
    files_by_site: Dict[str, Path] = {}
    for fp in raw_files:
        name = fp.name
        if "hydra_v1" in name or "hydra_tuned" in name:
            continue
        if "biasfix" in name or "pbias" in name:
            continue
        site_id = _site_id_from_path(fp)
        if site_id in files_by_site:
            # Prefer bias-calibrated metrics if available.
            if "biascal" in name and "biascal" not in files_by_site[site_id].name:
                files_by_site[site_id] = fp
            continue
        files_by_site[site_id] = fp

    files = list(files_by_site.values())

    out_prefix = Path(args.out_prefix)
    out_prefix.parent.mkdir(parents=True, exist_ok=True)

    df = load_metrics(files)
    csv_path = out_prefix.with_suffix(".csv")
    df.to_csv(csv_path, index=False)

    plot_metric(df, "rmse", "RMSE (cms)", out_prefix.with_name(out_prefix.stem + "_rmse.png"))
    plot_metric(df, "nse", "NSE", out_prefix.with_name(out_prefix.stem + "_nse.png"))
    plot_metric(df, "pbias", "PBIAS (%)", out_prefix.with_name(out_prefix.stem + "_pbias.png"))
    plot_metric(df, "cc", "CC (Pearson r)", out_prefix.with_name(out_prefix.stem + "_cc.png"))

    print(f"Wrote summary: {csv_path}")


if __name__ == "__main__":
    main()
