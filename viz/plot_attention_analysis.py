#!/usr/bin/env python3
"""WRR-quality attention analysis visualizations.

Extracts and plots:
  1. Feature importance gate activations (from FeatureImportanceGate).
  2. Transformer self-attention heatmap (averaged over heads/layers).
  3. Multi-scale convolution branch gating weights (from GatedMultiScaleConv).

Requires a trained v3 checkpoint (.pt file).  Runs a forward pass on a short
input window and captures intermediate activations via hooks.

Usage:
    python viz/plot_attention_analysis.py \
        --checkpoint local_only/artifacts/exp_v3_full_03479000_model.pt \
        --data data/processed/watauga_cluster_2010_2020_site_03479000.parquet \
        --output results/figures/attention_analysis_03479000.png \
        --site-name "Watauga River, Sugar Grove NC"
"""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import torch
import matplotlib.pyplot as plt
import matplotlib.gridspec as gridspec
from matplotlib.colors import Normalize

from viz.colors import COLORS
from viz.style import apply_wrr_style
from viz.utils import ensure_parent


# ---------------------------------------------------------------------------
# Feature list must match the training pipeline ordering
# ---------------------------------------------------------------------------
FEATURE_NAMES: list[str] = [
    "NWM Q", "Temp", "Dewpt", "Press", "Precip", "Rad",
    "Wind", "VPD", "RH", "Soil M.",
    "hr sin", "hr cos", "doy sin", "doy cos", "mo sin", "mo cos",
]


def _register_hooks(model: torch.nn.Module) -> tuple[dict[str, list[torch.Tensor]], list[Any]]:
    """Register forward hooks on the feature gate, transformer, and multi-scale conv gate."""
    store: dict[str, list[torch.Tensor]] = {
        "feature_gate": [],
        "attn_weights": [],
        "conv_gate": [],
    }
    handles: list[Any] = []

    # 1) FeatureImportanceGate — capture sigmoid output
    def _fg_hook(mod: Any, inp: Any, out: torch.Tensor) -> None:
        # Sigmoid output is x * gate(x), but we want gate(x)
        x = inp[0]
        gate_val = out / (x + 1e-12)
        store["feature_gate"].append(gate_val.detach().cpu())

    if hasattr(model, "feature_gate"):
        handles.append(model.feature_gate.register_forward_hook(_fg_hook))

    # 2) Transformer attention weights — hook into each encoder layer's self_attn
    def _make_attn_hook(layer_idx: int):
        def _hook(mod: Any, inp: Any, out: Any) -> None:
            # MultiheadAttention returns (attn_output, attn_weights) when need_weights=True
            if isinstance(out, tuple) and len(out) == 2 and out[1] is not None:
                store["attn_weights"].append(out[1].detach().cpu())
        return _hook

    if hasattr(model, "transformer") and hasattr(model.transformer, "layers"):
        for i, layer in enumerate(model.transformer.layers):
            if hasattr(layer, "self_attn"):
                # Enable weight logging
                layer.self_attn._orig_need_weights = True
                handles.append(layer.self_attn.register_forward_hook(_make_attn_hook(i)))

    # 3) GatedMultiScaleConv gate weights
    def _conv_gate_hook(mod: Any, inp: Any, out: torch.Tensor) -> None:
        # The gate module output is softmax weights (batch, 3, seq_len)
        store["conv_gate"].append(out.detach().cpu())

    if hasattr(model, "multi_scale") and hasattr(model.multi_scale, "gate"):
        handles.append(model.multi_scale.gate.register_forward_hook(_conv_gate_hook))

    return store, handles


def _load_window(data_path: str | Path, seq_len: int = 336, offset: int = 0) -> tuple[np.ndarray, pd.DatetimeIndex]:
    """Load a window of input features matching the training pipeline."""
    from modeling.build_training_dataset import DYNAMIC_FEATURE_COLS
    df = pd.read_parquet(data_path)
    if "timestamp" in df.columns:
        df = df.set_index("timestamp")
    df = df.sort_index()
    feats = [c for c in DYNAMIC_FEATURE_COLS if c in df.columns]
    arr = df[feats].iloc[offset : offset + seq_len].to_numpy(dtype=np.float32)
    timestamps = df.index[offset : offset + seq_len]
    return arr, timestamps


