"""Shared data preparation helpers for Hydra training and analysis."""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Tuple

import numpy as np
import pandas as pd
import torch
from torch.utils.data import Dataset

ERA5_CANDIDATES = [
    "temp_c",
    "dewpoint_c",
    "pressure_hpa",
    "precip_mm",
    "radiation_mj_m2",
    "wind_speed",
    "vpd_kpa",
    "rel_humidity_pct",
    "soil_moisture_vwc",
    "hour_sin",
    "hour_cos",
    "doy_sin",
    "doy_cos",
    "month_sin",
    "month_cos",
]

STATIC_NUMERIC: List[str] = []


class SeqDataset(Dataset):
    """Sliding-window sequence dataset used by training and latent extraction."""

    def __init__(
        self,
        dyn: np.ndarray,
        static: np.ndarray,
        residual: np.ndarray,
        usgs: np.ndarray,
        nwm: np.ndarray,
        seq_len: int,
        augment: bool = False,
    ) -> None:
        self.seq_len = seq_len
        self.dyn = dyn.astype(np.float32)
        self.static = static.astype(np.float32) if static.size else static
        self.residual = residual.astype(np.float32)
        self.usgs = usgs.astype(np.float32)
        self.nwm = nwm.astype(np.float32)
        self.length = max(len(self.dyn) - seq_len, 0)
        self.augment = augment

    def __len__(self) -> int:
        return self.length

    def __getitem__(self, idx: int):
        j = idx + self.seq_len
        seq = self.dyn[idx:j]
        if self.augment and np.random.rand() < 0.5:
            seq = seq + np.random.normal(0.0, 0.05, size=seq.shape).astype(np.float32)
        static_vec = self.static[j] if self.static.size else np.zeros(0, dtype=np.float32)
        return (
            torch.from_numpy(seq),
            torch.from_numpy(static_vec),
            torch.tensor(self.residual[j], dtype=torch.float32),
            torch.tensor(self.usgs[j], dtype=torch.float32),
            torch.tensor(self.nwm[j], dtype=torch.float32),
        )


@dataclass(frozen=True)
class SplitMasks:
    """Boolean masks and resolved time bounds for chronological splits."""

    train: pd.Series
    val: pd.Series
    test: pd.Series
    train_start: pd.Timestamp
    train_end: pd.Timestamp
    val_start: Optional[pd.Timestamp]
    val_end: Optional[pd.Timestamp]
    test_start: Optional[pd.Timestamp]
    test_end: Optional[pd.Timestamp]


@dataclass(frozen=True)
class PreparedSiteData:
    """Prepared arrays, features, and split metadata for one site."""

    df: pd.DataFrame
    dynamic_cols: List[str]
    static_cols: List[str]
    split_masks: SplitMasks
    dyn_scaled: np.ndarray
    static_scaled: np.ndarray
    residual: np.ndarray
    usgs: np.ndarray
    nwm: np.ndarray
    stats: dict
    seq_len: int


def load_data(path: str) -> pd.DataFrame:
    """Load and sort a training-format parquet."""

    df = pd.read_parquet(path)
    required = {"timestamp", "nwm_cms", "usgs_cms", "y_residual_cms"}
    if not required.issubset(df.columns):
        missing = required.difference(df.columns)
        raise ValueError(f"Missing columns in dataset: {missing}")
    df = df.sort_values("timestamp").dropna(subset=list(required))
    return df.reset_index(drop=True)


def infer_site_id(df: pd.DataFrame, default: str = "unknown") -> str:
    """Return a stable site identifier for a single-site dataframe."""

    for column in ("site_id", "site_name", "comid"):
        if column not in df.columns:
            continue
        values = df[column].dropna().astype(str).unique()
        if len(values) == 1:
            return values[0]
    return default


def validate_single_site(df: pd.DataFrame) -> None:
    """Ensure a dataframe contains only one site worth of rows."""

    for col in ("site_id", "site_name", "comid"):
        if col in df.columns and df[col].nunique(dropna=True) > 1:
            unique_vals = df[col].nunique(dropna=True)
            raise ValueError(
                f"Dataset contains {unique_vals} unique values in '{col}'. "
                "Prepare one site at a time to avoid sequence leakage."
            )


