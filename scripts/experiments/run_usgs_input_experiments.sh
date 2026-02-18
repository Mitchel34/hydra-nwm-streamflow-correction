#!/bin/bash
# USGS Input Experiments
# Exp A: hydra_v3_usgs_nwm_era5 — NWM + lagged USGS + ERA5 → predict residual
# Exp B: hydra_v3_usgs_era5     — lagged USGS + ERA5 → predict USGS directly (no NWM)
#
# Run with: nohup bash scripts/experiments/run_usgs_input_experiments.sh > logs/usgs_input_experiments.log 2>&1 &

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

total=6
current=0

echo "=========================================="
echo "USGS INPUT EXPERIMENTS"
echo "Started: $(date)"
echo "Total experiments: $total"
echo "=========================================="

# ---- Experiment A: USGS + NWM + ERA5 (residual mode) ----
echo ""
echo "=== USGS + NWM + ERA5 (Hydra v3) ==="
for site in "${SITES[@]}"; do
    DATA="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    PREFIX="exp_hydra_v3_usgs_nwm_era5_${site}"
    current=$((current + 1))
    echo ""
    echo "[${current}/${total}] hydra_v3_usgs_nwm_era5 @ ${site} -- $(date)"

    .venv/bin/python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA" --output-prefix "$PREFIX" \
        --model-arch hydra_v3 --include-usgs $COMMON_ARGS \
        $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        2>&1 | tee "logs/experiments/${PREFIX}.log"

    echo "  Completed: $(date)"
done

# ---- Experiment B: USGS + ERA5 only (direct mode, no NWM) ----
echo ""
echo "=== USGS + ERA5 (Hydra v3, no NWM) ==="
for site in "${SITES[@]}"; do
    DATA="data/clean/modeling/hourly_training_2010_2020_${site}.parquet"
    PREFIX="exp_hydra_v3_usgs_era5_${site}"
    current=$((current + 1))
    echo ""
    echo "[${current}/${total}] hydra_v3_usgs_era5 @ ${site} -- $(date)"

    .venv/bin/python modeling/training/train_quick_transformer_torch.py \
        --data "$DATA" --output-prefix "$PREFIX" \
        --model-arch hydra_v3 --include-usgs --no-nwm $COMMON_ARGS \
        $TRAIN_ARGS $VAL_ARGS $TEST_ARGS \
        2>&1 | tee "logs/experiments/${PREFIX}.log"

    echo "  Completed: $(date)"
done

echo ""
echo "=========================================="
echo "ALL EXPERIMENTS COMPLETE: $(date)"
echo "=========================================="

# Export results to JSON for dashboard
echo ""
echo "Exporting results..."
.venv/bin/python scripts/export/export_results_to_json.py
echo "Export complete."
