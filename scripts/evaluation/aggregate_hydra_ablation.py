#!/usr/bin/env python3
"""Build GRU on/off (hydra_v2 vs hydra_v1) ablation table."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Dict, List

import pandas as pd


def _load_metrics(path: Path) -> Dict[str, float]:
    payload = json.loads(path.read_text())
    corrected = payload.get("corrected", {})
    baseline = payload.get("baseline", {})
    return {
        "rmse": corrected.get("rmse"),
        "nse": corrected.get("nse"),
        "pbias": corrected.get("pbias"),
        "cc": corrected.get("pearson_r"),
        "baseline_rmse": baseline.get("rmse"),
        "baseline_nse": baseline.get("nse"),
        "baseline_pbias": baseline.get("pbias"),
        "baseline_cc": baseline.get("pearson_r"),
    }


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--v2-glob", default="data/clean/modeling/watauga_cluster_2010_2020_hydra_*_metrics*.json")
    ap.add_argument("--v1-glob", default="data/clean/modeling/watauga_cluster_2010_2020_hydra_v1_*_metrics.json")
    ap.add_argument("--out", default="results/hydra/watauga_cluster_2010_2020_ablation_gru.csv")
    args = ap.parse_args()

    v2_files = sorted(Path(".").glob(args.v2_glob))
    v1_files = sorted(Path(".").glob(args.v1_glob))

    # Use biascal for 03161000 if present.
    v2_by_site: Dict[str, Path] = {}
    for fp in v2_files:
        name = fp.name
        if "hydra_v1" in name or "hydra_tuned" in name or "biasfix" in name or "pbias" in name:
            continue
        site_id = fp.stem.split("_")[fp.stem.split("_").index("hydra") + 1].zfill(8)
        if site_id in v2_by_site:
            if "biascal" in name and "biascal" not in v2_by_site[site_id].name:
                v2_by_site[site_id] = fp
        else:
            v2_by_site[site_id] = fp

    v1_by_site: Dict[str, Path] = {}
    for fp in v1_files:
        parts = fp.stem.split("_")
        site_id = parts[parts.index("v1") + 1].zfill(8) if "v1" in parts else parts[-1].zfill(8)
        v1_by_site[site_id] = fp

    rows = []
    for site_id, v2_fp in v2_by_site.items():
        v1_fp = v1_by_site.get(site_id)
        if v1_fp is None:
            continue
        v2 = _load_metrics(v2_fp)
        v1 = _load_metrics(v1_fp)
        rows.append(
            {
                "site_id": site_id,
                "rmse_hydra_v2": v2["rmse"],
                "rmse_hydra_v1": v1["rmse"],
                "nse_hydra_v2": v2["nse"],
                "nse_hydra_v1": v1["nse"],
                "pbias_hydra_v2": v2["pbias"],
                "pbias_hydra_v1": v1["pbias"],
                "cc_hydra_v2": v2["cc"],
                "cc_hydra_v1": v1["cc"],
            }
        )

    df = pd.DataFrame(rows).sort_values("site_id")
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)
    print(f"Wrote ablation table: {out_path}")


if __name__ == "__main__":
    main()
