#!/usr/bin/env python3
"""Impute missing USGS values using simple averages (rolling mean + site mean)."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def impute_usgs(group: pd.DataFrame, window: int) -> pd.DataFrame:
    group = group.sort_values("timestamp").copy()
    usgs = group["usgs_cms"]
    if usgs.isna().any():
        # Rolling mean fill (centered) then forward/backward, then site mean
        roll = usgs.rolling(window=window, min_periods=1, center=True).mean()
        filled = usgs.fillna(roll)
        filled = filled.ffill().bfill()
        filled = filled.fillna(filled.mean())
        group["usgs_cms"] = filled
        # Recompute residual/error if present
        if "y_residual_cms" in group.columns:
            group["y_residual_cms"] = group["usgs_cms"] - group["nwm_cms"]
        if "y_corrected_cms" in group.columns:
            group["y_corrected_cms"] = group["usgs_cms"]
        if "error" in group.columns:
            group["error"] = group["usgs_cms"] - group["nwm_cms"]
    return group


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", type=Path, required=True, help="Combined training parquet")
    ap.add_argument("--out", type=Path, required=True, help="Output parquet path")
    ap.add_argument("--window-hours", type=int, default=24, help="Rolling window (hours) for averaging")
    args = ap.parse_args()

    df = pd.read_parquet(args.data)
    if "site_id" not in df.columns:
        raise ValueError("Expected 'site_id' column in dataset")
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    out = (
        df.groupby("site_id", group_keys=False)
          .apply(lambda g: impute_usgs(g, args.window_hours))
          .reset_index(drop=True)
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    out.to_parquet(args.out, index=False)
    print(f"Wrote imputed dataset: {args.out}")


if __name__ == "__main__":
    main()
