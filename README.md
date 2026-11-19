# AGU HYDRA · Local correction of NWM streamflow forecasts

This is the HRRR study accompanying AGU26 poster H51P-1404 by Mitchel Carson, Mohammad Ali Javidian and William P. Anderson Jr. We tested when locally trained neural networks improve National Water Model (NWM) forecasts and which inputs contribute to those gains. [Interactive branch preview (Vercel sign-in)](https://hydra-nwm-streamflow-correc-git-1a5a58-mitchel-carsons-projects.vercel.app) · [Public findings](dashboard/agu-hrrr/site/files/FINDINGS.md) · [Full scorecards](dashboard/agu-hrrr/site/files/REPORT.md) · [Chart data](dashboard/agu-hrrr/site/data.json)

## Study design

- **Gauges.** South Fork New River near Jefferson, NC (03161000), New River near Galax, VA (03164000), and Watauga River near Sugar Grove, NC (03479000). Forecast leads are native H1–H18. Labels are observed streamflow. HRRR supplies the weather forecasts and initial soil moisture.
- **Training.** A sequence-to-sequence LSTM, GRU with convolutions, and temporal Transformer each predict a residual added to NWM. The study selected one recipe per architecture across the three sites and fitted the parameters separately at each gauge. The frozen AdamW learning rates and epoch caps were 0.0003 and 200 for the LSTM, 0.0001 and 100 for GRU+Conv, and 0.0003 and 100 for the Transformer.
- **Input removal.** Three architectures × three gauges × three seeds (1729–1731) × nine input variants produced 243 development fits. Each full-input model has eight paired retrained variants removing soil moisture, all HRRR, gauge history, the NWM predictor, precipitation, temperature, humidity, or snow. Removing the NWM predictor retains NWM as the residual forecast anchor.
- **Evaluation.** Development used May 2021–January 2022 for fitting and February–April 2022 for validation. Each combination was refitted on the full first year for its validation-selected epoch count. The 243 frozen refits were scored on eligible cases from May 2022–April 2023. Matching comparators were NWM, the latest eligible observed flow, a lead-specific mean-residual correction and a lead-specific affine regression.

## Acquisition and panel construction

The campaign joined three station discharge CSVs, a BigQuery-derived NWM short-range forecast export and archived six-hourly HRRR basin summaries. It assembled one row per gauge and nominal NWM issue hour, keeping the original leads, quality masks and observed verification separate. The construction receipt records nine site-by-period panels with 52,560 rows before eligibility filtering. The legacy one-gauge quickstart uses ERA5 and belongs to the previous study. [Current HRRR acquisition record](dashboard/agu-hrrr/SOURCES.md#archive-inputs-and-panel-construction) · [Historical quickstart](data_acquisition_scripts/README.md)

## What the forecasts showed

Averaged over seeds and pooled over 18 leads, the networks lowered squared error relative to NWM by 41–46% at Jefferson and 36–49% at Galax. At Galax all three had lower mean absolute error than NWM from H5 through H18. Persistence had lower mean absolute error than every network through H7. At Sugar Grove the networks stayed within about 1% of NWM in pooled squared error, and the Transformer had higher mean absolute error at every lead. At Jefferson, the intervals comparing each network with the affine regression included zero.

The evaluation year had been scored in earlier work. The current campaign opened it once after freezing its models and analysis. The gauges share storms, one November week accounted for 45–67% of NWM squared error, and the three model seeds are held fixed in the week-block intervals. The input-removal results describe predictive contributions for these fitted models. See the [evaluation report](dashboard/agu-hrrr/site/files/REPORT.md) and [post hoc aggregate diagnostics](dashboard/agu-hrrr/site/files/posthoc.json).

## Website source and deployment

The homepage follows the study from Helene’s historical motivation through data preparation, architecture choices, the chronological split and results. Its Galax, Jefferson and Sugar Grove figures provide all 18 lead values in accessible tables. [Complete technical scorecards](dashboard/agu-hrrr/site/technical.html) · [Photography, affiliation marks and data sources](dashboard/agu-hrrr/SOURCES.md)

The observed hydrograph compares weekly USGS discharge at the three gauges during the fitting period. The lead explorer shows how the forecast models performed against NWM. The research assistant retrieves from the reviewed findings, exact by-lead scorecards, public code, and a verified guide to the frozen implementation. [Implementation guide](dashboard/agu-hrrr/site/files/CODE_GUIDE.md) · [Chart data and processing](dashboard/agu-hrrr/SOURCES.md#observed-weekly-hydrographs)

From the repository root, run the local website and its API on Node 22 or later.

```sh
cd dashboard/agu-hrrr
npm ci --ignore-scripts
npm run dev
```

Open `http://127.0.0.1:8000/`. Common questions have sourced study answers, and single-lead lookups read the released scores directly. Other questions use retrieved passages for synthesis. The optional USGS title search returns up to three records from the Publications Warehouse. If synthesis is unavailable, the response identifies the source passages and external records separately. For generated answers, set a dedicated server-side `OPENAI_API_KEY` in the launching environment or in the Vercel project settings. Select Preview and the `agu-hrrr-2026` branch for coauthor review, then redeploy that branch after saving the variable. Set Production separately when promoting the study. The default model is `gpt-4.1-mini`; `OPENAI_MODEL` can select a Responses API model that supports strict structured output. [OpenAI Responses API](https://developers.openai.com/api/docs/guides/structured-outputs)

The assistant allows 25 accepted questions per anonymous browser session over 24 hours. On Vercel, connect a dedicated private Blob store with the variable prefix HYDRA_CHAT to the deployment environment. The server expects the sensitive HYDRA_CHAT_READ_WRITE_TOKEN supplied by that connection and requires a successful conditional counter update before calling either service. Only a random session identifier, its start time and its question count go into the store. Blobs have a one-day expiry policy. Clearing the transcript or reloading the page preserves the allowance. Local development uses a single-process counter.

Only a visitor's question, at most two prior question/answer pairs, and up to five published excerpts go to OpenAI. Requests set `store: false`. The server resolves citation IDs against those excerpts. It uses a 28-second upstream timeout and a 560-token response limit. Within each warm server instance it allows six generated requests per client per minute, 32 total per minute, and four in flight. For production-wide usage controls, use OpenAI project limits or a Vercel Firewall rate-limit rule for POST `/api/research-chat`. The app keeps conversation history in page memory.

The Vercel project root is `dashboard`. The branch installs only the locked chart package, stages its browser bundle and licenses, tests the assistant, serves `agu-hrrr/site`, and deploys `api/research-chat.mjs`. Static charts and tables are generated from published summaries. Maintainers with the campaign checkout can regenerate the scorecards using `python3 -B dashboard/agu-hrrr/build_site.py /path/to/hydra-campaign`. The poster’s GitHub QR opens this branch. Its website QR opens the production domain. [Site generator](dashboard/agu-hrrr/build_site.py) · [Vercel configuration](dashboard/vercel.json)

The [prod branch](https://github.com/Mitchel34/hydra-nwm-streamflow-correction/tree/prod) preserves the previous dashboard and the separate historical research it presents.
