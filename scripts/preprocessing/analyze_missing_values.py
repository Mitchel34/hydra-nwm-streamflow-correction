#!/usr/bin/env python3
"""Summarize missing values for key variables per site."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--data", type=Path, required=True, help="Combined training parquet")
    ap.add_argument("--out", type=Path, default=Path("results/qa/missing_values_summary.csv"))
    args = ap.parse_args()

    df = pd.read_parquet(args.data)
    df["timestamp"] = pd.to_datetime(df["timestamp"])

    cols = ["usgs_cms", "nwm_cms", "precip_mm", "temp_c", "soil_moisture_vwc"]
    existing = [c for c in cols if c in df.columns]
    if "site_id" not in df.columns:
        raise ValueError("Expected 'site_id' column in dataset")

    rows = []
    for site_id, group in df.groupby("site_id"):
        total = len(group)
        row = {"site_id": site_id, "rows": total}
        for col in existing:
            missing = int(group[col].isna().sum())
            row[f"{col}_missing"] = missing
            row[f"{col}_missing_pct"] = missing / total * 100 if total else 0.0
        row["start"] = group["timestamp"].min()
        row["end"] = group["timestamp"].max()
        rows.append(row)

    out = pd.DataFrame(rows).sort_values("site_id")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(args.out, index=False)
    print(f"Wrote missing summary: {args.out}")


if __name__ == "__main__":
    main()
