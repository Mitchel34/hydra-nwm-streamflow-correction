"""Strict, dependency-free NWIS IV conversion for the original Eastern study sites.

Clock conversion never estimates an offset from discharge or model fit. Raw responses
must be retained by the caller. Legacy naive CSVs without tz_cd are not repairable
by this module. Daily means are not instantaneous observations.
"""
from __future__ import annotations

import csv
import hashlib
import io
import math
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

CONTRACT_VERSION = "usgs-utc-v1"
CFS_TO_CMS = 0.028316846592
STUDY_SITE_ZONES = {s: "America/New_York" for s in ("03161000", "03164000", "03479000")}
CODE_OFFSETS = {"EST": -5, "EDT": -4, "UTC": 0, "GMT": 0}


class ClockContractError(ValueError):
    """Source metadata cannot establish one unambiguous, valid instant."""


def utc_timestamp(text: str, tz_cd: str = "", site_id: str = "") -> datetime:
    """Resolve explicit source offsets and validate EST/EDT against site DST rules.

    Aware timestamps without tz_cd are accepted, retaining their explicit offset.
    Naive timestamps require a recognized per-row code. EST/EDT require a registered
    site zone; impossible spring times and seasonally inconsistent codes fail closed.
    """
    code = tz_cd.strip().upper()
    if code and code not in CODE_OFFSETS:
        raise ClockContractError(f"Unsupported timezone code {code!r}")
    try:
        parsed = datetime.fromisoformat(text.strip().replace("Z", "+00:00"))
    except ValueError as exc:
        raise ClockContractError(f"Invalid source timestamp {text!r}") from exc
    if parsed.utcoffset() is None:
        if not code:
            raise ClockContractError("Naive source timestamp has no timezone code")
        parsed = parsed.replace(tzinfo=timezone(timedelta(hours=CODE_OFFSETS[code])))
    elif code and parsed.utcoffset() != timedelta(hours=CODE_OFFSETS[code]):
        raise ClockContractError("Timestamp offset conflicts with source timezone code")
    resolved = parsed.astimezone(timezone.utc)
    if code in ("EST", "EDT"):
        if site_id not in STUDY_SITE_ZONES:
            raise ClockContractError("EST/EDT requires an explicitly registered site zone")
        local = resolved.astimezone(ZoneInfo(STUDY_SITE_ZONES[site_id]))
        if local.replace(tzinfo=None) != parsed.replace(tzinfo=None) or local.tzname() != code:
            raise ClockContractError("Local timestamp/code violates site DST rules")
    return resolved


def iso_utc(value: datetime) -> str:
    if value.utcoffset() is None:
        raise ClockContractError("UTC serialization requires an aware timestamp")
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def parse_rdb(text: str) -> list[dict]:
    """Parse one or multiple NWIS RDB blocks, preserving provider metadata.

    The schema row is recognized explicitly rather than silently coerced away.
    All observation clocks are validated, including rows with nonnumeric values.
    Multiple discharge series per block require explicit upstream selection.
    """
    header = None
    flow = None
    output = []
    for line_number, line in enumerate(text.splitlines(), 1):
        if not line or line.startswith("#"):
            continue
        fields = line.split("\t")
        if fields[0] == "agency_cd":
            header = fields
            required = {"agency_cd", "site_no", "datetime", "tz_cd"}
            if not required.issubset(header):
                raise ClockContractError("IV response missing required datetime/tz_cd metadata")
            candidates = [c for c in header if c.endswith("_00060")]
            if len(candidates) != 1:
                raise ClockContractError("Expected exactly one discharge series per RDB block")
            flow = candidates[0]
            continue
        if header is None:
            raise ClockContractError("Unexpected RDB content before column header")
        if len(fields) == len(header) and all(re.fullmatch(r"\d+[snd]", f) for f in fields):
            continue
        if len(fields) != len(header) or fields[0] != "USGS":
            raise ClockContractError(f"Malformed RDB row at line {line_number}")
        raw = dict(zip(header, fields))
        stamp = utc_timestamp(raw["datetime"], raw["tz_cd"], raw["site_no"])
        try:
            value = float(raw[flow])
            if not math.isfinite(value):
                value = None
        except ValueError:
            value = None
        output.append({
            "agency_cd": raw["agency_cd"], "usgs_id": raw["site_no"],
            "source_datetime": raw["datetime"], "source_tz_cd": raw["tz_cd"],
            "timestamp_utc": iso_utc(stamp), "source_series": flow,
            "source_value": raw[flow], "flow_cfs": value,
            "qualifiers": raw.get(flow + "_cd", ""), "source_line": line_number,
            "usgs_data_source": "instantaneous_value", "clock_contract": CONTRACT_VERSION,
        })
    if header is None:
        raise ClockContractError("No NWIS RDB header found")
    return output


