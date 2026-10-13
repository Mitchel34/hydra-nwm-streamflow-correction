#!/usr/bin/env python3
"""
Build an hourly, multi-year training dataset by aligning:
- NWM hourly analysis (CHRTOUT) from retrospective datasets (v2.1: 1979–2020, v3.0: 2021–2023)
- USGS observed streamflow (hourly, UTC)
- ERA5/ERA5-Land environmental features (hourly preferred; 6-hourly acceptable with safe alignment)

Targets:
- y_residual_cms = usgs_obs_cms - nwm_cms  (per valid_time)
- y_corrected_cms = usgs_obs_cms  (optional direct corrected runoff target)

Outputs:
- Parquet dataset under data/clean/modeling/hourly_training_{start}_{end}.parquet
- Small CSV sample for inspection

Assumptions:
- NWM CSVs exist under data/raw/nwm_v3/retrospective/*.csv with columns:
    timestamp (valid_time), streamflow_cms, site_name, comid
- USGS hourly CSVs exist per site under data/raw/usgs/*{usgs_id}*.csv with columns timestamp, flow_cms or flow_cfs
- ERA5 CSVs exist per site/month under data/raw/era5/** with at least timestamp and environmental columns
Notes:
- If ERA5 is 6-hourly, we align to hourly via reindex with nearest tolerance=3H (no forward-looking leakage)
- We filter to timestamps where both NWM and USGS obs exist to form targets
"""

import os
import glob
import hashlib
import json
import pandas as pd
import numpy as np
from typing import List, Dict, Optional, Iterable

from datetime import datetime

# Local config (study sites)
import sys
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, project_root)
from configs.master_study_sites import MASTER_STUDY_SITES
from pathlib import Path
from data_acquisition_scripts.usgs_time_contract import (
    CONTRACT_VERSION, ClockContractError, validate_hourly_csv,
)


def _read_many_csv(patterns: List[str], usecols: Optional[List[str]] = None) -> Optional[pd.DataFrame]:
    files: List[str] = []
    for p in patterns:
        files.extend(glob.glob(p))
    if not files:
        return None
    frames = []
    for f in sorted(files):
        try:
            frames.append(pd.read_csv(f, usecols=usecols))
        except Exception:
            continue
    if not frames:
        return None
    return pd.concat(frames, ignore_index=True)


def _candidate_globs(raw_dir: str, nwm_version: str) -> List[str]:
    version = nwm_version.lower()
    if version == 'v2':
        return [
            os.path.join(raw_dir, 'nwm_v2', 'retrospective', '*.csv'),
            os.path.join(raw_dir, 'nwm_v2', '*', 'retrospective', '*.csv'),
            os.path.join(raw_dir, 'nwm_v2p1', 'retrospective', '*.csv'),
            os.path.join(raw_dir, 'nwm_v2p1', '*', 'retrospective', '*.csv'),
            os.path.join(raw_dir, 'nwm_v2_test', 'retrospective', '*.csv'),
            os.path.join(raw_dir, 'nwm_v2_test', '*', 'retrospective', '*.csv'),
            os.path.join(raw_dir, 'nwm_v3', 'retrospective', '*v2p1*.csv'),
        ]
    if version == 'v3':
        return [
            os.path.join(raw_dir, 'nwm_v3', 'retrospective', '*.csv'),
        ]
    raise ValueError(f"Unsupported NWM version '{nwm_version}'. Expected 'v2' or 'v3'.")


def load_nwm_hourly(raw_dir: str, nwm_version: str = 'v2') -> pd.DataFrame:
    """Load hourly NWM analysis (CHRTOUT) from retrospective sources only.
    Returns columns: [timestamp, site_name, comid, nwm_cms]
    """
    pats = _candidate_globs(raw_dir, nwm_version)
    df = _read_many_csv(pats)
    if df is None or df.empty:
        raise FileNotFoundError(
            f"No NWM hourly CSVs found under data/raw/nwm_{nwm_version.lower()}/retrospective"
        )
    # Normalize columns
    if 'timestamp' not in df.columns:
        raise ValueError("NWM retrospective CSVs must include 'timestamp'")
    # Robust timestamp parse: handle mixed date-only (YYYY-MM-DD) and date-time strings
    # Strip whitespace first to avoid residuals
    df['timestamp'] = df['timestamp'].astype(str).str.strip()
    try:
        df['timestamp'] = pd.to_datetime(df['timestamp'], format='mixed', errors='coerce')
    except TypeError:
        # pandas < 2.2 fallback (no format='mixed')
        df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce', utc=False)
    # Drop rows that failed to parse
    df = df.dropna(subset=['timestamp'])
    flow_col = 'streamflow_cms' if 'streamflow_cms' in df.columns else (
        'nwm_cms' if 'nwm_cms' in df.columns else None
    )
    if flow_col is None:
        if 'value' in df.columns:
            flow_col = 'value'
        else:
            raise ValueError("NWM retrospective CSVs missing streamflow column (expected streamflow_cms or nwm_cms)")
    df = df.rename(columns={flow_col: 'nwm_cms'})
    keep = ['timestamp', 'site_name', 'comid', 'nwm_cms']
    return df[keep]


