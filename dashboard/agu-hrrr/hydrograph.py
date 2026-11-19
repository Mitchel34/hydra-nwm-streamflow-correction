"""Render calendar-time streamflow from the published, fitting-period weekly summaries."""
import json
from datetime import date, timedelta
from html import escape
from math import ceil
from pathlib import Path

HERE = Path(__file__).resolve().parent
KEYS = ("Galax", "Jefferson", "Sugar Grove")


def hydrograph():
    data = json.loads((HERE / "site/files/flow-weeks.json").read_text())
    weeks, series = data["weeks"], data["sites"]
    high = 25 * ceil(max(v["mean"] for s in series.values() for v in s["values"] if v["mean"] is not None) / 25)
    x = lambda i: 48 + i * 668 / (len(weeks)-1)
    y = lambda flow: 196 - flow * 174 / high
    grid = []
    for i in range(5):
        value = high*i/4
        grid.append(f'<path d="M48 {y(value):.2f}h668"/><text x="39" y="{y(value)+4:.2f}" text-anchor="end">{value:g}</text>')
    for i in (0, 8, 16, 24, 32, len(weeks)-1):
        dt = date.fromisoformat(weeks[i])
        grid.append(f'<text x="{x(i):.1f}" y="222" text-anchor="middle">{dt:%b} {dt.day}</text>')
    curves, rows = [], []
    for k, site in enumerate(KEYS):
        points = []
        new = True
        for i, record in enumerate(series[site]["values"]):
            value = record["mean"]
            if value is None:
                new = True
                continue
            points.append(f'{"M" if new else "L"}{x(i):.2f} {y(value):.2f}')
            new = False
        curves.append(f'<path class="flow-series site-{k}" d="{" ".join(points)}"/>')
    for i, week in enumerate(weeks):
        cells = []
        for key in KEYS:
            record = series[key]["values"][i]
            value = f'{record["mean"]:.2f}' if record["mean"] is not None else f'Gap ({record["days"]}/7 days)'
            cells.append(f'<td>{value}</td>')
        rows.append(f'<tr><th scope="row">{week}</th>{"".join(cells)}</tr>')
    bands = ['<option value="0">All 39 weeks</option>']
    for i in range(0, len(weeks), 13):
        a, b = date.fromisoformat(weeks[i]), date.fromisoformat(weeks[min(i+12,len(weeks)-1)])+timedelta(days=6)
        bands.append(f'<option value="{1+i//13}">{a:%b} {a.day}, {a.year} – {b:%b} {b.day}, {b.year}</option>')
    names = "".join(f'<label><input type="checkbox" value="{key}" checked><i class="site-line site-{i}"></i>{key}</label>' for i,key in enumerate(KEYS))
    links = " · ".join(f'<a href="{escape(series[key]["source"], quote=True)}">{key} daily record</a>' for key in KEYS)
    inline = json.dumps(data, ensure_ascii=False,separators=(",",":")).replace("<", "\\u003c")
    return f"""<article id="hydrographs" class="flow-explorer" aria-labelledby="hydro-title">
      <div class="flow-title"><p class="kicker">Observed discharge · fitting period</p><h3 id="hydro-title">Three gauges, week by week.</h3>
      <p>Compare measured flow through time. Each point averages seven approved, unflagged USGS daily means. A gap marks a week with fewer than seven. The forecast scores above compare errors by lead.</p></div>
      <div class="flow-controls" hidden><fieldset><legend>Gauges</legend>{names}</fieldset>
      <label class="flow-window">Time window<select id="flow-window">{"".join(bands)}</select></label></div>
      <figure><figcaption>Weekly mean discharge (m³/s)</figcaption>
      <div class="flow-static"><svg viewBox="0 0 750 239" role="img" aria-label="Weekly observed discharge at Galax, Jefferson and Sugar Grove from May 2021 to January 2022. Exact values follow in the table.">
      <g class="flow-grid">{"".join(grid)}</g>{"".join(curves)}</svg>
      <p class="static-key">Solid — Galax · dashed — Jefferson · dotted — Sugar Grove</p></div>
      <div class="flow-canvas" hidden><canvas aria-label="Weekly flow hydrograph. Use the week slider for an exact reading, or open the data table." role="img"></canvas></div></figure>
      <div class="flow-inspect" hidden><label for="flow-week">Inspect a week</label><input id="flow-week" type="range" min="0" max="{len(weeks)-1}" value="0">
      <div class="flow-values"><strong class="flow-date"></strong><span class="flow-reading"></span></div></div>
      <details><summary>Weekly observations and source data</summary><p>Weeks run Monday through Sunday in station-local calendar dates. Absolute discharge reflects basin size as well as basin conditions. These observations give the study hydrologic context.</p>
      <div class="table-scroll" role="region" tabindex="0" aria-label="Weekly observed discharge"><table><caption>Week starting and mean discharge in m³/s</caption><thead><tr><th scope="col">Week starting</th>{"".join(f'<th scope="col">{k}</th>' for k in KEYS)}</tr></thead><tbody>{"".join(rows)}</tbody></table></div>
      <p>{links} · <a href="files/flow-weeks.json">Weekly summary data</a></p></details>
      <script type="application/json" id="weekly-flow-data">{inline}</script>
    </article>"""
