"""Vector diagrams of the full-input models at the campaign's evaluation freeze."""
from html import escape

# Nodes share three lanes. Coordinates and routes stay the same at every viewport.
LANES = {"left": (8, 168), "right": (204, 168), "center": (67, 246)}
HEIGHT = 52
MODELS = (
    {
        "id": "lstm", "tab": "LSTM", "name": "Sequence-to-sequence LSTM",
        "lead": "Carry the river’s recent history forward one forecast hour at a time.",
        "body": "A long short-term memory (LSTM) encoder reads 168 hourly gauge inputs in order. Projected soil moisture initializes its hidden state. The encoder passes its final hidden and cell states to the decoder.",
        "readout": "At each lead, the decoder combines the issued forecast inputs, the lead number and the same soil context. A shared linear layer converts each decoder state into a correction.",
        "capacity": "64 hidden units", "training": "0.0003 learning rate · 200-epoch cap",
        "nodes": [
            ("left", 10, "input", "Gauge history", "168 hourly flow slots"),
            ("right", 10, "input", "Soil moisture", "projected HRRR H0"),
            ("left", 94, "learned", "LSTM encoder", "hidden + cell state"),
            ("right", 94, "input", "Forecast inputs", "NWM + HRRR + lead"),
            ("center", 180, "learned", "LSTM decoder", "18 recurrent forecast steps"),
        ],
        "paths": ["M92 62 V91", "M204 36 H190 V120 H179", "M372 36 H385 V206 H316",
                  "M92 146 V163 H146 V177", "M288 146 V163 H235 V177"],
        "head": ("Linear head", "one residual per lead"),
    },
    {
        "id": "gru", "tab": "GRU + Conv", "name": "GRU with temporal convolutions",
        "lead": "Combine a memory of past flow with patterns across neighboring forecast hours.",
        "body": "A gated recurrent unit (GRU) encodes the gauge history, starting from a hidden state set by soil moisture. In parallel, two width-three convolutions scan the issued NWM and HRRR forecast sequence. Interior leads can use a five-hour forecast neighborhood.",
        "readout": "For each lead, the network joins the final GRU state, the local convolution output, soil context and lead number. A shared multilayer perceptron (MLP) uses two linear layers to turn those features into a correction.",
        "capacity": "64 hidden units · two convolutions", "training": "0.0001 learning rate · 100-epoch cap",
        "nodes": [
            ("left", 10, "input", "Gauge history", "168 hourly flow slots"),
            ("right", 10, "input", "Soil moisture", "projected HRRR H0"),
            ("left", 94, "learned", "GRU encoder", "final history state"),
            ("right", 94, "input", "Forecast inputs", "NWM + HRRR + lead"),
            ("right", 170, "learned", "Temporal conv.", "2 layers · 3 leads wide"),
            ("center", 248, "learned", "Join features at each lead", "history, convolution, soil + lead"),
        ],
        "paths": ["M92 62 V91", "M204 36 H190 V120 H179", "M372 36 H385 V274 H316",
                  "M288 146 V167", "M92 146 V233 H146 V245", "M288 222 V233 H235 V245"],
        "head": ("Shared MLP", "one residual per lead"),
    },
    {
        "id": "transformer", "tab": "Transformer", "name": "Temporal Transformer",
        "lead": "Let each forecast hour attend to the parts of the previous week that help predict its error.",
        "body": "The encoder groups 168 hours of gauge history into 56 ordered three-hour patches. It adds learned positions and uses self-attention to encode the patches. A projected soil-moisture token joins that memory after the encoder.",
        "readout": "The 18 issued forecast tokens carry their lead positions. The decoder uses self-attention across these known forecasts and cross-attention to the memory. A shared multilayer perceptron (MLP) reads out one correction per lead.",
        "capacity": "64-wide embeddings · 4 heads · 2 layers in each stack",
        "training": "0.0003 learning rate · 100-epoch cap",
        "nodes": [
            ("left", 10, "input", "Gauge patches", "56 × 3-hour patches"),
            ("right", 10, "input", "Soil moisture", "HRRR initial state"),
            ("left", 88, "learned", "History encoder", "position + self-attention"),
            ("right", 88, "learned", "Soil token", "one projected H0 state"),
            ("left", 167, "learned", "Decoder memory", "encoded history + soil"),
            ("right", 167, "input", "Forecast queries", "NWM + HRRR · 18 leads"),
            ("center", 248, "learned", "Attention decoder", "self- and cross-attention"),
        ],
        "paths": ["M92 62 V85", "M288 62 V85", "M92 140 V164",
                  "M288 140 V153 H135 V164", "M92 219 V233 H146 V245", "M288 219 V233 H235 V245"],
        "head": ("Shared MLP", "one residual per lead"),
    },
)


