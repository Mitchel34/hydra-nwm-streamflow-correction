#!/bin/bash
# Run experiments for remaining sites (03164000, 03479000, 03486000)
# Fixed version - properly activates venv and sets PYTHONPATH

WORKDIR="/Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase"
cd "$WORKDIR"
source "$WORKDIR/.venv/bin/activate"
export PYTHONPATH="$WORKDIR"

SITES=("03164000" "03479000" "03486000")
LOG_MAIN="$WORKDIR/logs/experiment_remaining_sites_v2.log"

echo "========================================" | tee -a "$LOG_MAIN"
echo "Started: $(date)" | tee -a "$LOG_MAIN"
echo "Python: $(which python)" | tee -a "$LOG_MAIN"
echo "PYTHONPATH: $PYTHONPATH" | tee -a "$LOG_MAIN"
echo "Sites: ${SITES[*]}" | tee -a "$LOG_MAIN"
echo "========================================" | tee -a "$LOG_MAIN"

COMMON_ARGS="--epochs 40 --batch-size 64 --no-compile --track-gradients"
TRAIN_ARGS="--train-start 2010-01-01 --train-end 2017-12-31"
VAL_ARGS="--val-start 2018-01-01 --val-end 2018-12-31"
TEST_ARGS="--test-start 2019-01-01 --test-end 2020-12-31"

for site in "${SITES[@]}"; do
    DATA_FILE="$WORKDIR/data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    
    if [ ! -f "$DATA_FILE" ]; then
        echo "[ERROR] Data file not found: $DATA_FILE" | tee -a "$LOG_MAIN"
        continue
    fi
    
    echo "" | tee -a "$LOG_MAIN"
    echo "=== Site $site ===" | tee -a "$LOG_MAIN"
    
    # Baseline
    echo "[$(date)] Running: baseline on site ${site}" | tee -a "$LOG_MAIN"
    "$WORKDIR/.venv/bin/python" "$WORKDIR/modeling/training/train_quick_transformer_torch.py" \
        --data "$DATA_FILE" --output-prefix "exp_baseline_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        2>&1 | tee "$WORKDIR/logs/experiments/exp_baseline_${site}.log"
    echo "[$(date)] Completed: baseline on site ${site}" | tee -a "$LOG_MAIN"
    
    # Causal
    echo "[$(date)] Running: causal on site ${site}" | tee -a "$LOG_MAIN"
    "$WORKDIR/.venv/bin/python" "$WORKDIR/modeling/training/train_quick_transformer_torch.py" \
        --data "$DATA_FILE" --output-prefix "exp_causal_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --use-causal-mask \
        2>&1 | tee "$WORKDIR/logs/experiments/exp_causal_${site}.log"
    echo "[$(date)] Completed: causal on site ${site}" | tee -a "$LOG_MAIN"
    
    # Direct
    echo "[$(date)] Running: direct on site ${site}" | tee -a "$LOG_MAIN"
    "$WORKDIR/.venv/bin/python" "$WORKDIR/modeling/training/train_quick_transformer_torch.py" \
        --data "$DATA_FILE" --output-prefix "exp_direct_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --target-mode direct \
        2>&1 | tee "$WORKDIR/logs/experiments/exp_direct_${site}.log"
    echo "[$(date)] Completed: direct on site ${site}" | tee -a "$LOG_MAIN"
    
    # Physics
    echo "[$(date)] Running: physics on site ${site}" | tee -a "$LOG_MAIN"
    "$WORKDIR/.venv/bin/python" "$WORKDIR/modeling/training/train_quick_transformer_torch.py" \
        --data "$DATA_FILE" --output-prefix "exp_physics_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --weight-nonneg 0.1 \
        2>&1 | tee "$WORKDIR/logs/experiments/exp_physics_${site}.log"
    echo "[$(date)] Completed: physics on site ${site}" | tee -a "$LOG_MAIN"
    
    # Combined
    echo "[$(date)] Running: combined on site ${site}" | tee -a "$LOG_MAIN"
    "$WORKDIR/.venv/bin/python" "$WORKDIR/modeling/training/train_quick_transformer_torch.py" \
        --data "$DATA_FILE" --output-prefix "exp_combined_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        --use-causal-mask --weight-nonneg 0.1 \
        2>&1 | tee "$WORKDIR/logs/experiments/exp_combined_${site}.log"
    echo "[$(date)] Completed: combined on site ${site}" | tee -a "$LOG_MAIN"
done

echo "" | tee -a "$LOG_MAIN"
echo "========================================" | tee -a "$LOG_MAIN"
echo "All experiments complete: $(date)" | tee -a "$LOG_MAIN"
echo "========================================" | tee -a "$LOG_MAIN"

# Export results
echo "Exporting results..." | tee -a "$LOG_MAIN"
"$WORKDIR/.venv/bin/python" "$WORKDIR/scripts/export/export_results_to_json.py" 2>&1 | tee -a "$LOG_MAIN"
echo "Done!" | tee -a "$LOG_MAIN"
