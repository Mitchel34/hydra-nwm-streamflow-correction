#!/usr/bin/env python3
"""
🔄 NWM v3.0+ HOURLY Data Collector
=================================

This module provides multiple ways to assemble hourly NWM streamflow (channel_rt/CHRTOUT)
for model training/testing, with clear source selection by date range:

- Retrospective v3.0 (2021–early 2023):
    Bucket: s3://noaa-nwm-retrospective-3-0-pds
    Path:   CONUS/netcdf/CHRTOUT/{YYYY}/{YYYYMMDDHHMM}.CHRTOUT_DOMAIN1
    Notes:  Hourly analysis NetCDF; one file per valid time. Coverage in 2023 commonly
                    ends on 2023-01-31 23:00Z in the public archive.

- Operational Analysis Assimilation (tm00) for 2023-02 onward:
    Bucket: s3://noaa-nwm-pds
    Path:   nwm.{YYYYMMDD}/analysis_assim/CHRTOUT/nwm.t{HH}z.analysis_assim.channel_rt.tm00.conus.nc
    Notes:  One file per analysis cycle hour (valid time = {YYYY-MM-DD}T{HH}:00Z).

Auto mode
- For a requested window that straddles 2023-02-01T00:00Z, we pull:
    - Retrospective v3.0 up to 2023-01-31T23:00Z, and
    - Analysis Assimilation tm00 from 2023-02-01T00:00Z onward,
    and stitch them into one unified hourly CSV.

This ensures end-to-end hourly coverage across the January→February boundary.
"""

import boto3
from botocore.config import Config
from botocore import UNSIGNED
import xarray as xr
import pandas as pd
import numpy as np
import os
import logging
import sys
import argparse
from datetime import datetime, timedelta
from typing import Optional, List, Tuple, Iterable, Sequence, Dict
import glob
import warnings
warnings.filterwarnings('ignore')
import tempfile
import requests
import time
import concurrent.futures as cf
try:  # optional dependency for full_physics .comp files (zstd compression)
    import zstandard as zstd
except ImportError:  # pragma: no cover
    zstd = None
try:
    import s3fs  # for fast, anonymous S3 access
except Exception:  # pragma: no cover
    s3fs = None

# ----------------------------------------------------------------------
# Configuration constants for NWM short-range retrievals
# ----------------------------------------------------------------------
NWM_VERSION = os.environ.get("NWM_VERSION", "v2").lower()
NWM_PRODUCT = os.environ.get("NWM_PRODUCT", "short_range").lower()
DEFAULT_SHORT_RANGE_BASES: Tuple[str, ...] = (
    "https://www.ncei.noaa.gov/thredds/fileServer/model-nwm",
    "https://www.ncei.noaa.gov/thredds/fileServer/nwm",
    "https://www.ncei.noaa.gov/thredds/fileServer/noaa-nwm-archive",
)
DEFAULT_SHORT_RANGE_LEADS: Tuple[int, ...] = tuple(range(1, 19))
DEFAULT_SHORT_RANGE_CYCLES: Tuple[int, ...] = (0, 6, 12, 18)
DEFAULT_PROCESSED_DIR = os.environ.get(
    "NWM_PROCESSED_DIR", "data/processed/nwm_v2_short_range"
)
DEFAULT_USGS_RAW_ROOT = os.environ.get("USGS_RAW_ROOT", "data/raw")


def _finalize_hourly_frame(df: Optional[pd.DataFrame]) -> Optional[pd.DataFrame]:
    """Clean and normalize an hourly streamflow dataframe prior to persistence."""
    if df is None or df.empty:
        return df
    df = df.copy()
    ts = pd.to_datetime(df['timestamp'], errors='coerce', utc=True)
    df['timestamp'] = ts.dt.tz_convert(None)
    df = df.dropna(subset=['timestamp'])
    subset_cols = [col for col in ['timestamp', 'comid'] if col in df.columns]
    if len(subset_cols) < 2 and 'site_name' in df.columns:
        subset_cols.append('site_name')
    if subset_cols:
        df = df.drop_duplicates(subset=subset_cols)
    sort_cols = ['timestamp'] + [col for col in ['site_name', 'comid'] if col in df.columns]
    df = df.sort_values(sort_cols).reset_index(drop=True)
    if 'hour' in df.columns:
        df['hour'] = df['timestamp'].dt.hour.astype(int)
    return df

# Retrospective storage switch point (compressed full_physics from Feb 2023 onward)
RETRO_FULL_PHYSICS_START = pd.Timestamp('2023-02-01 00:00:00')


def _ensure_dir(path: str) -> str:
    os.makedirs(path, exist_ok=True)
    return path


def _load_usgs_obs(raw_root: str, usgs_id: str) -> Optional[pd.DataFrame]:
    """Load hourly USGS observations (cms) for a site from consolidated CSVs."""
    patterns = [
        os.path.join(raw_root, "usgs", usgs_id, "*.csv"),
        os.path.join(raw_root, "usgs", f"*{usgs_id}*.csv"),
    ]
    files: List[str] = []
    for pat in patterns:
        files.extend(glob.glob(pat))
    files = sorted(set(files))
    if not files:
        return None
    frames: List[pd.DataFrame] = []
    for fpath in files:
        try:
            frames.append(pd.read_csv(fpath))
        except Exception:
            continue
    if not frames:
        return None
    df = pd.concat(frames, ignore_index=True)
    if 'timestamp' not in df.columns:
        for candidate in ('datetime', 'time', 'date_time', 'timestamp_utc'):
            if candidate in df.columns:
                df['timestamp'] = df[candidate]
                break
    if 'timestamp' not in df.columns:
        return None
    ts = pd.to_datetime(df['timestamp'], utc=True, errors='coerce')
    df['timestamp'] = ts.dt.tz_convert(None)
    flow_col = None
    if 'flow_cms' in df.columns:
        flow_col = 'flow_cms'
        scale = 1.0
    elif 'discharge_cms' in df.columns:
        flow_col = 'discharge_cms'
        scale = 1.0
    elif 'streamflow_cms' in df.columns:
        flow_col = 'streamflow_cms'
        scale = 1.0
    elif 'flow_cfs' in df.columns:
        flow_col = 'flow_cfs'
        scale = 0.028316846592
    elif 'value' in df.columns:
        flow_col = 'value'
        scale = 1.0
    if flow_col is None:
        return None
    obs = pd.DataFrame({
        'valid_time': df['timestamp'],
        'usgs_cms': pd.to_numeric(df[flow_col], errors='coerce') * scale,
    })
    obs = (
        obs.set_index('valid_time')
        .sort_index()
        .resample('1H')
        .mean()
        .reset_index()
    )
    return obs


def _chrout_key_candidates(ts: pd.Timestamp) -> List[Tuple[str, bool]]:
    """Return list of (key, is_comp) candidates for a given timestamp."""
    base = f"{ts:%Y%m%d%H%M}.CHRTOUT_DOMAIN1"
    if ts >= RETRO_FULL_PHYSICS_START:
        return [
            (f"full_physics/{base}.comp", True),
            (f"CONUS/netcdf/CHRTOUT/{ts:%Y}/{base}", False),
        ]
    return [(f"CONUS/netcdf/CHRTOUT/{ts:%Y}/{base}", False)]


