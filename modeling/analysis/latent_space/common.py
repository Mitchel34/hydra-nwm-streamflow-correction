"""Shared helpers for Hydra latent-space analysis."""

from __future__ import annotations

import json
import logging
import pickle
from pathlib import Path
from typing import TYPE_CHECKING, Any

import numpy as np
import pandas as pd

if TYPE_CHECKING:
    from modeling.models.hydra_temporal_v3 import HydraTemporalV3

LOGGER = logging.getLogger(__name__)

SEASONS = {
    "DJF": {12, 1, 2},
    "MAM": {3, 4, 5},
    "JJA": {6, 7, 8},
    "SON": {9, 10, 11},
}

REGIME_ORDER = ["baseflow", "stormflow", "snowmelt", "drought"]
SEASON_ORDER = ["DJF", "MAM", "JJA", "SON"]


def load_serialized_config(path: str | Path) -> dict[str, Any]:
    """Load a JSON or YAML config file."""

    config_path = Path(path)
    suffix = config_path.suffix.lower()
    with config_path.open("r", encoding="utf-8") as handle:
        if suffix == ".json":
            return json.load(handle)
        if suffix in {".yaml", ".yml"}:
            try:
                import yaml
            except ImportError as exc:  # pragma: no cover - import error path
                raise ImportError("PyYAML is required to load YAML configs.") from exc
            loaded = yaml.safe_load(handle)
            return loaded if isinstance(loaded, dict) else {}
    raise ValueError(f"Unsupported config format for {config_path}. Use .json, .yaml, or .yml.")


def load_model_config(path: str | Path) -> dict[str, Any]:
    """Load and validate a Hydra latent-analysis model config."""

    config = load_serialized_config(path)
    model_version = str(config.get("model_version", "hydra_v3")).lower()
    if model_version not in {"hydra_v3", "v3"}:
        raise ValueError(
            f"Latent analysis currently supports Hydra v3 only, got model_version='{model_version}'."
        )
    required = ["seq_len", "d_model", "num_heads", "num_layers", "dropout"]
    missing = [key for key in required if key not in config]
    if missing:
        raise ValueError(f"Missing required model config keys: {missing}")
    return config


def load_split_config(path: str | Path) -> dict[str, str]:
    """Load canonical train/val/test boundaries."""

    payload = load_serialized_config(path)
    required = {
        "train": ("train_start", "train_end"),
        "val": ("val_start", "val_end"),
        "test": ("test_start", "test_end"),
    }
    split_kwargs: dict[str, str] = {}
    for split_name, (start_key, end_key) in required.items():
        block = payload.get(split_name)
        if not isinstance(block, dict) or "start" not in block or "end" not in block:
            raise ValueError(f"Split config is missing '{split_name}.start'/'{split_name}.end'.")
        split_kwargs[start_key] = str(block["start"])
        split_kwargs[end_key] = str(block["end"])
    return split_kwargs


def normalize_state_dict_keys(state_dict: dict[str, Any]) -> dict[str, Any]:
    """Strip common prefixes from checkpoint keys."""

    normalized: dict[str, Any] = {}
    for key, value in state_dict.items():
        normalized_key = key
        for prefix in ("module.", "_orig_mod."):
            if normalized_key.startswith(prefix):
                normalized_key = normalized_key[len(prefix):]
        normalized[normalized_key] = value
    return normalized


def load_checkpoint_state_dict(path: str | Path) -> dict[str, Any]:
    """Load a checkpoint and extract the state dict."""

    import torch

    payload = torch.load(path, map_location="cpu")
    if isinstance(payload, dict):
        for candidate in ("state_dict", "model_state_dict", "model", "weights"):
            nested = payload.get(candidate)
            if isinstance(nested, dict):
                return normalize_state_dict_keys(nested)
        tensor_like = all(torch.is_tensor(value) for value in payload.values())
        if tensor_like:
            return normalize_state_dict_keys(payload)
    raise ValueError(f"Could not extract a state dict from checkpoint '{path}'.")


