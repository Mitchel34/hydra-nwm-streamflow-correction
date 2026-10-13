"""Regression tests for the retrospective target-valid-time study contract."""

from __future__ import annotations

import numpy as np
import pandas as pd
import torch

from modeling.training.data_utils import (
    SeqDataset,
    build_split_dataset,
    prepare_site_data,
    resolve_split_masks,
)
from modeling.training.train_quick_transformer_torch import _unpack_predictions
from scripts.evaluation.compute_persistence_baselines import exact_hour_pairs
from scripts.evaluation.compute_rigorous_eval import moving_block_bootstrap


def _arrays(n: int) -> tuple[np.ndarray, ...]:
    dynamic = np.arange(n * 2, dtype=np.float32).reshape(n, 2)
    static = np.zeros((n, 0), dtype=np.float32)
    residual = np.arange(n, dtype=np.float32)
    usgs = residual + 10.0
    nwm = usgs - residual
    return dynamic, static, residual, usgs, nwm


def test_seq_dataset_rejects_windows_crossing_timestamp_gaps() -> None:
    timestamps = pd.to_datetime(
        [
            "2020-01-01 00:00",
            "2020-01-01 01:00",
            "2020-01-01 02:00",
            "2020-01-01 03:00",
            "2020-01-01 05:00",
            "2020-01-01 06:00",
            "2020-01-01 07:00",
            "2020-01-01 08:00",
        ]
    ).to_numpy()
    dynamic, static, residual, usgs, nwm = _arrays(len(timestamps))
    dataset = SeqDataset(dynamic, static, residual, usgs, nwm, timestamps, seq_len=3)

    assert dataset.target_indices.tolist() == [3, 7]
    assert len(dataset) == 2


def test_date_only_split_ends_include_the_full_final_day() -> None:
    df = pd.DataFrame({"timestamp": pd.date_range("2020-01-01", "2020-01-03 23:00", freq="h")})
    masks = resolve_split_masks(
        df,
        seq_len=3,
        train_days=0,
        val_days=0,
        train_start="2020-01-01",
        train_end="2020-01-01",
        val_start="2020-01-02",
        val_end="2020-01-02",
        test_start="2020-01-03",
        test_end="2020-01-03",
    )

    assert int(masks.train.sum()) == 24
    assert int(masks.val.sum()) == 24
    assert int(masks.test.sum()) == 24
    assert masks.train_end == pd.Timestamp("2020-01-01 23:59:59.999999999")


def test_split_target_metadata_stays_aligned_after_gap_filtering() -> None:
    timestamps = pd.date_range("2020-01-01", "2020-01-04 23:00", freq="h")
    timestamps = timestamps.delete(60)
    n = len(timestamps)
    df = pd.DataFrame(
        {
            "timestamp": timestamps,
            "site_id": "03161000",
            "nwm_cms": np.linspace(1.0, 2.0, n),
            "usgs_cms": np.linspace(1.5, 2.5, n),
            "temp_c": np.linspace(0.0, 10.0, n),
        }
    )
    df["y_residual_cms"] = df["usgs_cms"] - df["nwm_cms"]
    prepared = prepare_site_data(
        df,
        seq_len=3,
        train_days=0,
        val_days=0,
        train_start="2020-01-01",
        train_end="2020-01-01",
        val_start="2020-01-02",
        val_end="2020-01-02",
        test_start="2020-01-03",
        test_end="2020-01-04",
        include_usgs=True,
    )
    dataset, targets = build_split_dataset(prepared, "test")

    assert dataset is not None
    assert len(dataset) == len(targets)
    available = set(df["timestamp"])
    for target in targets["timestamp"]:
        assert all(target - pd.Timedelta(hours=offset) in available for offset in range(0, 4))


def test_direct_mode_does_not_add_target_time_nwm() -> None:
    head_value = torch.tensor([10.0])
    outputs = {
        "residual_mean": torch.asinh(head_value),
        "residual_logvar": torch.zeros(1),
        "corrected_logvar": torch.zeros(1),
    }
    nwm = torch.tensor([3.0])

    direct_residual, _, direct_flow, *_ = _unpack_predictions(outputs, nwm, "direct")
    residual_residual, _, residual_flow, *_ = _unpack_predictions(outputs, nwm, "residual")

    assert torch.allclose(direct_flow, torch.tensor([10.0]))
    assert torch.allclose(direct_residual, torch.tensor([7.0]))
    assert torch.allclose(residual_flow, torch.tensor([13.0]))
    assert torch.allclose(residual_residual, torch.tensor([10.0]))


