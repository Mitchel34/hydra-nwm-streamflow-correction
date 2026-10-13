#!/usr/bin/env python3
"""
Optimized USGS Streamflow Data Fetching Script
Enhanced with robust 503 error handling, circuit breaker pattern, and intelligent retry logic.
"""
import os
import sys
import requests
import pandas as pd
import argparse
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import random
import io
import pytz
from datetime import date as dt_date

# Add project root to Python path
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, project_root)

from configs.master_study_sites import MASTER_STUDY_SITES
from data_acquisition_scripts.usgs_time_contract import (
    parse_rdb, unique_observations, hourly_observations, ClockContractError,
)

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)


class USGSCollector:
    """Enhanced USGS data collector with circuit breaker pattern and intelligent retry logic."""
    
    def __init__(self, max_retries=6, base_delay=1.0, max_delay=30.0, 
                 circuit_breaker_threshold=5, circuit_breaker_timeout=300):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.circuit_breaker_threshold = circuit_breaker_threshold
        self.circuit_breaker_timeout = circuit_breaker_timeout
        
        # Circuit breaker state
        self.consecutive_failures = 0
        self.circuit_open_time = None
        self.circuit_open = False
        
        # Rate limiting
        self.last_request_time = 0
        self.min_request_interval = 0.5  # Minimum time between requests
        
    def _wait_for_rate_limit(self):
        """Ensure minimum time between requests."""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
    
    def _check_circuit_breaker(self):
        """Check if circuit breaker should be opened or closed."""
        if not self.circuit_open:
            return True
            
        # Check if timeout has elapsed
        if time.time() - self.circuit_open_time > self.circuit_breaker_timeout:
            logger.info("🔄 Circuit breaker cooling period ended, attempting recovery")
            self.circuit_open = False
            self.consecutive_failures = 0
            return True
            
        return False
    
    def _record_failure(self):
        """Record a failure for circuit breaker logic."""
        self.consecutive_failures += 1
        if self.consecutive_failures >= self.circuit_breaker_threshold:
            self.circuit_open = True
            self.circuit_open_time = time.time()
            logger.warning(f"⚡ Circuit breaker OPENED after {self.consecutive_failures} failures. "
                         f"Cooling down for {self.circuit_breaker_timeout/60:.1f} minutes")
    
    def _record_success(self):
        """Record a success for circuit breaker logic."""
        if self.consecutive_failures > 0:
            logger.info(f"✅ Recovery successful after {self.consecutive_failures} failures")
        self.consecutive_failures = 0
        self.circuit_open = False
    
    def fetch_with_retry(self, url: str, max_retries: Optional[int] = None) -> Optional[requests.Response]:
        """
        Enhanced fetch with exponential backoff, circuit breaker, and 503-specific handling.
        """
        if not self._check_circuit_breaker():
            logger.warning("⚡ Circuit breaker is OPEN - skipping request")
            return None
            
        max_retries = max_retries or self.max_retries
        
        for attempt in range(max_retries + 1):
            try:
                # Rate limiting
                self._wait_for_rate_limit()
                
                # Make request with timeout
                self.last_request_time = time.time()
                response = requests.get(url, timeout=30)
                
                if response.status_code == 200:
                    self._record_success()
                    return response
                    
                elif response.status_code == 503:
                    # 503 Service Unavailable - USGS server overload
                    if attempt < max_retries:
                        # Exponential backoff with jitter for 503 errors
                        delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                        jitter = random.uniform(0.1, 0.5)  # Add small random jitter
                        total_delay = delay + jitter
                        
                        logger.warning(f"🔄 USGS HTTP 503 (Server Overload). Attempt {attempt + 1}/{max_retries + 1}. "
                                     f"Sleeping {total_delay:.1f}s ...")
                        time.sleep(total_delay)
                        continue
                    else:
                        logger.error(f"❌ Final 503 error after {max_retries + 1} attempts")
                        self._record_failure()
                        return None
                        
                else:
                    logger.error(f"❌ HTTP {response.status_code}: {response.reason}")
                    self._record_failure()
                    return None
                    
            except requests.exceptions.Timeout:
                if attempt < max_retries:
                    delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                    logger.warning(f"⏱️ Timeout. Attempt {attempt + 1}/{max_retries + 1}. Sleeping {delay}s ...")
                    time.sleep(delay)
                    continue
                else:
                    logger.error(f"❌ Final timeout after {max_retries + 1} attempts")
                    self._record_failure()
                    return None
                    
            except requests.exceptions.RequestException as e:
                if attempt < max_retries:
                    delay = min(self.base_delay * (2 ** attempt), self.max_delay)
                    logger.warning(f"🌐 Network error: {e}. Attempt {attempt + 1}/{max_retries + 1}. Sleeping {delay}s ...")
                    time.sleep(delay)
                    continue
                else:
                    logger.error(f"❌ Final network error after {max_retries + 1} attempts: {e}")
                    self._record_failure()
                    return None
        
        return None

