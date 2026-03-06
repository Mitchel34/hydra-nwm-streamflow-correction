#!/usr/bin/env python3
"""Build locked manuscript artifacts for WRR vNext draft.

Numeric and table artifacts are generated from canonical project sources:
  - results/experiment_results.json
  - dashboard/public/data/rigorous_eval.json
  - configs/train_val_test.json
  - configs/master_study_sites.py
  - scripts/experiments/run_v3_experiment_suite.sh
  - modeling/training/train_quick_transformer_torch.py

Outputs are written to docs/manuscript/locks/.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
import shlex
import sys
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PRIMARY_EXP = "hydra_v3_usgs_nwm_era5"
ABLATION_EXP = "hydra_v3_nwm_era5"
ARCH_EXPS = [ABLATION_EXP, "hydra_v3_causal", "hydra_v3_nonneg", "hydra_v3_causal_nonneg"]
UNREGULATED_SITES = ["03161000", "03164000", "03479000"]
SITE_ORDER = ["03161000", "03164000", "03479000", "03486000"]

SITE_LABEL = {
    "03161000": "Jefferson, NC",
    "03164000": "Galax, VA",
    "03479000": "Sugar Grove, NC",
    "03486000": "Elizabethton, TN",
}

EXPERIMENT_LABEL = {
    "hydra_v3_nwm_era5": "Hydra v3 (NWM+ERA5 ablation)",
    "hydra_v3_causal": "Hydra v3 + Causal Mask",
    "hydra_v3_nonneg": "Hydra v3 + Non-Neg",
    "hydra_v3_causal_nonneg": "Hydra v3 + Causal + Non-Neg",
    "hydra_v3_usgs_era5": "Hydra v3 + USGS (NWM ablation)",
    "hydra_v3_usgs_nwm_era5": "Hydra v3 + USGS + NWM + ERA5",
}


@dataclass(frozen=True)
class FigureSpec:
    figure_id: str
    path: str
    narrative_role: str
    source_command: str


FIGURE_SPECS = [
    FigureSpec(
        figure_id="fig_site_map",
        path="docs/figures/wrr_site_map.pdf",
        narrative_role="Study domain and site context",
        source_command="python -m viz.plot_wrr_site_map --out docs/figures/wrr_site_map.pdf",
    ),
    FigureSpec(
        figure_id="fig_rmse_bar",
        path="docs/figures/wrr_rmse_bar.pdf",
        narrative_role="Primary performance overview (RMSE)",
        source_command="python -m viz.plot_wrr_performance_bars --hydra-summary results/wrr_v3_summary.csv --out-dir docs/figures",
    ),
    FigureSpec(
        figure_id="fig_nse_bar",
        path="docs/figures/wrr_nse_bar.pdf",
        narrative_role="Primary performance overview (NSE)",
        source_command="python -m viz.plot_wrr_performance_bars --hydra-summary results/wrr_v3_summary.csv --out-dir docs/figures",
    ),
    FigureSpec(
        figure_id="fig_pbias_bar",
        path="docs/figures/wrr_pbias_bar.pdf",
        narrative_role="Bias behavior summary",
        source_command="python -m viz.plot_wrr_performance_bars --hydra-summary results/wrr_v3_summary.csv --out-dir docs/figures",
    ),
    FigureSpec(
        figure_id="fig_hydrograph_panel",
        path="docs/figures/wrr_hydrograph_panel.pdf",
        narrative_role="Event-scale hydrograph behavior",
        source_command=(
            "python -m viz.plot_wrr_hydrograph_panel "
            "--eval-csvs data/clean/modeling/exp_usgs_nwm_era5_v3_03161000_eval.csv "
            "data/clean/modeling/exp_usgs_nwm_era5_v3_03164000_eval.csv "
            "data/clean/modeling/exp_usgs_nwm_era5_v3_03479000_eval.csv "
            "--site-ids 03161000 03164000 03479000 "
            "--site-names \"S. Fork New River, Jefferson NC\" \"New River, Galax VA\" "
            "\"Watauga River, Sugar Grove NC\" "
            "--output docs/figures/wrr_hydrograph_panel.pdf"
        ),
    ),
    FigureSpec(
        figure_id="fig_architecture",
        path="docs/figures/wrr_architecture.pdf",
        narrative_role="Hydra v3 model architecture (USGS+NWM+ERA5 gauge-informed configuration)",
        source_command="sips -s format pdf docs/figures/Gemini_Hydra_Architecture.png --out docs/figures/wrr_architecture.pdf",
    ),
    FigureSpec(
        figure_id="fig_error_regime_03161000",
        path="docs/figures/wrr_error_regime_03161000.pdf",
        narrative_role="Flow-regime decomposition",
        source_command=(
            "python -m viz.plot_error_by_flow_regime "
            "--eval-csv data/clean/modeling/exp_v3_combined_03161000_eval.csv "
            "--site-id 03161000 "
            "--site-name \"South Fork New River near Jefferson, NC\" "
            "--output docs/figures/wrr_error_regime_03161000.pdf"
        ),
    ),
]


def _load_json(path: Path) -> dict[str, Any]:
    with path.open() as fp:
        return json.load(fp)


def _read_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="") as fp:
        return list(csv.DictReader(fp))


def _fmt(value: float | int, digits: int = 1) -> str:
    if isinstance(value, int):
        return str(value)
    return f"{value:.{digits}f}"


def _fmt_p_value(value: Any) -> str:
    if value in ("", None):
        return ""
    try:
        return f"{float(value):.2e}"
    except (TypeError, ValueError):
        return str(value)


def _latex_escape(text: str) -> str:
    return (
        text.replace("\\", "\\textbackslash{}")
        .replace("_", "\\_")
        .replace("%", "\\%")
        .replace("&", "\\&")
        .replace("#", "\\#")
        .replace("{", "\\{")
        .replace("}", "\\}")
    )


def _boolish(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() == "true"
    return bool(value)


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fp:
        for chunk in iter(lambda: fp.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _index_results(payload: dict[str, Any]) -> dict[tuple[str, str], dict[str, Any]]:
    indexed: dict[tuple[str, str], dict[str, Any]] = {}
    for row in payload["results"]:
        indexed[(row["experiment"], row["site_id"])] = row
    return indexed


def _require(indexed: dict[tuple[str, str], dict[str, Any]], experiment: str, site_id: str) -> dict[str, Any]:
    key = (experiment, site_id)
    if key not in indexed:
        raise KeyError(f"Missing experiment/site result for {experiment} @ {site_id}")
    return indexed[key]


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as fp:
        writer = csv.DictWriter(fp, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def _build_primary_table(indexed: dict[tuple[str, str], dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for site_id in UNREGULATED_SITES:
        record = _require(indexed, PRIMARY_EXP, site_id)
        rows.append(
            {
                "site_id": site_id,
                "site_name": SITE_LABEL[site_id],
                "rmse_nwm": _fmt(record["baseline"]["rmse"], 2),
                "rmse_hydra": _fmt(record["corrected"]["rmse"], 2),
                "rmse_improvement_pct": _fmt(record["rmse_improvement_pct"], 1),
                "nse_nwm": _fmt(record["baseline"]["nse"], 3),
                "nse_hydra": _fmt(record["corrected"]["nse"], 3),
                "kge_nwm": _fmt(record["baseline"]["kge"], 3),
                "kge_hydra": _fmt(record["corrected"]["kge"], 3),
                "pbias_nwm": _fmt(record["baseline"]["pbias"], 2),
                "pbias_hydra": _fmt(record["corrected"]["pbias"], 2),
            }
        )
    return rows


def _build_input_ablation_table(indexed: dict[tuple[str, str], dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for site_id in UNREGULATED_SITES:
        op = _require(indexed, ABLATION_EXP, site_id)
        usgs_era5 = _require(indexed, "hydra_v3_usgs_era5", site_id)
        full = _require(indexed, PRIMARY_EXP, site_id)
        rows.append(
            {
                "site_id": site_id,
                "site_name": SITE_LABEL[site_id],
                "nwm_era5_rmse": _fmt(op["corrected"]["rmse"], 2),
                "nwm_era5_gain_pct": _fmt(op["rmse_improvement_pct"], 1),
                "usgs_era5_rmse": _fmt(usgs_era5["corrected"]["rmse"], 2),
                "usgs_era5_gain_pct": _fmt(usgs_era5["rmse_improvement_pct"], 1),
                "usgs_nwm_era5_rmse": _fmt(full["corrected"]["rmse"], 2),
                "usgs_nwm_era5_gain_pct": _fmt(full["rmse_improvement_pct"], 1),
                "delta_remove_nwm_pct_pts": _fmt(full["rmse_improvement_pct"] - usgs_era5["rmse_improvement_pct"], 1),
            }
        )
    return rows


def _build_architecture_table(indexed: dict[tuple[str, str], dict[str, Any]]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for site_id in UNREGULATED_SITES:
        for experiment in ARCH_EXPS:
            record = _require(indexed, experiment, site_id)
            rows.append(
                {
                    "site_id": site_id,
                    "site_name": SITE_LABEL[site_id],
                    "experiment": experiment,
                    "experiment_label": EXPERIMENT_LABEL.get(experiment, experiment),
                    "rmse_hydra": _fmt(record["corrected"]["rmse"], 2),
                    "rmse_improvement_pct": _fmt(record["rmse_improvement_pct"], 1),
                    "nse_hydra": _fmt(record["corrected"]["nse"], 3),
                    "kge_hydra": _fmt(record["corrected"]["kge"], 3),
                    "pbias_hydra": _fmt(record["corrected"]["pbias"], 2),
                }
            )
    return rows


def _build_significance_table(rigorous: dict[str, Any]) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for experiment in [PRIMARY_EXP, ABLATION_EXP]:
        exp_data = rigorous["results"].get(experiment, {})
        for site_id in UNREGULATED_SITES:
            site_data = exp_data.get(site_id, {})
            full = site_data.get("full_period", {})
            headline = full.get("headline", {})
            ss_rmse = headline.get("ss_rmse", {})
            delta_nse = headline.get("delta_nse", {})
            dm = full.get("significance", {}).get("dm_test", {})
            rows.append(
                {
                    "experiment": experiment,
                    "experiment_label": EXPERIMENT_LABEL.get(experiment, experiment),
                    "site_id": site_id,
                    "site_name": SITE_LABEL[site_id],
                    "ss_rmse": _fmt(float(ss_rmse.get("value", 0.0)), 4),
                    "ss_rmse_ci_lo": _fmt(float((ss_rmse.get("ci") or [0.0, 0.0])[0]), 4),
                    "ss_rmse_ci_hi": _fmt(float((ss_rmse.get("ci") or [0.0, 0.0])[1]), 4),
                    "delta_nse": _fmt(float(delta_nse.get("value", 0.0)), 4),
                    "delta_nse_ci_lo": _fmt(float((delta_nse.get("ci") or [0.0, 0.0])[0]), 4),
                    "delta_nse_ci_hi": _fmt(float((delta_nse.get("ci") or [0.0, 0.0])[1]), 4),
                    "dm_statistic": _fmt(float(dm.get("dm_statistic", 0.0)), 4),
                    "dm_p_value": _fmt_p_value(dm.get("p_value", "")),
                    "dm_significant_005": str(_boolish(dm.get("significant_005"))),
                    "dm_significant_001": str(_boolish(dm.get("significant_001"))),
                }
            )
    return rows


def _load_site_metadata(root: Path) -> dict[str, dict[str, Any]]:
    sys.path.insert(0, str(root))
    from configs.master_study_sites import MASTER_STUDY_SITES  # type: ignore

    return MASTER_STUDY_SITES


def _extract_arg_value_from_suite(text: str, variable_name: str, flag: str, default: str) -> str:
    pattern = rf'{variable_name}="([^"]+)"'
    match = re.search(pattern, text)
    if not match:
        return default
    tokens = shlex.split(match.group(1))
    for idx, token in enumerate(tokens):
        if token == f"--{flag}" and idx + 1 < len(tokens):
            return tokens[idx + 1]
    return default


def _extract_default_from_training(text: str, flag: str, default: str) -> str:
    target = f'"--{flag}"'
    for line in text.splitlines():
        if target in line and "default=" in line:
            match = re.search(r"default=([^,\)]+)", line)
            if match:
                return match.group(1).strip().strip('"').strip("'")
    return default


def _build_methods_tables(root: Path) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], dict[str, str]]:
    sites = _load_site_metadata(root)

    site_rows: list[dict[str, Any]] = []
    for sid in SITE_ORDER:
        info = sites[sid]
        site_rows.append(
            {
                "site_id": sid,
                "site_name": info["name"],
                "watershed": info["watershed"],
                "regulated": "Yes" if bool(info.get("regulated_flag")) else "No",
                "nwm_comid": str(info["nwm_comid"]),
                "lat": _fmt(float(info["lat"]), 4),
                "lon": _fmt(float(info["lon"]), 4),
            }
        )

    split_cfg = _load_json(root / "configs/train_val_test.json")
    split_rows = [
        {"period": "Train", "start": split_cfg["train"]["start"], "end": split_cfg["train"]["end"]},
        {"period": "Validation", "start": split_cfg["val"]["start"], "end": split_cfg["val"]["end"]},
        {"period": "Test", "start": split_cfg["test"]["start"], "end": split_cfg["test"]["end"]},
    ]

    suite_text = (root / "scripts/experiments/run_v3_experiment_suite.sh").read_text()
    training_text = (root / "modeling/training/train_quick_transformer_torch.py").read_text()

    epochs = _extract_arg_value_from_suite(suite_text, "COMMON_ARGS", "epochs", "40")
    batch_size = _extract_arg_value_from_suite(suite_text, "COMMON_ARGS", "batch-size", "64")
    model_arch = _extract_arg_value_from_suite(suite_text, "COMMON_ARGS", "model-arch", "hydra_v3")
    seq_len = _extract_default_from_training(training_text, "seq-len", "168")
    d_model = _extract_default_from_training(training_text, "d-model", "128")
    num_heads = _extract_default_from_training(training_text, "num-heads", "4")
    num_layers = _extract_default_from_training(training_text, "num-layers", "4")
    lr = _extract_default_from_training(training_text, "lr", "5e-4")
    patience = _extract_default_from_training(training_text, "patience", "5")

    train_rows = [
        {"parameter": "Model architecture", "value": model_arch},
        {"parameter": "Max epochs", "value": epochs},
        {"parameter": "Batch size", "value": batch_size},
        {"parameter": "Sequence length (hours)", "value": seq_len},
        {"parameter": "Transformer hidden size (d_model)", "value": d_model},
        {"parameter": "Attention heads", "value": num_heads},
        {"parameter": "Transformer layers", "value": num_layers},
        {"parameter": "Learning rate (default)", "value": lr},
        {"parameter": "Early stopping patience", "value": patience},
    ]

    method_locks = {
        "train_start": split_cfg["train"]["start"],
        "train_end": split_cfg["train"]["end"],
        "val_start": split_cfg["val"]["start"],
        "val_end": split_cfg["val"]["end"],
        "test_start": split_cfg["test"]["start"],
        "test_end": split_cfg["test"]["end"],
        "epochs": epochs,
        "batch_size": batch_size,
        "seq_len": seq_len,
        "d_model": d_model,
        "num_heads": num_heads,
        "num_layers": num_layers,
        "lr": lr,
        "patience": patience,
        "model_arch": model_arch,
    }

    return site_rows, split_rows, train_rows, method_locks


def _write_locked_values_tex(
    path: Path,
    indexed: dict[tuple[str, str], dict[str, Any]],
    rigorous: dict[str, Any],
    method_locks: dict[str, str],
) -> None:
    primary = [_require(indexed, PRIMARY_EXP, s) for s in UNREGULATED_SITES]
    ablation = [_require(indexed, ABLATION_EXP, s) for s in UNREGULATED_SITES]
    usgs_era5 = [_require(indexed, "hydra_v3_usgs_era5", s) for s in UNREGULATED_SITES]

    primary_gains = [r["rmse_improvement_pct"] for r in primary]
    ablation_gains = [r["rmse_improvement_pct"] for r in ablation]
    delta_remove_nwm = [p["rmse_improvement_pct"] - u["rmse_improvement_pct"] for p, u in zip(primary, usgs_era5)]

    primary_cross = rigorous["cross_site"][PRIMARY_EXP]
    ablation_cross = rigorous["cross_site"][ABLATION_EXP]

    site_to_record = {r["site_id"]: r for r in primary}
    jeff = site_to_record["03161000"]
    galax = site_to_record["03164000"]
    sugar = site_to_record["03479000"]

    lines = [
        "% Auto-generated by scripts/manuscript/build_vnext_lock_artifacts.py",
        f"% Generated at {datetime.now(timezone.utc).isoformat()}",
        "\\newcommand{\\LockPrimaryExpId}{" + _latex_escape(PRIMARY_EXP) + "}",
        "\\newcommand{\\LockAblationExpId}{" + _latex_escape(ABLATION_EXP) + "}",
        "\\newcommand{\\LockPrimaryRMSEMinPct}{" + _fmt(min(primary_gains), 1) + "}",
        "\\newcommand{\\LockPrimaryRMSEMaxPct}{" + _fmt(max(primary_gains), 1) + "}",
        "\\newcommand{\\LockAblationRMSEMinPct}{" + _fmt(min(ablation_gains), 1) + "}",
        "\\newcommand{\\LockAblationRMSEMaxPct}{" + _fmt(max(ablation_gains), 1) + "}",
        "\\newcommand{\\LockRemoveNWMDeltaMinPts}{" + _fmt(min(delta_remove_nwm), 1) + "}",
        "\\newcommand{\\LockRemoveNWMDeltaMaxPts}{" + _fmt(max(delta_remove_nwm), 1) + "}",
        "\\newcommand{\\LockJeffersonRMSEGainPct}{" + _fmt(jeff["rmse_improvement_pct"], 1) + "}",
        "\\newcommand{\\LockGalaxRMSEGainPct}{" + _fmt(galax["rmse_improvement_pct"], 1) + "}",
        "\\newcommand{\\LockSugarRMSEGainPct}{" + _fmt(sugar["rmse_improvement_pct"], 1) + "}",
        "\\newcommand{\\LockJeffersonNSEHydra}{" + _fmt(jeff["corrected"]["nse"], 3) + "}",
        "\\newcommand{\\LockGalaxNSEHydra}{" + _fmt(galax["corrected"]["nse"], 3) + "}",
        "\\newcommand{\\LockSugarNSEHydra}{" + _fmt(sugar["corrected"]["nse"], 3) + "}",
        "\\newcommand{\\LockPrimaryMedianSSRMSE}{" + _fmt(float(primary_cross["median_ss_rmse"]), 4) + "}",
        "\\newcommand{\\LockPrimaryMedianDeltaNSE}{" + _fmt(float(primary_cross["median_delta_nse"]), 4) + "}",
        "\\newcommand{\\LockAblationMedianSSRMSE}{" + _fmt(float(ablation_cross["median_ss_rmse"]), 4) + "}",
        "\\newcommand{\\LockAblationMedianDeltaNSE}{" + _fmt(float(ablation_cross["median_delta_nse"]), 4) + "}",
        "\\newcommand{\\LockPrimarySigSitesPZeroZeroFive}{" + str(int(primary_cross["sites_significant_005"])) + "}",
        "\\newcommand{\\LockPrimarySigSitesPZeroZeroOne}{" + str(int(primary_cross["sites_significant_001"])) + "}",
        "\\newcommand{\\LockAblationSigSitesPZeroZeroFive}{" + str(int(ablation_cross["sites_significant_005"])) + "}",
        "\\newcommand{\\LockAblationSigSitesPZeroZeroOne}{" + str(int(ablation_cross["sites_significant_001"])) + "}",
        "\\newcommand{\\LockUnregulatedSiteCount}{" + str(len(UNREGULATED_SITES)) + "}",
        "\\newcommand{\\LockTrainStartDate}{" + _latex_escape(method_locks["train_start"]) + "}",
        "\\newcommand{\\LockTrainEndDate}{" + _latex_escape(method_locks["train_end"]) + "}",
        "\\newcommand{\\LockValStartDate}{" + _latex_escape(method_locks["val_start"]) + "}",
        "\\newcommand{\\LockValEndDate}{" + _latex_escape(method_locks["val_end"]) + "}",
        "\\newcommand{\\LockTestStartDate}{" + _latex_escape(method_locks["test_start"]) + "}",
        "\\newcommand{\\LockTestEndDate}{" + _latex_escape(method_locks["test_end"]) + "}",
        "\\newcommand{\\LockMaxEpochs}{" + _latex_escape(method_locks["epochs"]) + "}",
        "\\newcommand{\\LockBatchSize}{" + _latex_escape(method_locks["batch_size"]) + "}",
        "\\newcommand{\\LockSeqLenHours}{" + _latex_escape(method_locks["seq_len"]) + "}",
        "\\newcommand{\\LockDModel}{" + _latex_escape(method_locks["d_model"]) + "}",
        "\\newcommand{\\LockNumHeads}{" + _latex_escape(method_locks["num_heads"]) + "}",
        "\\newcommand{\\LockNumLayers}{" + _latex_escape(method_locks["num_layers"]) + "}",
        "\\newcommand{\\LockLearningRate}{" + _latex_escape(method_locks["lr"]) + "}",
        "\\newcommand{\\LockPatience}{" + _latex_escape(method_locks["patience"]) + "}",
        "\\newcommand{\\LockModelArch}{" + _latex_escape(method_locks["model_arch"]) + "}",
    ]
    _write_text(path, "\n".join(lines) + "\n")


def _build_figure_lock(path: Path, root: Path) -> None:
    rows: list[dict[str, Any]] = []
    for spec in FIGURE_SPECS:
        figure_path = root / spec.path
        exists = figure_path.exists()
        rows.append(
            {
                "figure_id": spec.figure_id,
                "path": spec.path,
                "exists": exists,
                "size_bytes": figure_path.stat().st_size if exists else "",
                "sha256": _sha256(figure_path) if exists else "",
                "narrative_role": spec.narrative_role,
                "source_command": spec.source_command,
            }
        )
    _write_csv(
        path,
        ["figure_id", "path", "exists", "size_bytes", "sha256", "narrative_role", "source_command"],
        rows,
    )


def _write_primary_results_table_tex(csv_path: Path, out_path: Path) -> None:
    rows = _read_csv(csv_path)
    lines = [
        "\\begin{table}",
        "\\centering",
        "\\caption{Primary gauge-informed correction performance (Hydra v3 with lagged USGS + NWM + ERA5) on the test period.}",
        "\\small",
        "\\begin{tabular}{l rr r rr rr rr}",
        "\\toprule",
        "\\textbf{Site} & \\multicolumn{2}{c}{\\textbf{RMSE}} & \\textbf{$\\Delta$RMSE} & \\multicolumn{2}{c}{\\textbf{NSE}} & \\multicolumn{2}{c}{\\textbf{KGE}} & \\multicolumn{2}{c}{\\textbf{PBIAS (\\%)}} \\\\",
        "\\cmidrule(lr){2-3}\\cmidrule(lr){5-6}\\cmidrule(lr){7-8}\\cmidrule(lr){9-10}",
        " & NWM & Hydra & & NWM & Hydra & NWM & Hydra & NWM & Hydra \\\\",
        "\\midrule",
    ]
    for r in rows:
        lines.append(
            f"{_latex_escape(r['site_name'])} & {r['rmse_nwm']} & \\textbf{{{r['rmse_hydra']}}} & "
            f"\\textbf{{{r['rmse_improvement_pct']}\\%}} & {r['nse_nwm']} & {r['nse_hydra']} & "
            f"{r['kge_nwm']} & {r['kge_hydra']} & {r['pbias_nwm']} & {r['pbias_hydra']} \\\\"
        )
    lines.extend(["\\bottomrule", "\\end{tabular}", "\\label{tab:primary_results}", "\\end{table}", ""])
    _write_text(out_path, "\n".join(lines))


def _write_input_ablation_table_tex(csv_path: Path, out_path: Path) -> None:
    rows = _read_csv(csv_path)
    lines = [
        "\\begin{table}",
        "\\centering",
        "\\caption{Input ablation using locked experiment outputs. The gauge-free surrogate (NWM+ERA5) is the lower-bound configuration; USGS+ERA5 removes NWM from the gauge-informed feature set.}",
        "\\small",
        "\\begin{tabular}{l cc cc cc}",
        "\\toprule",
        "\\textbf{Site} & \\multicolumn{2}{c}{\\textbf{Gauge-free surrogate}} & \\multicolumn{2}{c}{\\textbf{USGS+ERA5}} & \\multicolumn{2}{c}{\\textbf{USGS+NWM+ERA5}} \\\\",
        "\\cmidrule(lr){2-3}\\cmidrule(lr){4-5}\\cmidrule(lr){6-7}",
        " & RMSE & $\\Delta$RMSE & RMSE & $\\Delta$RMSE & RMSE & $\\Delta$RMSE \\\\",
        "\\midrule",
    ]
    for r in rows:
        lines.append(
            f"{_latex_escape(r['site_name'])} & {r['nwm_era5_rmse']} & {r['nwm_era5_gain_pct']}\\% & "
            f"{r['usgs_era5_rmse']} & {r['usgs_era5_gain_pct']}\\% & "
            f"\\textbf{{{r['usgs_nwm_era5_rmse']}}} & \\textbf{{{r['usgs_nwm_era5_gain_pct']}\\%}} \\\\"
        )
    lines.extend(["\\bottomrule", "\\end{tabular}", "\\label{tab:input_ablation}", "\\end{table}", ""])
    _write_text(out_path, "\n".join(lines))


def _write_ablation_architecture_table_tex(csv_path: Path, out_path: Path) -> None:
    rows = _read_csv(csv_path)
    lines = [
        "\\begin{table}",
        "\\centering",
        "\\caption{Architecture sensitivity for the gauge-free surrogate (NWM+ERA5 only) from locked outputs.}",
        "\\small",
        "\\begin{tabular}{ll r r r r r}",
        "\\toprule",
        "\\textbf{Site} & \\textbf{Configuration} & \\textbf{RMSE} & \\textbf{$\\Delta$RMSE (\\%)} & \\textbf{NSE} & \\textbf{KGE} & \\textbf{PBIAS} \\\\",
        "\\midrule",
    ]
    for r in rows:
        lines.append(
            f"{_latex_escape(r['site_name'])} & {_latex_escape(r['experiment_label'])} & {r['rmse_hydra']} & "
            f"{r['rmse_improvement_pct']} & {r['nse_hydra']} & {r['kge_hydra']} & {r['pbias_hydra']} \\\\"
        )
    lines.extend(["\\bottomrule", "\\end{tabular}", "\\label{tab:ablation_arch}", "\\end{table}", ""])
    _write_text(out_path, "\n".join(lines))


def _write_significance_table_tex(csv_path: Path, out_path: Path) -> None:
    rows = _read_csv(csv_path)
    lines = [
        "\\begin{table}",
        "\\centering",
        "\\caption{Skill and significance from rigorous evaluation (moving-block bootstrap and Diebold--Mariano test).}",
        "\\small",
        "\\begin{tabular}{ll l l l}",
        "\\toprule",
        "\\textbf{Mode} & \\textbf{Site} & \\textbf{SS$_{RMSE}$ [95\\% CI]} & \\textbf{$\\Delta$NSE [95\\% CI]} & \\textbf{DM p-value} \\\\",
        "\\midrule",
    ]
    for r in rows:
        mode = "Gauge-informed correction" if r["experiment"] == PRIMARY_EXP else "Gauge-free surrogate"
        ss = f"{r['ss_rmse']} [{r['ss_rmse_ci_lo']}, {r['ss_rmse_ci_hi']}]"
        dn = f"{r['delta_nse']} [{r['delta_nse_ci_lo']}, {r['delta_nse_ci_hi']}]"
        lines.append(f"{mode} & {_latex_escape(r['site_name'])} & {ss} & {dn} & {r['dm_p_value']} \\\\")
    lines.extend(["\\bottomrule", "\\end{tabular}", "\\label{tab:significance}", "\\end{table}", ""])
    _write_text(out_path, "\n".join(lines))


def _write_sites_table_tex(csv_path: Path, out_path: Path) -> None:
    rows = _read_csv(csv_path)
    lines = [
        "\\begin{table}",
        "\\centering",
        "\\caption{Study gauges and watershed/regulation metadata from locked site configuration.}",
        "\\small",
        "\\begin{tabular}{lllcc}",
        "\\toprule",
        "\\textbf{USGS ID} & \\textbf{Station Name} & \\textbf{Watershed} & \\textbf{Regulated} & \\textbf{COMID} \\\\",
        "\\midrule",
    ]
    for r in rows:
        lines.append(
            f"{r['site_id']} & {_latex_escape(r['site_name'])} & {_latex_escape(r['watershed'])} & "
            f"{r['regulated']} & {r['nwm_comid']} \\\\"
        )
    lines.extend(["\\bottomrule", "\\end{tabular}", "\\label{tab:sites}", "\\end{table}", ""])
    _write_text(out_path, "\n".join(lines))


def _write_split_table_tex(csv_path: Path, out_path: Path) -> None:
    rows = _read_csv(csv_path)
    lines = [
        "\\begin{table}",
        "\\centering",
        "\\caption{Chronological split definition used for all locked experiments.}",
        "\\small",
        "\\begin{tabular}{lcc}",
        "\\toprule",
        "\\textbf{Period} & \\textbf{Start} & \\textbf{End} \\\\",
        "\\midrule",
    ]
    for r in rows:
        lines.append(f"{r['period']} & {r['start']} & {r['end']} \\\\")
    lines.extend(["\\bottomrule", "\\end{tabular}", "\\label{tab:split}", "\\end{table}", ""])
    _write_text(out_path, "\n".join(lines))


def _write_training_config_table_tex(csv_path: Path, out_path: Path) -> None:
    rows = _read_csv(csv_path)
    lines = [
        "\\begin{table}",
        "\\centering",
        "\\caption{Locked training configuration for the v3 experiment suite.}",
        "\\small",
        "\\begin{tabular}{ll}",
        "\\toprule",
        "\\textbf{Parameter} & \\textbf{Value} \\\\",
        "\\midrule",
    ]
    for r in rows:
        lines.append(f"{_latex_escape(r['parameter'])} & {_latex_escape(r['value'])} \\\\")
    lines.extend(["\\bottomrule", "\\end{tabular}", "\\label{tab:training_config}", "\\end{table}", ""])
    _write_text(out_path, "\n".join(lines))


def _write_summary(path: Path, generated: list[str]) -> None:
    lines = [
        "# vNext Lock Artifacts",
        "",
        f"Generated: {datetime.now(timezone.utc).isoformat()}",
        "",
        "Artifacts:",
    ]
    for item in generated:
        lines.append(f"- {item}")
    lines.extend(
        [
            "",
            "Canonical numeric sources:",
            "- results/experiment_results.json",
            "- dashboard/public/data/rigorous_eval.json",
            "- configs/train_val_test.json",
            "- configs/master_study_sites.py",
            "- scripts/experiments/run_v3_experiment_suite.sh",
            "- modeling/training/train_quick_transformer_torch.py",
            "",
        ]
    )
    _write_text(path, "\n".join(lines))


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    out_dir = root / "docs/manuscript/locks"
    out_dir.mkdir(parents=True, exist_ok=True)

    experiments = _load_json(root / "results/experiment_results.json")
    rigorous = _load_json(root / "dashboard/public/data/rigorous_eval.json")
    indexed = _index_results(experiments)

    primary_rows = _build_primary_table(indexed)
    ablation_rows = _build_input_ablation_table(indexed)
    architecture_rows = _build_architecture_table(indexed)
    significance_rows = _build_significance_table(rigorous)
    site_rows, split_rows, train_rows, method_locks = _build_methods_tables(root)

    generated: list[str] = []

    # CSV locks
    primary_csv = out_dir / "table_primary_results.csv"
    _write_csv(primary_csv, list(primary_rows[0].keys()), primary_rows)
    generated.append(str(primary_csv.relative_to(root)))

    ablation_csv = out_dir / "table_input_ablation.csv"
    _write_csv(ablation_csv, list(ablation_rows[0].keys()), ablation_rows)
    generated.append(str(ablation_csv.relative_to(root)))

    architecture_csv = out_dir / "table_ablation_architecture.csv"
    _write_csv(architecture_csv, list(architecture_rows[0].keys()), architecture_rows)
    generated.append(str(architecture_csv.relative_to(root)))

    significance_csv = out_dir / "table_significance.csv"
    _write_csv(significance_csv, list(significance_rows[0].keys()), significance_rows)
    generated.append(str(significance_csv.relative_to(root)))

    sites_csv = out_dir / "table_sites.csv"
    _write_csv(sites_csv, list(site_rows[0].keys()), site_rows)
    generated.append(str(sites_csv.relative_to(root)))

    split_csv = out_dir / "table_temporal_split.csv"
    _write_csv(split_csv, list(split_rows[0].keys()), split_rows)
    generated.append(str(split_csv.relative_to(root)))

    training_csv = out_dir / "table_training_config.csv"
    _write_csv(training_csv, list(train_rows[0].keys()), train_rows)
    generated.append(str(training_csv.relative_to(root)))

    # Macros
    locked_values = out_dir / "locked_values.tex"
    _write_locked_values_tex(locked_values, indexed, rigorous, method_locks)
    generated.append(str(locked_values.relative_to(root)))

    # Figure lock
    figure_lock = out_dir / "figure_lock.csv"
    _build_figure_lock(figure_lock, root)
    generated.append(str(figure_lock.relative_to(root)))

    # TeX tables generated from lock CSVs
    primary_tex = out_dir / "table_primary_results.tex"
    _write_primary_results_table_tex(primary_csv, primary_tex)
    generated.append(str(primary_tex.relative_to(root)))

    ablation_tex = out_dir / "table_input_ablation.tex"
    _write_input_ablation_table_tex(ablation_csv, ablation_tex)
    generated.append(str(ablation_tex.relative_to(root)))

    arch_tex = out_dir / "table_ablation_architecture.tex"
    _write_ablation_architecture_table_tex(architecture_csv, arch_tex)
    generated.append(str(arch_tex.relative_to(root)))

    sig_tex = out_dir / "table_significance.tex"
    _write_significance_table_tex(significance_csv, sig_tex)
    generated.append(str(sig_tex.relative_to(root)))

    sites_tex = out_dir / "table_sites.tex"
    _write_sites_table_tex(sites_csv, sites_tex)
    generated.append(str(sites_tex.relative_to(root)))

    split_tex = out_dir / "table_temporal_split.tex"
    _write_split_table_tex(split_csv, split_tex)
    generated.append(str(split_tex.relative_to(root)))

    training_tex = out_dir / "table_training_config.tex"
    _write_training_config_table_tex(training_csv, training_tex)
    generated.append(str(training_tex.relative_to(root)))

    summary_md = out_dir / "LOCK_SUMMARY.md"
    _write_summary(summary_md, generated)
    generated.append(str(summary_md.relative_to(root)))

    print("Generated lock artifacts:")
    for item in generated:
        print(f" - {item}")


if __name__ == "__main__":
    main()
