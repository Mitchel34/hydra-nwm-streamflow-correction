#!/usr/bin/env bash
set -euo pipefail

PID_FILE="logs/nwm_all_v2_retrospective_2010_2020.pid"

if [[ -f "$PID_FILE" ]]; then
  pid=$(cat "$PID_FILE")
  if kill -0 "$pid" 2>/dev/null; then
    echo "Waiting for $PID_FILE ($pid) to finish..."
    while kill -0 "$pid" 2>/dev/null; do
      sleep 60
    done
  fi
fi

echo "NWM all-sites run complete. Rebuilding datasets..."

.venv/bin/python modeling/dataset/build_training_dataset.py \
  --raw-dir data/raw \
  --out-dir data/clean/modeling \
  --start 2010-01-01 \
  --end 2020-12-31 \
  --sites 03479000 03486000 03161000 03164000 \
  --nwm-version v2

.venv/bin/python scripts/preprocessing/build_processed_parquets.py \
  --data data/clean/modeling/hourly_training_03161000_03164000_03479000_03486000_2010-01-01_2020-12-31.parquet \
  --output-prefix watauga_cluster_2010_2020

.venv/bin/python scripts/evaluation/baseline_eval.py \
  --data data/clean/modeling/hourly_training_03161000_03164000_03479000_03486000_2010-01-01_2020-12-31.parquet \
  --output-prefix watauga_cluster_2010_2020

echo "Rebuild complete."