def load_usgs_hourly(raw_dir: str, usgs_id: str, corrected_dir: Optional[str] = None,
                     aggregation: Optional[str] = None) -> pd.DataFrame:
    """Accept only hash-bound, explicitly converted UTC observation versions.

    Legacy raw_dir CSVs are intentionally not inferred to be UTC. Target-valid-time
    inputs use exact hourly IV samples; interval means require a separate protocol.
    """
    if not corrected_dir or aggregation != 'exact':
        raise ClockContractError('Supply a corrected version directory and exact IV aggregation')
    root = Path(corrected_dir)
    manifest_path = root / 'manifest.json'
    if getattr(manifest_path.stat(), 'st_flags', 0) & 0x40000000:
        raise ClockContractError('Refusing to hydrate corrected observation manifest')
    manifest_bytes = manifest_path.read_bytes()
    manifest_sha256 = hashlib.sha256(manifest_bytes).hexdigest()
    manifest = json.loads(manifest_bytes)
    if (manifest.get('clock_contract') != CONTRACT_VERSION or manifest.get('aggregation') != aggregation
            or manifest.get('daily_fallback') is not False):
        raise ClockContractError('Invalid corrected observation manifest')
    matches = [r for r in manifest.get('outputs', []) if r['site_id'] == usgs_id]
    if len(matches) != 1:
        raise ClockContractError('Expected one hash-bound output per site')
    record = matches[0]
    path = (root / record['path']).resolve()
    if root.resolve() not in path.parents:
        raise ClockContractError('Observation path escapes version directory')
    if getattr(path.stat(), 'st_flags', 0) & 0x40000000:
        raise ClockContractError('Refusing to hydrate corrected observations')
    csv_bytes = path.read_bytes()
    if hashlib.sha256(csv_bytes).hexdigest() != record['sha256']:
        raise ClockContractError('Corrected observation hash mismatch')
    rows = validate_hourly_csv(path, usgs_id, aggregation, content=csv_bytes)
    if len(rows) != record['rows']:
        raise ClockContractError('Corrected observation row count mismatch')
    df = pd.DataFrame(rows)
    out = pd.DataFrame({'timestamp': pd.to_datetime(df['timestamp'], utc=True).dt.tz_localize(None),
                        'usgs_cms': pd.to_numeric(df['flow_cms'], errors='raise')})
    out.attrs['source_files'] = [str(path), str(manifest_path)]
    out.attrs['clock_contract'] = CONTRACT_VERSION
    out.attrs['aggregation'] = aggregation
    out.attrs['manifest_sha256'] = manifest_sha256
    return out

def load_era5_features(raw_dir: str, site_name: str, site_id: Optional[str] = None, comid: Optional[int] = None) -> Optional[pd.DataFrame]:
    # ERA5 files likely live under data/raw/era5/<site>/*.csv, or per-site folders like data/raw/era5/<comid>/*.csv.
    # Try nested globs and a general fallback.
    site_slug = site_name.replace(' ', '_').lower()
    possible = [
        os.path.join(raw_dir, 'era5', str(site_id or ''), '*.csv') if site_id else '',
        os.path.join(raw_dir, 'era5', site_slug, '*.csv'),
        os.path.join(raw_dir, 'era5', str(comid or ''), '*.csv') if comid else '',
        os.path.join(raw_dir, 'era5', '**', '*.csv'),
        os.path.join(raw_dir, 'era5', '*.csv'),
    ]
    patterns = [p for p in possible if p]
    df = _read_many_csv(patterns)
    if df is None or df.empty:
        return None
    # Require timestamp column
    if 'timestamp' not in df.columns:
        for c in ['time', 'datetime']:
            if c in df.columns:
                df['timestamp'] = df[c]
                break
    if 'timestamp' not in df.columns:
        return None
    df['timestamp'] = pd.to_datetime(df['timestamp'])
    # Drop obvious non-feature columns
    drop_like = {'lat', 'lon', 'latitude', 'longitude', 'x', 'y', 'site_name', 'comid'}
    feature_cols = [c for c in df.columns if c not in drop_like and c != 'timestamp']
    # Ensure numeric
    for c in feature_cols:
        df[c] = pd.to_numeric(df[c], errors='coerce')
    # Coerce to hourly: if 6-hourly, reindex to hourly via nearest within 3H (no leakage across >3H gaps)
    df = df[['timestamp'] + feature_cols].drop_duplicates('timestamp').sort_values('timestamp')
    # Build an hourly timeline over the data span
    full_index = pd.date_range(df['timestamp'].min(), df['timestamp'].max(), freq='1H')
    hourly = (
        df.set_index('timestamp')
          .reindex(full_index, method=None)
          .reset_index()
          .rename(columns={'index': 'timestamp'})
    )
    # Fill by nearest within 3H window
    for c in feature_cols:
        hourly[c] = hourly[c].fillna(method='ffill', limit=3)  # up to 3 hours forward from last known
        # do not backfill to avoid using future info; leave NaNs if gap is at start
    return hourly


