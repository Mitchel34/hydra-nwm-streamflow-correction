"""Extract Hydra latent states for downstream dimensionality reduction."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd
import torch
from torch.utils.data import DataLoader

from modeling.analysis.latent_space.common import (
    annotate_hydrologic_context,
    build_hydra_v3_model,
    load_checkpoint_state_dict,
    load_model_config,
    load_split_config,
)
from modeling.training.data_utils import (
    build_split_dataset,
    infer_site_id,
    load_data,
    prepare_site_data,
)
from viz.utils import ensure_parent

LOGGER = logging.getLogger(__name__)
DEFAULT_BATCH_SIZE = 512


def _select_device(device: str | None) -> torch.device:
    if device:
        return torch.device(device)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _iter_site_frames(df: pd.DataFrame) -> list[tuple[str, pd.DataFrame]]:
    if "site_id" in df.columns:
        return [
            (str(site_id), group.sort_values("timestamp").reset_index(drop=True))
            for site_id, group in df.groupby("site_id", sort=True)
        ]
    return [(infer_site_id(df), df.sort_values("timestamp").reset_index(drop=True))]


def _build_output_frame(
    target_df: pd.DataFrame,
    latent_vectors: np.ndarray,
    *,
    split: str,
    latent_source: str,
) -> pd.DataFrame:
    frame = annotate_hydrologic_context(target_df)
    frame = frame.assign(
        split=split,
        latent_source=latent_source,
        latent_vector=[row.astype(np.float32).tolist() for row in latent_vectors],
        streamflow_cms=frame["usgs_cms"].astype(np.float32),
        rainfall_mm=frame["precip_mm"].astype(np.float32),
        temperature_c=frame["temp_c"].astype(np.float32),
        nwm_prediction_cms=frame["nwm_cms"].astype(np.float32),
    )
    columns = [
        "timestamp",
        "site_id",
        "split",
        "latent_source",
        "latent_vector",
        "streamflow_cms",
        "rainfall_mm",
        "temperature_c",
        "nwm_prediction_cms",
        "season",
        "regime_label",
        "flow_quantile",
        "is_rising",
    ]
    return frame[columns]


def _run_inference(
    model: torch.nn.Module,
    dataset,
    target_df: pd.DataFrame,
    *,
    latent_source: str,
    batch_size: int,
    device: torch.device,
) -> np.ndarray:
    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=False,
        pin_memory=device.type == "cuda",
    )
    collected: list[np.ndarray] = []
    with torch.no_grad():
        for batch_idx, (x_seq, static_feats, _y_res, _y_usgs, _y_nwm) in enumerate(loader, start=1):
            x_seq = x_seq.to(device)
            static_arg = static_feats.to(device) if static_feats.numel() else None
            outputs = model(x_seq, static_arg, return_intermediates=True)
            intermediates = outputs.get("intermediates", {})
            if latent_source not in intermediates:
                raise KeyError(
                    f"Requested latent source '{latent_source}' is unavailable. "
                    f"Found: {sorted(intermediates.keys())}"
                )
            latent_batch = intermediates[latent_source].detach().cpu().numpy().astype(np.float32)
            collected.append(latent_batch)
            if batch_idx % 10 == 0:
                LOGGER.info("Processed %d batches (%d rows).", batch_idx, sum(len(chunk) for chunk in collected))
    latent = np.concatenate(collected, axis=0)
    if latent.shape[0] != len(target_df):
        raise ValueError(
            f"Latent extraction misaligned with target metadata: {latent.shape[0]} vs {len(target_df)} rows."
        )
    return latent


def extract_latent_states(
    *,
    model_path: str | Path,
    model_config_path: str | Path,
    data_path: str | Path,
    output_path: str | Path,
    split: str = "test",
    split_config_path: str | Path = "configs/train_val_test.json",
    latent_source: str = "fused",
    batch_size: int = DEFAULT_BATCH_SIZE,
    device: str | None = None,
) -> tuple[Path, dict[str, Any]]:
    """Extract one latent vector per prediction timestep and save to parquet."""

    output = ensure_parent(output_path)
    run_device = _select_device(device)
    LOGGER.info("Extracting latent states on %s.", run_device)

    model_config = load_model_config(model_config_path)
    split_kwargs = load_split_config(split_config_path)
    full_df = load_data(str(data_path))
    checkpoint_state = load_checkpoint_state_dict(model_path)

    all_outputs: list[pd.DataFrame] = []
    site_summaries: dict[str, Any] = {}
    for site_id, site_df in _iter_site_frames(full_df):
        LOGGER.info("Preparing site %s with %d rows.", site_id, len(site_df))
        if "site_id" not in site_df.columns:
            site_df = site_df.copy()
            site_df["site_id"] = site_id
        prepared = prepare_site_data(
            site_df,
            seq_len=int(model_config["seq_len"]),
            train_days=0,
            val_days=0,
            train_start=split_kwargs["train_start"],
            train_end=split_kwargs["train_end"],
            val_start=split_kwargs["val_start"],
            val_end=split_kwargs["val_end"],
            test_start=split_kwargs["test_start"],
            test_end=split_kwargs["test_end"],
            include_usgs=bool(model_config.get("include_usgs", False)),
            no_nwm=bool(model_config.get("no_nwm", False)),
        )
        dataset, target_df = build_split_dataset(prepared, split, augment=False)
        if dataset is None or len(dataset) == 0:
            LOGGER.warning("Skipping site %s: split '%s' produced no sequences.", site_id, split)
            continue

        model = build_hydra_v3_model(
            model_config=model_config,
            input_dim=len(prepared.dynamic_cols),
            static_dim=len(prepared.static_cols),
        )
        model.load_state_dict(checkpoint_state)
        model = model.to(run_device)
        model.eval()

        latent = _run_inference(
            model,
            dataset,
            target_df,
            latent_source=latent_source,
            batch_size=batch_size,
            device=run_device,
        )
        output_frame = _build_output_frame(
            target_df.reset_index(drop=True),
            latent,
            split=split,
            latent_source=latent_source,
        )
        all_outputs.append(output_frame)
        site_summaries[site_id] = {
            "rows": int(len(output_frame)),
            "latent_dim": int(latent.shape[1]),
            "dynamic_cols": prepared.dynamic_cols,
            "static_cols": prepared.static_cols,
        }

    if not all_outputs:
        raise ValueError("No latent states were extracted; check the input data and split configuration.")

    combined = pd.concat(all_outputs, ignore_index=True).sort_values(["site_id", "timestamp"]).reset_index(drop=True)
    combined.to_parquet(output, index=False)
    summary = {
        "output_path": str(output),
        "rows": int(len(combined)),
        "latent_dim": int(len(combined.iloc[0]["latent_vector"])),
        "sites": site_summaries,
        "split": split,
        "latent_source": latent_source,
        "device": str(run_device),
    }
    LOGGER.info("Saved latent states to %s (%d rows).", output, len(combined))
    return Path(output), summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", "--checkpoint", dest="model_path", required=True)
    parser.add_argument("--model-config", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--split", choices=["train", "val", "test", "all"], default="test")
    parser.add_argument("--split-config", default="configs/train_val_test.json")
    parser.add_argument("--latent-source", choices=["fused", "transformer_last", "gru_last"], default="fused")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--device", default=None)
    return parser


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()
    extract_latent_states(
        model_path=args.model_path,
        model_config_path=args.model_config,
        data_path=args.data,
        output_path=args.output,
        split=args.split,
        split_config_path=args.split_config,
        latent_source=args.latent_source,
        batch_size=args.batch_size,
        device=args.device,
    )


if __name__ == "__main__":
    main()
