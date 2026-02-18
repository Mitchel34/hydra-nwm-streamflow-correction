#!/usr/bin/env python3
"""Minimal test to pinpoint where the training script hangs."""
import sys, os, time

os.environ["TORCHDYNAMO_DISABLE"] = "1"

def ts():
    return time.strftime("%H:%M:%S")

print(f"[{ts()}] Start", flush=True)

print(f"[{ts()}] Importing numpy...", flush=True)
import numpy as np
print(f"[{ts()}] numpy OK", flush=True)

print(f"[{ts()}] Importing pandas...", flush=True)
import pandas as pd
print(f"[{ts()}] pandas OK", flush=True)

print(f"[{ts()}] Importing torch...", flush=True)
import torch
print(f"[{ts()}] torch OK: {torch.__version__}", flush=True)

print(f"[{ts()}] Importing torch.nn...", flush=True)
import torch.nn as nn
print(f"[{ts()}] torch.nn OK", flush=True)

print(f"[{ts()}] Importing HydraTemporalV3...", flush=True)
sys.path.insert(0, os.getcwd())
from modeling.models.hydra_temporal_v3 import HydraTemporalV3
print(f"[{ts()}] HydraTemporalV3 OK", flush=True)

print(f"[{ts()}] Creating model...", flush=True)
model = HydraTemporalV3(input_dim=16, d_model=128, num_heads=4, num_layers=4, quantiles=[0.1, 0.5, 0.9], dropout=0.1)
print(f"[{ts()}] Model OK, params={sum(p.numel() for p in model.parameters())}", flush=True)

print(f"[{ts()}] Creating AdamW...", flush=True)
optimizer = torch.optim.AdamW(model.parameters(), lr=5e-4, weight_decay=5e-5)
print(f"[{ts()}] AdamW OK", flush=True)

print(f"[{ts()}] Loading data...", flush=True)
df = pd.read_parquet("data/clean/modeling/hourly_training_2010_2020_03161000.parquet")
print(f"[{ts()}] Data OK: {df.shape}", flush=True)

print(f"[{ts()}] Forward pass...", flush=True)
x = torch.randn(4, 168, 16)
with torch.no_grad():
    out = model(x, None)
print(f"[{ts()}] Forward pass OK, keys={list(out.keys())}", flush=True)

print(f"[{ts()}] ALL TESTS PASSED", flush=True)
