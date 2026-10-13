#!/usr/bin/env python3
"""Convert preserved NWIS RDB responses into a new, versioned UTC dataset.

Offline only. Never overwrite archives; require the caller to select aggregation.
No daily-mean substitution, automatic timezone guess or model-based lag search.
"""
from pathlib import Path
import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from data_acquisition_scripts.usgs_time_contract import (
    CONTRACT_VERSION, ClockContractError, hourly_observations, parse_rdb,
    unique_observations, write_csv_exclusive,
)


def convert(inputs, output, aggregation, receipt=None):
    inputs = [Path(p) for p in inputs]
    output = Path(output)
    if output.exists():
        raise FileExistsError("Choose a new version directory; existing outputs are immutable")
    records = []
    sources = []
    preserved_bodies = []
    for path in inputs:
        if getattr(path.stat(), "st_flags", 0) & 0x40000000:
            raise ClockContractError("Refusing to hydrate a dataless source")
        body = path.read_bytes()
        preserved_bodies.append(body)
        checksum = hashlib.sha256(body).hexdigest()
        parsed = parse_rdb(body.decode("utf-8"))
        for row in parsed:
            row["source_response_sha256"] = checksum
        records.extend(parsed)
        sources.append({"name": path.name, "sha256": checksum, "bytes": len(body), "rows": len(parsed)})
    unique, duplicate_count = unique_observations(records)
    if not unique:
        raise ClockContractError("No instantaneous observations")
    provider_receipt = None
    if receipt:
        receipt_path = Path(receipt)
        if getattr(receipt_path.stat(), "st_flags", 0) & 0x40000000:
            raise ClockContractError("Refusing to hydrate provider receipt")
        provider_receipt = json.loads(receipt_path.read_text())
    converter_body = Path(__file__).read_bytes()
    contract_body = (Path(__file__).resolve().parents[1] / "data_acquisition_scripts/usgs_time_contract.py").read_bytes()
    # All source validation precedes the first write. Any incomplete output lacks
    # manifest.json and must not be accepted by downstream consumers.
    output.mkdir(parents=True, exist_ok=False)
    source_dir = output / "raw-responses"
    source_dir.mkdir()
    for i, (path, body) in enumerate(zip(inputs, preserved_bodies)):
        (source_dir / f"{i:03d}-{path.name}").write_bytes(body)
    (output / "code-snapshot").mkdir()
    (output / "code-snapshot/convert_usgs_utc.py").write_bytes(converter_body)
    (output / "code-snapshot/usgs_time_contract.py").write_bytes(contract_body)
    raw_hash = write_csv_exclusive(output / "instantaneous_utc.csv", unique)
    outputs = []
    for site in sorted({r["usgs_id"] for r in unique}):
        subset = [r for r in unique if r["usgs_id"] == site]
        rows = hourly_observations(subset, aggregation)
        path = output / "usgs" / f"{site}_consolidated.csv"
        checksum = write_csv_exclusive(path, rows)
        outputs.append({"site_id": site, "path": str(path.relative_to(output)),
                        "rows": len(rows), "sha256": checksum,
                        "nonnumeric_source_rows": sum(r["flow_cfs"] is None for r in subset)})
    manifest = {"status": "bounded_corrected_observations_not_replacement_model_inputs",
                "created_utc": datetime.now(timezone.utc).isoformat(),
                "clock_contract": CONTRACT_VERSION, "aggregation": aggregation,
                "sources": sources, "provider_receipt": provider_receipt,
                "instantaneous_sha256": raw_hash, "exact_duplicates_removed": duplicate_count,
                "utc_conversion": "per-row explicit source offset, validated against registered site DST rules",
                "duplicate_policy": "same UTC/site and identical value/qualifier/series only; conflicts fail",
                "missing_policy": "retain source tokens; exclude nonnumeric flow from hourly outputs; no imputation",
                "daily_fallback": False, "outputs": outputs,
                "converter_sha256": hashlib.sha256(converter_body).hexdigest(),
                "time_contract_sha256": hashlib.sha256(contract_body).hexdigest()}
    (output / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rdb", nargs="+", required=True, help="Preserved provider IV responses with tz_cd")
    parser.add_argument("--out-dir", required=True, help="A new version directory, never an existing archive")
    parser.add_argument("--aggregation", choices=["exact", "mean_start", "mean_end"], required=True)
    parser.add_argument("--provider-receipt", help="Optional retrieval URL/date/hash receipt JSON")
    args = parser.parse_args()
    result = convert(args.rdb, args.out_dir, args.aggregation, args.provider_receipt)
    print(json.dumps({"clock_contract": result["clock_contract"], "outputs": result["outputs"]}, indent=2))


if __name__ == "__main__":
    main()
