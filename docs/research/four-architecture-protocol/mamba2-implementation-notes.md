# Genuine Mamba-2 hybrid: implementation requirements

**Source inspection and proposed qualification only; no runtime compatibility claim.**

The requested hybrid combines an actual Mamba-2 mixer with a Transformer block. A generic
state-space recurrence or Mamba-1 replacement would change the requested architecture.

Upstream source:

https://github.com/state-spaces/mamba/blob/main/mamba_ssm/modules/mamba2.py

The optimized module imports Triton SSD kernels. Disabling its fused path is not itself
proof of non-CUDA execution. A candidate versioned ordinary-Torch implementation is:

https://github.com/huggingface/transformers/blob/v4.55.4/src/transformers/models/mamba2/modeling_mamba2.py

That source exposes `Mamba2Mixer.torch_forward` and conditional CUDA-extension imports.
Its existence does not prove a particular CPU/Apple backend, full backward path, dependency
combination or useful throughput. Version 4.55.4 is an inspectable candidate, not a claim
that it is the latest or a validated dependency pin.

For a continuous-input adaptation, preserve correct parameter initialization, head/group
geometry, selective time-step/B/C projections, scalar-per-head transition, causal convolution,
skip D, gate/normalization ordering, input/output projections and explicit state reset.
Do not download language-model weights or accidentally inherit vocabulary-sized components.

The upstream minimal SSD reference is available at:

https://github.com/state-spaces/mamba/blob/main/mamba_ssm/modules/ssd_minimal.py

It is a mathematical reference, not the complete mixer. Its enclosing module also imports
a Triton helper; an adapted reference must document any import removal and retain source
attribution. No third-party code or new repository license is added by these notes.

Qualification should compare independent recurrence and chunked SSD outputs, final states
and gradients. Cover nonmultiple chunk lengths, padding/cropping, state resets at independent
window/site boundaries, finite gradients through all intended parameters, checkpoint
restoration and repeated supported-device execution. Freeze tolerances and precision before
testing. Synchronize accelerator timing; distinguish warmup, validation and checkpoint costs.

If dependency work is authorized, use an isolated environment, compatible pinned official
packages, bounded downloads/footprint and a resolved environment receipt. Do not assume a
CUDA/Triton source build is an Apple solution or silently modify shared environments.
Failure of one implementation can still leave useful diagnostic evidence from others,
while the main shared-backend study remains blocked. No backend speedup or scientific skill
claim follows from the cited source code.
