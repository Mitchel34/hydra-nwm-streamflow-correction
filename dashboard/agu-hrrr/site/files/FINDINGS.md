# Findings from the held-out year evaluation (May 2022 to April 2023)

Status: **reviewed.** Independent review 3 read the draft of this document (commit `8534b9e`), recomputed its numbers from the per-cell outputs with its own code and gave "go with fixes". Its report and the author's dispositions are in `docs/reviews/EVALUATION_REVIEW_3_FINDINGS.md`. This version applies them.

Source: `REPORT.md`, `results.json` and `tabulation.json` in this folder, written once by `scripts/analyze_evaluation.py` under `docs/EVALUATION_PLAN_20261114.md` (Amendments 1 and 2) at freeze commit `171a918964f101b5958bac286bcdbaf37a920fa5`. `crosscheck.json` records a second recomputation from the per-cell values, by the same author with separate NumPy code that shares nothing with the analysis: 32,302 numbers and report rows, no disagreement. The independent reviewer recomputed 58,818 values with its own code; the largest difference from `results.json` was 6.2e-14. Section and claim numbers refer to the plan.

Numbers marked **post hoc** were added after the results were seen, at the reviewer's request. They are in `posthoc.json`, written by `scripts/describe_evaluation_posthoc.py`, and are recorded in `docs/EVALUATION_AMENDMENTS_AFTER_OPENING.md`. They change no definition and no verdict.

What this evidence is and is not:

- **Held out, but not untouched.** No fitting, scaling, checkpoint selection, recipe choice or tuning in this campaign read the year, and every model, rule and definition was fixed and committed before it was opened. It was opened once in this campaign, on November 15, 2026. Not everything was blind to it. The same year was scored on November 7, 2026 with an earlier pipeline, and parts of it served as validation and test in older work. The three architectures and the five metrics come from that earlier work, the same-epoch refit rule is the one whose scores on this year the author had seen (Amendment 1), and the author knew that record's summary numbers when the plan was written.
- **One year, three gauges, one region.** The three gauges share storms, and the three network types share data, storms and the dominant week. "3 of 3" is not three independent confirmations.
- **Two NWM versions.** NWM changed from v2.1 to v2.2 on June 28, 2022. All training data are v2.1, and 85% of the scored cells are v2.2. Version and season cannot be separated.
- **Three seeds.** The intervals resample weeks with the fitted models held fixed. The spread between seeds is in no interval.
- **Conditional on complete inputs.** Where the gauge record has gaps no forecast is issued and nothing is scored.
- **Retrospective archive inputs.** Whether the inputs were available at issue time was not established. No real-time claim.
- **Intervals are nominal.** They are pointwise nominal-95% percentile intervals from a paired bootstrap of 7-day blocks. Measured on these blocks they are too narrow (section 8). An interval that excludes zero is not called significant.

## What was run

- **Refit models (the headline):** 243 fits, 3 architectures (LSTM, GRU+Conv, Transformer) × 3 gauges (Jefferson 03161000, Galax 03164000, Sugar Grove 03479000) × 3 seeds × 9 input variants. Each was trained on the whole first year (May 2021 to April 2022) for the number of epochs its existing twin had selected on validation, with no validation and no early stopping. All 243 completed and were verified before the opening.
- **Existing models (the comparison):** the 243 fits of the ablation campaign, trained on May 2021 to January 2022, at their validation-selected checkpoints.
- **Comparators on the same cells:** NWM; persistence of the latest gauge reading; a mean residual per lead; a linear regression on NWM per lead. The two fitted corrections use training data only.
- **Scored cells:** forecast origins from May 8, 2022 to April 29, 2023 with complete inputs and an accepted observation.

| Gauge | Origins in support | Corrected forecast issued | Scored cells | 7-day blocks |
|---|---:|---:|---:|---:|
| Jefferson | 8,574 | 8,107 | 145,737 | 49 |
| Galax | 8,574 | 7,988 | 143,398 | 48 |
| Sugar Grove | 8,574 | 8,185 | 147,141 | 49 |

