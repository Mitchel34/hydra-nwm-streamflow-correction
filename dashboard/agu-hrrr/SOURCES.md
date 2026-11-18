# HYDRA website sources

The homepage charts and score tables use the public release in [site/data.json](site/data.json). The [generator](build_site.py) checks the evaluation release against its cross-check record. The [narrative and figure renderer](story.py) draws each four-series, 18-lead MAE figure from that release. For each lead it calculates 100 × (1 − model MAE / matching NWM MAE) using the three-seed mean MAE for each network. Persistence and NWM use identical observed cases. Positive values indicate lower MAE. The [full scorecards](site/files/REPORT.md) include the other metrics. Archived publication times and USGS revision histories were unverified.

## Archive inputs and panel construction

The recorded inputs for the May 2021–April 2023 study are existing archive exports. The campaign records identify the files and how they became model inputs. They do not provide an end-to-end public download recipe for recreating those files. The [historical Watauga quickstart](../../data_acquisition_scripts/README.md) describes an earlier ERA5 workflow.

| Archive input | What entered the study |
|---|---|
| USGS streamflow | One consolidated discharge CSV for each gauge, 03161000 (Jefferson), 03164000 (Galax) and 03479000 (Sugar Grove). The pipeline retained timestamps and qualifiers, accepted approved exact-hour instantaneous observations and converted ft³/s to m³/s. It kept past gauge readings separate from future observed verification. |
| NWM short-range forecasts | An existing BigQuery-derived Parquet, `nwm_short_range_f001_f018.parquet`, contained gauge and reach identifiers, issue and valid times, native leads, flow and version information. For each gauge, the NWM issue defined the origin and the original H1–H18 forecasts defined its baseline. |
| HRRR basin weather | An existing cache supplied basin averages, masks and spatial coverage for selected six-hourly HRRR cycles. The model used 2 m temperature, 2 m specific humidity, hourly precipitation and snow water equivalent at each target hour. Initial soil moisture came from H0 of that same cycle. HRRR was the only weather source. |

The exporter separated the source records into fitting, validation and evaluation periods. For each nominal NWM issue, the assembler joined the gauge’s preceding 168 hourly slots to the matching native NWM forecasts and the latest eligible HRRR cycle issued at or before that origin. Weather had to match each target’s valid time. Missing cells kept their masks. The separate labels were approved observations at H1–H18, and each residual target was observed flow minus its matching NWM forecast.

The original construction receipt counts **nine site-by-period panels and 52,560 nominal gauge-hours**, including boundary and incomplete rows. In the modeling pipeline, only certain absent gauge-history slots could use an accepted earlier observation up to two hours old. Future labels always required an observation. The refits used a separately assembled contiguous first-year panel per gauge, with supplemental NWM and HRRR exports at the former February split. Scaling used only each model’s training period.

The metadata establish the archive-to-panel processing and the identities of the resulting files. Historical forecast publication times and the USGS revisions visible at issue time remain unverified. The scientific interpretation is retrospective.

### Campaign evidence

These identifiers refer to the original project's local research records. The public website contains aggregate scores. The three source-identity snapshots preserve captured hashes for the earlier export manifests. The recovery receipt verified that all nine rebuilt panel files matched the original outputs byte for byte.

| Record | SHA-256 |
|---|---|
| NWM and three USGS source declarations, `bounded_source_export_exception.json` | `fa11e53a3b8c1bfc704246a378ded663a76356755b9c24acf8d3709ccf68590b` |
| HRRR cycle and array selection, `hrrr_source_export_exception.json` | `96114afbf8755c0b6c357f7519ddda49eeda059eb320ad2377aed6918b25f48b` |
| Original nine-panel construction receipt, `native18_input_construction.json` | `bbc4c80a88ffe3d2b9f8f8bfaf2a82ac739722c91e7774cb0fd6d3eae9759af0` |
| Resident assembly and source bindings, `native_input_manifest.json` | `a52d72b40b364eee5a48b9c1368d96c64e4026ccfd49894a527f21a763cb60bf` |
| Panel identity check, `native18-resident-recovery-receipt-v2.json` | `4a21eefb2fc51423e65e2962a45769d810f4efe0028d1453137a413bafb0cd4f` |
| Gauge-history treatment, `usgs_history_gap_policy.json` | `e650a60aefe9f922a95a7c17ae98eb2b07c55007e533821a0dfdab649280649f` |
| First-year refit assembly, `refit_input_manifest.json` | `e91a44289fa86b428a6af5041faee772c6ca02c8f4f115e64d70afa07800a3f1` |