def build_hydra_v3_model(
    *,
    model_config: dict[str, Any],
    input_dim: int,
    static_dim: int,
) -> "HydraTemporalV3":
    """Instantiate Hydra v3 from a sidecar config and feature dims."""

    from modeling.models.hydra_temporal_v3 import HydraTemporalV3

    quantiles = model_config.get("quantiles")
    if isinstance(quantiles, str):
        quantiles = [float(part) for part in quantiles.split(",") if part.strip()]
    elif quantiles is not None:
        quantiles = [float(item) for item in quantiles]
    model = HydraTemporalV3(
        input_dim=input_dim,
        static_dim=static_dim,
        d_model=int(model_config["d_model"]),
        num_heads=int(model_config["num_heads"]),
        num_layers=int(model_config["num_layers"]),
        seq_len=int(model_config["seq_len"]),
        conv_depth=int(model_config.get("conv_depth", 4)),
        dropout=float(model_config["dropout"]),
        quantiles=quantiles if quantiles else None,
        nwm_index=0,
        patch_size=int(model_config.get("patch_size", 1)),
        logvar_min=float(model_config.get("logvar_min", -4.0)),
        logvar_max=float(model_config.get("logvar_max", 2.0)),
        use_causal_mask=bool(model_config.get("use_causal_mask", False)),
    )
    return model


def season_from_timestamp(timestamp: pd.Series) -> pd.Series:
    """Map timestamps to DJF/MAM/JJA/SON season codes."""

    months = pd.to_datetime(timestamp).dt.month
    season = pd.Series(index=timestamp.index, dtype="object")
    for label, month_set in SEASONS.items():
        season.loc[months.isin(month_set)] = label
    return season.fillna("UNK")


def annotate_hydrologic_context(df: pd.DataFrame) -> pd.DataFrame:
    """Add season, flow quantile, rising limb, and heuristic regime labels."""

    annotated = df.copy()
    if "site_id" not in annotated.columns:
        annotated["site_id"] = "unknown"
    annotated["season"] = season_from_timestamp(annotated["timestamp"])
    annotated["is_rising"] = False
    annotated["flow_quantile"] = np.nan
    annotated["regime_label"] = "baseflow"

    if "precip_mm" not in annotated.columns:
        annotated["precip_mm"] = np.nan
    if "temp_c" not in annotated.columns:
        annotated["temp_c"] = np.nan

    for site_id, group_idx in annotated.groupby("site_id").groups.items():
        site_frame = annotated.loc[group_idx].copy()
        flow = site_frame["usgs_cms"].astype(float)
        precip = site_frame["precip_mm"].astype(float).fillna(0.0)
        temp = site_frame["temp_c"].astype(float)

        flow_q10 = float(flow.quantile(0.10))
        flow_q75 = float(flow.quantile(0.75))
        precip_q50 = float(precip.quantile(0.50))
        precip_q90 = float(precip.quantile(0.90))

        rising = flow.diff().fillna(0.0) > 0.0
        flow_quantile = flow.rank(method="average", pct=True)
        months = pd.to_datetime(site_frame["timestamp"]).dt.month

        stormflow = (precip >= precip_q90) | ((flow >= flow_q75) & rising)
        snowmelt = (
            ~stormflow
            & months.isin({12, 1, 2, 3, 4})
            & temp.between(-2.0, 8.0, inclusive="both")
            & rising
            & (precip < precip_q90)
        )
        drought = (
            ~stormflow
            & ~snowmelt
            & (flow <= flow_q10)
            & (precip <= precip_q50)
        )

        regime = pd.Series("baseflow", index=site_frame.index, dtype="object")
        regime.loc[drought] = "drought"
        regime.loc[snowmelt] = "snowmelt"
        regime.loc[stormflow] = "stormflow"

        annotated.loc[group_idx, "is_rising"] = rising.to_numpy()
        annotated.loc[group_idx, "flow_quantile"] = flow_quantile.to_numpy()
        annotated.loc[group_idx, "regime_label"] = regime.to_numpy()

        LOGGER.debug(
            "Annotated hydrologic context for site %s with %d rows.",
            site_id,
            len(site_frame),
        )

    annotated["regime_label"] = pd.Categorical(
        annotated["regime_label"],
        categories=REGIME_ORDER,
        ordered=True,
    )
    annotated["season"] = pd.Categorical(
        annotated["season"],
        categories=SEASON_ORDER,
        ordered=True,
    )
    return annotated


def resolve_output_root(
    out_dir: str | Path | None,
    *,
    model_path: str | Path,
    split: str,
) -> Path:
    """Resolve the output root for a latent analysis run."""

    if out_dir is not None:
        return Path(out_dir)
    model_stem = Path(model_path).stem
    return Path("local_only") / "results" / "latent_space" / f"{model_stem}_{split}"


def save_pickle(obj: Any, path: str | Path) -> Path:
    """Persist a python object with pickle."""

    dest = Path(path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("wb") as handle:
        pickle.dump(obj, handle)
    return dest


def load_pickle(path: str | Path) -> Any:
    """Load a pickled python object."""

    with Path(path).open("rb") as handle:
        return pickle.load(handle)
