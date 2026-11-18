"""Generate the Hydra research site from the campaign's held-out year evaluation.

    python3 -B build_site.py <path to the hydra-campaign checkout> [--preview]

--preview marks the page as a draft for the authors' review (a banner and a no-index tag).

Reads evidence/evaluation-20261115/results.json and posthoc.json there and writes site/ (index.html,
data.json, files/). Standard library only. No number on the site is typed by hand: charts, tables and the
figures quoted in sentences are all computed here from those two files, whose hashes are recorded on the
page. results.json is the frozen analysis; posthoc.json holds the descriptive numbers added after the
independent review of the findings. The networks refit on the whole first year are the headline, as the
evaluation plan fixes; the models chosen on validation are the comparison. The wording follows the
reviewed findings, and a sentence that the numbers no longer support stops the build. Aggregates only;
nothing per forecast case is read.
"""
from datetime import datetime, timezone
import hashlib
import html
import json
import math
from pathlib import Path
import shutil
import sys

HERE = Path(__file__).resolve().parent
EVALUATION = "evidence/evaluation-20261115"
HEADLINE, COMPARISON = "refit", "existing"
STUDY_REPOSITORY = "https://github.com/Mitchel34/hydra-nwm-streamflow-correction/tree/agu-hrrr-2026"
ARCHITECTURES = (("seq2seq_lstm", "LSTM"), ("hydra_gru_conv", "GRU+Conv"), ("temporal_transformer", "Transformer"))
SITES = (("03161000", "Jefferson"), ("03164000", "Galax"), ("03479000", "Sugar Grove"))
JEFFERSON, GALAX, GROVE = (site for site, _ in SITES)
SEEDS = ("1729", "1730", "1731")
REMOVALS = (("no_usgs", "Gauge history"), ("no_nwm_predictor", "NWM as input"), ("no_hrrr", "All HRRR inputs"),
            ("no_soil", "Soil moisture"), ("no_precipitation", "Precipitation"), ("no_temperature", "Temperature"),
            ("no_humidity", "Humidity"), ("no_snow", "Snow"))
SIMPLE = (("mean_residual_per_lead", "Mean error per lead"), ("affine_ols_per_lead", "Linear regression on NWM"),
          ("observed_flow_persistence", "Persistence"))
MEAN_ERROR, REGRESSION, PERSISTENCE = (method for method, _ in SIMPLE)
METRICS = (("rmse", "RMSE (m³/s)", "lower"), ("mae", "Mean absolute error (m³/s)", "lower"), ("kge", "KGE", "higher"),
           ("nse", "NSE", "higher"), ("r", "Pearson r", "higher"))
BLOCK_LENGTHS = ("7", "3", "14", "28")
SPLITS = (("nwm_version", "NWM version"), ("quarter", "Quarter"), ("flow_by_nwm_forecast", "Flow level by the NWM forecast"))
MINUS = "−"
esc = html.escape


def pct(values, digits=0):
    """'36–42%' for same-signed fractions, smallest size first; one figure where both ends round alike."""
    values = list(values)
    if min(values) * max(values) <= 0:
        raise ValueError(f"values do not share a sign: {values}")
    sizes = sorted(abs(100 * value) for value in values)
    low, high = f"{sizes[0]:.{digits}f}", f"{sizes[-1]:.{digits}f}"
    return f"{low}%" if low == high else f"{low}–{high}%"


def signed(fraction, digits=1):
    """'+16.2%' or '−41.2%'; the sign is the value's own even where it rounds to zero."""
    return f"{'+' if fraction > 0 else MINUS if fraction < 0 else ''}{abs(100 * fraction):.{digits}f}%"


def interval(entry, digits=1):
    """'−41.2% [−67.8%, −29.7%]'; the estimate alone where the analysis gives no interval."""
    if entry.get("low") is None:
        return signed(entry["estimate"], digits)
    return f"{signed(entry['estimate'], digits)} [{signed(entry['low'], digits)}, {signed(entry['high'], digits)}]"


def side(entry):
    """Which side of zero a nominal interval lies on: 'below', 'above', 'spans' or None without an interval."""
    if entry.get("low") is None:
        return None
    return "below" if entry["high"] < 0 else "above" if entry["low"] > 0 else "spans"


def hours(leads):
    """The last hour of a run of leads that starts at 1 h; anything else stops the build."""
    if leads != list(range(1, len(leads) + 1)):
        raise ValueError(f"leads are not a run from the first hour: {leads}")
    return len(leads)


def spread(values, unit=" h"):
    low, high = min(values), max(values)
    return f"{low}{unit}" if low == high else f"{low} to {high}{unit}"


def require(condition, sentence):
    if not condition:
        raise SystemExit(f"the results no longer support this sentence: {sentence}")


