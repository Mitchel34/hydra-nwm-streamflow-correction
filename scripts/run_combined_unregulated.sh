#!/bin/bash
# Run combined training on 3 unregulated sites
# Sites: 03161000 (Jefferson), 03164000 (Galax), 03479000 (Sugar Grove)

WORKDIR="/Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase"
cd "$WORKDIR"
export PYTHONPATH="$WORKDIR"

PYTHON="$WORKDIR/.venv/bin/python"
LOG_DIR="$WORKDIR/logs/experiments"
mkdir -p "$LOG_DIR"

echo "========================================"
echo "Combined Unregulated Sites Experiment"
echo "Started: $(date)"
echo "========================================"

# Step 1: Create combined dataset
echo ""
echo "[1/3] Creating combined dataset for unregulated sites..."
$PYTHON -c "
import pandas as pd
from pathlib import Path

sites = ['03161000', '03164000', '03479000']
dfs = []

for site in sites:
    path = Path('data/clean/modeling/hourly_training_2010_2020_{}.parquet'.format(site))
    if path.exists():
        df = pd.read_parquet(path)
        print(f'  Loaded {site}: {len(df)} rows')
        dfs.append(df)
    else:
        print(f'  WARNING: {path} not found!')

combined = pd.concat(dfs, ignore_index=True)
combined = combined.sort_values('timestamp').reset_index(drop=True)

output_path = 'data/clean/modeling/hourly_training_2010_2020_unregulated_combined.parquet'
combined.to_parquet(output_path)
print(f'\nCombined dataset: {len(combined)} rows')
print(f'Saved to: {output_path}')
"

DATA_FILE="$WORKDIR/data/clean/modeling/hourly_training_2010_2020_unregulated_combined.parquet"

if [ ! -f "$DATA_FILE" ]; then
    echo "[ERROR] Combined data file not found!"
    exit 1
fi

COMMON_ARGS="--epochs 50 --batch-size 64 --no-compile --track-gradients"
TRAIN_ARGS="--train-start 2010-01-01 --train-end 2017-12-31"
VAL_ARGS="--val-start 2018-01-01 --val-end 2018-12-31"
TEST_ARGS="--test-start 2019-01-01 --test-end 2020-12-31"
SCRIPT="$WORKDIR/modeling/train_quick_transformer_torch.py"

# Step 2: Run experiments
echo ""
echo "[2/3] Running experiments on combined dataset..."

# Baseline
echo ""
echo "[$(date)] Running: baseline (combined unregulated)"
$PYTHON "$SCRIPT" \
    --data "$DATA_FILE" --output-prefix "exp_baseline_unregulated_combined" \
    $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
    2>&1 | tee "$LOG_DIR/exp_baseline_unregulated_combined.log"
echo "[$(date)] Completed: baseline"

# Causal
echo ""
echo "[$(date)] Running: causal (combined unregulated)"
$PYTHON "$SCRIPT" \
    --data "$DATA_FILE" --output-prefix "exp_causal_unregulated_combined" \
    $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
    --use-causal-mask \
    2>&1 | tee "$LOG_DIR/exp_causal_unregulated_combined.log"
echo "[$(date)] Completed: causal"

# Physics
echo ""
echo "[$(date)] Running: physics (combined unregulated)"
$PYTHON "$SCRIPT" \
    --data "$DATA_FILE" --output-prefix "exp_physics_unregulated_combined" \
    $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
    --weight-nonneg 0.1 \
    2>&1 | tee "$LOG_DIR/exp_physics_unregulated_combined.log"
echo "[$(date)] Completed: physics"

# Combined (causal + physics)
echo ""
echo "[$(date)] Running: combined (causal + physics, unregulated)"
$PYTHON "$SCRIPT" \
    --data "$DATA_FILE" --output-prefix "exp_combined_unregulated_combined" \
    $COMMON_ARGS $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
    --use-causal-mask --weight-nonneg 0.1 \
    2>&1 | tee "$LOG_DIR/exp_combined_unregulated_combined.log"
echo "[$(date)] Completed: combined"

echo ""
echo "========================================"
echo "[3/3] All experiments complete: $(date)"
echo "========================================"

# Export results
echo ""
echo "Exporting results..."
$PYTHON "$WORKDIR/scripts/export_results_to_json.py" 2>&1
echo "Done!"
