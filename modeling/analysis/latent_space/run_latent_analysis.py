"""End-to-end runner for Hydra latent-space analysis."""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

from modeling.analysis.latent_space.common import resolve_output_root
from modeling.analysis.latent_space.extract_latent_states import extract_latent_states
from modeling.analysis.latent_space.plot_latent_space import generate_latent_figures
from modeling.analysis.latent_space.reduce_latent_dimensionality import reduce_latent_dimensionality

LOGGER = logging.getLogger(__name__)


def run_latent_analysis(
    *,
    model_path: str,
    model_config_path: str,
    data_path: str,
    split: str = "test",
    split_config_path: str = "configs/train_val_test.json",
    out_dir: str | None = None,
    latent_source: str = "fused",
    max_embedding_points: int = 12_000,
    cluster_k: int = 4,
    batch_size: int = 512,
    trajectory_site: str | None = None,
    trajectory_start: str | None = None,
    trajectory_end: str | None = None,
    interactive: bool = False,
    device: str | None = None,
) -> Path:
    """Run extraction, reduction, and plotting in sequence."""

    output_root = resolve_output_root(out_dir, model_path=model_path, split=split)
    datasets_dir = output_root / "datasets"
    figures_dir = output_root / "figures"
    artifacts_dir = output_root / "artifacts"
    datasets_dir.mkdir(parents=True, exist_ok=True)
    figures_dir.mkdir(parents=True, exist_ok=True)
    artifacts_dir.mkdir(parents=True, exist_ok=True)

    latent_states_path, extraction_summary = extract_latent_states(
        model_path=model_path,
        model_config_path=model_config_path,
        data_path=data_path,
        output_path=datasets_dir / "latent_states.parquet",
        split=split,
        split_config_path=split_config_path,
        latent_source=latent_source,
        batch_size=batch_size,
        device=device,
    )
    embeddings_path, reduction_summary = reduce_latent_dimensionality(
        latent_states_path=latent_states_path,
        embeddings_path=datasets_dir / "latent_2d_embeddings.parquet",
        artifacts_dir=artifacts_dir,
        max_points=max_embedding_points,
        cluster_k=cluster_k,
    )
    figure_outputs = generate_latent_figures(
        embeddings_path=embeddings_path,
        latent_states_path=latent_states_path,
        artifacts_dir=artifacts_dir,
        figures_dir=figures_dir,
        trajectory_site=trajectory_site,
        trajectory_start=trajectory_start,
        trajectory_end=trajectory_end,
        interactive=interactive,
    )

    summary_path = datasets_dir / "latent_analysis_summary.json"
    summary = {
        "model_path": str(model_path),
        "model_config_path": str(model_config_path),
        "data_path": str(data_path),
        "split": split,
        "latent_source": latent_source,
        "max_embedding_points": max_embedding_points,
        "cluster_k": cluster_k,
        "outputs": {
            "latent_states": str(latent_states_path),
            "embeddings": str(embeddings_path),
            "figures": figure_outputs,
        },
        "extraction": extraction_summary,
        "reduction": reduction_summary,
    }
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    LOGGER.info("Saved latent analysis summary to %s", summary_path)
    return output_root


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--model", "--checkpoint", dest="model_path", required=True)
    parser.add_argument("--model-config", required=True)
    parser.add_argument("--data", required=True)
    parser.add_argument("--split", choices=["train", "val", "test", "all"], default="test")
    parser.add_argument("--split-config", default="configs/train_val_test.json")
    parser.add_argument("--out-dir", default=None)
    parser.add_argument("--latent-source", choices=["fused", "transformer_last", "gru_last"], default="fused")
    parser.add_argument("--max-embedding-points", type=int, default=12_000)
    parser.add_argument("--cluster-k", type=int, default=4)
    parser.add_argument("--batch-size", type=int, default=512)
    parser.add_argument("--trajectory-site", default=None)
    parser.add_argument("--trajectory-start", default=None)
    parser.add_argument("--trajectory-end", default=None)
    parser.add_argument("--interactive", action="store_true")
    parser.add_argument("--device", default=None)
    return parser


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = build_parser().parse_args()
    run_latent_analysis(
        model_path=args.model_path,
        model_config_path=args.model_config,
        data_path=args.data,
        split=args.split,
        split_config_path=args.split_config,
        out_dir=args.out_dir,
        latent_source=args.latent_source,
        max_embedding_points=args.max_embedding_points,
        cluster_k=args.cluster_k,
        batch_size=args.batch_size,
        trajectory_site=args.trajectory_site,
        trajectory_start=args.trajectory_start,
        trajectory_end=args.trajectory_end,
        interactive=args.interactive,
        device=args.device,
    )


if __name__ == "__main__":
    main()
