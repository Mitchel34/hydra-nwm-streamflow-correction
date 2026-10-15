# Corrected original HYDRA/NWM research milestone

**Data qualification milestone; no corrected trained-model result.** Updated 15 October 2026.

This work concerns the original three-gauge retrospective NWM2.1 research. It is separate from
HYDRA reforecast software and the current NextGen correction study. No result from either is
substituted for an original-NWM result.

The versioned October candidate passed local independent data review on 14 October 2026.
Review reconstructed the retained raw soil values, corrected observation/NWM joins, reused
forcing values, flags, calendar values and strict historical eligibility masks. This is a
local scientific audit, not external peer review or acceptance of model performance.

The corrected candidate contains 289,227 target rows and 248,651 eligible 168-hour histories.
It preserves 15,133 missing observations. A uniform soil-only replacement recovered 2,184
known missing source hours, replaced 27 previously carried values and restored 2,157 T/P
rows from resident sources. These are data construction findings, not predictive skill.

Historical July learned-performance claims remain quarantined because their time/feature
lineage was invalidated by subsequent audit. Corrected data do not rehabilitate those
claims or establish reproduction of July results. No replacement skill values are reported.

## Contents

- `data-contract.md`: information set, time support, splits and remaining provenance limits.
- `data-review-summary.json`: small aggregate data-review findings and evidence hashes.
- `experiment-plan-draft.md`: the requested four-model comparison; implementation and
  resource qualification remain pending.
- `provenance.md`: evidence interpretation and publication exclusions.

This milestone contains documentation and aggregate review summaries only. Private inputs,
provider responses, observations, raw archives, data tables, checkpoints, personal notes and
machine-specific paths are excluded. Existing source files, manuscript and historical
outputs are not changed by this milestone. Publication does not authorize training, paid
resources, external data transfer or a new scientific claim.