def plot_attention_analysis(
    *,
    checkpoint: str | Path,
    data_path: str | Path,
    output: str | Path,
    site_name: str = "",
    seq_len: int = 336,
    offset: int = 8760,  # ~1 year in → test period start
) -> None:
    apply_wrr_style()

    # ------------------------------------------------------------------
    # Load model
    # ------------------------------------------------------------------
    from modeling.models.hydra_temporal_v3 import HydraTemporalV3

    device = torch.device("cpu")
    state = torch.load(checkpoint, map_location=device, weights_only=True)
    # Infer dimensions from state dict
    input_dim = state["feature_gate.gate.0.weight"].shape[1]
    d_model = state["pre_gru.weight_ih_l0"].shape[0] // 3
    num_heads = 4  # convention
    num_layers = len([k for k in state if "self_attn.in_proj_weight" in k])
    if num_layers == 0:
        num_layers = 4
    n_quantiles = 0
    if "quantile_head.weight" in state:
        n_quantiles = state["quantile_head.weight"].shape[0]

    model = HydraTemporalV3(
        input_dim=input_dim,
        d_model=d_model,
        num_heads=num_heads,
        num_layers=num_layers,
        n_quantiles=n_quantiles,
        dropout=0.0,
    )
    model.load_state_dict(state, strict=False)
    model.eval()

    # ------------------------------------------------------------------
    # Prepare input
    # ------------------------------------------------------------------
    xnp, timestamps = _load_window(data_path, seq_len, offset)
    x = torch.from_numpy(xnp).unsqueeze(0)  # (1, seq, input_dim)

    # Need to enable attention weight output for PyTorch TransformerEncoderLayer
    for layer in model.transformer.layers:
        layer.self_attn.need_weights = True
        layer.self_attn.average_attn_weights = True

    store, handles = _register_hooks(model)
    with torch.no_grad():
        _ = model(x, None)

    for h in handles:
        h.remove()

    # ------------------------------------------------------------------
    # Build figure: 3 panels
    # ------------------------------------------------------------------
    fig = plt.figure(figsize=(14, 10))
    gs = gridspec.GridSpec(2, 2, hspace=0.35, wspace=0.3)

    # (a) Feature importance gate activation
    ax_fig = fig.add_subplot(gs[0, :])
    if store["feature_gate"]:
        fg = store["feature_gate"][0].squeeze(0).numpy()  # (seq, input_dim)
        n_feats = fg.shape[1]
        labels = FEATURE_NAMES[:n_feats] if n_feats <= len(FEATURE_NAMES) else [f"F{i}" for i in range(n_feats)]
        im = ax_fig.imshow(fg.T, aspect="auto", cmap="YlOrRd", vmin=0, vmax=1,
                           extent=[0, fg.shape[0], n_feats - 0.5, -0.5])
        ax_fig.set_yticks(range(n_feats))
        ax_fig.set_yticklabels(labels, fontsize=8)
        ax_fig.set_xlabel("Timestep (hourly)")
        plt.colorbar(im, ax=ax_fig, label="Gate activation")
    else:
        ax_fig.text(0.5, 0.5, "Feature gate data not captured", ha="center", transform=ax_fig.transAxes)
    ax_fig.set_title("(a) Feature Importance Gate Activations", fontsize=11, fontweight="bold")

    # (b) Averaged self-attention heatmap
    ax_attn = fig.add_subplot(gs[1, 0])
    if store["attn_weights"]:
        # Average over all layers and heads
        attn = torch.stack(store["attn_weights"]).mean(dim=0).squeeze(0).numpy()  # (seq, seq)
        # Show only last 48 rows for readability
        show = min(48, attn.shape[0])
        im2 = ax_attn.imshow(attn[-show:, -show:], aspect="auto", cmap="viridis",
                              extent=[0, show, show, 0])
        ax_attn.set_xlabel("Key timestep (last 48h)")
        ax_attn.set_ylabel("Query timestep")
        plt.colorbar(im2, ax=ax_attn, label="Attention weight")
    else:
        ax_attn.text(0.5, 0.5, "Attention data not captured\n(enable need_weights)", ha="center",
                     transform=ax_attn.transAxes, fontsize=9)
    ax_attn.set_title("(b) Avg Self-Attention", fontsize=11, fontweight="bold")

    # (c) Multi-scale conv branch gating weights over time
    ax_gate = fig.add_subplot(gs[1, 1])
    if store["conv_gate"]:
        gw = store["conv_gate"][0].squeeze(0).numpy()  # (3, seq)
        branch_labels = ["Storm (k=3, d=2)", "Rising/Falling (k=5, d=6)", "Antecedent (k=7, d=16)"]
        for i, label in enumerate(branch_labels):
            ax_gate.plot(gw[i], label=label, linewidth=1.2)
        ax_gate.set_xlabel("Timestep (hourly)")
        ax_gate.set_ylabel("Gate weight (softmax)")
        ax_gate.legend(fontsize=8, loc="upper right")
        ax_gate.set_ylim(0, 1)
    else:
        ax_gate.text(0.5, 0.5, "Conv gate data not captured", ha="center", transform=ax_gate.transAxes)
    ax_gate.set_title("(c) Multi-Scale Conv Gating", fontsize=11, fontweight="bold")

    title = "Attention & Gating Analysis"
    if site_name:
        title += f" — {site_name}"
    fig.suptitle(title, fontsize=13, fontweight="bold", y=1.01)

    ensure_parent(output)
    fig.savefig(output, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {output}")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--checkpoint", type=Path, required=True, help="Path to trained .pt model checkpoint")
    ap.add_argument("--data", type=Path, required=True, help="Path to parquet data file for the same site")
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--site-name", default="")
    ap.add_argument("--seq-len", type=int, default=336)
    ap.add_argument("--offset", type=int, default=8760, help="Starting timestep offset into dataset")
    args = ap.parse_args()
    plot_attention_analysis(
        checkpoint=args.checkpoint,
        data_path=args.data,
        output=args.output,
        site_name=args.site_name,
        seq_len=args.seq_len,
        offset=args.offset,
    )


if __name__ == "__main__":
    main()
