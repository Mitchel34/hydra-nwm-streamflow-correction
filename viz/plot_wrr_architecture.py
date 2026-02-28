#!/usr/bin/env python3
"""Hydra v3 architecture diagram for WRR manuscript.

Produces a vertical flow diagram showing the USGS+NWM+ERA5 nowcasting
configuration of the Hydra v3 model: inputs → feature gating → GRU encoder
→ Transformer encoder → multi-scale convolution + attention pooling →
fusion → regime-conditioned bias → residual head → corrected discharge.

Usage:
    PYTHONPATH=. python -m viz.plot_wrr_architecture \
        --output docs/figures/wrr_architecture.pdf
"""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from viz.style import apply_wrr_style
from viz.utils import ensure_parent


# ── Colour palette ────────────────────────────────────────────────────────────
C_INPUT   = "#cce5ff"   # light blue  – input features
C_GATE    = "#d4edda"   # light green – gating / normalisation
C_SEQ     = "#fff3cd"   # light amber – sequential (GRU / Transformer)
C_POOL    = "#fde8e8"   # light red   – pooling / multi-scale
C_FUSION  = "#e8d5f5"   # light purple – fusion
C_HEAD    = "#f0f0f0"   # light grey  – output head
C_OUTPUT  = "#ffffff"   # white        – final output
EDGE      = "#444444"


def _box(ax, xy, width, height, label, sublabel=None,
         facecolor=C_SEQ, fontsize=13, bold=False):
    """Draw a rounded rectangle with centred text."""
    x, y = xy
    fancy = FancyBboxPatch(
        (x - width / 2, y - height / 2), width, height,
        boxstyle="round,pad=0.03",
        facecolor=facecolor, edgecolor=EDGE, linewidth=1.2, zorder=3,
    )
    ax.add_patch(fancy)
    weight = "bold" if bold else "normal"
    ya = y + 0.06 if sublabel else y
    ax.text(x, ya, label, ha="center", va="center",
            fontsize=fontsize, fontweight=weight, zorder=4)
    if sublabel:
        ax.text(x, y - 0.13, sublabel, ha="center", va="center",
                fontsize=fontsize - 2, color="#555555", zorder=4,
                style="italic")


def _arrow(ax, x, y_from, y_to, color=EDGE):
    """Draw a downward arrow between two y positions at x."""
    ax.annotate(
        "", xy=(x, y_to + 0.02), xytext=(x, y_from - 0.02),
        arrowprops=dict(arrowstyle="-|>", color=color, lw=1.5),
        zorder=5,
    )


def _brace_arrow(ax, x_from, x_to, y, label="", color="#888888"):
    """Horizontal arrow with optional label (for side inputs)."""
    ax.annotate(
        "", xy=(x_to, y), xytext=(x_from, y),
        arrowprops=dict(arrowstyle="-|>", color=color, lw=1.2,
                        connectionstyle="arc3,rad=0.0"),
        zorder=5,
    )
    if label:
        mid_x = (x_from + x_to) / 2
        ax.text(mid_x, y + 0.07, label, ha="center", va="bottom",
                fontsize=11, color=color)


