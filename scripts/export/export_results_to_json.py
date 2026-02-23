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

# ---------------------------------------------------------------------------
# Legacy -> canonical experiment ID mapping
# ---------------------------------------------------------------------------
# Data files on disk may use old experiment names in their filenames.
# This mapping translates them to the new canonical IDs during export.
LEGACY_ID_MAP: Dict[str, str] = {
    # v2 architecture ablation
    "lstm": "lstm_nwm_era5",
    "hydra_v1": "transformer_nwm_era5",
    "hydra_v2": "gru_transformer_v2_nwm_era5",
    "baseline": "gru_transformer_v2_nwm_era5_tuned",
    # v2 training ablation
    "causal": "gru_transformer_v2_causal",
    "direct": "gru_transformer_v2_direct",
    "physics": "gru_transformer_v2_nonneg",
    "combined": "gru_transformer_v2_causal_nonneg",
    # v3 experiments
    "v3_baseline": "hydra_v3_nwm_era5",
    "v3_causal": "hydra_v3_causal",
    "v3_physics": "hydra_v3_nonneg",
    "v3_combined": "hydra_v3_causal_nonneg",
    "v3_eventsample": "hydra_v3_event_oversample",
    "v3_full": "hydra_v3_causal_nonneg_event",
    "v3_autonorm": "hydra_v3_full_autonorm",
    # Input ablation
    "usgs_only_v3": "hydra_v3_era5_only",
    "usgs_only_simple": "gru_era5_only",
    "usgs_nwm_era5_v3": "hydra_v3_usgs_nwm_era5",
    "usgs_era5_v3": "hydra_v3_usgs_era5",
}


def _canonicalize_id(raw_id: str) -> str:
    """Map a legacy experiment ID to its canonical name."""
    return LEGACY_ID_MAP.get(raw_id, raw_id)


EXPERIMENTS: Dict[str, Dict[str, str]] = {
    # -- Architecture baselines --
    "lstm_nwm_era5": {
        "name": "LSTM Baseline",
        "description": "LSTM encoder baseline; NWM+ERA5 inputs, residual correction",
    },
    "transformer_nwm_era5": {
        "name": "Hydra v1 (Transformer-Only)",
        "description": "Transformer-only encoder without GRU; NWM+ERA5 inputs. Negative result: degrades NWM.",
    },
    "gru_transformer_v2_nwm_era5": {
        "name": "Hydra v2",
        "description": "GRU-Transformer hybrid; NWM+ERA5 inputs, residual correction",
    },
    "gru_transformer_v2_nwm_era5_tuned": {
        "name": "Hydra v2 (Tuned)",
        "description": "Hydra v2 with HPO-tuned hyperparameters [hidden]",
        "hidden": "true",
    },
    # -- Hydra v2 training ablation --
    "gru_transformer_v2_causal": {
        "name": "Hydra v2 + Causal Mask",
        "description": "Hydra v2 with causal attention masking (prevents future information leakage)",
    },
    "gru_transformer_v2_direct": {
        "name": "Hydra v2 Direct",
        "description": "Hydra v2 predicting discharge directly instead of residuals [hidden]",
        "hidden": "true",
    },
    "gru_transformer_v2_nonneg": {
        "name": "Hydra v2 + Non-Neg",
        "description": "Hydra v2 with non-negativity physics constraint on corrected flow",
    },
    "gru_transformer_v2_causal_nonneg": {
        "name": "Hydra v2 + Causal + Non-Neg",
        "description": "Hydra v2 with causal masking and non-negativity constraint",
    },
    # -- Hydra v3 training ablation --
    "hydra_v3_nwm_era5": {
        "name": "Hydra v3",
        "description": "Hydra v3 base: feature gate, multi-scale conv, regime bias; NWM+ERA5 inputs",
    },
    "hydra_v3_causal": {
        "name": "Hydra v3 + Causal Mask",
        "description": "Hydra v3 with causal attention masking",
    },
    "hydra_v3_nonneg": {
        "name": "Hydra v3 + Non-Neg",
        "description": "Hydra v3 with non-negativity physics constraint",
    },
    "hydra_v3_causal_nonneg": {
        "name": "Hydra v3 + Causal + Non-Neg",
        "description": "Hydra v3 with causal masking and non-negativity constraint",
    },
    "hydra_v3_event_oversample": {
        "name": "Hydra v3 + Event Oversampling",
        "description": "Hydra v3 with 3× oversampling on Q90+ high-flow events",
    },
    "hydra_v3_causal_nonneg_event": {
        "name": "Hydra v3 Full",
        "description": "Hydra v3 with causal masking, non-negativity, and event oversampling",
    },
    "hydra_v3_full_autonorm": {
        "name": "Hydra v3 Full + AutoNorm",
        "description": "Hydra v3 full config with automatic loss normalization [hidden]",
        "hidden": "true",
    },
    # -- ERA5-only (operational input ablation) --
    "hydra_v3_era5_only": {
        "name": "Hydra v3 (ERA5-Only)",
        "description": "Hydra v3 with ERA5 meteorological inputs only — no NWM or USGS",
    },
    "gru_era5_only": {
        "name": "GRU (ERA5-Only)",
        "description": "Simple GRU with ERA5 inputs only — no NWM or USGS",
    },
    # -- Nowcasting: USGS observed discharge as input --
    "hydra_v3_usgs_nwm_era5": {
        "name": "Hydra v3 + USGS (Primary)",
        "description": "Primary nowcasting config: Hydra v3 with lagged USGS obs + NWM + ERA5 inputs",
    },
    "hydra_v3_usgs_era5": {
        "name": "Hydra v3 + USGS (No NWM)",
        "description": "Nowcasting ablation: Hydra v3 with lagged USGS + ERA5 only (NWM removed)",
    },
}


def _model_version(experiment_id: str) -> str:
    """Infer model version from canonical experiment ID."""
    if experiment_id.startswith("hydra_v3"):
        return "v3"
    return "v2"


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

            # Translate legacy IDs to canonical names
            experiment_id = _canonicalize_id(info["experiment"])
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
            print(f"  Loaded: {filepath.name} -> {experiment_id} @ {site_id}")
        except Exception as e:
            print(f"  Error loading {filepath.name}: {e}")

    return results


# ---------------------------------------------------------------------------
# Time-series export  (eval CSV -> JSON for hydrograph component)
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

        # Translate legacy IDs to canonical names
        experiment_id = _canonicalize_id(m.group(1))
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

            # Use canonical ID for output filename
            out_path = ts_dir / f"{experiment_id}_{site_id}.json"
            with open(out_path, "w") as f:
                json.dump(points, f, separators=(",", ":"))
            written += 1
            print(f"  Timeseries: {csv_path.name} -> {out_path.name}  ({len(points)} points)")
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
