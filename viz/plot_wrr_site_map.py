#!/usr/bin/env python3
"""WRR-style site map: four gauges with upstream/downstream links,
watershed labels, TVA regulation annotation, and state boundaries."""

from __future__ import annotations

import argparse
from pathlib import Path

import os
import sys

import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import matplotlib.lines as mlines
import numpy as np

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from config.master_study_sites import MASTER_STUDY_SITES

# Simplified NC/VA/TN state boundary segments (approximate, for context)
NC_VA_BORDER = [
    (-84.32, 36.59), (-83.67, 36.60), (-83.25, 36.59), (-82.61, 36.59),
    (-82.03, 36.55), (-81.68, 36.59), (-81.34, 36.57), (-80.90, 36.56),
    (-80.44, 36.56), (-80.03, 36.54), (-79.51, 36.54),
]
NC_TN_BORDER = [
    (-84.32, 36.59), (-84.29, 36.27), (-84.01, 36.02), (-83.67, 35.98),
    (-83.25, 35.72), (-82.90, 35.62), (-82.61, 35.55), (-82.35, 35.47),
    (-82.03, 35.37), (-81.68, 35.18), (-81.34, 35.16),
]


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=Path("results/figures/wrr_site_map.png"))
    args = ap.parse_args()

    sites = ["03479000", "03161000", "03486000", "03164000"]
    data = {sid: MASTER_STUDY_SITES[sid] for sid in sites if sid in MASTER_STUDY_SITES}

    fig, ax = plt.subplots(figsize=(8, 6.5))

    # Draw state boundary context lines
    nc_va = np.array(NC_VA_BORDER)
    nc_tn = np.array(NC_TN_BORDER)
    ax.plot(nc_va[:, 0], nc_va[:, 1], color="#999999", linewidth=1.0,
            linestyle="-", alpha=0.5, zorder=1)
    ax.plot(nc_tn[:, 0], nc_tn[:, 1], color="#999999", linewidth=1.0,
            linestyle="-", alpha=0.5, zorder=1)

    # State labels
    ax.text(-81.0, 36.75, "Virginia", fontsize=9, fontstyle="italic",
            color="#777777", ha="center")
    ax.text(-81.4, 36.05, "North Carolina", fontsize=9, fontstyle="italic",
            color="#777777", ha="center")
    ax.text(-82.6, 36.25, "Tennessee", fontsize=9, fontstyle="italic",
            color="#777777", ha="center")

    # Plot gauge markers
    label_offsets = {
        "03479000": (0.06, -0.10),
        "03161000": (0.06, 0.04),
        "03486000": (0.06, 0.04),
        "03164000": (0.06, 0.04),
    }
    for sid, info in data.items():
        lat = info["lat"]
        lon = info["lon"]
        regulated = info.get("regulated_flag", False)
        marker = "s" if regulated else "o"
        color = "#d62728" if regulated else "#1f77b4"
        ax.scatter(lon, lat, s=100, marker=marker, color=color,
                   edgecolor="black", linewidth=0.8, zorder=5)
        dx, dy = label_offsets.get(sid, (0.06, 0.04))
        ax.annotate(
            f"{sid}\n{info['name']}",
            xy=(lon, lat),
            xytext=(lon + dx, lat + dy),
            fontsize=7.5,
            zorder=6,
            bbox=dict(boxstyle="round,pad=0.2", facecolor="white",
                      edgecolor="none", alpha=0.8),
        )

    # Draw upstream -> downstream arrows
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
                arrowprops=dict(arrowstyle="-|>", color="#555555", lw=1.5,
                                connectionstyle="arc3,rad=0.1"),
                zorder=3,
            )

    # Watershed basin labels
    # New River basin: 03161000 and 03164000
    nr_lon = (data["03161000"]["lon"] + data["03164000"]["lon"]) / 2
    nr_lat = (data["03161000"]["lat"] + data["03164000"]["lat"]) / 2 + 0.15
    ax.text(nr_lon, nr_lat, "New River Basin", fontsize=10, fontweight="bold",
            color="#1f77b4", alpha=0.7, ha="center",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="#e8f0fe",
                      edgecolor="#1f77b4", alpha=0.4))

    # Watauga River basin: 03479000 and 03486000
    wr_lon = (data["03479000"]["lon"] + data["03486000"]["lon"]) / 2
    wr_lat = min(data["03479000"]["lat"], data["03486000"]["lat"]) - 0.12
    ax.text(wr_lon, wr_lat, "Watauga River Basin", fontsize=10,
            fontweight="bold", color="#1f77b4", alpha=0.7, ha="center",
            bbox=dict(boxstyle="round,pad=0.3", facecolor="#e8f0fe",
                      edgecolor="#1f77b4", alpha=0.4))

    # TVA Dam annotation
    dam_info = data["03486000"]
    ax.annotate(
        "Watauga Dam\n(TVA)",
        xy=(dam_info["lon"], dam_info["lat"]),
        xytext=(dam_info["lon"] - 0.35, dam_info["lat"] + 0.15),
        fontsize=8, fontweight="bold", color="#d62728",
        arrowprops=dict(arrowstyle="->", color="#d62728", lw=1.0),
        bbox=dict(boxstyle="round,pad=0.3", facecolor="#fde8e8",
                  edgecolor="#d62728", alpha=0.8),
        zorder=6,
    )

    # Legend
    unreg_marker = mlines.Line2D([], [], color="#1f77b4", marker="o",
                                  linestyle="None", markersize=8,
                                  markeredgecolor="black", markeredgewidth=0.8,
                                  label="Unregulated gauge")
    reg_marker = mlines.Line2D([], [], color="#d62728", marker="s",
                                linestyle="None", markersize=8,
                                markeredgecolor="black", markeredgewidth=0.8,
                                label="Regulated gauge (TVA)")
    flow_arrow = mlines.Line2D([], [], color="#555555", linewidth=1.5,
                                label="Flow direction")
    ax.legend(handles=[unreg_marker, reg_marker, flow_arrow],
              loc="lower right", fontsize=8, framealpha=0.9)

    ax.set_title("Study Sites: Southern Appalachian Watersheds", fontsize=12,
                 fontweight="bold", pad=12)
    ax.set_xlabel("Longitude (\u00b0W)")
    ax.set_ylabel("Latitude (\u00b0N)")
    ax.grid(True, linestyle="--", alpha=0.3)
    ax.set_aspect("equal", adjustable="datalim")

    # Add some padding
    all_lons = [info["lon"] for info in data.values()]
    all_lats = [info["lat"] for info in data.values()]
    ax.set_xlim(min(all_lons) - 0.6, max(all_lons) + 0.6)
    ax.set_ylim(min(all_lats) - 0.3, max(all_lats) + 0.35)

    args.out.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(args.out, dpi=300, bbox_inches="tight")
    plt.close(fig)
    print(f"Wrote: {args.out}")


if __name__ == "__main__":
    main()
