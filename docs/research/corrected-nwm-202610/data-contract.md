# Corrected retrospective candidate data contract

**Reviewed data candidate; research draft. No trained-model performance has been established.**

The three original gauges retain their frozen target endpoint: 2010-01-01T00Z through
2020-12-31T00Z inclusive. Candidate support is 96,409 rows per gauge, 289,227 total. The
full soil calendar has 289,296 rows; 69 later hours are explicitly outside target support.

Observation targets are exact hourly UTC USGS points, with missingness preserved and
quality/raw-pointer provenance retained locally. Original retrospective NWM2.1 is the
frozen NWM source. Soil is instantaneous ERA5-Land layer-1 volumetric water content,
the unweighted float64 mean over retained grids of 64/40/48 cells. Temperature and
precipitation reuse the qualified resident sources with documented row restoration.
There is no observation interpolation or hidden fill in this candidate.

At target hour t, common eligibility requires finite observed/NWM values at t and
168 consecutive finite observed/NWM/T/P/soil rows at t-168 through t-1. Current-time
weather is not required. Eligibility is retained as an explicit mask; rows are not
silently removed from the source table. Aggregate eligible support is 248,651 rows.

Training is 2010-2017, validation 2018 and exploratory testing 2019-2020. Eligible
counts total 175,967 / 22,106 / 50,578 respectively. The test interval was inspected
historically, so repaired evaluation is not untouched confirmation.

## Remaining provenance limits

- The soil campaign has a fixed extraction recipe and retained per-response provenance;
  homogeneous historical provider reprocessing revisions are not certified.
- Legacy T/P nominal UTC and earlier hidden-fill execution are not fully authenticated.
- NWM UTC/point interpretation remains source-supported inference with missing explicit
  point/compiled identity evidence.
- USGS uses an October 2026 collection vintage; this changed target/data contract does
  not reproduce or validate historical July learned performance.
- Reanalysis valid time and an exact point target do not establish operational data
  availability, forecast issue time or latency.

Data acceptance covers represented values, joins, flags and masks. Feature adapters,
normalizers, learned models, selection procedures and new performance claims require
separate qualification and authorized experiments.
