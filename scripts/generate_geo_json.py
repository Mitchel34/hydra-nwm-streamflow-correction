#!/usr/bin/env python3
"""Generate simplified GeoJSON files for the dashboard study region map.

Downloads Natural Earth state boundaries, clips to study region bbox,
and creates states.geojson + manually-traced rivers.geojson + watersheds.geojson.

Usage:
    python scripts/generate_geo_json.py
"""

import json
import math
import os
import urllib.request
from pathlib import Path

OUT_DIR = Path(__file__).resolve().parent.parent / "dashboard" / "public" / "data" / "geo"

# Bounding box for the study region
BBOX = {
    "min_lon": -82.5,
    "max_lon": -80.5,
    "min_lat": 35.8,
    "max_lat": 37.0,
}

# FIPS codes for states of interest
TARGET_STATES = {"37": "North Carolina", "51": "Virginia", "47": "Tennessee"}


def clip_coords_to_bbox(coords, bbox):
    """Clip coordinate list to bounding box, keeping points near the boundary."""
    clipped = []
    for lon, lat in coords:
        # Keep points within bbox with small buffer for edge smoothness
        if (bbox["min_lon"] - 0.1 <= lon <= bbox["max_lon"] + 0.1 and
                bbox["min_lat"] - 0.1 <= lat <= bbox["max_lat"] + 0.1):
            # Clamp to bbox
            lon = max(bbox["min_lon"], min(bbox["max_lon"], lon))
            lat = max(bbox["min_lat"], min(bbox["max_lat"], lat))
            clipped.append([round(lon, 3), round(lat, 3)])
    return clipped


def simplify_coords(coords, tolerance=0.01):
    """Simple Douglas-Peucker-like simplification."""
    if len(coords) <= 2:
        return coords

    # Find point with max distance from line between first and last
    first, last = coords[0], coords[-1]
    max_dist = 0
    max_idx = 0

    for i in range(1, len(coords) - 1):
        # Distance from point to line
        dx = last[0] - first[0]
        dy = last[1] - first[1]
        if dx == 0 and dy == 0:
            dist = math.sqrt((coords[i][0] - first[0])**2 + (coords[i][1] - first[1])**2)
        else:
            t = ((coords[i][0] - first[0]) * dx + (coords[i][1] - first[1]) * dy) / (dx*dx + dy*dy)
            t = max(0, min(1, t))
            proj_x = first[0] + t * dx
            proj_y = first[1] + t * dy
            dist = math.sqrt((coords[i][0] - proj_x)**2 + (coords[i][1] - proj_y)**2)
        if dist > max_dist:
            max_dist = dist
            max_idx = i

    if max_dist > tolerance:
        left = simplify_coords(coords[:max_idx+1], tolerance)
        right = simplify_coords(coords[max_idx:], tolerance)
        return left[:-1] + right
    else:
        return [first, last]


def process_states():
    """Download and process Natural Earth state boundaries."""
    url = "https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json"
    print(f"Downloading US states GeoJSON from {url}...")

    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode())

    features = []
    # Map state names to abbreviations
    name_to_abbr = {
        "North Carolina": "NC",
        "Virginia": "VA",
        "Tennessee": "TN",
    }

    for feature in data["features"]:
        name = feature["properties"].get("name", "")
        if name not in name_to_abbr:
            continue

        abbr = name_to_abbr[name]
        geom = feature["geometry"]

        if geom["type"] == "Polygon":
            rings = []
            for ring in geom["coordinates"]:
                clipped = clip_coords_to_bbox(ring, BBOX)
                if len(clipped) >= 3:
                    simplified = simplify_coords(clipped, 0.008)
                    if len(simplified) >= 3:
                        # Close the ring
                        if simplified[0] != simplified[-1]:
                            simplified.append(simplified[0])
                        rings.append(simplified)
            if rings:
                features.append({
                    "type": "Feature",
                    "properties": {"name": abbr},
                    "geometry": {"type": "Polygon", "coordinates": rings},
                })

        elif geom["type"] == "MultiPolygon":
            polygons = []
            for polygon in geom["coordinates"]:
                rings = []
                for ring in polygon:
                    clipped = clip_coords_to_bbox(ring, BBOX)
                    if len(clipped) >= 3:
                        simplified = simplify_coords(clipped, 0.008)
                        if len(simplified) >= 3:
                            if simplified[0] != simplified[-1]:
                                simplified.append(simplified[0])
                            rings.append(simplified)
                if rings:
                    polygons.append(rings)
            if len(polygons) == 1:
                features.append({
                    "type": "Feature",
                    "properties": {"name": abbr},
                    "geometry": {"type": "Polygon", "coordinates": polygons[0]},
                })
            elif polygons:
                features.append({
                    "type": "Feature",
                    "properties": {"name": abbr},
                    "geometry": {"type": "MultiPolygon", "coordinates": polygons},
                })

    geojson = {"type": "FeatureCollection", "features": features}
    out_path = OUT_DIR / "states.geojson"
    with open(out_path, "w") as f:
        json.dump(geojson, f)
    size = os.path.getsize(out_path)
    print(f"  Wrote {out_path} ({size:,} bytes, {len(features)} features)")
    return geojson


