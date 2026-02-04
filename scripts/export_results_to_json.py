#!/usr/bin/env python3
"""
Export experiment results to JSON format for the dashboard.
Aggregates metrics from all experiment runs into a single JSON file.
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List

import pandas as pd


def load_metrics_json(filepath: Path) -> Dict[str, Any]:
    """Load metrics from a JSON file."""
    with open(filepath) as f:
        return json.load(f)


def extract_experiment_info(filename: str) -> Dict[str, str]:
    """Extract experiment name and site from filename like 'exp_baseline_03479000_metrics.json'."""
    parts = filename.replace("_metrics.json", "").split("_")
    if len(parts) >= 3 and parts[0] == "exp":
        return {
            "experiment": parts[1],
            "site_id": parts[2],
        }
    return {}


def main():
    modeling_dir = Path("data/clean/modeling")
    output_dir = Path("dashboard/public/data")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Find all experiment metric files
    exp_files = list(modeling_dir.glob("exp_*_metrics.json"))
    
    if not exp_files:
        print("No experiment files found. Looking for existing hydra/lstm files...")
        # Fall back to existing files
        exp_files = list(modeling_dir.glob("watauga_cluster_*_metrics.json"))
    
    results: List[Dict[str, Any]] = []
    
    for filepath in exp_files:
        try:
            metrics = load_metrics_json(filepath)
            info = extract_experiment_info(filepath.name)
            
            if not info:
                # Try parsing watauga_cluster format
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
                    continue
            
            result = {
                "experiment": info.get("experiment", "unknown"),
                "site_id": info.get("site_id", "unknown"),
                "file": filepath.name,
                "baseline": metrics.get("baseline", {}),
                "corrected": metrics.get("corrected", {}),
                "rmse_improvement_pct": metrics.get("rmse_improvement_pct", None),
            }
            results.append(result)
            print(f"  Loaded: {filepath.name}")
        except Exception as e:
            print(f"  Error loading {filepath.name}: {e}")
    
    # Site metadata
    sites = {
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
    
    # Build dashboard data structure
    dashboard_data = {
        "generated_at": pd.Timestamp.now().isoformat(),
        "sites": sites,
        "experiments": {
            "baseline": {"name": "Baseline (Hydra v2)", "description": "Current best model without new features"},
            "causal": {"name": "Causal Mask", "description": "Transformer with causal attention masking"},
            "direct": {"name": "Direct Mode", "description": "Predict USGS directly (no NWM residual)"},
            "physics": {"name": "Physics Constraint", "description": "Non-negativity penalty on streamflow"},
            "combined": {"name": "Combined", "description": "Causal mask + physics constraint"},
            "hydra_v1": {"name": "Hydra v1 (Ablation)", "description": "Transformer-only (no GRU)"},
            "hydra_v2": {"name": "Hydra v2", "description": "GRU-Transformer hybrid"},
            "lstm": {"name": "LSTM Baseline", "description": "Simple LSTM encoder"},
        },
        "results": results,
    }
    
    # Write main results file
    output_path = output_dir / "experiment_results.json"
    with open(output_path, "w") as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"\nExported {len(results)} results to {output_path}")
    
    # Also export to thesis codebase for backup
    backup_path = Path("results/experiment_results.json")
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    with open(backup_path, "w") as f:
        json.dump(dashboard_data, f, indent=2)
    print(f"Backup written to {backup_path}")


if __name__ == "__main__":
    main()
