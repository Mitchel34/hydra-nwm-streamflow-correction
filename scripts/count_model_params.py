#!/usr/bin/env python3
"""Count parameters in Hydra v3 model."""

import sys
sys.path.insert(0, "/Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase")

import torch
from modeling.models.hydra_temporal_v3 import HydraTemporalV3


def count_parameters(model: torch.nn.Module) -> tuple[int, int]:
    """Count total and trainable parameters."""
    total = sum(p.numel() for p in model.parameters())
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    return total, trainable


# Default configuration used in experiments
config = {
    "input_dim": 16,  # nwm_cms + 15 ERA5 features
    "static_dim": 0,
    "d_model": 128,
    "num_heads": 4,
    "num_layers": 4,
    "dropout": 0.1,
}

print("Hydra v3 Model Size Analysis")
print("=" * 60)
print(f"Configuration:")
for key, val in config.items():
    print(f"  {key}: {val}")
print()

# Create model
model = HydraTemporalV3(**config)

# Count parameters
total, trainable = count_parameters(model)

print(f"Total parameters:     {total:,}")
print(f"Trainable parameters: {trainable:,}")
print(f"Model size (MB):      {total * 4 / 1024**2:.2f}")  # 4 bytes per float32
print()

# Break down by component
print("Parameter breakdown by component:")
print("-" * 60)
for name, module in model.named_children():
    params = sum(p.numel() for p in module.parameters())
    print(f"  {name:30s}: {params:>10,}")
