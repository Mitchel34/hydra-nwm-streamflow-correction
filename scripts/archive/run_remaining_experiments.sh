#!/bin/bash
# Run experiments for remaining sites (03164000, 03479000, 03486000)

set -e
cd /Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase
source .venv/bin/activate
export PYTHONPATH="$(pwd)"

SITES=("03164000" "03479000" "03486000")

COMMON_ARGS="--epochs 40 --batch-size 64 --no-compile --track-gradients"
TRAIN_ARGS="--train-start 2010-01-01 --train-end 2017-12-31"
VAL_ARGS="--val-start 2018-01-01 --val-end 2018-12-31"
TEST_ARGS="--test-start 2019-01-01 --test-end 2020-12-31"

LOG_MAIN="logs/experiment_remaining_sites.log"
echo "========================================" >> $LOG_MAIN
echo "Started: $(date)" >> $LOG_MAIN
echo "Sites: ${SITES[*]}" >> $LOG_MAIN
echo "========================================" >> $LOG_MAIN

for site in "${SITES[@]}"; do
    DATA_FILE="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    
    if [ ! -f "$DATA_FILE" ]; then
        echo "[ERROR] Data file not found: $DATA_FILE" >> $LOG_MAIN
        continue
    fi
    
    # Baseline
    echo "[$(date)] Running: baseline on site ${site}" >> $LOG_MAIN
    python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA_FILE" --output-prefix "exp_baseline_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        > "logs/experiments/exp_baseline_${site}.log" 2>&1
    echo "[$(date)] Completed: baseline on site ${site}" >> $LOG_MAIN
    
    # Causal
    echo "[$(date)] Running: causal on site ${site}" >> $LOG_MAIN
    python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA_FILE" --output-prefix "exp_causal_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --use-causal-mask \
        > "logs/experiments/exp_causal_${site}.log" 2>&1
    echo "[$(date)] Completed: causal on site ${site}" >> $LOG_MAIN
    
    # Direct
    echo "[$(date)] Running: direct on site ${site}" >> $LOG_MAIN
    python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA_FILE" --output-prefix "exp_direct_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --target-mode direct \
        > "logs/experiments/exp_direct_${site}.log" 2>&1
    echo "[$(date)] Completed: direct on site ${site}" >> $LOG_MAIN
    
    # Physics
    echo "[$(date)] Running: physics on site ${site}" >> $LOG_MAIN
    python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA_FILE" --output-prefix "exp_physics_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --weight-nonneg 0.1 \
        > "logs/experiments/exp_physics_${site}.log" 2>&1
    echo "[$(date)] Completed: physics on site ${site}" >> $LOG_MAIN
    
    # Combined
    echo "[$(date)] Running: combined on site ${site}" >> $LOG_MAIN
    python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA_FILE" --output-prefix "exp_combined_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --use-causal-mask --weight-nonneg 0.1 \
        > "logs/experiments/exp_combined_${site}.log" 2>&1
    echo "[$(date)] Completed: combined on site ${site}" >> $LOG_MAIN
done

echo "========================================" >> $LOG_MAIN
echo "All experiments complete: $(date)" >> $LOG_MAIN
echo "========================================" >> $LOG_MAIN

# Export results
echo "Exporting results..." >> $LOG_MAIN
python scripts/export/export_results_to_json.py >> $LOG_MAIN 2>&1
echo "Done!" >> $LOG_MAIN
