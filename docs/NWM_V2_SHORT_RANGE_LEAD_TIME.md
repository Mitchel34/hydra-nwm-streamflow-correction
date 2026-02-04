## How lead time is derived for NWM v2 short-range in this repo

Short-range forecast NetCDF files follow the canonical NWM naming scheme:

```
nwm.YYYYMMDD/short_range/nwm.tHHz.short_range.channel_rt.fFFF.conus.nc
```

- `YYYYMMDD` and `HH` uniquely identify the forecast initialization time `t0` (UTC).  
- `FFF` is the zero-padded forecast hour (`f001`, `f018`, …).

During download the collector parses those components directly, computes:

1. `init_time = UTC datetime built from YYYY-MM-DD and HH`,
2. `lead_time_hours = int(FFF)`,
3. `valid_time = init_time + timedelta(hours=lead_time_hours)`.

Each row stored in `data/processed/nwm_v2_short_range/<site_id>/…parquet` therefore has an explicit (`init_time`, `lead_time_hours`, `valid_time`) triplet together with the site’s COMID, NWM discharge, and the aligned USGS observation (hourly mean). Because the lead is inferred from the filename rather than interpolated from valid timestamps, the dataset exactly matches the underlying NOAA archive and fails fast if any file strays from the v2 short-range convention.