NWIS_CSV = (
    "https://waterservices.usgs.gov/nwis/iv/"
    "?format=rdb&sites={site}&startDT={start}&endDT={end}&parameterCd=00060&siteStatus=all"
)

# Helpers
UTC = pytz.UTC


def fetch_range(site_id: str, start: str, end: str, collector: USGSCollector) -> pd.DataFrame:
    """Convert provider clocks before any duplicate removal or hourly aggregation.

    Callers must preserve response_text/response_url before accepting a dataset.
    The offline versioned converter is the supported acquisition export path.
    """
    url = NWIS_CSV.format(site=site_id, start=start, end=end)
    response = collector.fetch_with_retry(url)
    if response is None:
        return pd.DataFrame()
    records, duplicates = unique_observations(parse_rdb(response.text))
    if any(row['usgs_id'] != site_id for row in records):
        raise ClockContractError('Response contains a different requested site')
    frame = pd.DataFrame(records)
    if frame.empty:
        return frame
    frame['timestamp_utc'] = pd.to_datetime(frame['timestamp_utc'], utc=True)
    frame = frame.set_index('timestamp_utc').sort_index()
    frame.attrs.update(response_text=response.text, response_url=url,
                       exact_duplicates_removed=duplicates)
    return frame

def resample_hourly(df: pd.DataFrame, aggregation: str) -> pd.DataFrame:
    """Explicit UTC interval/point sampling; no imputation or silent keep-last."""
    if df.empty:
        return df
    records = df.reset_index().to_dict('records')
    for row in records:
        row['timestamp_utc'] = row['timestamp_utc'].isoformat()
    hourly = pd.DataFrame(hourly_observations(records, aggregation))
    if not hourly.empty and 'site_name' in df.columns:
        hourly['site_name'] = df['site_name'].iloc[0]
    hourly.attrs = dict(df.attrs)
    return hourly

def fetch_site(usgs_id: str, site_info: dict, start_date: str, end_date: str,
               collector: USGSCollector, aggregation: str) -> pd.DataFrame:
    df = fetch_range(usgs_id, start_date, end_date, collector)
    if df.empty:
        return df
    df['site_name'] = site_info['name']
    return resample_hourly(df, aggregation)

def save_partition(df: pd.DataFrame, out_dir: str, site_id: str, year: int):
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, f"{site_id}_{year}.csv")
    df.to_csv(path, index=False)
    logger.info(f"Saved {path} rows={len(df)}")


def consolidate(directory: str, prefix: str, output_filename: str):
    """Consolidates yearly or monthly files into a single CSV."""
    files = sorted([f for f in os.listdir(directory) if f.startswith(prefix) and f.endswith('.csv')])
    frames = []
    for f in files:
        frames.append(pd.read_csv(os.path.join(directory, f)))
    if frames:
        all_df = pd.concat(frames, ignore_index=True).sort_values(["usgs_id", "timestamp"])  
        all_df.to_csv(os.path.join(directory, output_filename), index=False)
        logger.info(f"Saved consolidated {output_filename} rows={len(all_df)}")


def _month_ranges(start_date: dt_date, end_date: dt_date):
    cur = dt_date(start_date.year, start_date.month, 1)
    while cur <= end_date:
        # Compute end of month
        if cur.month == 12:
            next_month = dt_date(cur.year + 1, 1, 1)
        else:
            next_month = dt_date(cur.year, cur.month + 1, 1)
        month_end = min(end_date, next_month - timedelta(days=1))
        yield cur, month_end
        cur = next_month


def main():
    raise SystemExit(
        'Legacy bulk acquisition/export is disabled by the UTC repair. '
        'Preserve NWIS IV responses and run scripts/convert_usgs_utc.py with '
        '--rdb, a new --out-dir and explicit --aggregation. '
        'Daily means and naive legacy CSVs cannot be substituted.'
    )

if __name__ == "__main__":
    main()
