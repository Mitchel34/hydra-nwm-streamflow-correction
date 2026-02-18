#!/bin/bash
# Hydra v3 Experiment Suite — Unregulated Appalachian sites only
# Tests the new architecture (feature gate + multi-scale conv + regime bias)
# with event-stratified sampling against the v2 baseline.
#
# Run with: nohup bash scripts/run_v3_experiment_suite.sh > logs/v3_experiment_suite.log 2>&1 &

set -eo pipefail

cd /Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase
export PYTHONPATH="$(pwd)"
# Prevent torch._dynamo import errors when running under nohup/tee
export TORCHDYNAMO_DISABLE=1
# Force unbuffered Python stdout so tee/log files update in real time
export PYTHONUNBUFFERED=1

# Only unregulated sites
SITES=("03161000" "03164000" "03479000")

# Experiments: name|extra flags
# v3_baseline     — Hydra v3 architecture, default settings
# v3_causal       — v3 + causal masking
# v3_physics      — v3 + non-negativity constraint
# v3_combined     — v3 + causal + physics
# hydra_v3_event_oversample  — v3 + event oversampling (3x boost on Q90+)
# hydra_v3_causal_nonneg_event — v3 + causal + nonneg + event oversampling (best expected)
EXPERIMENTS=(
    "hydra_v3_nwm_era5|"
    "hydra_v3_causal|--use-causal-mask"
    "hydra_v3_nonneg|--weight-nonneg 0.1"
    "hydra_v3_causal_nonneg|--use-causal-mask --weight-nonneg 0.1"
    "hydra_v3_event_oversample|--event-oversample-factor 3.0"
    "hydra_v3_causal_nonneg_event|--use-causal-mask --weight-nonneg 0.1 --event-oversample-factor 3.0"
    "hydra_v3_full_autonorm|--loss-auto-norm --use-causal-mask --weight-nonneg 0.1 --event-oversample-factor 3.0"
)

# Common training parameters (matching v2 experiments for fair comparison)
# --no-ranger: bypass Ranger optimizer to avoid torch._dynamo/sympy import crash
COMMON_ARGS="--epochs 40 --batch-size 64 --no-compile --no-ranger --model-arch hydra_v3"
TRAIN_ARGS="--train-start 2010-01-01 --train-end 2017-12-31"
VAL_ARGS="--val-start 2018-01-01 --val-end 2018-12-31"
TEST_ARGS="--test-start 2019-01-01 --test-end 2020-12-31"

mkdir -p logs/experiments
mkdir -p local_only/logs/gradients

echo "=========================================="
echo "HYDRA v3 EXPERIMENT SUITE"
echo "Started: $(date)"
echo "Sites: ${SITES[*]}"
echo "Experiments: hydra_v3_nwm_era5, hydra_v3_causal, hydra_v3_nonneg, hydra_v3_causal_nonneg, hydra_v3_event_oversample, hydra_v3_causal_nonneg_event, hydra_v3_full_autonorm"
echo "=========================================="

total_experiments=$((${#SITES[@]} * ${#EXPERIMENTS[@]}))
current=0

for site in "${SITES[@]}"; do
    DATA_FILE="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"

    if [ ! -f "$DATA_FILE" ]; then
        # Try alternate naming conventions
        ALT_FILE="data/processed/watauga_cluster_2010_2020_site_${site}.parquet"
        if [ -f "$ALT_FILE" ]; then
            DATA_FILE="$ALT_FILE"
        else
            echo "[ERROR] Data file not found: $DATA_FILE (also tried $ALT_FILE)"
            continue
        fi
    fi

    for exp_config in "${EXPERIMENTS[@]}"; do
        IFS='|' read -r exp_name exp_flags <<< "$exp_config"
        current=$((current + 1))

        OUTPUT_PREFIX="exp_${exp_name}_${site}"
        LOG_FILE="logs/experiments/${OUTPUT_PREFIX}.log"

        echo ""
        echo "[${current}/${total_experiments}] Running: ${exp_name} on site ${site}"
        echo "  Output: ${OUTPUT_PREFIX}"
        echo "  Log: ${LOG_FILE}"
        echo "  Started: $(date)"

        .venv/bin/python modeling/training/train_quick_transformer_torch.py \
            --data "$DATA_FILE" \
            --output-prefix "$OUTPUT_PREFIX" \
            $COMMON_ARGS \
            $TRAIN_ARGS \
            $VAL_ARGS \
            $TEST_ARGS \
            $exp_flags \
            2>&1 | tee "$LOG_FILE"

        echo "  Completed: $(date)"
        echo "  ----------------------------------------"
    done
done

echo ""
echo "=========================================="
echo "v3 EXPERIMENT SUITE COMPLETE"
echo "Finished: $(date)"
echo "=========================================="

# Export results to JSON for dashboard
echo ""
echo "Exporting results to JSON..."
.venv/bin/python scripts/export/export_results_to_json.py

echo "Done!"
