# Original HYDRA USGS UTC conversion repair

This milestone repairs the observation clock contract for the original Eastern
HYDRA/NWM study. Scientific performance remains unverified. Historical July inputs,
saved numerical results and posters are not replaced or rehabilitated by this code.
Original HYDRA research is distinct from reforecast software and current NextGen
neural correction.

## Clock and integrity contract

- Resolve each original provider datetime using its explicit EST/EDT timezone code
  or a validated offset-aware timestamp. No offset is chosen from model fit.
- Validate EST/EDT against America/New_York for registered sites 03161000, 03164000
  and 03479000. Missing, unknown, impossible or seasonally inconsistent metadata
  fails. Other sites need an explicit reviewed timezone registration.
- Preserve leading-zero site IDs, raw datetime/code, discharge in cfs, provider
  value tokens and qualifiers, series identity, response line and checksum.
- Convert before deduplication. Both fall-back hours remain distinct UTC instants.
  Collapse only identical same-site/UTC value, qualifier, series and source records;
  reject conflicts. Preserve every raw record in archived response bytes.
- Retain nonnumeric source tokens; exclude missing/nonfinite discharge from point
  and interval outputs. Do not impute and do not substitute repeated daily means.
- Write a new version directory; refuse existing output directories and CSV
  overwrites. Refuse dataless RDB, receipt, observation and manifest inputs.
- Archive the same immutable response bytes used for conversion and retain the
  converter/clock-module snapshot and SHA-256 identities.

## Explicit sampling semantics

The offline converter requires one of three choices:

| Mode | Timestamp meaning |
| --- | --- |
| exact | Provider instantaneous observation exactly at the UTC hour |
| mean_start | Available numeric samples in [t, t + 1 hour), labeled at t |
| mean_end | Available numeric samples in (t - 1 hour, t], labeled at t |

Interval means include sample counts and first/last sample instants. An interval
mean is not an instantaneous observation and may be incomplete. No minimum cadence
or coverage is certified by this milestone. Scientific use needs an explicit
target, missingness, qualifier, coverage and availability protocol.

The corrected dataset-loader path currently accepts only `exact` IV observations
for joins at NWM valid time. This is a declared candidate point-target contract,
not approval of a new scientific experiment. It checks the version manifest,
CSV hash, row count, UTC/hour/site/source identity, units and sample interval before
converting validated UTC to the builder's internal naive-UTC representation.
Legacy CSVs lacking timezone metadata are rejected rather than inferred to be UTC.

## Bounded offline conversion

Preserve original NWIS instantaneous-value RDB responses, including `datetime`,
`tz_cd` and qualifiers, together with retrieval URL/date/checksum receipts. Then:

```sh
python scripts/convert_usgs_utc.py --rdb sample.rdb \
  --out-dir data/corrected/usgs/new-version --aggregation exact \
  --provider-receipt retrieval_receipt.json
```

The command performs no network acquisition. Output includes the original response
bytes, code snapshot, full instantaneous UTC table, site hourly CSVs and
`manifest.json`. A failed partial output without a complete manifest is unusable;
choose a new output directory on retry rather than overwriting the partial version.
The legacy bulk/export `data_acquisition_scripts/usgs.py` entry point is disabled.
Its imported fetch adapter uses this clock converter and requires aggregation to
be selected explicitly, preserving response text/URL in DataFrame attributes.

Future dataset builds require `--usgs-corrected-dir` and `--usgs-aggregation exact`
and a new output directory. Their `clock_provenance.json` binds the corrected USGS
manifest, builder and output hashes and states that NWM/ERA5 lineage and scientific
performance are not certified. Existing NWM/ERA5 ingestion remains outside this
repair's certification; do not run a full historical build until source timing and
product-specific interval semantics have been verified separately.

## Verification and remaining gates

```sh
python -m unittest discover -s tests -p 'test_usgs*.py' -v
```

The deterministic and integration suite covers winter/summer offsets, repeated
fall hours, spring gaps, mixed codes, aware timestamps and UTC round trips,
duplicate conflicts, RDB schema rows/multiple blocks, missing values through pandas,
point/interval boundaries, cfs-to-cms conversion, source-byte preservation,
placeholder guards, immutable exports, downstream hash checks and a synthetic
UTC-valid-time join/target calculation. These checks do not establish historical
provider lineage or hydrological model skill.

A full rebuild still needs preserved original acquisition metadata and a documented
raw-to-hourly-to-input trace, NWM provider valid-time evidence, forcing product and
accumulation interval metadata, and a frozen evaluation protocol. Collapsed repeated
fall records cannot be recovered by shifting legacy hourly observations. Preserve
old artifacts as historical provenance, retain quarantine of scientific performance
claims, and independently review new inputs before authorizing evaluation/training.