def node(lane, top, kind, label, detail):
    left, width = LANES[lane]
    x = left + width / 2
    return (f'<g class="flow-node flow-{kind}"><rect x="{left}" y="{top}" width="{width}" '
            f'height="{HEIGHT}" rx="10"/><text class="flow-name" x="{x:g}" y="{top+22}">{escape(label)}</text>'
            f'<text class="flow-detail" x="{x:g}" y="{top+39}">{escape(detail)}</text></g>')


def diagram(model):
    key = model["id"]
    bottom = model["nodes"][-1][1] + HEIGHT
    head_y = bottom + 34
    sum_y = head_y + 82
    head_label, head_detail = model["head"]
    nodes = [*model["nodes"], ("left", head_y, "learned", head_label, head_detail),
             ("right", head_y, "input", "NWM baseline", "matching hour · m³/s"),
             ("center", sum_y, "output", "Corrected streamflow", "NWM + rescaled residual · H1–H18")]
    paths = [*model["paths"], f"M190 {bottom} V{bottom+17} H92 V{head_y-3}",
             f"M92 {head_y+HEIGHT} V{sum_y-16} H146 V{sum_y-3}"]
    raw_path = f"M288 {head_y+HEIGHT} V{sum_y-16} H235 V{sum_y-3}"
    marker = f"arrow-{key}"
    lines = "".join(f'<path d="{path}"/>' for path in paths)
    blocks = "".join(node(*item) for item in nodes)
    return f"""<svg class="model-graph" viewBox="0 0 394 {sum_y+HEIGHT+11}" role="img" aria-labelledby="graph-{key}-title" aria-describedby="graph-{key}-desc">
      <title id="graph-{key}-title">Full-input {escape(model['name'])} residual correction</title>
      <desc id="graph-{key}-desc">{escape(model['body'])} {escape(model['readout'])} After conversion to m³/s, each signed correction is added to the original NWM forecast at the same hour.</desc>
      <defs><marker id="{marker}" viewBox="0 0 9 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0L8 4 0 8Z" class="flow-tip"/></marker></defs>
      <g aria-hidden="true"><g class="flow-wires" marker-end="url(#{marker})">{lines}<path class="flow-anchor-wire" d="{raw_path}"/></g>{blocks}</g>
    </svg>"""


def render_models():
    tabs, panels = [], []
    for model in MODELS:
        key = model["id"]
        tabs.append(f'<button type="button" id="tab-{key}" role="tab" aria-controls="model-{key}">{escape(model["tab"])}</button>')
        panels.append(f"""<article class="model-panel" id="model-{key}" aria-labelledby="name-{key}">
          <div class="model-introduction"><h3 id="name-{key}">{escape(model['name'])}</h3>
          <p class="model-lead">{escape(model['lead'])}</p></div>
          <figure class="model-figure">{diagram(model)}
          <figcaption>Solid arrows carry features or learned states. The dashed arrow carries the original NWM forecast into the final sum.</figcaption></figure>
          <div class="model-details"><p>{escape(model['body'])}</p><p>{escape(model['readout'])}</p>
          <dl class="model-settings"><div><dt>Network size</dt><dd>{escape(model['capacity'])}</dd></div>
          <div><dt>Training recipe</dt><dd>AdamW · {escape(model['training'])}</dd></div></dl></div>
        </article>""")
    return (f'<div class="model-tabs" role="tablist" aria-label="Model architecture" hidden>{"".join(tabs)}</div>'
            + '<div class="model-panels">' + "\n".join(panels) + '</div>')