Forecasts are missing mainly where the gauge record has gaps longer than the two-hour hold: 426 origins at Jefferson and 348 at Sugar Grove, almost all in December 2022 and January 2023, and 545 at Galax, almost all from December 2022 to February 2023. At every gauge 24 origins lack a complete NWM forecast (June 2022) and 17 lack HRRR fields (April 2023). November 2022 is complete at all three gauges. The gaps fall in the same weeks at all three gauges (post hoc): from December 23 or 24 to January 7, 8 or 10, and at Galax also February 14 to 23. What a user would get in those weeks is not scored.

## 1. Against NWM: lower squared error at two gauges; at the third no gain, and one network type is worse by absolute error

Skill ratio = pooled squared error of the corrected forecast ÷ NWM's on the same cells; below 1 is better than NWM. Mean of three seeds, each seed in brackets.

**Refit models**

| Gauge | LSTM | GRU+Conv | Transformer |
|---|---|---|---|
| Jefferson | 0.588 (0.603, 0.595, 0.567) | 0.581 (0.559, 0.590, 0.594) | 0.544 (0.514, 0.516, 0.601) |
| Galax | 0.643 (0.574, 0.749, 0.604) | 0.569 (0.578, 0.515, 0.615) | 0.513 (0.563, 0.531, 0.445) |
| Sugar Grove | 0.990 (0.989, 0.988, 0.994) | 0.994 (0.995, 0.992, 0.995) | 1.003 (1.013, 0.998, 0.998) |

Change in pooled squared error against NWM, with the 7-day interval:

| Gauge | LSTM | GRU+Conv | Transformer |
|---|---|---|---|
| Jefferson | −41.2% [−67.8%, −29.7%] | −41.9% [−65.9%, −32.3%] | −45.6% [−68.9%, −29.5%] |
| Galax | −35.7% [−53.6%, −29.9%] | −43.1% [−57.7%, −35.9%] | −48.7% [−60.8%, −41.9%] |
| Sugar Grove | −1.0% [−6.3%, +0.4%] | −0.6% [−2.2%, −0.2%] | +0.3% [−0.5%, +5.3%] |