def collect(campaign):
    source = campaign / EVALUATION
    results = json.loads((source / "results.json").read_text())
    if results["role"] != "evaluation" or not results["is_result"] or results["headline_set"] != HEADLINE:
        raise SystemExit("the evidence is not the held-out year result with the refit models as the headline")
    tables = results["tables"]
    head, other = tables[HEADLINE], tables[COMPARISON]
    seven = lambda comparison: comparison["7"]["pooled_relative_mse_change"]                                  # noqa: E731
    against_nwm = lambda set_, a, s: set_["model_against_nwm"][a][s]["model_worse_than_nwm"]                # noqa: E731
    against = lambda a, s, m: head["model_against_simple_corrections"][a][s]["model_worse_than_correction"][m]   # noqa: E731
    names = dict(SITES)
    data = {"architectures": [n for _, n in ARCHITECTURES], "sites": [n for _, n in SITES], "seeds": list(SEEDS),
            "removals": [n for _, n in REMOVALS], "metrics": [{"key": k, "label": label, "better": better} for k, label, better in METRICS],
            "headline_set": HEADLINE, "freeze_commit": results["opening"]["freeze_commit"], "opened_at_utc": results["opening"]["opened_at_utc"],
            "source_sha256": {"results.json": hashlib.sha256((source / "results.json").read_bytes()).hexdigest()}}
    crosscheck = json.loads((source / "crosscheck.json").read_text())
    if crosscheck["results_sha256"] != data["source_sha256"]["results.json"] or crosscheck["disagreements"] != 0:
        raise SystemExit("the independent recomputation does not belong to these results, or it disagrees with them")
    data["crosscheck"] = {"numbers_compared": crosscheck["numbers_compared"], "disagreements": crosscheck["disagreements"]}
    posthoc_path = source / "posthoc.json"
    posthoc = json.loads(posthoc_path.read_text())
    data["source_sha256"]["posthoc.json"] = hashlib.sha256(posthoc_path.read_bytes()).hexdigest()
    if posthoc["results_sha256"] != data["source_sha256"]["results.json"]:
        raise SystemExit("posthoc.json does not belong to these results")
    selected, looked = posthoc["from_results"], posthoc["from_scored_values"]
    data["by_lead_against_nwm"] = {key: {"cells_better_of_90": row["better_than_nwm_cells_of_90"]["all"],
                                         **{metric: {name: row[metric][name] for name in ("network", "nwm", "difference_m3s", "relative_to_nwm")}
                                            | {"leads_worse": len(row[metric]["leads_worse_than_nwm"]), "leads_above_zero": row[metric]["leads_interval_above_zero"],
                                               "leads_below_zero": len(row[metric]["leads_interval_below_zero"]),
                                               "seeds_worse_at_every_lead": sum(seed["leads_worse_than_nwm"] == 18 for seed in row[metric]["per_seed_relative_to_nwm"].values())}
                                            for metric in ("mae", "rmse")}}
                                   for key, row in selected["networks_against_nwm_by_lead"].items()}
    data["refit_detail"], data["persistence_detail"], data["removal_detail"] = selected["refit_against_existing"], selected["persistence"], selected["input_removal"]
    data["existing_by_version"] = selected["existing_against_nwm_by_version"]
    data["effective_weeks_before_v22"] = selected["effective_blocks_before_v2.2"]
    data["interval_coverage_by_gauge"] = selected["interval_coverage_7_day"]
    data["week"] = {"shares": looked["week_from_2022_11_08_shares"], "jefferson": looked["jefferson_week_from_2022_11_08"],
                    "replicates_without_it": selected["share_of_replicates_without_one_given_block"]}
    data["negative_forecasts"], data["days_without_a_forecast"] = looked["negative_forecasts"], looked["days_without_a_forecast"]

    data["by_lead"] = {}
    for site, site_name in SITES:
        simple = head["simple_corrections"][site]
        per_metric = {}
        for metric, _, _ in METRICS:
            series = {"NWM": simple["nwm"][metric]}
            for method, name in SIMPLE:
                series[name] = simple["methods"][method]["scorecard"][metric]
            for architecture, name in ARCHITECTURES:
                series[name] = head["model_against_nwm"][architecture][site]["seed_mean"][metric]
            per_metric[metric] = series
        data["by_lead"][site_name] = per_metric

    claim_of = {JEFFERSON: "C1", GALAX: "C2", GROVE: "C3"}
    data["skill"], data["against_nwm"] = [], {}
    for site, site_name in SITES:
        row = {"site": site_name, "networks": {}, "simple": {}}
        for architecture, name in ARCHITECTURES:
            entry = head["model_against_nwm"][architecture][site]
            ratios = [entry["per_seed"][seed]["skill_ratio"] for seed in SEEDS]
            row["networks"][name] = {"mean": entry["seed_mean"]["skill_ratio"], "per_seed": ratios}
            comparison = against_nwm(head, architecture, site)
            influence = comparison["7"]["influence"]
            data["against_nwm"][f"{name} / {site_name}"] = {
                **{key: seven(comparison)[key] for key in ("estimate", "low", "high")},
                "sides": {length: side(comparison[length]["pooled_relative_mse_change"]) for length in BLOCK_LENGTHS},
                "without_a_week": [influence["pooled_relative_mse_change_leaving_one_block_out"][end] for end in ("low", "high")],
                "largest_week": influence["largest_block_of_second"], "effective_weeks_nwm": influence["effective_blocks_second"],
                "weeks": comparison["7"]["blocks"],
                "validation_estimate": head["claims"][claim_of[site]]["rows"][architecture]["validation_estimate"],
                # fsum and sqrt are correctly rounded, so the value does not depend on the Python version (sum() changed in 3.12).
                "rmse_term": math.fsum(math.sqrt(value) for value in ratios) / len(ratios) - 1,
                "existing": {key: seven(against_nwm(other, architecture, site))[key] for key in ("estimate", "low", "high")}}
        for method, name in SIMPLE:
            row["simple"][name] = head["simple_corrections"][site]["methods"][method]["skill_ratio"]
        data["skill"].append(row)

    data["against_simple"] = {f"{name} / {site_name}": {label: {key: seven(against(a, site, method))[key] for key in ("estimate", "low", "high")}
                                                           for method, label in SIMPLE}
                              for site, site_name in SITES for a, name in ARCHITECTURES}

    data["persistence"] = []
    for site, site_name in SITES:
        better = head["persistence_better_leads"][site]["every_network"]
        first_lead = [head["claims"]["C4"]["rows"][site][a]["estimate"] for a, _ in ARCHITECTURES]
        data["persistence"].append({"site": site_name, **{metric: hours(better[metric]) for metric in ("rmse", "mae", "kge")},
                                    "h1_rmse_difference_m3s": [min(first_lead), max(first_lead)]})

    data["removal"] = {}
    for site, site_name in SITES:
        for architecture, name in ARCHITECTURES:
            rows = []
            for variant, label in REMOVALS:
                entry = head["input_removal"][architecture][site][variant]
                pooled = seven(entry["removed_worse_than_full"])
                without = entry["removed_worse_than_full"]["7"]["influence"]["pooled_relative_mse_change_leaving_one_block_out"]
                effects = [entry["per_seed_removal_effect"][seed] for seed in SEEDS]
                rows.append({"input": label, "per_seed": [100 * value for value in effects], "mean": 100 * pooled["estimate"],
                             "interval": [100 * pooled["low"], 100 * pooled["high"]], "side": side(pooled),
                             "sides": {length: side(entry["removed_worse_than_full"][length]["pooled_relative_mse_change"]) for length in BLOCK_LENGTHS},
                             "without_a_week": [100 * without["low"], 100 * without["high"]],
                             "same_sign": all(value > 0 for value in effects) or all(value < 0 for value in effects),
                             "cap_limited_seeds": entry["cap_limited_seeds"]["removed"]})
            data["removal"][f"{name} / {site_name}"] = rows
    effects = [value for rows in data["removal"].values() for row in rows for value in row["per_seed"]]
    data["removal_range"] = [min(effects), max(effects)]

    refit = tables["refit_against_existing"]
    data["refit_against_existing"] = {f"{name} / {site_name}": {key: seven(refit[a][site]["full"]["refit_worse_than_existing"])[key]
                                                                  for key in ("estimate", "low", "high")}
                                      for site, site_name in SITES for a, name in ARCHITECTURES}
    refit_sides = [side(seven(refit[a][site][variant]["refit_worse_than_existing"]))
                   for a, _ in ARCHITECTURES for site, _ in SITES for variant in ("full",) + tuple(v for v, _ in REMOVALS)]
    data["refit_tally"] = {"cells": len(refit_sides), **{name: refit_sides.count(name) for name in ("below", "above", "spans")}}

    beside = tables["validation_beside_evaluation"]
    data["validation_beside"] = []
    for site, site_name in SITES:
        fits = [beside[a][site][seed] for a, _ in ARCHITECTURES for seed in SEEDS]
        ratios = [fit["evaluation_skill_ratio"] / fit["validation_skill_ratio"] for fit in fits]
        data["validation_beside"].append({"site": site_name, "fits": len(fits),
                                          "validation": [min(f["validation_skill_ratio"] for f in fits), max(f["validation_skill_ratio"] for f in fits)],
                                          "held_out": [min(f["evaluation_skill_ratio"] for f in fits), max(f["evaluation_skill_ratio"] for f in fits)],
                                          "held_out_over_validation": [min(ratios), max(ratios)]})

    data["breakdowns"] = []
    for split, split_label in SPLITS:
        strata = list(head["breakdowns"][ARCHITECTURES[0][0]][JEFFERSON]["model_worse_than_nwm"][split])
        for stratum in strata:
            row = {"split": split_label, "stratum": stratum, "gauges": {}}
            for site, site_name in SITES:
                cells = [head["breakdowns"][a][site]["model_worse_than_nwm"][split][stratum] for a, _ in ARCHITECTURES]
                changes = [cell["pooled_relative_mse_change"] for cell in cells]
                row["gauges"][site_name] = {"estimates": [change["estimate"] for change in changes], "sides": [side(change) for change in changes],
                                            "weeks": cells[0]["blocks"], "share_of_scored_cells": cells[0]["share_of_scored_cells"]}
            data["breakdowns"].append(row)

    data["claims"] = []
    for key, claim in head["claims"].items():
        entry = {"claim": key, "statement": claim["statement"]}
        for label, set_ in ((HEADLINE, head), (COMPARISON, other)):
            this = set_["claims"][key]
            entry[label] = ({"cells": this["summary"]["cells"], "by_verdict": this["summary"]["by_verdict"]} if "summary" in this
                            else {name: this["descriptive"][name] for name in ("entries", "intervals_excluding_zero", "intervals_excluding_zero_expected_by_chance",
                                                                               "same_sign_in_all_three_seeds", "same_sign_expected_by_chance", "largest_absolute_effect")})
        data["claims"].append(entry)

    data["counts"] = {label: {name: {"nwm": set_["counts"][a]["against_nwm"]["better"], "simple": set_["counts"][a]["against_every_simple_correction"]["better"],
                                     "cells": set_["counts"][a]["cells_planned"]} for a, name in ARCHITECTURES}
                      for label, set_ in ((HEADLINE, head), (COMPARISON, other))}
    data["coverage"] = [{"site": site_name, **results["coverage"][site]["origins"], "scored_cells": results["coverage"][site]["cells"]["issued_scored"],
                         "weeks": results["scored_cells"][site]["blocks"]["7"]["count"], "passes": results["coverage"][site]["streamed_passes"]}
                        for site, site_name in SITES]
    calibration = results["interval_calibration"]
    data["calibration"] = {"pairs": calibration["pairs_used"], "trials": calibration["trials_per_pair"],
                           "block_lengths": {length: {name: calibration["block_lengths"][length][name]
                                                      for name in ("zero_effect_exclusion_rate", "coverage_of_population_value")} for length in BLOCK_LENGTHS}}

    # ---- Figures quoted in sentences, and the checks that keep those sentences true ----
    nwm = lambda site: [data["against_nwm"][f"{name} / {names[site]}"] for _, name in ARCHITECTURES]          # noqa: E731
    simple = lambda site, label: [data["against_simple"][f"{name} / {names[site]}"][label] for _, name in ARCHITECTURES]   # noqa: E731
    removal = lambda site, label: [next(row for row in data["removal"][f"{name} / {names[site]}"] if row["input"] == label) for _, name in ARCHITECTURES]   # noqa: E731
    week = {site: nwm(site)[0]["largest_week"] for site, _ in SITES}
    week_start = datetime.fromtimestamp(week[JEFFERSON]["first_origin_epoch_s"], timezone.utc)
    opened = datetime.fromisoformat(results["opening"]["opened_at_utc"])
    claims = {entry["claim"]: entry for entry in data["claims"]}
    c9, c10 = claims["C9"][HEADLINE], claims["C10"][HEADLINE]
    for site in (JEFFERSON, GALAX):
        require(all(set(entry["sides"].values()) == {"below"} for entry in nwm(site)), f"{names[site]}: below NWM at all four block lengths")
        require(all(row["side"] == "above" and row["same_sign"] for row in removal(site, "Soil moisture")), f"{names[site]}: removing soil moisture raised squared error")
    require(all(entry["validation_estimate"] < entry["low"] for entry in nwm(JEFFERSON)), "Jefferson: weaker than validation")
    require(all(entry["low"] <= entry["validation_estimate"] <= entry["high"] for entry in nwm(GALAX)), "Galax: validation estimates inside the held-out intervals")
    require(all(-0.1 < entry["low"] and entry["high"] < 0.1 for entry in nwm(GROVE)), "Sugar Grove: every interval within ±10%")
    require(len({entry["first_origin_epoch_s"] for entry in week.values()}) == 1, "one week holds the largest share at every gauge")
    require(all(side(entry) == "spans" for entry in simple(JEFFERSON, "Linear regression on NWM")), "Jefferson: not distinguishable from the regression")
    require(all(side(entry) == "below" for label in ("Persistence", "Mean error per lead") for entry in simple(JEFFERSON, label)), "Jefferson: below persistence and the mean error")
    require(all(side(entry) == "below" for _, label in SIMPLE for entry in simple(GALAX, label)), "Galax: below every simple correction")
    require(all(side(entry) == "below" for entry in simple(GROVE, "Persistence")), "Sugar Grove: below persistence")
    require(data["refit_tally"]["above"] == 0, "no refit interval lies above zero in pooled squared error")
    lead = lambda network, site: data["by_lead_against_nwm"][f"{network} / {names[site]}"]                                      # noqa: E731
    network_names = [name for _, name in ARCHITECTURES]
    worse_everywhere = [name for name in network_names if len(lead(name, GROVE)["mae"]["leads_above_zero"]) == 18 and lead(name, GROVE)["mae"]["seeds_worse_at_every_lead"] == 3]
    require(worse_everywhere == ["Transformer"], "Sugar Grove: one network type is worse than NWM by absolute error at every lead, in every seed")
    below_everywhere = [name for name in network_names if lead(name, JEFFERSON)["mae"]["leads_below_zero"] == 18]
    require(below_everywhere == ["LSTM", "GRU+Conv"], "Jefferson: two network types have lower absolute error than NWM at every lead")
    require(all(1 in lead(name, GALAX)["mae"]["leads_above_zero"] for name in network_names), "Galax: higher absolute error than NWM at 1 h for every network")
    week_j, detail, ahead, removed = data["week"]["jefferson"], data["refit_detail"], data["persistence_detail"], data["removal_detail"]
    fits_in_week = {label: week_j["networks"][label]["single_fits_against_regression_in_week"] for label in (HEADLINE, COMPARISON)}
    require(all(entry["worse"] == entry["fits"] == 9 for entry in fits_in_week.values()), "the regression is better than every fit in the November week")
    require(set(ahead["galax_lstm_by_block_length"]) == set(BLOCK_LENGTHS) and side(ahead["galax_lstm_by_block_length"]["3"]) == "spans", "Galax LSTM: the 3-day interval includes zero")
    require(sum(value > 0 for value in ahead["galax_lstm_per_seed"].values()) == 1, "Galax LSTM: one of three seeds is worse than persistence")
    require(all(side(entry) == "spans" for entry in ahead["galax_existing_3_day"].values()), "Galax, models chosen on validation: every 3-day interval includes zero")
    require(ahead["better_through_hours"]["Galax"]["every_network"]["kge"] == 18, "Galax: persistence has the higher KGE at all 18 leads")
    grove_transformer = [key for key in detail["mae_by_lead"]["refit_worse_at_all_18_leads"] if key.startswith("Transformer / Sugar Grove / ")]
    require("Transformer / Sugar Grove / full" in grove_transformer, "Sugar Grove: the refit Transformer is worse than its twin at all 18 leads")
    soil_after = {name: removed["soil_and_all_hrrr_breakdowns"][f"{name} / Jefferson / no_soil"]["from_v2.2"] for name in network_names}
    hrrr_after = {name: removed["soil_and_all_hrrr_breakdowns"][f"{name} / Jefferson / no_hrrr"]["from_v2.2"] for name in network_names}
    winter = [removed["soil_and_all_hrrr_breakdowns"][f"{name} / Jefferson / {variant}"]["quarters"]["2022-11 to 2023-01"]["side"] for name in network_names for variant in ("no_soil", "no_hrrr")]
    require(set(winter) == {"spans"}, "Jefferson, November to January: every soil-moisture and all-HRRR interval includes zero")
    galax_after = [removed["soil_and_all_hrrr_breakdowns"][f"{name} / Galax / {variant}"]["from_v2.2"] for name in network_names for variant in ("no_soil", "no_hrrr")]
    require(all(side(entry) == "above" for entry in galax_after), "Galax after the NWM change: every soil-moisture and all-HRRR interval lies above zero")
    negative = data["negative_forecasts"]["fits_with_negative_forecasts"]
    require(len(negative) == 1 and not data["negative_forecasts"]["comparators_with_negative_forecasts"], "one fit issues negative forecasts")
    before_switch = [data["existing_by_version"][f"{name} / Jefferson"]["before_v2.2"] for name in network_names]
    after_switch = [data["existing_by_version"][f"{name} / Jefferson"]["from_v2.2"]["estimate"] for name in network_names]
    seed_spread = lambda network, site: sorted(next(row for row in data["skill"] if row["site"] == names[site])["networks"][network]["per_seed"])   # noqa: E731
    gap_runs = {name: [run for run in entry["runs_of_days"] if run[2] >= 100] for name, entry in data["days_without_a_forecast"].items()}
    long_date = lambda day: f"{datetime.strptime(day, '%Y-%m-%d'):%B} {int(day[8:])}"                                             # noqa: E731
    require(claims["C6"][HEADLINE]["by_verdict"] == {"did not hold up: networks better": 3}, "C6 did not hold up: the networks are better")
    hrrr_spans = {names[site]: [name for (_, name), row in zip(ARCHITECTURES, removal(site, "All HRRR inputs")) if row["side"] != "above"] for site in (JEFFERSON, GALAX)}
    hrrr_other_lengths = all(row["sides"][length] == "above" for site in (JEFFERSON, GALAX) for row in removal(site, "All HRRR inputs") for length in BLOCK_LENGTHS[1:])
    require(all(row["same_sign"] and row["mean"] > 0 for site in (JEFFERSON, GALAX) for row in removal(site, "All HRRR inputs")), "removing all HRRR inputs raised squared error")
    single = [row for rows in data["removal"].values() for row in rows if row["input"] in ("Precipitation", "Temperature", "Humidity", "Snow")]
    grove_rows = [row for key, rows in data["removal"].items() if key.endswith("/ Sugar Grove") for row in rows]
    require(len(single) == c9["entries"] and len(grove_rows) == c10["entries"], "the tallies cover the entries shown")
    full_refit = {key: entry for key, entry in data["refit_against_existing"].items()}
    data["quoted"] = {
        "opened_on": f"{opened:%B} {opened.day}, {opened.year}",
        "jefferson_reduction": pct(entry["estimate"] for entry in nwm(JEFFERSON)), "galax_reduction": pct(entry["estimate"] for entry in nwm(GALAX)),
        "grove_within": f"{max(abs(100 * entry['estimate']) for entry in nwm(GROVE)):.0f}%",
        "jefferson_validation": pct(entry["validation_estimate"] for entry in nwm(JEFFERSON)),
        "galax_validation": pct(entry["validation_estimate"] for entry in nwm(GALAX)),
        "jefferson_without_a_week": pct(value for entry in nwm(JEFFERSON) for value in entry["without_a_week"]),
        "galax_without_a_week": pct(value for entry in nwm(GALAX) for value in entry["without_a_week"]),
        "jefferson_rmse": pct(entry["rmse_term"] for entry in nwm(JEFFERSON)), "galax_rmse": pct(entry["rmse_term"] for entry in nwm(GALAX)),
        "grove_rmse_within": f"{max(abs(100 * entry['rmse_term']) for entry in nwm(GROVE)):.1f}%",
        "week_start": f"{week_start:%B} {week_start.day}, {week_start.year}",
        "week_share": {names[site]: f"{100 * week[site]['share_of_squared_error_second']:.0f}%" for site, _ in SITES},
        "effective_weeks": {names[site]: f"{nwm(site)[0]['effective_weeks_nwm']:.1f} of {nwm(site)[0]['weeks']}" for site, _ in SITES},
        "jefferson_vs_persistence": pct(entry["estimate"] for entry in simple(JEFFERSON, "Persistence")),
        "jefferson_vs_mean_error": pct(entry["estimate"] for entry in simple(JEFFERSON, "Mean error per lead")),
        "jefferson_vs_regression": pct(entry["estimate"] for entry in simple(JEFFERSON, "Linear regression on NWM")),
        "galax_vs_persistence": pct(entry["estimate"] for entry in simple(GALAX, "Persistence")),
        "galax_vs_nwm_corrections": pct(entry["estimate"] for label in ("Mean error per lead", "Linear regression on NWM") for entry in simple(GALAX, label)),
        "grove_vs_persistence": pct(entry["estimate"] for entry in simple(GROVE, "Persistence")),
        "grove_persistence_ratio": f"{data['skill'][2]['simple']['Persistence']:.1f}",
        "persistence_rmse_hours": spread([row["rmse"] for row in data["persistence"]], " hours"),
        "soil_effect": pct(row["mean"] / 100 for site in (JEFFERSON, GALAX) for row in removal(site, "Soil moisture")),
        "soil_jefferson": pct(row["mean"] / 100 for row in removal(JEFFERSON, "Soil moisture")),
        "soil_galax": pct(row["mean"] / 100 for row in removal(GALAX, "Soil moisture")),
        "hrrr_jefferson": pct(row["mean"] / 100 for row in removal(JEFFERSON, "All HRRR inputs")),
        "hrrr_galax": pct(row["mean"] / 100 for row in removal(GALAX, "All HRRR inputs")),
        "hrrr_not_distinguishable": hrrr_spans, "hrrr_above_zero_at_other_block_lengths": hrrr_other_lengths,
        "single_fields": {"entries": c9["entries"], "excluding_zero": c9["intervals_excluding_zero"], "same_sign": c9["same_sign_in_all_three_seeds"],
                          "same_sign_by_chance": f"{c9['same_sign_expected_by_chance']:.0f}", "by_week_sampling_alone": f"{c9['intervals_excluding_zero_expected_by_chance']:.1f}",
                          "largest": f"{100 * c9['largest_absolute_effect']:.1f}%"},
        "grove_inputs": {"entries": c10["entries"], "excluding_zero": c10["intervals_excluding_zero"], "same_sign": c10["same_sign_in_all_three_seeds"],
                         "same_sign_by_chance": f"{c10['same_sign_expected_by_chance']:.0f}", "largest": f"{100 * c10['largest_absolute_effect']:.1f}%"},
        "refit_better_full": sum(side(entry) == "below" for entry in full_refit.values()),
        "jefferson_held_out_over_validation": f"{data['validation_beside'][0]['held_out_over_validation'][0]:.1f} to {data['validation_beside'][0]['held_out_over_validation'][1]:.1f}",
        "grove_mae": {"network": {key: f"{value:.2f}" for key, value in lead("Transformer", GROVE)["mae"]["network"].items()},
                      "nwm": {key: f"{value:.2f}" for key, value in lead("Transformer", GROVE)["mae"]["nwm"].items()}},
        "grove_cells_better": {name: lead(name, GROVE)["cells_better_of_90"] for name in network_names},
        "jefferson_mae_1h": pct(lead(name, JEFFERSON)["mae"]["relative_to_nwm"]["1h"] for name in below_everywhere),
        "jefferson_mae_18h": pct(lead(name, JEFFERSON)["mae"]["relative_to_nwm"]["18h"] for name in below_everywhere),
        "galax_mae_1h": pct(lead(name, GALAX)["mae"]["relative_to_nwm"]["1h"] for name in network_names),
        "galax_mae_18h": pct(lead(name, GALAX)["mae"]["relative_to_nwm"]["18h"] for name in network_names),
        "week_absolute_share": pct(entry["of_nwm_absolute_error"] for entry in data["week"]["shares"].values()),
        "week_squared_share": pct(entry["of_nwm_squared_error"] for entry in data["week"]["shares"].values()),
        "replicates_without_week": f"{100 * data['week']['replicates_without_it']['Jefferson']:.0f}%",
        "november": {"regression_share": f"{100 * week_j['comparators_against_nwm']['Linear regression on NWM']['share_of_its_squared_error_in_week']:.0f}%",
                     "means_above_regression": pct(row["against_regression"]["in_week"] for row in week_j["networks"][HEADLINE]["three_seed_means"].values()),
                     "fits_above_regression": pct([fits_in_week[HEADLINE]["lowest"], fits_in_week[HEADLINE]["highest"]]),
                     "existing_fits_above_regression": pct([fits_in_week[COMPARISON]["lowest"], fits_in_week[COMPARISON]["highest"]]),
                     "outside_below_regression": pct(row["against_regression"]["outside"] for row in week_j["networks"][HEADLINE]["three_seed_means"].values()),
                     "regression_below_nwm": {where: pct([week_j["comparators_against_nwm"]["Linear regression on NWM"][where]]) for where in ("in_week", "outside")},
                     "networks_below_nwm": {where: pct(row["against_nwm"][where] for row in week_j["networks"][HEADLINE]["three_seed_means"].values()) for where in ("in_week", "outside")}},
        "persistence_mae_hours": spread([row["mae"] for row in data["persistence"]], " hours"),
        "persistence_kge_hours": spread([row["kge"] for row in data["persistence"]], " hours"),
        "galax_persistence_mae_hours": ahead["better_through_hours"]["Galax"]["every_network"]["mae"],
        "galax_lstm_3_day": f"[{signed(ahead['galax_lstm_by_block_length']['3']['low'])}, {signed(ahead['galax_lstm_by_block_length']['3']['high'])}]",
        "galax_lstm_seeds": ", ".join(signed(value) for value in ahead["galax_lstm_per_seed"].values()),
        "galax_kge_18h": {name: f"{value:.2f}" for name, value in ahead["galax_kge_18h"].items()},
        "refit_below": {"Sugar Grove": sum(count for key, count in detail["below_zero_by_gauge_and_network"].items() if key.endswith("/ Sugar Grove")),
                        "Sugar Grove at most": f"{100 * abs(detail['below_zero_range_by_gauge']['Sugar Grove'][0]):.1f}%"},
        "refit_mae_1h": {name: f"{worse} of {cells}" for name, (worse, cells) in detail["mae_by_lead"]["refit_worse_at_1h_by_gauge"].items()},
        "refit_grove_transformer": {key: f"{detail['mae_by_lead']['full_input_difference_m3s']['Transformer / Sugar Grove'][key]['estimate']:+.2f}" for key in ("1h", "18h")},
        "refit_grove_transformer_variants": len(grove_transformer) - 1,
        "soil_after_switch": {name: interval(entry) for name, entry in soil_after.items()}, "hrrr_after_switch": {name: interval(entry) for name, entry in hrrr_after.items()},
        "soil_before_switch": pct(removed["soil_and_all_hrrr_breakdowns"][f"{name} / Jefferson / no_soil"]["before_v2.2"]["estimate"] for name in network_names),
        "galax_soil_after_switch": pct(removed["soil_and_all_hrrr_breakdowns"][f"{name} / Galax / no_soil"]["from_v2.2"]["estimate"] for name in network_names),
        "galax_hrrr_after_switch": pct(removed["soil_and_all_hrrr_breakdowns"][f"{name} / Galax / no_hrrr"]["from_v2.2"]["estimate"] for name in network_names),
        "twins_at_cap": [f"{key.split(' / ')[1]} {key.split(' / ')[0]}, {'soil moisture' if key.endswith('no_soil') else 'all HRRR inputs'}, seed {seeds[0]}"
                         for key, seeds in removed["twins_at_the_epoch_cap"].items()],
        "single_seed_range": f"{signed(removed['single_weather_fields_single_seed_range']['smallest']['effect'], 0)} to {signed(removed['single_weather_fields_single_seed_range']['largest']['effect'], 0)}",
        "existing_before_switch": pct(before_switch), "existing_after_switch": pct(after_switch),
        "effective_weeks_before_switch": f"{data['effective_weeks_before_v22']['Jefferson']:.1f}",
        "coverage_grove": f"{100 * data['interval_coverage_by_gauge']['by_gauge']['Sugar Grove']:.0f}%",
        "coverage_lowest_pair": f"{100 * data['interval_coverage_by_gauge']['lowest_pair']:.0f}%",
        "negative": {"fit": f"{negative[0]['gauge']} {negative[0]['network']} of seed {negative[0]['seed']}", "cells": negative[0]["cells"],
                     "lowest": f"{negative[0]['lowest_forecast_m3s']:.2f}".replace("-", MINUS), "lowest_observation": f"{negative[0]['lowest_scored_observation_m3s']:.2f}"},
        "seed_spread": {"Galax LSTM": [f"{value:.3f}" for value in (seed_spread("LSTM", GALAX)[0], seed_spread("LSTM", GALAX)[-1])],
                        "Jefferson Transformer": [f"{value:.3f}" for value in (seed_spread("Transformer", JEFFERSON)[0], seed_spread("Transformer", JEFFERSON)[-1])]},
        "gaps": {name: "; ".join(f"{long_date(run[0])} to {long_date(run[1])}" for run in runs) for name, runs in gap_runs.items()},
        "coverage_7_day": f"{100 * data['calibration']['block_lengths']['7']['coverage_of_population_value']['mean']:.0f}%",
        "exclusion_7_day": f"{100 * data['calibration']['block_lengths']['7']['zero_effect_exclusion_rate']['mean']:.0f}%"}
    data["limits"] = results["limits"]
    return data


