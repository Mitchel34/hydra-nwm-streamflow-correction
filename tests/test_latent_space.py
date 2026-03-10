"""Tests for Hydra latent-space analysis."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib
import numpy as np
import pandas as pd
import pytest

matplotlib.use("Agg")

SYNTHETIC_INPUT_DIM = 11


def _build_synthetic_training_frame(
    *,
    site_id: str,
    start: str,
    periods: int,
    seed: int = 7,
) -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    timestamps = pd.date_range(start=start, periods=periods, freq="h")
    base_flow = 10.0 + 2.0 * np.sin(np.linspace(0.0, 8.0 * np.pi, periods))
    storm_pulse = np.zeros(periods)
    storm_pulse[100:112] = np.linspace(0.0, 12.0, 12)
    storm_pulse[112:124] = np.linspace(12.0, 0.0, 12)
    nwm = base_flow + 0.5 * np.cos(np.linspace(0.0, 6.0 * np.pi, periods))
    usgs = nwm + storm_pulse + rng.normal(0.0, 0.2, periods)
    precip = np.zeros(periods)
    precip[100:112] = np.linspace(0.0, 15.0, 12)
    precip[112:118] = np.linspace(12.0, 0.0, 6)
    temp = 8.0 + 10.0 * np.sin(np.linspace(0.0, 2.0 * np.pi, periods))
    soil = 0.2 + 0.05 * np.sin(np.linspace(0.0, 4.0 * np.pi, periods))

    frame = pd.DataFrame(
        {
            "timestamp": timestamps,
            "site_id": site_id,
            "nwm_cms": nwm.astype(np.float32),
            "usgs_cms": usgs.astype(np.float32),
            "y_residual_cms": (usgs - nwm).astype(np.float32),
            "precip_mm": precip.astype(np.float32),
            "temp_c": temp.astype(np.float32),
            "soil_moisture_vwc": soil.astype(np.float32),
            "hour_sin": np.sin(2.0 * np.pi * timestamps.hour / 24.0).astype(np.float32),
            "hour_cos": np.cos(2.0 * np.pi * timestamps.hour / 24.0).astype(np.float32),
            "doy_sin": np.sin(2.0 * np.pi * timestamps.dayofyear / 365.0).astype(np.float32),
            "doy_cos": np.cos(2.0 * np.pi * timestamps.dayofyear / 365.0).astype(np.float32),
            "month_sin": np.sin(2.0 * np.pi * timestamps.month / 12.0).astype(np.float32),
            "month_cos": np.cos(2.0 * np.pi * timestamps.month / 12.0).astype(np.float32),
        }
    )
    return frame


def _write_checkpoint_bundle(tmp_path: Path) -> tuple[Path, Path]:
    from modeling.models.hydra_temporal_v3 import HydraTemporalV3
    import torch

    model_config = {
        "model_version": "hydra_v3",
        "seq_len": 12,
        "d_model": 8,
        "num_heads": 2,
        "num_layers": 1,
        "dropout": 0.1,
        "quantiles": [0.1, 0.5, 0.9],
        "include_usgs": True,
        "no_nwm": False,
        "use_causal_mask": False,
    }
    model = HydraTemporalV3(
        input_dim=SYNTHETIC_INPUT_DIM,
        static_dim=0,
        d_model=8,
        num_heads=2,
        num_layers=1,
        seq_len=12,
        dropout=0.1,
        quantiles=[0.1, 0.5, 0.9],
    )
    checkpoint_path = tmp_path / "hydra_v3_test.pt"
    config_path = tmp_path / "hydra_v3_test_config.json"
    torch.save(model.state_dict(), checkpoint_path)
    config_path.write_text(json.dumps(model_config), encoding="utf-8")
    return checkpoint_path, config_path


def _write_split_config(tmp_path: Path) -> Path:
    split_config = {
        "train": {"start": "2020-01-01 00:00:00", "end": "2020-01-05 23:00:00"},
        "val": {"start": "2020-01-06 00:00:00", "end": "2020-01-07 23:00:00"},
        "test": {"start": "2020-01-08 00:00:00", "end": "2020-01-10 23:00:00"},
    }
    split_path = tmp_path / "split_config.json"
    split_path.write_text(json.dumps(split_config), encoding="utf-8")
    return split_path


def test_hydra_v3_returns_intermediates() -> None:
    from modeling.models.hydra_temporal_v3 import HydraTemporalV3
    import torch

    model = HydraTemporalV3(
        input_dim=10,
        static_dim=0,
        d_model=8,
        num_heads=2,
        num_layers=1,
        seq_len=12,
        dropout=0.1,
        quantiles=[0.1, 0.5, 0.9],
    )
    x = torch.randn(4, 12, 10)
    outputs = model(x, None, return_intermediates=True)

    assert "intermediates" in outputs
    assert outputs["intermediates"]["gru_last"].shape == (4, 8)
    assert outputs["intermediates"]["transformer_last"].shape == (4, 8)
    assert outputs["intermediates"]["fused"].shape == (4, 8)

    plain_outputs = model(x, None)
    assert "intermediates" not in plain_outputs


def test_regime_annotation_hits_all_classes() -> None:
    from modeling.analysis.latent_space.common import annotate_hydrologic_context

    frame = pd.DataFrame(
        {
            "timestamp": pd.to_datetime(
                [
                    "2020-08-01 00:00:00",
                    "2020-08-01 01:00:00",
                    "2020-03-01 00:00:00",
                    "2020-08-01 03:00:00",
                    "2020-08-01 04:00:00",
                    "2020-08-01 05:00:00",
                ]
            ),
            "site_id": ["03161000"] * 6,
            "usgs_cms": [0.4, 0.6, 1.4, 8.0, 5.0, 1.8],
            "nwm_cms": [0.3, 0.5, 1.2, 7.5, 4.8, 1.7],
            "precip_mm": [0.0, 0.2, 0.1, 20.0, 0.2, 0.1],
            "temp_c": [25.0, 20.0, 4.0, 12.0, 18.0, 19.0],
        }
    )

    annotated = annotate_hydrologic_context(frame)
    labels = annotated["regime_label"].astype(str).tolist()

    assert "drought" in labels
    assert "snowmelt" in labels
    assert "stormflow" in labels
    assert "baseflow" in labels


def test_latent_analysis_pipeline_smoke(tmp_path: Path) -> None:
    pytest.importorskip("sklearn")
    pytest.importorskip("umap")
    from modeling.analysis.latent_space.extract_latent_states import extract_latent_states
    from modeling.analysis.latent_space.plot_latent_space import generate_latent_figures
    from modeling.analysis.latent_space.reduce_latent_dimensionality import reduce_latent_dimensionality

    data_path = tmp_path / "hourly_training_03161000.parquet"
    frame = _build_synthetic_training_frame(site_id="03161000", start="2020-01-01 00:00:00", periods=240)
    frame.to_parquet(data_path, index=False)

    checkpoint_path, config_path = _write_checkpoint_bundle(tmp_path)
    split_path = _write_split_config(tmp_path)

    latent_states_path, extraction_summary = extract_latent_states(
        model_path=checkpoint_path,
        model_config_path=config_path,
        data_path=data_path,
        output_path=tmp_path / "datasets" / "latent_states.parquet",
        split="test",
        split_config_path=split_path,
        latent_source="fused",
        batch_size=32,
        device="cpu",
    )

    latent_df = pd.read_parquet(latent_states_path)
    assert extraction_summary["latent_dim"] == 8
    assert {"timestamp", "site_id", "latent_vector", "regime_label", "season"}.issubset(latent_df.columns)
    assert len(latent_df.iloc[0]["latent_vector"]) == 8

    embeddings_path, reduction_summary = reduce_latent_dimensionality(
        latent_states_path=latent_states_path,
        embeddings_path=tmp_path / "datasets" / "latent_2d_embeddings.parquet",
        artifacts_dir=tmp_path / "artifacts",
        max_points=64,
        cluster_k=4,
        random_state=42,
    )

    embeddings_df = pd.read_parquet(embeddings_path)
    assert reduction_summary["sample_rows"] == len(embeddings_df)
    assert {
        "pca_x",
        "pca_y",
        "tsne_x",
        "tsne_y",
        "umap_x",
        "umap_y",
        "cluster_id",
    }.issubset(embeddings_df.columns)

    figure_outputs = generate_latent_figures(
        embeddings_path=embeddings_path,
        latent_states_path=latent_states_path,
        artifacts_dir=tmp_path / "artifacts",
        figures_dir=tmp_path / "figures",
        interactive=False,
    )

    for output in figure_outputs.values():
        assert Path(output).exists()
