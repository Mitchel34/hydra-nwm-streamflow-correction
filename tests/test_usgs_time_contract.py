"""Bounded deterministic clock/duplicate/aggregation and offline export checks."""
import copy
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from data_acquisition_scripts.usgs_time_contract import (
    ClockContractError, CFS_TO_CMS, utc_timestamp, iso_utc, parse_rdb,
    unique_observations, hourly_observations, validate_hourly_csv, write_csv_exclusive,
)
from scripts.convert_usgs_utc import convert


def rdb(rows, site="03161000"):
    return ("# preserved provider response\nagency_cd\tsite_no\tdatetime\ttz_cd\t123_00060\t123_00060_cd\n"
            "5s\t15s\t20d\t6s\t14n\t10s\n" + "".join(f"USGS\t{site}\t{t}\t{tz}\t{v}\t{q}\n" for t, tz, v, q in rows))


class ClockTests(unittest.TestCase):
    def test_winter_and_summer(self):
        self.assertEqual(iso_utc(utc_timestamp("2019-01-15 12:00", "EST", "03161000")), "2019-01-15T17:00:00Z")
        self.assertEqual(iso_utc(utc_timestamp("2019-07-15 12:00", "EDT", "03161000")), "2019-07-15T16:00:00Z")

    def test_fall_repeated_hour_is_two_instants(self):
        records = parse_rdb(rdb([("2019-11-03 01:00", "EDT", 10, "A"), ("2019-11-03 01:00", "EST", 20, "A")]))
        unique, count = unique_observations(records)
        self.assertEqual(count, 0)
        self.assertEqual([r["timestamp_utc"] for r in unique], ["2019-11-03T05:00:00Z", "2019-11-03T06:00:00Z"])
        self.assertEqual([r["flow_cfs"] for r in hourly_observations(unique, "exact")], [10, 20])

    def test_spring_transition_is_contiguous_in_utc(self):
        stamps = [utc_timestamp("2019-03-10 01:00", "EST", "03161000"), utc_timestamp("2019-03-10 03:00", "EDT", "03161000")]
        self.assertEqual((stamps[1]-stamps[0]).total_seconds(), 3600)
        for code in ("EST", "EDT"):
            with self.assertRaises(ClockContractError):
                utc_timestamp("2019-03-10 02:30", code, "03161000")

    def test_unknown_missing_wrong_season_and_unregistered_fail(self):
        for text, code, site in [("2019-01-01 00:00", "", "03161000"), ("2019-01-01 00:00", "PST", "03161000"),
                                 ("2019-07-01 00:00", "EST", "03161000"), ("2019-01-01 00:00", "EDT", "03161000"),
                                 ("2019-01-01 00:00", "EST", "unknown"), ("bad date", "EST", "03161000")]:
            with self.subTest(text=text, code=code, site=site), self.assertRaises(ClockContractError):
                utc_timestamp(text, code, site)

    def test_aware_conversion_and_roundtrip(self):
        for text in ("2019-11-03T01:00:00-04:00", "2019-11-03T01:00:00-05:00", "2019-11-03T06:00:00Z", "2019-01-01T12:00:00+05:30"):
            utc = utc_timestamp(text)
            self.assertEqual(utc_timestamp(iso_utc(utc)), utc)
            self.assertEqual(utc.tzinfo, timezone.utc)
        with self.assertRaises(ClockContractError):
            utc_timestamp("2019-01-01T12:00:00Z", "EST", "03161000")
        with self.assertRaises(ClockContractError):
            iso_utc(datetime(2019, 1, 1))

    def test_schema_rows_multiblock_leading_zero_and_nonnumeric(self):
        response = rdb([("2019-01-15 12:00", "EST", "Ice", "A")]) + rdb([("2019-07-15 12:00", "EDT", 5, "P")], "03164000")
        rows = parse_rdb(response)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["usgs_id"], "03161000")
        self.assertEqual(rows[0]["source_value"], "Ice")
        self.assertIsNone(rows[0]["flow_cfs"])
        self.assertEqual(rows[1]["qualifiers"], "P")
        for bad in ("not an RDB file", response.replace("tz_cd", "missing"), response.replace("5s\t15s\t20d\t6s\t14n\t10s", "broken")):
            with self.assertRaises(ClockContractError): parse_rdb(bad)

    def test_duplicates_only_identical_conflicts_fail(self):
        records = parse_rdb(rdb([("2019-01-15 12:00", "EST", 10, "A")]))
        unique, count = unique_observations(records * 3)
        self.assertEqual((len(unique), count), (1, 2))
        for field, value in [("source_value", "11"), ("qualifiers", "P"), ("source_series", "456_00060")]:
            other = copy.deepcopy(records[0]); other[field] = value
            with self.assertRaises(ClockContractError): unique_observations(records + [other])

    def test_explicit_interval_boundaries_and_units(self):
        rows = parse_rdb(rdb([("2019-01-15 12:00", "EST", 10, "A"), ("2019-01-15 12:15", "EST", 20, "A"), ("2019-01-15 13:00", "EST", 30, "A")]))
        exact = hourly_observations(rows, "exact")
        start = hourly_observations(rows, "mean_start")
        end = hourly_observations(rows, "mean_end")
        self.assertEqual([r["flow_cfs"] for r in exact], [10, 30])
        self.assertEqual([r["flow_cfs"] for r in start], [15, 30])
        self.assertEqual([r["flow_cfs"] for r in end], [10, 25])
        self.assertAlmostEqual(start[0]["flow_cms"], 15*CFS_TO_CMS)
        with self.assertRaises(ValueError): hourly_observations(rows, "unspecified")
        with tempfile.TemporaryDirectory() as temp:
            for mode, records in [("exact", exact), ("mean_start", start), ("mean_end", end)]:
                path = Path(temp)/f"{mode}.csv"; write_csv_exclusive(path, records)
                self.assertEqual(len(validate_hourly_csv(path, "03161000", mode)), 2)
                with self.assertRaises(FileExistsError): write_csv_exclusive(path, records)
                with self.assertRaises(ClockContractError): validate_hourly_csv(path, "03164000", mode)
                with self.assertRaises(ClockContractError): validate_hourly_csv(path, "03161000", "wrong")

    def test_offline_versioned_converter_preserves_raw_and_refuses_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp); source = root/"sample.rdb"
            raw = rdb([("2019-07-15 12:00", "EDT", 10, "A")]); source.write_text(raw)
            manifest = convert([source], root/"v1", "exact")
            self.assertFalse(manifest["daily_fallback"])
            self.assertEqual((root/"v1/raw-responses/000-sample.rdb").read_text(), raw)
            self.assertEqual(len(validate_hourly_csv(root/"v1/usgs/03161000_consolidated.csv", "03161000", "exact")), 1)
            self.assertEqual(json.loads((root/"v1/manifest.json").read_text())["outputs"][0]["rows"], 1)
            with self.assertRaises(FileExistsError): convert([source], root/"v1", "exact")

    def test_archive_uses_the_same_bytes_as_conversion_if_source_changes(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); source=root/'sample.rdb'
            raw=rdb([('2019-07-15 12:00','EDT',10,'A')]); source.write_text(raw)
            original_read=Path.read_bytes; reads=[]
            def changing_read(path):
                body=original_read(path)
                if path == source:
                    reads.append(path)
                    source.write_text(rdb([('2019-07-15 12:00','EDT',999,'A')]))
                return body
            with patch.object(Path,'read_bytes',changing_read):
                manifest=convert([source],root/'v1','exact')
            self.assertEqual(len(reads),1)
            self.assertEqual((root/'v1/raw-responses/000-sample.rdb').read_text(),raw)
            import hashlib
            self.assertEqual(hashlib.sha256(raw.encode()).hexdigest(),manifest['sources'][0]['sha256'])

    def test_dataless_receipt_is_rejected_before_read_or_output(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); source=root/'sample.rdb'; receipt=root/'receipt.json'
            source.write_text(rdb([('2019-07-15 12:00','EDT',10,'A')]))
            receipt.write_text('{}'); original_stat=Path.stat
            def stat(path, *args, **kwargs):
                return SimpleNamespace(st_flags=0x40000000) if path==receipt else original_stat(path,*args,**kwargs)
            with patch.object(Path,'stat',stat), self.assertRaises(ClockContractError):
                convert([source],root/'v1','exact',receipt)
            self.assertFalse((root/'v1').exists())


if __name__ == "__main__":
    unittest.main()