def _decompress_comp(src_path: str, dst_path: str) -> str:
    """Decompress a .comp file (zstd) to NetCDF; returns output path."""
    if zstd is None:
        raise RuntimeError(
            "zstandard package required to read NWM full_physics .comp files. "
            "Install via `pip install zstandard`."
        )
    dctx = zstd.ZstdDecompressor()
    with open(src_path, 'rb') as src, open(dst_path, 'wb') as dst:
        dctx.copy_stream(src, dst)
    return dst_path


# ---- Process-safe worker for CHRTOUT hour fetch ----
def _fetch_chrout_hour_worker(args):
    """
    Process-safe worker to fetch a single CHRTOUT hour and extract flows for provided study sites.
    Falls back to boto3 local download to avoid s3fs/h5py thread-safety issues.
    args: (bucket: str, ts_iso: str, study_sites: List[dict])
    returns: List[dict]
    """
    bucket, ts_iso, study_sites = args
    ts = pd.Timestamp(ts_iso)
    candidates = _chrout_key_candidates(ts)
    # Try boto3 head + download to local temp, then open with h5netcdf (reads minimal data per file)
    from botocore.config import Config as _Cfg
    from botocore import UNSIGNED as _UNS
    import boto3 as _boto3
    import xarray as _xr
    import numpy as _np
    import os as _os
    import tempfile as _tempfile
    try:
        s3c = _boto3.client('s3', region_name='us-east-1', config=_Cfg(signature_version=_UNS))
        key = None
        is_comp = False
        for cand, is_comp_cand in candidates:
            try:
                s3c.head_object(Bucket=bucket, Key=cand)
                key = cand
                is_comp = is_comp_cand
                break
            except Exception:
                continue
        if key is None:
            return []
        tmp_dir = _tempfile.mkdtemp(prefix="nwm_v3_proc_")
        tmp_file = _os.path.join(tmp_dir, _os.path.basename(key))
        nc_path = None
        try:
            s3c.download_file(bucket, key, tmp_file)
            if is_comp:
                nc_path = tmp_file + '.nc'
                _decompress_comp(tmp_file, nc_path)
            else:
                nc_path = tmp_file
            # Use default engine (netCDF4) as in the previously working code path
            with _xr.open_dataset(nc_path) as ds:
                if 'feature_id' not in ds or 'streamflow' not in ds:
                    return []
                feature_ids = _np.array(ds['feature_id'].values)
                values = _np.array(ds['streamflow'].values)
                out = []
                for site in study_sites:
                    comid = site['comid']
                    site_name = site['name']
                    match = _np.where(feature_ids == comid)[0]
                    if match.size:
                        out.append({
                            'timestamp': pd.Timestamp(ts),
                            'site_name': site_name,
                            'comid': comid,
                            'streamflow_cms': float(values[int(match[0])]),
                            'data_source': 'retrospective_v3p0_hourly',
                            'hour': int(ts.hour),
                            'file': key,
                        })
                return out
        finally:
            try:
                if nc_path and _os.path.exists(nc_path) and nc_path != tmp_file:
                    _os.remove(nc_path)
                if _os.path.exists(tmp_file):
                    _os.remove(tmp_file)
                _os.rmdir(tmp_dir)
            except Exception:
                pass
    except Exception:
        return []

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

