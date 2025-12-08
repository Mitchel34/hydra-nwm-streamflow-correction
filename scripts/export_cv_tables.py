#!/usr/bin/env python3
"""Export per-fold CV metrics tables from rolling summary JSON files."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List

import pandas as pd


METRICS = ("rmse", "mae", "nse", "kge", "pbias")


def _load_summary(path: Path) -> List[dict]:
    with path.open() as fp:
        return json.load(fp)


def build_dataframe(summary: List[dict]) -> pd.DataFrame:
    records = []
    for fold in summary:
        metrics = fold["metrics"]
        record = {
            "Fold": fold["fold"],
            "Train Years": f"{fold['train_start'][:4]}–{fold['train_end'][:4]}",
            "Test Year": f"{fold['test_start'][:4]}",
        }
        for key in METRICS:
            record[f"NWM {key.upper()}"] = metrics["baseline"][key]
            record[f"Hydra {key.upper()}"] = metrics["corrected"][key]
        record["ΔRMSE (%)"] = metrics.get("rmse_improvement_pct")
        records.append(record)
    return pd.DataFrame.from_records(records)


def write_outputs(df: pd.DataFrame, csv_out: Path | None, tex_out: Path | None) -> None:
    if csv_out:
        csv_out.parent.mkdir(parents=True, exist_ok=True)
        df.to_csv(csv_out, index=False)
        print(f"Wrote CSV table to {csv_out}")
    if tex_out:
        tex_out.parent.mkdir(parents=True, exist_ok=True)
        tex_out.write_text(df.to_latex(index=False, float_format="%.3f"))
        print(f"Wrote LaTeX table to {tex_out}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--summary",
        type=Path,
        required=True,
        help="JSON file produced by rolling CV (e.g., *_rolling_summary.json)",
    )
    parser.add_argument("--csv-out", type=Path, default=None, help="Optional CSV output path")
    parser.add_argument("--tex-out", type=Path, default=None, help="Optional LaTeX output path")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    summary = _load_summary(args.summary)
    df = build_dataframe(summary)

    default_stem = args.summary.stem.replace("_rolling_summary", "")
    if args.csv_out is None:
        args.csv_out = Path(f"local_only/results/tables/{default_stem}_per_fold_metrics.csv")
    if args.tex_out is None:
        args.tex_out = Path(f"local_only/results/tables/{default_stem}_per_fold_metrics.tex")

    write_outputs(df, args.csv_out, args.tex_out)


if __name__ == "__main__":
    main()
