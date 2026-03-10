"""Dimensionality reduction for Hydra latent states."""

from __future__ import annotations

import argparse
import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from modeling.analysis.latent_space.common import save_pickle
from viz.utils import ensure_parent

LOGGER = logging.getLogger(__name__)
DEFAULT_MAX_POINTS = 12_000
DEFAULT_RANDOM_STATE = 42


def _stack_latent_vectors(series: pd.Series) -> np.ndarray:
    return np.vstack([np.asarray(row, dtype=np.float32) for row in series])


def stratified_sample(
    latent_df: pd.DataFrame,
    *,
    max_points: int,
    random_state: int,
) -> pd.DataFrame:
    """Sample rows evenly across site/season/regime strata."""

    if len(latent_df) <= max_points:
        return latent_df.copy().reset_index(drop=True)

    strata_cols = ["site_id", "season", "regime_label"]
    grouped = list(latent_df.groupby(strata_cols, dropna=False, observed=False))
    if not grouped:
        return latent_df.sample(n=max_points, random_state=random_state).reset_index(drop=True)

    quota = max(1, max_points // len(grouped))
    sampled = [
        group.sample(n=min(len(group), quota), random_state=random_state)
        for _, group in grouped
    ]
    sampled_df = pd.concat(sampled, axis=0)
    if len(sampled_df) < max_points:
        remainder = latent_df.drop(index=sampled_df.index, errors="ignore")
        if not remainder.empty:
            take = min(max_points - len(sampled_df), len(remainder))
            sampled_df = pd.concat(
                [sampled_df, remainder.sample(n=take, random_state=random_state)],
                axis=0,
            )
    if len(sampled_df) > max_points:
        sampled_df = sampled_df.sample(n=max_points, random_state=random_state)
    return sampled_df.sort_values(["site_id", "timestamp"]).reset_index(drop=True)


def reduce_latent_dimensionality(
    *,
    latent_states_path: str | Path,
    embeddings_path: str | Path,
    artifacts_dir: str | Path,
    max_points: int = DEFAULT_MAX_POINTS,
    cluster_k: int = 4,
    random_state: int = DEFAULT_RANDOM_STATE,
) -> tuple[Path, dict[str, Any]]:
    """Fit PCA/t-SNE/UMAP/KMeans on a sampled latent dataframe."""

    from sklearn.cluster import KMeans
    from sklearn.decomposition import PCA
    from sklearn.manifold import TSNE
    from sklearn.preprocessing import StandardScaler
    import umap

    latent_df = pd.read_parquet(latent_states_path)
    sampled_df = stratified_sample(latent_df, max_points=max_points, random_state=random_state)
    if len(sampled_df) < 2:
        raise ValueError("Need at least two latent-state rows to fit PCA/t-SNE/UMAP embeddings.")
    latent_matrix = _stack_latent_vectors(sampled_df["latent_vector"])
    scaler = StandardScaler()
    latent_scaled = scaler.fit_transform(latent_matrix)

    pca = PCA(n_components=2)
    pca_embedding = pca.fit_transform(latent_scaled)

    n_samples = len(sampled_df)
    perplexity = min(30, max(1, (n_samples - 1) // 3), n_samples - 1)
    tsne = TSNE(
        n_components=2,
        perplexity=perplexity,
        init="pca",
        learning_rate="auto",
        random_state=random_state,
        max_iter=1000,
    )
    tsne_embedding = tsne.fit_transform(latent_scaled)

    umap_reducer = umap.UMAP(
        n_components=2,
        n_neighbors=min(30, max(2, n_samples - 1)),
        min_dist=0.1,
        metric="euclidean",
        random_state=random_state,
    )
    umap_embedding = umap_reducer.fit_transform(latent_scaled)

    effective_k = min(cluster_k, max(1, len(sampled_df)))
    kmeans = KMeans(n_clusters=effective_k, random_state=random_state, n_init=20)
    cluster_labels = kmeans.fit_predict(latent_scaled)

    embeddings = sampled_df.copy()
    embeddings["pca_x"] = pca_embedding[:, 0]
    embeddings["pca_y"] = pca_embedding[:, 1]
    embeddings["tsne_x"] = tsne_embedding[:, 0]
    embeddings["tsne_y"] = tsne_embedding[:, 1]
    embeddings["umap_x"] = umap_embedding[:, 0]
    embeddings["umap_y"] = umap_embedding[:, 1]
    embeddings["cluster_id"] = cluster_labels.astype(int)
    embeddings = embeddings[
        [
            "timestamp",
            "site_id",
            "split",
            "pca_x",
            "pca_y",
            "tsne_x",
            "tsne_y",
            "umap_x",
            "umap_y",
            "cluster_id",
            "streamflow_cms",
            "rainfall_mm",
            "temperature_c",
            "nwm_prediction_cms",
            "season",
            "regime_label",
            "latent_vector",
        ]
    ]
    output = ensure_parent(embeddings_path)
    embeddings.to_parquet(output, index=False)

    artifacts_root = Path(artifacts_dir)
    save_pickle(scaler, artifacts_root / "scaler.pkl")
    save_pickle(pca, artifacts_root / "pca.pkl")
    save_pickle(umap_reducer, artifacts_root / "umap.pkl")
    save_pickle(kmeans, artifacts_root / "kmeans.pkl")

    summary = {
        "latent_states_path": str(latent_states_path),
        "embeddings_path": str(output),
        "sample_rows": int(len(sampled_df)),
        "full_rows": int(len(latent_df)),
        "random_state": random_state,
        "max_points": max_points,
        "cluster_k": effective_k,
        "tsne_perplexity": perplexity,
        "pca_explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
        "artifacts_dir": str(artifacts_root),
    }
    LOGGER.info("Saved embeddings to %s (%d sampled rows).", output, len(sampled_df))
    return Path(output), summary


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", required=True, help="Path to latent_states.parquet")
    parser.add_argument("--output", required=True, help="Path to latent_2d_embeddings.parquet")
    parser.add_argument("--artifacts-dir", required=True)
    parser.add_argument("--max-points", type=int, default=DEFAULT_MAX_POINTS)
    parser.add_argument("--cluster-k", type=int, default=4)
    parser.add_argument("--random-state", type=int, default=DEFAULT_RANDOM_STATE)
    return parser


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()
    reduce_latent_dimensionality(
        latent_states_path=args.input,
        embeddings_path=args.output,
        artifacts_dir=args.artifacts_dir,
        max_points=args.max_points,
        cluster_k=args.cluster_k,
        random_state=args.random_state,
    )


if __name__ == "__main__":
    main()
