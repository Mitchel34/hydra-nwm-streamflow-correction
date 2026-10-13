"""Exercise actual acquisition adapter and downstream loader without network/data."""
from pathlib import Path
import json
import sys
import tempfile
import unittest
from unittest.mock import patch
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from data_acquisition_scripts import usgs
from modeling.dataset.build_training_dataset import load_usgs_hourly, build_dataset
from data_acquisition_scripts.usgs_time_contract import ClockContractError
from scripts.convert_usgs_utc import convert
from test_usgs_time_contract import rdb


class Collector:
    def __init__(self, text): self.text = text
    def fetch_with_retry(self, url):
        class Response: pass
        response=Response(); response.text=self.text
        return response


class IntegrationTests(unittest.TestCase):
    def test_adapter_preserves_both_fall_hours_and_response(self):
        raw=rdb([('2019-11-03 01:00','EDT',10,'A'),('2019-11-03 01:00','EST',20,'A')])
        frame=usgs.fetch_site('03161000',{'name':'Test'},'2019-11-03','2019-11-03',Collector(raw),'exact')
        self.assertEqual(frame['timestamp'].tolist(),['2019-11-03T05:00:00Z','2019-11-03T06:00:00Z'])
        self.assertEqual(frame.attrs['response_text'],raw)
        self.assertEqual(frame['flow_cfs'].tolist(),[10,20])

    def test_adapter_rejects_conflicts_and_wrong_site(self):
        for raw in [rdb([('2019-01-15 12:00','EST',10,'A'),('2019-01-15 12:00','EST',20,'A')]),
                    rdb([('2019-01-15 12:00','EST',10,'A')],'03164000')]:
            with self.assertRaises(ClockContractError):
                usgs.fetch_range('03161000','2019-01-15','2019-01-15',Collector(raw))

    def test_adapter_excludes_dataframe_nan_in_point_and_interval_outputs(self):
        raw=rdb([('2019-01-15 12:00','EST','Ice','A'),('2019-01-15 12:15','EST',20,'A'),
                 ('2019-01-15 13:00','EST',30,'A')])
        for mode, expected in [('exact',[30]),('mean_start',[20,30]),('mean_end',[25])]:
            with self.subTest(mode=mode):
                frame=usgs.fetch_site('03161000',{'name':'Test'},'2019-01-15','2019-01-15',Collector(raw),mode)
                self.assertEqual(frame['flow_cfs'].tolist(),expected)
                self.assertTrue(frame['flow_cfs'].notna().all())
                self.assertEqual(frame['observation_count'].sum(),1 if mode=='exact' else 2)

    def test_loader_accepts_only_hash_bound_explicit_point_dataset(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); source=root/'sample.rdb'
            source.write_text(rdb([('2019-01-15 12:00','EST',10,'A')]))
            convert([source],root/'v1','exact')
            frame=load_usgs_hourly(str(root),'03161000',str(root/'v1'),'exact')
            self.assertEqual(str(frame['timestamp'].iloc[0]),'2019-01-15 17:00:00')
            self.assertAlmostEqual(frame['usgs_cms'].iloc[0],0.28316846592)
            self.assertEqual(frame.attrs['clock_contract'],'usgs-utc-v1')
            with self.assertRaises(ClockContractError):load_usgs_hourly(str(root),'03161000')
            with self.assertRaises(ClockContractError):load_usgs_hourly(str(root),'03161000',str(root/'v1'),'mean_start')
            path=root/'v1/usgs/03161000_consolidated.csv'; path.write_text(path.read_text().replace('17:00:00Z','18:00:00Z'))
            with self.assertRaises(ClockContractError):load_usgs_hourly(str(root),'03161000',str(root/'v1'),'exact')

    def test_builder_requires_contract_and_refuses_existing_output_before_read(self):
        with tempfile.TemporaryDirectory() as temp:
            with self.assertRaises(ClockContractError):build_dataset(out_dir=temp)
            with self.assertRaises(FileExistsError):
                build_dataset(out_dir=temp,usgs_corrected_dir='not-read',usgs_aggregation='exact')

    def test_legacy_cli_disabled(self):
        with self.assertRaises(SystemExit) as error:usgs.main()
        self.assertIn('Legacy bulk acquisition/export is disabled',str(error.exception))

    def test_actual_builder_joins_corrected_valid_time_and_records_lineage(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); source=root/'sample.rdb'
            source.write_text(rdb([('2019-01-15 12:00','EST',10,'A')]))
            convert([source],root/'v1','exact')
            # A fixed synthetic NWM valid-time input verifies the real join/target
            # code. It makes no claim about historical provider NWM/ERA5 values.
            nwm=pd.DataFrame({'timestamp':pd.to_datetime(['2019-01-15 12:00','2019-01-15 17:00']),
                              'comid':[6892192,6892192],'nwm_cms':[99.,0.1]})
            with patch('modeling.dataset.build_training_dataset.load_nwm_hourly',return_value=nwm), \
                 patch('modeling.dataset.build_training_dataset.load_era5_features',return_value=None):
                frame=build_dataset(out_dir=str(root/'new-inputs'),sites=['03161000'],
                                    usgs_corrected_dir=str(root/'v1'),usgs_aggregation='exact')
            self.assertEqual(len(frame),1)
            self.assertEqual(str(frame['timestamp'].iloc[0]),'2019-01-15 17:00:00')
            self.assertAlmostEqual(frame['y_residual_cms'].iloc[0],0.18316846592)
            receipt=json.loads((root/'new-inputs/clock_provenance.json').read_text())
            self.assertFalse(receipt['scientific_performance_verified'])
            self.assertEqual(receipt['usgs_clock_contract'],'usgs-utc-v1')

    def test_dataless_manifest_is_rejected_before_read(self):
        from types import SimpleNamespace
        manifest=Path('/unopened-version/manifest.json')
        with patch.object(Path,'stat',return_value=SimpleNamespace(st_flags=0x40000000)), \
             patch.object(Path,'read_text',side_effect=AssertionError('must not read placeholder')), \
             self.assertRaises(ClockContractError):
            load_usgs_hourly('unused','03161000',str(manifest.parent),'exact')

    def test_loader_parses_the_same_bytes_as_the_hash(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); source=root/'sample.rdb'
            source.write_text(rdb([('2019-01-15 12:00','EST',10,'A')]))
            convert([source],root/'v1','exact')
            csv_path=root/'v1/usgs/03161000_consolidated.csv'
            original_read=Path.read_bytes; reads=[]
            def changing_read(path):
                body=original_read(path)
                if path.resolve()==csv_path.resolve():
                    reads.append(path); path.write_bytes(body.replace(b'17:00:00Z',b'18:00:00Z'))
                return body
            with patch.object(Path,'read_bytes',changing_read):
                frame=load_usgs_hourly('unused','03161000',str(root/'v1'),'exact')
            self.assertEqual(len(reads),1)
            self.assertEqual(str(frame['timestamp'].iloc[0]),'2019-01-15 17:00:00')

    def test_loader_carries_the_validated_manifest_identity(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp); source=root/'sample.rdb'
            source.write_text(rdb([('2019-01-15 12:00','EST',10,'A')]))
            convert([source],root/'v1','exact')
            path=root/'v1/manifest.json'; original_bytes=path.read_bytes(); original_read=Path.read_bytes
            def changing_read(current):
                body=original_read(current)
                if current==path:current.write_text('{}')
                return body
            with patch.object(Path,'read_bytes',changing_read):
                frame=load_usgs_hourly('unused','03161000',str(root/'v1'),'exact')
            self.assertEqual(frame.attrs['manifest_sha256'],hashlib.sha256(original_bytes).hexdigest())


if __name__ == '__main__':unittest.main()
