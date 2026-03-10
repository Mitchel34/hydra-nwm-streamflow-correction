"""Scientific plots for Hydra latent-space analysis."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from matplotlib.gridspec import GridSpec

from modeling.analysis.latent_space.common import (
    REGIME_ORDER,
    SEASON_ORDER,
    load_pickle,
)
from viz.style import apply_wrr_style
from viz.utils import add_panel_label, ensure_parent

LOGGER = logging.getLogger(__name__)

SEASON_PALETTE = {
    "DJF": "#4575b4",
    "MAM": "#91bfdb",
    "JJA": "#fc8d59",
    "SON": "#d73027",
}

REGIME_PALETTE = {
    "baseflow": "#4c78a8",
    "stormflow": "#e45756",
    "snowmelt": "#72b7b2",
    "drought": "#b279a2",
}

CLUSTER_PALETTE = sns.color_palette("tab10", n_colors=10)


def _scatter_continuous(ax, df: pd.DataFrame, x: str, y: str, color_col: str, title: str) -> None:
    scatter = ax.scatter(
        df[x],
        df[y],
        c=df[color_col],
        cmap="viridis",
        s=8,
        alpha=0.65,
        linewidths=0,
    )
    ax.set_title(title)
    ax.set_xlabel(x.replace("_", " ").upper())
    ax.set_ylabel(y.replace("_", " ").upper())
    plt.colorbar(scatter, ax=ax, fraction=0.046, pad=0.04)


def _scatter_categorical(
    ax,
    df: pd.DataFrame,
    x: str,
    y: str,
    color_col: str,
    title: str,
    palette: dict[str, str],
    order: list[str],
) -> None:
    sns.scatterplot(
        data=df,
        x=x,
        y=y,
        hue=color_col,
        hue_order=order,
        palette=palette,
        s=10,
        linewidth=0,
        alpha=0.75,
        ax=ax,
        legend=True,
    )
    ax.set_title(title)
    ax.set_xlabel(x.replace("_", " ").upper())
    ax.set_ylabel(y.replace("_", " ").upper())
    ax.legend(loc="best", frameon=True, fontsize=9)


def plot_embedding_panels(
    embeddings_df: pd.DataFrame,
    *,
    x_col: str,
    y_col: str,
    title_prefix: str,
    output_path: str | Path,
) -> Path:
    apply_wrr_style()
    fig, axes = plt.subplots(2, 2, figsize=(12, 10))
    panels = [
        ("streamflow_cms", "Colored by Streamflow Magnitude"),
        ("rainfall_mm", "Colored by Rainfall Intensity"),
        ("season", "Colored by Season"),
        ("regime_label", "Colored by Hydrological Regime"),
    ]

    for idx, (ax, (column, title)) in enumerate(zip(axes.flat, panels), start=1):
        if column in {"season", "regime_label"}:
            palette = SEASON_PALETTE if column == "season" else REGIME_PALETTE
            order = SEASON_ORDER if column == "season" else REGIME_ORDER
            _scatter_categorical(ax, embeddings_df, x_col, y_col, column, title, palette, order)
        else:
            _scatter_continuous(ax, embeddings_df, x_col, y_col, column, title)
        add_panel_label(ax, f"({chr(96 + idx)})")

    fig.suptitle(title_prefix, fontsize=15, fontweight="bold")
    ensure_parent(output_path)
    fig.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    LOGGER.info("Saved %s", output_path)
    return Path(output_path)


def plot_cluster_figure(embeddings_df: pd.DataFrame, output_path: str | Path) -> Path:
    apply_wrr_style()
    fig, axes = plt.subplots(1, 2, figsize=(13, 5))
    sns.scatterplot(
        data=embeddings_df,
        x="umap_x",
        y="umap_y",
        hue="cluster_id",
        palette=CLUSTER_PALETTE,
        s=10,
        linewidth=0,
        alpha=0.75,
        ax=axes[0],
    )
    axes[0].set_title("UMAP Space Colored by KMeans Cluster")
    axes[0].legend(loc="best", fontsize=9, title="Cluster")

    crosstab = pd.crosstab(
        embeddings_df["cluster_id"],
        embeddings_df["regime_label"],
        normalize="index",
    ).reindex(columns=REGIME_ORDER, fill_value=0.0)
    sns.heatmap(crosstab, annot=True, fmt=".2f", cmap="Blues", ax=axes[1])
    axes[1].set_title("Cluster vs Regime Correspondence")
    axes[1].set_xlabel("Regime Label")
    axes[1].set_ylabel("Cluster ID")

    add_panel_label(axes[0], "(a)")
    add_panel_label(axes[1], "(b)")
    ensure_parent(output_path)
    fig.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    LOGGER.info("Saved %s", output_path)
    return Path(output_path)


def plot_trajectory_figure(
    latent_states_df: pd.DataFrame,
    *,
    artifacts_dir: str | Path,
    output_path: str | Path,
    trajectory_site: str | None = None,
    trajectory_start: str | None = None,
    trajectory_end: str | None = None,
) -> Path:
    apply_wrr_style()
    selected_site = trajectory_site or str(sorted(latent_states_df["site_id"].astype(str).unique())[0])
    site_df = latent_states_df[latent_states_df["site_id"].astype(str) == selected_site].copy()
    site_df["timestamp"] = pd.to_datetime(site_df["timestamp"])

    if trajectory_start and trajectory_end:
        start = pd.Timestamp(trajectory_start)
        end = pd.Timestamp(trajectory_end)
        window_df = site_df[(site_df["timestamp"] >= start) & (site_df["timestamp"] <= end)].copy()
    else:
        peak_idx = site_df["streamflow_cms"].astype(float).idxmax()
        peak_time = site_df.loc[peak_idx, "timestamp"]
        start = peak_time - pd.Timedelta(days=7)
        end = peak_time + pd.Timedelta(days=7)
        window_df = site_df[(site_df["timestamp"] >= start) & (site_df["timestamp"] <= end)].copy()
    if len(window_df) < 2:
        raise ValueError("Trajectory window must contain at least two rows.")

    scaler = load_pickle(Path(artifacts_dir) / "scaler.pkl")
    umap_reducer = load_pickle(Path(artifacts_dir) / "umap.pkl")
    latent_matrix = np.vstack([np.asarray(row, dtype=np.float32) for row in window_df["latent_vector"]])
    coords = umap_reducer.transform(scaler.transform(latent_matrix))

    fig = plt.figure(figsize=(13, 5))
    grid = GridSpec(1, 2, figure=fig, width_ratios=[1.2, 1.0])
    ax_latent = fig.add_subplot(grid[0, 0])
    ax_hydro = fig.add_subplot(grid[0, 1])

    ax_latent.plot(coords[:, 0], coords[:, 1], color="#666666", alpha=0.65, linewidth=1.0)
    scatter = ax_latent.scatter(
        coords[:, 0],
        coords[:, 1],
        c=np.arange(len(window_df)),
        cmap="plasma",
        s=18,
        alpha=0.9,
    )
    ax_latent.scatter(coords[0, 0], coords[0, 1], color="green", s=40, label="Start")
    ax_latent.scatter(coords[-1, 0], coords[-1, 1], color="red", s=40, label="End")
    ax_latent.set_title(f"UMAP Trajectory for Site {selected_site}")
    ax_latent.set_xlabel("UMAP 1")
    ax_latent.set_ylabel("UMAP 2")
    ax_latent.legend(loc="best", fontsize=9)
    plt.colorbar(scatter, ax=ax_latent, fraction=0.046, pad=0.04, label="Time Step Order")

    ax_hydro.plot(window_df["timestamp"], window_df["streamflow_cms"], color="#1f77b4", label="Observed Flow")
    ax_hydro.set_ylabel("Streamflow (m³/s)")
    ax_hydro.set_title(f"Hydrograph Context: {start.date()} to {end.date()}")
    ax_hydro.tick_params(axis="x", rotation=30)
    ax_rain = ax_hydro.twinx()
    ax_rain.bar(
        window_df["timestamp"],
        window_df["rainfall_mm"].fillna(0.0),
        color="#74add1",
        alpha=0.35,
        width=0.03,
        label="Rainfall",
    )
    ax_rain.set_ylabel("Rainfall (mm)")

    add_panel_label(ax_latent, "(a)")
    add_panel_label(ax_hydro, "(b)")
    ensure_parent(output_path)
    fig.tight_layout()
    fig.savefig(output_path, dpi=300, bbox_inches="tight")
    plt.close(fig)
    LOGGER.info("Saved %s", output_path)
    return Path(output_path)


def plot_interactive_umap(embeddings_df: pd.DataFrame, output_path: str | Path) -> Path:
    try:
        import plotly.express as px
    except ImportError as exc:  # pragma: no cover - optional dependency
        raise ImportError("Plotly is required for --interactive output.") from exc

    figure = px.scatter(
        embeddings_df,
        x="umap_x",
        y="umap_y",
        color="regime_label",
        hover_data={
            "timestamp": True,
            "site_id": True,
            "streamflow_cms": ":.3f",
            "rainfall_mm": ":.3f",
            "season": True,
            "regime_label": True,
            "latent_vector": False,
        },
        title="Interactive UMAP Latent Space",
    )
    ensure_parent(output_path)
    figure.write_html(str(output_path), include_plotlyjs="cdn")
    LOGGER.info("Saved %s", output_path)
    return Path(output_path)


def generate_latent_figures(
    *,
    embeddings_path: str | Path,
    latent_states_path: str | Path,
    artifacts_dir: str | Path,
    figures_dir: str | Path,
    trajectory_site: str | None = None,
    trajectory_start: str | None = None,
    trajectory_end: str | None = None,
    interactive: bool = False,
) -> dict[str, str]:
    """Generate the full figure suite from latent analysis outputs."""

    embeddings_df = pd.read_parquet(embeddings_path)
    latent_states_df = pd.read_parquet(latent_states_path)
    figures_root = Path(figures_dir)
    outputs = {
        "latent_pca": str(plot_embedding_panels(
            embeddings_df,
            x_col="pca_x",
            y_col="pca_y",
            title_prefix="PCA Projection of Hydra Latent States",
            output_path=figures_root / "latent_pca.png",
        )),
        "latent_tsne": str(plot_embedding_panels(
            embeddings_df,
            x_col="tsne_x",
            y_col="tsne_y",
            title_prefix="t-SNE Projection of Hydra Latent States",
            output_path=figures_root / "latent_tsne.png",
        )),
        "latent_umap": str(plot_embedding_panels(
            embeddings_df,
            x_col="umap_x",
            y_col="umap_y",
            title_prefix="UMAP Projection of Hydra Latent States",
            output_path=figures_root / "latent_umap.png",
        )),
        "latent_clusters": str(plot_cluster_figure(
            embeddings_df,
            output_path=figures_root / "latent_clusters.png",
        )),
        "latent_state_trajectory": str(plot_trajectory_figure(
            latent_states_df,
            artifacts_dir=artifacts_dir,
            output_path=figures_root / "latent_state_trajectory.png",
            trajectory_site=trajectory_site,
            trajectory_start=trajectory_start,
            trajectory_end=trajectory_end,
        )),
    }
    if interactive:
        outputs["latent_space_interactive"] = str(
            plot_interactive_umap(embeddings_df, figures_root / "latent_space_interactive.html")
        )
    return outputs


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--embeddings", required=True)
    parser.add_argument("--latent-states", required=True)
    parser.add_argument("--artifacts-dir", required=True)
    parser.add_argument("--figures-dir", required=True)
    parser.add_argument("--trajectory-site", default=None)
    parser.add_argument("--trajectory-start", default=None)
    parser.add_argument("--trajectory-end", default=None)
    parser.add_argument("--interactive", action="store_true")
    return parser


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()
    generate_latent_figures(
        embeddings_path=args.embeddings,
        latent_states_path=args.latent_states,
        artifacts_dir=args.artifacts_dir,
        figures_dir=args.figures_dir,
        trajectory_site=args.trajectory_site,
        trajectory_start=args.trajectory_start,
        trajectory_end=args.trajectory_end,
        interactive=args.interactive,
    )


if __name__ == "__main__":
    main()