def create_rivers():
    """Create river GeoJSON with manually traced coordinates.

    Coordinates traced from USGS National Map / NHD for the main stems
    within the study region bounding box.
    """
    features = [
        {
            "type": "Feature",
            "properties": {"name": "New River", "order": 4},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    # New River flowing NE from NC into VA
                    # Headwaters near Blowing Rock, NC
                    [-81.680, 36.130],
                    [-81.620, 36.170],
                    [-81.560, 36.210],
                    [-81.510, 36.260],
                    [-81.470, 36.310],
                    [-81.430, 36.350],
                    [-81.410, 36.390],
                    [-81.380, 36.420],
                    # Past Jefferson, NC
                    [-81.340, 36.450],
                    [-81.290, 36.480],
                    [-81.240, 36.510],
                    [-81.190, 36.540],
                    [-81.140, 36.570],
                    [-81.100, 36.590],
                    # Into VA
                    [-81.050, 36.620],
                    [-81.000, 36.640],
                    [-80.970, 36.650],
                    # Past Galax, VA and continuing NE
                    [-80.930, 36.660],
                    [-80.870, 36.680],
                    [-80.810, 36.710],
                    [-80.750, 36.740],
                    [-80.690, 36.770],
                    [-80.620, 36.800],
                    [-80.560, 36.830],
                    [-80.500, 36.860],
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"name": "South Fork New River", "order": 3},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    # South Fork flowing NE to confluence with New River
                    [-81.700, 36.050],
                    [-81.660, 36.090],
                    [-81.620, 36.130],
                    [-81.580, 36.170],
                    [-81.540, 36.210],
                    [-81.490, 36.250],
                    [-81.450, 36.290],
                    [-81.420, 36.330],
                    [-81.410, 36.370],
                    [-81.410, 36.390],  # Confluence area near Jefferson
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"name": "Watauga River", "order": 3},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    # Watauga River flowing generally west from headwaters
                    [-81.640, 36.160],
                    [-81.700, 36.180],
                    [-81.750, 36.200],
                    [-81.800, 36.220],
                    # Past Sugar Grove
                    [-81.830, 36.230],
                    [-81.880, 36.240],
                    [-81.940, 36.250],
                    [-82.000, 36.260],
                    [-82.060, 36.280],
                    [-82.120, 36.300],
                    [-82.180, 36.320],
                    [-82.230, 36.340],
                    [-82.280, 36.350],
                    [-82.340, 36.360],
                    [-82.400, 36.370],
                    [-82.450, 36.380],
                    [-82.500, 36.380],
                ],
            },
        },
        {
            "type": "Feature",
            "properties": {"name": "North Fork New River", "order": 3},
            "geometry": {
                "type": "LineString",
                "coordinates": [
                    # North Fork tributary
                    [-81.380, 36.200],
                    [-81.350, 36.240],
                    [-81.330, 36.280],
                    [-81.340, 36.320],
                    [-81.360, 36.360],
                    [-81.380, 36.400],
                    [-81.380, 36.420],  # Confluence
                ],
            },
        },
    ]

    geojson = {"type": "FeatureCollection", "features": features}
    out_path = OUT_DIR / "rivers.geojson"
    with open(out_path, "w") as f:
        json.dump(geojson, f)
    size = os.path.getsize(out_path)
    print(f"  Wrote {out_path} ({size:,} bytes, {len(features)} features)")
    return geojson