# Import study sites
from configs.master_study_sites import MASTER_STUDY_SITES

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class NWMHourlyCollector:
    """Collects hourly NWM data (retrospective, operational, and short-range forecasts)."""

    def __init__(
        self,
        data_dir: str = "data/raw/nwm_v3",
        site_ids: Optional[Iterable[str]] = None,
        processed_dir: str = DEFAULT_PROCESSED_DIR,
        raw_root: str = DEFAULT_USGS_RAW_ROOT,
        nwm_version: str = NWM_VERSION,
        nwm_product: str = NWM_PRODUCT,
    ):
        self.data_dir = data_dir
        self.processed_dir = processed_dir
        self.raw_root = raw_root
        self.nwm_version = (nwm_version or "v2").lower()
        self.nwm_product = (nwm_product or "short_range").lower()
        self.operational_bucket = 'noaa-nwm-pds'
        # Anonymous access to public NOAA bucket
        self.s3_client = boto3.client(
            's3',
            region_name='us-east-1',
            config=Config(signature_version=UNSIGNED)
        )
        
        # Setup study sites (optionally filtered)
        if site_ids:
            selected = {
                sid: MASTER_STUDY_SITES[sid]
                for sid in site_ids
                if sid in MASTER_STUDY_SITES
            }
            if not selected:
                raise ValueError(f"Requested sites {site_ids} not found in MASTER_STUDY_SITES")
        else:
            selected = MASTER_STUDY_SITES

        self.study_sites = []
        for site_id, site_info in selected.items():
            comid = site_info.get('nwm_comid')
            name = site_info.get('name', site_id)
            if comid is None:
                continue
            self.study_sites.append({'name': name, 'comid': comid, 'usgs_id': site_id})

        if not self.study_sites:
            raise ValueError("No study sites with valid NWM COMIDs were selected.")

        self.target_comids = [site['comid'] for site in self.study_sites]
        site_ids_sorted = sorted({site['usgs_id'] for site in self.study_sites if site.get('usgs_id')})
        self.site_suffix = f"_{'_'.join(site_ids_sorted)}" if site_ids_sorted else ""

        logger.info(f"✅ Initialized NWM hourly collector for {len(self.study_sites)} sites")
        logger.info(f"🎯 Target COMIDs: {self.target_comids}")
        logger.info(
            "📦 Short-range config → version=%s, product=%s, processed_dir=%s",
            self.nwm_version,
            self.nwm_product,
            self.processed_dir,
        )
        self._last_files: List[str] = []
        self._latest_discovery: List[dict] = []

    # ------------------------------
    # Analysis Assimilation (tm00)
    # ------------------------------
    def collect_analysis_assim_hourly_streamflow(self, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
        """Collect hourly NWM analysis_assim (tm00) CHRTOUT for target COMIDs.

        Source (per hour):
          s3://noaa-nwm-pds/nwm.{YYYYMMDD}/analysis_assim/CHRTOUT/
            nwm.t{HH}z.analysis_assim.channel_rt.tm00.conus.nc

        Valid time is {YYYYMMDD}T{HH}:00Z.
        """
        bucket = 'noaa-nwm-pds'
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)
        if end_dt < start_dt:
            raise ValueError("end_date must be after start_date")

        logger.info("🚀 COLLECTING OPERATIONAL analysis_assim (tm00) CHRTOUT - HOURLY")
        logger.info("=" * 76)
        logger.info(f"📅 Period: {start_dt} → {end_dt}")
        logger.info("🎯 Product: analysis_assim tm00 channel_rt (CHRTOUT)")

        hours = pd.date_range(start=start_dt, end=end_dt, freq='H')
        rows: List[dict] = []
        self._last_files = []
        for t in hours:
            ymd = t.strftime('%Y%m%d')
            hh = t.strftime('%H')
            key = f"nwm.{ymd}/analysis_assim/CHRTOUT/nwm.t{hh}z.analysis_assim.channel_rt.tm00.conus.nc"
            try:
                # Object existence check
                self.s3_client.head_object(Bucket=bucket, Key=key)
            except Exception:
                logger.debug(f"Missing analysis_assim file for {t}: s3://{bucket}/{key}")
                continue
            # Download and parse
            tmp_file = f"/tmp/nwm_analysis_assim_{ymd}_t{hh}.nc"
            try:
                self.s3_client.download_file(bucket, key, tmp_file)
                with xr.open_dataset(tmp_file) as ds:
                    if 'feature_id' not in ds or 'streamflow' not in ds:
                        logger.debug(f"Unexpected variables in {key}; skipping")
                        continue
                    feature_ids = np.array(ds['feature_id'].values)
                    values = np.array(ds['streamflow'].values)
                    for site in self.study_sites:
                        comid = site['comid']
                        site_name = site['name']
                        match = np.where(feature_ids == comid)[0]
                        if match.size:
                            rows.append({
                                'timestamp': pd.Timestamp(t),
                                'site_name': site_name,
                                'comid': comid,
                                'streamflow_cms': float(values[int(match[0])]),
                                'data_source': 'analysis_assim_tm00_hourly',
                                'hour': int(t.hour),
                                'file': key,
                            })
            except Exception as e:
                logger.debug(f"Parse failed {key}: {e}")
            finally:
                try:
                    if os.path.exists(tmp_file):
                        os.remove(tmp_file)
                except Exception:
                    pass

        if not rows:
            logger.error("❌ No analysis_assim hourly data collected for the requested range")
            return None

        df = _finalize_hourly_frame(pd.DataFrame(rows))
        if df is None or df.empty:
            logger.error("❌ No analysis_assim hourly data collected for the requested range")
            return None
        out_dir = os.path.join(self.data_dir, 'operational')
        os.makedirs(out_dir, exist_ok=True)
        out_file = os.path.join(
            out_dir,
            f"nwm_v3_hourly_analysis_assim_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}{self.site_suffix}.csv"
        )
        df.to_csv(out_file, index=False, date_format='%Y-%m-%d %H:%M:%S')
        logger.info(f"💾 Saved analysis_assim hourly CSV: {out_file} (rows={len(df)})")
        hrs = sorted(pd.to_datetime(df['timestamp']).dt.hour.unique().tolist())
        logger.info(f"⏰ Hourly coverage (unique hours): {hrs}")
        return df

    def collect_v3_hourly_auto(
        self,
        start_date: str,
        end_date: str,
        archive_base_url: Optional[str] = None,
        **kwargs,
    ) -> Optional[pd.DataFrame]:
        """Auto-stitch hourly streamflow across Jan→Feb 2023 boundary.

        - Up to 2023-01-31T23:00Z: retrospective v3.0 CHRTOUT
        - From 2023-02-01T00:00Z onward: analysis_assim tm00
        - Optional HTTP archive fallback when analysis_assim objects are no longer on S3
        """
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)
        cutoff = pd.Timestamp('2023-02-01T00:00:00Z').tz_convert(None)

        frames = []
        if start_dt < cutoff:
            sub_end = min(end_dt, cutoff - pd.Timedelta(hours=1))
            retro = self.collect_retrospective_v3_streamflow(
                start_date=start_dt, end_date=sub_end,
                max_workers=kwargs.get('max_workers', 6),
                checkpoint_every=kwargs.get('checkpoint_every', 200),
                resume=kwargs.get('resume', True),
                concurrency=kwargs.get('concurrency', 'process'),
            )
            if retro is not None:
                frames.append(retro)
        if end_dt >= cutoff:
            sub_start = max(start_dt, cutoff)
            assim = self.collect_analysis_assim_hourly_streamflow(sub_start, end_dt)
            if assim is not None:
                frames.append(assim)
            elif archive_base_url:
                logger.info(
                    "⚠️  analysis_assim dataset unavailable; attempting archive fallback via %s",
                    archive_base_url,
                )
                archive_df = self.collect_hourly_archive_data(
                    start_date=sub_start,
                    end_date=end_dt,
                    base_url=archive_base_url,
                )
                if archive_df is not None:
                    frames.append(archive_df)
                else:
                    logger.warning(
                        "⚠️  Archive fallback also returned no data for %s → %s",
                        sub_start,
                        end_dt,
                    )
            else:
                logger.warning(
                    "⚠️  analysis_assim dataset unavailable for %s → %s; provide --archive-base-url to try HTTP archive fallback",
                    sub_start,
                    end_dt,
                )

        if not frames:
            logger.error("❌ Auto v3 hourly collector produced no data for the requested window")
            return None

        all_df = pd.concat(frames, ignore_index=True)
        all_df = _finalize_hourly_frame(all_df)
        out_dir = os.path.join(self.data_dir, 'retrospective')
        os.makedirs(out_dir, exist_ok=True)
        out_file = os.path.join(
            out_dir,
            f"nwm_v3_hourly_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}{self.site_suffix}.csv"
        )
        all_df.to_csv(out_file, index=False, date_format='%Y-%m-%d %H:%M:%S')
        logger.info(f"💾 Saved unified v3 hourly (auto) CSV: {out_file} (rows={len(all_df)})")
        hrs = sorted(pd.to_datetime(all_df['timestamp']).dt.hour.unique().tolist())
        logger.info(f"⏰ Hourly coverage (unique hours): {hrs}")
        return all_df

    def _resample_to_6h(self, df: pd.DataFrame, how: str = "sample") -> pd.DataFrame:
        """Resample hourly streamflow to 6-hour timesteps at 00/06/12/18Z.
        how="sample" keeps exact timesteps; how="mean" averages preceding 6 hours.
        """
        df = df.copy()
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        df = df.sort_values(['site_name', 'comid', 'timestamp'])

        if how == "mean":
            # Mean of previous 6 hours aligned to 00/06/12/18
            def agg(group: pd.DataFrame) -> pd.DataFrame:
                g = group.set_index('timestamp').resample('6H').mean(numeric_only=True)
                g = g.reset_index()
                # Reattach constant columns
                g['site_name'] = group['site_name'].iloc[0]
                g['comid'] = group['comid'].iloc[0]
                g['data_source'] = group['data_source'].iloc[0] + "_6h_mean"
                return g
            out = df.groupby(['site_name', 'comid'], group_keys=False).apply(agg)
            out['hour'] = out['timestamp'].dt.hour
            return out
        else:
            # Keep only 6-hour boundaries
            mask = df['timestamp'].dt.hour.isin([0, 6, 12, 18])
            out = df.loc[mask].copy()
            out['data_source'] = out['data_source'] + "_6h_sample"
            return out
    
    def collect_hourly_operational_data(self, start_date="2025-01-01", end_date="2025-08-27"):
        """Collect hourly operational data using short-range forecasts"""
        
        logger.info("🚀 COLLECTING HOURLY OPERATIONAL DATA (Short-Range Forecasts)")
        logger.info("=" * 65)
        logger.info(f"📅 Period: {start_date} to {end_date}")
        logger.info("🎯 Method: Short-range forecasts f001-f024 from 00Z runs")
        logger.info("⏰ Resolution: HOURLY (24 timesteps per day)")
        
        all_data = []
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)

        # The operational S3 bucket (noaa-nwm-pds) retains only a rolling window (weeks to a few months).
        # Guard against queries far in the past (e.g., 2024) which will reliably return no data.
        now_utc = pd.Timestamp.utcnow()
        rolling_window_days = 90  # conservative estimate; public retention varies
        if end_dt < (now_utc - pd.Timedelta(days=rolling_window_days)):
            logger.warning("⚠️  Requested dates appear older than the operational bucket's rolling retention window.")
            logger.warning("   The noaa-nwm-pds bucket generally retains only recent weeks/months of data.")
            logger.warning("   For older periods (e.g., 2024), use --mode retrospective to read the v2.1 Zarr archive (through 2020),")
            logger.warning("   or adjust dates to a recent period (e.g., 2025).")
            return None
        
        current_date = start_dt
        while current_date <= end_dt:
            date_str = current_date.strftime("%Y%m%d")
            logger.info(f"📅 Processing {date_str}...")
            
            daily_data = self._process_hourly_operational_date(date_str)
            
            if daily_data:
                all_data.extend(daily_data)
                logger.info(f"   ✅ Found {len(daily_data)} hourly timesteps")
            else:
                logger.warning(f"   ⚠️  No data found for {date_str}")
            
            current_date += timedelta(days=1)
        
        if all_data:
            # Convert to DataFrame
            df = pd.DataFrame(all_data)
            df = _finalize_hourly_frame(df)
            
            # Save hourly data
            output_dir = os.path.join(self.data_dir, 'operational')
            os.makedirs(output_dir, exist_ok=True)

            # Name file by requested date range
            output_file = os.path.join(
                output_dir,
                f"nwm_v3_hourly_operational_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}{self.site_suffix}.csv"
            )
            df.to_csv(output_file, index=False, date_format='%Y-%m-%d %H:%M:%S')
            
            logger.info(f"💾 Saved hourly testing data: {output_file}")
            logger.info(f"📊 Hourly dataset: {len(df)} timesteps, {df.columns.tolist()} features")
            
            # Analyze temporal coverage
            df['timestamp'] = pd.to_datetime(df['timestamp'])
            df['hour'] = df['timestamp'].dt.hour
            hourly_coverage = sorted(df['hour'].unique())
            
            logger.info(f"⏰ Hourly coverage: {hourly_coverage}")
            logger.info(f"📈 Hours per day: {len(hourly_coverage)}")
            
            if len(hourly_coverage) == 24:
                logger.info("✅ PERFECT: Full 24-hour coverage achieved!")
            else:
                logger.warning(f"⚠️  Partial coverage: {len(hourly_coverage)}/24 hours")
            
            return df
        else:
            logger.error("❌ No hourly data collected!")
            return None

    def _http_head(self, url: str) -> bool:
        """Lightweight HEAD request to check object existence on HTTP server."""
        try:
            r = requests.head(url, timeout=15)
            return r.ok
        except Exception:
            return False

    def _http_download(self, url: str, dst_path: str) -> bool:
        """Stream download to a local file; returns True on success."""
        try:
            with requests.get(url, stream=True, timeout=120) as r:
                r.raise_for_status()
                with open(dst_path, 'wb') as f:
                    for chunk in r.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)
            return True
        except Exception as e:
            logger.debug(f"HTTP download failed: {url} :: {e}")
            return False

    def collect_hourly_archive_data(
        self,
        start_date: str,
        end_date: str,
        base_urls: Optional[Sequence[str]] = None,
        lead_hours: Optional[Sequence[int]] = None,
        cycles: Optional[Sequence[int]] = None,
        fail_on_version: bool = True,
    ) -> Optional[pd.DataFrame]:
        """Collect NWM short-range forecasts (channel_rt) from HTTP archives."""
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)
        if end_dt < start_dt:
            raise ValueError("end_date must be >= start_date")
        bases = (
            [base_urls] if isinstance(base_urls, str)
            else list(base_urls) if base_urls
            else list(DEFAULT_SHORT_RANGE_BASES)
        )
        leads = list(lead_hours or DEFAULT_SHORT_RANGE_LEADS)
        cycles = list(cycles or DEFAULT_SHORT_RANGE_CYCLES)
        rows: List[dict] = []
        discovered: List[dict] = []
        logger.info("🚀 COLLECTING SHORT-RANGE FORECAST ARCHIVE (HTTP)")
        logger.info("=" * 72)
        logger.info(f"📅 Period: {start_dt.date()} → {end_dt.date()}")
        logger.info("🎯 Product: %s %s leads %s", self.nwm_version, self.nwm_product, leads)
        logger.info("🌀 Cycles: %s", cycles)
        logger.info("🌐 Base URLs:\n%s", "\n".join(f"   - {b}" for b in bases))

        day = start_dt.normalize()
        while day <= end_dt.normalize():
            ymd = day.strftime("%Y%m%d")
            for base_hour in cycles:
                init_time = pd.Timestamp(
                    year=day.year, month=day.month, day=day.day, hour=base_hour, tz='UTC'
                ).tz_convert(None)
                for lead in leads:
                    rel_key = (
                        f"nwm.{ymd}/short_range/"
                        f"nwm.t{base_hour:02d}z.short_range.channel_rt.f{lead:03d}.conus.nc"
                    )
                    success = False
                    for base in bases:
                        url = f"{base.rstrip('/')}/{rel_key}"
                        discovered.append({"url": url, "cycle": base_hour, "lead": lead})
                        tmp_path = None
                        try:
                            if not self._http_head(url):
                                continue
                            with tempfile.NamedTemporaryFile(suffix='.nc', delete=False) as tmp:
                                tmp_path = tmp.name
                            if not self._http_download(url, tmp_path):
                                continue
                            with xr.open_dataset(tmp_path) as ds:
                                version_attr = str(ds.attrs.get('model_version', '')).lower()
                                if fail_on_version and self.nwm_version not in version_attr:
                                    raise RuntimeError(
                                        f"Detected model_version '{version_attr}' in {url}; "
                                        f"expected substring '{self.nwm_version}'"
                                    )
                                if 'feature_id' not in ds or 'streamflow' not in ds:
                                    continue
                                feature_ids = np.array(ds['feature_id'].values)
                                values = np.array(ds['streamflow'].values)
                                valid_time = (init_time + pd.Timedelta(hours=lead)).to_pydatetime()
                                for site in self.study_sites:
                                    comid = site['comid']
                                    site_name = site['name']
                                    match = np.where(feature_ids == comid)[0]
                                    if match.size:
                                        idx = int(match[0])
                                        rows.append(
                                            {
                                                'site_name': site_name,
                                                'site_id': site.get('usgs_id'),
                                                'comid': comid,
                                                'init_time': init_time,
                                                'valid_time': pd.Timestamp(valid_time),
                                                'lead_time_hours': int(lead),
                                                'forecast_hour': f"f{lead:03d}",
                                                'nwm_version': self.nwm_version,
                                                'nwm_product': self.nwm_product,
                                                'streamflow_cms': float(values[idx]),
                                                'data_source': 'short_range_forecast_archive',
                                                'file': rel_key,
                                                'source_url': url,
                                            }
                                        )
                                success = True
                                self._last_files.append(url)
                                break
                        except Exception as exc:
                            logger.debug("Skip %s: %s", url, exc)
                        finally:
                            if tmp_path and os.path.exists(tmp_path):
                                try:
                                    os.remove(tmp_path)
                                except Exception:
                                    pass
                    if not success:
                        logger.debug("Missing lead %s cycle %s for %s", lead, base_hour, ymd)
            day += timedelta(days=1)

        if not rows:
            logger.error("❌ No short-range archive data collected for the requested window")
            return None

        df = pd.DataFrame.from_records(rows)
        df['init_time'] = pd.to_datetime(df['init_time'])
        df['valid_time'] = pd.to_datetime(df['valid_time'])
        df = df.sort_values(['site_name', 'init_time', 'lead_time_hours']).reset_index(drop=True)
        archive_dir = _ensure_dir(os.path.join(self.data_dir, 'short_range'))
        out_file = os.path.join(
            archive_dir,
            f"nwm_{self.nwm_version}_{self.nwm_product}_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}{self.site_suffix}.csv",
        )
        df.to_csv(out_file, index=False)
        logger.info("💾 Saved short-range CSV: %s (rows=%d)", out_file, len(df))
        self._write_short_range_processed(df, start_dt, end_dt)
        self._latest_discovery = discovered
        return df

    def _write_short_range_processed(self, forecast_df: pd.DataFrame, start_dt: pd.Timestamp, end_dt: pd.Timestamp) -> None:
        """Persist per-site Parquet datasets with lead-time metadata plus USGS observations."""
        if forecast_df is None or forecast_df.empty:
            return
        processed_dir = _ensure_dir(self.processed_dir)
        for site in self.study_sites:
            site_id = site.get('usgs_id') or site['name'].replace(" ", "_")
            site_comid = site['comid']
            site_frame = forecast_df[forecast_df['comid'] == site_comid].copy()
            if site_frame.empty:
                continue
            obs = _load_usgs_obs(self.raw_root, site.get('usgs_id')) if site.get('usgs_id') else None
            if obs is not None:
                merged = pd.merge(site_frame, obs, on='valid_time', how='left')
            else:
                merged = site_frame
            merged['nwm_version'] = self.nwm_version
            merged['nwm_product'] = self.nwm_product
            merged = merged.sort_values(['init_time', 'lead_time_hours'])
            cols = [
                'site_id',
                'site_name',
                'comid',
                'init_time',
                'lead_time_hours',
                'valid_time',
                'streamflow_cms',
                'usgs_cms',
                'nwm_version',
                'nwm_product',
                'forecast_hour',
                'data_source',
                'file',
                'source_url',
            ]
            for col in cols:
                if col not in merged.columns:
                    merged[col] = np.nan
            merged = merged[cols]
            site_dir = _ensure_dir(os.path.join(processed_dir, str(site_id)))
            out_path = os.path.join(
                site_dir,
                f"nwm_{self.nwm_version}_{self.nwm_product}_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.parquet",
            )
            merged.to_parquet(out_path, index=False)
            logger.info("💾 Saved processed Parquet for %s: %s (rows=%d)", site_id, out_path, len(merged))

    def collect_short_range_v2_forecasts(
        self,
        start_date: str,
        end_date: str,
        base_urls: Optional[Sequence[str]] = None,
        lead_hours: Optional[Sequence[int]] = None,
        cycles: Optional[Sequence[int]] = None,
    ) -> Optional[pd.DataFrame]:
        """Public helper tailored to NWM v2 short-range retrieval."""
        return self.collect_hourly_archive_data(
            start_date=start_date,
            end_date=end_date,
            base_urls=base_urls or DEFAULT_SHORT_RANGE_BASES,
            lead_hours=lead_hours or DEFAULT_SHORT_RANGE_LEADS,
            cycles=cycles or DEFAULT_SHORT_RANGE_CYCLES,
            fail_on_version=True,
        )

    def collect_retrospective_streamflow(self, start_date: str = "2020-01-01", end_date: str = "2020-01-10",
                                         resample_6h: bool = False, resample_method: str = "sample") -> Optional[pd.DataFrame]:
        """Collect hourly retrospective (v2.1) streamflow from Zarr for the selected COMIDs.
        Data source: s3://noaa-nwm-retrospective-2-1-zarr-pds/chrtout.zarr (hourly)
        """
        try:
            import fsspec  # noqa: F401 (ensures s3fs path handling)
        except ImportError:
            logger.error("Missing fsspec/s3fs. Please install 's3fs' to read S3 Zarr stores.")
            raise

        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)

        logger.info("🚀 COLLECTING RETROSPECTIVE (v2.1) STREAMFLOW - HOURLY via Zarr")
        logger.info("=" * 70)
        logger.info(f"📅 Period: {start_date} to {end_date}")
        logger.info("🎯 Product: chrtout (streamflow) — hourly resolution")

        zarr_url = "s3://noaa-nwm-retrospective-2-1-zarr-pds/chrtout.zarr"
        logger.info(f"📦 Opening Zarr store: {zarr_url} (anonymous)")

        # Open dataset lazily
        ds = xr.open_zarr(
            store="s3://noaa-nwm-retrospective-2-1-zarr-pds/chrtout.zarr",
            storage_options={"anon": True},
            consolidated=True
        )
        # Subset by time
        ds_sub = ds.sel(time=slice(np.datetime64(start_dt), np.datetime64(end_dt)))

        # Build DataFrame for each site
        frames: List[pd.DataFrame] = []
        for site in self.study_sites:
            comid = site['comid']
            site_name = site['name']
            try:
                # Use xarray selection by coordinate value
                ts = ds_sub['streamflow'].sel(feature_id=comid)
                df = ts.to_dataframe(name='streamflow_cms').reset_index()
                df.rename(columns={"time": "timestamp"}, inplace=True)
                df['site_name'] = site_name
                df['comid'] = comid
                df['data_source'] = 'retrospective_v2p1_hourly'
                df['hour'] = pd.to_datetime(df['timestamp']).dt.hour
                frames.append(df[['timestamp', 'site_name', 'comid', 'streamflow_cms', 'data_source', 'hour']])
            except KeyError:
                logger.warning(f"COMID {comid} not found in retrospective dataset; skipping")
                continue

        if not frames:
            logger.error("❌ No retrospective data collected for requested sites/range")
            return None

        out = pd.concat(frames, ignore_index=True).sort_values(['timestamp', 'site_name'])

        # Report temporal coverage
        hours = sorted(pd.to_datetime(out['timestamp']).dt.hour.unique())
        logger.info(f"⏰ Hourly coverage in sample: {hours} (count={len(hours)})")
        if len(hours) == 24:
            logger.info("✅ HOURLY: 24 hours per day confirmed for retrospective chrtout")
        else:
            logger.warning("⚠️ Unexpected hour coverage; dataset may have gaps in this period")

        # Save hourly
        output_dir = os.path.join(self.data_dir, 'retrospective')
        os.makedirs(output_dir, exist_ok=True)
        hourly_file = os.path.join(output_dir, f"nwm_v2p1_hourly_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.csv")
        out.to_csv(hourly_file, index=False)
        logger.info(f"💾 Saved retrospective hourly CSV: {hourly_file} (rows={len(out)})")

        if resample_6h:
            out6 = self._resample_to_6h(out, how=resample_method)
            six_file = os.path.join(output_dir, f"nwm_v2p1_6h_{resample_method}_{start_dt.strftime('%Y%m%d')}_{end_dt.strftime('%Y%m%d')}.csv")
            out6.to_csv(six_file, index=False)
            logger.info(f"💾 Saved retrospective 6-hour CSV: {six_file} (rows={len(out6)})")
            return out6

        return out

    def collect_retrospective_v3_streamflow(self, start_date: str, end_date: str, max_workers: int = 6, checkpoint_every: int = 200, resume: bool = False, concurrency: str = "process") -> Optional[pd.DataFrame]:
        """Collect hourly NWM v3.0 retrospective CHRTOUT (2021–2023) for target COMIDs.

        Source: s3://noaa-nwm-retrospective-3-0-pds/CONUS/netcdf/CHRTOUT/{YYYY}/{YYYYMMDDHHMM}.CHRTOUT_DOMAIN1

        Each hourly NetCDF contains streamflow for all feature_id; we extract only our COMIDs.
        """
        bucket = "noaa-nwm-retrospective-3-0-pds"
        start_dt = pd.to_datetime(start_date)
        end_dt = pd.to_datetime(end_date)
        if end_dt < start_dt:
            raise ValueError("end_date must be after start_date")
        if end_dt >= RETRO_FULL_PHYSICS_START and zstd is None:
            raise RuntimeError(
                "zstandard package required to read NWM retrospective full_physics (.comp) files. "
                "Install via `pip install zstandard` and retry."
            )

        logger.info("🚀 COLLECTING RETROSPECTIVE v3.0 (2021–2023) CHRTOUT - HOURLY")
        logger.info("=" * 70)
        logger.info(f"📅 Period: {start_dt} → {end_dt}")
        logger.info("🎯 Product: CHRTOUT hourly NetCDF (CONUS DOMAIN1)")

        # Output path and resume
        out_dir = os.path.join(self.data_dir, 'retrospective')
        os.makedirs(out_dir, exist_ok=True)
        out_file = os.path.join(
            out_dir,
            f"nwm_v3_hourly_{pd.to_datetime(start_dt).strftime('%Y%m%d')}_{pd.to_datetime(end_dt).strftime('%Y%m%d')}{self.site_suffix}.csv"
        )
        already = set()
        if resume and os.path.exists(out_file):
            try:
                prev = pd.read_csv(out_file, usecols=["timestamp"])  # small read
                already = set(pd.to_datetime(prev["timestamp"]).astype("datetime64[ns]").tolist())
                logger.info(f"↩️  Resume enabled: {len(already)} timestamps already written")
            except Exception:
                already = set()

        # Build hours to fetch
        hours = pd.date_range(start=start_dt, end=end_dt, freq="H")
        hours = [pd.Timestamp(t) for t in hours if t.to_datetime64() not in already]
        if not hours:
            logger.info(f"Nothing to fetch; file exists with requested period: {out_file}")
            return pd.read_csv(out_file, parse_dates=["timestamp"]) if os.path.exists(out_file) else None

        # Prepare s3fs if available
        fs = None
        if s3fs is not None:
            try:
                fs = s3fs.S3FileSystem(anon=True)
            except Exception:
                fs = None

        def fetch_one(ts: pd.Timestamp):
            candidates = _chrout_key_candidates(ts)
            # First, if s3fs available, try netcdf variant directly (only works for non-comp)
            if fs is not None:
                for key, is_comp in candidates:
                    if is_comp:
                        continue
                    try:
                        if not fs.exists(f"{bucket}/{key}"):
                            continue
                        s3url = f"s3://{bucket}/{key}"
                        ds = xr.open_dataset(
                            s3url,
                            engine="h5netcdf",
                            backend_kwargs={"storage_options": {"anon": True}},
                            chunks={},
                        )
                        if 'feature_id' not in ds or 'streamflow' not in ds:
                            ds.close()
                            continue
                        feature_ids = np.asarray(ds['feature_id'].values)
                        values = np.asarray(ds['streamflow'].values)
                        out = []
                        for site in self.study_sites:
                            comid = site['comid']
                            site_name = site['name']
                            idx = np.where(feature_ids == comid)[0]
                            if idx.size:
                                out.append({
                                    'timestamp': pd.Timestamp(ts),
                                    'site_name': site_name,
                                    'comid': comid,
                                    'streamflow_cms': float(values[int(idx[0])]),
                                    'data_source': 'retrospective_v3p0_hourly',
                                    'hour': int(ts.hour),
                                    'file': key,
                                })
                        ds.close()
                        if out:
                            return out
                    except Exception:
                        continue

            # Fallback: download candidate, optionally decompress, then open
            for key, is_comp in candidates:
                try:
                    self.s3_client.head_object(Bucket=bucket, Key=key)
                except Exception:
                    continue
                tmp_file = None
                nc_path = None
                try:
                    tmp_dir = tempfile.mkdtemp(prefix="nwm_v3_dl_")
                    tmp_file = os.path.join(tmp_dir, os.path.basename(key))
                    self.s3_client.download_file(bucket, key, tmp_file)
                    if is_comp:
                        nc_path = tmp_file + '.nc'
                        _decompress_comp(tmp_file, nc_path)
                        open_path = nc_path
                    else:
                        open_path = tmp_file
                    with xr.open_dataset(open_path) as ds:
                        if 'feature_id' not in ds or 'streamflow' not in ds:
                            continue
                        feature_ids = np.array(ds['feature_id'].values)
                        values = np.array(ds['streamflow'].values)
                        out = []
                        for site in self.study_sites:
                            comid = site['comid']
                            site_name = site['name']
                            match = np.where(feature_ids == comid)[0]
                            if match.size:
                                out.append({
                                    'timestamp': pd.Timestamp(ts),
                                    'site_name': site_name,
                                    'comid': comid,
                                    'streamflow_cms': float(values[int(match[0])]),
                                    'data_source': 'retrospective_v3p0_hourly',
                                    'hour': int(ts.hour),
                                    'file': key,
                                })
                        if out:
                            return out
                except Exception:
                    continue
                finally:
                    try:
                        if nc_path and os.path.exists(nc_path):
                            os.remove(nc_path)
                        if tmp_file and os.path.exists(tmp_file):
                            os.remove(tmp_file)
                        if 'tmp_dir' in locals():
                            os.rmdir(tmp_dir)
                    except Exception:
                        pass
            return []

        # Concurrent fetch and periodic checkpoint writes
        rows: List[dict] = []
        last_flush = time.time()
        processed = 0
        if concurrency == "thread":
            executor_cls = cf.ThreadPoolExecutor
            iterator = hours
            mapper = fetch_one
        else:
            # Use processes with a process-safe worker to avoid HDF5 thread issues
            executor_cls = cf.ProcessPoolExecutor
            # Pack minimal args to avoid pickling large objects
            packed = [(bucket, str(ts), self.study_sites) for ts in hours]
            iterator = packed
            mapper = _fetch_chrout_hour_worker

        with executor_cls(max_workers=max_workers) as ex:
            for recs in ex.map(mapper, iterator):
                processed += 1
                if recs:
                    # process mode returns list of dicts; thread mode returns list too
                    rows.extend(recs)
                if rows and (processed % checkpoint_every == 0 or (time.time() - last_flush) > 30):
                    df_ck = pd.DataFrame(rows).sort_values(['timestamp', 'site_name'])
                    mode = 'a' if os.path.exists(out_file) else 'w'
                    df_ck.to_csv(out_file, index=False, mode=mode, header=not os.path.exists(out_file))
                    logger.info(f"💾 Checkpoint flush: +{len(df_ck)} rows → {out_file}")
                    rows.clear()
                    last_flush = time.time()

        # Final flush
        if rows:
            df_ck = pd.DataFrame(rows).sort_values(['timestamp', 'site_name'])
            mode = 'a' if os.path.exists(out_file) else 'w'
            df_ck.to_csv(out_file, index=False, mode=mode, header=not os.path.exists(out_file))
            rows.clear()

        if not os.path.exists(out_file):
            logger.error("❌ No v3.0 retrospective data collected for requested range")
            return None

        df = pd.read_csv(out_file)
        df = _finalize_hourly_frame(df)
        df.to_csv(out_file, index=False, date_format='%Y-%m-%d %H:%M:%S')
        hrs = sorted(df['timestamp'].dt.hour.dropna().unique().tolist())
        logger.info(f"⏰ Hourly coverage (unique hours): {hrs}")
        logger.info(f"💾 Saved v3.0 retrospective hourly CSV: {out_file} (rows={len(df)})")
        return df
    
    def _process_hourly_operational_date(self, date_str):
        """Process a single date to get 24 hours of forecast data"""
        
        daily_data = []
        successful_hours = 0
        
        # Use 00Z short-range forecasts for f001-f024 (24 hourly forecasts)
        # Try 00Z first, then 12Z fallback
        for base_hour in (0, 12):
            for forecast_hour in range(1, 25):  # f001 to f024
                file_pattern = f"nwm.{date_str}/short_range/nwm.t{base_hour:02d}z.short_range.channel_rt.f{forecast_hour:03d}.conus.nc"
                try:
                    # Head to confirm existence
                    self.s3_client.head_object(Bucket=self.operational_bucket, Key=file_pattern)
                    # Download and process
                    temp_file = f"/tmp/nwm_hourly_{date_str}_t{base_hour:02d}_f{forecast_hour:03d}.nc"
                    self.s3_client.download_file(self.operational_bucket, file_pattern, temp_file)
                    with xr.open_dataset(temp_file) as ds:
                        init_time = pd.to_datetime(f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]} {base_hour:02d}:00:00")
                        valid_time = init_time + pd.Timedelta(hours=forecast_hour)
                        if 'feature_id' in ds and 'streamflow' in ds:
                            feature_ids = ds.feature_id.values
                            streamflow_values = ds.streamflow.values
                            for site in self.study_sites:
                                comid = site['comid']
                                site_name = site['name']
                                if comid in feature_ids:
                                    idx = np.where(feature_ids == comid)[0][0]
                                    flow_value = float(streamflow_values[idx])
                                    daily_data.append({
                                        'init_time': init_time,
                                        'timestamp': valid_time,
                                        'site_name': site_name,
                                        'comid': comid,
                                        'streamflow_cms': flow_value,
                                        'data_source': 'short_range_forecast',
                                        'hour': valid_time.hour,
                                        'forecast_hour': f"f{forecast_hour:03d}",
                                        'lead_hour': forecast_hour,
                                        'file': file_pattern
                                    })
                    successful_hours += 1
                    os.remove(temp_file)
                except Exception:
                    # Missing file; try next hour or fallback base_hour
                    continue
        
        return daily_data

    def run_short_range_smoke_test(self, df: Optional[pd.DataFrame]) -> None:
        """Print a concise report summarizing the downloaded short-range leads."""
        if df is None or df.empty:
            logger.error("❌ Smoke test aborted: no forecast rows available")
            return
        init_times = sorted(pd.to_datetime(df['init_time']).unique())
        lead_set = sorted(set(df['lead_time_hours'].astype(int)))
        logger.info("🧪 Smoke test — sample init cycles: %s", init_times[:4])
        logger.info("🧪 Found lead hours: %s", lead_set)
        if not lead_set or lead_set[0] > 1 or lead_set[-1] < 18:
            logger.warning("⚠️ Lead coverage missing required span 1–18h")
        sample_cols = [
            'site_id',
            'site_name',
            'init_time',
            'lead_time_hours',
            'valid_time',
            'streamflow_cms',
        ]
        if 'usgs_cms' in df.columns:
            sample_cols.append('usgs_cms')
        preview = (
            df.sort_values(['site_id', 'init_time', 'lead_time_hours'])
            [sample_cols]
            .head(5)
        )
        logger.info("🧪 Example forecast rows:\n%s", preview.to_string(index=False))
        unique_files = sorted(set(self._last_files))
        logger.info("🧪 Discovered %d files (first 5 shown): %s", len(unique_files), unique_files[:5])
    
    def validate_temporal_consistency(self):
        """Validate that training and testing data now have consistent temporal resolution"""
        
        logger.info("🔍 VALIDATING TEMPORAL CONSISTENCY")
        logger.info("=" * 40)
        
        training_hours = None
        # Load training data
        training_file = os.path.join(self.data_dir, 'retrospective', 'nwm_v3_training_2020_2023.csv')
        if os.path.exists(training_file):
            training_df = pd.read_csv(training_file)
            training_df['timestamp'] = pd.to_datetime(training_df['timestamp'])
            training_df['hour'] = training_df['timestamp'].dt.hour
            training_hours = sorted(training_df['hour'].unique())
            
            logger.info(f"📚 Training data hours: {training_hours}")
            logger.info(f"📚 Training resolution: {len(training_hours)} hours/day")
        
        # Load new hourly testing data
        testing_file = os.path.join(self.data_dir, 'operational', 'nwm_v3_hourly_testing_2025.csv')
        if os.path.exists(testing_file):
            testing_df = pd.read_csv(testing_file)
            testing_df['timestamp'] = pd.to_datetime(testing_df['timestamp'])
            testing_df['hour'] = testing_df['timestamp'].dt.hour
            testing_hours = sorted(testing_df['hour'].unique())
            
            logger.info(f"🧪 Testing data hours: {testing_hours}")
            logger.info(f"🧪 Testing resolution: {len(testing_hours)} hours/day")
            
            # Check consistency
            if training_hours is not None and set(training_hours) == set(testing_hours):
                logger.info("✅ PERFECT: Temporal resolutions now match!")
                logger.info("🎯 Ready for consistent model training")
                return True
            else:
                if training_hours is None:
                    logger.info("ℹ️ Training file not found; skipping cross-dataset comparison")
                    return True
                logger.warning("⚠️  Temporal mismatch still exists")
                missing_in_testing = set(training_hours) - set(testing_hours)
                missing_in_training = set(testing_hours) - set(training_hours)
                if missing_in_testing:
                    logger.warning(f"   Missing in testing: {sorted(missing_in_testing)}")
                if missing_in_training:
                    logger.warning(f"   Missing in training: {sorted(missing_in_training)}")
                return False
        
        return False

