"""Build only weekly summaries from public USGS fitting-period daily discharge."""
from datetime import date, timedelta
from hashlib import sha256
import json
import math
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

START, END = date(2021, 5, 3), date(2022, 1, 30)
SITES = {"Galax": "03164000", "Jefferson": "03161000", "Sugar Grove": "03479000"}
ENDPOINT = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/daily/items"
M3_PER_FT3 = 0.028316846592


def source_url(station):
    return ENDPOINT + "?" + urlencode({
        "monitoring_location_id": "USGS-" + station, "parameter_code": "00060",
        "statistic_id": "00003", "time": f"{START}/{END}", "limit": 1000, "f": "json",
    })


def summarize(features, station):
    by_day = {}
    records = []
    for item in features:
        p = item["properties"]
        if (p["monitoring_location_id"], p["parameter_code"], p["statistic_id"],
            p["unit_of_measure"]) != ("USGS-" + station, "00060", "00003", "ft^3/s"):
            raise ValueError("Unexpected station, parameter, statistic, or units")
        day = date.fromisoformat(p["time"])
        if not START <= day <= END or day in by_day:
            raise ValueError("Duplicate or out-of-window USGS date")
        flag = p.get("qualifier")
        records.append([p["time"], p["time_series_id"], p["approval_status"], flag, p["value"]])
        value = None
        if p["approval_status"] == "Approved" and flag in (None, "", []) and p["value"] is not None:
            n = float(p["value"])
            if math.isfinite(n) and n >= 0:
                value = n * M3_PER_FT3
        by_day[day] = value
    weeks = []
    for offset in range(0, (END-START).days+1, 7):
        monday = START + timedelta(days=offset)
        daily = [by_day.get(monday + timedelta(days=i)) for i in range(7)]
        valid = [v for v in daily if v is not None]
        weeks.append({"mean": round(math.fsum(valid)/7, 3) if len(valid)==7 else None, "days": len(valid)})
    if not any(w["mean"] is not None for w in weeks):
        raise ValueError("No complete, approved weeks in the requested station series")
    fingerprint = json.dumps(sorted(records), separators=(",", ":"), ensure_ascii=False).encode()
    return weeks, sha256(fingerprint).hexdigest()


def build():
    result = {"units": "m³/s", "start": str(START), "end": str(END),
              "weeks": [str(START + timedelta(days=n)) for n in range(0, (END-START).days+1, 7)], "sites": {}}
    for name, station in SITES.items():
        url = source_url(station)
        with urlopen(Request(url, headers={"Accept": "application/geo+json", "User-Agent": "HYDRA-study-hydrographs/1.0"}), timeout=30) as response:
            public = json.load(response)
        if any(link.get("rel") == "next" for link in public.get("links", [])):
            raise ValueError("Unexpected second page for the bounded daily series")
        values, digest = summarize(public["features"], station)
        result["sites"][name] = {"station": station, "source": url, "source_fields_sha256": digest, "values": values}
    return result


if __name__ == "__main__":
    target = Path(__file__).resolve().parent / "site/files/flow-weeks.json"
    target.write_text(json.dumps(build(), ensure_ascii=False, indent=2, allow_nan=False) + "\n")
