#!/usr/bin/env python3
"""Build a summary CSV of best v3 results per site for WRR bar charts.

Reads results/experiment_results.json, filters to model_version=='v3',
picks the best experiment per site (lowest corrected RMSE), and writes
a CSV compatible with viz/plot_wrr_performance_bars.py.
"""

import json
import csv
from pathlib import Path

RESULTS_JSON = Path("results/experiment_results.json")
OUTPUT_CSV = Path("results/wrr_v3_summary.csv")


def main() -> None:
    with open(RESULTS_JSON) as f:
        data = json.load(f)

    results = data["results"]
    v3 = [r for r in results if r.get("model_version") == "v3"]

    # Group by site, pick best (lowest corrected RMSE)
    best_per_site: dict = {}
    for r in v3:
        sid = r["site_id"]
        if sid not in best_per_site or r["corrected"]["rmse"] < best_per_site[sid]["corrected"]["rmse"]:
            best_per_site[sid] = r

    rows = []
    for sid in sorted(best_per_site.keys()):
        r = best_per_site[sid]
        rows.append({
            "site_id": sid,
            "experiment": r["experiment"],
            "rmse_baseline": round(r["baseline"]["rmse"], 3),
            "rmse_hydra": round(r["corrected"]["rmse"], 3),
            "nse_baseline": round(r["baseline"]["nse"], 3),
            "nse_hydra": round(r["corrected"]["nse"], 3),
            "pbias_baseline": round(r["baseline"]["pbias"], 2),
            "pbias_hydra": round(r["corrected"]["pbias"], 2),
            "cc_baseline": round(r["baseline"]["pearson_r"], 3),
            "cc_hydra": round(r["corrected"]["pearson_r"], 3),
            "kge_baseline": round(r["baseline"]["kge"], 3),
            "kge_hydra": round(r["corrected"]["kge"], 3),
            "rmse_improvement_pct": round(r["rmse_improvement_pct"], 1),
        })

    OUTPUT_CSV.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote: {OUTPUT_CSV}")
    for row in rows:
        print(f"  {row['site_id']} ({row['experiment']}): "
              f"RMSE {row['rmse_baseline']} -> {row['rmse_hydra']} "
              f"({row['rmse_improvement_pct']}%), "
              f"NSE {row['nse_baseline']} -> {row['nse_hydra']}")


if __name__ == "__main__":
    main()
