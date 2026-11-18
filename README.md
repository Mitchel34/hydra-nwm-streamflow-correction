# AGU HYDRA · Local correction of NWM streamflow forecasts

This is the HRRR study accompanying AGU26 poster H51P-1404 by Mitchel Carson, Mohammad Ali Javidian and William P. Anderson Jr. We tested when locally trained neural networks improve National Water Model (NWM) forecasts and which inputs contribute to those gains. [Interactive results](https://www.hydramodel.ai/) · [Reviewed findings](dashboard/agu-hrrr/site/files/FINDINGS.md) · [Full scorecards](dashboard/agu-hrrr/site/files/REPORT.md) · [Chart data](dashboard/agu-hrrr/site/data.json)

## Study design

- **Gauges.** South Fork New River near Jefferson, NC (03161000), New River near Galax, VA (03164000), and Watauga River near Sugar Grove, NC (03479000). Forecast leads are native H1–H18. Labels are observed streamflow. HRRR supplies the weather forecasts and initial soil moisture.
- **Training.** A sequence-to-sequence LSTM, GRU with convolutions, and temporal Transformer each predict a residual added to NWM. The study selected one recipe per architecture across the three sites and fitted the parameters separately at each gauge. The frozen AdamW learning rates and epoch caps were 0.0003 and 200 for the LSTM, 0.0001 and 100 for GRU+Conv, and 0.0003 and 100 for the Transformer.
- **Input removal.** Three architectures × three gauges × three seeds (1729–1731) × nine input variants produced 243 development fits. Each full-input model has eight paired retrained variants removing soil moisture, all HRRR, gauge history, the NWM predictor, precipitation, temperature, humidity, or snow. Removing the NWM predictor retains NWM as the residual forecast anchor.
- **Evaluation.** Development used May 2021–January 2022 for fitting and February–April 2022 for validation. Each combination was refitted on the full first year for its validation-selected epoch count. The 243 frozen refits were scored on eligible cases from May 2022–April 2023. Matching comparators were NWM, the latest eligible observed flow, a lead-specific mean-residual correction and a lead-specific affine regression.

## What the forecasts showed

Averaged over seeds and pooled over 18 leads, the networks lowered squared error relative to NWM by 41–46% at Jefferson and 36–49% at Galax. At Galax all three had lower mean absolute error than NWM from H5 through H18. Persistence had lower mean absolute error than every network through H7. At Sugar Grove the networks stayed within about 1% of NWM in pooled squared error, and the Transformer had higher mean absolute error at every lead. At Jefferson, the intervals comparing each network with the affine regression included zero.

The evaluation year had been scored in earlier work. The current campaign opened it once after freezing its models and analysis. The gauges share storms, one November week accounted for 45–67% of NWM squared error, and the three model seeds are held fixed in the week-block intervals. The input-removal results describe predictive contributions for these fitted models. See the [evaluation report](dashboard/agu-hrrr/site/files/REPORT.md) and [post hoc aggregate diagnostics](dashboard/agu-hrrr/site/files/posthoc.json).

## Website source and deployment

The homepage follows the study from Helene’s historical motivation through data preparation, architecture choices, the chronological split and results. Its Galax, Jefferson and Sugar Grove figures provide all 18 lead values in accessible tables. [Complete technical scorecards](dashboard/agu-hrrr/site/technical.html) · [Photography, affiliation marks and data sources](dashboard/agu-hrrr/SOURCES.md)

The [site generator](dashboard/agu-hrrr/build_site.py), [narrative renderer](dashboard/agu-hrrr/story.py), [technical charts](dashboard/agu-hrrr/site/app.js) and reviewed aggregate releases are in `dashboard/agu-hrrr/`. To inspect the committed site locally from the repository root, run:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory dashboard/agu-hrrr/site
```

Open `http://127.0.0.1:8000/`. Maintainers with the campaign checkout can regenerate the public tables and page using `python3 -B dashboard/agu-hrrr/build_site.py /path/to/hydra-campaign`. The production build serves the committed files and requires no research data or model execution.

The existing Vercel project uses `dashboard` as its root directory. On this branch [vercel.json](dashboard/vercel.json) selects the static site, skips dependency installation, and validates the chart JavaScript before serving `agu-hrrr/site`. The poster’s GitHub QR opens this branch. `/study` is its readable shortcut on the deployed site.

The [prod branch](https://github.com/Mitchel34/hydra-nwm-streamflow-correction/tree/prod) preserves the previous dashboard and the separate historical research it presents.
