import math
from typing import Iterable, Optional

import torch
from torch import nn


class PositionalEncoding(nn.Module):
    """Standard sinusoidal positional encoding."""

    def __init__(self, d_model: int, max_len: int = 4096) -> None:
        super().__init__()
        pe = torch.zeros(max_len, d_model)
        position = torch.arange(0, max_len, dtype=torch.float32).unsqueeze(1)
        div_term = torch.exp(torch.arange(0, d_model, 2, dtype=torch.float32) * (-math.log(10000.0) / d_model))

        pe[:, 0::2] = torch.sin(position * div_term)
        pe[:, 1::2] = torch.cos(position * div_term)
        self.register_buffer("pe", pe.unsqueeze(0))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        seq_len = x.size(1)
        return x + self.pe[:, :seq_len]


# ---------------------------------------------------------------------------
# A2: Feature Importance Gate (FIG)
# Learns to upweight precipitation/soil-moisture during storm events and
# downweight irrelevant features during baseflow.
# ---------------------------------------------------------------------------

class FeatureImportanceGate(nn.Module):
    """Input-dependent gating that lets the model emphasise relevant features
    (e.g. precip intensity) on a per-timestep basis before the GRU encoder."""

    def __init__(self, input_dim: int, hidden_dim: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.gate = nn.Sequential(
            nn.Linear(input_dim, hidden_dim),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(hidden_dim, input_dim),
            nn.Sigmoid(),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (batch, seq_len, input_dim) -> gated x of same shape."""
        return x * self.gate(x)


# ---------------------------------------------------------------------------
# A1: Multi-Scale Temporal Convolution with Gated Fusion
# Replaces the fixed [1, 3, 6] dilated convs with three explicit scale
# branches targeting storm response, rising/falling limbs, and antecedent
# moisture — then learns a per-sample gated mixture.
# ---------------------------------------------------------------------------

class MultiScaleConvBranch(nn.Module):
    """A single branch of the multi-scale temporal convolution block.
    Each branch targets a specific hydrological timescale."""

    def __init__(
        self,
        d_model: int,
        kernel_size: int,
        dilation: int,
        dropout: float = 0.1,
    ) -> None:
        super().__init__()
        padding = (kernel_size - 1) * dilation  # causal-style: full left padding
        self.conv = nn.Conv1d(d_model, d_model, kernel_size, dilation=dilation, padding=padding)
        self.norm = nn.BatchNorm1d(d_model)
        self.act = nn.GELU()
        self.drop = nn.Dropout(dropout)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """x: (batch, d_model, seq_len) -> (batch, d_model, seq_len)."""
        out = self.conv(x)
        # Trim right side to keep causal alignment (no future leakage)
        out = out[:, :, :x.size(2)]
        return self.drop(self.act(self.norm(out)))


class GatedMultiScaleConv(nn.Module):
    """Three-branch multi-scale convolution with learned gating.

    Branches:
        - Short-range (k=3, d=1–2): rapid storm response (1–6h)
        - Mid-range (k=5, d=4–6): rising/falling limbs (6–48h)
        - Long-range (k=7, d=12–16): antecedent moisture / recession (2–7d)

    The gate produces a (batch, 3) softmax weighting so the model learns
    which temporal scale matters most for each sample.
    """

    def __init__(self, d_model: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.short = MultiScaleConvBranch(d_model, kernel_size=3, dilation=2, dropout=dropout)
        self.mid = MultiScaleConvBranch(d_model, kernel_size=5, dilation=6, dropout=dropout)
        self.long = MultiScaleConvBranch(d_model, kernel_size=7, dilation=16, dropout=dropout)
        # Gate: takes the last-timestep representation and outputs 3 mixing weights
        self.gate = nn.Sequential(
            nn.Linear(d_model, d_model // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 2, 3),
        )

    def forward(self, encoded: torch.Tensor) -> torch.Tensor:
        """encoded: (batch, seq_len, d_model) ->  (batch, d_model) fused summary."""
        x = encoded.transpose(1, 2)  # (batch, d_model, seq_len)
        s_out = self.short(x).transpose(1, 2)[:, -1, :]  # (batch, d_model)
        m_out = self.mid(x).transpose(1, 2)[:, -1, :]
        l_out = self.long(x).transpose(1, 2)[:, -1, :]

        # Stack: (batch, 3, d_model)
        stacked = torch.stack([s_out, m_out, l_out], dim=1)
        # Gate weights from the last encoded timestep: (batch, 3)
        gate_logits = self.gate(encoded[:, -1, :])
        gate_weights = torch.softmax(gate_logits, dim=-1).unsqueeze(-1)  # (batch, 3, 1)
        # Weighted fusion: (batch, d_model)
        fused = (stacked * gate_weights).sum(dim=1)
        return fused


# ---------------------------------------------------------------------------
# A4: Regime-Conditioned Bias
# Replaces the scalar residual_bias with a small network that produces a
# flow-regime-dependent bias from the fused representation.
# ---------------------------------------------------------------------------

class RegimeConditionedBias(nn.Module):
    """Learns a context-dependent residual bias instead of a fixed scalar.
    NWM systematic errors differ by flow regime (peaks vs. recessions);
    a single scalar cannot correct both directions."""

    def __init__(self, d_model: int, dropout: float = 0.1) -> None:
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(d_model, d_model // 4),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(d_model // 4, 1),
        )
        # Initialize near the old fixed bias of -0.15 so early training
        # starts from a similar point as v2
        nn.init.constant_(self.net[-1].bias, -0.15)
        nn.init.zeros_(self.net[-1].weight)

    def forward(self, fused: torch.Tensor) -> torch.Tensor:
        """fused: (batch, d_model) -> (batch,) bias values."""
        return self.net(fused).squeeze(-1)


# ---------------------------------------------------------------------------
# Hydra v3: GRU-Transformer hybrid with Feature Importance Gate,
# Gated Multi-Scale Convolutions, and Regime-Conditioned Bias.
# ---------------------------------------------------------------------------

class HydraTemporalV3(nn.Module):
    """Hydra v3 — improved GRU-Transformer hybrid for NWM error correction.

    Architectural improvements over v2:
        A1. GatedMultiScaleConv replaces fixed dilated convolutions to
            explicitly separate storm / rising-limb / recession timescales
            with a learned per-sample gate.
        A2. FeatureImportanceGate before the GRU lets the model upweight
            precipitation and soil-moisture during rain events.
        A4. RegimeConditionedBias replaces the scalar residual_bias with a
            small MLP conditioned on the fused representation to produce
            flow-regime-dependent bias corrections.
    """

    def __init__(
        self,
        input_dim: int,
        static_dim: int = 0,
        d_model: int = 64,
        num_heads: int = 4,
        num_layers: int = 2,
        seq_len: int = 168,
        conv_depth: int = 1,
        dropout: float = 0.1,
        quantiles: Optional[Iterable[float]] = None,
        nwm_index: int = 0,
        patch_size: int = 1,
        gain_scale: float = 0.05,
        logvar_min: float = -4.0,
        logvar_max: float = 2.0,
        moe_experts: int = 1,
        use_causal_mask: bool = False,
    ) -> None:
        super().__init__()
        # Retained for config compat; unused directly
        del seq_len, conv_depth, patch_size, gain_scale, moe_experts
        self.use_causal_mask = use_causal_mask
        self.quantiles = tuple(float(q) for q in quantiles) if quantiles else None
        self.logvar_min = logvar_min
        self.logvar_max = logvar_max

        # ---- A2: Feature Importance Gate ----
        self.feature_gate = FeatureImportanceGate(input_dim, hidden_dim=d_model, dropout=dropout)

        self.input_norm = nn.LayerNorm(input_dim)
        self.pre_gru = nn.GRU(input_dim, d_model, batch_first=True)
        self.positional = PositionalEncoding(d_model)
        self.dropout = nn.Dropout(dropout)

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=num_heads,
            dim_feedforward=d_model * 2,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.transformer_norm = nn.LayerNorm(d_model)

        # Attention pooling
        self.pool_token = nn.Parameter(torch.randn(1, 1, d_model))
        self.attn_pool = nn.MultiheadAttention(d_model, num_heads, dropout=dropout, batch_first=True)

        # ---- A1: Gated Multi-Scale Convolution ----
        self.multi_scale = GatedMultiScaleConv(d_model, dropout=dropout)

        # Static features (cross-attention)
        if static_dim > 0:
            self.static_encoder = nn.Sequential(
                nn.LayerNorm(static_dim),
                nn.Linear(static_dim, d_model),
                nn.GELU(),
                nn.Dropout(dropout),
            )
            self.static_cross = nn.MultiheadAttention(d_model, num_heads, dropout=dropout, batch_first=True)
            self.static_dropout = nn.Dropout(dropout)
        else:
            self.static_encoder = None
            self.static_cross = None
            self.static_dropout = None

        # Fusion: last + mean + max + attn_pooled + multi_scale_fused = 5 * d_model
        summary_components = 5
        fusion_dim = d_model * summary_components
        if self.static_encoder is not None:
            fusion_dim += d_model
        self.fusion = nn.Sequential(
            nn.Linear(fusion_dim, d_model),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # Prediction heads
        self.residual_head = nn.Linear(d_model, 1)
        self.residual_logvar_head = nn.Linear(d_model, 1)
        self.corrected_logvar_head = nn.Linear(d_model, 1)

        # ---- A4: Regime-Conditioned Bias (replaces scalar residual_bias) ----
        self.regime_bias = RegimeConditionedBias(d_model, dropout=dropout)
        # Keep a residual_bias attribute for compatibility with bias-shift calibration
        self.residual_bias = nn.Parameter(torch.tensor([0.0], dtype=torch.float32))

        if self.quantiles:
            self.quantile_head = nn.Linear(d_model, len(self.quantiles))
        else:
            self.quantile_head = None

    def _summary(self, encoded: torch.Tensor) -> torch.Tensor:
        last = encoded[:, -1, :]
        mean = encoded.mean(dim=1)
        max_pool = encoded.max(dim=1).values
        return torch.cat([last, mean, max_pool], dim=-1)

    def _stabilize_logvar(self, raw: torch.Tensor) -> torch.Tensor:
        return torch.clamp(
            torch.log(torch.nn.functional.softplus(raw) + 1e-4),
            self.logvar_min,
            self.logvar_max,
        )

    def forward(
        self,
        x_seq: torch.Tensor,
        static_feats: Optional[torch.Tensor] = None,
        return_intermediates: bool = False,
    ) -> dict:
        # A2: gate the raw features before anything else
        seq = self.feature_gate(x_seq)
        seq = self.input_norm(seq)
        gru_encoded, _ = self.pre_gru(seq)
        seq = self.positional(gru_encoded)
        seq = self.dropout(seq)

        # Transformer encoder with optional causal mask
        if self.use_causal_mask:
            T = seq.size(1)
            causal_mask = torch.triu(
                torch.ones(T, T, device=seq.device, dtype=torch.bool),
                diagonal=1,
            )
            encoded = self.transformer(seq, mask=causal_mask)
        else:
            encoded = self.transformer(seq)
        encoded = self.transformer_norm(encoded)

        # Summary features
        summary = self._summary(encoded)  # (batch, 3*d_model)
        pool_q = self.pool_token.expand(encoded.size(0), -1, -1)
        attn_pooled, _ = self.attn_pool(pool_q, encoded, encoded)
        attn_summary = attn_pooled.squeeze(1)  # (batch, d_model)

        # A1: multi-scale gated convolution summary
        ms_summary = self.multi_scale(encoded)  # (batch, d_model)

        # Static features (optional)
        if self.static_encoder is not None and static_feats is not None:
            static_vec = self.static_encoder(static_feats)
            static_query = static_vec.unsqueeze(1)
            static_context, _ = self.static_cross(static_query, encoded, encoded)
            static_context = self.static_dropout(static_context).squeeze(1)
            stacked = torch.cat([summary, attn_summary, ms_summary, static_context], dim=-1)
        else:
            stacked = torch.cat([summary, attn_summary, ms_summary], dim=-1)

        fused = self.fusion(stacked)

        # A4: regime-conditioned bias + optional global shift for calibration
        residual_mean = (
            self.residual_head(fused).squeeze(-1)
            + self.regime_bias(fused)
            + self.residual_bias
        )
        residual_logvar = self._stabilize_logvar(self.residual_logvar_head(fused).squeeze(-1))
        corrected_logvar = self._stabilize_logvar(self.corrected_logvar_head(fused).squeeze(-1))

        outputs = {
            "residual_mean": residual_mean,
            "residual_logvar": residual_logvar,
            "corrected_logvar": corrected_logvar,
        }

        if self.quantile_head is not None and self.quantiles:
            outputs["quantiles"] = self.quantile_head(fused)

        if return_intermediates:
            outputs["intermediates"] = {
                "gru_last": gru_encoded[:, -1, :],
                "transformer_last": encoded[:, -1, :],
                "fused": fused,
            }

        return outputs