def add_time_features(df: pd.DataFrame) -> pd.DataFrame:
    ts = pd.to_datetime(df['timestamp'])
    df['doy'] = ts.dt.dayofyear
    df['month'] = ts.dt.month
    df['doy_sin'] = np.sin(2 * np.pi * df['doy'] / 365.25)
    df['doy_cos'] = np.cos(2 * np.pi * df['doy'] / 365.25)
    df['month_sin'] = np.sin(2 * np.pi * df['month'] / 12)
    df['month_cos'] = np.cos(2 * np.pi * df['month'] / 12)
    return df


def _report_missing(site_id: str, df: pd.DataFrame, cols: List[str]) -> None:
    missing = df[cols].isna().mean().sort_values(ascending=False)
    if missing.max() > 0:
        summary = ", ".join([f"{c}={missing[c]:.1%}" for c in missing.index])
        print(f"[{site_id}] Missing rates: {summary}")


def build_dataset(
    raw_dir: str = 'data/raw',
    out_dir: str = 'data/clean/modeling',
    start: Optional[str] = None,
    end: Optional[str] = None,
    sites: Optional[Iterable[str]] = None,
    nwm_version: str = 'v2',
    usgs_corrected_dir: Optional[str] = None,
    usgs_aggregation: Optional[str] = None,
) -> pd.DataFrame:
    if not usgs_corrected_dir or usgs_aggregation != 'exact':
        raise ClockContractError('Corrected UTC observations with exact IV aggregation are required')
    os.makedirs(out_dir, exist_ok=False)  # new version only; preserve prior inputs

    # Load NWM (multi-site, hourly only)
    nwm = load_nwm_hourly(raw_dir, nwm_version=nwm_version)
    if start:
        nwm = nwm[nwm['timestamp'] >= pd.to_datetime(start)]
    if end:
        nwm = nwm[nwm['timestamp'] <= pd.to_datetime(end)]

    frames = []
    usgs_manifest_hashes = set()
    target_sites = (
        {sid: MASTER_STUDY_SITES[sid] for sid in sites if sid in MASTER_STUDY_SITES}
        if sites
        else MASTER_STUDY_SITES
    )

    if sites and not target_sites:
        raise ValueError(f"Requested sites {sites} not found in MASTER_STUDY_SITES")

    for site_id, info in target_sites.items():
        site_name = info['name']
        usgs_id = info.get('usgs_id') or info.get('usgs_site') or info.get('usgs')
        comid = info.get('nwm_comid')
        if not (usgs_id and comid):
            continue
        # Subset NWM for this site/COMID
        nwm_site = nwm[nwm['comid'] == comid].copy()
        if nwm_site.empty:
            continue
        # Load USGS hourly
        usgs = load_usgs_hourly(raw_dir, usgs_id, usgs_corrected_dir, usgs_aggregation)
        usgs_manifest_hashes.add(usgs.attrs['manifest_sha256'])
        if len(usgs_manifest_hashes) != 1:
            raise ClockContractError('Sites used different corrected observation manifests')
        # Load ERA5 features (optional)
        era5 = load_era5_features(raw_dir, site_name, site_id=site_id, comid=comid)
        # Merge
        df = nwm_site.merge(usgs, on='timestamp', how='inner')  # require obs to build targets
        if era5 is not None:
            df = df.merge(era5, on='timestamp', how='left')
        df = df.drop_duplicates(subset=['timestamp']).sort_values('timestamp')
        # Ensure time features are present even if ERA5 is missing
        time_cols = {'doy_sin', 'doy_cos', 'month_sin', 'month_cos'}
        if not time_cols.issubset(df.columns):
            df = add_time_features(df)

        # Missing-value handling for met features
        met_cols = [c for c in ['precip_mm', 'soil_moisture_vwc', 'temp_c'] if c in df.columns]
        if met_cols:
            _report_missing(site_id, df, met_cols)
            # Forward-fill temperature + soil moisture only (no future leakage)
            for col in ['temp_c', 'soil_moisture_vwc']:
                if col in df.columns:
                    df[col] = df[col].ffill(limit=6)
            # Drop rows still missing any met feature
            df = df.dropna(subset=met_cols)
            if df.empty:
                print(f"[{site_id}] Dropped all rows due to missing met features; skipping site.")
                continue
        # Targets
        df['y_residual_cms'] = df['usgs_cms'] - df['nwm_cms']
        df['y_corrected_cms'] = df['usgs_cms']
        df['site_name'] = site_name  # ensure present consistently
        df['site_id'] = site_id
        df['regulation_status'] = info.get('regulation_status')
        df['state'] = info.get('state')
        df['region'] = info.get('region')
        df['biome'] = info.get('biome')
        frames.append(df)

    if not frames:
        raise RuntimeError("No aligned records found across NWM and USGS. Ensure inputs exist and overlap in time.")

    out = pd.concat(frames, ignore_index=True)
    out = out.sort_values(['site_name', 'timestamp'])
    out = out.drop_duplicates(subset=['site_name', 'timestamp'])

    # Save outputs
    if sites:
        suffix = "_".join(sorted(sites))
        tag_base = suffix or "subset"
    else:
        tag_base = "all_sites"
    date_span = f"{(start or out['timestamp'].min().strftime('%Y%m%d'))}_{(end or out['timestamp'].max().strftime('%Y%m%d'))}"
    tag = f"{tag_base}_{date_span}"
    parquet_path = os.path.join(out_dir, f"hourly_training_{tag}.parquet")
    csv_sample_path = os.path.join(out_dir, f"hourly_training_{tag}_sample.csv")
    out.to_parquet(parquet_path, index=False)
    out.head(2000).to_csv(csv_sample_path, index=False)
    clock_provenance = {
        'status': 'USGS_clock_validated_NWM_and_ERA5_lineage_not_certified',
        'usgs_clock_contract': CONTRACT_VERSION,
        'usgs_aggregation': usgs_aggregation,
        'usgs_manifest_sha256': next(iter(usgs_manifest_hashes)),
        'output_parquet_sha256': hashlib.sha256(Path(parquet_path).read_bytes()).hexdigest(),
        'rows': len(out),
        'nwm_version': nwm_version,
        'builder_sha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'scientific_performance_verified': False,
    }
    with open(os.path.join(out_dir, 'clock_provenance.json'), 'x') as handle:
        json.dump(clock_provenance, handle, indent=2)
    print(f"Saved: {parquet_path} (rows={len(out)})")
    print(f"Sample: {csv_sample_path}")
    return out


