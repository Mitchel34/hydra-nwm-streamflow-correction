#!/usr/bin/env python3
"""
Export experiment results to JSON format for the dashboard.
Aggregates metrics from all experiment runs into a single JSON file.
Also exports time-series eval CSVs as JSON for hydrograph rendering.
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd

# ---------------------------------------------------------------------------
# Filename parsing
# ---------------------------------------------------------------------------

# Pattern: exp_{experiment_name}_{8-digit site_id}_metrics.json
_METRICS_RE = re.compile(r"^exp_(.+?)_(\d{8})_metrics\.json$")


def load_metrics_json(filepath: Path) -> Dict[str, Any]:
    """Load metrics from a JSON file."""
    with open(filepath) as f:
        return json.load(f)


def extract_experiment_info(filename: str) -> Dict[str, str]:
    """Extract experiment name and site from filename.

    Handles both v2 names (``exp_baseline_03479000_metrics.json``) and
    v3 names (``exp_v3_combined_03161000_metrics.json``) by matching
    everything between the first ``exp_`` and the trailing 8-digit
    USGS site ID.
    """
    m = _METRICS_RE.match(filename)
    if m:
        return {"experiment": m.group(1), "site_id": m.group(2)}
    return {}


# ---------------------------------------------------------------------------
# Site & experiment metadata
# ---------------------------------------------------------------------------

SITES: Dict[str, Dict[str, Any]] = {
    "03161000": {
        "name": "South Fork New River near Jefferson, NC",
        "watershed": "New River",
        "type": "mid-basin",
        "lat": 36.4003,
        "lon": -81.4206,
    },
    "03164000": {
        "name": "New River near Galax, VA",
        "watershed": "New River",
        "type": "mainstem",
        "lat": 36.6456,
        "lon": -80.9272,
    },
    "03479000": {
        "name": "Watauga River near Sugar Grove, NC",
        "watershed": "Watauga",
        "type": "headwaters",
        "lat": 36.2367,
        "lon": -81.8289,
    },
    "03486000": {
        "name": "Watauga River at Elizabethton, TN",
        "watershed": "Watauga",
        "type": "regulated",
        "lat": 36.3431,
        "lon": -82.2108,
    },
}

EXPERIMENTS: Dict[str, Dict[str, str]] = {
    # ── v2 experiments ──
    "baseline": {
        "name": "Baseline (Hydra v2)",
        "description": "Current best model without new features",
    },
    "causal": {
        "name": "Causal Mask",
        "description": "Transformer with causal attention masking",
    },
    "direct": {
        "name": "Direct Mode",
        "description": "Predict USGS directly (no NWM residual)",
    },
    "physics": {
        "name": "Physics Constraint",
        "description": "Non-negativity penalty on streamflow",
    },
    "combined": {
        "name": "Combined",
        "description": "Causal mask + physics constraint",
    },
    "hydra_v1": {
        "name": "Hydra v1 (Ablation)",
        "description": "Transformer-only (no GRU)",
    },
    "hydra_v2": {
        "name": "Hydra v2",
        "description": "GRU-Transformer hybrid",
    },
    "lstm": {
        "name": "LSTM Baseline",
        "description": "Simple LSTM encoder",
    },
    # ── v3 experiments ──
    "v3_baseline": {
        "name": "Hydra v3 Baseline",
        "description": "v3 architecture with feature gate, multi-scale conv, regime bias",
    },
    "v3_causal": {
        "name": "v3 + Causal Mask",
        "description": "Hydra v3 with causal attention masking",
    },
    "v3_physics": {
        "name": "v3 + Physics",
        "description": "Hydra v3 with non-negativity constraint (\u03bb=0.1)",
    },
    "v3_combined": {
        "name": "v3 + Causal + Physics",
        "description": "Hydra v3 with causal mask and physics constraint",
    },
    "v3_eventsample": {
        "name": "v3 + Event Sampling",
        "description": "Hydra v3 with 3\u00d7 oversampling on Q90+ events",
    },
    "v3_full": {
        "name": "v3 Full",
        "description": "Hydra v3 with causal + physics + event oversampling",
    },
    "v3_autonorm": {
        "name": "v3 AutoNorm",
        "description": "v3 full + automatic loss normalisation",
    },
}


def _model_version(experiment_id: str) -> str:
    """Infer model version from experiment ID."""
    return "v3" if experiment_id.startswith("v3_") else "v2"


# ---------------------------------------------------------------------------
# Result collection
# ---------------------------------------------------------------------------

def collect_results(modeling_dir: Path) -> List[Dict[str, Any]]:
    """Glob all *_metrics.json files and parse into result dicts."""
    exp_files = sorted(modeling_dir.glob("exp_*_metrics.json"))

    if not exp_files:
        print("No experiment files found. Looking for legacy files...")
        exp_files = sorted(modeling_dir.glob("watauga_cluster_*_metrics.json"))

    results: List[Dict[str, Any]] = []

    for filepath in exp_files:
        try:
            metrics = load_metrics_json(filepath)
            info = extract_experiment_info(filepath.name)

            if not info:
                # Try legacy format parsing
                name = filepath.stem.replace("_metrics", "")
                if "hydra_v1" in name:
                    parts = name.split("hydra_v1_")
                    info = {"experiment": "hydra_v1", "site_id": parts[-1] if len(parts) > 1 else "unknown"}
                elif "hydra" in name:
                    parts = name.split("hydra_")
                    info = {"experiment": "hydra_v2", "site_id": parts[-1] if len(parts) > 1 else "unknown"}
                elif "lstm" in name:
                    parts = name.split("lstm_")
                    info = {"experiment": "lstm", "site_id": parts[-1] if len(parts) > 1 else "unknown"}
                else:
                    print(f"  Skipped (unrecognised format): {filepath.name}")
                    continue

            experiment_id = info["experiment"]
            site_id = info["site_id"]

            result: Dict[str, Any] = {
                "experiment": experiment_id,
                "site_id": site_id,
                "file": filepath.name,
                "model_version": _model_version(experiment_id),
                "baseline": metrics.get("baseline", {}),
                "corrected": metrics.get("corrected", {}),
                "rmse_improvement_pct": metrics.get("rmse_improvement_pct"),
                "rmse_residual": metrics.get("rmse_residual"),
            }

            # Preserve quantile & bias-shift data when present
            if "quantiles" in metrics:
                result["quantiles"] = metrics["quantiles"]
            if "bias_shift" in metrics:
                result["bias_shift"] = metrics["bias_shift"]

            results.append(result)
            print(f"  Loaded: {filepath.name} \u2192 {experiment_id} @ {site_id}")
        except Exception as e:
            print(f"  Error loading {filepath.name}: {e}")

    return results


# ---------------------------------------------------------------------------
# Time-series export  (eval CSV → JSON for hydrograph component)
# ---------------------------------------------------------------------------

def export_timeseries(
    modeling_dir: Path,
    output_dir: Path,
    *,
    downsample_hours: int = 6,
) -> int:
    """Convert _eval.csv files to dashboard-consumable JSON.

    Returns the number of files written.
    """
    ts_dir = output_dir / "timeseries"
    ts_dir.mkdir(parents=True, exist_ok=True)

    eval_files = sorted(modeling_dir.glob("exp_*_eval.csv"))
    written = 0

    for csv_path in eval_files:
        # Derive experiment + site from the csv filename
        stem = csv_path.stem.replace("_eval", "")  # e.g. "exp_v3_full_03161000"
        m = re.match(r"^exp_(.+?)_(\d{8})$", stem)
        if not m:
            print(f"  Skipped timeseries (unrecognised): {csv_path.name}")
            continue

        experiment_id = m.group(1)
        site_id = m.group(2)

        try:
            df = pd.read_csv(csv_path, parse_dates=["timestamp"])

            # Downsample for smaller JSON payloads
            if downsample_hours > 1:
                df = df.iloc[::downsample_hours].reset_index(drop=True)

            points: List[Dict[str, Any]] = []
            for _, row in df.iterrows():
                nwm = float(row["nwm_cms"])
                usgs = float(row["usgs_cms"])
                corrected = float(row["corrected_pred_cms"])
                point: Dict[str, Any] = {
                    "timestamp": row["timestamp"].isoformat(),
                    "nwm": round(nwm, 3),
                    "usgs": round(usgs, 3),
                    "corrected": round(corrected, 3),
                    "residual": round(nwm - usgs, 3),
                }
                points.append(point)

            out_path = ts_dir / f"{experiment_id}_{site_id}.json"
            with open(out_path, "w") as f:
                json.dump(points, f, separators=(",", ":"))
            written += 1
            print(f"  Timeseries: {csv_path.name} \u2192 {out_path.name}  ({len(points)} points)")
        except Exception as e:
            print(f"  Error exporting timeseries {csv_path.name}: {e}")

    return written


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    modeling_dir = Path("data/clean/modeling")
    output_dir = Path("dashboard/public/data")
    output_dir.mkdir(parents=True, exist_ok=True)

    print("=== Collecting experiment results ===")
    results = collect_results(modeling_dir)

    # Auto-register any experiment IDs we haven't defined yet
    seen_experiments = {r["experiment"] for r in results}
    for exp_id in sorted(seen_experiments):
        if exp_id not in EXPERIMENTS:
            EXPERIMENTS[exp_id] = {
                "name": exp_id.replace("_", " ").title(),
                "description": f"Auto-discovered experiment: {exp_id}",
            }

    dashboard_data = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "sites": SITES,
        "experiments": EXPERIMENTS,
        "results": results,
    }

    # Write main results file
    output_path = output_dir / "experiment_results.json"
    with open(output_path, "w") as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"\nExported {len(results)} results to {output_path}")

    # Backup copy
    backup_path = Path("results/experiment_results.json")
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    with open(backup_path, "w") as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"Backup written to {backup_path}")

    # Export time series
    print("\n=== Exporting time series ===")
    n_ts = export_timeseries(modeling_dir, output_dir, downsample_hours=6)
    print(f"Exported {n_ts} time-series files")

    # Quick summary
    v2_results = [r for r in results if r.get("model_version") == "v2"]
    v3_results = [r for r in results if r.get("model_version") == "v3"]
    print(f"\nSummary: {len(v2_results)} v2 results + {len(v3_results)} v3 results = {len(results)} total")


if __name__ == "__main__":
    main()