def add_static_columns(df: pd.DataFrame) -> List[str]:
    """Add and return supported static feature columns."""

    cols: List[str] = []
    for col in STATIC_NUMERIC:
        if col in df.columns:
            cols.append(col)
    if "regulation_status" in df.columns:
        df["is_regulated"] = (df["regulation_status"] == "Regulated").astype(float)
        cols.append("is_regulated")
    return cols


def resolve_dynamic_cols(df: pd.DataFrame, *, include_usgs: bool, no_nwm: bool) -> List[str]:
    """Resolve dynamic features using the same rules as training."""

    era5_cols = [c for c in ERA5_CANDIDATES if c in df.columns]
    if no_nwm:
        if include_usgs:
            dynamic_cols = ["usgs_cms"] + era5_cols
        else:
            dynamic_cols = era5_cols
        if len(era5_cols) == 0:
            raise ValueError(
                "No ERA5 columns found in the dataset. "
                "Cannot run --no-nwm without meteorological features."
            )
    else:
        if include_usgs:
            dynamic_cols = ["nwm_cms", "usgs_cms"] + era5_cols
        else:
            dynamic_cols = ["nwm_cms"] + era5_cols
        if not dynamic_cols or dynamic_cols[0] != "nwm_cms":
            raise ValueError("First dynamic feature must be 'nwm_cms'")
        if len(era5_cols) == 0:
            raise ValueError(
                "Dynamic feature set contains only 'nwm_cms'. "
                "Ensure ERA5/meteorological columns are present in the parquet."
            )
    return dynamic_cols


def prepare_features(
    df: pd.DataFrame,
    train_idx: pd.Index,
    dynamic_cols: List[str],
    static_cols: List[str],
) -> Tuple[np.ndarray, np.ndarray, dict]:
    """Scale dynamic and static features using training rows only."""

    dyn_mean = df.loc[train_idx, dynamic_cols].mean()
    dyn_std = df.loc[train_idx, dynamic_cols].std().replace(0, 1)
    dyn_scaled = ((df[dynamic_cols] - dyn_mean) / dyn_std).fillna(0.0)

    static_mean = None
    static_std = None
    if static_cols:
        static_mean = df.loc[train_idx, static_cols].mean()
        static_std = df.loc[train_idx, static_cols].std().replace(0, 1)
        static_scaled = ((df[static_cols] - static_mean) / static_std).fillna(0.0)
    else:
        static_scaled = pd.DataFrame(index=df.index)

    stats = {
        "dyn_mean": dyn_mean,
        "dyn_std": dyn_std,
        "static_mean": static_mean,
        "static_std": static_std,
    }
    return dyn_scaled.to_numpy(), static_scaled.to_numpy(), stats


def resolve_split_masks(
    df: pd.DataFrame,
    *,
    seq_len: int,
    train_days: int,
    val_days: int,
    train_start: Optional[str] = None,
    train_end: Optional[str] = None,
    val_start: Optional[str] = None,
    val_end: Optional[str] = None,
    test_start: Optional[str] = None,
    test_end: Optional[str] = None,
) -> SplitMasks:
    """Resolve chronological train/val/test masks for a dataframe."""

    if all(ts is not None for ts in (train_start, train_end)):
        train_start_ts = pd.Timestamp(train_start)
        train_end_ts = pd.Timestamp(train_end)
    else:
        start = df["timestamp"].min()
        train_start_ts = start
        train_end_ts = start + pd.Timedelta(days=train_days)

    train_mask = (df["timestamp"] >= train_start_ts) & (df["timestamp"] <= train_end_ts)
    if train_mask.sum() <= seq_len:
        raise ValueError("Training window shorter than sequence length")

    val_start_ts = pd.Timestamp(val_start) if val_start is not None else None
    val_end_ts = pd.Timestamp(val_end) if val_end is not None else None
    if val_start_ts is not None and val_end_ts is not None:
        val_mask = (df["timestamp"] >= val_start_ts) & (df["timestamp"] <= val_end_ts)
    else:
        if val_days > 0:
            val_start_ts = train_end_ts
            val_end_ts = train_end_ts + pd.Timedelta(days=val_days)
            val_mask = (df["timestamp"] >= val_start_ts) & (df["timestamp"] < val_end_ts)
        else:
            val_mask = pd.Series(False, index=df.index)
            val_end_ts = None

    if test_start is not None or test_end is not None:
        if not (test_start and test_end):
            raise ValueError("--test-start and --test-end must both be provided for custom evaluation windows.")
        test_start_ts = pd.Timestamp(test_start)
        test_end_ts = pd.Timestamp(test_end)
        test_mask = (df["timestamp"] >= test_start_ts) & (df["timestamp"] <= test_end_ts)
    elif val_end_ts is not None:
        test_start_ts = None
        test_end_ts = None
        test_mask = df["timestamp"] > val_end_ts
    else:
        test_start_ts = None
        test_end_ts = None
        test_mask = ~train_mask

    if test_mask.sum() == 0:
        raise ValueError("No evaluation rows available after split")

    return SplitMasks(
        train=train_mask,
        val=val_mask,
        test=test_mask,
        train_start=train_start_ts,
        train_end=train_end_ts,
        val_start=val_start_ts,
        val_end=val_end_ts,
        test_start=test_start_ts,
        test_end=test_end_ts,
    )


