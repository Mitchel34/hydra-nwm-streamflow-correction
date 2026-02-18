#!/bin/bash
# Re-run only the failed experiments
# Failed due to PyTorch import error during previous run

WORKDIR="/Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase"
cd "$WORKDIR"
export PYTHONPATH="$WORKDIR"

LOG_MAIN="$WORKDIR/logs/experiment_failed_rerun.log"
mkdir -p "$WORKDIR/logs/experiments"

echo "========================================" | tee -a "$LOG_MAIN"
echo "Re-running failed experiments" | tee -a "$LOG_MAIN"
echo "Started: $(date)" | tee -a "$LOG_MAIN"
echo "Python: $WORKDIR/.venv/bin/python" | tee -a "$LOG_MAIN"
echo "========================================" | tee -a "$LOG_MAIN"

COMMON_ARGS="--epochs 40 --batch-size 64 --no-compile --track-gradients"
TRAIN_ARGS="--train-start 2010-01-01 --train-end 2017-12-31"
VAL_ARGS="--val-start 2018-01-01 --val-end 2018-12-31"
TEST_ARGS="--test-start 2019-01-01 --test-end 2020-12-31"
PYTHON="$WORKDIR/.venv/bin/python"
SCRIPT="$WORKDIR/modeling/training/train_quick_transformer_torch.py"

run_experiment() {
    local site=$1
    local exp_type=$2
    local extra_args=$3

    DATA_FILE="$WORKDIR/data/clean/modeling/hourly_training_2010_2020_${site}.parquet"

    if [ ! -f "$DATA_FILE" ]; then
        echo "[ERROR] Data file not found: $DATA_FILE" | tee -a "$LOG_MAIN"
        return 1
    fi

    echo "[$(date)] Running: ${exp_type} on site ${site}" | tee -a "$LOG_MAIN"
    "$PYTHON" "$SCRIPT" \
        --data "$DATA_FILE" --output-prefix "exp_${exp_type}_${site}" \
        $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        $extra_args \
        2>&1 | tee "$WORKDIR/logs/experiments/exp_${exp_type}_${site}.log"
    echo "[$(date)] Completed: ${exp_type} on site ${site}" | tee -a "$LOG_MAIN"
}

# Site 03164000 - 3 failed experiments
echo "" | tee -a "$LOG_MAIN"
echo "=== Site 03164000 (3 remaining) ===" | tee -a "$LOG_MAIN"
run_experiment "03164000" "direct" "--target-mode direct"
run_experiment "03164000" "physics" "--weight-nonneg 0.1"
run_experiment "03164000" "combined" "--use-causal-mask --weight-nonneg 0.1"

# Site 03479000 - all 5 experiments
echo "" | tee -a "$LOG_MAIN"
echo "=== Site 03479000 (5 experiments) ===" | tee -a "$LOG_MAIN"
run_experiment "03479000" "baseline" ""
run_experiment "03479000" "causal" "--use-causal-mask"
run_experiment "03479000" "direct" "--target-mode direct"
run_experiment "03479000" "physics" "--weight-nonneg 0.1"
run_experiment "03479000" "combined" "--use-causal-mask --weight-nonneg 0.1"

# Site 03486000 - all 5 experiments
echo "" | tee -a "$LOG_MAIN"
echo "=== Site 03486000 (5 experiments) ===" | tee -a "$LOG_MAIN"
run_experiment "03486000" "baseline" ""
run_experiment "03486000" "causal" "--use-causal-mask"
run_experiment "03486000" "direct" "--target-mode direct"
run_experiment "03486000" "physics" "--weight-nonneg 0.1"
run_experiment "03486000" "combined" "--use-causal-mask --weight-nonneg 0.1"

echo "" | tee -a "$LOG_MAIN"
echo "========================================" | tee -a "$LOG_MAIN"
echo "All failed experiments re-run complete: $(date)" | tee -a "$LOG_MAIN"
echo "========================================" | tee -a "$LOG_MAIN"

# Export results
echo "Exporting results..." | tee -a "$LOG_MAIN"
"$PYTHON" "$WORKDIR/scripts/export/export_results_to_json.py" 2>&1 | tee -a "$LOG_MAIN"
echo "Done!" | tee -a "$LOG_MAIN"
