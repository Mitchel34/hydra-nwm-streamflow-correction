"""Plot baseline (NWM) vs Hydra evaluation metrics as grouped bars."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Sequence

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns

try:  # pragma: no cover - support running as a script
    from . import colors, utils
except ImportError:  # pragma: no cover
    import sys

    REPO_ROOT = Path(__file__).resolve().parents[1]
    if str(REPO_ROOT) not in sys.path:
        sys.path.append(str(REPO_ROOT))
    from viz import colors, utils

DEFAULT_METRICS = ("rmse", "mae", "nse", "kge", "pbias")
METRIC_LABELS = {
    "rmse": "RMSE (m³/s)",
    "mae": "MAE (m³/s)",
    "nse": "NSE",
    "kge": "KGE",
    "pbias": "PBIAS (%)",
}


def load_metrics(path: Path, metric_keys: Sequence[str]) -> pd.DataFrame:
    with path.open() as fp:
        payload = json.load(fp)

    if "baseline" not in payload or "corrected" not in payload:
        raise KeyError(f"{path} must contain 'baseline' and 'corrected' sections")

    records = []
    for metric in metric_keys:
        metric_lower = metric.lower()
        if metric_lower not in payload["baseline"] or metric_lower not in payload["corrected"]:
            raise KeyError(f"Metric '{metric}' not found in {path}")
        label = METRIC_LABELS.get(metric_lower, metric_lower.upper())
        records.append(
            {
                "Metric": label,
                "Model": "NWM",
                "Value": payload["baseline"][metric_lower],
            }
        )
        records.append(
            {
                "Metric": label,
                "Model": "Hydra",
                "Value": payload["corrected"][metric_lower],
            }
        )
    return pd.DataFrame.from_records(records)


def plot_baseline_vs_hydra(
    metrics_path: Path,
    output_path: Path,
    *,
    metric_keys: Sequence[str],
    title: str | None = None,
) -> None:
    utils.configure_style()
    utils.validate_inputs([metrics_path])

    df = load_metrics(metrics_path, metric_keys)

    fig, ax = plt.subplots(figsize=(7, 4))

    palette = {
        "NWM": "#8c8c8c",  # gray
        "Hydra": "#d62728",  # red
    }

    sns.barplot(
        data=df,
        x="Metric",
        y="Value",
        hue="Model",
        palette=palette,
        edgecolor="black",
        linewidth=0.8,
        ax=ax,
    )

    if title:
        ax.set_title(title, fontsize=14, fontweight="bold")
    ax.set_ylabel("Metric Value")
    ax.set_xlabel("")

    # Annotate bars with metric values
    for bar in ax.patches:
        height = bar.get_height()
        if pd.isna(height):
            continue
        ax.annotate(
            f"{height:.2f}",
            (bar.get_x() + bar.get_width() / 2, height),
            ha="center",
            va="bottom",
            fontsize=9,
        )

    ax.set_axisbelow(True)
    ax.grid(True, axis="y", linestyle="--", alpha=0.5)
    sns.despine()

    fig.tight_layout()
    utils.ensure_parent(output_path)
    fig.savefig(output_path, dpi=300)
    plt.close(fig)
    print(f"Saved plot to {output_path}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--metrics", type=Path, required=True, help="Metrics JSON with baseline/corrected sections")
    parser.add_argument("--out", type=Path, required=True, help="Output image path")
    parser.add_argument(
        "--metric-keys",
        nargs="+",
        default=list(DEFAULT_METRICS),
        help=f"Metrics to plot (default: {', '.join(DEFAULT_METRICS)})",
    )
    parser.add_argument("--title", type=str, default=None, help="Optional plot title")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    plot_baseline_vs_hydra(
        metrics_path=args.metrics,
        output_path=args.out,
        metric_keys=args.metric_keys,
        title=args.title,
    )


if __name__ == "__main__":
    main()
