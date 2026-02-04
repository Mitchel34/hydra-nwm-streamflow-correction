#!/usr/bin/env python3
"""WRR-style site map: four gauges with upstream/downstream links."""

from __future__ import annotations

import argparse
from pathlib import Path

import os
import sys

import matplotlib.pyplot as plt

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

from config.master_study_sites import MASTER_STUDY_SITES


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", type=Path, default=Path("results/figures/wrr_site_map.png"))
    args = ap.parse_args()

    sites = ["03479000", "03161000", "03486000", "03164000"]
    data = {sid: MASTER_STUDY_SITES[sid] for sid in sites if sid in MASTER_STUDY_SITES}

    fig, ax = plt.subplots(figsize=(7, 6))
    for sid, info in data.items():
        lat = info["lat"]
        lon = info["lon"]
        regulated = info.get("regulated_flag", False)
        marker = "s" if regulated else "o"
        color = "#d62728" if regulated else "#1f77b4"
        ax.scatter(lon, lat, s=80, marker=marker, color=color, edgecolor="black", zorder=3)
        ax.text(lon + 0.05, lat + 0.05, f"{sid}\n{info['name']}", fontsize=8)

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
                arrowprops=dict(arrowstyle="->", color="gray", lw=1.2),
                zorder=2,
            )

    ax.set_title("Study Sites (Upstream → Downstream)")
    ax.set_xlabel("Longitude")
    ax.set_ylabel("Latitude")
    ax.grid(True, linestyle="--", alpha=0.4)
    ax.set_aspect("equal", adjustable="datalim")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    fig.tight_layout()
    fig.savefig(args.out, dpi=200)
    plt.close(fig)
    print(f"Wrote: {args.out}")


if __name__ == "__main__":
    main()
