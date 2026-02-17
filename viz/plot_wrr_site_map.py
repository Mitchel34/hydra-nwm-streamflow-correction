#!/usr/bin/env python3
"""WRR-style site map with terrain shading, rivers, and state boundaries.

Uses cartopy with Natural Earth data to produce a publication-quality
study-area map showing four USGS gauges, upstream/downstream links,
watershed labels, and the TVA regulation annotation.

Usage:
    PYTHONPATH=. python -m viz.plot_wrr_site_map --out results/figures/wrr_site_map.png
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import matplotlib.pyplot as plt
import matplotlib.lines as mlines
import matplotlib.patheffects as pe

import cartopy.crs as ccrs
import cartopy.feature as cfeature

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from config.master_study_sites import MASTER_STUDY_SITES


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=Path("results/figures/wrr_site_map.pdf"))
    args = ap.parse_args()

    sites = ["03479000", "03161000", "03486000", "03164000"]
    data = {sid: MASTER_STUDY_SITES[sid] for sid in sites if sid in MASTER_STUDY_SITES}

    proj = ccrs.LambertConformal(central_longitude=-81.4, central_latitude=36.4)
    pc = ccrs.PlateCarree()

    fig = plt.figure(figsize=(8, 6.5))
    ax = fig.add_subplot(1, 1, 1, projection=proj)
    ax.set_extent([-82.8, -80.2, 35.7, 37.1], crs=pc)

    # Terrain background — Natural Earth shaded relief
    ax.stock_img()

    # State/province boundaries (replaces hardcoded coordinate arrays)
    states = cfeature.NaturalEarthFeature(
        "cultural", "admin_1_states_provinces_lines", "50m",
        facecolor="none",
    )
    ax.add_feature(states, edgecolor="#444444", linewidth=0.9, zorder=2)

    # Rivers
    rivers = cfeature.NaturalEarthFeature(
        "physical", "rivers_lake_centerlines", "10m",
        facecolor="none",
    )
    ax.add_feature(rivers, edgecolor="#3a7ebf", linewidth=0.8, alpha=0.8, zorder=2)

    # State labels with white outline for readability over terrain
    text_kw = dict(
        fontsize=10, fontstyle="italic", color="#333333", ha="center",
        transform=pc, zorder=6,
        path_effects=[pe.withStroke(linewidth=2.5, foreground="white")],
    )
    ax.text(-80.9, 36.85, "Virginia", **text_kw)
    ax.text(-81.4, 35.95, "North Carolina", **text_kw)
    ax.text(-82.55, 36.35, "Tennessee", **text_kw)

    # Plot gauge markers
    label_offsets = {
        "03479000": (0.08, -0.12),
        "03161000": (0.08, 0.05),
        "03486000": (0.08, 0.05),
        "03164000": (0.08, 0.05),
    }
    for sid, info in data.items():
        lat, lon = info["lat"], info["lon"]
        regulated = info.get("regulated_flag", False)
        marker = "s" if regulated else "o"
        color = "#d62728" if regulated else "#1f77b4"
        ax.scatter(
            lon, lat, s=120, marker=marker, color=color,
            edgecolor="black", linewidth=0.8, zorder=5, transform=pc,
        )
        dx, dy = label_offsets.get(sid, (0.08, 0.05))
        ax.annotate(
            f"{sid}\n{info['name']}",
            xy=(lon, lat),
            xytext=(lon + dx, lat + dy),
            fontsize=7, zorder=6,
            xycoords=pc._as_mpl_transform(ax),
            textcoords=pc._as_mpl_transform(ax),
            bbox=dict(
                boxstyle="round,pad=0.2", facecolor="white",
                edgecolor="none", alpha=0.85,
            ),
        )

    # Draw upstream -> downstream flow arrows
    for sid, info in data.items():
        for downstream in info.get("upstream_of", []):
            if downstream not in data:
                continue
            x0, y0 = info["lon"], info["lat"]
            x1, y1 = data[downstream]["lon"], data[downstream]["lat"]
            ax.annotate(
                "",
                xy=(x1, y1),
                xytext=(x0, y0),
                xycoords=pc._as_mpl_transform(ax),
                textcoords=pc._as_mpl_transform(ax),
                arrowprops=dict(
                    arrowstyle="-|>", color="#555555", lw=1.5,
                    connectionstyle="arc3,rad=0.1",
                ),
                zorder=3,
            )

    # Watershed basin labels
    nr_lon = (data["03161000"]["lon"] + data["03164000"]["lon"]) / 2
    nr_lat = (data["03161000"]["lat"] + data["03164000"]["lat"]) / 2 + 0.18
    ax.text(
        nr_lon, nr_lat, "New River Basin",
        fontsize=10, fontweight="bold", color="#1f77b4", alpha=0.9,
        ha="center", transform=pc, zorder=6,
        bbox=dict(
            boxstyle="round,pad=0.3", facecolor="white",
            edgecolor="#1f77b4", alpha=0.7,
        ),
    )

    wr_lon = (data["03479000"]["lon"] + data["03486000"]["lon"]) / 2
    wr_lat = min(data["03479000"]["lat"], data["03486000"]["lat"]) - 0.14
    ax.text(
        wr_lon, wr_lat, "Watauga River Basin",
        fontsize=10, fontweight="bold", color="#1f77b4", alpha=0.9,
        ha="center", transform=pc, zorder=6,
        bbox=dict(
            boxstyle="round,pad=0.3", facecolor="white",
            edgecolor="#1f77b4", alpha=0.7,
        ),
    )

    # TVA Dam annotation
    dam = data["03486000"]
    ax.annotate(
        "Watauga Dam\n(TVA)",
        xy=(dam["lon"], dam["lat"]),
        xytext=(dam["lon"] - 0.4, dam["lat"] + 0.18),
        fontsize=8, fontweight="bold", color="#d62728",
        xycoords=pc._as_mpl_transform(ax),
        textcoords=pc._as_mpl_transform(ax),
        arrowprops=dict(arrowstyle="->", color="#d62728", lw=1.0),
        bbox=dict(
            boxstyle="round,pad=0.3", facecolor="#fde8e8",
            edgecolor="#d62728", alpha=0.85,
        ),
        zorder=6,
    )

    # Lat/lon gridlines
    gl = ax.gridlines(
        draw_labels=True, linewidth=0.5, alpha=0.3, linestyle="--",
    )
    gl.top_labels = False
    gl.right_labels = False
    gl.xlabel_style = {"size": 8}
    gl.ylabel_style = {"size": 8}

    # Legend
    unreg_marker = mlines.Line2D(
        [], [], color="#1f77b4", marker="o", linestyle="None", markersize=8,
        markeredgecolor="black", markeredgewidth=0.8, label="Unregulated gauge",
    )
    reg_marker = mlines.Line2D(
        [], [], color="#d62728", marker="s", linestyle="None", markersize=8,
        markeredgecolor="black", markeredgewidth=0.8, label="Regulated gauge (TVA)",
    )
    flow_arrow = mlines.Line2D(
        [], [], color="#555555", linewidth=1.5, label="Flow direction",
    )
    ax.legend(
        handles=[unreg_marker, reg_marker, flow_arrow],
        loc="lower right", fontsize=8, framealpha=0.9,
    )

    ax.set_title(
        "Study Sites: Southern Appalachian Watersheds",
        fontsize=12, fontweight="bold", pad=12,
    )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(args.out, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Wrote: {args.out}")


if __name__ == "__main__":
    main()