def test_persistence_pairs_require_exactly_one_hour() -> None:
    index = pd.to_datetime(
        ["2020-01-01 00:00", "2020-01-01 01:00", "2020-01-01 03:00", "2020-01-01 04:00"]
    )
    df = pd.DataFrame({"usgs_cms": [1.0, 2.0, 3.0, 4.0]}, index=index)
    current, previous = exact_hour_pairs(df)

    assert current.index.tolist() == [index[1], index[3]]
    assert previous["usgs_cms"].tolist() == [1.0, 3.0]


def test_bootstrap_uses_only_continuous_hourly_blocks() -> None:
    first = pd.date_range("2020-01-01", periods=30, freq="h")
    second = pd.date_range("2020-01-03", periods=30, freq="h")
    index = first.append(second)
    df = pd.DataFrame({"value": np.arange(len(index), dtype=float)}, index=index)

    result = moving_block_bootstrap(
        lambda sample: float(sample["value"].mean()),
        df,
        block_size=24,
        n_reps=20,
        rng=np.random.default_rng(7),
    )

    assert result["n_valid_blocks"] == 14
    assert result["ci"] is not None


def test_bootstrap_withholds_interval_when_short_segments_have_no_sampling_support() -> None:
    first = pd.date_range('2020-01-01', periods=48, freq='h')
    isolated = pd.date_range('2020-02-01', periods=52, freq='2h')
    frame = pd.DataFrame({'value': [0.0] * 48 + [100.0] * 52}, index=first.append(isolated))
    result = moving_block_bootstrap(lambda sample: float(sample.value.mean()), frame,
                                   block_size=24, n_reps=20, rng=np.random.default_rng(3))
    assert result['value'] == 52.0
    assert result['n_samples'] == 100
    assert result['n_covered_rows'] == 48
    assert result['ci'] is None
    assert result['reason'] == 'incomplete_block_population'


def test_regime_bootstrap_selects_after_resampling_full_hourly_population() -> None:
    from scripts.evaluation.compute_rigorous_eval import regime_block_bootstrap
    frame = pd.DataFrame({'value': np.arange(240, dtype=float)},
                         index=pd.date_range('2020-01-01', periods=240, freq='h'))
    mask = np.arange(240) % 2 == 0
    def mean_selected(sample):
        assert (sample.value % 2 == 0).all()
        return float(sample.value.mean())
    result = regime_block_bootstrap(mean_selected, frame, mask, block_size=24,
                                   n_reps=20, rng=np.random.default_rng(3))
    assert result['value'] == 119.0
    assert result['n_regime_samples'] == 120
    assert result['n_samples'] == result['n_covered_rows'] == 240
    assert result['sampling_population'] == 'full_window_before_regime_selection'
    assert result['ci'] is not None


def test_persistence_comparisons_share_finite_support_and_report_exclusions() -> None:
    from pathlib import Path
    from tempfile import TemporaryDirectory
    from scripts.evaluation.compute_persistence_baselines import compute_persistence_baselines
    frame = pd.DataFrame({
        'timestamp': pd.date_range('2020-01-01', periods=7, freq='h'),
        'usgs_cms': [10, np.nan, 30, 40, 50, 60, 70],
        'nwm_cms': [9, 20, 29, 39, np.inf, 59, 69],
        'y_true_residual_cms': [1, 1, np.nan, 1, 1, 1, 1],
    })
    with TemporaryDirectory(prefix='hydra-contract-') as temporary:
        directory = Path(temporary)
        for site in ['03161000', '03164000', '03479000']:
            frame.to_csv(directory / f'synthetic_{site}_eval.csv', index=False)
        result = compute_persistence_baselines('synthetic', directory, directory / 'result.csv')
    assert (result.n_exact_hour_pairs == 6).all()
    assert (result.n_comparison_pairs == 2).all()
    assert (result.n_pairs_excluded_nonfinite == 4).all()
    assert (result.nwm_rmse == 1.0).all()
    assert (result.res_persist_rmse == 0.0).all()
    assert (result.flow_persist_rmse == 10.0).all()
    assert (result.flow_persist_reduction == -900.0).all()
