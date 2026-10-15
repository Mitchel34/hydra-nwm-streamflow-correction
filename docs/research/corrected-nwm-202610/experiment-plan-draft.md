# Four-architecture experiment plan — draft, not executed

The requested learned panel is **LSTM, Transformer, GRU-Transformer and genuine
Mamba-2-Transformer**. Raw NWM, flow persistence and residual persistence are nonlearned
references. No affine/ridge/MLP training is part of the requested panel.

Every model/site uses the same accepted target keys, 168 strictly prior hourly records,
split dates and training-only normalization. Full versus soil-removed configurations
are retrained on the identical eligibility mask and fixed input geometry. Point residual
targets reconstruct as NWM(t) plus predicted residual. No target-time observations or
weather enter model inputs. Retrospective rolling histories may include strictly earlier
held-out observations, without updating fitted parameters or normalization.

One-seed and three-seed plans contain 24 and 72 fits respectively: four architectures,
three gauges and two feature sets. Seed/tuning/convergence opportunities are matched
across architectures; a one-seed panel cannot establish optimization robustness. The
research scope/resource choice remains pending. No fitting or profiling is represented
as completed by this publication.

## Implementation readiness

Installed Torch provides recurrent and attention building blocks, but the corrected-data
adapter and complete continuous-input model panel are not qualified implementations.
Historical HYDRA v3 includes additional components and is not silently treated as a clean
GRU-Transformer. A genuine Mamba-2 hybrid is neither installed nor runtime-qualified in
the inspected environment.

An official, versioned candidate is Hugging Face's Mamba2 mixer and ordinary Torch path:

https://github.com/huggingface/transformers/blob/v4.55.4/src/transformers/models/mamba2/modeling_mamba2.py

The dependency/implementation route still requires bounded isolated setup, correct mixer
initialization, gradient checks, state reset and continuous-feature integration. A CPU
code path in source does not prove local accelerator support or usable throughput.
Upstream optimized CUDA/Triton Mamba-2 cannot be assumed to run on Apple hardware:

https://github.com/state-spaces/mamba/blob/main/mamba_ssm/modules/mamba2.py

Qualification must compare independent recurrence/SSD outputs, states and gradients,
including padded length 168 and checkpoint restoration. No Mamba-1 or unrelated state-space
substitution is permitted. The full comparison requires all four on one qualified backend.

Bounded partial profiling, if separately authorized, may produce useful per-model import,
operator, gradient, throughput and memory diagnostics even if another model fails. Such
engineering evidence does not admit a mixed-backend or incomplete scientific comparison.
No main fit starts until all source/feature/target, fidelity, backend and budget gates pass.

Future reports must include matched-support RMSE and persistence comparisons, seed and
temporal uncertainty separately, incomplete/convergence flags and negative results.
No causal soil claim, operational forecast claim, or unexposed-test claim is implied.
