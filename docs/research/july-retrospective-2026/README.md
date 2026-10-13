# July 2026 retrospective NWM correction summary

This proposed research snapshot records the saved repaired July summaries for three Appalachian gauges. It describes retrospective target-valid-time National Water Model (NWM) v2.1 correction, with a 168-hour input history through the preceding hour. It does not describe issued 1-18-hour forecasts or NextGen experiments.

The study uses training years 2010-2017, validation 2018 and testing from 1 January 2019 through 31 December 2020 at 00:00 UTC. Three configurations at three sites each have seeds 42, 314 and 2718. The saved run manifest contains 27 records. Recent observations are from the U.S. Geological Survey (USGS). Meteorology and calendar cues enter all three configurations.

The proposed code changes restore the locally resident trainer/data-loader bytes matching the recorded July source hashes, together with the current timestamp-safe persistence/evaluation helpers and nine synthetic contract regression tests. The evaluator withholds block-bootstrap intervals if any source rows lack block sampling support, selects regimes after resampling the full time window, and compares persistence predictors on shared finite support with explicit effective counts. These are current helper repairs, not changes to the historical saved scientific results.

## Files and meaning

- `metrics.csv`: nine configuration/site rows, including seed means and sample standard deviations.
- `input_ablation.csv`: saved differences in RMSE reduction, expressed in percentage points.
- `persistence.csv`: saved exact-hour persistence summaries, with their own retained-pair counts.
- `figures/input_source_attribution.png`: unchanged figure from the repaired July summary. Its error bars show sample SD across three seeds, not confidence intervals.
- `provenance.json`: source-summary SHA-256 hashes and historical source identifiers, with local machine paths removed.
- `scripts/validate_july_retrospective_summary.py`, at the repository root: validates only this saved summary packet. It does not load observations, train models or evaluate predictions.

## Scope of the comparisons

The gauge-informed residual configuration combines recent USGS history with NWM history and reconstructs discharge around target-time retrospective NWM. Gauge direct excludes NWM input and reconstruction and predicts discharge. Gauge-free residual correction omits USGS history.

The gauge-informed means improve on the saved NWM baseline at all three gauges. The comparison with gauge direct jointly changes NWM availability and residual parameterization, so it does not isolate the effect of historical NWM features. The repaired central matrix does not isolate weather or seasonal contributions or establish superiority to simpler learned architectures.

Saved exact-hour flow persistence has much larger RMSE reductions. Its support is slightly smaller than the primary targets, so these tables must not be presented as an identical-support statistical comparison. Three fixed sites do not establish regional transfer, causal source attribution or operational warning benefit.

## Evidence status

The packet checks saved-summary arithmetic and correspondence to embedded historical run metadata. Underlying predictions and observations were not revalidated for this preparation. Seed SD does not represent temporal confidence or prove statistical significance. The older public default branch and development head do not establish that the July code repairs and outcomes have already been published.

This is a proposed documentation, figure and sanitized-summary update for independent review. It is not a complete reproducibility release. All nine contract assertions passed in a bounded partial-module harness using real PyTorch, NumPy and pandas. Bootstrap functions were loaded unchanged from the candidate via AST because an existing compatible SciPy runtime was unavailable; pytest and SciPy-dependent evaluator paths were not run. Exact historical evaluator hash identity is not established by the run manifest. It excludes raw datasets, weights, private papers, advisor comments and correspondence. No scientific experiment was run to prepare it. No license change is proposed.

## Code limitations

The hash-preserved historical trainer still writes rolling-run summaries to its legacy fixed output directory even when --output-dir is supplied. The public base contains a legacy LSTM script importing modeling.train_quick_transformer_torch, a module path absent from that base; that existing script was not repaired or validated here. The restored dataset interface requires real timestamps, so any future LSTM restoration must supply them and align emitted metadata with retained target indices. The public base Hydra v3 model bytes match the saved model SHA-256. This bounded packet does not validate every repository workflow.
