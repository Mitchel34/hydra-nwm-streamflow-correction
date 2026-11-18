"""Build the public narrative from reviewed aggregate scores; all figures work without JavaScript."""
from hashlib import sha256
from html import escape
from math import ceil, floor
from pathlib import Path

HERE = Path(__file__).resolve().parent
SERIES = [("LSTM", "lstm"), ("GRU+Conv", "gru"), ("Transformer", "transformer"), ("Persistence", "persist")]
RIVERS = {"Galax": "New River · Virginia", "Jefferson": "South Fork New River · North Carolina",
          "Sugar Grove": "Watauga River · North Carolina"}
IDS = {"Galax": "03164000", "Jefferson": "03161000", "Sugar Grove": "03479000"}
CAPTIONS = {
    "Galax": "All three networks have lower MAE than NWM from H5 through H18. Through H7, repeating the last gauge reading beats every network.",
    "Jefferson": "The LSTM and GRU+Conv have lower MAE than NWM at every lead. A linear regression on NWM remains competitive in pooled squared error.",
    "Sugar Grove": "The Transformer has higher MAE than NWM at all 18 leads. Its first-hour error more than doubles. The other two networks stay close to NWM.",
}

def digest(name):
    return sha256((HERE / "site" / name).read_bytes()).hexdigest()[:10]

def pct(value):
    return f"{value:+.1f}%".replace("-", "−")

def gauge_panel(data, site):
    scores = data["by_lead"][site]["mae"]
    nwm = scores["NWM"]
    leads = range(18)
    change = {name: [100 * (1 - score / base) for score, base in zip(scores[name], nwm)] for name, _ in SERIES}
    extent = [0.0] + [v for curve in change.values() for v in curve]
    step = 50 if max(extent) - min(extent) > 125 else 20
    low, high = step * floor(min(extent) / step), step * ceil(max(extent) / step)
    left, right, top, bottom = 51, 606, 17, 225
    def x(i): return left + (right-left)*i/17
    def y(v): return bottom - (bottom-top)*(v-low)/(high-low)
    grid = []
    for v in range(low, high + 1, step):
        grid.append(f'<path class="{"zero" if v == 0 else "grid"}" d="M{left} {y(v):.2f}H{right}"/>'
                    f'<text x="{left - 9}" y="{y(v)+4:.2f}" text-anchor="end">{v}%</text>')
    for lead in (1, 4, 7, 10, 13, 16, 18):
        grid.append(f'<text x="{x(lead-1):.2f}" y="248" text-anchor="middle">{lead}</text>')
    lines = []
    legend = []
    for name, key in SERIES:
        points = " ".join(f"{x(i):.2f},{y(change[name][i]):.2f}" for i in leads)
        lines.append(f'<polyline class="curve {key}" data-series="{name}" points="{points}"/>')
        legend.append(f'<span><i class="line-key {key}"></i>{name}</span>')
    identifier = IDS[site]
    rows = []
    for i in leads:
        cells = "".join(f'<td>{pct(change[name][i])}</td>' for name, _ in SERIES)
        rows.append(f'<tr><th scope="row">H{i+1}</th><td>{nwm[i]:.2f}</td>{cells}</tr>')
    heads = "".join(f'<th scope="col">{name}</th>' for name, _ in SERIES)
    summary = "".join(f'<div><dt><i class="line-key {key}"></i>{name}</dt><dd data-value="{idx}">{pct(change[name][17])}</dd></div>'
                      for idx,(name,key) in enumerate(SERIES))
    return f"""<article class="gauge-panel" id="panel-{identifier}" data-gauge="{escape(site)}" aria-labelledby="g-{identifier}">
      <div class="chart-header"><div><p class="kicker">{RIVERS[site]}</p><h3 id="g-{identifier}">{site}</h3></div>
      <a class="station" href="https://waterdata.usgs.gov/monitoring-location/USGS-{identifier}/">USGS {identifier} ↗</a></div>
      <p class="chart-measure">Reduction in mean absolute error relative to NWM</p>
      <div class="plot-layout"><div class="plot-area">
      <svg class="lead-plot" viewBox="0 0 628 264" role="img" aria-labelledby="plot-{identifier} desc-{identifier}">
        <title id="plot-{identifier}">Mean absolute error reduction by forecast lead at {site}</title>
        <desc id="desc-{identifier}">{CAPTIONS[site]} Positive values indicate lower error. The table below gives every lead.</desc>
        {''.join(grid)}{''.join(lines)}<line class="lead-cursor" x1="{right}" x2="{right}" y1="{top}" y2="{bottom}"/></svg>
      <div class="axis-title">Forecast lead (hours)</div><div class="plot-legend">{''.join(legend)}</div></div>
      <aside class="readout" aria-label="Changes at the selected lead"><span class="readout-label">Forecast lead</span>
      <strong class="lead-number">H18</strong><dl>{summary}</dl></aside></div>
      <label class="scrub js-only">Explore a forecast lead <input type="range" min="1" max="18" value="18" aria-label="Forecast lead at {site}" aria-valuetext="18 hours"></label>
      <p class="chart-caption">{CAPTIONS[site]}</p>
      <details><summary>View all 18 lead values</summary><div class="table-scroll" tabindex="0" role="region" aria-label="Scrollable {site} score table">
        <table><caption>NWM MAE in m³/s and percentage reduction in MAE relative to NWM. Positive values indicate lower error.</caption>
        <thead><tr><th scope="col">Lead</th><th scope="col">NWM MAE</th>{heads}</tr></thead><tbody>{''.join(rows)}</tbody></table></div></details>
    </article>"""

def render(data, preview=False):
    q = data["quoted"]
    sites = ("Galax", "Jefferson", "Sugar Grove")
    controls = "".join(f'<button type="button" aria-controls="panel-{IDS[site]}" aria-pressed="{str(i==0).lower()}" data-pick="{site}">{site}</button>'
                       for i,site in enumerate(sites))
    values = {"GAUGE_CONTROLS": controls, "GAUGES": "\n".join(gauge_panel(data, s) for s in sites),
              "JEFFERSON": q["jefferson_reduction"], "GALAX": q["galax_reduction"], "GROVE": q["grove_within"],
              "GROVE_MODEL_H1": q["grove_mae"]["network"]["1h"], "GROVE_NWM_H1": q["grove_mae"]["nwm"]["1h"],
              "SOIL_J": q["soil_jefferson"], "SOIL_G": q["soil_galax"],
              "STORY_CSS": digest("story.css"), "STORY_JS": digest("story.js"), "THEME_JS": digest("theme.js"),
              "ROBOTS": '<meta name="robots" content="noindex, nofollow">' if preview else ""}
    html = (HERE / "story.template.html").read_text()
    for key, value in values.items(): html = html.replace("@@" + key + "@@", value)
    if "@@" in html: raise ValueError("Unresolved study page field")
    return html
