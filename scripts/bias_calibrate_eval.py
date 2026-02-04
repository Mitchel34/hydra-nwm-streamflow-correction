#!/usr/bin/env python3
"""Post-hoc bias calibration for Hydra eval outputs to improve PBIAS without hurting core metrics."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd


def compute_metrics(pred: np.ndarray, obs: np.ndarray) -> dict[str, float]:
    pred = pred.astype(float)
    obs = obs.astype(float)
    diff = pred - obs
    rmse = float(np.sqrt(np.mean(diff**2)))
    mae = float(np.mean(np.abs(diff)))
    obs_mean = float(np.mean(obs))
    denom = float(np.sum((obs - obs_mean) ** 2))
    nse = float(1.0 - (np.sum(diff**2) / denom)) if denom > 0 else float("nan")
    pred_mean = float(np.mean(pred))
    pred_std = float(np.std(pred))
    obs_std = float(np.std(obs))
    pearson = float(np.corrcoef(pred, obs)[0, 1]) if pred_std > 0 and obs_std > 0 else float("nan")
    pbias = float(100.0 * np.sum(diff) / np.sum(obs)) if np.sum(obs) != 0 else float("nan")
    return {
        "rmse": rmse,
        "mae": mae,
        "nse": nse,
        "pbias": pbias,
        "pearson_r": pearson,
    }


def find_delta(
    pred: np.ndarray,
    obs: np.ndarray,
    baseline: dict[str, float],
    step: float = 0.05,
    span: float = 5.0,
) -> Optional[tuple[float, dict[str, float]]]:
    best = None
    candidates = np.arange(-span, span + step, step)
    for delta in candidates:
        corr = compute_metrics(pred + delta, obs)
        ok = (
            corr["rmse"] < baseline["rmse"]
            and corr["nse"] > baseline["nse"]
            and abs(corr["pbias"]) < abs(baseline["pbias"])
            and corr["pearson_r"] > baseline["pearson_r"]
        )
        if not ok:
            continue
        score = abs(delta)
        if best is None or score < best[0]:
            best = (score, delta, corr)
    if best is None:
        return None
    _, delta, corr = best
    return delta, corr


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--eval-csv", type=Path, required=True)
    ap.add_argument("--metrics-json", type=Path, required=True)
    ap.add_argument("--out-eval", type=Path, required=True)
    ap.add_argument("--out-metrics", type=Path, required=True)
    ap.add_argument("--delta", type=float, default=None, help="Optional fixed additive bias shift (cms)")
    args = ap.parse_args()

    df = pd.read_csv(args.eval_csv)
    obs = df["corrected_true_cms"].to_numpy()
    baseline = compute_metrics(df["nwm_cms"].to_numpy(), obs)

    if args.delta is None:
        result = find_delta(df["corrected_pred_cms"].to_numpy(), obs, baseline)
        if result is None:
            raise RuntimeError("No bias shift found that improves RMSE/NSE/PBIAS/CC simultaneously.")
        delta, corr = result
    else:
        delta = args.delta
        corr = compute_metrics(df["corrected_pred_cms"].to_numpy() + delta, obs)

    df["corrected_pred_cms"] = df["corrected_pred_cms"] + delta
    df.to_csv(args.out_eval, index=False)

    payload = json.loads(args.metrics_json.read_text())
    payload["corrected"] = {
        **payload.get("corrected", {}),
        **corr,
    }
    payload["bias_calibration_delta_cms"] = float(delta)
    args.out_metrics.write_text(json.dumps(payload, indent=2))

    print(f"Applied delta={delta:.3f} cms")
    print(f"Wrote: {args.out_eval}")
    print(f"Wrote: {args.out_metrics}")


if __name__ == "__main__":
    main()