def plot_wrr_architecture(output: str | Path = "docs/figures/wrr_architecture.pdf") -> None:
    apply_wrr_style()
    plt.rcParams.update({
        "font.size": 13,
        "axes.labelsize": 13,
    })

    fig, ax = plt.subplots(figsize=(9, 18))
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis("off")

    # ── Layout constants ──────────────────────────────────────────────────────
    cx   = 0.50   # main column centre x
    bw   = 0.52   # box width  (main blocks)
    bh   = 0.058  # box height (main blocks)
    gap  = 0.095  # vertical gap between box centres

    # y positions top → bottom
    y_inputs   = 0.940
    y_gate     = 0.840
    y_norm_gru = 0.740
    y_pos      = 0.648
    y_trans    = 0.548
    y_pool     = 0.448
    y_multi    = 0.348
    y_fusion   = 0.258
    y_regime   = 0.168
    y_head     = 0.088
    y_output   = 0.020

    # ── Input block (3 sources side-by-side) ──────────────────────────────────
    iw, ih = 0.145, 0.052
    for i, (label, sub, xc) in enumerate([
        ("USGS",   "Lagged obs.", 0.175),
        ("NWM",    "Baseline Q",  0.500),
        ("ERA5",   "Meteo.",      0.825),
    ]):
        _box(ax, (xc, y_inputs), iw, ih, label, sub,
             facecolor=C_INPUT, fontsize=12)

    # Merge arrows from the three inputs down to feature gate
    for xc in (0.175, 0.500, 0.825):
        ax.annotate(
            "", xy=(cx, y_gate + bh / 2 + 0.005),
            xytext=(xc, y_inputs - ih / 2 - 0.005),
            arrowprops=dict(
                arrowstyle="-|>", color=EDGE, lw=1.2,
                connectionstyle="arc3,rad=0.0",
            ),
            zorder=5,
        )

    # ── Main blocks ───────────────────────────────────────────────────────────
    blocks = [
        (y_gate,     "Feature Importance Gate",  "(A2 — learned per-timestep weights)",   C_GATE),
        (y_norm_gru, "LayerNorm  +  GRU Encoder","(d_model = 128, seq_len = 168 h)",       C_SEQ),
        (y_pos,      "Positional Encoding",       "(sinusoidal)",                           C_SEQ),
        (y_trans,    "Transformer Encoder",       "(4 layers, 4 heads, GELU, d_ff = 256)", C_SEQ),
        (y_pool,     "Attention Pooling",         "(learned pool token)",                   C_POOL),
        (y_multi,    "Gated Multi-Scale Conv",    "(A1 — short / mid / long range)",        C_POOL),
        (y_fusion,   "Fusion Layer",              "(last · mean · max · pool · multi-scale)",C_FUSION),
        (y_regime,   "Regime-Conditioned Bias",   "(A4 — flow-state MLP)",                  C_FUSION),
        (y_head,     "Residual Head",             "(linear → R̂(t))",                        C_HEAD),
    ]

    for i, (y, label, sub, col) in enumerate(blocks):
        _box(ax, (cx, y), bw, bh, label, sub, facecolor=col, fontsize=12)
        if i > 0:
            _arrow(ax, cx, blocks[i - 1][0] - bh / 2, y + bh / 2)

    # ── Output equation ───────────────────────────────────────────────────────
    ax.text(cx, y_output + 0.015,
            r"$\hat{Q}_{\mathrm{corr}}(t) = Q_{\mathrm{NWM}}(t) + \hat{R}(t)$",
            ha="center", va="center", fontsize=14, fontweight="bold",
            bbox=dict(boxstyle="round,pad=0.4", facecolor=C_OUTPUT,
                      edgecolor=EDGE, linewidth=1.5),
            zorder=4)
    _arrow(ax, cx, y_head - bh / 2, y_output + 0.038)

    # ── Section bracket labels (right margin) ─────────────────────────────────
    def _bracket_label(ax, y_top, y_bot, label, x=0.84):
        ymid = (y_top + y_bot) / 2
        ax.annotate(
            label,
            xy=(x + 0.01, ymid), xytext=(x + 0.01, ymid),
            ha="left", va="center", fontsize=10, color="#666666",
            style="italic",
        )
        ax.plot([x, x], [y_bot, y_top], color="#aaaaaa", lw=1.0, zorder=2)

    _bracket_label(ax, y_gate + bh / 2, y_gate - bh / 2,   "Input\nprocessing")
    _bracket_label(ax, y_norm_gru + bh / 2, y_trans - bh / 2, "Sequential\nencoding")
    _bracket_label(ax, y_pool + bh / 2, y_multi - bh / 2,  "Pooling &\nmulti-scale")
    _bracket_label(ax, y_fusion + bh / 2, y_regime - bh / 2, "Fusion &\nbias")

    # ── Title ─────────────────────────────────────────────────────────────────
    ax.text(cx, 0.992,
            "Hydra v3 Architecture  (USGS + NWM + ERA5 Nowcasting Mode)",
            ha="center", va="top", fontsize=14, fontweight="bold")

    ensure_parent(output)
    fig.savefig(output, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Saved: {output}")


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument(
        "--output", type=Path, default=Path("docs/figures/wrr_architecture.pdf"),
    )
    return ap


def main() -> None:
    args = build_parser().parse_args()
    plot_wrr_architecture(output=args.output)


if __name__ == "__main__":
    main()