def create_watersheds():
    """Create watershed boundary GeoJSON.

    Approximate HUC-8 watershed boundaries for:
    - 05050001: South Fork New River (covers Jefferson gauge)
    - 06010103: Watauga River (covers Sugar Grove gauge)

    Coordinates approximated from USGS WBD viewer.
    """
    features = [
        {
            "type": "Feature",
            "properties": {
                "name": "S. Fork New River Basin",
                "huc8": "05050001",
                "site": "03161000",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    # Approximate boundary of the S. Fork New River watershed
                    [-81.700, 36.050],
                    [-81.620, 36.010],
                    [-81.520, 35.990],
                    [-81.400, 36.000],
                    [-81.300, 36.030],
                    [-81.200, 36.080],
                    [-81.150, 36.150],
                    [-81.130, 36.230],
                    [-81.150, 36.310],
                    [-81.200, 36.370],
                    [-81.270, 36.420],
                    [-81.350, 36.450],
                    [-81.430, 36.450],
                    [-81.510, 36.420],
                    [-81.570, 36.370],
                    [-81.630, 36.310],
                    [-81.680, 36.240],
                    [-81.720, 36.170],
                    [-81.730, 36.100],
                    [-81.700, 36.050],  # Close ring
                ]],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "name": "New River Mainstem",
                "huc8": "05050002",
                "site": "03164000",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    # Approximate boundary covering Galax area
                    [-81.430, 36.450],
                    [-81.350, 36.450],
                    [-81.270, 36.460],
                    [-81.180, 36.490],
                    [-81.080, 36.520],
                    [-80.980, 36.560],
                    [-80.900, 36.600],
                    [-80.830, 36.650],
                    [-80.800, 36.720],
                    [-80.820, 36.790],
                    [-80.880, 36.840],
                    [-80.960, 36.860],
                    [-81.060, 36.850],
                    [-81.150, 36.810],
                    [-81.230, 36.760],
                    [-81.300, 36.700],
                    [-81.370, 36.630],
                    [-81.420, 36.560],
                    [-81.440, 36.500],
                    [-81.430, 36.450],  # Close ring
                ]],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "name": "Watauga River Basin",
                "huc8": "06010103",
                "site": "03479000",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    # Approximate boundary of the Watauga watershed
                    [-81.600, 36.120],
                    [-81.650, 36.080],
                    [-81.730, 36.060],
                    [-81.830, 36.070],
                    [-81.940, 36.090],
                    [-82.050, 36.120],
                    [-82.160, 36.160],
                    [-82.260, 36.200],
                    [-82.350, 36.250],
                    [-82.420, 36.310],
                    [-82.460, 36.370],
                    [-82.480, 36.430],
                    [-82.450, 36.470],
                    [-82.380, 36.480],
                    [-82.290, 36.460],
                    [-82.200, 36.430],
                    [-82.100, 36.400],
                    [-82.000, 36.370],
                    [-81.900, 36.340],
                    [-81.800, 36.310],
                    [-81.720, 36.280],
                    [-81.660, 36.240],
                    [-81.620, 36.190],
                    [-81.600, 36.120],  # Close ring
                ]],
            },
        },
    ]

    geojson = {"type": "FeatureCollection", "features": features}
    out_path = OUT_DIR / "watersheds.geojson"
    with open(out_path, "w") as f:
        json.dump(geojson, f)
    size = os.path.getsize(out_path)
    print(f"  Wrote {out_path} ({size:,} bytes, {len(features)} features)")
    return geojson


if __name__ == "__main__":
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print("Generating GeoJSON files for dashboard study region map...")
    print()

    print("1. State boundaries:")
    process_states()
    print()

    print("2. River flowlines:")
    create_rivers()
    print()

    print("3. Watershed boundaries:")
    create_watersheds()
    print()

    # Report total size
    total = sum(
        os.path.getsize(OUT_DIR / f)
        for f in ["states.geojson", "rivers.geojson", "watersheds.geojson"]
    )
    print(f"Total: {total:,} bytes ({total/1024:.1f} KB)")