def unique_observations(records: list[dict]) -> tuple[list[dict], int]:
    """Collapse identical UTC observations; fail on value/qualifier/series conflict.

    Both fall-back hours survive because UTC conversion happens first. The raw
    response preserves every repeated record; removed exact copies are counted.
    """
    seen = {}
    duplicates = 0
    for record in records:
        if record.get("clock_contract") != CONTRACT_VERSION:
            raise ClockContractError("Missing validated UTC clock contract")
        stamp = utc_timestamp(record["timestamp_utc"])
        key = (record["usgs_id"], iso_utc(stamp))
        if key in seen:
            previous = seen[key]
            fields = ("source_value", "qualifiers", "source_series", "usgs_data_source")
            if any(previous[k] != record[k] for k in fields):
                raise ClockContractError(f"Conflicting observations at {key}")
            duplicates += 1
        else:
            seen[key] = dict(record)
    return [seen[k] for k in sorted(seen)], duplicates


def hourly_observations(records: list[dict], mode: str) -> list[dict]:
    """Declare aggregation semantics explicitly, without imputing missing values.

    exact: only observations recorded exactly on a UTC hour, for valid-time joins.
    mean_start: legacy-compatible UTC mean over [t,t+1h), labeled at interval start.
    mean_end: mean over (t-1h,t], labeled at interval end. A mean is not a point
    observation; choosing one for scientific targets requires a documented protocol.
    """
    if mode not in ("exact", "mean_start", "mean_end"):
        raise ValueError("Choose exact, mean_start or mean_end explicitly")
    unique, _ = unique_observations(records)
    groups = {}
    for record in unique:
        if record["flow_cfs"] is None or not math.isfinite(record["flow_cfs"]):
            continue
        stamp = utc_timestamp(record["timestamp_utc"])
        floor = stamp.replace(minute=0, second=0, microsecond=0)
        if mode == "exact" and stamp != floor:
            continue
        label = floor + timedelta(hours=1) if mode == "mean_end" and stamp != floor else floor
        groups.setdefault((record["usgs_id"], iso_utc(label)), []).append(record)
    output = []
    for (site, stamp), group in sorted(groups.items()):
        mean = sum(r["flow_cfs"] for r in group) / len(group)
        output.append({"usgs_id": site, "timestamp": stamp, "flow_cfs": mean,
                       "flow_cms": mean * CFS_TO_CMS, "observation_count": len(group),
                       "first_sample_utc": min(r["timestamp_utc"] for r in group),
                       "last_sample_utc": max(r["timestamp_utc"] for r in group),
                       "qualifiers": ";".join(sorted({r["qualifiers"] for r in group})),
                       "aggregation": mode, "usgs_data_source": "instantaneous_value",
                       "clock_contract": CONTRACT_VERSION})
    return output


def write_csv_exclusive(path: Path, records: list[dict]) -> str:
    """Create a new CSV, refusing overwrite; caller owns version-directory policy."""
    if not records:
        raise ClockContractError("Refusing to write an empty observation dataset")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("x", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(records[0]))
        writer.writeheader()
        writer.writerows(records)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_hourly_csv(path: Path, site_id: str, aggregation: str, content: bytes | None = None) -> list[dict]:
    """Validate versioned corrected CSVs before joining to UTC model valid times."""
    if content is None:
        if getattr(path.stat(), "st_flags", 0) & 0x40000000:
            raise ClockContractError("Refusing to hydrate hourly observations")
        content = path.read_bytes()
    rows = list(csv.DictReader(io.StringIO(content.decode("utf-8"))))
    seen = set()
    if not rows:
        raise ClockContractError("Empty corrected dataset")
    for row in rows:
        if (row.get("clock_contract") != CONTRACT_VERSION or row.get("aggregation") != aggregation
                or row.get("usgs_id") != site_id or row.get("usgs_data_source") != "instantaneous_value"):
            raise ClockContractError("Wrong site, source, clock or aggregation contract")
        stamp = utc_timestamp(row["timestamp"])
        if not row["timestamp"].endswith("Z") or stamp.minute or stamp.second or stamp.microsecond:
            raise ClockContractError("Corrected hourly timestamps must be canonical UTC hours")
        if stamp in seen:
            raise ClockContractError("Duplicate UTC hourly timestamp")
        seen.add(stamp)
        value = float(row["flow_cfs"])
        cms = float(row["flow_cms"])
        if not math.isfinite(value) or not math.isfinite(cms) or not math.isclose(cms, value * CFS_TO_CMS, rel_tol=1e-12, abs_tol=1e-12):
            raise ClockContractError("Invalid discharge units or finite support")
        first = utc_timestamp(row["first_sample_utc"])
        last = utc_timestamp(row["last_sample_utc"])
        if first > last:
            raise ClockContractError("Invalid sample interval")
        if aggregation == "exact" and (first != stamp or last != stamp or int(row["observation_count"]) != 1):
            raise ClockContractError("Exact observation is not a point at the label")
        if aggregation == "mean_start" and not stamp <= first <= last < stamp + timedelta(hours=1):
            raise ClockContractError("Samples outside declared start-labeled interval")
        if aggregation == "mean_end" and not stamp - timedelta(hours=1) < first <= last <= stamp:
            raise ClockContractError("Samples outside declared end-labeled interval")
    return rows
