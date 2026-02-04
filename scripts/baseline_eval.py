#!/usr/bin/env python3
"""Compute baseline metrics (NWM vs USGS) and save quick plots per site."""

from __future__ import annotations

import argparse
from pathlib import Path

import math
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt


def _ensure_out_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _best_window(df: pd.DataFrame, days: int, require_cols: list[str]) -> pd.DataFrame:
    if df.empty:
        return df
    df = df.sort_values("timestamp").reset_index(drop=True)
    window_len = max(1, int(days * 24))
    if len(df) <= window_len:
        return df
    valid = df[require_cols].notna().all(axis=1).astype(int)
    scores = valid.rolling(window_len, min_periods=window_len).sum()
    if scores.max() <= 0:
        return df.iloc[:window_len]
    end_idx = int(scores.idxmax())
    start_idx = max(0, end_idx - window_len + 1)
    return df.iloc[start_idx:end_idx + 1]


def _plot_window(
    df: pd.DataFrame,
    site_id: str,
    site_name: str,
    out_path: Path,
    days: int,
    hydra_df: pd.DataFrame | None = None,
) -> None:
    if df.empty:
        return

    plot_df = df.copy()
    if hydra_df is not None and not hydra_df.empty:
        plot_df = hydra_df.copy()

    plot_df = _best_window(plot_df, days, ["usgs_cms", "nwm_cms"])
    if plot_df.empty:
        return
    plt.figure(figsize=(10, 4))
    plt.plot(plot_df["timestamp"], plot_df["usgs_cms"], label="USGS", color="black", linewidth=1.2)
    plt.plot(plot_df["timestamp"], plot_df["nwm_cms"], label="NWM", color="tab:blue", alpha=0.8)
    if "hydra_cms" in plot_df.columns:
        plt.plot(plot_df["timestamp"], plot_df["hydra_cms"], label="Hydra", color="tab:red", alpha=0.85)
    plt.title(f"Hydrograph: {site_name} ({site_id})")
    plt.ylabel("Streamflow (cms)")
    plt.xlabel("Timestamp")
    plt.legend()
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()


def _safe_mean(x: np.ndarray) -> float:
    return float(np.nanmean(x)) if x.size else float("nan")


def _spearman_corr(x: np.ndarray, y: np.ndarray) -> float:
    if x.size == 0 or y.size == 0:
        return float("nan")
    x_rank = pd.Series(x).rank(method="average").to_numpy()
    y_rank = pd.Series(y).rank(method="average").to_numpy()
    if np.std(x_rank) == 0 or np.std(y_rank) == 0:
        return float("nan")
    return float(np.corrcoef(x_rank, y_rank)[0, 1])


def compute_hydro_metrics(pred: np.ndarray, obs: np.ndarray) -> dict[str, float]:
    if pred.size == 0 or obs.size == 0:
        return {k: float("nan") for k in ["rmse", "mae", "nse", "kge", "pbias", "pearson_r", "spearman_r"]}

    pred = pred.astype(np.float64)
    obs = obs.astype(np.float64)

    diff = pred - obs
    mse = float(np.mean(diff**2))
    rmse = float(np.sqrt(mse))
    mae = float(np.mean(np.abs(diff)))

    obs_mean = _safe_mean(obs)
    denom = np.sum((obs - obs_mean) ** 2)
    nse = float(1.0 - (np.sum(diff**2) / denom)) if denom > 0 else float("nan")

    pred_mean = _safe_mean(pred)
    pred_std = float(np.std(pred))
    obs_std = float(np.std(obs))
    pearson = float(np.corrcoef(pred, obs)[0, 1]) if pred_std > 0 and obs_std > 0 else float("nan")

    alpha = (pred_std / obs_std) if obs_std > 0 else float("nan")
    beta = (pred_mean / obs_mean) if obs_mean != 0 else float("nan")
    if not np.isnan(alpha) and not np.isnan(beta) and not np.isnan(pearson):
        kge = float(1.0 - math.sqrt((pearson - 1.0) ** 2 + (alpha - 1.0) ** 2 + (beta - 1.0) ** 2))
    else:
        kge = float("nan")

    pbias = float(100.0 * np.sum(diff) / np.sum(obs)) if np.sum(obs) != 0 else float("nan")
    spearman = _spearman_corr(pred, obs)

    return {
        "rmse": rmse,
        "mae": mae,
        "nse": nse,
        "kge": kge,
        "pbias": pbias,
        "pearson_r": pearson,
        "spearman_r": spearman,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="Combined parquet with all sites")
    parser.add_argument("--out-dir", type=Path, default=Path("results/baseline"), help="Output directory")
    parser.add_argument("--plot-days", type=int, default=14, help="Days to include in quick hydrograph plot")
    parser.add_argument(
        "--hydra-eval-dir",
        type=Path,
        default=Path("data/clean/modeling"),
        help="Directory containing hydra eval CSVs (used for overlay)",
    )
    parser.add_argument(
        "--output-prefix",
        default=None,
        help="Optional explicit prefix for outputs (e.g., watauga_2010_2020)",
    )
    args = parser.parse_args()

    _ensure_out_dir(args.out_dir)
    df = pd.read_parquet(args.data)
    if "timestamp" not in df.columns:
        raise ValueError("Expected 'timestamp' column in dataset")
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    required = {"site_id", "site_name", "nwm_cms", "usgs_cms"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"Dataset missing required columns: {sorted(missing)}")

    prefix = args.output_prefix or args.data.stem
    rows = []
    for site_id, group in df.groupby("site_id"):
        site_name = group["site_name"].iloc[0]
        valid = group[["nwm_cms", "usgs_cms"]].replace([np.inf, -np.inf], np.nan).dropna()
        metrics = compute_hydro_metrics(valid["nwm_cms"].to_numpy(), valid["usgs_cms"].to_numpy())
        rows.append(
            {
                "site_id": site_id,
                "site_name": site_name,
                "rmse": metrics["rmse"],
                "nse": metrics["nse"],
                "pbias": metrics["pbias"],
                "cc": metrics["pearson_r"],
            }
        )
        plot_path = args.out_dir / f"{prefix}_baseline_hydrograph_{site_id}.png"

        hydra_df = None
        biascal_path = args.hydra_eval_dir / f"watauga_cluster_2010_2020_hydra_{site_id}_eval_biascal.csv"
        eval_path = args.hydra_eval_dir / f"watauga_cluster_2010_2020_hydra_{site_id}_eval.csv"
        if biascal_path.exists():
            hydra_df = pd.read_csv(biascal_path)
        elif eval_path.exists():
            hydra_df = pd.read_csv(eval_path)
        if hydra_df is not None:
            hydra_df["timestamp"] = pd.to_datetime(hydra_df["timestamp"])
            hydra_df = hydra_df.rename(
                columns={
                    "corrected_true_cms": "usgs_cms",
                    "corrected_pred_cms": "hydra_cms",
                }
            )
            # keep only columns we need
            keep = [c for c in ["timestamp", "usgs_cms", "nwm_cms", "hydra_cms"] if c in hydra_df.columns]
            hydra_df = hydra_df[keep]

        _plot_window(group, site_id, site_name, plot_path, args.plot_days, hydra_df=hydra_df)

    out = pd.DataFrame(rows).sort_values("site_id")
    out_path = args.out_dir / f"{prefix}_baseline_metrics.csv"
    out.to_csv(out_path, index=False)
    print(f"Wrote baseline metrics: {out_path}")


if __name__ == "__main__":
    main()