def zero_static(rows: int) -> np.ndarray:
    """Return an empty static-feature matrix for a row count."""

    return np.zeros((rows, 0), dtype=np.float32)


def prepare_site_data(
    df: pd.DataFrame,
    *,
    seq_len: int,
    train_days: int,
    val_days: int,
    train_start: Optional[str] = None,
    train_end: Optional[str] = None,
    val_start: Optional[str] = None,
    val_end: Optional[str] = None,
    test_start: Optional[str] = None,
    test_end: Optional[str] = None,
    include_usgs: bool = False,
    no_nwm: bool = False,
) -> PreparedSiteData:
    """Prepare scaled arrays and split masks for one site dataframe."""

    site_df = df.sort_values("timestamp").reset_index(drop=True).copy()
    validate_single_site(site_df)
    split_masks = resolve_split_masks(
        site_df,
        seq_len=seq_len,
        train_days=train_days,
        val_days=val_days,
        train_start=train_start,
        train_end=train_end,
        val_start=val_start,
        val_end=val_end,
        test_start=test_start,
        test_end=test_end,
    )
    dynamic_cols = resolve_dynamic_cols(site_df, include_usgs=include_usgs, no_nwm=no_nwm)
    static_cols = add_static_columns(site_df)
    dyn_scaled, static_scaled, stats = prepare_features(
        site_df,
        site_df.index[split_masks.train],
        dynamic_cols,
        static_cols,
    )
    return PreparedSiteData(
        df=site_df,
        dynamic_cols=dynamic_cols,
        static_cols=static_cols,
        split_masks=split_masks,
        dyn_scaled=dyn_scaled,
        static_scaled=static_scaled,
        residual=site_df["y_residual_cms"].to_numpy(),
        usgs=site_df["usgs_cms"].to_numpy(),
        nwm=site_df["nwm_cms"].to_numpy(),
        stats=stats,
        seq_len=seq_len,
    )