def main():
    """Main execution function"""
    
    parser = argparse.ArgumentParser(description="Collect hourly NWM data (operational, retrospective, or archive).")
    parser.add_argument("--out-dir", default="data/raw/nwm_v3", help="Output directory for CSV files.")
    parser.add_argument("--processed-dir", default=DEFAULT_PROCESSED_DIR, help="Processed Parquet output directory for short-range datasets.")
    parser.add_argument("--raw-root", default=DEFAULT_USGS_RAW_ROOT, help="Root directory containing raw USGS data (for short-range merges).")
    parser.add_argument("--start-date", default="2025-01-01", help="Start date in YYYY-MM-DD format.")
    parser.add_argument("--end-date", default=datetime.now().strftime("%Y-%m-%d"), help="End date in YYYY-MM-DD format.")
    parser.add_argument("--mode", choices=["short_range_v2", "operational", "retrospective", "retrospective_v3", "archive", "v3_auto"], default="short_range_v2", help="Data source mode.")
    parser.add_argument("--resample-6h", action="store_true", help="For retrospective mode, also write a 6-hour dataset aligned at 00/06/12/18Z.")
    parser.add_argument("--resample-method", choices=["sample", "mean"], default="sample", help="6-hour resampling method: sample exact hours or mean of prior 6 hours.")
    parser.add_argument("--archive-base-url", default=None, help="HTTP base URL for archived NWM, e.g., https://www.ncei.noaa.gov/thredds/fileServer/model-nwm")
    parser.add_argument("--base-url", action="append", default=None, help="Override/additional HTTP base URL(s) for short-range downloads; can be provided multiple times.")
    parser.add_argument("--lead-hours", default="1-18", help="Lead hours to request for short-range (e.g., 1-18 or 1,3,6,12,18).")
    parser.add_argument("--cycles", default="0,6,12,18", help="Forecast cycles (UTC hours) to request, comma separated (e.g., 0,12).")
    parser.add_argument("--nwm-version", default=NWM_VERSION, help="Expected NWM version keyword for validation (default v2).")
    parser.add_argument("--nwm-product", default=NWM_PRODUCT, help="NWM product label (default short_range).")
    # Performance knobs for retrospective_v3
    parser.add_argument("--max-workers", type=int, default=6, help="Parallel workers for CHRTOUT fetch (retrospective_v3).")
    parser.add_argument("--checkpoint-every", type=int, default=200, help="Flush rows to CSV every N records (retrospective_v3).")
    parser.add_argument("--resume", action="store_true", default=True, help="Resume and skip timestamps already present in output CSV (retrospective_v3). Default: True")
    parser.add_argument("--concurrency", choices=["thread", "process"], default="process", help="Concurrency model for retrospective_v3: threads (fast but may segfault with HDF5) or processes (safer). Default: process")
    parser.add_argument("--sites", nargs='+', default=None, help="USGS site IDs to process (default: all sites in configuration)")
    parser.add_argument("--smoke-test", action="store_true", help="Print a short lead-time summary after short-range downloads.")
    args = parser.parse_args()

    logger.info("🔄 STARTING HOURLY NWM DATA COLLECTION")
    logger.info("=" * 45)
    logger.info("🎯 Goal: Collect hourly operational data using short-range forecasts")
    logger.info("📋 Strategy: Use f001-f024 from 00Z runs for 24-hour coverage")
    
    try:
        # Initialize collector
        def _parse_leads(spec: str) -> List[int]:
            spec = spec.strip()
            if "-" in spec:
                start_s, end_s = spec.split("-", 1)
                return list(range(int(start_s), int(end_s) + 1))
            return [int(x) for x in spec.split(",") if x]

        lead_hours = _parse_leads(args.lead_hours)
        cycles = [int(x) for x in args.cycles.split(",") if x]
        collector = NWMHourlyCollector(
            data_dir=args.out_dir,
            site_ids=args.sites,
            processed_dir=args.processed_dir,
            raw_root=args.raw_root,
            nwm_version=args.nwm_version,
            nwm_product=args.nwm_product,
        )
        
        if args.mode == "short_range_v2":
            sr = collector.collect_short_range_v2_forecasts(
                start_date=args.start_date,
                end_date=args.end_date,
                base_urls=args.base_url,
                lead_hours=lead_hours,
                cycles=cycles,
            )
            if args.smoke_test:
                collector.run_short_range_smoke_test(sr)
        elif args.mode == "operational":
            # Collect hourly operational data
            hourly_df = collector.collect_hourly_operational_data(start_date=args.start_date, end_date=args.end_date)
            if hourly_df is not None:
                success = collector.validate_temporal_consistency()
                if success:
                    logger.info("✅ HOURLY COLLECTION SUCCESSFUL!")
                    logger.info("🎯 Training and testing now have matching hourly resolution")
                    logger.info("📊 Ready for enhanced model training with consistent timesteps")
                else:
                    logger.warning("⚠️  Temporal validation incomplete")
        elif args.mode == "retrospective":
            # Retrospective v2.1
            retro_df = collector.collect_retrospective_streamflow(
                start_date=args.start_date,
                end_date=args.end_date,
                resample_6h=args.resample_6h,
                resample_method=args.resample_method
            )
            if retro_df is not None:
                logger.info("✅ RETROSPECTIVE COLLECTION COMPLETE")
                if args.resample_6h:
                    logger.info("🎯 6-hour dataset ready for alignment with 6-hour sources (e.g., ERA5)")
        elif args.mode == "retrospective_v3":
            v3 = collector.collect_retrospective_v3_streamflow(
                start_date=args.start_date,
                end_date=args.end_date,
                max_workers=args.max_workers,
                checkpoint_every=args.checkpoint_every,
                resume=args.resume,
                concurrency=args.concurrency,
            )
            if v3 is not None:
                logger.info("✅ RETROSPECTIVE v3.0 COLLECTION COMPLETE")
        elif args.mode == "v3_auto":
            v3a = collector.collect_v3_hourly_auto(
                start_date=args.start_date,
                end_date=args.end_date,
                archive_base_url=args.archive_base_url,
                max_workers=args.max_workers,
                checkpoint_every=args.checkpoint_every,
                resume=args.resume,
                concurrency=args.concurrency,
            )
            if v3a is not None:
                logger.info("✅ AUTO (retrospective + analysis_assim) HOURLY COLLECTION COMPLETE")
        elif args.mode == "archive":
            archive_urls = args.base_url or ([args.archive_base_url] if args.archive_base_url else None)
            if not archive_urls:
                logger.error("❌ archive mode requires --base-url or --archive-base-url")
                return
            arc = collector.collect_hourly_archive_data(
                start_date=args.start_date,
                end_date=args.end_date,
                base_urls=archive_urls,
                lead_hours=lead_hours,
                cycles=cycles,
                fail_on_version=True,
            )
            if arc is not None and args.smoke_test:
                collector.run_short_range_smoke_test(arc)
            if arc is not None:
                logger.info("✅ ARCHIVE COLLECTION COMPLETE")
        
    except Exception as e:
        logger.error(f"❌ Hourly collection failed: {str(e)}")
        raise e

if __name__ == "__main__":
    main()