## Full-input architecture diagrams

The three diagrams trace the forward passes used in the 2026 study. The LSTM passes its gauge-history hidden and cell states to a recurrent forecast decoder. The GRU combines its history state with two width-three temporal convolutions over the issued forecast sequence. The temporal Transformer encodes 56 ordered three-hour patches, appends the projected initial soil state to memory and decodes 18 forecast queries. All three predict a signed residual for each native hour. The forecasting engine converts it to m³/s and adds it to the matching NWM value. The dashed arrows show this last addition. Network settings come from the executed campaign plans.

| Frozen campaign record at commit `171a918964f101b5958bac286bcdbaf37a920fa5` | SHA-256 |
| --- | --- |
| Forward passes in `src/agu_hydra/models/architectures.py` | `d5cd1b1cf450121fb3e131fdc11516bb2945e20dcb7c37f4ab287e8bb44f2dac` |
| Architecture specification in `docs/SELECTED_ARCHITECTURES.md` | `d4989b50c557454e00a87f74fcba4a359845dd887fbe9bf43bc97019893fb6f2` |
| Family training recipes in `plans/frozen-recipes-20261110.json` | `216fe2fbf34247815956dbacb43dd196f27801bf346d6cb98f42b18dd2a66c2c` |
| Development plan in `plans/ablate-20261110.json` | `9dcf0b4368c6b28d520a22d1cbf17c0b6f988b872bf7f550b335b959f2237cda` |
| Refit plan in `plans/refit-20261114.json` | `3a4704d43ac441f82c677acae570079921d7248f686d90b25cee4683675f7dc7` |

## Photography

- New River at Grandview, West Virginia. National Park Service photo by Dave Bieri. Used as regional scenery downstream of the study gauges. Locally resized WebP copies preserve the photograph and responsive crops are for display. [NPS source and photographer credit](https://www.nps.gov/places/grandview.htm) · [Agency image](https://www.nps.gov/common/uploads/cropped_image/primary/32A18302-B83B-5ED3-E6E4960F4647F044.jpg?width=2350&quality=90&mode=crop)
- Hurricane Helene, Gulf of Mexico, 25 September 2024. NASA, International Space Station Expedition 72, image ISS072-E-001649. Used only for the historical motivation. The evaluation ended in April 2023. Locally resized WebP. [NASA image record](https://images.nasa.gov/details/iss072e001649) · [Agency image](https://images-assets.nasa.gov/image/iss072e001649/iss072e001649~large.jpg)

## Author affiliations and meeting identification

The public institutional wordmarks appear in their original proportions and colors in the study-team section. University marks identify author affiliations. The AGU mark identifies the meeting venue. The original institutional marks remain their respective owners’ trademarks.

- University of Texas at Austin. Official primary horizontal wordmark from University Marketing and Communications. [Brand guide](https://umac.utexas.edu/brand-center/university-csu-wordmarks/) · [Public web asset](https://umac.utexas.edu/wp-content/themes/bellmont/dist/images/utexas-primary-horizontal-logo.svg)
- Appalachian State University. Primary Appalachian logo from University Communications' public identity guide. [Brand guide](https://uc.appstate.edu/brand-and-identity-guide/identity-guide/logos) · [Public web asset](https://uc.appstate.edu/sites/default/files/primary_appalachian_logo_black_2023.png)
- American Geophysical Union. The unmodified AGU logo image was published by DGOvwCWp under CC BY-SA 4.0. [Image, author and file history](https://commons.wikimedia.org/wiki/File:AGU_Logo.jpg) · [License](https://creativecommons.org/licenses/by-sa/4.0/) · [AGU annual meeting](https://www.agu.org/agu26)

## Typeface

Inter by Rasmus Andersson and contributors. The site serves the variable WOFF2 locally with its SIL Open Font License. [Project](https://github.com/rsms/inter) · [License included with the site](site/media/Inter-LICENSE.txt)