def build_split_dataset(
    site_data: PreparedSiteData,
    split: str,
    *,
    augment: bool = False,
) -> tuple[Optional[SeqDataset], pd.DataFrame]:
    """Build a seeded sequence dataset and aligned target frame for a split."""

    seq_len = site_data.seq_len
    df = site_data.df
    static_cols = site_data.static_cols

    train_idx = site_data.split_masks.train.values
    val_idx = site_data.split_masks.val.values
    test_idx = site_data.split_masks.test.values

    train_dyn = site_data.dyn_scaled[train_idx]
    train_static = site_data.static_scaled[train_idx] if static_cols else zero_static(int(train_idx.sum()))
    train_resid = site_data.residual[train_idx]
    train_usgs = site_data.usgs[train_idx]
    train_nwm = site_data.nwm[train_idx]

    val_dyn = site_data.dyn_scaled[val_idx]
    val_static = site_data.static_scaled[val_idx] if static_cols else zero_static(int(val_idx.sum()))
    val_resid = site_data.residual[val_idx]
    val_usgs = site_data.usgs[val_idx]
    val_nwm = site_data.nwm[val_idx]

    test_dyn = site_data.dyn_scaled[test_idx]
    test_static = site_data.static_scaled[test_idx] if static_cols else zero_static(int(test_idx.sum()))
    test_resid = site_data.residual[test_idx]
    test_usgs = site_data.usgs[test_idx]
    test_nwm = site_data.nwm[test_idx]

    split_name = split.lower()
    if split_name == "train":
        target_df = df.loc[site_data.split_masks.train].iloc[seq_len:].reset_index(drop=True)
        dataset = SeqDataset(
            train_dyn,
            train_static,
            train_resid,
            train_usgs,
            train_nwm,
            seq_len,
            augment=augment,
        )
    elif split_name == "val":
        if val_dyn.shape[0] == 0:
            return None, df.loc[site_data.split_masks.val].iloc[0:0].reset_index(drop=True)
        tail_train = min(seq_len, train_dyn.shape[0])
        if tail_train < seq_len:
            raise ValueError("Training window shorter than sequence length")
        seed_dyn = np.concatenate([train_dyn[-tail_train:], val_dyn], axis=0)
        seed_static = (
            np.concatenate([train_static[-tail_train:], val_static], axis=0)
            if static_cols
            else zero_static(seed_dyn.shape[0])
        )
        seed_resid = np.concatenate([train_resid[-tail_train:], val_resid])
        seed_usgs = np.concatenate([train_usgs[-tail_train:], val_usgs])
        seed_nwm = np.concatenate([train_nwm[-tail_train:], val_nwm])
        target_df = df.loc[site_data.split_masks.val].reset_index(drop=True)
        dataset = SeqDataset(
            seed_dyn,
            seed_static,
            seed_resid,
            seed_usgs,
            seed_nwm,
            seq_len,
            augment=False,
        )
    elif split_name == "test":
        history_dyn = train_dyn if val_dyn.shape[0] == 0 else np.concatenate([train_dyn, val_dyn], axis=0)
        history_static = (
            train_static if val_dyn.shape[0] == 0 else np.concatenate([train_static, val_static], axis=0)
        ) if static_cols else zero_static(history_dyn.shape[0])
        history_resid = train_resid if val_dyn.shape[0] == 0 else np.concatenate([train_resid, val_resid])
        history_usgs = train_usgs if val_dyn.shape[0] == 0 else np.concatenate([train_usgs, val_usgs])
        history_nwm = train_nwm if val_dyn.shape[0] == 0 else np.concatenate([train_nwm, val_nwm])
        tail_history = min(seq_len, history_dyn.shape[0])
        if tail_history < seq_len:
            raise ValueError("Insufficient history to seed evaluation sequences")
        seed_dyn = np.concatenate([history_dyn[-tail_history:], test_dyn], axis=0)
        seed_static = (
            np.concatenate([history_static[-tail_history:], test_static], axis=0)
            if static_cols
            else zero_static(seed_dyn.shape[0])
        )
        seed_resid = np.concatenate([history_resid[-tail_history:], test_resid])
        seed_usgs = np.concatenate([history_usgs[-tail_history:], test_usgs])
        seed_nwm = np.concatenate([history_nwm[-tail_history:], test_nwm])
        target_df = df.loc[site_data.split_masks.test].reset_index(drop=True)
        dataset = SeqDataset(
            seed_dyn,
            seed_static,
            seed_resid,
            seed_usgs,
            seed_nwm,
            seq_len,
            augment=False,
        )
    elif split_name == "all":
        target_df = df.iloc[seq_len:].reset_index(drop=True)
        dataset = SeqDataset(
            site_data.dyn_scaled,
            site_data.static_scaled if static_cols else zero_static(len(df)),
            site_data.residual,
            site_data.usgs,
            site_data.nwm,
            seq_len,
            augment=False,
        )
    else:
        raise ValueError(f"Unsupported split '{split}'. Choose train, val, test, or all.")

    if len(dataset) != len(target_df):
        raise ValueError(
            f"Sequence/metadata alignment mismatch for split '{split}': "
            f"{len(dataset)} sequences vs {len(target_df)} target rows."
        )
    return dataset, target_df
