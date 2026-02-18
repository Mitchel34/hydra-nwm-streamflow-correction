#!/usr/bin/env python3
"""
Push experiment results from the exported JSON to Supabase.

Usage:
    python scripts/export/push_results_to_supabase.py [--dry-run]

Requires environment variables:
    SUPABASE_URL       – project URL (e.g. https://xxx.supabase.co)
    SUPABASE_KEY       – service-role key (not anon – needs insert perms)

Or reads from dashboard/.env.local:
    NEXT_PUBLIC_SUPABASE_URL
    NEXT_PUBLIC_SUPABASE_ANON_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DASHBOARD = ROOT / "dashboard"
DATA_JSON = DASHBOARD / "public" / "data" / "experiment_results.json"
ENV_FILE = DASHBOARD / ".env.local"


def load_env_file(path: Path) -> dict[str, str]:
    """Parse a .env file into a dict."""
    env = {}
    if not path.exists():
        return env
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" in line:
            k, v = line.split("=", 1)
            env[k.strip()] = v.strip().strip("'\"")
    return env


def get_supabase_creds() -> tuple[str, str]:
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_KEY", "")
    if url and key:
        return url, key
    # Fallback to dashboard .env.local
    env = load_env_file(ENV_FILE)
    url = url or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
    key = key or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
    return url, key


def main() -> None:
    parser = argparse.ArgumentParser(description="Push results to Supabase")
    parser.add_argument("--dry-run", action="store_true", help="Print rows without pushing")
    args = parser.parse_args()

    if not DATA_JSON.exists():
        print(f"ERROR: {DATA_JSON} not found. Run export_results_to_json.py first.")
        sys.exit(1)

    data = json.loads(DATA_JSON.read_text())
    results = data.get("results", [])
    print(f"Loaded {len(results)} results from {DATA_JSON.name}")

    if args.dry_run:
        for r in results:
            print(f"  {r['experiment']} @ {r['site_id']} → ΔRMSE={r.get('rmse_improvement_pct', 'N/A')}%")
        print(f"\nDry run: {len(results)} rows would be upserted.")
        return

    url, key = get_supabase_creds()
    if not url or not key:
        print("ERROR: Supabase credentials not found.")
        print("Set SUPABASE_URL + SUPABASE_KEY or configure dashboard/.env.local")
        sys.exit(1)

    try:
        from supabase import create_client
    except ImportError:
        print("ERROR: supabase-py not installed. Run: pip install supabase")
        sys.exit(1)

    client = create_client(url, key)

    # Build rows for upsert
    rows = []
    for r in results:
        row = {
            "experiment_id": r["experiment"],
            "site_id": r["site_id"],
            "model_version": r.get("model_version", "v2" if not r["experiment"].startswith("v3_") else "v3"),
            "baseline_rmse": r.get("baseline", {}).get("rmse"),
            "baseline_nse": r.get("baseline", {}).get("nse"),
            "baseline_pbias": r.get("baseline", {}).get("pbias"),
            "baseline_kge": r.get("baseline", {}).get("kge"),
            "baseline_nrmse": r.get("baseline", {}).get("nrmse"),
            "baseline_mae": r.get("baseline", {}).get("mae"),
            "baseline_pearson_r": r.get("baseline", {}).get("pearson_r"),
            "baseline_spearman_r": r.get("baseline", {}).get("spearman_r"),
            "corrected_rmse": r.get("corrected", {}).get("rmse"),
            "corrected_nse": r.get("corrected", {}).get("nse"),
            "corrected_pbias": r.get("corrected", {}).get("pbias"),
            "corrected_kge": r.get("corrected", {}).get("kge"),
            "corrected_nrmse": r.get("corrected", {}).get("nrmse"),
            "corrected_mae": r.get("corrected", {}).get("mae"),
            "corrected_pearson_r": r.get("corrected", {}).get("pearson_r"),
            "corrected_spearman_r": r.get("corrected", {}).get("spearman_r"),
            "rmse_improvement_pct": r.get("rmse_improvement_pct"),
            "rmse_residual": r.get("rmse_residual"),
            "quantiles": json.dumps(r["quantiles"]) if r.get("quantiles") else None,
            "bias_shift": json.dumps(r["bias_shift"]) if r.get("bias_shift") else None,
        }
        rows.append(row)

    # Upsert in batches of 50
    batch_size = 50
    success = 0
    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        try:
            resp = (
                client.table("results")
                .upsert(batch, on_conflict="experiment_id,site_id")
                .execute()
            )
            success += len(batch)
            print(f"  Upserted batch {i // batch_size + 1}: {len(batch)} rows")
        except Exception as e:
            print(f"  ERROR on batch {i // batch_size + 1}: {e}")

    print(f"\nDone: {success}/{len(rows)} rows upserted to Supabase.")


if __name__ == "__main__":
    main()