- **Jefferson (C1: held up in 3 of 3, weaker than validation).** Squared error is 41–46% below NWM's. The intervals exclude zero at 7-, 3-, 14- and 28-day blocks. With any single 7-day block left out the reduction stays between 35% and 58%. The validation analysis gave 66–73%; all three held-out intervals lie on the zero side of the validation estimates.
- **Galax (C2: held up in 3 of 3).** Squared error is 36–49% below NWM's, at all four block lengths; 34–55% with any one block left out. The validation estimates (36–42%) lie inside the held-out intervals. The seeds spread widely: the LSTM's three ratios run from 0.574 to 0.749 and the Transformer's from 0.445 to 0.563.
- **Sugar Grove (C3: consistent with no effect in 3 of 3).** In squared error the networks are within about 1% of NWM. Every interval lies within ±10%, the plan's margin for "no effect", which is wide. GRU+Conv's interval excludes zero, at −0.6%. By mean absolute error the refit Transformer is worse than NWM at every lead: 0.73 against 0.32 m³/s at 1 h and 1.68 against 1.46 at 18 h, with every interval above zero and in each of the three seeds. Its RMSE is higher than NWM's at leads 1 to 13. Over the five metrics and 18 leads it is better than NWM in 15 of its 90 Sugar Grove cells; the LSTM is in 77 and GRU+Conv in 89. Those two stay within 4% of NWM's mean absolute error at every lead.
- **In RMSE terms** (mean over seeds of the square root of each seed's ratio): 23–26% below NWM at Jefferson, 20–28% at Galax, within 0.5% at Sugar Grove.
- **At single leads, by mean absolute error.** At Jefferson the LSTM and GRU+Conv have lower mean absolute error than NWM at all 18 leads, with every interval below zero (12–16% lower at 1 h, 30–38% at 18 h). The Transformer is 22% higher at 1 h (interval includes zero) and 32% lower at 18 h. At Galax all three networks have higher mean absolute error than NWM at 1 h (+35%, +21% and +28%, every interval above zero; the LSTM and Transformer also at 2 h) and are 22–29% lower at 18 h. The Transformer's RMSE at 1 h is above NWM's at all three gauges: +13% at Jefferson and +2% at Galax (intervals include zero) and +3% at Sugar Grove (interval above zero).
- **One week carries much of this.** The 7-day block that starts on November 8, 2022 holds 55% of NWM's squared error at Jefferson, 45% at Galax and 67% at Sugar Grove. The effective number of blocks is 3.0, 3.7 and 2.1 out of 49, 48 and 49. In that block the networks' share of their own squared error is higher than NWM's at Jefferson (64–68% against 55%) and Galax (49–53% against 45%), so their advantage there is smaller than elsewhere. The largest observed flow of the year at each gauge falls in that week (post hoc). About 36% of bootstrap replicates do not contain it, so the intervals of the pooled figures mostly reflect how often it is drawn.

**Existing models** on the same cells: Jefferson −37.9%, −42.6%, −44.9%; Galax −35.3%, −36.8%, −43.8%; Sugar Grove −1.1%, −0.2%, +0.2%. The verdicts on C1 to C3 are the same as for the refit models.

## 2. Against simple corrections: it depends on the gauge and the lead

The simple corrections' own skill ratios against NWM (coefficients fitted on the first year; fitted on May 2021 to January 2022 in brackets):

| Gauge | Mean residual per lead | Linear regression on NWM | Persistence |
|---|---|---|---|
| Jefferson | 0.869 (0.866) | 0.673 (0.707) | 1.007 |
| Galax | 0.963 (0.962) | 0.956 (1.014) | 0.715 |
| Sugar Grove | 0.996 (0.998) | 1.024 (1.025) | 1.828 |

Refit networks against each correction (change in pooled squared error, 7-day interval; negative means the network is better):

| Gauge | Network | Against persistence | Against mean residual | Against linear regression |
|---|---|---|---|---|
| Jefferson | LSTM | −41.6% [−55.7%, −34.2%] | −32.2% [−58.8%, −22.4%] | −12.5% [−61.0%, +12.4%] |
| Jefferson | GRU+Conv | −42.3% [−52.7%, −36.7%] | −33.1% [−56.3%, −25.3%] | −13.6% [−60.4%, +9.3%] |
| Jefferson | Transformer | −46.0% [−59.4%, −19.6%] | −37.4% [−60.5%, −15.8%] | −19.2% [−58.2%, +0.8%] |
| Galax | LSTM | −10.2% [−29.0%, −1.4%] | −33.3% [−51.3%, −26.8%] | −32.8% [−53.9%, −23.4%] |
| Galax | GRU+Conv | −20.4% [−32.7%, −13.2%] | −40.9% [−55.7%, −34.5%] | −40.5% [−58.1%, −35.4%] |
| Galax | Transformer | −28.3% [−38.0%, −20.1%] | −46.7% [−58.6%, −40.9%] | −46.3% [−59.3%, −42.1%] |
| Sugar Grove | LSTM | −45.8% [−51.6%, −10.1%] | −0.6% [−5.3%, +0.5%] | −3.3% [−8.1%, −1.0%] |
| Sugar Grove | GRU+Conv | −45.6% [−51.4%, −6.4%] | −0.2% [−1.4%, −0.0%] | −2.9% [−5.4%, +2.5%] |
| Sugar Grove | Transformer | −45.1% [−50.6%, −2.7%] | +0.7% [−0.1%, +5.7%] | −2.0% [−2.9%, +8.0%] |

- **Jefferson.** The networks have 42–46% lower squared error than persistence, pooled over the 18 leads (C5: held up in 3 of 3), and 32–37% lower than the mean residual. Against a linear regression on NWM they are 13–19% lower, and every interval includes zero: on this year the networks are not distinguishable from that regression at Jefferson. The plan gives no verdict on this comparison; it is in the table of section 6.3. The existing models show the same (−12% to −22%, every interval includes zero).
- **Jefferson, the November week (post hoc).** This is a descriptive split made after the results were seen. In the week from November 8, which holds 45% of the regression's squared error, the regression is better than every network: the three-seed means are 32%, 27% and 15% above it, and all nine refit fits are worse (5% to 34%). All nine existing fits are worse than their regression too (16% to 53%). Outside that week the networks are 47–49% below the regression. Against NWM, the regression is 45% lower in that week and 18% lower outside it; the networks are 27–37% lower in that week and 57–58% lower outside it. With single blocks left out, the networks' change against the regression ranges from −49% to −7%.
- **Galax (C6: did not hold up; the three-seed means are better in pooled squared error).** Validation found the networks not better than persistence. In the held-out year all three refit networks have lower pooled squared error than persistence (10%, 20% and 28% lower; every 7-day interval below zero). For the LSTM the 3-day interval includes zero ([−29.9%, +32.6%]) and one of its three seeds is worse than persistence (−19.8%, +4.8%, −15.5%). Among the existing models the LSTM is not distinguishable from persistence (−9.6% [−21.1%, +0.7%]) and the other two are better at 7-day blocks; at 3-day blocks all three intervals include zero. Persistence keeps lower mean absolute error than every network through 7 h (through 16 h against the LSTM) and higher KGE at all 18 leads (0.68 at 18 h against 0.56, 0.62 and 0.62). The networks are 33–47% below the two NWM-based corrections.
- **Sugar Grove.** The networks are within a few percent of the two NWM-based corrections and 45–46% below persistence, which has 1.8 times NWM's squared error there.
- **The first hours belong to persistence (C4: held up in 9 of 9).** At 1 h every network has higher RMSE than persistence at every gauge: by 0.32 to 1.05 m³/s at Jefferson, 2.32 to 2.89 at Galax and 0.78 to 0.86 at Sugar Grove. Persistence has lower RMSE than every network through 4 h at Jefferson, 3 h at Galax and 4 h at Sugar Grove; lower mean absolute error through 8 h, 7 h and 10 h; and higher KGE through 12 h, 18 h and 10 h. Against single network types it stays ahead longer: at Jefferson through 6 h by RMSE, 11 h by mean absolute error and 16 h by KGE.
- **Counts** (270 gauge × lead × metric cells; dependent, descriptive): the refit networks are better than NWM in 249 (LSTM), 265 (GRU+Conv) and 184 (Transformer) cells, and better than every simple correction in 141, 152 and 110. Existing models: 228, 255, 181 and 126, 126, 103.

Persistence repeats the latest archived gauge reading at or before the origin, never older than two hours, on exactly the cells the networks are scored on.

## 3. Input removal

Change in pooled squared error when an input is removed, against the full-input fit of the same seed (refit models; mean of three seeds; 7-day interval; positive means removal hurt).

| Gauge | Input removed | LSTM | GRU+Conv | Transformer |
|---|---|---|---|---|
| Jefferson | Soil moisture | +16.2% [+0.4%, +50.2%] | +21.1% [+7.3%, +36.9%] | +30.5% [+11.0%, +59.6%] |
| Jefferson | All HRRR inputs | +12.6% [−0.0%, +47.0%] | +19.1% [−3.7%, +31.4%] | +29.2% [+9.4%, +50.4%] |
| Galax | Soil moisture | +25.1% [+17.4%, +53.0%] | +22.1% [+14.9%, +37.9%] | +61.5% [+45.1%, +120.3%] |
| Galax | All HRRR inputs | +33.6% [+24.3%, +73.8%] | +27.9% [+20.1%, +43.1%] | +68.2% [+46.6%, +125.9%] |

- **Soil moisture (C7: held up in 6 of 6).** Removing it raises squared error by 16–30% at Jefferson and 22–61% at Galax. The Jefferson LSTM's interval starts at +0.4%. The existing models give 16–27% and 19–46%, also 6 of 6.
- **All HRRR inputs (C8: held up in 4 of 6).** Removing all of them raises squared error by 13–29% at Jefferson and 28–68% at Galax. At Jefferson the 7-day intervals of the LSTM and GRU+Conv include zero; their 3-, 14- and 28-day intervals exclude it. The existing models give 6 of 6. Side by side, removing all HRRR inputs costs about as much as removing soil moisture alone (Jefferson 13/19/29% against 16/21/30%; Galax 34/28/68% against 25/22/61%). The plan gives no verdict on that equality.
- **By NWM version and quarter** (the breakdowns fixed in advance for these two inputs). At Jefferson the soil-moisture effect is +57% to +98% in the seven weeks before the switch to v2.2 (about two effective blocks; point estimates only). After the switch (85% of scored cells) it is +11.5% [−6.4%, +30.0%] for the LSTM, +18.0% [−1.3%, +23.0%] for GRU+Conv and +25.9% [+3.6%, +42.5%] for the Transformer. The all-HRRR effect after the switch is +8.6% [−5.1%, +32.1%], +16.4% [−10.9%, +19.8%] and +25.8% [+1.8%, +39.6%]. From November to January every soil-moisture and all-HRRR interval at Jefferson includes zero. At Galax the effects after the switch are +19% to +59% (soil moisture) and +24% to +63% (all HRRR), with every interval above zero.
- **Single weather fields (C9, a descriptive tally without a verdict).** Of the 36 entries for precipitation, temperature, humidity and snow, 8 intervals exclude zero and 8 have the same sign in all three seeds. Chance alone would give 9 with the same sign. For exclusions, resampling weeks alone would give 3.7; that figure leaves out the difference between two training runs, which produced 9 exclusions among 48 no-effect entries in validation. The largest three-seed mean is 7.2%; single seeds range from −23% to +27%. The author reads this as no consistent effect.
- **Sugar Grove (C10, a descriptive tally without a verdict).** Of the 24 removal entries the largest three-seed mean is 4.8%, and 4 intervals exclude zero. The signs agree across the three seeds in 17 entries, against 6 expected by chance. The author reads some of these very small effects as systematic and none as large.
- **Gauge history and NWM as an input** show no pattern that holds across networks. For example, removing gauge history changes the Jefferson LSTM by −11.4% [−15.9%, +9.9%] and the Galax LSTM by +24.0% [+4.6%, +54.8%]. The plan makes no claim about them.

Removal effects measure the predictive value of an input to these models on these cases, at fixed capacity. They are not causal importance. Three limits go with them. The removed-input fits use a recipe that was tuned for the full-input fits, which can make removal look more harmful than it is. The variant without NWM as an input still uses NWM as the anchor of the residual. And two of the twelve cells behind C7 and C8 rest on a refit whose twin ended at the epoch cap, not at a validation minimum (Galax GRU+Conv: soil moisture, seed 1729; all HRRR inputs, seed 1730).

## 4. Did refitting on the whole first year help?

Each refit against its existing twin on the same cells (change in pooled squared error; negative means the refit is better). Full-input fits:

| Gauge | LSTM | GRU+Conv | Transformer |
|---|---|---|---|
| Jefferson | −5.2% [−17.9%, −0.6%] | +1.5% [−14.8%, +7.8%] | −1.4% [−14.7%, +25.7%] |
| Galax | −0.6% [−19.7%, +19.0%] | −10.0% [−12.8%, −6.4%] | −7.4% [−11.4%, −0.5%] |
| Sugar Grove | +0.2% [−4.2%, +1.2%] | −0.4% [−1.5%, −0.1%] | +0.1% [−0.5%, +5.4%] |

In pooled squared error, over all 81 architecture, gauge and variant cells, 27 intervals lie below zero (the refit is better), none lies above, and 54 include zero. Of the 27, 13 are at Sugar Grove (changes of at most 1.2%), 9 are the Galax GRU+Conv (8% to 11%), 4 the Jefferson LSTM and 1 the Galax Transformer. For the full-input fits, four of the nine intervals lie below zero: −5% (Jefferson LSTM), −10% and −7% (Galax GRU+Conv and Transformer) and −0.4% (Sugar Grove GRU+Conv).

By mean absolute error the picture differs. At 1 h the refit is worse than its twin, with the interval above zero, in 26 of 27 Galax cells, 11 of 27 Jefferson cells and 8 of 27 Sugar Grove cells. The refit Transformer at Sugar Grove is worse than its twin at all 18 leads (+0.35 m³/s at 1 h, +0.20 at 18 h), and so are seven of its eight removed-input variants. So refitting did not measurably raise pooled squared error anywhere, and it did raise absolute error at short leads.

The refit differs from its twin in more than the amount of data. Its length is a convention: each refit ran for its twin's validation-selected number of epochs on a longer training period, with no check of its own. Its loss scale is fitted on the first year and is 18.2% larger than the twin's at Galax (1.2% larger at Jefferson, 1.6% smaller at Sugar Grove), and 10 of the 14 cells outside Sugar Grove in which the refit is better are at Galax.

## 5. At Jefferson the held-out gain was smaller than in the validation window

The existing full-input fits, skill ratio against NWM in the validation window (February to April 2022) and in the held-out year. These are different cells.

| Gauge | Validation window, range over nine fits | Held-out year, range over the same fits |
|---|---|---|
| Jefferson | 0.247 to 0.348 | 0.525 to 0.624 |
| Galax | 0.477 to 0.724 | 0.427 to 0.754 |
| Sugar Grove | 0.954 to 1.005 | 0.965 to 1.005 |

At Jefferson every one of the nine fits has a ratio 1.6 to 2.3 times as high in the held-out year. At Galax and Sugar Grove the two periods agree. The pair is descriptive: season, NWM version, the November event and checkpoint selection (the validation window also chose the checkpoints) cannot be separated. In the seven weeks before the NWM switch the same fits were 63–75% below NWM at Jefferson, close to their validation figures, and after it 32–39%; the first figure rests on 1.4 effective blocks.

## 6. Where the gain is larger and smaller (breakdowns fixed in advance)

Refit full-input fits against NWM. These splits are descriptive. Intervals are shown only for strata with at least ten 7-day blocks. The same splits for the soil-moisture and all-HRRR effects are in section 3.

- **NWM version.** Before the switch to v2.2 on June 28, 2022 (15% of scored cells, seven blocks, point estimates only; 1.4 effective blocks at Jefferson and 1.3 at Galax): Jefferson −71% to −78%, Galax −27% to −51%. After it: Jefferson −35% to −39%, Galax −39% to −48%, every interval below zero. All training data are v2.1. Version and season cannot be separated here.
- **Quarter, Jefferson.** May to July −70% to −75%; August to October −39% to −45%; November to January −27% to −32%, with every interval including zero (one block holds nearly all of that quarter's squared error: 1.1 effective blocks); February to April −54% to −66%.
- **Quarter, Galax.** −27% to −51%, −55% to −57%, −30% to −40% and −56% to −67%; every interval below zero.
- **Flow level by the NWM forecast, Jefferson.** −66% to −71% at or below the fit-period median; −63% to −66% from the median to the 90th percentile; −51% to −57% from the 90th to the 95th; −36% to −42% above the 95th (the last two are point estimates). The relative gain shrinks as the forecast flow rises.
- **Flow level by the NWM forecast, Galax.** −39% to −48%, −36% to −43%, −38% to −46% and −32% to −53% (point estimates above the 95th percentile).
- **Flow level by the observed value.** This split conditions on the outcome and is not a measure of skill. It shows one thing worth knowing: on cells where the observed flow is at or below the fit-period median, the refit Transformer has higher squared error than NWM at Galax (+31.8% [+5.8%, +88.5%]) and at Sugar Grove (+143.4% [+65.0%, +355.3%]). At Sugar Grove it is also higher from the median to the 90th percentile (+46.6% [+18.8%, +86.9%]); the two strata hold 77% of the scored cells there. At Galax the three networks are −5%, +6% and +32% against NWM at or below the median. Together with the Transformer's absolute error at Sugar Grove (section 1), this suggests the correction can make ordinary low-flow forecasts worse. The split conditions on the outcome; the absolute-error result does not.
- **Sugar Grove.** No stratum by version, quarter or forecast flow shows a point estimate beyond 9% for any network. The Transformer's intervals are wide on the unfavourable side: their upper ends reach +27% to +41% in every quarter and +57% and +71% in the two lower forecast-flow strata.

## 7. Verdicts on the ten statements

Refit models; existing models in brackets where they differ.

| # | Statement from validation | Held-out verdict |
|---|---|---|
| C1 | Jefferson: every architecture below NWM | Held up in 3 of 3. Weaker than validation: 41–46% lower against 66–73%. |
| C2 | Galax: every architecture below NWM | Held up in 3 of 3: 36–49% lower. Validation estimates inside the intervals. |
| C3 | Sugar Grove: nothing gained | Consistent with no effect in 3 of 3. |
| C4 | Persistence beats every network at the first lead, by RMSE | Held up in 9 of 9. |
| C5 | Jefferson: networks below persistence | Held up in 3 of 3: 42–46% lower. |
| C6 | Galax: networks not better than persistence | Did not hold up in 3 of 3: the three-seed means are 10–28% better in pooled squared error. (Existing models: held up for the LSTM, did not hold up for the other two.) |
| C7 | Removing soil moisture raises error at Jefferson and Galax | Held up in 6 of 6. |
| C8 | Removing all HRRR inputs raises error at Jefferson and Galax | Held up in 4 of 6; same direction and not distinguishable from zero in 2 (Jefferson LSTM and GRU+Conv). (Existing models: 6 of 6.) |
| C9 | Single weather fields: no consistent effect | Descriptive, no verdict: 8 of 36 intervals exclude zero; largest three-seed mean 7.2%. |
| C10 | Sugar Grove: no input removal matters | Descriptive, no verdict: largest three-seed mean 4.8%. |

A verdict counts cells. The three network types share data, storms and the dominant week, so "3 of 3" is not three independent confirmations.

The direction of C1 to C3 was foreseeable from the November 7 record, which used the same three architectures, the same refit rule and seed 1729. That record reported the Transformer's RMSE at 18 h as 19.9% below NWM at Jefferson and 27.7% at Galax. Here the refit Transformer's three-seed mean RMSE at 18 h is 21.6% and 27.5% below NWM. The same record reported the Transformer's mean absolute error at Sugar Grove as worse than NWM at all leads: 0.661 against 0.322 m³/s at 1 h and 1.624 against 1.461 at 18 h. Here it is 0.734 and 1.679, against the same NWM values. The unfavourable result recurred along with the favourable ones. This evaluation is closer to a replication with three seeds than to a first prediction.

## 8. How far the intervals can be trusted

Measured on these blocks with pairs of network forecasts (18 pairs, 400 trials each, blocks resampled independently, which is the favourable case):

| Block length | Interval excludes zero when the true effect is zero | Interval contains the population value |
|---|---|---|
| 7 days | 10% (6–13% over pairs) | 85% (64–93%) |
| 3 days | 9% (5–12%) | 86% (66–95%) |
| 14 days | 10% (8–14%) | 82% (65–92%) |
| 28 days | 11% (8–16%) | 82% (64–91%) |

A nominal-95% interval here behaves at best like an 85% interval, because the measurement is the favourable case. Coverage is 78% at Sugar Grove and 64% for the worst pair (7 days). These pairs are not the comparisons the verdicts use. The verdicts are not adjusted for their number, about 36 per model set.

## 9. Checks

- The refit stage: 243 of 243 completed and verified against the frozen job list, each twin and the first-year scaler; the three refits run before launch were reproduced exactly.
- Before the opening: the batch builder, scorer and simple corrections reproduced the campaign's validation batches, all 243 stored validation predictions and the frozen baseline code; a complete rehearsal ran on the validation role.
- At the opening: no stop rule fired; input-eligible origins equal the manifest's counts; each testing file was streamed once.
- After scoring: every model and comparator at a gauge shares identical cells, labels and NWM values; per-lead metrics agree with the scorer's to 2.4e-14; the author's second recomputation agrees on 32,302 numbers and report rows.
- By the independent reviewer: 58,818 values of `results.json` recomputed from the per-cell outputs (largest difference 6.2e-14), 12,834 intervals rebuilt from the documented draws, every verdict re-derived by rule (444 items, no difference), and the record of the procedure checked against the opening record, the reads log and the exposure log.
- Negative forecasts (post hoc): the refit Sugar Grove LSTM of seed 1729 issues 42 negative discharge forecasts on scored cells (lowest −0.41 m³/s; the lowest scored observation is 0.82). No other full-input fit of either set has any, and no comparator has. The November 7 record had 35 for the same network type and seed.

## 10. What a critical reader will ask

- **Is this a prediction or a replication?** A replication. November 7 used the same architectures, the same refit rule and seed 1729, and its numbers recur here, the unfavourable one included (section 7).
- **Is it one event?** Largely. The week from November 8 holds 45% to 67% of NWM's squared error and the largest observed flow of the year at all three gauges. Mean absolute error rests less on that week, which holds 14% to 23% of NWM's absolute error (post hoc). It shows a gain at Jefferson at every lead for two network types, a loss at Galax at 1 h with a gain at the later leads, and a loss at Sugar Grove for the Transformer (section 1).
- **Why networks?** At Jefferson a regression with two coefficients per lead is not distinguishable from them and is better in the flood week. Persistence is better in the first hours, and by KGE for most or all of the horizon (section 2).
- **Was the headline set checked?** No refit had a validation of its own. One member got worse without any check noticing (the Sugar Grove Transformer, sections 1 and 4), and the length rule had already been seen on this year.
- **How much do seeds matter?** The three seeds of the Galax LSTM run from 0.574 to 0.749 and those of the Jefferson Transformer from 0.514 to 0.601. That spread is as large as the differences between network types, and it is in no interval.
- **What happens when the gauge record has gaps?** No forecast is issued, in the same weeks at all three gauges ("What was run"). Those weeks are not scored.
- **How firm is C6 for the LSTM?** Its interval ends at −1.4%, from intervals that cover about 85% at best.

## What the poster can and cannot say

**Can say**

1. On a held-out year (May 2022 to April 2023), opened once in this campaign after every model and rule was fixed, the corrected forecasts had 41–46% lower squared error than NWM at Jefferson and 36–49% lower at Galax. In RMSE terms that is about 23–26% and 20–28%. An earlier pipeline had scored the same year, so this is not an untouched test. At Sugar Grove squared error stayed within 1% of NWM, and by mean absolute error one network type was worse than NWM at every lead.
2. These figures are three-seed means for three network types refit on the whole first year. The models scored were fixed before the year was opened.
3. The Jefferson gain is smaller than in the validation window (66–73% there). The Galax gain is in line with validation.
4. One week in November 2022 holds 45% to 67% of NWM's squared error at the three gauges. With any single week left out the reductions stay at 35–58% (Jefferson) and 34–55% (Galax).
5. Persistence of the latest gauge reading is better than every network for the first 3 to 4 hours by RMSE at every gauge, through 7 to 10 hours by mean absolute error, and through 10 to 18 hours by KGE (all 18 at Galax).
6. At Jefferson the networks have 42–46% lower squared error than persistence pooled over the 18 leads; persistence is better through 4 h by RMSE, 8 h by mean absolute error and 12 h by KGE. The networks are not distinguishable from a per-lead linear regression on NWM, and in the November week that regression is better than every network.
7. At Galax the three-seed means have lower pooled squared error than all three simple corrections (10–28% below persistence; for the LSTM the 3-day interval includes zero and one of three seeds is worse). Persistence keeps lower mean absolute error through 7 h and higher KGE at all 18 leads. On validation the networks had not beaten persistence.
8. Removing soil moisture raised squared error at Jefferson and Galax for every network (16–61%; held up in 6 of 6 cells). Removing all HRRR inputs raised it by similar amounts and held up in 4 of 6 cells; there is no verdict on whether the two are equal. Among single weather fields 8 of 36 intervals exclude zero and the largest three-seed mean is 7.2%. At Sugar Grove the largest three-seed mean is 4.8%.
9. In pooled squared error no refit was measurably worse than its twin, and 27 of 81 were better, 13 of them at Sugar Grove by at most 1.2%. By mean absolute error at 1 h the refit was worse than its twin in most Galax cells, and the refit Transformer at Sugar Grove was worse at every lead.
10. The intervals are nominal; measured in the favourable case they cover at best about 85% where 95% is claimed (78% at Sugar Grove).

**Cannot say**

- "Untouched", "independent" or "blind" test. The year was scored before with an earlier pipeline, and the direction at each gauge was known.
- "Significant", or any p-value.
- Any ranking of the three network types.
- That the networks beat a simple linear correction of NWM at Jefferson.
- That the correction helps at Sugar Grove, or helps in general: it helped at two of three gauges.
- That the correction is harmless where it gives no gain. At Sugar Grove one network type was worse than NWM by absolute error at every lead.
- That the networks beat persistence other than in pooled squared error, or that they beat NWM in the first hour.
- That refitting on more data helps, or is harmless.
- That the gain holds in every season. At Jefferson from November to January all three intervals include zero.
- That "3 of 3" is three independent confirmations.
- That the validation figures describe expected performance, or what caused the smaller gain at Jefferson. The skill ratio there was 1.6 to 2.3 times as high in the held-out year.
- That soil moisture or HRRR "drives" or "explains" the error. The removal effects are predictive value to these models on these cases.
- Anything about real-time use, other gauges, other regions or other years.
- Anything about floods as such. Squared error rests on few events, one week dominates, and forecasts are missing where the gauge record has gaps.
- The split by observed flow as a skill statement.