def version(name):
    """Short content hash, so a changed stylesheet or script is never served from a browser cache."""
    return hashlib.sha256((HERE / "site" / name).read_bytes()).hexdigest()[:10]


def table(headers, rows, caption=None):
    head = "".join(f"<th scope=\"col\">{esc(h)}</th>" for h in headers)
    body = "".join("<tr>" + "".join(f"<th scope=\"row\">{esc(str(c))}</th>" if i == 0 else f"<td>{esc(str(c))}</td>" for i, c in enumerate(row)) + "</tr>"
                   for row in rows)
    cap = f"<caption>{esc(caption)}</caption>" if caption else ""
    return f'<div class="table-wrap"><table>{cap}<thead><tr>{head}</tr></thead><tbody>{body}</tbody></table></div>'


def listing(items):
    items = list(items)
    return items[0] if len(items) == 1 else ", ".join(items[:-1]) + " and " + items[-1]


def page(data, preview=False):
    q = data["quoted"]
    two, three = (lambda v: f"{v:.2f}"), (lambda v: f"{v:.3f}")   # noqa: E731
    networks, sites = data["architectures"], data["sites"]
    simple_names = [n for _, n in SIMPLE]
    cell = lambda table_, network, site: table_[f"{network} / {site}"]   # noqa: E731
    skill_rows = [[row["site"]] + [f"{three(row['networks'][n]['mean'])} ({three(min(row['networks'][n]['per_seed']))}–{three(max(row['networks'][n]['per_seed']))})"
                                   for n in networks] + [three(row["simple"][n]) for n in simple_names] for row in data["skill"]]
    nwm_rows = [[site] + [interval(cell(data["against_nwm"], n, site)) for n in networks] for site in sites]
    existing_rows = [[site] + [interval(cell(data["against_nwm"], n, site)["existing"]) for n in networks] for site in sites]
    simple_rows = [[f"{site}, {n}"] + [interval(cell(data["against_simple"], n, site)[label]) for label in ("Persistence", "Mean error per lead", "Linear regression on NWM")]
                   for site in sites for n in networks]
    persistence_rows = [[r["site"], f"{r['rmse']} h", f"{r['mae']} h", f"{r['kge']} h",
                         f"{r['h1_rmse_difference_m3s'][0]:.2f} to {r['h1_rmse_difference_m3s'][1]:.2f}"] for r in data["persistence"]]
    beside_rows = [[r["site"], f"{two(r['validation'][0])} to {two(r['validation'][1])}", f"{two(r['held_out'][0])} to {two(r['held_out'][1])}"] for r in data["validation_beside"]]
    refit_rows = [[site] + [interval(cell(data["refit_against_existing"], n, site)) for n in networks] for site in sites]
    count_rows = [[n, f"{data['counts'][HEADLINE][n]['nwm']} of {data['counts'][HEADLINE][n]['cells']}", f"{data['counts'][HEADLINE][n]['simple']} of {data['counts'][HEADLINE][n]['cells']}",
                   f"{data['counts'][COMPARISON][n]['nwm']}", f"{data['counts'][COMPARISON][n]['simple']}"] for n in networks]
    coverage_rows = [[r["site"], f"{r['in_support']:,}", f"{r['issued']:,}", f"{r['scored_cells']:,}", r["weeks"], q["gaps"][r["site"]]] for r in data["coverage"]]

    def mae_cell(row, lead):
        difference = row["mae"]["difference_m3s"][lead]
        note = {"above": "interval above zero", "below": "interval below zero", "spans": "interval includes zero"}[side(difference)]
        return f"{row['mae']['network'][lead]:.2f} against {row['mae']['nwm'][lead]:.2f} ({signed(row['mae']['relative_to_nwm'][lead], 0)}; {note})"
    mae_rows = [[f"{site}, {n}", mae_cell(cell(data["by_lead_against_nwm"], n, site), "1h"), mae_cell(cell(data["by_lead_against_nwm"], n, site), "18h"),
                 f"{cell(data['by_lead_against_nwm'], n, site)['mae']['leads_worse']} of 18", f"{cell(data['by_lead_against_nwm'], n, site)['cells_better_of_90']} of 90"]
                for site in sites for n in networks]
    calibration_rows = [[f"{length} days"] + [f"{100 * entry[name]['mean']:.0f}% ({100 * entry[name]['low']:.0f}–{100 * entry[name]['high']:.0f}% over pairs)"
                                                for name in ("zero_effect_exclusion_rate", "coverage_of_population_value")]
                        for length, entry in data["calibration"]["block_lengths"].items()]

    def stratum_cell(entry):
        values = sorted(entry["estimates"], key=abs if min(entry["estimates"]) * max(entry["estimates"]) > 0 else None)
        digits = 0 if max(abs(value) for value in values) >= 0.1 else 1
        first, last = signed(values[0], digits), signed(values[-1], digits)
        text = first if first == last else f"{first} to {last}"
        sides = set(entry["sides"])
        note = ("point estimates only" if sides == {None} else "every interval below zero" if sides == {"below"} else "every interval includes zero" if sides == {"spans"}
                else "intervals differ by network")
        return f"{text} ({entry['weeks']} weeks; {note})"
    breakdown_rows = [[f"{row['split']}: {row['stratum']}"] + [stratum_cell(row["gauges"][site]) for site in sites] for row in data["breakdowns"]]

    def verdict(entry):
        if "by_verdict" in entry:
            name_of = lambda name: (name.replace(": ", " (") + ")" if ": " in name else name)             # noqa: E731
            parts = [f"{name_of(name)} in {count} of {entry['cells']}" for name, count in sorted(entry["by_verdict"].items(), key=lambda item: -item[1])]
            return "; ".join(parts).capitalize()
        return (f"Descriptive, no verdict: {entry['intervals_excluding_zero']} of {entry['entries']} intervals exclude zero; {entry['same_sign_in_all_three_seeds']} have one sign in "
                f"all three seeds ({entry['same_sign_expected_by_chance']:.0f} expected by chance); largest three-seed mean {100 * entry['largest_absolute_effect']:.1f}%")
    claim_rows = [[entry["claim"], entry["statement"], verdict(entry[HEADLINE]), verdict(entry[COMPARISON])] for entry in data["claims"]]

    removal_tables = []
    for key, rows in data["removal"].items():
        body = [[r["input"], f"{r['mean']:+.1f}%".replace("-", MINUS), f"{r['interval'][0]:+.1f}% to {r['interval'][1]:+.1f}%".replace("-", MINUS),
                 ", ".join(f"{v:+.1f}%" for v in r["per_seed"]).replace("-", MINUS),
                 f"{r['without_a_week'][0]:+.1f}% to {r['without_a_week'][1]:+.1f}%".replace("-", MINUS), "yes" if r["same_sign"] else "no"] for r in rows]
        removal_tables.append(f"<h4>{esc(key)}</h4>" + table(
            ["Input removed", "Mean effect", "Nominal 95% interval (weeks resampled)", "Seeds 1729, 1730, 1731", "Leaving one week out", "One sign in all three seeds"], body))
    limits = "".join(f"<li>{esc(text)}</li>" for text in data["limits"])
    hashes = "".join(f"<li><code>{esc(name)}</code> <span class=\"hash\">{esc(value)}</span></li>" for name, value in data["source_sha256"].items())
    shares = q["week_share"]
    nov, grove_mae = q["november"], q["grove_mae"]
    single, grove = q["single_fields"], q["grove_inputs"]
    embedded = json.dumps(data, separators=(",", ":"), allow_nan=False).replace("</", "<\\/")     # never closes the script element early
    spans = {site: found for site, found in q["hrrr_not_distinguishable"].items() if found}
    hrrr_note = ("Every 7-day interval lies above zero." if not spans else
                 " ".join(f"At {site} the 7-day intervals of {listing(found)} include zero." for site, found in spans.items())
                 + (" Their 3-, 14- and 28-day intervals lie above it." if q["hrrr_above_zero_at_other_block_lengths"] else ""))
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Hydra: which data improve local National Water Model streamflow estimates</title>
<meta name="description" content="Neural residual corrections of National Water Model streamflow at three gauges, scored on a held-out year, with input-removal experiments. AGU 2026.">
<link rel="stylesheet" href="styles.css?v={version("styles.css")}">{'<meta name="robots" content="noindex, nofollow">' if preview else ''}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>{'<p class="preview">Preview for the authors’ review. Not yet the public site.</p>' if preview else ''}
<header class="top">
  <nav aria-label="Sections">
    <a class="brand" href="#top">Hydra</a>
    <a href="#findings">Findings</a><a href="#nwm">Against NWM</a><a href="#simple">Against simple corrections</a>
    <a href="#inputs">Input removal</a><a href="#design">Refit and validation</a><a href="#verdicts">Verdicts</a><a href="#methods">Methods</a>
    <a href="#limits">Limits</a><a href="#files">Files</a>
  </nav>
