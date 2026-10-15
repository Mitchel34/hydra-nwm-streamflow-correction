# Four-architecture retrospective correction protocol

**Planned protocol; not an executed experiment or performance report.**

This protocol describes a prospective implementation panel for original retrospective
NWM residual correction: **LSTM, Transformer, GRU-Transformer and Mamba-2-Transformer**.
It is distinct from reforecast software and NextGen model correction. It contains no
private research findings, data-review outcomes, source-data hashes or new skill values.

## Common scientific comparison

Before fitting, freeze one source/data version, exact target keys, chronological splits,
eligibility mask, history length, feature list, normalization and residual reconstruction.
Fit normalization on training data only. Exclude target observations and future weather
from predictors. Treat operational availability separately from retrospective valid time.

Give every architecture the same eligible examples, seed and tuning budget, optimization
opportunity, validation selection rule and evaluation mask. Specify architecture graphs,
parameter counts, backend/precision, batch size and resource limits before a run. Parameter
matching does not imply equal compute. Report temporal uncertainty separately from seed
variability and do not describe previously inspected test data as untouched confirmation.

Raw NWM, flow persistence and residual persistence are nonlearned reference baselines.
If a soil-information comparison is included, retrain full and soil-removed configurations
on identical target support with a declared capacity convention. Do not infer causality
from a source-removal comparison, learned gate or attention weight.

The proposed panel does not require affine, ridge or MLP model experiments first. Forward,
backward, leakage, state-reset and checkpoint tests of the requested implementations remain
necessary. Historical HYDRA hybrids and a minimal GRU-Transformer must be separately named;
configuration labels alone do not prove an architectural difference.

## Execution and reporting gates

Implement and qualify continuous-input adapters first. A declared bounded diagnostic stage
may report per-model import/operator failures, gradient checks, synchronized throughput,
memory and recovery behavior. Partial engineering evidence is not a fair completed panel.

Main-study admission requires every requested architecture, including genuine Mamba-2,
to pass the common data/feature/target, fidelity and shared-backend gates within a separately
approved resource budget. Do not silently substitute another architecture, compare different
backends as an isolated architecture effect or extend a failed run's budget automatically.

Keep versioned configs, code/environment identities, experiment registry, last/best model
and optimizer/RNG checkpoints, logs and terminal completed/partial/blocked receipts. Preserve
negative findings and unfinished convergence. Publication of this protocol authorizes no
training, dependency installation, spending, data transfer, CI changes or performance claim.

Implementation sources and caveats are in `mamba2-implementation-notes.md`.
