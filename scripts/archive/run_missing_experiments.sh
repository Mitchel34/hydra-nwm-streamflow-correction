#!/bin/bash
# Missing Experiments Suite
# Runs: hydra_v1, hydra_v2, lstm, combined (03161000), usgs_only_v3, usgs_only_simple
#
# Run with: nohup bash scripts/archive/run_missing_experiments.sh > logs/missing_experiments.log 2>&1 &

set -eo pipefail

cd /Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase
export PYTHONPATH="$(pwd)"
export TORCHDYNAMO_DISABLE=1
export PYTHONUNBUFFERED=1

SITES=("03161000" "03164000" "03479000")

COMMON_ARGS="--epochs 40 --batch-size 64 --no-compile --no-ranger"
TRAIN_ARGS="--train-start 2010-01-01 --train-end 2017-12-31"
VAL_ARGS="--val-start 2018-01-01 --val-end 2018-12-31"
TEST_ARGS="--test-start 2019-01-01 --test-end 2020-12-31"

mkdir -p logs/experiments

total=19
current=0

echo "=========================================="
echo "MISSING EXPERIMENTS SUITE"
echo "Started: $(date)"
echo "Total experiments: $total"
echo "=========================================="

# ---- Section 1: hydra_v1 (Transformer-only ablation) ----
echo ""
echo "=== HYDRA V1 (Transformer-only) ==="
for site in "${SITES[@]}"; do
    DATA="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    PREFIX="exp_hydra_v1_${site}"
    current=$((current + 1))
    echo ""
    echo "[${current}/${total}] hydra_v1 @ ${site} -- $(date)"

    .venv/bin/python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA" --output-prefix "$PREFIX" \
        --model-arch hydra_v1 $COMMON_ARGS \
        $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        2>&1 | tee "logs/experiments/${PREFIX}.log"

    echo "  Completed: $(date)"
done

# ---- Section 2: hydra_v2 (GRU-Transformer) ----
echo ""
echo "=== HYDRA V2 (GRU-Transformer) ==="
for site in "${SITES[@]}"; do
    DATA="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    PREFIX="exp_hydra_v2_${site}"
    current=$((current + 1))
    echo ""
    echo "[${current}/${total}] hydra_v2 @ ${site} -- $(date)"

    .venv/bin/python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA" --output-prefix "$PREFIX" \
        --model-arch hydra_v2 $COMMON_ARGS \
        $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        2>&1 | tee "logs/experiments/${PREFIX}.log"

    echo "  Completed: $(date)"
done

# ---- Section 3: LSTM baseline ----
echo ""
echo "=== LSTM BASELINE ==="
for site in "${SITES[@]}"; do
    DATA="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    PREFIX="exp_lstm_${site}"
    current=$((current + 1))
    echo ""
    echo "[${current}/${total}] lstm @ ${site} -- $(date)"

    .venv/bin/python modeling/training/train_quick_lstm_torch.py \
        --data "$DATA" --output-prefix "$PREFIX" \
        --epochs 40 --batch-size 64 --no-ranger \
        --train-days 2922 --val-days 365 \
        2>&1 | tee "logs/experiments/${PREFIX}.log"

    echo "  Completed: $(date)"
done

# ---- Section 4: combined for 03161000 (missing) ----
echo ""
echo "=== COMBINED (03161000 only) ==="
DATA="data/clean/modeling/hourly_training_2010_2020_03161000.parquet"
PREFIX="exp_combined_03161000"
current=$((current + 1))
echo ""
echo "[${current}/${total}] combined @ 03161000 -- $(date)"

.venv/bin/python modeling/training/train_quick_transformer_torch.py \
    --data "$DATA" --output-prefix "$PREFIX" \
    --model-arch hydra_v2 $COMMON_ARGS \
    --use-causal-mask --weight-nonneg 0.1 \
    $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
    2>&1 | tee "logs/experiments/${PREFIX}.log"

echo "  Completed: $(date)"

# ---- Section 5: usgs_only_v3 (ERA5-only with Hydra v3) ----
echo ""
echo "=== ERA5-ONLY (Hydra v3) ==="
for site in "${SITES[@]}"; do
    DATA="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    PREFIX="exp_usgs_only_v3_${site}"
    current=$((current + 1))
    echo ""
    echo "[${current}/${total}] usgs_only_v3 @ ${site} -- $(date)"

    .venv/bin/python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA" --output-prefix "$PREFIX" \
        --model-arch hydra_v3 --no-nwm $COMMON_ARGS \
        $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        2>&1 | tee "logs/experiments/${PREFIX}.log"

    echo "  Completed: $(date)"
done

# ---- Section 6: usgs_only_simple (ERA5-only with Simple GRU) ----
echo ""
echo "=== ERA5-ONLY (Simple GRU) ==="
for site in "${SITES[@]}"; do
    DATA="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    PREFIX="exp_usgs_only_simple_${site}"
    current=$((current + 1))
    echo ""
    echo "[${current}/${total}] usgs_only_simple @ ${site} -- $(date)"

    .venv/bin/python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA" --output-prefix "$PREFIX" \
        --model-arch gru_simple --no-nwm $COMMON_ARGS \
        $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        2>&1 | tee "logs/experiments/${PREFIX}.log"

    echo "  Completed: $(date)"
done

echo ""
echo "=========================================="
echo "ALL MISSING EXPERIMENTS COMPLETE"
echo "Finished: $(date)"
echo "=========================================="

# Export results to JSON for dashboard
echo ""
echo "Exporting results to JSON..."
.venv/bin/python scripts/export/export_results_to_json.py
echo "Done!"