</header>
<main id="main">
<section class="hero" id="top">
  <p class="eyebrow">AGU26 · poster H51P-1404 · Friday 11 December 2026 · held-out year evaluation</p>
  <h1>Hydra: Identifying Data That Improve Local National Water Model Streamflow Estimates</h1>
  <p class="authors">Mitchel Carson<sup>1</sup> · Mohammad Ali Javidian<sup>2</sup> · William P. Anderson Jr.<sup>3</sup></p>
  <p class="affiliations"><sup>1</sup> University of Texas at Austin, Austin, TX · <sup>2</sup> Computer Science · <sup>3</sup> Geological and Environmental Sciences,
  Appalachian State University, Boone, NC</p>
  <p class="lede">On a held-out year, neural corrections cut the National Water Model's (NWM) squared error by {q['jefferson_reduction']} at Jefferson and
  {q['galax_reduction']} at Galax. At Sugar Grove, squared error stayed within {q['grove_within']} of NWM and the Transformer had higher mean absolute error at every lead.
  Withholding HRRR soil moisture raised squared error by {q['soil_jefferson']} at Jefferson and {q['soil_galax']} at Galax.</p>
  <p class="note"><strong>Held out, not untouched.</strong> The year (May 2022 to April 2023) was opened once in this campaign, on {q['opened_on']}, after every model and
  rule was fixed and committed. The same year had been scored before with an earlier pipeline, and parts of it served as validation and test in older work.
  Nothing on this page is a significance test or a real-time result. <a href="#limits">All limits</a>.</p>
