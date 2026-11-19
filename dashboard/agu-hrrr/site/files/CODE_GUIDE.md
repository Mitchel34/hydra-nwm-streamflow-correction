# How the HRRR study code works

This guide follows the implementation frozen for the evaluated campaign at commit `171a918964f101b5958bac286bcdbaf37a920fa5`. Paths below refer to that campaign. The older HYDRA experiments in the website repository used different inputs and methods. [Full-input model diagrams](../index.html#architectures) · [Study sources](https://github.com/Mitchel34/hydra-nwm-streamflow-correction/blob/agu-hrrr-2026/dashboard/agu-hrrr/SOURCES.md)

## Sequence-to-sequence LSTM

`Seq2SeqLSTM` in `src/agu_hydra/models/architectures.py` (line 32) projects the HRRR initial soil state into the encoder's initial hidden state and initializes its cell state to zero. The encoder reads 168 hourly gauge-history slots. Its final hidden and cell states start a decoder over the 18 issued forecast hours. The decoder sees NWM, HRRR forecast channels, the lead number and the same soil context. A shared linear layer produces one signed residual per lead. The frozen configuration uses 64 hidden units and one recurrent layer, AdamW at 0.0003, and a 200-epoch cap.

## GRU with forecast convolutions

`HydraGRUConv` in `src/agu_hydra/models/architectures.py` (line 159) uses a gated recurrent unit to encode gauge history, initialized from soil moisture. Two width-three temporal convolutions separately process the issued NWM and HRRR sequence. An interior lead can therefore use five neighboring forecast hours, all known at the origin. Each lead combines its convolution output, the final 64-unit history state, soil context and lead number. A shared two-layer perceptron outputs one signed residual. The frozen family recipe uses AdamW at 0.0001 and a 100-epoch cap.

## Temporal Transformer

`TemporalTransformer` in `src/agu_hydra/models/architectures.py` (line 211) projects 56 ordered three-hour gauge patches into 64-dimensional embeddings. Two self-attention encoder layers build the history memory. The projected HRRR soil token joins the memory after encoding. The 18 known forecast queries use learned lead positions, self-attention across issued leads and cross-attention to the memory. The decoder also has two layers, with four heads in each attention module. A shared perceptron reads out a signed residual at each lead. The frozen family recipe uses AdamW at 0.0003 and a 100-epoch cap.

## Where the correction is added

The model predicts a signed discharge residual for each of 18 forecast leads. In the frozen campaign, `validation_metrics` in `src/agu_hydra/training/ablation_campaign.py` reads the matching NWM baseline and adds `baseline + residual` at line 346. The CPU scorer `score_validation` in `src/agu_hydra/training/cpu_campaign.py` uses the same sum at lines 241 and 246. An unready forecast stays missing. The scoring mask also requires an accepted observed discharge at that lead.

## Scaling, loss and checkpoint selection

The target in physical units is observed discharge minus NWM at the same native valid hour. The network output is rescaled before addition to the matching NWM forecast. The engine checks site, chronological origin order, support and masks. Only forecast-ready cells with accepted observed verification contribute to pooled, site-normalized squared error. An empty batch contributes no optimizer update. AdamW uses chronological batches of 32, weight decay 0.0001 and gradient-norm clipping at 1. Development selected the earliest trained epoch achieving the lowest validation loss, with patience 10 and minimum improvement zero. Initialization was diagnostic. A first-year refit recomputed training statistics on that year and ran for its development twin's selected number of epochs.

The training loop is `_epoch` and `_fit_loop` in `src/agu_hydra/training/engine.py` (lines 135 and 315). The mask and normalization are in `normalized_residual_loss` in `src/agu_hydra/models/losses.py` (line 62). Training and refit statistics are separate functions in `src/agu_hydra/training/preprocessing.py` (lines 69 and 76).

## Retrained input ablations

`project_inputs` and `AblationModel` in `src/agu_hydra/training/ablations.py` (lines 109 and 142) neutralize designated standardized inputs and the associated availability, age and lead information while preserving their slots. Each variant is retrained with the same capacity, eligibility and family recipe. Removing NWM as an input still leaves the matching NWM forecast in the final residual sum. Differences measure predictive contributions for this recipe and these cases. They do not identify physical causes.

## Baselines and scoring

`fit_coefficients`, `persistence_donor` and `forecast` in `evaluation/hydra_evaluation/baselines.py` (lines 41, 80 and 109) implement mean-residual correction per lead, affine regression on NWM per lead, and persistence of the latest eligible original gauge reading available at the forecast origin. The two learned baselines fit coefficients on their training period. The scorecard compares forecasts on matched observed-label cells. The five primary metrics are RMSE, MAE, original KGE, NSE and Pearson correlation. Signed bias and percent bias are secondary. [Technical scorecards](../technical.html#nwm)

## How the website reads the study

The site generator verifies the released aggregate results against their cross-check record. The narrative renderer computes the lead curves as 100 × (1 − model MAE / NWM MAE) on matched cases. The model MAE is averaged over three refit seeds. The separate calendar-time hydrographs use public USGS fitting-period observations summarized by week. The research assistant retrieves from these published sources, the input-removal and baseline tables, and this implementation guide. [Site generator](https://github.com/Mitchel34/hydra-nwm-streamflow-correction/blob/agu-hrrr-2026/dashboard/agu-hrrr/build_site.py) · [Lead chart renderer](https://github.com/Mitchel34/hydra-nwm-streamflow-correction/blob/agu-hrrr-2026/dashboard/agu-hrrr/story.py)
