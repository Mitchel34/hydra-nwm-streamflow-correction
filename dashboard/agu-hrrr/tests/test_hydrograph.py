import json
import unittest
from datetime import timedelta
from pathlib import Path
from prepare_hydrographs import START, END, M3_PER_FT3, summarize

def feature(i, value=10, status="Approved", qualifier=None):
    return {"properties":{"monitoring_location_id":"USGS-03164000","parameter_code":"00060",
            "statistic_id":"00003","unit_of_measure":"ft^3/s","time":str(START+timedelta(days=i)),
            "approval_status":status,"qualifier":qualifier,"value":value,"time_series_id":"example"}}

class WeeklyFlows(unittest.TestCase):
    def test_complete_weeks_only(self):
        source=[feature(i,0 if i<7 else 20) for i in range(21)]
        source[10]=feature(10,status="Provisional")
        source[15]=feature(15,qualifier="e")
        weeks,digest=summarize(source,"03164000")
        self.assertEqual(weeks[:3],[{"mean":0,"days":7},{"mean":None,"days":6},{"mean":None,"days":6}])
        self.assertEqual(len(digest),64)
        self.assertEqual(weeks[3],{"mean":None,"days":0})
        weeks,_=summarize([feature(i) for i in range(7)],"03164000")
        self.assertEqual(weeks[0]["mean"],round(10*M3_PER_FT3,3))

    def test_identity_duplicate_and_date_bounds(self):
        base=[feature(i) for i in range(7)]
        for records,station in [(base,"03161000"),(base+[base[0]],"03164000"),(base+[feature(-1)],"03164000")]:
            with self.assertRaises(ValueError):
                summarize(records,station)

    def test_released_tables_have_an_explicit_disposition_for_every_week(self):
        path=Path(__file__).resolve().parents[1]/"site/files/flow-weeks.json"
        data=json.loads(path.read_text())
        self.assertEqual(len(data["weeks"]),39)
        self.assertEqual((END-START).days+1,7*39)
        self.assertEqual(set(data["sites"]),{"Galax","Jefferson","Sugar Grove"})
        for series in data["sites"].values():
            self.assertEqual(len(series["values"]),39)
            self.assertTrue(all((v["mean"] is None)==(v["days"]<7) for v in series["values"]))
            self.assertTrue(all(0<=v["days"]<=7 for v in series["values"]))

if __name__=="__main__":
    unittest.main()
