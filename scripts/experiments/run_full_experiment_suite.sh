#!/bin/bash
# Full Experiment Suite - All 5 configurations × 4 sites
# Run with: nohup bash scripts/experiments/run_full_experiment_suite.sh > logs/experiment_suite.log 2>&1 &

set -e

cd /Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase
export PYTHONPATH="$(pwd)"

SITES=("03161000" "03164000" "03479000" "03486000")
EXPERIMENTS=(
    "gru_transformer_v2_nwm_era5_tuned|"
    "gru_transformer_v2_causal|--use-causal-mask"
    "gru_transformer_v2_direct|--target-mode direct"
    "gru_transformer_v2_nonneg|--weight-nonneg 0.1"
    "gru_transformer_v2_causal_nonneg|--use-causal-mask --weight-nonneg 0.1"
)

# Common training parameters
COMMON_ARGS="--epochs 40 --batch-size 64 --no-compile --track-gradients"
TRAIN_ARGS="--train-start 2010-01-01 --train-end 2017-12-31"
VAL_ARGS="--val-start 2018-01-01 --val-end 2018-12-31"
TEST_ARGS="--test-start 2019-01-01 --test-end 2020-12-31"

# Create logs directory
mkdir -p logs/experiments
mkdir -p local_only/logs/gradients

echo "=========================================="
echo "FULL EXPERIMENT SUITE"
echo "Started: $(date)"
echo "Sites: ${SITES[*]}"
echo "Experiments: gru_transformer_v2_nwm_era5_tuned, gru_transformer_v2_causal, gru_transformer_v2_direct, gru_transformer_v2_nonneg, gru_transformer_v2_causal_nonneg"
echo "=========================================="

total_experiments=$((${#SITES[@]} * ${#EXPERIMENTS[@]}))
current=0

for site in "${SITES[@]}"; do
    DATA_FILE="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    
    if [ ! -f "$DATA_FILE" ]; then
        echo "[ERROR] Data file not found: $DATA_FILE"
        continue
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
echo "EXPERIMENT SUITE COMPLETE"
echo "Finished: $(date)"
echo "=========================================="

# Export results to JSON for dashboard
echo ""
echo "Exporting results to JSON..."
.venv/bin/python scripts/export/export_results_to_json.py

echo "Done!"
