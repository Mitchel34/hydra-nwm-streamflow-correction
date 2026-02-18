#!/bin/bash
cd /Users/mitchelcarson/Desktop/Thesis/2_Thesis_Codebase
mkdir -p logs/experiments
bash scripts/run_v3_experiment_suite.sh > logs/v3_experiment_suite.log 2>&1
echo "Suite finished with exit code: $?" >> logs/v3_experiment_suite.log
