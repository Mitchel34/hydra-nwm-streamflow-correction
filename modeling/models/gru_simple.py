"""Simple GRU model for ERA5-only streamflow prediction.

A lightweight alternative to the full Hydra architecture, using only
GRU encoding with mean/last pooling and MLP heads. Designed for the
ERA5-only experiments where no NWM input is available.
"""

import math
from typing import Iterable, Optional

import torch
from torch import nn


class SimpleGRUModel(nn.Module):
    """GRU-only model for direct streamflow prediction.

    Architecture: LayerNorm → GRU(num_layers) → [last, mean] pooling → MLP → heads

    Outputs the same dict interface as Hydra models for training script compatibility.
    """

    def __init__(
        self,
        input_dim: int,
        static_dim: int = 0,
        hidden_size: int = 128,
        num_layers: int = 2,
        dropout: float = 0.1,
        quantiles: Optional[Iterable[float]] = None,
        nwm_index: int = -1,
        # Unused kwargs for compatibility with training script
        seq_len: int = 168,
        conv_depth: int = 1,
        patch_size: int = 1,
        gain_scale: float = 0.05,
        moe_experts: int = 1,
        use_causal_mask: bool = False,
        logvar_min: float = -4.0,
        logvar_max: float = 2.0,
        **kwargs,
    ) -> None:
        super().__init__()
        del seq_len, conv_depth, patch_size, gain_scale, moe_experts, use_causal_mask, kwargs

        self.logvar_min = logvar_min
        self.logvar_max = logvar_max
        self.quantiles = tuple(float(q) for q in quantiles) if quantiles else None

        self.input_norm = nn.LayerNorm(input_dim)
        self.gru = nn.GRU(
            input_dim,
            hidden_size,
            num_layers=num_layers,
            dropout=dropout if num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.dropout = nn.Dropout(dropout)

        # Fusion: last hidden + mean pooling = 2 * hidden_size
        fusion_dim = hidden_size * 2

        if static_dim > 0:
            self.static_proj = nn.Sequential(
                nn.LayerNorm(static_dim),
                nn.Linear(static_dim, hidden_size),
                nn.GELU(),
                nn.Dropout(dropout),
            )
            fusion_dim += hidden_size
        else:
            self.static_proj = None

        self.fusion = nn.Sequential(
            nn.Linear(fusion_dim, hidden_size),
            nn.GELU(),
            nn.Dropout(dropout),
        )

        # Prediction heads (same interface as Hydra models)
        self.residual_head = nn.Linear(hidden_size, 1)
        self.residual_logvar_head = nn.Linear(hidden_size, 1)
        self.corrected_logvar_head = nn.Linear(hidden_size, 1)
        self.residual_bias = nn.Parameter(torch.tensor([0.0], dtype=torch.float32))

        if self.quantiles:
            self.quantile_head = nn.Linear(hidden_size, len(self.quantiles))
        else:
            self.quantile_head = None

    def _stabilize_logvar(self, raw: torch.Tensor) -> torch.Tensor:
        return torch.clamp(
            torch.log(torch.nn.functional.softplus(raw) + 1e-4),
            self.logvar_min,
            self.logvar_max,
        )

    def forward(
        self, x_seq: torch.Tensor, static_feats: Optional[torch.Tensor] = None
    ) -> dict:
        seq = self.input_norm(x_seq)
        out, _ = self.gru(seq)

        last = self.dropout(out[:, -1, :])
        mean_pool = out.mean(dim=1)

        pieces = [last, mean_pool]
        if self.static_proj is not None and static_feats is not None:
            pieces.append(self.static_proj(static_feats))

        fused = self.fusion(torch.cat(pieces, dim=-1))

        residual_mean = self.residual_head(fused).squeeze(-1) + self.residual_bias
        residual_logvar = self._stabilize_logvar(
            self.residual_logvar_head(fused).squeeze(-1)
        )
        corrected_logvar = self._stabilize_logvar(
            self.corrected_logvar_head(fused).squeeze(-1)
        )

        outputs = {
            "residual_mean": residual_mean,
            "residual_logvar": residual_logvar,
            "corrected_logvar": corrected_logvar,
        }

        if self.quantile_head is not None and self.quantiles:
            outputs["quantiles"] = self.quantile_head(fused)

        return outputs
