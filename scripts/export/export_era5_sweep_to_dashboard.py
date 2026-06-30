#!/usr/bin/env python3
"""Export completed ERA5 Hydra sweep tables for the public dashboard."""

from __future__ import annotations

import csv
import json
import re
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[2]
SWEEP_DIR = ROOT / "revision_artifacts" / "era5_feature_sweep"
TABLES_DIR = SWEEP_DIR / "tables"
SUMMARY_CSV = TABLES_DIR / "ERA5_HYDRA_SWEEP_SUMMARY.csv"
IMPACTS_CSV = TABLES_DIR / "ERA5_HYDRA_SWEEP_IMPACTS.csv"
COMPLETED_CSV = TABLES_DIR / "ERA5_HYDRA_SWEEP_COMPLETED_RUNS.csv"
CLAIM_GRAPH = SWEEP_DIR / "ERA5_HYDRA_SWEEP_CLAIM_GRAPH.md"
COMPLETION_AUDIT = SWEEP_DIR / "FULL_SWEEP_COMPLETION_AUDIT_20260628T231250Z.md"
OUT_PATH = ROOT / "dashboard" / "public" / "data" / "era5_sweep.json"


SITE_LABELS = {
    "03161000": "Jefferson",
    "03164000": "Galax",
    "03479000": "Sugar Grove",
}

FEATURE_LABELS = {
    "precip_mm": "Precipitation",
    "temp_c": "Temperature",
    "soil_moisture_vwc": "Soil moisture",
    "doy_sin": "Day-of-year sine",
    "doy_cos": "Day-of-year cosine",
    "month_sin": "Month sine",
    "month_cos": "Month cosine",
}

MODE_LABELS = {
    "all": "All eligible",
    "reduced": "Reduced nonredundant",
    "single_group": "Single group",
    "drop_group": "Drop group",
    "single_feature": "Single feature",
    "drop_feature": "Drop feature",
}


def _read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as f:
        return list(csv.DictReader(f))


def _coerce(value: str) -> Any:
    if value == "":
        return None
    try:
        if re.fullmatch(r"-?\d+", value):
            return int(value)
        return float(value)
    except ValueError:
        return value


def _clean_row(row: dict[str, str]) -> dict[str, Any]:
    string_fields = {"site_id", "config", "mode", "features", "status", "seed"}
    cleaned: dict[str, Any] = {
        key: value if key in string_fields else _coerce(value)
        for key, value in row.items()
    }
    features = row.get("features", "")
    cleaned["feature_list"] = [f for f in features.split("|") if f]
    cleaned["site_label"] = SITE_LABELS.get(row.get("site_id", ""), row.get("site_id", ""))
    cleaned["mode_label"] = MODE_LABELS.get(row.get("mode", ""), row.get("mode", ""))
    cleaned["config_label"] = row.get("config", "").replace("_", " ").title()
    return cleaned


def _audit_generated_at() -> str:
    text = COMPLETION_AUDIT.read_text()
    match = re.search(r"^Generated:\s*(\S+)", text, re.MULTILINE)
    if not match:
        raise RuntimeError(f"Could not find Generated timestamp in {COMPLETION_AUDIT}")
    return match.group(1)


def _top_impacts(rows: list[dict[str, Any]], limit: int = 8) -> list[dict[str, Any]]:
    candidates = [
        row
        for row in rows
        if row.get("mode") in {"drop_group", "drop_feature"}
        and isinstance(row.get("delta_rmse_vs_all"), float)
        and row["delta_rmse_vs_all"] > 0
    ]
    return sorted(candidates, key=lambda r: r["delta_rmse_vs_all"], reverse=True)[:limit]


def _all_eligible(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [row for row in rows if row.get("config") == "all_eligible_era5"]


def main() -> None:
    summary = [_clean_row(row) for row in _read_rows(SUMMARY_CSV)]
    impacts = [_clean_row(row) for row in _read_rows(IMPACTS_CSV)]
    completed = _read_rows(COMPLETED_CSV)

    all_eligible = _all_eligible(summary)
    if len(summary) != 72 or len(impacts) != 72 or len(completed) != 216:
        raise RuntimeError(
            "Unexpected ERA5 sweep row counts: "
            f"summary={len(summary)}, impacts={len(impacts)}, completed={len(completed)}"
        )

    payload = {
        "generated_at": _audit_generated_at(),
        "source_artifacts": {
            "completed_runs": str(COMPLETED_CSV.relative_to(ROOT)),
            "summary": str(SUMMARY_CSV.relative_to(ROOT)),
            "impacts": str(IMPACTS_CSV.relative_to(ROOT)),
            "claim_graph": str(CLAIM_GRAPH.relative_to(ROOT)),
            "completion_audit": str(COMPLETION_AUDIT.relative_to(ROOT)),
        },
        "row_counts": {
            "completed_runs": len(completed),
            "summary": len(summary),
            "impacts": len(impacts),
            "sites": len({row["site_id"] for row in summary}),
        },
        "sites": SITE_LABELS,
        "feature_labels": FEATURE_LABELS,
        "mode_labels": MODE_LABELS,
        "guardrails": [
            "Feature drops indicate predictive sensitivity, not hydrologic causality.",
            "Confirmatory claims use only features available in the 2019-2020 test period.",
            "Gauge-free NWM-plus-ERA5 gains are lower than gauge-informed Hydra corrections.",
            "One-hour persistence remains a strong point-prediction limitation.",
        ],
        "headline": {
            "all_eligible": all_eligible,
            "top_predictive_sensitivities": _top_impacts(impacts),
        },
        "summary": summary,
        "impacts": impacts,
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(payload, indent=2) + "\n")
    print(f"Wrote {OUT_PATH.relative_to(ROOT)}")
    print(
        "Counts: "
        f"completed={len(completed)}, summary={len(summary)}, impacts={len(impacts)}, "
        f"sites={payload['row_counts']['sites']}"
    )


if __name__ == "__main__":
    main()
