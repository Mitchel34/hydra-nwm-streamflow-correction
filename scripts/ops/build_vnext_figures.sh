#!/usr/bin/env bash
set -euo pipefail

# Build locked WRR vNext figure set aligned to manuscript narrative.
# Run from repository root:
#   bash scripts/ops/build_vnext_figures.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

OUT_DIR="docs/figures"
PYTHON_BIN="${PYTHON_BIN:-python3}"
mkdir -p "$OUT_DIR"

echo "[1/8] Building WRR summary CSV from canonical experiment JSON..."
"$PYTHON_BIN" scripts/export/build_wrr_summary_csv.py

echo "[2/8] Building site map..."
"$PYTHON_BIN" -m viz.plot_wrr_site_map --out "$OUT_DIR/wrr_site_map.pdf"

echo "[3/8] Building performance bars (RMSE/NSE/PBIAS/CC)..."
"$PYTHON_BIN" -m viz.plot_wrr_performance_bars --hydra-summary results/wrr_v3_summary.csv --out-dir "$OUT_DIR"

echo "[4/8] Building hydrograph panel (three unregulated sites)..."
"$PYTHON_BIN" -m viz.plot_wrr_hydrograph_panel \
  --eval-csvs \
    data/clean/modeling/exp_usgs_nwm_era5_v3_03161000_eval.csv \
    data/clean/modeling/exp_usgs_nwm_era5_v3_03164000_eval.csv \
    data/clean/modeling/exp_usgs_nwm_era5_v3_03479000_eval.csv \
  --site-ids 03161000 03164000 03479000 \
  --site-names \
    "S. Fork New River, Jefferson NC" \
    "New River, Galax VA" \
    "Watauga River, Sugar Grove NC" \
  --output "$OUT_DIR/wrr_hydrograph_panel.pdf"

echo "[5/8] Building Hydra v3 architecture diagram from rendered source image..."
sips -s format pdf "$OUT_DIR/Gemini_Hydra_Architecture.png" --out "$OUT_DIR/wrr_architecture.pdf" >/dev/null

echo "[6/8] Building flow-regime decomposition figure..."
"$PYTHON_BIN" -m viz.plot_error_by_flow_regime \
  --eval-csv data/clean/modeling/exp_v3_combined_03161000_eval.csv \
  --site-id 03161000 \
  --site-name "South Fork New River near Jefferson, NC" \
  --output "$OUT_DIR/wrr_error_regime_03161000.pdf"

echo "[7/8] Regenerating lock artifacts (includes figure hash manifest)..."
"$PYTHON_BIN" scripts/manuscript/build_vnext_lock_artifacts.py

echo "[8/8] Syncing Overleaf package..."
PKG_DIR="docs/manuscript/overleaf/wrr_vnext_package"
cp docs/figures/wrr_*.pdf "$PKG_DIR/figures/"
cp -r docs/manuscript/locks/* "$PKG_DIR/locks/"
cp docs/manuscript/wrr_vnext.tex "$PKG_DIR/wrr_vnext.tex"
cp docs/manuscript/wrr_vnext.tex "$PKG_DIR/main.tex"
cp docs/manuscript/refs.bib "$PKG_DIR/refs.bib"
cd docs/manuscript/overleaf && zip -r wrr_vnext_package.zip wrr_vnext_package/ && cd "$ROOT_DIR"

echo "vNext figure build complete. Overleaf package updated."
