#!/usr/bin/env python3
"""Quick test: does the Ranger optimizer + torch._dynamo work?"""
import os
os.environ["TORCHDYNAMO_DISABLE"] = "1"

import torch
print(f"torch: {torch.__version__}")

try:
    from pytorch_ranger import Ranger
    m = torch.nn.Linear(10, 5)
    opt = Ranger(m.parameters(), lr=1e-3)
    print("Ranger OK")
except Exception as e:
    print(f"Ranger failed: {e}")
    m = torch.nn.Linear(10, 5)
    opt = torch.optim.AdamW(m.parameters(), lr=1e-3)
    print("AdamW fallback OK")

try:
    import sympy
    print(f"sympy: {sympy.__version__}")
    from sympy.matrices.reductions import _echelon_form
    print("sympy.matrices.reductions OK")
except Exception as e:
    print(f"sympy issue: {e}")

print("DONE")