if __name__ == '__main__':
    import argparse
    ap = argparse.ArgumentParser(description='Build hourly, multi-year residual training dataset')
    ap.add_argument('--raw-dir', default='data/raw', help='Root folder for raw source CSVs')
    ap.add_argument('--out-dir', default='data/clean/modeling', help='Output folder for modeling dataset')
    ap.add_argument('--start', default=None, help='Start date (YYYY-MM-DD) to filter NWM/USGS')
    ap.add_argument('--end', default=None, help='End date (YYYY-MM-DD) to filter NWM/USGS')
    ap.add_argument('--sites', nargs='*', default=None, help='Optional list of site IDs to process')
    ap.add_argument(
        '--nwm-version',
        default='v2',
        choices=['v2', 'v3'],
        help='Retrospective NWM archive to load (default: v2)',
    )
    ap.add_argument('--usgs-corrected-dir', required=True, help='Versioned UTC converter output with manifest')
    ap.add_argument('--usgs-aggregation', required=True, choices=['exact'], help='Exact IV samples at UTC valid time')
    args = ap.parse_args()
    build_dataset(
        raw_dir=args.raw_dir,
        out_dir=args.out_dir,
        start=args.start,
        end=args.end,
        sites=args.sites,
        nwm_version=args.nwm_version,
        usgs_corrected_dir=args.usgs_corrected_dir,
        usgs_aggregation=args.usgs_aggregation,
    )