</section>

<section id="findings">
  <h2>What the held-out year showed</h2>
  <div class="cards">
    <article><h3>Jefferson</h3><p>All three networks have {q['jefferson_reduction']} lower squared error than NWM. The validation window had suggested
      {q['jefferson_validation']}. They are not distinguishable from a linear regression on NWM, which is better than every network in the week of the November flood.</p></article>
    <article><h3>Galax</h3><p>{q['galax_reduction']} lower squared error than NWM and {q['galax_vs_persistence']} lower than persistence of the last gauge reading,
      as three-seed means pooled over the 18 leads. Persistence keeps the higher KGE at every lead.</p></article>
    <article><h3>Sugar Grove</h3><p>Squared error is within {q['grove_within']} of NWM. The Transformer has higher mean absolute error than NWM at every lead
      ({grove_mae['network']['1h']} against {grove_mae['nwm']['1h']} m³/s at 1 h).</p></article>
    <article><h3>Persistence</h3><p>Repeating the last gauge reading beats every network for the first {q['persistence_rmse_hours']} by RMSE at all three gauges,
      for {q['persistence_mae_hours']} by mean absolute error and for {q['persistence_kge_hours']} by KGE.</p></article>
    <article><h3>Inputs</h3><p>Where the networks have skill, removing soil moisture alone raises squared error by {q['soil_effect']}.
      Among precipitation, temperature, humidity and snow, removed one at a time, the largest three-seed mean effect is {single['largest']}.</p></article>
    <article><h3>One week</h3><p>The week from {q['week_start']} holds {shares['Jefferson']}, {shares['Galax']} and {shares['Sugar Grove']} of NWM's squared error
      at Jefferson, Galax and Sugar Grove, and {q['week_absolute_share']} of its absolute error. With any single week left out the reductions stay at
      {q['jefferson_without_a_week']} and {q['galax_without_a_week']}.</p></article>
  </div>
