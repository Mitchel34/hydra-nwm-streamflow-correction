#!/usr/bin/env python3
"""Split a combined training parquet into per-site training parquets."""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", type=Path, required=True, help="Combined training parquet")
    parser.add_argument("--out-dir", type=Path, default=Path("data/clean/modeling"), help="Output directory")
    parser.add_argument("--output-prefix", default="hourly_training", help="Prefix for output files")
    args = parser.parse_args()

    args.out_dir.mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(args.data)
    if "site_id" not in df.columns:
        raise ValueError("Expected 'site_id' column in combined dataset")

    for site_id, group in df.groupby("site_id"):
        out_path = args.out_dir / f"{args.output_prefix}_{site_id}.parquet"
        group.to_parquet(out_path, index=False)
        print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
