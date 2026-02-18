#!/usr/bin/env python3
"""Build per-site and combined processed parquet files from the training dataset."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def _select_columns(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["hour_of_day"] = pd.to_datetime(df["timestamp"]).dt.hour
    df["error"] = df["usgs_cms"] - df["nwm_cms"]
    keep = [
        "timestamp",
        "nwm_cms",
        "usgs_cms",
        "error",
        "precip_mm",
        "soil_moisture_vwc",
        "temp_c",
        "doy_sin",
        "doy_cos",
        "month_sin",
        "month_cos",
        "hour_of_day",
    ]
    existing = [c for c in keep if c in df.columns]
    return df[existing]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="Combined training parquet")
    parser.add_argument("--out-dir", type=Path, default=Path("data/processed"), help="Output directory")
    parser.add_argument(
        "--output-prefix",
        default=None,
        help="Optional explicit prefix for output filenames (e.g., watauga_2010_2020)",
    )
    args = parser.parse_args()

    _ensure_dir(args.out_dir)
    df = pd.read_parquet(args.data)
    if "site_id" not in df.columns:
        raise ValueError("Expected 'site_id' column in combined dataset")

    combined = _select_columns(df)
    combined["site_id"] = df["site_id"].values
    prefix = args.output_prefix or args.data.stem
    combined_path = args.out_dir / f"{prefix}_all_sites.parquet"
    combined.to_parquet(combined_path, index=False)

    for site_id, group in df.groupby("site_id"):
        site_df = _select_columns(group)
        out_path = args.out_dir / f"{prefix}_site_{site_id}.parquet"
        site_df.to_parquet(out_path, index=False)

    print(f"Wrote: {combined_path}")


if __name__ == "__main__":
    main()