</section>

<section id="nwm">
  <h2>Against NWM, skill depends on the gauge</h2>
  <p>Each network predicts a residual that is added to the NWM forecast at native leads of 1 to 18 hours. The charts show each score by lead in the held-out year,
  as the mean of three training seeds, beside NWM, persistence and two simple corrections. The networks were refit on the whole first year (May 2021 to April 2022);
  the two fitted corrections use the same period.</p>
  <div class="controls" role="group" aria-label="Score shown">
    <span class="controls-label">Score</span><div id="metric-buttons"></div>
    <label class="check"><input type="checkbox" id="show-simple"> Show the two NWM-based simple corrections</label>
  </div>
  <div class="legend" id="lead-legend"></div>
  <p class="direction" id="metric-direction"></p>
  <div class="charts three" id="lead-charts"></div>
  <h3>Change in squared error against NWM</h3>
  <p class="small">Pooled over all leads, mean of three seeds, with the nominal 95% interval from 7-day blocks. Negative is better than NWM.</p>
  {table(["Gauge"] + networks, nwm_rows)}
  <ul class="plain">
    <li><strong>Jefferson.</strong> {q['jefferson_reduction']} lower. The intervals lie below zero at 7-, 3-, 14- and 28-day blocks. With any single week left out the
      reduction stays between {q['jefferson_without_a_week'].replace('–', ' and ')}. The validation window gave {q['jefferson_validation']}; all three held-out intervals
      lie on the zero side of the validation estimates, so the gain is weaker than validation suggested.</li>
    <li><strong>Galax.</strong> {q['galax_reduction']} lower, at all four block lengths; {q['galax_without_a_week']} with any one week left out. The validation
      estimates ({q['galax_validation']}) lie inside the held-out intervals.</li>
    <li><strong>Sugar Grove.</strong> In squared error the networks are within {q['grove_within']} of NWM, and every interval lies within ±10%, a wide margin.
      By mean absolute error the Transformer is worse than NWM at every lead, in each of its three seeds: {grove_mae['network']['1h']} against {grove_mae['nwm']['1h']} m³/s at 1 h
      and {grove_mae['network']['18h']} against {grove_mae['nwm']['18h']} at 18 h, with every interval above zero. Over five scores and 18 leads it is better than NWM in
      {q['grove_cells_better']['Transformer']} of 90 cells; the LSTM in {q['grove_cells_better']['LSTM']} and GRU+Conv in {q['grove_cells_better']['GRU+Conv']}.</li>
    <li><strong>In RMSE terms</strong> (mean over seeds of the square root of each seed's ratio): {q['jefferson_rmse']} below NWM at Jefferson, {q['galax_rmse']} at Galax,
      within {q['grove_rmse_within']} at Sugar Grove.</li>
    <li><strong>One week carries much of this.</strong> The week from {q['week_start']} holds {shares['Jefferson']} of NWM's squared error at Jefferson,
      {shares['Galax']} at Galax and {shares['Sugar Grove']} at Sugar Grove. The effective number of weeks is {q['effective_weeks']['Jefferson']},
      {q['effective_weeks']['Galax']} and {q['effective_weeks']['Sugar Grove']}. The largest observed flow of the year at each gauge falls in that week. About
      {q['replicates_without_week']} of bootstrap replicates do not contain it, so the intervals of the pooled figures mostly reflect how often it is drawn.</li>
  </ul>
  <h3>Mean absolute error at single leads</h3>
  <p>Mean absolute error rests less on the November week, which holds {q['week_absolute_share']} of NWM's absolute error against {q['week_squared_share']} of its squared
  error. At Jefferson the LSTM and GRU+Conv are below NWM at every lead ({q['jefferson_mae_1h']} lower at 1 h, {q['jefferson_mae_18h']} at 18 h). At Galax every network
  is above NWM at 1 h ({q['galax_mae_1h']} higher) and {q['galax_mae_18h']} lower at 18 h.</p>
  {table(["Gauge, network", "At 1 h: network against NWM (m³/s)", "At 18 h: network against NWM (m³/s)", "Leads with higher error than NWM",
          "Cells better than NWM (five scores × 18 leads)"], mae_rows, "Mean of three seeds; intervals are nominal 95% from 7-day blocks.")}
  <h3>Squared error relative to NWM</h3>
  <p class="small">Below 1 beats NWM. Networks: mean of three seeds (lowest to highest seed).</p>
  {table(["Gauge"] + networks + simple_names, skill_rows)}
  <h3>Counts</h3>
  <p class="small">Of 270 gauge × lead × score cells (five scores), the number in which the seed-mean network is better than NWM, and better than every simple
  correction. The cells are dependent; these are descriptive counts, not tests.</p>
  {table(["Network", "Refit: better than NWM", "Refit: better than every simple correction", "Chosen on validation: better than NWM",
          "Chosen on validation: better than every simple correction"], count_rows)}
</section>

<section id="simple">
  <h2>Against simple corrections, it depends on the gauge and the lead</h2>
  <p>Three corrections are scored on exactly the same forecast cases: persistence, which repeats the latest archived gauge reading for all 18 leads; a mean error
  per lead; and a linear regression on NWM per lead. Negative means the network has lower squared error.</p>
  {table(["Gauge, network", "Against persistence", "Against the mean error per lead", "Against the linear regression"], simple_rows,
         "Change in pooled squared error, mean of three seeds, nominal 95% interval from 7-day blocks.")}
  <ul class="plain">
    <li><strong>Jefferson.</strong> The networks have {q['jefferson_vs_persistence']} lower squared error than persistence and {q['jefferson_vs_mean_error']} lower than
      the mean error per lead, pooled over the 18 leads. Against the linear regression on NWM they are {q['jefferson_vs_regression']} lower and every interval includes
      zero: on this year the networks are not distinguishable from that regression.</li>
    <li><strong>Jefferson, the November week.</strong> A descriptive split made after the results were seen. In the week from {q['week_start']}, which holds
      {nov['regression_share']} of the regression's squared error, the regression is better than every network: the three-seed means are {nov['means_above_regression']}
      above it and all nine fits are worse ({nov['fits_above_regression']}). The nine fits chosen on validation are worse than their regression too
      ({nov['existing_fits_above_regression']}). Outside that week the networks are {nov['outside_below_regression']} below the regression. Against NWM, the regression is
      {nov['regression_below_nwm']['in_week']} lower in that week and {nov['regression_below_nwm']['outside']} lower outside it; the networks are
      {nov['networks_below_nwm']['in_week']} lower in that week and {nov['networks_below_nwm']['outside']} lower outside it.</li>
    <li><strong>Galax.</strong> Validation found the networks not better than persistence. In the held-out year the three-seed means of all three have lower pooled squared
      error than persistence ({q['galax_vs_persistence']} lower; every 7-day interval below zero) and are {q['galax_vs_nwm_corrections']} below the two NWM-based corrections.
      For the LSTM the 3-day interval includes zero ({q['galax_lstm_3_day']}) and one of its three seeds is worse than persistence ({q['galax_lstm_seeds']}).
      Persistence keeps lower mean absolute error than every network through {q['galax_persistence_mae_hours']} h and higher KGE at all 18 leads
      ({q['galax_kge_18h']['persistence']} at 18 h against {q['galax_kge_18h']['LSTM']}, {q['galax_kge_18h']['GRU+Conv']} and {q['galax_kge_18h']['Transformer']}).</li>
    <li><strong>Sugar Grove.</strong> The networks are within a few percent of the two NWM-based corrections and {q['grove_vs_persistence']} below persistence,
      which has {q['grove_persistence_ratio']} times NWM's squared error there.</li>
  </ul>
  <h3>The first hours belong to persistence</h3>
  <p>Switch the score above to mean absolute error or KGE to see how long persistence stays ahead.</p>
  {table(["Gauge", "Lower RMSE than every network through", "Lower mean absolute error through", "Higher KGE through", "RMSE at 1 h, network minus persistence (m³/s)"],
         persistence_rows, "Leads over which persistence is better than every network (seed means).")}
  <p class="small">Whether a gauge reading at the forecast hour was available at issue time was not established, for persistence or for the networks.</p>
</section>

<section id="inputs">
  <h2>Removing soil moisture alone costs about as much as removing all HRRR inputs</h2>
  <p>Each bar is the change in squared error in the held-out year when one input group is removed and the network retrained at the same size, for one seed.
  Right of zero means removal hurt. Seed 1731 took no part in choosing the training recipe.</p>
  <div class="controls" role="group" aria-label="Gauge shown">
    <span class="controls-label">Gauge</span><div id="site-buttons"></div>
  </div>
  <div class="legend" id="seed-legend"></div>
  <div class="charts three" id="removal-charts"></div>
  <ul class="plain">
    <li><strong>Soil moisture.</strong> Removing it raises squared error by {q['soil_jefferson']} at Jefferson and {q['soil_galax']} at Galax, for every network, with
      every interval above zero. No run removed the four HRRR forecast fields together while keeping soil moisture, so their joint contribution is not measured,
      and soil moisture is the only input on each network's initial-state pathway.</li>
    <li><strong>All HRRR inputs.</strong> Removing all of them raises squared error by {q['hrrr_jefferson']} at Jefferson and {q['hrrr_galax']} at Galax, about as much
      as removing soil moisture alone. {hrrr_note}</li>
    <li><strong>After the NWM version change.</strong> At Jefferson removing soil moisture raises squared error by {q['soil_before_switch']} in the seven weeks before
      the change (about two effective weeks; point estimates only). After it, in 85% of the scored cases, the effect is {q['soil_after_switch']['LSTM']} for the LSTM,
      {q['soil_after_switch']['GRU+Conv']} for GRU+Conv and {q['soil_after_switch']['Transformer']} for the Transformer; the all-HRRR effect is
      {q['hrrr_after_switch']['LSTM']}, {q['hrrr_after_switch']['GRU+Conv']} and {q['hrrr_after_switch']['Transformer']}. From November to January every one of these
      intervals at Jefferson includes zero. At Galax the increases after the change are {q['galax_soil_after_switch']} (soil moisture) and {q['galax_hrrr_after_switch']}
      (all HRRR inputs), with every interval above zero.</li>
    <li><strong>Single weather fields</strong> (a tally without a verdict). Of the {single['entries']} entries for precipitation, temperature, humidity and snow,
      {single['excluding_zero']} intervals exclude zero and {single['same_sign']} have one sign in all three seeds ({single['same_sign_by_chance']} expected by chance).
      Resampling weeks alone would give {single['by_week_sampling_alone']} exclusions; that figure leaves out the difference between two training runs. The largest
      three-seed mean is {single['largest']}; single seeds range from {q['single_seed_range']}. We read this as no consistent effect. That is "not distinguishable
      from zero on this year", not evidence that the fields are useless.</li>
    <li><strong>Sugar Grove</strong> (a tally without a verdict). Of the {grove['entries']} removal entries the largest three-seed mean is {grove['largest']}. The signs
      agree across the three seeds in {grove['same_sign']} entries, against {grove['same_sign_by_chance']} expected by chance. We read some of these very small effects
      as systematic and none as large.</li>
    <li><strong>Gauge history and NWM as an input</strong> show no pattern that holds across networks.</li>
  </ul>
  <p class="small">Removal effects measure the predictive value of an input to these models on these cases, at fixed capacity. They are not causal importance.
  The removed-input fits use a training recipe that was tuned for the full-input fits, which can make removal look more harmful than it is. The variant without NWM as
  an input still uses NWM as the anchor of the residual. Two of the twelve soil-moisture and all-HRRR cases at Jefferson and Galax rest on a refit whose twin ended at
  the epoch cap ({esc('; '.join(q['twins_at_cap']))}).</p>
  <details><summary>Every input-removal number</summary>
    <p class="small">Mean effect over three seeds with its nominal 95% interval (weeks resampled, fitted models held fixed), each seed, and the range of the
    mean when each week is left out in turn.</p>
    {''.join(removal_tables)}
  </details>
</section>

<section id="design">
  <h2>Refitting, and what the validation window had suggested</h2>
  <h3>Did refitting on the whole first year help?</h3>
  <p>Each network on this page was refit on the whole first year for the number of epochs its twin had selected on validation. The table compares each refit with
  that twin (trained on May 2021 to January 2022) on the same cases; negative means the refit is better.</p>
  {table(["Gauge"] + networks, refit_rows, "Full-input fits: change in pooled squared error, refit against the model chosen on validation.")}
  <p>In pooled squared error, over all {data['refit_tally']['cells']} network, gauge and input-set cells, {data['refit_tally']['below']} intervals lie below zero, none
  lies above and {data['refit_tally']['spans']} include zero. Of those below zero, {q['refit_below']['Sugar Grove']} are at Sugar Grove, with changes of at most
  {q['refit_below']['Sugar Grove at most']}.</p>
  <p>By mean absolute error the picture differs. At 1 h the refit is worse than its twin, with the interval above zero, in {q['refit_mae_1h']['Galax']} Galax cells,
  {q['refit_mae_1h']['Jefferson']} Jefferson cells and {q['refit_mae_1h']['Sugar Grove']} Sugar Grove cells. The refit Transformer at Sugar Grove is worse than its twin at
  all 18 leads ({q['refit_grove_transformer']['1h']} m³/s at 1 h, {q['refit_grove_transformer']['18h']} at 18 h), and so are {q['refit_grove_transformer_variants']} of
  its eight removed-input variants. Refitting did not measurably raise pooled squared error anywhere, and it did raise absolute error at short leads.</p>
  <p>The refit differs from its twin in more than the amount of data. Its length is a convention: no refit had a validation check of its own. Its loss scale is fitted
  on the first year, which the limits below quantify.</p>
  <h3>The models chosen on validation, without the refit</h3>
  {table(["Gauge"] + networks, existing_rows, "Change in pooled squared error against NWM in the held-out year, models trained on May 2021 to January 2022.")}
  <h3>At Jefferson the held-out gain was smaller than in the validation window</h3>
  <p>Squared error relative to NWM for the nine full-input fits chosen on validation, in the validation window (February to April 2022) and in the held-out year.
  These are different forecast cases. The validation window also selected the checkpoints, which favours the validation figures.</p>
  {table(["Gauge", "Validation window, range over nine fits", "Held-out year, range over the same fits"], beside_rows)}
  <p>At Jefferson every one of the nine fits has a ratio {q['jefferson_held_out_over_validation']} times as high in the held-out year. At Galax and Sugar Grove the
  two periods agree. The pair is descriptive: season, NWM version, the November event and checkpoint selection cannot be separated. In the seven weeks before the NWM
  version change the same fits were {q['existing_before_switch']} below NWM at Jefferson, close to their validation figures, and after it {q['existing_after_switch']};
  the first figure rests on {q['effective_weeks_before_switch']} effective weeks.</p>
  <h3>Where the gain is larger and smaller</h3>
  <p class="small">Splits fixed in advance; descriptive. Range over the three networks of the change in squared error against NWM. Intervals are given only for
  strata with at least ten weeks. Version and season cannot be separated: all training data are NWM v2.1, and most of the held-out year is v2.2.</p>
  {table(["Stratum"] + sites, breakdown_rows)}
</section>

<section id="verdicts">
  <h2>Verdicts on the ten statements fixed in advance</h2>
  <p>Each statement came from the validation analysis. The rule for each verdict was written and committed before the held-out year was opened:
  the side of zero on which the nominal interval lies decides. A verdict counts cases. The three network types share data, storms and the dominant week, so
  "3 of 3" is not three independent confirmations.</p>
  {table(["", "Statement from validation", "Networks refit on the first year (headline)", "Models chosen on validation"], claim_rows)}
</section>

<section id="methods">
  <h2>Methods</h2>
  <div class="columns">
    <div><h3>Data and design</h3>
      <ul class="plain">
        <li>Corrected flow = NWM forecast + learned residual (m³/s), at native leads of 1 to 18 hours.</li>
        <li>Gauges: Jefferson (USGS 03161000), Galax (03164000) and Sugar Grove (03479000).</li>
        <li>Inputs: recent gauge flow, the NWM forecast, and five HRRR fields: precipitation, temperature, humidity, snow and initial soil moisture.
          HRRR is the only weather source.</li>
        <li>Fit: May 2021 to January 2022. Validation: February to April 2022. Held-out year: May 2022 to April 2023.</li>
      </ul></div>
    <div><h3>Campaign</h3>
      <ul class="plain">
        <li>Three networks: LSTM, GRU+Conv and Transformer.</li>
        <li>Tuning: 54 fits chose one training recipe per network by a rule fixed in advance.</li>
        <li>Input removal: 243 fits = 3 networks × 3 gauges × 3 seeds × 9 input sets, each at its best validation epoch.</li>
        <li>Refit: all 243 trained again on the whole first year, from the same starting weights, for the number of epochs validation had chosen.</li>
      </ul></div>
    <div><h3>Evaluation and review</h3>
      <ul class="plain">
        <li>The plan, the code, the models, the ten statements and the verdict rules were committed before the held-out year was opened. It was then read once.</li>
        <li>Intervals come from a paired bootstrap over 7-day blocks (3, 14 and 28 days as a check). They are nominal.</li>
        <li>A second recomputation by the same author, with code that shares nothing with the analysis, compared {data['crosscheck']['numbers_compared']:,} numbers and
          report rows and found no disagreement.</li>
        <li>Independent reviewers checked the plan before the refits ran and the scoring code before the opening. A third recomputed the results from the per-case
          outputs with its own code and checked every sentence of the findings; this page follows its corrections.</li>
      </ul></div>
  </div>
  <h3>What was scored</h3>
  <p class="small">Forecast origins with complete inputs and an accepted observation. Forecasts are missing mainly where the gauge record has gaps.</p>
  {table(["Gauge", "Origins in support", "Corrected forecast issued", "Scored lead-cases", "Weeks", "Longest runs of days without a forecast"], coverage_rows)}
</section>

<section id="limits">
  <h2>Limits</h2>
  <p>These apply to every number on this page. They are reproduced from the evaluation report.</p>
  <ol class="limits">{limits}</ol>
  <h3>How far the intervals can be trusted</h3>
  <p>Measured on these weeks with pairs of network forecasts ({data['calibration']['pairs']} pairs, {data['calibration']['trials']} trials each, weeks resampled
  independently, which is the favourable case). At 7-day blocks the intervals cover the population value in at best about {q['coverage_7_day']} of trials where 95% is
  claimed ({q['coverage_grove']} at Sugar Grove, {q['coverage_lowest_pair']} for the worst pair), and exclude zero in {q['exclusion_7_day']} of trials when the true
  effect is zero. An interval that excludes zero is not called significant.</p>
  {table(["Block length", "Interval excludes zero when the true effect is zero", "Interval contains the population value"], calibration_rows)}
  <h3>What a critical reader will ask</h3>
  <ul class="plain">
    <li><strong>Is this a prediction or a replication?</strong> A replication. The earlier scoring of this year used the same three network types, the same refit rule
      and one of the same seeds, and its numbers recur here, the unfavourable one at Sugar Grove included.</li>
    <li><strong>Is it one event?</strong> Largely. One week holds {q['week_squared_share']} of NWM's squared error and the largest observed flow of the year at all
      three gauges.</li>
    <li><strong>Why networks?</strong> At Jefferson a regression with two coefficients per lead is not distinguishable from them and is better in the flood week.
      Persistence is better in the first hours, and by KGE for most or all of the horizon.</li>
    <li><strong>Was the headline set checked?</strong> No refit had a validation of its own, and one member got worse without any check noticing: the Sugar Grove
      Transformer.</li>
    <li><strong>How much do seeds matter?</strong> The three seeds of the Galax LSTM run from {q['seed_spread']['Galax LSTM'][0]} to {q['seed_spread']['Galax LSTM'][1]}
      and those of the Jefferson Transformer from {q['seed_spread']['Jefferson Transformer'][0]} to {q['seed_spread']['Jefferson Transformer'][1]} (squared error relative
      to NWM). That spread is as large as the differences between network types, and it is in no interval.</li>
    <li><strong>What happens when the gauge record has gaps?</strong> No forecast is issued, in the same weeks at all three gauges. Those weeks are not scored.</li>
    <li><strong>Are the forecasts physical?</strong> The refit {q['negative']['fit']} issues {q['negative']['cells']} negative discharge forecasts (lowest
      {q['negative']['lowest']} m³/s; the lowest observation scored there is {q['negative']['lowest_observation']}). No other full-input fit has any.</li>
  </ul>
  <h3>What this work does not show</h3>
  <p>That this is an untouched, independent or blind test; that any result is statistically significant; that any network is best; that the networks beat a
  simple linear correction of NWM at Jefferson; that the correction helps at Sugar Grove, or in general; that it is harmless where it gives no gain; that the
  networks beat persistence other than in pooled squared error, or beat NWM in the first hour; that refitting on more data helps, or is harmless; that the gain holds
  in every season; that "3 of 3" is three independent confirmations; that the validation figures describe expected performance, or what caused the smaller gain at
  Jefferson; that an input is causally important or useless, or that soil moisture is the reason HRRR helps; anything about real-time use, other gauges, regions or
  years; anything about floods as such.</p>
</section>

<section id="files">
  <h2>Files</h2>
  <ul class="files">
    <li><a href="{STUDY_REPOSITORY}">Study methods and website source on GitHub</a></li>
    <li><a href="files/FINDINGS.md">Reviewed findings</a> (text)</li>
    <li><a href="files/REPORT.md">Evaluation report with every table</a> (text)</li>
    <li><a href="files/posthoc.json">Descriptive numbers added after the review</a> (JSON)</li>
    <li><a href="data.json">The numbers behind this page</a> (JSON)</li>
  </ul>
  <p class="small">This page is generated from two files, identified by SHA-256. The results file was written once, at commit
  <code>{esc(data['freeze_commit'][:12])}</code> of the evaluation code. The second holds descriptive numbers that were added after the independent review of the findings
  and change no verdict.</p>
  <ul class="hashes">{hashes}</ul>
</section>
</main>
<footer>
  <p>HRRR: High-Resolution Rapid Refresh. NWM: National Water Model. USGS: U.S. Geological Survey. LSTM: long short-term memory.
  GRU+Conv: gated recurrent unit with convolution. RMSE: root-mean-square error. KGE: Kling–Gupta efficiency. NSE: Nash–Sutcliffe efficiency.</p>
</footer>
<div id="tooltip" role="status" aria-live="polite"></div>
<script id="site-data" type="application/json">{embedded}</script>
<script src="app.js?v={version("app.js")}"></script>
</body>
</html>
"""


def main(campaign, preview=False):
    campaign = Path(campaign).resolve()
    data = collect(campaign)
    site = HERE / "site"
    (site / "files").mkdir(parents=True, exist_ok=True)
    (site / "index.html").write_text(page(data, preview))
    (site / "data.json").write_text(json.dumps(data, indent=1, allow_nan=False) + "\n")
    shutil.copyfile(campaign / EVALUATION / "FINDINGS.md", site / "files" / "FINDINGS.md")
    shutil.copyfile(campaign / EVALUATION / "REPORT.md", site / "files" / "REPORT.md")
    shutil.copyfile(campaign / EVALUATION / "posthoc.json", site / "files" / "posthoc.json")
    print(f"wrote {site} ({len(page(data, preview)):,} characters of HTML{', preview' if preview else ''})")
    print(json.dumps(data["quoted"], ensure_ascii=False))


if __name__ == "__main__":
    main(sys.argv[1], preview="--preview" in sys.argv[2:])
