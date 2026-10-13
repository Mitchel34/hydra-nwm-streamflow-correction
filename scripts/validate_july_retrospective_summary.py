#!/usr/bin/env python3
"""Validate the small saved July summary packet, without loading research data."""
from pathlib import Path
import csv
import hashlib
import json
import math

ROOT=Path(__file__).resolve().parents[1]
PACKET=ROOT/'docs/research/july-retrospective-2026'
SITES={'03161000','03164000','03479000'}
CONFIGS={'usgs_nwm_era5','usgs_era5_direct','nwm_era5'}

def close(a,b):
    return math.isclose(float(a),float(b),rel_tol=1e-10,abs_tol=1e-10)

def rows(name):
    with (PACKET/name).open(newline='') as f:
        return list(csv.DictReader(f))

def main():
    metrics=rows('metrics.csv')
    expected={(c,s) for c in CONFIGS for s in SITES}
    keys=[(r['configuration'],r['site']) for r in metrics]
    assert len(keys)==9 and set(keys)==expected and len(set(keys))==9
    for row in metrics:
        assert int(row['n_seeds'])==3 and set(map(int,row['seeds'].split(',')))=={42,314,2718}
        assert int(row['test_target_count'])>0
        for key,value in row.items():
            if key.endswith(('_mean','_sd')):
                assert math.isfinite(float(value)),key
                if key.endswith('_sd'):assert float(value)>=0,key
        # NWM baseline and support are fixed across seeds in this packet.
        assert close(100*(1-float(row['corrected_rmse_mean'])/float(row['nwm_rmse_mean'])),row['rmse_reduction_pct_mean'])
    for site in SITES:
        group=[r for r in metrics if r['site']==site]
        assert len({r['test_target_count'] for r in group})==1
        assert len({r['nwm_rmse_mean'] for r in group})==1
    by={(r['configuration'],r['site']):r for r in metrics}
    ablation=rows('input_ablation.csv')
    assert len(ablation)==3 and {r['site'] for r in ablation}==SITES
    for row in ablation:
        site=row['site']
        for c in CONFIGS:assert close(row[c],by[c,site]['rmse_reduction_pct_mean'])
        assert close(float(row['usgs_nwm_era5'])-float(row['usgs_era5_direct']),row['nwm_add_on_pct_points'])
        assert close(float(row['usgs_nwm_era5'])-float(row['nwm_era5']),row['gauge_add_on_pct_points'])
    persistence=rows('persistence.csv')
    assert len(persistence)==3 and {r['site_id'] for r in persistence}==SITES
    for row in persistence:
        assert 0<int(row['n_exact_hour_pairs'])<int(by['usgs_nwm_era5',row['site_id']]['test_target_count'])
        assert close(100*(1-float(row['flow_persist_rmse'])/float(row['nwm_rmse'])),row['flow_persist_reduction'])
        assert close(100*(1-float(row['res_persist_rmse'])/float(row['nwm_rmse'])),row['res_persist_reduction'])
    provenance=json.loads((PACKET/'provenance.json').read_text())
    for record in provenance['packet_files']:
        p=PACKET/record['path']
        assert hashlib.sha256(p.read_bytes()).hexdigest()==record['sha256'],p.name
    print(json.dumps({'status':'PASS','configuration_site_rows':len(metrics),'scope':'Saved-summary arithmetic and packet hashes only; raw predictions/data remain unverified.'}))

if __name__=='__main__':
    main()
