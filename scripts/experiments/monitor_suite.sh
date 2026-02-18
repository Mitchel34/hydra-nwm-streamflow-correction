#!/bin/bash
# Quick monitor for the v3 experiment suite
cd /Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase

echo "=== V3 EXPERIMENT SUITE MONITOR ==="
echo "Time: $(date)"

# Check if the process is still running
PID=$(pgrep -f "run_v3_experiment_suite" | head -1)
if [ -z "$PID" ]; then
    echo "Status: SUITE NOT RUNNING"
else
    echo "Status: RUNNING (suite PID=$PID)"
    # Find the training python process
    TPID=$(pgrep -f "train_quick_transformer_torch" | head -1)
    if [ -n "$TPID" ]; then
        ps -o pid,pcpu,pmem,etime -p "$TPID" 2>/dev/null
    fi
fi

echo ""
echo "=== Completed experiments ==="
# Count completed experiments by looking for result files
for f in data/clean/modeling/exp_v3_*_metrics.json; do
    if [ -f "$f" ]; then
        name=$(basename "$f" _metrics.json)
        nse=$(python3 -c "import json; d=json.load(open('$f')); print(f'NSE={d[\"corrected\"][\"nse\"]:.3f} ΔRMSE={d[\"rmse_improvement_pct\"]:.1f}%')" 2>/dev/null || echo "parse error")
        echo "  ✅ $name: $nse"
    fi
done

completed=$(ls data/clean/modeling/exp_v3_*_metrics.json 2>/dev/null | wc -l | tr -d ' ')
echo ""
echo "Progress: ${completed}/21 experiments complete"

echo ""
echo "=== Latest log output ==="
tail -5 logs/v3_experiment_suite.log 2>/dev/null

echo ""
echo "=== Individual experiment logs ==="
ls -lt logs/experiments/exp_v3_*.log 2>/dev/null | head -5
